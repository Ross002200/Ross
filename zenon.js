(() => {
const $ = s => document.querySelector(s);
const store = {
  get(k){try{return JSON.parse(localStorage.getItem("zenon9:"+k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem("zenon9:"+k,JSON.stringify(v))}catch(e){}}
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
  if(t==="knit"&&it.qzip){
    s+=poly([[104,78],[136,78],[138,98],[102,98]],c,1.8)+flat([[122,78],[136,78],[138,98],[122,98]],sd,.9);
    s+=poly([[112,86],[128,86],[122,132],[118,132]],mix(c,"#000000",.35),1.2)+ln("M120 80V132","#C9A24A",1.4,'stroke-dasharray="1.6 1.2"')+`<rect x="117.5" y="128" width="5" height="7" fill="#C9A24A" stroke="${OL}" stroke-width=".6"/>`;
  } else if(t==="knit"){
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
  if(t==="shorts"){
    const skin="#CF9C74";
    let r=both(m=>poly(MP([[82,320],[116,320],[114,420],[110,492],[90,492],[86,420]],m),m?"#AE7B55":skin,1.8));
    r+=poly([[76,226],[164,226],[170,270],[174,332],[124,336],[120,294],[116,336],[66,332],[70,270]],c);
    r+=flat([[146,230],[164,226],[170,270],[174,332],[140,334]],sd,.9);
    r+=poly([[76,226],[164,226],[164,238],[76,238]],c,1.4)+ln("M114 238q-2 10 -4 14M126 238q2 10 4 14",hx("bone"),1.4);
    r+=both(m=>ln(`M${X(70,m)} 250L${X(68,m)} 332`,dt,1.8))+both(m=>dash(`M${X(68,m)} 324L${X(116,m)} 328`,dt,.9));
    return r;
  }
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
  } else if(t==="canvas"){
    u+=`<path d="M2 17Q0 9 10 7L28 3Q41 1 47 5L48 17Z" fill="${c}" stroke="${OL}" stroke-width="1.8"/>`;
    u+=`<path d="M2 17Q0 9 10 7L14 7Q10 12 11 17Z" fill="#F4F0E6" stroke="${OL}" stroke-width="1.2"/>`+ln("M18 7l3-3M22 6l3-3M26 5l3-3M30 4l3-3",OL,1.1)+`<circle cx="38" cy="8" r="1.4" fill="#F4F0E6" stroke="${OL}" stroke-width=".6"/>`;
    u+=`<rect x="0" y="16" width="49" height="6" fill="#F4F0E6" stroke="${OL}" stroke-width="1.6"/>`+ln("M1 18.5H48",hx("black"),1.1)+ln("M1 20.5H48","#9E2B2B",.8);
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
  else if(it.cat==="alt"){ s=drawBottom(it); vb=it.type==="shorts"?"52 218 136 130":"52 220 136 288"; }
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
  {id:115,name:"Baskılı bere",cat:"aks",type:"beanie",printTxt:"#9E2B2B",c:"black",size:"M",price:"790 TL",note:"Siyah üstünde kırmızı yazı: kombinin tek renk vurgusu olsun."},
  {id:201,name:"Boxy suni deri ceket",cat:"dis",type:"leather",c:"burgundy",fit:"boxy",brand:"Bershka",size:"L",price:"2.690 TL",planned:"sepet",note:"Sepette. Bordo: sıcak tenine yakışan tek renk odağı. Siyah, gri ve koyu jeanle; kırmızı bereyle değil."},
  {id:202,name:"Pilili baggy pantolon",cat:"alt",type:"trouser",c:"black",pleat:true,fit:"relaxed",brand:"Bershka",size:"42 Tall",price:"1.990 TL",planned:"sepet",note:"Sepette. Date, iş, özel gün. Kalın runner ile modern, retro sneaker ile klasik."},
  {id:203,name:"Teknik balloon pantolon",cat:"alt",type:"track",c:"black",fit:"balloon",stripe:"black",brand:"Bershka",size:"L",price:"1.990 TL",planned:"sepet",note:"Sepette. Salonun ana altı; salondan sonra fermuarlı hoodie ile sokağa."},
  {id:204,name:"Retro stil spor ayakkabı",cat:"ayak",type:"retro",c:"black",sole:"#C9B48A",stripe:"charcoal",brand:"Zara",size:"43",price:"2.490 TL",planned:"sepet",note:"Sepette. İnce taban: pileli pantolon ve polo ile."},
  {id:117,name:"Hummel spor ayakkabı",cat:"ayak",type:"runner",c:"black",accent:"charcoal",sole:"#2A2A30",sport:true,brand:"Hummel",note:"Basic siyah. Sadece salon: sokak ayakkabılarını salonda eskitmezsin."},
  {id:118,name:"Spor şort",cat:"alt",type:"shorts",c:"black",sport:true,note:"Salon. Rengini bilmiyorum, siyah varsaydım: söylersen düzeltirim."},
  {id:119,name:"Spor şort",cat:"alt",type:"shorts",c:"charcoal",sport:true,note:"Salon. Rengini bilmiyorum, antrasit varsaydım: söylersen düzeltirim."},
  {id:120,name:"Spor tişörtü",cat:"ust",type:"tee",c:"black",fit:"regular",sport:true,note:"Salon. Siyah ter izini göstermez."},
  {id:121,name:"Spor tişörtü",cat:"ust",type:"tee",c:"black",fit:"regular",sport:true,note:"Salon. İkinci siyah."},
  {id:122,name:"Spor tişörtü",cat:"ust",type:"tee",c:"white",fit:"regular",sport:true,note:"Salon. Beyaz ter izini gösterir: kardiyo ya da hafif günlere sakla."},
  {id:206,name:"Quarter-zip triko",cat:"ust",type:"knit",qzip:true,c:"brown",fit:"regular",planned:"oneri",brand:"Zara · Guadagnino/Galliano kapsülüne de bak",price:"—",note:"Önerim. Çikolata + quarter-zip: sezonun iki trendi. Kalabalıkta herkesin giydiği Nike Tech'in tersi."},
  {id:207,name:"Mühür yüzük",cat:"aks",type:"ring",c:"gold",planned:"oneri",note:"Önerim. Altın gün: Casio ile aynı metal."}
];
let items=BASE.map(i=>({...i}));
const added=store.get("added"); if(Array.isArray(added)) items=items.concat(added);
// planned pieces the user marked as bought
const ownedIds=new Set(store.get("owned")||[]);
items.forEach(i=>{ if(ownedIds.has(i.id)) delete i.planned; });
// user photos per piece (compressed data URLs)
const photos=store.get("photos")||{};
items.forEach(i=>{ if(photos[i.id]) i.img=photos[i.id]; });
const dirtySet=new Set(store.get("dirty")||[]);
const isDirty=id=>dirtySet.has(id), byId=id=>items.find(i=>i.id===id), saveDirty=()=>store.set("dirty",[...dirtySet]);
const nm=it=>`${(COL[it.c]||COL.black)[0]} ${it.name.toLocaleLowerCase("tr")}`;

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
  {key:"cift",title:"Çift kollu hoodie",style:"Street",occ:["okul","gunluk","konser"],t:[6,20],muse:"",
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
  {key:"bordodate",title:"Bordo date",style:"Soprano × Starboy",occ:["bulusma","bar","ozel","kafe"],t:[8,22],muse:"Tony Soprano",
    slots:[["Üst",[104]],["Dış",[201]],["Alt",[202,109]],["Ayakkabı",[204,111]],["Aksesuar",[112]]],
    v:["ok","Olur, en güçlü kombinin. Bordo ceket, siyah polo, siyah pileli pantolon: bordo tek renk, gerisi siyah. Altın Casio sıcak tonu tamamlar."],
    pin:"burgundy leather jacket black polo black trousers outfit men",note:"Bordo, siyah, altın."},
  {key:"bordogun",title:"Bordo ceket + jean",style:"Sade street",occ:["gunluk","okul","kafe","konser"],t:[8,22],muse:"",
    slots:[["Üst",[101,102]],["Dış",[201]],["Alt",[109]],["Ayakkabı",[204,111]],["Aksesuar",[112]]],
    v:["ok","Olur. Bordo ve koyu denim klasik bir eşleşme. Fitilli siyah tişört ceketin altında sade kalır."],
    pin:"burgundy jacket black t-shirt dark jeans outfit men",note:"Bordo, siyah, gri-mavi."},
  {key:"bordogri",title:"Bordo + gri hoodie",style:"Street",occ:["okul","gunluk","konser"],t:[4,16],muse:"",
    slots:[["Üst",[106]],["Dış",[201]],["Alt",[110,203]],["Ayakkabı",[111]],["Aksesuar",[113]]],
    v:["ok","Olur. Bordo, gri ve siyah üçlüsü dengeli bir kombin. Kapüşonu ceketin dışına al. Pembe baskı bordoya yakın tonda olduğu için sorun çıkarmaz."],
    pin:"burgundy jacket grey hoodie black pants outfit",note:"Bordo, yıkanmış gri, siyah."},
  {key:"pileli",title:"Pileli + runner",style:"Modern street",occ:["bar","club","konser","gunluk"],t:[12,32],muse:"",
    slots:[["Üst",[101]],["Alt",[202]],["Ayakkabı",[111]],["Aksesuar",[116]],["Aksesuar",[113]]],
    v:["ok","Olur. Kumaş pantolon ve teknik runner birbirine zıt parçalar, bu da kombini modern gösteriyor. Tişörtün önünü iç ki plaka kemer görünsün: gümüş gün."],
    pin:"pleated trousers chunky sneakers black tee outfit men",note:"Siyah, gümüş."},
  {key:"gomlekpileli",title:"Gömlek + pileli",style:"Sade klasik",occ:["kafe","bulusma","is","gunluk"],t:[16,32],muse:"",
    slots:[["Üst",[102]],["Dış",[105]],["Alt",[202]],["Ayakkabı",[204]],["Aksesuar",[112]]],
    v:["ok","Olur. Önü açık çizgili gömlek, siyah tişört, pileli pantolon, krem kanvas ayakkabı. Yazın sade ve aydınlık bir kombin."],
    pin:"open striped shirt black tee pleated trousers converse outfit",note:"Mavi-beyaz, siyah, krem."},
  {key:"beyazderi",title:"Beyaz tişört + deri",style:"Starboy",occ:["bar","konser","gunluk"],t:[8,22],muse:"The Weeknd",
    slots:[["Üst",[103]],["Dış",[108]],["Alt",[202,110]],["Ayakkabı",[204]],["Aksesuar",[116]]],
    v:["ok","Olur. Siyah deri ceket beyaz tişörtü çerçeveler, beyaz sadece ortada kalır ve yüze sert gelmez. Krem kanvas ayakkabı beyazı aşağıda tekrarlar."],
    pin:"white t-shirt black leather jacket black trousers converse outfit",note:"Siyah, beyaz, krem."},
  {key:"spor",title:"Salon günü",style:"Athleisure",occ:["spor"],t:[-5,35],muse:"",
    slots:[["Üst",[120,121,122]],["Alt",[118,119,203]],["Ayakkabı",[117]],["Aksesuar",[113]]],
    v:["ok","Olur. Spor tişörtü, şort ya da teknik balloon, Hummel ve Apple Watch. Günlük tişörtlerini (özellikle fitilli Zara) salonda giyme, dokusu bozulur."],
    pin:"black gym t-shirt black shorts gym outfit men",note:"Siyah."},
  {key:"salonsonra",title:"Salondan sonra",style:"Athleisure × street",occ:["spor","gunluk","okul","kafe"],t:[6,20],muse:"",
    slots:[["Üst",[102]],["Dış",[107]],["Alt",[203]],["Ayakkabı",[204,111]],["Aksesuar",[115],cold]],
    v:["ok","Olur. Aynı pantolonla salondan çıkıp üstüne fermuarlı hoodie ve temiz bir ayakkabı: çanta hafif, kombin tam."],
    pin:"black zip hoodie black joggers sneakers outfit men",note:"Siyah, gri baskı."},
  {key:"is",title:"İş günü",style:"Sade klasik",occ:["is","ozel"],t:[-10,30],muse:"",
    slots:[["Üst",[104]],["Dış",[108],w=>w.t<17],["Alt",[202]],["Ayakkabı",[204]],["Aksesuar",[112]]],
    v:["ok","Olur. Polo ve pileli pantolon takım elbisesiz en şık hal. Soğukta üstüne siyah deri ceket."],
    pin:"black polo pleated trousers retro sneakers outfit men",note:"Siyah ve altın."}
];
const DISTINCT=[
  {key:"vatisimo",title:"Vatísimo",style:"Chavarria × Zara çizgisi",occ:["bulusma","bar","ozel","kafe"],t:[14,32],muse:"Willy Chavarria",
    slots:[["Üst",[104]],["Alt",[202,110]],["Ayakkabı",[204,111]],["Aksesuar",[112]],["Aksesuar",[207]]],
    v:["ok","Olur. Chavarria'nın kendi lookbook formülü: polo en üst düğmesine kadar kapalı, altında bol pileli pantolon. Ceket yok, altın saat ve yüzük. Herkesin tişörtle çıktığı yerde farkı yakanın kapalı olması yaratıyor."],
    pin:"willy chavarria zara vatisimo polo buttoned wide trousers",note:"Siyah, altın."},
  {key:"bordocikolata",title:"Bordo × çikolata",style:"AW26 renk kombini",occ:["bulusma","kafe","gunluk","bar"],t:[6,18],muse:"Guadagnino × Zara ruhu",
    slots:[["Üst",[206]],["Dış",[201]],["Alt",[109,202]],["Ayakkabı",[204]],["Aksesuar",[112]],["Aksesuar",[207]]],
    v:["ok","Olur. Bordo ile çikolata sezonun en şık ikilisi ve sokakta çok az kişide görürsün. Quarter-zip'in fermuarı boynu uzatır, altın detaylar sıcak tonu bağlar."],
    pin:"burgundy leather jacket brown quarter zip sweater outfit men",note:"Bordo, çikolata, gri-mavi, altın."},
  {key:"qzip",title:"Quarter-zip tek parça",style:"Toparlanmış genç",occ:["okul","kafe","bulusma","is"],t:[10,20],muse:"",
    slots:[["Üst",[206]],["Alt",[202,109]],["Ayakkabı",[204,111]],["Aksesuar",[112]]],
    v:["ok","Olur. Fermuar yarıya kadar açık, yaka dik. Pileli pantolonla klasik, balloon jeanle genç. Tek kat, sıfır uğraş."],
    pin:"brown quarter zip sweater pleated trousers outfit men",note:"Çikolata, siyah, altın."}
];
FORM.push(...DISTINCT);
const ANTIS=[
  {title:"Oversize her şey",style:"Karşı örnek",muse:"",occ:[],pin:"",
   v:["no","Olmaz. Açık renk oversize hoodie, bol açık jean ve kalın taban: hacim her yönde büyür. Senin hoodie'lerini bu yüzden hep koyu ve tek renk altla eşledim."],
   parts:[{slot:"Üst",it:{type:"hoodie",c:"cream",fit:"over",name:"Oversize hoodie",cat:"ust"}},{slot:"Alt",it:{type:"jeans",c:"sky",fit:"over",wash:true,name:"Baggy jean",cat:"alt"}},{slot:"Ayakkabı",it:{type:"runner",chunky:true,c:"bone",sole:"#F4F0E8",accent:"heather",name:"Chunky",cat:"ayak"}}]}
];

/* capsule maths: valid outfits from the clothing pieces (tops × optional layer × bottoms × shoes) */
function capsuleCombos(list=items){
  const C=list.filter(i=>i.cat!=="aks"&&!i.sport), by=c=>C.filter(i=>i.cat===c);
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
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,relative_humidity_2m_mean&timezone=auto&forecast_days=8`);
    if(!r.ok) throw 0; const d=(await r.json()).daily, i=forTomorrow?1:0, tmax=d.temperature_2m_max[i], tmin=d.temperature_2m_min[i];
    wx={t:(tmax*2+tmin)/3,tmin,tmax,rain:d.precipitation_probability_max[i]??0,wind:d.wind_speed_10m_max[i],live:true};
    wxDays={}; d.time.forEach((k,j)=>{ wxDays[k]={t:(d.temperature_2m_max[j]*2+d.temperature_2m_min[j])/3,tmin:d.temperature_2m_min[j],tmax:d.temperature_2m_max[j],uv:d.uv_index_max?.[j]??null,hum:d.relative_humidity_2m_mean?.[j]??null}; });
    store.set("wxDays",wxDays);
    $("#wxMsg").textContent=""; renderWx(); renderFit(true); renderCare(); syncPush();
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
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const targetDate=(()=>{const d=new Date(); if(forTomorrow) d.setDate(d.getDate()+1); return d;})();
const TARGET=iso(targetDate), TODAY=iso(new Date());
let week=store.get("week")||{};            // weekday (0=Sun) -> occasion
function curOcc(){ return plan.date===TARGET ? plan.occ : (week[targetDate.getDay()]||plan.occ); }
let plan=store.get("plan")||{occ:"okul",note:""};
function renderPlan(){
  $("#planQ").textContent=forTomorrow?"Yarın nereye?":"Bugün nereye?";
  const oc=curOcc();
  $("#opts").innerHTML=OCC.map(([k,n,s])=>`<button type="button" class="opt ${oc===k?"on":""}" data-o="${k}">${n}<small>${s}</small></button>`).join("");
  $("#planNote").value=plan.note||"";
}
$("#opts").addEventListener("click",e=>{const b=e.target.closest("[data-o]");if(!b)return;plan.occ=b.dataset.o;plan.date=TARGET;fi=0;renderPlan();renderFit(true);});
$("#planSave").addEventListener("click",()=>{plan.note=$("#planNote").value.trim();plan.occ=curOcc();plan.date=TARGET;store.set("plan",plan);$("#planSaved").textContent="Kaydedildi";fi=0;renderFit(true);setTimeout(()=>$("#planSaved").textContent="",2400);});

let fi=0;
let votes=store.get("votes")||{};            // formula key -> {v:+1|-1, t}
let log=store.get("log")||[];               // [{d,key,title,ids,occ,applied}]
const daysAgo=d=>Math.round((new Date(TODAY)-new Date(d))/864e5);
function ranked(){
  const occ=curOcc(); if(occ==="ev") return [];
  return FORM.map(f=>{let s=0;if(f.occ.includes(occ))s+=10;if(wx.t>=f.t[0]&&wx.t<=f.t[1])s+=6;else s-=Math.min(Math.abs(wx.t-f.t[0]),Math.abs(wx.t-f.t[1]));
      const vt=votes[f.key]; if(vt&&vt.v>0) s+=3;
      const last=log.filter(l=>l.key===f.key).map(l=>daysAgo(l.d)).filter(n=>n>=0).sort((a,b)=>a-b)[0];
      if(last!==undefined&&last<=1) s-=8; else if(last!==undefined&&last<=3) s-=4;
      const banned=vt&&vt.v<0&&(Date.now()-vt.t)<14*864e5;
      return{f,s,banned,inT:wx.t>=f.t[0]&&wx.t<=f.t[1]};})
    .filter(x=>x.inT&&!x.banned&&x.f.occ.includes(occ)&&build(x.f,wx,true)).sort((a,b)=>b.s-a.s).map(x=>x.f);
}
function build(f,w=wx,owned=false){
  const out=[];
  for(const [slot,cands,cond] of f.slots){
    if(cond&&!cond(w)) continue;
    let list=[...cands].filter(id=>byId(id)&&(!owned||!byId(id).planned));
    if(!list.length){ if(slot==="Aksesuar") continue; return null; }
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
  if(!list.length){$("#fitTitle").textContent=curOcc()==="ev"?"Evdesin, kombin gerekmiyor.":"Bu hava ve plana uygun kombin yok.";$("#fitStyle").textContent="";
    ["#fitFig","#fitList","#fitWhy","#fitVerdict"].forEach(s=>$(s).innerHTML="");$("#fitCount").textContent="";$("#swapMsg").classList.remove("on");return;}
  fi%=list.length; const f=list[fi], parts=build(f,wx,true);
  $("#fitCount").textContent=`${String(fi+1).padStart(2,"0")} / ${String(list.length).padStart(2,"0")}`;
  $("#fitStyle").textContent=f.style+(f.muse?" · "+f.muse:""); $("#fitTitle").textContent=f.title;
  const [k,cls]=STAMP[f.v[0]];
  $("#fitFig").innerHTML=figure(parts)+`<span class="stamp ${cls}">${k}</span>`;
  $("#fitList").innerHTML=parts.map(p=>`<div class="pi"><button class="thumb" data-zoom="${p.it.id}" aria-label="${nm(p.it)} detay">${p.it.img?`<img src="${p.it.img}" alt="">`:pieceSVG(p.it)}</button>
    <div><div class="row"><span class="slot">${p.slot}</span><button class="dirty-t" data-dirty="${p.it.id}">${p.missing?"Hepsi kirli":"Kirli"}</button></div><b>${nm(p.it)}</b></div></div>`).join("");
  const msg=[...parts.filter(p=>p.replaced).map(p=>`<b>${nm(p.replaced)}</b> kirli, yerine ${nm(p.it)} seçildi.`),...parts.filter(p=>p.missing).map(p=>`<b>${p.slot}</b> için temiz parça kalmadı.`)].join(" ");
  $("#swapMsg").innerHTML=msg; $("#swapMsg").classList.toggle("on",!!msg);
  $("#fitVerdict").innerHTML=`<strong style="color:var(--${f.v[0]==="ok"?"ok":f.v[0]==="warn"?"warn":"ink-3"})">${k} KARAR</strong>${f.v[1]}`;
  const out=parts.find(p=>p.slot==="Dış"), o=OCC.find(x=>x[0]===curOcc());
  $("#fitWhy").innerHTML=[
    ["天",`${city.name}, ${Math.round(wx.t)}°${wx.rain>=50?`, %${Math.round(wx.rain)} yağış`:""}: ${out?nm(out.it)+" şart":"dış katman gerekmiyor"}${wx.rain>=50&&parts.some(p=>p.it.type==="chelsea")?". Yağmur için bot seçildi":""}.`],
    ["事",`${o[1]}${plan.note?` (“${plan.note}”)`:""}: ${f.style} çizgisi bu ortama oturuyor.`],
    ["色",f.note],
    ["体","178 / 90: düz paça, omuzda biten dikiş, kalçayı geçmeyen üst."]
  ].map(([a,b])=>`<li><b>${a}</b><span>${b}</span></li>`).join("");
  $("#pinBtn").href=pinURL(f.pin); curFit={f,parts};
  const done=log.find(l=>l.d===TARGET&&l.key===f.key);
  $("#wearBtn").textContent=done?"Kaydedildi ✓ · geri al":(forTomorrow?"Yarın bunu giyeceğim":"Bunu giyiyorum");
  const vt=votes[f.key]; $("#likeBtn").classList.toggle("on",!!(vt&&vt.v>0)); $("#dislikeBtn").classList.toggle("on",!!(vt&&vt.v<0));
  if(anim){card.classList.remove("glitch");void card.offsetWidth;card.classList.add("glitch");}
}
$("#fitList").addEventListener("click",e=>{
  const z=e.target.closest("[data-zoom]"); if(z){zoom(+z.dataset.zoom);return;}
  const b=e.target.closest("[data-dirty]"); if(!b)return; dirtySet.add(+b.dataset.dirty); saveDirty(); renderFit(true); renderList();
});
$("#nextBtn").addEventListener("click",()=>{fi++;renderFit(true);});
let curFit=null;
$("#wearBtn").addEventListener("click",()=>{
  if(!curFit) return; const {f,parts}=curFit;
  const i=log.findIndex(l=>l.d===TARGET&&l.key===f.key);
  if(i>=0){ const e=log[i]; if(e.applied) unapplyWear(e); log.splice(i,1); }
  else { log=log.filter(l=>l.d!==TARGET||!l.applied); log.push({d:TARGET,key:f.key,title:f.title,occ:curOcc(),ids:parts.map(p=>p.it.id),applied:false}); }
  store.set("log",log); processLog(); renderFit(false); renderList(); renderLog();
});
$("#likeBtn").addEventListener("click",()=>{ if(!curFit)return; const k=curFit.f.key; votes[k]=votes[k]&&votes[k].v>0?undefined:{v:1,t:Date.now()}; if(!votes[k]) delete votes[k]; store.set("votes",votes); renderFit(false); renderLog(); });
$("#dislikeBtn").addEventListener("click",()=>{ if(!curFit)return; const k=curFit.f.key; votes[k]={v:-1,t:Date.now()}; store.set("votes",votes); toast("14 gün boyunca önerilmeyecek"); renderFit(true); renderLog(); });
$("#shareBtn").addEventListener("click",()=>{ if(curFit) shareOutfit(curFit); });

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
function renderFilters(){$("#filters").innerHTML=[["all","Tümü"],...Object.entries(CAT),["plan","Sepet"],["kirli","Kirli"]].map(([k,v])=>`<button class="${wf===k?"on":""}" data-f="${k}">${v}</button>`).join("");}
function renderList(){
  const L=items.filter(i=>wf==="all"||(wf==="kirli"?isDirty(i.id):wf==="plan"?i.planned:i.cat===wf));
  $("#wStat").textContent=`${items.length} PARÇA · ${[...dirtySet].filter(id=>byId(id)).length} KİRLİ`;
  $("#list").innerHTML=L.map(it=>`<div class="it ${isDirty(it.id)?"is-dirty":""}"><button class="ph" data-zoom="${it.id}" aria-label="Detay">${it.img?`<img src="${it.img}" alt="">`:pieceSVG(it)}</button>
    <div><span class="k">${CAT[it.cat]}${it.fit?" · "+FITTXT[it.fit]:""}</span>${it.planned?`<span class="tag ${it.planned==="sepet"?"cyan":"red"}">${it.planned==="sepet"?"Sepette":"Önerim"}</span>`:""}<h3>${nm(it)}</h3>${it.brand||it.size||it.price?`<span class="k">${[it.brand,it.size,it.price].filter(Boolean).join(" · ")}</span>`:""}<small>${it.note||""}</small></div>
    ${it.planned==="sepet"?`<button class="state" style="border-color:var(--cyan);color:var(--cyan)" data-bought="${it.id}">Aldım</button>`:`<button class="state ${isDirty(it.id)?"d":""}" data-t="${it.id}">${isDirty(it.id)?"Kirli":"Temiz"}</button>`}</div>`).join("")||`<p class="empty">Bu filtrede parça yok.</p>`;
}
$("#filters").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;wf=b.dataset.f;renderFilters();renderList();});
$("#list").addEventListener("click",e=>{
  const z=e.target.closest("[data-zoom]"); if(z){zoom(+z.dataset.zoom);return;}
  const b=e.target.closest("[data-t]");if(!b)return;const id=+b.dataset.t;dirtySet.has(id)?dirtySet.delete(id):dirtySet.add(id);saveDirty();renderList();renderFit(false);
});
const parsePrice=p=>{ if(!p) return 0; const m=String(p).replace(/\./g,"").match(/\d+/); return m?+m[0]:0; };
function zoom(id){
  const it=byId(id); if(!it) return;
  $("#zKind").textContent=CAT[it.cat]; $("#zName").textContent=nm(it);
  $("#zArt").innerHTML=it.img?`<img src="${it.img}" alt="" style="max-width:100%">`:pieceSVG(it);
  $("#zSpec").innerHTML=[["Marka",it.brand||"—"],["Beden",(it.size||"—")+(it.id===101||it.id===109?" · beden referansın":"")],["Kalıp",it.fit?(FITTXT[it.fit]||it.fit):"—"],["Renk",(COL[it.c]||COL.black)[0]],["Not",it.note||"—"],["Durum",isDirty(id)?"Kirli":"Temiz"]].map(([a,b])=>`<div class="rule"><span>${a}</span><p>${b}</p></div>`).join("");
  const n=wearCount(id), price=parsePrice(it.price);
  $("#zExtra").innerHTML=`${it.planned?`<button class="btn solid" data-bought="${id}">Aldım · gardıroba taşı</button>`:""}
    <div class="rules" style="border-top:1px solid var(--line)">
      <div class="rule"><span>Giyildi</span><p>${n} kez${price&&n?` · giyim başı ${Math.round(price/n).toLocaleString("tr-TR")} TL`:price?` · ${price.toLocaleString("tr-TR")} TL`:""}</p></div>
      <div class="rule"><span>Yıkama</span><p>${washText(it)}</p></div>
      <div class="rule"><span>Bakım</span><p>${careText(it)}</p></div></div>
    <label class="btn" style="position:relative;overflow:hidden">${it.img?"Fotoğrafı değiştir":"Kendi fotoğrafını ekle"}<input type="file" accept="image/*" data-photo="${id}" style="position:absolute;inset:0;opacity:0"></label>
    ${photos[id]?`<button class="btn" data-unphoto="${id}">Fotoğrafı kaldır · çizime dön</button>`:""}`;
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
    <div class="b"><span class="label">${x.style}${x.muse?" · "+x.muse:""}</span>${x.parts.some(p=>p.it&&p.it.planned)?`<span><span class="tag cyan">Sepetle</span></span>`:""}<h3>${x.title}</h3><p>${x.v[1]}</p>${x.pin?`<a class="pin" href="${pinURL(x.pin)}" target="_blank" rel="noopener">Pinterest'te gerçek örnek ↗</a>`:""}</div></div>`;}).join("");
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
  ["Farklı ama sade","Tasarımcı kapsülleri · az bilinen modeller",["red","Yeni"],"Herkesin giydiği parçalar yerine: tasarımcı iş birliği kapsülleri (Chavarria, Galliano, Guadagnino × Zara), dokulu kumaş, beklenmedik renk ikilisi (bordo × çikolata) ve az bilinen sneaker modelleri. Logo yok, fark detayda."],
  ["Sade estetik","Ana yön",["red","Her gün"],"Az parça, net kalıp, iki kat. Tek renk ailesi ve tek bir odak noktası. Kapsülün tamamı bunun üstüne kurulu."],
  ["Starboy","The Weeknd",["red","Gece"],"Siyah deri ceket, siyah tişört, tek zincir. Bar, club, konser."],
  ["City Boy","POPEYE · Tokyo",["cyan","Gündüz"],"Uzun kollu tişört, chino, beyaz retro sneaker, şapka. Okul ve kafe."],
  ["Soprano dokunuşu","Tony Soprano",["cyan","Date"],"Triko polo, pileli pantolon, gümüş. Tişörtün bir üst seviyesi."]
];
$("#dirs").innerHTML=DIRS.map(([n,s,[c,t],d])=>`<div class="dir"><div class="t"><h3>${n}</h3><span class="tag ${c}">${t}</span></div><span class="label">${s}</span><p>${d}</p></div>`).join("");

/* trend radar AW26, filtered through his body, skin tone and wardrobe */
const TRENDS=[
  ["ok","Çikolata kahve","Sezonun ana nötrü; siyah gibi taban renk ama daha sıcak.","Sıcak tenine en çok yakışan ton ve gardırobunda hiç yok. İlk alım bu renkte olmalı."],
  ["ok","Quarter-zip triko","TikTok'ta Nike Tech'in yerini alan 'toparlanmış genç' parçası.","Tek kat, yaka boynu toplar; pileli pantolon ve balloon jeanle çalışır. Çikolata ya da krem."],
  ["ok","Bordo / merlot","Nötr ile vurgu arasında; sezonun en önemli rengi.","Bordo ceketin tam trend. Çikolata ile de eşleşir."],
  ["ok","Düşük profil sneaker","adidas BW Army, Taekwondo, Puma Speedcat çizgisi.","Sepetteki siyah Zara retro tam bu."],
  ["ok","Relaxed ama yapılı denim","Baggy devam ediyor ama 2000'ler gibi dağınık değil; koyu yıkama öne çıkıyor.","Balloon jean'in bu çizgide. Sonraki denim: koyu indigo düz paça."],
  ["ok","İnce zincir + mühür yüzük","Cuban/Figaro zincir ve signet yüzük geri döndü; takılar minimal.","Altın gün için altın mühür yüzük: küçük bütçe, büyük fark."],
  ["warn","Süet ceket (özellikle kahve bomber)","Sezonun dokusu; kahve süet bomber her yerde.","Çok yakışır ama zaten 2 ceketin var. Kışa ya da bir sonraki bütçeye."],
  ["warn","Workwear: M-65 field jacket, chore coat","Pinterest'te workwear aramaları +%314.","Tarzına uyar; üçüncü ceket olacağı için sonraya."],
  ["warn","Poetcore: kadife pantolon, messenger çanta","Edebi, eski usul, dokulu parçalar.","Sadece çikolata kadife pantolon senlik; bol gömlek ve balıkçı şapkası değil."],
  ["no","Pudra pembe gömlek","Pinterest'te +%338 arama.","Pastel pembe yüze yakın olunca sıcak teni soldurur. Hoodie'ndeki küçük pembe baskı yeterli."],
  ["no","Kürk yaka, dev palto","Sezonun podyum gösterisi.","90 kg gövdeye hacim ekler; geçiyoruz."],
  ["no","Skinny / dar kesimin dönüşü","Podyumda slim yeniden görünüyor.","Senin kuralın regular-relaxed. Trende kapılıp dar alma."]
];
$("#trends").innerHTML=TRENDS.map(([v,n,w,y])=>`<div class="ic" style="grid-template-columns:1fr"><div class="b"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${n}</h3><span class="cv ${v==="ok"?"":v==="warn"?"warn":"no"}">${v==="ok"?"Sana uyar":v==="warn"?"Sonra":"Atla"}</span></div><p>${w}</p><p style="color:var(--ink)">${y}</p></div></div>`).join("");

/* size lab: his two best-fitting pieces are the reference; every new size chart is compared to them */
const SIZE_REF={
  ust:{id:101,label:"Zara ağır gramaj fitilli tişört · L",ref:"4087/300 · Zara ölçü tablosu",fields:[
    ["A","gogus","Göğüs","Koltuk altından koltuk altına, düz",2,1],
    ["B","boy","Önden uzunluk","Omuz dikişinin en üstünden eteğe",2,1],
    ["C","omuz","Sırt genişliği","Omuz dikişinden omuz dikişine",1.5,1],
    ["D","kol","Kol uzunluğu","Omuz dikişinden kol ucuna",1.5,0],
    ["E","kolg","Kol genişliği","Kol ağzı, düz",1.5,0]]},
  alt:{id:109,label:"Zara yıkanmış balloon jean · EU 42",ref:"6045/306 · Zara ölçü tablosu",fields:[
    ["A","bel","Bel","Bel bandı, düz, uçtan uca",1.5,1],
    ["B","basen","Basen","Kalçanın en geniş yeri, düz",3,0],
    ["C","onbel","Önden bel yüksekliği","Bel bandının üstünden ön ağ dikişine",1.5,0],
    ["D","arkabel","Arkadan bel yüksekliği","Arka bel bandından ağ dikişine",2,0],
    ["E","boy","Boy","Bel bandının üstünden paçaya, yan dikiş boyunca",2.5,1],
    ["F","uyluk","Uyluk","Ağın 2 cm altından, tek paça (tabloda varsa)",2.5,0],
    ["G","paca","Paça","Paça ağzı, düz (tabloda varsa)",2,0]]}
};
// reference values from Zara's own size chart for 4087/300, size L (regular fit table)
const SIZE_DEFAULT={ust:{gogus:"58",boy:"72",omuz:"49",kol:"20.5",kolg:"22"},alt:{bel:"44",basen:"59",onbel:"33",arkabel:"36.5",boy:"112.5"}};
const _sz=store.get("sizes")||{};
let sizes={ust:{...SIZE_DEFAULT.ust,..._sz.ust},alt:{...SIZE_DEFAULT.alt,..._sz.alt}};
const SZ_LINES={
  ust:[["A",64,140,176,140],["B",150,98,150,250],["C",66,104,174,104],["D",176,106,194,156],["E",191,158,176,166]],
  alt:[["A",76,230,164,230],["B",70,262,170,262],["C",124,226,124,290],["D",136,222,136,294],["E",178,226,168,498],["F",62,310,118,310],["G",78,494,116,494]]
};
function sizeArt(cat){
  const it=byId(SIZE_REF[cat].id), vb=cat==="ust"?"26 62 188 212":"44 216 152 296";
  const body=cat==="ust"?drawTop(it,{}):drawBottom(it);
  const lines=SZ_LINES[cat].map(([k,x1,y1,x2,y2])=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#D0503C" stroke-width="2" stroke-dasharray="4 2"/><circle cx="${x1}" cy="${y1}" r="2.2" fill="#D0503C"/><circle cx="${x2}" cy="${y2}" r="2.2" fill="#D0503C"/><rect x="${(x1+x2)/2-6}" y="${(y1+y2)/2-7}" width="12" height="13" fill="#0B0A0F"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2+3.5}" text-anchor="middle" font-family="Spline Sans Mono,monospace" font-size="10" fill="#F4ECDD">${k}</text>`).join("");
  return `<svg viewBox="${vb}" aria-hidden="true">${body}${lines}</svg>`;
}
let szCat="ust";
function renderSizeLab(){
  const R=SIZE_REF[szCat], mine=sizes[szCat]||{};
  const filled=R.fields.filter(f=>mine[f[1]]).length;
  $("#szSeg").innerHTML=[["ust","Üst · tişört"],["alt","Alt · jean"]].map(([k,n])=>`<button class="${szCat===k?"on":""}" data-sz="${k}">${n}</button>`).join("");
  $("#szBody").innerHTML=`<div class="szgrid"><div class="zoom szart">${sizeArt(szCat)}</div><div class="col">
     <span class="label" style="padding:10px 12px 4px">Referans · ${R.label} · ${R.ref}</span>${szCat==="ust"?`<span class="label" style="padding:0 12px 6px;color:var(--ok)">Zara tablosundan girildi · regular fit, L</span>`:`<span class="label" style="padding:0 12px 6px;color:var(--ok)">Zara tablosundan girildi · EU 42 · uyluk ve paça tabloda yok</span>`}
     ${R.fields.map(([k,f,n,h])=>`<label class="szrow"><b>${k}</b><span><span>${n}</span><small>${h}</small></span><input inputmode="decimal" data-f="${f}" value="${mine[f]??""}" placeholder="cm" aria-label="${n} referans"></label>`).join("")}
     <span class="label" style="padding:8px 12px" id="szCount">${filled}/${R.fields.length} ölçü girildi · düz zeminde, cm</span></div></div>
   <div class="szcmp"><span class="label">Yeni ürünün beden tablosu · aynı ölçüler</span>
     <div class="szin">${R.fields.map(([k,f,n])=>`<label><span>${k} · ${n}</span><input inputmode="decimal" data-c="${f}" placeholder="cm"></label>`).join("")}</div>
     <p class="note" style="margin-top:8px;font-size:12px;color:var(--ink-3)">Tablo tam çevre veriyorsa (ör. bel 84 cm) ikiye bölüp yaz.</p>
     <div id="szOut"></div></div>`;
}
function compareSize(){
  const R=SIZE_REF[szCat], mine=sizes[szCat]||{}, rows=[]; let tight=0, loose=0, used=0;
  $("#szBody").querySelectorAll("[data-c]").forEach(inp=>{
    const f=inp.dataset.c, v=parseFloat(inp.value.replace(",",".")), ref=parseFloat(mine[f]);
    const d=R.fields.find(x=>x[1]===f); if(isNaN(v)||isNaN(ref)) return;
    const diff=+(v-ref).toFixed(1), tol=d[4], key=d[5]; used++;
    let st="ok", txt="Aynı his";
    if(diff< -tol){ st="no"; txt=szCat==="ust"?"Dar / kısa":"Dar / kısa"; if(key) tight++; }
    else if(diff>tol){ st="warn"; txt="Bol / uzun"; if(key&&diff>2*tol) loose++; }
    rows.push(`<div class="rule"><span>${d[0]} · ${d[2]}</span><p><b class="${st}">${diff>0?"+":""}${diff} cm</b> · ${txt}</p></div>`);
  });
  let dropShoulder=false;
  if(szCat==="ust"){ const g=$("#szBody").querySelector('[data-c="gogus"]'), o=$("#szBody").querySelector('[data-c="omuz"]');
    const dg=parseFloat(g.value)-parseFloat(mine.gogus), dom=parseFloat(o.value)-parseFloat(mine.omuz);
    dropShoulder = !isNaN(dg)&&!isNaN(dom)&&Math.abs(dg)<=3&&dom>5; }
  const verdict = !used ? "" : tight ? ["Bir beden büyük dene","no"] : dropShoulder ? ["Aynı beden · oversize kesim, omuz düşük oturur","warn"] : loose ? ["Bir beden küçük dene","warn"] : ["Bu beden uyar","ok"];
  $("#szOut").innerHTML = used ? `<div class="szv ${verdict[1]}">${verdict[0]}</div><div class="rules" style="border-top:1px solid var(--line)">${rows.join("")}</div>` : "";
}
$("#szSeg").addEventListener("click",e=>{const b=e.target.closest("[data-sz]");if(!b)return;szCat=b.dataset.sz;renderSizeLab();});
$("#szBody").addEventListener("input",e=>{
  const f=e.target.dataset.f; if(f){ sizes[szCat]=sizes[szCat]||{}; sizes[szCat][f]=e.target.value.replace(",","."); store.set("sizes",sizes); const R=SIZE_REF[szCat]; $("#szCount").textContent=`${R.fields.filter(x=>sizes[szCat][x[1]]).length}/${R.fields.length} ölçü girildi · düz zeminde, cm`; }
  compareSize();
});
// body estimate from the references: tee chest 58 flat (116 around, regular ease 8–12) and jean waist 44 flat (88 around, rigid ease ~2)
const BODY=[["Göğüs çevresi","≈ 104–108 cm","Tişört 116 cm − regular pay"],["Bel çevresi","≈ 85–87 cm","Jean 88 cm − esnemeyen pay"],["Bacak boyu","≈ 104–108 cm","178 cm boy için belden yere; mezurayla ölç"]];
const SIZEMAP=[
  ["Zara · üst","L","Referans: göğüs 58 · boy 72 · sırt 49 · kol 20,5. Oversize tablolar (sırt 55+) L'de bile düşük omuz verir."],
  ["Zara · alt","EU 42 · US 32","Referans: bel 44 · basen 59 · ön bel 33 · arka bel 36,5 · boy 112,5."],
  ["Bershka · pileli pantolon","42 · Tall","Vücut tablosunda 42 = bel 86, senin tahmini belin 85–87: tam oturur. 40 (≈ bel 82) dar gelir. Loose boylarında Regular 97, Tall 101: 178 cm için Tall, balloon jean'in gibi hafif kırılır."],
  ["Bershka · bordo ceket","L","Vücut tablosunda L = göğüs 105, senin 104–108 aralığının içinde. Boxy kesim altına hoodie payını zaten veriyor; Bershka da L öneriyor."],
  ["Bershka · triko","L ya da XL","L = göğüs 105, XL = 111. Göğsün 106'nın altındaysa L (tam oturur), üstündeyse XL. Triko dar kesimse XL. Denerken kol ve boy bilekte / kemerde bitmeli."],
  ["Bershka · teknik balloon","L","Lastikli bel: boy belirleyici."],
  ["Ayakkabı","43","Zara, Hummel ve runner'ın 43."],
  ["Kemer","95","Plaka kemer: 42 pantolonlarla uyumlu."]
];
$("#body").innerHTML=BODY.map(([a,b,c])=>`<div class="rule"><span>${a}</span><p><b style="font-weight:500">${b}</b> · ${c}</p></div>`).join("");
$("#sizemap").innerHTML=SIZEMAP.map(([a,b,c])=>`<div class="rule"><span>${a}</span><p><b style="font-weight:500">${b}</b> · ${c}</p></div>`).join("");

/* gym week: 5 sessions, washes on Wednesday and Saturday */
const GYM=[
  ["Pzt","Siyah spor tişörtü 1","Şort 1"],["Sal","Siyah spor tişörtü 2","Şort 2"],["Çar","Beyaz spor tişörtü (hafif gün / kardiyo)","Teknik balloon"],
  ["","Yıkama","Tişörtler + şortlar + çoraplar"],
  ["Per","Siyah spor tişörtü 1","Şort 1"],["Cum","Siyah spor tişörtü 2","Şort 2"],["Cmt","","Yıkama"]
];
$("#gym").innerHTML=GYM.map(([d,t,b])=>`<div class="rule"><span>${d||"—"}</span><p>${t?`<b style="font-weight:500">${t}</b> · `:""}${b}</p></div>`).join("")+
  `<div class="rule"><span>Özet</span><p>Tamam, ek alım gerekmiyor: 3 spor tişörtü + 2 şort + teknik balloon + Hummel, haftada iki yıkamayla 5 günü rahat döndürür. Tek şart: 5 çift spor çorabı, her antrenmandan sonra yıkanır.</p></div>`;

/* capsule */
function renderCapsule(){
  const combos=capsuleCombos(), C=items.filter(i=>i.cat!=="aks"&&!i.sport);
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

const BRANDS=["Zara","Massimo Dutti","Pull&Bear","Bershka","H&M","Decathlon"];
const TIERS=[["eko","Ekonomik"],["den","Dengeli"],["yat","Yatırım"]];
// extras to buy, in priority order; "+N" = new outfits it adds to his current wardrobe
const GAPS=[
  {n:"Krem ağır tişört",v:{cat:"ust",type:"tee",c:"cream",fit:"boxy"},spec:"Saf beyaz yerine krem: sıcak tenini aydınlatır. Boxy, 240 g/m².",worth:false,b:{eko:["H&M","Pull&Bear","Bershka"],den:["Zara"],yat:["Massimo Dutti"]}},
  {n:"Düz koyu straight jean",v:{cat:"alt",type:"jeans",c:"indigo",fit:"regular"},spec:"Altlarının hepsi geniş; hoodie'lerin altına düz paça dengesi.",worth:false,b:{eko:["Pull&Bear","H&M"],den:["Zara"],yat:["Massimo Dutti"]}},
];
const baseN=capsuleCombos().length;
GAPS.forEach((g,i)=>{g.unl=capsuleCombos([...items,{...g.v,id:-1-i,name:g.n}]).length-baseN;g.rank=i+1;});
let tier=store.get("tier")||"den", brand="all";
function renderShop(){
  $("#budgetSeg").innerHTML=TIERS.map(([k,n])=>`<button class="${tier===k?"on":""}" data-tier="${k}">${n}</button>`).join("");
  $("#brandF").innerHTML=[["all","Tümü"],...BRANDS.map(b=>[b,b])].map(([k,n])=>`<button class="${brand===k?"on":""}" data-b="${k}">${n}</button>`).join("");
  const L=GAPS.filter(g=>brand==="all"||g.b[tier].includes(brand)||(g.worth&&g.b.yat.includes(brand))).sort((a,b)=>a.rank-b.rank);
  $("#buy").innerHTML=L.map(g=>`<div class="b-it"><div class="col" style="gap:6px"><span class="label">${String(g.rank).padStart(2,"0")} · öncelik</span><h3>${g.n}</h3>${g.worth?`<span><span class="tag red">Bütçeyi aşmaya değer</span></span>`:""}</div>
    <div class="unl">${g.v.cat==="aks"?`<strong>∞</strong><span class="label">her kombin</span>`:`<strong>+${g.unl}</strong><span class="label">yeni kombin</span>`}</div><p class="spec">${g.spec}</p>
    <div class="brands">${g.b[tier].map(b=>`<span class="tag">${b}</span>`).join("")}${g.worth&&tier!=="yat"?`<span class="tag red">↑ ${g.b.yat.join(", ")}</span>`:""}</div></div>`).join("")||`<p class="empty">Bu marka bu bütçede listede yok.</p>`;
}
$("#budgetSeg").addEventListener("click",e=>{const b=e.target.closest("[data-tier]");if(!b)return;tier=b.dataset.tier;store.set("tier",tier);renderShop();});
$("#brandF").addEventListener("click",e=>{const b=e.target.closest("[data-b]");if(!b)return;brand=b.dataset.b;renderShop();});

/* cart review: what to buy, what later, what to skip */
const CART=[
  {v:"al",id:204,n:"Retro stil spor ayakkabı · siyah",b:"Zara",size:"43",price:2490,it:{cat:"ayak",type:"retro",c:"black",sole:"#C9B48A",stripe:"charcoal"},
   why:"Listenin 2 numarası buydu. İnce taban ve krem taban: pileli pantolon, polo ve balloon jean ile çalışır. Kalın runner'ın yanına ikinci karakter."},
  {v:"al",id:202,n:"Pilili baggy pantolon · siyah",b:"Bershka",size:"42 Tall (40 Regular değil)",price:1990,it:{cat:"alt",type:"trouser",c:"black",pleat:true,fit:"relaxed"},
   why:"Listenin 1 numarası: kumaş pantolon. Beden kesinleşti: Bershka vücut tablosunda 42 = bel 86 cm, seninki ≈ 85–87. 40 dar gelir. Boy olarak Tall (101): 178 cm'de Regular kısa kalır."},
  {v:"al",id:203,n:"Teknik balloon pantolon · siyah",b:"Bershka",size:"L",price:1990,it:{cat:"alt",type:"track",c:"black",fit:"balloon",stripe:"black"},
   why:"Eşofman altı ihtiyacını karşılar: spor, rahat gün, uçak. Siyah olduğu için hoodie'lerinle tonal durur."},
  {v:"al",id:201,n:"Suni deri boxy ceket · bordo",b:"Bershka",size:"L",price:2690,it:{cat:"dis",type:"leather",c:"burgundy",fit:"boxy"},
   why:"Kararın net, doğru da. Bordo sıcak tenine yakışan en iyi renklerden, siyah gardırobuna tek renk odağı olur. En iyi eşleşme: Chavarria polo + pileli pantolon + siyah retro. Kırmızı yazılı bereyle aynı gün takma, iki farklı kırmızı çatışır."},
  {v:"alma",n:"Retro deri spor ayakkabı · lacivert",b:"Zara",size:"44",price:2690,it:{cat:"ayak",type:"retro",c:"navy",sole:"#E6DCC6",stripe:"bone"},
   why:"Güzel ama siyah retroyla aynı işi yapıyor; ikisinden birini al, siyah daha çok kombine uyar. Ayrıca beden 44, diğer ayakkabıların 43."},
  {v:"alma",n:"Teknik balloon pantolon · gri",b:"Bershka",size:"L",price:1990,it:{cat:"alt",type:"track",c:"heather",fit:"balloon",stripe:"heather"},
   why:"Siyahının aynısı. Açık gri alt, baskılı gri hoodie ile birleşince her şey gri olur. Bir tane yeter."}
];
function renderCart(){
  const owned=items.filter(i=>!i.planned), withAl=items.filter(i=>i.planned!=="oneri");
  const now=capsuleCombos(owned).length, after=capsuleCombos(withAl).length;
  const sum=v=>CART.filter(c=>c.v===v).reduce((a,c)=>a+c.price,0), fmt=n=>n.toLocaleString("tr-TR")+" TL", BUDGET=12000, nAl=CART.filter(c=>c.v==="al").length;
  const V={al:["Al","ok"],sonra:["Sonra","warn"],alma:["Alma","no"],oneri:["Önerim","cyan"]};
  $("#cart").innerHTML=`<div class="capbig"><strong>${now}</strong><span class="label">kombin</span><i>→</i><strong>${after}</strong><span class="label">sepetteki ${nAl} parçayla · ${fmt(sum("al"))}</span></div>`+`<div class="budget"><div><span class="label">Bütçe</span><b>${fmt(BUDGET)}</b></div><div><span class="label">Al</span><b>${fmt(sum("al"))}</b></div><div><span class="label">Kalan</span><b>${fmt(BUDGET-sum("al"))}</b></div><div><span class="label">Durum</span><b>Bekliyor</b></div></div>`+
   CART.map(c=>`<div class="ic"><div class="thumb">${pieceSVG(c.it)}</div><div class="b"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${c.n}</h3><span class="cv ${V[c.v][1]}">${V[c.v][0]}</span></div>
     <span class="label">${c.b} · ${c.size} · ${c.range||fmt(c.price)}</span><p>${c.why}</p>${c.id?(byId(c.id)&&byId(c.id).planned?`<button class="state" style="align-self:flex-start;border-color:var(--cyan);color:var(--cyan)" data-bought="${c.id}">Aldım</button>`:`<span class="tag live" style="align-self:flex-start">Gardıropta ✓</span>`):""}</div></div>`).join("")+
   `<div class="ic" style="grid-template-columns:1fr"><p>Sepetinle ${after} kombin. Al listesi ${fmt(sum("al"))}; kalan ${fmt(BUDGET-sum("al"))} şimdilik bekliyor. Spor tarafı tamam; bu para bir sonraki doğru parça çıkana kadar bekliyor.</p></div>`;
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
  ["Markaların kendi kombinleri",[
    ["Bershka · By Influencers","bershka.com/tr","Berkhan'ın kombinleri burada; ekran görüntüsü atarsan sisteme işlerim"],
    ["Zara × Willy Chavarria · Vatísimo","zara.com/tr","Polonun geldiği kapsül: bol pileli pantolon, kapalı yaka, zincir"],
    ["John Galliano × Zara","zara.com/tr","Eylül 2026'dan itibaren: arşiv parçaların sökülüp yeniden kurgulanmış hali, sınırlı"],
    ["Guadagnino & Baisi × Zara","zara.com/tr","26 Eylül 2026: İtalyan sinema şıklığı, triko ve pantolonlar"],
    ["Les Benjamins","lesbenjamins.com","İstanbul çıkışlı lüks streetwear; tek bir odak parça için"]]],
  ["Herkeste olmayan sneakerlar",[
    ["Onitsuka Tiger Serrano","onitsukatiger.com","Samba yorgunluğuna en az bilinen cevap; çikolata ya da bordo süet"],
    ["adidas Taekwondo","adidas.com.tr","adidas'ın bariz olmayan modeli; ince, terlik gibi hat"],
    ["ASICS Skyhand OG","asics.com","Japon salon ayakkabısı, 2026'da yükselişte"]]],
  ["Türkiye · satın almak",[
    ["Zara","zara.com/tr","Retro-style sneakers, worker ceket, triko polo"],
    ["Pull&Bear · Bershka","pullandbear.com/tr","Streetwear temel parçalar, ekonomik"],
    ["Massimo Dutti","massimodutti.com/tr","Yatırım: deri, yün, triko"],
    ["H&M","hm.com/tr","Ağır tişört, hoodie, bomber"],
    ["Trendyol","trendyol.com","Orijinal sneakerlar: Samba, Dunk, New Balance"]]]
];
$("#srcs").innerHTML=SRC.map(([h,l])=>`<div class="src-h label">${h}</div>`+l.map(([n,u,d])=>`<a class="src" href="https://${u}" target="_blank" rel="noopener"><b>${n}</b><span>↗</span><small>${d}</small></a>`).join("")).join("");

/* ================= 整 · bakım: profil, rutin, takip ================= */
const ZC=window.ZenonCare;
let careProfile=store.get("care.profile"); if(careProfile){ if(careProfile.minimal===undefined){ careProfile.minimal=true; store.set("care.profile",careProfile); } careProfile=ZC.normProfile(careProfile); }   // v8: sade rutin varsayılan
let careState=store.get("care.state")||{};
careState.done=ZC.pruneDone(careState.done||{},TODAY); careState.tips=careState.tips||{};
let wxDays=store.get("wxDays")||{}, careEditing=false, careWarn=false;
let syncPush=()=>{};                                  // bildirim istemcisi bunu değiştirir
const saveCare=()=>store.set("care.state",careState);
const careDay=(date=TODAY)=>ZC.buildDay(careProfile,date,wxDays[date]||null,careState);
const escH=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const dayName=s=>["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][new Date(s+"T12:00").getDay()]+" "+s.slice(8)+"."+s.slice(5,7);
const ISSUES=[["acne","Sivilce"],["blackheads","Siyah nokta"],["marks","Akne izi / leke"],["pores","Geniş gözenek"],["redness","Kızarıklık"],["darkcircles","Göz altı morluğu"],["dryness","Kuruluk"],["ingrown","Batık kıl"],["backacne","Sırt sivilcesi"]];
const SKINS=[["oily","Yağlı"],["combo","Karma"],["normal","Normal"],["dry","Kuru"],["sensitive","Hassas"]];
const BEARDS=[["clean","Tam tıraş"],["stubble","Kirli sakal"],["short","Kısa sakal"],["full","Uzun sakal"]];
const careOpts=(list,v)=>list.map(([k,n])=>`<option value="${k}" ${String(k)===String(v)?"selected":""}>${n}</option>`).join("");
const chk=(name,val,on,label)=>`<label><input type="checkbox" name="${name}" value="${val}" ${on?"checked":""}>${label}</label>`;

function renderSurvey(src){
  const p=ZC.normProfile(src||careProfile), t=p.times;
  $("#careSurvey").innerHTML=`<form class="sec survey" id="careForm">
    <div class="sec-h"><span class="label">Bakım profili · 2 dakika</span><button type="button" class="btn" id="carePreset" style="flex:0 0 auto;height:34px;padding:0 10px">Koçun analizini uygula</button></div>
    <label class="field"><span class="label">Cilt tipi · yıkadıktan 1 saat sonra: her yer parlıyorsa yağlı, yalnız alın-burun parlıyorsa karma, geriliyorsa kuru, kolay kızarıyorsa hassas</span><select name="skin">${careOpts(SKINS,p.skin)}</select></label>
    <div class="field"><span class="label">Sorunlar · birden fazla seçebilirsin</span><div class="chips">${ISSUES.map(([k,n])=>chk("issues",k,p.issues.includes(k),n)).join("")}</div></div>
    <label class="field"><span class="label">Sakal</span><select name="beard">${careOpts(BEARDS,p.beard.style)}</select></label>
    <label class="field"><span class="label">Sakal yoğunluğu</span><select name="density">${careOpts([["sparse","Seyrek"],["medium","Orta"],["dense","Sık"]],p.beard.density)}</select></label>
    <label class="field"><span class="label">Saç yapısı</span><select name="hairType">${careOpts([["straight","Düz"],["wavy","Dalgalı"],["curly","Kıvırcık"]],p.hair.type)}</select></label>
    <div class="field"><span class="label">Saç derisi</span><div class="chips">${chk("oilyScalp",1,p.hair.oilyScalp,"Çabuk yağlanıyor")}${chk("dandruff",1,p.hair.dandruff,"Kepek")}${chk("thinning",1,p.hair.thinning,"Dökülme endişesi")}</div></div>
    <label class="field"><span class="label">Son berber</span><input type="date" name="lastCut" value="${p.hair.lastCut||""}"></label>
    <label class="field"><span class="label">Terleme</span><select name="sweat">${careOpts([["low","Az"],["mid","Orta"],["high","Çok"]],p.sweat)}</select></label>
    <div class="field"><span class="label">Hafta içi · kalkış / yatış</span><div class="times"><input type="time" name="wdWake" value="${t.weekday.wake}" required><input type="time" name="wdSleep" value="${t.weekday.sleep}" required></div></div>
    <div class="field"><span class="label">Hafta sonu · kalkış / yatış</span><div class="times"><input type="time" name="weWake" value="${t.weekend.wake}" required><input type="time" name="weSleep" value="${t.weekend.sleep}" required></div></div>
    <div class="field"><span class="label">Spor günleri ve saati</span><div class="chips">${DAYS.map(([d,n])=>chk("gymDays",d,t.gymDays.includes(d),n)).join("")}</div><input type="time" name="gym" value="${t.gym}"></div>
    <label class="field"><span class="label">Sabah ayırabildiğin süre</span><select name="amMinutes">${careOpts([[2,"2 dakika"],[5,"5 dakika"],[10,"10 dakika"]],p.amMinutes)}</select></label>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="minimal" ${p.minimal!==false?"checked":""}><span>Sade rutin: yalnız listedeki temel ürünler (sabah 3, akşam en çok 3 adım)</span></label>
    <label class="field"><span class="label">Bütçe</span><select name="budget">${careOpts(TIERS,p.budget)}</select></label>
    <label class="field"><span class="label">Şu an kullandığın ürünler</span><textarea class="note-in" name="products" rows="2" placeholder="Örn. Nivea krem, Gillette jilet">${escH(p.currentProducts)}</textarea></label>
    <div class="row-btns"><button class="btn solid" type="submit">Kaydet · rutinimi hazırla</button>${careProfile?`<button class="btn" type="button" id="careCancel">Vazgeç</button>`:""}</div>
  </form>`;
}
const ckRow=(kind,s,on)=>`<button type="button" class="ck ${on?"on":""}" data-ck="${kind}:${s.id}" aria-pressed="${on}"><i>${on?"✓":""}</i><p>${s.label}${prodFor(s.id)}<small>${s.why}</small></p></button>`;
function renderCare(){
  const survey=!careProfile||careEditing;
  $("#careSurvey").style.display=survey?"":"none"; $("#careMain").style.display=survey?"none":"";
  if(survey) renderSurvey();
  renderCareMini(); renderCareLog();
  if(survey){ renderTodo(); return; }
  const d=careDay(), dn=careState.done[TODAY]||{}, on=(k,id)=>(dn[k]||[]).includes(id);
  $("#careSub").textContent=`${ZK.forgivingStreak(careState.done,TODAY,true)} GÜN SERİ · ${d.active==="retinoid"?"RETİNOİD GECESİ":d.active==="bha"?"BHA GECESİ":"DİNLENME GECESİ"}`;
  $("#careAm").innerHTML=d.am.map(s=>ckRow("am",s,on("am",s.id))).join("");
  $("#carePm").innerHTML=d.pm.map(s=>ckRow("pm",s,on("pm",s.id))).join("");
  $("#careAmN").textContent=`${d.am.filter(s=>on("am",s.id)).length}/${d.am.length}`;
  $("#carePmN").textContent=`${d.pm.filter(s=>on("pm",s.id)).length}/${d.pm.length}`;
  const tasks=[...d.weekly,...d.extras];
  $("#careTasks").innerHTML=tasks.length?tasks.map(s=>ckRow("tasks",s,on("tasks",s.id))).join(""):`<p class="empty">Bugün ek görev yok.</p>`;
  $("#careNotes").innerHTML=(d.notes.length?d.notes:["Hava verisi gelince UV ve nem notları burada."]).map(n=>`<div class="rule"><span>Not</span><p>${n}</p></div>`).join("");
  const tip=careTip(); $("#careTip").innerHTML=`${tip.t} <span class="label">· ${tip.src}</span>`;
  $("#careWeek").innerHTML=ZC.buildWeek(careProfile,TODAY,wxDays,careState).map(x=>`<div class="rule"><span>${dayName(x.date)}</span><p>${[x.active==="retinoid"?"Retinoid gecesi":x.active==="bha"?"BHA gecesi":"Aktif yok",...x.weekly.map(t=>t.label)].join(" · ")}</p></div>`).join("");
  $("#careDoc").textContent=ZC.doctorNote(careProfile)||"";
  renderTodo();
}
function careTip(){
  const tip=ZC.pickTip(careProfile,TODAY,careState.tips);
  if(careState.tips[TODAY]!==tip.id){ const from=ZC.addDays(TODAY,-30);
    careState.tips=Object.fromEntries(Object.entries(careState.tips).filter(([k])=>k>=from)); careState.tips[TODAY]=tip.id; saveCare(); }
  return tip;
}
function renderCareMini(){
  const el=$("#careMini");
  if(!careProfile){ el.innerHTML=`<div class="sec-h"><span class="label">Bakım</span></div><div class="row-btns" style="margin:0"><button class="btn solid" data-go="care">整 Bakım profilini doldur · 2 dk</button></div>`; return; }
  const d=careDay(), dn=careState.done[TODAY]||{};
  const left=d.am.filter(s=>!(dn.am||[]).includes(s.id)).length+d.pm.filter(s=>!(dn.pm||[]).includes(s.id)).length;
  const next=!dn.amAll?"Sabah rutini":!dn.pmAll?"Akşam rutini":"Bugün tamam ✓";
  el.innerHTML=`<div class="sec-h"><span class="label">Bugünün bakımı</span><span class="label">${left} adım kaldı</span></div>
    <div class="row-btns" style="margin:0"><button class="btn solid" data-go="care">${next} →</button></div>
    <p class="label" style="margin-top:8px;text-transform:none;letter-spacing:.02em">${careTip().t}</p>
    ${careWarn?`<p class="label" style="color:var(--red);margin-top:6px">Bildirim planı gönderilemedi, rutin ekranda</p>`:""}`;
}
function renderCareLog(){
  if(!careProfile){ $("#careHist").innerHTML=`<p class="empty">Bakım profili doldurulunca burada görünür.</p>`; $("#careStreak").textContent=""; return; }
  const cells=Array.from({length:14},(_,i)=>{ const k=ZC.addDays(TODAY,i-13), x=careState.done[k]||{}, full=x.amAll&&x.pmAll, half=!full&&(x.amAll||x.pmAll);
    return `<span class="cal ${full?"on":""} ${k===TODAY?"today":""}" title="${k}${full?" · tamam":half?" · yarım":""}" style="${half?"opacity:.55":""}">${+k.slice(8)}</span>`; }).join("");
  $("#careHist").innerHTML=`<div class="calgrid">${cells}</div>`;
  $("#careStreak").textContent=`${ZK.forgivingStreak(careState.done,TODAY,true)} gün seri (tek kaçırma affedilir)`;
}
document.addEventListener("submit",e=>{
  if(e.target.id!=="careForm") return; e.preventDefault();
  const f=new FormData(e.target), g=k=>f.get(k);
  const prevProfile=careProfile;
  careProfile=ZC.normProfile({skin:g("skin"),issues:f.getAll("issues"),beard:{style:g("beard"),density:g("density")},
    hair:{type:g("hairType"),oilyScalp:!!g("oilyScalp"),dandruff:!!g("dandruff"),thinning:!!g("thinning"),lastCut:g("lastCut")||null},
    sweat:g("sweat"),times:{weekday:{wake:g("wdWake"),sleep:g("wdSleep")},weekend:{wake:g("weWake"),sleep:g("weSleep")},gymDays:f.getAll("gymDays").map(Number),gym:g("gym")||"18:00"},
    amMinutes:+g("amMinutes"),budget:g("budget"),currentProducts:(g("products")||"").trim(),minimal:!!g("minimal")});
  store.set("care.profile",careProfile);
  careState.retinoidStart=ZC.retinoidStartFor(prevProfile,careProfile,careState.retinoidStart,TODAY); saveCare();
  careEditing=false; renderCare(); window.scrollTo({top:0}); toast("Rutinin hazır"); syncPush();
});
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]"); if(go) goView(go.dataset.go);
  if(e.target.closest("#careEdit")){ careEditing=true; renderCare(); window.scrollTo({top:0}); }
  if(e.target.closest("#careCancel")){ careEditing=false; renderCare(); }
  if(e.target.closest("#carePreset")){ renderSurvey(window.ZenonPlan.PRESET); toast("Fotoğraf analizine göre dolduruldu; kontrol edip kaydet"); return; }
  const b=e.target.closest("[data-ck]"); if(!b) return;
  const [kind,id]=b.dataset.ck.split(":"), dn=careState.done[TODAY]||(careState.done[TODAY]={});
  ["am","pm","tasks"].forEach(k=>dn[k]=dn[k]||[]);
  const i=dn[kind].indexOf(id); if(i>=0) dn[kind].splice(i,1); else dn[kind].push(id);
  const d=careDay(); dn.amAll=d.am.every(s=>dn.am.includes(s.id)); dn.pmAll=d.pm.every(s=>dn.pm.includes(s.id));
  if(kind==="tasks"&&id==="barber"&&i<0){ careProfile.hair.lastCut=TODAY; store.set("care.profile",careProfile); }
  saveCare(); renderCare(); syncPush();
});
function goView(v){ const t=document.querySelector(`.tab[data-view="${v}"]`); if(t) t.click(); }
window.addEventListener("hashchange",()=>goView(location.hash.slice(1)));
// Ana ekrandaki uygulama gece boyunca açık kalabilir: gün değiştiyse TODAY ve rutinler için yeniden yükle.
const dayCheck=()=>{ if(document.visibilityState==="visible"&&iso(new Date())!==TODAY) location.reload(); };
document.addEventListener("visibilitychange",dayCheck); window.addEventListener("focus",dayCheck);

/* 整 · bildirimler: Seneca sunucusu üzerinden Web Push. Sunucu yalnız hatırlatma metnini ve saatini görür. */
let pushCfg=store.get("care.push");                    // {cihaz, token, on}
let srvReady=null;
const randHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,"0")).join("");
const pushOk=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const iOS=/iPad|iPhone|iPod/.test(navigator.userAgent), standalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pushLive=()=>!!(pushCfg&&pushCfg.on&&pushOk()&&Notification.permission==="granted");
const b64u=s=>{ const r=atob((s+"=".repeat((4-s.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(r,c=>c.charCodeAt(0)); };
async function zapi(path,opt={}){
  const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),8000);
  const h={"Content-Type":"application/json"}; if(pushCfg){ h["X-Zenon-Cihaz"]=pushCfg.cihaz; h["X-Zenon-Token"]=pushCfg.token; }
  try{ const r=await fetch(`${ZC.SRV}/zenon/api/${path}`,{...opt,headers:h,signal:ctl.signal}); if(!r.ok) throw new Error(r.status); return await r.json(); }
  finally{ clearTimeout(tm); }
}
async function renderPush(){
  const st=$("#pushState"), msg=$("#pushMsg"), on=$("#pushOn"), test=$("#pushTest");
  const off=(s,m)=>{ st.textContent=s; msg.textContent=m; on.disabled=true; test.disabled=true; };
  if(!pushOk()||(iOS&&!standalone())) return off("kapalı","Bildirim için: Safari → Paylaş → Ana Ekrana Ekle, sonra Zenon'u ana ekrandaki simgeden aç.");
  if(srvReady===null) srvReady=await zapi("saglik").then(()=>true,()=>false);
  if(!srvReady) return off("yakında","Bildirim sunucusu henüz hazır değil. Rutin yine burada; sunucu açılınca bu düğme çalışır.");
  const live=pushLive(); st.textContent=live?"açık":"kapalı"; on.disabled=false; test.disabled=!live;
  on.textContent=live?"Bildirimleri kapat":"Bildirimleri aç";
  msg.textContent=live?"Sabah, akşam ve görev hatırlatmaları önümüzdeki 7 gün için planlandı.":"Rutin saatlerinde telefonuna bildirim gelir.";
}
async function syncPushNow(){
  if(!pushLive()||!careProfile) return;
  const week=ZC.buildWeek(careProfile,TODAY,wxDays,careState);
  try{ await zapi("plan",{method:"PUT",body:JSON.stringify({hatirlatmalar:ZC.reminders(careProfile,week,careState,new Date(),pushExtra())})}); careWarn=false; }
  catch(e){ careWarn=true; }
  renderCareMini();
}
let syncT=0; syncPush=()=>{ clearTimeout(syncT); syncT=setTimeout(syncPushNow,1500); };
async function pushEnable(){
  try{
    if(await Notification.requestPermission()!=="granted"){ toast("Bildirim izni verilmedi"); return renderPush(); }
    const reg=await navigator.serviceWorker.ready, key=(await zapi("anahtar")).public;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
    pushCfg={cihaz:(pushCfg&&pushCfg.cihaz)||randHex(32),token:(pushCfg&&pushCfg.token)||randHex(32),on:false};
    store.set("care.push",pushCfg);                       // yanıt kaybolsa da aynı kimlik yeniden kullanılır
    await zapi("abone",{method:"POST",body:JSON.stringify({cihaz:pushCfg.cihaz,token:pushCfg.token,subscription:sub.toJSON()})});
    pushCfg.on=true; store.set("care.push",pushCfg); await syncPushNow(); toast("Bildirimler açık");
  }catch(e){ toast("Bildirim açılamadı"); }
  renderPush();
}
async function pushDisable(){
  try{ await zapi("plan",{method:"PUT",body:JSON.stringify({hatirlatmalar:[]})}); }
  catch(e){ toast("Kapatılamadı: bağlantıyı kontrol edip tekrar dene"); return; }
  pushCfg.on=false; store.set("care.push",pushCfg); renderPush(); toast("Bildirimler kapandı");
}
$("#pushOn").addEventListener("click",()=>pushLive()?pushDisable():pushEnable());
$("#pushTest").addEventListener("click",()=>zapi("test",{method:"POST"}).then(()=>toast("Test bildirimi gönderildi"),()=>toast("Gönderilemedi")));

/* ================= 師 · koç: yapılacaklar, check-in, ilerleme, aylık liste ================= */
const ZK=window.ZenonCoach, ZPL=window.ZenonPlan;
const keepFrom=(o,days)=>{ const from=ZC.addDays(TODAY,-days); return Object.fromEntries(Object.entries(o||{}).filter(([k])=>k>=from)); };
let coachLog=keepFrom(store.get("coach.log"),120), coachTodo=keepFrom(store.get("coach.todo"),14), coachSeen=keepFrom(store.get("coach.seen"),30);
let coachStart=store.get("coach.start"); if(!coachStart){ coachStart=TODAY; store.set("coach.start",coachStart); }
let bought=store.get("coach.bought")||{}, boughtAs=store.get("coach.boughtAs")||{};
function monthItems(){ const M=ZPL.MONTHS; return M[TODAY.slice(0,7)]||M[Object.keys(M).sort().pop()]||[]; }
function prodFor(stepId){ const i=monthItems().find(x=>bought[x.id]&&(x.care||[]).includes(stepId)); return i?` · <em>${escH((boughtAs[i.id]||i.name).split(" (")[0].split(":").pop().trim().split(" ").slice(0,3).join(" "))}</em>`:""; }
const perfLabel=p=>`${p.brand} ${p.name}`;
function buyOptions(i){ if(i.choices) return i.choices.map(id=>ZPL.PERFUMES.find(p=>p.id===id)).filter(Boolean).map(p=>[perfLabel(p),`${perfLabel(p)} · ${p.store} · ${p.priceTL.toLocaleString("tr-TR")} TL`]).concat((i.alt||[]).map(a=>[a.name,a.name]));
  return (i.alt||[]).length?[[i.name,i.name+" (asıl ürün)"],...i.alt.map(a=>[a.name,a.name+" (alternatif)"])]:null; }
function coachCtx(date=TODAY){ return {date, care:careProfile?careDay(date):null, careDone:careState.done[date]||{}, doneMap:careState.done, log:coachLog,
  todo:coachTodo[date]||{}, items:monthItems(), bought, owned:store.get("coach.owned")||ZPL.OWNED.map(o=>o.id), coachStart, ifthen, events, profile:careProfile, seen:date===TODAY?Object.fromEntries(Object.entries(coachSeen).filter(([k])=>k!==TODAY)):coachSeen}; }
const TONE={sert:["鬼","Sert"],motive:["炎","Motive"],sakaci:["笑","Şakacı"],bilgi:["知","Bilgi"]};
const ckHTML=t=>`<button type="button" class="ck ${t.done?"on":""}" data-todo="${t.id}" aria-pressed="${t.done}"><i>${t.done?"✓":""}</i><p>${escH(t.label)}<small>${escH(t.detail||"")}</small></p></button>`;
const nowMin=()=>{ const d=new Date(); return d.getHours()*60+d.getMinutes(); };
let avail=keepFrom(store.get("coach.avail"),14);
const AV=[["sabah","Sabah","08:00","10:00"],["ogle","Öğle","12:00","14:00"],["ikindi","İkindi","15:00","17:00"],["aksam","Akşam","17:30","20:00"],["gece","Gece","20:00","22:30"],["ozel","Özel saat",null,null]];
function renderNow(list){
  const d=new Date(), h=d.getHours(), done=list.filter(t=>t.done).length, pct=list.length?Math.round(done/list.length*100):0;
  $("#nowDate").textContent=d.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"});
  $("#nowHi").textContent=done===list.length&&list.length?"Bugün tamam 🎉":h<11?"Günaydın":h<17?"İyi günler":h<22?"İyi akşamlar":"İyi geceler";
  $("#nowRing").style.setProperty("--p",pct); $("#nowRing").innerHTML=`<b>${done}/${list.length}</b>`;
  const wins=ZK.dayPlan(list,careProfile,TODAY,avail[TODAY]||null), w=ZK.nowWindow(wins,nowMin()), open=w?w.items.filter(t=>!t.done):[];
  $("#nowWin").innerHTML=!w?"":open.length?`<span class="when">ŞİMDİ · ${w.from}–${w.to}</span><h2>${escH(w.title)}</h2>${open.slice(0,3).map(ckHTML).join("")}${open.length>3?`<p class="label" style="margin-top:6px">+${open.length-3} görev aşağıda</p>`:""}`
    :`<p class="done-all">Bütün görevler bitti. Check-in'i unutma, yarın görüşürüz.</p>`;
  const a=avail[TODAY], k=a?(AV.find(x=>x[2]===a.from&&x[3]===a.to)||["ozel"])[0]:null;
  $("#availChips").innerHTML=AV.map(([id,n,f,t])=>`<button type="button" data-av="${id}" class="${k===id?"on":""}">${n}<small>${f?`${f}–${t}`:(k==="ozel"&&a?`${a.from}–${a.to}`:"kendin seç")}</small></button>`).join("");
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-av]"); if(!b) return; const x=AV.find(a=>a[0]===b.dataset.av);
  if(x[0]==="ozel"){ const c=$("#availCustom"); c.hidden=!c.hidden; const a=avail[TODAY]; $("#avFrom").value=a?a.from:"18:00"; $("#avTo").value=a?a.to:"20:00"; return; }
  const a=avail[TODAY]; if(a&&a.from===x[2]&&a.to===x[3]) delete avail[TODAY]; else avail[TODAY]={from:x[2],to:x[3]};
  store.set("coach.avail",avail); renderTodo(); syncPush(); toast(avail[TODAY]?`Müsait: ${avail[TODAY].from}–${avail[TODAY].to} · esnek işler buraya`:"Müsait saat kaldırıldı"); });
$("#avSave").addEventListener("click",()=>{ const f=$("#avFrom").value, t=$("#avTo").value; if(!f||!t||t<=f) return toast("Bitiş başlangıçtan sonra olmalı");
  avail[TODAY]={from:f,to:t}; store.set("coach.avail",avail); $("#availCustom").hidden=true; renderTodo(); syncPush(); toast(`Müsait: ${f}–${t}`); });
setInterval(()=>{ if(document.visibilityState==="visible") renderTodo(); },5*60*1000);
function renderTodo(){
  if(!$("#todo")) return;
  const list=ZK.todayTodos(coachCtx()), done=list.filter(t=>t.done).length;
  renderNow(list);
  const nextEv=events.filter(e=>e.date>=TODAY&&ZC.daysBetween(TODAY,e.date)<=14).sort((a,b)=>a.date.localeCompare(b.date))[0];
  $("#todoCount").textContent=(nextEv?`${(ZPL.EVENTS[nextEv.type]||ZPL.EVENTS.diger).name} · ${ZC.daysBetween(TODAY,nextEv.date)===0?"bugün":ZC.daysBetween(TODAY,nextEv.date)+" gün"} · `:"")+`${done}/${list.length}`; $("#todoBar").style.width=`${Math.round(done/list.length*100)}%`;
  const wins=ZK.dayPlan(list,careProfile,TODAY,avail[TODAY]||null), cur=ZK.nowWindow(wins,nowMin());
  $("#todo").innerHTML=wins.map(w=>`<div class="win ${cur&&w.id===cur.id?"cur":""} ${w.items.every(t=>t.done)?"fin":""}"><div class="win-h"><b>${escH(w.title)}</b><span>${w.from}–${w.to}</span></div>${w.items.map(ckHTML).join("")}</div>`).join("");
  const n=ZK.coachNote(coachCtx());
  if(coachSeen[TODAY]!==n.id){ coachSeen[TODAY]=n.id; store.set("coach.seen",coachSeen); }
  const [k,tn]=TONE[n.tone]||TONE.bilgi;
  $("#coachNote").innerHTML=`<span class="tone tone-${n.tone}"><b>${k}</b>${tn}</span><p>${escH(n.text)}</p>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-todo]"); if(!b) return;
  const id=b.dataset.todo;
  if(id==="am"||id==="pm"||id==="recovery"){ goView("care"); return; }
  if(id==="ifthen"){ goView("log"); setTimeout(()=>{ const f=$("#ifForm"); if(f) f.scrollIntoView({block:"center"}); },450); return; }
  if(id==="checkin"){ openCheckin(); return; }
  if(id.startsWith("shop:")){ shopSub="bakim"; store.set("shopSub",shopSub); renderShopSub(); goView("shop"); setTimeout(()=>{ const d=document.querySelector(`#monthList details[data-id="${id.slice(5)}"]`); if(d){ d.open=true; d.scrollIntoView({block:"center"}); } },450); return; }
  const t=coachTodo[TODAY]||(coachTodo[TODAY]={}); t[id]=!t[id]; store.set("coach.todo",coachTodo); renderTodo(); syncPush();
  if(id==="review"&&t[id]) goView("log");
});
/* check-in */
const CI_SKIN=[["temiz","Temiz"],["sivilce","Yeni sivilce"],["kizarik","Kızarıklık"],["kuru","Kuruluk"],["tahris","Tıraş tahrişi"]];
let ciMood=3;
function renderMood(){ $("#ciMood").innerHTML=[1,2,3,4,5].map(m=>`<button type="button" data-mood="${m}" class="${m===ciMood?"on":""}" aria-label="Ruh hali ${m}">${["😞","😕","😐","🙂","😄"][m-1]}</button>`).join(""); }
function openCheckin(){
  const e=coachLog[TODAY]||{}, v=x=>x==null?"":x;
  $("#ciSleep").value=v(e.sleep); $("#ciWeight").value=v(e.weight); $("#ciWaist").value=v(e.waist); $("#ciSteps").value=v(e.steps); $("#ciProtein").value=v(e.protein); $("#ciWater").value=v(e.water);
  $("#ciPuff").value=String(e.puff||0); $("#ciWorkout").value=(e.workout||(e.workout==null&&(coachTodo[TODAY]||{}).workout))?"1":"";
  $("#ciSkin").innerHTML=CI_SKIN.map(([k,n])=>chk("ciSkin",k,(e.skin||[]).includes(k),n)).join("");
  ciMood=e.mood||3; renderMood(); $("#ciNote").value=e.note||""; openSheet("#checkinSheet");
}
$("#ciMood").addEventListener("click",e=>{ const b=e.target.closest("[data-mood]"); if(b){ ciMood=+b.dataset.mood; renderMood(); } });
$("#checkinSheet").addEventListener("submit",e=>{
  e.preventDefault();
  const num=id=>{ const x=$(id).value.trim().replace(",","."); return x===""||isNaN(+x)?null:+x; };
  const prev=coachLog[TODAY]||{}, st=num("#ciSteps"), keepAuto=st==null||(prev.stepsAuto&&st===prev.steps);
  coachLog[TODAY]={ci:true,stepsAuto:!!(prev.stepsAuto&&keepAuto),sleep:num("#ciSleep"),weight:num("#ciWeight"),waist:num("#ciWaist"),steps:st==null&&prev.stepsAuto?prev.steps:st,protein:num("#ciProtein"),water:num("#ciWater"),
    workout:$("#ciWorkout").value==="1",puff:+$("#ciPuff").value,skin:[...document.querySelectorAll("#ciSkin input:checked")].map(x=>x.value),note:$("#ciNote").value.trim(),mood:ciMood};
  store.set("coach.log",coachLog); closeSheet(); renderTodo(); renderProgress(); renderMeals(); renderBodyGuides(); syncPush(); toast("Check-in kaydedildi");
});
/* ilerleme */
function adherence(){ let n=0; for(let i=1;i<=7;i++){ const x=careState.done[ZC.addDays(TODAY,-i)]; if(x&&x.amAll&&x.pmAll) n++; } return Math.round(n/7*100); }
function renderProgress(){
  const days=56, pts=[];
  for(let i=days-1;i>=0;i--){ const a=ZK.avgWeight(coachLog,ZC.addDays(TODAY,-i)); if(a!=null) pts.push([days-1-i,a]); }
  if(pts.length<2) $("#progress").innerHTML=`<p class="empty">Check-in'de sabah kilonu yazdıkça 7 günlük ortalama burada çizilir. Tek güne değil eğilime bak.</p>`;
  else {
    const ys=pts.map(q=>q[1]), lo=Math.min(...ys)-0.3, hi=Math.max(...ys)+0.3, W=340, H=120, X=i=>8+i/(days-1)*(W-16), Y=v=>H-12-(v-lo)/(hi-lo)*(H-26);
    $("#progress").innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="7 günlük ortalama kilo, son 8 hafta"><line x1="8" x2="${W-8}" y1="${H-12}" y2="${H-12}" class="ax"/><polyline class="ln" points="${pts.map(([i,v])=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/><text x="8" y="11" class="tx">${hi.toFixed(1)} kg</text><text x="8" y="${H-16}" class="tx">${lo.toFixed(1)} kg</text><text x="${W-8}" y="${H-16}" class="tx" text-anchor="end">bugün</text></svg>`;
  }
  const w=ZK.weeklyReview(coachLog,TODAY), f=(x,d=1)=>x==null?"—":x.toFixed(d).replace(".",",");
  $("#progressNote").textContent=w.verdict?`Bu hafta: ${w.verdict}`:"";
  $("#weekly").innerHTML=[["Ortalama",`${f(w.avg)} kg`],["Değişim",w.deltaKg==null?"İki haftada en az 3+3 gün tartıl":`${w.deltaKg>0?"+":""}${f(w.deltaKg,2)} kg/hafta · hedef −0,6 kg`],
    ["Uyku",`${f(w.sleepAvg)} saat`],["Adım",w.stepsAvg==null?"—":Math.round(w.stepsAvg).toLocaleString("tr-TR")],["Bel",(()=>{ const b=Object.entries(coachLog).filter(([,x])=>x&&x.waist).sort((p,q)=>p[0].localeCompare(q[0])); return b.length?`${b[b.length-1][1].waist} cm`+(b.length>1?` (ilk ${b[0][1].waist} cm)`:""):"Haftada bir check-in'e yaz"; })()],["Rutin uyum",`%${adherence()} (son 7 gün)`],["Koç",w.actions.join(" ")||"Aynen devam."]]
    .map(([a,b])=>`<div class="rule"><span>${a}</span><p>${escH(b)}</p></div>`).join("");
  $("#programAdvice").innerHTML=`<b style="font-weight:500">Antrenman (Aurelius programın):</b><br>`+ZPL.PROGRAM.advice.map(a=>"· "+escH(a)).join("<br>");
}
/* alınacaklar: alt sekme, sıradaki adımlar, parfüm rehberi */
let shopSub=store.get("shopSub")||"bakim", perfStore=store.get("perfStore")||"all";
function renderShopSub(){ document.querySelectorAll("#shopSeg [data-sub]").forEach(b=>b.classList.toggle("on",b.dataset.sub===shopSub)); document.querySelectorAll("#shop .sec[data-sub]").forEach(x=>{ x.hidden=x.dataset.sub!==shopSub; }); }
$("#shopSeg").addEventListener("click",e=>{ const b=e.target.closest("[data-sub]"); if(!b) return; shopSub=b.dataset.sub; store.set("shopSub",shopSub); renderShopSub(); });
function renderNextSteps(){
  const s=ZK.nextSteps(monthItems(),bought,3);
  $("#nextSteps").innerHTML=s.length?s.map((x,k)=>`<div class="rule"><span>${k+1}. adım</span><p><b style="font-weight:500">${escH(x.name)}</b><br><small>${x.priceTL.toLocaleString("tr-TR")} TL · ${escH(x.where)}</small><br>${escH(x.first)}<br><button type="button" class="linkbtn" data-goitem="${escH(x.id)}">Ayrıntı, nasıl alınır ve "Aldım" →</button></p></div>`).join("")
    :`<p class="empty">Bu ayın listesi tamam. Yeni ayın listesi ayın 1'inde açılır.</p>`;
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-goitem]"); if(!b) return; const d=document.querySelector(`#monthList details[data-id="${b.dataset.goitem}"]`); if(d){ d.open=true; d.scrollIntoView({block:"start",behavior:"smooth"}); } });
function renderPerf(){
  const P=ZPL.PERFUMES, fmt=n=>n.toLocaleString("tr-TR"), mine=boughtAs.parfum;
  $("#perfF").innerHTML=[["all","Tümü"],["nuke","Nükleer"],["Beymen","Beymen"],["Boyner","Boyner"],["Zara","Zara"],["Pazaryeri","Arap · pazaryeri"]].map(([k,n])=>`<button class="${perfStore===k?"on":""}" data-pst="${k}">${n}</button>`).join("");
  const L=P.filter(p=>perfStore==="all"||(perfStore==="nuke"?p.nuke:p.store.split(" · ").includes(perfStore))).sort((a,b)=>perfStore==="nuke"?(b.ll+b.sl)-(a.ll+a.sl):0);
  $("#perfCount").textContent=`${L.length} koku`;
  $("#perfList").innerHTML=L.map(p=>`<div class="alt"><b>${escH(p.brand)} · ${escH(p.name)}${mine&&mine===perfLabel(p)?' <span class="tag live">Aldın</span>':""}</b><small>${escH(p.store)} · ${p.ml} ml · ${fmt(p.priceTL)} TL${p.listTL?` (etiket ${fmt(p.listTL)})`:""}${p.rank?` · sıralamada ${p.rank}.`:""}${p.nuke?" · nükleer":""}${p.priceTL>6100?" · bütçe üstü":""}</small>
    <p>${escH(p.notes)} · kalıcılık %${p.ll} · yayılım %${p.sl}<br><b style="font-weight:500">Ne zaman:</b> ${escH(p.when)}</p><p>${escH(p.why)}</p><button type="button" class="own ${shelf.includes(p.id)||(mine&&mine===perfLabel(p))?"on":""}" data-own="${p.id}">${shelf.includes(p.id)||(mine&&mine===perfLabel(p))?"✓ Rafımda":"Rafımda var"}</button></div>`).join("");
}
$("#perfF").addEventListener("click",e=>{ const b=e.target.closest("[data-pst]"); if(!b) return; perfStore=b.dataset.pst; store.set("perfStore",perfStore); renderPerf(); });
function renderWhere(){ const W=ZPL.WHERE; if(!W||!$("#whereList")) return;
  $("#whereList").innerHTML=`<ol class="use">${W.trust.map(w=>`<li><b style="font-weight:600">${escH(w.name)}</b> — ${escH(w.for)}<br><small>${escH(w.why)}</small></li>`).join("")}</ol>`
    +`<span class="label">Kaçın</span><ul class="use">${W.avoid.map(a=>`<li>${escH(a)}</li>`).join("")}</ul><p class="label" style="text-transform:none;letter-spacing:.02em">${escH(W.sephora)} ${escH(W.zara)}</p>`; }
function renderBaskets(){ if(!$("#baskets")) return; const L=monthItems().filter(i=>i.shop&&i.shop!=="Market"), fmt=n=>n.toLocaleString("tr-TR",{maximumFractionDigits:2});
  const shops=[...new Set(L.map(i=>i.shop))];
  $("#baskets").innerHTML=shops.map(sh=>{ const its=L.filter(i=>i.shop===sh), core=its.filter(i=>!i.optional), sum=core.reduce((a,i)=>a+i.priceTL,0), S=ZPL.SHOPS[sh]||{};
    return `<div class="basket"><div class="sec-h" style="margin:0 0 6px"><b>🛒 ${escH(sh)} sepeti</b><span class="label">${fmt(sum)} TL</span></div><ol class="use">${its.map(i=>`<li class="${bought[i.id]?"done":""}">${bought[i.id]?"✓ ":""}${escH(i.name)} — ${fmt(i.priceTL)} TL${i.optional?" <small>(isteğe bağlı)</small>":""}</li>`).join("")}</ol>${S.url?`<a class="btn" href="${S.url}" target="_blank" rel="noopener" style="margin-top:6px">${escH(sh)}'yi aç ↗</a>`:""}<p class="label" style="text-transform:none;letter-spacing:.02em;margin-top:6px">${escH(S.note||"")}</p></div>`; }).join("");
}
/* bu ayın listesi */
function renderMonth(){
  renderNextSteps(); renderWhere(); renderBaskets();
  const L=monthItems(), fmt=n=>n.toLocaleString("tr-TR"), CAP=15000;
  const plan=L.filter(i=>!i.optional), total=plan.reduce((s,i)=>s+i.priceTL,0), spent=plan.filter(i=>bought[i.id]).reduce((s,i)=>s+i.priceTL,0);
  $("#monthBudget").innerHTML=`<div><span class="label">Harcanan</span><b>${fmt(spent)} TL</b></div><div><span class="label">Plan</span><b>${fmt(total)} TL</b></div><div><span class="label">Üst sınır</span><b>${fmt(CAP)} TL</b></div>`
    +`<div class="mbar" style="grid-column:1/-1"><i style="width:${Math.min(100,spent/CAP*100).toFixed(1)}%"></i><u style="left:${Math.min(100,total/CAP*100).toFixed(1)}%"></u></div>`;
  $("#monthTotals").textContent=`${plan.filter(i=>bought[i.id]).length}/${plan.length} alındı · parfüm dahil tek bütçe`;
  const val=v=>v?`<div class="rule"><span>Yasal</span><p>${escH(v.legal)}</p></div><div class="rule"><span>Mühür</span><p>${escH(v.seal)}</p></div><div class="rule"><span>Kanıt</span><p>${escH(v.evidence)}</p></div>`:"";
  $("#monthList").innerHTML=L.map(i=>`<details class="mitem ${bought[i.id]?"bought":""}" data-id="${i.id}"><summary><span class="mi-n">${bought[i.id]?"✓ ":""}${escH(i.name)}${bought[i.id]&&boughtAs[i.id]&&boughtAs[i.id]!==i.name?`<br><b style="font-weight:500">Aldığın: ${escH(boughtAs[i.id])}</b>`:""}${i.rx?' <span class="tag red">reçeteli</span>':""}${i.type==="parfum"?' <span class="tag">parfüm</span>':""}</span><small>${escH(i.cat)} · ${escH(i.size)} · ${fmt(i.priceTL)} TL${i.when?` · ${escH(i.when.split(" · ")[0])}`:""}</small></summary>
    <div class="mi-b">
      ${i.ingredients?`<span class="label">İçerik</span><div class="rules" style="margin:6px 0 10px;border-top:1px solid var(--line)"><div class="rule"><span>Etken</span><p>${escH(i.ingredients.actives)}</p></div><div class="rule"><span>Dikkat</span><p>${escH(i.ingredients.flags)}</p></div>${val(i.ingredients.validation)}</div>`:""}
      ${i.when?`<p class="use-when">⏱ ${escH(i.when)}</p>`:""}${i.use?`<span class="label">Nasıl kullanılır</span><ol class="use">${i.use.map(h=>`<li>${escH(h)}</li>`).join("")}</ol>`:""}
      ${(i.links||[]).length?`<span class="label">Örnek görseller</span><div class="links">${i.links.map(([n,u])=>`<a href="${escH(u)}" target="_blank" rel="noopener">${escH(n)} ↗</a>`).join("")}</div>`:""}
      <span class="label">Nasıl alınır</span><ol>${i.how.map(h=>`<li>${escH(h)}</li>`).join("")}</ol>${(i.warn||[]).map(x=>`<p class="label warn">${escH(x)}</p>`).join("")}
      ${(i.alt||[]).length?`<span class="label">${i.rx?"Reçete alamazsan":"Alternatif"}</span>`+i.alt.map(a=>`<div class="alt"><b>${escH(a.name)}</b><small>${fmt(a.priceTL)} TL · ${escH(a.where)}</small><p>${escH(a.why)}</p><ol>${a.how.map(h=>`<li>${escH(h)}</li>`).join("")}</ol></div>`).join(""):""}
      ${!bought[i.id]&&buyOptions(i)?`<label class="field" style="margin:8px 0 0"><span class="label">Hangisini aldın?</span><select data-for="${i.id}">${buyOptions(i).map(([v,n])=>`<option value="${escH(v)}">${escH(n)}</option>`).join("")}</select></label>`:""}
      <div class="row-btns" style="margin:0"><button type="button" class="btn ${bought[i.id]?"":"solid"}" data-buy="${i.id}">${bought[i.id]?"Alındı · geri al":"Aldım"}</button></div></div></details>`).join("");
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-buy]"); if(!b) return;
  const id=b.dataset.buy, sel=document.querySelector(`select[data-for="${id}"]`);
  if(bought[id]){ delete bought[id]; delete boughtAs[id]; } else { bought[id]=TODAY; if(sel) boughtAs[id]=sel.value; }
  store.set("coach.bought",bought); store.set("coach.boughtAs",boughtAs); renderMonth(); renderPerf(); renderCare(); renderTodo(); syncPush(); toast(bought[id]?`Alındı${boughtAs[id]?": "+boughtAs[id].split(" · ")[0]:""} · rutine eklendi`:"Geri alındı");
  const d=document.querySelector(`#monthList details[data-id="${id}"]`); if(d) d.open=true;
});

/* ================= v10 · saç bakımı, yüz şişkinliği, sahip olunanlar ================= */
function renderBodyGuides(){
  if($("#morning10")){ let t=0; $("#morning10").innerHTML=`<div class="rules" style="border-top:1px solid var(--line)">${ZPL.MORNING10.map(x=>{ const a=t; t+=x.min; return `<div class="rule"><span>${a}–${t}. dk</span><p>${escH(x.t)}</p></div>`; }).join("")}</div>`; $("#m10Sum").textContent=`toplam ${t} dk`; }
  if($("#hairCare")) $("#hairCare").innerHTML=`<ol class="use">${ZPL.HAIRCARE.map(x=>`<li>${escH(x.t)}<br><small class="label" style="text-transform:none;letter-spacing:.02em">${escH(x.ev)}</small></li>`).join("")}</ol>`;
  if($("#puffGuide")){ const P=ZPL.PUFF, days=[...Array(7)].map((_,i)=>coachLog[ZC.addDays(TODAY,-i)]).filter(e=>e&&e.puff!=null), avg=days.length?days.reduce((s,e)=>s+(+e.puff),0)/days.length:null;
    $("#puffAvg").textContent=avg==null?"check-in'de işaretle":`7 gün ort. ${avg.toFixed(1).replace(".",",")} / 2`;
    const pa=ZK.puffAdvice(coachLog,TODAY);
    $("#puffGuide").innerHTML=(pa?`<p class="use-when">Bugün: ${escH(pa.reasons.length?"muhtemel neden "+pa.reasons.join(", "):"neden belirgin değil")} → ${escH(pa.tips.join("; "))}</p>`:"")
      +`<p style="font-size:14.5px">${escH(P.intro)}</p><ol class="use">${P.tips.map(x=>`<li>${escH(x.t)}<br><small class="label" style="text-transform:none;letter-spacing:.02em">${escH(x.ev)}</small></li>`).join("")}</ol><p class="label warn" style="text-transform:none;letter-spacing:.02em">${escH(P.warn)}</p>`; }
  if($("#ownedList")) $("#ownedList").innerHTML=`<div class="rules" style="border-top:1px solid var(--line)">${ZPL.OWNED.map(o=>`<div class="rule"><span>Var</span><p><b style="font-weight:500">${escH(o.name)}</b><br>${escH(o.use)}</p></div>`).join("")}</div>`;
}
/* ================= v7 · günün kokusu, antrenman kaydı, tahlil kartı ================= */
let shelf=store.get("coach.shelf")||[], lifts=store.get("coach.lifts")||{}, labs=store.get("coach.labs")||{};
function ownedPerfumes(){ const s=new Set(shelf), b=boughtAs.parfum&&ZPL.PERFUMES.find(p=>perfLabel(p)===boughtAs.parfum); if(b) s.add(b.id); return [...s]; }
function renderScent(){
  const ev=events.find(e=>e.date===TODAY), t=(wxDays[TODAY]||{}).t, s=ZK.scentOfDay(ownedPerfumes(),{temp:t==null?wx.t:t},ev?ev.type:null,TODAY);
  $("#scentCard").innerHTML=`<span class="label">香 Günün kokusu</span>`+(s?`<h3>${escH(s.name)}</h3><p>${s.sprays} sprey: boyun yanları${s.sprays>2?", göğüs":""}${s.sprays>1?", bilek":""}. ${escH(s.why)}</p>`
    :`<h3>Rafın boş</h3><p>Parfümü aldığında "Aldım" de ya da Alınacak → Parfüm'de "Rafımda var"a bas; her sabah hava ve etkinliğe göre seçerim.</p>`);
}
$("#scentCard").addEventListener("click",()=>{ if(!ownedPerfumes().length){ shopSub="parfum"; store.set("shopSub",shopSub); renderShopSub(); goView("shop"); } });
document.addEventListener("click",e=>{ const b=e.target.closest("[data-own]"); if(!b) return; const id=b.dataset.own;
  shelf=shelf.includes(id)?shelf.filter(x=>x!==id):[...shelf,id]; store.set("coach.shelf",shelf); renderPerf(); renderScent(); toast(shelf.includes(id)?"Rafına eklendi":"Raftan çıkarıldı"); });
const liftRule=n=>ZPL.LIFTS.find(l=>l.name===n)||{range:[8,12],step:2.5};
function renderLift(){
  const day=ZPL.PROGRAM.days[new Date(TODAY+"T12:00").getDay()];
  if(!day){ const c=ZK.workoutFor(TODAY); $("#liftCard").innerHTML=`<span class="label">鍛 Bugünün antrenmanı</span><h3>${escH(c.label)}</h3><p>${escH(c.detail||"Dinlenme günü: yürüyüş ve esneme.")}</p>`; return; }
  $("#liftCard").innerHTML=`<span class="label">鍛 Bugünün antrenmanı · ${escH(day.focus)}</span><p>Seti bitirince kg ve tekrarları yaz (ör. <b>10 9 8</b>); bir dahaki hedefi söylerim.</p>`+day.ex.map(x=>{
    const r=liftRule(x.name), h=lifts[x.name]||[], last=h[h.length-1], nx=last?ZK.liftNext({kg:last.kg,reps:last.reps,range:r.range,step:r.step}):null;
    return `<div class="lift"><b>${escH(x.name)} · ${x.sets} set</b><span class="label">${r.range[0]}–${r.range[1]} tekrar</span>
      <small>${last?`Son: ${last.kg} kg × ${last.reps.join(", ")} (${fmtD(last.d)}) → <b style="color:var(--red)">Hedef: ${nx.kg} kg × ${nx.reps}${nx.why==="artir"?" ↑ ağırlık artır":nx.why==="dus"?" ↓ ağırlığı düşür, formu koru":""}</b>`:"İlk kayıt: rahat yapabildiğin ağırlıkla başla, 1–2 tekrar yedekle bitir."}</small>
      <div class="in"><input inputmode="decimal" placeholder="kg" data-lkg="${escH(x.name)}" value="${nx?nx.kg:""}"><input inputmode="numeric" placeholder="tekrarlar: 10 9 8" data-lrp="${escH(x.name)}"><button type="button" data-lsave="${escH(x.name)}">Kaydet</button></div></div>`; }).join("");
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-lsave]"); if(!b) return; const n=b.dataset.lsave, q=s=>document.querySelector(`[${s}="${CSS.escape(n)}"]`);
  const kg=+String(q("data-lkg").value).replace(",","."), reps=String(q("data-lrp").value).split(/[^0-9]+/).filter(Boolean).map(Number);
  if(!(kg>=0)||!reps.length) return toast("kg ve en az bir tekrar yaz");
  const h=(lifts[n]||[]).filter(x=>x.d!==TODAY); h.push({d:TODAY,kg,reps}); lifts[n]=h.slice(-12); store.set("coach.lifts",lifts);
  const t=coachTodo[TODAY]||(coachTodo[TODAY]={}); if(!t.workout){ t.workout=true; store.set("coach.todo",coachTodo); }
  renderLift(); renderTodo(); syncPush(); toast(`${n} kaydedildi`); });
function renderLabs(){
  const last=Object.values(labs).map(x=>x.d).sort().pop();
  $("#labsDate").textContent=last?`son: ${fmtD(last)}`:"";
  $("#labs").innerHTML=ZPL.LABS.map(l=>{ const v=labs[l.key], st=v?ZK.labStatus(l.key,v.v):null;
    return `<div class="lab"><span>${escH(l.name)} <small style="display:inline;color:var(--ink-3)">${l.unit}</small>${st?`<span class="lv lv-${st.level}">${{dusuk:"düşük",sinirda:"sınırda",normal:"normal",yuksek:"yüksek"}[st.level]}</span>`:""}</span>
      <input inputmode="decimal" data-lab="${l.key}" value="${v?v.v:""}" aria-label="${escH(l.name)}">${st?`<small>${escH(st.advice)}</small>`:""}</div>`; }).join("");
}
document.addEventListener("change",e=>{ const i=e.target.closest("[data-lab]"); if(!i) return; const v=i.value.trim().replace(",",".");
  if(v===""){ delete labs[i.dataset.lab]; } else if(!isNaN(+v)) labs[i.dataset.lab]={v:+v,d:TODAY}; else return toast("Sayı yaz");
  store.set("coach.labs",labs); renderLabs(); });

/* ================= 師 · A2: planlar, beslenme, fotoğraf, etkinlik, beden kontrolü, paylaşım, adımlar ================= */
let ifthen=store.get("coach.ifthen")||[], events=(store.get("coach.events")||[]).filter(e=>e.date>=ZC.addDays(TODAY,-1)), bodyChecks=store.get("coach.body")||{};
const saveIf=()=>store.set("coach.ifthen",ifthen), saveEv=()=>store.set("coach.events",events);
const fmtD=s=>`${s.slice(8)}.${s.slice(5,7)}`;
/* eğer → o zaman */
function renderIfThen(){
  const act=ifthen.filter(x=>x.active!==false);
  $("#ifCount").textContent=`${act.length}/5 aktif`;
  $("#ifList").innerHTML=ifthen.length?ifthen.map(x=>`<div class="rule"><span>${x.active!==false?"Aktif":"Pasif"}</span><p><b style="font-weight:500">Eğer</b> ${escH(x.if)} <b style="font-weight:500">→</b> ${escH(x.then)}<br><button type="button" class="linkbtn" data-ifon="${escH(x.id)}">${x.active!==false?"Durdur":"Etkinleştir"}</button> · <button type="button" class="linkbtn" data-ifdel="${escH(x.id)}">Sil</button></p></div>`).join(""):`<p class="empty">Henüz plan yok. Şablondan seç ya da kendin yaz: "Eğer X olursa, Y yapacağım."</p>`;
  $("#ifTpl").innerHTML=`<option value="">Şablon seç (isteğe bağlı)</option>`+ZPL.IFTHEN.map(t=>`<option value="${t.id}">${escH(t.if)} → ${escH(t.then)}</option>`).join("");
}
$("#ifTpl").addEventListener("change",e=>{ const t=ZPL.IFTHEN.find(x=>x.id===e.target.value); if(t){ $("#ifIf").value=t.if; $("#ifThen").value=t.then; } });
$("#ifForm").addEventListener("submit",e=>{ e.preventDefault(); const a=$("#ifIf").value.trim(), b=$("#ifThen").value.trim(); if(!a||!b) return toast("İki alanı da doldur");
  if(ifthen.filter(x=>x.active!==false).length>=5) return toast("En fazla 5 aktif plan; birini durdur");
  ifthen.push({id:"p"+Date.now(),if:a,then:b,active:true}); saveIf(); e.target.reset(); renderIfThen(); renderTodo(); syncPush(); toast("Plan eklendi"); });
document.addEventListener("click",e=>{ const on=e.target.closest("[data-ifon]"), del=e.target.closest("[data-ifdel]");
  if(on){ const x=ifthen.find(p=>p.id===on.dataset.ifon); if(x){ if(x.active===false&&ifthen.filter(p=>p.active!==false).length>=5) return toast("En fazla 5 aktif plan"); x.active=x.active===false; saveIf(); renderIfThen(); syncPush(); } }
  if(del){ ifthen=ifthen.filter(p=>p.id!==del.dataset.ifdel); saveIf(); renderIfThen(); syncPush(); } });
/* beslenme */
function renderMeals(){
  const target=ZK.proteinTarget(coachLog,TODAY), mp=ZK.mealPlan(target,TODAY), SL={kahvalti:"Kahvaltı",ogle:"Öğle",aksam:"Akşam",ara:"Ara"};
  $("#mealTotals").textContent=`~${mp.protein} g protein · ~${mp.kcal} kcal · hedef ${target} g`;
  $("#meals").innerHTML=mp.meals.map(m=>`<div class="rule"><span>${SL[m.slot]}</span><p>${escH(m.name)}<small style="display:block;color:var(--ink-3)">~${m.protein} g protein · ~${m.kcal} kcal · ${"₺".repeat(m.cost)}</small></p></div>`).join("");
}
function marketText(){ const g=ZK.marketList(TODAY,7,ZK.proteinTarget(coachLog,TODAY)); return Object.entries(g).map(([c,l])=>`${c}: `+l.map(i=>`${i.name} ${Math.round(i.qty*10)/10} ${i.unit}`).join(", ")).join("\n"); }
$("#marketBtn").addEventListener("click",()=>{ const g=ZK.marketList(TODAY,7,ZK.proteinTarget(coachLog,TODAY));
  $("#market").innerHTML=Object.entries(g).map(([c,l])=>`<div class="rule"><span>${escH(c)}</span><p>${l.map(i=>`${escH(i.name)} <b style="font-weight:500">${Math.round(i.qty*10)/10} ${escH(i.unit)}</b>`).join(" · ")}</p></div>`).join(""); });
$("#marketCopy").addEventListener("click",async()=>{ try{ await navigator.clipboard.writeText(marketText()); toast("Market listesi kopyalandı"); }catch(e){ toast("Kopyalanamadı"); } });
/* paylaşım */
$("#shareWeek").addEventListener("click",async()=>{ const t=ZK.weeklyShareText(coachLog,careState.done,TODAY,{showWeight:$("#shareWeight").checked});
  try{ if(navigator.share){ await navigator.share({title:"Zenon haftalık özet",text:t}); return; } }catch(e){ if(e&&e.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(t); toast("Özet kopyalandı: bir arkadaşına gönder"); }catch(e){ toast("Kopyalanamadı"); } });
/* etkinlikler */
function renderEvents(){
  $("#evCount").textContent=events.length?`${events.length} etkinlik`:"";
  $("#evList").innerHTML=events.length?events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(ev=>{ const n=ZC.daysBetween(TODAY,ev.date), tpl=ZPL.EVENTS[ev.type]||ZPL.EVENTS.diger;
    return `<div class="rule"><span>${escH(fmtD(ev.date))}<br>${n>0?n+" gün":n===0?"bugün":"geçti"}</span><p><b style="font-weight:500">${escH(ev.title||tpl.name)}</b> · ${escH(tpl.name)}<br><small style="color:var(--ink-3)">${tpl.tasks.map(t=>`T-${t.off}: ${escH(t.label)}`).join(" · ")}</small><br><button type="button" class="linkbtn" data-evdel="${escH(ev.id)}">Sil</button></p></div>`; }).join("")
    :`<p class="empty">Date, mülakat ya da düğün var mı? Ekle; Zenon 7 gün önceden hazırlık görevlerini Bugün listesine koysun.</p>`;
}
$("#evForm").addEventListener("submit",e=>{ e.preventDefault(); const d=$("#evDate").value; if(!d||d<TODAY) return toast("Bugün ya da sonrası bir tarih seç");
  events.push({id:"e"+Date.now(),type:$("#evType").value,date:d,title:$("#evTitle").value.trim()}); saveEv(); e.target.reset(); renderEvents(); renderTodo(); syncPush(); toast("Etkinlik eklendi"); });
document.addEventListener("click",e=>{ const d=e.target.closest("[data-evdel]"); if(d){ events=events.filter(x=>x.id!==d.dataset.evdel); saveEv(); renderEvents(); renderTodo(); syncPush(); } });
/* beden algısı öz kontrolü: ayın ilk pazarı ya da istenince */
function firstSunday(){ const d=new Date(TODAY+"T12:00"); return d.getDay()===0&&d.getDate()<=7; }
function renderBodyCheck(){
  const key=TODAY.slice(0,7), last=bodyChecks[key];
  $("#bcWhen").textContent=last?`${key} yapıldı`:(firstSunday()?"bugün zamanı":"ayın ilk pazarı");
  if(last&&!renderBodyCheck.open){ const r=ZK.bodyCheckResult(last.a); $("#bodyCheck").innerHTML=`<p class="${r.flag?"warn-box":"empty"}">${escH(r.message)}</p><div class="row-btns" style="margin:0"><button class="btn" id="bcAgain">Yeniden yap</button></div>`; return; }
  if(!firstSunday()&&!renderBodyCheck.open){ $("#bodyCheck").innerHTML=`<p class="empty">Ayda bir, 1 dakikalık öz kontrol: görünüş kaygısının hayatını zorlaştırıp zorlaştırmadığına bakar. Sonuç yalnız bu telefonda kalır.</p><div class="row-btns" style="margin:0"><button class="btn" id="bcAgain">Şimdi yap</button></div>`; return; }
  $("#bodyCheck").innerHTML=`<form id="bcForm">${ZPL.BODYCHECK.map((q,i)=>`<div class="field" style="margin-bottom:10px"><span class="label" style="text-transform:none;letter-spacing:.02em">${escH(q)}</span><div class="seg">${[0,1,2,3].map(v=>`<label style="flex:1;text-align:center;padding:8px 0;border-left:1px solid var(--line)"><input type="radio" name="bc${i}" value="${v}" ${v===0?"checked":""}> ${v}</label>`).join("")}</div></div>`).join("")}<button class="btn solid" type="submit">Kaydet</button></form>`;
}
document.addEventListener("click",e=>{ if(e.target.closest("#bcAgain")){ renderBodyCheck.open=true; renderBodyCheck(); } });
document.addEventListener("submit",e=>{ if(e.target.id!=="bcForm") return; e.preventDefault();
  const a=ZPL.BODYCHECK.map((_,i)=>+((e.target.querySelector(`input[name=bc${i}]:checked`)||{}).value||0));
  bodyChecks[TODAY.slice(0,7)]={a,d:TODAY}; store.set("coach.body",bodyChecks); renderBodyCheck.open=false; renderBodyCheck(); });
/* ilerleme fotoğrafları: IndexedDB, hayaletli kamera, 7 günde bir */
const ANG=[["on","Önden"],["sag","Sağ"],["sol","Sol"]]; let pAngle="on";
const pdb=()=>new Promise((res,rej)=>{ if(!("indexedDB" in window)) return rej(new Error("yok")); const r=indexedDB.open("zenon-photos",1);
  r.onupgradeneeded=()=>r.result.createObjectStore("p",{keyPath:"id"}); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
async function photosOf(angle){ try{ const db=await pdb(); return await new Promise(res=>{ const out=[]; const c=db.transaction("p").objectStore("p").openCursor();
  c.onsuccess=()=>{ const cur=c.result; if(cur){ if(cur.value.angle===angle) out.push(cur.value); cur.continue(); } else res(out.sort((a,b)=>a.date.localeCompare(b.date))); }; c.onerror=()=>res([]); }); }catch(e){ return []; } }
async function savePhoto(angle,data){ const db=await pdb(); await new Promise((res,rej)=>{ const tx=db.transaction("p","readwrite"); tx.objectStore("p").put({id:angle+":"+TODAY,angle,date:TODAY,data}); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function renderPhotos(){
  $("#photoAngle").innerHTML=ANG.map(([k,n])=>`<button type="button" data-ang="${k}" class="${k===pAngle?"on":""}">${n}</button>`).join("");
  const l=await photosOf(pAngle), first=l[0], last=l[l.length-1];
  $("#photoNote").textContent=l.length?`${l.length} fotoğraf · son ${fmtD(last.date)}`:"";
  $("#photoCompare").innerHTML=!l.length?`<p class="empty">İlk fotoğrafını çek: 0. gün. Sonra 14. ve 30. günde aynı açıdan.</p>`
    :`<figure><img src="${first.data}" alt="İlk fotoğraf"><figcaption>${fmtD(first.date)}</figcaption></figure>`+(l.length>1?`<figure><img src="${last.data}" alt="Son fotoğraf"><figcaption>${fmtD(last.date)}</figcaption></figure>`:"");
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-ang]"); if(b){ pAngle=b.dataset.ang; renderPhotos(); } });
async function canTakePhoto(){ const l=await photosOf(pAngle), last=l[l.length-1]; return !last||ZC.daysBetween(last.date,TODAY)>=7||last.date===TODAY; }
function shrink(src,cb){ const im=new Image(); im.onload=()=>{ const s=Math.min(1,540/Math.max(im.width,im.height)), cv=document.createElement("canvas"); cv.width=im.width*s; cv.height=im.height*s; cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height); cb(cv.toDataURL("image/jpeg",.8)); }; im.src=src; }
async function storePhoto(data){ try{ await savePhoto(pAngle,data); toast("Fotoğraf kaydedildi (yalnız bu telefonda)"); }catch(e){ toast("Kaydedilemedi: depolama izni yok"); } renderPhotos(); }
$("#photoFile").addEventListener("change",async e=>{ const f=e.target.files[0]; if(!f) return; if(!await canTakePhoto()) return toast("Aynı açıdan 7 günde bir fotoğraf yeter"); const rd=new FileReader(); rd.onload=()=>shrink(rd.result,storePhoto); rd.readAsDataURL(f); e.target.value=""; });
$("#photoTake").addEventListener("click",async()=>{
  if(!await canTakePhoto()) return toast("Aynı açıdan 7 günde bir fotoğraf yeter");
  const fallback=()=>{ toast("Kamera açılamadı: 'Dosyadan' ile seç"); const l=$("#photoFile").closest("label"); l.classList.add("pulse"); setTimeout(()=>l.classList.remove("pulse"),2400); };
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)) return fallback();
  let st; try{ st=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false}); }catch(e){ return fallback(); }
  const l=await photosOf(pAngle), ghost=l.length?l[l.length-1].data:"";
  const w=document.createElement("div"); w.className="cam"; w.innerHTML=`<video autoplay playsinline muted></video>${ghost?`<img src="${ghost}" alt="" class="ghost">`:""}<div class="cam-guide"></div><div class="row-btns cam-btns"><button type="button" class="btn" data-cam="x">Vazgeç</button><button type="button" class="btn solid" data-cam="ok">Çek</button></div>`;
  document.body.appendChild(w); const v=w.querySelector("video"); v.srcObject=st;
  const close=()=>{ st.getTracks().forEach(t=>t.stop()); w.remove(); };
  w.addEventListener("click",ev=>{ const b=ev.target.closest("[data-cam]"); if(!b) return; if(b.dataset.cam==="ok"){ if(!v.videoWidth){ toast("Kamera henüz hazır değil, bir saniye bekle"); return; } const cv=document.createElement("canvas"); cv.width=v.videoWidth; cv.height=v.videoHeight; const g=cv.getContext("2d"); g.translate(cv.width,0); g.scale(-1,1); g.drawImage(v,0,0); shrink(cv.toDataURL("image/jpeg",.9),storePhoto); } close(); });
});
/* adımlar: iOS Kestirmeler → Seneca → Zenon */
function renderSteps(){
  const ready=!!(pushCfg&&pushCfg.cihaz&&pushCfg.token);
  $("#stepHelp").innerHTML=[["1","Önce Bakım sekmesinde bildirimleri aç (anahtarlar o zaman oluşur), sonra aşağıdan bilgileri kopyala."],
    ["2","iPhone'da Kestirmeler → Otomasyon → Saat 21:30 → Her gün → 'Sağlık Örneklerini Bul': Adımlar, Bugün, Toplam."],
    ["3","'URL İçeriğini Al': kopyaladığın adres, Yöntem PUT, Başlıklar X-Zenon-Cihaz ve X-Zenon-Token, Gövde JSON: tarih = bugünün tarihi (yyyy-MM-dd), adim = Sağlık Örnekleri."],
    ["4","Zenon açılınca son 14 günün adımlarını çeker; elle girdiğin değeri değiştirmez."]].map(([a,b])=>`<div class="rule"><span>${a}</span><p>${escH(b)}</p></div>`).join("");
  $("#stepKeys").disabled=!ready; $("#stepPull").disabled=!ready;
  const n=Object.values(coachLog).filter(x=>x&&x.stepsAuto).length; $("#stepSync").textContent=ready?(n?`${n} gün otomatik`:"hazır"):"bildirim gerekli";
}
async function pullSteps(quiet){ if(!(pushCfg&&pushCfg.cihaz)) return; try{ const r=await zapi("adim?gun=14"); let n=0;
  for(const [d,a] of Object.entries(r.adimlar||{})){ const e=coachLog[d]||(coachLog[d]={}); if(e.steps==null||e.stepsAuto){ e.steps=a; e.stepsAuto=true; n++; } }
  if(n){ store.set("coach.log",coachLog); renderTodo(); renderProgress(); } if(!quiet) toast(n?`${n} günün adımı alındı`:"Yeni adım verisi yok"); }catch(e){ if(!quiet) toast("Adımlar alınamadı"); } renderSteps(); }
$("#stepPull").addEventListener("click",()=>pullSteps(false));
$("#stepKeys").addEventListener("click",async()=>{ const t=`Adres: ${ZC.SRV}/zenon/api/adim\nYöntem: PUT\nX-Zenon-Cihaz: ${pushCfg.cihaz}\nX-Zenon-Token: ${pushCfg.token}\nGövde (JSON): {"tarih": "yyyy-MM-dd", "adim": <Sağlık Örnekleri>}\nBu anahtarı kimseyle paylaşma.`;
  try{ await navigator.clipboard.writeText(t); toast("Kopyalandı: Kestirmeler'e yapıştır"); }catch(e){ toast("Kopyalanamadı"); } });
function renderA2(){ renderIfThen(); renderMeals(); renderEvents(); renderBodyCheck(); renderPhotos(); renderSteps(); }

function pushExtra(){
  const morning={}, workout={}, checkinDone={}, ifp={};
  for(let i=0;i<7;i++){ const d=ZC.addDays(TODAY,i);
    morning[d]=ZK.morningText(ZK.todayTodos(coachCtx(d)));
    const wo=ZK.workoutFor(d), gymDays=(careProfile&&careProfile.times.gymDays)||[];
    if(wo.kind==="gym"&&gymDays.includes(new Date(d+"T12:00").getDay())&&!(coachTodo[d]||{}).workout&&!(coachLog[d]||{}).workout) workout[d]=`${wo.label}: ${wo.detail}`;
    if(ZK.isCheckin(coachLog[d])) checkinDone[d]=true;
    const pl=ZK.pickIfThen(ifthen,d); if(pl) ifp[d]=`Plan: Eğer ${pl.if} → ${pl.then}`.slice(0,120); }
  return {morning, workout, checkinDone, ifthen:ifp, avail};
}


/* ================= chrome ================= */
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  if(t.classList.contains("on")) return;
  const eye=$("#eye"); $("#eyeK").textContent=t.dataset.k; eye.classList.remove("run"); void eye.offsetWidth; eye.classList.add("run");
  setTimeout(()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id===t.dataset.view));history.replaceState(null,"","#"+t.dataset.view);window.scrollTo({top:0});},
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

/* ================= 記 · tracking: laundry, history, stats, travel, reminders, backup ================= */
const WASH={tee:1,polo:1,shirt:1,camp:1,hoodie:2,crew:2,turtle:2,knit:3,cardigan:3,jeans:5,trouser:3,chino:3,cargo:3,track:2,shorts:1};
let wsw=store.get("wsw")||{};                // wears since last wash
const washLimit=it=>it.sport?1:(it.cat==="ust"||it.cat==="katman"||it.cat==="alt")?(WASH[it.type]||2):0;
const wearCount=id=>log.filter(l=>l.applied&&l.ids.includes(id)).length;
function washText(it){ const L=washLimit(it); return L?`${L} giyimde bir yıkanır · şu an ${wsw[it.id]||0}/${L}`:"Yıkanmaz: havalandır, gerekirse silerek temizle."; }
function careText(it){
  const t=it.type;
  if(it.rib) return "30°C ters çevirerek. Fitilli doku esner: asma, katlayarak sakla. Kurutma makinesi yok.";
  if(["tee","polo","crew","hoodie"].includes(t)) return "30°C ters çevirerek, düşük devir. Kurutma makinesi yok: ağır pamuk çeker."+(it.print||it.graphic||it.script?" Baskı / işleme içte kalsın.":"");
  if(t==="ziphoodie") return "30°C ters, fermuar kapalı. Baskı içte kalsın, kurutma makinesi yok.";
  if(["knit","cardigan","turtle"].includes(t)) return "Yün / hassas programda 30°C ya da elde. Düz serip kurut, asma: omuzları sarkar.";
  if(["shirt","camp"].includes(t)) return "30°C, yarı ıslakken askıda kurut. Ütü orta ısı.";
  if(t==="jeans") return "Ters çevir, 30°C, 5 giyimde bir. Rengi ve kalıbı korur. Askıda kurut.";
  if(["trouser","chino"].includes(t)) return "30°C hassas. Pileyi korumak için askıda kurut, buharla düzelt.";
  if(["cargo","track","shorts"].includes(t)) return "30°C ters, kurutma makinesi yok.";
  if(t==="leather") return "Makinede yıkanmaz. Nemli bezle sil, geniş omuzlu askıda sakla. Islanırsa oda sıcaklığında kurut, kaloriferde değil.";
  if(it.cat==="ayak") return "Makinede yıkanmaz. Süete süet fırçası ve koruyucu sprey; tabana nemli bez. İçine gazete koyup kurut.";
  if(t==="watch") return "Kuru bezle sil; bileziği ayda bir yumuşak fırçayla temizle.";
  if(["chain","ring"].includes(t)) return "Parfümden sonra tak, suya girerken çıkar. Kuru bezle parlat.";
  if(t==="belt") return "Deriyi nemden koru, tokayı kuru bezle sil. Asarak değil rulo yaparak sakla.";
  if(t==="beanie") return "Elde soğuk suda, düz serip kurut.";
  return "Etiketteki talimata uy.";
}
function processLog(){
  let ch=false;
  for(const e of log){ if(e.applied||e.d>TODAY) continue;
    for(const id of e.ids){ const it=byId(id); if(!it) continue; const L=washLimit(it); if(!L) continue;
      wsw[id]=(wsw[id]||0)+1; if(wsw[id]>=L) dirtySet.add(id); }
    e.applied=true; ch=true; }
  if(ch){ store.set("log",log); store.set("wsw",wsw); saveDirty(); }
}
function unapplyWear(e){
  for(const id of e.ids){ const it=byId(id); if(!it) continue; const L=washLimit(it); if(!L) continue;
    wsw[id]=Math.max(0,(wsw[id]||0)-1); if(wsw[id]<L) dirtySet.delete(id); }
  store.set("wsw",wsw); saveDirty();
}
function washItems(ids){ ids.forEach(id=>{wsw[id]=0; dirtySet.delete(id);}); store.set("wsw",wsw); saveDirty(); refreshAll(); toast("Temiz olarak işaretlendi"); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on"); }
function refreshAll(){ renderFilters(); renderList(); renderFit(false); renderCapsule(); renderCart(); renderLook(); renderLog(); }

/* bought: planned piece becomes owned */
function markBought(id){ ownedIds.add(id); store.set("owned",[...ownedIds]); const it=byId(id); if(it) delete it.planned; closeSheet(); refreshAll(); toast("Gardıroba taşındı"); }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-bought]"); if(b) markBought(+b.dataset.bought);
  const u=e.target.closest("[data-unphoto]"); if(u){ const id=+u.dataset.unphoto; delete photos[id]; store.set("photos",photos); delete byId(id).img; zoom(id); refreshAll(); }
  const w=e.target.closest("[data-wash]"); if(w) washItems(w.dataset.wash==="all"?[...dirtySet]:[+w.dataset.wash]);
});
/* photos on existing pieces */
document.addEventListener("change",e=>{
  const inp=e.target.closest("[data-photo]"); if(!inp||!inp.files[0]) return; const id=+inp.dataset.photo, rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>{ const s=Math.min(1,360/Math.max(im.width,im.height)), cv=document.createElement("canvas");
    cv.width=im.width*s; cv.height=im.height*s; cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
    const data=cv.toDataURL("image/jpeg",.75); photos[id]=data;
    try{ localStorage.setItem("zenon9:photos",JSON.stringify(photos)); byId(id).img=data; toast("Fotoğraf kaydedildi"); }
    catch(err){ delete photos[id]; toast("Depolama dolu: bir fotoğrafı kaldır"); }
    zoom(id); refreshAll(); }; im.src=rd.result; };
  rd.readAsDataURL(inp.files[0]);
});

/* share: outfit card as a PNG */
function shareOutfit({f,parts}){
  const fig=figure(parts).replace('<svg viewBox="30 12 180 520"','<svg x="60" y="120" width="480" height="1386" viewBox="30 12 180 520"');
  const esc=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const list=parts.map((p,i)=>`<text x="560" y="${260+i*44}" font-family="Georgia,serif" font-size="26" fill="#F0E6D2">${esc(nm(p.it))}</text>`).join("");
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1560" viewBox="0 0 1080 1560"><rect width="1080" height="1560" fill="#15141C"/>
    <text x="60" y="84" font-family="Georgia,serif" font-size="52" font-weight="700" fill="#F0E6D2">${esc(f.title)}</text>
    <text x="60" y="118" font-family="monospace" font-size="20" fill="#D0503C" letter-spacing="4">ZENON · ${esc(f.style.toUpperCase())}</text>${fig}${list}</svg>`;
  const img=new Image(), url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  img.onload=()=>{ const cv=document.createElement("canvas"); cv.width=1080; cv.height=1560; cv.getContext("2d").drawImage(img,0,0); URL.revokeObjectURL(url);
    cv.toBlob(async b=>{ const file=new File([b],`zenon-${f.key}.png`,{type:"image/png"});
      try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:f.title}); return; } }catch(err){ if(err&&err.name==="AbortError") return; }
      const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=file.name; a.click(); toast("Görsel indirildi"); },"image/png"); };
  img.src=url;
}

/* travel: forecast per day -> one outfit per day -> packing list */
async function planTrip(){
  const days=Math.max(1,Math.min(7,+$("#tDays").value||3)), occ=$("#tOcc").value, q=$("#tCity").value.trim()||city.name;
  $("#tripOut").innerHTML=`<p class="empty">Hazırlanıyor…</p>`;
  let fc=null, place=q;
  try{ const g=(await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr`)).json()).results?.[0];
    if(g){ place=g.name; const d=(await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${days+1}`)).json()).daily;
      fc=d.time.slice(1,days+1).map((t,i)=>({t:(d.temperature_2m_max[i+1]*2+d.temperature_2m_min[i+1])/3,rain:d.precipitation_probability_max[i+1]??0,d:t})); } }catch(e){}
  const live=!!fc; if(!fc) fc=Array.from({length:days},(_,i)=>({t:wx.t,rain:wx.rain,d:`${i+1}. gün`}));
  const plan=[], used=new Set(); let prev=null;
  for(const day of fc){
    const opts=FORM.filter(f=>f.occ.includes(occ)&&day.t>=f.t[0]&&day.t<=f.t[1]).map(f=>({f,p:build(f,day,true)})).filter(x=>x.p);
    const pick=opts.find(x=>x.f.key!==prev&&!x.p.some(p=>p.slot==="Üst"&&used.has(p.it.id)))||opts.find(x=>x.f.key!==prev)||opts[0];
    if(pick){ plan.push({day,...pick}); prev=pick.f.key; pick.p.forEach(p=>used.add(p.it.id)); } else plan.push({day});
  }
  const pack={}; plan.forEach(x=>x.p&&x.p.forEach(p=>{pack[p.it.id]=p.it;}));
  const groups=["ust","katman","dis","alt","ayak","aks"].map(c=>[CAT[c],Object.values(pack).filter(i=>i.cat===c)]).filter(g=>g[1].length);
  $("#tripOut").innerHTML=`<span class="label" style="display:block;padding:10px 12px">${place} · ${days} gün · ${live?"canlı tahmin":"tahmin alınamadı, bugünün havası"}</span>`+
    plan.map((x,i)=>`<div class="rule"><span>${x.day.d.length>6?x.day.d.slice(5).split("-").reverse().join("."):x.day.d}<br>${Math.round(x.day.t)}°${x.day.rain>=50?" ☂":""}</span><p>${x.f?`<b style="font-weight:500">${x.f.title}</b> · ${x.p.map(p=>nm(p.it)).join(", ")}`:"Uygun kombin yok"}</p></div>`).join("")+
    `<div class="rule"><span>Bavul</span><p>${groups.map(([n,l])=>`<b style="font-weight:500">${n}:</b> ${l.map(nm).join(", ")}`).join("<br>")}<br><b style="font-weight:500">Ayrıca:</b> ${days+1} çift çorap, ${days+1} iç çamaşırı, spor kıyafeti${days>=3?", küçük çamaşır torbası":""}</p></div>`;
}

/* evening reminder: a daily 21:00 calendar event with an alert */
function reminderICS(){
  const now=new Date(), st=new Date(now.getFullYear(),now.getMonth(),now.getDate(),21,0,0), p=n=>String(n).padStart(2,"0");
  const dt=d=>`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  const url=location.href.split("#")[0];
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Zenon//TR","BEGIN:VEVENT",`UID:zenon-evening-${Date.now()}@zenon`,`DTSTAMP:${dt(now)}`,`DTSTART:${dt(st)}`,`DTEND:${dt(new Date(st.getTime()+10*60000))}`,
    "RRULE:FREQ=DAILY","SUMMARY:Zenon · Yarın nereye?",`DESCRIPTION:Yarının planını seç, Zenon kombini hazırlasın. ${url}`,`URL:${url}`,
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Zenon · Yarın nereye?","TRIGGER:PT0M","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"})); a.download="zenon-hatirlatma.ics"; a.click();
  toast("Takvim dosyası indirildi: aç ve ekle");
}

/* backup: everything this device stored */
function backupData(){ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith("zenon9:")&&k!=="zenon9:care.push"&&k!=="zenon9:coach.body") o[k]=localStorage.getItem(k); } return JSON.stringify({zenon:1,at:new Date().toISOString(),data:o}); }
function restoreData(txt){ const j=JSON.parse(txt); if(!j||!j.data) throw 0; Object.entries(j.data).forEach(([k,v])=>{ if(k!=="zenon9:care.push"&&k!=="zenon9:coach.body") localStorage.setItem(k,v); }); location.reload(); }

const DAYS=[[1,"Pzt"],[2,"Sal"],[3,"Çar"],[4,"Per"],[5,"Cum"],[6,"Cmt"],[0,"Paz"]];
function renderLog(){
  processLog();
  // laundry
  const dirty=[...dirtySet].map(byId).filter(Boolean), wd=new Date().getDay();
  $("#laundry").innerHTML=(wd===3||wd===6?`<div class="banner">Bugün yıkama günü · ${dirty.length} parça bekliyor</div>`:"")+
    (dirty.length?dirty.map(it=>`<div class="lrow"><span class="thumb">${it.img?`<img src="${it.img}" alt="">`:pieceSVG(it)}</span><div><b>${nm(it)}</b><small>${careText(it)}</small></div><button class="state" data-wash="${it.id}">Yıkandı</button></div>`).join("")+
      `<div class="row-btns" style="margin:0"><button class="btn solid" data-wash="all">Hepsini yıkadım</button></div>`
    :`<p class="empty">Kirli parça yok. Giydiğini "Bunu giyiyorum" ile kaydettikçe Zenon yıkama sayısına göre otomatik işaretler.</p>`);
  // week plan
  $("#week").innerHTML=DAYS.map(([d,n])=>`<label class="wrow"><span>${n}</span><select data-wd="${d}"><option value="">Her gün seç</option>${OCC.map(([k,o])=>`<option value="${k}" ${week[d]===k?"selected":""}>${o}</option>`).join("")}</select></label>`).join("");
  // history + month dots
  const last=[...log].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,14);
  const cells=Array.from({length:28},(_,i)=>{const d=new Date(); d.setDate(d.getDate()-27+i); const k=iso(d), e=log.find(l=>l.d===k);
    return `<span class="cal ${e?"on":""} ${k===TODAY?"today":""}" title="${k}${e?" · "+e.title:""}">${d.getDate()}</span>`;}).join("");
  $("#history").innerHTML=`<div class="calgrid">${cells}</div>`+(last.length?last.map(l=>`<div class="rule"><span>${l.d.slice(5).split("-").reverse().join(".")}${l.applied?"":"<br>plan"}</span><p><b style="font-weight:500">${l.title}</b> · ${l.ids.map(byId).filter(Boolean).map(nm).join(", ")}</p></div>`).join("")
    :`<p class="empty">Henüz kayıt yok. Bugün kartındaki "Bunu giyiyorum" düğmesi buraya yazar.</p>`);
  // stats
  const own=items.filter(i=>!i.planned&&i.cat!=="aks"&&!i.sport);
  const counts=own.map(i=>[i,wearCount(i.id)]).sort((a,b)=>b[1]-a[1]);
  const never=counts.filter(c=>!c[1]).map(c=>c[0]);
  const cpw=own.filter(i=>parsePrice(i.price)).map(i=>[i,parsePrice(i.price),wearCount(i.id)]);
  const colors={}; own.forEach(i=>{const n=(COL[i.c]||COL.black)[0]; colors[n]=(colors[n]||0)+1;});
  const cov=OCC.filter(o=>o[0]!=="ev").map(([k,n])=>[n,FORM.filter(f=>f.occ.includes(k)&&build(f,{t:(f.t[0]+f.t[1])/2,rain:10},true)).length]);
  const liked=Object.entries(votes).filter(([k,v])=>v.v>0).map(([k])=>(FORM.find(f=>f.key===k)||{}).title).filter(Boolean);
  $("#stats").innerHTML=`<div class="budget"><div><span class="label">Kayıt</span><b>${log.filter(l=>l.applied).length}</b></div><div><span class="label">Parça</span><b>${own.length}</b></div><div><span class="label">Hiç giyilmedi</span><b>${never.length}</b></div><div><span class="label">Beğenilen</span><b>${liked.length}</b></div></div>
   <div class="rules">
    <div class="rule"><span>En çok</span><p>${counts.filter(c=>c[1]).slice(0,5).map(([i,n])=>`${nm(i)} (${n})`).join(" · ")||"Henüz kayıt yok"}</p></div>
    <div class="rule"><span>Giyilmedi</span><p>${never.slice(0,8).map(nm).join(" · ")||"Hepsi giyildi ✓"}</p></div>
    <div class="rule"><span>Giyim başı</span><p>${cpw.map(([i,p,n])=>`${nm(i)}: ${n?Math.round(p/n).toLocaleString("tr-TR")+" TL":p.toLocaleString("tr-TR")+" TL (0 giyim)"}`).join("<br>")||"Fiyatı girilmiş parça yok"}</p></div>
    <div class="rule"><span>Renkler</span><p>${Object.entries(colors).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`${n} ${Math.round(c/own.length*100)}%`).join(" · ")}</p></div>
    <div class="rule"><span>Mekânlar</span><p>${cov.map(([n,c])=>`<span class="${c?"":"gap"}">${n} ${c}</span>`).join(" · ")}</p></div>
    <div class="rule"><span>Beğendiğin</span><p>${liked.join(" · ")||"Kombin kartında 👍 ile işaretle"}</p></div>
   </div>`;
}
$("#week").addEventListener("change",e=>{const s=e.target.closest("[data-wd]"); if(!s) return; if(s.value) week[s.dataset.wd]=s.value; else delete week[s.dataset.wd]; store.set("week",week); renderPlan(); renderFit(true); toast("Haftalık plan kaydedildi");});
$("#tripBtn").addEventListener("click",planTrip);
$("#tOcc").innerHTML=OCC.filter(o=>o[0]!=="ev").map(([k,n])=>`<option value="${k}" ${k==="gunluk"?"selected":""}>${n}</option>`).join("");
$("#icsBtn").addEventListener("click",reminderICS);
$("#bkDown").addEventListener("click",()=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([backupData()],{type:"application/json"})); a.download=`zenon-yedek-${TODAY}.json`; a.click(); toast("Yedek indirildi"); });
$("#bkCopy").addEventListener("click",async()=>{ try{ await navigator.clipboard.writeText(backupData()); toast("Yedek panoya kopyalandı"); }catch(e){ $("#bkText").value=backupData(); $("#bkText").select(); toast("Metni seçip kopyala"); } });
$("#bkRestore").addEventListener("click",()=>{ try{ restoreData($("#bkText").value); }catch(e){ toast("Yedek okunamadı"); } });
$("#bkFile").addEventListener("change",e=>{ const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ try{ restoreData(t); }catch(err){ toast("Yedek okunamadı"); } }); });
const APP_VER="v11 · 9 Ekim 2026"; let swReg=null;
$("#appVer").textContent=`Zenon ${APP_VER}`;
if("serviceWorker" in navigator && location.protocol==="https:" && !/claude\.ai|claudeusercontent/.test(location.host)){ try{
  const hadCtrl=!!navigator.serviceWorker.controller; let reloaded=false;
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(reg=>{ swReg=reg; reg.update().catch(()=>{}); }).catch(()=>{});
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(!hadCtrl||reloaded) return; reloaded=true; try{ sessionStorage.setItem("zenonUpdated","1"); }catch(e){} location.reload(); });
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&swReg) swReg.update().catch(()=>{}); });
}catch(e){} }
try{ if(sessionStorage.getItem("zenonUpdated")){ sessionStorage.removeItem("zenonUpdated"); setTimeout(()=>toast(`Zenon güncellendi · ${APP_VER}`),600); } }catch(e){}
$("#verBtn").addEventListener("click",()=>{ if(!swReg) return location.reload(); toast("Denetleniyor…"); swReg.update().then(()=>{ if(!(swReg.installing||swReg.waiting)) toast(`Zenon güncel · ${APP_VER}`); }).catch(()=>location.reload()); });


processLog(); renderSizeLab(); renderCapsule(); renderCart(); renderLog(); renderWx(); renderPlan(); renderFit(false); renderFilters(); renderList(); renderLook(); renderShop(); renderCands(); renderCare(); renderTodo(); renderProgress(); renderMonth(); renderPerf(); renderShopSub(); renderA2(); renderScent(); renderLift(); renderLabs(); renderBodyGuides(); renderPush(); syncPush(); pullSteps(true);
if(location.hash.length>1) goView(location.hash.slice(1));
loadWx();
})();
