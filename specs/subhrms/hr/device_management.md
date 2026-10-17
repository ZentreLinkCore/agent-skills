# Spec — Device Management (HR)

> **Kind:** Extension / rework of an existing module — `biometric_devices` table, `BiometricDevice` model, `GetBiometricDeviceQuery`, `DeviceManagementController` and the `hr/device_management` frontend module all exist. This spec adds the create/update/delete lifecycle the module's name and its already-present (but dead) frontend API stubs imply, and fixes the endpoint mismatch that makes the page's own `api` layer unusable.
> **Portal:** **HR** (`/api/hr/device-management...`; `resources/views/web/src/module/hr/device_management/` frontend module).
> **Version:** v1 — 2026-08-21 — initial.
> **Route:** `hr/device-management` (`hr_device_management`) — unchanged.
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md), [ui-design](../../../rules/conditional/ui-design.md), [vue-standards](../../../rules/conditional/frontend-vue.md), [duplicate-prevention](../../../rules/conditional/system-awareness.md), [performance](../../../rules/conditional/performance.md).
> **System Awareness:** Model **reused** `BiometricDevice` (table `biometric_devices`); no new model. Table **reused** `biometric_devices`; no schema change. Route **reused** `GET /api/hr/device-management`; routes **created** `store`/`update`/`destroy` on the same resource, replacing the frontend's calls to three endpoints (`api/hr/biometrics`, `api/hr/biometrics/save`, `api/hr/biometrics/delete/{id}`) that do not exist anywhere in the routes files. Query **reused** `App\Queries\Biometric\GetBiometricDeviceQuery`. New migration: **yes** — one, to move the seed rows out of the existing `CREATE TABLE` migration into a seeder (same defect class as `incident_report`'s Decision 4).

---

## 1. Purpose

Device Management is HR's inventory of the physical biometric/access devices installed at each company location (entrances, gates, server rooms, etc.) — where each one is, its serial number, and whether it is currently online or offline.

**This is a distinct system from user biometric login.** A scan of the codebase turns up two unrelated things both called "biometric":

| | `biometric_devices` (this module) | `user_biometric_devices` (unrelated) |
|---|---|---|
| What it is | A facility's physical attendance/access hardware inventory | A personal record of a user's phone/browser registered for biometric **login** |
| Model | `BiometricDevice` | `UserBiometricDevice` |
| Key columns | `location`, `serial_no`, `status` (online/offline) | `user_id`, `device_id`, `device_platform`, `biometric_type` |
| Controller | `hr\DeviceManagementController` | `BiometricController` (top-level, public + Sanctum) |
| Consumed by | This HR page only | Login flow (`/api/biometric/*`) |

The frontend module's own `api/device_management.api.ts` calls `api/hr/biometrics`, `api/hr/biometrics/save`, `api/hr/biometrics/delete/{id}` — endpoints that exist **nowhere** in `routes/api.php` or any `routes/api/*.php` file. The only registered route is `GET /api/hr/device-management`. This spec fixes that mismatch and, per Decision 1, decides what the module's write path should actually be.

Verified deviations against the real system:

| # | Deviation | Evidence | System convention it breaks |
|---|---|---|---|
| G1 | **The frontend calls three endpoints that do not exist.** `getDevices → api/hr/biometrics`, `saveDevice → api/hr/biometrics/save`, `deleteDevice → api/hr/biometrics/delete/{id}`. | [device_management.api.ts](../../../../resources/views/web/src/module/hr/device_management/api/device_management.api.ts) vs. [routes/api/hr.php:145-146](../../../../routes/api/hr.php#L145-L146) (only `GET /device-management` is registered) | Every API service file must call a route that is actually registered — this one silently 404s if `saveDevice`/`deleteDevice` were ever invoked. |
| G2 | **No UI path ever calls `saveDevice`/`deleteDevice`.** Neither `DeviceManagementToolbar.vue` nor `DeviceManagementTable.vue` has an "Add Device" button or a row-level edit/delete action. | [DeviceManagementToolbar.vue](../../../../resources/views/web/src/module/hr/device_management/components/DeviceManagementToolbar.vue), [DeviceManagementTable.vue](../../../../resources/views/web/src/module/hr/device_management/components/DeviceManagementTable.vue) | The module is named "Device **Management**" and its own API layer was scaffolded assuming CRUD, but the shipped UI is monitoring-only — a naming/scope mismatch this spec's Decision 1 resolves. |
| G3 | **The migration seeds 10 mock devices directly in `up()`.** `DB::table('biometric_devices')->insert($mockDevices)` inside the `Schema::hasTable` guard. | [2026_06_20_000001_create_biometric_devices_table.php](../../../../database/migrations/table/device_management/2026_06_20_000001_create_biometric_devices_table.php) | Same defect class as `incident_report`'s G1: demo rows reach every `migrate` run, can't be skipped or re-run, and aren't managed through `database/seeders/`. |
| G4 | **`last_update` can never change.** With no write endpoint, every device is frozen at its seeded timestamp forever — there is no device heartbeat/check-in mechanism anywhere in this codebase (`BiometricDevice`/`biometric_devices` is never referenced from `AttendanceController` or any attendance-import code). | Repo-wide `grep` for `BiometricDevice` outside this module's own files | A "Last Update" column that can never update is misleading — it needs either a manual write path (this spec) or an explicit "static seed data" label until a real integration exists. |
| G5 | **Stats are three separate `COUNT(*)` queries per request** (`total`, `online`, `offline`) instead of one grouped aggregate. | [DeviceManagementController.php:22-27](../../../../app/Http/Controllers/hr/DeviceManagementController.php#L22-L27) | [performance](../../../rules/conditional/performance.md) — the same pattern `incident_report`'s G13 flagged. |
| G6 | **Types are stubs.** `DeviceManagementItem { [key: string]: any }`. | [types.device_management.ts](../../../../resources/views/web/src/module/hr/device_management/types/types.device_management.ts) | Same defect class as the other two HR modules audited alongside this one. |

**What this spec does not change:** the visual design (stat header, teal accent, drag-scroll table, print/Excel/PDF export via client-side table scraping). Those already work and conform to [ui-design](../../../rules/conditional/ui-design.md); the work here is the write path, the endpoint fix, and the seed cleanup.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Should "Device Management" get create/edit/delete, or is it read-only monitoring?

This is the load-bearing decision the rest of the spec depends on, and it is genuinely a product call, not a technical default — the module's *name* and its already-scaffolded (but dead) `saveDevice`/`deleteDevice` API methods point one way; the shipped UI (no add/edit/delete control anywhere) points the other.

**Option A — Add full CRUD: register, edit, remove a device (Recommended)**
- HR can add a newly installed device (location + serial number), edit its location/serial/status, and remove a decommissioned one. `status` is a manual HR-set field (online/offline), since nothing in this codebase reports a real device heartbeat (G4) — editing a device's status is how HR marks it offline after physically checking.

| Pros | Cons |
|---|---|
| Matches the module's name and its pre-existing (currently dead) API stubs — this is clearly what was intended | Manual status is not a real health check — it can go stale between HR's manual reviews (same limitation as today, just now editable instead of frozen) |
| A device inventory that can only grow via a raw DB insert is not viable for HR to operate | |
| Closes G1/G2 completely — the dead code becomes live code instead of being deleted | |

**Option B — Keep it read-only; delete the dead `saveDevice`/`deleteDevice` frontend stubs**
| Pros | Cons |
|---|---|
| Smaller change — fixes only the `getDevices` endpoint | The module stays permanently unable to reflect newly installed or removed hardware without a manual DB edit — a real operational gap for an HR device inventory |
| Honest about current scope | Wastes the frontend groundwork already in place (form-shaped api methods, `types` slot for it) |

**Recommendation: Option A.** The rest of this spec is written against Option A; if the user prefers Option B, skip §3's write path and use only §4e's `index` fix plus §7 step 1 (seed cleanup).

---

### Decision 2: Route and response shape for the new write endpoints

**Option A — Extend the existing resource with `apiResource(...)->only(['index','store','update','destroy'])`, matching `position`/`incident-reports` (Recommended)**
```php
Route::apiResource('device-management', DeviceManagementController::class)->only([
    'index', 'store', 'update', 'destroy'
]);
```
- `store`/`update`/`destroy` return `{message}`; failures return `{message}` with `422`/`404`/`400`, dropping the ad-hoc `/save`/`/delete/{id}` shape the frontend (incorrectly) assumed.

| Pros | Cons |
|---|---|
| Identical shape to the two most recently redesigned HR modules | The frontend `api` file's `saveDevice`/`deleteDevice` method names/URLs must change in the same commit — but they were already calling nonexistent endpoints, so nothing is actually broken by the change |
| One resource name (`device-management`) for all four verbs, no scattered custom routes | |

**Option B — Fix the URLs to literally match what the frontend already expects (`/hr/biometrics`, `/hr/biometrics/save`, `/hr/biometrics/delete/{id}`)**
| Pros | Cons |
|---|---|
| Zero frontend `api.ts` changes | Reuses the "biometrics" name that is already ambiguous with the unrelated `BiometricController`/`UserBiometricDevice` system (see §1 table) — perpetuates G-table confusion for the next person who greps "biometric" |
| | Off-convention `/save`, `/delete/{id}` shape that the rest of the portal has moved away from |

**Recommendation: Option A** — it costs a one-line frontend `api.ts` edit and removes a real naming collision risk.

---

### Decision 3: Cleaning up the migration-embedded seed data

**Option A — Move the 10 mock devices into `Database\Seeders\Biometric\BiometricDeviceSeeder`, registered in `DatabaseSeeder` (Recommended)**
| Pros | Cons |
|---|---|
| Matches the repo-wide seeder convention (`DisciplinaryActionSeeder`, etc.) and `incident_report`'s Decision 4 | Two files touched instead of one |
| Demo devices stop reaching every `migrate` run on every environment; re-runnable | |

**Option B — Delete the demo rows entirely**
| Pros | Cons |
|---|---|
| Cleanest production posture | Empty module in every dev/demo environment with nothing to click through until HR adds a device |

**Option C — Leave them in the migration (status quo)**
| Pros | Cons |
|---|---|
| No work | The exact defect class flagged in `incident_report` — reproduced here |

**Recommendation: Option A**, and delete the `insert()` block from the original migration file (it only ever ran inside the `Schema::hasTable` guard, so removing it changes nothing for environments that already migrated).

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A fresh database | `php artisan migrate` runs with no seeders | `biometric_devices` contains **0 rows** — no demo data comes from any migration |
| AC-2 | A fresh, migrated database | `php artisan db:seed` runs | `biometric_devices` contains **10 rows**, and `BiometricDeviceSeeder` appears in `DatabaseSeeder::run()`'s `$this->call([...])` |
| AC-3 | Authenticated HR user, 10 devices seeded (6 online, 4 offline) | `GET /api/hr/device-management` | `200` with `{devices: <paginator>, stats: {total: 10, online: 6, offline: 4}}`, and `stats` is produced by **one** grouped aggregate query, not three `COUNT(*)` calls (closes G5) |
| AC-4 | Same | `GET /api/hr/device-management?status=online` | Only the 6 online devices are returned in `devices.data`; `stats` still reflects the whole table (unfiltered banner, matching the `incident_report` precedent) |
| AC-5 | A device at "Warehouse Gate A" | `GET /api/hr/device-management?search=warehouse` | That device is returned; search matches `location` and `serial_no` |
| AC-6 | Authenticated HR user | `POST /api/hr/device-management` with `{location: 'Rooftop Access', serial_no: 'ROOF-0099', status: 'online'}` | `200` `{message: 'Device registered successfully.'}`; one new `biometric_devices` row with `last_update = now()`; a `translog` row logging the registration |
| AC-7 | `serial_no = 'ROOF-0099'` already exists | `POST /api/hr/device-management` with the same `serial_no` | `422` `{errors: {serial_no: [...]}}` — the existing DB `unique()` index is respected at the validation layer, not surfaced as a raw `500` from a constraint violation |
| AC-8 | A filing payload | `location` or `serial_no` is `''`, absent, or 256+ characters | `422`, with the offending field in `errors`; no row created |
| AC-9 | A filing payload | `status` is `'unknown'` (not `online`/`offline`) | `422` `{errors: {status: [...]}}` |
| AC-10 | An existing device with id `3` | `PUT /api/hr/device-management/3` with `{status: 'offline'}` | `200` `{message: 'Device updated successfully.'}`; `status = 'offline'`, `last_update = now()`; other fields unchanged; a `translog` row records the change |
| AC-11 | An existing device with id `3`, `serial_no = 'A'` | `PUT /api/hr/device-management/3` with `{serial_no: 'A'}` (unchanged value) | `200` — updating a device to its own current `serial_no` does not trip the uniqueness check against itself |
| AC-12 | Device `3` has `serial_no = 'A'`; device `4` has `serial_no = 'B'` | `PUT /api/hr/device-management/3` with `{serial_no: 'B'}` | `422` `{errors: {serial_no: [...]}}` — cannot take another device's serial number |
| AC-13 | An existing device with id `3` | `DELETE /api/hr/device-management/3` | `200` `{message: 'Device removed successfully.'}`; the row is gone; a subsequent `GET /device-management` shows `stats.total` decremented by 1 |
| AC-14 | Device id `3` was just deleted | `DELETE /api/hr/device-management/3` again | `404` `{message: 'Device not found.'}` — not a `500`, not a silent no-op |
| AC-15 | Any device id that does not exist | `GET`/`PUT`/`DELETE` against `/api/hr/device-management/9999` | `404` `{message: 'Device not found.'}` |
| AC-16 | Two `POST` requests for the same new `serial_no` fire simultaneously | Both run to completion | Exactly one returns `200`; the other returns `422` (the unique index catch), never a raw `500` |
| AC-17 | An unauthenticated request | Any `/api/hr/device-management*` call | `401` `{status: 401, message: 'Unauthenticated.'}`, matching every other HR endpoint |
| AC-18 | `entries=all` | `GET /api/hr/device-management?entries=all` | Returns the full unpaginated list — the existing `GetBiometricDeviceQuery` behaviour is preserved unchanged |
| AC-19 | The frontend module | Type-checking / build | `types.device_management.ts` declares `DeviceItem`, `DeviceStats`, `Paginator<T>`, `DeviceForm` with no `[key: string]: any` |
| AC-20 | `device_management.api.ts` | Grepped after the change | Calls `api/hr/device-management` (GET/POST/PUT/DELETE) — no reference to `api/hr/biometrics` remains anywhere in `resources/views/web/src` |

---

## 3. Database

### 3a. `biometric_devices` — **reused**, no schema change

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `location` | string, indexed | required, ≤ 255 |
| `serial_no` | string, unique, indexed | required, ≤ 255; DB-level `unique()` already exists — validated at the request layer too (AC-7) so a collision is a clean `422`, not a raw constraint-violation `500` |
| `status` | string, indexed, default `online` | `online` \| `offline` — manually set (Decision 1); no automatic heartbeat exists in this codebase |
| `last_update` | timestamp nullable | set to `now()` by the handler on every create/update — represents "last time HR touched this record," not a device-reported heartbeat (documented in §6a to avoid future confusion, per G4) |
| `timestamps` | | |

No columns added or dropped. **No DB-level foreign keys** — SubHRMS convention; none are needed here regardless.

### 3b. Migration

New `database/migrations/table/device_management/<YYYY_MM_DD_NNNNNN>_seed_biometric_devices.php`... **is not needed** — seeding moves entirely to a seeder (Decision 3), not another migration. **Edit** the existing `2026_06_20_000001_create_biometric_devices_table.php` to delete its `$mockDevices` array and `insert()` call; the `Schema::create` block stays exactly as-is (no shape change).

### 3c. Seeder

`database/seeders/Biometric/BiometricDeviceSeeder.php`, namespace `Database\Seeders\Biometric`, class extends `Seeder` — same shape as `Database\Seeders\DisciplinaryAction\DisciplinaryActionSeeder`. Registers in `DatabaseSeeder::run()`'s `$this->call([...])`. Carries the same 10 devices already in the migration (they're reasonable demo data).

---

## 4. Backend

### 4a. Models

- **`App\Models\BiometricDevice`** — *reuse as-is*. `$fillable` already covers `location`, `serial_no`, `status`, `last_update`; no change needed.

### 4b. Queries — `App\Queries\Biometric\`

- **`GetBiometricDeviceQuery`** — *reuse unchanged*. Already handles `status`, `search`, `entries` correctly (confirmed against the frontend's expected `{devices: {data, total, last_page}}` / `{devices: [...]}` shapes).
- **`GetBiometricDeviceStatsQuery`** — *new*: one `selectRaw` grouped aggregate producing `{total, online, offline}`, replacing the three `COUNT(*)` calls in the controller (closes G5, AC-3).

### 4c. Handlers — `App\Handlers\Biometric\`

All `extends App\Handlers\Handler`, static `execute($params = [])`, wrapped in `DB::transaction`:

| Handler | Responsibility |
|---|---|
| `RegisterBiometricDeviceHandler` | Validate uniqueness (defensive check in addition to the DB index; catch the DB unique-violation as a fallback for the race case in AC-16), create the row with `last_update = now()`, write a `translog` entry. |
| `UpdateBiometricDeviceHandler` | Validate uniqueness excluding the current row's own id (AC-11/AC-12), apply the update with `last_update = now()`, write a `translog` entry with the changed fields. |
| `RemoveBiometricDeviceHandler` | Delete the row; write a `translog` entry naming the device's location/serial for the audit trail. |

### 4d. Controller — `app/Http/Controllers/hr/DeviceManagementController.php` (*reuse `index`, add three methods*)

Each new method: validate → delegate to a Handler → `TransLog::logAction(..., 'HR Access', $request, <0|1|2>)` → `response()->json(['message' => ...])`, inside `try/catch` returning `{message}` with the right status (`422` validation, `404` not found, `400` other).

| Method | Route | Returns |
|---|---|---|
| `index` | `GET /api/hr/device-management` | `{devices: <paginator>, stats: {...}}` (unchanged — now via `GetBiometricDeviceStatsQuery`) |
| `store` | `POST /api/hr/device-management` | `{message: 'Device registered successfully.'}` |
| `update` | `PUT /api/hr/device-management/{id}` | `{message: 'Device updated successfully.'}` |
| `destroy` | `DELETE /api/hr/device-management/{id}` | `{message: 'Device removed successfully.'}` |

Validation rules (`store`): `location` `required|string|max:255`; `serial_no` `required|string|max:255|unique:biometric_devices,serial_no`; `status` `required|in:online,offline`. `update`: same, with `unique:biometric_devices,serial_no,{id}` to exclude the current row.

### 4e. Routes — `routes/api/hr.php`

Replace lines 145-146:
```php
// Device Management
Route::apiResource('device-management', DeviceManagementController::class)->only([
    'index', 'store', 'update', 'destroy'
]);
```
The existing `use App\Http\Controllers\hr\DeviceManagementController;` import stays. Auth inherited from `auth:sanctum` + `prefix('hr')`, matching the rest of the portal.

---

## 5. Frontend

Module stays at `resources/views/web/src/module/hr/device_management/` — the folder layout is already correct.

```
device_management/
├── index.ts                                    # edit — types only from types/
├── api/device_management.api.ts               # edit — correct endpoints, split save→create/update
├── composables/useDeviceManagement.ts          # edit — add/edit/delete actions + modal state + form errors
├── pages/DeviceManagement.vue                  # edit — wire the new modal + row actions
├── types/types.device_management.ts            # rewrite — real interfaces
└── components/
    ├── DeviceManagementHeader.vue               # keep — stats strip
    ├── DeviceManagementToolbar.vue               # edit — add an "Add Device" button
    ├── DeviceManagementTable.vue                 # edit — add Edit/Delete row actions
    ├── DeviceManagementPagination.vue             # keep
    └── DeviceFormModal.vue                        # new — create/edit form (location, serial_no, status)
```

### 5a. Types (`types/types.device_management.ts`) — full rewrite

`DeviceStatus = 'online' | 'offline'`; `DeviceItem { id, location, serial_no, serialNo, status: DeviceStatus, last_update, lastUpdate }` (both snake/camel present, matching the model's `$appends`); `DeviceStats { total, online, offline }`; `Paginator<T>`; `DeviceForm { location, serial_no, status }`. **No `[key: string]: any`.**

### 5b. API contract (`api/device_management.api.ts`)

| Method | Call | Response |
|---|---|---|
| `getDevices(params)` | `GET api/hr/device-management` | `{devices, stats}` |
| `createDevice(payload)` | `POST api/hr/device-management` | `{message}` |
| `updateDevice(id, payload)` | `PUT api/hr/device-management/{id}` | `{message}` |
| `deleteDevice(id)` | `DELETE api/hr/device-management/{id}` | `{message}` |

`saveDevice` is split into `createDevice`/`updateDevice` (matching `position.api.ts`'s pattern of separate `post`/`put` methods rather than one overloaded save).

### 5c. Composable (`composables/useDeviceManagement.ts`)

Added: `isFormModalOpen`, `editingDevice`, `form = ref<DeviceForm>({...})`, `formErrors = ref<Record<string,string[]>>({})`; `openCreateModal()`, `openEditModal(device)`, `closeFormModal()`, `saveDevice()` (calls `createDevice` or `updateDevice` depending on `editingDevice`), `removeDevice(id)` (with a confirm step, matching `company_events`'s `Swal.fire` confirm-before-delete pattern). Existing pagination/filter/export logic is unchanged.

### 5d. Layout sketch (new controls only; existing layout otherwise unchanged)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Device Management                                                    │  Header (existing)
│  Total 10 · Online 6 · Offline 4                                       │  stats strip — from stats{}
├──────────────────────────────────────────────────────────────────────┤
│ [search…] [All|Online|Offline] [10 ▾] [Print][Excel][PDF] [+ Add Dev.]│  Toolbar — "Add Device" is new
├──────────────────────────────────────────────────────────────────────┤
│ Location            Serial No.       Last Update      Status   Actions│  new Actions column
│ Rooftop Access       ROOF-0099       Aug 21, 2026      Online   ✎ 🗑  │
├──────────────────────────────────────────────────────────────────────┤
│                          Showing 1-10 of 10   ‹ 1 ›                  │
└──────────────────────────────────────────────────────────────────────┘
DeviceFormModal (create/edit): Location · Serial No. · Status (online/offline toggle)
```

---

## 6. Business Rules & Edge Cases

### 6a. Domain rules

1. **`status` is manually set by HR**, not derived from a device heartbeat — no such integration exists anywhere in this codebase (G4). Documented here so it is not mistaken for a real health check later.
2. **`last_update` reflects the last HR edit**, not a device check-in — same reasoning as rule 1.
3. **`serial_no` is globally unique** across all devices, enforced at both the DB index and the request-validation layer.
4. **Every mutation writes `translog`** with `module = 'HR Access'`.
5. **`stats` are whole-table, not filter-scoped** — matching the `incident_report` precedent; filtering the list by status does not move the header counts.
6. **Portal separation**: this module lives entirely in the HR portal; it has no employee/manager-portal counterpart in this spec.

### 6b. Edge cases

| Edge case | Handling |
|---|---|
| Deleting a device that appears in historical attendance/audit data | Not applicable today — `biometric_devices` is not referenced by any attendance table (confirmed by repo-wide grep), so deletion has no downstream dependents to preserve |
| `entries=all` | `GetBiometricDeviceQuery` already returns `->get()`; unchanged |
| Updating only `status`, leaving `location`/`serial_no` untouched | `PUT` accepts a partial payload; unspecified fields keep their current value |
| Race between two simultaneous registrations of the same `serial_no` | The DB unique index is the final guard; the handler catches the resulting `QueryException` (SQLSTATE `23000`) and returns `422` rather than letting it surface as `500` (AC-16) |
| Re-registering a serial number that was previously deleted | Allowed — deletion frees the unique constraint; no soft-delete/`status` column is used for this table (physical devices are genuinely removed from inventory, not disabled) |

### 6c. Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Every endpoint sits in the `auth:sanctum` + `prefix('hr')` group; unauthenticated requests get `401`. No bespoke per-endpoint `hr_portal_access` guard is added here — same system-wide gap named in the `incident_report` spec, not solved module-by-module. |
| **Concurrency / double-submit** | The `serial_no` unique index is the natural double-submit guard for `store` (AC-16). The frontend's `DeviceFormModal` submit button disables while the request is in flight. Update/delete have no cross-request race of consequence — a lost update on `status`/`location` is an acceptable, low-stakes outcome for this entity (not payroll/statutory data). |
| **Idempotency on retries** | `store` is not idempotent (a replayed request with a new payload creates a second device) — acceptable, HR notices a duplicate row visually. `destroy` is idempotent in effect: a replayed `DELETE` against an already-removed id returns `404`, never a `500` or a silent duplicate side effect (AC-14). |
| **Error response shape & status codes** | Validation `422 {message, errors: {<field>: [...]}}`. Not found `404 {message: 'Device not found.'}`. Any other domain failure `400 {message: <exception message>}`. Unauthenticated `401` as above. |
| **Input validation boundaries** | `location`: absent/empty → `422`; 256 chars → `422`; 255 → accepted. `serial_no`: absent/empty → `422`; duplicate (self on update excluded) → `422`; 256 chars → `422`. `status`: absent → `422`; value outside `online`/`offline` → `422`. `entries`: `'all'` or a positive integer; anything else falls back to `10` (existing `GetBiometricDeviceQuery` behaviour). |

---

## 7. Build Order

1. **Migration edit + seeder** — strip `$mockDevices`/`insert()` from the existing migration; add `Database\Seeders\Biometric\BiometricDeviceSeeder`, registered in `DatabaseSeeder`. Verify AC-1, AC-2.
2. **Backend** — `GetBiometricDeviceStatsQuery`; the three `Handlers`; extend the controller with `store`/`update`/`destroy`; the route block replacing lines 145-146. Verify AC-3 → AC-18.
3. **Frontend Gate 1 (static)** — rewrite `types/`, add `DeviceFormModal.vue`, wire the "Add Device" button and row actions against hard-coded data. User validates the design here.
4. **Frontend Gate 2 (live)** — swap the hard-coded methods for the real, corrected API calls (`api/hr/device-management`, split `createDevice`/`updateDevice`). Verify AC-19, AC-20.
5. **Verify** — `/webkit.verify` against this spec, then `/webkit.code-review` on the branch diff.

*(If Decision 1's Option B is chosen instead — read-only monitoring — skip steps 2's write handlers/routes and step 3's `DeviceFormModal`/row actions; keep only the `index`/stats fix and the seeder cleanup, and delete the dead `saveDevice`/`deleteDevice` methods from the frontend `api` file instead of wiring them.)*

---

## 8. Out of Scope (Future Specs)

- **Real device heartbeat/check-in** — an actual integration where the physical biometric hardware reports its own online/offline status and `last_update`, replacing the manual HR toggle. Nothing in this codebase currently talks to that hardware, so this is a genuinely separate integration effort.
- **Bulk device import** — an Excel uploader mirroring `position`'s `uploadPosition`, for onboarding many devices at once.
- **Device usage / audit history** — a per-device timeline of status changes, beyond the flat `translog` entries.
- **Linking devices to the attendance/timekeeping pipeline** — today `biometric_devices` is a pure inventory list with no attendance-import relationship; wiring one is its own spec.
- **Portal-wide backend authorization guard** — same system-wide gap named in the other HR specs; not solved per-module.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-20)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed
- [ ] `grep -rn "api/hr/biometrics" resources/views/web/src` returns nothing
- [ ] No `DB::table('biometric_devices')->insert` remains in `database/migrations/`
- [ ] `BiometricDeviceSeeder` is registered in `DatabaseSeeder::run()`
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/hr-device_management-verify-<date>.md`
