import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import AppInstallBanner from "@/components/ui/AppInstallBanner";
import ServiceWorkerRegister from "@/components/ui/ServiceWorkerRegister";
import Footer from "@/components/layout/Footer";
import { WebsiteJsonLd } from "@/components/seo/JsonLd";
import ReadingProgressProvider from "@/components/ui/ReadingProgressProvider";
import HelpChatbotLazy from "@/components/ui/HelpChatbotLazy";
import AchievementToaster from "@/components/ui/AchievementToaster";
import TrafficBeacon from "@/components/ui/TrafficBeacon";
import PushRegister from "@/components/ui/PushRegister";
import WelcomePopup from "@/components/ui/WelcomePopup";
import NativeShell from "@/components/ui/NativeShell";
import UpdateChecker from "@/components/ui/UpdateChecker";
import CookieConsent from "@/components/ui/CookieConsent";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto",
  display: "swap",
});

export const viewport: Viewport = {
  // Dark browser theme-color so the mobile address bar matches the black UI.
  // (Status-bar inset inside the app is handled natively via overlay:false,
  // so we deliberately avoid viewport-fit:cover to not shift any web layout.)
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  // Lets iOS "Add to Home Screen" launch INKVERSE full-screen (standalone, no
  // Safari chrome) — the legit way to get an app-like experience on iPhone.
  appleWebApp: {
    capable: true,
    title: "INKVERSE",
    statusBarStyle: "black",
  },
  title: {
    default: "INKVERSE — อ่านมังงะออนไลน์ฟรี มังฮวา มันฮวา แปลไทย",
    template: "%s | INKVERSE",
  },
  description:
    "ศูนย์รวมมังงะ มังฮวา มันฮวา แปลไทยครบทุกแนว อ่านฟรีไม่มีโฆษณา ระบบ Coin สำหรับตอน Premium อัปเดตทุกวัน",
  keywords: ["มังงะ", "อ่านมังงะ", "มังฮวา", "มันฮวา", "แปลไทย", "อ่านฟรี", "manga thai", "manhwa", "webtoon"],
  authors: [{ name: "INKVERSE" }],
  creator: "INKVERSE",
  publisher: "INKVERSE",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: BASE_URL,
    siteName: "INKVERSE",
    title: "INKVERSE — อ่านมังงะออนไลน์ฟรี",
    description:
      "ศูนย์รวมมังงะ มังฮวา แปลไทยครบทุกแนว อ่านฟรี อัปเดตทุกวัน",
  },
  twitter: {
    card: "summary_large_image",
    title: "INKVERSE — อ่านมังงะออนไลน์ฟรี",
    description: "ศูนย์รวมมังงะ มังฮวา แปลไทยครบทุกแนว",
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      "th-TH": BASE_URL,
      "x-default": BASE_URL,
    },
  },
  verification: {
    // Both the env-configured code and the current one render, so verifying with
    // either Search Console property works.
    google: [
      "uOOtdTLcXgK374na6xYQ2hVlYKP9JbdLtvaKx7gPzs4",
      process.env.GOOGLE_SITE_VERIFICATION,
    ].filter((v): v is string => !!v),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${bebasNeue.variable} ${notoSansThai.variable}`}
      // The inline script below sets data-theme on <html> before React hydrates
      // (to avoid a theme flash); suppress the resulting attribute mismatch.
      suppressHydrationWarning
    >
      <head>
        {/* Apply saved theme before paint to avoid a flash (default: dark). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        {/*
          Start the TLS handshake to the cover CDN as early as possible so
          that cover images (the LCP element on list/detail pages) don't stall
          on connection setup. dns-prefetch is the safe fallback for browsers
          that don't support preconnect.
        */}
        <link
          rel="preconnect"
          href="https://pub-71c2f92dfc5248a4a41ed07fa75d1a05.r2.dev"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://pub-71c2f92dfc5248a4a41ed07fa75d1a05.r2.dev"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-noto)]">
        <WebsiteJsonLd />
        <Navbar />
        <AppInstallBanner />
        <main className="flex-1">
          <ReadingProgressProvider>{children}</ReadingProgressProvider>
        </main>
        <Footer />
        <HelpChatbotLazy />
        <NativeShell />
        <ServiceWorkerRegister />
        <UpdateChecker />
        <CookieConsent />
        <TrafficBeacon />
        <AchievementToaster />
        <PushRegister />
        <WelcomePopup />
      </body>
    </html>
  );
}
