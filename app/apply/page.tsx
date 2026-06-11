import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApplyClient from "./ApplyClient";
import ApplyStatus from "./ApplyStatus";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "สมัครนักเขียน | INKVERSE" };

export default async function ApplyPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/apply");

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  // Already a creator → straight to the dashboard
  if (role === "TRANSLATOR" || role === "ADMIN") {
    redirect("/dashboard");
  }

  const application = await prisma.translatorApplication.findUnique({
    where: { userId },
  });

  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });

  // Has an active/pending application → show status
  if (application && application.status !== "REJECTED") {
    return <ApplyStatus application={application} />;
  }

  // New application or re-apply after rejection
  return (
    <ApplyClient
      genres={genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
      prevApplication={application}
    />
  );
}
