# Spec — Employer Details (Company Registration & Statutory Master Setup)

> **Kind:** Greenfield / Extension (Centralized Employer Registration Master & Statutory Metadata Management).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines` module) & **HR** (`/api/hr/companyProfile` routes, `company_profile` module).  
> **Route:** `/payroll/government-routines/employer-details` (`payroll_government_routines_employer_details`) & `/hr/company-profile` (`hr_company_profile`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models reused (`Company`, `CompanyAttachment`, `TransLog`); Tables reused (`company`, `employee_handbook`, `translog`); Routes reused (`/api/hr/companyProfile`, `/api/hr/updateCompanyProfile`, `/api/hr/uploadProfileImage`); Routes created (`/api/payroll/employer-details`); New migration: no (extends existing `company` table fields).

---

## 1. Purpose

The **Employer Details** module maintains the official company identity, registration details, government identification numbers (SSS Employer ID, PhilHealth PEN, Pag-IBIG MID, BIR TIN & RDO), authorized signatories, company address, and logo for the entire HRMS platform.

It serves as the **single source of truth** for employer information referenced across:
1. **Payroll Processing & Payslips**: Displays official company header, address, and logo on employee payslips and payroll register summaries.
2. **Government Compliance Routines**: Supplies required employer headers for SSS R-3 / R-5 / WISP files, PhilHealth EPRS upload files, and Pag-IBIG MCRF remittance reports.
3. **Loan Remittance Modules**: Provides employer registration IDs required by SSS Loan Remittance (ML2) and Pag-IBIG Short-Term Loan Remittance (STLRF) files.
4. **BIR Tax & Year-End Reporting**: Fills company TIN, Branch Code, RDO, and Authorized Signatory details on BIR Form 1601-C, BIR Form 2316 Certificates, BIR Form 1604-C, and BIR Alphalist Schedules 1 & 2.

The Employer Details module **does not perform payroll computations**. Instead, it manages and exposes authoritative employer registration metadata, ensuring 100% consistency across all generated reports, forms, payslips, and electronic submission files.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Data Architecture & Scope (Single Master Record vs Multi-Branch Table Structure)

**Option A — Primary Master Record with Sub-Branch Extensions on `company` Table (Recommended)**
- Maintain `company` table anchored to `id = 1` as the primary parent employer profile, with structured columns for BIR TIN, RDO, SSS Number, PhilHealth PEN, Pag-IBIG MID, Authorized Signatories, Logo, and Address.

| Pros | Cons |
|---|---|
| Direct 1-query lookup (`Company::find(1)`) across all reports, queries, payslips, and background jobs. | Needs multi-company branching extension if company splits into distinct legal corporate entities. |
| Eliminates table JOIN overhead when building high-performance payroll summary reports. | |
| Backward compatible with all existing models (`Company`, `AccountDetailVW`). | |

**Option B — Multi-Tenant `companies` Table with Mandatory Foreign Key Joins**
- Require every employee and payroll run detail row to join against a `companies` foreign key.

| Pros | Cons |
|---|---|
| Supports multiple distinct legal corporate entities in a single database. | Introduces JOIN complexity to every query, report, and payslip handler. |
| | Over-engineers single-company setups commonly deployed in Docker containers. |

**Recommendation:** Option A. Keeps single-instance deployment clean and fast while maintaining clear field structures for all Philippine statutory requirements.

---

### Decision 2: UI Placement & Route Strategy

**Option A — Dual Access Points to Shared Employer Details Component (Recommended)**
- Single reusable Vue component accessible from both **HR Portal** (`/hr/company-profile`) and **Government Routines** (`/payroll/government-routines/employer-details`, `/payroll/sss/employer-details`, `/payroll/phil-health/employer-details`, `/payroll/pag-ibig/employer-details`, `/payroll/bir/employer-details`).

| Pros | Cons |
|---|---|
| Single source of code for company profile form and logo uploader. | Requires tab/sub-route prop management to auto-focus relevant sections (e.g. SSS ID when accessed from SSS menu). |
| HR Officers and Payroll Officers access identical verified company data. | |
| Zero code duplication across agency sub-pages. | |

**Option B — Decentralized Forms per Agency**
- Build separate forms inside SSS, PhilHealth, Pag-IBIG, and BIR sub-pages.

| Pros | Cons |
|---|---|
| Isolated components per agency. | **Severe redundancy**: Risk of updating company TIN in BIR page without updating SSS page. |
| | Violates DRY standards and project architecture. |

**Recommendation:** Option A. Centralized component guarantees data consistency across HR and Payroll portals.

---

### Decision 3: Audit Logging for Employer Profile Updates

**Option A — Granular Field-Level Audit Logging via `TransLog` (Recommended)**
- Log every employer field update (e.g. "Company SSS ID Updated from X to Y") into the system `translog` table with timestamp, user ID, IP address, old value, and new value.

| Pros | Cons |
|---|---|
| Complete auditability required for statutory compliance and security audits. | Slightly increases write overhead during company profile updates (infrequent action). |
| Prevents unauthorized or accidental changes to government registration numbers. | |
| Aligns with existing `CompanyProfileController` audit logging pattern. | |

**Option B — Silent DB Update without Audit Log**
- Execute direct `UPDATE company SET ...` without logging.

| Pros | Cons |
|---|---|
| Slightly simpler controller method. | Zero audit trail; impossible to detect who changed SSS/TIN numbers if statutory filing fails. |

**Recommendation:** Option A. Mandatory audit trail for compliance and data integrity.

---

### Decision 4: Statutory Identification Format Validation

**Option A — Strictly Validated Formats with Masking & Auto-Formatting (Recommended)**
- Enforce regex format validation on backend and client-side masking:
  - BIR TIN: `999-999-999-0000` (9 digits + 4-digit branch code)
  - SSS Employer No.: `99-9999999-9` (10 digits)
  - PhilHealth PEN: `99-999999999-9` (12 digits)
  - Pag-IBIG MID: `9999-9999-9999` (12 digits)

| Pros | Cons |
|---|---|
| Prevents invalid registration numbers from being submitted to government portals. | Requires strict regex patterns handling hyphenated and raw numeric strings. |
| Reduces statutory file upload rejections by agency portals. | |

**Option B — Unvalidated Free-Text Input Fields**
- Allow arbitrary string input without validation.

| Pros | Cons |
|---|---|
| Easy data entry without regex restrictions. | High risk of typos, invalid character lengths, and failed electronic submission files. |

**Recommendation:** Option A. Server-side regex validation prevents invalid statutory file generation.

---

## 3. Database Schema

Reuses and extends the primary `company` master table:

### Table Definition: `company`

```sql
CREATE TABLE `company` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `companyname` VARCHAR(255) NOT NULL,
  `trade_name` VARCHAR(255) NULL,
  `employername` VARCHAR(255) NULL COMMENT 'Authorized Signatory Name',
  `signatory_position` VARCHAR(150) NULL COMMENT 'Authorized Signatory Title',
  `rdo` VARCHAR(10) NULL COMMENT 'BIR Revenue District Office Code',
  `unittype` TINYINT UNSIGNED NOT NULL DEFAULT 2 COMMENT '1=Public, 2=Private, 3=Non-Profit',
  `profile` VARCHAR(255) NULL COMMENT 'Company Logo Image Filename',
  `cnumber` VARCHAR(50) NULL COMMENT 'Contact Phone Number',
  `fnumber` VARCHAR(50) NULL COMMENT 'Fax Number',
  `email` VARCHAR(100) NULL COMMENT 'Official Email Address',
  `website` VARCHAR(150) NULL,
  `idbir` VARCHAR(30) NULL COMMENT 'BIR Tax Identification Number (TIN)',
  `idsss` VARCHAR(30) NULL COMMENT 'SSS Employer Registration Number',
  `idibig` VARCHAR(30) NULL COMMENT 'Pag-IBIG Employer Registration ID (MID)',
  `idhealth` VARCHAR(30) NULL COMMENT 'PhilHealth Employer Registration Number (PEN)',
  `addr_bldg` VARCHAR(255) NULL,
  `addr_street` VARCHAR(255) NULL,
  `addr_brgy` VARCHAR(150) NULL,
  `addr_city` VARCHAR(150) NULL,
  `addr_prov` VARCHAR(150) NULL,
  `addr_code` VARCHAR(20) NULL COMMENT 'Zip Code',
  `idind` INT UNSIGNED NULL COMMENT 'Industry Classification Code',
  `idsize` TINYINT UNSIGNED NULL COMMENT 'Company Size Category (1=1-49, 2=50-99, etc.)',
  `mission` TEXT NULL,
  `vision` TEXT NULL,
  `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Inactive',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Backend Implementation Plan

Following the **thin-controller + Query/Handler/Action pattern** ([project-profile.md](../../rules/project-profile.md)):

### 4.1 Query Class: `GetEmployerDetailsQuery`

- **Location:** `app/Queries/Company/GetEmployerDetailsQuery.php`
- **Class:** `App\Queries\Company\GetEmployerDetailsQuery` extends `App\Queries\Query`
- **Signature:** `public static function execute($params = [])`

**Response Structure:**
```json
{
  "company": {
    "id": 1,
    "companyname": "Acme Hotels & Resorts Philippines Inc.",
    "trade_name": "Acme Grand Hotel",
    "employername": "Maria Santos-Cruz",
    "signatory_position": "Vice President - Human Resources",
    "rdo": "047",
    "rdo_description": "RDO 047 - East Makati",
    "unittype": 2,
    "unittype_desc": "Private",
    "profile": "acme_logo.png",
    "logo_url": "/assets/images/profile/acme_logo.png",
    "cnumber": "+63 (02) 8888-1234",
    "fnumber": "+63 (02) 8888-5678",
    "email": "hr@acmehotels.ph",
    "website": "https://acmehotels.ph",
    "idbir": "008-123-456-0000",
    "idsss": "03-9876543-2",
    "idhealth": "19-012345678-9",
    "idibig": "2024-5678-9012",
    "address": {
      "bldg": "Suite 1200, Acme Tower",
      "street": "Ayala Avenue",
      "brgy": "Bel-Air",
      "city": "Makati City",
      "prov": "Metro Manila",
      "zip": "1209",
      "full_address": "Suite 1200, Acme Tower Ayala Avenue Bel-Air Makati City Metro Manila 1209"
    },
    "idind": 12,
    "industry_name": "Hospitality & Food Services",
    "idsize": 3,
    "company_size": "100-299",
    "mission": "To provide world-class hospitality...",
    "vision": "To be the premier hotel chain...",
    "status": 1
  },
  "lookups": {
    "rdo_list": [
      { "code": "047", "name": "RDO 047 - East Makati" },
      { "code": "048", "name": "RDO 048 - West Makati" },
      { "code": "050", "name": "RDO 050 - South Quezon City" }
    ],
    "unit_types": [
      { "id": 1, "name": "Public" },
      { "id": 2, "name": "Private" },
      { "id": 3, "name": "Non-Profit" }
    ],
    "company_sizes": [
      { "id": 1, "name": "1-49" },
      { "id": 2, "name": "50-99" },
      { "id": 3, "name": "100-299" },
      { "id": 4, "name": "300-399" },
      { "id": 5, "name": "400-499" },
      { "id": 6, "name": "500-599" }
    ]
  }
}
```

---

### 4.2 Handler Class: `UpdateEmployerDetailsHandler`

- **Location:** `app/Handlers/Company/UpdateEmployerDetailsHandler.php`
- **Class:** `App\Handlers\Company\UpdateEmployerDetailsHandler` extends `App\Handlers\Handler`
- **Signature:** `public static function execute($data = [], $userId = null, $ipAddress = null)`

**Execution Steps:**
1. Retrieve primary `Company` record (`Company::first()`, creating default ID 1 if empty).
2. Validate updated payload fields (TIN, SSS, PhilHealth, Pag-IBIG regex patterns).
3. Compute diff between `$oldValues` and `$newValues`.
4. Wrap `company->update(...)` inside `DB::transaction()`.
5. Insert audit log entries into `translog` for every changed field (module `'Company Profile'`, recording `oldvalue` and `newvalue`).
6. Return updated company model object.

---

### 4.3 Controller: `CompanyProfileController`

Update existing methods in `App\Http\Controllers\hr\CompanyProfileController`:

```php
/**
 * Fetch Employer Details & Master Registration Info
 */
public function index(Request $request)
{
    try {
        $data = GetEmployerDetailsQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}

/**
 * Update Employer Details with Audit Logging
 */
public function updateCompanyProfile(Request $request)
{
    try {
        $result = UpdateEmployerDetailsHandler::execute(
            $request->all(),
            auth()->id(),
            $request->ip()
        );
        return response()->json([
            'success' => true,
            'message' => 'Employer details updated successfully',
            'company' => $result
        ]);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

---

### 4.4 Route Registration

Existing routes in `routes/api/hr.php` are reused and extended under `routes/api/payroll.php`:

```php
// In routes/api/hr.php (Existing)
Route::get('/companyProfile',        [CompanyProfileController::class, 'index']);
Route::post('/updateCompanyProfile', [CompanyProfileController::class, 'updateCompanyProfile']);
Route::post('/uploadProfileImage',   [CompanyProfileController::class, 'updateProfileImage']);

// In routes/api/payroll.php (Alias routes for Government Routines)
Route::get('/employer-details',      [CompanyProfileController::class, 'index']);
Route::post('/employer-details',     [CompanyProfileController::class, 'updateCompanyProfile']);
```

---

## 5. Frontend Implementation Plan

Module layout located under `resources/views/web/src/module/payroll/government_routines/pages/employer_details/` and `resources/views/web/src/module/hr/company_profile/`:

### 5.1 TS Module Structure

```text
resources/views/web/src/module/payroll/government_routines/pages/employer_details/
├── index.ts
├── api/
│   └── employer_details.api.ts
├── composables/
│   └── useEmployerDetails.ts
├── types/
│   └── types.employer_details.ts
└── components/
    ├── EmployerGeneralInfoForm.vue       (Company Name, Trade Name, Contact, Email, Website)
    ├── EmployerStatutoryIdsForm.vue      (TIN + RDO, SSS Employer #, PhilHealth PEN, Pag-IBIG MID)
    ├── EmployerAddressForm.vue           (Bldg, Street, Brgy, City, Province, Zip)
    ├── EmployerSignatoryForm.vue         (Authorized Signatory Name & Position/Title)
    ├── EmployerLogoUploader.vue          (Company Logo Uploader & Preview)
    └── EmployerDetailsView.vue           (Main Consolidated Tabbed Form View)
```

---

### 5.2 Key UI Components & Interactions

1. **`EmployerStatutoryIdsForm.vue`**
   - **Fields**: BIR Tax Identification Number (TIN), BIR Revenue District Office (RDO Select), SSS Employer Registration Number, PhilHealth PEN, Pag-IBIG Employer MID.
   - **Input Masks & Formatting**: Client-side auto-hyphenation and regex validation (e.g. `000-000-000-0000`).
   - **Quick Badges**: Visual indicator showing verification status of each statutory ID (Green check for valid length, Orange warning for empty).

2. **`EmployerSignatoryForm.vue`**
   - **Fields**: Authorized Signatory Full Name (`employername`), Official Title / Position (`signatory_position`).
   - **Preview Card**: Live preview showing how the signatory signature line will appear on generated BIR Form 2316 and SSS R-3 forms.

3. **`EmployerLogoUploader.vue`**
   - **Drag-and-Drop Image Uploader**: Accepts PNG/JPEG/WEBP (max 2MB).
   - **Logo Preview Box**: Shows dark and light theme background rendering for payslip headers.

4. **`EmployerAddressForm.vue`**
   - **Structured Philippine Address Inputs**: Building/Unit, Street Name, Barangay, City/Municipality, Province, Zip Code.
   - **Auto-Concatenated Display**: Shows formatted single-line address used on official government header banners.

---

### 5.3 Frontend Service Layer (`api/employer_details.api.ts`)

```ts
import http from '@/app/axios/axiosInstance';
import type { EmployerDetailsResponse, UpdateEmployerPayload } from '../types/types.employer_details';

export function useEmployerDetailsApi() {
  return {
    getDetails: async (): Promise<EmployerDetailsResponse> => {
      const response = await http.get('api/payroll/employer-details');
      return response.data;
    },
    updateDetails: async (payload: UpdateEmployerPayload): Promise<any> => {
      const response = await http.post('api/payroll/employer-details', payload);
      return response.data;
    },
    uploadLogo: async (file: File): Promise<any> => {
      const formData = new FormData();
      formData.append('profile_image', file);
      const response = await http.post('api/hr/uploadProfileImage', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  };
}
```

---

### 5.4 Vue Routes (`route/government_routines.routes.ts`)

Register routes pointing to the employer details views:

```ts
{
  path: 'payroll/employer-details',
  name: 'payroll_employer_details',
  component: () => import('../pages/employer_details/EmployerDetailsView.vue'),
  meta: { title: 'Employer Details' }
},
{
  path: 'payroll/sss/employer-details',
  name: 'payroll_sss_employer_details',
  component: () => import('../pages/employer_details/EmployerDetailsView.vue'),
  props: { focusTab: 'sss' },
  meta: { title: 'SSS - Employer Details' }
},
{
  path: 'payroll/phil-health/employer-details',
  name: 'payroll_phil_health_employer_details',
  component: () => import('../pages/employer_details/EmployerDetailsView.vue'),
  props: { focusTab: 'philhealth' },
  meta: { title: 'PhilHealth - Employer Details' }
},
{
  path: 'payroll/pag-ibig/employer-details',
  name: 'payroll_pag_ibig_employer_details',
  component: () => import('../pages/employer_details/EmployerDetailsView.vue'),
  props: { focusTab: 'pagibig' },
  meta: { title: 'Pag-IBIG - Employer Details' }
},
{
  path: 'payroll/bir/employer-details',
  name: 'payroll_bir_employer_details',
  component: () => import('../pages/employer_details/EmployerDetailsView.vue'),
  props: { focusTab: 'bir' },
  meta: { title: 'BIR - Employer Details' }
}
```

---

## 6. Business Rules & Edge Cases

### 6.1 Business Rules

1. **Single Source of Truth Rule**
   - All payroll reports, payslips, SSS/PhilHealth/Pag-IBIG files, and BIR tax forms MUST read employer identification numbers directly from the `company` master table.
   - Hardcoded company TIN, SSS, or PEN strings inside query scripts or export templates are strictly prohibited.

2. **Auditability Directive**
   - Any update to employer registration IDs (TIN, SSS, PEN, MID) or authorized signatories MUST create a detailed `translog` audit trail recording the user ID, IP address, previous value, new value, and exact field name.

3. **Fallback Header Handling**
   - If optional fields (e.g. `trade_name`, `fnumber`, `website`) are empty, report generators seamlessly omit the line without rendering blank brackets or `null` labels.

4. **Active Employer Status Guard**
   - Generated statutory export headers verify `company.status = 1`. Inactive company profiles trigger a warning banner during payroll report export.

---

### 6.2 Edge Cases Matrix

| Edge Case | Impact | Handling & Resolution |
|---|---|---|
| **Empty SSS / PhilHealth / Pag-IBIG Employer Number** | Agency electronic upload files (R-3, EPRS, MCRF) reject invalid headers. | Show persistent warning banner on Government Routines dashboard pointing directly to the Employer Details form. |
| **Special characters in Company Name (e.g. `&`, `"`, `'`, `/`)** | XML or fixed-width text files break character encoding rules. | Export Action classes sanitize company name (strip XML special entities, sanitize UTF-8 to ASCII for agency text files). |
| **Missing Authorized Signatory Name** | BIR Form 2316 & 1601-C generated without signature block. | Highlight Signatory form section with alert banner if `employername` is empty. |
| **Large Company Logo uploaded (e.g. 10MB High-Res PNG)** | Slows down PDF payslip batch generation. | Logo uploader enforces server validation (`max:2048` KB) and client-side image resizing. |
| **TIN format submitted without 4-digit Branch Code** | BIR Alphalist validation software rejects 9-digit TIN. | Auto-append `-0000` default branch code if user enters a 9-digit TIN. |

---

## 7. Build Order

Follow the **Design-First Workflow** ([webkit.frontend-implement](../../skills/webkit.frontend-implement/SKILL.md) -> [webkit.backend-implement](../../skills/webkit.backend-implement/SKILL.md)):

### Phase 1 — Frontend Gate 1 (Design-First with Hard-Coded / Mock Data)
1. Create TypeScript types in `resources/views/web/src/module/payroll/government_routines/pages/employer_details/types/types.employer_details.ts`.
2. Scaffold `api/employer_details.api.ts` with mock company dataset.
3. Build composable `composables/useEmployerDetails.ts` handling form reactivity, tab focus props, validation state, and logo uploads.
4. Implement UI components:
   - `EmployerGeneralInfoForm.vue`
   - `EmployerStatutoryIdsForm.vue`
   - `EmployerAddressForm.vue`
   - `EmployerSignatoryForm.vue`
   - `EmployerLogoUploader.vue`
5. Implement main view `EmployerDetailsView.vue`.
6. Register Vue routes in `route/government_routines.routes.ts`.
7. **User Validation Gate:** Present UI to user for visual & form validation approval.

### Phase 2 — Backend Gate 2 (Query, Handler & Dynamic Data Wiring)
8. Implement Query class `App\Queries\Company\GetEmployerDetailsQuery`.
9. Implement Handler class `App\Handlers\Company\UpdateEmployerDetailsHandler` with `translog` auditing.
10. Update controller methods in `App\Http\Controllers\hr\CompanyProfileController`.
11. Register alias API endpoints in `routes/api/payroll.php`.
12. Wire live API calls into `api/employer_details.api.ts` swapping out mock data.

### Phase 3 — Verification & Testing
13. Run PHPUnit tests verifying `company` model CRUD operations and `translog` audit records.
14. Verify statutory file exports (SSS, PhilHealth, Pag-IBIG, BIR 2316) accurately pull updated employer numbers from `company`.
15. Test logo upload and PDF payslip header rendering.

---

## 8. Out of Scope (Future Specs)

- **Multi-Company Entity Branching & DB Sharding**: Multi-tenant database separation per subsidiary (future enterprise architecture spec).
- **Digital Certificate / PKI E-Signatures**: Cryptographic digital signature keys embedded in BIR PDF forms (future security spec).
