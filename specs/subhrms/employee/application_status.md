# Spec — Employee Application Status Portal & Sub-Module Reports

> **Kind:** Extension — Redesign and standardize the Employee Application Status portal hub (`ApplicationStatus.vue`) and all 5 individual application status report pages (`LogSheet.vue`, `ChangeShift.vue`, `Overtime.vue`, `OfficialBusinessTrip.vue`, `Leaves.vue`) to align with the visual standards, filter architecture, metrics overview, and layout conventions of the Timekeeping Applications portal (`Applications.vue`).
> **Portal:** **Employee Portal** (`/api/employee/...` routes, `resources/views/web/src/module/employee/application_status` frontend module).
> **Routes:**
> - `/employee/application-status` (`employee_application_status`) — Portal Hub
> - `/employee/application-status/log-sheet` (`employee_application_status_logsheet`) — Log Sheet Status
> - `/employee/application-status/change-shift` (`employee_application_status_change_shift`) — Change Shift Status
> - `/employee/application-status/overtime` (`employee_application_status_overtime`) — Overtime Status
> - `/employee/application-status/official-business-trip` (`employee_application_status_obtrip`) — OBT Status
> - `/employee/application-status/leaves` (`employee_application_status_leaves`) — Leaves Status
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models Reused (`AppAdjustment`, `AppChangeShift`, `AppOvertime`, `AppOfficialBusinessTrip`, `AppLeave`); Tables Reused (`tbl_app_adjustment`, `tbl_app_changeshift`, `tbl_app_overtime`, `tbl_app_obtrip`, `tbl_app_leave`); Routes Reused (`/api/employee/application-status`, `/api/employee/logSheet`, `/api/employee/changeshift`, `/api/employee/overtime`, `/api/employee/obtrip`, `/api/employee/leaves`); New Migration: No.

---

## 1. Purpose

The Employee Application Status Portal provides employees with complete visibility into the progress, review stages, and approval outcomes of their filed timekeeping applications across 5 distinct request categories:
1. **Log Sheet**: Attendance adjustments & missed log corrections.
2. **Change Shift**: Shift schedule change and swap requests.
3. **Overtime**: Pre/post overtime claims and rendered hours.
4. **Official Business Trip**: Off-site duty and travel filings.
5. **Leaves**: Annual, sick, and emergency leave applications.

This spec covers both the central portal landing hub ([ApplicationStatus.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/ApplicationStatus.vue)) and the 5 detailed report pages ([LogSheet.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/log_sheet/LogSheet.vue), [ChangeShift.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/change_shift/ChangeShift.vue), [Overtime.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/overtime/Overtime.vue), [OfficialBusinessTrip.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/obtrip/OfficialBusinessTrip.vue), and [Leaves.vue](file:///d:/project/hrms/resources/views/web/src/module/employee/application_status/pages/leaves/Leaves.vue)).

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Portal Hub Layout & Card Launchers

**Option A — HeaderBanner with Category Tabs, Search Bar, and Metric Launchers (Recommended)**
- Uses `HeaderBanner` (`portal="employee"`), top metric summary cards, category tab switcher (*All Statuses*, *Shifts & Logs*, *Overtime & Travel*, *Leaves*), instant search bar, tag pills, and direct router link launchers.

| Pros | Cons |
|---|---|
| Visually consistent with `Applications.vue` and modern HRMS portal standards. | None. |
| Enables instant category tab filtering and text search across module descriptions and tags. | Requires proper tag and category metadata setup per module card. |

**Option B — Static List of Standard Links**
- Simple card list linking to sub-routes.

| Pros | Cons |
|---|---|
| Minimal template code. | Low visual impact, lacking search and filter capability. |

**Recommendation:** Option A. Aligns with HRMS UI design standards ([ui-design.md](../../rules/ui-design.md)).

---

### Decision 2: Sub-Module Report Page Standards (Log Sheet, Change Shift, Overtime, OBT, Leaves)

**Option A — Standardized Report Header, Top Metrics Cards, Filter Toolbar, Drag-to-Scroll Data Table, and Detail Modal (Recommended)**
- Every sub-page report features:
  1. **Header Banner / Page Header**: Clean breadcrumbs pointing to `/employee/dashboard` and `/employee/application-status`, page icon, and a *"Back to Hub"* button.
  2. **Top Metrics Cards**: 4 summary counters per report type (Total Filed, Pending, Approved, Disapproved / Cancelled).
  3. **Filter Toolbar**: Search input, entries per page selector, status filter dropdown, Print button, and Excel Export button.
  4. **Data Table**: Mouse drag-to-scroll enabled (`overflow-x-auto cursor-grab active:cursor-grabbing select-none`), formatted document numbers (`font-mono`), color-coded status badges, and view detail modal launcher.
  5. **Details Modal**: Read-only drawer/modal to inspect application data, remarks, attachments, and approval timeline.

| Pros | Cons |
|---|---|
| Uniform UX across all 5 timekeeping application status reports. | Requires updating all 5 sub-page Vue components. |
| High usability with drag-to-scroll, instant search, summary metrics, and detail modals. | |

**Option B — Basic Unstyled HTML Tables without Metrics or Drag-to-Scroll**
- Legacy table layout with raw text.

| Pros | Cons |
|---|---|
| No changes needed. | Dated appearance, inconsistent breadcrumbs (`/application-status` broken links), poor mobile/dark-mode experience. |

**Recommendation:** Option A. Standardizes all 5 application status pages to match HRMS UI and performance guidelines.

---

## 3. Database & Models

Reuses existing application tables without creating new migrations:

| Table Name | Model | Purpose | Sub-Page Module |
|---|---|---|---|
| `tbl_app_adjustment` | `AppAdjustment` | Attendance adjustment / missed log applications | Log Sheet (`LogSheet.vue`) |
| `tbl_app_changeshift` | `AppChangeShift` | Shift change request applications | Change Shift (`ChangeShift.vue`) |
| `tbl_app_overtime` | `AppOvertime` | Overtime claim applications | Overtime (`Overtime.vue`) |
| `tbl_app_obtrip` | `AppOfficialBusinessTrip` | Official business trip filings | Official Business Trip (`OfficialBusinessTrip.vue`) |
| `tbl_app_leave` | `AppLeave` | Leave applications & balance history | Leaves (`Leaves.vue`) |

---

## 4. Backend & API Endpoints

### Routes (`routes/api/employee.php`)
- `GET /api/employee/application-status` -> `ApplicationStatusController@index` (Hub aggregated status)
- `GET /api/employee/logSheet` -> `LogsheetStatusController@index` (Log Sheet report data)
- `GET /api/employee/changeshift` -> `ChangeShiftStatusController@index` (Change Shift report data)
- `GET /api/employee/overtime` -> `OvertimeStatusController@index` (Overtime report data)
- `GET /api/employee/obtrip` -> `OBTripStatusController@index` (OBT report data)
- `GET /api/employee/leaves` -> `LeaveStatusController@index` (Leaves report data)

---

## 5. Frontend Architecture & File Structure

```
resources/views/web/src/module/employee/application_status/
├── index.ts                            # Barrel export
├── api/
│   └── application_status.api.ts       # API service layer with Design-First hard-coded stubs
├── composables/
│   └── useApplicationStatus.ts         # Main portal composable state
├── pages/
│   ├── ApplicationStatus.vue           # Portal Landing Hub Page
│   ├── change_shift/
│   │   └── ChangeShift.vue             # Change Shift Status Report
│   ├── leaves/
│   │   └── Leaves.vue                  # Leaves Status Report
│   ├── log_sheet/
│   │   └── LogSheet.vue                # Log Sheet Status Report
│   ├── obtrip/
│   │   └── OfficialBusinessTrip.vue    # Official Business Trip Status Report
│   └── overtime/
│       └── Overtime.vue                # Overtime Status Report
└── route/
    └── application_status.routes.ts   # Vue Router definitions
```

---

## 6. Business Rules & Edge Cases

| Feature | Business Rule | Implementation Standard |
|---|---|---|
| Status Codes | `0 = Pending`, `1 = Approved`, `2 = Disapproved`, `3 = Cancelled` | Color-coded pills: Amber (`Pending`), Emerald (`Approved`), Red (`Disapproved`), Slate (`Cancelled`). |
| Breadcrumb Routing | Navigation link for hub must point to `/employee/application-status` | Fixed broken `/application-status` relative links across all 5 sub-pages. |
| Table Interaction | Wide data tables with scrollable content | Add mouse drag-to-scroll handling (`@mousedown="startDrag"`). |
| Document Numbering | Statutory & document numbers | Formatted in monospace font (`font-mono text-xs font-bold`). |
| Detail Modal | Clicking "View Details" on any application row | Opens read-only details modal displaying document details, dates, reason, status, and approval workflow. |

---

## 7. Build Order

1. **Gate 1 (Frontend UI & Layout - Static Design)**:
   - Scaffolding & polishing `ApplicationStatus.vue` (Portal Hub).
   - Standardizing `LogSheet.vue`, `ChangeShift.vue`, `Overtime.vue`, `OfficialBusinessTrip.vue`, and `Leaves.vue` with `HeaderBanner`, top metrics summary cards, toolbar, drag-to-scroll table, and details modal.
2. **Gate 2 (Backend Connection & Dynamic Data)**:
   - Connect live API calls for all 5 report endpoints in `api/application_status.api.ts`.
   - Verify pagination, date range filtering, export functions, and status filters.

---

## 8. Out of Scope

- Manager approval workflow actions (handled under `/employee/approvers-menu/...` and `/manager/approvers-menu/...`).
- WebSocket live notifications for status changes.
