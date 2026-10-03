import pandas as pd

import scan as S
from conftest import cand, paper, ts

MKT = dict(regime="sağlıklı", shield=[])


def test_three_trades_per_day_and_two_per_book():
    st = paper()
    cs = [cand("A", "vwap"), cand("B", "vwap", sector="X"), cand("C", "vwap", sector="Y"), cand("D", "orb", sector="Z"), cand("E", "orb", sector="W")]
    log = S.open_new(st, cs, MKT, ts("2026-10-05 10:30"), ts("2026-10-05 10:30").date())
    books = [t["book"] for t in st["trades"]]
    assert len(st["trades"]) == 3, log
    assert books.count("vwap") == 2 and books.count("orb") == 1
    assert all(t["status"] == "open" and t["order"] == "market" for t in st["trades"])
    assert S.open_new(st, cs, MKT, ts("2026-10-05 10:40"), ts("2026-10-05 10:40").date())[-1].startswith("Bugünün 3")


def test_cash_per_slot_and_risk_cap():
    st = paper()
    S.open_new(st, [cand("A", stop=99.5)], MKT, ts("2026-10-05 10:30"), ts("2026-10-05 10:30").date())
    t = st["trades"][0]
    assert t["qty"] * t["entry"] <= 10000 / 6 + 1e-6  # each of the 6 slots gets at most 1/6 of the account
    assert t["risk"] <= 10000 * 0.01 + 1e-6  # ≤ 1% of the account including fees


def test_sector_limit():
    st = paper()
    cs = [cand("A", "vwap"), cand("B", "orb"), cand("C", "rev")]  # all "Tech"
    S.open_new(st, cs, MKT, ts("2026-10-05 10:30"), ts("2026-10-05 10:30").date())
    assert [t["symbol"] for t in st["trades"]] == ["A", "B"]


def test_market_entry_keeps_r_distances():
    st = paper()
    S.open_new(st, [cand("A", entry=100, stop=98, target=103, last=101)], MKT, ts("2026-10-05 10:30"), ts("2026-10-05 10:30").date())
    t = st["trades"][0]
    assert (t["entry"], t["stop"], t["target"]) == (101, 99, 104)


def test_guarantee_turns_unfilled_limit_into_market():
    st = paper()
    day = ts("2026-10-05 10:00").date()
    of = cand("OFX", "of", entry=95, stop=94, target=97, last=100, order="limit")
    S.open_new(st, [of], MKT, ts("2026-10-05 10:00"), day)
    assert st["trades"][0]["status"] == "pending"
    log = S.open_new(st, [dict(of, formed="of-OFX-2")], MKT, ts("2026-10-05 11:05"), day)
    assert st["trades"][0]["status"] == "cancelled"
    t = st["trades"][1]
    assert t["status"] == "open" and t["order"] == "market" and t["entry"] == 100, log


def test_daily_loss_limit():
    st = paper()
    day = ts("2026-10-05 10:30").date()
    S.day_log(st, day)["r"] = -3.0
    assert "−3R" in S.open_new(st, [cand("A")], MKT, ts("2026-10-05 10:30"), day)[0]
    assert not st["trades"]


def test_hard_blocked_never_taken_even_at_guarantee():
    st = paper()
    log = S.open_new(st, [cand("A", blocked=["Bilanço bugün"])], MKT, ts("2026-10-05 11:30"), ts("2026-10-05 11:30").date())
    assert not st["trades"] and "boş kaldı" in log[-1]


def test_close_records_600_dollar_equivalent():
    st = paper()
    t = dict(symbol="A", qty=10.0, fill=100.0, stop=98.0, status="open", fill_time=str(ts("2026-10-05 10:00")), book="vwap")
    st["trades"].append(t)
    S.close(t, 103.0, ts("2026-10-05 11:00"), "Hedef", st)
    assert t["pnl"] == 30 - 3
    assert t["pnl_600"] == round(30 * 600 / 10000 - 3, 2)


def _d1(closes, end="2026-10-08"):
    idx = pd.date_range(end=end, periods=len(closes), freq="B", tz=S.NY)
    return pd.DataFrame(dict(Open=closes, High=closes, Low=closes, Close=closes, Volume=[1e6] * len(closes)), index=idx)


def test_swing_exit_rule_and_time_stop():
    st = paper()
    day = ts("2026-10-08 15:55")
    a = dict(symbol="R", qty=10.0, fill=50.0, stop=46.5, status="open", horizon="swing", exit_rule="s5up", max_days=5,
             fill_time=str(ts("2026-10-07 09:40")), book="rsi2", date="2026-10-07")
    b = dict(symbol="N", qty=10.0, fill=50.0, stop=45.0, status="open", horizon="swing", exit_rule=None, max_days=5,
             fill_time=str(ts("2026-10-01 09:40")), book="bnf", date="2026-10-01")
    st["trades"] += [a, b]
    d1 = {"R": _d1([48, 47, 46, 45, 44, 44.5]), "N": _d1([50] * 8)}
    S.swing_exits(st, d1, {"R": 49.0, "N": 50.5}, day, day.date())
    assert a["status"] == "closed" and "5 günlük" in a["note"]  # 49 > mean(47,46,45,44.5,49)
    assert b["status"] == "closed" and "Süre" in b["note"]  # 2026-10-01 … 10-08 = 6 sessions ≥ 5


def test_swing_not_closed_before_1550():
    st = paper()
    a = dict(symbol="N", qty=1.0, fill=50.0, stop=45.0, status="open", horizon="swing", max_days=1, fill_time=str(ts("2026-10-01 09:40")))
    st["trades"].append(a)
    S.swing_exits(st, {"N": _d1([50] * 8)}, {"N": 50.0}, ts("2026-10-08 12:00"), ts("2026-10-08 12:00").date())
    assert a["status"] == "open"
