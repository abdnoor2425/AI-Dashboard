import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WINDOWS } from "../lib/workos/private.mjs";

// Lets everyone on this computer read a file or folder, and takes that back: file modes on Mac and Linux, the access list on Windows.
const EVERYONE = "*S-1-1-0";
const icacls = (...args: string[]) => execFileSync("icacls", args, { stdio: "ignore", windowsHide: true });
const share = (target: string, mode: number) => (WINDOWS ? icacls(target, "/grant", EVERYONE + ":R") : fs.chmodSync(target, mode));
const unshare = (target: string, mode: number) => (WINDOWS ? icacls(target, "/remove", EVERYONE) : fs.chmodSync(target, mode));

const root = path.resolve(import.meta.dirname, "..");
const doctor = (...args: string[]) =>
  spawnSync(process.execPath, ["scripts/doctor.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });

test("doctor checks a config, a fresh installation and refuses unsafe directories without printing the credential", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "workos-doctor-"));
  fs.chmodSync(base, 0o700);
  try {
    const config = path.join(root, "examples/workos/birch.json");
    const target = path.join(base, "birch");
    const planned = doctor(config, target);
    assert.match(planned.stdout, /PASS {2}Config +birch\.json is valid for birch-demo/);
    assert.match(planned.stdout, /PASS {2}Target/);
    execFileSync(process.execPath, ["scripts/workos.mjs", "install", target, config], {
      cwd: root,
      stdio: "ignore",
    });
    const secret = fs.readFileSync(path.join(target, "access"), "utf8").trim();
    const installed = doctor(target);
    assert.match(installed.stdout, /PASS {2}Database +Integrity check ok/);
    assert.match(installed.stdout, /PASS {2}Schema +SQLite schema 3/);
    assert.ok(!installed.stdout.includes(secret));
    assert.match(doctor(config, target).stdout, /FAIL {2}Target .* already exists/);
    share(target, 0o755);
    const open = doctor(target);
    assert.equal(open.status, 1);
    assert.match(open.stdout, /FAIL {2}Directory/);
    unshare(target, 0o700);
    assert.match(doctor(target).stdout, /PASS {2}Directory/);
    share(path.join(target, "access"), 0o644);
    assert.match(doctor(target).stdout, /FAIL {2}access/);
    assert.match(doctor(path.join(base, "missing")).stdout, /FAIL {2}Installation/);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
