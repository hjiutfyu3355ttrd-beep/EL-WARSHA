UI.page("assistant", async function () {
  var page = await UI.init("assistant");
  if (!page) return;
  var html = UI.html;
  var T = function (k) { return I18N.t(k); };
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row"><div><h2>${T("ai_title")}</h2><p>${T("ai_sub")}</p></div></div>

      <div class="card stack">
        <h3 style="margin:0">${T("ai_ask_h")}</h3>
        <div class="form-grid">
          <div class="field"><label>${T("ai_period")}</label>
            <select id="ai-period">
              <option value="month">${T("ai_p_month")}</option>
              <option value="last">${T("ai_p_last")}</option>
              <option value="30">${T("ai_p_30")}</option>
              <option value="year">${T("ai_p_year")}</option>
            </select></div>
        </div>
        <div class="field"><label>${T("ai_question")}</label>
          <textarea id="ai-q" rows="2" maxlength="500" placeholder="${T("ai_q_ph")}"></textarea></div>
        <div><button id="ai-ask">${T("ai_send")}</button></div>
        <div id="ai-ask-out" style="white-space:pre-wrap" hidden></div>
      </div>

      <div class="card stack">
        <h3 style="margin:0">${T("ai_diag_h")}</h3>
        <div class="field"><label>${T("ai_vehicle")}</label><input id="ai-dv" maxlength="120"></div>
        <div class="field"><label>${T("ai_problem")}</label><textarea id="ai-dp" rows="3" maxlength="800"></textarea></div>
        <div><button id="ai-diag">${T("ai_send")}</button></div>
        <div id="ai-diag-out" style="white-space:pre-wrap" hidden></div>
      </div>

      <div class="card stack">
        <h3 style="margin:0">${T("ai_wa_h")}</h3>
        <div class="form-grid">
          <div class="field"><label>${T("ai_wa_kind")}</label>
            <select id="ai-wk">
              <option value="ready">${T("ai_k_ready")}</option>
              <option value="quote">${T("ai_k_quote")}</option>
              <option value="reminder">${T("ai_k_reminder")}</option>
              <option value="thanks">${T("ai_k_thanks")}</option>
            </select></div>
          <div class="field"><label>${T("ai_wa_cust")}</label><input id="ai-wc" maxlength="60"></div>
          <div class="field"><label>${T("ai_vehicle")}</label><input id="ai-wv" maxlength="80"></div>
        </div>
        <div class="field"><label>${T("ai_wa_details")}</label><input id="ai-wd" maxlength="300"></div>
        <div><button id="ai-wa">${T("ai_send")}</button></div>
        <div id="ai-wa-out" hidden>
          <textarea id="ai-wa-text" rows="5"></textarea>
          <div style="margin-top:8px"><a class="btn" id="ai-wa-open" target="_blank" rel="noopener">${T("forgot_wa")}</a></div>
        </div>
      </div>
      <p style="color:var(--muted);margin:0">${T("ai_note")}</p>
    </div>`;

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function range() {
    var n = new Date(), v = $("ai-period").value, a, b = n;
    if (v === "last") { a = new Date(n.getFullYear(), n.getMonth() - 1, 1); b = new Date(n.getFullYear(), n.getMonth(), 0); }
    else if (v === "30") { a = new Date(n.getTime() - 29 * 864e5); }
    else if (v === "year") { a = new Date(n.getFullYear(), 0, 1); }
    else { a = new Date(n.getFullYear(), n.getMonth(), 1); }
    return { from: iso(a), to: iso(b) };
  }
  function run(btnId, payload, done) {
    var btn = $(btnId);
    btn.disabled = true;
    UI.guard(async function () {
      try { done(await DB.aiAsk(payload)); } finally { btn.disabled = false; }
    });
  }
  $("ai-ask").addEventListener("click", function () {
    var q = $("ai-q").value.trim();
    if (!q) return;
    var r = range(), out = $("ai-ask-out");
    out.hidden = false; out.textContent = T("ai_thinking");
    run("ai-ask", { mode: "ask", question: q, from: r.from, to: r.to }, function (t) { out.textContent = t; });
  });
  $("ai-diag").addEventListener("click", function () {
    var p = $("ai-dp").value.trim();
    if (!p) return;
    var out = $("ai-diag-out");
    out.hidden = false; out.textContent = T("ai_thinking");
    run("ai-diag", { mode: "diagnose", vehicle: $("ai-dv").value, problem: p }, function (t) { out.textContent = t; });
  });
  $("ai-wa").addEventListener("click", function () {
    run("ai-wa", { mode: "whatsapp", kind: $("ai-wk").value, customer: $("ai-wc").value, vehicle: $("ai-wv").value, details: $("ai-wd").value }, function (t) {
      $("ai-wa-out").hidden = false; $("ai-wa-text").value = t;
    });
  });
  $("ai-wa-open").addEventListener("click", function () {
    this.href = "https://wa.me/?text=" + encodeURIComponent($("ai-wa-text").value);
  });
});
