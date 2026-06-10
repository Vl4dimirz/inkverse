"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  User, BookOpen, Link as LinkIcon, MessageSquare, ArrowLeft,
} from "lucide-react";
import clsx from "clsx";

interface Application {
  id: string;
  status: string;
  penName: string;
  experience: string;
  sampleWork: string;
  socialLink?: string | null;
  preferredGenres: string[];
  motivation: string;
  adminNote?: string | null;
  createdAt: string;
  user: { id: string; username: string; email: string; createdAt: string };
}

const STATUS_TABS = [
  { key: "PENDING",  label: "รอพิจารณา",  icon: Clock,         color: "text-yellow-400" },
  { key: "APPROVED", label: "อนุมัติแล้ว", icon: CheckCircle,   color: "text-green-400"  },
  { key: "REJECTED", label: "ปฏิเสธแล้ว", icon: XCircle,       color: "text-red-400"    },
];

export default function ApplicationsClient({
  applications, currentStatus, counts,
}: {
  applications: Application[];
  currentStatus: string;
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: rejectNote[id] }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin"
          className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">
          ใบสมัครนักแปล
        </h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map(({ key, label, icon: Icon, color }) => (
          <Link
            key={key}
            href={`?status=${key}`}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
              currentStatus === key
                ? "bg-[var(--bg-card)] border-white/20 text-[var(--text-primary)]"
                : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon className={clsx("w-4 h-4", currentStatus === key ? color : "")} />
            {label}
            <span className={clsx(
              "text-xs px-1.5 py-0.5 rounded-full",
              currentStatus === key ? "bg-white/10 text-[var(--text-primary)]" : "bg-white/5 text-[var(--text-muted)]"
            )}>
              {counts[key] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {/* Applications list */}
      {applications.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>ไม่มีใบสมัครในสถานะนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const isOpen = expanded === app.id;
            return (
              <div key={app.id} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--text-primary)]/20 border border-[var(--text-primary)]/30 flex items-center justify-center">
                      <span className="font-bebas text-[var(--text-primary)] text-lg">
                        {app.penName[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[var(--text-primary)] font-semibold">{app.penName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        @{app.user.username} · {app.experience}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(app.createdAt).toLocaleDateString("th-TH")}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-[var(--border)] px-5 pb-5 space-y-4">
                    {/* User info */}
                    <div className="flex gap-4 pt-4 text-sm text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {app.user.email}
                      </span>
                      {app.socialLink && (
                        <a href={app.socialLink} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[var(--text-primary)] hover:underline">
                          <LinkIcon className="w-3.5 h-3.5" />
                          โซเชียล
                        </a>
                      )}
                    </div>

                    {/* Genres */}
                    {app.preferredGenres.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {app.preferredGenres.map((g) => (
                          <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-[var(--text-primary)]/10 text-[var(--text-primary)] border border-[var(--text-primary)]/20">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Sample work */}
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> ตัวอย่างผลงาน
                      </p>
                      <div className="bg-[var(--bg-card)] rounded-xl p-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {app.sampleWork}
                      </div>
                    </div>

                    {/* Motivation */}
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> แรงจูงใจ
                      </p>
                      <div className="bg-[var(--bg-card)] rounded-xl p-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {app.motivation}
                      </div>
                    </div>

                    {/* Admin note (if rejected) */}
                    {app.adminNote && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <p className="text-xs text-red-400 font-medium mb-1">เหตุผลที่ปฏิเสธ</p>
                        <p className="text-sm text-[var(--text-secondary)]">{app.adminNote}</p>
                      </div>
                    )}

                    {/* Actions (only for PENDING) */}
                    {currentStatus === "PENDING" && (
                      <div className="flex flex-col gap-3 pt-2">
                        <textarea
                          value={rejectNote[app.id] ?? ""}
                          onChange={(e) => setRejectNote((n) => ({ ...n, [app.id]: e.target.value }))}
                          placeholder="เหตุผลที่ปฏิเสธ (กรอกเฉพาะกรณีปฏิเสธ)"
                          rows={2}
                          className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-red-500/40 resize-none"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleAction(app.id, "approve")}
                            disabled={!!loading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {loading === `${app.id}-approve` ? "กำลังอนุมัติ..." : "อนุมัติ"}
                          </button>
                          <button
                            onClick={() => handleAction(app.id, "reject")}
                            disabled={!!loading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            {loading === `${app.id}-reject` ? "กำลังปฏิเสธ..." : "ปฏิเสธ"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
