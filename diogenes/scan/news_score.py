"""Claude'un haber isabeti: sabah analizindeki her karar (olumlu / nötr / olumsuz / kaçın), risk bayrağı ve sektör görüşü
saklanır, sonra gerçekte ne olduğuyla puanlanır. Sistemin kararlarını değiştirmez; yalnız ölçer.

data/news_log.json: gün gün sabah analizi (ilk gelen sürüm) ve gün ortası güncellemesi.
Puan: hisse için o günün açılıştan kapanışa getirisi ve 3 günlük getiri, S&P 500'e göre fark.
"""
import json

import numpy as np
import pandas as pd

import scan as S

LOG = S.DATA / "news_log.json"
NIGHT = S.DATA / "night.json"


def archive():
    log = json.loads(LOG.read_text()) if LOG.exists() else {"days": {}}
    try:
        n = json.loads(NIGHT.read_text())
    except Exception:
        return log
    d = n.get("date")
    if not d:
        return log
    rec = dict(generated=n.get("generated"), risk_flag=n.get("risk_flag"), sectors=n.get("sectors"),
               stocks=[dict(symbol=x.get("symbol"), verdict=x.get("verdict"), sector=x.get("sector")) for x in n.get("stocks", []) if x.get("symbol")])
    day = log["days"].setdefault(d, {})
    if "morning" not in day:
        day["morning"] = rec
    elif rec["generated"] != day["morning"].get("generated"):
        day["midday"] = rec
    log["days"] = dict(sorted(log["days"].items())[-250:])
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=0))
    return log


def update(p):
    """p: lab panel (daily O/H/L/C frames). Returns the summary stored in lab.json."""
    log = archive()
    pos = {str(d.date()): k for k, d in enumerate(p.idx)}
    rows, flags, secs = [], [], []
    for d, day in log["days"].items():
        m = day.get("morning")
        k = pos.get(d)
        if not m or k is None:
            continue
        spy_d = float(p.C["SPY"].iloc[k] / p.O["SPY"].iloc[k] - 1) * 100
        k3 = min(k + 2, len(p.idx) - 1)
        spy_3 = float(p.C["SPY"].iloc[k3] / p.O["SPY"].iloc[k] - 1) * 100 if k + 2 < len(p.idx) else None
        flags.append(dict(date=d, flag=m.get("risk_flag"), spy=round(spy_d, 2)))
        for x in m["stocks"]:
            s = x["symbol"]
            if s not in p.C or np.isnan(p.O[s].iloc[k]):
                continue
            r1 = float(p.C[s].iloc[k] / p.O[s].iloc[k] - 1) * 100
            r3 = float(p.C[s].iloc[k3] / p.O[s].iloc[k] - 1) * 100 if spy_3 is not None else None
            rows.append(dict(date=d, sym=s, verdict=x.get("verdict") or "nötr", r1=r1, x1=r1 - spy_d, r3=r3, x3=(r3 - spy_3) if r3 is not None else None))
        for side in ("olumlu", "olumsuz"):
            for sec in (m.get("sectors") or {}).get(side) or []:
                etf = S.SECTOR_ETF.get(sec)
                if etf in p.C:
                    r = float(p.C[etf].iloc[k] / p.O[etf].iloc[k] - 1) * 100
                    secs.append(dict(side=side, sector=sec, x1=r - spy_d))
    out = dict(days=len(flags), n=len(rows), updated=str(p.idx[-1].date()))
    if rows:
        df = pd.DataFrame(rows)
        bv = {}
        for v, g in df.groupby("verdict"):
            g3 = g.dropna(subset=["x3"])
            bv[v] = dict(n=int(len(g)), day=round(float(g.r1.mean()), 2), pos=round(100 * float((g.r1 > 0).mean()), 0), excess=round(float(g.x1.mean()), 2),
                         excess3=round(float(g3.x3.mean()), 2) if len(g3) else None, n3=int(len(g3)))
        out["by_verdict"] = bv
        good, bad = bv.get("olumlu"), next((bv[k] for k in ("kaçın", "olumsuz") if k in bv), None)
        if good and good["n"] >= 30:
            out["verdict_text"] = (f"Claude'un 'olumlu' dediği hisseler o gün S&P 500'den ortalama {good['excess']:+.2f} puan "
                                   + ("iyi" if good["excess"] > 0 else "kötü") + f" gitti ({good['n']} karar).")
        else:
            out["verdict_text"] = f"Henüz {len(rows)} karar puanlandı; anlamlı bir sonuç için 'olumlu' kararlardan en az 30 tane gerekiyor."
    if flags:
        f = pd.DataFrame(flags)
        out["flags"] = {k: dict(n=int(len(g)), spy=round(float(g.spy.mean()), 2)) for k, g in f.groupby("flag")}
    if secs:
        sd = pd.DataFrame(secs)
        out["sectors"] = {k: dict(n=int(len(g)), excess=round(float(g.x1.mean()), 2)) for k, g in sd.groupby("side")}
    return out
