# Spec — Payroll Policy Controls (Admin Settings)

> **Kind:** Greenfield — new admin settings module for payroll behavior toggles.
> **Portal:** **Admin** (`/api/admin/...` routes, `admin` frontend module).
> **Route:** `admin/payroll-settings` (`admin_payroll_settings`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

Different companies have different policies on how retroactive salary adjustments are handled.
This module introduces a **Payroll Policy Control** settings page in the admin area that lets
authorized administrators toggle **system-level behavior** without code changes.

The first and primary toggle is **Retro Pay Mode** — which governs whether backdated salary
adjustments are processed as a **separate retro cycle** (visible tab, manual approval) or
**automatically merged into the regular payroll** (hidden tab, auto-included in basic pay).

---

## 2. The Toggle: Retro Pay Mode

### Option A — Separate (default)

- The **Retro Active** tab is **visible** in Payroll Processing.
- Retro pay is its own `payroll_run` (`cycle='retro'`).
- Payroll officer reviews the affected periods and processes it manually.
- Suitable for companies with strict audit trails, CBA agreements, or BIR compliance needs.

### Option B — Merged (auto-include)

- The **Retro Active** tab is **hidden** from Payroll Processing.
- When regular payroll runs, the handler **detects** any pending backdated `salary_history`
  for each employee and automatically computes the retro differential.
- The differential is added as `adjustments` in the same `payroll_run_detail` row.
- `breakdown_json` still records the per-period detail for auditability, just embedded in
  the regular detail row.
- Suitable for simpler setups where the payroll officer doesn't want an extra step.

---

## 3. Database

### New Table: `payroll_policy_settings`

```sql
id              bigint unsigned PK auto_increment
key             varchar(100)  UNIQUE NOT NULL   -- e.g. 'retro_pay_mode'
value           varchar(255)  NOT NULL          -- e.g. 'separate' | 'merged'
label           varchar(255)  NULL              -- human-readable label for UI
description     text          NULL              -- explanation shown in the UI
updated_by      int unsigned  NULL FK → accounts.id
created_at      timestamp
updated_at      timestamp
```

**Seed defaults:**
```
key='retro_pay_mode', value='separate', label='Retro Pay Mode'
```

Future toggles (not in scope now — reserved keys):
- `mid_period_rate_split` — whether to split the basic pay within a cutoff when a raise
  lands mid-period (Option A: split basic pay; Option B: pay full old rate + retro next)
- `retro_tax_method` — `flat_10_percent` | `supplemental_bracket`

---

## 4. Backend

### Model: `PayrollPolicySetting` (`app/Models/PayrollPolicySetting.php`)
Simple Eloquent model on `payroll_policy_settings`.

### Helper: `PayrollPolicy::get(string $key, $default = null)`
Static helper (`app/Support/PayrollPolicy.php`) that reads from a cached DB lookup (1-hour
cache using `Cache::remember`). Used throughout the payroll handlers.

```php
// Usage in ProcessPayrollHandler:
if (PayrollPolicy::get('retro_pay_mode') === 'merged') {
    // auto-compute and merge retro diff into basic_pay / adjustments
}

// Usage in Payroll Processing nav to toggle tab visibility:
PayrollPolicy::get('retro_pay_mode') === 'separate'
```

### Controller: `PayrollPolicyController` (`app/Http/Controllers/admin/PayrollPolicyController.php`)
- `GET  /api/admin/payroll-settings` — return all settings as key-value map
- `POST /api/admin/payroll-settings` — bulk update, busts cache

### Route Registration (`routes/api/admin.php`)
```php
Route::get('/payroll-settings',  [PayrollPolicyController::class, 'index']);
Route::post('/payroll-settings', [PayrollPolicyController::class, 'update']);
```

### ProcessPayrollHandler modification (when `retro_pay_mode = 'merged'`)
When processing each employee in the regular cycle, after computing `basic_pay`:
1. Query `salary_history` for backdated adjustments effective before `period_start`.
2. For each affected prior cutoff (already paid, not yet retro-compensated), compute
   `retro_diff = (new_daily_rate - old_daily_rate) × days_paid_that_cutoff`.
3. Sum all diffs → `retro_adjustment`.
4. Add to `adjustments` column in `payroll_run_detail`.
5. Record the per-period breakdown in `breakdown_json` under a `retro_breakdown` key.
6. Mark those cutoff periods as retro-compensated (flag or separate tracking record) to
   prevent double-payment on subsequent runs.

---

## 5. Frontend

### Settings Page: `resources/.../module/admin/payroll_settings/pages/PayrollSettings.vue`

Full module path follows admin module convention:
```
module/admin/payroll_settings/
  api/          payroll_settings.api.ts
  composables/  usePayrollSettings.ts
  pages/        PayrollSettings.vue
  route/        payroll_settings.routes.ts
  types/        types.payroll_settings.ts
  index.ts
```

Route file entry:
```ts
// payroll_settings.routes.ts
export default [
  {
    path: 'admin/payroll-settings',
    name: 'admin_payroll_settings',
    component: () => import('@/src/module/admin/payroll_settings/pages/PayrollSettings.vue'),
    meta: { title: 'Payroll Policy Settings' }
  }
];
```

A clean admin settings card layout. Each setting shows:
- **Label** (e.g. "Retro Pay Mode")
- **Description** (paragraph explaining the two options)
- **Toggle / Radio buttons** for the value options
- **Save** button → POST to `/api/admin/payroll-settings`

```
┌─────────────────────────────────────────────────────────┐
│  Payroll Policy Controls                                │
├─────────────────────────────────────────────────────────┤
│  Retro Pay Mode                                         │
│  How backdated salary adjustments are handled.          │
│                                                         │
│  ◉ Separate  — Show Retro Active tab. Payroll officer   │
│                manually reviews and processes retro pay │
│                as its own payroll run (cycle='retro').  │
│                                                         │
│  ○ Merged    — Hide Retro Active tab. Retro differences │
│                are automatically included when running  │
│                the regular payroll cycle.               │
│                                                         │
│                                       [ Save Changes ]  │
└─────────────────────────────────────────────────────────┘
```

### Nav/Tab Visibility (Payroll Portal)

In the Payroll Processing nav (wherever tabs are rendered), read the `retro_pay_mode` setting
from the Admin API on mount:
- `separate` → show Retro Active tab
- `merged` → hide Retro Active tab entirely

```typescript
// composable: usePayrollPolicy.ts  (shared, lives in payroll module or a shared composables dir)
const retroPayMode = ref<'separate' | 'merged'>('separate');

onMounted(async () => {
  const res = await http.get('api/admin/payroll-settings');
  retroPayMode.value = res.data['retro_pay_mode'] ?? 'separate';
});
```

---

## 6. Edge Cases

| Case | Handling |
|---|---|
| Switch from `separate` → `merged` mid-cycle | Existing `retro` run_details remain; merged mode only affects future regular runs |
| Switch from `merged` → `separate` | Retro tab reappears; auto-included adjustments already posted to regular detail stay as-is |
| Employee has both merged-auto-paid retro and a new backdated history | Track compensated periods per employee to avoid double-pay |
| Non-admin tries to change settings | 403 — gate by role/permission check |
| Cache stale after update | `Cache::forget('payroll_policy_settings')` on every POST |

---

## 7. Build Order

1. **Migration** — create `payroll_policy_settings` table + seed default row
2. **Model + Helper** — `PayrollPolicySetting` + `PayrollPolicy::get()`
3. **Controller + Routes** — `GET/POST /api/payroll/policy-settings`
4. **Frontend Gate 1** — `PayrollPolicySettings.vue` (hard-coded state, validate design)
5. **Frontend Gate 2** — wire to live API; add `usePayrollPolicy` composable; apply
   tab visibility in Payroll Processing nav
6. **Handler modification** — add merged-mode retro auto-include in `ProcessPayrollHandler`

---

## 8. Out of Scope (Future Specs)

- `mid_period_rate_split` — splitting basic pay within a single cutoff when a raise lands
  on day 8 of a 15-day period (requires day-level timesheet breakdown)
- `retro_tax_method` — choosing between flat 10% and supplemental bracket for retro tax
- Per-employee override of the global retro mode
