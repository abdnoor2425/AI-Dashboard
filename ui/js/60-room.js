/* dr ===================== Decision Room ===================== */
Object.assign(IC,{
 room:'<circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="3.4" r="1.5"/><circle cx="19.4" cy="7.7" r="1.5"/><circle cx="19.4" cy="16.3" r="1.5"/><circle cx="12" cy="20.6" r="1.5"/><circle cx="4.6" cy="16.3" r="1.5"/><circle cx="4.6" cy="7.7" r="1.5"/>',
 clip:'<path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8"/>',
 folder:'<path d="M3 7.5A2.5 2.5 0 015.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0121 9.7v7.8a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
 doc:'<path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 pause:'<path d="M8 5v14M16 5v14"/>', skip:'<path d="M5 5l9 7-9 7zM18 5v14"/>',
 swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
 shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
 down:'<path d="M12 4v12M6.5 11l5.5 5.5 5.5-5.5M5 20h14"/>', back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
 gavel:'<path d="M13.5 4.5l6 6M10 8l6 6M11.8 6.2l-6.3 6.3M17.8 12.2l-6.3 6.3"/><path d="M4 20h9"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'});

/* Everything below is drawn from a real session on this computer. RM is the room's front page, DS the decision that is open. */
const DGLOW={'--gold':'rgba(235,197,124,.5)','--ice':'rgba(138,212,255,.5)','--mint':'rgba(95,224,176,.46)','--violet':'rgba(185,162,255,.5)','--ember':'rgba(255,154,107,.5)','--bad':'rgba(255,122,122,.45)','--warn':'rgba(244,184,96,.5)','--text-3':'rgba(160,165,180,.4)'};
/* source key: name, colour, icon, which access switch it needs */
const DSRC={stripe:['Stripe','--gold','money','num'],ga:['Google Analytics','--ice','web','num'],linear:['Linear','--mint','team','num'],goals:['Goals','--violet','goals','num'],needs:['Needs you','--ember','needs','num'],clients:['Clients','--mint','team','num'],
 file:['WorkOS file','--ember','folder','files'],mail:['Gmail, subjects only','--bad','mail','mail'],made:['AI made','--violet','made','made'],att:['Attached by you','--warn','clip','att'],past:['Past decision','--text-3','room','num']};
const DPASS=['First look. No AI used.','The council asked for more.','One last pass.'];
const DSTEPS=[['ask','Ask'],['brief','Brief'],['board','Board'],['evidence','Evidence'],['live','The Room'],['verdict','Verdict']];
const DMODE={auto:['Let the Chair choose','The Chair reads your question first, then picks Quick or Full.'],quick:['Quick','4 seats, 2 rounds. About 12 AI calls, 2 to 4 minutes.'],full:['Full','7 seats, 3 rounds. About 23 AI calls, 4 to 10 minutes.']};
const DAIC={'Claude Code':'--gold',Codex:'--mint','Gemini CLI':'--ice',Grok:'--violet'};
const DBAND={go:['Go,','as planned.','ok','7.5 and above means go.'],cond:['Go,','with conditions.','gold','6.0 to 7.4 means go, with conditions.'],reshape:['Reshape it','first.','','4.5 to 5.9 means reshape the idea first.'],no:['Don\'t','do it.','hot','Below 4.5 means don\'t do it.'],wait:['Wait,','for now.','','The council scored changing nothing highest.']};
const DNUM=['No','One','Two','Three','Four','Five','Six','Seven','Eight'];

let RM=null,DS=null,DEV=[],DOPT=[];
const DR={step:'ask',q:'',mode:'auto',ai:null,swap:-1,seats:[],bench:[],timers:[],speed:1,paused:false,i:0,live:[],fed:0,tm:null,poll:null,busy:false,said:[],voted:[],fold:[],fold0:null,foldFor:'ask'};
const dRoster=()=>(DS&&DS.roster)||(RM&&RM.roster)||[];
const dRole=k=>dRoster().find(r=>r.key===k)||{key:k,ini:'··',role:'A seat',q:'',why:'',person:'',slug:'',col:'--text-3'};
/* a seat as the screens read it: key, initials, role, question, why it sits, weight, colour, modelled on, round 1 scores, final scores, portrait, sat out */
const dSeatRow=(k,x)=>{const r=dRole(k);return [k,r.ini,r.role,r.q,(x&&x.why)||r.why,x?x.weight:2,r.col,r.person,DS&&DS.r1[k]?DS.r1[k].scores:null,DS&&DS.r3[k]?DS.r3[k].scores:null,r.slug,!!(DS&&DS.out.includes(k))]};
function dBind(){if(!DS)return;DEV=DS.pack.map(f=>[f.id,DSRC[f.src]?f.src:'past',f.what,f.value,f.period,f.age,f.link,f.note,f.pass,f.path||'',f.on,f.words||0,f.ref||'',f.folder||'']);
 DOPT=DS.brief?DS.brief.options.map((o,i)=>['ABC'[i],o.title,o.detail]):[];DR.seats=DS.seats.map(x=>dSeatRow(x.key,x));DR.bench=DS.bench.map(k=>dSeatRow(k))}
const dSeat=k=>DR.seats.find(s=>s[0]===k)||dSeatRow(k),dShort=s=>s[2].replace(/^The | seat$/g,'');
const dSitting=()=>DR.seats.filter(s=>!s[11]);
const dEv=id=>DEV.find(e=>e[0]===id);
const dOn=e=>!!e[10];
const dW=()=>dSitting().reduce((s,x)=>s+x[5],0);
/* The kit ships no portraits or real-person names: seats always show their initials. */
const dFaces=()=>false;
const dSph=(s,cls)=>{const face=dFaces()&&s[10];return `<span class="sphere mono ${face?'face ':''}${cls||''}" style="--glow:${DGLOW[s[6]]};--c:var(${s[6]})${face?`;--img:url(/portraits/${s[10]}-base.webp)`:''}"${face?` data-face="${s[10]}"`:''}>${s[1]}</span>`};
const dCite=(id,lab)=>{const e=dEv(id);if(!e)return esc(lab||'');const v=esc(lab||e[3]);return dOn(e)?`<button type="button" class="cite" data-ev="${id}" style="--c:var(${DSRC[e[1]][1]})" title="${esc(e[2])}"><b>${v}</b><i>${id.slice(1)}</i></button>`:`<span class="cite off" title="Not read. That source was switched off."><b>${v}</b><i>assumed</i></span>`};
const dTx=s=>esc(s||'').replace(/\{(E\d+)\}/g,(m,id)=>dCite(id));
const dPlain=s=>String(s||'').replace(/\{(E\d+)\}/g,(m,id)=>{const e=dEv(id);return e?e[3]:''});
const dUsed=id=>{const u=new Set(),tag='{'+id+'}';if(DS){Object.values(DS.r1).forEach(r=>{if(r.say.includes(tag))u.add(r.key)});DS.r2.forEach(r=>{if(r.say.includes(tag))u.add(r.from)})}return [...u]};
const dOffN=()=>DEV.filter(e=>!dOn(e)).length;
const dTog=(k,on,label)=>`<input class="tg" type="checkbox" data-acc="${k}" ${on?'checked':''} aria-label="${label}">`;
const dAcc=()=>DS?DS.access:(RM?RM.access:{num:true,files:false,folders:[],made:true,mail:true});
const dAi=()=>DS?DS.ai:(DR.ai||(RM&&RM.ai)||'');
const dHref=(step,id)=>'#room/'+step+(id||(DS&&step!=='ask'&&step!=='history')?'/'+(id||DS.id):'');
const dPlural=(n,w)=>n+' '+w+(n===1?'':'s');

function dSteps(){const ci=DSTEPS.findIndex(s=>s[0]===DR.step);
 return `<div class="dr-top"><nav class="dr-steps" aria-label="Decision steps">${DSTEPS.map((s,i)=>`<a href="${i<=ci||(DS&&DS.status==='done')?dHref(s[0]):'#'}" ${i>ci&&!(DS&&DS.status==='done')?'aria-disabled="true" tabindex="-1" data-no':''} class="${i<ci?'done':i===ci?'cur':''}"><i>${i<ci?'✓':i+1}</i><b>${s[1]}</b></a>${i<5?'<hr>':''}`).join('')}</nav><span class="grow"></span><span class="chip dr-run"><i style="background:var(--mint)"></i>Runs on ${esc(dAi())}, your own plan</span></div>`}
const dFoot=(back,next,label,extra,act)=>`<div class="dr-foot">${back?`<a class="btn line" href="${dHref(back)}">${ic('back')}Back</a>`:''}<span class="grow">${extra||''}</span>${act?`<button type="button" class="btn lg" data-dr="${act}">${label}${ic('arrow')}</button>`:`<a class="btn lg" href="${dHref(next)}">${label}${ic('arrow')}</a>`}</div>`;
/* one calm card for every moment the council is not ready: what happened, and one button */
const dCard=(icn,g,ey,t,d,btn,act,vis)=>`<div class="panel edge dr-state dr-one rv"><span class="sphere" style="--glow:${g}">${ic(icn)}</span><div class="eyebrow"><b>${ey}</b></div><b class="dr-big">${t}</b><p>${d}</p>${vis||''}${btn?(act[0]==='#'?`<a class="btn sm" href="${act}">${btn}</a>`:`<button class="btn sm" type="button" data-dr="${act}">${btn}</button>`):''}</div>`;
function dGate(){if(!DS)return '';const c=DS.calls,pr=c.total?`<i class="dr-prog"><b style="width:${Math.min(100,Math.round(c.done/c.total*100))}%"></b></i>`:'';
 if(DS.status==='failed')return dCard('needs',DGLOW['--bad'],'It stopped','The council could not finish this step.',esc(DS.error||'Your AI did not answer.')+' Nothing is lost.','Try again','resume',pr);
 if(DS.status==='resting')return dCard('pause',DGLOW['--warn'],c.total?`Paused at step ${c.done} of ${c.total}`:'Paused','Your AI plan needs a short rest.',`Nothing is lost. The council carries on by itself at ${esc(DS.restAt||'the next try')}, from the same step.`,'Try now','resume',pr);
 if(DS.status==='stopped')return dCard('back',DGLOW['--mint'],'You closed the app','Pick up where it stopped.','Everything so far was saved. Carry on from there.','Carry on','resume',pr);
 return ''}

/* ---------- 1. Ask ---------- */
function dAccess(){const A=dAcc(),F=(RM&&RM.folders)||[],n=A.folders.filter(id=>F.some(f=>f.id===id)).length,fOn=A.files&&n>0;
 const row=(icn,g,t,d,ctl,cls)=>`<div class="dr-acc ${cls||''}"><span class="sphere" style="--glow:${g}">${ic(icn)}</span><span class="grow"><b>${t}</b><small>${d}</small></span>${ctl}</div>`;
 return `<div class="panel dr-access" id="drAccess"><div class="dr-ah"><div class="grow"><div class="eyebrow"><b>You decide what it sees</b></div><h2 class="h3">What the council may look at.</h2></div><span class="tag ok">${ic('shield')}Stays on this computer</span></div>
 <div class="dr-accg"><div>
  ${row('money',DGLOW['--gold'],'Your numbers','Analytics, Stripe, Linear, Goals and Clients. Totals and trends.',dTog('num',A.num,'Your numbers'))}
  ${row('folder',DGLOW['--ember'],'Inside your WorkOS files',!F.length?'No folder is connected yet. Connect your WorkOS in Second Brain first.':fOn?`${n} of ${F.length} folders are on. The text in those folders can be read.`:'Off. The council sees file names only, until you choose folders.',!F.length?`<a class="btn sm line" href="#brain/edit">Connect a folder</a>`:fOn?`<button class="btn sm line" type="button" data-dr="folders">Change folders</button>${dTog('files',true,'Inside your WorkOS files')}`:`<button class="btn sm" type="button" data-dr="folders">${ic('folder')}Give access</button>`,fOn?'':'need')}
  ${row('made',DGLOW['--violet'],'Things your AIs made','Titles, dates and links from the last 14 days.',dTog('made',A.made,'Things your AIs made'))}
  ${row('mail',DGLOW['--bad'],'Mail subjects','Subjects and senders only. Never the message itself.',dTog('mail',A.mail,'Mail subjects'))}
  ${row('clip',DGLOW['--warn'],'A file you attach','Read for this one decision only. Good when you would rather not open your WorkOS.','<span class="tag">This decision only</span>')}
 </div><div class="dr-limits"><div class="eyebrow">The limits, upfront</div><b>The council can never</b><ul><li>${ic('x')}Read the body of an email</li><li>${ic('x')}Read inside Google Drive files</li><li>${ic('x')}Change, send or delete anything</li><li>${ic('x')}Look in a folder you left off</li><li>${ic('x')}Send your data anywhere but your own AI</li></ul><p>Switch anything on or off at any time. Each verdict lists exactly what was shared.</p></div></div></div>`}
function dAsk(){if(!RM)return `<div class="dr-ask"><div class="dr-askL"><div class="eyebrow"><b>Your AI</b></div><h1 class="title">Decision <em>Room.</em></h1><p class="lede">Opening the room.</p></div></div>`;
 const m=DMODE[DR.mode],ai=dAi(),any=RM.ais.some(a=>a.found),at=RM.attach||[],o=RM.open,ck=RM.checkin;
 return `${o?`<div class="start dr-warn"><div class="grow"><div class="eyebrow"><b>Not finished</b></div><b>${esc(o.q)}</b></div><a class="btn sm" href="${dHref(o.status==='done'?'verdict':['brief','board','evidence','live'].includes(o.step)?o.step:'brief',o.id)}">Carry on</a><button class="btn sm line" type="button" data-dr="drop" data-id="${o.id}">Remove it</button></div>`:''}${ck?dCheck(ck):''}
 <div class="dr-ask"><div class="dr-askL rv">
  <div class="eyebrow"><b>Your AI</b> &nbsp;·&nbsp; One hard decision at a time</div>
  <h1 class="title">Decision <em>Room.</em></h1>
  <p class="lede">Ask one hard question. A board of advisors argues it with your real numbers, and hands back a verdict anyone can follow.</p>
  <div class="panel edge dr-comp">
   <label class="eyebrow" for="drQ">Your question</label>
   <textarea id="drQ" rows="2" spellcheck="false" placeholder="Should I ...?">${esc(DR.q)}</textarea>
   <div class="dr-att">${at.map(a=>`<span class="dr-file"><i>${ic('doc')}</i><span><b>${esc(a.name)}</b><small>${a.pages?dPlural(a.pages,'page'):a.words.toLocaleString('en-US')+' words'} · read for this decision only</small></span><button type="button" class="round" data-dr="unattach" data-id="${a.id}" aria-label="Remove the file">✕</button></span>`).join('')}<button class="btn sm line" type="button" data-dr="attach">${ic('clip')}${at.length?'Attach another file':'Attach a file'}</button><span class="dr-hint">PDF, Word, text or a spreadsheet</span></div>
   <div class="dr-row"><div><div class="eyebrow">How deep</div><div class="seg" role="group" aria-label="How deep">${Object.keys(DMODE).map(k=>`<button type="button" data-mode="${k}" aria-pressed="${DR.mode===k}">${DMODE[k][0]}</button>`).join('')}</div></div>
    <div><div class="eyebrow">Which AI runs it</div><div class="dr-ais">${RM.ais.map(a=>`<button type="button" class="chip${ai===a.name?' pick':''}${a.found?'':' off'}" data-ai="${esc(a.name)}" aria-pressed="${ai===a.name}" ${a.found?'':'title="Not found on this computer"'}><i style="background:var(${a.found?DAIC[a.name]||'--gold':'--text-3'})"></i>${esc(a.name)}</button>`).join('')}</div></div></div>
   <div class="dr-go">${any?`<p><b>${m[1]}</b><br>Uses your ${esc(ai)} plan. No key, no extra bill, nothing to type in a terminal.</p><button type="button" class="btn lg" data-dr="start">Start the council${ic('arrow')}</button>`:`<p><b>Connect an AI first.</b><br>The council runs on your own AI. One click finds the ones on this computer and connects them.</p><a class="btn lg" href="#scan">Scan for AI${ic('arrow')}</a>`}</div>
  </div></div>
  <div class="dr-askR" aria-hidden="true">${dTableMini()}</div></div>
 ${dAccess()}
 ${RM.sugg.length?`<div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">From Needs you</div><h2 class="h3">Decisions that are waiting.</h2></div></div>
 <div class="dr-sug">${RM.sugg.map((s,i)=>`<button type="button" class="tile tilt" data-sug="${i}"><span class="eyebrow"><i style="background:var(${({Linear:'--mint','Google Analytics':'--ice',Stripe:'--gold',Gmail:'--ember'})[s.src]||'--violet'})"></i>${esc(s.src)}</span><b>${esc(s.q)}</b><small>${esc(s.note)}</small><em>Ask this ${ic('arrow')}</em></button>`).join('')}</div>`:''}
 <div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">History</div><h2 class="h3">Past decisions.</h2></div>${RM.hist.length?`<a class="btn sm line" href="#room/history">See all ${RM.hist.length}</a>`:''}</div>
 ${RM.hist.length?`<div class="panel dr-hist mini">${RM.hist.slice(0,3).map(dHistRow).join('')}</div>`:`<div class="panel dr-hist mini dr-none"><b>No decisions yet.</b><small>Ask your first question. A Full council needs a few minutes.</small></div>`}`}
function dTableMini(){const S=dRoster().slice(0,7).map(r=>dSeatRow(r.key)),n=S.length||1;return `<div class="dr-mini"><i class="dr-disc d2"></i><i class="dr-disc edge"></i>${orbw()}${S.map((s,i)=>{const a=-Math.PI/2+i/n*Math.PI*2,x=50+Math.cos(a)*41,y=52+Math.sin(a)*30,k=.78+.3*(Math.sin(a)+1)/2;return `<span class="dr-ms" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--k:${k.toFixed(2)};--d:${(i*.5).toFixed(1)}s;z-index:${Math.round(y)}">${dSph(s)}</span>`}).join('')}</div>`}
const dHistRow=h=>`<a class="dr-hrow" href="${dHref(h.status==='done'?'verdict':h.step||'brief',h.id)}"><span class="dr-hd num">${h.date}</span><span class="grow"><b>${esc(h.q)}</b><small>${esc(h.note)}</small></span><span class="tag ${h.tag}">${esc(h.label||'In progress')}</span><span class="dr-hs num">${h.score||'·'}</span><span class="dr-hm">${h.depth}</span></a>`;
const dCheck=ck=>`<div class="panel edge dr-fu rv"><span class="sphere" style="--glow:${DGLOW['--gold']}">${ic('clock')}</span><div class="grow"><div class="eyebrow"><b>Time to look again</b> &nbsp;·&nbsp; Decided ${esc(ck.decided)}</div><b class="dr-big">${esc(ck.q)}</b><small>The council said: ${esc(ck.label.toLowerCase())}. ${esc(ck.text)}</small></div><div class="dr-fb">${[['worked','It worked'],['partly','Partly'],['no','It did not']].map((b,i)=>`<button class="btn sm${i?' line':''}" type="button" data-dr="checkin" data-id="${ck.id}" data-r="${b[0]}">${b[1]}</button>`).join('')}</div></div>`;

/* ---------- 2. Brief ---------- */
function dBrief(){const B=DS.brief;
 if(!B)return `${dSteps()}${dGate()||`<div class="panel edge dr-state dr-one dr-wait"><div class="dr-ch">${orbw()}<div><div class="eyebrow"><b>The Chair</b></div><b class="dr-big">Reading your question.</b></div></div><p>"${esc(DS.q)}"</p><p>The Chair looks at your numbers first, then writes the brief and the options. This takes about a minute.</p><i class="dr-prog busy"><b></b></i></div>`}`;
 const files=DEV.filter(e=>e[1]==='file'),off=files.filter(e=>!dOn(e)),Q=B.questions,full=DS.mode!=='quick';
 return `${dSteps()}<div class="dr-two"><div class="panel dr-brief rv">
  <div class="eyebrow"><b>The brief</b> &nbsp;·&nbsp; Written by the Chair</div>
  <h2 class="h2">${esc(B.title)}</h2>
  <div class="dr-stake"><span class="eyebrow">What is at stake</span><p>${dTx(B.stake)}</p></div>
  <div class="eyebrow dr-el">The options on the table</div>
  <div class="dr-opts">${DOPT.map(o=>`<div class="dr-opt"><i>${o[0]}</i><b>${esc(o[1])}</b><small>${esc(o[2])}</small></div>`).join('')}</div>
  <div class="eyebrow dr-el">What we already know</div>
  <div class="dr-know">${DEV.filter(e=>e[8]===0&&dOn(e)).map(e=>{const s=DSRC[e[1]];return `<button type="button" class="drow" data-ev="${e[0]}"><i class="dr-dot" style="background:var(${s[1]})"></i><span class="grow"><b>${esc(e[2])}</b><small>${s[0]} · ${esc(e[4])}</small></span><span class="dval num">${esc(e[3])}</span></button>`}).join('')||'<p class="dr-fine">Nothing is connected or switched on yet, so the council will reason from your question alone. Connect a tool or switch on "Your numbers" to give it facts.</p>'}</div>
 </div>
 <div class="dr-side">
  <div class="panel dr-chair rv"><div class="dr-ch">${orbw()}<div><div class="eyebrow"><b>The Chair suggests</b></div><b class="dr-big">A ${B.depth==='quick'?'Quick':'Full'} council.</b></div></div><p>${esc(B.depthWhy||(B.depth==='quick'?'This is easy to undo, so four seats are enough.':'This is worth the wait of seven seats and three rounds.'))}</p><div class="seg" role="group" aria-label="How deep"><button type="button" data-smode="full" aria-pressed="${full}">Full · about 6 min</button><button type="button" data-smode="quick" aria-pressed="${!full}">Quick · about 3 min</button></div></div>
  ${Q.length?`<div class="panel dr-qa rv"><div class="eyebrow"><b>${DNUM[Q.length]} question${Q.length>1?'s':''} only you can answer</b></div>${Q.map((q,i)=>`<div class="dr-q"><b>${esc(q.q)}</b><div>${q.choices.map((a,j)=>`<button type="button" class="chip${B.answers[i]===j?' pick':''}" data-ans="${i},${j}" aria-pressed="${B.answers[i]===j}">${esc(a)}</button>`).join('')}</div></div>`).join('')}<small class="dr-fine">The Chair asks at most two. Everything else comes from your data.</small></div>`:''}
  ${!files.length?'':!off.length?`<div class="panel dr-ok rv"><span class="sphere" style="--glow:${DGLOW['--mint']}">${ic('check')}</span><div class="grow"><b>The council may read ${dPlural(files.length,'file')} the Chair asked for.</b><small>You allowed it. Change it at any time.</small></div><button class="btn sm line" type="button" data-dr="folders">Change</button></div>`:
  `<div class="panel edge dr-askf rv"><div class="eyebrow"><b>The Chair asks for access</b></div><b class="dr-big">${DNUM[off.length]} file${off.length>1?'s':''} would help.</b><p>${off.length>1?'They sit':'It sits'} in a folder that is switched off, so the council has not read ${off.length>1?'them':'it'}.</p><div class="dr-fl">${off.map(e=>`<span>${ic('doc')}<span><b>${esc(e[2])}</b><small>${esc(e[9])}</small></span></span>`).join('')}</div><div class="dr-fb"><button class="btn sm" type="button" data-dr="allow">Allow ${off.length>1?'these '+off.length+' files':'this file'}</button><button class="btn sm line" type="button" data-dr="folders">Choose folders</button><button class="btn sm line" type="button" data-toast="The council goes on without ${off.length>1?'them':'it'} and marks those points as assumed">Skip</button></div><small class="dr-fine">Only the text of ${off.length>1?'these files':'this file'} is read. Short excerpts go to your own AI.</small></div>`}
 </div></div>${dFoot('ask','board','Looks right. Pick the board','<span class="dr-hint">Nothing has gone to an advisor yet. Change the depth or your answers first if anything looks off.</span>')}`}

/* ---------- 3. Board ---------- */
function dBoard(){const n=DR.seats.length;return `${dSteps()}<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>The board</b> &nbsp;·&nbsp; Picked by the Chair for ${esc(DS.kindLabel||'this decision')}</div><h2 class="h2">${DNUM[n]} seats for this question.</h2><p class="mut dr-sub">Each seat looks at your decision through one question. A heavier seat counts for more in the vote.</p></div></div>
 <div class="dr-seats">${DR.seats.map((s,i)=>`<div class="panel tilt dr-seat${DR.swap===i?' swapping':''}" style="--c:var(${s[6]});--d:${i*70}ms"><div class="dr-st">${dSph(s)}<span class="dr-w" title="Weight ${s[5]} of 3">${[1,2,3].map(w=>`<i class="${w<=s[5]?'on':''}"></i>`).join('')}</span></div><b>${s[2]}</b><em>${esc(s[3])}</em>${dFaces()?`<small class="dr-mod">Modelled on the public work of ${esc(s[7])}. An AI simulation.</small>`:''}<p>${esc(s[4])}</p><button type="button" class="btn sm line" data-swap="${i}">${ic('swap')}${DR.swap===i?'Cancel':'Swap'}</button></div>`).join('')}<div class="dr-how"><div class="eyebrow"><b>How the vote is counted</b></div><ol><li>Each seat scores every option out of 10.</li><li>A heavier seat counts for more.</li><li>Code adds it up. The AI never does the sum.</li></ol><span class="dr-eq num">score = sum of weight × vote, divided by ${dW()}</span></div></div>
 <div class="panel dr-bench${DR.swap>-1?' pick':''}"><div class="eyebrow">${DR.swap>-1?`<b>Pick a seat to replace ${DR.seats[DR.swap][2]}</b>`:'On the bench. Swap any of them in.'}</div><div class="dr-bl">${DR.bench.map((s,i)=>`<button type="button" class="dr-bs" data-bench="${i}">${dSph(s)}<span><b>${s[2]}</b><small>${esc(s[3])}${dFaces()?' · '+esc(s[7]):''}</small></span></button>`).join('')}</div></div>
 ${dFoot('brief','evidence','Seat the board','<span class="dr-hint">Total weight '+dW()+'. Scores are worked out by code, never by the AI.</span>')}`}

/* ---------- 4. Evidence ---------- */
function dEvRow(e,i){const s=DSRC[e[1]],on=dOn(e);return `<button type="button" class="dr-ev${on?'':' off'}" ${on?`data-ev="${e[0]}"`:'disabled'} style="--c:var(${s[1]});--i:${i}"><span class="dr-id num">${e[0]}</span><i class="dr-dot"></i><span class="grow"><b>${esc(e[2])}</b><small>${on?s[0]+(e[4]?' · '+esc(e[4]):''):'Not read. '+(e[1]==='file'?(e[7]||'That folder is switched off.'):'That source is switched off.')}</small></span><span class="dval num">${on?esc(e[3]):'·'}</span><span class="dr-age">${on?esc(e[5]):''}</span></button>`}
function dEvidence(){const list=DEV,srcN={},n=dSitting().length;list.filter(dOn).forEach(e=>srcN[e[1]]=(srcN[e[1]]||0)+1);const gaps=DS.gaps||[];
 return `${dSteps()}${dGate()}<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>Evidence</b> &nbsp;·&nbsp; Gathered once, shared by all ${DNUM[n].toLowerCase()} seats</div><h2 class="h2" id="drEvT">Gathering <em>the facts.</em></h2></div><div class="dr-pass" id="drPass">${DPASS.map((p,i)=>`<span data-p="${i}"><i>${i+1}</i>${p}</span>`).join('')}</div></div>
 <div class="dr-two ev"><div class="panel dr-evl" id="drEvL">${[0,1,2].map(p=>list.some(e=>e[8]===p)?`<div class="dr-evg" data-p="${p}"><div class="eyebrow">${DPASS[p]}</div>${list.map((e,i)=>e[8]===p?dEvRow(e,i):'').join('')}</div>`:'').join('')||'<p class="dr-fine" style="padding:26px">No facts were found or switched on. The council will reason from your question alone, and the verdict will say so.</p>'}</div>
 <div class="dr-side"><div class="panel dr-packp"><div class="dr-pack" id="drPack">${list.map((e,i)=>`<i class="${dOn(e)?'':'off'}" style="--i:${i};--c:var(${DSRC[e[1]][1]})"></i>`).join('')}</div><div class="dr-pn"><b class="num" id="drEvN">0</b><span>facts in the pack</span></div><div class="dr-leg">${Object.keys(srcN).map(k=>`<span class="chip"><i style="background:var(${DSRC[k][1]})"></i>${DSRC[k][0]}<em>${srcN[k]}</em></span>`).join('')}</div></div>
  <div class="panel dr-gaps"><div class="eyebrow"><b>What the council could not see</b></div><ul>${gaps.map(g=>`<li>${ic('eye')}${esc(g)}</li>`).join('')||`<li>${ic('check')}Nothing it asked for was missing.</li>`}</ul><small class="dr-fine">These gaps are printed in the verdict and in the PDF.</small></div></div></div>
 ${dFoot('board','live','Open the room','<button type="button" class="btn sm line" data-dr="shared">'+ic('shield')+'What is shared with your AI</button>',DS.startedAt?'':'run')}`}
const dEvReady=()=>DS&&!['brief','gathering','briefing'].includes(DS.status);
function dEvEnd(){$$('#drPass span').forEach(s=>{s.classList.remove('cur');s.classList.add('done')});const t=$('#drEvT');if(!t)return;if(dEvReady()){t.innerHTML='The facts <em>are in.</em>';$('.dr-foot .btn.lg').classList.add('ready')}else t.innerHTML='Reading <em>what you allowed.</em>'}
function dEvRun(fast){const rows=$$('#drEvL .dr-ev'),plates=$$('#drPack i');let on=0;const order=[0,1,2].flatMap(p=>rows.filter(r=>r.closest('.dr-evg').dataset.p==p));
 const show=k=>{const r=order[k];r.classList.add('in');const g=r.closest('.dr-evg');g.classList.add('in');$$('#drPass span').forEach(s=>s.classList.toggle('cur',s.dataset.p===g.dataset.p));$$('#drPass span').forEach(s=>s.classList.toggle('done',s.dataset.p<g.dataset.p));
  if(!r.classList.contains('off')){on++;$('#drEvN').textContent=on}const pl=plates[DEV.findIndex(e=>e[0]===r.querySelector('.dr-id').textContent)];if(pl)pl.classList.add('in')};
 if(fast||reduce||!order.length){order.forEach((r,k)=>show(k));dEvEnd();return}
 order.forEach((r,k)=>DR.timers.push(setTimeout(()=>{show(k);if(k===order.length-1)DR.timers.push(setTimeout(dEvEnd,500))},500+k*430+(+r.closest('.dr-evg').dataset.p)*700)))}

/* ---------- 5. The Room ---------- */
const DPOS=n=>DR.seats.map((s,i)=>{const a=-Math.PI/2+(i+.5)/n*Math.PI*2;return [50+Math.cos(a)*40,50+Math.sin(a)*33,.8+.28*(Math.sin(a)+1)/2]});
function dLive(){const n=DR.seats.length,P=DPOS(n),quick=DS.mode==='quick';DR.pos=P;
 const rounds=quick?[[0,'Round 1 · Opening views'],[1,'The resolution'],[3,'Round 2 · The vote']]:[[0,'Round 1 · Opening views'],[1,'The real disagreements'],[2,'Round 2 · Debate'],[3,'Round 3 · The vote']];
 return `${dSteps()}<div id="drGate">${dGate()}</div><div class="panel dr-room dk" id="drRoom" data-phase="r1">
  <div class="dr-rh"><div class="dr-rounds">${rounds.map(r=>`<span data-r="${r[0]}"><i></i>${r[1]}</span>`).join('')}</div><span class="grow"></span><div class="seg dr-ctl"><button type="button" data-dr="pause" id="drPause" aria-label="Pause">${ic('pause')}</button><button type="button" data-dr="speed" id="drSpeed">${DR.speed}×</button><button type="button" data-dr="skip">${ic('skip')}Skip to the verdict</button></div></div>
  <div class="dr-rg"><div class="dr-stage" id="drStage">
    <i class="dr-disc d2"></i><i class="dr-disc edge"></i><i class="dr-pool"></i>
    <svg class="dr-lines" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" id="drLines"><path id="drBeam" class="dr-beam"/></svg>
    <div class="dr-chairw">${orbw()}<span class="dr-cl">The Chair</span></div>
    ${DR.seats.map((s,i)=>`<div class="dr-rs${s[11]?' out':''}" data-s="${s[0]}" style="left:${P[i][0].toFixed(1)}%;top:${P[i][1].toFixed(1)}%;--k:${P[i][2].toFixed(2)};--c:var(${s[6]});z-index:${Math.round(P[i][1])}"><span class="dr-bub"></span>${dSph(s)}<span class="dr-nm">${dShort(s)}</span><b class="dr-vote num"></b></div>`).join('')}
    <div class="dr-stamp" id="drStamp"></div>
   </div>
   <aside class="dr-feedw"><div class="eyebrow dr-fh"><b>What is being said</b><span id="drCalls" class="num"></span></div><div class="dr-feed" id="drFeed" aria-live="polite"></div></aside></div>
  <div class="dr-bars" id="drBars">${DOPT.map((o,i)=>`<div class="dr-bar" data-o="${i}"><span class="dr-bl2"><i>${o[0]}</i>${esc(o[1])}</span><span class="dr-track"><i class="t1"></i><i class="t2"></i><i class="t3"></i><b></b></span><span class="dr-bv num">·</span></div>`).join('')}<div class="dr-bkey"><span class="k"><em style="left:22.5%">Don't do it</em><em style="left:52.5%">Reshape</em><em style="left:67.5%">Conditions</em><em style="left:87.5%">Go</em></span></div></div>
 </div>`}
function dSay(who,tag,html,extra,cls){const f=$('#drFeed');if(!f)return;const s=who==='chair'||who==='data'?null:dSeat(who);
 const head=who==='chair'?`<span class="sphere dr-chs">${ic('gavel')}</span><b>The Chair</b>`:who==='data'?`<span class="sphere" style="--glow:${DGLOW['--mint']}">${ic('check')}</span><b>Answered from your data</b>`:`${dSph(s)}<b>${s[2]}</b>`;
 f.insertAdjacentHTML('beforeend',`<div class="dr-say ${cls||''}" ${s?`style="--c:var(${s[6]})"`:''}><div class="dr-sayh">${head}${tag?`<span class="tag">${tag}</span>`:''}</div><p>${html}</p>${extra||''}</div>`);f.scrollTop=f.scrollHeight}
/* the bars: a seat counts with its final vote once it has voted, with its opening score before that */
function dBars(){const S=dSitting().filter(s=>DR.said.includes(s[0])||DR.voted.includes(s[0])),bs=$$('#drBars .dr-bar');if(!S.length)return;const w=S.reduce((a,x)=>a+x[5],0);
 const vals=bs.map((b,o)=>{const v=S.reduce((a,x)=>a+x[5]*(DR.voted.includes(x[0])?x[9]:x[8])[o],0)/w;b.querySelector('b').style.width=(v*10)+'%';b.querySelector('.dr-bv').textContent=v.toFixed(1);return +v.toFixed(1)}),mx=Math.max(...vals);
 bs.forEach((b,i)=>b.classList.toggle('lead',vals[i]===mx&&mx>0))}
function dPhase(i){const r=$('#drRoom');if(!r)return;r.dataset.phase=['r1','crux','r2','r3','end'][i];$$('.dr-rounds span').forEach(s=>{s.classList.toggle('cur',+s.dataset.r===i);s.classList.toggle('done',+s.dataset.r<i)})}
/* a seat that speaks moves its mouth: the three talking frames of its portrait are swapped in while it has the floor */
function dTalk(el){clearInterval(DR.talk);if(!el||reduce)return;const sp=el.querySelector('.sphere.face');if(!sp)return;const k=sp.dataset.face,fr=['mid','open','mid','base','open','base'];let n=0;
 DR.talk=setInterval(()=>{if(!sp.isConnected||!el.classList.contains('speaking')||n>26){clearInterval(DR.talk);sp.style.setProperty('--img',`url(/portraits/${k}-base.webp)`);return}if(!DR.paused)sp.style.setProperty('--img',`url(/portraits/${k}-${fr[n++%fr.length]}.webp)`)},150)}
function dSpeak(k,bub){const cw=$('.dr-chairw');if(cw)cw.classList.toggle('speaking',k==='chair');let me=null;$$('.dr-rs').forEach(r=>{const on=r.dataset.s===k;r.classList.toggle('speaking',on);if(on){me=r;r.classList.remove('thinking');r.classList.add('spoke');if(bub!=null)r.querySelector('.dr-bub').textContent=bub}});dTalk(me);
 const i=DR.seats.findIndex(s=>s[0]===k),P=DR.pos,beam=$('#drBeam');if(beam&&i>-1){beam.setAttribute('d',`M${P[i][0]*10} ${P[i][1]*7} L500 ${41*7}`);beam.style.stroke=`var(${DR.seats[i][6]})`;beam.classList.remove('on');void beam.getBoundingClientRect();beam.classList.add('on')}}
const dCalls=()=>{const c=$('#drCalls');if(c&&DS)c.textContent=DS.status==='done'?DS.calls.done+' AI calls':DS.calls.done+' of '+DS.calls.total+' AI calls'};
/* which seats are still thinking, so a real wait never looks frozen */
function dThink(){if(!DS||DS.status!=='running'||DR.i<DR.live.length){return}const ph=($('#drRoom')||{dataset:{}}).dataset.phase;$$('.dr-rs').forEach(r=>{const k=r.dataset.s,wait=!DS.out.includes(k)&&((ph==='r1'&&!DS.r1[k])||(ph==='r3'&&!DS.r3[k]));r.classList.toggle('thinking',wait&&!r.classList.contains('speaking'))});
 const cw=$('.dr-chairw');if(cw)cw.classList.toggle('speaking',(ph==='r1'&&dSitting().every(s=>DS.r1[s[0]]))||ph==='crux'||(ph==='r3'&&dSitting().every(s=>DS.r3[s[0]])))}
/* every event the council saved becomes one step on the stage */
function dStepOf(ev){const idx=k=>DR.seats.findIndex(s=>s[0]===k),P=DR.pos,sc=a=>`<div class="dr-sc">${DOPT.map((o,j)=>`<span><i>${o[0]}</i>${a[j]}</span>`).join('')}`;
 if(ev.t==='open')return [700,()=>{dPhase(0);const n=dSitting().length;dSay('chair','Brief',`${DNUM[n]} seats, three options. Every seat has the same ${DEV.filter(dOn).length} facts. Opening views first. Nobody sees another seat's answer yet.`)}];
 if(ev.t==='r1')return [2500,()=>{const r=DS.r1[ev.k];if(!r)return;dPhase(0);dSpeak(ev.k,r.stance);dSay(ev.k,'Round 1',dTx(r.say),sc(r.scores)+`<em>${esc(r.stance)}</em></div>`);DR.said.push(ev.k);dBars()}];
 if(ev.t==='out')return [1600,()=>{const el=$(`.dr-rs[data-s="${ev.k}"]`);if(el){el.classList.add('out');el.classList.remove('thinking')}dSay('chair','One seat sat out',`${dSeat(ev.k)[2]} did not answer twice. It sits this one out. The score is worked out from the seats that answered, and the report says so.`,'','chair')}];
 if(ev.t==='crux')return [2600,()=>{dPhase(1);dSpeak('chair');const L=$('#drLines'),C=DS.cruxes||[];C.forEach((c,j)=>{const a=idx(c.a),b=idx(c.b);if(a<0||b<0)return;const x1=P[a][0]*10,y1=P[a][1]*7,x2=P[b][0]*10,y2=P[b][1]*7,mx=(x1+x2)/2+(j?60:-60),my=(y1+y2)/2-90;L.insertAdjacentHTML('beforeend',`<path class="dr-crux" data-c="${j}" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`)});
   dSay('chair',C.length?DNUM[C.length]+' real disagreement'+(C.length>1?'s':''):'No real disagreement',C.length?`<ol class="dr-cx">${C.map(c=>`<li><b>${esc(c.q)}</b><small>${dSeat(c.a)[2]} and ${dSeat(c.b)[2]}</small></li>`).join('')}</ol>`:'The seats already agree on the direction. The council goes straight to a resolution.','','chair')}];
 if(ev.t==='data')return [2600,()=>{const a=DS.answer;if(a)dSay('data','No AI call needed',`${dSeat(a.seat)[2]} asked a question your data already answers. ${dTx(a.say)}`,'','data')}];
 if(ev.t==='r2')return [2800,()=>{const r=DS.r2[ev.i];if(!r)return;dPhase(2);dSpeak(r.from,'To '+dShort(dSeat(r.to)));$$('.dr-crux').forEach(p=>p.classList.toggle('hot',+p.dataset.c===r.crux));dSay(r.from,'Round 2 · to '+dSeat(r.to)[2],dTx(r.say))}];
 if(ev.t==='draft')return [2800,()=>{if(DS.mode==='quick')dPhase(1);dSpeak('chair');$$('.dr-crux').forEach(p=>{p.classList.remove('hot');p.classList.add('settled')});dSay('chair','Draft resolution',dTx(DS.draft.text),'','chair')}];
 if(ev.t==='vote')return [DR.voted.length||DR.live.some(x=>x.vote)?1000:2200,()=>{const v=DS.r3[ev.k];if(!v)return;dPhase(3);$$('.dr-rs').forEach(r=>r.classList.remove('speaking'));const el=$(`.dr-rs[data-s="${ev.k}"]`),lead=DS.draft.lead;el.classList.add('voted');el.classList.remove('thinking');el.querySelector('.dr-vote').textContent=v.scores[lead];el.querySelector('.dr-bub').textContent='';
   const row=DR.seats.find(s=>s[0]===ev.k);if(row)row[9]=v.scores;DR.voted.push(ev.k);dSay(ev.k,'Vote · '+v.scores[lead]+' of 10',dTx(v.line),'','vote');dBars()}];
 if(ev.t==='end')return [1500,()=>{dPhase(4);dBars();const R=DS.result,c=DS.checks||{},b=DBAND[R.band];$$('.dr-rs').forEach(r=>r.classList.remove('thinking','speaking'));const cw=$('.dr-chairw');if(cw)cw.classList.remove('speaking');
   dSay('chair','Checked by code',`Scores worked out from the ${DNUM[R.voted].toLowerCase()} votes. ${dPlural(c.cites||0,'source code')} in what was said ${c.cites===1?'was':'were'} matched to the evidence.${c.dropped?' '+c.dropped+' that pointed at nothing '+(c.dropped===1?'was':'were')+' removed.':''}${R.caps.length?' '+esc(R.caps.join(' ')):''}`,'','chair');
   $('#drStamp').innerHTML=`<span class="eyebrow">The verdict</span><b>${b[0]} <em>${b[1]}</em></b><span class="num dr-sn">${R.score.toFixed(1)} <small>of 10</small></span><a class="btn lg" href="${dHref('verdict')}">Read the verdict${ic('arrow')}</a>`;$('#drStamp').classList.add('on')}];
 return [0,()=>{}]}
function dLiveFeed(){if(!DS)return;while(DR.fed<DS.events.length){const ev=DS.events[DR.fed++],st=dStepOf(ev);st.vote=ev.t==='vote';DR.live.push(st)}dCalls()}
function dPlay(){if(DR.paused||DR.tm||DR.step!=='live')return;if(DR.i>=DR.live.length){dThink();return}const st=DR.live[DR.i];DR.tm=setTimeout(()=>{DR.tm=null;if(DR.step!=='live'||DR.paused)return;st[1]();DR.i++;dPlay()},st[0]/DR.speed);DR.timers.push(DR.tm)}
function dFlush(){clearTimeout(DR.tm);DR.tm=null;const r=$('#drRoom');if(r)r.classList.add('fast');while(DR.i<DR.live.length){DR.live[DR.i][1]();DR.i++}$$('.dr-rs').forEach(x=>x.classList.remove('speaking'));dThink()}
function dLiveRun(fast){DR.live=[];DR.i=0;DR.fed=0;DR.said=[];DR.voted=[];DR.paused=DS.status==='paused';DR.tm=null;DR.seats.forEach(s=>s[9]=null);dLiveFeed();
 if(DS.status==='paused'){const p=$('#drPause');p.innerHTML=ic('skip');p.setAttribute('aria-label','Play');$('#drRoom').classList.add('paused')}
 /* a finished council is replayed at reading pace; one that is still running is caught up at once, then followed live */
 if(fast||reduce||DS.status!=='done'){dFlush();if(DS.status==='running')setTimeout(()=>{const r=$('#drRoom');if(r)r.classList.remove('fast')},60)}else dPlay()}
function dSkip(){dStop(true);dFlush();if(DS&&DS.status!=='done')toast('The council is still talking. This is everything so far.')}

/* ---------- 6. Verdict ---------- */
function dDial(v){const R=86,C=2*Math.PI*R,arc=.75,len=C*arc,f=len*v/10;const tick=x=>{const a=(135+270*x/10)*Math.PI/180;return `<line x1="${110+Math.cos(a)*74}" y1="${110+Math.sin(a)*74}" x2="${110+Math.cos(a)*98}" y2="${110+Math.sin(a)*98}"/>`};
 return `<div class="dr-dial"><svg viewBox="0 0 220 220" aria-hidden="true"><defs><linearGradient id="drG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="var(--ember)"/><stop offset=".55" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--mint)"/></linearGradient></defs><circle cx="110" cy="110" r="${R}" class="bg" stroke-dasharray="${len} ${C}" transform="rotate(135 110 110)"/><circle cx="110" cy="110" r="${R}" class="fg" stroke="url(#drG)" stroke-dasharray="${f} ${C}" style="--len:${f};--c:${C}" transform="rotate(135 110 110)"/><g class="tk">${tick(4.5)}${tick(6)}${tick(7.5)}</g></svg><div><b class="num">${v.toFixed(1)}</b><span>of 10</span></div></div>`}
function dSources(){const rows=DEV.map(e=>({e,u:dUsed(e[0]),on:dOn(e)})).sort((a,b)=>b.on-a.on),dec=DS.verdict.decisive||[];
 return `<div class="tbl dr-src"><table><thead><tr><th>Id</th><th>What it is</th><th>Where from</th><th>Covers</th><th>How fresh</th><th>Used by</th><th></th></tr></thead><tbody>${rows.map(r=>{const e=r.e,s=DSRC[e[1]];return `<tr class="${r.on?'':'off'}"><td class="num dr-id">${e[0]}</td><td><b>${esc(e[2])}</b>${r.on&&dec.includes(e[0])?'<span class="tag gold">Decisive</span>':''}${e[9]?`<small>${esc(e[9])}</small>`:''}</td><td><span class="dr-from"><i style="background:var(${s[1]})"></i>${s[0]}</span></td><td class="mut">${esc(e[4])}</td><td class="mut">${r.on?(e[5]==='Live'?'<span class="dr-livd">Live</span>':e[5]==='Just now'?'Just now':esc(e[5])+' old'):'Not read'}</td><td><span class="dr-ub">${r.u.map(k=>dSph(dSeat(k))).join('')||'<small class="mut">Background</small>'}</span></td><td class="r">${r.on?`<button type="button" class="btn sm line" data-ev="${e[0]}">Open</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`}
function dVerdict(){const V=DS.verdict,R=DS.result,B=DBAND[R.band],off=dOffN(),sc=R.scores,S=dSitting(),mn=dSeat(V.minority.seat),gaps=DS.gaps||[];
 return `${dSteps()}
 ${off?`<div class="start dr-warn"><div class="grow"><div class="eyebrow"><b>Worked with less</b></div><b>The council ran without ${dPlural(off,'source')} you switched off. Points that leaned on them are marked "assumed".</b></div><button class="btn sm" type="button" data-dr="again">Ask again with more access</button></div>`:''}
 <div class="panel edge dr-vh rv"><div class="dr-vl"><div class="eyebrow"><b>The verdict</b> &nbsp;·&nbsp; ${esc(DS.date)} &nbsp;·&nbsp; Asked by ${esc(DS.owner)}</div><p class="dr-vq">"${esc(DS.q)}"</p><h1 class="title">${B[0]} <em>${B[1]}</em></h1><p class="dr-call">${dTx(V.call)}</p>
   <div class="dr-meta"><span class="chip">${ic('room')}${DS.mode==='quick'?'Quick':'Full'} council · ${S.length} seats</span><span class="chip">${ic('clock')}${DS.minutes?dPlural(DS.minutes,'minute')+' · ':''}${DS.calls.done} AI calls</span><span class="chip"><i style="background:var(--mint)"></i>Confidence: ${R.confWord} · ${R.agree} of ${R.voted} agree</span><span class="chip"><i style="background:var(${DAIC[DS.ai]||'--gold'})"></i>${esc(DS.ai)}</span></div></div>
  <div class="dr-vr">${dDial(R.score)}<div class="dr-vbars">${DOPT.map((o,i)=>`<div class="dr-bar${i===R.rec?' lead':''}"><span class="dr-bl2"><i>${o[0]}</i>${esc(o[1])}</span><span class="dr-track"><i class="t1"></i><i class="t2"></i><i class="t3"></i><b style="width:${sc[i]*10}%"></b></span><span class="dr-bv num">${sc[i].toFixed(1)}</span></div>`).join('')}<small class="dr-fine">Worked out by code from ${DNUM[R.voted].toLowerCase()} weighted votes. ${B[3]}${R.caps.length?' '+esc(R.caps.join(' ')):''}</small></div></div></div>
 ${V.why.length?`<div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">Why</div><h2 class="h3">${DNUM[V.why.length]} reason${V.why.length>1?'s':''}.</h2></div><span class="dr-hint">Tap any number to see where it came from.</span></div>
 <div class="dr-why">${V.why.map((w,i)=>`<div class="panel tilt rv"><span class="dr-n num">0${i+1}</span><b>${esc(w.head)}</b><p>${dTx(w.text)}</p></div>`).join('')}</div>`:''}
 ${V.money?`<div class="panel dr-money rv"><span class="sphere" style="--glow:${DGLOW['--gold']}">${ic('money')}</span><p>${dTx(V.money)}</p></div>`:''}
 <div class="dr-two v"><div class="panel dr-next rv"><div class="dr-ph"><div class="grow"><div class="eyebrow"><b>What happens next</b></div><h3 class="h3">${DNUM[V.next.length]} step${V.next.length===1?'':'s'}.</h3></div><button type="button" class="btn sm${DS.tasks?' line':''}" data-dr="tasks" ${DS.tasks?'disabled':''}>${DS.tasks?'Added to Needs you':'Turn into tasks'}</button></div>
   ${V.next.map(n=>`<label class="dr-step"><input type="checkbox"><i></i><span class="grow"><b>${esc(n.step)}</b><small>${esc(n.owner)} · by ${esc(n.by)}</small></span><span class="sphere mono">${esc(n.owner.slice(0,1))}</span></label>`).join('')}</div>
  <div class="panel dr-cond rv"><div class="eyebrow"><b>Conditions</b></div><ul class="ok">${V.conditions.map(c=>`<li>${ic('check')}${dTx(c)}</li>`).join('')||`<li>${ic('check')}None were set.</li>`}</ul>
   ${V.stops.length?`<div class="eyebrow"><b class="bad">Stop and think again if</b></div><ul class="stop">${V.stops.map(x=>`<li>${ic('needs')}${esc(x.text)}${x.fact?' Today '+dCite(x.fact):''}</li>`).join('')}</ul>`:''}
   <div class="dr-again">${ic('clock')}<span><b>Look again on ${esc(DS.againDate)}.</b><small>${esc(V.again.text)} The dashboard will ask you then whether this worked.</small></span></div></div></div>
 <div class="dr-two v"><div class="panel dr-minor rv"><div class="eyebrow"><b>The minority view</b></div><div class="dr-mq">${dSph(mn)}<blockquote>"${esc(V.minority.quote)}"<cite>${mn[2]} · voted ${V.minority.score} of 10</cite></blockquote></div>${V.change.length?`<div class="eyebrow dr-el">What would change this verdict</div><ul class="dr-chg">${V.change.map(c=>`<li>${dTx(c)}</li>`).join('')}</ul>`:''}<small class="dr-fine">Every verdict keeps the strongest argument against it.</small></div>
  <div class="panel dr-votes rv"><div class="eyebrow"><b>How each seat voted</b></div><div class="dr-vt">${S.map(s=>{const f=DS.r3[s[0]].scores;return `<div>${dSph(s)}<span class="grow"><b>${dShort(s)}</b><small>Weight ${s[5]}</small></span>${f.map((x,j)=>`<span class="dr-vc${j===R.rec?' b':''}"><i>${DOPT[j][0]}</i>${x}</span>`).join('')}</div>`}).join('')}</div>${DS.out.length?`<small class="dr-fine">${DS.out.map(k=>dRole(k).role).join(' and ')} did not answer and sat out.</small>`:''}</div></div>
 <div class="sec-head dr-sh" id="drSrcH"><div class="grow"><div class="eyebrow">Sources</div><h2 class="h3">What the decision stands on.</h2></div><button type="button" class="btn sm line" data-dr="shared">${ic('shield')}What was shared with your AI</button></div>
 <div class="panel dr-srcp rv">${DEV.length?dSources():'<p class="dr-fine" style="padding:22px">No facts were shared with the council for this decision.</p>'}<div class="dr-gl"><div class="eyebrow">What the council could not see</div><ul>${gaps.map(g=>`<li>${ic('eye')}${esc(g)}</li>`).join('')||`<li>${ic('check')}Nothing it asked for was missing.</li>`}</ul></div></div>
 <div class="panel edge dr-pdf rv"><div class="dr-pages" data-dr="report" role="button" tabindex="0" aria-label="Read the report"><i class="p2"></i><i class="p1"></i><i class="p0"><span class="dr-cov"><u>The question</u><b>${esc(DS.brief.title)}</b><span><em>The verdict</em>${B[0]} ${B[1]}</span></span></i></div><div class="grow"><div class="eyebrow"><b>The report</b> &nbsp;·&nbsp; PDF · 8 pages</div><h3 class="h2">Written so a new employee can follow it.</h3><p class="mut">What was decided, why, what happens next, who does it and when to stop. Every number points to its source.</p><div class="dr-pb"><button type="button" class="btn" data-dr="report">${ic('doc')}Read it here</button><button type="button" class="btn line" data-dr="pdf">${ic('down')}Download PDF</button><button type="button" class="btn line" data-dr="folder">${ic('folder')}Open folder</button><button type="button" class="btn line" data-dr="send">${ic('mail')}Send</button></div></div></div>
 <div class="dr-foot"><a class="btn line" href="#room/history">${ic('back')}All decisions</a><span class="grow"></span><a class="btn line" href="${dHref('live')}">Watch the room again</a><a class="btn" href="#room/ask" data-dr="new">Ask something new${ic('arrow')}</a></div>`}

/* ---------- 7. History ---------- */
function dHistory(){if(!RM)return '';const st=RM.stats,H=RM.hist;
 return `<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>Decision Room</b> &nbsp;·&nbsp; History</div><h1 class="title">Every decision, <em>kept.</em></h1><p class="lede">Each one keeps its verdict, its sources and its PDF. On the date it set, the dashboard asks if it worked.</p></div><a class="btn" href="#room/ask">Ask something new${ic('arrow')}</a></div>
 ${RM.checkin?dCheck(RM.checkin):''}
 <div class="dr-hstats">${[[st.year,'decision'+(st.year===1?'':'s')+' this year'],[st.checked?st.worked+' of '+st.checked:'None yet',st.checked?'checked ones worked out':'checked. The dashboard asks on each look-again date.'],['$0','extra AI cost. Your plan covered it.']].map(s=>`<div class="tile"><b class="num">${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div>
 ${H.length?`<div class="panel dr-hist rv">${H.map(dHistRow).join('')}</div>`:dCard('spark',DGLOW['--violet'],'First visit','No decisions yet.','Ask your first question. A Full council needs a few minutes.','Ask a question','#room/ask')}`}

/* ---------- sheets, routing, clicks ---------- */
function dEvCard(id){const e=dEv(id);if(!e)return;const s=DSRC[e[1]],u=dUsed(id).map(k=>dSeat(k)[2]);
 showCard({small:true,icon:s[2],glow:DGLOW[s[1]],ey:`<b>Evidence ${id}</b> &nbsp;·&nbsp; ${s[0]}`,title:e[2],big:esc(e[3]),bigNote:esc(e[4]),lede:e[7],rows:[['Used by',u.length?u.join(', '):'Background for the whole council'],['How fresh',e[5]==='Live'?'Read live when the council started':e[5]==='Just now'?'Attached for this decision':'Last changed '+e[5]+' ago'],...(e[11]?[['How much was read',e[11].toLocaleString('en-US')+' words went to your AI']]:[]),...(e[9]?[['Where it lives',e[9]]]:[])],src:[[s[0],s[1],e[9]||'Read-only',e[5]==='Live'?'Live':'']],acts:e[1]==='file'&&e[12]?[['Show the file','dr:file:'+e[12]]]:e[6]?[['Open the source',e[6]]]:[],srcOpen:true})}
function dShared(){const on=DEV.filter(dOn),by={},sh=DS.shared||{};on.forEach(e=>by[e[1]]=(by[e[1]]||0)+1);
 showCard({icon:'shield',glow:DGLOW['--mint'],ey:'<b>What was shared</b> &nbsp;·&nbsp; This decision',title:'Sent to your own AI, and nowhere else.',lede:`Everything below ${DS.startedAt?'went':'goes'} to ${DS.ai} on your own plan, for this one decision.`,rows:[[dPlural(on.length,'fact')+' from the evidence pack','Numbers and short lines, each with its id'],...(sh.excerpts?[[dPlural(sh.excerpts,'file excerpt'),(sh.words||0).toLocaleString('en-US')+' words in total, from folders you switched on']]:[]),...(DS.attach.length?[[dPlural(DS.attach.length,'attached file'),DS.attach.map(a=>a.name).join(', ')]]:[]),['0 mail bodies','Subjects only, as always'],['0 passwords or keys',sh.skipped?dPlural(sh.skipped,'file')+' could not be read and '+(sh.skipped===1?'was':'were')+' skipped':'Files that look like secrets are never offered to the council']],src:Object.keys(by).map(k=>[DSRC[k][0],DSRC[k][1],dPlural(by[k],'fact'),'Live']),acts:[['Open the full log','dr:folder']],srcOpen:true})}
function dFolders(){if(!RM)return;const A=dAcc();DR.foldFor=DS&&DR.step!=='ask'?'session':'ask';DR.fold=RM.folders.map(f=>A.folders.includes(f.id));$('#drFoldI').innerHTML=ic('folder');
 const want=DS?[...new Set(DEV.filter(e=>e[1]==='file').map(e=>(RM.folders.find(f=>f.id===e[13])||{}).name).filter(Boolean))]:[];const sg=$('#drFoldSug');sg.hidden=!want.length;sg.textContent=want.length?'Suggested for this question: '+want.join(' and ')+'.':'';
 $('#drFoldRows').innerHTML=RM.folders.map((f,i)=>`<label class="crow"><span class="sphere" style="--glow:${DGLOW[['--ember','--gold','--ice','--mint','--violet'][i%5]]}">${ic('folder')}</span><span class="grow"><b>${esc(f.name)}</b><small>${dPlural(f.files,'file')}${f.warn?' · can hold private notes':''}</small></span><input class="tg" type="checkbox" data-fold="${i}" ${DR.fold[i]?'checked':''} aria-label="Read inside ${esc(f.name)}"></label>`).join('')||'<p class="cb-lede">No folder is connected yet. Connect your WorkOS in Second Brain first.</p>';$('#drFold').hidden=false}
function dReport(){if(!DS)return;$('#drRepT').textContent=DS.brief.title;$('#drRepP').innerHTML=`<iframe title="The decision report" src="/api/room/${DS.id}/report"></iframe>`;$('#drRep').hidden=false}
async function dPdf(){if(!DS)return;toast('Making the PDF. This takes a few seconds.');try{const r=await fetch('/api/room/'+DS.id+'/pdf');if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'The PDF could not be made.')}const b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='Decision report - '+((DS.report&&DS.report.short)||'decision')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Saved to your Downloads folder')}catch(e){toast(e.message)}}
function dStop(keepPoll){DR.timers.forEach(clearTimeout);DR.timers=[];DR.tm=null;clearInterval(DR.talk);if(!keepPoll){clearTimeout(DR.poll);DR.poll=null}}
function dRender(fast){dStop(true);const s=DR.step,el=$('#dr');if(!el)return;
 el.dataset.step=s;el.innerHTML=({ask:dAsk,brief:dBrief,board:dBoard,evidence:dEvidence,live:dLive,verdict:dVerdict,history:dHistory}[s]||dAsk)();orbs();
 if(s==='evidence'&&DS.brief)dEvRun(fast);if(s==='live')dLiveRun(fast);onScroll();dPollSet()}
/* keeps the open decision in step with the council while it works */
function dPollSet(){clearTimeout(DR.poll);DR.poll=null;if(DS&&!$('#p-room').hidden&&['briefing','gathering','running','resting'].includes(DS.status)&&DR.step!=='ask'&&DR.step!=='history')DR.poll=setTimeout(dTick,DR.step==='live'?1800:2400)}
async function dTick(){if(!DS)return;const id=DS.id,was=DS.status;const s=await getJSON('room/'+id).catch(()=>null);if(!DS||DS.id!==id)return;if(s){DS=s;dBind();
  if(DR.step==='live'){dLiveFeed();if(s.status!==was)$('#drGate').innerHTML=dGate();dPlay();dThink()}
  else if(s.status!==was||(DR.step==='brief'&&!was))dRender(true)}dPollSet()}
async function dOpen(id){if(DS&&DS.id===id)return DS;DS=await getJSON('room/'+id);dBind();return DS}
const dHome=()=>getJSON('room').then(r=>{RM=r;if(!DR.ai||!r.ais.some(a=>a.found&&a.name===DR.ai))DR.ai=r.ai;return r});
async function dRoute(step,id){const ses=['brief','board','evidence','live','verdict'];DR.swap=-1;
 if(!ses.includes(step)){DR.step=step==='history'?'history':'ask';$('#crumb').textContent=DR.step==='history'?'Decision Room / History':'Decision Room';if(RM)dRender();else $('#dr').innerHTML=dAsk();
  try{await dHome()}catch(e){toast(e.message);return}if(!$('#p-room').hidden&&(DR.step==='ask'||DR.step==='history')){const q=$('#drQ'),typing=q&&document.activeElement===q;if(!typing)dRender(true)}return}
 try{if(!id&&!DS){location.hash='#room/ask';return}await dOpen(id||DS.id);if(!RM)dHome().catch(()=>{})}catch(e){toast(e.message);location.hash='#room/ask';return}
 /* a screen is only shown once the council has what that screen needs */
 if(!DS.brief)step='brief';else if(step==='verdict'&&!DS.verdict)step=DS.startedAt?'live':'brief';else if(step==='live'&&!DS.startedAt)step='evidence';
 DR.step=step;$('#crumb').textContent='Decision Room / '+DSTEPS.find(x=>x[0]===step)[1];dRender();
 if(step==='evidence'&&DS.status==='brief'){try{DS=await post('room/'+DS.id+'/gather');dBind();dPollSet()}catch(e){toast(e.message)}}}
const dEdit=async(body,fast)=>{try{DS=await post('room/'+DS.id+'/edit',body);dBind();dRender(fast!==false)}catch(e){toast(e.message)}};
function dAttach(){const inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.docx,.xlsx,.txt,.md,.csv,.tsv,.json,.html,.rtf';inp.onchange=()=>{const f=inp.files[0];if(!f)return;if(f.size>12*1024*1024){toast('That file is larger than 12 MB. Attach a smaller one.');return}toast('Reading '+f.name);
  const rd=new FileReader();rd.onload=()=>post('room/attach',{name:f.name,data:String(rd.result).split(',')[1]||''}).then(()=>dHome()).then(()=>{dRender(true);toast('Attached. It is read for this decision only.')}).catch(e=>toast(e.message));rd.readAsDataURL(f)};inp.click()}
async function dStart(){const q=(DR.q||'').trim();if(q.length<12){toast('Write your question in a full sentence first.');const t=$('#drQ');if(t)t.focus();return}if(DR.busy)return;DR.busy=true;
 try{const r=await post('room/start',{q,mode:DR.mode,ai:dAi()});DS=null;DR.q='';await dOpen(r.id);if(RM)RM.attach=[];location.hash=dHref('brief',r.id)}catch(e){toast(e.message)}DR.busy=false}
$('#p-room').addEventListener('click',e=>{const q=s=>e.target.closest(s);let t;
 if(q('[data-no]')){e.preventDefault();return}
 if(t=q('[data-ev]')){dEvCard(t.dataset.ev);return}
 if(t=q('[data-mode]')){DR.mode=t.dataset.mode;dRender(true);return}
 if(t=q('[data-smode]')){if((DS.mode==='quick')!==(t.dataset.smode==='quick'))dEdit({mode:t.dataset.smode});return}
 if(t=q('[data-ai]')){const a=RM.ais.find(x=>x.name===t.dataset.ai);if(!a||!a.found){toast(t.dataset.ai+' was not found on this computer. Scan for AI to look again.');return}DR.ai=a.name;post('room/access',{ai:a.name}).catch(()=>{});dRender(true);return}
 if(t=q('[data-sug]')){DR.q=RM.sugg[+t.dataset.sug].q;dRender(true);scrollTo({top:0,behavior:reduce?'auto':'smooth'});const x=$('#drQ');if(x)x.focus();return}
 if(t=q('[data-ans]')){dEdit({answer:t.dataset.ans.split(',').map(Number)});return}
 if(t=q('[data-swap]')){const i=+t.dataset.swap;DR.swap=DR.swap===i?-1:i;dRender(true);if(DR.swap>-1)$('.dr-bench').scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'});return}
 if(t=q('[data-bench]')){if(DR.swap<0){toast('Press Swap on a seat first');return}const i=DR.swap;DR.swap=-1;dEdit({swap:[i,DR.bench[+t.dataset.bench][0]]}).then(()=>toast('Seat swapped'));return}
 if(t=q('[data-dr]')){const a=t.dataset.dr;
  if(a==='folders'){if(RM)dFolders();else dHome().then(dFolders)}if(a==='shared')dShared();if(a==='report')dReport();if(a==='pdf')dPdf();if(a==='start')dStart();if(a==='attach')dAttach();
  if(a==='unattach')post('room/detach',{id:t.dataset.id}).then(dHome).then(()=>dRender(true)).catch(x=>toast(x.message));
  if(a==='allow')dEdit({allowFiles:true}).then(()=>toast('Allowed. Only those files are read.'));
  if(a==='run'){if(!dEvReady()){toast('Still reading what you allowed. One moment.');return}t.disabled=true;post('room/'+DS.id+'/run').then(s=>{DS=s;dBind();location.hash=dHref('live')}).catch(x=>{t.disabled=false;toast(x.message)})}
  if(a==='resume')post('room/'+DS.id+'/resume').then(s=>{DS=s;dBind();dRender(true)}).catch(x=>toast(x.message));
  if(a==='pause'){if(DS.status==='running'||DS.status==='paused'){const go=DR.paused;post('room/'+DS.id+'/'+(go?'resume':'pause')).then(s=>{DS=s;dBind();if(go){DR.paused=false;$('#drPause').innerHTML=ic('pause');$('#drRoom').classList.remove('paused');dPlay();dPollSet()}else{DR.paused=true;$('#drPause').innerHTML=ic('skip');$('#drRoom').classList.add('paused');toast('Pausing. The seats that are mid-answer finish first.')}}).catch(x=>toast(x.message))}
   else{DR.paused=!DR.paused;$('#drPause').innerHTML=ic(DR.paused?'skip':'pause');$('#drPause').setAttribute('aria-label',DR.paused?'Play':'Pause');$('#drRoom').classList.toggle('paused',DR.paused);if(DR.paused)dStop(true);else dPlay()}}
  if(a==='speed'){DR.speed=DR.speed===1?2:1;$('#drSpeed').textContent=DR.speed+'×'}
  if(a==='skip')dSkip();
  if(a==='new'){DR.q=''}
  if(a==='again'){DR.q=DS.q;location.hash='#room/ask'}
  if(a==='tasks')post('room/'+DS.id+'/tasks').then(r=>{DS.tasks=true;dRender(true);toast(r.added?dPlural(r.added,'step')+' added to Needs you, each with its owner and date':r.note);refresh(true)}).catch(x=>toast(x.message));
  if(a==='folder')post('room/'+DS.id+'/folder').then(()=>toast('The decision folder is open on this computer')).catch(x=>toast(x.message));
  if(a==='send'){const V=DS.verdict;location.href='mailto:?subject='+encodeURIComponent('Decision: '+DS.brief.title)+'&body='+encodeURIComponent(`${DS.result.label}. ${dPlain(V.call)}\n\nWhy:\n${V.why.map((w,i)=>(i+1)+'. '+w.head+' '+dPlain(w.text)).join('\n')}\n\nNext steps:\n${V.next.map(n=>'- '+n.step+' ('+n.owner+', by '+n.by+')').join('\n')}\n\nLook again on ${DS.againDate}.`);toast('Your mail app opens with the summary. Nothing is sent until you press send.')}
  if(a==='checkin')post('room/'+t.dataset.id+'/checkin',{result:t.dataset.r}).then(dHome).then(()=>{dRender(true);toast('Saved. The council will see this next time.')}).catch(x=>toast(x.message));
  if(a==='drop')post('room/'+t.dataset.id+'/delete').then(()=>{if(DS&&DS.id===t.dataset.id)DS=null;return dHome()}).then(()=>dRender(true)).catch(x=>toast(x.message));
  return}});
$('#p-room').addEventListener('change',e=>{const t=e.target;
 if(t.dataset.acc){const b={[t.dataset.acc]:t.checked};if(DS&&DR.step!=='ask')dEdit({access:b});else post('room/access',b).then(r=>{RM.access=r.access;dRender(true)}).catch(x=>toast(x.message))}
 if(t.hasAttribute('data-dr-names')){post('room/access',{names:t.checked}).catch(()=>{});if(RM)RM.names=t.checked;dEdit({names:t.checked})}});
$('#p-room').addEventListener('input',e=>{if(e.target.id==='drQ')DR.q=e.target.value});
$('#p-room').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-dr="report"][role]')){e.preventDefault();dReport()}if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&e.target.id==='drQ')dStart()});
$('#drFold').addEventListener('change',e=>{const t=e.target;if(t.dataset.fold)DR.fold[+t.dataset.fold]=t.checked});
$('#drFoldSave').onclick=()=>{const ids=RM.folders.filter((f,i)=>DR.fold[i]).map(f=>f.id);$('#drFold').hidden=true;const done=()=>toast(ids.length?dPlural(ids.length,'folder')+' switched on':'File reading is off');
 post('room/access',{folders:ids}).then(r=>{RM.access=r.access;RM.folders.forEach(f=>f.on=ids.includes(f.id));if(DR.foldFor==='session')return dEdit({access:{folders:ids}});dRender(true)}).then(done).catch(x=>toast(x.message))};
$('#drFoldX').onclick=$('#drFoldCancel').onclick=()=>{$('#drFold').hidden=true};
$('#drRepX').onclick=()=>{$('#drRep').hidden=true;$('#drRepP').innerHTML=''};$('#drRepDl').onclick=dPdf;
['drFold','drRep'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id)$('#'+id).hidden=true}));
addEventListener('keydown',e=>{if(e.key==='Escape'){$('#drFold').hidden=true;$('#drRep').hidden=true}});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-go^="dr:"]');if(!t||!DS)return;const g=t.dataset.go;
 if(g==='dr:folder')post('room/'+DS.id+'/folder').then(()=>toast('The decision folder is open. The log is the file named shared-log.')).catch(x=>toast(x.message));
 if(g.startsWith('dr:file:'))post('brain',{workspaceId:BOOT.workspace.id,action:'open',id:g.slice(8),how:'folder'}).then(()=>toast('Shown in its folder')).catch(x=>toast(x.message))});
/* DR-END */
