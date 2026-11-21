(() => {
  const $ = (id) => document.getElementById(id);
  const elements = {
    days: $("radarDays"),
    plan: $("radarPlan"),
    firm: $("radarFirm"),
    status: $("radarStatus"),
  };
  const db = window.supabase ? window.getMadicSupabase() : null;
  let language,
    data,
    message,
    request = 0;
  const tr = (fr, en) => (language === "en" ? en : fr);
  const locale = () => tr("fr-CA", "en-CA");
  const number = (value) => new Intl.NumberFormat(locale()).format(value);
  const unknown = () => tr("Indisponible", "Unavailable");
  const make = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const show = (fr, en) => {
    message = [fr, en];
    elements.status.textContent = tr(fr, en);
  };
  function setLanguage(next) {
    language = next === "en" ? "en" : "fr";
    document.documentElement.lang = locale();
    localStorage.setItem("madic-lang", language);
    localStorage.setItem("madic-language", language);
    localStorage.setItem("madic_ui_language", language);
    document.querySelectorAll("[data-fr][data-en]").forEach((node) => {
      node.textContent = node.dataset[language];
    });
    for (const attribute of ["aria-label", "title"]) {
      const translation = "data-" + attribute + "-" + language;
      document.querySelectorAll("[" + translation + "]").forEach((node) => {
        node.setAttribute(attribute, node.getAttribute(translation));
      });
    }
    document.querySelectorAll("[data-language]").forEach((node) => {
      node.setAttribute(
        "aria-pressed",
        String(node.dataset.language === language),
      );
    });
    if (message) show(...message);
    if (data) {
      updateFirms();
      render();
    }
  }
  function table(parent, heads, rows) {
    const grid = make("table"),
      line = grid.createTHead().insertRow();
    heads.forEach((value) => {
      line.append(make("th", value));
    });
    const body = grid.createTBody();
    rows.forEach((values) => {
      const row = body.insertRow();
      values.forEach((value) => {
        row.insertCell().textContent = value;
      });
    });
    parent.replaceChildren(grid);
  }
  function bytes(value) {
    if (value == null) return unknown();
    const scale =
      value < 1024 ** 2 ? 1024 : value < 1024 ** 3 ? 1024 ** 2 : 1024 ** 3;
    const units =
      scale === 1024
        ? tr("ko", "KB")
        : scale === 1024 ** 2
          ? tr("Mo", "MB")
          : tr("Go", "GB");
    return (
      new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(
        value / scale,
      ) +
      " " +
      units
    );
  }
  function updateFirms() {
    const selected = elements.firm.value;
    const choices = data.firms.filter(
      (firm) =>
        firm.id &&
        (!elements.plan.value ||
          firm.subscription_plan === elements.plan.value),
    );
    elements.firm.replaceChildren(
      new Option(tr("Tous", "All"), ""),
      ...choices.map(
        (firm) => new Option(firm.name || firm.full_name, firm.id),
      ),
    );
    if (choices.some((firm) => firm.id === selected))
      elements.firm.value = selected;
  }
  function render() {
    const firms = data.firms.filter(
      (firm) =>
        (!elements.plan.value ||
          firm.subscription_plan === elements.plan.value) &&
        (!elements.firm.value || firm.id === elements.firm.value),
    );
    const ids = new Set(firms.map((firm) => firm.id).filter(Boolean));
    const visible = (items) => items.filter((item) => ids.has(item.space_id));
    const sum = (key) =>
      firms.reduce((total, firm) => total + Number(firm[key] || 0), 0);
    const storage = firms.filter((firm) => firm.storage_bytes != null);
    const sessions = visible(data.timeline);
    const geoData = visible(data.geography);
    const cards = [
      [
        tr("CRIC approuvés", "Approved RCICs"),
        number(firms.filter((firm) => !firm.revoked).length),
      ],
      [
        tr("Formules gratuites", "Free plans"),
        number(
          firms.filter(
            (firm) => firm.subscription_plan === "free" && !firm.revoked,
          ).length,
        ),
      ],
      [
        tr("Formules payantes", "Paid plans"),
        number(
          firms.filter(
            (firm) => firm.subscription_plan === "paid" && !firm.revoked,
          ).length,
        ),
      ],
      [
        tr("Clients distincts", "Unique clients"),
        number(
          new Set(
            firms.flatMap((firm) => firm.clients.map((client) => client.id)),
          ).size,
        ),
      ],
      [
        tr("Connexions CRIC mesurées", "Tracked RCIC sessions"),
        number(sum("cric_logins")),
      ],
      [
        tr("Connexions clients mesurées", "Tracked client sessions"),
        number(sum("client_logins")),
      ],
      [
        tr("Stockage attribué", "Attributed storage"),
        storage.length ? bytes(sum("storage_bytes")) : unknown(),
      ],
    ];
    $("radarCards").replaceChildren(
      ...cards.map(([label, value]) => {
        const card = make("div");
        card.className = "metric";
        card.append(make("span", label), make("strong", value));
        return card;
      }),
    );
    renderChart(sessions);
    renderGeo(geoData);
    const rows = $("radarRows");
    rows.replaceChildren();
    for (const firm of firms) {
      const row = rows.insertRow();
      const identity = row.insertCell();
      identity.append(
        make("strong", firm.full_name),
        make("br"),
        make(
          "span",
          [firm.name, firm.license_number].filter(Boolean).join(" · "),
        ),
      );
      const plan =
        { free: tr("Gratuite", "Free"), paid: tr("Payante", "Paid") }[
          firm.subscription_plan
        ] || tr("Sans cabinet", "No firm");
      const status = firm.revoked
        ? tr("Révoqué", "Revoked")
        : {
            active: tr("Actif", "Active"),
            suspended: tr("Suspendu", "Suspended"),
          }[firm.access_status];
      const billing =
        firm.subscription_plan === "paid"
          ? {
              pending: tr("Paiement en attente", "Payment pending"),
              paid_up: tr("À jour", "Paid up"),
            }[firm.payment_status]
          : null;
      row.insertCell().textContent = [plan, status, billing]
        .filter(Boolean)
        .join(" · ");
      const clients = row.insertCell();
      if (firm.clients.length) {
        const details = make("details"),
          list = make("ul");
        details.append(make("summary", number(firm.clients.length)), list);
        for (const client of firm.clients)
          list.append(make("li", client.name + " · " + number(client.logins)));
        clients.append(details);
      } else clients.textContent = "0";
      row.insertCell().textContent = number(firm.cric_logins);
      row.insertCell().textContent = number(firm.client_logins);
      row.insertCell().textContent = bytes(firm.storage_bytes);
    }
    if (!firms.length) {
      const empty = rows.insertRow().insertCell();
      empty.colSpan = 6;
      empty.textContent = tr(
        "Aucun cabinet pour ces filtres.",
        "No firms match these filters.",
      );
    }
  }
  function accumulate(items, key, value) {
    const counts = new Map();
    for (const row of items) {
      const group = key(row);
      const pair = counts.get(group) || { cric: 0, client: 0 };
      pair[row.actor_type] += Number(value(row));
      counts.set(group, pair);
    }
    return counts;
  }
  function renderChart(items) {
    const target = $("radarChart");
    const bins = accumulate(
      items,
      (row) => row.period,
      (row) => row.logins,
    );
    if (!bins.size) {
      target.replaceChildren(
        make(
          "p",
          tr(
            "Aucune connexion mesurée sur cette période.",
            "No tracked sessions in this period.",
          ),
        ),
      );
      return;
    }
    const days = Number(elements.days.value);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts()
      .reduce((all, piece) => ({ ...all, [piece.type]: piece.value }), {});
    const day = new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    );
    if (!Number.isNaN(day.getTime())) {
      for (let offset = 0; offset <= days; offset++) {
        const bucket =
          days <= 30
            ? day.toISOString().slice(0, 10)
            : day.toISOString().slice(0, 7) + "-01";
        if (!bins.has(bucket)) bins.set(bucket, { cric: 0, client: 0 });
        day.setUTCDate(day.getUTCDate() - 1);
      }
    }
    const max = Math.max(
      1,
      ...Array.from(bins.values(), (value) =>
        Math.max(value.cric, value.client),
      ),
    );
    const columns = make("div");
    columns.className = "chart-columns";
    const short = new Intl.DateTimeFormat(locale(), {
      ...(Number(elements.days.value) <= 30 ? { day: "numeric" } : {}),
      month: "short",
      timeZone: "UTC",
    });
    const full = new Intl.DateTimeFormat(locale(), {
      ...(Number(elements.days.value) <= 30 ? { day: "numeric" } : {}),
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    for (const [key, pair] of [...bins].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const date = new Date(key + "T00:00:00Z");
      const column = make("div");
      column.className = "chart-period";
      const bars = make("div");
      bars.className = "bars";
      for (const actor of ["cric", "client"]) {
        const meter = make("meter");
        meter.min = 0;
        meter.max = max;
        meter.value = pair[actor];
        meter.className = actor;
        const text =
          full.format(date) +
          " · " +
          (actor === "client" ? tr("Clients", "Clients") : tr("CRIC", "RCIC")) +
          " · " +
          number(pair[actor]);
        meter.title = text;
        meter.setAttribute("aria-label", text);
        bars.append(meter);
      }
      column.append(bars, make("span", short.format(date)));
      columns.append(column);
    }
    target.replaceChildren(columns);
  }
  function renderGeo(items) {
    const places = new Intl.DisplayNames([locale()], { type: "region" });
    const bins = accumulate(
      items,
      (row) => row.country_code || "",
      (row) => row.logins,
    );
    const values = [...bins]
      .sort(([, a], [, b]) => b.cric + b.client - (a.cric + a.client))
      .map(([code, pair]) => [
        code ? places.of(code) || code : unknown(),
        number(pair.cric),
        number(pair.client),
      ]);
    if (values.length)
      table(
        $("radarGeo"),
        [tr("Pays", "Country"), tr("CRIC", "RCIC"), tr("Clients", "Clients")],
        values,
      );
    else $("radarGeo").replaceChildren(make("p", unknown()));
  }
  async function load() {
    const id = ++request;
    show("Chargement…", "Loading…");
    const { data: result, error } = await db.rpc("madic_admin_radar", {
      p_days: Number(elements.days.value),
    });
    if (id !== request) return;
    if (error || !result) {
      show(
        "Données du radar indisponibles pour cette session.",
        "Radar data is unavailable for this session.",
      );
      $("radarData").hidden = true;
      return;
    }
    data = result;
    updateFirms();
    render();
    show("", "");
    $("radarData").hidden = false;
  }
  async function init() {
    if (!db)
      return show(
        "Connexion au service indisponible.",
        "Unable to connect to the service.",
      );
    const { data: session } = await db.auth.getUser();
    if (!session?.user)
      return show(
        "Connectez-vous comme super administrateur depuis Administration.",
        "Sign in as a super administrator from Administration.",
      );
    if (!(await window.madicRequireMfa(db)))
      return show(
        "Double authentification requise.",
        "Two-factor authentication required.",
      );
    const { data: allowed, error } = await db.rpc("madic_is_super_admin");
    if (error || allowed !== true)
      return show(
        "Accès réservé à la super administration.",
        "Super administrator access required.",
      );
    $("radarFilters").hidden = false;
    await load();
  }
  document.querySelectorAll("[data-language]").forEach((node) => {
    node.addEventListener("click", () => setLanguage(node.dataset.language));
  });
  $("radarLogout").addEventListener("click", async (event) => {
    event.preventDefault();
    const destination = event.currentTarget.href;
    if (db) await db.auth.signOut();
    location.href = destination;
  });
  elements.days.addEventListener("change", () => void load());
  elements.plan.addEventListener("change", () => {
    if (data) {
      updateFirms();
      render();
    }
  });
  elements.firm.addEventListener("change", () => {
    if (data) render();
  });
  setLanguage(
    localStorage.getItem("madic-lang") ||
      localStorage.getItem("madic-language") ||
      localStorage.getItem("madic_ui_language"),
  );
  init().catch(() =>
    show("Impossible de charger le radar.", "Unable to load the radar."),
  );
})();
