# UI & Design

Styling consistency for components, templates, and stylesheets. The user approves layouts, themes, and new assets; the agent follows the existing system. **Portal-specific rules (§3, §4) apply only to projects with portals ((Vue)); §2's handler syntax is Vue's.**

## 1. Follow the existing design system

- **Detect it first.** Inspect existing pages and components for spacing, radii, shadows, colors, and the styling system in use (Tailwind, a UI framework). Never invent a styling pattern, and never mix UI frameworks or add inline style blocks where Tailwind is the system.
- **Cards and panels** use the project's backgrounds and borders (with Tailwind slate: `bg-white border-slate-200/60 dark:bg-slate-800 dark:border-slate-700`).
- **Status** uses the existing badge styles or global badge components; **loaders** use the existing spinners and skeletons.
- **Responsive grids**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
- **Dark mode**: every color class has its `dark:` counterpart.
- **Micro-transitions** on interactive cards and buttons (`transition duration-200 hover:scale-[1.01]`).
- **Minimal style diffs**: change only the classes or design variables the request needs.

## 2. Wide tables

Wide data tables support mouse drag-to-scroll on their `overflow-x-auto` container: `cursor-grab active:cursor-grabbing select-none` plus `@mousedown="startDrag"` with window `mousemove` / `mouseup` tracking.

## 3. Portal accent colors ((Vue))

| Portal | Accent |
| :--- | :--- |
| **Employee** | **Golden Chestnut**: `#CB793A` light accent, `#E2A35A` dark-mode accent, `#9C5A22` strong. CSS vars `--color-module-employee*` in `resources/css/theme.css`. Use arbitrary values (`bg-[#CB793A]`, `text-[#CB793A]`) or `.badge-employee` / `.text-module-employee` / `.nav-link-active-employee`, never a Tailwind named color. `#CB793A` is under 4.5:1 against white text and against its own light tint: wherever text or icons sit on the accent or its tint, use the **strong** `#9C5A22` (already in those utility classes). Plain `#CB793A` is for borders, decorative fills, and icons on white / slate cards. |
| **Manager** | Red `red-600` |
| **HR** | Emerald `emerald-600` |
| **Timekeeping** | Blue `blue-600` |
| **Payroll** | Cyan `cyan-600` |
| **Admin** | Enterprise Indigo / Slate (`indigo-600` / `slate-900`). **Never violet or purple** for Admin views, banners, active sidebar links, or controls. |

## 4. Government ID columns ((Vue))

Statutory ID columns (SSS, PhilHealth, Pag-IBIG) are straight, left-aligned, non-wrapping monospace text with an icon: `font-mono text-xs font-bold whitespace-nowrap flex items-center gap-1.5`, icon `shrink-0`.
