import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PromoteKit from "@/components/ui/PromoteKit";

export const metadata = { title: "โปรโมตผลงาน | INKVERSE" };

export default async function PromotePage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user) redirect("/auth/signin?callbackUrl=/dashboard/promote");
  if (role !== "TRANSLATOR" && role !== "ADMIN") redirect("/");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      translator: {
        select: {
          mangas: {
            select: { slug: true, title: true, coverUrl: true, type: true },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-1">โปรโมตผลงาน</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">ดึงแฟนของคุณเข้ามา — แชร์ลิงก์ + แคปชั่น และดาวน์โหลดการ์ดโปรโมทไปโพสต์ IG / TikTok ได้เลย</p>
      <PromoteKit works={user?.translator?.mangas ?? []} />
    </div>
  );
}
