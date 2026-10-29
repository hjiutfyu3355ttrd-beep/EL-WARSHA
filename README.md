# نظام الورشة

نظام إدارة ورش (أوامر شغل، عملاء وسيارات، مخزون، مدفوعات، تقارير) — **HTML + CSS + JavaScript عادي**، من غير React ولا npm ولا أي خطوة بناء.
قاعدة البيانات والدخول على **Supabase**، والاستضافة على **Cloudflare Pages**.

> **للمساعد الذكي أو أي مطوّر:** ابدأ بملف [`HANDOFF.md`](./HANDOFF.md) — فيه الهدف والحالة والقرارات والخطوات الجاية.

## جرّبه دلوقتي (من غير أي إعداد)

الملفات دي صفحات عادية، بس المتصفح بيمنع بعض الحاجات لو فتحت الملف مباشرة (`file://`)، فالأفضل تشغّل سيرفر محلي صغير:

```bash
# من جوه الفولدر (لو عندك Python)
python3 -m http.server 8000
# أو لو عندك Node
npx serve .
```

وافتح `http://localhost:8000`. هتلاقي النظام شغال بـ **وضع Demo**: بيانات تجريبية محفوظة في متصفحك بس (مفيش اتصال بأي سيرفر). تقدر تجرّب كل الشاشات، وزرار "إعادة ضبط البيانات التجريبية" فوق بيرجّعها زي الأول.

## إزاي الكود شغّال (لو خلفيتك HTML/JS)

```
index.html, work-orders.html, ...   كل صفحة = ملف HTML صغير (هيكل فاضي + <div id="app">)
css/style.css                       كل الشكل
js/config.js                        إعدادات Supabase (الملف الوحيد اللي هتعدّل فيه)
js/db.js                            طبقة البيانات: كل التعامل مع الداتابيز بيعدّي من هنا
js/ui.js                            أدوات مشتركة: الشريط الجانبي، حماية الصفحات، تنسيق الأرقام والتواريخ
js/pages/*.js                       منطق كل صفحة (بيرسم الصفحة ويربط الأزرار)
```

**الفكرة الأساسية:** كل صفحة بتحمّل نفس الملفات بالترتيب، وفي الآخر ملف `js/pages/اسم-الصفحة.js`:

```html
<script src="js/config.js"></script>   <!-- 1) الإعدادات -->
<script src="js/db.js"></script>       <!-- 2) الداتابيز: window.DB -->
<script src="js/ui.js"></script>       <!-- 3) الأدوات: window.UI -->
<script src="js/pages/customers.js"></script>  <!-- 4) منطق الصفحة -->
```

وملف الصفحة بيعمل نفس الخطوات دايماً:

```js
var page = await UI.init("customers");          // يرسم الشريط الجانبي ويتأكد إنك مسجّل دخول
var rows = await DB.list("customers");          // يجيب البيانات
page.innerHTML = html`<table>...${rows.map(...)}...</table>`;   // يرسم
// وبعدين addEventListener على الأزرار والفورمز
```

**نقطتين مهمين:**
1. `html` دي قالب بيعمل **escape تلقائي** لأي قيمة (حماية من XSS). لو عميل اسمه `<script>` هيظهر كنص عادي. متستخدمش `+` تلزّق نصوص جوه `innerHTML` من غير ما تعدّيها على `html` أو `UI.esc()`.
2. الصفحات بتكلّم `DB.list / insert / update / remove` بس، مش Supabase مباشرة. عشان كده نفس الكود بيشتغل في وضع Demo وفي الوضع الحقيقي.

## الربط بـ Supabase (بعد ما نجهّز قاعدة البيانات)

1. طبّق ملف `supabase/migrations/20261015000001_init.sql` على مشروعك (SQL Editor أو بالمساعد).
2. افتح `js/config.js` وحط:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "المفتاح anon / publishable",
   };
   ```
   المفتاح ده **مصمم يكون ظاهر في المتصفح** — الأمان بييجي من RLS في الداتابيز. **ممنوع** تحط `service_role` هنا أبداً.
3. سجّل حساب من `signup.html` برقم تليفونك، وبعدها شغّل `supabase/admin_setup.sql` برقمك عشان تبقى الأدمن وتفتح `admin.html`. (الدخول كله برقم التليفون؛ لازم "Confirm email" يكون مقفول في Supabase ← Authentication ← Providers ← Email.)

## الرفع على GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/workshop-system.git
git push -u origin main
```

## النشر على Cloudflare Pages

1. Workers & Pages ← Create ← Pages ← Connect to Git ← اختار الريبو.
2. **Framework preset: None. Build command: سيبه فاضي. Build output directory: `/`** (الفولدر الرئيسي).
3. كل push على `main` بيتنشر لوحده.
4. ملف `_headers` بيتطبّق تلقائياً وفيه سياسة CSP تسمح بس بملفات الموقع + مكتبة Supabase من `cdn.jsdelivr.net` + خط Cairo + اتصال Supabase. **لو ضفت مكتبة خارجية لازم تضيف دومينها في `_headers`** وإلا المتصفح هيحجبها.

## ملاحظات أمان

- الحماية الحقيقية بتتعمل في الداتابيز (RLS على `shop_id` + دوال الأدمن)، مش في كود الصفحات. إخفاء رابط `admin.html` مش حماية.
- ماتحطش أي أسرار في `js/config.js` غير الـ anon key.
- ملفات `.env*` متضافة في `.gitignore` (مش مستخدمة حالياً بس احتياط).
