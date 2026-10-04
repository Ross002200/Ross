import numpy as np
import pandas as pd

import evolve
import lab
import learn
import research as R
import scan as S
from conftest import cand, paper, ts

MKT = dict(regime="sağlıklı", shield=[])


def test_bayesian_evidence():
    assert abs(learn.p_above(0, 0, 0.55) - 0.45) < 1e-3  # uniform prior
    p60, p70 = learn.p_above(60, 100, 0.55), learn.p_above(70, 100, 0.55)
    assert 0.8 < p60 < 0.9 and p70 > 0.99  # 60/100 is suggestive, not proof
    st = paper()
    st["trades"] = [dict(status="closed", pnl=10, net_r=0.5) for _ in range(60)] + [dict(status="closed", pnl=-8, net_r=-0.4) for _ in range(40)]
    pr = learn.progress(st)
    assert pr["evidence"] in ("orta", "zayıf") and not pr["real_money_ready"] and pr["p_net"] > 90


def test_slippage_on_stops_not_on_targets():
    st = paper()
    a = dict(symbol="A", qty=10.0, fill=50.0, stop=49.0, status="open", fill_time=str(ts("2026-10-05 10:00")))
    b = dict(a, symbol="B")
    st["trades"] += [a, b]
    S.close(a, 49.0, ts("2026-10-05 11:00"), "Stop", st)
    S.close(b, 52.0, ts("2026-10-05 11:00"), "Hedef", st)
    assert a["exit"] == round(49.0 * (1 - S.slip(49.0)), 4) and b["exit"] == 52.0


def test_limit_needs_a_trade_through():
    x = dict(symbol="A", book="vwap", date="2026-10-05", created=str(ts("2026-10-05 10:00")), entry=100, stop=98, target=103, qty=5, status="pending", keys=[])
    bars = pd.DataFrame(dict(Open=[101.0], High=[101.5], Low=[100.0], Close=[100.8]), index=pd.date_range("2026-10-05 10:05", periods=1, freq="5min", tz=S.NY))
    learn._step(x, bars)
    assert x["status"] == "pending"  # touching 100 is not a fill


def test_fee_floor_and_vix_scaling():
    assert S.vix_mult(dict(VIX=dict(last=40))) == 0.5 and S.vix_mult(dict(VIX=dict(last=15))) == 1.0
    st = paper()
    log = S.open_new(st, [cand("TINY", entry=100, stop=99.9, target=100.05, last=100)], MKT, ts("2026-10-05 10:30"), ts("2026-10-05 10:30").date())
    assert not st["trades"] and "Komisyon tabanı" in " ".join(log)


def test_close_entry_uses_tomorrows_slot():
    st = paper()
    day = ts("2026-10-05 10:30").date()
    S.open_new(st, [cand("A"), cand("B", sector="X"), cand("C", "orb", sector="Y")], MKT, ts("2026-10-05 10:30"), day)
    assert len(S._today_trades(st, day)) == 3
    late = ts("2026-10-05 15:50")
    S.open_new(st, [cand("D", "ibs", horizon="swing", sector="Z", close_entry=True), cand("E", sector="W")], MKT, late, day)
    d = next(t for t in st["trades"] if t["symbol"] == "D")
    assert d["slot_day"] == "2026-10-06" and not any(t["symbol"] == "E" for t in st["trades"])
    assert len(S._today_trades(st, pd.Timestamp("2026-10-06").date())) == 1
    S.open_new(st, [cand(x, "rsi2c", horizon="swing", sector=x, close_entry=True) for x in ("F", "G", "H")], MKT, late, day)
    assert len(S._today_trades(st, pd.Timestamp("2026-10-06").date())) == 2  # at most 2 of tomorrow's 3 slots


def _d1(rows, end="2026-10-08"):
    idx = pd.date_range(end=end, periods=len(rows), freq="B", tz=S.NY)
    return pd.DataFrame(rows, columns=["Open", "High", "Low", "Close"], index=idx).assign(Volume=1e6)


def test_swing_pvh_exit_not_on_entry_day():
    st = paper()
    a = dict(symbol="I", qty=10.0, fill=50.0, stop=47.0, status="open", horizon="swing", exit_rule="pvh", max_days=5,
             fill_time=str(ts("2026-10-07 15:50")), book="ibs", date="2026-10-07")
    st["trades"].append(a)
    d1 = {"I": _d1([[50, 51, 49, 50]] * 4 + [[50, 50.5, 49.5, 50]] + [[50, 51, 49, 50.6]])}  # 10-07 high 50.5, then 10-08
    S.swing_exits(st, d1, {"I": 50.6}, ts("2026-10-07 15:55"), ts("2026-10-07 15:55").date())
    assert a["status"] == "open"
    S.swing_exits(st, d1, {"I": 50.6}, ts("2026-10-08 15:55"), ts("2026-10-08 15:55").date())
    assert a["status"] == "closed" and "tepesinin" in a["note"]


def _panel(n=320):
    idx = pd.bdate_range("2025-01-01", periods=n)
    rng = np.random.default_rng(5)
    c = 100 * np.exp(np.cumsum(rng.normal(0.0004, 0.02, n)))
    d1 = {"AAA": pd.DataFrame(dict(Open=c, High=c * 1.012, Low=c * 0.988, Close=c, Volume=np.full(n, 1e6)), index=idx)}
    return lab.panel(d1, ["AAA"])


def test_close_entry_enters_at_signal_close():
    p = _panel()
    i = 250
    t = lab.sim_daily(p, "AAA", i, "close", lambda e, j: e * 0.9, trail="pvh", max_hold=5)
    assert t["entry"] == round(float(p.C["AAA"].iloc[i]), 2) and t["entry_d"] == str(p.idx[i].date())
    assert t["days"] <= 6


def test_ibs_and_turn_of_month_features():
    p = _panel()
    F = R.frames(p)
    ibs = F["ibs"]["AAA"].dropna()
    assert ((ibs >= 0) & (ibs <= 1)).all()
    tom = F["tom"]["AAA"]
    first = tom[~tom.index.to_period("M").duplicated()]
    assert (first == 1).all() and 0.15 < tom.mean() < 0.25  # ~4 of ~21 days per month
    assert R.validate({"when": [["ibs", "<", 0.2], ["tom", ">=", 1]], "entry": "next_open", "stop_pct": 6, "target": {"r": 1}, "max_days": 3}) == []


def test_regime_posterior_learns_per_regime():
    ev = evolve.load()
    e = ev["books"]["vwap"]
    e["prior"] = dict(win=0.5, avg=0.0, n=evolve.PRIOR_N)
    good, bad = [0.5] * 20, [-0.5] * 20
    a1, b1, *_ = evolve.regime_posterior(e, good + bad, good)
    a2, b2, *_ = evolve.regime_posterior(e, good + bad, bad)
    assert a1 / (a1 + b1) > 0.7 and a2 / (a2 + b2) < 0.3
