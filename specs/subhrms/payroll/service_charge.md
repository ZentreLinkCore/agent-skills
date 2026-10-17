# Spec — Service Charge (payroll entries)

> **Kind:** Greenfield (page is a 4-line placeholder; no backend yet).
> **Portal:** Payroll. **Route:** `payroll/service-charges` (`payroll_service_charges`) — already registered → [service_charges/ServiceCharges.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/service_charges/ServiceCharges.vue).
> **Builds on the shared `payroll_entry` table** ([batch_entries.md](./batch_entries.md) §3a).
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md).

---

## 1. Purpose

**Service Charge** distributes a collected service-charge **pool** for a pay period across eligible employees (typically hospitality/F&B), per the statutory equal-sharing rule or a points/hours weighting. Each employee's computed share becomes a `payroll_entry` **earning** that Payroll Processing adds to gross pay.

Hub description: *"Distribute and allocate collected service charges across eligible employees."*

Eligibility comes from `accountjob.sc_stat` (`1` = service-charge active — see [timesheet_summary.md](./timesheet_summary.md) §3b).

---

## 2. Data Flow

```text
Pool amount for period + method  ──► distribute across eligible employees (accountjob.sc_stat = 1)
  payroll_service_charge                     │  share_i = pool × (weight_i / Σ weight)  (or pool / headcount)
                                             ▼
                                   payroll_entry (kind='earning', source='service_charge')
                                             ▼
                                   Payroll Processing → gross earnings
```

---

## 3. Persistence — `payroll_service_charge` (pool header)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | int, indexed | → `payroll_period.id` |
| `idtranstype` | int nullable | earning transaction type to post under |
| `pool_amount` | decimal(14,2) | total collected pool |
| `method` | string | `equal` \| `points` \| `hours` |
| `total_weight` | decimal(12,2) | Σ points/hours (for `equal`, = headcount) |
| `headcount` | int | eligible employees |
| `status` | tinyint default 0 | `0` Draft / `1` Distributed |
| `created_by` | int nullable | |
| `timestamps` | | |

Per-employee shares are the produced **`payroll_entry`** rows (`source='service_charge'`, `source_ref=pool.id`). Optionally keep a `payroll_service_charge_share` child (idacct, weight, share_amount) for auditability; otherwise the `payroll_entry` rows are the record.

---

## 4. Backend (Domain pattern)

Routes (inside `Route::prefix('payroll')`):
```php
Route::get('/service-charges',              [PayrollEntriesController::class, 'scIndex']);      // pools + eligible preview
Route::post('/service-charges/preview',     [PayrollEntriesController::class, 'scPreview']);    // compute shares (no write)
Route::post('/service-charges/distribute',  [PayrollEntriesController::class, 'scDistribute']); // create payroll_entry rows
Route::delete('/service-charges/{id}',      [PayrollEntriesController::class, 'scDestroy']);
```

- `GetServiceChargeEligibleQuery` — eligible employees for the period (`accountjob.sc_stat = 1`, active), with their weight (points/hours) for the chosen method; returns the computed per-employee share for **preview**.
- `DistributeServiceChargeHandler` — in `DB::transaction`: create/lock the `payroll_service_charge` header, compute `share_i = round(pool × weight_i / total_weight, 2)` (or `pool / headcount` for `equal`), create one earning `payroll_entry` per employee (`source='service_charge'`). Reconcile rounding remainder to the largest share so `Σ shares == pool`. Block if `pay_process_status = 1`.
- Thin controller, `try/catch`, JSON. No API Resources.

---

## 5. Frontend Design

TS module: `ServiceCharges.vue` + `api/service_charges.api.ts` + `composables/useServiceCharges.ts` + `types/types.service_charges.ts` + `components/{ServiceChargePoolForm, EligibleSharePreviewTable, ServiceChargeListTable}.vue`.

- **Pool form** — period select, `pool_amount`, `method` (Equal / Points / Hours), transaction type. On change → call `scPreview`.
- **Eligible + share preview** — table of eligible employees with weight and computed share (`formatCurrency`), plus a totals row that must equal the pool (show the reconciled remainder). Global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`.
- **Distribute** — confirm → `scDistribute`; toast, refresh; disabled for closed periods.
- **Pool list** — past pools for the period (amount, method, headcount, status, delete).
- Amber accent option (per the hub's service-charge color) or payroll cyan — match the portal; valid Tailwind tokens, dark mode.

---

## 6. Edge Cases, Testing & Build Order

- **Rounding:** `Σ shares` must equal `pool_amount` exactly — reconcile the centavo remainder.
- **No eligible employees / zero weight:** disable distribute; clear empty state.
- **Re-distribute:** deleting a pool should remove its `payroll_entry` rows (cascade) before recomputing; block if the period is closed.
- **Eligibility source:** `accountjob.sc_stat` — never hardcode the eligible set.
- **Testing:** PHPUnit — equal vs points distribution, rounding reconciliation to pool, eligibility filter, closed-period block, cascade delete. Vitest — pool form → preview → distribute.
- **Build order (design-first):** Gate 1 hard-coded design (pool form + share preview + list) → Gate 2 `payroll_service_charge` table/model + queries/handler + routes, swap api to live. Depends on `payroll_entry` ([batch_entries.md](./batch_entries.md)) + `accountjob.sc_stat`.
