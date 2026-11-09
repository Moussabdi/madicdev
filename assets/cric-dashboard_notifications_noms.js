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
          row.insertCell().colSpan = 4;
          row.cells[0].textContent = "Aucun CRIC inscrit.";
          return;
        }
        for (const item of data) {
          const row = tbody.insertRow();
          row.insertCell().textContent = item.full_name;
          row.insertCell().textContent = item.license_number;
          row.insertCell().textContent = labels[item.status] || item.status;
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
      if ($("cricAppointmentsCard")) $("cricAppointmentsCard").hidden = false;
      $("cricKanbanLink").hidden = false;
      $("cricKanbanPending").hidden = true;
      $("cricDeadlinesLink").hidden = false;
      $("cricDeadlinesPending").hidden = true;
      $("cricInvoicesLink").hidden = false;
      $("cricInvoicesPending").hidden = true;
      $("cricClientsLink").href = "gestion-clients-cric.html";
      $("cricDossiersLink").href = "gestion-dossiers-cric.html";
      $("cricClientsLink").hidden = false;
      $("cricDossiersLink").hidden = false;
      $("cricClientsPending").hidden = true;
      $("cricDossiersPending").hidden = true;
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
              { p_space_id: space.id }
            );
            if (error) throw error;
            const notifications = data || [];
            const unread = notifications.filter((n) => !n.is_read).length;
            counter.textContent = String(unread);
            counter.hidden = unread === 0;
            summary.textContent = notifications.length
              ? `${unread} notification(s) non lue(s) parmi les ${notifications.length} dernières affichées.`
              : "Aucune notification client pour le moment.";
            list.replaceChildren();
            for (const notification of notifications) {
              const item = document.createElement("li");
              item.className = "madic-cric-notification" + (notification.is_read ? "" : " madic-cric-notification-unread");
              const details = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = notification.title || "Activité client";
              const message = document.createElement("p");
              const clientName = (notification.client_name || "").trim();
              message.textContent = clientName
                ? `${clientName}- ${notification.message || ""}`
                : notification.message || "";
              const date = document.createElement("time");
              date.dateTime = notification.created_at;
              date.textContent = new Intl.DateTimeFormat("fr-CA", {
                timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short"
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
                      { p_notification_id: notification.id }
                    );
                    if (markError) throw markError;
                    if (marked !== true) throw Error("Notification non autorisée ou introuvable.");
                    await loadClientNotifications();
                  } catch (err) {
                    summary.textContent = "Modification impossible : " + (err.message || String(err));
                    button.disabled = false;
                  }
                });
                item.append(button);
              }
              list.append(item);
            }
          } catch (err) {
            summary.textContent = "Notifications indisponibles : " + (err.message || String(err));
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
