/** GET /dashboard/summary — see backend app/schemas/dashboard.py */
export interface GrowthPoint {
  /** "Oct 2026" */
  month: string;
  new_members: number;
  revenue: number;
}

export interface DashboardSummary {
  total_members: number;
  active_members: number;
  total_revenue: number;
  today_revenue: number;
  expiring_this_week: number;
  /** NEW + FOLLOW_UP */
  open_leads: number;
  /** Last 6 months, oldest first. */
  growth: GrowthPoint[];
}
