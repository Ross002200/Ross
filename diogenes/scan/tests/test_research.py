import json

import numpy as np
import pandas as pd

import books
import lab
import research as R
import scan as S
from conftest import paper, ts

GOOD = {"when": [["rsi2", "<", 10], ["close", ">", "sma200"]], "entry": "next_open", "stop_pct": 7, "target": {"exit": "close_above_sma5"}, "max_days": 5}


def test_validate_accepts_good_and_explains_bad():
    assert R.validate(GOOD) == []
    bad = R.validate({"when": [["magic", "<", 1], ["close", "~", "sma7"]], "stop_pct": 30, "target": {"moon": 1}, "max_days": 9, "code": "x"})
    text = " ".join(bad)
    for word in ("bilinmeyen alan", "magic", "~", "sma7", "stop_pct", "target", "max_days"):
        assert word in text


def _panel(n=320, syms=("AAA", "BBB")):
    idx = pd.bdate_range("2025-01-01", periods=n)
    rng = np.random.default_rng(3)
    d1 = {}
    for k, s in enumerate(syms):
        c = 100 * np.exp(np.cumsum(rng.normal(0.0005, 0.02, n)))
        d1[s] = pd.DataFrame(dict(Open=c * (1 + rng.normal(0, 0.003, n)), High=c * 1.01, Low=c * 0.99, Close=c, Volume=np.full(n, 1e6)), index=idx)
    return lab.panel(d1, list(syms))


def test_mask_and_trades_follow_the_rule():
    p = _panel()
    F = R.frames(p)
    m = R.mask({"when": [["ret1", "<", -2]]}, F)
    expect = ((p.C / p.C.shift(1) - 1) * 100 < -2).fillna(False)
    assert m.equals(expect)
    rule = {"when": [["ret1", "<", -2]], "entry": "next_open", "stop_pct": 5, "target": {"pct": 3}, "max_days": 3}
    ts_ = [t for t in R.trades(p, rule, F) if t.get("exit_d")]
    assert ts_ and all(t["days"] <= 3 for t in ts_)
    assert all(t["pct"] >= 3.0 - 1e-6 for t in ts_ if t["why"] == "hedef")  # a gap above the target exits at the open


def test_holm_and_acceptance():
    adj = R.holm_p({"a": 0.01, "b": 0.04, "c": 0.5})
    assert adj["a"] == 0.03 and adj["b"] == 0.08 and adj["c"] == 0.5
    good = dict(learn=dict(n=40, exp=2.0), test=dict(n=35, exp=1.5), p_holm=0.05)
    assert R.accept(good) == (True, [])
    ok, why = R.accept(dict(learn=dict(n=10, exp=-1), test=dict(n=35, exp=1), p_holm=0.3))
    assert not ok and len(why) == 3


def test_active_cap_and_retirement():
    Rj = {"active": []}
    for k in range(7):
        R.add_active(Rj, dict(id=f"i{k}", name=f"İ{k}", rule=GOOD), dict(test=dict(exp=k), learn={}, p_holm=0.01), "2026-10-04")
    assert len(Rj["active"]) == 6 and "i0" not in {a["id"] for a in Rj["active"]}
    st = paper()
    st["trades"] = [dict(book="r_i6", status="closed", net_r=-0.3) for _ in range(20)]
    gone = R.retire(Rj, st)
    assert [g["id"] for g in gone] == ["i6"] and Rj["retired"][0]["status"] == "emekli"


def test_week_plan_flags_and_sector_tags(tmp_path):
    (S.DATA / "week_plan.json").write_text(json.dumps(dict(generated="x", week="2026-10-05", days={"2026-10-06": {"flag": "dur", "why": "CPI"}},
                                                          sectors=dict(favor=["Energy"], avoid=["Utilities"]))), encoding="utf-8")
    wp = S.load_week_plan(pd.Timestamp("2026-10-06").date())
    assert wp["today"]["flag"] == "dur"
    assert S.load_week_plan(pd.Timestamp("2026-10-20").date()) is None
    a = dict(sector="Utilities", score=1.0)
    b = dict(sector="Energy", score=1.0)
    S.week_tags(a, wp)
    S.week_tags(b, wp)
    assert "week_avoid" in a["rule_keys"] and a["violations"][0]["key"] == "week_avoid"
    assert "week_favor" in b["rule_keys"] and b["score"] == 1.15


def test_research_books_join_and_signal_next_open():
    (S.DATA / "research.json").write_text(json.dumps(dict(active=[dict(id="gap_fill", name="Gap dolumu", rule=GOOD, test=dict(n=40, win=61, avg_r=0.2),
                                                                      pending=[dict(sym="AAA", sig="2026-10-02")])])), encoding="utf-8")
    assert "r_gap_fill" in books.all_books()
    idx = pd.bdate_range(end="2026-10-05", periods=30, tz=S.NY)
    d1 = {"AAA": pd.DataFrame(dict(Open=50.0, High=50.0, Low=50.0, Close=50.0, Volume=1e6), index=idx)}
    now = ts("2026-10-05 09:40")
    cs = books.research_swing(now.date(), d1, {"AAA": 50.0}, {"AAA": dict(sector="Tech")}, now)
    assert len(cs) == 1 and cs[0]["book"] == "r_gap_fill" and cs[0]["horizon"] == "swing" and cs[0]["exit_rule"] == "s5up"
    assert cs[0]["stop"] == 46.5 and cs[0]["max_days"] == 5
