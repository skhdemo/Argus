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
  unsupported?: boolean;
};

export function FallacyBadge({ tags = [], unsupported }: FallacyBadgeProps) {
  if (!unsupported && tags.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {unsupported && (
        <span
          title="Structurally unsupported — not a truth verdict"
          className="border border-claim-needs-evidence/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-claim-needs-evidence"
        >
          Unsupported
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag}
          title={TIPS[tag]}
          className="border border-accent-warm/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-warm"
        >
          {LABELS[tag]}
        </span>
      ))}
    </span>
  );
}
