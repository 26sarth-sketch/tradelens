import { BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLessons } from "@/lib/lessons";

export const metadata = { title: "Learn" };

export default function LearnPage() {
  const lessons = getLessons();
  return (
    <>
      <PageHeader title="Learn" description="Short lessons in plain English. Each takes 2–3 minutes and links to the screen where you can try it." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lessons.map((l, i) => (
          <Link key={l.slug} href={`/learn/${l.slug}`} className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent">
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-accent" /> Lesson {i + 1}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {l.minutes} min</span>
            </div>
            <h2 className="font-medium group-hover:text-accent">{l.title}</h2>
            <p className="mt-1 text-sm text-muted">{l.summary}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
