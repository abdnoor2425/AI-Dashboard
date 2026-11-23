# WorkOS client starter

**Private review candidate · kit 0.2.0-review.12 · SQLite schema 3, configuration schema 1.** Sam can rehearse a client installation with the two supplied fixtures. Each installation has one loopback listener, one database and a generated installation credential. Optional named accounts scope review and operator access within that client. Use a separate OS account or machine and a separate browser profile for each real client. Anyone with the operator's filesystem access can read that installation. Do not share a machine login, publish a listener, use a tunnel, or host multiple client accounts in the desktop app.

## Install and open

Use the independently initialized WorkOS repository. Its root, source provenance and retained notices are documented in README.md. The separate private GitHub destination is abdnoor2425/workos-client-starter. Use the exact verified revision identified in the checkpoint record. Prerequisites for the starter are Git, Node 24 LTS with built-in SQLite, npm, a local browser and a POSIX filesystem. The foreground launcher requires no desktop autostart, OAuth account, AI provider, MCP registration or payment key.

From the checkout, with the intended operator signed in:

```sh
npm ci
npm test
npm run build
mkdir -m 700 "$HOME/workos-review"
npm run doctor -- examples/workos/alder.json "$HOME/workos-review/alder"
npm run workos -- install "$HOME/workos-review/alder" examples/workos/alder.json
npm run workos -- index "$HOME/workos-review/alder"
npm run workos -- start "$HOME/workos-review/alder"
```

Open **http://127.0.0.1:3411/#workos** locally. Enter username `alder-demo` and the generated password from the installation's `access` file in the browser's authentication prompt. Read it privately. Keep it out of shell history, URLs, tickets and screenshots. Stop the foreground server with Ctrl-C. Restart using the same start command. For Birch, use a second terminal, the `birch.json` example and a new `birch` directory. Its username is `birch-demo` and its port is 3412. The Birch overlay deliberately lacks permission to create receipts.

The directory must be new, outside the code checkout, with a real existing parent. The installer refuses to overwrite an installation. The launcher binds IPv4 loopback and accepts the configured host and port. A port collision fails startup. If an active writer keeps SQLite locked, the HTTP launcher responds with 503 and a one-second retry hint. Retry the same revision-bound command after the writer finishes. The independent package's `npm start -- /absolute/installation` starts exactly one WorkOS installation. Direct Next requests cannot open the desktop API. Keep credentials and data outside the code tree.

## Onboarding checklist

Work through this list for each client installation and record the result with the exact revision.

1. **Machine and account.** A Mac or Linux machine, a dedicated OS account for this client, Node 24 LTS, npm and Git. Windows is not supported.
2. **Checkout.** Clone the reviewed release, record `git rev-parse HEAD`, then run `npm ci`, `npm test` and `npm run build`.
3. **Config.** Copy a fixture, set the client ID, name, accent, owner label, port, modules, enabled skill pins, tools, grants and retention. Use synthetic or approved data only.
4. **Preflight.** Run `npm run doctor -- <config.json> <new-directory>`. Every line must be PASS or an understood WARN.
5. **Install and index.** Run `install` and `index`, then `npm run doctor -- <directory>` to confirm private files, database integrity and schema 3.
6. **First sign-in.** Start the launcher, open the loopback URL in a separate browser profile and sign in with the generated credential. Keep the `access` file private.
7. **Named accounts.** Add reviewer and viewer accounts if more than one person will use the installation.
8. **Goal.** Create or approve the quarterly goal, check owners, dates and prerequisites, and approve the plan.
9. **Walkthrough.** Record one observation, match and run an approved skill, verify the receipt and check Metrics and Skill usage.
10. **Backup and rollback.** Run `npm run workos -- backup <directory> <new-backup-directory>`, rehearse `restore` into a new directory, and rehearse `update` and `rollback` on a copy.
11. **Hand over.** Give the client the runbook, support contact and known gaps from the acceptance ledger. Do not connect live accounts until the security review is signed off.

## Configure an installation

Copy a fixture before editing. The config controls the installation ID, loopback port, name, accent, owner label, modules, enabled skill pins, available tools, permissions and event retention (1–365 days). The goal and tasks in this file seed the first plan. Later edits belong in **Goal planner**. Client ID, port and seed fields stay fixed during config updates. Use a new private directory for each client. Access to the operating-system account gives access to its SQLite database, index, credential and backups.

The Alder fixture explicitly enables three local skills at their default revisions, plan editing, work-product evidence and fixture import. Birch has a different credential, index, database and port. Its overlay allows inspecting the seeded plan and queue. Its skill, editor and import grants are disabled. The installation credential records the installation ID. A task owner identifies the accountable assignee. Optional named credentials record the account used for each newly approved goal, executed receipt and review. Legacy records keep the attribution originally available.

## Provision a named local account

The OS installation owner manages named accounts. The installation credential has the operator role. Catalogue grants restrict skills and tools. A limited catalogue still lets an operator approve a plan and record a raw observation. Use a viewer account for read-only access. Those raw observations cannot update verified metrics until the appropriate skill, evidence and review requirements are met. Operators may perform enabled installation actions. Reviewers may approve the active plan and verify existing receipts. Viewers can read installed modules, export and history. They have no mutation routes. Named roles never grant a disabled module, skill or tool. Use separate credentials and browser profiles for each actor. Anyone who can read another person's password or directly edit the database remains within the OS trust boundary.

Generate a random credential in a private directory outside the checkout and provision it on standard input. The example uses the Alder synthetic installation. WorkOS stores a verifier and role. It never prints the secret. Repeating the same grant with the same credential is safe. The initial file creation refuses to overwrite an existing file.

```sh
node --input-type=module -e 'import fs from "node:fs"; import {randomBytes} from "node:crypto"; fs.writeFileSync(process.argv[1],randomBytes(32).toString("hex")+"\n",{mode:0o600,flag:"wx"})' "$HOME/workos-review/reviewer.access"
npm run workos -- member-add "$HOME/workos-review/alder" rita reviewer < "$HOME/workos-review/reviewer.access"
```

Sign in to the local Alder origin as `alder-demo/rita` with that private credential. To change or suspend access, use `npm run workos -- member-role "$HOME/workos-review/alder" rita viewer` or replace `viewer` with `suspended`. New HTTP requests see the new role immediately. Mutations recheck the account after acquiring the write lock. Suspension preserves earlier approvals and receipts. An older stopped backup restores the roles it contained, so review and reapply later suspensions before reopening a restored installation. The stdio MCP reader remains an OS-local read interface and requires filesystem access. Do not grant it to someone solely because they hold a web viewer credential.


## From a new goal to a reviewed outcome

1. In **Goal planner**, select **New quarterly goal**. Enter the commitment, accountable owner, due date, metric, unit, baseline, target and measurement source. For example, enter “Shorten intake”, “Intake duration”, 18 hours to 10 hours, and “Synthetic observation log”.
2. Choose **Draft steps from goal** for an editable baseline check and final review. The local template uses the metric, baseline, target, owner and deadline. The default two-check draft schedules the first observation seven days before the target date. For a full measurement plan, select **Weekly checks across the quarter**, enter the measurement start date and choose **Draft steps from goal**. The range can span up to 92 calendar days. Use the goal-specific pilot below when the plan must include a change to test and evidence of the resulting work products. The draft includes a baseline, Sunday and calendar month-end checks within the period, and a final check on the deadline. Every intermediate and final task references the baseline. The generated task list remains editable before approval. An operator can also add monthly outcomes, weekly milestones and daily actions by hand, change owners or parents, and set deadlines or prerequisites. Each date must fit its parent. Prerequisites must be earlier actions in the same plan and are due on or before their dependent. The planner shows any imported legacy inversion. A new approval is blocked until active conflicts are repaired or the affected work is cancelled. Already-approved legacy work still checks the prerequisite's actual verification.
3. Saving a new goal archives the current plan, its approval and its task receipts. Open **Archived goals** to inspect them. Each structural change creates a new revision and requires approval. A task with activity keeps its identity, owner, due date and lineage. The recorded metric definition stays fixed once activity exists. Use a new quarterly goal for a new metric. Conflicting saves ask the operator to reload and review.
4. Review the proposed commitment in **Daily queue** and select **Approve goal**. If a prerequisite is cancelled, the dependent shows its blocker. Open **Task options** on the dependent to cancel it, or edit its prerequisite in the planner before the dependent has activity, then approve the revised plan. Both paths preserve the original cancellation event.
5. For a measured task, enter the observed value and a short local evidence ID. The seeded Alder walkthrough uses 16 and `pilot-check-01`. Enter a request, choose **Find approved skill**, inspect the selected revision, then run it. The source reference is supplied by the operator. A numeric reading can be accurate only to the extent that the underlying evidence is trustworthy.
6. Review the output and confirm its recorded reference. **Metrics** displays the latest verified Goal check-in reading for the active goal. A deadline receipt, draft note, source issue marked Done, or completed task alone cannot supply a business measurement. **Skill usage** shows suggestions, selections, explicit record opens, executions, failures, blocks, retries and verified receipts. An operator’s **Open selected skill record** action loads the full original steps for display and counts once per run and exact pin. The runner records a separate loaded event and the SHA-256 of the exact procedure on new receipts. Earlier receipts keep their original fields. It confirms the record was requested, without establishing comprehension or execution. Open an event for its run and revision. Unknown cost stays unknown.

The requirement-by-requirement evidence and outstanding release gates are in [the acceptance ledger](WORKOS-ACCEPTANCE.md).

## Approved local catalogue

| Request | Pinned skill | Required grants and tool | Receipt |
| --- | --- | --- | --- |
| Review goal progress | `workos.goal-checkin@1.0.0` | `goals.read`, `receipts.write`, WorkOS local calculator | Observed value, baseline, target, unit and difference |
| Calculate target progress | `workos.goal-checkin@1.1.0` | Same tool and grants as 1.0.0, separate opt-in version | Measured change and signed percentage of distance from baseline to target |
| Check the task deadline | `workos.deadline-review@1.0.0` | `queue.read`, `receipts.write`, WorkOS local calendar | Due date and remaining UTC calendar days |
| Prepare a handoff note | `workos.evidence-handoff@1.0.0` | `queue.read`, `evidence.read`, `receipts.write`, WorkOS local notes | Draft note with owner, measurement and reference |

### Choose outputs and review the evidence

In the daily queue select **Choose outputs directly**. Check the results the task needs, then select **Confirm chosen outputs**. A deadline uses the due date. A comparison, progress percentage or handoff also requires a saved observation and evidence ID. The picker shows each permitted pin and explains missing inputs. The order you choose determines the order of receipt sections. **Cancel output choice** clears the draft. Confirmation prepares the work. Opening its records shows the procedures. Only **Run chosen outputs** or the single-output Run button invokes them.

A mixed request can produce several results on one task. For example, select calendar days and a handoff note, confirm, and run. The reviewer checks the task ID for the calendar result and the recorded observation's reference for the note. All references must agree before the task or a linked measurement becomes verified. A verified measurement shows the observed value, change since baseline and the magnitude above or below target in the original units. The target gap is derived from the captured reading and target. A gap outside the numeric range is shown as unavailable. Changing a draft, a saved observation, the plan or the chosen outputs requires a new confirmation.

**Describe a request** still offers automatic matching. An unfamiliar request may be declined, and a compound request may return choices instead of a selection. A missed request leaves the operator free to choose different local outputs or stop. Direct choices never use the free-text matcher. The usage view reports suggestions, automatic selections, selections with an explicit revision, operator-chosen outputs, opens, executions, failures and verifications. Each stage is deduplicated per run and revision. Several stages can describe one run. Changes to the active goal metric come only from a verified measurement. Older records retain their available stages. An imported historical read count supplies no invocation or outcome evidence.

`POST /api/workos/choose-output` accepts exactly `task`, `planRevision`, `expectedRun` and a nonempty ordered list of distinct `revisions`. Pass the task's current run (including null on a new task). Every pin must be approved for the task, available with its required tools and grants, and have its required inputs. The server stores the explicit choice without a user prompt. Existing read/run/verify requests bind the returned run and first pin. Multi-output verification adds `additionalReferences` in receipt order. If one computation fails, the ledger retains actual attempts and the task has no completed receipt to verify.

Use the optional `deprecatedSkills` list to retire exact pins. A deprecated pin is ineligible, including when requested explicitly. Retain older checkouts for historical code review. The Skills module, pinned revision, required grants and available local tool must all be enabled. Selection, execution and verification check policy. The local router first checks documented phrases, then parses the whole request with bounded English language rules. Local requests can express the operation, the active task and the desired output in different orders. A named metric must belong to the active quarterly plan. Short current-task context such as “The new measurement is available” can precede a request. A local expression of the form (current minus baseline) divided by (target minus baseline), expressed as a percent, requests Goal check-in 1.1.0. The router does not evaluate arbitrary expressions. Ask for an observed comparison, a UTC calendar deadline, a local evidence handoff, or the percentage of the distance from baseline to target. That percentage requires Goal check-in 1.1.0. For example, “Could you check the latest reading against our goal?” or “Tell me when the current action is due.” When a request names two supported actions, the queue shows **Choose a matching operation**. Choose one offered revision and press **Find approved skill** again. An ordinary comparison selects Goal check-in 1.0.0. A request for the percentage of the distance from baseline to target selects 1.1.0. A general request such as “Review goal progress” can offer both when both are installed. A specific request declines if its exact output pin is unavailable. When an installation approves only 1.1.0, request a percentage explicitly or choose a general check-in. Choosing alone produces no selection or receipt. **Run** and **Open selected skill record** require a match confirmed against the current form. Match again after editing the request or revision, or reloading a saved selection. Save or restore an edited measurement and evidence ID before matching again. If any clause names an unavailable operation, use the approved-request fallback. Unsupported clauses cause an abstention. The operator must explicitly run and verify. Invocations have no network transport, paid model call or message delivery. There is no runtime skill installation.

The private reference library was reviewed at `0d324db79241ec5bbe5cd0afee89fbfcd72781f8`. Its 137 definitions include 75 bounded evaluations, five scoped runtime records and 57 blocked or unrun records. It records zero full client-ready certifications. Distribution rights and long-term ownership remain unresolved. This kit includes three original local skills and four executable version pins. No private definitions or historical usage records are bundled.

## Supported integration matrix

| Surface | Available behavior | Operating limit |
| --- | --- | --- |
| Local goal, queue, skills and decisions | Authenticated browser and JSON endpoints, installation SQLite database | Installation operator and optional named roles |
| Second Brain | Explicit index command reads the private project directory | Local documented file formats and index limits |
| Historical catalogue | Permission-gated metadata import and revision inspection | Explicit offline input, no instruction execution |
| Linear | Synthetic issue reconciliation with atomic batches and repeated-delivery handling | No live Linear connection |
| MCP | Local stdio `workos_queue` and `workos_handoff` | Read-only, one explicit installation, no provider dispatch |
| Stripe, email, calendar, AI providers and other external services | Closed in the WorkOS launcher | No credentials accepted or external writes |

For local MCP use `node mcp/server.mjs /absolute/private/installation` with an authorized stdio client. `workos_handoff` takes one active task ID. Its `workos.local-handoff/v1` result includes installation, plan revision, owner, selected run/pin, reason, permissions and any recorded receipt. The caller needs OS access to the installation. Operator-readable local history and release decisions are documented in [historical evidence](WORKOS-HISTORY.md).

## Rehearse a Linear issue batch

With `fixture.import`, open **Linear rehearsal**, select **Load sample batch**, inspect the JSON and choose **Reconcile batch**. The input is a synthetic local snapshot. It requires no token or Linear account. An example envelope for the seeded Alder installation follows.

```json
{"source":"synthetic-linear/v1","client":"alder-demo","planRevision":1,"issues":[{"id":"mock-intake","identifier":"QA-101","version":1,"title":"Review intake","owner":"Fixture lead","week":"week","due":"2026-12-02","state":"Todo"}]}
```

A batch holds 1–50 issues. Use the active revision and the destination week ID from `GET /api/workos`. Each stable source ID maps to an installation-specific task. Source version increases monotonically. Exact duplicates and stale source versions have no effect, including redelivery of the original envelope after a plan edit. The same source version with different content is a conflict. New changes must use the current plan revision. Updates merge independent edits and reject competing changes to the same field. In that case inspect both values, align the editable local field with the chosen source or prior value, and retry a current batch. A rejected batch commits nothing. Archived mappings retain their original identity. Use a new synthetic issue ID for new work in a later plan. Mock source state and local verification are displayed separately. There is no live read, write, webhook, pagination, or delivery retry against Linear.

## Boundaries and operations

**Team queue** displays active assignments and blockers. **Second Brain** reads the indexed installation project directory. Run `index` after changes to its local documents. **Decision Room** saves a decision from its local fixed-role simulation. The client launcher denies credential setup, agent discovery, connector sync and outbound actions. The independent browser entry point has an installation-only shell. Its bare Next API returns 403. The WorkOS MCP connection reads a selected installation with a read-only database handle.

A Stripe restricted-key prefix identifies the key type. Only the Stripe account can establish its effective permissions. The retained reference adapter requires an operator to confirm Charges, Customers, Subscriptions and Payouts have Read access and that other resources have None. Its adapter issues allowlisted GET requests and refuses redirects. Synthetic tests check those operations and denied reads. Live Stripe scopes remain unverified.

The authenticated `GET /api` lists the routes allowed for this installation. WorkOS mutations require the current `planRevision`. Opening a task’s skill record, running and verifying also require the reviewed `expectedRun` and `expectedSkill`. `GET /api/export?days=30` returns the active hierarchy, task receipts and retained usage window. `GET /api/workos/history` lists the latest 100 archived plans. Use `?revision=N` for an archived hierarchy and its receipts. The export excludes the credential, project documents and decisions. The ledger excludes raw task requests. Execution duration is observed locally. Verification records the operator's evidence check. Cost and causal business impact remain unknown. `clear-usage` deletes the event ledger while preserving receipts and decisions.

## Goal-specific work pilots

In **Goal planner → New quarterly goal**, enter the business metric, source, baseline, target and deadline. Choose **Goal-specific work pilot**, select turnaround, conversion or quality, then enter the work area, change to test and a start date that gives a pilot of 5–92 calendar days, counting both the start date and deadline. The draft includes a baseline, three operational tasks and a final observation. For turnaround, the tasks locate a wait, design a handoff and trial it. Conversion focuses on drop-off, experiment design and trial results. Quality focuses on recurring defects, a control and its trial. Check each owner, date, prerequisite and acceptance criterion before approval. Each action unlocks when its predecessor’s evidence is verified. Use a custom hierarchy for goals outside these three patterns.

Work pilots require the explicit `work.record` installation grant for work products. Alder opts in; existing overlays require an explicit update. A metric action requires one permitted Goal check-in revision. A work product needs a short description and a local evidence ID. An operator may correct the pending submission. A reviewer confirms its current evidence ID. A verified work product counts toward task completion. Only verified calculator observations update business metrics. Work submissions and reviews generate no skill execution or verification count. During a pilot the operator supplies the evidence and the reviewer inspects it locally. The software carries out no changes in client systems. Pending corrections replace the active unverified description. Verified submissions retain their evidence and account attribution.

The installation-local `workos/submit-work` and `workos/review-work` routes in the authenticated local manifest require the current `planRevision` and `expectedRun`. Submit with `expectedRun: null` for a first submission. Revisions and reviews name the current run. Repeating an identical submission or review preserves the existing receipt. In **Daily queue**, a declined request can be replaced explicitly using **Choose an approved request**. The button fills the request and pins its revision. The operator must confirm the match and invoke the skill separately.

Run `node scripts/workos-routing-contract.mjs` and `node scripts/workos-routing-contract.mjs holdout` to reproduce the original 168- and 488-case language benchmarks. Their historical answer keys required an abstention for an ordinary comparison with both goal revisions installed and assumed 1.1.0 could substitute when 1.0.0 was missing. Review.10 retains these answers for comparison. It agrees on 160/168 and 465/488. Two and ten previously expected abstentions select the specifically requested 1.0.0, all on installations with both revisions approved. On installations with only 1.1.0 the explicitly ordinary comparison now declines. The [acceptance ledger](WORKOS-ACCEPTANCE.md) reports the independent language tests and missing coverage.

Run `node scripts/workos-routing-contract.mjs conversational` for the review.12 conversational set (78 short operator requests, self-authored and sealed before the conversational layer was written). In the Alder profile it matches 38/38 eligible requests and declines 40/40; across all eight permission profiles it matches 155/178 with zero wrong selections. Percentage requests deliberately stay with the strict parser. `conversational-dev` is the development set used for tuning.

Run `node scripts/workos-routing-policy.mjs` for an independent expected-policy calculation. Across three documented requests and four natural requests it exhausts 4,587,520 combinations of revision, retirement, module, tool, grant, observation and override settings. Every one of the 17,920 expected selections and 4,569,600 required abstentions matched.

## Back up and restore

`backup` works while the launcher is running. It writes a consistent database snapshot, the installation credential and the project documents to a new private directory, with a `backup.json` manifest holding the client, kit version, schema and the database SHA-256. It never overwrites and refuses links inside the project folder.

```sh
npm run workos -- backup "$HOME/workos-review/alder" "$HOME/workos-backups/alder-2026-11-19"
npm run workos -- restore "$HOME/workos-backups/alder-2026-11-19" "$HOME/workos-review/alder-restored"
npm run workos -- index "$HOME/workos-review/alder-restored"
```

`restore` checks the manifest, the database hash and SQLite integrity, then writes to a new directory only. The search index is rebuilt by `index`. A backup contains the installation password, so keep it in a private location and never in the checkout. Stop the original launcher before starting the restored copy, because both use the same port.

## Configuration update, schema upgrade and recovery

Stop the launcher and make a private copy of the whole directory. Keep the previous reviewed checkout and built assets. Update a reviewed configuration and reverse the last overlay with the commands below. Lower retention can prune events, so retain the stopped backup.

```sh
npm run workos -- update "$HOME/workos-review/alder" /absolute/path/to/reviewed-alder.json
npm run workos -- rollback "$HOME/workos-review/alder"
```

For an **application upgrade from schema 1 or 2**, stop all writers. Build the new checkout separately, preserve the old checkout and make a private full-directory backup. From the new checkout, rehearse on a stopped copy first.

```sh
npm run workos -- upgrade "$HOME/workos-review/alder"
npm run workos -- start "$HOME/workos-review/alder"
```

The upgrade writes and integrity-checks `before-schema-3.sqlite`, then upgrades the format in a transaction. Schema 1 also receives the editable hierarchy. Schema 2 retains its current hierarchy and receipts. Schema 3 prevents older binaries from verifying only part of a compound result. Existing credentials, receipts and verified data stay in place. New edit/import/tool grants require an explicit config update. A completed upgrade can be repeated. If a backup exists after an interrupted upgrade, preserve that directory, restore another copy of the stopped pre-upgrade installation and retry there.

For application rollback, stop the newer launcher and preserve its **whole directory** so newer work can be recovered. Restore the pre-upgrade stopped copy to its original path and start the matching older checkout. Alternatively, in a private disposable copy of the stopped installation, restore `before-schema-3.sqlite` as `workos.sqlite` and use the matching reviewed WorkOS build that understands the original schema (1 or 2). A project index retains its source path, so use the original private project path for a real restore. Revisit authentication, records, decisions and the project after recovery. To return forward, stop the old build and restore the matching newer directory and checkout. For a review.4 → review.3 application rollback, restore the stopped review.3 snapshot before starting that binary. Both use SQLite schema 2, but review.3 cannot interpret the later proof annotations and work-recording permission. Forward restoration uses the preserved review.4 directory, which keeps submitted work products and archived metrics. Schema-1 builds reject schema 2. A snapshot rollback presents records as of that snapshot.

## Reproduce the review

Run `npm run doctor`, `python3 tests/workos_calendar_oracle.py`, `npm test`, `npm run build`, `node_modules/.bin/tsc --noEmit --incremental false`, `npm audit` and `git diff --check`. For HTTP/browser coverage, install Python Playwright and use a local Chromium. The schema migration rehearsal creates its own synthetic legacy installation.

```sh
CHROMIUM=/absolute/path/to/chromium \
WORKOS_SCREENSHOTS=/private/path/to/evidence \
python3 tests/workos_browser.py
```

The suite exercises two synthetic installations, every advertised client read, credential checks on every advertised method, local mutations, and direct Next route rejection. It opens the goal planner, corrects an inverted dependency date, routes and opens a pinned skill, verifies receipts, reads historical evidence, and checks mobile layout. It upgrades a synthetic schema-1 database, checks its restored backup through SQLite and returns to the newer state. It also checks the local MCP handoff using the verified task and receipt, and runs axe-core WCAG 2.2 AA rules on every page for both clients at phone and desktop widths. To add the actual independent binary rollback rehearsal, build a second standalone WorkOS checkout at the previous reviewed commit `23ea8265ded0d2c23925fcaf28a1cf86b73afcf0` (review.11 on the published history; engineering-history checkouts up to `deb5877` are also accepted) and pass its absolute path through `WORKOS_INDEPENDENT_BASELINE`. The harness verifies both repositories share that independent root, invokes only the WorkOS launcher, and checks version, credential reuse and measurements before and after restoring the stopped copy.


**Outstanding under Q4-263 and Q4-268.** Independent identity assurance, planning outside the three work-pilot families, human-authored routing evaluation on representative client requests, certified private catalogue distribution, live integration contracts, long-term adoption and impact evidence, manual screen-reader review and the Mac Mini rehearsal remain open. Abdullah is the implementation contact and Sam owns the setup decision. Nancy’s independent sign-off, a verified published revision, licensing and a long-term maintainer remain release gates.
