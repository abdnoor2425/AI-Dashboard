// This pure adapter accepts pinned coverage metadata and evaluation metadata only.
// It never resolves a source path, loads instructions or grants an execution capability.
const states = [
  "blocked-or-unrun",
  "bounded-synthetic-pass",
  "independently-evaluated-offline-example",
  "scoped-runtime-pass",
];
const nameOk = (v) =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(v);
const hashOk = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const locatorOk = (v) =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= 1024 &&
  !/[\u0000-\u001f]/.test(v);
function check(ok, message) {
  if (!ok) throw Error(message);
}

export function reconcileCoverage(coverage, evaluationSource) {
  const defs = coverage?.definitions,
    evaluations =
      evaluationSource === null ? [] : evaluationSource?.evaluations,
    blocked =
      evaluationSource === null ? [] : evaluationSource?.blocked_evaluations;
  check(
    Array.isArray(defs) &&
      defs.length <= 2000 &&
      Array.isArray(evaluations) &&
      evaluations.length <= 4000 &&
      Array.isArray(blocked) &&
      blocked.length <= 4000,
    "Invalid coverage or evaluation collections.",
  );
  const records = new Map(),
    index = new Map(),
    names = new Map(),
    hashes = new Set();
  const statusCounts = Object.fromEntries(states.map((s) => [s, 0]));
  for (const d of defs) {
    check(
      d &&
        nameOk(d.name) &&
        locatorOk(d.path) &&
        hashOk(d.sha256) &&
        states.includes(d.status) &&
        typeof d.client_ready === "boolean" &&
        (d.canonical_alias_of === null || locatorOk(d.canonical_alias_of)),
      "Invalid definition identity or evidence state.",
    );
    check(!records.has(d.path), "Duplicate source locator.");
    records.set(d.path, d);
    const key = d.name + "@" + d.sha256;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(d);
    if (!names.has(d.name)) names.set(d.name, new Set());
    names.get(d.name).add(d.sha256);
    hashes.add(d.sha256);
    statusCounts[d.status]++;
  }
  let aliases = 0;
  for (const d of defs) {
    if (d.canonical_alias_of === null) continue;
    const canonical = records.get(d.canonical_alias_of);
    check(
      canonical &&
        canonical !== d &&
        canonical.canonical_alias_of === null &&
        canonical.sha256 === d.sha256,
      "Unresolved alias or mismatched exact hash.",
    );
    aliases++;
  }
  const evidence = new Map();
  for (const [kind, items] of [
    ["bounded", evaluations],
    ["blocked", blocked],
  ]) {
    for (const e of items) {
      check(
        e && nameOk(e.name) && hashOk(e.instruction_sha256),
        "Invalid evaluation identity.",
      );
      const key = e.name + "@" + e.instruction_sha256;
      check(
        index.has(key),
        "Evaluation has no matching declared name and exact hash.",
      );
      const set = evidence.get(key) ?? new Set();
      check(
        !set.has(kind),
        "Duplicate evaluation key in the same evidence collection.",
      );
      set.add(kind);
      evidence.set(key, set);
    }
  }
  const rows = defs.map((d) => ({
    locator: d.path,
    name: d.name,
    hash: d.sha256,
    canonical: d.canonical_alias_of ?? d.path,
    state: d.status,
    bounded:
      evaluationSource === null
        ? null
        : (evidence.get(d.name + "@" + d.sha256)?.has("bounded") ?? false),
    blockedEvaluation:
      evaluationSource === null
        ? null
        : (evidence.get(d.name + "@" + d.sha256)?.has("blocked") ?? false),
    sourceClientReady: d.client_ready,
  }));
  check(
    rows.every(
      (r) => r.state !== "independently-evaluated-offline-example" || r.bounded,
    ),
    "A bounded coverage claim requires matching evaluation evidence.",
  );
  const summary = {
    definitions: rows.length,
    declaredNames: names.size,
    uniqueHashes: hashes.size,
    canonicalDefinitions: rows.length - aliases,
    explicitAliases: aliases,
    sameNameDifferentHashes: [...names.values()].filter((h) => h.size > 1)
      .length,
    boundedEvaluationKeys:
      evaluationSource === null ? null : evaluations.length,
    blockedEvaluationKeys: evaluationSource === null ? null : blocked.length,
    sourceClientReady: rows.filter((r) => r.sourceClientReady).length,
    states: statusCounts,
  };
  return { rows, summary };
}

// Compare classifications only when the locator and the exact instruction bytes agree.
export function evidenceTransitions(prior, next) {
  const previous = new Map(prior.map((r) => [r.locator, r]));
  const counts = new Map();
  for (const row of next) {
    const before = previous.get(row.locator);
    if (!before || before.hash !== row.hash || before.state === row.state)
      continue;
    const key = before.state + "|" + row.state;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => {
      const [from, to] = key.split("|");
      return { from, to, count };
    });
}
