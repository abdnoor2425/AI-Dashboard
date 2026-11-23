// "Private" means only this computer account can open it.
// Mac and Linux say that with file modes (0700 folders, 0600 files). Windows has no modes: there a folder is private
// when its access list names this account alone, which lockDown sets when an installation, backup or restore is made.
import fs from "node:fs";
import os from "node:os";
import process from "node:process";
import { execFileSync } from "node:child_process";

export const WINDOWS = process.platform === "win32";
const account = () => (process.env.USERDOMAIN ? process.env.USERDOMAIN + "\\" : "") + os.userInfo().username;

/** Give a new folder, and everything later made inside it, to this account only. Nothing to do on Mac and Linux. */
export function lockDown(target) {
  if (!WINDOWS) return;
  execFileSync("icacls", [target, "/inheritance:r", "/grant:r", account() + ":(OI)(CI)F"], { stdio: "ignore", windowsHide: true });
}

/** Reads a Windows access list as text and says whether this account is the only one on it. Kept apart so it can be tested anywhere. */
export function onlyThisAccount(listing, target, user = os.userInfo().username) {
  const me = user.toLowerCase();
  const names = listing.split(/\r?\n/).map((line) => line.replace(target, "").trim()).filter((line) => /:\(/.test(line)).map((line) => line.slice(0, line.indexOf(":(")).toLowerCase());
  return names.length > 0 && names.every((name) => name === me || name.endsWith("\\" + me));
}

/** True when nobody else on this computer can open the file or folder. */
export function isPrivate(target, st = fs.statSync(target)) {
  if (!WINDOWS) return (st.mode & 0o077) === 0;
  try { return onlyThisAccount(execFileSync("icacls", [target], { encoding: "utf8", windowsHide: true }), target); } catch { return false; }
}

/** A fresh private working folder next to where the result will go. */
export function privateTemp(prefix) {
  const dir = fs.mkdtempSync(prefix);
  lockDown(dir);
  return dir;
}

/** Windows spells one folder many ways (drive letter and name case), so paths are compared without case there. */
export const samePath = (a, b) => (WINDOWS ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Moves a prepared folder to its final, not yet existing, name. POSIX first reserves the name; Windows cannot rename onto a folder. */
export function place(temp, dir) {
  if (!WINDOWS) fs.mkdirSync(dir, { mode: 0o700 });
  fs.renameSync(temp, dir);
}

export const PRIVATE_HINT = WINDOWS ? "only your Windows account may have access" : "0700";
