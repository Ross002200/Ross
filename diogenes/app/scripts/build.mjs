// Arayüz core.js'i tarayıcıda da kullanır: src/core.js → public/core.js.
import fs from "node:fs";
fs.copyFileSync(new URL("../src/core.js",import.meta.url),new URL("../public/core.js",import.meta.url));
for(const f of ["index.html","app.js","giris.html"])if(!fs.existsSync(new URL("../public/"+f,import.meta.url)))console.warn("Eksik: public/"+f);
console.log("public/core.js güncellendi.");
