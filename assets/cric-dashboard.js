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
