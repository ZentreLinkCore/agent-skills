# Versioning — Semantic Version Detection and Bump

After an implementation is complete, decide whether the app's version must change, by how much, and — when the project allows it — make the change and record it in the CHANGELOG. Versions follow [SemVer 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH`.

Run as the last phase of `/webkit-implement` and `/webkit-fix`. The procedure is tool-neutral; another skill adopts it by linking this file.

---

## 1. Configuration

Per-project settings live in **`.agents/config/<project>.yml`**, where `<project>` is the same lower-case folder name used under `.agents/specs/`.

```yaml
versioning:
  mode: recommend            # auto | recommend | off
  targets:                   # one entry per independently versioned app
    - name: mobapp
      repo: mobapp           # directory holding the app's git repo (git -C <repo> ...)
      paths: [mobapp/]       # a change under these paths is a change to this app
      ignore_paths: [mobapp/android/, mobapp/ios/]   # generated or irrelevant; never counted, never edited
      version:               # every file that carries the semantic version; kept identical
        - { file: mobapp/app.json, key: expo.version }
        - { file: mobapp/package.json, key: version }
      build_numbers:         # integers raised by 1 on every bump
        - { file: mobapp/app.json, key: expo.android.versionCode, type: integer, create_if_missing: true, initial: 1 }
      changelog: mobapp/CHANGELOG.md
      warnings: []           # printed whenever this target is bumped
      after_release: []      # manual steps printed with every bump (server config, store listing)
```

| `versioning.mode` | Behavior |
| --- | --- |
| `auto` | Detect, then **edit** the version files, build numbers, and CHANGELOG. |
| `recommend` | Detect, then **report** the recommended version and the exact edits. No file is changed. |
| `off` | Skip versioning entirely. The summary says `Versioning: off`. |

**No config file, or no `versioning` key** → mode `recommend`, and discover targets instead of reading them: the version in `app.json` (`expo.version`), `package.json` (`version`), and `composer.json` (`version`, if present) at each app root, plus native files only when their folder is tracked by git (`android/app/build.gradle` `versionName` / `versionCode`; `ios/*/Info.plist` `CFBundleShortVersionString` / `CFBundleVersion`). Discovered targets are reported, never edited: `auto` requires the files to be declared.

---

## 2. Detect the change

Per target, independently.

**Step 1 — Find the base.** The base is where this work branched from, in the target's own repo:

```bash
repo="<target.repo>"
base=$(git -C "$repo" merge-base HEAD origin/main 2>/dev/null || git -C "$repo" merge-base HEAD main)
```

On `main` itself the merge base is `HEAD`, so only uncommitted work counts — which is correct.

**Step 2 — List what changed** since the base, committed or not, tracked or new:

```bash
git -C "$repo" diff --name-only "$base"            # committed on the branch + uncommitted edits
git -C "$repo" ls-files --others --exclude-standard # new, untracked files
```

Config paths are relative to the workspace root; git prints them relative to the repo, so prefix each with `<repo>/` before matching (`app.json` → `mobapp/app.json`). Keep the files under `paths`; drop `ignore_paths`, the `changelog` file, and any version file whose **only** difference is its version or build-number keys. A version file with other changes (new permissions in `app.json`, a new dependency in `package.json`) still counts.

**Nothing left → `NONE`** for this target. A backend-only ticket does not bump the mobile app.

**Step 3 — Classify.** Read the intent from the ticket's documents — the spec, and for a fix the report being applied (`investigation.md`, `verify.md`, `code-review.md`, `design-review.md`, `refactor.md`) — and the reach from the diff in Step 2. The level describes **everything on the branch since the base**, not only the latest run: the highest level with evidence wins.

| Level | When | Typical evidence |
| --- | --- | --- |
| **MAJOR** | Users or older clients lose something they rely on. | Spec states a breaking change (§8 contract, §14, §16 `Major`); an endpoint, response field, deep link, or stored-data format older app versions use is removed or renamed; the server's minimum supported app version has to rise; a user-facing feature is removed. |
| **MINOR** | A new capability, backward-compatible. | A feature spec (new `FR-xx`, §16 `Initial`); a new screen, route, endpoint the app calls, setting, or OS permission. |
| **PATCH** | Existing behavior corrected; nothing new. | A bug-fix spec or `investigation.md`; performance, security, or crash fixes; a dependency patch with no API change. |
| **NONE** | Nothing a user of the app can notice. | Only refactors, tests, docs, comments, tooling, CI, or `ignore_paths` changed. A refactor or docs ticket never bumps unless the user asks. |

Record the evidence: the spec IDs and the changed files that decided the level.

**When the evidence does not settle it** (the spec says fix but the diff adds a screen; a contract change might or might not break old clients): pick the higher level, **report it as `recommend` for this run even in `auto` mode**, and state the one question that would settle it.

**MAJOR is applied automatically only when the spec itself declares the breaking change.** A MAJOR inferred from the diff alone is always `recommend`: a major version is a product decision.

**Step 4 — Fixes: did the defect ship?** A fix is a PATCH only when the defect exists in the **base**, i.e. in a version users have. When `/webkit-fix` corrects code that was added on this same branch (a review finding on a feature that has not merged yet), the defect never shipped: it adds **no** level of its own, and the branch keeps the level its earlier work earned — a feature branch with review fixes is still one MINOR, never MINOR plus PATCH. Check it per fixed file:

```bash
git -C "$repo" diff "$base" -- <file relative to the repo>   # the fixed lines among the "+" lines → added on this branch → never shipped
```

A file absent at the base never shipped. A `--refactor` regression restore follows the same test: the regression is a PATCH only if it was in the base.

---

## 3. Compute the next version

Read the current version **from the base**, never from the working tree: `git -C "$repo" show "$base:<file relative to the repo>"` (`git -C mobapp show "$base:app.json"`). A new file with no base version: use its working-tree value.

| Level | `X.Y.Z` → | While `X` is `0` |
| --- | --- | --- |
| MAJOR | `(X+1).0.0` | `0.(Y+1).0` — pre-1.0, a breaking change is a minor bump |
| MINOR | `X.(Y+1).0` | `0.(Y+1).0` |
| PATCH | `X.Y.(Z+1)` | `0.Y.(Z+1)` |
| NONE | unchanged | unchanged |

Build numbers: base value + 1. A missing key counts as `initial` (the value builds have been using); written only when `create_if_missing: true`, otherwise reported.

**Stop and recommend only** (no edits, whatever the mode) when:

- the `version` files disagree with each other at the base — report each value;
- the base version has a pre-release or build suffix (`1.4.0-beta.2`, `1.4.0+7`);
- the file is not valid JSON / PHP / Gradle after a dry read, or the key is not where the config says.

**Re-runs are idempotent.** The next version is always computed from the base, so running the phase again on the same branch rewrites the same value — it never bumps twice. If the level changed since the last run (a PATCH that became a MINOR), the files are rewritten to the new result.

---

## 4. Apply (`auto` only)

1. Write the new version into **every** `version` entry. Edit only the value: keep key order, indentation, quoting, and line endings.
2. Raise every `build_numbers` entry. `type: string` keeps the value quoted (`"2"`).
3. Write the CHANGELOG entry (§5).
4. Re-read each edited file and confirm it still parses (`node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`, `php -l <file>`).

`recommend` mode does none of this; it prints the edits it would make.

## 5. CHANGELOG entry

[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format. If the file does not exist (`auto`), create it with this header:

```markdown
# Changelog

All notable changes to this app are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).
```

Then add the version section directly below the header, newest first:

```markdown
## [1.1.0] - 2026-10-11

### Added

- Playback continues with the screen locked, with play/pause and skip in the notification (T00007)

### Fixed

- The queue no longer shows songs twice after the app returns from the background (T00008)
```

- **Sections**, only the ones used, in this order: Added (new capability), Changed (existing behavior altered), Deprecated, Removed, Fixed, Security.
- **Entries** describe what a user of this app notices, one line per capability, from the spec's FRs and §1 — not file names, class names, or tasks. Every entry ends with the ticket number.
- **Fixed** lines are only for defects that shipped (§2 Step 4), written from the report's symptom as a user saw it ("Songs no longer play twice after reconnecting"). A fix to unreleased work on the same branch adds no line: users never saw that bug, so the ticket's existing Added / Changed lines stay as they are.
- **Only this target's changes.** Backend-only requirements go in the backend's changelog, if it has one.
- **Idempotent.** If the section for this version already exists, replace this ticket's lines inside it instead of adding a second section; other tickets' lines stay.

---

## 6. Never

- Bump a target whose result is `NONE`, or bump more than once per ticket.
- Commit, tag, push, publish, or run `eas build` / `eas update` / store uploads. Versioning edits files; releasing is the user's call.
- Edit a file under `ignore_paths` or a gitignored generated folder (a prebuilt `android/` or `ios/`); the next prebuild overwrites it.
- Change server-side version gates (the latest or minimum supported app version) automatically. They go in `after_release`; raising a minimum version locks users out.
- Invent a version file or key the config and the discovery list do not name.

---

## 7. Report

The phase ends with one line per target in the implementation summary's **Version** section:

```text
mobapp   MINOR   1.0.0 → 1.1.0 · versionCode 1 → 2   applied (auto)   evidence: FR-01–FR-09 new capability; 14 files under mobapp/
backend  NONE    —                                    no version target
```

Then every `warnings` and `after_release` line of each bumped target, and any recommend-only reason from §2 or §3.

The commit message `/webkit-implement` suggests matches the level: `feat(<scope>): …` for MINOR, `fix(<scope>): …` for PATCH, and `feat(<scope>)!: …` with a `BREAKING CHANGE:` footer for MAJOR ([git-workflow.md](./git-workflow.md)). `/webkit-fix` always suggests `fix(<scope>): …`: the commit type describes that commit, while the level describes the whole branch.

Reviews (`/webkit-verify`, `/webkit-code-review`) treat version files and CHANGELOG edits made by this procedure as expected, not as scope expansion.
