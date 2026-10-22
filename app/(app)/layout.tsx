import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

// All journal screens read live data from SQLite on every request.
export const dynamic = "force-dynamic";

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
