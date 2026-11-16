import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "keystone-errors-test-"));
process.env.KEYSTONE_HOME = home;
const { plainError } = await import("../lib/server/sync.ts");
const { syncLinear } = await import("../lib/server/linear.ts");
const { setSecrets } = await import("../lib/server/store.ts");

test.after(() => fs.rmSync(home, { recursive: true, force: true }));

test("connection problems are explained in plain words", async () => {
  assert.match(plainError(new TypeError("fetch failed"), "Linear"), /^Couldn't reach Linear\. Check your internet connection/);
  assert.equal(plainError(new Error("Metricool refused the token."), "Metricool"), "Metricool refused the token.");

  setSecrets("ws1", { linear: { token: "lin_api_wrong" } });
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ errors: [{ message: "Authentication required, not authenticated" }] }), { status: 400 })) as any;
  try { await assert.rejects(syncLinear("ws1", "Maya", Date.now()), /Linear didn't accept that API key/); }
  finally { globalThis.fetch = real; }
});
