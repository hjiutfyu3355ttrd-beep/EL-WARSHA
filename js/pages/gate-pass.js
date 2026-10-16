(async function () {
  var page = await UI.init("gate-pass");
  if (!page) return;
  var html = UI.html;

  var passes = [], orders = {}, vehicles = {}, customers = {};
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>تصاريح الخروج / الدخول</h2>
          <p>تسجيل دخول وخروج المركبات — تصريح الخروج يتسجل بعد انتهاء الشغل.</p>
        </div>
      </div>
      <form class="card" id="gp-form">
        <h3 style="margin-top:0">تصريح جديد</h3>
        <div class="form-grid">
          <div class="field"><label>الاتجاه</label>
            <select id="gp-dir">
              <option value="in">دخول</option>
              <option value="out">خروج</option>
            </select>
          </div>
          <div class="field"><label>أمر الشغل (اختياري)</label><select id="gp-wo"><option value="">— بدون —</option></select></div>
          <div class="field"><label>السيارة</label><select id="gp-vehicle" required></select></div>
          <div class="field"><label>ملاحظات</label><input id="gp-notes"></div>
          <button>تسجيل</button>
        </div>
      </form>
      <input id="q" placeholder="بحث برقم التصريح أو اللوحة">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function fillSelects() {
    var woOpts = Object.keys(orders).map(function (id) {
      var o = orders[id];
      var v = vehicles[o.vehicle_id];
      return UI.option(id, "#" + o.number + (v ? " — " + v.plate : ""));
    });
    $("gp-wo").innerHTML = '<option value="">— بدون —</option>' + woOpts.join("");
    var vOpts = Object.keys(vehicles).map(function (id) {
      var v = vehicles[id];
      return UI.option(id, v.plate + " — " + v.make + " " + v.model);
    });
    $("gp-vehicle").innerHTML = vOpts.length ? vOpts.join("") : '<option value="">مفيش سيارات</option>';
  }

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = passes.filter(function (p) {
      var v = vehicles[p.vehicle_id];
      var plate = v ? v.plate : "";
      return (("" + p.number) + " " + plate).toLowerCase().indexOf(q) !== -1;
    });
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>رقم</th><th>الاتجاه</th><th>السيارة</th><th>أمر الشغل</th><th>ملاحظات</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="7" class="empty">مفيش تصاريح</td></tr>`
            : shown.map(function (p) {
                var v = vehicles[p.vehicle_id];
                var o = p.work_order_id ? orders[p.work_order_id] : null;
                return html`<tr>
                  <td><b>#${p.number}</b></td>
                  <td><span class="badge ${p.direction === "out" ? "ready" : "received"}">${p.direction === "out" ? "خروج" : "دخول"}</span></td>
                  <td>${v ? v.plate : "—"}</td>
                  <td>${o ? "#" + o.number : "—"}</td>
                  <td>${p.notes || "—"}</td>
                  <td>${UI.dateAr(p.created_at)}</td>
                  <td><button class="danger small" data-action="del" data-id="${p.id}">حذف</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    var data = await Promise.all([
      DB.list("gate_passes"),
      DB.list("work_orders"),
      DB.list("vehicles"),
      DB.list("customers"),
    ]);
    passes = data[0];
    orders = UI.byId(data[1]);
    vehicles = UI.byId(data[2]);
    customers = UI.byId(data[3]);
    fillSelects();
    render();
  }

  $("gp-wo").addEventListener("change", function () {
    var oid = $("gp-wo").value;
    if (oid && orders[oid]) $("gp-vehicle").value = orders[oid].vehicle_id || "";
  });

  $("q").addEventListener("input", render);
  $("gp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var dir = $("gp-dir").value;
      var woId = $("gp-wo").value || null;
      // تصريح خروج: يفضّل أمر شغل جاهز أو مسلّم
      if (dir === "out" && woId) {
        var o = orders[woId];
        if (o && o.status !== "ready" && o.status !== "delivered") {
          if (!confirm("أمر الشغل لسه مش جاهز للتسليم. تسجّل تصريح خروج؟")) return;
        }
      }
      await DB.insert("gate_passes", {
        work_order_id: woId,
        vehicle_id: $("gp-vehicle").value,
        direction: dir,
        notes: $("gp-notes").value.trim(),
      });
      $("gp-notes").value = "";
      await load();
      UI.flash("تم تسجيل التصريح", "success");
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm("حذف التصريح؟")) return;
    UI.guard(async function () {
      await DB.remove("gate_passes", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
