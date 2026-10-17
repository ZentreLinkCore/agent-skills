# Spec — App Biometric Hub (Mobile React Native App)

> **Kind:** Greenfield / UI Migration & Modernization — Redesigning and elevating the legacy Vue mobile app biometric suite (`mobapp-vue`) into a cohesive, futuristic biometric security hub exclusively for the **React Native Expo Mobile App** (`resources/views/mobapp`) adhering to the dark/light Slate cyber design system. (Web portal does NOT include biometric UI/design).
> **Portal:** **Mobile App / Auth & Employee** (`/api/biometric/...` public & authenticated routes, `auth` & `attendance` modules).
> **Version:** v2 — 2026-08-31 — Mobile-only scope.
> **Route:**
> - Mobile (Expo Router): `/(auth)/biometric-setup` (Setup Wizard), `/(auth)/login` (HUD Biometric Auth), `/(app)/time-in-out` (Biometric Punch Clock), `/(app)/profile` (Device Security Manager).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [ui-design.md](../../../rules/conditional/ui-design.md), [backend.md](../../../rules/conditional/backend.md), [payroll.md](../../../rules/conditional/payroll.md).
> **System Awareness:** Models reused (`Account`, `UserBiometricDevice`, `BiometricAuthLog`, `EmployeeSchedule`, `DtrPeriod`); Tables reused (`accounts`, `user_biometric_devices`, `biometric_auth_logs`); Routes reused/extended (`api/biometric/*`); New migration: **No** (schema already possesses full `user_biometric_devices` and `biometric_auth_logs`).

---

## 1. Purpose

Biometric authentication in SubHRMS provides mobile app employees with a high-trust, frictionless gateway to verify their identity, sign into the workforce platform in under 500ms, punch daily attendance securely without buddy-punching, and manage their trusted hardware devices.

The legacy implementation in `mobapp-vue` (`BiometricSetupPage.vue`, `LoginPage.vue`, and `TimeInOutPage.vue`) proved the functional workflow. This specification defines the complete redesign and implementation exclusively in:
1. **React Native Mobile App (`resources/views/mobapp`)**: Powered by Expo 54, React 19, TypeScript, `expo-local-authentication`, `expo-secure-store`, `expo-haptics`, `react-native-reanimated`, and NativeWind styling matching `theme.ts` (Cyber Slate-950 `#0B1220` with Teal `#0D9488` / Cyber Blue `#2563EB` accents).
2. **Laravel API Core (`app/Http/Controllers/BiometricController.php`)**: Reusing and hardening the existing zero-friction backend with structured device tokens, cryptographic validation, activity audit logging, and concurrency locks.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Mobile & Web Cross-Platform Biometric Engine

**Option A — Platform-Aware Native Driver Pattern (Recommended)**
- **Mobile (Expo React Native)**: Uses `expo-local-authentication` (`LocalAuthentication.authenticateAsync`) backed by iOS Secure Enclave / Android KeyStore, coupled with `expo-secure-store` to persist cryptographically isolated device UUIDs and authentication tokens.
- **Web (Vue 3)**: Uses modern Browser WebAuthn API (`navigator.credentials.create` / `navigator.credentials.get`) and device UUID tokens in `localStorage` with fallback to secure challenge verification.
- Encapsulate both inside unified hooks (`useBiometrics` in React Native, `useWebBiometrics` in Vue 3) sharing the same state interface (`isAvailable`, `isEnrolled`, `biometricType`, `isScanning`, `authenticate()`).

| Pros | Cons |
|---|---|
| Native speed on iOS/Android (zero webview overhead, instant hardware sensor pop-up, OS biometric prompts). | Web requires WebAuthn support or HTTPS origin to trigger platform biometric dialogs. |
| Fully aligned with enterprise mobile standards (Face ID, Touch ID, Samsung Biometrics, Windows Hello). | Requires maintaining two platform adapter hooks with a shared TypeScript API contract. |
| Hardware security keys stay inside the device's Secure Element / TEE. | |

**Option B — WebView Wrapped Biometric Layer**
- Force mobile app to run inside a Cordova/Capacitor WebView bridge communicating with web JavaScript.

| Pros | Cons |
|---|---|
| Single JavaScript biometric call for both web and mobile. | Significant latency, poor UX, deprecates React Native native performance, fragile bridge. |

**Recommendation:** **Option A**. Follows standard React Native and modern Web architectures, providing sub-millisecond response times and native OS biometric prompt dialogs.

---

### Decision 2: 3-Step Guided Onboarding & Setup Workflow

**Option A — 3-Step High-Tech Wizard with Radar Scanning Visuals (Recommended)**
- Model the setup flow into 3 clear, highly polished phases matching the original `BiometricSetupPage.vue` workflow upgraded to the new theme:
  - **Step 1 — Security Handshake & Password Verification**: User enters password to prove master identity; validates against `/api/biometric/register` backend authentication before sensor access is granted.
  - **Step 2 — Sensor Recognition & Hardware Key Binding**: Interactive scanner HUD with sonar radar animation; triggers device sensor prompt (`Touch ID`, `Face ID`, `Windows Hello`); registers hardware UUID with backend.
  - **Step 3 — Hardware Enrolled & Feature Showcase**: Holographic success checkmark, feature highlight pills (Instant Access, 256-bit AES Encryption, Secure Offline Proof), and one-tap launch to dashboard.

| Pros | Cons |
|---|---|
| Familiar, proven 3-step UX with zero user confusion. | Multi-step navigation state machine to manage. |
| Strict security prevents unauthorized device registration on unattended unlocked phones. | Requires 3 transition views inside the setup screen/modal. |
| Delivers an impressive, modern first-impression onboarding experience. | |

**Option B — Single-Click Instant Sensor Binding**
- Skip password re-verification and immediately enroll the current device upon clicking a toggle button in Profile settings.

| Pros | Cons |
|---|---|
| One less screen to build. | High security risk if an employee leaves their device unlocked; cannot verify device authenticity during onboarding. |

**Recommendation:** **Option A**. The 3-step wizard ensures verified identity before binding cryptographic device credentials and provides a world-class onboarding aesthetic.

---

### Decision 3: Futuristic HUD Scanner & Visual Theme Language

**Option A — Unified Cosmic Slate HUD with Glowing Neon Ripples (Recommended)**
- **Dark Mode**: Deep Cosmic Slate background (`#0B1220`), Slate-800 card containers (`#1E293B`), Slate-700 borders (`#334155`), and luminous Teal (`#0D9488` / `#2DD4BF`) and Cyan (`#00E5FF`) accents.
- **Light Mode**: Crisp Slate-50 background (`#E4E9F2`), Pure White card surfaces (`#FFFFFF`), Slate-200 borders (`#E2E8F0`), and Deep Teal (`#0F766E`) accents.
- **HUD Scanner Element**: Dynamic biometric ring with double concentric sonar wave animations (`react-native-reanimated` shared values on mobile, `@keyframes` CSS ripple on web), sensory color states (Idle: Teal/Cyan, Scanning: Pulse Blue `#2563EB`, Success: Emerald `#10B981`, Error: Crimson `#DC2626`), and synced haptic feedback (`Haptics.impactAsync`).

| Pros | Cons |
|---|---|
| 100% matched to `theme.css` and `theme.ts` across web and mobile. | Requires custom SVG/Lucide icon styling and CSS animation keyframes. |
| Premium cyber-modern aesthetic that elevates user engagement. | |
| Clear, instantaneous sensory feedback on every scan state. | |

**Option B — Standard Browser / OS Default Dialogs with Generic Gray Cards**
- Rely purely on OS default prompts without custom HUD styling or status cards.

| Pros | Cons |
|---|---|
| Less CSS/Reanimated code to write. | Looks generic, lacks branding, and does not provide status feedback when the sensor is scanning or erroring. |

**Recommendation:** **Option A**. Gives the HRMS application a distinct, cutting-edge biometric security presence.

---

### Decision 4: Biometric Attendance Punch Protection (Anti-Spoofing & Concurrency)

**Option A — Device-Bound Biometric Attendance with 60-Second Cooldown (Recommended)**
- Mobile and web attendance punches (`punchAttendance`) verify:
  1. Local hardware sensor verification (`authenticateAsync` / WebAuthn) succeeds.
  2. Device UUID is active and bound to the authenticated user's account (`UserBiometricDevice::scopeActive`).
  3. Anti-double-punch guard: 60-second cooldown prevents duplicate punches on accidental double-taps.
  4. Server logs action to `biometric_auth_logs` with `action: attendance_time_in` / `attendance_time_out`, IP address, and user agent.

| Pros | Cons |
|---|---|
| Eliminates buddy punching and spoofed API requests. | Requires valid device UUID sent with attendance payload. |
| Full auditable transaction log of every biometric punch. | |
| Graceful 60s cooldown prevents accidental duplicate entries. | |

**Option B — Client-Only Biometric Bypass (Unverified API Call)**
- Perform biometric scan purely on the device UI without validating device registration on the backend attendance controller.

| Pros | Cons |
|---|---|
| Simpler backend logic. | Vulnerable to API script replay and fake time-ins from unregistered devices. |

**Recommendation:** **Option A**. Adheres to HRMS security standards and compliance auditing.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | User opens `/(auth)/login` or Web `/login` on a device with registered biometrics | Biometric button is pressed or auto-prompt triggers | Native biometric sensor dialog opens; upon successful scan, calls `/api/biometric/authenticate-device`, receives 200 with auth token, and redirects to Dashboard. |
| **AC-2** | User attempts biometric login on an unregistered device | Biometric scan executes | Backend returns `401 {"message": "No biometric registered for this device"}` and UI displays a friendly error banner with fallback to password/SSO login. |
| **AC-3** | Authenticated user launches Biometric Setup Wizard (`/(auth)/biometric-setup` or Web modal) | Step 1 is loaded with masked user email | User enters valid account password and clicks Continue; system verifies credentials and advances to Step 2 without page reload. |
| **AC-4** | User in Step 1 enters an invalid password | Form is submitted | System rejects request with `401 {"message": "Invalid password"}`, triggers error haptic, logs `login_failed` to `biometric_auth_logs`, and displays error text. |
| **AC-5** | User advances to Step 2 and selects biometric type (Fingerprint / Face ID) | User taps the animated HUD scanner | Native biometric dialog executes; on success, POSTs to `/api/biometric/register` with `device_id`, `device_name`, `device_platform`, and `biometric_type`. |
| **AC-6** | Backend receives valid `/api/biometric/register` request | User has fewer than 3 active registered devices | System upserts `user_biometric_devices` row with `is_active = true`, logs `register` in `biometric_auth_logs`, returns 200, and client advances to Step 3. |
| **AC-7** | User attempts to register a 4th biometric device | Registration payload submitted | Backend returns `400 {"message": "Maximum number of devices reached. Please remove a device first."}` and UI guides user to revoke an existing device. |
| **AC-8** | User completes Step 3 and clicks "Continue to Dashboard" | Button is clicked | System persists `subhrms_biometric_enabled = true` in SecureStore/LocalStorage, triggers success haptics, and redirects to `/(app)` / `/dashboard`. |
| **AC-9** | Employee opens Attendance Punch Clock (`/(app)/time-in-out` or Dashboard modal) | User taps central biometric scanner button | Real-time live HUD clock displays ticking time; scanner initiates pulse animation, requests native sensor verification, and submits punch to backend. |
| **AC-10** | Employee completes biometric attendance punch | Scan and API request succeed | Status card transitions to Emerald with "Clocked In / Out Successfully!", status changes (On Duty / Off Duty), `biometric_auth_logs` records punch, and redirects after 1.5s. |
| **AC-11** | User views Profile Security tab (`ProfileScreen.tsx` or Web Profile) | Expandable Biometric Device Security Manager is opened | Displays current device UUID, hardware status chip (`ENROLLED` in green or `NOT ENROLLED` in amber), and list of all active registered user devices. |
| **AC-12** | User taps "Revoke Device Biometrics" in Device Security Manager | Confirmation modal is confirmed | Calls POST `/api/biometric/revoke` with `device_id`, updates `is_active = false`, sets `revoked_at = now()`, clears SecureStore flag, and updates UI status to `NOT ENROLLED`. |
| **AC-13** | Device sensor hardware is unavailable or user cancels scan | Biometric prompt is dismissed | UI resets gracefully from scanning state back to idle, displays "Verification cancelled", and does not block standard password login or crash. |
| **AC-14** | Fast double-click on biometric scan button | User rapidly presses scanner multiple times | Button is locked with `disabled={isScanning}`, executing only a single API request and preventing race conditions or duplicate logs. |

---

## 3. Database

### Existing Tables Reused

#### Table: `user_biometric_devices`
Stores registered biometric hardware credentials per user account.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `bigint unsigned` | NO | AUTO_INCREMENT | Primary Key |
| `user_id` | `bigint unsigned` | NO | - | FK -> `accounts.id` (cascade on delete) |
| `device_id` | `varchar(255)` | NO | - | Hardware UUID or SecureStore generated device identifier |
| `device_name` | `varchar(255)` | YES | NULL | Friendly name (e.g., "iPhone 15 Pro", "Android Pixel 8", "Chrome on Windows") |
| `device_platform` | `enum('ios','android','web')` | NO | `'android'` | Device Operating System / Client Platform |
| `biometric_type` | `enum('fingerprint','face_id','iris','other')` | NO | `'fingerprint'` | Enrolled sensor modality |
| `public_key` | `text` | YES | NULL | Cryptographic public key / WebAuthn credential ID |
| `is_active` | `tinyint(1)` | NO | `1` | Active state flag (`1` = active, `0` = revoked) |
| `last_used_at` | `timestamp` | YES | NULL | Timestamp of most recent biometric authentication |
| `registered_at` | `timestamp` | NO | `CURRENT_TIMESTAMP` | Initial enrollment timestamp |
| `revoked_at` | `timestamp` | YES | NULL | Revocation timestamp if user removed device |
| `created_at` | `timestamp` | YES | NULL | Laravel created timestamp |
| `updated_at` | `timestamp` | YES | NULL | Laravel updated timestamp |

**Indexes**:
- `UNIQUE KEY unique_user_device (user_id, device_id)`
- `KEY idx_device_id (device_id)`
- `KEY idx_is_active (is_active)`

---

#### Table: `biometric_auth_logs`
Comprehensive audit trail for every biometric security event.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `bigint unsigned` | NO | AUTO_INCREMENT | Primary Key |
| `user_id` | `bigint unsigned` | NO | - | FK -> `accounts.id` |
| `device_id` | `varchar(255)` | NO | - | Target device identifier |
| `action` | `enum('register','login_success','login_failed','revoke','attendance_time_in','attendance_time_out')` | NO | `'login_success'` | Security action performed |
| `details` | `text` | YES | NULL | Extra metadata, error descriptions, or client notes |
| `ip_address` | `varchar(45)` | YES | NULL | Client IP address (IPv4/IPv6) |
| `user_agent` | `text` | YES | NULL | Client browser / device user agent string |
| `created_at` | `timestamp` | YES | NULL | Event timestamp |
| `updated_at` | `timestamp` | YES | NULL | Laravel timestamp |

**Indexes**:
- `KEY idx_user_action (user_id, action)`
- `KEY idx_created_at (created_at)`

---

## 4. Backend Architecture

### Route Registration (`routes/api.php`)

```php
// ==========================================
// Public Biometric Auth Routes (No token required)
// ==========================================
Route::prefix('biometric')->group(function () {
    Route::post('/register', [BiometricController::class, 'register']);
    Route::post('/authenticate', [BiometricController::class, 'authenticate']);
    Route::post('/authenticate-device', [BiometricController::class, 'authenticateByDevice']);
    Route::post('/check-status', [BiometricController::class, 'checkStatus']);
    Route::post('/check-device', [BiometricController::class, 'checkDeviceRegistration']);
});

// ==========================================
// Authenticated Biometric Routes (Sanctum Protected)
// ==========================================
Route::middleware('auth:sanctum')->prefix('biometric')->group(function () {
    Route::post('/revoke', [BiometricController::class, 'revoke']);
    Route::get('/devices', [BiometricController::class, 'getDevices']);
});
```

### Controller: `app/Http/Controllers/BiometricController.php`
- `register(Request $request)`: Validates email, password, device_id, platform, and biometric_type. Verifies account password, checks max 3 devices limit, upserts `user_biometric_devices`, and writes audit log.
- `authenticateByDevice(Request $request)`: Validates device_id, finds active device record, verifies account status, creates Sanctum token (`email . '_BiometricToken'`), logs `login_success`, and returns user account info + token.
- `checkDeviceRegistration(Request $request)`: Lightweight pre-flight query returning `{ is_registered: bool, biometric_type, user_email, user_name }` for custom greeting on login screen.
- `revoke(Request $request)`: Authenticated endpoint to deactivate device (`is_active = false`, `revoked_at = now()`).
- `getDevices(Request $request)`: Returns list of user's active registered devices for device management table.

---

## 5. Frontend Architecture & Design System

### 5.1 Mobile Application (React Native / Expo 54)

#### Folder Structure
```
resources/views/mobapp/src/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx                          # Auth Route
│   │   ├── biometric-setup.tsx                # [NEW] 3-Step Biometric Onboarding Route
│   │   └── forgot-password.tsx
│   └── (app)/
│       ├── time-in-out.tsx                    # Biometric Punch Clock Route
│       └── profile.tsx                        # Profile & Device Security
├── module/
│   └── auth/
│       ├── components/
│       │   ├── BiometricPromptButton.tsx      # Glowing 1-Touch Biometric Login Button
│       │   ├── BiometricSetupWizard.tsx       # [NEW] 3-Step Setup Form Component
│       │   └── BiometricHudScanner.tsx        # [NEW] Reusable Futuristic Radar Ring Scanner
│       ├── hooks/
│       │   └── useBiometricSetup.ts           # [NEW] Setup Wizard State Machine Composable
│       └── types/
│           └── auth.types.ts                  # Biometric payload & state interfaces
├── components/
│   └── security/
│       ├── BiometricDeviceManager.tsx         # Expandable Device Credentials Card
│       └── index.ts
└── hooks/
    ├── use-biometrics.ts                      # Hardware Sensor Hook (Expo LocalAuthentication)
    └── use-dashboard.ts                       # Attendance Punch Hook
```

#### Theme Tokens & Color Palette (Mobile)
- **Cosmic Canvas**: `dark:bg-slate-950` (`#0B1220`), `bg-slate-50` (`#E4E9F2`)
- **Card Surfaces**: `dark:bg-slate-800` (`#1E293B`), `bg-white` (`#FFFFFF`), `dark:border-slate-700` (`#334155`)
- **HUD Ring & Radar**:
  - Idle / Ready: Border `rgba(13, 148, 136, 0.4)` (Teal), Background `from-teal-600 to-teal-800`
  - Scanning / Pulsing: Border `rgba(37, 99, 235, 0.6)` (Blue), animated Reanimated scale 1.0 -> 1.35
  - Verified / Success: Border `rgba(16, 185, 129, 0.8)` (Emerald), Background `from-emerald-500 to-green-600`
  - Error / Denied: Border `rgba(220, 38, 38, 0.8)` (Crimson), Background `from-red-500 to-rose-600`

---

### 5.2 Web Application (Vue 3 / Vite)

#### Folder Structure
```
resources/views/web/src/
├── auth/
│   ├── components/
│   │   ├── BiometricLoginButton.vue           # [NEW] 1-Touch WebAuthn / Biometric Button
│   │   └── BiometricSetupModal.vue            # [NEW] 3-Step Guided Onboarding Modal
│   ├── composables/
│   │   ├── useAuth.ts                         # Enhanced with biometric login methods
│   │   └── useWebBiometrics.ts                # [NEW] WebAuthn & Device Storage Composable
│   └── pages/
│       └── LoginPage.vue                      # Enhanced with Biometric Section & HUD
├── module/
│   └── employee/
│       └── profile/
│           └── components/
│               └── BiometricDeviceManager.vue # [NEW] Web Device Management Table & Status Card
```

#### Theme Tokens & Color Palette (Web)
- Matches `resources/css/theme.css` with dark glassmorphism (`backdrop-blur-xl`, `bg-slate-900/60`, `border-slate-700/60`), neon cyan/teal focus glow (`shadow-[0_0_20px_rgba(0,229,255,0.25)]`), and smooth transition easing.

---

### 5.3 3-Step Setup Wizard UI Flow (Shared Blueprint)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BIOMETRIC SECURITY SETUP                          │
│                                                                         │
│    ┌──────────┐              ┌──────────┐              ┌──────────┐     │
│    │  ( 1 )   │──────────────│  ( 2 )   │──────────────│  ( 3 )   │     │
│    │  Verify  │              │ Register │              │   Done   │     │
│    └──────────┘              └──────────┘              └──────────┘     │
│                                                                         │
│  [ STEP 1: IDENTITY VERIFICATION ]                                      │
│  - Shield Icon with Cyan/Teal Halo Glow                                 │
│  - Email (Pre-filled, read-only)                                        │
│  - Master Account Password input with show/hide toggle                  │
│  - Real-time password length & strength check                           │
│  - [ Continue to Step 2 -> ] (Gradient Button)                          │
│                                                                         │
│  [ STEP 2: HARDWARE ENROLLMENT ]                                        │
│  - Modality Toggle: [ Fingerprint / Touch ID ]  [ Face ID / Unlock ]    │
│  - Central Animated HUD Scanner (Concentric Sonar Rings)                │
│  - Dynamic Scanner Status: "Tap sensor to register" / "Scanning..."     │
│  - Native Hardware Sensor Verification Execution                        │
│                                                                         │
│  [ STEP 3: ENROLLMENT CONFIRMATION ]                                    │
│  - Emerald Green Success Orb with Checkmark                             │
│  - "Biometrics Activated Successfully!"                                 │
│  - Security Badges: [Instant Access] [256-bit AES] [Zero-Knowledge]     │
│  - [ Continue to Dashboard -> ]                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Business Rules, Edge Cases & Checklist

### Business Rules
1. **Device Ceiling**: Maximum of 3 active registered biometric devices allowed per user account. If user attempts to register a 4th device, the API returns HTTP 400 with a prompt to revoke an older device.
2. **Reactivation Idempotency**: If a previously revoked device attempts re-registration, the existing record is reactivated (`is_active = true`, `revoked_at = null`, `registered_at = now()`) without creating duplicate database rows.
3. **Master Password Validation**: Device registration strictly requires valid master account password verification (`Hash::check`).
4. **Session Isolation**: Mobile client uses Sanctum bearer tokens; Web client receives cookie session regeneration if stateful browser session is present.
5. **Anti-Buddy Punching**: Attendance punch submissions require verified biometric authentication on active devices.

### Edge Cases & Handling

| Scenario | Edge Case | Expected System Behavior |
|---|---|---|
| Sensor Hardware Missing | Older PC/Phone without fingerprint or webcam biometric sensor | UI gracefully hides or disables biometric prompt, showing "Sensor Not Available" tooltip; user logs in via standard credentials. |
| User Sensor Cancellation | User taps "Cancel" on the iOS/Android system biometric dialog | System catches rejection, resets scanner HUD to idle, sets status message to "Verification cancelled", and allows retry without crash. |
| Account Password Change | User changes their master password on Web portal | Existing biometric device tokens remain valid until explicit revocation or session token expiration. |
| Device Lost / Stolen | Employee loses registered phone | Employee or Admin can log into Web portal -> Profile -> Biometric Security -> click "Revoke" on target device UUID to immediately invalidate it. |
| Offline / Network Drop | User scans biometric with no internet connectivity | UI displays clear network error banner: "Unable to reach server. Please check your internet connection." |

---

### Non-Functional & Failure-Mode Checklist (Mandatory)

| Category | Requirement & Explicit Contract |
|---|---|
| **Authorization** | Biometric endpoints are strictly role-isolated. `/api/biometric/revoke` and `/api/biometric/devices` require valid `auth:sanctum` session. Public endpoints (`/authenticate-device`) authenticate only against active registered device UUIDs. Unauthorized access returns `401 Unauthorized`. |
| **Concurrency / double-submit** | Scanning buttons on mobile (`BiometricPromptButton`, `TimeInOutScreen`) and web are disabled while `isScanning = true` or `isLoading = true`. Backend uses atomic database upserts on `user_biometric_devices` to prevent duplicate device records. |
| **Idempotency on retries** | Repeated registration requests for the same `(user_id, device_id)` pair update the existing row instead of inserting duplicates (`unique_user_device` constraint). Attendance punches enforce a 60-second cooldown window to prevent accidental double-clocking. |
| **Error response shape & status codes** | Non-happy-path responses return strict JSON: `400 {"status": 400, "message": "Maximum number of devices reached..."}`, `401 {"status": 401, "message": "Invalid password" | "Biometric not registered for this device"}`, `404 {"status": 404, "message": "Account not found"}`, `422 {"status": 422, "message": "Validation failed", "errors": {...}}`. |
| **Input validation boundaries** | Validation rules: `email` (required, valid email), `password` (required, string), `device_id` (required, max 255 chars), `device_platform` (in: `ios,android,web`), `biometric_type` (in: `fingerprint,face_id,iris,other`). Out-of-bound inputs rejected with `422`. |

---

## 7. Build Order

```
[Phase 1: Shared Core & Backend Hardening]
  1. Verify routes in routes/api.php (biometric register, authenticate, check-device, revoke, devices).
  2. Verify app/Http/Controllers/BiometricController.php error handling and Sanctum token generation.
  3. Ensure attendance controller respects biometric device audit verification.

[Phase 2: React Native Mobile Implementation (Gate 1 Design -> Gate 2 Dynamic)]
  4. Create reusable BiometricHudScanner.tsx with Reanimated pulse ring & sensory feedback states.
  5. Create BiometricSetupWizard.tsx and route app/(auth)/biometric-setup.tsx (3-step flow).
  6. Enhance app/(auth)/login.tsx with 1-touch BiometricPromptButton & pre-flight greeting.
  7. Polish app/(app)/time-in-out.tsx with live HUD clock, sonar radar, and punch state transitions.
  8. Integrate BiometricDeviceManager.tsx into app/(app)/profile.tsx with enrollment & revoke modal.

[Phase 3: Vue 3 Web Application Implementation]
  9. Create composable useWebBiometrics.ts (WebAuthn / LocalStorage device driver).
  10. Enhance resources/views/web/src/auth/pages/LoginPage.vue with 1-Touch Biometric HUD button.
  11. Create BiometricSetupModal.vue in resources/views/web/src/auth/components/ for onboarding.
  12. Create BiometricDeviceManager.vue in Web Employee Profile with device listing & revocation.

[Phase 4: Adversarial Verification & Review]
  13. Run /webkit.verify against this spec to ensure 100% acceptance criteria compliance.
  14. Run /webkit.code-review to audit security, haptics, state cleanup, and performance.
```

---

## 8. Out of Scope (Future Specs)

- **Hardware Biometric Physical Turnstiles & Access Control**: Physical biometric turnstiles/devices synced via ZKTeco / TCP listener are managed in HR Device Management (`device_management.api.ts`) and covered in a separate timekeeping hardware spec.
- **FIDO2 Security Key USB Dongle Configuration**: WebAuthn YubiKey NFC hardware tokens will be supported in a future enterprise MFA spec.
- **Biometric Geofencing GPS Lock**: Enforcing polygon GPS fence radius alongside biometric scan is specced separately in mobile field-attendance.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-14`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed and verified.
- [ ] 3-Step Biometric Setup Wizard is accessible and functional on both React Native mobile and Vue 3 web.
- [ ] Biometric Login HUD button provides sub-second 1-touch unlock with instant fallback to credentials.
- [ ] Attendance Punch Clock displays real-time HUD clock, pulse wave animation, and records verified logs.
- [ ] Biometric Device Security Manager allows viewing registered devices and revoking credentials.
- [ ] Dark mode and light mode colors strictly match `theme.css` and `theme.ts`.
- [ ] Adversarial spec verification passes with zero critical or high discrepancies.
