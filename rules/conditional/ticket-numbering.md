# Ticket Numbering, Ticket Folders & Ticket Branches

Every spec-driven piece of work gets a **ticket**: a number, a folder inside its project holding all of its documents, and a git branch named after it.

```text
.agents/specs/
├── <project-a>/                ← project
│   ├── T00001/
│   │   ├── context.md          ← written by /webkit-context (with dependency-map.md, touched-files.md)
│   │   ├── spec.md             ← written by /webkit-specify
│   │   ├── plan.md             ← written by /webkit-specify, ticked by /webkit-implement
│   │   ├── task.md             ← created by /webkit-specify, kept current by every later skill
│   │   ├── summary.md          ← written by /webkit-summarize: read FIRST by later sessions
│   │   ├── investigation.md    ← written by /webkit-investigate
│   │   ├── refactor.md         ← written by /webkit-refactor
│   │   ├── verify.md           ← written by /webkit-verify
│   │   ├── code-review.md      ← written by /webkit-code-review
│   │   └── design-review.md    ← written by /webkit-design-review
│   ├── T00002/
│   │   └── investigation.md    ← a bug ticket: no spec, and that is fine
│   ├── hr/                     ← legacy path-based specs (still valid, see §7)
│   └── payroll/
└── <project-b>/                ← another project, its own T00001…
    └── T00001/
        ├── spec.md
        ├── plan.md
        └── task.md
```

One ticket = one piece of work = one folder = one branch. Every document a workflow skill produces about that work — the context map, the spec, its implementation plan, the root-cause investigation, the refactor record, the conformance report, the diff review, the design review, the summary — lands in the same folder under a fixed name, and `git log` says which ticket produced any given commit.

A ticket does **not** need every file. A feature ticket may never have an `investigation.md`; a bug ticket usually has no spec and no plan. What is present tells you what has been done.

The spec file is `spec.md`, written from [the feature-specification template](../../template/feature-specification.md). Tickets created before `/webkit-specify` hold their spec as **`specs.md`** (plural) — still valid, still the spec. Spec discovery accepts both names, and an update edits whichever exists; never create a `spec.md` beside an existing `specs.md`.

The plan file is `plan.md`, written by `/webkit-specify` with the spec, from [the implementation-plan template](../../template/implementation-plan.md). The spec says **what** and is what reviews check against; the plan says **how and in what order**, file by file, and is what `/webkit-implement` executes. A plan never exists without a spec. Tickets specified before plans existed have none; `/webkit-specify T##### --plan` adds one.

The tracker file is `task.md`, created by `/webkit-specify` with the spec and the plan, from [the task-tracker template](../../template/task-tracker.md). It is the one page that says what is done and what is still open: every plan task, every finding still to fix, what the ticket is waiting on, and a log of each skill run. It is a view; plan.md, the reports, and the spec stay the sources ([task.md upkeep](#taskmd-upkeep)).

The context map (`context.md`, `dependency-map.md`, `touched-files.md`) is written by `/webkit-context` **before** the spec, so `/webkit-specify` and `/webkit-implement` start from a verified list of affected, reusable, and do-not-touch files instead of re-scanning. The summary (`summary.md`) is written by `/webkit-summarize` once the history is long or the ticket is done; later sessions read it **instead of** the old reports ([context-budget.md](../context-budget.md)).

---

## 1. The format

- `T00001`, `T00002`, `T00003`, … — capital `T`, **no hyphen**, **five digits, zero-padded**.
- Match exactly: `^T[0-9]{5}$`. `T1`, `T-00001`, `t00001`, and `T000001` are all wrong.
- Ticket folders live **one level inside the project folder** — `.agents/specs/<project-a>/T00001/`, `.agents/specs/<project-b>/T00001/` — as siblings of that project's legacy portal folders. Never at the top of `specs/`, and never nested inside a portal folder.
- **Numbers are scoped per project.** Each project has its own counter and its own `T00001`; the two are unrelated pieces of work. That is deliberate: each project is a separate GitHub repo, so a `T00001` branch is unambiguous in the repo where it is used.
- Because of that scoping, **a ticket number on its own is only meaningful with its project.** Write it as `<project> T00001` (or with its path) whenever both projects could be meant.
- The number carries no meaning beyond identity. Feature name and scope are recorded **inside** the spec (its Metadata table and §8 Architecture; the header block on older `specs.md` files), not in the folder name.

## 2. Allocating a number (the increment)

**Only the skill that *starts* a piece of work allocates.** A workstream's first skill creates the ticket; every later skill resolves the existing one (§4):

| Skill | Allocates a ticket when none exists? |
| :--- | :--- |
| `/webkit-context` | **Yes** — it starts feature work when it runs before the spec |
| `/webkit-specify` | **Yes** — it starts feature work (or reuses the ticket `/webkit-context` opened) |
| `/webkit-investigate` | **Yes** — it starts bug / RCA work |
| `/webkit-refactor` | **Yes**, but only for a *standalone* cleanup. Cleaning up a ticket's own implementation belongs in that ticket. |
| `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`, `/webkit-fix`, `/webkit-implement`, `/webkit-migrate`, `/webkit-summarize` | **No** — they continue existing work. They resolve, and if there is no ticket they say so (§4) rather than inventing one. |

**Resolve the project first.** Run the "Which Project Am I In?" resolution in [project-gate.md](../core/project-gate.md) and state the answer *before* scanning — a ticket allocated into the wrong project's folder is numbered off the wrong counter and collides with real work there.

Then, from the project root:

```bash
project="<project>"                 # the folder name resolved above

# highest ticket number in THIS project (empty if it has none yet)
max=$(find ".agents/specs/$project" -maxdepth 1 -type d -name 'T[0-9][0-9][0-9][0-9][0-9]' 2>/dev/null \
      | sed 's#.*/T##' | sort -n | tail -1)

# next number: T00001 if none exist, otherwise max + 1
next=$(printf 'T%05d' $(( ${max:-0} + 1 )))

mkdir -p ".agents/specs/$project/$next"   # claim it IMMEDIATELY, before writing any file
echo "$project/$next"
```

Rules that make this safe:

- **Scan only the resolved project's folder.** `-maxdepth 1` inside `specs/<project>/` — not all of `specs/`, which would mix the two counters.
- **`max + 1`, never "first free".** If `T00001` and `T00003` exist, the next ticket is `T00004` — the gap stays a gap. A ticket number is a permanent ID; reusing a retired one makes every older reference, branch, and PR pointing at it describe different work.
- **Claim before writing.** `mkdir` the folder as soon as the number is computed, so a second allocation in the same session cannot pick the same number.
- **Never guess the number from memory or from chat history.** Always re-scan the disk. A skill invoked in a fresh session has no idea what was allocated last.
- **Do not renumber or compact** existing folders, ever.

## 3. Reuse before you allocate (MANDATORY)

Allocating is the **second** choice. Before creating a new number, check whether this work already has a ticket — searching that project only:

```bash
grep -ril '<feature name or route>' ".agents/specs/$project" --include='*.md' 2>/dev/null
```

- **A ticket already covers this feature** → work in that folder and **update its spec in place** (Minor / Major rules in [webkit.specify](../../skills/webkit.specify/SKILL.md#changing-an-existing-spec)). Do not allocate a second number for the same feature ([system-awareness.md](./system-awareness.md)).
- **The user named a ticket explicitly** (`/webkit-specify T00007 ...`) → use that folder in the resolved project, even if the number is not the highest. Create it only if it is genuinely absent, and say so.
- **Nothing matches** → allocate per §2.

## 4. Finding a ticket from a feature or a path

`/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`, `/webkit-fix`, `/webkit-implement`, and `/webkit-summarize` are usually invoked in a fresh session with only a target path or a feature name. Resolve the ticket, do not ask the user to remember it:

1. If the prompt names a ticket (`T00004`, `F0135`) or a path inside one, use it directly — resolving the project the same way, since `T00004` exists in both. **A ticket passed as a command argument also names a branch that must be fetched and analyzed — see §8.**
2. **The current git branch is often the answer.** `git rev-parse --abbrev-ref HEAD` returning `T00004` (or `T00004-<slug>`) names the ticket outright — see §6.
3. Otherwise `grep -ril '<feature|route|table|module>' .agents/specs/<project> --include='*.md'` — that one command covers the project's ticket folders and its legacy tree. Read the hits like this:

   - **Several hits inside one `T#####/`** are **one ticket**, not three — `verify.md` and `code-review.md` naturally mention the same feature as its spec. Collapse to the folder (`… | sed 's#/[^/]*$##' | sort -u` if you want that done for you).
   - **A hit in the legacy tree** (`specs/<project>/<portal>/<feature>.md`) is the spec file itself; its folder is a portal holding many specs, so do not treat the folder as a ticket.
   - Confirm with each candidate's Metadata table (Project Name, Ticket Number) — or the `> **Ticket:**` / `> **Portal:**` header on older specs and on reports — before committing to one.
4. Still nothing → **this work has no ticket yet.** Say so plainly. If you are an allocating skill (§2), allocate one now. If you are not, do **not** invent a ticket to have somewhere to write: `/webkit-verify` stops (there is no spec to verify against); `/webkit-code-review` and `/webkit-design-review` continue and write to `.agents/reports/` instead (§5); `/webkit-fix` works from the report it finds there.
5. Report which ticket you resolved to, and on what evidence, in your first message. A skill that silently verifies against the wrong ticket is worse than one that stops.

## 5. The file contract

| File | Written by | Overwrite behaviour on re-run |
| :--- | :--- | :--- |
| `spec.md` (`specs.md` on older tickets) | `/webkit-specify` | Update in place. **Minor** change: edit the affected sections and add a Change Log row under the current version. **Major** change: increment the version (`1.0` → `1.1`) and log reason, impact, and changed sections. Review findings never create a version. Two other skills make Minor edits without a `/webkit-specify` run: `/webkit-verify` applies a **Case 1** correction (a spec error it proved), and `/webkit-fix` records fixed findings in §14 **Review findings**; either one also sets Status `Done` when the ticket closes ([Closing a ticket](#closing-a-ticket)). |
| `plan.md` | `/webkit-specify` (tasks ticked by `/webkit-implement`, `/webkit-verify`, `/webkit-fix`) | Update in place, filled from [the implementation-plan template](../../template/implementation-plan.md), whenever the spec changes in a way that affects it or the plan itself was wrong: bump the Metadata **Plan Revision** and add a Plan Change Log row; a spec Major change also updates **Based on Spec Version**. Ticked tasks are never edited or unticked: changed work is a new task. `/webkit-implement`, `/webkit-fix`, and `/webkit-verify` edit only the task checkboxes and Plan Status; `/webkit-verify` also applies the plan side of a Case 1 spec correction. |
| `task.md` | `/webkit-specify` creates it; `/webkit-implement`, `/webkit-verify`, `/webkit-fix`, `/webkit-code-review`, `/webkit-design-review`, `/webkit-context`, `/webkit-summarize` keep it current | Update in place, never overwritten: see [task.md upkeep](#taskmd-upkeep). |
| `context.md`, `dependency-map.md`, `touched-files.md` | `/webkit-context` | Update in place, filled from [ticket-context](../../template/ticket-context.md), [dependency-map](../../template/dependency-map.md), and [touched-files](../../template/touched-files.md); bump the Metadata **Context Run** row in `context.md` and append the superseded run to its run history. A later skill that finds a listed file wrong does not edit these files: it says so, and the next `/webkit-context` run corrects them. |
| `summary.md` | `/webkit-summarize` | Overwrite with the latest run, filled from [the ticket-summary template](../../template/ticket-summary.md); bump the Metadata **Summary Run** row and append the superseded run to the run history. It is a compression: the sources stay, and where they disagree the source wins. |
| `investigation.md` | `/webkit-investigate` | Update in place, filled from [the investigation-report template](../../template/investigation-report.md); bump the Metadata **Investigation Run** row and append the superseded run to the run history. Its Fix Plan checkboxes and §9 Resolution are filled by the skill that applies the fix. |
| `refactor.md` | `/webkit-refactor` | Update in place, filled from [the refactor-report template](../../template/refactor-report.md); bump the Metadata **Refactor Run** row so successive cleanups on one ticket each leave a line, and append the superseded run to the run history. |
| `verify.md` | `/webkit-verify` (findings closed by `/webkit-fix`) | Overwrite with the latest run, filled from [the verification-report template](../../template/verification-report.md); bump the Metadata **Verification Run** row and append the superseded run to the run history. `/webkit-fix` edits it in place as a [fix pass](#fix-pass). |
| `code-review.md` | `/webkit-code-review` (findings closed by `/webkit-fix`) | Overwrite with the latest run, filled from [the code-review-report template](../../template/code-review-report.md); bump the Metadata **Review Run** row and append the superseded run to the run history. `/webkit-fix` edits it in place as a [fix pass](#fix-pass). |
| `design-review.md` | `/webkit-design-review` (findings closed by `/webkit-fix`) | Overwrite with the latest run, filled from [the design-review-report template](../../template/design-review-report.md); bump the Metadata **Review Run** row and append the superseded run to the run history. `/webkit-fix` edits it in place as a [fix pass](#fix-pass). |

- **These filenames are fixed.** No dates, no ticket numbers, no feature names, no portal prefixes — `verify-20260907.md`, `T00001-spec.md`, `spec-payroll.md`, `investigation-tk-late-log.md`, and `code_review.md` are all wrong. History lives *inside* the file, in its version/run lines, so a stale link never points at a file that no longer exists.
- Every one of them names its own ticket and project in its **Metadata table** (each is filled from its template in [`.agents/template/`](../../template/)); older `specs.md` files and reports written before the templates carry a `> **Ticket:** <project> T#####` header line instead. Either way, a document copied or pasted elsewhere still says where it belongs.
- A ticket folder holding only its spec — or only `investigation.md` — is normal. It just means the work has not reached the other steps yet.
- **One workstream per ticket.** If an investigation turns up a *second, unrelated* defect, that is a second ticket with its own `investigation.md` — not a second investigation file crammed into this folder.
- **The fixed filenames only work inside a ticket folder.** A legacy spec in a portal folder (§7) shares that folder with other specs, so `verify.md` there would collide between features — reports for legacy specs keep the old dated `.agents/reports/<domain>-<feature>-{verify,review,design-review}-<YYYYMMDD>.md` path until the spec is migrated to a ticket.
- A diff review for a change with **no spec at all** likewise goes to `.agents/reports/<scope>-review-<YYYYMMDD>.md`. `/webkit-code-review` runs without a spec by design; it never allocates a ticket to have somewhere to write.
- Nothing outside the filenames in this table belongs in a ticket folder.
- [`.agents/reports/`](../../reports/) is now only the **fallback and the archive**: investigations written before this convention live there and stay valid, and the two unticketed cases above still land there. New ticketed work does not add to it.

### Run-history block

`investigation.md`, `refactor.md`, `verify.md`, `code-review.md`, `design-review.md`, `context.md`, and `summary.md` each record their current run in a Metadata **… Run** row (`Investigation Run`, `Refactor Run`, `Verification Run`, `Review Run`, `Context Run`, `Summary Run`) and end with:

```markdown
<!-- Run history -->
- v1 — 2026-09-07 — initial — ❌ FAILED
```

On every re-run, **before overwriting**: append the previous run's line (its run value, date, and status or verdict) under the marker. Then bump the Metadata run row and its date, and write one line on what changed since the previous run. Never delete a superseded line — overwriting a report without recording the previous run destroys the only record that an earlier run disagreed. (`spec.md` keeps its history in its §16 Change Log instead, and `plan.md` in its §10 Plan Change Log; reports written before the templates use a `> **Run:**` header line.)

### Fix pass

`/webkit-fix` closes the findings it fixed **in the report itself**, so the report does not have to be re-run just to learn that the fixes landed. A fix pass on run `vN`:

1. sets each handled finding's **Resolution** line (`✅ FIXED`, `✅ FIXED (traced)`, `✅ ALREADY RESOLVED`, or `❌ NOT FIXED`, with the evidence),
2. recomputes the report's status and recommendation from the findings still open, with the report's own rule, and suffixes the status with `(after fix pass vN.k)`,
3. appends the run `vN` line under `<!-- Run history -->` and sets the Metadata run row to `vN.k — fix pass <date> by /webkit-fix: <findings closed>; not re-reviewed` (`k` counts the fix passes on run `N`).

Findings, evidence, and numbering are otherwise left as the review wrote them. The next real run of the review is `v(N+1)`; it appends the `vN.k` line to the history like any superseded run. The `(after fix pass …)` suffix is what tells a reader the status comes from the fixes' own checks, not from a fresh adversarial review.

### task.md upkeep

`task.md` is shared by the skills that move the ticket. Each one, at the end of its run, updates only what it owns, from the sources it just read or wrote:

| Skill | Updates |
| :--- | :--- |
| `/webkit-specify` | Creates it. On a spec or plan change: Metadata, the §1 Specify row, §2 to match plan.md, §4 open questions. |
| `/webkit-implement` | §2 ticks (same as plan.md), the §1 Implement row (`done/total tasks`), §4 commands for the user. |
| `/webkit-verify` | The §1 Verify row, its own §3 items (this run's BLOCKER / REQUIRED FIX), §2 ticks it added to plan.md, §4 pending manual checks, Metadata after a Case 1 correction or a closing. |
| `/webkit-code-review` · `/webkit-design-review` | Their §1 row and their own §3 items (CRITICAL / HIGH). |
| `/webkit-fix` | Ticks the §3 items it closed (`— fixed <date>`), the §1 Fix row and the source report's row, §2 ticks it added to plan.md, Metadata after a closing. |
| `/webkit-context` · `/webkit-summarize` | One §5 line (and **Last Updated**) when `task.md` exists; nothing else. `/webkit-context` usually runs before `task.md` exists: `/webkit-specify` then mentions the context map in its own §5 line. |

Every update also refreshes **Done**, **Next step**, and **Last Updated**, and adds one line at the top of §5 Activity Log. A ticket that has a spec but no `task.md` (created before it existed) gets one from the template the first time any of these skills runs on it. A ticket with no spec (a bug ticket with only `investigation.md`) has no `task.md`.

### Closing a ticket

Whichever of `/webkit-verify` or `/webkit-fix` leaves the ticket in this state sets the spec's **Status** to `Done` and the plan's **Plan Status** to `Done`, and records it in `task.md`:

- `verify.md` exists and its status is ✅ PASS (any form, including `(n AC pending manual check)` and `(after fix pass …)`),
- no CRITICAL or HIGH finding is open in `code-review.md` or `design-review.md`, where they exist,
- every plan task is ticked or retired, and
- the spec's §15 Open Questions is empty and its Status is `Approved` or `In Progress`.

Anything missing stays listed in `task.md` §4 Waiting On. A `Draft` or `In Review` spec is never moved to `Done`: that would skip its approval.

## 6. The branch is the ticket

> Going the other way — you were *given* a ticket and need to find and analyze its branch — is §8.

Work that has a ticket is done on a branch **named after that ticket**:

```bash
git checkout -b T00001
```

- **Bare ticket number is the default form** — `T00001`, not `feature/T00001`, not `T00001-loan-amortization`. It matches the ticket folder character for character, so `git rev-parse --abbrev-ref HEAD` alone tells any later skill which spec to build to, verify against, and review.
- **One ticket, one branch.** The frontend gate, the backend gate, the fixes that follow verification, and the review cleanup are all the same ticket and all belong on the same branch. Do not open `T00001-fe` and `T00001-be`.
- **`T00001-<short-slug>` only when a second branch is genuinely unavoidable** — e.g. the first is already merged and a follow-up is needed. Say why.
- **A bug ticket branches the same way.** `investigation.md` in `T00007/` means the fix for it goes on branch `T00007`, not `bugfix/<slug>` — the ticket already identifies the work.
- **`/webkit-investigate` allocates a ticket but creates no branch.** It writes no application code, so there is nothing to isolate; the branch appears when `/webkit-fix` or an implement skill picks the ticket up.
- **Work with genuinely no ticket** keeps the categorised form from [git-workflow.md](../core/git-workflow.md) Rule 1: `bugfix/<domain>-<feature-kebab>`, `refactor/…`, `hotfix/…`.
- The ticket number goes in the **PR title** (`T00001 — Loan amortization schedule`) with the spec path in the body. Commit messages keep plain Conventional Commits — the branch already carries the ticket, so `feat(payroll): …` needs no ticket prefix.
- The [Mandatory Branch Gate](../core/git-workflow.md#mandatory-branch-gate-for-implementing-skills) is what enforces this, and it is blocking. Creating the branch is compliance, not a decision that needs approval.

> [!IMPORTANT]
> Numbers are per project (§1), so the same `T00001` branch name can exist in both repos for unrelated work. That is fine — each branch lives in its own repo. It does mean **never assume a `T00001` branch in one repo has anything to do with `T00001` in the other.**

## 7. Legacy path-based specs

Specs written before this convention live at `.agents/specs/<project>/<portal>/<feature>.md`, with their reports at `.agents/reports/<domain>-<feature>-{verify,review}-<date>.md`. They are **still valid and still the source of truth for their features**:

- **Read them.** Spec discovery must search the project's ticket folders *and* its legacy portal folders.
- **Do not bulk-migrate them.** Moving a spec breaks every report, commit message, branch, and chat reference that points at its path.
- **Migrate one only when you are already editing it,** and only if the user asks: allocate a ticket per §2, move the spec to `<project>/T#####/spec.md`, move its newest reports to `verify.md` / `code-review.md` / `investigation.md`, and note the old path in the changelog line so the trail survives.
- New work always gets a ticket folder.

## 8. Resolving a ticket ARGUMENT to its branch

When a skill is invoked as `/webkit-fix F0135`, `/webkit-implement T00004`, or `/webkit-code-review F0148`, **the ticket is not just a folder to open.** It names the **branch that holds the work**, and that branch — not the working tree you happen to be sitting on — is what gets analyzed.

> [!CAUTION]
> Opening `.agents/specs/<project>/T#####/` and starting to edit, without ever fetching the ticket's branch, is the failure this section exists to stop. The spec says what was *intended*; the branch holds what was actually *built*. A fix written against the wrong tree does not apply.

### 8.1 Two ticket formats, both real

| Format | Origin | Example | Match |
| :--- | :--- | :--- | :--- |
| `F####` | The team's ticket system. **The dominant convention on the GitHub remote** — `F0004` … `F0174` and growing. | `F0135` | `^[Ff][0-9]{4}` |
| `T#####` | Allocated by `/webkit-specify`, `/webkit-investigate`, `/webkit-refactor` (§2) | `T00004` | `^T[0-9]{5}$` |

§1's `^T[0-9]{5}$` governs **the folders this repo allocates**. It does **not** govern branches that already exist on the remote: most of those are `F####`, they are not malformed, and they must not be "corrected".

An `F####` ticket usually has **no folder** under `.agents/specs/`. That is normal and not a reason to allocate one — the branch is its source of truth, and any report about it goes to `.agents/reports/` (§5).

### 8.2 The procedure — BLOCKING, before any file is edited

**Step 1 — Refresh, then find every candidate.** Remote branch names are case-sensitive and carry suffixes, so match loosely and look at everything that comes back:

```bash
ticket=F0135                                   # exactly as the user typed it
git fetch origin --prune --quiet

base=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/master)

# exact, case variants, and suffixed variants — F0135 / f0135 / F0135-fixed / F0136-Fixed
git for-each-ref --sort=-committerdate \
    --format='%(refname:short)  %(committerdate:short)  %(authorname)' refs/remotes/origin \
  | grep -iE "^origin/${ticket}([-_][A-Za-z0-9]+)?[[:space:]]"

# range branches that may CONTAIN it — F0149-F0151 covers F0150
git branch -r | sed 's#.*origin/##' | grep -iE '^F[0-9]{4}-F[0-9]{4}$'
```

> [!WARNING]
> These are **real, verified traps in this remote**, not hypotheticals. `F0004` and `f0004` are two different branches. So are `F0135` and `F0135-fixed`, and `F0136` and `F0136-Fixed`. `F0149-F0151` is a single branch covering three tickets, so an exact-match search for `F0150` finds nothing while the work sits right there.

**Step 2 — More than one match → STOP and ask.** Do not guess, and do not assume `-fixed` is the newer or the right one. Print what you found and wait:

```text
3 branches match F0135:

  origin/F0135        2026-07-02  fdcJL
  origin/F0135-fixed  2026-07-09  Sync
  origin/f0135        2026-06-28  fdcJL

Which one should I work on?
```

Only the user knows which branch is current. Picking for them is how a fix lands on abandoned code.

**Step 3 — Zero matches → say so plainly.** Never invent a branch, and never silently fall back to the working tree. Report it and offer the alternatives: the ticket may not be pushed yet, may be spelled differently, or may be local-only —

```bash
git branch --list "*${ticket}*"                # is it local but unpushed?
grep -ril "$ticket" .agents/specs .agents/reports 2>/dev/null
```

**Step 4 — Analyze the branch BEFORE checking anything out.** This is the "analyze there, then fix" step, and it is read-only:

```bash
git log "$base".."origin/$branch" --oneline             # what work is on it
git diff "$base"..."origin/$branch" --stat              # which files, how much
git diff "$base"..."origin/$branch" -- <paths of interest>
```

Use **three dots** (`base...branch`) for the diff: it shows what the branch changed since it diverged, excluding everything that landed on `master` afterwards. Two dots mixes in unrelated master commits and makes the change look far larger than it is.

State the scope you found — branch, base, file count, commit count — before proceeding.

**Step 5 — Then check out, under the [Mandatory Branch Gate](../core/git-workflow.md#mandatory-branch-gate-for-implementing-skills).**

```bash
git status --short                                      # say what is carried over first

# local copy does not exist yet — create it tracking the remote
git checkout -b "$branch" "origin/$branch"

# local copy already exists — just switch, then report any divergence
git checkout "$branch"
git rev-list --left-right --count "origin/$branch...$branch"   # behind <TAB> ahead
```

> [!CAUTION]
> **Never `git checkout -B`, `git reset --hard`, `git push --force`, or `git branch -f` to make a local branch match the remote.** Those discard local commits that may be the only copy of someone's work. If the local and remote copies have diverged, **report both counts and ask** — reconciling them is the user's call, not the agent's.

### 8.3 Read-only skills stop at Step 4

`/webkit-code-review`, `/webkit-verify`, `/webkit-design-review`, `/webkit-investigate`, `/webkit-document`, `/webkit-context`, and `/webkit-summarize` write no application code, so they **analyze the branch without checking it out** — Steps 1–4 only. Switching the user's working tree to run a review is a side effect nobody asked for.

Their report still records which branch was analyzed, in its Metadata **Branch** row (`Branch Analyzed` in `investigation.md`, `Verified Against` in a feature guide; a `> **Scope:**` header line in reports written before the templates).

### 8.4 Where the report goes

Unchanged from §5, with one addition: a `F####` ticket normally has no ticket folder, so its reports go to **`.agents/reports/<scope>-<kind>-<YYYYMMDD>.md`**. Name the branch in the report header so the trail survives.

If an `F####` ticket *does* have a matching `T#####` folder (the work was specced here and branched there), write to the ticket folder as normal and record both identifiers in the header.
