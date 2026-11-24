// Decision Room: the answer. Page one is always the whole decision: the answer, why, an example, what to do and when to stop.
// What follows is only what the question needs: the choices compared for a Full council, then every reference.
// The same page is read on screen and printed to PDF, and the same words are saved as a plain file an AI can read.
import { BANDS, SOURCES, bandOf, optionScore, seatOf, shortRole, type Band, type Fact } from "./room.ts";

const CSS = `@page{size:A4;margin:15mm 0 16mm}
:root{--paper:#FBFAF7;--ink:#14151A;--ink2:#4A4D57;--ink3:#8A8D97;--line:#E6E2DA;--line2:#D3CEC3;--gold:#A8690F;--goldbg:#F6EBD6;--mint:#0E8C60;--mintbg:#E2F3EC;--bad:#C0392B;--badbg:#F9E6E3;
 --sans:"Geist","Inter",system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace;--serif:"Instrument Serif",Georgia,serif}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;font:400 10.2pt/1.5 var(--sans);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{padding:0 18mm;background:var(--paper)}
.pg+.pg{break-before:page;page-break-before:always}
.hd{display:flex;align-items:center;gap:8px;font:500 7.4pt var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);padding-bottom:4mm;border-bottom:.3mm solid var(--line);margin-bottom:7mm}
.hd .logo{width:6.4mm;height:6.4mm;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;font:600 8pt var(--sans);letter-spacing:0}
.hd b{color:var(--ink);font-weight:500}.hd span{flex:1}
.ey{font:500 7.6pt var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:0 0 2mm}
.ask{color:var(--ink2);font-size:9.6pt;margin:0 0 5mm}
h1{font:400 27pt/1.04 var(--serif);letter-spacing:-.015em;margin:0;text-wrap:balance}
h2{font:400 21pt/1.06 var(--serif);letter-spacing:-.01em;margin:0 0 5mm;text-wrap:balance}
h3{font:600 9.4pt/1.3 var(--sans);letter-spacing:.01em;margin:6.5mm 0 2.2mm;break-after:avoid}
p{margin:0 0 2.4mm}
.verd{display:inline-flex;align-items:center;gap:2mm;font:600 8.4pt var(--sans);padding:1.4mm 3.2mm;border-radius:6mm;margin-top:4mm;background:var(--goldbg);color:#7A4A06}
.verd::before{content:"";width:1.8mm;height:1.8mm;border-radius:50%;background:currentColor}
.verd.go{background:var(--mintbg);color:#0A6A48}.verd.no{background:var(--badbg);color:#9A2A1F}.verd.reshape,.verd.wait{background:#ECE8E0;color:var(--ink2)}
.call{font-size:12.4pt;line-height:1.42;letter-spacing:-.01em;margin:4mm 0 0;max-width:160mm}
.c{font:500 6.6pt var(--mono);color:var(--gold);background:var(--goldbg);border-radius:1mm;padding:.2mm 1.2mm;vertical-align:1.6pt;margin-left:.7mm;white-space:nowrap;letter-spacing:0;line-height:1}
.why{display:grid;gap:2.2mm}
.why div{display:grid;grid-template-columns:7mm 1fr;break-inside:avoid}
.why i{font:400 15pt/1 var(--serif);color:var(--gold);font-style:normal}
.why p{margin:0}
.ex{background:#F3EEE3;border-left:.8mm solid var(--gold);border-radius:0 2mm 2mm 0;padding:3.4mm 4.4mm;break-inside:avoid}.ex p{margin:0}
.step{display:grid;grid-template-columns:1fr 26mm 30mm;gap:4mm;align-items:baseline;padding:2.3mm 0;border-bottom:.25mm solid var(--line);break-inside:avoid}
.step:first-of-type{border-top:.3mm solid var(--line2)}
.step b{font-weight:600}.step span{color:var(--ink2);font-size:9pt}.step span:last-child{text-align:right}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:7mm;break-inside:avoid}.g2 h3{margin-top:6.5mm}.g2 p,.g2 li{font-size:9.4pt}
ul{margin:0;padding-left:4.4mm}li{margin-bottom:1.2mm}
.sm{font-size:9pt;line-height:1.45}.mut{color:var(--ink2)}.xs{font-size:7.8pt;line-height:1.45;color:var(--ink3)}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{font:500 6.8pt var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);text-align:left;padding:0 2.4mm 2mm 0;border-bottom:.3mm solid var(--ink)}
td{padding:2.2mm 2.4mm 2.2mm 0;border-bottom:.25mm solid var(--line);vertical-align:top}
tr{break-inside:avoid}
td.k{font:400 14pt/1 var(--serif);color:var(--gold);width:8mm}
td.n,th.n{text-align:right;padding-right:0;font-variant-numeric:tabular-nums;white-space:nowrap}
td small{display:block;font:400 7.6pt var(--mono);color:var(--ink3);word-break:break-word;margin-top:.6mm}
tr.lead td{background:#F6F0E2}
.note{margin-top:4mm;padding:3mm 4mm;border-radius:2mm;background:#F1EEE7;font-size:8.6pt;color:var(--ink2);break-inside:avoid}
.end{margin-top:7mm;padding-top:3mm;border-top:.3mm solid var(--line)}
@media print{:root{--paper:#fff}}
@media screen{html{background:#DAD7D0}body{padding:8mm 0}.pg{width:210mm;max-width:100%;margin:0 auto 8mm;padding:16mm 18mm 15mm;box-shadow:0 6mm 18mm rgba(0,0,0,.18)}}
@media screen and (max-width:700px){.pg{padding:8mm 6mm}.g2{grid-template-columns:1fr}.step{grid-template-columns:1fr}.step span:last-child{text-align:left}}`;

const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("en-GB", o);
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const fresh = (f: Fact) => (f.age === "Live" || f.age === "Just now" ? f.age : f.age ? f.age + " old" : "");
const where = (f: Fact) => [f.path, f.period].filter(Boolean).join(" · ");

/** Everything the answer says, worked out once, so the page and the plain file can never disagree. */
export function answerOf(s: any) {
  const pack: Fact[] = s.pack || [], r = s.result, v = s.verdict, rep = s.report || {};
  const fact = (id: string) => pack.find((f) => f.id === id && f.on);
  const seats: any[] = (s.seats || []).filter((x: any) => !(s.out || []).includes(x.key));
  const full = s.mode !== "quick";
  // References are numbered in the order a reader meets them: page one first, then the choices.
  const order: string[] = [];
  const see = (t: any) => { for (const m of String(t ?? "").matchAll(/\{(E\d+)\}/g)) if (fact(m[1]) && !order.includes(m[1])) order.push(m[1]); };
  see(v.call); for (const w of v.why || []) see(w.text);
  see(v.example); see(v.money); for (const c of v.conditions || []) see(c);
  for (const x of v.stops || []) if (x.fact) see(`{${x.fact}}`);
  if (full) { for (const o of rep.options || []) { see(o?.best); see(o?.risk); } for (const c of v.change || []) see(c); }
  const refs = order.map((id, i) => ({ n: i + 1, f: fact(id)! }));
  const nOf = (id: string) => order.indexOf(id) + 1;
  const band = BANDS[r.band as Band];
  const answer = String(v.answer || "").trim() || `${band.a} ${band.b}`;
  const minor = seatOf(v.minority?.seat);
  return { pack, r, v, rep, seats, full, refs, nOf, fact, band, answer, minor, also: pack.filter((f) => f.on && !order.includes(f.id)), off: pack.filter((f) => !f.on) };
}

export function reportHtml(s: any): string {
  const A = answerOf(s), { r, v, rep, seats, full, refs, band } = A;
  /** Text with {E3} becomes the real value followed by the number of its reference. */
  const tx = (t: any) => esc(t).replace(/\{(E\d+)\}/g, (_m, id) => { const f = A.fact(id), n = A.nOf(id); return f ? `${esc(f.value)}${n ? `<sup class="c">${n}</sup>` : ""}` : ""; });
  const n = seats.length, short = esc(rep.short || s.brief.title), day = date(s.at, { day: "numeric", month: "short", year: "numeric" });
  const again = date(v.again.on, { day: "numeric", month: "long", year: "numeric" });
  const L = (i: number) => "ABC"[i];
  const head = `<div class="hd"><i class="logo">${esc(String(s.biz || "A").trim().slice(0, 1).toUpperCase())}</i><b>${esc(s.biz)}</b><span></span>Decision · ${day}</div>`;
  const out: string[] = s.out || [], kept = seats.filter((x) => s.r3[x.key]?.kept);
  const raw = Object.fromEntries(seats.map((x) => [x.key, s.r3[x.key].scores]));
  const stops = (v.stops || []).map((x: any) => `<li>${esc(x.text)}${x.fact && A.fact(x.fact) ? ` Today ${tx(`{${x.fact}}`)}.` : ""}</li>`).join("");
  const choices = `<table><tr><th></th><th>Choice</th>${full ? "<th>Best argument</th><th>Biggest risk</th>" : ""}<th class="n">Score</th></tr>
  ${s.brief.options.map((o: any, i: number) => `<tr${i === r.rec ? ` class="lead"` : ""}><td class="k">${L(i)}</td><td><b>${esc(o.title)}</b>${o.detail ? `<small style="font-family:var(--sans);font-size:8.4pt">${esc(o.detail)}</small>` : ""}</td>${full ? `<td>${tx(rep.options?.[i]?.best) || ""}</td><td>${tx(rep.options?.[i]?.risk) || ""}</td>` : ""}<td class="n">${i === r.rec ? `<b>${r.scores[i].toFixed(1)}</b>` : r.scores[i].toFixed(1)}</td></tr>`).join("")}</table>`;

  const pages = [
    `<section class="pg">${head}
 <p class="ask">The question: ${esc(s.q || s.brief.title)}</p>
 <p class="ey">The answer</p>
 <h1>${esc(A.answer)}</h1>
 <span class="verd ${r.band}">${esc(band.label)} · ${r.score.toFixed(1)} of 10 · ${n} seat${n === 1 ? "" : "s"}</span>
 <p class="call">${tx(v.call)}</p>
 ${v.why.length ? `<h3>Why</h3><div class="why">${v.why.map((w: any, i: number) => `<div><i>${i + 1}</i><p><b>${esc(w.head)}</b> ${tx(w.text)}</p></div>`).join("")}</div>` : ""}
 ${v.example ? `<h3>An example</h3><div class="ex"><p>${tx(v.example)}</p></div>` : ""}
 ${v.next.length ? `<h3>Do this</h3>${v.next.map((x: any) => `<div class="step"><b>${esc(x.step)}</b><span>${esc(x.owner)}</span><span>by ${esc(x.by)}</span></div>`).join("")}` : ""}
 ${v.money ? `<h3>What it is worth</h3><p class="sm">${tx(v.money)}</p>` : ""}
 <div class="g2">
  <div>${v.conditions.length ? `<h3>This holds only if</h3><ul>${v.conditions.map((c: string) => `<li>${tx(c)}</li>`).join("")}</ul>` : ""}<h3>Stop and think again if</h3>${stops ? `<ul>${stops}</ul>` : `<p>The council named no stop sign. Use the look-again date.</p>`}</div>
  <div><h3>Who disagreed</h3><p>${A.minor ? `${esc(A.minor.role)}, which voted ${v.minority.score} of 10: "${esc(v.minority.quote)}"` : "No seat argued against it."}</p><h3>Look again on ${again}</h3><p>${esc(v.again.text)}</p></div></div>
 <p class="xs end">${refs.length ? `The small numbers point to the references at the end. ` : ""}${full ? "The next page compares the choices. " : ""}Questions about this decision go to ${esc(s.owner)}.</p>
</section>`,
  ];

  if (full) pages.push(`<section class="pg">${head}
 <p class="ey">The choices</p><h2>${NUM[s.brief.options.length]} choices were on the table.</h2>
 ${choices}
 ${r.caps.length || r.band === "wait" ? `<div class="note">${esc([...r.caps, r.band === "wait" ? "The council scored changing nothing highest, so the verdict is to wait." : ""].filter(Boolean).join(" "))}</div>` : ""}
 <h3>How the seats voted</h3>
 <table><tr><th>Seat</th><th>The question it asks</th><th class="n">Weight</th>${s.brief.options.map((_o: any, i: number) => `<th class="n">${L(i)}</th>`).join("")}</tr>
  ${seats.map((x) => { const st = seatOf(x.key)!; return `<tr><td><b>${esc(shortRole(st))}</b></td><td>${esc(st.q)}</td><td class="n">${x.weight}</td>${raw[x.key].map((sc: number, i: number) => `<td class="n">${i === r.rec ? `<b>${sc}</b>` : sc}</td>`).join("")}</tr>`; }).join("")}
  <tr><td colspan="3"><b>Weighted score</b></td>${s.brief.options.map((_o: any, i: number) => `<td class="n"><b>${optionScore(seats, raw, i).toFixed(1)}</b></td>`).join("")}</tr></table>
 ${(s.cruxes || []).length ? `<h3>${s.cruxes.length === 1 ? "Where the seats disagreed" : "Where the seats disagreed"}</h3><ul class="sm">${s.cruxes.map((c: any) => `<li><b>${esc(c.q)}</b> ${esc(shortRole(seatOf(c.a)!))} and ${esc(shortRole(seatOf(c.b)!))} saw it differently. ${c.settled ? tx(c.settled) : "The vote settled it."}</li>`).join("")}</ul>` : ""}
 ${v.change.length ? `<h3>What would change this answer</h3><ul class="sm">${v.change.map((c: string) => `<li>${tx(c)}</li>`).join("")}</ul>` : ""}
 ${out.length || kept.length ? `<div class="note">${esc([out.length ? `${out.map((k) => seatOf(k)!.role).join(" and ")} did not answer and sat out. The score was worked out from the seats that did.` : "", kept.length ? `${kept.map((x) => seatOf(x.key)!.role).join(" and ")} could not be reached for the final vote, so its opening scores were kept.` : ""].filter(Boolean).join(" "))}</div>` : ""}
 <p class="xs end">Each seat scores every choice out of 10. A heavier seat counts for more. The dashboard adds it up, never the AI. ${esc(BANDS[bandOf(r.score)].means)}.</p>
</section>`);

  pages.push(`<section class="pg">${head}
 <p class="ey">References</p><h2>${refs.length ? "Where every number came from." : "What the answer stands on."}</h2>
 ${refs.length ? `<table><tr><th></th><th>What it says</th><th>Where it lives</th><th>How fresh</th></tr>
  ${refs.map(({ n: i, f }) => `<tr><td class="k">${i}</td><td><b>${esc(f.what)}:</b> ${esc(f.value)}${f.note ? `<small style="font-family:var(--sans);font-size:8.4pt">${esc(f.note)}</small>` : ""}</td><td>${esc(SOURCES[f.src]?.[0] || f.src)}${where(f) ? `<small>${esc(where(f))}</small>` : ""}</td><td>${esc(fresh(f))}</td></tr>`).join("")}</table>`
      : `<p>${A.pack.length ? "The answer cites no single number. The council reasoned from the facts listed below." : "No numbers were shared with the council for this decision, so it reasoned from the question alone."}</p>`}
 ${A.also.length ? `<h3>Also read by the council</h3><p class="sm mut">${A.also.slice(0, 30).map((f) => `${esc(f.what)}: ${esc(f.value)} (${esc(SOURCES[f.src]?.[0] || f.src)})`).join(" · ")}</p>` : ""}
 ${!full ? `<h3>The choices that were weighed</h3>${choices}${out.length ? `<div class="note">${esc(`${out.map((k) => seatOf(k)!.role).join(" and ")} did not answer and sat out. The score was worked out from the seats that did.`)}</div>` : ""}` : ""}
 <h3>What the council could not see</h3><ul class="sm">${[...(s.gaps || []).slice(0, 5), ...(A.off.length ? [`${A.off.length} source${A.off.length === 1 ? " was" : "s were"} switched off: ${A.off.slice(0, 6).map((f) => f.what).join(", ")}.`] : [])].map((g: string) => `<li>${esc(g)}</li>`).join("") || "<li>Nothing it asked for was missing.</li>"}</ul>
 ${(rep.words || []).length ? `<h3>If you are new here</h3><table>${rep.words.map((w: any) => `<tr><td style="width:44mm"><b>${esc(w.word)}</b></td><td>${esc(w.means)}</td></tr>`).join("")}</table>` : ""}
 ${rep.wont ? `<h3>What this decision does not do</h3><p class="sm">${tx(rep.wont)}</p>` : ""}
 <p class="xs end">${NUM[n] || n} AI advisors and a Chair, run by AI-Dashboard on ${esc(s.owner)}'s own ${esc(s.ai)} plan, in ${s.mode === "quick" ? "two rounds" : "three rounds"}. ${((nf: number) => `${nf} fact${nf === 1 ? "" : "s"}`)(s.shared?.facts ?? A.pack.filter((f) => f.on).length)}${s.shared?.excerpts ? `, ${s.shared.excerpts} file excerpt${s.shared.excerpts === 1 ? "" : "s"}` : ""}${s.shared?.attach ? ` and ${s.shared.attach} attached file${s.shared.attach === 1 ? "" : "s"}` : ""} went to that AI, and nowhere else. No mail bodies and no passwords. The advisors are AI simulations, not people, and this is not legal or financial advice. A reference shows where a number came from. It does not prove the judgement built on it. The council advises and the owner decides. The council format follows the open-source roast-room project.</p>
</section>`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decision: ${short}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
<style>${CSS}</style></head><body>
${pages.join("\n")}
</body></html>`;
}

/** The same answer as a plain file, for the owner's AI or any agent: same words, same reference numbers, nothing to look at. */
export function decisionMd(s: any): string {
  const A = answerOf(s), { r, v, rep, seats, refs } = A;
  const one = (t: any) => String(t ?? "").replace(/\s+/g, " ").trim();
  const tx = (t: any) => one(String(t ?? "").replace(/\{(E\d+)\}/g, (_m, id) => { const f = A.fact(id), n = A.nOf(id); return f ? `${f.value}${n ? ` [${n}]` : ""}` : ""; }));
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const lines = [
    `# Decision: ${one(s.brief.title)}`, "",
    `question: ${one(s.q || s.brief.title)}`, `answer: ${one(A.answer)}`,
    `verdict: ${({ go: "go", cond: "go_with_conditions", reshape: "reshape", no: "do_not", wait: "wait" } as any)[r.band]}`,
    `score: ${r.score.toFixed(1)} of 10, counted by code from ${seats.length} weighted votes`,
    `decided: ${iso(s.at)}`, `asked_by: ${one(s.owner)}`, `look_again: ${iso(v.again.on)}`, "",
    "## The decision", "", tx(v.call), "",
    ...(v.next.length ? ["## Do this", "", ...v.next.map((x: any) => `- [ ] ${one(x.step)} (owner: ${one(x.owner)}, due: ${iso(x.due)})`), ""] : []),
    ...(v.why.length ? ["## Why", "", ...v.why.map((w: any, i: number) => `${i + 1}. ${one(w.head)} ${tx(w.text)}`), ""] : []),
    ...(v.example ? ["## An example", "", tx(v.example), ""] : []),
    ...(v.money ? ["## What it is worth", "", tx(v.money), ""] : []),
    ...(v.conditions.length ? ["## This holds only if", "", ...v.conditions.map((c: string) => `- ${tx(c)}`), ""] : []),
    ...(v.stops.length ? ["## Stop and think again if", "", ...v.stops.map((x: any) => `- ${one(x.text)}${x.fact && A.fact(x.fact) ? ` Today ${tx(`{${x.fact}}`)}.` : ""}`), ""] : []),
    ...(A.minor ? ["## Who disagreed", "", `${A.minor.role}, voted ${v.minority.score} of 10: "${one(v.minority.quote)}"`, ""] : []),
    "## The choices", "", ...s.brief.options.map((o: any, i: number) => `- ${"ABC"[i]}. ${one(o.title)}: score ${r.scores[i].toFixed(1)}${i === r.rec ? " (chosen)" : ""}${rep.options?.[i]?.risk ? `. Biggest risk: ${tx(rep.options[i].risk)}` : ""}`), "",
    "## References", "",
    ...(refs.length ? refs.map(({ n, f }) => `[${n}] ${SOURCES[f.src]?.[0] || f.src} | ${one(f.what)}: ${one(f.value)}${where(f) ? ` | ${one(where(f))}` : ""}${fresh(f) ? ` | ${fresh(f)}` : ""}`) : ["No single number is cited."]), "",
    ...((s.gaps || []).length ? ["## What the council could not see", "", ...s.gaps.slice(0, 5).map((g: string) => `- ${one(g)}`), ""] : []),
    "The council advises and the owner decides. Check with the owner before acting on a step that is not yours.", "",
  ];
  return lines.join("\n");
}
