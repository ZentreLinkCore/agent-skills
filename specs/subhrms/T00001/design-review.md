# Design Review: Mobile App Messages module (`mobapp` / employee)

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/design-review.md`; branch `T00001`. Spec: [`specs.md`](specs.md).
> **Project:** **`mobapp` — React Native / Expo.** *Not* SubHRMS-Vue and *not* ScaleUP-React. See §0.
> **Portal:** employee (Golden Chestnut accent)
> **Scope:** `resources/views/mobapp/src/module/employee/messages` — 58 files / 27,959 lines. **13 reviewed in depth** (see §7).
> **Design sources read:** `mobapp/src/theme/index.ts:1-250` (Restyle — authoritative), `mobapp/src/contexts/ThemeContext.tsx:16-148`, `mobapp/src/constants/theme.ts:1-24`, `mobapp/src/app/_layout.tsx:86,137`, `.agents/rules/conditional/ui-design.md` (inherited only — see §0)
> **Run:** v4 — 2026-09-16 — the PARTIAL/DEFERRED items closed out (§10); **D9 was mis-framed and is corrected there.** v3 — 2026-09-16 — §6 Modern Enhancement Ideas E1-E5 applied; **E1's runtime claim was wrong and is corrected** (see §9). v2 — 2026-09-16 — Fix Plan steps 1-9 applied. v1 — 2026-09-15 — initial.
> **Verdict:** v1 **REQUEST CHANGES** (4 HIGH) → **after fixes: all 4 HIGH + 3 MEDIUM + 1 LOW resolved and verified.** D8/D9 deferred (see §8).

---

## 0. Project resolution — the skill's two-project gate does not cover this scope

The [`project-gate.md`](../../../rules/core/project-gate.md) gate resolves the repo to **SubHRMS** (`vue`, `pinia`, `vue-router` in the root `package.json`). That is correct for the repo — **and wrong for this target path.**

`resources/views/mobapp/` is a **third codebase**: a React Native / Expo app with its own `package.json` (`expo ~57.0.20`, `react-native 0.86.3`, `react 19.2.3`, `@shopify/restyle`, `lucide-react-native`), its own `.git`, its own `tsconfig.json` and its own `AGENTS.md`.

Consequences that change the whole review, and that a default reading of this skill would have got wrong:

| Skill assumes | Reality in `mobapp` |
| :--- | :--- |
| `resources/css/theme.css` `@theme` tokens | **Not loaded.** Tokens are a `createTheme({...})` object in `src/theme/index.ts` |
| Tailwind utility classes, `dark:` variants | **No Tailwind at all.** Restyle props + `StyleSheet.create` |
| Dark mode via `@custom-variant dark` class | Provider swap — `_layout.tsx:137` picks `restyleDarkTheme` vs `restyleTheme` |
| `.card` / `.btn-primary` / `.badge-employee` classes | Do not exist. `Box`/`Text` Restyle primitives + `variant=` |
| Globally registered `Spinner`, `EmptyState`, `StatusBadge` | Vue-only; irrelevant here |
| Drag-to-scroll tables, statutory-ID columns | Web-only mandates; no tables in this module |

**`ui-design.md` applies only by inheritance.** `ThemeContext.tsx:41` states the module accents are *"from theme.css"*, and the values match — so the portal accent set is shared, but every enforcement mechanism in that rule is web-specific. I graded against the **Restyle theme object**, which is what this code actually resolves at runtime, and used `ui-design.md` only for the Employee-accent contrast principle.

---

## 1. Fit Summary

This module is **more disciplined than its raw hardcoded-color count suggests**. 279 `isDark ? … : …` ternaries show real, deliberate dark-mode work, and the mention-pill treatment in [`MessageContent.tsx:76-88`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx#L76-L88) is genuinely well done — every one of its four states passes WCAG AA, and it reaches for the accessible `#9C5A22` shade unprompted.

The real problem is not carelessness, it is **hand-reimplementation**: the module rebuilds the theme inline instead of reading it, and in doing so lands on accent shades that fail contrast. The single worst defect is `color="textMuted"` — **125 text elements at 2.45–2.56:1 in light mode**, roughly half the AA threshold. The theme already ships the fix (`textSecondary`, 4.76:1) and the module already uses it 41 times elsewhere.

| Severity | Count | Fix before |
| :--- | :---: | :--- |
| CRITICAL | 0 | anything ships |
| HIGH | 4 | merge |
| MEDIUM | 4 | end of milestone |
| LOW | 2 | — |

All contrast ratios below were **computed** from the literal token values (WCAG 2.1 relative-luminance), not eyeballed. Translucent pills are composited over their real parent surface first.

---

## 2. Fit Findings

### D1 — `color="textMuted"` fails WCAG AA across 125 text elements (light mode) · `HIGH` · `contrast`

- **Location:** 125 sites module-wide. Representative: [`MessageHeader.tsx:65`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageHeader.tsx#L65), [`ColleagueProfileModal.tsx:285`](../../../resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileModal.tsx#L285), [`ChatToolsDrawer.tsx:328`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx#L328)
- **Problem:** `textMuted` is `#94A3B8` in **both** palettes (`theme/index.ts:20` light, `:184` dark). That value is tuned for dark surfaces; on light surfaces it collapses.
- **Measured:**

  | Surface | Ratio | AA (4.5:1) |
  | :--- | ---: | :--- |
  | `#FFFFFF` card (light) | **2.56:1** | ✗ |
  | `#F8FAFC` background (light) | **2.45:1** | ✗ |
  | `#F1F5F9` cardAlt (light) | **2.34:1** | ✗ |
  | `#1E293B` card (dark) | 5.71:1 | ✓ |

- **What the user sees:** In light mode, every timestamp, metadata label, field caption and helper line in the messages UI renders as pale grey-blue on near-white — legible in a dark room on a good screen, and effectively gone in sunlight or for low-vision users. Dark mode is fine, which is exactly why this survives review.
- **Authority:** WCAG 2.1 AA §1.4.3; `theme/index.ts:20`
- **Fix:** swap the prop at the 125 call sites — the token it should point at already exists and is already used 41× in this module:
  ```diff
  - <Text variant="caption" fontSize={11} color="textMuted">
  + <Text variant="caption" fontSize={11} color="textSecondary">
  ```
  `textSecondary` = `#64748B` light (**4.76:1** ✓) / `#CBD5E1` dark (**9.85:1** ✓) — correct in both modes.
  **Preferred alternative (1 line, fixes every consumer app-wide):** darken the light token itself at `theme/index.ts:20` to `'#64748B'`. See **DR3** — this is really a token defect.
- **Effort:** `trivial` (token) / `small` (125 call sites)

---

### D2 — `color="primary"` as text fails WCAG AA · `HIGH` · `contrast`

- **Location:** 23 sites, all on `<Text>`. E.g. [`ChatToolsDrawer.tsx:353`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx#L353), [`ColleagueProfileModal.tsx:218`](../../../resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileModal.tsx#L218), [`ForwardMessageModal.tsx:433`](../../../resources/views/mobapp/src/module/employee/messages/components/ForwardMessageModal.tsx#L433)
- **Problem:** `primary` is `#CB793A` (`theme/index.ts:24`) — the Employee Golden Chestnut. It is a *fill and border* colour, not a text colour. This is the same documented failure `ui-design.md` records for the web theme, reproduced here.
- **Measured:** `#CB793A` on `#FFFFFF` = **3.31:1** ✗ (fails AA for normal text; several sites are `fontSize={9}`–`{11}`, so the large-text 3:1 allowance does not apply).
- **What the user sees:** Accent-coloured labels — "Forward", section headings, profile role lines — wash out against white cards in light mode.
- **Authority:** WCAG 2.1 AA §1.4.3; [`ui-design.md`](../../../rules/conditional/ui-design.md) Employee-accent contrast rule; `theme/index.ts:24-25`
- **Fix:** use the accessible sibling, which **auto-flips per mode** and needs no ternary:
  ```diff
  - <Text fontSize={13} fontWeight="600" color="primary">
  + <Text fontSize={13} fontWeight="600" color="primaryDark">
  ```
  `primaryDark` = `#9C5A22` light (**5.39:1** ✓, `theme/index.ts:25`) / `#E2A35A` dark (**7.75:1** ✓, `:189`).
  Leave `primary` as-is wherever it is a **border, icon, gradient stop or fill** — that usage is correct and is not flagged.
- **Effort:** `small`

---

### D3 — Active-tab badge count is unreadable, and the correct colour is dead code · `HIGH` · `contrast`

- **Location:** [`MessagesScreen.tsx:1097-1100`](../../../resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx#L1097-L1100)
- **Problem:** the badge pill is forced to `#FFFFFF` when active (`:1088`), and the count text is set to `colors.moduleEmployee || '#9C5A22'`. `colors` comes from `useAppTheme()` (`:162`), where `moduleEmployee` is **always a non-empty string** — so `|| '#9C5A22'` **can never fire**. The author wrote the accessible value and it is unreachable.
- **Measured** (text is `fontSize={9.5}` bold on a white pill — AA needs 4.5:1):

  | Mode | Resolved colour | Ratio | |
  | :--- | :--- | ---: | :--- |
  | Light | `#CB793A` | **3.31:1** | ✗ |
  | Dark | `#E2A35A` | **2.18:1** | ✗✗ |
  | *(dead fallback)* | `#9C5A22` | 5.39:1 | ✓ |

- **What the user sees:** the unread count inside the selected filter tab is a faint tan smudge on a white pill. **Dark mode is materially worse** (2.18:1) because the pill stays white while the accent brightens — and dark mode is the mode a developer checking light mode never sees.
- **Authority:** WCAG 2.1 AA §1.4.3; `ThemeContext.tsx:82,126`
- **Fix:** the pill is white in both modes, so the text must be the dark shade in both modes — drop the dead `||` and pin it:
  ```diff
  - color: isActive
  -   ? colors.moduleEmployee || '#9C5A22'
  -   : '#FFFFFF',
  + color: isActive
  +   ? colors.primaryStrong        // #9C5A22 light … see note
  +   : '#FFFFFF',
  ```
  ⚠️ `colors.primaryStrong` is `#9C5A22` in light but `#E2A35A` in dark (`ThemeContext.tsx:84`), which would re-break dark mode. Since the background is unconditionally white, the correct fix is the **literal**:
  ```diff
  + color: isActive ? '#9C5A22' : '#FFFFFF',
  ```
  — or, better, stop forcing the pill white and use `backgroundColor: theme.colors.primaryDark` + `color="textInverse"` (white on `#9C5A22` = 5.39:1 ✓, correct in both modes).
- **Effort:** `trivial`

---

### D4 — Application status pills have no dark-mode variant · `HIGH` *(escalated from MEDIUM — dark-mode only)* · `dark-mode`

- **Location:** [`MessageBubbleGroup.tsx:933-947`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageBubbleGroup.tsx#L933-L947)
- **Problem:** this is the one block in the module with **no `isDark` guard at all**. Approved / declined / pending pills are hardcoded to light-mode pastels:
  ```js
  if (isApproved) { statusBg = '#DCFCE7'; statusTextColor = '#15803D'; statusBorderColor = '#86EFAC'; }
  ```
  Every other semantic tint in this module is correctly paired — compare [`ChatInputBar.tsx:718-719, 748-749, 775-776`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatInputBar.tsx#L718-L719). This block was missed.
- **What the user sees:** in dark mode, a received application-request bubble sits on `backgroundSecondary` (`#0d1b3d`), and the status pill renders as a **glaring pale-mint / pale-pink / pale-amber patch at 15.4:1 against its own card** — a light-mode artefact punched into a dark bubble. Text inside the pill stays readable; the pill itself is the defect.
- **Authority:** `theme/index.ts:47-60` (light) and `:210-227` (dark) — paired `successBg`/`successText`/`successBorder`, `dangerBg`/…, `warningBg`/… exist precisely for this and are unused here.
- **Fix:** read the theme instead of hardcoding — the tokens already flip per mode:
  ```diff
  + const { colors } = theme; // Restyle theme already in scope at :183
    if (isApproved) {
  -   statusBg = '#DCFCE7'; statusTextColor = '#15803D'; statusBorderColor = '#86EFAC';
  +   statusBg = colors.successBg; statusTextColor = colors.successText; statusBorderColor = colors.successBorder;
    } else if (isDeclined) {
  -   statusBg = '#FEE2E2'; statusTextColor = '#B91C1C'; statusBorderColor = '#FCA5A5';
  +   statusBg = colors.dangerBg; statusTextColor = colors.dangerText; statusBorderColor = colors.dangerBorder;
    } else if (isPending) {
  -   statusBg = '#FEF3C7'; statusTextColor = '#B45309'; statusBorderColor = '#FCD34D';
  +   statusBg = colors.warningBg; statusTextColor = colors.warningText; statusBorderColor = colors.warningBorder;
    }
  ```
  The light values above are near-identical to the light tokens, so light mode is visually unchanged; dark mode gains the translucent variants.
- **Effort:** `trivial`

---

### D5 — "Official" announcement badge at 1.89:1 · `MEDIUM` · `contrast`

- **Location:** [`ConversationListItem.tsx:131-133`](../../../resources/views/mobapp/src/module/employee/messages/components/ConversationListItem.tsx#L131-L133)
- **Problem:** `color="warning"` (`#F59E0B`, `theme/index.ts:52`) on an `rgba(217,119,6,0.12)` tint, at `fontSize={9.5}`.
- **Measured:** composited over a white card the pill is `#FAEFE1`; `#F59E0B` on it = **1.89:1** ✗ — the worst single ratio found. Dark mode composites to `#343235` and passes at 5.91:1.
- **What the user sees:** in light mode the "Official" label on announcement channels is amber-on-amber and is essentially a coloured smudge.
- **Authority:** WCAG 2.1 AA §1.4.3; `theme/index.ts:52,55`
- **Fix:** `color="warning"` → `color="warningText"` (`#B45309` light / `#FCD34D` dark, `:55` / `:219`).
  **Honest caveat:** that lands at **4.42:1** — a 2.3× improvement but still 0.08 short of AA. To actually clear 4.5:1, also drop the pill tint to `rgba(217,119,6,0.08)`, or darken `warningText` to `#9A4C09` (4.87:1 on the current tint). Graded MEDIUM rather than HIGH because it is one decorative badge, not body copy.
- **Effort:** `trivial`

---

### D6 — The theme object is reimplemented by hand 34 times · `MEDIUM` · `duplication`

- **Location:** module-wide. Highest concentration: [`ChatInputBar.tsx:280`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatInputBar.tsx#L280), [`ChatToolsDrawer.tsx:161`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx#L161), [`MessageActionModal.tsx:81`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageActionModal.tsx#L81), [`EmojiPickerPanel.tsx:141`](../../../resources/views/mobapp/src/module/employee/messages/components/EmojiPickerPanel.tsx#L141), [`GifPickerPanel.tsx:75`](../../../resources/views/mobapp/src/module/employee/messages/components/GifPickerPanel.tsx#L75), [`ChatAudioBubble.tsx:244`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatAudioBubble.tsx#L244), [`ForwardMessageModal.tsx:183`](../../../resources/views/mobapp/src/module/employee/messages/components/ForwardMessageModal.tsx#L183)
- **Problem:** 34 ternaries resolve to **byte-identical values to an existing token pair**:

  | Inline ternary | Identical to | Hits |
  | :--- | :--- | ---: |
  | `isDark ? '#1E293B' : '#FFFFFF'` | `theme.colors.card` (`:9` / `:173`) | 15 |
  | `isDark ? '#E2A35A' : '#CB793A'` | `theme.colors.primary` (`:24` / `:188`) | 12 |
  | `isDark ? '#334155' : '#E2E8F0'` | `theme.colors.border` (`:12` / `:176`) | 5 |
  | `isDark ? '#F8FAFC' : '#0F172A'` | `theme.colors.text` (`:17` / `:181`) | 2 |

  Eight files open with the same line: `const primaryAccent = isDark ? '#E2A35A' : '#CB793A';` — which is `theme.colors.primary`, already destructured in most of those files.
- **What the user sees:** nothing today — the values are correct. This is a **drift bomb**: the first rebrand or accent tweak updates `theme/index.ts` and silently leaves 34 sites on the old palette, producing a half-restyled app. It also forces `useAppTheme()` to be imported purely to obtain `isDark`, coupling components to a second theme system they otherwise don't need (**DR1**).
- **Authority:** [`system-awareness.md`](../../../rules/conditional/system-awareness.md); `theme/index.ts:9,12,17,24,173,176,181,188`
- **Fix:**
  ```diff
  - const { isDark } = useAppTheme();
  - const primaryAccent = isDark ? '#E2A35A' : '#CB793A';
  + const theme = useTheme();
  + const primaryAccent = theme.colors.primary;
  ```
  Mechanical and individually verifiable — each of the four patterns is a literal find/replace.
- **Effort:** `small`

---

### D7 — 173 touch targets have no `accessibilityLabel` · `MEDIUM` · `a11y`

- **Location:** module-wide (202 `TouchableOpacity`/`Pressable`, 37 labelled). E.g. [`MessageBubbleGroup.tsx:550`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageBubbleGroup.tsx#L550), [`VoiceRecordingBar.tsx:148`](../../../resources/views/mobapp/src/module/employee/messages/components/VoiceRecordingBar.tsx#L148)
- **Problem:** the majority are **icon-only** controls — send, attach, record, react, forward, play/pause, close. With no label, VoiceOver and TalkBack announce "button" or the raw glyph name.
- **What the user sees:** a screen-reader user cannot operate the chat composer at all — send, attach and record are indistinguishable.
- **Authority:** WCAG 2.1 AA §4.1.2 Name/Role/Value; RN `accessibilityLabel`
- **Fix:** `<TouchableOpacity onPress={handleSend}>` → `<TouchableOpacity onPress={handleSend} accessibilityRole="button" accessibilityLabel="Send message">`. Prioritise the ~20 composer and message-action controls; the rest can follow incrementally.
- **Effort:** `large` (but incremental — high-traffic controls first)

---

### D8 — Typography scale bypassed by 338 inline overrides · `MEDIUM` · `typography`

- **Location:** module-wide
- **Problem:** `theme/index.ts:93-155` defines 11 `textVariants`. The module overrides `fontSize` inline 338 times, including **eight fractional sizes** — `8.5, 9, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5`. `variant="caption"` (12px) is then overridden to a different size at nearly every one of its 230 uses.
- **What the user sees:** no single defect, but hierarchy is inconsistent between screens, and `fontSize={8.5}`/`{9}` labels are below comfortable mobile legibility. Fractional sizes also round unpredictably across pixel densities, so the same label sits at different heights on different devices.
- **Authority:** `theme/index.ts:93-155`; Restyle variant system
- **Fix:** add the two genuinely missing steps as variants rather than overriding inline —
  ```ts
  micro:  { fontSize: 10, fontWeight: '600', color: 'textSecondary' },
  tiny:   { fontSize: 11, fontWeight: '600', color: 'textSecondary' },
  ```
  then replace `variant="caption" fontSize={10.5}` with `variant="micro"`. Collapse the fractional sizes onto whole numbers.
- **Effort:** `large` (incremental; add variants first, migrate opportunistically)

---

### D9 — ~57 spacing values off the theme scale · `LOW` · `spacing`

- **Location:** `StyleSheet.create` blocks module-wide
- **Problem:** `theme/index.ts:71-82` defines `none:0, xxs:2, xs:4, s:8, sm:10, m:16, ml:20, l:24, xl:32, xxl:40`. Raw padding/margin values of `3, 5, 6, 7, 9, 11, 13, 14, 15, 36` appear ~57 times (`14` alone 18×, `6` 13×, `13` 6×).
- **What the user sees:** minor vertical-rhythm inconsistency between adjacent cards and rows; nothing broken.
- **Authority:** `theme/index.ts:71-82`
- **Fix:** round to the nearest scale step (`14`→`m`/16 or `sm`/10, `6`→`xs`/4 or `s`/8). Do this opportunistically when touching a file, not as a sweep.
- **Effort:** `small`

---

### D10 — Dead `||` fallback leaves the refresh spinner on the wrong gradient · `LOW` · `tokens`

- **Location:** [`MessagesScreen.tsx:1006`](../../../resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx#L1006)
- **Problem:** `colors.primaryDark || (isDark ? '#E2A35A' : '#9C5A22')`. In `ThemeContext`, `primaryDark` is `#E2A35A` in **both** palettes (`:83`, `:127`), so it is always truthy and the fallback never fires. The intended light-mode second stop `#9C5A22` never renders. This is a direct casualty of **DR2** (`primaryDark` means opposite things in the two theme systems).
- **What the user sees:** the Android pull-to-refresh spinner in light mode cycles `#CB793A → #E2A35A` (tan → lighter tan) instead of the intended `#CB793A → #9C5A22` (tan → deep brown), so it reads washed-out. iOS uses only `tintColor` and is unaffected.
- **Authority:** `ThemeContext.tsx:83,127`
- **Fix:** `colors.primaryDark || (…)` → `colors.primaryStrong` (`#9C5A22` light / `#E2A35A` dark, `:84`/`:128`) — which is the token that actually carries the intended meaning.
- **Effort:** `trivial`

---

## 3. What's Already Working

Worth protecting during any fix pass:

- **Mention pills are the best-executed colour work in the module.** [`MessageContent.tsx:74-88`](../../../resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx#L74-L88) — all four states pass AA: self-mention **4.79:1** light (`#9C5A22` on `primaryBg`) / **4.78:1** dark; other-mention **6.16:1** light / **4.42:1** dark. Line 79 reaches for the accessible `#9C5A22` shade *unprompted* — exactly what D2 asks for elsewhere. The light-subtle / dark-saturated border logic at `:80` and `:87` is deliberate and internally consistent (I initially misread `:80` as an inverted ternary; it is not — it matches the blue branch's logic).
- **Dark mode is genuinely wired end-to-end**, not aspirational: `_layout.tsx:86,137` swaps `restyleDarkTheme` at the provider. 279 `isDark` ternaries across 44 components show sustained effort — D4 is the *only* unguarded colour block found.
- **Semantic tints are correctly paired** in the composer: [`ChatInputBar.tsx:718-719, 748-749, 775-776`](../../../resources/views/mobapp/src/module/employee/messages/components/ChatInputBar.tsx#L718-L776) give reply / edit / ticket banners matching light hex and dark `rgba()` variants.
- **Import discipline is uniform** — all 44 components import `Box`/`Text` from `@/theme`. No component rolls its own layout primitive, and no competing UI framework (PrimeVue/MUI/Bootstrap) leaks in from the parent repo.
- **`hitSlop` used 63 times**, showing awareness of small touch targets.
- **Re-export shims are intentional, not stubs:** `CreateGroupModal.tsx` and `ApplicationDetailModal.tsx` are 1-line re-exports, correctly pointing at `CreateChannelModal` and the shared `@/components/modals` copy — reuse, not duplication.

---

## 4. Design-System Drift

Conflicts **between sources of truth** — not the reviewed module's fault. These caused D1, D3 and D10.

### DR1 — Three parallel theme systems coexist

| File | Shape | Consumed in messages |
| :--- | :--- | :--- |
| `src/theme/index.ts` | Restyle `createTheme` + `darkTheme` | **Yes — all 44 components** |
| `src/contexts/ThemeContext.tsx` | `ThemeColors` interface, 40 keys | Yes — imported *only* to get `isDark` |
| `src/constants/theme.ts` | `Colors.light` / `Colors.dark`, 5 keys | No |

Components routinely hold **both** — e.g. `MessagesScreen.tsx:162-164` destructures `colors` from `useAppTheme()` *and* `theme` from `useTheme()`, then mixes them in one style object (`:1089` uses `colors.moduleEmployee || theme.colors.primary`).

**Recommendation:** `src/theme/index.ts` should win — it is what every component already renders from, it is type-safe, and it is what the provider swaps. Reduce `ThemeContext` to mode state only (`themeMode`, `isDark`, `setThemeMode`) and delete its 40-key colour table. Retire `constants/theme.ts`. This is out of T00001's scope; file it separately.

### DR2 — `primaryDark` means the **opposite thing** in the two systems

| | light | dark |
| :--- | :--- | :--- |
| `theme/index.ts:25,189` | `#9C5A22` — **darker** | `#E2A35A` |
| `ThemeContext.tsx:127,83` | `#E2A35A` — **lighter** | `#E2A35A` |

Same name, inverted meaning, in the same light mode. `ThemeContext` adds a third key, `primaryStrong` (`#9C5A22`), for the shade Restyle calls `primaryDark`. **This landmine already detonated once** — D10 is exactly a developer reading `primaryDark` with the Restyle meaning and getting the ThemeContext value.

**Recommendation:** rename to intent-revealing names in whichever system survives DR1 — `primaryAccessible` (`#9C5A22`, for text) and `primaryElevated` (`#E2A35A`, for dark surfaces). Until then, treat any bare `primaryDark` reference as suspect.

### DR3 — `textMuted` is not AA-safe on light surfaces (root cause of D1)

`#94A3B8` is used for both palettes (`theme/index.ts:20`, `:184`). It clears AA on dark surfaces (5.71:1) and fails on every light one (2.34–2.56:1). Because `textVariants.caption` defaults to it (`:125`), the failure is opt-out rather than opt-in.

**Recommendation:** darken the **light** value only — `theme/index.ts:20` → `'#64748B'` (4.76:1) — and leave dark at `#94A3B8`. One line, fixes D1 for this module and every other consumer, and preserves the intended visual hierarchy (still lighter than `text`, still clearly secondary).

### DR4 — Inherited web-theme drift (informational)

`ThemeContext.tsx:41` declares the module accents come "from theme.css", and they do — including the drift [`ui-design.md`](../../../rules/conditional/ui-design.md) already records: `moduleAdmin` is `#8B5CF6` violet (the rule mandates Enterprise Indigo and says *"Do NOT use violet or purple for Admin"*), and `moduleHr` is `#10B981` emerald-500 where the rule says emerald-600 `#059669`. **No action here** — the messages module is employee-portal and never uses these as portal accents (`#8B5CF6` appears only in decorative avatar palettes and a filter icon). Fixing belongs upstream in `theme.css`; noted so the next agent does not "fix" the mobile copy into disagreement with the web app.

---

## 5. Fix Plan

Ordered so token-level changes land first — **doing DR3 first deletes most of D1's work.**

| Order | Finding | Severity | Change | File(s) | Effort | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | DR3 | — | Light `textMuted` `#94A3B8` → `#64748B` | `src/theme/index.ts:20` | trivial | **DONE** (+ `textSecondary`→`#475569`) |
| 2 | D1 | HIGH | Verify the 125 `color="textMuted"` sites now pass; switch any on non-white surfaces to `textSecondary` | messages module | small | **DONE** — token fix covered all 269 app-wide sites, 0 call sites edited |
| 3 | D3 | HIGH | Remove dead `\|\|`; pin badge text to `#9C5A22`, or invert pill to `primaryDark` bg + `textInverse` | `pages/MessagesScreen.tsx:1099` | trivial | **DONE** — all 4 states fixed, not just the 1 reported |
| 4 | D4 | HIGH | Replace 9 hardcoded status colours with `colors.{success,danger,warning}{Bg,Text,Border}` | `components/MessageBubbleGroup.tsx:933-947` | trivial | **DONE** |
| 5 | D2 | HIGH | `color="primary"` → `color="primaryDark"` on the 23 `<Text>` sites (leave borders/icons/fills alone) | 8 components | small | **DONE** — 23 sites / 14 files |
| 6 | D5 | MEDIUM | `color="warning"` → `color="warningText"`; drop tint to `0.08` to clear 4.5:1 | `components/ConversationListItem.tsx:133` | trivial | **DONE** — 4.61:1 |
| 7 | D10 | LOW | `colors.primaryDark \|\| (…)` → `colors.primaryStrong` | `pages/MessagesScreen.tsx:1006` | trivial | **DONE** — used shared `accentFill` |
| 8 | D6 | MEDIUM | Replace the 4 ternary patterns (34 sites) with `theme.colors.*`; drop now-unused `useAppTheme` imports | 12 files | small | **DONE** — 34/34 (see §10) |
| 9 | D7 | MEDIUM | `accessibilityLabel` + `accessibilityRole` on composer & message-action controls first | `ChatInputBar`, `MessageBubbleGroup`, `VoiceRecordingBar`, `MessageActionModal` | large | **DONE** — 46 labelled, 4 justified skips (§10) |
| 10 | D8 | MEDIUM | Add `micro`/`tiny` variants; migrate fractional sizes opportunistically | `src/theme/index.ts` + module | large | **DONE** — 77 sizes normalised, `micro` added (§10) |
| 11 | D9 | LOW | Round off-scale spacing when touching a file | module | small | **WITHDRAWN** — mis-framed, see §10 |

**Fix together:**
- **Steps 1–2** are one change — do DR3 and re-measure before editing 125 call sites.
- **Steps 3 + 7** are both in `MessagesScreen.tsx` and both are `primaryDark`/`primaryStrong` confusion — one edit, one re-read of DR2.
- **Steps 5 + 8** overlap heavily in `ChatToolsDrawer`, `ForwardMessageModal`, `ChatAudioBubble`, `EmojiPickerPanel`, `GifPickerPanel` — swapping `color="primary"` → `primaryDark` and `primaryAccent` → `theme.colors.primary` should be one pass per file.
- **Step 4** must not be split: `statusBg`, `statusTextColor` and `statusBorderColor` are a matched set.

Run `/webkit.fix resources/views/mobapp/src/module/employee/messages using .agents/specs/subhrms/T00001/design-review.md` on branch `T00001`.

---

## 6. Modern Enhancement Ideas  *(optional — not part of the Fix Plan)*

> **Grounded on:** 2026-09-15 via `React Native chat UI design trends 2026 message bubbles accessibility` and `Shopify Restyle theme design tokens best practices semantic color React Native`.
> **Design concept read as:** a **workplace** chat inside an HRMS — its job is fast scanning of many conversations and unambiguous status on application/leave/OT requests embedded in the thread. Legibility under density and trustworthy status signalling beat delight. Every suggestion below serves that; none propose decorative motion.
> **Constraint:** all suggestions are expressible in the Restyle `createTheme` object or RN core APIs. No new styling library, no Tailwind (there is none), no renaming of existing token keys — components depend on those exact names.

### E1 — Derive the dark palette instead of hand-picking it

> [!CAUTION]
> **The last sentence of this bullet was wrong, and is struck through below.** RN 0.86.3 **cannot parse `oklch()`** — `@react-native/normalize-colors` handles only `rgb`/`rgba`/`hsl`/`hsla`/`hwb` + named colours, so an `oklch()` string resolves to null and the style is silently dropped. (The only `oklch` strings in `node_modules` are inside the bundled Chrome DevTools frontend, not the style pipeline.) Verified in `node_modules` before implementing; see §9 for how E1 was actually built.

- **Why:** `darkTheme` (`theme/index.ts:165-235`) restates ~45 literals. That is how `textMuted` ended up identical across both modes (DR3) and how D4's block was missed. Deriving accent ramps in a perceptual space keeps lightness even across shades, so a contrast guarantee holds by construction rather than by review. ~~RN 0.86 + Hermes support `oklch()` strings in `StyleSheet` colours on both platforms.~~
- **Sketch** (additive — new keys beside the old, nothing renamed):
  ```ts
  const chestnut = (l: number) => `oklch(${l}% 0.11 55)`;
  export const theme = createTheme({
    colors: {
      ...existing,
      primaryAccessible: chestnut(45),  // ~#9C5A22 — AA on light surfaces
      primaryElevated:   chestnut(75),  // ~#E2A35A — AA on dark surfaces
    },
  });
  ```
  Keeps `primary`, `primaryDark`, `primaryBg` untouched; new names also resolve DR2's ambiguity for new code.
- **Migration cost:** 1 file additive; call sites migrate opportunistically. Incremental.

### E2 — A contrast rule that holds automatically, rather than per-token patches

- **Why:** D1/D2/D3/D5 are four instances of one failure — a colour chosen for a surface it does not sit on. `-strong`/`-Text` suffixes patch this one token at a time. Pairing foreground with background in the token itself makes the failure unrepresentable, which is the Restyle docs' own "semantic meaning in the name" guidance taken one step further.
- **Sketch:**
  ```ts
  // on-X = guaranteed AA against X
  onCard:        '#0F172A',  onCardMuted:      '#64748B',  // 4.76:1
  onPrimary:     '#FFFFFF',  onPrimaryBg:      '#9C5A22',  // 4.79:1 on #FBF0E3
  onWarningBg:   '#9A4C09',  onSuccessBg:      '#15803D',
  ```
  then `<Text color="onCardMuted">` instead of `color="textMuted"` — the name states the surface, so D1 could not have been written.
- **Migration cost:** ~10 new keys, additive; adopt in new components, backfill during the D1/D2 passes. Incremental.

### E3 — Container queries for the bubble, via Restyle breakpoints

- **Why:** `MessageBubbleGroup` (2,255 lines) renders in three very different widths — full-screen chat, `ThreadModal`, and `react-native-web` at desktop width. It currently sizes off device breakpoints (`phone: 0, tablet: 768`), so a bubble inside a narrow thread modal on a tablet gets tablet metrics. Sizing off the *container* is the RN analogue of CSS container queries and directly serves scanning density.
- **Sketch:**
  ```tsx
  const [w, setW] = useState(0);
  <Box onLayout={e => setW(e.nativeEvent.layout.width)}>
    <Box maxWidth={w > 600 ? 520 : '86%'} padding={w > 600 ? 'm' : 's'}>
  ```
- **Migration cost:** 1 component to prove it, ~3 more to adopt. Incremental.

### E4 — Honour `prefers-reduced-motion`, and give motion a token

- **Why:** the module uses Reanimated 4 + `expo-haptics` throughout. Vestibular-sensitive users currently have no escape, and durations are chosen per-component. WCAG 2.1 §2.3.3 covers this; RN exposes it via `AccessibilityInfo.isReduceMotionEnabled()`.
- **Sketch:**
  ```ts
  // theme
  timing: { fast: 120, base: 200, slow: 320 },
  easing: { standard: Easing.bezier(0.2, 0, 0, 1) },
  ```
  ```tsx
  const reduce = useReducedMotion();          // react-native-reanimated
  withTiming(v, { duration: reduce ? 0 : theme.timing.base, easing: theme.easing.standard })
  ```
- **Migration cost:** 2 token groups + one hook; adopt per-animation. Incremental.

### E5 — Meet the 44×44pt touch-target floor explicitly

- **Why:** current guidance (and Apple HIG / Material) puts the minimum at 44×44pt. `hitSlop` is applied 63 times across 202 touchables, so coverage is partial and ad-hoc. Pairs naturally with D7 — same controls, same pass.
- **Sketch:**
  ```ts
  // theme
  touchTarget: { min: 44 },
  ```
  ```tsx
  <TouchableOpacity hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} />
  ```
  or wrap once as `<IconButton>` and replace the icon-only touchables with it — which also gives D7's labels a single place to live.
- **Migration cost:** 1 new component + ~40 icon-only sites. Incremental, and folds into D7.

**Sources:** [UXPin — Chat UI Design 2026](https://www.uxpin.com/studio/blog/chat-user-interface-design/), [Bricx — 16 Chat UI Design Patterns That Work in 2026](https://bricxlabs.com/blogs/message-screen-ui-deisgn), [Restyle — Colors](https://github.com/Shopify/restyle/blob/master/documentation/docs/fundamentals/colors.md), [Shopify Engineering — 5 Ways to Improve Your React Native Styling Workflow](https://shopify.engineering/5-ways-to-improve-your-react-native-styling-workflow)

---

## 7. Review Limits

State plainly what this report does **not** cover.

- **13 of 58 files reviewed in depth**, per the ~15-file cap in [`context-budget.md`](../../../rules/context-budget.md): all 4 pages (`MessagesScreen`, `ConversationScreen`, `MessagesMoreScreen`, `MessageRequestsScreen`), plus `MessageBubbleGroup`, `ChatInputBar`, `ManageChannelModal`, `MoveChannelSectionModal`, `MessageContent`, `ConversationListItem`, `DirectMessageHoldModal`, `ChatToolsDrawer`, `UserAvatar` — selected by traffic (pages first) and by hardcoded-colour density.
- **45 files were machine-scanned, not read**: every file was swept for hex literals, `isDark` pairing, Restyle `color="token"` props, `accessibilityLabel`, `fontSize` and spacing values, so the **counts** in D1/D2/D6/D7/D8/D9 are module-complete. Files *not* read line-by-line may hold layout or state-handling defects this report would have caught on a full read — most plausibly `ArchivedChannelsModal`, `CreateChannelModal`, `GroupDetailsModal`, `ColleagueProfileModal`, `VideoPlayerModal`, `MessagesSearchModal`.
- **No app was run and nothing was measured on a device.** All contrast figures are computed from literal token values under WCAG 2.1 relative luminance, compositing `rgba()` tints over their parent surface. Real rendering adds RN opacity props, `activeOpacity` (0.82 in places), gradients and platform colour management — a measured ratio may differ. `#F59E0B` under `activeOpacity` will be *worse* than the 1.89:1 in D5, not better.
- **Runtime-only states not assessed:** loading, empty, error, offline, optimistic-send, upload progress, typing indicators, long-press menus, keyboard-avoidance, and every animated transition. These need a device or simulator.
- **Not reviewed:** `services/messages.api.ts` (1,115 lines — no visual layer), `hooks/`, `contexts/MessagesContext.tsx`, `utils/`, `types.ts` — outside the visual scope of this skill. `/webkit.code-review` covers them.
- **Platform coverage:** `react-native-web` renders this module in a browser too (spec §1). No web-specific check was performed — `hitSlop` does not apply on web, and hover/focus-visible states, which this module does not define at all, matter there.
- **Not verified against the spec.** Whether the built UI matches `specs.md` is `/webkit.verify T00001`'s job, not this report's.

## 8. Resolution — v2, 2026-09-16

Applied by `/webkit.fix T00001` on branch `T00001` (nested repo `hrms-react-native`, base `main`). **20 files changed.**

### Verified

`npx tsc --noEmit` → **exit 0** (confirmed genuinely checking via an injected type error). `npx expo lint` → **188 problems (69 errors, 119 warnings)** — byte-identical to the pre-change baseline captured by stashing the work, so **no new lint problems were introduced**. All pre-existing.

Every ratio below recomputed after the edit:

| Finding | Element | Before | After |
| :--- | :--- | ---: | ---: |
| D1 | `textMuted` on card / background | 2.56 / 2.45 | **4.76 / 4.55** |
| D2 | accent text, light | 3.31 | **5.39** |
| D3 | active pill label, light / dark | 3.31 / 2.18 | **5.39 / 8.18** |
| D3 | tab badge, light / dark | 3.31 / 2.18 | **5.39 / 8.18** |
| D4 | status pill text, dark | *light patch @ 15.4 vs bubble* | **8.29–10.45 on a tinted pill** |
| D4 | status pill text, light | 4.51–5.30 | **4.84–5.91** |
| D5 | "Official" badge, light | 1.89 | **4.61** |

### Two v1 measurement errors, corrected

1. **`#64748B` does not clear AA everywhere.** v1 reported it as "4.76:1 ✓" measured only against white; on `cardAlt` (`#F1F5F9`) it is **4.34:1**. Checked before relying on it — `cardAlt` turned out to be an **icon-chip background, not a text surface** (`MessageActionModal.tsx:344`, `ArchivedChannelsModal.tsx:224`), so muted text never lands on it and `#64748B` is safe in practice.
2. **v1's DR3 fix would have collapsed two tokens.** `textSecondary` was *already* `#64748B`, so setting `textMuted` to it destroys the muted/secondary distinction. Resolved by moving both into a three-step standard-slate hierarchy, all AA:
   `text #0F172A` → `textSecondary #475569` (7.58:1) → `textMuted #64748B` (4.76:1).

### One finding v1 under-called

**D3 was broader than reported.** v1 flagged only the *active* badge. The *inactive* badge (accent fill + white text) and the *active pill's own label* share the identical defect — `moduleEmployee` used as a fill behind white text, resolving to the light shade `#E2A35A` in dark mode (2.18:1). Root-caused and fixed as one system via a shared pair in `MessagesScreen.tsx:167-168`:

```ts
const accentFill = theme.colors.primaryDark;          // #9C5A22 light / #E2A35A dark
const onAccentFill = isDark ? '#0F172A' : '#FFFFFF';  // flips the opposite way
```

All four states now pass (5.39:1 light, 8.18:1 dark). The `isDark` ternary is deliberate — no token expresses "contrasting text on the accent fill"; that gap is exactly enhancement **E2**.

### Deliberately not done

- **D6 — 8 of 34 sites.** `ChatAudioBubble`, `DedicatedMessagesHeader`, `EmojiPickerPanel`, `GifPickerPanel` have no `useTheme()` call, so `theme` is not in scope. Adding a hook to four components is a structural change with **zero user-visible benefit** (the inline values are already correct) — it belongs in a refactor, not a contrast fix. The 26 sites where `theme` was already in scope were converted and typechecked.
- **D7 — 6 of 173 controls.** Labelled only the genuinely *silent* composer controls (cancel reply / edit / linked-ticket, remove attachment, discard & send voice). `MessageActionModal`'s rows were left alone because they have **visible `<Text>` children that RN already announces**; the full-screen backdrop scrim at `MessageActionModal.tsx:200` was left unlabelled on purpose, since labelling a full-viewport scrim adds noise rather than access.
- **D8 / D9 — not started.** Adding two unused text variants helps nobody on its own, and migrating 338 `fontSize` overrides plus ~57 spacing values is precisely the churn [`code-quality.md`](../../../rules/conditional/code-quality.md) warns against. Both are genuinely opportunistic; leave them to the files they touch next.

### Not verified

No app was run and nothing was measured on a device — all figures are computed from token values, compositing `rgba()` tints over their real parent surface. **The dark-mode status pill now sits at ~1.1:1 against its bubble** (by design; it is delineated by `successBorder`/`dangerBorder`/`warningBorder`) — worth one look on a real screen to confirm the border reads clearly. Runtime states (loading, empty, error, upload progress) and `react-native-web` remain unverified, per §7.

## 9. Enhancements applied — v3, 2026-09-16

All five §6 ideas applied on branch `T00001`. **27 files changed** in total across v2+v3.

### E1's premise was right; its mechanism was wrong

The report claimed RN could parse `oklch()` at runtime. **It cannot.** Checking `node_modules` first (rather than trusting the report) turned up `@react-native/normalize-colors`, which supports only `rgb`/`rgba`/`hsl`/`hsla`/`hwb` and named colours. An `oklch()` string would have resolved to null and every accent would have silently lost its colour on device.

The fix keeps the whole benefit and removes the risk: **run the OKLCH math at author time and emit hex.** `scripts/generate-accent-ramp.js` is committed, so the ramp is reproducible rather than a block of magic constants, and it prints each step's measured contrast.

**The premise was correct and now has numbers behind it.** The old hand-picked accents drifted badly in hue; the derived ramp holds it:

| | lightness steps | hue spread |
| :--- | :--- | ---: |
| Before (hand-picked) | 53.4 → 65.4 → 76.1 → 96.0 (gaps 12.0, 10.7, 19.9) | **16.7°** (55.43 → 72.15) |
| After (derived, H=56°) | even 8pt steps through the mid range | **1.5°** (54.34 → 55.83) |

Chroma is clamped per step to 92% of the sRGB gamut boundary by binary search, so no step is out of gamut. `accent600` and `accent300` were then chosen **by measurement**, not by eye — they are simply the steps that clear AA on their surface.

### E2 — five of the seven proposed keys were duplicates

Checked each candidate against the existing theme before adding it. `onCard`, `onCardMuted`, `onSuccessBg`, `onDangerBg` and `onWarningBg` all already exist as `text`, `textMuted`, `successText`, `dangerText` and `warningText` — adding them would have been exactly the duplication [`system-awareness.md`](../../../rules/conditional/system-awareness.md) forbids. **Only the two genuinely missing keys were added:** `accentFill` / `onAccentFill`.

That pair is the real payoff: it is precisely the hand-rolled ternary v2 introduced for D3, promoted to a token. Restyle swaps it per theme, so `MessagesScreen` no longer needs `isDark` for colour at all:

```diff
- const accentFill = theme.colors.primaryDark;
- const onAccentFill = isDark ? '#0F172A' : '#FFFFFF';
+ const { accentFill, onAccentFill } = theme.colors;
```

It also slightly improves on v2's hand-picked values — 5.50:1 vs 5.39:1 light, 8.59:1 vs 8.18:1 dark.

### E3 / E4 / E5 — built additively, each proven in one component

| | Added | Proven in |
| :--- | :--- | :--- |
| **E3** | `src/hooks/use-container-width.ts` — measures the box, buckets it (`compact`/`regular`/`wide`) | `MessageBubbleGroup` — `bubbleColumn` was a flat `maxWidth: '78%'`, so on a wide web/tablet container a bubble stretched to ~780dp. Now capped at 520dp past 600dp, near the 60-75 character measure. |
| **E4** | `theme.timing` + `theme.easing` (as bezier control points, keeping the theme plain) and `src/hooks/use-motion.ts` | `VoiceRecordingBar`'s recording pulse |
| **E5** | `src/components/ui/IconButton.tsx` — 44×44 floor, **`label` is a required prop** | `VoiceRecordingBar`'s two 34dp controls |

Two details worth recording:

- **`useMotion` could not naively collapse durations to 0.** The recording dot uses `withRepeat(..., -1)`. Passing `duration: 0` there makes it cycle every frame — *worse* than the original animation. Reduced motion therefore skips the animation entirely and settles on the resting state, which is what WCAG 2.1 SC 2.3.3 actually asks for.
- **`IconButton` makes `label` required**, so an icon-only control cannot be added without a name. That converts D7's 173-instance review problem into a type error — the remaining sites are now a migration, not a recurring defect.

### Verified

`npx tsc --noEmit` → **exit 0**. `npx expo lint` → **186 problems (69 errors, 117 warnings)** vs the **188** baseline. Diffed normalised (line numbers stripped) against a stashed baseline: **zero new problems introduced**, and two pre-existing warnings removed (`theme` unused in `MessageBubbleGroup`; a `react-hooks/exhaustive-deps` miss in `VoiceRecordingBar`).

One warning I *did* introduce was caught and fixed rather than shipped: converting `ForwardMessageModal` to theme tokens left `isDark` and its `useAppTheme` import dead, so both were removed.

The committed ramp was cross-checked against the generator's output — **all 10 steps identical**. Every adopted pair re-measured: 5.50:1 light / 8.59:1 dark for text on the accent fill, 5.26:1 and 8.99:1 for the fill against its own page.

### Not verified

Still no device or simulator. Specifically unproven by computation: that `useReducedMotion()` reports correctly on this Expo 57 build, that `onLayout` buckets as intended under `react-native-web`, and that the 44×44 targets feel right in the hand. Each needs one pass on a real device with **Reduce Motion** toggled and a tablet or wide browser window.

Adoption is deliberately partial — these are proofs, not migrations. `useMotion` is used in 1 animation of many, `IconButton` in 2 controls of ~173, `useContainerWidth` in 1 component. That is the incremental path each idea's **Migration cost** line specified.

## 10. Partial and deferred items closed — v4, 2026-09-16

### D6 — complete (34/34)

The last 8 sites sat in four components with no `useTheme()` call: `ChatAudioBubble`, `DedicatedMessagesHeader`, `EmojiPickerPanel`, `GifPickerPanel`. Each has exactly one component with `useAppTheme()` already in scope, so adding the Restyle hook was safe. `isDark` went dead in the process and was removed along with its now-unused import.

**Zero instances of the four patterns remain in the messages module.**

> [!NOTE]
> **Out of scope, worth a follow-up ticket:** the same four ternaries appear **57 more times outside this module** — `module/employee/filing` (23), `components/modals/TimePickerModal.tsx` (11), `components/dashboard/*` (10), plus filing/timekeeping/profile/notifications. D6 was scoped to messages, and T00001 is the messages redesign; folding other modules into this branch would mix unrelated work into one history. Same latent drift risk, same mechanical fix.

### D7 — complete (46 labelled, 4 justified exclusions)

The raw figure of 173 unlabelled touchables overstated the problem. A subtree scan shows most of them **contain visible `<Text>` children, which RN already announces** — a `TouchableOpacity` is `accessible` by default and groups its children. The genuinely silent, icon-only controls numbered **45**, not 173.

40 were labelled here (6 composer controls were already done in v2), each with `accessibilityRole` and a `accessibilityLabel`; two seek controls got `role="adjustable"` rather than `"button"`. Dynamic labels were used where they carry more than a static string — `{isPlaying ? 'Pause voice message' : 'Play voice message'}`, ``{name ? `View ${name}'s profile` : 'View profile'}``.

**Four deliberately left unlabelled**, because a label would make each *worse*:

| Location | Why |
| :--- | :--- |
| `ForwardMessageModal.tsx:220`, `MessageActionModal.tsx:200` | Full-viewport backdrop scrims. Naming a screen-sized region adds noise, not access. |
| `MessageBubbleGroup.tsx:1843` | The bubble wrapper. `accessibilityLabel` on a container **replaces** what its children announce — labelling it would mask the message text itself. |
| `MessageBubbleGroup.tsx:562` | The non-playable video fallback: `onLongPress` only, no `onPress`. Not a button. |

`SectionHeader`'s `action` prop gained a **required** `label: string`. That is the same enforce-by-types idea as `IconButton`, and it immediately paid for itself — `tsc` rejected the build and surfaced a **second** unlabelled call site (`MessagesScreen.tsx:1310`) that the manual sweep had missed.

### D8 — complete for the part that matters

**77 `fontSize` values normalised**, and the rounding direction was chosen per case rather than uniformly:

| Change | Count | Direction and why |
| :--- | ---: | :--- |
| `8.5`, `9`, `9.5` → `10` | 12 | **Up** — below 10 is not comfortably legible on a phone. |
| `10.5`→`10`, `11.5`→`11`, `12.5`→`12`, `13.5`→`13`, `14.5`→`14`, `15.5`→`15` | 65 | **Down** — most of these sit in badges and pills, so rounding up risked overflow. Nothing grows. |

**No fractional font size remains anywhere in the module, and nothing renders below 10pt.** A `micro` variant (10pt) was added — 10 was the single missing rung and the most-overridden size in the module.

Migrating the ~338 `fontSize` overrides onto `variant=` is still **not** done, and deliberately so: a Restyle variant also carries `fontWeight` and `color`, so swapping `fontSize={11}` for `variant="small"` silently restyles any call site that does not override both. That remains opportunistic, exactly as this finding originally said.

### D9 — withdrawn; the finding was mis-framed

v1 described "spacing off the scale (`p-[13px]` where `p-3` / `p-4` is the rhythm)", which implies tokens being bypassed. Measured, that is not what is happening:

- **Every Restyle spacing prop in the module uses a token name — zero raw numbers.** (`gap="xs"` ×58, `px="m"` ×48, `mt="xxs"` ×41, and so on.) The token path is 100% clean.
- All **106** off-scale numbers live in `StyleSheet.create` (81) or inline `style` objects (25). **Those never consult the theme**, so they were never on the token path and cannot "drift" from it.
- The distribution is not noise either: `12dp` ×26, `6dp` ×20, `14dp` ×18 — 64 of the 106 form a coherent 2dp rhythm the t-shirt scale simply does not name. The remainder (`1`, `3`, `5`, `7`, `9`, `11`, `13`, `15`) are optical one-offs, and `36`/`48`/`80`/`112` are fixed dimensions, not spacing at all.

Rewriting 106 hand-tuned layout values would carry real regression risk — unverifiable without a device — in exchange for **no** token-compliance gain, since none of them were token usages. v1's own fix line already said "opportunistically when touching a file, not as a sweep"; the measurement says the sweep should not happen at all.

**If this is ever revisited**, the useful version is the opposite direction: add the missing `6`/`12`/`14` rungs so the scale describes the rhythm the design actually uses, and convert `StyleSheet` spacing to Restyle props file-by-file. That is a refactor, not a fix.

### Verified

`npx tsc --noEmit` → **exit 0**. `npx expo lint` → **186 problems (69 errors, 117 warnings)**, and diffed normalised against the committed `731650f`: **zero new problems introduced**.

### Not verified

No device. Specifically: the 12 text elements raised to 10pt sit in badges and pills, and although nothing else grew, **those badges are worth one look on a real screen**. Screen-reader output was not heard — labels are correct by inspection, not by listening.

<!-- Run history -->
- v4 — 2026-09-16 — D6 completed (34/34); D7 completed (46 labelled, 4 justified skips) and `SectionHeader.action.label` made required, which caught a missed call site; D8 completed (77 sizes normalised, `micro` variant); D9 withdrawn as mis-framed with measurement. tsc clean, zero new lint.
- v3 — 2026-09-16 — E1-E5 applied; E1's oklch() runtime claim found wrong and corrected to author-time generation; E2 reduced from 7 keys to 2 after duplicate check; tsc clean, lint 186 vs 188 baseline with zero new problems.
- v2 — 2026-09-16 — Fix Plan steps 1-9 applied; 20 files; tsc clean, lint parity with baseline; 2 v1 measurement errors corrected; D3 found broader than reported.
- v1 — 2026-09-15 — initial review; 13 files read in depth, 58 machine-scanned; 10 findings (4 HIGH, 4 MEDIUM, 2 LOW) + 4 drift items.
