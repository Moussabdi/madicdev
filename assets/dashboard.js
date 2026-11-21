(() => {
  "use strict";
  const target =
    "dashboard-client-cric.html" +
    window.location.search +
    window.location.hash;
  window.location.replace(target);
})();
