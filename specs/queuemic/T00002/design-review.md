# Webkit Design Review Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | `T00002` (base `origin/main`) |
| Project | QueueMic (`webapp/`) — resolved via `react`, `react-dom`, `tailwindcss` in `webapp/package.json` |
| Portal | N/A — project has no portals |
| Scope | `webapp/` visual files (14 files in diff against `origin/main`, plus core UI primitives) |
| Design Sources Read | `.agents/rules/conditional/ui-design.md`, `webapp/src/theme/colors.ts`, `webapp/src/index.css` |
| Reviewer Role | Senior Designer Review |
| Review Date | 2026-10-17 |
| Review Run | v1.2 — fix pass 2026-10-17 by /webkit-fix: Findings #1–#4 fixed + Modern Ideas #1–#3 implemented |

---

## Summary

### Overall Design Fit

APPROVED (after fix pass v1.2)

### Summary

Fix pass v1.2 (2026-10-17): All findings (#1 HIGH, #2 MEDIUM, #3 LOW, #4 LOW) fixed and all three Modern Enhancement Ideas (animated equalizer waves, TV stage ambient aura, and queue drop target highlight line) implemented. Overall Design Fit is APPROVED.

QueueMic Web faithfully translates the cyber-glass neon lounge aesthetic of the mobile application into a responsive React SPA with dark mode, high-contrast badges, and glassmorphism cards.

---

## Fit Review

### CRITICAL

None.

### HIGH

#### Finding #1

- **Finding:** Contrast — Subtitle and idle status text fails WCAG AA 4.5:1 minimum on dark controls bar
- **File:** [`webapp/src/components/player/WebPlaybackControls.tsx`](file:///d:/project/QueueMic/webapp/src/components/player/WebPlaybackControls.tsx#L95)
- **Line:** 95, 109
- **Issue:** `text-[#64748B]` rendered directly on `#0C0C16` (luminance ~0.17 on ~0.004) results in a contrast ratio of ~4.1:1, falling below the WCAG AA 4.5:1 minimum required for normal body text under 18pt / 14pt bold.
- **What the User Sees:** "QueueMic Live" and "Waiting for the next song to start..." appear excessively dim and are hard to read under ambient lighting or tilted viewing angles.
- **Authority:** WCAG AA 1.4.3 (Contrast Minimum: 4.5:1)
- **Recommended Fix:** `className="text-[11px] text-[#64748B] font-semibold"` → `className="text-[11px] text-[#94A3B8] font-semibold"` and `className="text-xs text-[#64748B]"` → `className="text-xs text-[#94A3B8]"`
- **Resolution:** ✅ FIXED — 2026-10-17, /webkit-fix: changed text-[#64748B] to text-[#94A3B8] for QueueMic Live label and waiting text (WebPlaybackControls.tsx:95,109). Test: __tests__/components/fixes.test.tsx (failed before, passes now).

### MEDIUM

#### Finding #2

- **Finding:** Token Consistency — Near-miss surface colors `#1C1E2D` vs `#1C1F30` across inputs and cards
- **File:** [`webapp/src/pages/CreateRoomPage.tsx`](file:///d:/project/QueueMic/webapp/src/pages/CreateRoomPage.tsx#L330)
- **Line:** 330, 344
- **Issue:** Input backgrounds in `CreateRoomPage.tsx` and `JoinRoomPage.tsx` use `bg-[#1C1E2D]` (matching `--surface-light` in `index.css:6`), while `GlassCard.tsx:19`, `.glass-card` in `index.css:59`, and inputs in `WebSongSearchModal.tsx:202,411` use `bg-[#1C1F30]`.
- **What the User Sees:** A 1-value near-miss surface hue between room setup inputs (`#1C1E2D`) and song search inputs / card surfaces (`#1C1F30`).
- **Authority:** `ui-design.md §1` (Follow existing design system; avoid near-miss values)
- **Recommendation:** `bg-[#1C1E2D]` → `bg-[#1C1F30]` (or align `index.css` and `colors.ts` tokens with the dominant `.glass-card` surface value)
- **Resolution:** ✅ FIXED — 2026-10-17, /webkit-fix: consolidated surface-light tokens in index.css:6 and colors.ts:5 to #1C1F30 and updated all input backgrounds in JoinRoomPage, CreateRoomPage, and WebNicknameModal to bg-[#1C1F30].

### LOW

#### Finding #3

- **Finding:** Affordance — Drag-and-drop queue reorder lacks target drop insertion indicator
- **File:** [`webapp/src/components/queue/WebQueueList.tsx`](file:///d:/project/QueueMic/webapp/src/components/queue/WebQueueList.tsx#L127)
- **Line:** 127
- **What the User Sees:** While dragging a song card in the Host Queue Manager, the dragged card dims (`opacity-50`), but no visual insertion line or border highlight indicates which slot the song will drop into.
- **Authority:** `ui-design.md §1` (Interactive feedback and affordances)
- **Suggestion:** Add a drop target border indicator (e.g. `border-t-2 border-[#8B5CF6]`) to the row hovered during `dragOver`.
- **Resolution:** ✅ FIXED — 2026-10-17, /webkit-fix: added dragOverIndex state and illuminated cyan drop insertion line (border-t-2 border-[#06B6D4] shadow-[0_-2px_12px_rgba(6,182,212,0.4)]) on hovered rows in WebQueueList.tsx. Test: __tests__/components/fixes.test.tsx.

#### Finding #4

- **Finding:** Contrast Polish — Above-the-fold scroll hint in Home page has low opacity
- **File:** [`webapp/src/pages/HomePage.tsx`](file:///d:/project/QueueMic/webapp/src/pages/HomePage.tsx#L161)
- **Line:** 161
- **What the User Sees:** "Scroll down for party features ↓" is styled with `text-slate-500 opacity-60`, which yields ~2.8:1 contrast on `#0D0E15`, making it barely visible on mobile screens.
- **Authority:** `ui-design.md §1` & readability
- **Suggestion:** Change `text-slate-500 opacity-60` to `text-slate-400 opacity-80` for better legibility on mobile viewports.
- **Resolution:** ✅ FIXED — 2026-10-17, /webkit-fix: upgraded scroll hint text to text-slate-400 opacity-90 in HomePage.tsx:161.

### INFO

- **Observation:** Dark-only experience: QueueMic Web is intentionally dark-first/dark-only (no light mode), aligning with karaoke lounge and TV stage display contexts. All color tokens reflect this with deep slate canvases (`#0D0E15`, `#12131C`) and cyber accents (`#8B5CF6`, `#06B6D4`, `#EC4899`, `#10B981`, `#F59E0B`).
- **Observation:** Accessible alternatives for reordering: In addition to mouse drag-and-drop, `WebQueueItemCard.tsx` provides accessible, high-contrast tap targets (`⚡ TOP`, `▲`, `▼`) allowing precise keyboard and mobile reordering without dragging.

---

## What's Already Working

- [`WebNextUpCard.tsx:28`](file:///d:/project/QueueMic/webapp/src/components/player/WebNextUpCard.tsx#L28) pairs black text on bright amber (`bg-[#F59E0B] text-black font-black`) achieving an exceptional 9.8:1 contrast ratio that satisfies WCAG AAA.
- [`WebConnectionBanner.tsx:13`](file:///d:/project/QueueMic/webapp/src/components/common/WebConnectionBanner.tsx#L13) renders a clear, non-disruptive amber indicator (`bg-amber-500/15 border-amber-500/30 text-amber-300`) with > 12:1 contrast whenever realtime presence disconnects.
- [`WebToast.tsx:26`](file:///d:/project/QueueMic/webapp/src/components/common/WebToast.tsx#L26) provides feedback with a centered floating glass pill (`bg-[#12131C]/95 backdrop-blur-xl border border-emerald-400/30 text-emerald-300`) with smooth slide-up animation.
- [`GlassCard.tsx:36`](file:///d:/project/QueueMic/webapp/src/components/common/GlassCard.tsx#L36) implements a subtle 1px glass highlight (`bg-white/[0.06]`) across all panels, replicating the polished mobile app aesthetic without heavy CSS overhead.
- [`HostPlayerPage.tsx:318`](file:///d:/project/QueueMic/webapp/src/pages/HostPlayerPage.tsx#L318) and [`GuestRoomPage.tsx:318`](file:///d:/project/QueueMic/webapp/src/pages/GuestRoomPage.tsx#L318) implement a responsive layout shift: a stacked edge-to-edge layout with pinned video/progress on mobile (`< lg`) and an equal-height 2-column TV dashboard on desktop (`>= lg`).

---

## Design-System Drift

- [`webapp/src/index.css:4`](file:///d:/project/QueueMic/webapp/src/index.css#L4) (`--bg-color: #0A0A0F`) and [`webapp/src/theme/colors.ts:3`](file:///d:/project/QueueMic/webapp/src/theme/colors.ts#L3) (`background: '#0A0A0F'`) vs [`webapp/src/index.css:29`](file:///d:/project/QueueMic/webapp/src/index.css#L29) (`body { background-color: #0D0E15; }`) and all page components using `bg-[#0D0E15]`: The `:root` token and TypeScript colors declare `#0A0A0F`, but the actual rendered canvas across every screen is `#0D0E15`. The CSS variable and token should update to `#0D0E15` to match reality.

---

## Modern Enhancement Ideas

- **Grounded on:** 2026-10-17 via web search: "modern web audio player UI trends karaoke equalizers 2026"
- **Design concept read as:** High-energy cyber karaoke lounge interface balancing stage legibility with vibrant, synchronized party feedback.

### Idea #1 — Animated Equalizer Waveform in Stage Live Indicator

- **Why:** Replaces the static pulsing circle with an animated 3-bar or 4-bar equalizer icon in the "STAGE LIVE" header badge while playback is active, giving singers immediate kinetic feedback that music is playing.
- **Sketch:**
  ```tsx
  <div className="flex items-end gap-0.5 h-3 w-3">
    <span className="w-0.5 bg-[#10B981] animate-[equalizer_0.8s_ease-in-out_infinite] h-full" />
    <span className="w-0.5 bg-[#10B981] animate-[equalizer_1.1s_ease-in-out_infinite_0.2s] h-2/3" />
    <span className="w-0.5 bg-[#10B981] animate-[equalizer_0.7s_ease-in-out_infinite_0.4s] h-5/6" />
  </div>
  ```
- **Migration Cost:** 2 files (`WebPlaybackControls.tsx`, `WebGuestProgressBar.tsx`), additive, pure Tailwind CSS / keyframes.

### Idea #2 — Ambient Backdrop Aura on TV Stage

- **Why:** Casts a soft, blurred radial glow behind the YouTube video frame matching the Cyber Violet / Neon Fuchsia theme (`shadow-[0_0_80px_rgba(139,92,246,0.18)]`), elevating the TV host screen to feel like an ambient home-theatre display.
- **Sketch:**
  ```tsx
  <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_-15px_rgba(139,92,246,0.25)] border border-white/10">
    {/* Video Player */}
  </div>
  ```
- **Migration Cost:** 1 file (`HostPlayerPage.tsx`), purely additive Tailwind class on the video container.

### Idea #3 — Visual Drop Target Insertion Line in Queue

- **Why:** During drag-and-drop reordering, renders a crisp cyan highlight line (`border-t-2 border-[#06B6D4] shadow-[0_0_8px_#06B6D4]`) on the drop target row, giving users immediate tactile confidence before dropping.
- **Sketch:**
  ```tsx
  <div className={`transition-all ${dragOverIndex === index ? 'border-t-2 border-[#06B6D4]' : ''}`}>
    <WebQueueItemCard ... />
  </div>
  ```
- **Migration Cost:** 1 file (`WebQueueList.tsx`), additive state handling.

---

## Final Recommendation

### READY TO MERGE

**Conditions:** All findings (#1, #2, #3, #4) resolved; 0 open items. All three Modern Enhancement Ideas implemented.

<!-- Run history -->
- v1 — 2026-10-17 — 1 HIGH (contrast on WebPlaybackControls), 1 MEDIUM, 2 LOW — CHANGES REQUIRED
- v1.1 — 2026-10-17 — Finding #1 fixed — APPROVED WITH COMMENTS (after fix pass v1.1)
- v1.2 — 2026-10-17 — Findings #2, #3, #4 fixed + Modern Ideas #1–#3 implemented — APPROVED (after fix pass v1.2)
