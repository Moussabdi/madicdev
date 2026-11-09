/* Source: cric-dashboard(20261109-013822).js */
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


/* Source: cric-approved-tracking(2).js */
/* Suivi administratif des prévalidations approuvées. Aucune création de compte. */
(async () => {
  "use strict";
  const body = document.getElementById("cricApprovedPrevalidations");
  const notice = document.getElementById("cricApprovedNotice");
  if (!body) return;
  const show = (message) => {
    if (notice) notice.textContent = message;
  };
  const cell = (row, value) => {
    const td = row.insertCell();
    td.textContent = String(value ?? "-");
    return td;
  };
  try {
    const db = window.getMadicSupabase?.();
    if (!db) throw new Error("Configuration Supabase indisponible.");
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user)
      throw new Error("Connexion administrateur requise.");
    const { data: isOwner, error: roleError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (roleError || isOwner !== true)
      throw new Error("Accès réservé au super administrateur.");
    const [pre, apps] = await Promise.all([
      db.rpc("madic_admin_list_cric_prevalidations"),
      db
        .from("madic_cric_applications")
        .select("user_id,license_number,status"),
    ]);
    if (pre.error) throw pre.error;
    if (apps.error) throw apps.error;
    const approved = (pre.data || []).filter(
      (item) => item.status === "approved",
    );
    const accounts = new Map(
      (apps.data || []).map((item) => [
        String(item.license_number).toUpperCase(),
        item,
      ]),
    );
    body.replaceChildren();
    if (!approved.length) {
      const row = body.insertRow();
      cell(row, "Aucune prévalidation approuvée.").colSpan = 6;
      return;
    }
    for (const item of approved) {
      const row = body.insertRow();
      const account = accounts.get(String(item.license_number).toUpperCase());
      cell(row, item.full_name);
      cell(row, item.license_number);
      cell(row, item.registry_verified ? "Confirmée" : "Non confirmée");
      cell(row, "Approuvée par MADIC");
      cell(
        row,
        !account
          ? "Aucun compte associé"
          : account.status === "approved"
            ? "Compte autorisé"
            : `Compte : ${account.status}`,
      );
      cell(
        row,
        !account
          ? "Invitation / association sécurisée à effectuer"
          : "Voir le tableau des comptes ci-dessus",
      );
    }
  } catch (e) {
    show("Impossible de charger le suivi CRIC : " + (e?.message || String(e)));
    body.replaceChildren();
    const row = body.insertRow();
    cell(row, "Données indisponibles.").colSpan = 6;
  }
})();


/* Source: madic-admin-cabinets(2).js */
/* MADIC - Administration des cabinets. Mutations uniquement via RPC super-admin. */
(async () => {
  "use strict";
  const rows = document.getElementById("cricSpaceRows");
  const notice = document.getElementById("cricSpaceNotice");
  if (!rows || !notice) return;
  const db = window.getMadicSupabase();
  const label = (v) =>
    ({
      free: "Gratuit",
      paid: "Payant",
      active: "Actif",
      suspended: "Suspendu",
      not_applicable: "Sans objet",
      pending: "En attente",
      paid_up: "À jour",
    })[v] ||
    v ||
    "-";
  function button(title, handler) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "secondary";
    el.textContent = title;
    el.addEventListener("click", async () => {
      if (!confirm(`Confirmer : ${title} ?`)) return;
      el.disabled = true;
      notice.textContent = "Traitement en cours…";
      try {
        await handler();
        await load();
        notice.textContent = "Opération enregistrée.";
      } catch (e) {
        notice.textContent = "Erreur : " + (e.message || String(e));
        el.disabled = false;
      }
    });
    return el;
  }
  async function rpc(action, userId, extra = {}) {
    const { error } = await db.rpc("madic_admin_manage_cabinet", {
      p_user_id: userId,
      p_action: action,
      p_plan: null,
      p_reason: null,
      ...extra,
    });
    if (error) throw error;
  }
  async function load() {
    const { data: apps, error: ae } = await db
      .from("madic_cric_applications")
      .select("user_id,full_name,license_number,status")
      .order("full_name");
    if (ae) throw ae;
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select(
        "id,owner_user_id,name,subscription_plan,payment_status,access_status,next_payment_due",
      );
    if (se) throw se;
    const byOwner = new Map((spaces || []).map((s) => [s.owner_user_id, s]));
    rows.replaceChildren();
    const paymentRows = document.getElementById("cricPaymentRows");
    const paymentNotice = document.getElementById("cricPaymentNotice");
    if (paymentRows) paymentRows.replaceChildren();
    for (const app of apps || []) {
      if (paymentRows && app.status === "approved") {
        const ps = byOwner.get(app.user_id);
        const pr = paymentRows.insertRow();
        [
          app.full_name,
          ps?.name || "Non créé",
          label(ps?.subscription_plan),
          label(ps?.payment_status),
          ps?.next_payment_due || "-",
        ].forEach((value) => {
          pr.insertCell().textContent = value;
        });
      }
      const s = byOwner.get(app.user_id),
        tr = rows.insertRow();
      [
        app.full_name + " (" + app.license_number + ")",
        s?.name || "Non créé",
        label(s?.subscription_plan),
        label(s?.payment_status),
        label(s?.access_status),
      ].forEach((v) => (tr.insertCell().textContent = v));
      const actions = tr.insertCell();
      if (app.status !== "approved") {
        actions.textContent = "Demande non approuvée";
        continue;
      }
      if (!s) {
        actions.append(
          button("Créer le cabinet", () => rpc("create", app.user_id)),
        );
        continue;
      }
      const plan = document.createElement("select");
      plan.setAttribute("aria-label", "Formule de " + app.full_name);
      for (const [value, text] of [
        ["free", "Gratuit"],
        ["paid", "Payant"],
      ]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        plan.append(opt);
      }
      plan.value = s.subscription_plan;
      actions.append(
        plan,
        document.createTextNode(" "),
        button("Modifier la formule", () =>
          rpc("plan", app.user_id, { p_plan: plan.value }),
        ),
      );
      actions.append(document.createTextNode(" "));
      if (s.access_status === "active")
        actions.append(
          button("Suspendre", async () => {
            const reason = prompt("Motif de suspension (obligatoire) :");
            if (!reason?.trim()) throw new Error("Motif obligatoire.");
            await rpc("suspend", app.user_id, { p_reason: reason.trim() });
          }),
        );
      else
        actions.append(button("Activer", () => rpc("activate", app.user_id)));
    }
    if (!apps?.length) {
      const td = rows.insertRow().insertCell();
      td.colSpan = 6;
      td.textContent = "Aucun consultant enregistré.";
    }
    if (paymentRows && !paymentRows.rows.length) {
      const td = paymentRows.insertRow().insertCell();
      td.colSpan = 5;
      td.textContent = "Aucun abonnement CRIC approuvé à afficher.";
    }
    if (paymentNotice)
      paymentNotice.textContent =
        "Statuts administratifs des abonnements chargés. Aucun paiement n’est confirmé depuis cette page.";
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) throw Error("Session non authentifiée.");
    const { data: isAdmin, error: adminError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (adminError) throw adminError;
    if (isAdmin !== true) throw Error("Accès réservé au super administrateur.");
    await load();
    notice.textContent = "Gestion des cabinets disponible.";
  } catch (e) {
    notice.textContent = "Chargement impossible : " + (e.message || String(e));
  }
})();


/* Source: madic-footer(20261109-013844).js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* Source: madic-datahubz-unified(20261109-013853).js */
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


/* Source: madic-admin-sections(1).js */
/* MADIC - sections et tableaux, sans mutation Supabase ni changement des actions existantes. */
(() => {
  "use strict";
  const ids = [
    "consultants-management",
    "cabinet-management",
    "payment-management",
  ];
  const nav = [...document.querySelectorAll(".madic-unified-sidebar nav a")];
  const tabs = [...document.querySelectorAll("[data-admin-section]")];
  const getSection = () =>
    ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : ids[0];
  function activate() {
    const current = getSection();
    for (const id of ids) document.getElementById(id).hidden = id !== current;
    for (const a of [...nav, ...tabs]) {
      const target = a.getAttribute("href")?.split("#")[1];
      if (ids.includes(target) && target === current)
        a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange", () => {
    activate();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  activate();
  const pageSize = 20;
  for (const tools of document.querySelectorAll(".madic-admin-table-tools")) {
    const tbody = document.getElementById(tools.dataset.table);
    if (!tbody) continue;
    const input = tools.querySelector("input");
    const count = tools.querySelector(".madic-admin-table-count");
    const prev = tools.querySelector("[data-prev]");
    const next = tools.querySelector("[data-next]");
    const info = tools.querySelector("[data-page-info]");
    let page = 0;
    function render() {
      const all = [...tbody.rows];
      const query = input.value.trim().toLocaleLowerCase("fr");
      const filtered = all.filter(
        (row) =>
          !query || row.textContent.toLocaleLowerCase("fr").includes(query),
      );
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      page = Math.min(page, pages - 1);
      const visible = new Set(
        filtered.slice(page * pageSize, (page + 1) * pageSize),
      );
      for (const row of all) row.hidden = !visible.has(row);
      count.textContent = `${filtered.length} résultat(s)`;
      info.textContent = `Page ${page + 1} / ${pages}`;
      prev.disabled = page === 0;
      next.disabled = page >= pages - 1;
    }
    input.addEventListener("input", () => {
      page = 0;
      render();
    });
    prev.addEventListener("click", () => {
      page--;
      render();
    });
    next.addEventListener("click", () => {
      page++;
      render();
    });
    const observer = new MutationObserver(() => render());
    observer.observe(tbody, { childList: true });
    render();
  }
})();

/* Original inline navigation logic */

      (function () {
        function sync() {
          const h = location.hash;
          document
            .querySelectorAll(".madic-unified-sidebar nav a")
            .forEach((a) => {
              if (
                a.getAttribute("href") ===
                  "gestion-cric.html#payment-management" ||
                a.getAttribute("href") ===
                  "gestion-cric.html#cabinet-management"
              ) {
                if (h && a.getAttribute("href").endsWith(h))
                  a.setAttribute("aria-current", "page");
                else a.removeAttribute("aria-current");
              } else if (a.getAttribute("href") === "gestion-cric.html") {
                if (!h) a.setAttribute("aria-current", "page");
                else a.removeAttribute("aria-current");
              }
            });
        }
        window.addEventListener("hashchange", sync);
        sync();
      })();
    

/* Gestion CRIC: gestion bilingue locale, sans dépendance supplémentaire. */
(() => {
 "use strict";
 const phrases = new Map(Object.entries({
  "Configuration Supabase manquante.":"Supabase configuration is missing.",
  "Accès réservé au super administrateur MADIC.":"Access restricted to the MADIC super administrator.",
  "Aucun CRIC inscrit.":"No RCIC registered.","En attente":"Pending","Autorisé":"Authorized","Refusé":"Rejected",
  "Décision enregistrée":"Decision recorded","Décision enregistrée.":"Decision saved.","Autoriser":"Approve","Refuser":"Reject",
  "Note interne (facultative) :":"Internal note (optional):","Erreur :":"Error:",
  "Aucune prévalidation approuvée.":"No approved prevalidations.","Confirmée":"Confirmed","Non confirmée":"Not confirmed",
  "Approuvée par MADIC":"Approved by MADIC","Aucun compte associé":"No linked account","Compte autorisé":"Account authorized",
  "Invitation / association sécurisée à effectuer":"Secure invitation / account linking required","Voir le tableau des comptes ci-dessus":"See the account table above",
  "Données indisponibles.":"Data unavailable.","Gratuit":"Free","Payant":"Paid","Actif":"Active","Suspendu":"Suspended",
  "Sans objet":"Not applicable","À jour":"Up to date","Non créé":"Not created","Demande non approuvée":"Application not approved",
  "Créer le cabinet":"Create firm","Modifier la formule":"Change plan","Suspendre":"Suspend","Activer":"Activate",
  "Traitement en cours…":"Processing…","Opération enregistrée.":"Operation saved.","Motif obligatoire.":"Reason required.",
  "Aucun consultant enregistré.":"No consultant registered.","Aucun abonnement CRIC approuvé à afficher.":"No approved RCIC subscription to display.",
  "Statuts administratifs des abonnements chargés. Aucun paiement n’est confirmé depuis cette page.":"Administrative subscription statuses loaded. No payment is confirmed on this page.",
  "Gestion des cabinets disponible.":"Firm management available.","Chargement…":"Loading…",
  "Vérification des droits du super administrateur…":"Checking super administrator permissions…"
 }));
 const reverse = new Map([...phrases].map(([fr,en])=>[en,fr]));
 const original = new WeakMap();
 let language="fr", busy=false;
 const translate = (value, lang) => {
   const raw=String(value); const trim=raw.trim();
   const fr=reverse.get(trim)||trim;
   let translated=lang==="en"?(phrases.get(fr)||fr):fr;
   if(lang==="en" && translated===fr){
     const prefixes=[
       [/^Erreur : (.*)$/,"Error: $1"],[/^Chargement impossible : (.*)$/,"Unable to load: $1"],
       [/^Impossible de charger le suivi CRIC : (.*)$/,"Unable to load RCIC tracking: $1"],
       [/^Impossible de vérifier vos droits : (.*)$/,"Unable to verify permissions: $1"],
       [/^Compte : (.*)$/,"Account: $1"],[/^Confirmer : (.*) \?$/,"Confirm: $1?"],
       [/^Page (\d+) \/ (\d+)$/,"Page $1 / $2"],[/^(\d+) résultat\(s\)$/,"$1 result(s)"]
     ];
     for(const [pattern,replacement] of prefixes) if(pattern.test(fr)){translated=fr.replace(pattern,replacement);break;}
   }
   return raw.replace(trim,translated);
 };
 function apply(){
   if(busy)return;busy=true;
   try {
     document.documentElement.lang=language==="en"?"en":"fr-CA";
     document.title=language==="en"?"RCIC Management | MADIC":"Gestion des CRIC | MADIC";
     document.querySelectorAll(".madic-unified-brand strong[data-fr][data-en],header .brand small[data-fr][data-en]").forEach(el=>{el.textContent=el.getAttribute("data-"+language);});
     document.querySelectorAll('[data-fr][data-en]').forEach(el=>{
       const value=el.getAttribute('data-'+language);
       if(el.children.length===0 && el.textContent!==value)el.textContent=value;
     });
     document.querySelectorAll('[data-placeholder-fr]').forEach(el=>el.placeholder=el.getAttribute('data-placeholder-'+language));
     document.querySelectorAll('[data-aria-label-fr]').forEach(el=>el.setAttribute('aria-label',el.getAttribute('data-aria-label-'+language)));
     document.querySelectorAll('#madicHeroLanguage button[data-lang]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.lang===language)));
     const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
     const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
     for(const node of nodes){
       const parent=node.parentElement;if(!parent||parent.closest('script,style,[data-fr][data-en]'))continue;
       const current=node.nodeValue;if(!current.trim())continue;
       let fr=original.get(node);
       if(fr===undefined || (current!==fr && current!==translate(fr,"en"))){fr=reverse.get(current.trim())||current;original.set(node,fr);}
       const next=translate(fr,language);if(current!==next)node.nodeValue=next;
     }
   } finally {busy=false;}
 }
 function change(lang){language=lang==="en"?"en":"fr";try{localStorage.setItem('madic-lang',language)}catch(e){}apply();}
 try{const query=new URLSearchParams(location.search).get('lang');language=(query||localStorage.getItem('madic-lang'))==="en"?"en":"fr";}catch(e){}
 document.querySelectorAll('#madicHeroLanguage button[data-lang]').forEach(btn=>btn.addEventListener('click',()=>change(btn.dataset.lang)));
 const observer=new MutationObserver(()=>{if(!busy)apply();});
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 apply();
 window.addEventListener('storage',event=>{if(event.key==='madic-lang')change(event.newValue)});
})();
