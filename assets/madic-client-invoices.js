/* MADIC 3.2 - Lecture des factures émises du client via RPC dédiée. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const notice = (text) => {
    if ($("clientInvoicesNotice")) $("clientInvoicesNotice").textContent = text;
  };
  if (!window.getMadicSupabase || !$("cabinet") || !$("clientInvoicesPanel"))
    return;
  const db = window.getMadicSupabase();
  const money = (cents) =>
    (Number(cents || 0) / 100).toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
  const total = (i) =>
    Math.round(Number(i.amount_cents) * (1 + Number(i.tax_rate)));
  const date = (value) => value || "-";
  let invoices = [];
  const add = (tag, text, parent) => {
    const e = document.createElement(tag);
    e.textContent = text ?? "";
    parent.append(e);
    return e;
  };
  function pdf(i) {
    const w = window.open("", "_blank");
    if (!w)
      return notice(
        "Autorisez les fenêtres contextuelles pour afficher la facture.",
      );
    const doc = w.document;
    doc.open();
    doc.write(
      '<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Facture</title><style>body{font:15px Arial,sans-serif;max-width:800px;margin:40px auto;color:#182331}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}.right{text-align:right}img{max-width:200px;max-height:90px;object-fit:contain}button{margin:24px 0;padding:10px}@media print{button{display:none}}</style></head><body><main id="invoice"></main><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></body></html>',
    );
    doc.close();
    const root = doc.getElementById("invoice");
    if (
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(
        i.logo_data_url || "",
      )
    ) {
      const img = doc.createElement("img");
      img.src = i.logo_data_url;
      img.alt = "Logo du cabinet";
      root.append(img);
    }
    add("h1", "Facture " + i.invoice_number, root);
    add("h2", i.cabinet_name, root);
    if (i.cabinet_address) add("p", i.cabinet_address, root);
    if (i.cabinet_tax_numbers)
      add("p", "Numéros de taxes : " + i.cabinet_tax_numbers, root);
    add(
      "p",
      "Émise le " + date(i.issued_on) + " · Échéance : " + date(i.due_on),
      root,
    );
    const table = add("table", "", root);
    const head = add("tr", "", table);
    for (const h of ["Description", "Qté", "Prix unitaire", "Montant"])
      add("th", h, head);
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
      const tr = add("tr", "", table);
      for (const value of [
        item.description,
        String(item.quantity),
        money(item.unit_price_cents),
        money(Number(item.quantity) * Number(item.unit_price_cents)),
      ])
        add("td", value, tr);
    }
    for (const [label, value] of [
      ["Sous-total", money(i.amount_cents)],
      ["Taxes", money(total(i) - i.amount_cents)],
      ["Total", money(total(i))],
      ["Paiements reçus", money(i.paid_cents)],
      ["Solde", money(total(i) - i.paid_cents)],
    ]) {
      const tr = add("tr", "", table);
      add("td", label, tr).colSpan = 3;
      add("td", value, tr).className = "right";
    }
    if (i.notes) add("p", "Notes : " + i.notes, root);
    w.focus();
  }
  async function payInvoice(invoice, button) {
    if (!invoice.id) {
      notice(
        "Identifiant de facture manquant. Vérifiez la fonction madic_my_issued_invoices.",
      );
      return;
    }
    button.disabled = true;
    button.textContent = "Préparation…";
    notice("Préparation du paiement sécurisé Stripe…");
    try {
      const { data, error } = await db.functions.invoke(
        "madic-stripe-create-checkout",
        {
          body: { invoice_id: invoice.id },
        },
      );
      if (error) {
        let detail = error.message || "Erreur Stripe";
        try {
          const payload = await error.context?.json();
          if (payload?.error) detail = payload.error;
        } catch (_) {
          /* La réponse peut ne pas être JSON. */
        }
        throw new Error(detail);
      }
      if (
        typeof data?.url !== "string" ||
        !/^https:\/\/checkout\.stripe\.com\//.test(data.url)
      ) {
        throw new Error("Lien de paiement Stripe invalide.");
      }
      window.location.assign(data.url);
    } catch (err) {
      notice("Paiement indisponible : " + (err.message || String(err)));
      button.disabled = false;
      button.textContent = "Payer en ligne";
    }
  }
  async function load() {
    const spaceId = $("cabinet").value;
    const body = $("clientInvoicesRows");
    body.replaceChildren();
    if (!spaceId) return;
    notice("Chargement des factures…");
    const { data, error } = await db.rpc("madic_my_issued_invoices", {
      p_space_id: spaceId,
    });
    if (error) {
      notice("Factures indisponibles : " + error.message);
      return;
    }
    invoices = Array.isArray(data) ? data : [];
    $("clientInvoicesPanel").hidden = false;
    for (const i of invoices) {
      const r = body.insertRow();
      for (const v of [
        i.invoice_number,
        date(i.issued_on),
        date(i.due_on),
        money(total(i)),
        money(total(i) - Number(i.paid_cents || 0)),
      ])
        add("td", v, r);
      const td = r.insertCell();
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Voir / PDF";
      b.addEventListener("click", () => pdf(i));
      td.append(b);
      const balance = total(i) - Number(i.paid_cents || 0);
      if (balance > 0) {
        const pay = document.createElement("button");
        pay.type = "button";
        pay.textContent = "Payer en ligne";
        pay.style.marginLeft = "0.5rem";
        pay.addEventListener("click", () => payInvoice(i, pay));
        td.append(pay);
      }
    }
    if (!invoices.length) {
      const r = body.insertRow();
      add("td", "Aucune facture émise pour ce cabinet.", r).colSpan = 6;
    }
    notice(
      invoices.length + " facture(s) émise(s) pour le cabinet sélectionné.",
    );
  }
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth?.user) return;
  $("cabinet").addEventListener("change", () =>
    load().catch((e) => notice(e.message)),
  );
  const observer = new MutationObserver(() => {
    if ($("cabinet").value) load().catch((e) => notice(e.message));
  });
  observer.observe($("cabinet"), { childList: true });
  if ($("cabinet").value) await load().catch((e) => notice(e.message));
})();
