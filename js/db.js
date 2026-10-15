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

  if (configured) {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } else {
      fatal = "تعذّر تحميل مكتبة Supabase. اتأكد من اتصال الإنترنت وأعد تحميل الصفحة.";
    }
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
      { id: "v1", customer_id: "c1", plate: "ق ن ع 1234", make: "تويوتا", model: "كورولا", year: 2018, odometer: 112000, created_at: ago(30) },
      { id: "v2", customer_id: "c2", plate: "س ب أ 5678", make: "هيونداي", model: "إلنترا", year: 2021, odometer: 54000, created_at: ago(12) },
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
      { id: "w1", number: 1001, customer_id: "c1", vehicle_id: "v1", technician_id: "t1", status: "in_progress", complaint: "صوت في الفرامل وتغيير زيت", created_at: ago(1) },
      { id: "w2", number: 1002, customer_id: "c2", vehicle_id: "v2", technician_id: "t2", status: "ready", complaint: "كشف كهرباء", created_at: ago(3) },
    ],
    work_order_lines: [
      { id: "l1", work_order_id: "w1", kind: "part", description: "تيل فرامل أمامي", qty: 1, unit_price: 600, part_id: "p3", created_at: ago(1) },
      { id: "l2", work_order_id: "w1", kind: "labor", description: "أجرة تغيير تيل", qty: 1, unit_price: 200, part_id: null, created_at: ago(1) },
      { id: "l3", work_order_id: "w2", kind: "labor", description: "كشف كهرباء", qty: 1, unit_price: 250, part_id: null, created_at: ago(3) },
    ],
    payments: [
      { id: "y1", work_order_id: "w1", amount: 300, method: "cash", created_at: new Date().toISOString() },
    ],
    shops: [
      { id: "s1", name: "ورشة النور", owner_email: "nour@example.com", status: "active", trial_ends_at: null, created_at: ago(40) },
      { id: "s2", name: "ورشة الأمل", owner_email: "amal@example.com", status: "trial", trial_ends_at: ago(-4), created_at: ago(3) },
      { id: "s3", name: "ورشة السلام", owner_email: "salam@example.com", status: "suspended", trial_ends_at: null, created_at: ago(90) },
    ],
  };

  function writeLocal(table, rows) {
    try {
      localStorage.setItem("demo:" + table, JSON.stringify(rows));
    } catch (e) {
      /* التخزين المحلي مش متاح */
    }
  }

  function readLocal(table) {
    try {
      var raw = localStorage.getItem("demo:" + table);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* هنرجع للداتا التجريبية */
    }
    var seed = JSON.parse(JSON.stringify(SEED[table] || []));
    writeLocal(table, seed);
    return seed;
  }

  function resetDemo() {
    Object.keys(SEED).forEach(function (t) {
      try {
        localStorage.removeItem("demo:" + t);
      } catch (e) {
        /* ignore */
      }
    });
  }

  // ---------- عمليات الجداول ----------
  async function list(table) {
    if (demoMode) return readLocal(table);
    var res = await client.from(table).select("*").order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function insert(table, row) {
    if (demoMode) {
      var rows = readLocal(table);
      var rec = Object.assign({}, row, { id: uid(), created_at: new Date().toISOString() });
      if (table === "work_orders") {
        var max = rows.reduce(function (m, r) { return Math.max(m, Number(r.number) || 0); }, 1000);
        rec.number = max + 1;
      }
      rows.unshift(rec);
      writeLocal(table, rows);
      return rec;
    }
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
    var res = await client.from(table).update(patch).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }

  async function remove(table, id) {
    if (demoMode) {
      writeLocal(table, readLocal(table).filter(function (r) { return r.id !== id; }));
      return;
    }
    var res = await client.from(table).delete().eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }

  // ---------- تسجيل الدخول ----------
  var auth = {
    async getSession() {
      if (demoMode) return null;
      var res = await client.auth.getSession();
      return res.data.session;
    },
    async signIn(email, password) {
      var res = await client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw new Error("البريد أو كلمة المرور غير صحيحة");
    },
    // اسم الورشة بيتبعت في metadata، وtrigger في الداتابيز بينشئ الورشة وعضوية المالك تلقائياً
    async signUp(email, password, shopName) {
      var res = await client.auth.signUp({
        email: email,
        password: password,
        options: { data: { shop_name: shopName } },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data.session; // null لو لازم تأكيد الإيميل
    },
    async signOut() {
      if (client) await client.auth.signOut();
    },
  };

  // ---------- الإدارة (الأدمن) ----------
  // الصلاحية بتتأكد منها قاعدة البيانات نفسها (دوال RPC): الواجهة لوحدها مش حماية.
  async function isAdmin() {
    if (demoMode) return true;
    var res = await client.rpc("is_platform_admin");
    return !res.error && res.data === true;
  }

  async function adminListShops() {
    if (demoMode) return readLocal("shops");
    var res = await client.rpc("admin_list_shops");
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function adminUpdateShop(id, status, trialEndsAt) {
    if (demoMode) {
      return update("shops", id, { status: status, trial_ends_at: trialEndsAt });
    }
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
