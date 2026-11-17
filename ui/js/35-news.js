/* ---------- AI news: topics you choose, up to three ---------- */
let TOPICS=[],topics=[];
const tName=k=>(TOPICS.find(t=>t[0]===k)||[])[1]||k, tShort=k=>(TOPICS.find(t=>t[0]===k)||[])[2]||k;
function newsList(){TOPICS=D.news.all;topics=D.news.topics;return D.news.stories}
const badge=n=>esc(String(n||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase());
const ncard=(n,i)=>`<article class="ncard" data-i="${i}" tabindex="0"><div class="n-top"><div class="xb" aria-hidden="true">${badge(n.name)}</div><div class="grow"><b>${esc(n.name)}</b><small>${esc(n.h)}${n.t?(n.h?' · ':'')+esc(n.t)+' ago':''}</small></div><span class="tag">${esc(tShort(n.topic))}</span></div><h3 class="n-h">${esc(n.head)}</h3>${n.sum?`<p class="n-s">${esc(n.sum)}</p>`:''}<div class="n-use"><div class="eyebrow">What it could be for</div>${n.use.length?n.use.map(u=>`<div>${ic('arrow',2)}<span><b>${esc(u[0])}:</b> ${esc(u[1])}</span></div>`).join(''):`<div class="dim">${ic('arrow',2)}<span>${D.ai?'Your AI writes this part the next time it reads the news.':'Connect your AI, and it writes what each story could be for.'}</span></div>`}</div><div class="n-foot"><span>${n.fit?'Fit for you '+n.fit+'%':'Not rated yet'}</span><span class="fit"><i style="width:${n.fit||0}%"></i></span><span>${esc(n.st)}</span></div></article>`;
/* the stories are read on this computer: when there are none yet, or they are old, they are read again quietly */
let newsBusy=false,newsTried=false;
/* the stories show at once; the AI's notes on them arrive a little later, so the page looks again until they are in */
function newsPoll(k){if(!D.news.writing||k>40)return;setTimeout(()=>refresh().then(()=>newsPoll(k+1)).catch(()=>{}),6000)}
function readNews(force){if(newsBusy)return;newsBusy=true;drawNewsState();post('news/read',{force:!!force}).then(()=>{newsBusy=false;return refresh(true)}).then(ch=>{if(!ch){mountNews()}newsPoll(0)}).catch(e=>{newsBusy=false;mountNews();if(force)toast(e.message)})}
const newsNote=()=>newsBusy?'Reading today\'s stories on your topics':D.news.error?esc(D.news.error):D.news.state==='ok'?'No story on your topics in the last few days. Try another topic.':'Nothing has been read yet.';
const newsEmpty=()=>`<div class="n-empty"><div class="sphere" style="--glow:${GLOW['--violet']}">${ic('news')}</div><b>${newsBusy?'Reading the news':'No stories yet'}</b><p>${newsNote()}</p>${newsBusy?'<div class="scan-bar"><i style="width:60%"></i></div>':'<button class="btn sm" type="button" data-nread>Read the news now</button>'}</div>`;
function drawNewsState(){const w=$('#deckWrap');if(w&&!curNews.length)w.innerHTML=newsEmpty();const g=$('#ngrid');if(g&&!curNews.length)g.innerHTML=newsEmpty();$$('[data-nread]').forEach(b=>b.disabled=newsBusy)}
document.addEventListener('click',e=>{if(e.target.closest('[data-nread]'))readNews(true)});
let act=0,deckHover=false,curNews=[];
function layNews(){const dk=$('#deck'),pl=$('#pile'),n=curNews.length,dm=LOOKS[look].dark?1:.3;
  if(dk){$$('#deck .ncard').forEach((c,i)=>{const d=i-act-nFrac,a=Math.abs(d);c.style.transform=`translateX(${d*76}%) translateZ(${-a*210}px) rotateY(${d*-24}deg)`;c.style.opacity=a>2.4?0:1;c.style.filter=`brightness(${1-Math.min(a,2)*.38*dm})`;c.style.zIndex=10-Math.round(a);c.style.pointerEvents=a>2.4?'none':'auto';c.setAttribute('aria-current',i===act)});$$('#dDots i').forEach((x,i)=>x.classList.toggle('on',i===act))}
  if(pl){$$('#pile .ncard').forEach((c,i)=>{const d=(i-act+n)%n,gone=d===n-1&&n>3;c.style.transform=gone?'translateX(46%) rotate(7deg)':`translateY(${-Math.min(d,2)*13}px) scale(${1-Math.min(d,2)*.045})`;c.style.opacity=gone||d>2?0:1;c.style.filter=`brightness(${1-Math.min(d,2)*.2*dm})`;c.style.zIndex=10-d;c.style.pointerEvents=d===0?'auto':'none';c.setAttribute('aria-current',d===0)})}}
const go=d=>{const n=curNews.length;if(!n)return;act=(act+d+n)%n;layNews()};
let nFrac=0,nDragAt=0;
function deckSwipe(dk){let dg=null,acc=0,at=0,wt;const n=()=>curNews.length,step=d=>{const a=clamp(act+d,0,n()-1);if(a!==act){act=a;layNews()}};
  $$('#deck .ncard').forEach(c=>{c.onclick=()=>{if(performance.now()-nDragAt<320)return;const i=+c.dataset.i;if(i===act){const s=ovCard('nw'+i);if(s)showCard(s);return}act=i;layNews()};c.onkeydown=e=>{if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1);if(e.key==='Enter')c.click()}});
  dk.onpointerenter=()=>deckHover=true;dk.onpointerleave=()=>deckHover=false;
  dk.onwheel=e=>{const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.shiftKey?e.deltaY:0;if(!dx)return;e.preventDefault();const now=performance.now();acc+=dx*(e.deltaMode?40:1);clearTimeout(wt);wt=setTimeout(()=>acc=0,240);if(Math.abs(acc)>=60&&now-at>190){step(acc>0?1:-1);acc=0;at=now}};
  dk.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const c=dk.querySelector('.ncard');dg={x:e.clientX,y:e.clientY,id:e.pointerId,on:false,w:(c?c.offsetWidth:400)*.76}};
  dk.onpointermove=e=>{if(!dg||e.pointerId!==dg.id)return;const dx=e.clientX-dg.x;if(!dg.on){if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(e.clientY-dg.y))return;dg.on=true;dk.classList.add('drag');try{dk.setPointerCapture(dg.id)}catch(_){}}nFrac=clamp(-dx/dg.w,-act-.3,n()-1-act+.3);layNews()};
  const end=()=>{if(!dg)return;const was=dg.on;dg=null;if(!was)return;dk.classList.remove('drag');act=clamp(Math.round(act+nFrac),0,n()-1);nFrac=0;nDragAt=performance.now();layNews()};
  dk.onpointerup=end;dk.onpointercancel=end}
function mountNews(){curNews=newsList();const w=$('#deckWrap');
  if(w){if(curNews.length){w.innerHTML=`<div class="deck" id="deck"></div><div class="deck-nav"><button class="round" type="button" data-nprev aria-label="Previous story">←</button><div class="dots" id="dDots"></div><button class="round" type="button" data-nnext aria-label="Next story">→</button></div><p class="deck-hint">Swipe, drag or scroll sideways to move through the stories. Click the front card for details.</p>`;
      const dk=$('#deck');dk.innerHTML=curNews.map(ncard).join('');$('#dDots').innerHTML=curNews.map(()=>'<i></i>').join('');act=curNews.length>2?1:0;deckSwipe(dk)}
    else w.innerHTML=newsEmpty()}
  layNews();drawTbars();drawNews();
  if(!newsBusy&&!newsTried&&(D.news.state==='off'||D.news.stale)){newsTried=true;readNews(false)}}
if(!reduce)setInterval(()=>{if(curNews.length>1&&!deckHover&&!nFrac&&!$('#p-overview').hidden&&document.visibilityState==='visible'&&$('#tmenu').hidden)go(1)},7000);
let nt='all';
function drawNews(){const tabs=[['all','All']].concat(topics.map(k=>[k,tShort(k)]));if(!topics.includes(nt))nt='all';
  $('#newsTabs').innerHTML=tabs.map((t,i)=>`<button role="tab" type="button" aria-selected="${t[0]===nt}" data-t="${esc(t[0])}"><small>${nn(i)}</small>${esc(t[1])}</button>`).join('');$$('#newsTabs button').forEach(b=>b.onclick=()=>{nt=b.dataset.t;drawNews()});
  const L=curNews.filter(n=>nt==='all'||n.topic===nt);$('#newsEy').textContent=D.news.state==='ok'?'Read '+D.news.when+', on the topics you choose':'On the topics you choose';
  $('#ngrid').innerHTML=L.length?L.map(n=>ncard(n,curNews.indexOf(n))).join(''):newsEmpty();
  $$('#ngrid .ncard').forEach(c=>{c.onclick=()=>{const s=ovCard('nw'+c.dataset.i);if(s)showCard(s)};c.onkeydown=e=>{if(e.key==='Enter')c.click()}})}
function drawTbars(){const h=`<span class="eyebrow">Your topics</span>${(topics||[]).map(k=>`<span class="chip"><i style="background:var(--gold)"></i>${esc(tName(k))}</span>`).join('')}<button class="chip pick" type="button" data-pick aria-haspopup="dialog">${ic('plus',2)}Change topics · ${topics.length} of 3</button>`;$$('[data-tbar]').forEach(e=>e.innerHTML=h)}
let tpick=null;
function drawTopics(){if(!tpick)tpick=topics.slice();$('#tmList').innerHTML=TOPICS.map(t=>{const on=tpick.includes(t[0]);return `<button type="button" role="menuitemcheckbox" aria-checked="${on}" data-k="${esc(t[0])}" ${!on&&tpick.length>=3?'disabled':''}><span class="bx">${ic('check',2.6)}</span><span class="grow">${esc(t[1])}</span>${t[0][0]==='~'?'<span class="tag">Yours</span>':''}</button>`}).join('');
  $('#tmCount').textContent=tpick.length+' of 3 picked';
  $$('#tmList button').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(tpick.includes(k)){if(tpick.length===1)return toast('Keep at least one topic');tpick=tpick.filter(x=>x!==k)}else if(tpick.length<3)tpick.push(k);drawTopics()})}
function saveTopics(add){const before=topics.join(),body={topics:tpick||topics};if(add)body.add=add;
  return post('news/topics',body).then(r=>{tpick=null;return refresh(true).then(()=>{if(topics.join()!==before||add)readNews(true)})}).catch(e=>toast(e.message))}
function openTopics(btn){const m=$('#tmenu');m.hidden=false;tpick=topics.slice();drawTopics();const r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
  if(innerWidth<620){m.style.left='12px';m.style.top='auto';m.style.bottom='12px'}else{m.style.bottom='auto';m.style.left=clamp(r.left,12,innerWidth-mw-12)+'px';m.style.top=clamp(r.bottom+8,70,Math.max(70,innerHeight-mh-12))+'px'}}
$('#tmAdd').onsubmit=e=>{e.preventDefault();const v=$('#tmInput').value.trim().replace(/\s+/g,' ');if(!v)return;
  if(TOPICS.some(t=>t[1].toLowerCase()===v.toLowerCase()))return toast('That one is already on the list');
  $('#tmInput').value='';saveTopics(v).then(()=>{tpick=null;drawTopics();const l=$('#tmList');l.scrollTop=l.scrollHeight})};
const closeTopics=()=>{const m=$('#tmenu');if(m.hidden)return;m.hidden=true;if(tpick&&tpick.join()!==topics.join())saveTopics();else tpick=null};
$('#tmDone').onclick=closeTopics;
document.addEventListener('pointerdown',e=>{const m=$('#tmenu');if(!m.hidden&&!e.target.closest('#tmenu')&&!e.target.closest('[data-pick]'))closeTopics()});
