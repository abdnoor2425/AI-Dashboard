"use client";
import React, { useState } from "react";
import { api, useApi } from "@/lib/client";
import { Load, Page } from "@/components/ui";
import { draftSteps, type PilotApproach } from "@/lib/workos/draft";
import type { Plan, Branch } from "@/lib/workos/plan";
import type { snapshot } from "@/lib/workos/operations";
type Model = ReturnType<typeof snapshot>;
const levels = ["months", "weeks", "tasks"] as const;
const names = {
  months: "Monthly outcome",
  weeks: "Weekly milestone",
  tasks: "Daily action",
};
const newId = () => "node-" + crypto.randomUUID().slice(0, 20);
const initial = (d: Model): Plan => ({
  quarter: {
    title: "",
    owner: d.owner,
    due: d.plan.quarter.due,
    metric: "",
    unit: "",
    baseline: 0,
    target: 1,
    source: "",
  },
  months: [],
  weeks: [],
  tasks: [],
});
function PlanForm({
  data,
  finish,
  isNew,
}: {
  data: Model;
  finish: () => void;
  isNew: boolean;
}) {
  const [version] = useState(data.revision),
    [p, set] = useState<Plan>(() =>
      isNew ? initial(data) : structuredClone(data.plan),
    );
  const [cadence, setCadence] = useState("two");
  const [startDate, setStartDate] = useState("");
  const [approach, setApproach] = useState<PilotApproach>("turnaround");
  const [scope, setScope] = useState(""),
    [pilotChange, setPilotChange] = useState("");
  const [message, msg] = useState(""),
    [busy, wait] = useState(false);
  const change = (fn: (next: Plan) => void) =>
    set((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
  const recorded = isNew
    ? []
    : data.tasks.filter(
        (t) =>
          t.run || t.value !== null || t.receipt || t.blocker === "Cancelled",
      );
  const root = (key: keyof Plan["quarter"], value: string | number) =>
    change((next) => Object.assign(next.quarter, { [key]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    wait(true);
    msg("");
    try {
      await api("workos/" + (isNew ? "new-plan" : "plan"), {
        body: { plan: p, planRevision: version },
      });
      finish();
    } catch (e) {
      msg((e as Error).message);
    } finally {
      wait(false);
    }
  }
  return (
    <form className="card pad stack" onSubmit={save}>
      <h2>{isNew ? "Create a quarterly goal" : "Edit active plan"}</h2>
      {isNew && (
        <p>
          Saving archives the current hierarchy and its receipts. The new goal
          starts as a proposal.
        </p>
      )}
      {recorded.length > 0 && (
        <p>
          Tasks with activity retain their identity and metric definition. Start
          a new quarterly goal to use a different measure.
        </p>
      )}
      <fieldset className="workos-fields">
        <legend>Quarterly commitment</legend>
        {(
          [
            ["title", "Quarterly goal"],
            ["owner", "Accountable owner"],
            ["due", "Quarter deadline"],
            ["metric", "Metric"],
            ["unit", "Unit"],
            ["baseline", "Baseline"],
            ["target", "Target"],
            ["source", "Measurement source"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              required
              className="input"
              maxLength={120}
              type={
                key === "due"
                  ? "date"
                  : key === "baseline" || key === "target"
                    ? "number"
                    : "text"
              }
              step="any"
              disabled={
                recorded.length > 0 &&
                ["metric", "unit", "baseline", "target", "source"].includes(key)
              }
              value={p.quarter[key]}
              onChange={(e) =>
                root(
                  key,
                  key === "baseline" || key === "target"
                    ? Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          </label>
        ))}
      </fieldset>
      {isNew && !p.months.length && (
        <div className="stack">
          <label>
            Draft schedule
            <select
              className="input"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            >
              <option value="two">Baseline and final check</option>
              <option value="weekly">Weekly checks across the quarter</option>
              {data.canRecordWork && (
                <option value="pilot">Goal-specific work pilot</option>
              )}
            </select>
          </label>
          {cadence === "pilot" && (
            <fieldset className="workos-fields">
              <legend>Work pilot</legend>
              <label>
                Operational goal
                <select
                  className="input"
                  value={approach}
                  onChange={(e) => setApproach(e.target.value as PilotApproach)}
                >
                  <option value="turnaround">Reduce turnaround time</option>
                  <option value="conversion">Improve conversion</option>
                  <option value="quality">Reduce errors or rework</option>
                </select>
              </label>
              <label>
                Work area or cohort
                <input
                  className="input"
                  maxLength={44}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Intake review queue"
                />
              </label>
              <label>
                Change to test
                <input
                  className="input"
                  maxLength={44}
                  value={pilotChange}
                  onChange={(e) => setPilotChange(e.target.value)}
                  placeholder="Assign the first reviewer at intake"
                />
              </label>
            </fieldset>
          )}
          {cadence !== "two" && (
            <label>
              Measurement start date
              <input
                type="date"
                className="input"
                value={startDate}
                max={p.quarter.due}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => {
              try {
                const steps = draftSteps(
                  p.quarter,
                  undefined,
                  cadence === "two" ? undefined : startDate,
                  cadence === "pilot"
                    ? { approach, scope, change: pilotChange }
                    : undefined,
                );
                change((next) => Object.assign(next, steps));
                msg("");
              } catch (e) {
                msg((e as Error).message);
              }
            }}
          >
            Draft steps from goal
          </button>
          <p>
            {cadence === "pilot"
              ? "Draft baseline and final readings around three work products. Each product has evidence to review before its dependent action opens."
              : "Build editable measurement checks from the metric and deadline."}
          </p>
        </div>
      )}
      {levels.map((level, idx) => {
        const parents: Pick<Branch, "id" | "title" | "due">[] =
          idx === 0 ? [{ id: "quarter", ...p.quarter }] : p[levels[idx - 1]];
        const add = () =>
          change((next) => {
            const parent = parents[0];
            const n = {
              id: newId(),
              title: "",
              owner: next.quarter.owner,
              due: parent.due,
              parent: parent.id,
            };
            if (level === "tasks") next.tasks.push({ ...n, after: null });
            else next[level].push(n);
          });
        return (
          <section className="stack" key={level}>
            <h3>{names[level]}s</h3>
            {p[level].map((n, index) => {
              const patch = (key: string, value: string | null) =>
                change((next) =>
                  Object.assign(next[level][index], { [key]: value }),
                );
              const locked =
                level === "tasks" && recorded.some((t) => t.id === n.id);
              const mapped =
                level === "tasks" &&
                data.tasks.some((t) => t.id === n.id && t.sourceIssue);
              const fixedParent =
                level === "weeks" && recorded.some((t) => t.parent === n.id);
              const children =
                (idx < 2 &&
                  p[levels[idx + 1]].some((child) => child.parent === n.id)) ||
                (level === "tasks" && p.tasks.some((t) => t.after === n.id));
              return (
                <fieldset
                  disabled={locked}
                  key={n.id}
                  className="workos-fields"
                >
                  <legend>
                    {names[level]} {index + 1}
                  </legend>
                  <label>
                    Title
                    <input
                      required
                      maxLength={120}
                      className="input"
                      value={n.title}
                      onChange={(e) => patch("title", e.target.value)}
                    />
                  </label>
                  <label>
                    Owner
                    <input
                      required
                      maxLength={120}
                      className="input"
                      value={n.owner}
                      onChange={(e) => patch("owner", e.target.value)}
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      required
                      className="input"
                      type="date"
                      min={
                        level === "tasks"
                          ? p.tasks.find((v) => v.id === p.tasks[index].after)
                              ?.due
                          : undefined
                      }
                      max={parents.find((v) => v.id === n.parent)?.due}
                      value={n.due}
                      onChange={(e) => patch("due", e.target.value)}
                    />
                  </label>
                  {idx > 0 && (
                    <label>
                      Parent
                      <select
                        className="input"
                        disabled={fixedParent}
                        value={n.parent}
                        onChange={(e) => patch("parent", e.target.value)}
                      >
                        {parents.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title || "Untitled"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {level === "tasks" && (
                    <label>
                      Completion evidence
                      <select
                        className="input"
                        value={p.tasks[index].evidence?.kind ?? "skill"}
                        onChange={(e) => {
                          const kind = e.target.value;
                          change((next) => {
                            const task = next.tasks[index];
                            if (kind === "skill") delete task.evidence;
                            else
                              task.evidence =
                                kind === "observation"
                                  ? { kind }
                                  : { kind: "deliverable", criterion: "" };
                          });
                        }}
                      >
                        <option value="skill">Selected skill receipt</option>
                        <option value="observation">
                          Verified goal measurement
                        </option>
                        {(data.canRecordWork ||
                          p.tasks[index].evidence?.kind === "deliverable") && (
                          <option value="deliverable">
                            Reviewed work product
                          </option>
                        )}
                      </select>
                    </label>
                  )}
                  {level === "tasks" &&
                    p.tasks[index].evidence?.kind === "deliverable" && (
                      <label>
                        Acceptance criterion
                        <input
                          className="input"
                          required
                          maxLength={120}
                          value={p.tasks[index].evidence.criterion}
                          onChange={(e) =>
                            change((next) => {
                              next.tasks[index].evidence = {
                                kind: "deliverable",
                                criterion: e.target.value,
                              };
                            })
                          }
                        />
                      </label>
                    )}
                  {level === "tasks" &&
                    p.tasks[index].evidence?.kind === "observation" && (
                      <p>Completion requires a verified goal measurement.</p>
                    )}
                  {level === "tasks" && (
                    <label>
                      Prerequisite
                      <select
                        className="input"
                        value={p.tasks[index].after ?? ""}
                        onChange={(e) => patch("after", e.target.value || null)}
                      >
                        <option value="">None</option>
                        {p.tasks.slice(0, index).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn"
                    disabled={children || mapped}
                    onClick={() =>
                      change((next) => next[level].splice(index, 1))
                    }
                  >
                    Remove {names[level].toLowerCase()}
                  </button>
                </fieldset>
              );
            })}
            <div>
              <button
                className="btn"
                type="button"
                disabled={!parents.length || p[level].length >= 50}
                onClick={add}
              >
                Add {names[level].toLowerCase()}
              </button>
            </div>
          </section>
        );
      })}
      {message && <p role="alert">{message}</p>}
      <div>
        <button className="btn primary" disabled={busy}>
          {isNew
            ? "Archive current plan and save goal"
            : "Save proposed changes"}
        </button>{" "}
        <button className="btn" type="button" onClick={finish}>
          Discard draft
        </button>
      </div>
    </form>
  );
}
export function PlanPage() {
  const q = useApi<Model>("workos"),
    h = useApi("workos/history");
  const [mode, setMode] = useState<"edit" | "new" | null>(null);
  const [archive, show] = useState<any>(null),
    [error, setError] = useState("");
  return (
    <Page
      title="Goal planner"
      sub="Build the quarter, its outcomes, milestones and daily actions."
    >
      <Load q={q} skeleton={<p>Loading plan…</p>}>
        {(d: Model) => (
          <div className="stack">
            {mode ? (
              <PlanForm
                data={d}
                isNew={mode === "new"}
                finish={() => setMode(null)}
              />
            ) : (
              <section className="card pad stack">
                <h2>{d.plan.quarter.title}</h2>
                <p>
                  Revision {d.revision} · {d.approved ? "Approved" : "Proposed"}{" "}
                  · {d.plan.quarter.owner}
                </p>
                {d.scheduleConflicts.map((x) => (
                  <p role="alert" key={x.task}>
                    Schedule conflict · {x.message}
                  </p>
                ))}
                {d.plan.months.map((m) => (
                  <section key={m.id} className="workos-plan-tree">
                    <h3>{m.title}</h3>
                    <p>
                      {m.owner} · {m.due}
                    </p>
                    <p>
                      {d.rollups[m.id].verified}/{d.rollups[m.id].tasks} tasks
                      verified · {d.rollups[m.id].blocked} blocked ·{" "}
                      {d.rollups[m.id].cancelled} cancelled · Latest verified
                      reading{" "}
                      {d.rollups[m.id].observed === null
                        ? "unknown"
                        : d.rollups[m.id].observed + " " + d.goal.unit}
                    </p>
                    <ul>
                      {d.plan.weeks
                        .filter((w) => w.parent === m.id)
                        .map((w) => (
                          <li key={w.id}>
                            {w.title} · {w.owner} · {w.due} ·{" "}
                            {d.rollups[w.id].verified}/{d.rollups[w.id].tasks}{" "}
                            tasks verified
                            <ul>
                              {d.tasks
                                .filter((t) => t.parent === w.id)
                                .map((t) => (
                                  <li key={t.id}>
                                    {t.title} · {t.owner} · {t.due}
                                    {t.evidence?.kind === "deliverable" && (
                                      <p>
                                        Acceptance criterion ·{" "}
                                        {t.evidence.criterion}
                                      </p>
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
                {d.editable ? (
                  <div>
                    <button className="btn" onClick={() => setMode("edit")}>
                      Edit plan
                    </button>{" "}
                    <button
                      className="btn primary"
                      onClick={() => setMode("new")}
                    >
                      New quarterly goal
                    </button>
                  </div>
                ) : (
                  <p>You have read-only access to this plan. Editing requires an operator account and the plan.edit grant.</p>
                )}
              </section>
            )}
            <section className="card pad stack">
              <h2>Archived goals</h2>
              {h.error && <p role="alert">{h.error}</p>}
              {h.data?.archives.length === 0 && <p>No archived goals.</p>}
              {h.data?.archives.map((a) => (
                <button
                  className="btn"
                  key={a.revision}
                  onClick={async () => {
                    try {
                      show(
                        await api("workos/history", {
                          query: { revision: a.revision },
                        }),
                      );
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {a.title} · Revision {a.revision}
                </button>
              ))}
              {error && <p role="alert">{error}</p>}
              {archive && (
                <div>
                  <h3>{archive.plan.quarter.title}</h3>
                  {archive.tasks.map((t) => (
                    <p key={t.id}>
                      {t.title} ·{" "}
                      {t.verified ? "Verified receipt " + t.receipt.reference : t.blocker || "Open"}
                      {t.receipt?.additional?.map((result: {revision: string; reference: string}) =>
                        <span key={result.revision}> · {result.revision} evidence {result.reference}</span>)}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Load>
    </Page>
  );
}
export function FixturePage() {
  const q = useApi<Model>("workos");
  const [input, set] = useState(""),
    [result, msg] = useState(""),
    [busy, wait] = useState(false);
  return (
    <Page
      title="Linear rehearsal"
      sub="Reconcile a synthetic issue batch locally."
    >
      <Load q={q} skeleton={<p>Loading installation…</p>}>
        {(d: Model) => (
          <section className="card pad stack">
            {d.canImport ? (
              <>
                <p>
                  The sample uses the current plan revision. Each issue carries
                  its own source version. Source status is displayed separately
                  from reviewed work.
                </p>
                <button
                  className="btn"
                  disabled={!d.plan.weeks.length}
                  onClick={() => {
                    const w = d.plan.weeks[0];
                    set(
                      JSON.stringify(
                        {
                          source: "synthetic-linear/v1",
                          client: d.client,
                          planRevision: d.revision,
                          issues: [
                            {
                              id: "mock-intake-" + w.id,
                              identifier: "QA-101",
                              version: 1,
                              title: "Review synthetic intake",
                              owner: w.owner,
                              week: w.id,
                              due: w.due,
                              state: "Todo",
                            },
                          ],
                        },
                        null,
                        2,
                      ),
                    );
                  }}
                >
                  Load sample batch
                </button>
                <label>
                  Issue batch
                  <textarea
                    className="input"
                    rows={12}
                    value={input}
                    onChange={(e) => set(e.target.value)}
                  />
                </label>
                <button
                  className="btn primary"
                  disabled={busy || !input}
                  onClick={async () => {
                    wait(true);
                    try {
                      const r = await api("workos/reconcile", {
                        body: JSON.parse(input),
                      });
                      msg(
                        "Created " +
                          r.created +
                          " · Updated " +
                          r.updated +
                          " · Unchanged " +
                          r.unchanged +
                          " · Stale " +
                          r.stale +
                          ". Plan revision " +
                          r.revision +
                          ".",
                      );
                    } catch (e) {
                      msg((e as Error).message);
                    } finally {
                      wait(false);
                    }
                  }}
                >
                  Reconcile batch
                </button>
              </>
            ) : (
              <p>Fixture imports require an operator account and the fixture.import grant.</p>
            )}
            <p role="status">{result}</p>
            <h2>Source mappings</h2>
            {!d.tasks.some((t) => t.sourceIssue) && (
              <p>No mapped issues in the active plan.</p>
            )}
            {d.tasks
              .filter((t) => t.sourceIssue)
              .map((t) => (
                <p key={t.id}>
                  {t.sourceIssue.identifier} · {t.title} · Source{" "}
                  {t.sourceIssue.state} · Version {t.sourceIssue.version}
                </p>
              ))}
          </section>
        )}
      </Load>
    </Page>
  );
}
