"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

export default function FollowButton({
  targetUserId,
  initialFollowing,
  initialFollowers,
  isLoggedIn,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  initialFollowers: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowers);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/auth/signin");
      return;
    }
    setLoading(true);
    const next = !following;
    setFollowing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        const d = await res.json();
        setFollowing(d.following);
        setCount(d.followers);
      } else {
        setFollowing(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } catch {
      setFollowing(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors disabled:opacity-60 ${
          following
            ? "border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-primary)]/50"
            : "bal-btn"
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : following ? (
          <UserCheck className="w-4 h-4" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {following ? "กำลังติดตาม" : "ติดตาม"}
      </button>
      <span className="text-sm text-[var(--text-secondary)] tabular-nums">
        {count.toLocaleString()} ผู้ติดตาม
      </span>
    </div>
  );
}
