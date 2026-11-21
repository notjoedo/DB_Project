import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Three Trees",
  description:
    "Find where trees are needed, plan volunteer plantings, and track volunteer hours.",
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
