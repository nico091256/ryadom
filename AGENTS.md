# Ryadom — Doimiy Agent Ko'rsatmalari va Loyiha Xotirasi

Ushbu fayl Antigravity / Agent uchun har bir yangi sessiya va kontekstda majburiy qo'llanma hisoblanadi.

---

## 1. Muloqot va Foydalanuvchi Afzalliklari (User Preferences)
* **Til:** Doimo o'zbek tilida (lotin alifbosi).
* **Uslub:** Qisqa, aniq, faktlarga asoslangan, ortiqcha lutfbozliksiz ("davom et" va "ruxsat" rejimida to'liq avtonom ishlash).
* **Intizom:** Biror xatolik yoki muammo bo'lsa, shoshilmasdan butun zanjirni tekshirib, ildiz sababini topish va barcha aloqador modellar bilan birga to'liq hal qilish.
* **Fayllar tozaligi:** Ortiqcha/keraksiz fayllar yaratmaslik, mavjud toza arxitekturani buzmaslik.

---

## 2. Ish Muhiti va Cheklovlar (Windows Environment)
* **OS:** Windows 10 Pro, Shell: PowerShell 5.1 (`&&`, `??`, `?.` ishlamaydi).
* **Docker / Android SDK:** O'rnatilmagan (yo'q). Barcha mahalliy sinovlar Node.js / dev-server orqali amalga oshiriladi; Flutter uchun `flutter analyze` + `flutter test` + `flutter build web`.
* **Flutter:** `C:\flutter\bin` (agar PATH'da bo'lmasa: `$env:PATH = "C:\flutter\bin;$env:PATH"`). Buyruq: `flutter` yoki `C:\flutter\bin\flutter.bat`.
* **Paket menejeri:** `pnpm` 12 (Node v20). PATH'da bo'lmasa `npx pnpm@12.11.2 <buyruq>`.
* **Portlar:**
  * `4000` — Backend API (`http://localhost:4000/api/v1`)
  * `3000` — Platform Admin paneli (Next.js)
  * `3001` — Do'konchi paneli `apps/store` (Next.js)
  * Dinamik port — Flutter mijoz veb-ilovasi (`mobile_client`)

---

## 3. Loyiha Arxitekturasi va Qat'iy Qarorlar (Project Decisions)
* **Monorepo tuzilmasi:**
  * `apps/backend` — NestJS API
  * `apps/admin` — Platform admin web paneli
  * `apps/store` — Do'konchilar uchun Next.js web paneli (Flutter `mobile_store` butunlay o'chirilgan)
  * `apps/mobile_client` — Xaridorlar uchun Flutter ilovasi (mobil va web)
  * `packages/shared` — TypeScript umumiy paket
  * `packages/shared_dart` — Flutter uchun Dart umumiy paket
* **Buyurtma hayotiy sikli (4 holat):**
  `new` ➔ `accepted` ➔ `on_the_way` ➔ `delivered` (+ `cancelled`).
* **Valyuta va narxlar:**
  Baza va API'da butun sonli **tiyin** formatida (1 UZS = 100 tiyin, masalan 4 000 so'm = 400 000 tiyin).
* **Enum simvollari (Wire format):**
  Barcha rollar, statuslar va to'lov turlari **kichik harflar** (lowercase) bilan beriladi:
  * `UserRole`: `'customer'`, `'seller'`, `'admin'`
  * `OrderStatus`: `'new'`, `'accepted'`, `'on_the_way'`, `'delivered'`, `'cancelled'`
  * `PaymentMethod`: `'cash'`, `'online'`
  * `SupportedLanguage`: `'uz'`, `'ru'`, `'en'`

---

## 4. Ishlash Standartlari (Workflow Discipline)
* Reja ➔ Test ➔ Amalga oshirish ➔ Tekshirish ➔ Toza Commit.
* Har bir qadamdan so'ng git holatini toza saqlash.
