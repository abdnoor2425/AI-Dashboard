/* ---------- AI made: the files your AIs saved on this computer in the last 14 days ---------- */
const AIS={'Claude Code':'#EBC57C','Codex':'#5FE0B0','Gemini CLI':'#8AD4FF','Cursor':'#B9A2FF','Claude desktop app':'#FF9A6B'};
const PALS=[['#3a2710','#EBC57C'],['#0d2233','#8AD4FF'],['#33121a','#FF9A6B'],['#0c2a22','#5FE0B0'],['#22203a','#B9A2FF'],['#1c1d22','#D8DAE2']];
let items=[];
const KIND={image:'IMAGE',video:'VIDEO',doc:'DOC',code:'CODE',site:'PAGE'};
/* A real picture is shown as it is. Everything else gets a plain stand-in that carries only its own name: nothing is invented. */
function makeThumbs(){const c2=document.createElement('canvas');c2.width=480;c2.height=360;const x=c2.getContext('2d');
  const F=(w,s)=>`${w} ${s}px Geist, Inter, sans-serif`;
  const wrap=(t,px,py,w,lh,max)=>{const words=String(t).split(/\s+/);let line='',y=py,n=0;for(const wd of words){if(x.measureText(line+wd).width>w&&line){x.fillText(line.trim(),px,y);y+=lh;line='';if(++n>=max-1)break}line+=wd+' '}let last=line.trim();while(last&&x.measureText(last).width>w)last=last.slice(0,-2)+'…';x.fillText(last,px,y);return y};
  items.forEach((it,i)=>{if(it.pic){it.img='/api/made/file?id='+encodeURIComponent(it.id);return}
    const P=PALS[i%PALS.length];x.clearRect(0,0,480,360);
    if(it.type==='video'){const g=x.createRadialGradient(330,110,10,240,180,420);g.addColorStop(0,P[1]);g.addColorStop(.45,P[0]);g.addColorStop(1,'#050506');x.fillStyle=g;x.fillRect(0,0,480,360);const s=x.createLinearGradient(0,150,0,360);s.addColorStop(0,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(0,0,0,.8)');x.fillStyle=s;x.fillRect(0,0,480,360);
      x.font=F(600,22);x.fillStyle='#fff';x.textAlign='center';wrap(it.txt,240,262,400,28,2);x.beginPath();x.arc(240,150,30,0,7);x.fillStyle='rgba(255,255,255,.92)';x.fill();x.beginPath();x.moveTo(231,136);x.lineTo(231,164);x.lineTo(255,150);x.closePath();x.fillStyle='#07080A';x.fill()}
    else if(it.type==='site'){x.fillStyle='#0B0C0F';x.fillRect(0,0,480,360);const g=x.createRadialGradient(400,170,10,400,170,260);g.addColorStop(0,P[1]);g.addColorStop(1,'rgba(11,12,15,0)');x.globalAlpha=.5;x.fillStyle=g;x.fillRect(200,0,280,360);x.globalAlpha=1;
      x.fillStyle='rgba(255,255,255,.9)';x.fillRect(24,22,14,14);x.fillStyle='rgba(255,255,255,.3)';[0,1,2].forEach(k=>x.fillRect(330+k*44,26,30,5));
      x.fillStyle='#F5F3EF';x.textAlign='left';x.font=F(600,29);const y=wrap(it.txt,24,140,300,36,3);x.fillStyle='rgba(255,255,255,.35)';x.fillRect(24,y+22,180,5);x.fillRect(24,y+36,140,5);x.fillStyle=P[1];x.beginPath();x.roundRect(24,y+62,104,30,15);x.fill()}
    else if(it.type==='doc'){x.fillStyle='#15161B';x.fillRect(0,0,480,360);x.fillStyle='#F4F2EC';x.beginPath();x.roundRect(90,36,300,360,10);x.fill();x.fillStyle='#14161C';x.textAlign='left';x.font=F(600,20);const y=wrap(it.txt,116,84,248,25,2);x.fillStyle='rgba(20,22,28,.2)';for(let k=0;k<11;k++)x.fillRect(116,y+26+k*17,[240,220,248,180,236,210,244,150,228,200,170][k],6)}
    else{x.fillStyle='#0A0B0E';x.fillRect(0,0,480,360);x.fillStyle='rgba(255,255,255,.06)';x.fillRect(0,0,480,34);['#FF7A7A','#F4B860','#5FE0B0'].forEach((c,k)=>{x.fillStyle=c;x.beginPath();x.arc(20+k*18,17,5,0,7);x.fill()});
      x.font='500 13px "Geist Mono", monospace';x.textAlign='left';x.fillStyle='rgba(255,255,255,.55)';let nm=it.title;while(nm.length>3&&x.measureText(nm).width>370)nm=nm.slice(0,-2)+'…';x.fillText(nm,84,22);
      const r=rng(i*97+13);for(let k=0;k<9;k++){const y=70+k*31,ind=[0,1,1,2,1,0,0,1,0][k];x.fillStyle='rgba(255,255,255,.22)';x.fillText(String(k+1),14,y);x.fillStyle=k%4===1?P[1]:'rgba(255,255,255,.3)';x.globalAlpha=k%4===1?.55:1;x.fillRect(46+ind*22,y-9,70+Math.round(r()*230),8);x.globalAlpha=1}}
    it.img=c2.toDataURL('image/jpeg',.88)})}
const TYPES=[['all','All'],['image','Images'],['video','Video'],['site','Pages'],['doc','Documents'],['code','Code']];
let fType='all',fAi=null,fDay=null;
const thumb=it=>`<img alt="" src="${esc(it.img)}" loading="lazy">`;
const itemOf=id=>items.find(x=>String(x.id)===String(id));
let mShow=30,mSig='';
function drawMedia(){const q=$('#q').value.trim().toLowerCase();const sig=[q,fType,fAi,fDay].join('|');if(sig!==mSig){mSig=sig;mShow=30}const all=items.filter(it=>(fType==='all'||it.type===fType)&&(!fAi||it.ai===fAi)&&(fDay==null||it.day===fDay)&&(!q||(it.title+' '+it.path+' '+it.project+' '+it.ai+' '+it.type).toLowerCase().includes(q))),list=all.slice(0,mShow);
  $('#count').textContent=all.length+' of '+D.made.total;
  $('#media').innerHTML=list.length?list.map(it=>`<button class="mt" data-id="${esc(it.id)}" type="button"><div class="th">${thumb(it)}<span class="kind">${KIND[it.type]||'FILE'}</span></div><div class="meta"><b>${esc(it.title)}</b><small><i style="background:${AICOL(it.ai)}"></i>${esc(it.ai)} · ${it.when}</small></div></button>`).join('')+(all.length>list.length?`<div class="more-row"><button class="btn line" type="button" id="mMore">Show ${Math.min(30,all.length-list.length)} more <span class="dim">· ${all.length-list.length} left</span></button></div>`:''):`<div class="panel mini" style="grid-column:1/-1;text-align:center;padding:50px"><div class="h2" style="font-size:28px">${items.length?'Nothing matches.':'Nothing here yet.'}</div><p class="mut">${items.length?'Try fewer words or another AI.':'Files show up here when your AIs save them.'}</p></div>`;
  $$('.mt').forEach(t=>t.onclick=()=>openItem(itemOf(t.dataset.id)));const mm=$('#mMore');if(mm)mm.onclick=()=>{mShow+=30;drawMedia()}}
function drawFilters(){$('#filters').innerHTML=TYPES.map(([k,l])=>`<button class="chip" type="button" data-t="${k}" aria-pressed="${k===fType}">${l}</button>`).join('')+(D.made.ais.length?'<span class="vr"></span>':'')+D.made.ais.map(([k])=>`<button class="chip" type="button" data-a="${esc(k)}" aria-pressed="${k===fAi}"><i style="background:${AICOL(k)}"></i>${esc(k)}</button>`).join('');
  $$('#filters [data-t]').forEach(b=>b.onclick=()=>{fType=b.dataset.t;$$('#filters [data-t]').forEach(x=>x.setAttribute('aria-pressed',x===b));drawMedia()});
  $$('#filters [data-a]').forEach(b=>b.onclick=()=>{fAi=fAi===b.dataset.a?null:b.dataset.a;$$('#filters [data-a]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.a===fAi));drawMedia()});
  const perDay=D.made.perDay,mx=Math.max(1,...perDay);
  $('#days').innerHTML=perDay.map((n,i)=>`<button type="button" aria-pressed="${13-i===fDay}" data-d="${13-i}" aria-label="${n} made" title="${n} made" style="height:${Math.max(n?8:3,n/mx*100)}%"></button>`).join('');
  $$('#days button').forEach(b=>b.onclick=()=>{fDay=+b.dataset.d===fDay?null:+b.dataset.d;$$('#days button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.d===fDay));$('#clearDay').hidden=fDay==null;drawMedia()});
  const d=k=>{const t=new Date(D.now||Date.now());t.setDate(t.getDate()-k);return t.toLocaleDateString('en-GB',{day:'numeric',month:'short'})};$('#madeAxis').innerHTML=`<span>${d(13)}</span><span>${d(6)}</span><span>Today</span>`}
$('#clearDay').onclick=()=>{fDay=null;$$('#days button').forEach(x=>x.setAttribute('aria-pressed','false'));$('#clearDay').hidden=true;drawMedia()};
$('#q').oninput=drawMedia;
let openIt=null;
function openItem(it){if(!it)return;openIt=it;$('#sPic').innerHTML=thumb(it);$('#sKind').textContent=KIND[it.type]||'FILE';$('#sTitle').textContent=it.title;
  $('#sKv').innerHTML=`<div><dt>Found in</dt><dd style="color:var(--text)">A ${esc(it.ai)} project · ${it.when}</dd></div><div><dt>Project</dt><dd>${esc(it.project)}</dd></div><div><dt>Saved in</dt><dd style="font-family:var(--mono);font-size:11.5px;word-break:break-all">${esc(it.path)}</dd></div>`;
  $('#sheet').hidden=false;$('#sClose').focus()}
$('#sClose').onclick=()=>$('#sheet').hidden=true;$('#sheet').onclick=e=>{if(e.target.id==='sheet')$('#sheet').hidden=true};
document.addEventListener('click',e=>{const b=e.target.closest('[data-mopen]');if(!b||!openIt)return;post('made/open',{id:openIt.id,how:b.dataset.mopen}).then(()=>toast(b.dataset.mopen==='folder'?'Its folder is open':'The file is open')).catch(er=>toast(er.message))});
addEventListener('keydown',e=>{if(e.key==='Escape'){$('#sheet').hidden=true;$('#tmenu').hidden=true}});
let ringItems=[];const ringR=()=>{const n=Math.max(8,ringItems.length||12);return ($('#ring').offsetWidth||230)/2/Math.tan(Math.PI/n)+34};
function buildRing(){const vis=items.filter(i=>i.type==='image'||i.type==='video');ringItems=(vis.length>=6?vis:items).slice(0,12);if(!ringItems.length){$('#ring').innerHTML='';return}const R=ringR(),st=360/Math.max(8,ringItems.length);$('#ring').innerHTML=ringItems.map((it,i)=>`<figure data-id="${esc(it.id)}" style="transform:rotateY(${i*st}deg) translateZ(${R}px)">${thumb(it)}<figcaption>${esc(it.title)}<br>${esc(it.ai)}</figcaption></figure>`).join('');$$('#ring figure').forEach(f=>f.onclick=()=>openItem(itemOf(f.dataset.id)))}
function fillMade(){if(!items.length||!items[0].img)return;const m=items.filter(i=>i.type!=='code').length>=10?items.filter(i=>i.type!=='code'):items;
  const wc=it=>`<figure data-it="${esc(it.id)}">${thumb(it)}<figcaption><i style="background:${AICOL(it.ai)}"></i>${esc(it.ai)}<em>${KIND[it.type]||'FILE'}</em></figcaption></figure>`;
  $$('[data-made]').forEach(h=>{const rows=m.length>=20?5:m.length>=9?3:m.length>=4?2:1;h.innerHTML=`<div class="wall-in" data-rows="${rows}">${Array.from({length:rows},(_,r)=>{let L=m.filter((_,i)=>i%rows===r).slice(0,8);while(L.length&&L.length<6)L=L.concat(L);return `<div class="wrow" style="--d:${[92,70,104,80,96][r]}s;--dir:${r%2?'reverse':'normal'}">${L.concat(L).map(wc).join('')}</div>`}).join('')}</div>`})}
/* the page itself: what was found, or one clear step to find it */
let madeBusy=false,madeTried=false;
function scanMade(quiet){if(madeBusy)return;madeBusy=true;if(!quiet||D.made.state!=='ok')mountMade();post('made/scan').then(()=>{madeBusy=false;return refresh(true)}).then(ch=>{if(!ch)mountMade();if(!quiet)toast(D.made.total?D.made.total+(D.made.total===1?' file found':' files found'):'No new files found')}).catch(e=>{madeBusy=false;mountMade();if(!quiet)toast(e.message)})}
document.addEventListener('click',e=>{if(e.target.closest('[data-mscan]'))scanMade()});
function mountMade(){const m=D.made,ok=m.state==='ok';
  /* the first look of a session happens by itself: it only reads file names on this computer */
  if(!madeBusy&&!madeTried&&(m.state==='off'||m.old)){madeTried=true;setTimeout(()=>scanMade(true),600)}
  items=m.shown.map(x=>Object.assign({img:''},x));
  $('#madeEy').textContent=m.ais.length?m.ais.map(a=>a[0]).join(' · '):'Claude Code · Codex · Gemini CLI · Cursor';
  $('#madeOn').hidden=!ok;$('#madeOff').hidden=ok;
  if(!ok){$('#madeOff').innerHTML=`<div class="sphere" style="--glow:${GLOW['--violet']}">${ic('made')}</div><div class="eyebrow"><b>AI made</b> &nbsp;·&nbsp; ${madeBusy?'looking':m.state==='empty'?'looked '+esc(m.when):'not looked yet'}</div><h3 class="h2">${madeBusy?'Looking through <em>your AI projects.</em>':m.state==='empty'?'Nothing new <em>in the last 14 days.</em>':'Find what your AIs <em>made for you.</em>'}</h3><p class="lede">${m.state==='empty'&&!madeBusy?'No file was saved in your AI project folders in the last 14 days. New files show up here by themselves.':'One look finds the folders Claude Code, Codex, Gemini CLI and Cursor work in, and lists the files saved there in the last 14 days. Conversations are never read.'}</p>${madeBusy?'<div class="scan-bar"><i style="width:60%"></i></div>':`<button class="btn" type="button" data-mscan>${ic('spark')}${m.state==='empty'?'Look again':'Look for files'}</button>`}<p class="ce-note">${LOCK}Everything stays on this computer.</p>`;
    $$('[data-made]').forEach(h=>h.innerHTML='');return}
  $('#madeH').textContent=`${fmt(m.total)} made since ${m.from}.`;$('#madeStat').innerHTML=`<div class="num">${m.counts.image}<small>Images</small></div><div class="num">${m.counts.video}<small>Videos</small></div><div class="num">${m.counts.other}<small>Docs and code</small></div>`;
  makeThumbs();drawFilters();drawMedia();buildRing();fillMade();onScroll()}
function mediaReady(){mountMade()}
const kick=()=>{if(fontsDone)return;fontsDone=true;mediaReady();drawRev();if(!$('#p-money').hidden)drawMoney()};
