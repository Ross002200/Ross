"""Gün içi veri arşivi: ücretsiz 15 dakikalık veri yalnız son 60 günü verir; bu betik her gün kapanıştan sonra
günün 15 dakikalık mumlarını saklar. Böylece gün içi kurallar zamanla aylarca, yıllarca veride sınanabilir.

diogenes/archive/m15/YYYY-MM-DD.csv.gz  (sym, ts, o, h, l, c, v; New York saati)
Evren: universe.json (S&P 500 + likit hisseler) + o günün tarayıcıda öne çıkan hisseleri (scan.json: watch, gainers).
İlk çalıştırmada son 60 gün birden yazılır; sonra her gün yalnız eksik günler.
"""
import gzip
import io
import json
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402
import universe  # noqa: E402

ARCH = HERE.parent / "archive" / "m15"


def symbols():
    uni = universe.load()
    syms = {s for s, v in uni.items() if "^" not in s}
    try:
        sc = json.loads((S.DATA / "scan.json").read_text())
        for k in ("watch", "gainers", "candidates"):
            syms |= {r["symbol"] for r in sc.get(k) or [] if r.get("symbol")}
    except Exception:
        pass
    return sorted(syms)


def load(days=None):
    """{symbol: DataFrame(Open, High, Low, Close, Volume)} from the archive, optionally only the given dates."""
    frames = []
    for f in sorted(ARCH.glob("*.csv.gz")):
        if days and f.name[:10] not in days:
            continue
        frames.append(pd.read_csv(f, parse_dates=["ts"]))
    if not frames:
        return {}
    df = pd.concat(frames)
    df["ts"] = pd.to_datetime(df["ts"], utc=True).dt.tz_convert("America/New_York")
    out = {}
    for s, g in df.groupby("sym"):
        g = g.set_index("ts").sort_index()
        out[s] = g.rename(columns=dict(o="Open", h="High", l="Low", c="Close", v="Volume"))[["Open", "High", "Low", "Close", "Volume"]]
    return out


def main():
    ARCH.mkdir(parents=True, exist_ok=True)
    have = {f.name[:10] for f in ARCH.glob("*.csv.gz")}
    period = "5d" if have else "60d"
    syms = symbols()
    raw = S.download(syms, period=period, interval="15m")
    rows = []
    for s in syms:
        try:
            x = S.split(raw, s)
        except Exception:
            continue
        if x is None or x.empty:
            continue
        x = x.dropna(subset=["Close"])
        x = x[(x.index.strftime("%H:%M") >= "09:30") & (x.index.strftime("%H:%M") < "16:00")]
        for ts, r in x.iterrows():
            rows.append((s, ts, r["Open"], r["High"], r["Low"], r["Close"], r["Volume"]))
    if not rows:
        print("arşiv: veri yok")
        return
    df = pd.DataFrame(rows, columns=["sym", "ts", "o", "h", "l", "c", "v"])
    df["d"] = df["ts"].dt.strftime("%Y-%m-%d")
    today = str(S.now_ny().date())
    wrote = 0
    for d, g in df.groupby("d"):
        if d in have or (d == today and S.hm(S.now_ny()) < "16:05"):
            continue  # never overwrite a saved day; skip an unfinished session
        g = g.drop(columns="d").round({"o": 4, "h": 4, "l": 4, "c": 4})
        g["v"] = g["v"].fillna(0).astype("int64")
        buf = io.StringIO()
        g.to_csv(buf, index=False)
        with gzip.open(ARCH / f"{d}.csv.gz", "wt") as fh:
            fh.write(buf.getvalue())
        wrote += 1
    print(f"arşiv: {wrote} gün yazıldı, toplam {len(have) + wrote} gün, {df.sym.nunique()} hisse")


if __name__ == "__main__":
    main()
