# Stag Fitness Frontend — Instructions

React SaaS frontend for the Stag Fitness gym platform. Follows the TESS frontend platform skill
(stack, auth lifecycle, API client, tables, permissions) and TBS frontend rules (feature folders,
RHF + Zod, TanStack Query for server state, Zustand for client state), with the **Stag Performance theme**:
- **White theme**: white + a very mild red wash (sidebar, page background, hero cards). Keep red soft, never heavy.
- **Dark theme**: black + red gradient. Toggle via `useThemeStore` / `<ThemeToggle>` (`.dark` class on `<html>`,
  saved as `stag.theme`); the login page and header both have the toggle.
- **Fonts**: Manrope (UI text) + Barlow Condensed (`font-display`, always `uppercase`: page titles, KPI numbers, logo).
- Colour tokens are RGB channels in `src/index.css` (`:root` = white, `.dark` = dark); sidebar / hero use the
  `--side-*` / `--hero-*` variables through `.app-sidebar`, `.nav-item`, `.side-card`, `.hero-card` classes.
  Never hard-code hex in components.

## Stack (pinned)
React 18 · TypeScript 5 (strict, `noUncheckedIndexedAccess`) · Vite 5 · Tailwind 3.4 (never v4) ·
React Router 6 · TanStack Query 5 · TanStack Table 8 · Zustand 4 · React Hook Form 7 + Zod 3 · axios.
No Redux / MUI / Ant / styled-components / CSS modules. No `any`.

## Layout
```
src/
  App.tsx                 routes (lazy pages, PermissionRoute per screen)
  index.css               Stag tokens (:root) + component classes (.form-control, .btn-status-action, …)
  components/ui/          shared Stag UI — Button, Modal + Drawer (Modal.tsx), FormPage, Section/FormDivider/InfoRow/
                          GRID_2/GRID_3, StatCard, ConfirmDialog(confirm()), Toaster, Field/Input/Select/Textarea/
                          Checkbox/READONLY_INPUT, DataTable(+ActionIcon/ActionGroup/ROW_MARKER), ListToolbar
                          (FilterTabs/FilterSelect/DateRangeFilter), RichSelect (styled grouped dropdown with
                          icon + hint + search, for short fixed lists like goals), PageHeader, StatusBadge, MultiSelect, Icon,
                          Loaders, ThemeToggle
  features/<module>/      api.ts (calls + query keys) · pages/ · components/
  features/lookups/api.ts shared dropdown hooks: useMemberLookup, usePlanLookup, useTrainerLookup
  hooks/use-list-state.ts useListState (page/page_size/debounced search/sort), paginationProps, useUrlEnum (?tab=),
                          useAddAction (?action=add)
  layouts/                AppShell; Sidebar (logo, branch card, flat grouped nav — one link per screen); Header
                          (screen name, theme toggle, profile menu with Sign out); nav-config (NAV + NAV_GROUPS)
  lib/                    api-client (envelope unwrap, X-Branch-ID, refresh-retry), notify, format, utils
  stores/                 auth-store (token in memory, me, can()), branch-store (selected branch), theme-store
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
  errors via `<Field error=…>`. Pick the container by size (hybrid):
  - **Long** (member registration, employee, diet builder) → a page with `<FormPage>` + `<Section>` cards and
    its own route (`/x/new`, `/x/:id`, `/x/:id/edit`); sticky Cancel/Save bar.
  - **Medium** (lead, plan, renew, payment, PT log, add-on) → `<Drawer>` (right slide-over), sections via `FormDivider`.
  - **Short** (1–3 fields, details, confirmations) → `<Modal>` (560px default).
  Buttons go in the `footer` / `actions` slot; the submit button targets the form with `form="<form-id>"`.
  Mount drawers/modals only while open (or reset on success and on close).
- **Permissions**: `useCan("resource:action")`. Hide (don't disable) what the user can't do. Never branch on
  role names.
- **List screens** (Members is the reference): `<PageHeader title subtitle actions>` (primary "Add …" button) →
  `<DataTable toolbar={<><FilterTabs/><ListToolbar/></>}>`. Status filters are tabs kept in `?tab=` (`useUrlEnum`)
  with counts from the list's `GET /<list>/counts` (one call, typed `TabCounts<Tab>`; never one request per tab); search + `FilterSelect`/`DateRangeFilter` live in the toolbar and applied filters show as chips.
  Server pagination + sorting via `useListState` → `pagination={paginationProps(list, total)}` and
  `sorting={list.sorting}`; a column is sortable when `meta.sortKey` is set (the API's `sort_by` value).
  Status values via `<StatusBadge>`, money via `formatINR` (right-aligned), dates via `formatDate` (DD-MM-YYYY).
  The actions column has `id: "actions"`, the header "Actions", and is last.
- **Sidebar**: one link per screen (no sub-menus, no "Add …" links). Add a screen to `NAV` in `nav-config.ts`.
- **Destructive actions** ask first: `if (await confirm("…")) mutate()`.
- **Styling**: Tailwind utilities with the Stag tokens from `tailwind.config.ts` (`text-ink`, `text-muted`,
  `bg-subtle`, `border-line`, `text-accent`, `shadow-premium`, …) and the component classes in `index.css`.
  Screens keep the original Angular structure (same fields, flows and validation) but use this theme.
  Forms: sentence-case labels via `.form-label`, white `.form-control` inputs, placeholders like
  "Select a trainer" (not "-- Select --").
- Tailwind config / font changes need a dev-server restart to show.
- Invoices open in a new tab: `window.open(\`/invoice/${paymentId}\`, "_blank")`.

## Commands
```
npm run dev        # http://localhost:5173 (proxies /api → http://127.0.0.1:8001; override with VITE_API_PROXY_TARGET)
npm run typecheck
npm run build
```
