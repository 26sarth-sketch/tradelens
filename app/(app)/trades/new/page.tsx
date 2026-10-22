import { Upload } from "lucide-react";
import Link from "next/link";
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
          <Link href="/trades/import" className="btn-ghost">
            <Upload size={16} /> Import broker CSV
          </Link>
        }
      />
      <ManualTradeForm today={istDateKey(new Date())} />
    </>
  );
}
