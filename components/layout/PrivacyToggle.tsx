"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "tl-privacy";

// Privacy state lives on <html data-privacy> (set before paint by the script in
// app/layout.tsx). Components subscribe to that attribute.
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-privacy"] });
  return () => obs.disconnect();
}
const getSnapshot = () => document.documentElement.dataset.privacy === "1";
const getServerSnapshot = () => false;

/** Hides every ₹ amount (for screen sharing). Persists in localStorage. */
export function PrivacyToggle({ compact = false }: { compact?: boolean }) {
  const on = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !on;
    if (next) document.documentElement.dataset.privacy = "1";
    else delete document.documentElement.dataset.privacy;
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  }

  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Show ₹ amounts" : "Hide ₹ amounts (privacy mode)"}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        on ? "bg-warn/15 text-warn" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={18} />
      {!compact && (on ? "Privacy on" : "Privacy mode")}
    </button>
  );
}
