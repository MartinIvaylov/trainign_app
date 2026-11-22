import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HYBRID — Train. Benchmark. Compete. Evolve.",
  description:
    "HYBRID is the performance operating system for athletes competing in HYROX, ATHX Games, and CrossFit. One profile. One training history. Multiple competition formats.",
  keywords: [
    "HYROX",
    "ATHX",
    "CrossFit",
    "hybrid fitness",
    "functional fitness",
    "training platform",
    "competition prep",
    "race simulation",
  ],
  authors: [{ name: "HYBRID Performance" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "HYBRID — Train. Benchmark. Compete. Evolve.",
    description: "Performance operating system for hybrid athletes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" />
      </body>
    </html>
  );
}
