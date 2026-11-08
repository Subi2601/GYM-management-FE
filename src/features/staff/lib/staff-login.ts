import { z } from "zod";

import type { EmployeeRole } from "@/types/enums";

/** Roles that usually never sign in (the login section starts switched off for them). */
export const NO_LOGIN_ROLES: EmployeeRole[] = ["CLEANER", "SERVICE_STAFF"];

/** Easy to read out / type: no 0/O, 1/l/I. 10 chars + a digit + a symbol. */
export function generatePassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0]! % set.length]!;
  return Array.from({ length: 8 }, () => pick(letters)).join("") + pick(digits) + pick(digits) + "@";
}

/** Backend StaffLoginSave: 8–72 chars. */
export const passwordField = z.string().min(8, "At least 8 characters").max(72, "At most 72 characters");

/** Message the owner sends to the staff member (WhatsApp / copy). */
export function credentialsText(o: { name: string; email: string; password: string; branch: string; url: string }): string {
  return `Hi ${o.name},\n\nYour Stag Fitness login (${o.branch}):\n\nLink: ${o.url}\nLogin ID: ${o.email}\nPassword: ${o.password}\n\nPlease change your password after signing in.`;
}
