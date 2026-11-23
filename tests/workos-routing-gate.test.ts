import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContract } from "../scripts/workos-routing-contract.mjs";

// Regression floor for every frozen routing set. A change may match more,
// never pick a wrong pin and never select on a request labelled "decline".
const floors: Record<string, number> = {
  contract: 59,
  holdout: 127,
  conversational: 155,
  "conversational-dev": 107,
};

test("frozen routing sets keep zero wrong pins, zero selected declines and their recall floor", () => {
  for (const [set, floor] of Object.entries(floors)) {
    const r = evaluateContract(set);
    assert.equal(r.router.wrongPin, 0, set);
    const selectedDeclines = r.rows.filter(
      (row: any) => row.intent === "decline" && row.actual !== null,
    );
    assert.deepEqual(selectedDeclines, [], set);
    assert.ok(r.router.matched >= floor, `${set}: ${r.router.matched} < ${floor}`);
  }
});
