---
name: webkit-verify
description: >
  ADVERSARIAL spec-conformance verification — tries to PROVE the implementation does NOT match its spec,
  rather than confirming that it does. Every spec claim starts UNPROVEN and needs `file:line` evidence to pass.
  Hunts the three failure modes a normal review misses: rules silently never coded, rules coded backwards,
  and code the spec never authorized. Grades findings CRITICAL/HIGH/MEDIUM/LOW with concrete fixes and a
  dependency-first Fix Plan for `/webkit.fix`. Never edits code; writes `verify.md` into the spec's own ticket
  folder (`.agents/specs/<project>/T#####/verify.md`).
  Triggered by `/webkit.verify <spec_path>`, `/webkit.verify T#####`, or `/webkit.verify <target_path> <spec_path>`.
---

# Webkit Verify

This skill is the **Verification Phase** of the AI development workflow. It answers exactly one question:

> Does the code actually do what the spec says, and can I prove it doesn't?

It is deliberately hostile to the implementation. A normal review reads the code and asks "does this look right?" — which reliably passes code that looks right and is wrong. This skill inverts the burden: **the spec is the claim, the code is the defendant, and every claim is presumed unimplemented until evidence convicts it of working.**

> [!IMPORTANT]
> **This skill MUST NOT modify application code, migrations, routes, components, or the spec.** Its only file output is `verify.md` inside the ticket folder beside the spec it verified. Fixing is `/webkit.fix`'s job. A verifier that fixes what it finds stops being able to report honestly on it.

---

## Workflow Integration

```text
   Spec (.agents/specs/<project>/T#####/specs.md)
               │
               ▼
   webkit.frontend-implement  →  webkit.backend-implement
               │
               ▼
         webkit.verify          ← you are here
               │
               ▼
   Conformance Report (.agents/specs/<project>/T#####/verify.md)
               │
      ┌────────┴────────┐
      ▼                 ▼
  webkit.fix      spec amendment
 (code is wrong)  (spec is wrong)
```

The report is a **file on disk**. `/webkit.fix` is commonly invoked in a new session with no memory of this one, so an unpersisted report silently breaks the handoff.

Both outcomes are legitimate. Sometimes the code is wrong; sometimes the spec is. Deciding which is the point of the report, and it is not always the code.

---

## The Adversarial Posture (read this before anything else)

Five rules. They exist because each one names a way reviewers reliably fool themselves.

**1. Default to NOT IMPLEMENTED.**
A claim is `UNPROVEN` until you can point at `file:line` that implements it. "I didn't see anything wrong" is not evidence of conformance — it is absence of evidence, which is what a missing implementation looks like.

**2. Try to refute, not to confirm.**
For each claim, ask "what would the code look like if this were broken, and does it look like that?" — not "does this look like it works?" Confirmation-seeking finds confirmations in almost any codebase.

**3. Never accept the code's own account of itself.**
A comment saying `// validates ownership` is not evidence ownership is validated. A method named `assertOrganizationScoped()` is not evidence of scoping. A variable named `$isAuthorized` is not authorization. **Read the body. Follow the call. Check the caller actually calls it.** Names and comments are the first thing to drift.

**4. Absence is the primary target.**
The most common conformance failure is not wrong code — it is a spec rule that was simply never written. No error, no failing test, no diff to notice. It cannot be found by reading the code that exists, only by walking the spec and asking "where is this?" of each rule in turn. Phase 5 is dedicated to this and must not be skipped because Phase 4 "looked fine."

**5. Every finding must be falsifiable.**
State a concrete failure scenario: specific inputs or state → the wrong outcome. If you cannot construct one, you have a suspicion, not a finding — mark it `UNVERIFIED` and say why. A report padded with unfalsifiable concerns trains the reader to ignore it.

> [!CAUTION]
> **Do not report style opinions, naming preferences, or "I would have done it differently."** This skill measures conformance to a spec, not agreement with your taste. If the spec does not require it, it is not a finding — `/webkit.refactor` handles quality and cleanup.

---

## Phase 1 — Establish What Is Being Verified

1. **Identify the repo/project — first, because everything below is scoped to it.** Read [project-profile.md](../../rules/project-profile.md) and resolve which project you are in (its "Which Project Am I In?" section). Verifying React code against Vue conventions produces pure noise, and ticket numbers are per project, so `T00004` exists in both.
2. **Locate the spec and its ticket** ([ticket-numbering.md](../../rules/ticket-numbering.md) §4):
   - A `<spec_path>`, or a bare ticket (`/webkit.verify T00004`) → `.agents/specs/<project>/T00004/specs.md`.
   - **The current branch is often the answer** — `git rev-parse --abbrev-ref HEAD` returning `T00004` names the ticket outright, since implementing skills branch on the ticket number.
   - **Given a ticket as the argument** (`/webkit.verify F0135`), verify the implementation **on that ticket's branch**, not on whatever tree you started in — fetch and analyze it per [ticket-numbering.md §8](../../rules/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch). This skill writes no code, so it does not check the branch out (§8.3). When several branches match, stop and ask.
   - Otherwise resolve `<target_path>` / the feature name against that project's ticket folders and its legacy tree, in one command:

     ```bash
     grep -ril '<feature|route|table|module>' ".agents/specs/$project" --include='*.md' 2>/dev/null
     ```

   - Several hits inside one `T#####/` are **one** ticket, not three — `verify.md` and `code-review.md` mention the same feature as their `specs.md`. Read the header of each distinct candidate to confirm the portal matches before committing to one.

   **State the ticket you resolved to, and on what evidence, in your first message.** Verifying against the wrong ticket's spec produces a report that is confidently wrong about a feature nobody touched. If no spec exists at all, **stop and say so** — there is nothing to verify against, and inventing a standard to judge against is the failure mode this skill exists to prevent. Suggest `/webkit.spec` instead.
3. **Read the spec completely, once, before opening any code.** Reading code first anchors you to what exists; you will then unconsciously read the spec as a description of it.
4. **Check the spec carries an Acceptance Criteria table.** A spec written by the current `/webkit.spec` has an `Acceptance Criteria` section of `AC-n` Given/When/Then rows — the intended primary input to this skill. If it is missing (older specs predate it), do **not** stop: derive claims from `Business Rules` and `Edge Cases` as usual, but record the gap in §7 Verification Limits — *"spec carries no Acceptance Criteria table; claims derived from prose, so coverage is an estimate rather than a count"* — and suggest re-running `/webkit.spec` to add one. A spec that cannot be decomposed cleanly is a finding about the spec, not a reason to verify loosely.

### Separate DECIDED from OPEN

Specs carry resolved decisions and open ones. Verifying against an unresolved option is a guaranteed false positive.

- A `> **DECIDED — ...**` block, a `**Recommendation:**` the user accepted, or a resolved build-order item is **binding**. Verify against it.
- An `OPEN POLICY QUESTION`, an unresolved options table, or a `✅/❌`-style "configurable" marker is **not binding**. Code may do either. Note it as `OUT-OF-SCOPE`, not as a finding.
- Where a spec records both an option list *and* a later `DECIDED` block, **the decision wins.** Do not verify against the rejected option.

### Account for sanctioned drift

[project-profile.md](../../rules/project-profile.md) may carry a "Known drift — do NOT copy these patterns" table. Code that deliberately diverges from its neighbours to follow the spec is **correct**, and flagging it inverts the fix. Read that table before judging any file that looks inconsistent with its siblings.

---

## Phase 2 — Extract the Claim Checklist (the core mechanic)

This is the phase that makes verification possible. Prose cannot be verified; atomic assertions can.

Walk the spec top to bottom and decompose it into **individually checkable claims**. Each claim must be small enough that a single `file:line` either satisfies it or does not.

Turn every one of these into claims:

| Spec section | Yields claims about |
| :--- | :--- |
| `Acceptance Criteria` | **One claim per `AC-n` row — reuse the row's id as the claim id.** These rows were written to be mechanically checkable (exact inputs → exact status codes, messages, values), so they are the highest-fidelity claim source in the spec. Do not paraphrase them; verify the literal Given/When/Then |
| `Database` | Each table exists; each column, type, nullability, default; each FK and its on-delete behavior; each index and unique constraint |
| `Backend` | Each class exists at the specified namespace; each route registered at the exact path/method; each response shape |
| `Frontend` | Each page/component/route; the API contract; the module layout |
| `Business Rules` | **One claim per rule.** These are the highest-value and most-often-absent |
| `Edge Cases` | **One claim per row.** Each stated handling either exists or does not |
| `Non-Functional & Failure-Mode Checklist` | One claim per category: authorization per portal/role, concurrency / double-submit guard, idempotency on retry, error shape + status codes, validation boundaries. An `N/A because ...` entry **is** a claim — verify the stated reason still holds, because it is where an unexamined assumption hides |
| `Permissions` | One claim per role × capability cell |
| `Build Order` | Each step's stated outcome |
| `Definition of Done` | Each checkbox, restated as something observable |

Number them: **reuse `AC-n` verbatim for every claim that came from the Acceptance Criteria table**, and number the rest `C1`, `C2`, … Keeping the spec's own ids means the report and the spec cite the same row, and a reader can diff them without re-deriving anything.

Record the spec section each claim came from. **The count matters** — the report states coverage as a number, and a checklist of 8 claims for a 300-line spec is itself a finding about the verification, not about the code. Where the spec has an Acceptance Criteria table, its row count is the **floor**: every `AC-n` must appear in the checklist with a verdict, and a missing one is an unverified claim, not an omission you may make silently.

> [!WARNING]
> Do not merge claims to keep the list short. "Migrations are correct" is not a claim — it is twenty claims wearing one coat, and it will be marked conformant on the strength of the two you happened to check.

---

## Phase 3 — System Awareness Scan (read-only)

Run the [System Awareness](../../rules/system-awareness.md) scan over the layers the checklist touches. Follow [context-loading.md](../../rules/context-loading.md) — this skill reads a lot, so read deliberately, not broadly.

For each claim, know **where** its evidence would live before you go looking. If you cannot say where the evidence would be, the claim is not yet atomic enough — return to Phase 2.

---

## Phase 4 — Verify Each Claim Adversarially

For every claim, in order. Do not batch, do not skim, do not stop early because a run of claims passed.

```text
C<n>: <the claim, verbatim from the spec>
  Where it should live:  <file / namespace / table>
  Evidence found:        <file:line, or NONE>
  Refutation attempted:  <how you tried to break it>
  Verdict:               CONFORMS | VIOLATED | ABSENT | UNVERIFIED | OUT-OF-SCOPE
```

### The refutation lens

Pick the attacks that apply to the claim's kind:

- **Guard clauses** — is the guard actually reached? Is it `||` where it needs `&&`? Does an early `return` skip it? Is it in a method nobody calls?
- **Scoping / multi-tenancy** — does *every* read and write filter by the tenant key, or only the one you looked at? A single unscoped query defeats the whole model. Grep the model, not one call site.
- **Rules with an inverse** — a rule stated as "only X may Y" needs both halves checked: X can, **and non-X cannot**. Reviewers check the first and assume the second.
- **Defaults** — is the default the spec's default, or the framework's? A DB default is not applied to an in-memory model until refresh; an unset config falls back to the library's choice, not yours.
- **Off-by-one and boundary** — `<` vs `<=`, empty collection, single element, null, zero, the first and last period.
- **Transactions** — is the multi-step write actually atomic? A partial failure leaving half-written state is a spec violation even when the happy path is perfect.
- **Order of operations** — the spec's Build Order may imply a runtime order (validate before write, resolve before use). Is it honoured?
- **Response shape** — compare field by field against the spec, including nulls and absent-vs-null. An added field is as much a contract change as a removed one.

### Verify by execution wherever you can

Reading proves what the code says; running proves what it does. Prefer evidence over inference:

- `php artisan tinker --execute="..."` to exercise a handler or dump a real response shape
- `php artisan migrate:fresh --seed` in a **disposable/local** database to prove migrations and seeders actually run
- `npm run typecheck`, `npm run build` for frontend contract claims
- `vendor/bin/phpunit` for backend tests; a JS test runner **only where the project configures one** (ScaleUP does not — it has no Vitest)
- `grep -rn` with a **negative** target — searching for what should *not* exist is often faster proof than searching for what should

> [!CAUTION]
> Never run a destructive command against a database you have not confirmed is disposable. Ask first. `migrate:fresh` on real data is a far worse outcome than an unverified claim.

---

## Phase 5 — The Absence Sweep (do not skip)

Phase 4 verifies claims you thought to check against code you found. This phase catches the rules that left no trace at all — the dominant failure mode, and invisible to code-reading.

Take **every** `Business Rules`, `Edge Cases`, and `Permissions` row from the spec and, for each one, answer in writing: *where would the code be if this existed?* Then look there. Specifically hunt:

- **Stated rules with no enforcement anywhere** — the rule is documented, agreed, and simply never coded
- **Edge-case rows with no corresponding branch** — no guard, no early return, no catch
- **Validation named in the spec but absent from the FormRequest / handler**
- **Notifications, audit entries, or side effects the spec requires and nothing emits**
- **Permission cells with no check behind them** — seeded permission data is not enforcement; verify something actually reads it
- **Cascade and cleanup behavior** the spec specifies and no FK or handler implements

A rule that is documented, agreed, and unimplemented is at least `HIGH`, because everyone downstream believes it is handled. If it guards money, access, or tenant boundaries, it is `CRITICAL`.

---

## Phase 6 — The Reverse Direction: Unspecced Behavior

Now verify the other way. Code that does things the spec never authorized is drift too, and it never shows up in a spec-driven checklist.

- Endpoints, columns, or classes with no spec counterpart
- Extra fields in a response the spec's contract does not list
- Business logic no spec section describes
- Silent fallbacks — a `try/catch` that swallows failure and returns seed or mock data, making a broken dependency look healthy
- `TODO`, `FIXME`, stubbed returns, and hard-coded values sitting where real logic is specified

Each becomes an `UNSPECCED` finding. These are not automatically wrong — but they are undocumented, so nobody downstream knows they exist, and the next spec will be written as though they are not there.

---

## Phase 7 — Assign Verdicts and Severity

| Verdict | Meaning |
| :--- | :--- |
| `CONFORMS` | Evidence found at `file:line`; refutation attempted and failed |
| `VIOLATED` | Implemented, but diverges from the spec |
| `ABSENT` | Specified and not implemented anywhere |
| `UNSPECCED` | Implemented and not specified |
| `UNVERIFIED` | Could not be proven either way — **say why**, do not silently pass it |
| `OUT-OF-SCOPE` | The spec leaves it open; code may do either |
| `SPEC-GAP` | The spec is ambiguous, self-contradictory, or wrong. The code cannot be judged until it is amended |

Assign exactly one severity per finding. Judge by **consequence if it ships**, not by how hard it is to fix.

| Severity | Applies to | Fix urgency |
| :--- | :--- | :--- |
| `CRITICAL` | Cross-tenant data leak, authentication or authorization bypass, data loss, money computed or recorded wrong, financial history mutable where the spec forbids it | Before anything else ships |
| `HIGH` | A specified rule is absent or implemented backwards; behavior contradicts the spec on a path users will actually reach; a permission is granted the spec denies | Before the feature is called done |
| `MEDIUM` | Divergence with contained blast radius — wrong default, missing edge-case branch, response-shape mismatch a caller can work around, a constraint present in the spec and absent from the schema | Same milestone |
| `LOW` | Naming or cosmetic divergence with no behavioral effect; unspecced-but-harmless code; a note for a future spec | Opportunistic |

**Escalate one level** when the finding is *silent* — no error, no log, no failing test. A wrong value that surfaces loudly is safer than a wrong value nobody notices, so silence is an aggravating factor, not a neutral one.

**Do not** inflate severity to get attention, and do not deflate it because the fix is awkward. The severity describes the defect; the effort estimate describes the fix. They are separate fields for a reason.

### The overall verdict follows from the severities

Not a judgement call — derive it:

| Verdict | When |
| :--- | :--- |
| `DOES NOT CONFORM` | Any `CRITICAL` or `HIGH` finding exists |
| `CONFORMS WITH FINDINGS` | Only `MEDIUM` / `LOW` findings exist |
| `CONFORMS` | No findings, and no claim left `UNVERIFIED` |

If claims remain `UNVERIFIED`, the verdict **cannot** be `CONFORMS` — say `CONFORMS (PARTIAL — n claims unverified)` and list them in §7. Claiming full conformance on unchecked claims is the single most damaging thing this skill can do, because it retires the question.

### Every finding carries a suggested fix

A finding without a fix suggestion is a complaint. Before writing any finding, be able to answer: *what exactly should change, and where?*

- Name the **file and construct** — "add the `whereRelation('role', ...)` guard in `RemoveMemberHandler::execute()`", not "enforce the ownership rule".
- Say which side changes: **`code`** when the implementation is wrong, **`spec`** when the spec is wrong or unsatisfiable. Roughly one finding in five is the spec's fault; defaulting every time to "fix the code" is how a wrong spec gets cemented.
- If the right fix depends on a decision the user has not made, say that plainly instead of picking one. Put it under **Do not fix yet** in the Fix Plan and name the decision.

`SPEC-GAP` deserves particular honesty. If the spec cannot be satisfied as written, saying so is the finding. Do not invent a reading and grade the code against it.

---

## Phase 8 — Report Structure

```markdown
# Conformance Report: <Feature Name>

> **Ticket:** `T#####` (<project>) — this file is `.agents/specs/<project>/T#####/verify.md`.
> **Branch:** <branch name — normally `T#####`>
> **Spec:** [specs.md](./specs.md)
> **Run:** v<N> — <YYYY-MM-DD> — <one-line summary of what changed since the previous run, or "initial">.
> **Verified:** <YYYY-MM-DD>
> **Verdict:** CONFORMS | CONFORMS WITH FINDINGS | DOES NOT CONFORM
> **Coverage:** <N> claims — <c> conforms, <v> violated, <a> absent, <u> unverified, <o> out-of-scope

---

## 1. Summary

<Two or three sentences: does it conform, and if not, what is the single most consequential gap.>

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | n | anything ships |
| HIGH | n | the feature is done |
| MEDIUM | n | end of milestone |
| LOW | n | — |

## 2. Findings

<Most severe first. One block each — omit this section entirely if there are none.>

### F<n> — <one-line title> · `CRITICAL` · `ABSENT`

- **Claim:** C<n> — <the spec requirement, verbatim>
- **Spec source:** §<section>
- **Expected:** <what the spec requires>
- **Actual:** <what the code does, or that nothing does it> — [`file.php:42`](path#L42)
- **Failure scenario:** <specific inputs or state → the wrong outcome>
- **Proof:** <the command run and its output, or the exact code path traced>
- **Fix target:** `code` | `spec` — <why that side is the one that is wrong>
- **Suggested fix:** <the concrete change: which file, which line, what it should become.
  Specific enough that `/webkit.fix` can act on it without re-deriving the analysis.
  Name the file and the construct, not just the intent.>
- **Effort:** `trivial` (one line) | `small` (one file) | `large` (multi-file, migration, or contract change)
- **Regression risk:** <what the fix itself could break, or `none`>

## 3. Claim Checklist

<Every claim with its verdict and evidence. This is the audit trail — it is what makes the coverage
number above meaningful rather than a claim of its own.>

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| AC-1 | ... | CONFORMS | `file.php:42` |
| AC-2 | ... | ABSENT | — |
| C1 | ... | CONFORMS | `file.php:88` |

## 4. Fix Plan

<Every finding that needs action, ordered so a developer can work straight down the list.
Dependency-first within a severity band — if fixing F3 requires F1's migration, F1 comes first.
This is the section `/webkit.fix` actually consumes, so it must stand alone: a reader who
skipped §2 should still know what to change. Omit only if there are zero findings.>

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | F2 | CRITICAL | <one line: what to change> | `path/to/file.php` | small |
| 2 | F1 | HIGH | ... | ... | trivial |

**Fix together:** <findings that share a file or a migration and should be one change, not three.>

**Do not fix yet:** <findings whose fix depends on an unresolved spec decision. Name the decision.>

---

## 5. Unspecced Behavior

<Code with no spec counterpart. Omit if none.>

## 6. Spec Gaps

<Places the spec cannot be verified against as written. Omit if none.>

## 7. Verification Limits

<What you could NOT verify and why — no test database, external service, browser-only behavior,
runtime-dependent state. Being explicit here is what separates "verified" from "read".>
```

### Persist the Report (MANDATORY)

- Write to **`.agents/specs/<project>/<ticket>/verify.md`** — the same folder as the `specs.md` you verified, that exact filename. No dates, no feature name, no portal prefix in the filename, and never a copy under `.agents/reports/` ([ticket-numbering.md](../../rules/ticket-numbering.md) §5).
- The folder already exists (`/webkit.spec` created it). If you resolved a **legacy** spec at `.agents/specs/<repo>/<portal>/<feature>.md`, it has no ticket folder: keep the old dated path `.agents/reports/<domain>-<feature>-verify-<YYYYMMDD>.md`, say that is why, and suggest re-running `/webkit.spec` to migrate the spec into a ticket. Do **not** write `verify.md` into a portal folder — those folders hold several specs, so a fixed filename there would collide between features. Do **not** allocate a ticket number yourself either; allocating is `/webkit.spec`'s job.
- Re-verifying the same feature **overwrites that file in place** rather than creating a near-duplicate ([duplicate-prevention.md](../../rules/duplicate-prevention.md)) — history lives inside the file:
  1. Increment the `> **Run:**` `v<N>`, set today's date, and write one line on what changed since the previous run (e.g. "F2 and F3 fixed; F1 still open; 1 new finding").
  2. Append the superseded run line verbatim to a `<!-- Run history -->` list at the bottom of the file.

  Overwriting the report while leaving the `> **Run:**` line untouched destroys the only record that an earlier run disagreed.
- Every `file:line` reference must be a real, current location. A stale line number makes the whole report untrustworthy.

---

## Anti-Patterns

Each of these has produced a verification that passed a broken implementation.

| Anti-pattern | Why it fails |
| :--- | :--- |
| Reading the code first, then the spec | You read the spec as a description of what you already saw |
| "Looks correct" as a verdict | Not falsifiable, not evidence, not a verdict |
| Trusting names and comments | They are the first thing to drift from behavior |
| Verifying the happy path only | Edge cases are where specs are violated |
| Merging claims to shorten the list | The unchecked half rides in on the checked half |
| Skipping Phase 5 because Phase 4 passed | Absence leaves no code to review — it is invisible to Phase 4 by construction |
| Grading against a rejected option | Read the `DECIDED` block, not the options table |
| Reporting style opinions | Dilutes real findings and trains the reader to skim |
| Fixing what you find | You lose the ability to report on it honestly, and the report no longer matches any commit |
| Passing a claim you could not check | `UNVERIFIED` with a reason is useful; a false `CONFORMS` is worse than no report |
| A finding with no suggested fix | A complaint, not a finding — the next session has to redo the whole analysis to act on it |
| Grading severity by effort | An awkward one-line fix to a tenant leak is still `CRITICAL`; an easy rename is still `LOW` |
| Always blaming the code | Roughly one finding in five is the spec's fault. Defaulting to `code` cements a wrong spec |

---

## Follow-up Commands

Always include the saved report path so the next skill loads it directly:

- Apply the confirmed findings: `/webkit.fix <target_path> using .agents/specs/<project>/<ticket>/verify.md` — **on the ticket's existing branch**, not a new one
- The spec was wrong, not the code: `/webkit.spec <ticket> amend per .agents/specs/<project>/<ticket>/verify.md`
- Deeper root-cause on one finding: `/webkit.investigate <target_path> <finding F<n> from .agents/specs/<project>/<ticket>/verify.md>`
- Review the same change for code quality, not just conformance: `/webkit.code-review <ticket>` — writes `code-review.md` into the same ticket folder
