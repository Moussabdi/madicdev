/* Page-specific bilingual interface; footer source remains shared and unchanged. */
(function () {
  "use strict";
  function setLanguage(language) {
    var lang = language === "en" ? "en" : "fr";
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    document.title = lang === "en" ? "MADIC PORTAIL - RCICs and clients" : "MADIC PORTAIL - CRIC et clients";
    document.querySelectorAll("[data-fr][data-en]").forEach(function (element) {
      element.textContent = element.getAttribute("data-" + lang);
    });
    document.querySelectorAll("[data-aria-fr][data-aria-en]").forEach(function (element) {
      element.setAttribute("aria-label", element.getAttribute("data-aria-" + lang));
    });
    document.querySelectorAll("[data-index-lang]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-index-lang") === lang));
    });
    try { localStorage.setItem("madic-lang", lang); } catch (error) {}
  }
  document.querySelectorAll("[data-index-lang]").forEach(function (button) {
    button.addEventListener("click", function () { setLanguage(button.getAttribute("data-index-lang")); });
  });
  var initial = null;
  try {
    initial = new URLSearchParams(window.location.search).get("lang");
    if (initial !== "fr" && initial !== "en") initial = localStorage.getItem("madic-lang");
  } catch (error) {}
  setLanguage(initial);
})();
