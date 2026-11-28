"""Diogenes piyasa panosu: hafta içi sabah fiyat, faiz ve enflasyonu toplar, Diogenes'e yollar, özeti bildirir.

Kaynaklar: Yahoo (yfinance), TCMB EVDS (EVDS_KEY), TEFAS (tefas-crawler). Biri düşerse yalnız onun satırları
durum='yok' olur. Claude'un günlük notu relay.py ile data/gunluk_not.json'a gelir. Tavsiye değil, veri.
"""
import datetime as dt
import json
import math
import os
import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
NOT = HERE.parent / "data" / "gunluk_not.json"
KAYNAK = json.loads((HERE / "piyasa_kaynak.json").read_text(encoding="utf-8"))
TABAN = os.environ.get("DIOGENES_URL", "https://diogenes.diyarross.com")
ONS_GRAM = 31.1034768
CEYREK_GRAM = 1.6038
ESIK = {"doviz": .15, "altin": .15, "endeks": .20, "hisse": .35, "fon": .15}
# kod, grup, tip, ad, birim, yahoo sembolü
SABIT = [("USDTRY", "altin_doviz", "doviz", "Dolar/TL", "₺", "USDTRY=X"), ("EURTRY", "altin_doviz", "doviz", "Euro/TL", "₺", "EURTRY=X"),
         ("XU100", "tr", "endeks", "BIST 100", "", "XU100.IS"), ("SPX", "abd", "endeks", "S&P 500", "", "^GSPC"),
         ("NDX", "abd", "endeks", "Nasdaq", "", "^IXIC")]
AYLIK_KODLAR = ("USDTRY", "XU100", "SPX")


def gram(ons_usd, usdtry):
    return ons_usd * usdtry / ONS_GRAM


def supheli(tip, deger, onceki):
    if tip == "faiz":
        return deger is None
    if deger is None or deger <= 0:
        return True
    e = ESIK.get(tip)
    return bool(e and onceki and onceki > 0 and abs(deger / onceki - 1) > e)


def seri_satirlari(kod, grup, tip, ad, birim, kaynak, seri):
    """Son 30 işlem günü; şüpheli değer bir sonrakinin 'önceki'si olmaz."""
    out, onceki = [], None
    for gun, deger in [x for x in seri if x[1] is not None and math.isfinite(x[1])][-31:]:
        durum = "supheli" if supheli(tip, deger, onceki) else "ok"
        out.append(dict(gun=gun, kod=kod, grup=grup, tip=tip, ad=ad, deger=round(float(deger), 4), birim=birim, kaynak=kaynak, durum=durum))
        if durum == "ok":
            onceki = deger
    return out[-30:]


def yok_satiri(kod, grup, tip, ad, birim, kaynak, gun):
    return dict(gun=gun, kod=kod, grup=grup, tip=tip, ad=ad, deger=None, birim=birim, kaynak=kaynak, durum="yok")


def ay_sonlari(seri, n=15):
    son = {}
    for gun, deger in seri:
        son[gun[:7]] = deger
    return [dict(ay=a, deger=round(float(v), 4)) for a, v in sorted(son.items())[-n:]]


def aylik_ortalama(seri):
    """Haftalık ya da günlük seriyi aya indirger (ay ortalaması). Aylık seri değişmez."""
    aylar = {}
    for gun, deger in seri:
        aylar.setdefault(gun[:7], []).append(deger)
    return [(a, sum(v) / len(v)) for a, v in sorted(aylar.items())]


def evds_ayristir(items, seri):
    alan = seri.replace(".", "_")
    out = []
    for it in items:
        v, t = it.get(alan), str(it.get("Tarih") or "")
        if v in (None, ""):
            continue
        if len(t) == 10 and t[2] == "-":
            t = f"{t[6:10]}-{t[3:5]}-{t[0:2]}"
        elif "-" in t and len(t) <= 7:
            y, m = t.split("-")
            t = f"{y}-{int(m):02d}"
        out.append((t, float(v)))
    return sorted(out)


def evds(anahtar, seri, bas, son):
    r = requests.get(f"https://evds2.tcmb.gov.tr/service/evds/series={seri}&startDate={bas:%d-%m-%Y}&endDate={son:%d-%m-%Y}&type=json",
                     headers={"key": anahtar}, timeout=30)
    r.raise_for_status()
    return evds_ayristir(r.json().get("items", []), seri)


def yahoo(semboller):
    import yfinance as yf
    df = yf.download(list(semboller), period="14mo", interval="1d", auto_adjust=False, progress=False, group_by="ticker", threads=True)
    out = {}
    for s in semboller:
        try:
            c = df[s]["Close"].dropna()
            out[s] = [(i.strftime("%Y-%m-%d"), float(v)) for i, v in c.items()]
        except Exception:
            out[s] = []
    return out


def tefas(kod, bas, son):
    from tefas import Crawler
    df = Crawler().fetch(start=bas.isoformat(), end=son.isoformat(), name=kod, columns=["date", "price"])
    return sorted((str(d)[:10], float(p)) for d, p in zip(df["date"], df["price"]))


def topla(izleme, evds_key, bugun, yahoo_fn=yahoo, evds_fn=evds, tefas_fn=tefas):
    satirlar, aylik = [], []
    meta = {k: (g, t, a, b, y) for k, g, t, a, b, y in SABIT}
    for i in izleme:
        if i["tur"] == "bist":
            meta[f"BIST:{i['kod']}"] = ("tr", "hisse", i["kod"], "₺", f"{i['kod']}.IS")
        elif i["tur"] == "abd":
            meta[f"ABD:{i['kod']}"] = ("abd", "hisse", i["kod"], "$", i["kod"])
    try:
        ham = yahoo_fn(sorted({m[4] for m in meta.values()} | {"GC=F"}))
    except Exception as e:
        print(f"yahoo: {e}", file=sys.stderr)
        ham = {}
    for kod, (g, t, a, b, y) in meta.items():
        seri = ham.get(y) or []
        satirlar += seri_satirlari(kod, g, t, a, b, "yahoo", seri) if seri else [yok_satiri(kod, g, t, a, b, "yahoo", bugun)]
        if seri and kod in AYLIK_KODLAR:
            aylik += [dict(ay=x["ay"], kod=kod, deger=x["deger"]) for x in ay_sonlari(seri)]
    ons, kur = dict(ham.get("GC=F") or []), dict(ham.get("USDTRY=X") or [])
    gs = [(g, gram(ons[g], kur[g])) for g in sorted(set(ons) & set(kur))]
    for kod, ad, carpan in (("GRAM", "Gram altın", 1.0), ("CEYREK", "Çeyrek altın", CEYREK_GRAM)):
        satirlar += seri_satirlari(kod, "altin_doviz", "altin", ad, "₺", "hesap", [(g, v * carpan) for g, v in gs]) if gs else [yok_satiri(kod, "altin_doviz", "altin", ad, "₺", "hesap", bugun)]
    if gs:
        aylik += [dict(ay=x["ay"], kod="GRAM", deger=x["deger"]) for x in ay_sonlari(gs)]
    son = dt.date.fromisoformat(bugun)
    bas = son - dt.timedelta(days=430)
    faiz = {"POLITIKA": ("Politika faizi", None), "TUFE_Y": ("Yıllık TÜFE", None), "MEVDUAT": ("Mevduat faizi", None)}
    if evds_key and evds_fn:
        ev = KAYNAK["evds"]
        try:
            tufe = aylik_ortalama(evds_fn(evds_key, ev["TUFE"], bas, son))
            aylik += [dict(ay=a[:7], kod="TUFE", deger=v) for a, v in tufe[-13:]]
            if len(tufe) >= 13:
                faiz["TUFE_Y"] = ("Yıllık TÜFE", (tufe[-1][1] / tufe[-13][1] - 1) * 100)
        except Exception as e:
            print(f"evds TUFE: {e}", file=sys.stderr)
        try:
            p = evds_fn(evds_key, ev["POLITIKA"], son - dt.timedelta(days=40), son)
            if p:
                faiz["POLITIKA"] = ("Politika faizi", p[-1][1])
        except Exception as e:
            print(f"evds POLITIKA: {e}", file=sys.stderr)
        try:
            m = evds_fn(evds_key, ev["MEVDUAT"], bas, son)
            aylik += [dict(ay=a, kod="MEVDUAT", deger=round(v, 4)) for a, v in aylik_ortalama(m)[-13:]]
            if m:
                faiz["MEVDUAT"] = ("Mevduat faizi", m[-1][1])
        except Exception as e:
            print(f"evds MEVDUAT: {e}", file=sys.stderr)
    for kod, (ad, deger) in faiz.items():
        satirlar.append(dict(gun=bugun, kod=kod, grup="faiz", tip="faiz", ad=ad, deger=None if deger is None else round(deger, 4),
                             birim="%", kaynak="tcmb", durum="yok" if deger is None else "ok"))
    for i in izleme:
        if i["tur"] != "fon":
            continue
        kod = f"FON:{i['kod']}"
        try:
            seri = tefas_fn(i["kod"], son - dt.timedelta(days=460), son) if tefas_fn else []
        except Exception as e:
            print(f"tefas {i['kod']}: {e}", file=sys.stderr)
            seri = []
        satirlar += seri_satirlari(kod, "faiz", "fon", i["kod"], "₺", "tefas", seri) if seri else [yok_satiri(kod, "faiz", "fon", i["kod"], "₺", "tefas", bugun)]
        if seri:
            aylik += [dict(ay=x["ay"], kod=kod, deger=x["deger"]) for x in ay_sonlari(seri)]
    return dict(gun=bugun, satirlar=satirlar, aylik=aylik)


def gunluk_not(bugun):
    try:
        j = json.loads(NOT.read_text(encoding="utf-8"))
    except Exception:
        return None
    metin = str(j.get("text") or "").strip()
    return metin[:600] if j.get("date") == bugun and metin else None


def main():
    anahtar = os.environ["PIYASA_KEY"]
    bugun = dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).date().isoformat()
    h = {"x-piyasa-key": anahtar}
    izleme = requests.get(f"{TABAN}/api/izleme-listesi", headers=h, timeout=20).json().get("izleme", [])
    govde = topla(izleme, os.environ.get("EVDS_KEY"), bugun)
    govde["not"] = gunluk_not(bugun)
    r = requests.post(f"{TABAN}/api/piyasa", headers={**h, "Content-Type": "application/json"}, data=json.dumps(govde, allow_nan=False), timeout=60)
    # Depo herkese açık: günlüğe özet (bütçe) yazılmaz, yalnız sayılar.
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    print("piyasa:", r.status_code, "yazılan", j.get("yazilan"), "şüpheli", j.get("supheli"), j.get("error") or "")
    r.raise_for_status()
    ozet = j.get("ozet") or {}
    if ozet.get("bildirim"):
        import scan
        # ntfy yedeği kullanılmaz (konu adı herkese açık depoda); yalnız Diogenes uygulama bildirimi.
        scan._uygulama_bildirimi("Diogenes · günün özeti", ozet["bildirim"], ["chart_with_upwards_trend"], 3)


if __name__ == "__main__":
    main()
