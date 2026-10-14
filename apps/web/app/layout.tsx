import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cue Sense",
  description: "Billiards drill maker, practice sessions and progress tracking",
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
