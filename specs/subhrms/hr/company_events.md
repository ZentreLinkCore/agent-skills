# Spec — Company Events & Activities Filing (HR)

> **Kind:** Extension / rework of an existing module — `activity_event` table, `ActivityorEvents` model, `ActivityorEventController` and the `hr/company_events` frontend module all exist. Nothing here creates a parallel table, model or endpoint.
> **Portal:** **HR** (`/api/hr/activityorEvent...` today, renamed to `/api/hr/activity-events...` by this spec — see Decision 5; `resources/views/web/src/module/hr/company_events/` frontend module).
> **Version:** v1 — 2026-08-21 — initial.
> **Route:** `hr/company-events` (`hr_company_events`) — unchanged.
> **Conventions:** [project-profile](../../../rules/project-profile.md), [hrms-rules](../../../rules/hrms-rules.md), [ui-design](../../../rules/ui-design.md), [vue-standards](../../../rules/vue-standards.md), [duplicate-prevention](../../../rules/duplicate-prevention.md).
> **System Awareness:** Models **reused** `ActivityorEvents`, `TransLog`; no new models. Table **reused** `activity_event` (currently untracked by any migration — see Decision 1); no new table. Routes **reused/renamed** — `apiResource('activityorEvent', ...)` becomes `apiResource('activity-events', ...)`, same four verbs, no new endpoint. Queries: none exist today; none added — the model's static `getActorEvents()` is kept as-is (Decision 6). New migration: **yes** — one, to give the live table a migration file for the first time.

---

## 1. Purpose

Company Events (backend name "Activity or Event") is where HR files company-wide activities and events — town halls, wellness days, safety drills, holidays observances — with a title, date range, location, organizer and an optional supporting attachment, so employees and other HR staff can see what is scheduled and when.

The module **cannot render today**. It looks complete (calendar-badge event cards, a details panel with inline edit, filters, pagination) but a scan of the actual wiring finds it was built as a UI demo with several pieces never connected. Verified deviations, each against a concrete in-repo counter-example:

| # | Deviation | Evidence | System convention it breaks |
|---|---|---|---|
| G1 | **The `activity_event` table has no migration anywhere in the repo.** | `grep -r "activity_event" database/` returns nothing, vs. every other domain table having a file under `database/migrations/table/<domain>/` (e.g. `table/incident_report/`, `table/device_management/`) | A fresh clone, CI run, or new developer's local database never gets this table — the module 500s on every request until someone manually creates it. |
| G2 | **The composable never defines or returns the five functions the page destructures from it.** `format`, `getFilePath`, `formatMonth`, `formatDay`, `truncateFilename` are all pulled out of `useCompanyEvents()` in [CompanyEvents.vue:86-121](../../../../resources/views/web/src/module/hr/company_events/pages/CompanyEvents.vue#L86-L121), and `useCompanyEvents.ts` never declares any of them. | [useCompanyEvents.ts](../../../../resources/views/web/src/module/hr/company_events/composables/useCompanyEvents.ts) — no `format`/`getFilePath`/`formatMonth`/`formatDay`/`truncateFilename` in its `return` | `CompanyEventsGrid` and `EventCard` declare these as `required: true, type: Function` props ([CompanyEventsGrid.vue:43-50](../../../../resources/views/web/src/module/hr/company_events/components/CompanyEventsGrid.vue#L43-L50)) — Vue throws/warns on the missing props and `formatEventDate`'s call to the undefined `format` throws outright. **The page cannot render a single event card as shipped.** |
| G3 | **Uploaded files keep the client's original filename with no collision guard.** `$file->move($path, $originalFilename)` in both `store()` and `update()`. | [ActivityorEventController.php:44-46, 87-95](../../../../app/Http/Controllers/hr/ActivityorEventController.php#L44-L46) | `CompanyProfileController::uploadAttachment()` time-stamps the stored filename (`time() . '.' . $file->getClientOriginalExtension()`) precisely to avoid this. Two events attaching a file named `report.pdf` silently overwrite each other on disk. |
| G4 | **Filing an empty form silently no-ops instead of failing.** Every rule in `StoreActivityEventRequest` is `sometimes`/`nullable` — including `title`. An empty `POST` passes validation, `$validated` is `[]` (PHP-falsy), and the entire `if ($validated)` body in `store()` is skipped — no row is created, and the endpoint still returns nothing but a bare `200`. A payload that omits `title` but has other fields hits an undefined-array-key access at `'title' => $validated['title']`. | [StoreActivityEventRequest.php:24-34](../../../../app/Http/Requests/StoreActivityEventRequest.php#L24-L34), [ActivityorEventController.php:49](../../../../app/Http/Controllers/hr/ActivityorEventController.php#L49) | Every other `Store*Request` in the repo (`StorePositionRequest`, etc.) marks the fields the entity cannot exist without as `required`. |
| G5 | **The delete audit-log message is copy-pasted from a different module.** `"$userName deleted position → $actEventLabel"` — for deleting an *event*, not a position. | [ActivityorEventController.php:146](../../../../app/Http/Controllers/hr/ActivityorEventController.php#L146) | Every other `TransLog::logAction` message in this controller (create/update) correctly names "Activity/Event". |
| G6 | **No error path in the UI reads field-level validation errors.** `showAlert()` only reads `error.response.data.message`; a `422` with `{errors: {title: [...]}}` shows a generic warning toast with no field feedback. | [useCompanyEvents.ts:213-216, 240-243](../../../../resources/views/web/src/module/hr/company_events/composables/useCompanyEvents.ts#L213-L216) | `IncidentCreateModal`-style modules (per the incident_report spec) surface `errors` per field; this module has no equivalent. |
| G7 | **Route casing is inconsistent with every recently redesigned HR route.** `apiResource('activityorEvent', ...)` — camelCase — vs. `position`, `device-management`, `incident-reports` — all kebab-case. | [routes/api/hr.php:127](../../../../routes/api/hr.php#L127) | [naming-convention](../../../rules/naming-convention.md) and the sibling redesigned modules. |
| G8 | **Types are stubs.** `CompanyEventsItem { [key: string]: any }`. | [types.company_events.ts](../../../../resources/views/web/src/module/hr/company_events/types/types.company_events.ts) | Same defect class as `incident_report`'s pre-rework `IncidentReportItem`. |
| G9 | **`seened_by` is dead.** Present in `$fillable`, never set or read by any controller method, never surfaced in the frontend. | `ActivityorEvents::$fillable` | Looks like a "seen/read receipt" feature that was never built; currently just unused column weight. |
| G10 | **The default list silently scopes to the current year** when no `start_date`/`end_date` filter is supplied (`whereYear('start_date', '=', Carbon::now()->year)`), with no indication of this in the UI. | [ActivityorEvents.php:44-46](../../../../app/Models/ActivityorEvents.php#L44-L46) | Not necessarily wrong, but undocumented — flagged here so it's a stated business rule (§6a) rather than a bug someone "fixes" later by accident. |

**What this spec does not change:** the visual design (calendar-badge cards, teal accent, modal/detail-panel treatment). Those already conform to [ui-design](../../../rules/ui-design.md) at the CSS-class level; the work here is making the module actually run, closing the filing/validation gaps, and giving the table a migration.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Give `activity_event` a migration for the first time

**Option A — Additive `Schema::hasTable`-guarded migration matching the live schema exactly (Recommended)**
- New file under `database/migrations/table/company_events/`, creating `activity_event` with the columns the model already declares (`title`, `description`, `start_date`, `end_date`, `file`, `created_by`, `seened_by`, `location`, `organizer`, `time_start`, timestamps) — no shape change, purely making the table reproducible.

| Pros | Cons |
|---|---|
| Safe on every environment — a no-op where the table already exists, a real fix on a fresh install/CI | None of consequence |
| Zero risk to existing data — it is a `CREATE TABLE IF NOT EXISTS` in spirit | |

**Option B — Leave it untracked (status quo)**
| Pros | Cons |
|---|---|
| No work | Every fresh clone/CI run/new developer never gets this table; the module is permanently broken for them (G1) |

**Recommendation: Option A.** This is the same defect class as `incident_report`'s migration-embedded seed rows, just the opposite direction — here there is no migration at all, not a bad one.

---

### Decision 2: Where the date/file display helpers live

**Option A — Add them as plain functions inside `useCompanyEvents.ts`, alongside `inputClass`**
| Pros | Cons |
|---|---|
| One file, smallest diff | Mixes pure display formatting with state/API logic in the same composable |

**Option B — Extract to `utils/company_events.utils.ts` (Recommended)**
- `formatMonth`, `formatDay`, `truncateFilename`, `getFilePath` (Decision 3) live in a new `utils/` file; `format` is imported from `date-fns` directly in the composable/page as it already is a project dependency (`date-fns@^4.1.0`) but was never imported.

| Pros | Cons |
|---|---|
| Matches the repo's own `types/`+`utils/` split (see `incident_report`'s `utils/incident_report.utils.ts` for style/icon maps) | One more file |
| Keeps the composable focused on data + actions, per [vue-standards](../../../rules/vue-standards.md) | |
| Pure functions are trivially unit-testable in isolation | |

**Recommendation: Option B.**

---

### Decision 3: Fixing the file-name collision

**Option A — Time-prefix the stored filename, keep a single `file` column (Recommended)**
- `store()`/`update()` save as `time() . '_' . $originalFilename`; the frontend's `truncateFilename()` strips the numeric prefix back off for display, and `getFilePath()` resolves the stored (prefixed) name against the asset path.

| Pros | Cons |
|---|---|
| Matches the existing precedent in the same portal (`CompanyProfileController::uploadAttachment`) | The literal on-disk name is no longer the original (cosmetic only — the download still offers the original name via `:download="event.file"`→ needs updating to a display name, see §5) |
| No schema change — fits inside Decision 1's migration as originally shaped | |
| Two uploads of `report.pdf` no longer collide | |

**Option B — Add an `original_filename` column, store a hashed name in `file`**
| Pros | Cons |
|---|---|
| Exact original name preserved for the download attribute | Schema change on a table that is only now getting its first migration (Decision 1); solves a problem Option A already solves adequately |

**Recommendation: Option A** — smaller diff, no schema growth, precedent already exists.

---

### Decision 4: Closing the "empty filing silently no-ops" gap

**Option A — Conditional `required` inside `StoreActivityEventRequest::rules()` (Recommended)**
```php
public function rules(): array
{
    $required = $this->isMethod('post') ? 'required' : 'sometimes';
    return [
        'title'      => "{$required}|string|max:255",
        'start_date' => "{$required}|date",
        'end_date'   => 'nullable|date|after_or_equal:start_date',
        // ...unchanged
    ];
}
```
- Filing (`POST`) requires `title` and `start_date`; partial edits (`PUT`) keep today's lenient behaviour.

| Pros | Cons |
|---|---|
| One `FormRequest`, no new class, matches the existing single-request-for-both-verbs shape | The conditional adds a small amount of logic to an otherwise declarative `rules()` |
| Closes G4 completely — an empty or title-less filing now returns `422`, never a silent no-op | |

**Option B — Split into `StoreActivityEventRequest` (all required) + `UpdateActivityEventRequest` (all optional)**
| Pros | Cons |
|---|---|
| Cleanest separation of intent | Two files instead of one for a two-verb, low-complexity form; not how this controller is currently organized |

**Recommendation: Option A.**

---

### Decision 5: Route casing — `activityorEvent` → `activity-events`

**Option A — Rename to kebab-case `activity-events`, update the one frontend consumer in the same change (Recommended)**
| Pros | Cons |
|---|---|
| Matches every recently redesigned HR route (`position`, `device-management`, `incident-reports`) | Breaking change — but the only consumer is `company_events.api.ts`, edited in the same commit |
| Consistent `Route::apiResource('activity-events', ...)` naming going forward | |

**Option B — Leave `activityorEvent` as-is**
| Pros | Cons |
|---|---|
| Zero churn on a URL that already works | Permanent naming inconsistency against the rest of the portal; cosmetic-only cost |

**Recommendation: Option A**, but this is low-risk enough that keeping Option B is a reasonable call if the user prefers not to touch a working URL for a naming-only reason — flagged here as the one genuinely optional decision in this spec.

---

### Decision 6: Whether to introduce a `Query`/`Handler` layer or keep the model static methods

**Option A — Keep `ActivityorEvents::getActorEvents()` as the read path; add thin `Handler` classes only for the three writes (Recommended)**
- `FileCompanyEventHandler`, `UpdateCompanyEventHandler`, `DeleteCompanyEventHandler` under `App\Handlers\CompanyEvent\`, each `extends Handler`, wrapping the existing `DB::transaction` bodies almost verbatim (fixing G3/G5 inline). The read stays a static model method, matching how `getActorEvents()` already works and how simple lookups are handled elsewhere when no filter/aggregation complexity justifies a `Query` class.

| Pros | Cons |
|---|---|
| Smallest diff that still gets the controller thin | The read path is a static model method rather than a `Query` class — a minor asymmetry with `incident_report`'s fuller rework |
| Matches [project-profile](../../../rules/project-profile.md)'s "not every Handler needs an Action" guidance in the mirror direction — this read genuinely doesn't need a `Query` wrapper, it's a single filter+paginate | |

**Option B — Full `GetCompanyEventsQuery` + three `Handlers`, mirroring `incident_report` exactly**
| Pros | Cons |
|---|---|
| Perfect symmetry with the bigger `incident_report` rework | More files than this module's actual complexity warrants — `getActorEvents()` is already correct, just needs to stay where it is |

**Recommendation: Option A.**

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A fresh database | `php artisan migrate` runs | `activity_event` exists with columns `title, description, start_date, end_date, file, created_by, seened_by, location, organizer, time_start, created_at, updated_at` — no error, no demo rows inserted |
| AC-2 | An environment where `activity_event` already exists (pre-migration) | The new migration runs | It is a no-op (`Schema::hasTable` guard) — no error, no data change |
| AC-3 | The frontend module, after the fix | Opened in a browser with ≥1 event returned by the API | The page renders event cards with no console error and no "Invalid prop: type check failed" warning; `grep -rn "formatMonth\|formatDay\|truncateFilename\|getFilePath" resources/views/web/src/module/hr/company_events/composables resources/views/web/src/module/hr/company_events/utils` shows all four defined and exported from `utils/company_events.utils.ts` |
| AC-4 | Same | The event list includes an event whose `start_date` is `2026-08-19` | The card's month/day badge shows "AUG" / "19" |
| AC-5 | Authenticated HR user, 5 events exist this year | `GET /api/hr/activity-events?entries=5&page=1` | `200` with `{activities_events: <paginator>}`; `.data` has up to 5 items, `.total` reflects the filtered count |
| AC-6 | No events exist for the current year, but 3 exist for `2025` | `GET /api/hr/activity-events` with no date filters | Returns `0` events for the current-year-only default scope (G10/§6a) — **not** an error, and **not** the 2025 events |
| AC-7 | The 3 events from 2025 | `GET /api/hr/activity-events?start_date=2025-01-01&end_date=2025-12-31` | Returns those 3 events |
| AC-8 | An event titled "Wellness Day" exists | `GET /api/hr/activity-events?search=wellness` | That event is returned; search matches `title`, `description`, `start_date`, `end_date`, and the formatted `time_start` |
| AC-9 | Authenticated HR user | `POST /api/hr/activity-events` with `{title: 'Town Hall', start_date: '2026-09-01', end_date: '2026-09-01', location: 'Main Hall', organizer: 'HR', time_start: '14:00'}` | `200` `{success: true, message: 'Activity/Event created successfully.'}`; one `activity_event` row with those values, `created_by` = the caller's id; a `translog` row describing the creation |
| AC-10 | Authenticated HR user | `POST /api/hr/activity-events` with an **empty body** (no fields at all) | `422` with `errors.title` and `errors.start_date` present; **no** row is created (closes G4 — previously this returned a bare `200` and silently created nothing) |
| AC-11 | Authenticated HR user | `POST /api/hr/activity-events` with `title` present but `start_date` omitted | `422` `{errors: {start_date: [...]}}`; no row created |
| AC-12 | A filing payload | `title` is `256` characters | `422` `{errors: {title: [...]}}` |
| AC-13 | A filing payload | `end_date` is before `start_date` | `422` `{errors: {end_date: [...]}}` — `after_or_equal:start_date` rejects it |
| AC-14 | A filing payload | `file` is a `.exe` or exceeds `2048` KB | `422` `{errors: {file: [...]}}` — only `pdf, docx, xlsx, csv, xls, jpg, jpeg, png` under 2MB are accepted |
| AC-15 | Two events are separately filed, each attaching a file literally named `report.pdf` | Both `POST` requests complete | Both rows have **distinct** stored `file` values (time-prefixed); neither file on disk was overwritten by the other (closes G3) |
| AC-16 | An existing event with id `7` | `PUT /api/hr/activity-events/7` with `{title: 'Town Hall (Updated)'}` and no other fields | `200` `{success: true, message: 'Activity updated successfully.'}`; only `title` changes; a `translog` row records old/new `title` only (unchanged fields produce no log line, per the existing `wasChanged()`/per-field diff logic) |
| AC-17 | An existing event with id `7` | `DELETE /api/hr/activity-events/7` | `200`; the row is removed; the `translog` message reads `"... deleted Activity/Event: Town Hall (Updated)"` — **not** `"deleted position"` (closes G5) |
| AC-18 | No event with id `9999` exists | `GET`/`PUT`/`DELETE` against `/api/hr/activity-events/9999` | `404` `{message: 'Event not found.'}` (the controller's `findOrFail` converted to a caught `ModelNotFoundException` returning a clean `404`, not Laravel's default HTML 404 page) |
| AC-19 | An unauthenticated request | Any `/api/hr/activity-events*` call | `401` `{status: 401, message: 'Unauthenticated.'}` (the `bootstrap/app.php` handler), matching every other HR endpoint |
| AC-20 | The frontend, with `POST` rejected `422` | The create modal is submitted with an invalid payload | The modal stays open and shows the field-level error(s) from `errors`, not just a generic toast (closes G6); **no** row is appended to the local list |
| AC-21 | The frontend module | Type-checking / build | `types.company_events.ts` declares `CompanyEventItem`, `Paginator<T>`, `CompanyEventForm`, `CompanyEventFilters` with no `[key: string]: any` |
| AC-22 | `routes/api/hr.php` | Grepped after the change | `apiResource('activity-events', ActivityorEventController::class)` is registered (or, if Decision 5's Option B is chosen instead, `activityorEvent` remains and this AC is marked N/A); no route named `activityorEvent` **and** `activity-events` coexist |

---

## 3. Database

### 3a. `activity_event` — **reused**, first migration only (no shape change)

| Column | Status | Type | Notes |
|---|---|---|---|
| `id` | reuse | bigint PK | |
| `title` | reuse | string | becomes `required` on create (Decision 4) |
| `description` | reuse | text nullable | |
| `start_date` | reuse | date | becomes `required` on create |
| `end_date` | reuse | date nullable | `after_or_equal:start_date` |
| `file` | reuse | string nullable | now time-prefixed on write (Decision 3) |
| `created_by` | reuse | int nullable, indexed | filer (`accounts.id`) |
| `seened_by` | reuse | string/text nullable | kept, unused (G9) — see §8 |
| `location` | reuse | string nullable | |
| `organizer` | reuse | string nullable | |
| `time_start` | reuse | time nullable | |
| `timestamps` | reuse | | |

No new columns, no dropped columns. Add a plain index on `start_date` (the default sort/scope column) if not already present — cheap, matches [performance](../../../rules/performance.md).

### 3b. Migration

`database/migrations/table/company_events/<YYYY_MM_DD_NNNNNN>_create_activity_event_table.php`, guarded with `Schema::hasTable('activity_event')`, creating exactly the columns in §3a. **No demo/seed rows inserted** — this module has no existing seed data to preserve or move, so there is nothing to migrate into a seeder (unlike `incident_report`'s Decision 4).

---

## 4. Backend

### 4a. Models

- **`App\Models\ActivityorEvents`** — *reuse*, no `$fillable`/`$table` change. `getActorEvents()` stays as the read path (Decision 6).

### 4b. Handlers — `App\Handlers\CompanyEvent\`

All `extends App\Handlers\Handler`, static `execute($params = [])`, wrapped in `DB::transaction` — carrying forward the existing logic from the controller almost unchanged, fixing G3 and G5 in the move:

| Handler | Responsibility |
|---|---|
| `FileCompanyEventHandler` | Time-prefix the uploaded filename (Decision 3), create the row, cross-post to `announcements` (`category='Company Event'`, `status=1`), write the `translog` create entry. |
| `UpdateCompanyEventHandler` | Same file-naming fix on re-upload; per-field diff + `translog` entries; syncs linked announcement `title`/`content`/`published_at`. |
| `DeleteCompanyEventHandler` | Delete the row; deactivate linked announcement (`status=0`); write the corrected `translog` message (`"... deleted Activity/Event: {title}"` — closes G5). |

### 4c. Controller — `app/Http/Controllers/hr/ActivityorEventController.php` (*reuse, thin out*)

Each method delegates to its Handler, catches `ModelNotFoundException` → `404 {message: 'Event not found.'}`, and any other `Exception` → `400 {message: $e->getMessage()}`.

| Method | Route | Returns |
|---|---|---|
| `index` | `GET /api/hr/activity-events` | `{activities_events: <paginator>}` (unchanged shape) |
| `store` | `POST /api/hr/activity-events` | `{success: true, message: 'Activity/Event created successfully.'}` |
| `update` | `PUT /api/hr/activity-events/{id}` | `{success: true, message: 'Activity updated successfully.'}` |
| `destroy` | `DELETE /api/hr/activity-events/{id}` | `{message: 'Event deleted successfully.'}` (currently returns nothing — add the response) |

### 4d. `StoreActivityEventRequest` — *edit*

Apply Decision 4's conditional `required`. No other rule changes.

### 4e. Routes — `routes/api/hr.php`

Replace lines 126-129:
```php
// Company Events / Activities
Route::apiResource('activity-events', ActivityorEventController::class)->only([
    'index', 'store', 'update', 'destroy'
]);
```
(If Decision 5's Option B is chosen, keep `activityorEvent` — everything else in §4 is unaffected either way.) The existing `use App\Http\Controllers\hr\ActivityorEventController;` import stays. Auth is inherited from the `auth:sanctum` + `prefix('hr')` group — no per-route middleware, matching the rest of the HR portal.

---

## 5. Frontend

Module stays at `resources/views/web/src/module/hr/company_events/` — the folder layout is already correct.

```
company_events/
├── index.ts                                # edit — types only from types/
├── api/company_events.api.ts              # edit — endpoint renamed per Decision 5
├── composables/useCompanyEvents.ts        # edit — imports date-fns `format`, pulls helpers from utils/, adds formErrors
├── pages/CompanyEvents.vue                # edit — destructures helpers from utils/ instead of the composable
├── types/types.company_events.ts          # rewrite — real interfaces
├── utils/company_events.utils.ts          # new — formatMonth, formatDay, truncateFilename, getFilePath
└── components/                             # unchanged visually; EventDetailsPanel/CompanyEventCreateModal gain field-error display
```

### 5a. `utils/company_events.utils.ts` (new)

```ts
export function formatMonth(dateStr: string): string { /* date-fns format(date, 'MMM').toUpperCase() */ }
export function formatDay(dateStr: string): string { /* date-fns format(date, 'd') */ }
export function truncateFilename(name: string, max = 24): string { /* strip the time()-prefix, ellipsize */ }
export function getFilePath(filename: string): string { /* `${apiOrigin}/assets/documents/activity_events/${filename}` */ }
```
`getFilePath` resolves against the API origin (`import.meta.env.VITE_API_URL`, with any trailing `/api` stripped), matching how the axios instance's `baseURL` is derived, since these files are served as static assets under `public/assets/documents/activity_events/`, not through an API route.

### 5b. Types (`types/types.company_events.ts`) — full rewrite

`CompanyEventItem { id, title, description, start_date, end_date, file, location, organizer, time_start, formatted_time_start, prepared_by, created_by }`; `Paginator<T>`; `CompanyEventForm` (the shape of `add`/`editView`); `CompanyEventFilters { search, start_date, end_date }`. **No `[key: string]: any`.**

### 5c. API contract (`api/company_events.api.ts`)

| Method | Call | Response |
|---|---|---|
| `getActivityorEvents(params)` | `GET api/hr/activity-events` | `{activities_events}` |
| `createActivityorEvent(formData)` | `POST api/hr/activity-events` | `{success, message}` |
| `updateActivityorEvent(id, formData)` | `POST api/hr/activity-events/{id}?_method=PUT` | `{success, message}` |
| `deleteActivityorEvent(id)` | `DELETE api/hr/activity-events/{id}` | `{message}` |

### 5d. Composable (`composables/useCompanyEvents.ts`)

Added: `import { format } from 'date-fns'`; `import { formatMonth, formatDay, truncateFilename, getFilePath } from '../utils/company_events.utils'`; a `formErrors = ref<Record<string, string[]>>({})` populated from a `422` in `addActorEvents`/`handleSaveEdit`, cleared on modal open/close. The five previously-missing names are now returned from the composable (re-exported from `utils/`) so `CompanyEvents.vue`'s existing destructure keeps working unchanged.

---

## 6. Business Rules & Edge Cases

### 6a. Domain rules

1. **The default list scope is the current year** when no `start_date`/`end_date` filter is supplied. This is a deliberate, pre-existing behaviour (not introduced by this spec) — documented here so it is read as a stated rule (G10), not "fixed" as a bug later.
2. **`end_date` ≥ `start_date`.** Enforced by `after_or_equal:start_date`.
3. **A supporting attachment is optional** and, when present, restricted to `pdf, docx, xlsx, csv, xls, jpg, jpeg, png`, ≤ 2MB.
4. **Filing requires `title` and `start_date`.** (New in this spec — Decision 4.)
5. **Every mutation writes `translog`** with `module = 'HR Access'`, via `TransLog::logAction` — unchanged, except the delete message now correctly names "Activity/Event" (G5).
6. **Stored filenames are time-prefixed** to avoid collisions between unrelated uploads sharing an original name (Decision 3); the display label strips the prefix.

### 6b. Edge cases

| Edge case | Handling |
|---|---|
| Update with no `file` re-upload | The existing stored `file` value is kept (`$fileName = $actevents->file` default, unchanged) |
| `search` matching a formatted time (e.g. "2:00 PM") | Already handled — the query matches `DATE_FORMAT(time_start, '%l:%i %p')` |
| `entries` beyond the actual row count | `paginate()` returns an empty `data` array on an out-of-range page, not an error |
| Deleting an event that has an attached file | The file is left on disk (no cleanup today); out of scope for this spec — see §8 |
| Two HR users editing the same event concurrently | Last write wins (no optimistic lock) — acceptable for a low-contention filing form; not a payroll/statutory computation |

### 6c. Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Every endpoint sits in the `auth:sanctum` + `prefix('hr')` group; unauthenticated requests get `401`. As with `incident_report`, this spec does **not** add a bespoke per-endpoint `hr_portal_access` guard — that gap is system-wide across ~90 HR routes and is tracked as its own future spec, not fixed module-by-module. |
| **Concurrency / double-submit** | No unique business key exists for an event (unlike `ir_number` or `serial_no`), so two simultaneous filings of "the same" event legitimately create two rows — HR merges duplicates manually, same posture as `incident_report`'s filing intake. The create modal should disable its submit button while the request is in flight (frontend-only guard, no backend lock needed). |
| **Idempotency on retries** | Filing is not idempotent by nature (a replayed `POST` creates a second row) — accepted, same reasoning as `incident_report`. Delete is idempotent in effect: a replayed `DELETE` against an already-deleted id returns `404`, not a `500` or a duplicate side effect. |
| **Error response shape & status codes** | Validation `422 {message, errors: {<field>: [...]}}` (Laravel default). Not found `404 {message: 'Event not found.'}`. Any other domain failure `400 {message: <exception message>}`. Unauthenticated `401` as above. The previous silent-`200`-no-op path is eliminated (AC-10). |
| **Input validation boundaries** | `title`: absent/empty on create → `422` (was previously accepted as a no-op); 256 chars → `422`; 255 → accepted. `start_date`: absent on create → `422`; malformed date → `422`. `end_date`: before `start_date` → `422`; null → accepted. `location`/`organizer`: 256 chars → `422`. `file`: wrong mime or > 2048 KB → `422`; absent → accepted. |

---

## 7. Build Order

1. **Migration** — `database/migrations/table/company_events/..._create_activity_event_table.php`, guarded, matching the live schema. Verify AC-1, AC-2.
2. **Backend** — `StoreActivityEventRequest` conditional-required edit; the three `Handlers`; thin out the controller; route rename (or not, per Decision 5). Verify AC-5 → AC-19.
3. **Frontend Gate 1 (static)** — new `utils/company_events.utils.ts`, rewritten `types/`, wire the composable's missing exports against hard-coded data so the page actually renders (closes G2). User validates the design here (visually unchanged, but now functional).
4. **Frontend Gate 2 (live)** — swap in the real API calls under the (possibly renamed) endpoint; wire `formErrors`. Verify AC-3, AC-4, AC-20 → AC-22.
5. **Verify** — `/webkit.verify` against this spec, then `/webkit.code-review` on the branch diff.

---

## 8. Out of Scope (Future Specs)

- **`seened_by` / read-receipts** — deciding what "seen" should mean (per-employee acknowledgement?) and building it is its own spec; for now the column stays unused rather than repurposed without a stated requirement.
- **Attachment cleanup on delete** — removing the physical file from `public/assets/documents/activity_events/` when the row is deleted.
- **Employee-portal calendar / dedicated view** — while events now cross-post to the Employee Announcements feed (`announcements` table), a full interactive calendar view in the employee portal remains a separate spec.
- **Portal-wide backend authorization guard** — same system-wide gap named in `incident_report`'s spec; not solved per-module.
- **Recurring events / reminders / notifications**.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-22)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed
- [ ] `grep -rn "activity_event" database/migrations` returns the new migration file
- [ ] `grep -rn "deleted position" app/Http/Controllers/hr/ActivityorEventController.php` returns nothing
- [ ] The Company Events page renders event cards with zero console errors on a fresh checkout
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/hr-company_events-verify-<date>.md`
