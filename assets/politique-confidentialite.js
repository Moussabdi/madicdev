(function () {
  "use strict";
  var buttons = {
    fr: document.getElementById("fr"),
    en: document.getElementById("en"),
  };
  var footerButtons = {
    fr: document.getElementById("footer-fr"),
    en: document.getElementById("footer-en"),
  };
  function setLanguage(lang) {
    lang = lang === "en" ? "en" : "fr";
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    document.title =
      (lang === "en" ? "Privacy Policy" : "Politique de confidentialité") +
      " | MADIC";
    document.querySelectorAll("[data-lang]").forEach(function (el) {
      el.hidden = el.getAttribute("data-lang") !== lang;
    });
    document.querySelectorAll("[data-fr][data-en]").forEach(function (el) {
      el.textContent = el.getAttribute("data-" + lang);
    });
    Object.keys(buttons).forEach(function (key) {
      buttons[key].setAttribute("aria-pressed", String(key === lang));
      if (footerButtons[key]) footerButtons[key].setAttribute("aria-pressed", String(key === lang));
    });
    try {
      localStorage.setItem("madic-lang", lang);
    } catch (e) {}
    if (
      location.hash &&
      location.hash.startsWith("#" + (lang === "en" ? "fr" : "en") + "-")
    )
      history.replaceState(null, "", location.pathname + location.search);
  }
  buttons.fr.addEventListener("click", function () {
    setLanguage("fr");
  });
  buttons.en.addEventListener("click", function () {
    setLanguage("en");
  });
  if (footerButtons.fr) footerButtons.fr.addEventListener("click", function () {
    setLanguage("fr");
  });
  if (footerButtons.en) footerButtons.en.addEventListener("click", function () {
    setLanguage("en");
  });
  var lang = new URLSearchParams(location.search).get("lang");
  if (lang !== "fr" && lang !== "en") {
    try {
      lang = localStorage.getItem("madic-lang");
    } catch (e) {}
  }
  setLanguage(lang === "en" ? "en" : "fr");
})();
