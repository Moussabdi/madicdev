/* MADIC messagerie client : scripts regroupes, ordre original conserve. */
(async function(){
  if (!window.supabase) { await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(new Error("Supabase CDN unavailable"));document.head.appendChild(s);}); }

/* --- madic-presence.js --- */
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


/* --- messagerie-client-cric.js --- */
/* MADIC 7.3 : messagerie du client, accès filtré par les RLS Supabase. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = (value) => {
    $("clientMsgStatus").textContent = value;
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    typeof window.getMadicSupabase !== "function"
  )
    return status("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let uid,
    spaces = [],
    conversations = [],
    selectedId = null;
  const date = (value) =>
    new Intl.DateTimeFormat(document.documentElement.lang === "en-CA" ? "en-CA" : "fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(value));
  const showError = (error) =>
    status("Erreur : " + (error?.message || String(error)));
  const cabinetId = () => $("clientMsgCabinet").value;
  async function loadConversations() {
    const space = cabinetId();
    if (!spaces.some((s) => s.space_id === space))
      throw Error("Cabinet non autorisé.");
    const { data, error } = await db
      .from("madic_cric_conversations")
      .select("id,space_id,client_id,subject,created_at")
      .eq("space_id", space)
      .eq("client_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error)
      throw Error("Lecture des conversations refusée : " + error.message);
    conversations = data || [];
    status("Messagerie du client chargée.");
    const list = $("clientMsgConversations");
    list.replaceChildren();
    let unreadTotal = 0;
    const ids = conversations.map((c) => c.id);
    const counts = new Map();
    const latestMessages = new Map();
    if (ids.length) {
      const [messagesResult, readsResult] = await Promise.all([
        db
          .from("madic_cric_messages")
          .select("conversation_id,sender_id,body,created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("madic_cric_message_reads")
          .select("conversation_id,last_read_at")
          .eq("user_id", uid)
          .in("conversation_id", ids),
      ]);
      if (messagesResult.error) throw messagesResult.error;
      if (readsResult.error) throw readsResult.error;
      const reads = new Map(
        (readsResult.data || []).map((r) => [
          r.conversation_id,
          r.last_read_at,
        ]),
      );
      for (const m of messagesResult.data || []) {
        if (!latestMessages.has(m.conversation_id))
          latestMessages.set(m.conversation_id, m);
        if (
          m.sender_id !== uid &&
          (!reads.has(m.conversation_id) ||
            new Date(m.created_at) > new Date(reads.get(m.conversation_id)))
        )
          counts.set(
            m.conversation_id,
            (counts.get(m.conversation_id) || 0) + 1,
          );
      }
    }
    // La derniere activite determine l'ordre, sans changer les identifiants.
    const sortedConversations = [...conversations].sort((a, b) => {
      const ta =
        new Date(
          latestMessages.get(a.id)?.created_at || a.created_at,
        ).getTime() || 0;
      const tb =
        new Date(
          latestMessages.get(b.id)?.created_at || b.created_at,
        ).getTime() || 0;
      return tb - ta || b.created_at.localeCompare(a.created_at);
    });
    for (const c of sortedConversations) {
      const count = counts.get(c.id) || 0;
      unreadTotal += count;
      const li = document.createElement("li"),
        btn = document.createElement("button"),
        small = document.createElement("small");
      btn.type = "button";
      btn.setAttribute("aria-current", String(c.id === selectedId));
      btn.dataset.conversationId = c.id;
      const subject = document.createElement("span");
      subject.className = "madic-conversation-subject";
      subject.textContent = c.subject;
      btn.append(subject);
      if (count) {
        const unread = document.createElement("span");
        unread.textContent = ` (${count} non lu${count > 1 ? "s" : ""})`;
        btn.append(unread);
      }
      const latest = latestMessages.get(c.id);
      small.textContent = latest
        ? "Dernier message : " + date(latest.created_at)
        : "Conversation créée : " + date(c.created_at);
      btn.append(small);
      if (latest) {
        const preview = document.createElement("span");
        preview.className = "madic-client-msg-preview";
        preview.style.display = "block";
        preview.style.fontSize = "0.85em";
        preview.style.opacity = "0.8";
        preview.textContent =
          (latest.sender_id === uid ? "Vous : " : "Consultant : ") +
          (latest.body || "").replace(/\s+/g, " ").slice(0, 110);
        btn.append(preview);
      }
      btn.addEventListener("click", () =>
        openConversation(c.id).catch(showError),
      );
      li.append(btn);
      list.append(li);
    }
    if (!conversations.length) {
      const li = document.createElement("li");
      li.textContent =
        "Aucune conversation disponible pour ce compte. Si votre consultant en a créé une, contactez-le.";
      list.append(li);
    }
    $("clientMsgUnread").textContent = String(unreadTotal);
    $("clientMsgUnread").hidden = unreadTotal === 0;
    if (selectedId && !conversations.some((c) => c.id === selectedId))
      clearSelection();
  }
  function clearSelection() {
    selectedId = null;
    $("clientMsgTitle").textContent = "Choisissez une conversation";
    $("clientMsgSubject").textContent =
      "Les conversations sont ouvertes par votre consultant.";
    $("clientMsgMessages").replaceChildren();
    $("clientMsgSendForm").hidden = true;
  }
  async function openConversation(id) {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) throw Error("Conversation non disponible.");
    selectedId = id;
    $("clientMsgTitle").textContent = conversation.subject;
    $("clientMsgSubject").textContent = "Conversation avec votre consultant";
    $("clientMsgSendForm").hidden = false;
    await loadMessages();
    await loadConversations();
  }
  async function loadMessages() {
    if (!selectedId) return;
    const id = selectedId;
    const { data, error } = await db
      .from("madic_cric_messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw error;
    if (selectedId !== id) return;
    const history = $("clientMsgMessages");
    history.replaceChildren();
    for (const m of data || []) {
      const bubble = document.createElement("div"),
        time = document.createElement("time");
      bubble.className =
        "madic-client-msg-bubble" +
        (m.sender_id === uid ? " madic-client-msg-own" : "");
      bubble.textContent = m.body;
      time.dateTime = m.created_at;
      time.textContent =
        (m.sender_id === uid ? "Vous" : "Consultant") +
        " · " +
        date(m.created_at);
      bubble.append(time);
      history.append(bubble);
    }
    if (!data?.length)
      history.textContent = "Aucun message dans cette conversation.";
    history.scrollTop = history.scrollHeight;
    const { error: readError } = await db
      .from("madic_cric_message_reads")
      .upsert(
        {
          conversation_id: id,
          user_id: uid,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      );
    if (readError)
      console.warn(
        "MADIC : état de lecture non enregistré :",
        readError.message,
      );
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-client-cric.html");
      return;
    }
    uid = auth.user.id;
    const { data: linked, error: linkError } = await db.rpc(
      "madic_my_cric_client_spaces",
    );
    if (linkError) throw linkError;
    spaces = linked || [];
    if (!spaces.length)
      throw Error("Aucun cabinet CRIC associé à votre compte.");
    for (const s of spaces) {
      const opt = document.createElement("option");
      opt.value = s.space_id;
      opt.textContent = s.space_name;
      $("clientMsgCabinet").append(opt);
    }
    $("clientMsgApp").hidden = false;
    if (window.MADICPresence) window.MADICPresence.watchClient(db, cabinetId());
    await loadConversations();
    // Module 7.5b : actualisation automatique observable et protection contre les requêtes simultanées.
    let refreshing = false;
    let refreshTimer = null;
    const refreshState = $("clientMsgAutoRefreshState");
    const refreshLabel = (message) => {
      if (refreshState) refreshState.textContent = message;
    };
    async function autoRefresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        await loadConversations();
        if (selectedId) {
          await loadMessages();
          await loadConversations();
        }
        refreshLabel(
          "Dernière vérification automatique : " +
            new Date().toLocaleTimeString("fr-CA", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
        );
      } catch (error) {
        refreshLabel(
          "Actualisation automatique en erreur : " +
            (error?.message || String(error)),
        );
        console.warn("MADIC : actualisation automatique indisponible :", error);
      } finally {
        refreshing = false;
      }
    }
    function startAutoRefresh() {
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      refreshLabel("Actualisation automatique activée (10 secondes).");
      refreshTimer = window.setInterval(() => {
        void autoRefresh();
      }, 10000);
    }
    startAutoRefresh();
    void autoRefresh();
    document.addEventListener("visibilitychange", () => {
      void autoRefresh();
    });
    window.addEventListener("pageshow", () => {
      startAutoRefresh();
      void autoRefresh();
    });

    $("clientMsgCabinet").addEventListener("change", () => {
      clearSelection();
      if (window.MADICPresence)
        window.MADICPresence.watchClient(db, cabinetId());
      loadConversations().catch(showError);
    });
    $("clientMsgRefresh").addEventListener("click", async () => {
      try {
        await loadConversations();
        await loadMessages();
        await loadConversations();
        status("Messages actualisés.");
      } catch (e) {
        showError(e);
      }
    });
    $("clientMsgSendForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = $("clientMsgBody").value.trim();
      if (!body || !selectedId) return;
      const button = $("clientMsgSend");
      button.disabled = true;
      try {
        const { error } = await db
          .from("madic_cric_messages")
          .insert({ conversation_id: selectedId, sender_id: uid, body });
        if (error) throw error;
        $("clientMsgBody").value = "";
        await loadMessages();
        await loadConversations();
        status("Réponse envoyée.");
      } catch (e) {
        showError(e);
      } finally {
        button.disabled = false;
      }
    });
  } catch (e) {
    showError(e);
  }
})();


/* --- madic-messagerie-pieces-jointes.js --- */
/* MADIC : pièces jointes des conversations, sans changement aux scripts de messagerie. */
(async () => {
  "use strict";
  const isClient = !!document.getElementById("clientMsgSendForm");
  const prefix = isClient ? "clientMsg" : "msg";
  const form = document.getElementById(prefix + "SendForm");
  const history = document.getElementById(prefix + "Messages");
  if (!form || !history || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const bucket = "madic-message-attachments";
  const maxSize = 10 * 1024 * 1024;
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".pdf,.jpg,.jpeg,.png";
  picker.id = prefix + "AttachmentFile";
  const label = document.createElement("label");
  label.htmlFor = picker.id;
  label.textContent = "Joindre un document (PDF, JPG, PNG - 10 Mo maximum)";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = "Envoyer la pièce jointe";
  upload.className = "secondary";
  const info = document.createElement("small");
  info.setAttribute("role", "status");
  info.setAttribute("aria-live", "polite");
  info.style.display = "block";
  form.append(label, picker, upload, info);
  const section = document.createElement("section");
  section.className = "madic-message-attachments";
  section.style.marginTop = "1rem";
  const title = document.createElement("h3");
  title.textContent = "Pièces jointes de la conversation";
  const list = document.createElement("ul");
  const count = document.createElement("small");
  count.className = "madic-attachment-count";
  count.setAttribute("aria-live", "polite");
  const heading = document.createElement("div");
  heading.className = "madic-attachment-heading";
  heading.append(title, count);
  list.className = "madic-attachment-list";
  section.append(heading, list);
  history.insertAdjacentElement("afterend", section);
  // L'identifiant est porte par le bouton reel, meme lorsque la liste est filtree.
  // Ne jamais deduire une conversation de sa position dans la liste.
  function currentConversation() {
    const listId = isClient ? "clientMsgConversations" : "msgConversations";
    const selected = document.querySelector(
      "#" + listId + ' button[aria-current="true"]',
    );
    return selected?.dataset.conversationId || null;
  }
  function selectedClientName() {
    if (isClient) return null;
    // Le regroupement affiche seulement l'objet dans le bouton de conversation.
    // Le titre du client sélectionné est déjà affiché par le module principal.
    const name = document
      .getElementById("msgCurrentClient")
      ?.textContent?.trim();
    if (name && name !== "Client" && name !== "Sélectionnez un client")
      return name;
    return null;
  }
  function clearAttachments() {
    section.hidden = true;
    list.replaceChildren();
  }
  let busy = false,
    lastId = null;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const id = currentConversation();
      if (id !== lastId) clearAttachments();
      section.hidden = !id;
      if (!id) {
        lastId = null;
        list.replaceChildren();
        return;
      }
      const { data, error } = await db
        .from("madic_cric_message_attachments")
        .select("id,filename,storage_path,size_bytes,created_at,uploader_id")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      if (id !== currentConversation()) {
        clearAttachments();
        return;
      }
      list.replaceChildren();
      count.textContent =
        (data || []).length +
        " document" +
        ((data || []).length === 1 ? "" : "s");
      for (const file of data || []) {
        const li = document.createElement("li");
        li.className = "madic-attachment-item";
        const openButton = document.createElement("button");
        const downloadButton = document.createElement("button");
        openButton.type = downloadButton.type = "button";
        openButton.className = downloadButton.className = "secondary";
        openButton.textContent = "Ouvrir";
        downloadButton.textContent = "Télécharger";
        openButton.classList.add("madic-attachment-open");
        downloadButton.classList.add("madic-attachment-download");
        const sender =
          file.uploader_id === uid
            ? "Vous"
            : isClient
              ? "Consultant CRIC"
              : selectedClientName() || "Client";
        const meta = document.createElement("small");
        meta.textContent =
          "Envoyé par : " +
          sender +
          " · " +
          new Intl.DateTimeFormat("fr-CA", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Toronto",
          }).format(new Date(file.created_at));
        meta.className = "madic-attachment-meta";
        const filename = document.createElement("strong");
        filename.className = "madic-attachment-filename";
        filename.textContent = file.filename;
        const size = document.createElement("small");
        size.className = "madic-attachment-size";
        size.textContent =
          Math.ceil(file.size_bytes / 1024).toLocaleString("fr-CA") + " Ko";
        const icon = document.createElement("span");
        icon.className = "madic-attachment-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = /\.pdf$/i.test(file.filename) ? "PDF" : "IMG";
        const detail = document.createElement("div");
        detail.className = "madic-attachment-detail";
        detail.append(filename, size, meta);
        const buttons = document.createElement("div");
        buttons.className = "madic-attachment-actions";
        buttons.append(openButton, downloadButton);
        async function openAttachment() {
          openButton.disabled = true;
          try {
            const { data: signed, error } = await db.storage
              .from(bucket)
              .createSignedUrl(file.storage_path, 60);
            if (error) throw error;
            if (!signed?.signedUrl)
              throw Error("Lien temporaire indisponible.");
            window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
          } catch (e) {
            info.textContent =
              "Ouverture impossible : " + (e?.message || String(e));
          } finally {
            openButton.disabled = false;
          }
        }
        async function downloadAttachment() {
          downloadButton.disabled = true;
          try {
            // Supabase Storage verifies the current user's permissions before returning bytes.
            const { data: blob, error } = await db.storage
              .from(bucket)
              .download(file.storage_path);
            if (error) throw error;
            if (!blob) throw Error("Fichier indisponible.");
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = (file.filename || "piece-jointe")
              .split(/[\\/]/)
              .pop();
            anchor.style.display = "none";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            info.textContent = "Téléchargement lancé : " + file.filename;
          } catch (e) {
            info.textContent =
              "Téléchargement impossible : " + (e?.message || String(e));
          } finally {
            downloadButton.disabled = false;
          }
        }
        openButton.addEventListener("click", openAttachment);
        downloadButton.addEventListener("click", downloadAttachment);
        li.append(icon, detail, buttons);
        list.append(li);
      }
      if (!data?.length) {
        const li = document.createElement("li");
        li.textContent = "Aucune pièce jointe.";
        list.append(li);
      }
      lastId = id;
    } catch (e) {
      info.textContent = "Pièces jointes : " + (e?.message || String(e));
    } finally {
      busy = false;
    }
  }
  upload.addEventListener("click", async () => {
    const file = picker.files?.[0];
    if (!file) return void (info.textContent = "Sélectionnez un fichier.");
    if (!allowed.has(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name))
      return void (info.textContent = "Format non autorisé.");
    if (file.size > maxSize || !file.size)
      return void (info.textContent =
        "Le fichier doit mesurer entre 1 octet et 10 Mo.");
    upload.disabled = true;
    let path = null;
    try {
      const id = currentConversation();
      if (!id) throw Error("Sélectionnez une conversation.");
      const extension = file.name.split(".").pop().toLowerCase();
      path = id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      if (id !== currentConversation())
        throw Error(
          "La conversation a change pendant le transfert. Verifiez le fichier avant de continuer.",
        );
      const { error: rowError } = await db
        .from("madic_cric_message_attachments")
        .insert({
          conversation_id: id,
          uploader_id: uid,
          filename: file.name.slice(0, 240),
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (rowError) throw rowError;
      picker.value = "";
      info.textContent = "Pièce jointe envoyée.";
      await refresh();
    } catch (e) {
      info.textContent = "Envoi impossible : " + (e?.message || String(e));
    } finally {
      upload.disabled = false;
    }
  });
  section.hidden = true;
  setInterval(() => {
    void refresh();
  }, 10000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "#" +
          (isClient ? "clientMsgConversations" : "msgConversations") +
          " button",
      )
    ) {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    }
  });
  document
    .getElementById("clientMsgCabinet")
    ?.addEventListener("change", () => {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    });
  setTimeout(() => {
    void refresh();
  }, 800);
})();


/* --- madic-client-sidebar.js --- */
/* Préférences locales de navigation : aucun changement des données Supabase. */
(function () {
  const sidebar = document.querySelector(".madic-side-nav");
  const nav = sidebar?.querySelector(".madic-side-links");
  const toggle = document.getElementById("madicCustomizeNav");
  const reset = document.getElementById("madicResetNav");
  const help = document.getElementById("madicNavHelp");
  if (!nav || !toggle || !reset) return;
  const storageKey = "madic-client-nav-order-v2";
  const entries = () => Array.from(nav.querySelectorAll(".madic-nav-entry"));
  const save = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(entries().map((el) => el.dataset.navKey)),
      );
    } catch (_) {}
  };
  try {
    const order = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(order)) {
      const byKey = new Map(entries().map((el) => [el.dataset.navKey, el]));
      order.forEach((key) => {
        if (byKey.has(key)) nav.appendChild(byKey.get(key));
      });
    }
  } catch (_) {}
  toggle.addEventListener("click", () => {
    const editing = sidebar.classList.toggle("madic-editing");
    toggle.setAttribute("aria-pressed", String(editing));
    toggle.textContent = editing ? "Terminer" : "Personnaliser le menu";
    reset.hidden = !editing;
    help.hidden = !editing;
  });
  reset.addEventListener("click", () => {
    entries()
      .sort(
        (a, b) =>
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(a.dataset.navKey) -
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(b.dataset.navKey),
      )
      .forEach((el) => nav.appendChild(el));
    save();
  });
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-move]");
    if (!button) return;
    const item = button.closest(".madic-nav-entry");
    if (button.dataset.move === "up" && item.previousElementSibling)
      nav.insertBefore(item, item.previousElementSibling);
    if (button.dataset.move === "down" && item.nextElementSibling)
      nav.insertBefore(item.nextElementSibling, item);
    save();
    button.focus();
  });
  let dragged = null;
  nav.addEventListener("dragstart", (event) => {
    const handle = event.target.closest(".madic-drag-handle");
    if (!sidebar.classList.contains("madic-editing") || !handle) {
      event.preventDefault();
      return;
    }
    dragged = handle.closest(".madic-nav-entry");
    dragged.classList.add("madic-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged.dataset.navKey);
  });
  nav.addEventListener("dragover", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    entries().forEach((el) => el.classList.remove("madic-drag-over"));
    target.classList.add("madic-drag-over");
  });
  nav.addEventListener("drop", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const after = window.matchMedia("(max-width: 800px)").matches
      ? event.clientX > rect.left + rect.width / 2
      : event.clientY > rect.top + rect.height / 2;
    nav.insertBefore(dragged, after ? target.nextSibling : target);
    save();
  });
  nav.addEventListener("dragend", () => {
    entries().forEach((el) =>
      el.classList.remove("madic-drag-over", "madic-dragging"),
    );
    dragged = null;
  });
})();


/* --- madic-footer.js --- */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* --- inline --- */

      /* Explicit click-only interface translation. No observer, no form value changes. */
      (function () {
        "use strict";
        const dict = {
          Déconnexion: "Sign out",
          Connexion: "Sign in",
          "Mon espace": "My space",
          "MON ESPACE": "MY SPACE",
          "Personnaliser le menu": "Customize menu",
          "Vue d’ensemble": "Overview",
          Actualités: "News",
          "Mon profil": "My profile",
          "Mes contrats": "My contracts",
          Formulaire: "Form",
          Messagerie: "Messaging",
          "Rendez-vous": "Appointments",
          "Mes dossiers": "My cases",
          Documents: "Documents",
          Factures: "Invoices",
          "Espace client sécurisé": "Secure client space",
          "Votre projet, à votre rythme.": "Your project, at your pace.",
          "Consultant hors ligne": "Consultant offline",
          "Consultant en ligne": "Consultant online",
          "Échanges confidentiels avec votre consultant.":
            "Confidential exchanges with your consultant.",
          "Messagerie du client chargée.": "Client messaging loaded.",
          "Conversation générale": "General conversation",
          "Dernière vérification automatique :": "Last automatic check:",
          "Dernier message :": "Last message:",
          "Vous :": "You:",
          "Cabinet CRIC": "RCIC firm",
          Conversations: "Conversations",
          Actualiser: "Refresh",
          "Choisissez une conversation": "Choose a conversation",
          "Les conversations sont ouvertes par votre consultant.":
            "Conversations are opened by your consultant.",
          "Votre réponse": "Your reply",
          "Envoyer ma réponse": "Send my reply",
          "Écrivez votre message…": "Write your message…",
          "Mes rendez-vous et consultations":
            "My appointments and consultations",
          "Notifications de rendez-vous": "Appointment notifications",
          "Marquer comme lue": "Mark as read",
          "Cabinet de consultation": "Consulting firm",
          "Mon consultant": "My consultant",
          "Créneaux disponibles": "Available time slots",
          "Sélectionnez une plage horaire qui vous convient.":
            "Select a suitable time slot.",
          "Semaine suivante →": "Next week →",
          "← Semaine précédente": "← Previous week",
          "Durée du rendez-vous :": "Appointment duration:",
          "Mes réservations": "My bookings",
          "Retrouvez le statut et les détails de vos rendez-vous.":
            "Find the status and details of your appointments.",
          Début: "Start",
          Fin: "End",
          Type: "Type",
          Action: "Action",
          Statut: "Status",
          "Lieu / lien de consultation": "Consultation location / link",
          Annuler: "Cancel",
          "Voir le lien": "View link",
          Confirmé: "Confirmed",
          "En attente de confirmation": "Pending confirmation",
          "Aucun créneau disponible pour le moment.":
            "No time slots available at this time.",
          "Aucun créneau": "No time slots",
          "ÉVALUATION PRÉLIMINAIRE": "PRELIMINARY ASSESSMENT",
          "Parlez-nous de votre projet d’immigration":
            "Tell us about your immigration plans",
          "Déclaration importante": "Important declaration",
          "Informations importante": "Important information",
          "Informations importantes": "Important information",
          Précédent: "Previous",
          Suivant: "Next",
          Soumettre: "Submit",
          "Pays :": "Country:",
          "Ma messagerie sécurisée": "My secure messaging",
          "PORTAIL CLIENT CRIC": "RCIC CLIENT PORTAL",
          "Présence du consultant indisponible": "Consultant presence unavailable",
          "Connexion au service de présence...": "Connecting to presence service...",
          "Synchronisation Realtime non confirmée": "Realtime synchronization not confirmed",
          "← Retour à mon espace": "← Back to my space",
          "Vérification de votre accès…": "Checking your access…",
          "Initialisation de l’actualisation automatique…": "Initializing automatic refresh…",
          "Conversation avec votre consultant": "Conversation with your consultant",
          "Aucun message dans cette conversation.": "No messages in this conversation.",
          "Aucune conversation disponible pour ce compte. Si votre consultant en a créé une, contactez-le.": "No conversations are available for this account. If your consultant has created one, please contact them.",
          "Joindre un document (PDF, JPG, PNG - 10 Mo maximum)": "Attach a document (PDF, JPG, PNG - 10 MB maximum)",
          "Envoyer la pièce jointe": "Send attachment",
          "Pièces jointes de la conversation": "Conversation attachments",
          "Ouvrir": "Open",
          "Télécharger": "Download",
          "Aucune pièce jointe.": "No attachments.",
          "Sélectionnez un fichier.": "Select a file.",
          "Format non autorisé.": "Unsupported file format.",
          "Le fichier doit mesurer entre 1 octet et 10 Mo.": "The file must be between 1 byte and 10 MB.",
          "Sélectionnez une conversation.": "Select a conversation.",
          "Pièce jointe envoyée.": "Attachment sent.",
          "Terminer": "Done",
          "Réinitialiser": "Reset",
          "Glissez les éléments ou utilisez les flèches pour choisir votre ordre.": "Drag items or use the arrows to change their order.",
          "Glisser pour déplacer": "Drag to move",
          "Monter": "Move up",
          "Descendre": "Move down",
          "Aller au contenu principal": "Skip to main content",
          "Outils du compte": "Account tools",
          "Notifications de messagerie": "Message notifications",
          "Navigation de mon espace client": "Client space navigation",
          "Menu personnalisable": "Customizable menu",
          "Logo MADIC Portail": "MADIC Portal logo",
          "Espace client": "Client space",
          "Messagerie du client chargée.": "Client messaging loaded.",
          "Conversation générale": "General conversation",
          "Dernière vérification automatique :": "Last automatic check:",
          "Dernier message :": "Last message:",
          "Vous :": "You:",
          "Configuration Supabase manquante.": "Supabase configuration missing.",
          "Cabinet non autorisé.": "Unauthorized firm.",
          "Conversation non disponible.": "Conversation unavailable.",
          "À envoyer": "To send",
          "Envoyer": "Send",
          "Votre message a été envoyé.": "Your message has been sent.",
          "Envoi en cours…": "Sending…",
          "Actualisation automatique activée.": "Automatic refresh enabled.",
          "Actualisation automatique désactivée.": "Automatic refresh disabled.",
          "Connaissance des langues": "Language proficiency",
          "Niveau de Français :": "French proficiency:",
          "Niveau d’anglais :": "English proficiency:",
          "Choix votre niveau!": "Choose your level!",
          "Choix de votre pays!": "Choose your country!",
          "Choix votre test de compétence!": "Choose your language test!",
          "Expression orale :": "Speaking:",
          "Expression écrite :": "Writing:",
          "Compréhension orale :": "Listening:",
          "Compréhension écrite :": "Reading:",
        };
        const reverse = Object.fromEntries(
          Object.entries(dict).map(([a, b]) => [b, a]),
        );
        const key = "madic_ui_language";
        let lang = "fr";
        try {
          lang = localStorage.getItem(key) === "en" ? "en" : "fr";
        } catch (_) {}
        const slot =
          document.getElementById("madicHeroLanguage") ||
          document.querySelector("header .toplinks");
        if (!slot) return;
        const wrap = document.createElement("div");
        wrap.className = "madic-three-lang";
        wrap.setAttribute("aria-label", "Langue / Language");
        const buttons = {};
        for (const code of ["fr", "en"]) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = code.toUpperCase();
          b.addEventListener("click", () => {
            lang = code;
            try {
              localStorage.setItem(key, code);
            } catch (_) {}
            apply();
          });
          wrap.appendChild(b);
          buttons[code] = b;
        }
        slot.appendChild(wrap);
        // Translate UI text, including status messages inserted after Supabase loads.
        // Never translate conversation subjects, message bodies, or uploaded filenames.
        function protectedContent(el) {
          return !!el?.closest('.madic-client-msg-bubble, .madic-client-msg-preview, .madic-attachment-filename, .madic-conversation-subject');
        }
        function convert(value, map) {
          if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
          if (lang !== 'en') return value;
          const patterns = [
            [/^(\d+) non lus?$/, (_, n) => n + ' unread'],
            [/^Dernière vérification automatique : (.*)$/, (_, t) => 'Last automatic check: ' + t],
            [/^Actualisation automatique en erreur : (.*)$/, (_, e) => 'Automatic refresh error: ' + e],
            [/^Dernier message : (.*)$/, (_, d) => 'Last message: ' + d],
            [/^Conversation créée : (.*)$/, (_, d) => 'Conversation created: ' + d],
            [/^Vous : (.*)$/, (_, body) => 'You: ' + body],
            [/^Consultant : (.*)$/, (_, body) => 'Consultant: ' + body],
            [/^Envoyé par : (.*)$/, (_, rest) => 'Sent by: ' + rest.replace(/^Vous\b/, 'You')],
            [/^(\d+) documents?$/, (_, n) => n + ' document' + (n === '1' ? '' : 's')],
            [/^(\d+) Ko$/, (_, n) => n + ' KB'],
            [/^Pièces jointes : (.*)$/, (_, e) => 'Attachments: ' + e],
            [/^Téléchargement lancé : (.*)$/, (_, f) => 'Download started: ' + f],
            [/^Téléchargement impossible : (.*)$/, (_, e) => 'Download failed: ' + e],
            [/^Ouverture impossible : (.*)$/, (_, e) => 'Unable to open: ' + e],
            [/^Envoi impossible : (.*)$/, (_, e) => 'Unable to send: ' + e],
            [/^Erreur : (.*)$/, (_, e) => 'Error: ' + e],
            [/^Vous · (.*)$/, (_, d) => 'You · ' + d],
          ];
          for (const [pattern, replacement] of patterns) if (pattern.test(value)) return value.replace(pattern, replacement);
          return value;
        }
        function translate() {
          const map = lang === 'en' ? dict : reverse;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
              return n.parentElement && (n.parentElement.closest('script,style,textarea,option,[contenteditable="true"]') || protectedContent(n.parentElement))
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode())) {
            const raw = node.nodeValue, word = raw.trim();
            const translated = convert(word, map);
            if (translated !== word) node.nodeValue = raw.replace(word, translated);
          }
          for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
            if (protectedContent(el)) continue;
            for (const a of ['placeholder', 'aria-label', 'title']) {
              const v = el.getAttribute(a);
              if (v) {
                const translated = convert(v, map);
                if (translated !== v) el.setAttribute(a, translated);
              }
            }
          }
          const title = document.querySelector('title[data-fr][data-en]');
          if (title && title.textContent !== title.getAttribute('data-' + lang)) title.textContent = title.getAttribute('data-' + lang);
        }
        // Dynamic UI strings are generated asynchronously by the messaging and attachment modules.
        let scheduled = false;
        const observer = new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          queueMicrotask(() => { scheduled = false; translate(); });
        });
        observer.observe(document.body, {childList:true, subtree:true, characterData:true});
        function apply() {
          document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
          translate();
          for (const code of ["fr", "en"])
            buttons[code].setAttribute("aria-pressed", String(code === lang));
        }
        apply();
      })();
    

/* --- inline --- */

      /* Navigation and logout only; no observers, no changes to page applications. */
      (function () {
        "use strict";
        var nav = document.querySelector(".madic-side-links");
        var desired = [
          "nav-0",
          "nav-news",
          "nav-7",
          "nav-1",
          "nav-contracts",
          "nav-3",
          "nav-4",
          "nav-5",
          "nav-2",
          "nav-6",
        ];
        if (nav) {
          var nodes = Array.from(
            nav.querySelectorAll(":scope > .madic-nav-entry"),
          );
          var map = new Map(
            nodes.map(function (node) {
              return [node.getAttribute("data-nav-key"), node];
            }),
          );
          desired.forEach(function (key) {
            if (map.has(key)) nav.appendChild(map.get(key));
          });
          try {
            localStorage.setItem(
              "madic-client-nav-order-v2",
              JSON.stringify(desired),
            );
          } catch (_) {}
        }
        var signout = document.getElementById("madicHeaderSignout");
        if (signout)
          signout.addEventListener("click", async function (event) {
            event.preventDefault();
            if (typeof window.getMadicSupabase !== "function") return;
            try {
              await window.getMadicSupabase().auth.signOut();
              window.location.replace("connexion-client-cric.html");
            } catch (error) {
              console.error("MADIC sign out:", error);
            }
          });
      })();
    

})().catch(error => console.error("MADIC messagerie:",error));
