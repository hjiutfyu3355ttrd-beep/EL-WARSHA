// ============================================================
// منطق الفواتير (مشترك بين صفحة القائمة وصفحة الفاتورة).
// كل شيء بيعدّي على DB.* فبيشتغل في وضع Demo وفي Supabase.
// ============================================================
(function () {
  "use strict";

  function num(x) { return Number(x) || 0; }

  // يعيد حساب الإجمالي والمدفوع وحالة الفاتورة من بنودها ومدفوعاتها
  async function recalc(invoiceId) {
    var d = await Promise.all([DB.list("invoices"), DB.list("invoice_lines"), DB.list("payments")]);
    var inv = d[0].filter(function (i) { return i.id === invoiceId; })[0];
    if (!inv) throw new Error("الفاتورة مش موجودة");
    var subtotal = d[1]
      .filter(function (l) { return l.invoice_id === invoiceId; })
      .reduce(function (s, l) { return s + num(l.qty) * num(l.unit_price); }, 0);
    var paid = d[2]
      .filter(function (p) { return p.invoice_id === invoiceId; })
      .reduce(function (s, p) { return s + num(p.amount); }, 0);
    var total = Math.max(0, subtotal - num(inv.discount) + num(inv.tax));

    var status = inv.status;
    if (status !== "cancelled") {
      if (total > 0 && paid >= total) status = "paid";
      else if (paid > 0) status = "partially_paid";
      else if (status === "paid" || status === "partially_paid") status = "issued";
    }
    await DB.update("invoices", invoiceId, { subtotal: subtotal, total: total, paid_amount: paid, status: status });
  }

  // ينشئ فاتورة (مسودة) من أمر شغل: ينسخ البنود والخصم/الضريبة ويربط الدفعات السابقة
  async function createFromWorkOrder(orderId) {
    var d = await Promise.all([DB.list("work_orders"), DB.list("work_order_lines"), DB.list("payments")]);
    var order = d[0].filter(function (o) { return o.id === orderId; })[0];
    if (!order) throw new Error("أمر الشغل مش موجود");
    var lines = d[1].filter(function (l) { return l.work_order_id === orderId; });
    if (lines.length === 0) throw new Error("أمر الشغل ده مفيهوش بنود — أضف بنود الأول");

    var inv = await DB.insert("invoices", {
      customer_id: order.customer_id,
      work_order_id: orderId,
      status: "draft",
      issued_at: new Date().toISOString(),
      discount: num(order.discount),
      tax: num(order.tax),
    });
    for (var i = 0; i < lines.length; i++) {
      await DB.insert("invoice_lines", {
        invoice_id: inv.id,
        kind: lines[i].kind,
        description: lines[i].description,
        qty: lines[i].qty,
        unit_price: lines[i].unit_price,
        sort_order: i,
      });
    }
    // الدفعات اللي اتسجلت على أمر الشغل قبل كده تتحسب على الفاتورة
    var pays = d[2].filter(function (p) { return p.work_order_id === orderId && !p.invoice_id; });
    for (var j = 0; j < pays.length; j++) await DB.update("payments", pays[j].id, { invoice_id: inv.id });

    await recalc(inv.id);
    return inv;
  }

  window.Finance = { recalc: recalc, createFromWorkOrder: createFromWorkOrder };
})();
