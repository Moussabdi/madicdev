/* MADIC validation CRIC : scripts de page consolides; aucun script inline. */
(function () {
  "use strict";
  const words = {
    "Envoi de l’invitation accepté par le service de courriel.":
      "Invitation accepted by the email service.",
    "Aucune demande visible.": "No requests available.",
    Traitée: "Processed",
    Révoqué: "Revoked",
    Approuver: "Approve",
    Refuser: "Reject",
    "Aucune prévalidation confirmée.": "No confirmed prevalidations.",
    Confirmé: "Confirmed",
    "Non confirmé": "Not confirmed",
    "Connexion administrateur requise.": "Administrator sign-in required.",
    "Accès réservé au super administrateur.":
      "Access restricted to the super administrator.",
    "Accès réservé au super administrateur MADIC.":
      "Access restricted to the MADIC super administrator.",
    "Configuration Supabase absente.": "Supabase configuration missing.",
    "Décision enregistrée.": "Decision saved.",
    "Veuillez documenter votre décision.": "Please document your decision.",
    "Décision enregistrée. Aucun compte professionnel n’a été créé.":
      "Decision saved. No professional account was created.",
    "Configuration Supabase manquante.": "Supabase configuration missing.",
    "Approbation annulée : vérification du registre non confirmée.":
      "Approval cancelled: official register verification not confirmed.",
    "Erreur de lecture : ": "Read error: ",
    "Décision non enregistrée : ": "Decision not saved: ",
    "Erreur : ": "Error: ",
    "pending (expirée)": "pending (expired)",
    approved: "approved",
    rejected: "rejected",
    pending: "pending",
  };
  let language = "fr";
  try {
    language =
      (
        new URLSearchParams(location.search).get("lang") ||
        localStorage.getItem("madic-lang") ||
        localStorage.getItem("madic-language") ||
        "fr"
      ).toLowerCase() === "en"
        ? "en"
        : "fr";
  } catch (e) {}
  function t(value) {
    return language === "en" ? words[value] || value : value;
  }
  function translateMessage(value) {
    if (language !== "en") return value;
    const s = String(value ?? "");
    return (
      words[s] ||
      s.replace(
        /^(Erreur de lecture : |Décision non enregistrée : |Erreur : )/,
        (p) => words[p] || p,
      )
    );
  }
  function render() {
    document.documentElement.lang = language === "en" ? "en-CA" : "fr-CA";
    document.querySelectorAll("[data-fr][data-en]").forEach((el) => {
      el.textContent = el.dataset[language];
    });
    document
      .querySelectorAll("[data-aria-label-fr][data-aria-label-en]")
      .forEach((el) =>
        el.setAttribute(
          "aria-label",
          el.dataset["ariaLabel" + (language === "en" ? "En" : "Fr")],
        ),
      );
    document
      .querySelectorAll("[data-title-fr][data-title-en]")
      .forEach(
        (el) =>
          (el.title = el.dataset["title" + (language === "en" ? "En" : "Fr")]),
      );
    document
      .querySelectorAll("#madicHeroLanguage button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.lang === language)),
      );
    document.title =
      language === "en"
        ? "RCIC verification | MADIC"
        : "Validation CRIC | MADIC";
    document
      .querySelectorAll(
        ".madic-unified-brand strong[data-fr][data-en],header .brand small[data-fr][data-en]",
      )
      .forEach((el) => {
        el.textContent = el.dataset[language];
      });
  }
  function setLanguage(next) {
    language = next === "en" ? "en" : "fr";
    try {
      localStorage.setItem("madic-lang", language);
      localStorage.setItem("madic-language", language);
    } catch (e) {}
    render();
    refreshDynamic();
  }
  function formatValidationDate(s) {
    return s
      ? new Date(s).toLocaleString(language === "en" ? "en-CA" : "fr-CA")
      : "-";
  }
  function refreshDynamic() {
    document
      .querySelectorAll(
        "#cricApplications td:not(:has(button)),#cricPrevalidations td:not(:has(button)),#cricApplications button,#cricPrevalidations button",
      )
      .forEach((el) => {
        if (el.dataset[language]) {
          el.textContent = el.dataset[language];
          return;
        }
        if (el.querySelector("[data-fr][data-en]")) {
          el.querySelectorAll("[data-fr][data-en]").forEach((part) => {
            part.textContent = part.dataset[language];
          });
          return;
        }
        const fr = el.dataset.frOriginal || el.textContent.trim();
        if (!el.dataset.frOriginal) el.dataset.frOriginal = fr;
        el.textContent = t(fr);
      });
    document
      .querySelectorAll("#cricPrevalidations td[data-timestamp]")
      .forEach((el) => {
        el.textContent = formatValidationDate(el.dataset.timestamp);
      });
    document
      .querySelectorAll("#cricMessage,#cricPrevalidationMessage")
      .forEach((el) => {
        if (el.dataset.frMessage)
          el.textContent = translateMessage(el.dataset.frMessage);
      });
  }
  window.madicValidationLanguage = {
    get: () => language,
    t,
    set: setLanguage,
    refresh: refreshDynamic,
  };
  document
    .querySelectorAll("#madicHeroLanguage button")
    .forEach((b) =>
      b.addEventListener("click", () => setLanguage(b.dataset.lang)),
    );
  render();
  // Refresh translations only after explicit page updates, not on every DOM mutation.
  // The previous MutationObserver retriggered itself while rewriting table cells.
  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Supabase unavailable"));
      document.head.appendChild(s);
    });
  }
  loadSupabase()
    .then(() => {
      startApproval();
      startPrevalidations();
    })
    .catch((e) => {
      const m = document.getElementById("cricMessage");
      if (m) m.textContent = e.message;
    });
  document.querySelectorAll("[data-madic-signout]").forEach((link) =>
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await window.getMadicSupabase?.()?.auth.signOut();
      } catch (e) {}
      location.href = link.getAttribute("href") || "connexion-client-cric.html";
    }),
  );
  function startApproval() {
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
        popup
          .querySelectorAll("button")
          .forEach((b) => b.addEventListener("click", closePopup));
        popup.addEventListener("click", (e) => {
          if (e.target === popup) closePopup();
        });
        document.addEventListener("keydown", (e) => {
          if (popup.hidden) return;
          if (e.key === "Escape") {
            e.preventDefault();
            closePopup();
          }
          if (e.key === "Tab") {
            const buttons = [...popup.querySelectorAll("button")];
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
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
        if (msg) {
          msg.dataset.frMessage = s;
          msg.textContent = translateMessage(s);
        }
        if (
          document.body.dataset.page === "cric-signup" &&
          s &&
          !s.startsWith("Demande déjà enregistrée") &&
          !s.startsWith("Permis CRIC confirmé automatiquement")
        ) {
          openPopup(
            s,
            /^Erreur|non confirm|refus|invalide/i.test(s)
              ? "Résultat de la vérification CRIC"
              : "Information sur votre demande CRIC",
          );
        }
      };
      if (!cfg?.url || !cfg?.anonKey || !window.supabase) {
        show("Configuration Supabase manquante.");
        return;
      }
      const db = window.getMadicSupabase();
      const page = document.body.dataset.page;
      if (page === "cric-signup") {
        const guideButton = document.createElement("button");
        guideButton.type = "button";
        guideButton.className = "madic-cric-guide";
        guideButton.textContent = "ⓘ Guide de vérification CRIC";
        guideButton.addEventListener("click", () =>
          openPopup(
            "1. Saisissez votre nom complet et votre numéro de permis CRIC.\n" +
              "2. Cliquez sur « Vérifier mon permis CRIC ». MADIC consulte le registre officiel du CCIC.\n" +
              "3. Si le permis est confirmé, la prévalidation est transmise à MADIC sans création de compte.\n" +
              "4. MADIC examine votre identité dans la page administrative de validation.\n\n" +
              "Si le permis n’est pas confirmé, vérifiez les informations saisies. Vous pouvez fermer cette fenêtre à tout moment.",
            "Guide d'inscription CRIC",
          ),
        );
        const heading = document.querySelector("main h1");
        if (heading) heading.insertAdjacentElement("afterend", guideButton);
        const nameInput = document.getElementById("cricName");
        const licenseInput = document.getElementById("cricLicense");
        const verifyButton = document.getElementById("cricVerify");
        const checkButton = document.getElementById("cricCheckStatus");
        const key = "madic_cric_prevalidation_v1";
        const invoke = async (body) => {
          const { data, error } = await db.functions.invoke(
            "madic-verify-cric-license",
            { body },
          );
          if (error) {
            let message = "La vérification du permis a échoué.";
            try {
              const payload = await error.context?.clone()?.json();
              if (payload?.error) message = payload.error;
            } catch (_) {}
            throw new Error(message);
          }
          if (data?.error) throw new Error(data.error);
          return data;
        };
        const getSaved = () => {
          try {
            return JSON.parse(localStorage.getItem(key) || "null");
          } catch {
            return null;
          }
        };
        const saved = getSaved();
        if (saved?.token && saved.name && saved.license) {
          nameInput.value = saved.name;
          licenseInput.value = saved.license;
          checkButton.hidden = false;
        }
        const invalidate = () => {
          localStorage.removeItem(key);
          checkButton.hidden = true;
        };
        nameInput.addEventListener("input", invalidate);
        licenseInput.addEventListener("input", invalidate);
        verifyButton.addEventListener("click", async () => {
          const name = nameInput.value.trim().replace(/\s+/g, " ");
          const license = licenseInput.value.trim().toUpperCase();
          if (name.length < 3 || !/^R\d{6,}$/.test(license)) {
            show("Saisissez un nom complet et un numéro CRIC valide.");
            return;
          }
          verifyButton.disabled = true;
          try {
            const data = await invoke({
              action: "request",
              full_name: name,
              license_number: license,
            });
            if (
              data.verified !== true ||
              data.registry_verified !== true ||
              data.status !== "pending" ||
              !data.token ||
              data.registry?.registry_license !== license
            )
              throw Error("La vérification officielle n’a pas été confirmée.");
            localStorage.setItem(
              key,
              JSON.stringify({ name, license, token: data.token }),
            );
            checkButton.hidden = false;
            show(
              "Permis vérifié dans le registre officiel CCIC. La demande est enregistrée pour examen administratif MADIC. Aucun compte n’a été créé.",
            );
          } catch (e) {
            show("Erreur : " + e.message);
          } finally {
            verifyButton.disabled = false;
          }
        });
        checkButton.addEventListener("click", async () => {
          const saved = getSaved();
          if (
            !saved?.token ||
            saved.name !== nameInput.value.trim().replace(/\s+/g, " ") ||
            saved.license !== licenseInput.value.trim().toUpperCase()
          ) {
            show("Effectuez une nouvelle vérification.");
            return;
          }
          checkButton.disabled = true;
          try {
            const data = await invoke({ action: "status", token: saved.token });
            if (
              data.full_name !== saved.name ||
              data.license_number !== saved.license
            )
              throw Error("Référence incohérente.");
            const labels = {
              pending: "en attente de validation administrative",
              approved: "validée par MADIC (sans compte créé)",
              rejected: "refusée",
              expired: "expirée",
            };
            show(
              "Demande CRIC : " +
                (labels[data.status] || data.status) +
                ". Aucun compte n’est créé sur cette page.",
            );
          } catch (e) {
            show("Erreur : " + e.message);
          } finally {
            checkButton.disabled = false;
          }
        });
        document
          .getElementById("cricSignup")
          .addEventListener("submit", (e) => e.preventDefault());
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
          const { data: isOwner, error: oe } = await db.rpc(
            "madic_is_super_admin",
          );
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
            const state = await db.rpc("madic_admin_cric_onboarding_state");
            if (state.error) {
              show("Erreur : " + state.error.message);
              return;
            }
            const identities = new Map(
              state.data.identity.map((d) => [d.user_id, d]),
            );
            const revoked = new Set(state.data.revoked);
            const body = document.getElementById("cricApplications");
            body.replaceChildren();
            queueMicrotask(refreshDynamic);
            if (!data.length) {
              const tr = body.insertRow();
              tr.insertCell().colSpan = 6;
              tr.cells[0].textContent = "Aucune demande visible.";
              return;
            }
            for (const item of data) {
              const tr = body.insertRow();
              [
                item.full_name,
                item.license_number,
                item.professional_email,
                revoked.has(item.user_id) ? "Révoqué" : item.status,
              ].forEach((x) => (tr.insertCell().textContent = x));
              const identityCell = tr.insertCell();
              const cell = tr.insertCell();
              const identity = identities.get(item.user_id);
              const report = show;
              if (identity) {
                const types = {
                  passport: ["Passeport", "Passport"],
                  driver_licence: ["Permis de conduire", "Driver’s licence"],
                  photo_id: [
                    "Pièce officielle avec photo",
                    "Government-issued photo ID",
                  ],
                };
                const labels = {
                  submitted: ["À vérifier", "Awaiting review"],
                  verified: ["Identité vérifiée", "Identity verified"],
                  refused: ["Pièce refusée", "ID refused"],
                };
                const [frType, enType] = types[identity.document_type];
                const [frStatus, enStatus] = labels[identity.status];
                statusLabel(
                  identityCell,
                  frType + " · " + frStatus + " ",
                  enType + " · " + enStatus + " ",
                );
                if (identity.object_path)
                  adminAction(
                    identityCell,
                    "Voir la pièce",
                    "View ID",
                    () => showIdentity(db, identity),
                    report,
                  );
                if (identity.object_path && identity.status !== "submitted") {
                  adminAction(
                    identityCell,
                    "Supprimer la copie",
                    "Remove copy",
                    async () => {
                      if (
                        !confirm(
                          language === "en"
                            ? "Remove the image and keep the review record?"
                            : "Supprimer l’image et conserver la décision de contrôle ?",
                        )
                      )
                        return;
                      const { error } = await db.storage
                        .from("madic-cric-identity")
                        .remove([identity.object_path]);
                      if (error) throw error;
                      await refresh();
                    },
                    report,
                  );
                }
              }
              if (revoked.has(item.user_id)) continue;
              if (item.status === "approved") {
                adminAction(
                  cell,
                  "Révoquer l’accès",
                  "Revoke access",
                  async () => {
                    if (
                      !confirm(
                        language === "en"
                          ? "Revoke professional access and suspend the firm portal? Records will be kept."
                          : "Révoquer l’accès professionnel et suspendre le portail du cabinet ? Les dossiers seront conservés.",
                      )
                    )
                      return;
                    const reason = prompt(
                      language === "en"
                        ? "Reason for revocation (5–500 characters):"
                        : "Motif de la révocation (5 à 500 caractères) :",
                    );
                    if (reason === null) return;
                    const { error } = await db.rpc("madic_admin_revoke_cric", {
                      p_user_id: item.user_id,
                      p_reason: reason,
                    });
                    if (error) throw error;
                    show("Décision enregistrée.");
                    await refresh();
                  },
                  report,
                );
                continue;
              }
              if (item.status !== "pending") {
                if (!identity) cell.textContent = "Traitée";
                continue;
              }
              if (!identity) {
                statusLabel(
                  identityCell,
                  "Pièce d’identité attendue",
                  "Awaiting photo ID",
                );
                continue;
              }
              if (identity.status === "submitted") {
                for (const [fr, en, verified] of [
                  ["Valider la pièce", "Verify ID", true],
                  ["Refuser la pièce", "Reject ID", false],
                ]) {
                  adminAction(
                    identityCell,
                    fr,
                    en,
                    async () => {
                      const note = prompt(
                        language === "en"
                          ? "After inspecting the photo ID, enter a review note (5–500 characters). Leave out document numbers."
                          : "Après consultation de la pièce avec photo, saisissez une note (5 à 500 caractères) sans numéro de document.",
                      );
                      if (note === null) return;
                      const { error } = await db.rpc(
                        "madic_review_cric_identity",
                        {
                          p_user_id: item.user_id,
                          p_verified: verified,
                          p_note: note,
                        },
                      );
                      if (error) throw error;
                      await refresh();
                    },
                    report,
                  );
                }
                continue;
              }
              for (const [label, approve] of [
                ["Approuver", true],
                ["Refuser", false],
              ]) {
                if (approve && identity.status !== "verified") continue;
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = label;
                button.className = "secondary";
                button.addEventListener("click", async () => {
                  if (
                    !confirm(
                      language === "en"
                        ? `${approve ? "Approve" : "Reject"} the request from ${item.full_name} (${item.license_number})?`
                        : `${label} la demande de ${item.full_name} (${item.license_number}) ?`,
                    )
                  )
                    return;
                  if (approve) {
                    const registryUrl =
                      "https://registre.college-ic.ca/Public-Register-FR/RCIC_Search.aspx";
                    const confirmed = window.prompt(
                      (language === "en"
                        ? "Before approving, check the official CICC register:\n"
                        : "Avant approbation, consultez le registre officiel du CCIC :\n") +
                        registryUrl +
                        "\n\n" +
                        (language === "en"
                          ? "Verify the licence number, name and professional status.\n"
                          : "Vérifiez le numéro, le nom et le statut professionnel.\n") +
                        (language === "en"
                          ? "Only if all details match, enter the exact licence number "
                          : "Si et seulement si ces éléments correspondent, saisissez exactement le numéro ") +
                        item.license_number +
                        (language === "en"
                          ? " to confirm:"
                          : " pour confirmer :"),
                      "",
                    );
                    if (confirmed === null) return;
                    if (
                      confirmed.trim().toUpperCase() !==
                      item.license_number.trim().toUpperCase()
                    ) {
                      show(
                        "Approbation annulée : vérification du registre non confirmée.",
                      );
                      return;
                    }
                  }
                  const note =
                    prompt(
                      language === "en"
                        ? "Internal note (optional):"
                        : "Note interne (facultative) :",
                    ) ?? "";
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
  // Confirmation MADIC bilingue pour l'invitation professionnelle.
  function confirmCricInvitation(email) {
    const dialog = document.getElementById("cricInvitationConfirm");
    if (!dialog || typeof dialog.showModal !== "function") {
      return Promise.resolve(false);
    }
    const title = dialog.querySelector("[data-cric-invite-title]");
    const description = dialog.querySelector("[data-cric-invite-description]");
    const emailElement = dialog.querySelector("[data-cric-invite-email]");
    const send = dialog.querySelector("[data-cric-invite-send]");
    const cancel = dialog.querySelector("[data-cric-invite-cancel]");
    const en = language === "en";
    title.textContent = en ? "Confirm RCIC invitation" : "Confirmer l’invitation CRIC";
    description.textContent = en
      ? "Send a personal registration invitation to the following professional email address?"
      : "Envoyer une invitation personnelle d’inscription à l’adresse professionnelle suivante ?";
    emailElement.textContent = email;
    send.textContent = en ? "Send invitation" : "Envoyer l’invitation";
    cancel.textContent = en ? "Cancel" : "Annuler";
    dialog.querySelector("[data-cric-invite-close]").setAttribute("aria-label", en ? "Close" : "Fermer");
    return new Promise((resolve) => {
      let confirmed = false;
      const onSend = () => { confirmed = true; dialog.close(); };
      const onClose = () => {
        send.removeEventListener("click", onSend);
        dialog.removeEventListener("close", onClose);
        resolve(confirmed);
      };
      send.addEventListener("click", onSend);
      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }
  function adminAction(cell, fr, en, task, report) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.dataset.fr = fr;
    button.dataset.en = en;
    button.textContent = language === "en" ? en : fr;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await task();
      } catch (error) {
        report("Erreur : " + (error.message || String(error)));
      } finally {
        button.disabled = false;
      }
    });
    cell.append(button, document.createTextNode(" "));
  }
  function statusLabel(cell, fr, en) {
    const span = document.createElement("span");
    span.dataset.fr = fr;
    span.dataset.en = en;
    span.textContent = language === "en" ? en : fr;
    cell.append(span);
  }
  async function showIdentity(db, identity) {
    const { data, error } = await db.storage
      .from("madic-cric-identity")
      .download(identity.object_path);
    if (error) throw error;
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.type)) {
      throw new Error(
        language === "en"
          ? "Unsupported attachment type."
          : "Type de pièce non pris en charge.",
      );
    }
    const dialog = document.getElementById("cricIdentityPreview");
    const image = dialog.querySelector("img");
    const url = URL.createObjectURL(data);
    const close = () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
    if (dialog.open) {
      close();
      return;
    }
    image.src = url;
    dialog.addEventListener("close", close, { once: true });
    dialog.showModal();
  }

  function startPrevalidations() {
    (() => {
      "use strict";
      const tbody = document.getElementById("cricPrevalidations");
      const message = document.getElementById("cricPrevalidationMessage");
      if (!tbody) return;
      const setMessage = (text) => {
        message.dataset.frMessage = text;
        message.textContent = translateMessage(text);
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
        const state = await db.rpc("madic_admin_cric_onboarding_state");
        if (state.error) {
          setMessage("Erreur : " + state.error.message);
          return;
        }
        const invitations = new Map(
          state.data.invites.map((i) => [i.prevalidation_id, i]),
        );
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
          const dateCell = cell(tr, formatDate(item.created_at));
          dateCell.dataset.timestamp = item.created_at;
          const expired =
            item.expires_at &&
            new Date(item.expires_at).getTime() <= Date.now();
          cell(
            tr,
            item.status === "pending" && expired
              ? "pending (expirée)"
              : item.status,
          );
          const actions = tr.insertCell();
          const invitation = invitations.get(item.id);
          if (invitation?.claimed_at) {
            statusLabel(actions, "Compte associé", "Account linked");
            continue;
          }
          if (
            !item.registry_verified ||
            expired ||
            item.status === "rejected"
          ) {
            statusLabel(
              actions,
              expired ? "Prévalidation expirée" : "Traitée",
              expired ? "Prevalidation expired" : "Processed",
            );
            continue;
          }
          if (invitation?.delivered_at)
            statusLabel(
              actions,
              "Envoi accepté par le service de courriel. ",
              "Accepted by the email service. ",
            );
          adminAction(
            actions,
            invitation ? "Renvoyer l’invitation" : "Inviter le CRIC",
            invitation ? "Resend invitation" : "Invite RCIC",
            async () => {
              const { data: registeredEmail, error: recipientError } =
                await db.rpc("madic_admin_cric_invitation_email", {
                  p_prevalidation: item.id,
                });
              if (recipientError || !registeredEmail)
                throw new Error(
                  language === "en"
                    ? "Registered professional email unavailable."
                    : "Adresse professionnelle enregistrée indisponible.",
                );
              if (!(await confirmCricInvitation(registeredEmail))) return;
              const { data, error } = await db.functions.invoke(
                "madic-invite-cric",
                { body: { prevalidation_id: item.id, language } },
              );
              if (error || !data?.accepted) {
                const code = error?.context?.status;
                throw new Error(
                  language === "en"
                    ? "Invitation could not be sent" +
                        (code ? " (" + code + ")." : ".")
                    : "Envoi de l’invitation impossible" +
                        (code ? " (" + code + ")." : "."),
                );
              }
              setMessage(
                "Envoi de l’invitation accepté par le service de courriel.",
              );
              await refresh();
            },
            setMessage,
          );
          if (item.status === "pending" && !invitation) {
            adminAction(
              actions,
              "Refuser la prévalidation",
              "Reject prevalidation",
              async () => {
                const note = prompt(
                  language === "en"
                    ? "Reason (minimum 5 characters):"
                    : "Motif (minimum 5 caractères) :",
                );
                if (note === null) return;
                const { error } = await db.rpc(
                  "madic_admin_review_cric_prevalidation",
                  { p_id: item.id, p_approve: false, p_note: note },
                );
                if (error) throw error;
                setMessage("Décision enregistrée.");
                await refresh();
              },
              setMessage,
            );
          }
        }
      }
      refresh().catch((e) => setMessage("Erreur : " + e.message));
    })();
  }
})();
