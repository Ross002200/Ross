"""Diogenes tarayıcı ve kâğıt işlem motoru (gün içi).

Her çalışmada:
  1. Evren (S&P 500 + sık işlem gören hisseler, ~560) günlük veriyle süzülür: likidite, ATR, günlük trend.
  2. Süzülenlerde 15 dk ve 1 s grafikte yükseliş yönlü order flow aranır (Baştan Sona Trade kodeksi),
     "oyundaki hisse" ölçüleri eklenir: göreli hacim, VWAP, gap (Zarattini, Barbon & Aziz 2024).
  3. Her hisse için kuralın son 60 gündeki yaklaşık sonucu (backtest) günde bir kez hesaplanır,
     küçük örnekler sıfıra doğru büzülerek (shrinkage) sıralamaya katılır.
  4. 1000 $'lık kâğıt hesapta tek pozisyon kuralıyla limit alış verilir, 5 dk mumlarla dolum/stop/hedef
     izlenir, gün sonu pozisyon kapatılır, günde 2 stopta durulur.
  5. Olaylar ntfy ile telefona bildirilir.

Öğrenme amaçlıdır, yatırım tavsiyesi değildir. Gerçek emir vermez.
"""
import json
import math
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

sys.path.insert(0, str(Path(__file__).parent))
import universe  # noqa: E402

HERE = Path(__file__).parent
DATA = HERE.parent / "data"
CFG = json.loads((HERE / "config.json").read_text())
P, F = CFG["paper"], CFG["filters"]
NY = "America/New_York"
FEE2 = 2 * P["fee_per_order"]


# ---------------------------------------------------------------- helpers
def now_ny():
    return pd.Timestamp.now(tz=NY)


def hm(ts):
    return ts.strftime("%H:%M")


def r2(x, d=2):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) or math.isinf(x) else round(x, d)


def ema(s, n):
    return s.ewm(span=n, adjust=False).mean()


def atr_series(df, n=14):
    pc = df["Close"].shift(1)
    tr = pd.concat([df["High"] - df["Low"], (df["High"] - pc).abs(), (df["Low"] - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean()


def split(raw, sym):
    try:
        df = raw[sym] if isinstance(raw.columns, pd.MultiIndex) else raw
        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        return df
    except KeyError:
        return pd.DataFrame()


def to_ny(df):
    if df.empty:
        return df
    if df.index.tz is None:
        df = df.tz_localize("UTC")
    return df.tz_convert(NY)


def rth(df):
    """Regular trading hours only."""
    if df.empty:
        return df
    t = df.index.hour * 60 + df.index.minute
    return df[(t >= 570) & (t < 960)]


def download(tickers, **kw):
    kw.setdefault("group_by", "ticker")
    kw.setdefault("auto_adjust", False)
    kw.setdefault("progress", False)
    kw.setdefault("threads", True)
    return yf.download(tickers, **kw)


def notify(title, message, tags=None, priority=3):
    topic = os.environ.get("NTFY_TOPIC") or CFG.get("ntfy_topic")
    if not topic or os.environ.get("DIOGENES_NO_NOTIFY"):
        print(f"[bildirim] {title}: {message}")
        return
    try:
        requests.post("https://ntfy.sh/", json=dict(topic=topic, title=title, message=message, tags=tags or [], priority=priority,
                                                     click=CFG.get("app_url")), timeout=15)
    except Exception as e:
        print(f"ntfy: {e}", file=sys.stderr)


def macro_today(day):
    try:
        ev = json.loads((HERE / "macro.json").read_text())["events"]
    except Exception:
        return []
    return [e for e in ev if e["date"] == str(day)]


# ---------------------------------------------------------------- order flow
def swings(arr, kind, k=2):
    out = []
    for i in range(k, len(arr) - k):
        w = arr[i - k:i + k + 1]
        v = arr[i]
        if kind == "low" and v == w.min() and (w == v).sum() == 1:
            out.append(i)
        elif kind == "high" and v == w.max() and (w == v).sum() == 1:
            out.append(i)
    return out


def of_events(df):
    """All bullish order flow events (codex S1B3) in a bar series.

    Early buyers leave higher lows (liquidity) -> price drops from swing high H and sweeps them to L ->
    a candle BODY closes above H at bar b. Zone = [L, H]. Returns dicts with bar indexes.
    """
    if len(df) < 60:
        return []
    o, h, l, c, v = (df[x].to_numpy(dtype=float) for x in ("Open", "High", "Low", "Close", "Volume"))
    a = atr_series(df).to_numpy()
    lows, highs = swings(l, "low"), swings(h, "high")
    ev = []
    for j in highs:
        if j < 30:
            continue
        prior = [i for i in lows if j - 30 <= i < j]
        if len(prior) < 2:
            continue
        seq = [l[i] for i in prior[-3:]]
        if not all(seq[x] < seq[x + 1] for x in range(len(seq) - 1)):
            continue
        b = next((t for t in range(j + 1, min(len(c), j + 26)) if c[t] > h[j]), None)
        if b is None or b <= j + 1:
            continue
        k = j + 1 + int(l[j + 1:b].argmin())
        L, H = l[k], h[j]
        if L >= min(seq) or H <= L or not a[b] or math.isnan(a[b]):
            continue
        avgv = v[max(0, b - 20):b].mean()
        mom = bool(abs(c[b] - o[b]) > 1.2 * a[b] or (avgv and v[b] > 1.5 * avgv))
        ev.append(dict(j=j, k=k, b=b, H=float(H), L=float(L), mom=mom, atr=float(a[b])))
    return ev


def confirmations(df, e):
    """Live A+ checks for event e at the last bar of df."""
    h, l, c = (df[x].to_numpy(dtype=float) for x in ("High", "Low", "Close"))
    a = float(atr_series(df).iloc[-1])
    n, b, H = len(c), e["b"], e["H"]
    lows = swings(l, "low")
    ind = any(l[i] > H for i in lows if b < i < n - 2)
    top = b + int(h[b:].argmax())
    retr = list(range(top + 1, n))
    stair = fast = sweep = False
    if len(retr) >= 3:
        rng = (h[retr] - l[retr]).mean()
        lh = sum(h[retr[x + 1]] <= h[retr[x]] * 1.002 for x in range(len(retr) - 1)) / max(1, len(retr) - 1)
        stair, fast = bool(rng < 0.9 * a and lh >= 0.6), bool(rng > 1.4 * a)
        for x in range(1, len(retr)):
            pl = l[retr[:x]].min()
            if l[retr[x]] < pl and c[retr[x]] > pl and h[retr[x]] - l[retr[x]] > a:
                sweep = True
    return dict(mom=e["mom"], ind=bool(ind), stair=stair, fast=fast, sweep=sweep, top=float(h[top]), atr=a)


def plan_levels(e, top, prior_high, atr):
    """Entry at OF high (or 50% if 1:2 is not reachable), stop under OF low, target = next liquidity above."""
    stop = e["L"] - 0.1 * atr
    target = max(top, prior_high)
    entry = e["H"]
    if entry <= stop:
        return None
    if (target - entry) / (entry - stop) < P["min_rr"]:
        entry = (e["H"] + e["L"]) / 2
    rr = (target - entry) / (entry - stop) if entry > stop else 0
    return entry, stop, target, rr


def sizing(equity, entry, stop, pct=None):
    """Shares for fixed % risk, capped by equity (no leverage at Midas); fractional to 3 decimals."""
    per = entry - stop
    if per <= 0:
        return 0, 0
    budget = equity * (pct or P["risk_pct"]) / 100
    qty = min((budget - FEE2) / per, equity / entry)
    qty = math.floor(max(0, qty) * 1000) / 1000
    return qty, qty * per + FEE2


def net_rr(qty, entry, stop, target):
    risk = qty * (entry - stop) + FEE2
    return (qty * (target - entry) - FEE2) / risk if risk > 0 and qty > 0 else 0


# ---------------------------------------------------------------- intraday context
def session_vwap(df):
    if df.empty:
        return None
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    vol = df["Volume"].replace(0, pd.NA).fillna(0)
    return float((tp * vol).sum() / vol.sum()) if vol.sum() > 0 else None


def relvol_now(m15, today):
    """Cumulative volume today vs. the 14-day average cumulative volume at the same time of day."""
    if m15.empty:
        return None
    d = m15.index.date
    td = m15[d == today]
    if td.empty:
        return None
    cut = td.index[-1].hour * 60 + td.index[-1].minute
    past = m15[(d < today)]
    days = sorted(set(past.index.date))[-14:]
    vols = []
    for dd in days:
        x = past[past.index.date == dd]
        x = x[(x.index.hour * 60 + x.index.minute) <= cut]
        if len(x):
            vols.append(x["Volume"].sum())
    base = sum(vols) / len(vols) if vols else 0
    return float(td["Volume"].sum() / base) if base else None


# ---------------------------------------------------------------- backtest
VARIANTS = [("liq", False), ("liq", True), (1.5, False), (1.5, True), (2.0, False), (2.0, True), (3.0, False), (3.0, True)]
BASE = ("liq", False)


def vkey(v):
    return f"{'likidite' if v[0] == 'liq' else str(v[0]) + 'R'}{' + başa baş' if v[1] else ''}"


def apply_variant(entry, stop, target, v):
    return target if v[0] == "liq" else entry + v[0] * (entry - stop)


def simulate(o, h, l, c, idx, start, day, entry, stop, target, be):
    """Limit buy at entry from bar `start` on the same day; SL/TP; optional stop-to-entry after +1R; flat at 15:45."""
    filled, res, t, cur_stop, hour = None, None, start, stop, None
    one_r = entry - stop
    while t < len(c) and idx[t].date() == day:
        tt = hm(idx[t])
        if filled is None:
            if tt >= P["entry_end"] or c[t] < stop or (h[t] >= target and l[t] > entry):
                return None
            if l[t] <= entry:
                filled, hour = min(entry, o[t]), idx[t].hour
                if l[t] <= stop:
                    return filled, stop, hour
        else:
            if l[t] <= cur_stop:
                return filled, min(cur_stop, o[t]), hour
            if h[t] >= target:
                return filled, (o[t] if o[t] > target else target), hour
            if be and h[t] >= filled + one_r:
                cur_stop = max(cur_stop, filled)
            if tt >= "15:45":
                return filled, c[t], hour
        t += 1
    return (filled, c[t - 1], hour) if filled is not None else None


def backtest_symbol(m15, d1):
    """Approximate 60-day test of the live rules on 15m bars for every management variant.
    Same-bar SL+TP counts as SL. Returns {variant: [trades]}."""
    out = {v: [] for v in VARIANTS}
    if len(m15) < 200:
        return out
    ev = of_events(m15)
    if not ev:
        return out
    e50, e20 = ema(d1["Close"], 50), ema(d1["Close"], 20)
    trend = {ts.date(): bool(d1["Close"].iloc[i] > e50.iloc[i] and e20.iloc[i] > e50.iloc[i]) for i, ts in enumerate(d1.index)}
    tdays = sorted(trend)
    days = sorted(set(m15.index.date))
    o, h, l, c = (m15[x].to_numpy(dtype=float) for x in ("Open", "High", "Low", "Close"))
    idx = m15.index
    for e in ev:
        b = e["b"]
        tb = idx[b]
        day = tb.date()
        if hm(tb) >= P["entry_end"]:
            continue
        prev = [dd for dd in tdays if dd < day]
        if not prev or not trend[prev[-1]]:
            continue
        di = days.index(day)
        prior_high = float(m15[(m15.index.date >= days[max(0, di - 3)]) & (m15.index.date < day)]["High"].max()) if di else float(h[:b].max())
        lv = plan_levels(e, float(h[b]), prior_high, e["atr"])
        if not lv:
            continue
        entry, stop, liq_target, rr = lv
        if rr < P["min_rr"]:
            continue
        qty, risk = sizing(P["start_equity"], entry, stop)
        if qty <= 0 or FEE2 / risk > P["max_fee_share"]:
            continue
        for v in VARIANTS:
            target = apply_variant(entry, stop, liq_target, v)
            if net_rr(qty, entry, stop, target) < (P["min_net_rr"] if v[0] == "liq" else 0.5):
                continue
            r = simulate(o, h, l, c, idx, b + 1, day, entry, stop, target, v[1])
            if not r:
                continue
            filled, res, hour = r
            pnl = (res - filled) * qty - FEE2
            out[v].append(dict(date=str(day), r=round((res - filled) / (filled - stop), 3), net=round(pnl / risk, 3), mom=e["mom"], hour=hour))
    return out


def stats(rs):
    n = len(rs)
    if not n:
        return dict(n=0)
    w = sum(1 for r in rs if r > 0)
    gains, losses = sum(r for r in rs if r > 0), -sum(r for r in rs if r < 0)
    p = w / n
    z = 1.96
    lo = (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)
    eq = peak = dd = streak = maxstreak = 0
    for r in rs:
        eq += r
        peak = max(peak, eq)
        dd = max(dd, peak - eq)
        streak = streak + 1 if r < 0 else 0
        maxstreak = max(maxstreak, streak)
    return dict(n=n, win=round(p * 100, 1), win_lo=round(lo * 100, 1), avg=round(sum(rs) / n, 3), pf=round(gains / losses, 2) if losses else None,
                maxdd=round(dd, 2), maxloss=maxstreak, total=round(sum(rs), 2))


def run_backtest(m15map, d1map, day):
    allv = {v: [] for v in VARIANTS}
    per = {}
    for s_, m in m15map.items():
        res = backtest_symbol(m, d1map[s_])
        for v in VARIANTS:
            allv[v] += res[v]
        nets = [t["net"] for t in res[BASE]]
        if nets:
            per[s_] = dict(stats(nets), shrunk=round(sum(nets) / (len(nets) + 10), 3))
    variants = []
    for v in VARIANTS:
        nets = [t["net"] for t in allv[v]]
        variants.append(dict(key=vkey(v), target=v[0], be=v[1], shrunk=round(sum(nets) / (len(nets) + 20), 3) if nets else 0, **stats(nets)))
    base = next(x for x in variants if x["target"] == BASE[0] and x["be"] == BASE[1])
    best_v = max(variants, key=lambda x: x["shrunk"])
    # adopt a different management rule only with enough trades and a clear margin (guards against overfitting)
    chosen = best_v if best_v["n"] >= 25 and best_v["shrunk"] > base["shrunk"] + 0.03 else base
    hours = {}
    for t in allv[BASE]:
        hours.setdefault(t["hour"], []).append(t["net"])
    by_hour = [dict(hour=f"{hh:02d}:00", **stats(v)) for hh, v in sorted(hours.items())]
    best = sorted(per.items(), key=lambda kv: -kv[1]["shrunk"])[:25]
    allg = [t["r"] for t in allv[BASE]]
    out = dict(date=str(day), days=60, rules=dict(timeframe="15dk", min_rr=P["min_rr"], risk_pct=P["risk_pct"], fee=P["fee_per_order"],
                                                  equity=P["start_equity"], flat="15:45"),
               overall_net=stats([t["net"] for t in allv[BASE]]), overall_gross=stats(allg), variants=variants,
               chosen=dict(key=chosen["key"], target=chosen["target"], be=chosen["be"]), by_hour=by_hour,
               symbols=per, best=[dict(symbol=k, **v) for k, v in best])
    (DATA / "backtest.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    return out


# ---------------------------------------------------------------- market
def market_state(d1map, m15map, today):
    out = {}
    for s in ("SPY", "QQQ", "IWM"):
        d = d1map.get(s)
        if d is None or d.empty:
            continue
        cl = d["Close"]
        e20, e50 = ema(cl, 20), ema(cl, 50)
        trend = "yukarı" if cl.iloc[-1] > e50.iloc[-1] and e20.iloc[-1] > e50.iloc[-1] else ("aşağı" if cl.iloc[-1] < e50.iloc[-1] else "yatay")
        row = dict(last=r2(cl.iloc[-1]), chg=r2((cl.iloc[-1] / cl.iloc[-2] - 1) * 100), chg5=r2((cl.iloc[-1] / cl.iloc[-6] - 1) * 100), trend=trend,
                   recovering=bool((cl.iloc[-12:-2] < e50.iloc[-12:-2]).any() and cl.iloc[-1] > e20.iloc[-1]))
        m = m15map.get(s)
        if m is not None and not m.empty:
            td = m[m.index.date == today]
            if len(td):
                prev_close = float(d[d.index.date < today]["Close"].iloc[-1])
                vw = session_vwap(td)
                row.update(intraday=r2((td["Close"].iloc[-1] / prev_close - 1) * 100), above_vwap=bool(vw and td["Close"].iloc[-1] > vw), vwap=r2(vw))
                first = td[(td.index.hour * 60 + td.index.minute) < 600]
                if len(first) >= 2:  # Gao et al. 2018: first half-hour return from prior close
                    row["first30"] = r2((first["Close"].iloc[-1] / prev_close - 1) * 100)
        out[s] = row
    vix = d1map.get("^VIX")
    if vix is not None and not vix.empty:
        out["VIX"] = dict(last=r2(vix["Close"].iloc[-1]), chg=r2((vix["Close"].iloc[-1] / vix["Close"].iloc[-2] - 1) * 100))
    spy, v = out.get("SPY", {}), (out.get("VIX", {}).get("last") or 20)
    if spy.get("trend") == "aşağı":
        regime, note = "zayıf", "SPY 50 günlüğün altında. Kodeks alış yönlü; yeni kâğıt işlem açılmaz."
    elif v >= 25:
        regime, note = "oynak", "VIX 25 üstü: korku yüksek, fitiller uzun. Yalnız en temiz A+."
    elif spy.get("recovering"):
        regime, note = "toparlanıyor", "SPY 50 günlüğün altına inip 20 günlüğün üstüne döndü. Seçici ol."
    else:
        regime, note = "sağlıklı", "SPY yükseliş trendinde, VIX makul."
    if spy.get("above_vwap") is False:
        note += " SPY şu an VWAP altında: alışlar rüzgâra karşı."
    out["regime"], out["note"] = regime, note
    return out


# ---------------------------------------------------------------- candidates
def earnings_date(sym):
    try:
        cal = yf.Ticker(sym).calendar
        ds = cal.get("Earnings Date") if isinstance(cal, dict) else None
        return str(ds[0]) if ds else None
    except Exception:
        return None


NEG_WORDS = ("downgrade", "cuts guidance", "lowers guidance", "cuts outlook", "lowers outlook", "lawsuit", "sued", "probe", "investigation", "subpoena",
             "fraud", "recall", "public offering", "share offering", "dilution", "misses", "missed estimates", "plunge", "halted", "bankrupt", "delist",
             "short seller", "short report", "resigns", "steps down", "layoffs", "warning", "sell rating", "underperform")
POS_WORDS = ("upgrade", "beats", "tops estimates", "raises guidance", "raises outlook", "raises forecast", "record revenue", "record quarter",
             "wins contract", "awarded", "partnership", "fda approv", "buyback", "repurchase", "price target raised", "raises price target",
             "outperform", "buy rating", "strong demand")


def tone(title):
    t = (title or "").lower()
    if any(w in t for w in NEG_WORDS):
        return "olumsuz"
    if any(w in t for w in POS_WORDS):
        return "olumlu"
    return "nötr"


def fresh(ts, hours=24):
    try:
        return (pd.Timestamp.now(tz="UTC") - pd.Timestamp(ts).tz_convert("UTC")).total_seconds() < hours * 3600
    except Exception:
        return False


def headlines(sym, n=3):
    out = []
    try:
        for it in (yf.Ticker(sym).news or [])[:n]:
            c = it.get("content", it)
            link = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or c.get("link")
            out.append(dict(title=c.get("title"), link=link, source=(c.get("provider") or {}).get("displayName"), time=c.get("pubDate")))
    except Exception:
        pass
    out = [x for x in out if x["title"]]
    for x in out:
        x["tone"], x["fresh"] = tone(x["title"]), fresh(x.get("time"))
    return out


def resample_1h(m15):
    if m15.empty:
        return m15
    g = m15.resample("60min", origin="start_day", offset="30min")
    out = pd.DataFrame(dict(Open=g["Open"].first(), High=g["High"].max(), Low=g["Low"].min(), Close=g["Close"].last(), Volume=g["Volume"].sum()))
    return rth(out.dropna())


SECTOR_ETF = {"Information Technology": "XLK", "Financials": "XLF", "Energy": "XLE", "Health Care": "XLV", "Consumer Discretionary": "XLY",
              "Industrials": "XLI", "Consumer Staples": "XLP", "Utilities": "XLU", "Materials": "XLB", "Real Estate": "XLRE", "Communication Services": "XLC"}


def sector_ranks(d1map):
    """1-month return rank of the 11 sector ETFs (1 = strongest). J Law / Martin Luk: trade the hot sectors."""
    r = {etf: float(d1map[etf]["Close"].iloc[-1] / d1map[etf]["Close"].iloc[-22] - 1) for etf in SECTOR_ETF.values() if etf in d1map and len(d1map[etf]) > 22}
    return {etf: i + 1 for i, etf in enumerate(sorted(r, key=r.get, reverse=True))}


def build_candidates(tradeable, m15map, d1map, live, mkt, bt, today, now, rsmap=None, uni=None, srank=None):
    cands = []
    for s in tradeable:
        m15, d1 = m15map.get(s), d1map.get(s)
        if m15 is None or m15.empty or len(m15) < 120:
            continue
        sess_days = sorted(set(m15.index.date))
        best = None
        for tf, df, recent_days in (("15dk", m15, 2), ("1s", resample_1h(m15), 3)):
            ev = of_events(df)
            if not ev:
                continue
            cutoff = sess_days[-recent_days] if len(sess_days) >= recent_days else sess_days[0]
            closes = df["Close"].to_numpy(dtype=float)
            for e in reversed(ev):
                if df.index[e["b"]].date() < cutoff:
                    break
                if (closes[e["b"]:] < e["L"]).any():
                    continue
                best = (tf, df, e)
                break
            if best:
                break
        if not best:
            continue
        tf, df, e = best
        cf = confirmations(df, e)
        prior = m15[(m15.index.date < today)]
        prior_high = float(prior[prior.index.date >= sorted(set(prior.index.date))[-3]]["High"].max()) if len(prior) else cf["top"]
        lv = plan_levels(e, cf["top"], prior_high, cf["atr"])
        if not lv:
            continue
        entry, stop, target, rr = lv
        ch = (bt or {}).get("chosen") or {"target": "liq", "be": False, "key": "likidite"}
        if ch["target"] != "liq":
            target = entry + float(ch["target"]) * (entry - stop)
            rr = (target - entry) / (entry - stop)
        last = live.get(s, float(m15["Close"].iloc[-1]))
        td = m15[m15.index.date == today]
        vw = session_vwap(td) if len(td) else None
        rv = relvol_now(m15, today)
        prev_close = float(d1[d1.index.date < today]["Close"].iloc[-1])
        gap = float(td["Open"].iloc[0] / prev_close - 1) * 100 if len(td) else None
        qty, risk = sizing(P["start_equity"], entry, stop)
        nrr = net_rr(qty, entry, stop, target)
        cl = d1["Close"]
        htf = bool(cl.iloc[-1] > ema(cl, 50).iloc[-1] and ema(cl, 20).iloc[-1] > ema(cl, 50).iloc[-1])
        rng = df.iloc[-70:]
        discount = entry <= (float(rng["High"].max()) + float(rng["Low"].min())) / 2
        e10, e20d = ema(cl, 10).iloc[-1], ema(cl, 20).iloc[-1]
        sec = ((uni or {}).get(s) or {}).get("sector")
        sr = (srank or {}).get(SECTOR_ETF.get(sec, ""))
        checks = dict(htf=htf, liq=True, of=True, poi=bool(discount), mom=cf["mom"], ind=cf["ind"], stair=cf["stair"], sweep=cf["sweep"], fast=cf["fast"],
                      ema=bool(cl.iloc[-1] > e10 > e20d), hot=bool(sr and sr <= 4),
                      vwap=bool(vw and last > vw) if vw else None, inplay=bool(rv and rv >= F["min_relvol"]) if rv is not None else None)
        score = sum(checks[k] for k in ("mom", "ind", "stair"))
        grade = "A+" if score == 3 else "A" if score == 2 else "B"
        b_sym = (bt or {}).get("symbols", {}).get(s)
        status = "geçersiz" if last < e["L"] else ("bölgede" if last <= e["H"] else "geri çekilme bekleniyor")
        cands.append(dict(symbol=s, tf=tf, grade=grade, score=score, checks=checks, entry=r2(entry), stop=r2(stop), target=r2(target), rr=r2(rr),
                          net_rr=r2(nrr), qty=qty, risk=r2(risk), fee_share=r2(FEE2 / risk if risk else 1), zone=[r2(e["L"]), r2(e["H"])],
                          formed=str(df.index[e["b"]]), status=status, last=r2(last), prev_close=r2(prev_close), chg_live=r2((last / prev_close - 1) * 100),
                          relvol=r2(rv), vwap=r2(vw), backtest=b_sym, gap=r2(gap), rs=(rsmap or {}).get(s), mgmt=ch.get("key"), be=bool(ch.get("be")),
                          liq_target=ch["target"] == "liq", sector_rank=sr, tv=f"https://www.tradingview.com/symbols/{s}/"))
    return cands


TAGS = [("Günlük trend", "Thranduil · cis"), ("ucuz yarı", "Thranduil · Raschke"), ("süpürüp", "Thranduil"), ("Ödül/risk", "Minervini"),
        ("Komisyon", "matematik"), ("OF dibinin", "Thranduil"), ("Bilanço", "Thranduil"), ("Piyasa zayıf", "cis · O'Neil"), ("VWAP", "Aziz"),
        ("haber", "Dhaliwal · Sall"), ("gap", "Sall"), ("RS", "Minervini · J Law · Luk"), ("saat", "Gao · Breitstein"), ("FOMC", "Thranduil · Sall"),
        ("bekle", "Thranduil · Sall")]


def tag_of(reason):
    return next((t for k, t in TAGS if k in reason), "kodeks")


def blockers(c, mkt, earn, macro, now, today, bt=None):
    out = []
    ch = c["checks"]
    if not ch["htf"]:
        out.append("Günlük trend yukarı değil")
    if not ch["poi"]:
        out.append("Giriş ucuz yarıda değil")
    if ch["sweep"]:
        out.append("Geri çekilmede süpürüp kapatma (işlem dışı)")
    if c.get("liq_target", True) and (c["rr"] or 0) < P["min_rr"]:
        out.append(f"Ödül/risk 1:{c['rr']} < 1:{P['min_rr']}")
    if (c["net_rr"] or 0) < (P["min_net_rr"] if c.get("liq_target", True) else 0.5):
        out.append(f"Komisyon sonrası 1:{c['net_rr']} < 1:{P['min_net_rr']}")
    if (c["fee_share"] or 1) > P["max_fee_share"]:
        out.append(f"Komisyon riskin %{round((c['fee_share'] or 1)*100)}'i (> %{round(P['max_fee_share']*100)})")
    if c["status"] == "geçersiz":
        out.append("Fiyat OF dibinin altında")
    if earn:
        dd = (pd.Timestamp(earn).date() - today).days
        if -1 <= dd <= 0:
            out.append(f"Bilanço {'bugün' if dd == 0 else 'dün'} ({earn})")
    if mkt.get("regime") == "zayıf":
        out.append("Piyasa zayıf")
    if ch.get("vwap") is False:
        out.append("Fiyat VWAP altında")
    news = c.get("news") or []
    if any(n["fresh"] and n["tone"] == "olumsuz" for n in news):
        out.append("Taze olumsuz haber")
    if (c.get("gap") or 0) > 6 and not any(n["fresh"] and n["tone"] == "olumlu" for n in news):
        out.append(f"Katalizörsüz %{c['gap']:.1f} gap (gün içinde geri verme eğilimi)")
    if (c.get("rs") or 0) < 60:
        out.append(f"RS {c.get('rs')} < 60 (en güçlü hisseler önce)")
    hour = f"{now.hour:02d}:00"
    hb = next((h for h in ((bt or {}).get("by_hour") or []) if h["hour"] == hour), None)
    if hb and hb.get("n", 0) >= 15 and (hb["total"] / (hb["n"] + 20)) < 0:
        out.append(f"{hour} saatinde backtest beklentisi negatif ({hb['n']} işlem)")
    for m in macro:
        if "FOMC faiz" in m["name"] and hm(now) >= "13:00":
            out.append("FOMC kararı öncesi/sonrası: yeni işlem yok")
        if m["impact"] == "yüksek" and m["time"] == "08:30" and hm(now) < "10:15":
            out.append(f"{m['name']} günü: 10:15'e kadar bekle")
    return out


def rank(c):
    g = {"A+": 30, "A": 20, "B": 10}[c["grade"]]
    g += 3 if c["checks"].get("ema") else 0  # Oliver Kell: price above rising 10/20 EMA
    g += 4 if c["checks"].get("hot") else 0  # J Law / Martin Luk: hot sector
    g += (c.get("rs") or 50) / 10  # Minervini / Kullamägi: lead with relative strength
    g += 5 if any(n.get("fresh") and n.get("tone") == "olumlu" for n in (c.get("news") or [])) else 0
    bt = (c.get("backtest") or {}).get("shrunk") or 0
    rv = min(c.get("relvol") or 0, 5)
    return g + 20 * bt + 2 * rv + (3 if c["checks"].get("vwap") else 0) + min(c.get("net_rr") or 0, 5)


# ---------------------------------------------------------------- paper engine
def load_state():
    p = DATA / "paper.json"
    st = json.loads(p.read_text()) if p.exists() else {}
    if st.get("version") != 2:  # new rules (1000 $, day trade): start a fresh account, keep the old one aside
        if st:
            (DATA / "paper_v1.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))
        st = dict(version=2, start=P["start_equity"], equity=P["start_equity"], trades=[], days={})
    return st


def day_log(st, day):
    return st["days"].setdefault(str(day), dict(losses=0, wins=0, opened=0, r=0.0, summary_sent=False, stopped=False))


def close(t, price, ts, why, st):
    t.update(status="closed", exit=r2(price, 4), exit_time=str(ts), note=why)
    risk = (t["fill"] - t["stop"]) * t["qty"] + FEE2
    t["r"] = r2((price - t["fill"]) / (t["fill"] - t["stop"]))
    t["pnl"] = r2((price - t["fill"]) * t["qty"] - FEE2)
    t["net_r"] = r2(t["pnl"] / risk) if risk else None
    d = day_log(st, pd.Timestamp(ts).date())
    if t["pnl"] < 0:
        d["losses"] += 1
    else:
        d["wins"] += 1
    d["r"] = round(d["r"] + (t["net_r"] or 0), 2)
    icon = "white_check_mark" if t["pnl"] >= 0 else "x"
    notify(f"{t['symbol']} kapandı: {why}", f"{t['symbol']} {t['qty']} adet · giriş {t['fill']} → çıkış {r2(price)} · {t['net_r']}R net · {t['pnl']:+.2f} $ (kâğıt)\nBakiye: {equity(st):.2f} $", [icon], 4)


def equity(st):
    return round(st["start"] + sum(t.get("pnl") or 0 for t in st["trades"] if t["status"] == "closed"), 2)


def update_active(st, now, macro):
    act = [t for t in st["trades"] if t["status"] in ("pending", "open")]
    if not act:
        return
    syms = sorted({t["symbol"] for t in act})
    raw = download(syms, period="5d", interval="5m", prepost=False)
    for t in act:
        m5 = rth(to_ny(split(raw, t["symbol"])))
        if m5.empty:
            continue
        since = pd.Timestamp(t.get("checked") or t["created"])
        bars = m5[m5.index > since]
        fomc_flat = any("FOMC faiz" in m["name"] for m in macro)
        for ts, bar in bars.iterrows():
            o, hi, lo, cl, tt = bar["Open"], bar["High"], bar["Low"], bar["Close"], hm(ts)
            if ts.date() != pd.Timestamp(t["created"]).date() and t["status"] == "pending":
                t.update(status="cancelled", note="Gün içinde dolmadı")
                break
            if t["status"] == "pending":
                if tt >= P["entry_end"]:
                    t.update(status="cancelled", note=f"{P['entry_end']}'e kadar dolmadı", exit_time=str(ts))
                    break
                if cl < t["stop"]:
                    t.update(status="cancelled", note="Dolmadan OF bozuldu", exit_time=str(ts))
                    break
                if hi >= t["target"] and lo > t["entry"]:
                    t.update(status="cancelled", note="Hedef girişe dokunmadan geldi", exit_time=str(ts))
                    break
                if lo <= t["entry"]:
                    t.update(status="open", fill=r2(min(t["entry"], o), 4), fill_time=str(ts))
                    notify(f"{t['symbol']} pozisyon açıldı", f"Kâğıt alış {t['qty']} adet @ {t['fill']} · stop {t['stop']} · hedef {t['target']} · risk {t['risk']} $", ["chart_with_upwards_trend"], 4)
                    if lo <= t["stop"]:
                        close(t, t["stop"], ts, "Stop (aynı mum)", st)
                        break
                continue
            if lo <= t["stop"]:
                close(t, o if o < t["stop"] else t["stop"], ts, "Stop" + (" (boşlukla)" if o < t["stop"] else ""), st)
                break
            if hi >= t["target"]:
                close(t, o if o > t["target"] else t["target"], ts, "Hedef", st)
                break
            if t.get("be") and not t.get("be_moved") and hi >= t["fill"] + (t["fill"] - t["stop"]):
                t.update(stop=t["fill"], be_moved=str(ts))
                notify(f"{t['symbol']} stop girişe çekildi", f"+1R görüldü. Stop {t['fill']} (başa baş). Bu işlem artık zararla kapanmaz (komisyon hariç).", ["shield"], 3)
            if fomc_flat and tt >= "13:45":
                close(t, cl, ts, "FOMC öncesi kapatıldı", st)
                break
            if tt >= P["flat_at"]:
                close(t, cl, ts, "Gün sonu kapanış", st)
                break
        if len(bars):
            t["checked"] = str(bars.index[-1])
        if t["status"] == "open":  # news on the open position (Dhaliwal / Sall: the edge is gone when the story changes)
            seen = set(t.get("news_seen", []))
            for n in headlines(t["symbol"], 5):
                key = (n.get("title") or "")[:80]
                if key in seen or not n["fresh"]:
                    continue
                seen.add(key)
                if n["tone"] == "olumsuz":
                    last_px = float(m5["Close"].iloc[-1])
                    msg = n["title"]
                    if last_px > t["fill"] and t["stop"] < t["fill"]:
                        t.update(stop=t["fill"], be_moved=str(now))
                        msg += "\nPozisyon kârda: stop girişe çekildi."
                    notify(f"{t['symbol']}: olumsuz haber", msg, ["warning"], 4)
            t["news_seen"] = list(seen)[-30:]


def drawdown(st):
    eq = peak = float(st["start"])
    for t in st["trades"]:
        if t["status"] == "closed":
            eq += t.get("pnl") or 0
            peak = max(peak, eq)
    return round((peak - eq) / peak * 100, 2) if peak else 0


def risk_pct_now(st):
    """Progressive exposure (Minervini): half size while the last 5 closed trades are net negative,
    or while the account is 10%+ below its peak (Martin Luk's 50% drawdown lesson)."""
    last = [t.get("net_r") or 0 for t in st["trades"] if t["status"] == "closed"][-5:]
    half = (len(last) >= 3 and sum(last) < 0) or drawdown(st) >= 10
    return P["risk_pct"] / 2 if half else P["risk_pct"]


def open_new(st, cands, mkt, now, today):
    d = day_log(st, today)
    log = []
    if d["losses"] >= P["max_losses_per_day"]:
        if not d["stopped"]:
            d["stopped"] = True
            notify("Bugünlük masa kapandı", f"Günde {P['max_losses_per_day']} stop kuralı. Bugün {d['r']:+.2f}R. Yarın yeniden.", ["no_entry"], 4)
        return [f"Günde {P['max_losses_per_day']} stop oldu: bugün yeni işlem yok."]
    if any(t["status"] in ("pending", "open") for t in st["trades"]):
        return ["Aktif pozisyon/emir var: tek pozisyon kuralı."]
    if not (P["entry_start"] <= hm(now) < P["entry_end"]) or now.weekday() >= 5:
        return [f"Giriş penceresi dışında ({P['entry_start']}–{P['entry_end']} NY)."]
    if d["opened"] >= P["max_new_per_day"]:
        return ["Günlük işlem sınırı doldu."]
    if mkt.get("regime") == "zayıf":
        return ["Piyasa zayıf: yeni işlem yok."]
    if drawdown(st) >= 20:
        if not st.get("pause_sent"):
            st["pause_sent"] = True
            notify("Diogenes durdu", f"Kâğıt hesap zirveden %{drawdown(st)} aşağıda. Kurallar gözden geçirilene kadar yeni işlem yok.", ["octagonal_sign"], 5)
        return ["Zirveden %20 düşüş: sistem durdu, kurallar gözden geçirilmeli."]
    eq = equity(st)
    for c in cands:
        if c["blocked"] or (P["only_a_plus"] and c["grade"] != "A+") or c["status"] == "geçersiz":
            continue
        if any(t["symbol"] == c["symbol"] and t.get("formed") == c["formed"] for t in st["trades"]):
            continue
        qty, risk = sizing(eq, c["entry"], c["stop"], risk_pct_now(st))
        if qty <= 0:
            continue
        t = dict(id=uuid.uuid4().hex[:8], symbol=c["symbol"], tf=c["tf"], date=str(today), created=str(now), formed=c["formed"], entry=c["entry"],
                 stop=c["stop"], target=c["target"], rr=c["rr"], qty=qty, risk=r2(risk), grade=c["grade"], status="pending", note="Limit alış (kâğıt)",
                 relvol=c.get("relvol"), be=c.get("be", False), mgmt=c.get("mgmt"), catalyst=c.get("catalyst"), rs=c.get("rs"),
                 scenario=(f"Plan: {c['tf']} OF {c['zone'][0]}–{c['zone'][1]} üstünde kaldıkça tut. Geçersiz: {c['stop']} altına iniş. "
                           f"Hedef {c['target']} (sonraki likidite). Zaman: en geç {P['flat_at']} NY'de çık. "
                           f"{'Kâra geçince +1R’de stop girişe. ' if c.get('be') else ''}Olumsuz haber gelirse kârdaysa stop girişe."))
        if c["last"] and c["stop"] < c["last"] <= c["entry"]:  # already in the zone: a limit at entry fills at the market
            t.update(status="open", fill=c["last"], fill_time=str(now), note="Bölgedeyken doldu")
            notify(f"{c['symbol']} pozisyon açıldı", f"Kâğıt alış {qty} adet @ {c['last']} · stop {c['stop']} · hedef {c['target']} · risk {r2(risk)} $", ["chart_with_upwards_trend"], 4)
        else:
            notify(f"{c['symbol']} limit emir", f"Kâğıt limit alış {qty} adet @ {c['entry']} · stop {c['stop']} · hedef {c['target']} (1:{c['rr']}, net 1:{c['net_rr']})\n{t['scenario']}", ["hourglass"], 3)
        st["trades"].append(t)
        d["opened"] += 1
        log.append(f"{c['symbol']}: {t['note']} {c['entry']} · stop {c['stop']} · hedef {c['target']}")
        break
    return log or ["Kurallara uyan temiz A+ yok. İşlem yok da bir karardır."]


def daily_summary(st, now, today):
    d = day_log(st, today)
    if now.weekday() >= 5 or hm(now) < "16:00" or d["summary_sent"]:
        return
    tr = [t for t in st["trades"] if t["status"] == "closed" and str(t.get("exit_time", ""))[:10] == str(today)]
    d["summary_sent"] = True
    if not tr and not d["opened"]:
        notify("Gün özeti", f"Bugün işlem yok. Bakiye {equity(st):.2f} $ (kâğıt).", ["memo"], 2)
        return
    lines = [f"{t['symbol']}: {t['net_r']}R ({t['pnl']:+.2f} $) · {t['note']}" for t in tr]
    notify("Gün özeti", "\n".join(lines) + f"\nBugün {d['r']:+.2f}R · bakiye {equity(st):.2f} $ (kâğıt)", ["memo"], 3)


def write_journal(st, cands, mkt, macro, log, now, today, bt, n_trade, n_uni):
    """System diary: one entry per NY trading day, rewritten on every run (data/journal.json)."""
    jp = DATA / "journal.json"
    j = json.loads(jp.read_text()) if jp.exists() else {"days": []}
    filt = {}
    for c in cands:
        for b in c["blocked"]:
            k = tag_of(b) + " · " + (re.sub(r"\s*[\d%(].*$", "", b) or b)[:48]
            filt[k] = filt.get(k, 0) + 1
    tr = [t for t in st["trades"] if t["date"] == str(today) or str(t.get("exit_time", ""))[:10] == str(today)]
    d = day_log(st, today)
    closed = [t for t in st["trades"] if t["status"] == "closed"]
    rs = [t.get("net_r") or 0 for t in closed]
    wins = [r for r in rs if r > 0]
    loss = [-r for r in rs if r < 0]
    kelly = None
    if wins and loss:
        W, R = len(wins) / len(rs), (sum(wins) / len(wins)) / (sum(loss) / len(loss))
        kelly = round(max(0.0, (W - (1 - W) / R) / 4 * 100), 2)
    entry = dict(date=str(today), updated=hm(now) + " NY", regime=mkt.get("regime"), note=mkt.get("note"),
                 spy_first30=(mkt.get("SPY") or {}).get("first30"), macro=[m["name"] for m in macro], universe=n_uni, screened=n_trade,
                 candidates=len(cands), clean=[c["symbol"] for c in cands if not c["blocked"] and c["grade"] == "A+"],
                 filters=dict(sorted(filt.items(), key=lambda kv: -kv[1])), actions=log,
                 trades=[dict(symbol=t["symbol"], status=t["status"], entry=t.get("fill") or t["entry"], stop=t["stop"], target=t["target"],
                              exit=t.get("exit"), net_r=t.get("net_r"), pnl=t.get("pnl"), note=t.get("note"), scenario=t.get("scenario")) for t in tr],
                 day=dict(losses=d["losses"], wins=d["wins"], r=d["r"]), equity=equity(st), drawdown=drawdown(st), risk_pct=risk_pct_now(st),
                 kelly_quarter=kelly, sample=len(rs), mgmt=((bt or {}).get("chosen") or {}).get("key"))
    j["days"] = [x for x in j["days"] if x["date"] != str(today)] + [entry]
    j["days"] = j["days"][-120:]
    jp.write_text(json.dumps(j, ensure_ascii=False, indent=0))


# ---------------------------------------------------------------- main
def main():
    DATA.mkdir(parents=True, exist_ok=True)
    now = now_ny()
    today = now.date()
    uni = universe.load()
    syms = sorted(uni)
    macro = macro_today(today)

    st = load_state()
    update_active(st, now, macro)  # cheap: 5m bars for the one active symbol

    d1raw = download(syms + ["^VIX"], period="6mo", interval="1d")
    d1map = {s: split(d1raw, s) for s in syms + ["^VIX"]}
    d1map = {s: d for s, d in d1map.items() if not d.empty}

    # liquidity / volatility screen (Zarattini et al. 2024 style "tradeable" filter) + daily trend for longs
    tradeable, watch_rows = [], []
    for s, d in d1map.items():
        if s == "^VIX" or len(d) < 60:
            continue
        cl = d["Close"]
        a = atr_series(d).iloc[-1]
        avgv = d["Volume"].iloc[-15:-1].mean()
        price = float(cl.iloc[-1])
        ok = price >= F["min_price"] and avgv >= F["min_avg_volume"] and a >= F["min_atr"] and a / price * 100 >= F["min_atr_pct"]
        up = bool(cl.iloc[-1] > ema(cl, 50).iloc[-1] and ema(cl, 20).iloc[-1] > ema(cl, 50).iloc[-1])
        if ok and up:
            tradeable.append(s)
    for s in ("SPY", "QQQ", "IWM"):
        if s not in tradeable:
            tradeable.append(s)

    m15raw = download(tradeable, period="60d", interval="15m", prepost=False)
    m15map = {s: rth(to_ny(split(m15raw, s))) for s in tradeable}
    m15map = {s: m for s, m in m15map.items() if not m.empty}

    live = {}
    try:
        m1 = download(tradeable, period="2d", interval="1m", prepost=True)
        for s in tradeable:
            q = split(m1, s)
            if not q.empty:
                live[s] = float(q["Close"].iloc[-1])
    except Exception as e:
        print(f"1m: {e}", file=sys.stderr)

    btp = DATA / "backtest.json"
    bt = json.loads(btp.read_text()) if btp.exists() else None
    if not bt or bt.get("date") != str(today):
        try:
            bt = run_backtest({s: m for s, m in m15map.items() if s in d1map}, d1map, today)
        except Exception as e:
            print(f"backtest: {e}", file=sys.stderr)

    mkt = market_state(d1map, m15map, today)
    r63 = {s: float(d["Close"].iloc[-1] / d["Close"].iloc[-64] - 1) for s, d in d1map.items() if s != "^VIX" and len(d) > 64}
    order = sorted(r63, key=r63.get)
    rsmap = {s: round(100 * i / max(1, len(order) - 1)) for i, s in enumerate(order)}
    srank = sector_ranks(d1map)
    cands = build_candidates([s for s in tradeable if s not in ("SPY", "QQQ", "IWM")], m15map, d1map, live, mkt, bt, today, now, rsmap, uni, srank)
    cands.sort(key=rank, reverse=True)
    cands = cands[:30]
    for c in cands:  # earnings and headlines only for the shortlist (network-heavy)
        c["earnings"] = earnings_date(c["symbol"])
        c["news"] = headlines(c["symbol"], 5)
        c["catalyst"] = next((n["tone"] for n in c["news"] if n["fresh"] and n["tone"] != "nötr"), None)
        c["blocked"] = blockers(c, mkt, c["earnings"], macro, now, today, bt)
        c["blocked_tags"] = sorted({tag_of(b) for b in c["blocked"]})
        c["sector"] = uni.get(c["symbol"], {}).get("sector")
        c["name"] = uni.get(c["symbol"], {}).get("name")
    cands.sort(key=lambda c: (bool(c["blocked"]), -rank(c)))

    for s in tradeable:
        d, m = d1map.get(s), m15map.get(s)
        if d is None or m is None:
            continue
        last = live.get(s, float(m["Close"].iloc[-1]))
        prev = float(d[d.index.date < today]["Close"].iloc[-1])
        watch_rows.append(dict(symbol=s, name=uni.get(s, {}).get("name"), sector=uni.get(s, {}).get("sector"), last=r2(last), prev_close=r2(prev),
                               chg_live=r2((last / prev - 1) * 100), chg5=r2((d["Close"].iloc[-1] / d["Close"].iloc[-6] - 1) * 100),
                               relvol=r2(relvol_now(m, today)), trend="yukarı", tv=f"https://www.tradingview.com/symbols/{s}/"))
    watch_rows.sort(key=lambda r: -(r["relvol"] or 0))

    log = open_new(st, cands, mkt, now, today)
    daily_summary(st, now, today)
    write_journal(st, cands, mkt, macro, log, now, today, bt, len(tradeable), len(syms))
    st["equity"] = equity(st)
    st["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    (DATA / "paper.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))

    out = dict(generated=datetime.now(timezone.utc).isoformat(timespec="seconds"), ny_date=str(today), ny_time=hm(now), market=mkt, macro_today=macro,
               universe=len(syms), tradeable=len(tradeable), market_news=headlines("SPY", 6), candidates=cands, watch=watch_rows[:60],
               gainers=sorted(watch_rows, key=lambda r: -(r["chg_live"] or 0))[:10], paper_log=log, config=P, ntfy_topic=CFG.get("ntfy_topic"),
               backtest_summary=dict(date=bt.get("date"), net=bt.get("overall_net"), gross=bt.get("overall_gross"), best=bt.get("best", [])[:10],
                                     variants=bt.get("variants"), chosen=bt.get("chosen"), by_hour=bt.get("by_hour")) if bt else None,
               risk_now=risk_pct_now(st))
    (DATA / "scan.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    clean = sum(1 for c in cands if c["grade"] == "A+" and not c["blocked"])
    print(f"Evren {len(syms)} · süzülen {len(tradeable)} · aday {len(cands)} · temiz A+ {clean} · piyasa {mkt.get('regime')}")
    for line in log:
        print(" -", line)


if __name__ == "__main__":
    main()
