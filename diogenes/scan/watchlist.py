"""Günün planı: tek pozisyon, sırayla.

Kullanıcının kuralları:
1. Bir işlem bitmeden yenisi açılmaz. Gün, araştırılmış ilk hisseyle açılışta başlar; o kapanınca (hedef, stop ya da
   gün sonu) sıradaki hisse, koşullar uygunsa (fiyat VWAP ve açılışın üstünde, saat 14:30 NY'den önce) o anki fiyattan alınır.
2. Günde 2 stop olunca o gün biter. Kazandıkça sıradaki hisseyle devam edilir.
3. Stop %2-3: normalde günlük oynaklığın ~%70'i, %2 ile %2,5 arası; çok iyi haberi olan hissede (anlık düşüşten dönme
   ihtimali yüksek) %3'e kadar. Hedef stopun 2 katı (60 günlük testte en iyi sonuç).
4. Güçlü ve iyi haberli sektörler öne alınır, Claude'un olumsuz dediği sektörlere girilmez.
5. Açılıştan önce piyasaya bakılır: kalkan açıksa ya da Claude "dur" diyorsa o gün işlem yok; "dikkat" günlerinde yalnız
   iyi haberli ya da dün hacmi normalin 1,5 katı olan hisseler alınır. 2 stop kuralı her durumda geçerli.
Olasılıklar son 1 yılda aynı gruptaki likit hisselerden (aynı gün hem stop hem hedef görüldüyse stop sayılır).
"""
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import scan as S

WL = S.DATA / "watchlist.json"
HIST = S.DATA / "watch_history.json"
QUEUE_N, MAX_N = 6, 10
STOP_PCT = 2.0          # calibration reference
VERSION = 4
PLAN = dict(stop_min=2.0, stop_max=2.5, stop_max_news=3.0, target_mult=2.0, max_stops=2, first_gap_max=1.0,
            last_entry="14:30", flat_at="15:55", max_run5=8.0, min_rv=1.2, fee_mult=5)


def stop_for(atrp, good_news):
    hi = PLAN["stop_max_news"] if good_news else PLAN["stop_max"]
    return round(float(min(hi, max(PLAN["stop_min"], 0.7 * atrp))), 1)


def target_pct(stop):
    return round(PLAN["target_mult"] * stop, 1)


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
            sp = stop_for(atrp, False)
            t = target_pct(sp)
            O = o[i + 1]
            upm, dnm, cl = (h[i + 1] / O - 1) * 100, (1 - l[i + 1] / O) * 100, (c[i + 1] / O - 1) * 100
            stop = dnm >= sp
            hit = (upm >= t) and not stop
            ret = -sp if stop else (t if hit else max(cl, -sp))
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
    r.append(f"Geçmişte bu gruptaki hisseler %{cal.get('p_stop', '—')} ihtimalle stopa değdi. Stopu mutlaka koy, kaldıraç kullanma.")
    return r


def _good(nmap, s, news):
    return (nmap.get(s) or {}).get("verdict") == "olumlu" or any(n.get("fresh") and n.get("tone") == "olumlu" for n in news or [])


def _make_item(s, d, f, rs, cal, uni, srank, nmap, news, earn, today, mkt, ref_price, source, sec_view):
    atrp = float(f["atr"] / f["c"] * 100)
    rv = 0.0 if np.isnan(f["rv"]) else float(f["rv"])
    rng = f["h"] - f["l"]
    cp = float((f["c"] - f["l"]) / rng) if rng > 0 else 0.5
    good = _good(nmap, s, news)
    sp = stop_for(atrp, good)
    t = target_pct(sp)
    sec = (uni.get(s) or {}).get("sector")
    c = cal.get(bucket(rs, atrp, rv, mkt.get("_up", True))) or cal["all"]
    if c.get("n", 0) < 150:
        c = cal["all"]
    prev = float(d["Close"].iloc[-1])
    gap = (ref_price / prev - 1) * 100 if ref_price else None
    why = _why(s, rs, atrp, rv, cp, f, srank.get(S.SECTOR_ETF.get(sec, "")), sec, nmap.get(s), news)
    if sec in sec_view.get("olumlu", []):
        why.insert(1, f"Sektörü ({sec}) bugün Claude'un olumlu gördüğü sektörlerden")
    stop_why = (f"Stop %{sp:g}: günlük oynaklık %{atrp:.1f}" + (", iyi haber var; anlık düşüşten dönme payı bırakıldı" if good and sp > PLAN["stop_max"] else "")
                + f". Hedef stopun 2 katı: +%{t:g}.")
    return dict(symbol=s, name=(uni.get(s) or {}).get("name"), sector=sec, source=source, rs=rs, atr_pct=S.r2(atrp), rv=S.r2(rv),
                prev_close=S.r2(prev), ref=S.r2(ref_price or prev), pre_gap=S.r2(gap) if gap is not None else None, entry=None,
                target_pct=t, stop_pct=sp, stop_why=stop_why, good_news=good,
                prob_target=c["p_target"], prob_stop=c["p_stop"], prob_upclose=c["p_upclose"], avg_ret=c["avg_ret"], sample=c["n"],
                why=why, risks=_risks(earn, today, mkt, gap, nmap.get(s), news, c), earnings=earn,
                analysis=(nmap.get(s) or {}).get("analysis") or (nmap.get(s) or {}).get("note"),
                news=[dict(title=n["title"], link=n["link"], tone=n["tone"], fresh=n["fresh"]) for n in (news or [])[:4]],
                tv=f"https://www.tradingview.com/symbols/{s}/", status="sırada")


def _features(d):
    c = d["Close"]
    e10, e20, e50 = S.ema(c, 10), S.ema(c, 20), S.ema(c, 50)
    return pd.DataFrame(dict(c=c, h=d["High"], l=d["Low"], atr=S.atr_series(d), rv=d["Volume"] / d["Volume"].rolling(20).mean().shift(1),
                             trend=(c > e20) & (e20 > e50), stack=(c > e10) & (e10 > e20), run5=(c / c.shift(5) - 1) * 100))


def _tr(ts):
    return pd.Timestamp(ts).tz_convert("Europe/Istanbul").strftime("%H:%M")


def market_gate(mkt, night):
    """'kapalı' (no trading today), 'dikkat' (only the best setups) or 'açık'."""
    flag = (night or {}).get("risk_flag")
    if mkt.get("shield") or flag == "dur":
        why = "; ".join(mkt.get("shield") or []) or "Claude sabah analizinde 'dur' dedi"
        return "kapalı", why
    if flag == "dikkat" or mkt.get("caution"):
        return "dikkat", "; ".join(mkt.get("caution") or []) or "Claude sabah analizinde 'dikkat' dedi"
    return "açık", ""


def build(today, now, d1map, m15map, live, rsmap, srank, uni, cands, mkt, night, tradeable):
    cur = json.loads(WL.read_text()) if WL.exists() else None
    if cur and (cur.get("date") != str(today) or cur.get("version") != VERSION):
        finalize(cur)  # keep the old list's results in the history (also on a rule change)
        cur = None
    nmap = {x["symbol"]: x for x in (night or {}).get("stocks", [])}
    bad = {k for k, x in nmap.items() if x.get("verdict") in ("olumsuz", "kaçın")}
    sec_view = (night or {}).get("sectors") or {}
    bad_sec = set(sec_view.get("olumsuz") or [])
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
            sec = (uni.get(s) or {}).get("sector")
            if len(d) < 70 or s in bad or sec in bad_sec:
                continue
            f = _features(d).iloc[-1]
            if not f["trend"] or np.isnan(f["atr"]):
                continue
            atrp = f["atr"] / f["c"] * 100
            if atrp < 2 or atrp > 7 or f["run5"] > PLAN["max_run5"]:
                continue  # too extended after a 5-day run (FORM, 1 Oct)
            rs = rsmap.get(s, 50)
            rv = 0 if np.isnan(f["rv"]) else f["rv"]
            if rs < 70 or rv < PLAN["min_rv"]:
                continue
            rng = f["h"] - f["l"]
            cp = (f["c"] - f["l"]) / rng if rng > 0 else 0.5
            good = (nmap.get(s) or {}).get("verdict") == "olumlu"
            b = cal.get(bucket(rs, atrp, rv, mkt["_up"])) or {}
            if b.get("n", 0) >= 300 and b.get("avg_ret", 0) < -0.05:
                continue  # this kind of stock lost money with this rule over the past year
            sr = srank.get(S.SECTOR_ETF.get(sec, ""), 6)
            score = (rs + 30 * min(rv, 3) + 15 * cp + (40 if good else 0) + (10 if f["stack"] else 0) + 300 * (b.get("avg_ret") or 0)
                     + (25 if sec in (sec_view.get("olumlu") or []) else 0) + (12 if sr <= 3 else 0))
            out.append((score, s, d, f, rs))
        return sorted(out, key=lambda x: -x[0])

    gate, gate_why = market_gate(mkt, night)
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
        items, secs = [], {}
        for score, s, d, f, rs in scored(stocks, cal):
            if len(items) >= QUEUE_N:
                break
            sec = (uni.get(s) or {}).get("sector")
            if secs.get(sec, 0) >= 2:
                continue  # at most two from one sector in the queue
            earn = S.earnings_date(s)
            if earn and 0 <= (pd.Timestamp(earn).date() - today).days <= 1:
                continue
            news = S.headlines(s, 5)
            if any(n["fresh"] and n["tone"] == "olumsuz" for n in news):
                continue
            items.append(_make_item(s, d, f, rs, cal, uni, srank, nmap, news, earn, today, mkt, live.get(s), "sabah araştırması", sec_view))
            secs[sec] = secs.get(sec, 0) + 1
        # pre-market gap above the limit: move to the back (it may be skipped at the open)
        items.sort(key=lambda i: (i["pre_gap"] or 0) > PLAN["first_gap_max"])
        bal = float(S.P["start_equity"])
        cur = dict(version=VERSION, date=str(today), created=datetime.now(timezone.utc).isoformat(timespec="seconds"), calibration=cal,
                   plan=dict(PLAN, balance=bal, risk_pct=S.P["risk_pct"], fee=S.P["fee_per_order"]),
                   day=dict(state="bekliyor" if gate != "kapalı" else "kapalı", gate=gate, gate_why=gate_why, active=None, stops=0, wins=0,
                            trades=[], net=0.0, fees=0.0),
                   items=items)
        if items:
            first = items[0]
            head = f"Claude: {night['risk_flag']} · {night.get('market_view', '')[:140]}\n" if night else ""
            if gate == "kapalı":
                S.notify("Bugün işlem yok", f"{head}Piyasa kalkanı: {gate_why}.\nListe izleme için hazır; 2 stop kuralı ve tek pozisyon kuralı geçerli.", ["no_entry"], 4)
            else:
                S.notify("Günün planı", head + f"1. {first['symbol']} açılışta · stop −%{first['stop_pct']:g} · hedef +%{first['target_pct']:g}\n"
                         + f"Sırada: {', '.join(i['symbol'] for i in items[1:])}\n" + ("Dikkat günü: yalnız en güçlüler. " if gate == "dikkat" else "")
                         + "Tek pozisyon; 2 stopta gün biter.", ["clipboard"], 4)
    day = cur["day"]
    if day["state"] not in ("bitti",) and gate == "kapalı" and day["state"] != "kapalı" and not day.get("active"):
        day.update(state="kapalı", gate="kapalı", gate_why=gate_why)
        S.notify("Yeni işlem durdu", f"Piyasa kalkanı açıldı: {gate_why}. Açık pozisyon yok; bugün yeni işlem açılmaz.", ["no_entry"], 4)
    elif day["state"] == "kapalı" and gate != "kapalı" and S.hm(now) < PLAN["last_entry"]:
        day.update(state="bekliyor", gate=gate, gate_why=gate_why)
    else:
        day.update(gate=gate if day["state"] != "kapalı" else "kapalı", gate_why=gate_why or day.get("gate_why", ""))
    # intraday additions join the back of the queue (never opened directly)
    if S.hm(now) >= "09:45" and S.hm(now) < PLAN["last_entry"] and len(cur["items"]) < MAX_N:
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
            if not (_good(nmap, s, news) and vw and px > vw and 0 < chg < 3 and rv_now >= 1.5):
                continue
            it = _make_item(s, d, f, rs, cur["calibration"], uni, srank, nmap, news, S.earnings_date(s), today, mkt, px, f"gün içi eklendi {_tr(now)}", sec_view)
            it["why"].insert(0, f"Gün içinde iyi haberle VWAP üstünde, hacim normalin {rv_now:.1f} katı")
            cur["items"].append(it)
    sent = cur.setdefault("sent", [])
    if night and night.get("generated") and f"night-{night['generated']}" not in sent:
        first_n = not any(x.startswith("night-") for x in sent)
        if not first_n and night.get("risk_flag") != cur.get("market", {}).get("flag"):
            S.notify(f"Gün ortası: Claude {night.get('risk_flag')} diyor", night.get("market_view", ""), ["mag"], 5 if night.get("risk_flag") == "dur" else 4)
        sent.append(f"night-{night['generated']}")
    for it in cur["items"]:  # Claude's refreshed analysis
        nv = nmap.get(it["symbol"]) or {}
        if nv.get("verdict") in ("olumsuz", "kaçın") and not it.get("warned"):
            it["warned"] = nv.get("note") or nv.get("risks") or "olumsuz haber"
            if it["status"] == "açık":
                S.notify(f"{it['symbol']}: haber değişti", f"Claude: {nv.get('verdict')} · {it['warned']}\nStop {it.get('stop')} — pozisyonu gözden geçir.", ["warning"], 4)
            elif it["status"] == "sırada":
                it["status"], it["skip_why"] = "iptal", "Haber olumsuza döndü: " + it["warned"]
        if nv.get("analysis") and not it.get("analysis"):
            it["analysis"] = nv["analysis"]
    step(cur, today, now, m15map, live)
    cur["market"] = dict(regime=mkt.get("regime"), note=mkt.get("note"), shield=mkt.get("shield"), caution=mkt.get("caution"),
                         spy=(mkt.get("SPY") or {}).get("intraday"), morning=(night or {}).get("market_view"), flag=(night or {}).get("risk_flag"),
                         sectors=sec_view)
    cur["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    cur["history"] = summary()
    WL.write_text(json.dumps(cur, ensure_ascii=False, indent=0, default=str))
    return cur


def _ts(x):
    try:
        t = pd.Timestamp(x)
        return t.tz_localize("UTC") if t.tzinfo is None else t
    except Exception:
        return pd.Timestamp(0, tz="UTC")


def _qty(cur, entry, stop_pct):
    """Whole budget, no leverage, and never more than risk_pct of the balance at the stop."""
    p = cur["plan"]
    bal = p["balance"] + cur["day"]["net"]
    size = min(bal, bal * p["risk_pct"] / 100 / (stop_pct / 100))
    return max(1, int(size // entry))


def _worth(cur, it, entry):
    """Commission threshold: the target must pay at least 5x the round-trip commission."""
    fee2 = 2 * cur["plan"]["fee"]
    gain = _qty(cur, entry, it["stop_pct"]) * entry * it["target_pct"] / 100
    if gain < PLAN.get("fee_mult", 5) * fee2:
        it["status"], it["skip_why"] = "atlandı", f"Hedefteki kazanç ({gain:.0f} $) komisyonun 5 katından ({5 * fee2:.0f} $) az"
        return False
    return True


def _open(cur, it, entry, ts, how):
    it.update(entry=S.r2(entry), status="açık", opened_at=_tr(ts), since=str(ts), how=how)
    it["stop"], it["target"] = S.r2(entry * (1 - it["stop_pct"] / 100)), S.r2(entry * (1 + it["target_pct"] / 100))
    it["qty"] = _qty(cur, entry, it["stop_pct"])
    cur["day"].update(active=it["symbol"], state="işlemde")
    S.notify(f"{it['symbol']} al ({how})", f"Giriş {it['entry']} · stop {it['stop']} (−%{it['stop_pct']:g}) · hedef {it['target']} (+%{it['target_pct']:g})\n"
             f"{it['qty']} adet ≈ {it['qty'] * it['entry']:.0f} $ · Midas'ta stop emrini hemen gir.\n{it['why'][0]}", ["chart_with_upwards_trend"], 5)


def _close(cur, it, status, price, ts):
    day, p = cur["day"], cur["plan"]
    pct = (price / it["entry"] - 1) * 100
    fee = 2 * p["fee"]
    pnl = it["qty"] * (price - it["entry"]) - fee
    it.update(status=status, exit=S.r2(price), done_at=_tr(ts), close_pct=S.r2(pct), pnl=S.r2(pnl))
    day["trades"].append(dict(symbol=it["symbol"], status=status, entry=it["entry"], exit=S.r2(price), pct=S.r2(pct), pnl=S.r2(pnl), qty=it["qty"],
                              opened=it["opened_at"], closed=it["done_at"]))
    day["net"] = S.r2(day["net"] + pnl)
    day["fees"] = S.r2(day["fees"] + fee)
    day["active"] = None
    if status == "stop":
        day["stops"] += 1
    elif pct > 0:
        day["wins"] += 1
    left = p["max_stops"] - day["stops"]
    nxt = next((i["symbol"] for i in cur["items"] if i["status"] == "sırada"), None)
    if day["stops"] >= p["max_stops"]:
        day["state"], day["end_why"] = "bitti", f"{p['max_stops']} stop oldu"
        tail = f"\n{p['max_stops']} stop: bugün işlem bitti. Günün net sonucu {day['net']:+.2f} $."
    elif status == "gün sonu":
        tail = ""
    else:
        day["state"] = "bekliyor"
        tail = (f"\nSıradaki aday: {nxt}. Fiyat VWAP'ın ve açılışın üstündeyken alım bildirimi gelir." if nxt else "\nSırada aday kalmadı.") + f" Kalan stop hakkı: {left}."
    title = {"hedef": f"{it['symbol']} hedefe ulaştı ✓", "stop": f"{it['symbol']} stop oldu", "gün sonu": f"{it['symbol']} gün sonu kapandı"}[status]
    S.notify(title, f"{pct:+.2f}% · {price:.2f} $ · {it['done_at']} (TR) · net {pnl:+.2f} $ (komisyon dahil){tail}",
             ["white_check_mark" if status == "hedef" else "x" if status == "stop" else "bell"], 5 if status != "gün sonu" else 3)


def step(cur, today, now, m15map, live):
    """Advance the one-position plan: manage the open trade, then (if allowed) open the next one in the queue."""
    day, p = cur["day"], cur["plan"]
    for it in cur["items"]:
        if live.get(it["symbol"]):
            it["last"] = S.r2(live[it["symbol"]])
    if S.hm(now) < "09:30":
        return
    for _ in range(4):  # a closed trade may let the next one open in the same scan (e.g. stop on the first bar)
        act = next((i for i in cur["items"] if i["status"] == "açık"), None)
        if act:
            m = m15map.get(act["symbol"])
            td = m[m.index.date == today] if m is not None else pd.DataFrame()
            done = False
            bars = td[td.index >= pd.Timestamp(act["since"])] if len(td) else td
            for ts, b in bars.iterrows():
                if b["Low"] <= act["stop"]:
                    _close(cur, act, "stop", min(act["stop"], float(b["Open"])) if ts > pd.Timestamp(act["since"]) else act["stop"], ts)
                    done = True
                    break
                if b["High"] >= act["target"]:
                    _close(cur, act, "hedef", act["target"], ts)
                    done = True
                    break
            if not done:
                px = live.get(act["symbol"]) or (float(td["Close"].iloc[-1]) if len(td) else None)
                if px and px <= act["stop"]:
                    _close(cur, act, "stop", act["stop"], now)
                elif px and px >= act["target"]:
                    _close(cur, act, "hedef", act["target"], now)
                elif px and S.hm(now) >= p["flat_at"]:
                    _close(cur, act, "gün sonu", px, now)
                else:
                    if px:
                        act["last"], act["move_pct"] = S.r2(px), S.r2((px / act["entry"] - 1) * 100)
                    return
            continue
        if day["state"] in ("bitti", "kapalı") or S.hm(now) >= p["last_entry"]:
            break
        queue = [i for i in cur["items"] if i["status"] == "sırada"]
        if not queue:
            break
        first_trade = not day["trades"]
        opened, seen = False, False
        for it in queue:
            m = m15map.get(it["symbol"])
            td = m[m.index.date == today] if m is not None else pd.DataFrame()
            if not len(td):
                continue
            o = float(td["Open"].iloc[0])
            if day["gate"] == "dikkat" and not (it.get("good_news") or (it.get("rv") or 0) >= 1.5):
                it["status"], it["skip_why"] = "atlandı", "Dikkat günü: iyi haber ya da yüksek hacim yok"
                continue
            seen = True
            if first_trade and not day.get("opened_at_open") and S.hm(now) < "10:00":
                gap = (o / it["prev_close"] - 1) * 100
                if gap > p["first_gap_max"]:
                    it["status"], it["skip_why"] = "atlandı", f"Açılışta +%{gap:.1f} boşluk: hemen satış gelme ihtimali yüksek"
                    continue
                if not _worth(cur, it, o):
                    continue
                day["opened_at_open"] = True
                _open(cur, it, o, td.index[0], "açılışta")
                opened = True
                break
            px = live.get(it["symbol"]) or float(td["Close"].iloc[-1])
            vw = S.session_vwap(td)
            chg = (px / it["prev_close"] - 1) * 100
            if vw and px > vw and px > o and chg < 4:
                if not _worth(cur, it, px):
                    continue
                _open(cur, it, px, now, "sıradaki")
                opened = True
                break
        if seen:
            day["opened_at_open"] = True  # after the first look at the open, later entries need the VWAP condition
        if not opened:
            break
    if S.hm(now) >= "16:00" and day["state"] != "bitti":
        day["state"], day["end_why"] = "bitti", day.get("end_why") or "seans kapandı"
    if day["state"] == "bitti" and "eod" not in cur.setdefault("sent", []) and S.hm(now) >= "16:00":
        for i in cur["items"]:
            if i["status"] == "sırada":
                i["status"] = "kullanılmadı"
        t = day["trades"]
        S.notify("Gün kapandı", (f"{len(t)} işlem · {day['wins']} kazanç · {day['stops']} stop\n"
                                 + "\n".join(f"{x['symbol']} {x['pct']:+.2f}% ({x['pnl']:+.2f} $)" for x in t)
                                 + f"\nNet {day['net']:+.2f} $ · komisyon {day['fees']:.2f} $") if t else "Bugün işlem açılmadı. " + (day.get("gate_why") or ""),
                 ["memo"], 3)
        cur["sent"].append("eod")


def finalize(cur):
    h = json.loads(HIST.read_text()) if HIST.exists() else {"days": []}
    if any(x["date"] == cur["date"] for x in h["days"]):
        return
    day = cur.get("day") or {}
    if day:
        h["days"].append(dict(date=cur["date"], version=cur.get("version"), trades=day.get("trades", []), net=day.get("net"), stops=day.get("stops"),
                              gate=day.get("gate"), items=[dict(symbol=i["symbol"], status=i.get("status")) for i in cur.get("items", [])]))
    else:
        res = []
        for i in cur.get("items", []):
            r = i.get("target_pct") if i.get("status") == "hedef" else (-i.get("stop_pct", 2) if i.get("status") == "stop" else i.get("close_pct", i.get("move_pct")))
            res.append(dict(symbol=i["symbol"], status=i.get("status"), ret=r, prob=i.get("prob_target")))
        h["days"].append(dict(date=cur["date"], items=res))
    h["days"] = h["days"][-120:]
    HIST.write_text(json.dumps(h, ensure_ascii=False, indent=0))


def summary():
    if not HIST.exists():
        return None
    days = [d for d in json.loads(HIST.read_text())["days"] if "trades" in d][-20:]
    t = [x for d in days for x in d["trades"]]
    if not t:
        return dict(days=len(days), n=0)
    return dict(days=len(days), n=len(t), wins=sum(1 for x in t if x["pnl"] > 0), stops=sum(1 for x in t if x["status"] == "stop"),
                net=round(sum(d.get("net") or 0 for d in days), 2), win=round(100 * sum(1 for x in t if x["pnl"] > 0) / len(t), 1))
