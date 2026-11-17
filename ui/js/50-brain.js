/* ---------- Second Brain: every file a point, three shapes, data flowing along the links ---------- */
const AREAS=[['Client work','#EBC57C','#B37A14',312],['Meetings','#FF9A6B','#D5571F',204],['Playbooks','#FF7FB2','#C93474',148],['AI memory','#B9A2FF','#6548D8',176],['Decisions','#8AD4FF','#1877BD',96],['Projects','#5FE0B0','#0C8A66',118],['Skills and agents','#EDEBE5','#59606E',74]];
const NB=AREAS.reduce((s,a)=>s+a[3],0);
const CL=['Harbor Coffee Co.','Platewise','Meridian Capital','Northline Movers','Fernway Studio','Atlas Notes'];
const HUBS=[CL,['Weekly client calls','Team stand-ups','Discovery calls'],['Reel scorecard','Client onboarding','Launch checklist'],['Claude Code memory','Codex memory','Gemini memory'],['Q4 pricing decision','Retainer terms'],['Holiday campaigns','Website rebuilds','Year-end reports'],['Brief writer (agent)','Reel scorer (skill)','Invoice chaser (agent)']];
const FILES=[['brief','holiday campaign plan','reel script','invoice notes','brand guide','launch plan','feedback round','contract'],['call notes','weekly sync','kickoff notes','review call','planning call'],['how we score reels','how we onboard','how we invoice','how we brief an AI','posting checklist'],['what worked','client preferences','tone of voice','lessons learned','saved prompts'],['decision record','options weighed','why we said no'],['timeline','task list','asset list','status update'],['skill file','agent rules','examples','test run']];
const SHAPES=[['sphere','Sphere'],['galaxy','Galaxy'],['brain','Brain']],SVIEW={sphere:.2,galaxy:.98,brain:.14};
const B={ready:false,shape:'sphere',linkShape:'sphere',gA:0,yawT:null,yaw:.5,pitch:.2,tp:.2,zoom:1,vy:.0018,drag:false,hover:-1,sel:-1,iso:-1,fold:-1,peek:-1,zt:0,q:'',flow:true,names:true,mt:9,linkA:1,coreK:1,links:null,adj:null};
let bCen,GH={},bArea,bSize,bName,bHub,bLab,bPos={},bLk={},bCur,bFrom,bDelay,bScr,bVis,bHot,bOrder,bNb,bMatch,pulses=[],waves=[],sprites=[],pSprite,bx,ptr={x:-999,y:-999,in:false},nextWave=3;
const fib=(n,i)=>{const y=1-2*(i+.5)/n,rr=Math.sqrt(1-y*y),a=i*2.399963;return [Math.cos(a)*rr,y,Math.sin(a)*rr]};
function brainPoint(r,lobe){const gs=()=>(r()+r()+r()+r()-2)*1.732;
  const dir=()=>{const y=r()*2-1,a=r()*6.2832,q=Math.sqrt(1-y*y);return [Math.cos(a)*q,y,Math.sin(a)*q]};
  for(let k=0;k<600;k++){
    if(lobe===5){const u=r(),a=r()*6.2832,rad=.115-.045*u;return [Math.cos(a)*rad,-.34-u*.6,-.3-u*.13+Math.sin(a)*rad]}
    if(lobe===6){const d=dir(),s=.2+r()*.5;return [d[0]*.5*s,.1+d[1]*.38*s,d[2]*.7*s]}
    if(lobe===4){const s=r()<.5?-1:1,d=dir();const x=s*.24+d[0]*.3,y=-.45+d[1]*.2,z=-.6+d[2]*.28;if(s*x<.015)continue;if(Math.sin(y*64+z*10)<-.1)continue;if(y>-.3&&z>-.5)continue;return [x,y,z]}
    if(lobe===3){const s=r()<.5?-1:1,d=dir();if(d[1]>.45)continue;const x=s*.46+d[0]*.2,y=-.3+d[1]*.19,z=.2+d[2]*.46;if(Math.sin(d[2]*9+d[1]*6)<-.45)continue;return [x,y,z]}
    const d=dir();let x=d[0]*.66,y=d[1]*.56+.1,z=d[2]*.92;
    if(y<-.16)y=-.16+(y+.16)*.3;
    x*=1-.18*Math.max(0,z/.92)-.04*Math.max(0,-z/.92);
    if(Math.abs(x)<.028)continue;
    y-=.085*Math.exp(-(x*x)/.005);
    const reg=z>.2?0:z<-.4?2:1;if(reg!==lobe)continue;
    if(reg===1&&y<-.05&&r()<.75)continue;
    const a=Math.atan2(d[2],d[0]),b=Math.asin(d[1]);const g=Math.sin(a*8+2.8*Math.sin(b*6+a*2.2)+b*4.5);
    if(g<-.3)continue;const s=1+.03*g;return [x*s,y*s,z*s]}
  return [0,0,0]}
function brainInit(){if(B.ready)return;B.ready=true;const N=NB,r=rng(77),gs=()=>(r()+r()+r()+r()-2)*1.732;
  bArea=new Uint8Array(N);bSize=new Float32Array(N);bName=new Array(N);bHub=new Uint8Array(N);bLab=new Uint8Array(N);bCur=new Float32Array(N*3);bFrom=new Float32Array(N*3);bDelay=new Float32Array(N);bScr=new Float32Array(N*4);bVis=new Float32Array(N).fill(1);bHot=new Float32Array(N);bOrder=new Uint16Array(N);bNb=new Uint8Array(N);bMatch=new Uint8Array(N);
  /* sphere: each area owns one region of the surface */
  const pts=[];for(let i=0;i<N;i++)pts.push(fib(N,i));
  const cen=bCen=AREAS.map((_,i)=>fib(7,(i*3)%7));
  const lists=cen.map(c=>pts.map((p,i)=>[i,(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2]).sort((a,b)=>a[1]-b[1]).map(v=>v[0]));
  const owner=new Int8Array(N).fill(-1),need=AREAS.map(a=>a[3]),at=AREAS.map(()=>0);
  for(let left=N;left>0;left--){let best=0,bv=-1;for(let a=0;a<7;a++){const v=need[a]/AREAS[a][3];if(v>bv){bv=v;best=a}}while(owner[lists[best][at[best]]]!==-1)at[best]++;owner[lists[best][at[best]]]=best;need[best]--}
  const S=new Float32Array(N*3),G=new Float32Array(N*3),BR=new Float32Array(N*3),lobeOf=[0,1,2,3,6,4,5],per=AREAS.map(()=>[]);
  for(let i=0;i<N;i++){const a=owner[i];bArea[i]=a;bOrder[i]=i;bDelay[i]=r()*.4;const inner=r()<.12,k=inner?.28+r()*.55:.96+r()*.07;S[i*3]=pts[i][0]*k;S[i*3+1]=pts[i][1]*k;S[i*3+2]=pts[i][2]*k;
    const u=r();bSize[i]=u<.66?1:u<.9?1.5:2.1;if(!inner)per[a].push(i);
    let rr,th,y;if(a===6){rr=Math.pow(r(),1.7)*.34;th=r()*6.2832;y=gs()*.07*(1-rr*2)}else{const arm=a%4,outer=a>=4;rr=outer?.84+r()*.5:.2+Math.pow(r(),.8)*.66;th=arm*1.5708+rr*2.7+gs()*.15/(.35+rr);y=gs()*.028}
    G[i*3]=Math.cos(th)*rr*.96;G[i*3+1]=y;G[i*3+2]=Math.sin(th)*rr*.96;
    const p=brainPoint(r,lobeOf[a]);BR[i*3]=p[0]*1.24;BR[i*3+1]=(p[1]+.12)*1.24;BR[i*3+2]=p[2]*1.24;
    const fl=FILES[a];bName[i]=(a===0?CL[i%6]+' · ':a===1?'Call with '+CL[i%6].split(' ')[0]+' · ':'')+fl[i%fl.length]+(a>1?' '+(1+i%9):'')}
  per.forEach((l,a)=>HUBS[a].forEach((nm,k)=>{const i=l[Math.floor((k+.5)/HUBS[a].length*l.length)];bHub[i]=1;bSize[i]=3.3;bName[i]=nm;(bHubI[a]=bHubI[a]||[])[k]=i;if(k<(a===0?3:2))bLab[i]=1}));
  bFolders(S);
  bPos={sphere:S,galaxy:G,brain:BR};bCur.set(S);bFrom.set(S);
  B.links=linksFor('sphere');B.adj=bLk.sphere.adj;$('#bLinks').textContent=fmt(B.links.length/2);
  $('#bLegend').innerHTML=AREAS.map((a,i)=>`<button type="button" data-a="${i}" aria-pressed="false"><i data-dot="${i}"></i><span>${a[0]}</span><small class="num">${a[3]}</small></button>`).join('');
  $$('#bLegend button').forEach(b=>b.onclick=()=>{const a=+b.dataset.a;setArea(B.iso===a&&B.fold<0&&B.sel<0?-1:a)});
  $('#bShape').innerHTML=SHAPES.map(s=>`<button type="button" data-s="${s[0]}" aria-pressed="${s[0]===B.shape}">${ic(s[0]==='brain'?'lobes':s[0],1.6)}${s[1]}</button>`).join('');
  $$('#bShape button').forEach(b=>b.onclick=()=>setShape(b.dataset.s));
  $('#bFlow').onclick=()=>{B.flow=!B.flow;$('#bFlow').setAttribute('aria-pressed',B.flow);toast(B.flow?'Data flow on':'Data flow paused');kickB()};
  $('#bIn').onclick=()=>{B.zt=0;B.zoom=clamp(B.zoom*1.2,.55,2.6);kickB()};$('#bOut').onclick=()=>{B.zt=0;B.zoom=clamp(B.zoom/1.2,.55,2.6);kickB()};
  $('#bNames').onchange=e=>{B.names=e.target.checked;kickB()};
  $('#bq').oninput=e=>{B.q=e.target.value.trim().toLowerCase();if(B.q.length>1)for(let i=0;i<N;i++)bMatch[i]=(bName[i]+' '+HUBS[bArea[i]][bFold[i]]+' '+AREAS[bArea[i]][0]).toLowerCase().includes(B.q)?1:0;bCount();kickB()};
  const cv=$('#bcv');bx=cv.getContext('2d');let px=0,py=0,moved=0;
  let downOn=-1;cv.onpointerdown=e=>{B.drag=true;downOn=B.hover;moved=0;px=e.clientX;py=e.clientY;cv.setPointerCapture(e.pointerId);cv.classList.add('grab')};
  cv.onpointermove=e=>{const rc=cv.getBoundingClientRect();ptr.x=e.clientX-rc.left;ptr.y=e.clientY-rc.top;ptr.in=true;if(B.drag){const dx=e.clientX-px,dy=e.clientY-py;moved+=Math.abs(dx)+Math.abs(dy);B.yaw+=dx*.006;B.vy=dx*.006;B.pitch=clamp(B.pitch+dy*.005,-1.35,1.35);B.tp=B.pitch;px=e.clientX;py=e.clientY}if(reduce)frame(performance.now())};
  const up=()=>{if(!B.drag)return;B.drag=false;cv.classList.remove('grab');B.vy=clamp(B.vy,-.05,.05);if(moved<6){if(downOn>=0&&downOn!==B.sel)openFile(downOn);else{B.sel=-1;bSync()}}kickB()};
  cv.onpointerup=up;cv.onpointercancel=up;cv.onpointerleave=()=>{ptr.in=false;if(B.hover>=0){B.hover=-1;$('#bTip').style.opacity=0}};
  cv.addEventListener('wheel',e=>{e.preventDefault();B.zt=0;B.zoom=clamp(B.zoom*Math.exp(-e.deltaY*.0012),.55,2.6);kickB()},{passive:false});
  ghost('sphere');mkSprites();seedPulses();bPanel();bInfo();bCount()}
function kickB(){if(reduce)frame(performance.now())}
function ghost(sh){if(GH[sh])return GH[sh];const r=rng(31),gs=()=>(r()+r()+r()+r()-2)*1.732,n=sh==='brain'?5600:sh==='galaxy'?3000:1700,P=new Float32Array(n*3),A=new Uint8Array(n);
  const LW=[.27,.5,.63,.77,.92,.97,1],LA=[0,1,2,3,5,6,4];
  for(let i=0;i<n;i++){let p,a;
    if(sh==='brain'){const u=r();let k=0;while(u>LW[k])k++;const lobe=[0,1,2,3,4,5,6][k];a=LA[k];p=brainPoint(r,lobe);p=[p[0]*1.24,(p[1]+.12)*1.24,p[2]*1.24]}
    else if(sh==='galaxy'){a=r()*7|0;let rr,th,y;if(a===6){rr=Math.pow(r(),1.3)*.42;th=r()*6.2832;y=gs()*.09*(1-rr*1.6)}else{const arm=a%4,outer=a>=4;rr=outer?.8+r()*.62:.16+Math.pow(r(),.8)*.72;th=arm*1.5708+rr*2.7+gs()*.34/(.35+rr);y=gs()*.045}p=[Math.cos(th)*rr*.96,y,Math.sin(th)*rr*.96]}
    else{p=fib(n,i);let bd=9;a=0;for(let c=0;c<7;c++){const d=(p[0]-bCen[c][0])**2+(p[1]-bCen[c][1])**2+(p[2]-bCen[c][2])**2;if(d<bd){bd=d;a=c}}a=bArea[Math.min(NB-1,Math.round(i/n*NB))]}
    P[i*3]=p[0];P[i*3+1]=p[1];P[i*3+2]=p[2];A[i]=a}
  return GH[sh]={P,A,n}}
function linksFor(sh){if(bLk[sh])return bLk[sh].L;const P=bPos[sh],N=NB,L=[],seen=new Set(),add=(a,b)=>{if(a===b)return;const k=a<b?a*N+b:b*N+a;if(seen.has(k))return;seen.add(k);L.push(a,b)};
  for(let i=0;i<N;i++){const k=bHub[i]?8:i%3?3:4,bd=[],bj=[],x=P[i*3],y=P[i*3+1],z=P[i*3+2];
    for(let j=0;j<N;j++){if(j===i)continue;const dx=P[j*3]-x,dy=P[j*3+1]-y,dz=P[j*3+2]-z,d=dx*dx+dy*dy+dz*dz;if(bd.length<k||d<bd[bd.length-1]){let q=bd.length;while(q>0&&bd[q-1]>d)q--;bd.splice(q,0,d);bj.splice(q,0,j);if(bd.length>k){bd.pop();bj.pop()}}}
    bj.forEach(j=>add(i,j))}
  const hubs=[];for(let i=0;i<N;i++)if(bHub[i])hubs.push(i);const rr=rng(5);
  for(let n=0;n<(sh==='brain'?22:40);n++){const a=hubs[rr()*hubs.length|0],b=hubs[rr()*hubs.length|0];if(bArea[a]!==bArea[b])add(a,b)}
  const U=new Uint16Array(L),adj=[];for(let i=0;i<N;i++)adj.push([]);for(let l=0;l<U.length/2;l++){adj[U[l*2]].push(l);adj[U[l*2+1]].push(l)}
  bLk[sh]={L:U,adj};return U}
function mkSprites(){const dark=LOOKS[look].dark;B.dark=dark;B.cols=AREAS.map(a=>dark?a[1]:a[2]);B.ink=css('--text');B.gold=css('--gold');
  const mk=(col,solid)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
    if(solid){gr.addColorStop(0,col);gr.addColorStop(.6,col);gr.addColorStop(.74,hexA(col,0));gr.addColorStop(1,hexA(col,0))}else{gr.addColorStop(0,'#ffffff');gr.addColorStop(.1,col);gr.addColorStop(.27,col);gr.addColorStop(.31,hexA(col,.4));gr.addColorStop(.6,hexA(col,.1));gr.addColorStop(1,hexA(col,0))}
    g.fillStyle=gr;g.fillRect(0,0,64,64);return c};
  sprites=B.cols.map(c=>mk(c,!dark));pSprite=mk(dark?'#FFFFFF':'#14161B',!dark);
  $$('[data-dot]').forEach(e=>{e.style.background=B.cols[+e.dataset.dot];e.style.color=B.cols[+e.dataset.dot]})}
function seedPulses(){const n=B.links.length/2,r=rng(9);pulses=[];for(let i=0;i<210;i++)pulses.push({l:r()*n|0,d:r()<.5?0:1,t:r(),s:.55+r()*.9})}
function markNb(){bNb.fill(0);if(B.sel<0)return;B.adj[B.sel].forEach(l=>{bNb[B.links[l*2]]=1;bNb[B.links[l*2+1]]=1})}
function wave(i){const lv=[[i]],seen=new Uint8Array(NB);seen[i]=1;for(let d=0;d<9;d++){const nx=[];lv[d].forEach(n=>B.adj[n].forEach(l=>{const o=B.links[l*2]===n?B.links[l*2+1]:B.links[l*2];if(!seen[o]){seen[o]=1;nx.push(o)}}));if(!nx.length)break;lv.push(nx)}waves.push({lv,t:0,done:0})}
function setShape(s){if(s===B.shape)return;bFrom.set(bCur);B.shape=s;B.mt=reduce?9:0;B.tp=SVIEW[s];linksFor(s);ghost(s);B.yaw=((B.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;B.yawT=s==='brain'?1.18:null;if(reduce&&B.yawT!=null){B.yaw=B.yawT;B.pitch=B.tp}$$('#bShape button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===s));if(reduce){B.links=bLk[s].L;B.adj=bLk[s].adj;B.linkShape=s;seedPulses();markNb()}kickB()}
/* ---------- Second Brain: step into an area, then a folder, then a file ---------- */
let bFold,bHubI=[],bMem=[],bBaseN=[];
const QUAL=['',' v2',' (November)',' (October)',' draft',' final',' Q4',' (September)',' v3',' short version',' for review',' (August)',' long version',' archive'],MON=['Nov','Oct','Sep','Aug'],DAY=[3,10,17,24];
const EXT={contract:'pdf','brand guide':'pdf','asset list':'csv','test run':'log'};
const INSIDE=['Working files for this client. Your AI reads them when you ask about the client.','Who joined, what was decided and the next steps.','The steps your team follows, written once so every AI does the job the same way.','Things your AIs learned and keep for next time.','The decision, the options that were on the table and the reason.','Where the project stands and what comes next.','Instructions an AI follows when it does this job.'];
const INSIDE0={brief:'The goal, the audience and what was promised at kickoff.','holiday campaign plan':'Dates, posts and budget for the holiday campaign.','reel script':'The hook, three beats and the closing line for one reel.','invoice notes':'What was billed, when, and what is still open.','brand guide':'Colours, fonts, tone of voice and the words to avoid.','launch plan':'The launch steps in order, with owners and dates.','feedback round':'What the client asked to change, and what was done.',contract:'Scope, fee, term and notice period.'};
const FOLD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2.5 2.5 0 0 1 2.5-2.5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10.500V16.500a2.500 2.500 0 0 1-2.500 2.500h-13A2.500 2.500 0 0 1 3 16.500z"/></svg>';
const FILE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.500 3.500H14l4 4V19a1.500 1.500 0 0 1-1.500 1.500h-9A1.500 1.500 0 0 1 6 19V5a1.500 1.500 0 0 1 1.500-1.500z"/><path d="M14 3.500V8h4"/></svg>';
function bFolders(S){const N=NB,cnt={};bFold=new Uint8Array(N);
  for(let i=0;i<N;i++){const a=bArea[i],hs=bHubI[a];if(bHub[i]){bFold[i]=hs.indexOf(i);continue}let bk=0,bd=99;hs.forEach((h,k)=>{const d=(S[i*3]-S[h*3])**2+(S[i*3+1]-S[h*3+1])**2+(S[i*3+2]-S[h*3+2])**2;if(d<bd){bd=d;bk=k}});bFold[i]=bk;
    const fl=FILES[a],base=fl[i%fl.length],key=a+'|'+bk+'|'+base,c=cnt[key]=(cnt[key]||0)+1;bBaseN[i]=base;bName[i]=base[0].toUpperCase()+base.slice(1)+(a===1?' '+DAY[(c-1)%4]+' '+MON[((c-1)>>2)%4]+(c>16?' ('+(1+((c-1)>>4))+')':''):c<=QUAL.length?QUAL[c-1]:' '+c)+'.'+(EXT[base]||'md')}
  bMem=AREAS.map((_,a)=>bHubI[a].map(()=>[]));for(let i=0;i<N;i++)if(!bHub[i])bMem[bArea[i]][bFold[i]].push(i);
  bMem.forEach(A=>A.forEach(M=>M.sort((x,y)=>x%12-y%12||(bName[x]<bName[y]?-1:1))))}
const bBase=i=>bBaseN[i];
const bPath=(a,k,i)=>'WorkOS\\'+AREAS[a][0]+'\\'+(k>=0?HUBS[a][k]+'\\':'')+(i>=0?bName[i]:'');
const bAgo=i=>{const d=i%12;return d?d+(d>1?' days ago':' day ago'):'today'};
function bTurn(yaw){let d=yaw-B.yaw;d=((d+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;B.yawT=B.yaw+d;B.vy=0;if(reduce){B.yaw=B.yawT;B.yawT=null}}
function bFace(i,zoom){const P=bPos[B.shape],x=P[i*3],y=P[i*3+1],z=P[i*3+2],l=Math.hypot(x,y,z)||1;bTurn(Math.atan2(-x,z));if(B.shape==='sphere')B.tp=clamp(Math.asin(clamp(y/l,-1,1)),-1.2,1.2);if(zoom)B.zt=zoom;if(reduce){B.pitch=B.tp;if(zoom){B.zoom=zoom;B.zt=0}}}
function bSync(){$$('#bLegend button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.a===B.iso));markNb();bInfo();bCount();kickB()}
function setArea(a){B.iso=a;B.fold=-1;B.sel=-1;B.peek=-1;if(a>=0&&B.shape==='sphere'){const c=bCen[a];bTurn(Math.atan2(-c[0],c[2]));B.tp=clamp(Math.asin(c[1])*.7,-.7,.7)}B.zt=a>=0?1.12:1;if(reduce){B.pitch=B.tp;B.zoom=B.zt;B.zt=0}bSync()}
function openFold(a,k){B.iso=a;B.fold=k;B.sel=-1;B.peek=-1;const h=bHubI[a][k];bFace(h,1.38);wave(h);bSync()}
function openFile(i,deep){if(bHub[i])return openFold(bArea[i],bFold[i]);if(deep||B.iso>=0){B.iso=bArea[i];B.fold=bFold[i]}B.sel=i;B.peek=-1;wave(i);bFace(i,B.fold>=0?1.55:0);bSync()}
function bCount(){let n=NB;if(B.q.length>1){n=0;for(let i=0;i<NB;i++)if(bMatch[i]&&(B.iso<0||bArea[i]===B.iso))n++}else if(B.fold>=0)n=bMem[B.iso][B.fold].length;else if(B.iso>=0)n=AREAS[B.iso][3];$('#bCount').textContent=fmt(n)+' in view'}
const bSep='<i aria-hidden="true">›</i>';
const bCrumbs=(a,k,i)=>`<div class="b-crumbs"><button type="button" data-bgo="root">WorkOS</button>${bSep}${k<0?`<span aria-current="true">${AREAS[a][0]}</span>`:`<button type="button" data-bgo="area">${AREAS[a][0]}</button>${bSep}${i<0?`<span aria-current="true">${esc(HUBS[a][k])}</span>`:`<button type="button" data-bgo="fold">${esc(HUBS[a][k])}</button>`}`}</div>`;
const bSteps=n=>`<div class="b-steps"><span>Step ${n} of 3</span>${[1,2,3].map(s=>`<i class="${s<=n?'on':''}"></i>`).join('')}<em>${['Pick a folder','Pick a file','You are at the file'][n-1]}</em></div>`;
const bRowF=(a,k)=>{const M=bMem[a][k];return `<button type="button" class="b-row" data-bf="${a},${k}"><span class="b-ic" style="color:${B.cols[a]}">${FOLD}</span><span class="grow"><b>${esc(HUBS[a][k])}</b><small>${M.length} files · touched ${bAgo(bHubI[a][k])}</small></span><span class="b-ch" aria-hidden="true">›</span></button>`};
const bRowI=(i,sub)=>`<button type="button" class="b-row" data-bfile="${i}"><span class="b-ic">${FILE}</span><span class="grow"><b>${esc(bName[i])}</b><small>${sub||'Touched '+bAgo(i)+' · '+B.adj[i].length+' links'}</small></span><span class="b-ch" aria-hidden="true">›</span></button>`;
function bInfo(){const el=$('#bInfo'),i=B.sel,a=i>=0?bArea[i]:B.iso,k=i>=0?bFold[i]:B.fold,step=i>=0?3:k>=0?2:a>=0?1:0;let h;
  if(!step)h=`<div class="eyebrow">Growing every day</div><div class="big num">1,128<small>files in your brain</small></div><div class="gbars">${[30,34,33,41,46,44,52,58,57,66,74,86].map(v=>`<i style="height:${v}%"></i>`).join('')}</div><div class="strip"><span class="grow">3 folders connected · scanned 6 min ago</span><span class="tag ok">+86 this week</span></div><div class="b-steps"><span>Start</span><em>Pick an area on the left, or tap any point</em></div>`;
  else if(step===1)h=`${bCrumbs(a,-1,-1)}<h3><i style="background:${B.cols[a]}"></i>${AREAS[a][0]}</h3><div class="b-path">${bPath(a,-1,-1)}</div><div class="b-meta">${bMem[a].reduce((s,M)=>s+M.length,0)} files in ${HUBS[a].length} folders</div><div class="b-list">${HUBS[a].map((_,x)=>bRowF(a,x)).join('')}</div>${bSteps(1)}`;
  else if(step===2){const M=bMem[a][k];h=`${bCrumbs(a,k,-1)}<h3><span class="b-hic" style="color:${B.cols[a]}">${FOLD}</span>${esc(HUBS[a][k])}</h3><div class="b-path">${esc(bPath(a,k,-1))}</div><div class="b-meta">${M.length} files · ${M.reduce((s,x)=>s+B.adj[x].length,0)} links · lit up on the map</div><div class="b-list">${M.map(x=>bRowI(x)).join('')}</div>${bSteps(2)}`}
  else{const ad=[...new Set(B.adj[i].map(l=>B.links[l*2]===i?B.links[l*2+1]:B.links[l*2]))],base=bBase(i);
    h=`${bCrumbs(a,k,i)}<h3><span class="b-hic">${FILE}</span>${esc(bName[i])}</h3><p class="b-what">${(a===0&&INSIDE0[base])||INSIDE[a]}</p><dl class="kv b-kv"><div><dt>Lives in</dt><dd class="b-path">${esc(bPath(a,k,i))}</dd></div><div class="two"><div><dt>Last touched</dt><dd>${bAgo(i)}</dd></div><div><dt>Size</dt><dd>${2+i%37} KB</dd></div><div><dt>Written by</dt><dd>${['You','Claude Code','Kenneth','Codex'][i%4]}</dd></div></div></dl><div class="eyebrow b-sub">Linked to ${ad.length} ${ad.length===1?'file':'files'}</div><div class="b-list short">${ad.slice(0,8).map(o=>bHub[o]?bRowF(bArea[o],bFold[o]):bRowI(o,(bArea[o]===a&&bFold[o]===k?'Same folder':esc(HUBS[bArea[o]][bFold[o]]))+' · '+AREAS[bArea[o]][0])).join('')}</div><div class="b-acts"><button class="btn sm" type="button" data-toast="The file would open">Open file</button><button class="btn sm line" type="button" data-bgo="fold">Show in folder</button><button class="btn sm line" type="button" data-toast="Your own AI would answer here">Ask your AI</button></div>${bSteps(3)}`}
  el.dataset.step=step;el.innerHTML=`<div class="b-in">${h}</div>`}
function bPanel(){const el=$('#bInfo');
  el.onclick=e=>{const t=e.target.closest('[data-bgo],[data-bf],[data-bfile]');if(!t)return;const i=B.sel,a=i>=0?bArea[i]:B.iso,k=i>=0?bFold[i]:B.fold,g=t.dataset.bgo;
    if(g==='root')return setArea(-1);if(g==='area')return setArea(a);if(g==='fold')return openFold(a,k);
    if(t.dataset.bf){const p=t.dataset.bf.split(',');return openFold(+p[0],+p[1])}openFile(+t.dataset.bfile,true)};
  el.onpointerover=e=>{const t=e.target.closest('[data-bf],[data-bfile]');let p=-1;if(t){if(t.dataset.bf){const q=t.dataset.bf.split(',');p=bHubI[+q[0]][+q[1]]}else p=+t.dataset.bfile}if(p!==B.peek){B.peek=p;kickB()}};
  el.onpointerleave=()=>{if(B.peek>=0){B.peek=-1;kickB()}}}
const SEG=[];for(let i=0;i<22;i++)SEG.push([]);
function drawBrain(t,dt){const cv=$('#bcv'),w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const x=bx,N=NB,dark=B.dark,S=bScr,wide=w>900;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  /* camera */
  if(B.zt){B.zoom+=(B.zt-B.zoom)*.07;if(Math.abs(B.zt-B.zoom)<.004)B.zt=0}
  if(!B.drag){if(B.yawT!=null){B.yaw+=(B.yawT-B.yaw)*.07;B.vy=0;if(Math.abs(B.yawT-B.yaw)<.004)B.yawT=null}else{B.yaw+=B.vy;const idle=(B.hover>=0||B.sel>=0||B.fold>=0||B.peek>=0)?.0003:B.shape==='brain'?.0011:.0018;B.vy+=(idle-B.vy)*.035}B.pitch+=(B.tp-B.pitch)*.05}else B.yawT=null;
  if(B.mt<2){B.mt+=dt/1.25;if(B.mt>=.92&&B.linkShape!==B.shape){B.linkShape=B.shape;B.links=bLk[B.shape].L;B.adj=bLk[B.shape].adj;seedPulses();markNb();waves.length=0;bInfo();$('#bLinks').textContent=fmt(B.links.length/2)}}
  const morphing=B.linkShape!==B.shape;B.linkA+=((morphing?0:1)-B.linkA)*(morphing?.22:.06);
  B.coreK+=(({sphere:1,galaxy:.75,brain:0})[B.shape]-B.coreK)*.06;
  const T=bPos[B.shape],cyw=Math.cos(B.yaw+(ptr.in&&!B.drag?(ptr.x/w-.5)*.16:0)),syw=Math.sin(B.yaw+(ptr.in&&!B.drag?(ptr.x/w-.5)*.16:0)),pp0=B.pitch+(ptr.in&&!B.drag?(ptr.y/h-.5)*.1:0),cp=Math.cos(pp0),sp=Math.sin(pp0);
  const R=Math.min(w*(wide?.31:.44),h*(B.shape==='galaxy'?.41:B.shape==='brain'?.41:.375))*B.zoom,cx=w*(wide?.555:.5),cy0=h*(wide?.485:.5),F=3.4,m=B.mt;
  for(let i=0;i<N;i++){const j=i*3;let px=T[j],py=T[j+1],pz=T[j+2];
    if(m<1.45){const u=clamp((m*1.4-bDelay[i]),0,1),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;px=bFrom[j]+(px-bFrom[j])*e;py=bFrom[j+1]+(py-bFrom[j+1])*e;pz=bFrom[j+2]+(pz-bFrom[j+2])*e}
    const wb=1+.012*Math.sin(t*.9+i*1.7);px*=wb;py*=wb;pz*=wb;bCur[j]=px;bCur[j+1]=py;bCur[j+2]=pz;
    const x1=px*cyw+pz*syw,z1=-px*syw+pz*cyw,y1=py*cp-z1*sp,z2=py*sp+z1*cp,pe=F/(F-z2);
    S[i*4]=cx+x1*R*pe;S[i*4+1]=cy0-y1*R*pe;S[i*4+2]=z2;S[i*4+3]=pe;
    const hasQ=B.q.length>1,tg=hasQ&&!bMatch[i]?.07:B.sel>=0&&(i===B.sel||bNb[i])?1:B.iso>=0&&bArea[i]!==B.iso?.07:B.fold>=0&&bFold[i]!==B.fold?.17:B.sel>=0?(B.fold>=0?.66:.46):1;bVis[i]+=(tg-bVis[i])*(reduce?1:.14)}
  /* waves of activity */
  for(let k=waves.length-1;k>=0;k--){const wv=waves[k];wv.t+=dt;const st=Math.floor(wv.t*13);while(wv.done<=st&&wv.done<wv.lv.length){wv.lv[wv.done].forEach(n=>bHot[n]=1);wv.done++}if(wv.done>=wv.lv.length)waves.splice(k,1)}
  if(B.flow&&!reduce&&!morphing){nextWave-=dt;if(nextWave<0){nextWave=4.5;let i=Math.random()*N|0,g=0;while(!bHub[i]&&g++<400)i=(i+1)%N;wave(i)}}
  /* faint structure points that give each shape its body */
  B.gA+=((morphing?0:1)-B.gA)*Math.min(1,dt*(morphing?14:2.6));
  if(B.gA>.02){const gh=ghost(B.shape),gp=gh.P;x.globalCompositeOperation=dark?'lighter':'source-over';const gsz=Math.max(1.1,R/330*1.25);
    for(let i=0;i<gh.n;i++){const j=i*3,px=gp[j],py=gp[j+1],pz=gp[j+2],x1=px*cyw+pz*syw,z1=-px*syw+pz*cyw,y1=py*cp-z1*sp,z2=py*sp+z1*cp,pe=F/(F-z2);SEG[gh.A[i]*3+(z2<-.35?0:z2<.3?1:2)].push(cx+x1*R*pe,cy0-y1*R*pe)}
    const GA=dark?[.2,.42,.74]:[.16,.32,.56];
    for(let key=0;key<21;key++){const g=SEG[key];if(!g.length)continue;const q=gsz*(.85+.35*(key%3));x.beginPath();for(let k=0;k<g.length;k+=2)x.rect(g[k]-q/2,g[k+1]-q/2,q,q);x.fillStyle=B.cols[key/3|0];x.globalAlpha=GA[key%3]*B.gA*(B.iso>=0&&(key/3|0)!==B.iso?.2:1);x.fill();g.length=0}}
  /* links */
  const Lk=B.links,nl=Lk.length/2,la=B.linkA;
  if(la>.01){for(let l=0;l<nl;l++){const a=Lk[l*2],b=Lk[l*2+1],v=Math.min(bVis[a],bVis[b]),z=(S[a*4+2]+S[b*4+2])*.5;const g=SEG[v<.5?21:bArea[a]*3+(z<-.35?0:z<.3?1:2)];g.push(S[a*4],S[a*4+1],S[b*4],S[b*4+1])}
    x.globalCompositeOperation=dark?'lighter':'source-over';x.lineWidth=dark?.7:.6;const LA=dark?[.1,.2,.36]:[.1,.2,.34];
    for(let key=0;key<22;key++){const g=SEG[key];if(!g.length)continue;x.beginPath();for(let k=0;k<g.length;k+=4){x.moveTo(g[k],g[k+1]);x.lineTo(g[k+2],g[k+3])}
      if(key===21){x.strokeStyle=B.ink;x.globalAlpha=.035*la}else{x.strokeStyle=B.cols[key/3|0];x.globalAlpha=LA[key%3]*la}x.stroke();g.length=0}
    const f=B.peek>=0?B.peek:B.sel>=0?B.sel:B.hover;if(f>=0){x.beginPath();B.adj[f].forEach(l=>{const a=Lk[l*2],b=Lk[l*2+1];x.moveTo(S[a*4],S[a*4+1]);x.lineTo(S[b*4],S[b*4+1])});x.strokeStyle=B.cols[bArea[f]];x.globalAlpha=.95*la;x.lineWidth=1.5;x.stroke()}}
  /* the core */
  const ck=B.coreK;if(ck>.02){const cr=R*.105,g=x.createRadialGradient(cx,cy0,0,cx,cy0,cr*3.2);g.addColorStop(0,hexA(B.gold,(dark?.6:.4)*ck));g.addColorStop(.32,hexA(B.gold,(dark?.16:.1)*ck));g.addColorStop(1,hexA(B.gold,0));x.globalAlpha=1;x.fillStyle=g;x.beginPath();x.arc(cx,cy0,cr*3.2,0,7);x.fill();
    if(B.shape!=='galaxy'||ck>.9){x.strokeStyle=hexA(B.gold,.55*ck*(B.shape==='galaxy'?0:1));x.lineWidth=.8;for(let k=0;k<3;k++){x.beginPath();x.ellipse(cx,cy0,cr,Math.max(.6,cr*Math.abs(Math.cos(t*.35+k*1.05))),k*1.05+t*.12,0,7);x.stroke()}x.beginPath();x.arc(cx,cy0,cr,0,7);x.stroke()}}
  /* points */
  if(fno%3===0||reduce)bOrder.sort((a,b)=>S[a*4+2]-S[b*4+2]);
  x.globalCompositeOperation='source-over';const base=Math.max(1.2,R/330*1.85),spr=dark?3.5:1.4;let best=-1,bd=17*17;
  for(let o=0;o<N;o++){const i=bOrder[o],sx=S[i*4],sy=S[i*4+1],z=S[i*4+2],pe=S[i*4+3],dp=clamp((z+1.2)/2.4,0,1),v=bVis[i];let rad=bSize[i]*base*pe*(.72+.5*dp),al=(.2+.8*dp*dp)*v;
    const hh=bHot[i];if(hh>.02){rad*=1+hh*.9;al=Math.min(1,al+hh*.6*v);bHot[i]=hh*.93}
    if(ptr.in){const dx=sx-ptr.x,dy=sy-ptr.y,d2=dx*dx+dy*dy;if(d2<12100){const k=1-Math.sqrt(d2)/110;rad*=1+k*.75;al=Math.min(1,al+k*.35*v);if(d2<bd&&z>-.35&&v>.5&&!B.drag){bd=d2;best=i}}}
    if(i===B.sel)rad*=1.7;
    const s=rad*spr;x.globalAlpha=al;x.drawImage(sprites[bArea[i]],sx-s,sy-s,s*2,s*2)}
  /* data moving along the links */
  if(B.flow&&la>.3&&!reduce){x.globalCompositeOperation=dark?'lighter':'source-over';
    for(const p of pulses){p.t+=p.s*dt;if(p.t>=1){const end=Lk[p.l*2+(p.d?0:1)];bHot[end]=Math.max(bHot[end],.55);const ad=B.adj[end];let nx=ad[Math.random()*ad.length|0];if(nx===p.l&&ad.length>1)nx=ad[(ad.indexOf(nx)+1)%ad.length];p.l=nx;p.d=Lk[nx*2]===end?0:1;p.t=0}
      const a=Lk[p.l*2+(p.d?1:0)],b=Lk[p.l*2+(p.d?0:1)],v=Math.min(bVis[a],bVis[b]);if(v<.5)continue;const dpz=clamp(((S[a*4+2]+S[b*4+2])*.5+1.2)/2.4,0,1);
      for(let k=0;k<3;k++){const u=p.t-k*.09;if(u<0)break;const s=(3-k*.7)*base*(.6+.6*dpz)*(dark?1.6:.9);x.globalAlpha=(.95-k*.3)*(.3+.7*dpz)*la;x.drawImage(k?sprites[bArea[a]]:pSprite,S[a*4]+(S[b*4]-S[a*4])*u-s,S[a*4+1]+(S[b*4+1]-S[a*4+1])*u-s,s*2,s*2)}}}
  /* names */
  x.globalCompositeOperation='source-over';x.font='500 12px Geist, Inter, sans-serif';x.textBaseline='middle';
  const label=(i,strong)=>{const z=S[i*4+2],dp=clamp((z+1.2)/2.4,0,1);const al=strong?1:clamp((dp-.55)/.3,0,1)*bVis[i]*(B.linkA*.6+.4);if(al<.05)return;const tx=S[i*4]+bSize[i]*base*1.6+7,ty=S[i*4+1];
    if(strong){const tw=x.measureText(bName[i]).width;x.globalAlpha=.92;x.fillStyle=dark?'rgba(10,11,14,.9)':'rgba(255,255,255,.94)';x.beginPath();x.roundRect(tx-7,ty-12,tw+14,24,8);x.fill();x.strokeStyle=hexA(B.cols[bArea[i]],.8);x.lineWidth=1;x.stroke()}
    x.globalAlpha=al;x.fillStyle=B.ink;x.fillText(bName[i],tx,ty)};
  if(B.names)for(let i=0;i<N;i++)if(bLab[i]&&i!==B.sel&&bVis[i]>.5&&!(B.fold>=0&&bHub[i]))label(i,false);
  if(B.iso>=0&&B.fold<0)bHubI[B.iso].forEach(hb=>{if(!(B.names&&bLab[hb])&&hb!==B.sel&&hb!==B.peek)label(hb,false)});
  if(B.fold>=0){const M=bMem[B.iso][B.fold],put=[],hb=bHubI[B.iso][B.fold];if(hb!==B.peek)label(hb,true);for(let k=0;k<M.length&&put.length<14;k++){const i=M[k];if(i===B.sel||i===B.peek||S[i*4+2]<.3)continue;const tx=S[i*4],ty=S[i*4+1];if(put.some(p=>Math.abs(p[1]-ty)<17&&Math.abs(p[0]-tx)<170))continue;put.push([tx,ty]);label(i,false)}}
  if(B.sel>=0)label(B.sel,true);
  if(B.peek>=0&&B.peek!==B.sel){bHot[B.peek]=Math.max(bHot[B.peek],.8);label(B.peek,true)}
  x.globalAlpha=1;
  if(best!==B.hover){B.hover=best;const tip=$('#bTip');if(best>=0&&best!==B.sel){tip.innerHTML=`<b>${esc(bName[best])}</b><small>${bHub[best]?'Folder · '+bMem[bArea[best]][bFold[best]].length+' files · click to open':esc(HUBS[bArea[best]][bFold[best]])+' · '+B.adj[best].length+' links'}</small>`;tip.style.opacity=1}else tip.style.opacity=0;cv.style.cursor=best>=0?'pointer':''}
  if(B.hover>=0){const tip=$('#bTip'),tw=tip.offsetWidth;tip.style.transform=`translate(${clamp(S[B.hover*4]+16,8,w-tw-8)}px,${clamp(S[B.hover*4+1]-54,8,h-60)}px)`}}


/* ---------- the orb and the library wall follow the mouse ---------- */
document.addEventListener('pointermove',e=>{const q=s=>e.target.closest&&e.target.closest(s),o=q('.orbw'),w=q('.wall');
  if(o){const r=o.getBoundingClientRect();omT=[clamp((e.clientX-r.left)/r.width*2-1,-1.1,1.1),clamp(1-(e.clientY-r.top)/r.height*2,-1.1,1.1)];ohT=1;orbEl=o}else ohT=0;
  if(w&&w.firstElementChild){const r=w.getBoundingClientRect(),s=w.firstElementChild.style;s.setProperty('--wx',((.5-(e.clientY-r.top)/r.height)*8).toFixed(2)+'deg');s.setProperty('--wz',(((e.clientX-r.left)/r.width-.5)*3.2).toFixed(2)+'deg')}},{passive:true});
document.addEventListener('pointerout',e=>{const w=e.target.closest&&e.target.closest('.wall');if(w&&w.firstElementChild&&!(e.relatedTarget&&w.contains(e.relatedTarget))){w.firstElementChild.style.removeProperty('--wx');w.firstElementChild.style.removeProperty('--wz')}if(!e.relatedTarget)ohT=0});
addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')ohT=0});addEventListener('pointercancel',()=>ohT=0);
