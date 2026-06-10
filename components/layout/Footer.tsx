import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { Github, Twitter, Facebook } from "@/components/ui/SocialIcons";

const links = {
  เนื้อหา: [
    { href: "/manga", label: "เรื่องทั้งหมด" },
    { href: "/discover", label: "ค้นหา" },
    { href: "/manga/action", label: "Action" },
    { href: "/manga/romance", label: "Romance" },
  ],
  บัญชี: [
    { href: "/auth/signin", label: "เข้าสู่ระบบ" },
    { href: "/auth/signup", label: "สมัครสมาชิก" },
    { href: "/upload", label: "อัปโหลดผลงาน" },
  ],
  ข้อมูล: [
    { href: "/about", label: "เกี่ยวกับเรา" },
    { href: "/terms", label: "ข้อกำหนด" },
    { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
    { href: "/dmca", label: "DMCA" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[var(--bg-primary)] border-t border-[var(--border)] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" />
            <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed">
              แพลตฟอร์มอ่านการ์ตูนออนไลน์ มังงะ มันฮวา มานฮวา
              ที่ใหญ่ที่สุดในไทย
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                { icon: Twitter, href: "#", label: "Twitter" },
                { icon: Facebook, href: "#", label: "Facebook" },
                { icon: Github, href: "#", label: "Github" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/20 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                {category}
              </h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <p>© {new Date().getFullYear()} INKVERSE. All rights reserved.</p>
          <p>Built with Next.js · PostgreSQL · Cloudflare R2</p>
        </div>
      </div>
    </footer>
  );
}
