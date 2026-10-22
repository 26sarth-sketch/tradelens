import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StrategyForm } from "@/components/strategies/StrategyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { parseRules } from "@/lib/strategies";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Edit strategy" };

export default async function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const s = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!s) notFound();
  return (
    <>
      <Link href={`/strategies/${s.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> {s.name}
      </Link>
      <PageHeader title="Edit strategy" description="Editing a rule's text keeps its history; removing a rule drops it from future checklists." />
      <StrategyForm
        id={s.id}
        initial={{
          name: s.name,
          description: s.description,
          color: s.color,
          entryRules: parseRules(s.entryRules),
          exitRules: parseRules(s.exitRules),
          riskRules: parseRules(s.riskRules),
        }}
      />
    </>
  );
}
