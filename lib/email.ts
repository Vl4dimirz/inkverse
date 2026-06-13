// Transactional email via Resend's REST API (no SDK dependency).
// Fully graceful: if RESEND_API_KEY is unset, it logs and no-ops so flows that
// "send an email" never break in dev / before email is configured.

const FROM = process.env.EMAIL_FROM || "INKVERSE <noreply@inksverse.com>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:skipped] no RESEND_API_KEY → would send "${opts.subject}" to ${opts.to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      console.error("[email:failed]", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email:error]", err);
    return false;
  }
}

// Minimal monochrome (Balenciaga) email shell.
function shell(title: string, body: string): string {
  return `<div style="background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;padding:40px 24px">
  <div style="max-width:480px;margin:0 auto;border:1px solid #2a2a2a;padding:32px">
    <p style="letter-spacing:.3em;font-size:12px;color:#888;text-transform:uppercase;margin:0 0 24px">INKVERSE</p>
    <h1 style="font-size:22px;margin:0 0 16px;text-transform:uppercase;letter-spacing:.04em">${title}</h1>
    <div style="font-size:14px;line-height:1.7;color:#ccc">${body}</div>
  </div>
  <p style="text-align:center;color:#555;font-size:11px;margin-top:24px">© INKVERSE</p>
</div>`;
}

// Escape user/admin-supplied text before embedding it in email HTML.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Admin's reply to a contact/support message, emailed back to the sender.
export function contactReplyEmail(opts: { name: string; original: string; reply: string }) {
  return shell(
    "ตอบกลับจากทีมงาน",
    `<p>สวัสดีคุณ ${esc(opts.name)}</p>
     <p>ทีมงาน INKVERSE ได้ตอบกลับข้อความที่คุณส่งมาแล้ว:</p>
     <div style="border-left:3px solid #fff;padding:6px 16px;margin:18px 0;color:#fff;white-space:pre-wrap">${esc(opts.reply)}</div>
     <p style="color:#777;font-size:12px;margin-top:24px">— ข้อความเดิมของคุณ —</p>
     <p style="color:#777;font-size:12px;white-space:pre-wrap">${esc(opts.original)}</p>
     <p style="color:#777;font-size:12px;margin-top:20px">หากต้องการสอบถามเพิ่มเติม ส่งข้อความผ่านหน้า "ติดต่อเรา" บนเว็บไซต์ได้เลย</p>`
  );
}

export function passwordResetEmail(resetUrl: string) {
  return shell(
    "รีเซ็ตรหัสผ่าน",
    `<p>มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกลิงก์ด้านล่างเพื่อตั้งรหัสใหม่ (ลิงก์หมดอายุใน 1 ชั่วโมง)</p>
     <p style="margin:24px 0"><a href="${resetUrl}" style="background:#fff;color:#000;text-decoration:none;padding:12px 24px;text-transform:uppercase;letter-spacing:.1em;font-weight:bold;font-size:13px">ตั้งรหัสผ่านใหม่</a></p>
     <p style="color:#888;font-size:12px">ถ้าคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้</p>`
  );
}

export function verificationEmail(verifyUrl: string) {
  return shell(
    "ยืนยันอีเมล",
    `<p>ขอบคุณที่สมัคร INKVERSE! คลิกปุ่มด้านล่างเพื่อยืนยันอีเมล แล้วรับ 20 เหรียญต้อนรับทันที (ลิงก์หมดอายุใน 24 ชั่วโมง)</p>
     <p style="margin:24px 0"><a href="${verifyUrl}" style="background:#fff;color:#000;text-decoration:none;padding:12px 24px;text-transform:uppercase;letter-spacing:.1em;font-weight:bold;font-size:13px">ยืนยันอีเมล</a></p>
     <p style="color:#888;font-size:12px">ถ้าคุณไม่ได้สมัคร สามารถละเว้นอีเมลนี้ได้</p>`
  );
}

export function passwordResetOtpEmail(otp: string) {
  return shell(
    "รหัส OTP รีเซ็ตรหัสผ่าน",
    `<p>ใช้รหัสนี้เพื่อยืนยันการตั้งรหัสผ่านใหม่ (หมดอายุใน 10 นาที)</p>
     <p style="margin:24px 0;font-size:38px;font-weight:bold;letter-spacing:.35em;color:#fff">${otp}</p>
     <p style="color:#888;font-size:12px">ถ้าคุณไม่ได้ขอ สามารถละเว้นอีเมลนี้ได้</p>`
  );
}

export function topupReceiptEmail(coins: number, priceTHB: number) {
  return shell(
    "ใบเสร็จเติมเหรียญ",
    `<p>เติมเหรียญสำเร็จ ขอบคุณที่สนับสนุน INKVERSE</p>
     <p style="margin:20px 0;font-size:28px;font-weight:bold">${coins.toLocaleString()} เหรียญ</p>
     <p style="color:#888">ยอดชำระ ฿${priceTHB.toFixed(2)}</p>`
  );
}

export function withdrawalEmail(opts: { amount: number; status: "submitted" | "paid" }) {
  const isPaid = opts.status === "paid";
  return shell(
    isPaid ? "โอนเงินสำเร็จ" : "รับคำขอถอนเงิน",
    `<p>${isPaid ? "ระบบได้โอนเงินเข้าบัญชีของคุณเรียบร้อยแล้ว" : "เราได้รับคำขอถอนเงินของคุณแล้ว และกำลังดำเนินการ"}</p>
     <p style="margin:20px 0;font-size:28px;font-weight:bold">฿${opts.amount.toFixed(2)}</p>`
  );
}
