"""Kendini geliştirme: günün haklarını oyun kitapları arasında paylaştırır, kitapların ayarını ve sert kurallarını
kanıta göre değiştirir, her değişikliği gerekçesiyle data/evolve.json → changes'e yazar.

1. Paylaştırma (Thompson örneklemesi): her kitap için kazanma olasılığı θ ~ Beta(α, β) ve net beklenti μ ~ Normal örneklenir.
   Ön bilgi lab'ın sınav dönemi sonucudur (10 sanal işleme ölçekli); canlı veri = kitabın kapanmış gerçek + gölge işlemleri.
   Fayda = θ, μ ≤ 0 ise θ × 0,5. Rastgelelik tarih tohumuyla sabittir (aynı gün aynı sıra).
2. Ayar (günde bir, 16:00 NY sonrası): gün içi kitapta son ayardan beri ≥ 20 yeni gölge örnek varsa 9 bileşim
   (hedef 1 / 1,5 / 2R × stop 0,8 / 1 / 1,25) gölgelerin sapma kayıtlarından (ex) değerlendirilir. Önce %60+ kazanma ve
   net > 0 içinde en yüksek net; yoksa net > 0 içinde en yüksek kazanma. Yeni ayar ≥ 0,05R iyi değilse değişmez.
3. Kural sertleştirme: kitap bazında "koruyor" kararı (iki tarafta ≥ 30 örnek) kuralı sert yapar; aynı eşikle
   "fark yok" ya da "fırsat kaçırtıyor" olursa geri alınır.
config.json → evolve.frozen: true ise 2 ve 3 yapılmaz (paylaştırma sürer).
"""
import json
import math
import random
from datetime import datetime, timezone

import scan as S
import books as B

STATE = S.DATA / "evolve.json"
PRIOR_N = 10
TUNE_EVERY = 20
HARD_N = 30
MIN_GAIN = 0.05
PER_BOOK_DAY = 2
GRID_T = (1.0, 1.5, 2.0)
GRID_K = (0.8, 1.0, 1.25)
DEFAULT_PRIOR = (0.45, 0.0)


def frozen():
    return bool((S.CFG.get("evolve") or {}).get("frozen"))


def _priors():
    out = {}
    try:
        lab = {s["id"]: s for s in json.loads((S.DATA / "lab.json").read_text(encoding="utf-8")).get("strategies", [])}
    except Exception:
        lab = {}
    for b, meta in B.all_books().items():
        st = meta.get("research") or lab.get(meta["lab"] or "") or {}
        t = st.get("test") or st.get("backtest") or {}
        if t.get("n"):
            out[b] = ((t.get("win") or 45) / 100, t.get("avg_r") or 0.0)
    try:
        g = (json.loads((S.DATA / "backtest.json").read_text(encoding="utf-8")).get("groups") or {}).get("çekirdek") or {}
        if g.get("n"):
            out["of"] = ((g.get("win") or 45) / 100, g.get("avg") or 0.0)
    except Exception:
        pass
    return out


def load():
    try:
        ev = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        ev = {}
    ev.setdefault("books", {})
    ev.setdefault("changes", [])
    pri = _priors()
    books = B.all_books()
    for b in [b for b in ev["books"] if b.startswith("r_") and b not in books]:
        ev["books"][b]["retired"] = True
    for b, meta in books.items():
        e = ev["books"].setdefault(b, {})
        w, avg = pri.get(b, DEFAULT_PRIOR)
        e.update(name=meta["name"], who=meta["who"], horizon=meta["horizon"], prior=dict(win=round(w, 3), avg=round(avg, 3), n=PRIOR_N))
        e.setdefault("params", dict(B.DEFAULT, tuned=False))
        e.setdefault("hard_rules", [])
        e.setdefault("last_tune_n", 0)
        e.pop("retired", None)
    return ev


def save(ev):
    ev["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ev["changes"] = ev["changes"][-200:]
    STATE.write_text(json.dumps(ev, ensure_ascii=False, indent=1), encoding="utf-8")


def params(ev):
    return {b: e["params"] for b, e in ev["books"].items()}


def hard_rules(ev, book):
    return set((ev["books"].get(book) or {}).get("hard_rules") or [])


def outcomes(paper, shadows, book, regime=None):
    """Closed net R of a book (real trades + untraded shadows), optionally only those taken in one market regime."""
    ok = lambda x: regime is None or x.get("regime") == regime
    rs = [t["net_r"] for t in paper["trades"] if t.get("book") == book and t["status"] == "closed" and t.get("net_r") is not None and ok(t)]
    rs += [x["net_r"] for x in shadows if x.get("book") == book and x["status"] == "closed" and not x.get("traded") and x.get("net_r") is not None and ok(x)]
    return rs


def regime_posterior(e, all_rs, reg_rs):
    """Contextual Thompson: the book's overall posterior, shrunk to PRIOR_N pseudo-trades, updated with this regime's results."""
    a0, b0, m0, sd0, n0 = posterior(e, all_rs)
    p0 = a0 / (a0 + b0)
    n, wins = len(reg_rs), sum(1 for r in reg_rs if r > 0)
    mean = (m0 * PRIOR_N + sum(reg_rs)) / (PRIOR_N + n)
    sd = (sum((r - sum(reg_rs) / n) ** 2 for r in reg_rs) / (n - 1)) ** 0.5 if n >= 5 else sd0
    return p0 * PRIOR_N + wins, (1 - p0) * PRIOR_N + (n - wins), mean, sd, n


def posterior(e, rs):
    p = e["prior"]
    n, wins = len(rs), sum(1 for r in rs if r > 0)
    a = p["win"] * PRIOR_N + wins
    b = (1 - p["win"]) * PRIOR_N + (n - wins)
    mean = (p["avg"] * PRIOR_N + sum(rs)) / (PRIOR_N + n)
    sd = (sum((r - sum(rs) / n) ** 2 for r in rs) / (n - 1)) ** 0.5 if n >= 5 else 1.0
    return a, b, mean, sd, n


def allocate(ev, cands_by_book, paper, shadows, today, n_today, regime=None):
    """Candidates in the order the day's slots should be offered: books by sampled utility, then each book's best."""
    rng = random.Random(f"{today}-{n_today}")
    util, info = {}, {}
    for b in sorted(cands_by_book):
        if not cands_by_book[b] or b not in ev["books"] or ev["books"][b].get("retired"):
            continue
        a, bb, mean, sd, n = regime_posterior(ev["books"][b], outcomes(paper, shadows, b), outcomes(paper, shadows, b, regime))
        th = rng.betavariate(max(a, 0.5), max(bb, 0.5))
        mu = rng.gauss(mean, sd / math.sqrt(n + PRIOR_N))
        util[b] = th * (0.5 if mu <= 0 else 1.0)
        info[b] = dict(theta=round(th, 3), mu=round(mu, 3), win_post=round(a / (a + bb) * 100, 1), net_post=round(mean, 3), n=n, cands=len(cands_by_book[b]))
    order = sorted(util, key=lambda b: -util[b])
    ev["allocation"] = dict(date=str(today), order=order, books=info, regime=regime)
    out = []
    for rank in range(PER_BOOK_DAY + 6):  # best of every book first, then second-bests (alternates if a pick is refused)
        for b in order:
            if rank < len(cands_by_book[b]):
                out.append(cands_by_book[b][rank])
    return out


def _combo(samples, T, k):
    rs = []
    for x in samples:
        e = (x.get("ex") or {}).get(str(k))
        u, F = x.get("u"), S.FEE2
        if not e or not u:
            continue
        mfe, stopped, close_r = e
        g = T * k if mfe >= T * k else (-k if stopped else close_r)
        rs.append((g * u - F) / (k * u + F))
    n = len(rs)
    if not n:
        return None
    return dict(n=n, win=round(100 * sum(1 for r in rs if r > 0) / n, 1), net=round(sum(rs) / n, 3), T=T, k=k)


def _log(ev, today, book, what, old, new, why, n):
    name = (B.all_books().get(book) or {}).get("name", book)
    ev["changes"].append(dict(date=str(today), book=book, name=name, what=what, old=old, new=new, why=why, n=n))
    S.notify(f"Diogenes kendini ayarladı: {name}", f"{what}: {old} → {new}\n{why} ({n} örnek)", ["gear"], 3)


def nightly(ev, shadows, report, now, today):
    """Once per trading day after the close: tune book parameters and harden/soften rules from evidence."""
    if S.hm(now) < "16:00" or ev.get("tuned_on") == str(today) or now.weekday() >= 5:
        return
    ev["tuned_on"] = str(today)
    if frozen():
        return
    for b, e in ev["books"].items():
        if e["horizon"] != "gün" or e.get("retired"):
            continue
        samples = [x for x in shadows if x.get("book") == b and x.get("ex_done")]
        if len(samples) - e["last_tune_n"] >= TUNE_EVERY:
            e["last_tune_n"] = len(samples)
            res = [r for r in (_combo(samples, T, k) for T in GRID_T for k in GRID_K) if r]
            cur = _combo(samples, e["params"].get("target_r") or 1.5, e["params"].get("stop_k") or 1.0)
            good = [r for r in res if r["win"] >= 60 and r["net"] > 0]
            pick = max(good, key=lambda r: r["net"]) if good else max([r for r in res if r["net"] > 0] or [None], key=lambda r: r["win"] if r else 0)
            if pick and cur and (pick["T"], pick["k"]) != (e["params"].get("target_r"), e["params"].get("stop_k")) and pick["net"] >= cur["net"] + MIN_GAIN:
                old = f"hedef {e['params'].get('target_r')}R, stop ×{e['params'].get('stop_k')} (%{cur['win']}, {cur['net']}R)"
                e["params"] = dict(target_r=pick["T"], stop_k=pick["k"], tuned=True)
                _log(ev, today, b, "Hedef/stop", old, f"hedef {pick['T']}R, stop ×{pick['k']} (%{pick['win']}, {pick['net']}R)",
                     "%60+ ve artı net içinde en yüksek net" if good else "artı net içinde en yüksek kazanma (henüz %60 yok)", pick["n"])
    for b, e in ev["books"].items():
        if e.get("retired"):
            continue
        rules = ((report.get("by_book") or {}).get(b) or {}).get("rules") or []
        for r in rules:
            if r["broken"]["n"] < HARD_N or r["kept"]["n"] < HARD_N or r["key"] in S.HARD_RULES:
                continue
            on = r["key"] in e["hard_rules"]
            if r["verdict"] == "koruyor" and not on:
                e["hard_rules"].append(r["key"])
                _log(ev, today, b, "Kural sertleşti", r["label"] + ": etiket", "engel",
                     f"çiğneyen ort {r['broken']['avg']}R, uyan {r['kept']['avg']}R", r["broken"]["n"] + r["kept"]["n"])
            elif on and r["verdict"] in ("fark yok", "fırsat kaçırtıyor"):
                e["hard_rules"].remove(r["key"])
                _log(ev, today, b, "Kural gevşedi", r["label"] + ": engel", "etiket",
                     f"artık {r['verdict']} (çiğneyen {r['broken']['avg']}R, uyan {r['kept']['avg']}R)", r["broken"]["n"] + r["kept"]["n"])
