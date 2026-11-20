// ============================================================
// بوت الشات العائم (مساعد الورشة) — بيتحمّل مرة واحدة من shell.js وبيفضل ثابت مع التنقل.
// بيكلّم DB.aiAsk({mode:"chat"}) → Edge Function ai-assistant (Gemini). الردود بتتعرض بـ escape كامل.
// ============================================================
(function () {
  "use strict";
  if (window.__cw) return;
  window.__cw = true;
  var I18N = window.I18N, DB = window.DB;
  function t(k) { return I18N.t(k); }
  var KEY = "ws_chat_v1";
  var st = {};
  try { st = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (x) {}
  var msgs = Array.isArray(st.m) ? st.m.slice(-30) : [];
  var open = !!st.o, busy = false;
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ m: msgs.slice(-30), o: open })); } catch (x) {} }

  var P = {
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    again: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>'
  };
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function inl(s) { return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function fmt(s) {
    var out = [], list = false;
    esc(s).split("\n").forEach(function (l) {
      var m = /^\s*[*\-•]\s+(.*)$/.exec(l);
      if (m) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + inl(m[1]) + "</li>"); }
      else { if (list) { out.push("</ul>"); list = false; } if (l.trim()) out.push("<p>" + inl(l) + "</p>"); }
    });
    if (list) out.push("</ul>");
    return out.join("");
  }

  var fab = mk("button", "cw-fab no-print", P.chat);
  fab.type = "button"; fab.setAttribute("aria-label", t("cw_open")); fab.title = t("cw_open");
  var panel = mk("section", "cw-panel no-print");
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", t("cw_title"));
  panel.innerHTML =
    '<div class="cw-head"><div class="cw-av">' + P.spark + '</div>' +
    '<div class="cw-ht"><b>' + esc(t("cw_title")) + '</b><span>' + esc(t("cw_sub")) + '</span></div>' +
    '<button type="button" class="cw-ib" data-a="new" title="' + esc(t("cw_new")) + '" aria-label="' + esc(t("cw_new")) + '">' + P.again + '</button>' +
    '<button type="button" class="cw-ib" data-a="close" title="' + esc(t("cw_close")) + '" aria-label="' + esc(t("cw_close")) + '">' + P.x + '</button></div>' +
    '<div class="cw-body" id="cw-body" aria-live="polite"></div>' +
    '<div class="cw-foot"><div class="cw-in"><textarea class="cw-ta" id="cw-ta" rows="1" maxlength="600" placeholder="' + esc(t("cw_ph")) + '"></textarea>' +
    '<button type="button" class="cw-send" id="cw-send" aria-label="' + esc(t("ai_send")) + '">' + P.send + '</button></div>' +
    '<p class="cw-note">' + esc(t("cw_note")) + '</p></div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  var body = panel.querySelector("#cw-body"), ta = panel.querySelector("#cw-ta"), sendBtn = panel.querySelector("#cw-send"), typing = null;

  function down() { body.scrollTop = body.scrollHeight; }
  // اسم الموقع من الرابط (من غير www.) — الرابط https بس
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (x) { return ""; } }
  function sourcesBox(list) {
    var box = mk("div", "cw-src"), n = 0;
    box.appendChild(mk("b", "cw-src-h", esc(t("cw_sources"))));
    list.slice(0, 5).forEach(function (s) {
      if (!s || typeof s.uri !== "string" || s.uri.indexOf("https://") !== 0) return;
      var a = mk("a", "cw-src-a"); a.href = s.uri; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(mk("span", "cw-src-t", esc(s.title || host(s.uri))));
      a.appendChild(mk("span", "cw-src-d", esc(host(s.uri))));
      box.appendChild(a); n++;
    });
    return n ? box : null;
  }
  function bubble(role, text, srcs) {
    var b = mk("div", "cw-m " + role);
    if (role === "bot") {
      b.innerHTML = fmt(text);
      var sb = srcs && srcs.length ? sourcesBox(srcs) : null;
      if (sb) b.appendChild(sb);
      var c = mk("button", "cw-cp"); c.type = "button"; c.textContent = t("cw_copy");
      c.addEventListener("click", function () {
        try { navigator.clipboard.writeText(text); c.textContent = t("cw_copied"); setTimeout(function () { c.textContent = t("cw_copy"); }, 1500); } catch (x) {}
      });
      b.appendChild(c);
    } else b.textContent = text;
    return b;
  }
  function render() {
    body.innerHTML = "";
    body.appendChild(mk("div", "cw-m bot", fmt(t("cw_hello"))));
    if (!msgs.length) {
      var chips = mk("div", "cw-chips");
      ["cw_c1", "cw_c2", "cw_c3", "cw_c4"].forEach(function (k) {
        var c = mk("button", "cw-chip"); c.type = "button"; c.textContent = t(k);
        c.addEventListener("click", function () { send(t(k)); });
        chips.appendChild(c);
      });
      body.appendChild(chips);
    }
    msgs.forEach(function (m) { body.appendChild(bubble(m.r, m.t, m.s)); });
    if (typing) body.appendChild(typing);
    down();
  }
  function push(r, text, srcs) { msgs.push({ r: r, t: text, s: srcs || [] }); save(); render(); }
  function grow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 110) + "px"; }
  function setBusy(v) { busy = v; sendBtn.disabled = v; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function send(text) {
    text = (text || ta.value).trim();
    if (!text || busy) return;
    var hist = msgs.filter(function (m) { return m.r === "me" || m.r === "bot"; }).slice(-8)
      .map(function (m) { return { role: m.r === "me" ? "user" : "model", text: m.t }; });
    ta.value = ""; grow();
    msgs.push({ r: "me", t: text }); save();
    typing = mk("div", "cw-m bot cw-typing", "<i></i><i></i><i></i>");
    setBusy(true); render();
    DB.aiAsk({ mode: "chat", message: text, history: hist, today: iso(new Date()) }, true)
      .then(function (r) { typing = null; push("bot", r.text, r.sources); })
      .catch(function (e) { typing = null; push("err", (e && e.message) || t("ai_err_provider")); })
      .then(function () { setBusy(false); if (open && window.innerWidth > 600) ta.focus(); });
  }

  function setOpen(v) {
    open = v; save();
    panel.classList.toggle("open", v);
    fab.classList.toggle("cw-hide", v && window.innerWidth <= 600);
    if (v) { down(); if (window.innerWidth > 600) setTimeout(function () { ta.focus(); }, 220); } else if (document.activeElement && panel.contains(document.activeElement)) fab.focus();
  }
  fab.addEventListener("click", function () { setOpen(!open); });
  panel.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-a]") : null;
    if (!b) return;
    if (b.getAttribute("data-a") === "close") setOpen(false);
    else if (!busy) { msgs = []; save(); render(); }
  });
  sendBtn.addEventListener("click", function () { send(); });
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });
  window.addEventListener("resize", function () { fab.classList.toggle("cw-hide", open && window.innerWidth <= 600); });

  render();
  if (open) { panel.classList.add("open"); fab.classList.toggle("cw-hide", window.innerWidth <= 600); }
})();
