/* Consolidated source: config(20261112-222053).js */
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

/* Consolidated source: madic-footer(20261112-222115).js */
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

/* Consolidated source: facturation-cric(20261112-222214).js */
/* MADIC Phase 3: la sécurité est imposée par les politiques RLS et les RPC Supabase. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    say = (s) => {
      $("status").textContent = s;
    };
  const cfg = window.MADIC_CONFIG;
  if (
    !cfg?.url ||
    !cfg?.anonKey ||
    !window.supabase ||
    !window.getMadicSupabase
  )
    return say("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let space,
    clients = [],
    dossiers = [],
    invoices = [];
  async function refreshStripeStatus() {
    const { data, error } = await db
      .from("madic_cric_stripe_accounts")
      .select(
        "stripe_account_id,charges_enabled,payouts_enabled,details_submitted",
      )
      .eq("space_id", space.id)
      .maybeSingle();
    if (error) {
      $("stripeStatus").textContent =
        "État Stripe indisponible : " + error.message;
      return;
    }
    if (!data?.stripe_account_id) {
      $("stripeStatus").textContent = "Aucun compte Stripe connecté.";
      $("connectStripe").textContent = "Connecter mon compte Stripe";
      return;
    }
    if (data.charges_enabled && data.payouts_enabled) {
      $("stripeStatus").textContent =
        "Compte Stripe actif selon la dernière synchronisation.";
      $("connectStripe").textContent = "Gérer la connexion Stripe";
    } else {
      $("stripeStatus").textContent =
        "Compte Stripe créé. Configuration ou vérification en attente.";
      $("connectStripe").textContent = "Continuer la configuration Stripe";
    }
  }
  async function connectStripe() {
    const btn = $("connectStripe");
    btn.disabled = true;
    $("stripeStatus").textContent = "Ouverture de Stripe…";
    try {
      const { data, error } = await db.functions.invoke(
        "madic-stripe-connect-onboarding",
        {
          body: { space_id: space.id },
        },
      );
      if (error) throw error;
      if (!data?.url)
        throw Error(data?.error || "Aucun lien de connexion reçu.");
      const target = new URL(data.url);
      if (
        target.protocol !== "https:" ||
        !(
          target.hostname === "stripe.com" ||
          target.hostname.endsWith(".stripe.com")
        )
      )
        throw Error("Adresse Stripe inattendue.");
      window.location.assign(target.href);
    } catch (e) {
      $("stripeStatus").textContent =
        "Connexion Stripe impossible : " + (e.message || String(e));
      btn.disabled = false;
    }
  }

  const name = (c) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.email ||
    "Client";
  const money = (c) =>
    (Number(c) / 100).toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
  const cents = (v) => Math.round(Number(v) * 100);
  const addOption = (sel, value, text) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    sel.append(o);
  };
  const total = (i) =>
    Math.round(Number(i.amount_cents) * (1 + Number(i.tax_rate)));
  function refreshDossiers() {
    const sel = $("dossier");
    sel.replaceChildren();
    addOption(sel, "", "Aucun dossier");
    for (const d of dossiers.filter((d) => d.client_id === $("client").value))
      addOption(sel, d.id, d.reference || d.id);
  }
  function showInvoice(i) {
    const en = (() => { try { return localStorage.getItem("madic_ui_language") === "en"; } catch (_) { return document.documentElement.lang.startsWith("en"); } })();
    const t = (fr, english) => en ? english : fr;
    const formatMoney = (value) => (Number(value) / 100).toLocaleString(en ? "en-CA" : "fr-CA", {style:"currency",currency:"CAD"});
    const c = clients.find((x) => x.id === i.client_id),
      d = dossiers.find((x) => x.id === i.dossier_id);
    const w = window.open("", "_blank");
    if (!w) {
      say("Autorisez les fenêtres contextuelles pour imprimer.");
      return;
    }
    const doc = w.document;
    doc.open();
    doc.write(
      '<!doctype html><html lang="' + (en ? "en-CA" : "fr-CA") + '"><head><meta charset="utf-8"><title>' + t("Facture", "Invoice") + '</title><style>body{font:15px Arial,sans-serif;max-width:800px;margin:45px auto;color:#182331}h1{border-bottom:3px solid #162c49;padding-bottom:12px}section{margin:22px 0}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ccc;text-align:left}.right{text-align:right}.logo{max-height:95px;max-width:210px;object-fit:contain}button{margin-top:30px;padding:12px}@media print{button{display:none}body{margin:20px}}</style></head><body><main id="content"></main><button onclick="window.print()">' + t("Imprimer / Enregistrer en PDF", "Print / Save as PDF") + '</button></body></html>',
    );
    doc.close();
    const root = doc.getElementById("content");
    const el = (tag, text, parent = root) => {
      const n = doc.createElement(tag);
      n.textContent = text ?? "";
      parent.append(n);
      return n;
    };
    if (
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(
        i.logo_data_url || "",
      )
    ) {
      const img = doc.createElement("img");
      img.src = i.logo_data_url;
      img.className = "logo";
      img.alt = t("Logo du cabinet", "Practice logo");
      root.append(img);
    }
    el("h1", t("FACTURE ", "INVOICE ") + i.invoice_number);
    el("h2", i.cabinet_name);
    if (i.cabinet_address) el("p", i.cabinet_address);
    if (i.cabinet_tax_numbers)
      el("p", t("Numéros de taxes : ", "Tax numbers: ") + i.cabinet_tax_numbers);
    const sec = el("section", "");
    el("h3", t("Facturé à", "Billed to"), sec);
    el("p", c ? name(c) : i.client_id, sec);
    if (c?.email) el("p", c.email, sec);
    el(
      "p",
      t("Date : ", "Date: ") + i.issued_on + (i.due_on ? t(" · Échéance : ", " · Due: ") + i.due_on : ""),
      sec,
    );
    if (d) el("p", t("Dossier : ", "Case: ") + d.reference, sec);
    const table = el("table", "");
    const head = el("tr", "", table);
    for (const x of ["Description", t("Qté", "Qty"), t("Prix unitaire", "Unit price"), t("Montant", "Amount")])
      el("th", x, head);
    const items =
      Array.isArray(i.items) && i.items.length
        ? i.items
        : [
            {
              description: i.description,
              quantity: 1,
              unit_price_cents: i.amount_cents,
            },
          ];
    for (const item of items) {
      const r = el("tr", "", table);
      el("td", item.description, r);
      el("td", String(item.quantity), r);
      el("td", formatMoney(item.unit_price_cents), r);
      el("td", formatMoney(item.quantity * item.unit_price_cents), r).className =
        "right";
    }
    for (const [label, value] of [
      [t("Sous-total", "Subtotal"), formatMoney(i.amount_cents)],
      [
        t("Taxes (", "Taxes (") + (Number(i.tax_rate) * 100).toLocaleString(en ? "en-CA" : "fr-CA") + " %)",
        formatMoney(total(i) - i.amount_cents),
      ],
      ["TOTAL", formatMoney(total(i))],
      [t("Paiements reçus", "Payments received"), formatMoney(i.paid_cents)],
      [t("Solde", "Balance"), formatMoney(total(i) - i.paid_cents)],
    ]) {
      const r = el("tr", "", table);
      el("td", label, r).colSpan = 3;
      el("td", value, r).className = "right";
    }
    if (i.notes) el("p", t("Notes : ", "Notes: ") + i.notes);
    el(
      "p",
      t("Statut : ", "Status: ") +
        (i.status === "cancelled"
          ? t("Annulée", "Cancelled")
          : i.status === "draft"
            ? t("Brouillon", "Draft")
            : t("Émise", "Issued")),
    );
    w.focus();
  }
  function newLine(description = "", quantity = "1", price = "") {
    const tr = document.createElement("tr"),
      td = (node) => {
        const cell = tr.insertCell();
        cell.append(node);
        return cell;
      };
    const desc = document.createElement("input");
    desc.className = "item-desc";
    desc.placeholder = "Service / débours";
    desc.maxLength = 500;
    desc.required = true;
    desc.value = description;
    td(desc);
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.max = "100000";
    qty.step = "1";
    qty.required = true;
    qty.value = quantity;
    td(qty);
    const unit = document.createElement("input");
    unit.type = "number";
    unit.min = "0";
    unit.max = "100000000";
    unit.step = ".01";
    unit.required = true;
    unit.placeholder = "0.00";
    unit.value = price;
    td(unit);
    const amount = document.createElement("span");
    amount.textContent = money(0);
    td(amount);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary";
    del.textContent = "Retirer";
    td(del);
    const recalc = () => {
      const q = Number(qty.value),
        p = cents(unit.value);
      amount.textContent = money(
        Number.isSafeInteger(q) && q > 0 && Number.isSafeInteger(p) ? q * p : 0,
      );
      updateSubtotal();
    };
    for (const field of [desc, qty, unit])
      field.addEventListener("input", recalc);
    del.addEventListener("click", () => {
      tr.remove();
      updateSubtotal();
    });
    $("itemRows").append(tr);
    recalc();
  }
  function getItems() {
    return [...$("itemRows").rows].map((r) => {
      const fields = r.querySelectorAll("input");
      return {
        description: fields[0].value.trim(),
        quantity: Number(fields[1].value),
        unit_price_cents: cents(fields[2].value),
      };
    });
  }
  function updateSubtotal() {
    const items = getItems();
    const sum = items.reduce(
      (a, x) =>
        a +
        (Number.isSafeInteger(x.quantity) &&
        Number.isSafeInteger(x.unit_price_cents)
          ? x.quantity * x.unit_price_cents
          : 0),
      0,
    );
    $("subtotal").textContent = "Sous-total : " + money(sum);
  }
  let logoData = null;
  async function loadLogo(file) {
    if (!file) {
      logoData = null;
      $("logoPreview").hidden = true;
      return;
    }
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 100 * 1024
    )
      throw Error("Logo PNG/JPG de 100 Ko maximum requis.");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error("Lecture du logo impossible."));
      reader.readAsDataURL(file);
    });
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data))
      throw Error("Format du logo invalide.");
    logoData = data;
    $("logoPreview").src = data;
    $("logoPreview").hidden = false;
  }
  async function load() {
    const { data, error } = await db
      .from("madic_cric_invoices")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    invoices = data || [];
    const tbody = $("rows");
    tbody.replaceChildren();
    for (const i of invoices) {
      const r = tbody.insertRow();
      const values = [
        i.invoice_number,
        name(clients.find((c) => c.id === i.client_id) || {}),
        i.issued_on,
        money(total(i)),
        money(i.paid_cents),
        i.status === "cancelled"
          ? "Annulée"
          : i.paid_cents >= total(i)
            ? "Payée"
            : i.paid_cents > 0
              ? "Partielle"
              : i.status === "draft"
                ? "Brouillon"
                : "Non payée",
      ];
      for (const v of values) {
        const td = r.insertCell();
        td.textContent = v;
      }
      const td = r.insertCell();
      if (i.status === "draft") {
        const issue = document.createElement("button");
        issue.type = "button";
        issue.textContent = "Émettre";
        issue.addEventListener("click", async () => {
          if (
            !confirm("Émettre cette facture et la rendre visible au client ?")
          )
            return;
          issue.disabled = true;
          const { error } = await db
            .from("madic_cric_invoices")
            .update({ status: "issued" })
            .eq("id", i.id)
            .eq("space_id", space.id)
            .eq("status", "draft");
          if (error) {
            say("Émission impossible : " + error.message);
            issue.disabled = false;
            return;
          }
          await load();
          say("Facture émise et visible dans le portail client.");
        });
        td.append(issue);
      }
      const pdf = document.createElement("button");
      pdf.type = "button";
      pdf.textContent = "PDF";
      pdf.addEventListener("click", () => showInvoice(i));
      td.append(pdf);
      if (i.status === "issued") {
        const pay = document.createElement("button");
        pay.type = "button";
        pay.textContent = "Paiement";
        pay.addEventListener("click", async () => {
          const raw = prompt(
            "Total cumulé des paiements reçus (CAD)",
            (i.paid_cents / 100).toFixed(2),
          );
          if (raw === null) return;
          const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
          if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
            return say(
              "Saisissez un montant valide avec deux décimales au maximum.",
            );
          const n = cents(normalized);
          if (!Number.isSafeInteger(n) || n < 0 || n > total(i))
            return say(
              "Montant invalide : le paiement ne peut dépasser le total.",
            );
          const { error } = await db
            .from("madic_cric_invoices")
            .update({ paid_cents: n })
            .eq("id", i.id)
            .eq("space_id", space.id);
          if (error) return say(error.message);
          await load();
          say("Paiement mis à jour.");
        });
        td.append(pay);
      }
      if (i.status !== "cancelled") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Annuler";
        cancel.addEventListener("click", async () => {
          if (!confirm("Annuler cette facture ?")) return;
          const { error } = await db
            .from("madic_cric_invoices")
            .update({ status: "cancelled" })
            .eq("id", i.id)
            .eq("space_id", space.id);
          if (error) return say(error.message);
          await load();
          say("Facture annulée.");
        });
        td.append(cancel);
      }
    }
    if (!invoices.length) {
      const r = tbody.insertRow();
      r.insertCell().colSpan = 7;
      r.cells[0].textContent = "Aucune facture pour ce cabinet.";
    }
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-cric.html");
      return;
    }
    const uid = auth.user.id;
    const { data: app, error: ae } = await db
      .from("madic_cric_applications")
      .select("status")
      .eq("user_id", uid)
      .maybeSingle();
    if (ae) throw ae;
    if (app?.status !== "approved") throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (se) throw se;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou inactif.");
    const { data: allowed, error: pe } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (pe || allowed !== true) throw Error("Accès refusé.");
    const { data: links, error: le } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", space.id);
    if (le) throw le;
    const ids = [...new Set((links || []).map((x) => x.client_id))];
    if (ids.length) {
      const { data, error } = await db
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", ids);
      if (error) throw error;
      clients = data || [];
    }
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,client_id,reference")
      .eq("space_id", space.id);
    if (de) throw de;
    dossiers = (ds || []).filter((x) => ids.includes(x.client_id));
    $("client").replaceChildren();
    addOption($("client"), "", "Sélectionner un client");
    for (const c of clients)
      addOption($("client"), c.id, name(c) + " - " + (c.email || ""));
    $("client").addEventListener("change", refreshDossiers);
    const requestedClient = new URLSearchParams(location.search).get("client");
    if (requestedClient && clients.some((c) => c.id === requestedClient))
      $("client").value = requestedClient;
    refreshDossiers();
    $("cabinet").value = space.name;
    $("connectStripe").addEventListener("click", connectStripe);
    await refreshStripeStatus();
    $("app").hidden = false;
    say("Espace de facturation du cabinet : " + space.name);
    newLine();
    $("addLine").addEventListener("click", () => newLine());
    $("logo").addEventListener("change", async () => {
      try {
        await loadLogo($("logo").files[0]);
      } catch (err) {
        $("logo").value = "";
        logoData = null;
        $("logoPreview").hidden = true;
        say(err.message);
      }
    });
    await load();
    $("refresh").addEventListener("click", async () => {
      try {
        await load();
        say("Factures actualisées.");
      } catch (e) {
        say(e.message);
      }
    });
    $("invoiceForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const client = $("client").value,
        dossier = $("dossier").value || null,
        rate = Number($("tax").value) / 100,
        items = getItems();
      if (
        !clients.some((c) => c.id === client) ||
        (dossier &&
          !dossiers.some((d) => d.id === dossier && d.client_id === client)) ||
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 1 ||
        items.length < 1 ||
        items.length > 100 ||
        items.some(
          (x) =>
            !x.description ||
            x.description.length > 500 ||
            !Number.isSafeInteger(x.quantity) ||
            x.quantity < 1 ||
            x.quantity > 100000 ||
            !Number.isSafeInteger(x.unit_price_cents) ||
            x.unit_price_cents < 0,
        )
      )
        return say("Vérifiez les lignes, quantités et montants.");
      const sum = items.reduce(
        (a, x) => a + x.quantity * x.unit_price_cents,
        0,
      );
      if (
        !Number.isSafeInteger(sum) ||
        sum > 10000000000 ||
        items.some(
          (x) => !Number.isSafeInteger(x.quantity * x.unit_price_cents),
        )
      )
        return say("Montant total trop élevé.");
      const btn = $("save");
      btn.disabled = true;
      try {
        const { error } = await db.rpc("madic_create_cric_invoice_v2", {
          p_space_id: space.id,
          p_client_id: client,
          p_dossier_id: dossier,
          p_items: items,
          p_tax_rate: rate,
          p_due_on: $("due").value || null,
          p_cabinet_name: $("cabinet").value,
          p_cabinet_address: $("address").value || null,
          p_cabinet_tax_numbers: $("taxNumbers").value || null,
          p_notes: $("notes").value || null,
          p_logo_data_url: logoData,
        });
        if (error) throw error;
        await load();
        say(
          "Facture créée avec " +
            items.length +
            " ligne(s). Cliquez sur PDF pour imprimer ou enregistrer.",
        );
        $("itemRows").replaceChildren();
        newLine();
      } catch (err) {
        say("Création impossible : " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  } catch (err) {
    say(
      "Impossible de charger la facturation : " + (err.message || String(err)),
    );
  }
})();

/* Deconnexion de l'en-tete harmonise. */
document.getElementById("cricLogout")?.addEventListener("click", async () => {
  const button = document.getElementById("cricLogout");
  button.disabled = true;
  try {
    if (typeof window.getMadicSupabase !== "function")
      throw new Error("Client Supabase indisponible");
    const { error } = await window.getMadicSupabase().auth.signOut();
    if (error) throw error;
    window.location.href = "connexion.html";
  } catch (error) {
    button.disabled = false;
    const status = document.getElementById("status");
    if (status)
      status.textContent =
        "Déconnexion impossible : " + (error.message || String(error));
  }
});

/* Indicateur de notifications CRIC dans l'en-tete, avec RLS Supabase. */
(async function madicBillingNotificationBadge() {
  const badge = document.querySelector(".madic-top-notification-count");
  if (!badge || typeof window.getMadicSupabase !== "function") return;
  try {
    const db = window.getMadicSupabase();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) return;
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id")
      .eq("owner_user_id", auth.user.id)
      .eq("access_status", "active")
      .limit(1);
    if (spaceError || !spaces?.length) return;
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaces[0].id },
    );
    if (permissionError || allowed !== true) return;
    const refresh = async () => {
      try {
        const { data, error } = await db.rpc(
          "madic_cric_clients_connexions_non_lues",
          { p_space_id: spaces[0].id },
        );
        if (error) throw error;
        const count = Math.max(0, Number(data) || 0);
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
      } catch (error) {
        console.warn("Compteur de notifications indisponible", error);
        badge.hidden = true;
      }
    };
    await refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refresh();
    });
  } catch (error) {
    console.warn("Notifications CRIC indisponibles", error);
  }
})();

/* Libelle officiel de l'en-tete : Mon espace / My space. */
(() => {
  const apply = () => {
    const link = document.querySelector('.toplinks a[data-fr="Mon espace"]');
    if (!link) return;
    const en = (() => {
      try {
        return localStorage.getItem("madic_ui_language") === "en";
      } catch (_) {
        return document.documentElement.lang.toLowerCase().startsWith("en");
      }
    })();
    const expected = en ? "My space" : "Mon espace";
    if (link.textContent.trim() !== expected) link.textContent = expected;
    link.setAttribute("data-en", "My space");
    link.setAttribute("data-madic-en", "My space");
  };
  const init = () => {
    apply();
    const link = document.querySelector('.toplinks a[data-fr="Mon espace"]');
    if (link)
      new MutationObserver(apply).observe(link, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    document.querySelectorAll(".madic-lang-controls button").forEach((b) =>
      b.addEventListener("click", () => {
        queueMicrotask(apply);
        setTimeout(apply, 0);
      }),
    );
    window.addEventListener("storage", apply);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* Consolidated source: madic-datahubz-unified(20261112-222132).js */
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

/* Consolidated source: madic-i18n-cric(20261112-222151).js */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  "use strict";
  const dictionary = {
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
    "Mon espace": "My workspace",
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
    [/^Connexion Stripe impossible\s*:/i, "Stripe connection failed:"],
    [/^Erreur de chargement\s*:/i, "Loading error:"],
    [/^Erreur de paiement\s*:/i, "Payment error:"],
    [/^Erreur\s*:/i, "Error:"],
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


/* Bilingual due-date picker: #due retains the ISO date used by invoice submission. */
(() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const getLang = () => window.MadicCricLanguage?.get?.() === 'en' ? 'en' : 'fr';
  const locale = () => getLang() === 'en' ? 'en-CA' : 'fr-CA';
  function setup() {
    const input = document.getElementById('due');
    const button = document.getElementById('madicInvoiceDateToggle');
    const panel = document.getElementById('madicInvoiceDatePanel');
    const wrapper = document.getElementById('madicInvoiceCalendar');
    if (!input || !button || !panel || !wrapper) return;
    let shown = input.value && /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? new Date(input.value+'T12:00:00') : new Date();
    const today = () => iso(new Date());
    const close = () => { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); };
    function paint() {
      button.textContent = input.value ? new Date(input.value+'T12:00:00').toLocaleDateString(locale(), {year:'numeric',month:'short',day:'numeric'}) : (getLang()==='en' ? 'Select a date' : 'Choisir une date');
      button.setAttribute('aria-label', getLang()==='en' ? 'Choose due date' : 'Choisir la date d’échéance');
      panel.setAttribute('aria-label', getLang()==='en' ? 'Choose due date' : 'Choisir la date d’échéance');
      panel.replaceChildren();
      const head = document.createElement('div'); head.className='madic-cal-head';
      const prev = document.createElement('button'); prev.type='button'; prev.textContent='‹'; prev.setAttribute('aria-label',getLang()==='en'?'Previous month':'Mois précédent');
      const next = document.createElement('button'); next.type='button'; next.textContent='›'; next.setAttribute('aria-label',getLang()==='en'?'Next month':'Mois suivant');
      const label = document.createElement('strong'); label.textContent=shown.toLocaleDateString(locale(),{month:'long',year:'numeric'});
      const current = new Date();
      const earliest = shown.getFullYear()===current.getFullYear() && shown.getMonth()<=current.getMonth();
      prev.disabled=earliest;
      prev.onclick=()=>{if(earliest)return;shown=new Date(shown.getFullYear(),shown.getMonth()-1,1);paint();};
      next.onclick=()=>{shown=new Date(shown.getFullYear(),shown.getMonth()+1,1);paint();};
      head.append(prev,label,next);panel.append(head);
      const grid=document.createElement('div');grid.className='madic-cal-grid';
      const weekdays=getLang()==='en'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
      weekdays.forEach(day=>{const span=document.createElement('span');span.textContent=day;grid.append(span);});
      for(let i=0;i<new Date(shown.getFullYear(),shown.getMonth(),1).getDay();i++)grid.append(document.createElement('span'));
      const days=new Date(shown.getFullYear(),shown.getMonth()+1,0).getDate();
      for(let day=1;day<=days;day++){
        const date=new Date(shown.getFullYear(),shown.getMonth(),day);
        const cell=document.createElement('button');cell.type='button';cell.textContent=String(day);
        if(iso(date)<today()){cell.disabled=true;cell.className='madic-past-day';}
        if(iso(date)===input.value)cell.className='selected';
        cell.onclick=()=>{if(cell.disabled)return;input.value=iso(date);input.dispatchEvent(new Event('change',{bubbles:true}));close();paint();};
        grid.append(cell);
      }
      panel.append(grid);
      const clear=document.createElement('button');clear.type='button';clear.className='madic-cal-clear';clear.textContent=getLang()==='en'?'Clear':'Effacer';
      clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));close();paint();};panel.append(clear);
    }
    button.onclick=()=>{shown=input.value && input.value>=today()?new Date(input.value+'T12:00:00'):new Date();panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));paint();};
    document.addEventListener('click',event=>{if(!wrapper.contains(event.target))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    document.addEventListener('madic:languagechange',paint);
    document.getElementById('invoiceForm')?.addEventListener('reset',()=>setTimeout(paint,0));
    input.addEventListener('change',paint);
    paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
