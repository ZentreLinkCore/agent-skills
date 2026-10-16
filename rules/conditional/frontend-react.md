# Frontend: `<source-path>` (React)

**Applies to `<source-path>` (React) only.** Read [frontend.md](./frontend.md) first. Everything in [frontend-vue.md](./frontend-vue.md) is wrong for this project.

This project has a **written product blueprint that is the source of truth for behavior**: [`.agents/blueprint/scaleup/docs/`](../../blueprint/scaleup/docs/README.md) (condensed: [`SUMMARY.md`](../../blueprint/scaleup/SUMMARY.md)). Read the one specification the feature needs before speccing or building; this file governs only how to express it in code. Existing code that contradicts the blueprint is listed in [backend.md §6 Known drift](./backend.md#6-source-path-react-known-drift): follow the docs, not the drift.

## 1. Stack

- **React 19** + `react-router-dom` v7, Tailwind CSS 4, Radix UI primitives, `lucide-react` icons, Vite 8.
- **TypeScript is enforced**: `tsconfig.json` at the root; `npm run typecheck` (`tsc --noEmit`); `npm run build` typechecks first. `allowJs: true` + `checkJs: false` during migration: `.jsx` / `.js` still run unchecked; every `.ts` / `.tsx` file is `strict`.
- **State**: React Context + hooks. **No Pinia, Redux, or Zustand**: do not introduce one without asking.
- **Tests**: no frontend runner yet (no `npm run test`). The first skill that needs one sets up Vitest per [testing.md](./testing.md#setting-up-a-missing-frontend-runner-one-time-done-by-the-skill).

## 2. Layout

The web root is `resources/views/web/`, **not** `.../web/src/`. The `@` alias points at that root, so `@/app/...` and `@/src/...` are both valid.

```text
resources/views/web/
├── main.jsx                     # entry (vite.config.js input)
├── app/
│   ├── routes.tsx               # master router: layouts, guards, error routes
│   └── axios/                   # http.ts, axiosInstance.ts, axiosInterceptors.ts, axiosApiErrors.ts
└── src/
    ├── types/                   # shared domain & router types barrel (@/src/types)
    ├── theme/                   # ThemeProvider + useTheme
    ├── errors/                  # NotFoundPage, UnauthorizedPage, ServerErrorPage
    ├── components/ui/           # design system (Button, Card, Input, Table, Chart, …): import from the barrel
    └── module/<domain>/         # feature modules
        ├── route/               # <domain>.routes.tsx
        ├── useApiWebRoute.ts    # module route aggregator
        ├── api/<domain>.api.ts  # use<Domain>Api() service hook
        ├── pages/  components/  hooks/  context/  guards/
        └── index.jsx            # barrel: routes, components, hooks
```

- **Extensions**: `.tsx` for anything with JSX, `.ts` otherwise. New work is TypeScript: no new `.jsx` / `.js` files.
- **Modular routing**: each module's `route/<domain>.routes.tsx` exports an `AppRouteObject[]` (optionally aggregated by its `useApiWebRoute.ts`); `app/routes.tsx` mounts them into their layout trees (`GuestGuard`, `AuthGuard`, `AppShell`).

## 3. HTTP client: the `http` wrapper, not raw axios

```ts
import http from '@/app/axios/http';

import type { ApiResponse } from '@/src/types';

export function use<Domain>Api() {
    return {
        getThing: () => http.get<ApiResponse<Thing>>('/api/<domain>/thing'),
    };
}
```

- `http.get/post/put/patch/delete` are generic and return the **already-unwrapped body** (`response.data`), so `T` is the body, usually the `{ data: ... }` envelope: `ApiResponse<Thing>`. Never add another `.data`.
- Rejections are always a normalized `ApiError` (`{ status, message, fields, original }`), never a raw `AxiosError`; narrow with `isApiError()` from `@/src/types`.
- 401 / 419: `axiosApiErrors` dispatches `auth:unauthorized` once and `AuthContext` clears the session.
- Endpoints are absolute and start with `/api/`. Shared domain types come from the `@/src/types` barrel.
