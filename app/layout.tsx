import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Treefinder — Grow a greener neighborhood",
  description: "Explore planting sites, discover suitable native trees, and connect with your local tree community.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
