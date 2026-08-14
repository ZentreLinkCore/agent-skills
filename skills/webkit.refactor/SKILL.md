---
name: webkit-refactor
description: >
  Restructures existing code to improve maintainability, readability, performance, or DRY compliance without changing its external behavior. Follows project architecture and standards.
  Triggered when the user runs the command `/webkit.refactor <target_path> <prompt>` or `/webkit.refactor <prompt>`.
---

# Webkit Refactor

This skill coordinates the safe refactoring of existing source code within the workspace. Its primary goal is to improve code cleanliness, maintainability, performance, and compliance with project design patterns without altering external application behavior.

---

## Workflow Integration

When code duplication, architectural drift, or complex logic needs cleanup:

```
   Target Selection / Investigation Report
       (.agents/reports/*.md, optional)
                 │
                 ▼
          webkit.refactor
                 │
                 ▼
       Behavior-Preserving Edits
                 │
                 ▼
       Regression Verification
```

This skill is also the natural follow-up `webkit.investigate` suggests for "Architecture & Code Quality" findings — see that report's "Recommended Solution" and "High-Level Implementation Plan" sections when one exists.

---

## Target & Context Discovery

Before restructuring anything:
1. **Project Gate (BLOCKING)**: Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile and **state the resolved project before touching anything**. Then read only that project's sections. Refactoring toward the *other* project's conventions is not a cleanup — it is drift introduced under the banner of removing drift, and it is the hardest kind to spot in review because every line looks idiomatic.
2. **Locate and Load the Investigation Report (if any)**: If the prompt names or links a report, or `.agents/reports/` has one matching the target module, read it — its scope, dependency analysis, and risk assessment save re-deriving that context. Since this skill may run in a fresh session, do not assume prior conversation turns are available. A report is optional; proceed directly from the prompt/target path if none exists.
3. **Locate Target Files**: Parse the command argument path, or the report's "Affected Files" section if one was loaded, or search the workspace for the described duplication/drift.
4. **Verify Constraints**: Review the rules in `.agents/rules/` that the target actually touches — [Laravel Standards](../../rules/laravel-standards.md) for PHP, your project's frontend standards ([Vue.js Standards](../../rules/vue-standards.md) for SubHRMS; the **ScaleUP Profile** in [project-profile.md](../../rules/project-profile.md) for ScaleUP), and [Duplicate Prevention](../../rules/duplicate-prevention.md).
4. **Branch Gate (BLOCKING)**: Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **before editing any file**. If on `main`/`master`, **create and switch to a `refactor/` branch now** — do not merely confirm one is needed and proceed. Already on a correctly-named branch for this cleanup? Continue there. On a branch for different work, or detached HEAD? Stop and ask. State the branch before you edit.

---

## Principles of Safe Refactoring

### 1. Behavior Preservation
- **Contract Integrity**: Do not change public API endpoints, return payloads, database column structures, model event behavior, or visible UI features unless explicitly instructed.
- **Side-Effects Check**: Ensure that changes do not affect state reactivity (Vue refs/computed, or React state identity and hook dependency arrays) or database transactions (Laravel).

### 2. Incremental Steps
- Refactor in small, independent commits or diffs. Avoid large "rewrite all" changes that complicate regression tracking.
- Test continuously at each minor step.

### 3. Maintain Comments & Documentation
- Preserve developer annotations, copyright markers, and business reasoning comments.
- Update PHPDoc/JSDoc types and schemas to reflect signature adjustments.

---

## Common Refactoring Scenarios

### 1. Extracting Reusable Logic (DRY compliance)
- If similar validation, computation, or query patterns are repeated in multiple controllers or pages, extract them:
  - Backend: Extract to custom Traits, Query classes, or Helpers.
  - Frontend: Extract to the shared hooks/composables or utility location your project uses.

### 2. Moving Inline Controller Logic to Queries/Handlers
- In accordance with [.agents/rules/laravel-standards.md](../../rules/laravel-standards.md), migrate heavy inline controller logic into modular Query/Handler classes under **`app/Queries/<Domain>/`** and **`app/Handlers/<Domain>/`**.

> [!CAUTION]
> **`app/Domain/` is retired in both projects and does not exist on disk.** Do not move code into it, and do not conclude "there is no existing Query for this" because a search of `app/Domain/` came back empty — search `app/Queries/` and `app/Handlers/`. A few legacy files still carry a stale `App\Domain\...` namespace mid-migration; the target is `App\Queries` / `App\Handlers`, and correcting one you touch is a legitimate part of the refactor.

### 3. Component Extraction
- Extract oversized template/JSX blocks (nested modals, forms) into standalone reusable components inside the module's `components/` subfolder, following your project's component conventions ([vue-standards.md](../../rules/vue-standards.md) for SubHRMS; the **ScaleUP Profile** for React).

### 4. Consolidating Duplicates Into the Design System
- Duplication that was *created* — a locally hand-rolled button, modal, select, table, or formatting helper that the design system or shared utils already provide — is prime refactor material. Replace the local copy with the shared component and delete it.
- **Check the shared component's props actually cover the local behavior before deleting.** A "duplicate" that quietly supports an extra state is a feature, not a copy, and collapsing it is a behavior change — which this skill is not allowed to make silently.
- Where the local copy is genuinely more capable, the correct refactor is usually to fold its capability into the shared component, not to keep two.

---

## Phase 3 — Regression Testing & Verification

Refactoring is only successful if no functionality is broken:
1. **Pre-Check**: Establish a baseline **with the checks the project actually has** before modifying anything — confirm them in the profile rather than assuming. PHPUnit (`vendor/bin/phpunit`) exists in both projects. A JS test runner does **not** exist everywhere: ScaleUP has **no Vitest configured**, so `npm run test` will fail — its equivalents are `npm run typecheck` (`tsc --noEmit`) and `npm run build`. Inventing a test command wastes a turn and, worse, an unrun test suite reported as passing is a false baseline.
2. **Post-Check**: Execute the same checks after applying changes. Ensure a 100% pass rate, and say which checks you ran — a refactor verified only by reading is a refactor verified by nobody.
3. **Compare Response Payloads**: If API structures were refactored, verify that the before-and-after JSON shapes are identical.

---

## Phase 4 — Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what changed, and the date) so `.agents/reports/<file>.md` stays current for whoever reads it next.
2. **Suggested Next Step**: Point the user to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `refactor(hr): extract shared leave-credit calculation`). Do not stage or commit automatically.
