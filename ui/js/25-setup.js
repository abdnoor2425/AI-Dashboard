/* ---------- First run, and Scan for AI ----------
   A new owner sees this instead of the dashboard: a welcome, Google sign-in, their tools, one scan for the AIs on this computer,
   their profile, and then their own data coming in. Nothing made up is shown at any point.
   The scan is also a page of its own (#scan), so it can be run again later. */
const SETUP=!!BOOT.firstRun;
IC.folder='<path d="M3 7.5a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>';
const GOOGLE_G='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

/* One drawing for every step: rings, the orb in the middle, and a ring of named points around it. */
function radarHTML(nodes,big){const n=Math.max(nodes.length,1);
  const P=nodes.map((a,i)=>{const ang=(-116+i*360/n)*Math.PI/180,r=n>4&&i%2?.305:.42;return [50+Math.cos(ang)*r*100,50+Math.sin(ang)*r*100,Math.cos(ang),Math.sin(ang),r]});
  return `<i class="rg"></i><i class="rg r2"></i><i class="rg r3"></i><i class="sweep"></i><svg viewBox="0 0 470 470" aria-hidden="true">${P.map((p,i)=>`<line data-i="${i}"${nodes[i].on&&!nodes[i].cloud?' class="on"':''} style="--c:var(${nodes[i].c})" x1="${(50+p[2]*(p[4]*100-7))*4.7}" y1="${(50+p[3]*(p[4]*100-7))*4.7}" x2="${(50+p[2]*(big?31:19))*4.7}" y2="${(50+p[3]*(big?31:19))*4.7}"/>`).join('')}</svg>${orbw()}${nodes.map((a,i)=>`<div class="rnode${a.cloud?' cloud':''}${a.on?' on':''}${P[i][3]<-.3?' lu':''}" data-i="${i}" style="left:${P[i][0]}%;top:${P[i][1]}%;--c:var(${a.c})"><div class="sphere mono" style="--glow:${GLOW[a.c]||GLOW['--gold']}">${esc(a.ini)}</div><span>${esc(a.label)}</span></div>`).join('')}`}

/* ---------- Scan for AI ---------- */
const AIM={'claude-code':['CC','--gold'],codex:['CX','--mint'],gemini:['GM','--ice'],cursor:['CU','--violet'],'claude-app':['CD','--ember'],chatgpt:['GP','--text-3'],grok:['GK','--text-2']};
const AI0=[['claude-code','Claude Code'],['codex','Codex'],['gemini','Gemini CLI'],['cursor','Cursor'],['claude-app','Claude desktop app'],['chatgpt','ChatGPT'],['grok','Grok']].map(([id,name])=>({id,name,kind:id==='chatgpt'?'cloud':'cli',installed:false,connected:false}));
const SCP=SETUP?'#suP':'#scanP',SCL=SETUP?'#suL':'#scanL',SCR=SETUP?'#suR':'#radar';
const COUNT=['No','One','Two','Three','Four','Five','Six','Seven'];
let scanState='idle',scanT=[],scanN=0,AG=null,SRES=null,scanErr={};
const agSort=l=>AI0.map(a=>l.find(x=>x.id===a.id)||a);
const agOff=a=>a.kind==='cloud'||(!!AG&&!a.installed);
const agNodes=()=>(AG||AI0).map(a=>({label:a.name,ini:AIM[a.id][0],c:agOff(a)?'--text-3':AIM[a.id][1],cloud:agOff(a),on:scanState==='done'}));
const agSub=a=>scanErr[a.id]||(a.kind==='cloud'?'Runs in the cloud, so it cannot reach this computer yet':!a.installed?'Not on this computer':!a.connected?'Found on this computer. Switched off.':a.id==='claude-app'?'Connected. Restart the Claude app to see it.':a.answers?'Connected. Answers here and runs the Decision Room.':'Connected. Ask it about your dashboard in its own chat.');
const airow=(a,full)=>{const m=AIM[a.id],off=agOff(a);return `<div class="airow${off?' cloud':''}"><div class="sphere mono" style="--glow:${GLOW[off?'--text-3':m[1]]}">${m[0]}</div><div class="grow"><b>${esc(a.name)}</b><small${scanErr[a.id]?' class="bad"':''}>${esc(full?agSub(a):a.kind==='cloud'?'Runs in the cloud':off?'Not on this computer':'Found on this computer')}</small></div>${full?(off?'':`<input class="tg" type="checkbox" data-ag="${a.id}"${a.connected?' checked':''} aria-label="Use ${esc(a.name)}">`):(off?'':`<span class="ok">${TICK}</span>`)}</div>`};
function scanRadar(){$(SCR).className='radar';$(SCR).innerHTML=radarHTML(agNodes());orbs()}
function scanLeft(){const L=$(SCL),step=SETUP?'<div class="eyebrow"><b>Step 3 of 5</b> &nbsp;·&nbsp; Your AI</div>':'<div class="eyebrow"><b>Your AI</b> &nbsp;·&nbsp; On this computer</div>';
  if(scanState==='idle')L.innerHTML=`${step}<h1 class="title">Let's find <em>your AIs.</em></h1><p class="lede">One scan finds every AI on this computer, connects it, and brings in what it already knows about your work.</p><ul class="reads"><li><i>${TICK}</i>Reads project names, folder names and the files your AIs made</li><li><i>${TICK}</i>Never reads your conversations</li><li><i>${TICK}</i>Everything stays on this computer</li></ul><div class="scan-row"><button class="btn lg" type="button" id="scanGo">${ic('spark')}Scan for AI</button>${SETUP?'<button class="btn line" type="button" data-su="go" data-to="profile">Skip for now</button>':''}</div>`;
  else if(scanState==='scanning')L.innerHTML=`${step}<h1 class="title">Scanning <em>this computer.</em></h1><div class="scan-msg"><span class="live"><i></i></span><span id="scanMsg">Looking through your apps</span></div><div class="scan-bar"><i id="scanBar"></i></div><div class="airows" id="scanRows"></div>`;
  else{const list=AG||[],found=list.filter(a=>a.installed&&a.kind!=='cloud'),on=found.filter(a=>a.connected),R=SRES||{};
    const title=on.length?`${COUNT[on.length]||on.length} AI${on.length>1?'s':''}, <em>${on.length>1&&on.length===found.length?'all connected.':'connected.'}</em>`:found.length?'Found, <em>not connected.</em>':'No AI app <em>found yet.</em>';
    const stats=[[R.folders,R.folders===1?'AI project folder':'AI project folders'],[R.found,R.found===1?'thing made in 14 days':'things made in 14 days'],[R.clients,R.clients===1?'possible client':'possible clients']].filter(x=>x[0]>0);
    L.innerHTML=`${step}<h1 class="title">${title}</h1>${found.length?'':'<p class="lede">The dashboard works without one. Put Claude Code, Codex or Gemini CLI on this computer, then scan again.</p>'}${stats.length?`<div class="since">${stats.map(x=>`<div><b class="num">${fmt(x[0])}</b><span>${x[1]}</span></div>`).join('')}</div>`:''}<div class="airows">${list.map(a=>airow(a,1)).join('')}</div><div class="scan-row">${SETUP?'<button class="btn lg" type="button" data-su="go" data-to="profile">Continue</button>':'<a class="btn lg" href="#overview">Done</a>'}<button class="btn line" type="button" id="scanAgain">Scan again</button>${!SETUP&&R.clients>0?`<a class="more" href="#overview/clients">See the ${R.clients===1?'possible client':R.clients+' possible clients'} <span aria-hidden="true">↗</span></a>`:''}</div>`}}
function scanSet(s){scanT.forEach(clearTimeout);scanT=[];scanState=s;const P=$(SCP);if(!P)return;P.dataset.state=s;scanLeft();scanRadar()}
async function runScan(){if(scanState==='scanning')return;scanErr={};scanSet('scanning');const my=++scanN;
  const wait=ms=>reduce?Promise.resolve():new Promise(r=>scanT.push(setTimeout(r,ms)));
  const live=()=>my===scanN&&scanState==='scanning'&&!!$('#scanMsg');
  let list;try{list=agSort((await getJSON('ai/agents')).agents||[])}catch(e){toast(e.message);scanSet('idle');return}
  if(!live())return;AG=list;scanRadar();await wait(700);
  for(let k=0;k<list.length;k++){if(!live())return;const a=list[k],off=agOff(a);
    $(`${SCR} .rnode[data-i="${k}"]`).classList.add('on');if(!off)$(`${SCR} line[data-i="${k}"]`).classList.add('on');
    $('#scanMsg').textContent=a.kind==='cloud'?a.name+' runs in the cloud':off?a.name+' is not on this computer':'Found '+a.name;
    $('#scanRows').insertAdjacentHTML('beforeend',airow(a,0));$('#scanBar').style.width=((k+1)/list.length*72)+'%';await wait(560)}
  if(!live())return;const found=list.filter(a=>a.installed&&a.kind!=='cloud');
  $('#scanMsg').textContent=found.length?'Connecting '+(found.length>1?'them':found[0].name)+' and reading project names':'Reading project names';$('#scanBar').style.width='84%';
  for(const a of found)if(!a.connected){try{await post('ai/agents/'+a.id,{action:'connect'});a.connected=true}catch(e){scanErr[a.id]=e.message}}
  let made=null,cl=0;try{made=await post('made/scan')}catch(e){}
  if(!SETUP){try{cl=(await post('clients/scan')).found||0}catch(e){}}
  try{AG=agSort((await getJSON('ai/agents')).agents||[])}catch(e){}
  SRES={folders:made?made.folders:0,found:made?made.found:0,clients:cl};
  if(!live())return;$('#scanBar').style.width='100%';await wait(600);if(!live())return;scanSet('done');
  if(!SETUP){getJSON('bootstrap').then(b=>{BOOT=b;drawNav()}).catch(()=>{});refresh(true)}}
document.addEventListener('click',e=>{if(e.target.closest('#scanGo')||e.target.closest('#scanAgain'))runScan()});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.ag)return;const id=t.dataset.ag,on=t.checked;t.disabled=true;delete scanErr[id];
  post('ai/agents/'+id,{action:on?'connect':'disconnect'}).then(r=>{AG=agSort(r.agents||[]);toast((AG.find(a=>a.id===id)||{}).name+(on?' connected':' switched off'))}).catch(x=>{scanErr[id]=x.message})
    .then(()=>{if(scanState==='done'){scanLeft();scanRadar()}if(!SETUP)getJSON('bootstrap').then(b=>{BOOT=b;drawNav()}).catch(()=>{})})});

/* ---------- The first-run steps ---------- */
const SU={step:(BOOT.firstRun&&BOOT.firstRun.step)||'intro',conns:null,google:true,open:'',err:{},busy:'',form:{},brain:null,browse:null,problem:'',poll:0,t0:0,ai:null,leaving:false,drawn:''};
const SU_STEPS=[['signin','Sign in'],['connect','Your tools'],['ai','Your AI'],['profile','Profile'],['welcome','Welcome']];
const TOOLS=[['google-analytics','GA','--ember','Your websites, visitors and leads'],['gmail','GM','--bad','Emails that need a reply'],['drive','DR','--mint','Recent files and documents'],['calendar','CA','--ice','Meetings this week'],['linear','LN','--violet','Tasks and approvals'],['metricool','MC','--gold','Social reach for each brand'],['stripe','ST','--violet','Money in, failed payments and payouts']];
const STRIPE_KEY='https://dashboard.stripe.com/apikeys/create?name=AI-Dashboard'+['rak_charge_read','rak_customer_read','rak_subscription_read','rak_payout_read'].map(p=>'&permissions%5B%5D='+p).join('');
const suConn=id=>(SU.conns||[]).find(c=>c.id===id);
const suEy=(n,what)=>`<div class="eyebrow"><b>Step ${n} of 5</b> &nbsp;·&nbsp; ${what}</div>`;
const suOk=`<span class="su-ok">${TICK}Connected</span>`;
const suWs=()=>BOOT.workspace.id;
function suSteps(){const at=SU_STEPS.findIndex(s=>s[0]===SU.step),el=$('#suSteps');el.hidden=at<0;
  el.innerHTML=SU_STEPS.map((s,i)=>`${i?'<hr>':''}<span class="${i<at?'done':i===at?'cur':''}"${i===at?' aria-current="step"':''}><i>${i<at?'✓':i+1}</i><b>${s[1]}</b></span>`).join('')}
function suRadar(nodes,big,state){const R=$('#suR');R.className='radar'+(big?' big':'');R.innerHTML=radarHTML(nodes,big);$('#suP').dataset.state=state||'idle';orbs()}
const suToolNodes=()=>TOOLS.map(t=>({label:(suConn(t[0])||{}).name||t[0],ini:t[1],c:t[2],on:(suConn(t[0])||{}).status==='connected'})).concat([{label:'Second Brain',ini:'SB',c:'--ice',on:!!(SU.brain&&SU.brain.length)}]);
const suLoadTools=()=>Promise.all([getJSON('connections').then(r=>{SU.conns=r.connections||[];SU.google=!r.google||r.google.ready!==false}),getJSON('brain?workspaceId='+encodeURIComponent(suWs())).then(r=>{SU.brain=r.sources||[];SU.projects=(r.projects||[]).length}).catch(()=>{SU.brain=SU.brain||[]})]);

function suForm(id){const f=SU.form,busy=SU.busy===id;
  const help={linear:'In Linear, open Settings, then Security and access, then Personal API keys.',metricool:'Needs Metricool\'s Advanced or Custom plan. Both are under Account settings, API.',stripe:'Only a read-only key is accepted, so the dashboard can never move money. It is saved on this computer only.'}[id];
  return `<form class="su-form" data-id="${id}">${id==='stripe'?`<p>Stripe makes the key for you. Press the button, press Create key in Stripe, then paste the key here.</p><a class="btn sm line" href="${STRIPE_KEY}" target="_blank" rel="noreferrer">Make the key in Stripe <span aria-hidden="true">↗</span></a>`:''}${id==='metricool'?`<label class="fld"><span>User ID</span><input name="user" inputmode="numeric" autocomplete="off" value="${esc(f[id+'.user']||'')}"></label>`:''}<label class="fld"><span>${id==='linear'?'Personal API key':id==='stripe'?'Read-only key':'API token'}</span><input name="token" type="password" autocomplete="off" placeholder="${id==='stripe'?'rk_live_…':'Paste it here'}" value="${esc(f[id+'.token']||'')}"></label><div class="su-ff"><small>${esc(help)}</small><button class="btn sm" type="submit"${busy?' disabled':''}>${busy?'Checking':'Connect'}</button></div></form>`}
function suTool(t){const c=suConn(t[0]);if(!c)return '';const on=c.status==='connected',g=c.auth==='google',open=SU.open===t[0],e=SU.err[t[0]];
  return `<div class="airow su-row"><div class="sphere mono" style="--glow:${GLOW[t[2]]}">${t[1]}</div><div class="grow"><b>${esc(c.name)}</b><small${e?' class="bad"':''}>${esc(e||t[3])}</small></div>${on?suOk:`<button class="btn sm${g?'':' line'}" type="button" data-su="${g?'gconn':'open'}" data-id="${t[0]}"${SU.busy===t[0]?' disabled':''}>${open?'Cancel':c.status==='error'?'Sign in again':'Connect'}</button>`}</div>${open&&!on&&!g?suForm(t[0]):''}`}
function suBrain(){const n=(SU.brain||[]).length,open=SU.open==='brain',B=SU.browse;
  return `<div class="airow su-row"><div class="sphere" style="--glow:${GLOW['--ice']}">${ic('brain')}</div><div class="grow"><b>Second Brain</b><small>${n?n+(n>1?' folders':' folder')+' added':'Your WorkOS and project folders'}</small></div>${n?suOk:`<button class="btn sm line" type="button" data-su="open" data-id="brain">${open?'Cancel':'Choose folder'}</button>`}</div>${open&&!n?`<div class="su-form su-pick"><div class="su-path">${B&&B.parent?`<button type="button" class="round" data-su="browse" data-path="${esc(B.parent)}" aria-label="Up one folder">${ic('upa')}</button>`:''}<b title="${esc(B?B.path:'')}"><bdi>${esc(B?B.path:'Opening your folders')}</bdi></b></div><div class="su-dirs">${B?(B.folders.length?B.folders.map(d=>`<button type="button" data-su="browse" data-path="${esc(d.path)}">${ic('folder')}${esc(d.name)}</button>`).join(''):'<small>There are no folders inside this one.</small>'):''}</div><div class="su-ff"><small${SU.err.brain?' class="bad"':''}>${esc(SU.err.brain||'Open your WorkOS folder, then press Use this folder. Each folder inside it becomes a project. Nothing in it is changed.')}</small><button class="btn sm" type="button" data-su="usebrain"${B&&SU.busy!=='brain'?'':' disabled'}>${SU.busy==='brain'?'Reading':'Use this folder'}</button></div></div>`:''}`}

const SU_VIEW={
  intro:()=>`<div class="eyebrow"><b>Welcome</b> &nbsp;·&nbsp; Takes about two minutes</div><h1 class="title">Your business,<br><em>on one calm page.</em></h1><p class="lede">Your tools, your numbers and your AI in one place, on your own computer.</p><ul class="reads"><li><i>${TICK}</i>It ranks the five things that need you most today</li><li><i>${TICK}</i>Your AI answers from your own numbers, on the plan you already pay for</li><li><i>${TICK}</i>Your data stays on this computer. Tools are read, never changed</li></ul><div class="scan-row"><button class="btn lg" type="button" data-su="start">Get started${ic('arrow')}</button></div>`,
  signin:()=>`${suEy(1,'Sign in')}<h1 class="title">Sign in <em>to begin.</em></h1><p class="lede">Use the Google account you run your business with. It gives the dashboard your name, and connects your Google tools in the next step.</p><div class="scan-row"><button class="btn lg su-g" type="button" data-su="google"${SU.busy==='google'?' disabled':''}>${GOOGLE_G}Continue with Google</button><button class="btn line" type="button" data-su="go" data-to="connect">Continue without Google</button></div>${SU.problem?`<p class="su-err" role="alert">${esc(SU.problem)}</p>`:''}<p class="su-fine">Google shows “Google hasn’t verified this app” once. Click Advanced, then Go to AI-Dashboard.</p>`,
  connect:()=>{const n=TOOLS.filter(t=>(suConn(t[0])||{}).status==='connected').length+((SU.brain||[]).length?1:0),fr=BOOT.firstRun||{};
    return `${suEy(2,SU.conns?n+' of '+(TOOLS.length+1)+' connected':'Your tools')}<h1 class="title">Connect <em>your tools.</em></h1><p class="lede">${fr.email?'Signed in as '+esc(fr.email)+'. ':''}Press Connect on each one you use. Each is read only, and you can add more later.</p>${SU.problem?`<p class="su-err" role="alert">${esc(SU.problem)}</p>`:''}${SU.conns?`<div class="airows su-tools">${TOOLS.map(suTool).join('')}${suBrain()}</div>`:'<div class="scan-msg"><span class="live"><i></i></span><span>Looking up your tools</span></div>'}<div class="scan-row"><button class="btn lg" type="button" data-su="go" data-to="ai">Continue</button><button class="btn line" type="button" data-su="go" data-to="signin">Back</button></div>`},
  profile:()=>{const fr=BOOT.firstRun||{},f=SU.form;
    return `${suEy(4,'Profile')}<h1 class="title">Tell us <em>about you.</em></h1><p class="lede">This is how the dashboard greets you and names your work.</p><form id="suProf"><div class="su-two"><label class="fld"><span>Your name</span><input name="name" autocomplete="given-name" maxlength="40" value="${esc(f.name!=null?f.name:fr.name||'')}"></label><label class="fld"><span>Your role</span><input name="role" maxlength="40" placeholder="Founder" value="${esc(f.role||'')}"></label></div><label class="fld"><span>Business name</span><input name="business" autocomplete="organization" maxlength="60" placeholder="Your company" value="${esc(f.business||'')}"></label><div class="su-sites" id="suSites"></div><p class="su-err" id="suPErr" role="alert" hidden></p><div class="scan-row"><button class="btn lg" type="submit">Continue</button><button class="btn line" type="button" data-su="go" data-to="ai">Back</button></div></form>`},
  welcome:()=>{const first=String(BOOT.workspace.owner||'').trim().split(/\s+/)[0];
    return `${suEy(5,'You are all set')}<h1 class="title">Welcome${first&&first!=='You'?`, <em>${esc(first)}.</em>`:'.'}</h1><p class="lede" id="suWl">Your numbers are coming in for the first time. This takes about a minute, and your dashboard opens by itself when it is ready.</p><div class="scan-bar"><i id="suBar"></i></div><div class="airows" id="suLoad"></div><div class="scan-row"><button class="btn lg" type="button" data-su="finish" id="suOpen" hidden>Open your dashboard${ic('arrow')}</button></div>`}};

function suSites(){const el=$('#suSites');if(!el)return;const s=BOOT.sites||[];
  el.innerHTML=`<div class="eyebrow">Your websites &nbsp;·&nbsp; found in Google Analytics</div>${s.length?`<div class="chips">${s.map(x=>`<span class="chip"><span class="dot ok"></span>${esc(x.name)}</span>`).join('')}</div>`:'<small>Connect Google Analytics and your websites appear here by themselves.</small>'}`;
  suRadar(s.slice(0,7).map((x,i)=>({label:x.name,ini:String(x.name||'?').trim().slice(0,2).toUpperCase(),c:['--ice','--violet','--gold','--mint','--ember'][i%5],on:true})),!s.length,'done')}
function suWelcome(){const el=$('#suLoad');if(!el)return;const tools=(SU.conns||[]).filter(c=>c.status==='connected'||c.status==='error');
  const rows=tools.map(c=>{const t=TOOLS.find(x=>x[0]===c.id)||[c.id,String(c.name).slice(0,2).toUpperCase(),'--gold'];return {ini:t[1],c:t[2],name:c.name,state:c.status==='error'?'bad':c.lastSync?'done':'run',sub:c.status==='error'?'Needs attention. Fix it later on Connections.':c.lastSync?c.detail:'Bringing in your data'}});
  if(SU.brain&&SU.brain.length)rows.push({icon:'brain',c:'--ice',name:'Second Brain',state:'done',sub:(SU.projects||0)+(SU.projects===1?' project mapped':' projects mapped')});
  if(SU.ai)rows.push({icon:'spark',c:'--gold',name:'Your AI',state:'done',sub:SU.ai.available?SU.ai.provider+' is ready for questions':'Scan for AI any time from Connections'});
  const ready=rows.filter(r=>r.state!=='run').length,gone=Date.now()-SU.t0,done=!!SU.conns&&(ready===rows.length||gone>60000)&&gone>2500;
  el.innerHTML=rows.length?rows.map(r=>`<div class="airow su-row" style="animation:none"><div class="sphere${r.icon?'':' mono'}" style="--glow:${GLOW[r.c]}">${r.icon?ic(r.icon):r.ini}</div><div class="grow"><b>${esc(r.name)}</b><small>${esc(r.sub||'')}</small></div>${r.state==='done'?`<span class="ok">${TICK}</span>`:r.state==='bad'?'<span class="su-bang">!</span>':'<span class="su-spin"></span>'}</div>`).join(''):(SU.conns?'<p class="su-fine" style="margin-top:6px">No tools are connected yet. You can add them any time from Connections.</p>':'');
  const live=(SU.conns||[]).filter(c=>c.status==='connected');$$('#suR .rnode').forEach((n,i)=>n.classList.toggle('on',done||!!(live[i]&&live[i].lastSync)));$$('#suR line').forEach((n,i)=>n.classList.toggle('on',!!(live[i]&&live[i].lastSync)));
  $('#suBar').style.width=(done?100:rows.length?Math.max(12,Math.round(ready/rows.length*100)):30)+'%';
  if(done){$('#suWl').textContent='Your dashboard is ready. Opening it now.';$('#suOpen').hidden=false;$('#suP').dataset.state='done';if(!SU.fin)SU.fin=setTimeout(suFinish,1600)}}
async function suFinish(){if(SU.leaving)return;SU.leaving=true;try{await post('firstrun/finish')}catch(e){}location.href='/'}

function suRender(){const P=$('#suP');if(!P)return;clearInterval(SU.poll);SU.poll=0;suSteps();const s=SU.step;P.dataset.step=s;
  if(s==='ai'){if(SU.drawn!=='ai'){scanState=scanState==='scanning'?'idle':scanState;scanSet(scanState)}SU.drawn=s;return}
  $('#suL').innerHTML=(SU_VIEW[s]||SU_VIEW.intro)();
  if(s==='intro'||s==='signin')suRadar(s==='signin'?suToolNodes().map(n=>Object.assign(n,{on:false})):[],s==='intro');
  if(s==='connect'){suRadar(suToolNodes());if(!SU.conns)suLoadTools().then(()=>{if(SU.step==='connect')suRender()}).catch(e=>toast(e.message))}
  if(s==='profile'){suSites();SU.poll=setInterval(()=>getJSON('bootstrap').then(b=>{if(!b.firstRun)return;const was=JSON.stringify(BOOT.sites||[]);BOOT=b;if(JSON.stringify(b.sites||[])!==was)suSites()}).catch(()=>{}),4000)}
  if(s==='welcome'){if(SU.drawn!=='welcome'){SU.t0=Date.now();post('sync').catch(()=>{});getJSON('ai/status').then(r=>{SU.ai=r;suWelcome()}).catch(()=>{})}
    const tick=()=>suLoadTools().then(()=>{if(SU.step!=='welcome')return;if(!SU.wr){SU.wr=true;suRadar((SU.conns||[]).filter(c=>c.status==='connected').map(c=>{const t=TOOLS.find(x=>x[0]===c.id)||[c.id,'··','--gold'];return {label:c.name,ini:t[1],c:t[2],on:false}}),false,'scanning')}suWelcome()}).catch(()=>{});
    SU.wr=false;suRadar([],false,'scanning');tick();SU.poll=setInterval(tick,1500)}
  SU.drawn=s;if(SU.focus){const f=$(SU.focus);if(f)f.focus();SU.focus=''}}
/* The server keeps the step, so a sign-in that leaves for Google comes back to the right place. */
const suBoot=()=>getJSON('bootstrap').then(b=>{if(!b.firstRun){location.href='/';return}BOOT=b;SU.step=b.firstRun.step||'intro';suRender();scrollTo(0,0)});
const suGo=to=>{SU.open='';SU.err={};SU.problem='';return post('firstrun/step',{step:to}).catch(e=>toast(e.message)).then(suBoot)};
async function suAct(a,t){
  if(a==='start'){t.disabled=true;try{await post('firstrun/start');await suBoot()}catch(e){t.disabled=false;toast(e.message)}}
  if(a==='go')suGo(t.dataset.to);
  if(a==='finish')suFinish();
  if(a==='google'){SU.busy='google';SU.problem='';t.disabled=true;try{const r=await post('firstrun/google');if(r.redirect){location.href=r.redirect;return}SU.problem=r.needs||'Google sign-in is not available.'}catch(e){SU.problem=e.message}SU.busy='';suRender()}
  if(a==='gconn'){const id=t.dataset.id;SU.busy=id;SU.err={};t.disabled=true;try{const r=await post('connections/'+id,{action:'connect'});if(r&&r.redirect){location.href=r.redirect;return}if(r&&r.needs)SU.err[id]=r.needs;else await suLoadTools()}catch(e){SU.err[id]=e.message}SU.busy='';suRender()}
  if(a==='open'){const id=t.dataset.id;SU.open=SU.open===id?'':id;SU.err={};suRender();if(SU.open==='brain'&&!SU.browse)suAct('browse',{dataset:{path:''}});else if(SU.open){const f=$('.su-form input');if(f)f.focus()}}
  if(a==='browse'){try{SU.browse=await getJSON('brain?workspaceId='+encodeURIComponent(suWs())+'&action=browse&path='+encodeURIComponent(t.dataset.path||''));delete SU.err.brain}catch(e){SU.err.brain=e.message}if(SU.step==='connect')suRender()}
  if(a==='usebrain'){if(!SU.browse)return;SU.busy='brain';suRender();try{await post('brain',{workspaceId:suWs(),action:'connect',path:SU.browse.path,kind:'workos'});SU.open='';await suLoadTools();toast('Second Brain connected')}catch(e){SU.err.brain=e.message}SU.busy='';suRender()}}
if(SETUP){
  try{const p=new URLSearchParams(location.search).get('problem');if(p){SU.problem=p;history.replaceState(null,'',location.pathname)}}catch(e){}
  $('#p-setup').addEventListener('click',e=>{const t=e.target.closest('[data-su]');if(t&&!t.disabled)suAct(t.dataset.su,t)});
  $('#p-setup').addEventListener('input',e=>{const t=e.target,f=t.closest('.su-form');if(f&&t.name)SU.form[f.dataset.id+'.'+t.name]=t.value;else if(t.closest('#suProf')&&t.name)SU.form[t.name]=t.value});
  $('#p-setup').addEventListener('submit',async e=>{e.preventDefault();const f=e.target;
    if(f.id==='suProf'){const d=new FormData(f),body={name:String(d.get('name')||''),role:String(d.get('role')||''),business:String(d.get('business')||'')},er=$('#suPErr'),b=f.querySelector('[type=submit]');b.disabled=true;
      try{await post('firstrun/profile',body);await suBoot()}catch(x){er.textContent=x.message;er.hidden=false;b.disabled=false}return}
    const id=f.dataset.id;if(!id)return;SU.busy=id;SU.err={};suRender();
    try{const r=await post('connections/'+id,{action:'connect',token:SU.form[id+'.token']||'',userId:SU.form[id+'.user']||''});if(r&&r.needs)SU.err[id]=r.needs;else{SU.open='';delete SU.form[id+'.token'];await suLoadTools();toast((suConn(id)||{}).name+' connected')}}catch(x){SU.err[id]=x.message}
    SU.busy='';suRender()})}
if(SETUP)suRender();else scanSet('idle');
