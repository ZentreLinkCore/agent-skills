# Conformance Report: Mobile Attendance Time In / Time Out Flow & Daily Gate

> **Spec:** [time_in_out.md](../specs/subhrms/employee/time_in_out.md)
> **Verified:** 2026-08-31
> **Verdict:** CONFORMS
> **Coverage:** 15 claims — 15 conforms, 0 violated, 0 absent, 0 unverified, 0 out-of-scope

---

## 1. Summary

The implementation of the **Mobile Attendance Time In / Time Out Flow & Daily Gate** has been verified against `.agents/specs/subhrms/employee/time_in_out.md` and user-directed domain rules. All 15 acceptance criteria pass with concrete `file:line` evidence across backend Laravel controllers and frontend React Native Expo components. The system enforces post-login interception, cosmic radar scanning, hardware biometric enclave checks (HTTP 403), Holiday/Rest Day schedule masks, the 4-hour (half-shift) minimum threshold before Time Out, and the **First In, Last Out** (1st In, Last Out) multi-punch update protocol.

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | 0 | anything ships |
| HIGH | 0 | the feature is done |
| MEDIUM | 0 | end of milestone |
| LOW | 0 | — |

---

## 2. Claim Checklist & Evidence Audit Trail

| # | Claim Requirement | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| **AC-1** | User logs in without clocking in today (`has_timed_in: false`) &rarr; auto-routed to `/(app)/time-in-out` | `CONFORMS` | [`LoginScreen.tsx:55-63`](file:///d:/project/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L55-L63) |
| **AC-2** | User is On Duty (`has_timed_in: true`, `time_out: null`, `needs_reset: false`) &rarr; routed to `/(app)` Dashboard | `CONFORMS` | [`LoginScreen.tsx:67`](file:///d:/project/hrms/resources/views/mobapp/src/module/auth/pages/LoginScreen.tsx#L67) |
| **AC-3** | Shift $>16$ hours open without timeout (`needs_reset: true`) &rarr; banner displayed, fresh Time In enabled | `CONFORMS` | [`AttendanceController.php:79-84`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L79-L84), [`useTimeInOut.ts:81-85`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L81-L85) |
| **AC-4** | Off Duty state: tap biometric sensor &rarr; calls `POST /api/attendance/record` (`type: 'time_in'`), plays haptics, HUD green | `CONFORMS` | [`useTimeInOut.ts:213-238`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L213-L238), [`AttendanceController.php:398-405`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L398-L405) |
| **AC-5** | On Duty state: tap biometric sensor &rarr; calls `POST /api/attendance/record` (`type: 'time_out'`), plays haptics, HUD amber | `CONFORMS` | [`useTimeInOut.ts:213-241`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L213-L241), [`AttendanceController.php:406-412`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L406-L412) |
| **AC-6** | Device not registered (`is_registered: false`) &rarr; orb locked, warning banner, backend strictly rejects punch with HTTP 403 | `CONFORMS` | [`AttendanceController.php:284-293`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L284-L293), [`CosmicRadarPunchOrb.tsx:125-136`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/components/CosmicRadarPunchOrb.tsx#L125-L136) |
| **AC-7** | Biometric prompt cancelled &rarr; transitions to idle state with "Verification cancelled" without unhandled errors | `CONFORMS` | [`useTimeInOut.ts:198-202`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L198-L202) |
| **AC-8** | "Go to Dashboard" button clicked &rarr; navigates to `/(app)` Dashboard, skipping attendance punch | `CONFORMS` | [`useTimeInOut.ts:250-256`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L250-L256), [`AttendanceCockpitScreen.tsx:210-225`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/pages/AttendanceCockpitScreen.tsx#L210-L225) |
| **AC-9** | Live digital chrono clock &rarr; updates every 1000ms with formatted time, microsecond pulse, and localized date | `CONFORMS` | [`DigitalChronoGauge.tsx:30-70`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/components/DigitalChronoGauge.tsx#L30-L70), [`useTimeInOut.ts:42-60`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L42-L60) |
| **AC-10**| GPS permission enabled &rarr; submits latitude/longitude, saved as `"lat,lng"` in `timesheet.locationin` / `locationout` | `CONFORMS` | [`useTimeInOut.ts:115-146`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L115-L146), [`AttendanceController.php:393-397`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L393-L397) |
| **AC-11**| GPS disabled/denied &rarr; punch succeeds with HTTP 200 and coordinates stored as `null` | `CONFORMS` | [`useTimeInOut.ts:135-146`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L135-L146), [`AttendanceController.php:393-397`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L393-L397) |
| **AC-12**| Backend returns HTTP 400 error &rarr; Error HUD displays message, error haptics, resets to idle without crashing | `CONFORMS` | [`useTimeInOut.ts:243-248`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L243-L248), [`AttendanceCockpitScreen.tsx:153-160`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/pages/AttendanceCockpitScreen.tsx#L153-L160) |
| **AC-13**| Today is Holiday (`is_holiday: true`) &rarr; shift work hours hidden, displays Holiday title and `Holiday • No Shift Required` | `CONFORMS` | [`AttendanceController.php:86-104`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L86-L104), [`ShiftInfoCapsule.tsx:33-36`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/components/ShiftInfoCapsule.tsx#L33-L36) |
| **AC-14**| Today is Rest Day (`is_restday: true`) &rarr; shift work hours hidden, displays `Rest Day` and `Rest Day • No Shift Required` | `CONFORMS` | [`AttendanceController.php:105-115`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L105-L115), [`ShiftInfoCapsule.tsx:35-36`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/components/ShiftInfoCapsule.tsx#L35-L36) |
| **AC-15**| Minimum Half-Shift Policy & First In Last Out &rarr; 4 hours minimum before Time Out; multi-punch out updates `timeout` (Last Out) | `CONFORMS` | [`AttendanceController.php:360-388`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L360-L388), [`AttendanceController.php:406-445`](file:///d:/project/hrms/app/Http/Controllers/AttendanceController.php#L406-L445), [`useTimeInOut.ts:153-157`](file:///d:/project/hrms/resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L153-L157) |

---

## 3. Unspecced Behavior

*None.* The implementation strictly reuses existing `Timesheet`, `Timelog`, `AccountJob`, `Holiday`, `PayPeriod`, `UserBiometricDevice`, and `BiometricAuthLog` models and endpoints without creating unspecced tables or endpoints.

---

## 4. Spec Gaps

*None.* Acceptance criteria were updated to incorporate user-directed operational rules (AC-13 Holiday mask, AC-14 Rest Day mask, AC-15 4-Hour Half-Shift & First In Last Out policy).

---

## 5. Verification Limits

- **Hardware Sensors**: Biometric authentication on real physical iOS TouchID/FaceID and Android Fingerprint sensors requires a physical device build. Verified via `expo-local-authentication` software bridge and platform simulator paths.
- **Physical GPS Antennas**: High-accuracy coordinate fixes verified via Expo Location mocked telemetry (`10.3157, 123.8854`).
