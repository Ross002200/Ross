"""Tarama evrenini kurar: S&P 500 bileşenleri + sık işlem gören büyüme/ADR hisseleri + ana ETF'ler.

Midas'ın tam hisse listesine dışarıdan erişim yok; bu evrendeki büyük ABD hisselerinin neredeyse tamamı
Midas'ta işlem görür. Liste haftada bir (hafta sonu iş akışında) Wikipedia'dan yenilenir; erişim olmazsa
mevcut universe.json korunur.
"""
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

OUT = Path(__file__).parent / "universe.json"

EXTRA = {
    # sık işlem gören, S&P 500 dışında kalabilen hisseler ve ADR'ler
    "Information Technology": ["ARM", "ASML", "TSM", "SHOP", "SNOW", "NET", "MDB", "TEAM", "OKTA", "ZS", "U", "IONQ", "MSTR", "SMCI", "AFRM", "SOFI", "HOOD", "UPST", "PATH", "S"],
    "Communication Services": ["RBLX", "ROKU", "PINS", "SNAP", "SPOT", "BIDU", "DUOL"],
    "Consumer Discretionary": ["BABA", "PDD", "JD", "NIO", "RIVN", "LCID", "CVNA", "DKNG", "CELH", "ONON", "CHWY", "W"],
    "Industrials": ["RKLB", "ASTS", "JOBY"],
    "Financials": ["COIN", "MARA", "RIOT", "NU"],
    "ETF": ["SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLP", "XLU", "XLB", "XLRE", "XLC", "SMH", "ARKK"],
}


def build():
    h = {"User-Agent": "Mozilla/5.0 (diogenes universe builder)"}
    html = requests.get("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", headers=h, timeout=30).text
    sp = pd.read_html(io.StringIO(html))[0]
    rows = {str(r["Symbol"]).replace(".", "-"): dict(name=str(r["Security"]), sector=str(r["GICS Sector"])) for _, r in sp.iterrows()}
    for sector, syms in EXTRA.items():
        for s in syms:
            rows.setdefault(s, dict(name=s, sector=sector))
    out = dict(updated=datetime.now(timezone.utc).isoformat(timespec="seconds"), count=len(rows), symbols=rows)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    return out


def load():
    if OUT.exists():
        return json.loads(OUT.read_text())["symbols"]
    return build()["symbols"]


if __name__ == "__main__":
    try:
        u = build()
        print(f"{u['count']} sembol")
    except Exception as e:
        print(f"Evren yenilenemedi, eski liste korunuyor: {e}")
