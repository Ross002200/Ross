"""Diogenes günlük tarayıcı.

ABD hisselerinde Baştan Sona Trade kodeksine göre (likidite → süpürme → gövde kapanışı = order flow)
yükseliş yönlü kurulumları arar, piyasa durumunu, bilanço tarihlerini ve haber başlıklarını toplar,
bulduğu A+ kurulumlarla kâğıt üzerinde (sanal) işlem açıp kapatır.

Çıktılar:  diogenes/data/scan.json   (son tarama, uygulamanın Tarama sekmesi)
           diogenes/data/paper.json  (otomatik kâğıt işlemlerin durumu, kalıcı)

Algoritma grafikteki çizimin kaba bir yaklaşımıdır; her kurulum grafikte gözle doğrulanmalıdır.
Öğrenme amaçlıdır, yatırım tavsiyesi değildir. Gerçek emir vermez.
"""
import json
import math
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CFG = json.loads((Path(__file__).parent / "config.json").read_text())
NY = "America/New_York"


# ---------- helpers ----------
def now_ny():
    return pd.Timestamp.now(tz=NY)


def ema(s, n):
    return s.ewm(span=n, adjust=False).mean()


def atr(df, n=14):
    pc = df["Close"].shift(1)
    tr = pd.concat([df["High"] - df["Low"], (df["High"] - pc).abs(), (df["Low"] - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean()


def r2(x, d=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), d)


def swings(arr, kind, k=2):
    """Fractal swing points: indexes where arr is the lowest (or highest) of k bars on each side."""
    out = []
    for i in range(k, len(arr) - k):
        win = arr[i - k:i + k + 1]
        if kind == "low" and arr[i] == min(win) and list(win).count(arr[i]) == 1:
            out.append(i)
        if kind == "high" and arr[i] == max(win) and list(win).count(arr[i]) == 1:
            out.append(i)
    return out


def split(raw, sym):
    try:
        df = raw[sym] if isinstance(raw.columns, pd.MultiIndex) else raw
        return df.dropna(subset=["Open", "High", "Low", "Close"])
    except KeyError:
        return pd.DataFrame()


# ---------- order flow ----------
def find_order_flow(h1):
    """Most recent still-valid bullish order flow on 1h bars, or None.

    Bullish OF: price leaves higher lows (early buyers' stops = liquidity), drops from a high H and sweeps
    those lows down to L, then a candle BODY closes above H. Zone = [L, H]. Invalid once a close prints below L.
    """
    if len(h1) < 80:
        return None
    o, h, l, c, v = (h1[x].to_numpy() for x in ("Open", "High", "Low", "Close", "Volume"))
    a = atr(h1).to_numpy()
    lows, highs = swings(l, "low"), swings(h, "high")
    n = len(c)
    best = None
    for j in reversed(highs):
        if j < 30 or j > n - 4:
            continue
        prior = [i for i in lows if j - 30 <= i < j]
        if len(prior) < 2:
            continue
        seq = [l[i] for i in prior[-3:]]
        if not all(seq[x] < seq[x + 1] for x in range(len(seq) - 1)):  # higher lows, none swept the other
            continue
        # down-move from H; find break bar b (close > H) within 25 bars, L = lowest low between j and b
        b = None
        for t in range(j + 1, min(n, j + 26)):
            if c[t] > h[j]:
                b = t
                break
        if b is None:
            continue
        k = j + 1 + int(l[j + 1:b].argmin()) if b > j + 1 else None
        if k is None:
            continue
        L, H = l[k], h[j]
        if L >= min(seq):  # liquidity not taken
            continue
        if (c[b:] < L).any():  # invalidated
            continue
        width = H - L
        if width <= 0:
            continue
        # confirmations
        avgv = v[max(0, b - 20):b].mean() if b > 0 else 0
        body = abs(c[b] - o[b])
        mom = bool((a[b] and body > 1.2 * a[b]) or (avgv and v[b] > 1.5 * avgv))
        post = range(b + 1, n)
        post_lows = [i for i in lows if b < i < n - 2]
        ind = any(l[i] > H for i in post_lows)  # a pause/base left above the OF high
        top = b + int(h[b:].argmax())
        retr = list(range(top + 1, n))
        stair, fast, sweep = False, False, False
        if len(retr) >= 3:
            rng = (h[retr] - l[retr]).mean()
            lower_highs = sum(h[retr[x + 1]] <= h[retr[x]] * 1.002 for x in range(len(retr) - 1)) / max(1, len(retr) - 1)
            stair = bool(rng < 0.9 * a[-1] and lower_highs >= 0.6)
            fast = bool(rng > 1.4 * a[-1])
            # sweep-and-close: a retrace bar takes a previous retrace low but closes back above it
            for x in range(1, len(retr)):
                prev_low = l[retr[:x]].min()
                if l[retr[x]] < prev_low and c[retr[x]] > prev_low and (h[retr[x]] - l[retr[x]]) > a[-1]:
                    sweep = True
        best = dict(j=j, k=k, b=b, H=float(H), L=float(L), mom=mom, ind=bool(ind), stair=stair, fast=fast,
                    sweep=sweep, formed=str(h1.index[b]), atr=float(a[-1]), top=float(h[top]))
        break
    return best


# ---------- market ----------
def market_state(daily):
    out = {}
    for s in ("SPY", "QQQ"):
        d = split(daily, s)
        if d.empty:
            continue
        cl = d["Close"]
        e20, e50 = ema(cl, 20), ema(cl, 50)
        below50_recent = bool((cl.iloc[-12:-2] < e50.iloc[-12:-2]).any())
        trend = "yukarı" if cl.iloc[-1] > e50.iloc[-1] and e20.iloc[-1] > e50.iloc[-1] else ("aşağı" if cl.iloc[-1] < e50.iloc[-1] else "yatay")
        out[s] = dict(last=r2(cl.iloc[-1]), chg=r2((cl.iloc[-1] / cl.iloc[-2] - 1) * 100), chg5=r2((cl.iloc[-1] / cl.iloc[-6] - 1) * 100),
                      trend=trend, recovering=bool(below50_recent and cl.iloc[-1] > e20.iloc[-1]),
                      dd=r2((cl.iloc[-1] / cl.iloc[-60:].max() - 1) * 100))
    vix = split(daily, "^VIX")
    if not vix.empty:
        out["VIX"] = dict(last=r2(vix["Close"].iloc[-1]), chg=r2((vix["Close"].iloc[-1] / vix["Close"].iloc[-2] - 1) * 100))
    spy, v = out.get("SPY", {}), out.get("VIX", {}).get("last") or 20
    if spy.get("trend") == "aşağı":
        regime, note = "zayıf", "SPY 50 günlük ortalamanın altında. Kodeks alış yönlü; yeni kâğıt işlem açılmaz."
    elif spy.get("recovering"):
        regime, note = "toparlanıyor", "SPY son günlerde 50 günlüğün altına inip 20 günlüğün üstüne döndü. Seçici ol, yalnız A+."
    elif v >= 25:
        regime, note = "oynak", "VIX 25 üstü: korku yüksek, fitiller uzun. Riskini düşünerek seç."
    else:
        regime, note = "sağlıklı", "SPY yükseliş trendinde, VIX makul. Kodeks normal çalışır."
    out["regime"], out["note"] = regime, note
    return out


# ---------- per-ticker ----------
def earnings_date(tk):
    try:
        cal = tk.calendar
        ds = cal.get("Earnings Date") if isinstance(cal, dict) else None
        if ds:
            return str(ds[0])
    except Exception:
        pass
    return None


def news(tk, n=3):
    out = []
    try:
        for item in (tk.news or [])[:n]:
            c = item.get("content", item)
            link = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or c.get("link")
            out.append(dict(title=c.get("title"), link=link, source=(c.get("provider") or {}).get("displayName") or c.get("publisher"),
                            time=c.get("pubDate") or c.get("providerPublishTime")))
    except Exception:
        pass
    return [x for x in out if x["title"]]


def analyse(sym, h1, d1, mkt, today, live=None):
    cl = d1["Close"]
    e20, e50 = ema(cl, 20), ema(cl, 50)
    htf = bool(cl.iloc[-1] > e50.iloc[-1] and e20.iloc[-1] > e50.iloc[-1])
    last = float(h1["Close"].iloc[-1]) if len(h1) else float(cl.iloc[-1])
    last_time = str(h1.index[-1]) if len(h1) else None
    if live:
        last, last_time = live
    relvol = float(d1["Volume"].iloc[-1] / d1["Volume"].iloc[-21:-1].mean()) if len(d1) > 21 else None
    prev_close = float(cl.iloc[-1]) if d1.index[-1].date() < today else float(cl.iloc[-2])
    row = dict(symbol=sym, last=r2(last), last_time=last_time, prev_close=r2(prev_close), chg_live=r2((last / prev_close - 1) * 100), chg=r2((cl.iloc[-1] / cl.iloc[-2] - 1) * 100), chg5=r2((cl.iloc[-1] / cl.iloc[-6] - 1) * 100),
               relvol=r2(relvol), trend="yukarı" if htf else ("aşağı" if cl.iloc[-1] < e50.iloc[-1] else "yatay"),
               tv=f"https://www.tradingview.com/symbols/{sym}/")
    of = find_order_flow(h1)
    if not of:
        return row, None
    H, L, A = of["H"], of["L"], of["atr"]
    # entry: OF high; if the zone is too wide for 1:2, try 50%
    stop = L - 0.1 * A
    hi20 = float(d1["High"].iloc[-21:-1].max())
    target = max(hi20, of["top"])
    entry = H
    if (target - entry) / max(1e-9, entry - stop) < CFG["paper"]["min_rr"]:
        entry = (H + L) / 2
    rr = (target - entry) / (entry - stop) if entry > stop else 0
    rng_hi, rng_lo = float(h1["High"].iloc[-70:].max()), float(h1["Low"].iloc[-70:].min())
    discount = entry <= (rng_hi + rng_lo) / 2
    checks = dict(htf=htf, liq=True, of=True, poi=bool(discount), mom=of["mom"], ind=of["ind"], stair=of["stair"],
                  sweep=of["sweep"], fast=of["fast"])
    score = sum(checks[k] for k in ("mom", "ind", "stair"))
    grade = "A+" if score == 3 else "A" if score == 2 else "B"
    status = "bölgede" if last <= H else "geri çekilme bekleniyor"
    if last < L:
        status = "geçersiz"
    cand = dict(row, grade=grade, score=score, checks=checks, entry=r2(entry), stop=r2(stop), target=r2(target), rr=r2(rr),
                zone=[r2(L), r2(H)], formed=of["formed"], status=status, notes=[])
    return row, cand


def blockers(c, mkt, earn, today):
    out = []
    if not c["checks"]["htf"]:
        out.append("Günlük trend yukarı değil")
    if not c["checks"]["poi"]:
        out.append("Giriş ucuz yarıda değil")
    if c["checks"]["sweep"]:
        out.append("Geri çekilmede süpürüp kapatma var (işlem dışı)")
    if (c["rr"] or 0) < CFG["paper"]["min_rr"]:
        out.append(f"Ödül/risk 1:{c['rr']} (< 1:{CFG['paper']['min_rr']})")
    if earn:
        dd = (pd.Timestamp(earn).date() - today).days
        if 0 <= dd <= CFG["earnings_block_days"]:
            out.append(f"Bilanço {dd} gün içinde ({earn})")
    if mkt.get("regime") == "zayıf":
        out.append("Piyasa zayıf (SPY 50 günlüğün altında)")
    if c["status"] == "geçersiz":
        out.append("Fiyat OF dibinin altında")
    return out


# ---------- paper engine ----------
def trading_days_between(a, b):
    return len(pd.bdate_range(a, b)) - 1


def update_paper(state, h1map, today):
    P, fee = CFG["paper"], CFG["paper"]["fee_per_order"]
    for t in state["trades"]:
        if t["status"] not in ("pending", "open"):
            continue
        h1 = h1map.get(t["symbol"])
        if h1 is None or h1.empty:
            continue
        since = pd.Timestamp(t.get("checked") or t["created"])
        bars = h1[h1.index > since]
        for ts, bar in bars.iterrows():
            o, hi, lo, cl = bar["Open"], bar["High"], bar["Low"], bar["Close"]
            if t["status"] == "pending":
                if hi >= t["target"] and lo > t["entry"]:
                    t.update(status="cancelled", exit_time=str(ts), note="Hedef girişe dokunmadan geldi (kaçtı)")
                    break
                if lo <= t["entry"]:
                    fill = min(t["entry"], o)
                    t.update(status="open", fill=r2(fill, 4), fill_time=str(ts))
                    if lo <= t["stop"]:  # same bar: assume the worst
                        ex = min(t["stop"], o) if o < t["stop"] else t["stop"]
                        close_trade(t, ex, ts, fee, "Aynı mumda stop")
                        break
                    continue
                if cl < t["stop"]:
                    t.update(status="cancelled", exit_time=str(ts), note="Dolmadan OF bozuldu")
                    break
            elif t["status"] == "open":
                if lo <= t["stop"]:
                    ex = o if o < t["stop"] else t["stop"]  # gap through the stop fills at the open
                    close_trade(t, ex, ts, fee, "Stop" + (" (boşlukla)" if o < t["stop"] else ""))
                    break
                if hi >= t["target"]:
                    ex = o if o > t["target"] else t["target"]
                    close_trade(t, ex, ts, fee, "Hedef")
                    break
        if len(bars):
            t["checked"] = str(bars.index[-1])
        if t["status"] == "pending" and trading_days_between(pd.Timestamp(t["date"]), pd.Timestamp(today)) >= P["pending_days"]:
            t.update(status="expired", note=f"{P['pending_days']} işlem gününde dolmadı")
    state["equity"] = round(P["start_equity"] + sum(t.get("pnl", 0) for t in state["trades"] if t["status"] == "closed"), 2)


def close_trade(t, ex, ts, fee, note):
    t.update(status="closed", exit=r2(ex, 4), exit_time=str(ts), note=note)
    risk = t["fill"] - t["stop"]
    t["r"] = r2((ex - t["fill"]) / risk) if risk > 0 else 0
    t["pnl"] = r2((ex - t["fill"]) * t["qty"] - 2 * fee)


def open_paper(state, cands, mkt, today):
    P = CFG["paper"]
    tday = str(today)
    todays = [t for t in state["trades"] if t["date"] == tday]
    lost_today = any(t["status"] == "closed" and (t.get("r") or 0) < 0 and t.get("exit_time", "")[:10] == tday for t in state["trades"])
    active = [t for t in state["trades"] if t["status"] in ("pending", "open")]
    log = []
    if lost_today:
        log.append("Bugün bir zarar var: 1 zarar = gün biter. Yeni kâğıt işlem yok.")
        return log
    for c in cands:
        if len(todays) >= P["max_new_per_day"]:
            log.append(f"Günlük sınır doldu ({P['max_new_per_day']}).")
            break
        if len(active) >= P["max_open"]:
            log.append(f"Aynı anda en fazla {P['max_open']} açık/bekleyen işlem.")
            break
        if c["blocked"] or (P["only_a_plus"] and c["grade"] != "A+") or c["status"] == "geçersiz":
            continue
        if any(t["symbol"] == c["symbol"] for t in active):
            continue
        if any(t["symbol"] == c["symbol"] and t.get("formed") == c["formed"] for t in state["trades"]):
            continue  # this exact order flow was already traded
        risk_amt = state["equity"] * P["risk_pct"] / 100
        per = c["entry"] - c["stop"]
        qty = math.floor((risk_amt - 2 * P["fee_per_order"]) / per * 1000) / 1000 if per > 0 else 0
        if qty <= 0 or qty * c["entry"] > state["equity"]:
            continue
        t = dict(id=uuid.uuid4().hex[:8], symbol=c["symbol"], date=tday, created=str(now_ny()), formed=c["formed"],
                 entry=c["entry"], stop=c["stop"], target=c["target"], rr=c["rr"], qty=qty, grade=c["grade"],
                 status="pending", note="Limit alış emri (kâğıt)")
        state["trades"].append(t)
        todays.append(t)
        active.append(t)
        log.append(f"{c['symbol']}: kâğıt limit alış {c['entry']} · stop {c['stop']} · hedef {c['target']} (1:{c['rr']})")
    return log


# ---------- main ----------
def main():
    DATA.mkdir(parents=True, exist_ok=True)
    uni = CFG["universe"]
    today = now_ny().date()
    d1 = yf.download(uni + ["^VIX"], period="1y", interval="1d", group_by="ticker", auto_adjust=False, progress=False, threads=True)
    h1 = yf.download(uni, period="60d", interval="60m", group_by="ticker", auto_adjust=False, progress=False, threads=True)
    mkt = market_state(d1)
    # latest trade incl. pre/after-market (1m bars), so prices match what Midas shows at scan time
    live = {}
    try:
        m1 = yf.download(uni, period="2d", interval="1m", prepost=True, group_by="ticker", auto_adjust=False, progress=False, threads=True)
        for s in uni:
            q = split(m1, s)
            if not q.empty:
                live[s] = (float(q["Close"].iloc[-1]), str(q.index[-1].tz_convert(NY) if q.index.tz is not None else q.index[-1]))
    except Exception as e:
        print(f"1m: {e}", file=sys.stderr)
    rows, cands, h1map = [], [], {}
    for s in uni:
        try:
            dd, hh = split(d1, s), split(h1, s)
            if dd.empty or hh.empty:
                continue
            if hh.index.tz is None:
                hh = hh.tz_localize("UTC")
            hh = hh.tz_convert(NY)
            h1map[s] = hh
            row, cand = analyse(s, hh, dd, mkt, today, live.get(s))
            tk = yf.Ticker(s)
            earn = earnings_date(tk) if s not in ("SPY", "QQQ") else None
            row["earnings"] = earn
            rows.append(row)
            if cand:
                cand["earnings"] = earn
                cand["blocked"] = blockers(cand, mkt, earn, today)
                cand["news"] = news(tk)
                cands.append(cand)
        except Exception as e:  # one bad ticker must not stop the scan
            print(f"{s}: {e}", file=sys.stderr)
    order = {"A+": 0, "A": 1, "B": 2}
    cands.sort(key=lambda c: (bool(c["blocked"]), order[c["grade"]], -(c["rr"] or 0)))
    rows.sort(key=lambda r: -(r["chg"] or 0))

    ppath = DATA / "paper.json"
    state = json.loads(ppath.read_text()) if ppath.exists() else {"equity": CFG["paper"]["start_equity"], "trades": []}
    update_paper(state, h1map, today)
    log = open_paper(state, cands, mkt, today) if mkt.get("regime") != "zayıf" else ["Piyasa zayıf: yeni kâğıt işlem açılmadı."]
    state["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ppath.write_text(json.dumps(state, ensure_ascii=False, indent=1))

    out = dict(generated=datetime.now(timezone.utc).isoformat(timespec="seconds"), ny_date=str(today), market=mkt,
               candidates=cands, watch=rows, gainers=[r for r in rows if (r["relvol"] or 0) >= 1.2][:5],
               paper_log=log, config=CFG["paper"])
    (DATA / "scan.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{len(rows)} hisse, {len(cands)} order flow, {sum(1 for c in cands if c['grade']=='A+' and not c['blocked'])} temiz A+. Piyasa: {mkt.get('regime')}")
    for line in log:
        print(" -", line)


if __name__ == "__main__":
    main()
