import { GuidePanel } from "@/components/guide/GuidePanel";
import { CasinoBackground } from "@/components/layout/CasinoBackground";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { aiConfig } from "@/lib/ai/client";
import { getGuideProgress } from "@/lib/guide/progress";
import { getCurrentUser } from "@/lib/user";

// All journal screens read live data from the database on every request.
export const dynamic = "force-dynamic";
// AI reviews (~10–40 s, more with chat tool rounds) and "Reset to demo data" run as server
// actions on these pages; allow up to 5 minutes on Vercel (the Hobby plan maximum).
export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const progress = await getGuideProgress(user.id);
  return (
    <>
      <div className="ambient" aria-hidden />
      <CasinoBackground />
      <div className="relative z-[1] flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
          <Footer />
        </div>
        <GuidePanel progress={progress} aiEnabled={aiConfig().enabled} />
      </div>
    </>
  );
}
