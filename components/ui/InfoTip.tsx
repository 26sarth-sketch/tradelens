import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Small "how is this calculated?" tooltip. Hover or keyboard-focus to open. */
export function InfoTip({ children, learnHref }: { children: ReactNode; learnHref?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label="How is this calculated?" className="text-muted/70 hover:text-fg focus:text-fg focus:outline-none">
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-5 z-20 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-2 p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-fg opacity-0 shadow-xl transition-opacity group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
      >
        {children}
        {learnHref && (
          <Link href={learnHref} className="mt-2 block text-accent underline">Learn more</Link>
        )}
      </span>
    </span>
  );
}
