import type { Metadata } from "next";
import localFont from "next/font/local";
import BottomNav from "./components/BottomNav";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Monstro",
  description: "Application d'entraînement Monstro",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-16 lg:pb-0 lg:pt-14`}
      >
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
