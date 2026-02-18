(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const toggle = document.getElementById("navToggle");
  const mobile = document.getElementById("mobileNav");
  if (toggle && mobile) {
    toggle.addEventListener("click", () => {
      const isHidden = mobile.hasAttribute("hidden");
      if (isHidden) mobile.removeAttribute("hidden");
      else mobile.setAttribute("hidden", "");
    });

    // Auto-close after click
    mobile.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => mobile.setAttribute("hidden", ""));
    });
  }
})();
