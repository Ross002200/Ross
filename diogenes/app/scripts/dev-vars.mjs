// Yerel geliştirme için .dev.vars: yoksa rastgele test şifresi ve oturum anahtarı yazar (gerçek şifre değildir).
import fs from "node:fs";
import crypto from "node:crypto";
const yol=new URL("../.dev.vars",import.meta.url);
if(!fs.existsSync(yol)){
  const r=()=>crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(yol,`AUTH_PASSWORD=${r()}\nSESSION_SECRET=${r()}\nDAZAI_KEY=${r()}\n`);
  console.log(".dev.vars yazıldı (yerel test değerleri).");
}
