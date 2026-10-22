import type { Metadata } from "next";
import { Bungee, Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import { InlineScript } from "@/components/ui/InlineScript";
import { APP_NAME, TAGLINE } from "@/config/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display fonts shared by the landing page and the app (headings and small HUD-style labels).
const sign = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-sign" });
const arcade = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-arcade" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} ${sign.variable} ${arcade.variable} h-full antialiased`}
      // The inline script below may set data-privacy before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Restore privacy mode before first paint so ₹ amounts never flash. */}
        <InlineScript
          html={`try{if(localStorage.getItem("tl-privacy")==="1")document.documentElement.dataset.privacy="1"}catch(e){}`}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
