import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  key: string;
  /** Sidebar section heading this item sits under. */
  group: NavGroup;
  label: string;
  icon: IconName;
  permission: string;
  to: string;
}

export type NavGroup = "Overview" | "Clients" | "Team" | "Finance" | "Settings";

export const NAV_GROUPS: NavGroup[] = ["Overview", "Clients", "Team", "Finance", "Settings"];

/**
 * One link per screen. List filters (active / expiring / follow-ups / archive …) are tabs on the screen
 * itself and "Add" is the screen's primary button. Visibility is driven by permissions, never role names.
 */
export const NAV: NavItem[] = [
  { key: "dashboard", group: "Overview", label: "Dashboard", icon: "dashboard", to: "/dashboard", permission: "dashboard:view" },
  // Client journey order: enquiry → member → membership → services.
  { key: "leads", group: "Clients", label: "Leads", icon: "userCheck", to: "/leads", permission: "lead:list" },
  { key: "members", group: "Clients", label: "Members", icon: "users", to: "/members", permission: "member:list" },
  { key: "referrals", group: "Clients", label: "Referrals", icon: "tree", to: "/referrals", permission: "referral:list" },
  { key: "subscriptions", group: "Clients", label: "Subscriptions", icon: "repeat", to: "/subscriptions", permission: "subscription:list" },
  { key: "renewals", group: "Clients", label: "Renewals", icon: "clock", to: "/renewals", permission: "subscription:list" },
  { key: "pt", group: "Clients", label: "Personal Training", icon: "dumbbell", to: "/personal-training", permission: "pt:list" },
  { key: "diet", group: "Clients", label: "Diet Plans", icon: "cup", to: "/diet-plans", permission: "diet:list" },
  { key: "staff", group: "Team", label: "Staff", icon: "user", to: "/staff", permission: "employee:list" },
  { key: "attendance", group: "Team", label: "Attendance", icon: "clipboard", to: "/attendance", permission: "attendance:list" },
  { key: "salary", group: "Team", label: "Payroll", icon: "wallet", to: "/salary", permission: "salary:list" },
  { key: "payments", group: "Finance", label: "Payments", icon: "card", to: "/payments", permission: "payment:list" },
  { key: "plans", group: "Finance", label: "Plans & Pricing", icon: "tag", to: "/plans", permission: "plan:list" },
  { key: "offers", group: "Finance", label: "Offers", icon: "flame", to: "/offers", permission: "offer:list" },
  { key: "gym-settings", group: "Settings", label: "Gym Settings", icon: "building", to: "/gym-settings", permission: "gym:manage" },
  { key: "roles", group: "Settings", label: "Roles & Access", icon: "shield", to: "/roles", permission: "role:list" },
  { key: "configuration", group: "Settings", label: "Configuration", icon: "sliders", to: "/configuration", permission: "setting:manage" },
];

/** Label of the screen at `pathname` (header title); falls back to the app name. */
export function screenLabel(pathname: string): string {
  return NAV.find((item) => item.to && pathname.startsWith(item.to))?.label ?? "Stag Fitness";
}

/** First screen this account may open (dashboard for owners, members for trainers). */
export function homePath(can: (p: string) => boolean): string {
  return NAV.find((n) => can(n.permission) && n.to)?.to ?? "/forbidden";
}
