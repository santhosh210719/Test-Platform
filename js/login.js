/**
 * index.html — collect student name, register number, category; start test.
 */

(function () {
  const form = document.getElementById("login-form");
  if (!form) return;

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
    // Fresh attempt
    sessionStorage.removeItem("testPayload");
    sessionStorage.removeItem("resultSaved");
    sessionStorage.removeItem("testStartMs");

    window.location.href = "test.html";
  });
})();
