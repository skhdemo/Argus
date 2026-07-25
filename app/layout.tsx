import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/** Editorial serif — wordmark, the motion, speaker names. Used with restraint. */
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const body = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Instrument readout voice — labels, ticks, counts, status. */
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Argus — live debate reasoning mapper",
  description:
    "Two people argue. Argus draws the shape of the argument while they talk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
