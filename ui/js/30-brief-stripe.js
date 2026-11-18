/* ---------- daily brief: one player, three faces ---------- */
let bi=-1,bt,bsel=0;
const briefLen=()=>{const s=D.brief.seconds||0;return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function showBrief(i){bsel=i;const b=BRIEF[i];if(!b)return;const cc=$('#coreCap');if(cc)cc.textContent='Ready · '+briefLen();
  $$('[data-bi]').forEach(e=>{const on=+e.dataset.bi===i;if(e.matches('[role=tab]'))e.setAttribute('aria-selected',on);if(e.matches('.trk'))e.classList.toggle('sel',on);if(e.matches('.sq'))e.classList.toggle('on',on&&playing)});
  const st=$('#stage');if(st)st.innerHTML=`<div><div class="eyebrow"><b>${nn(i)} · ${b.k}</b> &nbsp;·&nbsp; ${b.s}</div><div class="v num">${b.v}</div><p>${b.t}</p><div class="row"><a class="btn" href="${b.href}">${b.act}</a><button class="btn line" type="button" data-bnext>Next</button></div></div><div class="sq-viz viz-lg">${b.viz}</div>`;
  const pb=$('#pbar');if(pb)pb.style.width=(playing?(i+1)/BRIEF.length*100:0)+'%'}
function setListen(){$$('[data-listen]').forEach(b=>{b.classList.toggle('is-on',playing);const s=b.querySelector('span');if(s)s.textContent=playing?'Stop':(s.dataset.l||'Listen')})}
function stopBrief(){playing=false;clearTimeout(bt);try{speechSynthesis.cancel()}catch(e){}$$('.sq').forEach(s=>s.classList.remove('on'));bi=-1;setListen();const pb=$('#pbar');if(pb)pb.style.width='0%'}
function nextBrief(){bi++;if(bi>=BRIEF.length)return stopBrief();showBrief(bi);
  let spoke=false;const b=BRIEF[bi];try{const u=new SpeechSynthesisUtterance(b.k+'. '+b.v+'. '+b.t);u.rate=1.04;u.onstart=()=>{spoke=true};u.onend=()=>{if(playing&&spoke){clearTimeout(bt);nextBrief()}};speechSynthesis.speak(u)}catch(e){}
  bt=setTimeout(()=>{if(playing)nextBrief()},3400);setTimeout(()=>{if(spoke&&playing){clearTimeout(bt);bt=setTimeout(()=>{if(playing)nextBrief()},12000)}},600)}
function toggleBrief(){if(playing)return stopBrief();if(!BRIEF.length)return;if(location.hash&&!location.hash.startsWith('#overview')){location.hash='#overview';return setTimeout(toggleBrief,60)}playing=true;setListen();nextBrief()}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-listen]')){e.preventDefault();return toggleBrief()}
  if(e.target.closest('[data-bnext]'))return showBrief((bsel+1)%BRIEF.length);
  const t=e.target.closest('.steps [data-bi],.trk[data-bi]');if(t){if(playing)stopBrief();return showBrief(+t.dataset.bi)}
  if(e.target.closest('[data-nprev]'))return go(-1);if(e.target.closest('[data-nnext]'))return go(1);
  const pk=e.target.closest('[data-pick]');if(pk)return openTopics(pk)});

/* ---------- Stripe monthly revenue ---------- */
const sum=a=>a.reduce((x,y)=>x+y,0);
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return (m<=1?1:m<=2?2:m<=4?4:m<=8?8:10)*p}
function lineChart(host,vals,labels,o){const id=host.id+'g';const W=Math.max(280,host.clientWidth),H=o.h||300,pl=48,pr=14,pt=14,pb=30;const n=vals.length,max=o.max||niceMax(Math.max(1,Math.max(...vals,...(o.prev||[]))*1.05));
  const X=i=>pl+i*(W-pl-pr)/(n-1),Y=v=>pt+(1-v/max)*(H-pt-pb);
  let d=`M${X(0)},${Y(vals[0])}`;for(let i=1;i<n;i++){const x0=X(i-1),x1=X(i),mx=(x0+x1)/2;d+=` C${mx},${Y(vals[i-1])} ${mx},${Y(vals[i])} ${x1},${Y(vals[i])}`}
  let dp='';if(o.prev){dp=`M${X(0)},${Y(o.prev[0])}`;for(let i=1;i<n;i++){const mx=(X(i-1)+X(i))/2;dp+=` C${mx},${Y(o.prev[i-1])} ${mx},${Y(o.prev[i])} ${X(i)},${Y(o.prev[i])}`}}
  const grid=[0,.25,.5,.75,1].map(k=>{const y=Y(max*k);return `<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" style="stroke:rgba(var(--ink),${k?.07:.16})" stroke-dasharray="${k?'2 5':''}"/><text x="${pl-10}" y="${y+3.5}" text-anchor="end">${o.pre||''}${max*k>=1000?(max*k/1000).toFixed(max*k%1000?1:0)+'k':Math.round(max*k)}</text>`}).join('');
  const show=o.lab||((i)=>i%7===6||(i===0&&W>520));
  const xl=labels.map((l,i)=>show(i,W)?`<text x="${X(i)}" y="${H-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${l}</text>`:'').join('');
  host.innerHTML=`<svg height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.c}" stop-opacity=".30"/><stop offset="1" stop-color="${o.c}" stop-opacity="0"/></linearGradient></defs>${grid}${xl}
   ${dp?`<path d="${dp}" fill="none" style="stroke:rgba(var(--ink),.34)" stroke-width="1.3" stroke-dasharray="3 5"/>`:''}<path d="${d} L${X(n-1)},${Y(0)} L${X(0)},${Y(0)}z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${o.c}" stroke-width="5" opacity=".18" style="filter:blur(5px)"/><path d="${d}" fill="none" stroke="${o.c}" stroke-width="2.2" stroke-linecap="round"${o.draw&&!reduce&&!still?' class="ln" pathLength="1"':''}/>
   <line class="gl" y1="${pt}" y2="${H-pb}" style="stroke:rgba(var(--ink),.35)" stroke-dasharray="2 4" opacity="0"/><circle class="gd" r="5" style="fill:var(--bg)" stroke="${o.c}" stroke-width="2" cx="${X(n-1)}" cy="${Y(vals[n-1])}"/></svg><div class="tip"></div>`;
  const svg=host.firstChild,gl=svg.querySelector('.gl'),gd=svg.querySelector('.gd'),tip=host.querySelector('.tip');
  host.onpointermove=e=>{const r=host.getBoundingClientRect();const i=clamp(Math.round((e.clientX-r.left-pl)/((W-pl-pr)/(n-1))),0,n-1);gl.setAttribute('x1',X(i));gl.setAttribute('x2',X(i));gl.setAttribute('opacity',1);gd.setAttribute('cx',X(i));gd.setAttribute('cy',Y(vals[i]));tip.innerHTML=`<b class="num">${o.pre||''}${fmt(vals[i])}</b>${labels[i]}`;tip.style.opacity=1;const tw=tip.offsetWidth;tip.style.transform=`translate(${clamp(X(i)-tw/2,0,W-tw)}px,${Math.max(0,Y(vals[i])-62)}px)`};
  host.onpointerleave=()=>{gl.setAttribute('opacity',0);tip.style.opacity=0;gd.setAttribute('cx',X(n-1));gd.setAttribute('cy',Y(vals[n-1]))}}
function pct(a,b){if(!b)return '';const p=Math.round((a-b)/b*100);return `<span class="${p>0?'up':p<0?'down':'dim'}">${p>0?'+':''}${p}%</span>`}
function drawRev(){const s=D.money.sym||'$';$$('[data-rev]').forEach(h=>{const mini=h.dataset.rev==='mini';h.innerHTML=REV.map((m,i)=>{const now=i===REV.length-1;return `<div class="b12${now?' now':''}" style="--i:${i}" title="${esc(m[0])}: ${esc(s)}${fmt(m[1])}"><span class="bv num">${esc(s)}${short(m[1])}</span><div class="col">${now&&PACE?`<i class="pace" style="height:${PACE/RMAX*100}%"></i>`:''}<i style="height:${m[1]/RMAX*100}%"></i></div><small>${mini&&i%3!==2?'&nbsp;':esc(m[0])}</small></div>`}).join('')});
  const rl=$('#revLine');if(rl&&REV.length)lineChart(rl,REV.map(m=>m[1]),REV.map(m=>m[0]),{c:css('--gold'),pre:s,h:300,lab:(i,W)=>W>560||i%2===1})}
