import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="sign text-2xl leading-8 sm:text-3xl sm:leading-9">{title}</h1>
        <span className="title-bar" aria-hidden />
        {description && <div className="mt-2 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
