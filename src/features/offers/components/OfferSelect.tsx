import { useEffect, useRef } from "react";

import { Field, Select } from "@/components/ui/Field";
import { formatPercent, useAvailableOffers } from "@/features/offers/api";
import { round2 } from "@/features/subscriptions/lib/billing";
import { formatINR } from "@/lib/format";
import type { Offer } from "@/types/offer";

type OfferFieldName = "offer_id" | "discount_amount" | "discount_reason";

/** One billed plan: its category (undefined = unknown → counts for every offer) and amount. */
export interface OfferLine {
  categoryId?: string;
  amount: number;
}

interface Props {
  id: string;
  /** What is being billed; an offer applies only to lines in its categories (all lines when it has none). */
  lines: OfferLine[];
  /** Selected offer id ("" = none). */
  value: string;
  /** Writes offer_id / discount_amount / discount_reason into the billing form (RHF `setValue`). */
  setField: (name: OfferFieldName, value: string) => void;
  /** Text of the "no offer" option, e.g. "Keep current discount (₹500)". */
  noneLabel?: string;
  className?: string;
}

const applies = (offer: Offer, line: OfferLine) =>
  offer.category_ids.length === 0 || line.categoryId === undefined || offer.category_ids.includes(line.categoryId);

/** Amount the offer's % applies to — the backend computes the same from offer_id. */
const eligibleAmount = (offer: Offer, lines: OfferLine[]) =>
  lines.reduce((sum, l) => sum + (applies(offer, l) ? l.amount : 0), 0);

/**
 * Billing "Offer" dropdown — offers come from the master (Offers screen), the % is fixed by the offer and lists only
 * offers that fit the plans being billed (e.g. Diwali on General + Student only). Picking one fills the form's
 * discount and reason; the backend recomputes it from offer_id.
 */
export function OfferSelect({ id, lines, value, setField, noneLabel = "No offer", className }: Props) {
  const offers = useAvailableOffers();
  const fitting = (offers.data ?? []).filter((o) => eligibleAmount(o, lines) > 0);
  const offer = fitting.find((o) => o.id === value);
  const base = offer ? eligibleAmount(offer, lines) : 0;
  const amount = offer ? round2((base * offer.discount_percent) / 100) : 0;
  const total = lines.reduce((s, l) => s + l.amount, 0);

  // Latest setter without re-running the effect when the parent passes a new inline function each render.
  const setRef = useRef(setField);
  setRef.current = setField;

  // Keep the discount in step with the offer and the plans; drop an offer that no longer fits the plans.
  useEffect(() => {
    if (value && offers.data && !offer) {
      setRef.current("offer_id", "");
      setRef.current("discount_amount", "");
      setRef.current("discount_reason", "");
      return;
    }
    if (!offer) return;
    setRef.current("discount_amount", String(amount));
    setRef.current("discount_reason", offer.discount_percent ? `${offer.name} (${formatPercent(offer.discount_percent)})` : offer.name);
  }, [offer, amount, value, offers.data]);

  const choose = (next: string) => {
    setField("offer_id", next);
    if (!next) {
      setField("discount_amount", "");
      setField("discount_reason", "");
    }
  };

  const money = offer?.discount_percent
    ? `${formatPercent(offer.discount_percent)} off${base < total ? ` on ${formatINR(base, true)} of the plans` : ""} · saves ${formatINR(amount)}`
    : "";
  const bonus = offer ? offer.summary.split(" · ").filter((p) => !p.endsWith("% off")).join(" · ") : "";
  const hint = offer
    ? [money, bonus].filter(Boolean).join(" · ")
    : offers.data && fitting.length === 0 ? "No offers for these plans. Add them on the Offers screen" : undefined;

  return (
    <Field label="Offer" htmlFor={id} hint={hint} className={className}>
      <Select id={id} value={offer ? value : ""} onChange={(e) => choose(e.target.value)}>
        <option value="">{offers.isLoading ? "Loading offers…" : noneLabel}</option>
        {fitting.map((o) => (
          <option key={o.id} value={o.id}>{o.name} · {o.summary}</option>
        ))}
      </Select>
    </Field>
  );
}
