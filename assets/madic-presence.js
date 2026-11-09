/* MADIC Presence v2 : canal partagé par cabinet, diagnostic explicite. */
(() => {
  "use strict";
  let clientChannel = null;
  let clientVersion = 0;
  const badge = () => document.getElementById("madicConsultantPresence");
  function display(state, detail = "") {
    const el = badge();
    if (!el) return;
    el.classList.remove(
      "madic-presence--online",
      "madic-presence--offline",
      "madic-presence--unknown",
    );
    el.classList.add("madic-presence--" + state);
    const text = el.querySelector(".madic-presence-label");
    if (text)
      text.textContent = {
        online: "Consultant en ligne",
        offline: "Consultant hors ligne",
        unknown: "Présence du consultant indisponible",
      }[state];
    el.title = detail;
  }
  function channel(db, spaceId, key) {
    if (!db || !/^[a-f0-9-]{36}$/i.test(String(spaceId || ""))) return null;
    return db.channel("madic-cric-presence:" + spaceId, {
      config: { presence: { key } },
    });
  }
  function watchClient(db, spaceId) {
    clientVersion++;
    const version = clientVersion;
    if (clientChannel) {
      void db.removeChannel(clientChannel);
      clientChannel = null;
    }
    display("unknown", "Connexion au service de présence...");
    const ch = channel(
      db,
      spaceId,
      "client-" + Math.random().toString(36).slice(2),
    );
    if (!ch) {
      console.warn(
        "[MADIC Presence] Identifiant de cabinet invalide côté client.",
      );
      return;
    }
    clientChannel = ch;
    let subscribed = false,
      synced = false;
    function sync() {
      if (version !== clientVersion) return;
      synced = true;
      const peers = Object.values(ch.presenceState()).flat();
      display(
        peers.some((p) => p?.role === "consultant") ? "online" : "offline",
      );
    }
    ch.on("presence", { event: "sync" }, sync).subscribe((state, err) => {
      if (version !== clientVersion) return;
      console.info("[MADIC Presence] Client canal:", state, err || "");
      if (state === "SUBSCRIBED") {
        subscribed = true; /* attendre la synchronisation initiale */
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state))
        display("unknown", err?.message || state);
    });
    window.setTimeout(() => {
      if (version === clientVersion && (!subscribed || !synced))
        display("unknown", "Synchronisation Realtime non confirmée");
    }, 10000);
  }
  function publishConsultant(db, spaceId, userId) {
    if (!userId) return;
    const ch = channel(
      db,
      spaceId,
      "consultant-" + userId + "-" + Math.random().toString(36).slice(2),
    );
    if (!ch) {
      console.warn(
        "[MADIC Presence] Identifiant de cabinet invalide côté CRIC.",
      );
      return;
    }
    ch.subscribe(async (state, err) => {
      console.info("[MADIC Presence] CRIC canal:", state, err || "");
      if (state === "SUBSCRIBED") {
        try {
          const result = await ch.track({
            role: "consultant",
            user_id: userId,
            since: new Date().toISOString(),
          });
          if (result !== "ok")
            console.error(
              "[MADIC Presence] Échec de publication track():",
              result,
            );
          else console.info("[MADIC Presence] CRIC présence publiée.");
        } catch (e) {
          console.error("[MADIC Presence] Erreur track():", e);
        }
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state))
        console.error("[MADIC Presence] Canal CRIC indisponible:", state, err);
    });
    window.addEventListener(
      "pagehide",
      () => {
        void db.removeChannel(ch);
      },
      { once: true },
    );
  }
  window.MADICPresence = { watchClient, publishConsultant };
})();
