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
const cache = new Map<string, { at: number; bin: Bin | null }>();

function run(cmd: string, args: string[], timeout: number, input?: string) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = execFile(cmd, args, { timeout, cwd: os.tmpdir(), maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (e: any, stdout, stderr) => {
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
  const r = await run(win ? "where" : "which", [name], 5000);
  const extra = win
    ? [path.join(home(), ".local", "bin", name + ".exe"), path.join(appData(), "npm", name + ".cmd")]
    : [path.join(home(), ".local", "bin", name), "/opt/homebrew/bin/" + name, "/usr/local/bin/" + name, path.join(home(), ".npm-global", "bin", name)];
  const found = [...r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), ...extra.filter(exists)];
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
const grokMark = () => path.join(process.env.KEYSTONE_HOME || path.join(process.cwd(), ".keystone"), "grok-linked");

export const AGENTS: Agent[] = [
  {
    id: "claude-code", name: "Claude Code", kind: "cli", maker: "Anthropic", answers: true, getUrl: "https://docs.claude.com/en/docs/claude-code/setup",
    installed: async () => !!(await findBin("claude")),
    connected: async () => (await runBin("claude", ["mcp", "get", SERVER_NAME], 15000).catch(() => ({ code: 1 }))).code === 0,
    connect: async () => {
      const { command, args } = serverCommand();
      await runBin("claude", ["mcp", "remove", "--scope", "user", SERVER_NAME], 15000).catch(() => null);
      const r = await runBin("claude", ["mcp", "add", "--scope", "user", SERVER_NAME, "--", command, ...args], 30000);
      if (r.code !== 0) throw new Error("Claude Code did not accept the connection: " + (r.err || r.out).trim().split("\n")[0].slice(0, 160));
    },
    disconnect: async () => { await runBin("claude", ["mcp", "remove", "--scope", "user", SERVER_NAME], 15000).catch(() => null); },
  },
  {
    id: "codex", name: "Codex", kind: "cli", maker: "OpenAI", answers: true, getUrl: "https://github.com/openai/codex",
    installed: async () => !!(await findBin("codex")),
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
    installed: async () => !!(await findBin("gemini")),
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
    installed: async () => !!(await findBin("grok")),
    connected: async () => exists(grokMark()),
    connect: async () => { fs.mkdirSync(path.dirname(grokMark()), { recursive: true }); fs.writeFileSync(grokMark(), "connected\n"); },
    disconnect: async () => { try { fs.unlinkSync(grokMark()); } catch { /* nothing to remove */ } },
  },
];

function sub(a: Agent, installed: boolean, connected: boolean) {
  if (a.kind === "cloud") return `By ${a.maker}. Runs in the cloud.`;
  if (!installed) return `${a.maker === "Anysphere" ? "" : `By ${a.maker}. `}Not installed on this computer.`;
  if (a.id === "claude-app") return connected ? "Restart the Claude app, then ask about your dashboard in any chat." : "Ask about your dashboard in any Claude chat.";
  if (a.id === "cursor") return "Ask about your dashboard in Cursor's chat.";
  if (a.id === "grok") return "By xAI. Answers in the dashboard and runs the Decision Room.";
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
