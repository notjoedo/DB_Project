import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Treefinder — Volunteer Database",
  description:
    "Manage volunteer organizations, opportunities, members, and registrations.",
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
