# Ticket Numbering, Ticket Folders & Ticket Branches

Every spec-driven piece of work gets a **ticket**: a number, a folder inside its project holding all of its documents, and a git branch named after it.

```text
.agents/specs/
├── subhrms/                    ← project
│   ├── T00001/
│   │   ├── specs.md            ← written by /webkit.spec
│   │   ├── investigation.md    ← written by /webkit.investigate
│   │   ├── refactor.md         ← written by /webkit.refactor
│   │   ├── verify.md           ← written by /webkit.verify
│   │   ├── code-review.md      ← written by /webkit.code-review
│   │   └── design-review.md    ← written by /webkit.design-review
│   ├── T00002/
│   │   └── investigation.md    ← a bug ticket: no spec, and that is fine
│   ├── hr/                     ← legacy path-based specs (still valid, see §7)
│   └── payroll/
└── scaleup/                    ← the other project, its own T00001…
    └── T00001/
        └── specs.md
```

One ticket = one piece of work = one folder = one branch. Every document a workflow skill produces about that work — the spec, the root-cause investigation, the refactor record, the conformance report, the diff review, the design review — lands in the same folder under a fixed name, and `git log` says which ticket produced any given commit.

A ticket does **not** need all six files. A feature ticket may never have an `investigation.md`; a bug ticket usually has no `specs.md`. What is present tells you what has been done.

---

## 1. The format

- `T00001`, `T00002`, `T00003`, … — capital `T`, **no hyphen**, **five digits, zero-padded**.
- Match exactly: `^T[0-9]{5}$`. `T1`, `T-00001`, `t00001`, and `T000001` are all wrong.
- Ticket folders live **one level inside the project folder** — `.agents/specs/subhrms/T00001/`, `.agents/specs/scaleup/T00001/` — as siblings of that project's legacy portal folders. Never at the top of `specs/`, and never nested inside a portal folder.
- **Numbers are scoped per project.** Each project has its own counter and its own `T00001`; the two are unrelated pieces of work. That is deliberate: each project is a separate GitHub repo, so a `T00001` branch is unambiguous in the repo where it is used.
- Because of that scoping, **a ticket number on its own is only meaningful with its project.** Write it as `subhrms T00001` (or with its path) whenever both projects could be meant.
- The number carries no meaning beyond identity. Portal and feature name are recorded **inside** `specs.md`'s header, not in the folder name.

## 2. Allocating a number (the increment)

**Only the skill that *starts* a piece of work allocates.** A workstream's first skill creates the ticket; every later skill resolves the existing one (§4):

| Skill | Allocates a ticket when none exists? |
| :--- | :--- |
| `/webkit.spec` | **Yes** — it starts feature work |
| `/webkit.investigate` | **Yes** — it starts bug / RCA work |
| `/webkit.refactor` | **Yes**, but only for a *standalone* cleanup. Cleaning up a ticket's own implementation belongs in that ticket. |
| `/webkit.verify`, `/webkit.code-review`, `/webkit.design-review`, `/webkit.fix`, the implement skills, `/webkit.migrate` | **No** — they continue existing work. They resolve, and if there is no ticket they say so (§4) rather than inventing one. |

**Resolve the project first.** Run the "Which Project Am I In?" resolution in [project-profile.md](./project-profile.md) and state the answer *before* scanning — a ticket allocated into the wrong project's folder is numbered off the wrong counter and collides with real work there.

Then, from the project root:

```bash
project=subhrms                     # or scaleup — resolved, never assumed

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

- **A ticket already covers this feature** → work in that folder and **update `specs.md` in place** (with the version bump the spec skill defines). Do not allocate a second number for the same feature ([duplicate-prevention.md](./duplicate-prevention.md), [incremental-generation.md](./incremental-generation.md)).
- **The user named a ticket explicitly** (`/webkit.spec T00007 ...`) → use that folder in the resolved project, even if the number is not the highest. Create it only if it is genuinely absent, and say so.
- **Nothing matches** → allocate per §2.

## 4. Finding a ticket from a feature or a path

`/webkit.verify`, `/webkit.code-review`, `/webkit.design-review`, `/webkit.fix`, and the implement skills are usually invoked in a fresh session with only a target path or a feature name. Resolve the ticket, do not ask the user to remember it:

1. If the prompt names a ticket (`T00004`, `F0135`) or a path inside one, use it directly — resolving the project the same way, since `T00004` exists in both. **A ticket passed as a command argument also names a branch that must be fetched and analyzed — see §8.**
2. **The current git branch is often the answer.** `git rev-parse --abbrev-ref HEAD` returning `T00004` (or `T00004-<slug>`) names the ticket outright — see §6.
3. Otherwise `grep -ril '<feature|route|table|module>' .agents/specs/<project> --include='*.md'` — that one command covers the project's ticket folders and its legacy tree. Read the hits like this:

   - **Several hits inside one `T#####/`** are **one ticket**, not three — `verify.md` and `code-review.md` naturally mention the same feature as their `specs.md`. Collapse to the folder (`… | sed 's#/[^/]*$##' | sort -u` if you want that done for you).
   - **A hit in the legacy tree** (`specs/<project>/<portal>/<feature>.md`) is the spec file itself; its folder is a portal holding many specs, so do not treat the folder as a ticket.
   - Confirm with the `> **Ticket:**` / `> **Portal:**` header of each candidate before committing to one.
4. Still nothing → **this work has no ticket yet.** Say so plainly. If you are an allocating skill (§2), allocate one now. If you are not, do **not** invent a ticket to have somewhere to write: `/webkit.verify` stops (there is no spec to verify against); `/webkit.code-review`, `/webkit.design-review`, and `/webkit.fix` continue and write to `.agents/reports/` instead (§5).
5. Report which ticket you resolved to, and on what evidence, in your first message. A skill that silently verifies against the wrong ticket is worse than one that stops.

## 5. The file contract

| File | Written by | Overwrite behaviour on re-run |
| :--- | :--- | :--- |
| `specs.md` | `/webkit.spec` | Update in place; bump the `> **Version:**` line and append the superseded line to the changelog. |
| `investigation.md` | `/webkit.investigate` | Update in place; bump `> **Run:**` and append the superseded line to the run history. Its implementation-plan checkboxes are ticked by the skills that act on it. |
| `refactor.md` | `/webkit.refactor` | Append-or-update; bump `> **Run:**` so successive cleanups on one ticket each leave a line, and append the superseded line to the run history. |
| `verify.md` | `/webkit.verify` | Overwrite with the latest run; bump `> **Run:**` and append the superseded line to the run history. |
| `code-review.md` | `/webkit.code-review` | Overwrite with the latest run; bump `> **Run:**` and append the superseded line to the run history. |
| `design-review.md` | `/webkit.design-review` | Overwrite with the latest run; bump `> **Run:**` and append the superseded line to the run history. |

- **These six filenames are fixed.** No dates, no feature names, no portal prefixes in the filename — `verify-20260907.md`, `specs-payroll.md`, `investigation-tk-late-log.md`, and `code_review.md` are all wrong. History lives *inside* the file, in its version/run lines, so a stale link never points at a file that no longer exists.
- Every one of the six carries `> **Ticket:** <project> T#####` in its header block, so a document that gets copied or pasted elsewhere still names its own ticket and project.
- A ticket folder holding only `specs.md` — or only `investigation.md` — is normal. It just means the work has not reached the other steps yet.
- **One workstream per ticket.** If an investigation turns up a *second, unrelated* defect, that is a second ticket with its own `investigation.md` — not a second investigation file crammed into this folder.
- **The fixed filenames only work inside a ticket folder.** A legacy spec in a portal folder (§7) shares that folder with other specs, so `verify.md` there would collide between features — reports for legacy specs keep the old dated `.agents/reports/<domain>-<feature>-{verify,review,design-review}-<YYYYMMDD>.md` path until the spec is migrated to a ticket.
- A diff review for a change with **no spec at all** likewise goes to `.agents/reports/<scope>-review-<YYYYMMDD>.md`. `/webkit.code-review` runs without a spec by design; it never allocates a ticket to have somewhere to write.
- Nothing outside these six filenames belongs in a ticket folder.
- [`.agents/reports/`](../reports/) is now only the **fallback and the archive**: investigations written before this convention live there and stay valid, and the two unticketed cases above still land there. New ticketed work does not add to it.

### Run-history block

`investigation.md`, `refactor.md`, `verify.md`, `code-review.md`, and `design-review.md` all end with:

```markdown
<!-- Run history -->
- v1 — 2026-09-07 — initial verification, 3 findings (2 HIGH)
```

Same discipline as spec versioning: increment the run, date it, one line on what changed since the previous run, and append the superseded line rather than deleting it. Overwriting a report while leaving its `> **Run:**` line untouched destroys the only record that an earlier run disagreed.

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
- **`/webkit.investigate` allocates a ticket but creates no branch.** It writes no application code, so there is nothing to isolate; the branch appears when `/webkit.fix` or an implement skill picks the ticket up.
- **Work with genuinely no ticket** keeps the categorised form from [git-workflow.md](./git-workflow.md) Rule 1: `bugfix/<domain>-<feature-kebab>`, `refactor/…`, `hotfix/…`.
- The ticket number goes in the **PR title** (`T00001 — Loan amortization schedule`) with the spec path in the body. Commit messages keep plain Conventional Commits — the branch already carries the ticket, so `feat(payroll): …` needs no ticket prefix.
- The [Mandatory Branch Gate](./git-workflow.md#mandatory-branch-gate-for-implementing-skills) is what enforces this, and it is blocking. Creating the branch is compliance, not a decision that needs approval.

> [!IMPORTANT]
> Numbers are per project (§1), so the same `T00001` branch name can exist in both repos for unrelated work. That is fine — each branch lives in its own repo. It does mean **never assume a `T00001` branch in one repo has anything to do with `T00001` in the other.**

## 7. Legacy path-based specs

Specs written before this convention live at `.agents/specs/<project>/<portal>/<feature>.md`, with their reports at `.agents/reports/<domain>-<feature>-{verify,review}-<date>.md`. They are **still valid and still the source of truth for their features**:

- **Read them.** Spec discovery must search the project's ticket folders *and* its legacy portal folders.
- **Do not bulk-migrate them.** Moving a spec breaks every report, commit message, branch, and chat reference that points at its path.
- **Migrate one only when you are already editing it,** and only if the user asks: allocate a ticket per §2, move the spec to `<project>/T#####/specs.md`, move its newest reports to `verify.md` / `code-review.md` / `investigation.md`, and note the old path in the changelog line so the trail survives.
- New work always gets a ticket folder.

## 8. Resolving a ticket ARGUMENT to its branch

When a skill is invoked as `/webkit.fix F0135`, `/webkit.frontend-implement T00004`, or `/webkit.code-review F0148`, **the ticket is not just a folder to open.** It names the **branch that holds the work**, and that branch — not the working tree you happen to be sitting on — is what gets analyzed.

> [!CAUTION]
> Opening `.agents/specs/<project>/T#####/` and starting to edit, without ever fetching the ticket's branch, is the failure this section exists to stop. The spec says what was *intended*; the branch holds what was actually *built*. A fix written against the wrong tree does not apply.

### 8.1 Two ticket formats, both real

| Format | Origin | Example | Match |
| :--- | :--- | :--- | :--- |
| `F####` | The team's ticket system. **The dominant convention on the GitHub remote** — `F0004` … `F0174` and growing. | `F0135` | `^[Ff][0-9]{4}` |
| `T#####` | Allocated by `/webkit.spec`, `/webkit.investigate`, `/webkit.refactor` (§2) | `T00004` | `^T[0-9]{5}$` |

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

**Step 5 — Then check out, under the [Mandatory Branch Gate](./git-workflow.md#mandatory-branch-gate-for-implementing-skills).**

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

`/webkit.code-review`, `/webkit.verify`, `/webkit.design-review`, and `/webkit.document` write no application code, so they **analyze the branch without checking it out** — Steps 1–4 only. Switching the user's working tree to run a review is a side effect nobody asked for.

Their report still records which branch was analyzed, in the `> **Scope:**` header line.

### 8.4 Where the report goes

Unchanged from §5, with one addition: a `F####` ticket normally has no ticket folder, so its reports go to **`.agents/reports/<scope>-<kind>-<YYYYMMDD>.md`**. Name the branch in the report header so the trail survives.

If an `F####` ticket *does* have a matching `T#####` folder (the work was specced here and branched there), write to the ticket folder as normal and record both identifiers in the header.
