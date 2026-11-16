// Overview: every website's chart and tiles come with the page, so picking one changes nothing else. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../lib/api.ts";
import { makeState } from "../lib/sample.ts";

test("overview carries each website's chart and tiles, and clients mode has none", () => {
  const now = Date.UTC(2026, 10, 14, 10);
  const state = makeState(now);
  const call = (scope: string) => handle(state, { method: "GET", path: "/api/overview", query: { scope }, now } as any).data;
  const all = call("sites:all");
  const sites = state.workspaces.main.sites;
  assert.ok(sites.length > 1);
  assert.deepEqual(Object.keys(all.bySite).sort(), ["all", ...sites.map((s: any) => s.id)].sort());
  assert.deepEqual(all.bySite.all.chart, all.chart, "All websites matches the page chart");
  const one = call("site:" + sites[0].id);
  assert.deepEqual(all.bySite[sites[0].id].chart, one.chart, "a picked website matches what the page would load for it");
  assert.deepEqual(all.bySite[sites[0].id].numbers.slice(0, 3), one.numbers.slice(0, 3));
  assert.deepEqual(all.top, call("sites:all").top, "the attention list is not tied to the chart");
  const cl = call("clients:all");
  assert.equal(cl.bySite, null);
  assert.equal(cl.chart, null);
  assert.ok(cl.numbers.some((n: any) => n.id === "replies"));
});
