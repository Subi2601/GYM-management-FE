import { useCallback } from "react";

import { useDeskSettings } from "@/features/settings/api";
import { formatDate, formatINR } from "@/lib/format";
import { openWhatsApp } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import type { DeskSettings } from "@/types/settings";
import type { Lead } from "@/types/lead";

type TrialOffer = Pick<DeskSettings, "trial_enabled" | "trial_days" | "trial_fee">;

/**
 * Thank-you message for an enquiry (click-to-chat like every other WhatsApp message here: the desk presses Send).
 * Booked trial → its dates (and the fee if still due); no trial yet → the gym's trial offer, when trials are on.
 */
export function leadThanksMessage(lead: Lead, gymName: string, branch: string | null, offer?: TrialOffer): string {
  const gym = `*${gymName.toUpperCase()}*`;
  const at = branch ? `${gym} (${branch})` : gym;
  const lines = [`Hi ${lead.name} 👋`, "", `Thank you for contacting ${at}! 🙏`];

  if (lead.trial_start && lead.trial_end && lead.trial_state !== "ENDED") {
    const fee = lead.trial_fee ?? 0;
    lines.push("", lead.trial_start === lead.trial_end
      ? `Your trial session is booked for *${formatDate(lead.trial_start)}*.`
      : `Your trial is booked from *${formatDate(lead.trial_start)}* to *${formatDate(lead.trial_end)}*.`);
    if (fee > 0 && !lead.trial_paid_on) lines.push(`Trial fee ${formatINR(fee, true)}, pay at the front desk.`);
    lines.push("Bring sports shoes and a water bottle. See you at the gym! 💪");
  } else if (!lead.trial_start && offer?.trial_enabled && offer.trial_days > 0) {
    const free = offer.trial_fee > 0 ? "" : "free ";
    const fee = offer.trial_fee > 0 ? ` (fee ${formatINR(offer.trial_fee, true)})` : "";
    lines.push("", "Our team will call you shortly about our plans.",
      `🎁 Try us first with a ${free}${offer.trial_days}-day trial${fee}. Reply *TRIAL* to book your start day.`);
  } else {
    lines.push("", "Our team will call you shortly about our plans. 💪");
  }

  lines.push("", "Any questions? Just reply here.");
  return lines.join("\n");
}

export function sendLeadThanks(lead: Lead, gymName: string, branch: string | null, offer?: TrialOffer): void {
  openWhatsApp(lead.phone, leadThanksMessage(lead, gymName, branch, offer));
}

/** `(lead) => void` that opens the thank-you chat with the gym name, the lead's branch and the trial offer filled in. */
export function useLeadThanks(): (lead: Lead) => void {
  const gymName = useAuthStore((s) => s.me?.user.organization_name) ?? "our gym";
  const branches = useAuthStore((s) => s.me?.branches);
  const offer = useDeskSettings().data;
  return useCallback((lead: Lead) => sendLeadThanks(lead, gymName,
    branches?.find((b) => b.id === lead.branch_id)?.branch_name ?? null, offer), [gymName, branches, offer]);
}
