import {test} from "node:test";
import assert from "node:assert/strict";
import {sunucuKur} from "../sunucu.mjs";
import {IsYoneticisi} from "../is.mjs";

async function ac(yonetici=new IsYoneticisi(async()=>0)){
  const s=sunucuKur({token:"T0K",yonetici,durumFn:async()=>[{id:"zenon",renk:"sari"}]});
  await new Promise(r=>s.listen(0,"127.0.0.1",r));
  const taban=`http://127.0.0.1:${s.address().port}`;
  return {s,taban,iste:(yol,o={})=>fetch(taban+yol,{...o,headers:{"x-yonet":"T0K","content-type":"application/json",...(o.headers||{})}})};
}

test("anahtarsız sayfa ve API 403; anahtarla 200", async () => {
  const {s,taban,iste}=await ac();
  assert.equal((await fetch(taban+"/")).status,403);
  assert.equal((await fetch(taban+"/?t=YANLIS")).status,403);
  assert.equal((await fetch(taban+"/?t=T0K")).status,200);
  assert.equal((await fetch(taban+"/api/projeler")).status,403);
  assert.equal((await iste("/api/projeler")).status,200);
  s.close();
});

test("başka Origin'den POST 403", async () => {
  const {s,iste}=await ac();
  assert.equal((await iste("/api/is",{method:"POST",headers:{origin:"https://kotu.example"},body:JSON.stringify({tur:"test",proje:"kleanthes"})})).status,403);
  s.close();
});

test("yayın ve anahtar onaysız 400; iş sürerken ikinci 409", async () => {
  let birak;const y=new IsYoneticisi(async()=>{await new Promise(r=>(birak=r));return 0;});
  const {s,iste}=await ac(y);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"yayin",proje:"kleanthes"})})).status,400);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"anahtar",anahtar:"zenon"})})).status,400);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"test",proje:"kleanthes"})})).status,202);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"test",proje:"zenon"})})).status,409);
  assert.equal((await iste("/api/is")).status,200);
  birak();s.close();
});

test("durum işi sonucu veri olarak döner", async () => {
  const {s,iste}=await ac();
  assert.equal((await iste("/api/durum",{method:"POST"})).status,202);
  let d;for(let i=0;i<50;i++){d=await (await iste("/api/is")).json();if(!d.calisiyor)break;await new Promise(r=>setTimeout(r,10));}
  assert.deepEqual(d.sonuc.veri,[{id:"zenon",renk:"sari"}]);
  s.close();
});
