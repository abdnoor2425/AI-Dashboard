#!/usr/bin/env node
// One foreground process, one installation and one loopback origin. Never start the desktop API in client mode.
import { PRIVATE_HINT, isPrivate, place, privateTemp, samePath } from "../lib/workos/private.mjs";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  configOf,
  configure,
  initialize,
  transaction,
} from "../lib/workos/operations.ts";
import { createPlanTables } from "../lib/workos/plan.ts";
import { request } from "../lib/workos/dashboard.ts";
import {
  validate,
  requireValue,
  Problem,
  kitVersion,
} from "../lib/workos/config.ts";
import { BrainError, changeBrain } from "../lib/server/brain.ts";

import { importCatalogueHistory } from "../lib/workos/catalogue-history.ts";

import {
  authenticate,
  credentialDigest,
  addMember,
  setMemberRole,
} from "../lib/workos/identity.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readConfig = (file) =>
  validate(JSON.parse(fs.readFileSync(file, "utf8")));

const databaseBusy = (e) =>
  e?.code === "ERR_SQLITE_ERROR" && [5, 6].includes(e.errcode & 255);
const busyMessage =
  "The installation is busy. Retry the same operation after the writer finishes.";
const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
};

async function readBody(req, limit) {
  requireValue(
    /^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || ""),
    "Send a JSON object.",
    415,
  );
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    requireValue(size <= limit, "Request exceeds the size limit.", 413);
    parts.push(part);
  }
  try {
    const obj = JSON.parse(Buffer.concat(parts).toString());
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  } catch {}
  throw new Problem("Invalid JSON object.");
}

function privateFile(file) {
  const st = fs.lstatSync(file);
  requireValue(
    st.isFile() && st.nlink === 1 && isPrivate(file, st),
    "Use a private, regular installation file with no additional links.",
  );
  return file;
}
async function serve(dir, db) {
  const c = configOf(db),
    host = "127.0.0.1:" + c.port,
    origin = "http://" + host;
  const credential = fs
    .readFileSync(privateFile(path.join(dir, "access")), "utf8")
    .trim();
  requireValue(
    /^[\w-]{43}$/.test(credential),
    "Invalid installation credential.",
  );
  const digest = credentialDigest(c.client, credential);
  process.env.WORKOS_LOCAL_CLIENT = "1";
  const { default: next } = await import("next");
  const app = next({
    dev: false,
    dir: root,
    hostname: "127.0.0.1",
    port: c.port,
  });
  await app.prepare();
  const render = app.getRequestHandler();
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
      requireValue(
        req.headers.host === host &&
          (!req.headers.origin || req.headers.origin === origin) &&
          !["cross-site", "same-site"].includes(req.headers["sec-fetch-site"]),
        "Use this installation’s local origin.",
        403,
      );
      const actor = authenticate(
        db,
        c.client,
        digest,
        req.headers.authorization || "",
      );
      if (!actor) {
        res.setHeader(
          "WWW-Authenticate",
          'Basic realm="' + c.client + '", charset="UTF-8"',
        );
        return json(res, 401, { error: "Sign in to this installation." });
      }
      requireValue(
        req.url.startsWith("/") && !req.url.startsWith("//"),
        "Invalid address.",
      );
      const url = new URL(req.url, origin);
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        requireValue(
          ["GET", "POST"].includes(req.method),
          "Unsupported method.",
          405,
        );
        const body =
          req.method === "POST"
            ? await readBody(
                req,
                [
                  "/api/workos/plan",
                  "/api/workos/new-plan",
                  "/api/workos/reconcile",
                ].includes(url.pathname)
                  ? 131072
                  : 8192,
              )
            : {};
        return json(
          res,
          200,
          request(
            db,
            dir,
            req.method,
            url.pathname.slice(5),
            url.searchParams,
            body,
            actor,
          ),
        );
      }
      requireValue(
        req.method === "GET" || req.method === "HEAD",
        "Unsupported method.",
        405,
      );
      const p = url.pathname;
      requireValue(
        p === "/" ||
          p === "/icon.svg" ||
          p === "/ui/app.js" ||
          /^\/_next\/static\/[a-zA-Z0-9_./%\[\]-]+$/.test(p),
        "Page not found.",
        404,
      );
      requireValue(!/%(?:2e|2f|5c)/i.test(p), "Invalid asset path.", 404);
      // Pass the canonical asset path only. Next sees no client-controlled routing or forwarding headers.
      req.url = p;
      req.headers = { host, accept: req.headers.accept || "*/*" };
      return await render(req, res);
    } catch (e) {
      const status = databaseBusy(e)
        ? 503
        : e instanceof Problem || e instanceof BrainError
          ? e.status
          : 500;
      if (status === 503 && !res.headersSent) res.setHeader("Retry-After", "1");
      if (!res.headersSent)
        json(res, status, {
          error:
            status === 503
              ? busyMessage
              : status === 500
                ? "Local operation failed."
                : e.message,
        });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(c.port, "127.0.0.1", resolve);
  });
  console.log("WorkOS " + c.client + " at " + origin + "/#workos");
  const stop = () => {
    server.close(async () => {
      db.close();
      await app.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

// Backups hold the database snapshot, the installation credential and the
// project documents. The search index is derived and is rebuilt by `index`.
const backupFormat = "workos-backup/v1";
const sha256 = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function newDirectory(target) {
  const dir = path.resolve(target);
  requireValue(
    dir !== root && !dir.startsWith(root + path.sep),
    "Keep client data outside the checkout.",
  );
  requireValue(
    !fs.existsSync(dir),
    "Use a new directory. Existing data is preserved.",
  );
  const parent = fs.realpathSync(path.dirname(dir));
  requireValue(samePath(parent, path.dirname(dir)), "Choose a real parent directory.");
  return dir;
}
// Copy a private tree without following links. Links and special files are refused.
function copyPrivateTree(from, to) {
  fs.mkdirSync(to, { mode: 0o700 });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name),
      b = path.join(to, entry.name);
    if (entry.isDirectory()) copyPrivateTree(a, b);
    else {
      requireValue(
        entry.isFile(),
        "The project directory may contain only regular files and folders.",
      );
      fs.copyFileSync(a, b, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(b, 0o600);
    }
  }
}
function checkedDatabase(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    requireValue(
      db.prepare("PRAGMA integrity_check").get().integrity_check === "ok",
      "Database integrity check failed.",
    );
    const schema = db.prepare("PRAGMA user_version").get().user_version;
    requireValue(schema >= 1 && schema <= 3, "Unknown installation schema.");
    const c = validate(
      JSON.parse(db.prepare("SELECT config FROM installation").get().config),
    );
    return { schema, client: c.client };
  } finally {
    db.close();
  }
}
// Place a prepared temporary directory at a new final path.
function publish(temp, dir) {
  place(temp, dir);
}
function backup(dir, db, c, target) {
  requireValue(typeof target === "string", "Supply a new backup directory.");
  const dest = newDirectory(target);
  const temp = privateTemp(path.join(path.dirname(dest), "workos-backup-"));
  try {
    const copy = path.join(temp, "workos.sqlite");
    // VACUUM INTO writes one consistent snapshot, even while the launcher runs.
    db.prepare("VACUUM INTO ?").run(copy);
    fs.chmodSync(copy, 0o600);
    const checked = checkedDatabase(copy);
    requireValue(checked.client === c.client, "Snapshot client mismatch.");
    fs.copyFileSync(
      path.join(dir, "access"),
      path.join(temp, "access"),
      fs.constants.COPYFILE_EXCL,
    );
    fs.chmodSync(path.join(temp, "access"), 0o600);
    copyPrivateTree(path.join(dir, "project"), path.join(temp, "project"));
    fs.writeFileSync(
      path.join(temp, "backup.json"),
      JSON.stringify(
        {
          format: backupFormat,
          client: c.client,
          kit: kitVersion,
          schema: checked.schema,
          created: new Date().toISOString(),
          databaseSha256: sha256(copy),
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    publish(temp, dest);
    console.log("Backup of " + c.client + " written to " + dest);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
function restore(source, target) {
  requireValue(
    typeof source === "string" && typeof target === "string",
    "Use workos restore <backup-directory> <new-installation-directory>.",
  );
  const from = path.resolve(source);
  requireValue(
    fs.existsSync(from) &&
      samePath(fs.realpathSync(from), from) &&
      isPrivate(from),
    "Use a private backup directory (" + PRIVATE_HINT + ").",
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(from, "backup.json"), "utf8"),
  );
  requireValue(manifest?.format === backupFormat, "Unknown backup format.");
  const database = privateFile(path.join(from, "workos.sqlite"));
  privateFile(path.join(from, "access"));
  requireValue(
    sha256(database) === manifest.databaseSha256,
    "The backup database does not match its manifest.",
  );
  const checked = checkedDatabase(database);
  requireValue(
    checked.client === manifest.client && checked.schema === manifest.schema,
    "The backup manifest does not match its database.",
  );
  const dest = newDirectory(target);
  const temp = privateTemp(path.join(path.dirname(dest), "workos-restore-"));
  try {
    for (const name of ["workos.sqlite", "access"]) {
      fs.copyFileSync(
        path.join(from, name),
        path.join(temp, name),
        fs.constants.COPYFILE_EXCL,
      );
      fs.chmodSync(path.join(temp, name), 0o600);
    }
    copyPrivateTree(path.join(from, "project"), path.join(temp, "project"));
    publish(temp, dest);
    console.log(
      "Restored " +
        checked.client +
        " (schema " +
        checked.schema +
        ") to " +
        dest +
        ". Run index next" +
        (checked.schema < 3 ? ", then upgrade." : "."),
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
async function main() {
  const [action, destination, file, role] = process.argv.slice(2);
  requireValue(
    destination &&
      [
        "upgrade",
        "install",
        "start",
        "update",
        "rollback",
        "index",
        "clear-usage",
        "catalogue-import",
        "member-add",
        "member-role",
        "backup",
        "restore",
      ].includes(action),
    "Use workos <install|upgrade|start|update|rollback|index|clear-usage|catalogue-import|member-add|member-role|backup|restore> <private-directory> [config.json|destination].",
  );
  const dir = path.resolve(destination);
  requireValue(
    dir !== root && !dir.startsWith(root + path.sep),
    "Keep client data outside the checkout.",
  );
  process.umask(0o077);
  if (action === "restore") return restore(destination, file);
  if (action === "install") {
    const c = readConfig(file);
    requireValue(
      !fs.existsSync(dir),
      "Install into a new directory. Existing data is preserved.",
    );
    const parent = fs.realpathSync(path.dirname(dir));
    requireValue(
      samePath(parent, path.dirname(dir)),
      "Choose a real parent directory.",
    );
    const temp = privateTemp(path.join(parent, "workos-install-"));
    try {
      const db = new DatabaseSync(path.join(temp, "workos.sqlite"));
      try {
        initialize(db, c);
      } finally {
        db.close();
      }
      fs.writeFileSync(
        path.join(temp, "access"),
        randomBytes(32).toString("base64url") + "\n",
        { mode: 0o600, flag: "wx" },
      );
      fs.mkdirSync(path.join(temp, "project"));
      fs.writeFileSync(
        path.join(temp, "project", "WorkOS.md"),
        "# " +
          c.name +
          "\n\n" +
          c.goal.quarter +
          "\n\nSource: " +
          c.goal.source +
          "\n",
      );
      // Reserve the final name exclusively before moving the prepared files into it.
      place(temp, dir);
      console.log(
        "Installed " +
          c.client +
          ". Username: " +
          c.client +
          ". Password file: " +
          path.join(dir, "access"),
      );
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
    return;
  }
  requireValue(
    samePath(fs.realpathSync(dir), dir) && isPrivate(dir),
    "Use a private installation directory (" + PRIVATE_HINT + ").",
  );
  const dbFile = path.join(dir, "workos.sqlite");
  privateFile(dbFile);
  const db = new DatabaseSync(dbFile, { timeout: 750 });
  try {
    if (action === "upgrade") {
      const version = db.prepare("PRAGMA user_version").get().user_version;
      if (version === 3) {
        console.log("Schema 3 is already installed.");
        return;
      }
      requireValue(version === 1 || version === 2, "Unknown legacy schema.");
      const backup = path.join(dir, "before-schema-3.sqlite");
      requireValue(
        !fs.existsSync(backup),
        "A prior backup exists. Inspect it before resuming the upgrade.",
      );
      const before = db.prepare("PRAGMA data_version").get().data_version;
      db.prepare("VACUUM INTO ?").run(backup);
      const saved = new DatabaseSync(backup, { readOnly: true });
      try {
        requireValue(
          saved.prepare("PRAGMA integrity_check").get().integrity_check ===
            "ok",
          "Backup integrity check failed.",
        );
      } finally {
        saved.close();
      }
      transaction(db, () => {
        requireValue(
          db.prepare("PRAGMA data_version").get().data_version === before,
          "Installation changed during backup. Stop all writers and preserve the backup before retrying.",
        );
        const old = validate(
          JSON.parse(
            db.prepare("SELECT config FROM installation").get().config,
          ),
        );
        if (version === 1) createPlanTables(db, old);
        // Schema 3 receipts can bind multiple revisions. Earlier binaries must reject this database.
        db.exec("PRAGMA user_version=3");
      });
      console.log(
        "Upgraded to schema 3. Stopped-installation rollback database: " +
          backup,
      );
      return;
    }
    const c = configOf(db);
    if (action === "backup") return backup(dir, db, c, file);
    if (action === "member-add" || action === "member-role") {
      requireValue(
        process.argv.length === 6,
        "Supply the account name and role.",
      );
      if (action === "member-add") {
        requireValue(
          !process.stdin.isTTY,
          "Provide a generated credential via private standard input.",
        );
        let secret = "";
        for await (const chunk of process.stdin) {
          secret += chunk.toString("utf8");
          requireValue(secret.length <= 66, "Invalid credential length.");
        }
        transaction(db, () =>
          addMember(db, c.client, file, role, secret.replace(/\r?\n$/, "")),
        );
      } else transaction(db, () => setMemberRole(db, c.client, file, role));
      console.log("Account configured for " + c.client + "/" + file);
      return;
    }
    if (action === "start") {
      await serve(dir, db);
      return;
    }
    if (action === "catalogue-import") {
      requireValue(
        typeof file === "string",
        "Supply a reviewed local metadata file.",
      );
      const fd = fs.openSync(
        file,
        fs.constants.O_RDONLY |
          fs.constants.O_NONBLOCK |
          fs.constants.O_NOFOLLOW,
      );
      try {
        const st = fs.fstatSync(fd);
        const limit = 8 * 1024 * 1024;
        requireValue(
          st.isFile() && st.nlink === 1 && st.size > 0 && st.size <= limit,
          "Use a regular metadata file up to 8 MiB.",
        );
        const bytes = Buffer.alloc(st.size + 1);
        let count = 0;
        while (count < bytes.length) {
          const n = fs.readSync(fd, bytes, count, bytes.length - count, null);
          if (n === 0) break;
          count += n;
        }
        requireValue(count === st.size, "Metadata file changed during read.");
        let input;
        try {
          input = JSON.parse(bytes.subarray(0, count).toString("utf8"));
        } catch {
          throw Error("Invalid metadata JSON.");
        }
        const result = importCatalogueHistory(db, input);
        console.log(
          result.changed
            ? "Historical snapshot recorded."
            : "Historical snapshot already recorded.",
        );
      } finally {
        fs.closeSync(fd);
      }
      return;
    }
    if (action === "index") {
      const index = path.join(dir, "index"),
        project = path.join(dir, "project");
      const { getBrain } = await import("../lib/server/brain.ts");
      const source = getBrain(c.client, index).sources[0];
      changeBrain(
        c.client,
        source
          ? { action: "rescan", sourceId: source.id }
          : { action: "connect", kind: "project", path: project, name: c.name },
        index,
      );
    } else if (action === "clear-usage") db.exec("DELETE FROM events");
    else configure(db, action === "update" ? readConfig(file) : undefined);
    console.log(action + " complete for " + c.client);
  } finally {
    if (action !== "start") db.close();
  }
}
main().catch((err) => {
  console.error(databaseBusy(err) ? busyMessage : err.message);
  process.exitCode = 1;
});
