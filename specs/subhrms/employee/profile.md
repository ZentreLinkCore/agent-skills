# Spec — Employee Profile Mobile App Screen (Expo React Native)

> **Kind:** Greenfield / UI Migration — Porting and enhancing the complete Employee Profile Hub UI from `mobapp-vue` (`ProfilePage.vue`) into the React Native mobile application (`resources/views/mobapp/src/module/employee/profile`).
> **Portal:** **Employee** (`/api/employee/...` routes, `profile` mobile module).
> **Version:** v1 — 2026-08-31 — initial.
> **Route:** `/(app)/profile` (`ProfileScreen`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [laravel-standards.md](../../rules/laravel-standards.md), [hrms-rules.md](../../rules/hrms-rules.md).
> **System Awareness:** Models reused (`Account`, `Unit`); Views/Tables reused (`vw_accounts_details`, `vw_site`); Routes reused (`api/employee/profileDetails`, `api/employee/dashboard`, `api/auth/logout`); New migration: **No**.

---

## 1. Purpose

The **Employee Profile Screen** serves as the central account management and navigation hub for mobile employees in Zentre Link Core. It provides employees with:
1. **Identity & Status Showcase**: Visual header card featuring the employee's avatar (with glow and ring accents), full name, employee ID badge, role/position chip, department chip, and employment status.
2. **Quick Metrics Strip**: 3-column stats ribbon summarizing years in service, remaining leave balances, and attendance compliance rate.
3. **Categorized Menu Groups**: Seamlessly organized action menus mirroring the web/Vue mobile architecture:
   - **Account**: Personal Information, Employment Details, My Documents.
   - **Compensation**: Compensation & Benefits, Year-to-Date (YTD) Summary.
   - **Updates**: Company Announcements.
   - **Preferences**: Push Notification toggle, Theme & Appearance picker (System/Light/Dark).
   - **Security**: Change Password, Biometric Authentication / Device Hardware Security.
   - **Support**: Help Center & FAQs.
4. **Secure Sign Out**: Destructive sign-out workflow with haptic feedback, confirmation modal, token revocation, and state cleanup.

This spec defines the 1:1 port of `resources/views/mobapp-vue/src/module/employee/profile/pages/ProfilePage.vue` into modern React Native (Expo 54, React 19, TypeScript, NativeWind/Tailwind, Lucide icons, Expo Haptics, Expo Linear Gradient).

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Component Decomposition & Architecture

**Option A — Decomposed Modular Architecture with Dedicated Subcomponents (Recommended)**
- Structure the profile module into clean, single-responsibility components:
  - `ProfileHeaderCard.tsx`: Avatar with glow/ring, full name, employee ID badge, role & department chips, and 3-column quick stats.
  - `ProfileMenuGroup.tsx`: Card wrapper rendering section titles (`ACCOUNT`, `COMPENSATION`, etc.) and a group of menu items.
  - `ProfileMenuItem.tsx`: Clickable list item supporting icon color variants, titles, subtitles, right chevron or interactive toggle switches.
  - `ProfileSignOutButton.tsx`: Gradient destructive button with spinning loader state on sign out.
  - `ProfileScreen.tsx`: Main page layout integrating pull-to-refresh, safe-area insets, and subcomponents.

| Pros | Cons |
|---|---|
| Clean separation of concerns; highly reusable list item and card patterns across other mobile screens. | Requires creating 4 dedicated subcomponent files under `src/module/employee/profile/components/`. |
| Clean and easy to test, maintain, and animate independently. | |
| Matches the modular pattern established across `dashboard` and `timekeeping`. | |

**Option B — Monolithic Single File Screen**
- Write all header, list group, toggle, and dialog logic in a single ~600-line `ProfileScreen.tsx`.

| Pros | Cons |
|---|---|
| Single file to view. | High cognitive load, harder to unit-test, duplicates styling and list item layout logic. |

**Recommendation:** **Option A**. Follows standard project structure and matches the existing modular pattern in `mobapp/src/module/employee/dashboard`.

---

### Decision 2: Data Aggregation & State Management

**Option A — Dedicated `useProfile` Hook with SWR-style Caching and Pull-to-Refresh (Recommended)**
- Create `useProfile.ts` hook that:
  1. Utilizes cached user and attendance data from `useDashboard()` or calls `ProfileApi.getProfile()`.
  2. Aggregates tenure calculation (from `hire_date`), leave balance (from entitlements), and attendance rate.
  3. Provides a unified `refresh()` function that triggers haptic feedback on pull-to-refresh.
  4. Manages notification preferences and theme changes.

| Pros | Cons |
|---|---|
| Encapsulates data fetching, caching, transformation, and error handling away from the UI. | Adds a small custom hook file. |
| Instant render using existing auth/dashboard cache, followed by background synchronization. | |

**Option B — Direct Inline Axios Fetching in Screen Component**
- Execute `axiosInstance.get('/employee/profileDetails')` directly inside a `useEffect` inside `ProfileScreen.tsx`.

| Pros | Cons |
|---|---|
| One less file. | Couples network logic with rendering; misses cached fallback state during offline/poor network. |

**Recommendation:** **Option A**. Provides resilient data handling, smooth skeleton states, and clean separation of concerns.

---

### Decision 3: Sub-screen Navigation & Placeholder Handling

**Option A — Route-Driven Navigation with Fallback Action Alerts for Unbuilt Subpages (Recommended)**
- Register navigation routes using `expo-router` (`router.push('/(app)/personal-info')`, etc.).
- For submodules not yet ported into the React Native app (e.g. `my-documents`), display a polished "Feature Coming Soon" toast or bottom sheet modal without crashing the app.

| Pros | Cons |
|---|---|
| Full parity with Vue routing while preventing broken links for features still in development. | Requires fallback handlers for unmigrated routes. |
| Enables incremental migration of sub-screens without blocking the Profile Hub launch. | |

**Option B — Disable / Hide Unbuilt Menu Items**
- Only render menu items whose subpages are already fully implemented.

| Pros | Cons |
|---|---|
| Every visible item works. | Profile screen looks incomplete compared to `mobapp-vue`; breaks UI parity requested by the user. |

**Recommendation:** **Option A**. Maintains full visual fidelity with `mobapp-vue` while safely handling navigation.

---

### Decision 4: Biometric & Device Security Integration

**Option A — Embedded Biometric Security Item inside the Security Section (Recommended)**
- In addition to "Change Password", render a "Biometric Authentication" menu item / toggle in the Security section, and embed the existing `BiometricDeviceManager` component as an expandable security sheet or inline widget.

| Pros | Cons |
|---|---|
| Leverages the existing `BiometricDeviceManager` in `mobapp` while maintaining the clean menu aesthetic of `mobapp-vue`. | Slightly more UI interactions to test. |

**Option B — Standalone Biometric Card only**
- Display a large biometric card separately at the bottom of the screen.

| Pros | Cons |
|---|---|
| Visible by default. | Disrupts the grouped list aesthetic from `mobapp-vue`. |

**Recommendation:** **Option A**. Blends native biometric security seamlessly into the categorized menu hierarchy.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | An authenticated employee opens the app | Navigates to the Profile tab (`/(app)/profile`) | The profile screen renders with header card, avatar, full name, employee ID, position chip, department chip, and quick stats. |
| AC-2 | The employee has an active profile photo or custom image | Profile screen is loaded | `ProfileAvatar` renders the employee photo with border ring, outer glow, and online status dot. |
| AC-3 | The employee has no profile photo | Profile screen is loaded | `ProfileAvatar` renders the employee initials or fallback icon gracefully. |
| AC-4 | The employee has a valid `hire_date` | Quick stats are calculated | Years in service displays accurate integer tenure (e.g. "3 Years"). |
| AC-5 | The employee views the menu list | Scrolls through the profile | All 6 categorized sections render with correct colored icon badges, titles, subtitles, and chevron arrows. |
| AC-6 | The employee toggles the Notifications switch | Taps on the notification toggle item | The toggle switches state with Light Haptic feedback and updates local preference. |
| AC-7 | The employee taps the Appearance / Theme item | Selects Light, Dark, or System mode | Theme updates immediately across the app via `useAppTheme().setThemeMode()`, and selection haptics fire. |
| AC-8 | The employee taps on a categorized sub-menu (e.g. Personal Information) | Taps the menu row item | App navigates to the target route (`/(app)/personal-info`) via `expo-router`. |
| AC-9 | The employee taps the "Sign Out" button | Confirmation alert appears and user confirms "Sign Out" | `logout()` is called, auth tokens/storage are cleared, success haptic plays, and user is redirected to `/(auth)/login`. |
| AC-10 | The employee taps "Cancel" on the Sign Out confirmation dialog | Cancels the prompt | Dialog closes, `isLoggingOut` is set to `false`, and user remains on the Profile screen. |
| AC-11 | The employee pulls down to refresh the profile | Performs pull-to-refresh gesture | Refresh spinner shows, profile & dashboard data reload from `/api/employee/profileDetails`, and light haptics trigger on completion. |
| AC-12 | Dark mode is activated | Profile screen is viewed in dark mode | Card backgrounds use `#1E293B` (slate-800), borders use `#334155` (slate-700), text uses slate-100/slate-400, and contrast meets WCAG AA standards. |

---

## 3. Database

### Reused Views & Tables (SubHRMS Standards)
- **`vw_accounts_details`** (View): Main source of truth for employee profile fields:
  - Identity: `id`, `empid`, `fname`, `lname`, `mname`, `fullname`, `profile`, `email`, `contact_number`
  - Employment: `pos_id`, `unit_id`, `idlvl`, `emptype_id`, `hire_date`, `status`, `wshift`
  - Computed Fields: `age`, `position`, `classification`, `employee_type`
- **`vw_site`** (View): Company location and branch metadata (`name`, `citymunDesc`).
- **`leaves_entitlement` / `account_leaves`**: Provides remaining leave balances.

*No new database migrations or schema adjustments are required.*

---

## 4. Backend

### Reused Controller & Query Endpoints

1. **`GET /api/employee/profileDetails`**
   - **Controller:** `App\Http\Controllers\employee\ProfileController::index`
   - **Query:** `App\Queries\Employee\GetEmployeeProfileQuery::execute()`
   - **Output Format:**
     ```json
     {
       "user": {
         "id": 1,
         "empid": "EMP-00001",
         "fullname": "Juan Dela Cruz",
         "email": "juan@example.com",
         "position": "Software Developer",
         "classification": "IT Department",
         "hire_date": "2023-01-15",
         "profile": "juan.jpg",
         "status": 1,
         "status_name": "Active"
       },
       "leave": [
         { "leave_type": "Vacation Leave", "balance": 8 },
         { "leave_type": "Sick Leave", "balance": 4 }
       ],
       "allowance": []
     }
     ```

2. **`GET /api/employee/dashboard`**
   - **Controller:** `App\Http\Controllers\employee\DashboardController::index`
   - **Output:** Quick dashboard summary with user information and attendance stats.

3. **`POST /api/auth/logout`**
   - **Controller:** `App\Http\Controllers\auth\AuthController::logout`
   - **Output:** `{ "message": "Logged out successfully" }`

---

## 5. Frontend

### Module Structure (`resources/views/mobapp/src/module/employee/profile/`)

```
resources/views/mobapp/src/module/employee/profile/
├── api/
│   └── profile.api.ts              # API client for profile endpoints
├── components/
│   ├── ProfileHeaderCard.tsx       # Avatar with glow, Name, ID badge, Role chips, Stats strip
│   ├── ProfileMenuGroup.tsx        # Section label container for list items
│   ├── ProfileMenuItem.tsx         # Reusable list row (icon badge, title, subtitle, arrow/toggle)
│   ├── ProfileThemeModal.tsx       # Bottom sheet / modal for Light/Dark/System theme selection
│   └── ProfileSignOutButton.tsx    # Destructive gradient action button with loading spinner
├── hooks/
│   └── useProfile.ts               # State aggregation, tenure/leave calculations, pull-to-refresh
├── pages/
│   └── ProfileScreen.tsx           # Main composite screen view
├── types/
│   └── profile.types.ts            # TypeScript interfaces & menu models
└── index.ts                        # Module barrel export
```

### Visual & Component Specifications

#### 1. Header Card (`ProfileHeaderCard.tsx`)
- **Background**: Modern curved container (`rounded-3xl`), with a dynamic top linear gradient header banner (`from-amber-600 via-amber-700 to-amber-900` or `#CB793A` theme gradient) with abstract pattern/glow overlay.
- **Avatar Container**:
  - `avatar-glow`: `absolute -inset-2 rounded-full bg-amber-500/30 blur-md`
  - `avatar-ring`: `p-1 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 shadow-md`
  - `avatar-inner`: `w-24 h-24 rounded-full overflow-hidden border-2 border-white dark:border-slate-800`
  - `status-dot`: `absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800`
- **User Identity**:
  - `user-name`: `text-xl font-extrabold text-slate-900 dark:text-slate-100 text-center`
  - `user-id-badge`: Pill badge with `ShieldCheck` icon + `#{empid}` with soft amber background (`bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40`).
- **Role & Department Chips**:
  - Role Chip: `Briefcase` icon + Position title (`bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300`).
  - Department Chip: `Building2` icon + Department/Unit name (`bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300`).
- **Quick Stats Ribbon**:
  - 3-column horizontal summary divided by vertical border lines (`border-slate-200 dark:border-slate-700`):
    1. **Tenure**: `{years}` (Label: "Years")
    2. **Leaves Left**: `{totalLeaveBalance}` (Label: "Leaves Left")
    3. **Attendance**: `{attendanceRate}%` (Label: "Attendance")

#### 2. Categorized Menu Groups (`ProfileMenuGroup.tsx` & `ProfileMenuItem.tsx`)
Each group renders an uppercase section title (`text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 px-1 py-2`) and an enclosed card group containing items:

| Section | Menu Item | Icon | Color Badge | Subtitle | Action / Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Account** | Personal Information | `User` | Blue (`bg-blue-500/15 text-blue-500`) | View and edit your details | `router.push('/(app)/personal-info')` |
| | Employment Details | `Briefcase` | Purple (`bg-purple-500/15 text-purple-500`) | Job info and history | `router.push('/(app)/employment-details')` |
| | My Documents | `Folder` | Orange (`bg-orange-500/15 text-orange-500`) | Contracts, certificates | `router.push('/(app)/my-documents')` |
| **Compensation** | Compensation & Benefits | `Gift` | Pink (`bg-pink-500/15 text-pink-500`) | Benefits and allowances | `router.push('/(app)/compensation-benefits')` |
| | Year to Date | `Calendar` | Indigo (`bg-indigo-500/15 text-indigo-500`) | Annual earnings summary | `router.push('/(app)/year-to-date')` |
| **Updates** | Announcements | `Megaphone` | Yellow (`bg-amber-500/15 text-amber-500`) | Company news and updates | `router.push('/(app)/announcements')` |
| **Preferences** | Notifications | `Bell` | Green (`bg-emerald-500/15 text-emerald-500`) | Manage alerts and reminders | Interactive Switch Toggle |
| | Appearance | `Palette` | Rose (`bg-rose-500/15 text-rose-500`) | Theme and display | Opens Theme Selector Modal |
| **Security** | Change Password | `Lock` | Red (`bg-red-500/15 text-red-500`) | Update your password | `router.push('/(app)/change-password')` |
| | Biometric Security | `Fingerprint` | Cyan (`bg-cyan-500/15 text-cyan-500`) | Face ID / Touch ID login | Opens Biometric Device Manager |
| **Support** | Help Center | `HelpCircle` | Sky (`bg-sky-500/15 text-sky-500`) | FAQs and support | `router.push('/(app)/help-center')` |

#### 3. Sign Out Section (`ProfileSignOutButton.tsx`)
- **Button Styling**: `w-full py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-[0.98] shadow-md flex-row items-center justify-center gap-2.5`.
- **Content**: `LogOut` icon (spinning if logging out) + "Sign Out" text.
- **Confirmation**: Native `Alert.alert('Sign Out', 'Are you sure you want to sign out?', ...)` with cancel and destructive sign out buttons.
- **Footer**: `text-center text-xs text-slate-400 dark:text-slate-500 mt-4` displaying `"HRMS Mobile v1.0.0 • Build 2026.08"`.

---

## 6. Business Rules & Edge Cases

### Business Rules
1. **Tenure Calculation**: Calculated using difference in full years between `hire_date` and today. If `hire_date` is missing or invalid, fallback to `1 Year`.
2. **Leave Balance Aggregation**: Computed by summing all active leave balances in the `leave` entitlement array returned by `GetEmployeeProfileQuery`. If no leaves exist, fallback to `0`.
3. **Attendance Rate**: Sourced from the current month's attendance compliance or defaults to `100%` when no late/undertime infractions exist.
4. **Theme Persistence**: Switching between `system`, `light`, and `dark` saves immediately to device storage (`AsyncStorage` / `SecureStore`) and updates `ThemeContext`.
5. **Token Revocation on Logout**: In addition to local storage cleanup, the app invokes the backend logout endpoint to invalidate the Sanctum personal access token.

### Non-Functional & Failure-Mode Checklist

| Category | Must state |
|---|---|
| **Authorization** | Restricted to authenticated mobile users (`auth:sanctum`). If token is expired or unauthorized (`401`), session is terminated and user is routed to `/(auth)/login`. |
| **Concurrency / double-submit** | Sign out button disables immediately upon confirmation (`isLoggingOut = true`) with a spinner to prevent duplicate logout requests. |
| **Idempotency on retries** | Profile reads are idempotent GET queries. Multiple pull-to-refresh requests safely overwrite local state without side effects. |
| **Error response shape & status codes** | If profile fetch fails (`500` or network timeout), the app falls back to cached `useAuth().user` data and displays a non-blocking toast banner. |
| **Input validation boundaries** | Notification toggle bounds state to boolean (`true/false`). Theme mode validates against union `'system' \| 'light' \| 'dark'`. |

---

## 7. Build Order

1. **Types & API Layer**:
   - Create `resources/views/mobapp/src/module/employee/profile/types/profile.types.ts`.
   - Create `resources/views/mobapp/src/module/employee/profile/api/profile.api.ts`.
2. **Custom Hook**:
   - Create `resources/views/mobapp/src/module/employee/profile/hooks/useProfile.ts` with tenure, leave balance, attendance computations, and pull-to-refresh.
3. **Subcomponents (Gate 1 Design-First UI)**:
   - Create `ProfileHeaderCard.tsx` (avatar, glow ring, employee ID badge, role/department chips, stats ribbon).
   - Create `ProfileMenuItem.tsx` & `ProfileMenuGroup.tsx` (categorized section lists, colored icon badges, toggle switch).
   - Create `ProfileThemeModal.tsx` (theme mode picker sheet).
   - Create `ProfileSignOutButton.tsx` (destructive action button with confirmation alert).
4. **Composite Page & Barrel**:
   - Implement `resources/views/mobapp/src/module/employee/profile/pages/ProfileScreen.tsx`.
   - Export components in `resources/views/mobapp/src/module/employee/profile/index.ts`.
5. **Route Integration & Verification**:
   - Verify `resources/views/mobapp/src/app/(app)/profile.tsx` renders the new `ProfileScreen`.
   - Verify dark mode, light mode, pull-to-refresh, haptics, and responsive layout across iOS, Android, and Web preview.

---

## 8. Out of Scope (Future Specs)

- **Dedicated Sub-pages Implementation**: Building the complete full screens for `Personal Info`, `Employment Details`, `My Documents`, `Compensation & Benefits`, `Year to Date`, `Announcements`, and `Help Center` will each be specced and implemented in their own respective modules (e.g. `module/employee/personal-info/`, etc.).
- **Push Notification Backend Registration**: Registering Expo push tokens with APNs/FCM backend queue is covered under a separate mobile push notifications spec.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` … `AC-12`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] Visual design exactly mirrors the aesthetic, structure, and styling of `mobapp-vue/src/module/employee/profile/pages/ProfilePage.vue` adapted for React Native / Tailwind.
- [ ] Spec is persisted on disk under `.agents/specs/subhrms/employee/profile.md`.

<!-- Changelog:
- v1 — 2026-08-31 — initial baseline spec for mobile employee profile screen ported from mobapp-vue.
-->
