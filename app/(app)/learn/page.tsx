import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLessons } from "@/lib/lessons";

export const metadata = { title: "Learn" };

// Each lesson is dealt as a playing card, echoing the landing page.
const SUITS = [
  { glyph: "♠", color: "#14171f" },
  { glyph: "♥", color: "#e11d48" },
  { glyph: "♦", color: "#e11d48" },
  { glyph: "♣", color: "#14171f" },
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export default function LearnPage() {
  const lessons = getLessons();
  return (
    <>
      <PageHeader title="Learn" description="Short lessons in plain English. Each takes 2–3 minutes and links to the screen where you can try it." />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {lessons.map((l, i) => {
          const suit = SUITS[i % SUITS.length];
          return (
            <Link key={l.slug} href={`/learn/${l.slug}`} className="ivory-card group flex min-h-[210px] flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="sign leading-7" style={{ color: suit.color }} aria-hidden>
                  <div className="text-2xl">{RANKS[i % RANKS.length]}</div>
                  <div className="text-xl">{suit.glyph}</div>
                </div>
                <span className="arcade flex items-center gap-1 text-[9px] text-[#14171f]/55">
                  <Clock size={11} /> {l.minutes} MIN
                </span>
              </div>
              <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[#14171f]/50">Lesson {i + 1}</div>
              <h2 className="mt-0.5 text-lg font-semibold leading-6">{l.title}</h2>
              <p className="mt-1.5 text-sm text-[#14171f]/70">{l.summary}</p>
              <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-[#8a5a05]">
                Read lesson <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
