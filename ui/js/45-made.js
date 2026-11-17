/* ---------- AI made: generated stand-in pictures ---------- */
const AIS={'Claude Code':'#EBC57C','Codex':'#5FE0B0','Gemini CLI':'#8AD4FF','Higgsfield':'#FF9A6B','ChatGPT':'#B9A2FF'};
const BASE=[['Harbor holiday reel, cut 2','video','Higgsfield','Harbor Coffee Co.','Warm cafe interior, steam rising, slow push in, 9:16','0:18','First sip of winter'],['Platewise hero image','image','ChatGPT','Platewise','Studio render for the new box launch, dark, one warm light',''],['Northline quote form fix','code','Claude Code','Northline Movers','Fix the quote form so the postcode field accepts spaces',''],['Q4 client report','doc','Claude Code','Meridian Capital','Write the Q4 summary for Meridian with the numbers from Linear','','Q4 report'],['Meridian landing page','site','Gemini CLI','Meridian Capital','Landing page for the year-end portfolio check','','Know where you stand.'],['Founder clip with captions','video','Higgsfield','Atlas Notes','Add word-timed captions to the founder clip','0:42','Why we started'],['Fernway brand objects','image','ChatGPT','Fernway Studio','Three abstract brand objects, glass and brass',''],['Site speed patch','code','Codex','Platewise','Lazy-load images below the fold on the menu page',''],['Product B-roll pack','video','Higgsfield','Platewise','Six 5-second clips, top-down, soft light','0:30','Made fresh, every Sunday'],['Weekly social calendar','doc','Gemini CLI','Kenneth','Plan next week of posts for the five brands','','Week 47 calendar'],['Harbor winter page','site','Claude Code','Harbor Coffee Co.','Winter menu page with the three new drinks','','Coffee, roasted Tuesday.'],['Email welcome sequence','doc','Codex','Atlas Notes','Three welcome emails for new subscribers','','Welcome sequence'],['Brand intro motion','video','Higgsfield','Fernway Studio','Logo reveal, brass light sweep, 4 seconds','0:04','Fernway'],['Dashboard chart tweak','code','Claude Code','AI-Dashboard','Make the revenue chart start at zero',''],['Northline hero render','image','Gemini CLI','Northline Movers','Abstract stacked boxes, studio light, for the hero',''],['Atlas issue cover','image','ChatGPT','Atlas Notes','Cover art for issue 143, a twisted ribbon in ice blue','']];
const PALS=[[[.10,.07,.03],[1,.70,.36],[1,.92,.74]],[[.03,.07,.12],[.36,.72,1],[.86,.95,1]],[[.11,.04,.06],[1,.42,.52],[1,.84,.80]],[[.03,.10,.08],[.30,.92,.70],[.84,1,.93]],[[.07,.07,.08],[.82,.84,.92],[1,1,1]],[[.08,.05,.13],[.68,.56,1],[.94,.88,1]]];
const items=[];for(let i=0;i<48;i++){const b=BASE[i%BASE.length];const day=Math.min(13,Math.floor(i/3.6));items.push({id:i,title:b[0]+(i>=16?' · v'+(1+Math.floor(i/16)):''),type:b[1],ai:b[2],project:b[3],prompt:b[4],len:b[5],txt:b[6]||b[0],day,when:day===0?'Today':day===1?'Yesterday':day+' days ago',img:''})}
const KIND={image:'IMAGE',video:'VIDEO',doc:'DOC',code:'CODE',site:'PAGE'};
function makeThumbs(){
  const gc=document.createElement('canvas');gc.width=gc.height=480;
  const R=glp(gc,`uniform vec2 r;uniform float sd;uniform int sc;uniform vec3 ca,cb,cc;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float rbox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float map(vec3 p){p.xz=rot(sd*1.3)*p.xz;p.xy=rot(sd*.7)*p.xy;
 if(sc==0){vec2 q=vec2(length(p.xy)-.78,p.z);float d=length(q)-.17;vec3 p2=p-vec3(.5,0.,0.);q=vec2(length(p2.xz)-.78,p2.y);return min(d,length(q)-.17);}
 if(sc==1){vec2 q=vec2(length(p.xz)-.74,p.y);float d=length(q)-.27;return min(d,length(p)-.3);}
 if(sc==2){float d=rbox(p,vec3(.44),.1);d=min(d,rbox(p-vec3(.74,.6,.2),vec3(.2),.07));d=min(d,rbox(p+vec3(.8,.46,-.1),vec3(.26),.08));return d;}
 p.xy=rot(p.z*1.5)*p.xy;return rbox(p,vec3(.9,.07,.75),.05);}
vec3 env(vec3 d){float y=d.y*.5+.5;vec3 c=mix(ca*.6,cb*.55,smoothstep(.1,1.,y));float sb=smoothstep(.28,.36,d.y)*smoothstep(.86,.78,d.y)*smoothstep(-.55,-.45,d.x)*smoothstep(.4,.3,d.x)*step(0.,d.z);c+=cc*sb*1.5;c+=cb*smoothstep(.55,.7,-d.x)*smoothstep(.5,.1,abs(d.y))*.9;c+=ca*4.*pow(max(dot(d,normalize(vec3(.1,-.9,.3))),0.),3.);return c;}
void main(){vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;vec3 ro=vec3(0.,0.,3.2),rd=normalize(vec3(uv,-1.75));
 float t=0.;float hit=0.;for(int i=0;i<80;i++){float d=map(ro+rd*t);if(d<.002){hit=1.;break;}t+=d;if(t>8.)break;}
 vec3 col=ca*.55*(1.-length(uv)*.9)+cb*.16*exp(-4.*length(uv-vec2(.25,.3)));
 if(hit>.5){vec3 p=ro+rd*t;vec2 e=vec2(.002,0.);vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
  vec3 rf=reflect(rd,n);float fr=pow(1.-max(dot(-rd,n),0.),3.);col=env(rf)*(.34+.9*fr)+ca*.22;}
 else{float fl=smoothstep(-.2,-.75,uv.y);col+=cb*.07*fl;}
 col=col/(1.+col*.35);col=pow(col,vec3(.92));col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.035;
 gl_FragColor=vec4(col,1.);}`,{preserveDrawingBuffer:true});
  const c2=document.createElement('canvas');c2.width=480;c2.height=360;const x=c2.getContext('2d');
  const render=(seed,scene)=>{const P=PALS[seed%PALS.length];if(R){const g=R.gl;g.uniform2f(R.u('r'),480,480);g.uniform1f(R.u('sd'),seed*1.37+.4);g.uniform1i(R.u('sc'),scene);g.uniform3fv(R.u('ca'),P[0]);g.uniform3fv(R.u('cb'),P[1]);g.uniform3fv(R.u('cc'),P[2]);R.draw();return gc}
    const f=document.createElement('canvas');f.width=f.height=480;const k=f.getContext('2d');const rgb=c=>`rgb(${c.map(v=>v*255|0)})`;const g=k.createRadialGradient(300,160,10,240,240,420);g.addColorStop(0,rgb(P[1]));g.addColorStop(.5,rgb(P[0]));g.addColorStop(1,'#050506');k.fillStyle=g;k.fillRect(0,0,480,480);return f};
  const F=(w,s)=>`${w} ${s}px Geist, Inter, sans-serif`;
  items.forEach((it,i)=>{const sc=[0,1,2,3][(i*3+1)%4];
    if(it.type==='image'){it.img=render(i+2,sc).toDataURL('image/jpeg',.86);return}
    x.clearRect(0,0,480,360);
    if(it.type==='video'){x.drawImage(render(i+5,sc),0,-60,480,480);const g=x.createLinearGradient(0,150,0,360);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.8)');x.fillStyle=g;x.fillRect(0,0,480,360);
      x.font=F(600,24);x.fillStyle='#fff';x.textAlign='center';x.fillText(it.txt,240,248);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(150,268,180,3);x.fillStyle='#fff';x.fillRect(150,268,60+(i*37)%110,3);
      x.beginPath();x.arc(240,150,30,0,7);x.fillStyle='rgba(255,255,255,.92)';x.fill();x.beginPath();x.moveTo(231,136);x.lineTo(231,164);x.lineTo(255,150);x.closePath();x.fillStyle='#07080A';x.fill()}
    else if(it.type==='site'){x.fillStyle='#0B0C0F';x.fillRect(0,0,480,360);x.drawImage(render(i+1,sc),250,40,270,270);const g=x.createLinearGradient(230,0,330,0);g.addColorStop(0,'#0B0C0F');g.addColorStop(1,'rgba(11,12,15,0)');x.fillStyle=g;x.fillRect(230,0,110,360);
      x.fillStyle='rgba(255,255,255,.9)';x.fillRect(24,22,14,14);x.fillStyle='rgba(255,255,255,.3)';[0,1,2].forEach(k=>x.fillRect(330+k*44,26,30,5));
      x.fillStyle='#F5F3EF';x.textAlign='left';x.font=F(600,31);const words=it.txt.split(' ');let line='',y=140;words.forEach(w=>{if(x.measureText(line+w).width>230){x.fillText(line,24,y);y+=36;line=''}line+=w+' '});x.fillText(line,24,y);
      x.fillStyle='rgba(255,255,255,.35)';x.fillRect(24,y+22,180,5);x.fillRect(24,y+36,140,5);x.fillStyle='#EBC57C';x.beginPath();x.roundRect(24,y+62,104,30,15);x.fill()}
    else if(it.type==='doc'){x.fillStyle='#15161B';x.fillRect(0,0,480,360);x.fillStyle='#F4F2EC';x.beginPath();x.roundRect(90,36,300,360,10);x.fill();x.fillStyle='#14161C';x.textAlign='left';x.font=F(600,22);x.fillText(it.txt,116,84);x.fillStyle='rgba(20,22,28,.22)';for(let k=0;k<9;k++)x.fillRect(116,108+k*17,[240,220,248,180,236,210,244,150,228][k],6);
      x.fillStyle='#C99B45';[38,56,44,70,64,88].forEach((hh,k)=>x.fillRect(116+k*28,340-hh,18,hh))}
    else{x.fillStyle='#0A0B0E';x.fillRect(0,0,480,360);x.fillStyle='rgba(255,255,255,.06)';x.fillRect(0,0,480,34);['#FF7A7A','#F4B860','#5FE0B0'].forEach((c,k)=>{x.fillStyle=c;x.beginPath();x.arc(20+k*18,17,5,0,7);x.fill()});
      x.font='500 16px "Geist Mono", monospace';x.textAlign='left';const L=[[' ','export function check(input) {','#A9AAB2'],['-','  const zip = input.trim()','#FF7A7A'],['+','  const zip = strip(input)','#5FE0B0'],[' ','  return validate(zip)','#A9AAB2'],[' ','}','#A9AAB2'],[' ','','#fff'],['+','test("accepts spaces", () => {','#5FE0B0'],['+','  expect(check("SW1A 1AA"))','#5FE0B0'],['+','})','#5FE0B0']];
      L.forEach((l,k)=>{const y=70+k*31;if(l[0]!==' '){x.fillStyle=l[0]==='+'?'rgba(95,224,176,.10)':'rgba(255,122,122,.10)';x.fillRect(0,y-21,480,31)}x.fillStyle='rgba(255,255,255,.25)';x.fillText(String(k+12),14,y);x.fillStyle=l[2];x.fillText(l[0]+' '+l[1],46,y)})}
    it.img=c2.toDataURL('image/jpeg',.88)});
}
const TYPES=[['all','All'],['image','Images'],['video','Video'],['site','Pages'],['doc','Documents'],['code','Code']];
let fType='all',fAi=null,fDay=null;
const thumb=it=>`<img alt="" src="${it.img}" loading="lazy">`;
function drawMedia(){const q=$('#q').value.trim().toLowerCase();const list=items.filter(it=>(fType==='all'||it.type===fType)&&(!fAi||it.ai===fAi)&&(fDay==null||it.day===fDay)&&(!q||(it.title+' '+it.prompt+' '+it.project+' '+it.ai+' '+it.type).toLowerCase().includes(q)));
  $('#count').textContent=list.length+' of 214';
  $('#media').innerHTML=list.length?list.map(it=>`<button class="mt" data-id="${it.id}" type="button"><div class="th">${thumb(it)}<span class="kind">${KIND[it.type]}</span>${it.len?`<span class="len">${it.len}</span>`:''}</div><div class="meta"><b>${it.title}</b><small><i style="background:${AIS[it.ai]}"></i>${it.ai} · ${it.when}</small></div></button>`).join(''):`<div class="panel mini" style="grid-column:1/-1;text-align:center;padding:50px"><div class="h2" style="font-size:28px">Nothing matches.</div><p class="mut">Try fewer words or another AI.</p></div>`;
  $$('.mt').forEach(t=>t.onclick=()=>openItem(items[+t.dataset.id]))}
$('#filters').innerHTML=TYPES.map(([k,l])=>`<button class="chip" type="button" data-t="${k}" aria-pressed="${k==='all'}">${l}</button>`).join('')+'<span class="vr"></span>'+Object.entries(AIS).map(([k,c])=>`<button class="chip" type="button" data-a="${k}" aria-pressed="false"><i style="background:${c}"></i>${k}</button>`).join('');
$$('#filters [data-t]').forEach(b=>b.onclick=()=>{fType=b.dataset.t;$$('#filters [data-t]').forEach(x=>x.setAttribute('aria-pressed',x===b));drawMedia()});
$$('#filters [data-a]').forEach(b=>b.onclick=()=>{fAi=fAi===b.dataset.a?null:b.dataset.a;$$('#filters [data-a]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.a===fAi));drawMedia()});
const perDay=[9,14,22,11,18,25,8,6,19,16,21,13,17,15];
$('#days').innerHTML=perDay.map((n,i)=>`<button type="button" aria-pressed="false" data-d="${13-i}" aria-label="${n} made" title="${n} made" style="height:${n/25*100}%"></button>`).join('');
$$('#days button').forEach(b=>b.onclick=()=>{fDay=+b.dataset.d===fDay?null:+b.dataset.d;$$('#days button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.d===fDay));$('#clearDay').hidden=fDay==null;drawMedia()});
$('#clearDay').onclick=()=>{fDay=null;$$('#days button').forEach(x=>x.setAttribute('aria-pressed','false'));$('#clearDay').hidden=true;drawMedia()};
$('#q').oninput=drawMedia;
function openItem(it){$('#sPic').innerHTML=thumb(it);$('#sKind').textContent=KIND[it.type];$('#sTitle').textContent=it.title;
  $('#sKv').innerHTML=`<div><dt>Made by</dt><dd style="color:var(--text)">${it.ai} · ${it.when}</dd></div><div><dt>Project</dt><dd>${it.project}</dd></div><div><dt>Prompt</dt><dd>${it.prompt}</dd></div><div><dt>Saved in</dt><dd style="font-family:var(--mono);font-size:11.5px">Downloads\\${it.project.split(' ')[0]}\\</dd></div>`;
  $('#sheet').hidden=false;$('#sClose').focus()}
$('#sClose').onclick=()=>$('#sheet').hidden=true;$('#sheet').onclick=e=>{if(e.target.id==='sheet')$('#sheet').hidden=true};
addEventListener('keydown',e=>{if(e.key==='Escape'){$('#sheet').hidden=true;$('#tmenu').hidden=true}});
let ringItems=[];const ringR=()=>{const n=ringItems.length||12;return ($('#ring').offsetWidth||230)/2/Math.tan(Math.PI/n)+34};
function buildRing(){ringItems=items.filter(i=>i.type==='image'||i.type==='video').slice(0,12);const R=ringR(),st=360/ringItems.length;$('#ring').innerHTML=ringItems.map((it,i)=>`<figure data-id="${it.id}" style="transform:rotateY(${i*st}deg) translateZ(${R}px)">${thumb(it)}<figcaption>${it.title}<br>${it.ai}</figcaption></figure>`).join('');$$('#ring figure').forEach(f=>f.onclick=()=>openItem(items[+f.dataset.id]))}
function fillMade(){if(!items[0].img)return;const m=items.filter(i=>i.type!=='code');const fig=it=>`<figure>${thumb(it)}<figcaption>${it.ai}</figcaption></figure>`;
  const wc=it=>`<figure data-it="${it.id}">${thumb(it)}<figcaption><i style="background:${AIS[it.ai]}"></i>${it.ai}<em>${KIND[it.type]}</em></figcaption>${it.len?`<span class="wlen">${PLAY}${it.len}</span>`:''}</figure>`;
  $$('[data-made]').forEach(h=>{const k=h.dataset.made;h.innerHTML=k==='wall'?`<div class="wall-in">${[0,1,2,3,4].map(r=>{const L=m.filter((_,i)=>i%5===r).slice(0,8);return `<div class="wrow" style="--d:${[92,70,104,80,96][r]}s;--dir:${r%2?'reverse':'normal'}">${L.concat(L).map(wc).join('')}</div>`}).join('')}</div>`:k==='marq'?m.slice(0,14).concat(m.slice(0,14)).map(fig).join(''):k==='mos'?m.slice(0,6).map(fig).join('')+'<a class="morec" href="#made"><span class="num">+208</span><small>more</small></a>':m.slice(0,6).map(fig).join('')})}
function mediaReady(){makeThumbs();drawMedia();buildRing();fillMade();onScroll()}
const kick=()=>{if(fontsDone)return;fontsDone=true;mediaReady();drawRev();if(!$('#p-money').hidden)drawMoney()};
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(kick);setTimeout(kick,1800);
