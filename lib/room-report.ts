// Decision Room: the report. One self-contained page of eight A4 sheets, written so a person who joined this week can follow it.
// The same page is read on screen and printed to PDF, so the two can never disagree.
import { BANDS, SOURCES, bandOf, optionScore, seatOf, shortRole, type Band, type Fact } from "./room.ts";

const CSS = `@page{size:A4;margin:0}
:root{--paper:#FBFAF7;--ink:#14151A;--ink2:#4A4D57;--ink3:#8A8D97;--line:#E6E2DA;--line2:#D3CEC3;--gold:#A8690F;--goldbg:#F6EBD6;--mint:#0E8C60;--mintbg:#E2F3EC;--bad:#C0392B;--badbg:#F9E6E3;--ice:#1D7FBF;--violet:#6C4FD6;--ember:#D8622B;
 --sans:"Geist","Inter",system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace;--serif:"Instrument Serif",Georgia,serif}
*{box-sizing:border-box}
html,body{margin:0;background:#DAD7D0}
body{font:400 10.4pt/1.5 var(--sans);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:210mm;height:297mm;padding:17mm 18mm 15mm;position:relative;background:var(--paper);overflow:hidden;page-break-after:always;display:flex;flex-direction:column}
.hd{display:flex;align-items:center;gap:8px;font:500 7.4pt var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);padding-bottom:5mm;border-bottom:.3mm solid var(--line);margin-bottom:8mm}
.hd .logo{width:6.4mm;height:6.4mm;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;font:600 8pt var(--sans);letter-spacing:0}
.hd b{color:var(--ink);font-weight:500}.hd span{flex:1}
.ft{margin-top:auto;padding-top:4mm;border-top:.3mm solid var(--line);display:flex;font:400 7.2pt var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.ft span{flex:1}
.ey{font:500 7.6pt var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:0 0 3mm}
h1{font:500 30pt/1.02 var(--sans);letter-spacing:-.045em;margin:0;text-wrap:balance}
h2{font:500 21pt/1.05 var(--sans);letter-spacing:-.04em;margin:0 0 2mm;text-wrap:balance}
h2 em,h1 em,.stamp em{font:italic 400 1.06em var(--serif);letter-spacing:-.01em;color:var(--gold)}
h3{font:600 10.6pt/1.3 var(--sans);letter-spacing:-.01em;margin:0 0 1.6mm}
p{margin:0 0 2.6mm}
.lede{font:italic 400 14pt/1.34 var(--serif);color:var(--ink2);margin:0 0 7mm;max-width:150mm}
.c{font:500 6.6pt var(--mono);color:var(--gold);background:var(--goldbg);border-radius:1mm;padding:.2mm 1.2mm;vertical-align:1.2pt;margin-left:.6mm;white-space:nowrap;letter-spacing:0}
.box{border:.3mm solid var(--line2);border-radius:3.6mm;padding:5mm 5.6mm;background:#fff}
.box.gold{background:var(--goldbg);border-color:#E3CFA5}
.box.mint{background:var(--mintbg);border-color:#BFE0D2}
.box.bad{background:var(--badbg);border-color:#EBC5BF}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.mt{margin-top:6mm}.mts{margin-top:4mm}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{font:500 6.8pt var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);text-align:left;padding:0 2mm 2mm 0;border-bottom:.3mm solid var(--line2)}
td{padding:2.1mm 2mm 2.1mm 0;border-bottom:.25mm solid var(--line);vertical-align:top}
td.n,th.n{text-align:right;padding-right:0;font-variant-numeric:tabular-nums}
ol,ul{margin:0;padding-left:5mm}li{margin-bottom:1.8mm}
.num{font:500 9pt var(--mono);color:var(--gold)}
.big{font:500 44pt/1 var(--sans);letter-spacing:-.06em}
.mut{color:var(--ink2)}.sm{font-size:8.6pt;line-height:1.45}.xs{font-size:7.8pt;line-height:1.45;color:var(--ink3)}
.dot{display:inline-block;width:2mm;height:2mm;border-radius:50%;margin-right:1.6mm;vertical-align:.2mm}
/* cover */
.cover{padding-top:20mm}
.cover .hd{border:0;margin-bottom:26mm}
.stamp{margin-top:18mm;padding:9mm 9mm 8mm;border-radius:5mm;background:var(--ink);color:#F5F3EF;position:relative;overflow:hidden}
.stamp::after{content:"";position:absolute;inset:0;background:radial-gradient(90mm 50mm at 100% 0,rgba(235,197,124,.28),transparent 70%),radial-gradient(70mm 50mm at 0 100%,rgba(138,212,255,.14),transparent 70%)}
.stamp>*{position:relative;z-index:1}
.stamp .ey{color:#EBC57C}
.stamp b{display:block;font:500 40pt/1 var(--sans);letter-spacing:-.055em}.stamp em{color:#EBC57C}
.stamp p{font:400 13pt/1.42 var(--sans);letter-spacing:-.015em;margin:6mm 0 0;max-width:140mm;color:#E9E6DF}
.band{position:relative;height:3mm;border-radius:2mm;background:rgba(255,255,255,.14);margin-top:8mm}
.band i{position:absolute;left:0;top:0;bottom:0;border-radius:2mm;background:linear-gradient(90deg,#EBC57C,#FF9A6B 50%,#8AD4FF)}
.band u{position:absolute;top:-1.4mm;bottom:-1.4mm;width:.3mm;background:rgba(255,255,255,.45)}
.bandk{display:flex;justify-content:space-between;font:400 6.8pt var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#A9AAB2;margin-top:2.6mm}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm 8mm;margin-top:12mm}
.meta div{border-top:.3mm solid var(--line2);padding-top:2.4mm}
.meta small{display:block;font:500 6.8pt var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:1mm}
.meta b{font-weight:500;font-size:10.6pt;letter-spacing:-.01em}
.new{margin-top:auto;display:flex;gap:4mm;align-items:center;padding:4.4mm 5mm;border:.3mm dashed var(--line2);border-radius:3.6mm;font-size:9.6pt;color:var(--ink2);margin-bottom:6mm}
.new b{color:var(--ink)}
/* bars */
.bars{display:grid;gap:3.4mm}
.bar{display:grid;grid-template-columns:54mm 1fr 12mm;gap:4mm;align-items:center;font-size:9.4pt}
.bar .t{position:relative;height:3mm;border-radius:2mm;background:#ECE8E0}
.bar .t i{position:absolute;left:0;top:0;bottom:0;border-radius:2mm;background:#BDB8AD}
.bar.lead .t i{background:linear-gradient(90deg,#C98A2B,#E0683A 55%,#2F8FD0)}
.bar .t u{position:absolute;top:-1.2mm;bottom:-1.2mm;width:.25mm;background:#B9B4A8}
.bar b{font:500 13pt var(--sans);letter-spacing:-.04em;text-align:right}
.bar.lead{font-weight:600}
.opt .k{display:inline-grid;place-items:center;width:6.4mm;height:6.4mm;border-radius:1.8mm;background:var(--ink);color:#fff;font:500 8pt var(--mono);margin-bottom:3mm}
.opt.lead{border-color:var(--gold);box-shadow:0 0 0 .5mm var(--goldbg)}
.opt .sc{font:500 24pt/1 var(--sans);letter-spacing:-.05em;margin:3mm 0 1mm}
.tagv{display:inline-block;font:500 6.6pt var(--mono);letter-spacing:.14em;text-transform:uppercase;padding:.8mm 2mm;border-radius:3mm;border:.25mm solid var(--line2);color:var(--ink2)}
.tagv.g{color:var(--gold);border-color:#E3CFA5;background:var(--goldbg)}
.fig{padding:4.2mm 5mm}
.tight td{padding-top:1.6mm;padding-bottom:1.6mm}.tight .lede{margin-bottom:5mm}
.fig .v{font:500 22pt/1 var(--sans);letter-spacing:-.05em;margin:1mm 0}
.fig svg{display:block;width:100%;height:21mm;margin-top:3mm}
.fig .cap{font-size:8.2pt;color:var(--ink2);line-height:1.4;margin-top:2.4mm}
.fig .src{font:500 6.6pt var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.q{font:italic 400 15pt/1.32 var(--serif);margin:0}
.step{display:grid;grid-template-columns:8mm 1fr 22mm 24mm;gap:3mm;align-items:baseline;padding:2.6mm 0;border-bottom:.25mm solid var(--line);font-size:9.6pt}
.step i{font:500 8pt var(--mono);color:var(--gold);font-style:normal}
.step b{font-weight:600}
.seat{display:inline-grid;place-items:center;width:6mm;height:6mm;border-radius:50%;background:var(--ink);color:#fff;font:500 6pt var(--mono);margin-right:2mm;vertical-align:-1.2mm}
.fig h4{font:600 9.4pt/1.3 var(--sans);margin:1.4mm 0 0}
.src table{font-size:8.3pt}.src td{padding-top:1.7mm;padding-bottom:1.7mm}.src td:nth-child(5){white-space:nowrap}
.src.many table{font-size:7.5pt}.src.many td{padding-top:1.1mm;padding-bottom:1.1mm}.src.many .hd{margin-bottom:5mm}.src.many .mt{margin-top:4mm}.src.many .box .sm{font-size:7.8pt}.src.many li{margin-bottom:1mm}
.note{margin-top:4mm;padding:3mm 4mm;border-radius:3mm;background:#F1EEE7;font-size:8.4pt;color:var(--ink2)}
@media screen{body{padding:8mm 0}.pg{margin:0 auto 8mm;box-shadow:0 6mm 18mm rgba(0,0,0,.18)}}`;

const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("en-GB", o);

export function reportHtml(s: any): string {
  const pack: Fact[] = s.pack || [], r = s.result, v = s.verdict, rep = s.report || { business: [], words: [], options: [] };
  const fact = (id: string) => pack.find((f) => f.id === id);
  /** Text with {E3} becomes the real value followed by its small gold code. */
  const tx = (t: any) => esc(t).replace(/\{(E\d+)\}/g, (_m, id) => { const f = fact(id); return f ? `${esc(f.value)}<span class="c">${id}</span>` : ""; });
  const seats: any[] = (s.seats || []).filter((x: any) => !(s.out || []).includes(x.key));
  const n = seats.length, word = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"][n] || String(n);
  const band = BANDS[r.band as Band], short = esc(rep.short || s.brief.title), day = date(s.at, { day: "numeric", month: "short", year: "numeric" });
  const again = date(v.again.on, { day: "numeric", month: "long", year: "numeric" });
  const L = (i: number) => "ABC"[i];
  const head = `<div class="hd"><i class="logo">${esc(String(s.biz || "A").trim().slice(0, 1).toUpperCase())}</i><b>${short}</b><span></span>${day}</div>`;
  const foot = (p: number) => `<div class="ft"><span>${esc(s.biz)} · Made with AI-Dashboard</span>Page ${p} of 8</div>`;
  const ticks = `<u style="left:45%"></u><u style="left:60%"></u><u style="left:75%"></u>`;
  const steps = (full: boolean) => v.next.map((x: any, i: number) => `<div class="step"${i ? "" : ` style="border-top:.3mm solid var(--line2)"`}><i>${i + 1}</i><span>${full ? `<b>${esc(x.step)}</b>` : esc(x.step)}</span><span>${esc(x.owner)}</span><span class="mut">by ${esc(x.by)}</span></div>`).join("");
  const stops = v.stops.length ? v.stops.map((x: any) => `<li>${esc(x.text)}${x.fact && fact(x.fact) ? ` Today ${esc(fact(x.fact)!.value)}<span class="c">${x.fact}</span>.` : ""}</li>`).join("") : "<li>The council named no stop sign. Use the look-again date.</li>";
  const used = (id: string) => { const re = new RegExp("\\{" + id + "\\}"), who = new Set<string>(); for (const x of seats) if (re.test(s.r1[x.key]?.say || "")) who.add(x.key); for (const m of s.r2 || []) if (re.test(m.say)) who.add(m.from); return [...who].map((k) => shortRole(seatOf(k)!)).join(", ") || "Background"; };
  const on = pack.filter((f) => f.on);
  const cited = (id: string) => JSON.stringify([s.r1, s.r2, s.verdict]).split("{" + id + "}").length - 1;
  const top = [...new Set([...v.decisive.map(fact), ...[...on].sort((a, b) => cited(b.id) - cited(a.id))])].filter(Boolean).slice(0, 6) as Fact[];
  const dot = (f: Fact) => ({ "--gold": "#C98A2B", "--ice": "#1D7FBF", "--mint": "#0E8C60", "--violet": "#6C4FD6", "--ember": "#D8622B", "--bad": "#C0392B", "--warn": "#C98A2B", "--text-3": "#8A8D97" } as any)[SOURCES[f.src]?.[1]] || "#8A8D97";
  const chart = (f: Fact) => {
    const a = (f.series || []).filter((x) => Number.isFinite(x));
    if (a.length < 3) return "";
    const max = Math.max(...a, 1), min = Math.min(...a, 0), pts = a.map((y, i) => `${((i / (a.length - 1)) * 300).toFixed(1)} ${(84 - ((y - min) / (max - min || 1)) * 74).toFixed(1)}`).join(" L");
    return `<svg viewBox="0 0 300 90" preserveAspectRatio="none"><path d="M${pts} V90 H0z" fill="${dot(f)}22"/><path d="M${pts}" fill="none" stroke="${dot(f)}" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>`;
  };
  const raw = Object.fromEntries(seats.map((x) => [x.key, s.r3[x.key].scores]));
  const kept = seats.filter((x) => s.r3[x.key].kept), out: string[] = s.out || [];
  const minor = seatOf(v.minority.seat)!;
  const pages = [
    `<section class="pg cover">
 <div class="hd"><i class="logo">${esc(String(s.biz || "A").trim().slice(0, 1).toUpperCase())}</i><b>${esc(s.biz)}</b><span></span>Decision report</div>
 <p class="ey">The question</p>
 <h1>${esc(s.brief.title)}</h1>
 <div class="stamp"><p class="ey">The verdict</p><b>${band.a} <em>${band.b}</em></b>
  <p>${tx(v.call)}</p>
  <div class="band"><i style="width:${r.score * 10}%"></i>${ticks}</div>
  <div class="bandk"><span>Score ${r.score.toFixed(1)} of 10</span><span>${band.means}</span></div></div>
 <div class="meta">
  <div><small>Decided</small><b>${date(s.at, { day: "numeric", month: "long", year: "numeric" })}</b></div><div><small>Asked by</small><b>${esc(s.owner)}</b></div><div><small>Look again</small><b>${again}</b></div>
  <div><small>Council</small><b>${s.mode === "quick" ? "Quick" : "Full"}. ${n} seats, ${s.mode === "quick" ? 2 : 3} rounds.</b></div><div><small>Agreement</small><b>${r.agree} of ${r.voted} seats</b></div><div><small>Run on</small><b>${esc(s.ai)}, ${esc(s.owner)}'s own plan</b></div></div>
 <div class="new"><span><b>New here?</b> Read page 2 first. It tells you what was decided, why, and what happens next. The rest is there when you need the detail.</span></div>
 <div class="ft"><span>Made with AI-Dashboard</span>Page 1 of 8</div>
</section>`,
    `<section class="pg">${head}
 <p class="ey">If you read one page</p><h2>What was decided, <em>and why.</em></h2>
 <div class="box gold mts"><h3>The decision</h3><p style="margin:0;font-size:11.4pt;line-height:1.5">${tx(v.call)}</p></div>
 <div class="g3 mt">${v.why.map((w: any, i: number) => `<div class="box"><span class="num">0${i + 1}</span><h3 style="margin-top:2mm">${esc(w.head)}</h3><p class="sm mut" style="margin:0">${tx(w.text)}</p></div>`).join("")}</div>
 <div class="mt"><h3>What happens next</h3>${steps(false)}</div>
 <div class="g2 mt">
  <div class="box bad"><h3>We stop and think again if</h3><ul class="sm" style="margin:0">${stops}</ul></div>
  <div class="box mint"><h3>What it is worth</h3><p class="sm" style="margin:0">${v.money ? tx(v.money) : "The evidence held no money figure for this decision, so the council put no sum on it."}</p></div></div>
 <p class="xs mts">The small gold codes, such as <span class="c" style="margin:0">E1</span>, point to the source of each number. The full list is on page 8. Questions about this decision go to ${esc(s.owner)}.</p>
 ${foot(2)}
</section>`,
    `<section class="pg">${head}
 <p class="ey">Background</p><h2>If you are new, <em>start here.</em></h2>
 <p class="lede">Nothing below assumes you know the business.</p>
 <div class="g2">
  <div><h3>The business in a few lines</h3>${rep.business.length ? `<ol class="sm">${rep.business.map((t: string) => `<li>${tx(t)}</li>`).join("")}</ol>` : `<p class="sm">${esc(s.biz)} is the business this dashboard belongs to. ${esc(s.owner)} runs it.</p>`}</div>
  <div><h3>What led to the question</h3><p class="sm">${rep.led ? tx(rep.led) : tx(s.brief.stake)}</p><p class="sm">${esc(s.owner)} asked: "${esc(s.q)}"</p></div></div>
 <div class="mt"><h3>Words used in this report</h3>
 <table><tr><th style="width:44mm">Word</th><th>What it means here</th></tr>
  ${rep.words.map((w: any) => `<tr><td><b>${esc(w.word)}</b></td><td>${esc(w.means)}</td></tr>`).join("")}
  <tr><td><b>The council</b></td><td>${word} AI advisors inside the dashboard. Each studies the decision from one angle, then they vote.</td></tr>
  <tr><td><b>A seat</b></td><td>One advisor on the council. For example, ${esc(seatOf(seats[0].key)!.role)} asks: ${esc(seatOf(seats[0].key)!.q)}</td></tr>
  <tr><td><b>The Chair</b></td><td>The AI that runs the meeting. It never takes a side.</td></tr>
  <tr><td><b>E1, E2 and so on</b></td><td>Evidence codes. Each one marks a number and where it came from. See page 8.</td></tr></table></div>
 ${foot(3)}
</section>`,
    `<section class="pg">${head}
 <p class="ey">The options</p><h2>Three choices were <em>on the table.</em></h2>
 <p class="lede">The council always includes the choice to do nothing.</p>
 <div class="g3">${s.brief.options.map((o: any, i: number) => `<div class="box opt${i === r.rec ? " lead" : ""}"><span class="k">${L(i)}</span><h3>${esc(o.title)}</h3><p class="sm mut">${esc(o.detail)}</p><div class="sc">${r.scores[i].toFixed(1)}</div><span class="tagv${i === r.rec ? " g" : ""}">${i === r.rec ? band.label : BANDS[bandOf(r.scores[i])].label}</span>
   ${rep.options[i]?.best ? `<p class="sm mts"><b>Best argument.</b> ${tx(rep.options[i].best)}</p>` : ""}${rep.options[i]?.risk ? `<p class="sm" style="margin:0"><b>Biggest risk.</b> ${tx(rep.options[i].risk)}</p>` : ""}</div>`).join("")}</div>
 <div class="box mt"><h3>The scores, side by side</h3>
  <div class="bars mts">${s.brief.options.map((o: any, i: number) => `<div class="bar${i === r.rec ? " lead" : ""}"><span>${L(i)} · ${esc(o.title)}</span><span class="t"><i style="width:${r.scores[i] * 10}%"></i>${ticks}</span><b>${r.scores[i].toFixed(1)}</b></div>`).join("")}</div></div>
 <div class="g2 mt"><div><h3>How a score is made</h3><ol class="sm"><li>Each seat scores every option out of 10.</li><li>A heavier seat counts for more. Weights run from 1 to 3.</li><li>The dashboard adds it up. The AI never does the sum.</li></ol></div>
  <div><h3>What a score means</h3><table class="sm"><tr><td><b>7.5 and above</b></td><td>Go</td></tr><tr><td><b>6.0 to 7.4</b></td><td>Go, with conditions</td></tr><tr><td><b>4.5 to 5.9</b></td><td>Reshape the idea first</td></tr><tr><td><b>Below 4.5</b></td><td>Don't do it</td></tr></table></div></div>
 ${r.caps.length || r.band === "wait" ? `<div class="note">${esc([...r.caps, r.band === "wait" ? "The council scored changing nothing highest, so the verdict is to wait." : ""].filter(Boolean).join(" "))}</div>` : ""}
 ${foot(4)}
</section>`,
    `<section class="pg">${head}
 <p class="ey">The numbers we used</p><h2>${top.length ? `${["", "One fact", "Two facts", "Three facts", "Four facts", "Five facts", "Six facts"][top.length]} carried <em>the decision.</em>` : `What the council <em>could see.</em>`}</h2>
 <p class="lede">${top.length ? "Each one was read from a connected tool or a file. None was typed in by the AI." : "No numbers were shared with the council for this decision, so it reasoned from the question alone."}</p>
 <div class="g2">${top.map((f) => `<div class="box fig"><span class="src"><i class="dot" style="background:${dot(f)}"></i>${esc(SOURCES[f.src]?.[0] || f.src)} · ${f.id}</span><div class="v">${esc(f.value)}</div><h4>${esc(f.what)}</h4>${chart(f)}<p class="cap">${esc([f.period, f.note].filter(Boolean).join(". ").replace(/\.\./g, "."))}</p></div>`).join("")}</div>
 ${foot(5)}
</section>`,
    `<section class="pg tight">${head}
 <p class="ey">How the council argued</p><h2>Who sat, and <em>how they voted.</em></h2>
 <p class="lede">${word} AI advisors. Each one studies the decision through a single question.</p>
 <table><tr><th>Seat</th><th>The question it asks</th><th class="n">Weight</th><th class="n">A</th><th class="n">B</th><th class="n">C</th></tr>
  ${seats.map((x) => { const st = seatOf(x.key)!; return `<tr><td><i class="seat">${st.ini}</i><b>${shortRole(st)}</b></td><td>${esc(st.q)}</td><td class="n">${x.weight}</td>${raw[x.key].map((sc: number, i: number) => `<td class="n">${i === r.rec ? `<b>${sc}</b>` : sc}</td>`).join("")}</tr>`; }).join("")}
  <tr><td colspan="3"><b>Weighted score</b></td>${[0, 1, 2].map((i) => `<td class="n"><b${i === r.rec ? ` style="color:var(--gold)"` : ""}>${optionScore(seats, raw, i).toFixed(1)}</b></td>`).join("")}</tr></table>
 ${(s.cruxes || []).length ? `<div class="mt"><h3>${s.cruxes.length === 1 ? "The real disagreement" : "The two real disagreements"}</h3>
 <div class="g2">${s.cruxes.map((c: any, i: number) => `<div class="box"><span class="num">0${i + 1}</span><p style="margin:2mm 0;font-weight:600">${esc(c.q)}</p><p class="sm mut">${esc(seatOf(c.a)!.role)} and ${esc(seatOf(c.b)!.role)} saw it differently.</p><p class="sm" style="margin:0"><b>Settled.</b> ${c.settled ? tx(c.settled) : "The vote settled it."}</p></div>`).join("")}</div></div>`
      : `<div class="box mt"><h3>The resolution the council voted on</h3><p class="sm" style="margin:0">${tx(s.draft.text)}</p></div>`}
 <div class="box gold mt"><p class="ey" style="margin-bottom:2mm">The minority view</p><p class="q">"${esc(v.minority.quote)}"</p><p class="xs" style="margin:2.4mm 0 0;color:var(--ink2)">${esc(minor.role)} voted ${v.minority.score} of 10. It did not block the decision. Every report keeps the strongest argument against the verdict.</p></div>
 ${out.length || kept.length ? `<div class="note">${esc([out.length ? `${out.map((k) => seatOf(k)!.role).join(" and ")} did not answer and sat out. The score was worked out from the seats that did.` : "", kept.length ? `${kept.map((x) => seatOf(x.key)!.role).join(" and ")} could not be reached for the final vote, so its opening scores were kept.` : ""].filter(Boolean).join(" "))}</div>` : ""}
 ${foot(6)}
</section>`,
    `<section class="pg">${head}
 <p class="ey">What happens next</p><h2>The plan, <em>step by step.</em></h2>
 <p class="lede">Who does what, by when, and how we will know if it is going wrong.</p>
 <h3>${["", "One step", "Two steps", "Three steps"][v.next.length] || "The steps"}</h3>
 ${steps(true)}
 <div class="g2 mt">
  <div class="box mint"><h3>Conditions</h3><ol class="sm" style="margin:0">${v.conditions.map((c: string) => `<li>${tx(c)}</li>`).join("") || "<li>None were set.</li>"}</ol></div>
  <div class="box bad"><h3>Stop and think again if</h3><ul class="sm" style="margin:0">${stops}</ul></div></div>
 <div class="g2 mt">
  <div><h3>What would change this verdict</h3><ul class="sm">${v.change.map((c: string) => `<li>${tx(c)}</li>`).join("") || "<li>Nothing was named.</li>"}</ul></div>
  <div><h3>What it will not do</h3><p class="sm">${rep.wont ? tx(rep.wont) : "This decision settles one question. It does not replace the goals for the quarter."}</p></div></div>
 <div class="box mt" style="display:flex;gap:6mm;align-items:center"><div class="big" style="font-size:30pt;white-space:nowrap">${date(v.again.on, { day: "numeric", month: "short" })}</div><div><h3 style="margin:0">We look again on ${again}.</h3><p class="sm mut" style="margin:1mm 0 0">${esc(v.again.text)} On that day the dashboard asks ${esc(s.owner)} whether this worked. The answer is kept with this report.</p></div></div>
 ${foot(7)}
</section>`,
    `<section class="pg src${pack.length > 12 ? " many" : ""}">${head}
 <p class="ey">Sources, method and limits</p><h2>What the decision <em>stands on.</em></h2>
 <table class="mts"><colgroup><col style="width:9mm"><col><col style="width:27mm"><col style="width:27mm"><col style="width:19mm"><col style="width:30mm"></colgroup><tr><th>Id</th><th>What it is</th><th>Where from</th><th>Covers</th><th>How fresh</th><th>Used by</th></tr>
  ${pack.slice(0, 24).map((f) => `<tr${f.on ? "" : ` style="color:var(--ink3)"`}><td class="num">${f.id}</td><td><b>${esc(f.what)}${f.on ? ":" : ""}</b> ${f.on ? esc(f.value) : "Not read"}</td><td>${esc(SOURCES[f.src]?.[0] || f.src)}</td><td>${esc(f.period)}</td><td>${f.on ? esc(f.age === "Live" || f.age === "Just now" ? f.age : f.age + " old") : "Switched off"}</td><td>${f.on ? used(f.id) : ""}</td></tr>`).join("")}</table>
 <div class="g3 mt">
  <div class="box" style="padding:4mm"><h3>What the council could not see</h3><ul class="sm" style="margin:0">${(s.gaps || []).slice(0, 4).map((g: string) => `<li>${esc(g)}</li>`).join("") || "<li>Nothing it asked for was missing.</li>"}</ul></div>
  <div class="box" style="padding:4mm"><h3>What was shared with the AI</h3><ul class="sm" style="margin:0"><li>${on.length} fact${on.length === 1 ? "" : "s"}, listed above</li><li>${s.shared?.excerpts || 0} file excerpt${s.shared?.excerpts === 1 ? "" : "s"}${s.shared?.words ? `, ${s.shared.words} words` : ""}</li><li>${s.shared?.attach || 0} attached file${s.shared?.attach === 1 ? "" : "s"}</li><li style="margin:0">No mail bodies. No passwords.</li></ul></div>
  <div class="box" style="padding:4mm"><h3>How the checks work</h3><ul class="sm" style="margin:0"><li>Scores are added up by code.</li><li>${s.checks?.cites || 0} source codes were matched to the evidence by code.</li><li style="margin:0">${s.checks?.dropped ? `${s.checks.dropped} that pointed at nothing ${s.checks.dropped === 1 ? "was" : "were"} removed.` : "None pointed at a missing source."}</li></ul></div></div>
 <p class="xs mt" style="margin-bottom:0"><b style="color:var(--ink2)">Method and limits.</b> The council is ${word.toLowerCase()} AI advisors and a Chair, run by AI-Dashboard on ${esc(s.owner)}'s own AI plan. They worked through ${s.mode === "quick" ? "two rounds: opening views and a vote" : "three rounds: opening views, a debate on the real disagreements, and a vote"}. The advisors are AI simulations. They are not people, and this report is not legal or financial advice. A source shows where a number came from. It does not prove the judgement built on it. A number without a gold code is the council's own sum. The council advises and the owner decides. The council format follows the open-source roast-room project.</p>
 ${foot(8)}
</section>`,
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Decision report: ${short}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
<style>${CSS}</style></head><body>
${pages.join("\n")}
</body></html>`;
}
