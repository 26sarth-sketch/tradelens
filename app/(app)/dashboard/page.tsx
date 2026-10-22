import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateTimeIST, formatINR, formatINRCompact } from "@/lib/format";

export const metadata = { title: "Dashboard" };

// Temporary setup check. Replaced by the real dashboard in Day 1, step 7.
export default async function DashboardPage() {
  const users = await db.user.count();
  const checks = [
    { label: "Database", value: `Connected · ${users} user(s)` },
    { label: "AI key", value: process.env.ANTHROPIC_API_KEY ? "Configured" : "Not set (AI Coach disabled)" },
    { label: "₹ format", value: `${formatINR(125000)} · ${formatINR(-1250.5, { decimals: true })} · ${formatINRCompact(14_000_000)}` },
    { label: "IST time", value: formatDateTimeIST(new Date()) },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Setup check. Real dashboard arrives in Day 1, step 7." />
      <div className="grid gap-4 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-wide text-muted">{c.label}</div>
            <div className="tabular mt-1 text-lg">{c.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}
