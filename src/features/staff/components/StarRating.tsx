import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** Five read-only stars (original `star-small` / `.filled`): amber filled, light grey empty. */
export function StarRating({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          strokeWidth={1.5}
          className={cn("h-4 w-4", i <= value ? "fill-[#fbbf24] text-[#fbbf24]" : "fill-line text-faint")}
        />
      ))}
    </div>
  );
}

/** Big amber average with a star (original `.rating-header-mini`). */
export function AverageRating({ value }: { value: number | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-extrabold text-warning">{value != null ? value.toFixed(1) : "—"}</span>
      <Icon name="star" strokeWidth={1.5} className="h-6 w-6 fill-[#fbbf24] text-[#fbbf24]" />
    </div>
  );
}
