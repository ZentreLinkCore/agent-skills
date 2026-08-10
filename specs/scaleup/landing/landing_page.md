# Spec — ScaleUP Landing Page (Public Homepage & Platform Showcase)

> **Kind:** **Greenfield** — High-converting, modern SaaS landing page and public platform showcase for ScaleUP.
> **Portal:** **Public / Landing** (Route `/`, public endpoints under `/api/public` or `/api/inquiries`).
> **Route:** `GET /` (`landing_page`), `GET /app` (`app_entry`), `POST /api/public/inquiries` (`public_inquiries_store`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md) / React standards.
> **System Awareness:** Models: `Inquiry` (Optional/New for lead capture); Tables: `inquiries` (Optional/New); Routes: `GET /`, `POST /api/public/inquiries`; New migration: Optional (lead capture / contact submissions).

---

## 1. Purpose

ScaleUP is an evolving, all-in-one business growth platform and ecosystem designed to help entrepreneurs, startups, and growing enterprises organize daily operations, track finances, extract data-driven insights, plan strategic goals, network with business communities, and discover investment/growth opportunities.

**The goal of this landing page:**
1. **First-Impression Impact:** Deliver a visually stunning, world-class SaaS hero interface featuring dark obsidian tones, glassmorphism cards, glowing Blue (`#2563EB` / `#3B82F6`) and Emerald (`#10B981` / `#059669`) gradients, floating analytics mockups, and micro-interactions.
2. **Future-Proof Narrative:** Communicate the full long-term vision of ScaleUP so that as the platform expands from core operations into a complete business network and investment ecosystem, the messaging remains coherent without frequent copy rewrites.
3. **Conversion & Engagement:** Drive visitor engagement through clear value propositions, interactive feature showcases, a 7-step business journey roadmap, and high-contrast CTA touchpoints ("Get Started", "Learn More", "Contact Us").
4. **Lead Capture & Inquiries:** Provide frictionless capture for prospective clients, early adopters, and enterprise inquiries.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Page Architecture & Rendering Engine

**Option A — React Component Tree Mounted via Laravel Blade + Vite (Recommended)**
- Mount a full React landing component tree into `resources/views/app.blade.php` (or a dedicated `landing.blade.php`) powered by the active React 19 + Tailwind CSS v4 stack.
- Uses smooth scrolling anchor links (`#features`, `#journey`, `#why-scaleup`, `#vision`, `#contact`) with animated transitions.

| Pros | Cons |
|---|---|
| Native integration with the existing React 19 + Vite setup in `resources/js/app.jsx` | Initial JavaScript bundle required for full interactivity |
| Enables rich interactive elements (floating live dashboard preview cards, tabbed feature switcher, stepper animations) | Needs careful metadata injection for server-side SEO |
| Single source of component truth shared with authenticated app widgets | |
| Fast development and seamless hot-module replacement (HMR) | |

**Option B — Pure Blade HTML + Tailwind CSS (No React on Landing)**
- Build the entire landing page as static Blade templates with minimal Alpine.js / Vanilla JS.

| Pros | Cons |
|---|---|
| Instant initial page render with zero React hydration cost | Duplicates UI component abstractions between landing and application |
| Lightweight SEO out-of-the-box | Complex interactive widgets (interactive dashboard preview, dynamic calculators, animated steppers) are cumbersome to maintain |

**Recommendation: Option A.** ScaleUP's stack is already configured with React 19 + Vite. Building the landing page with React provides maximum component reusability, interactive fluidity (e.g., interactive dashboard preview cards, modal dialogues, smooth step progressors), and aligns with modern SaaS standards.

---

### Decision 2: Theme & Visual Aesthetic

**Option A — Sleek Dark Mode with Obsidian & Emerald/Blue Glow Accents (Recommended)**
- Primary dark palette (`#0B0F17` / `#0F172A`), obsidian backdrop, subtle radial gradient meshes (Electric Blue `#3B82F6` and Emerald Green `#10B981`), glassmorphism card surfaces (`bg-white/[0.03]` with `border-white/[0.08]` and `backdrop-blur-xl`), and crisp typography (`Instrument Sans` / `Inter`).

| Pros | Cons |
|---|---|
| Creates an immediate premium, state-of-the-art SaaS impression | Requires precise contrast checking for high-contrast accessibility (WCAG AA) |
| Naturally emphasizes glowing metric charts and floating dashboard mockups | Some traditional corporate audiences may prefer a light theme |
| Matches the aesthetic guidelines specified in [ui-design.md](../../rules/ui-design.md) | |

**Option B — Light & Dark Dual Theme Toggle**
- Support instant theme toggling between an ultra-clean Light SaaS theme and Dark theme.

| Pros | Cons |
|---|---|
| Maximum user preference accommodation | Increases CSS token maintenance and complexity for background glow effects and glass cards |

**Recommendation: Option A (Dark-first aesthetic).** Dark modern SaaS aesthetics with emerald/blue accents strongly communicate high technology, growth, and modern business intelligence. A light theme token set can be introduced as an extension later if desired.

---

### Decision 3: CTA & Inquiry Handling Mechanism

**Option A — Dual Action: Direct App Onboarding + Interactive Contact/Demo Modal (Recommended)**
- "Get Started" links directly to the registration/onboarding flow (`/app` or `/register`).
- "Contact Us" / "Learn More" triggers a smooth glassmorphism Modal or scrolls to an inquiry form connected to a backend endpoint (`POST /api/public/inquiries`).

| Pros | Cons |
|---|---|
| Catches both self-serve users (immediate sign up) and enterprise/partner prospects (inquiries) | Requires building both a modal dialog and an inquiry submission handler |
| Zero friction for exploration with instant modal feedback | |
| Stores inbound leads directly into the database with notification potential | |

**Option B — External Redirect Only (Mailto / Static Link)**
- "Contact Us" opens `mailto:support@scaleup.com` or redirects to a simple email link.

| Pros | Cons |
|---|---|
| Zero backend code required | High drop-off rate for visitors without default mail clients configured; no structured lead tracking |

**Recommendation: Option A.** Provides a professional SaaS experience, collects structured lead metadata, and preserves conversion momentum.

---

### Decision 4: Business Journey Presentation

**Option A — Interactive Step-by-Step Roadmap with Active State Preview (Recommended)**
- Render the 7-step journey (`Start` → `Manage` → `Track` → `Analyze` → `Plan` → `Connect` → `Scale`) as an interactive horizontal/vertical progression bar where clicking or hovering each milestone highlights corresponding platform capabilities and sample analytics.

| Pros | Cons |
|---|---|
| Visually captivating; clearly communicates the platform's multi-stage support | Requires responsive breakpoint handling (horizontal on desktop, vertical on mobile) |
| Demonstrates the evolutionary value from simple operations to full ecosystem scale | Slightly higher frontend interaction code |

**Option B — Static Connected Badge List**
- Render a static vertical chevron chain or 7 numbered static cards in a grid.

| Pros | Cons |
|---|---|
| Simple markup and zero state logic | Less engaging for visitors skimming the landing page |

**Recommendation: Option A.** The 7-step journey is a core differentiator showing that ScaleUP grows alongside the business. An interactive progression brings the narrative to life.

---

## 3. Database Schema

### Table: `inquiries` (Lead Capture & Contact Form)

| Column | Type | Nullable | Default | Description / Purpose |
|---|---|---|---|---|
| `id` | `unsignedBigInteger` | NO | `auto_increment` | Primary key |
| `name` | `varchar(255)` | NO | - | Full name of the prospect |
| `email` | `varchar(255)` | NO | - | Business email address (indexed) |
| `company_name` | `varchar(255)` | YES | `NULL` | Business / organization name |
| `phone` | `varchar(50)` | YES | `NULL` | Contact phone number |
| `business_stage` | `varchar(50)` | YES | `'startup'` | Stage: `startup`, `growing`, `enterprise`, `mentor`, `investor` |
| `message` | `text` | NO | - | Inquiry message / requirements |
| `source` | `varchar(100)` | NO | `'landing_page'` | Source identifier (landing CTA, demo request, partner inquiry) |
| `status` | `tinyInteger` | NO | `1` | `1=New/Pending`, `2=Contacted`, `3=Qualified`, `0=Archived` |
| `ip_address` | `varchar(45)` | YES | `NULL` | Visitor IP address for rate-limiting & fraud prevention |
| `created_at` | `timestamp` | YES | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | `timestamp` | YES | `CURRENT_TIMESTAMP` | Record update timestamp |

**Indexes:**
- `INDEX (email)`
- `INDEX (status)`
- `INDEX (created_at)`

---

## 4. Backend Architecture

Following the **thin-controller + Query/Handler pattern** ([project-profile.md](../../rules/project-profile.md)):

```
app/
├── Models/
│   └── Inquiry.php
├── Queries/
│   └── Inquiry/
│       └── GetInquiriesQuery.php
├── Handlers/
│   └── Inquiry/
│       └── StoreInquiryHandler.php
└── Http/
    ├── Controllers/
    │   └── Public/
    │       └── LandingController.php
    └── Requests/
        └── StoreInquiryRequest.php
```

### 1. Routes (`routes/web.php` & `routes/api.php`)

```php
// routes/web.php
use App\Http\Controllers\Public\LandingController;

Route::get('/', [LandingController::class, 'index'])->name('landing.index');
Route::get('/app', function () {
    return view('app');
})->name('app.index');
```

```php
// routes/api.php (Public Endpoints)
use App\Http\Controllers\Public\LandingController;

Route::prefix('public')->group(function () {
    Route::post('/inquiries', [LandingController::class, 'storeInquiry'])
        ->middleware(['throttle:5,1']) // 5 submissions per minute rate limit
        ->name('api.public.inquiries.store');
});
```

### 2. Controller Dispatcher (`LandingController.php`)

```php
namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInquiryRequest;
use App\Handlers\Inquiry\StoreInquiryHandler;
use Illuminate\Http\Request;
use Exception;

class LandingController extends Controller
{
    public function index()
    {
        return view('app');
    }

    public function storeInquiry(StoreInquiryRequest $request)
    {
        try {
            $inquiry = StoreInquiryHandler::execute($request->validated() + [
                'ip_address' => $request->ip(),
            ]);
            return response()->json([
                'success' => true,
                'message' => 'Thank you for reaching out! Our team will contact you shortly.',
                'data' => $inquiry,
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}
```

### 3. Handler (`StoreInquiryHandler.php`)

```php
namespace App\Handlers\Inquiry;

use App\Handlers\Handler;
use App\Models\Inquiry;
use Illuminate\Support\Facades\DB;

class StoreInquiryHandler extends Handler
{
    public static function execute($params = [])
    {
        return DB::transaction(function () use ($params) {
            return Inquiry::create([
                'name'           => $params['name'],
                'email'          => $params['email'],
                'company_name'   => $params['company_name'] ?? null,
                'phone'          => $params['phone'] ?? null,
                'business_stage' => $params['business_stage'] ?? 'startup',
                'message'        => $params['message'],
                'source'         => $params['source'] ?? 'landing_page',
                'status'         => 1,
                'ip_address'     => $params['ip_address'] ?? null,
            ]);
        });
    }
}
```

---

## 5. Frontend Architecture & UI Layout

### Component Hierarchy (`resources/views/web/`)

```
resources/views/web/
├── app/
│   └── axios/
│       └── axiosInstance.js             # HTTP client instance
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── Badge.jsx                # Glowing pill badge component
│   │       ├── Button.jsx               # Primary emerald/blue gradient & outline buttons
│   │       ├── Card.jsx                 # Glassmorphism container with border hover
│   │       └── Icons.jsx                # SVG icons collection
│   └── module/
│       └── landing/
│           └── landing_page/
│               ├── index.jsx            # Module barrel export
│               ├── api/
│               │   └── landing.api.js   # useLandingApi() service layer
│               ├── pages/
│               │   └── LandingPage.jsx  # Main container page view
│               └── components/
│                   ├── Navbar.jsx
│                   ├── HeroSection.jsx
│                   ├── DashboardPreview.jsx
│                   ├── TrustedPlatformSection.jsx
│                   ├── FeaturesSection.jsx
│                   ├── WhyScaleUpSection.jsx
│                   ├── BusinessJourneySection.jsx
│                   ├── FutureVisionSection.jsx
│                   ├── CtaSection.jsx
│                   ├── ContactModal.jsx
│                   └── Footer.jsx
├── App.jsx                              # Root React App Component
└── main.jsx                             # Vite Entrypoint mounting to #app
```


---

### Detailed Section Specs & Copy

#### 1. Navigation Bar (`Navbar.jsx`)
- **Visuals:** Sticky header (`sticky top-0 z-50`), `backdrop-blur-xl bg-[#0B0F17]/80`, thin border `border-b border-white/[0.08]`.
- **Logo:** `ScaleUP` brand logo with an upward trending emerald/blue gradient icon.
- **Navigation Links:**
  - Features (`#features`)
  - Platform (`#platform`)
  - Journey (`#journey`)
  - Why ScaleUP (`#why-scaleup`)
  - Future Vision (`#vision`)
- **Actions:**
  - Secondary: `Sign In` (link to `/app` or `/login`)
  - Primary: `Get Started` (emerald-blue gradient pill button)

#### 2. Hero Section (`HeroSection.jsx`)
- **Badge:**
  ```text
  🚀 Empowering Businesses to Grow Smarter
  ```
  *(Glowing pill badge with emerald border, subtle pulsing radar dot, and gradient text)*
- **Headline:**
  ```text
  Scale Your Business Beyond Limits.
  ```
  *(Large display font `text-5xl lg:text-7xl font-extrabold tracking-tight`, with "Beyond Limits" rendered in vibrant Emerald-to-Cyan gradient text)*
- **Subheadline:**
  ```text
  ScaleUP is a modern business growth platform that helps entrepreneurs and organizations manage operations, monitor performance, plan for the future, and unlock new opportunities through data-driven insights and meaningful business connections.
  ```
  *(Max width `max-w-3xl`, text slate-300, leading-relaxed)*
- **CTAs:**
  - **Primary Button:** `Get Started` *(Icon `ArrowRight`, emerald-blue gradient, drop shadow)*
  - **Secondary Button:** `Learn More` *(Glass button with subtle white border, smooth scroll to `#features`)*
- **Hero Graphic / Visual:**
  - **Interactive Dashboard Preview (`DashboardPreview.jsx`):**
    - Floating SaaS Glassmorphism Card showing Real-Time Revenue Growth (`+148.5%`), Cashflow Analytics, Performance Bar Graphs, and Activity Feed.
    - Floating UI Mini-Badges: "⚡ Strategic Goal Reached: Q3 Target", "📈 Revenue Trend: +28.4%", "🤝 3 New Partner Opportunities Connected".
    - Background Ambience: Blue & Emerald radial blur gradients (`blur-3xl opacity-30`).

#### 3. Trusted Growth Platform Section (`TrustedPlatformSection.jsx`)
- **Heading:**
  ```text
  Everything Your Business Needs to Grow
  ```
- **Description:**
  ```text
  Running a successful business requires more than tracking income and expenses. ScaleUP provides a centralized platform where businesses can organize operations, monitor performance, set strategic goals, and make informed decisions that support sustainable growth.
  ```
- **Key Metrics Grid (3 Highlights):**
  - `Unified Platform`: Centralized workspace for complete business control.
  - `Real-Time Data`: Live metrics, KPI tracking, and automated reporting.
  - `Ecosystem Driven`: Strategic planning coupled with business networking.

#### 4. Features Section (`FeaturesSection.jsx`)
- **Section Heading:**
  ```text
  Designed for Every Stage of Your Business
  ```
- **Section Description:**
  ```text
  Whether you're launching a startup, managing a growing company, or expanding an established organization, ScaleUP provides the tools needed to simplify operations and accelerate growth.
  ```
- **Feature Cards Grid (6 Interactive Glassmorphism Cards):**

| # | Feature Title | Icon | Description |
|---|---|---|---|
| 1 | **Business Management** | `Building2` / `Briefcase` | Manage your business information, daily operations, and organizational structure from a centralized workspace designed for efficiency. |
| 2 | **Financial Tracking** | `WalletCards` / `TrendingUp` | Monitor sales, expenses, transactions, and overall financial performance with organized and reliable business records. |
| 3 | **Business Analytics** | `BarChart3` / `PieChart` | Transform business data into valuable insights through interactive dashboards, reports, and performance indicators. |
| 4 | **Strategic Planning** | `Target` / `Compass` | Define business objectives, set measurable goals, and track long-term progress with structured planning tools. |
| 5 | **Business Community** | `Users2` / `MessagesSquare` | Connect with entrepreneurs, organizations, mentors, and industry professionals to exchange ideas and build meaningful relationships. |
| 6 | **Growth Opportunities** | `Sparkles` / `Rocket` | Discover partnerships, investment opportunities, collaborations, and business programs that help accelerate your company's growth. |

#### 5. Why ScaleUP Section (`WhyScaleUpSection.jsx`)
- **Section Heading:**
  ```text
  Built for Modern Businesses
  ```
- **Section Description:**
  ```text
  ScaleUP is designed to become more than a business management platform. It is built as a complete business ecosystem that supports entrepreneurs throughout every stage of their journey.
  ```
- **6 Core Value Pillars:**
  1. **Centralized Business Platform:** Manage everything from one place with a unified business workspace.
  2. **Data-Driven Decisions:** Access meaningful insights that help improve business performance and reduce uncertainty.
  3. **Growth-Focused Planning:** Create strategies, monitor progress, and achieve long-term business objectives.
  4. **Secure & Reliable:** Protect your business information with modern security practices and reliable infrastructure.
  5. **Scalable Platform:** Whether you're a startup or a growing enterprise, ScaleUP is designed to grow alongside your business.
  6. **Connected Business Ecosystem:** Build relationships, discover opportunities, and collaborate with businesses that share your vision.

#### 6. Business Journey Roadmap Section (`BusinessJourneySection.jsx`)
- **Section Heading:**
  ```text
  Your Growth Journey Starts Here
  ```
- **Interactive 7-Step Sequential Stepper:**
  ```
  [1. Start Your Business]
             ↓
  [2. Manage Daily Operations]
             ↓
  [3. Track Business Performance]
             ↓
  [4. Analyze Business Insights]
             ↓
  [5. Plan Strategic Goals]
             ↓
  [6. Connect with Opportunities]
             ↓
  [7. Scale Your Business]
  ```
- **Visual Design:** A glowing timeline connecting glowing milestone nodes. On desktop, structured as an elegant zig-zag or horizontal progression timeline; on mobile, structured as a clean vertical step flow with animated check indicators.

#### 7. Future Vision Section (`FutureVisionSection.jsx`)
- **Section Heading:**
  ```text
  More Than Business Management
  ```
- **Description:**
  ```text
  ScaleUP is evolving into a complete business ecosystem where entrepreneurs can manage operations, build strategies, connect with organizations, discover investment opportunities, and grow together through technology.
  ```
- **Ecosystem Pillars Grid:**
  - *Smart Operations* ➔ Automated workflows, records, and business administration.
  - *Data Intelligence* ➔ Predictive growth analytics and real-time KPI health check.
  - *Syndicate & Capital* ➔ Direct matching with angel networks, grants, and strategic partners.
  - *Collaborative Network* ➔ Peer mastermind groups, verified business directory, and mentorship.

#### 8. Call to Action Section (`CtaSection.jsx`)
- **Banner Style:** High-contrast gradient card with ambient glow and decorative floating grid.
- **Heading:**
  ```text
  Ready to Scale Your Business?
  ```
- **Description:**
  ```text
  Join a platform designed to help businesses manage smarter, make better decisions, and unlock new opportunities for sustainable growth.
  ```
- **Buttons:**
  - **Primary Button:** `Get Started` *(Opens app onboarding `/app`)*
  - **Secondary Button:** `Contact Us` *(Opens Contact/Inquiry modal)*

#### 9. Footer (`Footer.jsx`)
- **Company Branding & Mission:**
  - Logo: `ScaleUP`
  - Tagline Options for Brand Identity:
    - *Manage Smarter. Grow Faster.*
    - *Where Businesses Grow Together.*
    - *Turning Business Data Into Business Growth.*
    - *Build. Manage. Scale.*
    - *Powering the Next Generation of Businesses.* (Default Hero / Brand Tagline)
    - *The Business Growth Platform for Modern Entrepreneurs.*
- **Navigation Columns:**
  - **Product:** `Features`, `Pricing`, `Roadmap`, `Security`
  - **Resources:** `Documentation`, `Help Center`, `Blog`, `Community`
  - **Company:** `About`, `Careers`, `Contact`, `Privacy Policy`, `Terms of Service`
- **Bottom Bar:**
  - Copyright: `© 2026 ScaleUP Platform Inc. All rights reserved.`
  - Social Links: Twitter / X, LinkedIn, GitHub, Discord.

---

### Design System & Token Standards

| Token | Value / Class | Purpose |
|---|---|---|
| **Background Base** | `#0B0F17` (Deep Obsidian) | Core page background |
| **Card Surface** | `bg-white/[0.03]` / `bg-slate-900/60` | Glassmorphism card body |
| **Card Border** | `border-white/[0.08]` / `hover:border-emerald-500/30` | Subtle hairline borders with hover glow |
| **Accent Primary** | `#10B981` (Emerald-500) to `#059669` (Emerald-600) | Growth, success, CTAs |
| **Accent Secondary** | `#2563EB` (Blue-600) to `#06B6D4` (Cyan-500) | Technology, trust, analytics |
| **Text Heading** | `#FFFFFF` (White) | Highest contrast headers |
| **Text Body** | `#94A3B8` (Slate-400) to `#CBD5E1` (Slate-300) | Readable body copy |
| **Typography** | `'Instrument Sans'`, sans-serif | Modern geometric typography |

---

## 6. Business Rules, SEO & Edge Cases

### SEO & Performance
- **Meta Title:** `ScaleUP — Scale Your Business Beyond Limits | All-in-One Business Growth Platform`
- **Meta Description:** `ScaleUP is a modern business growth platform helping entrepreneurs manage operations, monitor performance, plan strategically, and unlock investment opportunities.`
- **Semantic Structure:** Single `<h1>` in Hero, structured `<h2>` for each major section, descriptive `aria-label`s on buttons and icon triggers.
- **Performance:** Hardware-accelerated CSS animations (`transform`, `opacity`), lightweight SVG icons (Lucide React), image and component lazy-loading.

### Edge Cases & Form Handling

| # | Edge Case | Mitigation / Handling |
|---|---|---|
| 1 | **Spam / Bot Submissions on Contact Form** | Rate limit `throttle:5,1` on API route; add hidden honeypot field (`website_hp`); validate valid email syntax. |
| 2 | **Mobile Viewport Navigation** | Collapsible full-screen or slide-down glassmorphism mobile drawer with touch-friendly tap targets (`min-h-[48px]`). |
| 3 | **Network Failure during Inquiry Submission** | Display friendly alert with retry button; preserve user input in state so no form data is lost. |
| 4 | **Slow Connection Font/Asset Flash** | Preload font weights `[400, 500, 600, 700]` in HTML `<head>`; provide inline CSS fallback fonts. |

---

## 7. Build Order

1. **Gate 1 — Static Frontend Design & Mockups (`webkit.frontend-implement`)**
   - Create UI components under `resources/js/components/landing/`:
     - `Navbar.jsx`
     - `HeroSection.jsx` & `DashboardPreview.jsx`
     - `TrustedPlatformSection.jsx`
     - `FeaturesSection.jsx`
     - `WhyScaleUpSection.jsx`
     - `BusinessJourneySection.jsx`
     - `FutureVisionSection.jsx`
     - `CtaSection.jsx`
     - `Footer.jsx`
     - `ContactModal.jsx`
   - Wire all sections into `resources/js/components/landing/LandingPage.jsx`.
   - Update `resources/js/components/App.jsx` to render `LandingPage`.
   - Validate responsive design across desktop (1440px), tablet (768px), and mobile (375px).

2. **Gate 2 — Dynamic Backend Wiring & Lead Capture (`webkit.backend-implement`)**
   - Create migration `database/migrations/xxxx_xx_xx_create_inquiries_table.php`.
   - Create Model `app/Models/Inquiry.php`.
   - Create Handler `app/Handlers/Inquiry/StoreInquiryHandler.php` and FormRequest `app/Http/Requests/StoreInquiryRequest.php`.
   - Create Controller `app/Http/Controllers/Public/LandingController.php` with `storeInquiry` action.
   - Register public routes in `routes/web.php` and `routes/api.php`.
   - Wire `ContactModal.jsx` to send `POST /api/public/inquiries` and handle loading, success, and error feedback.

---

## 8. Out of Scope (Future Specs)

- **User Authentication & Onboarding Wizard:** `.agents/specs/scaleup/auth/onboarding.md` (multi-step company setup wizard).
- **Interactive Pricing Matrix & Billing:** `.agents/specs/scaleup/billing/pricing_and_plans.md` (tier comparison, feature toggles, Stripe checkout).
- **Interactive Sandbox / Product Demo:** `.agents/specs/scaleup/public/interactive_demo.md` (in-browser sandbox without account creation).
- **Client Portal & Live Dashboard:** `.agents/specs/scaleup/portal/dashboard.md` (authenticated user dashboard for business operations).
