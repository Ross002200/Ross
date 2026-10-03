"""SEC EDGAR: son 24 saatin 8-K bildirimleri (resmî, ücretsiz, haberden hızlı). Katalizör kitabı kullanır.

SEC her istekte iletişim bilgisi ister (User-Agent'ta e-posta); olmayan istekleri 403 ile reddeder. İletişim bilgisi koda
yazılmaz: GitHub sırrı / ortam değişkeni SEC_CONTACT (ör. "Ad Soyad ad@ornek.com") yoksa bu modül hiçbir şey yapmaz.
Saniyede en fazla birkaç istek; her hata sessizce atlanır (kitap haberlerle çalışmaya devam eder).
"""
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

import requests

import scan as S

FEED = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&start={start}&count=100&output=atom"
TICKERS = "https://www.sec.gov/files/company_tickers.json"
CACHE = S.DATA / "sec_cik.json"
ITEMS = {"1.01": "anlaşma", "2.02": "sonuçlar", "7.01": "açıklama", "8.01": "diğer olay", "5.02": "yönetim değişikliği", "2.01": "satın alma"}


def _headers():
    c = os.environ.get("SEC_CONTACT", "").strip()
    return {"User-Agent": f"Diogenes research {c}", "Accept-Encoding": "gzip, deflate"} if c else None


def _cik_map(h):
    try:
        m = json.loads(CACHE.read_text(encoding="utf-8"))
        if time.time() - m.get("ts", 0) < 7 * 86400:
            return m["map"]
    except Exception:
        pass
    r = requests.get(TICKERS, headers=h, timeout=20)
    r.raise_for_status()
    mp = {str(v["cik_str"]): v["ticker"].replace("-", ".").upper() for v in r.json().values()}
    CACHE.write_text(json.dumps(dict(ts=time.time(), map=mp), separators=(",", ":")), encoding="utf-8")
    return mp


def parse(xml, cik_to_ticker, since):
    """Atom feed → {ticker: {items: [...], time}} for filings newer than `since` (UTC datetime)."""
    out = {}
    for entry in re.findall(r"<entry>(.*?)</entry>", xml, re.S):
        title = re.search(r"<title>(.*?)</title>", entry, re.S)
        upd = re.search(r"<updated>(.*?)</updated>", entry)
        if not title or not upd:
            continue
        cik = re.search(r"\((\d{10})\)", title.group(1))
        if not cik:
            continue
        tk = cik_to_ticker.get(str(int(cik.group(1))))
        when = datetime.fromisoformat(upd.group(1))
        if not tk or when.astimezone(timezone.utc) < since:
            continue
        items = sorted(set(re.findall(r"Item (\d\.\d\d)", entry)))
        e = out.setdefault(tk, dict(items=[], time=upd.group(1)))
        e["items"] = sorted(set(e["items"]) | {f"{i} {ITEMS.get(i, '')}".strip() for i in items})
    return out


def recent(hours=24):
    h = _headers()
    if not h:
        return {}
    mp = _cik_map(h)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    out = {}
    for start in (0, 100, 200):
        r = requests.get(FEED.format(start=start), headers=h, timeout=20)
        if r.status_code != 200:
            break
        got = parse(r.text, mp, since)
        for k, v in got.items():
            out.setdefault(k, v)
        if not got:
            break
        time.sleep(0.3)
    return out
