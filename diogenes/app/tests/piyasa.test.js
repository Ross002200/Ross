import {test} from "node:test";
import assert from "node:assert/strict";
import * as p from "../src/piyasa.js";
import {listeDogrula} from "../src/core.js";

const s=(gun,kod,deger,ek={})=>({gun,kod,grup:"altin_doviz",tip:"doviz",ad:kod,birim:"₺",kaynak:"yahoo",deger,durum:deger==null?"yok":"ok",...ek});

test("supheliMi ve degisim", () => {
  assert.equal(p.supheliMi("doviz",42,41),false);
  assert.equal(p.supheliMi("doviz",50,41),true,"+%22 dövizde şüpheli");
  assert.equal(p.supheliMi("hisse",50,41),false,"+%22 hissede olağan");
  assert.equal(p.supheliMi("endeks",0,100),true,"sıfır fiyat");
  assert.equal(p.supheliMi("doviz",42,undefined),false,"önceki yoksa yalnız pozitiflik");
  assert.equal(p.supheliMi("faiz",0,40),false,"faizde eşik yok");
  assert.ok(Math.abs(p.degisim(42,40)-0.05)<1e-12);assert.equal(p.degisim(42,null),null);
});

test("isGunuFarki: hafta sonu sayılmaz", () => {
  assert.equal(p.isGunuFarki("2026-11-27","2026-11-30"),1,"cuma → pazartesi");
  assert.equal(p.isGunuFarki("2026-11-26","2026-11-30"),2);
  assert.equal(p.isGunuFarki("2026-11-30","2026-11-30"),0);
});

test("panoGorunum: son iyi değer, değişim, yok/şüpheli etiket, 30 günlük seri, bayatlık", () => {
  const rows=[s("2026-11-26","USDTRY",41.5),s("2026-11-27","USDTRY",41.9),s("2026-11-30","USDTRY",42.1),
    s("2026-11-27","EURTRY",48),s("2026-11-30","EURTRY",70,{durum:"supheli"}),
    s("2026-11-27","XU100",10000,{grup:"tr",tip:"endeks",birim:""}),s("2026-11-30","XU100",null,{grup:"tr",tip:"endeks",birim:""})];
  const v=p.panoGorunum(rows,"2026-11-30");
  assert.equal(v.sonGun,"2026-11-30");assert.equal(v.bayat,false);
  const k=Object.fromEntries(v.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
  assert.equal(k.USDTRY.deger,42.1);assert.ok(Math.abs(k.USDTRY.degisim-(42.1/41.9-1))<1e-12);assert.deepEqual(k.USDTRY.seri,[41.5,41.9,42.1]);
  assert.equal(k.EURTRY.durum,"supheli");assert.equal(k.EURTRY.deger,48,"şüphelide son iyi değer");assert.equal(k.EURTRY.degisim,null);
  assert.equal(k.XU100.durum,"yok");assert.equal(k.XU100.deger,10000);assert.equal(k.XU100.gun,"2026-11-27");
  assert.deepEqual(v.gruplar.map(g=>g.grup),["altin_doviz","tr","abd","faiz"]);
  assert.equal(p.panoGorunum(rows,"2026-12-02").bayat,true,"iki iş günü geride");
  assert.equal(p.panoGorunum([],"2026-11-30").bayat,true,"hiç veri yok");
  assert.deepEqual(p.seritOlustur(rows,"2026-11-30").map(x=>x.kod),["USDTRY"],"yalnız güncel (ok) kartlar; XU100 son satırı yok");
});

test("reelGetiri ve karne: fiyat ve mevduat, eksik veri", () => {
  const aylik=[];for(let i=0;i<=12;i++){const ay=p.ayGeri("2026-10",i);aylik.push({ay,kod:"TUFE",deger:100*1.02**(12-i)},{ay,kod:"MEVDUAT",deger:48});}
  aylik.push({ay:"2026-10",kod:"GRAM",deger:200},{ay:"2025-10",kod:"GRAM",deger:100},{ay:"2026-09",kod:"GRAM",deger:190});
  assert.equal(p.ayGeri("2026-01",1),"2025-12");assert.equal(p.ayGeri("2026-10",12),"2025-10");
  assert.ok(Math.abs(p.reelGetiri(aylik,"GRAM","2026-10",12)-(2/1.02**12-1))<1e-9);
  assert.ok(Math.abs(p.reelGetiri(aylik,"GRAM","2026-10",1)-((200/190)/1.02-1))<1e-9);
  assert.ok(Math.abs(p.reelGetiri(aylik,"MEVDUAT","2026-10",3)-(1.04**3/1.02**3-1))<1e-9,"aylık %4, bileşik");
  assert.equal(p.reelGetiri(aylik,"GRAM","2026-10",3),null,"3 ay önceki fiyat yok");
  const k=p.karne(aylik,[{kod:"GRAM",ad:"Gram altın"},{kod:"USDTRY",ad:"Dolar"}]);
  assert.equal(k.sonAy,"2026-10");assert.equal(k.satirlar[1].r12,null);
  assert.deepEqual(p.karne([],[{kod:"GRAM",ad:"Gram"}]),{sonAy:null,satirlar:[{kod:"GRAM",ad:"Gram",r1:null,r3:null,r12:null}]});
});

test("harcamaHizi: ilk 3 gün yok, ay içinde biterse gün, bitmezse null", () => {
  assert.equal(p.harcamaHizi({ad:"Yemek",kalan:300000,harcanan:300000},"2026-11-03"),null);
  assert.deepEqual(p.harcamaHizi({ad:"Yemek",kalan:300000,harcanan:300000},"2026-11-10"),{biter:"2026-11-20",ort:30000});
  assert.equal(p.harcamaHizi({ad:"Kira",kalan:900000,harcanan:10000},"2026-11-10"),null);
  assert.equal(p.harcamaHizi({ad:"Yemek",kalan:-5000,harcanan:605000},"2026-11-10").biter,"2026-11-10");
  assert.equal(p.harcamaHizi({ad:"Boş",kalan:1000,harcanan:0},"2026-11-10"),null);
});

test("ozetMetni: piyasa, bütçe, not; kurulum yoksa bütçe yok; bayat veri", () => {
  const rows=[s("2026-11-27","USDTRY",41.9),s("2026-11-30","USDTRY",42.1),s("2026-11-27","GRAM",4000,{tip:"altin"}),s("2026-11-30","GRAM",4220,{tip:"altin"}),
    s("2026-11-27","XU100",10000,{grup:"tr",tip:"endeks",birim:""}),s("2026-11-30","XU100",10080,{grup:"tr",tip:"endeks",birim:""})];
  const pano=p.panoGorunum(rows,"2026-11-30");
  const durum={atanmamis:120000,zarflar:[{id:1,ad:"Kira",kalan:900000,harcanan:100000},{id:2,ad:"Yemek",kalan:120000,harcanan:480000}]};
  const o=p.ozetMetni({pano,durum,bugun:"2026-11-10",not:"Bugün ABD'de enflasyon verisi var."});
  assert.equal(o.metin,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8)\nYemek: 1.200 ₺ kaldı, bu hızla ayın 12. günü biter.\nBugün ABD'de enflasyon verisi var.");
  assert.equal(o.bildirim,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8) · Bütçe ayrıntısı Diogenes'te.","bildirimde kişisel tutar yok (bildirim servisi herkese açık okunur)");
  assert.equal(p.ozetMetni({pano,durum:null,bugun:"2026-11-30",not:null}).metin,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8)");
  const sakin={atanmamis:120000,zarflar:[{id:1,ad:"Kira",kalan:900000,harcanan:100000}]};
  assert.match(p.ozetMetni({pano,durum:sakin,bugun:"2026-11-30",not:null}).metin,/\nAtanmamış 1\.200 ₺$/);
  assert.match(p.ozetMetni({pano:p.panoGorunum(rows,"2026-12-03"),durum:null,bugun:"2026-12-03",not:null}).metin,/^Piyasa verisi 2026-11-30 tarihinden beri güncellenmedi\.$/);
  assert.equal(p.ozetMetni({pano:p.panoGorunum([],"2026-11-30"),durum:null,bugun:"2026-11-30",not:null}).metin,"Piyasa verisi gelmedi.");
});

test("piyasaGovdeDogrula: biçim, yok satırı, sunucu tarafı şüphe", () => {
  const g=p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-27","EURTRY",48),s("2026-11-30","EURTRY",70),s("2026-11-30","XU100",null,{grup:"tr",tip:"endeks"})],aylik:[{ay:"2026-10",kod:"TUFE",deger:3100.5}],not:"  Not  "});
  assert.deepEqual(g.satirlar.map(r=>[r.kod,r.gun,r.durum]),[["EURTRY","2026-11-27","ok"],["EURTRY","2026-11-30","supheli"],["XU100","2026-11-30","yok"]]);
  assert.equal(g.not,"Not");assert.equal(g.aylik.length,1);
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"30.11.2026",satirlar:[]}),{message:"Gün geçersiz."});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-30","US D",1)]}),{message:/Satır geçersiz/});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-30","USDTRY",1,{grup:"kripto"})]}),{message:/Satır geçersiz/});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[],aylik:[{ay:"2026-13",kod:"TUFE",deger:1}]}),{message:/Aylık satır geçersiz/});
  assert.equal(p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[]}).not,null);
});

test("listeDogrula izleme: büyük harf, biçim, tür ve limit", () => {
  assert.deepEqual(listeDogrula("izleme",[{tur:"bist",kod:" thyao "},{tur:"fon",kod:"tte"}]),[{id:null,tur:"bist",kod:"THYAO",sira:1},{id:null,tur:"fon",kod:"TTE",sira:2}]);
  assert.throws(()=>listeDogrula("izleme",[{tur:"bist",kod:"THY AO"}]),{message:"Kod geçersiz: THY AO"});
  assert.throws(()=>listeDogrula("izleme",[{tur:"kripto",kod:"BTC"}]),{message:"İzleme türü BIST, ABD ya da fon olmalı."});
  assert.throws(()=>listeDogrula("izleme",Array.from({length:11},(_,i)=>({tur:"bist",kod:"K"+i}))),{message:"En çok 10 BIST hissesi eklenebilir."});
  assert.throws(()=>listeDogrula("izleme",Array.from({length:6},(_,i)=>({tur:"fon",kod:"F"+i}))),{message:"En çok 5 fon eklenebilir."});
});

test("İnceleme: eski ve veri-yok kartlar güncel gösterilmez; faiz tazeliği panoyu güncel yapmaz", () => {
  const rows=[s("2026-11-25","USDTRY",41.8),s("2026-11-26","USDTRY",42.1),s("2026-11-27","USDTRY",null),
    s("2026-11-27","POLITIKA",38,{grup:"faiz",tip:"faiz",birim:"%"}),
    s("2026-11-10","BIST:ESKI",50,{grup:"tr",tip:"hisse"}),s("2026-11-27","XU100",10000,{grup:"tr",tip:"endeks",birim:""})];
  const v=p.panoGorunum(rows,"2026-11-27");
  const k=Object.fromEntries(v.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
  assert.equal(v.sonGun,"2026-11-27");
  assert.equal(k["BIST:ESKI"].durum,"eski");assert.equal(k["BIST:ESKI"].degisim,null);
  assert.deepEqual(p.seritOlustur(rows,"2026-11-27").map(x=>x.kod),["XU100"]);
  assert.equal(p.ozetMetni({pano:v,durum:null,bugun:"2026-11-27",not:null}).metin,"BIST 100 10.000","veri yok olan dolar özete girmez");
  const f=p.panoGorunum([s("2026-11-20","USDTRY",42),s("2026-11-27","POLITIKA",38,{grup:"faiz",tip:"faiz"})],"2026-11-27");
  assert.equal(f.sonGun,"2026-11-20");assert.equal(f.bayat,true);
});

test("uzunDegisim: kartın 1, 3, 12 aylık nominal değişimi", () => {
  const aylik=[{ay:"2026-11",kod:"GRAM",deger:200},{ay:"2026-10",kod:"GRAM",deger:190},{ay:"2026-08",kod:"GRAM",deger:160},{ay:"2025-11",kod:"GRAM",deger:100}];
  const u=p.uzunDegisim(aylik,"GRAM");
  assert.ok(Math.abs(u.r1-(200/190-1))<1e-12);assert.ok(Math.abs(u.r3-0.25)<1e-12);assert.ok(Math.abs(u.r12-1)<1e-12);
  assert.deepEqual(p.uzunDegisim(aylik,"USDTRY"),{r1:null,r3:null,r12:null});
});
