"""Oyun kitapları: her biri aynı biçimde aday üretir, günün 3 hakkını evolve.py paylaştırır.

Aday biçimi (ortak):
  book, symbol, entry, stop, target, horizon ("gün" | "swing"), max_days, order ("limit" | "market"),
  score (kitap içi sıralama), rule_keys (çiğnenen kurallar), exit_rule (swing), sector, last

Gün içi kitaplar 15 dk mumlarla (scan.py'nin indirdiği m15map) ve anlık fiyatla çalışır; tetik anı "şimdi" olduğu için
piyasa fiyatından girer. Order flow kitabı (of) scan.py'nin mevcut adaylarıdır ve limit emir kullanır.
Swing kitapları lab.py'nin her akşam yazdığı "yarın açılışta al" listesinden (lab.json → pending) gelir; kural tek yerde kalır.
Öğrenme amaçlıdır, gerçek emir yoktur.
"""
import json

import pandas as pd

import scan as S

BOOKS = {
    "of": dict(name="Order flow geri çekilmesi", who="Baştan Sona Trade kodeksi", horizon="gün", lab=None),
    "vwap": dict(name="VWAP geri alımı", who="Brian Shannon", horizon="gün", lab=None),
    "orb": dict(name="15 dk açılış aralığı kırılımı", who="Andrew Aziz · Zarattini & Aziz", horizon="gün", lab="aziz_orb"),
    "cat": dict(name="Haber / gap katalizörü", who="Kullamägi EP · Ross Cameron", horizon="gün", lab=None),
    "rev": dict(name="Gün içi aşırı satım dönüşü", who="Larry Connors", horizon="gün", lab=None),
    "bnf": dict(name="BNF sapma oranı", who="Takashi Kotegawa", horizon="swing", lab="bnf_ders"),
    "rsi2": dict(name="RSI(2) geri alım", who="Larry Connors", horizon="swing", lab="connors_ders"),
}
SWING_DAYS = 5
DEFAULT = dict(target_r=1.5, stop_k=1.0)


def _rsi(c, n=2):
    d = c.diff()
    up, dn = d.clip(lower=0), (-d).clip(lower=0)
    rs = up.ewm(alpha=1 / n, adjust=False).mean() / dn.ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + rs)


def _apply(entry, stop, params, target=None):
    """Book parameters from evolve.py: stop distance × stop_k; target = target_r × distance once tuned (or when the book has no own target)."""
    p = params or {}
    dist = (entry - stop) * (p.get("stop_k") or 1.0)
    if dist <= 0:
        return None
    if p.get("tuned") or target is None:
        target = entry + (p.get("target_r") or DEFAULT["target_r"]) * dist
    return S.r2(entry - dist), S.r2(target)


def _cand(book, sym, entry, stop, target, score, uni, last, horizon="gün", order="market", formed=None, **kw):
    if not (stop < entry < target):
        return None
    return dict(book=book, symbol=sym, entry=S.r2(entry), stop=S.r2(stop), target=S.r2(target), horizon=horizon, order=order,
                max_days=SWING_DAYS if horizon == "swing" else 1, score=round(float(score), 3), last=S.r2(last),
                rr=S.r2((target - entry) / (entry - stop)), sector=(uni.get(sym) or {}).get("sector"), name=(uni.get(sym) or {}).get("name"),
                formed=formed, tf=kw.pop("tf", "15dk"), grade=kw.pop("grade", "B"),
                status="tetik", blocked=[], violations=[], rule_keys=[], **kw)


def _ctx(sym, m15map, d1map, live, today):
    m15, d1 = m15map.get(sym), d1map.get(sym)
    if m15 is None or d1 is None or m15.empty or len(d1) < 60:
        return None
    td = m15[m15.index.date == today]
    if len(td) < 2:
        return None
    done = td.iloc[:-1]  # the last 15m bar is still forming
    prev = d1[d1.index.date < today]
    if prev.empty:
        return None
    pc = float(prev["Close"].iloc[-1])
    last = float(live.get(sym, td["Close"].iloc[-1]))
    vw = S.session_vwap(td)
    rng = (m15["High"] - m15["Low"]).iloc[-21:-1]
    a15 = float(rng.mean()) if len(rng) else None
    cl = d1["Close"]
    htf = bool(cl.iloc[-1] > S.ema(cl, 50).iloc[-1] and S.ema(cl, 20).iloc[-1] > S.ema(cl, 50).iloc[-1])
    return dict(m15=m15, td=td, done=done, pc=pc, last=last, vw=vw, a15=a15, htf=htf, gap=float(td["Open"].iloc[0] / pc - 1) * 100,
                rv=S.relvol_now(m15, today))


def orb(sym, x, now, uni, params):
    if not ("09:45" <= S.hm(now) < "11:30") or (x["rv"] or 0) < 2 or x["gap"] < 1:
        return None
    first = x["td"].iloc[0]
    h, l, last = float(first["High"]), float(first["Low"]), x["last"]
    if not (h < last <= h + 0.5 * (h - l)):
        return None
    lv = _apply(last, max(l, last * 0.97), params)
    return lv and _cand("orb", sym, last, lv[0], lv[1], x["rv"], uni, last, gap=S.r2(x["gap"]), relvol=S.r2(x["rv"]))


def vwap(sym, x, now, uni, params):
    if not ("10:00" <= S.hm(now) < "14:30") or not x["htf"] or not x["vw"] or not x["a15"] or len(x["done"]) < 3:
        return None
    vw, bar, last = x["vw"], x["done"].iloc[-1], x["last"]
    if float(x["done"]["High"].max()) < vw * 1.01:  # needs a trend day: price already ran ≥ 1% above VWAP
        return None
    if not (float(bar["Low"]) <= vw * 1.003 and float(bar["Close"]) > vw and last > vw):
        return None
    lv = _apply(last, min(float(bar["Low"]), vw) - 0.25 * x["a15"], params)
    return lv and _cand("vwap", sym, last, lv[0], lv[1], (last / vw - 1) * -100 + (x["rv"] or 1), uni, last, vwap=S.r2(vw), relvol=S.r2(x["rv"]))


def cat(sym, x, now, uni, params, news_of):
    if not ("09:45" <= S.hm(now) < "13:00") or x["gap"] < 3 or (x["rv"] or 0) < 2 or not x["vw"] or not x["a15"] or len(x["done"]) < 2:
        return None
    last = x["last"]
    if last <= x["vw"] or last < float(x["done"]["High"].max()):  # above VWAP and breaking the high of day
        return None
    why = news_of(sym)
    if not why:
        return None
    stop = min(last - 0.5 * x["a15"], max(x["vw"], last - 2 * x["a15"]))
    lv = _apply(last, stop, params)
    return lv and _cand("cat", sym, last, lv[0], lv[1], x["gap"] * x["rv"], uni, last, catalyst=why, gap=S.r2(x["gap"]), relvol=S.r2(x["rv"]))


def rev(sym, x, now, uni, params):
    if not ("10:00" <= S.hm(now) < "14:30") or not x["htf"] or not x["vw"] or not x["a15"] or len(x["done"]) < 4:
        return None
    c = x["m15"]["Close"].iloc[:-1]
    r = _rsi(c)
    b1, b2 = x["done"].iloc[-1], x["done"].iloc[-2]
    last = x["last"]
    if not (r.iloc[-2] < 10 and float(b1["Close"]) > float(b2["High"]) and last < x["vw"] - 1.0 * x["a15"]):
        return None
    stop = float(x["done"]["Low"].iloc[-3:].min()) - 0.1 * x["a15"]
    if last <= stop or (x["vw"] - last) / (last - stop) < 0.8:
        return None
    lv = _apply(last, stop, params, target=x["vw"])
    return lv and _cand("rev", sym, last, lv[0], lv[1], (x["vw"] - last) / x["a15"], uni, last, vwap=S.r2(x["vw"]))


def swing(today, d1map, live, uni, now):
    """Next-open orders written by lab.py after yesterday's close (BNF + lesson, Connors RSI(2) + lesson)."""
    if not ("09:35" <= S.hm(now) < "12:00"):
        return []
    try:
        lab = json.loads((S.DATA / "lab.json").read_text(encoding="utf-8"))
    except Exception:
        return []
    by_id = {s["id"]: s for s in lab.get("strategies", [])}
    out = []
    for book in ("bnf", "rsi2"):
        lid = BOOKS[book]["lab"]
        st = by_id.get(lid) or by_id.get(lid.replace("_ders", ""))
        for p in (st or {}).get("pending") or []:
            sym, d1 = p.get("sym"), d1map.get(p.get("sym"))
            if d1 is None or d1.empty or sym not in live:
                continue
            prev = d1[d1.index.date < today]
            if prev.empty or p.get("sig") != str(prev.index[-1].date()):  # only yesterday's signals
                continue
            last = float(live[sym])
            if book == "bnf":
                stop, target, rule = last * 0.90, float(prev["Close"].iloc[-25:].mean()) * 0.97, None
            else:
                stop, target, rule = last * 0.93, last * 1.25, "s5up"  # RSI(2) exits on a close above the 5-day average
            c = _cand(book, sym, last, stop, target, -(p.get("i") or 0), uni, last, horizon="swing", exit_rule=rule,
                      formed=f"{book}-{p.get('sig')}", tf="1g", lab_signal=p.get("sig"))
            if c:
                out.append(c)
    return out


def generate(tradeable, m15map, d1map, live, uni, now, today, params, news_of, of_cands):
    """All books' candidates for this run: {book: [cand, ...]} sorted by score (best first)."""
    out = {b: [] for b in BOOKS}
    for c in of_cands:
        c = dict(c, book="of", horizon="gün", order="limit", max_days=1, score=c.get("score_rank") or 0)
        pr = params.get("of") or {}
        if pr.get("tuned"):
            lv = _apply(c["entry"], c["stop"], pr)
            if lv:
                c["stop"], c["target"] = lv
        out["of"].append(c)
    for sym in tradeable:
        if (uni.get(sym) or {}).get("sector") == "ETF" or sym in ("SPY", "QQQ", "IWM"):
            continue
        x = _ctx(sym, m15map, d1map, live, today)
        if not x:
            continue
        for b, fn in (("orb", orb), ("vwap", vwap), ("rev", rev)):
            try:
                c = fn(sym, x, now, uni, params.get(b))
            except Exception as e:
                print(f"{b} {sym}: {e}")
                c = None
            if c:
                out[b].append(dict(c, formed=f"{b}-{today}"))
        try:
            c = cat(sym, x, now, uni, params.get("cat"), news_of)
        except Exception as e:
            print(f"cat {sym}: {e}")
            c = None
        if c:
            out["cat"].append(dict(c, formed=f"cat-{today}"))
    for c in swing(today, d1map, live, uni, now):
        out[c["book"]].append(c)
    for b in out:
        out[b].sort(key=lambda c: -c["score"])
        out[b] = out[b][:8]
    return out
