import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: "CivicLens — Report. Track. Resolve.",
  description: "AI-powered civic issue reporting and smart city accountability platform.",
  openGraph: {
    title: "CivicLens — Report. Track. Resolve.",
    description: "Empowering neighborhoods to identify infrastructure issues, track resolutions in real-time, and audit city-wide civic health scores.",
    images: [
      {
        url: "/map-preview.png",
        width: 1200,
        height: 630,
        alt: "CivicLens Map Dashboard Preview",
      }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col bg-background text-on-background">
        {children}
      </body>
    </html>
  );
}
