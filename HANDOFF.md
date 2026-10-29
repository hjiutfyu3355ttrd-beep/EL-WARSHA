# HANDOFF — نظام الورشة (ملف التسليم للمساعد)

> **الإصدار:** v0.4.0 — **آخر تحديث:** 2026-10-16
> **لأي مساعد ذكي جديد:** اقرأ الملف ده كامل قبل ما تعمل أي حاجة. هو المرجع الأساسي للمشروع وللتفضيلات والقرارات اللي اتاخدت. بعد ما تقراه كمّل مباشرة من قسم "الخطوات الجاية". ولما تسلّم أي شغل جديد: **حدّث الملف ده** (قسم الحالة + سجل التغييرات + رفع الإصدار) وسلّم المستخدم الزيب المحدّث ومعاه نسخة من الملف.

---

## 1) الهدف النهائي

بناء **SaaS لإدارة الورش (ورشة سيارات أولاً)** بنظام أوامر الشغل، متعدد الورش (Multi-tenant)، تقدر تبيعه لأكتر من ورشة. مستوحى من نظام **سيستم اتش (hsys.io)** المصري (كاشير/إدارة بالعربي لـ 60+ نشاط)، لكن بتصميم وأسماء خاصة بنا مش نسخ حرفي.

**المكوّنات المطلوبة:**
1. تطبيق ويب عربي RTL بـ **HTML/CSS/JavaScript عادي** على **Cloudflare Pages**، والكود على **GitHub**.
2. **Supabase**: Postgres + Auth + RLS لعزل بيانات كل ورشة.
3. **تسجيل حساب ودخول** لكل مستخدم، وكل مستخدم يشوف بيانات ورشته بس.
4. **صفحة إدارة `admin.html` لصاحب المشروع (الأدمن)** يشوف فيها كل اللي سجّلوا ويفعّل/يوقف/يمدّد التجربة.

## 2) صاحب المشروع وتفضيلاته

- بيتكلم **عربي مصري**؛ الرد يكون بالعامية المصرية المهذبة، **مختصر**، يبدأ بالإجابة (بيستخدم موبايل).
- **خلفيته HTML وJavaScript عادي. أول مرة يشوف React.** قرار صريح منه: *"خلينا في الـ HTML علشان أعرفها."* ← **ماترجعش لـ React/Vite/npm ولا تضيف خطوة بناء.** اكتب كود بسيط يقدر يقراه ويتعلّم منه (ES5 مع `var` و`function` زي الموجود، تعليقات عربي، من غير مكتبات إلا لو لازم).
- مش مبرمج متعمّق: عايز المساعد يقرر ويتابع الشغل بنفسه ويسلّمه **زيب جاهز للرفع على GitHub**.
- مع كل تسليم عايز: **زيب محدّث + ملف HANDOFF.md ده** (عشان يبدأ محادثة جديدة ويكمّل).

### مشروع Supabase الصح (مهم)

| | |
|---|---|
| المنظمة | **EL-WARSHA** (id: `qrhqnxenaxyttxawkvkh`، خطة Free) |
| المشروع | `hjiutfyu33.5.5.t.t.r.d@gmail.com's Project` — **id: `blspjpghimjpyczxkvvs`**، region `eu-west-1`، Postgres 17 |
| الرابط | `https://blspjpghimjpyczxkvvs.supabase.co` |
| اتعمل | 2026-10-15 (جديد، كان فاضي تماماً قبل ما نطبّق الـ migrations) |

- المستخدم أكّد صراحة إن موصّل Supabase مربوط بمشروع الورشة ده، وإن العمل عليه مسموح. **الشغل على الداتابيز دي (قراءة، migrations، فحص advisors) مصرّح بيه.** لكن اسأله قبل أي حاجة **مدفوعة** (branches، مشروع جديد) أو **مدمّرة** (حذف جداول/بيانات)، وقبل أي حاجة تكتب في `auth.users`.
- **تحذير تاريخي:** في جلسة سابقة كان الموصّل مربوط بمنظمة تانية (`Rollex System`، مشروع `rollex-system`، id `ykkhkgajzyxsgoamtmnn`) **ومالوش صلاحية على الداتابيز** (كل استعلام رجع "You do not have permission"). **ده مش مشروع الورشة — ماتلمسوش أبداً.** حالة الموصّل ممكن تتغيّر بين المحادثات، فابدأ دايماً بـ `list_projects` وتأكد إن المنظمة `EL-WARSHA` والـ id مطابق قبل أي كتابة.

## 3) الحالة الحالية

| الجزء | الحالة |
|---|---|
| كل الصفحات (دخول، تسجيل، رئيسية، أوامر شغل + جديد + تفاصيل، عملاء وسيارات، مخزون، تقارير، إعدادات/فنيين، إدارة) | ✅ مكتوبة **ومجرّبة في متصفح حقيقي** (Chromium/Playwright) في **وضع Demo**: 34/34 فحص نجح (قبل ما نربط Supabase) |
| حماية XSS (قالب `html` بيعمل escape)، CSP في `_headers`، الموبايل 390px | ✅ مجرّبة (في Demo) |
| **قاعدة البيانات على Supabase** | ✅ **اتطبّق migrationين**: `init_workshop_schema` و`revoke_trigger_function_execute` (الملفين في `supabase/migrations/` ومطابقين لـ `list_migrations`). 11 جدول كلهم `rls_enabled = true`. اتطبّق من أول مرة بدون أخطاء. |
| فاحص الأمان (`get_advisors security`) بعد التطبيق | ✅ مفيش ERROR. باقي: INFO واحد (`platform_admins` من غير policies — **مقصود**) + 5 WARN `authenticated_security_definer_function_executable` — **مقصودين**: `admin_list_shops` و`admin_update_shop` و`is_platform_admin` الواجهة بتناديهم والأدمن بيتأكد منه جوه الدالة، و`current_shop_id` و`shop_writable` بتستخدمهم سياسات RLS. (اختياري: نقل الدوال المساعدة لسكيما `private`.) تحذير `anon` على `handle_new_user` اتقفل. |
| فاحص الأداء | ℹ️ 16 INFO "unused index" — طبيعي في قاعدة جديدة فاضية، **تجاهله دلوقتي**. |
| **ربط الفرونت (`js/config.js`)** | ✅ اتعبّى بـ URL والمفتاح العام (`sb_publishable_…`). **من دلوقتي التطبيق بيشتغل بالوضع الحقيقي ومحتاج تسجيل دخول** (مش Demo). لو عايز Demo فضّي القيمتين. |
| **اختبار عزل الورش بين حسابين (RLS)** | ⚠️ **لسه ما اتجرّبش.** محاولة تشغيله (كتلة `DO` بتنشئ 3 مستخدمين تجريبيين في `auth.users` جوه معاملة وبعدين `raise exception` يلغيها) رجعت `{"status":"cancelled"}` — ما اتنفّذتش. **ماتعيدهاش من غير ما تسأل المستخدم.** البديل الطبيعي: يعمل حسابين حقيقيين من `signup.html` وتجرّبوا. |
| **الوضع الحقيقي end-to-end (تسجيل ← دخول ← بيانات ← أدمن)** | ⚠️ **لسه ما اتجرّبش** (لا من المستخدم ولا من الـ sandbox). كود `js/db.js` للوضع الحقيقي مكتوب على واجهة supabase-js المعروفة بس ما اتشغّلش قدام داتابيز. |
| تعيين المستخدم كأدمن | ⏳ `supabase/admin_setup.sql` — **محتاج إيميل الأدمن من المستخدم** (يسجّل بيه من `signup.html` الأول). |
| النشر على Cloudflare Pages / GitHub | ⏳ على المستخدم (الخطوات في README) |

## 4) المعمارية

```
المتصفح (صفحات HTML + JS عادي) ──supabase-js من CDN (publishable key)──▶ Supabase (Postgres + Auth + RLS)
        │
        └── Cloudflare Pages (استضافة ثابتة، بدون build، + _headers للأمان)
```

- **لا يوجد سيرفر خاص ولا خطوة بناء ولا npm.** كل الحماية في الداتابيز (RLS + دوال SECURITY DEFINER). الصفحات تستخدم **publishable/anon key فقط**؛ `service_role` ممنوع في الفرونت نهائياً.
- **ترتيب تحميل السكريبتات في كل صفحة:** `supabase.js (CDN)` ← `config.js` ← `db.js` ← `ui.js` ← `pages/<الصفحة>.js` (صفحتي login/signup بدون `ui.js`).
- **`js/db.js` → `window.DB`**: الطبقة الوحيدة اللي بتكلّم الداتابيز: `list / insert / update / remove` + `auth.signIn/signUp/signOut/getSession` + `isAdmin / adminListShops / adminUpdateShop` + `resetDemo` + `demoMode`. لو `SUPABASE_URL` و`SUPABASE_ANON_KEY` في `js/config.js` فاضيين → `demoMode = true` وكل شيء يشتغل على localStorage (مفاتيحها `demo:<table>`). **أي ميزة جديدة تتعمل فوق DB.\*** عشان الـ Demo يفضل شغال.
- **`js/ui.js` → `window.UI`**: القالب الآمن `html\`...\``، `esc`، `money`، `dateAr`، `STATUSES`، `PAY_METHODS`، `byId`، `option`، `flash` (toast)، `guard` (يمسك الأخطاء ويعرضها)، `init(active, {adminOnly})` (يرسم الشريط الجانبي، يفرض تسجيل الدخول خارج الـ Demo، يحوّل غير الأدمن من صفحة الإدارة). ومستمع click عام لـ `data-action` و`tr[data-href]`.
- **نمط كل صفحة:** `var page = await UI.init("key"); if (!page) return;` ← جلب البيانات بـ `DB.list` ← `page.innerHTML = html\`...\`` ← event listeners. الهيكل الثابت (الفورمز) بيتكتب مرة واحدة وبيتحدّث بس الجداول، عشان اللي المستخدم بيكتبه ما يضيعش.

### خريطة الملفات

```
index.html (الرئيسية), work-orders.html, work-order-new.html, work-order.html (?id=),
customers.html, inventory.html, reports.html, settings.html, admin.html, login.html, signup.html
css/style.css
js/  config.js (URL + publishable key), db.js, ui.js
js/pages/  dashboard, work-orders, work-order-new, work-order, customers, inventory,
           reports, settings, admin, login, signup  (.js)
_headers (ترويسات Cloudflare + CSP), favicon.svg
supabase/migrations/20261015000001_init.sql                       ✅ مطبّق (init_workshop_schema)
supabase/migrations/20261015000002_revoke_trigger_function_execute.sql   ✅ مطبّق
supabase/admin_setup.sql                                          تعيين الأدمن (يدوي مرة واحدة)
HANDOFF.md, README.md
```

## 5) نموذج البيانات (مطابق للـ SQL المطبّق ولداتا الـ Demo في `js/db.js`)

`shops`, `profiles`, `shop_members(role: owner|staff|technician)`, `platform_admins`,
`customers`, `vehicles`, `technicians`, `parts`, `work_orders`, `work_order_lines(kind: part|labor)`, `payments`.

- كل جدول للورشة فيه `shop_id uuid not null default public.current_shop_id()` ← **الصفحات لا ترسل shop_id أبداً**.
- **التسجيل:** `signUp(email, password, {data:{shop_name}})` ← trigger `on_auth_user_created` على `auth.users` بينشئ `profiles` + `shops` (حالة `trial` لمدة 7 أيام) + `shop_members(owner)`.
- حالات أمر الشغل: `received → inspecting → awaiting_approval → in_progress → ready → delivered` (+ `cancelled`). الأسماء العربية في `UI.STATUSES`.
- ترقيم أوامر الشغل لكل ورشة يبدأ من 1001 بـ trigger (قفل advisory) — في الـ Demo بيتحسب في `db.js`.
- طرق الدفع: cash, card, instapay, wallet, transfer.
- **ورشة واحدة لكل مستخدم حالياً** (`current_shop_id()` يرجّع أول عضوية).

## 6) قواعد الأمان (ممنوع كسرها)

1. العزل بين الورش بـ **RLS** على كل جدول (`shop_id = current_shop_id()`)، مش بكود الصفحات.
2. الورشة الموقوفة (`status='suspended'`) **قراءة فقط** (`shop_writable()`).
3. الأدمن: `platform_admins` + دوال `is_platform_admin()` و`admin_list_shops()` و`admin_update_shop()`؛ كلها تتأكد من الصلاحية جوه الداتابيز. الأدمن يشوف بيانات الحسابات فقط (ورشة/إيميل/حالة) **مش بيانات شغل العملاء** (قرار افتراضي — اسأل المستخدم لو عايز دخول للدعم).
4. `revoke ... from anon` على الجداول والدوال؛ جدول `platform_admins` من غير policies. دوال الـ triggers (`handle_new_user`, `set_work_order_number`) مسحوب EXECUTE منها من `public/anon/authenticated`.
5. **ممنوع تلزّق نصوص من المستخدم في `innerHTML` بـ `+` أو template عادي.** استخدم دايماً `html\`...\`` أو `UI.esc()`. وماتضيفش inline scripts ولا `onclick=` (الـ CSP هيحجبهم).
6. أي مكتبة خارجية جديدة لازم دومينها يتضاف في `_headers` (`script-src`).
7. **أي تغيير في الداتابيز = ملف migration جديد** في `supabase/migrations/` + `apply_migration` بنفس الاسم، وبعدها `get_advisors` (security + performance). ماتعدّلش ملفات المايجريشن المطبّقة.
8. المفتاح في الفرونت publishable/anon فقط (متحقق: الـ JWT القديم `role: anon`). `service_role` ممنوع.

## 7) قرارات مؤجلة / مشاكل معروفة (TODO)

- **ثغرة محتملة عابرة للورش (من تحليل، مش من تجربة):** قيود الـ Foreign Key بتتفحص من غير RLS، فمستخدم في ورشة B يعرف UUID عميل/سيارة تابعة لورشة A ممكن يعمل صف في ورشته بيشاور عليه (مثلاً سيارة بـ `customer_id` بتاع A). مفيش تسريب بيانات (القراءة لسه معزولة)، لكن ممكن يعمل ربط وهمي ويمنع A من حذف سيارته (`on delete restrict`). الـ UUIDs مش قابلة للتخمين فالخطر منخفض. **الحل:** migration يضيف `unique (shop_id, id)` على `customers/vehicles/parts/technicians/work_orders` ويحوّل الـ FKs لمركّبة `(shop_id, x_id)`. أولوية متوسطة، قبل الإنتاج.
- **خصم المخزون حالياً من الصفحة** (`js/pages/work-order.js`: قراءة ثم تعديل) → فيه سباق (race condition) مع أكتر من مستخدم. الأفضل: trigger في الداتابيز على `work_order_lines` (خصم عند الإضافة، استرجاع عند الحذف، رفض لو الكمية غير كافية)، وبعدها إزالة التعديل من `work-order.js` **في وضع Supabase فقط** (وضع الـ Demo يفضل بالـ JS).
- **مكتبة Supabase بتتحمّل من CDN بـ `@supabase/supabase-js@2` (إصدار عائم، من غير SRI).** قبل الإنتاج: ثبّت إصدار محدد وأضف `integrity` + `crossorigin` (أو انسخ الملف جوه المشروع وشيل jsdelivr من الـ CSP).
- **إعدادات Auth في لوحة Supabase (مش في الكود):** تأكيد الإيميل (صفحة التسجيل بتتعامل مع الحالتين)، تعطيل anonymous sign-ins، تفعيل "leaked password protection" لو متاح في الخطة، مراجعة rate limits، وضبط `Site URL` و`Redirect URLs` على دومين Cloudflare النهائي.
- **trigger التسجيل** (`handle_new_user`) بينشئ ورشة لكل مستخدم جديد. عند إضافة دعوة موظفين لازم يفرّق بين مالك جديد وموظف مدعو.
- **انتهاء التجربة** (`trial_ends_at`) لا يمنع الكتابة حالياً؛ الإيقاف يدوي من الأدمن. قرّر مع المستخدم هل التجربة المنتهية تتحول لقراءة فقط تلقائياً.
- إدارة الموظفين وأدوارهم (owner/staff/technician) والصلاحيات الفعلية في الواجهة: لسه.
- حذف عميل (الواجهة فيها حذف سيارة فقط)، تعديل بيانات (العميل/السيارة/القطعة)، pagination للقوائم الكبيرة.
- تصميم/طباعة الفاتورة (الحالي `window.print()` بسيط)، شعار وبيانات الورشة.
- الاشتراك والدفع (تفعيل الحسابات حالياً يدوي من الأدمن). لاحقاً: إنستاباي/فودافون كاش.
- **مؤجل بقرار:** الأوفلاين مع مزامنة (IndexedDB/Service Worker)، قراءة واتساب (في hsys.io عبر MacroDroid)، تعريف المتصل، الفاتورة الإلكترونية لمصلحة الضرائب (ETA)، متجر QR، شبكة التجار.
- PWA: لسه محتاج `manifest.json` وأيقونات (hsys.io عنده).
- الخطة Free في Supabase: المشروع بيتوقف بعد فترة خمول، ومفيش نسخ احتياطي تلقائي. قبل ما ورش حقيقية تشتغل لازم ترقية الخطة.

## 8) الخطوات الجاية (بالترتيب)

1. **المستخدم يجرّب الوضع الحقيقي:** يشغّل `python3 -m http.server 8000`، يفتح `localhost:8000/signup.html`، يسجّل ورشة بإيميل حقيقي (ولو تأكيد الإيميل شغّال يأكّد من بريده)، ويدخل ويجرّب: عميل ← سيارة ← أمر شغل ← بنود ← دفعة. **لو ظهر أي خطأ يبعتهولك — أول تجربة فعلية لـ `db.js` والـ RLS على داتابيز حقيقية.**
2. **اسأله عن إيميل الأدمن** (الإيميل اللي سجّل بيه)، وبعدها نفّذ `supabase/admin_setup.sql` بإيميله (عن طريق `execute_sql` — ده بيكتب في `platform_admins` بس، مش في `auth.users`)، وتأكد إن `admin.html` بتفتح وبتعرض الورش.
3. **اختبار العزل:** إما حسابين حقيقيين من `signup.html` (كل واحد يتأكد إنه مايشوفش بيانات التاني) أو — بعد إذنه الصريح — كتلة الـ `DO` اللي بتتلغي (راجع قسم 3: اتلغت مرة).
4. جرّب صفحة الأدمن (تفعيل/إيقاف/تمديد) وتأكد إن الورشة الموقوفة بقت قراءة فقط.
5. اضبط إعدادات Auth (قسم 7) وصلّح أي حاجة تظهر في `get_advisors`.
6. نفّذ بنود TODO بالأولوية: ثغرة الـ FK العابرة ← ثبّت مكتبة CDN ← trigger المخزون ← إدارة الموظفين ← تعديل/حذف ← تحسين الفاتورة.
7. سلّم زيب + HANDOFF محدّثين مع كل خطوة.

## 9) أوامر

```bash
python3 -m http.server 8000     # أو: npx serve .   ← وافتح http://localhost:8000
```
- `js/config.js` متعبّي → وضع حقيقي (بيحوّلك لـ `login.html`). لوضع Demo فضّي `SUPABASE_URL` و`SUPABASE_ANON_KEY`.
- Cloudflare Pages: Framework preset **None**، Build command **فاضي**، Output directory **`/`**. مفيش متغيرات بيئة.

## 10) مرجع: تحليل موقع hsys.io

- React SPA بـ Create React App (`asset-manifest.json` بأسماء hash، chunks لكل مجال `ind-*` منها `ind-work_orders`)، source maps منشورة، PWA (`manifest.json` RTL/ar)، SEO قوي (sitemap, llms.txt, صفحات حسب الدولة)، `/api/` للباك إند (التقنية غير ظاهرة).
- قراءة واتساب عبر **MacroDroid** على موبايل المحل (بدون رد تلقائي)، مش WhatsApp Business API.
- صفحة نظام الورشة (`/systems/general/car_workshop`) و الديمو **لا يمكن قراءتهم آلياً** (JS rendering + الديمو محجوب في robots.txt). **ماتفترضش شكلهم**؛ لو المستخدم بعت صور/وصف للشاشات استخدمها.
- ممنوع نسخ تصميمهم أو شاشاتهم حرفياً؛ نبني تصميمنا وأسماءنا.

## 11) ملاحظات بيئة المساعد

- أدوات Supabase اللي اشتغلت على مشروع الورشة: `list_projects`, `list_organizations`, `list_tables`, `execute_sql`, `apply_migration`, `list_migrations`, `get_advisors`, `get_project_url`, `get_publishable_keys`.
- **`execute_sql` اللي بيكتب في `auth.users` رجع `cancelled`** (غالباً محتاج موافقة المستخدم أو اتمنع). ماتحاولش تلف حواليه.
- في الجلسة السابقة `registry.npmjs.org` كان محجوب بـ 403 من الـ proxy. (مبقاش مهم: النسخة الحالية مفيهاش npm.)
- **طريقة التجربة في الـ sandbox:** Chromium + Playwright متثبتين (`NODE_PATH=/home/claude/.npm-global/lib/node_modules`). شغّل سيرفر ثابت محلي بيطبّق ترويسات `_headers` وجرّب الصفحات بمتصفح حقيقي. `cdn.jsdelivr.net` وGoogle Fonts مش متاحين هناك (الـ Demo مش محتاجهم). **مش متأكد إن `supabase.co` متاح من الـ sandbox** — ما اتجرّبش. حط سكريبتات التجربة في الـ scratchpad مش في المشروع. **سكريبت الـ Playwright القديم كان بيفترض Demo — لو `config.js` متعبّي هيحتاج تعديل.**
- لو لقيت أي إشارة لـ `src/` أو `vite` أو `npm run` في أي ملف فهي قديمة (من إصدار React القديم).

## 12) سجل التغييرات

- **v0.4.0** — ربط Supabase: اتطبّق migrationين على مشروع الورشة (11 جدول + RLS + دوال الأدمن + trigger التسجيل + سحب EXECUTE من دوال الـ triggers)، `get_advisors` نضيف من ERROR، `js/config.js` اتعبّى بالـ URL والمفتاح العام (التطبيق بقى بالوضع الحقيقي). ما اتجرّبش: عزل الورش (الاختبار اتلغى) ولا الوضع الحقيقي end-to-end. تصحيح بيانات المشروع (EL-WARSHA مش rollex-system).
- **v0.3.0** — التحويل من React إلى **HTML/JS عادي** بطلب المستخدم (بيتعلّم). نفس الشاشات ونفس الـ SQL. اتجرّبت كلها في متصفح حقيقي (34/34). إصلاح السكرول الأفقي على الموبايل. إضافة `_headers` (CSP). تحديث README وHANDOFF. حُذفت ملفات React/Vite/TS.
- **v0.2.0** — كل الواجهات (React) + وضع Demo + `db.ts` + صفحة الأدمن + صفحة التسجيل + SQL الأساسي. لم يتم التحقق من `npm run build`.
- **v0.1.0** — هيكل Vite/React أولي: دخول، لوحة بسيطة، قائمة أوامر شغل.

---

### نص جاهز تنسخه في بداية أي محادثة جديدة

> أنا بابني نظام ورشة (SaaS) بـ HTML/JS عادي (مش React — أنا بتعلّم) على GitHub + Cloudflare Pages + Supabase. مرفق الزيب وملف HANDOFF.md. اقرأ HANDOFF.md كامل أولاً ثم كمّل من قسم "الخطوات الجاية". موصّل Supabase مربوط بمنظمة EL-WARSHA ومشروع الورشة (id يبدأ بـ blspjp) — اتأكد من `list_projects` الأول، والشغل عليه مصرّح بيه، لكن اسألني قبل أي حاجة مدفوعة أو مدمّرة أو بتكتب في auth.users. رد بالعامية المصرية باختصار، وسلّمني مع كل تحديث زيب جديد + HANDOFF.md محدّث.
