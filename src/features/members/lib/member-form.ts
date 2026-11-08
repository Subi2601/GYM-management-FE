import { z } from "zod";

import { goalField } from "@/features/lookups/fitness-goals";
import { todayISO } from "@/lib/format";
import { GENDERS } from "@/types/enums";
import type { Member, MemberInput } from "@/types/member";

const optionalMeasure = (max: number) =>
  z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= max),
    `Must be greater than 0 and at most ${max}`);

/** Step 1 — as strict as backend MemberCreate (Phone = 10 digits, lengths, weight/height ranges). */
export const memberProfileSchema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(120),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  gender: z.enum(GENDERS),
  dob: z.string(),
  blood_group: z.string().trim().max(5, "Max 5 characters"),
  address: z.string().trim().max(300),
  weight: optionalMeasure(400),
  height: optionalMeasure(300),
  fitness_goal: goalField,  // optional: "" = not set
  emergency_contact_name: z.string().trim().max(120),
  emergency_contact_phone: z.string().trim().refine((v) => v === "" || /^\d{10}$/.test(v), "Enter a valid 10-digit mobile number"),
  joining_date: z.string().min(1, "Joining date is required"),
  /** "" = not referred. */
  referred_by_id: z.string(),
});
export type MemberProfileValues = z.infer<typeof memberProfileSchema>;

export function toProfileValues(member: Member | null): MemberProfileValues {
  return {
    name: member?.name ?? "",
    phone: member?.phone ?? "",
    gender: member?.gender ?? "MALE",
    dob: member?.dob ?? "",
    blood_group: member?.blood_group ?? "",
    address: member?.address ?? "",
    weight: member?.weight != null ? String(member.weight) : "",
    height: member?.height != null ? String(member.height) : "",
    fitness_goal: member?.fitness_goal ?? "",
    emergency_contact_name: member?.emergency_contact_name ?? "",
    emergency_contact_phone: member?.emergency_contact_phone ?? "",
    joining_date: member?.joining_date ?? todayISO(),
    referred_by_id: member?.referred_by_id ?? "",
  };
}

const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Request body for POST / PUT /members. ID proof is no longer captured; stored values are left untouched. */
export function toMemberBody(v: MemberProfileValues): MemberInput {
  const body: MemberInput = {
    name: v.name.trim(),
    phone: v.phone.trim(),
    gender: v.gender,
    dob: v.dob || null,
    blood_group: textOrNull(v.blood_group),
    address: textOrNull(v.address),
    weight: numberOrNull(v.weight),
    height: numberOrNull(v.height),
    fitness_goal: v.fitness_goal || null,
    emergency_contact_name: textOrNull(v.emergency_contact_name),
    emergency_contact_phone: textOrNull(v.emergency_contact_phone),
    joining_date: v.joining_date,
    referred_by_id: v.referred_by_id || null,
  };
  return body;
}
