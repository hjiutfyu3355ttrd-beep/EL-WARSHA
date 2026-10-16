(async function () {
  var page = await UI.init("vehicles");
  if (!page) return;
  var html = UI.html;

  var customers = [], vehicles = [], workOrders = [], invoices = [];
  var sel = "";
  var tab = "basic"; // basic | desc | history | parts | invoices | notes
  var imgIdx = 0;

  page.innerHTML = html`
    <div class="stack" id="veh-root">
      <div class="row between wrap gap">
        <h2 class="page-title" style="margin:0">السيارات</h2>
        <div class="row gap">
          <button type="button" data-action="new-vehicle" class="primary">+ استقبال سيارة</button>
          <button type="button" data-action="refresh" class="ghost">تحديث</button>
        </div>
      </div>
      <div class="row gap wrap">
        <input id="q" placeholder="بحث باللوحة أو الماركة أو الموديل أو العميل..." style="flex:1;min-width:200px">
      </div>
      <div id="list" class="veh-grid"></div>
      <div id="detail"></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function custName(id) {
    var c = customers.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "—";
  }

  function vehicleTitle(v) {
    return ((v.make || "") + " " + (v.model || "")).trim() || "مركبة";
  }

  function imagesOf(v) {
    if (!v) return [];
    if (Array.isArray(v.images) && v.images.length) return v.images;
    if (v.image) return [v.image];
    return [];
  }

  function placeholderSvg() {
    return "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">' +
      '<rect fill="#f3f4f6" width="640" height="400"/>' +
      '<g fill="none" stroke="#d1d5db" stroke-width="8" stroke-linecap="round">' +
      '<path d="M120 260h400M160 260c20-80 60-120 160-120s140 40 160 120"/>' +
      '<circle cx="200" cy="280" r="36"/><circle cx="440" cy="280" r="36"/>' +
      '</g></svg>'
    );
  }

  function renderList() {
    var q = ($("q") && $("q").value || "").trim().toLowerCase();
    var shown = vehicles.filter(function (v) {
      var hay = [v.plate, v.make, v.model, v.year, v.color, custName(v.customer_id)].join(" ").toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    $("list").innerHTML = shown.length === 0
      ? html`<div class="empty card">مفيش سيارات مطابقة</div>`
      : shown.map(function (v) {
          var imgs = imagesOf(v);
          var thumb = imgs[0] || placeholderSvg();
          var title = vehicleTitle(v);
          return html`
            <button type="button" class="veh-card ${v.id === sel ? "on" : ""}" data-action="select" data-id="${v.id}">
              <div class="veh-card-img"><img src="${thumb}" alt=""></div>
              <div class="veh-card-body">
                <b>${title} ${v.year || ""}</b>
                <span class="muted">${v.plate || "—"}</span>
                <span class="muted">${custName(v.customer_id)}</span>
              </div>
            </button>`;
        }).join("");
  }

  function renderDetail() {
    var box = $("detail");
    var v = vehicles.filter(function (x) { return x.id === sel; })[0];
    if (!v) {
      box.innerHTML = "";
      return;
    }
    var imgs = imagesOf(v);
    if (imgIdx >= imgs.length) imgIdx = Math.max(0, imgs.length - 1);
    var mainImg = imgs[imgIdx] || placeholderSvg();
    var title = vehicleTitle(v);
    var year = v.year || "—";
    var odo = v.odometer != null ? Number(v.odometer).toLocaleString("ar-EG") : "—";
    var cust = custName(v.customer_id);

    var relatedWO = workOrders.filter(function (w) { return w.vehicle_id === v.id; });
    var relatedInv = invoices.filter(function (i) { return i.vehicle_id === v.id; });

    var tabBody = "";
    if (tab === "basic") {
      tabBody = html`
        <div class="veh-detail-grid">
          <div class="veh-photo-panel card">
            <div class="veh-photo-main">
              <img id="veh-main-img" src="${mainImg}" alt="${title}">
            </div>
            <div class="veh-photo-actions">
              <label class="btn small primary" style="cursor:pointer;margin:0">
                صورة
                <input type="file" accept="image/*" id="veh-file" hidden data-action-file="add-image">
              </label>
              <button type="button" class="ghost small" data-action="change-image" ${imgs.length ? "" : "disabled"}>إضافة / تغيير</button>
              <button type="button" class="danger small" data-action="del-image" ${imgs.length ? "" : "disabled"}>حذف</button>
            </div>
            <div class="veh-thumbs">
              ${imgs.map(function (src, i) {
                return html`<button type="button" class="veh-thumb ${i === imgIdx ? "on" : ""}" data-action="thumb" data-i="${i}">
                  <img src="${src}" alt="">
                  <span>صورة ${i + 1}</span>
                </button>`;
              }).join("") || html`<span class="muted" style="padding:8px">لا توجد صور — اضغط «صورة» للإضافة</span>`}
            </div>
          </div>
          <div class="card veh-info-panel">
            <h3 style="margin-top:0">مزيد من المعلومات</h3>
            <div class="veh-info-grid">
              <div><span class="lbl">اسم الموديل</span><span class="val accent">${v.model || "غير مضاف"}</span></div>
              <div><span class="lbl">العلامة التجارية</span><span class="val accent">${v.make || "غير مضاف"}</span></div>
              <div><span class="lbl">صندوق التروس</span><span class="val accent">${v.transmission || "غير مضاف"}</span></div>
              <div><span class="lbl">سنة الموديل</span><span class="val accent">${year}</span></div>
              <div><span class="lbl">رقم القير</span><span class="val accent">${v.gearbox_no || "غير مضاف"}</span></div>
              <div><span class="lbl">رقم المحرك</span><span class="val accent">${v.engine_no || "غير مضاف"}</span></div>
              <div><span class="lbl">رقم الشاسيه</span><span class="val accent">${v.chassis_no || "غير مضاف"}</span></div>
              <div><span class="lbl">رقم اللوحة</span><span class="val accent">${v.plate || "—"}</span></div>
              <div><span class="lbl">نوع الوقود</span><span class="val accent">${v.fuel || "غير مضاف"}</span></div>
              <div><span class="lbl">اللون</span><span class="val accent">${v.color || "غير مضاف"}</span></div>
              <div><span class="lbl">إجمالي الكيلومترات</span><span class="val accent">${odo}</span></div>
              <div><span class="lbl">العميل</span><span class="val accent">${cust}</span></div>
            </div>
            <div class="row gap" style="margin-top:16px">
              <button type="button" class="primary small" data-action="edit-vehicle">تعديل البيانات</button>
            </div>
          </div>
        </div>`;
    } else if (tab === "desc") {
      tabBody = html`<div class="card"><p style="white-space:pre-wrap;margin:0">${v.description || v.notes || "لا يوجد وصف."}</p></div>`;
    } else if (tab === "history") {
      tabBody = html`
        <div class="card table-wrap">
          <table>
            <thead><tr><th>رقم الأمر</th><th>الحالة</th><th>الشكوى</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${relatedWO.length === 0
                ? html`<tr><td colspan="4" class="empty">لا يوجد سجل صيانة</td></tr>`
                : relatedWO.map(function (w) {
                    return html`<tr>
                      <td><a href="work-order.html?id=${w.id}">#${w.number || w.id}</a></td>
                      <td>${UI.statusLabel ? UI.statusLabel(w.status) : (w.status || "—")}</td>
                      <td>${w.complaint || "—"}</td>
                      <td dir="ltr">${(w.created_at || "").slice(0, 10)}</td>
                    </tr>`;
                  }).join("")}
            </tbody>
          </table>
        </div>`;
    } else if (tab === "parts") {
      tabBody = html`<div class="card empty">قطع الغيار المرتبطة تظهر داخل أوامر الشغل.</div>`;
    } else if (tab === "invoices") {
      tabBody = html`
        <div class="card table-wrap">
          <table>
            <thead><tr><th>رقم</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
            <tbody>
              ${relatedInv.length === 0
                ? html`<tr><td colspan="3" class="empty">لا توجد فواتير</td></tr>`
                : relatedInv.map(function (i) {
                    return html`<tr>
                      <td>${i.number || i.id}</td>
                      <td>${i.total != null ? Number(i.total).toLocaleString("ar-EG") : "—"}</td>
                      <td dir="ltr">${(i.created_at || "").slice(0, 10)}</td>
                    </tr>`;
                  }).join("")}
            </tbody>
          </table>
        </div>`;
    } else if (tab === "notes") {
      tabBody = html`<div class="card"><p style="white-space:pre-wrap;margin:0">${v.notes || "لا توجد ملاحظات."}</p></div>`;
    }

    box.innerHTML = html`
      <div class="veh-detail card-flush">
        <div class="veh-toolbar">
          <button type="button" class="icon-btn danger" data-action="close-detail" title="إغلاق">✕</button>
          <button type="button" class="icon-btn" data-action="del-vehicle" title="حذف">🗑</button>
          <button type="button" class="icon-btn" data-action="edit-vehicle" title="تعديل">⚙</button>
          <button type="button" class="icon-btn primary" data-action="new-vehicle" title="إضافة">+</button>
        </div>
        <div class="veh-hero">
          <div class="veh-hero-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="veh-hero-center">
            <div class="veh-hero-title">
              <button type="button" class="icon-btn small primary" data-action="edit-vehicle" title="تعديل">✎</button>
              <h2>${title} ${year !== "—" ? year : ""}</h2>
            </div>
            <div class="veh-hero-meta">
              <span class="pill">📅 ${year}</span>
              <span class="pill">🚗 سيارة</span>
              <span class="pill">👤 ${cust}</span>
              <span class="pill">🛣 km ${odo}</span>
            </div>
          </div>
          <div class="veh-hero-photo">
            <img src="${imgs[0] || placeholderSvg()}" alt="">
          </div>
        </div>
        <div class="tabs-bar veh-tabs">
          <button type="button" class="${tab === "basic" ? "on" : ""}" data-action="tab" data-tab="basic">التفاصيل الأساسية</button>
          <button type="button" class="${tab === "desc" ? "on" : ""}" data-action="tab" data-tab="desc">الوصف</button>
          <button type="button" class="${tab === "history" ? "on" : ""}" data-action="tab" data-tab="history">سجل الصيانة</button>
          <button type="button" class="${tab === "parts" ? "on" : ""}" data-action="tab" data-tab="parts">قطع الغيار</button>
          <button type="button" class="${tab === "invoices" ? "on" : ""}" data-action="tab" data-tab="invoices">الفواتير</button>
          <button type="button" class="${tab === "notes" ? "on" : ""}" data-action="tab" data-tab="notes">الملاحظات</button>
        </div>
        <div class="veh-tab-body">${tabBody}</div>
      </div>`;
  }

  function openEditor(v) {
    var isNew = !v;
    var data = v || {
      plate: "", make: "", model: "", year: "", odometer: "", color: "", fuel: "",
      transmission: "", engine_no: "", chassis_no: "", gearbox_no: "", notes: "", description: "",
      customer_id: customers[0] ? customers[0].id : "", images: []
    };
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = html`
      <div class="modal card" style="max-width:640px;width:95%">
        <h3 style="margin-top:0">${isNew ? "إضافة سيارة" : "تعديل السيارة"}</h3>
        <form id="veh-edit-form" class="stack">
          <div class="form-grid">
            <div class="field"><label>العميل</label>
              <select id="e-cust" required>
                ${customers.map(function (c) {
                  return html`<option value="${c.id}" ${c.id === data.customer_id ? "selected" : ""}>${c.name}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="field"><label>رقم اللوحة</label><input id="e-plate" value="${data.plate || ""}" required></div>
            <div class="field"><label>العلامة التجارية</label><input id="e-make" value="${data.make || ""}"></div>
            <div class="field"><label>الموديل</label><input id="e-model" value="${data.model || ""}"></div>
            <div class="field"><label>سنة الموديل</label><input id="e-year" type="number" value="${data.year || ""}"></div>
            <div class="field"><label>العداد (كم)</label><input id="e-odo" type="number" value="${data.odometer != null ? data.odometer : ""}"></div>
            <div class="field"><label>اللون</label><input id="e-color" value="${data.color || ""}"></div>
            <div class="field"><label>نوع الوقود</label>
              <select id="e-fuel">
                ${["", "بنزين", "ديزل", "هيبريد", "كهرباء", "غاز"].map(function (f) {
                  return html`<option value="${f}" ${f === (data.fuel || "") ? "selected" : ""}>${f || "—"}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="field"><label>صندوق التروس</label>
              <select id="e-trans">
                ${["", "أوتوماتيك", "مانيوال", "CVT"].map(function (f) {
                  return html`<option value="${f}" ${f === (data.transmission || "") ? "selected" : ""}>${f || "—"}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="field"><label>رقم المحرك</label><input id="e-engine" value="${data.engine_no || ""}"></div>
            <div class="field"><label>رقم الشاسيه</label><input id="e-chassis" value="${data.chassis_no || ""}"></div>
            <div class="field"><label>رقم القير</label><input id="e-gear" value="${data.gearbox_no || ""}"></div>
          </div>
          <div class="field"><label>الوصف</label><textarea id="e-desc" rows="2">${data.description || ""}</textarea></div>
          <div class="field"><label>ملاحظات</label><textarea id="e-notes" rows="2">${data.notes || ""}</textarea></div>
          <div class="row gap" style="justify-content:flex-end">
            <button type="button" class="ghost" data-action="close-modal">إلغاء</button>
            <button type="submit" class="primary">${isNew ? "إضافة" : "حفظ"}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.getAttribute("data-action") === "close-modal") {
        overlay.remove();
      }
    });
    overlay.querySelector("#veh-edit-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var payload = {
        customer_id: $("e-cust").value,
        plate: $("e-plate").value.trim(),
        make: $("e-make").value.trim(),
        model: $("e-model").value.trim(),
        year: $("e-year").value ? Number($("e-year").value) : null,
        odometer: $("e-odo").value !== "" ? Number($("e-odo").value) : null,
        color: $("e-color").value.trim(),
        fuel: $("e-fuel").value,
        transmission: $("e-trans").value,
        engine_no: $("e-engine").value.trim(),
        chassis_no: $("e-chassis").value.trim(),
        gearbox_no: $("e-gear").value.trim(),
        description: $("e-desc").value.trim(),
        notes: $("e-notes").value.trim(),
      };
      try {
        if (isNew) {
          payload.images = [];
          var created = await DB.insert("vehicles", payload);
          sel = created.id || created;
          UI.toast("تم إضافة السيارة");
        } else {
          await DB.update("vehicles", v.id, payload);
          UI.toast("تم حفظ التعديلات");
        }
        overlay.remove();
        await load();
      } catch (err) {
        UI.toast(err.message || "خطأ في الحفظ", true);
      }
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addImageFromFile(file) {
    if (!file || !sel) return;
    if (file.size > 2.5 * 1024 * 1024) {
      UI.toast("حجم الصورة كبير — اختَر صورة أقل من 2.5 ميجا", true);
      return;
    }
    var v = vehicles.filter(function (x) { return x.id === sel; })[0];
    if (!v) return;
    try {
      var dataUrl = await readFileAsDataURL(file);
      var imgs = imagesOf(v).slice();
      imgs.push(dataUrl);
      await DB.update("vehicles", v.id, { images: imgs, image: imgs[0] });
      imgIdx = imgs.length - 1;
      UI.toast("تم إضافة الصورة");
      await load();
    } catch (err) {
      UI.toast(err.message || "تعذّر قراءة الصورة", true);
    }
  }

  async function load() {
    var d = await Promise.all([
      DB.list("customers"),
      DB.list("vehicles"),
      DB.list("work_orders"),
      DB.list("invoices"),
    ]);
    customers = d[0];
    vehicles = d[1];
    workOrders = d[2];
    invoices = d[3] || [];
    renderList();
    renderDetail();
  }

  // أحداث
  page.addEventListener("click", async function (e) {
    var t = e.target.closest("[data-action]");
    if (!t) return;
    var action = t.getAttribute("data-action");
    var id = t.getAttribute("data-id");

    if (action === "select") {
      sel = id;
      tab = "basic";
      imgIdx = 0;
      renderList();
      renderDetail();
      $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (action === "close-detail") {
      sel = "";
      renderList();
      renderDetail();
    } else if (action === "tab") {
      tab = t.getAttribute("data-tab");
      renderDetail();
    } else if (action === "thumb") {
      imgIdx = Number(t.getAttribute("data-i")) || 0;
      renderDetail();
    } else if (action === "new-vehicle") {
      openEditor(null);
    } else if (action === "edit-vehicle") {
      var v = vehicles.filter(function (x) { return x.id === sel; })[0];
      if (v) openEditor(v);
    } else if (action === "del-vehicle") {
      if (!sel || !confirm("حذف هذه السيارة؟")) return;
      try {
        await DB.remove("vehicles", sel);
        sel = "";
        UI.toast("تم الحذف");
        await load();
      } catch (err) {
        UI.toast(err.message || "خطأ", true);
      }
    } else if (action === "del-image") {
      var vv = vehicles.filter(function (x) { return x.id === sel; })[0];
      if (!vv) return;
      var imgs = imagesOf(vv).slice();
      if (!imgs.length) return;
      if (!confirm("حذف الصورة الحالية؟")) return;
      imgs.splice(imgIdx, 1);
      await DB.update("vehicles", vv.id, { images: imgs, image: imgs[0] || null });
      imgIdx = Math.max(0, imgIdx - 1);
      UI.toast("تم حذف الصورة");
      await load();
    } else if (action === "change-image") {
      var input = document.getElementById("veh-file");
      if (input) input.click();
    } else if (action === "refresh") {
      await load();
    }
  });

  page.addEventListener("change", async function (e) {
    if (e.target.id === "veh-file" && e.target.files && e.target.files[0]) {
      await addImageFromFile(e.target.files[0]);
      e.target.value = "";
    }
    if (e.target.id === "q") renderList();
  });

  page.addEventListener("input", function (e) {
    if (e.target.id === "q") renderList();
  });

  // دعم data-action-file على الـ label
  page.addEventListener("change", async function (e) {
    var t = e.target;
    if (t && t.getAttribute("data-action-file") === "add-image" && t.files && t.files[0]) {
      await addImageFromFile(t.files[0]);
      t.value = "";
    }
  });

  await load();
})();
