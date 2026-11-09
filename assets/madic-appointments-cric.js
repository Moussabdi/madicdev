(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (t) => ($("rdvNotice").textContent = t);
  if (typeof window.getMadicSupabase !== "function")
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let spaceId,
    slots = [];
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
    requested: "Demandé",
    confirmed: "Confirmé",
    declined: "Refusé",
    cancelled: "Annulé",
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
    const grid = $("rdvMonthGrid"), label = $("rdvMonthLabel"), detail = $("rdvSelectedDay");
    if (!grid || !label || !detail) return;
    if (!calendarMonth) {
      const today = montrealDay(new Date());
      calendarMonth = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    }
    const year = calendarMonth.getUTCFullYear(), month = calendarMonth.getUTCMonth();
    label.textContent = new Intl.DateTimeFormat("fr-CA", {month:"long",year:"numeric",timeZone:"UTC"}).format(calendarMonth);
    const first = new Date(Date.UTC(year, month, 1));
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const today = montrealDay(new Date());
    grid.replaceChildren();
    for (let i=0;i<offset;i++) { const empty=document.createElement("div");empty.className="madic-rdv-month-empty";empty.setAttribute("aria-hidden","true");grid.append(empty); }
    for (let d=1;d<=days;d++) {
      const key=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const daily=slots.filter(x=>montrealDay(x.starts_at)===key);
      const reservations=calendarBookings.filter(x=>montrealDay(x.starts_at)===key && ["requested","confirmed"].includes(x.status));
      const b=document.createElement("button");b.type="button";b.className="madic-rdv-month-day";
      if(key===today)b.classList.add("is-today");
      if(key===$('slotDate').value)b.classList.add("is-selected");
      const num=document.createElement("strong");num.textContent=String(d);b.append(num);
      const summary=document.createElement("span");summary.className="madic-rdv-month-day-summary";
      const confirmed=reservations.filter(x=>x.status==="confirmed").length;
      const requested=reservations.filter(x=>x.status==="requested").length;
      const available=daily.filter(x=>x.is_open && !reservations.some(a=>a.slot_id===x.id)).length;
      if(confirmed) {const chip=document.createElement("em");chip.className="is-confirmed";chip.textContent=`${confirmed} confirmé${confirmed>1?'s':''}`;summary.append(chip);}
      if(requested) {const chip=document.createElement("em");chip.className="is-requested";chip.textContent=`${requested} demande${requested>1?'s':''}`;summary.append(chip);}
      if(available) {const chip=document.createElement("em");chip.className="is-free";chip.textContent=`${available} libre${available>1?'s':''}`;summary.append(chip);}
      if(daily.some(x=>!x.is_open)) {const chip=document.createElement("em");chip.className="is-closed";chip.textContent="Fermé";summary.append(chip);}
      b.append(summary);
      b.setAttribute("aria-label",`${key}, ${daily.length} créneau(x), ${reservations.length} réservation(s)`);
      b.addEventListener("click",()=>{
        if(key>=today){$('slotDate').value=key;updateDateLimits();}
        grid.querySelectorAll('.is-selected').forEach(el=>el.classList.remove('is-selected'));
        b.classList.add('is-selected');
        detail.replaceChildren();
        const title=document.createElement('strong');title.textContent=new Intl.DateTimeFormat('fr-CA',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${key}T12:00:00Z`));detail.append(title);
        if(!daily.length && !reservations.length){const p=document.createElement('p');p.textContent='Aucun créneau ni réservation pour cette journée.';detail.append(p);}
        for(const x of daily){const p=document.createElement('p');const associated=reservations.filter(a=>a.slot_id===x.id);p.textContent=`${date(x.starts_at)} – ${date(x.ends_at)} · ${mode[x.mode]||x.mode} · ${!x.is_open?'Fermé':associated.length?associated.map(a=>status[a.status]).join(', '):'Disponible'}`;detail.append(p);}
        if(key>=today)$('slotDate').scrollIntoView({behavior:'smooth',block:'center'});
      });
      grid.append(b);
    }
    if(!detail.childElementCount){const p=document.createElement('p');p.className='madic-rdv-muted';p.textContent='Sélectionnez une journée pour afficher ses consultations.';detail.append(p);}
  }
  function initMonthControls(){
    const prev=$('rdvMonthPrev'),next=$('rdvMonthNext'),today=$('rdvMonthToday');
    if(!prev||!next||!today)return;
    const shift=n=>{calendarMonth=new Date(Date.UTC(calendarMonth.getUTCFullYear(),calendarMonth.getUTCMonth()+n,1,12));renderMonth();};
    prev.addEventListener('click',()=>shift(-1));next.addEventListener('click',()=>shift(1));
    today.addEventListener('click',()=>{calendarMonth=null;renderMonth();});
    $('slotDate').addEventListener('change',renderMonth);
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
          ? "Fermé"
          : active.has(s.id)
            ? "Réservation(s) en cours - autres heures potentiellement disponibles"
            : "Disponible",
      );
      const cell = r.insertCell();
      cell.className = "madic-rdv-actions";
      if (s.is_open && !active.has(s.id))
        cell.append(
          button("Fermer", async () => {
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
      r.cells[0].textContent = "Aucun créneau à venir.";
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
            : "Créneau passé",
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
          button("Confirmer", async () => {
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "confirmed",
            });
            if (error) throw error;
          }),
          button("Refuser", async () => {
            if (!confirm("Refuser cette demande ?")) return;
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
          button("Annuler", async () => {
            if (!confirm("Annuler ce rendez-vous ?")) return;
            const { error } = await db.rpc("madic_rdv_set_status", {
              p_appointment_id: a.id,
              p_status: "cancelled",
            });
            if (error) throw error;
          }),
        );
      if (a.status === "confirmed")
        cell.append(
          button("Lieu / lien", async () => {
            const { data, error } = await db.rpc("madic_rdv_meeting_details", {
              p_appointment_id: a.id,
            });
            if (error) throw error;
            alert(data?.[0]?.location_info || "Aucun lieu ou lien indiqué.");
          }),
        );
    }
    if (!ar.data?.length) {
      const r = br.insertRow();
      r.insertCell().colSpan = 5;
      r.cells[0].textContent = "Aucune réservation.";
    }
    await loadNotifications(spaceId);
    notice("Disponibilités et réservations actualisées.");
  }
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error("Connexion CRIC requise.");
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1);
    if (se) throw se;
    spaceId = spaces?.[0]?.id;
    if (!spaceId) throw Error("Aucun cabinet associé.");
    const { data: allowed, error: ae } = await db.rpc("madic_rdv_is_owner", {
      p_space_id: spaceId,
    });
    if (ae || allowed !== true) throw Error("Accès CRIC non autorisé.");
    setupNotifications();
    $("rdvApp").hidden = false;
    initializeDateLimits();
    initMonthControls();
    $("slotForm").onsubmit = async (e) => {
      e.preventDefault();
      updateDateLimits();
      const btn = e.submitter || $("slotForm").querySelector("button[type=submit]");
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
