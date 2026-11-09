/* MADIC - parcours de paiement obligatoire; aucun paiement n'est presume confirme. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    form = $("paymentForm"),
    notice = $("notice");
  const state = { step: 0, timing: "", method: "", service: "" };
  let busy = false,
    en = false;
  const say = (fr, eng) => {
    notice.textContent = en ? eng : fr;
  };
  const db =
    window.getMadicSupabase?.() ||
    (window.supabase && window.MADIC_CONFIG?.url && window.MADIC_CONFIG?.anonKey
      ? window.supabase.createClient(
          window.MADIC_CONFIG.url,
          window.MADIC_CONFIG.anonKey,
        )
      : null);
  if (!db) {
    say(
      "Configuration MADIC indisponible.",
      "MADIC configuration unavailable.",
    );
    return;
  }
  const { data: { user } = {}, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    location.replace("connexion-client-cric.html");
    return;
  }
  try {
    const [intake, request] = await Promise.all([
      db
        .from("madic_client_intake")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("madic_initial_service_requests")
        .select("service_type,tariff_code")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (intake.error) throw intake.error;
    if (request.error) throw request.error;
    if (intake.data?.status !== "submitted" || !request.data?.service_type) {
      say(
        "Soumettez votre formulaire et votre demande de service avant de poursuivre.",
        "Submit your form and service request first.",
      );
      return;
    }
    state.service = request.data.service_type;
    const recordedTariff = request.data.tariff_code;
    // Le tarif provient de la demande enregistrée en base, non de sessionStorage.
    const allowedTariffs = { hourly: 159, single: 599, couple: 749 };
    const tariffSelection = state.service === "consultation" &&
      Object.hasOwn(allowedTariffs, recordedTariff) ? recordedTariff : null;
    const tariffNames = {
      hourly: ["À taux horaire", "Hourly rate"],
      single: [
        "À taux forfaitaire - Personne célibataire",
        "Flat rate - Single person",
      ],
      couple: [
        "À taux forfaitaire - Couple (demandeur principal avec époux(se))",
        "Flat rate - Couple (principal applicant and spouse)",
      ],
    };
    const tariffAmounts = { hourly: 159, single: 599, couple: 749 };
    const showTariff = () => {
      $("tariffDetails").hidden = state.service !== "consultation";
      if (state.service !== "consultation") return;
      $("tariffLabel").textContent = tariffSelection
        ? tariffNames[tariffSelection][en ? 1 : 0]
        : en
          ? "Pricing not selected in this session. Return to the previous step."
          : "Tarif non sélectionné dans cette session. Retournez à l’étape précédente.";
      $("tariffAmount").textContent = tariffSelection
        ? `${tariffAmounts[tariffSelection]} USD`
        : "";
    };
    state.showTariff = showTariff;
    state.tariffSelection = tariffSelection;
    $("service").textContent =
      state.service === "consultation"
        ? "Consultation initiale"
        : "Proposition personnalisée";
    const existing = await db
      .from("madic_service_payment_declarations")
      .select("status,payment_method,payment_timing")
      .eq("client_id", user.id)
      .maybeSingle();
    if (!existing.error && existing.data?.status === "verified") {
      $("paymentForm").hidden = true;
      $("success").hidden = false;
      $("successMessage").textContent = "Votre paiement a déjà été confirmé par votre CRIC.";
      if (state.service === "consultation") {
        const link = $("initialContractLink");
        link.href = "contrat-initial-demande-client.html";
        link.textContent = "Consulter mon nouveau contrat initial";
        link.hidden = false;
      }
      say(
        "Votre paiement a déjà été confirmé par votre CRIC.",
        "Your payment has already been verified by your RCIC.",
      );
      return;
    }
    form.hidden = false;
  } catch (err) {
    say("Suivi indisponible : " + err.message, "Unavailable: " + err.message);
    return;
  }
  function render() {
    state.showTariff?.();
    document
      .querySelectorAll("[data-step]")
      .forEach((e) => (e.hidden = Number(e.dataset.step) !== state.step));
    document
      .querySelectorAll(".progress-segment")
      .forEach((e, i) => e.classList.toggle("done", i <= state.step));
    $("back").hidden = state.step === 0;
    $("next").textContent =
      state.step === 3
        ? en
          ? "Submit"
          : "Confirmer et enregistrer"
        : en
          ? "Continue"
          : "Continuer";
    $("methodInstructions").hidden = !(
      state.step === 2 && state.timing === "later"
    );
    $("alreadyFields").hidden = state.timing !== "already";
    $("methodNotice").textContent =
      state.method === "portal"
        ? "Le paiement en ligne nécessite une session de paiement sécurisée; aucune somme ne sera débitée sur cette page."
        : state.method === "western_union"
          ? "Utilisez uniquement les coordonnées Western Union confirmées par votre cabinet."
          : state.method === "interac"
            ? "Utilisez uniquement les coordonnées Interac communiquées par votre cabinet."
            : state.method === "cash"
              ? "Convenez des modalités de remise en espèces directement avec votre cabinet."
              : "Sélectionnez un mode de paiement.";
    if (state.step === 3) {
      $("summary").textContent =
        `${state.service === "consultation" ? "Consultation initiale" : "Proposition personnalisée"} · ${state.timing === "already" ? "Paiement déjà effectué" : "Paiement à effectuer"} · ${state.method === "interac" ? "Interac" : state.method === "cash" ? "Espèces" : state.method === "western_union" ? "Western Union" : "MADIC Portail"}`;
    }
  }
  $("lang").addEventListener("click", () => {
    en = !en;
    document.documentElement.lang = en ? "en" : "fr";
    document
      .querySelectorAll("[data-fr][data-en]")
      .forEach((e) => (e.textContent = e.dataset[en ? "en" : "fr"]));
    $("lang").textContent = en ? "Français" : "English";
    render();
  });
  $("back").addEventListener("click", () => {
    if (state.step > 0) {
      state.step--;
      render();
      say("", "");
    }
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "timing") {
      state.timing = e.target.value;
      state.method = "";
      document
        .querySelectorAll('[name="method"]')
        .forEach((r) => (r.checked = false));
    }
    if (e.target.name === "method") state.method = e.target.value;
    render();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    if (state.step === 0) {
      if (state.service === "consultation" && !state.tariffSelection) {
        say(
          "Retournez à la page précédente pour choisir votre tarif.",
          "Return to the previous page to choose your pricing.",
        );
        return;
      }
      if (!$("serviceAcknowledgement").checked) {
        say(
          "Confirmez le service sélectionné.",
          "Confirm the selected service.",
        );
        return;
      }
    }
    if (state.step === 1 && !state.timing) {
      say(
        "Choisissez votre situation de paiement.",
        "Choose your payment situation.",
      );
      return;
    }
    if (state.step === 2) {
      if (!state.method) {
        say("Choisissez un mode de paiement.", "Choose a payment method.");
        return;
      }
      if (state.timing === "already") {
        if (
          !$("paymentDate").value ||
          $("paymentDate").value >
            new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 10) ||
          !$("reference").value.trim() ||
          !$("proof").files.length
        ) {
          say(
            "Date, référence et preuve sont obligatoires.",
            "Date, reference and proof are required.",
          );
          return;
        }
        const file = $("proof").files[0];
        if (
          file.size > 10 * 1024 * 1024 ||
          !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
        ) {
          say(
            "Preuve : PDF, JPG ou PNG, 10 Mo maximum.",
            "Proof: PDF, JPG or PNG, 10 MB maximum.",
          );
          return;
        }
      } else if (state.method === "portal") {
        say(
          "Le paiement en ligne n’est pas encore relié à une session sécurisée pour ce service. Choisissez un autre mode ou revenez ultérieurement.",
          "Online checkout is not yet connected for this service. Choose another method or return later.",
        );
        return;
      }
    }
    if (state.step < 3) {
      state.step++;
      render();
      say("", "");
      return;
    }
    if (!$("certify").checked) {
      say(
        "Vous devez confirmer votre déclaration.",
        "You must confirm your declaration.",
      );
      return;
    }
    busy = true;
    $("next").disabled = true;
    try {
      let path = null;
      if (state.timing === "already") {
        const file = $("proof").files[0];
        const ext =
          file.type === "application/pdf"
            ? "pdf"
            : file.type === "image/png"
              ? "png"
              : "jpg";
        path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const upload = await db.storage
          .from("madic-service-payment-proofs")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
      }
      const { error } = await db.rpc("madic_service_submit_payment", {
        p_timing: state.timing,
        p_method: state.method,
        p_payment_date:
          state.timing === "already" ? $("paymentDate").value : null,
        p_reference:
          state.timing === "already" ? $("reference").value.trim() : null,
        p_proof_path: path,
      });
      if (error) throw error;
      form.hidden = true;
      $("success").hidden = false;
      $("successMessage").textContent =
        state.timing === "already"
          ? "Votre déclaration et votre preuve ont été enregistrées. Votre CRIC doit encore vérifier le paiement."
          : "Votre mode de paiement a été enregistré. Le paiement reste en attente; utilisez les instructions officielles du cabinet, puis revenez déclarer votre paiement avec sa preuve.";
      // Nouveau parcours distinct : Client -> CRIC. Ne jamais ouvrir un ancien contrat.
      if (state.service === "consultation") {
        const link = $("initialContractLink");
        link.href = "contrat-initial-demande-client.html";
        link.textContent = "Préparer et signer mon nouveau contrat initial";
        link.hidden = false;
        $("initialContractInfo").textContent =
          "Après votre déclaration de paiement, préparez et signez un nouveau contrat. Votre CRIC le contresignera ensuite.";
      }
      say("", "");
    } catch (err) {
      say(
        "Enregistrement impossible : " + err.message,
        "Unable to save: " + err.message,
      );
    } finally {
      busy = false;
      $("next").disabled = false;
    }
  });
  render();
})();
