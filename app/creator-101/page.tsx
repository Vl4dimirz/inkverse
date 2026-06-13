import type { Metadata } from "next";
import Creator101 from "@/components/ui/Creator101";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export const metadata: Metadata = {
  title: "Creator 101 — สอนสร้างเนื้อหาบน INKVERSE (นักเขียน & นักแปล)",
  description:
    "คู่มือครีเอเตอร์ INKVERSE แบบเห็นภาพ: สอนเขียนนิยาย แปลมังงะ/มันฮวา ใช้เครื่องมือเขียน ตั้งตอนพรีเมียม/อ่านล่วงหน้า และรับรายได้ 80% ทีละขั้น",
  alternates: { canonical: `${BASE_URL}/creator-101` },
  openGraph: {
    title: "Creator 101 — สอนสร้างเนื้อหาบน INKVERSE",
    description: "สอนนักเขียน & นักแปล สร้างเนื้อหา + ใช้เครื่องมือ ทีละขั้น แบบเห็นภาพ",
    url: `${BASE_URL}/creator-101`,
  },
};

export default function Creator101Page() {
  return <Creator101 />;
}
