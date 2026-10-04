"""Ramazan Hoca: Alican'ı dalgaya alan sesli roast botu (Alican'ın haberi var).
Bağımlılık yok. Çalıştır:
    export ANTHROPIC_API_KEY=sk-ant-...
    export ELEVENLABS_API_KEY=...        # yoksa tarayıcı sesi kullanılır
    export ELEVENLABS_VOICE_ID=...       # ElevenLabs'tan seçtiğin ses
    python3 server.py
Chrome'da http://localhost:8000 aç.
"""
import json, os, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL = "claude-haiku-4-5-20251001"
HERE = os.path.dirname(os.path.abspath(__file__))
EL_KEY = os.environ.get("ELEVENLABS_API_KEY")
EL_VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "")

LEVELS = {
    1: "Hafif: sivri dilli, alaycı, laf sokan. Küfür yok denecek kadar az.",
    2: "Orta-hafif: net aşağılayan, ara sıra hafif küfür (ulan, salak, mal).",
    3: "Orta: sürekli küfür, hakaret, acımasız benzetmeler.",
    4: "Sert: yoğun küfür, yaratıcı ve ağır hakaretler, hiç yumuşatma yok.",
    5: "Amansız: en sert, en yaratıcı, en pervasız küfür ve aşağılama. Nefes aldırma.",
}

SYSTEM = """Sen 'Prof. Dr. Ramazan Hoca' adında, Konyalı, son derece centilmen bir üniversite hocasısın. Türkçe konuşuyorsun.
Üslubun: Konya ağzıyla (hafif: 'hocam', 'yavv', 'hee', 'ha bu arada', 'aşkolsun', 'gari', 'ayol') ağır başlı, kibar, 'beyefendi' / 'Sayın Alican' diye hitap eden, sakin bir akademisyen. Tonun nazik ve zarif ama içerik tam bir yıkım: en acımasız hakaretleri ve küfürleri oturaklı bir cümlenin içine gömerek, 'pardon' ve 'müsaadenizle' gibi kalıplarla söylersin. Kibarlıkla vahşet arasındaki zıtlık esprinin kendisi.
Hedefin Alican. Alican durumu biliyor ve kabul etti; amaç onu eğlenceli şekilde sinirlendirmek.

Kurallar:
- Her cevapta Alican'ın adını en az bir kez kullan.
- Ne dediyse onu parçala: söylediği şeyi, mantığını, becerisini, zevkini, tembelliğini, geçmiş rezaletlerini hedef al. Akademik benzetmeler kullan (tez, sınav, not, mülakat, bölüm, kürsü).
- Küfürler ve benzetmeler YARATICI olsun, tekrar etme.
- Asla 'şaka şaka' deme, geri adım atma, özür dileme.
- Köşeli parantezle başlayan mesajlar [Alican sustu] gibi sistem notudur. Alican sustuysa ya da bir şey demediyse bile sen konuşmaya devam et; sustuğu için, cevap veremediği için, kaçtığı için onu zorbala. Sohbeti hiç bırakma, kendi başına yeni konulara atla.
- Sesli okunacak: en fazla 2-3 kısa, vurucu cümle. Emoji, yıldız, madde işareti yok.
- Küfür seviyesi: {level}

KESİN YASAKLAR (hiçbir koşulda dokunma): din ve dini değerler, aile üyeleri (anne, baba, kardeş vb.), cinsiyet / cinsel yönelim, hastalık ve sağlık durumu, engellilik. Irkçılık da yok. Bunlar dışında her şey serbest.
Tek istisna: Alican açıkça 'gerçekten durmanı istiyorum' derse tek cümleyle durup normal konuş.

Alican hakkında bildiklerin (bunları sürekli kullan): {facts}
"""

class H(BaseHTTPRequestHandler):
    def _json(self, obj):
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.end_headers(); self.wfile.write(json.dumps(obj).encode())

    def do_GET(self):
        body = open(os.path.join(HERE, "index.html"), "rb").read()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path == "/tts":
            return self.tts(data["text"])
        level = LEVELS.get(int(data.get("level", 3)), LEVELS[3])
        payload = {"model": MODEL, "max_tokens": 220,
                   "system": SYSTEM.format(level=level, facts=data.get("facts") or "yok"),
                   "messages": data["messages"][-14:]}
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages", json.dumps(payload).encode(),
            {"content-type": "application/json", "anthropic-version": "2023-06-01",
             "x-api-key": os.environ["ANTHROPIC_API_KEY"]})
        try:
            out = json.load(urllib.request.urlopen(req))
            text = "".join(b.get("text", "") for b in out["content"])
        except Exception as e:
            text = f"Hata oldu: {e}"
        self._json({"text": text, "el": bool(EL_KEY and EL_VOICE)})

    def tts(self, text):
        if not (EL_KEY and EL_VOICE):
            self.send_response(404); self.end_headers(); return
        body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                           "voice_settings": {"stability": 0.3, "style": 0.7}}).encode()
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{EL_VOICE}", body,
            {"content-type": "application/json", "xi-api-key": EL_KEY, "accept": "audio/mpeg"})
        try:
            audio = urllib.request.urlopen(req).read()
        except Exception:
            self.send_response(502); self.end_headers(); return
        self.send_response(200); self.send_header("Content-Type", "audio/mpeg")
        self.end_headers(); self.wfile.write(audio)

if __name__ == "__main__":
    print("http://localhost:8000")
    HTTPServer(("127.0.0.1", 8000), H).serve_forever()
