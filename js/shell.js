// ============================================================
// القشرة الثابتة (App Shell) + الراوتر.
//
// الفكرة: الهيكل (القائمة الجانبية + الشريط العلوي + شريط الموبايل) بيتبني مرة واحدة وبيفضل ثابت،
// والتنقل بين الصفحات بيبدّل المحتوى بس (من غير إعادة تحميل) — زي برامج الكمبيوتر والموبايل.
//
//   1) كل صفحة HTML لسه ملف عادي (للتحميل المباشر والروابط)، بس بعد أول تحميل الراوتر بيجيب
//      الـ HTML ويحمّل سكربتات الصفحة مرة واحدة ويشغّلها جوه نفس الهيكل.
//   2) سكربت الصفحة بيسجّل نفسه:  UI.page("اسم", async function () { var page = await UI.init("اسم"); ... })
//   3) أي رابط داخلي (a href="xxx.html") وأي صف فيه data-href بيتحوّل تلقائي لتنقل داخلي.
//      لو حصل أي مشكلة (صفحة غير مدعومة، فشل تحميل) بنرجع لتنقل المتصفح العادي.
//
// ES5 تقريبًا (بدون مكتبات) — CSP بتسمح بسكربتات الموقع بس (script-src 'self').
// ============================================================
(function () {
  "use strict";

  var UI = window.UI, DB = window.DB, I18N = window.I18N;
  var M = UI.meta;
  var e = UI.esc;
  function t(k, p) { return I18N.t(k, p); }
  function ic(n) { return M.icon(n); }
  function $(id) { return document.getElementById(id); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (x) { return {}; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} }
  var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
  function isMobile() { return window.matchMedia("(max-width: 900px)").matches; }

  var S = { gen: 0, built: false, started: false, ready: false, cur: "", pendingY: 0, state: { checkedAt: 0, adminChecked: false, currencyLoaded: false, active: null } };
  var pages = {};          // اسم الصفحة → دالة التشغيل
  var infoCache = {};      // مسار الصفحة → وعد بمعلوماتها (سكربتاتها)
  var scriptCache = {};    // رابط سكربت → وعد التحميل
  var navId = 0;           // رقم آخر طلب تنقل (لتجاهل الطلبات القديمة)
  var adminOn = false;
  try { adminOn = sessionStorage.getItem("ws_admin") === "1"; } catch (x) {}

  // ------------------------------------------------------------
  // 0) حماية من "الاستمرار بعد المغادرة":
  //    لو المستخدم انتقل لصفحة تانية أثناء ما صفحة قديمة لسه مستنية بيانات من الداتابيز،
  //    نتائجها بتتجاهل (الوعد بيفضل معلّق) فمفيش حاجة قديمة بتكتب فوق الصفحة الجديدة.
  //    (الطلب نفسه بيكمّل على السيرفر — يعني حفظ بيانات مش بيتلغي.)
  // ------------------------------------------------------------
  function guardAll(obj) {
    Object.keys(obj).forEach(function (k) {
      var f = obj[k];
      if (typeof f === "function") {
        obj[k] = function () {
          var g = S.gen, p = f.apply(this, arguments);
          if (!p || typeof p.then !== "function") return p;
          return new Promise(function (res, rej) {
            p.then(function (v) { if (g === S.gen) res(v); }, function (er) { if (g === S.gen) rej(er); });
          });
        };
      } else if (f && typeof f === "object" && k === "auth") {
        guardAll(f);
      }
    });
  }
  guardAll(DB);

  // ------------------------------------------------------------
  // 1) تسجيل الصفحات + تحميل السكربتات + معلومات الصفحة
  // ------------------------------------------------------------
  S.register = function (name, fn) { pages[name] = fn; };

  function absUrl(src) { return new URL(src, document.baseURI).href; }
  // السكربتات المحمّلة أصلاً في الصفحة الأولى
  [].forEach.call(document.querySelectorAll("script[src]"), function (s) { scriptCache[s.src] = Promise.resolve(); });

  function loadScript(src) {
    var key = absUrl(src);
    if (scriptCache[key]) return scriptCache[key];
    scriptCache[key] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;  // ترتيب التنفيذ = ترتيب الإضافة (insurance.js قبل سكربت الصفحة)
      s.onload = function () { res(); };
      s.onerror = function () { delete scriptCache[key]; rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
    return scriptCache[key];
  }
  function ensureScripts(list) {
    return Promise.all(list.map(loadScript));
  }

  function norm(p) { return p.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "").replace(/(.)\/$/, "$1"); }
  function curKey() { return norm(location.pathname) + location.search; }
  function isShellPath(p) {
    var n = norm(p);
    if (/\/(login|signup)$/.test(n)) return false;
    var last = n.split("/").pop();
    return last === "" || last.indexOf(".") < 0;  // أي مسار من غير امتداد (بعد شيل .html) = صفحة
  }

  // بيقرأ ملف HTML بتاع الصفحة (صغير جدًا) ويطلّع منه: اسم الصفحة + قايمة سكربتاتها.
  // كده أي صفحة جديدة بتشتغل من غير ما نسجّلها في أي جدول.
  function getInfo(pathname) {
    var key = norm(pathname);
    if (infoCache[key]) return infoCache[key];
    var p = fetch(pathname, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, "text/html");
        var scripts = [].map.call(doc.querySelectorAll("script[src]"), function (s) { return s.getAttribute("src"); });
        var pageSrc = scripts.filter(function (s) { return /js\/pages\//.test(s); })[0];
        return {
          shell: doc.body && doc.body.classList.contains("has-shell"),
          scripts: scripts,
          name: pageSrc ? pageSrc.replace(/^.*pages\/([^\/?#]+?)\.js.*$/, "$1") : null
        };
      });
    infoCache[key] = p;
    p.catch(function () { delete infoCache[key]; });
    return p;
  }

  // ------------------------------------------------------------
  // 2) بناء الهيكل (مرة واحدة)
  // ------------------------------------------------------------
  function navHtml() {
    var closed = readJSON("ws_ng");
    var out = M.NAV.map(function (g) {
      var items = g.items.map(function (l) {
        var lab = M.navLabelOf(l);
        return '<a class="nav" href="' + e(l.href) + '" data-key="' + e(l.key) + '" data-tip="' + e(lab) + '">' +
          ic(l.icon) + '<span class="nav-t">' + e(lab) + "</span></a>";
      }).join("");
      if (g.gk === "g_home") return '<div class="nav-group nogh"><div class="nav-gb"><div class="nav-gi">' + items + "</div></div></div>";
      var isClosed = !!closed[g.gk];
      return '<div class="nav-group' + (isClosed ? " closed" : "") + '" data-g="' + e(g.gk) + '">' +
        '<button type="button" class="nav-gh" data-action="group" aria-expanded="' + (!isClosed) + '"><span>' + e(M.groupLabelOf(g)) + "</span>" + ic("chev") + "</button>" +
        '<div class="nav-gb"><div class="nav-gi">' + items + "</div></div></div>";
    }).join("");
    out += '<div class="nav-group" id="nav-admin" data-g="platform"' + (adminOn ? "" : " hidden") + ">" +
      '<button type="button" class="nav-gh" data-action="group" aria-expanded="true"><span>' + e(t("platform")) + "</span>" + ic("chev") + "</button>" +
      '<div class="nav-gb"><div class="nav-gi"><a class="nav" href="admin.html" data-key="admin" data-tip="' + e(t("admin")) + '">' +
      ic("admin") + '<span class="nav-t">' + e(t("admin")) + "</span></a></div></div></div>";
    return out;
  }

  function buildShell() {
    var app = $("app");
    var lang = I18N.getLang();
    var shop = "";
    try { shop = localStorage.getItem("ws_shop_name") || ""; } catch (x) {}
    var recv = t("receive_vehicle").replace(/^[＋+]\s*/, "");
    var kbd = isMac ? "⌘K" : "Ctrl K";

    app.innerHTML =
      '<div class="layout" id="layout">' +
      '<aside class="sidebar" id="sidebar" aria-label="' + e(t("menu_label")) + '">' +
        '<div class="sb-top">' +
          '<a class="brand" href="index.html"><img src="assets/img/logo.svg" alt="" />' +
            '<span class="brand-txt"><b>' + e(t("app_name")) + '</b><small id="sb-shop">' + e(shop || t("sh_brand_sub")) + "</small></span></a>" +
          '<button type="button" class="sb-x" data-action="nav-close" aria-label="' + e(t("sh_close")) + '">' + ic("x") + "</button>" +
        "</div>" +
        '<button type="button" class="sb-search" data-action="palette" data-tip="' + e(t("sh_search")) + '">' + ic("search") +
          "<span>" + e(t("sh_search")) + "</span><kbd>" + kbd + "</kbd></button>" +
        '<nav class="sb-nav" id="sb-nav">' + navHtml() + "</nav>" +
        '<div class="sb-foot">' +
          '<div class="seg lang-seg" role="group" aria-label="' + e(t("language")) + '">' +
            '<button type="button" data-lang="ar" class="' + (lang === "ar" ? "on" : "") + '">العربية</button>' +
            '<button type="button" data-lang="tr" class="' + (lang === "tr" ? "on" : "") + '">Türkçe</button>' +
          "</div>" +
          '<div class="user-card" id="user-card"' + (DB.demoMode ? " hidden" : "") + ">" +
            '<span class="avatar" id="uc-av">' + e((shop || "•").charAt(0)) + "</span>" +
            '<span class="uc-t"><b id="uc-name">' + e(shop || t("app_name")) + '</b><small id="uc-phone" dir="ltr"></small></span>' +
            '<button type="button" class="uc-out" data-action="signout" data-tip="' + e(t("signout")) + '" aria-label="' + e(t("signout")) + '">' + ic("logout") + "</button>" +
          "</div>" +
        "</div>" +
      "</aside>" +
      '<div class="scrim" data-action="nav-close"></div>' +
      '<div class="main">' +
        '<header class="topbar no-print">' +
          '<button type="button" class="tb-btn menu-btn" data-action="toggle-nav" aria-label="' + e(t("menu_label")) + '">' + ic("menu") + "</button>" +
          '<button type="button" class="tb-btn rail-btn" data-action="collapse-nav" id="rail-btn" aria-label="' + e(t("sh_collapse")) + '" data-tip="' + e(t("sh_collapse")) + '">' + ic("panel") + "</button>" +
          '<div class="crumbs" id="crumbs"></div>' +
          '<button type="button" class="tb-search" data-action="palette" aria-label="' + e(t("sh_search")) + '">' + ic("search") + "<span>" + e(t("sh_search")) + "</span><kbd>" + kbd + "</kbd></button>" +
          '<a class="btn primary btn-receive" href="work-order-new.html">' + ic("plus") + "<span>" + e(recv) + "</span></a>" +
        "</header>" +
        '<main class="content" id="content">' +
          (DB.demoMode
            ? '<div class="notice no-print"><span>' + e(t("demo_notice")) + '</span> <a class="link" href="#" data-action="reset-demo">' + e(t("demo_reset")) + "</a></div>"
            : "") +
          '<div id="page" class="page"></div>' +
        "</main>" +
      "</div>" +
      '<nav class="tabbar no-print" id="tabbar" aria-label="' + e(t("menu_label")) + '">' +
        '<a class="tab" href="index.html" data-tab="dashboard">' + ic("dashboard") + "<span>" + e(t("nav_dashboard")) + "</span></a>" +
        '<a class="tab" href="work-orders.html" data-tab="work-orders">' + ic("workorders") + "<span>" + e(t("nav_work_orders")) + "</span></a>" +
        '<a class="tab tab-fab" href="work-order-new.html" data-tab="work-order-new" aria-label="' + e(recv) + '"><span class="fab-c">' + ic("plus") + "</span></a>" +
        '<a class="tab" href="customers.html" data-tab="customers">' + ic("customers") + "<span>" + e(t("nav_customers")) + "</span></a>" +
        '<button type="button" class="tab" data-action="toggle-nav" data-tab="more">' + ic("more") + "<span>" + e(t("sh_more")) + "</span></button>" +
      "</nav>" +
      "</div>" +
      '<div class="nprog" id="nprog" aria-hidden="true"></div>';

    S.built = true;
    var layout = $("layout");
    try { if (localStorage.getItem("ws_rail") === "1") layout.classList.add("rail"); } catch (x) {}
    syncRailLabel();
    // مكان سكرول القائمة بعد إعادة تحميل كامل
    var nav = $("sb-nav");
    try { nav.scrollTop = parseInt(sessionStorage.getItem("ws_sb_scroll") || "0", 10); } catch (x) {}
    window.addEventListener("pagehide", function () { try { sessionStorage.setItem("ws_sb_scroll", String(nav.scrollTop)); } catch (x) {} });
    document.body.classList.add("shell-ready");
  }
  S.ensure = function () { if (!S.built) buildShell(); };

  function syncRailLabel() {
    var b = $("rail-btn"), l = $("layout");
    if (!b || !l) return;
    var lab = l.classList.contains("rail") ? t("sh_expand") : t("sh_collapse");
    b.setAttribute("aria-label", lab);
    b.setAttribute("title", lab);
    // في الوضع المطوي الأسماء مخفية: نعرضها كـ tooltip عادي من المتصفح
    var rail = l.classList.contains("rail");
    var els = document.querySelectorAll("#sidebar [data-tip]");
    for (var i = 0; i < els.length; i++) {
      if (rail) els[i].setAttribute("title", els[i].getAttribute("data-tip")); else els[i].removeAttribute("title");
    }
  }

  // ------------------------------------------------------------
  // 3) تحديث "الصفحة النشطة": القائمة + مسار التنقّل + شريط الموبايل + عنوان التبويب
  // ------------------------------------------------------------
  S.setActive = function (key, opts) {
    opts = opts || {};
    S.state.active = key;
    var links = document.querySelectorAll("#sb-nav a.nav");
    var act = null;
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute("data-key") === key;
      links[i].classList.toggle("active", on);
      if (on) { links[i].setAttribute("aria-current", "page"); act = links[i]; } else links[i].removeAttribute("aria-current");
    }
    if (act) {
      var grp = act.closest(".nav-group");
      if (grp && grp.classList.contains("closed")) { grp.classList.remove("closed"); var gh = grp.querySelector(".nav-gh"); if (gh) gh.setAttribute("aria-expanded", "true"); }
      // نخلّي الرابط النشط ظاهر جوه القائمة من غير ما نحرّك الصفحة نفسها
      var nav = $("sb-nav");
      if (nav) {
        var top = act.offsetTop - nav.offsetTop, bot = top + act.offsetHeight;
        if (top < nav.scrollTop + 8) nav.scrollTop = Math.max(0, top - 40);
        else if (bot > nav.scrollTop + nav.clientHeight - 8) nav.scrollTop = bot - nav.clientHeight + 40;
      }
    }
    var title = M.titleOf(opts.key || key)[0];
    var g = M.groupOf(key);
    var c = "";
    if (key !== "dashboard") {
      c += '<a class="crumb-home" href="index.html">' + e(t("home")) + '</a><i class="sep">' + ic("chev") + "</i>";
      if (g && g.gk !== "g_home") c += '<span class="crumb-g">' + e(M.groupLabelOf(g)) + '</span><i class="sep">' + ic("chev") + "</i>";
    }
    c += "<b>" + e(title) + "</b>";
    var cr = $("crumbs");
    if (cr) cr.innerHTML = c;
    document.title = title + " — " + t("app_name");

    var tabs = document.querySelectorAll("#tabbar [data-tab]");
    var main = { dashboard: 1, "work-orders": 1, "work-order-new": 1, customers: 1 };
    var tabKey = main[key] ? key : "more";
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle("active", tabs[j].getAttribute("data-tab") === tabKey);
  };

  S.setShop = function (name) {
    name = name || "";
    try { localStorage.setItem("ws_shop_name", name); } catch (x) {}
    var a = $("sb-shop"), b = $("uc-name"), c = $("uc-av");
    if (a) a.textContent = name || t("sh_brand_sub");
    if (b) b.textContent = name || t("app_name");
    if (c) c.textContent = (name || "•").charAt(0);
  };
  S.setUser = function (user) {
    var p = $("uc-phone");
    if (p && user) p.textContent = DB.auth.emailToPhone(user.email || "");
  };
  S.setAdmin = function (isAdm) {
    adminOn = !!isAdm;
    try { sessionStorage.setItem("ws_admin", adminOn ? "1" : "0"); } catch (x) {}
    var el = $("nav-admin");
    if (el) el.hidden = !adminOn;
  };

  // ------------------------------------------------------------
  // 4) الصفحة نفسها: عنصر جديد مع كل تنقّل + هيكل تحميل + أنيميشن دخول
  // ------------------------------------------------------------
  var SKELETON = '<div class="skel-wrap" aria-hidden="true"><div class="skel sk-title"></div>' +
    '<div class="sk-row"><div class="skel sk-card"></div><div class="skel sk-card"></div><div class="skel sk-card"></div><div class="skel sk-card"></div></div>' +
    '<div class="skel sk-block"></div></div>';

  function freshPage() {
    var old = $("page");
    var el = document.createElement("div");
    el.id = "page";
    el.className = "page is-loading";
    el.setAttribute("tabindex", "-1");
    el.innerHTML = SKELETON;
    var skel = el.firstChild;
    old.parentNode.replaceChild(el, old);
    if (S.mo) S.mo.disconnect();
    S.ready = false;
    S.mo = new MutationObserver(function () {
      if (el.contains(skel)) return;  // لسه الهيكل ظاهر
      S.markReady();
    });
    S.mo.observe(el, { childList: true });
    try { el.focus({ preventScroll: true }); } catch (x) {}
    return el;
  }
  S.markReady = function () {
    if (S.mo) { S.mo.disconnect(); S.mo = null; }
    var el = $("page");
    if (el) { el.classList.remove("is-loading"); el.classList.add("is-ready"); }
    S.ready = true;
    progDone();
    if (S.pendingY) {
      var y = S.pendingY;
      S.pendingY = 0;
      window.scrollTo(0, y);
      setTimeout(function () { window.scrollTo(0, y); }, 220);  // بعد ما المحتوى يكمّل رسم
    }
  };

  // شريط التقدّم الرفيع فوق (بيظهر بس لو التنقّل خد وقت)
  var prog = { delay: null, timer: null, v: 0 };
  function progApply() { var el = $("nprog"); if (el) el.style.transform = "scaleX(" + prog.v + ")"; }
  function progStart() {
    clearTimeout(prog.delay);
    clearInterval(prog.timer);
    prog.delay = setTimeout(function () {
      var el = $("nprog");
      if (!el) return;
      el.className = "nprog on";
      prog.v = 0.14;
      progApply();
      prog.timer = setInterval(function () { prog.v += (0.92 - prog.v) * 0.07; progApply(); }, 120);
    }, 110);
  }
  function progDone() {
    clearTimeout(prog.delay);
    clearInterval(prog.timer);
    var el = $("nprog");
    if (!el || el.className.indexOf("on") < 0) return;
    prog.v = 1;
    progApply();
    setTimeout(function () { el.className = "nprog"; prog.v = 0; progApply(); }, 260);
  }

  function showError(err, g) {
    if (g !== S.gen) return;
    if (window.console) console.error(err);
    var el = $("page");
    if (!el) return;
    el.innerHTML = '<div class="card err-card"><div class="err-ic">' + ic("admin") + "</div><h3>" + e(t("sh_error")) + "</h3>" +
      '<p class="muted">' + e((err && err.message) || "") + '</p><button type="button" data-action="retry">' + e(t("sh_retry")) + "</button></div>";
  }

  // قبل ما نعرض صفحة جديدة: نقفل أي حاجة طافية من الصفحة اللي فاتت
  function teardown() {
    var ovs = document.querySelectorAll(".modal-overlay, .cmd-ov");
    for (var i = 0; i < ovs.length; i++) ovs[i].remove();
    closeNav();
    document.body.classList.remove("modal-open");
  }

  function render(name, pop) {
    S.gen++;
    teardown();
    freshPage();
    S.cur = curKey();
    S.pendingY = 0;
    if (pop && pop.y) S.pendingY = pop.y; else window.scrollTo(0, 0);
    var g = S.gen, fn = pages[name];
    S.current = name;
    Promise.resolve().then(function () { return fn(); }).catch(function (err) { showError(err, g); });
  }

  // ------------------------------------------------------------
  // 5) الراوتر
  // ------------------------------------------------------------
  function optimisticActive(href) {
    // تمييز الرابط فور الضغط (قبل ما الصفحة تتحمّل) — إحساس فوري
    var file;
    try { file = new URL(href, location.href).pathname.split("/").pop() || "index.html"; } catch (x) { return; }
    if (!/\.html$/.test(file)) file += ".html";
    var links = document.querySelectorAll('#sb-nav a.nav, #tabbar a.tab');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute("href");
      if (!h) continue;
      if (links[i].classList.contains("nav")) links[i].classList.toggle("active", h === file);
      else links[i].classList.toggle("active", h === file);
    }
  }

  async function go(href, opts) {
    opts = opts || {};
    var u;
    try { u = new URL(href, location.href); } catch (x) { return false; }
    if (u.origin !== location.origin || !isShellPath(u.pathname)) { location.href = u.href; return false; }
    var id = ++navId;
    progStart();
    optimisticActive(u.pathname);
    var info;
    try {
      info = await getInfo(u.pathname);
      if (info.shell) await ensureScripts(info.scripts);
    } catch (err) {
      if (id === navId) location.href = u.href;  // خطة بديلة: تنقّل المتصفح العادي
      return false;
    }
    if (id !== navId) return false;               // اتضغط على رابط تاني في الأثناء
    if (!info.shell || !info.name || !pages[info.name]) { location.href = u.href; return false; }

    var same = norm(u.pathname) + u.search === curKey();
    try {
      history.replaceState({ y: window.scrollY }, "");  // مكان سكرول الصفحة اللي سايبينها
      history[same ? "replaceState" : "pushState"]({ y: 0 }, "", u.pathname + u.search + u.hash);
    } catch (x) { location.href = u.href; return false; }
    render(info.name, null);
    return true;
  }
  S.go = go;

  window.addEventListener("popstate", function (ev) {
    if (!S.started) return;
    if (curKey() === S.cur) return;  // تغيير في الـ hash بس
    var u = new URL(location.href);
    if (!isShellPath(u.pathname)) { location.reload(); return; }
    var y = (ev.state && ev.state.y) || 0;
    var id = ++navId;
    getInfo(u.pathname).then(function (info) {
      return ensureScripts(info.scripts).then(function () { return info; });
    }).then(function (info) {
      if (id !== navId) return;
      if (!info.name || !pages[info.name]) { location.reload(); return; }
      render(info.name, { y: y });
    }, function () { location.reload(); });
  });

  // أي رابط داخلي → تنقّل داخل التطبيق
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) === "#" || /^(mailto:|tel:|javascript:)/i.test(h)) return;
    var u;
    try { u = new URL(a.href); } catch (x) { return; }
    if (u.origin !== location.origin || !isShellPath(u.pathname)) return;
    ev.preventDefault();
    go(a.href);
  });

  // تحميل مسبق عند المرور/اللمس → الانتقال بيبقى فوري
  function prefetchLink(ev) {
    var a = ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    var u;
    try { u = new URL(a.href); } catch (x) { return; }
    if (u.origin !== location.origin || !isShellPath(u.pathname)) return;
    getInfo(u.pathname).then(function (info) { if (info.shell) return ensureScripts(info.scripts); }).catch(function () {});
  }
  document.addEventListener("mouseover", prefetchLink, { passive: true });
  document.addEventListener("touchstart", prefetchLink, { passive: true });
  document.addEventListener("focusin", prefetchLink);

  // بعد أول عرض وفي وقت فراغ المتصفح: نحمّل باقي الصفحات في الخلفية فكل التنقّلات بعد كده لحظية
  function warmUp() {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    var queue = [];
    M.NAV.forEach(function (g) { g.items.forEach(function (l) { queue.push(l.href); }); });
    queue.push("work-order.html", "invoice.html");
    (function next() {
      var href = queue.shift();
      if (!href) return;
      var u = new URL(href, location.href);
      getInfo(u.pathname).then(function (info) { if (info.shell) return ensureScripts(info.scripts); }).catch(function () {}).then(function () {
        setTimeout(next, 90);
      });
    })();
  }

  // ------------------------------------------------------------
  // 6) القائمة الجانبية: فتح/قفل (موبايل) + طي (كمبيوتر) + مجموعات + لغة
  // ------------------------------------------------------------
  function openNav() { var l = $("layout"); if (!l) return; l.classList.add("nav-open"); document.body.classList.add("nav-lock"); }
  function closeNav() { var l = $("layout"); if (l) l.classList.remove("nav-open"); document.body.classList.remove("nav-lock"); }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-action],[data-lang]") : null;
    if (!el) return;
    var l = $("layout");
    var lang = el.getAttribute("data-lang");
    if (lang) {
      // في الوضع المطوي بيظهر زر واحد بس: الضغط عليه بيبدّل اللغة
      if (lang === I18N.getLang()) { if (!l || !l.classList.contains("rail")) return; lang = lang === "ar" ? "tr" : "ar"; }
      I18N.setLang(lang);
      location.reload();
      return;
    }
    var a = el.getAttribute("data-action");
    if (a === "toggle-nav") { l.classList.contains("nav-open") ? closeNav() : openNav(); }
    else if (a === "nav-close") closeNav();
    else if (a === "collapse-nav") {
      l.classList.toggle("rail");
      try { localStorage.setItem("ws_rail", l.classList.contains("rail") ? "1" : "0"); } catch (x) {}
      syncRailLabel();
    } else if (a === "group") {
      var grp = el.closest(".nav-group");
      var closed = grp.classList.toggle("closed");
      el.setAttribute("aria-expanded", String(!closed));
      var st = readJSON("ws_ng");
      var gk = grp.getAttribute("data-g");
      if (closed) st[gk] = 1; else delete st[gk];
      writeJSON("ws_ng", st);
    } else if (a === "palette") { closeNav(); openPalette(); }
    else if (a === "retry") { render(S.current, null); }
  });

  // إيماءات اللمس: سحب من حافة الشاشة يفتح القائمة، وسحبها للخارج يقفلها
  (function gestures() {
    var sx = 0, sy = 0, mode = null;
    document.addEventListener("touchstart", function (ev) {
      mode = null;
      if (!isMobile() || ev.touches.length !== 1 || !$("layout")) return;
      var p = ev.touches[0];
      sx = p.clientX; sy = p.clientY;
      var rtl = document.documentElement.dir === "rtl";
      var edge = rtl ? window.innerWidth - sx : sx;
      if ($("layout").classList.contains("nav-open")) mode = "close";
      else if (edge <= 18) mode = "open";
    }, { passive: true });
    document.addEventListener("touchend", function (ev) {
      if (!mode) return;
      var p = ev.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
      var m = mode; mode = null;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) return;  // ده سكرول رأسي
      var inward = document.documentElement.dir === "rtl" ? -dx : dx;
      if (m === "open" && inward > 70) openNav();
      else if (m === "close" && inward < -70) closeNav();
    }, { passive: true });
  })();

  // ------------------------------------------------------------
  // 7) البحث السريع (Ctrl/⌘ + K أو "/")
  // ------------------------------------------------------------
  var pal = { el: null, items: [], shown: [], idx: 0 };
  function nz(s) {
    return String(s == null ? "" : s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/ı/g, "i").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  }
  function palItems() {
    var out = [];
    M.NAV.forEach(function (g) {
      g.items.forEach(function (l) {
        out.push({ kind: "page", href: l.href, icon: l.icon, label: M.navLabelOf(l), group: M.groupLabelOf(g) });
      });
    });
    if (adminOn) out.push({ kind: "page", href: "admin.html", icon: "admin", label: t("admin"), group: t("platform") });
    var other = I18N.getLang() === "ar" ? "tr" : "ar";
    out.push({ kind: "lang", lang: other, icon: "globe", label: t("language") + ": " + t(other === "ar" ? "lang_native_ar" : "lang_native_tr"), group: t("sh_actions") });
    if (!DB.demoMode) out.push({ kind: "signout", icon: "logout", label: t("signout"), group: t("sh_actions") });
    return out;
  }
  function palFilter(q) {
    var words = nz(q).split(/\s+/).filter(Boolean);
    var res = pal.items.filter(function (it) {
      var hay = nz(it.label + " " + it.group);
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    if (words.length) res.sort(function (a, b) {
      return (nz(a.label).indexOf(words[0]) === 0 ? 0 : 1) - (nz(b.label).indexOf(words[0]) === 0 ? 0 : 1);
    });
    return res;
  }
  function palRender() {
    var q = $("cmd-q").value;
    pal.shown = palFilter(q);
    if (pal.idx >= pal.shown.length) pal.idx = Math.max(0, pal.shown.length - 1);
    var list = $("cmd-list");
    if (!pal.shown.length) { list.innerHTML = '<div class="cmd-empty">' + e(t("sh_no_results")) + "</div>"; return; }
    list.innerHTML = pal.shown.map(function (it, i) {
      return '<button type="button" class="cmd-i' + (i === pal.idx ? " on" : "") + '" role="option" data-i="' + i + '" aria-selected="' + (i === pal.idx) + '">' +
        '<span class="cmd-ic">' + ic(it.icon) + '</span><span class="cmd-l">' + e(it.label) + "</span>" +
        '<small class="cmd-g">' + e(it.group) + "</small></button>";
    }).join("");
    var on = list.querySelector(".cmd-i.on");
    if (on) { var lt = on.offsetTop, lb = lt + on.offsetHeight; if (lt < list.scrollTop) list.scrollTop = lt - 6; else if (lb > list.scrollTop + list.clientHeight) list.scrollTop = lb - list.clientHeight + 6; }
  }
  function palChoose(i) {
    var it = pal.shown[i];
    if (!it) return;
    closePalette();
    if (it.kind === "page") go(it.href);
    else if (it.kind === "lang") { I18N.setLang(it.lang); location.reload(); }
    else if (it.kind === "signout") DB.auth.signOut().then(function () { location.href = "login.html"; });
  }
  function openPalette() {
    if (pal.el) return;
    pal.items = palItems();
    pal.idx = 0;
    var ov = document.createElement("div");
    ov.className = "cmd-ov";
    ov.id = "cmd";
    ov.innerHTML =
      '<div class="cmd-box" role="dialog" aria-modal="true" aria-label="' + e(t("sh_search")) + '">' +
        '<div class="cmd-in">' + ic("search") +
          '<input id="cmd-q" type="text" autocomplete="off" spellcheck="false" placeholder="' + e(t("sh_search_ph")) + '" aria-controls="cmd-list" />' +
          "<kbd>Esc</kbd></div>" +
        '<div class="cmd-list" id="cmd-list" role="listbox"></div>' +
        '<div class="cmd-ft"><span><kbd>↑</kbd><kbd>↓</kbd></span><span><kbd>↵</kbd> ' + e(t("sh_open")) + "</span></div>" +
      "</div>";
    document.body.appendChild(ov);
    document.body.classList.add("modal-open");
    pal.el = ov;
    palRender();
    var q = $("cmd-q");
    q.focus();
    q.addEventListener("input", function () { pal.idx = 0; palRender(); });
    q.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); pal.idx = Math.min(pal.shown.length - 1, pal.idx + 1); palRender(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); pal.idx = Math.max(0, pal.idx - 1); palRender(); }
      else if (ev.key === "Enter") { ev.preventDefault(); palChoose(pal.idx); }
    });
    ov.addEventListener("mousedown", function (ev) {
      if (ev.target === ov) { closePalette(); return; }
      var b = ev.target.closest(".cmd-i");
      if (b) { ev.preventDefault(); palChoose(Number(b.getAttribute("data-i"))); }
    });
    ov.addEventListener("mousemove", function (ev) {
      var b = ev.target.closest(".cmd-i");
      if (!b) return;
      var i = Number(b.getAttribute("data-i"));
      if (i !== pal.idx) { pal.idx = i; var all = ov.querySelectorAll(".cmd-i"); for (var k = 0; k < all.length; k++) all[k].classList.toggle("on", k === i); }
    });
  }
  function closePalette() {
    if (!pal.el) return;
    pal.el.remove();
    pal.el = null;
    document.body.classList.remove("modal-open");
  }
  document.addEventListener("keydown", function (ev) {
    var k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && (k === "k" || k === "K")) { ev.preventDefault(); pal.el ? closePalette() : openPalette(); return; }
    if (k === "Escape") { if (pal.el) closePalette(); else closeNav(); return; }
    if (k === "/" && !pal.el && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      var tg = ev.target, tag = tg && tg.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (tg && tg.isContentEditable)) return;
      ev.preventDefault();
      openPalette();
    }
  });

  // ------------------------------------------------------------
  // 8) حفظ مكان السكرول (للرجوع/إعادة التحميل) + حالة الاتصال
  // ------------------------------------------------------------
  var scrollTimer = null;
  function saveY() {
    if (!S.ready) return;  // مانحفظش أثناء الهيكل (الصفحة قصيرة)
    try { history.replaceState({ y: window.scrollY }, ""); } catch (x) {}
  }
  window.addEventListener("scroll", function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveY, 250); }, { passive: true });
  window.addEventListener("pagehide", saveY);

  window.addEventListener("offline", function () { UI.flash(t("sh_offline"), "error"); });
  window.addEventListener("online", function () { UI.flash(t("sh_online"), "success"); });

  // ------------------------------------------------------------
  // 9) التشغيل
  // ------------------------------------------------------------
  function start() {
    if (S.started) return;
    S.started = true;
    var sc = document.querySelector('script[src*="js/pages/"]');
    var name = sc ? sc.getAttribute("src").replace(/^.*pages\/([^\/?#]+?)\.js.*$/, "$1") : null;
    if (!name || !pages[name]) { if (window.console) console.error("shell: سكربت الصفحة مش متسجّل"); return; }
    var y = 0;
    try { history.scrollRestoration = "manual"; y = (history.state && history.state.y) || 0; history.replaceState({ y: y }, ""); } catch (x) {}
    S.ensure();
    render(name, y ? { y: y } : null);
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    idle(warmUp);
  }
  window.Shell = S;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
