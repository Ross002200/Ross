"""Hafta sonu hazırlığı: evreni yeniler, gelecek haftanın bilanço ve makro takvimini, sektör gücünü,
haftanın en güçlü hisselerini ve kâğıt hesabın haftalık sonucunu data/weekly.json'a yazar, özeti bildirir.
Claude'un hafta sonu rutini bu dosyayı okuyup data/brief.json'a Türkçe hafta notunu ekler."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import scan  # noqa: E402
import universe  # noqa: E402

SECTORS = {"XLK": "Teknoloji", "XLF": "Finans", "XLE": "Enerji", "XLV": "Sağlık", "XLY": "Tüketici (isteğe bağlı)", "XLI": "Sanayi",
           "XLP": "Temel tüketim", "XLU": "Kamu hizmetleri", "XLB": "Malzeme", "XLRE": "Gayrimenkul", "XLC": "İletişim", "SMH": "Yarı iletken"}


def main():
    try:
        universe.build()
    except Exception as e:
        print(f"evren: {e}")
    uni = universe.load()
    syms = sorted(uni)
    now = scan.now_ny()
    nxt_mon = (now + timedelta(days=(7 - now.weekday()) % 7 or 7)).date()
    nxt_fri = nxt_mon + timedelta(days=4)

    d1raw = scan.download(syms, period="3mo", interval="1d")
    rows = []
    for s in syms:
        d = scan.split(d1raw, s)
        if len(d) < 30:
            continue
        cl = d["Close"]
        up = bool(cl.iloc[-1] > scan.ema(cl, 50).iloc[-1] and scan.ema(cl, 20).iloc[-1] > scan.ema(cl, 50).iloc[-1])
        avgv = d["Volume"].iloc[-15:].mean()
        rows.append(dict(symbol=s, name=uni[s].get("name"), sector=uni[s].get("sector"), last=scan.r2(cl.iloc[-1]), wk=scan.r2((cl.iloc[-1] / cl.iloc[-6] - 1) * 100),
                         m1=scan.r2((cl.iloc[-1] / cl.iloc[-22] - 1) * 100), up=up, liquid=bool(avgv >= 1e6 and cl.iloc[-1] >= 5)))
    df = pd.DataFrame(rows)
    sectors = []
    for etf, name in SECTORS.items():
        r = df[df.symbol == etf]
        if len(r):
            sectors.append(dict(etf=etf, name=name, wk=r.wk.iloc[0], m1=r.m1.iloc[0], up=bool(r.up.iloc[0])))
    sectors.sort(key=lambda x: -(x["wk"] or 0))
    leaders = df[(df.liquid) & (df.up) & (~df.sector.eq("ETF"))].sort_values("wk", ascending=False).head(15).to_dict("records")

    # earnings next week for liquid uptrend names (the ones the scanner may trade)
    earn = []
    for s in df[(df.liquid) & (~df.sector.eq("ETF"))].symbol:
        e = scan.earnings_date(s)
        if e and str(nxt_mon) <= e <= str(nxt_fri):
            earn.append(dict(symbol=s, name=uni[s].get("name"), date=e))
    earn.sort(key=lambda x: x["date"])

    macro = [e for e in json.loads((scan.HERE / "macro.json").read_text())["events"] if str(nxt_mon) <= e["date"] <= str(nxt_fri)]
    idx = {s: dict(wk=df[df.symbol == s].wk.iloc[0], m1=df[df.symbol == s].m1.iloc[0], up=bool(df[df.symbol == s].up.iloc[0])) for s in ("SPY", "QQQ", "IWM", "DIA") if (df.symbol == s).any()}

    st = scan.load_state()
    week_start = str((now - timedelta(days=now.weekday())).date())
    closed = [t for t in st["trades"] if t["status"] == "closed" and str(t.get("exit_time", ""))[:10] >= week_start]
    perf = dict(trades=len(closed), wins=sum(1 for t in closed if (t.get("pnl") or 0) > 0), r=round(sum(t.get("net_r") or 0 for t in closed), 2),
                pnl=round(sum(t.get("pnl") or 0 for t in closed), 2), equity=scan.equity(st))
    news = scan.headlines("SPY", 5) + scan.headlines("QQQ", 3)

    out = dict(generated=datetime.now(timezone.utc).isoformat(timespec="seconds"), week=[str(nxt_mon), str(nxt_fri)], indices=idx, sectors=sectors,
               leaders=leaders, earnings=earn, macro=macro, paper_week=perf, news=news, universe=len(syms))
    (scan.DATA / "weekly.json").write_text(json.dumps(out, ensure_ascii=False, indent=0, default=str))
    top = ", ".join(f"{s['name']} {s['wk']:+.1f}%" for s in sectors[:3])
    ev = "; ".join(f"{e['date'][5:]} {e['name']}" for e in macro) or "büyük makro veri yok"
    notify_txt = (f"Geçen hafta: SPY {idx.get('SPY', {}).get('wk', 0):+.1f}%, QQQ {idx.get('QQQ', {}).get('wk', 0):+.1f}%. Güçlü sektörler: {top}.\n"
                  f"Gelecek hafta: {ev}. Bilanço: {len(earn)} hisse.\nKâğıt hesap: {perf['trades']} işlem, {perf['r']:+.2f}R, bakiye {perf['equity']} $.")
    scan.notify("Haftaya hazırlık", notify_txt, ["calendar"], 3)
    print(notify_txt)


if __name__ == "__main__":
    main()
