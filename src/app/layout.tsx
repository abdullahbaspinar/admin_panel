import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";

import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const serif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Quiz App Studio CMS",
  description: "Multi-exam content management for Quiz App Studio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
