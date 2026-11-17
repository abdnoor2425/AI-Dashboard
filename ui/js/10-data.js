/* ---------- live data: one bundle from this computer, read again whenever something changes ---------- */
const getJSON=async(p,opt)=>{const r=await fetch('/api/'+p,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'That did not work. Try again.');return j};
const post=(p,body)=>getJSON(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});
const NONE={me:{},ga:{state:'off',sites:[],when:'',end:Date.now()},money:{state:'off'},needs:{rows:[],total:0,today:0},news:{state:'off',stories:[],topics:[],all:[]},made:{state:'off',shown:[],perDay:[],ais:[],counts:{},total:0},
  goals:{state:'empty',levels:[],week:0},clients:{on:[],found:[],skipped:[]},hero:{lede:'',since:[],first:null},brief:{squares:[],seconds:0,real:0}};
let D=await getJSON('ui').catch(()=>null)||NONE,dataSig='';
const sigOf=d=>JSON.stringify(Object.assign({},d,{now:0}));
/* The names the screens read. applyData() fills them from the bundle, at start and after every refresh. */
let BRIEF=[],SINCE=[],NEEDS=[],REV=[],PACE=0,RMAX=1,GOALS=[],ANY=false,LEDE='';
const RC=['var(--ice)','var(--violet)','var(--gold)'];
const short=n=>n>=1e6?(n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')+'M':n>=1e4?Math.round(n/1e3)+'k':n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,'')+'k':String(Math.round(n));
function applyData(){dataSig=sigOf(D);BRIEF=D.brief.squares;SINCE=D.hero.since;NEEDS=D.needs.rows;LEDE=D.hero.lede;
  ANY=!!(BOOT.workspace&&BOOT.workspace.tools&&BOOT.workspace.tools.length)||D.ga.state==='ok'||D.money.state==='ok';
  const M=D.money;REV=M.state==='ok'?M.months:[];PACE=M.state==='ok'&&M.pace?M.pace:0;RMAX=Math.max(1,PACE,...REV.map(m=>m[1]))*1.08;
  GOALS=D.goals.levels;loadSites()}
/* Ask for fresh data. The screens are only drawn again when something really changed. */
let refreshing=null,lastFetch=Date.now();
function refresh(force){if(refreshing)return refreshing;lastFetch=Date.now();
  return refreshing=getJSON('ui').then(d=>{refreshing=null;if(!force&&sigOf(d)===dataSig){D=d;return false}D=d;applyData();remount();return true}).catch(()=>{refreshing=null;return false})}
addEventListener('focus',()=>{if(Date.now()-lastFetch>20000)refresh()});
setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastFetch>120000)refresh()},30000);
