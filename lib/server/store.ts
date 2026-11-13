// Everything the dashboard remembers lives in one folder on this laptop:
//   .keystone/state.json    workspaces, settings and anything you changed
//   .keystone/secrets.json  sign-ins and tokens, kept apart so an export can never include them
// Nothing here is sent anywhere. Delete the folder to start again.
import fs from "node:fs";
import path from "node:path";
import { makeState } from "../sample.ts";
import { DAY, startOfDay } from "../rand.ts";

export const HOME = process.env.KEYSTONE_HOME || path.join(process.cwd(), ".keystone");
const STATE = path.join(HOME, "state.json");
const SECRETS = path.join(HOME, "secrets.json");

let cache: any = null;

function readJson(file: string) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function writeJson(file: string, data: any, mode?: number) {
  fs.mkdirSync(HOME, { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data), mode ? { mode } : undefined);
  fs.renameSync(tmp, file); // swap in one step so a crash never leaves half a file
}

/** Sample workspaces are examples about "today". Each new day, slide their dates forward so they never look stale. */
function rollSamples(state: any, now: number) {
  const anchor = state.sampleAnchor || state.createdAt;
  const shift = startOfDay(now) - startOfDay(anchor);
  if (shift < DAY) return false;
  const walk = (v: any): any => {
    if (typeof v === "number") return v > 1.5e12 && v < 4e12 ? v + shift : v;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = walk(v[i]); return v; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v; }
    return v;
  };
  for (const ws of Object.values<any>(state.workspaces)) if (ws.sample) walk(ws);
  state.sampleAnchor = now;
  return true;
}

export function loadState(now = Date.now()) {
  if (!cache) {
    const saved = readJson(STATE);
    cache = saved && saved.version === 1 && saved.workspaces ? saved : makeState(now);
    if (!saved) writeJson(STATE, cache);
  }
  if (rollSamples(cache, now)) writeJson(STATE, cache);
  return cache;
}
export function saveState() { if (cache) writeJson(STATE, cache); }

/** Secrets are grouped by workspace, so one workspace can never use another's sign-in. */
export function getSecrets(wsId: string): any { return (readJson(SECRETS) || {})[wsId] || {}; }
export function setSecrets(wsId: string, patch: any) {
  const all = readJson(SECRETS) || {};
  all[wsId] = { ...(all[wsId] || {}), ...patch };
  for (const k of Object.keys(all[wsId])) if (all[wsId][k] == null) delete all[wsId][k];
  writeJson(SECRETS, all, 0o600);
}
export function dropSecrets(wsId?: string) {
  if (!wsId) { try { fs.rmSync(SECRETS); } catch {} return; }
  const all = readJson(SECRETS) || {};
  delete all[wsId];
  writeJson(SECRETS, all, 0o600);
}
