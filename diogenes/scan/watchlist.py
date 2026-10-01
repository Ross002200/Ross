"""Günlük takip listesi (sistemin kâğıt işlemlerinden ayrı).

Her işlem günü, açılıştan önce bir kez: yükseliş trendindeki likit hisselerden günün en güçlü 10 adayını seçer,
her biri için giriş (dünkü tepenin kırılımı), stop, hedef ve tarihsel olasılık hesaplar, nedenleri Türkçe yazar.
Liste gün boyunca sabit kalır; tarama her çalıştığında hissenin girişe/hedefe/stopa gelip gelmediği güncellenir.
Gün bitince sonuçlar geçmişe yazılır.

Olasılık: son ~6 ayda aynı kuralın (aynı puan seviyesinde) tüm likit hisselerde ertesi gün ne yaptığı sayılır.
Aynı gün hem stop hem hedef görüldüyse sonuç stop sayılır (kötümser).
"""
import json
import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import scan as S

WL = S.DATA / "watchlist.json"
HIST = S.DATA / "watch_history.json"
TOP_N = 10
# Chosen from a 1-year test on ~30,000 setups (see method text): stop 1 ATR, targets +0.5 and +1 ATR above entry.
STOP_ATR, T1_ATR, T2_ATR = 1.0, 0.5, 1.0


def _features(d):
    """Per-day setup features for one symbol's daily bars (index aligned)."""
    c, h, l, v = d["Close"], d["High"], d["Low"], d["Volume"]
    e10, e20, e50 = S.ema(c, 10), S.ema(c, 20), S.ema(c, 50)
    atr = S.atr_series(d)
    hi20 = h.rolling(20).max()
    rv = v / v.rolling(20).mean().shift(1)
    return pd.DataFrame(dict(c=c, h=h, l=l, o=d["Open"], e10=e10, e20=e20, e50=e50, atr=atr, near=c / hi20, rv=rv,
                             trend=(c > e20) & (e20 > e50), stack=(c > e10) & (e10 > e20)))


def _tier(row, rs):
    s = int(rs >= 80) + int(bool(row["stack"])) + int(row["near"] >= 0.98) + int((row["rv"] or 0) >= 1.2)
    return "A" if s >= 3 else "B" if s == 2 else "C"


def calibrate(d1map, symbols, spy=None):
    """Next-day outcomes of the rule over the whole history, by tier.
    Entry = prior high (+1c) or the open if it gaps above; stop = entry - 1 ATR; T1 = +0.5 ATR; T2 = +1 ATR.
    A day that touches both the stop and a target counts as a stop (pessimistic)."""
    rets = pd.DataFrame({s: d1map[s]["Close"] for s in symbols if s in d1map and len(d1map[s]) > 80})
    rsdf = (rets / rets.shift(63) - 1).rank(axis=1, pct=True) * 100
    keys = [t + m for t in "ABC" for m in ("+", "-")]
    agg = {t: dict(n=0, trig=0, t1=0, t2=0, stop=0, r1=0.0) for t in keys}
    up = ((spy > S.ema(spy, 50)).reindex(rets.index).fillna(True).to_numpy()) if spy is not None else np.ones(len(rets), bool)
    for s in rets.columns:
        f = _features(d1map[s]).reindex(rets.index)
        a = f.to_numpy()
        k = {c: i for i, c in enumerate(f.columns)}
        rs = rsdf[s].to_numpy()
        for i in range(64, len(f) - 1):
            r, nx = a[i], a[i + 1]
            if not (r[k["trend"]] and r[k["near"]] >= 0.95) or np.isnan(r[k["atr"]]) or np.isnan(rs[i]) or np.isnan(nx[k["h"]]):
                continue
            t = _tier(dict(stack=r[k["stack"]], near=r[k["near"]], rv=0 if np.isnan(r[k["rv"]]) else r[k["rv"]]), rs[i])
            g = agg[t + ("+" if up[i] else "-")]
            g["n"] += 1
            trig, atr = r[k["h"]] + 0.01, r[k["atr"]]
            if nx[k["h"]] < trig:
                continue
            g["trig"] += 1
            entry = max(trig, nx[k["o"]])
            stop, t1, t2 = entry - STOP_ATR * atr, entry + T1_ATR * atr, entry + T2_ATR * atr
            if nx[k["l"]] <= stop:
                g["stop"] += 1
                g["r1"] -= 1
            else:
                if nx[k["h"]] >= t1:
                    g["t1"] += 1
                    g["r1"] += T1_ATR / STOP_ATR
                else:
                    g["r1"] += (nx[k["c"]] - entry) / (entry - stop)
                if nx[k["h"]] >= t2:
                    g["t2"] += 1
    out = {}
    merged = {t: {x: agg[t + "+"][x] + agg[t + "-"][x] for x in agg[t + "+"]} for t in "ABC"}
    merged["all"] = {x: sum(agg[q][x] for q in keys) for x in ("n", "trig", "t1", "t2", "stop", "r1")}
    for m in "+-":
        merged["all" + m] = {x: sum(agg[t + m][x] for t in "ABC") for x in ("n", "trig", "t1", "t2", "stop", "r1")}
    for t, g in list(agg.items()) + list(merged.items()):
        tr = g["trig"]
        out[t] = dict(n=g["n"], triggered=tr, p_trigger=round(100 * tr / g["n"], 1) if g["n"] else None,
                      p_t1=round(100 * g["t1"] / tr, 1) if tr else None, p_t2=round(100 * g["t2"] / tr, 1) if tr else None,
                      p_stop=round(100 * g["stop"] / tr, 1) if tr else None, avg_r_t1=round(g["r1"] / tr, 3) if tr else None)
    return out


def _reasons(sym, f, rs, srank, sector, cand, night_item, news, today_rv):
    rs_txt = f"RS {rs}: son 3 ayda hisselerin %{rs}'inden daha güçlü"
    why = []
    if f["stack"]:
        why.append("Günlük grafikte fiyat EMA10 > EMA20 > EMA50 sıralamasında: düzenli yükseliş trendi (Oliver Kell, Minervini)")
    elif f["trend"]:
        why.append("Fiyat 20 ve 50 günlük ortalamanın üstünde: yükseliş trendi sürüyor")
    if rs >= 70:
        why.append(rs_txt + " (liderleri al: Minervini, Kullamägi)")
    if f["near"] >= 0.98:
        why.append(f"20 günlük zirvenin %{(1 - f['near']) * 100:.1f} altında: kırılım eşiğinde")
    elif f["near"] >= 0.95:
        why.append(f"20 günlük zirveye %{(1 - f['near']) * 100:.1f} uzaklıkta")
    if srank and srank <= 4:
        why.append(f"Sektörü ({sector}) son 1 ayın en güçlü {srank}. sektörü (J Law, Martin Luk: sıcak sektör)")
    rv = today_rv if today_rv is not None else f["rv"]
    if rv and rv >= 1.2:
        why.append(f"Hacim normalin {rv:.1f} katı: kurumsal ilgi")
    if cand:
        why.append(f"{cand['tf']} grafikte order flow kurulumu var (not {cand['grade']}, Baştan Sona Trade)")
    if night_item and night_item.get("verdict") == "olumlu":
        why.append(f"Claude açılış öncesi analizi olumlu: {night_item.get('catalyst') or night_item.get('note')}")
    for n in news or []:
        if n.get("fresh") and n.get("tone") == "olumlu":
            why.append(f"Taze olumlu haber: {n['title']}")
            break
    return why


def _risks(c_earn, today, mkt, f, gap, night_item, news):
    r = []
    if c_earn:
        dd = (pd.Timestamp(c_earn).date() - today).days
        if 0 <= dd <= 5:
            r.append(f"Bilanço {dd} gün sonra ({c_earn}): ani hareket riski")
    if mkt.get("shield"):
        r.append("Piyasa kalkanı aktif: " + "; ".join(mkt["shield"]))
    for cmsg in mkt.get("caution") or []:
        r.append(cmsg)
    if f["near"] >= 0.995:
        r.append("Zirvenin hemen dibinde: kırılım başarısız olursa geri dönüş hızlı olabilir")
    if gap is not None and gap > 4:
        r.append(f"Açılışta %{gap:.1f} gap: kovalamak yerine geri çekilme beklemek daha güvenli")
    if night_item and night_item.get("risks"):
        r.append("Claude: " + night_item["risks"])
    for n in news or []:
        if n.get("fresh") and n.get("tone") == "olumsuz":
            r.append(f"Olumsuz haber: {n['title']}")
    r.append("Olasılıklar geçmişten hesaplanır; garanti değildir. Kaldıraç kullanma, stopu mutlaka koy.")
    return r


def build(today, now, d1map, m15map, live, rsmap, srank, uni, cands, mkt, night, tradeable):
    """Create today's list once (frozen levels), then only refresh live status."""
    cur = json.loads(WL.read_text()) if WL.exists() else None
    if cur and cur.get("date") != str(today):
        finalize(cur)
        cur = None
    if cur is None:
        syms = [s for s in tradeable if (uni.get(s) or {}).get("sector") != "ETF" and s in d1map and s not in ("SPY", "QQQ", "IWM")]
        # calibrate on every liquid stock (not only today's uptrends) to avoid survivorship bias
        liquid = [x for x, d in d1map.items() if x != "^VIX" and (uni.get(x) or {}).get("sector") != "ETF" and len(d) > 80
                  and float(d["Close"].iloc[-1]) >= S.F["min_price"] and float(d["Volume"].iloc[-20:].mean()) >= S.F["min_avg_volume"]]
        try:  # one year of daily bars for a steadier calibration (once a day)
            raw = S.download(liquid, period="1y", interval="1d")
            dlong = {x: S.split(raw, x) for x in liquid}
            dlong = {x: v[v.index.date < today] for x, v in dlong.items() if len(v) > 80}
            sp = S.split(S.download(["SPY"], period="1y", interval="1d"), "SPY")
            spy = sp[sp.index.date < today]["Close"]
        except Exception:
            dlong = {x: d1map[x][d1map[x].index.date < today] for x in liquid}
            spy = None
        cal = calibrate(dlong, list(dlong), spy)
        sd = d1map.get("SPY")
        sd = sd[sd.index.date < today]["Close"] if sd is not None else None
        mflag = "+" if sd is None or sd.iloc[-1] > S.ema(sd, 50).iloc[-1] else "-"
        bad = {x["symbol"] for x in (night or {}).get("stocks", []) if x.get("verdict") in ("olumsuz", "kaçın")}
        nmap = {x["symbol"]: x for x in (night or {}).get("stocks", [])}
        cmap = {c["symbol"]: c for c in cands}
        pool = []
        for s in syms:
            d = d1map[s][d1map[s].index.date < today]
            if len(d) < 70 or s in bad:
                continue
            f = _features(d).iloc[-1]
            if not (f["trend"] and f["near"] >= 0.95) or math.isnan(f["atr"]):
                continue
            rs = rsmap.get(s, 50)
            tier = _tier(dict(stack=f["stack"], near=f["near"], rv=0 if math.isnan(f["rv"]) else f["rv"]), rs)
            score = {"A": 3, "B": 2, "C": 1}[tier] * 100 + rs + (20 if s in cmap else 0) + (30 if (nmap.get(s) or {}).get("verdict") == "olumlu" else 0)
            pool.append((score, s, f, tier, rs))
        pool.sort(key=lambda x: -x[0])
        items = []
        for score, s, f, tier, rs in pool[:TOP_N * 2]:
            if len(items) >= TOP_N:
                break
            earn = S.earnings_date(s)
            if earn and 0 <= (pd.Timestamp(earn).date() - today).days <= 1:
                continue  # earnings today/tomorrow: skip
            news = S.headlines(s, 4)
            if any(n["fresh"] and n["tone"] == "olumsuz" for n in news):
                continue
            atr = float(f["atr"])
            d = d1map[s][d1map[s].index.date < today]
            cand = cmap.get(s)
            entry = float(f["h"]) + 0.01
            stop, target, target2, etype = entry - STOP_ATR * atr, entry + T1_ATR * atr, entry + T2_ATR * atr, "dünkü tepenin kırılımı"
            calt = cal.get(tier + mflag) if (cal.get(tier + mflag) or {}).get("triggered", 0) >= 200 else cal.get(tier) or {}
            sec = (uni.get(s) or {}).get("sector")
            m15 = m15map.get(s)
            td = m15[m15.index.date == today] if m15 is not None else pd.DataFrame()
            prev = float(d["Close"].iloc[-1])
            gap = float(td["Open"].iloc[0] / prev - 1) * 100 if len(td) else None
            items.append(dict(
                rank=len(items) + 1, symbol=s, name=(uni.get(s) or {}).get("name"), sector=sec, tier=tier, rs=rs,
                prev_close=S.r2(prev), entry=S.r2(entry), stop=S.r2(stop), target=S.r2(target), target2=S.r2(target2), entry_type=etype, atr=S.r2(atr),
                potential_pct=S.r2((target / entry - 1) * 100), potential2_pct=S.r2((target2 / entry - 1) * 100), risk_pct=S.r2((1 - stop / entry) * 100),
                prob_target=calt.get("p_t1"), prob_target2=calt.get("p_t2"), prob_trigger=calt.get("p_trigger"), prob_stop=calt.get("p_stop"),
                avg_r=calt.get("avg_r_t1"), sample=calt.get("triggered"),
                reasons=_reasons(s, f, rs, srank.get(S.SECTOR_ETF.get(sec, "")), sec, cand, nmap.get(s), news, None),
                risks=_risks(earn, today, mkt, f, gap, nmap.get(s), news), earnings=earn,
                news=[dict(title=n["title"], link=n["link"], tone=n["tone"], fresh=n["fresh"], source=n.get("source")) for n in news[:3]],
                claude=nmap.get(s), tv=f"https://www.tradingview.com/symbols/{s}/", status="bekliyor"))
        if items:
            S.notify("Günün takip listesi", "\n".join(f"{i['rank']}. {i['symbol']} · giriş {i['entry']} · stop {i['stop']} · hedef {i['target']} · %{i['prob_target']:.0f}" for i in items[:5])
                     + ("\nPiyasa kalkanı aktif: dikkatli ol." if mkt.get("shield") else ""), ["clipboard"], 3)
        cur = dict(date=str(today), created=datetime.now(timezone.utc).isoformat(timespec="seconds"), created_ny=S.hm(now),
                   method=dict(entry="dünkü tepenin 1 sent üstü (kırılım; açılış daha yukarıdaysa açılış)", stop=f"girişin {STOP_ATR} günlük ATR altı",
                               target=f"hedef 1: girişin {T1_ATR} ATR üstü · hedef 2: {T2_ATR} ATR üstü",
                               note="Olasılıklar son 1 yılda aynı görünümdeki tüm likit hisselerin ertesi gün ne yaptığından hesaplanır. Aynı gün hem stop hem hedef görüldüyse stop sayılır."),
                   calibration=cal, market_flag=mflag, items=items)
    update_status(cur, today, now, m15map, live)
    cur["market"] = dict(regime=mkt.get("regime"), note=mkt.get("note"), shield=mkt.get("shield"), caution=mkt.get("caution"),
                         spy=(mkt.get("SPY") or {}).get("intraday"), vix=(mkt.get("VIX") or {}).get("last"), breadth=mkt.get("breadth"))
    cur["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    cur["history"] = summary()
    WL.write_text(json.dumps(cur, ensure_ascii=False, indent=0, default=str))
    return cur


def update_status(cur, today, now, m15map, live):
    for it in cur["items"]:
        m = m15map.get(it["symbol"])
        td = m[m.index.date == today] if m is not None else pd.DataFrame()
        px = live.get(it["symbol"])
        if px:
            it["last"] = S.r2(px)
            it["chg"] = S.r2((px / it["prev_close"] - 1) * 100) if it.get("prev_close") else None
        if not len(td):
            continue
        it["high"], it["low"] = S.r2(td["High"].max()), S.r2(td["Low"].min())
        if it["status"] in ("hedef 2", "stop", "gün sonu"):
            continue
        for ts, b in td.iterrows():
            if it["status"] == "bekliyor" and b["High"] >= it["entry"]:
                it["status"], it["triggered_at"] = "girişte", ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
            if it["status"] == "girişte":
                if b["Low"] <= it["stop"]:
                    it["status"], it["done_at"] = "stop", ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
                    break
                if b["High"] >= it.get("target2", 1e18):
                    it["status"], it["done_at"] = "hedef 2", ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
                    break
                if b["High"] >= it["target"] and not it.get("t1_at"):
                    it["t1_at"] = ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
        if S.hm(now) >= "16:00" and it["status"] == "girişte":
            it["status"] = "hedef 1" if it.get("t1_at") else "gün sonu"
            it["close_r"] = S.r2((float(td["Close"].iloc[-1]) - it["entry"]) / (it["entry"] - it["stop"]))


def finalize(cur):
    h = json.loads(HIST.read_text()) if HIST.exists() else {"days": []}
    if any(x["date"] == cur["date"] for x in h["days"]):
        return
    h["days"].append(dict(date=cur["date"], items=[dict(symbol=i["symbol"], tier=i["tier"], prob=i.get("prob_target"), entry=i["entry"], stop=i["stop"],
                                                         target=i["target"], status=i["status"], t1=bool(i.get("t1_at")), close_r=i.get("close_r")) for i in cur["items"]]))
    h["days"] = h["days"][-90:]
    HIST.write_text(json.dumps(h, ensure_ascii=False, indent=0))


def summary():
    if not HIST.exists():
        return None
    days = json.loads(HIST.read_text())["days"][-20:]
    its = [i for d in days for i in d["items"]]
    trig = [i for i in its if i["status"] not in ("bekliyor",)]
    win = [i for i in trig if i.get("t1") or i["status"] in ("hedef 1", "hedef 2", "hedef")]
    return dict(days=len(days), items=len(its), triggered=len(trig), target=len(win), stop=sum(1 for i in trig if i["status"] == "stop"),
                p_target=round(100 * len(win) / len(trig), 1) if trig else None,
                recent=[dict(date=d["date"], target=sum(1 for i in d["items"] if i.get("t1") or i["status"].startswith("hedef")), stop=sum(1 for i in d["items"] if i["status"] == "stop"),
                             waiting=sum(1 for i in d["items"] if i["status"] == "bekliyor"), n=len(d["items"])) for d in days[-10:]])
