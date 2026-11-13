/* Scripts autonomes : mes-rendez-vous-cric.html */

/* Source consolidee : madic-appointments-client(20261107-040956).js */
(async () => {
  "use strict";
  const isEnglish = () => { try { return (localStorage.getItem("madic_ui_language") || "fr") === "en"; } catch (_) { return document.documentElement.lang.startsWith("en"); } };
  const L = (fr, en) => isEnglish() ? en : fr;
  const refreshTranslation = () => { if (typeof window.madicTranslateAppointments === "function") window.madicTranslateAppointments(); };
  const $ = (id) => document.getElementById(id),
    notice = (t) => { $("rdvNotice").textContent = t; refreshTranslation(); };
  if (typeof window.getMadicSupabase !== "function")
    return notice(L("Configuration Supabase manquante.", "Supabase configuration is missing."));
  const db = window.getMadicSupabase();
  let spaces = [],
    slots = [];
  let weekOffset = 0;
  let durationMinutes = 60;
  function durationPicker() {
    if ($("rdvDurationPicker")) return;
    const host = $("rdvCalendar");
    if (!host) return;
    const wrap = document.createElement("div");
    wrap.id = "rdvDurationPicker";
    
    const label = document.createElement("label");
    label.textContent = L("Durée du rendez-vous : ", "Appointment duration: ");
    label.htmlFor = "rdvDuration";
    const select = document.createElement("select");
    select.id = "rdvDuration";
    select.add(new Option(L("1 heure", "1 hour"), "60"));
    select.add(new Option(L("2 heures", "2 hours"), "120"));
    select.value = String(durationMinutes);
    select.onchange = () => {
      durationMinutes = Number(select.value);
      load().catch((e) => notice(e.message));
    };
    wrap.append(label, select);
    host.parentNode.insertBefore(wrap, host);
  }
  async function bookPeriod(s) {
    if (
      !confirm(
        L(`Demander un rendez-vous du ${date(s.starts_at)} au ${date(s.ends_at)} ?`, `Request an appointment from ${date(s.starts_at)} to ${date(s.ends_at)}?`),
      )
    )
      return;
    const { error } = await db.rpc("madic_rdv_book_period", {
      p_slot_id: s.id,
      p_start: s.starts_at,
      p_end: s.ends_at,
    });
    if (error) throw error;
    notice(L("Demande envoyée au consultant, en attente de confirmation.", "Request sent to your consultant, pending confirmation."));
  }
  const date = (t) =>
    new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(t));
  const td = (r, t) => {
    const c = r.insertCell();
    c.textContent = t ?? "-";
    return c;
  };
  const mode = {
    video: "Visioconférence",
    phone: "Téléphone",
    in_person: "En personne",
  };
  const modeEn = { video: "Video conference", phone: "Phone", in_person: "In person" };
  const statusEn = { requested: "Pending confirmation", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" };
  const notificationLabelsEn = { requested: "New appointment request", confirmed: "Your appointment has been confirmed", declined: "Your appointment request was declined", cancelled: "An appointment was cancelled" };
  const status = {
    requested: "En attente de confirmation",
    confirmed: "Confirmé",
    declined: "Refusé",
    cancelled: "Annulé",
  };
  const action = (name, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = name;
    b.onclick = async () => {
      b.disabled = true;
      try {
        await fn();
        await load();
      } catch (e) {
        notice(e.message);
      } finally {
        b.disabled = false;
      }
    };
    return b;
  };
  function renderCalendar() {
    const container = $("rdvCalendar");
    if (!container) return;
    container.replaceChildren();
    // Week boundaries use Montreal civil dates, not the browser's local timezone.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((x) => [x.type, x.value]),
    );
    const today = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
    const monday = new Date(today);
    monday.setUTCDate(
      monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + weekOffset * 7,
    );
    const last = new Date(monday);
    last.setUTCDate(last.getUTCDate() + 6);
    const key = (d) => d.toISOString().slice(0, 10);
    const label = (d) =>
      new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(d);
    $("rdvWeekLabel").textContent = `${label(monday)} – ${label(last)}`;
    $("rdvPrevWeek").disabled = weekOffset <= 0;
    refreshTranslation();
    const dateKey = (iso) => {
      const p = Object.fromEntries(
        fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
      );
      return `${p.year}-${p.month}-${p.day}`;
    };
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setUTCDate(day.getUTCDate() + i);
      const column = document.createElement("section");
      column.className =
        "madic-rdv-day" + (key(day) === key(today) ? " madic-rdv-today" : "");
      const heading = document.createElement("h3");
      heading.textContent = label(day);
      column.append(heading);
      const daySlots = slots.filter((s) => dateKey(s.starts_at) === key(day));
      if (!daySlots.length) {
        const empty = document.createElement("p");
        empty.className = "madic-rdv-muted";
        empty.textContent = L("Aucun créneau", "No available slots");
        column.append(empty);
      }
      for (const s of daySlots) {
        const time = new Intl.DateTimeFormat(isEnglish() ? "en-CA" : "fr-CA", {
          timeZone: "America/Toronto",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(s.starts_at));
        const b = action(
          `${time} · ${durationMinutes / 60} h · ${L("Demander", "Request")}`,
          async () => {
            await bookPeriod(s);
          },
        );
        b.classList.add("madic-rdv-slot-button");
        b.title = L(mode[s.mode] || s.mode, modeEn[s.mode] || s.mode);
        column.append(b);
      }
      container.append(column);
    }
  }

  const notificationLabels = {
    requested: "Nouvelle demande de rendez-vous",
    confirmed: "Votre rendez-vous a été confirmé",
    declined: "Votre demande de rendez-vous a été refusée",
    cancelled: "Un rendez-vous a été annulé",
  };
  function setupNotifications() {
    if ($("rdvNotifications")) return;
    const section = document.createElement("section");
    section.className = "panel madic-rdv-notifications";
    section.id = "rdvNotifications";
    const heading = document.createElement("h2");
    heading.textContent = L("Notifications de rendez-vous", "Appointment notifications");
    const summary = document.createElement("p");
    summary.id = "rdvNotificationSummary";
    summary.className = "madic-rdv-muted";
    const list = document.createElement("div");
    list.id = "rdvNotificationList";
    section.append(heading, summary, list);
    $("rdvApp").prepend(section);
  }
  async function loadNotifications(currentSpaceId) {
    const list = $("rdvNotificationList");
    if (!list) return;
    const { data, error } = await db
      .from("madic_rdv_notifications")
      .select("id,event_type,created_at,read_at")
      .eq("space_id", currentSpaceId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      $("rdvNotificationSummary").textContent =
        L("Notifications indisponibles: ", "Notifications unavailable: ") + error.message;
      return;
    }
    list.replaceChildren();
    const unread = (data || []).filter((n) => !n.read_at).length;
    $("rdvNotificationSummary").textContent = unread
      ? L(`${unread} notification(s) non lue(s).`, `${unread} unread notification(s).`)
      : L("Aucune notification non lue.", "No unread notifications.");
    if (!data?.length) {
      const p = document.createElement("p");
      p.textContent = L("Aucune notification pour le moment.", "No notifications at this time.");
      list.append(p);
    }
    for (const n of data || []) {
      const line = document.createElement("div");
      line.className =
        "madic-rdv-notification" +
        (n.read_at ? "" : " madic-rdv-notification-unread");
      const info = document.createElement("span");
      info.textContent = `${L(notificationLabels[n.event_type] || n.event_type, notificationLabelsEn[n.event_type] || n.event_type)} · ${date(n.created_at)}`;
      if (!n.read_at) info.classList.add("madic-rdv-notification-title");
      line.append(info);
      if (!n.read_at) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "secondary";
        b.textContent = L("Marquer comme lue", "Mark as read");
        b.onclick = async () => {
          b.disabled = true;
          const { error } = await db.rpc("madic_rdv_mark_notification_read", {
            p_notification_id: n.id,
          });
          if (error) {
            notice("Notification : " + error.message);
            b.disabled = false;
            return;
          }
          await loadNotifications(currentSpaceId);
        };
        line.append(b);
      }
      list.append(line);
    }
    refreshTranslation();
  }

  async function load() {
    const spaceId = $("rdvSpace").value;
    if (!spaces.some((x) => x.space_id === spaceId))
      throw Error(L("Cabinet non autorisé.", "Unauthorized firm."));
    const [sr, ar] = await Promise.all([
      db.rpc("madic_rdv_available_periods", {
        p_space_id: spaceId,
        p_duration_minutes: durationMinutes,
      }),
      db
        .from("madic_cric_appointments")
        .select("id,slot_id,status,starts_at,ends_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false }),
    ]);
    if (sr.error) throw sr.error;
    if (ar.error) throw ar.error;
    // La RPC exclut les reservations actives de TOUS les clients du cabinet.
    // Un second controle cote client ecarte les creneaux devenus passes.
    slots = (sr.data || []).filter((s) => Date.parse(s.starts_at) > Date.now());
    renderCalendar();
    const sb = $("slotRows");
    sb.replaceChildren();
    for (const s of slots) {
      const r = sb.insertRow();
      td(r, date(s.starts_at));
      td(r, date(s.ends_at));
      td(r, L(mode[s.mode], modeEn[s.mode]));
      r.insertCell().append(
        action(`${L("Demander", "Request")} ${durationMinutes / 60} h`, async () => {
          await bookPeriod(s);
          notice(L("Demande envoyée au consultant, en attente de confirmation.", "Request sent to your consultant, pending confirmation."));
        }),
      );
    }
    if (!slots.length) {
      const r = sb.insertRow();
      r.insertCell().colSpan = 4;
      r.cells[0].textContent = L("Aucun créneau disponible pour le moment.", "No time slots available at this time.");
    }
    const allIds = [...new Set((ar.data || []).map((x) => x.slot_id))];
    let slotMap = new Map(slots.map((s) => [s.id, s]));
    if (allIds.length) {
      const { data, error } = await db
        .from("madic_cric_appointment_slots")
        .select("id,starts_at,ends_at,mode")
        .in("id", allIds);
      if (error) throw error;
      for (const s of data || []) slotMap.set(s.id, s);
    }
    const br = $("bookingRows");
    br.replaceChildren();
    for (const a of ar.data || []) {
      const s = slotMap.get(a.slot_id);
      const r = br.insertRow();
      td(
        r,
        a.starts_at && a.ends_at
          ? `${date(a.starts_at)} – ${date(a.ends_at)}`
          : s
            ? `${date(s.starts_at)} – ${date(s.ends_at)}`
            : "-",
      );
      td(r, s ? L(mode[s.mode], modeEn[s.mode]) : "-");
      const statusCell = td(r, L(status[a.status] || a.status, statusEn[a.status] || a.status));
      statusCell.classList.add(
        "madic-rdv-status",
        `madic-rdv-status-${a.status}`,
      );
      const detail = r.insertCell();
      detail.textContent =
        a.status === "confirmed"
          ? L("Disponible via « Voir le lien »", "Available via ‘View link’")
          : a.status === "requested"
            ? L("Communiqué après confirmation", "Provided after confirmation")
            : "-";
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (a.status === "confirmed")
        cell.append(
          action(L("Voir le lien", "View link"), async () => {
            const { data, error } = await db.rpc("madic_rdv_meeting_details", {
              p_appointment_id: a.id,
            });
            if (error) throw error;
            alert(
              data?.[0]?.location_info ||
                L("Le consultant n’a pas indiqué de lieu ou lien.", "The consultant has not provided a location or link."),
            );
          }),
        );
      if (["requested", "confirmed"].includes(a.status))
        cell.append(
          action(L("Annuler", "Cancel"), async () => {
            if (!confirm(L("Annuler ce rendez-vous ?", "Cancel this appointment?"))) return;
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "cancelled",
            });
            if (error) throw error;
          }),
        );
    }
    if (!ar.data?.length) {
      const r = br.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = L("Aucun rendez-vous demandé.", "No appointments requested.");
    }
    await loadNotifications(spaceId);
    refreshTranslation();
    notice(L("Rendez-vous chargés.", "Appointments loaded."));
  }
  window.madicRdvRefreshLocale = () => {
    renderCalendar();
    durationPicker();
    const durationLabel = document.querySelector("#rdvDurationPicker label");
    if (durationLabel) durationLabel.textContent = L("Durée du rendez-vous : ", "Appointment duration: ");
    const durationSelect = $("rdvDuration");
    if (durationSelect) { durationSelect.options[0].textContent = L("1 heure", "1 hour"); durationSelect.options[1].textContent = L("2 heures", "2 hours"); }
    load().catch(e => notice(e.message));
  };
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error(L("Connexion client requise.", "Client sign-in required."));
    const { data, error } = await db.rpc("madic_my_cric_client_spaces");
    if (error) throw error;
    spaces = data || [];
    if (!spaces.length) throw Error(L("Aucun cabinet associé.", "No associated firm."));
    for (const s of spaces) {
      const opt = document.createElement("option");
      opt.value = s.space_id;
      opt.textContent = s.space_name;
      $("rdvSpace").append(opt);
    }
    $("rdvSpace").onchange = () => {
      weekOffset = 0;
      load().catch((e) => notice(e.message));
    };
    $("rdvPrevWeek").onclick = () => {
      weekOffset = Math.max(0, weekOffset - 1);
      renderCalendar();
    };
    $("rdvNextWeek").onclick = () => {
      weekOffset++;
      renderCalendar();
    };
    setupNotifications();
    durationPicker();
    $("rdvApp").hidden = false;
    await load();
  } catch (e) {
    notice(L("Chargement impossible: ", "Unable to load: ") + e.message);
  }
})();


/* Source consolidee : madic-client-sidebar(5).js */
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
    toggle.textContent = editing ? (localStorage.getItem("madic_ui_language") === "en" ? "Done" : "Terminer") : (localStorage.getItem("madic_ui_language") === "en" ? "Customize menu" : "Personnaliser le menu");
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


/* Source consolidee : madic-footer(2).js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=String(lang).toLowerCase().startsWith("en")?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic_ui_language")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* Script local original 1 */

      /* Explicit click-only interface translation. No observer, no form value changes. */
      (function () {
        "use strict";
        const dict = {
          "Espace client": "Client space",
          "ESPACE CLIENT · CONSULTATIONS": "CLIENT SPACE · CONSULTATIONS",
          "Choisissez un créneau, suivez vos demandes et retrouvez les informations de vos consultations.": "Choose a time slot, track your requests and find your consultation details.",
          "Les horaires sont affichés à l'heure de Montréal (heure de l'Est). Vérifiez le décalage avec votre pays.": "Times are shown in Montréal time (Eastern Time). Check the time difference with your country.",
          "Réinitialiser": "Reset",
          "Terminer": "Done",
          "Glissez les éléments ou utilisez les flèches pour choisir votre ordre.": "Drag items or use the arrows to choose their order.",
          "Glisser pour déplacer": "Drag to move",
          "Monter": "Move up",
          "Descendre": "Move down",
          "Outils du compte": "Account tools",
          "Notifications de messagerie": "Messaging notifications",
          "Navigation de mon espace client": "Client space navigation",
          "Menu personnalisable": "Customizable menu",
          "Calendrier des créneaux disponibles": "Available time slots calendar",
          "Mes rendez-vous": "My appointments",
          "Vérification des accès…": "Checking access…",
          "Pied de page MADIC / MADIC footer": "MADIC footer",
          "Liens du pied de page": "Footer links",
          "Page à venir / Page coming soon": "Page coming soon",
          "Déconnexion": "Sign out",
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
            if (typeof window.madicRdvRefreshLocale === "function") window.madicRdvRefreshLocale();
          });
          wrap.appendChild(b);
          buttons[code] = b;
        }
        slot.appendChild(wrap);
        function translate() {
          const map = lang === "en" ? dict : reverse;
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(n) {
                return n.parentElement &&
                  n.parentElement.closest(
                    'script,style,textarea,option,[contenteditable="true"]',
                  )
                  ? NodeFilter.FILTER_REJECT
                  : NodeFilter.FILTER_ACCEPT;
              },
            },
          );
          let node;
          while ((node = walker.nextNode())) {
            const raw = node.nodeValue,
              word = raw.trim().replace(/\s+/g, " ");
            if (Object.prototype.hasOwnProperty.call(map, word))
              node.nodeValue = raw.replace(raw.trim(), map[word]);
          }
          for (const el of document.querySelectorAll(
            "[placeholder],[aria-label],[title]",
          )) {
            for (const a of ["placeholder", "aria-label", "title"]) {
              const v = el.getAttribute(a);
              if (v && Object.prototype.hasOwnProperty.call(map, v))
                el.setAttribute(a, map[v]);
            }
          }
        }
        function apply() {
          document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
          translate();
          for (const code of ["fr", "en"])
            buttons[code].setAttribute("aria-pressed", String(code === lang));
        }
        window.madicTranslateAppointments = translate;
        apply();
      })();
    

/* Script local original 2 */

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
    
