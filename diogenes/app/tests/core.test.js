import {test} from "node:test";
import assert from "node:assert/strict";
import * as c from "../src/core.js";

test("kurusa: Türkçe ve sayısal tutarlar", () => {
  assert.equal(c.kurusa("1.250,50"),125050);
  assert.equal(c.kurusa("15.000"),1500000);
  assert.equal(c.kurusa("15000"),1500000);
  assert.equal(c.kurusa("1250.5"),125050);
  assert.equal(c.kurusa(1250.5),125050);
  assert.equal(c.kurusa("1.5"),150);
  assert.equal(c.kurusa(" 640 ₺ "),64000);
  assert.ok(Number.isNaN(c.kurusa("12,345")));
  assert.ok(Number.isNaN(c.kurusa("abc")));
  assert.ok(Number.isNaN(c.kurusa("")));
  assert.ok(Number.isNaN(c.kurusa(null)));
});

test("tl: biçim", () => {
  assert.equal(c.tl(125050),"1.250,50 ₺");
  assert.equal(c.tl(3500000),"35.000 ₺");
  assert.equal(c.tl(-30000),"−300 ₺");
  assert.equal(c.tl(0),"0 ₺");
});

test("tarih yardımcıları", () => {
  assert.equal(c.istanbulGun(new Date("2026-11-30T21:30:00Z")),"2026-12-01");
  assert.equal(c.ayinSonGunu("2026-02"),28);
  assert.equal(c.ayinSonGunu("2028-02"),29);
  assert.equal(c.gunEkle("2026-11-30",1),"2026-12-01");
  assert.equal(c.gecerliGun("2026-02-30"),false);
  assert.equal(c.gecerliGun("2026-02-28"),true);
  assert.equal(c.planGunu("2026-02",31),"2026-02-28");
  assert.equal(c.planGunu("2026-11",7),"2026-11-07");
  assert.equal(c.oncekiAy("2026-01"),"2025-12");
  assert.equal(c.ayAdi("2026-11"),"Kasım 2026");
});

test("tutarDogrula: geçersizler Türkçe hata verir", () => {
  assert.equal(c.tutarDogrula("640"),64000);
  assert.equal(c.tutarDogrula("0",{sifir:true}),0);
  assert.throws(()=>c.tutarDogrula("0"),{name:"Hata",message:"Tutar sıfır olamaz."});
  assert.throws(()=>c.tutarDogrula("-5"),{message:"Tutar negatif olamaz."});
  assert.throws(()=>c.tutarDogrula("abc"),{message:"Tutar okunamadı. Örnek: 1.250,50"});
  assert.throws(()=>c.tutarDogrula("10.000.001"),{message:"Tutar çok büyük (en çok 10.000.000 ₺)."});
});

test("metin, gün ve sayı doğrulama", () => {
  assert.equal(c.metinDogrula("  Market ","Açıklama",80),"Market");
  assert.throws(()=>c.metinDogrula("  ","Açıklama",80),{message:"Açıklama boş olamaz."});
  assert.throws(()=>c.metinDogrula("x".repeat(81),"Açıklama",80),{message:"Açıklama en çok 80 karakter olabilir."});
  assert.equal(c.gunDogrula("","2026-11-27"),"2026-11-27");
  assert.equal(c.gunDogrula("2026-11-20","2026-11-27"),"2026-11-20");
  assert.throws(()=>c.gunDogrula("20.11.2026","2026-11-27"),{message:"Tarih YYYY-AA-GG biçiminde olmalı."});
  assert.equal(c.sayiDogrula("12","Kalan taksit",0,600),12);
  assert.throws(()=>c.sayiDogrula("1,5","Kalan taksit",0,600),{message:"Kalan taksit 0 ile 600 arasında tam sayı olmalı."});
});

const Z=[{id:1,ad:"Kira",aylik_kurus:1000000,sira:1,aktif:1},{id:2,ad:"Yemek",aylik_kurus:600000,sira:2,aktif:1},{id:3,ad:"Eski",aylik_kurus:100000,sira:3,aktif:0}];
const veri=(ek={})=>({zarflar:Z,gelirler:[],dagitimlar:[],harcamalar:[],aktarimlar:[],...ek});

test("ayDurumu: kalan, eksik, kümülatif atanmamış", () => {
  const d=c.ayDurumu("2026-12",veri({
    gelirler:[{tutar_kurus:1500000,tarih:"2026-11-01"},{tutar_kurus:1500000,tarih:"2026-12-01"},{tutar_kurus:999,tarih:"2027-01-01"}],
    dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:1000000},{ay:"2026-12",zarf_id:1,tutar_kurus:1000000},{ay:"2026-12",zarf_id:2,tutar_kurus:400000}],
    harcamalar:[{zarf_id:2,tutar_kurus:450000,tarih:"2026-12-05"},{zarf_id:null,tutar_kurus:10000,tarih:"2026-12-06"},{zarf_id:2,tutar_kurus:1,tarih:"2026-11-30"}],
    aktarimlar:[{ay:"2026-11",zarf_id:null,tutar_kurus:20000}]
  }));
  assert.equal(d.gelir,1500000);
  assert.equal(d.harcanan,460000);
  assert.equal(d.atanmamis,3000000-2400000-10000-20000);
  assert.deepEqual(d.zarflar.map(z=>z.id),[1,2]);
  assert.deepEqual(d.zarflar[1],{id:2,ad:"Yemek",aylik:600000,konan:400000,harcanan:450000,aktarilan:0,kalan:-50000,eksik:200000});
  assert.equal(d.zarflar[0].eksik,0);
});

test("dagitimOner: sırayla eksikleri doldurur, artan atanmamış", () => {
  const d=c.ayDurumu("2026-12",veri());
  assert.deepEqual(c.dagitimOner(1500000,d),{kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}],artan:0});
  assert.deepEqual(c.dagitimOner(2000000,d),{kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:600000}],artan:400000});
});

test("kaydirmaOner: önce atanmamış, sonra en dolu zarf", () => {
  const durum={atanmamis:20000,zarflar:[{id:1,kalan:300000},{id:2,kalan:-50000},{id:4,kalan:400000}]};
  assert.deepEqual(c.kaydirmaOner(durum,2),{zarf_id:2,kaynaklar:[{zarf_id:null,tutar:20000},{zarf_id:4,tutar:30000}],karsilanamayan:0});
  assert.equal(c.kaydirmaOner(durum,1),null);
  const kit={atanmamis:0,zarflar:[{id:2,kalan:-50000},{id:1,kalan:10000}]};
  assert.deepEqual(c.kaydirmaOner(kit,2),{zarf_id:2,kaynaklar:[{zarf_id:1,tutar:10000}],karsilanamayan:40000});
});

const M=[{id:11,sira:1,ad:"Borçsuzluk",kural:"borc",hedef_kurus:null,biriken_kurus:0},{id:12,sira:2,ad:"Acil fon",kural:"acil3",hedef_kurus:null,biriken_kurus:4000000},{id:13,sira:3,ad:"Yatırım",kural:null,hedef_kurus:null,biriken_kurus:0}];
const mctx={aylikToplam:1600000,borcToplam:0};

test("merdiven: borç yoksa ilk basamak tamam, acil fon 3 ay", () => {
  const m=c.merdivenDurumu(M,mctx);
  assert.deepEqual(m.map(b=>[b.id,b.hedef,b.tamam]),[[11,0,true],[12,4800000,false],[13,null,false]]);
  assert.deepEqual(c.merdivenDurumu(M,{...mctx,borcToplam:50000})[0].tamam,false);
});

test("merdivenDagit: önce açık basamak dolar, taşan sonrakine", () => {
  assert.deepEqual(c.merdivenDagit(M,1000000,mctx),[{id:12,tutar:800000},{id:13,tutar:200000}]);
  const hepsiTamam=[{id:1,sira:1,ad:"A",kural:null,hedef_kurus:100,biriken_kurus:100}];
  assert.deepEqual(c.merdivenDagit(hepsiTamam,500,mctx),[{id:1,tutar:500}]);
  assert.deepEqual(c.merdivenDagit([],500,mctx),[]);
  assert.equal(c.VARSAYILAN_MERDIVEN.length,4);
});

test("ayKapanisi: eksiler önce atanmamıştan, sonra en dolu zarftan kapanır", () => {
  const k=c.ayKapanisi({atanmamis:20000,zarflar:[{id:1,kalan:300000},{id:2,kalan:-50000},{id:3,kalan:0}]});
  assert.deepEqual(k,{kapama:[{zarf_id:2,tutar:50000}],dusum:[{zarf_id:1,tutar:30000}],kaynaklar:[{zarf_id:1,tutar:270000}],toplam:270000});
  const bol=c.ayKapanisi({atanmamis:100000,zarflar:[{id:1,kalan:5000}]});
  assert.deepEqual(bol,{kapama:[],dusum:[],kaynaklar:[{zarf_id:null,tutar:100000},{zarf_id:1,tutar:5000}],toplam:105000});
  const acik=c.ayKapanisi({atanmamis:0,zarflar:[{id:2,kalan:-50000}]});
  assert.deepEqual(acik,{kapama:[{zarf_id:2,tutar:50000}],dusum:[],kaynaklar:[],toplam:0});
});

test("ozgurlukSuresi", () => {
  assert.equal(c.ozgurlukSuresi(100,0,0,100),0);
  assert.equal(c.ozgurlukSuresi(0,1000,0,12000),12);
  assert.equal(c.ozgurlukSuresi(0,0,0,1),null);
  assert.ok(c.ozgurlukSuresi(0,1000,20,24000)<24);
});

test("listeDogrula: zarflar sıra alır, TL kuruşa döner", () => {
  assert.deepEqual(c.listeDogrula("zarflar",[{ad:"Kira",aylik:"10.000"},{id:"4",ad:" Yemek ",aylik:"0"}]),
    [{id:null,ad:"Kira",aylik_kurus:1000000,sira:1},{id:4,ad:"Yemek",aylik_kurus:0,sira:2}]);
  assert.deepEqual(c.listeDogrula("gelir_plani",[{ad:"Burs",tutar:"4000",gun:"7"}]),[{id:null,ad:"Burs",tutar_kurus:400000,gun:7}]);
  assert.deepEqual(c.listeDogrula("merdiven",[{ad:"Acil",kural:"acil3",hedef:"",biriken:""}]),[{id:null,ad:"Acil",sira:1,kural:"acil3",hedef_kurus:null,biriken_kurus:0}]);
  assert.deepEqual(c.listeDogrula("borclar",[{ad:"KYK",kalan:"20000",aylik:"500",kalan_taksit:""}]),[{id:null,ad:"KYK",kalan_kurus:2000000,aylik_kurus:50000,kalan_taksit:null}]);
  assert.deepEqual(c.listeDogrula("birikimler",[{tur:"altin",ad:"Gram",tutar:"3000"}]),[{id:null,tur:"altin",ad:"Gram",tutar_kurus:300000}]);
  assert.deepEqual(c.listeDogrula("abonelikler",[{ad:"Spotify",tutar:"60",gun:"12",zarf_id:"2"}]),[{id:null,ad:"Spotify",tutar_kurus:6000,gun:12,zarf_id:2,aktif:1}]);
});

test("listeDogrula: geçersizler", () => {
  assert.throws(()=>c.listeDogrula("yok",[]),{message:"Bilinmeyen liste."});
  assert.throws(()=>c.listeDogrula("zarflar",Array(51).fill({ad:"a",aylik:"1"})),{message:"Liste en çok 50 satır olabilir."});
  assert.throws(()=>c.listeDogrula("gelir_plani",[{ad:"x",tutar:"1",gun:"32"}]),{message:"Gün 1 ile 31 arasında tam sayı olmalı."});
  assert.throws(()=>c.listeDogrula("birikimler",[{tur:"bitcoin",ad:"x",tutar:"1"}]),{message:"Birikim türü geçersiz."});
  assert.throws(()=>c.listeDogrula("zarflar",[{id:"abc",ad:"x",aylik:"1"}]),{message:"Geçersiz kimlik."});
});

test("harcamaDogrula ve gelirDogrula", () => {
  assert.deepEqual(c.harcamaDogrula({istek_id:"a1",tutar:"640",aciklama:"Market",zarf_id:"2"},"2026-11-27"),
    {istek_id:"a1",tutar_kurus:64000,aciklama:"Market",zarf_id:2,tarih:"2026-11-27",etiket:""});
  assert.equal(c.harcamaDogrula({tutar:"1",aciklama:"x",zarf_id:""},"2026-11-27").zarf_id,null);
  assert.throws(()=>c.harcamaDogrula({tutar:"0",aciklama:"x"},"2026-11-27"),{message:"Tutar sıfır olamaz."});
  assert.deepEqual(c.gelirDogrula({tutar:"15.000",aciklama:"Burs",tarih:"2026-11-01"},"2026-11-27"),{tutar_kurus:1500000,aciklama:"Burs",tarih:"2026-11-01"});
});

const plan=[{id:1,ad:"Aile",tutar_kurus:1500000,gun:1},{id:3,ad:"Destek",tutar_kurus:1600000,gun:16},{id:2,ad:"Burs",tutar_kurus:400000,gun:7}];
const durumFn=ek=>ay=>c.ayDurumu(ay,veri(ek));

test("gunlukOneriler: geçmiş plan günleri, eksikler ardışık düşülür", () => {
  const o=c.gunlukOneriler("2026-12-08",{gelirPlani:plan,gelirler:[],abonelikler:[],mevcut:new Set(),aksam:false,baslangic:"2026-12-01",durum:durumFn()});
  const dag=o.filter(x=>x.tur==="dagitim");
  assert.deepEqual(dag.map(x=>x.anahtar),["dagitim:plan:2026-12:1","dagitim:plan:2026-12:2"]);
  assert.deepEqual(dag[0].detay,{ay:"2026-12",tutar:1500000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}]});
  assert.deepEqual(dag[1].detay.kalemler,[{zarf_id:2,tutar:100000}]);
  assert.ok(!o.some(x=>x.tur==="aktarim"),"başlangıçtan önceki ay kapanmaz");
});

test("gunlukOneriler: gelmiş gelir, mevcut anahtar, başlangıç öncesi atlanır; abonelik ve kapanış", () => {
  const ab=[{id:5,ad:"Spotify",tutar_kurus:6000,gun:3,zarf_id:2,aktif:1},{id:6,ad:"Pasif",tutar_kurus:1,gun:1,zarf_id:2,aktif:0}];
  const o=c.gunlukOneriler("2026-12-08",{gelirPlani:plan,gelirler:[{plan_id:1,tarih:"2026-12-01",tutar_kurus:1500000}],abonelikler:ab,mevcut:new Set(["dagitim:plan:2026-12:2"]),aksam:false,baslangic:"2026-11-10",durum:durumFn({dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:5000}]})});
  assert.deepEqual(o.map(x=>x.anahtar),["abonelik:5:2026-12","aktarim:2026-11"]);
  assert.deepEqual(o[0].detay,{abonelik_id:5,ad:"Spotify",tutar:6000,zarf_id:2,tarih:"2026-12-03"});
  const gec=c.gunlukOneriler("2026-12-02",{gelirPlani:plan,gelirler:[],abonelikler:[],mevcut:new Set(),aksam:false,baslangic:"2026-12-02",durum:durumFn()});
  assert.deepEqual(gec,[],"başlangıç gününden önceki plan günü önerilmez");
  const aksam=c.gunlukOneriler("2026-12-31",{gelirPlani:[],gelirler:[],abonelikler:[],mevcut:new Set(),aksam:true,baslangic:"2026-12-01",durum:durumFn({gelirler:[{tutar_kurus:100,tarih:"2026-12-01"}]})});
  assert.deepEqual(aksam.map(x=>x.anahtar),["aktarim:2026-12"]);
  const bosAy=c.gunlukOneriler("2026-12-31",{gelirPlani:[],gelirler:[],abonelikler:[],mevcut:new Set(),aksam:true,baslangic:"2026-12-01",durum:durumFn()});
  assert.deepEqual(bosAy,[],"aktarılacak bir şey yoksa kapanış önerilmez");
});

const ctx=(ek={})=>({durum:durumFn(ek.veri||{}),merdiven:ek.merdiven||M,mctx,aktifZarf:new Set([1,2]),simdi:"2026-12-08T10:00:00Z",bugun:"2026-12-08"});
const sqller=r=>r.ifadeler.map(x=>x[0].split(" ").slice(0,3).join(" "));

test("uygulaSql dagitim: planlı gelir eklenir, dağıtılır, düzenleme uygulanır", () => {
  const o={id:9,tur:"dagitim",detay:{ay:"2026-12",tutar:1500000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}]}};
  const r=c.uygulaSql(o,"onayla",null,ctx());
  assert.deepEqual(r.ifadeler[0],["INSERT INTO gelirler(plan_id,tutar_kurus,aciklama,tarih,oneri_id) VALUES(?,?,?,?,?)",1,1500000,"Aile","2026-12-01",9]);
  assert.deepEqual(r.ifadeler[1],["INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?)","2026-12",1,1000000,9,"2026-12-08"]);
  assert.deepEqual(r.ifadeler.at(-1),["UPDATE oneriler SET durum=?,karar=? WHERE id=?","onaylandi","2026-12-08T10:00:00Z",9]);
  const d=c.uygulaSql(o,"onayla",{tutar:"14.000",kalemler:[{zarf_id:1,tutar:"10000"},{zarf_id:2,tutar:"0"}]},ctx());
  assert.equal(d.ifadeler[0][2],1400000);
  assert.equal(d.ifadeler.length,3);
  assert.throws(()=>c.uygulaSql(o,"onayla",{tutar:"100",kalemler:[{zarf_id:1,tutar:"200"}]},ctx()),{message:"Dağıtılan, gelen paradan fazla olamaz."});
  assert.deepEqual(c.uygulaSql({...o,detay:{...o.detay,kalemler:[{zarf_id:3,tutar:5}]}},"onayla",null,ctx()),{eskidi:"Önerideki bir zarf artık yok."});
  assert.deepEqual(sqller(c.uygulaSql(o,"reddet",null,ctx())),["UPDATE oneriler SET"]);
  assert.throws(()=>c.uygulaSql(o,"belki",null,ctx()),{message:"Karar onayla ya da reddet olmalı."});
});

test("uygulaSql abonelik ve kaydırma", () => {
  const ab=c.uygulaSql({id:4,tur:"abonelik",detay:{abonelik_id:5,ad:"Spotify",tutar:6000,zarf_id:2,tarih:"2026-12-03"}},"onayla",null,ctx());
  assert.deepEqual(ab.ifadeler[0].slice(1),["abonelik:5:2026-12",6000,"Spotify",2,"2026-12-03"]);
  const veriK={dagitimlar:[{ay:"2026-12",zarf_id:1,tutar_kurus:300000},{ay:"2026-12",zarf_id:2,tutar_kurus:100000}],harcamalar:[{zarf_id:2,tutar_kurus:150000,tarih:"2026-12-05"}]};
  const k=c.uygulaSql({id:5,tur:"kaydirma",detay:{ay:"2026-12",zarf_id:2}},"onayla",null,ctx({veri:veriK}));
  assert.deepEqual(k.ifadeler.slice(0,2).map(x=>[x[2],x[3]]),[[2,50000],[1,-50000]]);
  assert.deepEqual(c.uygulaSql({id:5,tur:"kaydirma",detay:{ay:"2026-12",zarf_id:1}},"onayla",null,ctx({veri:veriK})),{eskidi:"Zarf artık eksi değil ya da kaydırılacak para yok."});
});

test("uygulaSql aktarım: onayla merdivene, reddet atanmamışa; merdiven yoksa hata", () => {
  const veriA={gelirler:[{tutar_kurus:420000,tarih:"2026-11-01"}],dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:300000},{ay:"2026-11",zarf_id:2,tutar_kurus:100000}],harcamalar:[{zarf_id:2,tutar_kurus:150000,tarih:"2026-11-05"}]};
  const o={id:7,tur:"aktarim",detay:{ay:"2026-11"}};
  const on=c.uygulaSql(o,"onayla",null,ctx({veri:veriA}));
  const ilk=x=>x[0].split("(")[0];
  assert.deepEqual(on.ifadeler.map(ilk),["INSERT INTO dagitimlar","INSERT INTO dagitimlar","INSERT INTO aktarimlar","UPDATE merdiven SET biriken_kurus=biriken_kurus+? WHERE id=?","UPDATE oneriler SET durum=?,karar=? WHERE id=?"]);
  assert.deepEqual(on.ifadeler[2].slice(1),["2026-11",1,12,270000,7,"2026-12-08"]);
  assert.deepEqual(on.ifadeler[3].slice(1),[270000,12]);
  const red=c.uygulaSql(o,"reddet",null,ctx({veri:veriA}));
  assert.deepEqual(red.ifadeler.slice(0,3).map(x=>[x[2],x[3]]),[[2,50000],[1,-30000],[1,-270000]]);
  assert.throws(()=>c.uygulaSql(o,"onayla",null,ctx({veri:veriA,merdiven:[]})),{message:"Önce hedef merdivenini kur."});
});

test("oneriGorunum", () => {
  const zarfAd=new Map([[1,"Kira"],[2,"Yemek"]]);
  const g=c.oneriGorunum({id:9,tur:"dagitim",detay:{ay:"2026-12",tutar:1600000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000}]}},{durum:durumFn(),zarfAd,merdiven:M,mctx});
  assert.equal(g.baslik,"Aile: 16.000 ₺ geldi mi?");
  assert.deepEqual(g.satirlar,[{zarf_id:1,ad:"Kira",tutar:1000000},{zarf_id:null,ad:"Atanmamış",tutar:600000}]);
  assert.equal(g.duzenlenebilir,true);
  const a=c.oneriGorunum({id:7,tur:"aktarim",detay:{ay:"2026-11"}},{durum:durumFn({gelirler:[{tutar_kurus:5000,tarih:"2026-11-01"}]}),zarfAd,merdiven:M,mctx});
  assert.equal(a.baslik,"Kasım 2026 kapanışı: 50 ₺ hedefe aktarılsın mı?");
  assert.match(a.aciklama,/Hedef: Acil fon\./);
});

test("K1: pasif zarfın kalanı atanmamışa katılır (para kaybolmaz)", () => {
  // Eski (id 3) pasif: 5.000 konmuş, silindikten sonra 500'lük harcama silinmiş → kalan +500 atanmamışa döner.
  const d=c.ayDurumu("2026-12",veri({
    gelirler:[{tutar_kurus:1000000,tarih:"2026-12-01"}],
    dagitimlar:[{ay:"2026-12",zarf_id:3,tutar_kurus:500000}],
    harcamalar:[{zarf_id:3,tutar_kurus:450000,tarih:"2026-12-03"}],
  }));
  assert.equal(d.atanmamis,1000000-500000+50000);
  assert.ok(!d.zarflar.some(z=>z.id===3));
  // Kapanmamış önceki ayda pasif zarfta kalan para, o ayın atanmamışına girer ve kapanışa dahil olur.
  const k=c.ayKapanisi(c.ayDurumu("2026-11",veri({gelirler:[{tutar_kurus:600000,tarih:"2026-11-01"}],dagitimlar:[{ay:"2026-11",zarf_id:3,tutar_kurus:600000}],harcamalar:[{zarf_id:3,tutar_kurus:400000,tarih:"2026-11-04"}]})));
  assert.equal(k.toplam,200000);
});

test("Ö3: durumOlusturucu sonraki aylarda harcanan atanmamışı önceki aya vermez", () => {
  const v=veri({gelirler:[{tutar_kurus:500000,tarih:"2026-11-01"}],
    dagitimlar:[{ay:"2026-12",zarf_id:2,tutar_kurus:500000}],harcamalar:[{zarf_id:2,tutar_kurus:500000,tarih:"2026-12-02"}]});
  const durum=c.durumOlusturucu(v,"2026-12");
  assert.equal(c.ayDurumu("2026-11",v).atanmamis,500000);
  assert.equal(durum("2026-11").atanmamis,0);
  assert.equal(c.ayKapanisi(durum("2026-11")).toplam,0);
  assert.equal(durum("2026-12").atanmamis,0);
  assert.equal(durum("2027-01").atanmamis,0,"gelecek ay olduğu gibi");
});

test("Ö2: bekleyen dağıtım önerileri sonraki önerilerin eksiğinden düşülür", () => {
  const bekleyen=[{ay:"2026-12",tutar:1500000,kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}]},{ay:"2026-11",tutar:1,kalemler:[{zarf_id:2,tutar:1}]}];
  const o=c.gunlukOneriler("2026-12-08",{gelirPlani:plan,gelirler:[],abonelikler:[],mevcut:new Set(["dagitim:plan:2026-12:1"]),bekleyen,aksam:false,baslangic:"2026-12-01",durum:durumFn()});
  assert.deepEqual(o.find(x=>x.anahtar==="dagitim:plan:2026-12:2").detay.kalemler,[{zarf_id:2,tutar:100000}]);
  const d=c.bekleyenDus(c.ayDurumu("2026-12",veri()),bekleyen);
  assert.deepEqual(d.zarflar.map(z=>z.eksik),[0,100000]);
});
