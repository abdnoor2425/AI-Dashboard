/* ---------- routing ---------- */
const NAMES={room:'Decision Room',scan:'Scan for AI',overview:'Overview',news:'AI news',money:'Money',goals:'Goals',made:'AI made',brain:'Second Brain'};
/* Pages that keep their own view. The app draws them into #legacy; here they only need a name and a place in the rail. */
const KEPT={attention:'Needs you',website:'Website',social:'Social and reels',reels:'Reel scores',team:'Your team',connections:'Connections',settings:'Settings',more:'More',
  metrics:'Metrics',inbox:'Inbox',calendar:'Calendar',files:'Files',skills:'Skills',suggestions:'Suggestions',usage:'AI usage',setup:'Setup'};
const UNDER={reels:'social',metrics:'more',inbox:'more',calendar:'more',files:'more',skills:'more',suggestions:'more',usage:'more',setup:'more'};
let here='overview';
function markNav(){$$('#nav a').forEach(a=>a.dataset.p===(UNDER[here]||here)?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'))}
function route(){if(SETUP){$$('.page').forEach(s=>s.hidden=s.id!=='p-setup');document.body.classList.add('is-setup');$('#ask').hidden=true;return}
  const raw=(location.hash||'#overview').slice(1).split('?')[0].split('/');
  const kept=KEPT[raw[0]]||(raw[0]==='brain'&&raw[1]==='edit'?'Second Brain':'');
  const page=kept?'x':NAMES[raw[0]]?raw[0]:'overview';here=kept?raw[0]:page;
  if(page==='overview'&&(raw[1]==='sites'||raw[1]==='clients')&&raw[1]!==mode)setMode(raw[1]);
  $$('.page').forEach(s=>s.hidden=s.id!=='p-'+page);
  markNav();$('#crumb').textContent=kept||NAMES[page];
  $('#ask').hidden=page!=='made';$('#tmenu').hidden=true;document.body.classList.toggle('is-brain',page==='brain');
  document.body.classList.remove('nav-open');scrollTo(0,0);if(page!=='overview'&&playing)stopBrief();
  if(page==='made'&&fontsDone)buildRing();if(page==='money')drawMoney();if(page==='overview'&&fontsDone)drawRev();if(page==='brain')brainInit();if(page==='room')dRoute(raw[1],raw[2]);else dStop();
  onScroll();if(reduce)frame(performance.now())}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="ask"]');if(b)dispatchEvent(new CustomEvent('aid:ask'))});
addEventListener('hashchange',route);

/* ---------- scroll: reveal, goal stack, ring, background ---------- */
let still=false;
function onScroll(){const vh=innerHeight;scrollY0=scrollY;if(!$('#tmenu').hidden&&innerWidth>=620)$('#tmenu').hidden=true;
  $$('.page:not([hidden]) .rv').forEach(el=>{if(reduce||still){el.style.transform='';el.style.opacity='';return}const r=el.getBoundingClientRect();const k=clamp((r.top-vh*.9)/(vh*.14),0,1);el.style.transform=k?`translateY(${k*30}px)`:'';el.style.opacity=1-k*.55});
  stacks.forEach(st=>{if(!st.isConnected||!st.offsetParent)return;const r=st.getBoundingClientRect();const k=still?1:clamp(1-(r.top+r.height*.35-vh*.35)/(vh*.6),0,1);st.querySelectorAll('.plate').forEach(p=>p.style.setProperty('--gap',(reduce?84:38+k*58)+'px'));st.firstChild.style.transform=`translateY(40px) rotateX(58deg) rotateZ(${reduce?-42:-52+k*12}deg) scale(var(--s,1))`});
  if(!$('#p-made').hidden&&ringItems.length){const sec=$('#ringSec').getBoundingClientRect();const p=clamp(-sec.top/Math.max(1,sec.height-vh*.82),0,1);$('#ring').style.transform=`translateZ(-${ringR()}px) rotateX(-7deg) rotateY(${-18-p*320}deg)`}}
addEventListener('scroll',onScroll,{passive:true});
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(fontsDone){drawRev();drawWeb();if(!$('#p-money').hidden)drawMoney();if(!$('#p-made').hidden)buildRing()}onScroll()},150)});

/* ---------- pointer tilt with glare ---------- */
if(matchMedia('(hover:hover)').matches&&!reduce){let cur=null;document.addEventListener('pointermove',e=>{const t=e.target.closest&&e.target.closest('.tilt');if(cur&&cur!==t){cur.style.removeProperty('--rx');cur.style.removeProperty('--ry')}if(t){const r=t.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;t.style.setProperty('--rx',((.5-y)*7).toFixed(2)+'deg');t.style.setProperty('--ry',((x-.5)*8).toFixed(2)+'deg');t.style.setProperty('--gx',(x*100)+'%');t.style.setProperty('--gy',(y*100)+'%')}cur=t},{passive:true})}

window.__pv={look:(k,user)=>setLook(LOOKS[k]?k:look,!!user),toast,boot:b=>{if(SETUP)return;BOOT=b||BOOT;drawNav();refresh()},refresh:()=>refresh(),mode:setMode,site:x=>{site=x;drawDeck()},client:openClient,connect:connectClient,detail:openDetail,gx:setGx,scan:scanSet,run:runScan,shape:setShape,card:k=>showCard(ovCard(k)),area:setArea,fold:openFold,file:openFile,still:()=>{still=true;onScroll()},brain:B,dr:{s:DR,get ds(){return DS},render:dRender,skip:dSkip,folders:dFolders,report:dReport,shared:dShared,ev:dEvCard}};
/* everything that is drawn from the bundle, drawn again when the bundle changes */
function remount(){drawNav();mountOverview();mountGoals();mountMoney();if(fontsDone)mountMade();askWho();if(typeof brainFresh==='function')brainFresh();if(!$('#p-money').hidden)drawMoney();onScroll()}
/* the ask bar under AI made: the question goes to the AI linked on this computer, with the numbers already on screen */
function askWho(){$('#askWho').textContent=D.ai&&D.ai.name?D.ai.name+' · your plan':'Simple rules · no AI linked'}
function askNow(){const q=$('#askInput').value.trim();if(q.length<3)return;const b=$('#askGo');b.disabled=true;b.textContent='Asking';
  post('ai/ask',{question:q}).then(r=>{showCard({small:1,icon:'spark',glow:'--violet',ey:'<b>You asked</b>',title:q,lede:r.answer||'',rows:[],src:[[r.provider&&r.provider!=='rules'?r.provider:'Simple rules','--gold',r.note||'','']],acts:[]})}).catch(e=>toast(e.message)).finally(()=>{b.disabled=false;b.textContent='Ask'})}
$('#askGo').onclick=askNow;$('#askInput').addEventListener('keydown',e=>{if(e.key==='Enter')askNow()});
/* During the first run no page of the dashboard is drawn: only the welcome steps, over the same moving background. */
if(SETUP){setLook(look,false);route();requestAnimationFrame(frame)}
else{applyData();setLook(look,false);drawNav();mountOverview();mountGoals();mountMoney();askWho();
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(kick);setTimeout(kick,1800);
route();requestAnimationFrame(frame)}
