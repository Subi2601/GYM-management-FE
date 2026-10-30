import { useNotifications } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** The original top-right notification stack (solid green / red, click to dismiss). */
export function Toaster() {
  const items = useNotifications((s) => s.items);
  const remove = useNotifications((s) => s.remove);

  return (
    <div className="fixed right-5 top-5 z-[99999] flex w-[calc(100%-40px)] max-w-[350px] flex-col gap-3">
      {items.map((n) => (
        <div
          key={n.id}
          role={n.type === "error" ? "alert" : "status"}
          onClick={() => remove(n.id)}
          className={cn(
            "flex animate-slideIn cursor-pointer items-center break-words rounded-[10px] border border-white/10 p-4 font-medium text-white",
            "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]",
            n.type === "success" ? "bg-success" : "bg-danger",
          )}
        >
          <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
            {n.type === "success" ? "✓" : "✕"}
          </div>
          <div className="flex-1 text-sm leading-[1.4]">{n.message}</div>
        </div>
      ))}
    </div>
  );
}
