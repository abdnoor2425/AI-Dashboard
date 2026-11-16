#!/usr/bin/env node
// Makes AI-Dashboard feel like an app on this computer:
//   Windows  an icon on the desktop and in the Start menu, and it starts quietly when you log in
//   Mac      AI-Dashboard in Applications and the Dock, and it starts quietly when you log in
//   Linux    an app-menu entry, a desktop icon, and it starts quietly when you log in
// The icon opens the dashboard in its own window. Then it opens it once, so you can start.
//   npm run setup                 add the icon and open the app
//   npm run setup -- --restart    after an update: restart it with the new version
//   npm run setup -- --no-open    add the icon only
//   npm run setup -- --remove     take the icon and the start-at-login entry away again
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, isUp, openWindow, startServer, stopServer } from "./launch.mjs";

const NAME = "AI-Dashboard";
const args = process.argv.slice(2);
const node = process.execPath;
const launch = path.join(ROOT, "scripts", "launch.mjs");
const say = (s) => console.log("  " + s);

function ps(script) {
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "PowerShell failed").trim());
  return r.stdout.trim();
}
const q = (s) => s.replace(/'/g, "''"); // PowerShell single-quoted string

function windows(remove) {
  const dir = path.join(ROOT, ".keystone", "launcher");
  const open = path.join(dir, `${NAME}.vbs`), quiet = path.join(dir, `${NAME} (background).vbs`);
  const icon = path.join(ROOT, "public", "app-icon.ico");
  const [desktop, programs, startup] = ps("[Environment]::GetFolderPath('Desktop'); [Environment]::GetFolderPath('Programs'); [Environment]::GetFolderPath('Startup')").split(/\r?\n/).map((s) => s.trim());
  const links = [path.join(desktop, `${NAME}.lnk`), path.join(programs, `${NAME}.lnk`)];
  const login = path.join(startup, `${NAME}.lnk`);
  if (remove) { for (const f of [...links, login]) fs.rmSync(f, { force: true }); return say("Removed the desktop icon, the Start menu entry and the start-at-login entry."); }
  fs.mkdirSync(dir, { recursive: true });
  // A tiny VBScript runs node with no console window, so clicking the icon only shows the app.
  const vbs = (extra) => `Set s = CreateObject("WScript.Shell")\r\ns.CurrentDirectory = "${ROOT}"\r\ns.Run """${node}"" ""${launch}""${extra}", 0, False\r\n`;
  fs.writeFileSync(open, vbs("")); fs.writeFileSync(quiet, vbs(" --background"));
  const lnk = (file, target, desc) => `$l = $w.CreateShortcut('${q(file)}'); $l.TargetPath = "$env:WINDIR\\System32\\wscript.exe"; $l.Arguments = '"${q(target)}"'; $l.WorkingDirectory = '${q(ROOT)}'; $l.IconLocation = '${q(icon)}'; $l.Description = '${desc}'; $l.Save();`;
  ps(`$w = New-Object -ComObject WScript.Shell; ${links.map((f) => lnk(f, open, "Open AI-Dashboard")).join(" ")} ${lnk(login, quiet, "Start AI-Dashboard in the background")}`);
  say("Added AI-Dashboard to your desktop and Start menu.");
  say("It starts quietly in the background when you log in.");
}

function mac(remove) {
  const apps = path.join(os.homedir(), "Applications"), app = path.join(apps, `${NAME}.app`);
  const agent = path.join(os.homedir(), "Library", "LaunchAgents", "com.ai-dashboard.server.plist");
  if (remove) {
    spawnSync("launchctl", ["unload", agent], { stdio: "ignore" });
    fs.rmSync(agent, { force: true }); fs.rmSync(app, { recursive: true, force: true });
    return say("Removed AI-Dashboard from Applications and from start-at-login. Drag it out of the Dock if it is still there.");
  }
  const contents = path.join(app, "Contents");
  fs.mkdirSync(path.join(contents, "MacOS"), { recursive: true }); fs.mkdirSync(path.join(contents, "Resources"), { recursive: true });
  const exe = path.join(contents, "MacOS", NAME);
  fs.writeFileSync(exe, `#!/bin/sh\ncd "${ROOT}"\nexec "${node}" "${launch}" "$@"\n`); fs.chmodSync(exe, 0o755);
  fs.writeFileSync(path.join(contents, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>${NAME}</string><key>CFBundleDisplayName</key><string>${NAME}</string>
<key>CFBundleIdentifier</key><string>com.ai-dashboard.app</string><key>CFBundleExecutable</key><string>${NAME}</string>
<key>CFBundleIconFile</key><string>AppIcon</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
</dict></plist>
`);
  // Turn the PNG logo into a Mac icon with the tools every Mac has.
  const set = path.join(os.tmpdir(), "ai-dashboard.iconset"); fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set);
  for (const s of [16, 32, 64, 128, 256, 512]) {
    spawnSync("sips", ["-z", String(s), String(s), path.join(ROOT, "public", "app-icon.png"), "--out", path.join(set, `icon_${s}x${s}.png`)], { stdio: "ignore" });
    if (s <= 256) spawnSync("sips", ["-z", String(s * 2), String(s * 2), path.join(ROOT, "public", "app-icon.png"), "--out", path.join(set, `icon_${s}x${s}@2x.png`)], { stdio: "ignore" });
  }
  spawnSync("iconutil", ["-c", "icns", set, "-o", path.join(contents, "Resources", "AppIcon.icns")], { stdio: "ignore" });
  spawnSync("touch", [app]);
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.ai-dashboard.server</string>
<key>ProgramArguments</key><array><string>${node}</string><string>${launch}</string><string>--background</string></array>
<key>WorkingDirectory</key><string>${ROOT}</string><key>RunAtLoad</key><true/>
</dict></plist>
`);
  spawnSync("launchctl", ["unload", agent], { stdio: "ignore" }); spawnSync("launchctl", ["load", agent], { stdio: "ignore" });
  // Add it to the Dock once.
  const dock = spawnSync("defaults", ["read", "com.apple.dock", "persistent-apps"], { encoding: "utf8" }).stdout || "";
  if (!dock.includes(`${NAME}.app`)) {
    spawnSync("defaults", ["write", "com.apple.dock", "persistent-apps", "-array-add", `<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>file://${encodeURI(app)}/</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>`]);
    spawnSync("killall", ["Dock"], { stdio: "ignore" });
  }
  say("Added AI-Dashboard to Applications and the Dock.");
  say("It starts quietly in the background when you log in.");
}

function linux(remove) {
  const entry = `[Desktop Entry]\nType=Application\nName=${NAME}\nComment=Your whole business on one calm page\nExec="${node}" "${launch}"\nIcon=${path.join(ROOT, "public", "app-icon.png")}\nTerminal=false\nCategories=Office;\n`;
  const files = [path.join(os.homedir(), ".local", "share", "applications", "ai-dashboard.desktop"), path.join(os.homedir(), "Desktop", "ai-dashboard.desktop")];
  const auto = path.join(os.homedir(), ".config", "autostart", "ai-dashboard.desktop");
  if (remove) { for (const f of [...files, auto]) fs.rmSync(f, { force: true }); return say("Removed the menu entry, the desktop icon and the start-at-login entry."); }
  for (const f of files) { if (f.includes("Desktop") && !fs.existsSync(path.dirname(f))) continue; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, entry, { mode: 0o755 }); }
  fs.mkdirSync(path.dirname(auto), { recursive: true });
  fs.writeFileSync(auto, entry.replace(`"${launch}"`, `"${launch}" --background`).replace("Name=AI-Dashboard", "Name=AI-Dashboard (background)"));
  say("Added AI-Dashboard to your app menu and desktop.");
  say("It starts quietly in the background when you log in.");
}

async function main() {
  const remove = args.includes("--remove");
  console.log(remove ? "Removing AI-Dashboard's icon…" : "Setting up AI-Dashboard…");
  if (process.platform === "win32") windows(remove); else if (process.platform === "darwin") mac(remove); else linux(remove);
  if (remove) { stopServer(); return; }
  if (args.includes("--restart")) { stopServer(); await new Promise((r) => setTimeout(r, 800)); }
  if (!(await isUp())) await startServer();
  say("AI-Dashboard is running at http://localhost:3210");
  if (!args.includes("--no-open")) { openWindow(); say("Opened it in its own window."); }
}

main().catch((e) => { console.error("Setup did not finish: " + (e.message || e)); process.exit(1); });
