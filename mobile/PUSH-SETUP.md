# เปิดใช้ Push Notification (แจ้งเตือนตอนใหม่ในแอป)

โค้ดทั้งหมดพร้อมแล้ว — เหลือแค่ **ตั้ง Firebase (ฟรี)** แล้วเอาค่า 2 อย่างมาใส่
จากนั้น "ติดตามเรื่อง → มีตอนใหม่ → แอปเด้งเตือน" จะทำงานเอง

> ถ้ายังไม่ตั้ง Firebase ก็ไม่เป็นไร — แอป/เว็บใช้งานได้ปกติ แค่ push ยังไม่ทำงาน

---

## ขั้นที่ 1 — สร้าง Firebase project (ฟรี)
1. ไปที่ **https://console.firebase.google.com** → **Add project** → ตั้งชื่อ (เช่น inkverse) → สร้าง
2. ในโปรเจกต์ → กดไอคอน **Android** เพื่อเพิ่มแอป
   - **Android package name:** `com.inkverse.app` (ต้องตรงเป๊ะ)
   - กด Register → **ดาวน์โหลดไฟล์ `google-services.json`**

## ขั้นที่ 2 — เอา google-services.json เข้า build (สำหรับ "ในแอป")
1. แปลงไฟล์เป็น base64:
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json")) | Set-Clipboard`
   - (หรือเว็บแปลง base64 ก็ได้)
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - **Name:** `GOOGLE_SERVICES_JSON`
   - **Value:** ค่า base64 ที่ก็อปมา
3. ไป **Actions → Build Android APK → Run workflow** → build แอปใหม่ (คราวนี้ push เปิด)

## ขั้นที่ 3 — Service account สำหรับ "ฝั่งเซิร์ฟเวอร์ส่ง push"
1. Firebase Console → ⚙️ **Project settings → Service accounts → Generate new private key** → ได้ไฟล์ JSON
2. เปิดไฟล์ JSON → ก็อปเนื้อหา**ทั้งหมด**
3. **Vercel → Settings → Environment Variables** → เพิ่ม:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** วางเนื้อหา JSON ทั้งก้อน
4. **Redeploy** (Vercel)

---

## เสร็จแล้ว 🎉
- ผู้อ่านเปิดแอป → ระบบขอสิทธิ์แจ้งเตือน → ลงทะเบียน token อัตโนมัติ
- มีคนกด **บุ๊กมาร์ก** เรื่องไว้ → พอนักเขียนลงตอนใหม่ → **แอปเด้งแจ้งเตือน** + กดแล้วเปิดตอนนั้นเลย

## ความปลอดภัย
- `FIREBASE_SERVICE_ACCOUNT` = ความลับ ห้าม commit ลงโค้ด (ใส่ใน Vercel env เท่านั้น)
- `GOOGLE_SERVICES_JSON` ใส่เป็น GitHub secret (ไม่ commit ไฟล์ตรงๆ)
