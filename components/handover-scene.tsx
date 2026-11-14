"use client";
// Watch it live: a short scene on Your team that shows a handover.
// The person who gave the task rises out of their card, leans toward the person who got it,
// says a line and tosses a file folder down to them. The receiver catches it, nods and answers.
// Positions come from the cards on screen, so it works for any team shape and size.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Character } from "./character";
import { Icon } from "./ui";
import { pickPhrase } from "@/lib/handover";
import type { Phrases } from "@/lib/handover";

export interface SceneHandover { id: string; itemId: string; title: string; from: string; to: string; fromName: string; toName: string; at: number }
interface Bubble { key: string; text: string; x: number; y: number; side: "left" | "right"; who: "give" | "reply" }

const sleep = (ms: number, sig: { stop: boolean }) => new Promise<void>((res) => { const t = setTimeout(res, ms); if (sig.stop) { clearTimeout(t); res(); } });
const card = (id: string) => document.querySelector<HTMLElement>(`.org [data-person="${id}"]`);
const faceOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".person-face") || el;
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const names = (l: string[]) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1]);

/** A point on a quadratic curve, for the folder's arc. */
const qp = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

/** Scrolls so both cards are in view, centring the org chart sideways too. */
async function frame(a: HTMLElement, b: HTMLElement, sig: { stop: boolean }) {
  const wrap = a.closest<HTMLElement>(".org-wrap");
  if (wrap && wrap.scrollWidth > wrap.clientWidth) {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rw = wrap.getBoundingClientRect();
    const mid = (Math.min(ra.left, rb.left) + Math.max(ra.right, rb.right)) / 2;
    wrap.scrollTo({ left: wrap.scrollLeft + mid - (rw.left + rw.width / 2), behavior: reduced() ? "auto" : "smooth" });
  }
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const top = Math.min(ra.top, rb.top) - 130, bottom = Math.max(ra.bottom, rb.bottom);
  const mid = (top + bottom) / 2, target = window.scrollY + mid - window.innerHeight / 2;
  if (Math.abs(mid - window.innerHeight / 2) > 40) window.scrollTo({ top: Math.max(0, target), behavior: reduced() ? "auto" : "smooth" });
  await sleep(reduced() ? 50 : 520, sig);
}

export function HandoverScene({ list, people, phrases, plays, onReplay, onClose }: {
  list: SceneHandover[]; people: any[]; phrases: Phrases; plays: number; onReplay: () => void; onClose: () => void;
}) {
  const boss = people.find((p) => p.id === list[0]?.from);
  const [actor, setActor] = useState<{ x: number; y: number; size: number } | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [done, setDone] = useState(false);
  const [talking, setTalking] = useState(false);
  const actorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<{ title: string } | null>(null);
  const caption = useMemo(() => list.length ? `${list[0].fromName} handed “${list[0].title}” to ${names(list.map((h) => h.toName))}` : "", [list]);

  useEffect(() => {
    const sig = { stop: false };
    const anims: Animation[] = [];
    const touched: HTMLElement[] = [];
    const org = document.querySelector<HTMLElement>(".org");
    const bossCard = boss && card(boss.id);
    const targets = list.map((h) => ({ h, el: card(h.to), p: people.find((x) => x.id === h.to) })).filter((t) => t.el && t.p) as { h: SceneHandover; el: HTMLElement; p: any }[];
    if (!org || !bossCard || !targets.length) { setDone(true); return; }
    const run = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => { const a = el.animate(k, o); anims.push(a); return a; };
    const say = (b: Bubble) => setBubbles((l) => [...l.filter((x) => x.who !== b.who), b]);
    const htmlStyle = document.documentElement.style, prevOverflow = htmlStyle.overflow;

    (async () => {
      setDone(false); setBubbles([]);
      await frame(bossCard, targets[0].el, sig);
      if (sig.stop) return;
      org.classList.add("scene-on"); bossCard.classList.add("in-scene", "scene-boss"); targets.forEach((t) => t.el.classList.add("in-scene")); touched.push(bossCard, ...targets.map((t) => t.el));
      htmlStyle.overflow = "hidden"; // the scene is drawn on fixed layers, so the page holds still while it plays

      const bf = faceOf(bossCard).getBoundingClientRect();
      const size = bf.width;
      const home = { x: bf.left, y: bf.top };
      const quiet = reduced();
      setActor({ x: home.x, y: home.y, size });
      await sleep(30, sig);
      const el = actorRef.current;
      if (!el) return;

      for (let n = 0; n < targets.length && !sig.stop; n++) {
        const t = targets[n];
        const tf = faceOf(t.el).getBoundingClientRect();
        const dx = tf.left + tf.width / 2 - (home.x + size / 2), dy = tf.top + tf.height / 2 - (home.y + size / 2);
        const dir = dx === 0 ? 0 : Math.sign(dx);
        const lean = dir * Math.min(22, 11 + Math.abs(dx) / 30);
        const rise = Math.min(78, size * 0.62);
        const shift = dir * Math.min(54, Math.abs(dx) / 4.5);
        const gx = Math.max(-2.2, Math.min(2.2, dx / 80)), gy = Math.max(-1, Math.min(2, dy / 80));
        el.style.setProperty("--gaze-x", `${gx}px`); el.style.setProperty("--gaze-y", `${gy}px`);
        const pose = (x: number, y: number, r: number, s: number) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
        const up = pose(shift, -rise, lean, 1.22);

        // 1. Out of the box, leaning toward the receiver and looking down at them.
        if (!quiet) await run(el, [{ transform: n ? pose(shift * 0.4, -rise, 0, 1.22) : pose(0, 0, 0, 1) }, { transform: pose(shift * 0.3, -rise - 12, -lean * 0.15, 1.24), offset: 0.5 }, { transform: up }], { duration: n ? 420 : 640, easing: "cubic-bezier(.25,.8,.25,1)", fill: "forwards" }).finished.catch(() => {});
        else run(el, [{ transform: up }], { duration: 1, fill: "forwards" });
        if (sig.stop) break;

        // 2. The line, said toward the receiver.
        const give = pickPhrase(phrases.give, t.h.id, plays + n);
        const bx = home.x + size / 2 + shift + (dir >= 0 ? size * 0.42 : -size * 0.42), by = home.y - rise - 6;
        say({ key: "g" + n + plays, text: give, x: bx, y: by, side: dir >= 0 ? "right" : "left", who: "give" });
        setTalking(true);
        // The folder appears in hand, held out at the side toward the receiver.
        const fx = home.x + size / 2 + shift + dir * size * 0.62 - 46, fy = home.y - rise + size * 0.78 - 33;
        const lx = tf.right - 34 - (dir < 0 ? tf.width - 22 : 0), ly = tf.top - 30;
        setFile({ title: t.h.title });
        await sleep(20, sig);
        const f = fileRef.current;
        if (!f || sig.stop) break;
        const held = `translate(${fx}px, ${fy}px) rotate(${dir * 12}deg)`;
        if (!quiet) run(f, [{ transform: held + " scale(0.4)", opacity: 0 }, { transform: held + " scale(1.08)", opacity: 1, offset: 0.6 }, { transform: held + " scale(1)", opacity: 1 }], { duration: 380, easing: "ease-out", fill: "forwards" });
        await sleep(quiet ? 0 : 1000, sig);
        setTalking(false);
        if (sig.stop) break;

        // 3. The toss: a short wind-up, then the folder arcs down onto the receiver's card.
        if (!quiet) {
          run(el, [{ transform: up }, { transform: pose(shift - dir * 12, -rise - 12, lean - dir * 11, 1.23), offset: 0.45 }, { transform: pose(shift + dir * 10, -rise + 6, lean + dir * 8, 1.2), offset: 0.75 }, { transform: up }], { duration: 560, easing: "ease-in-out", fill: "forwards" });
          await sleep(260, sig);
          const cx = (fx + lx) / 2, cy = Math.min(fy, ly) - Math.max(90, Math.abs(dx) * 0.35);
          const spin = dir * 340; // ends at -8deg, the resting tilt
          const k: Keyframe[] = [];
          for (let i = 0; i <= 24; i++) {
            const s = i / 24;
            k.push({ transform: `translate(${qp(fx, cx, lx, s)}px, ${qp(fy, cy, ly, s)}px) rotate(${dir * 12 + spin * s}deg) scale(${1 + 0.12 * Math.sin(s * Math.PI)})` });
          }
          await run(f, k, { duration: 860 + Math.min(320, Math.abs(dx) / 2), easing: "cubic-bezier(.35,.05,.45,1)", fill: "forwards" }).finished.catch(() => {});
          if (sig.stop) break;
          // 4. The catch: the folder settles with a small squash and the card takes the weight.
          const rest = `translate(${lx}px, ${ly}px) rotate(${dir * -8}deg)`;
          run(f, [{ transform: rest + " scale(1.06, 0.86)" }, { transform: rest + " scale(0.97, 1.04)", offset: 0.5 }, { transform: rest + " scale(1)" }], { duration: 320, easing: "ease-out", fill: "forwards" });
          run(t.el, [{ transform: "translateY(0)" }, { transform: "translateY(5px)", offset: 0.35 }, { transform: "translateY(0)" }], { duration: 420, easing: "cubic-bezier(.3,1.4,.5,1)" });
        } else {
          run(f, [{ transform: `translate(${lx}px, ${ly}px) rotate(${dir * -8}deg)` }], { duration: 1, fill: "forwards" });
        }

        // 5. The receiver nods and answers.
        const face = t.el.querySelector("svg.character");
        face?.classList.add("nodding", "talking");
        (face as HTMLElement | null)?.style.setProperty("--gaze-x", `${-gx}px`);
        (face as HTMLElement | null)?.style.setProperty("--gaze-y", "-1.4px");
        const reply = pickPhrase(phrases.reply, t.h.id + ":r", plays + n);
        const rightRoom = tf.right + 260 < window.innerWidth;
        say({ key: "r" + n + plays, text: reply, x: rightRoom ? tf.right + 40 : tf.left - 20, y: tf.top + 14, side: rightRoom ? "right" : "left", who: "reply" });
        await sleep(quiet ? 0 : 1100, sig);
        face?.classList.remove("talking");
        await sleep(quiet ? 0 : 500, sig);
        face?.classList.remove("nodding");
        if (sig.stop) break;

        // 6. The folder tucks into the card's corner, where the task tag sits.
        if (!quiet) {
          const tag = t.el.getBoundingClientRect();
          await run(f, [{ opacity: 1 }, { transform: `translate(${tag.left + 6}px, ${tag.top + 6}px) rotate(0deg) scale(0.3)`, opacity: 0 }], { duration: 420, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }).finished.catch(() => {});
          setFile(null);
          t.el.querySelector(".person-tasks")?.animate([{ transform: "scale(0.6)" }, { transform: "scale(1.25)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
        }
        if (n < targets.length - 1) setBubbles((l) => l.filter((x) => x.who !== "reply"));
      }

      // 7. Back into the box.
      if (!sig.stop && !quiet) {
        await sleep(700, sig);
        setBubbles([]);
        const cur = getComputedStyle(el).transform;
        await run(el, [{ transform: cur === "none" ? "none" : cur }, { transform: "translate(0px, 0px) rotate(0deg) scale(1)" }], { duration: 520, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.catch(() => {});
      }
      setActor(null);
      cleanup();
      setDone(true);
      barRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    })();

    function cleanup() {
      htmlStyle.overflow = prevOverflow;
      org?.classList.remove("scene-on");
      touched.forEach((x) => {
        x.classList.remove("in-scene", "scene-boss");
        const c = x.querySelector<HTMLElement>("svg.character");
        c?.classList.remove("nodding", "talking"); c?.style.removeProperty("--gaze-x"); c?.style.removeProperty("--gaze-y");
      });
    }
    return () => { sig.stop = true; anims.forEach((a) => a.cancel()); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, list.map((h) => h.id).join("|")]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const quiet = reduced();
  return (
    <div className="scene" aria-live="polite">
      {actor && boss && (
        <div ref={actorRef} className="scene-actor" style={{ left: actor.x, top: actor.y, width: actor.size, height: actor.size }}>
          <Character look={boss.look} size={actor.size} label={`${boss.name}`} className={talking ? "talking" : ""} />
        </div>
      )}
      {file && <div ref={fileRef} className="scene-file" aria-hidden="true"><i className="sf-tab" /><i className="sf-back" /><i className="sf-paper" /><span className="sf-front"><span className="sf-label">{file.title}</span></span></div>}
      {bubbles.map((b) => (
        <div key={b.key} className={`scene-bubble ${b.who} ${b.side}${quiet ? " still" : ""}`} style={{ left: b.x, top: b.y }} role="status">{b.text}</div>
      ))}
      <div ref={barRef} className="scene-bar glass" role="region" aria-label="Watch it live">
        <span className="scene-live"><i />{done ? "Replay" : "Live"}</span>
        <span className="scene-caption">{caption}</span>
        {done ? <>
          <button className="btn sm tinted" onClick={onReplay}><Icon name="refresh" size={14} />Replay</button>
          <button className="btn sm" onClick={onClose}>Close</button>
        </> : <button className="btn sm" onClick={onClose}>Skip</button>}
      </div>
    </div>
  );
}
