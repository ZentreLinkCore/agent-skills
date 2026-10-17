# Spec — Mobile Attendance Time In / Time Out Flow & Daily Gate

> **Kind:** Greenfield / UI Modernization & Daily Gate — Complete modern redesign of the biometric attendance cockpit and daily login gate exclusively for the **React Native Expo Mobile App** (`resources/views/mobapp`) matching the Zentre Link / SubHRMS Cyber Slate & Golden Chestnut design system.
> **Portal:** **Mobile App / Employee Attendance** (`/api/attendance/...` routes, `resources/views/mobapp/src/module/employee/attendance` & `src/app/(app)/time-in-out.tsx`).
> **Version:** v2 — 2026-08-31 — Complete modern UI redesign (Cosmic Attendance Cockpit, twin telemetry cards, radar biometric orb, hardware trust pills).
> **Route:**
> - Mobile Expo Router: `/(app)/time-in-out` (Time In / Out Cockpit Screen), `/(auth)/login` (Attendance Gate on Login), `/(app)` (Dashboard).
> - Backend API: `GET /api/attendance/today`, `POST /api/attendance/record`, `GET /api/attendance/history`, `POST /api/biometric/check-device`.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [ui-design.md](../../../rules/conditional/ui-design.md), [backend.md](../../../rules/conditional/backend.md), [payroll.md](../../../rules/conditional/payroll.md).
> **System Awareness:**
> - Models reused: `Timesheet`, `Account`, `AccountJob`, `UserBiometricDevice`, `BiometricAuthLog`.
> - Tables reused: `timesheet`, `accounts`, `accountjob`, `user_biometric_devices`, `biometric_auth_logs`.
> - Routes reused: `GET /api/attendance/today`, `POST /api/attendance/record`, `GET /api/attendance/history`, `POST /api/biometric/check-device`.
> - New migration: **No** (backend schema and endpoints are already fully operational in `app/Http/Controllers/AttendanceController.php`).

---

## 1. Purpose

In SubHRMS, accurate employee attendance capture is the foundational data feed for payroll calculation, overtime computation, tardiness tracking, and leave entitlement balancing.

The legacy Vue mobile app (`mobapp-vue`) implemented a basic biometric punch page and an automatic post-login gate: if an employee logs in and has **not yet timed in for the day**, the application routes them directly to the **Time In / Out Screen** before they can access the general dashboard.

This specification delivers a **complete, high-tech visual and architectural redesign** of the Time In / Out experience tailored exclusively for the **React Native Expo Mobile App** (`resources/views/mobapp`):
1. **Daily Attendance Gate**: When a user logs in or opens the app with a restored session, the app checks `/api/attendance/today`. If the user is **not clocked in** (or if 16 hours have elapsed requiring a shift turnover reset), the app routes directly to the **Attendance Cockpit** (`/(app)/time-in-out`).
2. **Cosmic Executive Attendance Cockpit**: An ultra-modern, glassmorphic HUD featuring:
   - **Shift & Cutoff Capsule**: Floating status pill with shift schedule, rest day/holiday tags, and cutoff period.
   - **Digital Chrono-Gauge**: High-definition ticking clock with microsecond pulse ticks and localized full date.
   - **Twin Dynamic Telemetry Cards**: Dual glass cards for Time In (commencement log, GPS location, device seal) and Time Out (conclusion log, duration worked, undertime/overtime projection).
   - **Cosmic Radar Biometric Orb**: Central floating scanner with triple-concentric sonar wave ripple animations, multi-state holographic feedback (Teal/Emerald for Time In, Amber/Coral for Time Out, Cobalt Blue for Scanning), and tactile haptic synchronization.
   - **Live Telemetry Pills**: Hardware enclave trust badge & GPS accuracy status.
   - **Tactile Glass Action Dock**: Seamless "Go to Dashboard" escape button and "View Timesheet Logs" deep link.
3. **Zero-Friction Backend Sync**: Seamlessly connected with existing Laravel endpoints (`AttendanceController@today` and `AttendanceController@record`) for shift assignment and audit trail logging via `BiometricAuthLog`.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Attendance Gate Interception Strategy on Mobile App Launch & Login

**Option A — Post-Auth Router Gate with Graceful Dashboard Bypass (Recommended)**
- Following successful authentication (password or biometric login) and during session hydration, the app queries `GET /api/attendance/today`.
- **Condition for Direct Dashboard Access:** `attendance.has_timed_in === true && !attendance.time_out && !attendance.needs_reset` (Employee is currently on duty).
- **Condition for Time In/Out Interception:** `!attendance.has_timed_in || attendance.time_out || attendance.needs_reset` (Employee has not timed in today, or has finished shift, or needs reset). The app navigates directly to `/(app)/time-in-out`.
- A prominent "Go to Dashboard" button allows employees to skip/bypass the punch screen if they only want to view payslips, file requests, or check notifications without punching.

| Pros | Cons |
|---|---|
| 100% matches user requirement ("mo-show ni siya if the user did not login this day"). | Adds one lightweight network check (`/api/attendance/today`) during login routing. |
| Prevents forgotten clock-ins and late punch disputes. | User must click "Go to Dashboard" if they intentionally do not wish to clock in immediately. |
| Dedicated full-screen executive cockpit UI without dashboard clutter. | |

**Option B — Blocking Modal Popup on Dashboard**
- Always route immediately to `/(app)` dashboard, then display a non-dismissible modal popup over the dashboard if the user has not clocked in.

| Pros | Cons |
|---|---|
| Keeps routing strictly pointed to dashboard. | Jarring UI flash as dashboard loads then gets covered by a modal; layout shift during animations. |

**Option C — Passive Dashboard Card Only (No Navigation Interception)**
- Only show the punch status on the dashboard's `AttendanceHeroCard` and require the user to manually click it.

| Pros | Cons |
|---|---|
| Zero routing redirection logic. | High risk of employees forgetting to clock in upon opening the app; violates explicit user request. |

**Recommendation:** **Option A**. It guarantees high visibility for daily clock-ins while preserving seamless user escape to the dashboard.

---

### Decision 2: UI Visual Architecture — "Cosmic Executive Attendance Cockpit"

**Option A — Cosmic Executive Cockpit with Dual Telemetry Cards & Radar Orb (Recommended)**
- **Background**: Deep Cosmic Slate-950 canvas (`#0B1220`) with 45 ambient star particles and subtle gradient wash (`#0B1220` &rarr; `#141E30`).
- **Hero Shift Bar**: Floating pill capsule showing current shift (`Regular Day Shift 08:00 AM - 05:00 PM`), current cutoff period (`Aug 16 - Aug 31`), and live duty status badge.
- **Centerpiece Biometric Radar Orb**: 200px interactive biometric scanner with triple-concentric sonar wave rings (`react-native-reanimated`), glowing neon aura, and contextual icon (Face ID / Fingerprint).
- **Twin Telemetry Cards**: Side-by-side or stacked split glass cards with neon border accents displaying Time In (with GPS location & timestamp) and Time Out (with worked hours counter & timestamp).
- **Hardware & GPS Trust Bar**: Dual micro-badges confirming `[GPS: High Accuracy]` and `[Device: Enclave Verified]`.
- **Tactile Glass Action Dock**: Floating frosted glass button with Home icon (`active:scale-[0.98]`) to navigate to Dashboard.

| Pros | Cons |
|---|---|
| Stunning, cutting-edge modern aesthetic that elevates the app far beyond legacy webviews. | Requires custom Reanimated animations and glassmorphic styling tokens. |
| Immediate, rich telemetry (shift, cutoff, times, GPS, hardware status) in a single viewport. | |
| Perfect visual harmony with `BrandHeader`, `BiometricSetupWizard`, and `theme.ts`. | |

**Option B — Simple Flat List Card Display (Legacy 1:1 Port)**
- A basic flat card with a standard button and plain text labels copied directly from `TimeInOutPage.vue`.

| Pros | Cons |
|---|---|
| Simple to scaffold. | Looks dated, uninspired, and fails the modern system aesthetic requirement. |

**Recommendation:** **Option A**. Provides a world-class, premium executive experience that will wow users and fit seamlessly into the modern Zentre Link mobile ecosystem.

---

### Decision 3: Native Biometric Sensor Verification with Simulated Web/Dev Fallback

**Option A — `expo-local-authentication` with Hardware Check & Device Binding (Recommended)**
- Uses `LocalAuthentication.hasHardwareAsync()` and `LocalAuthentication.isEnrolledAsync()`.
- Obtains biometric sensor type (`FINGERPRINT`, `FACIAL_RECOGNITION`, `IRIS`).
- Hardware verification via `LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity to Clock In/Out' })`.
- If running on Web or Simulator where hardware biometrics are unavailable, fallback to a 1.2s verification delay with simulated success to facilitate development and automated testing.

| Pros | Cons |
|---|---|
| True hardware-level biometric validation on real iOS and Android devices. | Requires graceful platform handling for Web/Simulator environments. |
| Zero third-party native bridge overhead (bundled with Expo SDK). | |
| Synchronous haptic feedback on success/failure (`expo-haptics`). | |

**Option B — Backend Password Prompt Fallback inside Time In Screen**
- Force users without biometrics to re-enter their master password every single time they punch.

| Pros | Cons |
|---|---|
| High security on shared devices. | Massive friction for daily clock-in/out routine; employees already authenticated their app session. |

**Recommendation:** **Option A**. Balances enterprise biometric security on mobile hardware with smooth developer experience on web/simulators.

---

### Decision 4: Geolocation Coordinates & Geofencing Capture

**Option A — Non-Blocking High-Accuracy GPS Capture with Graceful Null Fallback (Recommended)**
- When the user presses the punch button, the app requests location permissions and fetches current coordinates (`latitude`, `longitude`).
- Set a strict 3000ms timeout for location retrieval: if permission is denied, GPS is disabled, or location takes too long to fix, proceed with recording attendance and submit `latitude: null, longitude: null` (logged as `locationin: null`).
- Display a discreet location badge on the HUD indicating GPS status (e.g. "GPS Acquired" or "Location Unavailable").

| Pros | Cons |
|---|---|
| Fast, reliable punches that never leave the employee stuck if they are in an underground basement or weak GPS signal area. | Does not strictly block out-of-bounds clock-ins (geofencing boundaries are verified by HR report). |
| Matches existing backend behavior where `location` is nullable in `AttendanceController.php`. | |

**Option B — Strict Geofence Enforcement (Hard Block if GPS Missing)**
- Reject attendance punch if GPS accuracy is lower than 10 meters or coordinates are outside office coordinates.

| Pros | Cons |
|---|---|
| Stricter anti-remote-punching control. | High support ticket volume when employees clock in from weak signal or indoor reception areas. |

**Recommendation:** **Option A**. Eliminates frustrating punch lockouts while capturing accurate telemetry whenever available.

---

### Decision 5: 16-Hour Shift Reset & Shift Turnover Handling

**Option A — Backend-Driven Shift Reset Protocol (`needs_reset: true`) (Recommended)**
- When an employee timed in on a previous day but never timed out, `AttendanceController@today` detects that $>16$ hours have passed since `timein`.
- Backend returns `has_timed_in: false, needs_reset: true`.
- Mobile client detects `needs_reset: true`, clears any cached clock-in state, displays an informative banner ("Previous shift reset after 16 hours. Please clock in for your new shift."), and prepares the button for a new **Time In**.

| Pros | Cons |
|---|---|
| Seamless handling of graveyard / night-differential shifts that cross midnight. | Open shift on previous day remains without a timeout until adjusted via Attendance Adjustment filing. |
| Prevents an unclosed shift from permanently blocking future clock-ins. | |

**Option B — Strict Midnight Reset (00:00 AM)**
- Wipe attendance state strictly at 12:00 AM.

| Pros | Cons |
|---|---|
| Simple date-based logic. | Breaks night shift workers (e.g., 10:00 PM to 6:00 AM) who need to clock out at 6:00 AM on the following calendar day. |

**Recommendation:** **Option A**. Essential for standard HRMS shift operations and night differential support.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | User logs in or opens the app, and has **NOT** timed in today (`has_timed_in: false`) | Initial routing or session hydration completes | App automatically routes to `/(app)/time-in-out` with state set to "Off Duty" (Ready for Time In). |
| **AC-2** | User logs in or opens the app, and is currently **On Duty** (`has_timed_in: true` & `time_out: null` & `needs_reset: false`) | Initial routing or session hydration completes | App routes directly to `/(app)` (Employee Dashboard) without interrupting the user. |
| **AC-3** | User timed in $>16$ hours ago without timing out (`needs_reset: true`) | `/api/attendance/today` is fetched | App displays a warning banner ("Shift reset after 16 hours"), sets mode to "Time In", and allows a fresh clock-in. |
| **AC-4** | User is on `/(app)/time-in-out` in "Off Duty" state | User taps biometric scanner button and authenticates | Hardware sensor prompts; on success, calls `POST /api/attendance/record` with `type: 'time_in'`, plays success haptics, turns HUD Green, displays "Time In recorded!", and navigates to Dashboard after 1500ms. |
| **AC-5** | User is on `/(app)/time-in-out` in "On Duty" state (timed in at 08:30 AM) | User taps biometric scanner button and authenticates | Hardware sensor prompts; on success, calls `POST /api/attendance/record` with `type: 'time_out'`, plays success haptics, turns HUD Amber/Blue, displays "Time Out recorded!", and navigates to Dashboard after 1500ms. |
| **AC-6** | Device is not registered for biometric attendance on backend (`is_registered: false`) | User visits `/(app)/time-in-out` or attempts punch | Punch orb is locked/disabled with 'Biometric Enclave Required'; warning banner is displayed with quick register button; backend strictly rejects any punch with HTTP 403 Forbidden ('Biometric authentication is not enrolled'). |
| **AC-7** | User cancels the native OS biometric prompt | Biometric sensor dialog is dismissed | HUD transitions back to idle state with "Verification cancelled" message without throwing an unhandled error. |
| **AC-8** | User on `/(app)/time-in-out` clicks "Go to Dashboard" button | User taps "Go to Dashboard" | App navigates directly to `/(app)` Dashboard, skipping attendance punch. |
| **AC-9** | Live ticking clock on `/(app)/time-in-out` | Screen is open and active | Current time displays `hh:mm:ss A` with pulsing second dots and localized date string, updating every 1000ms. |
| **AC-10** | Device has GPS permission enabled | User performs a biometric punch | Payload includes `latitude: 10.3157, longitude: 123.8854`; backend saves `locationin` / `locationout` formatted as `"10.3157,123.8854"`. |
| **AC-11** | Device has GPS permission denied or disabled | User performs a biometric punch | Location capture is omitted; punch succeeds with HTTP 200 and coordinates stored as `null`. |
| **AC-12** | Backend returns HTTP 400 with "Already timed in. Please time out first." | Double-punch or concurrent request | Error HUD displays message, triggers error haptics, and resets to idle after 2200ms without crashing. |
| **AC-13** | Today is a Holiday (`is_holiday: true`) | `/api/attendance/today` is fetched or Cockpit renders | Shift name and work hours are hidden; displays Holiday title (e.g. `Regular Holiday`, `Special Non-Working Holiday`) and subtitle `Holiday • No Shift Required`. |
| **AC-14** | Today is a Rest Day (`is_restday: true`) | `/api/attendance/today` is fetched or Cockpit renders | Shift work hours are hidden; displays `Rest Day` title and subtitle `Rest Day • No Shift Required`. |

---

## 3. Database

Reuses existing database tables and columns without requiring new migrations.

### Table: `timesheet` (Model: `App\Models\Timesheet`)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `bigint unsigned` | No | Primary key. |
| `idacct` | `bigint unsigned` | No | User account ID (`accounts.id`). Indexed. |
| `date` | `date` | No | Work date (YYYY-MM-DD). Indexed with `idacct`. |
| `day` | `varchar(20)` | No | Day of week (e.g. `Monday`, `Tuesday`). |
| `idshift` | `int` | No | Work shift ID from `accountjob.wshift` (default `0`). |
| `date_in` | `date` | Yes | Date when Time In was punched. |
| `timein` | `time` | Yes | Time In stamp (e.g. `08:30:00`). |
| `locationin` | `varchar(255)` | Yes | GPS coordinates string at Time In (`"lat,lng"`). |
| `date_out` | `date` | Yes | Date when Time Out was punched. |
| `timeout` | `time` | Yes | Time Out stamp (e.g. `17:35:00`). |
| `locationout` | `varchar(255)` | Yes | GPS coordinates string at Time Out (`"lat,lng"`). |
| `late` | `decimal(8,2)` | Yes | Calculated tardiness in hours/minutes. |
| `ut` | `decimal(8,2)` | Yes | Calculated undertime in hours/minutes. |
| `is_locked` | `tinyint` | No | Lock flag for processed payroll cutoff (default `0`). |

### Table: `user_biometric_devices` (Model: `App\Models\UserBiometricDevice`)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `bigint unsigned` | No | Primary key. |
| `user_id` | `bigint unsigned` | No | Reference to `accounts.id`. |
| `device_id` | `varchar(255)` | No | Hardware UUID generated by client. |
| `device_name` | `varchar(255)` | Yes | Client model (e.g. `iPhone 15 Pro`, `Pixel 8`). |
| `platform` | `varchar(50)` | No | `ios`, `android`, or `web`. |
| `is_active` | `tinyint(1)` | No | 1 = active, 0 = revoked. |
| `last_used_at`| `timestamp` | Yes | Last punch or login timestamp. |

### Table: `biometric_auth_logs` (Model: `App\Models\BiometricAuthLog`)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `bigint unsigned` | No | Primary key. |
| `user_id` | `bigint unsigned` | No | User ID. |
| `device_id` | `varchar(255)` | Yes | Hardware UUID. |
| `action` | `varchar(50)` | No | `attendance_time_in`, `attendance_time_out`, `login`. |
| `ip_address` | `varchar(45)` | Yes | Client IP address. |
| `user_agent` | `text` | Yes | Client User-Agent. |
| `created_at` | `timestamp` | No | Log creation timestamp. |

---

## 4. Backend (Laravel API Core)

All backend endpoints are already registered under `routes/api.php` and handled by `App\Http\Controllers\AttendanceController`.

### Endpoints Contract

#### 1. Get Today's Attendance Status
- **Method / URI**: `GET /api/attendance/today`
- **Middleware**: `auth:sanctum`
- **Controller**: `AttendanceController@today`
- **Response (200 OK - Not Timed In)**:
  ```json
  {
    "status": 200,
    "has_timed_in": false,
    "needs_reset": false,
    "time_in": null,
    "time_out": null,
    "time_in_raw": null,
    "time_out_raw": null
  }
  ```
- **Response (200 OK - Currently On Duty)**:
  ```json
  {
    "status": 200,
    "has_timed_in": true,
    "needs_reset": false,
    "time_in": "08:30 AM",
    "time_out": null,
    "time_in_raw": "08:30:15",
    "time_out_raw": null
  }
  ```
- **Response (200 OK - Shift Needs Reset after 16 hours)**:
  ```json
  {
    "status": 200,
    "has_timed_in": false,
    "needs_reset": true,
    "time_in": "08:00 AM",
    "time_out": null,
    "time_in_raw": "08:00:00",
    "time_out_raw": null
  }
  ```

#### 2. Record Biometric Attendance Punch
- **Method / URI**: `POST /api/attendance/record`
- **Middleware**: `auth:sanctum`
- **Controller**: `AttendanceController@record`
- **Request Payload**:
  ```json
  {
    "type": "time_in",
    "device_id": "f8a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "timestamp": "2026-08-31T08:30:00",
    "latitude": 10.3157,
    "longitude": 123.8854
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": 200,
    "message": "Time In recorded successfully",
    "record": {
      "type": "time_in",
      "time": "08:30 AM",
      "date": "2026-08-31"
    }
  }
  ```
- **Response (400 Bad Request - Already Timed In)**:
  ```json
  {
    "status": 400,
    "message": "Already timed in. Please time out first."
  }
  ```
- **Response (400 Bad Request - Cannot Time Out Without Time In)**:
  ```json
  {
    "status": 400,
    "message": "Cannot time out without timing in first."
  }
  ```

#### 3. Check Device Registration
- **Method / URI**: `POST /api/biometric/check-device`
- **Middleware**: Public (or authenticated)
- **Controller**: `BiometricController@checkDeviceRegistration`
- **Request Payload**: `{ "device_id": "string" }`
- **Response (200 OK)**:
  ```json
  {
    "status": 200,
    "is_registered": true,
    "user_email": "employee@zentrelink.com",
    "user_name": "Juan Dela Cruz"
  }
  ```

---

## 5. Frontend Redesign (React Native Expo App)

### 5.1 Visual & Layout Architecture: "Cosmic Attendance Cockpit"

```
┌────────────────────────────────────────────────────────┐
│  [← Back / Skip]      ATTENDANCE COCKPIT     [Live GPS]│
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ⚡ REGULAR DAY SHIFT  •  08:00 AM - 05:00 PM     │  │
│  │ 📅 Current Cutoff: Aug 16 - Aug 31, 2026         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│                  MONDAY, AUGUST 31, 2026               │
│                  ┌──────────────────────┐              │
│                  │   08:24:15 AM        │              │
│                  └──────────────────────┘              │
│                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │  TIME IN              │  │  TIME OUT             │  │
│  │  08:30 AM             │  │  --:--                │  │
│  │  📍 Cebu IT Park Hub  │  │  ⏳ In Progress       │  │
│  └───────────────────────┘  └───────────────────────┘  │
│                                                        │
│                       (((( 🔘 ))))                     │
│                  [ BIOMETRIC RADAR ORB ]               │
│                   TAP OR HOLD TO TIME IN               │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🛡️ Hardware Enclave Verified  •  📍 High Accuracy│  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [ 🏠 Go to Dashboard ]     [ 📑 View Timesheet ] │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 5.2 Component Breakdown in `resources/views/mobapp`

```
resources/views/mobapp/src/
├── app/
│   ├── (auth)/
│   │   └── login.tsx                      # Login screen with post-auth attendance check gate
│   ├── (app)/
│   │   ├── _layout.tsx                    # App stack & tab navigation
│   │   ├── index.tsx                      # Dashboard root
│   │   └── time-in-out.tsx                # Dedicated Cockpit Route Container
├── module/
│   └── employee/
│       ├── attendance/
│       │   ├── api/
│       │   │   └── attendance.api.ts      # Attendance client service
│       │   ├── hooks/
│       │   │   └── useTimeInOut.ts        # Composable hook (clock, biometrics, GPS, state)
│       │   ├── components/
│       │   │   ├── AttendanceCockpitHeader.tsx # Top bar with back action & live telemetry
│       │   │   ├── ShiftInfoCapsule.tsx   # Shift details, cutoff period & holiday badges
│       │   │   ├── DigitalChronoGauge.tsx # Large ticking clock with microsecond pulse
│       │   │   ├── TwinTelemetryCards.tsx # Dual glass cards for Time In & Time Out logs
│       │   │   ├── CosmicRadarPunchOrb.tsx# Triple-ring sonar pulsing biometric trigger
│       │   │   ├── HardwareTrustPill.tsx  # GPS accuracy & hardware enclave status
│       │   │   └── DeviceWarningBanner.tsx# Unregistered device warning banner
│       │   ├── pages/
│       │   │   └── AttendanceCockpitScreen.tsx # Full-screen composite container
│       │   ├── types/
│       │   │   └── attendance.types.ts    # TypeScript definitions
│       │   └── index.ts                   # Barrel export
│       └── dashboard/
│           └── components/
│               └── AttendanceHeroCard.tsx # Dashboard hero attendance card
```

### 5.3 Detailed UI & Styling Specifications

1. **Canvas & Atmosphere**:
   - **Dark Mode**: Deep Slate-950 canvas (`#0B1220`) with 45 background star particles (`STAR_PARTICLES` array) and linear gradient (`#0B1220` &rarr; `#141E30`).
   - **Light Mode**: Ultra-crisp Slate-50 canvas (`#EEF2F8`) with subtle blue-gray gradient (`#EEF2F8` &rarr; `#E4E9F2`).
   - Max width constraint: `480px` centered for seamless tablet, iPad, and web layout.

2. **Shift Info Capsule (`ShiftInfoCapsule.tsx`)**:
   - Translucent glass pill (`bg-slate-800/60 dark:bg-slate-800/60 border border-slate-700/60 dark:border-slate-700/60 rounded-2xl p-3.5`).
   - Includes shift badge (e.g. `Regular Shift • 08:00 AM - 05:00 PM`), current pay period tag (`Aug 16 - Aug 31`), and dynamic state indicator (e.g. `⚡ Active Shift`, `🌴 Rest Day`, `🎉 Special Holiday`).

3. **Digital Chrono-Gauge (`DigitalChronoGauge.tsx`)**:
   - Formatted uppercase date (`MONDAY, AUGUST 31, 2026`) in `text-xs font-bold text-slate-400 tracking-widest`.
   - Massive `5xl` ultra-bold digital chronometer (`08:24:15 AM`) featuring gradient typography (`#22D3EE` &rarr; `#0D9488` &rarr; `#3B82F6`) and pulsing micro-separator dots.

4. **Twin Telemetry Cards (`TwinTelemetryCards.tsx`)**:
   - **Card 1: Shift Initiation (Time In)**:
     - Top row: Emerald `LogIn` icon in frosted capsule + uppercase `TIME IN` title.
     - Center: Formatted timestamp `08:30 AM` (or `--:--` if pending) in `text-xl font-extrabold text-emerald-400`.
     - Bottom: Micro GPS badge (`📍 10.3157, 123.8854`) or `"Pending Check-In"`.
   - **Card 2: Shift Conclusion (Time Out)**:
     - Top row: Warm Amber/Red `LogOut` icon in frosted capsule + uppercase `TIME OUT` title.
     - Center: Formatted timestamp `05:15 PM` (or `--:--` if in progress) in `text-xl font-extrabold text-amber-400`.
     - Bottom: Worked duration pill (`⏱️ 08h 45m Worked`) or `"Shift In Progress"`.

5. **Cosmic Radar Punch Orb (`CosmicRadarPunchOrb.tsx`)**:
   - **Interactive Radius**: 200px diameter container.
   - **Triple-Ring Sonar Animation**: Outer ring (scale 1.0 &rarr; 1.45, opacity 0.4 &rarr; 0.0), Mid ring (scale 1.0 &rarr; 1.25, opacity 0.6 &rarr; 0.1), Inner border ring. All driven via `react-native-reanimated` shared values on pure `style` objects.
   - **Central Trigger Orb (110px)**:
     - *Off Duty (Time In)*: Radiant Teal/Emerald gradient (`#0D9488` &rarr; `#10B981`) with glowing drop shadow.
     - *On Duty (Time Out)*: Warm Amber/Sunset Coral gradient (`#D97706` &rarr; `#EF4444`) with pulsing aura.
     - *Scanning*: Cobalt Blue gradient (`#2563EB` &rarr; `#1D4ED8`) with spinning activity indicator.
     - *Success*: Bright Emerald (`#059669`) with checkmark and explosive ripple.
     - *Error*: Vivid Crimson (`#DC2626`) with shake vibration.
   - Dynamic hardware icon: `ScanFace` if Face ID / biometric facial scanner is enrolled, `Fingerprint` for touch/under-screen sensors.
   - Subtitle hint: *"Touch sensor to Clock In"* or *"Touch sensor to Clock Out"*.

6. **Hardware Trust & Location Pill (`HardwareTrustPill.tsx`)**:
   - Sleek dual-item telemetry pill at bottom of scanner:
     - `🛡️ Enclave Hardware: Secured` (or `⚠️ Unregistered Device`).
     - `📍 GPS: High Accuracy Fix` (or `📍 GPS: Disabled`).

7. **Action Dock**:
   - Full-width frosted glass button: **"Go to Dashboard"** with Home icon, chevron indicator, and subtle active press scale (`active:scale-[0.98]`).
   - Secondary text action: **"View Full Timesheet & Schedule"** deep linking to `timekeeping`.

---

## 6. Business Rules & Edge Cases

### HRMS Domain Rules
1. **Daily Punch Window**: Employees can record one Time In and one Time Out per standard shift.
2. **Grace Period & Tardiness Calculation**: If Time In occurs after shift start time plus grace period (e.g. 15 minutes), the backend calculates tardiness in `late` column.
3. **Cross-Midnight / Night Shift**: Shifts starting in PM and ending in AM on the next day are supported via the 16-hour expiration threshold.
4. **Rest Day & Holiday Overrides**: If the employee works on a scheduled rest day or holiday, the punch is recorded normally, flagged in timesheet, and calculated with proper premium multipliers during payroll processing.

### Non-Functional & Failure-Mode Checklist

| Category | Requirement & Specification |
|---|---|
| **Authorization** | Restricted to authenticated employees via `auth:sanctum`. An unauthenticated request receives HTTP 401 and forces client redirection to `/(auth)/login`. |
| **Concurrency / double-submit** | Frontend disables scanner button and displays `ActivityIndicator` while punch request is pending (`isScanning === true`). Backend verifies timesheet state and rejects duplicate punch with HTTP 400. |
| **Idempotency on retries** | If a punch is resubmitted due to network retry, backend checks if `timein` or `timeout` for today's timesheet is already populated; avoids creating duplicate timesheet records. |
| **Error response shape & status codes** | All error responses return standard JSON `{ "status": 400|401|422|500, "message": "Descriptive message" }`. Client captures message and displays standard warning haptics + status message banner. |
| **Input validation boundaries** | `type` must strictly be `time_in` or `time_out`. `device_id` must be a valid string. Coordinates must be valid numeric values (`-90 <= lat <= 90`, `-180 <= lng <= 180`). Malformed inputs rejected with HTTP 422. |

---

## 7. Build Order

1. **Step 1: Frontend API Service & Type Contracts (`attendance.api.ts` & `attendance.types.ts`)**
   - Implement `today()`, `recordPunch()`, and `getHistory()` in `services/api/attendance.api.ts`.
   - Define TypeScript interfaces matching Laravel response payloads.
2. **Step 2: Composable Hook (`useTimeInOut.ts`)**
   - Implement live ticking clock interval with cleanup.
   - Implement biometric sensor handshake (`LocalAuthentication`), device registration verification, and GPS coordinate retrieval.
   - Wire `recordPunch` execution with sensory haptic responses.
3. **Step 3: Redesigned UI Components**
   - Build `AttendanceCockpitHeader.tsx`, `ShiftInfoCapsule.tsx`, `DigitalChronoGauge.tsx`.
   - Build `TwinTelemetryCards.tsx` (Time In / Time Out glass cards).
   - Build `CosmicRadarPunchOrb.tsx` (Reanimated triple sonar ripple & dynamic trigger).
   - Build `HardwareTrustPill.tsx` and `DeviceWarningBanner.tsx`.
4. **Step 4: Screen Container (`AttendanceCockpitScreen.tsx` & `src/app/(app)/time-in-out.tsx`)**
   - Assemble components with starfield background, gradient canvas, and action dock.
5. **Step 5: Post-Login & Hydration Gate (`LoginScreen.tsx` & `AuthContext.tsx`)**
   - Wire post-authentication check: call `AttendanceApi.today()`.
   - If not timed in (`!has_timed_in || needs_reset`), redirect to `/(app)/time-in-out`.
   - If already timed in and working, route to `/(app)` Dashboard.
6. **Step 6: Dashboard Sync & Verification**
   - Verify `AttendanceHeroCard.tsx` in `EmployeeDashboardScreen.tsx` accurately reflects the recorded time in real-time.

---

## 8. Out of Scope (Future Specs)

- Dynamic Geofencing Polygon verification against physical building boundaries (Admin geofence mapping module).
- On-device ML Face Recognition embedding comparisons (currently relies on OS Secure Enclave / KeyStore).
- Automatic Bluetooth beacon proximity clock-in.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (**AC-1 through AC-12**).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is fulfilled.
- [ ] Device without clock-in today automatically presents the `/(app)/time-in-out` screen post-login.
- [ ] User can cleanly bypass to Dashboard via "Go to Dashboard" button.
- [ ] Biometric sensor triggers native OS prompt and records punch to `timesheet` table with proper audit logging.
- [ ] Redesigned Cosmic Cockpit UI renders smoothly with 60fps Reanimated sonar waves in both Dark and Light modes.

<!-- Changelog -->
- v1 — 2026-08-31 — baseline (pre-redesign)
- v2 — 2026-08-31 — Complete modern UI redesign (Cosmic Attendance Cockpit, twin telemetry cards, radar biometric orb, hardware trust pills)
