import numpy as np
import pandas as pd

import dossier as D
import scan as S
from conftest import ts


def test_publisher_tiers():
    assert D.tier("Business Wire") == "birincil"
    assert D.tier("Reuters") == "ajans" and D.tier("The Wall Street Journal") == "ajans"
    assert D.tier("Motley Fool") == "görüş" and D.tier("Yahoo Finance") == "görüş"
    assert D.tier("Random Blog") is None


def test_news_keeps_only_recognised_recent_linked_items():
    now = pd.Timestamp.now(tz="UTC")
    items = [dict(title="Acme beats estimates", source="Reuters", link="https://r", time=str(now - pd.Timedelta(hours=2))),
             dict(title="Acme 8-K", source="Business Wire", link="https://bw", time=str(now - pd.Timedelta(hours=5))),
             dict(title="Hot tip!!", source="Random Blog", link="https://x", time=str(now)),
             dict(title="Old news", source="Reuters", link="https://o", time=str(now - pd.Timedelta(days=5))),
             dict(title="No link", source="CNBC", link=None, time=str(now))]
    out = D.news("ACME", items)
    assert [n["title"] for n in out] == ["Acme 8-K", "Acme beats estimates"]  # primary source first
    assert all(n["link"] and n["publisher"] for n in out)


def _data():
    idx = pd.bdate_range(end="2026-10-02", periods=260, tz=S.NY)
    c = np.linspace(80, 120, 260)
    d1 = pd.DataFrame(dict(Open=c, High=c * 1.01, Low=c * 0.99, Close=c, Volume=1e6), index=idx)
    m_idx = pd.date_range("2026-10-01 09:30", periods=26, freq="15min", tz=S.NY).append(pd.date_range("2026-10-02 09:30", periods=6, freq="15min", tz=S.NY))
    p = np.full(len(m_idx), 121.0)
    m15 = pd.DataFrame(dict(Open=p, High=p + 0.5, Low=p - 0.5, Close=p, Volume=1e5), index=m_idx)
    return d1, m15


def test_analysis_is_built_from_numbers_only():
    d1, m15 = _data()
    m = D.metrics("ACME", m15, d1, {"ACME": 121.0}, pd.Timestamp("2026-10-02").date())
    assert m["vs_sma50"] > 0 and m["last"] == 121.0
    lines = D.analysis(m)
    trend = next(x for x in lines if x["k"] == "Trend")
    assert f"%{D._f(abs(m['vs_sma50']))}" in trend["t"] and "yükseliş trendi" in trend["t"]


def test_build_has_levels_bars_reasons_and_sources():
    d1, m15 = _data()
    t = dict(symbol="ACME", entry=121.0, stop=119.0, target=124.0, qty=10.0, risk=23.0, book="bnf", book_name="BNF sapma", violations=[])
    night = dict(generated="2026-10-02T11:00:00Z", stocks=[dict(symbol="ACME", verdict="olumlu", analysis="x", catalyst="y")],
                 sources=[dict(title="Reuters", url="https://r")])
    d = D.build(t, dict(book="bnf", rr=1.5), m15, d1, {"ACME": 121.0}, pd.Timestamp("2026-10-02").date(), ts("2026-10-02 10:00"), night=night, items=[])
    assert d["levels"] == dict(entry=121.0, stop=119.0, target=124.0, vwap=d["metrics"]["vwap"])
    assert len(d["bars"]) == 32 and d["why"] and d["claude"]["verdict"] == "olumlu"
    assert any("Yahoo Finance" in s for s in d["sources"]) and d["risk"]["stop_pct"] == round(2 / 121 * 100, 2)


def test_google_news_parsing(monkeypatch):
    rss = ("<rss><channel><item><title>Acme wins contract - Reuters</title><link>https://news.google.com/x</link>"
           "<pubDate>Fri, 02 Oct 2026 14:00:00 GMT</pubDate><source url=\"https://reuters.com\">Reuters</source></item></channel></rss>")

    class R:
        text = rss

        def raise_for_status(self):
            pass
    monkeypatch.setattr(S.requests, "get", lambda *a, **k: R())
    out = S._google_news("ACME")
    assert out == [dict(title="Acme wins contract", link="https://news.google.com/x", source="Reuters", time="2026-10-02T14:00:00+00:00")]
