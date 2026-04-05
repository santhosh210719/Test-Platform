/**
 * Student entry: AI assessment form (login-form) and/or scheduled test (join-test-form).
 */

(function () {
  const form = document.getElementById("login-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const regNo = document.getElementById("regNo").value.trim();
      const category = document.getElementById("category").value;

      if (!name || !regNo) {
        alert("Please enter your name and register number.");
        return;
      }

      sessionStorage.setItem("studentName", name);
      sessionStorage.setItem("studentReg", regNo);
      sessionStorage.setItem("category", category);
      sessionStorage.removeItem("activeTest");
      sessionStorage.removeItem("testPayload");
      sessionStorage.removeItem("resultSaved");
      sessionStorage.removeItem("testStartMs");

      window.location.href = "test.html";
    });
  }

  const joinForm = document.getElementById("join-test-form");
  if (joinForm) {
    joinForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const nameEl = document.getElementById("name");
      const regEl = document.getElementById("regNo");
      const name = nameEl ? nameEl.value.trim() : "";
      const regNo = regEl ? regEl.value.trim() : "";

      if (!name || !regNo) {
        alert("Please enter your name and register number.");
        return;
      }

      const tid = document.getElementById("testId").value.trim().toUpperCase();
      const pwd = document.getElementById("testPassword").value.trim();

      const btn = joinForm.querySelector('button[type="submit"]');
      const label = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Joining…";
      }

      try {
        sessionStorage.setItem("studentName", name);
        sessionStorage.setItem("studentReg", regNo);
        await window.joinTest(tid, pwd);
      } catch (err) {
        alert(err.message || String(err));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = label || "Join scheduled test";
        }
      }
    });
  }
})();
