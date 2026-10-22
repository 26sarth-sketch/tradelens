// Pre-market plan vs what actually happened that day. Pure; used by the Notebook
// and (Day 2, step 12) the AI session review, which is given these computed facts.

export type DayPlan = {
  planMaxTrades: number | null;
  planMaxLoss: number | null;
  planStrategyIds: string[];
};

export type PlanTrade = { entryAt: Date; netPnl: number; strategyId: string | null; followedPlan: boolean | null };

export type PlanCheck = {
  key: "trades" | "loss" | "strategies" | "selfReport";
  label: string;
  ok: boolean;
  detail: string;
};

export function comparePlan(plan: DayPlan, trades: PlanTrade[], strategyNames: Record<string, string> = {}): PlanCheck[] {
  const ts = [...trades].sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime());
  const checks: PlanCheck[] = [];

  if (plan.planMaxTrades != null) {
    checks.push({
      key: "trades",
      label: "Trade count",
      ok: ts.length <= plan.planMaxTrades,
      detail: `${ts.length} taken vs ${plan.planMaxTrades} planned`,
    });
  }

  if (plan.planMaxLoss != null) {
    let cum = 0;
    let deepest = 0;
    for (const t of ts) deepest = Math.min(deepest, (cum += t.netPnl));
    const worst = Math.round(Math.max(0, -deepest)); // avoids "-0" when the day never went red
    const limit = Math.round(plan.planMaxLoss).toLocaleString("en-IN");
    checks.push({
      key: "loss",
      label: "Max loss",
      ok: worst <= plan.planMaxLoss,
      detail: worst === 0 ? `never went into a loss (limit ₹${limit})` : `worst point of the day −₹${worst.toLocaleString("en-IN")} vs limit ₹${limit}`,
    });
  }

  if (plan.planStrategyIds.length > 0) {
    const off = ts.filter((t) => !t.strategyId || !plan.planStrategyIds.includes(t.strategyId));
    const offNames = [...new Set(off.map((t) => (t.strategyId ? (strategyNames[t.strategyId] ?? "another strategy") : "no strategy")))];
    checks.push({
      key: "strategies",
      label: "Planned strategies only",
      ok: off.length === 0,
      detail: off.length === 0 ? "every trade used a planned strategy" : `${off.length} trade${off.length > 1 ? "s" : ""} outside the plan (${offNames.join(", ")})`,
    });
  }

  const reviewed = ts.filter((t) => t.followedPlan != null);
  if (reviewed.length > 0) {
    const broke = reviewed.filter((t) => t.followedPlan === false).length;
    checks.push({
      key: "selfReport",
      label: "Your own review",
      ok: broke === 0,
      detail: broke === 0 ? `followed the plan on all ${reviewed.length} reviewed trades` : `broke the plan on ${broke} of ${reviewed.length} reviewed trades`,
    });
  }
  return checks;
}
