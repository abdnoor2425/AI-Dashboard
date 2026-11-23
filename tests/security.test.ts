// Security fixes: the Google secret is not in the repo, the relay only does its one job, and Stripe is read only and never invents numbers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { handle } from "../relay/worker.js";
import { tokenTarget } from "../lib/server/google.ts";

const ENV = { GOOGLE_CLIENT_ID: "id.apps.example", GOOGLE_CLIENT_SECRET: "relay-only-secret" };
const post = (body: Record<string, string>, p = "/token") => new Request("https://relay.example" + p, { method: "POST", body: new URLSearchParams(body) });
const CB = "http://localhost:3210/api/oauth/google/callback";

test("no Google secret is left anywhere in the source", () => {
  const skip = new Set(["node_modules", ".next", ".git", ".keystone"]);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => skip.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const hits = walk(".").filter((f) => /\.(ts|tsx|js|mjs|json|md|html|css|yml)$/.test(f) && /GOCSPX-[A-Za-z0-9_-]{10,}/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(hits, []);
});

test("with a relay the dashboard never sends a secret", () => {
  const viaRelay = tokenTarget({ clientId: "a", clientSecret: "", relay: "https://relay.example" }, { grant_type: "refresh_token", refresh_token: "r" });
  assert.equal(viaRelay.url, "https://relay.example/token");
  assert.equal("client_secret" in viaRelay.body, false);
  const own = tokenTarget({ clientId: "a", clientSecret: "mine", relay: "" }, { grant_type: "refresh_token", refresh_token: "r" });
  assert.equal(own.url, "https://oauth2.googleapis.com/token");
  assert.equal(own.body.client_secret, "mine");
});

test("the relay adds the secret, forwards only what Google needs and passes the answer back", async () => {
  let seen: any = null;
  const google = async (url: any, opts: any) => { seen = { url: String(url), body: new URLSearchParams(opts.body), opts }; return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 }); };
  const r = await handle(post({ grant_type: "authorization_code", code: "c", code_verifier: "v", redirect_uri: CB, client_id: ENV.GOOGLE_CLIENT_ID, client_secret: "ignored", extra: "x" }), ENV, google as any);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).access_token, "at");
  assert.equal(seen.url, "https://oauth2.googleapis.com/token");
  assert.equal(seen.opts.redirect, "error");
  assert.equal(seen.body.get("client_secret"), ENV.GOOGLE_CLIENT_SECRET);
  assert.equal(seen.body.get("extra"), null);
  assert.deepEqual([...seen.body.keys()].sort(), ["client_id", "client_secret", "code", "code_verifier", "grant_type", "redirect_uri"]);
});

test("the relay refuses everything else", async () => {
  const never = async () => { throw new Error("must not call Google"); };
  const code = async (req: Request, env: any = ENV) => (await handle(req, env, never as any)).status;
  assert.equal(await code(post({ grant_type: "authorization_code", code: "c", code_verifier: "v", redirect_uri: "https://evil.example/api/oauth/google/callback" })), 400);
  assert.equal(await code(post({ grant_type: "authorization_code", code: "c", code_verifier: "v", redirect_uri: "http://localhost.evil.example/api/oauth/google/callback" })), 400);
  assert.equal(await code(post({ grant_type: "client_credentials" })), 400);
  assert.equal(await code(post({ grant_type: "refresh_token" })), 400);
  assert.equal(await code(post({ grant_type: "refresh_token", refresh_token: "r", client_id: "someone-else" })), 400);
  assert.equal(await code(post({ grant_type: "refresh_token", refresh_token: "r" }, "/other")), 404);
  assert.equal(await code(new Request("https://relay.example/token")), 405);
  assert.equal(await code(post({ grant_type: "refresh_token", refresh_token: "r" }), {}), 503);
  assert.equal(await code(post({ grant_type: "refresh_token", refresh_token: "x".repeat(9000) })), 413);
});

test("Stripe: a key is only used after its permissions were confirmed, reads are GET only, and a failed read is an error", async () => {
  const dir = fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "aid-stripe-"));
  const { spawnSync } = await import("node:child_process");
  const script = `import assert from 'node:assert/strict';import {setSecrets} from './lib/server/store.ts';import {syncStripe} from './lib/server/stripe.ts';
    setSecrets('t',{stripe:{token:'rk_test_syntheticfixtureonly'}});
    await assert.rejects(syncStripe('t',Date.now()),/Review the existing key/);
    setSecrets('t',{stripe:{token:'rk_test_syntheticfixtureonly',scopesReviewed:true}});
    globalThis.fetch=async(url,opts)=>{assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');const u=new URL(url);assert.equal(u.origin,'https://api.stripe.com');
      if(u.pathname.endsWith('/payouts'))return new Response('{}',{status:403});return new Response(JSON.stringify({data:[],has_more:false}),{status:200})};
    await assert.rejects(syncStripe('t',Date.now()),/missing a read box/);`;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], { cwd: process.cwd(), env: { ...process.env, KEYSTONE_HOME: dir, HOME: dir, USERPROFILE: dir }, encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
});

test("Windows: a folder is private only when this account is the one name on its access list", async () => {
  const { onlyThisAccount } = await import("../lib/workos/private.mjs");
  const dir = "C:\\Users\\rowan\\clients\\alder";
  assert.equal(onlyThisAccount(`${dir} DESKTOP-1\\rowan:(OI)(CI)(F)\r\n\r\nSuccessfully processed 1 files; Failed processing 0 files\r\n`, dir, "rowan"), true);
  assert.equal(onlyThisAccount(`${dir}\\access DESKTOP-1\\Rowan:(I)(F)\r\n`, dir + "\\access", "rowan"), true);
  assert.equal(onlyThisAccount(`${dir} DESKTOP-1\\rowan:(OI)(CI)(F)\r\n      BUILTIN\\Users:(OI)(CI)(RX)\r\n`, dir, "rowan"), false);
  assert.equal(onlyThisAccount(`${dir} NT AUTHORITY\\SYSTEM:(OI)(CI)(F)\r\n`, dir, "rowan"), false);
  assert.equal(onlyThisAccount("", dir, "rowan"), false);
});
