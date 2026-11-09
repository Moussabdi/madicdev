/* Navigation uniquement : ne modifie ni les champs ni la logique Supabase */
(() => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  if (!form) return;
  const steps = [...form.querySelectorAll("fieldset")];
  if (!steps.length) return;
  const prev = document.getElementById("madic-step-prev"),
    next = document.getElementById("madic-step-next");
  const label = document.getElementById("madic-step-label"),
    count = document.getElementById("madic-step-count"),
    fill = document.getElementById("madic-progress-fill");
  const last = steps[steps.length - 1];
  /* Le consentement, la ville et le bouton Soumettre restent visibles à la dernière étape. */
  const extras = [
    ...form.querySelectorAll(".madic-signature-place,.txt-right"),
  ];
  let current = 0;
  /* L'etape courante est partagee avec la sauvegarde Supabase. */
  form.addEventListener("madic:restore-step", (e) =>
    show(Number(e.detail?.step) || 0),
  );
  function show(i) {
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, k) => {
      s.classList.toggle("madic-step-inactive", k !== current);
    });
    extras.forEach((el) =>
      el.classList.toggle("madic-step-inactive", current !== steps.length - 1),
    );
    prev.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    label.textContent =
      steps[current]
        .querySelector("legend")
        ?.textContent.trim()
        .replace(/\s+/g, " ") || `Section ${current + 1}`;
    count.textContent = `${current + 1} / ${steps.length}`;
    fill.style.width = `${(100 * (current + 1)) / steps.length}%`;
    form.dataset.madicCurrentStep = String(current);
    form.dispatchEvent(
      new CustomEvent("madic:step-change", { detail: { step: current } }),
    );
    document
      .querySelector(".madic-steps")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function validate(i) {
    for (const field of steps[i].querySelectorAll("input,select,textarea")) {
      if (field.disabled || field.type === "hidden") continue;
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }
  next?.addEventListener("click", () => {
    if (validate(current)) show(current + 1);
  });
  prev?.addEventListener("click", () => show(current - 1));
  /* Pour les champs invalides d'autres étapes, les rendre visibles avant soumission. */
  form.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest('[type="submit"]')) return;
      for (let i = 0; i < steps.length; i++) {
        if (!validate(i)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          show(i);
          const invalid = steps[i].querySelector(":invalid");
          invalid?.focus();
          return;
        }
      }
    },
    true,
  );
  show(0);
})();
