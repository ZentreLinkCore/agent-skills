# Investigation Report: Mobile App Login Redirect to Attendance Cockpit vs Dashboard (with Holiday & Rest Day Rules)

## 1. Summary
- **Investigation Type**: Bug / Business Logic & Navigation Routing Flow Investigation
- **Project**: SubHRMS (React Native Expo Mobile Client in `resources/views/mobapp` + Laravel Backend)
- **Target Portal/Domain & Module**: Employee Portal / Mobile App (`auth`, `attendance`, `dashboard`)
- **Confidence Level**: High

---

## 2. Issue Description & Refined Business Rules
- **Expected Behavior**:
  - **Working Day & NOT Timed In Today**: The app must navigate/redirect to the **Attendance Cockpit / Time In-Out** screen (`/(app)/time-in-out` — [AttendanceCockpitScreen](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/attendance/pages/AttendanceCockpitScreen.tsx)).
  - **Working Day & Already Timed In Today**: The app must navigate/redirect to the **Dashboard** (`/(app)` — [EmployeeDashboardScreen](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/dashboard/pages/EmployeeDashboardScreen.tsx)).
  - **Holiday or Rest Day**: The app must navigate/redirect directly to the **Dashboard** (`/(app)`), bypassing the Attendance Cockpit since the employee is not expected to clock in on non-working days.
- **Actual Behavior**:
  - Upon logging in, completing biometric setup, or launching the app with an existing authenticated session, the app redirects directly to the **Dashboard** (`/(app)`), bypassing the Attendance Cockpit even on regular working days when the employee has not timed in yet.
- **Steps to Reproduce**:
  1. Ensure today is a regular working day and the employee account has no time-in record for today (`tbl_timesheet` has no active `timein` for current date).
  2. Open the mobile app or sign in via email/password on [LoginScreen](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx).
  3. Observe that after authentication, the user lands directly on the Employee Dashboard instead of the Time In / Attendance screen.

---

## 3. Root Cause Analysis

### 3.1 Chain of Causes & Evidence

#### 1. Cold Start & App Entrypoint Bypasses Attendance & Working Day Status
- In [src/app/index.tsx:17](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/index.tsx#L17), the root entry redirect is hardcoded:
  ```tsx
  return <Redirect href={isAuthenticated ? '/(app)' : '/(auth)/login'} />;
  ```
  When an employee who is already authenticated (from a persisted JWT session) opens the app on a new workday, `index.tsx` unconditionally routes them to `'/(app)'` (the Dashboard), without evaluating `AttendanceApi.getTodayAttendance()`.

#### 2. Biometric Setup Wizard Completion Routes Directly to Dashboard
- In [src/app/(auth)/biometric-setup.tsx:80](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/%28auth%29/biometric-setup.tsx#L80) and [useBiometricSetup.ts:191](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/hooks/useBiometricSetup.ts#L191):
  ```tsx
  onFinish={() => router.replace('/(app)')}
  ```
  When a user logs in for the first time on a biometric-capable device, they are sent to the Biometric Setup wizard. When they complete or skip setup, both handlers hardcode `router.replace('/(app)')`, completely bypassing the post-auth attendance check.

#### 3. Root Navigation Layout Hydration Auto-Redirects to Dashboard
- In [src/app/_layout.tsx:60-68](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/_layout.tsx#L60-L68):
  ```tsx
  if (!isAuthenticated && !inAuthGroup) {
    router.replace('/(auth)/login');
  } else if (isAuthenticated && inAuthGroup && !isBiometricSetup && !hasHydratedRef.current) {
    hasHydratedRef.current = true;
    router.replace('/(app)');
  }
  ```
  When the session changes or hydrates while on an auth screen, `RootNavigationLayout` auto-redirects to `'/(app)'`.

#### 4. Missing Holiday & Rest Day Exemption in Post-Auth Gate
- In [src/module/auth/pages/LoginScreen.tsx:53-68](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L53-L68), `routeAfterLogin` did not account for `is_holiday` and `is_restday`:
  ```tsx
  const needsAttendance =
    !attendance.has_timed_in ||
    attendance.needs_reset ||
    (attendance.has_timed_in && Boolean(attendance.time_out));
  ```
  Without checking `shift_info.is_holiday` and `shift_info.is_restday`, employees logging in on weekends/holidays would be sent to the cockpit rather than the dashboard.

#### 5. Backend Open Shift Lookup Can Misidentify Stale Historical Records as "Timed In"
- In [app/Http/Controllers/AttendanceController.php:39-47](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Http/Controllers/AttendanceController.php#L39-L47):
  ```php
  // 2. If none for today, look for any open unclosed shift from within 16 hours
  if (!$timesheet) {
      $timesheet = Timesheet::where('idacct', $user->id)
          ->whereNotNull('timein')
          ->whereNull('timeout')
          ->orderBy('date', 'desc')
          ->orderBy('id', 'desc')
          ->first();
  }
  ```
  The query in Step 2 has no date bound or timestamp constraint. If an employee had an unclosed timesheet from a previous date (e.g., forgot to timeout days ago), it retrieves that old timesheet. If `$timesheet->date_in` is empty and falls back to `$today`, `$hoursSinceTimeIn` calculates as 0 hours, causing the server to return `has_timed_in: true` and `needs_reset: false`, leading [LoginScreen.tsx:56-63](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L56-L63) to route to the Dashboard.

---

## 4. Scope & Dependencies

### Affected Files
1. **Frontend (Mobile App React Native / Expo Router)**:
   - [resources/views/mobapp/src/services/navigation/auth-routing.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/services/navigation/auth-routing.ts) `[NEW]` — Centralized post-auth route resolver with Holiday & Rest Day awareness.
   - [resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx) — `routeAfterLogin` integration.
   - [resources/views/mobapp/src/app/index.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/index.tsx) — Initial dynamic route resolver on cold start / app launch.
   - [resources/views/mobapp/src/app/_layout.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/_layout.tsx) — Auth state transition handler in `RootNavigationLayout`.
   - [resources/views/mobapp/src/app/(auth)/biometric-setup.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/%28auth%29/biometric-setup.tsx) — Post-setup redirection callback.
   - [resources/views/mobapp/src/module/auth/hooks/useBiometricSetup.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/hooks/useBiometricSetup.ts) — Finish onboarding handler.
2. **Backend (Laravel API)**:
   - [app/Http/Controllers/AttendanceController.php](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Http/Controllers/AttendanceController.php) — `today()` method date bounds, open shift resolution, and explicit `is_working_day` flag in response.

---

## 5. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **Option A (Recommended)** | Create a centralized `resolvePostAuthRoute()` navigation utility on mobile that checks `is_holiday`, `is_restday`, and `has_timed_in`; wire across `LoginScreen`, `BiometricSetup`, `index.tsx`, and `_layout.tsx`; and harden backend `AttendanceController::today()` query bounds. | Unified single source of truth for routing logic; cleanly handles cold starts, login, biometric setup, and rest days/holidays; robust against stale DB records. | Touches frontend routing files and attendance controller. | Low |
| **Option B** | Inline checks in each individual screen file. | Avoids creating a shared utility file. | Violates DRY; high risk of future routing divergence across login, biometric setup, and cold-starts. | Medium |

---

### Recommended Solution Architecture

```
                      User Logs In / App Launches
                                  │
                                  ▼
                    resolvePostAuthRoute()
                                  │
                                  ▼
                    Fetch Attendance Today
                   (GET /api/attendance/today)
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          Is Holiday or Rest Day?          Working Day
                    │                           │
                    ▼                           ▼
            Route to Dashboard          Has Timed In Today?
                 (/(app))                       │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                                   Yes                      No
                                    │                       │
                                    ▼                       ▼
                           Route to Dashboard    Route to Attendance Cockpit
                                (/(app))             (/(app)/time-in-out)
```

---

## 6. High-Level Implementation Plan

### 1. Backend Hardening (`AttendanceController.php`)
1. `[x]` In [app/Http/Controllers/AttendanceController.php](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Http/Controllers/AttendanceController.php#L39-L85):
   - Restrict Step 2 (open shift lookup) to shifts within the last 24 hours (`today` or `yesterday`).
   - Include `is_working_day`, `is_restday`, and `is_holiday` in the JSON response payload.

### 2. Frontend Centralized Post-Auth Route Resolver
2. `[x]` Create [resources/views/mobapp/src/services/navigation/auth-routing.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/services/navigation/auth-routing.ts) and export from services barrel.

### 3. Frontend Screen Integration
3. `[x]` In [resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx): Update `routeAfterLogin` to use `resolvePostAuthRoute()`.
4. `[x]` In [resources/views/mobapp/src/app/(auth)/biometric-setup.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/%28auth%29/biometric-setup.tsx) and [resources/views/mobapp/src/module/auth/hooks/useBiometricSetup.ts](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/hooks/useBiometricSetup.ts): Replace hardcoded `router.replace('/(app)')` with `resolvePostAuthRoute()`.
5. `[x]` In [resources/views/mobapp/src/app/index.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/index.tsx) & [src/app/_layout.tsx](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/_layout.tsx): Dynamically invoke `resolvePostAuthRoute()` on app launch when `isAuthenticated` is true.

---

## 7. Testing & Verification Checklist
- [x] **Working Day (No Time In)**: User logs in -> Redirects to `/(app)/time-in-out` (Attendance Cockpit).
- [x] **Working Day (Timed In)**: User logs in -> Redirects to `/(app)` (Dashboard).
- [x] **Rest Day**: User logs in -> Redirects directly to `/(app)` (Dashboard).
- [x] **Holiday**: User logs in -> Redirects directly to `/(app)` (Dashboard).
- [x] **Biometric Setup Completion**: On a working day without time-in -> Redirects to `/(app)/time-in-out`.
- [x] **Cold Start (Already Authenticated)**: Launch app on a working day without time-in -> Redirects to `/(app)/time-in-out`.
- [x] **Attendance Punch In**: Successfully clocking in from Attendance Cockpit -> Redirects to `/(app)` (Dashboard).

---

## 8. Resolution Summary
- **Date**: 2026-09-02
- **Applied Fixes**:
  1. Backend `AttendanceController.php::today()`: Constrained historical open shift search to today/yesterday (last 16–24 hours) and explicitly passed `is_holiday`, `is_restday`, and `is_working_day` boolean flags.
  2. Mobile Frontend `src/services/navigation/auth-routing.ts`: Created `resolvePostAuthRoute()` implementing the holiday/rest day bypass and working day time-in checks.
  3. Integrated across `LoginScreen.tsx`, `biometric-setup.tsx`, `useBiometricSetup.ts`, `index.tsx`, and `_layout.tsx`.
  4. Typecheck verified cleanly with zero errors (`npx tsc --noEmit`).

