# Stag Fitness Frontend — Instructions

React SaaS frontend for the Stag Fitness gym platform. Follows the TESS frontend platform skill
(stack, auth lifecycle, API client, tables, permissions) and TBS frontend rules (feature folders,
RHF + Zod, TanStack Query for server state, Zustand for client state) — **but keeps the original
Stag Fitness look** (Plus Jakarta Sans, slate greys, accent red `#e11d48`, white cards on `#f0f4f8`).

## Stack (pinned)
React 18 · TypeScript 5 (strict, `noUncheckedIndexedAccess`) · Vite 5 · Tailwind 3.4 (never v4) ·
React Router 6 · TanStack Query 5 · TanStack Table 8 · Zustand 4 · React Hook Form 7 + Zod 3 · axios.
No Redux / MUI / Ant / styled-components / CSS modules. No `any`.

## Layout
```
src/
  App.tsx                 routes (lazy pages, PermissionRoute per screen)
  index.css               Stag tokens (:root) + component classes (.form-control, .btn-status-action, …)
  components/ui/          shared Stag UI — Button, Modal, ConfirmDialog(confirm()), Toaster, Field/Input/Select/
                          Textarea/Checkbox, DataTable(+ActionIcon/ActionGroup/ROW_MARKER), PageHeader/SearchBox,
                          StatusBadge, MultiSelect, Icon, Loaders
  features/<module>/      api.ts (calls + query keys) · pages/ · components/
  features/lookups/api.ts shared dropdown hooks: useMemberLookup, usePlanLookup, useTrainerLookup
  hooks/use-list-state.ts page/page_size/debounced search for server-paginated lists
  layouts/                AppShell, Sidebar, Header, nav-config
  lib/                    api-client (envelope unwrap, X-Branch-ID, refresh-retry), notify, format, utils
  stores/                 auth-store (token in memory, me, can()), branch-store (selected branch)
  types/                  api.ts, enums.ts (mirrors backend core/enums.py), one file per domain
```

## Rules
- **API**: only through `apiGet/apiPost/apiPut/apiPatch/apiDelete` from `@/lib/api-client`. They return
  `{ message, data }`; paginated lists return `data: { items, total, page, page_size }`. JSON is snake_case.
  The selected branch is sent automatically as `X-Branch-ID`. Never read `response.data.data`.
- **Server state** with TanStack Query; include the selected branch (`useBranchStore`) in query keys of
  branch-scoped data. **Client/UI state** in component state or Zustand.
- **Mutations**: `onSuccess: (res) => notify.success(res.message)` (backend message, never invented text),
  `onError: notify.error`. Every mutation button uses `<Button loading={mutation.isPending}>`.
- **Forms**: React Hook Form + Zod, Zod at least as strict as the backend Pydantic schema. Inline field
  errors via `<Field error=…>`. Short forms in `<Modal>`; reset on success and on close.
- **Permissions**: `useCan("resource:action")`. Hide (don't disable) what the user can't do. Never branch on
  role names.
- **Tables**: `<DataTable>` with TanStack `ColumnDef`s, server pagination (`useListState` + `pagination` prop),
  status values via `<StatusBadge>`, money via `formatINR`, dates via `formatDate` (DD-MM-YYYY).
  The actions column has `id: "actions"` and is last.
- **Destructive actions** ask first: `if (await confirm("…")) mutate()`.
- **Styling**: Tailwind utilities with the Stag tokens from `tailwind.config.ts` (`text-ink`, `text-muted`,
  `bg-subtle`, `border-line`, `text-accent`, `shadow-premium`, …) and the component classes in `index.css`.
  Reproduce the original Angular screen (its `.html` + `.css`) faithfully — same structure, spacing, colours.
- Invoices open in a new tab: `window.open(\`/invoice/${paymentId}\`, "_blank")`.

## Commands
```
npm run dev        # http://localhost:5173 (proxies /api → http://127.0.0.1:8000)
npm run typecheck
npm run build
```
