import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

/** Square sun / moon button that flips between the white and dark theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <button type="button" onClick={toggle}
      aria-label={theme === "dark" ? "Switch to white theme" : "Switch to dark theme"}
      title={theme === "dark" ? "White theme" : "Dark theme"}
      className={cn(
        "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface text-secondary-grey transition-all hover:border-line-accent hover:text-accent",
        className,
      )}>
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}
