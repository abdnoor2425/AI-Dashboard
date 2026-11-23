"use client";
import { useState } from "react";
import { useApi } from "@/lib/client";
import { Load } from "@/components/ui";

type Counts = { rows: number; knownTotal: string | null; unknownRows: number };
type Snapshot = { source: string; revision: string };
const measures = {
  definitions: "Definitions",
  declaredNames: "Declared names",
  uniqueHashes: "Distinct hashes",
  explicitAliases: "Explicit aliases",
  sameNameDifferentHashes: "Names with multiple hashes",
  boundedEvaluationKeys: "Bounded evaluation keys",
  sourceClientReady: "Source readiness claims",
};
type History = {
  coverage: Record<keyof typeof measures, number | null> | null;
  coverageRevision: string | null;
  usage: {
    exactMatches: number;
    unresolved: number;
    totals: Record<string, Counts>;
  } | null;
  snapshots: Snapshot[];
};
type Row = {
  name: string;
  hash: string | null;
  key?: string;
  kind?: string;
  count?: number | null;
  observedOn?: string;
  state?: string;
  locator?: string;
  canonical?: string;
  bounded?: boolean | null;
  blockedEvaluation?: boolean;
  sourceClientReady?: boolean;
  match?: { state: string; canonical: string | null };
};
const matchLabels: Record<string, string> = {
  matched: "Exact canonical match",
  "missing-hash": "Missing instruction hash",
  unmatched: "No matching definition",
  ambiguous: "Multiple canonical definitions",
};
const labels: Record<string, string> = {
  "read-request": "Read requests",
  "stated-use": "Stated uses",
};
function HistoricalRevision({
  source,
  revision,
  bases,
  head,
}: {
  source: string;
  revision: string;
  bases: string[];
  head: string | null;
}) {
  const [basis, setBasis] = useState(head);
  const [page, setPage] = useState(0);
  const q = useApi<{
    rows: Row[];
    summary: { transitions?: { from: string; to: string; count: number }[] };
  }>("workos/catalogue-history", {
    source,
    revision,
    coverageRevision: source === "usage" ? basis : null,
  });
  return (
    <section className="stack workos-history-detail">
      <h3 className="t-head">{source} revision</h3>
      <code>{revision}</code>
      {source === "usage" && basis && (
        <label>
          Compare with coverage revision
          <select
            className="input"
            value={basis}
            onChange={(e) => {
              setBasis(e.target.value);
              setPage(0);
            }}
          >
            {Array.from(new Set([basis, ...bases])).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <Load q={q} skeleton={<p>Reading revision…</p>}>
        {(d) => (
          <>
            <p>
              {d.rows.length} {d.rows.length === 1 ? "record" : "records"}
            </p>
            {d.summary.transitions?.length > 0 && (
              <section>
                <h4>Evidence changes since the previous revision</h4>
                <ul>
                  {d.summary.transitions.map((t) => (
                    <li key={t.from + t.to}>
                      {t.from} → {t.to} · {t.count}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <ul className="workos-history-list">
              {d.rows.slice(page * 20, page * 20 + 20).map((r) => (
                <li key={r.key ?? r.locator}>
                  <strong>{r.name}</strong>
                  <p>
                    {source === "usage"
                      ? [
                          labels[r.kind!] ?? r.kind,
                          r.count ?? "Unknown",
                          r.observedOn,
                        ].join(" · ")
                      : r.state}
                  </p>
                  {r.match && <p>{matchLabels[r.match.state]}</p>}
                  {source === "coverage" && (
                    <p>
                      {r.canonical === r.locator
                        ? "Canonical definition"
                        : "Explicit alias"}{" "}
                      ·{" "}
                      {r.bounded === null
                        ? "Evaluation source unavailable"
                        : r.bounded
                          ? "Bounded evaluation present"
                          : "No bounded evaluation"}
                      {r.blockedEvaluation
                        ? " · Blocked evaluation present"
                        : ""}
                      {r.sourceClientReady
                        ? " · Source claims client readiness"
                        : ""}
                    </p>
                  )}
                  <details>
                    <summary>Identity evidence</summary>
                    <dl className="workos-facts">
                      <dt>Instruction hash</dt>
                      <dd>
                        <code>{r.hash ?? "Unknown"}</code>
                      </dd>
                      {(r.match?.canonical || r.canonical) && (
                        <>
                          <dt>Local canonical ID</dt>
                          <dd>
                            <code>{r.match?.canonical ?? r.canonical}</code>
                          </dd>
                        </>
                      )}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
            {d.rows.length > 20 && (
              <div>
                <button
                  type="button"
                  className="btn"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous records
                </button>{" "}
                <button
                  type="button"
                  className="btn"
                  disabled={(page + 1) * 20 >= d.rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next records
                </button>
              </div>
            )}
          </>
        )}
      </Load>
    </section>
  );
}
export function HistoricalUsage() {
  const q = useApi<History>("workos/catalogue-history");
  const [selected, setSelected] = useState<Snapshot | null>(null);
  return (
    <section className="card pad stack workos-history">
      <h2 className="t-mid">Historical catalogue evidence</h2>
      <p>
        Imported observations are counted separately from local executions and
        verified receipts.
      </p>
      <Load q={q} skeleton={<p>Reading local metadata…</p>}>
        {(d: History) => (
          <div className="stack">
            {d.coverage ? (
              <dl className="workos-history-counts">
                {Object.entries(measures).map(([k, label]) => (
                  <div key={k}>
                    <dt>{label}</dt>
                    <dd>
                      {d.coverage![k as keyof typeof measures] ?? "Unknown"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No coverage snapshot imported.</p>
            )}
            {d.usage ? (
              <section>
                <h3 className="t-head">Historical usage</h3>
                <p>
                  {d.usage.exactMatches} matched observations ·{" "}
                  {d.usage.unresolved} unresolved
                </p>
                <dl className="workos-history-counts">
                  {Object.entries(d.usage.totals).map(([k, v]) => (
                    <div key={k}>
                      <dt>{labels[k]}</dt>
                      <dd>{v.knownTotal ?? "Unknown"}</dd>
                      <dd className="t-foot">
                        {v.unknownRows} {v.unknownRows === 1 ? "row" : "rows"}{" "}
                        with unknown counts
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <p>No historical usage snapshot imported.</p>
            )}
            {d.snapshots.length > 0 && (
              <details>
                <summary>Imported revisions</summary>
                <div className="workos-history-pins">
                  {d.snapshots.map((r) => (
                    <button
                      className="btn"
                      type="button"
                      aria-pressed={
                        selected?.source === r.source &&
                        selected.revision === r.revision
                      }
                      key={r.source + r.revision}
                      onClick={() => setSelected(r)}
                    >
                      {r.source} · {r.revision.slice(0, 12)}
                    </button>
                  ))}
                </div>
                {selected && (
                  <HistoricalRevision
                    key={selected.source + selected.revision}
                    {...selected}
                    head={d.coverageRevision}
                    bases={d.snapshots
                      .filter((v) => v.source === "coverage")
                      .map((v) => v.revision)}
                  />
                )}
              </details>
            )}
          </div>
        )}
      </Load>
    </section>
  );
}
