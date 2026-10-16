(async function () {
  var page = await UI.init("work-order-new");
  if (!page) return;
  var html = UI.html;

  var customers = [], vehicles = [], techs = [];

  page.innerHTML = html`
    <div class="stack" style="max-width:640px">
      <h2 class="page-title" style="margin:0">أمر شغل جديد</h2>
      <form class="card stack" id="form">
        <div class="field">
          <label>العميل</label>
          <select id="customer"></select>
          <small>مش لاقي العميل؟ <a class="link" href="customers.html">ضيفه من هنا</a></small>
        </div>
        <div class="field">
          <label>السيارة</label>
          <select id="vehicle" disabled></select>
        </div>
        <div class="field">
          <label>الفني المسؤول (اختياري)</label>
          <select id="tech"></select>
        </div>
        <div class="field">
          <label>وصف العطل / الشكوى</label>
          <textarea id="complaint"></textarea>
        </div>
        <div class="row">
          <button id="save">فتح أمر الشغل</button>
          <a class="btn secondary" href="work-orders.html">إلغاء</a>
        </div>
      </form>
    </div>`;

  var elCustomer = document.getElementById("customer");
  var elVehicle = document.getElementById("vehicle");
  var elTech = document.getElementById("tech");

  function renderVehicles() {
    var cid = elCustomer.value;
    var list = vehicles.filter(function (v) { return v.customer_id === cid; });
    elVehicle.disabled = !cid;
    elVehicle.innerHTML = html`<option value="">— اختار —</option>${list.map(function (v) {
      return UI.option(v.id, v.plate + " — " + v.make + " " + v.model);
    })}`;
  }

  await UI.guard(async function () {
    var data = await Promise.all([DB.list("customers"), DB.list("vehicles"), DB.list("technicians")]);
    customers = data[0];
    vehicles = data[1];
    techs = data[2];
    elCustomer.innerHTML = html`<option value="">— اختار —</option>${customers.map(function (c) {
      return UI.option(c.id, c.name + " — " + c.phone);
    })}`;
    elTech.innerHTML = html`<option value="">— بدون —</option>${techs.map(function (t) {
      return UI.option(t.id, t.name);
    })}`;
    renderVehicles();
  });

  elCustomer.addEventListener("change", renderVehicles);

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!elCustomer.value || !elVehicle.value) {
      UI.flash("اختار العميل والسيارة");
      return;
    }
    var btn = document.getElementById("save");
    btn.disabled = true;
    try {
      var row = await DB.insert("work_orders", {
        customer_id: elCustomer.value,
        vehicle_id: elVehicle.value,
        technician_id: elTech.value || null,
        status: "received",
        complaint: document.getElementById("complaint").value.trim(),
      });
      location.href = "work-order.html?id=" + encodeURIComponent(row.id);
    } catch (err) {
      UI.flash(err.message);
      btn.disabled = false;
    }
  });
})();
