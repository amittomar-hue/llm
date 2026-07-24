import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const SITE_URL = "https://llm-amits-projects-d3468251.vercel.app";
const SITE_NAME = "Reverb";
const SITE_TITLE = "Reverb — Enterprise Marketing Intelligence";
const SITE_DESCRIPTION =
  "Reverb is the enterprise AI for the full marketing surface — SEO, AEO, GEO, ABM, ad copy, GTM strategy, brand voice. Upload brand docs, name your Brand Agent, paste any URL, and get answers grounded in 130+ marketing topics scraped every 6 hours.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Reverb" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Reverb" }],
  generator: "Next.js",
  keywords: [
    "marketing AI", "AI marketing", "brand agent",
    "GTM strategy", "ABM playbook", "AEO", "GEO", "SEO",
    "AI overviews", "generative engine optimization",
    "marketing intelligence", "brand voice scoring",
    "content marketing AI",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Reverb — Enterprise Marketing Intelligence",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  // Cache-busting query string: browsers cache favicons in a separate
  // store that hard-refresh (Ctrl+Shift+R) doesn't always clear.
  icons: {
    icon: [{ url: "/icon.png?v=3", type: "image/png" }],
    apple: [{ url: "/apple-icon.png?v=3", type: "image/png" }],
    shortcut: ["/icon.png?v=3"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="h-full bg-[var(--reverb-bg-app)] text-[var(--reverb-text-primary)] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
