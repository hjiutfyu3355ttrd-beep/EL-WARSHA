(function () {
  if (DB.demoMode) {
    location.replace("index.html");
    return;
  }
  var msg = document.getElementById("msg");
  if (DB.fatal) {
    msg.textContent = DB.fatal;
    return;
  }

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    btn.disabled = true;
    msg.textContent = "";
    try {
      var session = await DB.auth.signUp(
        document.getElementById("phone").value,
        document.getElementById("password").value,
        document.getElementById("shop").value.trim()
      );
      if (session) {
        location.href = "index.html";
      } else {
        // مفيش جلسة (تأكيد الإيميل لسه مفعّل في Supabase): نعرض رسالة ونوديه للدخول
        document.getElementById("form").style.display = "none";
        document.getElementById("info").style.display = "block";
      }
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
