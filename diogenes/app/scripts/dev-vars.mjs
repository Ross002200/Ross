// Yerel geliştirme için .dev.vars: eksik test anahtarlarını rastgele değerle ekler (gerçek şifre değildir).
import fs from "node:fs";
import crypto from "node:crypto";
const yol=new URL("../.dev.vars",import.meta.url);
const var_=fs.existsSync(yol)?fs.readFileSync(yol,"utf8"):"";
const eksik=["AUTH_PASSWORD","SESSION_SECRET","DAZAI_KEY","PIYASA_KEY"].filter(k=>!new RegExp(`^${k}=`,"m").test(var_));
if(eksik.length){
  fs.writeFileSync(yol,var_+(var_&&!var_.endsWith("\n")?"\n":"")+eksik.map(k=>`${k}=${crypto.randomBytes(24).toString("hex")}`).join("\n")+"\n");
  console.log(".dev.vars güncellendi:",eksik.join(", "));
}
