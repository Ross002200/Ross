(() => {
const $ = s => document.querySelector(s);
const store = {
  get(k){try{return JSON.parse(localStorage.getItem("zenon7:"+k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem("zenon7:"+k,JSON.stringify(v))}catch(e){}}
};

/* ================= colors ================= */
const COL = {
  black:["Siyah","#1C1C21"], wblack:["Yıkanmış siyah","#34343A"], charcoal:["Antrasit","#3B4046"], heather:["Gri melanj","#9C9D9E"],
  navy:["Lacivert","#1F2739"], bone:["Kırık beyaz","#E9E3D6"], cream:["Krem","#D8CCB5"], stone:["Taş","#BDB29C"],
  camel:["Deve tüyü","#A8845A"], brown:["Kahve","#5E4130"], duck:["Kanvas kahve","#8C6641"], olive:["Zeytin","#5A5A3B"],
  indigo:["Koyu indigo","#23314B"], wgrey:["Gri-mavi yıkama","#46505F"], white:["Beyaz","#F1EEE8"], gold:["Altın","#C9A24A"], storm:["Yıkanmış gri","#A9ADAC"], sky:["Açık mavi","#A3B5CA"], burgundy:["Bordo","#5A2A2E"], silver:["Gümüş","#C9CDD2"]
};
const hx = k => (COL[k]||COL.black)[1];
const rgb = h => {const n=parseInt(h.slice(1),16);return[n>>16,n>>8&255,n&255];};
const hex = a => "#"+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const mix = (h,t,f) => {const a=rgb(h),b=rgb(t);return hex(a.map((v,i)=>v+(b[i]-v)*f));};
const lum = h => {const[r,g,b]=rgb(h);return(r*.299+g*.587+b*.114)/255;};
const SHADE = h => mix(h,"#000000",.24);
const DET = h => lum(h)<.33?mix(h,"#FFFFFF",.34):mix(h,"#000000",.4);   // seam/detail colour readable on the fabric
const HI = h => mix(h,"#FFFFFF",.18);
const OL = "#141319";

/* ================= drawing kit ================= */
// Figure space: 240 wide, front view, centre x=120. mx() mirrors to the other side.
let UID = 0;
const mx = x => 240-x;
let NOMX = false;   // inside both(): the mirror is done by a transform, so paths (incl. relative commands) stay unmirrored
const X = (x,m) => m&&!NOMX?mx(x):x;
const MP = (pts,m) => pts.map(([x,y])=>[X(x,m),y]);
const P = pts => "M"+pts.map(p=>(+p[0]).toFixed(1)+" "+(+p[1]).toFixed(1)).join("L")+"Z";
const poly = (pts,fill,sw=2) => `<path d="${P(pts)}" fill="${fill}" stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const flat = (pts,fill,op=1) => `<path d="${P(pts)}" fill="${fill}" opacity="${op}"/>`;
const ln = (d,c,w=1.3,extra="") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const dash = (d,c,w=1) => ln(d,c,w,'stroke-dasharray="2.4 2"');
const dot = (x,y,r,c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${OL}" stroke-width=".8"/>`;
const both = f => { const a=f(false); NOMX=true; const b=f(true); NOMX=false; return a+`<g transform="matrix(-1 0 0 1 240 0)">${b}</g>`; };
const FIT = {slim:[0,0],regular:[2,2],relaxed:[5,5],boxy:[7,8],over:[13,15]};

/* ---------- body ---------- */
function body(){
  const skin="#CF9C74", skd="#AE7B55", hair="#17130F";
  let s="";
  s+=both(m=>poly(MP([[70,106],[54,152],[46,204],[44,268],[58,270],[62,206],[70,160],[76,130]],m),skin));
  s+=both(m=>`<ellipse cx="${X(51,m)}" cy="282" rx="8" ry="14" fill="${skin}" stroke="${OL}" stroke-width="2"/>`);
  s+=poly([[111,76],[129,76],[131,100],[109,100]],skin)+flat([[120,82],[129,76],[131,100],[120,100]],skd,.7);
  s+=`<path d="M101 50Q101 82 120 85Q139 82 139 50Q139 30 120 30Q101 30 101 50Z" fill="${skin}" stroke="${OL}" stroke-width="2"/>`;
  s+=`<path d="M128 80Q139 72 139 50L134 50Q134 70 128 80Z" fill="${skd}"/>`;
  s+=`<ellipse cx="100" cy="57" rx="3.5" ry="6" fill="${skin}" stroke="${OL}" stroke-width="1.6"/><ellipse cx="140" cy="57" rx="3.5" ry="6" fill="${skd}" stroke="${OL}" stroke-width="1.6"/>`;
  s+=ln("M109 55h8M123 55h8",OL,2.4)+ln("M108 49l9-1M123 48l9 1",OL,1.6)+ln("M120 58l-2 8h3",OL,1.1)+ln("M115 73q5 2 10 0",OL,1.4);
  s+=`<path d="M99 54Q96 24 121 22Q146 23 142 54L139 42Q136 36 131 38L128 30L124 38L119 31L115 39L110 33L106 41L102 40Z" fill="${hair}" stroke="${OL}" stroke-width="2"/>`;
  s+=ln("M112 27q6-3 14 0",mix(hair,"#FFFFFF",.25),1.2);
  s+=`<circle cx="112.5" cy="55.5" r="6.2" fill="#FFFFFF" fill-opacity=".12" stroke="#B89A62" stroke-width="1.3"/><circle cx="127.5" cy="55.5" r="6.2" fill="#FFFFFF" fill-opacity=".12" stroke="#B89A62" stroke-width="1.3"/>`+ln("M118.7 55h2.6M106.3 54l-5 1M133.7 54l5 1",'#B89A62',1.1);
  return s;
}

/* ---------- tops ---------- */
const torso = (d,w,hem) => [[106,93],[66-d,105],[63-d,160],[66-w,hem],[174+w,hem],[177+d,160],[174+d,105],[134,93],[120,101]];
function sleeve(d,long,m,bulk=0){
  const pts = long
    ? [[66-d,105],[52-d/2-bulk,152],[44-bulk,206],[42-bulk,264],[61+bulk*.3,268],[64,210],[70,162],[74,132]]
    : [[66-d,105],[50-d,152],[64-d/2,163],[74,138]];
  return MP(pts,m);
}
const HEM = {tee:250,hoodie:252,crew:246,polo:240,camp:246,shirt:250,turtle:238,knit:246,cardigan:250};
function drawTop(it,opt={}){
  const c=hx(it.c), sd=SHADE(c), dt=DET(c), [d,w]=FIT[it.fit||"regular"], t=it.type;
  const long = !["tee","polo","camp"].includes(t) || opt.forceLong || it.long;
  const hem = (HEM[t]||248)+(it.fit==="over"?18:0);
  const id = "k"+(++UID);
  let s="";
  s+=poly(sleeve(d,long,false),c)+poly(sleeve(d,long,true),sd);
  s+=poly(torso(d,w,hem),c);
  s+=flat([[140,97],[174+d,105],[177+d,160],[174+w,hem],[146,hem],[144,140]],sd,.9);
  s+=ln(`M${86-w/2} ${hem-3}q4-18 2-40`,dt,1,'opacity=".55"')+ln(`M${152+w/2} ${hem-3}q-3-16 0-34`,dt,1,'opacity=".55"');
  s+=both(m=>ln(`M${X(76,m)} 132q6 4 8 12`,dt,1,'opacity=".5"'));               // armpit folds
  if(["knit","polo","turtle","cardigan"].includes(t)){
    s+=`<defs><pattern id="${id}" width="5" height="7" patternUnits="userSpaceOnUse"><path d="M0 0l2.5 3.5L5 0M0 3.5l2.5 3.5L5 3.5" fill="none" stroke="${dt}" stroke-width=".7" opacity=".45"/></pattern></defs>`;
    s+=`<path d="${P(torso(d,w,hem))}" fill="url(#${id})"/>`+both(m=>`<path d="${P(sleeve(d,long,m))}" fill="url(#${id})"/>`);
  }
  if(it.rib){
    s+=`<defs><pattern id="${id}r" width="3" height="10" patternUnits="userSpaceOnUse"><rect width="1" height="10" fill="${dt}" opacity=".5"/></pattern></defs>`;
    s+=`<path d="${P(torso(d,w,hem))}" fill="url(#${id}r)"/>`+both(m=>`<path d="${P(sleeve(d,long,m))}" fill="url(#${id}r)"/>`);
  }
  if(it.stripe&&(t==="camp"||t==="shirt")){
    s+=`<defs><pattern id="${id}s" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="3" height="10" fill="${hx(it.stripe)}" opacity=".75"/><rect x="5" width="1" height="10" fill="${hx(it.stripe)}" opacity=".5"/></pattern></defs>`;
    s+=`<path d="${P(torso(d,w,hem))}" fill="url(#${id}s)"/>`+both(m=>`<path d="${P(sleeve(d,long,m))}" fill="url(#${id}s)"/>`);
  }
  if(long){
    s+=both(m=>poly(MP([[42,252],[62,256],[61,268],[42,264]],m),m?sd:c,1.6));
    if(["hoodie","crew","knit","turtle","cardigan"].includes(t)) s+=both(m=>ln(`M${X(46,m)} 256v8M${X(50,m)} 257v8M${X(54,m)} 257v8M${X(58,m)} 258v8`,dt,.8));
    else s+=both(m=>dot(X(58,m),262,1.4,dt));                                   // shirt cuff button
  } else s+=both(m=>dash(`M${X(52-d,m)} 151L${X(64-d/2,m)} 159`,dt));
  if(["hoodie","crew","knit","turtle","cardigan"].includes(t)){
    s+=poly([[66-w,hem-12],[174+w,hem-12],[174+w,hem],[66-w,hem]],c,1.6)+flat([[146,hem-12],[174+w,hem-12],[174+w,hem],[146,hem]],sd,.9);
    for(let x=70-w;x<173+w;x+=4.5) s+=ln(`M${x} ${hem-11}v10`,dt,.7,'opacity=".65"');
  } else s+=dash(`M${68-w} ${hem-5}H${172+w}`,dt);
  if(t==="tee"||t==="crew"){
    s+=`<path d="M106 93Q120 104 134 93Q120 111 106 93Z" fill="${c}" stroke="${OL}" stroke-width="1.6"/>`+ln("M108 95q12 11 24 0",dt,.9);
    if(it.roll&&!long) s+=both(m=>poly(MP([[49-d,149],[64-d/2,160],[66-d/2,153],[52-d,142]],m),m?sd:c,1.4));
    if(it.embroid) s+=`<path d="M136 118l3 3 3-3M139 121v5" fill="none" stroke="${dt}" stroke-width="1.2"/>`;
    if(t==="crew") s+=ln("M113 105l7 7 7-7",dt,1.1)+both(m=>dash(`M${X(104,m)} 97L${X(82,m)} 150`,dt,.8));
    if(it.graphic) s+=`<rect x="130" y="118" width="18" height="12" fill="${hx(it.graphic)}" stroke="${OL}" stroke-width="1"/>`+ln("M133 122h12M133 126h8",c,1.1);
    s+=both(m=>dash(`M${X(68-d,m)} 108L${X(66-d,m)} 116`,dt,.8));
  }
  if(t==="hoodie"){
    s+=`<path d="M98 101Q95 80 120 80Q145 80 142 101Q138 119 120 121Q102 119 98 101Z" fill="${c}" stroke="${OL}" stroke-width="2"/>`;
    s+=`<path d="M106 99Q120 92 134 99Q128 111 120 112Q112 111 106 99Z" fill="${sd}" stroke="${OL}" stroke-width="1.4"/>`;
    const cd=hx(it.cord||"bone");
    s+=ln("M114 113q-2 18 -3 30M126 113q2 18 3 30",cd,1.8)+`<rect x="109" y="141" width="4" height="7" fill="${cd}" stroke="${OL}" stroke-width=".6"/><rect x="127" y="141" width="4" height="7" fill="${cd}" stroke="${OL}" stroke-width=".6"/>`;
    if(it.dsleeve) s+=both(m=>ln(`M${X(52-d,m)} 150Q${X(60,m)} 158 ${X(68,m)} 150`,OL,1.4)+ln(`M${X(50-d,m)} 146L${X(66,m)} 146`,dt,.8,'opacity=".6"'));
    if(it.print) s+=`<rect x="100" y="150" width="40" height="7" fill="${it.print}"/><rect x="104" y="160" width="32" height="3" fill="${it.print}" opacity=".7"/>`;
    s+=poly([[92,194],[148,194],[156,hem-14],[84,hem-14]],c,1.8)+flat([[130,194],[148,194],[156,hem-14],[134,hem-14]],sd,.8)+ln(`M92 194q-5 20-8 ${hem-208}M148 194q5 20 8 ${hem-208}`,dt,1.2)+dash("M94 199H146",dt,.8);
  }
  if(t==="turtle"){
    s+=poly([[108,70],[132,70],[134,100],[106,100]],c)+flat([[122,70],[132,70],[134,100],[122,100]],sd,.9);
    for(let y=74;y<98;y+=4) s+=ln(`M109 ${y}H131`,dt,.7,'opacity=".6"');
  }
  if(t==="knit"){
    s+=`<path d="M104 93Q120 110 136 93" fill="none" stroke="${dt}" stroke-width="4"/>`+ln("M104 93Q120 110 136 93",OL,1.4);
    if(it.cable) s+=[96,120,144].map(x=>ln(`M${x} 112q-5 10 0 20q5 10 0 20q-5 10 0 20q5 10 0 20q-5 10 0 20q5 10 0 18`,dt,2.4,'opacity=".75"')).join("");
  }
  if(t==="cardigan"){
    s+=flat([[108,96],[120,176],[132,96]],hx(opt.under||"bone"))+ln("M108 96L120 176L132 96",OL,1.6);
    for(const y of [184,204,224]) s+=dot(117,y,2.3,DET(c));
    s+=ln(`M120 176V${hem}`,OL,1.4)+both(m=>poly(MP([[82,196],[102,196],[102,216],[82,216]],m),m?sd:c,1.3));
  }
  if(t==="polo"){
    s+=both(m=>poly(MP([[106,92],[121,110],[114,119],[98,100]],m),c,1.6));
    s+=poly([[116,106],[124,106],[124,138],[116,138]],c,1.4)+dot(120,116,1.8,dt)+dot(120,127,1.8,dt);
    if(it.pointed) s+=both(m=>poly(MP([[106,92],[124,114],[114,124],[94,102]],m),c,1.6));
    if(it.script) s+=ln("M130 132q3-7 6-2t5-1q2 3 5 0t5 0q2-2 4 1",hx("white"),1.4);
  }
  if(t==="shirt"){
    s+=both(m=>poly(MP([[106,92],[120,112],[112,120],[100,100]],m),c,1.6)+dot(X(111,m),116,1.2,dt));
    s+=ln(`M120 112V${hem}`,OL,1.3)+ln(`M124 114V${hem}`,dt,.8);
    for(let y=128;y<hem-6;y+=24) s+=dot(122,y,1.7,mix(c,"#FFFFFF",.55));
    s+=poly([[132,126],[150,126],[150,144],[141,148],[132,144]],c,1.4)+dash("M133 131H149",dt,.8);
    s+=`<path d="M66 ${hem}Q120 ${hem+10} 174 ${hem}" fill="none" stroke="${OL}" stroke-width="0"/>`;
  }
  if(t==="camp"){
    s+=flat([[108,95],[120,128],[132,95]],hx(opt.under||"black"));
    s+=both(m=>poly(MP([[106,92],[122,130],[108,137],[93,104]],m),c,1.6));
    s+=ln(`M120 130V${hem}`,OL,1.3);
    for(let y=146;y<hem-6;y+=24) s+=dot(122,y,1.8,mix(c,"#FFFFFF",.55));
    s+=poly([[132,142],[150,142],[150,160],[132,160]],c,1.4);
  }
  return s;
}

/* ---------- outerwear ---------- */
function drawOuter(it){
  const c=hx(it.c), sd=SHADE(c), dt=DET(c), hi=HI(c), t=it.type;
  const [d0,w0]=FIT[it.fit||"regular"], d=d0+3, w=w0+3;
  const hem={leather:228,bomber:232,work:238,puffer:238,track:236,coat:350,blazer:268,ziphoodie:250}[t]||236;
  const bulk = t==="puffer"?5:t==="coat"?2:1;
  const ox = ["puffer","track"].includes(t) ? 120 : ({coat:112,blazer:114}[t]||113);
  let s="";
  s+=poly(sleeve(d,true,false,bulk+2),c)+poly(sleeve(d,true,true,bulk+2),sd);
  s+=both(m=>ln(`M${X(62-bulk,m)} 190q-4 6 -10 8M${X(58-bulk,m)} 226q-5 4 -12 5`,dt,1,'opacity=".6"'));      // sleeve creases
  const panel = m => MP([[104,90],[66-d,103],[62-d,160],[64-w,hem],[ox,hem],[ox-2,160],[110,104]],m);
  s+=poly(panel(false),c)+poly(panel(true),c);
  s+=flat([[142,98],[174+d,103],[178+d,160],[176+w,hem],[152,hem]],sd,.9);
  if(["bomber","track"].includes(t)) s+=both(m=>{let r=poly(MP([[40-bulk,250],[62,254],[61,268],[40-bulk,264]],m),m?sd:c,1.6);for(let x=44;x<60;x+=4)r+=ln(`M${X(x,m)} 253v12`,dt,.7);return r;});
  else s+=both(m=>ln(`M${X(40-bulk,m)} 254L${X(61,m)} 258`,dt,1.1));
  if(t==="leather"){
    s+=both(m=>poly(MP([[104,90],[86,108],[99,148],[110,110]],m),m?sd:c,1.8));
    s+=both(m=>dot(X(95,m),114,1.6,"#9A9AA2"));
    s+=both(m=>ln(`M${X(ox-1,m)} 110V${hem-2}`,"#9A9AA2",1.6,'stroke-dasharray="1.6 1.4"'));
    s+=both(m=>ln(`M${X(76,m)} 190l18-12`,"#9A9AA2",1.8)+ln(`M${X(46,m)} 216l14 2`,"#9A9AA2",1.4));
    s+=ln("M80 130q6 30 2 70",hi,2.4,'opacity=".6"')+ln("M58 140q-6 40-10 90",hi,1.8,'opacity=".5"')+ln("M150 120q4 20 2 40",hi,1.6,'opacity=".35"');
    s+=poly([[64-w,hem-10],[ox,hem-10],[ox,hem],[64-w,hem]],c,1.6)+poly([[mx(ox),hem-10],[176+w,hem-10],[176+w,hem],[mx(ox),hem]],sd,1.6);
    s+=both(m=>dot(X(70-w,m),hem-5,1.6,"#9A9AA2"));
  }
  if(t==="bomber"){
    s+=`<path d="M100 97Q120 109 140 97L142 86Q120 98 98 86Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    for(let x=102;x<140;x+=4) s+=ln(`M${x} 90v10`,dt,.7);
    s+=poly([[64-w,hem-14],[ox,hem-14],[ox,hem],[64-w,hem]],c,1.6)+poly([[mx(ox),hem-14],[176+w,hem-14],[176+w,hem],[mx(ox),hem]],sd,1.6);
    for(let x=67-w;x<ox;x+=4) s+=ln(`M${x} ${hem-13}v12`,dt,.7);
    for(let x=mx(ox)+2;x<176+w;x+=4) s+=ln(`M${x} ${hem-13}v12`,DET(sd),.7);
    s+=both(m=>ln(`M${X(ox,m)} 104V${hem}`,"#8E8A7E",1.4,'stroke-dasharray="1.6 1.4"'));
    s+=poly([[43,148],[57,146],[58,168],[44,170]],c,1.4)+ln("M46 152h9",dt,1)+dot(56,150,1,dt);
    s+=ln("M80 186l12 24",dt,1.6)+ln("M160 186l-12 24",DET(sd),1.6);
  }
  if(t==="work"){
    const cc=hx(it.collar||"black");
    s+=both(m=>poly(MP([[104,88],[82,104],[96,130],[112,104]],m),cc,1.8));
    s+=both(m=>ln(`M${X(89,m)} 108l8 17M${X(93,m)} 104l8 17M${X(97,m)} 100l8 16M${X(101,m)} 96l6 12`,DET(cc),.7));
    s+=both(m=>poly(MP([[76,136],[100,136],[100,162],[76,162]],m),m?sd:c,1.6)+poly(MP([[75,131],[101,131],[101,142],[75,142]],m),m?sd:c,1.6)+dot(X(88,m),138,1.6,"#B79363"));
    s+=both(m=>dash(`M${X(ox-4,m)} 112V${hem-3}`,"#C9A56A",1)+dash(`M${X(66-w,m)} ${hem-5}H${X(ox,m)}`,"#C9A56A",1)+dash(`M${X(77,m)} 170V${hem-8}`,"#C9A56A",.9));
    for(const y of [122,158,194,226]) s+=dot(ox-5,y,2.3,"#B79363");
    s+=ln("M84 200q-4 20 0 30M154 200q4 20 0 30",dt,1);
  }
  if(t==="puffer"){
    s+=poly([[102,72],[138,72],[142,106],[98,106]],c)+flat([[124,72],[138,72],[142,106],[124,106]],sd,.9);
    for(let y=128;y<hem;y+=22) s+=ln(`M${62-d} ${y}Q120 ${y+6} ${178+d} ${y}`,OL,1.4);
    for(const y of [130,160,190,220,250]) s+=both(m=>ln(`M${X(66-d/2,m)} ${y-24}Q${X(56,m)} ${y-18} ${X(44-bulk,m)} ${y-4}`,OL,1.2));
    s+=ln(`M120 74V${hem}`,"#8E8A7E",1.6,'stroke-dasharray="1.6 1.4"')+ln("M84 150q-4 20 2 60",hi,2.4,'opacity=".55"')+ln("M60 160q-4 16-6 40",hi,1.6,'opacity=".45"');
  }
  if(t==="track"){
    s+=poly([[104,78],[136,78],[138,100],[102,100]],c)+ln(`M120 78V${hem}`,"#8E8A7E",1.4,'stroke-dasharray="1.6 1.4"');
    const st=hx(it.stripe||"bone");
    s+=both(m=>ln(`M${X(64-d+3,m)} 108L${X(50-d/2,m)} 154L${X(42,m)} 206L${X(40,m)} 250`,st,2.2)+ln(`M${X(69-d+3,m)} 110L${X(55-d/2,m)} 156L${X(47,m)} 208L${X(45,m)} 250`,st,2.2));
    s+=poly([[64-w,hem-12],[176+w,hem-12],[176+w,hem],[64-w,hem]],c,1.6);
    for(let x=67-w;x<176+w;x+=4) s+=ln(`M${x} ${hem-11}v10`,dt,.7);
    s+=both(m=>ln(`M${X(82,m)} 190l8 22`,dt,1.4));
  }
  if(t==="ziphoodie"){
    s+=`<path d="M96 104Q92 80 120 78Q148 80 144 104L134 97Q120 90 106 97Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    s+=both(m=>poly(MP([[64-w,hem-12],[ox,hem-12],[ox,hem],[64-w,hem]],m),m?sd:c,1.6));
    for(let x=67-w;x<ox;x+=4.5) s+=both(m=>ln(`M${X(x,m)} ${hem-11}v10`,dt,.7));
    s+=both(m=>{let r=poly(MP([[40-bulk,250],[62,254],[61,268],[40-bulk,264]],m),m?sd:c,1.6);for(let x=44;x<60;x+=4)r+=ln(`M${X(x,m)} 253v12`,dt,.7);return r;});
    s+=both(m=>poly(MP([[84,196],[ox-2,196],[ox-2,234],[80,234]],m),m?sd:c,1.4)+ln(`M${X(84,m)} 196q-2 18 -4 38`,dt,1.2));
    s+=both(m=>ln(`M${X(ox,m)} 102V${hem}`,"#8E8A7E",1.4,'stroke-dasharray="1.6 1.4"'));
    const ac=hx(it.art||"storm");
    if(it.art) s+=`<path d="M72 122q10-10 22 -2q10 8 16 -2l2 30q-12 10-24 4q-10 12-18 2z" fill="${ac}" opacity=".85"/><path d="M130 118q14-6 22 6q8 12-2 24q-10 8-20 2z" fill="${ac}" opacity=".85"/>`+ln("M78 168h30M132 168h28",ac,3)+ln("M84 178h22",hx("storm"),1.6);
    s+=ln("M114 112q-2 16 -3 26",hx("storm"),1.6)+ln("M126 112q2 16 3 26",hx("storm"),1.6);
  }
  if(t==="coat"||t==="blazer"){
    s+=both(m=>poly(MP([[104,90],[91,104],[96,112],[89,118],[106,178],[112,108]],m),m?sd:c,1.8));
    for(const y of (t==="coat"?[192,236,280]:[202,230])) s+=dot(ox-4,y,2.7,DET(c));
    const py=t==="coat"?276:232;
    s+=both(m=>poly(MP([[70-w/2,py],[97,py],[97,py+10],[70-w/2,py+10]],m),m?sd:c,1.4));
    if(t==="blazer") s+=ln("M136 142h16",dt,1.4);
    if(t==="coat") s+=ln("M80 172q-4 60 0 150M158 172q4 60 0 150",dt,1,'opacity=".6"')+ln(`M${ox} 300V${hem}`,OL,1)+ln("M118 300l0 50",dt,1);
  }
  return s;
}

/* open shirt worn as a light jacket over a tee */
function drawOpenShirt(it){
  const c=hx(it.c), sd=SHADE(c), dt=DET(c), [d,w]=FIT[it.fit||"relaxed"], hem=250, id="o"+(++UID);
  const panel=m=>MP([[106,92],[66-d,105],[63-d,160],[66-w,hem],[112,hem],[111,118]],m);
  let s=poly(sleeve(d,true,false),c)+poly(sleeve(d,true,true),sd)+poly(panel(false),c)+poly(panel(true),c);
  s+=flat([[140,97],[174+d,105],[177+d,160],[174+w,hem],[146,hem]],sd,.8);
  if(it.stripe){ s+=`<defs><pattern id="${id}" width="8" height="10" patternUnits="userSpaceOnUse"><rect width="2.4" height="10" fill="${hx(it.stripe)}"/></pattern></defs>`;
    s+=both(m=>`<path d="${P(panel(m))}" fill="url(#${id})"/>`)+both(m=>`<path d="${P(sleeve(d,true,m))}" fill="url(#${id})"/>`); }
  s+=both(m=>poly(MP([[106,90],[118,118],[108,126],[96,102]],m),c,1.6));
  for(let y=132;y<hem-6;y+=24) s+=dot(110,y,1.7,mix(c,"#000000",.3));
  s+=both(m=>poly(MP([[42,252],[62,256],[61,268],[42,264]],m),m?sd:c,1.6));
  s+=poly([[128,130],[146,130],[146,148],[128,148]],c,1.3);
  return s;
}

/* ---------- bottoms ---------- */
function drawBottom(it){
  const c=hx(it.c), sd=SHADE(c), dt=DET(c), t=it.type;
  const lw={slim:0,regular:2,relaxed:6,boxy:8,over:15,baggy:13,balloon:2}[it.fit||"regular"];
  const top=226, hem=500;
  let s;
  if(it.fit==="balloon"){
    s=poly([[76,top],[164,top],[172,270],[184,380],[162,hem],[124,hem],[120,292],[116,hem],[78,hem],[56,380],[68,270]],c);
    s+=flat([[146,top+4],[164,top],[172,270],[184,380],[162,hem],[140,hem],[150,380]],sd,.9);
    s+=both(m=>ln(`M${X(74,m)} 330q-6 30 -2 60M${X(92,m)} 300q-10 40 -4 90`,dt,1,'opacity=".55"'));
  } else {
    s=poly([[76,top],[164,top],[168+lw/3,272],[162+lw,hem],[124,hem],[120,290],[116,hem],[78-lw,hem],[72-lw/3,272]],c);
    s+=flat([[146,top+4],[164,top],[168+lw/3,272],[162+lw,hem],[140,hem]],sd,.9);
  }
  s+=ln(`M76 ${top+10}H164`,OL,1.3);
  for(const x of [84,106,134,156]) s+=poly([[x-1.6,top],[x+1.6,top],[x+1.6,top+12],[x-1.6,top+12]],c,1);
  s+=both(m=>ln(`M${X(104,m)} 300q-3 20 -1 30M${X(100-lw/2,m)} 440q6 4 14 2`,dt,1,'opacity=".6"'));        // knee + ankle creases
  if(t==="trouser"||t==="chino"){
    s+=ln("M120 236q0 20 -1 34",OL,1.2)+ln("M124 236q1 18 -4 34",dt,.9);
    s+=both(m=>ln(`M${X(80,m)} 238l10 26`,OL,1.2));
    if(it.pleat) s+=both(m=>ln(`M${X(104,m)} 237q1 12 0 26M${X(96,m)} 237q1 8 0 16`,dt,1.1));
    if(t==="trouser") s+=both(m=>ln(`M${X(99-lw/3,m)} 262L${X(97-lw/2,m)} ${hem-4}`,dt,1.1,'opacity=".75"'));
    s+=both(m=>ln(`M${X(78-lw,m)} ${hem-6}q20 4 38 0`,dt,.9));
    s+=`<rect x="76" y="${top}" width="88" height="0" />`;
  }
  if(t==="jeans"){
    const st="#C49A5A";
    s+=dash("M120 236q0 18 -8 30",st,1)+both(m=>dash(`M${X(80,m)} 238q12 18 22 2`,st,1))+dash("M132 238h8v6",st,.9);
    s+=dot(84,244,1.4,"#B8A37A")+dot(156,244,1.4,"#B8A37A")+dot(120,231,2,"#B8A37A");
    s+=both(m=>`<ellipse cx="${X(97-lw/3,m)}" cy="322" rx="${9+lw/3}" ry="36" fill="#FFFFFF" opacity="${it.wash?.14:.08}"/>`);
    s+=both(m=>`<ellipse cx="${X(99-lw/2,m)}" cy="408" rx="${7+lw/3}" ry="14" fill="#FFFFFF" opacity=".08"/>`);
    s+=both(m=>ln(`M${X(80-lw,m)} ${hem-14}l10 4 10-4 10 4 6-3M${X(80-lw,m)} ${hem-6}l12 3 12-3 12 3`,dt,1));
    s+=both(m=>dash(`M${X(75-lw/3,m)} 272L${X(82-lw,m)} ${hem-2}`,st,.9));
  }
  if(t==="cargo"){
    s+=ln("M120 236q0 20 -1 34",OL,1.2)+both(m=>ln(`M${X(80,m)} 238l10 26`,OL,1.2));
    s+=both(m=>poly(MP([[70-lw/2,318],[92-lw/2,318],[92-lw/2,358],[70-lw/2,358]],m),m?sd:c,1.5)+poly(MP([[69-lw/2,312],[93-lw/2,312],[93-lw/2,324],[69-lw/2,324]],m),m?sd:c,1.5)+dot(X(81-lw/2,m),319,1.4,dt));
    s+=both(m=>ln(`M${X(84-lw,m)} 392q16 6 32 0`,dt,1)+ln(`M${X(80-lw,m)} ${hem-8}q18 5 36 0`,dt,1));
    if(it.fit==="baggy") s+=both(m=>ln(`M${X(68-lw/2,m)} ${hem-24}l14 5 14-5 14 5 8-3`,dt,1.1)+ln(`M${X(70-lw/2,m)} ${hem-12}l12 4 12-4 12 4 10-3`,dt,1.1));
  }
  if(t==="track"){
    const st=hx(it.stripe||"bone");
    s+=both(m=>ln(`M${X(74-lw/3,m)} 238L${X(80-lw,m)} ${hem}`,st,2.2)+ln(`M${X(79-lw/3,m)} 238L${X(85-lw,m)} ${hem}`,st,2.2));
    for(let x=80;x<162;x+=5) s+=ln(`M${x} ${top+1}v8`,dt,.7);
    s+=ln("M114 236q-2 10 -4 16M126 236q2 10 4 16",hx("bone"),1.4);
  }
  return s;
}

/* ---------- shoes: side profile, toes pointing outward ---------- */
function shoeSVG(it){
  const c=hx(it.c), sd=SHADE(c), dt=DET(c), sole=it.sole||"#E9E3D6", t=it.type, st=hx(it.stripe||"bone");
  let u="";
  if(t==="retro"){
    u+=`<path d="M2 17Q1 9 11 7L27 3Q40 0 47 4L48 17Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=`<path d="M2 17Q1 9 11 7L17 6L16 17Z" fill="${sd}" stroke="${OL}" stroke-width="1.2"/>`;
    u+=ln("M22 16L28 5M26 16L32 4M30 16L36 4",st,2)+ln("M19 7l3-3M23 6l3-3M27 5l3-3",dt,1.1)+`<path d="M40 2Q46 2 47 6L41 6Z" fill="${sd}"/>`;
    u+=`<rect x="0" y="16" width="49" height="5" fill="${sole}" stroke="${OL}" stroke-width="1.6"/>`+dash("M4 15H46",dt,.8);
  } else if(t==="dunk"){
    const ov=hx(it.overlay||"bone");
    u+=`<path d="M1 17Q0 7 12 6L28 0Q42 -3 48 3L49 17Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=`<path d="M1 17Q0 7 12 6L20 5Q16 12 18 17Z" fill="${ov}" stroke="${OL}" stroke-width="1.2"/><path d="M38 -1Q46 -2 48 3L49 17L40 17Q42 8 38 -1Z" fill="${ov}" stroke="${OL}" stroke-width="1.2"/>`;
    u+=`<path d="M16 14Q30 14 42 5Q34 12 22 16Z" fill="${ov}" stroke="${OL}" stroke-width="1"/>`+ln("M20 4l3-3M24 3l3-3M28 2l3-3",dt,1.1);
    u+=`<rect x="-1" y="16" width="51" height="7" fill="${sole}" stroke="${OL}" stroke-width="1.6"/>`+dash("M3 16H47",DET(ov),.8);
  } else if(t==="tech"){
    const sv=hx("silver");
    u+=`<path d="M0 15Q0 6 11 5L26 0Q41 -3 48 4L49 15Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=ln("M4 12L12 6L18 11L26 3L32 9L40 1",sv,2.2)+ln("M10 14L20 8L28 13L38 6L46 12",mix(sv,"#000000",.35),1.6);
    u+=ln("M18 3l3-3M22 2l3-3M26 1l3-3",sv,1);
    u+=`<path d="M-2 14H50V20H-2Z" fill="#2A2A30" stroke="${OL}" stroke-width="1.6"/><path d="M-2 20H50V26H-2Z" fill="#141319" stroke="${OL}" stroke-width="1.4"/>`+ln("M2 17q8-3 16 0t16 0t14 0",sv,.9);
  } else if(t==="runner"){
    u+=`<path d="M1 16Q0 8 10 6L26 2Q40 -1 47 5L48 16Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=`<path d="M1 16Q0 8 10 6L16 6Q13 10 14 16Z" fill="${sd}" stroke="${OL}" stroke-width="1.1"/><path d="M36 1Q44 0 47 5L48 16L38 16Z" fill="${sd}" stroke="${OL}" stroke-width="1.1"/>`;
    u+=ln("M18 15Q26 7 34 12",hx(it.accent||"navy"),2.4)+ln("M18 5l3-3M22 4l3-3M26 3l3-3",dt,1);
    u+=`<path d="M-1 15H49V${it.chunky?28:24}H-1Z" fill="${sole}" stroke="${OL}" stroke-width="1.6"/>`+ln("M3 19q6-3 12 0t12 0t12 0t8 0",DET(sole),.9);
  } else if(t==="chelsea"){
    u+=`<path d="M3 18Q1 10 12 8L28 6L30 -16L44 -16L46 18Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=`<path d="M31 -12L39 -12L38 6L31 6Z" fill="${sd}" stroke="${OL}" stroke-width="1.1"/>`+ln("M33 -10v14M35 -10v14M37 -10v14",dt,.6);
    u+=`<rect x="36" y="-21" width="5" height="6" fill="${sd}" stroke="${OL}" stroke-width="1"/>`;
    u+=`<path d="M1 18H47V22H1Z" fill="#141319"/><path d="M36 22H47V25H36Z" fill="#141319"/>`+ln("M10 12q10-4 18-5",HI(c),1.6,'opacity=".7"');
  }
  return u;
}
const _ds = it => it ? `<g transform="translate(66 490)">${shoeSVG(it)}</g><g transform="translate(174 490) scale(-1 1)">${shoeSVG(it)}</g>` : "";

/* ---------- accessories ---------- */
const drawShoes = it => it ? `<g transform="translate(66 488)">${shoeSVG(it)}</g><g transform="translate(174 488) scale(-1 1)">${shoeSVG(it)}</g>` : "";
function drawAcc(list,top,inFig=true){
  let s="";
  for(const it of list){
    const c=hx(it.c);
    if(it.type==="chain" && !(top&&["shirt","hoodie","turtle"].includes(top.type)))
      s+=ln("M108 97Q120 126 132 97",c,2.2,'stroke-dasharray="2 1"')+ln("M108 97Q120 126 132 97",mix(c,"#000000",.4),.6);
    if(it.type==="beanie"){ s+=`<path d="M99 46Q98 18 120 17Q142 18 141 46Z" fill="${c}" stroke="${OL}" stroke-width="2"/>`+poly([[98,37],[142,37],[142,49],[98,49]],c,1.8); for(let x=101;x<141;x+=4) s+=ln(`M${x} 38v10`,DET(c),.7);
      if(it.printTxt) s+=`<rect x="104" y="39" width="32" height="8" fill="${it.printTxt}"/>`+ln("M107 41v4M111 41q2 4 0 4M116 41v4h3M123 41q-3 2 0 4M129 41q-3 2 0 4",mix(it.printTxt,"#000000",.5),.9); }
    if(it.type==="cap"){ s+=`<path d="M100 44Q100 20 120 20Q140 20 140 44Z" fill="${c}" stroke="${OL}" stroke-width="2"/><path d="M98 44Q120 38 142 44Q144 52 120 52Q96 52 98 44Z" fill="${SHADE(c)}" stroke="${OL}" stroke-width="1.8"/>`+ln("M120 21V43",DET(c),.8)+`<rect x="113" y="29" width="14" height="7" fill="${DET(c)}"/>`; }
    if(it.type==="watch"&&it.digital){ s+=`<rect x="42" y="267" width="18" height="11" fill="${c}" stroke="${OL}" stroke-width="1"/><rect x="45" y="266" width="12" height="13" fill="${c}" stroke="${OL}" stroke-width="1.2"/><rect x="47" y="269" width="8" height="5" fill="#8E9A7C"/>`+ln("M47 276h8",mix(c,"#000000",.4),.8); }
    else if(it.type==="watch"&&it.smart){ s+=`<rect x="43" y="266" width="16" height="12" fill="#141319"/><rect x="45" y="264" width="12" height="15" rx="3" fill="#1C1C21" stroke="#5C5C66" stroke-width="1.2"/><rect x="47" y="267" width="8" height="9" rx="1.5" fill="#0B0B0E"/>`+ln("M48 270h4",hx("storm"),.8); }
    else if(it.type==="watch"){ s+=`<rect x="42" y="266" width="18" height="12" fill="${it.bracelet?c:"#141319"}" stroke="${OL}" stroke-width="1"/><circle cx="51" cy="272" r="6.5" fill="${c}" stroke="${OL}" stroke-width="1.4"/><circle cx="51" cy="272" r="4.4" fill="${it.dial||"#1E2230"}"/>`+ln("M51 272V268.8M51 272h2.6",it.dial?"#3A3226":c,.9); }
    if(it.type==="ring"){ s+=`<circle cx="${mx(51)}" cy="291" r="2.8" fill="none" stroke="${c}" stroke-width="2"/>`; }
    if(it.type==="glasses"){ s+=poly([[104,50],[118,50],[117,60],[105,60]],c,1.4)+poly([[122,50],[136,50],[135,60],[123,60]],c,1.4)+ln("M118 52h4M104 51l-3 3M136 51l3 3",OL,1.4)+ln("M107 52l4 0",HI(c),1); }
    if(it.type==="belt" && !inFig){ s+=poly([[76,226],[164,226],[164,236],[76,236]],c,1.6)+dash("M78 229H104M136 229H162",DET(c),.8);
      s+= it.plate ? `<path d="M104 223Q112 219 120 226Q128 219 136 223L138 239Q128 243 120 236Q112 243 102 239Z" fill="${hx("silver")}" stroke="${OL}" stroke-width="1.2"/>`+ln("M108 231q6-6 12 0t12 0",mix(hx("silver"),"#000000",.4),1.2)
                  : `<rect x="112" y="224" width="14" height="14" fill="none" stroke="${hx("silver")}" stroke-width="2.2"/>`+ln("M119 226v10",hx("silver"),1.6); }
    if(it.type==="bag"){ s+=ln("M84 104L150 214",OL,3.4)+ln("M84 104L150 214",c,2)+poly([[140,206],[172,202],[174,232],[142,236]],c,1.8)+ln("M142 213l30-4",DET(c),1.2)+dot(157,221,1.6,DET(c)); }
  }
  return s;
}

/* ---------- full figure ---------- */
function figure(parts){
  const g=s=>(parts.find(p=>p.slot===s)||{}).it;
  const top=g("Üst"), lay=g("Katman"), out=g("Dış"), bot=g("Alt"), sh=g("Ayakkabı");
  const acc=parts.filter(p=>p.slot==="Aksesuar").map(p=>p.it);
  let s=`<svg viewBox="30 12 180 520" role="img" aria-label="Kombin figürü">`;
  s+=`<ellipse cx="120" cy="516" rx="70" ry="7" fill="#000" opacity=".25"/>`;
  s+=body();
  if(bot) s+=drawBottom(bot);
  s+=drawShoes(sh);
  if(top) s+=drawTop(top,{forceLong:!!(lay&&lay.type!=="cardigan")});
  if(lay) s+=drawTop(lay,{under:top?top.c:"bone"});
  if(lay&&top&&top.type==="shirt") s+=both(m=>poly(MP([[106,92],[120,112],[112,120],[100,100]],m),hx(top.c),1.6));
  if(out) s+= out.type==="shirt" ? drawOpenShirt(out) : drawOuter(out);
  s+=drawAcc(acc,top);
  return s+`</svg>`;
}
/* single-piece illustration (thumbs, zoom sheet) */
function pieceSVG(it){
  let s="", vb="26 62 188 212";
  if(it.cat==="ust"||it.cat==="katman") s=drawTop(it,{});
  else if(it.cat==="dis"){ s=drawOuter(it); vb=it.type==="coat"?"22 62 196 296":"22 62 196 214"; }
  else if(it.cat==="alt"){ s=drawBottom(it); vb="52 220 136 288"; }
  else if(it.cat==="ayak"){ s=`<g transform="translate(0 0)">${shoeSVG(it)}</g>`; vb=it.type==="chelsea"?"-4 -24 58 52":"-4 -6 58 34"; }
  else { const V={bag:"78 98 100 144",chain:"100 88 40 44",watch:"36 258 30 28",ring:"178 280 22 22",glasses:"98 40 44 26",belt:"72 216 96 28",cap:"94 12 52 44",beanie:"94 12 52 44"}; s=drawAcc([it],null,false); vb=V[it.type]||"94 12 52 44"; }
  return `<svg viewBox="${vb}" aria-hidden="true">${s}</svg>`;
}

/* ================= data ================= */
const CAT={ust:"Üst",katman:"Katman",dis:"Dış giyim",alt:"Alt",ayak:"Ayakkabı",aks:"Aksesuar"};
const BASE=[
  {id:101,name:"Ağır gramaj fitilli tişört",cat:"ust",type:"tee",c:"black",rib:true,fit:"boxy",brand:"Zara",size:"L",price:"590 TL",note:"Fitilli doku sade kombinde kaliteyi gösteriyor. Boxy ve kısa, geniş paçalarla dengeli. Gardırobunun en güçlü üstü."},
  {id:102,name:"Basic tişört",cat:"ust",type:"tee",c:"black",fit:"regular",note:"Hoodie ve gömlek altına baz katman."},
  {id:103,name:"İşlemeli kıvrık kollu tişört",cat:"ust",type:"tee",c:"white",roll:true,embroid:true,fit:"boxy",size:"XL",price:"340 TL",note:"Kıvrık kol kolu dolu gösterir. Saf beyaz yüzüne çok sert gelebilir; siyah ceket ya da siyah altla giy."},
  {id:104,name:"Chavarria polo",cat:"ust",type:"polo",c:"black",pointed:true,script:true,fit:"regular",brand:"Zara × Chavarria",size:"L",note:"Sivri yaka ve beyaz el yazısı işleme: tek başına odak. Date ve bar için en iyi üstün."},
  {id:105,name:"Çizgili gömlek",cat:"ust",type:"shirt",c:"white",stripe:"sky",fit:"relaxed",note:"Mavi-beyaz çizgi. Önü açık, siyah tişörtün üstüne ince ceket gibi giy."},
  {id:106,name:"Çift kollu baskılı hoodie",cat:"ust",type:"hoodie",c:"storm",dsleeve:true,print:"#D9A7B9",fit:"boxy",size:"XL",price:"1.790 TL",note:"Yıkanmış gri, pembe baskı. En hacimli parçan: altı düz ya da tek renk koyu olsun."},
  {id:107,name:"Baskılı fermuarlı hoodie",cat:"dis",type:"ziphoodie",c:"black",art:"storm",fit:"boxy",size:"XL",price:"1.790 TL",note:"Açık fermuarla tişört üstüne. Ön baskı zaten odak; başka baskılı parça ekleme."},
  {id:108,name:"Deri ceket",cat:"dis",type:"leather",c:"black",fit:"regular",note:"Basic siyah. Tişört, polo, hoodie ve gömlek üstüne; gardırobunun yıldızı."},
  {id:109,name:"Balloon fit jean",cat:"alt",type:"jeans",c:"wgrey",fit:"balloon",wash:true,brand:"Zara",size:"EU 42 · US 32",price:"1.490 TL",note:"Dizde geniş, paçada toplanan kesim. Kısa ve oturan üstle en iyi durur."},
  {id:110,name:"Cepli baggy pantolon",cat:"alt",type:"cargo",c:"black",fit:"baggy",note:"Siyah, yan cepli. Tonal siyah kombinlerin tabanı."},
  {id:111,name:"Asimetrik detaylı spor ayakkabı",cat:"ayak",type:"tech",c:"black",size:"43",price:"3.290 TL",note:"Siyah-gümüş teknik runner. Kalın taban geniş paçaları dengeler."},
  {id:112,name:"Casio saat",cat:"aks",type:"watch",bracelet:true,dial:"#E6DDB8",c:"gold",brand:"Casio MTP-VD01G-9EVUDF",note:"Altın dalgıç tipi, şampanya kadran, çelik bilezik. Sıcak tenine en çok yakışan metal: imza parçan. Altın günlerde gümüş kolye takma."},
  {id:113,name:"Apple Watch",cat:"aks",type:"watch",smart:true,c:"black",note:"Spor ve siyah-gümüş kombinlerde."},
  {id:114,name:"Plaka detaylı kemer",cat:"aks",type:"belt",plate:true,c:"black",size:"95",price:"990 TL",note:"Gümüş plaka toka. Görünmesi için tişörtün önünü hafif iç."},
  {id:116,name:"Kolye",cat:"aks",type:"chain",c:"silver",note:"Gümüş. Plaka kemer, Apple Watch ve runner’daki gümüşle aynı aile: gümüş günlerin parçası."},
  {id:115,name:"Baskılı bere",cat:"aks",type:"beanie",printTxt:"#9E2B2B",c:"black",size:"M",price:"790 TL",note:"Siyah üstünde kırmızı yazı: kombinin tek renk vurgusu olsun."}
];
let items=BASE.map(i=>({...i}));
const added=store.get("added"); if(Array.isArray(added)) items=items.concat(added);
const dirtySet=new Set(store.get("dirty")||[]);
const isDirty=id=>dirtySet.has(id), byId=id=>items.find(i=>i.id===id), saveDirty=()=>store.set("dirty",[...dirtySet]);
const nm=it=>`${(COL[it.c]||COL.black)[0]} ${it.name.toLowerCase()}`;

const OCC=[
  ["okul","Okul","ders · kampüs"],["gunluk","Günlük","şehir"],["spor","Spor","salon · koşu"],
  ["kafe","Kafe","sakin"],["bulusma","Buluşma","date"],["konser","Konser","ayakta"],
  ["bar","Bar","akşam"],["club","Club","gece"],["is","İş","yarı resmi"],
  ["ozel","Özel davet","resmi"],["ev","Evdeyim","öneri yok"]
];
const cold=w=>w.t<12;
// his real wardrobe; at most two layers, one focus point
const FORM=[
  {key:"deri",title:"Deri ceket gecesi",style:"Starboy",occ:["bar","club","konser","bulusma"],t:[4,24],muse:"The Weeknd",
    slots:[["Üst",[101,102]],["Dış",[108],w=>w.t<22],["Alt",[110,109]],["Ayakkabı",[111]],["Aksesuar",[113]],["Aksesuar",[116]]],
    v:["ok","Olur. Fitilli siyah tişört, deri ceket, siyah kargo: tonal siyah, iki kat. Kalın runner geniş paçayı dengeliyor, gümüş detaylar ceketin fermuarıyla aynı aileden."],
    pin:"black leather jacket black cargo pants black tee outfit men",note:"Siyahın tonları, gümüş."},
  {key:"polo",title:"Chavarria polo",style:"Soprano × street",occ:["kafe","bulusma","bar","ozel"],t:[10,32],muse:"Tony Soprano",
    slots:[["Üst",[104]],["Dış",[108],w=>w.t<17],["Alt",[109]],["Ayakkabı",[111]],["Aksesuar",[112]]],
    v:["ok","Olur. Sivri yakalı polonun beyaz yazısı ve altın Casio tek sıcak nokta. Gri-mavi balloon jean siyahı yumuşatıyor. Polo kalçada bitmeli, önünü hafif iç."],
    pin:"black polo shirt balloon jeans outfit men",note:"Siyah, gri-mavi, altın."},
  {key:"gomlek",title:"Açık çizgili gömlek",style:"Sade street",occ:["kafe","bulusma","gunluk","okul"],t:[16,30],muse:"",
    slots:[["Üst",[102,101]],["Dış",[105]],["Alt",[109]],["Ayakkabı",[111]],["Aksesuar",[112]]],
    v:["ok","Olur. Gömleğin mavisi jeanin gri-mavisiyle aynı aileden. Açık bırakılan gömlek siyah tişörtü ortada dikey bir şerit gibi gösterir, gövdeyi inceltir."],
    pin:"open striped shirt over black t-shirt jeans outfit men",note:"Mavi-beyaz, siyah, gri-mavi."},
  {key:"zip",title:"Fermuarlı hoodie + tişört",style:"Street",occ:["okul","gunluk","konser","kafe"],t:[6,21],muse:"",
    slots:[["Üst",[102,101]],["Dış",[107]],["Alt",[109,110]],["Ayakkabı",[111]],["Aksesuar",[115],cold]],
    v:["warn","Dikkat. Hoodie XL ve alt geniş: iki hacim. Fermuarı açık bırak (dikey çizgi), hoodie kalçada toplansın. Soğukta bere tek kırmızı nokta olsun."],
    pin:"black graphic zip hoodie black t-shirt baggy jeans outfit",note:"Siyah, gri baskı, gri-mavi."},
  {key:"beyaz",title:"Beyaz tişört + kargo",style:"Sade street",occ:["gunluk","okul","konser","kafe"],t:[16,34],muse:"",
    slots:[["Üst",[103]],["Dış",[108],w=>w.t<19],["Alt",[110]],["Ayakkabı",[111]],["Aksesuar",[112]]],
    v:["warn","Dikkat. Siyah-beyaz net kontrast, kıvrık kol kolu gösterir. Ama saf beyaz sıcak tenine sert gelir; ilerde krem ya da kırık beyaz almanı öneririm. Tişörtün önünü iç, kemer görünsün."],
    pin:"white t-shirt black cargo pants chunky sneakers outfit men",note:"Beyaz, siyah, altın."},
  {key:"cift",title:"Çift kollu hoodie",style:"Street",occ:["okul","gunluk","konser","spor"],t:[6,20],muse:"",
    slots:[["Üst",[106]],["Alt",[110]],["Ayakkabı",[111]],["Aksesuar",[115],cold],["Aksesuar",[113]]],
    v:["warn","Dikkat. En hacimli parçan. Altı siyah ve tek renk olsun, kolları bileğe çek, hoodie kalçada toplansın. Pembe baskı tek renk vurgusu, başka renk ekleme."],
    pin:"layered sleeve grey hoodie black cargo pants outfit",note:"Yıkanmış gri, soluk pembe, siyah."},
  {key:"kisderi",title:"Deri ceket + hoodie",style:"Street × Starboy",occ:["okul","gunluk","konser","bar"],t:[-10,13],muse:"",
    slots:[["Üst",[106]],["Dış",[108]],["Alt",[109,110]],["Ayakkabı",[111]],["Aksesuar",[115]]],
    v:["ok","Olur. Deri ceketin altından hoodie: iki kat, en genç kış kombini. Kapüşonu ceketin dışına al, bere ile tamamla."],
    pin:"leather jacket over hoodie outfit men",note:"Siyah, yıkanmış gri."},
  {key:"club",title:"Club · tek renk",style:"Starboy",occ:["club","bar"],t:[6,36],muse:"The Weeknd",
    slots:[["Üst",[101]],["Alt",[110]],["Ayakkabı",[111]],["Aksesuar",[113]],["Aksesuar",[116]]],
    v:["ok","Olur. Tek kat, tek renk. Tişörtün önünü hafif iç ki plaka kemer görünsün: odak orada."],
    pin:"all black outfit cargo pants belt buckle men",note:"Siyah ve gümüş."},
  {key:"spor",title:"Spor · şimdilik",style:"Athleisure",occ:["spor"],t:[-5,35],muse:"",
    slots:[["Üst",[102]],["Alt",[110]],["Ayakkabı",[111]],["Aksesuar",[113]]],
    v:["warn","Şimdilik. Kargo spor için ağır; eşofman altı alışveriş listende."],
    pin:"black t-shirt black track pants gym outfit men",note:"Siyah."},
  {key:"is",title:"İş · şimdilik",style:"Sade",occ:["is","ozel"],t:[-10,30],muse:"",
    slots:[["Üst",[104]],["Dış",[108],w=>w.t<17],["Alt",[109]],["Ayakkabı",[111]],["Aksesuar",[112]]],
    v:["warn","Şimdilik. Polo iş için iyi ama altında kumaş pantolon ve sade ayakkabı olmalı. İkisi de alışveriş listesinin ilk iki sırasında."],
    pin:"black polo black trousers minimal outfit men",note:"Siyah ve altın."}
];
const ANTIS=[
  {title:"Oversize her şey",style:"Karşı örnek",muse:"",occ:[],pin:"",
   v:["no","Olmaz. Açık renk oversize hoodie, bol açık jean ve kalın taban: hacim her yönde büyür. Senin hoodie'lerini bu yüzden hep koyu ve tek renk altla eşledim."],
   parts:[{slot:"Üst",it:{type:"hoodie",c:"cream",fit:"over",name:"Oversize hoodie",cat:"ust"}},{slot:"Alt",it:{type:"jeans",c:"sky",fit:"over",wash:true,name:"Baggy jean",cat:"alt"}},{slot:"Ayakkabı",it:{type:"runner",chunky:true,c:"bone",sole:"#F4F0E8",accent:"heather",name:"Chunky",cat:"ayak"}}]}
];

/* capsule maths: valid outfits from the clothing pieces (tops × optional layer × bottoms × shoes) */
function capsuleCombos(list=items){
  const C=list.filter(i=>i.cat!=="aks"), by=c=>C.filter(i=>i.cat===c);
  const light=it=>lum(hx(it.c))>.6, res=[];
  const layers=[null,...by("dis"),...by("ust").filter(i=>i.type==="shirt")];
  for(const t of by("ust")) for(const o of layers) for(const b of by("alt")) for(const s of by("ayak")){
    if(o&&o.id===t.id) continue;
    if(o&&(o.type==="shirt"||o.type==="ziphoodie"||o.type==="puffer"&&false) && t.type!=="tee") continue;
    if(o&&o.type==="ziphoodie"&&t.type==="hoodie") continue;
    if(t.type==="shirt"&&o&&o.type!=="leather") continue;
    if(b.type==="track"&&(t.type==="polo"||t.type==="shirt"||s.type==="chelsea")) continue;
    if(light(t)&&light(b)) continue;
    res.push([t.id,o&&o.id,b.id,s.id]);
  }
  return res;
}

/* ================= weather ================= */
const hour=new Date().getHours(), forTomorrow=hour>=18;
let city=store.get("city")||{name:"İstanbul",lat:41.01,lon:28.97};
let wx={t:13,tmin:9,tmax:15,rain:55,wind:22,live:false};
function renderWx(){
  $("#wxT").textContent=Math.round(wx.t)+"°"; $("#wxTs").textContent=`${Math.round(wx.tmin)}° / ${Math.round(wx.tmax)}°`;
  $("#wxR").textContent="%"+Math.round(wx.rain); $("#wxW").textContent=Math.round(wx.wind)+" KM/S";
  $("#wxCity").textContent=city.name.toLocaleUpperCase("tr");
  $("#wxFor").textContent=(forTomorrow?"Yarının havası · ":"Bugünün havası · ")+city.name;
  const s=$("#wxSrc"); s.textContent=wx.live?"Canlı":"Örnek"; s.classList.toggle("live",wx.live);
}
async function loadWx(){
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=2`);
    if(!r.ok) throw 0; const d=(await r.json()).daily, i=forTomorrow?1:0, tmax=d.temperature_2m_max[i], tmin=d.temperature_2m_min[i];
    wx={t:(tmax*2+tmin)/3,tmin,tmax,rain:d.precipitation_probability_max[i]??0,wind:d.wind_speed_10m_max[i],live:true};
    $("#wxMsg").textContent=""; renderWx(); renderFit(true);
  }catch(e){ /* offline or blocked: keep the sample */ }
}
$("#cityForm").addEventListener("submit",async e=>{
  e.preventDefault(); const q=$("#cityIn").value.trim(); if(!q) return; $("#wxMsg").textContent="aranıyor…";
  try{ const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr`);
    const g=(await r.json()).results?.[0]; if(!g) throw 0;
    city={name:g.name,lat:g.latitude,lon:g.longitude}; store.set("city",city); $("#cityIn").value=""; $("#wxMsg").textContent=""; renderWx(); loadWx();
  }catch(err){ $("#wxMsg").textContent="şehir bulunamadı"; }
});

/* ================= plan + engine ================= */
let plan=store.get("plan")||{occ:"okul",note:""};
function renderPlan(){
  $("#planQ").textContent=forTomorrow?"Yarın nereye?":"Bugün nereye?";
  $("#opts").innerHTML=OCC.map(([k,n,s])=>`<button type="button" class="opt ${plan.occ===k?"on":""}" data-o="${k}">${n}<small>${s}</small></button>`).join("");
  $("#planNote").value=plan.note||"";
}
$("#opts").addEventListener("click",e=>{const b=e.target.closest("[data-o]");if(!b)return;plan.occ=b.dataset.o;fi=0;renderPlan();renderFit(true);});
$("#planSave").addEventListener("click",()=>{plan.note=$("#planNote").value.trim();store.set("plan",plan);$("#planSaved").textContent="Kaydedildi";fi=0;renderFit(true);setTimeout(()=>$("#planSaved").textContent="",2400);});

let fi=0;
function ranked(){
  if(plan.occ==="ev") return [];
  return FORM.map(f=>{let s=0;if(f.occ.includes(plan.occ))s+=10;if(wx.t>=f.t[0]&&wx.t<=f.t[1])s+=6;else s-=Math.min(Math.abs(wx.t-f.t[0]),Math.abs(wx.t-f.t[1]));return{f,s};})
    .filter(x=>x.s>=10).sort((a,b)=>b.s-a.s).map(x=>x.f);
}
function build(f,w=wx){
  const out=[];
  for(const [slot,cands,cond] of f.slots){
    if(cond&&!cond(w)) continue;
    let list=[...cands];
    if(slot==="Ayakkabı"&&w.rain>=50) list.sort((a,b)=>(byId(b).type==="chelsea")-(byId(a).type==="chelsea"));
    if(slot==="Dış"&&w.t<8) list.sort((a,b)=>(["puffer","coat"].includes(byId(b).type))-(["puffer","coat"].includes(byId(a).type)));
    const pick=list.find(id=>!isDirty(id)), first=list[0];
    out.push({slot,it:byId(pick??first),missing:!pick,replaced:pick&&pick!==first&&isDirty(first)?byId(first):null});
  }
  return out;
}
const STAMP={ok:["可",""],warn:["△","warn"],no:["否","no"]};
const pinURL=q=>"https://www.pinterest.com/search/pins/?q="+encodeURIComponent(q);
function renderFit(anim){
  const list=ranked(), card=$("#fit");
  if(!list.length){$("#fitTitle").textContent=plan.occ==="ev"?"Evdesin, kombin gerekmiyor.":"Bu hava ve plana uygun kombin yok.";$("#fitStyle").textContent="";
    ["#fitFig","#fitList","#fitWhy","#fitVerdict"].forEach(s=>$(s).innerHTML="");$("#fitCount").textContent="";$("#swapMsg").classList.remove("on");return;}
  fi%=list.length; const f=list[fi], parts=build(f);
  $("#fitCount").textContent=`${String(fi+1).padStart(2,"0")} / ${String(list.length).padStart(2,"0")}`;
  $("#fitStyle").textContent=f.style+(f.muse?" · "+f.muse:""); $("#fitTitle").textContent=f.title;
  const [k,cls]=STAMP[f.v[0]];
  $("#fitFig").innerHTML=figure(parts)+`<span class="stamp ${cls}">${k}</span>`;
  $("#fitList").innerHTML=parts.map(p=>`<div class="pi"><button class="thumb" data-zoom="${p.it.id}" aria-label="${nm(p.it)} detay">${pieceSVG(p.it)}</button>
    <div><div class="row"><span class="slot">${p.slot}</span><button class="dirty-t" data-dirty="${p.it.id}">${p.missing?"Hepsi kirli":"Kirli"}</button></div><b>${nm(p.it)}</b></div></div>`).join("");
  const msg=[...parts.filter(p=>p.replaced).map(p=>`<b>${nm(p.replaced)}</b> kirli, yerine ${nm(p.it)} seçildi.`),...parts.filter(p=>p.missing).map(p=>`<b>${p.slot}</b> için temiz parça kalmadı.`)].join(" ");
  $("#swapMsg").innerHTML=msg; $("#swapMsg").classList.toggle("on",!!msg);
  $("#fitVerdict").innerHTML=`<strong style="color:var(--${f.v[0]==="ok"?"ok":f.v[0]==="warn"?"warn":"ink-3"})">${k} KARAR</strong>${f.v[1]}`;
  const out=parts.find(p=>p.slot==="Dış"), o=OCC.find(x=>x[0]===plan.occ);
  $("#fitWhy").innerHTML=[
    ["天",`${city.name}, ${Math.round(wx.t)}°${wx.rain>=50?`, %${Math.round(wx.rain)} yağış`:""}: ${out?nm(out.it)+" şart":"dış katman gerekmiyor"}${wx.rain>=50&&parts.some(p=>p.it.type==="chelsea")?". Yağmur için bot seçildi":""}.`],
    ["事",`${o[1]}${plan.note?` (“${plan.note}”)`:""}: ${f.style} çizgisi bu ortama oturuyor.`],
    ["色",f.note],
    ["体","178 / 90: düz paça, omuzda biten dikiş, kalçayı geçmeyen üst."]
  ].map(([a,b])=>`<li><b>${a}</b><span>${b}</span></li>`).join("");
  $("#pinBtn").href=pinURL(f.pin); $("#wearBtn").textContent="Bunu giyiyorum";
  if(anim){card.classList.remove("glitch");void card.offsetWidth;card.classList.add("glitch");}
}
$("#fitList").addEventListener("click",e=>{
  const z=e.target.closest("[data-zoom]"); if(z){zoom(+z.dataset.zoom);return;}
  const b=e.target.closest("[data-dirty]"); if(!b)return; dirtySet.add(+b.dataset.dirty); saveDirty(); renderFit(true); renderList();
});
$("#nextBtn").addEventListener("click",()=>{fi++;renderFit(true);});
$("#wearBtn").addEventListener("click",e=>{e.currentTarget.textContent="Kaydedildi ✓";});

(function(){
  const d=new Date(); if(forTomorrow) d.setDate(d.getDate()+1);
  const days=["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  $("#cardTitle").textContent=forTomorrow?"明日の服":"今日の服"; $("#cardKan").textContent=forTomorrow?"明日":"今日";
  $("#cardSub").textContent=`${forTomorrow?"YARININ KIYAFETİ":"BUGÜNÜN KIYAFETİ"} · ${days[d.getDay()].toLocaleUpperCase("tr")} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
  const t0=Date.now(); setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);$("#tc").textContent=[s/3600,s/60%60,s%60].map(v=>String(Math.floor(v)).padStart(2,"0")).join(":");},1000);
})();

/* ================= wardrobe ================= */
let wf="all";
const FITTXT={slim:"Slim",regular:"Regular",relaxed:"Relaxed",boxy:"Boxy",baggy:"Baggy",balloon:"Balloon"};
function renderFilters(){$("#filters").innerHTML=[["all","Tümü"],...Object.entries(CAT),["kirli","Kirli"]].map(([k,v])=>`<button class="${wf===k?"on":""}" data-f="${k}">${v}</button>`).join("");}
function renderList(){
  const L=items.filter(i=>wf==="all"||(wf==="kirli"?isDirty(i.id):i.cat===wf));
  $("#wStat").textContent=`${items.length} PARÇA · ${[...dirtySet].filter(id=>byId(id)).length} KİRLİ`;
  $("#list").innerHTML=L.map(it=>`<div class="it ${isDirty(it.id)?"is-dirty":""}"><button class="ph" data-zoom="${it.id}" aria-label="Detay">${it.img?`<img src="${it.img}" alt="">`:pieceSVG(it)}</button>
    <div><span class="k">${CAT[it.cat]}${it.fit?" · "+FITTXT[it.fit]:""}</span><h3>${nm(it)}</h3>${it.brand||it.size||it.price?`<span class="k">${[it.brand,it.size,it.price].filter(Boolean).join(" · ")}</span>`:""}<small>${it.note||""}</small></div>
    <button class="state ${isDirty(it.id)?"d":""}" data-t="${it.id}">${isDirty(it.id)?"Kirli":"Temiz"}</button></div>`).join("")||`<p class="empty">Bu filtrede parça yok.</p>`;
}
$("#filters").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;wf=b.dataset.f;renderFilters();renderList();});
$("#list").addEventListener("click",e=>{
  const z=e.target.closest("[data-zoom]"); if(z){zoom(+z.dataset.zoom);return;}
  const b=e.target.closest("[data-t]");if(!b)return;const id=+b.dataset.t;dirtySet.has(id)?dirtySet.delete(id):dirtySet.add(id);saveDirty();renderList();renderFit(false);
});
function zoom(id){
  const it=byId(id); if(!it) return;
  $("#zKind").textContent=CAT[it.cat]; $("#zName").textContent=nm(it);
  $("#zArt").innerHTML=it.img?`<img src="${it.img}" alt="" style="max-width:100%">`:pieceSVG(it);
  $("#zSpec").innerHTML=[["Marka",it.brand||"—"],["Beden",it.size||"—"],["Kalıp",it.fit?(FITTXT[it.fit]||it.fit):"—"],["Renk",(COL[it.c]||COL.black)[0]],["Not",it.note||"—"],["Durum",isDirty(id)?"Kirli":"Temiz"]].map(([a,b])=>`<div class="rule"><span>${a}</span><p>${b}</p></div>`).join("");
  openSheet("#zoomSheet");
}

/* ================= style ================= */
let lf="all";
function renderLook(){
  const occs=[["all","Tümü"],...OCC.filter(o=>o[0]!=="ev").map(o=>[o[0],o[1]])];
  $("#lookF").innerHTML=occs.map(([k,n])=>`<button class="${lf===k?"on":""}" data-l="${k}">${n}</button>`).join("");
  const L=[...FORM.filter(f=>lf==="all"||f.occ.includes(lf)).map(f=>({...f,parts:build(f,{t:f.t[1]<=13?2:Math.min(14,f.t[1]-2),rain:10})})),...(lf==="all"?ANTIS:[])];
  $("#lookCount").textContent=L.length+" kombin";
  $("#look").innerHTML=L.map(x=>{const [k,cls]=STAMP[x.v[0]];
    return `<div class="lk"><div class="fig">${figure(x.parts)}<span class="stamp ${cls}">${k}</span></div>
    <div class="b"><span class="label">${x.style}${x.muse?" · "+x.muse:""}</span><h3>${x.title}</h3><p>${x.v[1]}</p>${x.pin?`<a class="pin" href="${pinURL(x.pin)}" target="_blank" rel="noopener">Pinterest'te gerçek örnek ↗</a>`:""}</div></div>`;}).join("");
}
$("#lookF").addEventListener("click",e=>{const b=e.target.closest("[data-l]");if(!b)return;lf=b.dataset.l;renderLook();});
const COMBOS=[
  [["#1C1C21","#5E4130","#C9A24A"],"Siyah + çikolata + altın","Senin ana paletin. Siyah koyu saçınla kontrast kurar, çikolata ve altın sıcak tenini aydınlatır."],
  [["#D8CCB5","#5A5A3B","#1C1C21"],"Krem + zeytin + siyah","Saf beyaz yerine krem ya da kırık beyaz yüzünü canlı gösterir. Zeytin sıcak alt tonla aynı aileden."],
  [["#A8845A","#1F2739","#E9E3D6"],"Deve tüyü + lacivert","Deve tüyü ve camel sıcak tenin en iyi dostu. Lacivert siyaha göre daha yumuşak bir koyu."],
  [["#5A2A2E","#1C1C21","#A9ADAC"],"Bordo + siyah","Soluk bordo tek renk vurgusu olarak (bere, triko). Parlak kırmızı yerine bu."],
  [["#46505F","#1C1C21","#F1EEE8"],"Gri-mavi + siyah","Elindeki balloon jean ve siyah üstler. Beyaz sadece küçük dozda (yazı, şerit)."]
];
const SKIN=[
  ["Ten","Orta ton, sıcak alt ton (zeytin-altın). Koyu saç ve koyu göz: orta-yüksek kontrast."],
  ["Yakışan","Siyah, çikolata, deve tüyü, krem, zeytin, bordo, lacivert, koyu yeşil. Toprak tonları seni canlı gösterir."],
  ["Dikkat","Saf optik beyaz, buz grisi, soluk pastel (açık pembe, bebek mavisi) ve neon yüzüne yakın olunca teni soluk gösterir. Bunları belden aşağı ya da küçük detay olarak kullan."],
  ["Metal","Altın. Altın Casio'n bu yüzden doğru seçim. Yüze yakın metaller (zincir, gözlük çerçevesi) altın olsun; kemer tokası ve ayakkabıdaki gümüş uzakta kaldığı için sorun değil."],
  ["Gözlük","İnce altın ya da kahve kaplumbağa çerçeve sıcak tenine yakışır. Güneş için numaralı kahve camlı gözlük ya da fotokromik cam."]
];
$("#skin").innerHTML=SKIN.map(([a,b])=>`<div class="rule"><span>${a}</span><p>${b}</p></div>`).join("");
$("#cmb").innerHTML=COMBOS.map(([cs,n,d])=>`<div class="cm"><div class="sw">${cs.map(c=>`<div style="background:${c}"></div>`).join("")}</div><div class="b"><h3>${n}</h3><p>${d}</p></div></div>`).join("");
const RULES=[
  ["Katman","En fazla iki kat: tişört, uzun kollu ya da sweatshirt, üstüne tek ceket. Gömlek + kazak + ceket yok."],
  ["Odak","Her kombinde tek dikkat çeken şey: ya ceket, ya ayakkabı, ya gümüş. Gerisi sade ve tek renk ailesinde."],
  ["Bedenler","Üst: L (Zara), XL (Bershka / Pull&Bear) · Bel: EU 42 / US 32 · Ayakkabı: 43 · Kemer: 95."],
  ["Geniş paça","Balloon ve baggy altın varken üst kısa ve oturan olsun (boxy tişört, polo). İkisi de bol olursa gövde kutu gibi görünür."],
  ["Kalıp","Regular veya boxy-kısa. Uzun ve bol üst, geniş paçayla birleşince boyu kısaltır."],
  ["Omuz","Dikiş omuz kemiğinde bitsin. Önce omuza göre beden seç."],
  ["Boy","Üst kalçanın ortasını geçmesin. Tişört kemerin 5–7 cm altında bitsin."],
  ["Pantolon","Belde oturan, düz paça. Relaxed olur, baggy olmaz."],
  ["Renk","Kombin başına en fazla iki ana renk. Tonal koyu kombin boyu uzatır."],
  ["Kumaş","Ağır ve dik duran kumaş: 240 g/m² pamuk, french terry, deri, yün. Sade kombinde kalite görünür."]
];
$("#rules").innerHTML=RULES.map(([a,b])=>`<div class="rule"><span>${a}</span><p>${b}</p></div>`).join("");
const DIRS=[
  ["Sade estetik","Ana yön",["red","Her gün"],"Az parça, net kalıp, iki kat. Tek renk ailesi ve tek bir odak noktası. Kapsülün tamamı bunun üstüne kurulu."],
  ["Starboy","The Weeknd",["red","Gece"],"Siyah deri ceket, siyah tişört, tek zincir. Bar, club, konser."],
  ["City Boy","POPEYE · Tokyo",["cyan","Gündüz"],"Uzun kollu tişört, chino, beyaz retro sneaker, şapka. Okul ve kafe."],
  ["Soprano dokunuşu","Tony Soprano",["cyan","Date"],"Triko polo, pileli pantolon, gümüş. Tişörtün bir üst seviyesi."]
];
$("#dirs").innerHTML=DIRS.map(([n,s,[c,t],d])=>`<div class="dir"><div class="t"><h3>${n}</h3><span class="tag ${c}">${t}</span></div><span class="label">${s}</span><p>${d}</p></div>`).join("");

/* capsule */
function renderCapsule(){
  const combos=capsuleCombos(), C=items.filter(i=>i.cat!=="aks");
  $("#capCount").textContent=`${C.length} parça · ${combos.length} kombin`;
  $("#capsule").innerHTML=`<div class="capbig"><strong>${C.length}</strong><span class="label">parça</span><i>→</i><strong>${combos.length}</strong><span class="label">geçerli kombin</span></div>`+
    ["ust","dis","alt","ayak"].map(c=>`<div class="caprow"><span class="label">${CAT[c]}</span><div class="caps">${C.filter(i=>i.cat===c).map(i=>`<button class="thumb" data-zoom="${i.id}" title="${nm(i)}">${pieceSVG(i)}</button>`).join("")}</div></div>`).join("")+
    `<p class="muted" style="font-size:12.5px;margin-top:10px">Hesap: her üst × ceketsiz ya da tek ceket × her alt × her ayakkabı. Gömlek ve fermuarlı hoodie sadece tişört üstüne katman sayıldı; iki katı geçen ya da uyumsuz eşleşmeler çıkarıldı.</p>`;
}
$("#capsule").addEventListener("click",e=>{const z=e.target.closest("[data-zoom]");if(z)zoom(+z.dataset.zoom);});
const ACCS=[
  {id:112,why:"İmza parçan. Altın, sıcak tenine en çok yakışan metal. Siyah kombinin tek sıcak noktası.",orig:"Casio MTP-VD01G-9EVUDF · altın dalgıç",find:[["Sende var","✓"]]},
  {id:113,why:"Spor, konser ve siyah-gümüş kombinlerde. Altın Casio'yu ise date ve polo günlerine sakla.",orig:"Apple Watch",find:[["Sende var","✓"]]},
  {id:114,why:"Gümüş plaka toka tonal siyah kombinin odağı. Görünmesi için tişörtün önünü hafif iç.",orig:"Plaka detaylı deri kemer · 95",find:[["Sende var","✓"]]},
  {id:115,why:"Siyah üstünde kırmızı yazı. Taktığın gün başka renkli parça ekleme.",orig:"Baskılı bere · M",find:[["Sende var","✓"]]},
  {id:116,why:"Sende var. Gümüş günlerin parçası: plaka kemer, Apple Watch ve siyah deri ceketle.",orig:"Gümüş kolye",find:[["Sende var","✓"]]},
  {id:0,virt:{name:"Güneş gözlüğü",cat:"aks",type:"glasses",c:"brown"},why:"Eklenecek. Numaralı gözlük kullandığın için kahve camlı numaralı güneş gözlüğü ya da fotokromik cam.",orig:"Kalın kahve kaplumbağa çerçeve",find:[["Optik","numaralı güneş gözlüğü"],["Optik","fotokromik cam"]]}
];
$("#accs").innerHTML=ACCS.map(x=>{const it=x.virt||byId(x.id);return `<div class="ic"><button class="thumb" data-zoom="${it.id}">${pieceSVG(it)}</button><div class="b"><h3>${nm(it)}</h3><p>${x.why}</p>
  <div class="find"><div><b>Model</b>${x.orig}</div>${x.find.map(([b,...q])=>`<div><b>${b}</b>${q.map(k=>`<code>${k}</code>`).join(" ")}</div>`).join("")}</div></div></div>`;}).join("")+
  `<div class="ic" style="grid-template-columns:1fr"><p><b style="font-weight:500;color:var(--ink)">İki metal günü:</b> Altın gün = Casio, kolye yok (polo, gömlek, date). Gümüş gün = Apple Watch + gümüş kolye + plaka kemer (siyah deri, club, konser). Aynı anda en fazla üç aksesuar.</p></div>`;
$("#accs").addEventListener("click",e=>{const z=e.target.closest("[data-zoom]");if(z)zoom(+z.dataset.zoom);});

/* ================= shop ================= */
const ICONS=[
  {n:"Detroit tipi worker ceket",y:"Carhartt · 1954",it:{cat:"dis",type:"work",c:"duck",collar:"black",fit:"boxy"},
   why:"Kanvas, kadife yaka, boxy kesim. Hoodie üstüne kampüsün en ikonik parçası.",orig:"Carhartt WIP Detroit Jacket",
   find:[["Zara","worker ceket","kanvas ceket"],["Pull&Bear","workwear ceket"],["Bershka","kanvas ceket"],["H&M","workwear ceket"]]},
  {n:"Straight jean (501 tipi)",y:"Levi's 501",it:{cat:"alt",type:"jeans",c:"indigo",fit:"regular"},
   why:"Düz paça, koyu yıkama. Her stile uyan tek pantolon.",orig:"Levi's 501 Original",
   find:[["Zara","straight fit jean"],["Pull&Bear","straight jean koyu"],["H&M","regular jeans"],["Mavi","straight jean"]]},
  {n:"Retro T-burun sneaker",y:"adidas Samba · Onitsuka Mexico 66",it:{cat:"ayak",type:"retro",c:"black",sole:"#B07A45",stripe:"bone"},
   why:"İnce taban, süet T-burun. 2026'nın en güçlü ayakkabı trendi.",orig:"adidas Samba OG · Onitsuka Tiger Mexico 66 · Puma Speedcat",
   find:[["Zara","retro sneaker"],["Pull&Bear","retro spor ayakkabı"],["Bershka","retro sneaker"],["Trendyol","Samba · Mexico 66 (orijinal)"]]},
  {n:"Basketbol low sneaker",y:"Nike Dunk Low · 1985",it:{cat:"ayak",type:"dunk",c:"heather",overlay:"bone",sole:"#F2EEE6"},
   why:"İki renk panelli, kampüs ve konser ayakkabısı. Gri-beyaz veya siyah-beyaz seç.",orig:"Nike Dunk Low",
   find:[["Pull&Bear","basketbol sneaker"],["Bershka","retro basketbol"],["Zara","panelli deri sneaker"],["Trendyol","Dunk Low (orijinal)"]]},
  {n:"Retro runner",y:"New Balance 2002R · 990",it:{cat:"ayak",type:"runner",c:"heather",accent:"navy",sole:"#E9E3D6"},
   why:"Gri süet-file koşu ayakkabısı. Eşofman ve jean ile, drill ve City Boy.",orig:"New Balance 2002R / 990",
   find:[["Zara","runner sneaker"],["H&M","retro koşu ayakkabısı"],["Trendyol","New Balance 2002R (orijinal)"]]},
  {n:"Café racer deri ceket",y:"Starboy · Soprano",it:{cat:"dis",type:"leather",c:"black"},
   why:"Kalçada biten, sade yaka. Starboy ve Soprano'nun ortak parçası.",orig:"Schott NYC · AllSaints",
   find:[["Zara","deri görünümlü ceket","biker ceket"],["Massimo Dutti","nappa deri ceket"],["Pull&Bear","suni deri ceket"]]},
  {n:"MA-1 bomber",y:"Alpha Industries · 1950'ler",it:{cat:"dis",type:"bomber",c:"olive"},
   why:"Zeytin veya siyah. Açık fermuarla, içi tek renk.",orig:"Alpha Industries MA-1",
   find:[["Zara","bomber ceket"],["Pull&Bear","bomber"],["Bershka","bomber ceket"],["H&M","bomber ceket"]]},
  {n:"Ağır gramajlı hoodie",y:"Champion Reverse Weave",it:{cat:"ust",type:"hoodie",c:"heather",fit:"relaxed",cord:"bone"},
   why:"Gri melanj, kalın french terry. Worker ceketin altına.",orig:"Champion Reverse Weave",
   find:[["H&M","relaxed fit hoodie"],["Pull&Bear","ağır gramaj kapüşonlu"],["Zara","kapüşonlu sweatshirt"]]},
  {n:"Cuban yaka gömlek",y:"Tony Soprano · 1999",it:{cat:"ust",type:"camp",c:"brown",stripe:"cream",fit:"boxy"},
   why:"Kısa kol, düz etek, sakin çizgi veya dokulu desen. Soprano'nun genç hali.",orig:"Bowling / camp collar shirt",
   find:[["Zara","kısa kollu rahat gömlek","resort yaka"],["Massimo Dutti","kısa kollu dokulu gömlek"],["Pull&Bear","bowling gömlek"]]},
  {n:"Triko polo",y:"Soprano × Starboy",it:{cat:"ust",type:"polo",c:"black"},
   why:"Açık yaka, triko doku. Date ve bar için en garanti üst.",orig:"John Smedley · Sunspel",
   find:[["Zara","triko polo"],["Massimo Dutti","triko polo"],["H&M","triko polo"]]},
  {n:"Kısa şişme mont",y:"The North Face Nuptse · 1992",it:{cat:"dis",type:"puffer",c:"black"},
   why:"Mat siyah, kalçada biten. Kış drill ve kampüs.",orig:"The North Face 1996 Retro Nuptse",
   find:[["Zara","şişme mont kısa"],["H&M","şişme mont"],["Pull&Bear","puffer mont"]]}
];
$("#icons").innerHTML=ICONS.map(x=>`<div class="ic"><div class="thumb">${pieceSVG(x.it)}</div><div class="b"><span class="label">${x.y}</span><h3>${x.n}</h3><p>${x.why}</p>
  <div class="find"><div><b>Orijinal</b>${x.orig}</div>${x.find.map(([b,...q])=>`<div><b>${b}</b>${q.map(k=>`<code>${k}</code>`).join(" ")}</div>`).join("")}</div></div></div>`).join("");

const BRANDS=["Zara","Massimo Dutti","Pull&Bear","Bershka","H&M"];
const TIERS=[["eko","Ekonomik"],["den","Dengeli"],["yat","Yatırım"]];
// extras to buy, in priority order; "+N" = new outfits it adds to his current wardrobe
const GAPS=[
  {n:"Siyah kumaş pantolon",v:{cat:"alt",type:"trouser",c:"black",pleat:true,fit:"relaxed"},spec:"Pileli, relaxed düz paça. İş, özel davet ve date için tek eksiğin. Polo ve fitilli tişörtle hemen kombin olur.",worth:false,b:{eko:["H&M","Pull&Bear"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Sade retro sneaker",v:{cat:"ayak",type:"retro",c:"black",sole:"#B07A45",stripe:"bone"},spec:"Siyah süet, bal taban, ince profil. Tek ayakkabın kalın runner; kumaş pantolon ve polo ince taban ister.",worth:true,b:{eko:["Pull&Bear","Bershka"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Kısa şişme mont",v:{cat:"dis",type:"puffer",c:"black"},spec:"Siyah ya da koyu çikolata, mat, kalçada biter. Deri ceket 8°C altında yetmez; street gardırobuna kaban yerine bu uyar.",worth:true,b:{eko:["H&M","Pull&Bear"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Krem ağır tişört",v:{cat:"ust",type:"tee",c:"cream",fit:"boxy"},spec:"Saf beyaz yerine krem/ekru: sıcak tenini aydınlatır. Boxy, 240 g/m².",worth:false,b:{eko:["H&M","Pull&Bear","Bershka"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Çikolata kahve üst",v:{cat:"ust",type:"crew",c:"brown"},spec:"Baskısız sweatshirt ya da triko. Siyah dışında ikinci ana rengin olsun; ten rengine en çok yakışan ton.",worth:false,b:{eko:["H&M","Pull&Bear"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Düz koyu straight jean",v:{cat:"alt",type:"jeans",c:"indigo",fit:"regular"},spec:"İki altın da geniş. Hoodie'lerin altına düz paça dengesi.",worth:false,b:{eko:["Pull&Bear","H&M"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Siyah eşofman altı",v:{cat:"alt",type:"track",c:"black",stripe:"bone"},spec:"Spor ve rahat günler. Düz paça.",worth:false,b:{eko:["H&M","Pull&Bear","Bershka"],den:["Zara"],yat:["Massimo Dutti"]}}
];
const baseN=capsuleCombos().length;
GAPS.forEach((g,i)=>{g.unl=capsuleCombos([...items,{...g.v,id:-1-i,name:g.n}]).length-baseN;g.rank=i+1;});
let tier=store.get("tier")||"den", brand="all";
function renderShop(){
  $("#budgetSeg").innerHTML=TIERS.map(([k,n])=>`<button class="${tier===k?"on":""}" data-tier="${k}">${n}</button>`).join("");
  $("#brandF").innerHTML=[["all","Tümü"],...BRANDS.map(b=>[b,b])].map(([k,n])=>`<button class="${brand===k?"on":""}" data-b="${k}">${n}</button>`).join("");
  const L=GAPS.filter(g=>brand==="all"||g.b[tier].includes(brand)||(g.worth&&g.b.yat.includes(brand))).sort((a,b)=>a.rank-b.rank);
  $("#buy").innerHTML=L.map(g=>`<div class="b-it"><div class="col" style="gap:6px"><span class="label">${String(g.rank).padStart(2,"0")} · öncelik</span><h3>${g.n}</h3>${g.worth?`<span><span class="tag red">Bütçeyi aşmaya değer</span></span>`:""}</div>
    <div class="unl"><strong>+${g.unl}</strong><span class="label">yeni kombin</span></div><p class="spec">${g.spec}</p>
    <div class="brands">${g.b[tier].map(b=>`<span class="tag">${b}</span>`).join("")}${g.worth&&tier!=="yat"?`<span class="tag red">↑ ${g.b.yat.join(", ")}</span>`:""}</div></div>`).join("")||`<p class="empty">Bu marka bu bütçede listede yok.</p>`;
}
$("#budgetSeg").addEventListener("click",e=>{const b=e.target.closest("[data-tier]");if(!b)return;tier=b.dataset.tier;store.set("tier",tier);renderShop();});
$("#brandF").addEventListener("click",e=>{const b=e.target.closest("[data-b]");if(!b)return;brand=b.dataset.b;renderShop();});

/* cart review: what to buy, what later, what to skip */
const CART=[
  {v:"al",n:"Retro stil spor ayakkabı · siyah",b:"Zara",size:"43",price:2490,it:{cat:"ayak",type:"retro",c:"black",sole:"#C9B48A",stripe:"charcoal"},
   why:"Listenin 2 numarası buydu. İnce taban ve krem taban: pileli pantolon, polo ve balloon jean ile çalışır. Kalın runner'ın yanına ikinci karakter."},
  {v:"al",n:"Pilili baggy pantolon · siyah",b:"Bershka",size:"40 regular",price:1990,it:{cat:"alt",type:"trouser",c:"black",pleat:true,fit:"relaxed"},
   why:"Listenin 1 numarası: kumaş pantolon. Polo ve fitilli tişörtle date/iş kombini açar. Beden: jean'in EU 42; 40'ın bel ölçüsünü mutlaka kontrol et, emin değilsen 42 al."},
  {v:"al",n:"Teknik balloon pantolon · siyah",b:"Bershka",size:"L",price:1990,it:{cat:"alt",type:"track",c:"black",fit:"balloon",stripe:"black"},
   why:"Eşofman altı ihtiyacını karşılar: spor, rahat gün, uçak. Siyah olduğu için hoodie'lerinle tonal durur."},
  {v:"sonra",n:"Suni deri boxy ceket · bordo",b:"Bershka",size:"L",price:2690,it:{cat:"dis",type:"leather",c:"burgundy",fit:"boxy"},
   why:"Renk olarak çok doğru: bordo sıcak tenine yakışır ve siyah gardırobuna tek renk odağı olur. Ama zaten siyah deri ceketin var; kış için önce şişme mont lazım. Bütçe kalırsa ikinci tur."},
  {v:"alma",n:"Retro deri spor ayakkabı · lacivert",b:"Zara",size:"44",price:2690,it:{cat:"ayak",type:"retro",c:"navy",sole:"#E6DCC6",stripe:"bone"},
   why:"Güzel ama siyah retroyla aynı işi yapıyor; ikisinden birini al, siyah daha çok kombine uyar. Ayrıca beden 44, diğer ayakkabıların 43."},
  {v:"alma",n:"Teknik balloon pantolon · gri",b:"Bershka",size:"L",price:1990,it:{cat:"alt",type:"track",c:"heather",fit:"balloon",stripe:"heather"},
   why:"Siyahının aynısı. Açık gri alt, baskılı gri hoodie ile birleşince her şey gri olur. Bir tane yeter."}
];
function renderCart(){
  const withAl=[...items,...CART.filter(c=>c.v==="al").map((c,i)=>({...c.it,id:-100-i,name:c.n}))];
  const now=capsuleCombos().length, after=capsuleCombos(withAl).length;
  const sum=v=>CART.filter(c=>c.v===v).reduce((a,c)=>a+c.price,0), fmt=n=>n.toLocaleString("tr-TR")+" TL";
  const V={al:["Al","ok"],sonra:["Sonra","warn"],alma:["Alma","no"]};
  $("#cart").innerHTML=`<div class="capbig"><strong>${now}</strong><span class="label">kombin</span><i>→</i><strong>${after}</strong><span class="label">3 parçayla · ${fmt(sum("al"))}</span></div>`+
   CART.map(c=>`<div class="ic"><div class="thumb">${pieceSVG(c.it)}</div><div class="b"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${c.n}</h3><span class="cv ${V[c.v][1]}">${V[c.v][0]}</span></div>
     <span class="label">${c.b} · ${c.size} · ${fmt(c.price)}</span><p>${c.why}</p></div></div>`).join("")+
   `<div class="ic" style="grid-template-columns:1fr"><p>Sepetin tamamı ${fmt(sum("al")+sum("sonra")+sum("alma"))}. Önerim ${fmt(sum("al"))}. Tasarruf ettiğin ${fmt(sum("alma"))} ile kısa şişme mont al.</p></div>`;
}
let cands=store.get("cands")||[];
$("#cBrand").innerHTML=[...BRANDS,"Diğer"].map(b=>`<option>${b}</option>`).join("");
$("#cFor").innerHTML=[...GAPS.map(g=>g.n),...ICONS.map(i=>i.n)].map(n=>`<option>${n}</option>`).join("");
function renderCands(){
  $("#cands").innerHTML=cands.map(c=>`<div class="cd"><div><b style="font-weight:500">${c.n}</b>${c.ex?' <span class="tag">örnek</span>':""}<br><small>${c.b}${c.price?" · ₺"+c.price:""} · ${c.g}</small>${c.link?`<br><a href="${c.link}" target="_blank" rel="noopener" class="label" style="color:var(--cyan)">Linki aç ↗</a>`:""}</div>
    <button class="st ${c.ok?"ok":""}" data-c="${c.id}">${c.ok?"Onaylandı":"Aday"}</button></div>`).join("")||`<p class="empty">Henüz aday yok.</p>`;
}
$("#candF").addEventListener("submit",e=>{e.preventDefault();
  cands.unshift({id:Date.now(),n:$("#cName").value.trim(),b:$("#cBrand").value,link:$("#cLink").value.trim(),price:$("#cPrice").value.trim(),g:$("#cFor").value,ok:false});
  cands=cands.filter(c=>!c.ex);store.set("cands",cands);e.target.reset();renderCands();});
$("#cands").addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(!b)return;const c=cands.find(x=>x.id==b.dataset.c);c.ok=!c.ok;store.set("cands",cands);renderCands();});

const SRC=[
  ["Pinterest · gerçek insanlar üzerinde",[
    ["Gen Z streetwear","pinterest.com/ideas/gen-z-streetwear/904638166766/","Genç sokak stili panosu"],
    ["Mens street style 2026","pinterest.com/ideas/mens-street-style-2026/944522145247/","Bu yılın sokak kombinleri"],
    ["Tony Soprano outfits","pinterest.com/ideas/tony-soprano-outfits/917232711210/","Cuban yaka, triko polo, pileli pantolon"],
    ["Travis Scott outfits","pinterest.com/ideas/travis-scott-outfits/920101096634/","Toprak tonları, kargo, basketbol sneaker"]]],
  ["Yazılar · stil rehberleri",[
    ["Highsnobiety · Central Cee","highsnobiety.com/p/central-cee-style-interview/","Drill stilinin arkasındaki marka seçimleri"],
    ["nss magazine · Tony Soprano","nssmag.com/en/fashion/34169/tony-soprano-style-guide","Soprano gardırobu"],
    ["POPEYE Magazine","magazineworld.jp/popeye","City Boy stilinin kaynağı"]]],
  ["Türkiye · satın almak",[
    ["Zara","zara.com/tr","Retro-style sneakers, worker ceket, triko polo"],
    ["Pull&Bear · Bershka","pullandbear.com/tr","Streetwear temel parçalar, ekonomik"],
    ["Massimo Dutti","massimodutti.com/tr","Yatırım: deri, yün, triko"],
    ["H&M","hm.com/tr","Ağır tişört, hoodie, bomber"],
    ["Trendyol","trendyol.com","Orijinal sneakerlar: Samba, Dunk, New Balance"]]]
];
$("#srcs").innerHTML=SRC.map(([h,l])=>`<div class="src-h label">${h}</div>`+l.map(([n,u,d])=>`<a class="src" href="https://${u}" target="_blank" rel="noopener"><b>${n}</b><span>↗</span><small>${d}</small></a>`).join("")).join("");

/* ================= chrome ================= */
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  if(t.classList.contains("on")) return;
  const eye=$("#eye"); $("#eyeK").textContent=t.dataset.k; eye.classList.remove("run"); void eye.offsetWidth; eye.classList.add("run");
  setTimeout(()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id===t.dataset.view));window.scrollTo({top:0});},
    matchMedia("(prefers-reduced-motion: reduce)").matches?0:220);
}));
$("#themeBtn").addEventListener("click",()=>{const r=document.documentElement,cur=r.dataset.theme||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");r.dataset.theme=cur==="dark"?"light":"dark";});
let openEl=null;
function openSheet(sel){closeSheet();openEl=$(sel);openEl.classList.add("on");$("#scrim").classList.add("on");}
function closeSheet(){if(openEl)openEl.classList.remove("on");$("#scrim").classList.remove("on");openEl=null;}
$("#scrim").addEventListener("click",closeSheet);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeSheet));

const TYPES=[["tee","ust","Tişört"],["hoodie","ust","Hoodie"],["crew","ust","Sweatshirt"],["polo","ust","Triko polo"],["camp","ust","Cuban gömlek"],["shirt","ust","Gömlek"],["turtle","ust","Balıkçı yaka"],
  ["knit","katman","Kazak"],["cardigan","katman","Hırka"],["leather","dis","Deri ceket"],["work","dis","Worker ceket"],["bomber","dis","Bomber"],["puffer","dis","Şişme mont"],["track","dis","Eşofman üstü"],["coat","dis","Kaban"],
  ["trouser","alt","Kumaş pantolon"],["jeans","alt","Jean"],["cargo","alt","Kargo"],["track","alt","Eşofman altı"],["chino","alt","Chino"],
  ["retro","ayak","Retro sneaker"],["dunk","ayak","Basketbol sneaker"],["runner","ayak","Koşu sneaker"],["chelsea","ayak","Chelsea bot"]];
$("#fType").innerHTML=TYPES.map(([t,c,n],i)=>`<option value="${i}">${CAT[c]} · ${n}</option>`).join("");
let pick="black",img=null;
$("#fCols").innerHTML=Object.entries(COL).map(([k,[n,h]])=>`<button type="button" data-c="${k}" aria-label="${n}" title="${n}" style="background:${h}" class="${k===pick?"on":""}"></button>`).join("");
$("#fCols").addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(!b)return;pick=b.dataset.c;$("#fCols").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
$("#addBtn").addEventListener("click",()=>openSheet("#sheet"));
$("#photo").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,480/Math.max(im.width,im.height)),cv=document.createElement("canvas");
    cv.width=im.width*s;cv.height=im.height*s;cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);img=cv.toDataURL("image/jpeg",.8);
    const d=$(".drop");d.querySelector("img")?.remove();d.insertAdjacentHTML("afterbegin",`<img src="${img}" alt="Seçilen fotoğraf">`);};im.src=rd.result;};rd.readAsDataURL(f);});
$("#sheet").addEventListener("submit",e=>{e.preventDefault();const [type,cat]=TYPES[+$("#fType").value];
  items.push({id:Date.now(),name:$("#fName").value.trim()||"Yeni parça",cat,type,c:pick,fit:"regular",img,sole:"#E9E3D6",stripe:"black"});
  store.set("added",items.filter(i=>i.id>1000));e.target.reset();img=null;$(".drop img")?.remove();closeSheet();wf="all";renderFilters();renderList();});

renderCapsule(); renderCart(); renderWx(); renderPlan(); renderFit(false); renderFilters(); renderList(); renderLook(); renderShop(); renderCands();
loadWx();
})();
