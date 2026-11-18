/* What the app already knows when the screens start: who is signed in, and which pages are on. */
let BOOT=(window.__AID&&window.__AID.boot)||{};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nn=i=>String(i+1).padStart(2,'0');
const hexA=(h,a)=>{const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const IC={
 overview:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
 needs:'<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17h.01"/>',
 news:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h10M7 17h5"/>',
 money:'<path d="M3 17l5.5-5.5 4 4L21 7"/><path d="M15 7h6v6"/>',
 goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
 web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
 social:'<rect x="5" y="3" width="14" height="18" rx="3.5"/><path d="M10.5 9.5l4.5 2.5-4.5 2.5z"/>',
 made:'<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><path d="M17 14v6M14 17h6"/>',
 brain:'<circle cx="12" cy="12" r="9"/><path d="M4.5 8.5c4.5 2 10.5 2 15 0M4.5 15.5c4.5-2 10.5-2 15 0"/>',
 team:'<circle cx="9" cy="8" r="3.2"/><circle cx="17.5" cy="10" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c.3-2.5 1.5-4.4 3.6-4.4 1.5 0 2.4.8 2.4.8"/>',
 plug:'<path d="M9 3v5M15 3v5M6.5 8h11v4a5.5 5.5 0 01-11 0zM12 17.5V21"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', upa:'<path d="M12 19V5M5 12l7-7 7 7"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus:'<path d="M12 5v14M5 12h14"/>',
 dawn:'<path d="M3 18.5h18M6.5 15a5.5 5.5 0 0111 0M12 3.5v4M4.6 9l1.9 1.9M19.4 9l-1.9 1.9M9.6 5.9L12 3.5l2.4 2.4"/>',
 day:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
 dusk:'<path d="M3 18.5h18M6.5 15a5.5 5.5 0 0111 0M12 7.5v-4M4.6 9l1.9 1.9M19.4 9l-1.9 1.9M9.6 5.1L12 7.5l2.4-2.4"/>',
 night:'<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
 sphere:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3.2 3 3.2 14 0 17M12 3.5c-3.2 3-3.2 14 0 17"/>',
 galaxy:'<path d="M12 12c0-3 2.5-5 5.5-4.5M12 12c3 0 5 2.5 4.5 5.5M12 12c0 3-2.5 5-5.5 4.5M12 12c-3 0-5-2.5-4.5-5.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
 more:'<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
 lobes:'<path d="M12 5.5c-1.2-2-4.6-2-5.6.4-2.3.3-3.2 3-1.8 4.6-1.3 1.7-.4 4.3 1.8 4.6.6 2.6 4.3 3 5.6.9M12 5.5c1.2-2 4.6-2 5.6.4 2.3.3 3.2 3 1.8 4.6 1.3 1.7.4 4.3-1.8 4.6-.6 2.6-4.3 3-5.6.9M12 5.5V16"/>'
};
const ic=(n,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const PLAY='<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>';
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),2200)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-toast]');if(b){toast(b.dataset.toast)}});
function rng(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>(s=s*16807%2147483647)/2147483647}
