"""Öğrenme modu: gölge işlemler ve kural raporu.

Öğrenme modunda (config.json mode=learn) eski filtrelerin çoğu işlemi engellemez, yalnız etiket olur.
Bu modül iki şey yapar:
  1. Gölge işlem: taramada görülen her aday (gerçekten işleme girmese de) sanal olarak izlenir, aynı limit giriş,
     stop, hedef ve komisyonla sonuçlandırılır. Böylece "engellenseydi ne olurdu" sorusunun cevabı birikir.
  2. Rapor (data/learn.json): her kural için "kuralı çiğneyenler" ile "çiğnemeyenler" karşılaştırılır.
     Çiğneyenler belirgin kötüyse kural koruyordur, aynı ya da daha iyiyse fırsat kaçırtıyordur.
Gerçek emir yok; yalnız ölçüm. Aynı mumda stop ve hedef görülürse stop sayılır (kötümser).
"""
import json
from datetime import datetime, timedelta, timezone

import pandas as pd

import scan as S

SHADOW = S.DATA / "shadow.json"
REPORT = S.DATA / "learn.json"
KEEP_DAYS = 45
MIN_N = 15  # each side needs this many closed samples before a verdict is given
EDGE = 0.10  # net R difference that counts as a real gap
GOAL = 100

LABELS = {
    "htf": "Günlük trend yukarı değil", "poi": "Giriş ucuz yarıda değil", "sweep": "Geri çekilmede süpürüp kapatma",
    "rr": "Ödül/risk düşük", "net_rr": "Komisyon sonrası ödül/risk düşük", "fee_share": "Komisyon riskin büyük payı",
    "regime": "Piyasa zayıf", "vwap": "Fiyat VWAP altında", "news": "Taze olumsuz haber", "gap": "Katalizörsüz büyük gap",
    "claude": "Claude haber analizi olumsuz", "atr_stop": "Stop günlük ATR'den geniş", "ev": "Beklenen değer ≤ 0",
    "rs": "Göreli güç (RS) düşük", "hour": "Saatin backtest beklentisi negatif", "shield": "Piyasa kalkanı aktif",
    "grade_a": "Derece A (A+ değil)", "grade_b": "Derece B", "invalid": "Fiyat OF dibinin altında (sert kural)",
    "earnings": "Bilanço günü (sert kural)", "sector": "Aynı sektörde 2 pozisyon", "fomc": "FOMC saati (sert kural)", "macro": "Veri saati bekleme (sert kural)",
}


def _load():
    try:
        return json.loads(SHADOW.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def _finish(x, price, ts, why):
    stop0 = x.get("orig_stop") or x["stop"]
    fee = S.FEE2
    risk = (x["fill"] - stop0) * x["qty"] + fee
    pnl = (price - x["fill"]) * x["qty"] - fee
    x.update(status="closed", exit=S.r2(price, 4), exit_time=str(ts), note=why, pnl=S.r2(pnl),
             r=S.r2((price - x["fill"]) / (x["fill"] - stop0)) if x["fill"] > stop0 else 0,
             net_r=S.r2(pnl / risk) if risk > 0 else None)


EX_K = (0.8, 1.0, 1.25)


def _fill(x, price, ts):
    dist = price - x["stop"]
    x.update(status="open", fill=S.r2(price, 4), fill_time=str(ts), dist=S.r2(dist, 4), u=S.r2(dist * x["qty"], 4),
             ex={str(k): [0.0, False, 0.0] for k in EX_K})


def _ex(x, hi, lo, cl):
    """Excursions per stop multiple k: best R seen before that stop, whether it was stopped, latest R. Lets evolve.py score any
    target/stop combination without replaying bars (a bar touching the stop counts as stopped before any high: pessimistic)."""
    d = x.get("dist") or 0
    if d <= 0:
        return
    for k, e in x["ex"].items():
        if e[1]:
            continue
        if lo <= x["fill"] - float(k) * d:
            e[1] = True
        else:
            e[0] = round(max(e[0], (hi - x["fill"]) / d), 3)
            e[2] = round((cl - x["fill"]) / d, 3)


def _step(x, bars):
    """Replays 5m bars on a shadow trade (same fill/stop/target rules as the paper engine), then keeps the excursion
    record running until the session close."""
    for ts, b in bars.iterrows():
        o, hi, lo, cl, tt = b["Open"], b["High"], b["Low"], b["Close"], S.hm(ts)
        if x["status"] == "pending":
            if str(ts.date()) != x["date"] or tt >= S.P["entry_end"] or cl < x["stop"] or (hi >= x["target"] and lo > x["entry"]):
                x.update(status="cancelled", note="Dolmadı", ex_done=True)
                break
            if lo > x["entry"]:
                continue
            _fill(x, min(x["entry"], o), ts)
            if lo <= x["stop"]:
                _finish(x, x["stop"], ts, "Stop (aynı mum)")
            continue
        if str(ts.date()) != x["date"]:
            x["ex_done"] = True
            if x["status"] == "open":
                _finish(x, x.get("last_close") or x["fill"], ts, "Gün sonu kapanış")
            break
        if not x.get("ex_done"):
            _ex(x, hi, lo, cl)
        x["last_close"] = float(cl)
        if x["status"] == "open":
            if lo <= x["stop"]:
                _finish(x, o if o < x["stop"] else x["stop"], ts, "Stop")
            elif hi >= x["target"]:
                _finish(x, o if o > x["target"] else x["target"], ts, "Hedef")
            else:
                if x.get("be") and not x.get("orig_stop") and hi >= x["fill"] + (x["fill"] - x["stop"]):
                    x.update(orig_stop=x["stop"], stop=x["fill"])
                if tt >= S.P["flat_at"]:
                    _finish(x, cl, ts, "Gün sonu kapanış")
        if tt >= S.P["flat_at"]:
            x["ex_done"] = True
        if x["status"] != "open" and x.get("ex_done"):
            break
    if len(bars):
        x["checked"] = str(bars.index[-1])


def _active(x):
    return x["status"] in ("pending", "open") or bool(x.get("fill") and not x.get("ex_done"))


def _update(items, today):
    act = [x for x in items if _active(x)]
    if not act:
        return
    raw = S.download(sorted({x["symbol"] for x in act}), period="5d", interval="5m", prepost=False)
    for x in act:
        m5 = S.rth(S.to_ny(S.split(raw, x["symbol"])))
        if not m5.empty:
            _step(x, m5[m5.index > pd.Timestamp(x.get("checked") or x["created"])])
        if _active(x) and (today - pd.Timestamp(x["date"]).date()).days > 4:
            x.update(ex_done=True, note=x.get("note") or "Veri yok")
            if x["status"] != "closed":
                x["status"] = "cancelled"


def _register(items, cands, st, now, today, equity):
    """Every intraday candidate of every book becomes a shadow trade (swing books learn from real trades and lab)."""
    if not (S.P["entry_start"] <= S.hm(now) < S.P["entry_end"]) or now.weekday() >= 5:
        return
    seen = {(x["symbol"], x["formed"]) for x in items}
    traded = {(t["symbol"], t.get("formed")) for t in st["trades"]}
    cap = equity / S.P["max_active"]
    for c in cands:
        if c.get("horizon", "gün") != "gün" or c.get("status") == "geçersiz" or (c["symbol"], c["formed"]) in seen:
            continue
        qty, risk = S.sizing(equity, c["entry"], c["stop"], S.P["risk_pct"], cap)
        if qty <= 0 or qty * c["entry"] < 5:
            continue
        x = dict(id=f"{c['symbol']}-{c['formed']}", symbol=c["symbol"], book=c.get("book", "of"), date=str(today), created=str(now),
                 formed=c["formed"], grade=c.get("grade"), entry=c["entry"], stop=c["stop"], target=c["target"], rr=c.get("rr"),
                 qty=qty, rs=c.get("rs"), relvol=c.get("relvol"), be=bool(c.get("be")), keys=list(c.get("rule_keys") or []),
                 traded=(c["symbol"], c["formed"]) in traded, status="pending")
        seen.add((c["symbol"], c["formed"]))
        if c.get("order") == "market" or (c.get("last") and c["stop"] < c["last"] <= c["entry"]):
            _fill(x, c.get("last") or c["entry"], now)
        items.append(x)


def _stat(rs):
    n = len(rs)
    if not n:
        return dict(n=0, win=None, avg=None, total=0)
    return dict(n=n, win=round(100 * sum(1 for r in rs if r > 0) / n, 1), avg=round(sum(rs) / n, 3), total=round(sum(rs), 2))


def _verdict(a, b):
    if a["n"] < MIN_N or b["n"] < MIN_N:
        return "veri az"
    if a["avg"] < b["avg"] - EDGE:
        return "koruyor"
    if a["avg"] > b["avg"] + EDGE:
        return "fırsat kaçırtıyor"
    return "fark yok"


def _rules(samples):
    out = []
    for k in sorted({k for s in samples for k in s["keys"]}):
        a = _stat([s["net_r"] for s in samples if k in s["keys"]])
        b = _stat([s["net_r"] for s in samples if k not in s["keys"]])
        out.append(dict(key=k, label=LABELS.get(k, k), broken=a, kept=b, verdict=_verdict(a, b)))
    out.sort(key=lambda r: -r["broken"]["n"])
    return out


def wilson(w, n, z=1.96):
    if not n:
        return None, None
    p = w / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * ((p * (1 - p) + z * z / (4 * n)) / n) ** 0.5 / (1 + z * z / n)
    return round((c - h) * 100, 1), round((c + h) * 100, 1)


def progress(st):
    """Goal A: 100 closed paper trades with ≥ 60% winners AND positive net after fees."""
    cl = [t for t in st["trades"] if t["status"] == "closed"]
    n, w = len(cl), sum(1 for t in cl if (t.get("pnl") or 0) > 0)
    lo, hi = wilson(w, n)
    net = round(sum(t.get("pnl") or 0 for t in cl), 2)
    win = round(100 * w / n, 1) if n else None
    return dict(n=n, goal=GOAL, win=win, wilson_lo=lo, wilson_hi=hi, net=net, net_r=round(sum(t.get("net_r") or 0 for t in cl), 2),
                net_600=round(sum(t.get("pnl_600") or 0 for t in cl), 2), win_ok=bool(win is not None and win >= 60), net_ok=net > 0,
                criteria_met=bool(n >= GOAL and win >= 60 and net > 0))


def _report(items, st, equity):
    samples = []
    for x in items:
        if x["status"] == "closed" and x.get("net_r") is not None and not x.get("traded"):
            samples.append(dict(keys=set(x["keys"]), net_r=x["net_r"], book=x.get("book", "of"), src="gölge"))
    for t in st["trades"]:
        if t["status"] == "closed" and t.get("net_r") is not None:
            samples.append(dict(keys={v["key"] for v in t.get("violations") or []}, net_r=t["net_r"], book=t.get("book", "of"), src="gerçek"))
    by_book = {}
    for b in sorted({s["book"] for s in samples}):
        ss = [s for s in samples if s["book"] == b]
        by_book[b] = dict(stat=_stat([s["net_r"] for s in ss]), real=_stat([s["net_r"] for s in ss if s["src"] == "gerçek"]), rules=_rules(ss))
    clean = [s["net_r"] for s in samples if not s["keys"]]
    real = [t for t in st["trades"] if t["status"] == "closed"]
    return dict(updated=datetime.now(timezone.utc).isoformat(timespec="seconds"), mode=S.MODE, min_n=MIN_N, edge=EDGE,
                samples=len(samples), real_closed=len(real), real=_stat([t.get("net_r") or 0 for t in real]),
                shadow_closed=sum(1 for x in items if x["status"] == "closed"),
                shadow_active=sum(1 for x in items if x["status"] in ("pending", "open")),
                clean=_stat(clean), everything=_stat([s["net_r"] for s in samples]), rules=_rules(samples), by_book=by_book,
                progress=progress(st),
                note="Net R, komisyon dahil. 'koruyor': kuralı çiğneyenler belirgin kötü. 'fırsat kaçırtıyor': çiğneyenler aynı ya da daha iyi. "
                     f"Her iki tarafta en az {MIN_N} kapanmış işlem olmadan karar verilmez. Ön bulgudur, kesin hüküm değildir.")


def _milestones(st, pr):
    for m in (25, 50, 75, 100):
        if pr["n"] >= m:
            msg = (f"{pr['n']} işlem · kazanma %{pr['win']} (%95 aralık {pr['wilson_lo']}–{pr['wilson_hi']}) {'✓' if pr['win_ok'] else '✗'} · "
                   f"net {pr['net']:+.2f} $ {'✓' if pr['net_ok'] else '✗'} · 600 $ hesapla {pr['net_600']:+.2f} $")
            if m == GOAL:
                msg += "\nKriter A " + ("TUTTU. Gerçek paraya geçiş yalnız senin onayınla." if pr["criteria_met"] else "tutmadı; öğrenme sürüyor.")
            S.alert_once(st, f"milestone-{m}", f"Diogenes {m}. işlem raporu", msg, ["trophy" if pr["criteria_met"] else "bar_chart"], 4)


def run(st, cands, mkt, now, today):
    """-> (shadow items, report). Called by scan.py on every run after the paper engine."""
    sh = _load()
    items = sh["items"]
    _update(items, today)
    shield = mkt.get("regime") in ("zayıf", "düşüş")
    if shield:  # the shield is not a candidate rule, so tag it here for every candidate registered in this run
        for c in cands:
            c.setdefault("rule_keys", [])
            if "shield" not in c["rule_keys"]:
                c["rule_keys"].append("shield")
    _register(items, cands, st, now, today, S.equity(st))
    cutoff = str(today - timedelta(days=KEEP_DAYS))
    sh["items"] = [x for x in items if x["date"] >= cutoff]
    SHADOW.write_text(json.dumps(sh, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    rep = _report(sh["items"], st, S.equity(st))
    REPORT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    _milestones(st, rep["progress"])
    return sh["items"], rep
