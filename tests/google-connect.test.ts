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
