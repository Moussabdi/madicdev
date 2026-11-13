/* MADIC validation CRIC : scripts de page consolides; aucun script inline. */
(function(){
"use strict";
const words={
"Aucune demande visible.":"No requests available.","Traitée":"Processed","Approuver":"Approve","Refuser":"Reject","Aucune prévalidation confirmée.":"No confirmed prevalidations.","Confirmé":"Confirmed","Non confirmé":"Not confirmed","Connexion administrateur requise.":"Administrator sign-in required.","Accès réservé au super administrateur.":"Access restricted to the super administrator.","Accès réservé au super administrateur MADIC.":"Access restricted to the MADIC super administrator.","Configuration Supabase absente.":"Supabase configuration missing.","Décision enregistrée.":"Decision saved.","Veuillez documenter votre décision.":"Please document your decision.","Décision enregistrée. Aucun compte professionnel n’a été créé.":"Decision saved. No professional account was created.","Configuration Supabase manquante.":"Supabase configuration missing.","Approbation annulée : vérification du registre non confirmée.":"Approval cancelled: official register verification not confirmed.","Erreur de lecture : ":"Read error: ","Décision non enregistrée : ":"Decision not saved: ","Erreur : ":"Error: ","pending (expirée)":"pending (expired)","approved":"approved","rejected":"rejected","pending":"pending"};
let language='fr';
try{language=(new URLSearchParams(location.search).get('lang')||localStorage.getItem('madic-lang')||localStorage.getItem('madic-language')||'fr').toLowerCase()==='en'?'en':'fr'}catch(e){}
function t(value){return language==='en'?(words[value]||value):value}
function translateMessage(value){if(language!=='en')return value;const s=String(value??'');return words[s]||s.replace(/^(Erreur de lecture : |Décision non enregistrée : |Erreur : )/,p=>words[p]||p)}
function render(){document.documentElement.lang=language==='en'?'en-CA':'fr-CA';document.querySelectorAll('[data-fr][data-en]').forEach(el=>{el.textContent=el.dataset[language]});document.querySelectorAll('[data-aria-label-fr][data-aria-label-en]').forEach(el=>el.setAttribute('aria-label',el.dataset['ariaLabel'+(language==='en'?'En':'Fr')]));document.querySelectorAll('[data-title-fr][data-title-en]').forEach(el=>el.title=el.dataset['title'+(language==='en'?'En':'Fr')]);document.querySelectorAll('#madicHeroLanguage button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===language)));document.title=language==='en'?'RCIC verification | MADIC':'Validation CRIC | MADIC';document.querySelectorAll('.madic-unified-brand strong[data-fr][data-en],header .brand small[data-fr][data-en]').forEach(el=>{el.textContent=el.dataset[language]});}
function setLanguage(next){language=next==='en'?'en':'fr';try{localStorage.setItem('madic-lang',language);localStorage.setItem('madic-language',language)}catch(e){}render();refreshDynamic();}
function formatValidationDate(s){return s?new Date(s).toLocaleString(language==='en'?'en-CA':'fr-CA'):'-'}
function refreshDynamic(){document.querySelectorAll('#cricApplications td:not(:has(button)),#cricPrevalidations td:not(:has(button)),#cricApplications button,#cricPrevalidations button').forEach(el=>{const fr=el.dataset.frOriginal||el.textContent.trim();if(!el.dataset.frOriginal)el.dataset.frOriginal=fr;el.textContent=t(fr)});document.querySelectorAll('#cricPrevalidations td[data-timestamp]').forEach(el=>{el.textContent=formatValidationDate(el.dataset.timestamp)});document.querySelectorAll('#cricMessage,#cricPrevalidationMessage').forEach(el=>{if(el.dataset.frMessage)el.textContent=translateMessage(el.dataset.frMessage)});}
window.madicValidationLanguage={get:()=>language,t,set:setLanguage,refresh:refreshDynamic};
document.querySelectorAll('#madicHeroLanguage button').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.lang)));
render();
// Refresh translations only after explicit page updates, not on every DOM mutation.
// The previous MutationObserver retriggered itself while rewriting table cells.
function loadSupabase(){return new Promise((resolve,reject)=>{if(window.supabase){resolve();return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Supabase unavailable'));document.head.appendChild(s);});}
loadSupabase().then(()=>{startApproval();startPrevalidations();}).catch(e=>{const m=document.getElementById('cricMessage');if(m)m.textContent=e.message;});
document.querySelectorAll('[data-madic-signout]').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();try{await window.getMadicSupabase?.()?.auth.signOut();}catch(e){}location.href=link.getAttribute('href')||'connexion-client-cric.html';}));
function startApproval(){
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
    if (msg) {msg.dataset.frMessage=s;msg.textContent=translateMessage(s);}
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
    queueMicrotask(refreshDynamic);
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
                  language==='en'?`${approve?"Approve":"Reject"} the request from ${item.full_name} (${item.license_number})?`:`${label} la demande de ${item.full_name} (${item.license_number}) ?`,
                )
              )
                return;
              if (approve) {
                const registryUrl = "https://registre.college-ic.ca/Public-Register-FR/RCIC_Search.aspx";
                const confirmed = window.prompt(
                  (language==='en'?"Before approving, check the official CICC register:\n":"Avant approbation, consultez le registre officiel du CCIC :\n") +
                  registryUrl + "\n\n" +
                  (language==='en'?"Verify the licence number, name and professional status.\n":"Vérifiez le numéro, le nom et le statut professionnel.\n") +
                  (language==='en'?"Only if all details match, enter the exact licence number ":"Si et seulement si ces éléments correspondent, saisissez exactement le numéro ") +
                  item.license_number + (language==='en' ? " to confirm:" : " pour confirmer :"),
                  "",
                );
                if (confirmed === null) return;
                if (confirmed.trim().toUpperCase() !== item.license_number.trim().toUpperCase()) {
                  show("Approbation annulée : vérification du registre non confirmée.");
                  return;
                }
              }
              const note = prompt(language==='en'?"Internal note (optional):":"Note interne (facultative) :") ?? "";
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

}
function startPrevalidations(){
(() => {
  "use strict";
  const tbody = document.getElementById("cricPrevalidations");
  const message = document.getElementById("cricPrevalidationMessage");
  if (!tbody) return;
  const setMessage = (text) => {
    message.dataset.frMessage=text;message.textContent=translateMessage(text);
  };
  const db = window.getMadicSupabase?.();
  if (!db) {
    setMessage("Configuration Supabase absente.");
    return;
  }
  const cell = (row, value) => {
    const td = row.insertCell();
    td.textContent = String(value ?? "-");
    return td;
  };
  const formatDate = formatValidationDate;
  async function refresh() {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      setMessage("Connexion administrateur requise.");
      return;
    }
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (permissionError || allowed !== true) {
      setMessage("Accès réservé au super administrateur.");
      return;
    }
    const { data, error } = await db.rpc(
      "madic_admin_list_cric_prevalidations",
    );
    if (error) {
      setMessage("Erreur de lecture : " + error.message);
      return;
    }
    tbody.replaceChildren();
    queueMicrotask(refreshDynamic);
    if (!data?.length) {
      const tr = tbody.insertRow();
      cell(tr, "Aucune prévalidation confirmée.").colSpan = 6;
      return;
    }
    for (const item of data) {
      const tr = tbody.insertRow();
      cell(tr, item.full_name);
      cell(tr, item.license_number);
      cell(tr, item.registry_verified ? "Confirmé" : "Non confirmé");
      const dateCell=cell(tr, formatDate(item.created_at));dateCell.dataset.timestamp=item.created_at;
      const expired =
        item.expires_at && new Date(item.expires_at).getTime() <= Date.now();
      cell(
        tr,
        item.status === "pending" && expired
          ? "pending (expirée)"
          : item.status,
      );
      const actions = tr.insertCell();
      if (item.status !== "pending") {
        actions.textContent = "Traitée";
        continue;
      }
      for (const [label, approve] of [
        ["Approuver", true],
        ["Refuser", false],
      ]) {
        if (approve && expired) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.style.marginRight = "0.5rem";
        button.addEventListener("click", async () => {
          const confirmation = language==='en'
            ? (approve ? `Do you confirm that you independently verified the identity of licence holder ${item.license_number}, in addition to the CICC register? This action does not grant professional access. Continue?` : `Reject the prevalidation of ${item.full_name} (${item.license_number})?`)
            : approve
            ? `Vous confirmez avoir vérifié l'identité du titulaire du permis ${item.license_number}, indépendamment du registre CCIC. Cette action n'ouvre aucun accès professionnel. Continuer ?`
            : `Refuser la prévalidation de ${item.full_name} (${item.license_number}) ?`;
          if (!window.confirm(confirmation)) return;
          const note = window.prompt(
            language==='en'?"Reason and verification evidence (required, at least 5 characters):":"Motif et preuve de vérification (obligatoire, minimum 5 caractères) :",
          );
          if (note === null) return;
          if (note.trim().length < 5) {
            setMessage("Veuillez documenter votre décision.");
            return;
          }
          button.disabled = true;
          const { error } = await db.rpc(
            "madic_admin_review_cric_prevalidation",
            {
              p_id: item.id,
              p_approve: approve,
              p_note: note.trim(),
            },
          );
          if (error) {
            setMessage("Décision non enregistrée : " + error.message);
            button.disabled = false;
            return;
          }
          setMessage(
            "Décision enregistrée. Aucun compte professionnel n’a été créé.",
          );
          await refresh();
        });
        actions.append(button);
      }
    }
  }
  refresh().catch((e) => setMessage("Erreur : " + e.message));
})();

}
})();
