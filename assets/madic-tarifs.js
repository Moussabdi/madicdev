/* MADIC Tarifs — bilingual page, independent from the shared footer script. */
let tarifsLanguage = 'fr';
try { tarifsLanguage = localStorage.getItem('madic-lang') || localStorage.getItem('madic_language') || 'fr'; } catch (_) {}
if (!['fr', 'en'].includes(tarifsLanguage)) tarifsLanguage = 'fr';
function applyTarifsLanguage(language) {
  tarifsLanguage = language;
  document.documentElement.lang = language === 'en' ? 'en-CA' : 'fr-CA';
  document.querySelectorAll('[data-fr][data-en]').forEach(el => {
    el.textContent = el.getAttribute('data-' + language);
  });
  document.querySelectorAll('[data-title-fr][data-title-en]').forEach(el => {
    el.title = el.getAttribute('data-title-' + language);
  });
  document.querySelectorAll('[data-aria-label-fr][data-aria-label-en]').forEach(el => {
    el.setAttribute('aria-label', el.getAttribute('data-aria-label-' + language));
  });
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = meta.getAttribute('data-' + language);
  document.title = document.querySelector('title').getAttribute('data-' + language);
  document.querySelectorAll('[data-set-lang]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.setLang === language)));
  try { localStorage.setItem('madic-lang', language); localStorage.setItem('madic_language', language); } catch (_) {}
  setBilling(document.getElementById('annual').classList.contains('active'));
  update();
}
document.querySelectorAll('[data-set-lang]').forEach(btn => btn.addEventListener('click', () => applyTarifsLanguage(btn.dataset.setLang)));
const monthly = document.getElementById("monthly"),
        annual = document.getElementById("annual");
      function setBilling(isAnnual) {
        monthly.classList.toggle("active", !isAnnual);
        annual.classList.toggle("active", isAnnual);
        monthly.setAttribute("aria-pressed", String(!isAnnual));
        annual.setAttribute("aria-pressed", String(isAnnual));
        document.getElementById("libre-price").textContent = isAnnual
          ? "358,80 $"
          : "29,90 $";
        document.getElementById("collectif-price").textContent = isAnnual
          ? "718,80 $"
          : "59,90 $";
        document.getElementById("libre-period").textContent = isAnnual
          ? (tarifsLanguage === "en" ? "Per year · $29.90/month" : "Par année · 29,90 $/mois")
          : (tarifsLanguage === "en" ? "Per month" : "Par mois");
        document.getElementById("collectif-period").textContent = isAnnual
          ? (tarifsLanguage === "en" ? "Per year · $59.90/month" : "Par année · 59,90 $/mois")
          : (tarifsLanguage === "en" ? "Per month" : "Par mois");
      }
      monthly.addEventListener("click", () => setBilling(false));
      annual.addEventListener("click", () => setBilling(true));
      const range = document.getElementById("dossiers");
      function update() {
        const n = Number(range.value),
          flex = n * 5.9,
          libre = 29.9;
        document.getElementById("dossier-count").textContent = n;
        document.getElementById("flex-total").textContent = flex.toLocaleString(
          tarifsLanguage === "en" ? "en-CA" : "fr-CA",
          { style: "currency", currency: "CAD" },
        );
        document.getElementById("best-plan").textContent =
          flex < libre ? "Flex" : flex > libre ? "Libre" : (tarifsLanguage === "en" ? "Both" : "Les deux");
        const saving = Math.abs(libre - flex).toLocaleString(tarifsLanguage === "en" ? "en-CA" : "fr-CA", {style:"currency",currency:"CAD"});
        document.getElementById("savings").textContent = flex < libre
          ? (tarifsLanguage === "en" ? `Flex would save you ${saving} per month.` : `Flex vous économiserait ${saving} par mois.`)
          : (tarifsLanguage === "en" ? `Libre would save you ${saving} per month.` : `Libre vous économiserait ${saving} par mois.`);
      }
      range.addEventListener("input", update);
      update();

applyTarifsLanguage(tarifsLanguage);
