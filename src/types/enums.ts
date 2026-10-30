/** Mirrors app/core/enums.py — keep in sync with the backend registry. */
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export const MEMBER_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type MembershipState = "ACTIVE" | "EXPIRING" | "EXPIRED" | "NO_PLAN";

export const LEAD_STATUSES = ["NEW", "FOLLOW_UP", "JOINED", "NOT_INTERESTED", "JOINED_ELSEWHERE"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PLAN_TYPES = ["MEMBERSHIP", "ADD_ON"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_SERVICE_TYPES = ["GENERAL", "PERSONAL_TRAINING", "DIET"] as const;
export type PlanServiceType = (typeof PLAN_SERVICE_TYPES)[number];

export type RenewalState = "NONE" | "EXPIRING" | "EXPIRED";
export type PaymentStatus = "PAID" | "PENDING";

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PT_STATUSES = ["ACTIVE", "COMPLETED", "EXPIRED"] as const;
export type PTStatus = (typeof PT_STATUSES)[number];

export const EMPLOYEE_ROLES = ["TRAINER", "ADMIN", "CLEANER", "SERVICE_STAFF", "MANAGER", "OWNER"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type SalaryStatus = "PENDING" | "PAID";

export const DIET_TIERS = ["BASIC", "STANDARD", "PREMIUM"] as const;
export type DietTier = (typeof DIET_TIERS)[number];

export const DIET_CATEGORIES = ["VEG", "NON_VEG"] as const;
export type DietCategory = (typeof DIET_CATEGORIES)[number];

export const MEAL_TIMES = ["Breakfast", "Lunch", "Evening Snack", "Dinner"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export const FOOD_CATEGORIES = ["VEG", "NON_VEG", "VEGAN"] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];
