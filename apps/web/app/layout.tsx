import type { Metadata, Viewport } from "next";

import { barlowCondensed, plexMono, plexSans } from "@/app/fonts";
import { themeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cue Sense",
  description: "Billiards drill maker, practice sessions and progress tracking",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F2EF" },
    { media: "(prefers-color-scheme: dark)", color: "#111315" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by themeScript before React hydrates, so React may see a
    // different value from the server's default; that difference is expected.
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${barlowCondensed.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
