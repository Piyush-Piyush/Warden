import type { CSSProperties } from "react";
import type { Confidence } from "@warden/shared";

const COLORS: Record<Confidence, string> = {
  low: "var(--status-critical)",
  medium: "var(--status-warning)",
  high: "var(--status-good)",
};

export function ConfidenceTag({ confidence }: { confidence: Confidence | null }) {
  if (!confidence) return <span className="wd-confidence wd-confidence--empty">no confidence yet</span>;
  return (
    <span className="wd-confidence" style={{ "--badge-color": COLORS[confidence] } as CSSProperties}>
      <span className="wd-confidence__dot" />
      {confidence}
    </span>
  );
}
