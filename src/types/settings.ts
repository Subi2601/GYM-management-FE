/** GET / PUT /settings — gym-wide settings (backend app/schemas/settings.py). */
export interface GymSettings {
  /** Gym ID, set at onboarding (read-only). */
  gym_code: string;
  /** Member ids look like <prefix>-001 (read-only). */
  member_id_prefix: string;
  trial_enabled: boolean;
  trial_days: number;
  /** 0 = free trial. */
  trial_fee: number;
  /** "Expiring" = membership ends within this many days (Members tab, Renewals default window). */
  renewal_due_days: number;
  /** Lapsed memberships stay on Renewals this long. */
  renewal_overdue_days: number;
  /** Staff are late after shift start + this. */
  late_grace_minutes: number;
  /** Staff coming this late (from shift start) get a half day; 0 = never. */
  half_day_after_minutes: number;
  /** Members → "Not coming": no visit for this many days. */
  absent_alert_days: number;
  freeze_enabled: boolean;
  /** Freeze days per membership; 0 = only members given their own days. */
  freeze_max_days: number;
  freeze_max_times: number;
  transfer_enabled: boolean;
  transfer_within_days: number;
  refund_within_days: number;
  refund_deduction_percent: number;
}

export type GymSettingsInput = Omit<GymSettings, "gym_code" | "member_id_prefix">;

/** GET /settings/desk — read-only values the desk screens show (any signed-in account). */
export type DeskSettings = Pick<GymSettings, "gym_code" | "trial_enabled" | "trial_days" | "trial_fee" | "renewal_due_days"
  | "renewal_overdue_days" | "absent_alert_days">;
