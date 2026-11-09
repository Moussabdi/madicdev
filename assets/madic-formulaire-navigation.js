/* Navigation par etapes: aucun changement aux champs ou a leur sauvegarde Supabase. */
(() => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  if (!form) return;
  const steps = [...form.querySelectorAll("fieldset")];
  const prev = document.getElementById("madic-step-prev"),
    next = document.getElementById("madic-step-next"),
    submit = document.getElementById("madic-step-submit");
  const label = document.getElementById("madic-step-label"),
    count = document.getElementById("madic-step-count"),
    fill = document.getElementById("madic-progress-fill");
  if (!steps.length || !prev || !next || !submit) return;
  let current = 0;
  const title = (i) =>
    steps[i].querySelector("legend")?.textContent.trim().replace(/\s+/g, " ") ||
    `Section ${i + 1}`;
  function show(i) {
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, k) => {
      s.classList.toggle("madic-step-inactive", k !== current);
      s.setAttribute("aria-hidden", String(k !== current));
    });
    prev.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    label.textContent = title(current);
    count.textContent = `${current + 1} / ${steps.length}`;
    fill.style.width = `${((current + 1) / steps.length) * 100}%`;
    document
      .querySelector(".madic-steps")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function validateStep(i) {
    for (const el of steps[i].querySelectorAll("input,select,textarea")) {
      if (el.disabled || el.type === "hidden") continue;
      if (!el.checkValidity()) {
        el.reportValidity();
        el.focus();
        return false;
      }
    }
    return true;
  }
  next.addEventListener("click", () => {
    if (validateStep(current)) show(current + 1);
  });
  prev.addEventListener("click", () => show(current - 1));
  form.addEventListener(
    "submit",
    (e) => {
      for (let i = 0; i < steps.length; i++) {
        if (!validateStep(i)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          show(i);
          return;
        }
      }
    },
    true,
  );
  show(0);
})();
