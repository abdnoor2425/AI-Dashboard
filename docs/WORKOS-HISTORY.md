# Historical catalogue evidence

The read-only review used private metadata from `abdnoor2425/aibb-skills-library@0d324db79241ec5bbe5cd0afee89fbfcd72781f8`. The pure adapter ran against the coverage and evaluation records in connector memory. Only aggregate numbers are included here. The repository also describes 38 discovery sources with pinned commits. Source discovery, evaluation, permission and real use each answer a different question.

| Pinned source measurement | Count |
| --- | ---: |
| Definition records | 137 |
| Declared names / distinct instruction hashes | 134 / 136 |
| Explicit byte-identical aliases / canonical definitions | 1 / 136 |
| Declared names associated with different hashes | 2 |
| Bounded evaluation keys joined by declared name and exact instruction hash | 75 |
| Separate blocked evaluation keys | 1 |
| Coverage states: bounded offline / scoped runtime / blocked or unrun | 75 / 5 / 57 |
| Full client-ready claims | 0 |

## Comparison with the November 2 inventory

An authenticated read of the earlier private revision `97e3212c390124395d968f6b8b1b4dea0ab5cc8b` found `catalog/local-inventory.json`, `catalog/skill-coverage.json` and the inventory generator. All 137 source locators, declared names and instruction hashes match the later pinned coverage. The earlier coverage reported 77 bounded synthetic passes, two scoped runtime passes and 58 blocked/unrun. The independent-evaluation file at its later path is absent at this earlier revision. WorkOS records unavailable counts as unknown. A supplied, empty evaluation collection instead yields a measured count of zero.

| Earlier evidence | Later evidence | Changed definitions |
| --- | --- | ---: |
| Bounded synthetic pass | Independently evaluated offline example | 75 |
| Bounded synthetic pass | Scoped runtime pass | 1 |
| Bounded synthetic pass | Blocked or unrun | 1 |
| Blocked or unrun | Scoped runtime pass | 2 |

The other 58 classifications stayed the same. Both snapshots reported zero full client-ready claims. The importer preserves an earlier `bounded-synthetic-pass` and accepts explicit `evaluations: null` for a coverage-only source. Changes appear in the later coverage revision's detail view. The November metadata was compared in memory and excluded from the synthetic installation files.

The reviewed authenticated GitHub and Linear references, date-bounded conversation and email searches, and Drive filename/content searches supplied no verified September inventory/usage JSON or CSV. The private Git inventory commit is dated November 2. It records definition hashes and aliases without September usage observations. The October file hashes below remain owner-reported. A separate source search checked Linear, Drive, Library, conversations and the private skills repository. Q4-263 contained descriptions, with no direct attachments, and its project returned zero resources. Q4-103’s accepted v1.2-rc1 governance runbook and Q4-62’s October 7 portable archive do not establish the contents of either missing source. Retrieval requires the original September 18 machine-readable inventory and usage files, date and observation definitions, and the original October 28 routing instructions and guide bytes with their paths for hash verification. The migration acceptance gate remains open.

## Rehearse with synthetic files

The included example snapshots contain fictional names, identifiers and counts. An operator controls the original local metadata file. Review its origin, exact pin and permission to process it before importing. The importer retains names, hashes, evidence states, hashed source locators or dated observations. It discards other definition or evaluation fields and never opens a path supplied inside a snapshot. An import cannot register or enable a skill.

```sh
npm run workos -- catalogue-import "$HOME/workos-review/alder" examples/workos/history/coverage.json
npm run workos -- catalogue-import "$HOME/workos-review/alder" examples/workos/history/usage.json
```

Open **Skill usage → Historical catalogue evidence → Imported revisions**. In the example, two observations match a unique canonical definition and one lacks an exact hash. Read requests total seven. One stated use has a known count of zero and another has an unknown count. Local invocation and verification remain unchanged.

An import requires the Skills module, `catalogue.review`, the exact installation identifier, a single-link regular JSON file up to 8 MiB, and the declared `workos.catalogue-history/v1` envelope. The first snapshot of each source uses `previous: null`. Subsequent snapshots name the current head. A revision is a 40- or 64-character lowercase hex source identifier. The operator supplies that identifier. Matching keys alone cannot authenticate an upstream author. Reimporting the same normalized content at the same revision is idempotent. A second payload at an existing revision or a stale parent is rejected. A backup includes the full history. The default listing shows the latest 30 imports and the current summary for each source. Retrieve an older known revision directly using `GET /api/workos/catalogue-history?source=coverage&revision=<exact-pin>`. To reproduce an observation join, provide `source=usage`, the exact usage `revision`, and the exact `coverageRevision` in the same GET request. The interface allows selecting a recently imported coverage revision and inspecting each canonical match or unresolved reason. A new catalogue head cannot change a comparison of two pinned revisions. The CLI is the sole import path.

For usage snapshots, each observation needs a unique source key, a calendar date, declared name, hash or null, kind (`read-request` or `stated-use`), and nonnegative safe integer count or null. Hashless, unavailable or ambiguous identities remain unresolved. Identical content alone does not collapse independent definitions. Explicit aliases require a canonical target with an identical instruction hash. A source readiness flag is displayed as a source claim. It confers no client entitlement.

## Historical evidence still missing

The accessible Linear records, source catalogue, and document-title searches did not yield the underlying September inventory and usage JSON/CSV. Q4-62 describes a separate 26-skill collection. Its records do not establish September reads or executions.

The Q4-153 owner reported applying the routing guide and global agent instruction update on October 28. The comment records SHA-256 `aee41a26f97a8de5948f599f5f2d642b1b03ad0959b018a32b58851c18df5168` for the instructions and `8480cfa979cc58d4b8aa68f5980278b569281e839a0410201028d185cc0fd4d3` for the guide. The owner reported improved reference coverage from 47/64 to 61/61, and 57/61 at the November 1 recheck. The four missing versioned pointers were for documents, spreadsheets, presentations and PDF. Direct inspection of the underlying Mac files, verification of their bytes, and independent multi-domain adoption evidence remain open. [Q4-153 owner report](https://linear.app/aibusinessboomer/issue/Q4-153/review-ai-automation-vault-for-overnight-business-improvements#comment-125b4e02-1b28-4277-bcba-7ee7000ae9ba)

Actual execution, verified outcomes and the historical signals above must be reported with their original definitions and provenance. Private source instructions, evaluations and third-party assets from the skill library are absent from this repository.
