/* MADIC Supabase configuration - bundled from supplied config.js */
window.MADIC_CONFIG = {
  url: "https://ezijsozitnydhjkxzqem.supabase.co",
  anonKey: "sb_publishable_MQjW5_va454CjZ7weau0iQ_AdJ41yvi",
};
window.getMadicSupabase = function () {
  if (!window.madicSupabaseClient) {
    const cfg = window.MADIC_CONFIG;

    window.madicSupabaseClient = window.supabase.createClient(
      cfg.url,
      cfg.anonKey,
    );
  }

  return window.madicSupabaseClient;
};


/* SOURCE: madic-appointments-cric.js */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (t) => ($("rdvNotice").textContent = t);
  if (typeof window.getMadicSupabase !== "function")
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let spaceId,
    slots = [];
  const english = () => localStorage.getItem("madic_ui_language") === "en";
  const tr = (fr, en) => english() ? en : fr;
  const date = (t) =>
    new Intl.DateTimeFormat(english() ? "en-CA" : "fr-CA", {
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
    get video() { return tr("Visioconférence", "Video call"); },
    get phone() { return tr("Téléphone", "Phone call"); },
    get in_person() { return tr("En personne", "In person"); },
  };
  const status = {
    get requested() { return tr("Demandé", "Requested"); },
    get confirmed() { return tr("Confirmé", "Confirmed"); },
    get declined() { return tr("Refusé", "Declined"); },
    get cancelled() { return tr("Annulé", "Cancelled"); },
  };
  const button = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = label;
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
  function localToIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
      throw Error("Date invalide");
    // Saisie locale interpretee dans le fuseau de Montreal, y compris les transitions DST.
    const [ymd, hm] = value.split("T");
    const [y, m, d] = ymd.split("-").map(Number),
      [h, mi] = hm.split(":").map(Number);
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const expected = `${ymd}T${hm}`;
    let matches = [];
    const base = Date.UTC(y, m - 1, d, h, mi);
    for (let delta = -12 * 60; delta <= 12 * 60; delta += 30) {
      const t = new Date(base + delta * 60000);
      const parts = Object.fromEntries(
        fmt.formatToParts(t).map((x) => [x.type, x.value]),
      );
      const found = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
      if (found === expected) matches.push(t.toISOString());
    }
    if (matches.length !== 1)
      throw Error(
        "Heure ambiguë ou inexistante lors du changement d’heure : choisissez une autre heure.",
      );
    return matches[0];
  }
  // Les champs datetime-local n'ont pas de fuseau horaire : min est calcule a Montreal.
  function montrealNowMin() {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  function montrealLocal(instant) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  // Date et heure separees : aucune minute n'est proposee au CRIC.
  function updateDateLimits() {
    const day = $("slotDate"),
      hour = $("slotHour");
    const startInput = $("slotStart"),
      endInput = $("slotEnd");
    const now = montrealNowMin();
    day.min = now.slice(0, 10);
    if (day.value && day.value < day.min) day.value = "";
    const previous = hour.value;
    hour.replaceChildren(new Option("Choisir une heure", ""));
    if (day.value) {
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, "0");
        const local = `${day.value}T${hh}:00`;
        try {
          const instant = localToIso(local);
          if (Date.parse(instant) <= Date.now()) continue;
          hour.add(new Option(`${hh} h 00`, hh));
        } catch (_) {
          /* Heure inexistante ou ambigue lors du changement d'heure. */
        }
      }
    }
    if ([...hour.options].some((o) => o.value === previous))
      hour.value = previous;
    else hour.value = "";
    startInput.value =
      day.value && hour.value ? `${day.value}T${hour.value}:00` : "";
    endInput.value = "";
    if (!startInput.value) return;
    try {
      const start = localToIso(startInput.value);
      const duration = Number($("slotDuration").value);
      if (
        !Number.isInteger(duration) ||
        duration < 60 ||
        duration > 480 ||
        duration % 60
      )
        return;
      const finish = montrealLocal(
        new Date(Date.parse(start) + duration * 60000),
      );
      endInput.value = finish.replace("T", " à ") + " (Montréal)";
    } catch (_) {
      /* Conserver la fin vide si invalide. */
    }
  }
  function initializeDateLimits() {
    $("slotDate").addEventListener("change", updateDateLimits);
    $("slotDate").addEventListener("focus", updateDateLimits);
    $("slotHour").addEventListener("change", updateDateLimits);
    $("slotDuration").addEventListener("change", updateDateLimits);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) updateDateLimits();
    });
    updateDateLimits();
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
    section.className = "panel";
    section.id = "rdvNotifications";
    const heading = document.createElement("h2");
    heading.textContent = "Notifications de rendez-vous";
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
        "Notifications indisponibles : " + error.message;
      return;
    }
    list.replaceChildren();
    const unread = (data || []).filter((n) => !n.read_at).length;
    $("rdvNotificationSummary").textContent = unread
      ? `${unread} notification(s) non lue(s).`
      : "Aucune notification non lue.";
    if (!data?.length) {
      const p = document.createElement("p");
      p.textContent = "Aucune notification pour le moment.";
      list.append(p);
    }
    for (const n of data || []) {
      const line = document.createElement("div");
      line.style.cssText =
        "display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #ddd";
      const info = document.createElement("span");
      info.textContent = `${notificationLabels[n.event_type] || n.event_type} - ${date(n.created_at)}`;
      if (!n.read_at) info.style.fontWeight = "700";
      line.append(info);
      if (!n.read_at) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "secondary";
        b.textContent = "Marquer comme lue";
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
  }

  // Calendrier CRIC : lecture seule des donnees deja chargees par les RPC existantes.
  const montrealDay = (value) => montrealLocal(new Date(value)).slice(0, 10);
  let calendarMonth = null;
  let calendarBookings = [];
  function renderMonth() {
    const grid = $("rdvMonthGrid"),
      label = $("rdvMonthLabel"),
      detail = $("rdvSelectedDay");
    if (!grid || !label || !detail) return;
    if (!calendarMonth) {
      const today = montrealDay(new Date());
      calendarMonth = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    }
    const year = calendarMonth.getUTCFullYear(),
      month = calendarMonth.getUTCMonth();
    label.textContent = new Intl.DateTimeFormat(english() ? "en-CA" : "fr-CA", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(calendarMonth);
    const first = new Date(Date.UTC(year, month, 1));
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const today = montrealDay(new Date());
    grid.replaceChildren();
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "madic-rdv-month-empty";
      empty.setAttribute("aria-hidden", "true");
      grid.append(empty);
    }
    for (let d = 1; d <= days; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daily = slots.filter((x) => montrealDay(x.starts_at) === key);
      const reservations = calendarBookings.filter(
        (x) =>
          montrealDay(x.starts_at) === key &&
          ["requested", "confirmed"].includes(x.status),
      );
      const b = document.createElement("button");
      b.type = "button";
      b.className = "madic-rdv-month-day";
      if (key === today) b.classList.add("is-today");
      if (key === $("slotDate").value) b.classList.add("is-selected");
      const num = document.createElement("strong");
      num.textContent = String(d);
      b.append(num);
      const summary = document.createElement("span");
      summary.className = "madic-rdv-month-day-summary";
      const confirmed = reservations.filter(
        (x) => x.status === "confirmed",
      ).length;
      const requested = reservations.filter(
        (x) => x.status === "requested",
      ).length;
      const available = daily.filter(
        (x) => x.is_open && !reservations.some((a) => a.slot_id === x.id),
      ).length;
      if (confirmed) {
        const chip = document.createElement("em");
        chip.className = "is-confirmed";
        chip.textContent = english() ? `${confirmed} confirmed` : `${confirmed} confirmé${confirmed > 1 ? "s" : ""}`;
        summary.append(chip);
      }
      if (requested) {
        const chip = document.createElement("em");
        chip.className = "is-requested";
        chip.textContent = english() ? `${requested} requested` : `${requested} demande${requested > 1 ? "s" : ""}`;
        summary.append(chip);
      }
      if (available) {
        const chip = document.createElement("em");
        chip.className = "is-free";
        chip.textContent = english() ? `${available} available` : `${available} libre${available > 1 ? "s" : ""}`;
        summary.append(chip);
      }
      if (daily.some((x) => !x.is_open)) {
        const chip = document.createElement("em");
        chip.className = "is-closed";
        chip.textContent = tr("Fermé", "Closed");
        summary.append(chip);
      }
      b.append(summary);
      b.setAttribute(
        "aria-label",
        english() ? `${key}, ${daily.length} slots, ${reservations.length} bookings` : `${key}, ${daily.length} créneau(x), ${reservations.length} réservation(s)`,
      );
      b.addEventListener("click", () => {
        if (key >= today) {
          $("slotDate").value = key;
          updateDateLimits();
        }
        grid
          .querySelectorAll(".is-selected")
          .forEach((el) => el.classList.remove("is-selected"));
        b.classList.add("is-selected");
        detail.replaceChildren();
        const title = document.createElement("strong");
        title.textContent = new Intl.DateTimeFormat(english() ? "en-CA" : "fr-CA", {
          dateStyle: "full",
          timeZone: "UTC",
        }).format(new Date(`${key}T12:00:00Z`));
        detail.append(title);
        if (!daily.length && !reservations.length) {
          const p = document.createElement("p");
          p.textContent = tr("Aucun créneau ni réservation pour cette journée.", "No time slots or bookings for this day.");
          detail.append(p);
        }
        for (const x of daily) {
          const p = document.createElement("p");
          const associated = reservations.filter((a) => a.slot_id === x.id);
          p.textContent = `${date(x.starts_at)} – ${date(x.ends_at)} · ${mode[x.mode] || x.mode} · ${!x.is_open ? tr("Fermé", "Closed") : associated.length ? associated.map((a) => status[a.status]).join(", ") : tr("Disponible", "Available")}`;
          detail.append(p);
        }
        if (key >= today)
          $("slotDate").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      grid.append(b);
    }
    if (!detail.childElementCount) {
      const p = document.createElement("p");
      p.className = "madic-rdv-muted";
      p.textContent =
        tr("Sélectionnez une journée pour afficher ses consultations.", "Select a day to view its consultations.");
      detail.append(p);
    }
  }
  document.addEventListener("madic:languagechange", () => {
    renderMonth();
    if (spaceId) void load().catch((error) => notice(error.message));
  });
  function initMonthControls() {
    const prev = $("rdvMonthPrev"),
      next = $("rdvMonthNext"),
      today = $("rdvMonthToday");
    if (!prev || !next || !today) return;
    const shift = (n) => {
      calendarMonth = new Date(
        Date.UTC(
          calendarMonth.getUTCFullYear(),
          calendarMonth.getUTCMonth() + n,
          1,
          12,
        ),
      );
      renderMonth();
    };
    prev.addEventListener("click", () => shift(-1));
    next.addEventListener("click", () => shift(1));
    today.addEventListener("click", () => {
      calendarMonth = null;
      renderMonth();
    });
    $("slotDate").addEventListener("change", renderMonth);
    renderMonth();
  }
  async function load() {
    const [sr, ar] = await Promise.all([
      db
        .from("madic_cric_appointment_slots")
        .select("id,starts_at,ends_at,mode,is_open")
        .eq("space_id", spaceId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
      db
        .from("madic_cric_appointments")
        .select("id,slot_id,client_id,status,starts_at,ends_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false }),
    ]);
    if (sr.error) throw sr.error;
    if (ar.error) throw ar.error;
    slots = sr.data || [];
    calendarBookings = ar.data || [];
    renderMonth();
    const active = new Set(
      (ar.data || [])
        .filter((a) => ["requested", "confirmed"].includes(a.status))
        .map((a) => a.slot_id),
    );
    const sb = $("slotRows");
    sb.replaceChildren();
    for (const s of slots) {
      const r = sb.insertRow();
      td(r, date(s.starts_at));
      td(r, date(s.ends_at));
      td(r, mode[s.mode]);
      td(
        r,
        !s.is_open
          ? tr("Fermé", "Closed")
          : active.has(s.id)
            ? tr("Réservation(s) en cours - autres heures potentiellement disponibles", "Booking(s) in progress - other times may be available")
            : tr("Disponible", "Available"),
      );
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (s.is_open && !active.has(s.id))
        cell.append(
          button(tr("Fermer", "Close"), async () => {
            const { error } = await db.rpc("madic_rdv_close_slot", {
              p_slot_id: s.id,
            });
            if (error) throw error;
          }),
        );
      else cell.textContent = "-";
    }
    if (!slots.length) {
      const r = sb.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = tr("Aucun créneau à venir.", "No upcoming time slots.");
    }
    const ids = [...new Set((ar.data || []).map((a) => a.client_id))];
    let names = new Map();
    if (ids.length) {
      const { data, error } = await db
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", ids);
      if (!error)
        names = new Map(
          (data || []).map((x) => [
            x.id,
            [x.first_name, x.last_name].filter(Boolean).join(" ") ||
              x.email ||
              "Client",
          ]),
        );
    }
    const br = $("bookingRows");
    br.replaceChildren();
    for (const a of ar.data || []) {
      const s = slots.find((x) => x.id === a.slot_id);
      const r = br.insertRow();
      td(r, names.get(a.client_id) || a.client_id);
      td(
        r,
        a.starts_at && a.ends_at
          ? `${date(a.starts_at)} – ${date(a.ends_at)}`
          : s
            ? `${date(s.starts_at)} – ${date(s.ends_at)}`
            : tr("Créneau passé", "Past time slot"),
      );
      td(r, s ? mode[s.mode] : "-");
      const statusCell = td(r, status[a.status] || a.status);
      statusCell.classList.add(
        "madic-rdv-status",
        `madic-rdv-status-${a.status}`,
      );
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (a.status === "requested") {
        cell.append(
          button(tr("Confirmer", "Confirm"), async () => {
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "confirmed",
            });
            if (error) throw error;
          }),
          button(tr("Refuser", "Decline"), async () => {
            if (!confirm(tr("Refuser cette demande ?", "Decline this request?"))) return;
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "declined",
            });
            if (error) throw error;
          }),
        );
      }
      if (a.status === "confirmed")
        cell.append(
          button(tr("Annuler", "Cancel"), async () => {
            if (!confirm(tr("Annuler ce rendez-vous ?", "Cancel this appointment?"))) return;
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "cancelled",
            });
            if (error) throw error;
          }),
        );
      if (a.status === "confirmed")
        cell.append(
          button(tr("Lieu / lien", "Location / link"), async () => {
            const { data, error } = await db.rpc("madic_rdv_meeting_details", {
              p_appointment_id: a.id,
            });
            if (error) throw error;
            alert(data?.[0]?.location_info || tr("Aucun lieu ou lien indiqué.", "No location or link provided."));
          }),
        );
    }
    if (!ar.data?.length) {
      const r = br.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = tr("Aucune réservation.", "No bookings.");
    }
    await loadNotifications(spaceId);
    notice(tr("Disponibilités et réservations actualisées.", "Availability and bookings updated."));
  }
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error("Connexion CRIC requise.");
    // Même contrôle d'espace actif et de permission que le tableau de bord CRIC.
    // Cette page reste autonome : aucune dépendance à cric-dashboard.js.
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,access_status")
      .eq("owner_user_id", user.id)
      .limit(1);
    if (se) throw se;
    const space = spaces?.[0];
    if (!space) throw Error("Aucun espace professionnel CRIC associé à votre compte. Vérifiez l'association du cabinet et les droits RLS.");
    if (space.access_status !== "active")
      throw Error("Votre espace professionnel CRIC est suspendu ou inactif.");
    const { data: allowed, error: ae } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (ae) throw ae;
    if (allowed !== true) throw Error("Accès à cet espace CRIC non autorisé.");
    spaceId = space.id;
    setupNotifications();
    $("rdvApp").hidden = false;
    initializeDateLimits();
    initMonthControls();
    $("slotForm").onsubmit = async (e) => {
      e.preventDefault();
      updateDateLimits();
      const btn =
        e.submitter || $("slotForm").querySelector("button[type=submit]");
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        if (!$("slotStart").value)
          throw Error("Choisissez une date et une heure disponibles.");
        const start = localToIso($("slotStart").value);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test($("slotStart").value))
          throw Error("Choisissez une heure juste (minutes : 00).");
        const minutes = Number($("slotDuration").value);
        if (
          !Number.isInteger(minutes) ||
          minutes < 60 ||
          minutes > 480 ||
          minutes % 60 !== 0
        )
          throw Error("Choisissez une durée autorisée.");
        const end = new Date(Date.parse(start) + minutes * 60000).toISOString();
        if (new Date(start).getTime() <= Date.now())
          throw Error("Le début doit être dans le futur.");
        const duration = new Date(end).getTime() - new Date(start).getTime();
        if (duration <= 0 || duration > 8 * 60 * 60 * 1000)
          throw Error(
            "La fin doit être après le début, avec une durée maximale de 8 heures.",
          );
        const { error } = await db.rpc("madic_rdv_create_slot", {
          p_space_id: spaceId,
          p_start: start,
          p_end: end,
          p_mode: $("slotMode").value,
          p_location: $("slotLocation").value.trim() || null,
        });
        if (error) throw error;
        $("slotForm").reset();
        updateDateLimits();
        await load();
        notice("Créneau publié.");
      } catch (err) {
        notice("Création impossible : " + err.message);
      } finally {
        btn.disabled = false;
      }
    };
    await load();
  } catch (e) {
    notice("Chargement impossible : " + e.message);
  }
})();

/* SOURCE: madic-datahubz-unified.js */
/* MADIC : navigation CRIC uniforme. Icones Heroicons identiques au tableau de bord. */
(() => {
  "use strict";
  const init = () => {
    const sidebar = document.querySelector(".madic-unified-sidebar");
    if (
      !sidebar ||
      !sidebar
        .querySelector(".madic-unified-brand small")
        ?.textContent.includes("Espace professionnel")
    )
      return;
    const nav = sidebar.querySelector("nav");
    if (!nav) return;
    const iconBase =
      "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/";
    const items = [
      ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2", ""],
      ["gestion-clients-cric.html", "Clients", "users", "madic-v2-group-start"],
      ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open", ""],
      [
        "messagerie-cric.html",
        "Messagerie",
        "chat-bubble-left-right",
        "madic-v2-group-start",
      ],
      ["rendez-vous-cric.html", "Rendez-vous", "calendar-days", ""],
      ["demandes-documents-cric.html", "Documents", "document-text", ""],
      ["echeances-cric.html", "Échéances", "calendar-days", ""],
      [
        "facturation-cric.html",
        "Facturation",
        "receipt-percent",
        "madic-v2-group-start",
      ],
      ["finances-cric.html", "Finances", "banknotes", ""],
      [
        "profil-professionnel-cric.html",
        "Mon profil professionnel",
        "identification",
        "",
      ],
    ];
    const current =
      (location.pathname.split("/").pop() || "cric-dashboard").replace(
        /\.html$/,
        "",
      ) + ".html";
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
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* SOURCE: madic-footer.js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function () {
  "use strict";
  function apply(lang) {
    lang = lang === "en" ? "en" : "fr";
    document
      .querySelectorAll(".madic-footer [data-fr][data-en]")
      .forEach(function (el) {
        el.textContent = el.getAttribute("data-" + lang);
      });
  }
  var lang = "fr";
  try {
    lang =
      new URLSearchParams(location.search).get("lang") ||
      localStorage.getItem("madic-lang") ||
      "fr";
  } catch (e) {}
  apply(lang);
  window.addEventListener("storage", function (e) {
    if (e.key === "madic-lang") apply(e.newValue);
  });
})();

/* SOURCE: madic-i18n-cric.js */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  "use strict";
  const dictionary = {
    "Sélectionnez une journée pour afficher ses consultations.": "Select a day to view its consultations.",
    "Aucun créneau ni réservation pour cette journée.": "No time slots or bookings for this day.",
    "Réservation(s) en cours - autres heures potentiellement disponibles": "Booking(s) in progress - other times may be available",
    "Lieu / lien": "Location / link",
    "Fermé": "Closed",
    "Disponible": "Available",
    "Confirmé": "Confirmed",
    "Annulé": "Cancelled",
    "Visioconférence": "Video call",
    "Téléphone": "Phone call",
    "En personne": "In person",
    "Aucune réservation.": "No bookings.",
    "Aucun créneau à venir.": "No upcoming time slots.",
    "Espace professionnel": "Professional workspace",
    NAVIGATION: "NAVIGATION",
    "Vue d’ensemble": "Overview",
    Clients: "Clients",
    "Outils CRIC": "RCIC tools",
    Messagerie: "Messages",
    "Rendez-vous": "Appointments",
    Documents: "Documents",
    Échéances: "Deadlines",
    Facturation: "Invoicing",
    Finances: "Finances",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Mon espace": "My space",
    "Aller au contenu principal": "Skip to main content",
    "Gestion des clients CRIC": "RCIC client management",
    "Demandes de documents →": "Document requests →",
    "Vérification de votre espace…": "Checking your workspace…",
    "← Retour à mon espace CRIC": "← Back to my RCIC workspace",
    Déconnexion: "Sign out",
    "Clients associés": "Associated clients",
    "Dans votre espace professionnel": "In your professional workspace",
    "Dossiers associés": "Associated cases",
    "Pour les clients autorisés": "For authorized clients",
    "Résultats de recherche": "Search results",
    "Clients affichés ci-dessous": "Clients shown below",
    "Répertoire des clients": "Client directory",
    "Inviter un client": "Invite a client",
    "Importer une liste": "Import a list",
    "Dossiers CRIC": "RCIC cases",
    "RÉPERTOIRE CLIENTS": "CLIENT DIRECTORY",
    "Uniquement les clients autorisés dans votre espace CRIC.":
      "Only clients authorized in your RCIC workspace.",
    Nom: "Name",
    Courriel: "Email",
    Téléphone: "Phone",
    Dossiers: "Cases",
    Factures: "Invoices",
    Action: "Action",
    Actions: "Actions",
    "INVITATIONS INDIVIDUELLES": "INDIVIDUAL INVITATIONS",
    "Inviter un client dans votre cabinet": "Invite a client to your practice",
    "Une invitation privée lie le client exclusivement à votre espace CRIC.":
      "A private invitation links the client exclusively to your RCIC workspace.",
    "Vérification du profil professionnel…": "Checking professional profile…",
    "Courriel du client": "Client email",
    "Envoyer l’invitation par courriel": "Send invitation by email",
    "Lien personnel (copie de secours)": "Personal link (backup copy)",
    "Copier le lien": "Copy link",
    "Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":
      "The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.",
    "IMPORTATION GROUPÉE": "BULK IMPORT",
    "Importer des invitations clients (CSV / Excel)":
      "Import client invitations (CSV / Excel)",
    "Modèle Excel MADIC :": "MADIC Excel template:",
    "Télécharger le modèle Excel à remplir (.xlsx)":
      "Download the Excel template (.xlsx)",
    "Fichier de clients (colonne courriel ou email obligatoire)":
      "Client file (email column required)",
    "Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":
      "Only email addresses are used for invitations. Other columns are not transmitted.",
    "Vérification du profil professionnel avant les invitations…":
      "Checking professional profile before invitations…",
    Vérification: "Verification",
    Résultat: "Result",
    "Confirmer et envoyer les invitations": "Confirm and send invitations",
    "Annuler / effacer": "Cancel / clear",
    "Outils professionnels CRIC": "Professional RCIC tools",
    "ESPACE PROFESSIONNEL CRIC": "RCIC PROFESSIONAL WORKSPACE",
    "Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":
      "Prepare forms, contracts and analyses using authorized cases in your practice.",
    "CENTRE DE TRAVAIL · CRIC": "RCIC WORKSPACE",
    "Vos dossiers. Vos outils. Un seul espace.":
      "Your cases. Your tools. One workspace.",
    "Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":
      "Select a client and their case to prepare professional documents and analyses.",
    "Clients autorisés": "Authorized clients",
    "Associés à votre cabinet": "Associated with your practice",
    "Dossiers accessibles": "Accessible cases",
    "Dans votre espace CRIC": "In your RCIC workspace",
    "Dossier sélectionné": "Selected case",
    Aucun: "None",
    "Pour préparer les outils": "To prepare tools",
    "Formulaires IRCC": "IRCC forms",
    Contrats: "Contracts",
    "Analyse préliminaire": "Preliminary analysis",
    "Suivi Kanban des dossiers": "Kanban case tracking",
    "Centre des outils professionnels": "Professional tools center",
    "Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":
      "Select a client and case to prepare working documents. The consultant must review and approve results before use.",
    "Client associé au cabinet": "Client associated with the practice",
    "Sélectionner un client": "Select a client",
    Dossier: "Case",
    "Sélectionner un dossier": "Select a case",
    "1. Formulaires IRCC automatisés": "1. Automated IRCC forms",
    "Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":
      "Prepare information from the client profile. Official PDFs are not generated at this stage.",
    "Formulaire IRCC": "IRCC form",
    "Autre formulaire-à définir": "Other form—to be determined",
    "Préparer la fiche de renseignements": "Prepare information sheet",
    "OUTILS CRIC · GESTION CONTRACTUELLE": "RCIC TOOLS · CONTRACT MANAGEMENT",
    "2. Contrats": "2. Contracts",
    "Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":
      "Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.",
    "PREMIÈRE CONSULTATION": "INITIAL CONSULTATION",
    "Contrat de consultation initiale": "Initial consultation agreement",
    "Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":
      "Set out the initial consultation, its purpose, fees and terms of service.",
    "Préparer le contrat": "Prepare contract",
    "MANDAT DE REPRÉSENTATION": "REPRESENTATION MANDATE",
    "Contrat de services professionnels": "Professional services agreement",
    "Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":
      "Define agreed services, responsibilities, fees and mandate terms.",
    "Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":
      "Select a client and case above before opening a contract.",
    "Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":
      "Clauses, fees and signatures must be checked and approved before sending to the client.",
    "3. Résultat de l’analyse préliminaire": "3. Preliminary analysis results",
    "Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":
      "Draft a provisional professional assessment, without an automatic eligibility decision.",
    "Programme ou voie d’immigration": "Immigration program or pathway",
    "Appréciation préliminaire": "Preliminary assessment",
    "Analyse à compléter": "Analysis pending",
    "Éléments favorables à vérifier": "Favorable factors to verify",
    "Renseignements supplémentaires requis": "Additional information required",
    "Critères potentiellement non satisfaits": "Potentially unmet criteria",
    "Constats et critères examinés": "Findings and criteria reviewed",
    "Documents manquants et prochaines étapes":
      "Missing documents and next steps",
    "Préparer le compte rendu": "Prepare report",
    "Messagerie sécurisée": "Secure messaging",
    "Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":
      "Communicate with clients and access conversations and attachments in a secure workspace.",
    "Vérification des autorisations…": "Checking permissions…",
    Conversations: "Conversations",
    "Client du cabinet": "Practice client",
    "Choisir un client…": "Choose a client…",
    Objet: "Subject",
    "Nouvelle conversation": "New conversation",
    Actualiser: "Refresh",
    "Sélectionnez une conversation": "Select a conversation",
    "Votre message": "Your message",
    Envoyer: "Send",
    "Rendez-vous et consultations": "Appointments and consultations",
    "Gérez vos créneaux et les demandes de vos clients.":
      "Manage your availability and client requests.",
    "Gestion des clients →": "Client management →",
    "Vérification des accès…": "Checking access…",
    "Publier une disponibilité": "Publish availability",
    "Date de début (heure de Montréal)": "Start date (Montreal time)",
    "Heure de début (heure de Montréal)": "Start time (Montreal time)",
    "Choisir une heure": "Choose a time",
    "Durée de consultation": "Consultation duration",
    "1 heure": "1 hour",
    "2 heures": "2 hours",
    "3 heures": "3 hours",
    "4 heures": "4 hours",
    "5 heures": "5 hours",
    "6 heures": "6 hours",
    "7 heures": "7 hours",
    "8 heures": "8 hours",
    "Fin calculée automatiquement (heure de Montréal)":
      "Automatically calculated end (Montreal time)",
    "Type de consultation": "Consultation type",
    Visioconférence: "Video call",
    "En personne": "In person",
    "Lieu ou lien (facultatif)": "Location or link (optional)",
    "Publier le créneau": "Publish time slot",
    "AGENDA PROFESSIONNEL": "PROFESSIONAL CALENDAR",
    "Calendrier des consultations": "Consultation calendar",
    "Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":
      "View time slots and bookings, then select a day to publish availability.",
    "Aujourd'hui": "Today",
    Disponible: "Available",
    Demandé: "Requested",
    Confirmé: "Confirmed",
    Fermé: "Closed",
    Lun: "Mon",
    Mar: "Tue",
    Mer: "Wed",
    Jeu: "Thu",
    Ven: "Fri",
    Sam: "Sat",
    Dim: "Sun",
    "Mes disponibilités": "My availability",
    "Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":
      "New slots start on the hour. Existing appointments retain their scheduled times.",
    Début: "Start",
    Fin: "End",
    Type: "Type",
    État: "State",
    "Réservations et demandes": "Bookings and requests",
    Client: "Client",
    Statut: "Status",
    "Gestion documentaire du client": "Client document management",
    "← Retour à la gestion des clients": "← Back to client management",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":
      "Choose a case, review received files and track requested documents.",
    "Chargement…": "Loading…",
    "Étape 1 · Dossier": "Step 1 · Case",
    "Choisir le client et le dossier": "Choose client and case",
    "+ Demander une nouvelle pièce au client":
      "+ Request a new document from the client",
    "Cette demande apparaîtra dans l'espace du client.":
      "This request will appear in the client's workspace.",
    "Document demandé": "Requested document",
    Instructions: "Instructions",
    "Date limite (facultatif)": "Due date (optional)",
    "Envoyer la demande": "Send request",
    "+ Envoyer un document au client": "+ Send a document to the client",
    "Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":
      "File to send (PDF, JPG or PNG, 10 MB maximum)",
    "Nom du document (facultatif)": "Document name (optional)",
    "Envoyer le document": "Send document",
    "Étape 2 · Vérification": "Step 2 · Review",
    "Documents reçus": "Received documents",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":
      "Download and review each document. If rejected, provide a reason visible to the client.",
    Fichier: "File",
    "Reçu le": "Received on",
    Évaluation: "Assessment",
    "Motif du refus": "Reason for rejection",
    "Étape 3 · Suivi": "Step 3 · Tracking",
    "Demandes envoyées": "Sent requests",
    "Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":
      "Requests for the selected case only. Request status is separate from file assessment.",
    "Pièce demandée": "Requested item",
    "Date limite": "Due date",
    "Mettre à jour": "Update",
    "Échéances de mon cabinet": "Practice deadlines",
    "← Mon espace CRIC": "← My RCIC workspace",
    "Échéances et rappels": "Deadlines and reminders",
    "Suivez les dates importantes de vos dossiers et les actions à réaliser.":
      "Track important case dates and required actions.",
    "Vérification de votre cabinet…": "Checking your practice…",
    "Ajouter une échéance": "Add a deadline",
    "Dossier *": "Case *",
    "Description de l’échéance *": "Deadline description *",
    "Date limite *": "Due date *",
    "Enregistrer l'échéance": "Save deadline",
    "Mes échéances": "My deadlines",
    Description: "Description",
    Date: "Date",
    Situation: "Status",
    "Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":
      "Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.",
    "Facturation de mon cabinet": "Practice invoicing",
    "Vérification de votre accès…": "Checking your access…",
    "Paiements Stripe Connect": "Stripe Connect payments",
    "Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":
      "Connect your practice's Stripe account to receive client payments directly.",
    "Vérification de la connexion Stripe…": "Checking Stripe connection…",
    "Connecter mon compte Stripe": "Connect my Stripe account",
    "Créer une facture": "Create an invoice",
    "Client *": "Client *",
    "Dossier (facultatif)": "Case (optional)",
    "Aucun dossier": "No cases",
    "Nom du cabinet *": "Practice name *",
    "Adresse du cabinet": "Practice address",
    "Numéros de taxes (si applicables)": "Tax numbers (if applicable)",
    "Logo du cabinet (PNG ou JPG, max. 100 Ko)":
      "Practice logo (PNG or JPG, max. 100 KB)",
    "Lignes de facturation": "Invoice line items",
    Quantité: "Quantity",
    "Prix unitaire (CAD)": "Unit price (CAD)",
    Montant: "Amount",
    "+ Ajouter une ligne": "+ Add a line",
    "Sous-total : 0,00 $": "Subtotal: $0.00",
    "Taux total de taxes applicable (%)": "Total applicable tax rate (%)",
    "Date d'échéance": "Due date",
    Notes: "Notes",
    "Créer la facture": "Create invoice",
    "Mes factures": "My invoices",
    Numéro: "Number",
    Émission: "Issued",
    Total: "Total",
    Payé: "Paid",
    "Gestion financière CRIC": "RCIC financial management",
    "Gestion financière du cabinet CRIC": "RCIC practice financial management",
    "Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":
      "Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports",
    "Cabinet :": "Practice:",
    "Non sélectionné": "Not selected",
    "Initialisation…": "Initializing…",
    "Retour à mon espace professionnel CRIC":
      "Back to my RCIC professional workspace",
    "Temps et honoraires": "Time and fees",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.":
      "This information identifies your practice in client invitations.",
    "Renseignements du cabinet": "Practice information",
    "Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":
      "Fields marked with an asterisk are required. Your information is saved in your professional workspace.",
    "Nom déclaré à l’inscription CRIC":
      "Name provided during RCIC registration",
    "Courriel professionnel déclaré à l’inscription":
      "Professional email provided during registration",
    "Prénom *": "First name *",
    "Nom *": "Last name *",
    "Titre professionnel *": "Professional title *",
    "Numéro de permis CRIC *": "RCIC licence number *",
    "Nom de l’entreprise *": "Business name *",
    "Site Web de l’entreprise (facultatif)": "Business website (optional)",
    "Téléphone professionnel *": "Business phone *",
    "Adresse professionnelle du cabinet": "Professional practice address",
    "Numéro civique *": "Street number *",
    "Rue *": "Street *",
    "Bureau, suite ou local (facultatif)": "Office, suite or unit (optional)",
    "Ville *": "City *",
    "Province, État ou district *": "Province, state or district *",
    "Code postal (facultatif)": "Postal code (optional)",
    "Pays *": "Country *",
    "Sélectionner un pays": "Select a country",
    Enregistrer: "Save",
    Annuler: "Cancel",
    Fermer: "Close",
    Continuer: "Continue",
    Confirmer: "Confirm",
    Refuser: "Decline",
    Supprimer: "Delete",
    Modifier: "Edit",
    Voir: "View",
    Télécharger: "Download",
    "En attente": "Pending",
    Annulé: "Cancelled",
    Annulée: "Cancelled",
    Accepté: "Accepted",
    Acceptée: "Accepted",
    Rejeté: "Rejected",
    Rejetée: "Rejected",
    Validé: "Approved",
    Validée: "Approved",
    Approuvé: "Approved",
    Approuvée: "Approved",
    Oui: "Yes",
    Non: "No",
    "Aucun résultat": "No results",
    "Aucune donnée": "No data",
    "Aucun client": "No clients",
    "Aucun rendez-vous": "No appointments",
    "En cours": "In progress",
    Terminé: "Completed",
    Terminée: "Completed",
    Envoyé: "Sent",
    Envoyée: "Sent",
    Brouillon: "Draft",
    "Enregistrer les modifications": "Save changes",
    "Profil mis à jour": "Profile updated",
    "© MAD Immigration Canadienne · Portail sécurisé":
      "© MAD Immigration Canadienne · Secure portal",
    "© MADIC · Plateforme professionnelle": "© MADIC · Professional platform",
    "Île de l’Ascension": "Ascension Island",
    Andorre: "Andorra",
    "Émirats arabes unis": "United Arab Emirates",
    Afghanistan: "Afghanistan",
    "Antigua-et-Barbuda": "Antigua & Barbuda",
    Anguilla: "Anguilla",
    Albanie: "Albania",
    Arménie: "Armenia",
    Angola: "Angola",
    Antarctique: "Antarctica",
    Argentine: "Argentina",
    "Samoa américaines": "American Samoa",
    Autriche: "Austria",
    Australie: "Australia",
    Aruba: "Aruba",
    "Îles Åland": "Åland Islands",
    Azerbaïdjan: "Azerbaijan",
    "Bosnie-Herzégovine": "Bosnia & Herzegovina",
    Barbade: "Barbados",
    Bangladesh: "Bangladesh",
    Belgique: "Belgium",
    "Burkina Faso": "Burkina Faso",
    Bulgarie: "Bulgaria",
    Bahreïn: "Bahrain",
    Burundi: "Burundi",
    Bénin: "Benin",
    "Saint-Barthélemy": "St. Barthélemy",
    Bermudes: "Bermuda",
    Brunei: "Brunei",
    Bolivie: "Bolivia",
    "Pays-Bas caribéens": "Caribbean Netherlands",
    Brésil: "Brazil",
    Bahamas: "Bahamas",
    Bhoutan: "Bhutan",
    "Île Bouvet": "Bouvet Island",
    Botswana: "Botswana",
    Biélorussie: "Belarus",
    Belize: "Belize",
    Canada: "Canada",
    "Îles Cocos": "Cocos (Keeling) Islands",
    "Congo-Kinshasa": "Congo - Kinshasa",
    "République centrafricaine": "Central African Republic",
    "Congo-Brazzaville": "Congo - Brazzaville",
    Suisse: "Switzerland",
    "Côte d’Ivoire": "Côte d’Ivoire",
    "Îles Cook": "Cook Islands",
    Chili: "Chile",
    Cameroun: "Cameroon",
    Chine: "China",
    Colombie: "Colombia",
    "Île Clipperton": "Clipperton Island",
    "Costa Rica": "Costa Rica",
    Cuba: "Cuba",
    "Cap-Vert": "Cape Verde",
    Curaçao: "Curaçao",
    "Île Christmas": "Christmas Island",
    Chypre: "Cyprus",
    Tchéquie: "Czechia",
    Allemagne: "Germany",
    "Diego Garcia": "Diego Garcia",
    Djibouti: "Djibouti",
    Danemark: "Denmark",
    Dominique: "Dominica",
    "République dominicaine": "Dominican Republic",
    Algérie: "Algeria",
    "Ceuta et Melilla": "Ceuta & Melilla",
    Équateur: "Ecuador",
    Estonie: "Estonia",
    Égypte: "Egypt",
    "Sahara occidental": "Western Sahara",
    Érythrée: "Eritrea",
    Espagne: "Spain",
    Éthiopie: "Ethiopia",
    "Union européenne": "European Union",
    "zone euro": "Eurozone",
    Finlande: "Finland",
    Fidji: "Fiji",
    "Îles Malouines": "Falkland Islands",
    Micronésie: "Micronesia",
    "Îles Féroé": "Faroe Islands",
    France: "France",
    Gabon: "Gabon",
    "Royaume-Uni": "United Kingdom",
    Grenade: "Grenada",
    Géorgie: "Georgia",
    "Guyane française": "French Guiana",
    Guernesey: "Guernsey",
    Ghana: "Ghana",
    Gibraltar: "Gibraltar",
    Groenland: "Greenland",
    Gambie: "Gambia",
    Guinée: "Guinea",
    Guadeloupe: "Guadeloupe",
    "Guinée équatoriale": "Equatorial Guinea",
    Grèce: "Greece",
    "Géorgie du Sud-et-les Îles Sandwich du Sud":
      "South Georgia & South Sandwich Islands",
    Guatemala: "Guatemala",
    Guam: "Guam",
    "Guinée-Bissau": "Guinea-Bissau",
    Guyana: "Guyana",
    "R.A.S. chinoise de Hong Kong": "Hong Kong SAR China",
    "Îles Heard-et-MacDonald": "Heard & McDonald Islands",
    Honduras: "Honduras",
    Croatie: "Croatia",
    Haïti: "Haiti",
    Hongrie: "Hungary",
    "Îles Canaries": "Canary Islands",
    Indonésie: "Indonesia",
    Irlande: "Ireland",
    Israël: "Israel",
    "Île de Man": "Isle of Man",
    Inde: "India",
    "Territoire britannique de l’océan Indien":
      "British Indian Ocean Territory",
    Irak: "Iraq",
    Iran: "Iran",
    Islande: "Iceland",
    Italie: "Italy",
    Jersey: "Jersey",
    Jamaïque: "Jamaica",
    Jordanie: "Jordan",
    Japon: "Japan",
    Kenya: "Kenya",
    Kirghizstan: "Kyrgyzstan",
    Cambodge: "Cambodia",
    Kiribati: "Kiribati",
    Comores: "Comoros",
    "Saint-Christophe-et-Niévès": "St. Kitts & Nevis",
    "Corée du Nord": "North Korea",
    "Corée du Sud": "South Korea",
    Koweït: "Kuwait",
    "Îles Caïmans": "Cayman Islands",
    Kazakhstan: "Kazakhstan",
    Laos: "Laos",
    Liban: "Lebanon",
    "Sainte-Lucie": "St. Lucia",
    Liechtenstein: "Liechtenstein",
    "Sri Lanka": "Sri Lanka",
    Liberia: "Liberia",
    Lesotho: "Lesotho",
    Lituanie: "Lithuania",
    Luxembourg: "Luxembourg",
    Lettonie: "Latvia",
    Libye: "Libya",
    Maroc: "Morocco",
    Monaco: "Monaco",
    Moldavie: "Moldova",
    Monténégro: "Montenegro",
    "Saint-Martin": "St. Martin",
    Madagascar: "Madagascar",
    "Îles Marshall": "Marshall Islands",
    "Macédoine du Nord": "North Macedonia",
    Mali: "Mali",
    "Myanmar (Birmanie)": "Myanmar (Burma)",
    Mongolie: "Mongolia",
    "R.A.S. chinoise de Macao": "Macao SAR China",
    "Îles Mariannes du Nord": "Northern Mariana Islands",
    Martinique: "Martinique",
    Mauritanie: "Mauritania",
    Montserrat: "Montserrat",
    Malte: "Malta",
    Maurice: "Mauritius",
    Maldives: "Maldives",
    Malawi: "Malawi",
    Mexique: "Mexico",
    Malaisie: "Malaysia",
    Mozambique: "Mozambique",
    Namibie: "Namibia",
    "Nouvelle-Calédonie": "New Caledonia",
    Niger: "Niger",
    "Île Norfolk": "Norfolk Island",
    Nigeria: "Nigeria",
    Nicaragua: "Nicaragua",
    "Pays-Bas": "Netherlands",
    Norvège: "Norway",
    Népal: "Nepal",
    Nauru: "Nauru",
    Niue: "Niue",
    "Nouvelle-Zélande": "New Zealand",
    Oman: "Oman",
    Panama: "Panama",
    Pérou: "Peru",
    "Polynésie française": "French Polynesia",
    "Papouasie-Nouvelle-Guinée": "Papua New Guinea",
    Philippines: "Philippines",
    Pakistan: "Pakistan",
    Pologne: "Poland",
    "Saint-Pierre-et-Miquelon": "St. Pierre & Miquelon",
    "Îles Pitcairn": "Pitcairn Islands",
    "Porto Rico": "Puerto Rico",
    "Territoires palestiniens": "Palestinian Territories",
    Portugal: "Portugal",
    Palaos: "Palau",
    Paraguay: "Paraguay",
    Qatar: "Qatar",
    "régions éloignées de l’Océanie": "Outlying Oceania",
    "La Réunion": "Réunion",
    Roumanie: "Romania",
    Serbie: "Serbia",
    Russie: "Russia",
    Rwanda: "Rwanda",
    "Arabie saoudite": "Saudi Arabia",
    "Îles Salomon": "Solomon Islands",
    Seychelles: "Seychelles",
    Soudan: "Sudan",
    Suède: "Sweden",
    Singapour: "Singapore",
    "Sainte-Hélène": "St. Helena",
    Slovénie: "Slovenia",
    "Svalbard et Jan Mayen": "Svalbard & Jan Mayen",
    Slovaquie: "Slovakia",
    "Sierra Leone": "Sierra Leone",
    "Saint-Marin": "San Marino",
    Sénégal: "Senegal",
    Somalie: "Somalia",
    Suriname: "Suriname",
    "Soudan du Sud": "South Sudan",
    "Sao Tomé-et-Principe": "São Tomé & Príncipe",
    Salvador: "El Salvador",
    "Saint-Martin (partie néerlandaise)": "Sint Maarten",
    Syrie: "Syria",
    Eswatini: "Eswatini",
    "Tristan da Cunha": "Tristan da Cunha",
    "Îles Turques-et-Caïques": "Turks & Caicos Islands",
    Tchad: "Chad",
    "Terres australes françaises": "French Southern Territories",
    Togo: "Togo",
    Thaïlande: "Thailand",
    Tadjikistan: "Tajikistan",
    Tokelau: "Tokelau",
    "Timor oriental": "Timor-Leste",
    Turkménistan: "Turkmenistan",
    Tunisie: "Tunisia",
    Tonga: "Tonga",
    Turquie: "Türkiye",
    "Trinité-et-Tobago": "Trinidad & Tobago",
    Tuvalu: "Tuvalu",
    Taïwan: "Taiwan",
    Tanzanie: "Tanzania",
    Ukraine: "Ukraine",
    Ouganda: "Uganda",
    "Îles mineures éloignées des États-Unis": "U.S. Outlying Islands",
    "Nations Unies": "United Nations",
    "États-Unis": "United States",
    Uruguay: "Uruguay",
    Ouzbékistan: "Uzbekistan",
    "État de la Cité du Vatican": "Vatican City",
    "Saint-Vincent-et-les Grenadines": "St. Vincent & Grenadines",
    Venezuela: "Venezuela",
    "Îles Vierges britanniques": "British Virgin Islands",
    "Îles Vierges des États-Unis": "U.S. Virgin Islands",
    "Viêt Nam": "Vietnam",
    Vanuatu: "Vanuatu",
    "Wallis-et-Futuna": "Wallis & Futuna",
    Samoa: "Samoa",
    "pseudo-accents": "Pseudo-Accents",
    "pseudo-bidi": "Pseudo-Bidi",
    Kosovo: "Kosovo",
    Yémen: "Yemen",
    Mayotte: "Mayotte",
    "Afrique du Sud": "South Africa",
    Zambie: "Zambia",
    Zimbabwe: "Zimbabwe",
    "région indéterminée": "Unknown Region",
    "Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":
      "The file will be available in the client workspace under “History and assessments of my documents” for the selected case.",
    "La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":
      "The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.",
    "Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":
      "The logo is saved in each new invoice. Select it again for subsequent invoices.",
    "Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":
      "Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.",
    "Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":
      "Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":
      "Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.",
    "Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":
      "Complete the fields below. The previous address is retained until you save for the first time.",
    "Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":
      "Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",
    ". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":
      ". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.",
    "IMM 5476-Recours aux services d’un représentant":
      "IMM 5476 – Use of a Representative",
    "IMM 0008-Demande générique pour le Canada":
      "IMM 0008 – Generic Application Form for Canada",
    "IMM 5406-Renseignements additionnels sur la famille":
      "IMM 5406 – Additional Family Information",
    "IMM 5669-Antécédents / Déclaration":
      "IMM 5669 – Schedule A: Background / Declaration",
    "Gestion financière CRIC | MADIC": "RCIC financial management | MADIC",
    "Échéances de mon cabinet | MADIC": "My practice deadlines | MADIC",
    "Les modifications de votre profil professionnel ont été enregistrées avec succès.":
      "Changes to your professional profile have been saved successfully.",
    "Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":
      "Payments through MADIC Portail are not yet enabled: this option does not collect payments.",
    "Recevez un virement par courriel ou téléphone":
      "Receive an e-transfer by email or phone",
    "Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":
      "Choose the payment methods accepted by your practice. They will automatically appear in your contracts.",
    "Courriel ou numéro pour recevoir les virements":
      "Email address or phone number for e-transfers",
    "Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":
      "When editing, the saved logo is retained unless you select a new file.",
    "Adresse complète (générée automatiquement)":
      "Full address (generated automatically)",
    "Vos modifications ne sont enregistrées qu’après confirmation.":
      "Your changes are only saved after confirmation.",
  };
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.":
      "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.":
      "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.":
      "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":
      "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":
      "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.":
      "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.":
      "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.":
      "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.":
      "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":
      "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    Fidéicommis: "Trust accounting",
    Comptabilité: "Accounting",
    Rapports: "Reports",
    Paiements: "Payments",
    Cabinet: "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.":
      "No data recorded for this practice.",
  });
  const key = "madic_ui_language";
  let lang = "fr";
  try {
    lang = localStorage.getItem(key) === "en" ? "en" : "fr";
  } catch (_) {}
  const normalized = (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en)))
      reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ["placeholder", "title", "aria-label"];
  const ignored = (node) =>
    !!node.parentElement?.closest(
      'script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls',
    );
  const patterns = [
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, "New appointment request - "],
    [/^Dernière vérification automatique\s*:/i, "Last automatic check:"],
    [/^Documents du dossier\s*:/i, "Case documents:"],
    [/^Espace professionnel\s*:/i, "Professional workspace:"],
    [/^Espace de facturation du cabinet\s*:/i, "Practice invoicing workspace:"],
    [/^Cabinet\s*:/i, "Practice:"],
    [
      /^\d+\s+document\(s\) reçu\(s\)\./i,
      (s) => s.replace("document(s) reçu(s)", "document(s) received"),
    ],
    [
      /^\d+\s+échéances?\s*·/i,
      (s) =>
        s
          .replace(/échéances?/, "deadlines")
          .replace(/dépassée?s?/, "overdue")
          .replace(/à traiter dans les/, "due within the")
          .replace(/prochains jours/, "next days"),
    ],
    [
      /^\d+\s+ligne\(s\) affichée\(s\)\./i,
      (s) => s.replace("ligne(s) affichée(s)", "row(s) displayed"),
    ],
    [
      /^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i,
      (s) => s.replace("ligne(s) affichée(s)", "row(s) displayed"),
    ],
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text))
      return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === "en" ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0
      ? output
      : original.slice(0, start) +
          output +
          original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current)
      originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches(".madic-lang-controls button[data-lang]")) {
      el.disabled = false;
      el.removeAttribute("aria-disabled");
      el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
      el.classList.toggle("madic-lang-active", el.dataset.lang === lang);
      el.setAttribute(
        "aria-label",
        el.dataset.lang === "fr" ? "Français" : "English",
      );
      el.title = el.dataset.lang === "fr" ? "Français" : "English";
      return;
    }
    if (ignored({ parentElement: el })) return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) {
      source = {};
      originalAttrs.set(el, source);
    }
    if (!previous) {
      previous = {};
      renderedAttrs.set(el, previous);
    }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current)
        source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document
      .querySelectorAll(".madic-lang-controls button[data-lang]")
      .forEach(translateElement);
    if (observer)
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: attrs,
      });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  }
  function selectLanguage(next) {
    if (next !== "fr" && next !== "en") return;
    lang = next;
    try {
      localStorage.setItem(key, lang);
    } catch (_) {}
    render();
    document.dispatchEvent(
      new CustomEvent("madic:languagechange", { detail: { lang } }),
    );
  }
  function init() {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest?.(
          ".madic-lang-controls button[data-lang]",
        );
        if (!button) return;
        event.preventDefault();
        selectLanguage(button.dataset.lang);
      },
      true,
    );
    observer = new MutationObserver(schedule);
    render();
    window.MadicCricLanguage = {
      set: selectLanguage,
      get: () => lang,
      refresh: render,
    };
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* MADIC: sign out from appointment workspace */
(function(){const init=()=>{const btn=document.getElementById('logout');if(!btn)return;btn.addEventListener('click',async()=>{try{const db=window.getMadicSupabase();await db.auth.signOut();window.location.assign('connexion.html');}catch(e){console.error('MADIC sign out failed',e);}})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();

/* Header notification count: dashboard-equivalent authorized CRIC RPCs. */
(function(){
  'use strict';
  const badge=document.querySelector('.madic-top-notification-count');
  if(!badge)return;
  let busy=false;
  async function refresh(){
    if(busy||document.hidden||typeof window.getMadicSupabase!=='function')return;
    busy=true;
    try{
      const db=window.getMadicSupabase();
      const {data:{user}={},error:authError}=await db.auth.getUser();
      if(authError||!user)return;
      const {data:spaces,error:spaceError}=await db.from('madic_cric_spaces').select('id').eq('owner_user_id',user.id).eq('access_status','active').limit(1);
      if(spaceError||!spaces?.length)return;
      const spaceId=spaces[0].id;
      const {data:allowed,error:permissionError}=await db.rpc('madic_can_manage_cric_space',{p_space_id:spaceId});
      if(permissionError||allowed!==true)return;
      const {data:count,error:countError}=await db.rpc('madic_cric_clients_connexions_non_lues',{p_space_id:spaceId});
      if(countError)return;
      const value=Number(count)||0;
      badge.hidden=value<=0;
      badge.textContent=value>99?'99+':value>0?String(value):'';
    }catch(error){console.warn('MADIC: compteur de notifications indisponible',error);}
    finally{busy=false;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void refresh();},{once:true});else void refresh();
  window.addEventListener('focus',()=>{void refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.setInterval(()=>{void refresh();},30000);
})();
