import { DataActions } from "@/components/settings/DataActions";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { RiskRulesForm } from "@/components/settings/RiskRulesForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MARKET_CONFIG_AS_OF } from "@/config/market";
import { limitsOf } from "@/lib/rule-store";
import type { Level } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const p = user.profile;
  return (
    <>
      <PageHeader title="Settings" description="Your trader profile and risk rules. The AI coach reads both on every request." />
      <div className="space-y-4">
        <Card title="Trader profile">
          <ProfileForm
            initial={{
              name: user.name,
              level: (p?.level ?? "BEGINNER") as Level,
              capital: p?.capital ?? 200000,
              language: (p?.language ?? "EN") as "EN" | "HINGLISH",
              broker: p?.broker ?? "",
              brokeragePlan: p?.brokeragePlan ?? "DISCOUNT",
            }}
          />
        </Card>
        <section id="risk" className="scroll-mt-6">
          <Card title="Risk rules">
            <RiskRulesForm initial={limitsOf(p)} />
          </Card>
        </section>
        <Card title="Data">
          <DataActions />
          <p className="mt-4 text-xs text-muted">Charge rates last updated {MARKET_CONFIG_AS_OF}. Verify them against your broker before relying on net P&amp;L.</p>
        </Card>
      </div>
    </>
  );
}
