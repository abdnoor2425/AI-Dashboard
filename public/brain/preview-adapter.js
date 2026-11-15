/* Keystone's local API adapter for the MIT AIS-OS renderer. No sample data. */
const nativeFetch = window.fetch.bind(window);
const scope = new URLSearchParams(location.search);
const workspaceId = scope.get('workspaceId') || '';
const project = scope.get('project') || '';
const palette = ['#77dccd','#f1b96b','#b69aef','#f180b8','#d5dc7e','#87baf1'];
const send = message => { if (parent !== window) parent.postMessage(message, location.origin); };
let raw, model, instance;
const api = (action = '', id = '') => '/api/brain?' + new URLSearchParams({ workspaceId, ...(action ? { action, id } : {}) });
const rawPromise = nativeFetch(api()).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Could not load knowledge'); raw = b; return b; });
function makeModel(b) {
  const available = b.nodes.filter(n => !project || n.sourceId === project);
  const categories = [...new Set(available.filter(n => n.kind !== 'folder').map(n => project ? (n.extension || 'Other files') : n.sourceId))];
  const sources = [{ id: 'folders', label: 'Folders', color: '#53adff', blurb: 'Folders in the central blue core' }, ...categories.map((id,i) => ({id,label:project ? id : b.sources.find(s=>s.id===id)?.name || id,color:palette[i%palette.length],blurb:'Connected local files'}))];
  const nodes = available.map(n => ({...n, title:n.name, source:n.kind==='folder'?'folders':project?(n.extension||'Other files'):n.sourceId, relativePath:n.path, slug:n.id, folder:n.path, updated:n.modifiedAt, words:0, degree:0, flags:[],broken:[],summary:n.readable?'Indexed text file':'File metadata',tags:[]}));
  const ids = new Set(nodes.map(n=>n.id));
  const links = b.links.filter(l=>ids.has(l.source)&&ids.has(l.target));
  const byId=new Map(nodes.map(n=>[n.id,n]));for(const l of links){byId.get(l.source).degree++;byId.get(l.target).degree++;}
  const bySource={};for(const s of sources){const items=nodes.filter(n=>n.source===s.id);bySource[s.id]={...s,root:'Connected project',count:items.length,kinds:{files:items.length},words:0,flagged:0};}
  return {brain:{name:'Second Brain'},nodes,links,sources,warnings:[],inventory:{bySource,totals:{nodes:nodes.length,links:links.length,words:0},flags:{},navigation:[],hubs:[]}};
}
window.fetch = async (url, options) => {
  const u=new URL(url,location.href);
  if(u.pathname==='/api/graph'){model=makeModel(await rawPromise);return new Response(JSON.stringify(model));}
  if(u.pathname==='/api/node'){
    const id=u.searchParams.get('id');
    if(!model?.nodes.some(n=>n.id===id))return new Response(JSON.stringify({error:'Outside selected project'}),{status:403});
    const r=await nativeFetch(api('node',id));const b=await r.json();return new Response(JSON.stringify({markdown:b.content||'',path:b.node?.path||''}),{status:r.status});
  }
  if(u.pathname==='/api/reveal')return new Response('{}',{status:405});
  return nativeFetch(url,options);
};
function layout(nodes) {
  const folders=nodes.filter(n=>n.kind==='folder'),files=nodes.filter(n=>n.kind!=='folder');
  folders.forEach((n,i)=>{const y=1-2*(i+.5)/folders.length,a=i*2.399963,r=8+20*((i*.618)%1);n.x=n.fx=Math.cos(a)*Math.sqrt(1-y*y)*r;n.y=n.fy=y*r;n.z=n.fz=Math.sin(a)*Math.sqrt(1-y*y)*r;});
  files.forEach((n,i)=>{
    if(project){const ring=Math.floor(i/24),a=(i%24)/24*Math.PI*2+ring*.23,r=300+Math.min(ring,12)*18;n.x=n.fx=Math.cos(a)*r;n.y=n.fy=Math.sin(a)*r*.8;n.z=n.fz=Math.sin(a*2+ring)*55+ring*5;}
    else {const y=1-2*(i+.5)/files.length,a=i*2.399963,r=330+45*((i*.754877)%1);n.x=n.fx=Math.cos(a)*Math.sqrt(1-y*y)*r;n.y=n.fy=y*r;n.z=n.fz=Math.sin(a)*Math.sqrt(1-y*y)*r;}
  });
}
function select(n){if(!n)return;instance.select(n.id);send({type:'brain-select',node:raw.nodes.find(item=>item.id===n.id)});}
let elapsed=0;
const ready=setInterval(()=>{
  if(window.__brain){
    clearInterval(ready);instance=window.__brain;layout(instance.data.nodes);instance.graph.graphData(instance.data);
    // Structural connections originate inside the blue folder core. Explicit
    // reference edges remain available when a user focuses a selected node.
    instance.graph.linkVisibility(l=>l.kind==='contains');
    instance.graph.onNodeClick(select);
    instance.graph.cameraPosition({x:0,y:35,z:project?850:1050},{x:0,y:0,z:0},0);
    setTimeout(()=>instance.graph.cameraPosition({x:0,y:35,z:project?900:1050},{x:0,y:0,z:0},0),350);
    send({type:'brain-ready'});
  } else if((elapsed+=100)>20000){clearInterval(ready);send({type:'brain-error',message:'Could not render the graph. Use the Files view.'});}
},100);
rawPromise.catch(e=>{clearInterval(ready);send({type:'brain-error',message:e.message});});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='brain-command'||!instance)return;
  const m=e.data;
  if(m.action==='pause'){const btn=document.getElementById('btn-rotate');if((btn.getAttribute('aria-pressed')==='true')===Boolean(m.paused))btn.click();}
  else if(m.action==='select')select(instance.data.nodes.find(n=>n.id===m.id));
  else if(m.action==='reset'){document.getElementById('btn-reset').click();instance.graph.linkVisibility(l=>l.kind==='contains');}
  else if(m.action==='growth')document.getElementById('btn-demo').click();
});
const originalReplace=history.replaceState.bind(history);
history.replaceState=(state,unused,url)=>{if(url){const next=new URL(url,location.href);next.searchParams.set('workspaceId',workspaceId);if(project)next.searchParams.set('project',project);return originalReplace(state,unused,next);}return originalReplace(state,unused,url);};
document.addEventListener('keydown',e=>{if(['/','d','D','c','C'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}},true);


