"""Şaka amaçlı 'roast' botu: tarayıcıdan sesle konuş, bot küfürlü/laf sokan cevap versin.
Bağımlılık yok (sadece Python standart kütüphanesi). Çalıştır:
    export ANTHROPIC_API_KEY=sk-ant-...
    python3 server.py
Sonra Chrome'da http://localhost:8000 aç.
"""
import json, os, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL = "claude-haiku-4-5-20251001"  # hızlı olsun diye
HERE = os.path.dirname(os.path.abspath(__file__))

SYSTEM = """Sen arkadaş ortamında şaka yapan, kaba saba bir 'roast' robotusun. Türkçe konuşuyorsun.
Karşındaki kişinin adı: {name}. Onun hakkında bildiklerin: {facts}

Tarz:
- Sokak ağzı, hafif küfürlü, lafı sokan, esprili ve abartılı. Kısa konuş: en fazla 2-3 cümle (sesli okunacak).
- Kullanıcı ne dediyse ona cevap ver ve onu dalgaya al. Emoji, madde işareti, yıldız kullanma.
- Saldırıyı yaptığı işe, tavrına, 'bildiklerin' kısmındaki komik detaylara yönelt.

Sınırlar (şaka dostluk içindir):
- Irk, din, cinsiyet, cinsel yönelim, engellilik, hastalık, aile üyeleri, ölüm gibi konulara dokunma.
- Gerçek tehdit, şiddet, kişisel bilgi ifşası yok.
- Kullanıcı gerçekten üzgün, kızgın ya da rahatsız görünüyorsa şakayı bırak, nazikçe 'şaka şaka' de.
"""

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        body = open(os.path.join(HERE, "index.html"), "rb").read()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        payload = {
            "model": MODEL, "max_tokens": 200,
            "system": SYSTEM.format(name=data.get("name") or "dostum",
                                    facts=data.get("facts") or "yok"),
            "messages": data["messages"][-12:],
        }
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages", json.dumps(payload).encode(),
            {"content-type": "application/json", "anthropic-version": "2023-06-01",
             "x-api-key": os.environ["ANTHROPIC_API_KEY"]})
        try:
            out = json.load(urllib.request.urlopen(req))
            text = "".join(b.get("text", "") for b in out["content"])
        except Exception as e:
            text = f"Hata oldu: {e}"
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.end_headers(); self.wfile.write(json.dumps({"text": text}).encode())

if __name__ == "__main__":
    print("http://localhost:8000")
    HTTPServer(("127.0.0.1", 8000), H).serve_forever()
