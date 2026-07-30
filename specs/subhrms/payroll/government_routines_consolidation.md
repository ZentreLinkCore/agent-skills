# Spec — Government Routines Portal Consolidation & Layout Redesign

> **Kind:** Refactoring & Consolidation (Merging SSS, PhilHealth, Pag-IBIG, and BIR landing pages into a single unified Government Routines portal; centralizing Employer Details).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines` frontend module).  
> **Route:** `/payroll/government-routines` (`payroll_government_routines`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models reused (`Company`, `PayrollRun`, `PayrollRunDetail`, `PayPeriod`, `SssContributionTable`, `PhilhealthContributionTable`); Routes consolidated (`/payroll/government-routines`, `/payroll/employer-details`); Redundant routes removed (`/payroll/sss/employer-details`, `/payroll/phil-health/employer-details`, `/payroll/pag-ibig/employer-details`, `/payroll/bir/employer-details`); New migration: no.

---

## 1. Purpose

The **Government Routines Module** currently suffers from visual and structural redundancy: SSS, PhilHealth, Pag-IBIG, and BIR each maintain separate, near-identical landing pages (`SSS.vue`, `PhilHealth.vue`, `PagIbig.vue`, `BIR.vue`) with duplicated metrics card grids and category filter toolbars. Furthermore, each agency hub contains a redundant "Employer Details" sub-card, despite employer statutory credentials (SSS Employer Number, PhilHealth PEN, Pag-IBIG Employer Number, BIR TIN, Registered Trade Name, Authorized Signatories) already being centrally managed under the single Employer Details / Company Profile setup page (`/payroll/employer-details`).

This specification outlines the **consolidation of all statutory government routines into a single, unified landing portal (`GovernmentRoutines.vue`)** and the **removal of redundant agency-specific Employer Details sub-pages**.

The consolidated portal provides a single, cohesive hub categorized into 4 clear operational sections:
1. **Monthly Statutory Remittances** (SSS R-5/R-3, PhilHealth RF-1/EPRiS, Pag-IBIG MCRF, BIR Monthly ITW).
2. **Statutory Contribution Tables & Tax Schedules** (SSS Table, PhilHealth Table, Pag-IBIG Table, BIR Periodic/Annual Tax Tables).
3. **Loan Remittances** (SSS Loans, Pag-IBIG Loans, Company Loans).
4. **Tax & Year-End Compliance** (BIR Form 2316, 1601-C, 1604-C, Alphalist Schedules 1 & 2).
5. **Central Employer Setup** (Single launcher to `/payroll/employer-details`).

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Landing Page Architecture (Unified Hub vs Separate Agency Hubs)

**Option A — Single Unified Landing Portal (`GovernmentRoutines.vue`) with Category Tabs (Recommended)**
- Consolidate `SSS.vue`, `PhilHealth.vue`, `PagIbig.vue`, and `BIR.vue` into a single landing page (`GovernmentRoutines.vue`) accessible at `/payroll/government-routines`.

| Pros | Cons |
|---|---|
| Eliminates layout redundancy and duplicate code across 4 separate Vue views. | Requires updating sidebar navigation links to point to the consolidated route. |
| Delivers a superior user experience: payroll officers view all statutory compliance services in a single, clean dashboard. | |
| Reduces overall route complexity and Vue bundle size. | |

**Option B — Maintain 4 Separate Agency Landing Pages**
- Keep `SSS.vue`, `PhilHealth.vue`, `PagIbig.vue`, and `BIR.vue` as separate routes.

| Pros | Cons |
|---|---|
| Zero changes to existing router file paths. | Severe layout redundancy across pages. |
| | Unnecessary extra clicks for users navigating between statutory agencies. |

**Recommendation:** Option A. Merging into a single hub eliminates redundancy and significantly streamlines navigation.

---

### Decision 2: Employer Setup Data Management & Page Placement

**Option A — Single Centralized Employer Details Page (`/payroll/employer-details`) (Recommended)**
- Remove duplicate agency sub-pages (`/payroll/sss/employer-details`, `/payroll/phil-health/employer-details`, `/payroll/pag-ibig/employer-details`, `/payroll/bir/employer-details`). Manage all statutory registration numbers (SSS ER No, PhilHealth PEN, Pag-IBIG ER No, BIR TIN, Trade Name, Signatory Position) in the single `CompanyProfileController` / `EmployerDetails.vue` page.

| Pros | Cons |
|---|---|
| Enforces **Single Source of Truth** pattern anchored to the `company` database table (`app/Models/Company.php`). | Requires removing 4 orphaned sub-folder directories. |
| Eliminates confusion for HR/Payroll admins by providing one master location for employer statutory setup. | |
| Matches existing migration (`2026_07_30_000001_add_trade_name_and_signatory_position_to_company_table.php`). | |

**Option B — Retain Separate Agency Employer Setup Pages**
- Maintain individual employer setup forms for each agency.

| Pros | Cons |
|---|---|
| Keeps agency-specific sub-routes intact. | Severe data duplication; editing SSS employer name on one sub-page fails to update PhilHealth PEN or BIR TIN on others if not kept in sync. |
| | Violates DRY principles across both backend controllers and frontend forms. |

**Recommendation:** Option A. Centralizing employer registration under `/payroll/employer-details` guarantees data consistency.

---

### Decision 3: Route Consolidation & Backward Compatibility

**Option A — Consolidate Routes into Clean Unified Hierarchy with Alias Redirects (Recommended)**
- Register `/payroll/government-routines` as the primary portal landing page. Redirect old agency landing routes (`/payroll/sss`, `/payroll/phil-health`, `/payroll/pag-ibig`, `/payroll/bir`) to `/payroll/government-routines?agency=<agency>`. Direct tool routes (e.g. `/payroll/sss/table`, `/payroll/phil-health/table`, `/payroll/monthly-contribution`) remain directly navigable.

| Pros | Cons |
|---|---|
| Prevents broken bookmarks or stale sidebar links. | Requires simple route redirect definitions in `government_routines.routes.ts`. |
| Keeps URL namespace clean while preserving direct deep links to specific master tables and report tools. | |

**Option B — Hard Delete Old Routes without Redirects**
- Instantly delete all legacy agency routes.

| Pros | Cons |
|---|---|
| Fewer lines in route definitions. | Any bookmarked URLs or stale links in external menus will throw 404 errors. |

**Recommendation:** Option A. Redirecting legacy agency routes ensures smooth transition and zero broken links.

---

## 3. Consolidated Portal Structure

### 3.1 Unified Category Organization

The consolidated `GovernmentRoutines.vue` page organizes all statutory tools into 5 clear tabbed categories:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Government Compliance & Statutory Routines Portal                                               │
│  Unified hub for SSS, PhilHealth, Pag-IBIG (HDMF), and BIR tax compliance filings.               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
  [ All Services (14) ]  [ Remittance Reports (4) ]  [ Contribution Tables (4) ]  [ Loan Remittances (2) ]  [ Tax & BIR (4) ]

 ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
 │ 📄 Monthly Contributions  │ │ 📊 SSS Contribution Table │ │ 🏥 PhilHealth Table       │
 │ SSS, PhilHealth, Pag-IBIG │ │ RA 11199 MSC Brackets     │ │ RA 11223 5.0% Rate & Cap  │
 │ [ Launch Report ]         │ │ [ Launch Module ]         │ │ [ Launch Module ]         │
 └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
 ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
 │ 🏠 Pag-IBIG Table         │ │ 💳 Loan Remittance        │ │ 📋 BIR Form 2316          │
 │ HDMF Contribution Cap     │ │ SSS & Pag-IBIG Deductions │ │ Tax Withheld Certificate  │
 │ [ Launch Module ]         │ │ [ Launch Report ]         │ │ [ Launch Module ]         │
 └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
 ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
 │ 📜 BIR 1601-C / 1604-C    │ │ 📑 BIR Alphalists         │ │ 🏢 Employer Setup         │
 │ Monthly & Annual Tax Return│ │ Schedule 1 & 2 Roster     │ │ PEN, SSS, HDMF, TIN Setup │
 │ [ Launch Module ]         │ │ [ Launch Module ]         │ │ [ Launch Setup ]          │
 └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

---

## 4. Backend & Database Architecture

### 4.1 Reused Data Models & Controllers

- **`App\Models\Company`**: Single source of truth for employer registration numbers (`sss`, `philhealth`, `pag_ibig`, `tin`), trade name (`trade_name`), employer name (`employername`), address, and signatory details (`signatory_name`, `signatory_position`).
- **`App\Http\Controllers\Payroll\CompanyProfileController`**: Single controller handling employer details fetch (`index`) and update (`updateCompanyProfile`).

### 4.2 Route Cleanup in `routes/api/payroll.php`

- Remove redundant `/api/payroll/sss/employer-details`, `/api/payroll/philhealth/employer-details`, `/api/payroll/pagibig/employer-details` endpoints.
- Preserve single master endpoint: `Route::get('/employer-details', [CompanyProfileController::class, 'index'])` and `Route::post('/employer-details', [CompanyProfileController::class, 'updateCompanyProfile'])`.

---

## 5. Frontend Architecture

### 5.1 Updated File Layout

```
resources/views/web/src/module/payroll/government_routines/
├── index.ts                                             # Public barrel export
├── route/government_routines.routes.ts                  # Consolidated route registry
├── pages/
│   ├── GovernmentRoutines.vue                           # NEW: Unified Landing Hub Page
│   ├── employer_details/
│   │   └── EmployerDetails.vue                          # Central Employer Registration Setup
│   ├── monthly_contribution/
│   │   └── MonthlyContributionReport.vue                # Unified Monthly Contribution Report
│   ├── loan_remittance/
│   │   └── LoanRemittanceReport.vue                     # Unified Loan Remittance Report
│   ├── sss/
│   │   └── table/Table.vue                              # SSS Contribution Table Module
│   ├── philhealth/
│   │   └── table/Table.vue                              # PhilHealth Contribution Table Module
│   ├── pagibig/
│   │   └── table/Table.vue                              # Pag-IBIG Contribution Table Module
│   └── bir/                                             # BIR Tax Modules (2316, 1601C, Alphalists)
```

### 5.2 Deleted / Retired Redundant Components

The following duplicate sub-directories and landing page components will be safely removed or refactored:
- `resources/views/web/src/module/payroll/government_routines/pages/sss/SSS.vue` (Merged into `GovernmentRoutines.vue`)
- `resources/views/web/src/module/payroll/government_routines/pages/sss/employer_details/` (Deleted; uses Central Employer Details)
- `resources/views/web/src/module/payroll/government_routines/pages/philhealth/PhilHealth.vue` (Merged into `GovernmentRoutines.vue`)
- `resources/views/web/src/module/payroll/government_routines/pages/philhealth/employer_details/` (Deleted; uses Central Employer Details)
- `resources/views/web/src/module/payroll/government_routines/pages/pagibig/PagIbig.vue` (Merged into `GovernmentRoutines.vue`)
- `resources/views/web/src/module/payroll/government_routines/pages/pagibig/employer_details/` (Deleted; uses Central Employer Details)
- `resources/views/web/src/module/payroll/government_routines/pages/bir/BIR.vue` (Merged into `GovernmentRoutines.vue`)
- `resources/views/web/src/module/payroll/government_routines/pages/bir/employer_details/` (Deleted; uses Central Employer Details)

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([hrms-rules.md](../../rules/hrms-rules.md))

1. **Single Source of Truth for Employer Statutory Registration:**
   - SSS Employer No, PhilHealth PEN, Pag-IBIG Employer No, BIR TIN, and Signatories are stored exclusively in the `company` database table.
   - Any report needing employer credentials (e.g. SSS R-3, PhilHealth EPRiS, Pag-IBIG MCRF, BIR 2316) reads directly from `Company::first()`.

2. **Access Control & Portal Security:**
   - Access to `/payroll/government-routines` is strictly restricted to authorized Payroll and HR Admin roles.

### 6.2 Edge Cases Matrix

| Edge Case | Handling Strategy |
|---|---|
| **User Accesses Old Legacy URL (`/payroll/sss`)** | Vue Router automatically redirects to `/payroll/government-routines?category=sss` to highlight SSS cards seamlessly. |
| **Unconfigured Employer Registration Numbers** | Central `EmployerDetails.vue` page displays amber warning badges for unconfigured SSS, PhilHealth, Pag-IBIG, or BIR TIN numbers. |
| **Missing Signatory Position** | `CompanyProfileController` handles nullable `signatory_pos_id` and falls back to plain text `signatory_position` string per migration `2026_07_30_000001`. |

---

## 7. Build Order

1. **Create Unified Landing Portal Component:**
   - Build `resources/views/web/src/module/payroll/government_routines/pages/GovernmentRoutines.vue` incorporating search, agency filter tabs, and service launcher cards.
2. **Update Route Registry (`government_routines.routes.ts`):**
   - Register `/payroll/government-routines` as main route.
   - Add alias redirects from legacy paths (`/payroll/sss`, `/payroll/phil-health`, `/payroll/pag-ibig`, `/payroll/bir`) to `/payroll/government-routines`.
   - Remove deleted employer details sub-routes.
3. **Clean Up Redundant Files:**
   - Remove duplicate `employer_details/` sub-folders under `sss/`, `philhealth/`, `pagibig/`, and `bir/`.
   - Remove redundant `SSS.vue`, `PhilHealth.vue`, `PagIbig.vue`, and `BIR.vue` landing pages.
4. **Update Navigation Bar / Sidebar Links:**
   - Update sidebar menu items under Payroll -> Government Routines to link to `/payroll/government-routines`.
5. **Verification & Testing:**
   - Test route redirects, verify search and filter tabs on `GovernmentRoutines.vue`, check central `EmployerDetails.vue` save/load flow, and test light/dark theme responsiveness.

---

## 8. Out of Scope

- **Modifying Specific Master Table Calculation Logic:** SSS, PhilHealth, and Pag-IBIG table computation rules remain governed by their respective calculation spec files (`sss_contribution_table.md`, `philhealth_contribution_table.md`).
