import assert from "node:assert/strict";
import process from "node:process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { catalogue, eligible } from "../lib/workos/config.ts";
import { selectSkill } from "../lib/workos/routing.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
// Line endings are made the same first, so a Windows download of the same file gives the same checksum.
const fixture = read("../tests/fixtures/workos-routing-contract.json").replace(/\r\n/g, "\n");
const corpus = JSON.parse(fixture);
const alder = JSON.parse(read("../examples/workos/alder.json"));
const checksum = createHash("sha256").update(fixture).digest("hex");
assert.equal(
  checksum,
  "da4f06ab02d8a53a4b4225176fff4febf8771df225f78967642c147606694752",
);
function score(rows, key) {
  const positive = rows.filter((r) => r.expected !== null);
  const negative = rows.length - positive.length;
  const matched = positive.filter((r) => r[key] === r.expected).length;
  const missed = positive.filter((r) => r[key] === null).length;
  const wrongPin = positive.length - matched - missed;
  const correctDeclines = rows.filter(
    (r) => r.expected === null && r[key] === null,
  ).length;
  return {
    cases: rows.length,
    positive: positive.length,
    requiredAbstentions: negative,
    matched,
    missed,
    wrongPin,
    correctDeclines,
    unexpectedSelection: negative - correctDeclines,
    correct: matched + correctDeclines,
  };
}
// The expected pin is read from a frozen contract table. It never comes from runtime eligibility or alias matching.
export function evaluateContract(set = "contract") {
  const files = {
    holdout: [
      "../tests/fixtures/workos-routing-holdout.json",
      "9208a76ad0ea68c659df673e8ae7e50cb4b8eba69f40658e82879a1e615d46dd",
    ],
    conversational: [
      "../tests/fixtures/workos-routing-conversational.json",
      "6423352e75f0bbec2f1cfddb4a52d413085907069fb160b8237d2a91018db134",
    ],
    "conversational-dev": [
      "../tests/fixtures/workos-routing-conversational-dev.json",
      "3141fd489f0756aec857230434b918d6ea0538b8d6475ed1469c923df50eea0c",
    ],
  };
  assert.ok(set === "contract" || Object.hasOwn(files, set));
  const heldout = set === "contract" ? null : read(files[set][0]);
  const digest =
    heldout === null
      ? checksum
      : createHash("sha256").update(heldout).digest("hex");
  if (heldout !== null)
    assert.equal(digest, files[set][1]);
  const requests =
    heldout === null ? corpus.requests : JSON.parse(heldout).requests;
  const rows = [];
  for (const profile of corpus.profiles) {
    const c = {
      ...alder,
      ...profile.overrides,
      enabledSkills: profile.enabled.map((p) => corpus.pins[p]),
      deprecatedSkills: (profile.overrides.deprecatedSkills ?? []).map(
        (p) => corpus.pins[p],
      ),
    };
    for (const item of requests) {
      const label =
        item.intent === "decline"
          ? null
          : item.intent === "percent"
            ? ["revision-two", "two-revisions"].includes(profile.id)
              ? "goal2"
              : null
            : profile.expected[item.intent];
      assert.ok(label === null || Object.hasOwn(corpus.pins, label));
      const expected = label === null ? null : corpus.pins[label];
      const match = selectSkill(c, item.text, undefined, profile.measured);
      const examples = catalogue.filter(
        (s) =>
          eligible(c, s.pin) &&
          (!s.needsMeasurement || profile.measured) &&
          s.example.toLowerCase() === item.text.toLowerCase(),
      );
      rows.push({
        profile: profile.id,
        id: item.id,
        group: item.group ?? item.intent,
        intent: item.intent,
        expected,
        actual: match.selected,
        reason: match.reason,
        baseline: examples.length === 1 ? examples[0].pin : null,
      });
    }
  }
  function breakdown(key) {
    return Object.fromEntries(
      [...new Set(rows.map((row) => row[key]))].map((value) => {
        const group = rows.filter((row) => row[key] === value);
        return [
          value,
          {
            router: score(group, "actual"),
            baseline: score(group, "baseline"),
          },
        ];
      }),
    );
  }
  return {
    corpusSha256: digest,
    requestCount: requests.length,
    profileCount: corpus.profiles.length,
    router: score(rows, "actual"),
    exampleLookup: score(rows, "baseline"),
    byGroup: breakdown("group"),
    byProfile: breakdown("profile"),
    rows,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(
    JSON.stringify(evaluateContract(process.argv[2] ?? "contract"), null, 2),
  );
