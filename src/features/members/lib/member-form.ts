import { z } from "zod";

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
  fitness_goal: z.string().trim().max(200),
  emergency_contact_name: z.string().trim().max(120),
  emergency_contact_phone: z.string().trim().refine((v) => v === "" || /^\d{10}$/.test(v), "Enter a valid 10-digit mobile number"),
  joining_date: z.string().min(1, "Joining date is required"),
  id_proof_type: z.string().trim().max(40),
  id_proof_number: z.string().trim().max(40),
});
export type MemberProfileValues = z.infer<typeof memberProfileSchema>;

export const ID_PROOF_TYPES = ["Aadhaar", "PAN", "Driving License", "Voter ID", "Passport", "Other"] as const;

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
    id_proof_type: member?.id_proof_type ?? "",
    id_proof_number: member?.id_proof_number ?? "",
  };
}

const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Request body for POST / PUT /members. `includeIdProofNumber` is false on edit when the number was not
 * touched — it may arrive masked (XXXX-XXXX-1234) and must not be written back.
 */
export function toMemberBody(v: MemberProfileValues, includeIdProofNumber: boolean): MemberInput {
  const body: MemberInput = {
    name: v.name.trim(),
    phone: v.phone.trim(),
    gender: v.gender,
    dob: v.dob || null,
    blood_group: textOrNull(v.blood_group),
    address: textOrNull(v.address),
    weight: numberOrNull(v.weight),
    height: numberOrNull(v.height),
    fitness_goal: textOrNull(v.fitness_goal),
    emergency_contact_name: textOrNull(v.emergency_contact_name),
    emergency_contact_phone: textOrNull(v.emergency_contact_phone),
    joining_date: v.joining_date,
    id_proof_type: textOrNull(v.id_proof_type),
  };
  if (includeIdProofNumber) body.id_proof_number = textOrNull(v.id_proof_number);
  return body;
}
