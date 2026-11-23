(function () {
  "use strict";
  function apply(lang) {
    lang = lang === "en" ? "en" : "fr";
    document
      .querySelectorAll(".madic-footer [data-fr][data-en]")
      .forEach(function (el) {
        el.textContent = el.getAttribute("data-" + lang);
        if (el.hasAttribute("data-href-" + lang)) {
          el.setAttribute("href", el.getAttribute("data-href-" + lang));
        }
      });
  }
  var lang = "fr";
  try {
    lang =
      new URLSearchParams(location.search).get("lang") ||
      localStorage.getItem("madic-lang") ||
      "fr";
  } catch (e) {}
  apply(lang);
  // Keep footer labels and destination URLs in sync with the page language.
  var observer = new MutationObserver(function () {
    apply(
      document.documentElement.lang.toLowerCase().startsWith("en")
        ? "en"
        : "fr",
    );
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  window.addEventListener("storage", function (e) {
    if (e.key === "madic-lang") apply(e.newValue);
  });
})();
