import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import scan as S  # noqa: E402

NY = "America/New_York"


@pytest.fixture(autouse=True)
def quiet(monkeypatch, tmp_path):
    """No phone notifications, no network, data files in a temp dir."""
    monkeypatch.setattr(S, "notify", lambda *a, **k: None)
    monkeypatch.setattr(S, "DATA", tmp_path)
    for mod in ("learn", "evolve", "edgar"):
        m = sys.modules.get(mod)
        if m is not None:
            for name in ("SHADOW", "REPORT", "STATE", "CACHE"):
                if hasattr(m, name):
                    monkeypatch.setattr(m, name, tmp_path / getattr(m, name).name)
    yield


def ts(s):
    return pd.Timestamp(s, tz=NY)


def cand(sym, book="vwap", entry=100.0, stop=98.0, target=103.0, last=100.0, order="market", sector="Tech", horizon="gün", **kw):
    c = dict(book=book, symbol=sym, entry=entry, stop=stop, target=target, last=last, order=order, sector=sector, horizon=horizon,
             max_days=5 if horizon == "swing" else 1, formed=f"{book}-{sym}", tf="15dk", grade="B", status="tetik", blocked=[],
             violations=[], rule_keys=[], score=1.0, rr=1.5, name=sym)
    c.update(kw)
    return c


def paper():
    return dict(version=3, start=10000, equity=10000, trades=[], days={})
