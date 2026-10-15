---
name: webkit-design-review
description: |
  Senior-designer review of the visual layer (components, theme tokens, Tailwind class strings) reported as two separate sections: Fit Review against `ui-design.md` and the real tokens, and optional Modern Enhancement Ideas. Writes `design-review.md`; never edits code or theme files.
  Trigger: "/webkit-design-review", "design review", "UI review", "does this look right", "theme tokens", "dark mode", "contrast", "Tailwind"
  Use when: a screen, component or styling change needs checking against the design system, changed or not.
---

# Webkit Design Review

Acts as a senior designer reviewing the visual layer of a change. Two jobs, **always reported as two separate sections**:

1. **Fit Review** — does this match the design system the project *already has*: the rules in [ui-design.md](../../rules/ui-design.md), the theme tokens, the components already available?
2. **Modern Enhancement Ideas** — setting aside what the codebase does today, how would a strong designer evolve this?

This is **not** a code review (`/webkit-code-review`), **not** a spec check (`/webkit-verify`), and **not** a place to add requirements.

> [!IMPORTANT]
> **Never blend the two sections.** A screen can pass the Fit Review and still deserve modernization; a screen can look current and still break every token rule. Blended, a real contrast failure and a "consider a fluid type scale" idea carry the same weight, and neither gets fixed.
>
> **This skill MUST NOT modify application code, theme files, or any specification.** Its only output is `design-review.md`, plus its own rows in the ticket's `task.md`. Fixing is `/webkit-fix`'s job; a reviewer who restyles as they go cannot report honestly on what changed.

---

## Authority Boundary

This skill owns **only** reviewing the visual layer, and reporting ([authority-boundary.md](../../rules/authority-boundary.md)). It does not perform another skill's responsibility. Tasks that belong to another workflow stage:

- fixing what it finds → `/webkit-fix`
- reviewing code correctness → `/webkit-code-review`
- checking spec conformance → `/webkit-verify`

If a task belongs to another stage: **stop, report it, and do not continue** that task. Report it as `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.` Do not compensate for another skill, and do not generate work outside this authority.

---

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-design-review T#####` | Review the visual files in that ticket's branch diff. |
| `/webkit-design-review <branch-name>` | Review the visual files in that branch's diff. |
| `/webkit-design-review <target_path>` | Review that page, module, or component, changed or not. |
| `/webkit-design-review` | Review the visual files in the uncommitted work, otherwise the current branch against its base. |

---

## How This Differs From `/webkit-code-review`

| | `/webkit-code-review` | `/webkit-design-review` (this skill) |
| --- | --- | --- |
| Question | Is the changed code correct and well built? | Does this look right, and could it look better? |
| Scope | The whole diff, backend included | The visual layer only: components, theme files, class strings |
| Design depth | Clear `ui-design.md` violations only | The system: tokens, contrast ratios, dark-mode parity, reuse, rhythm |
| Forward-looking | Never | Yes, a separate optional section |
| Needs a diff? | Yes | No: it can review a screen that has not changed |

When both run on the same change, code-review cites this report for visual findings instead of re-listing them.

---

## Workflow Integration

```text
   webkit-implement / webkit-fix / webkit-refactor
                    │
       ┌────────────┼────────────────┐
       ▼            ▼                ▼
 webkit-verify  webkit-code-review  webkit-design-review    ← you are here
                                     │
                                     ▼
      design-review.md  (.agents/specs/<project>/T#####/design-review.md)
                                     │
                                     ▼
                  /webkit-fix <ticket> --design-review
```

---

## Core Rules

- **Fit against what is written down.** The design system is documented; read it before inferring anything from the code.
- **Visible or it is not a finding.** Every finding names what a user actually sees, and in which mode, breakpoint, or portal.
- **No scope expansion.** Review the visual layer of the stated scope. Ideas beyond the current system go to Modern Enhancement Ideas, clearly optional; they are never fixes.
- **No edits.** No code, no theme files, no specs. If a visual problem comes from the spec itself, report **"Specification clarification required"** under INFO.
- **Evidence.** Every token or class you recommend is confirmed to exist, at that name and value, before you write it.

## Review Mindset

Ask:

- Does this belong in this product, next to its sibling screens?
- Can every user read it, in light and dark mode, at every breakpoint?
- Is it reusing the system, or quietly rebuilding part of it?
- Which source of truth does this follow, and do the sources agree?
- What is this screen trying to communicate, and does the design serve that?

---

## Phase 0 — Resolve the Project (BLOCKING)

Run [Which Project Am I In?](../../rules/project-profile.md) and **state the answer before reading a single style file**.

| Tell | Design source of truth |
| --- | --- |
| `vue`, `pinia` in `package.json` (Vue project) | `resources/css/theme.css` + [ui-design.md](../../rules/ui-design.md) portal accents |
| `react`, `react-dom` (React project) | Its own Tailwind theme + Radix primitives, per your project's section of [project-profile.md](../../rules/project-profile.md) |

The projects share a rule file but not a design system. Reviewing a project without portals against portal accents produces a report made entirely of false findings.

---

## Phase 1 — Establish the Scope

Review a bounded surface; "the UI" is not a scope.

```bash
git rev-parse --abbrev-ref HEAD                          # ticket + base for the diff
git diff --stat -- '*.vue' '*.tsx' '*.css'               # unstaged visual changes
git diff --cached --stat -- '*.vue' '*.tsx' '*.css'

base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)
git diff "$base"...HEAD --stat -- '*.vue' '*.tsx' '*.css'
```

Scope, in this order:

1. **Ticket or branch argument** → the visual files in that branch's diff. Fetch and analyze **without checking out** ([ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch), §8.3); when several branches match, stop and ask.
2. An explicit `<target_path>`: a page, a module folder, or a single component.
3. The visual files in the uncommitted work.
4. The visual files in the current branch against its base.

**State the scope and the file count before reviewing.** If the scope is empty, say so and stop; never expand to a repo-wide style audit.

> [!WARNING]
> Past ~15 component files, review the highest-traffic subset first (pages before sub-components, shared before feature-local) and record the rest as INFO "Not reviewed:". [context-loading.md](../../rules/context-loading.md) caps you at ~2 full files at a time.

---

## Phase 2 — Load the Design System (do not reverse-engineer it first)

Read in this order:

### 1. The rule — [ui-design.md](../../rules/ui-design.md)

Portal accent colors, card and border conventions, dark-mode requirement, responsive grid shape, micro-transitions, table drag-to-scroll, statutory-ID column formatting. **This is design law, not a suggestion.**

### 2. The tokens

**Vue project: `resources/css/theme.css`.** A React project's tokens are documented in its profile section.

> [!CAUTION]
> **The Vue project's theme is Tailwind v4, CSS-first. There is no `tailwind.config.js` and there never was.** Tokens live in an `@theme { }` block inside `resources/css/theme.css`; dark mode is a class variant (`@custom-variant dark`), not a media query. Finding no config file and concluding "no formal token file — system inferred from repeated values" is the most likely way to get this whole review wrong.

```bash
sed -n '1,100p' resources/css/theme.css                              # @theme block: slate scale + module accents
grep -n '^\s*\.\|@layer\|@custom-variant' resources/css/theme.css   # component + utility classes
```

Quote actual line numbers for: the slate surface scale, the `--color-module-*` accent families (base / `-dark` / `-bg` / `-bg-dark`, plus `-strong` where one exists), and the ready-made classes (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input-field`, `.nav-link-active-<portal>`, `.badge-<portal>`, `.text-module-<portal>`).

### 3. The components already available

A hand-rolled spinner, badge, or empty state is a **duplication finding**, not a styling choice. Read the design-system inventory in your project's profile section. In the Vue project these are global in `resources/views/web/main.js` and need **no import**: `CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`; `Modal` and the `TableSkeleton` variants must be imported.

### 4. Only then, infer

Where something genuinely has no written token (a spacing rhythm, an icon size), establish it with a targeted grep across sibling files, not by reading ten files whole:

```bash
grep -rhoE 'class="[^"]*"' <module-path> | grep -oE '\b(p|px|py|gap|rounded|shadow)-[a-z0-9.\[\]#]+' | sort | uniq -c | sort -rn | head -20
```

Repetition is the de-facto system. Say in the report that it was inferred, and from how many files.

### Precedence when sources disagree

| Rank | Source | Beats |
| --- | --- | --- |
| 1 | [ui-design.md](../../rules/ui-design.md) | everything below |
| 2 | `@theme` tokens | classes and components |
| 3 | `@layer components` classes | component files |
| 4 | Repeated values across sibling components | nothing; weakest evidence |
| — | **Code comments describing the system** | **nothing; verify every one against the value beside it** |

A conflict between ranks is **not a finding against the file under review**: report it once under **Design-System Drift**, name both locations, and say which one should change.

> [!NOTE]
> **Known drift in the Vue project — confirm it still exists, then report it under Design-System Drift, not as a component finding.**
>
> - **Admin accent:** [ui-design.md](../../rules/ui-design.md) mandates Enterprise Indigo (`indigo-600` / `slate-900`) and says *"Do NOT use violet or purple for Admin"*; `theme.css:65` defines `--color-module-admin: #8B5CF6` (violet-500). Rank 1 wins, so the **token** needs changing; an admin screen using `.badge-admin` is following the tokens it was given.
> - **Stale header comment:** `theme.css:9-11` describes "HR (Green) | Payroll (Amber) | Admin (Purple) | Manager (Teal)" while the values below are emerald, cyan, violet, and red. A stale comment in the token file is itself a LOW finding, because the next agent will believe it.
> - **HR shade:** the rule says `emerald-600` (`#059669`); `theme.css:53` is `#10B981` (emerald-500).

---

## Phase 3 — Fit Review

In order; the first three are where real visual bugs live.

### 1. Tokens and accents

- A raw hex or Tailwind named color where a `--color-module-*` token or a `.badge-*` / `.text-module-*` / `.nav-link-active-*` class exists.
- **The wrong portal's accent**: resolve the portal from the file path (`module/<portal>/<feature>/`), not from the component name.
- A near-miss shade (`#CB7A3A` against the token's `#CB793A`, `emerald-500` where the scale says `emerald-600`). Near-misses are worse than obvious mismatches because nobody spots them.
- A new one-off value that duplicates an existing token under another name.

### 2. Contrast and accessibility — a hard rule

The Employee accent has a **documented, measured failure** in `theme.css:47-50`: `#CB793A` is ~3.3:1 on white and ~2.9:1 on its own badge tint, both failing WCAG AA. The `-strong` shade `#9C5A22` exists for this.

- Text, icons, or white-on-fill using `#CB793A` / `--color-module-employee` directly → **HIGH**; the fix is `--color-module-employee-strong`, or the `.badge-employee` / `.text-module-employee` / `.nav-link-active-employee` classes, which already resolve to it.
- Plain `#CB793A` on borders, decorative fills, and icons on white or slate cards is **correct**; do not flag it.
- Any other accent used as text on its own `-bg` tint: compute the ratio; never assume.
- Focus-visible states, interactive target size, `aria-*` on icon-only controls.
- Dark-mode contrast is checked **separately**: the `-dark` variants exist because the light ones fail on `slate-800`.

### 3. Dark-mode parity

[ui-design.md](../../rules/ui-design.md) Rule 4: every color-bearing class needs its `dark:` counterpart. Dark mode is **class-based** (`@custom-variant dark (&:where(.dark, .dark *))`); a `prefers-color-scheme` media query never fires.

```bash
grep -oE '\b(bg|text|border|ring|divide|from|to|via)-[a-z0-9\[\]#/.-]+' <file> | sort -u
```

Every light token in that list needs a `dark:` partner. A missing one is **HIGH**: the element vanishes or glares in dark mode.

### 4. Component and pattern reuse

- A hand-rolled card, button, or input instead of `.card`, `.btn-primary` / `.btn-secondary` / `.btn-ghost`, `.input-field`.
- A local spinner, skeleton, empty state, or status badge when the design system provides one.
- **UI-framework mixing**: PrimeVue, MUI, Bootstrap, `bootstrap-vue-next`, and Emotion are all installed in the Vue project. Flag *new* mixing in the reviewed scope; list untouched pre-existing mixing as INFO "Pre-existing:".
- Inline `style="..."` where a utility or existing class does the job.

### 5. Layout, rhythm, and responsiveness

- Grids that do not follow the `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` shape the rule sets.
- Spacing off the scale (`p-[13px]` where `p-3` / `p-4` is the rhythm).
- Fixed widths or `min-w-` values that break below `md`.
- In projects with portals: wide tables missing drag-to-scroll (`cursor-grab active:cursor-grabbing select-none` + `@mousedown="startDrag"` on the `overflow-x-auto` container), and statutory ID columns (SSS, PhilHealth, Pag-IBIG) not formatted `font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5` with a `shrink-0` icon.

### 6. Motion and state

- Interactive cards and buttons missing the house micro-transition (`transition duration-200 hover:scale-[1.01]`).
- Loading, empty, and error states: present, and styled like their siblings.
- Transition durations that disagree with neighbouring components.

### 7. What is already right

Name the places the change reuses the system well, with line numbers. A report that is only negative reads as opinion and gets dismissed.

### 8. See it rendered (when a browser tool is available)

With Playwright or any browser tool and a reachable app, confirm what the class strings only suggest: contrast, dark mode, and the layout at `md` and below. Log in as the default dev user documented in the project's root [AGENTS.md](../../../AGENTS.md#7-seeing-the-real-behavior-or-ui-playwright-or-any-browser-tool); if the project documents none, ask rather than guess a login. Log in once and reuse the session. A finding from a rendered page names the page, the mode, and the viewport. Save screenshots outside the repo (the scratchpad or temp directory): the report is the only file this skill writes, and the password never goes into it.

---

## Phase 4 — Classify and Filter

### Severity

The same scale as code-review, graded by **what the user sees**, never by fix difficulty.

| Severity | Applies to |
| --- | --- |
| **CRITICAL** | Content unreadable or invisible in a supported mode; an interactive control that cannot be seen or reached. |
| **HIGH** | WCAG AA text-contrast failure; missing dark-mode variant on a color-bearing element; the wrong portal's accent; a mandated pattern (drag-to-scroll, statutory-ID format) absent. |
| **MEDIUM** | Hardcoded value where a token exists; a duplicated component; an off-scale spacing value; a broken responsive breakpoint. |
| **LOW** | Naming, class ordering, a missing micro-transition, a stale comment in a token file. |
| **INFO** | Observation only: pre-existing styling next to the change, files not reviewed, specification clarification required. |

**Escalate one level** when the defect only appears in a mode the developer is not looking at: dark mode, `md` and below, or a portal they do not use.

### Filter before reporting

Every finding passes all four:

1. **Is it real?** Open the token file and confirm the token or class you recommend exists, at that name and value. Recommending a portal token in a project without portals, or inventing `--space-3` because most design systems have one, is exactly what [anti-hallucination.md](../../rules/anti-hallucination.md) forbids.
2. **Is it in this change?** Styling the change merely sits beside is INFO "Pre-existing:", never a finding.
3. **Is it visible?** Name what a user sees ("the badge label disappears on `slate-800` in dark mode"). No visible symptom → it is a preference.
4. **Is it more than taste?** No rule, no token, no visible defect → drop it, or move it to Modern Enhancement Ideas.

> [!CAUTION]
> **Do not report:** a color you would have chosen differently; "this feels dated" with no rule behind it; spacing that is on the scale but not the value you would pick; or the pre-existing framework mixing, accent set, or legacy modules the project deliberately lives with. Known token drift (the **Known drift** note in Phase 2) is reported once under **Design-System Drift**, never as a component finding.

Every CRITICAL and HIGH carries a **concrete fix** in the file's own syntax: `class="bg-[#CB793A] text-white"` → `class="badge-employee"`, not "use the design token".

---

## Phase 5 — Overall Design Fit and Recommendation

Derived from the Fit findings, not a judgement call. **Modern Enhancement Ideas never change it.**

| Overall Design Fit | When | Final Recommendation |
| --- | --- | --- |
| **CHANGES REQUIRED** | Any CRITICAL or HIGH | **FIX REQUIRED** (list every CRITICAL and HIGH by finding number) |
| **APPROVED WITH COMMENTS** | Only MEDIUM and / or LOW | **READY TO MERGE** |
| **APPROVED** | No findings (INFO only) | **READY TO MERGE** |

---

## Phase 6 — Modern Enhancement Ideas (optional)

This section steps outside "does it match what we have" and asks how a strong designer would evolve it.

**Ground it before writing it.** Trends move; memory lags. Run a web search and **state the queries and the date**; if search is unavailable, say so plainly so the reader can discount the section. Reason from what the design is trying to communicate (a payroll table's job is legibility under density, not delight), not from a trend list.

Cover only what is relevant to the scope:

- **Color**: perceptual color spaces (OKLCH) for even accent ramps; a systematic contrast strategy instead of per-token patches like `-strong`; derived dark-mode tokens.
- **Typography**: fluid type with `clamp()`, variable fonts, sharper hierarchy in dense tables.
- **Spacing and layout**: container queries for components shown at several widths; fluid spacing.
- **Depth**: current elevation treatment, only where it earns its place.
- **Motion**: micro-interactions with a shared easing token, and `prefers-reduced-motion` support.
- **Component level**: current conventions for the specific component reviewed.

> [!IMPORTANT]
> Every idea must:
>
> - be expressible in the project's existing styling system (Tailwind v4 `@theme` / `@layer` CSS, or existing utilities): no new styling library, no CSS-in-JS, no `tailwind.config.js`;
> - be **additive**: propose a new token beside the old one; never rename `--color-module-*`, which classes and arbitrary values depend on;
> - **not contradict a rank-1 rule** (violet for Admin, or replacing `dark:` variants with a media query, is a rule violation dressed as a trend);
> - carry a **concrete code sketch** in the project's syntax;
> - state its **migration cost**: how many files, and whether it can land incrementally.

Ideas are never fixes: `/webkit-fix` does not apply them, and they never request a spec change.

---

## Phase 7 — Write the Report

Fill the template [.agents/template/design-review-report.md](../../template/design-review-report.md). Follow its exact structure: no custom format, no added, removed, renamed, or reordered sections. Follow the fill rules in its header comment, then delete every guide comment except the `<!-- Run history -->` marker.

- Number findings in one sequence across CRITICAL, HIGH, MEDIUM, and LOW (`Finding #1`, `#2`, …); within a severity, list them in fix order, with findings in one file that should be one edit next to each other.
- Every `file:line` must be real and current.

### Persist the report (MANDATORY)

**Step 1 — Resolve the ticket** ([ticket-numbering.md](../../rules/ticket-numbering.md) §4): the branch usually names it (`T00004`), or the argument does, or grep the project's specs for the module:

```bash
grep -ril '<module|route|component>' ".agents/specs/$project" --include='*.md' 2>/dev/null
```

Read the hits per [ticket-numbering.md](../../rules/ticket-numbering.md) §4. A hit in a **legacy portal spec** has no ticket folder: write to `.agents/reports/<domain>-<feature>-design-review-<YYYYMMDD>.md` (§5).

No ticket → write to `.agents/reports/<scope>-design-review-<YYYYMMDD>.md` and set the Ticket row to "None — <reason>". Never allocate a ticket; this skill does not start work.

**Step 2 — Write the file** to `.agents/specs/<project>/<ticket>/design-review.md`: exactly that filename. Re-reviewing **overwrites the file in place**. Before overwriting, append the previous run's **Review Run** value with its date and verdict (e.g. `- v1 — 2026-10-08 — initial — CHANGES REQUIRED`) to the list under `<!-- Run history -->`. Then increment the Metadata **Review Run** row and set **Review Date** to today. A previous run row of the form `vN.k` is a [fix pass](../../rules/ticket-numbering.md#fix-pass) by `/webkit-fix`: append it to the history like any run, number this run `v(N+1)`, and re-check each `✅ FIXED` line rather than trusting it. Every finding is written with `- **Resolution:** Open` (the template's last field); `/webkit-fix` fills it.

**Step 3 — Update `task.md`** (ticket folder only) per [task.md upkeep](../../rules/ticket-numbering.md#taskmd-upkeep): the §1 Design review row (`vN — <verdict>`); replace this report's unticked §3 items with this run's CRITICAL / HIGH findings (ticked ones stay as history) and count the rest on the Optional line; **Next step** (`/webkit-fix <ticket> --design-review` when any CRITICAL / HIGH is open); one §5 line. A ticket with a spec but no `task.md`: create it from [the task-tracker template](../../template/task-tracker.md) first. This file and the report are the only files this skill writes.

---

## Rules After Review

The reviewer must not edit code or theme files, update specs, create spec versions, request new features, or restart planning. A visual problem that can only be resolved by changing a requirement is reported as **"Specification clarification required"**.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Looking for `tailwind.config.js` in the Vue project | It does not exist; Tailwind v4 is CSS-first and the tokens are `@theme` in `theme.css`. |
| Inferring the system while ignoring `ui-design.md` | Reverse-engineering from code promotes existing violations into "the system". |
| Blending fit findings with modernization ideas | The contrast failure and the "try OKLCH" idea get equal weight; neither is fixed. |
| Grading a component for a conflict between sources of truth | The file is caught in the middle; that is Design-System Drift. |
| Believing a comment in the token file | `theme.css:9-11` describes accents the file itself does not define. |
| Recommending a token you did not confirm exists | One fix pointing at a missing token costs the whole report its credibility. |
| Reviewing portal accents in a project without portals | Every finding would be invented. |
| Flagging pre-existing framework mixing as this change's fault | Known drift; it belongs under INFO "Pre-existing:", once. |
| "Make it feel more modern" | Not actionable, not falsifiable, not a finding. |
| Restyling while reviewing | The report stops matching any commit. |
| Claiming coverage you did not achieve | Record skipped files as INFO "Not reviewed:". |

---

## Follow-up Commands

Always include the saved report path:

- Fix the CRITICAL and HIGH findings, on the ticket's existing branch: `/webkit-fix <ticket> --design-review`. MEDIUM and LOW only if the user names them.
- Check the code, not the look: `/webkit-code-review <ticket>`
- Check it matches the spec: `/webkit-verify <ticket>`
- After fixes: **no re-run needed.** `/webkit-fix` closes the findings in this report as a fix pass and recomputes the verdict. Re-run only when its Fix Summary says a re-run is needed, or when a fresh review is wanted before merge.
