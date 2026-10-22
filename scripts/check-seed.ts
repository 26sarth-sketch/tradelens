// Prints the demo patterns so we can confirm the seed tells the right story.
// Run: npx tsx scripts/check-seed.ts
import { PrismaClient } from "@prisma/client";
import { istMinutes } from "@/lib/format";

const db = new PrismaClient();

type T = Awaited<ReturnType<typeof db.trade.findMany<{ include: { tags: { include: { tag: true } } } }>>>[number];

function line(label: string, ts: T[]) {
  const n = ts.length;
  const wins = ts.filter((t) => t.netPnl > 0).length;
  const net = ts.reduce((s, t) => s + t.netPnl, 0);
  const gross = ts.reduce((s, t) => s + t.grossPnl, 0);
  const ch = ts.reduce((s, t) => s + t.totalCharges, 0);
  const gp = ts.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const gl = -ts.filter((t) => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0);
  console.log(
    `${label.padEnd(26)} n=${String(n).padStart(3)}  win=${n ? ((wins / n) * 100).toFixed(0).padStart(3) : "  -"}%  ` +
      `gross=${Math.round(gross).toString().padStart(8)}  charges=${Math.round(ch).toString().padStart(7)}  net=${Math.round(net).toString().padStart(8)}  ` +
      `PF=${gl ? (gp / gl).toFixed(2) : "-"}  avg=${n ? Math.round(net / n) : 0}`,
  );
}

async function main() {
  const ts = await db.trade.findMany({ include: { tags: { include: { tag: true } } }, orderBy: { entryAt: "asc" } });
  line("ALL", ts);
  const gross = ts.reduce((s, t) => s + t.grossPnl, 0);
  const ch = ts.reduce((s, t) => s + t.totalCharges, 0);
  console.log(`charges as % of gross: ${((ch / gross) * 100).toFixed(1)}%\n`);
  line("followed plan", ts.filter((t) => t.followedPlan === true));
  line("did NOT follow plan", ts.filter((t) => t.followedPlan === false));
  line("expiry day", ts.filter((t) => t.isExpiryDay));
  line("non-expiry", ts.filter((t) => !t.isExpiryDay));
  line("before 2 PM", ts.filter((t) => istMinutes(t.entryAt) < 840));
  line("after 2 PM", ts.filter((t) => istMinutes(t.entryAt) >= 840));
  line("emotion Revenge", ts.filter((t) => t.emotionBefore === "Revenge"));
  line("emotion Calm/Confident", ts.filter((t) => t.emotionBefore === "Calm" || t.emotionBefore === "Confident"));
  for (const seg of ["OPT", "FUT", "EQ_INTRADAY", "EQ_DELIVERY"]) line(`segment ${seg}`, ts.filter((t) => t.segment === seg));
  line("NIFTY", ts.filter((t) => t.underlying === "NIFTY"));
  line("BANKNIFTY", ts.filter((t) => t.underlying === "BANKNIFTY"));
  const tags = new Map<string, number>();
  ts.forEach((t) => t.tags.forEach((x) => tags.set(x.tag.name, (tags.get(x.tag.name) ?? 0) + 1)));
  console.log("\ntags:", Object.fromEntries(tags));
  const untaggedRevenge = ts.filter((t) => t.emotionBefore === "Revenge" && !t.tags.some((x) => x.tag.name === "Revenge trade")).length;
  console.log("revenge trades without a tag (for the auto-tagger):", untaggedRevenge);
  const days = new Map<string, number>();
  ts.forEach((t) => {
    const k = new Date(t.entryAt.getTime() + 330 * 60000).toISOString().slice(0, 10);
    days.set(k, (days.get(k) ?? 0) + t.netPnl);
  });
  const dv = [...days.values()];
  console.log(`days=${dv.length} green=${dv.filter((v) => v > 0).length} best=${Math.round(Math.max(...dv))} worst=${Math.round(Math.min(...dv))}`);
}
main().finally(() => db.$disconnect());
