/* dr ===================== Decision Room (preview v6) ===================== */
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

const DQ='Should I raise Platewise Pro from $49 to $69 a month in January?';
const DGLOW={'--gold':'rgba(235,197,124,.5)','--ice':'rgba(138,212,255,.5)','--mint':'rgba(95,224,176,.46)','--violet':'rgba(185,162,255,.5)','--ember':'rgba(255,154,107,.5)','--bad':'rgba(255,122,122,.45)','--warn':'rgba(244,184,96,.5)','--text-3':'rgba(160,165,180,.4)'};
/* source key: name, colour, icon, which access switch it needs */
const DSRC={stripe:['Stripe','--gold','money','num'],ga:['Google Analytics','--ice','web','num'],linear:['Linear','--mint','team','num'],goals:['Goals','--violet','goals','num'],
 file:['WorkOS file','--ember','folder','files'],mail:['Gmail, subjects only','--bad','mail','mail'],made:['AI made','--violet','made','made'],att:['Attached by you','--warn','clip','att'],past:['Past decision','--text-3','room','num']};
/* id, source, what, value, period, age, link, plain note, pass, path */
const DEV=[
 ['E1','stripe','Platewise Pro, paying customers','212','Today','Live','#money','212 customers at $49 is $10,388 a month.',0],
 ['E2','stripe','Customers who cancel each month','2.1%','Last 6 months','Live','#money','The average of six months. The worst month was 2.6%.',0],
 ['E3','ga','Pricing page visitors who start checkout','4.2%','Last 28 days','4 min','#overview','1,940 visits. 81 of them started checkout.',0],
 ['E4','linear','Meal-plan export ships','9 Dec','3 tasks still open','Live','#overview','Owner: Kenneth. On track today.',0],
 ['E5','goals','Q4 goal: Platewise at $14,000 a month','74%','Q4 2026','Live','#goals','$10,388 of $14,000.',0],
 ['E6','att','Call notes, Juniper Kitchen.pdf','3 pages','Attached today','Just now','','A customer said: "We would not blink at $69 once export works."',0],
 ['E7','stripe','Customers who stayed 12 months or more','38%','Today','Live','#money','81 of 212 customers.',1],
 ['E8','file','Customer survey (October).csv','44%','61 answers','3 weeks','#brain','27 of 61 said they would pay more for meal-plan export.',1,'WorkOS / Decisions / Q4 pricing decision'],
 ['E9','file','Competitor prices v2.md','$59 to $89','3 rivals','5 weeks','#brain','Three direct rivals. None charges less than $59.',1,'WorkOS / Decisions / Q4 pricing decision'],
 ['E10','stripe','New Pro customers each month','18','Last 3 months','Live','#money','The average of three months.',1],
 ['E11','mail','Mail subjects that mention price or cancel','6','Last 30 days','2 h','#overview','Subjects and senders only. No message was opened.',1],
 ['E12','made','Pricing page draft v3','Ready','Made 12 Nov','5 days','#made','Made by Claude Code. Not published yet.',2],
 ['E13','past','Annual plan at two months free','Worked','Decided 14 Aug','3 months','#room/history','Verdict was Go. 31 customers moved to the annual plan.',2]];
const DGAPS=['Why customers ask for refunds. Stripe does not record a reason.','What is inside your Google Drive files. Drive is read by name only.'];
const DPASS=['First look. No AI used.','The council asked for more.','One last pass.'];
/* key, initials, role, the question it owns, why it sits, weight, colour, modelled on, round 1 scores, final scores */
const DSEAT=[
 ['cu','CU','The Customer seat','Will customers still feel it is worth it?','A price change lands on customers first.',3,'--ice','Jeff Bezos',[4,6,6],[4,7,6]],
 ['dm','DM','The Demand seat','Do people want this badly enough?','Checks whether demand is real or hoped for.',2,'--mint','Paul Graham',[7,8,5],[6,8,5]],
 ['of','OF','The Offer seat','Is the offer worth more than the price?','Pricing is this seat\'s home ground.',3,'--gold','Alex Hormozi',[6,8,4],[6,8,4]],
 ['at','AT','The Attention seat','What will people say about it in public?','A price rise can become a public story.',1,'--ember','Gary Vaynerchuk',[5,7,5],[5,7,5]],
 ['ti','TI','The Time seat','Does it buy back your time, or eat it?','More support mail is a hidden cost.',1,'--violet','Dan Martell',[7,8,6],[7,8,6]],
 ['op','OP','The Operations seat','Can the team carry it out cleanly?','Two prices at once need clean billing.',2,'--ice','Gino Wickman',[6,6,8],[6,7,8]],
 ['cp','CP','The Capital seat','What does it do to cash and risk over years?','Looks for the mistake you cannot undo.',3,'--gold','Warren Buffett',[5,5,7],[5,6,6]]];
const DBENCH=[['lv','LV','The Leverage seat','Does it scale without more of your hours?','',2,'--mint','Naval Ravikant'],['dl','DL','The Deal seat','Is there a smarter deal to make?','',2,'--ember','Codie Sanchez'],['pe','PE','The People seat','What does it ask of the team?','',2,'--violet','Leila Hormozi'],['br','BR','The Brand seat','Does it fit who you are?','',2,'--bad','Sara Blakely'],['ms','MS','The Moonshot seat','Is this thinking big enough?','',1,'--ice','Elon Musk']];
const DOPT=[['A','$69 for everyone in January','Every customer moves to $69 on 1 January.'],['B','$69 for new customers only','New customers pay $69. Today\'s customers keep $49 for now.'],['C','Leave the price at $49','Change nothing. Look again next quarter.']];
/* the script of the room: who, kind, stance, words */
const DR1=[
 ['cu','For B','Raise it for new customers only. {E7} of today\'s customers have stayed a year or more. They are the ones who would feel punished.'],
 ['dm','For B','Demand is real. {E3} of pricing page visitors start checkout, and rivals charge {E9}. At $49 you are leaving money on the table.'],
 ['of','For B, on export day','Do not raise the price. Raise the value, then the price. {E8} said they would pay more for export. Change the price the day it ships, {E4}.'],
 ['at','For B','A quiet rise for new customers makes no noise. A rise for everyone becomes a post that someone writes about you.'],
 ['ti','For B','Two prices means questions. Only {E11} mail subjects mentioned price last month, so support can carry it. Write one clear page first.'],
 ['op','B or C','Stripe can hold two prices cleanly. The risk is the date. Export is due {E4} and still has 3 tasks open. Do not announce a date you might miss.'],
 ['cp','Wait','At {E2} cancelling a month this business is healthy. I would not touch the price of {E1} paying customers to reach a quarter goal that stands at {E5}.']];
const DCRUX=[['of','dm','Does the price go up before export ships, or the same day?','The same day. A rise tied to something new needs no apology.'],['cu','cp','Do today\'s customers ever pay $69?','Not before 1 July, and that promise goes to them in writing.']];
const DR2=[
 ['dm','of','Waiting for export costs three weeks of new customers at $49. I accept it. A rise tied to a new feature needs no apology.'],
 ['of','dm','Three weeks is about 13 customers, at {E10} a month. That is cheap, for a price that nobody argues with.'],
 ['cp','cu','A lock until July is a promise. Put it in writing or do not make it. I can live with B if the lock is written.'],
 ['cu','cp','Agreed. Tell them before they see the new price on the website. {E6|The call notes you attached} say the same thing.']];
const DR3=['Yes, if customers hear it from us first.','Yes.','Yes. Value first, price second.','Yes. No announcement. Only a clear pricing page.','Yes.','Yes, if export really ships on the 9th.','I would still wait a month. I will not block it.'];
const DCALL='Raise Platewise Pro to $69 for new customers on 9 December, the day export ships. Keep today\'s customers at $49 until 1 July, and tell them this week.';
const DWHY=[
 ['The market already pays more.','Three rivals charge {E9}, and {E3} of your visitors start checkout at today\'s price.'],
 ['New value arrives on 9 December.','{E8} of surveyed customers said they would pay more for export, and it ships on {E4}.'],
 ['Today\'s customers are protected.','{E7} have stayed a year or more, so their price holds until 1 July.']];
const DNEXT=[['Write the price-lock note to today\'s 212 customers','Sam','Fri 20 Nov'],['Set pricing page draft v3 to go live with $69 on export day','Kenneth','Wed 2 Dec'],['Add the $69 price in Stripe, for new customers only','Sam','Wed 9 Dec']];
const DHIST=[
 ['16 Nov 2026','Raise Platewise Pro from $49 to $69?','Go, with conditions','gold','7.2','Look again on 2 Feb','Full','room/verdict'],
 ['28 Oct 2026','Hire a second video editor, or keep freelancers?','Reshape','','5.6','Trial running with one freelancer','Full',''],
 ['14 Aug 2026','Offer an annual plan at two months free?','Go','ok','8.1','Worked. 31 moved to annual.','Quick',''],
 ['2 Jul 2026','Move Northline Movers to a new booking tool?','Wait','','','Waiting on the vendor price','Quick',''],
 ['9 Jun 2026','Shut down the Quietroom newsletter?','Don\'t do it','hot','4.1','Kept. Open rate recovered.','Full','']];
const DSUG=[['Kenneth is at capacity. Hire a second editor, or keep freelancers?','Linear','--mint','9 tasks overdue this week'],['Northline bookings are flat. Spend $1,500 on ads, or fix the page first?','Google Analytics','--ice','Bookings flat for 6 weeks'],['Two clients pay late every month. Move everyone to card on file?','Stripe','--gold','$1,150 failed overnight']];
const DAI=[['Claude Code','CC','--gold'],['Codex','CX','--mint'],['Gemini CLI','GM','--ice'],['Grok','GK','--violet']];
const DFOLD=AREAS.map((a,i)=>[a[0],a[3],a[1]]);
const DSTEPS=[['ask','Ask'],['brief','Brief'],['board','Board'],['evidence','Evidence'],['live','The Room'],['verdict','Verdict']];
const DMODE={auto:['Let the Chair choose','The Chair reads your question first, then picks Quick or Full.'],quick:['Quick','4 seats, 2 rounds. About 16 AI calls, 4 to 6 minutes.'],full:['Full','7 seats, 3 rounds. About 30 AI calls, 8 to 15 minutes.']};

const DR={step:'ask',q:DQ,mode:'auto',ai:0,num:true,files:false,fold:DFOLD.map((f,i)=>i===4||i===5),made:true,mail:true,att:true,names:false,ans:[0,1],swap:-1,
 seats:DSEAT.map(s=>s.slice()),bench:DBENCH.map(s=>s.slice()),timers:[],speed:1,paused:false,i:0,live:null,done:{}};
const dSeat=k=>DR.seats.find(s=>s[0]===k)||DSEAT.find(s=>s[0]===k),dShort=s=>s[2].replace(/^The | seat$/g,'');
const dEv=id=>DEV.find(e=>e[0]===id);
const dOn=e=>{const k=DSRC[e[1]][3];return k==='files'?DR.files&&DR.fold[4]:!!DR[k]};
const dW=()=>DR.seats.reduce((s,x)=>s+x[5],0);
const dScore=(o,fin)=>DR.seats.reduce((s,x)=>s+x[5]*((fin?x[9]:x[8])||[5,6,5])[o],0)/dW();
const dSph=(s,cls)=>`<span class="sphere mono ${cls||''}" style="--glow:${DGLOW[s[6]]};--c:var(${s[6]})">${s[1]}</span>`;
const dCite=(id,lab)=>{const e=dEv(id),v=esc(lab||e[3]);return dOn(e)?`<button type="button" class="cite" data-ev="${id}" style="--c:var(${DSRC[e[1]][1]})" title="${esc(e[2])}"><b>${v}</b><i>${id.slice(1)}</i></button>`:`<span class="cite off" title="Not read. That source was switched off."><b>${v}</b><i>assumed</i></span>`};
const dTx=s=>esc(s).replace(/\{(E\d+)(?:\|([^}]+))?\}/g,(m,id,lab)=>dCite(id,lab&&lab.replace(/&amp;/g,'&')));
const dUsed=id=>{const u=new Set(),re=new RegExp('\\{'+id+'[|}]');DR1.forEach(r=>{if(re.test(r[2]))u.add(r[0])});DR2.forEach(r=>{if(re.test(r[2]))u.add(r[0])});return [...u]};
const dOffN=()=>DEV.filter(e=>!dOn(e)).length;
const dTog=(k,on,label)=>`<input class="tg" type="checkbox" data-acc="${k}" ${on?'checked':''} aria-label="${label}">`;
const dFoldN=()=>DR.fold.filter(Boolean).length;

function dSteps(){const ci=DSTEPS.findIndex(s=>s[0]===DR.step);
 return `<div class="dr-top"><nav class="dr-steps" aria-label="Decision steps">${DSTEPS.map((s,i)=>`<a href="#room/${s[0]}" class="${i<ci?'done':i===ci?'cur':''}"><i>${i<ci?'✓':i+1}</i><b>${s[1]}</b></a>${i<5?'<hr>':''}`).join('')}</nav><span class="grow"></span><span class="chip dr-run"><i style="background:var(--mint)"></i>Runs on ${DAI[DR.ai][0]}, your own plan</span></div>`}
const dFoot=(back,next,label,extra)=>`<div class="dr-foot">${back?`<a class="btn line" href="#room/${back}">${ic('back')}Back</a>`:''}<span class="grow">${extra||''}</span><a class="btn lg" href="#room/${next}">${label}${ic('arrow')}</a></div>`;

/* ---------- 1. Ask ---------- */
function dAccess(){const fOn=DR.files&&dFoldN()>0;
 const row=(icn,g,t,d,ctl,cls)=>`<div class="dr-acc ${cls||''}"><span class="sphere" style="--glow:${g}">${ic(icn)}</span><span class="grow"><b>${t}</b><small>${d}</small></span>${ctl}</div>`;
 return `<div class="panel dr-access" id="drAccess"><div class="dr-ah"><div class="grow"><div class="eyebrow"><b>You decide what it sees</b></div><h2 class="h3">What the council may look at.</h2></div><span class="tag ok">${ic('shield')}Stays on this computer</span></div>
 <div class="dr-accg"><div>
  ${row('money',DGLOW['--gold'],'Your numbers','Analytics, Stripe, Linear, Goals and Calendar. Totals and trends.',dTog('num',DR.num,'Your numbers'))}
  ${row('folder',DGLOW['--ember'],'Inside your WorkOS files',fOn?`${dFoldN()} of ${DFOLD.length} folders are on. The text in those folders can be read.`:'Off. The council sees file names only, until you choose folders.',fOn?`<button class="btn sm line" type="button" data-dr="folders">Change folders</button>${dTog('files',true,'Inside your WorkOS files')}`:`<button class="btn sm" type="button" data-dr="folders">${ic('folder')}Give access</button>`,fOn?'':'need')}
  ${row('made',DGLOW['--violet'],'Things your AIs made','Titles, dates and links from the last 14 days.',dTog('made',DR.made,'Things your AIs made'))}
  ${row('mail',DGLOW['--bad'],'Mail subjects','Subjects and senders only. Never the message itself.',dTog('mail',DR.mail,'Mail subjects'))}
  ${row('clip',DGLOW['--warn'],'A file you attach','Read for this one decision only. Good when you would rather not open your WorkOS.','<span class="tag">This decision only</span>')}
 </div><div class="dr-limits"><div class="eyebrow">The limits, upfront</div><b>The council can never</b><ul><li>${ic('x')}Read the body of an email</li><li>${ic('x')}Read inside Google Drive files</li><li>${ic('x')}Change, send or delete anything</li><li>${ic('x')}Look in a folder you left off</li><li>${ic('x')}Send your data anywhere but your own AI</li></ul><p>Switch anything on or off at any time. Each verdict lists exactly what was shared.</p></div></div></div>`}
function dAsk(){const m=DMODE[DR.mode];
 return `<div class="dr-ask"><div class="dr-askL rv">
  <div class="eyebrow"><b>Your AI</b> &nbsp;·&nbsp; One hard decision at a time</div>
  <h1 class="title">Decision <em>Room.</em></h1>
  <p class="lede">Ask one hard question. A board of advisors argues it with your real numbers, and hands back a verdict anyone can follow.</p>
  <div class="panel edge dr-comp">
   <label class="eyebrow" for="drQ">Your question</label>
   <textarea id="drQ" rows="2" spellcheck="false" placeholder="Should I ...?">${esc(DR.q)}</textarea>
   <div class="dr-att">${DR.att?`<span class="dr-file"><i>${ic('doc')}</i><span><b>Call notes, Juniper Kitchen.pdf</b><small>3 pages · read for this decision only</small></span><button type="button" class="round" data-dr="unattach" aria-label="Remove the file">✕</button></span>`:''}<button class="btn sm line" type="button" data-dr="attach">${ic('clip')}${DR.att?'Attach another file':'Attach a file'}</button><span class="dr-hint">PDF, Word, text or a spreadsheet</span></div>
   <div class="dr-row"><div><div class="eyebrow">How deep</div><div class="seg" role="group" aria-label="How deep">${Object.keys(DMODE).map(k=>`<button type="button" data-mode="${k}" aria-pressed="${DR.mode===k}">${DMODE[k][0]}</button>`).join('')}</div></div>
    <div><div class="eyebrow">Which AI runs it</div><div class="dr-ais">${DAI.map((a,i)=>`<button type="button" class="chip${DR.ai===i?' pick':''}" data-ai="${i}" aria-pressed="${DR.ai===i}"><i style="background:var(${a[2]})"></i>${a[0]}</button>`).join('')}</div></div></div>
   <div class="dr-go"><p><b>${m[1]}</b><br>Uses your ${DAI[DR.ai][0]} plan. No key, no extra bill, nothing to type in a terminal.</p><a class="btn lg" href="#room/brief">Start the council${ic('arrow')}</a></div>
  </div></div>
  <div class="dr-askR" aria-hidden="true">${dTableMini()}</div></div>
 ${dAccess()}
 <div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">From Needs you</div><h2 class="h3">Decisions that are waiting.</h2></div></div>
 <div class="dr-sug">${DSUG.map((s,i)=>`<button type="button" class="tile tilt" data-sug="${i}"><span class="eyebrow"><i style="background:var(${s[2]})"></i>${s[1]}</span><b>${esc(s[0])}</b><small>${s[3]}</small><em>Ask this ${ic('arrow')}</em></button>`).join('')}</div>
 <div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">History</div><h2 class="h3">Past decisions.</h2></div><a class="btn sm line" href="#room/history">See all ${DHIST.length}</a></div>
 <div class="panel dr-hist mini">${DHIST.slice(0,3).map(dHistRow).join('')}</div>`}
function dTableMini(){const n=7;return `<div class="dr-mini"><i class="dr-disc d2"></i><i class="dr-disc edge"></i>${orbw()}${DSEAT.map((s,i)=>{const a=-Math.PI/2+i/n*Math.PI*2,x=50+Math.cos(a)*41,y=52+Math.sin(a)*30,k=.78+.3*(Math.sin(a)+1)/2;return `<span class="dr-ms" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--k:${k.toFixed(2)};--d:${(i*.5).toFixed(1)}s;z-index:${Math.round(y)}">${dSph(s)}</span>`}).join('')}</div>`}
const dHistRow=h=>`<a class="dr-hrow" href="#${h[7]||'room/history'}"${h[7]?'':` data-toast="This past decision would open with its verdict and PDF"`}><span class="dr-hd num">${h[0]}</span><span class="grow"><b>${esc(h[1])}</b><small>${esc(h[5])}</small></span><span class="tag ${h[3]}">${h[2]}</span><span class="dr-hs num">${h[4]||'·'}</span><span class="dr-hm">${h[6]}</span></a>`;

/* ---------- 2. Brief ---------- */
function dBrief(){const QA=[['Have you promised any customer a fixed price?',['No','Yes, a few','Not sure']],['Is January fixed, or can the date move?',['It is fixed','It can move']]];
 return `${dSteps()}<div class="dr-two"><div class="panel dr-brief rv">
  <div class="eyebrow"><b>The brief</b> &nbsp;·&nbsp; Written by the Chair</div>
  <h2 class="h2">Should Platewise Pro go from $49 to $69 a month?</h2>
  <div class="dr-stake"><span class="eyebrow">What is at stake</span><p>Platewise Pro is ${dCite('E1')} customers and $10,388 a month, your largest steady income. A price is hard to take back once customers have seen it.</p></div>
  <div class="eyebrow dr-el">The options on the table</div>
  <div class="dr-opts">${DOPT.map(o=>`<div class="dr-opt"><i>${o[0]}</i><b>${o[1]}</b><small>${o[2]}</small></div>`).join('')}</div>
  <div class="eyebrow dr-el">What we already know</div>
  <div class="dr-know">${DEV.filter(e=>e[8]===0).map(e=>{const s=DSRC[e[1]];return dOn(e)?`<button type="button" class="drow" data-ev="${e[0]}"><i class="dr-dot" style="background:var(${s[1]})"></i><span class="grow"><b>${esc(e[2])}</b><small>${s[0]} · ${e[4]}</small></span><span class="dval num">${e[3]}</span></button>`:''}).join('')}</div>
 </div>
 <div class="dr-side">
  <div class="panel dr-chair rv"><div class="dr-ch">${orbw()}<div><div class="eyebrow"><b>The Chair suggests</b></div><b class="dr-big">A Full council.</b></div></div><p>This touches your main income and is hard to undo. Seven seats and three rounds are worth the wait.</p><div class="seg" role="group" aria-label="How deep"><button type="button" data-mode="full" aria-pressed="${DR.mode!=='quick'}">Full · about 11 min</button><button type="button" data-mode="quick" aria-pressed="${DR.mode==='quick'}">Quick · about 5 min</button></div></div>
  <div class="panel dr-qa rv"><div class="eyebrow"><b>Two questions only you can answer</b></div>${QA.map((q,i)=>`<div class="dr-q"><b>${q[0]}</b><div>${q[1].map((a,j)=>`<button type="button" class="chip${DR.ans[i]===j?' pick':''}" data-ans="${i},${j}" aria-pressed="${DR.ans[i]===j}">${a}</button>`).join('')}</div></div>`).join('')}<small class="dr-fine">The Chair asks at most four. Everything else comes from your data.</small></div>
  ${DR.files&&DR.fold[4]?`<div class="panel dr-ok rv"><span class="sphere" style="--glow:${DGLOW['--mint']}">${ic('check')}</span><div class="grow"><b>The council may read 2 files in "Q4 pricing decision".</b><small>You switched that folder on. Change it at any time.</small></div><button class="btn sm line" type="button" data-dr="folders">Change</button></div>`:
  `<div class="panel edge dr-askf rv"><div class="eyebrow"><b>The Chair asks for access</b></div><b class="dr-big">Two files would help.</b><p>They sit in a folder that is switched off, so the council has not read them.</p><div class="dr-fl"><span>${ic('doc')}<span><b>Customer survey (October).csv</b><small>WorkOS / Decisions / Q4 pricing decision</small></span></span><span>${ic('doc')}<span><b>Competitor prices v2.md</b><small>WorkOS / Decisions / Q4 pricing decision</small></span></span></div><div class="dr-fb"><button class="btn sm" type="button" data-dr="allow2">Allow these 2 files</button><button class="btn sm line" type="button" data-dr="folders">Choose folders</button><button class="btn sm line" type="button" data-toast="The council goes on without them and marks those points as assumed">Skip</button></div><small class="dr-fine">Only the text of these two files is read. Short excerpts go to your own AI.</small></div>`}
 </div></div>${dFoot('ask','board','Looks right. Pick the board','<span class="dr-hint">You can correct any line of the brief before a single advisor runs.</span>')}`}

/* ---------- 3. Board ---------- */
function dBoard(){return `${dSteps()}<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>The board</b> &nbsp;·&nbsp; Picked by the Chair for a pricing decision</div><h2 class="h2">Seven seats for this question.</h2><p class="mut dr-sub">Each seat looks at your decision through one question. A heavier seat counts for more in the vote.</p></div><label class="dr-names"><span><b>Show who each seat is modelled on</b><small>AI simulations built from public work. Not the people.</small></span><input class="tg" type="checkbox" data-dr-names ${DR.names?'checked':''}></label></div>
 <div class="dr-seats">${DR.seats.map((s,i)=>`<div class="panel tilt dr-seat${DR.swap===i?' swapping':''}" style="--c:var(${s[6]});--d:${i*70}ms"><div class="dr-st">${dSph(s)}<span class="dr-w" title="Weight ${s[5]} of 3">${[1,2,3].map(w=>`<i class="${w<=s[5]?'on':''}"></i>`).join('')}</span></div><b>${s[2]}</b><em>${esc(s[3])}</em>${DR.names?`<small class="dr-mod">Modelled on the public work of ${s[7]}. An AI simulation.</small>`:''}<p>${esc(s[4]||'Called in from the bench.')}</p><button type="button" class="btn sm line" data-swap="${i}">${ic('swap')}${DR.swap===i?'Cancel':'Swap'}</button></div>`).join('')}<div class="dr-how"><div class="eyebrow"><b>How the vote is counted</b></div><ol><li>Each seat scores every option out of 10.</li><li>A heavier seat counts for more.</li><li>Code adds it up. The AI never does the sum.</li></ol><span class="dr-eq num">score = sum of weight × vote, divided by ${dW()}</span></div></div>
 <div class="panel dr-bench${DR.swap>-1?' pick':''}"><div class="eyebrow">${DR.swap>-1?`<b>Pick a seat to replace ${DR.seats[DR.swap][2]}</b>`:'On the bench. Swap any of them in.'}</div><div class="dr-bl">${DR.bench.map((s,i)=>`<button type="button" class="dr-bs" data-bench="${i}">${dSph(s)}<span><b>${s[2]}</b><small>${esc(s[3])}${DR.names?' · '+s[7]:''}</small></span></button>`).join('')}</div></div>
 ${dFoot('brief','evidence','Seat the board','<span class="dr-hint">Total weight '+dW()+'. Scores are worked out by code, never by the AI.</span>')}`}

/* ---------- 4. Evidence ---------- */
function dEvRow(e,i){const s=DSRC[e[1]],on=dOn(e);return `<button type="button" class="dr-ev${on?'':' off'}" ${on?`data-ev="${e[0]}"`:'disabled'} style="--c:var(${s[1]});--i:${i}"><span class="dr-id num">${e[0]}</span><i class="dr-dot"></i><span class="grow"><b>${esc(e[2])}</b><small>${on?s[0]+' · '+e[4]:'Not read. '+(e[1]==='file'?'That folder is switched off.':'That source is switched off.')}</small></span><span class="dval num">${on?e[3]:'·'}</span><span class="dr-age">${on?(e[5]==='Live'?'Live':e[5]):''}</span></button>`}
function dEvidence(){const list=DEV,srcN={};list.filter(dOn).forEach(e=>srcN[e[1]]=(srcN[e[1]]||0)+1);
 return `${dSteps()}<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>Evidence</b> &nbsp;·&nbsp; Gathered once, shared by all seven seats</div><h2 class="h2" id="drEvT">Gathering <em>the facts.</em></h2></div><div class="dr-pass" id="drPass">${DPASS.map((p,i)=>`<span data-p="${i}"><i>${i+1}</i>${p}</span>`).join('')}</div></div>
 <div class="dr-two ev"><div class="panel dr-evl" id="drEvL">${[0,1,2].map(p=>`<div class="dr-evg" data-p="${p}"><div class="eyebrow">${DPASS[p]}</div>${list.map((e,i)=>e[8]===p?dEvRow(e,i):'').join('')}</div>`).join('')}</div>
 <div class="dr-side"><div class="panel dr-packp"><div class="dr-pack" id="drPack">${list.map((e,i)=>`<i class="${dOn(e)?'':'off'}" style="--i:${i};--c:var(${DSRC[e[1]][1]})"></i>`).join('')}</div><div class="dr-pn"><b class="num" id="drEvN">0</b><span>facts in the pack</span></div><div class="dr-leg">${Object.keys(srcN).map(k=>`<span class="chip"><i style="background:var(${DSRC[k][1]})"></i>${DSRC[k][0]}<em>${srcN[k]}</em></span>`).join('')}</div></div>
  <div class="panel dr-gaps"><div class="eyebrow"><b>What the council could not see</b></div><ul>${DGAPS.concat(DR.files&&DR.fold[4]?[]:['The customer survey and the competitor price list. That WorkOS folder is switched off.']).map(g=>`<li>${ic('eye')}${g}</li>`).join('')}</ul><small class="dr-fine">These gaps are printed in the verdict and in the PDF.</small></div></div></div>
 ${dFoot('board','live','Open the room','<button type="button" class="btn sm line" data-dr="shared">'+ic('shield')+'What is shared with your AI</button>')}`}
function dEvRun(fast){const rows=$$('#drEvL .dr-ev'),plates=$$('#drPack i');let n=0,on=0;const order=[0,1,2].flatMap(p=>rows.filter(r=>r.closest('.dr-evg').dataset.p==p));
 const show=k=>{const r=order[k];r.classList.add('in');const g=r.closest('.dr-evg');g.classList.add('in');$$('#drPass span').forEach(s=>s.classList.toggle('cur',s.dataset.p===g.dataset.p));$$('#drPass span').forEach(s=>s.classList.toggle('done',s.dataset.p<g.dataset.p));
  if(!r.classList.contains('off')){on++;$('#drEvN').textContent=on}const pl=plates[k];if(pl)pl.classList.add('in')};
 const end=()=>{$$('#drPass span').forEach(s=>{s.classList.remove('cur');s.classList.add('done')});$('#drEvT').innerHTML='The facts <em>are in.</em>';$('.dr-foot .btn.lg').classList.add('ready')};
 if(fast||reduce){order.forEach((r,k)=>show(k));end();return}
 order.forEach((r,k)=>DR.timers.push(setTimeout(()=>{show(k);if(k===order.length-1)DR.timers.push(setTimeout(end,500))},500+k*430+(+r.closest('.dr-evg').dataset.p)*700)))}

/* ---------- 5. The Room ---------- */
const DPOS=n=>DR.seats.map((s,i)=>{const a=-Math.PI/2+(i+.5)/n*Math.PI*2;return [50+Math.cos(a)*40,50+Math.sin(a)*33,.8+.28*(Math.sin(a)+1)/2]});
function dLive(){const P=DPOS(7);DR.pos=P;
 return `${dSteps()}<div class="panel dr-room dk" id="drRoom" data-phase="r1">
  <div class="dr-rh"><div class="dr-rounds">${['Round 1 · Opening views','The real disagreements','Round 2 · Debate','Round 3 · The vote'].map((r,i)=>`<span data-r="${i}"><i></i>${r}</span>`).join('')}</div><span class="grow"></span><div class="seg dr-ctl"><button type="button" data-dr="pause" id="drPause" aria-label="Pause">${ic('pause')}</button><button type="button" data-dr="speed" id="drSpeed">1×</button><button type="button" data-dr="skip">${ic('skip')}Skip to the verdict</button></div></div>
  <div class="dr-rg"><div class="dr-stage" id="drStage">
    <i class="dr-disc d2"></i><i class="dr-disc edge"></i><i class="dr-pool"></i>
    <svg class="dr-lines" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" id="drLines"></svg>
    <div class="dr-chairw">${orbw()}<span class="dr-cl">The Chair</span></div>
    ${DR.seats.map((s,i)=>`<div class="dr-rs" data-s="${s[0]}" style="left:${P[i][0].toFixed(1)}%;top:${P[i][1].toFixed(1)}%;--k:${P[i][2].toFixed(2)};--c:var(${s[6]});z-index:${Math.round(P[i][1])}"><span class="dr-bub"></span>${dSph(s)}<span class="dr-nm">${dShort(s)}</span><b class="dr-vote num"></b></div>`).join('')}
    <div class="dr-stamp" id="drStamp"><span class="eyebrow">The verdict</span><b>Go, <em>with conditions.</em></b><span class="num dr-sn">7.2 <small>of 10</small></span><a class="btn lg" href="#room/verdict">Read the verdict${ic('arrow')}</a></div>
   </div>
   <aside class="dr-feedw"><div class="eyebrow dr-fh"><b>What is being said</b><span id="drCalls" class="num">0 of 31 AI calls</span></div><div class="dr-feed" id="drFeed" aria-live="polite"></div></aside></div>
  <div class="dr-bars" id="drBars">${DOPT.map((o,i)=>`<div class="dr-bar" data-o="${i}"><span class="dr-bl2"><i>${o[0]}</i>${o[1]}</span><span class="dr-track"><i class="t1"></i><i class="t2"></i><i class="t3"></i><b></b></span><span class="dr-bv num">·</span></div>`).join('')}<div class="dr-bkey"><span class="k"><em style="left:22.5%">Don't do it</em><em style="left:52.5%">Reshape</em><em style="left:67.5%">Conditions</em><em style="left:87.5%">Go</em></span></div></div>
 </div>`}
function dSay(who,tag,html,extra,cls){const f=$('#drFeed');if(!f)return;const s=who==='chair'?null:who==='data'?null:dSeat(who);
 const head=who==='chair'?`<span class="sphere dr-chs">${ic('gavel')}</span><b>The Chair</b>`:who==='data'?`<span class="sphere" style="--glow:${DGLOW['--mint']}">${ic('check')}</span><b>Answered from your data</b>`:`${dSph(s)}<b>${s[2]}</b>`;
 f.insertAdjacentHTML('beforeend',`<div class="dr-say ${cls||''}" ${s?`style="--c:var(${s[6]})"`:''}><div class="dr-sayh">${head}${tag?`<span class="tag">${tag}</span>`:''}</div><p>${html}</p>${extra||''}</div>`);f.scrollTop=f.scrollHeight}
function dBarsSet(fin,upto){$$('#drBars .dr-bar').forEach((b,o)=>{const S=DR.seats.slice(0,upto==null?7:upto);if(!S.length)return;const w=S.reduce((a,x)=>a+x[5],0),v=S.reduce((a,x)=>a+x[5]*((fin?x[9]:x[8])||[5,6,5])[o],0)/w;b.querySelector('b').style.width=(v*10)+'%';b.querySelector('.dr-bv').textContent=v.toFixed(1);b.classList.toggle('lead',false)});
 const bs=$$('#drBars .dr-bar'),vals=bs.map(b=>+b.querySelector('.dr-bv').textContent||0),mx=Math.max(...vals);bs.forEach((b,i)=>b.classList.toggle('lead',vals[i]===mx&&mx>0))}
function dPhase(i){$('#drRoom').dataset.phase=['r1','crux','r2','r3','end'][i];$$('.dr-rounds span').forEach(s=>{s.classList.toggle('cur',+s.dataset.r===i);s.classList.toggle('done',+s.dataset.r<i)})}
function dSpeak(k,bub){const cw=$('.dr-chairw');if(cw)cw.classList.toggle('speaking',k==='chair');$$('.dr-rs').forEach(r=>{const me=r.dataset.s===k;r.classList.toggle('speaking',me);if(me){r.classList.remove('thinking');r.classList.add('spoke');if(bub){r.querySelector('.dr-bub').textContent=bub}}});const i=DR.seats.findIndex(s=>s[0]===k),P=DR.pos;
 const beam=$('#drBeam');if(beam&&i>-1){beam.setAttribute('d',`M${P[i][0]*10} ${P[i][1]*7} L500 ${41*7}`);beam.style.stroke=`var(${DR.seats[i][6]})`;beam.classList.remove('on');void beam.getBoundingClientRect();beam.classList.add('on')}}
const dCalls=n=>{const c=$('#drCalls');if(c)c.textContent=n+' of 31 AI calls'};
function dScript(){const S=[],P=DR.pos,seats=DR.seats,idx=k=>seats.findIndex(s=>s[0]===k);let calls=5;
 S.push([900,()=>{dPhase(0);$('#drLines').innerHTML='<path id="drBeam" class="dr-beam"/>';dCalls(calls);dSay('chair','Brief','Seven seats, three options. Every seat has the same '+DEV.filter(dOn).length+' facts. Opening views first. Nobody sees another seat\'s answer yet.');seats.slice(0,3).forEach(s=>$(`.dr-rs[data-s="${s[0]}"]`).classList.add('thinking'))}]);
 seats.forEach((s,i)=>{const r=DR1.find(x=>x[0]===s[0])||[s[0],'Listening','Called in from the bench. I will weigh in on the vote.'];
  S.push([2500,()=>{dSpeak(s[0],r[1]);const sc=s[8]||[5,6,5];dSay(s[0],'Round 1',dTx(r[2]),`<div class="dr-sc">${DOPT.map((o,j)=>`<span><i>${o[0]}</i>${sc[j]}</span>`).join('')}<em>${r[1]}</em></div>`);dBarsSet(false,i+1);dCalls(++calls);const nx=seats[i+3];if(nx)$(`.dr-rs[data-s="${nx[0]}"]`).classList.add('thinking')}])});
 S.push([2600,()=>{dPhase(1);dSpeak('chair');dCalls(++calls);const L=$('#drLines');DCRUX.forEach((c,j)=>{const a=idx(c[0]),b=idx(c[1]);if(a<0||b<0)return;const x1=P[a][0]*10,y1=P[a][1]*7,x2=P[b][0]*10,y2=P[b][1]*7,mx=(x1+x2)/2+(j?60:-60),my=(y1+y2)/2-90;L.insertAdjacentHTML('beforeend',`<path class="dr-crux" data-c="${j}" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`)});
   dSay('chair','Two real disagreements',`<ol class="dr-cx">${DCRUX.map(c=>`<li><b>${esc(c[2])}</b><small>${dSeat(c[0])[2]} and ${dSeat(c[1])[2]}</small></li>`).join('')}</ol>`,'','chair')}]);
 S.push([2600,()=>{dSay('data','No AI call needed','The Capital seat asked how many new customers arrive each month. Stripe says '+dCite('E10')+'. At $20 more each, that is $360 more a month, every month.','','data')}]);
 DR2.forEach((r,i)=>S.push([2800,()=>{if(!i)dPhase(2);dSpeak(r[0],'To '+dShort(dSeat(r[1])));$$('.dr-crux').forEach(p=>p.classList.toggle('hot',+p.dataset.c===(i<2?0:1)));dSay(r[0],'Round 2 · to '+dSeat(r[1])[2],dTx(r[2]));dCalls(++calls)}]));
 S.push([2800,()=>{dSpeak('chair');$$('.dr-crux').forEach(p=>{p.classList.remove('hot');p.classList.add('settled')});calls+=4;dCalls(calls);dSay('chair','Draft resolution','$69 for new customers from 9 December, the day export ships. Today\'s customers stay at $49 until 1 July, promised in writing.','','chair')}]);
 seats.forEach((s,i)=>S.push([i?1000:2400,()=>{if(!i){dPhase(3);$$('.dr-rs').forEach(r=>r.classList.remove('speaking'))}const el=$(`.dr-rs[data-s="${s[0]}"]`),sc=s[9]||[5,6,5];el.classList.add('voted');el.querySelector('.dr-vote').textContent=sc[1];el.querySelector('.dr-bub').textContent='';dSay(s[0],'Vote · '+sc[1]+' of 10',esc(DR3[DSEAT.findIndex(x=>x[0]===s[0])]||'Yes.'),'','vote');dBarsSet(true,7);$$('#drBars .dr-bar').forEach((b,o)=>{const S2=seats.slice(0,i+1),S1=seats.slice(i+1),w=dW(),v=(S2.reduce((a,x)=>a+x[5]*(x[9]||[5,6,5])[o],0)+S1.reduce((a,x)=>a+x[5]*(x[8]||[5,6,5])[o],0))/w;b.querySelector('b').style.width=(v*10)+'%';b.querySelector('.dr-bv').textContent=v.toFixed(1)});dCalls(++calls)}]));
 S.push([1500,()=>{dPhase(4);dCalls(31);dBarsSet(true,7);dSay('chair','Checked by code','Scores worked out from the seven votes. Every number in the verdict was checked against its source. Two points were sent back and fixed.','','chair');$('#drStamp').classList.add('on');DR.done.live=true}]);
 return S}
function dPlay(){if(DR.paused||!DR.live)return;if(DR.i>=DR.live.length)return;const st=DR.live[DR.i];DR.timers.push(setTimeout(()=>{if(DR.step!=='live'||DR.paused)return;st[1]();DR.i++;dPlay()},st[0]/DR.speed))}
function dLiveRun(fast){DR.live=dScript();DR.i=0;DR.paused=false;if(fast||reduce){DR.live.forEach(s=>s[1]());DR.i=DR.live.length;$$('.dr-rs').forEach(r=>r.classList.remove('thinking','speaking'));return}dPlay()}
function dSkip(){dStop();if(!DR.live)return;$('#drRoom').classList.add('fast');while(DR.i<DR.live.length){DR.live[DR.i][1]();DR.i++}$$('.dr-rs').forEach(r=>r.classList.remove('thinking','speaking'))}

/* ---------- 6. Verdict ---------- */
function dDial(v){const R=86,C=2*Math.PI*R,arc=.75,len=C*arc,f=len*v/10;const tick=x=>{const a=(135+270*x/10)*Math.PI/180;return `<line x1="${110+Math.cos(a)*74}" y1="${110+Math.sin(a)*74}" x2="${110+Math.cos(a)*98}" y2="${110+Math.sin(a)*98}"/>`};
 return `<div class="dr-dial"><svg viewBox="0 0 220 220" aria-hidden="true"><defs><linearGradient id="drG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="var(--ember)"/><stop offset=".55" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--mint)"/></linearGradient></defs><circle cx="110" cy="110" r="${R}" class="bg" stroke-dasharray="${len} ${C}" transform="rotate(135 110 110)"/><circle cx="110" cy="110" r="${R}" class="fg" stroke="url(#drG)" stroke-dasharray="${f} ${C}" style="--len:${f};--c:${C}" transform="rotate(135 110 110)"/><g class="tk">${tick(4.5)}${tick(6)}${tick(7.5)}</g></svg><div><b class="num">${v.toFixed(1)}</b><span>of 10</span></div></div>`}
function dSources(){const rows=DEV.map(e=>({e,u:dUsed(e[0]),on:dOn(e)})).sort((a,b)=>b.on-a.on);const dec=['E4','E8','E9'];
 return `<div class="tbl dr-src"><table><thead><tr><th>Id</th><th>What it is</th><th>Where from</th><th>Covers</th><th>How fresh</th><th>Used by</th><th></th></tr></thead><tbody>${rows.map((r,i)=>{const e=r.e,s=DSRC[e[1]];return `<tr class="${r.on?'':'off'}"><td class="num dr-id">${e[0]}</td><td><b>${esc(e[2])}</b>${r.on&&dec.includes(e[0])?'<span class="tag gold">Decisive</span>':''}${e[9]?`<small>${e[9]}</small>`:''}</td><td><span class="dr-from"><i style="background:var(${s[1]})"></i>${s[0]}</span></td><td class="mut">${e[4]}</td><td class="mut">${r.on?(e[5]==='Live'?'<span class="dr-livd">Live</span>':e[5]+' old'):'Not read'}</td><td><span class="dr-ub">${r.u.map(k=>dSph(dSeat(k))).join('')||'<small class="mut">Background</small>'}</span></td><td class="r">${r.on?`<button type="button" class="btn sm line" data-ev="${e[0]}">Open</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`}
function dVerdict(){const off=dOffN(),sA=dScore(0,1),sB=dScore(1,1),sC=dScore(2,1),sc=[sA,sB,sC];
 return `${dSteps()}
 ${off?`<div class="start dr-warn"><div class="grow"><div class="eyebrow"><b>Worked with less</b></div><b>The council ran without ${off} source${off>1?'s':''} you switched off. Points that leaned on them are marked "assumed".</b></div><button class="btn sm" type="button" data-dr="allow2">Allow the 2 files and compare</button><a class="btn sm line" href="#room/ask">Change access</a></div>`:''}
 <div class="panel edge dr-vh rv"><div class="dr-vl"><div class="eyebrow"><b>The verdict</b> &nbsp;·&nbsp; 16 Nov 2026 &nbsp;·&nbsp; Asked by Sam</div><p class="dr-vq">"${esc(DR.q)}"</p><h1 class="title">Go, <em>with conditions.</em></h1><p class="dr-call">${esc(DCALL)}</p>
   <div class="dr-meta"><span class="chip">${ic('room')}Full council · 7 seats</span><span class="chip">${ic('clock')}11 minutes · 31 AI calls</span><span class="chip"><i style="background:var(--mint)"></i>${off?'Confidence: medium':'Confidence: high · 6 of 7 agree'}</span><span class="chip"><i style="background:var(${DAI[DR.ai][2]})"></i>${DAI[DR.ai][0]}</span></div></div>
  <div class="dr-vr">${dDial(sB)}<div class="dr-vbars">${DOPT.map((o,i)=>`<div class="dr-bar${i===1?' lead':''}"><span class="dr-bl2"><i>${o[0]}</i>${o[1]}</span><span class="dr-track"><i class="t1"></i><i class="t2"></i><i class="t3"></i><b style="width:${sc[i]*10}%"></b></span><span class="dr-bv num">${sc[i].toFixed(1)}</span></div>`).join('')}<small class="dr-fine">Worked out by code from seven weighted votes. 6.0 to 7.4 means go, with conditions.</small></div></div></div>
 <div class="sec-head dr-sh"><div class="grow"><div class="eyebrow">Why</div><h2 class="h3">Three reasons.</h2></div><span class="dr-hint">Tap any number to see where it came from.</span></div>
 <div class="dr-why">${DWHY.map((w,i)=>`<div class="panel tilt rv"><span class="dr-n num">0${i+1}</span><b>${w[0]}</b><p>${dTx(w[1])}</p></div>`).join('')}</div>
 <div class="panel dr-money rv"><span class="sphere" style="--glow:${DGLOW['--gold']}">${ic('money')}</span><p>Stripe shows ${dCite('E10')} new customers a month. At $20 more each, every month adds about <b>$360 a month</b>. By 1 July that is about <b>$2,500 a month</b> more, before any of today's customers move. On its own this will not reach the Q4 goal, which stands at ${dCite('E5')}.</p></div>
 <div class="dr-two v"><div class="panel dr-next rv"><div class="dr-ph"><div class="grow"><div class="eyebrow"><b>What happens next</b></div><h3 class="h3">Three steps.</h3></div><button type="button" class="btn sm" data-toast="Three tasks would be added to Linear, each with its owner and date">Turn into tasks</button></div>
   ${DNEXT.map((n,i)=>`<label class="dr-step"><input type="checkbox"><i></i><span class="grow"><b>${esc(n[0])}</b><small>${n[1]} · by ${n[2]}</small></span><span class="sphere mono">${n[1].slice(0,1)}</span></label>`).join('')}</div>
  <div class="panel dr-cond rv"><div class="eyebrow"><b>Conditions</b></div><ul class="ok"><li>${ic('check')}Export ships first. No price change before it does.</li><li>${ic('check')}The price lock reaches today's customers in writing.</li><li>${ic('check')}Two numbers are watched for 14 days.</li></ul>
   <div class="eyebrow"><b class="bad">Stop and think again if</b></div><ul class="stop"><li>${ic('needs')}Checkout starts fall below 3.0% for 14 days. Today ${dCite('E3')}</li><li>${ic('needs')}Cancellations pass 3.5% in any month. Today ${dCite('E2')}</li></ul>
   <div class="dr-again">${ic('clock')}<span><b>Look again on 2 February 2027.</b><small>The dashboard will ask you then whether this worked.</small></span></div></div></div>
 <div class="dr-two v"><div class="panel dr-minor rv"><div class="eyebrow"><b>The minority view</b></div><div class="dr-mq">${dSph(dSeat('cp'))}<blockquote>"A healthy business does not need to hurry. I would have waited for one month of export numbers before touching the price."<cite>${dSeat('cp')[2]} · voted 6 of 10</cite></blockquote></div><div class="eyebrow dr-el">What would change this verdict</div><ul class="dr-chg"><li>Export slips past December.</li><li>Checkout starts drop once $69 is on the page.</li><li>More than a handful of customers ask to leave after the note.</li></ul><small class="dr-fine">Every verdict keeps the strongest argument against it.</small></div>
  <div class="panel dr-votes rv"><div class="eyebrow"><b>How each seat voted</b></div><div class="dr-vt">${DR.seats.map(s=>{const f=s[9]||[5,6,5];return `<div>${dSph(s)}<span class="grow"><b>${dShort(s)}</b><small>Weight ${s[5]}</small></span>${f.map((x,j)=>`<span class="dr-vc${j===1?' b':''}"><i>${DOPT[j][0]}</i>${x}</span>`).join('')}</div>`}).join('')}</div></div></div>
 <div class="sec-head dr-sh" id="drSrcH"><div class="grow"><div class="eyebrow">Sources</div><h2 class="h3">What the decision stands on.</h2></div><button type="button" class="btn sm line" data-dr="shared">${ic('shield')}What was shared with your AI</button></div>
 <div class="panel dr-srcp rv">${dSources()}<div class="dr-gl"><div class="eyebrow">What the council could not see</div><ul>${DGAPS.map(g=>`<li>${ic('eye')}${g}</li>`).join('')}</ul></div></div>
 <div class="panel edge dr-pdf rv"><div class="dr-pages" data-dr="report" role="button" tabindex="0" aria-label="Read the report">${[2,1,0].map(i=>`<i class="p${i}" style="${DPAGES[i]?`background-image:url(${DPAGES[i]})`:''}"></i>`).join('')}</div><div class="grow"><div class="eyebrow"><b>The report</b> &nbsp;·&nbsp; PDF · ${DPAGES.length||7} pages</div><h3 class="h2">Written so a new employee can follow it.</h3><p class="mut">What was decided, why, what happens next, who does it and when to stop. Every number points to its source.</p><div class="dr-pb"><button type="button" class="btn" data-dr="report">${ic('doc')}Read it here</button><button type="button" class="btn line" data-toast="The PDF would be saved to your Downloads folder">${ic('down')}Download PDF</button><button type="button" class="btn line" data-toast="The decision folder would open on this computer">${ic('folder')}Open folder</button><button type="button" class="btn line" data-toast="You would pick who gets it. Nothing is sent without your click.">${ic('mail')}Send</button></div></div></div>
 <div class="dr-foot"><a class="btn line" href="#room/history">${ic('back')}All decisions</a><span class="grow"></span><a class="btn line" href="#room/live">Watch the room again</a><a class="btn" href="#room/ask" data-dr="new">Ask something new${ic('arrow')}</a></div>`}

/* ---------- 7. History, 8. States ---------- */
function dHistory(){return `<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>Decision Room</b> &nbsp;·&nbsp; History</div><h1 class="title">Every decision, <em>kept.</em></h1><p class="lede">Each one keeps its verdict, its sources and its PDF. On the date it set, the dashboard asks if it worked.</p></div><a class="btn" href="#room/ask">Ask something new${ic('arrow')}</a></div>
 <div class="panel edge dr-fu rv"><span class="sphere" style="--glow:${DGLOW['--gold']}">${ic('clock')}</span><div class="grow"><div class="eyebrow"><b>Time to look again</b> &nbsp;·&nbsp; Decided 28 Oct</div><b class="dr-big">Did the freelancer trial work out?</b><small>The council said: reshape. Try one freelancer for three weeks before hiring.</small></div><div class="dr-fb"><button class="btn sm" type="button" data-toast="Saved. The council will learn from this next time.">It worked</button><button class="btn sm line" type="button" data-toast="Saved. The council will learn from this next time.">Partly</button><button class="btn sm line" type="button" data-toast="Saved. The council will learn from this next time.">It did not</button></div></div>
 <div class="dr-hstats">${[['5','decisions this year'],['2 of 2','checked ones worked out'],['$0','extra AI cost. Your plan covered it.']].map(s=>`<div class="tile"><b class="num">${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div>
 <div class="panel dr-hist rv">${DHIST.map(dHistRow).join('')}</div>`}
function dStates(){const card=(icn,g,ey,t,d,btn,href,vis)=>`<div class="panel dr-state rv"><span class="sphere" style="--glow:${g}">${ic(icn)}</span><div class="eyebrow"><b>${ey}</b></div><b class="dr-big">${t}</b><p>${d}</p>${vis}${href?`<a class="btn sm" href="${href}">${btn}</a>`:`<button class="btn sm${btn==='Nothing to do'?' line':''}" type="button" data-toast="${btn==='Nothing to do'?'It carries on by itself':'That would happen here'}">${btn}</button>`}</div>`;
 return `<div class="head dr-bh"><div class="grow"><div class="eyebrow"><b>Decision Room</b> &nbsp;·&nbsp; When things are not ready</div><h1 class="title">Never <em>a dead end.</em></h1><p class="lede">Every problem gets one clear screen and one button. Nobody is ever sent to a terminal.</p></div></div>
 <div class="dr-states">
  ${card('spark',DGLOW['--violet'],'First visit','No decisions yet.','Ask your first question. The council needs about ten minutes.','Ask a question','#room/ask','')}
  ${card('plug',DGLOW['--ice'],'No AI found','Connect an AI first.','The council runs on your own AI. One click finds the ones on this computer and connects them.','Scan for AI','#scan','')}
  ${card('pause',DGLOW['--warn'],'Paused at step 6 of 11','Your AI plan needs a short rest.','Nothing is lost. The council carries on by itself at 7:40 PM, from the same step.','Nothing to do','','<i class="dr-prog"><b style="width:55%"></b></i>')}
  ${card('team',DGLOW['--ember'],'One seat sat out','Six of seven seats answered.','The Attention seat did not answer twice. Its weight was shared out, and the report says so.','See the verdict','#room/verdict','<i class="dr-dots">'+'<u></u>'.repeat(7)+'</i>')}
  ${card('lock',DGLOW['--bad'],'Access is off','The council saw numbers only.','Your WorkOS folders are switched off. The verdict marks what it had to assume.','Choose folders','#room/ask','')}
  ${card('back',DGLOW['--mint'],'You closed the app','Pick up where it stopped.','Round 2 was saved. Carry on from there, or start over.','Carry on','#room/live','<i class="dr-prog"><b style="width:72%"></b></i>')}
 </div>`}

/* ---------- sheets, routing, clicks ---------- */
function dEvCard(id){const e=dEv(id),s=DSRC[e[1]],u=dUsed(id).map(k=>dSeat(k)[2]);
 showCard({small:true,icon:s[2],glow:DGLOW[s[1]],ey:`<b>Evidence ${id}</b> &nbsp;·&nbsp; ${s[0]}`,title:e[2],big:e[3],bigNote:e[4],lede:e[7],rows:[['Used by',u.length?u.join(', '):'Background for the Chair'],['How fresh',e[5]==='Live'?'Read live when the council started':'Last changed '+e[5]+' ago'],...(e[9]?[['Where it lives',e[9]]]:[])],src:[[s[0],s[1],e[9]||'Read-only',e[5]]],acts:e[6]?[['Open the source',e[6]]]:['Open the file'],srcOpen:true})}
function dShared(){const on=DEV.filter(dOn),by={};on.forEach(e=>by[e[1]]=(by[e[1]]||0)+1);
 showCard({icon:'shield',glow:DGLOW['--mint'],ey:'<b>What was shared</b> &nbsp;·&nbsp; This decision',title:'Sent to your own AI, and nowhere else.',lede:`Everything below went to ${DAI[DR.ai][0]} on your own plan, for this one decision.`,rows:[[on.length+' facts from the evidence pack','Numbers and short lines, each with its id'],...(DR.files&&DR.fold[4]?[['2 file excerpts','410 words in total, from "Q4 pricing decision"']]:[]),...(DR.att?[['1 attached file','Call notes, Juniper Kitchen.pdf, 3 pages']]:[]),['0 mail bodies','Subjects only, as always'],['0 passwords or keys','2 files that looked like secrets were skipped']],src:Object.keys(by).map(k=>[DSRC[k][0],DSRC[k][1],by[k]+(by[k]>1?' facts':' fact'),'Live']),acts:['Download the full log'],srcOpen:true})}
function dFolders(){DR.fold0=DR.fold.slice();$('#drFoldI').innerHTML=ic('folder');$('#drFoldRows').innerHTML=DFOLD.map((f,i)=>`<label class="crow"><span class="sphere" style="--glow:${hexA(f[2],.5)}">${ic('folder')}</span><span class="grow"><b>${f[0]}</b><small>${f[1]} files${i===3?' · AI memory can hold private notes':''}</small></span><input class="tg" type="checkbox" data-fold="${i}" ${DR.fold[i]?'checked':''} aria-label="Read inside ${f[0]}"></label>`).join('');$('#drFold').hidden=false}
function dReport(){$('#drRepP').innerHTML=DPAGES.length?DPAGES.map((p,i)=>`<img alt="Report page ${i+1}" src="${p}" loading="lazy">`).join(''):'<p class="mut" style="padding:40px">The sample report is attached beside this preview.</p>';$('#drRep').hidden=false;$('#drRepP').scrollTop=0}
function dStop(){DR.timers.forEach(clearTimeout);DR.timers=[]}
function dRender(fast){dStop();const s=DR.step,el=$('#dr');
 el.dataset.step=s;el.innerHTML=({ask:dAsk,brief:dBrief,board:dBoard,evidence:dEvidence,live:dLive,verdict:dVerdict,history:dHistory,states:dStates}[s]||dAsk)();
 $$('#drJump a').forEach(a=>a.classList.toggle('on',a.dataset.s===s));orbs();
 if(s==='evidence')dEvRun(fast);if(s==='live')dLiveRun(fast);onScroll()}
function dRoute(step){const ok=['ask','brief','board','evidence','live','verdict','history','states'];DR.step=ok.includes(step)?step:'ask';DR.swap=-1;dRender();const c={ask:'Decision Room',history:'Decision Room / History',states:'Decision Room / States'}[DR.step]||'Decision Room / '+DSTEPS.find(x=>x[0]===DR.step)[1];$('#crumb').textContent=c}
$('#drJump').innerHTML=DSTEPS.concat([['history','History'],['states','States']]).map(s=>`<a href="#room/${s[0]}" data-s="${s[0]}">${s[1]}</a>`).join('');
$('#drReplay').onclick=()=>dRender();
$('#p-room').addEventListener('click',e=>{const q=s=>e.target.closest(s);let t;
 if(t=q('[data-ev]')){dEvCard(t.dataset.ev);return}
 if(t=q('[data-mode]')){DR.mode=t.dataset.mode;dRender(true);return}
 if(t=q('[data-ai]')){DR.ai=+t.dataset.ai;dRender(true);return}
 if(t=q('[data-sug]')){DR.q=DSUG[+t.dataset.sug][0];dRender(true);scrollTo({top:0,behavior:reduce?'auto':'smooth'});toast('Question filled in. The preview still plays the pricing example.');return}
 if(t=q('[data-ans]')){const a=t.dataset.ans.split(',');DR.ans[+a[0]]=+a[1];dRender(true);return}
 if(t=q('[data-swap]')){const i=+t.dataset.swap;DR.swap=DR.swap===i?-1:i;dRender(true);if(DR.swap>-1)$('.dr-bench').scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'});return}
 if(t=q('[data-bench]')){if(DR.swap<0){toast('Press Swap on a seat first');return}const b=+t.dataset.bench,out=DR.seats[DR.swap];DR.seats[DR.swap]=DR.bench[b];DR.bench[b]=out;DR.swap=-1;dRender(true);toast('Seat swapped');return}
 if(t=q('[data-dr]')){const a=t.dataset.dr;
  if(a==='folders')dFolders();if(a==='shared')dShared();if(a==='report')dReport();
  if(a==='attach'){DR.att=true;dRender(true);toast('A file picker would open. The file is read for this decision only.')}
  if(a==='unattach'){DR.att=false;dRender(true)}
  if(a==='allow2'){DR.files=true;DR.fold[4]=true;dRender(true);toast('Allowed. Only those two files are read.')}
  if(a==='pause'){DR.paused=!DR.paused;$('#drPause').innerHTML=ic(DR.paused?'skip':'pause');$('#drPause').setAttribute('aria-label',DR.paused?'Play':'Pause');$('#drRoom').classList.toggle('paused',DR.paused);if(DR.paused)dStop();else dPlay()}
  if(a==='speed'){DR.speed=DR.speed===1?2:1;$('#drSpeed').textContent=DR.speed+'×'}
  if(a==='skip')dSkip();
  if(a==='new'){DR.q=DQ}
  return}});
$('#p-room').addEventListener('change',e=>{const t=e.target;if(t.dataset.acc){DR[t.dataset.acc]=t.checked;dRender(true)}if(t.hasAttribute('data-dr-names')){DR.names=t.checked;dRender(true)}});
$('#p-room').addEventListener('input',e=>{if(e.target.id==='drQ')DR.q=e.target.value});
$('#p-room').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-dr="report"][role]')){e.preventDefault();dReport()}});
$('#drFold').addEventListener('change',e=>{const t=e.target;if(t.dataset.fold){DR.fold[+t.dataset.fold]=t.checked}});
$('#drFoldSave').onclick=()=>{DR.files=dFoldN()>0;$('#drFold').hidden=true;dRender(true);toast(DR.files?dFoldN()+' folders switched on':'File reading is off')};
$('#drFoldX').onclick=$('#drFoldCancel').onclick=()=>{if(DR.fold0)DR.fold=DR.fold0.slice();$('#drFold').hidden=true};
$('#drRepX').onclick=()=>$('#drRep').hidden=true;
['drFold','drRep'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id){if(id==='drFold'&&DR.fold0)DR.fold=DR.fold0.slice();$('#'+id).hidden=true}}));
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#drFold').hidden&&DR.fold0)DR.fold=DR.fold0.slice();$('#drFold').hidden=true;$('#drRep').hidden=true}});
/* DR-END */
