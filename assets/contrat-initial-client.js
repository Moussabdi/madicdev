/* MADIC - Contrat initial client : logique autonome de la page. */
const MADIC_TRANSLATIONS = {
  "Identifiant de contrat invalide.": "Invalid agreement ID.",
  "Autorisez les fenetres surgissantes pour ouvrir le PDF.": "Allow pop-ups to open the PDF.",
  "Ouverture du PDF": "Opening PDF",
  "Ouverture du PDF archive...": "Opening archived PDF...",
  "Impossible d’ouvrir le PDF archive : ": "Unable to open archived PDF: ",
  "Signature enregistrée, mais module PDF indisponible. Réessayez plus tard.": "Signature saved, but the PDF module is unavailable. Try again later.",
  "Le PDF signé existe déjà et a été conservé sans modification.": "The signed PDF already exists and was preserved unchanged.",
  "Ouvrir le PDF archivé": "Open archived PDF",
  "PDF signé archivé avec succès.": "Signed PDF archived successfully.",
  "Signature enregistrée, mais archivage PDF incomplet : ": "Signature saved, but PDF archiving is incomplete: ",
  ". Vous pouvez réessayer.": ". You can try again.",
  "Configuration Supabase indisponible.": "Supabase configuration unavailable.",
  "Ce contrat est introuvable ou ne vous est pas accessible.": "This agreement cannot be found or accessed.",
  "Le document du contrat est indisponible.": "The agreement document is unavailable.",
  "Contrat signé.": "Agreement signed.",
  "Veuillez lire les deux pages avant de signer.": "Please read both pages before signing.",
  "Deuxieme page du contrat introuvable.": "The second page of the agreement was not found.",
  "Zones de signature client introuvables.": "Client signature fields were not found.",
  "Signature électronique du client : ": "Client electronic signature: ",
  "Contrat initial de deux pages": "Two-page initial agreement",
  "Imprimer / enregistrer en PDF": "Print / save as PDF",
  "Autorisez les fenetres surgissantes pour imprimer.": "Allow pop-ups to print.",
  "Impression indisponible : ": "Printing unavailable: ",
  "Contrat signé le ": "Agreement signed on ",
  "date non disponible": "date unavailable",
  "Archiver le PDF signé": "Archive signed PDF",
  "Créer le PDF signé archivé": "Create archived signed PDF",
  "Créer le PDF signé à partir des données de signature enregistrées, sans remplacer une archive existante ?": "Create the signed PDF using the recorded signature without replacing an existing archive?",
  "Contrat signé. PDF archivé disponible.": "Agreement signed. Archived PDF available.",
  "Contrat signé. Vérification de l’archive impossible : ": "Agreement signed. Unable to check archive: ",
  "Contrat signé. Aucun PDF archivé trouvé : vous pouvez créer la copie sans signer à nouveau.": "Agreement signed. No archived PDF found: you can create a copy without signing again.",
  "Signature enregistrée. Création automatique du PDF archivé…": "Signature saved. Automatically creating archived PDF…",
  "Contrat consultable uniquement : vérification de la version indisponible.": "View only: version verification unavailable.",
  "Version antérieure : consultation uniquement. La signature est réservée à la version la plus récente.": "Previous version: view only. Only the latest version can be signed.",
  "Confirmer la signature électronique de ce contrat ?": "Confirm electronic signing of this agreement?",
  "Cette version a été remplacée : signature interdite.": "This version has been replaced: signing is not permitted.",
  "Signature impossible : ": "Unable to sign: ",
  "Signature enregistrée. Préparation de la copie PDF…": "Signature saved. Preparing PDF copy…",
  "Signature enregistrée, mais préparation du PDF indisponible : ": "Signature saved, but PDF preparation is unavailable: ",
  "Chargement impossible : ": "Unable to load: ",
  "Acceptation et signature": "Acceptance and signature",
  "Initiales": "Initials",
  "Nom complet": "Full name",
  "Ville de signature": "City of signing",
  "J’ai lu les deux pages et j’accepte les conditions de ce contrat. Je consens à le signer électroniquement.": "I have read both pages and accept the terms of this agreement. I consent to signing it electronically.",
  "Signer ce contrat": "Sign this agreement"
};
let madicLang = (() => { try { return localStorage.getItem("madic_ui_language") === "en" ? "en" : "fr"; } catch (_) { return "fr"; } })();
function tr(text) { return madicLang === "en" ? (MADIC_TRANSLATIONS[text] || text) : text; }
function translateForm(form) {
  if (madicLang !== "en") return;
  const replacements = [
    ["Acceptation et signature", "Acceptance and signature"], ["Initiales", "Initials"],
    ["Nom complet", "Full name"], ["Ville de signature", "City of signing"],
    ["J’ai lu les deux pages et j’accepte les conditions de ce contrat. Je consens à le signer électroniquement.", "I have read both pages and accept the terms of this agreement. I consent to signing it electronically."],
    ["Signer ce contrat", "Sign this agreement"]
  ];
  const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const n = walker.currentNode; for (const [fr,en] of replacements) if (n.nodeValue.includes(fr)) n.nodeValue = n.nodeValue.replace(fr,en); }
}
function setMadicLang(lang) {
  madicLang = lang === "en" ? "en" : "fr";
  try { localStorage.setItem("madic_ui_language",madicLang); } catch (_) {}
  document.documentElement.lang = madicLang === "en" ? "en-CA" : "fr-CA";
  document.querySelectorAll("[data-fr][data-en]").forEach(el => { el.textContent = el.dataset[madicLang]; });
  document.querySelectorAll("[data-aria-label-fr][data-aria-label-en]").forEach(el => el.setAttribute("aria-label",el.dataset["ariaLabel" + (madicLang === "en" ? "En" : "Fr")]));
  document.querySelectorAll("[data-title-fr][data-title-en]").forEach(el => el.title = el.dataset["title" + (madicLang === "en" ? "En" : "Fr")]);
  document.querySelectorAll("#madicHeroLanguage button").forEach(el => el.setAttribute("aria-pressed",String(el.dataset.lang === madicLang)));
  document.title = madicLang === "en" ? "Initial consultation agreement | MADIC Professional workspace" : "Contrat de consultation initiale | MADIC Espace professionnel";
  const status = document.getElementById("initial-view-status");
  if (status && status.dataset.messageFr) status.textContent = tr(status.dataset.messageFr);
  const form = document.querySelector(".initial-sign-form");
  if (form) { const walker=document.createTreeWalker(form,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.__madicFr)n.__madicFr=n.nodeValue;let value=n.__madicFr; if(madicLang === "en")for(const [fr,en] of Object.entries(MADIC_TRANSLATIONS))value=value.replaceAll(fr,en);n.nodeValue=value;} }
  document.querySelectorAll("[data-madic-text-fr]").forEach(el=>{el.textContent=madicLang === "en" ? (MADIC_TRANSLATIONS[el.dataset.madicTextFr]||el.dataset.madicTextFr) : el.dataset.madicTextFr;});
}
function loadMadicVendor(src,ready) {
  return new Promise((resolve,reject)=>{ if (ready()) return resolve(); const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(Error("Module externe indisponible"));document.head.appendChild(s); });
}
async function initMadicPage() {
  document.querySelectorAll("#madicHeroLanguage button").forEach(b=>b.addEventListener("click",()=>setMadicLang(b.dataset.lang)));
  setMadicLang(madicLang);
  const signout=document.getElementById("madicHeaderSignout");
  if (signout) signout.addEventListener("click",async e=>{e.preventDefault();try{await window.getMadicSupabase?.().auth.signOut();}finally{location.href=signout.href;}});
  await loadMadicVendor("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",()=>Boolean(window.supabase?.createClient));
  await Promise.all([
    loadMadicVendor("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",()=>Boolean(window.html2canvas)),
    loadMadicVendor("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",()=>Boolean(window.jspdf?.jsPDF))
  ]);
  runMadicViewer();
}

function runMadicViewer(){
(() => {
  "use strict";
  const db = window.getMadicSupabase?.();
  const status = document.getElementById("initial-view-status");
  const content = document.getElementById("initial-view-content");
  const msg = (text, bad = false) => {
    status.dataset.messageFr = text;
    status.textContent = tr(text);
    status.style.color = bad ? "#ffb5a9" : "";
  };
  const id = new URLSearchParams(location.search).get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    msg(tr("Identifiant de contrat invalide."), true);
    return;
  }

  // Le contrat est signe en base avant toute tentative de creation PDF.
  // Une panne de generation ou de reseau n'annule jamais la signature.
  // Ouverture dans un nouvel onglet depuis le clic utilisateur (evite le blocage popup).
  async function openArchivedPdf(item) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      msg(tr("Autorisez les fenetres surgissantes pour ouvrir le PDF."), true);
      return;
    }
    try {
      tab.document.title = tr("Ouverture du PDF");
      tab.document.body.textContent = tr("Ouverture du PDF archive...");
      const {
        data: { user },
        error: ue,
      } = await db.auth.getUser();
      if (ue || !user) throw Error("Session expiree");
      const path = "contrats-signes/" + user.id + "/" + item.id + ".pdf";
      const { data, error } = await db.storage
        .from("madic-documents")
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) throw error || Error("PDF introuvable");
      tab.location.replace(data.signedUrl);
    } catch (e) {
      tab.close();
      msg(tr("Impossible d’ouvrir le PDF archive : ") + e.message, true);
    }
  }

  async function archiveSigned(item, frame, button) {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      msg(
        tr("Signature enregistrée, mais module PDF indisponible. Réessayez plus tard."),
        true,
      );
      return false;
    }
    button.disabled = true;
    try {
      if (!frame.contentDocument?.querySelector(".madic-contract-page-two")) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error("Document non charge")),
            15000,
          );
          frame.addEventListener(
            "load",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
      }
      const doc = frame.contentDocument;
      const pages = [...doc.querySelectorAll(".madic-contract-page")];
      if (pages.length !== 2)
        throw Error("Le contrat doit comporter exactement deux pages");
      // Les signatures sont deja affichees dans le document avant l'archivage.
      if (!doc.querySelector('[data-madic-client-signature="yes"]'))
        throw Error("Signature client absente du document affiche");
      await Promise.all(
        [...doc.images].map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
      const pdf = new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
        compress: true,
      });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], {
          scale: 1.6,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });
        if (i) pdf.addPage("letter", "portrait");
        const w = pdf.internal.pageSize.getWidth(),
          h = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(
          (w - 16) / canvas.width,
          (h - 16) / canvas.height,
        );
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          (w - canvas.width * ratio) / 2,
          8,
          canvas.width * ratio,
          canvas.height * ratio,
        );
      }
      const blob = pdf.output("blob");
      if (blob.size < 1000) throw Error("PDF incomplet");
      const {
        data: { user },
        error: ue,
      } = await db.auth.getUser();
      if (ue || !user) throw Error("Session expiree");
      const path = "contrats-signes/" + user.id + "/" + item.id + ".pdf";
      const { error: uploadError } = await db.storage
        .from("madic-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        if (
          /already exists|already exist|duplicate|409/i.test(
            uploadError.message || "",
          )
        ) {
          msg(tr("Le PDF signé existe déjà et a été conservé sans modification."));
          button.disabled = false;
          return true;
        }
        throw uploadError;
      }
      // Le statut signe est deja enregistre; ne pas relancer la signature ni l'archivage RPC.
      button.textContent = tr("Ouvrir le PDF archivé");
      button.disabled = false;
      button.onclick = () => openArchivedPdf(item);
      msg(tr("PDF signé archivé avec succès."));
      return true;
    } catch (e) {
      msg(
        tr("Signature enregistrée, mais archivage PDF incomplet : ") +
          e.message +
          tr(". Vous pouvez réessayer."),
        true,
      );
      button.disabled = false;
      return false;
    }
  }

  async function load(archiveAfterSign = false) {
    if (!db) throw Error(tr("Configuration Supabase indisponible."));
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      location.href = "connexion.html";
      return;
    }
    const { data: item, error } = await db
      .from("madic_initial_contracts")
      .select(
        "id,space_id,dossier_id,status,created_at,document_snapshot,client_signed_at,client_signed_name,client_initials,client_signature_city",
      )
      .eq("id", id)
      .eq("client_id", user.id)
      .in("status", ["publie", "signe"])
      .maybeSingle();
    if (error) throw error;
    if (!item) {
      msg(tr("Ce contrat est introuvable ou ne vous est pas accessible."), true);
      return;
    }
    if (!item.document_snapshot?.html) {
      msg(tr("Le document du contrat est indisponible."), true);
      return;
    }
    // Un contrat remplace reste consultable, mais n'est jamais signable.
    // Echouer en mode ferme si la verification de la derniere version est indisponible.
    async function checkLatestVersion() {
      if (!item.dossier_id || !item.space_id)
        throw Error(
          "Dossier ou espace du contrat indisponible : signature suspendue.",
        );
      const { data: latest, error: latestError } = await db
        .from("madic_initial_contracts")
        .select("id")
        .eq("space_id", item.space_id)
        .eq("client_id", user.id)
        .eq("dossier_id", item.dossier_id)
        .in("status", ["publie", "signe"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);
      if (latestError) throw latestError;
      if (!latest?.length)
        throw Error("Impossible de déterminer la dernière version du contrat.");
      return latest[0].id === item.id;
    }
    let isLatest = false,
      latestCheckError = null;
    try {
      isLatest = await checkLatestVersion();
    } catch (e) {
      latestCheckError = e;
    }

    msg(
      item.status === "signe"
        ? tr("Contrat signé.")
        : tr("Veuillez lire les deux pages avant de signer."),
    );
    const parsed = new DOMParser().parseFromString(
      item.document_snapshot.html,
      "text/html",
    );
    parsed
      .querySelectorAll(
        "script,iframe,object,embed,form,button,input,textarea,select,link,style,base,svg,math",
      )
      .forEach((el) => el.remove());
    parsed.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        const name = a.name.toLowerCase(),
          value = a.value.trim();
        if (
          name.startsWith("on") ||
          ["srcdoc", "formaction", "style"].includes(name) ||
          (["href", "src", "xlink:href"].includes(name) &&
            !/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,|\/|\.\/)/i.test(
              value,
            ))
        )
          el.removeAttribute(a.name);
      }
    });
    // Integrer les donnees signees au DOM avant l'affichage et avant toute impression/PDF.
    if (item.status === "signe") {
      const second = parsed.querySelector(".madic-contract-page-two");
      if (!second) {
        msg(tr("Deuxieme page du contrat introuvable."), true);
        return;
      }
      const boxes = [...second.querySelectorAll(".contract-sign-box")];
      if (boxes.length < 2) {
        msg(tr("Zones de signature client introuvables."), true);
        return;
      }
      const initials =
        second.querySelector(".contract-initials .contract-sign-box") ||
        boxes[0];
      const clientSignature = boxes[boxes.length - 1];
      initials.textContent = item.client_initials || "";
      clientSignature.textContent = item.client_signed_name || "";
      for (const node of [initials, clientSignature]) {
        node.classList.add("initial-signature-value");
      }
      clientSignature.setAttribute("data-madic-client-signature", "yes");
      const stamp = parsed.createElement("p");
      stamp.textContent =
        tr("Signature électronique du client : ") +
        (item.client_signed_name || "") +
        " | " +
        (item.client_signature_city || "") +
        " | " +
        (item.client_signed_at
          ? new Date(item.client_signed_at).toLocaleString("fr-CA")
          : "");
      stamp.classList.add("initial-signature-stamp");
      const row = clientSignature.closest(".contract-form-row");
      if (row) row.insertAdjacentElement("afterend", stamp);
      else clientSignature.insertAdjacentElement("afterend", stamp);
    }
    const frame = document.createElement("iframe");
    frame.title = tr("Contrat initial de deux pages");
    frame.className = "initial-document-frame";
    frame.setAttribute("sandbox", "allow-same-origin");
    const base = new URL(".", location.href).href;
    frame.srcdoc =
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="' +
      base +
      '"><link rel="stylesheet" href="assets/contrat-initial-client.css"></head><body data-contract-kind="initial">' +
      parsed.body.innerHTML +
      "</body></html>";
    content.replaceChildren(frame);
    frame.addEventListener("load", () => {
      try {
        frame.style.height =
          Math.max(
            1700,
            frame.contentDocument.documentElement.scrollHeight + 40,
          ) + "px";
      } catch (_) {}
    });
    const print = document.createElement("button");
    print.type = "button";
    print.textContent = tr("Imprimer / enregistrer en PDF");
    print.className = "action";
    print.addEventListener("click", () => {
      try {
        // L'iframe sandboxee ne peut pas lancer l'impression : document distinct.
        const win = window.open("about:blank", "_blank");
        if (!win) {
          msg(tr("Autorisez les fenetres surgissantes pour imprimer."), true);
          return;
        }
        const printable = (
          "<!doctype html>" + frame.contentDocument.documentElement.outerHTML
        ).replace(
          "</head>",
          "</head>",
        );
        win.document.open();
        win.document.write(printable);
        win.document.close();
        win.addEventListener(
          "load",
          () => {
            setTimeout(() => {
              win.focus();
              win.print();
            }, 350);
          },
          { once: true },
        );
      } catch (e) {
        msg(tr("Impression indisponible : ") + e.message, true);
      }
    });
    content.append(print);
    if (item.status === "signe") {
      const p = document.createElement("p");
      p.textContent =
        tr("Contrat signé le ") +
        (item.client_signed_at
          ? new Date(item.client_signed_at).toLocaleString("fr-CA")
          : tr("date non disponible"));
      content.append(p);
      const archive = document.createElement("button");
      archive.type = "button";
      archive.className = "action";
      archive.textContent = tr("Archiver le PDF signé");
      content.append(archive);
      const open = document.createElement("button");
      open.type = "button";
      open.className = "action";
      open.textContent = tr("Ouvrir le PDF archivé");
      open.onclick = () => openArchivedPdf(item);
      open.hidden = true;
      content.append(open);
      const setArchived = (exists) => {
        archive.hidden = exists;
        open.hidden = !exists;
        if (!exists) archive.textContent = tr("Créer le PDF signé archivé");
      };
      archive.onclick = async () => {
        if (
          !confirm(
            tr("Créer le PDF signé à partir des données de signature enregistrées, sans remplacer une archive existante ?"),
          )
        )
          return;
        if (await archiveSigned(item, frame, archive)) setArchived(true);
      };
      // Vérifier l'existence réelle de l'archive avant de proposer son ouverture.
      const path = "contrats-signes/" + user.id + "/" + item.id + ".pdf";
      const { data: existing, error: archiveError } = await db.storage
        .from("madic-documents")
        .createSignedUrl(path, 120);
      if (!archiveError && existing?.signedUrl) {
        setArchived(true);
        msg(tr("Contrat signé. PDF archivé disponible."));
      } else if (
        archiveError &&
        !/object not found|not found|404/i.test(archiveError.message || "")
      ) {
        setArchived(false);
        msg(
          tr("Contrat signé. Vérification de l’archive impossible : ") +
            archiveError.message,
          true,
        );
      } else {
        setArchived(false);
        msg(
          tr("Contrat signé. Aucun PDF archivé trouvé : vous pouvez créer la copie sans signer à nouveau."),
          true,
        );
        if (archiveAfterSign) {
          msg(tr("Signature enregistrée. Création automatique du PDF archivé…"));
          if (await archiveSigned(item, frame, archive)) setArchived(true);
        }
      }
      return;
    }
    if (!isLatest || latestCheckError) {
      msg(
        latestCheckError
          ? tr("Contrat consultable uniquement : vérification de la version indisponible.")
          : tr("Version antérieure : consultation uniquement. La signature est réservée à la version la plus récente."),
        Boolean(latestCheckError),
      );
      return;
    }
    const form = document.createElement("form");
    form.className = "initial-sign-form";
    form.innerHTML =
      '<h2>Acceptation et signature</h2><label>Initiales <input name="initials" required maxlength="12" autocomplete="off"></label><label>Nom complet <input name="full_name" required autocomplete="name"></label><label>Ville de signature <input name="city" required></label><label class="accept"><input type="checkbox" name="accept" required> J’ai lu les deux pages et j’accepte les conditions de ce contrat. Je consens à le signer électroniquement.</label><button type="submit" class="action">Signer ce contrat</button>';
    content.append(form);
    translateForm(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (
        !form.reportValidity() ||
        !confirm(tr("Confirmer la signature électronique de ce contrat ?"))
      )
        return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (!(await checkLatestVersion()))
          throw Error(tr("Cette version a été remplacée : signature interdite."));
        const f = form.elements;
        const { error: signError } = await db.rpc(
          "madic_sign_initial_contract",
          {
            p_contract_id: item.id,
            p_full_name: f.full_name.value.trim(),
            p_initials: f.initials.value.trim(),
            p_city: f.city.value.trim(),
            p_accept: f.accept.checked,
          },
        );
        if (signError) throw signError;
      } catch (err) {
        msg(tr("Signature impossible : ") + err.message, true);
        btn.disabled = false;
        return;
      }
      // Après confirmation de la signature, ne jamais afficher « signature impossible » pour un échec PDF.
      msg(tr("Signature enregistrée. Préparation de la copie PDF…"));
      try {
        await load(true);
      } catch (err) {
        msg(
          tr("Signature enregistrée, mais préparation du PDF indisponible : ") +
            err.message,
          true,
        );
      }
    });
  }
  load().catch((e) => msg(tr("Chargement impossible : ") + e.message, true));
})();

}
initMadicPage().catch(e=>{const s=document.getElementById("initial-view-status");if(s)s.textContent=(madicLang==="en"?"Unable to load: ":"Chargement impossible : ")+e.message;});
