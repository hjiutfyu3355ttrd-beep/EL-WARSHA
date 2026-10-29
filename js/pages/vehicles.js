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
        <h2 class="page-title" style="margin:0">${I18N.t("vehicles_title")}</h2>
        <div class="row gap">
          <button type="button" data-action="new-vehicle" class="primary">+ ${I18N.t("add_vehicle")}</button>
          <button type="button" data-action="refresh" class="ghost">${I18N.t("refresh")}</button>
        </div>
      </div>
      <div class="row gap wrap">
        <input id="q" placeholder="${I18N.t("search_vehicle")}" style="flex:1;min-width:200px">
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
    return ((v.make || "") + " " + (v.model || "")).trim() || I18N.t("vehicle_noun");
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
      ? html`<div class="empty card">${I18N.t("empty_vehicles")} مطابقة</div>`
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
                ${I18N.t("photo")}
                <input type="file" accept="image/*" id="veh-file" hidden data-action-file="add-image">
              </label>
              <button type="button" class="ghost small" data-action="change-image" ${imgs.length ? "" : "disabled"}>${I18N.t("add_change")}</button>
              <button type="button" class="danger small" data-action="del-image" ${imgs.length ? "" : "disabled"}>${I18N.t("delete")}</button>
            </div>
            <div class="veh-thumbs">
              ${imgs.length ? imgs.map(function (src, i) {
                return html`<button type="button" class="veh-thumb ${i === imgIdx ? "on" : ""}" data-action="thumb" data-i="${i}">
                  <img src="${src}" alt="">
                  <span>${I18N.t("photo_n")} ${i + 1}</span>
                </button>`;
              }) : html`<span class="muted" style="padding:8px">${I18N.t("no_images")}</span>`}
            </div>
          </div>
          <div class="card veh-info-panel">
            <h3 style="margin-top:0">${I18N.t("more_info")}</h3>
            <div class="veh-info-grid">
              <div><span class="lbl">${I18N.t("model_name")}</span><span class="val accent">${v.model || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("brand")}</span><span class="val accent">${v.make || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("transmission")}</span><span class="val accent">${v.transmission || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("model_year")}</span><span class="val accent">${year}</span></div>
              <div><span class="lbl">${I18N.t("gearbox_no")}</span><span class="val accent">${v.gearbox_no || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("engine_no")}</span><span class="val accent">${v.engine_no || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("chassis")}</span><span class="val accent">${v.chassis_no || I18N.t("not_set")}</span></div>
              <div><span class="lbl">رقم ${I18N.t("plate")}</span><span class="val accent">${v.plate || "—"}</span></div>
              <div><span class="lbl">${I18N.t("fuel_type")}</span><span class="val accent">${v.fuel || I18N.t("not_set")}</span></div>
              <div><span class="lbl">اللون</span><span class="val accent">${v.color || I18N.t("not_set")}</span></div>
              <div><span class="lbl">${I18N.t("total_km")}</span><span class="val accent">${odo}</span></div>
              <div><span class="lbl">${I18N.t("customer")}</span><span class="val accent">${cust}</span></div>
            </div>
            <div class="row gap" style="margin-top:16px">
              <button type="button" class="primary small" data-action="edit-vehicle">${I18N.t("edit_data")}</button>
            </div>
          </div>
        </div>`;
    } else if (tab === "desc") {
      tabBody = html`<div class="card"><p style="white-space:pre-wrap;margin:0">${v.description || v.notes || I18N.t("no_description")}</p></div>`;
    } else if (tab === "history") {
      tabBody = html`
        <div class="card table-wrap">
          <table>
            <thead><tr><th>${I18N.t("wo_number")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("complaint")}</th><th>${I18N.t("date")}</th></tr></thead>
            <tbody>
              ${relatedWO.length === 0
                ? html`<tr><td colspan="4" class="empty">${I18N.t("no_service_history")}</td></tr>`
                : relatedWO.map(function (w) {
                    return html`<tr>
                      <td><a href="work-order.html?id=${w.id}">#${w.number || w.id}</a></td>
                      <td>${UI.statusLabel ? UI.statusLabel(w.status) : (w.status || "—")}</td>
                      <td>${w.complaint || "—"}</td>
                      <td dir="ltr">${(w.created_at || "").slice(0, 10)}</td>
                    </tr>`;
                  })}
            </tbody>
          </table>
        </div>`;
    } else if (tab === "parts") {
      tabBody = html`<div class="card empty">${I18N.t("parts_in_wo")}</div>`;
    } else if (tab === "invoices") {
      tabBody = html`
        <div class="card table-wrap">
          <table>
            <thead><tr><th>${I18N.t("quote_number")}</th><th>${I18N.t("amount")}</th><th>${I18N.t("date")}</th></tr></thead>
            <tbody>
              ${relatedInv.length === 0
                ? html`<tr><td colspan="3" class="empty">${I18N.t("no_invoices")}</td></tr>`
                : relatedInv.map(function (i) {
                    return html`<tr>
                      <td>${i.number || i.id}</td>
                      <td>${i.total != null ? Number(i.total).toLocaleString("ar-EG") : "—"}</td>
                      <td dir="ltr">${(i.created_at || "").slice(0, 10)}</td>
                    </tr>`;
                  })}
            </tbody>
          </table>
        </div>`;
    } else if (tab === "notes") {
      tabBody = html`<div class="card"><p style="white-space:pre-wrap;margin:0">${v.notes || I18N.t("no_notes")}</p></div>`;
    }

    box.innerHTML = html`
      <div class="veh-detail card-flush">
        <div class="veh-toolbar">
          <button type="button" class="icon-btn danger" data-action="close-detail" title="${I18N.t("close")}">✕</button>
          <button type="button" class="icon-btn" data-action="del-vehicle" title="${I18N.t("delete")}">🗑</button>
          <button type="button" class="icon-btn" data-action="edit-vehicle" title="${I18N.t("edit")}">⚙</button>
          <button type="button" class="icon-btn primary" data-action="new-vehicle" title="${I18N.t("add")}">+</button>
        </div>
        <div class="veh-hero">
          <div class="veh-hero-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="veh-hero-center">
            <div class="veh-hero-title">
              <button type="button" class="icon-btn small primary" data-action="edit-vehicle" title="${I18N.t("edit")}">✎</button>
              <h2>${title} ${year !== "—" ? year : ""}</h2>
            </div>
            <div class="veh-hero-meta">
              <span class="pill">📅 ${year}</span>
              <span class="pill">🚗 ${I18N.t("car_pill")}</span>
              <span class="pill">👤 ${cust}</span>
              <span class="pill">🛣 km ${odo}</span>
            </div>
          </div>
          <div class="veh-hero-photo">
            <img src="${imgs[0] || placeholderSvg()}" alt="">
          </div>
        </div>
        <div class="tabs-bar veh-tabs">
          <button type="button" class="${tab === "basic" ? "on" : ""}" data-action="tab" data-tab="basic">${I18N.t("basic_details")}</button>
          <button type="button" class="${tab === "desc" ? "on" : ""}" data-action="tab" data-tab="desc">${I18N.t("tab_desc")}</button>
          <button type="button" class="${tab === "history" ? "on" : ""}" data-action="tab" data-tab="history">${I18N.t("maint_log")}</button>
          <button type="button" class="${tab === "parts" ? "on" : ""}" data-action="tab" data-tab="parts">${I18N.t("spare_parts")}</button>
          <button type="button" class="${tab === "invoices" ? "on" : ""}" data-action="tab" data-tab="invoices">${I18N.t("tab_invoices")}</button>
          <button type="button" class="${tab === "notes" ? "on" : ""}" data-action="tab" data-tab="notes">${I18N.t("the_notes")}</button>
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
        <h3 style="margin-top:0">${isNew ? I18N.t("add_vehicle") : I18N.t("edit_vehicle")}</h3>
        <form id="veh-edit-form" class="stack">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("customer")}</label>
              <select id="e-cust" required>
                ${customers.map(function (c) {
                  return html`<option value="${c.id}" ${c.id === data.customer_id ? "selected" : ""}>${c.name}</option>`;
                })}
              </select>
            </div>
            <div class="field"><label>رقم ${I18N.t("plate")}</label><input id="e-plate" value="${data.plate || ""}" required></div>
            <div class="field"><label>${I18N.t("brand")}</label><input id="e-make" value="${data.make || ""}"></div>
            <div class="field"><label>${I18N.t("model")}</label><input id="e-model" value="${data.model || ""}"></div>
            <div class="field"><label>${I18N.t("model_year")}</label><input id="e-year" type="number" value="${data.year || ""}"></div>
            <div class="field"><label>${I18N.t("odometer_km")}</label><input id="e-odo" type="number" value="${data.odometer != null ? data.odometer : ""}"></div>
            <div class="field"><label>${I18N.t("color")}</label><input id="e-color" value="${data.color || ""}"></div>
            <div class="field"><label>${I18N.t("fuel_type")}</label>
              <select id="e-fuel">
                ${["", I18N.t("fuel_gas"), I18N.t("fuel_diesel"), I18N.t("fuel_hybrid"), I18N.t("fuel_electric"), I18N.t("fuel_lpg")].map(function (f) {
                  return html`<option value="${f}" ${f === (data.fuel || "") ? "selected" : ""}>${f || "—"}</option>`;
                })}
              </select>
            </div>
            <div class="field"><label>${I18N.t("transmission")}</label>
              <select id="e-trans">
                ${["", I18N.t("trans_auto"), I18N.t("trans_manual"), I18N.t("trans_cvt")].map(function (f) {
                  return html`<option value="${f}" ${f === (data.transmission || "") ? "selected" : ""}>${f || "—"}</option>`;
                })}
              </select>
            </div>
            <div class="field"><label>${I18N.t("engine_no")}</label><input id="e-engine" value="${data.engine_no || ""}"></div>
            <div class="field"><label>${I18N.t("chassis")}</label><input id="e-chassis" value="${data.chassis_no || ""}"></div>
            <div class="field"><label>${I18N.t("gearbox_no")}</label><input id="e-gear" value="${data.gearbox_no || ""}"></div>
          </div>
          <div class="field"><label>${I18N.t("description")}</label><textarea id="e-desc" rows="2">${data.description || ""}</textarea></div>
          <div class="field"><label>${I18N.t("notes")}</label><textarea id="e-notes" rows="2">${data.notes || ""}</textarea></div>
          <div class="row gap" style="justify-content:flex-end">
            <button type="button" class="ghost" data-action="close-modal">${I18N.t("cancel")}</button>
            <button type="submit" class="primary">${isNew ? I18N.t("add") : I18N.t("save")}</button>
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
          UI.toast(I18N.t("added_ok"));
        } else {
          await DB.update("vehicles", v.id, payload);
          UI.toast(I18N.t("saved_ok"));
        }
        overlay.remove();
        await load();
      } catch (err) {
        UI.toast(err.message || I18N.t("save_error"), true);
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
      UI.toast(I18N.t("img_too_big"), true);
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
      UI.toast(I18N.t("img_added"));
      await load();
    } catch (err) {
      UI.toast(err.message || I18N.t("img_read_err"), true);
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
      if (!sel || !confirm(I18N.t("del_vehicle_q"))) return;
      try {
        await DB.remove("vehicles", sel);
        sel = "";
        UI.toast(I18N.t("deleted_ok"));
        await load();
      } catch (err) {
        UI.toast(err.message || I18N.t("error"), true);
      }
    } else if (action === "del-image") {
      var vv = vehicles.filter(function (x) { return x.id === sel; })[0];
      if (!vv) return;
      var imgs = imagesOf(vv).slice();
      if (!imgs.length) return;
      if (!confirm(I18N.t("del_img_q"))) return;
      imgs.splice(imgIdx, 1);
      await DB.update("vehicles", vv.id, { images: imgs, image: imgs[0] || null });
      imgIdx = Math.max(0, imgIdx - 1);
      UI.toast(I18N.t("img_deleted"));
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
