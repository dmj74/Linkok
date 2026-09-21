# 🔗 لینکوک (Linkok)

**سامانه حرفه‌ای کوتاه‌کننده لینک، اشتراک فایل، بیو لینک و پنل مدیریت — فارسی، RTL و کاملاً واکنش‌گرا**

لینکوک یک پلتفرم کامل و آماده‌ی اجرا است که چهار سرویس پرکاربرد را در یک سامانه جمع می‌کند:

| سرویس | توضیح |
|---|---|
| 🔗 **کوتاه‌کننده لینک** | نامک دلخواه، رمز عبور، تاریخ انقضا، سقف کلیک، برچسب، QR اختصاصی، ثبت گروهی و خروجی CSV |
| 📁 **اشتراک فایل** | آپلود فایل و تبدیل خودکار به لینک کوتاه، صفحه دانلود با پیش‌نمایش تصویر/ویدیو/صدا، شمارش دانلود |
| 👤 **بیو لینک** | صفحه شخصی با شخصی‌سازی کامل (رنگ، پس‌زمینه، فونت، انیمیشن، شکل دکمه‌ها) + آیکن‌های آماده + آمار کلیک |
| 🛡️ **پنل مدیریت** | مدیریت کاربران، لینک‌ها، فایل‌ها، دامنه‌ها، صفحات بیو، تنظیمات سایت، اطلاعیه‌ها و گزارش فعالیت‌ها |

> ثبت‌نام و ورود فقط با **نام کاربری و رمز عبور** انجام می‌شود (ایمیل اختیاری است).

---

## ✨ امکانات کلیدی

### صفحه اصلی (لندینگ)
- منوی جذاب و چسبان با نسخه موبایل (همبرگری) و حالت تاریک/روشن
- ابزار تعاملی کوتاه‌سازی لینک و آپلود فایل مستقیماً در صفحه اصلی
- بخش‌های معرفی امکانات، نحوه کار، دامنه اختصاصی، بیو لینک با ماکت موبایل، آمار زنده، تعرفه‌ها، سوالات متداول
- نمایش نوار اطلاع‌رسانی که مدیر از پنل تنظیم می‌کند

### کوتاه‌کننده
- نامک دلخواه یا کد تصادفی (طول کد از تنظیمات قابل تغییر)
- رمز عبور روی لینک (با صفحه ورود اختصاصی)، تاریخ انقضا، محدودیت تعداد کلیک
- برچسب‌گذاری، جستجو، فیلتر وضعیت، مرتب‌سازی و صفحه‌بندی
- افزودن گروهی لینک‌ها (هر خط: `آدرس نامک`)
- کد QR با انتخاب رنگ و خروجی PNG/SVG
- آمار دقیق: کلیک، کاربر یکتا، ربات‌ها، نمودار روزانه، دستگاه/مرورگر/سیستم‌عامل/منبع ورود، توزیع ساعتی و آخرین بازدیدها
- خروجی CSV از همه لینک‌ها

### اشتراک فایل
- کشیدن‌و‌رها کردن فایل با نوار پیشرفت، تا ۲۵ فایل در هر بار
- ذخیره در شاخه‌بندی ماهانه (`uploads/YYYY-MM/`) با نام‌گذاری تصادفی
- صفحه‌ی دانلود زیبا با پیش‌نمایش تصویر، ویدیو و صدا + دکمه دانلود
- رمز عبور، تاریخ انقضا، فعال/غیرفعال‌سازی و تغییر کد لینک
- محدودیت پسوندهای پرخطر (php, exe, sh, js, html, …)

### بیو لینک (شخصی‌سازی کامل)
- ویرایشگر با **پیش‌نمایش زنده** گوشی
- ۸ قالب رنگ آماده + انتخاب رنگ آزاد برای پس‌زمینه، متن و دکمه‌ها
- پس‌زمینه: گرادیان / رنگی / تصویری / مش چندرنگ + زاویه گرادیان
- شکل دکمه‌ها (گرد، کپسولی، شیشه‌ای)، سایه، شفافیت، فونت، شکل تصویر پروفایل
- بلوک‌ها: لینک، شبکه‌های اجتماعی، متن، عنوان، ایمیل، تلفن، فروشگاه، حمایت مالی و…
- مرتب‌سازی بلوک‌ها با درگ‌اند‌دراپ، آیکن‌پیکر داخلی و فعال/غیرفعال‌سازی هر بلوک
- آمار صفحه: بازدید کل، نمودار ۳۰ روزه، منبع ورود، دستگاه و کلیک هر بلوک
- ذخیره خودکار (autosave) و امکان انتشار/پیش‌نویس

### دامنه اختصاصی
- افزودن دامنه یا زیر‌دامنه با راهنمای گام‌به‌گام رکورد DNS
- تأیید مالکیت از طریق **TXT**، **CNAME** یا **A** (بررسی خودکار DNS)
- تعیین کاربرد دامنه: کوتاه‌کننده، صفحه بیو لینک یا انتقال به سایت اصلی
- سهمیه دامنه بر اساس پلن کاربر

### پنل مدیریت
- داشبورد KPI: کاربران، لینک‌ها، کلیک‌ها، فایل‌ها، فضای مصرفی، اطلاعات سرور و دیسک
- نمودار روند کلیک/کاربر/لینک، سهم پلن‌ها، پربازدیدترین لینک‌ها، فعال‌ترین کاربران و پر دانلودترین فایل‌ها
- مدیریت کاربران: تغییر نقش/پلن/وضعیت، مسدودسازی، بازنشانی رمز، حذف کامل با داده‌ها، مشاهده جزئیات هر کاربر
- مدیریت لینک‌ها و فایل‌ها: جستجو، فعال/غیرفعال، ویرایش کد/مقصد، انتقال مالکیت و حذف
- تأیید/رد دامنه‌ها، مدیریت صفحات بیو لینک
- تنظیمات سایت: نام و شعار، آدرس پایه، ثبت‌نام، لینک مهمان، کلیدهای غیرمجاز، محدودیت آپلود، رنگ برند، حالت تعمیر و نوار اطلاع‌رسانی
- اطلاعیه‌ها و گزارش فعالیت‌ها (Audit Log) + خروجی CSV همه بخش‌ها

### فنی
- نود + اکسپرس + **better-sqlite3** (بدون نیاز به سرور دیتابیس جداگانه)
- احراز هویت با کوکی HttpOnly امضاشده (HMAC) و کلید API برای برنامه‌نویسان
- هش رمز عبور با bcrypt، محدودسازی نرخ درخواست، اعتبارسنجی ورودی‌ها و پیام‌های خطای فارسی
- طراحی واکنش‌گرا با فونت **وزیرمتن** میزبانی‌شده روی خود سرور (بدون CDN)
- نمودارهای سبک و بدون وابستگی خارجی (SVG)
- آمار بدون احتساب بازدیدهای داخلی و با تفکیک ربات‌ها
- جمع‌آوری خودکار: انقضای فایل/لینک و پاک‌سازی آمار قدیمی (کار زمان‌بندی‌شده)

---

## 🚀 راه‌اندازی سریع

```bash
# ۱) نصب وابستگی‌ها
npm install

# ۲) اجرای سرور (دیتابیس و داده اولیه به‌صورت خودکار ساخته می‌شوند)
npm start

# یا در حالت توسعه با ری‌استارت خودکار
npm run dev
```

سپس در مرورگر باز کنید: **http://localhost:3000**

### حساب‌های آماده (فقط در اولین اجرا ساخته می‌شوند)

| نقش | نام کاربری | رمز عبور |
|---|---|---|
| مدیر سامانه | `admin` | `Admin@1234` |
| کاربر نمونه (پلن حرفه‌ای) | `demo` | `Demo@1234` |
| کاربر عادی | `sara` | `Sara@1234` |

> ⚠️ پس از استقرار روی سرور واقعی، رمز حساب مدیر را از بخش «تنظیمات حساب» تغییر دهید.

### تنظیمات محیطی (اختیاری)

| متغیر | توضیح | پیش‌فرض |
|---|---|---|
| `PORT` | پورت اجرای سرور | `3000` |
| `BASE_URL` | دامنه‌ای که لینک‌ها با آن ساخته می‌شوند (مثلاً `https://linkok.ir`) | دامنه درخواست |
| `LINKOK_SECRET` | کلید امضای توکن‌ها | تولید و ذخیره در `data/secret.key` |
| `LINKOK_DB` | مسیر فایل دیتابیس | `data/linkok.db` |
| `LINKOK_SERVER_IP` | IP سرور برای راهنمای رکورد A دامنه‌ها | تشخیص خودکار |
| `NODE_ENV` | محیط اجرا (`production` برای کوکی امن) | `development` |

---

## 🌐 اتصال دامنه اختصاصی

۱. در داشبورد → «دامنه‌های اختصاصی» دامنه خود را وارد کنید (مثال: `go.example.com`).
۲. یکی از رکوردهای زیر را در پنل DNS ثبت کنید:

```
TXT   _linkok.go.example.com   →   linkok-verify=xxxxxxxx
# یا
CNAME go.example.com           →   linkok.ir
# یا
A     go.example.com           →   IP سرور شما
```

۳. دکمه **بررسی DNS** را بزنید. پس از تأیید، همه لینک‌های ساخته‌شده روی آن دامنه با برند شما کوتاه می‌شوند و می‌توانید همان دامنه را به صفحه بیو لینک هم متصل کنید.

---

## 📚 مستندات API

همه مسیرها JSON برمی‌گردانند (`{ ok: true, ... }` یا `{ ok: false, error }`).
برای احراز هویت یا از کوکی نشست استفاده کنید یا هدر `Authorization: Bearer YOUR_API_KEY` (کلید در «تنظیمات حساب» ساخته می‌شود).

```
POST   /api/auth/register           { username, password, email?, display_name? }
POST   /api/auth/login              { username, password }
POST   /api/auth/logout | /logout-all
GET    /api/auth/me                 اطلاعات کاربر، سهمیه و محدودیت‌ها
PATCH  /api/auth/profile            { display_name, email, bio, avatar }
POST   /api/auth/password           { current_password, new_password }
POST   /api/auth/api-key            ساخت کلید API جدید

GET    /api/links?page&per_page&q&status&sort&domain_id
POST   /api/links                   { url, alias?, domain_id?, title?, password?, expires_at?, click_limit?, tags? }
POST   /api/links/bulk              { text: "url alias\nurl2", domain_id? }
GET    /api/links/:id | PATCH | DELETE
GET    /api/links/:id/stats?days=30
GET    /api/links/:id/qr?size=400&dark=%230f172a&light=%23ffffff&format=png|svg|json
POST   /api/links/:id/reset-stats
GET    /api/links/export/csv

POST   /api/files/upload            multipart: files[] (+ password, expires_at, is_public)
POST   /api/files/upload-json       { filename, content_base64 }
GET    /api/files | PATCH /:id | DELETE /:id | POST /:id/reset-stats | GET /api/files/export/csv

GET    /api/domains                 POST /api/domains { hostname }
POST   /api/domains/:id/verify      بررسی رکوردهای DNS
PATCH  /api/domains/:id             { mode: shortener|bio|redirect_home, bio_slug }
DELETE /api/domains/:id?force=1

GET    /api/bio                     صفحه، بلوک‌ها، آمار، آیکن‌ها
PATCH  /api/bio                     { title, headline, bio, slug, avatar, theme, published }
POST   /api/bio/upload              multipart: image (حداکثر ۴ مگابایت)
POST   /api/bio/blocks | PATCH|DELETE /api/bio/blocks/:id | PATCH /api/bio/blocks/reorder
GET    /api/bio/analytics?days=30

# فقط مدیر
GET    /api/admin/stats?days=30 | /analytics | /users | /links | /files | /domains | /bio | /logs
PATCH  /api/admin/users/:id | POST /api/admin/users/:id/reset-password | DELETE
PATCH  /api/admin/links/:id | DELETE /api/admin/links/:id
PATCH  /api/admin/domains/:id | DELETE /api/admin/domains/:id
GET|PUT /api/admin/settings
POST|GET|DELETE /api/admin/announcements
GET    /api/admin/export/:type (users|links|files|domains) | /api/admin/logs/export

# عمومی
GET    /api/public/config | /api/public/recent-files | /api/public/health
POST   /api/public/shorten          ساخت لینک مهمان (در صورت فعال بودن)
GET    /api/public/qr?data=https://example.com&size=420
GET    /healthz
```

### نمونه با کلید API

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","alias":"my-link"}'
```

### آدرس‌های عمومی

```
/:code            لینک کوتاه (دامنه اصلی)
/r/:code , /s/:code  نسخه صریح لینک کوتاه
/u/:slug          صفحه بیو لینک
/f/:code          صفحه دانلود فایل
/f/:code/download دریافت فایل
```

---

## 🗂️ ساختار پروژه

```
Linkok/
├── server/
│   ├── index.js          راه‌اندازی اکسپرس، مسیرها، کارهای زمان‌بندی‌شده
│   ├── config.js         تنظیمات، مسیرها، سهمیه پلن‌ها
│   ├── db.js             اسکیمای SQLite، تنظیمات پیش‌فرض و داده اولیه
│   ├── auth.js           احراز هویت، کوکی، محدودیت نرخ، محاسبه سهمیه
│   ├── util.js           ابزارها (توکن، هش، اعتبارسنجی، تاریخ، CSV)
│   ├── dns.js            بررسی رکوردهای DNS دامنه‌ها
│   ├── views.js          رندر سرور صفحات بیو لینک، فایل و پیام‌ها
│   └── routes/           auth, links, files, domains, bio, public, admin
├── public/
│   ├── index.html        صفحه اصلی (لندینگ)
│   ├── login.html / register.html / dashboard.html / admin.html
│   ├── pricing.html / terms.html
│   └── assets/           css/base.css، js/{common,charts,landing,dashboard,bio,admin}.js
│                         fonts/ (وزیرمتن) و img/ (favicon)
├── data/                 دیتابیس و کلید امضا (در ریپو ایگنور است)
└── uploads/              فایل‌های آپلودشده (در ریپو ایگنور است)
```

---

## 🔒 نکات امنیتی و بهینه‌سازی برای سرور واقعی

1. سرور را پشت یک Reverse Proxy (Nginx/Caddy) با **HTTPS** قرار دهید و `NODE_ENV=production` بگذارید.
2. مقدار `BASE_URL` را روی دامنه نهایی تنظیم کنید تا لینک‌ها همیشه با دامنه درست ساخته شوند.
3. دسترسی مستقیم به پوشه `uploads/` از طریق وب‌سرور را محدود کنید (فایل‌ها از مسیر `/uploads` با هدرهای امنیتی سرو می‌شوند؛ برای حساس‌ترین موارد از فروشگاه ابری استفاده کنید).
4. از پوشه‌های `data/` و `uploads/` پشتیبان دوره‌ای بگیرید.
5. برای اجرای دائمی از `pm2` یا `systemd` استفاده کنید:
   ```bash
   pm2 start server/index.js --name linkok
   ```
6. سهمیه‌ها و کلمات غیرمجاز را از پنل مدیریت متناسب با سیاست خود تنظیم کنید.

---

## 🧪 بررسی سریع پس از اجرا

```bash
curl -s localhost:3000/healthz
curl -s localhost:3000/api/public/config | head -c 300
curl -s -X POST localhost:3000/api/public/shorten \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```

---

## 📄 مجوز

این پروژه با مجوز **MIT** منتشر شده است؛ آزادانه استفاده، تغییر و توزیع کنید.
ساخته شده با ❤️ برای وب فارسی.
