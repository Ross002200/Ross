"""Claude rutinlerinden gelen dosyaları repoya taşır.

Zamanlanmış Claude oturumları bu repoya push edemiyor. Onun yerine çıktılarını (night.json, brief.json,
macro.json) ntfy'deki veri konusuna dosya eki olarak yüklüyorlar; bu betik son 12 saatin eklerini
indirip doğrular ve yerine yazar. GitHub Actions her taramadan önce çalıştırır.
"""
import json
import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
DATA = HERE.parent / "data"
CFG = json.loads((HERE / "config.json").read_text())
TARGETS = {"night.json": DATA / "night.json", "brief.json": DATA / "brief.json", "macro.json": HERE / "macro.json"}
REQUIRED = {"night.json": ("date", "risk_flag", "stocks"), "brief.json": ("generated", "text"), "macro.json": ("events",)}


def main():
    topic = CFG["ntfy_topic"] + "-data"
    try:
        r = requests.get(f"https://ntfy.sh/{topic}/json", params={"poll": "1", "since": "12h"}, timeout=20)
        events = [json.loads(line) for line in r.text.splitlines() if line.strip()]
    except Exception as e:
        print(f"relay: {e}", file=sys.stderr)
        return
    latest = {}
    for ev in events:
        att = ev.get("attachment") or {}
        name = att.get("name") or ev.get("title")
        if name in TARGETS and att.get("url"):
            if name not in latest or ev["time"] > latest[name]["time"]:
                latest[name] = dict(time=ev["time"], url=att["url"])
    for name, info in latest.items():
        try:
            body = requests.get(info["url"], timeout=20).json()
        except Exception as e:
            print(f"relay {name}: {e}", file=sys.stderr)
            continue
        if not all(k in body for k in REQUIRED[name]):
            print(f"relay {name}: eksik alan, atlandı", file=sys.stderr)
            continue
        dest = TARGETS[name]
        old = dest.read_text() if dest.exists() else ""
        new = json.dumps(body, ensure_ascii=False, indent=1)
        if new != old:
            dest.write_text(new)
            print(f"relay: {name} güncellendi")


if __name__ == "__main__":
    main()
