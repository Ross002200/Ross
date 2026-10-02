"""Laboratuvar: trade şampiyonlarının sistemleri, kurallara dökülüp bakiye harcamadan denenir.

Her strateji:
  1. Son 2 yılın günlük verisinde (S&P 500 + likit hisseler) tek tek işlem işlem test edilir (en az ~100 işlem hedeflenir).
     İlk yıl "öğrenme", ikinci yıl "sınav" dönemidir.
  2. Öğrenme dönemindeki kaybeden işlemler incelenir: kayıpları en çok azaltan tek bir filtre ("ders") aranır.
     Ders sınav döneminde de işe yarıyorsa stratejinin "+ders" sürümü açılır; yaramazsa ezber sayılıp bırakılır.
  3. Kurallar sabit kaldığı için, LAB_START'tan sonraki sinyaller canlı kâğıt deneme sayılır (geriye dönük değil, ileriye).
  4. Mezuniyet (kullanıcının kuralı + komisyon güvencesi): canlı denemede en az 10 işlem, %60+ kazanma oranı ve
     komisyon sonrası artı net; ayrıca sınav dönemi de artı olmalı. Mezun olan stratejinin sinyalleri ana ekrana ve
     bildirimlere "Lab onaylı" olarak girer.
Hesap: her işlem sanal 1.000 $'ın tamamıyla (kaldıraçsız tek pozisyon), emir başı 1,5 $ komisyon.
Gerçek emir yok, kaldıraç yok. Aynı gün hem stop hem hedef görülürse stop sayılır (kötümser).
"""
import json
import math
import os
import pickle
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402

LAB = S.DATA / "lab.json"
LAB_START = "2026-10-02"
BAL, RISK, FEE = 1000.0, 0.02, 1.5
ETFS = ["SPY", "QQQ", "XLK", "XLV", "XLI", "XLF", "XLE", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC", "SMH"]


# ---------------------------------------------------------------- indicators
def ema(x, n):
    return x.ewm(span=n, adjust=False).mean()


def sma(x, n):
    return x.rolling(n).mean()


def rsi(c, n):
    d = c.diff()
    up, dn = d.clip(lower=0), (-d).clip(lower=0)
    rs = up.ewm(alpha=1 / n, adjust=False).mean() / dn.ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + rs)


def adx(h, l, c, n=14):
    up, dn = h.diff(), -l.diff()
    pdm = up.where((up > dn) & (up > 0), 0.0)
    ndm = dn.where((dn > up) & (dn > 0), 0.0)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / n, adjust=False).mean()
    pdi = 100 * pdm.ewm(alpha=1 / n, adjust=False).mean() / atr
    ndi = 100 * ndm.ewm(alpha=1 / n, adjust=False).mean() / atr
    dx = 100 * (pdi - ndi).abs() / (pdi + ndi).replace(0, np.nan)
    return dx.ewm(alpha=1 / n, adjust=False).mean(), pdi, ndi


class P:  # panel of wide frames (dates x symbols)
    pass


def panel(d1, syms):
    p = P()
    get = lambda k: pd.DataFrame({s: d1[s][k] for s in syms})
    p.O, p.H, p.L, p.C, p.V = get("Open"), get("High"), get("Low"), get("Close"), get("Volume")
    p.idx = p.C.index
    p.tr = pd.concat({s: pd.concat([p.H[s] - p.L[s], (p.H[s] - p.C[s].shift()).abs(), (p.L[s] - p.C[s].shift()).abs()], axis=1).max(axis=1) for s in syms}, axis=1)
    p.atr = p.tr.rolling(14).mean()
    p.atrp = p.atr / p.C * 100
    p.adr = ((p.H / p.L - 1) * 100).rolling(20).mean()
    p.e10, p.e20, p.e21, p.e50 = ema(p.C, 10), ema(p.C, 20), ema(p.C, 21), ema(p.C, 50)
    p.s5, p.s25, p.s50, p.s150, p.s200 = sma(p.C, 5), sma(p.C, 25), sma(p.C, 50), sma(p.C, 150), sma(p.C, 200)
    p.vavg = p.V.rolling(50).mean().shift(1)
    p.v20 = p.V.rolling(20).mean().shift(1)
    p.rv = p.V / p.v20
    p.dv = (p.C * p.V).rolling(20).mean()
    p.rs = (p.C / p.C.shift(63)).rank(axis=1, pct=True) * 100
    p.hi252, p.lo252 = p.H.rolling(252, min_periods=150).max(), p.L.rolling(252, min_periods=150).min()
    p.liquid = (p.C >= 5) & (p.dv >= 2e7)
    return p


# ---------------------------------------------------------------- simulation
def sim_daily(p, s, i, entry, stop, target=None, trail=None, min_hold=2, max_hold=20, lod=False):
    """One trade. entry: 'open' (next open) or ('stop', level) = buy-stop valid for the next day only.
    stop: price or callable(entry, j) -> price. trail: frame name to close below (e10/e20/s5-above...). Returns dict or None."""
    O, H, L, C = p.O[s].values, p.H[s].values, p.L[s].values, p.C[s].values
    n = len(O)
    j = i + 1
    if j >= n:  # signal on the last close: tomorrow's order
        e = C[i] if entry == "open" else entry[1]
        try:
            st = stop(e, i + 1) if callable(stop) else stop
        except Exception:
            st = e * 0.95
        return dict(sym=s, sig=str(p.idx[i].date()), entry_d=None, exit_d=None, status="bekliyor", i=i,
                    plan=("açılışta" if entry == "open" else f"{e:.2f} $ üstüne çıkarsa (alış-stop emri)"), entry=round(float(e), 2), stop=round(float(min(st, e * 0.995)), 2))
    if np.isnan(O[j]):
        return None
    if entry == "open":
        e = O[j]
    else:
        lvl = entry[1]
        if H[j] < lvl:
            return None
        e = max(O[j], lvl)
    st = stop(e, j) if callable(stop) else stop
    if not (st < e) or (e - st) / e > 0.12:
        return None
    st0 = st
    tgt = target(e, st) if callable(target) else target
    tr = getattr(p, trail)[s].values if isinstance(trail, str) and trail != "s5up" else None
    k = j
    while k < n:
        o, h, l, c = O[k], H[k], L[k], C[k]
        if np.isnan(c):
            return None
        if k > j and o <= st:
            return _res(p, s, i, j, k, e, st0, o, "stop")
        if l <= st:
            return _res(p, s, i, j, k, e, st0, st, "stop")
        if lod and k == j:
            st = max(st, L[j])  # Kullamägi: after the entry day the stop moves up to the entry day's low
        if tgt is not None and h >= tgt:
            return _res(p, s, i, j, k, e, st0, max(o, tgt) if k > j else tgt, "hedef")
        held = k - j + 1
        if trail == "s5up" and c > p.s5[s].values[k] and held >= 1:
            return _res(p, s, i, j, k, e, st0, c, "çıkış")
        if tr is not None and held >= min_hold and c < tr[k]:
            return _res(p, s, i, j, k, e, st0, c, "çıkış")
        if held >= max_hold:
            return _res(p, s, i, j, k, e, st0, c, "süre")
        k += 1
    return dict(sym=s, sig=str(p.idx[i].date()), entry_d=str(p.idx[j].date()), exit_d=None, entry=round(float(e), 2), stop=round(float(st), 2),
                status="açık", i=i)


def _res(p, s, i, j, k, e, st, x, why):
    pos = BAL  # whole budget in one position, no leverage (how the user trades)
    pnl = pos * (x / e - 1) - 2 * FEE
    return dict(sym=s, sig=str(p.idx[i].date()), entry_d=str(p.idx[j].date()), exit_d=str(p.idx[k].date()), days=int(k - j + 1),
                entry=round(float(e), 2), stop=round(float(st), 2), exit=round(float(x), 2), why=why, pct=round(float((x / e - 1) * 100), 2),
                r=round(float((x - e) / (e - st)), 2), pnl=round(float(pnl), 2), pos=round(float(pos), 0), i=i)


def run_signals(p, mask, make, cool=True):
    """mask: bool frame of signal days. make(s, i) -> kwargs for sim_daily or None. No overlapping trades per symbol."""
    out = []
    m = (mask & p.liquid).fillna(False)
    for s in m.columns:
        idxs = np.flatnonzero(m[s].values)
        busy = -1
        for i in idxs:
            if i < 210 or i <= busy:
                continue
            kw = make(s, i)
            if not kw:
                continue
            t = sim_daily(p, s, i, **kw)
            if t:
                out.append(t)
                if cool and t.get("exit_d"):
                    busy = i + 1 + t["days"]
                elif t.get("status") == "açık":
                    busy = 10 ** 9
    return out


# ---------------------------------------------------------------- strategies (rules written from each trader's published method)
def S_minervini(p):
    tt = ((p.C > p.s50) & (p.s50 > p.s150) & (p.s150 > p.s200) & (p.s200 > p.s200.shift(21)) & (p.C >= 1.25 * p.lo252)
          & (p.C >= 0.75 * p.hi252) & (p.rs >= 70))
    h10, l10 = p.H.rolling(10).max(), p.L.rolling(10).min()
    tight = ((h10 - l10) / p.C < 0.10) & (p.V.rolling(10).mean() < p.vavg)
    mask = tt & tight
    return run_signals(p, mask, lambda s, i: dict(entry=("stop", float(h10[s].iloc[i]) * 1.001),
                                                   stop=lambda e, j, s=s, i=i: max(float(l10[s].iloc[i]), e * 0.92),
                                                   target=lambda e, st: e * 1.20, trail="e20", min_hold=5, max_hold=40))


def S_kullamagi_breakout(p):
    prior = (p.C / p.C.shift(63) >= 1.30) | (p.C / p.C.shift(21) >= 1.25)
    h10, l10 = p.H.rolling(10).max(), p.L.rolling(10).min()
    cons = ((h10 - l10) / p.C < 0.12) & (p.C > p.e10) & (p.e10 > p.e20) & (p.adr >= 3.0)
    mask = prior & cons
    return run_signals(p, mask, lambda s, i: dict(entry=("stop", float(h10[s].iloc[i]) * 1.001),
                                                   stop=lambda e, j, s=s: e - float(p.atr[s].iloc[j - 1]),
                                                   trail="e10", min_hold=3, max_hold=60, lod=True))


def S_kullamagi_ep(p):
    gap = p.O / p.C.shift() - 1
    mask = (gap >= 0.08) & (p.rv >= 3) & (p.C > p.O) & ((p.C - p.L) / (p.H - p.L).replace(0, np.nan) >= 0.5) & (p.C.shift() / p.C.shift(63) < 1.5)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: max(float(p.L[s].iloc[i]), e * 0.90),
                                                   trail="e10", min_hold=3, max_hold=40))


def S_kell_crossback(p):
    up = (p.e10 > p.e20) & (p.e20 > p.e50) & (p.e20 > p.e20.shift(5))
    mask = up & (p.C.shift() < p.e10.shift()) & (p.C > p.e10) & (p.C > p.O) & (p.L.rolling(3).min() <= p.e20 * 1.01)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: max(float(p.L[s].iloc[i - 2:i + 1].min()), e - 1.5 * float(p.atr[s].iloc[i])),
                                                   trail="e20", min_hold=3, max_hold=30))


def S_raschke_grail(p):
    a, pdi, ndi = {}, {}, {}
    for s in p.C.columns:
        a[s], pdi[s], ndi[s] = adx(p.H[s], p.L[s], p.C[s])
    A, PDI, NDI = pd.DataFrame(a), pd.DataFrame(pdi), pd.DataFrame(ndi)
    mask = (A > 30) & (PDI > NDI) & (p.L <= p.e20) & (p.C > p.e20 * 0.98) & (p.C.shift() > p.e20.shift())
    hi20 = p.H.rolling(20).max()
    return run_signals(p, mask, lambda s, i: dict(entry=("stop", float(p.H[s].iloc[i]) * 1.001), stop=float(p.L[s].iloc[i]) * 0.999,
                                                   target=float(hi20[s].iloc[i]) if hi20[s].iloc[i] > p.H[s].iloc[i] * 1.01 else None,
                                                   trail=None, max_hold=10))


def S_bnf_kairi(p):
    dev = p.C / p.s25 - 1
    mask = (dev <= -0.15) & (p.dv >= 5e7)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j: e * 0.90,
                                                   target=lambda e, st, s=s, i=i: float(p.s25[s].iloc[i]) * 0.97, trail=None, max_hold=10))


def S_breitstein_capit(p):
    drop5 = p.C / p.C.shift(5) - 1
    downs = (p.C < p.C.shift()).rolling(3).sum() == 3
    mask = downs & (drop5 <= -3 * p.atrp / 100) & (p.rv >= 2) & ((p.C - p.L) / (p.H - p.L).replace(0, np.nan) >= 0.4) & (p.C > p.s200 * 0.8)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: min(float(p.L[s].iloc[i]) - 0.25 * float(p.atr[s].iloc[i]), e * 0.97),
                                                   target=lambda e, st, s=s, i=i: float(p.e10[s].iloc[i]) if p.e10[s].iloc[i] > e * 1.01 else e * 1.04,
                                                   trail=None, max_hold=5))


def S_jlaw_momentum(p):
    mask = (p.C >= p.hi252.shift()) & (p.rs >= 90) & (p.rv >= 1.5) & (p.C > p.e20) & ((p.C - p.L) / (p.H - p.L).replace(0, np.nan) >= 0.6)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: max(e - 1.5 * float(p.atr[s].iloc[i]), e * 0.92),
                                                   trail="e10", min_hold=3, max_hold=40))


def S_luk_sector(p, sector_of):
    sec_r = {etf: p.C[etf] / p.C[etf].shift(21) - 1 for etf in S.SECTOR_ETF.values() if etf in p.C}
    R = pd.DataFrame(sec_r)
    top3 = R.rank(axis=1, ascending=False) <= 3
    hot = pd.DataFrame({s: top3[S.SECTOR_ETF[sector_of[s]]] if sector_of.get(s) in S.SECTOR_ETF and S.SECTOR_ETF[sector_of[s]] in top3 else False
                        for s in p.C.columns}, index=p.idx)
    h5, l5 = p.H.rolling(5).max(), p.L.rolling(5).min()
    tight = (h5 - l5) / p.C < 1.5 * p.adr / 100
    mask = hot & (p.rs >= 85) & tight & (p.C > p.e10) & (p.e10 > p.e21)
    return run_signals(p, mask, lambda s, i: dict(entry=("stop", float(h5[s].iloc[i]) * 1.001), stop=lambda e, j, s=s, i=i: max(float(l5[s].iloc[i]), e * 0.92),
                                                   trail="e21", min_hold=3, max_hold=40))


def S_connors_rsi2(p):
    r2 = pd.DataFrame({s: rsi(p.C[s], 2) for s in p.C.columns})
    mask = (p.C > p.s200) & (r2 < 10)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j: e * 0.93, trail="s5up", max_hold=10))


def S_pead(p):
    """Post-earnings drift. Daily data has no earnings calendar, so the earnings reaction is proxied by a large gap
    on heavy volume that holds into the close inside an existing uptrend (the classic PEAD footprint)."""
    gap = p.O / p.C.shift() - 1
    mask = ((gap >= 0.04) & (p.rv >= 3) & (p.C > p.O) & ((p.C - p.L) / (p.H - p.L).replace(0, np.nan) >= 0.5)
            & (p.C > p.s50) & (p.s50 > p.s50.shift(10)))
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: max(float(p.L[s].iloc[i]), e * 0.92),
                                                   trail="e20", min_hold=5, max_hold=40))


def S_diogenes_trend(p):
    hi20 = p.H.rolling(20).max().shift()
    mask = (p.C > hi20) & (p.rv >= 1.5) & (p.C > p.e20) & (p.e20 > p.e50) & (p.rs >= 80) & (p.atrp >= 2) & (p.atrp <= 7)
    return run_signals(p, mask, lambda s, i: dict(entry="open", stop=lambda e, j, s=s, i=i: max(e - 1.5 * float(p.atr[s].iloc[i]), e * 0.92),
                                                   trail="e10", min_hold=3, max_hold=20))


STRATS = [
    dict(id="minervini", name="Mark Minervini · VCP / SEPA", who="ABD · 1997 ve 2021 ABD Yatırım Şampiyonu", kind="swing",
         rules="Trend şablonu (fiyat > 50 > 150 > 200 günlük ortalama, 200 günlük yükseliyor, 52 hafta dibinin %25+ üstü, zirveye %25 yakın, RS ≥ 70). "
               "Son 10 gün dar (aralık < %10) ve hacim kuruyor. 10 günlük zirvenin kırılımında al; stop sıkışmanın dibi (en fazla %8). "
               "+%20'de sat ya da 20 günlük ortalamanın altında kapanınca çık.", fn=S_minervini),
    dict(id="kullamagi_bo", name="Kristjan Kullamägi · Kırılım", who="İsveç · 2021'de vergi kayıtlarıyla belgeli yüz milyonlarca kron", kind="swing",
         rules="Son 1-3 ayda %25-30+ yükselmiş, günlük ortalama aralığı ≥ %3 hisse; 10 gün dar konsolidasyon, fiyat 10 > 20 günlük ortalama. "
               "Konsolidasyon zirvesinin kırılımında al; stop giriş gününün dibi (≤ 1 ATR). 10 günlük ortalamanın altında kapanınca çık.", fn=S_kullamagi_breakout),
    dict(id="kullamagi_ep", name="Kristjan Kullamägi · Episodik pivot", who="İsveç · haberle gelen büyük boşluk", kind="swing",
         rules="Haberle %8+ boşlukla açılış, hacim 3 kat, gün güçlü kapanış; önceden aşırı yükselmemiş. Ertesi açılışta al; stop boşluk gününün dibi (≤ %10). "
               "10 günlük ortalamanın altında kapanınca çık.", fn=S_kullamagi_ep),
    dict(id="kell", name="Oliver Kell · EMA geri dönüşü", who="ABD · 2020 ABD Yatırım Şampiyonu (+%941)", kind="swing",
         rules="10 > 20 > 50 günlük ortalama ve yükseliyor. Geri çekilmede 20 günlüğe değip fiyat yeniden 10 günlüğün üstünde yeşil kapanınca ertesi açılışta al. "
               "Stop son 3 günün dibi (≤ 1,5 ATR). 20 günlüğün altında kapanınca çık.", fn=S_kell_crossback),
    dict(id="raschke", name="Linda Raschke · Holy Grail", who="ABD · 30+ yıl profesyonel, Street Smarts", kind="kısa swing",
         rules="ADX > 30 ve yön yukarı (güçlü trend). Fiyat 20 günlük ortalamaya geri çekilir; ertesi gün o günün tepesi aşılırsa al. "
               "Stop geri çekilme günü dibi; hedef son 20 günün zirvesi; en fazla 10 gün.", fn=S_raschke_grail),
    dict(id="bnf", name="Takashi Kotegawa (BNF) · Sapma oranı", who="Japonya · 13 bin $ → 150 milyon $+", kind="kısa swing",
         rules="Likit hisse 25 günlük ortalamanın %15+ altına düşünce ertesi açılışta al (aşırı satım). "
               "Hedef ortalamanın %97'si; stop %10; en fazla 10 gün.", fn=S_bnf_kairi),
    dict(id="breitstein", name="Lance Breitstein · Kapitülasyon dönüşü", who="ABD · Trillium'un 2020-21 bir numaralı trader'ı", kind="kısa swing",
         rules="3 gün üst üste düşüş, 5 günde 3 ATR'den fazla kayıp, hacim 2 kat, gün dipten dönüşle kapanıyor. Ertesi açılışta al; "
               "stop dönüş günü dibinin biraz altı (≤ %3); hedef 10 günlük ortalama; en fazla 5 gün.", fn=S_breitstein_capit),
    dict(id="jlaw", name="J Law · Yeni zirve momentumu", who="Hong Kong · 2024 rekor (+%354), 2025 +%252", kind="swing",
         rules="52 haftanın zirvesinde, göreli güç ilk %10'da, hacim 1,5 kat, güçlü kapanış. Ertesi açılışta al; stop 1,5 ATR (≤ %8); "
               "10 günlük ortalamanın altında kapanınca çık.", fn=S_jlaw_momentum),
    dict(id="luk", name="Martin Luk · Sıcak sektör lideri", who="Hong Kong · 2025 şampiyonu (+%970)", kind="swing",
         rules="Son 1 ayın en güçlü 3 sektöründen, göreli gücü ilk %15'te hisse; son 5 gün dar, fiyat 10 > 21 günlük ortalama. "
               "5 günlük zirve kırılımında al; stop 5 günlük dip (≤ %8); 21 günlüğün altında kapanınca çık.", fn=None),
    dict(id="connors", name="Larry Connors · RSI(2) geri alım", who="ABD · yüksek isabetli geri çekilme sistemi (karşılaştırma için)", kind="kısa swing",
         rules="Fiyat 200 günlük ortalamanın üstünde ve 2 günlük RSI < 10. Ertesi açılışta al; fiyat 5 günlük ortalamanın üstünde kapanınca sat. "
               "Stop %7; en fazla 10 gün.", fn=S_connors_rsi2),
    dict(id="pead", name="Bilanço sonrası sürüklenme (PEAD)", who="Akademik: Ball & Brown 1968, Bernard & Thomas 1989", kind="swing",
         rules="Bilanço gibi büyük bir haberle %4+ boşluk, hacim 3 kat, gün güçlü kapanış; hisse zaten 50 günlük ortalamanın üstünde ve ortalama yükseliyor. "
               "Ertesi açılışta al; stop boşluk günü dibi (≤ %8); 20 günlük ortalamanın altında kapanınca çık, en fazla 40 gün. "
               "Bilanço takvimi yerine hacimli boşluk vekil olarak kullanılır.", fn=S_pead),
    dict(id="aziz_orb", name="Andrew Aziz · Açılış aralığı kırılımı", who="Kanada · Bear Bull Traders; Zarattini & Aziz akademik ORB çalışması", kind="gün içi",
         rules="'Oyundaki hisse': ilk 15 dakikanın hacmi normalin 2 katı ve en az %1 yukarı açılış (günde en fazla 10). İlk 15 dakikanın tepesi kırılınca al; "
               "stop ilk 15 dakikanın dibi (≤ %3); hedef 2R; olmazsa gün sonunda sat.", fn="aziz"),
    dict(id="diogenes_plan", name="Diogenes · Günün planı (ilk işlem)", who="Bizim canlı kural: tek pozisyon, %2-2,5 stop, 2x hedef", kind="gün içi",
         rules="Trend, RS ≥ 70, dün hacim ≥ 1,2 kat, 5 günde ≤ %8, açılış boşluğu ≤ %1, piyasa kalkanı kapalı. Günün en iyi hissesi açılışta alınır; "
               "stop günlük oynaklığın %70'i (%2-2,5), hedef 2 katı, gün sonunda kapanır.", fn="plan"),
    dict(id="diogenes_trend", name="Diogenes · Trend kırılımı", who="Bizim sistem: 20 günlük zirve + hacim", kind="swing",
         rules="20 günlük zirve kırılımı, hacim 1,5 kat, 20 > 50 günlük ortalama, RS ≥ 80. Ertesi açılışta al; stop 1,5 ATR (≤ %8); "
               "10 günlük ortalamanın altında kapanınca çık; en fazla 20 gün.", fn=S_diogenes_trend),
]


# ---------------------------------------------------------------- intraday strategies (15-minute bars, last ~60 days)
def _intraday_trade(p, s, i_prev, bars, e, st, tgt, k0, why_open):
    for k in range(k0, len(bars)):
        lo, hi = bars["Low"].iloc[k], bars["High"].iloc[k]
        if lo <= st:
            x, why = st, "stop"
            break
        if tgt and hi >= tgt:
            x, why = tgt, "hedef"
            break
    else:
        x, why = float(bars["Close"].iloc[-1]), "gün sonu"
    d = str(bars.index[0].date())
    pnl = BAL * (x / e - 1) - 2 * FEE
    return dict(sym=s, sig=d, entry_d=d, exit_d=d, days=1, entry=round(float(e), 2), stop=round(float(st), 2), exit=round(float(x), 2), why=why,
                pct=round(float((x / e - 1) * 100), 2), r=round(float((x - e) / (e - st)), 2), pnl=round(float(pnl), 2), pos=BAL, i=i_prev, how=why_open)


def intraday(p, m15, kind):
    out = []
    days = sorted(set(m15["SPY"].dropna().index.date)) if "SPY" in m15 else []
    date_pos = {d.date(): n for n, d in enumerate(p.idx)}
    se20 = ema(p.C["SPY"], 20)
    fb = {}
    for s in m15:
        x = m15[s].dropna()
        if len(x):
            g = x.groupby(x.index.date)
            fb[s] = (g, g["Volume"].first())
    for day in days[15:]:
        n = date_pos.get(day)
        if n is None or n < 1:
            continue
        i = n - 1
        rows = []
        for s, (g, fv) in fb.items():
            if s not in p.C or not p.liquid[s].iloc[i] or day not in g.groups:
                continue
            b = g.get_group(day)
            if len(b) < 20:
                continue
            prev = float(p.C[s].iloc[i])
            o = float(b["Open"].iloc[0])
            past = fv[fv.index < day].iloc[-14:]
            fvr = float(b["Volume"].iloc[0] / past.mean()) if len(past) >= 10 and past.mean() > 0 else 0
            rows.append((s, b, prev, o, fvr))
        if kind == "aziz":
            sip = sorted([r for r in rows if r[4] >= 2 and r[3] / r[2] - 1 >= 0.01], key=lambda r: -r[4])[:10]
            for s, b, prev, o, fvr in sip:
                h0, l0 = float(b["High"].iloc[0]), float(b["Low"].iloc[0])
                for k in range(1, 8):
                    if b["High"].iloc[k] >= h0:
                        e = max(h0, float(b["Open"].iloc[k]))
                        st = max(l0, e * 0.97)
                        if st >= e:
                            break
                        out.append(_intraday_trade(p, s, i, b, e, st, e + 2 * (e - st), k, "açılış aralığı kırılımı"))
                        break
        else:  # Diogenes day plan, first trade of the day (same filters as the live plan)
            if p.C["SPY"].iloc[i] < se20.iloc[i] and se20.iloc[i] < se20.iloc[i - 5]:
                continue  # market shield proxy: no trading
            cands = []
            for s, b, prev, o, fvr in rows:
                c, at = p.C[s].iloc[i], p.atrp[s].iloc[i]
                run5 = (c / p.C[s].iloc[i - 5] - 1) * 100
                rv = p.rv[s].iloc[i]
                if not (c > p.e20[s].iloc[i] > p.e50[s].iloc[i] and 2 <= at <= 7 and p.rs[s].iloc[i] >= 70 and rv >= 1.2 and run5 <= 8):
                    continue
                if o / prev - 1 > 0.01:
                    continue
                rng = p.H[s].iloc[i] - p.L[s].iloc[i]
                cp = (c - p.L[s].iloc[i]) / rng if rng > 0 else 0.5
                cands.append((p.rs[s].iloc[i] + 30 * min(rv, 3) + 15 * cp, s, b, o, at))
            if cands:
                _, s, b, o, at = max(cands, key=lambda x: x[0])
                sp = min(2.5, max(2.0, 0.7 * at)) / 100
                out.append(_intraday_trade(p, s, i, b, o, o * (1 - sp), o * (1 + 2 * sp), 0, "açılışta"))
    return out


def load_m15(syms):
    raw = S.download(syms, period="60d", interval="15m")
    out = {}
    for s in syms:
        try:
            x = S.split(raw, s)
            if x is not None and len(x):
                out[s] = x
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- features, lessons
def features(p, t, spy_up, spy_e20up, sec_hot):
    i, s = t["i"], t["sym"]
    j = i + 1
    nxt_o = p.O[s].values[j] if j < len(p.idx) else np.nan
    return dict(spy_up=bool(spy_up.iloc[i]), spy_e20up=bool(spy_e20up.iloc[i]), rs=float(p.rs[s].iloc[i]), atrp=float(p.atrp[s].iloc[i]),
                rv=float(p.rv[s].iloc[i]) if not np.isnan(p.rv[s].iloc[i]) else 1.0, ext=float((p.C[s].iloc[i] / p.e20[s].iloc[i] - 1) * 100),
                gap=float((nxt_o / p.C[s].iloc[i] - 1) * 100), hot=bool(sec_hot.get(s, pd.Series(False, index=p.idx)).iloc[i]),
                stop_pct=float((t["entry"] - t["stop"]) / t["entry"] * 100))


FEATURE_TR = dict(spy_up="S&P 500 50 günlük ortalamanın üstünde", spy_e20up="S&P 500'ün 20 günlük ortalaması yükseliyor", rs="göreli güç",
                  atrp="günlük oynaklık (%)", rv="sinyal günü hacmi (normalin katı)", ext="20 günlük ortalamadan uzaklık (%)",
                  gap="giriş günü açılış boşluğu (%)", hot="sektörü son 1 ayın en güçlü 3 sektöründen", stop_pct="stop mesafesi (%)")


def stats(ts):
    ts = [t for t in ts if t.get("exit_d")]
    if not ts:
        return dict(n=0)
    pnl = np.array([t["pnl"] for t in ts])
    w, l = pnl[pnl > 0], pnl[pnl <= 0]
    eq = np.cumsum(pnl)
    dd = float((np.maximum.accumulate(np.r_[0, eq]) - np.r_[0, eq]).max())
    se = float(pnl.std(ddof=1) / math.sqrt(len(pnl))) if len(pnl) > 1 else None
    return dict(n=len(ts), win=round(100 * len(w) / len(ts), 1), avg_win=round(float(w.mean()), 2) if len(w) else 0, avg_loss=round(float(l.mean()), 2) if len(l) else 0,
                pf=round(float(w.sum() / -l.sum()), 2) if len(l) and l.sum() < 0 else None, exp=round(float(pnl.mean()), 2), se=round(se, 2) if se else None,
                net=round(float(pnl.sum()), 0), fees=round(len(ts) * 2 * FEE, 0),
                fee_share=round(100 * len(ts) * 2 * FEE / (pnl.sum() + len(ts) * 2 * FEE), 0) if pnl.sum() + len(ts) * 2 * FEE > 0 else None, dd=round(dd, 0), days=round(float(np.mean([t["days"] for t in ts])), 1),
                avg_r=round(float(np.mean([t["r"] for t in ts])), 2))


def find_lesson(learn, test):
    """Best single filter on the learning year (keeps >= 40% of trades, >= 30 trades); validated on the test year."""
    if len(learn) < 60:
        return None
    df = pd.DataFrame([dict(t["f"], pnl=t["pnl"]) for t in learn])
    base = df.pnl.mean()
    best = None
    for col in df.columns:
        if col == "pnl":
            continue
        if df[col].dtype == bool:
            cands = [(col, "==", True), (col, "==", False)]
        else:
            qs = df[col].quantile([.2, .3, .4, .5, .6, .7, .8]).unique()
            cands = [(col, op, float(q)) for q in qs for op in ("<=", ">=")]
        for c in cands:
            m = _apply(df, c)
            if m.sum() < max(30, 0.4 * len(df)):
                continue
            gain = df.pnl[m].mean() - base
            if best is None or gain > best[1]:
                best = (c, gain, int(m.sum()))
    if not best or best[1] <= 0.5:
        return None
    c = best[0]
    tdf = pd.DataFrame([dict(t["f"], pnl=t["pnl"]) for t in test]) if test else pd.DataFrame()
    held = None
    if len(tdf) >= 20:
        tm = _apply(tdf, c)
        held = dict(base=round(float(tdf.pnl.mean()), 2), filt=round(float(tdf.pnl[tm].mean()), 2) if tm.sum() else None, n=int(tm.sum()), n_all=len(tdf))
    return dict(feature=c[0], op=c[1], value=c[2], text=_lesson_text(c), learn_base=round(float(base), 2), learn_filt=round(float(base + best[1]), 2),
                learn_n=best[2], learn_all=len(df), test=held,
                works=bool(held and held["filt"] is not None and held["filt"] > held["base"] and held["filt"] > 0))


def _apply(df, c):
    col, op, v = c
    if op == "==":
        return df[col] == v
    return df[col] <= v if op == "<=" else df[col] >= v


def _lesson_text(c):
    col, op, v = c
    name = FEATURE_TR.get(col, col)
    if op == "==":
        return f"Yalnız '{name}' {'doğruyken' if v else 'yanlışken'} işlem aç"
    return f"Yalnız {name} {'≤' if op == '<=' else '≥'} {v:.1f} iken işlem aç"


def mistakes(ts):
    """Plain-language error report on the losing trades."""
    lost = [t for t in ts if t.get("exit_d") and t["pnl"] <= 0]
    if len(lost) < 10:
        return []
    df = pd.DataFrame([dict(t["f"], why=t["why"], days=t["days"]) for t in lost])
    allf = pd.DataFrame([t["f"] for t in ts if t.get("exit_d")])
    out = []
    intra = all(t.get("days") == 1 for t in ts if t.get("exit_d"))
    quick = (df.why == "stop") & (df.days <= 2)
    out.append(f"Kayıpların %{100 * quick.mean():.0f}'i {'stopla' if intra else 'ilk 2 günde stopla'} kapandı"
               + (" — giriş zamanlaması/stop mesafesi sorunu." if quick.mean() > .4 else "."))
    small = df.why.isin(["gün sonu", "süre", "çıkış"]).mean()
    if small > .4:
        out.append(f"Kayıpların %{100 * small:.0f}'i stopa değmeden küçük zararla kapandı: komisyon (işlem başı 3 $) bu işlemleri eksiye çeviriyor.")
    if allf.spy_up.mean() - df.spy_up.mean() > 0.08:
        out.append(f"Kayıpların %{100 * (1 - df.spy_up.mean()):.0f}'i piyasa (S&P 500) zayıfken; tüm işlemlerde bu oran %{100 * (1 - allf.spy_up.mean()):.0f}.")
    if df.gap.mean() - allf.gap.mean() > 0.3:
        out.append(f"Kaybedenler girişte ortalama %{df.gap.mean():+.1f} boşlukla açıldı (hepsi: %{allf.gap.mean():+.1f}) — boşluklu açılışta kovalama.")
    if df.ext.mean() - allf.ext.mean() > 1:
        out.append(f"Kaybedenler 20 günlük ortalamadan daha uzaktı (%{df.ext.mean():.1f} / %{allf.ext.mean():.1f}) — fazla yükselmişken alım.")
    if allf.hot.mean() - df.hot.mean() > 0.06:
        out.append("Kaybedenlerde güçlü sektör oranı daha düşük — sektör seçimi önemli.")
    return out


# ---------------------------------------------------------------- risk tools
def monte_carlo(ts, runs=3000, seed=7):
    """Reshuffle the strategy's own trades: one month (~20 trades) outcomes and the chance of a 20% drawdown in 60 trades."""
    pnl = np.array([t["pnl"] for t in ts if t.get("exit_d")])
    if len(pnl) < 30:
        return None
    rng = np.random.default_rng(seed)
    m20 = rng.choice(pnl, size=(runs, 20)).sum(axis=1)
    path = np.cumsum(rng.choice(pnl, size=(runs, 60)), axis=1)
    ruin = float((path.min(axis=1) <= -0.2 * BAL).mean())
    return dict(m20_median=round(float(np.median(m20)), 0), m20_p05=round(float(np.percentile(m20, 5)), 0), m20_p95=round(float(np.percentile(m20, 95)), 0),
                m20_pos=round(100 * float((m20 > 0).mean()), 0), dd20_60=round(100 * ruin, 1), runs=runs)


def vix_overlay(ts, vix):
    """Smaller position when VIX is high: size = 1000 x clip(20 / VIX, 0.5, 1). Commission stays 3 $."""
    if vix is None:
        return None
    a, b = [], []
    for t in ts:
        if not t.get("exit_d"):
            continue
        v = vix.get(t["sig"])
        if v is None or np.isnan(v):
            continue
        k = float(np.clip(20 / v, 0.5, 1.0))
        a.append(t["pnl"])
        b.append((t["pnl"] + 2 * FEE) * k - 2 * FEE)
    if len(a) < 30:
        return None
    dd = lambda x: float((np.maximum.accumulate(np.r_[0, np.cumsum(x)]) - np.r_[0, np.cumsum(x)]).max())
    sh = lambda x: float(np.mean(x) / np.std(x)) if np.std(x) else 0
    return dict(n=len(a), base_exp=round(float(np.mean(a)), 2), vix_exp=round(float(np.mean(b)), 2), base_dd=round(dd(a), 0), vix_dd=round(dd(b), 0),
                base_q=round(sh(a), 3), vix_q=round(sh(b), 3), better=bool(sh(b) > sh(a)))


# ---------------------------------------------------------------- data
def load(dev_cache=None):
    if dev_cache and Path(dev_cache).exists():
        D = pickle.load(open(dev_cache, "rb"))
        return D["d1"], D["uni"]
    import universe
    uni = universe.load()
    syms = sorted(set([s for s in uni if "^" not in s and (uni[s] or {}).get("sector") != "ETF"] + ETFS + ["^VIX"]))
    raw = S.download(syms, period="2y", interval="1d")
    return raw, uni


def main():
    d1, uni = load(os.environ.get("LAB_CACHE"))
    close = d1.xs("Close", axis=1, level=1)
    while len(close) and close.iloc[-1].notna().mean() < 0.5:  # half-filled last row (download during the session)
        d1, close = d1.iloc[:-1], close.iloc[:-1]
    cols = sorted(set(c[0] for c in d1.columns))
    syms = [s for s in cols if s not in ETFS and not s.startswith("^") and (uni.get(s) or {}).get("sector") != "ETF" and d1[s]["Close"].notna().sum() > 260]
    keep = syms + [e for e in ETFS if e in cols]
    p = panel(d1, keep)
    for k in ("liquid",):
        getattr(p, k)[[e for e in ETFS if e in p.C.columns]] = False
    spy = p.C["SPY"]
    spy_up = spy > ema(spy, 50)
    se20 = ema(spy, 20)
    spy_e20up = se20 > se20.shift(5)
    sector_of = {s: (uni.get(s) or {}).get("sector") for s in syms}
    sec_r = pd.DataFrame({etf: p.C[etf] / p.C[etf].shift(21) - 1 for etf in S.SECTOR_ETF.values() if etf in p.C})
    top3 = sec_r.rank(axis=1, ascending=False) <= 3
    sec_hot = {s: top3[S.SECTOR_ETF[sector_of[s]]] for s in syms if sector_of.get(s) in S.SECTOR_ETF and S.SECTOR_ETF[sector_of[s]] in top3}
    split = p.idx[(210 + len(p.idx)) // 2]
    old = json.loads(LAB.read_text()) if LAB.exists() else {}
    old_fw = {x["id"]: x.get("forward", []) for x in old.get("strategies", [])}
    out = []
    m15 = None
    trades_by = {}
    for st in STRATS:
        if st["fn"] in ("aziz", "plan"):
            if m15 is None:
                liq = p.dv.iloc[-1][syms].sort_values(ascending=False).index[:300].tolist()
                m15 = load_m15(liq + ["SPY"]) if not os.environ.get("LAB_M15") else pickle.load(open(os.environ["LAB_M15"], "rb"))
            ts = intraday(p, m15, st["fn"])
        else:
            fn = st["fn"] or (lambda pp: S_luk_sector(pp, sector_of))
            ts = fn(p)
        for t in ts:
            t["f"] = features(p, t, spy_up, spy_e20up, sec_hot)
        trades_by[st["id"]] = ts
        hist = [t for t in ts if t["sig"] < LAB_START and t.get("exit_d")]
        sp_ = split if st["kind"] != "gün içi" else pd.Timestamp(sorted(t["sig"] for t in hist)[len(hist) // 2]) if hist else split
        learn = [t for t in hist if pd.Timestamp(t["sig"]) < sp_]
        test = [t for t in hist if pd.Timestamp(t["sig"]) >= sp_]
        lesson = find_lesson(learn, test)
        entry = dict(id=st["id"], name=st["name"], who=st["who"], kind=st["kind"], rules=st["rules"],
                     backtest=stats(hist), learn=stats(learn), test=stats(test), lesson=lesson, mistakes=mistakes(hist),
                     recent=[_slim(t) for t in sorted(hist, key=lambda t: t["sig"])[-8:]])
        variants = [(entry, ts)]
        if lesson and lesson["works"]:
            c = (lesson["feature"], lesson["op"], lesson["value"])
            ts2 = [t for t in ts if bool(_apply(pd.DataFrame([t["f"]]), c).iloc[0])]
            hist2 = [t for t in ts2 if t["sig"] < LAB_START and t.get("exit_d")]
            v2 = dict(id=st["id"] + "_ders", name=st["name"] + " + ders", who=st["who"], kind=st["kind"], rules=st["rules"] + " Ders filtresi: " + lesson["text"] + ".",
                      backtest=stats(hist2), learn=stats([t for t in hist2 if pd.Timestamp(t["sig"]) < sp_]),
                      test=stats([t for t in hist2 if pd.Timestamp(t["sig"]) >= sp_]), lesson=None, parent=st["id"], mistakes=mistakes(hist2),
                      recent=[_slim(t) for t in sorted(hist2, key=lambda t: t["sig"])[-8:]])
            variants.append((v2, ts2))
        for e, tl in variants:
            fw_new = [_slim(t) for t in tl if t["sig"] >= LAB_START]
            e["forward"] = _merge(old_fw.get(e["id"], []), fw_new)
            e["forward"] = [t for t in e["forward"] if t.get("status") != "bekliyor" or t["sig"] == str(p.idx[-1].date())]  # stale pending orders expire
            e["live"] = stats([t for t in e["forward"] if t.get("exit_d")])
            e["open"] = [t for t in e["forward"] if not t.get("exit_d")]
            e["status"], e["status_why"] = verdict(e)
            e["pending"] = [_slim(t) for t in tl if t.get("status") == "bekliyor"]
            out.append(e)
    def derived(eid, name, who, kind, rules, tl):
        hist = [t for t in tl if t["sig"] < LAB_START and t.get("exit_d")]
        e = dict(id=eid, name=name, who=who, kind=kind, rules=rules, backtest=stats(hist), learn=stats([t for t in hist if pd.Timestamp(t["sig"]) < split]),
                 test=stats([t for t in hist if pd.Timestamp(t["sig"]) >= split]), lesson=None, mistakes=mistakes(hist),
                 recent=[_slim(t) for t in sorted(hist, key=lambda t: t["sig"])[-8:]])
        e["forward"] = _merge(old_fw.get(eid, []), [_slim(t) for t in tl if t["sig"] >= LAB_START])
        e["forward"] = [t for t in e["forward"] if t.get("status") != "bekliyor" or t["sig"] == str(p.idx[-1].date())]
        e["live"] = stats([t for t in e["forward"] if t.get("exit_d")])
        e["open"] = [t for t in e["forward"] if not t.get("exit_d")]
        e["status"], e["status_why"] = verdict(e)
        e["pending"] = [_slim(t) for t in tl if t.get("status") == "bekliyor"]
        out.append(e)
        trades_by[eid] = tl

    # idea from the BNF lesson: trend breakouts while the market trend is up, deep-dip buying while it is not
    if "diogenes_trend" in trades_by and "bnf" in trades_by:
        derived("rejim", "Diogenes · Rejim değiştirici", "Laboratuvarın kendi fikri (BNF dersinden)", "swing",
                "S&P 500'ün 20 günlük ortalaması yükselirken Diogenes trend kırılımı, yükselmiyorken BNF sapma alımı. "
                "Piyasa güçlüyken kazananı izle, zayıfken aşırı satılanı al.",
                [t for t in trades_by["diogenes_trend"] if t["f"]["spy_e20up"]] + [t for t in trades_by["bnf"] if not t["f"]["spy_e20up"]])
    # confluence: the same stock signalled by two or more different (swing) systems within 3 trading days
    base_ids = [x["id"] for x in STRATS if x["kind"] != "gün içi"]
    sigs = {}
    for sid in base_ids:
        for t in trades_by.get(sid, []):
            sigs.setdefault(t["sym"], []).append((t["i"], base_ids.index(sid), sid, t))
    conf = []
    for sym, lst in sigs.items():
        lst.sort(key=lambda x: (x[0], x[1]))
        busy = -1
        for n_, (i, pri, sid, t) in enumerate(lst):
            if i <= busy:
                continue
            others = {x[2] for x in lst if 0 <= i - x[0] <= 3 and x[2] != sid}
            if others:
                t2 = dict(t, confl=sorted(others | {sid}))
                conf.append(t2)
                busy = i + 1 + (t.get("days") or 10 ** 6)
    derived("birlesim", "Diogenes · Strateji birleşimi", "Laboratuvarın fikri: iki sistem aynı hisseyi seçerse", "swing",
            "Aynı hisseye 3 işlem günü içinde en az iki farklı şampiyon sistemi sinyal verirse, ilk sinyalin kurallarıyla işleme girilir.", conf)

    vix = None
    if "^VIX" in cols:
        vix = {str(d.date()): float(v) for d, v in d1["^VIX"]["Close"].items() if not np.isnan(v)}
    for e in out:
        tl = trades_by.get(e["id"]) or []
        if e["id"].endswith("_ders"):
            par = e["id"][:-5]
            les = next((x["lesson"] for x in out if x["id"] == par and x.get("lesson")), None)
            tl = [t for t in trades_by.get(par, []) if les and bool(_apply(pd.DataFrame([t["f"]]), (les["feature"], les["op"], les["value"])).iloc[0])]
        hist = [t for t in tl if t["sig"] < LAB_START and t.get("exit_d")]
        try:
            e["tools"] = dict(mc=monte_carlo(hist), vix=vix_overlay(hist, vix))
        except Exception as ex:
            e["tools"] = dict(error=str(ex))
    news = None
    try:
        import news_score
        news = news_score.update(p)
    except Exception as ex:
        print(f"haber isabeti: {ex}", file=sys.stderr)
    graduated = [e["id"] for e in out if e["status"] == "mezun"]
    res = dict(updated=datetime.now(timezone.utc).isoformat(timespec="seconds"), lab_start=LAB_START, split=str(split.date()),
               period=[str(p.idx[210].date()), str(p.idx[-1].date())], universe=len(syms), strategies=out, graduated=graduated, news=news,
               rule=dict(min_trades=10, min_win=60, need_net=True, need_test=True,
                         text="Canlı denemede en az 10 işlem, %60+ kazanma ve komisyon sonrası artı; geçmiş testin sınav yılı da artı olmalı."))
    alerts(old, res)
    LAB.write_text(json.dumps(res, ensure_ascii=False, indent=0, default=_js))
    for e in out:
        b, t = e["backtest"], e["test"]
        print(f"{e['name'][:44]:44} n={b.get('n'):4} win%={b.get('win')} exp={b.get('exp')} net={b.get('net')} | sınav n={t.get('n')} exp={t.get('exp')} | {e['status']}")


def _js(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return str(o)


def _slim(t):
    return {k: v for k, v in t.items() if k not in ("i", "f")}


def _merge(old, new):
    m = {(t["sym"], t["sig"]): t for t in old}
    for t in new:
        m[(t["sym"], t["sig"])] = t
    return sorted(m.values(), key=lambda t: t["sig"])


def verdict(e):
    lv, ts = e["live"], e["test"]
    n = lv.get("n", 0)
    if ts.get("n", 0) >= 20 and (ts.get("exp") or 0) < 0 and (e["backtest"].get("exp") or 0) < 0:
        base = "zayıf"
        why = "Geçmiş testte komisyon sonrası eksi; canlı deneme sürüyor ama mezuniyet için önce kanıt gerekiyor."
    else:
        base = "deneniyor"
        why = "Geçmiş test umut verici; canlı denemede 10 işlem bekleniyor."
    if n >= 10 and lv["win"] >= 60 and lv["net"] > 0 and (ts.get("exp") or 0) > 0:
        return "mezun", f"Canlı denemede {n} işlemde %{lv['win']:.0f} kazanma, net {lv['net']:+.0f} $; sınav yılı da artı."
    if n >= 20 and (lv.get("pf") or 0) >= 1.3 and lv["net"] > 0 and (ts.get("exp") or 0) > 0:
        return "güçlü aday", f"Kazanma oranı %{lv['win']:.0f} (kuralın %60'ın altında) ama {n} işlemde kâr faktörü {lv['pf']}, net {lv['net']:+.0f} $. Entegrasyon için onayın gerekiyor."
    if n >= 10:
        return base, f"Canlı denemede {n} işlem: %{lv['win']:.0f} kazanma, net {lv['net']:+.0f} $ — mezuniyet şartı (%60 + artı net) henüz yok."
    return base, why + (f" Şu an {n}/10." if n else "")


def alerts(old, new):
    was = set(old.get("graduated") or [])
    for e in new["strategies"]:
        if e["status"] == "mezun" and e["id"] not in was:
            S.notify(f"Lab: {e['name']} mezun oldu", e["status_why"] + "\nSinyalleri artık ana ekranda 'Lab onaylı' olarak görünecek.", ["mortar_board"], 4)
        if e["status"] == "mezun":
            for t in e.get("pending", []):
                if t["sig"] == new["period"][1]:
                    S.notify(f"Lab onaylı sinyal: {t['sym']}", f"{e['name']}\nYarın {t['plan']} · giriş ≈ {t['entry']} · stop ≈ {t['stop']}", ["test_tube"], 3)


if __name__ == "__main__":
    main()
