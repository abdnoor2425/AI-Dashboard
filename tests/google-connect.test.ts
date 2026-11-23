import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "keystone-google-test-"));
process.env.KEYSTONE_HOME = home;
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
const { googleAuthUrl, googleReady } = await import("../lib/server/google.ts");
const { getSecrets } = await import("../lib/server/store.ts");

test.after(() => fs.rmSync(home, { recursive: true, force: true }));

test("each Google app asks only for its own access, with the built-in Google app", () => {
  assert.equal(googleReady("ws1"), true);
  const scopes = (tool: string, send = false) => new URL(googleAuthUrl("ws1", "http://localhost:3210", tool, send)!).searchParams.get("scope")!.split(" ");
  assert.deepEqual(scopes("drive").filter((s) => s.startsWith("https")), ["https://www.googleapis.com/auth/drive.metadata.readonly"]);
  assert.deepEqual(scopes("google-analytics").filter((s) => s.startsWith("https")), ["https://www.googleapis.com/auth/analytics.readonly"]);
  assert.ok(!scopes("gmail").includes("https://www.googleapis.com/auth/gmail.send"));
  assert.ok(scopes("gmail", true).includes("https://www.googleapis.com/auth/gmail.send"));
  const u = new URL(googleAuthUrl("ws1", "http://localhost:3210", "gmail")!);
  assert.equal(u.searchParams.get("client_id"), "test-client.apps.googleusercontent.com");
  assert.equal(u.searchParams.get("include_granted_scopes"), "true");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("redirect_uri"), "http://localhost:3210/api/oauth/google/callback");
  assert.equal(getSecrets("ws1").google.pending, "gmail");
  assert.equal(googleAuthUrl("ws1", "http://localhost:3210", "linear"), null);
});

test("the first Google sign-in asks for every Google app at once, and connects only the ones the person allowed", async () => {
  const { finishGoogle, GOOGLE_TOOLS } = await import("../lib/server/google.ts");
  const u = new URL(googleAuthUrl("ws2", "http://localhost:3210", "account", false, GOOGLE_TOOLS)!);
  const asked = u.searchParams.get("scope")!.split(" ");
  for (const s of ["analytics.readonly", "calendar.readonly", "gmail.metadata", "drive.metadata.readonly"]) assert.ok(asked.includes("https://www.googleapis.com/auth/" + s), s);
  assert.ok(!asked.includes("https://www.googleapis.com/auth/gmail.send"));
  assert.equal(new Set(asked).size, asked.length);
  const state = String(u.searchParams.get("state"));
  const real = globalThis.fetch;
  // The person unticked Drive on Google's page.
  globalThis.fetch = (async () => new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "openid email https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.metadata" }), { status: 200 })) as any;
  try {
    const done = await finishGoogle(state, "code", "http://localhost:3210");
    assert.equal(done.tool, "account");
    assert.deepEqual([...done.tools].sort(), ["calendar", "gmail", "google-analytics"]);
  } finally { globalThis.fetch = real; }
  // A later Connect for one app asks for that app alone.
  const one = new URL(googleAuthUrl("ws2", "http://localhost:3210", "drive")!).searchParams.get("scope")!.split(" ").filter((s) => s.startsWith("https"));
  assert.deepEqual(one, ["https://www.googleapis.com/auth/drive.metadata.readonly"]);
});
