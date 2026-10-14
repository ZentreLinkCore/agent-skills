# UI & Design Standards

## Purpose

This document establishes styling consistency, design guidelines, and responsiveness rules for all frontend components and views.

## Scope

Applicable to all frontend files, components, templates, stylesheet directories, and UI layouts.

## Responsibilities

- **AI Agent**: Discovers the active styling system (e.g. Tailwind, Bootstrap, CSS Modules, or specific UI frameworks like Vuetify/PrimeVue/MUI) and follows its design tokens.
- **Developer/User**: Approves visual layouts, color themes, and custom asset integrations.

## Actionable Rules

1. **Detect Styling Blueprint First**: Inspect existing templates and components to identify margins, paddings, border radii, shadows, and color definitions. Do not invent custom styling patterns.
2. **Follow Component Design Consistency**:
   - **Cards & Layout Panels**: Use the project's default backgrounds and border colors (e.g., `bg-white border-slate-200/60 dark:bg-slate-800 dark:border-slate-700` if using Tailwind Slate styles).
   - **Status Indicators**: Use existing status badge styling or global badge components to format states (e.g. Active, Pending, Error).
   - **Loaders**: Match existing spinner models, skeleton panels, or visual indicators.
3. **Responsive Grid Alignment**: Build responsive templates using columns grids (e.g., `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`).
4. **Dark Mode Integration**: Ensure all classes have active dark mode properties (e.g. `dark:...`) matching the project's styling system.
5. **Portal Accent Color Standards**:
   - **Employee**: **Golden Chestnut (`#CB793A` light accent / `#E2A35A` dark-mode accent / `#9C5A22` strong)** — CSS vars `--color-module-employee*` in `resources/css/theme.css`; use arbitrary values (`bg-[#CB793A]`, `text-[#CB793A]`, etc.) or the `.badge-employee` / `.text-module-employee` / `.nav-link-active-employee` utility classes rather than any Tailwind named color. `#CB793A` alone is under 4.5:1 against white text and against its own light badge tint — use the **strong** `#9C5A22` shade (already wired into the utility classes above) anywhere text/icons sit directly on the light accent or its tint; reserve plain `#CB793A` for borders, decorative fills, and icons on plain white/slate cards.
   - **Manager**: Red (`red-600`)
   - **HR**: Emerald (`emerald-600`)
   - **Timekeeping**: Blue (`blue-600`)
   - **Payroll**: Cyan (`cyan-600`)
   - **Admin**: **Enterprise Indigo / Slate (`indigo-600` / `slate-900`)** — *Strict Rule: Do NOT use violet or purple for Admin portal views, banners, active sidebar links, or controls.*

## Best Practices

- **No Style Mixing**: Do not mix UI frameworks or introduce custom inline style blocks if the project uses a utility library like Tailwind CSS.
- **Micro-Transitions**: Apply smooth interactive states (`transition duration-200 hover:scale-[1.01]`) on buttons and cards.
- **Table Drag-to-Scroll**: Wide data tables MUST support mouse drag-to-scroll (`cursor-grab active:cursor-grabbing select-none` + `@mousedown="startDrag"` with window `mousemove`/`mouseup` tracking) on their `overflow-x-auto` container.
- **Government ID Column Formatting**: Statutory ID columns (SSS, PhilHealth, Pag-IBIG) MUST be formatted as straight, left-aligned, non-wrapping monospace text (`font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5`) with an icon (`shrink-0`).

## AI Behavior Expectations

- **Design Alignment**: The agent must inspect existing pages before building any UI views to ensure the generated blocks match the visual layout and padding standards.
- **Minimal Style Diffs**: Only modify design variables or tailwind class strings required for the request.
