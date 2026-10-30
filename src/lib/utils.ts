import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "PERSONAL_TRAINING" → "Personal Training" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Indian mobile number with country code, as the old WhatsApp share used it. */
export function whatsappPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.length === 10 ? `91${phone}` : phone;
}

export function openWhatsApp(phone: string | null | undefined, text: string): void {
  const url = `https://api.whatsapp.com/send?phone=${whatsappPhone(phone)}&text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}
