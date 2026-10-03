import pandas as pd

import edgar
import evolve
import learn
import scan as S
from conftest import cand, paper, ts


def _ev():
    ev = evolve.load()
    for e in ev["books"].values():
        e["prior"] = dict(win=0.5, avg=0.1, n=evolve.PRIOR_N)
    return ev


def test_allocation_is_deterministic_and_interleaves_books():
    ev = _ev()
    by = {"vwap": [cand("A"), cand("B")], "orb": [cand("C", "orb")], "rev": []}
    o1 = [c["symbol"] for c in evolve.allocate(ev, by, paper(), [], "2026-10-05", 0)]
    o2 = [c["symbol"] for c in evolve.allocate(_ev(), by, paper(), [], "2026-10-05", 0)]
    assert o1 == o2
    assert set(o1[:2]) == {"A", "C"} and o1[2] == "B"  # each book's best first, then second-bests


def test_negative_expectancy_book_is_halved():
    ev = _ev()
    ev["books"]["orb"]["prior"] = dict(win=0.5, avg=-1.0, n=evolve.PRIOR_N)
    evolve.allocate(ev, {"vwap": [cand("A")], "orb": [cand("C", "orb")]}, paper(), [], "2026-10-05", 0)
    b = ev["allocation"]["books"]
    assert b["orb"]["mu"] < 0 and b["orb"]["net_post"] < 0


def _shadow(mfe, stopped, close_r, u=100.0):
    return dict(book="vwap", ex_done=True, u=u, ex={str(k): [mfe, stopped, close_r] for k in evolve.GRID_K}, status="closed")


def test_combo_scoring_uses_excursions():
    s = [_shadow(1.2, False, 0.5), _shadow(0.3, True, -1)]
    r = evolve._combo(s, 1.0, 1.0)
    assert r["n"] == 2 and r["win"] == 50.0
    assert round(r["net"], 3) == round(((100 - 3) / 103 + (-100 - 3) / 103) / 2, 3)


def test_nightly_tunes_towards_60_percent_and_logs():
    ev = _ev()
    sh = [_shadow(1.1, False, 0.2) for _ in range(14)] + [_shadow(0.2, True, -1) for _ in range(8)]  # 1R hits often, 1.5R never
    evolve.nightly(ev, sh, {}, ts("2026-10-05 16:05"), ts("2026-10-05 16:05").date())
    p = ev["books"]["vwap"]["params"]
    assert p["tuned"] and p["target_r"] == 1.0
    assert ev["changes"] and ev["changes"][-1]["book"] == "vwap"


def test_frozen_blocks_changes(monkeypatch):
    monkeypatch.setitem(S.CFG, "evolve", dict(frozen=True))
    ev = _ev()
    sh = [_shadow(1.1, False, 0.2) for _ in range(22)]
    evolve.nightly(ev, sh, {}, ts("2026-10-05 16:05"), ts("2026-10-05 16:05").date())
    assert not ev["books"]["vwap"]["params"]["tuned"] and not ev["changes"]


def test_rule_hardening_and_softening():
    ev = _ev()
    rep = {"by_book": {"vwap": {"rules": [dict(key="rs", label="RS düşük", verdict="koruyor", broken=dict(n=30, avg=-0.4), kept=dict(n=40, avg=0.2))]}}}
    evolve.nightly(ev, [], rep, ts("2026-10-05 16:05"), ts("2026-10-05 16:05").date())
    assert "rs" in ev["books"]["vwap"]["hard_rules"]
    rep["by_book"]["vwap"]["rules"][0]["verdict"] = "fark yok"
    evolve.nightly(ev, [], rep, ts("2026-10-06 16:05"), ts("2026-10-06 16:05").date())
    assert "rs" not in ev["books"]["vwap"]["hard_rules"]


def _bars(rows, start="2026-10-05 10:35"):
    idx = pd.date_range(start, periods=len(rows), freq="5min", tz=S.NY)
    return pd.DataFrame(rows, columns=["Open", "High", "Low", "Close"], index=idx)


def test_shadow_excursions_keep_running_after_target():
    x = dict(symbol="A", book="vwap", date="2026-10-05", created=str(ts("2026-10-05 10:30")), entry=100, stop=98, target=102, qty=10, status="pending", keys=[])
    learn._fill(x, 100.0, ts("2026-10-05 10:30"))
    learn._step(x, _bars([[100, 102.5, 99.5, 102], [102, 103, 97.9, 98.5], [98.5, 99, 98, 98.8]]))
    assert x["status"] == "closed" and x["note"] == "Hedef"
    assert x["ex"]["1.0"][1] is True  # the 97.9 low later hits the 1R stop
    assert x["ex"]["1.25"][1] is False and x["ex"]["1.25"][0] == 1.5  # wider stop survives: best +1.5R seen


def test_wilson_and_progress_criteria():
    lo, hi = learn.wilson(60, 100)
    assert 50 < lo < 60 < hi < 70
    st = paper()
    st["trades"] = [dict(status="closed", pnl=10, net_r=0.5, pnl_600=-2) for _ in range(61)] + [dict(status="closed", pnl=-5, net_r=-0.5) for _ in range(39)]
    pr = learn.progress(st)
    assert pr["n"] == 100 and pr["win"] == 61.0 and pr["net"] > 0 and pr["criteria_met"]


def test_edgar_parse_and_no_contact_is_silent(monkeypatch):
    xml = ("<feed><entry><title>8-K - ACME CORP (0000001234) (Filer)</title><updated>2026-10-05T08:01:00-04:00</updated>"
           "<summary>Item 2.02: Results Item 9.01: Exhibits</summary></entry></feed>")
    out = edgar.parse(xml, {"1234": "ACME"}, pd.Timestamp("2026-10-04", tz="UTC").to_pydatetime())
    assert out["ACME"]["items"][0].startswith("2.02")
    monkeypatch.delenv("SEC_CONTACT", raising=False)
    assert edgar.recent() == {}
