"use client";

import { useState } from "react";
import ProfileTab from "@/components/ui/ProfileTab";
import SecurityTab from "@/components/ui/SecurityTab";
import DevicesTab from "@/components/ui/DevicesTab";

export type UserData = {
  username: string;
  name: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  phone: string | null;
  recoveryEmail: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  twoFactorEnabled: boolean;
  verifiedAt: Date | null;
};

const TABS = [
  { id: "profile", label: "โปรไฟล์" },
  { id: "security", label: "ความปลอดภัย" },
  { id: "devices", label: "อุปกรณ์" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsTabs({ user }: { user: UserData }) {
  const [active, setActive] = useState<TabId>("profile");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`shrink-0 px-5 py-3 text-xs uppercase tracking-widest font-semibold border-b-2 transition-colors ${
              active === tab.id
                ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === "profile" && <ProfileTab user={user} />}
      {active === "security" && <SecurityTab twoFactorEnabled={user.twoFactorEnabled} />}
      {active === "devices" && <DevicesTab />}
    </div>
  );
}
