# Code Review: Mobile Employee Dashboard & Navigation (`resources/views/mobapp`)

> **Scope:** `resources/views/mobapp` diff (uncommitted / `feature/fix-mobile-dashboard-conformance`) — 23 files, +153 / -266 lines
> **Branch:** `feature/fix-mobile-dashboard-conformance` (in `resources/views/mobapp`)
> **Reviewed:** 2026-09-02
> **Verdict:** APPROVE WITH COMMENTS

---

## 1. Summary

The code changes across the React Native mobile client successfully resolve all spec conformance and TypeScript compilation defects identified in verification. The post-login navigation flow correctly routes authenticated users straight to the dashboard hub, metric/KPI cards and latest payslip summaries are seamlessly integrated, haptic feedback is added to tab/FAB interactions, and NativeWind type declarations are cleanly resolved. All type-checks (`npx tsc --noEmit`) pass with 0 errors. Only two minor low-severity cosmetic items were noted (a stale JSDoc header in `LoginScreen.tsx` and an unconditional `console.log` in `axiosInstance.ts`).

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | 0 | anything ships |
| HIGH | 0 | merge |
| MEDIUM | 0 | end of milestone |
| LOW | 2 | — |

---

## 2. Findings

### F1 — Stale Nested JSDoc Header in LoginScreen · `LOW` · `maintainability`

- **Location:** [`src/module/auth/pages/LoginScreen.tsx:47-50`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L47-L50)
- **Problem:** During the removal of the post-login attendance interceptor, an opening JSDoc comment header (`/**\n * Post-auth gate (AC-3 / spec v2)...`) was left unclosed above the replacement comment.
- **Failure scenario:** No runtime breakage, but creates confusing/stale comments in a security-sensitive authentication file.
- **Rule:** `coding-standards.md` § Maintainability (stale comments).
- **Suggested fix:** In [`resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L47-L50), remove lines 47–49 so only the current JSDoc for `routeAfterLogin()` remains:

  ```typescript
  /**
   * Route user directly to the Mobile Employee Dashboard upon successful sign-in
   * (Spec §1.1 & AC-1)
   */
  const routeAfterLogin = async () => {
    router.replace('/(app)');
  };
  ```

- **Effort:** `trivial` (1 file, lines 47–49)
- **Regression risk:** `none`

---

### F2 — Unconditional Top-Level Log in Axios Instance · `LOW` · `maintainability`

- **Location:** [`src/app/axios/axiosInstance.ts:43`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/axios/axiosInstance.ts#L43)
- **Problem:** `console.log('[Axios] Active Base URL:', baseURL);` logs on every module load.
- **Failure scenario:** While helpful during development with Expo Go, unconditional top-level logs create console clutter in test runners or production builds.
- **Rule:** `coding-standards.md` § Clean Code (production logging discipline).
- **Suggested fix:** In [`resources/views/mobapp/src/app/axios/axiosInstance.ts:43`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/axios/axiosInstance.ts#L43), wrap with `if (__DEV__)`:

  ```typescript
  if (__DEV__) {
    console.log('[Axios] Active Base URL:', baseURL);
  }
  ```

- **Effort:** `trivial` (1 file, line 43)
- **Regression risk:** `none`

---

## 3. Fix Plan

| Order | Finding | Severity | Change | File(s) | Status | Effort |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | F1 | LOW | Remove unclosed stale JSDoc comment above `routeAfterLogin()` | [`src/module/auth/pages/LoginScreen.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx) | **RESOLVED** | trivial |
| 2 | F2 | LOW | Guard `console.log` with `if (__DEV__)` | [`src/app/axios/axiosInstance.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/axios/axiosInstance.ts) | **RESOLVED** | trivial |

**Fix Resolution (2026-09-02):**

- **F1:** Removed stale duplicate JSDoc comment header in [`LoginScreen.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx).
- **F2:** Wrapped top-level `console.log` in [`axiosInstance.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/axios/axiosInstance.ts) with `if (__DEV__)`.
- **Static Analysis:** Verified with `npx tsc --noEmit` (0 errors).

---

## 4. What Was Verified

1. **TypeScript Typecheck:** Executed `npx tsc --noEmit` in `resources/views/mobapp`. 0 errors reported.
2. **Post-Login Routing:** Traced `routeAfterLogin()` in [`LoginScreen.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L54) ensuring no interceptor jumps to `/(app)/time-in-out`.
3. **Metric Cards Integration:** Verified JSX hierarchy in [`EmployeeDashboardScreen.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/dashboard/pages/EmployeeDashboardScreen.tsx) renders `MetricCardsRow` and `PayslipSnapshotCard`.
4. **Haptic Feedback:** Verified `handleTabPress` and `handleFabPress` in [`_layout.tsx`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/app/(app)/_layout.tsx) trigger `Haptics.impactAsync` on non-web platforms.
5. **ScrollView Props:** Verified `contentContainerStyle` replaces invalid `contentContainerClassName` across `ProfileScreen`, `RequestsScreen`, `TimekeepingScreen`, and `AIChatbotModal`.
6. **Encapsulation & Re-exports:** Verified that `@/module/employee/dashboard` exports cleanly while `@/components` and `@/hooks` maintain seamless backward-compatibility.

---

## 5. Pre-existing Issues

- **Untracked Directory (`resources/views/mobapp-vue/`)**: The root repository has an untracked scratch folder from previous Vue mobile experiments; does not affect the active Expo app in `resources/views/mobapp`.

---

## 6. Review Limits

- Biometric hardware prompt execution was verified via static code analysis and mocking rather than on a physical iOS FaceID / Android Fingerprint biometric sensor.
- Push notification handling depends on native OS permissions during runtime.

---

## Follow-up Commands

- Apply the minor cleanups: `/webkit.fix resources/views/mobapp using .agents/reports/employee-mobile_dashboard-review-20260902.md`
