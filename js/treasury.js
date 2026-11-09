// ============================================================
// الخزنة والمرتبات — منطق خالص (من غير شبكة). بيُستخدم في صفحات الخزنة/المرتبات ولوحة التحكم،
// وفي وضع Demo بدل دوال الداتابيز. الصيغ دي لازم تفضل مطابقة لدوال SQL:
//   public.treasury_totals()  و  public.sync_salary_accruals(date)
//   (supabase/migrations/20261109000001_treasury_payroll.sql)
//
// الخزنة مفيهاش رصيد مخزّن، الرصيد بيتحسب دايمًا من:
//   داخل  = payments + income + treasury_entries(deposit)
//   خارج  = expenses (والمشتريات بتتسجّل فيها) + salary_payments + treasury_entries(withdraw)
//
// المرتبات: لكل عامل مرتب ثابت (أسبوعي/شهري). المستحق بيتولّد تلقائي عن كل فترة (salary_accruals)،
// واللي بيتخصم من الخزنة هو اللي اتصرف فعلاً (salary_payments). الباقي (المستحق - المصروف) بيتراكم
// للفترة اللي بعدها. لو صرفت أكتر من المستحق بيظهر "مدفوع مقدّمًا" (سلفة) وبيتخصم من الفترات الجاية.
// ============================================================
(function () {
  "use strict";

  // ---------- تواريخ (YYYY-MM-DD بالتوقيت المحلي، مش UTC) ----------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseYmd(s) {
    var p = String(s).slice(0, 10).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function today() { return ymd(new Date()); }
  function addDays(s, n) {
    var d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  // زي SQL: 31 يناير + شهر = 28 فبراير (مش 3 مارس)
  function addMonths(s, n) {
    var d = parseYmd(s), day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return ymd(d);
  }

  function num(v) { return Number(v) || 0; }
  function sum(arr, key) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += num(arr[i][key]);
    return t;
  }

  // ---------- المرتبات ----------
  // بدايات الفترات المستحقة للعامل لحد النهارده (أو تاريخ الإيقاف)
  function periodStarts(emp, todayStr) {
    var out = [];
    var bound = emp.end_date && String(emp.end_date).slice(0, 10) < todayStr ? String(emp.end_date).slice(0, 10) : todayStr;
    var start = String(emp.start_date).slice(0, 10);
    if (bound < start) return out;
    for (var n = 0; n <= 1300; n++) {
      var p = emp.salary_period === "month" ? addMonths(start, n) : addDays(start, 7 * n);
      if (p > bound) break;
      out.push(p);
    }
    return out;
  }

  // الفترات الناقصة (للـ Demo؛ في الداتابيز الحقيقية بتتولّد بدالة sync_salary_accruals)
  function missingAccruals(employees, accruals, todayStr) {
    var have = {};
    accruals.forEach(function (a) { have[a.employee_id + "|" + String(a.period_start).slice(0, 10)] = true; });
    var out = [];
    employees.forEach(function (e) {
      periodStarts(e, todayStr).forEach(function (p) {
        if (!have[e.id + "|" + p]) out.push({ employee_id: e.id, period_start: p, amount: num(e.salary_amount) });
      });
    });
    return out;
  }

  // حالة العامل: المستحق/المصروف/المتبقي
  function employeeStatus(emp, accruals, payments, todayStr) {
    var mine = accruals.filter(function (a) { return a.employee_id === emp.id; });
    var paidRows = payments.filter(function (p) { return p.employee_id === emp.id; });
    var accrued = sum(mine, "amount"), paid = sum(paidRows, "amount");
    var remaining = accrued - paid;
    var current = null;
    mine.forEach(function (a) {
      var ps = String(a.period_start).slice(0, 10);
      if (ps <= todayStr && (!current || ps > current)) current = ps;
    });
    return {
      accrued: accrued,
      paid: paid,
      remaining: remaining > 0 ? remaining : 0,   // مستحق لسه على الورشة
      advance: remaining < 0 ? -remaining : 0,    // مدفوع مقدّمًا (سلفة)
      currentPeriodStart: current,
      periods: mine.length,
    };
  }

  // ---------- الخزنة ----------
  function totals(d) {
    var tin = sum(d.payments || [], "amount") + sum(d.income || [], "amount") +
      sum((d.treasury_entries || []).filter(function (e) { return e.kind === "deposit"; }), "amount");
    var tout = sum(d.expenses || [], "amount") + sum(d.salary_payments || [], "amount") +
      sum((d.treasury_entries || []).filter(function (e) { return e.kind === "withdraw"; }), "amount");
    var owed = 0;
    (d.employees || []).forEach(function (e) {
      var st = employeeStatus(e, d.salary_accruals || [], d.salary_payments || [], "9999-12-31");
      owed += st.remaining;
    });
    return { total_in: tin, total_out: tout, balance: tin - tout, salary_owed: owed };
  }

  // وقت الحركة: لو التاريخ اللي اتكتب هو نفس يوم الإنشاء نستخدم وقت الإنشاء الفعلي، غير كده الظهر بتاع اليوم المكتوب
  function whenOf(createdAt, dateStr) {
    var created = new Date(createdAt || Date.now());
    if (!dateStr) return created.getTime();
    var ds = String(dateStr).slice(0, 10);
    if (ds === ymd(created)) return created.getTime();
    var d = parseYmd(ds);
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }

  // كل حركات الخزنة مدموجة ومرتبة (الأقدم أولاً) مع الرصيد الجاري بعد كل حركة
  function movements(d) {
    var t = function (k) { return I18N.t(k); };
    var empName = {};
    (d.employees || []).forEach(function (e) { empName[e.id] = e.name; });
    var out = [];
    (d.payments || []).forEach(function (r) {
      out.push({ key: "payment:" + r.id, table: "payments", id: r.id, dir: "in", source: "payment", amount: num(r.amount),
        label: t("tr_src_payment"), note: window.UI ? UI.methodLabel(r.method) : (r.method || ""), when: whenOf(r.created_at) });
    });
    (d.income || []).forEach(function (r) {
      out.push({ key: "income:" + r.id, table: "income", id: r.id, dir: "in", source: "income", amount: num(r.amount),
        label: r.label || t("tr_src_income"), note: r.notes || "", when: whenOf(r.created_at) });
    });
    (d.expenses || []).forEach(function (r) {
      out.push({ key: "expense:" + r.id, table: "expenses", id: r.id, dir: "out", source: "expense", amount: num(r.amount),
        label: r.label || t("tr_src_expense"), note: r.notes || "", when: whenOf(r.created_at) });
    });
    (d.salary_payments || []).forEach(function (r) {
      out.push({ key: "salary:" + r.id, table: "salary_payments", id: r.id, dir: "out", source: "salary", amount: num(r.amount),
        label: t("tr_src_salary") + " — " + (empName[r.employee_id] || "?"), note: r.note || "", when: whenOf(r.created_at, r.paid_at) });
    });
    (d.treasury_entries || []).forEach(function (r) {
      var dep = r.kind === "deposit";
      out.push({ key: "entry:" + r.id, table: "treasury_entries", id: r.id, dir: dep ? "in" : "out", source: dep ? "deposit" : "withdraw",
        amount: num(r.amount), label: r.note || t(dep ? "tr_src_deposit" : "tr_src_withdraw"), note: r.note ? t(dep ? "tr_src_deposit" : "tr_src_withdraw") : "",
        when: whenOf(r.created_at, r.entry_date) });
    });
    out.sort(function (a, b) { return a.when - b.when || (a.key < b.key ? -1 : 1); });
    var bal = 0;
    out.forEach(function (m) {
      bal += m.dir === "in" ? m.amount : -m.amount;
      m.balance = bal;
    });
    return out;
  }

  window.Treasury = {
    today: today, ymd: ymd, parseYmd: parseYmd, addDays: addDays, addMonths: addMonths,
    periodStarts: periodStarts, missingAccruals: missingAccruals, employeeStatus: employeeStatus,
    totals: totals, movements: movements,
  };
})();
