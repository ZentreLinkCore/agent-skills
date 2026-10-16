# Implementation Plan — {{FEATURE_NAME}}

<!--
TEMPLATE: implementation-plan (written by /webkit-specify beside spec.md; executed by /webkit-implement)

Fill rules. Delete this comment and every other guide comment from the finished plan.
1. The plan is derived from spec.md in the same ticket folder. The spec says WHAT; the plan says HOW and IN WHAT
   ORDER, file by file. Never restate a requirement: cite it by ID (FR-, NFR-, AC-, EC-, D-). Where the plan and
   the spec disagree, the spec wins.
2. Never add behavior the spec does not define. A task the plan needs but the spec cannot justify is a spec gap:
   fix the spec first, then plan it.
3. Replace every {{PLACEHOLDER}}. A finished plan contains no "{{". Never leave a cell blank; write
   "N/A — <reason>". Banned words: "should", "might", "maybe", "etc.", "as needed", "appropriate", "TBD".
4. Every path exists (verified in the spec's project scan) or is marked **(new)**. Every **(new)** file has a
   §2 Reuse Map row whose decision is CREATE.
5. Task IDs (TASK-01, TASK-02, …) are stable: never renumber. Retire a task with ~~strikethrough~~ and a reason;
   append new tasks at the end of their phase with the next free number.
6. One task = one file, or one tightly coupled change across files (a route and its controller method). Each task
   names its files, the exact change, the IDs it delivers, its dependencies, and a checkable Done When.
7. Order: Preparation → Backend (migration → model → Query / Handler / Action → controller → route) → Frontend
   (api layer → state → components → pages → route registration) → Validation. The backend is complete before
   frontend integration starts.
8. Coverage: every FR in spec §6 appears in at least one task's Covers; every AC in spec §10 appears in §8
   Acceptance Walk.
9. Every task that changes backend or frontend code has a Test line naming the test file and what it asserts, per
   .agents/rules/testing.md ("Every Code Change Ships With a Test"); "None — <reason>" only for a change with no
   behavior. A frontend app with no test runner gets a Preparation task that sets one up. Done When includes the
   test passing.
10. /webkit-implement edits only two things here: a task checkbox ([ ] → [x]) once its Done When holds, and the
   Plan Status. Everything else changes through /webkit-specify and is logged in §10.
-->

## Metadata

<!-- Based on Spec Version must equal the spec's Specification Version (an older spec's `> **Version:** v<N>`
     header counts as v<N>). When they differ the plan is stale and /webkit-implement stops.
     Specification: the spec's real file name, spec.md or specs.md on older tickets.
     Plan Status: Draft | Ready | In Progress | Done. -->

| Field | Value |
| --- | --- |
| Project Name | {{PROJECT_NAME}} |
| Ticket Number | {{TICKET_NUMBER}} |
| Feature Name | {{FEATURE_NAME}} |
| Specification | `.agents/specs/{{project}}/{{TICKET_NUMBER}}/spec.md` |
| Based on Spec Version | {{VERSION}} |
| Plan Revision | {{n}} |
| Created Date | {{YYYY-MM-DD}} |
| Plan Status | {{STATUS}} |

---

## 1. Technical Context

<!-- The facts /webkit-implement needs before touching a file, taken from the project profile and the closest
     sibling feature. One value per row. -->

| Aspect | Value |
| --- | --- |
| Project | {{resolved project and how it was resolved}} |
| Backend | {{framework + version, folders used: app/Queries/<Domain>/, app/Handlers/<Domain>/, …}} |
| Frontend | {{framework + version, module folder, file extension}} |
| HTTP client | `{{import path}}` — {{returns AxiosResponse / already unwrapped}} |
| State | {{composables / hooks + context / store, and the file that owns this feature's state}} |
| Database conventions | {{FK style; relationship column style; soft-delete style}} |
| Design system | `{{components directory / barrel}}` |
| Reference implementation | `{{path to the closest sibling feature to copy the shape of}}` |
| Checks | `{{lint / typecheck commands}}` · build: `node .agents/scripts/check-changed.mjs` (changed files only; never the full `npm run build`, per testing.md) |
| Tests | `{{backend: unit and feature test commands, and how feature tests get a disposable database}}` · `{{frontend: test command, or "no runner — set up in TASK-01"}}` |

---

## 2. Reuse Map

<!-- The reuse decisions made during the spec's project scan. /webkit-implement starts its Reuse Ledger from this
     table and re-confirms each row against the current code before creating anything. -->

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `{{what will be built or changed}}` | `{{path / grep, including generic-name variants}}` | `{{file, or NONE}}` | {{REUSE / EXTEND / CREATE — <why nothing fit>}} |

---

## 3. File Change Map

<!-- Every file the implementation touches, in the order the tasks touch it. Action: Create | Modify. A file the
     spec does not need is not in this table. -->

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `{{path}}` | {{Create / Modify}} | {{TASK-01}} | {{FR-01}} |

---

## 4. Phase 1 — Preparation

- **Goal:** {{goal}}
- **Exit check:** {{command or verifiable state that proves the phase is done}}

- [ ] **TASK-01 — {{title}}**
  - **Files:** `{{path}}` ({{Create / Modify}})
  - **Change:** {{exact change: config keys, types, permissions, columns}}
  - **Test:** {{test that proves it, or "None — <reason>"; a runner setup task proves itself by its first test}}
  - **Covers:** {{FR-xx / NFR-xx}}
  - **Depends on:** {{TASK-xx, or "None"}}
  - **Done when:** {{checkable result}}

---

## 5. Phase 2 — Backend

- **Goal:** {{goal}}
- **Exit check:** {{e.g. `php artisan route:list --path=api/...` lists the route; `php -l` passes; every task's backend test green}}

- [ ] **TASK-02 — {{title}}**
  - **Files:** `{{path}}` ({{Create / Modify}})
  - **Change:** {{exact change: class + method, columns + indexes, validation rules, response keys}}
  - **Test:** `{{tests/Unit/... or tests/Feature/...}}` — {{what it asserts}}
  - **Covers:** {{FR-xx, AC-xx}}
  - **Depends on:** {{TASK-xx}}
  - **Done when:** {{checkable result}}

---

## 6. Phase 3 — Frontend Integration

- **Goal:** {{goal}}
- **Exit check:** {{e.g. every task's frontend test green; typecheck and `check-changed.mjs` pass; the page loads and calls the endpoint}}

- [ ] **TASK-03 — {{title}}**
  - **Files:** `{{path}}` ({{Create / Modify}})
  - **Change:** {{exact change: api function, state field, component props, loading / error / empty states}}
  - **Test:** `{{path/to/file.test.ts}}` — {{what it asserts}}
  - **Covers:** {{FR-xx, AC-xx}}
  - **Depends on:** {{TASK-xx}}
  - **Done when:** {{checkable result}}

---

## 7. Phase 4 — Validation

- **Goal:** Every AC in spec §10 is exercised (§8) and the project's checks pass. The per-task tests already exist (each task's Test line); this phase adds the cross-task tests (an AC that spans several tasks) and runs everything together.
- **Exit check:** {{all test suites and check commands green; §8 walked}}

- [ ] **TASK-04 — {{title}}**
  - **Files:** `{{test path}}` ({{Create / Modify}}), or "None — manual"
  - **Change:** {{cross-task tests added, the full suites run, or the manual scenario run}}
  - **Covers:** {{AC-xx}}
  - **Depends on:** {{TASK-xx}}
  - **Done when:** {{command and its expected result}}

---

## 8. Acceptance Walk

<!-- One row per AC in spec §10. "Automated" names the test; "Manual" names the steps (spec §12 MT-xx). -->

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | {{Automated / Manual}} | {{`command --filter=...` / MT-xx}} | {{TASK-xx}} |

---

## 9. Commands for the User

<!-- Everything /webkit-implement never runs itself: migrations, seeders, package installs, env keys, native
     rebuilds. In the order they run. "N/A — <reason>" when there are none. -->

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | `{{command}}` | {{after TASK-xx}} | `{{reverse command, or "N/A — <reason>"}}` |

---

## 10. Plan Change Log

> - **Spec Minor change** that affects the plan: edit the affected tasks in place, bump **Plan Revision**, add a row. **Based on Spec Version** is unchanged.
> - **Spec Major change**: bring the plan to the new version, set **Based on Spec Version** to it, bump **Plan Revision**, add a row.
> - **Plan-only correction** (wrong path, missing task, wrong order; the spec is right): edit in place, bump **Plan Revision**, add a row.
> - A task already ticked `[x]` is never edited or unticked. A change to finished work is a new task appended to its phase.

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | {{YYYY-MM-DD}} | {{VERSION}} | Created plan | All |
