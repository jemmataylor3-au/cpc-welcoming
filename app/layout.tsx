import type { Metadata, Viewport } from "next";
import { League_Spartan, Merriweather } from "next/font/google";
import "./globals.css";

// Brand faces from the CPC Style Guide (Aug 2023, v1.1):
// League Spartan for headings and UI chrome, Merriweather for body prose.
// Two faces total, per the guide's max-two-fonts-per-page rule.
const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-league-spartan",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CPC Welcoming",
  description:
    "Charlestown Presbyterian Church welcoming team visitor tracker — Gospel Truth. God's Love. Real Change.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CPC Welcoming",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#103349",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${leagueSpartan.variable} ${merriweather.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
