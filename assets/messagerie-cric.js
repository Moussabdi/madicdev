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
