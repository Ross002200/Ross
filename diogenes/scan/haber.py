"""Haber defteri ve karnesi (D2, kullanıcı 2026-10-11/18): her gece evrendeki hisselerin günün şirket haberleri toplanır,
türüne (bilanço, beklenti, analist, onay, birleşme, hukuki, hisse ihracı, yönetim, sözleşme) ve yönüne (iyi / kötü /
belirsiz) göre sınıflandırılır; sonra fiyatın tepkisi ölçülür: haberden sonraki ilk 15 dk mumun açılışından o günün
kapanışına ve 3. seansın kapanışına getiri, S&P 500'e (SPY) göre fark. İşlem açmaz; yalnız "hangi haber türü gerçekten
fiyatı taşıyor" sorusunun verisini biriktirir (karar zinciri D3 bu karneye bakacak).

Sınıflandırma kural tabanlı (İngilizce başlıklarda anahtar kelime); yanlış okuduğu başlıklar karnede tür bazında görünür.
Veri: Finnhub (FINNHUB_KEY), 15 dk arşiv (archive.py). Çıktı: data/olaylar.json (tam defter), data/haber_karne.json (sayfa).
Tasarım: docs/superpowers/specs/2026-10-11-diogenes-haber-oncelikli-design.md (bölüm 1-2)
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402

DEFTER = S.DATA / "olaylar.json"
KARNE = S.DATA / "haber_karne.json"
NY = "America/New_York"
SINIR = 5000            # defterde tutulan en çok olay (karne birikimli; eski olay silinse de sayısı kaybolmaz)
OLCUM_GUN = 10          # bu kadar günden eski ölçülmemiş olay artık ölçülmez
BEKLE = 1.05            # Finnhub ücretsiz: dakikada 60 istek

TURLER = (  # sırayla; ilk eşleşen tür
    ("birleşme", r"acqui|merger|buyout|takeover|to buy\b"),
    ("onay", r"fda\b|approv|clearance|\bclears?\b"),
    ("beklenti", r"guidance|outlook|forecast"),
    ("analist", r"upgrad|downgrad|price target|initiat|overweight|underweight|outperform|underperform|buy rating|sell rating"),
    ("bilanço", r"earnings|quarterly results|\bq[1-4]\b|\beps\b|revenue|profit"),
    ("hukuki", r"lawsuit|\bsues?\b|probe|investigat|subpoena|settle|recall|\bfine[sd]?\b|class action|fraud"),
    ("ihraç", r"offering|dilut|convertible|share sale"),
    ("yönetim", r"\bceo\b|\bcfo\b|resign|steps down|appoint|names new"),
    ("sözleşme", r"contract|partnership|agreement|\border\b|launch|\bwins?\b|award"),
)
IYI = re.compile(r"\b(beat|tops?\b|raise|upgrad|approv|wins?\b|record|surg|soar|jump|rall|strong|boost|outperform|buy rating|expand|exceed)")
KOTU = re.compile(r"\b(miss|cuts?\b|lower|downgrad|lawsuit|sues?\b|probe|investigat|recall|plung|tumbl|slump|fall|drop|weak|warn|delay|resign|"
                  r"offering|underperform|underweight|sell rating|halt|subpoena|fraud|bankrupt)")


def siniflandir(baslik):
    """Başlıktan (tür, yön). Tür bulunamazsa 'diğer'; iki yön birden ya da hiçbiri 'belirsiz'."""
    b = (baslik or "").lower()
    tur = next((t for t, desen in TURLER if re.search(desen, b)), "diğer")
    iyi, kotu = bool(IYI.search(b)), bool(KOTU.search(b))
    return tur, "iyi" if iyi and not kotu else "kötü" if kotu and not iyi else "belirsiz"


def _r(x):
    return None if x is None else round(x, 2)


def olc(ts, sym, spy):
    """ts: haberin zamanı (unix sn). sym / spy: 15 dk mumlar (index New York saati). Haberden sonraki ilk mumun açılışından
    o günün ve 3. seansın kapanışına % getiri; SPY aynı pencerede. Haberden sonra mum yoksa None."""
    olay = pd.Timestamp(ts, unit="s", tz="UTC").tz_convert(NY)

    def getiri(df):
        if df is None or df.empty:
            return None
        sonra = df[df.index >= olay]
        if sonra.empty:
            return None
        giris = float(sonra["Open"].iloc[0])
        seanslar = sorted({d for d in df.index.date if d >= sonra.index[0].date()})
        kapanis = lambda d: float(df[df.index.date == d]["Close"].iloc[-1])
        gun = (kapanis(seanslar[0]) / giris - 1) * 100
        g3 = (kapanis(seanslar[2]) / giris - 1) * 100 if len(seanslar) >= 3 else None
        return giris, gun, g3

    a = getiri(sym)
    if a is None:
        return None
    b = getiri(spy) or (None, None, None)
    return {"giris": _r(a[0]), "gun": _r(a[1]), "g3": _r(a[2]), "spy_gun": _r(b[1]), "spy_3g": _r(b[2]),
            "fark_gun": _r(a[1] - b[1]) if b[1] is not None else None,
            "fark_3g": _r(a[2] - b[2]) if a[2] is not None and b[2] is not None else None}


def karneye_ekle(olaylar, karne):
    """3 günü dolmuş (fark_3g belli) ve henüz sayılmamış olaylar birikimli karneye eklenir."""
    for o in olaylar:
        if o.get("sayildi") or o.get("fark_gun") is None or o.get("fark_3g") is None:
            continue
        k = karne.setdefault(f"{o['tur']}|{o['yon']}", {"n": 0, "s_gun": 0.0, "poz": 0, "s_3g": 0.0})
        k["n"] += 1
        k["s_gun"] = round(k["s_gun"] + o["fark_gun"], 4)
        k["poz"] += o["fark_gun"] > 0
        k["s_3g"] = round(k["s_3g"] + o["fark_3g"], 4)
        o["sayildi"] = True


def karne_ozet(karne):
    out = []
    for anahtar, k in karne.items():
        tur, yon = anahtar.split("|")
        out.append({"tur": tur, "yon": yon, "n": k["n"], "ort_gun": round(k["s_gun"] / k["n"], 2),
                    "ort_3g": round(k["s_3g"] / k["n"], 2), "poz": round(100 * k["poz"] / k["n"])})
    return sorted(out, key=lambda x: -x["n"])


def birlestir(eski, yeni, sinir=SINIR):
    """Aynı kimlikli olay iki kez alınmaz; en yeni `sinir` olay tutulur (zamana göre artan)."""
    var = {o["id"] for o in eski}
    hepsi = eski + [o for o in yeni if o["id"] not in var]
    return sorted(hepsi, key=lambda o: o["ts"])[-sinir:]


def topla(semboller, anahtar, sektor):
    """Son iki günün Finnhub şirket haberleri; yalnız türü tanınan başlıklar. Anahtar hiçbir zaman yazdırılmaz."""
    bugun = datetime.now(timezone.utc).date()
    out = []
    for sym in semboller:
        for deneme in range(2):
            try:
                r = requests.get("https://finnhub.io/api/v1/company-news", timeout=15,
                                 params={"symbol": sym, "token": anahtar, "from": str(bugun - pd.Timedelta(days=1)), "to": str(bugun)})
                if r.status_code == 429:
                    time.sleep(30)
                    continue
                r.raise_for_status()
                for x in r.json() or []:
                    tur, yon = siniflandir(x.get("headline"))
                    if tur == "diğer" or not x.get("datetime"):
                        continue
                    out.append({"id": f"{sym}:{x.get('id') or x['datetime']}", "sym": sym, "ts": int(x["datetime"]),
                                "baslik": (x.get("headline") or "")[:200], "kaynak": x.get("source"), "tur": tur, "yon": yon,
                                "sektor": sektor.get(sym)})
            except Exception as e:
                print(f"haber {sym}: {type(e).__name__}", file=sys.stderr)
            break
        time.sleep(BEKLE)
    return out


def main():
    import archive
    import universe

    defter = json.loads(DEFTER.read_text(encoding="utf-8")) if DEFTER.exists() else {"olaylar": [], "karne": {}}
    uni = universe.load()
    sektor = {s: (v or {}).get("sector") for s, v in uni.items()}
    anahtar = os.environ.get("FINNHUB_KEY")
    yeni = topla(sorted(s for s in uni if "^" not in s), anahtar, sektor) if anahtar else []
    if not anahtar:
        print("::warning::FINNHUB_KEY yok; haber toplanmadı, yalnız ölçüm yapılıyor")
    olaylar = birlestir(defter["olaylar"], yeni)
    sinir_ts = time.time() - OLCUM_GUN * 86400
    olculecek = [o for o in olaylar if o.get("fark_3g") is None and o["ts"] >= sinir_ts]
    if olculecek:
        ilk = str(pd.Timestamp(min(o["ts"] for o in olculecek), unit="s", tz="UTC").tz_convert(NY).date())
        veri = archive.load({f.name[:10] for f in archive.ARCH.glob("*.csv.gz") if f.name[:10] >= ilk})
        for o in olculecek:
            m = olc(o["ts"], veri.get(o["sym"]), veri.get("SPY"))
            if m:
                o.update(m)
    karneye_ekle(olaylar, defter["karne"])
    simdi = datetime.now(timezone.utc).isoformat(timespec="seconds")
    DEFTER.write_text(json.dumps({"updated": simdi, "olaylar": olaylar, "karne": defter["karne"]}, ensure_ascii=False,
                                 separators=(",", ":")), encoding="utf-8")
    son = [{k: o.get(k) for k in ("sym", "ts", "baslik", "kaynak", "tur", "yon", "fark_gun", "fark_3g")} for o in olaylar[-25:]][::-1]
    KARNE.write_text(json.dumps({"updated": simdi, "toplam": len(olaylar), "yeni": len(yeni), "karne": karne_ozet(defter["karne"]),
                                 "son": son}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"haber: {len(yeni)} yeni olay, defterde {len(olaylar)}, ölçülen {sum(1 for o in olculecek if o.get('fark_gun') is not None)}")


if __name__ == "__main__":
    main()
