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
