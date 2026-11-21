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
      { global: { fetch: window.madicPortalFetch } },
    );
  }

  return window.madicSupabaseClient;
};

(() => {
  let pending;
  let recovering = false;
  const tr = (fr, en) =>
    document.documentElement.lang.toLowerCase().startsWith("en") ? en : fr;

  window.madicRequireMfa = (db) => {
    if (!pending)
      pending = verifySession(db).finally(() => {
        pending = null;
      });
    return pending;
  };

  window.madicPortalFetch = async (input, init) => {
    const response = await window.fetch(input, init);
    if (!recovering && response.status === 403) {
      const url = new URL(
        input instanceof Request ? input.url : input,
        location.href,
      );
      if (
        url.origin === new URL(window.MADIC_CONFIG.url).origin &&
        url.pathname.startsWith("/rest/v1/")
      ) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (!recovering && body?.message === "MADIC_MFA_REQUIRED") {
          recovering = true;
          void window.madicRequireMfa(window.getMadicSupabase()).then(
            (allowed) => {
              if (allowed) location.reload();
            },
            () => {},
          );
        }
      }
    }
    return response;
  };

  async function verifySession(db) {
    const assurance = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (
      assurance.data.currentLevel === "aal2" &&
      assurance.data.nextLevel === "aal2"
    )
      return true;
    return requestCode(db);
  }

  function requestCode(db) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "madic-mfa-dialog";
      dialog.setAttribute("aria-labelledby", "madicMfaTitle");
      const form = document.createElement("form");
      const heading = document.createElement("h2");
      heading.id = "madicMfaTitle";
      heading.textContent = tr(
        "Double authentification",
        "Two-factor authentication",
      );
      const help = document.createElement("p");
      help.textContent = tr(
        "Entrez le code à six chiffres affiché dans votre application.",
        "Enter the six-digit code from your authenticator app.",
      );
      const setup = document.createElement("button");
      setup.type = "button";
      setup.hidden = true;
      setup.textContent = tr(
        "Configurer l’application",
        "Set up authenticator",
      );
      const enrollment = document.createElement("div");
      const label = document.createElement("label");
      label.htmlFor = "madicMfaCode";
      label.textContent = tr("Code de vérification", "Verification code");
      const input = document.createElement("input");
      input.id = "madicMfaCode";
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "one-time-code";
      input.pattern = "[0-9]{6}";
      input.maxLength = 6;
      input.required = true;
      input.disabled = true;
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.disabled = true;
      submit.textContent = tr("Vérifier", "Verify");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = tr("Annuler", "Cancel");
      const actions = document.createElement("div");
      actions.className = "madic-mfa-actions";
      actions.append(submit, cancel);
      form.append(
        heading,
        help,
        setup,
        enrollment,
        label,
        input,
        status,
        actions,
      );
      dialog.append(form);
      document.body.append(dialog);
      let factorId,
        busy = false,
        verified = false,
        closed = false;
      dialog.addEventListener(
        "close",
        () => {
          closed = true;
          dialog.remove();
          resolve(verified);
        },
        { once: true },
      );
      cancel.addEventListener("click", () => dialog.close());
      dialog.addEventListener("cancel", (event) => {
        if (busy) event.preventDefault();
      });
      dialog.showModal();

      function setBusy(value) {
        busy = value;
        input.disabled = submit.disabled = value || !factorId;
        cancel.disabled = setup.disabled = value;
      }

      async function factors() {
        const { data, error } = await db.auth.mfa.listFactors();
        if (error) throw error;
        return data;
      }

      async function prepare() {
        setBusy(true);
        try {
          factorId = (await factors()).totp.find(
            (factor) => factor.status === "verified",
          )?.id;
          if (closed) return;
          if (!factorId) {
            help.textContent = tr(
              "Configurez une application d’authentification pour protéger votre compte.",
              "Set up an authenticator app to protect your account.",
            );
            setup.hidden = false;
          }
        } catch {
          status.textContent = tr(
            "Impossible de vérifier la configuration. Reconnectez-vous pour réessayer.",
            "Unable to check your setup. Sign in again to retry.",
          );
        } finally {
          setBusy(false);
          if (factorId && !closed) input.focus();
        }
      }

      setup.addEventListener("click", async () => {
        if (busy || closed) return;
        setBusy(true);
        status.textContent = "";
        try {
          const existing = await factors();
          const current = existing.totp.find(
            (factor) => factor.status === "verified",
          );
          if (current) {
            factorId = current.id;
            setup.hidden = true;
            return;
          }
          for (const factor of existing.all) {
            if (
              factor.factor_type === "totp" &&
              factor.status === "unverified" &&
              factor.friendly_name === "MADIC"
            ) {
              const removed = await db.auth.mfa.unenroll({
                factorId: factor.id,
              });
              if (removed.error) throw removed.error;
            }
          }
          const { data, error } = await db.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "MADIC",
            issuer: "MADIC",
          });
          if (error) throw error;
          const qr = document.createElement("img");
          qr.width = 180;
          qr.height = 180;
          qr.alt = tr(
            "Code QR pour l’application d’authentification",
            "QR code for the authenticator app",
          );
          const qrCode = data.totp.qr_code;
          if (qrCode.startsWith("data:image/svg+xml")) qr.src = qrCode;
          else if (qrCode.trimStart().startsWith("<svg")) {
            qr.src =
              "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrCode);
          } else qr.hidden = true;
          const manual = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = tr(
            "Afficher la clé de configuration",
            "Show setup key",
          );
          const secret = document.createElement("code");
          secret.textContent = data.totp.secret;
          manual.append(summary, secret);
          enrollment.replaceChildren(qr, manual);
          help.textContent = tr(
            "Scannez le code QR et entrez le premier code affiché par l’application.",
            "Scan the QR code and enter the first code shown by the app.",
          );
          factorId = data.id;
          setup.hidden = true;
        } catch {
          status.textContent = tr(
            "Configuration impossible. Réessayez.",
            "Unable to set up the authenticator. Try again.",
          );
        } finally {
          setBusy(false);
          if (factorId) input.focus();
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !factorId || !/^[0-9]{6}$/.test(input.value)) return;
        const code = input.value;
        setBusy(true);
        status.textContent = "";
        try {
          const { error } = await db.auth.mfa.challengeAndVerify({
            factorId,
            code,
          });
          if (error) throw error;
          verified = true;
          dialog.close();
        } catch {
          status.textContent = tr(
            "Code refusé ou expiré. Entrez le code actuel et réessayez.",
            "The code was rejected or expired. Enter the current code and try again.",
          );
          input.value = "";
        } finally {
          setBusy(false);
          if (!closed) input.focus();
        }
      });
      void prepare();
    });
  }
})();

window.madicTrackRadarSession = async function (db, actor) {
  try {
    const { data } = await db.auth.getSession();
    if (!data?.session?.access_token) return;
    await fetch("/api/madic-radar-session?actor=" + actor, {
      method: "POST",
      headers: { Authorization: "Bearer " + data.session.access_token },
      keepalive: true,
    });
  } catch {
    // Les mesures du radar ne bloquent pas le portail.
  }
};
