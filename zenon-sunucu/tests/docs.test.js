import {test} from "node:test";
import assert from "node:assert/strict";
import {belgeleriAyikla,gecerliAnahtar,MAX_DOC} from "../src/docs.js";

test("anahtar: Zenon anahtarları geçer, eşitlenmeyenler ve bozuklar geçmez", () => {
  for(const k of ["log","care.state","coach.todo","card:2026-11-09","wear.idx"])assert.equal(gecerliAnahtar(k),true,k);
  for(const k of ["photos","care.push","aurelius","coach.body","","a b","x".repeat(81),null,7])assert.equal(gecerliAnahtar(k),false,String(k));
});

test("ayıkla: geçerliler metne çevrilir, bozuklar ve büyükler reddedilir, istek düşmez", () => {
  const r=belgeleriAyikla({items:[
    {key:"log",data:[{d:"2026-11-09"}]},
    {key:"photos",data:{}},
    {key:"plan",data:undefined},
    {key:"buyuk",data:"x".repeat(MAX_DOC)},
    {key:"care.state",data:{done:{}}}]});
  assert.deepEqual(r.gecerli,[{key:"log",text:'[{"d":"2026-11-09"}]'},{key:"care.state",text:'{"done":{}}'}]);
  assert.deepEqual(r.reddedilen.map(x=>x.key),["photos","plan","buyuk"]);
  assert.match(r.reddedilen[2].neden,/1 MB/);
});

test("ayıkla: items yoksa ya da çok fazlaysa hata", () => {
  assert.throws(()=>belgeleriAyikla({}),/items gerekli/);
  assert.throws(()=>belgeleriAyikla({items:Array.from({length:201},(_,i)=>({key:"k"+i,data:1}))}),/en çok 200/);
});
