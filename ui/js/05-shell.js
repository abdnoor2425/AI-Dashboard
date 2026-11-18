/* ---------- nav ---------- */
const NAV=[['Today'],['overview','Overview','overview'],['attention','Needs you','needs'],['news','AI news','news'],['Business'],['money','Money','money'],['goals','Goals','goals'],['website','Website','web'],['social','Social and reels','social'],['Your AI'],['made','AI made','made'],['brain','Second Brain','brain'],['room','Decision Room','room'],['team','Your team','team'],['Setup'],['connections','Connections','plug'],['settings','Settings','gear'],['more','More','more']];
/* A page the owner switched off in Settings leaves the rail. Names in the rail that differ from the module's id are mapped here. */
const MOD={money:'money',goals:'goals',news:'news',made:'outputs',brain:'second-brain',room:'decisions'};
function drawNav(){const mods=(BOOT.workspace&&BOOT.workspace.modules)||{},n=(BOOT.counts&&BOOT.counts.attention)||0;
  const rows=NAV.filter(x=>x.length===1||mods[MOD[x[0]]||x[0]]!==false).filter((x,i,a)=>x.length>1||(a[i+1]&&a[i+1].length>1));
  $('#nav').innerHTML=rows.map(x=>x.length===1?`<div class="grp">${x[0]}</div>`:`<a href="#${x[0]}" data-p="${x[0]}">${ic(x[2])}${x[1]}${x[0]==='attention'&&n?`<span class="cnt num">${n}</span>`:''}</a>`).join('');
  const w=BOOT.workspace||{},me=String(w.owner||'You').trim()||'You';
  $('#wsName').textContent=w.name||'';$('#meN').textContent=me;$('#meI').textContent=me.charAt(0).toUpperCase();$('#meR').textContent=w.kind==='client'?'Client workspace':'Owner';
  /* The chip says the same thing as Connections: an AI counts once it is connected there. Until then it offers the scan. */
  const ai=BOOT.ai,chip=$('#aiChip'),on=!!(ai&&ai.name&&ai.linked!==false);chip.href=on?'#connections':'#scan';chip.innerHTML=on?`<span class="dot ok"></span>${esc(ai.name)} connected`:'<span class="dot"></span>Scan for AI';
  if(typeof route==='function'&&navDrawn)markNav();navDrawn=true}
let navDrawn=false;
drawNav();
$('#menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
const hr=new Date().getHours();
const FIRST=String((BOOT.workspace&&BOOT.workspace.owner)||'').trim().split(/\s+/)[0];
const HELLO=`Good ${hr<12?'morning':hr<18?'afternoon':'evening'}${FIRST&&FIRST!=='You'?', '+esc(FIRST):''}.`;

function tick(){const t=new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});$$('[data-clock]').forEach(e=>e.textContent=t)}
setInterval(tick,20000);

/* ---------- WebGL helpers ---------- */
const NOISE=`float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n2(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}`;
function glp(cv,frag,opt){let gl;try{gl=cv.getContext('webgl',Object.assign({antialias:false,alpha:false},opt||{}))}catch(e){}if(!gl)return null;
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(o));return null}return o};
  const vs=mk(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'),fs=mk(gl.FRAGMENT_SHADER,'precision highp float;\n'+frag);if(!vs||!fs)return null;
  const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))return null;gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
  const U={};return{gl,u:n=>U[n]||(U[n]=gl.getUniformLocation(p,n)),draw(){gl.viewport(0,0,cv.width,cv.height);gl.drawArrays(gl.TRIANGLES,0,3)}}}

/* ---------- four looks: two light, two dark. Until you pick one, it follows the clock ---------- */
const LOOKS={
 dawn:{name:'Dawn',dark:0,bg:[.955,.925,.885],c1:[1,.79,.66],c2:[.86,.81,.96],c3:[1,1,1],vg:.2,lt:1,orb:[[.17,.08,.10],[1,.72,.52]]},
 day:{name:'Day',dark:0,bg:[.925,.945,.965],c1:[.68,.84,.99],c2:[.79,.95,.90],c3:[1,1,1],vg:.18,lt:1,orb:[[.05,.13,.21],[.72,.90,1]]},
 dusk:{name:'Dusk',dark:1,bg:[.085,.062,.085],c1:[.34,.13,.09],c2:[.22,.10,.24],c3:[1,.74,.44],vg:.8,lt:0,orb:[[.19,.08,.05],[1,.78,.44]]},
 night:{name:'Night',dark:1,bg:[.022,.024,.03],c1:[.05,.08,.19],c2:[.03,.14,.16],c3:[.62,.74,1],vg:.9,lt:0,orb:[[.05,.08,.19],[.62,.74,1]]}};
let look=hr>=5&&hr<8?'dawn':hr>=8&&hr<17?'day':hr>=17&&hr<20?'dusk':'night';
try{const s=localStorage.getItem('aid-look');if(LOOKS[s])look=s}catch(e){}
const L0=LOOKS[look],pal={bg:L0.bg.slice(),c1:L0.c1.slice(),c2:L0.c2.slice(),c3:L0.c3.slice(),o1:L0.orb[0].slice(),o3:L0.orb[1].slice(),vg:L0.vg,lt:L0.lt};
$('#looks').innerHTML=Object.keys(LOOKS).map(k=>`<button type="button" role="radio" data-k="${k}" aria-checked="false" title="${LOOKS[k].name}: ${LOOKS[k].dark?'dark':'light'}">${ic(k,1.7)}<span>${LOOKS[k].name}</span></button>`).join('');
function setLook(k,user){look=k;const root=document.documentElement;
  if(user){root.classList.add('swap');setTimeout(()=>root.classList.remove('swap'),650);try{localStorage.setItem('aid-look',k)}catch(e){}}
  root.dataset.look=k;root.dataset.theme=LOOKS[k].dark?'dark':'light';dispatchEvent(new CustomEvent('aid:look',{detail:{look:k}}));$$('#looks button').forEach(b=>b.setAttribute('aria-checked',b.dataset.k===k));
  if(fontsDone){drawRev();if(!$('#p-money').hidden)drawMoney()}layNews();drawDeck();
  if(B.ready)mkSprites();if(reduce)frame(0)}
$$('#looks button').forEach(b=>b.onclick=()=>setLook(b.dataset.k,true));

/* ---------- live background ---------- */
const flowCv=$('#flow');
const flow=glp(flowCv,NOISE+`uniform vec2 r;uniform float t,sc,vg,lt;uniform vec3 bg,c1,c2,c3;
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/min(r.y,r.x*.8);p.y+=sc;float tt=t*.03;
 vec2 q=vec2(fbm(p*1.15+vec2(0.,tt)),fbm(p*1.15+vec2(5.2,-tt)));
 vec2 w=vec2(fbm(p*1.3+3.*q+vec2(1.7,9.2)+tt*.7),fbm(p*1.3+3.*q+vec2(8.3,2.8)-tt*.5));
 float f=fbm(p*1.2+3.2*w);
 vec3 col=bg;
 col=mix(col,c1,smoothstep(.3,.95,f)*.62);
 col=mix(col,c2,smoothstep(.25,.9,length(w))*.34*smoothstep(.2,.8,f));
 col=mix(col,c3,pow(smoothstep(.56,.98,f),3.)*(.2+lt*.3));
 float l=abs(sin((f*8.+w.x*4.)*3.1416));col=mix(col,c3,pow(1.-l,26.)*(.07+lt*.5)*smoothstep(.3,.7,f));
 col*=1.-vg*dot(uv-.5,uv-.5);
 col+=(h(gl_FragCoord.xy+t)-.5)*.014;
 gl_FragColor=vec4(col,1.);}`);
function sizeFlow(){const s=.4;flowCv.width=Math.max(2,Math.round(innerWidth*s));flowCv.height=Math.max(2,Math.round(Math.min(innerHeight,1400)*s))}
sizeFlow();addEventListener('resize',sizeFlow);
if(!flow)flowCv.style.display='none';

/* ---------- the living orb: the rail card, and a live copy wherever a layout shows it ---------- */
const OS=560,orbCv=$('#orb');orbCv.width=orbCv.height=OS;
const orb=glp(orbCv,NOISE+`uniform vec2 r,m;uniform float t,amp,hv;uniform vec3 c1,c3;
void main(){vec2 p=(gl_FragCoord.xy-.5*r)/r.y*2.9;p.y-=.28;float d=length(p);
 vec3 col=vec3(.012,.014,.02);float nb=fbm(p*1.1+vec2(t*.02,3.));
 col+=c1*pow(nb,2.)*1.3;col+=vec3(step(.9975,h(floor(gl_FragCoord.xy/2.))))*.5;
 col+=c3*(.16+.14*hv)*exp(-2.6*max(d-1.,0.));
 if(d<1.){float z=sqrt(1.-d*d);vec3 n=vec3(p,z);vec2 dm=p-m;float mg=hv*exp(-2.4*dot(dm,dm));vec2 q=rot(t*.1)*(n.xy/(1.+z)*1.7)+dm*mg*.7;
  float f=fbm(q*2.1+vec2(t*.09,-t*.06)+fbm(q*3.+t*.05)*(1.4+amp));
  vec3 b=mix(vec3(.02,.025,.04),c1*2.4,smoothstep(.25,.75,f));b=mix(b,c3,pow(smoothstep(.5,.95,f),2.)*.95);
  vec3 L=normalize(vec3(-.5+m.x*.95*hv,.6+m.y*.75*hv,.65));b*=.35+.75*max(dot(n,L),0.);
  b+=c3*pow(1.-z,2.4)*.8;b+=mix(c1,c3,.6)*mg*.55;b+=vec3(1.)*pow(max(dot(reflect(vec3(0.,0.,-1.),n),L),0.),34.)*.95;
  col=mix(col,b,smoothstep(1.,.98,d));}
 gl_FragColor=vec4(col,1.);}`);
let orbCopies=[],oh=0,ohT=0,om=[0,0],omT=[0,0],orbT=12,orbEl=null;const OR=OS/2.9,OX=OS/2-OR,OY=OS-(OS/2+.28*OR)-OR;
let playing=false,scrollY0=0,fno=0,last=0,fontsDone=false;
function frame(ms){const t=ms/1000,dt=clamp((ms-last)/1000,0,.05)||.016,lastP=last||ms;last=ms;fno++;
  const L=LOOKS[look],k=reduce?1:1-Math.exp(-Math.min(1,Math.max(.016,(ms-lastP)/1000))*3.2),mv=(a,b)=>{for(let i=0;i<3;i++)a[i]+=(b[i]-a[i])*k};
  mv(pal.bg,L.bg);mv(pal.c1,L.c1);mv(pal.c2,L.c2);mv(pal.c3,L.c3);mv(pal.o1,L.orb[0]);mv(pal.o3,L.orb[1]);pal.vg+=(L.vg-pal.vg)*k;pal.lt+=(L.lt-pal.lt)*k;
  if(flow&&(fno%2===0||reduce)){const g=flow.gl;g.uniform2f(flow.u('r'),flowCv.width,flowCv.height);g.uniform1f(flow.u('t'),t+40);g.uniform1f(flow.u('sc'),scrollY0*.00035);g.uniform1f(flow.u('vg'),pal.vg);g.uniform1f(flow.u('lt'),pal.lt);g.uniform3fv(flow.u('bg'),pal.bg);g.uniform3fv(flow.u('c1'),pal.c1);g.uniform3fv(flow.u('c2'),pal.c2);g.uniform3fv(flow.u('c3'),pal.c3);flow.draw()}
  if(orb){const g=orb.gl;g.uniform2f(orb.u('r'),OS,OS);oh+=(ohT-oh)*.08;om[0]+=(omT[0]-om[0])*.12;om[1]+=(omT[1]-om[1])*.12;orbT+=dt*(1+oh*2.4);g.uniform1f(orb.u('t'),orbT);g.uniform1f(orb.u('amp'),(playing?1.6:0)+oh*.9);g.uniform2f(orb.u('m'),om[0],om[1]);g.uniform1f(orb.u('hv'),oh);g.uniform3fv(orb.u('c1'),pal.o1);g.uniform3fv(orb.u('c3'),pal.o3);orb.draw();
    orbCopies.forEach(c=>{if(c[0].isConnected)c[1].drawImage(orbCv,OX,OY,OR*2,OR*2,0,0,c[0].width,c[0].height)});
    if(orbEl&&orbEl.isConnected){const s=orbEl.style;s.setProperty('--ox',(om[0]*oh*12).toFixed(1)+'px');s.setProperty('--oy',(-om[1]*oh*12).toFixed(1)+'px');s.setProperty('--os',(1+oh*.045).toFixed(3))}}
  if(B.ready&&!$('#p-brain').hidden)drawBrain(t,dt);
  if(!$('#p-overview').hidden)drawGx(t,dt);
  if(!reduce)requestAnimationFrame(frame)}
