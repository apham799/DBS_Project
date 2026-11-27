import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/header";
import "./globals.css";

// Two typefaces: Playfair Display for headings (high contrast, editorial), Libre
// Franklin for everything else, so cards and forms stay easy to read.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });

export const metadata: Metadata = {
  title: { default: "Range Report", template: "%s · Range Report" },
  description: "Know what's actually open, usable and crowded at your Chicago practice spot before you drive, from golfers who were just there.",
};

export const viewport: Viewport = { themeColor: "#f8f2e4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${franklin.variable} antialiased`}>
      <body className="min-h-dvh bg-page text-ink">
        <ClerkProvider>
          <a href="#main" className="sr-only z-50 rounded-md bg-green px-4 py-3 font-semibold text-on-green focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
            Skip to content
          </a>
          <Suspense fallback={<div className="h-16 border-b border-cream-deep bg-cream" />}>
            <Header />
          </Suspense>
          <main id="main" className="w-full px-4 pb-20 pt-4 sm:px-6 sm:pt-6 lg:px-10 2xl:px-16">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
