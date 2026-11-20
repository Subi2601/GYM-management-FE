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
- **Roles & Access** (`/roles`, `features/roles`): the gym's role ladder + access ticks per module → screen; owner-only
  ticks locked, "Switch branches" only for all-branch roles. Staff logins pick a role with `<RoleSelect>`
  (`/roles/assignable` = roles below the user's level); show the role with `role_name`, never the old Admin / Trainer
  enum.
- **List screens** (Members is the reference): `<PageHeader title subtitle actions>` (primary "Add …" button) →
  `<DataTable toolbar={<><FilterTabs/><ListToolbar/></>}>`. Status filters are tabs kept in `?tab=` (`useUrlEnum`)
  with counts from the list's `GET /<list>/counts` (one call, typed `TabCounts<Tab>`; never one request per tab); search + `FilterSelect`/`DateRangeFilter` live in the toolbar and applied filters show as chips.
  Server pagination + sorting via `useListState` → `pagination={paginationProps(list, total)}` and
  `sorting={list.sorting}`; a column is sortable when `meta.sortKey` is set (the API's `sort_by` value).
  Status values via `<StatusBadge>`, money via `formatINR` (right-aligned), dates via `formatDate` (DD-MM-YYYY).
  The actions column has `id: "actions"`, the header "Actions", and is last. Keep at most 2–3 daily actions on the
  row and put the rest in `<RowMenu items=[…]>` ("⋯", portalled so the table never clips it; leave out items the
  user can't do, pass `disabled` + `disabledReason` for "All Branches"). Leads is the first screen using it.
- **Sidebar**: one link per screen (no sub-menus, no "Add …" links). Add a screen to `NAV` in `nav-config.ts`.
- **Destructive actions** ask first: `if (await confirm("…")) mutate()`.
- **Styling**: Tailwind utilities with the Stag tokens from `tailwind.config.ts` (`text-ink`, `text-muted`,
  `bg-subtle`, `border-line`, `text-accent`, `shadow-premium`, …) and the component classes in `index.css`.
  Screens keep the original Angular structure (same fields, flows and validation) but use this theme.
  Forms: sentence-case labels via `.form-label`, white `.form-control` inputs, placeholders like
  "Select a trainer" (not "-- Select --").
- Tailwind config / font changes need a dev-server restart to show.
- **Attendance**: `/attendance` has Staff | Members views (`?view=`), `/attendance/qr` the branch posters, gym
  location and linked phones (`attendance:qr`). `/checkin/:token?type=in|out` is the public, phone-sized scan page
  (outside `RequireAuth`) — it talks only to `checkinApi` (`/public/checkin/...`). QR images come from `qrcode`.
- **Enquiry form**: `/enquiry/:token` is the public, phone-sized form (outside `RequireAuth`, `publicEnquiryApi`); a
  submit becomes a lead. Leads → "Enquiry form" (`EnquiryLinkModal`) shows the branch link, QR, copy, WhatsApp share,
  printable poster and "New link".
- **Gym Settings** (`/gym-settings`, `gym:manage`, `features/gym`): gym profile (logo, name, tagline, contacts, GSTIN,
  address, invoice footer), terms & conditions PDF (linked in the welcome WhatsApp message) and branches
  (`BranchFormDrawer`: contacts, head office, admin login, reset password). Invoices / sidebar / enquiry form read the
  letterhead and logo from the API — never hard-code gym details.
- **Configuration** (`/configuration`, `setting:manage`, `features/settings`): trial class, freeze / transfer / refund,
  renewal days, staff late grace, gym-wide. Desk screens read the values with `useDeskSettings()` (trial offer on Leads, Renewals default window) —
  never hard-code 7 / 30 days or trial lengths.
- **Trial class**: Leads → "Trials" tab; `TrialModal` (dumbbell action / trial chip under the status) books, records the
  fee, marks a visit a day, cancels while nothing is recorded. The public form shows "Book a … trial" only when enabled.
- **Membership actions** (`features/memberships`): member page → "Freeze / Transfer / Cancel" opens
  `MembershipActionsDrawer` (`membership:manage`); every limit and "why not" comes from GET
  `/memberships/member/{id}` — don't re-implement the rules. Proof files via `DocumentField` / `readDocument`
  (base64), opened with `openDocument`. Refunds list: Payments → Refunds (`RefundsDrawer`).
- **Members "Not coming"** tab (`absent`) shows last visit + a WhatsApp check-in message. **Client assessment** lives on
  the member page (`AssessmentSection` / `AssessmentDrawer`). PT "Log session" can open a WhatsApp session summary.
- **Referrals** (`/referrals`, `features/referrals`): this month's reward card (or the "contact admin" warning),
  tabs Eligible this month / Pending to give / Rewarded, `RewardProgramModal` (tiers per month),
  `MemberReferralsDrawer` (direct referrals only, month by month with the reward earned). The multi-level org chart
  is kept aside in `ReferralNetworkChart.tsx` (not used on any screen). "Referred by" uses `<MemberPicker>` on the
  member form and REFERRAL leads; Members rows have a referrals action disabled when `referral_count` is 0.
- **Discounts** come only from the Offers master: billing forms use `<OfferSelect>` (fills `offer_id` /
  `discount_amount` / `discount_reason`); never hard-code discount reasons. Pass `lines` (`{categoryId, amount}` per
  billed plan) so it lists only offers that fit those plan categories.
- **Plans**: categories come from the DB master (`usePlanCategories`, managed in `ManageCategoriesModal`); never
  hard-code categories. Show durations with `planDuration`, prices per month with `planUnitPrice`, badges with
  `<PlanBadges>`. Billing dropdowns use `usePlanLookup(type, true, true)` (on-sale plans only). Group packages use
  `GroupMembersField`; plans with `id_check` need an "ID verified" checkbox.
- **Members**: `/members/new` is the 3-step wizard (profile → plan → payment). View / edit of an existing member is
  the profile only plus the Membership card (`MembershipHistory`); plans are changed only through `RenewDrawer`
  (Renew | Upgrade tabs; also opened from Members, Subscriptions and Renewals rows). Upgrade lists every membership
  plan from GET `/subscriptions/member/{id}/upgrade`; ineligible ones stay visible but disabled with their reason.
- **"All Branches"** is read-only: use `useWriteAccess(permission)` → keep Add / Edit visible but `disabled`, with
  `reason` as the tooltip (`ActionIcon disabled disabledReason`).
- **WhatsApp**: click-to-chat via `openWhatsApp`; invoices are shared with `sendInvoiceOnWhatsApp` (no-login `/i/:token` link).
  Leads thank-you (`features/leads/lead-whatsapp.ts`, `useLeadThanks()`): booked trial → its dates (+ fee if due), no
  trial → the gym's trial offer from `useDeskSettings()`. Saving a new lead always opens it (no option). Each open
  lead shows the action once: row 💬 for ENQUIRY_FORM leads (they never got it), "Resend thank-you on WhatsApp" in
  the ⋯ menu for desk-added leads. Read-only (nothing recorded), so it also works in "All Branches". The public enquiry form's
  thank-you screen has "Chat with us on WhatsApp" (visitor → the first mobile in `contact_phone`, landlines skipped;
  no mobile = no button). "Plan to join" is optional on leads.
  Lead `notes` is the dated history (enquiry form, trial, follow-ups): Add lead takes a first note; Edit lead never
  shows or sends `notes` (sending it would overwrite the history) — new notes go in through Follow-up.
- Invoices open in a new tab: `window.open(\`/invoice/${paymentId}\`, "_blank")`.
- **PWA** (`vite-plugin-pwa`, config in `vite.config.ts`): installable app (manifest + icons in `public/`, made from a
  red tile with "S"). The service worker precaches only the built app shell — **never cache `/api`** (live data,
  per-login access; `navigateFallbackDenylist` keeps it out). `registerType: "prompt"`: `PwaUpdatePrompt` (mounted in
  `App.tsx`) shows "New version… Reload" instead of reloading under a half-filled form; open apps check hourly.
  The service worker runs only in builds (`npm run build` + `npm run preview`), not in `npm run dev`. Install needs
  HTTPS (or localhost).

## Commands
```
npm run dev        # http://localhost:5173 (proxies /api → http://127.0.0.1:8001; override with VITE_API_PROXY_TARGET)
npm run typecheck
npm run build
npm run preview    # serves the build on :4173 with the service worker (PWA install / update testing)
```
