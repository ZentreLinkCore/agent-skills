# Investigation Report: Empty Periods in Payroll Processing

## 1. Summary

- **Investigation Type**: Bug
- **Target Portal & Module**: Payroll / Payroll Processing
- **Confidence Level**: High

## 2. Issue Description

- **Expected Behavior**: The user should be able to select any active closed timekeeping period (where `tk_process_status == 1` and `pay_process_status == 0`) from the dropdown on the payroll processing page, allowing them to initiate payroll calculations.
- **Actual Behavior**: The periods dropdown is empty, and the UI displays `[]` for periods, preventing any payroll processing for newly closed timekeeping periods.
- **Steps to Reproduce**:
  1. Lock/close a timekeeping cutoff period (so `tk_process_status = 1` in `payroll_period` table).
  2. Navigate to the Payroll processing workspace (`/payroll/regular-cycle`).
  3. Try to select the cutoff period from the dropdown filter. It is empty.

## 3. Root Cause Analysis

- **Symptom**: The periods dropdown is empty, showing no selectable cutoff periods.
- **Discovered Code/Behavior**:
  - The frontend page [RegularCycle.vue](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue) calls `fetchPeriods()` in [usePayrollProcessing.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/payroll_processing/composables/usePayrollProcessing.ts#L88-L96).
  - This calls the API route `api/payroll/payroll-closing/periods` mapping to [PayrollClosingController@periods](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Http/Controllers/payroll/PayrollClosingController.php#L34-L42).
  - The controller delegates to [GetPayrollClosingPeriodsQuery](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Domain/Queries/Payroll/GetPayrollClosingPeriodsQuery.php).
- **Evidence**:
  In [GetPayrollClosingPeriodsQuery.php:L42-L46](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Domain/Queries/Payroll/GetPayrollClosingPeriodsQuery.php#L42-L46):

  ```php
  ->whereIn('id', function($q) {
      $q->select('idpayperiod')
        ->from('payroll_run')
        ->where('cycle', 'regular');
  })
  ```

  This clause filters periods to only those that already have an existing regular `payroll_run` record.
- **Root Cause**:
  A regular `payroll_run` record is only created *on-demand* when the payroll calculations are processed for the first time in [ProcessPayrollHandler.php:L99-L103](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Domain/Handlers/Payroll/ProcessPayrollHandler.php#L99-L103).
  This creates a **circular dependency**:
  1. The user cannot select a period to process payroll because it doesn't have a `payroll_run` record yet.
  2. The `payroll_run` record doesn't exist because the user hasn't been able to select the period to process it.

## 4. Scope & Dependencies

- **Affected Files**:
  - [GetPayrollClosingPeriodsQuery.php](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Domain/Queries/Payroll/GetPayrollClosingPeriodsQuery.php)
- **Affected Database Tables / Models**:
  - None (no database modifications required).
- **Affected API Endpoints / UI Views**:
  - `api/payroll/payroll-closing/periods` (used by payroll processing, closing, summary report, register report, and payslips).

## 5. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
| --- | --- | --- | --- | --- |
| Option A (Recommended) | Make the `payroll_run` filter conditional. Only apply the `whereIn` filter if `only_processed` is passed in the request or if `all_years` is set. | - Resolves the issue elegantly. - Fully backward-compatible. - Reports and payslips remain restricted to processed periods, while processing and closing workspaces can see all periods. | - Requires passing a parameter from reports if they do not want unprocessed periods (though reports already pass `all_years: 1`). | Low |
| Option B | Auto-insert `payroll_run` headers when timekeeping closes. | - Keeps the query filters simple. | - High complexity. - Creates database pollution if periods are never processed. - Intersecting multiple sub-modules. | Medium |

### Recommended Solution Rationale

Option A is superior as it isolates the fix to a single query parameter check, aligning with existing client-side filters (e.g. `usePayrollProcessing.ts` filters for closed timekeeping, and `usePayrollPayslip.ts` filters for finalized payroll).

## 6. Risk Assessment

- **Breaking Changes**: No
- **Regression Potential**: Very low. We ensure that report queries (which pass `all_years: 1`) still apply the `whereIn` restriction.
- **Deployment & Migration Notes**: None.

## 7. High-Level Implementation Plan

1. `[x]` Modify [GetPayrollClosingPeriodsQuery.php](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Domain/Queries/Payroll/GetPayrollClosingPeriodsQuery.php) to conditionally apply the `whereIn` filter on `payroll_run` based on `only_processed` or `all_years`.

### Testing & Verification Checklist

- [x] Verify that `api/payroll/payroll-closing/periods` returns newly closed timekeeping periods that have no `payroll_run` records yet when called without query filters.
- [x] Verify that `api/payroll/payroll-closing/periods?all_years=1` still filters and returns only periods with existing `payroll_run` records.

## 8. Resolution

- **Date**: 2026-07-15
- **Changes**:
  - Refactored `GetPayrollClosingPeriodsQuery.php` with explicit filter parameters (`only_finalized`, `for_closing`, `for_processing`) to precisely control period query scopes across distinct pages.
  - Configured the **Payroll Closing** page via [payroll_closing.api.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/payroll_closing/api/payroll_closing.api.ts) to pass `for_closing: 1`, returning only the single active period that has been processed by both timekeeping and payroll.
  - Configured **Payroll Summary** and **Payroll Register** report pages to pass `only_finalized: 1` and `all_years: 1` in [payroll_summary.api.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/reports/pages/payroll_reports/payroll_summary/api/payroll_summary.api.ts) and [payroll_register.api.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/reports/pages/prooflist/payroll_register/api/payroll_register.api.ts) to display all periods where `pay_process_status = 1`.
  - Configured the **Payslip** page to pass `only_finalized: 1` in [payslip.api.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/reports/pages/payroll_reports/payslip/api/payslip.api.ts) to filter year-scoped finalized periods. Added a year selector `<c-select>` component in [Payslip.vue](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/reports/pages/payroll_reports/payslip/Payslip.vue) and wired year reactive states in [usePayrollPayslip.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/web/src/module/payroll/reports/pages/payroll_reports/payslip/composables/usePayrollPayslip.ts).
