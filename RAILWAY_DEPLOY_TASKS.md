# Railway Deploy — Brauzer Agenti uchun Topshiriq (jonli holat)

> Bu fayl Antigravity brauzer-agenti uchun. Ryadom loyihasini Railway'ga deploy qilish.
> Holat belgilari: ✅ bajarilgan · 🔄 jarayonda · ⬜ qilinmagan.
> Railway'ga login kerak bo'lsa, foydalanuvchi bir marta kiradi; keyin avtonom davom et.

---

## Kontekst (ID'lar)

- Project ID: `7286a2ba-d48e-4c38-bc4e-d187792453e6`
- Environment ID: `e9979114-bdc2-4c48-95eb-f0994a48b2e0`
- **api** servisi (ryadom, GitHub `nico091256/ryadom`) ID: `e9234a25-2792-41fb-b471-4d444c466f48`
- Bazalar (Online, tegma): **PostGIS**, **Redis**
- GitHub asosiy branch: `main`, oxirgi commit: `4f8dec6`

---

## HOLAT XULOSASI

| # | Qadam | Holat |
|---|---|---|
| 1 | api: Builder = Dockerfile, path `apps/backend/Dockerfile` | ✅ |
| 2 | api: Pre-deploy = tozalab, CMD ichida avto-migratsiya qilindi | ✅ |
| 3 | api: Variables kiritildi (DATABASE_URL porti to'g'rilandi) | ✅ |
| 4 | `sharp` build va `openssl` alpine tuzatildi | ✅ |
| 5 | api build muvaffaqiyatli (image push) | ✅ |
| 6 | api: migratsiya + start muvaffaqiyatli (PostgreSQL + Redis connected) | ✅ |
| 7 | api: domen + `/api/v1/health` tekshirildi (status: ok) | ✅ |
| 8 | admin servisi yaratildi va ishga tushdi | ✅ |
| 9 | store servisi yaratildi va ishga tushdi | ✅ |
| 10 | api: CORS_ORIGINS to'ldirildi | ✅ |
| 11 | custom domenlar qo'shildi (`ryadom.uz` DNS yozuvlari olindi) | 🔄 DNS kutilmoqda |
| 12 | Flutter web (mobile_client) | ⬜ |

---

## MUHIM SABOQ (takrorlanmasin)

- **"Redeploy" eski commitni ishga tushiradi.** Yangi kod uchun GitHub'ga push'dan keyin
  Railway avtomatik **yangi deployment** yaratadi — o'shани kuzat, eski "Redeploy"ni emas.
- pnpm 12 ruxsatsiz native build skriptlarini bloklaydi. Yangi native paket qo'shilsa,
  `pnpm-workspace.yaml` → `allowBuilds:` ga `paket: true` qo'shish kerak (masalan `sharp: true`).

---

## QARORLAR (foydalanuvchi tasdiqladi)

- **Domen:** `ryadom.uz` → `api.ryadom.uz`, `admin.ryadom.uz`, `store.ryadom.uz`, `app.ryadom.uz`
- **Rejim:** TEST — `NODE_ENV=development` + `SMS_PROVIDER=mock` (eskiz hali yo'q; OTP = `123456`).
  Eskiz olingach: `NODE_ENV=production` + `SMS_PROVIDER=eskiz` + `ESKIZ_EMAIL/PASSWORD` + `CORS_ORIGINS`.

## api VARIABLES — TEST REJIM (joriy)

api → `Variables` → `Raw Editor` → to'liq joyla va **Save** bos:
```
NODE_ENV=development
DATABASE_URL=${{PostGIS.DATABASE_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
JWT_ACCESS_SECRET=db4a0cb3f0c93d46faf678b206deaac8e65c077c9bb5d573e7c6034ea3c3fa0a
TRUST_PROXY=true
SMS_PROVIDER=mock
CORS_ORIGINS=https://admin.ryadom.uz,https://store.ryadom.uz,https://app.ryadom.uz
```
> `development`da `CORS_ORIGINS`/`eskiz` majburiy emas → boot o'tadi. `DATABASE_URL` baribir
> haqiqiy PostGIS'ga ulanadi (ilova avval real Postgres'ga urinadi; ulanmasa xotiraga tushadi).
> **Save bosilganini va to'g'ri environment (`e9979114`) ekanini tekshir** — aks holda konteyner "X is required" bilan yiqiladi.
> ⚠️ Agar `/health` "ok" emas, "in-memory-dev" desa — DATABASE_URL noto'g'ri, PostGIS'ga ulanmagan.

---

## 🔄 QADAM 6 — Joriy: migratsiya + start (KUZAT)

api deploy loglarини kuzat. Ketma-ketlik:
1. **Image push** ✅ (bajarildi)
2. **Pre-deploy (migratsiya):** izla →
   `Applying migration 0_init` ... `9_search_indexes_and_postgis` ...
   `All migrations have been successfully applied`.
3. **Start:** izla → `Nest application successfully started` (yoki `Listening on 4000`).

**Agar xato bo'lsa**, oxirgi qizil qatorlarni foydalanuvchiga ber va shu jadvalga qara:

| Xato matni | Sabab | Yechim |
|---|---|---|
| `type geography does not exist` / postgis | DATABASE_URL noto'g'ri bazaga | `${{PostGIS.DATABASE_URL}}` to'g'ri PostGIS'ga ketyaptimi tekshir |
| `Can't reach database server` | DATABASE_URL noto'g'ri | PostGIS Variables dagi aniq nomlardan URL tuz |
| `CORS_ORIGINS ... required` | prod'da CORS bo'sh | hozircha vaqtincha `NODE_ENV=development`, keyin QADAM 10'da to'ldiriladi |
| `SMS_PROVIDER ...` | prod'da `mock` taqiqlangan | eskiz hisob yo'q bo'lsa `NODE_ENV=development` + `SMS_PROVIDER=mock` |
| `JWT_ACCESS_SECRET ...` | kalit yo'q/qisqa | Variables'da kalit borligini tekshir |
| Redis `ECONNREFUSED` | Redis reference noto'g'ri | `${{Redis.REDISHOST/REDISPORT/REDISPASSWORD}}` nomlarini Redis Variables bilan solishtir |

> ⚠️ **SMS/eskiz qarori (foydalanuvchidan):** eskiz.uz hisobi bo'lmasa, api prod'da
> ishga tushmaydi. Unda: `NODE_ENV=development` + `SMS_PROVIDER=mock` (OTP = `123456`).

---

## ⬜ QADAM 7 — api domenini ochish va tekshirish

1. api → **Settings → Networking → Generate Domain**.
2. Brauzerda och: `https://<api-domen>/api/v1/health`
3. `{ "status": "ok", ... }` qaytsa — **api ISHLAYAPTI** ✅. Domenni foydalanuvchiga ber.

---

## ⬜ QADAM 8 — admin servisi

1. Project → `+ Create` → `GitHub Repo` → `nico091256/ryadom`.
2. Yangi servis → **Settings → Build**:
   - Builder: `Dockerfile`
   - Dockerfile Path: `apps/admin/Dockerfile`
   - Root Directory: bo'sh / `/`
3. **Variables** (Raw Editor):
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://api.ryadom.uz/api/v1
   ```
   > `NEXT_PUBLIC_*` build vaqtida yopishadi, shuning uchun `api.ryadom.uz` custom domeni
   > avval api servisiga ulangan bo'lishi kerak (QADAM 7/11). Agar hali ulanmagan bo'lsa,
   > vaqtincha api'ning Railway domenini ishlat, keyin qayta deploy.
4. **Settings → Networking → Generate Domain** → admin domeni.
5. Deploy → tekshir: admin sahifasi ochiladimi.

---

## ⬜ QADAM 9 — store servisi

QADAM 8 bilan bir xil, faqat:
- Dockerfile Path: `apps/store/Dockerfile`
- Variables: `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=https://api.ryadom.uz/api/v1`
- O'z domeni (`store.ryadom.uz` yoki `Generate Domain`).

---

## ⬜ QADAM 10 — api: CORS_ORIGINS to'ldirish

admin va store domenlari ma'lum bo'lgach, api → **Variables** → qo'sh/yangila:
```
CORS_ORIGINS=https://<admin-domen>,https://<store-domen>
```
(custom domen ulangach, ularni ham qo'sh.) Saqlagach api avtomatik qayta deploy bo'ladi.

> Prod'da `CORS_ORIGINS` bo'sh bo'lsa panellar api'ga ulanmaydi.

---

## ⬜ QADAM 11 — Custom domen (foydalanuvchida domen bor)

Subdomenlar (domen: **ryadom.uz**):
- `api.ryadom.uz` → api · `admin.ryadom.uz` → admin · `store.ryadom.uz` → store · `app.ryadom.uz` → Flutter web

Har servisda: **Settings → Networking → Custom Domain** → subdomen yoz → Railway bergan
**CNAME target**ni DNS (Cloudflare/registrator)ga qo'sh. SSL avtomatik.
So'ng QADAM 10'dagi `NEXT_PUBLIC_API_URL` va `CORS_ORIGINS` ni custom domenlarga yangila.

---

## ⬜ QADAM 12 — Flutter web (mobile_client)

Railway statik fayl xizmat qilmaydi. Lokal build + statik hosting (Cloudflare Pages / Netlify / Vercel):
```
cd apps/mobile_client
flutter build web --release --dart-define=API_BASE_URL=https://api.ryadom.uz/api/v1
# build/web/ ni hosting'ga yukla
```
Domenni `CORS_ORIGINS` ga ham qo'sh.

---

## Yakuniy hisobot (foydalanuvchiga)

Har bosqichdan so'ng ayt:
1. api: migratsiya o'tdimi? start o'tdimi? `/api/v1/health` javobi?
2. api domeni nima?
3. admin/store domenlari va holati?
4. Qayerda xato bo'lsa — oxirgi log qatorlari.
