import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({ title, children, className, actions }: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={clsx("min-w-0 rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="arcade text-[10px] uppercase leading-4 tracking-wide text-muted">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-base font-medium">{children}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}
