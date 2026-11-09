(() => {
  "use strict";
  const cfg = window.MADIC_CONFIG;
  const msg = document.getElementById("cricMessage");
  // Fenetre modale legere, accessible et refermable, sans changement HTML.
  let popup = null;
  let popupText = null;
  let popupTitle = null;
  let previousFocus = null;
  const closePopup = () => {
    if (!popup || popup.hidden) return;
    popup.hidden = true;
    document.body.style.overflow = popup.dataset.previousOverflow || "";
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
  const ensurePopup = () => {
    if (popup) return;
    const style = document.createElement("style");
    style.textContent = `
      .madic-cric-overlay[hidden]{display:none!important}
      .madic-cric-overlay{position:fixed;inset:0;z-index:99999;background:rgba(12,24,42,.55);display:flex;align-items:center;justify-content:center;padding:18px}
      .madic-cric-dialog{box-sizing:border-box;position:relative;background:#fff;color:#1b283b;width:min(100%,440px);max-height:85vh;overflow:auto;border-radius:14px;padding:27px 26px 22px;box-shadow:0 18px 65px rgba(0,0,0,.25);font:inherit}
      .madic-cric-dialog h2{font-size:1.2rem;margin:0 35px 12px 0;color:#142c49}
      .madic-cric-dialog p{margin:0 0 20px;line-height:1.55;white-space:pre-line}
      .madic-cric-x{position:absolute;right:13px;top:10px;background:transparent!important;border:0!important;box-shadow:none!important;color:#445!important;font-size:26px!important;padding:4px 10px!important;cursor:pointer}
      .madic-cric-ok{display:block;margin-left:auto;cursor:pointer;border-radius:8px;padding:10px 19px}
      .madic-cric-guide{margin:8px 0 16px;cursor:pointer;background:transparent;border:1px solid currentColor;border-radius:8px;padding:8px 12px;font:inherit}
    `;
    document.head.appendChild(style);
    popup = document.createElement("div");
    popup.className = "madic-cric-overlay";
    popup.hidden = true;
    popup.innerHTML = `<section class="madic-cric-dialog" role="dialog" aria-modal="true" aria-labelledby="madicCricDialogTitle" aria-describedby="madicCricDialogText"><button type="button" class="madic-cric-x" aria-label="Fermer la fenêtre">×</button><h2 id="madicCricDialogTitle"></h2><p id="madicCricDialogText"></p><button type="button" class="madic-cric-ok">Fermer</button></section>`;
    document.body.appendChild(popup);
    popupTitle = popup.querySelector("h2");
    popupText = popup.querySelector("p");
    popup.querySelectorAll("button").forEach(b => b.addEventListener("click", closePopup));
    popup.addEventListener("click", e => { if (e.target === popup) closePopup(); });
    document.addEventListener("keydown", e => {
      if (popup.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closePopup(); }
      if (e.key === "Tab") {
        const buttons = [...popup.querySelectorAll("button")];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  };
  const openPopup = (message, title = "Information MADIC") => {
    ensurePopup();
    previousFocus = document.activeElement;
    popupTitle.textContent = title;
    popupText.textContent = message;
    popup.dataset.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    popup.hidden = false;
    popup.querySelector(".madic-cric-x").focus();
  };
  const show = (s) => {
    if (msg) msg.textContent = s;
    if (document.body.dataset.page === "cric-signup" && s && !s.startsWith("Demande déjà enregistrée") && !s.startsWith("Permis CRIC confirmé automatiquement")) {
      openPopup(s, /^Erreur|non confirm|refus|invalide/i.test(s) ? "Résultat de la vérification CRIC" : "Information sur votre demande CRIC");
    }
  };
  if (!cfg?.url || !cfg?.anonKey || !window.supabase) { show("Configuration Supabase manquante."); return; }
  const db = window.getMadicSupabase();
  const page = document.body.dataset.page;
  if (page === "cric-signup") {
    const guideButton = document.createElement("button");
    guideButton.type = "button";
    guideButton.className = "madic-cric-guide";
    guideButton.textContent = "ⓘ Guide de vérification CRIC";
    guideButton.addEventListener("click", () => openPopup(
      "1. Saisissez votre nom complet et votre numéro de permis CRIC.\n" +
      "2. Cliquez sur « Vérifier mon permis CRIC ». MADIC consulte le registre officiel du CCIC.\n" +
      "3. Si le permis est confirmé, la prévalidation est transmise à MADIC sans création de compte.\n" +
      "4. MADIC examine votre identité dans la page administrative de validation.\n\n" +
      "Si le permis n’est pas confirmé, vérifiez les informations saisies. Vous pouvez fermer cette fenêtre à tout moment.",
      "Guide d'inscription CRIC"
    ));
    const heading = document.querySelector("main h1");
    if (heading) heading.insertAdjacentElement("afterend", guideButton);
    const nameInput = document.getElementById("cricName");
    const licenseInput = document.getElementById("cricLicense");
    const verifyButton = document.getElementById("cricVerify");
    const checkButton = document.getElementById("cricCheckStatus");
    const key = "madic_cric_prevalidation_v1";
    const invoke = async (body) => {
      const { data, error } = await db.functions.invoke("madic-verify-cric-license", { body });
      if (error) {
        let message = "La vérification du permis a échoué.";
        try { const payload = await error.context?.clone()?.json(); if (payload?.error) message = payload.error; } catch (_) {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    };
    const getSaved = () => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
    const saved = getSaved();
    if (saved?.token && saved.name && saved.license) {
      nameInput.value = saved.name;
      licenseInput.value = saved.license;
      checkButton.hidden = false;
    }
    const invalidate = () => { localStorage.removeItem(key); checkButton.hidden = true; };
    nameInput.addEventListener("input", invalidate);
    licenseInput.addEventListener("input", invalidate);
    verifyButton.addEventListener("click", async () => {
      const name = nameInput.value.trim().replace(/\s+/g, " ");
      const license = licenseInput.value.trim().toUpperCase();
      if (name.length < 3 || !/^R\d{6,}$/.test(license)) { show("Saisissez un nom complet et un numéro CRIC valide."); return; }
      verifyButton.disabled = true;
      try {
        const data = await invoke({ action: "request", full_name: name, license_number: license });
        if (data.verified !== true || data.registry_verified !== true || data.status !== "pending" || !data.token || data.registry?.registry_license !== license) throw Error("La vérification officielle n’a pas été confirmée.");
        localStorage.setItem(key, JSON.stringify({ name, license, token: data.token }));
        checkButton.hidden = false;
        show("Permis vérifié dans le registre officiel CCIC. La demande est enregistrée pour examen administratif MADIC. Aucun compte n’a été créé.");
      } catch (e) { show("Erreur : " + e.message); }
      finally { verifyButton.disabled = false; }
    });
    checkButton.addEventListener("click", async () => {
      const saved = getSaved();
      if (!saved?.token || saved.name !== nameInput.value.trim().replace(/\s+/g, " ") || saved.license !== licenseInput.value.trim().toUpperCase()) { show("Effectuez une nouvelle vérification."); return; }
      checkButton.disabled = true;
      try {
        const data = await invoke({ action: "status", token: saved.token });
        if (data.full_name !== saved.name || data.license_number !== saved.license) throw Error("Référence incohérente.");
        const labels = { pending: "en attente de validation administrative", approved: "validée par MADIC (sans compte créé)", rejected: "refusée", expired: "expirée" };
        show("Demande CRIC : " + (labels[data.status] || data.status) + ". Aucun compte n’est créé sur cette page.");
      } catch (e) { show("Erreur : " + e.message); }
      finally { checkButton.disabled = false; }
    });
    document.getElementById("cricSignup").addEventListener("submit", e => e.preventDefault());
  }
  if (page === "cric-approval") {
    (async () => {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) {
        location.replace("connexion.html");
        return;
      }
      const { data: isOwner, error: oe } = await db.rpc("madic_is_super_admin");
      if (oe || isOwner !== true) {
        show("Accès réservé au super administrateur MADIC.");
        return;
      }
      const approvalMain = document.getElementById("cricApprovalMain");
      if (approvalMain) approvalMain.hidden = false;
      async function refresh() {
        const { data, error } = await db
          .from("madic_cric_applications")
          .select(
            "user_id,full_name,license_number,professional_email,status,created_at",
          )
          .order("created_at", { ascending: false });
        if (error) {
          show(error.message);
          return;
        }
        const body = document.getElementById("cricApplications");
        body.replaceChildren();
        if (!data.length) {
          const tr = body.insertRow();
          tr.insertCell().colSpan = 5;
          tr.cells[0].textContent = "Aucune demande visible.";
          return;
        }
        for (const item of data) {
          const tr = body.insertRow();
          [
            item.full_name,
            item.license_number,
            item.professional_email,
            item.status,
          ].forEach((x) => (tr.insertCell().textContent = x));
          const cell = tr.insertCell();
          if (item.status !== "pending") {
            cell.textContent = "Traitée";
            continue;
          }
          for (const [label, approve] of [
            ["Approuver", true],
            ["Refuser", false],
          ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = "secondary";
            button.addEventListener("click", async () => {
              if (
                !confirm(
                  `${label} la demande de ${item.full_name} (${item.license_number}) ?`,
                )
              )
                return;
              if (approve) {
                const registryUrl = "https://registre.college-ic.ca/Public-Register-FR/RCIC_Search.aspx";
                const confirmed = window.prompt(
                  "Avant approbation, consultez le registre officiel du CCIC :\n" +
                  registryUrl + "\n\n" +
                  "Vérifiez le numéro, le nom et le statut professionnel.\n" +
                  "Si et seulement si ces éléments correspondent, saisissez exactement le numéro " +
                  item.license_number + " pour confirmer :",
                  "",
                );
                if (confirmed === null) return;
                if (confirmed.trim().toUpperCase() !== item.license_number.trim().toUpperCase()) {
                  show("Approbation annulée : vérification du registre non confirmée.");
                  return;
                }
              }
              const note = prompt("Note interne (facultative) :") ?? "";
              button.disabled = true;
              const { error } = await db.rpc("madic_review_cric", {
                p_user_id: item.user_id,
                p_approve: approve,
                p_note: note,
              });
              if (error) show("Erreur : " + error.message);
              else {
                show("Décision enregistrée.");
                await refresh();
              }
              button.disabled = false;
            });
            cell.append(button, document.createTextNode(" "));
          }
        }
      }
      await refresh();
    })();
  }
})();
