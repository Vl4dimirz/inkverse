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

// freeAt may arrive as a Date (live query) or an ISO string (from a cached/
// serialized payload) — normalise either way.
type LockableChapter = { isPremium: boolean; freeAt: Date | string | null };

/**
 * A premium chapter is locked unless the user already unlocked it, OR its
 * early-access window has elapsed (freeAt reached) — then it's free for all.
 * freeAt = null means permanently premium (e.g. paid back-catalog once a series ends).
 */
export function isChapterLocked(ch: LockableChapter, unlocked: boolean): boolean {
  if (!ch.isPremium || unlocked) return false;
  if (ch.freeAt && new Date(ch.freeAt).getTime() <= Date.now()) return false;
  return true;
}

/** True while a premium chapter is still in its early-access window (will turn free later). */
export function isEarlyAccess(ch: LockableChapter): boolean {
  return ch.isPremium && !!ch.freeAt && new Date(ch.freeAt).getTime() > Date.now();
}
