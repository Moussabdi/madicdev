"use strict";
(() => {
  const root = document.getElementById("madix-nav");
  if (!root) return;
  const trigger = root.querySelector("#madix-trigger");
  const panel = root.querySelector("#madix-panel");
  if (!trigger || !panel) return;
  function toggle(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle(panel.hidden);
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) toggle(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      toggle(false);
      trigger.focus();
    }
  });
  // Synchronise les libelles FR/EN avec le commutateur existant.
  function updateLanguage(lang) {
    const selected = lang === "en" ? "en" : "fr";
    root.querySelectorAll("[data-madix-fr]").forEach((node) => {
      node.textContent = node.getAttribute("data-madix-" + selected);
    });
  }
  document.querySelectorAll(".lang-btn[data-lang]").forEach((button) => {
    button.addEventListener("click", () => updateLanguage(button.dataset.lang));
  });
  const active = document.querySelector(".lang-btn.active[data-lang]");
  updateLanguage(active ? active.dataset.lang : "fr");
})();
