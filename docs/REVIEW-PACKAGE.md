# WorkOS review package for Nancy

This package lets a reviewer check WorkOS (Q4-263, with goals from Q4-268) without the people who built it. Use synthetic data only. Do not connect real accounts.

## What WorkOS is

One private installation per client on one machine. Each installation has its own database, password, port and project folder. An operator sets a quarterly goal, breaks it into monthly, weekly and daily work, records measurements and runs approved local skills. Each run produces a receipt that a reviewer checks before it counts. Nothing is sent outside the machine.

## Reproduce it (about 20 minutes)

Use a Mac or Linux account with Node 24, npm, Git and Python 3.

```sh
git clone https://github.com/abdnoor2425/workos-client-starter && cd workos-client-starter
npm ci && npm test && npm run build && npm run doctor
mkdir -m 700 "$HOME/workos-review"
npm run doctor -- examples/workos/alder.json "$HOME/workos-review/alder"
npm run setup -- "$HOME/workos-review/alder" examples/workos/alder.json
npm run workos -- index "$HOME/workos-review/alder"
npm start -- "$HOME/workos-review/alder"
```

Open http://127.0.0.1:3411/#workos. The username is `alder-demo`. The password is in `$HOME/workos-review/alder/access`. For the full automated walkthrough, install Python Playwright and run `python3 tests/workos_browser.py`.

## Review checklist

Status words: **Prepared** means it is in the repository. **Tested** means an automated test exercises it with synthetic data. **Approved** needs a named reviewer. **Deployed** means it is running for a real client. Nothing is Approved or Deployed yet.

| # | Q4-263 requirement | Where to look | Status |
| --- | --- | --- | --- |
| 1 | Private repository, exact revision, no copied credentials or client records | GitHub repository, `git log`, `examples/workos/*.json` | Tested (private, synthetic only). AIBusinessBoomer destination open. |
| 2 | Versioned module, inputs and config, prerequisites, setup, safe sample, outputs, failure handling and rollback | `INSTALL.md`, `docs/WORKOS.md`, `lib/workos/config.ts`, `npm run doctor` | Tested |
| 3 | Clean-setup end-to-end test with two independent synthetic clients | `tests/workos_browser.py` (Alder and Birch) | Tested on Linux. Mac Mini open. |
| 4 | Preserve Second Brain, Decision Room and the task queue | Second Brain, Decision Room and Team queue pages | Tested (Decision Room is a local simulation) |
| 5 | Show owner, current task, next task, blocker and review evidence | Daily queue, Team queue | Tested |
| 6 | Goals from quarter to month, week and day (Q4-268) | Goal planner | Tested |
| 7 | Skill catalogue with purpose, source, licence, permissions, data sent, cost and review state | Skills page, `docs/WORKOS-ACCEPTANCE.md` source inventory | Tested for the four local pins. The 137-skill library is not client-certified. |
| 8 | Prompt to skill match, permission check, handoff, run, verified result, dashboard | Daily queue, Skill usage | Tested |
| 9 | Routing evaluation, baseline comparison, abstention on ambiguous, unsupported or unsafe requests | `node scripts/workos-routing-contract.mjs <set>`, `tests/workos-routing-gate.test.ts` | Tested with zero wrong picks. Human-written client requests open. |
| 10 | Version update and rollback, retries, duplicates, cancellations, interrupted runs | `tests/workos*.test.ts`, browser rehearsal | Tested |
| 11 | Usage dashboard with periods, outcomes, failures and drill-through | Skill usage page | Tested |
| 12 | Two clients cannot see each other's data | Browser rehearsal, `tests/workos-identity.test.ts` | Tested |
| 13 | Backup and restore | `npm run workos -- backup` and `restore` | Tested |
| 14 | Accessibility | axe-core WCAG 2.2 AA scan in the browser rehearsal | Tested (automated). Manual screen-reader check open. |
| 15 | Security review before connecting accounts | `docs/WORKOS-ACCEPTANCE.md`, security section | Prepared. Independent sign-off open. |
| 16 | Support owner and Q4-262 catalogue entry | `docs/CATALOGUE-ENTRY.md` | Prepared. Support owner not named. |

## Known gaps

- Not yet run on the intended Mac Mini.
- No live connections: Linear is synthetic, and Stripe, email, calendar and AI providers are off.
- Multi-provider orchestration belongs to Q4-260 and is not in this kit.
- Routing understands short everyday requests about the active task. Percentage requests and unfamiliar wording can still be declined. A declined request never runs anything, and the operator can choose a skill directly.
- One client per installation. Not suitable for shared hosting.

## Sign-off

| Role | Name | Decision | Date | Revision |
| --- | --- | --- | --- | --- |
| Requirements review (Nancy) | | | | |
| Security review | | | | |
| Owner acceptance (Sam) | | | | |
