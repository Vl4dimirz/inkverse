import { Prisma } from "@prisma/client";

/**
 * Prisma `where` fragment for chapters that should be visible to readers:
 * not a draft, and either no scheduled time or the scheduled time has passed.
 * (Scheduled chapters go live automatically once `publishAt` is reached — the
 * filter handles it, no cron needed.)
 */
export function liveChapterWhere(): Prisma.ChapterWhereInput {
  return {
    status: { not: "DRAFT" },
    OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
  };
}

/** Whether a single loaded chapter is live for readers right now. */
export function isChapterLive(ch: { status: string; publishAt: Date | null }): boolean {
  return ch.status !== "DRAFT" && (!ch.publishAt || ch.publishAt.getTime() <= Date.now());
}
