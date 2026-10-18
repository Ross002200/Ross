"""Otopsi (kullanıcı 2026-10-11/18): her kapanan kâğıt işleme "neden kaybettik / neden kazandık" etiketi ve ders tablosu.
Sistemin kararlarını değiştirmez; yalnız ölçer. Kural önerisi ancak bir etiket 30+ işlemde belirginse yapılır.

Kayıpta (öncelik sırasıyla): boşlukla delindi · stop dar kaldı (çıkıştan sonra fiyat hedefe gitti) · piyasa döndü (SPY aynı
sürede −%0,5 ve altı) · süre doldu (stop dışı çıkış) · hiç lehte gitmedi (en iyi gidiş < 0,3R) · geri döndü (önce lehte, sonra stop).
Kazançta: piyasa taşıdı (hedef, SPY +%0,5 ve üstü) · kendi hareketi (hedef) · kârda süre doldu.
Veri: data/paper.json ve 15 dakikalık arşiv (archive.py). Çıktı: data/otopsi.json.
Tasarım: docs/superpowers/specs/2026-10-11-diogenes-haber-oncelikli-design.md (bölüm 5)
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402

OUT = S.DATA / "otopsi.json"
PIYASA_ESIK = 0.5    # SPY yüzde değişimi
LEHTE_MIN = 0.3      # R
BULGU_MIN = 5
KURAL_MIN = 30
BULGU_METNI = {
    "stop dar kaldı": "fiyat stoptan sonra hedefe gitti; stoplar dar olabilir",
    "hiç lehte gitmedi": "fiyat hiç lehte gitmedi; giriş sinyali zayıf",
    "piyasa döndü": "piyasa aynı anda düştü; piyasa filtresi geç kalıyor olabilir",
    "boşlukla delindi": "stop boşlukla geçildi; gece taşıma ya da haber riski",
    "geri döndü": "önce lehte gitti, sonra stop oldu; kâr koruma (başabaşa çekme) düşünülebilir",
    "süre doldu": "süre doldu; hedef bu sürede gerçekçi olmayabilir",
}


def bir_r(t):
    """1R (hisse başı risk): komisyon hariç risk / adet; yoksa giriş − stop."""
    if t.get("risk") and t.get("qty"):
        r = (t["risk"] - S.FEE2) / t["qty"]
        if r > 0:
            return round(r, 4)
    return round(abs(t["fill"] - t["stop"]), 4)


def etiketle(t, sonra_tepe, spy):
    """t: kapanmış işlem; sonra_tepe: çıkıştan sonraki en yüksek fiyat (yoksa None); spy: aynı sürede SPY % (yoksa None)."""
    note = t.get("note") or ""
    mfe = t.get("mfe") or 0.0
    sonra_hedef = None if sonra_tepe is None else sonra_tepe >= t["target"]
    if (t.get("r") or 0) > 0:
        if note.startswith("Hedef"):
            etiket = "piyasa taşıdı" if spy is not None and spy >= PIYASA_ESIK else "kendi hareketi"
        else:
            etiket = "kârda süre doldu"
    elif "boşluk" in note:
        etiket = "boşlukla delindi"
    elif sonra_hedef:
        etiket = "stop dar kaldı"
    elif spy is not None and spy <= -PIYASA_ESIK:
        etiket = "piyasa döndü"
    elif not note.startswith("Stop"):
        etiket = "süre doldu"
    elif mfe < LEHTE_MIN:
        etiket = "hiç lehte gitmedi"
    else:
        etiket = "geri döndü"
    return {"etiket": etiket, "kural_ihlali": bool(t.get("violations")), "spy": spy, "sonra_hedef": sonra_hedef}


def _son_kapanis(df, ts):
    once = df[df.index <= ts]
    return None if once.empty else float(once["Close"].iloc[-1])


def olcumler(t, sym, spy):
    """sym / spy: 15 dk mumlar (index New York saati). Döner (çıkıştan sonraki tepe, SPY % değişimi)."""
    giris, cikis = pd.Timestamp(t["fill_time"]), pd.Timestamp(t["exit_time"])
    tepe = None
    if sym is not None and not sym.empty:
        sonra = sym[sym.index > cikis]
        gunler = sorted({d for d in sonra.index.date})
        izin = set(gunler[:1] if t.get("horizon") == "gün" else gunler[:2])
        izin = {d for d in izin if t.get("horizon") != "gün" or d == cikis.date()}
        sonra = sonra[[d in izin for d in sonra.index.date]]
        tepe = None if sonra.empty else float(sonra["High"].max())
    spy_d = None
    if spy is not None and not spy.empty:
        a, b = _son_kapanis(spy, giris), _son_kapanis(spy, cikis)
        spy_d = None if not a or b is None else round((b / a - 1) * 100, 2)
    return tepe, spy_d


def ozet(kayitlar):
    etiket, kitap, ihlal = {}, {}, {"n": 0, "r": 0.0}
    for k in kayitlar:
        for d in (etiket.setdefault(k["etiket"], {"n": 0, "r": 0.0}),
                  kitap.setdefault(k["book"], {}).setdefault(k["etiket"], {"n": 0, "r": 0.0})):
            d["n"] += 1
            d["r"] = round(d["r"] + (k["r"] or 0), 2)
        if k["kural_ihlali"]:
            ihlal["n"] += 1
            ihlal["r"] = round(ihlal["r"] + (k["r"] or 0), 2)
    bulgular = []
    for ad, d in sorted(etiket.items(), key=lambda x: x[1]["r"]):
        if ad in BULGU_METNI and d["n"] >= BULGU_MIN:
            ek = "30+ örnek: kural önerisi" if d["n"] >= KURAL_MIN else f"ön bulgu, {d['n']} örnek"
            bulgular.append(f"«{ad}» {d['n']} işlem, {d['r']:+.1f}R: {BULGU_METNI[ad]} ({ek}).")
    if ihlal["n"] >= BULGU_MIN:
        bulgular.append(f"Kural çiğnenerek açılan {ihlal['n']} işlem toplam {ihlal['r']:+.1f}R.")
    return {"etiket": etiket, "kitap": kitap, "kural_ihlali": ihlal, "bulgular": bulgular}


def main():
    import archive

    st = json.loads((S.DATA / "paper.json").read_text(encoding="utf-8"))
    kapali = [t for t in st["trades"] if t.get("status") == "closed" and t.get("exit_time") and t.get("fill_time")]
    if not kapali:
        return
    ilk = min(str(pd.Timestamp(t["fill_time"]).date()) for t in kapali)
    gunler = {f.name[:10] for f in archive.ARCH.glob("*.csv.gz") if f.name[:10] >= ilk}
    veri = archive.load(gunler)
    islemler = []
    for t in kapali:
        tepe, spy = olcumler(t, veri.get(t["symbol"]), veri.get("SPY"))
        e = etiketle(t, tepe, spy)
        islemler.append({"id": t.get("id"), "symbol": t["symbol"], "book": t.get("book"), "date": t.get("date"),
                         "r": t.get("r"), "net_r": t.get("net_r"), "note": t.get("note"), "mfe": t.get("mfe"),
                         "mae": t.get("mae"), **e})
    out = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "islemler": islemler,
           **ozet(islemler)}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"otopsi: {len(islemler)} işlem; " + "; ".join(out["bulgular"]))


if __name__ == "__main__":
    main()
