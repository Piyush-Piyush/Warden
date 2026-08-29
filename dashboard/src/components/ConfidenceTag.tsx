import type { Confidence } from "@warden/shared";

const COLORS: Record<Confidence, string> = {
  low: "#c0392b",
  medium: "#d59b2b",
  high: "#3a9f5c",
};

export function ConfidenceTag({ confidence }: { confidence: Confidence | null }) {
  if (!confidence) return <span style={{ color: "#999" }}>—</span>;
  return (
    <span style={{ color: COLORS[confidence], fontWeight: 600, textTransform: "uppercase", fontSize: 12 }}>
      {confidence}
    </span>
  );
}
