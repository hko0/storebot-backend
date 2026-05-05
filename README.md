# 🛍️ StoreBot Backend

مساعد تسوق ذكي مدعوم بـ Claude AI — يخفي الـ API Key ويبحث بذكاء في 10,000+ منتج.

## المتطلبات
- Node.js 18+
- Claude API Key
- Google Merchant XML Feed URL

---

## 🚀 التشغيل السريع

```bash
# 1. نسخ الإعدادات
cp .env.example .env

# 2. عدّل .env وأضف بياناتك
nano .env

# 3. تثبيت المكتبات
npm install

# 4. تشغيل السيرفر
npm start
```

---

## ☁️ النشر على Railway (مجاني)

1. افتح [railway.app](https://railway.app)
2. New Project → Deploy from GitHub Repo
3. أضف متغيرات البيئة من `.env.example`
4. سيعطيك Railway رابط مثل: `https://storebot-xxx.up.railway.app`

---

## ☁️ النشر على Render (مجاني)

1. افتح [render.com](https://render.com)
2. New → Web Service → Connect GitHub
3. Build Command: `npm install`
4. Start Command: `npm start`
5. أضف Environment Variables

---

## 📡 API Endpoints

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/health` | GET | حالة السيرفر وعدد المنتجات |
| `/api/chat` | POST | إرسال رسالة والرد |
| `/api/stats` | GET | إحصائيات (الفئات والماركات) |
| `/api/refresh-feed` | POST | تحديث الكاش يدوياً |

---

## 🔒 الأمان

- مفتاح API محفوظ في السيرفر فقط
- `ALLOWED_ORIGINS` يحدد المتاجر المسموح لها
- الرسائل محدودة بـ 500 حرف
- آخر 12 رسالة فقط تُرسل لـ Claude

---

## 🧠 كيف يعمل البحث الذكي

```
سؤال العميل: "ابحث عن جوال سامسونج رخيص"
       ↓
تحليل الكلمات: ["جوال", "سامسونج", "رخيص"]
       ↓
بحث في 10,000 منتج (TF-IDF)
       ↓
أفضل 15 منتج مطابق → Claude
       ↓
رد ذكي للعميل
```

الكاش يُحدَّث تلقائياً كل ساعة.

---

## 🏪 إضافة الويدجت على متجرك (زد / شوبيفاي)

```html
<script>
  window.StoreBotConfig = {
    backendUrl: 'https://YOUR-BACKEND-URL.railway.app',
    storeName:  'اسم متجرك',
    lang:       'ar',
    primaryColor: '#0f0f1a',
    accentColor:  '#f5a623',
  };
</script>
<script src="https://YOUR-CDN.com/store-bot-widget.js" defer></script>
```
