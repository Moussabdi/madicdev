/* SOURCE: madic-presence(2).js */
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

;
/* SOURCE: messagerie-cric(3).js */
/* MADIC 7.2 : interface CRIC. La sécurité des données repose sur RLS Supabase. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = (text) => {
    $("msgStatus").textContent = text;
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    typeof window.getMadicSupabase !== "function"
  )
    return status("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let spaceId,
    currentId = null,
    currentUser,
    clients = new Map(),
    conversations = [];
  const date = (value) =>
    new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(value));
  const readMarked = new Map();
  function clientName(id) {
    return clients.get(id) || "Client " + id.slice(0, 8);
  }
  // Recherche locale : ne modifie ni les conversations ni les permissions RLS.
  let searchTerm = "";
  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-CA")
      .trim();
  function installSearch() {
    const list = $("msgConversations");
    const label = document.createElement("label");
    label.htmlFor = "msgConversationSearch";
    label.textContent = "Rechercher une conversation";
    const input = document.createElement("input");
    input.id = "msgConversationSearch";
    input.type = "search";
    input.placeholder = "Nom du client ou objet…";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      searchTerm = normalize(input.value);
      renderConversations();
    });
    list.before(label, input);
  }
  // Groupement visuel par client, sans modification des donnees Supabase.
  const expandedClients = new Set();
  const lastMessageByConversation = new Map();
  let previewRequest = 0;
  const unreadByConversation = new Map();
  let unreadTotal = 0;
  function updateUnreadHeader() {
    const heading = $("msgConversations")
      ?.closest("section")
      ?.querySelector("h2");
    if (!heading) return;
    let badge = $("msgUnreadCount");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "msgUnreadCount";
      badge.className = "madic-client-msg-badge";
      badge.style.marginLeft = "0.5rem";
      heading.append(badge);
    }
    badge.textContent = String(unreadTotal);
    badge.hidden = unreadTotal === 0;
    badge.setAttribute("aria-label", unreadTotal + " messages non lus");
  }
  async function loadUnreadCounts(ids) {
    const request = ++unreadRequest;
    const counts = new Map();
    if (ids.length) {
      // Respecte les RLS et le suivi de lecture deja utilise par les deux interfaces.
      const { data: readRows, error: readError } = await db
        .from("madic_cric_message_reads")
        .select("conversation_id,last_read_at")
        .eq("user_id", currentUser)
        .in("conversation_id", ids);
      if (readError) throw readError;
      const reads = new Map(
        (readRows || []).map((r) => [r.conversation_id, r.last_read_at]),
      );
      for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30);
        const { data, error } = await db
          .from("madic_cric_messages")
          .select("conversation_id,sender_id,created_at")
          .in("conversation_id", chunk)
          .order("created_at", { ascending: false })
          .limit(1000);
        if (error) throw error;
        for (const m of data || []) {
          if (m.sender_id === currentUser) continue;
          const readAt = reads.get(m.conversation_id);
          if (!readAt || Date.parse(m.created_at) > Date.parse(readAt))
            counts.set(
              m.conversation_id,
              (counts.get(m.conversation_id) || 0) + 1,
            );
        }
      }
    }
    if (request !== unreadRequest) return;
    unreadByConversation.clear();
    for (const [id, count] of counts) unreadByConversation.set(id, count);
    unreadTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
    updateUnreadHeader();
    renderConversations();
  }
  let unreadRequest = 0;
  function previewText(body) {
    const clean = String(body || "")
      .replace(/\s+/g, " ")
      .trim();
    return clean.length > 95 ? clean.slice(0, 92) + "…" : clean;
  }
  async function loadConversationPreviews(ids) {
    const request = ++previewRequest;
    const result = new Map();
    // Read only. Supabase RLS remains in force; no additional rights are granted.
    // Limit request size; the list itself remains usable if previews are unavailable.
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const { data, error } = await db
        .from("madic_cric_messages")
        .select("conversation_id,body,created_at")
        .in("conversation_id", chunk)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      for (const message of data || []) {
        if (!result.has(message.conversation_id))
          result.set(message.conversation_id, message);
      }
    }
    if (request !== previewRequest) return;
    lastMessageByConversation.clear();
    for (const [id, message] of result)
      lastMessageByConversation.set(id, message);
    renderConversations();
  }
  function activityTime(conversation) {
    const last = lastMessageByConversation.get(conversation.id);
    return Date.parse(last?.created_at || conversation.created_at) || 0;
  }
  function renderConversations() {
    const list = $("msgConversations");
    list.replaceChildren();
    const visible = conversations
      .filter(
        (c) =>
          !searchTerm ||
          normalize(clientName(c.client_id) + " " + c.subject).includes(
            searchTerm,
          ),
      )
      .sort(
        (a, b) =>
          activityTime(b) - activityTime(a) ||
          b.created_at.localeCompare(a.created_at),
      );
    const groups = new Map();
    for (const c of visible) {
      if (!groups.has(c.client_id)) groups.set(c.client_id, []);
      groups.get(c.client_id).push(c);
    }
    for (const [clientId, entries] of groups) {
      const li = document.createElement("li");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "madic-client-group-toggle";
      const expanded =
        searchTerm !== "" ||
        expandedClients.has(clientId) ||
        entries.some((c) => c.id === currentId);
      toggle.setAttribute("aria-expanded", String(expanded));
      const groupUnread = entries.reduce(
        (sum, c) => sum + (unreadByConversation.get(c.id) || 0),
        0,
      );
      const groupTitle = (state) =>
        (state ? "▾ " : "▸ ") +
        clientName(clientId) +
        " (" +
        entries.length +
        " conversation" +
        (entries.length > 1 ? "s" : "") +
        (groupUnread
          ? " · " + groupUnread + " non lu" + (groupUnread > 1 ? "s" : "")
          : "") +
        ")";
      toggle.textContent = groupTitle(expanded);
      const sublist = document.createElement("ul");
      sublist.hidden = !expanded;
      sublist.style.marginLeft = "1rem";
      toggle.addEventListener("click", () => {
        const next = toggle.getAttribute("aria-expanded") !== "true";
        if (next) expandedClients.add(clientId);
        else expandedClients.delete(clientId);
        sublist.hidden = !next;
        toggle.setAttribute("aria-expanded", String(next));
        toggle.textContent = groupTitle(next);
      });
      for (const c of entries) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const small = document.createElement("small");
        button.type = "button";
        button.dataset.conversationId = c.id;
        button.setAttribute("aria-current", String(c.id === currentId));
        const count = unreadByConversation.get(c.id) || 0;
        button.textContent =
          c.subject +
          (count
            ? " (" + count + " non lu" + (count > 1 ? "s" : "") + ")"
            : "");
        const last = lastMessageByConversation.get(c.id);
        small.textContent = last
          ? "Dernier message : " + date(last.created_at)
          : "Créée : " + date(c.created_at);
        button.append(small);
        if (last) {
          const preview = document.createElement("small");
          preview.textContent =
            previewText(last.body) || "(Message sans texte)";
          preview.style.display = "block";
          preview.style.opacity = "0.8";
          button.append(preview);
        }
        button.addEventListener("click", () => {
          expandedClients.add(clientId);
          openConversation(c.id).catch(showError);
        });
        item.append(button);
        sublist.append(item);
      }
      li.append(toggle, sublist);
      list.append(li);
    }
    if (!visible.length) {
      const li = document.createElement("li");
      li.textContent = conversations.length
        ? "Aucune conversation ne correspond à votre recherche."
        : "Aucune conversation pour le moment.";
      list.append(li);
    }
  }
  async function loadConversations() {
    const { data, error } = await db
      .from("madic_cric_conversations")
      .select("id,space_id,client_id,subject,created_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    conversations = data || [];
    renderConversations();
    // Do not delay or interrupt conversation selection while previews load.
    const conversationIds = conversations.map((c) => c.id);
    void loadUnreadCounts(conversationIds).catch((e) => {
      console.warn("Compteurs non lus indisponibles :", e.message);
    });
    void loadConversationPreviews(conversationIds).catch((e) => {
      console.warn("Aperçus des conversations indisponibles :", e.message);
    });
  }
  async function openConversation(id) {
    const c = conversations.find((v) => v.id === id);
    if (!c) throw Error("Conversation introuvable.");
    expandedClients.add(c.client_id);
    currentId = id;
    $("msgCurrentTitle").textContent = c.subject;
    $("msgCurrentClient").textContent = clientName(c.client_id);
    $("msgSendForm").hidden = false;
    await loadMessages();
    await loadConversations();
  }
  async function loadMessages() {
    if (!currentId) return;
    const id = currentId;
    const { data, error } = await db
      .from("madic_cric_messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw error;
    if (currentId !== id) return;
    const area = $("msgMessages");
    area.replaceChildren();
    for (const m of data || []) {
      const box = document.createElement("div"),
        t = document.createElement("time");
      box.className =
        "madic-msg-bubble" +
        (m.sender_id === currentUser ? " madic-msg-own" : "");
      box.textContent = m.body;
      t.dateTime = m.created_at;
      t.textContent =
        (m.sender_id === currentUser ? "Vous" : "Client") +
        " · " +
        date(m.created_at);
      box.append(t);
      area.append(box);
    }
    if (!data?.length)
      area.textContent =
        "Aucun message. Vous pouvez commencer la conversation.";
    area.scrollTop = area.scrollHeight;
    const latestIncoming =
      (data || [])
        .filter((m) => m.sender_id !== currentUser)
        .map((m) => m.created_at)
        .sort()
        .at(-1) || "";
    if (!readMarked.has(id) || latestIncoming > readMarked.get(id)) {
      const { error: readError } = await db
        .from("madic_cric_message_reads")
        .upsert(
          {
            conversation_id: id,
            user_id: currentUser,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "conversation_id,user_id" },
        );
      if (readError)
        console.warn("Lecture non enregistrée :", readError.message);
      else {
        readMarked.set(id, latestIncoming);
        // Mettre a jour les indicateurs apres lecture, sans attendre 10 secondes.
        if (unreadByConversation.has(id)) {
          unreadTotal -= unreadByConversation.get(id);
          unreadByConversation.delete(id);
          updateUnreadHeader();
          renderConversations();
        }
      }
    }
  }
  function showError(err) {
    status("Erreur : " + (err?.message || String(err)));
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion.html");
      return;
    }
    currentUser = auth.user.id;
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,access_status")
      .eq("owner_user_id", currentUser)
      .limit(1);
    if (spaceError) throw spaceError;
    if (!spaces?.length || spaces[0].access_status !== "active")
      throw Error("Aucun cabinet CRIC actif associé à ce compte.");
    spaceId = spaces[0].id;
    if (window.MADICPresence)
      window.MADICPresence.publishConsultant(db, spaceId, currentUser);
    const { data: allowed, error: allowedError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaceId },
    );
    if (allowedError) throw allowedError;
    if (allowed !== true)
      throw Error("Vous n’êtes pas autorisé à gérer cette messagerie.");
    const { data: links, error: linksError } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", spaceId);
    if (linksError) throw linksError;
    const ids = [...new Set((links || []).map((x) => x.client_id))];
    if (ids.length) {
      const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", ids);
      if (profilesError)
        console.warn("Profils indisponibles :", profilesError.message);
      for (const p of profiles || []) {
        const full = [p.first_name, p.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        clients.set(p.id, full || p.email || "Client " + p.id.slice(0, 8));
      }
    }
    for (const id of ids) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = clientName(id);
      $("msgClient").append(opt);
    }
    $("msgApp").hidden = false;
    status("Messagerie du cabinet chargée.");
    installSearch();
    updateUnreadHeader();
    await loadConversations();
    $("msgRefresh").addEventListener("click", async () => {
      try {
        await loadConversations();
        await loadMessages();
        status("Conversations actualisées.");
      } catch (e) {
        showError(e);
      }
    });
    let creatingConversation = false;
    $("msgNewForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (creatingConversation) return;
      const clientId = $("msgClient").value;
      const subject = $("msgSubject").value.trim();
      if (!clients.has(clientId) || !subject)
        return status("Sélectionnez un client et un objet.");
      creatingConversation = true;
      const button = $("msgNewForm").querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        // Recherche côté serveur pour ce client : ne dépend pas de la liste des 200 dernières conversations.
        const { data: rows, error: lookupError } = await db
          .from("madic_cric_conversations")
          .select("id,subject,created_at")
          .eq("space_id", spaceId)
          .eq("client_id", clientId)
          .order("created_at", { ascending: true })
          .limit(1000);
        if (lookupError) throw lookupError;
        const existing = (rows || []).find(
          (c) => normalize(c.subject) === normalize(subject),
        );
        if (existing) {
          // Une conversation historique doit pouvoir être ouverte même si elle est hors du top 200.
          await loadConversations();
          if (!conversations.some((c) => c.id === existing.id)) {
            conversations.unshift({
              id: existing.id,
              space_id: spaceId,
              client_id: clientId,
              subject: existing.subject,
              created_at: existing.created_at,
            });
            renderConversations();
          }
          await openConversation(existing.id);
          status("Conversation existante ouverte. Aucun doublon créé.");
        } else {
          const { data, error } = await db
            .from("madic_cric_conversations")
            .insert({ space_id: spaceId, client_id: clientId, subject })
            .select("id")
            .single();
          if (error) throw error;
          await loadConversations();
          await openConversation(data.id);
          status("Conversation créée.");
        }
      } catch (e) {
        showError(e);
      } finally {
        creatingConversation = false;
        if (button) button.disabled = false;
      }
    });
    $("msgSendForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = $("msgBody").value.trim();
      if (!currentId || !body) return;
      const button = $("msgSend");
      button.disabled = true;
      try {
        const { error } = await db
          .from("madic_cric_messages")
          .insert({ conversation_id: currentId, body });
        if (error) throw error;
        $("msgBody").value = "";
        await loadMessages();
        status("Message envoyé.");
      } catch (e) {
        showError(e);
      } finally {
        button.disabled = false;
      }
    });

    // MADIC 7.6 : actualisation automatique du consultant toutes les 10 secondes.
    // Les requêtes restent soumises aux politiques RLS Supabase existantes.
    let automaticRefreshRunning = false;
    const refreshIndicator = document.createElement("small");
    refreshIndicator.id = "msgAutoRefreshState";
    refreshIndicator.setAttribute("role", "status");
    refreshIndicator.style.display = "block";
    refreshIndicator.style.marginTop = "0.5rem";
    $("msgRefresh").insertAdjacentElement("afterend", refreshIndicator);
    const refreshLabel = (value) => {
      refreshIndicator.textContent = value;
    };
    async function automaticRefresh() {
      if (automaticRefreshRunning) return;
      automaticRefreshRunning = true;
      try {
        await loadConversations();
        // Ne pas marquer comme lus des messages que le consultant n'a pas vus.
        if (currentId && !document.hidden) await loadMessages();
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
        automaticRefreshRunning = false;
      }
    }
    refreshLabel("Actualisation automatique activée (10 secondes).");
    window.setInterval(() => {
      void automaticRefresh();
    }, 10000);
    void automaticRefresh();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void automaticRefresh();
    });
    window.addEventListener("pageshow", () => {
      void automaticRefresh();
    });
  } catch (err) {
    showError(err);
  }
})();

;
/* SOURCE: madic-messagerie-pieces-jointes(5).js */
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

;
/* SOURCE: madic-footer(20261111-014349).js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();

;
/* SOURCE: madic-datahubz-unified(20261111-014359).js */
/* MADIC : navigation CRIC uniforme. Icones Heroicons identiques au tableau de bord. */
(() => {
  "use strict";
  const init = () => {
    const sidebar = document.querySelector(".madic-unified-sidebar");
    if (!sidebar || !sidebar.querySelector(".madic-unified-brand small")?.textContent.includes("Espace professionnel")) return;
    const nav = sidebar.querySelector("nav");
    if (!nav) return;
    const iconBase = "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/";
    const items = [
      ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2", ""],
      ["gestion-clients-cric.html", "Clients", "users", "madic-v2-group-start"],
      ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open", ""],
      ["messagerie-cric.html", "Messagerie", "chat-bubble-left-right", "madic-v2-group-start"],
      ["rendez-vous-cric.html", "Rendez-vous", "calendar-days", ""],
      ["demandes-documents-cric.html", "Documents", "document-text", ""],
      ["echeances-cric.html", "Échéances", "calendar-days", ""],
      ["facturation-cric.html", "Facturation", "receipt-percent", "madic-v2-group-start"],
      ["finances-cric.html", "Finances", "banknotes", ""],
      ["profil-professionnel-cric.html", "Mon profil professionnel", "identification", ""]
    ];
    const current = (location.pathname.split("/").pop() || "cric-dashboard").replace(/\.html$/, "") + ".html";
    const fragment = document.createDocumentFragment();
    for (const [href, label, iconName, group] of items) {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.madicPage = href;
      if (group) link.className = group;
      if (current === href) link.setAttribute("aria-current", "page");
      const holder = document.createElement("span");
      holder.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.className = "madic-heroicon";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "eager";
      img.decoding = "async";
      img.src = iconBase + iconName + ".svg";
      holder.appendChild(img);
      link.append(holder, document.createTextNode(label));
      fragment.appendChild(link);
    }
    nav.replaceChildren(fragment);
    const brand = sidebar.querySelector(".madic-unified-monogram");
    if (brand) {
      const logo = document.createElement("img");
      logo.src = "img/logo-madic.svg";
      logo.alt = "Logo MADIC";
      brand.replaceChildren(logo);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();

;
/* SOURCE: madic-i18n-cric(6).js */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  'use strict';
  const dictionary = {"Espace professionnel":"Professional workspace","NAVIGATION":"NAVIGATION","Vue d’ensemble":"Overview","Clients":"Clients","Outils CRIC":"RCIC tools","Messagerie":"Messages","Rendez-vous":"Appointments","Documents":"Documents","Échéances":"Deadlines","Facturation":"Invoicing","Finances":"Finances","Mon profil professionnel":"My professional profile","Espace sécurisé MADIC":"Secure MADIC workspace","Mon espace":"My workspace","Aller au contenu principal":"Skip to main content","Gestion des clients CRIC":"RCIC client management","Demandes de documents →":"Document requests →","Vérification de votre espace…":"Checking your workspace…","← Retour à mon espace CRIC":"← Back to my RCIC workspace","Déconnexion":"Sign out","Clients associés":"Associated clients","Dans votre espace professionnel":"In your professional workspace","Dossiers associés":"Associated cases","Pour les clients autorisés":"For authorized clients","Résultats de recherche":"Search results","Clients affichés ci-dessous":"Clients shown below","Répertoire des clients":"Client directory","Inviter un client":"Invite a client","Importer une liste":"Import a list","Dossiers CRIC":"RCIC cases","RÉPERTOIRE CLIENTS":"CLIENT DIRECTORY","Uniquement les clients autorisés dans votre espace CRIC.":"Only clients authorized in your RCIC workspace.","Nom":"Name","Courriel":"Email","Téléphone":"Phone","Dossiers":"Cases","Factures":"Invoices","Action":"Action","Actions":"Actions","INVITATIONS INDIVIDUELLES":"INDIVIDUAL INVITATIONS","Inviter un client dans votre cabinet":"Invite a client to your practice","Une invitation privée lie le client exclusivement à votre espace CRIC.":"A private invitation links the client exclusively to your RCIC workspace.","Vérification du profil professionnel…":"Checking professional profile…","Courriel du client":"Client email","Envoyer l’invitation par courriel":"Send invitation by email","Lien personnel (copie de secours)":"Personal link (backup copy)","Copier le lien":"Copy link","Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":"The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.","IMPORTATION GROUPÉE":"BULK IMPORT","Importer des invitations clients (CSV / Excel)":"Import client invitations (CSV / Excel)","Modèle Excel MADIC :":"MADIC Excel template:","Télécharger le modèle Excel à remplir (.xlsx)":"Download the Excel template (.xlsx)","Fichier de clients (colonne courriel ou email obligatoire)":"Client file (email column required)","Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":"Only email addresses are used for invitations. Other columns are not transmitted.","Vérification du profil professionnel avant les invitations…":"Checking professional profile before invitations…","Vérification":"Verification","Résultat":"Result","Confirmer et envoyer les invitations":"Confirm and send invitations","Annuler / effacer":"Cancel / clear","Outils professionnels CRIC":"Professional RCIC tools","ESPACE PROFESSIONNEL CRIC":"RCIC PROFESSIONAL WORKSPACE","Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":"Prepare forms, contracts and analyses using authorized cases in your practice.","CENTRE DE TRAVAIL · CRIC":"RCIC WORKSPACE","Vos dossiers. Vos outils. Un seul espace.":"Your cases. Your tools. One workspace.","Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":"Select a client and their case to prepare professional documents and analyses.","Clients autorisés":"Authorized clients","Associés à votre cabinet":"Associated with your practice","Dossiers accessibles":"Accessible cases","Dans votre espace CRIC":"In your RCIC workspace","Dossier sélectionné":"Selected case","Aucun":"None","Pour préparer les outils":"To prepare tools","Formulaires IRCC":"IRCC forms","Contrats":"Contracts","Analyse préliminaire":"Preliminary analysis","Suivi Kanban des dossiers":"Kanban case tracking","Centre des outils professionnels":"Professional tools center","Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":"Select a client and case to prepare working documents. The consultant must review and approve results before use.","Client associé au cabinet":"Client associated with the practice","Sélectionner un client":"Select a client","Dossier":"Case","Sélectionner un dossier":"Select a case","1. Formulaires IRCC automatisés":"1. Automated IRCC forms","Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":"Prepare information from the client profile. Official PDFs are not generated at this stage.","Formulaire IRCC":"IRCC form","Autre formulaire-à définir":"Other form—to be determined","Préparer la fiche de renseignements":"Prepare information sheet","OUTILS CRIC · GESTION CONTRACTUELLE":"RCIC TOOLS · CONTRACT MANAGEMENT","2. Contrats":"2. Contracts","Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":"Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.","PREMIÈRE CONSULTATION":"INITIAL CONSULTATION","Contrat de consultation initiale":"Initial consultation agreement","Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":"Set out the initial consultation, its purpose, fees and terms of service.","Préparer le contrat":"Prepare contract","MANDAT DE REPRÉSENTATION":"REPRESENTATION MANDATE","Contrat de services professionnels":"Professional services agreement","Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":"Define agreed services, responsibilities, fees and mandate terms.","Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":"Select a client and case above before opening a contract.","Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":"Clauses, fees and signatures must be checked and approved before sending to the client.","3. Résultat de l’analyse préliminaire":"3. Preliminary analysis results","Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":"Draft a provisional professional assessment, without an automatic eligibility decision.","Programme ou voie d’immigration":"Immigration program or pathway","Appréciation préliminaire":"Preliminary assessment","Analyse à compléter":"Analysis pending","Éléments favorables à vérifier":"Favorable factors to verify","Renseignements supplémentaires requis":"Additional information required","Critères potentiellement non satisfaits":"Potentially unmet criteria","Constats et critères examinés":"Findings and criteria reviewed","Documents manquants et prochaines étapes":"Missing documents and next steps","Préparer le compte rendu":"Prepare report","Messagerie sécurisée":"Secure messaging","Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":"Communicate with clients and access conversations and attachments in a secure workspace.","Vérification des autorisations…":"Checking permissions…","Conversations":"Conversations","Client du cabinet":"Practice client","Choisir un client…":"Choose a client…","Objet":"Subject","Nouvelle conversation":"New conversation","Actualiser":"Refresh","Sélectionnez une conversation":"Select a conversation","Votre message":"Your message","Envoyer":"Send","Rendez-vous et consultations":"Appointments and consultations","Gérez vos créneaux et les demandes de vos clients.":"Manage your availability and client requests.","Gestion des clients →":"Client management →","Vérification des accès…":"Checking access…","Publier une disponibilité":"Publish availability","Date de début (heure de Montréal)":"Start date (Montreal time)","Heure de début (heure de Montréal)":"Start time (Montreal time)","Choisir une heure":"Choose a time","Durée de consultation":"Consultation duration","1 heure":"1 hour","2 heures":"2 hours","3 heures":"3 hours","4 heures":"4 hours","5 heures":"5 hours","6 heures":"6 hours","7 heures":"7 hours","8 heures":"8 hours","Fin calculée automatiquement (heure de Montréal)":"Automatically calculated end (Montreal time)","Type de consultation":"Consultation type","Visioconférence":"Video call","En personne":"In person","Lieu ou lien (facultatif)":"Location or link (optional)","Publier le créneau":"Publish time slot","AGENDA PROFESSIONNEL":"PROFESSIONAL CALENDAR","Calendrier des consultations":"Consultation calendar","Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":"View time slots and bookings, then select a day to publish availability.","Aujourd'hui":"Today","Disponible":"Available","Demandé":"Requested","Confirmé":"Confirmed","Fermé":"Closed","Lun":"Mon","Mar":"Tue","Mer":"Wed","Jeu":"Thu","Ven":"Fri","Sam":"Sat","Dim":"Sun","Mes disponibilités":"My availability","Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":"New slots start on the hour. Existing appointments retain their scheduled times.","Début":"Start","Fin":"End","Type":"Type","État":"State","Réservations et demandes":"Bookings and requests","Client":"Client","Statut":"Status","Gestion documentaire du client":"Client document management","← Retour à la gestion des clients":"← Back to client management","Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":"Choose a case, review received files and track requested documents.","Chargement…":"Loading…","Étape 1 · Dossier":"Step 1 · Case","Choisir le client et le dossier":"Choose client and case","+ Demander une nouvelle pièce au client":"+ Request a new document from the client","Cette demande apparaîtra dans l'espace du client.":"This request will appear in the client's workspace.","Document demandé":"Requested document","Instructions":"Instructions","Date limite (facultatif)":"Due date (optional)","Envoyer la demande":"Send request","+ Envoyer un document au client":"+ Send a document to the client","Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":"File to send (PDF, JPG or PNG, 10 MB maximum)","Nom du document (facultatif)":"Document name (optional)","Envoyer le document":"Send document","Étape 2 · Vérification":"Step 2 · Review","Documents reçus":"Received documents","Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":"Download and review each document. If rejected, provide a reason visible to the client.","Fichier":"File","Reçu le":"Received on","Évaluation":"Assessment","Motif du refus":"Reason for rejection","Étape 3 · Suivi":"Step 3 · Tracking","Demandes envoyées":"Sent requests","Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":"Requests for the selected case only. Request status is separate from file assessment.","Pièce demandée":"Requested item","Date limite":"Due date","Mettre à jour":"Update","Échéances de mon cabinet":"Practice deadlines","← Mon espace CRIC":"← My RCIC workspace","Échéances et rappels":"Deadlines and reminders","Suivez les dates importantes de vos dossiers et les actions à réaliser.":"Track important case dates and required actions.","Vérification de votre cabinet…":"Checking your practice…","Ajouter une échéance":"Add a deadline","Dossier *":"Case *","Description de l’échéance *":"Deadline description *","Date limite *":"Due date *","Enregistrer l'échéance":"Save deadline","Mes échéances":"My deadlines","Description":"Description","Date":"Date","Situation":"Status","Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":"Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.","Facturation de mon cabinet":"Practice invoicing","Vérification de votre accès…":"Checking your access…","Paiements Stripe Connect":"Stripe Connect payments","Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":"Connect your practice's Stripe account to receive client payments directly.","Vérification de la connexion Stripe…":"Checking Stripe connection…","Connecter mon compte Stripe":"Connect my Stripe account","Créer une facture":"Create an invoice","Client *":"Client *","Dossier (facultatif)":"Case (optional)","Aucun dossier":"No cases","Nom du cabinet *":"Practice name *","Adresse du cabinet":"Practice address","Numéros de taxes (si applicables)":"Tax numbers (if applicable)","Logo du cabinet (PNG ou JPG, max. 100 Ko)":"Practice logo (PNG or JPG, max. 100 KB)","Lignes de facturation":"Invoice line items","Quantité":"Quantity","Prix unitaire (CAD)":"Unit price (CAD)","Montant":"Amount","+ Ajouter une ligne":"+ Add a line","Sous-total : 0,00 $":"Subtotal: $0.00","Taux total de taxes applicable (%)":"Total applicable tax rate (%)","Date d'échéance":"Due date","Notes":"Notes","Créer la facture":"Create invoice","Mes factures":"My invoices","Numéro":"Number","Émission":"Issued","Total":"Total","Payé":"Paid","Gestion financière CRIC":"RCIC financial management","Gestion financière du cabinet CRIC":"RCIC practice financial management","Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":"Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports","Cabinet :":"Practice:","Non sélectionné":"Not selected","Initialisation…":"Initializing…","Retour à mon espace professionnel CRIC":"Back to my RCIC professional workspace","Temps et honoraires":"Time and fees","Ces renseignements identifient votre cabinet dans les invitations à vos clients.":"This information identifies your practice in client invitations.","Renseignements du cabinet":"Practice information","Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":"Fields marked with an asterisk are required. Your information is saved in your professional workspace.","Nom déclaré à l’inscription CRIC":"Name provided during RCIC registration","Courriel professionnel déclaré à l’inscription":"Professional email provided during registration","Prénom *":"First name *","Nom *":"Last name *","Titre professionnel *":"Professional title *","Numéro de permis CRIC *":"RCIC licence number *","Nom de l’entreprise *":"Business name *","Site Web de l’entreprise (facultatif)":"Business website (optional)","Téléphone professionnel *":"Business phone *","Adresse professionnelle du cabinet":"Professional practice address","Numéro civique *":"Street number *","Rue *":"Street *","Bureau, suite ou local (facultatif)":"Office, suite or unit (optional)","Ville *":"City *","Province, État ou district *":"Province, state or district *","Code postal (facultatif)":"Postal code (optional)","Pays *":"Country *","Sélectionner un pays":"Select a country","Enregistrer":"Save","Annuler":"Cancel","Fermer":"Close","Continuer":"Continue","Confirmer":"Confirm","Refuser":"Decline","Supprimer":"Delete","Modifier":"Edit","Voir":"View","Télécharger":"Download","En attente":"Pending","Annulé":"Cancelled","Annulée":"Cancelled","Accepté":"Accepted","Acceptée":"Accepted","Rejeté":"Rejected","Rejetée":"Rejected","Validé":"Approved","Validée":"Approved","Approuvé":"Approved","Approuvée":"Approved","Oui":"Yes","Non":"No","Aucun résultat":"No results","Aucune donnée":"No data","Aucun client":"No clients","Aucun rendez-vous":"No appointments","En cours":"In progress","Terminé":"Completed","Terminée":"Completed","Envoyé":"Sent","Envoyée":"Sent","Brouillon":"Draft","Enregistrer les modifications":"Save changes","Profil mis à jour":"Profile updated","© MAD Immigration Canadienne · Portail sécurisé":"© MAD Immigration Canadienne · Secure portal","© MADIC · Plateforme professionnelle":"© MADIC · Professional platform","Île de l’Ascension":"Ascension Island","Andorre":"Andorra","Émirats arabes unis":"United Arab Emirates","Afghanistan":"Afghanistan","Antigua-et-Barbuda":"Antigua & Barbuda","Anguilla":"Anguilla","Albanie":"Albania","Arménie":"Armenia","Angola":"Angola","Antarctique":"Antarctica","Argentine":"Argentina","Samoa américaines":"American Samoa","Autriche":"Austria","Australie":"Australia","Aruba":"Aruba","Îles Åland":"Åland Islands","Azerbaïdjan":"Azerbaijan","Bosnie-Herzégovine":"Bosnia & Herzegovina","Barbade":"Barbados","Bangladesh":"Bangladesh","Belgique":"Belgium","Burkina Faso":"Burkina Faso","Bulgarie":"Bulgaria","Bahreïn":"Bahrain","Burundi":"Burundi","Bénin":"Benin","Saint-Barthélemy":"St. Barthélemy","Bermudes":"Bermuda","Brunei":"Brunei","Bolivie":"Bolivia","Pays-Bas caribéens":"Caribbean Netherlands","Brésil":"Brazil","Bahamas":"Bahamas","Bhoutan":"Bhutan","Île Bouvet":"Bouvet Island","Botswana":"Botswana","Biélorussie":"Belarus","Belize":"Belize","Canada":"Canada","Îles Cocos":"Cocos (Keeling) Islands","Congo-Kinshasa":"Congo - Kinshasa","République centrafricaine":"Central African Republic","Congo-Brazzaville":"Congo - Brazzaville","Suisse":"Switzerland","Côte d’Ivoire":"Côte d’Ivoire","Îles Cook":"Cook Islands","Chili":"Chile","Cameroun":"Cameroon","Chine":"China","Colombie":"Colombia","Île Clipperton":"Clipperton Island","Costa Rica":"Costa Rica","Cuba":"Cuba","Cap-Vert":"Cape Verde","Curaçao":"Curaçao","Île Christmas":"Christmas Island","Chypre":"Cyprus","Tchéquie":"Czechia","Allemagne":"Germany","Diego Garcia":"Diego Garcia","Djibouti":"Djibouti","Danemark":"Denmark","Dominique":"Dominica","République dominicaine":"Dominican Republic","Algérie":"Algeria","Ceuta et Melilla":"Ceuta & Melilla","Équateur":"Ecuador","Estonie":"Estonia","Égypte":"Egypt","Sahara occidental":"Western Sahara","Érythrée":"Eritrea","Espagne":"Spain","Éthiopie":"Ethiopia","Union européenne":"European Union","zone euro":"Eurozone","Finlande":"Finland","Fidji":"Fiji","Îles Malouines":"Falkland Islands","Micronésie":"Micronesia","Îles Féroé":"Faroe Islands","France":"France","Gabon":"Gabon","Royaume-Uni":"United Kingdom","Grenade":"Grenada","Géorgie":"Georgia","Guyane française":"French Guiana","Guernesey":"Guernsey","Ghana":"Ghana","Gibraltar":"Gibraltar","Groenland":"Greenland","Gambie":"Gambia","Guinée":"Guinea","Guadeloupe":"Guadeloupe","Guinée équatoriale":"Equatorial Guinea","Grèce":"Greece","Géorgie du Sud-et-les Îles Sandwich du Sud":"South Georgia & South Sandwich Islands","Guatemala":"Guatemala","Guam":"Guam","Guinée-Bissau":"Guinea-Bissau","Guyana":"Guyana","R.A.S. chinoise de Hong Kong":"Hong Kong SAR China","Îles Heard-et-MacDonald":"Heard & McDonald Islands","Honduras":"Honduras","Croatie":"Croatia","Haïti":"Haiti","Hongrie":"Hungary","Îles Canaries":"Canary Islands","Indonésie":"Indonesia","Irlande":"Ireland","Israël":"Israel","Île de Man":"Isle of Man","Inde":"India","Territoire britannique de l’océan Indien":"British Indian Ocean Territory","Irak":"Iraq","Iran":"Iran","Islande":"Iceland","Italie":"Italy","Jersey":"Jersey","Jamaïque":"Jamaica","Jordanie":"Jordan","Japon":"Japan","Kenya":"Kenya","Kirghizstan":"Kyrgyzstan","Cambodge":"Cambodia","Kiribati":"Kiribati","Comores":"Comoros","Saint-Christophe-et-Niévès":"St. Kitts & Nevis","Corée du Nord":"North Korea","Corée du Sud":"South Korea","Koweït":"Kuwait","Îles Caïmans":"Cayman Islands","Kazakhstan":"Kazakhstan","Laos":"Laos","Liban":"Lebanon","Sainte-Lucie":"St. Lucia","Liechtenstein":"Liechtenstein","Sri Lanka":"Sri Lanka","Liberia":"Liberia","Lesotho":"Lesotho","Lituanie":"Lithuania","Luxembourg":"Luxembourg","Lettonie":"Latvia","Libye":"Libya","Maroc":"Morocco","Monaco":"Monaco","Moldavie":"Moldova","Monténégro":"Montenegro","Saint-Martin":"St. Martin","Madagascar":"Madagascar","Îles Marshall":"Marshall Islands","Macédoine du Nord":"North Macedonia","Mali":"Mali","Myanmar (Birmanie)":"Myanmar (Burma)","Mongolie":"Mongolia","R.A.S. chinoise de Macao":"Macao SAR China","Îles Mariannes du Nord":"Northern Mariana Islands","Martinique":"Martinique","Mauritanie":"Mauritania","Montserrat":"Montserrat","Malte":"Malta","Maurice":"Mauritius","Maldives":"Maldives","Malawi":"Malawi","Mexique":"Mexico","Malaisie":"Malaysia","Mozambique":"Mozambique","Namibie":"Namibia","Nouvelle-Calédonie":"New Caledonia","Niger":"Niger","Île Norfolk":"Norfolk Island","Nigeria":"Nigeria","Nicaragua":"Nicaragua","Pays-Bas":"Netherlands","Norvège":"Norway","Népal":"Nepal","Nauru":"Nauru","Niue":"Niue","Nouvelle-Zélande":"New Zealand","Oman":"Oman","Panama":"Panama","Pérou":"Peru","Polynésie française":"French Polynesia","Papouasie-Nouvelle-Guinée":"Papua New Guinea","Philippines":"Philippines","Pakistan":"Pakistan","Pologne":"Poland","Saint-Pierre-et-Miquelon":"St. Pierre & Miquelon","Îles Pitcairn":"Pitcairn Islands","Porto Rico":"Puerto Rico","Territoires palestiniens":"Palestinian Territories","Portugal":"Portugal","Palaos":"Palau","Paraguay":"Paraguay","Qatar":"Qatar","régions éloignées de l’Océanie":"Outlying Oceania","La Réunion":"Réunion","Roumanie":"Romania","Serbie":"Serbia","Russie":"Russia","Rwanda":"Rwanda","Arabie saoudite":"Saudi Arabia","Îles Salomon":"Solomon Islands","Seychelles":"Seychelles","Soudan":"Sudan","Suède":"Sweden","Singapour":"Singapore","Sainte-Hélène":"St. Helena","Slovénie":"Slovenia","Svalbard et Jan Mayen":"Svalbard & Jan Mayen","Slovaquie":"Slovakia","Sierra Leone":"Sierra Leone","Saint-Marin":"San Marino","Sénégal":"Senegal","Somalie":"Somalia","Suriname":"Suriname","Soudan du Sud":"South Sudan","Sao Tomé-et-Principe":"São Tomé & Príncipe","Salvador":"El Salvador","Saint-Martin (partie néerlandaise)":"Sint Maarten","Syrie":"Syria","Eswatini":"Eswatini","Tristan da Cunha":"Tristan da Cunha","Îles Turques-et-Caïques":"Turks & Caicos Islands","Tchad":"Chad","Terres australes françaises":"French Southern Territories","Togo":"Togo","Thaïlande":"Thailand","Tadjikistan":"Tajikistan","Tokelau":"Tokelau","Timor oriental":"Timor-Leste","Turkménistan":"Turkmenistan","Tunisie":"Tunisia","Tonga":"Tonga","Turquie":"Türkiye","Trinité-et-Tobago":"Trinidad & Tobago","Tuvalu":"Tuvalu","Taïwan":"Taiwan","Tanzanie":"Tanzania","Ukraine":"Ukraine","Ouganda":"Uganda","Îles mineures éloignées des États-Unis":"U.S. Outlying Islands","Nations Unies":"United Nations","États-Unis":"United States","Uruguay":"Uruguay","Ouzbékistan":"Uzbekistan","État de la Cité du Vatican":"Vatican City","Saint-Vincent-et-les Grenadines":"St. Vincent & Grenadines","Venezuela":"Venezuela","Îles Vierges britanniques":"British Virgin Islands","Îles Vierges des États-Unis":"U.S. Virgin Islands","Viêt Nam":"Vietnam","Vanuatu":"Vanuatu","Wallis-et-Futuna":"Wallis & Futuna","Samoa":"Samoa","pseudo-accents":"Pseudo-Accents","pseudo-bidi":"Pseudo-Bidi","Kosovo":"Kosovo","Yémen":"Yemen","Mayotte":"Mayotte","Afrique du Sud":"South Africa","Zambie":"Zambia","Zimbabwe":"Zimbabwe","région indéterminée":"Unknown Region","Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":"The file will be available in the client workspace under “History and assessments of my documents” for the selected case.","La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":"The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.","Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":"The logo is saved in each new invoice. Select it again for subsequent invoices.","Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":"Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.","Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":"Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.","Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":"Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.","Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":"Complete the fields below. The previous address is retained until you save for the first time.","Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":"Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.","IMM 5476-Recours aux services d’un représentant":"IMM 5476 – Use of a Representative","IMM 0008-Demande générique pour le Canada":"IMM 0008 – Generic Application Form for Canada","IMM 5406-Renseignements additionnels sur la famille":"IMM 5406 – Additional Family Information","IMM 5669-Antécédents / Déclaration":"IMM 5669 – Schedule A: Background / Declaration","Gestion financière CRIC | MADIC":"RCIC financial management | MADIC","Échéances de mon cabinet | MADIC":"My practice deadlines | MADIC","Les modifications de votre profil professionnel ont été enregistrées avec succès.":"Changes to your professional profile have been saved successfully.","Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":"Payments through MADIC Portail are not yet enabled: this option does not collect payments.","Recevez un virement par courriel ou téléphone":"Receive an e-transfer by email or phone","Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":"Choose the payment methods accepted by your practice. They will automatically appear in your contracts.","Courriel ou numéro pour recevoir les virements":"Email address or phone number for e-transfers","Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":"When editing, the saved logo is retained unless you select a new file.","Adresse complète (générée automatiquement)":"Full address (generated automatically)","Vos modifications ne sont enregistrées qu’après confirmation.":"Your changes are only saved after confirmation."};
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.": "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.": "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.": "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.": "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.": "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.": "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.": "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.": "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.": "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    "Fidéicommis": "Trust accounting",
    "Comptabilité": "Accounting",
    "Rapports": "Reports",
    "Paiements": "Payments",
    "Cabinet": "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice."
  });
  const key = 'madic_ui_language';
  let lang = 'fr';
  try { lang = localStorage.getItem(key) === 'en' ? 'en' : 'fr'; } catch (_) {}
  const normalized = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en))) reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ['placeholder', 'title', 'aria-label'];
  const ignored = node => !!node.parentElement?.closest('script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls');
  const patterns = [
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, 'New appointment request - '],
    [/^Dernière vérification automatique\s*:/i, 'Last automatic check:'],
    [/^Documents du dossier\s*:/i, 'Case documents:'],
    [/^Espace professionnel\s*:/i, 'Professional workspace:'],
    [/^Espace de facturation du cabinet\s*:/i, 'Practice invoicing workspace:'],
    [/^Cabinet\s*:/i, 'Practice:'],
    [/^\d+\s+document\(s\) reçu\(s\)\./i, s => s.replace('document(s) reçu(s)', 'document(s) received')],
    [/^\d+\s+échéances?\s*·/i, s => s.replace(/échéances?/, 'deadlines').replace(/dépassée?s?/, 'overdue').replace(/à traiter dans les/, 'due within the').replace(/prochains jours/, 'next days')],
    [/^\d+\s+ligne\(s\) affichée\(s\)\./i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')],
    [/^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')]
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text)) return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === 'en' ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0 ? output : original.slice(0, start) + output + original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current) originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('.madic-lang-controls button[data-lang]')) {
      el.disabled = false;
      el.removeAttribute('aria-disabled');
      el.setAttribute('aria-pressed', String(el.dataset.lang === lang));
      el.classList.toggle('madic-lang-active', el.dataset.lang === lang);
      el.setAttribute('aria-label', el.dataset.lang === 'fr' ? 'Français' : 'English');
      el.title = el.dataset.lang === 'fr' ? 'Français' : 'English';
      return;
    }
    if (ignored({parentElement:el})) return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) { source = {}; originalAttrs.set(el, source); }
    if (!previous) { previous = {}; renderedAttrs.set(el, previous); }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current) source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(translateElement);
    if (observer) observer.observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }
  function selectLanguage(next) {
    if (next !== 'fr' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(key, lang); } catch (_) {}
    render();
    document.dispatchEvent(new CustomEvent('madic:languagechange', {detail:{lang}}));
  }
  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.madic-lang-controls button[data-lang]');
      if (!button) return;
      event.preventDefault();
      selectLanguage(button.dataset.lang);
    }, true);
    observer = new MutationObserver(schedule);
    render();
    window.MadicCricLanguage = {set:selectLanguage, get:()=>lang, refresh:render};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

;(()=>{const init=()=>{const b=document.getElementById('madicMsgLogout');if(!b)return;b.addEventListener('click',async()=>{b.disabled=true;try{if(typeof window.getMadicSupabase==='function'){await window.getMadicSupabase().auth.signOut();}else if(window.supabase&&window.MADIC_CONFIG){const cfg=window.MADIC_CONFIG;const client=window.supabase.createClient(cfg.supabaseUrl||cfg.url,cfg.supabaseAnonKey||cfg.anonKey);await client.auth.signOut();}location.assign('connexion.html');}catch(e){b.disabled=false;alert('Déconnexion impossible : '+(e.message||String(e)));}})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();
