import type { Metadata } from "next";
import { Space_Grotesk, Work_Sans } from "next/font/google";

import { QueryProvider } from "@/components/providers/query-provider";
import "@/app/globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans"
});

export const metadata: Metadata = {
  title: "Notification Delivery Platform",
  description: "Production-style notification delivery demo with async processing."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="font-sans text-ink">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
