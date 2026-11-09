(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (t) => ($("rdvNotice").textContent = t);
  if (typeof window.getMadicSupabase !== "function")
    return notice("Configuration Supabase manquante.");
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
    wrap.style.cssText =
      "display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0";
    const label = document.createElement("label");
    label.textContent = "Durée du rendez-vous : ";
    label.htmlFor = "rdvDuration";
    const select = document.createElement("select");
    select.id = "rdvDuration";
    select.add(new Option("1 heure", "60"));
    select.add(new Option("2 heures", "120"));
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
        `Demander un rendez-vous du ${date(s.starts_at)} au ${date(s.ends_at)} ?`,
      )
    )
      return;
    const { error } = await db.rpc("madic_rdv_book_period", {
      p_slot_id: s.id,
      p_start: s.starts_at,
      p_end: s.ends_at,
    });
    if (error) throw error;
    notice("Demande envoyée au consultant, en attente de confirmation.");
  }
  const date = (t) =>
    new Intl.DateTimeFormat("fr-CA", {
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
      new Intl.DateTimeFormat("fr-CA", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(d);
    $("rdvWeekLabel").textContent = `${label(monday)} – ${label(last)}`;
    $("rdvPrevWeek").disabled = weekOffset <= 0;
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
        empty.textContent = "Aucun créneau";
        column.append(empty);
      }
      for (const s of daySlots) {
        const time = new Intl.DateTimeFormat("fr-CA", {
          timeZone: "America/Toronto",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(s.starts_at));
        const b = action(
          `${time} · ${durationMinutes / 60} h · Demander`,
          async () => {
            await bookPeriod(s);
          },
        );
        b.classList.add("madic-rdv-slot-button");
        b.title = mode[s.mode] || s.mode;
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
      line.className =
        "madic-rdv-notification" +
        (n.read_at ? "" : " madic-rdv-notification-unread");
      const info = document.createElement("span");
      info.textContent = `${notificationLabels[n.event_type] || n.event_type} · ${date(n.created_at)}`;
      if (!n.read_at) info.classList.add("madic-rdv-notification-title");
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

  async function load() {
    const spaceId = $("rdvSpace").value;
    if (!spaces.some((x) => x.space_id === spaceId))
      throw Error("Cabinet non autorisé.");
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
      td(r, mode[s.mode]);
      r.insertCell().append(
        action(`Demander ${durationMinutes / 60} h`, async () => {
          await bookPeriod(s);
          notice("Demande envoyée au consultant, en attente de confirmation.");
        }),
      );
    }
    if (!slots.length) {
      const r = sb.insertRow();
      r.insertCell().colSpan = 4;
      r.cells[0].textContent = "Aucun créneau disponible pour le moment.";
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
      td(r, s ? mode[s.mode] : "-");
      const statusCell = td(r, status[a.status] || a.status);
      statusCell.classList.add(
        "madic-rdv-status",
        `madic-rdv-status-${a.status}`,
      );
      const detail = r.insertCell();
      detail.textContent =
        a.status === "confirmed"
          ? "Disponible via « Voir le lien »"
          : a.status === "requested"
            ? "Communiqué après confirmation"
            : "-";
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (a.status === "confirmed")
        cell.append(
          action("Voir le lien", async () => {
            const { data, error } = await db.rpc("madic_rdv_meeting_details", {
              p_appointment_id: a.id,
            });
            if (error) throw error;
            alert(
              data?.[0]?.location_info ||
                "Le consultant n’a pas indiqué de lieu ou lien.",
            );
          }),
        );
      if (["requested", "confirmed"].includes(a.status))
        cell.append(
          action("Annuler", async () => {
            if (!confirm("Annuler ce rendez-vous ?")) return;
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
      r.cells[0].textContent = "Aucun rendez-vous demandé.";
    }
    await loadNotifications(spaceId);
    notice("Rendez-vous chargés.");
  }
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error("Connexion client requise.");
    const { data, error } = await db.rpc("madic_my_cric_client_spaces");
    if (error) throw error;
    spaces = data || [];
    if (!spaces.length) throw Error("Aucun cabinet associé.");
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
    notice("Chargement impossible : " + e.message);
  }
})();
