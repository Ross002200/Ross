// Diogenes bildirim servisi (2026-10-26; kullanıcı: "bildirimler ntfy yerine doğrudan Diogenes'ten gelsin").
// GitHub Actions POST /gonder ile bildirimi yazar; servis son bildirimleri saklar ve abone telefonlara içeriksiz
// web push gönderir. Uygulamanın service worker'ı push gelince GET /son'dan en yeni bildirimi okuyup gösterir
// (içeriksiz push şifreleme gerektirmez; iOS ve Android'de çalışır).
//
// KV (DIOG): "abone:<id>" → PushSubscription JSON, "son" → son 60 bildirim.
// Gizli değerler (wrangler secret): VAPID_JWK (özel anahtar, JWK), GONDER_TOKEN. Açık anahtar: VAPID_PUBLIC (vars).

const IZINLI = "https://ross002200.github.io";
const SON_ADET = 60;
const TEKRAR_SN = 20 * 3600;

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin === IZINLI ? IZINLI : IZINLI,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});
const json = (veri, durum, origin) =>
  new Response(JSON.stringify(veri), { status: durum || 200, headers: { "Content-Type": "application/json", ...cors(origin) } });

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const metinB64u = (s) => b64u(new TextEncoder().encode(s));

async function ozet(s) {
  return b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).slice(0, 22);
}

async function vapidBasligi(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const baslik = metinB64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const govde = metinB64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "https://ross002200.github.io/Ross/diogenes/" }));
  const anahtar = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const imza = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, anahtar, new TextEncoder().encode(`${baslik}.${govde}`));
  return `vapid t=${baslik}.${govde}.${b64u(imza)}, k=${env.VAPID_PUBLIC}`;
}

async function aboneler(env) {
  const liste = await env.DIOG.list({ prefix: "abone:" });
  const out = [];
  for (const k of liste.keys) {
    const v = await env.DIOG.get(k.name);
    if (v) out.push([k.name, JSON.parse(v)]);
  }
  return out;
}

async function pushla(env, oncelik) {
  let gonderilen = 0;
  for (const [ad, abone] of await aboneler(env)) {
    try {
      const r = await fetch(abone.endpoint, { method: "POST", headers: {
        Authorization: await vapidBasligi(env, abone.endpoint), TTL: "86400", Urgency: oncelik >= 4 ? "high" : "normal",
        "Content-Length": "0" } });
      if (r.status === 404 || r.status === 410) await env.DIOG.delete(ad);   // abonelik bitmiş
      else if (r.ok) gonderilen++;
    } catch (e) { /* tek abonenin hatası diğerlerini durdurmaz */ }
  }
  return gonderilen;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });

    if (url.pathname === "/vapid") return json({ anahtar: env.VAPID_PUBLIC }, 200, origin);

    if (url.pathname === "/son") {
      const n = Math.max(1, Math.min(SON_ADET, Number(url.searchParams.get("n")) || 20));
      const son = JSON.parse((await env.DIOG.get("son")) || "[]");
      return json({ bildirimler: son.slice(0, n) }, 200, origin);
    }

    if (url.pathname === "/abone" && req.method === "POST") {
      const s = await req.json().catch(() => null);
      if (!s || typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://") || s.endpoint.length > 1000)
        return json({ hata: "geçersiz abonelik" }, 400, origin);
      await env.DIOG.put(`abone:${await ozet(s.endpoint)}`, JSON.stringify({ endpoint: s.endpoint, keys: s.keys || null }));
      return json({ tamam: true }, 200, origin);
    }

    if (url.pathname === "/abone/sil" && req.method === "POST") {
      const s = await req.json().catch(() => null);
      if (s && s.endpoint) await env.DIOG.delete(`abone:${await ozet(s.endpoint)}`);
      return json({ tamam: true }, 200, origin);
    }

    if (url.pathname === "/gonder" && req.method === "POST") {
      if (req.headers.get("Authorization") !== `Bearer ${env.GONDER_TOKEN}`) return json({ hata: "yetki yok" }, 401, origin);
      const b = await req.json().catch(() => null);
      if (!b || !b.title) return json({ hata: "title gerekli" }, 400, origin);
      const simdi = Math.floor(Date.now() / 1000);
      const kayit = { id: await ozet(`${simdi}|${b.title}|${b.message || ""}`), ts: simdi, title: String(b.title).slice(0, 200),
        message: String(b.message || "").slice(0, 2000), tags: (b.tags || []).slice(0, 5), priority: Number(b.priority) || 3 };
      const son = JSON.parse((await env.DIOG.get("son")) || "[]");
      if (son.some((x) => x.title === kayit.title && x.message === kayit.message && simdi - x.ts < TEKRAR_SN))
        return json({ tekrar: true, abone: (await env.DIOG.list({ prefix: "abone:" })).keys.length }, 200, origin);
      son.unshift(kayit);
      await env.DIOG.put("son", JSON.stringify(son.slice(0, SON_ADET)));
      const gonderilen = await pushla(env, kayit.priority);
      return json({ tamam: true, gonderilen, abone: (await env.DIOG.list({ prefix: "abone:" })).keys.length }, 200, origin);
    }

    return json({ servis: "diogenes-bildirim" }, 200, origin);
  },
};
