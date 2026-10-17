# Spec — Timekeeping Leave Conversion Settings

> **Kind:** Extension & Redesign — Simplify the Leave Conversion module under Timekeeping (`/timekeeping/leave-conversion`) into a single, focused **Leave Conversion Settings** policy configuration view.  
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `leave_conversion` frontend module under `resources/views/web/src/module/timekeeping/leave_conversion/`).  
> **Route:** `/timekeeping/leave-conversion` (`leave_conversion`).  
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md), [ui-design.md](../../../rules/conditional/ui-design.md).  
> **System Awareness:** Models Reused (`Leave`, `LeaveTypeConfigLog`); Tables Reused (`leaves`, `leave_type_config_logs`); Routes Reused (`routes/api/timekeeping.php`); New migration: No.

---

## 1. Purpose

The **Leave Conversion** module under **Timekeeping** is dedicated to configuring **Leave Encashment Policy Settings** (`leaves` table).

Payroll automatically detects and computes eligible leave credit encashments based on these configured rules:
- **Periodic Encashment** (`isconvertible` = 'Y' | 'N')
- **Final Pay Encashment** (`is_final_pay_convertible` = true | false)
- **Deduct Balance** (`deduct_balance` = true | false)
- **Conversion Rate Multiplier** (e.g. 1.0x)

---

## 2. Interface Architecture

### Single-View Configuration Layout

1. **Top Stat Summary Metrics**:
   - Total Defined Leave Types
   - Periodic Encashment Eligible Types
   - Final Pay Encashment Eligible Types
   - Standard Daily Rate Factor (`salary / 22`)
2. **Leave Convertible Policy Rules Matrix** (`LeaveTypeConfig.vue`):
   - Interactive table listing leave categories (Vacation Leave, Sick Leave, Emergency Leave, LWOP, etc.).
   - Policy switches: `Periodic Encashment`, `Final Pay Encashment`, `Deduct Balance`.
   - Rate Multiplier column.
   - Audit trail log side drawer tracking modification history (`leave_type_config_logs`).

---

## 3. Database Schema (Reused)

Reuses `leaves` and `leave_type_config_logs`.

---

## 4. Frontend Component Breakdown

Folder structure under `resources/views/web/src/module/timekeeping/leave_conversion/`:

```
resources/views/web/src/module/timekeeping/leave_conversion/
├── api/
│   └── leave_conversion.api.ts         # Leave policy config API methods
├── components/
│   └── LeaveTypeConfig.vue            # Convertible leave policy rules & audit log panel
├── composables/
│   └── useLeaveConversion.ts          # State machine for leave configs
├── pages/
│   └── LeaveConversion.vue            # Main view wrapper with Timekeeping Blue theme
├── route/
│   └── leave_conversion.routes.ts
├── types/
│   └── types.leave_conversion.ts
└── index.ts
```

---

## 5. Build Order

1. **Spec Update**: Saved to `.agents/specs/subhrms/timekeeping/leave_conversion.md` (Completed).
2. **Frontend Refactoring**:
   - Refactor `pages/LeaveConversion.vue` to render the clean Leave Conversion Settings interface.
   - Simplify `composables/useLeaveConversion.ts` and `api/leave_conversion.api.ts`.
   - Ensure clean compilation.
