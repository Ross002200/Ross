"""Gerçek bütçe: 600 $ (kullanıcının Midas hesabı). Bütçeyi veriye göre yönetir; emir vermez, ne yapılacağını söyler.

Neden böyle bölündü (2 Ekim 2026 hesabı, laboratuvar verisi + Monte Carlo):
- Günün planı 600 $'lık bakiyede her pozisyon büyüklüğünde komisyon sonrası eksi çıktı (işlem başı −0,4 / −1,7 $):
  emir başı 1,5 $ küçük pozisyonda getiriyi yiyor. Gerçek para yok, kâğıt üzerinde veri toplamaya devam eder.
- Rejim değiştirici, laboratuvarda çoklu test düzeltmesinden sonra anlamlı kalan tek strateji. 300 $'lık pozisyonda
  işlem başı ≈ +3,8 $; 60 işlemde 120 $ (bakiyenin %20'si) kaybetme ihtimali ≈ %32. Tam bütçede bu ihtimal %45.
Kurallar:
- Tek pozisyon. Sıradaki sinyal yalnız pozisyon kapandıktan sonra alınır.
- Aşama 1 (ilk 10 işlem): işlem başı 300 $. 10 işlem sonunda net artı ve kayıp serisi normalse aşama 2: 450 $.
- Gerçek kayıp 90 $'a (bakiyenin %15'i) ulaşırsa swing durur; kurallar gözden geçirilmeden yeniden başlamaz.
- Kalan para nakitte kalır (kayıp tamponu).
data/swing.json durumu tutar; laboratuvar her akşam çalıştıktan sonra güncellenir.
"""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scan as S  # noqa: E402

ST = S.DATA / "swing.json"
LAB = S.DATA / "lab.json"
START = dict(balance=600.0, alloc1=300.0, alloc2=450.0, phase_trades=10, kill=90.0, strategy="rejim", fee=1.5)


def load():
    try:
        return json.loads(ST.read_text())
    except Exception:
        return dict(START, position=None, history=[], paused=False, created=datetime.now(timezone.utc).isoformat(timespec="seconds"))


def alloc(st):
    h = st["history"]
    net = sum(x["pnl"] for x in h)
    if len(h) >= st["phase_trades"] and net > 0 and not st.get("streak_alarm"):
        return st["alloc2"], 2
    return st["alloc1"], 1


def main():
    st = load()
    try:
        lab = json.loads(LAB.read_text())
    except Exception as ex:
        print(f"swing: lab.json okunamadı: {ex}", file=sys.stderr)
        return
    strat = next((e for e in lab.get("strategies", []) if e["id"] == st["strategy"]), None)
    if not strat:
        print("swing: strateji yok")
        return
    fw = {(t["sym"], t["sig"]): t for t in strat.get("forward", [])}
    st["streak_alarm"] = (strat.get("streak") or {}).get("level") == "alarm"
    pos = st.get("position")
    fee2 = 2 * st["fee"]
    # 1) position follow-up
    if pos:
        t = fw.get((pos["sym"], pos["sig"]))
        if t and pos["status"] == "emir" and t.get("entry_d"):
            qty = max(1, math.floor(pos["alloc"] / t["entry"]))
            pos.update(status="açık", entry=t["entry"], stop=t["stop"], qty=qty, entry_d=t["entry_d"])
            S.notify(f"Swing: {pos['sym']} alındı", f"Giriş ≈ {t['entry']} $ ({t['entry_d']} açılış) · {qty} adet · stop {t['stop']} $\n"
                     f"Midas'ta stop emri girili olsun. Çıkış: {pos['exit_rule']}", ["chart_with_upwards_trend"], 4)
        if t and t.get("exit_d"):
            qty = pos.get("qty") or max(1, math.floor(pos["alloc"] / t["entry"]))
            pnl = round(qty * (t["exit"] - t["entry"]) - fee2, 2)
            st["history"].append(dict(sym=pos["sym"], sig=pos["sig"], entry_d=t.get("entry_d"), exit_d=t["exit_d"], entry=t["entry"], exit=t["exit"],
                                      qty=qty, pct=t["pct"], pnl=pnl, why=t.get("why")))
            when = "yarın açılışta sat" if t.get("why") in ("çıkış", "süre") else "stop/hedef emri gerçekleşmiş olmalı; Midas'ta kontrol et"
            S.notify(f"Swing: {pos['sym']} kapandı ({t.get('why')})", f"{t['pct']:+.2f}% · {pnl:+.2f} $ (komisyon dahil) · {when}.\n"
                     f"Toplam: {len(st['history'])} işlem, net {sum(x['pnl'] for x in st['history']):+.2f} $", ["white_check_mark" if pnl > 0 else "x"], 4)
            st["position"] = pos = None
        elif not t and pos["status"] == "emir" and pos["sig"] < lab["period"][1]:
            st["position"] = pos = None  # the order day passed without a fill in the lab record: drop it
    # 2) kill switch
    net = sum(x["pnl"] for x in st["history"])
    if net <= -st["kill"] and not st.get("paused"):
        st["paused"] = True
        S.notify("Swing durdu", f"Gerçek kayıp {net:.2f} $ ({st['kill']:.0f} $ sınırı). Kurallar gözden geçirilmeden yeni swing işlemi yok.", ["octagonal_sign"], 5)
    # 3) new signal (one position at a time)
    if not pos and not st.get("paused"):
        pend = [x for x in strat.get("pending", []) if x.get("entry") and x.get("stop") and x["stop"] < x["entry"]]
        pend.sort(key=lambda x: (x["entry"] - x["stop"]) / x["entry"])  # tightest stop first: least dollars at risk
        if pend:
            x = pend[0]
            a, phase = alloc(st)
            qty = max(1, math.floor(a / x["entry"]))
            risk = qty * (x["entry"] - x["stop"]) + fee2
            bnf = (x["entry"] - x["stop"]) / x["entry"] > 0.095
            rule = ("hedef 25 günlük ortalamanın %97'si ya da en fazla 10 gün (aşırı satılan alımı)" if bnf
                    else "kapanış 10 günlük ortalamanın altına inince ertesi açılışta sat; en fazla 20 gün (trend)")
            st["position"] = dict(sym=x["sym"], sig=x["sig"], status="emir", alloc=a, phase=phase, entry_est=x["entry"], stop_est=x["stop"], qty_est=qty,
                                  risk=round(risk, 2), exit_rule=rule)
            S.notify(f"Swing sinyali: {x['sym']}", f"Yarın {x['plan']} · ≈ {qty} adet ({a:.0f} $) · stop ≈ {x['stop']} $\n"
                     f"En kötü senaryo: −{risk:.0f} $ (bakiyenin %{100 * risk / st['balance']:.1f}). Çıkış: {rule}.\n"
                     f"Aşama {phase}; tek pozisyon kuralı geçerli.", ["test_tube"], 4)
    a, phase = alloc(st)
    st.update(updated=datetime.now(timezone.utc).isoformat(timespec="seconds"), net=round(net, 2), alloc_now=a, phase=phase,
              equity=round(st["balance"] + net, 2), lab_status=strat.get("status"), lab_sig=(strat.get("backtest") or {}).get("significant"))
    txt = json.dumps(st, ensure_ascii=False, indent=0)
    json.loads(txt)
    ST.write_text(txt)
    print(f"swing: aşama {phase}, pozisyon {(st.get('position') or {}).get('sym')}, net {net:+.2f}")


if __name__ == "__main__":
    main()
