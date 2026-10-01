"""Günün hisseleri (sistemin kâğıt işlemlerinden ayrı).

Kural (kullanıcının istediği gibi): girişte beklemek yok, açılışta (gün içinde eklenenler için o anki fiyattan) alınır;
stop en fazla %2 aşağıda; hedef hissenin oynaklığına göre +%2 ile +%5 arası (günlük ATR'nin ~%80'i).
Seçim: yükseliş trendi, göreli güç, dünkü hacim ve kapanış gücü, iyi haber (Claude'un sabah analizi + taze haberler).
Olasılık: son 1 yılda aynı gruptaki (göreli güç, oynaklık, hacim, piyasa durumu) tüm likit hisselerin
ertesi gün açılıştan aldığında ne yaptığı. Aynı gün hem stop hem hedef görüldüyse stop sayılır (kötümser).
Liste sabah oluşur, gün içinde iyi haberli yeni hisseler eklenebilir; durum her taramada güncellenir.
"""
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import scan as S

WL = S.DATA / "watchlist.json"
HIST = S.DATA / "watch_history.json"
TOP_N, MAX_N = 8, 12
STOP_PCT = 2.0


def target_pct(atrp):
    return float(min(5.0, max(2.0, round(0.8 * atrp))))


def bucket(rs, atrp, rv, up):
    return f"{'R' if rs >= 80 else 'r'}{'V' if atrp >= 4 else 'v'}{'H' if rv >= 1.5 else 'h'}{'+' if up else '-'}"


def calibrate(dmap, spy):
    """Rows of (bucket, target, outcome) from one year of daily bars; returns stats per bucket and overall."""
    rets = pd.DataFrame({s: d["Close"] for s, d in dmap.items()})
    rsdf = (rets / rets.shift(63) - 1).rank(axis=1, pct=True) * 100
    spyup = (spy > S.ema(spy, 50)) if spy is not None else None
    rec = []
    for s, d in dmap.items():
        c, h, l, o, v = (d[x].to_numpy(dtype=float) for x in ("Close", "High", "Low", "Open", "Volume"))
        e20, e50 = S.ema(d["Close"], 20).to_numpy(), S.ema(d["Close"], 50).to_numpy()
        atr = S.atr_series(d).to_numpy()
        rv = (d["Volume"] / d["Volume"].rolling(20).mean().shift(1)).to_numpy()
        rs = rsdf[s].reindex(d.index).to_numpy()
        up = spyup.reindex(d.index).fillna(True).to_numpy() if spyup is not None else np.ones(len(d), bool)
        for i in range(64, len(d) - 1):
            if np.isnan(atr[i]) or np.isnan(rs[i]) or c[i] < S.F["min_price"] or not (c[i] > e20[i] > e50[i]):
                continue
            atrp = atr[i] / c[i] * 100
            if atrp < 2 or atrp > 7:
                continue
            t = target_pct(atrp)
            O = o[i + 1]
            upm, dnm, cl = (h[i + 1] / O - 1) * 100, (1 - l[i + 1] / O) * 100, (c[i + 1] / O - 1) * 100
            stop = dnm >= STOP_PCT
            hit = (upm >= t) and not stop
            ret = -STOP_PCT if stop else (t if hit else max(cl, -STOP_PCT))
            rec.append((bucket(rs[i], atrp, 0 if np.isnan(rv[i]) else rv[i], bool(up[i])), hit, stop, ret, cl > 0))
    df = pd.DataFrame(rec, columns=["b", "hit", "stop", "ret", "upclose"])
    out = {}
    for k, g in list(df.groupby("b")) + [("all", df)]:
        out[k] = dict(n=int(len(g)), p_target=round(100 * g.hit.mean(), 1), p_stop=round(100 * g.stop.mean(), 1),
                      p_upclose=round(100 * g.upclose.mean(), 1), avg_ret=round(float(g.ret.mean()), 3))
    return out


def _why(sym, rs, atrp, rv, cp, f, srank, sector, night_item, news):
    w = []
    w.append("Yükseliş trendinde: fiyat 20 ve 50 günlük ortalamanın üstünde" + (", EMA10 da üstte" if f["stack"] else ""))
    if rs >= 70:
        w.append(f"Göreli güç {rs}: son 3 ayda hisselerin %{rs}'inden daha iyi")
    if rv >= 1.5:
        w.append(f"Dün hacim normalin {rv:.1f} katıydı: kurumsal ilgi (geçmişte en iyi sonuç veren özellik)")
    if cp >= 0.8:
        w.append("Dün günün tepesine yakın kapattı: alıcılar güçlü")
    if srank and srank <= 4:
        w.append(f"Sektörü ({sector}) son 1 ayın en güçlü {srank}. sektörü")
    w.append(f"Günlük oynaklık %{atrp:.1f}: hedef bir günde ulaşılabilir mesafede")
    if night_item and night_item.get("verdict") == "olumlu":
        w.append("İyi haber (Claude): " + (night_item.get("catalyst") or night_item.get("note") or ""))
    for n in news or []:
        if n.get("fresh") and n.get("tone") == "olumlu":
            w.append("Taze olumlu haber: " + n["title"])
            break
    return w


def _risks(earn, today, mkt, gap, night_item, news, cal):
    r = []
    if earn:
        dd = (pd.Timestamp(earn).date() - today).days
        if 0 <= dd <= 7:
            r.append(f"Bilanço {dd} gün sonra ({earn})")
    if mkt.get("shield"):
        r.append("Piyasa zayıf: " + "; ".join(mkt["shield"]))
    if gap is not None and gap > 3:
        r.append(f"Açılışta %{gap:.1f} yukarı boşluk: gün içinde geri verme eğilimi var")
    if night_item and night_item.get("risks"):
        r.append(night_item["risks"])
    for n in news or []:
        if n.get("fresh") and n.get("tone") == "olumsuz":
            r.append("Olumsuz haber: " + n["title"])
    r.append(f"Geçmişte bu gruptaki hisseler %{cal.get('p_stop', '—')} ihtimalle %2 stopa değdi. Stopu mutlaka koy, kaldıraç kullanma.")
    return r


def _make_item(s, d, f, rs, cal, uni, srank, nmap, news, earn, today, mkt, ref_price, source):
    atrp = float(f["atr"] / f["c"] * 100)
    rv = 0.0 if np.isnan(f["rv"]) else float(f["rv"])
    rng = f["h"] - f["l"]
    cp = float((f["c"] - f["l"]) / rng) if rng > 0 else 0.5
    t = target_pct(atrp)
    sec = (uni.get(s) or {}).get("sector")
    c = cal.get(bucket(rs, atrp, rv, mkt.get("_up", True))) or cal["all"]
    if c.get("n", 0) < 150:
        c = cal["all"]
    prev = float(d["Close"].iloc[-1])
    gap = (ref_price / prev - 1) * 100 if ref_price else None
    return dict(symbol=s, name=(uni.get(s) or {}).get("name"), sector=sec, source=source, rs=rs, atr_pct=S.r2(atrp), rv=S.r2(rv),
                prev_close=S.r2(prev), ref=S.r2(ref_price or prev), entry=None, target_pct=t, stop_pct=STOP_PCT,
                prob_target=c["p_target"], prob_stop=c["p_stop"], prob_upclose=c["p_upclose"], avg_ret=c["avg_ret"], sample=c["n"],
                why=_why(s, rs, atrp, rv, cp, f, srank.get(S.SECTOR_ETF.get(sec, "")), sec, nmap.get(s), news),
                risks=_risks(earn, today, mkt, gap, nmap.get(s), news, c), earnings=earn,
                analysis=(nmap.get(s) or {}).get("analysis") or (nmap.get(s) or {}).get("note"),
                news=[dict(title=n["title"], link=n["link"], tone=n["tone"], fresh=n["fresh"]) for n in (news or [])[:4]],
                tv=f"https://www.tradingview.com/symbols/{s}/", status="açılış bekleniyor")


def _features(d):
    c = d["Close"]
    e10, e20, e50 = S.ema(c, 10), S.ema(c, 20), S.ema(c, 50)
    return pd.DataFrame(dict(c=c, h=d["High"], l=d["Low"], atr=S.atr_series(d), rv=d["Volume"] / d["Volume"].rolling(20).mean().shift(1),
                             trend=(c > e20) & (e20 > e50), stack=(c > e10) & (e10 > e20)))


def build(today, now, d1map, m15map, live, rsmap, srank, uni, cands, mkt, night, tradeable):
    cur = json.loads(WL.read_text()) if WL.exists() else None
    if cur and (cur.get("date") != str(today) or cur.get("version") != 3):
        if cur.get("date") != str(today):
            finalize(cur)
        cur = None
    nmap = {x["symbol"]: x for x in (night or {}).get("stocks", [])}
    bad = {k for k, x in nmap.items() if x.get("verdict") in ("olumsuz", "kaçın")}
    stocks = [s for s in tradeable if (uni.get(s) or {}).get("sector") != "ETF" and s in d1map and s not in ("SPY", "QQQ", "IWM")]
    sd = d1map.get("SPY")
    sd = sd[sd.index.date < today]["Close"] if sd is not None else None
    mkt = dict(mkt, _up=bool(sd is None or sd.iloc[-1] > S.ema(sd, 50).iloc[-1]))

    cal_now = (cur or {}).get("calibration")

    def scored(pool_syms, cal=None):
        cal = cal or cal_now or {}
        out = []
        for s in pool_syms:
            d = d1map[s][d1map[s].index.date < today]
            if len(d) < 70 or s in bad:
                continue
            f = _features(d).iloc[-1]
            if not f["trend"] or np.isnan(f["atr"]):
                continue
            atrp = f["atr"] / f["c"] * 100
            if atrp < 2 or atrp > 7:
                continue
            rs = rsmap.get(s, 50)
            if rs < 70:
                continue
            rv = 0 if np.isnan(f["rv"]) else f["rv"]
            rng = f["h"] - f["l"]
            cp = (f["c"] - f["l"]) / rng if rng > 0 else 0.5
            good = (nmap.get(s) or {}).get("verdict") == "olumlu"
            b = cal.get(bucket(rs, atrp, rv, mkt["_up"])) or {}
            if b.get("n", 0) >= 300 and b.get("avg_ret", 0) < -0.05:
                continue  # this kind of stock lost money with this rule over the past year
            score = rs + 25 * min(rv, 3) + 15 * cp + (40 if good else 0) + (10 if f["stack"] else 0) + 300 * (b.get("avg_ret") or 0)
            out.append((score, s, d, f, rs))
        return sorted(out, key=lambda x: -x[0])

    if cur is None:
        liquid = [x for x, d in d1map.items() if x != "^VIX" and (uni.get(x) or {}).get("sector") != "ETF" and len(d) > 80
                  and float(d["Close"].iloc[-1]) >= S.F["min_price"] and float(d["Volume"].iloc[-20:].mean()) >= S.F["min_avg_volume"]]
        try:
            raw = S.download(liquid + ["SPY"], period="1y", interval="1d")
            dl = {x: S.split(raw, x) for x in liquid + ["SPY"]}
            dl = {x: v[v.index.date < today] for x, v in dl.items() if len(v) > 80}
            spy = dl.pop("SPY")["Close"] if "SPY" in dl else None
        except Exception:
            dl, spy = {x: d1map[x][d1map[x].index.date < today] for x in liquid}, sd
        cal = calibrate(dl, spy)
        items = []
        for score, s, d, f, rs in scored(stocks, cal):
            if len(items) >= TOP_N:
                break
            earn = S.earnings_date(s)
            if earn and 0 <= (pd.Timestamp(earn).date() - today).days <= 1:
                continue
            news = S.headlines(s, 5)
            if any(n["fresh"] and n["tone"] == "olumsuz" for n in news):
                continue
            items.append(_make_item(s, d, f, rs, cal, uni, srank, nmap, news, earn, today, mkt, live.get(s), "sabah listesi"))
        cur = dict(version=3, date=str(today), created=datetime.now(timezone.utc).isoformat(timespec="seconds"), calibration=cal,
                   rule=dict(entry="açılış fiyatı (gün içinde eklenenlerde eklendiği andaki fiyat)", stop=f"%{STOP_PCT:g} aşağı",
                             target="+%2 ile +%5 arası (günlük oynaklığın ~%80'i)",
                             note="Olasılıklar son 1 yılda aynı gruptaki likit hisselerden. Aynı gün hem stop hem hedef görüldüyse stop sayılır."),
                   items=items)
        if items:
            S.notify("Günün hisseleri", "\n".join(f"{i['symbol']} · hedef +%{i['target_pct']:g} · stop −%2 · hedef ihtimali %{i['prob_target']:.0f}" for i in items[:6]),
                     ["clipboard"], 3)
    # intraday additions: fresh good news + uptrend + strong session, until MAX_N
    if S.hm(now) >= "09:45" and S.hm(now) < "14:30" and len(cur["items"]) < MAX_N:
        have = {i["symbol"] for i in cur["items"]}
        for score, s, d, f, rs in scored([x for x in stocks if x not in have])[:25]:
            if len(cur["items"]) >= MAX_N:
                break
            m = m15map.get(s)
            td = m[m.index.date == today] if m is not None else pd.DataFrame()
            if not len(td):
                continue
            px = live.get(s, float(td["Close"].iloc[-1]))
            vw = S.session_vwap(td)
            chg = (px / float(d["Close"].iloc[-1]) - 1) * 100
            rv_now = S.relvol_now(m, today) or 0
            news = S.headlines(s, 5)
            good = (nmap.get(s) or {}).get("verdict") == "olumlu" or any(n["fresh"] and n["tone"] == "olumlu" for n in news)
            if not (good and vw and px > vw and 0 < chg < 3 and rv_now >= 1.5):
                continue
            it = _make_item(s, d, f, rs, cur["calibration"], uni, srank, nmap, news, S.earnings_date(s), today, mkt, px, f"gün içi eklendi {now.tz_convert('Europe/Istanbul').strftime('%H:%M')}")
            it.update(entry=S.r2(px), status="açık", opened_at=now.tz_convert("Europe/Istanbul").strftime("%H:%M"), since=str(now))
            it["why"].insert(0, f"Gün içinde iyi haberle VWAP üstünde, hacim normalin {rv_now:.1f} katı")
            cur["items"].append(it)
            S.notify(f"Listeye eklendi: {s}", f"Giriş {it['entry']} · stop {S.r2(it['entry'] * 0.98)} · hedef +%{it['target_pct']:g}\n{it['why'][0]}", ["new"], 3)
    update_status(cur, today, now, m15map, live)
    for it in cur["items"]:  # midday news check from Claude's refreshed analysis
        nv = nmap.get(it["symbol"]) or {}
        if it["status"] == "açık" and nv.get("verdict") in ("olumsuz", "kaçın") and not it.get("warned"):
            it["warned"] = nv.get("note") or nv.get("risks") or "olumsuz haber"
            S.notify(f"{it['symbol']}: haber değişti", f"Claude: {nv.get('verdict')} · {it['warned']}\nStop {it.get('stop')} — pozisyondaysan gözden geçir.", ["warning"], 4)
        if nv.get("analysis") and not it.get("analysis"):
            it["analysis"] = nv["analysis"]
    cur["market"] = dict(regime=mkt.get("regime"), note=mkt.get("note"), shield=mkt.get("shield"), caution=mkt.get("caution"),
                         spy=(mkt.get("SPY") or {}).get("intraday"), morning=(night or {}).get("market_view"), flag=(night or {}).get("risk_flag"))
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
        if not len(td):
            continue
        if it["entry"] is None:
            it["entry"] = S.r2(float(td["Open"].iloc[0]))
            it["status"], it["opened_at"], it["since"] = "açık", "açılış", str(td.index[0])
        e = it["entry"]
        it["stop"], it["target"] = S.r2(e * (1 - it["stop_pct"] / 100)), S.r2(e * (1 + it["target_pct"] / 100))
        it["last"] = S.r2(px or float(td["Close"].iloc[-1]))
        it["move_pct"] = S.r2((it["last"] / e - 1) * 100)
        if it["status"] in ("hedef", "stop", "gün sonu"):
            continue
        bars = td[td.index >= pd.Timestamp(it["since"])] if it.get("since") else td
        for ts, b in bars.iterrows():
            if b["Low"] <= it["stop"]:
                it["status"], it["done_at"] = "stop", ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
                break
            if b["High"] >= it["target"]:
                it["status"], it["done_at"] = "hedef", ts.tz_convert("Europe/Istanbul").strftime("%H:%M")
                break
        if S.hm(now) >= "16:00" and it["status"] == "açık":
            it["status"], it["close_pct"] = "gün sonu", S.r2((float(td["Close"].iloc[-1]) / e - 1) * 100)


def finalize(cur):
    h = json.loads(HIST.read_text()) if HIST.exists() else {"days": []}
    if any(x["date"] == cur["date"] for x in h["days"]):
        return
    res = []
    for i in cur.get("items", []):
        r = i.get("target_pct") if i.get("status") == "hedef" else (-i.get("stop_pct", 2) if i.get("status") == "stop" else i.get("close_pct", i.get("move_pct")))
        res.append(dict(symbol=i["symbol"], status=i.get("status"), ret=r, prob=i.get("prob_target")))
    h["days"].append(dict(date=cur["date"], items=res))
    h["days"] = h["days"][-90:]
    HIST.write_text(json.dumps(h, ensure_ascii=False, indent=0))


def summary():
    if not HIST.exists():
        return None
    days = json.loads(HIST.read_text())["days"][-20:]
    its = [i for d in days for i in d["items"] if i.get("status") in ("hedef", "stop", "gün sonu")]
    if not its:
        return dict(days=len(days), n=0)
    rets = [i["ret"] or 0 for i in its]
    return dict(days=len(days), n=len(its), target=sum(1 for i in its if i["status"] == "hedef"), stop=sum(1 for i in its if i["status"] == "stop"),
                avg_ret=round(sum(rets) / len(rets), 2), win=round(100 * sum(1 for r in rets if r > 0) / len(rets), 1))
