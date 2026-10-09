Design a modern **enterprise HRMS login experience** for a professional workforce management platform with both **web and mobile app support**.

### Design Direction

Create a premium, modern enterprise interface inspired by contemporary SaaS products such as Slack, Linear, Notion, Microsoft 365, and modern HR platforms.

The overall design should communicate:

* Trust
* Security
* Professionalism
* Simplicity
* Warmth
* Reliability
* Modern enterprise technology

Avoid making the interface look overly corporate, cold, or generic.

Avoid excessive gradients, excessive rounded cards, neon colors, strong shadows, glassmorphism, or visually noisy elements.

The design should feel **clean, minimal, calm, polished, and production-ready**.

---

## Visual Theme — "Golden Summer Fields"

Use a sophisticated color system inspired by **Golden Summer Fields**.

The light theme should feel like:

* Warm sunlight
* Soft golden fields
* Natural cream
* Warm ivory
* Muted olive
* Soft sage
* Subtle earthy neutrals

Use golden/yellow tones primarily as **accent colors**, not as the dominant background.

Suggested visual direction:

* Warm ivory / off-white background
* Soft cream surfaces
* Muted charcoal text
* Deep olive or dark green secondary accents
* Soft golden yellow for primary actions and highlights
* Very subtle beige borders
* Muted sage for positive/status states

The colors must be **soft and easy on the eyes**, especially during long work sessions.

Do not use saturated bright yellow.

---

## Dark Mode

Create a carefully designed dark mode rather than simply inverting the light theme.

Dark mode should use:

* Deep charcoal
* Warm dark gray
* Slightly green/olive-tinted dark surfaces
* Muted gold accents
* Soft warm-white text
* Subtle borders

Avoid pure black (#000000) backgrounds.

Avoid extremely bright yellow against dark backgrounds.

The dark theme should feel sophisticated and comfortable for extended use.

Ensure that the same brand identity is preserved between light and dark modes.

---

# Login Page Layout

Create a responsive enterprise login page.

### Desktop

Use a balanced two-column composition:

**Left side — Brand / Product Experience**

Display:

* HRMS logo
* Short product statement
* Minimal illustration or abstract visual representing employees/workforce collaboration
* Very subtle golden-field inspired visual treatment
* Small supporting text such as:
  "One workspace for your people, time, payroll, and workplace operations."

The visual should remain minimal and should not distract from the login form.

**Right side — Login Form**

Place a clean authentication panel containing:

* Welcome heading
* Short supporting message
* Work email / employee ID field
* Password field
* Show/hide password control
* Remember me checkbox
* Forgot password link
* Primary "Sign In" button
* Optional SSO button
* Optional biometric/mobile authentication indication
* Security/privacy notice

The login form should be visually dominant.

---

# Login Form UX

Make the form extremely user-friendly.

Use:

* Clear field labels
* Comfortable input height
* Large clickable areas
* Strong keyboard accessibility
* Visible focus states
* Inline validation
* Clear error messages
* Password visibility toggle
* Loading state after submission
* Disabled state while authenticating
* Success transition after authentication

Do not rely on placeholders as the only field labels.

Example:

Email / Employee ID

instead of only:

"Enter your email"

Use subtle helper text where appropriate.

Error messages should be human-readable.

Example:

"Please enter your work email."

Instead of:

"Invalid input."

---

# Enterprise Authentication

Design the experience to support multiple authentication methods.

Primary:

**Sign in**

Secondary options:

**Continue with Microsoft**
**Continue with Google Workspace**
**SSO**

If appropriate, include:

**Sign in with your mobile app**

The mobile authentication option should visually communicate that the HRMS has a companion mobile application.

Do not overcrowd the login page with authentication methods.

Use progressive disclosure if necessary.

---

# Mobile App Support

The web login experience should clearly feel connected to the HRMS mobile application.

Include a subtle section such as:

"Use the HRMS mobile app"

with:

* QR code placeholder
* App Store badge placeholder
* Google Play badge placeholder

Keep this secondary to the primary login action.

The QR/app section should not dominate the page.

On mobile screens, hide the large desktop illustration and prioritize the authentication flow.

---

# Responsive Behavior

Design for:

* Desktop
* Laptop
* Tablet
* Mobile

Desktop:

Two-column layout.

Tablet:

Reduce the visual panel and give more space to the login form.

Mobile:

Single-column layout.

Order:

1. Logo
2. Welcome message
3. Login form
4. Forgot password
5. Authentication alternatives
6. Mobile app section
7. Security/privacy information

Maintain generous spacing and avoid cramped layouts.

---

# Accessibility

Follow modern accessibility principles.

Requirements:

* WCAG-conscious contrast
* Keyboard navigation
* Visible focus indicators
* Semantic form labels
* Screen-reader-friendly controls
* Minimum comfortable touch target sizes
* Do not communicate information through color alone
* Error states should include icons/text in addition to color
* Dark mode must maintain readable contrast
* Avoid excessive visual motion

Animations should be subtle and fast.

---

# Micro-interactions

Use polished but restrained animations.

Examples:

* Input focus transition
* Button hover
* Button press
* Password visibility transition
* Login loading state
* Authentication success transition
* Subtle page entrance animation

Animation should feel like a premium enterprise product.

Avoid:

* Bouncing elements
* Excessive parallax
* Large animated backgrounds
* Distracting particles
* Long transitions

---

# UI Components

Use a consistent modern design system.

Components should include:

* Logo
* Input fields
* Password field
* Checkbox
* Primary button
* Secondary button
* SSO button
* Links
* Error alert
* Success alert
* Loading indicator
* QR code container
* App download section
* Theme switcher
* Language selector

Use consistent:

* Border radius
* Spacing scale
* Typography
* Iconography
* Shadows
* Borders
* Interaction states

---

# Typography

Use a modern highly readable sans-serif font.

Typography should feel similar to modern enterprise SaaS applications.

Recommended characteristics:

* Strong but not oversized heading
* Medium-weight labels
* Highly readable body text
* Clear hierarchy
* Comfortable line height

Avoid overly futuristic fonts.

---

# Color System

Create a complete semantic color system for both themes.

### Light Theme

Primary background:
Warm ivory / soft cream

Surface:
Warm white

Primary:
Muted golden yellow

Secondary:
Deep olive / muted green

Text:
Warm charcoal

Secondary text:
Muted gray

Border:
Soft beige

Success:
Muted green

Warning:
Warm amber

Error:
Muted red

Info:
Soft blue

### Dark Theme

Background:
Deep charcoal with subtle warm/olive undertone

Surface:
Dark warm gray

Primary:
Muted golden accent

Secondary:
Muted sage/olive

Text:
Warm white

Secondary text:
Soft gray

Border:
Subtle warm-gray border

Success:
Muted green

Warning:
Soft amber

Error:
Muted coral/red

Info:
Muted blue

Ensure the golden accent is adjusted between themes for accessibility rather than using exactly the same yellow value.

---

# Brand Personality

The final result should feel:

**Modern + Enterprise + Human + Calm + Secure**

Think:

"Modern HR technology with a warm human touch."

It should NOT feel like:

* A banking login
* A gaming UI
* A crypto dashboard
* A futuristic AI interface
* A generic Bootstrap login
* An overly colorful startup landing page

---

# Visual Quality

The final design should look like a **real enterprise HRMS product ready for production**.

Pay particular attention to:

* Pixel-level alignment
* Consistent spacing
* Typography hierarchy
* Form usability
* Responsive behavior
* Light/dark theme consistency
* Accessibility
* Visual balance
* Professional empty space
* Subtle depth
* High-quality icons

Create both **Light Mode and Dark Mode** versions.

Show the complete login experience including:

1. Default state
2. Focused input state
3. Validation error state
4. Loading/signing-in state
5. Password visibility state
6. Dark mode
7. Mobile responsive state

The final result should look polished enough to serve as the foundation of a complete enterprise HRMS design system.
