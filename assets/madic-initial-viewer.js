(() => {
  "use strict";
  const db = window.getMadicSupabase?.();
  const status = document.getElementById("initial-view-status");
  const content = document.getElementById("initial-view-content");
  const msg = (text, bad = false) => {
    status.textContent = text;
    status.style.color = bad ? "#ffb5a9" : "";
  };
  const id = new URLSearchParams(location.search).get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    msg("Identifiant de contrat invalide.", true);
    return;
  }

  // Le contrat est signe en base avant toute tentative de creation PDF.
  // Une panne de generation ou de reseau n'annule jamais la signature.
  // Ouverture dans un nouvel onglet depuis le clic utilisateur (evite le blocage popup).
  async function openArchivedPdf(item) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      msg("Autorisez les fenetres surgissantes pour ouvrir le PDF.", true);
      return;
    }
    try {
      tab.document.title = "Ouverture du PDF";
      tab.document.body.textContent = "Ouverture du PDF archive...";
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
      msg("Impossible d’ouvrir le PDF archive : " + e.message, true);
    }
  }

  async function archiveSigned(item, frame, button) {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      msg(
        "Signature enregistrée, mais module PDF indisponible. Réessayez plus tard.",
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
          msg("Le PDF signé existe déjà et a été conservé sans modification.");
          button.disabled = false;
          return true;
        }
        throw uploadError;
      }
      // Le statut signe est deja enregistre; ne pas relancer la signature ni l'archivage RPC.
      button.textContent = "Ouvrir le PDF archivé";
      button.disabled = false;
      button.onclick = () => openArchivedPdf(item);
      msg("PDF signé archivé avec succès.");
      return true;
    } catch (e) {
      msg(
        "Signature enregistrée, mais archivage PDF incomplet : " +
          e.message +
          ". Vous pouvez réessayer.",
        true,
      );
      button.disabled = false;
      return false;
    }
  }

  async function load(archiveAfterSign = false) {
    if (!db) throw Error("Configuration Supabase indisponible.");
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
      msg("Ce contrat est introuvable ou ne vous est pas accessible.", true);
      return;
    }
    if (!item.document_snapshot?.html) {
      msg("Le document du contrat est indisponible.", true);
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
        ? "Contrat signé."
        : "Veuillez lire les deux pages avant de signer.",
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
        msg("Deuxieme page du contrat introuvable.", true);
        return;
      }
      const boxes = [...second.querySelectorAll(".contract-sign-box")];
      if (boxes.length < 2) {
        msg("Zones de signature client introuvables.", true);
        return;
      }
      const initials =
        second.querySelector(".contract-initials .contract-sign-box") ||
        boxes[0];
      const clientSignature = boxes[boxes.length - 1];
      initials.textContent = item.client_initials || "";
      clientSignature.textContent = item.client_signed_name || "";
      for (const node of [initials, clientSignature]) {
        node.style.cssText =
          "display:inline-flex;align-items:center;padding:4px 7px;color:#254d72;font:600 12px Arial,sans-serif;overflow-wrap:anywhere;height:auto;min-height:30px;";
      }
      clientSignature.setAttribute("data-madic-client-signature", "yes");
      const stamp = parsed.createElement("p");
      stamp.textContent =
        "Signature électronique du client : " +
        (item.client_signed_name || "") +
        " | " +
        (item.client_signature_city || "") +
        " | " +
        (item.client_signed_at
          ? new Date(item.client_signed_at).toLocaleString("fr-CA")
          : "");
      stamp.style.cssText =
        "font:11px/1.4 Arial,sans-serif;color:#254d72;overflow-wrap:anywhere;margin:6px 0;";
      const row = clientSignature.closest(".contract-form-row");
      if (row) row.insertAdjacentElement("afterend", stamp);
      else clientSignature.insertAdjacentElement("afterend", stamp);
    }
    const frame = document.createElement("iframe");
    frame.title = "Contrat initial de deux pages";
    frame.className = "initial-document-frame";
    frame.setAttribute("sandbox", "allow-same-origin");
    const base = new URL(".", location.href).href;
    frame.srcdoc =
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="' +
      base +
      '"><link rel="stylesheet" href="assets/contrats-cric.css"><link rel="stylesheet" href="assets/contracts-layout.css"><style>.madic-contract-logo-header img,.doc-head img{max-width:42%!important;max-height:68px!important;width:auto!important;height:auto!important;object-fit:contain!important}body{background:white;margin:0;padding:12px}main{max-width:none;margin:0;padding:0}.document{margin:0 auto!important;box-shadow:none!important}.madic-contract-page-two{break-before:page}@media print{body{padding:0}}</style></head><body data-contract-kind="initial">' +
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
    print.textContent = "Imprimer / enregistrer en PDF";
    print.className = "action";
    print.addEventListener("click", () => {
      try {
        // L'iframe sandboxee ne peut pas lancer l'impression : document distinct.
        const win = window.open("about:blank", "_blank");
        if (!win) {
          msg("Autorisez les fenetres surgissantes pour imprimer.", true);
          return;
        }
        const printable = (
          "<!doctype html>" + frame.contentDocument.documentElement.outerHTML
        ).replace(
          "</head>",
          "<style>@page{size:letter;margin:10mm}body{padding:0!important}.madic-contract-page{break-after:page;page-break-after:always}.madic-contract-page:last-child{break-after:auto;page-break-after:auto}</style></head>",
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
        msg("Impression indisponible : " + e.message, true);
      }
    });
    content.append(print);
    if (item.status === "signe") {
      const p = document.createElement("p");
      p.textContent =
        "Contrat signé le " +
        (item.client_signed_at
          ? new Date(item.client_signed_at).toLocaleString("fr-CA")
          : "date non disponible");
      content.append(p);
      const archive = document.createElement("button");
      archive.type = "button";
      archive.className = "action";
      archive.textContent = "Archiver le PDF signé";
      content.append(archive);
      const open = document.createElement("button");
      open.type = "button";
      open.className = "action";
      open.textContent = "Ouvrir le PDF archivé";
      open.onclick = () => openArchivedPdf(item);
      open.hidden = true;
      content.append(open);
      const setArchived = (exists) => {
        archive.hidden = exists;
        open.hidden = !exists;
        if (!exists) archive.textContent = "Créer le PDF signé archivé";
      };
      archive.onclick = async () => {
        if (
          !confirm(
            "Créer le PDF signé à partir des données de signature enregistrées, sans remplacer une archive existante ?",
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
        msg("Contrat signé. PDF archivé disponible.");
      } else if (
        archiveError &&
        !/object not found|not found|404/i.test(archiveError.message || "")
      ) {
        setArchived(false);
        msg(
          "Contrat signé. Vérification de l’archive impossible : " +
            archiveError.message,
          true,
        );
      } else {
        setArchived(false);
        msg(
          "Contrat signé. Aucun PDF archivé trouvé : vous pouvez créer la copie sans signer à nouveau.",
          true,
        );
        if (archiveAfterSign) {
          msg("Signature enregistrée. Création automatique du PDF archivé…");
          if (await archiveSigned(item, frame, archive)) setArchived(true);
        }
      }
      return;
    }
    if (!isLatest || latestCheckError) {
      msg(
        latestCheckError
          ? "Contrat consultable uniquement : vérification de la version indisponible."
          : "Version antérieure : consultation uniquement. La signature est réservée à la version la plus récente.",
        Boolean(latestCheckError),
      );
      return;
    }
    const form = document.createElement("form");
    form.className = "initial-sign-form";
    form.innerHTML =
      '<h2>Acceptation et signature</h2><label>Initiales <input name="initials" required maxlength="12" autocomplete="off"></label><label>Nom complet <input name="full_name" required autocomplete="name"></label><label>Ville de signature <input name="city" required></label><label class="accept"><input type="checkbox" name="accept" required> J’ai lu les deux pages et j’accepte les conditions de ce contrat. Je consens à le signer électroniquement.</label><button type="submit" class="action">Signer ce contrat</button>';
    content.append(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (
        !form.reportValidity() ||
        !confirm("Confirmer la signature électronique de ce contrat ?")
      )
        return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (!(await checkLatestVersion()))
          throw Error("Cette version a été remplacée : signature interdite.");
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
        msg("Signature impossible : " + err.message, true);
        btn.disabled = false;
        return;
      }
      // Après confirmation de la signature, ne jamais afficher « signature impossible » pour un échec PDF.
      msg("Signature enregistrée. Préparation de la copie PDF…");
      try {
        await load(true);
      } catch (err) {
        msg(
          "Signature enregistrée, mais préparation du PDF indisponible : " +
            err.message,
          true,
        );
      }
    });
  }
  load().catch((e) => msg("Chargement impossible : " + e.message, true));
})();
