// Independent policy oracle for the four local revision contracts. No runtime catalogue, alias or eligibility helpers are used in expected results.
import { readFileSync } from "node:fs";
import process from "node:process";
import { selectSkill } from "../lib/workos/routing.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../examples/workos/alder.json", import.meta.url)),
);
const contracts = [
  {
    pin: "workos.goal-checkin@1.0.0",
    intent: "goal",
    tool: 1,
    grants: 9,
    needsObservation: true,
  },
  {
    pin: "workos.goal-checkin@1.1.0",
    intent: "goal",
    tool: 1,
    grants: 9,
    needsObservation: true,
  },
  {
    pin: "workos.deadline-review@1.0.0",
    intent: "deadline",
    tool: 2,
    grants: 10,
    needsObservation: false,
  },
  {
    pin: "workos.evidence-handoff@1.0.0",
    intent: "handoff",
    tool: 4,
    grants: 14,
    needsObservation: true,
  },
];
const tools = [
  "WorkOS local calculator",
  "WorkOS local calendar",
  "WorkOS local notes",
];
const grants = ["goals.read", "queue.read", "evidence.read", "receipts.write"];
const requests = [
  ["goal", "Review goal progress"],
  ["deadline", "Check the task deadline"],
  ["handoff", "Prepare a handoff note"],
  ["ordinary", "Could you check the latest reading against our goal?"],
  ["deadline", "Tell me when the current action is due."],
  ["handoff", "Compose a local handover brief for the task owner."],
  ["percent", "Calculate our progress in percent."],
];
const bits = (mask, values) => values.filter((_, i) => (mask & (1 << i)) !== 0);
const pins = contracts.map((c) => c.pin);
const counts = {
  cases: 0,
  expectedSelections: 0,
  requiredAbstentions: 0,
  matched: 0,
  correctAbstentions: 0,
  wrongPin: 0,
  missed: 0,
  unexpectedSelection: 0,
};
const examples = [];
for (let enabled = 0; enabled < 16; enabled++) {
  for (let retired = 0; retired < 16; retired++) {
    for (let toolMask = 0; toolMask < 8; toolMask++) {
      for (let grantMask = 0; grantMask < 16; grantMask++) {
        for (const moduleEnabled of [false, true]) {
          const deployment = {
            ...fixture,
            modules: moduleEnabled ? ["skills"] : [],
            enabledSkills: bits(enabled, pins),
            deprecatedSkills: bits(retired, pins),
            availableTools: bits(toolMask, tools),
            permissions: bits(grantMask, grants),
          };
          for (const observed of [false, true]) {
            for (const [intent, text] of requests) {
              const allowed = contracts.filter(
                (c, i) =>
                  moduleEnabled &&
                  (intent === "percent"
                    ? c.pin === "workos.goal-checkin@1.1.0"
                    : intent === "ordinary"
                      ? c.pin === "workos.goal-checkin@1.0.0"
                      : c.intent === intent) &&
                  enabled & (1 << i) &&
                  !(retired & (1 << i)) &&
                  toolMask & c.tool &&
                  (grantMask & c.grants) === c.grants &&
                  (!c.needsObservation || observed),
              );
              for (const override of [undefined, ...pins]) {
                const choices =
                  override === undefined
                    ? allowed
                    : allowed.filter((c) => c.pin === override);
                const expected = choices.length === 1 ? choices[0].pin : null;
                const actual = selectSkill(
                  deployment,
                  text,
                  override,
                  observed,
                ).selected;
                counts.cases++;
                if (expected === null) counts.requiredAbstentions++;
                else counts.expectedSelections++;
                if (expected === actual)
                  counts[
                    expected === null ? "correctAbstentions" : "matched"
                  ]++;
                else {
                  counts[
                    expected === null
                      ? "unexpectedSelection"
                      : actual === null
                        ? "missed"
                        : "wrongPin"
                  ]++;
                  if (examples.length < 10)
                    examples.push({
                      enabled,
                      retired,
                      toolMask,
                      grantMask,
                      moduleEnabled,
                      observed,
                      intent,
                      override,
                      expected,
                      actual,
                    });
                }
              }
            }
          }
        }
      }
    }
  }
}
console.log(JSON.stringify({ counts, examples }, null, 2));
if (
  counts.cases !== 4587520 ||
  counts.wrongPin ||
  counts.missed ||
  counts.unexpectedSelection
)
  process.exitCode = 1;
