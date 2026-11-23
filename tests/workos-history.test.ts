import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  initialize,
  configOf,
  configure,
  snapshot,
} from "../lib/workos/operations.ts";
import { manifest, request } from "../lib/workos/dashboard.ts";
import { importCatalogueHistory } from "../lib/workos/catalogue-history.ts";
import { reconcileCoverage } from "../lib/workos/coverage.mjs";
const sample = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      new URL("../examples/workos/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
function fixture(name = "alder") {
  const c = sample(name),
    db = new DatabaseSync(":memory:");
  initialize(db, c);
  const get = (query = "") =>
    request(
      db,
      "unused",
      "GET",
      "workos/catalogue-history",
      new URLSearchParams(query),
    );
  return { db, c, get, put: (input: any) => importCatalogueHistory(db, input) };
}
test("only declared exact aliases merge; independent identical bytes and name collisions survive", () => {
  const e = sample("history/coverage");
  e.coverage.definitions.push({
    ...e.coverage.definitions[0],
    path: "synthetic/independent",
  });
  const r = reconcileCoverage(e.coverage, e.evaluations).summary;
  assert.deepEqual(
    [
      r.definitions,
      r.canonicalDefinitions,
      r.explicitAliases,
      r.uniqueHashes,
      r.sameNameDifferentHashes,
      r.declaredNames,
      r.boundedEvaluationKeys,
    ],
    [5, 4, 1, 3, 1, 2, 1],
  );
  const { db, put, get } = fixture();
  put(e);
  put(sample("history/usage"));
  assert.equal(get().usage.unresolved, 2);
  db.close();
});
test("unsupported identities, orphan evidence, false bounded claims and invalid alias relationships are rejected atomically", () => {
  const { db, put, get } = fixture();
  for (const mutate of [
    (e: any) =>
      (e.evaluations.evaluations[0].instruction_sha256 = "f".repeat(64)),
    (e: any) => (e.evaluations.evaluations.length = 0),
    (e: any) => e.evaluations.evaluations.push(e.evaluations.evaluations[0]),
    (e: any) =>
      (e.coverage.definitions[1].canonical_alias_of =
        e.coverage.definitions[1].path),
    (e: any) =>
      (e.coverage.definitions[1].canonical_alias_of =
        e.coverage.definitions[2].path),
    (e: any) =>
      (e.coverage.definitions[0].path = e.coverage.definitions[2].path),
    (e: any) => (e.coverage.definitions[0].client_ready = "maybe"),
  ]) {
    const env = sample("history/coverage");
    mutate(env);
    assert.throws(() => put(env));
    assert.equal(get().snapshots.length, 0);
  }
  db.close();
});
test("revision imports replay independent of row order, reject forks, preserve named revisions and report changes", () => {
  const { db, put, get } = fixture();
  const one = sample("history/coverage");
  assert.equal(put(one).changed, true);
  one.coverage.definitions.reverse();
  assert.equal(put(one).changed, false);
  const two = structuredClone(one);
  two.revision = "3".repeat(40);
  two.previous = one.revision;
  two.coverage.definitions[0].sha256 = "d".repeat(64);
  assert.deepEqual(put(two).summary.changes, {
    added: 0,
    removed: 0,
    revised: 1,
    metadataChanged: 0,
  });
  assert.equal(put(one).changed, false);
  const changed = structuredClone(one);
  changed.coverage.definitions.pop();
  assert.throws(() => put(changed));
  assert.throws(
    () => put({ ...two, previous: null, revision: "4".repeat(40) }),
    /head changed/,
  );
  const exact = get("source=coverage&revision=" + one.revision);
  assert.equal(exact.rows.length, 4);
  assert.ok(exact.rows.every((row: any) => /^[a-f0-9]{64}$/.test(row.locator)));
  assert.doesNotMatch(JSON.stringify(exact), /synthetic\//);
  assert.equal(get().snapshots.length, 2);
  assert.throws(() => get("source=coverage"), /together/);
  assert.throws(
    () => get("source=usage&revision=" + one.revision),
    /not found/,
  );
  db.close();
});
test("read requests, stated uses, unknowns and zero stay separate from execution, grants and business outcomes", () => {
  const { db, c, put, get } = fixture();
  const usage = sample("history/usage");
  assert.deepEqual([get().coverage, get().usage], [null, null]);
  put(usage);
  assert.equal(get().usage.exactMatches, 0);
  put(sample("history/coverage"));
  const r = get().usage;
  assert.deepEqual([r.exactMatches, r.unresolved], [2, 1]);
  assert.deepEqual(r.totals["read-request"], {
    rows: 1,
    knownTotal: "7",
    unknownRows: 0,
  });
  assert.deepEqual(r.totals["stated-use"], {
    rows: 2,
    knownTotal: "0",
    unknownRows: 1,
  });
  const newer = {
    ...usage,
    revision: "4".repeat(40),
    previous: usage.revision,
    observations: usage.observations.filter((r: any) => r.count === null),
  };
  put(newer);
  assert.equal(get().usage.totals["stated-use"].knownTotal, null);
  for (const bad of [
    [{ ...usage.observations[0], count: -1 }],
    [...usage.observations, usage.observations[0]],
    [{ ...usage.observations[0], kind: "verified" }],
  ]) {
    assert.throws(
      () =>
        put({
          ...newer,
          revision: "5".repeat(40),
          previous: newer.revision,
          observations: bad,
        }),
      /observation/,
    );
  }
  const live = snapshot(db, configOf(db), Date.now());
  assert.equal(live.usage.executed, 0);
  assert.equal(live.usage.verified, 0);
  assert.equal(live.catalog.length, 4);
  assert.deepEqual(configOf(db).enabledSkills, c.enabledSkills);
  db.close();
});
test("installation identity, enabled module and catalogue grant govern CLI and HTTP; there is no HTTP write path", () => {
  const { db, c, get, put } = fixture(),
    b = fixture("birch");
  const env = sample("history/coverage");
  assert.throws(
    () => put({ ...env, installation: b.c.client }),
    /different installation/,
  );
  assert.throws(() => b.put(env), /disabled/);
  assert.throws(() => b.get(), /unavailable/);
  assert.equal(
    manifest(b.c).endpoints.some((e) => e.path.includes("catalogue-history")),
    false,
  );
  put(env);
  configure(db, {
    ...c,
    modules: c.modules.filter((k: string) => k !== "skills"),
  });
  assert.throws(() => get(), /unavailable/);
  assert.throws(() => put(env), /disabled/);
  configure(db);
  assert.equal(get().coverage.definitions, 4);
  assert.throws(
    () =>
      request(
        db,
        "unused",
        "POST",
        "workos/catalogue-history",
        new URLSearchParams(),
        env,
      ),
    /unavailable/,
  );
  db.close();
  b.db.close();
});

test("a selected historical coverage revision explains each match and remains reproducible after the head moves", () => {
  const { db, get, put } = fixture();
  const first = sample("history/coverage"),
    usage = sample("history/usage");
  put(first);
  put(usage);
  const query =
    "source=usage&revision=" + usage.revision + "&coverageRevision=";
  const prior = get(query + first.revision).rows;
  assert.deepEqual(
    prior.map((r: any) => r.match.state),
    ["matched", "missing-hash", "matched"],
  );
  assert.match(prior[0].match.canonical, /^[0-9a-f]{64}$/);
  const next = structuredClone(first);
  next.revision = "4".repeat(40);
  next.previous = first.revision;
  next.coverage.definitions.push({
    ...first.coverage.definitions[0],
    path: "synthetic/independent-v1",
  });
  next.coverage.definitions = next.coverage.definitions.filter(
    (d: any) => d.path !== "synthetic/check-v2",
  );
  put(next);
  assert.deepEqual(
    get(query + next.revision).rows.map((r: any) => r.match.state),
    ["ambiguous", "missing-hash", "unmatched"],
  );
  assert.deepEqual(get(query + first.revision).rows, prior);
  assert.throws(() => get(query + "5".repeat(40)), /not found/);
  assert.throws(() => get("coverageRevision=" + first.revision), /comparison/);
  db.close();
});

test("legacy bounded synthetic claims preserve unavailable evaluation evidence and revisions explain state changes", () => {
  const { db, put, get } = fixture();
  const old = sample("history/coverage"),
    newer = structuredClone(old);
  old.coverage.definitions[0].status = "bounded-synthetic-pass";
  old.evaluations = null;
  const original = put(old);
  assert.equal(original.summary.boundedEvaluationKeys, null);
  assert.equal(original.summary.states["bounded-synthetic-pass"], 1);
  const record = get("source=coverage&revision=" + old.revision);
  assert.equal(record.rows[0].bounded, null);
  newer.previous = old.revision;
  newer.revision = "6".repeat(40);
  assert.deepEqual(put(newer).summary.transitions, [
    {
      from: "bounded-synthetic-pass",
      to: "independently-evaluated-offline-example",
      count: 1,
    },
  ]);
  assert.equal(
    get("source=coverage&revision=" + old.revision).summary
      .boundedEvaluationKeys,
    null,
  );
  const empty = {
    ...newer,
    previous: newer.revision,
    revision: "7".repeat(40),
    coverage: { definitions: [] },
    evaluations: null,
  };
  put(empty);
  assert.throws(
    () =>
      put({
        ...empty,
        evaluations: { evaluations: [], blocked_evaluations: [] },
      }),
    /different evidence/,
  );
  db.close();
});
