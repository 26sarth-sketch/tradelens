import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StrategyForm } from "@/components/strategies/StrategyForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "New strategy" };

export default function NewStrategyPage() {
  return (
    <>
      <Link href="/strategies" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Strategies
      </Link>
      <PageHeader title="New strategy" description="Write the rules you'll check on every trade. Short, specific rules work best." />
      <StrategyForm
        id={null}
        initial={{
          name: "",
          description: "",
          color: "#6d5efc",
          entryRules: [{ id: "e1", text: "" }],
          exitRules: [{ id: "x1", text: "" }],
          riskRules: [{ id: "r1", text: "" }],
        }}
      />
    </>
  );
}
