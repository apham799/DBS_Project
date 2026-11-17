import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Fraunces, Libre_Franklin } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { Welcome } from "@/components/welcome";
import "./globals.css";

// Two typefaces, as in Bucket List: Fraunces for headings, Libre Franklin for the rest.
const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });

export const metadata: Metadata = {
  title: { default: "Range Report", template: "%s · Range Report" },
  description: "Know what's actually open, usable and crowded at your Chicago practice spot before you drive, from golfers who were just there.",
};

export const viewport: Viewport = { themeColor: "#f8f2e4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${franklin.variable} antialiased`}>
      <body className="min-h-dvh bg-page text-ink">
        <ClerkProvider>
          <a href="#main" className="sr-only z-50 rounded-md bg-green px-4 py-3 font-semibold text-on-green focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
            Skip to content
          </a>
          <Suspense fallback={<div className="h-16 border-b border-cream-deep bg-cream" />}>
            <Header />
          </Suspense>
          {/* What the site is, once, for visitors who aren't signed in. */}
          <Suspense fallback={null}>
            <Welcome />
          </Suspense>
          <main id="main" className="w-full px-4 pb-20 pt-4 sm:px-6 sm:pt-6 lg:px-10 2xl:px-16">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
