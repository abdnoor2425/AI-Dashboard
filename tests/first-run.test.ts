import assert from "node:assert/strict";
import test from "node:test";
import { handle, isOnboarded } from "../lib/api.ts";
import { makeState } from "../lib/sample.ts";

test("a new install opens on the welcome flow and ends in the person's own workspace", () => {
  const now = Date.parse("2026-11-16T10:00:00Z");
  const state: any = makeState(now);
  const call = (method: string, path: string, body?: any) => handle(state, { method, path: "/api/" + path, body, now });
  assert.equal(isOnboarded(state), false);
  assert.equal(call("GET", "bootstrap").data.firstRun.step, "intro");

  const { id } = call("POST", "firstrun/start").data;
  assert.equal(state.active, id);
  assert.equal(state.workspaces[id].sample, false);
  assert.equal(call("GET", "bootstrap").data.firstRun.step, "signin");
  // Starting again keeps the same workspace.
  assert.equal(call("POST", "firstrun/start").data.id, id);

  assert.equal(call("POST", "firstrun/step", { step: "nowhere" }).status, 400);
  call("POST", "firstrun/step", { step: "profile" });
  assert.equal(call("POST", "firstrun/profile", { name: "", business: "Northwind" }).status, 400);
  call("POST", "firstrun/profile", { name: "Sam", role: "Founder", business: "Northwind Studio", theme: "light" });
  assert.equal(state.workspaces[id].name, "Northwind Studio");
  assert.equal(state.workspaces[id].team[0].name, "Sam");
  assert.equal(state.theme, "light");
  assert.equal(call("GET", "bootstrap").data.firstRun.step, "welcome");

  call("POST", "firstrun/finish");
  assert.equal(isOnboarded(state), true);
  assert.equal(call("GET", "bootstrap").data.firstRun, null);
  assert.equal(call("GET", "bootstrap").data.workspace.sample, false);

  // Resetting everything goes back to the welcome flow.
  call("POST", "reset", {});
  assert.equal(call("GET", "bootstrap").data.firstRun.step, "intro");
});

test("older installs that already have real data skip the welcome flow", () => {
  const state: any = makeState(Date.now());
  delete state.onboarded;
  assert.equal(isOnboarded(state), false);
  state.workspaces.mine = { ...state.workspaces.main, id: "mine", sample: false };
  assert.equal(isOnboarded(state), true);
});

test("after the welcome flow only the person's own workspaces are left, and new ones start empty", () => {
  const now = Date.parse("2026-11-16T10:00:00Z");
  const state: any = makeState(now);
  const call = (method: string, path: string, body?: any) => handle(state, { method, path: "/api/" + path, body, now });
  assert.ok(Object.values<any>(state.workspaces).some((w) => w.sample));
  const { id } = call("POST", "firstrun/start").data;
  call("POST", "firstrun/profile", { name: "Maya", business: "Harbor & Pine" });
  call("POST", "firstrun/finish");
  assert.deepEqual(Object.keys(state.workspaces), [id]);
  assert.equal(state.active, id);
  assert.ok(call("GET", "workspaces").data.workspaces.every((w: any) => !w.sample));

  // A second workspace, for a client, has no made-up examples in it.
  const extra = call("POST", "workspaces", { name: "Client Co", owner: "Jo", kind: "Bakery", accent: "green" }).data.id;
  const w = state.workspaces[extra];
  assert.equal(w.sample, false);
  assert.equal(w.sites.length, 0);
  assert.equal(w.items.length, 0);

  // Removing works, but the last workspace always stays.
  assert.equal(call("POST", "workspaces/delete", { id: extra }).status, 200);
  assert.equal(call("POST", "workspaces/delete", { id }).status, 400);
  assert.equal(state.active, id);
});
