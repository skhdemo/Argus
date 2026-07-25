import type { FallacyTag } from "@/lib/types/debate";

const LABELS: Record<FallacyTag, string> = {
  ad_hominem: "Ad hominem",
  strawman: "Strawman",
  circular_reasoning: "Circular",
  false_dilemma: "False dilemma",
};

const TIPS: Record<FallacyTag, string> = {
  ad_hominem: "May attack the person instead of the claim.",
  strawman: "May misrepresent the opposing position.",
  circular_reasoning: "May assume what it tries to prove.",
  false_dilemma: "May present only two options when more exist.",
};

type FallacyBadgeProps = {
  tags?: FallacyTag[];
};

export function FallacyBadge({ tags = [] }: FallacyBadgeProps) {
  if (tags.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          title={TIPS[tag]}
          className="border border-claim-pending-confirmation/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-claim-pending-confirmation"
        >
          {LABELS[tag]}
        </span>
      ))}
    </span>
  );
}
