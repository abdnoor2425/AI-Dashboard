/* ---------- goals: today feeds the week, the week feeds the month, the month feeds the quarter ---------- */
let glevel=2;const stacks=[];const LV=()=>GOALS.map((_,i)=>i).reverse(),LVN=['quarter','month','week','day'],gName=l=>l===3?'goal for today':GOALS[l].k.toLowerCase()+' goal';
function mountStack(stage,list,big){stage.innerHTML=`<div class="iso" style="--s:${big?1.18:1};--gap:${GOALS.length>3?60:80}px"><div class="floor"></div>${GOALS.map((g,i)=>`<div class="plate" data-l="${i}" style="--i:${i};--p:${g.p}%"><div class="face"><div class="fill"></div><div class="lab">${String(GOALS.length-i).padStart(2,'0')} · ${g.k}</div><div class="pct num">${g.p}%</div></div><div class="e1"></div><div class="e2"></div></div>`).join('')}</div>`;
  if(list)list.innerHTML=LV().map(i=>{const g=GOALS[i];return `<button class="lvr" type="button" data-l="${i}" aria-pressed="false"><div class="eyebrow">${g.k} · ${esc(g.sub)}</div><div class="r1" style="margin-top:10px"><b>${g.n?esc(g.head):'No goals yet'}</b><span class="num">${g.p}%</span></div><div class="meter"><i style="width:${g.p}%"></i></div><small>${esc(g.note)}</small></button>`}).join('');
  if(!stacks.includes(stage))stacks.push(stage);
  stage.querySelectorAll('.plate').forEach(p=>p.onclick=()=>setLevel(+p.dataset.l));
  if(list)list.querySelectorAll('.lvr').forEach(b=>{b.onclick=()=>setLevel(+b.dataset.l);b.onpointerenter=()=>setLevel(+b.dataset.l)})}
function setLevel(l){if(!GOALS.length)return;glevel=l;$$('.plate').forEach(p=>{const on=+p.dataset.l===l;p.classList.toggle('act',on);p.classList.toggle('dim',!on);p.style.setProperty('--lift',on?'26px':'0px')});$$('.lvr').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.l===l));
  const g=GOALS[l];$('#goalTabs').innerHTML=LV().map((i,n)=>`<button role="tab" type="button" data-l="${i}" aria-selected="${i===l}"><small>${nn(n)}</small>${GOALS[i].k}</button>`).join('');$$('#goalTabs button').forEach(b=>b.onclick=()=>setLevel(+b.dataset.l));
  $('#gEy').innerHTML=`<b>${g.k}</b> &nbsp;·&nbsp; ${esc(g.sub)}`;$('#gTitle').textContent=g.n?g.p+'% there.':'Nothing set yet.';
  $('#gSub').textContent=!g.n?(l===0?'Start here. Up to three goals for the quarter, and everything else stacks up to them.':'Add up to three goals. Each one can feed a goal on the level above.'):l===3?'What you will do today. Each one moves a week goal forward.':l===2?'Goals for this week. Each one moves a month goal forward.':l===1?`Goals for ${g.sub}. Each one moves a quarter goal forward.`:'Goals for the quarter. Everything else stacks up to these.';
  $('#gcards').innerHTML=g.items.map(it=>`<button class="panel gcard tilt" type="button" data-gedit="${esc(it[3])}"><div class="gtop"><div class="torus-wrap"><div class="torus" style="--p:${it[1]}"></div></div><b class="num">${it[1]}%</b></div><h3>${esc(it[0])}</h3>${it[2]?`<div class="feeds">${ic('upa',2)}${esc(it[2])}</div>`:''}<span class="gedit">Update</span></button>`).join('')
   +(g.items.length<3?`<button class="panel gcard gadd" type="button" data-gadd="${l}"><div class="gtop"><div class="sphere" style="--glow:${GLOW[GCOL[l]]}">${ic('plus',2)}</div></div><h3>Add a ${gName(l)}</h3><div class="feeds">${3-g.items.length} of 3 free</div></button>`:'')}
function mountGoals(){const G=D.goals;$('#gHeadEy').textContent=G.levels.length?`Week ${G.week} · ${G.levels[1].sub} · ${G.levels[0].sub}`:'';mountStack($('#isoB'),$('#lvB'),true);setLevel(glevel)}

/* one small form to add or update a goal */
let gEdit=null;
function openGoal(id,level){const all=GOALS.flatMap((g,i)=>g.items.map(it=>({id:it[3],title:it[0],p:it[1],l:i,feeds:it[4]||''})));const cur=all.find(x=>x.id===id)||null,l=cur?cur.l:level;gEdit={id:cur?cur.id:'',l};
  const up=l>0?GOALS[l-1]:null;
  $('#gsT').textContent=cur?'Update this goal':'Add a '+gName(l);$('#gsE').innerHTML=`<b>${GOALS[l].k}</b> &nbsp;·&nbsp; ${esc(GOALS[l].sub)}`;$('#gsI').style.setProperty('--glow',GLOW[GCOL[l]]);
  $('#gsTitle').value=cur?cur.title:'';$('#gsP').value=cur?cur.p:0;$('#gsPv').textContent=(cur?cur.p:0)+'%';
  $('#gsFeedW').hidden=!up||!up.items.length;$('#gsFeed').innerHTML='<option value="">Nothing yet</option>'+(up?up.items.map(it=>`<option value="${esc(it[3])}">${esc(it[0])}</option>`).join(''):'');
  const raw=(D.goals.raw||[]).find(x=>x.id===id);$('#gsFeed').value=raw&&raw.feeds?raw.feeds:'';
  $('#gsDel').hidden=!cur;$('#gsDraft').hidden=!cur||l>=GOALS.length-1;$('#gsheet').hidden=false;setTimeout(()=>$('#gsTitle').focus(),30)}
const closeGoal=()=>{$('#gsheet').hidden=true};
$('#gsP').oninput=e=>{$('#gsPv').textContent=e.target.value+'%'};
$('#gsX').onclick=$('#gsCancel').onclick=closeGoal;$('#gsheet').addEventListener('click',e=>{if(e.target.id==='gsheet')closeGoal()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#gsheet').hidden)closeGoal()});
$('#gsForm').onsubmit=e=>{e.preventDefault();const title=$('#gsTitle').value.trim();if(title.length<3)return toast('Give the goal a short name');
  post('plan/save',{id:gEdit.id,level:LVN[gEdit.l],title,progress:+$('#gsP').value,feeds:$('#gsFeed').value}).then(()=>{closeGoal();glevel=gEdit.l;return refresh(true)}).then(()=>toast('Saved')).catch(er=>toast(er.message))};
const gDraft=(id,btn)=>{if(!id)return;const was=btn.textContent;btn.disabled=true;btn.textContent='Drafting';return post('plan/draft',{id}).then(r=>{closeGoal();glevel=LVN.indexOf(r.level);return refresh(true).then(()=>toast(r.added+(r.added>1?' steps':' step')+' drafted'+(r.byAi?' by your AI':'')+'. Open one to change it.'))}).catch(er=>toast(er.message)).finally(()=>{btn.disabled=false;btn.textContent=was})};
$('#gsDraft').onclick=e=>gDraft(gEdit&&gEdit.id,e.currentTarget);
$('#gDraftTop').onclick=e=>{const g=GOALS[glevel];if(glevel>=GOALS.length-1)return toast('Pick a week, month or quarter goal first');if(!g||!g.items.length)return toast('Add a goal on this level first');if(g.items.length>1)return toast('Open the goal you want, then press Draft steps from goal');gDraft(g.items[0][3],e.currentTarget)};
$('#gsDel').onclick=()=>{if(!gEdit||!gEdit.id)return;post('plan/remove',{id:gEdit.id}).then(()=>{closeGoal();return refresh(true)}).then(()=>toast('The goal was removed')).catch(er=>toast(er.message))};
document.addEventListener('click',e=>{const a=e.target.closest('[data-gadd]');if(a)return openGoal('',a.dataset.gadd===''?glevel:+a.dataset.gadd);const g=e.target.closest('[data-gedit]');if(g)openGoal(g.dataset.gedit,glevel)});

/* ---------- money: Stripe, read-only ---------- */
const dlab=i=>{const d=new Date(D.now||Date.now());d.setDate(d.getDate()-(27-i));return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})};
function mountMoney(){const M=D.money,ok=M.state==='ok';$('#monOn').hidden=!ok;$('#monOff').hidden=ok;
  if(!ok){$('#monOff').innerHTML=`<div class="sphere" style="--glow:${GLOW['--gold']}">${ic('money')}</div><div class="eyebrow"><b>Stripe</b> &nbsp;·&nbsp; ${M.state==='error'?'needs a look':M.state==='empty'?'connected':'not connected yet'}</div><h3 class="h2">${M.state==='error'?'The last sync <em>did not finish.</em>':M.state==='empty'?'Your first numbers <em>are on the way.</em>':'Connect Stripe <em>to see your money here.</em>'}</h3><p class="lede">${M.state==='error'?esc(M.detail||'Open Connections and connect Stripe again.'):M.state==='empty'?'Stripe is connected. Revenue, payouts and failed payments appear after the next sync.':'Revenue by day and by month, recurring revenue, the next payout, failed payments and your top customers. The dashboard only ever reads from Stripe.'}</p><a class="btn" href="#connections">${M.state==='off'?'Connect Stripe':'Open Connections'}</a><p class="ce-note">${LOCK}Read-only. Your numbers stay on this computer.</p>`;return}
  const s=esc(M.sym),K=[['Revenue · '+esc(M.monthName)+' so far',s+fmt(M.total),M.delta==null?'<span class="dim">No earlier month to compare with yet</span>':`<span class="${M.delta<0?'down':'up'}">${M.delta>0?'+':''}${M.delta}%</span> <span class="dim">vs same day in ${esc(M.prevName)}</span>`],
   ['Recurring · MRR',M.mrr==null?'–':s+fmt(M.mrr),M.subs==null?'<span class="dim">No subscriptions found</span>':`<span class="dim">${M.subs} active ${M.subs===1?'subscription':'subscriptions'}</span>`],
   ['Next payout',M.payout?s+fmt(M.payout.amount):'–',`<span class="dim">${M.payout?esc(M.payout.on):'No payout is on its way'}</span>`],
   ['To recover',s+fmt(M.failedTotal),M.failed.length?`<span class="down">${M.failed.length} failed ${M.failed.length>1?'payments':'payment'}</span>`:'<span class="up">Nothing is waiting</span>']];
  $('#kpis').innerHTML=K.map(k=>`<div class="tile tilt stripe"><div class="src"><i style="background:var(--gold)"></i>Stripe</div><div class="lab">${k[0]}</div><div class="v num">${k[1]}</div><div class="d">${k[2]}</div></div>`).join('');
  $('#nudge').innerHTML=M.failed.length?M.failed.map(f=>`<tr><td>${esc(f.who)}</td><td class="mut">${esc(f.why)}</td><td class="r num">${s}${fmt(f.amount)}</td><td class="r">${f.url?`<a class="btn sm line" href="${esc(f.url)}" target="_blank" rel="noopener">Open in Stripe</a>`:''}</td></tr>`).join(''):'<tr><td colspan="4" class="mut">Every payment went through. Nothing needs a nudge.</td></tr>';
  $('#custs').innerHTML=M.top.length?M.top.map(c=>`<tr><td>${esc(c.name)}</td><td class="r num">${s}${fmt(c.paid)}</td><td class="r num">${c.share}%<span class="share"><i style="width:${Math.min(100,c.share*3)}%"></i></span></td></tr>`).join(''):'<tr><td colspan="3" class="mut">No paying customers in the last 90 days.</td></tr>';
  $('#monWhen').innerHTML=`<i style="background:var(--gold)"></i>Stripe · updated ${esc(M.when)}`;
  if(!$('#p-money').hidden)drawMoney()}
function drawMoney(){const M=D.money;if(M.state!=='ok'||!$('#monChart'))return;const all=M.days56,rv=all.slice(-28),a=sum(rv),b=sum(all.slice(0,28));
  $('#monBig').innerHTML=`${esc(M.sym)}${fmt(a)}<small>${b?pct(a,b)+' on the four weeks before':'no earlier period to compare with yet'}</small>`;lineChart($('#monChart'),rv,rv.map((_,i)=>dlab(i)),{c:css('--gold'),pre:M.sym,h:300})}
