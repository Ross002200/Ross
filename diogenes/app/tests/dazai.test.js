import {test} from "node:test";
import assert from "node:assert/strict";
import * as d from "../src/dazai.js";

const Z=[{id:1,ad:"Kira"},{id:2,ad:"Yemek"},{id:3,ad:"Ulaşım"}];

test("katla: Türkçe harfler ve boşluk", () => {
  assert.equal(d.katla("  İçecek  ŞEKER  "),"icecek seker");
  assert.equal(d.katla(null),"");
});

test("zarfAdiCoz: büyük/küçük harf ve aksan fark etmez, baş harfler yeter", () => {
  assert.equal(d.zarfAdiCoz("kira",Z).id,1);
  assert.equal(d.zarfAdiCoz("ulasim",Z).id,3);
  assert.equal(d.zarfAdiCoz("Yem",Z).id,2);
  assert.equal(d.zarfAdiCoz("Tatil",Z),null);
  assert.equal(d.zarfAdiCoz("",Z),null);
});

test("zarfBul: önce öğrenilmiş etiket, sonra açıklama, sonra zarf adı; pasif zarfa eşleme yok sayılır", () => {
  const es=[{kelime:"market",zarf_id:2},{kelime:"benzin",zarf_id:3},{kelime:"eski",zarf_id:9}];
  assert.equal(d.zarfBul({aciklama:"A101",etiket:"market"},Z,es).id,2);
  assert.equal(d.zarfBul({aciklama:"Benzin",etiket:""},Z,es).id,3);
  assert.equal(d.zarfBul({aciklama:"Yemek siparişi",etiket:""},Z,es).id,2);
  assert.equal(d.zarfBul({aciklama:"eski",etiket:""},Z,es),null,"zarf 9 aktif değil");
  assert.equal(d.zarfBul({aciklama:"Kiralık bisiklet",etiket:""},Z,[]),null,"kelime içinde geçmek yetmez");
  assert.equal(d.zarfBul({aciklama:"Sinema",etiket:"eglence"},Z,es),null);
});

test("esleKelimeleri: etiket ve açıklama, boş ve uzunlar atlanır", () => {
  assert.deepEqual(d.esleKelimeleri({aciklama:"Market",etiket:"market"}),["market"]);
  assert.deepEqual(d.esleKelimeleri({aciklama:"A101 Market",etiket:"market"}),["market","a101 market"]);
  assert.deepEqual(d.esleKelimeleri({aciklama:"x".repeat(41),etiket:""}),[]);
});

test("planBul: kelime başı eşleşmesi (çekim ekleri), kısa adlar sayılmaz", () => {
  const plan=[{id:1,ad:"Aile"},{id:2,ad:"Burs"},{id:3,ad:"Maaş"}];
  assert.equal(d.planBul("Bursum geldi",plan).id,2);
  assert.equal(d.planBul("KYK bursu",plan).id,2);
  assert.equal(d.planBul("maaşım yattı",plan).id,3);
  assert.equal(d.planBul("Ailemden harçlık",plan).id,1);
  assert.equal(d.planBul("Ek iş",plan),null);
  assert.equal(d.planBul("",plan),null);
  assert.equal(d.planBul("ai geldi",[{id:9,ad:"Ai"}]),null,"3 harften kısa plan adı eşleşmez");
});

test("bugunCevabi: maddeler yalnız yapılacak işler, zarflar satırlarda, yarınki abonelik özette", () => {
  const durum={ay:"2026-12",atanmamis:120000,zarflar:[
    {id:1,ad:"Kira",aylik:1000000,kalan:900000},{id:2,ad:"Yemek",aylik:600000,kalan:-30000},{id:3,ad:"Ulaşım",aylik:100000,kalan:-5000}]};
  const oneriler=[{id:5,tur:"kaydirma",baslik:"Ulaşım zarfı 50 ₺ eksi",satirlar:[{zarf_id:null,ad:"Atanmamış",tutar:5000}]},
    {id:6,tur:"dagitim",baslik:"Burs: 4.000 ₺ geldi mi?",satirlar:[{zarf_id:1,ad:"Kira",tutar:100000},{zarf_id:2,ad:"Yemek",tutar:300000}]}];
  const ab=[{id:1,ad:"Spotify",tutar_kurus:6000,gun:9,zarf_id:2,aktif:1},{id:2,ad:"Pasif",tutar_kurus:1,gun:9,zarf_id:null,aktif:0},{id:3,ad:"Bulut",tutar_kurus:3000,gun:20,zarf_id:null,aktif:1}];
  const c=d.bugunCevabi({day:"2026-12-08",durum,oneriler,kaydirmaZarflari:new Set([3]),abonelikler:ab,zarfAd:new Map([[1,"Kira"],[2,"Yemek"]])});
  assert.equal(c.app,"diogenes");assert.equal(c.day,"2026-12-08");
  assert.deepEqual(c.maddeler.map(m=>m.id),["zarf:2","oneri:5","oneri:6"],"kaydırması olan eksi zarf (3) madde olmaz");
  assert.ok(c.maddeler.every(m=>m.tur==="onay"&&m.durum==="bekliyor"));
  assert.equal(c.maddeler[0].baslik,"Yemek zarfı eksi");
  assert.equal(c.maddeler[2].ayrinti,"Kira 1.000 ₺, Yemek 3.000 ₺");
  assert.equal(c.ozet,"Atanmamış 1.200 ₺ · yarın Spotify 60 ₺");
  assert.deepEqual(c.satirlar,["Kira: 9.000 ₺ kaldı (aylık 10.000 ₺)","Yemek: −300 ₺ kaldı (aylık 6.000 ₺)","Ulaşım: −50 ₺ kaldı (aylık 1.000 ₺)","Yarın çekilecek: Spotify 60 ₺ (Yemek)"]);
  // ayın son günü: yarın bir sonraki ayın 1'i; planGunu kısa ayda son güne kayar
  const s=d.bugunCevabi({day:"2027-02-27",durum:{ay:"2027-02",atanmamis:0,zarflar:[]},abonelikler:[{id:4,ad:"Kira oto",tutar_kurus:100,gun:31,zarf_id:null,aktif:1}]});
  assert.equal(s.ozet,"Atanmamış 0 ₺ · yarın Kira oto 1 ₺");
});
