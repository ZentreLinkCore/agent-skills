# Investigation Report: Regular Cycle Page — Multiple Issues

## 1. Summary
- **Investigation Type**: Bug / UI / Missing Feature
- **Target Portal & Module**: Payroll / Payroll Processing / Regular Cycle
- **Confidence Level**: High

---

## 2. Issues Found

### Issue A — Mock Simulation Console Panel Still Present
**Expected**: Only production-relevant UI is shown.  
**Actual**: A cyan `Mock Simulation Console` debug banner with TK Open / Pay Closed toggle checkboxes is still rendered for all users. This is a design-first leftover that must be removed.

> Evidence: [RegularCycle.vue:L35-60](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue#L35-L60) — cyan panel + [RegularCycle.vue:L411-419](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue#L411-L419) — `simulateTkOpen`/`simulatePayClosed` refs and watch

---

### Issue B — Pay Group Filter Missing from UI
**Expected**: Filter bar has a Pay Group `c-select` wired to `selectedPayGroup`/`uniquePayGroups`.  
**Actual**: The composable fully implements `selectedPayGroup`, `uniquePayGroups`, and scoped filtering logic — but the **template never renders a Pay Group dropdown**.

> Evidence: [RegularCycle.vue:L142-171](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue#L142-L171) — filter bar missing paygroup select  
> [usePayrollProcessing.ts:L156-165](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/composables/usePayrollProcessing.ts#L156-L165) — `uniquePayGroups` computed exists but not returned

---

### Issue C — Period Selector Not Rendered
**Expected**: A dropdown to switch cutoff periods is visible in the UI.  
**Actual**: `periodsOptions`, `onPeriodSelect`, and `selectedPeriodId` are fully defined in script but **never connected to any UI element**.

> Evidence: [RegularCycle.vue:L432-455](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue#L432-L455) — dead code, never rendered

---

### Issue D — Pay Group Refs Not Exported from Composable
**Expected**: All pay-group-scoped refs available to the template.  
**Actual**: The composable's `return {}` block is **missing**: `uniquePayGroups`, `selectedPayGroup`, `payGroupEmployees`, `payGroupEligibleIds`, `selectedPayGroupLabel`, `isPayGroupSelected`.

> Evidence: [usePayrollProcessing.ts:L399-434](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/composables/usePayrollProcessing.ts#L399-L434)

---

### Issue E — `handleProcessAll` Ignores Pay Group Scope
**Expected**: "Process All" only dispatches employees within the **selected pay group**.  
**Actual**: It uses `employees.value` (all employees across all groups), bypassing the composable's `payGroupEligibleIds` gate.

> Evidence: [RegularCycle.vue:L519](file:///d:/project/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue#L519)

---

## 3. Root Cause Table

| # | File | Lines | Root Cause |
|---|------|-------|------------|
| A | RegularCycle.vue | 35–60, 411–419 | Design-first mock panel never removed |
| B | RegularCycle.vue | 142–171 | Template missing pay group `c-select` |
| C | RegularCycle.vue | 432–455 | Period selector defined but never rendered |
| D | usePayrollProcessing.ts | 399–434 | `return {}` missing 6 pay-group exports |
| E | RegularCycle.vue | 519 | `employees.value` used instead of `payGroupEligibleIds` |

---

## 4. What Does NOT Need Changes
- **Backend** (`GetPayrollProcessingRosterQuery.php`) — correct; already returns `idpaygrp`, `paygroup` per employee
- **`PayrollProcessingTable.vue`** — no changes needed
- **Routes / Controller** — no changes needed

---

## 5. Implementation Plan

### Step 1 — `usePayrollProcessing.ts`
- Add to `return {}`: `uniquePayGroups`, `selectedPayGroup`, `payGroupEmployees`, `payGroupEligibleIds`, `selectedPayGroupLabel`, `isPayGroupSelected`

### Step 2 — `RegularCycle.vue`
1. Remove lines 35–60 (Mock Simulation Console block + template markup)
2. Remove `simulateTkOpen`/`simulatePayClosed` refs + their watch (lines 411–419)
3. Destructure the 6 new pay-group refs from `store`
4. Add **Pay Group** `c-select` to filter bar (after Department, before Status)
5. Add **Period selector** `c-select` above filters or in filter bar, wired to `periodsOptions`/`onPeriodSelect`
6. Fix `handleProcessAll` to use `payGroupEligibleIds.value` instead of `employees.value.filter(...)`
7. Update `hasActiveFilters` to include `selectedPayGroup.value !== ""`

### Testing & Verification
- [ ] Pay group dropdown renders and filters the table correctly
- [ ] "Process All" only processes employees in the selected pay group
- [ ] Period selector appears and re-fetches roster on selection
- [ ] Mock simulation console is gone
- [ ] Stats cards headcount matches filtered pay group scope

---

## 6. Risk Assessment
- **Breaking Changes**: No
- **Regression Potential**: Low — adds missing UI bindings, no calculation logic changes
- **Deployment Notes**: None
