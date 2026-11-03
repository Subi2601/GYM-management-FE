import { z } from "zod";

import { RichSelect, type RichOptionGroup } from "@/components/ui/RichSelect";
import type { IconName } from "@/components/ui/Icon";
import { FITNESS_GOALS, type FitnessGoal } from "@/types/enums";

/** Zod field for a goal select: "" while nothing is picked, so `reset()` always clears it. */
export const goalField = z.union([z.enum(FITNESS_GOALS), z.literal("")]);
// `: boolean` stops TS inferring a type guard, which would drop "" from the form's value type.
export const requiredGoalField = (message: string) => goalField.refine((v): boolean => v !== "", message);

/** Label, hint and icon per goal — wording a coach and a client both recognise; codes mirror backend `FitnessGoal`. */
const GOAL_META: Record<FitnessGoal, { label: string; hint: string; icon: IconName }> = {
  WEIGHT_LOSS: { label: "Weight loss / fat loss", hint: "Burn fat, lose inches", icon: "flame" },
  MUSCLE_GAIN: { label: "Muscle gain", hint: "Build size and muscle", icon: "dumbbell" },
  BODY_TONING: { label: "Body toning", hint: "Lose fat and firm up", icon: "target" },
  WEIGHT_GAIN: { label: "Healthy weight gain", hint: "For underweight clients", icon: "trending" },
  STRENGTH: { label: "Strength training", hint: "Lift heavier, get stronger", icon: "zap" },
  ENDURANCE: { label: "Stamina & endurance", hint: "Cardio, running, cycling", icon: "activity" },
  SPORTS_PERFORMANCE: { label: "Sports performance", hint: "Speed, agility and power for a sport", icon: "flag" },
  COMPETITION_PREP: { label: "Bodybuilding / competition prep", hint: "Physique and stage shows", icon: "award" },
  GENERAL_FITNESS: { label: "General fitness & health", hint: "Stay fit and active", icon: "heart" },
  FLEXIBILITY: { label: "Flexibility & mobility", hint: "Posture, stretching, joint mobility", icon: "move" },
  REHAB: { label: "Injury rehab / pain relief", hint: "Back, knee or shoulder pain", icon: "shield" },
  MEDICAL_CONDITION: { label: "Diabetes, BP, thyroid or PCOS", hint: "Lifestyle condition management", icon: "medical" },
  PRE_POST_NATAL: { label: "Pre / post pregnancy fitness", hint: "Safe training before and after delivery", icon: "smile" },
  SENIOR_FITNESS: { label: "Senior fitness", hint: "Balance, strength and mobility for 60+", icon: "user" },
  STRESS_RELIEF: { label: "Stress relief & wellness", hint: "Feel better, sleep better", icon: "feather" },
  OTHER: { label: "Other", hint: "Note the details in the notes", icon: "more" },
};

/** Sections in the order a coach asks "what do you want to achieve?". */
const GOAL_GROUPS: RichOptionGroup<FitnessGoal>[] = ([
  ["Body composition", ["WEIGHT_LOSS", "MUSCLE_GAIN", "BODY_TONING", "WEIGHT_GAIN"]],
  ["Performance", ["STRENGTH", "ENDURANCE", "SPORTS_PERFORMANCE", "COMPETITION_PREP"]],
  ["Health & lifestyle", ["GENERAL_FITNESS", "FLEXIBILITY", "REHAB", "MEDICAL_CONDITION", "PRE_POST_NATAL",
    "SENIOR_FITNESS", "STRESS_RELIEF"]],
  ["Other", ["OTHER"]],
] as const).map(([label, goals]) => ({ label, options: goals.map((value) => ({ value, ...GOAL_META[value] })) }));

/** Display label of a goal code (lead, member and PT goals); null when not set. */
export function goalLabel(value: FitnessGoal | null | undefined): string | null {
  return value ? GOAL_META[value].label : null;
}

interface FitnessGoalSelectProps {
  id?: string;
  value: FitnessGoal | "";
  onChange: (value: FitnessGoal | "") => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Optional fields: adds a "Not set" choice that clears the goal. */
  optional?: boolean;
}

/** Goal picker for lead, member and PT forms (use with RHF `<Controller>`). */
export function FitnessGoalSelect({ optional = false, ...rest }: FitnessGoalSelectProps) {
  return (
    <RichSelect {...rest} groups={GOAL_GROUPS} searchable placeholder={optional ? "Not set" : "Select a goal"}
      emptyOption={optional ? "Not set" : undefined} />
  );
}
