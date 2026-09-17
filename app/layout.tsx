import type { Metadata } from "next";
import { Figtree, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const siteDescription =
  "Four models pick every NFL game straight up. Entertainment, not betting advice.";

export const metadata: Metadata = {
  metadataBase: new URL("https://nfl-llm-picks.vercel.app"),
  title: {
    default: "NFLLM",
    template: "%s · NFLLM",
  },
  description: siteDescription,
  applicationName: "NFLLM",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "NFLLM",
    title: "NFLLM",
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "NFLLM — Four models pick every NFL game straight up.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NFLLM",
    description: siteDescription,
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
