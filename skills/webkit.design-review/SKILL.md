---
name: webkit-design-review
description: >
  Reviews the VISUAL layer — Vue/React components, `resources/css/theme.css`, Tailwind classes, accent
  tokens — and answers two separate questions: does this fit the design system this project already has,
  and how would a strong designer evolve it today. The two never mix: Fit Review findings are graded
  CRITICAL/HIGH/MEDIUM/LOW against [`ui-design.md`](../../rules/ui-design.md) and the real tokens; Modern
  Enhancement Ideas are optional and clearly marked. Never edits code; writes `design-review.md` into the
  ticket folder, or `.agents/reports/` when the change has no ticket.
  Triggered by `/webkit.design-review`, `/webkit.design-review <target_path>`, `/webkit.design-review T#####`,
  or any request to review, audit, critique, modernize, or refresh a UI.
---

# Webkit Design Review

Two jobs, **always reported as two separate sections**:

1. **Fit Review** — does this match the design system this project *already has*: the tokens in `resources/css/theme.css`, the rules in [`ui-design.md`](../../rules/ui-design.md), the components already registered?
2. **Modern Enhancement Ideas** — setting aside what the codebase does today, how would a strong designer evolve this?

> [!IMPORTANT]
> **Never blend them.** A screen can pass the Fit Review perfectly and still deserve modernization; a screen can be visually current and still violate every token rule. Blending the two produces a report where a genuine contrast failure and a "consider a fluid type scale" idea carry the same weight — so the developer fixes neither.

> [!IMPORTANT]
> **This skill MUST NOT modify application code or `theme.css`.** Its only output is `design-review.md`. Fixing is `/webkit.fix`'s job. A reviewer who restyles as they go cannot report honestly on what they changed.

---

## How This Differs From `/webkit.code-review`

`/webkit.code-review` already loads [`ui-design.md`](../../rules/ui-design.md) when a diff touches components. Two skills silently covering the same ground is the duplication [`duplicate-prevention.md`](../../rules/duplicate-prevention.md) forbids, so the boundary is explicit:

| | `/webkit.code-review` | `/webkit.design-review` (this skill) |
| :--- | :--- | :--- |
| Question | Is this code correct and compliant? | Does this look right, and could it look better? |
| Scope | The whole diff — backend included | The visual layer only: `.vue` / `.tsx`, `theme.css`, class strings |
| Design depth | A spot-check: "this hardcodes a hex" | The system: tokens, contrast ratios, dark-mode parity, component reuse, rhythm |
| Forward-looking | Never | Yes — a whole second section |
| Needs a diff? | Yes | No — it can review a screen that has not changed |

**When both run on the same change, code-review defers the visual findings to this report** and cites it rather than re-listing them. Run this one when the ask is about how it *looks*; run code-review when the ask is whether it *works*.

---

## Phase 0 — Resolve the Project (BLOCKING)

Run the **[Which Project Am I In?](../../rules/project-profile.md)** gate and **state the answer before reading a single style file.**

| Tell | Project | Design source of truth |
| :--- | :--- | :--- |
| `vue`, `pinia` in `package.json` | **SubHRMS** | `resources/css/theme.css` + [`ui-design.md`](../../rules/ui-design.md) portal accents |
| `react`, `react-dom` | **ScaleUP** | its own Tailwind theme + Radix primitives — [`project-profile.md`](../../rules/project-profile.md) ScaleUP Profile |

The two share a rule file but not a design system. Reviewing ScaleUP's React against SubHRMS's six portal accents — which ScaleUP does not have, because it has **no portals at all** — produces a report made entirely of false findings.

---

## Phase 1 — Establish the Scope

Review a bounded surface. "The UI" is not a scope.

```bash
git rev-parse --abbrev-ref HEAD                  # ticket + base for the diff
git diff --stat -- '*.vue' '*.tsx' '*.css'       # unstaged visual changes
git diff --cached --stat -- '*.vue' '*.tsx' '*.css'
git diff master...HEAD --stat -- '*.vue' '*.tsx' '*.css'   # SubHRMS base is master
```

Pick in this order:

1. **A ticket argument** (`/webkit.design-review F0135`) — resolve it to its branch and review the visual files in **that branch's diff**, per [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch). Read-only, so **fetch and analyze without checking out** (§8.3); when several branches match the ticket, stop and ask.
2. An explicit `<target_path>` — a page, a module folder, or a single component
3. The visual files in the uncommitted diff
4. The visual files in the current branch vs its base

**State the scope and the file count before reviewing.** If the scope is empty, say so and stop — do not expand to a repo-wide style audit nobody asked for.

> [!WARNING]
> Past ~15 component files, review the highest-traffic subset (pages before sub-components, shared before feature-local) and **say what you did not review**. [`context-loading.md`](../../rules/context-loading.md) caps you at ~2 full files at a time — a report claiming to have read 40 components read none of them properly.

---

## Phase 2 — Load the Design System (do not reverse-engineer it first)

The system here is **written down**. Read it before inferring anything from the code, in this order:

### 1. The rule — [`.agents/rules/ui-design.md`](../../rules/ui-design.md)

Portal accent colors, card/border conventions, dark-mode requirement, responsive grid shape, micro-transitions, table drag-to-scroll, statutory-ID column formatting. **This is design law, not a suggestion.**

### 2. The tokens — `resources/css/theme.css` (SubHRMS)

> [!CAUTION]
> **SubHRMS is Tailwind v4 — CSS-first. There is no `tailwind.config.js` and there never was.** Tokens live in an `@theme { }` block inside `resources/css/theme.css`; dark mode is a class variant (`@custom-variant dark`), not a media query. Searching for a config file, finding none, and concluding "no formal token file — system inferred from repeated values" is the single most likely way to get this whole review wrong.

```bash
sed -n '1,100p' resources/css/theme.css          # @theme block: slate scale + module accents
grep -n '^\s*\.\|@layer\|@custom-variant' resources/css/theme.css   # component + utility classes
```

Extract and **quote actual line numbers** for: the slate surface scale, the six `--color-module-*` accent families (base / `-dark` / `-bg` / `-bg-dark`, plus `-strong` where one exists), and the ready-made classes — `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input-field`, `.nav-link-active-<portal>`, `.badge-<portal>`, `.text-module-<portal>`.

### 3. The components already registered

A hand-rolled spinner, badge, or empty state is a **duplication finding**, not a styling choice. These are global in `resources/views/web/main.js` and need **no import**: `CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`. `Modal` and the `TableSkeleton` variants exist but must be imported.

### 4. Only then, infer

If something genuinely has no written token — a spacing rhythm, an icon size — establish it with a targeted grep across sibling files in the same portal, not by reading ten files whole:

```bash
grep -rhoE 'class="[^"]*"' <module-path> | grep -oE '\b(p|px|py|gap|rounded|shadow)-[a-z0-9.\[\]#]+' | sort | uniq -c | sort -rn | head -20
```

Repetition *is* the de-facto system. Say plainly in the report that it was inferred, and from how many files.

### Precedence when sources disagree (they do)

| Rank | Source | Beats |
| :---: | :--- | :--- |
| 1 | [`ui-design.md`](../../rules/ui-design.md) | everything below |
| 2 | `@theme` tokens in `theme.css` | classes and components |
| 3 | `@layer components` classes in `theme.css` | component files |
| 4 | Repeated values across sibling components | nothing — weakest evidence |
| — | **Code comments describing the system** | **nothing. Verify every one against the value beside it.** |

A conflict between ranks 1 and 2 is **not a finding against the file under review** — the file is caught between two sources of truth. Report it once under **Design-System Drift**, name both locations, and recommend which one changes. Never silently pick a side and then grade components against it.

> [!NOTE]
> **Known live drift — check it still exists, then report it there, not as a component finding.**
> - **Admin accent:** [`ui-design.md`](../../rules/ui-design.md) mandates Enterprise Indigo (`indigo-600` / `slate-900`) and says *"Do NOT use violet or purple for Admin"*. `theme.css:65` defines `--color-module-admin: #8B5CF6` — violet-500 — and labels it "Purple". Rank 1 wins, so the **token** is what needs changing; an admin screen using `.badge-admin` is following the tokens it was given.
> - **Stale header comment:** `theme.css:9-11` describes "HR (Green) | Payroll (Amber) | Admin (Purple) | Manager (Teal)" while the values below it are emerald, cyan, violet and red. Per rank 5, the comment is worth nothing — but a stale comment in the token file is itself a `LOW` finding, because the next agent will believe it.
> - **HR shade:** the rule says `emerald-600` (`#059669`); `theme.css:53` is `#10B981` (emerald-500).

---

## Phase 3 — Fit Review Dimensions

In order. The first three are where real visual bugs live.

### 1. Tokens and accents

- A raw hex or a Tailwind named color where a `--color-module-*` token or a `.badge-*` / `.text-module-*` / `.nav-link-active-*` class exists
- **The wrong portal's accent** — a Payroll screen in Timekeeping blue. Resolve the portal from the file path (`module/<portal>/<feature>/`), not from the component's name.
- A near-miss shade: `#CB7A3A` against the token's `#CB793A`, `emerald-500` where the scale says `emerald-600`. Near-misses are worse than obvious mismatches because nobody spots them in review.
- A new one-off value that duplicates an existing token under a different name

### 2. Contrast and accessibility — a hard rule here, not an aspiration

The Employee accent has a **documented, measured failure** recorded in `theme.css:47-50`: `#CB793A` is ~3.3:1 on white and ~2.9:1 on its own badge tint — both fail WCAG AA. The `-strong` shade `#9C5A22` exists precisely for this.

- Text, icons, or white-on-fill using `#CB793A` / `--color-module-employee` directly → **HIGH**, fix is `--color-module-employee-strong` (`#9C5A22`), or the `.badge-employee` / `.text-module-employee` / `.nav-link-active-employee` classes, which already resolve to it
- Plain `#CB793A` on borders, decorative fills, and icons on white/slate cards is **correct** — do not flag it
- Any other accent used as text on its own `-bg` tint: compute the ratio, do not assume
- Focus-visible states, interactive target size, `aria-*` on icon-only controls
- Dark-mode contrast checked **separately** — the `-dark` variants exist because the light ones fail on `slate-800`

### 3. Dark-mode parity

[`ui-design.md`](../../rules/ui-design.md) Rule 4: every color-bearing class needs its `dark:` counterpart. Dark mode here is **class-based** (`@custom-variant dark (&:where(.dark, .dark *))`) — a `prefers-color-scheme` media query will simply never fire.

```bash
grep -oE '\b(bg|text|border|ring|divide|from|to|via)-[a-z0-9\[\]#/.-]+' <file> | sort -u
```

Every light token in that list needs a `dark:` partner. A missing one is **HIGH** — the element vanishes or glares in dark mode, and nobody notices until a user reports it.

### 4. Component and pattern reuse

- A hand-rolled card instead of `.card`; a hand-rolled button instead of `.btn-primary` / `.btn-secondary` / `.btn-ghost`; a bespoke input instead of `.input-field`
- A local spinner, skeleton, empty state, or status badge when `Spinner`, `TableSkeleton`, `EmptyState`, `StatusBadge` are globally registered
- **UI-framework mixing** — PrimeVue, MUI, Bootstrap, `bootstrap-vue-next` and Emotion are all installed in SubHRMS. That is real, pre-existing drift. Flag *new* mixing in the reviewed scope; list untouched pre-existing mixing under **Pre-existing** only.
- Inline `style="..."` blocks where a utility or existing class does the job

### 5. Layout, rhythm and responsiveness

- Grids that do not follow the `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` shape the rule sets
- Spacing off the scale (`p-[13px]` where `p-3` / `p-4` is the rhythm)
- Fixed widths or `min-w-` values that break below `md`
- Wide tables missing the mandated drag-to-scroll (`cursor-grab active:cursor-grabbing select-none` + `@mousedown="startDrag"`) on their `overflow-x-auto` container
- Statutory ID columns (SSS, PhilHealth, Pag-IBIG) not formatted `font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5` with a `shrink-0` icon

### 6. Motion and state

- Interactive cards and buttons missing the house micro-transition (`transition duration-200 hover:scale-[1.01]`)
- Loading, empty, and error states: present at all, and styled like their siblings
- Transition durations that disagree with neighbouring components

### 7. What is already right

Name the places the file reuses the system well, with line numbers. A report that is only negative gets read as a style opinion and dismissed.

---

## Phase 4 — Filter Before Reporting

Every Fit Review finding survives all four:

1. **Is it real?** Open `theme.css` and confirm the token you are recommending exists, at the name and value you are about to write. Recommending `--color-module-employee-strong` in ScaleUP, or inventing `--space-3` because most design systems have one, is exactly the fabrication [`anti-hallucination.md`](../../rules/anti-hallucination.md) exists to stop.
2. **Is it in scope?** Pre-existing styling the diff sits beside is not this change's fault → **Pre-existing**, never mixed into findings.
3. **Is it visible?** Name what a user actually sees — "the badge label disappears on `slate-800` in dark mode". If you cannot describe the visible symptom, it is a preference.
4. **Is it more than taste?** No rule, no token, no visible defect → drop it. Preferences belong in §Modern Enhancement Ideas, where they are honestly labelled optional.

> [!CAUTION]
> **Do not report:** a color choice you would have made differently; "this feels dated" with no rule behind it; spacing that is on the scale but not the value you would pick; or the pre-existing framework mixing, portal accent set, or legacy JS modules the project deliberately lives with — check the [`project-profile.md`](../../rules/project-profile.md) drift table first.

---

## Phase 5 — Severity

The repo-wide scale, so this report is directly comparable to `verify.md` and `code-review.md`. Grade by **what the user sees**, never by fix difficulty.

| Severity | Applies to |
| :--- | :--- |
| `CRITICAL` | Content unreadable or invisible in a supported mode; an interactive control that cannot be seen or reached |
| `HIGH` | WCAG AA text-contrast failure; missing dark-mode variant on a color-bearing element; the wrong portal's accent; a mandated pattern (drag-to-scroll, statutory-ID format) absent |
| `MEDIUM` | Hardcoded value where a token exists; a duplicated component; an off-scale spacing value; a broken responsive breakpoint |
| `LOW` | Naming, class ordering, a missing micro-transition, a stale comment in a token file |

**Escalate one level** when the defect only appears in a mode the developer is not looking at — dark mode, `md` and below, or a portal they do not use. Those ship.

Every finding carries a **concrete fix**: the exact replacement, in the syntax this file uses. `class="bg-[#CB793A] text-white"` → `class="badge-employee"` is actionable; "use the design token" is not.

---

## Phase 6 — Modern Enhancement Ideas

This section deliberately steps outside "does it match what we have" and asks how a strong designer would evolve it.

**Ground it before writing it.** Trends move; memory lags. Run a web search, **state the queries and the date in the report**, and if search is unavailable say so plainly so the reader can discount the section. Do not paste a trend listicle — reason from what the design is trying to communicate (a payroll table's job is legibility under density, not delight) and propose evolutions that serve *that*.

Cover only what is relevant to the scope reviewed:

- **Color** — perceptual color spaces (OKLCH) for accent ramps that stay even across shades; a systematic contrast strategy instead of per-token patches like `-strong`; dark-mode tokens derived rather than hand-picked
- **Typography** — fluid type with `clamp()`, variable fonts, sharper hierarchy in dense tables
- **Spacing & layout** — container queries for components that appear at several widths; fluid spacing
- **Depth** — current elevation treatment, used only where it earns its place. An HRMS table does not need glassmorphism.
- **Motion** — micro-interactions with a shared easing token, and `prefers-reduced-motion` support
- **Component-level** — current conventions for the specific component reviewed

### Hard constraints on every suggestion

> [!IMPORTANT]
> A suggestion that cannot be adopted without breaking the project is not a suggestion, it is noise. Each one must:
> - Be expressible in **Tailwind v4 `@theme` / `@layer` CSS**, or in existing utility classes. No new styling library, no CSS-in-JS, no `tailwind.config.js` — the project has none and adding one changes the build.
> - Be **additive**. Propose a *new* token beside the old one; never rename `--color-module-*` — the `.badge-*`, `.text-module-*` and `.nav-link-active-*` classes and every arbitrary-value usage in components depend on those exact names.
> - **Not contradict a rank-1 rule.** Suggesting violet for Admin, or dropping `dark:` variants for a media query, is a rule violation wearing a trend's clothes.
> - Carry a **concrete code sketch** in this project's syntax — an `@theme` addition or a class string, not prose.
> - State its **migration cost**: how many files, and whether it can land incrementally.

Mark the whole section as optional. Nothing in it belongs in the Fix Plan.

---

## Phase 7 — Report

```markdown
# Design Review: <scope>

> **Ticket:** `T#####` (<project>) — this file is `.agents/specs/<project>/T#####/design-review.md`. (Or: *no ticket — <why>*.)
> **Project:** SubHRMS | ScaleUP — resolved via <evidence>
> **Portal:** <employee | hr | payroll | admin | manager | timekeeping | n/a>
> **Scope:** <path / diff> — <n> files
> **Design sources read:** `.agents/rules/ui-design.md`, `resources/css/theme.css:<lines>`, <…>
> **Run:** v<N> — <YYYY-MM-DD> — <what changed since the previous run, or "initial">
> **Verdict:** CONSISTENT | MINOR DRIFT | REQUEST CHANGES

---

## 1. Fit Summary

<Two or three sentences: does this belong in this product, and what is the single worst visual problem.>

| Severity | Count | Fix before |
| :--- | :---: | :--- |
| CRITICAL | n | anything ships |
| HIGH | n | merge |
| MEDIUM | n | end of milestone |
| LOW | n | — |

## 2. Fit Findings

### D<n> — <one-line title> · `HIGH` · `contrast`

- **Location:** [`Component.vue:42`](path#L42)
- **Problem:** <what is wrong>
- **What the user sees:** <the visible symptom, in which mode / at which breakpoint>
- **Authority:** <ui-design.md §rule | theme.css:NN | WCAG AA | inferred from N siblings>
- **Fix:** `<exact before>` → `<exact after>`
- **Effort:** `trivial` | `small` | `large`

## 3. What's Already Working

<Reuse done right, with line numbers. Keep it short and specific.>

## 4. Design-System Drift

<Conflicts BETWEEN sources of truth — not the reviewed file's fault. Which source should change, and why.
Omit if none.>

## 5. Fix Plan

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | D2 | HIGH | <what to change> | `path/to/File.vue` | trivial |

**Fix together:** <findings in one file that should be one edit.>

---

## 6. Modern Enhancement Ideas  *(optional — not part of the Fix Plan)*

> **Grounded on:** <YYYY-MM-DD> via <search queries>. *(Or: no web search available — treat as lower-confidence.)*
> **Design concept read as:** <what this UI is trying to communicate; every suggestion below serves it.>

### E<n> — <title>

- **Why:** <how it improves the design, tied to the concept>
- **Sketch:**
  ```css
  @theme { --color-module-employee-600: oklch(...); }
  ```
- **Migration cost:** <n files / additive / incremental>

---

## 7. Review Limits

<What was NOT reviewed and why — files skipped, states only visible at runtime, no browser, contrast
computed rather than measured. An unstated gap reads as coverage.>

<!-- Run history -->
- v1 — <YYYY-MM-DD> — initial review, n findings (n HIGH)
```

### Verdict rule

| Verdict | When |
| :--- | :--- |
| `REQUEST CHANGES` | Any `CRITICAL` or `HIGH` |
| `MINOR DRIFT` | Only `MEDIUM` / `LOW` |
| `CONSISTENT` | No Fit findings — **Modern Enhancement Ideas do not change this** |

### Persist the report (MANDATORY)

1. Resolve the ticket exactly as [`ticket-numbering.md`](../../rules/ticket-numbering.md) §4 describes — the branch usually says it (`git rev-parse --abbrev-ref HEAD` → `T00004`), or the prompt names it, or grep the project's specs for the module.
2. Write to **`.agents/specs/<project>/<ticket>/design-review.md`** — that exact filename.
3. **No ticket** → `.agents/reports/<scope>-design-review-<YYYYMMDD>.md`. Do **not** allocate a ticket; this skill does not start work ([`ticket-numbering.md`](../../rules/ticket-numbering.md) §2).
4. Re-running **overwrites in place** — bump `> **Run:**`, date it, one line on what changed, and append the superseded line to the run-history block at the bottom.
5. Every `file:line` must be real and current. One stale line number makes the whole report untrustworthy.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| :--- | :--- |
| Looking for `tailwind.config.js` | It does not exist — Tailwind v4 is CSS-first; the tokens are `@theme` in `theme.css` |
| Inferring the system while ignoring `ui-design.md` | Reverse-engineering from code promotes existing violations into "the system" |
| Blending fit findings with modernization ideas | The contrast failure and the "try OKLCH" idea get equal weight, so neither is fixed |
| Grading a component for a conflict between two sources of truth | The file is caught in the middle — that is **Drift**, §4 |
| Believing a comment in `theme.css` | `theme.css:9-11` describes accents the file itself does not define |
| Recommending a token you did not open the file to confirm | A fix pointing at a token that does not exist wastes the whole report's credibility |
| Reviewing SubHRMS accents in ScaleUP | ScaleUP has no portals; every finding would be invented |
| Flagging pre-existing framework mixing as this change's fault | Real, known drift — belongs in §Pre-existing, once |
| "Make it feel more modern" | Not actionable, not falsifiable, not a finding |
| Restyling while reviewing | The report stops matching any commit |
| Claiming coverage you did not achieve | State it in §7 — silence reads as coverage |

---

## Follow-up Commands

- Apply the Fix Plan: `/webkit.fix <target_path> using .agents/specs/<project>/<ticket>/design-review.md` — on the ticket's existing branch
- Check the code, not the look: `/webkit.code-review` — writes `code-review.md` into the same ticket folder
- Check it matches the spec: `/webkit.verify <ticket>`
