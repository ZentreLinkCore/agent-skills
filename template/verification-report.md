# Webkit Verification Report

<!--
TEMPLATE: verification-report (used by /webkit-verify)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3. Template-specific:
1. Only actual issues, each with evidence: file:line, command output, or the code path traced. No opinions.
2. Finding numbers are unique across BLOCKER and REQUIRED FIX (#1, #2, … continuing from one category into the
   next), so "Finding #3" always names one issue.
3. Every FAIL in §2, §4, and §5 names the finding in §3 that explains it.
4. Every BLOCKER, REQUIRED FIX, and IMPROVEMENT ends with "- **Resolution:** Open". /webkit-fix replaces that line
   when it handles the finding (✅ FIXED / ✅ FIXED (traced) / ✅ ALREADY RESOLVED / ❌ NOT FIXED, with evidence)
   and recomputes §1, §2, §4, §5, §8 and the Verification Run row as a fix pass (vN.k). See
   .agents/rules/conditional/ticket-numbering.md §5 "Fix pass".
5. A scoped run (/webkit-verify T##### <ids>) updates this file in place: §1, §8, the scoped rows of §2, §4, §5, §6,
   and the scoped findings. Everything else stays as the previous run left it. See /webkit-verify "Scoped Run".
-->

## Metadata

<!-- Link the spec by its real file name: spec.md, or specs.md on tickets created before /webkit-specify.
     A legacy portal spec (report in .agents/reports/): link it as ../specs/<project>/<portal>/<feature>.md,
     with its v<N> header as the version, and set Ticket to "None — legacy portal spec". -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Branch | {{branch}} (base `{{base}}`, {{n}} commits, {{m}} files changed) |
| Specification File | [spec.md](./spec.md) — version {{x.y}}, status {{SPEC_STATUS}} |
| Verification Date | {{YYYY-MM-DD}} |
| Verification Run | v{{N}} — {{what changed since the previous run, or "initial"; a scoped run: "scoped: <ids>; rest as graded in v<M>"}} |

**Implementation Scope**

<!-- API routes and request/response changes go under Backend; configuration, environment, and tests under Other. -->

- **Frontend:** {{changed pages / components / stores, or "None"}}
- **Backend:** {{changed controllers / classes / routes, or "None"}}
- **Database:** {{migrations / tables / columns, or "None"}}
- **Other:** {{config, environment, tests, scripts, or "None"}}

---

## 1. Verification Summary

### Overall Status

<!-- Choose one, from §3 (full rule: /webkit-verify Phase 5): any BLOCKER → ❌ FAILED · else any REQUIRED FIX
     → ⚠ PASS WITH FIXES · else, every AC MET or UNVERIFIED with its §6 check → ✅ PASS, written
     "✅ PASS (n AC pending manual check)" while any is UNVERIFIED. A scoped run appends "(scoped: <ids>)", a /webkit-fix
     pass "(after fix pass vN.k)". -->

{{✅ PASS | ⚠ PASS WITH FIXES | ❌ FAILED}}

### Summary

{{One to three sentences: how closely the implementation follows the specification, and what must change before merge. Example: "The implementation mostly follows the specification. Two required validation rules are missing and must be fixed before merge."}}

---

## 2. Specification Compliance

<!-- Review every major section. An area is FAIL when any BLOCKER or REQUIRED FIX references it.
     Acceptance Criteria notes give the count, then each AC not met (with its finding) and each AC verified only
     by hand (with its §6 scenario). -->

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | {{PASS / FAIL}} | {{explanation}} |
| User Flow | {{PASS / FAIL}} | {{explanation}} |
| Functional Requirements | {{PASS / FAIL}} | {{explanation}} |
| Non-functional Requirements | {{PASS / FAIL}} | {{explanation}} |
| Technical Design | {{PASS / FAIL}} | {{explanation}} |
| Acceptance Criteria | {{PASS / FAIL}} | {{n}}/{{total}} met. {{Not met: AC-xx (Finding #n). Manual: AC-xx (§6).}} |
| Edge Cases | {{PASS / FAIL}} | {{explanation}} |
| Security Requirements | {{PASS / FAIL}} | {{explanation}} |

---

## 3. Findings

<!-- Only actual issues. No opinions. Within each category, list in fix order (dependency-first). -->

### BLOCKER

<!-- Issues that prevent release or can cause serious problems: the feature does not work, a security
     vulnerability, a data corruption risk. A blocker the spec never mentions still counts; its
     Specification Reference is "N/A — release blocker (<reason>)". -->

#### Finding #1

- **Category:** BLOCKER
- **Location:** {{`path/to/file.php:42`, component, API, or table}}
- **Specification Reference:** {{section name and id, e.g. "§10 Acceptance Criteria — AC-03"}}
- **Problem:** {{what is wrong: inputs or state → wrong outcome}}
- **Expected Behavior:** {{what the specification requires}}
- **Actual Behavior:** {{what the implementation does, with evidence}}
- **Impact:** {{why this matters}}
- **Required Action:** {{exact fix: file, construct, and what it becomes}}
- **Resolution:** Open

### REQUIRED FIX

<!-- The implementation does not fully satisfy the specification. Fix the implementation, not the spec.
     Numbering continues from BLOCKER. -->

#### Finding #2

- **Category:** REQUIRED FIX
- **Location:** {{`path/to/file.php:42`, component, API, or table}}
- **Specification Reference:** {{section name and id}}
- **Problem:** {{what is wrong: inputs or state → wrong outcome}}
- **Expected:** {{what the specification requires}}
- **Actual:** {{what the implementation does, with evidence}}
- **Required Action:** {{exact fix: file, construct, and what it becomes}}
- **Resolution:** Open

### IMPROVEMENT

<!-- Optional suggestions. They do not block merge and do not require a spec update. -->

#### Improvement #1

- **Area:** {{area}}
- **Current Situation:** {{what exists now}}
- **Suggestion:** {{the change}}
- **Reason:** {{why it is worth doing}}
- **Resolution:** Open

### OUT OF SCOPE

<!-- Suggestions that are not part of the current ticket. Never part of the required fixes; never a spec update. -->

#### Suggestion #1

- **Suggestion:** {{suggestion}}
- **Reason Not Included:** {{why it is outside the current specification}}
- **Future Consideration:** {{when or where it could be picked up, e.g. a separate ticket}}

---

## 4. Security Review

<!-- PASS / FAIL per check; N/A only with a reason. Every FAIL is a finding in §3. -->

| Check | Status |
| --- | --- |
| Authentication | {{PASS / FAIL}} |
| Authorization | {{PASS / FAIL}} |
| Input Validation | {{PASS / FAIL}} |
| Data Exposure | {{PASS / FAIL}} |
| API Security | {{PASS / FAIL}} |

**Issues:** {{"Finding #n — <one line>" per issue, or "No security issues found."}}

---

## 5. Performance Review

<!-- PASS / FAIL per check; N/A only with a reason. Every FAIL is a finding in §3. -->

| Check | Status |
| --- | --- |
| Database Queries | {{PASS / FAIL}} |
| API Performance | {{PASS / FAIL}} |
| Frontend Performance | {{PASS / FAIL}} |
| Resource Usage | {{PASS / FAIL}} |

**Issues:** {{"Finding #n" or "Improvement #n — <one line>" per issue, or "No performance concerns found."}}

---

## 6. Testing Review

### Existing Tests

- **Status:** {{passing / failing / not run — with the command used}}
- **Implemented:** {{YES / NO}}
- **Coverage:** {{which FR / AC the tests cover, and which have none}}

### Manual Verification

<!-- One row per scenario checked by hand, plus one per AC that could not be verified automatically.
     Use "Not run — <reason>" when a scenario still needs a person to run it. -->

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| {{AC-xx: steps}} | {{expected result}} | {{observed result}} | {{PASS / FAIL / Not run — reason}} |

---

## 7. Specification Impact Decision

<!-- Mandatory. Keep exactly one of the two options below and delete the other (full rule: /webkit-verify Spec Update Rules).
     SPEC UPDATE REQUIRED only for Case 1 (spec error: conflicts with a business rule, impossible, or self-contradictory
     → corrected in place by /webkit-verify, Minor, no new version) or Case 2 (approved requirement change → new spec
     version via /webkit-specify, Major). Bug fixes never change the spec. -->

### NO SPEC CHANGE REQUIRED

**Reason:** {{e.g. "All findings are implementation issues and do not change the original requirements."}}

### SPEC UPDATE REQUIRED

**Reason:** {{Case 1 or Case 2, and why. e.g. "The original requirement conflicts with the approved business rule."}}

**Changed Sections:**

- {{section name}} — {{reason}}

**Applied:** {{Case 1: "Yes — spec §16 Minor row <YYYY-MM-DD>; plan revision <n> (or 'plan unaffected')" · Case 2: "No — a requirement change needs stakeholder approval: /webkit-specify"}}

---

## 8. Final Recommendation

<!-- Keep exactly one option. READY FOR MERGE only when there is no BLOCKER and no REQUIRED FIX, and never from a
     scoped run: FULL VERIFY BEFORE MERGE instead. -->

### READY FOR MERGE

**Conditions:**

- No blockers
- No required fixes

### FIX REQUIRED BEFORE MERGE

**Required fixes:**

1. {{Finding #n — one-line action}}
2. {{Finding #n — one-line action}}

### FULL VERIFY BEFORE MERGE

**Reason:** Scoped run v{{N}} covered {{ids}} and nothing required is open; the rest of the spec was last graded in v{{M}}. Run `/webkit-verify {{T#####}}` before merge.

<!-- Run history -->
