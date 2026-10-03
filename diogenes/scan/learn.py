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

LABELS = {
    "htf": "Günlük trend yukarı değil", "poi": "Giriş ucuz yarıda değil", "sweep": "Geri çekilmede süpürüp kapatma",
    "rr": "Ödül/risk düşük", "net_rr": "Komisyon sonrası ödül/risk düşük", "fee_share": "Komisyon riskin büyük payı",
    "regime": "Piyasa zayıf", "vwap": "Fiyat VWAP altında", "news": "Taze olumsuz haber", "gap": "Katalizörsüz büyük gap",
    "claude": "Claude haber analizi olumsuz", "atr_stop": "Stop günlük ATR'den geniş", "ev": "Beklenen değer ≤ 0",
    "rs": "Göreli güç (RS) düşük", "hour": "Saatin backtest beklentisi negatif", "shield": "Piyasa kalkanı aktif",
    "grade_a": "Derece A (A+ değil)", "grade_b": "Derece B", "invalid": "Fiyat OF dibinin altında (sert kural)",
    "earnings": "Bilanço günü (sert kural)", "fomc": "FOMC saati (sert kural)", "macro": "Veri saati bekleme (sert kural)",
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


def _step(x, bars):
    """Replays 5m bars on a shadow trade (same fill/stop/target rules as the paper engine)."""
    for ts, b in bars.iterrows():
        o, hi, lo, cl, tt = b["Open"], b["High"], b["Low"], b["Close"], S.hm(ts)
        if x["status"] == "pending":
            if str(ts.date()) != x["date"] or tt >= S.P["entry_end"] or cl < x["stop"] or (hi >= x["target"] and lo > x["entry"]):
                x.update(status="cancelled", note="Dolmadı")
                return
            if lo > x["entry"]:
                continue
            x.update(status="open", fill=S.r2(min(x["entry"], o), 4), fill_time=str(ts))
            if lo <= x["stop"]:
                _finish(x, x["stop"], ts, "Stop (aynı mum)")
                return
            continue
        if lo <= x["stop"]:
            _finish(x, o if o < x["stop"] else x["stop"], ts, "Stop")
            return
        if hi >= x["target"]:
            _finish(x, o if o > x["target"] else x["target"], ts, "Hedef")
            return
        if x.get("be") and not x.get("orig_stop") and hi >= x["fill"] + (x["fill"] - x["stop"]):
            x.update(orig_stop=x["stop"], stop=x["fill"])
        if tt >= S.P["flat_at"] or str(ts.date()) != x["date"]:
            _finish(x, cl, ts, "Gün sonu kapanış")
            return
    if len(bars):
        x["checked"] = str(bars.index[-1])


def _update(items, today):
    act = [x for x in items if x["status"] in ("pending", "open")]
    if not act:
        return
    raw = S.download(sorted({x["symbol"] for x in act}), period="5d", interval="5m", prepost=False)
    for x in act:
        m5 = S.rth(S.to_ny(S.split(raw, x["symbol"])))
        if m5.empty:
            if (today - pd.Timestamp(x["date"]).date()).days > 4:
                x.update(status="cancelled", note="Veri yok")
            continue
        _step(x, m5[m5.index > pd.Timestamp(x.get("checked") or x["created"])])
        if x["status"] == "open" and (today - pd.Timestamp(x["date"]).date()).days > 4:
            x.update(status="cancelled", note="Veri yok")


def _register(items, cands, st, now, today, equity):
    if not (S.P["entry_start"] <= S.hm(now) < S.P["entry_end"]) or now.weekday() >= 5:
        return
    seen = {(x["symbol"], x["formed"]) for x in items}
    traded = {(t["symbol"], t.get("formed")) for t in st["trades"]}
    cap = equity / S.P["max_active"]
    for c in cands:
        if c["status"] == "geçersiz" or (c["symbol"], c["formed"]) in seen:
            continue
        qty, risk = S.sizing(equity, c["entry"], c["stop"], S.P["risk_pct"], cap)
        if qty <= 0 or qty * c["entry"] < 5:
            continue
        x = dict(id=f"{c['symbol']}-{c['formed']}", symbol=c["symbol"], date=str(today), created=str(now), formed=c["formed"], tf=c["tf"],
                 grade=c["grade"], entry=c["entry"], stop=c["stop"], target=c["target"], rr=c["rr"], net_rr=c["net_rr"], qty=qty,
                 rs=c.get("rs"), relvol=c.get("relvol"), ev=c.get("ev"), be=bool(c.get("be")), keys=list(c.get("rule_keys") or []),
                 traded=(c["symbol"], c["formed"]) in traded, status="pending")
        if c["last"] and c["stop"] < c["last"] <= c["entry"]:
            x.update(status="open", fill=c["last"], fill_time=str(now))
        items.append(x)


def _stat(rs):
    n = len(rs)
    if not n:
        return dict(n=0, win=None, avg=None, total=0)
    return dict(n=n, win=round(100 * sum(1 for r in rs if r > 0) / n, 1), avg=round(sum(rs) / n, 3), total=round(sum(rs), 2))


def _report(items, st, equity):
    samples = []
    for x in items:
        if x["status"] == "closed" and x.get("net_r") is not None and not x.get("traded"):
            samples.append(dict(keys=set(x["keys"]), net_r=x["net_r"], src="gölge"))
    for t in st["trades"]:
        if t["status"] == "closed" and t.get("net_r") is not None:
            samples.append(dict(keys={v["key"] for v in t.get("violations") or []}, net_r=t["net_r"], src="gerçek"))
    allkeys = sorted({k for s in samples for k in s["keys"]})
    rules = []
    for k in allkeys:
        w = [s["net_r"] for s in samples if k in s["keys"]]
        wo = [s["net_r"] for s in samples if k not in s["keys"]]
        a, b = _stat(w), _stat(wo)
        if a["n"] < MIN_N or b["n"] < MIN_N:
            verdict = "veri az"
        elif a["avg"] < b["avg"] - EDGE:
            verdict = "koruyor"
        elif a["avg"] > b["avg"] + EDGE:
            verdict = "fırsat kaçırtıyor"
        else:
            verdict = "fark yok"
        rules.append(dict(key=k, label=LABELS.get(k, k), broken=a, kept=b, verdict=verdict))
    rules.sort(key=lambda r: -r["broken"]["n"])
    clean = [s["net_r"] for s in samples if not s["keys"]]
    real = [t for t in st["trades"] if t["status"] == "closed"]
    return dict(updated=datetime.now(timezone.utc).isoformat(timespec="seconds"), mode=S.MODE, min_n=MIN_N, edge=EDGE,
                samples=len(samples), real_closed=len(real), real=_stat([t.get("net_r") or 0 for t in real]),
                shadow_closed=sum(1 for x in items if x["status"] == "closed"),
                shadow_active=sum(1 for x in items if x["status"] in ("pending", "open")),
                clean=_stat(clean), everything=_stat([s["net_r"] for s in samples]), rules=rules,
                note="Net R, komisyon dahil. 'koruyor': kuralı çiğneyenler belirgin kötü. 'fırsat kaçırtıyor': çiğneyenler aynı ya da daha iyi. "
                     f"Her iki tarafta en az {MIN_N} kapanmış işlem olmadan karar verilmez. Ön bulgudur, kesin hüküm değildir.")


def run(st, cands, mkt, now, today):
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
    REPORT.write_text(json.dumps(_report(sh["items"], st, S.equity(st)), ensure_ascii=False, indent=1), encoding="utf-8")
