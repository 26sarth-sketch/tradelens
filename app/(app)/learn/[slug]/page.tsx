import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/coach/RichText";
import { getLesson, getLessons } from "@/lib/lessons";

export function generateStaticParams() {
  return getLessons().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = getLesson((await params).slug);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lessons = getLessons();
  const i = lessons.findIndex((l) => l.slug === slug);
  if (i === -1) notFound();
  const lesson = lessons[i];
  const prev = lessons[i - 1];
  const next = lessons[i + 1];

  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/learn" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> All lessons
      </Link>
      <p className="flex items-center gap-2 text-xs text-muted">
        Lesson {i + 1} of {lessons.length} · <Clock size={12} /> {lesson.minutes} min
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
      <p className="mt-2 text-lg text-muted">{lesson.summary}</p>

      <RichText text={lesson.body} className="mt-6 space-y-3 text-[15px] leading-relaxed [&_li]:my-1 [&_strong]:text-fg" />

      {lesson.tryIt && (
        <Link href={lesson.tryIt.href} className="btn-primary mt-8">
          {lesson.tryIt.label} <ArrowRight size={16} />
        </Link>
      )}

      <nav className="mt-10 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/learn/${prev.slug}`} className="rounded-lg border border-border p-3 text-sm hover:border-accent">
            <span className="text-xs text-muted">← Previous</span>
            <span className="block font-medium">{prev.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/learn/${next.slug}`} className="rounded-lg border border-border p-3 text-right text-sm hover:border-accent">
            <span className="text-xs text-muted">Next →</span>
            <span className="block font-medium">{next.title}</span>
          </Link>
        )}
      </nav>
      <p className="mt-8 text-xs text-muted">Educational content about trading process and risk. Not investment advice.</p>
    </article>
  );
}
