import clsx from "clsx";
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { pendingSuggestionCount } from "@/lib/autotag-store";
import { compareMetrics } from "@/lib/compare";
import { applyFilter } from "@/lib/filters";
import { loadReportTrades } from "@/lib/report-data";
import { groupReport, reportInsights } from "@/lib/reports";
import { computeStats } from "@/lib/stats";

/**
 * "What your data says" without AI: the biggest patterns, computed in code from
 * the same reports the app shows. Used when the AI Coach isn't connected.
 */
export async function QuickRead({ userId }: { userId: string }) {
  const [trades, pending] = await Promise.all([loadReportTrades(userId), pendingSuggestionCount(userId)]);
  if (trades.length < 10) return null;

  const all = computeStats(trades);
  const plan = compareMetrics(applyFilter(trades, { plan: "followed" }), applyFilter(trades, { plan: "broke" }));
  const time = reportInsights(groupReport("time", trades));
  const emotion = reportInsights(groupReport("emotion", trades));
  const expiry = compareMetrics(applyFilter(trades, { expiry: "yes" }), applyFilter(trades, { expiry: "no" }));

  const items: { tone: "good" | "bad" | "info"; title: React.ReactNode; detail: React.ReactNode; href: string }[] = [];
  if (all.chargesPctOfGross != null) {
    items.push({
      tone: all.chargesPctOfGross >= 30 ? "bad" : "info",
      title: <>Charges ate {all.chargesPctOfGross.toFixed(0)}% of your gross profit</>,
      detail: <><Money value={all.totalCharges} /> in charges on <Money value={all.grossPnl} /> gross. Fewer, better trades keep more.</>,
      href: "/learn/why-charges-matter",
    });
  }
  if (plan.sa.count >= 5 && plan.sb.count >= 5) {
    items.push({
      tone: plan.sa.expectancy > plan.sb.expectancy ? "good" : "info",
      title: <>Following your plan is worth <Money value={plan.sa.expectancy - plan.sb.expectancy} /> per trade</>,
      detail: <>Followed: <Money value={plan.sa.net} pnl /> over {plan.sa.count} trades. Broke it: <Money value={plan.sb.net} pnl /> over {plan.sb.count}.</>,
      href: "/reports/compare?preset=plan",
    });
  }
  if (time && time.worst.stats.net < 0) {
    items.push({
      tone: "bad",
      title: <>Your worst time of day is {time.worst.label}</>,
      detail: <><Money value={time.worst.stats.net} pnl /> over {time.worst.stats.count} trades, {time.worst.stats.winRate.toFixed(0)}% wins.</>,
      href: "/reports?tab=time",
    });
  }
  if (emotion && emotion.worst.stats.net < 0) {
    items.push({
      tone: "bad",
      title: <>Trades entered feeling “{emotion.worst.label}” cost you the most</>,
      detail: <><Money value={emotion.worst.stats.net} pnl /> over {emotion.worst.stats.count} trades, {emotion.worst.stats.winRate.toFixed(0)}% wins.</>,
      href: "/reports?tab=emotion",
    });
  }
  if (expiry.sa.count >= 5 && expiry.sa.expectancy < expiry.sb.expectancy) {
    items.push({
      tone: "bad",
      title: <>Expiry days are weaker than normal days</>,
      detail: <><Money value={expiry.sa.expectancy} pnl /> per trade on expiry days vs <Money value={expiry.sb.expectancy} pnl /> on other days.</>,
      href: "/reports?tab=expiry",
    });
  }

  return (
    <section className="rounded-xl border border-accent/40 bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-medium"><Lightbulb size={17} className="text-accent" /> What your data says</h2>
      <p className="mb-4 text-xs text-muted">The biggest patterns in your journal, computed from your trades.</p>
      <ul className="space-y-3">
        {items.slice(0, 5).map((it, i) => {
          const Icon = it.tone === "good" ? TrendingUp : it.tone === "bad" ? TrendingDown : Lightbulb;
          return (
            <li key={i}>
              <Link href={it.href} className="flex gap-2.5 rounded-lg p-1.5 hover:bg-surface-2">
                <Icon size={17} className={clsx("mt-0.5 shrink-0", it.tone === "good" ? "text-profit" : it.tone === "bad" ? "text-loss" : "text-accent")} aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{it.title}</span>
                  <span className="block text-xs text-muted">{it.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {pending > 0 && (
        <Link href="/trades/tags" className="btn-ghost mt-4 text-sm">
          Review {pending} auto-tag suggestion{pending === 1 ? "" : "s"} (revenge trades, overtrading…)
        </Link>
      )}
    </section>
  );
}
