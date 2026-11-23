import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { configOf, transaction } from "./operations.ts";
import {
  only,
  requireValue,
  date,
  canReviewCatalogue,
  type Config,
} from "./config.ts";
import { reconcileCoverage, evidenceTransitions } from "./coverage.mjs";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const refOk = (v: unknown) =>
  typeof v === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(v);
const ordered = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sources = ["coverage", "usage"];
function checkAccess(c: Config) {
  requireValue(
    canReviewCatalogue(c),
    "Catalogue history is disabled for this installation.",
    403,
  );
}
type Entry = {
  locator: string;
  name: string;
  hash: string;
  canonical: string;
  state: string;
  bounded: boolean | null;
  blockedEvaluation: boolean | null;
  sourceClientReady: boolean;
};
type Signal = {
  key: string;
  kind: "read-request" | "stated-use";
  count: number | null;
  observedOn: string;
  name: string;
  hash: string | null;
};
function normalizeUsage(source: unknown): Signal[] {
  requireValue(
    Array.isArray(source) && source.length <= 5000,
    "Supply up to 5000 historical observations.",
  );
  const keys = new Set<string>();
  return source
    .map((row) => {
      requireValue(
        only(row, ["key", "kind", "count", "observedOn", "name", "hash"]) &&
          typeof row.key === "string" &&
          /^[a-zA-Z0-9][A-Za-z0-9_.-]{0,95}$/.test(row.key) &&
          !keys.has(row.key) &&
          ["read-request", "stated-use"].includes(row.kind) &&
          (row.count === null ||
            (Number.isSafeInteger(row.count) && row.count >= 0)) &&
          date(row.observedOn) &&
          typeof row.name === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(row.name) &&
          (row.hash === null ||
            (typeof row.hash === "string" && /^[0-9a-f]{64}$/.test(row.hash))),
        "Invalid or duplicate historical observation.",
      );
      keys.add(row.key);
      return {
        key: row.key,
        kind: row.kind,
        count: row.count,
        observedOn: row.observedOn,
        name: row.name,
        hash: row.hash,
      };
    })
    .sort((a, b) => ordered(a.key, b.key));
}
const exists = (db: DatabaseSync) =>
  !!db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalogue_history'",
    )
    .get();
function latest(db: DatabaseSync, source: string) {
  return db
    .prepare(
      "SELECT * FROM catalogue_history WHERE source=? ORDER BY seq DESC LIMIT 1",
    )
    .get(source);
}
function parseRows(row: Record<string, unknown> | undefined) {
  return row ? JSON.parse(String(row.payload)) : [];
}
function definitionChanges(prior: Entry[], next: Entry[]) {
  const old = new Map(prior.map((r) => [r.locator, r])),
    fresh = new Set(next.map((r) => r.locator));
  return {
    added: next.filter((r) => !old.has(r.locator)).length,
    removed: prior.filter((r) => !fresh.has(r.locator)).length,
    revised: next.filter(
      (r) => old.has(r.locator) && old.get(r.locator)!.hash !== r.hash,
    ).length,
    metadataChanged: next.filter(
      (r) =>
        old.has(r.locator) &&
        old.get(r.locator)!.hash === r.hash &&
        JSON.stringify(old.get(r.locator)) !== JSON.stringify(r),
    ).length,
  };
}
export function importCatalogueHistory(
  db: DatabaseSync,
  input: any,
  now = Date.now(),
) {
  return transaction(db, () => {
    const c = configOf(db);
    checkAccess(c);
    requireValue(
      input && sources.includes(input.source),
      "Choose a historical coverage or usage snapshot.",
    );
    const fields =
      input.source === "coverage"
        ? ["coverage", "evaluations"]
        : ["observations"];
    requireValue(
      only(input, [
        "format",
        "installation",
        "source",
        "revision",
        "previous",
        ...fields,
      ]) &&
        input.format === "workos.catalogue-history/v1" &&
        refOk(input.revision) &&
        (input.previous === null || refOk(input.previous)),
      "Invalid historical snapshot envelope.",
    );
    requireValue(
      input.installation === c.client,
      "Historical snapshot belongs to a different installation.",
      403,
    );
    let rows: Entry[] | Signal[], summary: Record<string, unknown>;
    if (input.source === "coverage") {
      const result = reconcileCoverage(input.coverage, input.evaluations);
      const localKey = (path: string) => digest(c.client + "\0" + path);
      rows = result.rows
        .map((r) => ({
          ...r,
          locator: localKey(r.locator),
          canonical: localKey(r.canonical),
        }))
        .sort((a, b) => ordered(a.locator, b.locator));
      summary = result.summary;
    } else {
      rows = normalizeUsage(input.observations);
      summary = { observations: rows.length };
    }
    db.exec(
      "CREATE TABLE IF NOT EXISTS catalogue_history(seq INTEGER PRIMARY KEY,source TEXT NOT NULL,revision TEXT NOT NULL,previous TEXT,at INTEGER NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL,summary TEXT NOT NULL,UNIQUE(source,revision))",
    );
    const payload = JSON.stringify(rows),
      checksum = digest(payload);
    const known = db
      .prepare(
        "SELECT digest,previous,summary FROM catalogue_history WHERE source=? AND revision=?",
      )
      .get(input.source, input.revision);
    if (known) {
      requireValue(
        known.digest === checksum &&
          known.previous === input.previous &&
          (input.source !== "coverage" ||
            JSON.parse(String(known.summary)).boundedEvaluationKeys ===
              summary.boundedEvaluationKeys),
        "This revision already has different evidence.",
        409,
      );
      return {
        changed: false,
        revision: input.revision,
        summary: JSON.parse(String(known.summary)),
      };
    }
    const prior = latest(db, input.source);
    requireValue(
      (prior?.revision ?? null) === input.previous,
      "The history head changed. Inspect it before importing.",
      409,
    );
    if (input.source === "coverage") {
      const before = parseRows(prior);
      summary.changes = definitionChanges(before, rows as Entry[]);
      summary.transitions = evidenceTransitions(before, rows);
    }
    db.prepare(
      "INSERT INTO catalogue_history(source,revision,previous,at,digest,payload,summary) VALUES(?,?,?,?,?,?,?)",
    ).run(
      input.source,
      input.revision,
      input.previous,
      now,
      checksum,
      payload,
      JSON.stringify(summary),
    );
    return { changed: true, revision: input.revision, summary };
  });
}
function matchObservations(inventory: Entry[]) {
  const look = new Map<string, Set<string>>();
  for (const r of inventory) {
    const key = r.name + "@" + r.hash;
    const ids = look.get(key) ?? new Set();
    ids.add(r.canonical);
    look.set(key, ids);
  }
  return (r: Signal) => {
    if (!r.hash) return { state: "missing-hash", canonical: null };
    const candidates = look.get(r.name + "@" + r.hash);
    if (!candidates) return { state: "unmatched", canonical: null };
    return candidates.size === 1
      ? { state: "matched", canonical: [...candidates][0] }
      : { state: "ambiguous", canonical: null };
  };
}
export function historicalCatalogue(
  db: DatabaseSync,
  c: Config,
  source?: string | null,
  revision?: string | null,
  coverageRevision?: string | null,
) {
  checkAccess(c);
  requireValue(
    (source == null && revision == null) ||
      (sources.includes(source!) && refOk(revision)),
    "Specify a historical source and its exact revision together.",
  );
  requireValue(
    coverageRevision == null || (source === "usage" && refOk(coverageRevision)),
    "A comparison requires one usage revision and an exact coverage revision.",
  );
  if (source) {
    const row =
      exists(db) &&
      db
        .prepare(
          "SELECT payload,summary,previous,at FROM catalogue_history WHERE source=? AND revision=?",
        )
        .get(source, revision);
    requireValue(
      row,
      "Historical snapshot not found in this installation.",
      404,
    );
    let rows = parseRows(row);
    if (coverageRevision) {
      const basis = db
        .prepare(
          "SELECT payload FROM catalogue_history WHERE source='coverage' AND revision=?",
        )
        .get(coverageRevision);
      requireValue(
        basis,
        "Coverage revision not found in this installation.",
        404,
      );
      const classify = matchObservations(parseRows(basis));
      rows = rows.map((observation: Signal) => ({
        ...observation,
        match: classify(observation),
      }));
    }
    return {
      source,
      revision,
      previous: row.previous,
      at: row.at,
      summary: JSON.parse(String(row.summary)),
      coverageRevision: coverageRevision ?? null,
      rows,
    };
  }
  const all = exists(db);
  const snapshots = all
    ? db
        .prepare(
          "SELECT source,revision,previous,at,summary FROM catalogue_history ORDER BY seq DESC LIMIT 30",
        )
        .all()
        .map((r) => ({ ...r, summary: JSON.parse(String(r.summary)) }))
    : [];
  const coverage = all ? latest(db, "coverage") : undefined,
    usage = all ? latest(db, "usage") : undefined;
  const inventory: Entry[] = parseRows(coverage),
    observations: Signal[] = parseRows(usage);
  const classify = matchObservations(inventory);
  const totals = Object.fromEntries(
    ["read-request", "stated-use"].map((kind) => {
      const set = observations.filter((r) => r.kind === kind),
        known = set.filter((r) => r.count !== null);
      return [
        kind,
        {
          rows: set.length,
          knownTotal: known.length
            ? known.reduce((n, r) => n + BigInt(r.count!), 0n).toString()
            : null,
          unknownRows: set.length - known.length,
        },
      ];
    }),
  );
  const linked = observations.filter(
    (r) => classify(r).state === "matched",
  ).length;
  return {
    snapshots,
    coverageRevision: coverage?.revision ?? null,
    usageRevision: usage?.revision ?? null,
    coverage: coverage ? JSON.parse(String(coverage.summary)) : null,
    usage: usage
      ? {
          observations: observations.length,
          exactMatches: linked,
          unresolved: observations.length - linked,
          totals,
        }
      : null,
  };
}
