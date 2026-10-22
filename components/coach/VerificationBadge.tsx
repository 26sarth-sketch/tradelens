import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { Verification } from "@/lib/ai/verify";

/** Shows whether every figure the AI wrote matches the numbers computed from your journal. */
export function VerificationBadge({ v }: { v: Verification }) {
  if (v.checked === 0) return null;
  if (v.unverified.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-profit/10 px-2 py-0.5 text-xs text-profit" title="Every ₹, % and R figure in this response was checked against numbers computed from your journal.">
        <ShieldCheck size={13} /> All {v.checked} figures verified against your data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn" title={`Not found in your data: ${v.unverified.join(", ")}`}>
      <AlertTriangle size={13} /> {v.unverified.length} of {v.checked} figures couldn&apos;t be verified: {v.unverified.slice(0, 3).join(", ")}
    </span>
  );
}
