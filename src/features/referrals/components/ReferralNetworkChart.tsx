/**
 * KEPT FOR LATER — multi-level referral network chart (org chart, top to bottom, all levels, colour legend).
 * Not used on any screen right now: rewards count only direct referrals, so the app shows the direct list
 * (`MemberReferralsDrawer`). To use it, fetch GET /referrals/tree/{member}?levels=8 and render
 * `<ReferralNetworkChart root={tree.root} onOpen={…} />` with `<ReferralNetworkLegend />` beside it.
 */
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types/referral";

/** Node colours (same order as the legend). A member who got a reward is green even if also counted. */
const STATE = {
  rewarded: { label: "Got a reward", hint: "This member received a referral reward", card: "border-success bg-success-soft", dot: "bg-success" },
  due: { label: "Reward due", hint: "Reached a reward: this month or waiting to be given", card: "border-info bg-info-soft", dot: "bg-info" },
  counted: { label: "Counted for a reward", hint: "Their joining made their referrer eligible / rewarded", card: "border-warning bg-warning-soft", dot: "bg-warning" },
  none: { label: "Referred", hint: "Referred, not counted for any reward yet", card: "border-line bg-surface", dot: "bg-line-strong" },
} as const;

const stateOf = (n: TreeNode) => (n.rewarded ? STATE.rewarded : n.reward_due ? STATE.due : n.counted ? STATE.counted : STATE.none);

/** Everyone below the root, counted per level: [direct, 2nd level, 3rd …]. */
export function levelCounts(root: TreeNode): number[] {
  const out: number[] = [];
  let level = root.children;
  while (level.length) {
    out.push(level.length);
    level = level.flatMap((n) => n.children);
  }
  return out;
}

const LEVEL_NAME = ["Direct", "2nd level", "3rd level"];
export const levelName = (i: number) => LEVEL_NAME[i] ?? `${i + 1}th level`;

function NodeCard({ node, root, depth, via, onOpen }: {
  node: TreeNode; root?: boolean; depth: number; via?: string; onOpen: (id: string) => void;
}) {
  const s = stateOf(node);
  return (
    <button type="button" onClick={() => onOpen(node.member_id)} title="Open member"
      className={cn("relative flex w-48 shrink-0 cursor-pointer items-start gap-2 rounded-xl border-[1.5px] px-2.5 pb-2 pt-3 text-left",
        s.card, root && "ring-2 ring-[var(--ring)]")}>
      {!root && (
        <span className={cn("absolute -top-2.5 left-2.5 max-w-[85%] truncate rounded-full border px-2 py-px text-[10px] font-bold",
          depth === 1 ? "border-line-accent bg-accent-light text-accent" : "border-line bg-surface text-secondary-grey")}>
          {depth === 1 ? "Direct referral" : `${levelName(depth - 1)} · via ${via}`}
        </span>
      )}
      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink" title={node.name}>{node.name}</span>
        <span className="block font-mono text-[11px] font-semibold text-secondary-grey">{node.registration_id}</span>
        <span className="block truncate text-xs text-ink" title={node.plan_name ?? undefined}>{node.plan_name ?? "No plan"}</span>
        <span className="block truncate text-[11px] text-muted">{node.plan_end ? `till ${formatDate(node.plan_end)}` : ""}</span>
        {node.referral_count > 0 && (
          <span className="mt-0.5 block text-[11px] font-semibold text-secondary-grey">Referred {node.referral_count} directly</span>
        )}
      </span>
    </button>
  );
}

/** Top-to-bottom tree (org chart): a member, then the people they referred side by side below, joined by lines. */
export function ReferralNetworkChart({ root, onOpen }: { root: TreeNode; onOpen: (id: string) => void }) {
  return <Row node={root} root onOpen={onOpen} />;
}

function Row({ node, root, depth = 0, via, onOpen }: {
  node: TreeNode; root?: boolean; depth?: number; via?: string; onOpen: (id: string) => void;
}) {
  const kids = node.children;
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} root={root} depth={depth} via={via} onOpen={onOpen} />
      {kids.length > 0 && (
        <>
          <span aria-hidden className="h-5 w-0.5 bg-line-strong" />
          <ul className="m-0 flex list-none items-start p-0">
            {kids.map((child, i) => (
              <li key={child.member_id} className="relative flex flex-col items-center px-2 pt-7">
                {kids.length > 1 && (
                  <span aria-hidden className={cn("absolute top-0 h-0.5 bg-line-strong",
                    i === 0 ? "left-1/2 right-0" : i === kids.length - 1 ? "left-0 right-1/2" : "left-0 right-0")} />
                )}
                <span aria-hidden className="absolute left-1/2 top-0 h-7 w-0.5 -translate-x-1/2 bg-line-strong" />
                <Row node={child} depth={depth + 1} via={node.name} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** What each node colour means. */
export function ReferralNetworkLegend() {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {Object.values(STATE).map((s) => (
        <li key={s.label} className="flex items-start gap-2">
          <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border-[1.5px]", s.card)} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-ink">{s.label}</span>
            <span className="block text-[11px] text-muted">{s.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
