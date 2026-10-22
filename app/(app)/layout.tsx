import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

// All journal screens read live data from the database on every request.
export const dynamic = "force-dynamic";
// AI reviews (~10–40 s, more with chat tool rounds) and "Reset to demo data" run as server
// actions on these pages; allow up to 5 minutes on Vercel (the Hobby plan maximum).
export const maxDuration = 300;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
