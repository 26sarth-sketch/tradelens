import Link from "next/link";
import { APP_NAME, DISCLAIMER, TAGLINE } from "@/config/brand";

// Placeholder landing page. Full hero, features and INR pricing land in Day 2, step 14.
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
      <p className="max-w-xl text-lg text-muted">{TAGLINE}</p>
      <Link href="/dashboard" className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-fg hover:opacity-90">
        Open the app
      </Link>
      <p className="mt-12 text-xs text-muted">{DISCLAIMER}</p>
    </main>
  );
}
