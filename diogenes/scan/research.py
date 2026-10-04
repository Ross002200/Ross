"""Hafta sonu araştırması: Claude'un önerdiği kural fikirlerini lab verisinde sınar, geçenleri oyun kitabı adayı yapar.

Girdi: data/research_in.json (Claude rutini → ntfy → relay.py). Fikirler kısıtlı bir JSON kural dilindedir; kod çalıştırılmaz.
  rule = {"when": [[özellik, op, sayı | özellik], ...], "entry": "next_open", "stop_pct": 2-12,
          "target": {"pct": x} | {"r": x} | {"exit": "close_above_sma5"}, "max_days": 1-5}
Çıktı: data/research.json
  weeks:    haftanın değerlendirmesi, fikirler ve test sonuçları (ret nedeniyle)
  active:   sınavı geçen fikirler (en fazla 6), canlı sinyalleri (pending) ve sonuçları
  feedback: Claude'un gelecek hafta okuyacağı geri bildirim (ret nedenleri, aktif fikirlerin canlı sonucu)

python research.py --test   yeni girdi varsa fikirleri sınar (hafta sonu)
python research.py --live   aktif fikirlerin son kapanış sinyallerini yazar (hafta içi, lab'dan sonra)
Kabul: öğrenme ve sınavda ≥ 30'ar işlem, ikisinde de işlem başı net > 0, sınav p değeri Holm düzeltmesiyle < 0,10.
"""
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import scan as S  # noqa: E402

IN = S.DATA / "research_in.json"
OUT = S.DATA / "research.json"
MAX_IDEAS, MAX_ACTIVE, MIN_TRADES, P_MAX = 5, 6, 30, 0.10
RETIRE_N = 20
OPS = {"<", "<=", ">", ">=", "cross_above", "cross_below"}
FEATURES = ["close", "open", "sma5", "sma10", "sma20", "sma25", "sma50", "sma150", "sma200", "ema10", "ema20", "ema50", "rsi2", "rsi14",
            "atr_pct", "rv", "gap", "ret1", "ret5", "ret20", "ret63", "rs", "dev25", "hi252_dist", "adr"]


def _id(s):
    return re.sub(r"[^a-z0-9_]", "", re.sub(r"\s+", "_", str(s).lower()))[:24] or "fikir"


def validate(rule):
    """-> list of problems (empty = valid)."""
    bad = []
    if not isinstance(rule, dict):
        return ["kural bir nesne değil"]
    extra = set(rule) - {"when", "entry", "stop_pct", "target", "max_days"}
    if extra:
        bad.append(f"bilinmeyen alan: {', '.join(sorted(extra))}")
    when = rule.get("when")
    if not isinstance(when, list) or not 1 <= len(when) <= 6:
        bad.append("when 1-6 koşul listesi olmalı")
        when = []
    for c in when:
        if not (isinstance(c, list) and len(c) == 3):
            bad.append(f"koşul [özellik, op, değer] olmalı: {c}")
            continue
        f, op, v = c
        if f not in FEATURES:
            bad.append(f"bilinmeyen özellik: {f}")
        if op not in OPS:
            bad.append(f"bilinmeyen op: {op}")
        if isinstance(v, str) and v not in FEATURES:
            bad.append(f"bilinmeyen özellik: {v}")
        if not isinstance(v, (int, float, str)) or isinstance(v, bool):
            bad.append(f"değer sayı ya da özellik olmalı: {v}")
        if op.startswith("cross") and not isinstance(v, str):
            bad.append(f"{op} bir özellikle karşılaştırılmalı")
    if rule.get("entry", "next_open") != "next_open":
        bad.append("entry yalnız next_open olabilir")
    sp = rule.get("stop_pct")
    if not isinstance(sp, (int, float)) or not 2 <= sp <= 12:
        bad.append("stop_pct 2-12 arası olmalı")
    t = rule.get("target")
    if not (isinstance(t, dict) and len(t) == 1 and (
            (isinstance(t.get("pct"), (int, float)) and 1 <= t["pct"] <= 40) or (isinstance(t.get("r"), (int, float)) and 0.5 <= t["r"] <= 5)
            or t.get("exit") == "close_above_sma5")):
        bad.append("target {pct: 1-40} | {r: 0.5-5} | {exit: close_above_sma5} olmalı")
    md = rule.get("max_days")
    if not isinstance(md, int) or not 1 <= md <= 5:
        bad.append("max_days 1-5 arası tam sayı olmalı")
    return bad


def frames(p):
    """Feature name -> wide frame (dates × symbols), built from the lab panel."""
    import lab
    C = p.C
    r2 = pd.DataFrame({s: lab.rsi(C[s], 2) for s in C.columns})
    r14 = pd.DataFrame({s: lab.rsi(C[s], 14) for s in C.columns})
    return {"close": C, "open": p.O, "sma5": p.s5, "sma10": lab.sma(C, 10), "sma20": lab.sma(C, 20), "sma25": p.s25, "sma50": p.s50,
            "sma150": p.s150, "sma200": p.s200, "ema10": p.e10, "ema20": p.e20, "ema50": p.e50, "rsi2": r2, "rsi14": r14, "atr_pct": p.atrp,
            "rv": p.rv, "gap": (p.O / C.shift(1) - 1) * 100, "ret1": (C / C.shift(1) - 1) * 100, "ret5": (C / C.shift(5) - 1) * 100,
            "ret20": (C / C.shift(20) - 1) * 100, "ret63": (C / C.shift(63) - 1) * 100, "rs": p.rs, "dev25": (C / p.s25 - 1) * 100,
            "hi252_dist": (C / p.hi252 - 1) * 100, "adr": p.adr}


def mask(rule, F):
    m = None
    for f, op, v in rule["when"]:
        a = F[f]
        b = F[v] if isinstance(v, str) else v
        if op == "<":
            x = a < b
        elif op == "<=":
            x = a <= b
        elif op == ">":
            x = a > b
        elif op == ">=":
            x = a >= b
        elif op == "cross_above":
            x = (a > b) & (a.shift(1) <= b.shift(1))
        else:
            x = (a < b) & (a.shift(1) >= b.shift(1))
        m = x if m is None else (m & x)
    return m.fillna(False)


def trades(p, rule, F=None):
    import lab
    F = F or frames(p)
    sp = rule["stop_pct"] / 100
    t = rule["target"]
    trail = "s5up" if t.get("exit") == "close_above_sma5" else None
    if "pct" in t:
        tgt = lambda e, st, x=t["pct"]: e * (1 + x / 100)
    elif "r" in t:
        tgt = lambda e, st, x=t["r"]: e + x * (e - st)
    else:
        tgt = None
    return lab.run_signals(p, mask(rule, F), lambda s, i: dict(entry="open", stop=lambda e, j: e * (1 - sp), target=tgt, trail=trail,
                                                                max_hold=rule["max_days"]))


def holm_p(ps):
    """{id: p} -> {id: Holm-adjusted p}."""
    order = sorted((v, k) for k, v in ps.items() if v is not None)
    m, run, out = len(order), 0.0, {}
    for k, (v, i) in enumerate(order):
        run = max(run, min(1.0, (m - k) * v))
        out[i] = round(run, 4)
    return out


def _load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def accept(res):
    """Acceptance on test results already Holm-adjusted: res = {learn, test, p_holm}."""
    L, T = res["learn"], res["test"]
    why = []
    if (L.get("n") or 0) < MIN_TRADES or (T.get("n") or 0) < MIN_TRADES:
        why.append(f"az işlem (öğrenme {L.get('n') or 0}, sınav {T.get('n') or 0}; en az {MIN_TRADES})")
    if (L.get("exp") or 0) <= 0:
        why.append(f"öğrenme döneminde eksi ({L.get('exp')} $/işlem)")
    if (T.get("exp") or 0) <= 0:
        why.append(f"sınav döneminde eksi ({T.get('exp')} $/işlem)")
    if res.get("p_holm") is None:
        why.append("anlamlılık hesaplanamadı (sınav işlemleri 4'ten az aya yığılmış ya da 20'den az)")
    elif res["p_holm"] >= P_MAX:
        why.append(f"istatistiksel olarak zayıf (Holm p {res['p_holm']} ≥ {P_MAX})")
    return not why, why


def add_active(R, idea, res, today):
    R.setdefault("active", [])
    R["active"] = [a for a in R["active"] if a["id"] != idea["id"]]
    R["active"].append(dict(id=idea["id"], name=idea["name"], source=idea.get("source"), thesis=idea.get("thesis"), rule=idea["rule"],
                            test=res["test"], learn=res["learn"], p_holm=res["p_holm"], added=str(today), status="aktif", pending=[]))
    out = []
    if len(R["active"]) > MAX_ACTIVE:  # keep the strongest: drop the lowest test expectancy
        R["active"].sort(key=lambda a: -(a["test"].get("exp") or 0))
        out = R["active"][MAX_ACTIVE:]
        R["active"] = R["active"][:MAX_ACTIVE]
    return out


def retire(R, paper):
    """Active ideas whose live paper trades are net negative after RETIRE_N trades are retired."""
    gone = []
    for a in list(R.get("active") or []):
        rs = [t.get("net_r") or 0 for t in paper.get("trades", []) if t.get("book") == f"r_{a['id']}" and t["status"] == "closed"]
        a["live"] = dict(n=len(rs), avg=round(sum(rs) / len(rs), 3) if rs else None, win=round(100 * sum(1 for r in rs if r > 0) / len(rs), 1) if rs else None)
        if len(rs) >= RETIRE_N and sum(rs) / len(rs) < 0:
            R["active"].remove(a)
            R.setdefault("retired", []).append(dict(a, status="emekli", retired=str(datetime.now(timezone.utc).date())))
            gone.append(a)
    return gone


def _log_change(ev, today, book, name, what, old, new, why, n):
    ev.setdefault("changes", []).append(dict(date=str(today), book=book, name=name, what=what, old=old, new=new, why=why, n=n))
    S.notify(f"Diogenes araştırması: {name}", f"{what}: {old} → {new}\n{why}", ["books"], 3)


def feedback(R):
    last = (R.get("weeks") or [{}])[-1]
    return dict(rejected=[dict(id=i["id"], name=i["name"], why=i.get("why")) for i in last.get("ideas", []) if i.get("status") != "kabul"],
                accepted=[i["id"] for i in last.get("ideas", []) if i.get("status") == "kabul"],
                active=[dict(id=a["id"], name=a["name"], test_win=a["test"].get("win"), test_exp=a["test"].get("exp"), live=a.get("live")) for a in R.get("active", [])],
                features=FEATURES, ops=sorted(OPS), rules="max 5 fikir/hafta; swing ≤ 5 gün; kabul: öğrenme+sınav ≥30 işlem, ikisi de artı, Holm p < 0,10")


def test_week(p=None):
    inp = _load(IN, None)
    R = _load(OUT, {"weeks": [], "active": []})
    if not inp or not inp.get("ideas"):
        print("research: yeni girdi yok")
        return R
    if R.get("tested_from") == inp.get("generated"):
        print("research: bu girdi zaten sınandı")
        return R
    import lab
    if p is None:
        d1, uni = lab.load()
        close = d1.xs("Close", axis=1, level=1)
        while len(close) and close.iloc[-1].notna().mean() < 0.5:
            d1, close = d1.iloc[:-1], close.iloc[:-1]
        cols = sorted(set(c[0] for c in d1.columns))
        syms = [s for s in cols if s not in lab.ETFS and not s.startswith("^") and (uni.get(s) or {}).get("sector") != "ETF" and d1[s]["Close"].notna().sum() > 260]
        p = lab.panel(d1, syms)
    split = p.idx[(210 + len(p.idx)) // 2]
    F = frames(p)
    today = datetime.now(timezone.utc).date()
    ideas, ps = [], {}
    seen = set()
    for raw in (inp.get("ideas") or [])[:MAX_IDEAS]:
        idea = dict(id=_id(raw.get("id") or raw.get("name")), name=str(raw.get("name") or raw.get("id"))[:80], source=raw.get("source"),
                    thesis=str(raw.get("thesis") or "")[:600], rule=raw.get("rule"))
        if idea["id"] in seen:
            idea["id"] += f"_{len(seen)}"
        seen.add(idea["id"])
        bad = validate(idea["rule"])
        if bad:
            ideas.append(dict(idea, status="ret", why=bad))
            continue
        try:
            ts = [t for t in trades(p, idea["rule"], F) if t.get("exit_d")]
        except Exception as e:
            ideas.append(dict(idea, status="ret", why=[f"test hatası: {e}"]))
            continue
        learn = [t for t in ts if pd.Timestamp(t["sig"]) < split]
        test = [t for t in ts if pd.Timestamp(t["sig"]) >= split]
        res = dict(learn=lab.stats(learn), test=lab.stats(test), sig=lab.significance(test))
        ps[idea["id"]] = (res["sig"] or {}).get("p")
        ideas.append(dict(idea, status="sınandı", res=res))
    adj = holm_p(ps)
    ev = None
    try:
        import evolve
        ev = evolve.load()
    except Exception:
        pass
    for i in ideas:
        if i["status"] != "sınandı":
            continue
        i["res"]["p_holm"] = adj.get(i["id"])
        ok, why = accept(i["res"])
        i["status"], i["why"] = ("kabul", []) if ok else ("ret", why)
        if ok:
            dropped = add_active(R, i, i["res"], today)
            if ev is not None:
                t = i["res"]["test"]
                _log_change(ev, today, f"r_{i['id']}", i["name"], "Yeni oyun kitabı", "araştırma fikri", "aktif",
                            f"sınav: {t.get('n')} işlem, %{t.get('win')} kazanma, {t.get('exp')} $/işlem, Holm p {i['res']['p_holm']}", t.get("n") or 0)
                for d in dropped:
                    _log_change(ev, today, f"r_{d['id']}", d["name"], "Oyun kitabı çıktı", "aktif", "yer açıldı", "en fazla 6 aktif fikir; sınav beklentisi en düşük", 0)
    R.setdefault("weeks", []).append(dict(week=inp.get("week"), generated=inp.get("generated"), review=inp.get("review"), reading=inp.get("reading"),
                                          ideas=[{k: v for k, v in i.items()} for i in ideas]))
    R["weeks"] = R["weeks"][-12:]
    R["tested_from"] = inp.get("generated")
    R["feedback"] = feedback(R)
    R["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    OUT.write_text(json.dumps(R, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    if ev is not None:
        evolve.save(ev)
    n_ok = sum(1 for i in ideas if i["status"] == "kabul")
    S.notify("Hafta sonu araştırması sınandı", f"{len(ideas)} fikir · {n_ok} kabul · aktif {len(R.get('active', []))}", ["microscope"], 3)
    print(f"research: {len(ideas)} fikir, {n_ok} kabul")
    return R


def live(p=None):
    """Weeknights after the lab: signals of active ideas on the last close become tomorrow's open orders (books.swing)."""
    R = _load(OUT, None)
    if not R or not R.get("active"):
        print("research: aktif fikir yok")
        return
    paper = _load(S.DATA / "paper.json", {"trades": []})
    gone = retire(R, paper)
    import lab
    if p is None:
        d1, uni = lab.load()
        close = d1.xs("Close", axis=1, level=1)
        while len(close) and close.iloc[-1].notna().mean() < 0.5:
            d1, close = d1.iloc[:-1], close.iloc[:-1]
        cols = sorted(set(c[0] for c in d1.columns))
        syms = [s for s in cols if s not in lab.ETFS and not s.startswith("^") and (uni.get(s) or {}).get("sector") != "ETF" and d1[s]["Close"].notna().sum() > 260]
        p = lab.panel(d1, syms)
    F = frames(p)
    last = p.idx[-1]
    for a in R["active"]:
        m = (mask(a["rule"], F) & p.liquid).fillna(False)
        row = m.iloc[-1]
        a["pending"] = [dict(sym=s, sig=str(last.date())) for s in row.index[row.values]][:10]
    if gone:
        try:
            import evolve
            ev = evolve.load()
            for g in gone:
                _log_change(ev, last.date(), f"r_{g['id']}", g["name"], "Oyun kitabı emekli", "aktif", "emekli",
                            f"canlıda {g['live']['n']} işlem, ort {g['live']['avg']}R (eksi)", g["live"]["n"])
            evolve.save(ev)
        except Exception as e:
            print(f"research evolve: {e}", file=sys.stderr)
    R["feedback"] = feedback(R)
    R["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    OUT.write_text(json.dumps(R, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(f"research: {sum(len(a['pending']) for a in R['active'])} sinyal")


if __name__ == "__main__":
    if "--live" in sys.argv:
        live()
    else:
        test_week()
