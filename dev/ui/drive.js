document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search);
  document.documentElement.classList.add("rm");
  const st = document.createElement("style"); st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}"; document.head.appendChild(st);
  if (q.get("skin")) document.documentElement.dataset.skin = q.get("skin");
  const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  const go = q.get("go");
  if (!go) return;
  key("Enter");
  if (q.get("skin")) document.documentElement.dataset.skin = q.get("skin");
  if (go === "tab") key(q.get("n") || "1");
  if (go === "world") document.querySelector(".wcard").click();
  if (go === "result" || go === "intro" || go === "hud") {
    document.querySelector(".wcard").click();
    document.querySelector(".node").click();
    if (go !== "intro") { key(" "); }
    if (go === "result") { window.Orchard.setInputEnabled(true); key("w"); }
  }
});
