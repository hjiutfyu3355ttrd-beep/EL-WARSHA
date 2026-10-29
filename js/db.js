// ============================================================
// طبقة البيانات: كل التعامل مع قاعدة البيانات بيعدّي من هنا.
//   - لو Supabase متضبط (config.js) → بنكلّم الجداول الحقيقية.
//   - لو لأ → وضع Demo: بيانات تجريبية في localStorage.
// الصفحات بتستخدم DB.list / DB.insert / DB.update / DB.remove بس،
// فنفس كود الصفحات بيشتغل في الوضعين.
// ============================================================
(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var demoMode = !configured;
  var fatal = "";
  var client = null;
  var clientReady = null;

  // تحميل كسول لمكتبة Supabase — في وضع Demo مش هنتنزّل حاجة من CDN
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("script load failed")); };
      document.head.appendChild(s);
    });
  }

  function ensureClient() {
    if (!configured) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    if (clientReady) return clientReady;
    clientReady = (window.supabase && window.supabase.createClient
      ? Promise.resolve()
      : loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js")
    ).then(function () {
      if (!(window.supabase && window.supabase.createClient)) {
        fatal = "تعذّر تحميل مكتبة Supabase. اتأكد من اتصال الإنترنت وأعد تحميل الصفحة.";
        throw new Error(fatal);
      }
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      return client;
    }).catch(function (e) {
      fatal = fatal || (e && e.message) || "تعذّر تحميل مكتبة Supabase.";
      throw e;
    });
    return clientReady;
  }

  // ---------- أدوات صغيرة ----------
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function ago(days) {
    return new Date(Date.now() - days * 86400000).toISOString();
  }

  // ---------- بيانات تجريبية (Demo) ----------
  var SEED = {
    customers: [
      { id: "c1", name: "أحمد محمود", phone: "01012345678", notes: "", created_at: ago(30) },
      { id: "c2", name: "منى السيد", phone: "01198765432", notes: "عميلة دائمة", created_at: ago(12) },
    ],
    vehicles: [
      {
        id: "v1", customer_id: "c1", plate: "ق ن ع 1234", make: "تويوتا", model: "كورولا", year: 2018,
        odometer: 112000, color: "أبيض", fuel: "بنزين", transmission: "أوتوماتيك",
        engine_no: "", chassis_no: "", gearbox_no: "", notes: "", description: "سيارة العميل أحمد — صيانة دورية",
        images: [], created_at: ago(30)
      },
      {
        id: "v2", customer_id: "c2", plate: "س ب أ 5678", make: "هيونداي", model: "إلنترا", year: 2021,
        odometer: 54000, color: "فضي", fuel: "بنزين", transmission: "أوتوماتيك",
        engine_no: "", chassis_no: "", gearbox_no: "", notes: "عميلة دائمة", description: "",
        images: [], created_at: ago(12)
      },
      {
        id: "v3", customer_id: "c1", plate: "64484854", make: "كيا", model: "سبورتاج", year: 2009,
        odometer: 644958, color: "أحمر", fuel: "بنزين", transmission: "مانيوال",
        engine_no: "", chassis_no: "", gearbox_no: "", notes: "", description: "كيا سبورتاج 2009",
        images: [], created_at: ago(5)
      },
    ],
    technicians: [
      { id: "t1", name: "محمد الفني", commission_pct: 10, created_at: ago(60) },
      { id: "t2", name: "كريم الكهربائي", commission_pct: 12, created_at: ago(60) },
    ],
    parts: [
      { id: "p1", name: "زيت محرك 5W30 (4 لتر)", sku: "OIL-5W30", qty: 24, min_qty: 8, cost: 650, price: 850, created_at: ago(40) },
      { id: "p2", name: "فلتر زيت", sku: "FLT-OIL", qty: 3, min_qty: 5, cost: 80, price: 130, created_at: ago(40) },
      { id: "p3", name: "تيل فرامل أمامي", sku: "BRK-F", qty: 10, min_qty: 4, cost: 420, price: 600, created_at: ago(40) },
    ],
    work_orders: [
      { id: "w1", number: 1001, customer_id: "c1", vehicle_id: "v1", technician_id: "t1", status: "in_progress", priority: "high", expected_delivery_at: ago(-1), complaint: "صوت في الفرامل وتغيير زيت", created_at: ago(1) },
      { id: "w2", number: 1002, customer_id: "c2", vehicle_id: "v2", technician_id: "t2", status: "awaiting_approval", priority: "normal", expected_delivery_at: ago(1), complaint: "كشف كهرباء", created_at: ago(3) },
    ],
    work_order_lines: [
      { id: "l1", work_order_id: "w1", kind: "part", description: "تيل فرامل أمامي", qty: 1, unit_price: 600, part_id: "p3", created_at: ago(1) },
      { id: "l2", work_order_id: "w1", kind: "labor", description: "أجرة تغيير تيل", qty: 1, unit_price: 200, part_id: null, created_at: ago(1) },
      { id: "l3", work_order_id: "w2", kind: "labor", description: "كشف كهرباء", qty: 1, unit_price: 250, part_id: null, created_at: ago(3) },
    ],
    payments: [
      { id: "y1", work_order_id: "w1", amount: 300, method: "cash", created_at: new Date().toISOString() },
    ],
    invoices: [],
    invoice_lines: [],
    shops: [
      { id: "s1", name: "ورشة النور", owner_email: "nour@example.com", status: "active", trial_ends_at: null, created_at: ago(40) },
      { id: "s2", name: "ورشة الأمل", owner_email: "amal@example.com", status: "trial", trial_ends_at: ago(-4), created_at: ago(3) },
      { id: "s3", name: "ورشة السلام", owner_email: "salam@example.com", status: "suspended", trial_ends_at: null, created_at: ago(90) },
    ],
    quotations: [
      { id: "q1", number: 2001, customer_id: "c1", vehicle_id: "v1", status: "sent", notes: "تغيير تيل فرامل + زيت", total: 800, created_at: ago(2) },
      { id: "q2", number: 2002, customer_id: "c2", vehicle_id: "v2", status: "draft", notes: "كشف كهرباء", total: 250, created_at: ago(1) },
    ],
    quotation_lines: [
      { id: "ql1", quotation_id: "q1", kind: "part", description: "تيل فرامل أمامي", qty: 1, unit_price: 600, part_id: "p3", created_at: ago(2) },
      { id: "ql2", quotation_id: "q1", kind: "labor", description: "أجرة تغيير تيل", qty: 1, unit_price: 200, part_id: null, created_at: ago(2) },
      { id: "ql3", quotation_id: "q2", kind: "labor", description: "كشف كهرباء", qty: 1, unit_price: 250, part_id: null, created_at: ago(1) },
    ],
    suppliers: [
      { id: "sup1", name: "شركة قطع الغيار المتحدة", phone: "01005556666", company: "United Auto Parts", notes: "مورد أساسي", created_at: ago(50) },
      { id: "sup2", name: "مؤسسة النيل للزيوت", phone: "01223334444", company: "Nile Oils", notes: "", created_at: ago(20) },
    ],
    observation_points: [
      { id: "op1", category: "المحرك", name: "مستوى الزيت", default_charge: 0, created_at: ago(60) },
      { id: "op2", category: "المحرك", name: "سيور المحرك", default_charge: 150, created_at: ago(60) },
      { id: "op3", category: "الفرامل", name: "تيل الفرامل الأمامي", default_charge: 0, created_at: ago(60) },
      { id: "op4", category: "الفرامل", name: "تيل الفرامل الخلفي", default_charge: 0, created_at: ago(60) },
      { id: "op5", category: "الإطارات", name: "ضغط الهواء", default_charge: 0, created_at: ago(60) },
      { id: "op6", category: "الكهرباء", name: "البطارية", default_charge: 50, created_at: ago(60) },
      { id: "op7", category: "الهيكل", name: "أضواء أمامية", default_charge: 0, created_at: ago(60) },
      { id: "op8", category: "الهيكل", name: "أضواء خلفية", default_charge: 0, created_at: ago(60) },
    ],
    expenses: [
      { id: "ex1", label: "إيجار الورشة", amount: 5000, notes: "شهر أكتوبر", created_at: ago(5) },
      { id: "ex2", label: "كهرباء", amount: 1200, notes: "", created_at: ago(3) },
      { id: "ex3", label: "أدوات صيانة", amount: 850, notes: "مفاتيح وعدد", created_at: ago(1) },
    ],
    gate_passes: [
      { id: "gp1", number: 3001, work_order_id: "w1", vehicle_id: "v1", direction: "in", notes: "استلام للصيانة", created_at: ago(1) },
    ],
    part_sales: [
      { id: "ps1", number: 4001, customer_id: "c1", total: 130, status: "paid", notes: "بيع فلتر زيت", created_at: ago(2) },
    ],
    part_sale_lines: [
      { id: "psl1", part_sale_id: "ps1", part_id: "p2", description: "فلتر زيت", qty: 1, unit_price: 130, created_at: ago(2) },
    ],
    income: [
      { id: "in1", label: "دفعة مقدمة عميل", amount: 300, notes: "من أمر #1001", source: "work_order", ref_id: "w1", created_at: new Date().toISOString() },
      { id: "in2", label: "بيع قطع غيار", amount: 130, notes: "فاتورة #4001", source: "part_sale", ref_id: "ps1", created_at: ago(2) },
    ],
    work_order_inspections: [
      { id: "wi1", work_order_id: "w1", observation_point_id: "op3", status: "fail", notes: "تيل مهترئ", charge: 0, created_at: ago(1) },
      { id: "wi2", work_order_id: "w1", observation_point_id: "op1", status: "pass", notes: "مستوى جيد", charge: 0, created_at: ago(1) },
    ],
    vehicle_taxes: [
      { id: "vt1", vehicle_id: "v1", tax_type: "رخصة تسيير", amount: 450, due_date: ago(-30), paid: true, notes: "2026", created_at: ago(40) },
      { id: "vt2", vehicle_id: "v1", tax_type: "تأمين إجباري", amount: 300, due_date: ago(-10), paid: false, notes: "", created_at: ago(5) },
      { id: "vt3", vehicle_id: "v2", tax_type: "رخصة تسيير", amount: 520, due_date: ago(-60), paid: true, notes: "", created_at: ago(20) },
    ],
    custom_fields: [
      { id: "cf1", module: "customer", label: "الرقم الضريبي", field_type: "text", required: false, created_at: ago(30) },
      { id: "cf2", module: "customer", label: "مصدر العميل", field_type: "select", options: "فيسبوك,جوجل,ترشيح,أخرى", required: false, created_at: ago(30) },
      { id: "cf3", module: "vehicle", label: "رقم الشاسيه", field_type: "text", required: false, created_at: ago(30) },
      { id: "cf4", module: "employee", label: "رقم البطاقة", field_type: "text", required: false, created_at: ago(30) },
    ],
    shop_profile: [
      { id: "sp1", name: "ورشة النور", phone: "01000000000", address: "القاهرة", logo_text: "النور", business_hours: "السبت–الخميس 9ص–6م", created_at: ago(40) },
    ],
    purchases: [
      { id: "pu1", number: 5001, supplier_id: "sup1", total: 2600, status: "received", notes: "طلب زيوت وفلاتر", created_at: ago(8) },
    ],
    purchase_lines: [
      { id: "pul1", purchase_id: "pu1", part_id: "p1", description: "زيت محرك 5W30 (4 لتر)", qty: 4, unit_cost: 650, created_at: ago(8) },
    ],
    tax_rates: [
      { id: "tr1", name: "ضريبة قيمة مضافة", rate: 14, is_default: true, created_at: ago(60) },
      { id: "tr2", name: "ضريبة خدمة", rate: 5, is_default: false, created_at: ago(60) },
    ],
    email_templates: [
      { id: "et1", key: "quotation_sent", name: "إرسال عرض سعر", subject: "عرض سعر من {{shop_name}}", body: "عزيزي {{customer_name}}،\nمرفق عرض السعر رقم {{number}}.\nشكراً لتعاملك معنا.", created_at: ago(30) },
      { id: "et2", key: "job_ready", name: "السيارة جاهزة", subject: "سيارتك جاهزة للاستلام", body: "عزيزي {{customer_name}}،\nسيارتك {{plate}} جاهزة للاستلام.\nمع تحيات {{shop_name}}", created_at: ago(30) },
      { id: "et3", key: "invoice", name: "فاتورة", subject: "فاتورة رقم {{number}}", body: "عزيزي {{customer_name}}،\nفاتورتك بمبلغ {{total}} ج.م.\nشكراً.", created_at: ago(30) },
    ],
  };

  // كاش في الذاكرة: يمنع JSON.parse المتكرر من localStorage في كل list/update
  var memCache = Object.create(null);
  var persistTimer = null;
  var dirtyTables = Object.create(null);

  function writeLocal(table, rows) {
    memCache[table] = rows;
    dirtyTables[table] = true;
    // كتابة مجمّعة لـ localStorage (debounce) بدل stringify في كل عملية
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(flushLocal, 40);
  }

  function flushLocal() {
    persistTimer = null;
    Object.keys(dirtyTables).forEach(function (table) {
      try {
        localStorage.setItem("demo:" + table, JSON.stringify(memCache[table] || []));
      } catch (e) {
        /* التخزين المحلي مش متاح أو ممتلئ */
      }
    });
    dirtyTables = Object.create(null);
  }

  function readLocal(table) {
    if (memCache[table]) return memCache[table];
    try {
      var raw = localStorage.getItem("demo:" + table);
      if (raw) {
        memCache[table] = JSON.parse(raw);
        return memCache[table];
      }
    } catch (e) {
      /* هنرجع للداتا التجريبية */
    }
    var seed = JSON.parse(JSON.stringify(SEED[table] || []));
    memCache[table] = seed;
    dirtyTables[table] = true;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(flushLocal, 40);
    return seed;
  }

  function resetDemo() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    memCache = Object.create(null);
    dirtyTables = Object.create(null);
    Object.keys(SEED).forEach(function (t) {
      try {
        localStorage.removeItem("demo:" + t);
      } catch (e) {
        /* ignore */
      }
    });
  }

  // حفظ قبل إغلاق الصفحة عشان مفيش بيانات تضيع بسبب الـ debounce
  try {
    window.addEventListener("pagehide", flushLocal);
    window.addEventListener("beforeunload", flushLocal);
  } catch (e) {}

  // ---------- عمليات الجداول ----------
  async function list(table) {
    if (demoMode) return readLocal(table);
    await ensureClient();
    var res = await client.from(table).select("*").order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function insert(table, row) {
    if (demoMode) {
      var rows = readLocal(table).slice();
      var rec = Object.assign({}, row, { id: uid(), created_at: new Date().toISOString() });
      if (table === "work_orders" || table === "invoices" || table === "purchases" || table === "quotations" || table === "gate_passes" || table === "part_sales") {
        var max = rows.reduce(function (m, r) { return Math.max(m, Number(r.number) || 0); }, 1000);
        rec.number = max + 1;
      }
      rows.unshift(rec);
      writeLocal(table, rows);
      return rec;
    }
    await ensureClient();
    var res = await client.from(table).insert(row).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async function update(table, id, patch) {
    if (demoMode) {
      writeLocal(table, readLocal(table).map(function (r) {
        return r.id === id ? Object.assign({}, r, patch) : r;
      }));
      return;
    }
    await ensureClient();
    var res = await client.from(table).update(patch).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }

  async function remove(table, id) {
    if (demoMode) {
      writeLocal(table, readLocal(table).filter(function (r) { return r.id !== id; }));
      return;
    }
    await ensureClient();
    var res = await client.from(table).delete().eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }

  // ---------- تسجيل الدخول ----------
  // الدخول برقم التليفون: Supabase Auth بيطلب إيميل، فبنحوّل الرقم لإيميل داخلي ثابت
  // (مثلاً 01012345678@phone.workshop-system.app). المستخدم عمره ما بيشوفه.
  // لازم "Confirm email" يكون مقفول في Supabase عشان ده يشتغل.
  var PHONE_DOMAIN = "@phone.workshop-system.app";

  // يوحّد شكل الرقم: أرقام عربية ← إنجليزي، شيل المسافات والرموز، +20 / 0020 ← 0
  function normalizePhone(input) {
    var s = String(input || "").replace(/[٠-٩]/g, function (d) {
      return "٠١٢٣٤٥٦٧٨٩".indexOf(d);
    });
    s = s.replace(/\D/g, "");
    if (s.indexOf("0020") === 0) s = "0" + s.slice(4);
    else if (s.indexOf("20") === 0 && s.length === 12) s = "0" + s.slice(2);
    else if (s.length === 10 && s.charAt(0) === "1") s = "0" + s;
    return s;
  }
  function phoneToEmail(input) {
    var p = normalizePhone(input);
    if (p.length < 8 || p.length > 15) throw new Error("رقم التليفون غير صحيح");
    return p + PHONE_DOMAIN;
  }
  // للعرض فقط (صفحة الأدمن): يرجّع الرقم من الإيميل الداخلي
  function emailToPhone(email) {
    var e = String(email || "");
    return e.indexOf(PHONE_DOMAIN) > 0 ? e.replace(PHONE_DOMAIN, "") : e;
  }

  var auth = {
    phoneToEmail: phoneToEmail,
    emailToPhone: emailToPhone,
    async getSession() {
      if (demoMode) return null;
      await ensureClient();
      var res = await client.auth.getSession();
      return res.data.session;
    },
    async signIn(phone, password) {
      await ensureClient();
      var res = await client.auth.signInWithPassword({ email: phoneToEmail(phone), password: password });
      if (res.error) throw new Error("رقم التليفون أو كلمة المرور غير صحيحة");
    },
    // اسم الورشة بيتبعت في metadata، وtrigger في الداتابيز بينشئ الورشة وعضوية المالك تلقائياً
    async signUp(phone, password, shopName) {
      await ensureClient();
      var res = await client.auth.signUp({
        email: phoneToEmail(phone),
        password: password,
        options: { data: { shop_name: shopName } },
      });
      if (res.error) {
        if (/already|registered/i.test(res.error.message)) throw new Error("الرقم ده مسجّل قبل كده، سجّل دخول");
        throw new Error(res.error.message);
      }
      return res.data.session; // لو null يبقى "Confirm email" لسه مفعّل في Supabase
    },
    async signOut() {
      if (demoMode) return;
      await ensureClient();
      if (client) await client.auth.signOut();
    },
  };

  // ---------- الإدارة (الأدمن) ----------
  // الصلاحية بتتأكد منها قاعدة البيانات نفسها (دوال RPC): الواجهة لوحدها مش حماية.
  async function isAdmin() {
    if (demoMode) return true;
    await ensureClient();
    var res = await client.rpc("is_platform_admin");
    return !res.error && res.data === true;
  }

  async function adminListShops() {
    if (demoMode) return readLocal("shops");
    await ensureClient();
    var res = await client.rpc("admin_list_shops");
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function adminUpdateShop(id, status, trialEndsAt) {
    if (demoMode) {
      return update("shops", id, { status: status, trial_ends_at: trialEndsAt });
    }
    await ensureClient();
    var res = await client.rpc("admin_update_shop", {
      p_id: id,
      p_status: status,
      p_trial_ends_at: trialEndsAt,
    });
    if (res.error) throw new Error(res.error.message);
  }

  window.DB = {
    demoMode: demoMode,
    fatal: fatal,
    list: list,
    insert: insert,
    update: update,
    remove: remove,
    auth: auth,
    isAdmin: isAdmin,
    adminListShops: adminListShops,
    adminUpdateShop: adminUpdateShop,
    resetDemo: resetDemo,
  };
})();
