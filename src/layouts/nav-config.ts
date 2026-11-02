import type { IconName } from "@/components/ui/Icon";

export interface NavLeaf {
  label: string;
  to: string;
  permission: string;
}

export interface NavItem {
  key: string;
  /** Sidebar section heading this item sits under. */
  group: NavGroup;
  label: string;
  icon: IconName;
  permission: string;
  to?: string;
  /** Opens the Manage Branches modal instead of navigating. */
  action?: "manage-branches";
  children?: NavLeaf[];
  /** Path prefixes that auto-expand this group. */
  match?: string[];
}

export type NavGroup = "Overview" | "Members" | "Operations" | "Team & Finance" | "Settings";

export const NAV_GROUPS: NavGroup[] = ["Overview", "Members", "Operations", "Team & Finance", "Settings"];

/** Sidebar entries of the original app.ts, grouped — visibility driven by permissions, not role names. */
export const NAV: NavItem[] = [
  { key: "dashboard", group: "Overview", label: "Dashboard", icon: "dashboard", to: "/dashboard", permission: "dashboard:view" },
  {
    key: "members", group: "Members", label: "Members", icon: "users", permission: "member:list", match: ["/members", "/subscriptions"],
    children: [
      { label: "All Members", to: "/members?filter=all", permission: "member:list" },
      { label: "Add Member", to: "/members?action=add", permission: "member:create" },
      { label: "Active Members", to: "/members?filter=active", permission: "member:list" },
      { label: "Inactive Members", to: "/members?filter=inactive", permission: "member:list" },
      { label: "Expiring Soon", to: "/members?filter=expiring", permission: "member:list" },
      { label: "Subscriptions & Renewals", to: "/subscriptions", permission: "subscription:list" },
    ],
  },
  {
    key: "leads", group: "Members", label: "Leads", icon: "userCheck", permission: "lead:list", match: ["/leads"],
    children: [
      { label: "All Leads", to: "/leads?filter=all", permission: "lead:list" },
      { label: "Add Lead", to: "/leads?action=add", permission: "lead:create" },
      { label: "Follow-ups", to: "/leads?filter=followup", permission: "lead:list" },
      { label: "Rejected", to: "/leads?filter=rejected", permission: "lead:list" },
    ],
  },
  {
    key: "staff", group: "Team & Finance", label: "Staff", icon: "users", permission: "employee:list", match: ["/staff", "/salary"],
    children: [
      { label: "All Staff", to: "/staff?filter=all", permission: "employee:list" },
      { label: "Add Staff", to: "/staff?action=add", permission: "employee:create" },
      { label: "Active Staff", to: "/staff?filter=active", permission: "employee:list" },
      { label: "Archive (Terminated)", to: "/staff?filter=archive", permission: "employee:list" },
      { label: "Payroll & Salary", to: "/salary", permission: "salary:list" },
    ],
  },
  { key: "attendance", group: "Operations", label: "Attendance", icon: "file", to: "/attendance", permission: "attendance:list" },
  { key: "pt", group: "Operations", label: "Personal Training", icon: "wrench", to: "/personal-training", permission: "pt:list" },
  { key: "diet", group: "Operations", label: "Diet Plans", icon: "cup", to: "/diet-plans", permission: "diet:list" },
  { key: "plans", group: "Operations", label: "Plans", icon: "calendar", to: "/plans", permission: "plan:list" },
  { key: "payments", group: "Team & Finance", label: "Accounts & Finance", icon: "money", to: "/payments", permission: "payment:list" },
  { key: "branches", group: "Settings", label: "Manage Branches", icon: "pin", action: "manage-branches", permission: "branch:list" },
];

/** Label of the screen at `pathname` (header title); falls back to the app name. */
export function screenLabel(pathname: string): string {
  for (const item of NAV) {
    if (item.to && pathname.startsWith(item.to)) return item.label;
    const path = (to: string | undefined) => to?.split("?")[0] ?? "";
    const leaf = item.children?.find((c) => pathname.startsWith(path(c.to)));
    // Leaves on the group's own screen (/members?filter=…) show the group name; others (/salary) their own.
    if (leaf) return path(leaf.to) === path(item.children?.[0]?.to) ? item.label : leaf.label;
  }
  return "Stag Fitness";
}

/** First screen this account may open (dashboard for owners, members for trainers). */
export function homePath(can: (p: string) => boolean): string {
  const first = NAV.find((n) => can(n.permission) && (n.to || n.children));
  if (!first) return "/forbidden";
  return first.to ?? first.children?.[0]?.to.split("?")[0] ?? "/forbidden";
}
