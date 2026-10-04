"""İşlem dosyası ("Neden?"): bir pozisyon açıldığında, kararın dayandığı verinin aynısından hazırlanır.

Kural: yorum uydurulmaz. Teknik analiz cümleleri yalnız hesaplanmış sayılardan kurulur; haberler yalnız tanınan
yayıncılardan gelir ve kademelenir (birincil kaynak / haber ajansı / görüş); her öğenin kaynağı ve zamanı yazılır.
Tanınmayan yayıncının haberi gösterilmez. Claude'un sabah analizi ayrı etiketle, kendi kaynaklarıyla eklenir.
"""
import re
from datetime import datetime, timezone

import pandas as pd

import scan as S

PRIMARY = ("business wire", "pr newswire", "globenewswire", "accesswire", "sec", "edgar", "newsfile")
WIRE = ("reuters", "bloomberg", "associated press", "ap news", "cnbc", "wall street journal", "wsj", "marketwatch", "barron",
        "financial times", "investor's business daily", "new york times", "dow jones", "nikkei", "axios", "fortune", "the information")
OPINION = ("yahoo finance", "benzinga", "seekingalpha", "chartmill", "investing.com", "barchart", "motley fool", "zacks", "seeking alpha", "simply wall st", "investorplace",
           "24/7 wall st", "tipranks", "gurufocus", "insider monkey", "thestreet", "investopedia", "kiplinger", "forbes", "business insider", "quartz", "qz.com")
FRESH_H = 72
SOURCE_NOTE = "Fiyat ve hacim: Yahoo Finance (15 dk ve günlük mumlar; ücretsiz veri birkaç dakika gecikmeli olabilir)."


def tier(publisher):
    p = (publisher or "").lower()
    if any(k in p for k in PRIMARY):
        return "birincil"
    if any(k in p for k in WIRE):
        return "ajans"
    if any(k in p for k in OPINION):
        return "görüş"
    return None


JUNK = re.compile(r"\b[A-Z]{1,5}\d{6}[CP]\d{8}\b|stock price, news, quote|interactive stock chart|\b(call|put) stock\b|option chain", re.I)


def news(sym, items=None):
    """Recent headlines from recognised publishers only, primary sources first. Quote and option pages are not news."""
    out = []
    for n in (items if items is not None else S.headlines(sym, 40)):
        t = tier(n.get("source"))
        if not t or not n.get("link") or not S.fresh(n.get("time"), FRESH_H) or JUNK.search(n.get("title") or ""):
            continue
        out.append(dict(title=n["title"], publisher=n.get("source"), time=n.get("time"), link=n["link"], tier=t, tone=n.get("tone"), via=n.get("via")))
    order = {"birincil": 0, "ajans": 1, "görüş": 2}
    def _t(x):
        try:
            return -pd.Timestamp(x["time"]).timestamp()
        except Exception:
            return 0
    out.sort(key=lambda x: (order[x["tier"]], _t(x)))
    return out[:6]


def _rsi(c, n):
    d = c.diff()
    up, dn = d.clip(lower=0), (-d).clip(lower=0)
    rs = up.ewm(alpha=1 / n, adjust=False).mean() / dn.ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + rs)


def _pct(a, b):
    return None if not b else S.r2((a / b - 1) * 100, 1)


def metrics(sym, m15, d1, live, today, rsmap=None):
    """Plain numbers the decision used (daily and today's intraday)."""
    if d1 is None or d1.empty:
        return {}
    prev = d1[d1.index.date < today]
    cl = prev["Close"]
    last = float(live.get(sym) or (m15["Close"].iloc[-1] if m15 is not None and not m15.empty else cl.iloc[-1]))
    m = dict(last=S.r2(last), prev_close=S.r2(cl.iloc[-1]))
    for n in (20, 50, 200):
        if len(cl) >= n:
            m[f"sma{n}"] = S.r2(cl.iloc[-n:].mean())
            m[f"vs_sma{n}"] = _pct(last, m[f"sma{n}"])
    if len(cl) >= 25:
        m["dev25"] = _pct(cl.iloc[-1], cl.iloc[-25:].mean())
    if len(cl) >= 15:
        m["rsi2"] = S.r2(_rsi(cl, 2).iloc[-1], 1)
        m["rsi14"] = S.r2(_rsi(cl, 14).iloc[-1], 1)
        atr = float(S.atr_series(prev).iloc[-1])
        m["atr"], m["atr_pct"] = S.r2(atr), S.r2(atr / cl.iloc[-1] * 100, 1)
    if len(cl) >= 6:
        m["ret5"] = _pct(cl.iloc[-1], cl.iloc[-6])
    m["hi_dist"] = _pct(last, float(prev["High"].iloc[-126:].max()))  # 6 months of daily data
    if m15 is not None and not m15.empty:
        td = m15[m15.index.date == today]
        if len(td):
            m["vwap"] = S.r2(S.session_vwap(td))
            m["gap"] = _pct(float(td["Open"].iloc[0]), float(cl.iloc[-1]))
            m["day_chg"] = _pct(last, float(cl.iloc[-1]))
        rv = S.relvol_now(m15, today)
        m["relvol"] = S.r2(rv) if rv is not None else None
    if rsmap and sym in rsmap:
        m["rs"] = rsmap[sym]
    return m


def _f(v, d=1):
    return f"{v:.{d}f}".replace(".", ",") if isinstance(v, (int, float)) else "—"


def _p(v, d=1):
    """Turkish-style signed percent: %3,2 / −%3,2."""
    if not isinstance(v, (int, float)):
        return "—"
    return ("−" if v < 0 else "") + "%" + _f(abs(v), d)


def analysis(m):
    """Factual sentences built only from the numbers above."""
    out = []
    if m.get("vs_sma50") is not None:
        side = "üstünde" if m["vs_sma50"] >= 0 else "altında"
        trend = " (orta vadeli yükseliş trendi)" if m["vs_sma50"] > 0 and (m.get("vs_sma200") or 0) > 0 else ""
        out.append(dict(k="Trend", t=f"Fiyat 50 günlük ortalamanın %{_f(abs(m['vs_sma50']))} {side}{trend}."))
    if m.get("vs_sma200") is not None:
        out.append(dict(k="Uzun vade", t=f"200 günlük ortalamaya göre {_p(m['vs_sma200'])}."))
    if m.get("rsi2") is not None:
        z = " (aşırı satım bölgesi)" if m["rsi2"] < 10 else " (aşırı alım bölgesi)" if m["rsi2"] > 90 else ""
        out.append(dict(k="Momentum", t=f"Günlük RSI(2) {_f(m['rsi2'])}, RSI(14) {_f(m.get('rsi14'))}{z}."))
    if m.get("dev25") is not None:
        out.append(dict(k="Sapma", t=f"Dünkü kapanış 25 günlük ortalamaya göre {_p(m['dev25'])}."))
    if m.get("relvol") is not None:
        z = " (normalin belirgin üstü: hissede ilgi var)" if m["relvol"] >= 1.5 else ""
        out.append(dict(k="Hacim", t=f"Göreli hacim {_f(m['relvol'], 2)}× (aynı saatteki 14 gün ortalamasına göre){z}."))
    if m.get("vwap"):
        side = "üstünde" if m["last"] >= m["vwap"] else "altında"
        out.append(dict(k="VWAP", t=f"Fiyat günün hacim ağırlıklı ortalamasının ({_f(m['vwap'], 2)} $) {side}."))
    if m.get("gap") is not None:
        out.append(dict(k="Açılış", t=f"Bugün {_p(m['gap'])} boşlukla açıldı; günlük değişim {_p(m.get('day_chg'))}."))
    if m.get("atr_pct") is not None:
        out.append(dict(k="Oynaklık", t=f"Ortalama günlük hareket (ATR) {_f(m['atr'], 2)} $ (%{_f(m['atr_pct'])})."))
    if m.get("hi_dist") is not None:
        out.append(dict(k="Zirve", t=f"Son 6 ayın zirvesine göre {_p(m['hi_dist'])}."))
    if m.get("rs") is not None:
        out.append(dict(k="Göreli güç", t=f"Son 3 ayda evrendeki hisselerin %{m['rs']}'inden güçlü."))
    return out


def reasons(c, m):
    """Why this book took the trade, in its own rule terms, with the measured values."""
    b, out = c.get("book", "of"), []
    if b == "of":
        out.append(f"{c.get('tf') or '15dk'} grafikte yükseliş yönlü order flow bölgesi ({_f((c.get('zone') or [None])[0], 2)}–{_f((c.get('zone') or [None, None])[1], 2)} $); giriş bu bölgeye geri çekilmede.")
        ch = c.get("checks") or {}
        conf = [n for k, n in (("mom", "momentum"), ("ind", "gösterge onayı"), ("stair", "merdiven yapısı")) if ch.get(k)]
        out.append(f"Derece {c.get('grade')}: onaylar {', '.join(conf) if conf else 'yok'}.")
        if ch.get("htf"):
            out.append("Günlük trend yukarı (20 > 50 günlük ortalama).")
    elif b == "vwap":
        out.append("Trend günü: fiyat gün içinde VWAP'ın %1+ üstüne çıktı, sonra VWAP'a geri çekilip üstünde kapandı (Brian Shannon'ın VWAP geri alımı).")
    elif b == "orb":
        out.append(f"İlk 15 dakikanın tepesi kırıldı; açılış boşluğu %{_f(c.get('gap'))}, göreli hacim {_f(c.get('relvol'), 2)}× (Aziz / Zarattini açılış aralığı kırılımı).")
    elif b == "cat":
        out.append(f"Katalizör: {c.get('catalyst') or 'taze haber'}; %{_f(c.get('gap'))} boşluk, göreli hacim {_f(c.get('relvol'), 2)}×, günün zirvesi kırılıyor.")
    elif b == "rev":
        out.append(f"Günlük trend yukarıyken gün içi aşırı satım: 15 dk RSI(2) 10'un altına indi, dönüş mumu geldi; hedef VWAP ({_f(c.get('vwap'), 2)} $).")
    elif b == "bnf":
        out.append(f"Dünkü kapanış 25 günlük ortalamaya göre {_p(m.get('dev25'))} (eşik −%15): Kotegawa'nın sapma oranı kuralı; hedef ortalamanın %97'si.")
    elif b == "bnfc":
        out.append(f"Kapanışta 25 günlük ortalamaya göre {_p(c.get('dev25'))} (eşik −%15): Kotegawa'nın sapma kuralı, kapanışta giriş (dönüş kârının çoğu gece gelir: Lou-Polk-Skouras 2019); hedef ortalamanın %97'si.")
    elif b == "rsi2c":
        out.append(f"Fiyat 200 günlük ortalamanın üstünde ve RSI(2) {_f(c.get('rsi2'))} (eşik 10): Connors kuralı, kapanışta giriş; çıkış 5 günlük ortalamanın üstünde kapanış.")
    elif b == "ibs":
        out.append(f"Trend içinde gün aralığının alt kısmında kapanış: IBS {_f(c.get('ibs'), 2)} (eşik 0,2); kapanışta giriş, önceki günün tepesinin üstünde kapanınca çıkış.")
    elif b == "rsi2":
        out.append(f"Fiyat 200 günlük ortalamanın üstünde ve günlük RSI(2) {_f(m.get('rsi2'))} (eşik 10): Connors'ın geri alım kuralı; çıkış 5 günlük ortalamanın üstünde kapanış.")
    elif b.startswith("r_"):
        a = next((x for x in __import__("books").research_active() if f"r_{x['id']}" == b), None)
        if a:
            conds = ", ".join(f"{f} {op} {v}" for f, op, v in (a.get("rule") or {}).get("when", []))
            src = a.get("source") or {}
            out.append(f"Hafta sonu araştırmasından gelen kural ({src.get('author') or ''} {src.get('year') or ''}): {conds}.")
            t = a.get("test") or {}
            out.append(f"Sınav döneminde {t.get('n')} işlem, %{_f(t.get('win'))} kazanma, işlem başı {_f(t.get('exp'), 2)} $ (komisyon dahil).")
    if c.get("rr"):
        out.append(f"Ödül/risk 1:{_f(c['rr'], 2)}.")
    return out


def build(t, c, m15, d1, live, today, now, rsmap=None, night=None, uni=None, items=None):
    m = metrics(t["symbol"], m15, d1, live, today, rsmap)
    bars = []
    if m15 is not None and not m15.empty:
        days = sorted(set(m15.index.date))[-2:]
        x = m15[m15.index.date >= days[0]].iloc[-52:]
        bars = [[ts.strftime("%m-%d %H:%M"), S.r2(r["Open"]), S.r2(r["High"]), S.r2(r["Low"]), S.r2(r["Close"]), int(r["Volume"] or 0)]
                for ts, r in x.iterrows()]
    cv = next((s for s in (night or {}).get("stocks", []) if s.get("symbol") == t["symbol"]), None)
    claude = None
    if cv:
        claude = dict(verdict=cv.get("verdict"), catalyst=cv.get("catalyst"), risks=cv.get("risks"), note=cv.get("note"),
                      analysis=cv.get("analysis"), earnings_date=cv.get("earnings_date"), generated=(night or {}).get("generated"),
                      sources=[s for s in (night or {}).get("sources", []) if s.get("url")][:6])
    info = (uni or {}).get(t["symbol"]) or {}
    nw = news(t["symbol"], items)
    vias = ", ".join(sorted({n.get("via") for n in nw if n.get("via")})) or "haber akışı"
    return dict(built=datetime.now(timezone.utc).isoformat(timespec="seconds"), at_ny=S.hm(now), name=info.get("name") or c.get("name"),
                sector=info.get("sector") or c.get("sector"), book=t.get("book_name") or t.get("book"), why=reasons(c, m),
                cautions=[v["msg"] for v in (t.get("violations") or [])], metrics=m, ta=analysis(m), bars=bars,
                levels=dict(entry=t["entry"], stop=t["stop"], target=t["target"], vwap=m.get("vwap")),
                risk=dict(stop_pct=S.r2((t["entry"] - t["stop"]) / t["entry"] * 100, 2), risk_usd=t.get("risk"), qty=t.get("qty"),
                          position=S.r2(t["qty"] * t["entry"]), fee=S.FEE2),
                news=nw, claude=claude,
                sources=[SOURCE_NOTE, f"Haberler: {vias} üzerinden; yalnız tanınan yayıncılar, son 72 saat, her biri bağlantısıyla. Fiyat ve opsiyon sayfaları haber sayılmaz.",
                         "Teknik analiz: yukarıdaki sayılardan hesaplanır, yorum eklenmez."]
                        + ([f"Claude sabah analizi: {claude['generated']} (kaynakları aşağıda)."] if claude else []))
