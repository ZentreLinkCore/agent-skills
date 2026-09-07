---
name: webkit-migrate
description: >
  Migrates a feature FROM the repo you are in INTO a sibling target project on a different stack, and
  IMPLEMENTS it there following the TARGET's conventions. Flow is the invariant (business rules, data
  contract, API contract, state machine come out identical); the stack is the variable (framework, state
  layer, HTTP client, UI library, routing, backend architecture follow the target). Scans BOTH sides to
  avoid duplicating a model/table/route the target already has. Persists a portable contract to `.agents/migrations/`.
  Triggered by `/webkit.migrate <source_path> <target_path>` or `/webkit.migrate <source_path>`.
---

# Webkit Migrate

This skill moves a feature from this **HRMS (Vue 3 + Laravel Domain Query/Handler)** into a sibling project on disk — by default **`hrms_react`** (React frontend + a plain-Laravel backend) — and **actually implements it there**. The two projects live side-by-side under `DockerTemplate/src/` (`src/hrms`, `src/hrms_react`), so the target is a real, writable path, not an external handoff.

> **Governing principle — Flow is the invariant, stack is the variable.**
> Migrating is NOT porting Vue files into React files line-by-line. Extract *what the feature does and the contract it obeys* from the source, then **rebuild that behavior using the TARGET project's own idioms**. If the migrated feature computes the same numbers, moves through the same states, and exposes the same API contract — the migration succeeded, even though the code looks nothing like the source.

> **Two-path invocation.**
> ```
> /webkit.migrate <source_path> <target_path>
> ```
> - `<source_path>` — the feature in **the repo you are invoked from** (resolve it in Phase 0 — do not assume `hrms`), e.g. `resources/views/web/src/module/payroll/reports/.../payslip` or a backend `app/Queries/<Domain>` / `app/Handlers/<Domain>` folder. This is **asa kuhaon** (what to migrate).
> - `<target_path>` — where it lands in the **target** project, e.g. `../hrms_react/resources/views/pages/payroll/payslip`. This is **asa e-migrate** (destination).
> - If `<target_path>` is omitted, infer the matching destination in the default target (`hrms_react`) from the source's portal/feature and confirm with the user before writing.

> **Write-scope note.** Every other skill here is confined to this repo and forbids cross-boundary writes. This skill is the deliberate exception: its whole purpose is to **write into the sibling target project**. It still never edits the source feature (read-only on `hrms`), and inside the target it follows the **target's** rules, not `hrms`'s.

---

## What "the setup is different but the flow is the same" means

Every part of a feature goes in one of two buckets. This split is the heart of the skill.

| MUST come out identical (the flow / contract) | EXPECTED to differ (follow the TARGET's stack) |
|---|---|
| Business rules & calculations (payroll formulas, OT/late/ND rates, leave accrual) | Backend architecture (source Domain Query/Handler → target's plain controllers) |
| Data contract — field names, types, units, nullability, enum/status values | ORM usage & migrations (recreated in the target's DB, matching its migration style) |
| API contract — endpoint path, method, params, request/response JSON, status codes | HTTP client (source axios instance → target `resources/app/axios.js`) |
| State machine — statuses and the trigger of each transition | Frontend framework (Vue `<script setup>` → React `.jsx` components) |
| Validation rules & error messages | State layer (composables/Pinia → React Context / hooks per target) |
| Authorization / portal-separation rules ([hrms-rules](../../rules/hrms-rules.md) §4) | Routing (auto-glob → target's central `router.jsx` registration) |
| UI *behavior* — filters, pagination mode, debounce, empty/loading/error states, status→badge map | UI *library* & styling (Tailwind → MUI/PrimeReact/Bootstrap per target) |
| Money/date/number formatting semantics (rounding, currency, factor-rate days) | Utility/helper locations, file naming, import aliases |

Extract the left column precisely; realize the right column in the **target's** idioms.

---

## Target Profile — `hrms_react` (verified 2024-era sibling; re-confirm on run)

The default target. **These are the target's conventions — match them; do NOT import this HRMS's Vue/Domain patterns into it.** Re-verify against the target repo on each run (it may have drifted) and update this table if so.

| Aspect | `hrms_react` reality |
|---|---|
| Frontend framework | **React 18**, `.jsx` (function components) |
| UI libraries | **MUI (`@mui/material`)**, **PrimeReact**, React-Bootstrap, `@mdi/font` icons |
| Pages location | `resources/views/pages/<portal>/<feature>/` (portals: `admin`, `emp`, `manager`, `hr`, `tk`, `payroll`) |
| Shared components | `resources/views/components/` |
| Routing | **Central** `resources/app/router.jsx` via `createBrowserRouter`; routes registered **manually** (no auto-glob) — add the route object there |
| State | **React Context** (`resources/views/context/ContextProvider.jsx`, `useStateContext`); local state via hooks. No Pinia/composables |
| HTTP client | **`resources/app/axios.js`** (single axios instance; import it — don't create a new one) |
| Path alias | `@/` → `resources/` (e.g. `@/views/pages/...`, `@/app/axios`) |
| Backend | **Plain Laravel** — controllers in `app/Http/Controllers/<portal>/`, logic mostly **inline in controllers** (NO Domain Query/Handler, NO Services/Repositories) |
| Routes | **Single `routes/api.php`** (NOT per-portal files) |
| Portal roles | numbered 1–7 (`admin=1, emp=2, manager=3, hr=4, tk=5, payroll=6`) — mind the source→target portal-name mapping (`employee`→`emp`, `timekeeping`→`tk`) |

> If the user points `<target_path>` at a project other than `hrms_react`, run the Architecture Discovery step against that project and build this profile fresh from what you find there.

---

## Workflow Integration

```
Source feature (hrms: Vue + Laravel Domain Q/H)  +  spec (.agents/specs/…, if any)
              │  read-only  (System Awareness scan on SOURCE)
              ▼
   Portable migration contract  ──►  .agents/migrations/<portal>-<feature>-<YYYYMMDD>.md   (intermediate blueprint)
              │
              ▼  translate via Target Profile  +  System Awareness scan on TARGET
              ▼
   IMPLEMENT into target (hrms_react): backend (controllers/models/routes) + frontend (React pages/components/hooks/routes/api)
              │
              ▼
   Verify parity against the contract  (same numbers, states, endpoints)
```

---

## Phase 0 — Resolve Which Repo Is Which (BLOCKING)

> [!CAUTION]
> **Do not assume the source is `hrms`.** This skill lives in more than one repo under `src/`, and each copy drifts independently. "This repo" is whichever one you were invoked from — which may be **ScaleUP** (React 19 + `app/Queries`/`app/Handlers`), **hrms** (Vue 3 + the same Query/Handler pattern), or another sibling. Migrating *out of* the wrong assumed source means extracting a contract from files that don't exist.

1. **Identify the source repo** — the one you are running in. Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution and state the answer.
2. **Identify the target repo** — from `<target_path>`, or ask. Confirm it exists on disk before writing anything.
3. **State both explicitly** — *"migrating FROM `<source repo>` INTO `<target repo>`"* — and get the user's confirmation before Phase 4 writes a single file. The write-scope exception this skill carries makes a wrong target expensive.

> The sibling repos each carry their **own `.agents/` copy** (rules and skills), and they are separate directories, not symlinks. The target's conventions come from the **target's** profile where it has one — never from this repo's.

---

## Phase 1 — Resolve Both Sides & Load Ground Truth

1. **Resolve the source** (in the repo resolved in Phase 0). Parse the dragged/passed `<source_path>` or the prompt → `<portal-or-domain>`/`<feature>`. Confirm the frontend folder and the backend surface (controller + `app/Queries/<Domain>/` and `app/Handlers/<Domain>/` — **not** `app/Domain/`, which is retired and absent from every repo here).
2. **Resolve the target** (in `hrms_react` or a user-named project). Parse `<target_path>`; if omitted, map the source portal/feature to the target's layout (`resources/views/pages/<portal>/<feature>/`, remembering `employee→emp`, `timekeeping→tk`) and **confirm the destination with the user before writing**.
3. **Load the spec (primary source of truth).** Look for the feature under `.agents/specs/` — ticket folders (`.agents/specs/<project>/T#####/specs.md` — grep their contents, since the folder name carries no feature name; see [ticket-numbering.md](../../rules/ticket-numbering.md)) and the legacy tree (incl. `subhrms/`); if present, read it in full — it already frames the flow, data contract, and rules. Trust the source code's runtime behavior where it and the spec disagree, and flag the drift.
4. **Load any investigation report** — the ticket folder's `investigation.md`, or `.agents/reports/` for pre-ticket ones — matching the feature, for edge cases/gotchas worth carrying over.
5. **System Awareness scan — SOURCE (mandatory, read-only).** Per [System Awareness](../../rules/system-awareness.md): read the relevant `hrms` `app/Models/` (`$table`, `$fillable`, `$casts`, relations), resolve fields against `database/migrations/`, confirm registered endpoints (`routes/api/<portal>.php` — mind `timekeeping` prefix vs `tk` namespace). **The exported contract must be grounded here — never invent a column, endpoint, or status** ([Anti-Hallucination](../../rules/anti-hallucination.md)).
6. **System Awareness scan — TARGET (mandatory).** In the target project, scan its `app/Models/`, `database/migrations/`, and `routes/api.php` to learn (a) its architecture and (b) **whether a model/table/route already covers this feature**. If the target already has the entity, **reuse/extend it — do not create a parallel table/route** ([Duplicate Prevention](../../rules/duplicate-prevention.md)). The target has its own database; a table existing in `hrms` does NOT mean it exists in `hrms_react`.
7. **Map the dependency graph.** List every table, sibling module, shared util, domain rule, cron/scheduled job, and cross-portal touchpoint the feature needs. Anything the target lacks is part of the migration scope — surface it.

End of Phase 1, state internally: source files, target destination, models/tables (source + which exist in target), routes (source + target), dependencies, spec present?

---

## Phase 2 — Extract the Portable Contract → write the blueprint

Produce a stack-neutral description of the feature and **save it to `.agents/migrations/<portal>-<feature>-<YYYYMMDD>.md`** (create the folder if needed; use `currentDate` from context — don't guess). Write in terms of behavior and data, never Vue/Laravel syntax. Capture, in order:

1. **Purpose & portal ownership** — one paragraph; portal-separation rules ([hrms-rules](../../rules/hrms-rules.md) §4) carry over verbatim.
2. **Flow / lifecycle** — the numbered steps a user/record moves through. Where there's a **state machine** (e.g. `Filed → Approved → For Clearance → Cleared → Endorsed → Completed`), list every status and **what triggers each transition** (user action, cron, another portal). This is the single most important thing to preserve.
3. **Data contract** — a table per entity: real field name (from `$fillable`/migration), type, unit/format, nullable?, source/derivation. Enum/status values verbatim. Separate persisted columns from computed fields.
4. **API contract** — a row per endpoint: method, URL path (real prefix), request params/body, success response JSON, error shape (`{message}` + status), auth. The target reproduces these exactly even though its backend is built differently.
5. **Business rules & calculations** — every formula, rate, threshold, rounding rule, with its domain source ([hrms-rules](../../rules/hrms-rules.md): grace period, OT/ND/holiday rates, daily-rate factor 261/313, BIR/SSS/PhilHealth/Pag-IBIG order). Reproduce identically; flag compliance-sensitive ones.
6. **Validation & authorization** — required fields, constraints, messages, portal guards; which writes are transactional (integrity requirement).
7. **UI behavior (not implementation)** — pages & responsibilities; filters (+ debounce), pagination mode (client/server), sort, search; empty/loading/error states; status→badge/color map; modals/drill-downs and their contents.
8. **Dependencies & preconditions** — tables, other modules, cron, shared utils the target must also provide.

Include a **Source Reference** appendix (source file paths, models/tables, routes) for lookup — labeled "do NOT copy syntax."

---

## Phase 3 — Translation Map (source pattern → target pattern)

Using the Target Profile (+ the target scan), lay out how each source layer becomes a target layer. Trim to the layers this feature actually uses.

### Frontend: Vue 3 `<script setup>` → React (`hrms_react`)

| Source (Vue) | Target (React) | Note |
|---|---|---|
| `composables/use<Feature>.ts` (`ref`/`reactive`) | custom hook `use<Feature>()` (`useState`/`useReducer`) in the feature folder | State + actions map 1:1; a state machine is often cleaner as `useReducer`. |
| `api/<feature>.api.ts` (`http` from `@/app/axios/axiosInstance`) | service module importing the target's `@/app/axios` | Keep the **same endpoint strings, params, and response handling**. Do NOT create a new axios instance. |
| Pinia `store/` | React Context provider (or lift state) — only if shared across pages | Same trigger as source. |
| `route/<feature>.routes.ts` auto-globbed | route object added **manually** to `resources/app/router.jsx` | Target has no auto-glob — register explicitly under the right portal branch + `ProtectedRoute`. |
| Source design-system components — *SubHRMS globals are `CSelect`, `Pagination`, `StatusBadge`, `EmptyState`, `TableSkeleton`, `Spinner`, `VDatePicker`; **ScaleUP's are entirely different** (`Button`, `Select`, `Badge`, `Modal`, `Table`, … under `components/ui/`). Read the **source's** profile for the real list* | MUI/PrimeReact equivalents (`Select`, `DataTable`/`TablePagination`, `Chip`, PrimeReact `Dropdown`, etc.) | Inventory the components the source feature actually imports → pick the target's equivalent; preserve behavior. Never assume the source's component vocabulary — a name from the wrong project matches nothing. |
| Tailwind classes + portal accent + `dark:` | MUI `sx`/theme or Bootstrap classes per target | UI *behavior* is the contract; exact styling is the target's. |
| `debounce` (300ms), `onUnmounted` cleanup | debounce util + `useEffect` cleanup return | Preserve interval + cleanup semantics ([performance](../../rules/performance.md)). |
| `formatCurrency`/`dateFormatter` (`@/src/utils`) | target's formatting utils (create if absent) | Preserve rounding/format *semantics*. |

### Backend: Laravel Domain Query/Handler → target plain-Laravel

| Source (`hrms`) | Target (`hrms_react`) | Note |
|---|---|---|
| Thin controller → `Get<X>Query::execute()` / `<X>Handler::execute()` (in `app/Queries/` / `app/Handlers/`) | controller method with the logic **inline** (target's style) or a small private method | Same computation & output shape; drop the Query/Handler layer to match the target. |
| `DB::transaction(...)` on writes | `DB::transaction(...)` in the target too | Transactionality is a data-integrity requirement, not a source detail — keep it. |
| Eloquent model (source) | target Eloquent model — **reuse if the target already has it**, else create matching the target's model style | Fields from the Phase-2 data contract. |
| Migration (source) | new migration in the target **only if the target lacks the table** (confirmed in Phase 1 target scan) | Match the target's migration conventions; never duplicate an existing target table. |
| No API Resources (raw JSON) | raw JSON shaped to the **same contract** | Target likely also returns arrays/`response()->json`; match its shape to Phase 2. |
| Route in `routes/api/<portal>.php` | route in the target's **single `routes/api.php`**, under the matching portal/middleware group | Preserve URL path + method + auth guard. |
| Scheduled command (`Schedule::command()->daily()`) | target's `routes/console.php` schedule | Carry over time-based transitions (e.g. effective-date flips). |

Explicitly note the source-side gotchas that affect extraction (`timekeeping` prefix ≠ `tk` namespace) and the target-side portal renames (`employee→emp`, `timekeeping→tk`).

---

## Phase 4 — Implement into the Target

Build the feature in the target project from the contract, matching the Target Profile. Suggested order (adjust to the feature):

1. **Backend first (data + contract).**
   - Reuse the target model/table if the Phase-1 target scan found one; otherwise scaffold a migration + model in the target's style (indexes, FKs, timestamps, soft-deletes as appropriate). **Do not create a parallel table.** Do NOT run migrations — scaffold and tell the user to run them in the target.
   - Add controller method(s) to `app/Http/Controllers/<portal>/` implementing the business rules **inline** (target style), inside `DB::transaction` for writes, returning JSON that matches the API contract exactly.
   - Register the route(s) in the target's single `routes/api.php` under the correct portal/middleware group.
2. **Frontend (behavior parity).**
   - Create the feature under `resources/views/pages/<portal>/<feature>/`: a React page component (`.jsx`), sub-components, and a `use<Feature>` hook holding state + actions.
   - Add an API service module that imports the target's `@/app/axios` and calls the **same endpoints** from the contract.
   - Register the route **manually** in `resources/app/router.jsx` under the right portal branch, wrapped in `ProtectedRoute`.
   - Realize the UI behavior (filters + debounce, pagination mode, empty/loading/error states, status→badge map) using MUI/PrimeReact — preserve behavior, not the Tailwind markup.
3. **Preserve the invariants.** Field names, endpoint paths, status values, formulas, and transitions must equal the contract. The look/library/layout is the target's to own.
4. **Duplicate prevention in the target.** Before adding any component/util/model/route, check the target for an existing one and reuse/extend it ([Duplicate Prevention](../../rules/duplicate-prevention.md)).

---

## Phase 5 — Verify Parity & Hand Off

1. **Static checks in the target.** `php -l` on new PHP; build/lint the React files (the target's `npm run build`/lint if available). Fix what the edits introduced.
2. **Contract parity self-check.** Every migrated field traces to the data contract; every endpoint returns the contract's JSON + status; every status value matches; every formula matches §5 of the blueprint. No invented artifacts ([Anti-Hallucination](../../rules/anti-hallucination.md)).
3. **Round-trip question.** "Given only the blueprint, would this target implementation behave identically to the source?" If any rule/transition/shape is implicit, make it explicit — in code and in the blueprint.
4. **Report to the user:** the blueprint path (`.agents/migrations/…`), the files created/edited **in the target**, migrations the user must run in the target, dependencies the target still lacks, and the manual `router.jsx`/`api.php` registrations made. Do not run target migrations or commit — that's the user's call ([Git Workflow](../../rules/git-workflow.md)). Note that the two projects are separate git repos, so commits/branches are per-project.

---

## Guardrails

- **Read-only on the source, write into the target.** Never edit the `hrms` source feature. All implementation writes go into the target project; the only write in `hrms` is the blueprint under `.agents/migrations/`.
- **Follow the TARGET's conventions inside the target.** React + MUI/PrimeReact + Context + central router + plain-Laravel controllers + single `api.php`. Never impose this repo's Vue/Domain-Query-Handler patterns on the target.
- **Ground everything on both sides.** Source contract from the source scan/spec; target reuse/creation decisions from the target scan. If a field, route, or status can't be verified, stop and ask ([Anti-Hallucination](../../rules/anti-hallucination.md) §5).
- **No duplicate tables/routes in the target.** The target has its own DB and routes — reuse what exists; create only what the target genuinely lacks.
- **Preserve behavior, not syntax.** The deliverable is a working feature in the target that obeys the same contract — not a line-by-line transliteration.
- **Carry compliance rules intact.** Payroll/tax/leave formulas and portal-separation guards are correctness-critical; reproduce them exactly and flag them as compliance-sensitive.
