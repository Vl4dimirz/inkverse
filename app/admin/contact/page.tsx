import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ContactRow from "./ContactRow";
import { MessageSquare } from "lucide-react";

export const metadata = { title: "กล่องข้อความติดต่อ" };

export default async function AdminContactPage() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/");
  }

  const messages = await prisma.contactMessage.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { user: { select: { username: true } } },
  });
  const openCount = messages.filter((m) => m.status === "OPEN").length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <MessageSquare className="w-7 h-7 text-[var(--text-primary)]" />
        <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider">
          กล่องข้อความติดต่อ
        </h1>
      </div>
      <p className="text-[var(--text-secondary)] text-sm mb-8">
        รอดำเนินการ {openCount} · ทั้งหมด {messages.length}
      </p>

      {messages.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          ยังไม่มีข้อความ
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <ContactRow
              key={m.id}
              msg={{
                id: m.id,
                name: m.name,
                email: m.email,
                subject: m.subject,
                message: m.message,
                status: m.status,
                createdAt: m.createdAt.toISOString(),
                username: m.user?.username ?? null,
                reply: m.reply,
                repliedAt: m.repliedAt ? m.repliedAt.toISOString() : null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
