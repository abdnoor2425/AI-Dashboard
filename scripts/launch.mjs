#!/usr/bin/env node
// Opens AI-Dashboard. Starts it quietly in the background if it is not running yet,
// then opens it in its own window (no tabs, no address bar).
//   node scripts/launch.mjs               start if needed, then open the window
//   node scripts/launch.mjs --background  start if needed, open nothing (used when you log in)
//   node scripts/launch.mjs --restart     stop the running copy first (after an update)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PORT = Number(process.env.PORT) || 3210;
export const APP_URL = `http://localhost:${PORT}/`;
const HOME = process.env.KEYSTONE_HOME || path.join(ROOT, ".keystone");
const PID = path.join(HOME, "server.pid");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when the dashboard answers on this computer. */
export function isUp() {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: PORT, path: "/api/bootstrap", timeout: 1500 }, (res) => { res.resume(); resolve((res.statusCode || 500) < 500); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

export function stopServer() {
  try {
    const pid = Number(fs.readFileSync(PID, "utf8"));
    if (pid) process.kill(pid);
  } catch { /* nothing running from here */ }
  try { fs.rmSync(PID); } catch { /* already gone */ }
  // A copy started some other way (for example with `npm start`) is found by its port.
  if (process.platform === "win32") spawnSync("powershell", ["-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`], { stdio: "ignore", windowsHide: true });
  else spawnSync("sh", ["-c", `lsof -ti tcp:${PORT} -sTCP:LISTEN | xargs kill 2>/dev/null`], { stdio: "ignore" });
}

export async function startServer() {
  const next = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(next)) throw new Error("Dependencies are missing. Run `npm install` in " + ROOT);
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    const built = spawnSync(process.execPath, [next, "build"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
    if (built.status !== 0) throw new Error("The build failed. Run `npm run build` to see why.");
  }
  fs.mkdirSync(HOME, { recursive: true });
  const log = fs.openSync(path.join(HOME, "server.log"), "a");
  const child = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: ROOT, detached: true, windowsHide: true, stdio: ["ignore", log, log], env: { ...process.env, NODE_ENV: "production" },
  });
  fs.writeFileSync(PID, String(child.pid));
  child.unref();
  for (let i = 0; i < 80; i++) { if (await isUp()) return; await sleep(500); }
  throw new Error("AI-Dashboard did not start. See " + path.join(HOME, "server.log"));
}

const exists = (p) => { try { return !!p && fs.existsSync(p); } catch { return false; } };
const which = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" }).stdout?.split(/\r?\n/)[0]?.trim() || "";

/** Opens the dashboard in its own app window, using Chrome or Edge when there is one, else the default browser. */
export function openWindow(url = APP_URL) {
  const app = [`--app=${url}`, "--window-size=1440,920"];
  const go = (cmd, args) => { const c = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }); c.on("error", () => console.log("  Open " + url + " in your browser.")); c.unref(); };
  if (process.platform === "win32") {
    const pf = process.env.ProgramFiles || "C:\\Program Files", pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const exe = [
      path.join(pf, "Google", "Chrome", "Application", "chrome.exe"), path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"), path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    ].find(exists);
    return exe ? go(exe, app) : go("cmd", ["/c", "start", "", url]);
  }
  if (process.platform === "darwin") {
    const name = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium", "Arc"].find((n) => exists(`/Applications/${n}.app`) || exists(path.join(os.homedir(), "Applications", `${n}.app`)));
    return name ? go("open", ["-na", name, "--args", ...app]) : go("open", [url]);
  }
  const bin = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"].map(which).find(Boolean);
  return bin ? go(bin, app) : go("xdg-open", [url]);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--restart")) { stopServer(); await sleep(800); }
  if (!(await isUp())) await startServer();
  if (!args.includes("--background")) openWindow();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
