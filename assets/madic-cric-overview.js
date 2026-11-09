(function () {
  "use strict";
  const ids = [
    "madicServiceTotalCount",
    "madicServiceReceivedCount",
    "cricNotificationsCount",
    "cricMessagesUnreadBadge",
  ];
  let pending = false;
  function refresh() {
    pending = false;
    for (const id of ids) {
      const source = document.getElementById(id),
        target = document.querySelector('[data-madic-stat="' + id + '"]');
      if (!target || !source) continue;
      const value = (source.textContent || "").trim();
      if (value && target.textContent !== value) target.textContent = value;
      if (id === "cricNotificationsCount") {
        const badge = document.querySelector(".madic-top-notification-count");
        if (badge) {
          const count = Number.parseInt(value, 10);
          const show = Number.isFinite(count) && count > 0;
          badge.hidden = !show;
          badge.textContent = show ? (count > 99 ? "99+" : String(count)) : "";
        }
      }
    }
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refresh);
  }
  const sources = ids.map((id) => document.getElementById(id)).filter(Boolean);
  const observer = new MutationObserver(schedule);
  for (const source of sources)
    observer.observe(source, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  schedule();
})();
