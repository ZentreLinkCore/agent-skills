# Spec — Mobile Employee Dashboard & Bottom Tab Navigation

> **Kind:** Native React Native / Expo implementation of the SubHRMS & Zentre Link Core Employee Central Dashboard and Bottom Tab Navigation (`resources/views/mobapp/src/app/(app)/...`), translating the web employee portal into an ergonomic, modern mobile experience with Employee Module Golden Chestnut branding (`#CB793A` / `#E2A35A`), Web Slate-800 card surfaces (`#1E293B`), dynamic Light/Dark/System device theme following, real-time shift/attendance widget, biometric status & quick punch, KPI metric cards, recent requests pipeline, payslip snapshot, and a 4-tab bottom navigation bar with a dead-center FAB (+).
> **Portal:** **Employee / Mobapp** (`/api/employee/dashboard`, `/api/account`, `/api/biometric/*`, `/api/attendance/*` backend routes; `resources/views/mobapp` mobile client).
> **Version:** v2 — 2026-08-28 — updated to reflect Employee Module Golden Chestnut palette, Web-identical Axios setup (`app/axios`), modular domain folder structure (`module/auth`, `module/employee/*`), and strictly module-only types.
> **Route:** `(app)/index` (Bottom tab root: Dashboard, Timekeeping, Requests, Profile/Security).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:**
> - Models Reused: `App\Models\Account`, `App\Models\AccountDetailVW`, `App\Models\AccountJob`, `App\Models\AppLeave`, `App\Models\AppOvertime`, `App\Models\AppChangeShift`, `App\Models\AppAdjustment`, `App\Models\AppOfficialBusinessTrip`, `App\Models\UserBiometricDevice`, `App\Models\PayrollRunDetail`, `App\Models\Announcement`, `App\Models\Holiday`.
> - Tables Reused: `tbl_account`, `accountjob`, `app_leave`, `app_overtime`, `app_shift`, `app_adjustment`, `app_obt`, `user_biometric_devices`, `payroll_run_detail`, `announcements`, `holidays`.
> - Routes Reused: `GET /api/employee/dashboard`, `GET /api/employee/dashboard/refresh`, `GET /api/account`, `GET /api/biometric/devices`, `POST /api/biometric/register`, `POST /api/biometric/revoke`, `GET /api/attendance/today`, `POST /api/attendance/record`, `POST /api/logout`.
> - New Migration Needed: **No** (all underlying data models, queries, and endpoints already exist in SubHRMS).

---

## 1. Purpose

The SubHRMS platform provides employees with a centralized dashboard on the web (`/employee/dashboard`) for tracking their daily work schedule, logging attendance, filing requests, reviewing payslips, and monitoring leave balances.

The React Native mobile client (`resources/views/mobapp`) provides a **dedicated, high-performance Employee Dashboard & Navigation System** that:
1. **Acts as the Default Post-Login Hub**: Every authenticated user immediately lands on the Mobile Employee Dashboard upon signing in.
2. **Implements Symmetrical Bottom Tab Navigation with Center FAB**: Replaces the desktop collapsible sidebar with a balanced 4-tab bottom bar (`Dashboard`, `Timekeeping`, `Requests`, `Profile & Security`) flanking a dead-center Golden Chestnut Floating Action Button (`+`) that triggers quick filing modals.
3. **Presents Live Attendance & Shift Intelligence**: Displays the employee's current day shift schedule (`08:00 AM - 05:00 PM`), real-time clock-in/out status, worked hours progress meter in Employee Golden Chestnut, and quick-action attendance punch.
4. **Integrates Biometric Device Status & Management**: Surfaces the device's biometric security status (Active / Inactive) with one-tap registration/revocation settings.
5. **Provides Instant Financial & Leave Visibility**: Showcases leave balances, pending approval counts, latest payslip net pay summary, and broadcast company announcements.
6. **Adheres to the Web Employee Module Palette & Dynamic Theme**:
   - **Employee Primary Accent**: Golden Chestnut (`#CB793A` light / `#E2A35A` dark / `#9C5A22` light strong / `#FBF0E3` soft bg).
   - **Card & Body Surfaces**: Web Tailwind `slate-800` (`#1E293B`) cards with `slate-700` (`#334155`) borders in dark mode; pure white (`#FFFFFF`) with `#D1D9E6` borders in light mode.
   - **Real-Time OS Following**: Seamlessly shifts between Light and Dark mode dynamically in sync with the user's phone OS settings without requiring an app restart.
   - **Brand Alignment**: Clean **Zentre Link Core** header with **Enterprise Ecosystem** tagline and un-boxed crisp logo.

---

## 2. Architecture & File Structure

The mobile codebase matches the **Web Module Architecture** and **ScaleUP Layer Separation** with strictly module-only types and an identical Axios HTTP client:

```text
resources/views/mobapp/src/
├── module/                                 # 📦 Domain Feature Modules (Same as Web)
│   │
│   ├── auth/                               # 🔐 Authentication Module
│   │   ├── api/auth.api.ts                 # Login & Biometric Token Endpoints
│   │   ├── components/                     # BrandHeader, CyberButton, CyberInput, RememberMeToggle
│   │   ├── hooks/                          # useAuth, useBiometrics
│   │   ├── types/auth.types.ts             # LoginPayload, Session, AuthUser, AuthResponse
│   │   ├── pages/LoginScreen.tsx           # Mobile Access The Core Login Screen
│   │   └── index.ts                        # Auth Module Barrel (@/module/auth)
│   │
│   ├── employee/                           # 👤 Employee Portal (Primary Module)
│   │   │
│   │   ├── dashboard/                      # 📊 Employee Dashboard Submodule
│   │   │   ├── api/dashboard.api.ts        # GetEmployeeDashboardQuery endpoint
│   │   │   ├── components/                 # AppTopHeader, DashboardHeader, AttendanceHeroCard,
│   │   │   │                               # BannerCarousel, QuickActionsGrid, RecentActivityList
│   │   │   ├── hooks/useDashboard.ts       # Dashboard live data fetching hook
│   │   │   ├── types/dashboard.types.ts    # AttendanceData, CutoffPeriod, Banner, Metrics
│   │   │   ├── pages/                      # EmployeeDashboardScreen.tsx
│   │   │   └── index.ts                    # Dashboard Submodule Barrel
│   │   │
│   │   ├── timekeeping/                    # ⏱️ Timekeeping & Shifts Submodule
│   │   │   ├── api/attendance.api.ts       # Punch in/out & attendance logs API
│   │   │   ├── pages/                      # TimekeepingScreen.tsx
│   │   │   └── index.ts                    # Timekeeping Submodule Barrel
│   │   │
│   │   ├── requests/                       # 📝 Applications & Approvals Submodule
│   │   │   ├── components/                 # NewApplicationModal.tsx
│   │   │   ├── pages/                      # RequestsScreen.tsx
│   │   │   └── index.ts                    # Requests Submodule Barrel
│   │   │
│   │   ├── profile/                        # ⚙️ Employee Profile & Security Submodule
│   │   │   ├── components/                 # BiometricDeviceManager.tsx
│   │   │   ├── pages/                      # ProfileScreen.tsx
│   │   │   └── index.ts                    # Profile Submodule Barrel
│   │   │
│   │   └── index.ts                        # Employee Portal Master Barrel (@/module/employee)
│   │
│   └── index.ts                            # Root Modules Barrel (@/module)
│
├── app/                                    # 📱 Expo Router Layouts & Thin Delegators
│   ├── _layout.tsx                         # Global Providers Layout (ThemeProvider, AuthProvider)
│   ├── (auth)/login.tsx                    # -> delegates to @/module/auth (LoginScreen)
│   └── (app)/
│       ├── _layout.tsx                     # Symmetrical Bottom Tabs & Center FAB Layout
│       ├── index.tsx                       # -> delegates to @/module/employee/dashboard
│       ├── timekeeping.tsx                 # -> delegates to @/module/employee/timekeeping
│       ├── requests.tsx                    # -> delegates to @/module/employee/requests
│       └── profile.tsx                     # -> delegates to @/module/employee/profile
│
├── app/axios/                              # 🌐 Web-Identical Axios Network Layer
│   ├── axiosInstance.ts                    # Base Axios instance (baseURL, timeouts, headers)
│   ├── axiosInterceptors.ts                # Bearer token injection, FormData & Host headers
│   ├── axiosApiErrors.ts                   # Unified error parser (400, 401, 403, 404, 419, 422, 500)
│   ├── http.ts                             # HttpService (get, post, put, patch, delete, upload)
│   └── index.ts                            # Axios Barrel (@/app/axios)
│
├── components/ui/                          # 🎨 Shared UI Design System Primitives
│   ├── StatusBadge.tsx, GlassCard.tsx, StatusBanner.tsx, collapsible.tsx
│   └── index.ts
│
├── contexts/                               # ⚡ Global State Providers
│   ├── AuthContext.tsx, ThemeContext.tsx
│   └── index.ts
│
├── services/storage/                       # 💾 Secure Storage Helpers
│   ├── secure-storage.ts                   # Expo SecureStore credential & token manager
│   └── index.ts
│
└── constants/                              # 🎨 Design Tokens & Theme Constants
    ├── theme.ts                            # Palette, Spacing, Typography
    └── index.ts
```

---

## 3. Design Decisions (Pros & Cons)

### Decision 1: Symmetrical Bottom Tabs with Dead-Center FAB
- **Architecture**: 4 main tabs (`Dashboard`, `Timekeeping`, `Requests`, `Profile`) separated by a prominent center Floating Action Button (`+`).
- **Accent**: Active tabs and FAB use Golden Chestnut gradient `['#CB793A', '#D97706']`.

| Pros | Cons |
|---|---|
| Ergonomic one-thumb reach for all 4 major screens + 1-tap quick action for new filings. | Requires custom tab bar layout component (`CustomTabBar`). |
| Balanced 2-item left, 1-FAB center, 2-item right visual harmony. | |

### Decision 2: Web-Identical Axios HTTP Service
- **Architecture**: `src/app/axios/` implementing `HttpService` (`http.get`, `http.post`, `http.put`, `http.delete`) returning unwrapped response data (`response.data`) matching the web's `http.ts`.

| Pros | Cons |
|---|---|
| 1:1 parity with the web's API consumption pattern. | Requires standardizing API method calls across mobile services. |
| Automatic token injection via request interceptors and centralized error handling via `axiosApiErrors.ts`. | |

### Decision 3: Strictly Module-Only Types
- **Architecture**: Each domain module holds its own TypeScript definitions (`module/auth/types/auth.types.ts`, `module/employee/dashboard/types/dashboard.types.ts`), eliminating redundant global `src/types/` folders.

| Pros | Cons |
|---|---|
| High cohesion: moving or refactoring a module keeps types and logic together. | External files import types from the specific module (`@/module/auth` or `@/module/employee/dashboard`). |
| Eliminates type duplication and circular reference ambiguities. | |

---

## 4. Acceptance Criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | Authenticated user opens the app | App finishes login or session restore | Lands on `/(app)` (Employee Dashboard) with the Dashboard tab active in Golden Chestnut (`#E2A35A` / `#CB793A`). |
| AC-2 | User changes system theme in OS settings | Toggles phone between Light and Dark mode | App immediately reflects the theme change (`#0B1220` body / `#1E293B` cards in dark; `#E4E9F2` body / `#FFFFFF` cards in light) without restart. |
| AC-3 | User views the Hero Header | Screen renders | Displays greeting with emoji, employee ID, live updating time/date, Golden Chestnut gradient `['#9C5A22', '#CB793A', '#D97706']`, and Current Cutoff Period card. |
| AC-4 | User views the Attendance Hero Card | Dashboard loads | Displays 3-column punch times (IN, OUT, TOTAL), worked progress bar in Golden Chestnut, and biometric action button. |
| AC-5 | User views the Banner Carousel | Dashboard loads | Displays high-contrast announcement cards with module badges (`EMPLOYEE`: `#CB793A`, `PAYROLL`: `#0891B2`, `HOLIDAY`: `#DC2626`, `ADMIN`: `#8B5CF6`) and Golden Chestnut active indicators. |
| AC-6 | User taps the Center FAB (`+`) | Taps center action button in tab bar | Opens `NewApplicationModal` with slide-up animation to file Leave, Overtime, Shift Change, OBT, or Attendance Adjustment. |
| AC-7 | User navigates across tabs | Taps `Timekeeping`, `Requests`, or `Profile` | Switches smoothly to target screen with active icon highlighting in Golden Chestnut and tactile haptic feedback. |
| AC-8 | User visits Profile & Security screen | Navigates to `Profile` | Displays avatar, employee info, Appearance & Theme selector (System / Light / Dark), Biometric Device Manager, and Sign Out button. |
| AC-9 | User signs out | Confirms sign-out dialog | Clears session tokens from `SecureStore` and redirects cleanly to `/(auth)/login`. |
| AC-10 | Network error occurs | Any API endpoint fails | Parsed through `axiosApiErrors.ts` into a friendly, non-crashing status message. |

---

## 5. Backend (API Contracts)

### Reused Endpoints
1. **`GET /api/employee/dashboard` & `GET /api/employee/dashboard/refresh`**:
   - Returns aggregated `DashboardData` payload (user, cutoff period, attendance, KPI metrics, recent requests, payslip, announcements).
2. **`POST /api/attendance/record`**:
   - Records attendance punch (`timein` / `timeout`).
3. **`GET /api/biometric/devices` & `POST /api/biometric/register` & `POST /api/biometric/revoke`**:
   - Enrolls, lists, and revokes biometric hardware credentials.
4. **`POST /api/login` & `POST /api/logout`**:
   - Authenticates and invalidates user sessions.

---

## 6. Definition of Done

- [x] Symmetrical 4-Tab Bottom Bar with Golden Chestnut center FAB (`+`) and active states implemented.
- [x] Clean Zentre Link Core branding and tagline in Top Header without glowing box.
- [x] Dynamic Light/Dark/System theme tracking connected to React Native `useColorScheme()`.
- [x] Card backgrounds calibrated to Web `slate-800` (`#1E293B`) with `slate-700` (`#334155`) borders.
- [x] Primary theme accent calibrated to Web Employee Module Golden Chestnut (`#CB793A` / `#E2A35A` / `#9C5A22`).
- [x] Hero Header and Banner Carousel gradients aligned with the Golden Chestnut palette.
- [x] Codebase organized into web-identical domain modules (`src/module/auth`, `src/module/employee/*`).
- [x] Axios network layer structured matching the web (`src/app/axios/`).
- [x] Type definitions placed strictly inside their respective domain modules.
- [x] `npx tsc --noEmit` verified with 0 errors.
- [x] All code committed and pushed to `https://github.com/ZentreLinkCore/hrms-react-native.git` on `main`.
