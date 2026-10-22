import { Upload } from "lucide-react";
import { ManualTradeForm } from "@/components/trades/ManualTradeForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { istDateKey } from "@/lib/format";

export const metadata = { title: "Add trade" };

export default function NewTradePage() {
  return (
    <>
      <PageHeader
        title="Add a trade"
        description="Log a completed round trip. Charges are calculated for you."
        actions={
          <span className="btn-ghost cursor-not-allowed opacity-60" title="Coming in Day 1, steps 5 and 6">
            <Upload size={16} /> Import CSV (soon)
          </span>
        }
      />
      <ManualTradeForm today={istDateKey(new Date())} />
    </>
  );
}
