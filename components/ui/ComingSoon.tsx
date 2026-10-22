import { PageHeader } from "./PageHeader";

/** Placeholder for screens that land in a later build step. */
export function ComingSoon({ title, description, step }: { title: string; description: string; step: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
        Coming in {step}.
      </div>
    </>
  );
}
