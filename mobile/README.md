# INKVERSE — แอป Android (กันแคปหน้าจอ)

แอปนี้เป็น **เปลือก (shell) ที่โหลดเว็บ INKVERSE** (https://inkverse-tau.vercel.app) เข้ามาแสดงใน WebView
ที่เปิด **FLAG_SECURE** ไว้ → **กดแคปหน้าจอ/อัดวิดีโอจอ = จอดำ** เหมือนแอป meb (กันทั้งแอป)

> ✨ ข้อดี: เพราะแอปโหลดเว็บสด **อัปเดตเว็บแล้วแอปเห็นทันที ไม่ต้อง build แอปใหม่** (build ใหม่เฉพาะตอนแก้ของฝั่ง native เช่นไอคอน/ชื่อ)

---

## สิ่งที่ต้องมีก่อน build
1. **Android Studio** (โหลดฟรี: https://developer.android.com/studio) — มาพร้อม JDK + Android SDK
2. เปิด Android Studio ครั้งแรก ปล่อยให้มันโหลด SDK ให้เสร็จ

## วิธี build เป็นไฟล์ .apk (แจกให้คนโหลด)

### วิธีที่ 1 — ผ่าน Android Studio (ง่ายสุด แนะนำ)
1. เปิด Android Studio → **Open** → เลือกโฟลเดอร์ `mobile/android`
2. รอ Gradle sync เสร็จ (แถบล่างหยุดหมุน)
3. เมนู **Build → Generate Signed App Bundle / APK → APK → Next**
4. กด **Create new…** สร้าง keystore (เก็บไฟล์ .jks + รหัสไว้ดีๆ — ใช้ทุกครั้งที่อัปเดตแอป)
5. เลือก **release** → Finish
6. ได้ไฟล์ที่ `mobile/android/app/release/app-release.apk`

### วิธีที่ 2 — command line (ถ้าตั้ง SDK path แล้ว)
```bash
cd mobile/android
./gradlew assembleRelease     # หรือ assembleDebug สำหรับทดสอบเร็วๆ (ไม่ต้อง sign)
```
ไฟล์อยู่ที่ `app/build/outputs/apk/`

## วิธีแจกให้ผู้อ่าน
1. อัปไฟล์ `.apk` ขึ้นเว็บคุณ (หรือ Google Drive) → ทำปุ่ม "ดาวน์โหลดแอป Android"
2. ผู้ใช้โหลด → กดติดตั้ง → Android จะถาม "อนุญาตติดตั้งจากแหล่งที่ไม่รู้จัก" → กดอนุญาต → ติดตั้งเสร็จ
3. เปิดแอป = อ่านได้ + **แคปไม่ได้** 🔒

## อัปเดตแอป (เวอร์ชันใหม่)
- แก้ `versionCode` (เพิ่มทีละ 1) + `versionName` ใน `android/app/build.gradle`
- build ใหม่ด้วย keystore **เดิม** → แจกไฟล์ใหม่

## เปลี่ยนค่าได้ที่
- URL เว็บ: `mobile/capacitor.config.json` → `server.url` (แล้วรัน `npx cap sync android`)
- ชื่อแอป: `android/app/src/main/res/values/strings.xml`
- ไอคอน: `android/app/src/main/res/mipmap-*/`
- กันแคป (FLAG_SECURE): `android/app/src/main/java/com/inkverse/app/MainActivity.java`

---
> ℹ️ ตอนนี้ FLAG_SECURE กันแคป **ทั้งแอป** (ทุกหน้า) — ปลอดภัยสุด ถ้าต้องการให้กันเฉพาะหน้าอ่านนิยายต้องเพิ่ม plugin สลับ flag รายหน้า (ทำเพิ่มได้ภายหลัง)
