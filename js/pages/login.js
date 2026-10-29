(function () {
  // في الوضع التجريبي مفيش دخول — نروح للرئيسية
  if (DB.demoMode) {
    location.replace("index.html");
    return;
  }
  var msg = document.getElementById("msg");
  if (DB.fatal) {
    msg.textContent = DB.fatal;
    return;
  }

  // لو مسجّل دخول بالفعل
  DB.auth.getSession().then(function (s) {
    if (s) location.replace("index.html");
  });

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    btn.disabled = true;
    msg.textContent = "";
    try {
      await DB.auth.signIn(document.getElementById("phone").value, document.getElementById("password").value);
      location.href = "index.html";
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
