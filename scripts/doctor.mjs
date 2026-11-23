#!/usr/bin/env node
// Read-only preflight for a WorkOS checkout and, optionally, one installation
// or a config about to be installed. It makes no network request, writes
// nothing and never prints a credential. Exit 1 when any check fails.
//
//   npm run doctor
//   npm run doctor -- examples/workos/alder.json "$HOME/workos-review/alder"
//   npm run doctor -- "$HOME/workos-review/alder"
import { PRIVATE_HINT, WINDOWS, isPrivate, samePath } from "../lib/workos/private.mjs";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const report = (state, check, detail) => results.push({ state, check, detail });
const pass = (c, d) => report("PASS", c, d);
const warn = (c, d) => report("WARN", c, d);
const fail = (c, d) => report("FAIL", c, d);

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
const portFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(() => resolve(true)),
    );
  });

async function checkout() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 24) pass("Node", `Node ${process.versions.node}`);
  else fail("Node", `Node ${process.versions.node}. WorkOS needs Node 24 LTS.`);
  try {
    await import("node:sqlite");
    pass("SQLite", "Built-in node:sqlite is available");
  } catch {
    fail("SQLite", "Built-in node:sqlite is unavailable. Use Node 24 LTS.");
  }
  pass("Platform", `${process.platform} ${os.release()}`);
  if (typeof process.getuid === "function" && process.getuid() === 0)
    warn(
      "Account",
      "Running as root. Use the intended private operator account.",
    );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  pass("Kit", `${pkg.name} ${pkg.version}`);
  const head = git("rev-parse", "HEAD");
  if (head) {
    const dirty = git("status", "--porcelain", "--untracked-files=no");
    if (dirty)
      warn(
        "Revision",
        `${head} with local changes. Record a clean revision for review.`,
      );
    else pass("Revision", `${head} (clean)`);
  } else
    warn(
      "Revision",
      "Not a git checkout. Record the exact release you installed.",
    );
  let lock = null;
  try {
    lock = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
    );
  } catch {
    fail("Dependencies", "package-lock.json is missing.");
  }
  if (lock) {
    const missing = [];
    const drift = [];
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      const want = lock.packages?.[`node_modules/${name}`]?.version;
      let have = null;
      try {
        have = JSON.parse(
          fs.readFileSync(
            path.join(root, "node_modules", name, "package.json"),
            "utf8",
          ),
        ).version;
      } catch {
        missing.push(name);
        continue;
      }
      if (want && have !== want) drift.push(`${name} ${have} (lock ${want})`);
    }
    if (missing.length)
      fail("Dependencies", `Missing ${missing.join(", ")}. Run npm ci.`);
    else if (drift.length)
      fail(
        "Dependencies",
        `Differ from the lockfile: ${drift.join(", ")}. Run npm ci.`,
      );
    else pass("Dependencies", "Runtime packages match package-lock.json");
  }
  const buildId = path.join(root, ".next", "BUILD_ID");
  if (!fs.existsSync(buildId))
    fail("Build", "No production build. Run npm run build.");
  else {
    const built = fs.statSync(buildId).mtimeMs;
    const newer = ["lib", "views", "components", "app", "ui"].some(
      (dir) => newestUnder(path.join(root, dir)) > built,
    );
    if (newer)
      warn(
        "Build",
        "Source files changed after the last build. Run npm run build.",
      );
    else pass("Build", "Production build is present and newer than the source");
  }
}
function newestUnder(dir) {
  let newest = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(
      newest,
      entry.isDirectory() ? newestUnder(full) : fs.statSync(full).mtimeMs,
    );
  }
  return newest;
}

async function config(file, target) {
  let c;
  try {
    const { validate } = await import("../lib/workos/config.ts");
    c = validate(JSON.parse(fs.readFileSync(file, "utf8")));
    pass("Config", `${path.basename(file)} is valid for ${c.client}`);
  } catch (e) {
    fail("Config", `${path.basename(file)}: ${e?.message ?? e}`);
    return;
  }
  if (await portFree(c.port)) pass("Port", `127.0.0.1:${c.port} is free`);
  else
    fail(
      "Port",
      `127.0.0.1:${c.port} is in use. Pick another port in the config.`,
    );
  if (target) {
    const dir = path.resolve(target);
    if (dir === root || dir.startsWith(root + path.sep))
      fail("Target", "Keep client data outside the checkout.");
    else if (fs.existsSync(dir))
      fail("Target", `${dir} already exists. Install needs a new directory.`);
    else {
      const parent = path.dirname(dir);
      if (!fs.existsSync(parent))
        fail("Target", `Parent ${parent} does not exist.`);
      else if (!samePath(fs.realpathSync(parent), parent))
        fail("Target", `Parent ${parent} is a link. Use its real path.`);
      else if (!WINDOWS && !isPrivate(parent))
        warn(
          "Target",
          `Parent ${parent} is readable by others. mkdir -m 700 is recommended.`,
        );
      else pass("Target", `${dir} can be created`);
    }
  }
}

async function installation(target) {
  const dir = path.resolve(target);
  if (!fs.existsSync(dir))
    return fail("Installation", `${dir} does not exist.`);
  if (!samePath(fs.realpathSync(dir), dir))
    return fail("Installation", "Use the real installation path, not a link.");
  const st = fs.statSync(dir);
  if (!isPrivate(dir, st))
    fail("Directory", `${dir} must be private (${PRIVATE_HINT}).`);
  else pass("Directory", `Private (${PRIVATE_HINT})`);
  if (typeof process.getuid === "function" && st.uid !== process.getuid())
    fail("Owner", "The installation belongs to a different OS account.");
  for (const name of ["access", "workos.sqlite"]) {
    const file = path.join(dir, name);
    try {
      const f = fs.lstatSync(file);
      if (!f.isFile() || f.nlink !== 1 || !isPrivate(file, f))
        fail(name, "Must be a private regular file with one link.");
      else pass(name, "Private regular file");
    } catch {
      fail(name, "Missing.");
    }
  }
  let sqlite;
  try {
    sqlite = await import("node:sqlite");
  } catch {
    return;
  }
  let db;
  try {
    db = new sqlite.DatabaseSync(path.join(dir, "workos.sqlite"), {
      readOnly: true,
    });
    const ok = db.prepare("PRAGMA integrity_check").get().integrity_check;
    if (ok === "ok") pass("Database", "Integrity check ok");
    else fail("Database", `Integrity check: ${ok}`);
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version === 3) pass("Schema", "SQLite schema 3");
    else if (version === 1 || version === 2)
      warn(
        "Schema",
        `Schema ${version}. Stop the launcher, back up and run npm run workos -- upgrade.`,
      );
    else fail("Schema", `Unknown schema ${version}.`);
    const row = db.prepare("SELECT config FROM installation").get();
    const { validate } = await import("../lib/workos/config.ts");
    const c = validate(JSON.parse(row.config));
    pass("Config", `Stored config is valid for ${c.client}`);
    if (await portFree(c.port)) pass("Port", `127.0.0.1:${c.port} is free`);
    else
      warn(
        "Port",
        `127.0.0.1:${c.port} is in use. Is this installation already running?`,
      );
    const backup = path.join(dir, "before-schema-3.sqlite");
    if (fs.existsSync(backup))
      warn(
        "Backup",
        "An upgrade backup exists. Keep it until the upgrade is reviewed.",
      );
  } catch (e) {
    fail("Database", e?.message ?? String(e));
  } finally {
    db?.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  await checkout();
  const json = args.find((a) => a.endsWith(".json"));
  const other = args.find((a) => !a.endsWith(".json"));
  if (json) await config(json, other);
  else if (other) await installation(other);
  const width = Math.max(...results.map((r) => r.check.length));
  for (const r of results)
    console.log(`${r.state}  ${r.check.padEnd(width)}  ${r.detail}`);
  const failed = results.filter((r) => r.state === "FAIL").length;
  const warned = results.filter((r) => r.state === "WARN").length;
  console.log(
    failed
      ? `\n${failed} check(s) failed. Fix them before installing or starting WorkOS.`
      : `\nReady${warned ? ` with ${warned} warning(s)` : ""}.`,
  );
  process.exitCode = failed ? 1 : 0;
}
await main();
