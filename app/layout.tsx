import type { Metadata } from "next";
import { Bebas_Neue, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/layout/Footer";
import { auth } from "@/lib/auth";
import { getUserCoins } from "@/lib/coins";
import { getUserRankBadge } from "@/lib/ranks";
import { WebsiteJsonLd } from "@/components/seo/JsonLd";
import HelpChatbot from "@/components/ui/HelpChatbot";
import ReadingProgressProvider from "@/components/ui/ReadingProgressProvider";
import AchievementToaster from "@/components/ui/AchievementToaster";
import TrafficBeacon from "@/components/ui/TrafficBeacon";
import AppBonus from "@/components/ui/AppBonus";
import PushRegister from "@/components/ui/PushRegister";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inkverse.com";

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

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
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
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  const userRole = session?.user ? (session.user as { role?: string }).role : undefined;
  const [userCoins, rankBadge] = userId
    ? await Promise.all([getUserCoins(userId), getUserRankBadge(userId, userRole)])
    : [0, null];

  return (
    <html
      lang="th"
      className={`${bebasNeue.variable} ${notoSansThai.variable}`}
    >
      <head>
        {/* Apply saved theme before paint to avoid a flash (default: dark). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-noto)]">
        <WebsiteJsonLd />
        <Navbar user={session?.user} userCoins={userCoins} rankBadge={rankBadge} />
        <main className="flex-1">
          {userId ? (
            <ReadingProgressProvider>{children}</ReadingProgressProvider>
          ) : (
            children
          )}
        </main>
        <Footer />
        <HelpChatbot />
        <TrafficBeacon />
        {userId && <AchievementToaster />}
        {userId && <AppBonus />}
        {userId && <PushRegister />}
      </body>
    </html>
  );
}
