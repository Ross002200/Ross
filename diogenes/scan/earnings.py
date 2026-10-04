"""Gerçek bilanço takvimi ve sürprizleri (Finnhub, ücretsiz anahtar: FINNHUB_KEY ortam değişkeni / GitHub sırrı).

data/earnings.json: {"updated", "days": {"YYYY-MM-DD": [{"s": sembol, "h": bmo|amc|dmh, "a": EPS gerçekleşen, "e": EPS beklenti,
"ra": gelir gerçekleşen, "re": gelir beklenti}]}}
İlk çalıştırmada son ~420 gün, sonra her gün son 10 gün ve önümüzdeki 21 gün yenilenir. Anahtar yoksa hiçbir şey yapmaz.
"""
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402
import universe  # noqa: E402

OUT = S.DATA / "earnings.json"


def fetch(key, a, b):
    r = requests.get("https://finnhub.io/api/v1/calendar/earnings", params={"from": str(a), "to": str(b), "token": key}, timeout=30)
    r.raise_for_status()
    return r.json().get("earningsCalendar") or []


def main():
    key = os.environ.get("FINNHUB_KEY")
    if not key:
        print("earnings: FINNHUB_KEY yok, atlandı")
        return
    try:
        old = json.loads(OUT.read_text()) if OUT.exists() else {}
    except Exception:
        old = {}
    days = old.get("days", {})
    uni = set(universe.load())
    today = date.today()
    start = today - timedelta(days=420 if len(days) < 100 else 10)
    end = today + timedelta(days=21)
    a = start
    while a <= end:
        b = min(a + timedelta(days=6), end)
        try:
            rows = fetch(key, a, b)
        except Exception as ex:
            print(f"earnings {a}: {type(ex).__name__}", file=sys.stderr)  # the request URL carries the API key
            time.sleep(5)
            a = b + timedelta(days=1)
            continue
        got = {}
        for x in rows:
            if x.get("symbol") in uni and x.get("date"):
                got.setdefault(x["date"], []).append(dict(s=x["symbol"], h=x.get("hour") or "", a=x.get("epsActual"), e=x.get("epsEstimate"),
                                                          ra=x.get("revenueActual"), re=x.get("revenueEstimate")))
        d = a
        while d <= b:  # replace the window so revised/added rows are kept current
            days.pop(str(d), None)
            d += timedelta(days=1)
        days.update(got)
        a = b + timedelta(days=1)
        time.sleep(1.2)  # free tier: 60 calls / minute
    days = dict(sorted(days.items())[-600:])
    txt = json.dumps(dict(updated=str(today), days=days), ensure_ascii=False, separators=(",", ":"))
    json.loads(txt)
    OUT.write_text(txt)
    print(f"earnings: {sum(len(v) for v in days.values())} kayıt, {len(days)} gün")


if __name__ == "__main__":
    main()
