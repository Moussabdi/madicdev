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
      '<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Facture</title><style>body{font:15px Arial,sans-serif;max-width:800px;margin:45px auto;color:#182331}h1{border-bottom:3px solid #162c49;padding-bottom:12px}section{margin:22px 0}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ccc;text-align:left}.right{text-align:right}.logo{max-height:95px;max-width:210px;object-fit:contain}button{margin-top:30px;padding:12px}@media print{button{display:none}body{margin:20px}}</style></head><body><main id="content"></main><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></body></html>',
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
      img.alt = "Logo du cabinet";
      root.append(img);
    }
    el("h1", "FACTURE " + i.invoice_number);
    el("h2", i.cabinet_name);
    if (i.cabinet_address) el("p", i.cabinet_address);
    if (i.cabinet_tax_numbers)
      el("p", "Numéros de taxes : " + i.cabinet_tax_numbers);
    const sec = el("section", "");
    el("h3", "Facturé à", sec);
    el("p", c ? name(c) : i.client_id, sec);
    if (c?.email) el("p", c.email, sec);
    el(
      "p",
      "Date : " + i.issued_on + (i.due_on ? " · Échéance : " + i.due_on : ""),
      sec,
    );
    if (d) el("p", "Dossier : " + d.reference, sec);
    const table = el("table", "");
    const head = el("tr", "", table);
    for (const x of ["Description", "Qté", "Prix unitaire", "Montant"])
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
      el("td", money(item.unit_price_cents), r);
      el("td", money(item.quantity * item.unit_price_cents), r).className =
        "right";
    }
    for (const [label, value] of [
      ["Sous-total", money(i.amount_cents)],
      [
        "Taxes (" + (Number(i.tax_rate) * 100).toLocaleString("fr-CA") + " %)",
        money(total(i) - i.amount_cents),
      ],
      ["TOTAL", money(total(i))],
      ["Paiements reçus", money(i.paid_cents)],
      ["Solde", money(total(i) - i.paid_cents)],
    ]) {
      const r = el("tr", "", table);
      el("td", label, r).colSpan = 3;
      el("td", value, r).className = "right";
    }
    if (i.notes) el("p", "Notes : " + i.notes);
    el(
      "p",
      "Statut : " +
        (i.status === "cancelled"
          ? "Annulée"
          : i.status === "draft"
            ? "Brouillon"
            : "Émise"),
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
          if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return say("Saisissez un montant valide avec deux décimales au maximum.");
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
      if (!Number.isSafeInteger(sum) || sum > 10000000000 || items.some(x => !Number.isSafeInteger(x.quantity * x.unit_price_cents)))
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
    if (typeof window.getMadicSupabase !== "function") throw new Error("Client Supabase indisponible");
    const { error } = await window.getMadicSupabase().auth.signOut();
    if (error) throw error;
    window.location.href = "connexion.html";
  } catch (error) {
    button.disabled = false;
    const status = document.getElementById("status");
    if (status) status.textContent = "Déconnexion impossible : " + (error.message || String(error));
  }
});

/* Indicateur de notifications CRIC dans l'en-tete, avec RLS Supabase. */
(async function madicBillingNotificationBadge(){
  const badge=document.querySelector('.madic-top-notification-count');
  if(!badge || typeof window.getMadicSupabase!=='function')return;
  try {
    const db=window.getMadicSupabase();
    const {data:auth,error:authError}=await db.auth.getUser();
    if(authError||!auth?.user)return;
    const {data:spaces,error:spaceError}=await db.from('madic_cric_spaces').select('id').eq('owner_user_id',auth.user.id).eq('access_status','active').limit(1);
    if(spaceError||!spaces?.length)return;
    const {data:allowed,error:permissionError}=await db.rpc('madic_can_manage_cric_space',{p_space_id:spaces[0].id});
    if(permissionError||allowed!==true)return;
    const refresh=async()=>{
      try {
        const {data,error}=await db.rpc('madic_cric_clients_connexions_non_lues',{p_space_id:spaces[0].id});
        if(error)throw error;
        const count=Math.max(0,Number(data)||0);
        badge.textContent=count>99?'99+':String(count);
        badge.hidden=count===0;
      }catch(error){console.warn('Compteur de notifications indisponible',error);badge.hidden=true;}
    };
    await refresh();
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  }catch(error){console.warn('Notifications CRIC indisponibles',error);}
})();
