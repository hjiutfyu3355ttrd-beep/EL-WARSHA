// ============================================================
// أوامر التأمين — منطق خالص (من غير شبكة).
//   - أمر الشغل ليه جهة دفع: payer_type = "customer" (الافتراضي) أو "insurance".
//   - في التأمين: المطالبة "معلّقة" طول ما insurance_settled_at فاضي، حتى لو السيارة اتسلّمت.
//   - إجمالي الأمر = مجموع بنوده. المستلم = مدفوعاته (payments.work_order_id)، ودفعة شركة التأمين
//     بتتسجّل كدفعة عادية فبتدخل الخزنة (js/treasury.js) وبتنقّص المتبقي لوحدها.
// ============================================================
(function () {
  "use strict";
  function num(v) { return Number(v) || 0; }

  function isInsurance(o) { return !!o && o.payer_type === "insurance"; }
  // معلّقة = تأمين + لسه ما اتسجّلش إنها اتسوّت + الأمر مش ملغي
  function isPending(o) { return isInsurance(o) && !o.insurance_settled_at && o.status !== "cancelled"; }
  function isSettled(o) { return isInsurance(o) && !!o.insurance_settled_at; }
  // السيارة اتسلّمت وفلوس التأمين لسه ما اتستلمتش (دي الحالة اللي العميل عايزها تفضل معلّقة)
  function isDeliveredPending(o) { return isPending(o) && o.status === "delivered"; }

  // إجمالي/مستلم/متبقي لأمر واحد من قوائم البنود والمدفوعات
  function orderTotals(order, lines, payments) {
    var total = 0, paid = 0;
    for (var i = 0; i < lines.length; i++) if (lines[i].work_order_id === order.id) total += num(lines[i].qty) * num(lines[i].unit_price);
    for (var j = 0; j < payments.length; j++) if (payments[j].work_order_id === order.id) paid += num(payments[j].amount);
    return { total: total, paid: paid, remaining: Math.max(0, total - paid) };
  }

  // ملخص لكل أوامر التأمين (للوحة التحكم وصفحة التأمين)
  function summary(orders, lines, payments) {
    var s = { pending: 0, deliveredPending: 0, settled: 0, outstanding: 0 };
    var byOrder = {}, paidBy = {};
    lines.forEach(function (l) { byOrder[l.work_order_id] = (byOrder[l.work_order_id] || 0) + num(l.qty) * num(l.unit_price); });
    payments.forEach(function (p) { paidBy[p.work_order_id] = (paidBy[p.work_order_id] || 0) + num(p.amount); });
    orders.forEach(function (o) {
      if (isSettled(o)) s.settled++;
      if (!isPending(o)) return;
      s.pending++;
      if (o.status === "delivered") s.deliveredPending++;
      s.outstanding += Math.max(0, (byOrder[o.id] || 0) - (paidBy[o.id] || 0));
    });
    return s;
  }

  window.Insurance = {
    isInsurance: isInsurance, isPending: isPending, isSettled: isSettled, isDeliveredPending: isDeliveredPending,
    orderTotals: orderTotals, summary: summary,
  };
})();
