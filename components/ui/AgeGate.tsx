"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, X } from "lucide-react";

interface AgeGateProps {
  title: string;
  coverUrl?: string | null;
}

export default function AgeGate({ title, coverUrl }: AgeGateProps) {
  const router = useRouter();

  function confirm() {
    // 30-day consent cookie (non-httpOnly — just a preference flag)
    document.cookie = "adult_consent=1; max-age=2592000; path=/; SameSite=Lax";
    router.refresh();
  }

  function leave() {
    router.back();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#080a10]/95 backdrop-blur-md px-4">
      {/* Blurred cover background */}
      {coverUrl && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src={coverUrl}
            alt=""
            fill
            className="object-cover opacity-10 blur-2xl scale-110"
            sizes="100vw"
          />
        </div>
      )}

      <div className="w-full max-w-sm space-y-6 text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-400" />
        </div>

        {/* Warning */}
        <div>
          <div className="inline-block px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs font-bold tracking-widest uppercase mb-3">
            เนื้อหาสำหรับผู้ใหญ่
          </div>
          <h1 className="font-bebas text-3xl text-white tracking-wider mb-2">
            {title}
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            เนื้อหานี้มีภาพหรือเนื้อเรื่องที่ไม่เหมาะสมสำหรับผู้ที่มีอายุต่ำกว่า 18 ปี
          </p>
        </div>

        {/* Age confirmation */}
        <div className="bg-[#141720] rounded-2xl border border-white/10 p-5 space-y-3 text-left">
          <p className="text-sm text-gray-300 font-medium text-center">
            กรุณายืนยันว่าคุณมีอายุ 18 ปีขึ้นไป
          </p>
          <p className="text-xs text-gray-500 text-center">
            การยืนยันนี้จะถูกบันทึกไว้ในอุปกรณ์ของคุณ
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={confirm}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            ฉันมีอายุ 18 ปีขึ้นไป — เข้าชมเนื้อหา
          </button>
          <button
            onClick={leave}
            className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-all"
          >
            ออกไป
          </button>
        </div>

        <p className="text-xs text-gray-600">
          INKVERSE ต่อต้านการเผยแพร่เนื้อหาสำหรับผู้ใหญ่แก่ผู้เยาว์
        </p>
      </div>
    </div>
  );
}
