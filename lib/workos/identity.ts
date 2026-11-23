import { createHash, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { requireValue, slug } from "./config.ts";

export type Role = "operator" | "reviewer" | "viewer";
export type Actor = { principal: string; role: Role; version: number };
const roles = ["operator", "reviewer", "viewer"];
export const installationActor = (client: string): Actor => ({
  principal: client,
  role: "operator",
  version: 0,
});
export const mayChange = (role: Role, action: string) =>
  role === "operator" ||
  (role === "reviewer" &&
    ["approve", "verify", "review-work"].includes(action));
const digest = (s: string) => createHash("sha256").update(s).digest();
export const credentialDigest = (principal: string, secret: string) =>
  digest("Basic " + Buffer.from(principal + ":" + secret).toString("base64"));
const hasMembers = (db: DatabaseSync) =>
  !!db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='workos_members'",
    )
    .get();
function checkName(client: string, name: string) {
  requireValue(
    slug(name),
    "Use a short lowercase account name with letters, numbers and hyphens.",
  );
  return client + "/" + name;
}
// The caller owns the installation write transaction. Provisioning never stores a reusable secret.
export function addMember(
  db: DatabaseSync,
  client: string,
  name: string,
  role: string,
  secret: string,
) {
  const principal = checkName(client, name);
  requireValue(roles.includes(role), "Choose operator, reviewer or viewer.");
  requireValue(
    /^[0-9a-f]{64}$/.test(secret),
    "Supply a generated 32-byte hexadecimal credential on standard input.",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS workos_members(principal TEXT PRIMARY KEY,role TEXT NOT NULL,version INTEGER NOT NULL,verifier TEXT NOT NULL)",
  );
  const verifier = credentialDigest(principal, secret).toString("hex");
  const prior = db
    .prepare("SELECT role,verifier FROM workos_members WHERE principal=?")
    .get(principal);
  if (prior) {
    requireValue(
      prior.role === role && prior.verifier === verifier,
      "Account already exists with different credentials or role.",
      409,
    );
    return false;
  }
  db.prepare("INSERT INTO workos_members VALUES(?,?,1,?)").run(
    principal,
    role,
    verifier,
  );
  return true;
}
export function setMemberRole(
  db: DatabaseSync,
  client: string,
  name: string,
  role: string,
) {
  const principal = checkName(client, name);
  requireValue([...roles, "suspended"].includes(role), "Unknown account role.");
  const old =
    hasMembers(db) &&
    db
      .prepare("SELECT role FROM workos_members WHERE principal=?")
      .get(principal);
  requireValue(old, "Named account not found in this installation.", 404);
  if (old.role === role) return false;
  db.prepare(
    "UPDATE workos_members SET role=?,version=version+1 WHERE principal=?",
  ).run(role, principal);
  return true;
}
export function authenticate(
  db: DatabaseSync,
  client: string,
  installationDigest: Buffer,
  header: string,
): Actor | null {
  const incoming = digest(header);
  if (timingSafeEqual(incoming, installationDigest))
    return installationActor(client);
  if (header.length > 512 || !header.startsWith("Basic ") || !hasMembers(db))
    return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const principal = decoded.slice(0, decoded.indexOf(":"));
  if (
    !principal.startsWith(client + "/") ||
    !slug(principal.slice(client.length + 1))
  )
    return null;
  const row = db
    .prepare(
      "SELECT role,version,verifier FROM workos_members WHERE principal=?",
    )
    .get(principal);
  if (
    !row ||
    !roles.includes(String(row.role)) ||
    !timingSafeEqual(incoming, Buffer.from(String(row.verifier), "hex"))
  )
    return null;
  return { principal, role: row.role as Role, version: Number(row.version) };
}
// Recheck after acquiring the write lock so a concurrent suspension/demotion cannot authorize a stale write.
export function requireMutation(
  db: DatabaseSync,
  client: string,
  actor: Actor,
  action: string,
) {
  let current =
    actor.principal === client &&
    actor.role === "operator" &&
    actor.version === 0;
  if (!current && actor.principal.startsWith(client + "/") && hasMembers(db)) {
    const row = db
      .prepare("SELECT role,version FROM workos_members WHERE principal=?")
      .get(actor.principal);
    current = !!row && row.role === actor.role && row.version === actor.version;
  }
  requireValue(
    current && mayChange(actor.role, action),
    "Your account cannot perform this operation.",
    403,
  );
}
