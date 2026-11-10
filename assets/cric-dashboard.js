/* MADIC CRIC dashboard - scripts consolidated, preserving original execution order. */
(function(){
  function start(){

/* Original module: cric-dashboard(20261110-054655).js */
/* MADIC : interface CRIC. Les contrôles d'accès réels sont les politiques RLS et RPC Supabase. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cfg = window.MADIC_CONFIG;
  const fail = (message) => {
    if ($("cricMessage")) $("cricMessage").textContent = message;
  };
  if (!cfg?.url || !cfg?.anonKey || !window.supabase)
    return fail("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion.html");
      return;
    }
    const uid = auth.user.id;
    const { data: isOwner, error: ownerError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (ownerError) throw ownerError;
    $("cricLogout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.href = "connexion.html";
    });
    if ($("cricAdminMain")) {
      if (!isOwner) return fail("Accès réservé au super administrateur MADIC.");
      $("cricAdminMain").hidden = false;
      $("cricMessage").hidden = true;
      const labels = {
        pending: "En attente",
        approved: "Autorisé",
        rejected: "Refusé",
      };
      async function load() {
        const { data, error } = await db
          .from("madic_cric_applications")
          .select(
            "user_id,full_name,license_number,status,professional_email,admin_note,created_at",
          )
          .order("created_at", { ascending: false });
        if (error) throw error;
        const tbody = $("cricRows");
        tbody.replaceChildren();
        if (!data.length) {
          const row = tbody.insertRow();
          row.insertCell().colSpan = 8;
          row.cells[0].textContent = "Aucun CRIC inscrit.";
          return;
        }
        for (const item of data) {
          const row = tbody.insertRow();
          row.insertCell().textContent = item.full_name;
          row.insertCell().textContent = item.license_number;
          row.insertCell().textContent = labels[item.status] || item.status;
          for (let i = 0; i < 4; i++) row.insertCell().textContent = "-";
          const action = row.insertCell();
          if (item.status !== "pending") {
            action.textContent = "Décision enregistrée";
            continue;
          }
          for (const [text, approved] of [
            ["Autoriser", true],
            ["Refuser", false],
          ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "secondary";
            button.textContent = text;
            button.addEventListener("click", async () => {
              if (
                !confirm(
                  `${text} ${item.full_name} (${item.license_number}) ? Vérifiez son permis professionnel au préalable.`,
                )
              )
                return;
              const note = prompt("Note interne (facultative) :");
              if (note === null) return;
              button.disabled = true;
              const { error } = await db.rpc("madic_review_cric", {
                p_user_id: item.user_id,
                p_approve: approved,
                p_note: note,
              });
              if (error) {
                $("cricAdminNotice").textContent = "Erreur : " + error.message;
                button.disabled = false;
                return;
              }
              $("cricAdminNotice").textContent = "Décision enregistrée.";
              try {
                await load();
              } catch (err) {
                $("cricAdminNotice").textContent = err.message;
              }
            });
            action.append(button, document.createTextNode(" "));
          }
        }
      }
      await load();
      return;
    }
    if (!$("cricMain")) return;
    const { data: application, error: appError } = await db
      .from("madic_cric_applications")
      .select("full_name,license_number,status")
      .eq("user_id", uid)
      .maybeSingle();
    if (appError) throw appError;
    if (!isOwner && application?.status !== "approved") {
      return fail(
        application?.status === "pending"
          ? "Votre demande CRIC est en attente de validation."
          : application?.status === "rejected"
            ? "Votre demande CRIC a été refusée."
            : "Aucun compte CRIC autorisé associé à votre session.",
      );
    }
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    const space = spaces?.[0];
    const { data: profile } = await db
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", uid)
      .maybeSingle();
    const fullName = (
      application?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      auth.user.email
    ).trim();
    $("cricWelcome").textContent = "Bienvenue, " + fullName;
    $("cricLicense").textContent =
      "Numéro CRIC : " +
      (application?.license_number || "À renseigner dans votre compte CRIC");
    $("cricSpace").textContent = space
      ? "Espace professionnel : " + space.name
      : "Espace professionnel non configuré";
    $("cricOwnerArea").hidden = !isOwner;
    // Chaque CRIC approuve gere uniquement son espace actif, sous controle RLS/RPC.
    let canManage = false;
    if (
      space &&
      space.access_status === "active" &&
      (isOwner || application?.status === "approved")
    ) {
      const { data: allowed, error: permissionError } = await db.rpc(
        "madic_can_manage_cric_space",
        { p_space_id: space.id },
      );
      if (permissionError) throw permissionError;
      canManage = allowed === true;
    }
    if (canManage) {
      if ($("cricEvaluationsCard")) $("cricEvaluationsCard").hidden = false;
      if ($("cricAppointmentsCard")) $("cricAppointmentsCard").hidden = false;
      if ($("cricMessagingCard")) $("cricMessagingCard").hidden = false;
      $("cricKanbanLink").hidden = false;
      $("cricKanbanPending").hidden = true;
      $("cricDeadlinesLink").hidden = false;
      $("cricDeadlinesPending").hidden = true;
      $("cricInvoicesLink").hidden = false;
      $("cricInvoicesPending").hidden = true;
      $("cricFinancesLink").hidden = false;
      $("cricFinancesPending").hidden = true;
      $("cricClientsLink").href = "gestion-clients-cric.html";
      $("cricDossiersLink").href = "gestion-dossiers-cric.html";
      $("cricClientsLink").hidden = false;
      $("cricDossiersLink").hidden = false;
      $("cricClientsPending").hidden = true;
      $("cricDossiersPending").hidden = true;
    }
    // Compteur des messages entrants non lus, uniquement pour le cabinet autorise.
    // Les controles RLS Supabase restent la source d'autorisation.
    if (canManage && space) {
      const badge = $("cricMessagesUnreadBadge");
      const summary = $("cricMessagesUnreadSummary");
      const refreshMessages = $("cricMessagesRefresh");
      if (badge && summary && refreshMessages) {
        let unreadRefreshRunning = false;
        const loadUnreadMessages = async () => {
          if (unreadRefreshRunning) return;
          unreadRefreshRunning = true;
          refreshMessages.disabled = true;
          try {
            // Pagination pour ne pas omettre les conversations nombreuses.
            const conversations = [];
            for (let offset = 0; ; offset += 500) {
              const result = await db
                .from("madic_cric_conversations")
                .select("id")
                .eq("space_id", space.id)
                .order("id", { ascending: true })
                .range(offset, offset + 499);
              if (result.error) throw result.error;
              const batch = result.data || [];
              conversations.push(...batch);
              if (batch.length < 500) break;
            }
            const ids = conversations.map((c) => c.id);
            const lastReads = new Map();
            for (let offset = 0; offset < ids.length; offset += 100) {
              const chunk = ids.slice(offset, offset + 100);
              const result = await db
                .from("madic_cric_message_reads")
                .select("conversation_id,last_read_at")
                .eq("user_id", uid)
                .in("conversation_id", chunk);
              if (result.error) throw result.error;
              for (const read of result.data || []) {
                lastReads.set(read.conversation_id, read.last_read_at);
              }
            }
            let unread = 0;
            let conversationsWithUnread = 0;
            // Les requetes COUNT sont exactes et evitent une limite arbitraire
            // sur le nombre de messages telecharges dans le navigateur.
            for (const id of ids) {
              let query = db
                .from("madic_cric_messages")
                .select("id", { count: "exact", head: true })
                .eq("conversation_id", id)
                .neq("sender_id", uid);
              const lastRead = lastReads.get(id);
              if (lastRead) query = query.gt("created_at", lastRead);
              const result = await query;
              if (result.error) throw result.error;
              const count = result.count || 0;
              unread += count;
              if (count > 0) conversationsWithUnread++;
            }
            badge.textContent = String(unread);
            badge.hidden = unread === 0;
            summary.textContent = unread
              ? `${unread} message(s) non lu(s) dans ${conversationsWithUnread} conversation(s).`
              : "Aucun nouveau message.";
          } catch (error) {
            badge.hidden = true;
            summary.textContent =
              "Compteur indisponible : " + (error.message || String(error));
          } finally {
            refreshMessages.disabled = false;
            unreadRefreshRunning = false;
          }
        };
        refreshMessages.addEventListener("click", () => {
          void loadUnreadMessages();
        });
        window.addEventListener("focus", () => {
          void loadUnreadMessages();
        });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) void loadUnreadMessages();
        });
        // Evite les requetes en arriere-plan et les actualisations concurrentes.
        window.setInterval(() => {
          if (!document.hidden) void loadUnreadMessages();
        }, 10000);
        await loadUnreadMessages();
      }
    }
    // Notifications des activites clients, limitees au cabinet autorise.
    if (canManage && space) {
      const panel = $("cricNotificationsPanel");
      const summary = $("cricNotificationsSummary");
      const list = $("cricNotificationsList");
      const counter = $("cricNotificationsCount");
      const refresh = $("cricNotificationsRefresh");
      if (panel && summary && list && counter && refresh) {
        panel.hidden = false;
        const loadClientNotifications = async () => {
          refresh.disabled = true;
          try {
            const { data, error } = await db.rpc(
              "madic_cric_notifications_avec_clients",
              { p_space_id: space.id },
            );
            if (error) throw error;
            const notifications = data || [];
            const unread = notifications.filter((n) => !n.is_read).length;
            // Le compteur des clients distincts est calcule par une RPC securisee
            // sur toutes les notifications du cabinet, pas seulement les 50 affichees.
            const { data: uniqueUnread, error: countError } = await db.rpc(
              "madic_cric_clients_connexions_non_lues",
              { p_space_id: space.id },
            );
            if (countError) throw countError;
            const unreadClients = Number(uniqueUnread) || 0;
            counter.textContent = String(unreadClients);
            counter.hidden = unreadClients === 0;
            summary.textContent = notifications.length
              ? `${unreadClients} client(s) distinct(s) avec une connexion non lue. ${unread} notification(s) non lue(s) parmi les ${notifications.length} dernières affichées.`
              : `${unreadClients} client(s) distinct(s) avec une connexion non lue. Aucune notification récente à afficher.`;
            list.replaceChildren();
            for (const notification of notifications) {
              const item = document.createElement("li");
              item.className =
                "madic-cric-notification" +
                (notification.is_read ? "" : " madic-cric-notification-unread");
              const details = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = notification.title || "Activité client";
              const message = document.createElement("p");
              message.textContent = notification.client_name
                ? `${notification.client_name} - ${notification.message || ""}`
                : notification.message || "";
              const date = document.createElement("time");
              date.dateTime = notification.created_at;
              date.textContent = new Intl.DateTimeFormat("fr-CA", {
                timeZone: "America/Toronto",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(notification.created_at));
              details.append(title, message, date);
              item.append(details);
              if (!notification.is_read) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "secondary";
                button.textContent = "Marquer comme lue";
                button.addEventListener("click", async () => {
                  button.disabled = true;
                  try {
                    const { data: marked, error: markError } = await db.rpc(
                      "madic_mark_cric_notification_read",
                      { p_notification_id: notification.id },
                    );
                    if (markError) throw markError;
                    if (marked !== true)
                      throw Error("Notification non autorisée ou introuvable.");
                    await loadClientNotifications();
                  } catch (err) {
                    summary.textContent =
                      "Modification impossible : " +
                      (err.message || String(err));
                    button.disabled = false;
                  }
                });
                item.append(button);
              }
              list.append(item);
            }
          } catch (err) {
            summary.textContent =
              "Notifications indisponibles : " + (err.message || String(err));
          } finally {
            refresh.disabled = false;
          }
        };
        refresh.addEventListener("click", loadClientNotifications);
        await loadClientNotifications();
      }
    }

    // Rappels visibles au chargement, uniquement pour le cabinet CRIC autorisé.
    if (canManage && space) {
      const panel = $("cricReminderPanel");
      const summary = $("cricReminderSummary");
      const list = $("cricReminderList");
      if (panel && summary && list) {
        panel.hidden = false;
        try {
          const result = await db
            .from("madic_cric_deadlines")
            .select("id,dossier_id,title,due_date")
            .eq("space_id", space.id)
            .eq("completed", false)
            .order("due_date", { ascending: true });
          if (result.error) throw result.error;
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Toronto",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(new Date());
          const dateParts = Object.fromEntries(
            parts.map((p) => [p.type, p.value]),
          );
          const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
          const dayDifference = (due) =>
            Math.round(
              (Date.parse(due + "T12:00:00Z") -
                Date.parse(today + "T12:00:00Z")) /
                86400000,
            );
          const urgent = (result.data || []).filter(
            (d) => dayDifference(d.due_date) <= 7,
          );
          list.replaceChildren();
          if (!urgent.length) {
            summary.textContent =
              "Aucune échéance dépassée ou prévue dans les 7 prochains jours.";
          } else {
            const ids = [...new Set(urgent.map((d) => d.dossier_id))];
            const dossiersResult = await db
              .from("dossiers")
              .select("id,reference")
              .eq("space_id", space.id)
              .in("id", ids);
            if (dossiersResult.error) throw dossiersResult.error;
            const refs = new Map(
              (dossiersResult.data || []).map((d) => [d.id, d.reference]),
            );
            const late = urgent.filter(
              (d) => dayDifference(d.due_date) < 0,
            ).length;
            summary.textContent = `${urgent.length} rappel(s) prioritaire(s), dont ${late} dépassé(s).`;
            for (const deadline of urgent.slice(0, 10)) {
              const diff = dayDifference(deadline.due_date);
              const status =
                diff < 0
                  ? `Dépassée de ${-diff} jour(s)`
                  : diff === 0
                    ? "Aujourd'hui"
                    : `Dans ${diff} jour(s)`;
              const item = document.createElement("li");
              item.textContent = `${deadline.title} - ${refs.get(deadline.dossier_id) || "Dossier"} - ${status} (${deadline.due_date})`;
              item.style.marginBottom = "0.6rem";
              list.append(item);
            }
            if (urgent.length > 10) {
              const extra = document.createElement("li");
              extra.textContent = `Et ${urgent.length - 10} autre(s) échéance(s) prioritaire(s).`;
              list.append(extra);
            }
          }
        } catch (reminderError) {
          summary.textContent =
            "Rappels indisponibles : " +
            (reminderError.message || String(reminderError));
        }
      }
    }
    $("cricAccess").textContent = !space
      ? "Votre espace CRIC doit etre configure."
      : space.access_status !== "active"
        ? "Votre espace CRIC est suspendu ou inactif."
        : canManage
          ? "Espace CRIC actif : gestion des clients et dossiers disponible."
          : "Acces a cet espace non autorise. Contactez MADIC.";
    $("cricMain").hidden = false;
    $("cricMessage").hidden = true;
  } catch (error) {
    fail(
      "Impossible de vérifier vos droits : " + (error.message || String(error)),
    );
  }
})();


/* Original module: madic-notifications(20261110-054703).js */
/* MADIC 7.8 - Notifications de messagerie dans les tableaux de bord.
   Aucune cle privilegiee; requetes soumises aux politiques RLS Supabase. */
(async () => {
  "use strict";
  const page = location.pathname.split("/").pop().toLowerCase();
  const client = page === "dashboard-client-cric.html";
  const cric = page === "cric-dashboard.html";
  if ((!client && !cric) || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const destination = client
    ? "messagerie-client-cric.html"
    : "messagerie-cric.html";
  let previousUnread = null;
  let busy = false;
  let stopped = false;
  let dismissedAtCount = null;

  const toast = document.createElement("aside");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.hidden = true;
  toast.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;width:min(360px,calc(100vw - 32px));box-sizing:border-box;background:#123047;color:white;padding:16px;border-radius:12px;box-shadow:0 8px 24px #0005;font:14px/1.5 system-ui,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = "Nouveau message MADIC";
  const count = document.createElement("p");
  count.style.cssText = "margin:8px 0 12px";
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:12px;align-items:center;justify-content:space-between";
  const open = document.createElement("a");
  open.href = destination;
  open.textContent = "Consulter la messagerie";
  open.style.cssText = "color:#fff;text-decoration:underline;font-weight:600";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Fermer";
  dismiss.setAttribute("aria-label", "Fermer la notification de messagerie");
  dismiss.style.cssText =
    "background:transparent;border:1px solid #ffffffa0;border-radius:6px;padding:6px 10px;color:white;cursor:pointer";
  dismiss.addEventListener("click", () => {
    dismissedAtCount = previousUnread;
    toast.hidden = true;
  });
  actions.append(open, dismiss);
  toast.append(heading, count, actions);
  document.body.append(toast);

  async function conversationIds() {
    if (client) {
      const { data: linked, error } = await db.rpc(
        "madic_my_cric_client_spaces",
      );
      if (error) throw error;
      const spaceIds = [
        ...new Set((linked || []).map((x) => x.space_id).filter(Boolean)),
      ];
      if (!spaceIds.length) return [];
      const result = await db
        .from("madic_cric_conversations")
        .select("id")
        .eq("client_id", uid)
        .in("space_id", spaceIds)
        .limit(200);
      if (result.error) throw result.error;
      return (result.data || []).map((x) => x.id);
    }
    const spaces = await db
      .from("madic_cric_spaces")
      .select("id")
      .eq("owner_user_id", uid)
      .eq("access_status", "active")
      .limit(1);
    if (spaces.error) throw spaces.error;
    if (!spaces.data?.length) return [];
    const spaceId = spaces.data[0].id;
    const allowed = await db.rpc("madic_can_manage_cric_space", {
      p_space_id: spaceId,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) return [];
    const result = await db
      .from("madic_cric_conversations")
      .select("id")
      .eq("space_id", spaceId)
      .limit(200);
    if (result.error) throw result.error;
    return (result.data || []).map((x) => x.id);
  }

  async function refresh() {
    if (busy || stopped || document.hidden) return;
    busy = true;
    try {
      const ids = await conversationIds();
      let unread = 0;
      if (ids.length) {
        const [messages, reads] = await Promise.all([
          db
            .from("madic_cric_messages")
            .select("conversation_id,sender_id,created_at")
            .in("conversation_id", ids)
            .order("created_at", { ascending: false })
            .limit(1000),
          db
            .from("madic_cric_message_reads")
            .select("conversation_id,last_read_at")
            .eq("user_id", uid)
            .in("conversation_id", ids),
        ]);
        if (messages.error) throw messages.error;
        if (reads.error) throw reads.error;
        const lastRead = new Map(
          (reads.data || []).map((r) => [r.conversation_id, r.last_read_at]),
        );
        unread = (messages.data || []).filter(
          (m) =>
            m.sender_id !== uid &&
            (!lastRead.has(m.conversation_id) ||
              new Date(m.created_at) >
                new Date(lastRead.get(m.conversation_id))),
        ).length;
      }
      if (
        previousUnread !== null &&
        unread > previousUnread &&
        unread !== dismissedAtCount
      ) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
        toast.hidden = false;
        dismissedAtCount = null;
      }
      if (unread === 0) {
        toast.hidden = true;
        dismissedAtCount = null;
      }
      if (unread < previousUnread && !toast.hidden) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
      }
      if (client) {
        const badge = document.getElementById("madicHeroUnread");
        if (badge) {
          badge.hidden = unread === 0;
          badge.textContent = unread > 99 ? "99+" : String(unread);
        }
      }
      previousUnread = unread;
    } catch (error) {
      console.warn(
        "MADIC notifications : verification indisponible :",
        error?.message || String(error),
      );
    } finally {
      busy = false;
    }
  }
  await refresh();
  const timer = window.setInterval(() => {
    void refresh();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener("pageshow", () => {
    void refresh();
  });
  window.addEventListener(
    "pagehide",
    () => {
      stopped = true;
      window.clearInterval(timer);
    },
    { once: true },
  );
})();


/* Original module: madic-service-journey(20261110-054718).js */
/* MADIC - suivi de demandes isole par cabinet. Module independant des scripts historiques. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (
    !window.MADIC_CONFIG?.url ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return;
  const db = window.getMadicSupabase();
  const { data: { user } = {}, error: authError } = await db.auth.getUser();
  if (authError || !user) return;
  const labels = {
    received: "Reçue",
    reviewing: "En analyse",
    responded: "Réponse transmise",
    closed: "Clôturée",
  };
  const services = {
    consultation: "Consultation initiale",
    proposition: "Proposition personnalisée",
  };
  const niceDate = (value) =>
    value
      ? new Date(value).toLocaleString("fr-CA", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";
  const cricPanel = $("madicServiceRequestsPanel");
  if (cricPanel) {
    const notice = $("madicServiceNotice"),
      list = $("madicServiceList"),
      badge = $("madicServicePendingBadge"),
      refresh = $("madicServiceRefresh");
    let busy = false,
      spaceId = null;
    const createToggle = $("madicServiceCreateToggle"),
      createForm = $("madicServiceCreateForm");
    const clientSelect = $("madicServiceClient"),
      intakeState = $("madicServiceIntakeState");
    const createSubmit = $("madicServiceCreateSubmit");
    let eligibleClients = [];
    // Filtrage local de la liste compacte, sans modifier les donnees Supabase.
    const requestFilter = $("madicServiceFilter");
    const requestSearch = $("madicServiceSearch");
    function applyRequestFilters() {
      const status = requestFilter?.value || "all";
      const query = (requestSearch?.value || "").trim().toLocaleLowerCase("fr-CA");
      for (const article of list.querySelectorAll(".madic-service-item")) {
        const matchesName = !query || (article.dataset.clientName || "").includes(query);
        const matchesStatus = status === "all" ||
          (status === "received" && article.dataset.requestStatus === "received") ||
          (status === "signed" && article.dataset.contractSigned === "true");
        article.hidden = !(matchesName && matchesStatus);
        // Les styles de cartes ne doivent pas annuler l'attribut hidden.
        article.style.display = article.hidden ? "none" : "";
      }
    }
    function updateSignedCount() {
      const count = Array.from(list.querySelectorAll(".madic-service-item"))
        .filter((article) => article.dataset.contractSigned === "true").length;
      const counter = $("madicServiceOtherCount");
      if (counter) counter.textContent = String(count);
    }
    requestFilter?.addEventListener("change", applyRequestFilters);
    requestSearch?.addEventListener("input", applyRequestFilters);
    function validateClient() {
      const selected = eligibleClients.find(
        (c) => c.client_id === clientSelect?.value,
      );
      const submitted = selected?.intake_status === "submitted";
      const available = submitted && !selected?.has_request;
      if (intakeState)
        intakeState.textContent = !selected
          ? "Sélectionnez un client."
          : !submitted
            ? "Formulaire non soumis : création impossible."
            : selected.has_request
              ? "Une demande existe déjà : création bloquée."
              : "Formulaire soumis : demande autorisée.";
      if (createSubmit) createSubmit.disabled = !available;
    }
    async function loadEligible() {
      if (!clientSelect || !spaceId) return;
      const { data, error } = await db.rpc("madic_service_eligible_clients", {
        p_space_id: spaceId,
      });
      if (error) throw error;
      eligibleClients = data || [];
      clientSelect.replaceChildren();
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Choisir un client";
      clientSelect.append(blank);
      for (const c of eligibleClients) {
        const option = document.createElement("option");
        option.value = c.client_id;
        option.textContent =
          (c.client_name || "Client") +
          (c.intake_status === "submitted"
            ? " · formulaire soumis"
            : " · formulaire incomplet") +
          (c.has_request ? " · demande existante" : "");
        clientSelect.append(option);
      }
      validateClient();
    }
    clientSelect?.addEventListener("change", validateClient);
    createToggle?.addEventListener("click", async () => {
      const opening = createForm.hidden;
      createForm.hidden = !opening;
      createToggle.setAttribute("aria-expanded", String(opening));
      if (opening) {
        try {
          await loadEligible();
        } catch (e) {
          intakeState.textContent = "Chargement impossible : " + e.message;
        }
      }
    });
    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      validateClient();
      if (createSubmit.disabled) return;
      createSubmit.disabled = true;
      try {
        const { error } = await db.rpc("madic_service_create_by_cric", {
          p_space_id: spaceId,
          p_client_id: clientSelect.value,
          p_service_type: $("madicServiceType").value,
          p_payment_method: $("madicServicePayment").value,
          p_payment_note: $("madicServicePaymentNote").value || null,
        });
        if (error) throw error;
        notice.textContent =
          "Demande créée. Le parcours client sera actualisé automatiquement.";
        createForm.reset();
        await loadEligible();
        await load();
      } catch (err) {
        intakeState.textContent = "Création impossible : " + err.message;
        validateClient();
      }
    });
    const pill = (label, kind = "neutral") => {
      const el = document.createElement("span");
      el.className = "madic-service-state madic-service-state-" + kind;
      el.textContent = label;
      return el;
    };
    const stateLine = (label, value, kind = "neutral") => {
      const line = document.createElement("div");
      line.className = "madic-service-state-line";
      const title = document.createElement("span");
      title.textContent = label;
      const badge = pill(value, kind);
      line.append(title, badge);
      return { line, badge };
    };
    async function appointmentOverview() {
      const now = new Date().toISOString();
      const [slotsResult, appointmentsResult] = await Promise.all([
        db
          .from("madic_cric_appointment_slots")
          .select("id,starts_at,is_open")
          .eq("space_id", spaceId)
          .gte("starts_at", now),
        db
          .from("madic_cric_appointments")
          .select("client_id,slot_id,status")
          .eq("space_id", spaceId),
      ]);
      if (slotsResult.error) throw slotsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;
      const appointments = appointmentsResult.data || [];
      const occupied = new Set(
        appointments
          .filter((a) => ["requested", "confirmed"].includes(a.status))
          .map((a) => a.slot_id),
      );
      const available = (slotsResult.data || []).filter(
        (s) => s.is_open && !occupied.has(s.id),
      ).length;
      const perClient = new Map();
      for (const a of appointments) {
        if (!perClient.has(a.client_id)) perClient.set(a.client_id, []);
        perClient.get(a.client_id).push(a.status);
      }
      return { available, perClient };
    }

    async function load() {
      if (busy || !spaceId || document.hidden) return;
      busy = true;
      refresh.disabled = true;
      try {
        const { data, error } = await db.rpc(
          "madic_service_requests_for_cric",
          { p_space_id: spaceId },
        );
        if (error) throw error;
        list.replaceChildren();
        const requests = data || [];
        let appointmentData = null,
          appointmentError = null;
        if (
          requests.some((r) =>
            ["consultation", "proposition"].includes(r.service_type),
          )
        ) {
          try {
            appointmentData = await appointmentOverview();
          } catch (e) {
            appointmentError = e;
          }
        }
        const pending = requests.filter(
          (r) => r.request_status === "received",
        ).length;
        $("madicServiceTotalCount") && ($("madicServiceTotalCount").textContent = String(requests.length));
        $("madicServiceReceivedCount") && ($("madicServiceReceivedCount").textContent = String(pending));
        // Ce compteur porte desormais sur les contrats effectivement signes.
        $("madicServiceOtherCount") && ($("madicServiceOtherCount").textContent = "0");
        badge.textContent = String(pending);
        badge.hidden = !pending;
        notice.textContent = requests.length
          ? `${requests.length} demande(s), dont ${pending} à traiter.`
          : "Aucune demande de service pour le moment.";
        for (const item of requests) {
          const article = document.createElement("article");
          article.className = "madic-service-item";
          article.dataset.clientName = (item.client_name || "Client").toLocaleLowerCase("fr-CA");
          article.dataset.requestStatus = item.request_status || "received";
          article.dataset.contractSigned = "false";
          const header = document.createElement("div");
          header.className = "madic-service-head";
          const title = document.createElement("strong");
          title.textContent = item.client_name || "Client";
          const tag = document.createElement("span");
          tag.className = "madic-service-badge";
          tag.textContent = labels[item.request_status] || "Reçue";
          header.append(title, tag);
          const detail = document.createElement("p");
          detail.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          const expanded = document.createElement("details");
          expanded.className = "madic-service-expanded";
          const summary = document.createElement("summary");
          summary.className = "madic-service-row";
          const summaryMain = document.createElement("span");
          summaryMain.className = "madic-service-row-client";
          const summaryName = document.createElement("strong");
          summaryName.textContent = item.client_name || "Client";
          const summaryType = document.createElement("small");
          summaryType.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          summaryMain.append(summaryName, summaryType);
          const summaryStatus = pill(labels[item.request_status] || "Reçue", "info");
          const summaryContract = pill("Vérification…");
          const summaryAppointment = pill("Vérification…");
          const summaryContractGroup = document.createElement("span");
          summaryContractGroup.className = "madic-service-row-indicator";
          summaryContractGroup.append(document.createTextNode("Contrat"), summaryContract);
          const summaryAppointmentGroup = document.createElement("span");
          summaryAppointmentGroup.className = "madic-service-row-indicator";
          summaryAppointmentGroup.append(document.createTextNode("Rendez-vous"), summaryAppointment);
          const summaryChevron = document.createElement("span");
          summaryChevron.className = "madic-service-chevron";
          summaryChevron.textContent = "Détails";
          summary.append(summaryMain, summaryStatus, summaryContractGroup, summaryAppointmentGroup, summaryChevron);
          const expandedBody = document.createElement("div");
          expandedBody.className = "madic-service-expanded-body";
          expanded.append(summary, expandedBody);
          function mirrorState(source, target, isContract = false) {
            const sync = () => {
              target.textContent = source.textContent;
              target.className = source.className;
              if (isContract) {
                // "À contresigner" est signe par le client, mais pas finalise.
                article.dataset.contractSigned = /^(Signé|Contresigné)$/.test(source.textContent.trim()) ? "true" : "false";
                updateSignedCount();
                applyRequestFilters();
              }
            };
            new MutationObserver(sync).observe(source, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:["class"]});
            sync();
          }
          const actions = document.createElement("div");
          actions.className = "madic-service-actions";
          const select = document.createElement("select");
          select.setAttribute(
            "aria-label",
            "Statut de la demande de " + (item.client_name || "client"),
          );
          for (const [value, label] of Object.entries(labels)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.append(option);
          }
          select.value = item.request_status || "received";
          // Le contrat et les disponibilites restent geres par leurs modules existants.
          const workflow = document.createElement("div");
          workflow.className = "madic-service-workflow";
          if (["consultation", "proposition"].includes(item.service_type)) {
            const contract = document.createElement("div");
            contract.className = "madic-service-workflow-block";
            const heading = document.createElement("strong");
            heading.textContent =
              item.service_type === "proposition"
                ? "Contrat professionnel et signature"
                : "Contrat initial et signature";
            const contractState = stateLine("Contrat", "Vérification…");
            const signatureState = stateLine(
              "Signature du client",
              "Vérification…",
            );
            const open = document.createElement("a");
            open.href =
              (item.service_type === "proposition"
                ? "contrat-professionnel-cric.html"
                : "contrat-initial-cric.html") +
              "?client=" +
              encodeURIComponent(item.client_id);
            open.textContent = "Préparer / consulter le contrat →";
            contract.append(
              heading,
              contractState.line,
              signatureState.line,
              open,
            );
            workflow.append(contract);
            if (item.service_type === "proposition") {
              contractState.badge.textContent = "Brouillon uniquement";
              signatureState.badge.textContent = "Non disponible";
              const note = document.createElement("p");
              note.className = "madic-service-workflow-note";
              note.textContent =
                "La publication et la signature électronique du contrat professionnel ne sont pas encore activées. Aucun contrat initial ne sera utilisé pour ce mandat.";
              contract.append(note);
            } else {
              // Le parcours Client -> CRIC utilise client_signe / deux_signatures.
              // Lire uniquement les contrats de ce client dans cet espace CRIC.
              (async () => {
                const { data: clientContracts, error: clientError } = await db
                  .from("madic_initial_contracts")
                  .select("id,status")
                  .eq("space_id", spaceId)
                  .eq("client_id", item.client_id)
                  .eq("signature_flow", "client_to_cric")
                  .in("status", ["client_signe", "deux_signatures"])
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (clientError) console.warn("Contrat Client vers CRIC :", clientError.message);
                const signed = !clientError && clientContracts?.[0];
                if (signed) {
                  // Un contrat transmis par le client se consulte et se contresigne
                  // dans le parcours Client -> CRIC, sans ouvrir le formulaire de creation.
                  open.href = "contrats-client-vers-cric.html";
                  open.textContent = signed.status === "deux_signatures"
                    ? "Consulter le contrat contresigné →"
                    : "Consulter et contresigner le contrat →";
                  contractState.badge.textContent = signed.status === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                  return;
                }
                // Conserver la logique historique des contrats CRIC -> Client.
                const { data, error } = await db.rpc("madic_service_contract_state", {
                  p_space_id: spaceId,
                  p_client_id: item.client_id,
                });
                if (error) throw error;
                const row = Array.isArray(data) ? data[0] : data;
                const state = row?.contract_status;
                if (state === "signe") {
                  contractState.badge.textContent = "Signé";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (state === "publie") {
                  contractState.badge.textContent = "Publié";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-info";
                  signatureState.badge.textContent = "En attente";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-pending";
                } else if (state === "client_signe" || state === "deux_signatures") {
                  contractState.badge.textContent = state === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (clientError) {
                  contractState.badge.textContent = "À vérifier";
                  signatureState.badge.textContent = "À vérifier";
                } else {
                  contractState.badge.textContent = "Non publié";
                  signatureState.badge.textContent = "Non disponible";
                }
              })().catch((error) => {
                console.warn("État du contrat :", error.message);
                contractState.badge.textContent = "Indisponible";
                signatureState.badge.textContent = "Indisponible";
              });
            }
            const appointment = document.createElement("div");
            appointment.className = "madic-service-workflow-block";
            const apHead = document.createElement("strong");
            apHead.textContent = "Rendez-vous";
            const apState = stateLine("État du client", "Aucune demande");
            const slotState = stateLine(
              "Créneaux du cabinet",
              "Aucun disponible",
            );
            if (appointmentError) {
              apState.badge.textContent = "Indisponible";
              slotState.badge.textContent = "Indisponible";
            } else if (appointmentData) {
              const states =
                appointmentData.perClient.get(item.client_id) || [];
              if (states.includes("confirmed")) {
                apState.badge.textContent = "Confirmé";
                apState.badge.className =
                  "madic-service-state madic-service-state-success";
              } else if (states.includes("requested")) {
                apState.badge.textContent = "Demande reçue";
                apState.badge.className =
                  "madic-service-state madic-service-state-pending";
              } else if (states.includes("declined"))
                apState.badge.textContent = "Dernière demande refusée";
              else if (states.includes("cancelled"))
                apState.badge.textContent = "Demande annulée";
              if (appointmentData.available) {
                slotState.badge.textContent =
                  appointmentData.available + " disponible(s)";
                slotState.badge.className =
                  "madic-service-state madic-service-state-info";
              }
            }
            const apNote = document.createElement("p");
            apNote.className = "madic-service-workflow-note";
            apNote.textContent =
              "Les créneaux publiés sont accessibles aux clients du cabinet; ils ne constituent pas une proposition individuelle ni une réservation confirmée.";
            const apLink = document.createElement("a");
            apLink.href = "rendez-vous-cric.html";
            apLink.textContent = "Gérer les disponibilités →";
            appointment.append(
              apHead,
              apState.line,
              slotState.line,
              apNote,
              apLink,
            );
            workflow.append(appointment);
            // Reporter les statuts des blocs detailles dans la ligne compacte.
            mirrorState(contractState.badge, summaryContract, true);
            mirrorState(apState.badge, summaryAppointment);
          }
          const save = document.createElement("button");
          save.type = "button";
          save.className = "secondary";
          save.textContent = "Enregistrer le statut";
          save.addEventListener("click", async () => {
            save.disabled = true;
            select.disabled = true;
            try {
              const { error } = await db.rpc("madic_service_set_status", {
                p_space_id: spaceId,
                p_client_id: item.client_id,
                p_status: select.value,
              });
              if (error) throw error;
              await loadAfterSave();
            } catch (err) {
              notice.textContent = "Modification impossible : " + err.message;
            } finally {
              save.disabled = false;
              select.disabled = false;
            }
          });
          actions.append(select, save);
          expandedBody.append(actions, workflow);
          article.append(expanded);
          list.append(article);
          applyRequestFilters();
        }
      } catch (err) {
        notice.textContent = "Demandes indisponibles : " + err.message;
      } finally {
        busy = false;
        refresh.disabled = false;
      }
    }
    async function loadAfterSave() {
      busy = false;
      await load();
    }
    refresh.addEventListener("click", () => void load());
    // L'authentification et la permission CRIC restent controlees par la RPC SQL.
    try {
      const { data: spaces, error } = await db
        .from("madic_cric_spaces")
        .select("id,access_status")
        .eq("owner_user_id", user.id)
        .eq("access_status", "active")
        .limit(1);
      if (error) throw error;
      if (spaces?.length) {
        spaceId = spaces[0].id;
        cricPanel.hidden = false;
        await load();
      }
    } catch (err) {
      console.warn("MADIC services:", err.message);
    }
    window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    window.addEventListener("focus", () => void load());
  }
  const journey = $("madicJourneyPanel");
  if (journey) {
    const notice = $("madicJourneyStatus"),
      steps = $("madicJourneySteps"),
      stage = $("madicJourneyStage"),
      link = $("madicJourneyLink");
    const phases = ["Formulaire", "Demande", "Analyse", "Réponse"];
    async function update() {
      const cabinet = $("cabinet");
      const spaceId = cabinet?.value;
      if (!spaceId) return;
      journey.hidden = false;
      try {
        const { data: intake, error: intakeError } = await db
          .from("madic_client_intake")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (intakeError) throw intakeError;
        const { data, error } = await db.rpc("madic_service_my_progress", {
          p_space_id: spaceId,
        });
        if (error) throw error;
        const request = data?.[0];
        let active = 0;
        if (intake?.status === "submitted") active = 1;
        if (request)
          active =
            request.request_status === "received"
              ? 2
              : request.request_status === "reviewing"
                ? 3
                : 4;
        stage.textContent = `Étape ${active} sur 4`;
        steps.replaceChildren();
        phases.forEach((label, i) => {
          const el = document.createElement("div");
          el.className =
            "madic-journey-step" + (i < active ? " is-complete" : "");
          const bar = document.createElement("span");
          bar.className = "madic-journey-bar";
          const text = document.createElement("small");
          text.textContent = label;
          el.append(bar, text);
          steps.append(el);
        });
        notice.textContent = request
          ? `${services[request.service_type] || "Demande de service"} - ${labels[request.request_status] || "Reçue"}.`
          : intake?.status === "submitted"
            ? "Votre formulaire est soumis. Vous pouvez choisir votre prochaine étape."
            : "Complétez votre formulaire pour commencer votre parcours.";
        link.hidden = !!request || intake?.status !== "submitted";
        const workflow = $("madicJourneyWorkflow");
        if (workflow) {
          workflow.replaceChildren();
          if (
            ["consultation", "proposition"].includes(request?.service_type) &&
            ["reviewing", "responded", "closed"].includes(
              request.request_status,
            )
          ) {
            const contract = document.createElement("p");
            if (request.service_type === "proposition") {
              contract.textContent =
                "Contrat professionnel : en attente de transmission par votre consultant. La signature électronique n’est pas encore disponible.";
            } else {
              const { data: contracts, error: contractError } = await db
                .from("madic_initial_contracts")
                .select("id,status")
                .eq("client_id", user.id)
                .in("status", ["publie", "signe"])
                .order("created_at", { ascending: false })
                .limit(1);
              if (contractError) {
                contract.textContent =
                  "Contrat : état momentanément indisponible.";
              } else if (contracts?.length) {
                const c = contracts[0];
                contract.textContent =
                  c.status === "signe"
                    ? "Contrat initial signé. "
                    : "Votre contrat initial est disponible pour signature. ";
                const a = document.createElement("a");
                a.href =
                  "contrat-initial-client.html?id=" + encodeURIComponent(c.id);
                a.textContent = "Consulter mon contrat →";
                contract.append(a);
              } else {
                contract.textContent =
                  "Contrat initial : en attente de transmission par votre consultant.";
              }
            }
            workflow.append(contract);
            const ap = document.createElement("p");
            ap.textContent =
              "Vous pouvez consulter les créneaux publiés par votre consultant et demander un rendez-vous. ";
            const a = document.createElement("a");
            a.href = "mes-rendez-vous-cric.html";
            a.textContent = "Voir les disponibilités →";
            ap.append(a);
            workflow.append(ap);
          }
        }
      } catch (err) {
        notice.textContent =
          "Suivi momentanément indisponible : " + err.message;
      }
    }
    $("cabinet")?.addEventListener("change", () => void update());
    // Le script historique peuple la liste des cabinets apres authentification.
    const wait = setInterval(() => {
      if ($("cabinet")?.value) {
        clearInterval(wait);
        void update();
      }
    }, 300);
    setTimeout(() => clearInterval(wait), 12000);
    window.setInterval(() => {
      if (!document.hidden) void update();
    }, 30000);
    window.addEventListener("focus", () => void update());
  }
})();


/* Original module: madic-footer(20261109-062706).js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* Original module: madic-datahubz-unified(20261110-054729).js */
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


/* Original module: madic-i18n-cric-dashboard(6).js */
(function () {
  "use strict";
  const dictionary = {
    "MADIC PORTAIL": "MADIC PORTAL",
    "Accès rapides": "Quick access",
    "Raccourcis vers les modules": "Module shortcuts",
    "Demandes de services": "Service requests",
    "Demandes reçues": "Requests received",
    "Professional profile": "Professional profile",
    "Gestion des clients": "Client management",
    "Suivi des dossiers": "Case tracking",
    "Rendez-vous": "Appointments",
    "Notifications": "Notifications",
    "NAVIGATION": "NAVIGATION",
    "Numéro CRIC": "RCIC licence number",
    "Espace professionnel non configuré": "Professional workspace not configured",
    "Espace CRIC actif : gestion des clients et dossiers disponible.": "Active RCIC workspace: client and case management available.",
    "Votre espace CRIC doit etre configure.": "Your RCIC workspace needs to be configured.",
    "Votre espace CRIC est suspendu ou inactif.": "Your RCIC workspace is suspended or inactive.",
    "Acces a cet espace non autorise. Contactez MADIC.": "Access to this workspace is not authorized. Contact MADIC.",
    PORTAIL: "PORTAL",
    "Espace professionnel": "Professional workspace",
    "Vue d’ensemble": "Overview",
    "Outils CRIC": "RCIC tools",
    Messagerie: "Messaging",
    Échéances: "Deadlines",
    Facturation: "Billing",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Mon espace": "My space",
    "ESPACE PROFESSIONNEL CRIC": "RCIC PROFESSIONAL WORKSPACE",
    Bienvenue: "Welcome",
    Déconnexion: "Sign out",
    "Demandes de services": "Service requests",
    Actualiser: "Refresh",
    "+ Nouvelle demande de service": "+ New service request",
    "Client existant": "Existing client",
    "Type de service": "Service type",
    "Consultation initiale": "Initial consultation",
    "Proposition personnalisée": "Customized proposal",
    "Mode de paiement déclaré": "Declared payment method",
    "Virement Interac": "Interac e-Transfer",
    Espèces: "Cash",
    "Référence ou note (facultatif)": "Reference or note (optional)",
    "Le mode choisi est déclaré par le CRIC. Il ne confirme pas automatiquement la réception des fonds.":
      "The selected method is declared by the RCIC. It does not automatically confirm receipt of funds.",
    "Créer la demande": "Create request",
    "Total des demandes": "Total requests",
    "Demandes reçues": "Requests received",
    "Autres statuts": "Other statuses",
    Afficher: "Show",
    "Toutes les demandes": "All requests",
    "Contrats signés": "Signed contracts",
    Rechercher: "Search",
    "Chargement des demandes…": "Loading requests…",
    "Notifications des clients": "Client notifications",
    "Chargement des notifications…": "Loading notifications…",
    "Afficher / masquer l’historique des notifications":
      "Show / hide notification history",
    "🔔 Mes rappels prioritaires": "🔔 My priority reminders",
    "Voir toutes les échéances →": "View all deadlines →",
    "Chargement des rappels…": "Loading reminders…",
    "Personnalisez les invitations de votre cabinet avec vos coordonnées et votre logo.":
      "Customize your firm invitations with your contact details and logo.",
    "Compléter mon profil →": "Complete my profile →",
    "Gestion des clients": "Client management",
    "Clients associés à votre espace professionnel et invitations.":
      "Clients and invitations associated with your professional workspace.",
    "Gérer mes clients →": "Manage my clients →",
    "Accès en préparation : isolation des clients par CRIC à finaliser.":
      "Access in preparation: client isolation by RCIC is being finalized.",
    "Suivi visuel des dossiers": "Visual case tracking",
    "Tableau Kanban de votre cabinet, avec changement de statut par glisser-déposer ou sélection.":
      "Your firm’s Kanban board, with status changes by drag and drop or selection.",
    "Ouvrir le Kanban →": "Open Kanban →",
    "Accessible uniquement aux cabinets CRIC autorisés.":
      "Available only to authorized RCIC firms.",
    "Rendez-vous et consultations": "Appointments and consultations",
    "Disponibilités, réservations et consultations de votre cabinet.":
      "Your firm’s availability, bookings and consultations.",
    "Gérer les rendez-vous →": "Manage appointments →",
    "Facturation CRIC": "RCIC billing",
    "Créer, émettre et suivre les factures de votre cabinet.":
      "Create, issue and track your firm’s invoices.",
    "Gérer mes factures →": "Manage my invoices →",
    "Accessible aux CRIC autorisés.": "Available to authorized RCICs.",
    "Gestion financière": "Financial management",
    "Temps et honoraires, facturation, paiements, fidéicommis, comptabilité et rapports.":
      "Time and fees, billing, payments, trust accounts, accounting and reports.",
    "Accéder à la gestion financière →": "Open financial management →",
    "Échéances et rappels": "Deadlines and reminders",
    "Suivez les dates limites des dossiers de votre cabinet.":
      "Track your firm’s case deadlines.",
    "Consulter les échéances →": "View deadlines →",
    "Messagerie sécurisée": "Secure messaging",
    "Échangez des messages confidentiels avec les clients de votre cabinet.":
      "Exchange confidential messages with your firm’s clients.",
    "Vérification des messages…": "Checking messages…",
    "Actualiser les messages": "Refresh messages",
    "Ouvrir la messagerie →": "Open messaging →",
    "Gestion des dossiers CRIC": "RCIC case management",
    "Création et suivi des dossiers, documents et décisions.":
      "Create and track cases, documents and decisions.",
    "Gérer mes dossiers →": "Manage my cases →",
    "Accès en préparation : isolation des dossiers par CRIC à finaliser.":
      "Access in preparation: case isolation by RCIC is being finalized.",
    "Outils d’évaluation en immigration": "Immigration assessment tools",
    "Accédez aux évaluations Entrée express, Québec et Saskatchewan.":
      "Access Express Entry, Québec and Saskatchewan assessments.",
    "Évaluation Entrée express →": "Express Entry assessment →",
    "Évaluation Québec →": "Québec assessment →",
    "Évaluation Saskatchewan →": "Saskatchewan assessment →",
    "Administration générale MADIC →": "MADIC general administration →",
    "Vérification de votre compte CRIC…": "Verifying your RCIC account…",
    "© MAD Immigration Canadienne · Portail sécurisé":
      "© MAD Immigration Canadienne · Secure portal",
    "Numéro CRIC : -": "RCIC licence number: -",
    "Référence ou date du paiement": "Payment reference or date",
    "Nom du client": "Client name",
    "Messages non lus": "Unread messages",
    "Navigation du portail": "Portal navigation",
  };
  const storageKey = "madic_ui_language";
  const originals = new WeakMap();
  const rendered = new WeakMap();
  let lang = "fr";
  let observer;
  let pending = false;
  function translateText(node) {
    if (
      !node.parentElement ||
      node.parentElement.closest(
        'script,style,textarea,[contenteditable="true"],.madic-lang-controls',
      )
    )
      return;
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    // Respecter les textes actualisés par les scripts métier (nom, statut, compteurs).
    if (!originals.has(node) || (rendered.has(node) && rendered.get(node) !== raw)) originals.set(node, raw);
    const source = originals.get(node);
    const trimmed = source.trim();
    let result = source;
    if (lang === "en") {
      let target = dictionary[trimmed];
      if (!target && /^Bienvenue,\s*/.test(trimmed)) target = trimmed.replace(/^Bienvenue/, "Welcome");
      if (!target && /^Espace professionnel\s*:/.test(trimmed)) target = trimmed.replace(/^Espace professionnel/, "Professional workspace");
      if (!target && /^Numéro CRIC\s*:/.test(trimmed))
        target = trimmed.replace(/^Numéro CRIC/, "RCIC licence number");
      if (target) result = source.replace(trimmed, target);
    }
    if (node.nodeValue !== result) node.nodeValue = result;
    rendered.set(node, result);
  }
  function translateAttributes(el) {
    for (const name of ["placeholder", "title", "aria-label"]) {
      if (!el.hasAttribute(name)) continue;
      const key =
        "madicOriginal" +
        name
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          .replace(/^./, (c) => c.toUpperCase());
      if (!el.dataset[key]) el.dataset[key] = el.getAttribute(name);
      const source = el.dataset[key];
      const result = lang === "en" ? dictionary[source] || source : source;
      if (el.getAttribute(name) !== result) el.setAttribute(name, result);
    }
  }
  function render() {
    if (observer) observer.disconnect();
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateText(node);
    root
      .querySelectorAll("[placeholder],[title],[aria-label]")
      .forEach(translateAttributes);
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    document.title =
      lang === "en" ? "My RCIC workspace | MADIC" : "Mon espace CRIC | MADIC";
    document.querySelectorAll(".madic-lang-controls button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    if (observer)
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  }
  try {
    lang = localStorage.getItem(storageKey) === "en" ? "en" : "fr";
  } catch (_) {}
  document.querySelectorAll(".madic-lang-controls button").forEach((btn) =>
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      try {
        localStorage.setItem(storageKey, lang);
      } catch (_) {}
      render();
    }),
  );
  observer = new MutationObserver(schedule);
  render();
})();


/* Original module: madic-cric-overview(3).js */
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


  }
  function ready(){
    if (window.supabase && typeof window.getMadicSupabase === 'function') { start(); return; }
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload=start;
    s.onerror=function(){ const el=document.getElementById('cricMessage'); if(el)el.textContent='Impossible de charger Supabase.'; };
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true}); else ready();
})();
