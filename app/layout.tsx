import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Nyaya — Indian Legal Research Agent",
  description:
    "An agentic RAG research assistant for Indian case law, statutes, and tribunal orders. Built for judges.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
