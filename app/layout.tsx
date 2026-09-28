import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cinzel } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SITE_URL } from "@/lib/site";
import OnboardingGate from "./onboarding/OnboardingGate";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600"], variable: "--font-cinzel" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Monstro",
  description: "Application d'entraînement Monstro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} antialiased`}>
        {children}
        <OnboardingGate />
      </body>
    </html>
  );
}
