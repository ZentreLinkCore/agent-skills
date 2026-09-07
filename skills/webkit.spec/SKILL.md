---
name: webkit-spec
description: >
  Produces an implementation-ready specification document BEFORE any code is written — purpose, data,
  backend, frontend, acceptance criteria, non-functional/failure modes, edge cases, and build order —
  with the load-bearing design decisions laid out as options WITH PROS AND CONS so the user chooses first.
  Allocates the next ticket folder in the project (`.agents/specs/<project>/T#####/`) and writes the spec to `specs.md` inside it;
  never touches application code. The spec it writes is the source of
  truth later consumed by `/webkit.frontend-implement` and `/webkit.backend-implement`.
  Triggered by `/webkit.spec <target_path> <prompt>`, `/webkit.spec <prompt>`, or `/webkit.spec T##### <prompt>`
  to work on an existing ticket.
---

# Webkit Spec

This skill is the **Specification Phase** of the AI development workflow. It turns a feature request into a single, cohesive **spec document** that defines exactly what should be built — grounded in the real backend (models, tables, routes) — and presents the load-bearing design decisions as options **with pros and cons** so the user can decide before a single line of implementation code is written.

> [!IMPORTANT]
> **This skill MUST NOT modify application files.** It does not write controllers, migrations, routes, components, or composables. Its only file output is `specs.md` inside its ticket folder under `.agents/specs/`. Implementation is done later by `/webkit.frontend-implement` and `/webkit.backend-implement`.

---

## Workflow Integration

```
          User Request
               │
               ▼
         webkit.spec
               │
               ▼
   Ticket folder allocated
   .agents/specs/<project>/T#####/
    └── specs.md   (see Phase 6)
               │
               ▼
         User reviews &
      picks the design options
               │
      ┌────────┴─────────┐
      ▼                  ▼
webkit.frontend-    webkit.backend-
  implement            implement
```

The spec is a **file on disk**, not just chat output. `/webkit.frontend-implement` and `/webkit.backend-implement` are commonly invoked in a **new session** with no memory of this conversation — they can only follow the spec if it was actually persisted (see Phase 6).

The ticket folder this skill creates is also where `/webkit.verify` later writes `verify.md` and `/webkit.code-review` writes `code-review.md`, so one feature's spec and both of its reports stay in one place. The numbering and reuse rules are canonical in [ticket-numbering.md](../../rules/ticket-numbering.md).

---

## Phase 1 — Understand What Needs a Spec

Determine and document:
1. **What is the feature/module?** One-sentence definition of the thing to be built.
2. **Why does it need to exist?** The business/HRMS problem it solves.
3. **Kind of work**: Greenfield (new module) or Extension (adding to an existing module).
4. **Scope Identification**:
   - **Portal**: `employee` / `manager` / `hr` / `timekeeping` / `payroll` / `admin` / `global` (see [project-profile.md](../../rules/project-profile.md) portal table — mind the `tk` namespace vs `timekeeping` URL gotcha).
   - **Route(s)**: the URL path + route name (e.g. `admin/payroll-settings`, `admin_payroll_settings`).
   - **Layers touched**: DB, backend (Query/Handler/Action), frontend (pages/components/composables/api).

> [!WARNING]
> If the request is ambiguous — unclear portal, unclear entity, or a business rule that could go multiple ways — stop and ask the user before writing the spec. Do not invent business rules; ask.

---

## Phase 2 — System Awareness Scan (Mandatory, Read-Only)

**First, resolve the project.** Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile and state the answer, then read only that project's sections. A spec written against the wrong project's conventions is the most expensive kind of error this workflow can make: it is not caught by a failing build, it is handed to the implement skills as the source of truth, and everything downstream is built correctly to a wrong blueprint. The two projects differ on framework, module layout, design system, route grouping, and — most dangerously — **opposite database conventions** (foreign keys, relationship-column naming, soft deletes).

Then run the scan so the spec is grounded in the real system, not guesses:

1. **Models** — list `app/Models/`, read `$table`, `$fillable`, `$casts`, relationships for entities the feature touches. These are the authoritative field names.
2. **Migrations** — resolve ambiguous columns against `database/migrations/` (and its subfolders).
3. **Routes** — grep `routes/api/<portal>.php` for any endpoint already covering the feature.
4. **Controllers / Query-Handler-Action** — check `app/Http/Controllers/<portal>/` and `app/Queries/`, `app/Handlers/`, `app/Actions/`.

**Decision rule (reuse vs. create):** if an existing model/table/route/controller covers the same domain entity, the spec must say *reuse/extend it* — never spec a parallel table or duplicate endpoint. Only spec a new table/model/route when the scan turns up nothing, or the user explicitly asked for a separate one. If genuinely ambiguous, ask.

State internally (and reflect in the spec's metadata):
- **Model(s) reused / created**
- **Table(s) reused / created**
- **Route(s) reused / created**
- **New migration needed**: yes/no + why

---

## Phase 3 — Define the Feature

Work out the substance of the spec:
- **Purpose** — what it does and the business problem it solves.
- **Data** — the table(s) and columns involved (reused columns from the scan, or proposed new columns with types/nullability/defaults/indexes). Mirror real `$fillable` names — never invent column names.
- **Backend** — the Query/Handler/Action classes and controller methods needed, and the exact route registration (in the matching `routes/api/<portal>.php`, per [project-profile.md](../../rules/project-profile.md)). Follow the thin-controller + Query/Handler pattern and the raw `response()->json(...)` shape — no API Resources.
- **Frontend** — module folder layout (TS structure: `index.ts` + `api/ composables/ pages/ components/ route/ types/`), the page/components, filters, pagination, and the API contract (endpoints + payload shapes). Follow [ui-design.md](../../rules/ui-design.md) and [vue-standards.md](../../rules/vue-standards.md).
- **Business rules** — any HRMS domain rules ([hrms-rules.md](../../rules/hrms-rules.md)): payroll math, grace periods, leave accrual, portal separation, etc.
- **Edge cases** — boundary conditions, permission checks, cache busting, double-processing guards.

### Non-Functional & Failure-Mode Checklist (Mandatory)

Happy-path definition is not enough — most defects live in the categories below. Every category **must** be answered explicitly in the spec. Skipping one is not allowed: if a category truly does not apply, write **`N/A because <reason>`** — an empty cell, a dash, or a silent omission is a failed checklist.

| Category | Must state |
|---|---|
| **Authorization** | Per portal/role: exactly who can hit this endpoint / see this UI, and who must be rejected. Name the roles and the portal boundary ([hrms-rules.md](../../rules/hrms-rules.md) portal separation). Include the rejection behaviour (status + shape). |
| **Concurrency / double-submit** | What happens on two simultaneous requests, a double-clicked button, or overlapping processing runs. Name the guard (DB unique constraint, lock, status transition check, disabled-while-pending UI). |
| **Idempotency on retries** | If the same request is replayed (network retry, queue re-delivery, re-run of a cycle), does it duplicate rows/amounts? State the key or condition that makes it safe. |
| **Error response shape & status codes** | The exact non-happy-path contract: status code + `response()->json(...)` body for validation failure, unauthorized, not-found, and conflict — not just the 200 shape. |
| **Input validation boundaries** | Per input: null, empty string, oversized/too-long, wrong type, out-of-range numbers, malformed dates. State the expected rejection for each. |

Each answer here should produce at least one row in the Phase 3.5 acceptance-criteria table.

---

## Phase 3.5 — Acceptance Criteria

Convert everything defined in Phase 3 into **concrete, testable assertions**. This is not a restatement of the business rules in prose — it is the checkable contract.

Produce a table in exactly this format:

| # | Given | When | Then |
|---|-------|------|------|

Rules for the table:
- **Mechanically verifiable** — every row states exact inputs and the exact expected result: literal field values, HTTP status codes, response body keys, error messages, computed amounts. "Then: the request fails gracefully" is a bad row; "Then: `422` with `{"message": "Cut-off date must fall within the payroll period"}`" is a good one.
- **Coverage floor** — at least one row per business rule and one row per edge case identified in Phase 3, plus at least one row per category in the Non-Functional & Failure-Mode Checklist.
- **Self-contained** — a reader must be able to check the row against a running system **without re-reading the implementation code**. No "as implemented in the handler", no "per the existing logic"; spell out the expected value.
- **Stable IDs** — number rows `AC-1`, `AC-2`, … in the `#` column so later skills and review findings can cite them.

> [!IMPORTANT]
> This table is the **primary input for the later adversarial-verification skill**. Ambiguous or unverifiable rows make that verification worthless, so every row must be unambiguous and checkable on its own terms.

---

## Phase 4 — Design Decisions with Pros & Cons (the core of this skill)

This is the **primary responsibility** of the skill. For every load-bearing design choice the feature raises, present it as an explicit decision with options and a **pros/cons** table so the user can choose.

Typical decision points to surface:
- Data model shape (new table vs. extend existing; single-table vs. normalized).
- Processing approach (separate cycle/step vs. merged/automatic; sync vs. queued).
- Where a computation lives (inline handler vs. dedicated Action; frontend vs. backend).
- UI approach (dedicated page vs. modal vs. inline tab; toggle vs. radio vs. select).
- Config/behavior toggles (hard-coded default vs. admin-configurable setting).

For **each** decision use this format:

```markdown
### Decision: <name of the choice>

**Option A — <label> (Recommended)**
- <how it works, briefly>

| Pros | Cons |
|---|---|
| ... | ... |
| ... | ... |

**Option B — <label>**
- <how it works, briefly>

| Pros | Cons |
|---|---|
| ... | ... |
| ... | ... |

**Recommendation:** <which option and the one-line reason — architecture fit, simplicity, compliance, performance>.
```

Always mark the recommended option and give a short rationale. When a decision is genuinely the user's call (business policy, not a technical default), say so explicitly rather than picking for them.

---

## Phase 5 — Build Order & Out of Scope

- **Build Order** — a dependency-first numbered checklist (migration → model/helper → controller/routes → frontend Gate 1 static design → frontend Gate 2 live wiring → handler logic). This mirrors the design-first flow that `/webkit.frontend-implement` (Gate 1) and `/webkit.backend-implement` (Gate 2) follow.
- **Out of Scope / Future Specs** — list adjacent things deliberately excluded, so the boundary is explicit and future specs are seeded.

---

## Phase 6 — Spec Document Structure

Compile everything into a single markdown file using this standard format (modeled on the existing specs in the repo):

```markdown
# Spec — <Feature Name>

> **Ticket:** `T#####` (<project>) — this file is `.agents/specs/<project>/T#####/specs.md`; branch `T#####`.
> **Kind:** Greenfield | Extension — <one-line note>.
> **Portal:** **<Portal>** (`/api/<prefix>/...` routes, `<module>` frontend module).
> **Version:** v<N> — <YYYY-MM-DD> — <one-line summary of what changed from the previous version, or "initial" for v1>.
> **Route:** `<url-path>` (`<route_name>`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models <reused/created>; Tables <reused/created>; Routes <reused/created>; New migration: <yes/no>.

---

## 1. Purpose
<what it does and the business problem it solves>

## 2. Design Decisions (Pros & Cons)
<one "### Decision:" block per choice, each with option pros/cons tables and a recommendation — see Phase 4>

## 2.5 Acceptance Criteria
<the Given/When/Then table from Phase 3.5 — one row per business rule, edge case, and non-functional category; rows numbered AC-1, AC-2, …>

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | ... | ... | ... |

## 3. Database
<table(s) + columns; mark reused vs new; seed rows if any>

## 4. Backend
<models, Query/Handler/Action classes, controller methods, exact route registration>

## 5. Frontend
<module folder layout, page/components, filters, pagination, API contract, layout sketch>

## 6. Business Rules & Edge Cases
<HRMS domain rules + a table of edge cases and their handling, followed by the Non-Functional & Failure-Mode Checklist — every category answered or marked "N/A because ...">

## 7. Build Order
1. ...
2. ...

## 8. Out of Scope (Future Specs)
- ...

## 9. Definition of Done
- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-<n>)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] No open findings from adversarial verification — see `verify.md` beside this file
- [ ] No open `CRITICAL`/`HIGH` findings from diff review — see `code-review.md` beside this file
```

### Persist the Spec (MANDATORY)

Displaying the spec in chat is not enough — the implement skills run in separate sessions.

The spec goes into a **ticket folder** as `specs.md`. The convention is canonical in [ticket-numbering.md](../../rules/ticket-numbering.md); the steps below are the whole procedure this skill needs.

**Step 1 — Resolve the project.** Ticket numbers are **per project**, so the counter you increment depends on which one you are in. You already resolved this in Phase 2 ([project-profile.md](../../rules/project-profile.md) "Which Project Am I In?") — restate it now as a lower-case folder name (`ScaleUP` → `scaleup`, `SubHRMS` → `subhrms`) and use it in every path below. Allocating into the wrong project's folder takes a number off the wrong counter and collides with real work there.

**Step 2 — Reuse or allocate the ticket (in this order).**

1. **The user named a ticket** (`/webkit.spec T00007 ...`, or a path inside `T00007/`) → use `.agents/specs/<project>/T00007/`. Create it only if genuinely absent, and say so.
2. **A ticket already covers this feature** → use it and update in place. Check before allocating — this one command covers the project's ticket folders *and* its legacy portal folders:

   ```bash
   grep -ril '<feature name or route>' ".agents/specs/$project" --include='*.md' 2>/dev/null
   ```

   If the hit is a **legacy** spec (`.agents/specs/<project>/<portal>/<feature>.md`), say so and ask whether to keep editing it in place or migrate it into a new ticket folder. Never silently duplicate a spec that already exists ([duplicate-prevention.md](../../rules/duplicate-prevention.md), [incremental-generation.md](../../rules/incremental-generation.md)).
3. **Nothing matches** → allocate the next number **within that project**. Scan the disk; never guess from memory or chat history:

   ```bash
   project=subhrms   # or scaleup — resolved in Step 1, never assumed

   max=$(find ".agents/specs/$project" -maxdepth 1 -type d -name 'T[0-9][0-9][0-9][0-9][0-9]' 2>/dev/null \
         | sed 's#.*/T##' | sort -n | tail -1)
   next=$(printf 'T%05d' $(( ${max:-0} + 1 )))
   mkdir -p ".agents/specs/$project/$next"   # claim it before writing anything
   echo "$project/$next"
   ```

   Format is `T` + five zero-padded digits, no hyphen (`T00001`, `T00002`, …). It is always **`max + 1`, never the first free gap** — a deleted `T00002` stays a gap, because reusing a retired number silently re-points every older reference, branch, and PR to different work. `-maxdepth 1` inside the project folder is what keeps the two projects' counters separate.

**Step 3 — Write the spec.**

- Write the full spec to `.agents/specs/<project>/<ticket>/specs.md` — that exact filename, no dates, no feature name, no portal prefix.
- Fill the `> **Ticket:**` line in the header with the allocated number **and** the project, since the same number exists in both.
- Ticket folders sit **one level inside the project folder**, as siblings of its legacy portal folders — never at the top of `.agents/specs/`, and never inside a portal folder. Portal is recorded in the `> **Portal:**` header line, since the path no longer carries it.
- Do not create `verify.md` or `code-review.md`. Those are `/webkit.verify`'s and `/webkit.code-review`'s outputs; an empty placeholder reads as "already verified".
- **Version every in-place update.** Read the existing `> **Version:**` line first, then:
  1. Increment `v<N>` by one (`v1` → `v2`).
  2. Set the date to today.
  3. Write a one-line summary of what changed versus the previous version (e.g. "added idempotency guard + AC-7..AC-9 for retry replay").
  4. Append the superseded version's line verbatim to a `<!-- Changelog -->` list at the bottom of the file, so the version history survives.

  Never overwrite a spec while leaving the version line untouched — downstream skills use it to tell whether the spec they verified is the spec now on disk.

- **Starting version.** A brand-new spec starts at `v1 — <today> — initial`. An **existing spec with no `> **Version:**` line** (every spec written before versioning) is not left unnumbered: stamp the baseline line `v1 — <today> — baseline (pre-versioning)` into the changelog, and write the edit you are making as `v2 — <today> — <what changed>`. Never invent a version history that was not recorded.

---

## Follow-up Commands

At the end, suggest next steps, **always including the saved spec path** so the next skill loads it directly instead of relying on chat memory:

- "To build the frontend from this spec (design-first, hard-coded data): `/webkit.frontend-implement <target_path> using .agents/specs/<project>/<ticket>/specs.md`"
- "To build the backend and wire the live data: `/webkit.backend-implement <target_path> using .agents/specs/<project>/<ticket>/specs.md`"
- "To prove the result matches this spec: `/webkit.verify <ticket>` — writes `.agents/specs/<project>/<ticket>/verify.md`"
- "To review the diff for code quality: `/webkit.code-review <ticket>` — writes `.agents/specs/<project>/<ticket>/code-review.md`"

Always state the **allocated ticket number** explicitly in your closing message (e.g. "Spec saved as `T00003` → `.agents/specs/subhrms/T00003/specs.md`; implement it on branch `T00003`"), so the user can hand that one token to the next skill. The implementing skills will branch on that number ([git-workflow.md](../../rules/git-workflow.md#step-3--derive-the-branch-name)) — this skill itself creates no branch, since it writes no application code.
