// The AI apps on this computer, and the one-click link from each of them to the dashboard.
// "Connect" registers the dashboard's read-only MCP server (mcp/server.mjs) with that app, so the person can ask it
// about their dashboard. Command-line AIs (Claude Code, Codex, Gemini CLI) can also write the answers inside the app.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SERVER_NAME = "ai-dashboard";
const win = process.platform === "win32", mac = process.platform === "darwin";
const home = () => os.homedir();
const appData = () => process.env.APPDATA || path.join(home(), "AppData", "Roaming");
const localAppData = () => process.env.LOCALAPPDATA || path.join(home(), "AppData", "Local");
const exists = (p: string) => { try { return fs.existsSync(p); } catch { return false; } };

export const mcpPath = () => path.join(process.cwd(), "mcp", "server.mjs");
/** The exact command each AI app runs to reach the dashboard. Absolute paths, so it works whatever that app's PATH is. */
export const serverCommand = () => ({ command: process.execPath, args: [mcpPath()] });

/* ---------- Running a command-line app, on Windows too ---------- */

type Bin = { cmd: string; pre: string[] };

/* Where command-line apps live. An app opened from the Dock, the Start menu or at login gets a very short PATH, with none of the
   folders that Homebrew, npm, nvm, bun and the AI apps' own installers use. So the dashboard looks in all the usual places itself,
   and asks the person's own shell once for the PATH their terminal has. The same list is given to every AI app it starts,
   because most of them are Node scripts that need to find `node`. */
const kids = (dir: string, tail: string[]) => { try { return fs.readdirSync(dir).sort().reverse().map((v) => path.join(dir, v, ...tail)); } catch { return []; } };
let shellDirs: string[] = [], shellAsked: Promise<void> | null = null;
export function usualDirs(h = home(), platform = process.platform): string[] {
  const j = (...p: string[]) => path.join(h, ...p);
  if (platform === "win32") {
    const pf = process.env.ProgramFiles || "C:\\Program Files", la = localAppData(), ad = appData();
    return [
      j(".local", "bin"), path.join(ad, "npm"), path.join(pf, "nodejs"), j(".bun", "bin"), j(".cargo", "bin"), j("scoop", "shims"), j(".volta", "bin"), path.join(la, "Volta", "bin"),
      path.join(la, "pnpm"), path.join(la, "Microsoft", "WinGet", "Links"), path.join(la, "Microsoft", "WindowsApps"), path.join(la, "fnm_multishells"),
      ...kids(path.join(ad, "nvm"), []), ...kids(path.join(ad, "fnm", "node-versions"), ["installation"]), ...kids(path.join(la, "fnm_multishells"), []),
      j(".claude", "local"), j(".claude", "bin"), j(".codex", "bin"), j(".gemini", "bin"), j(".grok", "bin"), j(".hermes", "bin"), j(".muse", "bin"),
      path.join(la, "Programs", "hermes"), path.join(la, "hermes", "bin"), path.join(la, "Programs", "Grok"), path.join(la, "Programs", "muse"), path.join(la, "Programs", "codex"),
    ];
  }
  return [
    j(".local", "bin"), j("bin"), "/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin",
    j(".npm-global", "bin"), j(".npm-packages", "bin"), j(".npm", "bin"), j(".bun", "bin"), j(".cargo", "bin"), j(".volta", "bin"), j(".deno", "bin"), j(".yarn", "bin"),
    j("Library", "pnpm"), j(".local", "share", "pnpm"), j(".asdf", "shims"), j(".local", "share", "mise", "shims"), j(".nodenv", "shims"), j(".pyenv", "shims"),
    j(".claude", "local"), j(".claude", "bin"), j(".codex", "bin"), j(".gemini", "bin"), j(".grok", "bin"), j(".hermes", "bin"), j(".hermes", "hermes-agent", "venv", "bin"), j(".muse", "bin"), j(".meta", "bin"),
    ...kids(j(".nvm", "versions", "node"), ["bin"]), ...kids(j(".local", "share", "fnm", "node-versions"), ["installation", "bin"]), ...kids(j("Library", "Application Support", "fnm", "node-versions"), ["installation", "bin"]), ...kids(j(".local", "share", "nvm"), ["bin"]),
    ...kids(j("Library", "Application Support", "Claude", "claude-code"), []), "/Applications/Codex.app/Contents/Resources", "/Applications/Codex.app/Contents/MacOS",
    "/snap/bin", j(".nix-profile", "bin"), "/run/current-system/sw/bin", "/var/lib/flatpak/exports/bin", j(".local", "share", "flatpak", "exports", "bin"), j(".linuxbrew", "bin"),
    "/usr/bin", "/bin", "/usr/sbin", "/sbin",
  ];
}
/** Every folder a command may be in: this process's PATH, the terminal's PATH, Node's own folder and the usual install places. */
export function searchPath(): string[] {
  const own = (process.env.PATH || process.env.Path || "").split(path.delimiter);
  return [...new Set([...own, ...shellDirs, path.dirname(process.execPath), ...usualDirs()].filter(Boolean))];
}
/** Asks the person's login shell for its PATH, once. Slow or odd shells are simply skipped. */
function askShell() {
  if (win) return Promise.resolve();
  return (shellAsked ||= new Promise<void>((done) => {
    let sh = process.env.SHELL || "";
    try { sh ||= os.userInfo().shell || ""; } catch { /* no shell on record */ }
    if (!sh || !exists(sh)) sh = mac ? "/bin/zsh" : "/bin/bash";
    execFile(sh, ["-ilc", 'printf "__AID__%s__AID__" "$PATH"'], { timeout: 6000, cwd: home(), windowsHide: true }, (_e, out) => {
      const m = String(out || "").match(/__AID__([\s\S]*?)__AID__/);
      if (m) shellDirs = m[1].split(":").filter((d) => d && path.isAbsolute(d));
      done();
    }).stdin?.end();
  }));
}
const runnable = (p: string) => { try { if (!fs.statSync(p).isFile()) return false; if (!win) fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } };
/** The first place a command is found, looking through `dirs` in order. */
export function lookFor(name: string, dirs: string[], windows = win): string[] {
  const names = windows ? [name + ".exe", name + ".cmd"] : [name];
  const out: string[] = [];
  for (const d of dirs) for (const n of names) { const p = path.join(d, n); if (runnable(p)) out.push(p); }
  return out;
}
const cache = new Map<string, { at: number; bin: Bin | null }>();

function run(cmd: string, args: string[], timeout: number, input?: string) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = execFile(cmd, args, { timeout, cwd: os.tmpdir(), maxBuffer: 4 * 1024 * 1024, windowsHide: true, env: { ...process.env, PATH: searchPath().join(path.delimiter) } }, (e: any, stdout, stderr) => {
      resolve({ code: e ? (typeof e.code === "number" ? e.code : 1) : 0, out: String(stdout || ""), err: String(stderr || e?.message || "") });
    });
    if (input != null) { child.stdin?.end(input); }
  });
}

/** The script an npm command shim (.cmd) starts, such as node_modules\\@anthropic-ai\\claude-code\\cli.js. */
export function shimScript(text: string, shimPath: string) {
  const m = text.match(/"%~?dp0%?\\([^"]+?\.(?:js|mjs|cjs))"/i);
  return m ? path.win32.join(path.win32.dirname(shimPath), m[1]) : null;
}

/** Where a command lives. On Windows an npm-installed command is a .cmd file, which Node cannot start
 *  without a shell, so it is run as `node <its script>` instead. No shell is ever used. */
export async function findBin(name: string): Promise<Bin | null> {
  const hit = cache.get(name);
  // A found app is remembered for a minute; a missing one is looked for again soon, in case it was just installed.
  if (hit && Date.now() - hit.at < (hit.bin ? 60000 : 3000)) return hit.bin;
  await askShell();
  const found = lookFor(name, searchPath());
  let bin: Bin | null = null;
  if (!win) bin = found[0] ? { cmd: found[0], pre: [] } : null;
  else {
    const exe = found.find((p) => /\.exe$/i.test(p));
    const shim = found.find((p) => /\.cmd$/i.test(p));
    if (exe) bin = { cmd: exe, pre: [] };
    else if (shim) {
      try { const js = shimScript(fs.readFileSync(shim, "utf8"), shim); if (js && exists(js)) bin = { cmd: process.execPath, pre: [js] }; }
      catch { /* unreadable shim: treat as missing */ }
    }
  }
  cache.set(name, { at: Date.now(), bin });
  return bin;
}

export async function runBin(name: string, args: string[], timeout: number, input?: string) {
  const bin = await findBin(name);
  if (!bin) throw new Error(`${name} was not found on this computer.`);
  return run(bin.cmd, [...bin.pre, ...args], timeout, input);
}

/* ---------- Settings files that list MCP servers ---------- */

function readJson(file: string): any {
  if (!exists(file)) return {};
  const text = fs.readFileSync(file, "utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}
function jsonHas(file: string) {
  try { return !!readJson(file)?.mcpServers?.[SERVER_NAME]; } catch { return false; }
}
function jsonAdd(file: string, app: string) {
  let data: any;
  try { data = readJson(file); } catch { throw new Error(`${app}'s settings file could not be read, so it was left as it is. Open ${app} once, then try again.`); }
  if (typeof data !== "object" || Array.isArray(data) || data === null) throw new Error(`${app}'s settings file has an unexpected shape, so it was left as it is.`);
  data.mcpServers = { ...(data.mcpServers || {}), [SERVER_NAME]: serverCommand() };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (exists(file)) fs.copyFileSync(file, file + ".before-ai-dashboard");
  const tmp = file + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
function jsonRemove(file: string) {
  try { const data = readJson(file); if (data?.mcpServers?.[SERVER_NAME]) { delete data.mcpServers[SERVER_NAME]; fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n"); } } catch { /* nothing to remove */ }
}

const codexConfig = () => path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "config.toml");
const tomlHeader = new RegExp(`^\\[mcp_servers\\.(?:"${SERVER_NAME}"|${SERVER_NAME})\\]\\s*$`, "m");
function tomlStrip(text: string) {
  const m = tomlHeader.exec(text);
  if (!m) return text;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^\s*\[/m);
  return (text.slice(0, m.index) + (next >= 0 ? rest.slice(next) : "")).replace(/\n{3,}/g, "\n\n");
}
function codexHas() { try { return tomlHeader.test(fs.readFileSync(codexConfig(), "utf8")); } catch { return false; } }
function codexAdd() {
  const file = codexConfig();
  const before = exists(file) ? fs.readFileSync(file, "utf8") : "";
  const { command, args } = serverCommand();
  const block = `[mcp_servers.${SERVER_NAME}]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map((a) => JSON.stringify(a)).join(", ")}]\n`;
  const body = tomlStrip(before).replace(/\s*$/, "");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (before) fs.copyFileSync(file, file + ".before-ai-dashboard");
  fs.writeFileSync(file, (body ? body + "\n\n" : "") + block);
}

/* ---------- The list ---------- */

export type Agent = {
  id: string; name: string; kind: "cli" | "app" | "cloud"; maker: string; answers: boolean; getUrl: string;
  installed: () => Promise<boolean>; connected: () => Promise<boolean>; connect: () => Promise<void>; disconnect: () => Promise<void>;
};

const claudeAppDir = () => (win ? path.join(appData(), "Claude") : mac ? path.join(home(), "Library", "Application Support", "Claude") : path.join(home(), ".config", "Claude"));
const claudeAppFile = () => path.join(claudeAppDir(), "claude_desktop_config.json");
const cursorFile = () => path.join(home(), ".cursor", "mcp.json");
const geminiFile = () => path.join(home(), ".gemini", "settings.json");
const claudeCodeFile = () => path.join(home(), ".claude.json");
/** A small file of the dashboard's own that remembers the owner's choice, for AI apps that keep no list of outside tools we can safely write to. */
const mark = (id: string) => path.join(process.env.KEYSTONE_HOME || path.join(process.cwd(), ".keystone"), id + "-linked");
const marked = (id: string) => ({
  connected: async () => exists(mark(id)),
  connect: async () => { fs.mkdirSync(path.dirname(mark(id)), { recursive: true }); fs.writeFileSync(mark(id), "connected\n"); },
  disconnect: async () => { try { fs.unlinkSync(mark(id)); } catch { /* nothing to remove */ } },
});
/** True when any of these exists. An AI app that was set up leaves its own folder behind, even when its command is somewhere unusual. */
const any = (...p: string[]) => p.some(exists);
const grokMark = () => path.join(process.env.KEYSTONE_HOME || path.join(process.cwd(), ".keystone"), "grok-linked");

export const AGENTS: Agent[] = [
  {
    id: "claude-code", name: "Claude Code", kind: "cli", maker: "Anthropic", answers: true, getUrl: "https://docs.claude.com/en/docs/claude-code/setup",
    installed: async () => !!(await findBin("claude")) || any(claudeCodeFile(), path.join(home(), ".claude")),
    connected: async () => jsonHas(claudeCodeFile()) || (!!(await findBin("claude")) && (await runBin("claude", ["mcp", "get", SERVER_NAME], 15000).catch(() => ({ code: 1 }))).code === 0),
    connect: async () => {
      const { command, args } = serverCommand();
      // Its command could not be found, but its settings are here: the link is written straight into them.
      if (!(await findBin("claude"))) return jsonAdd(claudeCodeFile(), "Claude Code");
      await runBin("claude", ["mcp", "remove", "--scope", "user", SERVER_NAME], 15000).catch(() => null);
      const r = await runBin("claude", ["mcp", "add", "--scope", "user", SERVER_NAME, "--", command, ...args], 30000);
      if (r.code !== 0) throw new Error("Claude Code did not accept the connection: " + (r.err || r.out).trim().split("\n")[0].slice(0, 160));
    },
    disconnect: async () => { await runBin("claude", ["mcp", "remove", "--scope", "user", SERVER_NAME], 15000).catch(() => null); jsonRemove(claudeCodeFile()); },
  },
  {
    id: "codex", name: "Codex", kind: "cli", maker: "OpenAI", answers: true, getUrl: "https://github.com/openai/codex",
    installed: async () => !!(await findBin("codex")) || any(path.dirname(codexConfig()), "/Applications/Codex.app"),
    connected: async () => codexHas(),
    connect: async () => codexAdd(),
    disconnect: async () => { try { const f = codexConfig(); fs.writeFileSync(f, tomlStrip(fs.readFileSync(f, "utf8"))); } catch { /* nothing to remove */ } },
  },
  {
    id: "claude-app", name: "Claude desktop app", kind: "app", maker: "Anthropic", answers: false, getUrl: "https://claude.ai/download",
    installed: async () => exists(claudeAppDir()) || (win ? exists(path.join(localAppData(), "AnthropicClaude")) : mac ? exists("/Applications/Claude.app") : false),
    connected: async () => jsonHas(claudeAppFile()),
    connect: async () => jsonAdd(claudeAppFile(), "Claude"),
    disconnect: async () => jsonRemove(claudeAppFile()),
  },
  {
    id: "gemini", name: "Gemini CLI", kind: "cli", maker: "Google", answers: true, getUrl: "https://github.com/google-gemini/gemini-cli",
    installed: async () => !!(await findBin("gemini")) || any(path.join(home(), ".gemini")),
    connected: async () => jsonHas(geminiFile()),
    connect: async () => jsonAdd(geminiFile(), "Gemini CLI"),
    disconnect: async () => jsonRemove(geminiFile()),
  },
  {
    id: "cursor", name: "Cursor", kind: "app", maker: "Anysphere", answers: false, getUrl: "https://cursor.com/downloads",
    installed: async () => exists(path.join(home(), ".cursor")) || (win ? exists(path.join(localAppData(), "Programs", "cursor")) : mac ? exists("/Applications/Cursor.app") : false),
    connected: async () => jsonHas(cursorFile()),
    connect: async () => jsonAdd(cursorFile(), "Cursor"),
    disconnect: async () => jsonRemove(cursorFile()),
  },
  { id: "chatgpt", name: "ChatGPT", kind: "cloud", maker: "OpenAI", answers: false, getUrl: "", installed: async () => false, connected: async () => false, connect: async () => { throw new Error("ChatGPT can't reach a dashboard on your computer yet."); }, disconnect: async () => {} },
  {
    // Grok's command-line app answers questions and runs the Decision Room. It keeps no list of outside tools, so there is nothing to write into it:
    // the dashboard remembers the owner's choice in a small file of its own.
    id: "grok", name: "Grok", kind: "cli", maker: "xAI", answers: true, getUrl: "",
    installed: async () => !!(await findBin("grok")) || any(path.join(home(), ".grok"), "/Applications/Grok.app"),
    connected: async () => exists(grokMark()),
    connect: async () => { fs.mkdirSync(path.dirname(grokMark()), { recursive: true }); fs.writeFileSync(grokMark(), "connected\n"); },
    disconnect: async () => { try { fs.unlinkSync(grokMark()); } catch { /* nothing to remove */ } },
  },
  // Hermes (Nous Research) answers one question at a time from the command line, so it can answer in the dashboard too.
  { id: "hermes", name: "Hermes", kind: "cli", maker: "Nous Research", answers: true, getUrl: "https://hermes-agent.nousresearch.com/docs", installed: async () => !!(await findBin("hermes")) || any(path.join(home(), ".hermes"), "/Applications/Hermes.app"), ...marked("hermes") },
  // Muse Code (Meta) is found and remembered. It does not answer inside the dashboard yet.
  { id: "muse", name: "Muse Code", kind: "cli", maker: "Meta", answers: false, getUrl: "", installed: async () => !!(await findBin("muse")) || any(path.join(home(), ".muse")), ...marked("muse") },
];

function sub(a: Agent, installed: boolean, connected: boolean) {
  if (a.kind === "cloud") return `By ${a.maker}. Runs in the cloud.`;
  if (!installed) return `${a.maker === "Anysphere" ? "" : `By ${a.maker}. `}Not installed on this computer.`;
  if (a.id === "claude-app") return connected ? "Restart the Claude app, then ask about your dashboard in any chat." : "Ask about your dashboard in any Claude chat.";
  if (a.id === "cursor") return "Ask about your dashboard in Cursor's chat.";
  if (a.id === "grok") return "By xAI. Answers in the dashboard and runs the Decision Room.";
  if (a.id === "hermes") return "By Nous Research. Answers in the dashboard and runs the Decision Room.";
  if (a.id === "muse") return "By Meta. Found on this computer.";
  return `By ${a.maker}. Answers in the dashboard and in your terminal.`;
}

/** Every AI app, whether it is on this computer, and whether it is linked to the dashboard. */
export async function listAgents() {
  return Promise.all(AGENTS.map(async (a) => {
    const installed = await a.installed().catch(() => false);
    const connected = installed ? await a.connected().catch(() => false) : false;
    return { id: a.id, name: a.name, kind: a.kind, maker: a.maker, answers: a.answers, installed, connected, getUrl: a.getUrl, sub: sub(a, installed, connected) };
  }));
}

export async function connectAgent(id: string) {
  const a = AGENTS.find((x) => x.id === id);
  if (!a) throw new Error("No such AI app.");
  cache.clear();
  if (!(await a.installed())) throw new Error(`${a.name} is not installed on this computer.`);
  await a.connect();
  if (!(await a.connected())) throw new Error(`${a.name} did not keep the connection. Try again, or restart ${a.name}.`);
}

export async function disconnectAgent(id: string) {
  const a = AGENTS.find((x) => x.id === id);
  if (!a) throw new Error("No such AI app.");
  await a.disconnect();
}

/** A plain report of what the scan sees on this computer, for fixing a scan that misses something. Paths and yes or no only. */
export async function scanReport() {
  await askShell();
  const bins = ["claude", "codex", "gemini", "grok", "hermes", "muse", "node"];
  const found = Object.fromEntries(await Promise.all(bins.map(async (b) => [b, (await findBin(b))?.cmd || null])));
  const homes = Object.fromEntries([".claude", ".claude.json", ".codex", ".gemini", ".grok", ".hermes", ".muse", ".cursor"].map((f) => [f, exists(path.join(home(), f))]));
  return { platform: process.platform, node: process.execPath, commands: found, settingsFolders: homes, fromShell: shellDirs.length, lookedIn: searchPath().filter(exists), agents: await listAgents() };
}
