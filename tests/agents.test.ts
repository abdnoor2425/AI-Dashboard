import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// A pretend computer: its own home folder, and fake AI command-line apps on the PATH.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dashboard-agents-"));
const home = path.join(root, "home"), bin = path.join(root, "bin");
fs.mkdirSync(home); fs.mkdirSync(bin);
process.env.HOME = home; process.env.USERPROFILE = home; delete process.env.CODEX_HOME;
process.env.PATH = bin + path.delimiter + "/usr/bin" + path.delimiter + "/bin";
const fake = (name: string, script: string) => { fs.writeFileSync(path.join(bin, name), "#!/bin/sh\n" + script + "\n", { mode: 0o755 }); };
// Claude Code keeps its list in a file here, the way the real one does in its own settings.
fake("claude", `LIST="$HOME/claude-mcp.txt"
case "$1 $2" in
  "mcp add") echo "$@" >> "$LIST" ;;
  "mcp get") grep -q " ai-dashboard " "$LIST" 2>/dev/null ;;
  "mcp remove") rm -f "$LIST" ;;
  *) echo "fake claude answer" ;;
esac`);
fake("codex", `echo "fake codex answer"`);
const agents = await import("../lib/server/agents.ts");

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
const byId = async () => Object.fromEntries((await agents.listAgents()).map((a) => [a.id, a]));

test("finds the AI apps on this computer and connects each with one click", { skip: process.platform === "win32" }, async () => {
  fs.mkdirSync(path.join(home, ".cursor"));
  fs.mkdirSync(path.join(home, ".codex"));
  fs.writeFileSync(path.join(home, ".codex", "config.toml"), 'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "x"\n');
  fs.writeFileSync(path.join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { mine: { command: "y" } } }));

  let list = await byId();
  assert.equal(list["claude-code"].installed, true);
  assert.equal(list.codex.installed, true);
  assert.equal(list.cursor.installed, true);
  assert.equal(list.gemini.installed, false);
  assert.equal(list.chatgpt.kind, "cloud");
  assert.ok(Object.values<any>(list).every((a) => !a.connected));

  await agents.connectAgent("claude-code");
  await agents.connectAgent("codex");
  await agents.connectAgent("cursor");
  // Connecting twice is safe: nothing is duplicated.
  await agents.connectAgent("codex");
  list = await byId();
  assert.equal(list["claude-code"].connected, true);
  assert.equal(list.codex.connected, true);
  assert.equal(list.cursor.connected, true);

  const { command, args } = agents.serverCommand();
  assert.match(fs.readFileSync(path.join(home, "claude-mcp.txt"), "utf8"), /mcp add --scope user ai-dashboard -- /);
  const toml = fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8");
  assert.equal(toml.match(/\[mcp_servers\.ai-dashboard\]/g)?.length, 1);
  assert.match(toml, /model = "gpt-5"/);
  assert.match(toml, /\[mcp_servers\.other\]/);
  assert.ok(toml.includes(`command = ${JSON.stringify(command)}`));
  const cursor = JSON.parse(fs.readFileSync(path.join(home, ".cursor", "mcp.json"), "utf8"));
  assert.deepEqual(cursor.mcpServers["ai-dashboard"], { command, args });
  assert.equal(cursor.mcpServers.mine.command, "y");

  await agents.disconnectAgent("codex");
  await agents.disconnectAgent("cursor");
  list = await byId();
  assert.equal(list.codex.connected, false);
  assert.equal(list.cursor.connected, false);
  assert.match(fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8"), /\[mcp_servers\.other\]/);
});

test("refuses what it cannot do, in plain words", { skip: process.platform === "win32" }, async () => {
  await assert.rejects(agents.connectAgent("gemini"), /not installed/);
  await assert.rejects(agents.connectAgent("chatgpt"), /not installed|can't reach/);
  fs.mkdirSync(path.join(home, ".gemini"), { recursive: true });
  fs.writeFileSync(path.join(home, ".gemini", "settings.json"), "{ not json");
  fake("gemini", "echo hi");
  await assert.rejects(agents.connectAgent("gemini"), /settings file could not be read/);
  assert.equal(fs.readFileSync(path.join(home, ".gemini", "settings.json"), "utf8"), "{ not json");
});

test("on Windows, an npm command is run through its own script, never a shell", () => {
  const shim = `@ECHO off\r\nSETLOCAL\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n)\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n`;
  assert.equal(agents.shimScript(shim, "C:\\Users\\Sam\\AppData\\Roaming\\npm\\claude.cmd"), "C:\\Users\\Sam\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js");
  assert.equal(agents.shimScript("@echo off\r\nnode.exe %*", "C:\\x\\y.cmd"), null);
});

test("a command is found in the usual install folders even when PATH is nearly empty, as it is for an app opened from the Dock", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aid-path-"));
  const nvm = path.join(home, ".nvm", "versions", "node", "v22.1.0", "bin");
  fs.mkdirSync(nvm, { recursive: true });
  fs.mkdirSync(path.join(home, ".hermes", "bin"), { recursive: true });
  fs.writeFileSync(path.join(nvm, "codex"), "#!/bin/sh\n", { mode: 0o755 });
  fs.writeFileSync(path.join(home, ".hermes", "bin", "hermes"), "#!/bin/sh\n", { mode: 0o755 });
  fs.writeFileSync(path.join(nvm, "notes.txt"), "not a program", { mode: 0o644 });
  const dirs = agents.usualDirs(home, "darwin");
  assert.ok(dirs.includes("/opt/homebrew/bin") && dirs.includes(nvm));
  if (process.platform !== "win32") {
    assert.deepEqual(agents.lookFor("codex", dirs, false), [path.join(nvm, "codex")]);
    assert.deepEqual(agents.lookFor("hermes", dirs, false), [path.join(home, ".hermes", "bin", "hermes")]);
    assert.deepEqual(agents.lookFor("notes.txt", dirs, false), []);
  }
  assert.ok(agents.searchPath().includes(path.dirname(process.execPath)));
});

test("Hermes and Muse Code are on the list of AI apps", () => {
  const ids = agents.AGENTS.map((a: any) => a.id);
  for (const id of ["claude-code", "codex", "gemini", "grok", "hermes", "muse"]) assert.ok(ids.includes(id), id);
});
