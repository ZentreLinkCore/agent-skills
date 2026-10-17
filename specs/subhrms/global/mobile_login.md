# Spec — Mobile App Modern Login Screen (Android & iOS)

> **Kind:** Greenfield — Native React Native / Expo implementation of the SubHRMS & Zentre Link Core enterprise authentication screen (`resources/views/mobapp/src/app/(auth)/login.tsx`), matching the web system's design concept (cyber-enterprise dark theme, neon cyan accents, email / employee ID credentials, password visibility toggle, remember me, enterprise SSO/ID options, and device biometric authentication) tailored for Android ergonomics and modern mobile UI.
> **Portal:** **Global / Mobapp** (`/api/login`, `/api/biometric/*`, `/api/account` backend routes; `resources/views/mobapp` mobile client).
> **Version:** v1 — 2026-08-28 — initial
> **Route:** `(auth)/login` (Expo Router path: `/login` or root auth stack).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md).
> **System Awareness:**
> - Models Reused: `App\Models\Account` (`tbl_account` / `accounts`), `App\Models\UserBiometricDevice`, `App\Models\BiometricAuthLog`.
> - Tables Reused: `tbl_account`, `user_biometric_devices`, `biometric_auth_logs`.
> - Routes Reused: `POST /api/login`, `POST /api/biometric/authenticate-device`, `POST /api/biometric/check-device`, `POST /api/biometric/register`, `GET /api/account`, `POST /api/logout`.
> - New Migration Needed: **No** (all underlying user accounts, Sanctum personal access tokens, and biometric device registration tables already exist in the SubHRMS backend).

---

## 1. Purpose

The SubHRMS platform currently provides a rich web authentication experience under the **Zentre Link Core Enterprise** brand — featuring a cyber-enterprise dark aesthetic, glowing cyan focus indicators, enterprise security credentials, and biometric registration options. 

The React Native mobile application (`resources/views/mobapp`) requires a **modern, Android-optimized Login Screen** that:
1. **Faithfully reflects the existing web system's visual identity and brand language**: Deep space navy gradients (`#070D18` to `#0B1220`), glowing cyan `#00E5FF` focus rings, glassmorphic cards (`#0F1928`/85), high-contrast typography, and enterprise badges.
2. **Implements Android-first mobile ergonomics**: Smooth keyboard handling (`KeyboardAvoidingView`), auto-scrolling on input focus, Android system status bar & navigation bar translucent theming, tactile haptic feedback, and touch-target compliance (minimum 48dp).
3. **Supports Dual-Mode Identification**: Accepts either corporate email (`user@company.com`) or Employee ID (`00001`, `EMP-1024`) to match flexible company operational workflows.
4. **Integrates Native Hardware Biometrics**: One-touch Android Fingerprint / Face Unlock using device credentials paired with the backend's `UserBiometricDevice` verification.
5. **Maintains Secure Persistent Sessions**: Uses encrypted hardware storage (`expo-secure-store`) for Sanctum Bearer tokens with automatic session hydration and route guarding.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Input Identification Strategy (Email vs. Employee ID)

**Option A — Unified Smart Identifier Input with Auto-Detection (Recommended)**
- A single input field labeled *"Work Email or Employee ID"* that automatically detects whether the user entered an email format (`@`) or an Employee ID / Username, sending the payload cleanly to the authentication service.

| Pros | Cons |
|---|---|
| Reduces mobile screen clutter and eliminates clumsy tab/switch toggles. | Backend or mobile client normalizer must handle identifier resolution before login request. |
| Fits Android virtual keyboard flows (predictive typing, password autofill). | Users must be clearly informed that both formats are supported. |
| Directly accommodates on-site field staff (who often remember Employee ID over email). | |

**Option B — Two Separate Switchable Tabs (Email Tab vs. Employee ID Tab)**
- A segmented button at the top switching between "Corporate Email" and "Employee ID".

| Pros | Cons |
|---|---|
| Explicit separate fields with distinct validation rules. | Adds extra tap interaction; increases visual clutter on compact mobile screens. |
| | Reduces vertical screen space for virtual keyboard accommodation. |

**Recommendation:** Option A. Modern mobile UX favors a single smart input.

---

### Decision 2: Mobile Secure Token Storage Architecture

**Option A — `expo-secure-store` with Keychain / Android Keystore Encryption (Recommended)**
- Stores the Sanctum access token, user session profile, and biometric device UUID inside Android's Hardware Keystore / iOS Keychain.

| Pros | Cons |
|---|---|
| Industry-standard military-grade hardware encryption on Android and iOS. | Asynchronous read/write with small native bridge overhead (<10ms). |
| Tokens cannot be extracted via unencrypted root/ADB inspection. | Requires `expo-secure-store` native package. |
| Essential for enterprise HRMS security compliance. | |

**Option B — Plain `AsyncStorage`**
- Stores raw token strings in unencrypted SQLite/file-based AsyncStorage.

| Pros | Cons |
|---|---|
| Zero extra native dependencies; simple key-value API. | **Major Security Vulnerability**: Token is stored in plain text and accessible on rooted devices or backup dumps. |
| | Violates enterprise HRMS security standards. |

**Recommendation:** Option A. Mandatory for enterprise security and Sanctum token safety.

---

### Decision 3: Biometric Authentication Integration Flow

**Option A — Quick Biometric Action Tile & Bottom Sheet Prompt (Recommended)**
- If the device has biometrics registered (`biometric_registered: true` in user metadata or stored local token), display a glowing Fingerprint / Face ID quick-action button below the login button. Tapping it triggers Android BiometricPrompt (`expo-local-authentication`), verifying device biometrics and authenticating against `/api/biometric/authenticate-device`.

| Pros | Cons |
|---|---|
| Frictionless 1-second login for recurring employees on Android. | Requires initial one-time password login before biometric enrollment. |
| Fully matches the existing backend `BiometricController` architecture. | |
| Fallback to password always visible on screen. | |

**Option B — Automatic Biometric Prompt on App Startup**
- Pop the biometric prompt immediately upon launching the app if a token exists.

| Pros | Cons |
|---|---|
| Zero-touch login when reopening app. | Can be jarring if the user wants to switch accounts or if biometric fails repeatedly. |
| | Interferes with deep links and splash screen transitions. |

**Recommendation:** Option A. Provides user agency and clear visual control.

---

### Decision 4: Mobile Visual Theme & Android Aesthetic

**Option A — Zentre Link Cyber-Enterprise Dark Mode with Android Material 3 Accents (Recommended)**
- Implements the signature Zentre Link dark palette: Deep Obsidian `#070D18`, Card Glass `#0F1928`, Neon Cyan `#00E5FF`, Electric Blue `#00A3FF`, and Slate `#8FA3BF`. Elevated surfaces use 1px luminous borders (`#00E5FF20`) and Android elevation/shadow with touch ripple effects.

| Pros | Cons |
|---|---|
| 100% visual consistency with the web platform; premium "wow" factor. | Dark mode is the primary theme (matches web brand identity). |
| High contrast, easy to read under outdoor sunlight or office lighting. | |
| Vibrant cyan focus states feel alive and ultra-modern. | |

**Option B — Plain Light Mode Material Design**
- Standard white card background with blue Material buttons.

| Pros | Cons |
|---|---|
| Standard Android look. | Inconsistent with the web enterprise design; feels generic and unpolished. |

**Recommendation:** Option A. Preserves the premium brand identity while adhering to Android UX principles.

---

### Decision 5: Navigation Architecture & Auth Route Guard

**Option A — Expo Router Route Groups `(auth)` & `(app)` with Context-Driven Root Guard (Recommended)**
- Structure the mobile router into `src/app/(auth)/login.tsx` and `src/app/(app)/_layout.tsx`, managed by an `AuthProvider` at `src/app/_layout.tsx` that seamlessly redirects between auth and home screens based on reactive authentication status.

| Pros | Cons |
|---|---|
| Idiomatic Expo Router v4 structure; clean URL and deep-link routing. | Requires organizing existing app screens under `(app)` or redirecting index. |
| Instant unauthenticated redirection without flickering. | |

**Option B — Single-Stack Navigation with Screen-Level Redirect Checks**
- Keep all screens in root `src/app/` and check auth inside `useEffect` on each page.

| Pros | Cons |
|---|---|
| Simple initial file structure. | Screen flicker and potential security leaks where protected screens momentarily render before redirecting. |

**Recommendation:** Option A. Clean, secure, and idiomatic for Expo Router.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | User is on the Mobile Login screen | Views the initial screen | Renders Zentre Link Core brand header, logo glow, "Access the Core" title, Email/ID input, Password input, Remember Me checkbox, Forgot Password link, and "Secure Login" button with cyber-enterprise styling. |
| AC-2 | User focuses on the Email/ID input | Taps the input field | Input border illuminates with Neon Cyan (`#00E5FF`) and glowing shadow; virtual keyboard opens smoothly without clipping or obscuring the inputs or login button. |
| AC-3 | User taps the Eye icon on the password field | Toggles password visibility | Password text switches from masked bullets (`••••••••`) to plain text; icon toggles from `eye` to `eye-off` with smooth feedback. |
| AC-4 | User leaves Email or Password empty | Taps "Secure Login" button | Form prevents HTTP submission, sets focus/border to Rose Red (`#F43F5E`), and displays validation error message (e.g., *"Email or Employee ID is required"* / *"Password must be at least 8 characters"*). |
| AC-5 | User enters invalid credentials | Submits the form to `POST /api/login` | Button enters loading state with spinner; backend responds `401 Unauthorized`; form displays alert/banner *"Invalid credentials. Please verify your email and password."* with tactile error haptic. |
| AC-6 | User enters valid credentials | Submits the form to `POST /api/login` | Backend responds `200 OK` with `{ token, email, role, biometric_registered }`; token is saved to `SecureStore`; `AuthProvider` updates state and transitions user to the main app dashboard (`/(app)`). |
| AC-7 | User checks "Remember Me" before login | Logs in successfully | Email/Identifier is persisted to local storage and pre-populated on subsequent login launches. |
| AC-8 | User has a registered biometric device on Android | Opens login screen | Biometric quick-action button ("Sign in with Biometrics") is rendered; tapping it prompts Android Fingerprint/Face prompt; successful sensor match sends device authentication to `/api/biometric/authenticate-device` and completes login. |
| AC-9 | User taps "Forgot Password?" | Taps the link | Navigates to `/(auth)/forgot-password` with transition animation. |
| AC-10 | Device loses internet connection | User attempts to log in | Network failure is caught; displays a clear toast/banner *"Network connection error. Please check your internet connection."* and resets button state. |
| AC-11 | User double-taps "Secure Login" in rapid succession | Multiple taps within 500ms | Button is disabled immediately on first press (`isLoading === true`), preventing concurrent duplicate API calls. |

---

## 3. Database

### Reused Tables & Models (Backend)

The mobile login utilizes existing database tables in SubHRMS. **No new migrations are required.**

#### 1. `tbl_account` / `accounts` (Model: `App\Models\Account`)
| Column | Type | Description |
|---|---|---|
| `id` | `bigint unsigned` | Primary key (`idacct`). |
| `empid` | `varchar(50)` | Employee ID string (e.g. `00001`, `EMP-2024-001`). |
| `fname` | `varchar(100)` | First name. |
| `lname` | `varchar(100)` | Last name. |
| `email` | `varchar(255)` | Corporate email address (unique). |
| `password` | `varchar(255)` | Bcrypt hashed password. |
| `role_access` | `int` | Role ID (`1`: Admin, `2`: Employee, `3`: Manager, `4`: HR, `5`: Payroll, etc.). |
| `status` | `tinyint` | `1` = Active, `0` = Inactive/Deactivated. |

#### 2. `user_biometric_devices` (Model: `App\Models\UserBiometricDevice`)
| Column | Type | Description |
|---|---|---|
| `id` | `bigint unsigned` | Primary key. |
| `user_id` | `bigint unsigned` | Foreign key referencing `accounts.id`. |
| `device_id` | `varchar(255)` | Unique device identifier / UUID. |
| `device_name` | `varchar(255)` | Android device model (e.g., "Samsung Galaxy S24"). |
| `device_platform` | `varchar(50)` | `'android'`, `'ios'`. |
| `biometric_type` | `varchar(50)` | `'fingerprint'`, `'face_id'`. |
| `is_active` | `boolean` | `true` if active. |

#### 3. `personal_access_tokens` (Laravel Sanctum)
| Column | Type | Description |
|---|---|---|
| `tokenable_id` | `bigint unsigned` | User account ID. |
| `tokenable_type` | `varchar(255)` | `App\Models\Account`. |
| `name` | `varchar(255)` | Token name (`{email}_Token` or `mobile_app_token`). |
| `token` | `varchar(64)` | Hashed SHA-256 token string. |

---

## 4. Backend (API Contracts)

### Endpoints Reused

#### 1. Standard Login Endpoint
- **Route:** `POST /api/login`
- **Controller:** `App\Http\Controllers\AuthController@login`
- **Request Payload:**
```json
{
  "email": "employee@zentrelink.com",
  "password": "Password123!",
  "device_name": "Pixel 8 Pro (Android 14)"
}
```
- **Success Response (`200 OK`):**
```json
{
  "status": 200,
  "email": "employee@zentrelink.com",
  "token": "14|6a8b9c0d1e2f3g4h5i6j7k8l9m0n...",
  "role": 2,
  "biometric_registered": true,
  "message": "Logged In Successfully"
}
```
- **Error Response — Invalid Credentials (`401 Unauthorized`):**
```json
{
  "status": 401,
  "message": "Invalid Credentials"
}
```
- **Error Response — Validation Error (`422 Unprocessable Entity`):**
```json
{
  "validation_errors": {
    "email": ["The email field is required."],
    "password": ["The password field is required."]
  }
}
```

#### 2. Biometric Device Authentication Endpoint
- **Route:** `POST /api/biometric/authenticate-device`
- **Controller:** `App\Http\Controllers\BiometricController@authenticateByDevice`
- **Request Payload:**
```json
{
  "device_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "email": "employee@zentrelink.com"
}
```
- **Success Response (`200 OK`):**
```json
{
  "status": 200,
  "token": "15|9f8e7d6c5b4a3...",
  "user": {
    "id": 42,
    "email": "employee@zentrelink.com",
    "fname": "Juan",
    "lname": "Dela Cruz",
    "role_access": 2
  },
  "message": "Biometric authentication successful"
}
```

#### 3. User Profile & Account State
- **Route:** `GET /api/account`
- **Header:** `Authorization: Bearer <token>`
- **Controller:** `App\Http\Controllers\AccountController@index`

---

## 5. Frontend Architecture (React Native / Expo)

### Directory & File Structure (`resources/views/mobapp/src/`)

```
resources/views/mobapp/src/
├── app/
│   ├── _layout.tsx                     # Root provider: Theme, AuthProvider, Splash
│   ├── (auth)/
│   │   ├── _layout.tsx                 # Auth stack navigator (no header, dark background)
│   │   ├── login.tsx                   # Main Login Screen Page
│   │   └── forgot-password.tsx         # Password recovery screen
│   └── (app)/                          # Protected application stack
│       ├── _layout.tsx                 # Tab navigation & drawer
│       ├── index.tsx                   # Mobile Dashboard / Home
│       └── explore.tsx                 # Additional tabs
├── components/
│   ├── auth/
│   │   ├── BrandHeader.tsx             # Zentre Link Logo with cyber ambient glow
│   │   ├── CyberInput.tsx              # Glowing floating/bordered text input with icons
│   │   ├── CyberButton.tsx             # Neon gradient button with loading spinner
│   │   ├── BiometricPromptButton.tsx   # Android Fingerprint / Face Unlock launcher
│   │   └── RememberMeToggle.tsx        # Custom check pill for "Remember me"
│   ├── ui/
│   │   ├── GlassCard.tsx               # Blurred translucent card container
│   │   └── StatusBanner.tsx            # Animated error/success notification bar
│   └── themed-text.tsx                 # Typography system
├── constants/
│   ├── theme.ts                        # Cyber-Enterprise Color Palette & Spacing tokens
│   └── api.ts                          # Base API endpoints & storage keys
├── contexts/
│   └── AuthContext.tsx                 # Global reactive auth state (token, user, login, logout)
├── hooks/
│   ├── use-auth.ts                     # Auth hook wrapping AuthContext
│   ├── use-biometrics.ts               # Hardware biometric detector & trigger hook
│   └── use-theme.ts                    # Dynamic theme hook
├── services/
│   ├── api/
│   │   └── auth.api.ts                 # Axios / Fetch client calling Laravel endpoints
│   └── storage/
│       └── secure-storage.ts           # expo-secure-store wrapper for tokens & credentials
└── types/
    └── auth.types.ts                   # TypeScript interfaces (LoginPayload, AuthResponse, User)
```

### Visual & Layout Design System (Tokens)

```typescript
// resources/views/mobapp/src/constants/theme.ts extensions
export const CyberTheme = {
  colors: {
    background: '#070D18',          // Deep Obsidian base
    backgroundSecondary: '#0B1220', // Background gradient top
    cardBackground: '#0F1928E6',    // Glassmorphic navy (85-90% opacity)
    cardBorder: '#00E5FF33',        // Neon cyan translucent border (20%)
    inputBackground: '#0F1B2E',     // Input cavity background
    inputBorder: '#1E2C44',         // Default input border
    inputFocusBorder: '#00E5FF',    // Active neon focus
    inputFocusGlow: 'rgba(0, 229, 255, 0.35)',
    errorBorder: '#F43F5E',         // Rose red error state
    errorGlow: 'rgba(244, 63, 94, 0.3)',
    primaryCyan: '#00E5FF',         // Core brand cyan
    primaryBlue: '#00A3FF',         // Secondary gradient blue
    textPrimary: '#FFFFFF',         // Crisp white headers
    textSecondary: '#8FA3BF',       // Subtitle and placeholder slate
    textMuted: '#4E617E',           // Subtle footer text
    accentOrange: '#FF9100',        // Warning / badge accent
  },
  typography: {
    brandTitle: { fontSize: 24, fontWeight: '700', letterSpacing: 0.5 },
    screenHeading: { fontSize: 20, fontWeight: '600', letterSpacing: 0.2 },
    body: { fontSize: 14, fontWeight: '400' },
    input: { fontSize: 15, fontWeight: '500' },
    button: { fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
    caption: { fontSize: 12, fontWeight: '400' },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    inputHeight: 52,                // Touch-optimized Android standard
    buttonHeight: 52,
    borderRadius: 14,
  }
};
```

### UI Screen Layout Sketch (Mobile Portrait)

```
┌─────────────────────────────────────────────────────┐
│ 🔋 9:41                             📶 5G  [ 100% ] │  <- Translucent Android Status Bar
├─────────────────────────────────────────────────────┤
│                                                     │
│                [ ⬡ ZENTRE LINK ⬡ ]                  │  <- Glowing Cyan Logo
│                 Zentre Link Core                    │  <- White Bold (22sp)
│               ENTERPRISE ECOSYSTEM                  │  <- Cyan Subtitle (11sp)
│                                                     │
│     ┌─────────────────────────────────────────┐     │
│     │  ─── Access the Core ───               │     │  <- Glass Card (#0F1928)
│     │  Sign in with your enterprise account   │     │     Top Cyan Glow Line
│     │                                         │     │
│     │  WORK EMAIL OR EMPLOYEE ID              │     │
│     │  ┌───────────────────────────────────┐  │     │
│     │  │ ✉  you@company.com / 00001        │  │     │  <- Cyan Glow on Focus
│     │  └───────────────────────────────────┘  │     │
│     │                                         │     │
│     │  PASSWORD                               │     │
│     │  ┌───────────────────────────────────┐  │     │
│     │  │ 🔒  •••••••••••••••••        👁  │  │     │  <- Eye Toggle Button
│     │  └───────────────────────────────────┘  │     │
│     │                                         │     │
│     │  [✓] Remember Me      Forgot Password?  │     │
│     │                                         │     │
│     │  ┌───────────────────────────────────┐  │     │
│     │  │        ⚡ SECURE LOGIN             │  │     │  <- Gradient Cyan Button
│     │  └───────────────────────────────────┘  │     │
│     │                                         │     │
│     │  ────────────── OR ──────────────       │     │
│     │                                         │     │
│     │  ┌───────────────────────────────────┐  │     │
│     │  │ 👆  Sign in with Biometrics       │  │     │  <- Android Biometric Button
│     │  └───────────────────────────────────┘  │     │
│     │                                         │     │
│     └─────────────────────────────────────────┘     │
│                                                     │
│        🔒 256-Bit SSL Encrypted • SubHRMS v2.4       │  <- Footer Security Badge
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 6. Business Rules & Edge Cases

### HRMS & Security Domain Rules
1. **Sanctum Multi-Device Session Support**: When the user authenticates from Android, the token name is tagged with `mobile_app_{timestamp}` so it can be distinguished from web browser sessions.
2. **Deactivated Account Guard**: If `Account.status === 0`, authentication is rejected with `401 Unauthorized` and an explicit message *"Account has been deactivated. Please contact your HR administrator."*
3. **Biometric Enrollment Dependency**: Biometric authentication can only be utilized after the employee has registered their mobile device via password verification (or enabled it in app settings).
4. **Token Expiry & Invalidation**: Any `401 Unauthorized` on authenticated calls automatically clears the stored token and smoothly redirects to the Login screen.

### Non-Functional & Failure-Mode Checklist (Mandatory)

| Category | Requirement & Specification |
|---|---|
| **Authorization** | The login screen is publicly accessible. Upon login, the returned `role` (`1`: Admin, `2`: Employee, `3`: Manager, etc.) is preserved in state to govern accessible tabs in the mobile drawer/tabs. Unauthenticated requests are rejected. |
| **Concurrency / double-submit** | Tapping "Secure Login" immediately sets `isLoading = true` and disables the button and inputs. Simultaneous submissions are blocked at the component state level. |
| **Idempotency on retries** | Login requests are idempotent: duplicate logins issue a valid Sanctum bearer token without corrupting the user's account state or password hash. |
| **Error response shape & status codes** | `401`: `{"status": 401, "message": "Invalid Credentials"}`; `422`: `{"validation_errors": {"email": [...], "password": [...]}}`; `500`: `{"message": "Server error"}`. Mobile client handles all 3 shapes gracefully without crashing. |
| **Input validation boundaries** | Inputs are trimmed. Passwords must be at least 8 characters. Malformed emails display localized mobile inline error messages before sending network requests. |
| **Keyboard & Screen Resizing** | `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` inside a scrollable `ScrollView` with `keyboardShouldPersistTaps="handled"` prevents inputs from being hidden behind Android soft keyboards. |
| **Offline Resilience** | If network is unavailable (airplane mode or lost signal), Axios interceptor catches `ERR_NETWORK` and displays an offline banner without unhandled exception crashes. |

---

## 7. Build Order

1. **Prerequisites & Dependencies**:
   - Verify/Install Expo dependencies: `expo-secure-store`, `expo-local-authentication`, `expo-haptics`, `lucide-react-native` (or vector icons).
2. **Design Tokens & Theme Setup**:
   - Extend `src/constants/theme.ts` with the Cyber-Enterprise color palette, typography, and spacing.
3. **Storage & API Layer**:
   - Create `src/services/storage/secure-storage.ts` for encrypted token and preference management.
   - Create `src/services/api/auth.api.ts` connecting to Laravel `api/login` and `api/biometric/*`.
4. **Auth Context & State Machine**:
   - Implement `src/contexts/AuthContext.tsx` and `src/hooks/use-auth.ts` for managing session hydration, login, logout, and token dispatch.
5. **Gate 1: Frontend UI Implementation (Static / Mock Validation)**:
   - Build UI components: `BrandHeader.tsx`, `CyberInput.tsx`, `CyberButton.tsx`, `GlassCard.tsx`, `BiometricPromptButton.tsx`.
   - Build `src/app/(auth)/login.tsx` using mock delay and design-first validation to confirm high-fidelity Android aesthetics.
6. **Gate 2: Live Backend Integration**:
   - Wire live `login()` API calls against Laravel's `/api/login` endpoint.
   - Wire hardware biometric authentication using `expo-local-authentication` paired with `/api/biometric/authenticate-device`.
   - Test navigation redirect into `/(app)` on successful login.

---

## 8. Out of Scope (Future Specs)

- **Self-Service Employee Registration**: Registration is managed by HR administrators in the web portal.
- **Microsoft 365 OAuth Deep-Link Webview**: Separate spec for In-App Browser SSO OAuth redirect flow.
- **Push Notification Token Registration**: Will be specified under `mobile_push_notifications.md`.
- **Offline PIN-code Fallback**: Future enhancement for offline kiosk clock-in.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 through AC-11).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] UI adheres to the Zentre Link Core Cyber-Enterprise dark aesthetic with glowing neon cyan accents.
- [ ] Android soft keyboard handles input focus smoothly without layout clipping.
- [ ] Sanctum Bearer tokens are stored exclusively in encrypted `expo-secure-store`.
- [ ] Biometric authentication works natively on Android fingerprint/face unlock hardware.
