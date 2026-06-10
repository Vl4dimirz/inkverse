"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageCircle, Heart, ChevronDown, AlertTriangle, Trash2, CornerDownRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import clsx from "clsx";

interface Comment {
  id: string;
  content: string;
  isSpoiler: boolean;
  likes: number;
  createdAt: string | Date;
  user: { username: string; avatarUrl?: string | null };
  replies?: Comment[];
}

interface CommentSectionProps {
  chapterId: string;
  comments?: Comment[];
  currentUserId?: string;
  currentUsername?: string;
}

// ─── Reply Form ────────────────────────────────────────────────
function ReplyForm({
  chapterId,
  parentId,
  onSubmit,
  onCancel,
}: {
  chapterId: string;
  parentId: string;
  onSubmit: (comment: Comment) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, content: content.trim(), isSpoiler, parentId }),
      });
      if (res.ok) {
        const newReply = await res.json() as Comment;
        onSubmit({ ...newReply, createdAt: newReply.createdAt, replies: [] });
        setContent("");
        setIsSpoiler(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 ml-11">
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="ตอบกลับ..."
        rows={2}
        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-500 resize-none focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors"
      />
      <div className="flex items-center justify-between mt-1.5">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} className="accent-[var(--text-primary)]" />
          มีสปอยล์
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white/5 hover:bg-white/10 transition-colors">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="px-3 py-1 rounded-lg text-xs text-[var(--text-primary)] font-medium bg-[var(--accent)] disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {submitting ? "กำลังส่ง..." : "ตอบกลับ"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Comment Item ──────────────────────────────────────────────
function CommentItem({
  comment,
  depth = 0,
  currentUserId,
  chapterId,
  onDelete,
  onReplyAdded,
}: {
  comment: Comment;
  depth?: number;
  currentUserId?: string;
  chapterId: string;
  onDelete: (id: string, parentId?: string) => void;
  onReplyAdded: (parentId: string, reply: Comment) => void;
}) {
  const [spoilerVisible, setSpoilerVisible] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [likes, setLikes] = useState(comment.likes);
  const [liked, setLiked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleLike() {
    if (liked || !currentUserId) return;
    setLiked(true);
    setLikes((n) => n + 1);
    await fetch(`/api/comment/${comment.id}`, { method: "PATCH" }).catch(() => {
      setLiked(false);
      setLikes((n) => n - 1);
    });
  }

  async function handleDelete() {
    if (!confirm("ลบความคิดเห็นนี้?")) return;
    setDeleting(true);
    const res = await fetch(`/api/comment/${comment.id}`, { method: "DELETE" });
    if (res.ok) onDelete(comment.id);
    else setDeleting(false);
  }

  const isOwn = currentUserId && comment.user.username !== undefined;

  return (
    <div className={clsx("flex gap-3", depth > 0 && "ml-8 mt-3")}>
      {/* Avatar */}
      <div className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-[var(--bg-card)]">
        {comment.user.avatarUrl ? (
          <Image src={comment.user.avatarUrl} alt={comment.user.username} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-primary)] bg-gradient-to-br from-[var(--accent)]/40 to-[var(--accent)]/40">
            {comment.user.username[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{comment.user.username}</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: th })}
          </span>
          {comment.isSpoiler && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              <AlertTriangle className="w-3 h-3" />สปอยล์
            </span>
          )}
        </div>

        {/* Content */}
        {comment.isSpoiler && !spoilerVisible ? (
          <button onClick={() => setSpoilerVisible(true)} className="text-sm text-[var(--text-secondary)] italic hover:text-[var(--text-primary)] transition-colors">
            คลิกเพื่อดูความคิดเห็นที่มีสปอยล์
          </button>
        ) : (
          <p className="text-sm text-[var(--text-primary)] leading-relaxed break-words">{comment.content}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleLike}
            disabled={!currentUserId || liked}
            className={clsx(
              "flex items-center gap-1 text-xs transition-colors",
              liked ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              !currentUserId && "cursor-default"
            )}
          >
            <Heart className={clsx("w-3.5 h-3.5", liked && "fill-current")} />
            {likes > 0 && <span>{likes}</span>}
          </button>

          {depth === 0 && currentUserId && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              ตอบกลับ
            </button>
          )}

          {currentUserId && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors ml-auto"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <ReplyForm
            chapterId={chapterId}
            parentId={comment.id}
            onSubmit={(reply) => {
              onReplyAdded(comment.id, reply);
              setShowReplyForm(false);
              setShowReplies(true);
            }}
            onCancel={() => setShowReplyForm(false)}
          />
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1 text-xs text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", showReplies && "rotate-180")} />
              {comment.replies.length} การตอบกลับ
            </button>

            {showReplies && comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                currentUserId={currentUserId}
                chapterId={chapterId}
                onDelete={(id) => onDelete(id, comment.id)}
                onReplyAdded={onReplyAdded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Section ──────────────────────────────────────────────
export default function CommentSection({
  chapterId,
  comments: initial = [],
  currentUserId,
  currentUsername,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [content, setContent] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !currentUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, content: content.trim(), isSpoiler }),
      });
      if (!res.ok) { setError("ส่งความคิดเห็นไม่สำเร็จ"); return; }
      const newComment = await res.json() as Comment;
      setComments((prev) => [{ ...newComment, createdAt: newComment.createdAt, replies: [] }, ...prev]);
      setContent("");
      setIsSpoiler(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string, parentId?: string) {
    if (parentId) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== id) }
            : c
        )
      );
    } else {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  function handleReplyAdded(parentId: string, reply: Comment | null) {
    if (!reply) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies ?? []), reply] }
          : c
      )
    );
  }

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-8">
      <h3 className="flex items-center gap-2 font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-6">
        <MessageCircle className="w-5 h-5 text-[var(--text-primary)]" />
        ความคิดเห็น
        <span className="text-base text-[var(--text-secondary)] font-normal ml-1">({comments.length})</span>
      </h3>

      {/* New comment form */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="mb-8 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] bg-gradient-to-br from-[var(--accent)]/40 to-[var(--accent)]/40">
              {currentUsername?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="แสดงความคิดเห็น..."
                rows={3}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-500 resize-none focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
                  <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} className="accent-[var(--text-primary)]" />
                  มีสปอยล์
                </label>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting}
                  className="px-5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {submitting ? "กำลังส่ง..." : "ส่ง"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 py-4 text-center text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <a href="/auth/signin" className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">เข้าสู่ระบบ</a>
          {" "}เพื่อแสดงความคิดเห็น
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-5">
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-10">
            ยังไม่มีความคิดเห็น — เป็นคนแรกที่แสดงความคิดเห็น!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              chapterId={chapterId}
              onDelete={handleDelete}
              onReplyAdded={handleReplyAdded}
            />
          ))
        )}
      </div>
    </section>
  );
}
