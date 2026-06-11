import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NovelEditor from "@/components/ui/NovelEditor";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ch?: string }>;
}

export const metadata = { title: "เขียนนิยาย — INKVERSE" };

export default async function WriteNovelPage({ params, searchParams }: Props) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user) redirect("/auth/signin");
  if (role !== "TRANSLATOR" && role !== "ADMIN") redirect("/");

  const { slug } = await params;
  const { ch } = await searchParams;
  const userId = (session.user as { id: string }).id;

  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: {
      id: true, type: true,
      translator: { select: { userId: true } },
      chapters: { orderBy: { chapterNum: "desc" }, take: 1, select: { chapterNum: true } },
    },
  });
  if (!manga) notFound();
  if (role !== "ADMIN" && manga.translator?.userId !== userId) redirect("/dashboard");

  const existingRow = ch
    ? await prisma.chapter.findFirst({
        where: { id: ch, mangaId: manga.id },
        select: {
          id: true, chapterNum: true, title: true, content: true, isPremium: true,
          coinCost: true, status: true, publishAt: true, authorNote: true,
        },
      })
    : null;
  const existing = existingRow
    ? { ...existingRow, publishAt: existingRow.publishAt ? existingRow.publishAt.toISOString() : null }
    : null;

  const suggestedNum = Math.floor((manga.chapters[0]?.chapterNum ?? 0) + 1);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
      <Link href={`/dashboard/manga/${slug}/chapters`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> จัดการตอน
      </Link>
      <NovelEditor mangaSlug={slug} suggestedNum={suggestedNum} existing={existing} />
    </div>
  );
}
