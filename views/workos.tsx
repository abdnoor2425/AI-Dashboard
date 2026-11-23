"use client";
import React, { useId, useState } from "react";
import { api, useApi, useWorkspacePage } from "@/lib/client";
import { Load, Page } from "@/components/ui";
import Metrics from "./metrics";
import Decisions from "./decisions";
import SecondBrain from "./second-brain";
import { Skills } from "./more";
const VIEWS: Record<string, React.ComponentType> = {
  metrics: Metrics,
  decisions: Decisions,
  skills: Skills,
  "second-brain": SecondBrain,
};
import type { snapshot } from "@/lib/workos/operations";
import { isMeasurementPin } from "@/lib/workos/config";
import { PlanPage, FixturePage } from "./workos-planning";
import { HistoricalUsage } from "./workos-history";
type Model = ReturnType<typeof snapshot>;
type Task = Model["tasks"][number];

type OutputReceipt = {
  revision: string;
  reference: string;
  output?: string;
  observed?: number;
  observedMinusTarget?: number | null;
  change?: number;
  target?: number;
  progressPercent?: number;
  instructionHash?: string;
  principal?: string;
};
function ResultValues({
  receipt,
  unit,
}: {
  receipt: OutputReceipt;
  unit: string;
}) {
  return (
    <>
      <p>
        {receipt.output || (
          <>
            Observed {receipt.observed} {unit}. Change from baseline{" "}
            {receipt.change} {unit}. Target {receipt.target} {unit}.
          </>
        )}
      </p>
      {receipt.observedMinusTarget !== undefined && (
        <p>
          {receipt.observedMinusTarget === null
            ? "The gap to target exceeds the numeric range."
            : receipt.observedMinusTarget === 0
              ? "At target."
              : `${Math.abs(receipt.observedMinusTarget).toLocaleString()} ${unit} ${receipt.observedMinusTarget > 0 ? "above" : "below"} target.`}
        </p>
      )}
      {typeof receipt.progressPercent === "number" && (
        <p>
          Distance from baseline to target covered:{" "}
          {receipt.progressPercent.toLocaleString()}%
        </p>
      )}
    </>
  );
}
function DailyAction({
  task,
  unit,
  catalog,
  planRevision,
}: {
  task: Task;
  unit: string;
  catalog: Model["catalog"];
  planRevision: number;
}) {
  const { boot } = useWorkspacePage();
  const actions: string[] = boot.access.actions;
  const [value, setValue] = useState(task.value?.toString() ?? "");
  const [reference, setReference] = useState(task.reference ?? "");
  const [intent, setIntent] = useState(
    () =>
      catalog.find((entry) => entry.pin === task.selected)?.example ??
      "Review goal progress",
  );
  const [workSummary, setWorkSummary] = useState(
    task.receipt?.kind === "deliverable" ? task.receipt.output : "",
  );
  const work = task.evidence?.kind === "deliverable" ? task.evidence : null;
  const permitted = catalog.filter(
    (s) =>
      s.enabled &&
      (task.evidence?.kind !== "observation" || isMeasurementPin(s.pin)),
  );
  const storedRevisions: string[] =
    task.routing?.revisions ?? (task.selected ? [task.selected] : []);
  const enabled =
    storedRevisions.length > 0 &&
    storedRevisions.every((revision) =>
      permitted.some((s) => s.pin === revision),
    );
  const [method, setMethod] = useState<"language" | "operator">(
    task.routing?.method === "operator" ? "operator" : "language",
  );
  const [outputs, setOutputs] = useState<string[]>(
    task.routing?.method === "operator" ? storedRevisions : [],
  );
  const [otherReviews, setOtherReviews] = useState<Record<string, string>>({});
  function changeMethod(next: "language" | "operator") {
    setMethod(next);
    setLastRequest(null);
    setMessage("");
  }
  const missingEvidence = task.value == null || !task.reference;
  const [override, setOverride] = useState(task.selected ?? "");
  const [lastRequest, setLastRequest] = useState<{
    method: "language" | "operator";
    outputKey: string;
    intent: string;
    revision: string;
    selected: string | null;
    plan: number;
    run: string;
    at: number;
  } | null>(null);
  const requiresChoice =
    task.routing?.requiresChoice ??
    task.routing?.reason ===
      "Multiple approved matches. Choose the intended revision.";
  const presented = requiresChoice
    ? permitted.filter((entry) => task.routing.alternatives.includes(entry.pin))
    : permitted;
  const [opened, setOpened] = useState<{
    run: string;
    pin: string;
    purpose: string;
    inputs: string;
    output: string;
    excludes: string;
    steps: string[];
    additionalRecords?: {
      pin: string;
      purpose: string;
      output: string;
      inputs: string;
      excludes: string;
      steps: string[];
      instructionHash: string;
    }[];
    instructionHash: string;
  } | null>(null);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const changedMeasurement =
    (value === "" ? null : Number(value)) !== (task.value ?? null) ||
    reference !== (task.reference ?? "");
  const confirmed =
    lastRequest !== null &&
    lastRequest.method === method &&
    (method === "operator"
      ? lastRequest.outputKey === JSON.stringify(outputs)
      : lastRequest.intent === intent && lastRequest.revision === override) &&
    lastRequest.selected === task.selected &&
    lastRequest.plan === planRevision &&
    lastRequest.run === task.run &&
    lastRequest.at === task.routing?.at;
  const canUseSelection = enabled && confirmed && !changedMeasurement;
  const draftNotice =
    !work &&
    !task.receipt &&
    actions.includes("select") &&
    (changedMeasurement
      ? "Save the measurement and evidence ID, or restore their saved values, before matching."
      : task.selected && !confirmed
        ? method === "operator"
          ? "Confirm the chosen outputs again before running them."
          : "Confirm this request and revision with Find approved skill before running it."
        : "");
  async function act(name: string, fields: Record<string, unknown> = {}) {
    if ((name === "run" || name === "read-skill") && !canUseSelection) return;
    if ((name === "select" || name === "choose-output") && changedMeasurement)
      return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api("workos/" + name, {
        body: {
          task: task.id,
          planRevision,
          ...(["read-skill", "run", "verify"].includes(name)
            ? { expectedRun: task.run, expectedSkill: task.selected }
            : {}),
          ...(["submit-work", "review-work"].includes(name)
            ? { expectedRun: task.run }
            : {}),
          ...fields,
        },
      });
      if (name === "read-skill") setOpened(result);
      if (name === "select" || name === "choose-output")
        setLastRequest({
          method: name === "choose-output" ? "operator" : "language",
          outputKey: JSON.stringify(fields.revisions ?? []),
          intent: String(fields.intent),
          revision: String(fields.revision ?? ""),
          selected: result.selected,
          plan: planRevision,
          run: result.run,
          at: result.matchedAt,
        });
      setMessage(
        result.reason ||
          {
            measure: "Measurement saved.",
            "submit-work": "Work product submitted for evidence review.",
            "review-work": "Work evidence verified.",
            run: "Local receipt saved for review.",
            verify: "Receipt verified.",
            cancel: "Task cancelled.",
          }[name] ||
          "",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card pad stack">
      <h3 className="t-head">{task.title}</h3>
      <p>
        {task.owner} · Due {task.due}
        {task.overdue ? " · Overdue" : ""}
      </p>
      {task.blocker && (
        <p>
          {task.blocker}{" "}
          {task.blocker.startsWith("Prerequisite cancelled") && (
            <a href="#planner">Open goal planner</a>
          )}
        </p>
      )}
      {task.sourceIssue && (
        <p>
          {task.sourceIssue.identifier} · Synthetic source status{" "}
          {task.sourceIssue.state}
        </p>
      )}
      {task.routing && (
        <details>
          <summary>Routing decision</summary>
          <p>{task.routing.reason}</p>
          <p>
            {task.routing.method === "operator"
              ? "Chosen outputs: " + storedRevisions.join(", ")
              : "Eligible matches: " +
                (task.routing.alternatives.join(", ") || "None")}
          </p>
          {task.routing.runner && (
            <p>
              {task.routing.runner} · Assigned to {task.routing.owner} ·
              Required grants: {task.routing.permissions.join(", ")}
            </p>
          )}
        </details>
      )}
      {task.failure && <p role="alert">{task.failure}</p>}
      {work && (
        <section className="stack" aria-label="Work-product evidence">
          <div>
            <h4>Acceptance criterion</h4>
            <p>{work.criterion}</p>
          </div>
          {!actions.includes("submit-work") &&
            !actions.includes("review-work") &&
            !task.receipt && <p>Awaiting an authorized operator’s evidence.</p>}
          {actions.includes("submit-work") &&
            !task.blocker &&
            !task.verified && (
              <form
                className="workos-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("submit-work", {
                    summary: workSummary.trim(),
                    reference,
                  });
                }}
              >
                <label>
                  What was produced?
                  <input
                    className="input"
                    required
                    maxLength={120}
                    value={workSummary}
                    onChange={(e) => setWorkSummary(e.target.value)}
                  />
                </label>
                <label>
                  Work evidence ID
                  <input
                    className="input"
                    required
                    pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,63}"
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      setLastRequest(null);
                    }}
                  />
                </label>
                <button className="btn" disabled={busy}>
                  {task.receipt
                    ? "Update submitted evidence"
                    : "Submit work product"}
                </button>
              </form>
            )}
        </section>
      )}
      {!work &&
        actions.includes("measure") &&
        !task.blocker &&
        !task.receipt && (
          <>
            <form
              className="workos-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act("measure", { value: Number(value), reference });
              }}
            >
              <label>
                Observed value ({unit})
                <input
                  className="input"
                  required
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setLastRequest(null);
                  }}
                />
              </label>
              <label>
                Evidence ID
                <input
                  className="input"
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,63}"
                  placeholder="pilot-check-01"
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value);
                    setLastRequest(null);
                  }}
                />
              </label>
              <button className="btn" disabled={busy}>
                Save measurement
              </button>
            </form>
            {actions.includes("choose-output") && (
              <fieldset className="workos-fields">
                <legend>How do you want to select a skill?</legend>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={method === "language"}
                  disabled={busy}
                  onClick={() => changeMethod("language")}
                >
                  Describe a request
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={method === "operator"}
                  disabled={busy}
                  onClick={() => changeMethod("operator")}
                >
                  Choose outputs directly
                </button>
              </fieldset>
            )}
            {method === "operator" && (
              <form
                className="workos-form workos-outputs"
                aria-label="Choose local outputs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("choose-output", {
                    revisions: outputs,
                    expectedRun: task.run,
                  });
                }}
              >
                <fieldset className="workos-fields">
                  <legend>What should this task produce?</legend>
                  <p>
                    Choose one or more outputs for this task. Confirm your
                    choices, then run them together. Review every result before
                    completing the task.
                  </p>
                  {permitted.map((entry) => {
                    const unavailable =
                      entry.needsMeasurement && missingEvidence;
                    return (
                      <label key={entry.pin}>
                        <span>
                          <input
                            type="checkbox"
                            checked={outputs.includes(entry.pin)}
                            disabled={busy || unavailable}
                            onChange={(e) => {
                              setLastRequest(null);
                              setOutputs(
                                e.target.checked
                                  ? [...outputs, entry.pin]
                                  : outputs.filter((p) => p !== entry.pin),
                              );
                            }}
                          />{" "}
                          {entry.outputLabel}
                        </span>
                        <small>
                          {entry.pin} ·{" "}
                          {unavailable
                            ? "Save a measurement and evidence ID first."
                            : entry.output}
                        </small>
                      </label>
                    );
                  })}
                  {!permitted.length && (
                    <p>No output is approved for this task.</p>
                  )}
                </fieldset>
                <button
                  className="btn"
                  disabled={
                    busy ||
                    changedMeasurement ||
                    !outputs.length ||
                    outputs.some(
                      (p) =>
                        !permitted.some(
                          (s) =>
                            s.pin === p &&
                            (!s.needsMeasurement || !missingEvidence),
                        ),
                    )
                  }
                >
                  Confirm chosen outputs
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setOutputs([]);
                    changeMethod("language");
                  }}
                >
                  Cancel output choice
                </button>
              </form>
            )}
            {method === "language" && (
              <form
                className="workos-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("select", {
                    intent,
                    ...(override ? { revision: override } : {}),
                  });
                }}
              >
                <label>
                  Task request
                  <input
                    className="input"
                    required
                    maxLength={160}
                    value={intent}
                    onChange={(e) => {
                      setIntent(e.target.value);
                      setLastRequest(null);
                    }}
                  />
                </label>
                <label>
                  Skill revision
                  <select
                    className="input"
                    value={override}
                    onChange={(e) => {
                      setOverride(e.target.value);
                      setLastRequest(null);
                    }}
                  >
                    <option value="">Automatic match</option>
                    {permitted.map((s) => (
                      <option key={s.pin} value={s.pin}>
                        {s.name} · {s.version}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" disabled={busy || changedMeasurement}>
                  Find approved skill
                </button>
              </form>
            )}
            {method === "language" &&
              !task.selected &&
              requiresChoice &&
              presented.length > 0 && (
                <fieldset className="workos-fields">
                  <legend>Choose a matching operation</legend>
                  <p>
                    Confirm one match with Find approved skill. To run several
                    results together, choose outputs directly.
                  </p>
                  {presented.map((entry) => (
                    <button
                      key={entry.pin}
                      type="button"
                      className="btn"
                      disabled={
                        busy ||
                        !lastRequest ||
                        lastRequest.intent !== intent ||
                        lastRequest.at !== task.routing.at
                      }
                      onClick={() => {
                        setOverride(entry.pin);
                        setMessage("Revision chosen. Confirm the match.");
                      }}
                    >
                      Use {entry.name} {entry.version}
                    </button>
                  ))}
                </fieldset>
              )}
            {method === "language" &&
              !task.selected &&
              task.routing &&
              !requiresChoice &&
              actions.includes("choose-output") && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => changeMethod("operator")}
                >
                  Choose a local output instead
                </button>
              )}
            {task.selected && (
              <div>
                <p>
                  {confirmed ? "Selected" : "Previously selected"}{" "}
                  {storedRevisions.join(", ")} · Assigned to {task.owner}
                </p>
                <button
                  className="btn"
                  disabled={busy || !canUseSelection}
                  onClick={() => act("read-skill")}
                >
                  Open selected skill record
                </button>
                {canUseSelection &&
                  opened &&
                  opened.run === task.run &&
                  opened.pin === task.selected && (
                    <section aria-label="Selected skill record">
                      <h4>{opened.pin}</h4>
                      <p>{opened.purpose}</p>
                      <ol>
                        {opened.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <p>
                        Instruction SHA-256{" "}
                        <code>{opened.instructionHash}</code>
                      </p>
                      <dl>
                        <dt>Inputs</dt>
                        <dd>{opened.inputs}</dd>
                        <dt>Output</dt>
                        <dd>{opened.output}</dd>
                        <dt>Excluded uses</dt>
                        <dd>{opened.excludes}</dd>
                      </dl>
                      {opened.additionalRecords?.map((entry) => (
                        <section key={entry.pin}>
                          <h4>{entry.pin}</h4>
                          <p>{entry.purpose}</p>
                          <ol>
                            {entry.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                          <p>{entry.output}</p>
                          <p>
                            Instruction SHA-256{" "}
                            <code>{entry.instructionHash}</code>
                          </p>
                        </section>
                      ))}
                    </section>
                  )}
                <button
                  className="btn primary"
                  disabled={busy || !canUseSelection}
                  onClick={() => act("run")}
                >
                  {storedRevisions.length > 1
                    ? "Run chosen outputs"
                    : task.selected === "workos.goal-checkin@1.0.0"
                      ? "Run local calculation"
                      : "Run local skill"}
                </button>
              </div>
            )}
          </>
        )}
      {actions.includes("cancel") &&
        (!task.receipt || (work && !task.verified)) &&
        task.blocker !== "Cancelled" && (
          <details>
            <summary>Task options</summary>
            <button
              className="btn"
              disabled={busy}
              onClick={() => act("cancel")}
            >
              Cancel this task
            </button>
          </details>
        )}
      {task.receipt && (
        <div className="quote">
          <b>
            {task.verified
              ? "Verified receipt"
              : task.blocker === "Cancelled"
                ? "Evidence retained on cancelled task"
                : "Receipt awaiting review"}
          </b>
          {task.receipt.additional && (
            <h4>
              {
                catalog.find((entry) => entry.pin === task.receipt.revision)
                  ?.outputLabel
              }
            </h4>
          )}
          <ResultValues receipt={task.receipt} unit={unit} />
          <p>
            Evidence {task.receipt.reference} ·{" "}
            {work
              ? "Work product submitted by " + task.receipt.principal
              : task.receipt.revision}
            {task.receipt.reviewedByPrincipal && (
              <>
                {" "}
                · Reviewed with{" "}
                {task.receipt.reviewedByPrincipal.includes("/")
                  ? "named account"
                  : "installation credential"}{" "}
                {task.receipt.reviewedByPrincipal}
              </>
            )}
            {task.verified && !task.receipt.reviewedByPrincipal && (
              <> · Legacy review, individual reviewer unknown</>
            )}
          </p>
          {task.receipt.instructionHash && (
            <details>
              <summary>Execution identity</summary>
              <p>Executed with {task.receipt.principal}</p>
              <p>
                Instruction SHA-256 <code>{task.receipt.instructionHash}</code>
              </p>
            </details>
          )}
          {(task.receipt.additional as OutputReceipt[] | undefined)?.map(
            (entry) => (
              <section key={entry.revision} aria-label={entry.revision}>
                <h4>
                  {catalog.find((s) => s.pin === entry.revision)?.outputLabel}
                </h4>
                <ResultValues receipt={entry} unit={unit} />
                <p>
                  Evidence {entry.reference} · {entry.revision}
                </p>
                <details>
                  <summary>Execution identity for this output</summary>
                  <p>Executed with {entry.principal}</p>
                  <code>{entry.instructionHash}</code>
                </details>
              </section>
            ),
          )}
          {actions.includes(work ? "review-work" : "verify") &&
            !task.blocker &&
            !task.verified && (
              <form
                className="workos-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(work ? "review-work" : "verify", {
                    reference: review,
                    ...(task.receipt.additional
                      ? {
                          additionalReferences: task.receipt.additional.map(
                            (item: OutputReceipt) =>
                              otherReviews[item.revision] ?? "",
                          ),
                        }
                      : {}),
                  });
                }}
              >
                <label>
                  {task.receipt.additional
                    ? "Confirm evidence ID for " +
                      catalog.find(
                        (entry) => entry.pin === task.receipt.revision,
                      )?.outputLabel
                    : "Confirm evidence ID after review"}
                  <input
                    className="input"
                    value={review}
                    required
                    onChange={(e) => setReview(e.target.value)}
                  />
                </label>
                {(task.receipt.additional as OutputReceipt[] | undefined)?.map(
                  (item) => (
                    <label key={item.revision}>
                      Confirm evidence ID for{" "}
                      {
                        catalog.find((entry) => entry.pin === item.revision)
                          ?.outputLabel
                      }
                      <input
                        className="input"
                        required
                        value={otherReviews[item.revision] ?? ""}
                        onChange={(e) =>
                          setOtherReviews({
                            ...otherReviews,
                            [item.revision]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <button
                  className="btn primary"
                  disabled={busy || (!work && !enabled)}
                >
                  {work ? "Verify work product" : "Verify receipt"}
                </button>
              </form>
            )}
        </div>
      )}
      <p role="status">{draftNotice || message}</p>
    </article>
  );
}

function Operations() {
  const { boot } = useWorkspacePage();
  const q = useApi<Model>("workos");
  const [error, setError] = useState("");
  return (
    <Page
      title="Goal and daily queue"
      sub="Review the commitment, record a measurement and check the result."
    >
      <Load q={q} skeleton={<p>Loading the plan…</p>}>
        {(d: Model) => (
          <div className="stack">
            <ul className="wo-tiles" aria-label="Today at a glance">
              <li>
                <span className="wo-src">Daily queue</span>
                <b className="num">{d.tasks.filter((t) => !t.verified).length}</b>
                <span>still to finish</span>
              </li>
              <li>
                <span className="wo-src warn">Reviews</span>
                <b className="num">
                  {d.approved ? d.tasks.filter((t) => t.receipt && !t.verified).length : 1}
                </b>
                <span>{d.approved ? "receipts to check" : "goal to approve"}</span>
              </li>
              <li>
                <span className="wo-src bad">Blockers</span>
                <b className="num">{d.tasks.filter((t) => t.blocker).length}</b>
                <span>waiting on something</span>
              </li>
              <li>
                <span className="wo-src">Done</span>
                <b className="num">
                  {d.tasks.filter((t) => t.verified).length} of {d.tasks.length}
                </b>
                <span>checked and verified</span>
              </li>
            </ul>
            <section className="card pad stack">
              <h2 className="t-mid">{d.goal.quarter}</h2>
              <dl className="wo-ladder">
                <div style={{ ["--i" as any]: 0 }}>
                  <dt>Quarterly goal</dt>
                  <dd>
                    {d.approved ? "Approved" : "Proposed"} ·{" "}
                    {d.plan.quarter.owner} · Due {d.goal.due}
                  </dd>
                </div>
                <div style={{ ["--i" as any]: 1 }}>
                  <dt>Monthly outcome</dt>
                  <dd>
                    {d.plan.months.map((m) => m.title).join(", ") || "None yet"}
                  </dd>
                </div>
                <div style={{ ["--i" as any]: 2 }}>
                  <dt>Weekly milestone</dt>
                  <dd>
                    {d.plan.weeks.map((w) => w.title).join(", ") || "None yet"}
                  </dd>
                </div>
                <div style={{ ["--i" as any]: 3 }}>
                  <dt>{d.goal.metric}</dt>
                  <dd>
                    {d.goal.baseline} → {d.goal.target} {d.goal.unit} ·{" "}
                    {d.goal.source}
                  </dd>
                </div>
              </dl>
              {d.approved && (
                <p>
                  {d.approval
                    ? (d.approval.principal.includes("/")
                        ? "Approved with named account "
                        : "Approved with installation credential ") +
                      d.approval.principal +
                      " · " +
                      new Date(d.approval.at).toLocaleString()
                    : "Legacy approval · Individual approver unknown"}
                </p>
              )}
              {d.scheduleConflicts.map((x) => (
                <p role="alert" key={x.task}>
                  Schedule conflict · {x.message} Review the dates in the
                  planner. Historical receipts remain available.
                </p>
              ))}
              <div className="wo-acts">
              {boot.access.actions.includes("approve") && !d.approved && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      api("workos/approve", {
                        body: { planRevision: d.revision },
                      }).catch((e) => setError(e.message))
                    }
                  >
                    Approve goal
                  </button>
              )}
                <a className="btn" href="#planner">Open goal planner</a>
                {boot.workspace.modules.team && <a className="btn" href="#team">Open team queue</a>}
              </div>
              {error && <p role="alert">{error}</p>}
            </section>
            <h2 className="t-mid">Daily actions</h2>
            {d.tasks.map((t) => (
              <DailyAction
                key={t.id}
                task={t}
                unit={d.goal.unit}
                catalog={d.catalog}
                planRevision={d.revision}
              />
            ))}
          </div>
        )}
      </Load>
    </Page>
  );
}
function Usage() {
  const [days, setDays] = useState(7);
  const [rank, setRank] = useState("executed");
  const q = useApi<Model>("workos", { days });
  return (
    <Page
      title="Skill usage"
      sub="Local activity and reviewed receipts for this installation."
    >
      <label>
        Period{" "}
        <select
          className="input"
          aria-label="Period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </label>
      <Load q={q} skeleton={<p>Reading the ledger…</p>}>
        {(d: Model) => (
          <div className="stack">
            <section className="card pad">
              <h2 className="t-mid">All local skills</h2>
              <dl className="workos-facts">
                {(
                  [
                    "suggested",
                    "selected",
                    "operatorChosen",
                    "automaticSelections",
                    "confirmedLanguageChoices",
                    "opened",
                    "loaded",
                    "executed",
                    "verified",
                    "blocked",
                    "failed",
                    "retries",
                  ] as const
                ).map((k) => (
                  <React.Fragment key={k}>
                    <dt>
                      {(
                        {
                          operatorChosen: "chosen directly by an operator",
                          automaticSelections: "automatic language selections",
                          confirmedLanguageChoices:
                            "language selections with an explicit revision",
                        } as Record<string, string>
                      )[k] ?? k}
                    </dt>
                    <dd>{d.usage[k]}</dd>
                  </React.Fragment>
                ))}
                <dt>Verified among executions in this period</dt>
                <dd>
                  {d.usage.executed
                    ? Math.round(
                        (100 * d.usage.verifiedAmongExecutions) /
                          d.usage.executed,
                      ) +
                      "% (" +
                      d.usage.verifiedAmongExecutions +
                      "/" +
                      d.usage.executed +
                      ")"
                    : "No executions"}
                </dd>
                <dt>Measured cost</dt>
                <dd>Unknown</dd>
              </dl>
              <p>
                {d.usage.source} · Updated{" "}
                {new Date(d.usage.asOf).toLocaleString()} · Retention{" "}
                {d.usage.retentionDays} days
              </p>
            </section>
            <section className="card pad stack">
              <h2 className="t-mid">By skill revision</h2>
              <label>
                Show skills
                <select
                  className="input"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                >
                  <option value="executed">Most executed</option>
                  <option value="verified">Most verified</option>
                  <option value="unused">Unused in period</option>
                  <option value="review">Review needed</option>
                </select>
              </label>
              {d.usage.perSkill
                .filter((s) =>
                  rank === "unused"
                    ? s.executed === 0
                    : rank === "review"
                      ? s.failed > 0 || s.verifiedRuns < s.executed
                      : true,
                )
                .sort((a, b) =>
                  rank === "verified"
                    ? b.verified - a.verified
                    : b.executed - a.executed,
                )
                .map((s) => (
                  <div key={s.pin}>
                    <strong>{s.name}</strong> · {s.executed} executed ·{" "}
                    {s.verified} verified · {s.failed} failed
                    <p>
                      {s.executed
                        ? Math.round((100 * s.verifiedRuns) / s.executed) +
                          "% verified (" +
                          s.verifiedRuns +
                          "/" +
                          s.executed +
                          ")"
                        : "No executions in period"}{" "}
                      ·{" "}
                      {s.lastExecuted
                        ? "Last execution " +
                          new Date(s.lastExecuted).toLocaleString()
                        : "No recorded execution in period"}
                    </p>
                  </div>
                ))}
              {rank === "unused" &&
                d.usage.perSkill.every((s) => s.executed > 0) && (
                  <p>All installed skills were used in this period.</p>
                )}
              {rank === "review" &&
                d.usage.perSkill.every(
                  (s) => !s.failed && s.verifiedRuns === s.executed,
                ) && <p>No recorded executions need review.</p>}
            </section>
            <section className="card pad stack">
              <h2 className="t-mid">Daily usage</h2>
              <p>
                UTC days with retained activity · Local deterministic runner
              </p>
              {!d.usage.trend.length && (
                <p>No executions or reviews in this period.</p>
              )}
              {d.usage.trend.map((d) => (
                <p key={d.date}>
                  {d.date} · {d.executed} executed · {d.verified} verified ·{" "}
                  {d.distinctSkills} distinct skills executed
                </p>
              ))}
              {d.usage.blockedReasons.length > 0 && (
                <div>
                  <h3>Blocked reasons</h3>
                  {d.usage.blockedReasons.map((r) => (
                    <p key={r.reason}>
                      {r.reason} · {r.count}
                    </p>
                  ))}
                </div>
              )}
            </section>
            <h2 className="t-mid">Event evidence</h2>
            {d.canReviewCatalogue && <HistoricalUsage />}
            {!d.usage.events.length ? (
              <p>No events in this period.</p>
            ) : (
              d.usage.events.map((e) => (
                <details key={String(e.id)} className="card pad">
                  <summary>
                    {String(e.stage)} · {String(e.task)}
                  </summary>
                  <p>
                    Run {String(e.run)} ·{" "}
                    {String(e.revision ?? "No skill selected")} ·{" "}
                    {new Date(Number(e.at)).toLocaleString()}
                  </p>
                  {e.reason && <p>{String(e.reason)}</p>}
                  {e.duration !== null && (
                    <p>
                      Local execution took {Number(e.duration).toFixed(2)} ms
                    </p>
                  )}
                </details>
              ))
            )}
          </div>
        )}
      </Load>
    </Page>
  );
}

// The rail groups the pages by what the person came to do.
const GROUPS: [string, string[]][] = [
  ["Work", ["workos", "team", "planner", "rehearsal"]],
  ["Skills", ["skills", "usage"]],
  ["Think", ["metrics", "second-brain", "decisions"]],
];
export function StarterPages({ page }: { page: string }) {
  const { boot } = useWorkspacePage();
  const w = boot.workspace;
  const contentId = useId();
  const labels: Record<string, string> = {
    workos: "Daily queue",
    planner: "Goal planner",
    rehearsal: "Linear rehearsal",
    metrics: "Metrics",
    skills: "Skills",
    usage: "Skill usage",
    "second-brain": "Second Brain",
    decisions: "Decision Room",
    team: "Team queue",
  };
  const tabs = Object.keys(labels).filter(
    (k) =>
      ["workos", "usage", "planner", "rehearsal"].includes(k) || w.modules[k],
  );
  const current = page === "overview" ? "workos" : page;
  const View = VIEWS[current];
  return (
    <div
      className="lg workos-shell"
      style={
        {
          "--client-accent": boot.accents[w.brand.accent]?.dark,
        } as React.CSSProperties
      }
    >
      <a
        className="workos-skip"
        href={"#" + contentId}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(contentId)?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="wo-side">
        <header className="wo-brand">
          <i aria-hidden="true" />
          <div>
            <strong>{w.name}</strong>
            <span className="t-cap">WorkOS</span>
          </div>
        </header>
        <nav aria-label="WorkOS pages">
          {GROUPS.map(([group, keys]) => {
            const shown = keys.filter((k) => tabs.includes(k));
            return shown.length ? (
              <div key={group} role="group" aria-label={group}>
                <span className="wo-grp" aria-hidden="true">
                  {group}
                </span>
                {shown.map((k) => (
                  <a
                    key={k}
                    href={"#" + k}
                    aria-current={current === k ? "page" : undefined}
                  >
                    {labels[k]}
                  </a>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <p className="wo-private">
          <b>Private to this computer.</b> This workspace has its own folder
          and password. Nobody outside it can see this work.
        </p>
      </aside>
      <div className="wo-top">
        <span className="wo-chip">
          <i aria-hidden="true" />
          Client mode
        </span>
        <span className="wo-chip">{w.owner} · Local review installation</span>
        <span className="wo-grow" />
        <span className="wo-chip">
          Signed in as {boot.access.principal} · {boot.access.role}
        </span>
      </div>
      <main id={contentId} tabIndex={-1} key={current}>
        {!tabs.includes(current) ? (
          <p>
            This page is unavailable for this installation.{" "}
            <a href="#workos">Open daily queue</a>
          </p>
        ) : current === "planner" ? (
          <PlanPage />
        ) : current === "rehearsal" ? (
          <FixturePage />
        ) : current === "team" ? (
          <TeamQueue />
        ) : current === "workos" ? (
          <Operations />
        ) : current === "usage" ? (
          <Usage />
        ) : View ? (
          <View />
        ) : null}
      </main>
    </div>
  );
}
function TeamQueue() {
  const q = useApi<Model>("workos");
  return (
    <Page title="Team queue">
      <Load q={q} skeleton={<p>Loading queue…</p>}>
        {(d: Model) => (
          <section className="card pad stack">
            <h2>{d.owner}</h2>
            {d.tasks.map((t) => (
              <p key={t.id}>
                <strong>
                  {t.id === d.queue.current
                    ? "Current · "
                    : t.id === d.queue.next
                      ? "Next · "
                      : ""}
                  {t.title}
                </strong>{" "}
                ·{" "}
                {t.verified
                  ? "Verified"
                  : t.blocker ||
                    (t.receipt
                      ? "Review receipt"
                      : t.selected
                        ? "Ready to run"
                        : "Awaiting check-in")}{" "}
                · {t.owner} · {t.due}
                {t.overdue ? " · Overdue" : ""}
                {t.receipt && <> · Evidence {t.receipt.reference}</>}
              </p>
            ))}
            <a href="#workos">Open daily actions</a>
          </section>
        )}
      </Load>
    </Page>
  );
}
