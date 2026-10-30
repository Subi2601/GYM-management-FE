import type { IconName } from "@/components/ui/Icon";

export interface NavLeaf {
  label: string;
  to: string;
  permission: string;
}

export interface NavItem {
  key: string;
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

/** Sidebar exactly as the original app.ts — visibility now driven by permissions, not role names. */
export const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", to: "/dashboard", permission: "dashboard:view" },
  { key: "branches", label: "Manage Branches", icon: "pin", action: "manage-branches", permission: "branch:list" },
  {
    key: "members", label: "Members", icon: "users", permission: "member:list", match: ["/members", "/subscriptions"],
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
    key: "leads", label: "Leads", icon: "userCheck", permission: "lead:list", match: ["/leads"],
    children: [
      { label: "All Leads", to: "/leads?filter=all", permission: "lead:list" },
      { label: "Add Lead", to: "/leads?action=add", permission: "lead:create" },
      { label: "Follow-ups", to: "/leads?filter=followup", permission: "lead:list" },
      { label: "Rejected", to: "/leads?filter=rejected", permission: "lead:list" },
    ],
  },
  {
    key: "staff", label: "Staff", icon: "users", permission: "employee:list", match: ["/staff", "/salary"],
    children: [
      { label: "All Staff", to: "/staff?filter=all", permission: "employee:list" },
      { label: "Add Staff", to: "/staff?action=add", permission: "employee:create" },
      { label: "Active Staff", to: "/staff?filter=active", permission: "employee:list" },
      { label: "Archive (Terminated)", to: "/staff?filter=archive", permission: "employee:list" },
      { label: "Payroll & Salary", to: "/salary", permission: "salary:list" },
    ],
  },
  { key: "attendance", label: "Attendance", icon: "file", to: "/attendance", permission: "attendance:list" },
  { key: "pt", label: "Personal Training", icon: "wrench", to: "/personal-training", permission: "pt:list" },
  { key: "diet", label: "Diet Plans", icon: "cup", to: "/diet-plans", permission: "diet:list" },
  { key: "plans", label: "Plans", icon: "calendar", to: "/plans", permission: "plan:list" },
  { key: "payments", label: "Accounts & Finance", icon: "money", to: "/payments", permission: "payment:list" },
];

/** First screen this account may open (dashboard for owners, members for trainers). */
export function homePath(can: (p: string) => boolean): string {
  const first = NAV.find((n) => can(n.permission) && (n.to || n.children));
  if (!first) return "/forbidden";
  return first.to ?? first.children?.[0]?.to.split("?")[0] ?? "/forbidden";
}
