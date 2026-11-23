import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { WINDOWS, isPrivate, lockDown } from "../lib/workos/private.mjs";

const root = path.resolve(import.meta.dirname, "..");
const workos = (...args: string[]) =>
  spawnSync(process.execPath, ["scripts/workos.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
const rows = (file: string, sql: string) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
};

test("backup writes a private, verified snapshot and restore rebuilds a working installation in a new directory", () => {
  // On Windows the temp folder sits inside AppData, which indexing refuses as a private data folder, so the test works next to the code there.
  const base = fs.mkdtempSync(WINDOWS ? path.join(root, ".tmp-backup-test-") : path.join(os.tmpdir(), "workos-backup-"));
  fs.chmodSync(base, 0o700);
  try {
    const live = path.join(base, "alder");
    const saved = path.join(base, "alder-backup");
    const back = path.join(base, "alder-restored");
    assert.equal(workos("install", live, "examples/workos/alder.json").status, 0);
    const member = spawnSync(
      process.execPath,
      ["scripts/workos.mjs", "member-add", live, "rita", "reviewer"],
      { cwd: root, input: "a".repeat(64) + "\n", encoding: "utf8" },
    );
    assert.equal(member.status, 0, member.stderr);
    fs.writeFileSync(path.join(live, "project", "notes.md"), "# Synthetic notes\n");

    const made = workos("backup", live, saved);
    assert.equal(made.status, 0, made.stderr);
    assert.ok(!made.stdout.includes(fs.readFileSync(path.join(live, "access"), "utf8").trim()));
    // Private means file modes on Mac and Linux, and an access list naming this account alone on Windows.
    assert.ok(isPrivate(saved));
    if (!WINDOWS) assert.equal(fs.statSync(saved).mode & 0o777, 0o700);
    for (const name of ["workos.sqlite", "access", "backup.json"]) {
      assert.ok(isPrivate(path.join(saved, name)), name);
      if (!WINDOWS) assert.equal(fs.statSync(path.join(saved, name)).mode & 0o777, 0o600, name);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(saved, "backup.json"), "utf8"));
    assert.equal(manifest.client, "alder-demo");
    assert.equal(manifest.schema, 3);
    assert.ok(!fs.existsSync(path.join(saved, "index")));

    // Never overwrite.
    assert.match(workos("backup", live, saved).stderr, /new directory/i);

    const restored = workos("restore", saved, back);
    assert.equal(restored.status, 0, restored.stderr);
    assert.match(restored.stdout, /Run index next/);
    assert.deepEqual(
      rows(path.join(back, "workos.sqlite"), "SELECT principal, role FROM workos_members"),
      rows(path.join(live, "workos.sqlite"), "SELECT principal, role FROM workos_members"),
    );
    assert.equal(
      fs.readFileSync(path.join(back, "access"), "utf8"),
      fs.readFileSync(path.join(live, "access"), "utf8"),
    );
    assert.equal(fs.readFileSync(path.join(back, "project", "notes.md"), "utf8"), "# Synthetic notes\n");
    assert.equal(workos("index", back).status, 0);
    assert.match(workos("restore", saved, back).stderr, /new directory/i);

    // A changed database no longer matches its manifest.
    const bad = path.join(base, "tampered");
    fs.cpSync(saved, bad, { recursive: true });
    fs.chmodSync(bad, 0o700); // older Node versions do not carry the directory mode across in cpSync
    lockDown(bad); // and a copy on Windows does not carry the access list
    fs.appendFileSync(path.join(bad, "workos.sqlite"), "x");
    assert.match(workos("restore", bad, path.join(base, "never")).stderr, /does not match its manifest/);
    assert.ok(!fs.existsSync(path.join(base, "never")));

    // Links inside the project directory are refused rather than followed.
    // Windows only lets an admin make a file link, so there the link is a folder junction, as in the brain tests.
    if (WINDOWS) { fs.mkdirSync(path.join(base, "elsewhere")); fs.symlinkSync(path.join(base, "elsewhere"), path.join(live, "project", "outside"), "junction"); }
    else fs.symlinkSync("/etc/hosts", path.join(live, "project", "outside"));
    assert.match(workos("backup", live, path.join(base, "linked")).stderr, /only regular files/);
    assert.ok(!fs.existsSync(path.join(base, "linked")));
    assert.equal(
      fs.readdirSync(base).filter((n) => n.startsWith("workos-backup-") || n.startsWith("workos-restore-")).length,
      0,
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
