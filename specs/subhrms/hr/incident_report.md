# Spec — Incident Report (HR) — bringing the module onto system conventions

> **Kind:** Extension / rework of an existing module — `incident_reports` table, `IncidentReportController`, `GetIncidentReportQuery` and the `hr/incident_report` frontend module all exist. Nothing here creates a parallel table, model or endpoint.
> **Portal:** **HR** (`/api/hr/incident-reports...`, `resources/views/web/src/module/hr/incident_report/` frontend module). **Accent: emerald** per [ui-design](../../../rules/conditional/ui-design.md).
> **Version:** v1 — 2026-08-20 — initial.
> **Route:** `hr/incident-report` (`hr_incident_report`) — unchanged; already registered in [useSidebarLinks.ts:202](../../../../resources/views/web/src/composables/useSidebarLinks.ts#L202) under *Health & Safety*.
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md), [ui-design](../../../rules/conditional/ui-design.md), [vue-standards](../../../rules/conditional/frontend-vue.md), [duplicate-prevention](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Models **reused** `IncidentReport`, `AccountDetailVW`, `Account`, `Unit`, `TransLog`; Models **created** `IncidentReportParty`, `IncidentReportAction`. Tables **reused** `incident_reports`, `vw_accounts_details`, `units`, `translog`; Tables **created** `incident_report_parties`, `incident_report_actions`. Routes **reused** `GET /api/hr/incident-reports`; Routes **created** `show`/`update`/`assign`/`status`/`actions`; Route **removed** `POST /api/hr/incident-reports/save`. Queries **reused/extended** `App\Queries\Incident\GetIncidentReportQuery`. New migration: **yes** — 3 (one additive on `incident_reports`, two child tables) plus one data-backfill migration.

---

## 1. Purpose

Incident Report is the HR system of record for workplace incidents — safety, security, conduct, environmental, data-privacy — from the moment one is filed to the moment it is closed.

The module ships today and **looks** right (emerald HR accent, slate cards, dark mode, drag-to-scroll table, `TableSkeleton`), but the layers underneath it were built as a UI demo rather than as an HRMS module. The gap is not cosmetic; it is in **filing, data and seeding** — exactly the three the user called out. Verified deviations, each against a concrete in-repo counter-example:

| # | Deviation | Evidence | System convention it breaks |
|---|---|---|---|
| G1 | **Demo rows are inserted by the migration.** 8 fabricated incidents are `DB::table('incident_reports')->insert(...)`-ed inside `up()`. | [2026_06_20_000001_create_incident_reports_table.php](../../../../database/migrations/table/incident_report/2026_06_20_000001_create_incident_reports_table.php) | Every other domain seeds through `database/seeders/<Domain>/<X>Seeder.php` registered in `DatabaseSeeder::run()` — e.g. `Database\Seeders\DisciplinaryAction\DisciplinaryActionSeeder`. Migration-embedded demo rows reach production on `migrate`, cannot be re-run, and cannot be skipped. |
| G2 | **Employees are free text.** `reported_by`, `department`, `assignee` are `string`; `assignee` is literally `'Unassigned'`. | [IncidentReportController.php](../../../../app/Http/Controllers/hr/IncidentReportController.php) `store()` | `employee_separation.idacct` and `accountdiscipaction.idacct` key the employee by account id and resolve display names through `vw_accounts_details`. Free text cannot be filtered by department, cannot be reported on, and cannot feed a disciplinary action. |
| G3 | **No subject employee at all.** The table records who filed, never who the incident is *about*. | model `$fillable` has no subject column | An HR conduct/safety incident whose involved employee is unknown to the system is a dead end — it can never link to `accountdiscipaction` (the Employment Record *Sanctions* tab). |
| G4 | **`witnesses` and `actions` are JSON strings in `text` columns.** | migration + `IncidentReport::$casts` | Repeated child records get a child table in this codebase — `employee_clearance` (`id_separation`) is the direct precedent. A JSON string array cannot record *who* did an action or *when*. |
| G5 | **Business logic lives in the controller.** IR-number generation, actor lookup and department resolution are all inline in `store()`. | `IncidentReportController::store()` | `EmployeeSeparationController::store()` is 6 lines and delegates to `FileSeparationHandler::execute()`. Thin controllers + `Query`/`Handler`/`Action` is the repo-wide backend pattern. |
| G6 | **IR number has a race and reuses numbers.** `whereYear('created_at', $year)->count() + 1` against a `unique()` column. | `store()` | Two simultaneous filings produce the same `ir_number`; the loser hits a unique-constraint 500. A deletion makes the next filing reuse a retired number. |
| G7 | **No audit trail.** Nothing writes to `translog`. | controller has no `TransLog` import | `EmployeeSeparationController` logs every mutation via `TransLog::logAction(..., 'HR Access', ...)`. |
| G8 | **No lifecycle.** Only `index` + `store` exist. `investigating` / `resolved` / `closed` rows can only come from the seed block. | [routes/api/hr.php:137-138](../../../../routes/api/hr.php#L137-L138) | An incident that can be filed but never assigned, investigated, resolved or closed is not a workflow. |
| G9 | **Off-convention route and response shape.** `POST /incident-reports/save`; `{success, incidents, stats}` with `500` on any failure. | `routes/api/hr.php:138`, controller | Separations use `Route::apiResource` + RESTful verbs and return the payload directly with `{message}` + `400`. |
| G10 | **Filter options are hard-coded in the frontend.** `categoryOptions`, `INCIDENT_STATUSES`, `INCIDENT_SEVERITIES` live in the composable/utils. | [useIncidentReport.ts](../../../../resources/views/web/src/module/hr/incident_report/composables/useIncidentReport.ts), [incident_report.utils.ts](../../../../resources/views/web/src/module/hr/incident_report/utils/incident_report.utils.ts) | `GetSeparationsQuery::filters()` serves types, statuses, departments (from `units`) and employees (`HandleGlobal::getFilterEmployees()`) to the page. |
| G11 | **The page silently shows fabricated data.** `applyMockData()` runs on any API failure, and `submitReport()` fabricates a client-side row when the response is not `success` — a broken backend looks like a working page. `MOCK_INCIDENTS` is ~140 of the 180 lines of `utils`. | `useIncidentReport.ts`, `incident_report.utils.ts` | No other module ships mock fallbacks; `useSeparation` surfaces the failure. This is the single most misleading thing in the module. |
| G12 | **Types are stubs.** `IncidentReportItem { [key: string]: any }`; the real `Incident` type is exported from `utils/`, not `types/`. | [types.incident_report.ts](../../../../resources/views/web/src/module/hr/incident_report/types/types.incident_report.ts), [index.ts](../../../../resources/views/web/src/module/hr/incident_report/index.ts) | `types.separation.ts` defines real unions, `Paginator<T>`, form and filter-option interfaces. |
| G13 | **Stats are 5 unfiltered `COUNT(*)` queries per request.** | controller `index()` | [performance](../../../rules/conditional/performance.md) — one grouped aggregate does the same work in one round trip. |

**What this spec does *not* change:** the visual design. The emerald accent, card treatment, dark-mode classes, drag-to-scroll container and skeleton loader already conform to [ui-design](../../../rules/conditional/ui-design.md) and stay as they are. The work is data model, filing flow, seeding, contract and types — plus the new UI surfaces the lifecycle needs.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: How to reshape a table that is already migrated

**Option A — Additive migrations + one backfill migration (Recommended)**
- Three new migration files: add columns to `incident_reports`, create `incident_report_parties`, create `incident_report_actions`. A fourth migration backfills (`idacct` → `created_by`, `witnesses` JSON → parties rows, `actions` JSON → action rows) and then drops the two superseded columns.

| Pros | Cons |
|---|---|
| Safe on any environment that has already run the original migration | Four files instead of one |
| Existing rows survive with their data moved, not lost | The old migration file stays on disk carrying its demo block (see Decision 4) |
| Matches the repo's additive habit (`ShiftExtraColumnsSeeder`, `LeavesExtraColumnsSeeder` follow the same add-then-fill shape) | Column order in the final table is append-only, not logical |

**Option B — Edit the original migration and re-run from scratch**
- Rewrite `2026_06_20_000001_create_incident_reports_table.php` to the final shape; environments must `migrate:fresh`.

| Pros | Cons |
|---|---|
| One clean file, logical column order | **Destroys every real incident already filed** |
| No backfill code to write | Any environment that already migrated silently keeps the old schema — the worst failure mode |

**Option C — New table `hr_incident_reports`, leave the old one**
| Pros | Cons |
|---|---|
| Zero migration risk | Two tables for one entity — a direct [duplicate-prevention](../../../rules/conditional/system-awareness.md) violation |

**Recommendation: Option A.** It is the only option that is correct on both a fresh install and an environment where the table already exists.

---

### Decision 2: How employees attach to an incident

**Option A — `idacct` = subject, `created_by` = filer, `idacct_assignee`, plus a nullable reporter pair (Recommended)**
- `incident_reports.idacct` is repurposed to mean *the employee the incident is about* (the system meaning of `idacct` everywhere else: `accountdiscipaction.idacct`, `employee_separation.idacct`). The filing user moves to `created_by`. The investigator becomes `idacct_assignee` (nullable; `NULL` = unassigned). The reporter becomes `idacct_reporter` (nullable) **plus** the existing `reported_by` string, which is kept for anonymous and non-employee reporters ("Anonymous (HR Hotline)", "IT Security Desk" — both real rows in the current seed).

| Pros | Cons |
|---|---|
| `idacct` finally means the same thing it means in every other HR table | `idacct` changes meaning, so existing rows must be backfilled (Decision 1) |
| Department, position and name resolve from `vw_accounts_details` — no stale copies | Two reporter fields to reason about |
| Anonymous hotline reports stay filable — a genuine HR requirement, not a shortcut | |
| Unblocks the department filter, per-employee incident history, and a future `accountdiscipaction` link | |

**Option B — Every actor strictly `idacct`, no free text**
| Pros | Cons |
|---|---|
| Single representation, simplest queries | **Anonymous and external reports become unfilable** — kills a core HR intake channel |

**Option C — Keep free-text strings (status quo)**
| Pros | Cons |
|---|---|
| No migration | Every gap in G2/G3 stays open; no filtering, no reporting, no linkage |

**Recommendation: Option A.** Option B loses a real business capability; Option A is the same shape `employee_separation` already uses, extended for the one case incidents genuinely have that separations do not.

---

### Decision 3: Witnesses and the action trail

**Option A — Two child tables: `incident_report_parties` + `incident_report_actions` (Recommended)**
- Parties carries subject/witness/reporter rows uniformly (`idacct` when the person is an employee, `name` when not). Actions is an append-only trail: what was done, by whom, when.

| Pros | Cons |
|---|---|
| Follows `employee_clearance` / `id_separation` precedent exactly | Two more tables and two more models |
| An action can record actor + timestamp — a JSON string array cannot | Detail panel needs eager loading (`with(['parties','actions'])`) |
| Witnesses become searchable and joinable to accounts | |
| Append-only trail is the natural audit surface for a conduct investigation | |

**Option B — Keep both as JSON, change the column type to `json`**
| Pros | Cons |
|---|---|
| Smallest diff; casts already exist | Still cannot record who/when; still unsearchable; still off-convention |

**Option C — One child table with a `kind` discriminator for both parties and actions**
| Pros | Cons |
|---|---|
| One table | Two unrelated shapes crammed into one row type; half the columns null on every row |

**Recommendation: Option A.**

---

### Decision 4: Where demo data lives

**Option A — `Database\Seeders\Incident\IncidentReportSeeder`, registered in `DatabaseSeeder` (Recommended)**
- Move the 8 rows out of the migration into a seeder that also creates their parties and action rows, and resolves `idacct` against real seeded accounts instead of leaving it `NULL`.

| Pros | Cons |
|---|---|
| Matches `DisciplinaryActionSeeder` and the other 30+ seeders exactly | Two files touched instead of one |
| Demo data no longer reaches production `migrate` runs | Seeder must run after `Accounts` and `Units` to resolve ids |
| Re-runnable; rows link to real employees so the UI demonstrates the real joins | |

**Option B — Delete the demo rows entirely**
| Pros | Cons |
|---|---|
| Cleanest production posture | Empty module in every dev/demo environment; nothing exercises the status lifecycle |

**Option C — Keep them in the migration**
| Pros | Cons |
|---|---|
| No work | The exact defect the user reported |

**Recommendation: Option A.** Also delete the `insert()` block from the original migration file — it only ever ran inside `if (!Schema::hasTable(...))`, so removing it changes nothing for environments that already migrated and stops fresh installs from getting un-seeder-managed rows.

---

### Decision 5: IR-number generation

**Option A — Per-year `MAX` under a row lock, inside the filing transaction, with one retry on duplicate (Recommended)**
- `SELECT MAX(ir_number) ... WHERE ir_number LIKE 'IR-{year}-%' ... FOR UPDATE`, increment the numeric tail, retry once if the unique index still rejects.

| Pros | Cons |
|---|---|
| Preserves the `IR-2026-0042` per-year sequence already seeded and displayed | The most code of the three options |
| Collision-free under concurrency; no number reuse after deletion | Holds a brief row lock during filing |
| Same visible format — no frontend or report change | |

**Option B — Derive from the primary key after insert: `IR-{year}-{id:0000}`**
| Pros | Cons |
|---|---|
| Collision-free by construction; matches the codebase's dominant pattern (`'HOL-' . str_pad($holiday->id, 3, ...)`, `'CS-' . str_pad($r->id, 5, ...)`) | Numbers no longer restart at `0001` each year and are sparse per year — a visible change to an HR-facing reference number |
| Trivial to implement | Requires insert-then-update, so `ir_number` is momentarily empty |

**Option C — `count() + 1` (status quo)**
| Pros | Cons |
|---|---|
| Already written | Racy against a unique index (G6); reuses retired numbers. Note the same bug exists in `SaveJournalVoucherHandler:52` — it is a known defect, not a convention to copy |

**Recommendation: Option A** — an HR reference number that people quote in writing should keep its established format; correctness should not cost that. Option B is an acceptable fallback if the team accepts sparse numbering.

---

### Decision 6: Status lifecycle

**Option A — Guarded state machine in dedicated handlers (Recommended)**
- `open → investigating → resolved → closed`, plus `cancelled` from `open`/`investigating`. Each transition is a conditional update (`WHERE id = ? AND status = ?`), writes an action-trail row, and logs to `translog`.

| Pros | Cons |
|---|---|
| Illegal jumps (e.g. `open → closed`) are impossible | More handlers to write |
| Conditional update makes concurrent transitions safe for free (0 rows affected → `409`) | Transition map must be kept in one place |
| Every state change is explained in the trail — what an investigation needs | |

**Option B — One `PUT` that accepts any `status` value**
| Pros | Cons |
|---|---|
| One endpoint | Any status reachable from any other; no trail; concurrent writes silently clobber |

**Option C — No transitions (status quo)**
| Pros | Cons |
|---|---|
| — | The module is not a workflow (G8) |

**Recommendation: Option A.**

Status casing stays **lowercase** (`open`, `investigating`, …) rather than adopting separations' Title Case: the existing rows, `STATUS_STYLES` map and severity badges are all keyed lowercase, and changing casing would be churn with no benefit. This is a deliberate deviation from the separation module and should not be "fixed" later.

---

### Decision 7: Route shape and response contract

**Option A — `apiResource` + named action routes; separation's response shape (Recommended)**
```php
Route::apiResource('incident-reports', IncidentReportController::class)->only(['index', 'show', 'store', 'update']);
Route::post('/incident-reports/{id}/assign',  [IncidentReportController::class, 'assign']);
Route::post('/incident-reports/{id}/status',  [IncidentReportController::class, 'transition']);
Route::post('/incident-reports/{id}/actions', [IncidentReportController::class, 'logAction']);
```
- `index` returns `{ incidents: <paginator>, stats: {...}, filter: {...} }`; mutations return `{ message }`; failures return `{ message }` with `400`/`404`/`409`/`422`.

| Pros | Cons |
|---|---|
| Identical to `separations` (`apiResource` + `/{id}/approve`, `/{id}/clearance`) | `POST /incident-reports/save` disappears — a breaking change |
| Correct status codes instead of blanket `500` | Frontend `api` file must be updated in the same change |
| Drops the redundant `success` flag; HTTP status carries that | |

**Option B — Keep `/save` and the `{success: bool}` envelope, add new verbs alongside**
| Pros | Cons |
|---|---|
| No breaking change | Permanently two conventions in one portal; the frontend keeps `if (response.success)` branches that mask HTTP errors |

**Recommendation: Option A.** The only consumer is this module's own `api/incident_report.api.ts`, changed in the same commit, so "breaking" costs nothing.

---

### Decision 8: Where filter options come from

**Option A — Backend `GetIncidentReportQuery::filters()` (Recommended)**
- Returns `categories`, `severities`, `statuses`, `departments` (from `units`, `id <> 1`, as `GetSeparationsQuery` does) and `employees` (`HandleGlobal::getFilterEmployees()`), each as `{id, text}`.

| Pros | Cons |
|---|---|
| Reuses `HandleGlobal::getFilterEmployees()` — no new employee-list code | One extra query set per `index` call |
| Departments track `units` instead of drifting typed strings | |
| The create modal's employee picker needs this list anyway | |

**Option B — Frontend constants (status quo)**
| Pros | Cons |
|---|---|
| No backend work | Departments drift from `units`; no employee picker possible; category list duplicated between validation and UI |

**Option C — A `preferences`-style lookup table for categories**
| Pros | Cons |
|---|---|
| HR can add categories without a deploy | New table + admin UI for six values nobody has asked to change |

**Recommendation: Option A**, with categories as a backend constant served through `filters()`. Option C is the right answer the day HR asks to manage the list; it is listed in §8.

---

### Decision 9: The mock-data fallback

**Option A — Delete `MOCK_INCIDENTS`, `applyMockData()` and the client-side fabricate branch (Recommended)**
- The composable gains an `error` ref; the list renders an error state with a retry action.

| Pros | Cons |
|---|---|
| A broken backend looks broken instead of looking populated | The page is empty until the backend works — which is the point |
| Removes ~140 lines of fabricated records from `utils` | Needs an error state in `IncidentReportList` |
| `submitReport()` stops inventing rows the database never accepted | |

**Option B — Keep it behind an env/dev flag**
| Pros | Cons |
|---|---|
| Demos survive a backend outage | Two data paths to reason about; the flag will be wrong in some environment |

**Recommendation: Option A.** With Decision 4 seeding real rows, there is nothing left for a mock path to do.

---

### Decision 10: Linking an incident to a disciplinary action

**Option A — Do not link yet; make it possible (Recommended)**
- Decision 2 gives every incident a real `idacct` subject. No write to `accountdiscipaction` in this spec.

| Pros | Cons |
|---|---|
| Keeps this spec's scope on the reported defects | HR still keys the sanction twice for now |
| The join key exists, so a follow-up spec is additive | |

**Option B — Create an `accountdiscipaction` row when an incident resolves**
| Pros | Cons |
|---|---|
| One flow from incident to sanction | Not every incident is a sanction (safety, environmental, facilities are not); needs penalty/date rules nobody has specified yet |

**Option C — Store incidents in `accountdiscipaction`**
| Pros | Cons |
|---|---|
| No new tables | Different entity with a different lifecycle; would corrupt the Employment Record *Sanctions* tab |

**Recommendation: Option A** — and the *policy* half (which categories should auto-create a sanction) is genuinely HR's call, not a technical default; it needs an HR decision before Option B can be specced.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A fresh database | `php artisan migrate` runs with no seeders | `incident_reports` contains **0 rows** — no demo data comes from any migration |
| AC-2 | A fresh, migrated database | `php artisan db:seed` runs | `incident_reports` contains **8 rows** (`IR-2026-0035` … `IR-2026-0042`), each with a non-null `idacct` resolving to a real `accounts.id`, and `IncidentReportSeeder` appears in `DatabaseSeeder::run()`'s `$this->call([...])` |
| AC-3 | The seeded 8 rows | Reading the schema | `incident_reports` has **no** `witnesses` and **no** `actions` column; `incident_report_parties` holds **8** `Witness` rows and **8** `Subject` rows, and `incident_report_actions` holds **20** rows carrying the seeded action strings |
| AC-4 | An environment where the original migration already ran, holding one filed row with `idacct = 7`, `witnesses = '["Ana Reyes"]'`, `actions = '["Report logged"]'` | The backfill migration runs | That row has `created_by = 7`, `idacct = NULL`, one `incident_report_parties` row `{role: 'Witness', name: 'Ana Reyes'}`, and one `incident_report_actions` row `{action: 'Report logged'}` |
| AC-5 | Authenticated HR user, 8 incidents exist | `GET /api/hr/incident-reports?entries=5&page=1` | `200` with `{incidents, stats, filter}`; `incidents.data` has 5 items, `incidents.total = 8`, `incidents.last_page = 2` |
| AC-6 | Same | Same response inspected | `filter.categories`, `filter.severities`, `filter.statuses`, `filter.departments`, `filter.employees` are each arrays of `{id, text}`; `filter.departments` equals `units` where `id <> 1` ordered by `name`; `filter.employees` equals `HandleGlobal::getFilterEmployees()` output |
| AC-7 | Same | Same response inspected | `stats` equals `{total: 8, open: 2, investigating: 2, critical: 1, resolved: 4}` and is produced by **one** grouped aggregate query (not five `COUNT(*)` queries) |
| AC-8 | Incidents exist in Logistics and Finance | `GET /api/hr/incident-reports?department=Logistics` | Only incidents whose subject's `vw_accounts_details.unit` is `Logistics` are returned |
| AC-9 | Incidents exist across categories | `GET /api/hr/incident-reports?category=Security` | Only `Security` incidents are returned; `category=all` returns all 8 |
| AC-10 | An incident whose subject is an employee with `empid` `<E>` and unit `Logistics` | `GET /api/hr/incident-reports?search=<E>` | That incident is returned — search matches `ir_number`, `title`, `category`, subject `empid`, subject `fullname`, and `reported_by` |
| AC-11 | An incident id `3` exists with 2 witnesses and 3 actions | `GET /api/hr/incident-reports/3` | `200` with the incident plus `parties` (3 entries: 1 `Subject`, 2 `Witness`) and `actions` (3 entries, each with `action`, `acted_by` display name, `acted_at`), ordered `acted_at` ascending |
| AC-12 | Authenticated HR user | `POST /api/hr/incident-reports` with `{title: 'Slip near dock', category: 'Workplace Safety', severity: 'high', idacct: '<E>', occurred_at: '2026-08-19 14:00', location: 'Bay 3', witnesses: [{name: 'Ana Reyes'}]}` (`<E>` = any existing `vw_accounts_details.empid`) | `200` `{message: 'Incident report filed successfully.'}`; one `incident_reports` row with `status = 'open'`, `idacct_assignee = NULL`, `created_by` = the caller's id, `reported_at` = now; one `Subject` party for `<E>`; one `Witness` party `Ana Reyes`; one `incident_report_actions` row `{action: 'Report filed'}` |
| AC-13 | The current year already holds `IR-2026-0042` | A new incident is filed | Its `ir_number` is `IR-2026-0043` |
| AC-14 | `IR-2026-0043` exists and is then deleted | A new incident is filed | Its `ir_number` is `IR-2026-0044` — a retired number is never reissued |
| AC-15 | No incident exists for year `2027` | An incident is filed on `2027-01-02` | Its `ir_number` is `IR-2027-0001` |
| AC-16 | Two filings are submitted simultaneously | Both run to completion | Both succeed with **distinct** `ir_number` values; neither returns `500`; the `ir_number` unique index is never violated |
| AC-17 | An incident with `status = 'open'` | `POST /api/hr/incident-reports/{id}/status` with `{status: 'investigating'}` | `200` `{message: 'Incident status updated.'}`; row `status = 'investigating'`; a new action row `{action: 'Status changed to investigating'}`; a `translog` row with `module = 'HR Access'` |
| AC-18 | An incident with `status = 'open'` | `POST /api/hr/incident-reports/{id}/status` with `{status: 'closed'}` | `422` `{message: 'Cannot change status from open to closed.'}`; row unchanged; no action row written |
| AC-19 | An incident with `status = 'investigating'` | Two `POST .../status {status: 'resolved'}` requests race | Exactly one returns `200`; the other returns `409` `{message: 'Incident status has already changed. Please refresh.'}`; the row transitions once and exactly one action row is written |
| AC-20 | An incident with `status = 'resolved'` | `POST .../status` with `{status: 'closed'}` and no `resolution` on the row | `422` `{message: 'A resolution is required before closing an incident.'}` |
| AC-21 | An unassigned incident | `POST /api/hr/incident-reports/{id}/assign` with `{idacct: '<A>'}` (`<A>` = any existing `empid`) | `200`; `idacct_assignee` = that account's id; action row `{action: 'Assigned to <fullname>'}` |
| AC-22 | An incident already assigned to `<A>` | The same assign request is replayed | `200` `{message: 'Incident assigned successfully.'}`; `idacct_assignee` unchanged; **no** duplicate action row is written |
| AC-23 | Any incident | `POST .../assign` with an `idacct` that matches no `accounts.empid` and no `accounts.id` | `422` `{message: 'Employee not found.'}`; row unchanged |
| AC-24 | A filing payload | `title` is `''`, or absent, or 256+ characters | `422`, body contains an `errors.title` entry; no row created |
| AC-25 | A filing payload | `severity` is `'urgent'` (not in `low\|medium\|high\|critical`), or `category` is not one of the six served in `filter.categories` | `422` with the offending field in `errors`; no row created |
| AC-26 | A filing payload | `occurred_at` is `'not-a-date'`, or a date **after** `reported_at`/now | `422` `{errors: {occurred_at: [...]}}` — an incident cannot have occurred in the future |
| AC-27 | A filing payload | `idacct` is `null`/absent (site-level incident with no named employee) | `200` — the incident is created with `idacct = NULL` and no `Subject` party; `reported_by` falls back to the filer's `fullname` |
| AC-28 | A filing payload | `description` exceeds 65,535 characters | `422` `{errors: {description: [...]}}` — rejected, not silently truncated by MySQL |
| AC-29 | An unauthenticated request | Any `/api/hr/incident-reports*` call | `401` `{status: 401, message: 'Unauthenticated.'}` (the `bootstrap/app.php` handler), matching every other HR endpoint |
| AC-30 | Any incident id that does not exist | `GET`/`PUT`/`POST` against `/api/hr/incident-reports/9999...` | `404` `{message: 'Incident report not found.'}` |
| AC-31 | The frontend, with the API returning `500` | The page loads | An error state with a retry control is rendered; **no** fabricated incident is displayed; `grep -r "MOCK_INCIDENTS" resources/views/web/src` returns nothing |
| AC-32 | The frontend, with `POST` rejected `422` | The create modal is submitted | The modal stays open, shows the field errors, and **no** row is appended to the local list |
| AC-33 | The frontend module | Type-checking / build | `types.incident_report.ts` declares `IncidentSeverity`, `IncidentStatus`, `IncidentParty`, `IncidentAction`, `IncidentReportItem`, `Paginator<T>`, `IncidentFilterOptions`, `IncidentForm` with no `[key: string]: any`; `index.ts` exports types only from `types/`, and `utils/` exports only style/icon maps |
| AC-34 | The redesigned page | Visual check against [ui-design](../../../rules/conditional/ui-design.md) | Emerald HR accent, `bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-700` cards, `dark:` variants on every colour class, and the table container keeps `cursor-grab active:cursor-grabbing select-none` drag-to-scroll |
| AC-35 | `routes/api/hr.php` | Grepped after the change | `POST /incident-reports/save` is gone; `apiResource('incident-reports')->only(['index','show','store','update'])` plus `/{id}/assign`, `/{id}/status`, `/{id}/actions` are registered; no reference to `/save` remains in `resources/views/web/src` |

---

## 3. Database

### 3a. `incident_reports` — **reused**, extended

| Column | Status | Type | Notes |
|---|---|---|---|
| `id` | reuse | bigint PK | |
| `ir_number` | reuse | string unique | `IR-{YYYY}-{NNNN}`; generation moves to the handler (Decision 5) |
| `title` | reuse | string | required, ≤ 255 |
| `category` | reuse | string | one of the six served in `filter.categories`; validated `Rule::in(...)` |
| `severity` | reuse | string | `low` \| `medium` \| `high` \| `critical` |
| `status` | reuse | string, default `open` | `open` \| `investigating` \| `resolved` \| `closed` \| `cancelled` (lowercase — Decision 6) |
| `idacct` | **repurposed** | int nullable, indexed | **Subject** — the employee the incident is about (`accounts.id`). Was the filer's id; backfilled to `created_by`. `NULL` = site-level incident with no named employee |
| `created_by` | **new** | int nullable | Filing HR user (`accounts.id`) — same name/meaning as `employee_separation.created_by` |
| `idacct_reporter` | **new** | int nullable, indexed | Reporter when the reporter is an employee |
| `reported_by` | reuse | string nullable | Reporter **display label** — kept for anonymous/external reporters ("Anonymous (HR Hotline)"). When `idacct_reporter` is set this is the resolved `fullname` |
| `idacct_assignee` | **new** | int nullable, indexed | Investigator. `NULL` = unassigned (replaces the `'Unassigned'` string) |
| `assignee` | **dropped** | — | Superseded by `idacct_assignee`; backfilled where it names a resolvable employee, else discarded |
| `unit_id` | **new** | int nullable, indexed | Department (`units.id`). Resolved from the subject on filing, or chosen explicitly for a site-level incident |
| `department` | reuse | string nullable | Denormalised label retained **only** for legacy rows and free-text departments; the Query prefers the `units` / `vw_accounts_details` join |
| `location` | reuse | string nullable | |
| `occurred_at` | **new** | datetime nullable | When the incident happened — distinct from when it was reported. Must not be in the future |
| `reported_at` | reuse | datetime nullable | When it was filed; set to `now()` by the handler |
| `description` | reuse | text nullable | ≤ 65,535 |
| `resolution` | **new** | text nullable | Closure narrative; required before `closed` (AC-20) |
| `resolved_at` | **new** | datetime nullable | Set by the `resolved` transition |
| `closed_by` | **new** | int nullable | Set by the `closed` transition |
| `witnesses` | **dropped** | — | → `incident_report_parties` |
| `actions` | **dropped** | — | → `incident_report_actions` |
| `timestamps` | reuse | | |

Indexes: keep `idx_incident_reports_idacct`; add plain indexes on `idacct_assignee`, `unit_id`, `status`, `severity`, and a composite on `(status, reported_at)` for the default list ordering. **No DB-level foreign keys** — SubHRMS convention.

### 3b. `incident_report_parties` — **new**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `id_incident` | bigint, indexed | → `incident_reports.id` (naming mirrors `employee_clearance.id_separation`) |
| `role` | string | `Subject` \| `Witness` \| `Reporter` |
| `idacct` | int nullable, indexed | Set when the person is an employee |
| `name` | string nullable | Set when they are not (external, anonymous, "Night shift guard") |
| `remarks` | string nullable | |
| `timestamps` | | |

At least one of `idacct` / `name` must be present — enforced in the handler, since MySQL check constraints are not used elsewhere in this repo.

### 3c. `incident_report_actions` — **new**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `id_incident` | bigint, indexed | → `incident_reports.id` |
| `action` | string | e.g. `Report filed`, `Assigned to Juan Dela Cruz`, `Status changed to investigating`, `First aid administered` |
| `notes` | text nullable | |
| `acted_by` | int nullable | `accounts.id`; `NULL` for seeded/system rows |
| `acted_at` | datetime | Defaults to `now()` |
| `timestamps` | | |

Append-only: no update or delete endpoint.

### 3d. Migrations

Under `database/migrations/table/incident_report/` (folder exists), following its `YYYY_MM_DD_NNNNNN` naming:

1. `..._add_system_fields_to_incident_reports_table.php` — adds `created_by`, `idacct_reporter`, `idacct_assignee`, `unit_id`, `occurred_at`, `resolution`, `resolved_at`, `closed_by` + the new indexes. Guarded with `Schema::hasColumn`.
2. `..._create_incident_report_parties_table.php` — guarded with `Schema::hasTable`.
3. `..._create_incident_report_actions_table.php` — guarded with `Schema::hasTable`.
4. `..._backfill_incident_report_relations.php` — moves `idacct` → `created_by`, decodes `witnesses` → `Witness` parties, decodes `actions` → action rows, resolves `assignee` → `idacct_assignee` where the string matches a single `vw_accounts_details.fullname`, then drops `witnesses`, `actions`, `assignee`. Idempotent: skips rows already backfilled.

Also **edit** `2026_06_20_000001_create_incident_reports_table.php` to delete its `$mockIncidents` array and `insert()` call (Decision 4). The `Schema::create` block stays exactly as-is.

### 3e. Seeder

`database/seeders/Incident/IncidentReportSeeder.php`, namespace `Database\Seeders\Incident`, class extends `Seeder` — same shape as `Database\Seeders\DisciplinaryAction\DisciplinaryActionSeeder`. Registers in `DatabaseSeeder::run()`'s `$this->call([...])` **after** `Accounts::class` and `Units::class` so subject/assignee/unit ids resolve. Carries the same 8 incidents (they are good demo data), now with real `idacct`, `unit_id`, `idacct_assignee`, plus their parties and action rows.

---

## 4. Backend

### 4a. Models

- **`App\Models\IncidentReport`** — *reuse, edit*: update `$fillable` for the new columns; **remove** the `witnesses`/`actions` array casts; add `occurred_at`, `resolved_at` to `$casts` as `datetime`; add `parties()` / `actions()` `hasMany` (on `id_incident`) and `subject()` `belongsTo(Account::class, 'idacct')`. Keeps `CastNumericStrings`.
- **`App\Models\IncidentReportParty`** — *new*: `$table = 'incident_report_parties'`.
- **`App\Models\IncidentReportAction`** — *new*: `$table = 'incident_report_actions'`.
- **Reused as-is:** `AccountDetailVW` (`vw_accounts_details`), `Account`, `Unit`, `TransLog`.

### 4b. Queries — `App\Queries\Incident\`

- **`GetIncidentReportQuery`** — *reuse and extend*, do **not** replace. Keeps the existing status/severity/search/entries handling and adds: `department` and `category` filters, `date_from`/`date_to` on `occurred_at`, a `LEFT JOIN vw_accounts_details` for subject/assignee (`empid`, `fullname`, `position`, `unit`), `with(['parties', 'actions'])`, a mapper to the frontend `IncidentReportItem` shape, and a private `filters()` returning `categories`, `severities`, `statuses`, `departments` (`Unit::where('id','<>',1)->orderBy('name')`) and `employees` (**`HandleGlobal::getFilterEmployees()`** — reused, not reimplemented). Returns `['incidents' => $paginator, 'filter' => self::filters()]`, mirroring `GetSeparationsQuery`.
- **`GetIncidentReportStatsQuery`** — *new*: one `selectRaw` grouped aggregate producing `{total, open, investigating, critical, resolved}`, replacing the five `COUNT(*)` calls in the controller (AC-7).

### 4c. Handlers — `App\Handlers\Incident\`

All `extends App\Handlers\Handler`, `public static function execute($params = [])`, wrapped in `DB::transaction`, modelled on `App\Handlers\Separation\*`.

| Handler | Responsibility |
|---|---|
| `FileIncidentReportHandler` | Resolve subject `idacct` from `empid` (reuse the `resolveAccountId` approach in `FileSeparationHandler`), resolve `unit_id` from the subject's `vw_accounts_details.unit`, generate `ir_number` (Decision 5), insert the incident with `status = 'open'`, insert `Subject`/`Witness`/`Reporter` parties, insert the opening `Report filed` action row. Returns the model. |
| `UpdateIncidentReportHandler` | Edit the descriptive fields (`title`, `category`, `severity`, `location`, `occurred_at`, `description`, `unit_id`, witnesses). Cannot change `status`, `ir_number` or `idacct_assignee`. |
| `AssignIncidentReportHandler` | Resolve the assignee, set `idacct_assignee`, append an `Assigned to …` action **only when the assignee actually changes** (AC-22). |
| `TransitionIncidentStatusHandler` | Validate the transition against the map below, apply it as a conditional update (`where('id', …)->where('status', $from)`), throw a conflict when 0 rows are affected, set `resolved_at` / `closed_by` where relevant, append the status action row. |
| `LogIncidentActionHandler` | Append a free-form action-trail row (`action`, `notes`, `acted_by`, `acted_at`). |

Transition map (single source of truth, a `const` on `TransitionIncidentStatusHandler`):

```
open          → investigating, cancelled
investigating → resolved, cancelled
resolved      → closed, investigating   (re-open on new evidence)
closed        → (terminal)
cancelled     → (terminal)
```

### 4d. Controller — `app/Http/Controllers/hr/IncidentReportController.php` (*reuse, rewrite thin*)

Each method: validate → delegate to a Query/Handler → `TransLog::logAction(..., 'HR Access', $request, <type>)` → `response()->json(['message' => ...], 200)`, inside `try/catch` returning `{message}` with the right status. Private `actor()` and `log()` helpers copied from `EmployeeSeparationController` (same file-local pattern, not a shared abstraction — it is 6 lines and duplicating it matches the existing controllers).

| Method | Route | Returns |
|---|---|---|
| `index` | `GET /api/hr/incident-reports` | `{incidents: <paginator>, stats: {...}, filter: {...}}` |
| `show` | `GET /api/hr/incident-reports/{id}` | `{incident: {...}}` including `parties` + `actions` |
| `store` | `POST /api/hr/incident-reports` | `{message: 'Incident report filed successfully.'}` |
| `update` | `PUT /api/hr/incident-reports/{id}` | `{message: 'Incident report updated successfully.'}` |
| `assign` | `POST /api/hr/incident-reports/{id}/assign` | `{message: 'Incident assigned successfully.'}` |
| `transition` | `POST /api/hr/incident-reports/{id}/status` | `{message: 'Incident status updated.'}` |
| `logAction` | `POST /api/hr/incident-reports/{id}/actions` | `{message: 'Action logged.'}` |

Validation rules (`store`/`update`): `title` `required|string|max:255`; `category` `required|string|in:<the six>`; `severity` `required|in:low,medium,high,critical`; `idacct` `nullable|string`; `unit_id` `nullable|integer`; `location` `nullable|string|max:255`; `occurred_at` `nullable|date|before_or_equal:now`; `description` `nullable|string|max:65535`; `witnesses` `nullable|array`; `witnesses.*.name` `required_without:witnesses.*.idacct|string|max:255`.

### 4e. Routes — `routes/api/hr.php`

Replace lines 137-138 (the `// Incident Reports` block) with:

```php
// Incident Reports
Route::apiResource('incident-reports', IncidentReportController::class)->only([
    'index', 'show', 'store', 'update'
]);
// custom (non-RESTful) actions
Route::post('/incident-reports/{id}/assign',  [IncidentReportController::class, 'assign']);
Route::post('/incident-reports/{id}/status',  [IncidentReportController::class, 'transition']);
Route::post('/incident-reports/{id}/actions', [IncidentReportController::class, 'logAction']);
```

The existing `use App\Http\Controllers\hr\IncidentReportController;` import (line 23) stays. Auth is inherited from the `auth:sanctum` + `prefix('hr')` group in [routes/api.php:60](../../../../routes/api.php#L60) — no per-route middleware, matching every other HR route.

---

## 5. Frontend

Module stays at `resources/views/web/src/module/hr/incident_report/` — the folder layout is already correct.

```
incident_report/
├── index.ts                                   # edit — types only from types/, styles only from utils/
├── api/incident_report.api.ts                 # edit — RESTful methods, /save removed
├── composables/useIncidentReport.ts           # edit — mock path deleted, error state, server filters
├── pages/IncidentReport.vue                   # edit — wire error state + new handlers
├── types/types.incident_report.ts             # rewrite — real interfaces
├── utils/incident_report.utils.ts             # edit — MOCK_INCIDENTS deleted; style/icon maps kept
└── components/
    ├── IncidentReportHeader.vue               # keep — stats strip (emerald, already conformant)
    ├── IncidentReportToolbar.vue              # edit — category + department selects from filter payload
    ├── IncidentReportList.vue                 # edit — assignee column shows fullname or "Unassigned"; error state
    ├── IncidentReportPagination.vue           # keep
    ├── IncidentCreateModal.vue                # edit — employee picker (subject), occurred_at, witness repeater, field errors
    ├── IncidentDetailPanel.vue                # edit — parties + action trail; assign & status controls
    └── IncidentActionTrail.vue                # new — append-only trail list + "log action" input
```

### 5a. Types (`types/types.incident_report.ts`) — full rewrite

Following `types.separation.ts`: `IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'`; `IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed' | 'cancelled'`; `IncidentCategory` union of the six; `IncidentPartyRole = 'Subject' | 'Witness' | 'Reporter'`; `IncidentParty`; `IncidentAction`; `IncidentReportItem` (real fields, `parties: IncidentParty[]`, `actions: IncidentAction[]`); `IncidentStats`; `Paginator<T>`; `IncidentFilterOptions`; `IncidentForm`. **No `[key: string]: any`.** The `Incident` alias currently exported from `utils/` is deleted; `index.ts` re-exports from `types/` only.

### 5b. API contract (`api/incident_report.api.ts`)

| Method | Call | Response |
|---|---|---|
| `getIncidentReports(params)` | `GET api/hr/incident-reports` | `{incidents, stats, filter}` |
| `getIncidentReport(id)` | `GET api/hr/incident-reports/{id}` | `{incident}` |
| `createIncidentReport(payload)` | `POST api/hr/incident-reports` | `{message}` |
| `updateIncidentReport(id, payload)` | `PUT api/hr/incident-reports/{id}` | `{message}` |
| `assignIncidentReport(id, payload)` | `POST api/hr/incident-reports/{id}/assign` | `{message}` |
| `transitionIncidentReport(id, payload)` | `POST api/hr/incident-reports/{id}/status` | `{message}` |
| `logIncidentAction(id, payload)` | `POST api/hr/incident-reports/{id}/actions` | `{message}` |

`saveIncidentReport` is removed. Query params on `index`: `search`, `status`, `severity`, `category`, `department`, `date_from`, `date_to`, `entries`, `page`.

### 5c. Composable (`composables/useIncidentReport.ts`)

Deleted: the `MOCK_INCIDENTS` import, `applyMockData()`, and the fabricate-a-row branch in `submitReport()`. Added: `error = ref<string | null>(null)` set from the caught response; `filterOptions` populated from `filter`; `formErrors = ref<Record<string, string[]>>({})` fed from a `422`; `assignIncident`, `changeStatus`, `logAction`. Server-side pagination and the existing debounce-free `watch([...])` → `currentPage = 1` → refetch behaviour are kept (they already match the system). Per [vue-standards](../../../rules/conditional/frontend-vue.md), all state stays in the composable; the page stays presentational.

### 5d. Layout sketch (unchanged structure, new controls)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Incident Report                          [ + File Incident Report ] │  Header (emerald banner)
│  Total 8 · Open 2 · Investigating 2 · Critical 1 · Resolved 4         │  stats strip — from stats{}
├──────────────────────────────────────────────────────────────────────┤
│ [search…] [Status ▾] [Severity ▾] [Category ▾] [Department ▾] [10 ▾] │  Toolbar — options from filter{}
├──────────────────────────────────────────────────────────────────────┤
│ IR#          Incident            Sev.  Status  Assignee   Reported    │  drag-to-scroll table
│ IR-2026-0042 Slip and fall…      HIGH  Invest. J. Cruz    Jun 17      │
│ IR-2026-0035 Repetitive strain…  MED   Open    Unassigned Jun 07      │
├──────────────────────────────────────────────────────────────────────┤
│                          Showing 1-8 of 8   ‹ 1 ›                    │
└──────────────────────────────────────────────────────────────────────┘
Detail panel (modal): subject + reporter + witnesses (parties) · description ·
  resolution · [Assign ▾] [Change status ▾] · action trail (append-only) + log-action input
```

---

## 6. Business Rules & Edge Cases

### 6a. Domain rules

1. **`ir_number` is immutable and never reissued.** Generated once on filing, per-year sequential, unique.
2. **Status moves only along the transition map** in §4c. `closed` and `cancelled` are terminal.
3. **`resolved` requires a `resolution`**; `closed` requires the incident to already be `resolved`.
4. **A subject employee is optional.** Site-level incidents (fire alarm, chemical spill in a shared pantry) legitimately have no named employee; `idacct` stays `NULL` and `unit_id` is chosen explicitly.
5. **Anonymous reporting is supported.** `idacct_reporter = NULL` with `reported_by = 'Anonymous (HR Hotline)'` is valid and must never be back-resolved to the filing user.
6. **`occurred_at` ≤ now** and `occurred_at` ≤ `reported_at` — an incident cannot be reported before it happened.
7. **The action trail is append-only.** No update or delete path; it is the investigation record.
8. **Portal separation** ([hrms-rules](../../../rules/conditional/payroll.md)): this module lives entirely in the HR portal. It does not surface in the employee or manager portals in this spec — employee self-reporting is §8.
9. **Every mutation writes `translog`** with `module = 'HR Access'`, via `TransLog::logAction`.
10. **`stats` are whole-table, not filter-scoped** — the banner is a standing department-wide count, so filtering the list does not move it. Deliberate; documented so it is not "fixed" as a bug.

### 6b. Edge cases

| Edge case | Handling |
|---|---|
| Legacy row where `assignee` is `'Unassigned'` | Backfill leaves `idacct_assignee = NULL`; UI renders "Unassigned" |
| Legacy `assignee` string matching 0 or 2+ employees | Left `NULL`; the original string is preserved as an `incident_report_actions` note so nothing is lost |
| `witnesses` JSON that is `'[]'`, `NULL`, or malformed | 0 party rows; malformed JSON logged by the backfill and skipped, never fatal |
| Subject employee later separates/deactivates | Incident is untouched; the join keeps resolving from `vw_accounts_details`, which retains separated accounts |
| Subject's department changes after filing | The list shows the **current** unit from the join; `unit_id` on the row preserves the department at filing time for reporting |
| `entries=all` | `GetIncidentReportQuery` already returns `->get()`; the mapper must handle a plain collection as well as a paginator (`GetSeparationsQuery` shows the pattern) |
| Assign to the already-assigned employee | `200`, no-op, **no** duplicate trail row (AC-22) |
| Re-open a `resolved` incident | Allowed (`resolved → investigating`); `resolved_at` is cleared and a trail row records the re-open |
| Two HR users file the same real-world incident | Two IRs, by design — HR merges manually; automatic dedupe is §8 |
| Filing while the subject has no `unit` in the view | `unit_id = NULL`; the list falls back to the `department` label, then to "General" |

### 6c. Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Every endpoint sits in the `auth:sanctum` + `prefix('hr')` group at [routes/api.php:60](../../../../routes/api.php#L60); unauthenticated requests get `401 {status: 401, message: 'Unauthenticated.'}` from the `bootstrap/app.php` handler. Portal separation is enforced the way it is enforced for **all** HR endpoints today: the frontend gates the route/sidebar on `hr_portal_access` resolved by [GlobalController:43](../../../../app/Http/Controllers/global/GlobalController.php#L43), and no HR controller carries a per-endpoint role guard. This spec **deliberately does not** add a bespoke backend `hr_portal_access` check to incident reports alone — a single guarded endpoint among ~90 unguarded HR routes reads as protection that is not there. `accesstype.hr_portal_access` exists and is the right key; making it a route middleware across the whole portal is listed in §8 as its own spec. Anyone reviewing this module in isolation should read the gap as system-wide, not module-specific. |
| **Concurrency / double-submit** | (a) `ir_number`: generated under a `FOR UPDATE` lock inside the filing transaction with one retry on the unique index — AC-16 covers simultaneous filings. (b) Status transitions: applied as `where('id', $id)->where('status', $from)->update(...)`; 0 affected rows → `409 {message: 'Incident status has already changed. Please refresh.'}` (AC-19). (c) UI: the create modal's submit is disabled while `isSubmitting`, and transition/assign controls disable while in flight. |
| **Idempotency on retries** | Filing is **not** idempotent by nature — a replayed `POST /incident-reports` creates a second IR with its own number (AC-13 sequence continues). This is accepted: an incident report is a human intake document, HR merges duplicates, and no money or entitlement is derived from it. What **is** made safe: `assign` is idempotent (same assignee → `200`, no state change, no duplicate trail row — AC-22); a replayed transition hits the from-status guard and returns `409` rather than double-writing (AC-19); the backfill migration skips rows already migrated. Action-trail appends are intentionally non-idempotent — a repeated log entry is a visible, harmless duplicate rather than a lost record. |
| **Error response shape & status codes** | Validation `422 {message, errors: {<field>: [...]}}` (Laravel default from `$request->validate`). Not found `404 {message: 'Incident report not found.'}`. Illegal transition `422 {message: 'Cannot change status from <from> to <to>.'}`. Lost transition race `409 {message: 'Incident status has already changed. Please refresh.'}`. Unresolvable employee `422 {message: 'Employee not found.'}`. Any other domain failure `400 {message: <exception message>}` — the `EmployeeSeparationController` shape. Unauthenticated `401` as above. The blanket `500` and the `{success: bool}` envelope are both removed. |
| **Input validation boundaries** | `title`: null/absent → `422`; `''` → `422`; 256 chars → `422`; 255 → accepted. `category`: absent → `422`; not one of the six → `422`. `severity`: not in `low\|medium\|high\|critical` → `422`. `idacct`: absent/null → accepted (`NULL` subject, AC-27); non-existent `empid` → `422 'Employee not found.'`; wrong type (array) → `422`. `unit_id`: non-integer → `422`; unknown id → `422`. `location`: 256 chars → `422`. `occurred_at`: malformed → `422`; future → `422`; null → accepted. `description`: > 65,535 → `422` (AC-28), never silently truncated. `witnesses`: not an array → `422`; an entry with neither `name` nor `idacct` → `422`. `entries`: `'all'` or a positive integer; anything else falls back to `10`. `page`: beyond the last page → an empty `data` array with correct `total`, not an error. |

---

## 7. Build Order

Dependency-first. Steps 1-5 are `/webkit.backend-implement`; step 6 is the Gate-1 design pass (`/webkit.frontend-implement`); step 7 is Gate-2 wiring; step 8 verifies.

1. **Migrations** — the three additive/create migrations, then the backfill migration. Strip the `$mockIncidents` block from `2026_06_20_000001_create_incident_reports_table.php`.
2. **Models** — edit `IncidentReport` (fillable, casts, relations); add `IncidentReportParty`, `IncidentReportAction`.
3. **Seeder** — `Database\Seeders\Incident\IncidentReportSeeder`; register in `DatabaseSeeder::run()` after `Accounts` and `Units`. Verify AC-1 → AC-3 with `migrate:fresh` then `db:seed`.
4. **Queries** — extend `GetIncidentReportQuery` (joins, filters, mapper, `filters()`); add `GetIncidentReportStatsQuery`.
5. **Handlers + controller + routes** — the five handlers, the thin controller with `TransLog` logging, the route block replacing lines 137-138. Verify AC-5 → AC-30.
6. **Frontend Gate 1 (static)** — rewrite `types/`, delete `MOCK_INCIDENTS`, restructure `index.ts`, and build the new UI surfaces (assign control, status control, `IncidentActionTrail.vue`, employee picker, `occurred_at`, field errors, error state) against **hard-coded** data shaped exactly like §5b. User validates the design here.
7. **Frontend Gate 2 (live)** — swap the hard-coded `api` methods for the real calls; wire `filterOptions`, `formErrors`, `error`. Verify AC-31 → AC-35.
8. **Verify** — `/webkit.verify` against this spec, then `/webkit.code-review` on the branch diff.

---

## 8. Out of Scope (Future Specs)

- **Portal-wide backend authorization guard** — a route middleware enforcing `accesstype.*_portal_access` across every portal route file. The system-wide gap named in §6c; it must not be solved for one module.
- **Incident → disciplinary action** — writing `accountdiscipaction` from a resolved conduct incident (Decision 10, Option B). Needs an HR policy decision on which categories warrant a sanction.
- **Evidence attachments** — the existing `attachments` table is `{idacct, doc_type, filename}`, keyed to an employee with no document-owner reference, so incident evidence needs either a polymorphic column there or an `incident_report_attachments` child table. Its own spec.
- **Employee self-reporting** — an employee-portal filing surface feeding the same table (`idacct_reporter` = the employee).
- **Manager visibility** — a manager-portal read-only view scoped to the manager's unit.
- **Category management UI** — the `preferences`-style lookup table from Decision 9, Option C.
- **Notifications** — email/broadcast to the assignee on assignment and on `critical` filings.
- **Analytics** — incident-rate-by-department trending, severity heatmaps, an HR dashboard tile.
- **Duplicate detection** — suggesting existing IRs at filing time from title/location/date proximity.
- **Restyling the module** — explicitly excluded. The current visual layer already conforms to [ui-design](../../../rules/conditional/ui-design.md); only the new controls in §5 are added, in the existing idiom.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-35)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] `grep -rn "MOCK_INCIDENTS\|applyMockData" resources/views/web/src` returns nothing
- [ ] `grep -rn "incident-reports/save" app/ routes/ resources/` returns nothing
- [ ] No `DB::table('incident_reports')->insert` remains in `database/migrations/`
- [ ] `IncidentReportSeeder` is registered in `DatabaseSeeder::run()`
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/hr-incident_report-verify-<date>.md`
