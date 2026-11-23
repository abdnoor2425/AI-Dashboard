# Q4-262 catalogue entry: WorkOS client kit

| Field | Value |
| --- | --- |
| Kit | 1 of 20 · WorkOS client kit |
| Tickets | Q4-263 (kit), Q4-268 (goals to daily work), parent Q4-262 |
| Version | 0.2.0-review.12 |
| Repository | `abdnoor2425/workos-client-starter` (private). Public release target: AIBusinessBoomer, after review. |
| For | A business owner who wants one place for quarterly goals, daily work, approved AI skills and checked results |
| Outcome | Every task has an owner, a due date and a reviewed receipt. Goal progress comes only from verified measurements. |
| Entry point | `npm run setup -- <new-directory> <config.json>`, then `npm start -- <directory>` |
| Inputs | One JSON config per client: name, accent, port, modules, goal, metric, owners, enabled skills, tools, permissions, retention |
| Outputs | Local web app, receipts, usage dashboard, JSON export, read-only MCP queue and handoff |
| Synthetic samples | `examples/workos/alder.json`, `examples/workos/birch.json` |
| Runbook | `INSTALL.md`, `docs/WORKOS.md` |
| Failure and rollback | Config `update`/`rollback`, schema `upgrade` with backup, `backup`/`restore`, stopped-snapshot binary rollback |
| Tests | `npm test`, `tests/workos_browser.py`, routing benchmarks, calendar oracle, GitHub Actions on every push |
| Isolation | Separate directory, database, password and port per client. Two-client tests cover every advertised endpoint. |
| Requirements | macOS or Linux, Node 24 LTS, npm. No cloud account, AI provider or payment key needed. |
| Data sent | None. The launcher blocks connector setup, sync and outbound actions. |
| Licence | MIT (retained from AI-Dashboard) |
| Status | Prepared and tested on Linux with synthetic data. Not yet approved or deployed. |
| Open gates | Mac Mini rehearsal, Nancy review, security sign-off, support owner, release rights, live connector tests |
| Owner | Abdullah (implementation). Sam (setup decisions). Long-term support owner not named. |
