/* MADIC - Mes contrats : scripts de la page consolides. */
(async function () {
  "use strict";
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Impossible de charger la bibliotheque Supabase."));
      document.head.appendChild(s);
    });
  }
/* Module 1 */
/* MADIC - module de contrats. Prototype : ne constitue pas une signature electronique qualifiee. */
(() => {
  "use strict";
  const config = window.MADIC_CONFIG;
  const root = document.getElementById("madic-contracts");
  if (!root) return;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const client = window.getMadicSupabase();
  const note = (s, bad = false) => {
    document.getElementById("contract-message").textContent = s;
    document.getElementById("contract-message").style.color = bad
      ? "#b42318"
      : "inherit";
  };
  const fmt = (x) => new Date(x).toLocaleString("fr-CA");
  const name = (c) =>
    [c.client_snapshot?.first_name, c.client_snapshot?.last_name]
      .filter(Boolean)
      .join(" ");
  const renderText = (c) => {
    const variables = {
      client_name: name(c),
      rate: Number(c.rate).toFixed(2),
      spouse_extra: Number(c.spouse_extra).toFixed(2),
      currency: c.currency,
      business_address: c.business_address,
      consultant_name: c.consultant_name,
      consultant_licence: c.consultant_licence,
    };
    return esc(c.body_snapshot)
      .replace(/\{\{([a-z_]+)\}\}/g, (_, key) => esc(variables[key] ?? ""))
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>");
  };
  const FORFAIT_REFERENCE_CLAUSES =
    "CONTRAT DE CONSULTATION INITIALE - TAUX FORFAITAIRE\n\nJe soussigné(e), {{client_name}}, demande une consultation de la part de MAD Immigration Canadienne (MADIC) inc., située au Bureau 202, 1622 Rue Barré, Saint-Laurent, Québec, H4L 4M8, Canada.\n\n1. OBJET DE LA CONSULTATION\nL'objet du contrat de consultation initiale est d'obtenir un avis professionnel du consultant sur mes projets ou objectifs d'immigration au Canada.\n\n2. HONORAIRES PROFESSIONNELS\nDes honoraires forfaitaires de {{rate}} {{currency}} sont exigibles pour une personne. Un montant additionnel de {{spouse_extra}} {{currency}} s'applique pour l'inclusion de l'époux ou de l'épouse. Ces honoraires couvrent la consultation ainsi que les travaux professionnels visés par le présent mandat, effectués par le consultant ou ses associés autorisés.\n\n3. DÉCLARATION RELATIVE À UN AUTRE REPRÉSENTANT\nJe confirme ne pas avoir conclu de contrat avec un autre individu autorisé à me représenter en vertu de la législation applicable en matière d'immigration et de protection des réfugiés. Le cas échéant, je m'engage à en informer MADIC avant le début du mandat.\n\n4. CONDITIONS ET MODALITÉS DE PAIEMENT\nLes conditions du présent contrat sont soumises aux lois applicables au Québec et au Canada. Les paiements peuvent être effectués par virement Interac, traite bancaire, chèque personnel, dépôt direct ou virement bancaire international selon les instructions transmises par MADIC.\nPaiement Interac : madimmigrationcanadienne@gmail.com\nLes coordonnées bancaires complètes seront communiquées par un moyen approprié et ne sont pas intégrées dans ce modèle public.\n\n5. STATUT ET OBLIGATIONS PROFESSIONNELLES DU CONSULTANT\nLe mandat est exécuté par {{consultant_name}}, titulaire du permis {{consultant_licence}}, consultant réglementé en immigration canadienne. À ce titre, il est tenu de respecter les exigences professionnelles, le code de déontologie et les règles applicables du Collège des consultants en immigration et en citoyenneté (CCIC). Le Collège réglemente la profession dans l'intérêt public et veille notamment à la protection du public, aux normes de pratique et au respect du code de déontologie.\n\n6. NOTE IMPORTANTE - DÉBUT DU MANDAT\nLa consultation ou le projet débute officiellement à compter de la réception du dépôt requis. Le tarif forfaitaire de référence du document fourni est de 599 $ US pour une personne, auquel s'ajoutent 150 $ US pour un conjoint, soit 749 $ US pour un couple. Les montants contractuels applicables sont ceux indiqués à la section 2 et doivent être vérifiés par l'administrateur avant publication.\n\n7. ACCEPTATION ET SIGNATURES\nJe comprends et accepte les conditions du présent contrat. Toute modification des conditions contractuelles doit faire l'objet d'un accord approprié entre les parties.\n\nRENSEIGNEMENTS SUR LE CLIENT\nNom et prénom : {{client_name}}\nDate de naissance : à compléter dans le dossier du client\nAdresse de résidence : à compléter dans le dossier du client\nCourriel et téléphone : selon le profil du client\n\nCONSULTANT\nNom : {{consultant_name}}\nPermis : {{consultant_licence}}\nPermis au registre du Québec (document de référence) : 12152\nAdresse professionnelle : {{business_address}}\n\nSIGNATURES\nSignature du client : par la procédure de signature électronique du portail MADIC\nDate et ville du client : à compléter ou à consigner lors de la signature\nSignature du consultant : à compléter selon la procédure professionnelle applicable\nDate et ville du consultant : à compléter\n\nCOORDONNÉES MADIC\nTéléphone : 514-442-3076\nCourriel : madimmigrationcanadienne@gmail.com\nSite Web : https://madimmigrationcanadienne.netlify.app/";
  let contracts = [],
    dossiers = [],
    templates = [],
    profiles = [],
    initialContracts = [];
  const admin = root.dataset.mode === "admin";
  const button = (text, action, id) =>
    `<button type="button" class="secondary" data-action="${esc(action)}" data-id="${esc(id)}">${esc(text)}</button>`;
  async function call(fn, args) {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw error;
    return data;
  }
  async function load() {
    const {
      data: { user },
      error: authErr,
    } = await client.auth.getUser();
    if (authErr || !user) {
      location.href = "connexion.html";
      return;
    }
    if (admin) {
      const { data: p, error: pe } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (pe || p?.role !== "admin") {
        location.href = "dashboard.html";
        return;
      }
      const results = await Promise.all([
        client.from("madic_contract_templates").select("*").order("kind"),
        client
          .from("dossiers")
          .select("id,client_id,reference,status")
          .eq("status", "actif"),
        client
          .from("profiles")
          .select("id,first_name,last_name,email")
          .eq("role", "client"),
        client
          .from("madic_contracts")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      for (const r of results) if (r.error) throw r.error;
      [templates, dossiers, profiles, contracts] = results.map((r) => r.data);
      renderAdmin();
    } else {
      const { data, error } = await client
        .from("madic_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      contracts = data;
      // Le contrat initial est la version figee de #contractDocument publiee par le CRIC.
      const { data: initialData, error: initialError } = await client
        .from("madic_initial_contracts")
        .select("*")
        .eq("client_id", user.id)
        .in("status", ["publie", "signe"])
        .order("created_at", { ascending: false });
      if (initialError) throw initialError;
       initialContracts = initialData || [];
       const dossierIds=[...new Set([...initialContracts,...contracts].map(c=>c.dossier_id).filter(Boolean))];
       dossiers=[];
       if(dossierIds.length){const {data:ds,error:de}=await client.from('dossiers').select('id,reference,category').in('id',dossierIds);if(de)console.warn('Références de dossiers indisponibles',de);else dossiers=ds||[];}
       renderClient();
    }
  }
  const LOGO_BUCKET = "madic-contract-logos";
  const logoPath = (side) =>
    side === "left" ? "branding/logo-gauche" : "branding/logo-droit";
  const logoUrl = (side) =>
    client.storage.from(LOGO_BUCKET).getPublicUrl(logoPath(side)).data
      .publicUrl;
  document.addEventListener("error", (event) => { if (event.target.matches?.("img[data-logo]")) event.target.hidden = true; }, true);
  function logoHeader() {
    return `<div class="madic-contract-logo-header"><img data-logo="left" src="${esc(logoUrl("left") + "?v=" + Date.now())}" alt="Logo gauche"><img data-logo="right" src="${esc(logoUrl("right") + "?v=" + Date.now())}" alt="Logo droit"></div>`;
  }
  async function setupLogoAdmin() {
    const status = root.querySelector("#madic-logo-status");
    const refresh = () => {
      for (const side of ["left", "right"]) {
        const img = root.querySelector(`[data-logo-preview="${side}"]`);
        if (!img) continue;
        img.hidden = false;
        img.onerror = () => {
          img.hidden = true;
        };
        img.src = logoUrl(side) + "?v=" + Date.now();
      }
    };
    refresh();
    for (const side of ["left", "right"]) {
      root
        .querySelector(`[data-logo-upload="${side}"]`)
        .addEventListener("click", async () => {
          const file = root.querySelector(`[data-logo-file="${side}"]`)
            .files[0];
          if (!file) {
            status.textContent = "Choisissez une image.";
            return;
          }
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
            file.size > 2 * 1024 * 1024
          ) {
            status.textContent = "Format PNG, JPG ou WebP, maximum 2 Mo.";
            return;
          }
          const ext =
            file.type === "image/png"
              ? "png"
              : file.type === "image/webp"
                ? "webp"
                : "jpg";
          // Stable object path with a content type set explicitly for public display.
          const { error } = await client.storage
            .from(LOGO_BUCKET)
            .upload(logoPath(side), file, {
              upsert: true,
              contentType: file.type,
              cacheControl: "60",
            });
          status.textContent = error
            ? "Erreur : " + error.message
            : "Logo " + (side === "left" ? "gauche" : "droit") + " enregistré.";
          if (!error) refresh();
        });
      root
        .querySelector(`[data-logo-remove="${side}"]`)
        .addEventListener("click", async () => {
          if (!confirm("Supprimer ce logo des contrats ?")) return;
          const { error } = await client.storage
            .from(LOGO_BUCKET)
            .remove([logoPath(side)]);
          status.textContent = error
            ? "Erreur : " + error.message
            : "Logo supprimé.";
          if (!error) refresh();
        });
    }
  }
  function renderAdmin() {
    root.innerHTML = `<section class="madic-logo-admin"><h2>Logos des contrats</h2><p>Importation réservée à l’administrateur. Les logos s’affichent à gauche et à droite de l’en-tête du contrat.</p>
  <div class="madic-logo-grid">${["left", "right"].map((side) => `<div class="madic-logo-slot"><h3>Logo ${side === "left" ? "gauche" : "droit"}</h3><img class="madic-logo-preview" data-logo-preview="${side}" alt="Aperçu du logo ${side === "left" ? "gauche" : "droit"}" hidden><input type="file" data-logo-file="${side}" accept="image/png,image/jpeg,image/webp"><button type="button" data-logo-upload="${side}">Téléverser</button><button type="button" class="secondary" data-logo-remove="${side}">Supprimer</button></div>`).join("")}</div><p class="madic-logo-status" id="madic-logo-status"></p></section><hr><h2>Modèles modifiables</h2><p>Les modifications s'appliquent aux futurs contrats. Un contrat déjà créé conserve sa version.</p>
   <label>Modèle <select id="template-kind">${templates.map((t) => `<option value="${esc(t.kind)}">${esc(t.title)}</option>`).join("")}</select></label>
   <form id="template-form"><label>Titre <input name="title" required></label><label>Tarif <input name="rate" type="number" step="0.01" min="0" required></label>
   <label>Supplément conjoint <input name="spouse_extra" type="number" step="0.01" min="0" required></label>
   <label>Devise <select name="currency"><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
   <label>Adresse <textarea name="address" required rows="2"></textarea></label>
   <label>Clauses du contrat <textarea name="body" rows="15" required></textarea></label>
   <p>Variables : {{client_name}}, {{rate}}, {{spouse_extra}}, {{currency}}, {{business_address}}, {{consultant_name}}, {{consultant_licence}}</p>
       <button type="button" id="load-reference-clauses" class="secondary">Insérer le contenu complet dans le modèle forfaitaire</button>
    <button type="submit">Enregistrer le modèle</button></form><hr>
   <h2>Préparer un contrat</h2><form id="new-contract"><label>Dossier actif <select name="dossier" required>${dossiers
     .map((d) => {
       const p = profiles.find((p) => p.id === d.client_id);
       return `<option value="${esc(d.id)}">${esc(d.reference)} - ${esc([p?.first_name, p?.last_name].filter(Boolean).join(" "))}</option>`;
     })
     .join(
       "",
     )}</select></label><label>Type <select name="kind"><option value="horaire">Horaire</option><option value="forfait">Forfaitaire</option></select></label>
   <button type="submit" ${dossiers.length ? "" : "disabled"}>Créer un brouillon</button></form><hr>
   <h2>Suivi des contrats</h2><div class="madic-contract-table-scroll"><table><thead><tr><th>Client</th><th>Type</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>
   ${
     contracts
       .map(
         (
           c,
         ) => `<tr><td>${esc(name(c))}</td><td>${esc(c.template_kind)}</td><td>${esc(c.status)}</td><td>${esc(fmt(c.created_at))}</td>
   <td>${button("Consulter", "view", c.id)} ${c.status === "brouillon" ? button("Modifier", "edit", c.id) + " " + button("Publier", "publish", c.id) : ""}</td></tr>`,
       )
       .join("") || '<tr><td colspan="5">Aucun contrat</td></tr>'
   }
   </tbody></table></div><div id="contract-preview"></div>`;
    setupLogoAdmin();
    const select = root.querySelector("#template-kind");
    const form = root.querySelector("#template-form");
    const fill = () => {
      const t = templates.find((x) => x.kind === select.value);
      if (!t) return;
      for (const k of ["title", "rate", "spouse_extra", "currency", "body"])
        form.elements.namedItem(k).value = t[k];
      form.elements.namedItem("address").value = t.business_address;
    };
    select.addEventListener("change", fill);
    fill();
    root
      .querySelector("#load-reference-clauses")
      .addEventListener("click", () => {
        if (select.value !== "forfait") {
          note(
            "Sélectionnez le modèle « taux forfaitaire » avant de charger les clauses.",
            true,
          );
          return;
        }
        if (
          !confirm(
            "Remplacer le texte actuellement affiché dans le champ « Clauses du contrat » par le contenu du document de référence ? Les changements ne seront enregistrés que lorsque vous cliquerez sur « Enregistrer le modèle ».",
          )
        )
          return;
        form.elements.namedItem("body").value = FORFAIT_REFERENCE_CLAUSES;
        note(
          "Clauses du document de référence chargées. Vérifiez et adaptez le texte, les montants, la devise et les renseignements avant de cliquer sur « Enregistrer le modèle ».",
        );
      });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const f = e.currentTarget;
        await call("madic_save_contract_template", {
          p_kind: select.value,
          p_title: f.elements.namedItem("title").value,
          p_body: f.elements.namedItem("body").value,
          p_rate: Number(f.elements.namedItem("rate").value),
          p_spouse_extra: Number(f.elements.namedItem("spouse_extra").value),
          p_currency: f.elements.namedItem("currency").value,
          p_address: f.elements.namedItem("address").value,
        });
        note("Modèle enregistré.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    });
    root
      .querySelector("#new-contract")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const f = e.currentTarget;
          await call("madic_create_contract", {
            p_dossier_id: f.elements.namedItem("dossier").value,
            p_kind: f.elements.namedItem("kind").value,
          });
          note("Brouillon créé. Vérifiez son contenu avant publication.");
          await load();
        } catch (err) {
          note(err.message, true);
        }
      });
  }
     function renderClient() {
     const dossierLabel=c=>{const d=dossiers.find(x=>x.id===c.dossier_id);return d?[d.reference,d.category].filter(Boolean).join(' - '):c.dossier_id?'Dossier associé (référence indisponible)':'Non renseigné';};
     // Chaque instant est conserve en base; le navigateur du client determine son fuseau IANA.
     const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
     const timestamp=x=>{if(!x)return '-';const d=new Date(x);if(Number.isNaN(d.getTime()))return '-';return new Intl.DateTimeFormat('fr-CA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone,timeZoneName:'short'}).format(d);};
     // Historique complet : la liste est deja triee par created_at descendant.
     // La version la plus recente est signalee pour chaque dossier.
     const newest=new Set();
     const initialRows=initialContracts.map(c=>{
       const key=(c.space_id||'')+':'+(c.dossier_id||c.id);
       const isLatest=!newest.has(key);
       newest.add(key);
       const signed=c.status==='signe';
       const canSign=isLatest&&!signed;
       const label=isLatest?'Version la plus récente':'Version antérieure';
       return `<tr><td>Consultation initiale - ${esc(label)}</td><td>${esc(dossierLabel(c))}</td><td>${esc(timestamp(c.created_at))}</td><td>${esc(timestamp(c.client_signed_at||c.signed_at))}</td><td>${signed?'Signé':canSign?'Signature requise':'Version remplacée'}</td><td><a class="secondary madic-initial-open" href="contrat-initial-client.html?id=${encodeURIComponent(c.id)}">${canSign?'Consulter / signer':'Voir le contrat'}</a></td></tr>`;
     });
     // Les contrats historiques restent visibles: ils proviennent d'une autre table.
     const legacyRows=contracts.map(c=>`<tr><td>${esc(c.title||'Contrat de consultation')}</td><td>${esc(dossierLabel(c))}</td><td>${esc(timestamp(c.published_at||c.created_at))}</td><td>${esc(timestamp(c.signed_at))}</td><td>${esc(c.status==='signe'?'Signé':c.status==='publie'?'Signature requise':c.status==='brouillon'?'Brouillon':'Ancien contrat')}</td><td>${button(c.status==='publie'?'Signer le contrat':'Voir le contrat','view',c.id)}</td></tr>`);
     root.innerHTML=`<h2>Mes contrats</h2><p>Dates et heures selon votre fuseau horaire (${esc(zone)}). Toutes les versions des contrats initiaux sont conservées, de la plus récente à la plus ancienne.</p><table><thead><tr><th>Contrat</th><th>Dossier</th><th>Transmission</th><th>Signature du client</th><th>État</th><th>Action</th></tr></thead><tbody>${initialRows.concat(legacyRows).join('')||'<tr><td colspan="6">Aucun contrat disponible.</td></tr>'}</tbody></table><div id="contract-preview"></div>`;
   }
function editContract(c) {
    const preview = root.querySelector("#contract-preview");
    preview.innerHTML = `<hr><h3>Modifier le brouillon - ${esc(name(c))}</h3>
   <form id="draft-edit"><label>Titre <input name="title" required></label>
   <label>Tarif <input name="rate" type="number" step="0.01" min="0" required></label>
   <label>Supplément conjoint <input name="spouse_extra" type="number" step="0.01" min="0" required></label>
   <label>Devise <select name="currency"><option>USD</option><option>CAD</option></select></label>
   <label>Adresse professionnelle <textarea name="address" rows="2" required></textarea></label>
   <label>Clauses <textarea name="body" rows="14" required></textarea></label>
   <label>Renseignements du client (JSON) <textarea name="snapshot" rows="7" required></textarea></label>
   <button type="submit">Enregistrer le brouillon</button></form>`;
    const f = preview.querySelector("#draft-edit");
    for (const [k, v] of Object.entries({
      title: c.title,
      rate: c.rate,
      spouse_extra: c.spouse_extra,
      currency: c.currency,
      body: c.body_snapshot,
      address: c.business_address,
      snapshot: JSON.stringify(c.client_snapshot, null, 2),
    }))
      f.elements.namedItem(k).value = v;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const g = (k) => f.elements.namedItem(k).value;
        await call("madic_update_contract_draft", {
          p_contract_id: c.id,
          p_title: g("title"),
          p_body: g("body"),
          p_rate: Number(g("rate")),
          p_spouse_extra: Number(g("spouse_extra")),
          p_currency: g("currency"),
          p_address: g("address"),
          p_client_snapshot: JSON.parse(g("snapshot")),
        });
        note("Brouillon modifié.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    });
  }
  function show(c) {
    const signed = c.status === "signe";
    const preview = root.querySelector("#contract-preview");
    preview.innerHTML = `<hr><section id="contract-print">${logoHeader()}<h2>${esc(c.title)}</h2>
   <p><strong>Client :</strong> ${esc(name(c))}<br><strong>Courriel :</strong> ${esc(c.client_snapshot?.email)}<br>
   <strong>Consultant :</strong> ${esc(c.consultant_name)} - ${esc(c.consultant_licence)}</p>
   <div class="madic-contract-text">${renderText(c)}</div>
   <p><strong>Version :</strong> ${esc(c.version)} · <strong>Statut :</strong> ${esc(c.status)}</p>
   ${
     signed
       ? `<p><strong>Signé par :</strong> ${esc(c.signed_name)}<br><strong>Date (UTC) :</strong> ${esc(c.signed_at)}<br>
   <strong>Empreinte SHA-256 :</strong> <code class="madic-contract-digest">${esc(c.signed_digest)}</code></p>`
       : ""
   }</section>
   <button type="button" class="secondary" id="contract-print-button">Imprimer / enregistrer en PDF</button>
   ${
     !admin && c.status === "publie"
       ? `<form id="sign-contract"><label>Votre prénom et nom exacts
   <input name="signed_name" required autocomplete="name" placeholder="${esc(name(c))}"></label>
   <label><input type="checkbox" name="accept" required> J'ai lu l'intégralité du contrat, j'en accepte les conditions et je consens expressément à le signer électroniquement.</label>
   <button type="submit">Signer électroniquement</button></form>`
       : ""
   }`;
    preview
      .querySelector("#contract-print-button")
      .addEventListener("click", () => {
        const w = window.open("", "_blank");
        if (!w) {
          note("Autorisez les fenêtres contextuelles pour imprimer.", true);
          return;
        }
        w.opener = null;
        w.document.write(
          `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Contrat MADIC</title><link rel="stylesheet" href="assets/mes-contrats.css"><body class="madic-contract-print-page">${preview.querySelector("#contract-print").innerHTML}</body></html>`,
        );
        w.document.close();
        w.focus();
        w.print();
      });
    const sign = preview.querySelector("#sign-contract");
    if (sign)
      sign.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (
          !confirm(
            "Confirmez-vous vouloir signer electroniquement ce contrat ? Cette action est definitive.",
          )
        )
          return;
        const f = e.currentTarget;
        try {
          await call("madic_sign_contract", {
            p_contract_id: c.id,
            p_full_name: f.elements.namedItem("signed_name").value,
            p_accept: f.elements.namedItem("accept").checked,
          });
          note("Contrat signé. Une trace de consentement a été enregistrée.");
          await load();
        } catch (err) {
          note(err.message, true);
        }
      });
  }
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const c = contracts.find((x) => x.id === b.dataset.id);
    if (!c) return;
    if (b.dataset.action === "view") {
      show(c);
      return;
    }
    if (b.dataset.action === "edit") {
      editContract(c);
      return;
    }
    if (b.dataset.action === "publish") {
      if (
        !confirm(
          "Avez-vous vérifié toutes les clauses, les tarifs, les coordonnées et les renseignements du client ? Publier ce contrat ?",
        )
      )
        return;
      try {
        await call("madic_publish_contract", { p_contract_id: c.id });
        note("Contrat publié dans l’espace du client.");
        await load();
      } catch (err) {
        note(err.message, true);
      }
    }
  });
  load().catch((e) => note(e.message, true));
})();


/* Module 2 */
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
    toggle.textContent = editing ? "Terminer" : "Personnaliser le menu";
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


/* Module 3 */
/* Correctif urgent : aucune observation recursive du DOM des contrats. */
(() => {
  'use strict';
  const buttons = document.querySelectorAll('.madic-contracts-language button[data-lang]');
  const labels = {
    fr: {'Mes contrats':'Mes contrats','Voir le contrat':'Voir le contrat','Consulter / signer':'Consulter / signer','Signer le contrat':'Signer le contrat'},
    en: {'Mes contrats':'My contracts','Voir le contrat':'View contract','Consulter / signer':'Review / sign','Signer le contrat':'Sign contract'}
  };
  let language = 'fr';
  try { language = localStorage.getItem('madic-client-language') === 'en' ? 'en' : 'fr'; } catch (_) {}
  const translate = () => {
    document.documentElement.lang = language === 'en' ? 'en-CA' : 'fr-CA';
    document.querySelectorAll('[data-fr][data-en]').forEach(el => {
      const value = el.getAttribute('data-' + language);
      if (el.textContent !== value) el.textContent = value;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language)));
    const root = document.getElementById('madic-contracts');
    if (!root) return;
    root.querySelectorAll('a.madic-initial-open, td:last-child button.secondary').forEach(el => {
      const current = el.textContent.trim();
      const key = Object.keys(labels.fr).find(k => labels.fr[k] === current || labels.en[k] === current);
      if (key && current !== labels[language][key]) el.textContent = labels[language][key];
    });
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    language = button.dataset.lang === 'en' ? 'en' : 'fr';
    try { localStorage.setItem('madic-client-language', language); } catch (_) {}
    translate();
  }));
  translate();
})();


/* Module 4 */

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
    
})().catch(console.error);
