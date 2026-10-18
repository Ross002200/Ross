"""2026-10-18: kapanışta alınan işlemde "giriş günü açılış boşluğu" ertesi sabahın boşluğu olarak hesaplanıyordu (alım anında
bilinmeyen, geleceğe ait veri) — ders filtreleri bu yüzden kazananları seçiyordu. Özellik yalnız girişte bilinen veriden kurulmalı."""
from types import SimpleNamespace

import numpy as np
import pandas as pd

import lab

IDX = pd.date_range("2026-10-12", periods=3, freq="B")


def panel():
    f = lambda v: pd.DataFrame({"AAA": v}, index=IDX)
    return SimpleNamespace(idx=IDX, O=f([100.0, 103.0, 110.0]), H=f([101.0, 104.0, 111.0]), L=f([99.0, 102.0, 109.0]),
                           C=f([100.0, 104.0, 108.0]), rs=f([1.0, 1.0, 1.0]), atrp=f([2.0, 2.0, 2.0]), rv=f([1.0, 1.0, 1.0]),
                           e20=f([100.0, 100.0, 100.0]))


def ozellik(t):
    s = pd.Series([True] * 3, index=IDX)
    return lab.features(panel(), t, s, s, {})


def test_kapanista_alimda_bosluk_sinyal_gununun_kendi_acilisi():
    t = dict(i=1, sym="AAA", sig=str(IDX[1].date()), entry_d=str(IDX[1].date()), entry=104.0, stop=97.0)
    assert round(ozellik(t)["gap"], 4) == round((103 / 100 - 1) * 100, 4)          # ertesi sabahın 110/104'ü değil


def test_acilista_alimda_bosluk_giris_sabahinin_acilisi():
    t = dict(i=1, sym="AAA", sig=str(IDX[1].date()), entry_d=str(IDX[2].date()), entry=110.0, stop=104.0)
    assert round(ozellik(t)["gap"], 4) == round((110 / 104 - 1) * 100, 4)          # alım o açılışta, boşluk görülerek yapılır


def test_bekleyen_sinyalde_bosluk_bilinmez():
    t = dict(i=2, sym="AAA", sig=str(IDX[2].date()), entry_d=None, entry=108.0, stop=100.0)
    assert np.isnan(ozellik(t)["gap"])


def test_connors_genis_stop_degiskeni_laboratuvarda():
    """2026-10-18 araştırma: Connors RSI(2)'yi stopsuz işletiyordu; dip alımında dar stop kazanma oranını düşürür.
    Laboratuvar aynı kuralı geniş stopla (%12, simülasyonun izin verdiği en geniş) ve 10 gün tutmayla sınar."""
    st = next(s for s in lab.STRATS if s["id"] == "connors_close_genis")
    assert st["fn"] is lab.S_connors_close_genis and "%12" in st["rules"]
