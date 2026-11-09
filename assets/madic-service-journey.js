/* MADIC - suivi de demandes isole par cabinet. Module independant des scripts historiques. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (
    !window.MADIC_CONFIG?.url ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return;
  const db = window.getMadicSupabase();
  const { data: { user } = {}, error: authError } = await db.auth.getUser();
  if (authError || !user) return;
  const labels = {
    received: "Reçue",
    reviewing: "En analyse",
    responded: "Réponse transmise",
    closed: "Clôturée",
  };
  const services = {
    consultation: "Consultation initiale",
    proposition: "Proposition personnalisée",
  };
  const niceDate = (value) =>
    value
      ? new Date(value).toLocaleString("fr-CA", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";
  const cricPanel = $("madicServiceRequestsPanel");
  if (cricPanel) {
    const notice = $("madicServiceNotice"),
      list = $("madicServiceList"),
      badge = $("madicServicePendingBadge"),
      refresh = $("madicServiceRefresh");
    let busy = false,
      spaceId = null;
    const createToggle = $("madicServiceCreateToggle"),
      createForm = $("madicServiceCreateForm");
    const clientSelect = $("madicServiceClient"),
      intakeState = $("madicServiceIntakeState");
    const createSubmit = $("madicServiceCreateSubmit");
    let eligibleClients = [];
    // Filtrage local de la liste compacte, sans modifier les donnees Supabase.
    const requestFilter = $("madicServiceFilter");
    const requestSearch = $("madicServiceSearch");
    function applyRequestFilters() {
      const status = requestFilter?.value || "all";
      const query = (requestSearch?.value || "").trim().toLocaleLowerCase("fr-CA");
      for (const article of list.querySelectorAll(".madic-service-item")) {
        const matchesName = !query || (article.dataset.clientName || "").includes(query);
        const matchesStatus = status === "all" ||
          (status === "received" && article.dataset.requestStatus === "received") ||
          (status === "signed" && article.dataset.contractSigned === "true");
        article.hidden = !(matchesName && matchesStatus);
        // Les styles de cartes ne doivent pas annuler l'attribut hidden.
        article.style.display = article.hidden ? "none" : "";
      }
    }
    function updateSignedCount() {
      const count = Array.from(list.querySelectorAll(".madic-service-item"))
        .filter((article) => article.dataset.contractSigned === "true").length;
      const counter = $("madicServiceOtherCount");
      if (counter) counter.textContent = String(count);
    }
    requestFilter?.addEventListener("change", applyRequestFilters);
    requestSearch?.addEventListener("input", applyRequestFilters);
    function validateClient() {
      const selected = eligibleClients.find(
        (c) => c.client_id === clientSelect?.value,
      );
      const submitted = selected?.intake_status === "submitted";
      const available = submitted && !selected?.has_request;
      if (intakeState)
        intakeState.textContent = !selected
          ? "Sélectionnez un client."
          : !submitted
            ? "Formulaire non soumis : création impossible."
            : selected.has_request
              ? "Une demande existe déjà : création bloquée."
              : "Formulaire soumis : demande autorisée.";
      if (createSubmit) createSubmit.disabled = !available;
    }
    async function loadEligible() {
      if (!clientSelect || !spaceId) return;
      const { data, error } = await db.rpc("madic_service_eligible_clients", {
        p_space_id: spaceId,
      });
      if (error) throw error;
      eligibleClients = data || [];
      clientSelect.replaceChildren();
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Choisir un client";
      clientSelect.append(blank);
      for (const c of eligibleClients) {
        const option = document.createElement("option");
        option.value = c.client_id;
        option.textContent =
          (c.client_name || "Client") +
          (c.intake_status === "submitted"
            ? " · formulaire soumis"
            : " · formulaire incomplet") +
          (c.has_request ? " · demande existante" : "");
        clientSelect.append(option);
      }
      validateClient();
    }
    clientSelect?.addEventListener("change", validateClient);
    createToggle?.addEventListener("click", async () => {
      const opening = createForm.hidden;
      createForm.hidden = !opening;
      createToggle.setAttribute("aria-expanded", String(opening));
      if (opening) {
        try {
          await loadEligible();
        } catch (e) {
          intakeState.textContent = "Chargement impossible : " + e.message;
        }
      }
    });
    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      validateClient();
      if (createSubmit.disabled) return;
      createSubmit.disabled = true;
      try {
        const { error } = await db.rpc("madic_service_create_by_cric", {
          p_space_id: spaceId,
          p_client_id: clientSelect.value,
          p_service_type: $("madicServiceType").value,
          p_payment_method: $("madicServicePayment").value,
          p_payment_note: $("madicServicePaymentNote").value || null,
        });
        if (error) throw error;
        notice.textContent =
          "Demande créée. Le parcours client sera actualisé automatiquement.";
        createForm.reset();
        await loadEligible();
        await load();
      } catch (err) {
        intakeState.textContent = "Création impossible : " + err.message;
        validateClient();
      }
    });
    const pill = (label, kind = "neutral") => {
      const el = document.createElement("span");
      el.className = "madic-service-state madic-service-state-" + kind;
      el.textContent = label;
      return el;
    };
    const stateLine = (label, value, kind = "neutral") => {
      const line = document.createElement("div");
      line.className = "madic-service-state-line";
      const title = document.createElement("span");
      title.textContent = label;
      const badge = pill(value, kind);
      line.append(title, badge);
      return { line, badge };
    };
    async function appointmentOverview() {
      const now = new Date().toISOString();
      const [slotsResult, appointmentsResult] = await Promise.all([
        db
          .from("madic_cric_appointment_slots")
          .select("id,starts_at,is_open")
          .eq("space_id", spaceId)
          .gte("starts_at", now),
        db
          .from("madic_cric_appointments")
          .select("client_id,slot_id,status")
          .eq("space_id", spaceId),
      ]);
      if (slotsResult.error) throw slotsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;
      const appointments = appointmentsResult.data || [];
      const occupied = new Set(
        appointments
          .filter((a) => ["requested", "confirmed"].includes(a.status))
          .map((a) => a.slot_id),
      );
      const available = (slotsResult.data || []).filter(
        (s) => s.is_open && !occupied.has(s.id),
      ).length;
      const perClient = new Map();
      for (const a of appointments) {
        if (!perClient.has(a.client_id)) perClient.set(a.client_id, []);
        perClient.get(a.client_id).push(a.status);
      }
      return { available, perClient };
    }

    async function load() {
      if (busy || !spaceId || document.hidden) return;
      busy = true;
      refresh.disabled = true;
      try {
        const { data, error } = await db.rpc(
          "madic_service_requests_for_cric",
          { p_space_id: spaceId },
        );
        if (error) throw error;
        list.replaceChildren();
        const requests = data || [];
        let appointmentData = null,
          appointmentError = null;
        if (
          requests.some((r) =>
            ["consultation", "proposition"].includes(r.service_type),
          )
        ) {
          try {
            appointmentData = await appointmentOverview();
          } catch (e) {
            appointmentError = e;
          }
        }
        const pending = requests.filter(
          (r) => r.request_status === "received",
        ).length;
        $("madicServiceTotalCount") && ($("madicServiceTotalCount").textContent = String(requests.length));
        $("madicServiceReceivedCount") && ($("madicServiceReceivedCount").textContent = String(pending));
        // Ce compteur porte desormais sur les contrats effectivement signes.
        $("madicServiceOtherCount") && ($("madicServiceOtherCount").textContent = "0");
        badge.textContent = String(pending);
        badge.hidden = !pending;
        notice.textContent = requests.length
          ? `${requests.length} demande(s), dont ${pending} à traiter.`
          : "Aucune demande de service pour le moment.";
        for (const item of requests) {
          const article = document.createElement("article");
          article.className = "madic-service-item";
          article.dataset.clientName = (item.client_name || "Client").toLocaleLowerCase("fr-CA");
          article.dataset.requestStatus = item.request_status || "received";
          article.dataset.contractSigned = "false";
          const header = document.createElement("div");
          header.className = "madic-service-head";
          const title = document.createElement("strong");
          title.textContent = item.client_name || "Client";
          const tag = document.createElement("span");
          tag.className = "madic-service-badge";
          tag.textContent = labels[item.request_status] || "Reçue";
          header.append(title, tag);
          const detail = document.createElement("p");
          detail.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          const expanded = document.createElement("details");
          expanded.className = "madic-service-expanded";
          const summary = document.createElement("summary");
          summary.className = "madic-service-row";
          const summaryMain = document.createElement("span");
          summaryMain.className = "madic-service-row-client";
          const summaryName = document.createElement("strong");
          summaryName.textContent = item.client_name || "Client";
          const summaryType = document.createElement("small");
          summaryType.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          summaryMain.append(summaryName, summaryType);
          const summaryStatus = pill(labels[item.request_status] || "Reçue", "info");
          const summaryContract = pill("Vérification…");
          const summaryAppointment = pill("Vérification…");
          const summaryContractGroup = document.createElement("span");
          summaryContractGroup.className = "madic-service-row-indicator";
          summaryContractGroup.append(document.createTextNode("Contrat"), summaryContract);
          const summaryAppointmentGroup = document.createElement("span");
          summaryAppointmentGroup.className = "madic-service-row-indicator";
          summaryAppointmentGroup.append(document.createTextNode("Rendez-vous"), summaryAppointment);
          const summaryChevron = document.createElement("span");
          summaryChevron.className = "madic-service-chevron";
          summaryChevron.textContent = "Détails";
          summary.append(summaryMain, summaryStatus, summaryContractGroup, summaryAppointmentGroup, summaryChevron);
          const expandedBody = document.createElement("div");
          expandedBody.className = "madic-service-expanded-body";
          expanded.append(summary, expandedBody);
          function mirrorState(source, target, isContract = false) {
            const sync = () => {
              target.textContent = source.textContent;
              target.className = source.className;
              if (isContract) {
                // "À contresigner" est signe par le client, mais pas finalise.
                article.dataset.contractSigned = /^(Signé|Contresigné)$/.test(source.textContent.trim()) ? "true" : "false";
                updateSignedCount();
                applyRequestFilters();
              }
            };
            new MutationObserver(sync).observe(source, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:["class"]});
            sync();
          }
          const actions = document.createElement("div");
          actions.className = "madic-service-actions";
          const select = document.createElement("select");
          select.setAttribute(
            "aria-label",
            "Statut de la demande de " + (item.client_name || "client"),
          );
          for (const [value, label] of Object.entries(labels)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.append(option);
          }
          select.value = item.request_status || "received";
          // Le contrat et les disponibilites restent geres par leurs modules existants.
          const workflow = document.createElement("div");
          workflow.className = "madic-service-workflow";
          if (["consultation", "proposition"].includes(item.service_type)) {
            const contract = document.createElement("div");
            contract.className = "madic-service-workflow-block";
            const heading = document.createElement("strong");
            heading.textContent =
              item.service_type === "proposition"
                ? "Contrat professionnel et signature"
                : "Contrat initial et signature";
            const contractState = stateLine("Contrat", "Vérification…");
            const signatureState = stateLine(
              "Signature du client",
              "Vérification…",
            );
            const open = document.createElement("a");
            open.href =
              (item.service_type === "proposition"
                ? "contrat-professionnel-cric.html"
                : "contrat-initial-cric.html") +
              "?client=" +
              encodeURIComponent(item.client_id);
            open.textContent = "Préparer / consulter le contrat →";
            contract.append(
              heading,
              contractState.line,
              signatureState.line,
              open,
            );
            workflow.append(contract);
            if (item.service_type === "proposition") {
              contractState.badge.textContent = "Brouillon uniquement";
              signatureState.badge.textContent = "Non disponible";
              const note = document.createElement("p");
              note.className = "madic-service-workflow-note";
              note.textContent =
                "La publication et la signature électronique du contrat professionnel ne sont pas encore activées. Aucun contrat initial ne sera utilisé pour ce mandat.";
              contract.append(note);
            } else {
              // Le parcours Client -> CRIC utilise client_signe / deux_signatures.
              // Lire uniquement les contrats de ce client dans cet espace CRIC.
              (async () => {
                const { data: clientContracts, error: clientError } = await db
                  .from("madic_initial_contracts")
                  .select("id,status")
                  .eq("space_id", spaceId)
                  .eq("client_id", item.client_id)
                  .eq("signature_flow", "client_to_cric")
                  .in("status", ["client_signe", "deux_signatures"])
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (clientError) console.warn("Contrat Client vers CRIC :", clientError.message);
                const signed = !clientError && clientContracts?.[0];
                if (signed) {
                  // Un contrat transmis par le client se consulte et se contresigne
                  // dans le parcours Client -> CRIC, sans ouvrir le formulaire de creation.
                  open.href = "contrats-client-vers-cric.html";
                  open.textContent = signed.status === "deux_signatures"
                    ? "Consulter le contrat contresigné →"
                    : "Consulter et contresigner le contrat →";
                  contractState.badge.textContent = signed.status === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                  return;
                }
                // Conserver la logique historique des contrats CRIC -> Client.
                const { data, error } = await db.rpc("madic_service_contract_state", {
                  p_space_id: spaceId,
                  p_client_id: item.client_id,
                });
                if (error) throw error;
                const row = Array.isArray(data) ? data[0] : data;
                const state = row?.contract_status;
                if (state === "signe") {
                  contractState.badge.textContent = "Signé";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (state === "publie") {
                  contractState.badge.textContent = "Publié";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-info";
                  signatureState.badge.textContent = "En attente";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-pending";
                } else if (state === "client_signe" || state === "deux_signatures") {
                  contractState.badge.textContent = state === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (clientError) {
                  contractState.badge.textContent = "À vérifier";
                  signatureState.badge.textContent = "À vérifier";
                } else {
                  contractState.badge.textContent = "Non publié";
                  signatureState.badge.textContent = "Non disponible";
                }
              })().catch((error) => {
                console.warn("État du contrat :", error.message);
                contractState.badge.textContent = "Indisponible";
                signatureState.badge.textContent = "Indisponible";
              });
            }
            const appointment = document.createElement("div");
            appointment.className = "madic-service-workflow-block";
            const apHead = document.createElement("strong");
            apHead.textContent = "Rendez-vous";
            const apState = stateLine("État du client", "Aucune demande");
            const slotState = stateLine(
              "Créneaux du cabinet",
              "Aucun disponible",
            );
            if (appointmentError) {
              apState.badge.textContent = "Indisponible";
              slotState.badge.textContent = "Indisponible";
            } else if (appointmentData) {
              const states =
                appointmentData.perClient.get(item.client_id) || [];
              if (states.includes("confirmed")) {
                apState.badge.textContent = "Confirmé";
                apState.badge.className =
                  "madic-service-state madic-service-state-success";
              } else if (states.includes("requested")) {
                apState.badge.textContent = "Demande reçue";
                apState.badge.className =
                  "madic-service-state madic-service-state-pending";
              } else if (states.includes("declined"))
                apState.badge.textContent = "Dernière demande refusée";
              else if (states.includes("cancelled"))
                apState.badge.textContent = "Demande annulée";
              if (appointmentData.available) {
                slotState.badge.textContent =
                  appointmentData.available + " disponible(s)";
                slotState.badge.className =
                  "madic-service-state madic-service-state-info";
              }
            }
            const apNote = document.createElement("p");
            apNote.className = "madic-service-workflow-note";
            apNote.textContent =
              "Les créneaux publiés sont accessibles aux clients du cabinet; ils ne constituent pas une proposition individuelle ni une réservation confirmée.";
            const apLink = document.createElement("a");
            apLink.href = "rendez-vous-cric.html";
            apLink.textContent = "Gérer les disponibilités →";
            appointment.append(
              apHead,
              apState.line,
              slotState.line,
              apNote,
              apLink,
            );
            workflow.append(appointment);
            // Reporter les statuts des blocs detailles dans la ligne compacte.
            mirrorState(contractState.badge, summaryContract, true);
            mirrorState(apState.badge, summaryAppointment);
          }
          const save = document.createElement("button");
          save.type = "button";
          save.className = "secondary";
          save.textContent = "Enregistrer le statut";
          save.addEventListener("click", async () => {
            save.disabled = true;
            select.disabled = true;
            try {
              const { error } = await db.rpc("madic_service_set_status", {
                p_space_id: spaceId,
                p_client_id: item.client_id,
                p_status: select.value,
              });
              if (error) throw error;
              await loadAfterSave();
            } catch (err) {
              notice.textContent = "Modification impossible : " + err.message;
            } finally {
              save.disabled = false;
              select.disabled = false;
            }
          });
          actions.append(select, save);
          expandedBody.append(actions, workflow);
          article.append(expanded);
          list.append(article);
          applyRequestFilters();
        }
      } catch (err) {
        notice.textContent = "Demandes indisponibles : " + err.message;
      } finally {
        busy = false;
        refresh.disabled = false;
      }
    }
    async function loadAfterSave() {
      busy = false;
      await load();
    }
    refresh.addEventListener("click", () => void load());
    // L'authentification et la permission CRIC restent controlees par la RPC SQL.
    try {
      const { data: spaces, error } = await db
        .from("madic_cric_spaces")
        .select("id,access_status")
        .eq("owner_user_id", user.id)
        .eq("access_status", "active")
        .limit(1);
      if (error) throw error;
      if (spaces?.length) {
        spaceId = spaces[0].id;
        cricPanel.hidden = false;
        await load();
      }
    } catch (err) {
      console.warn("MADIC services:", err.message);
    }
    window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    window.addEventListener("focus", () => void load());
  }
  const journey = $("madicJourneyPanel");
  if (journey) {
    const notice = $("madicJourneyStatus"),
      steps = $("madicJourneySteps"),
      stage = $("madicJourneyStage"),
      link = $("madicJourneyLink");
    const phases = ["Formulaire", "Demande", "Analyse", "Réponse"];
    async function update() {
      const cabinet = $("cabinet");
      const spaceId = cabinet?.value;
      if (!spaceId) return;
      journey.hidden = false;
      try {
        const { data: intake, error: intakeError } = await db
          .from("madic_client_intake")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (intakeError) throw intakeError;
        const { data, error } = await db.rpc("madic_service_my_progress", {
          p_space_id: spaceId,
        });
        if (error) throw error;
        const request = data?.[0];
        let active = 0;
        if (intake?.status === "submitted") active = 1;
        if (request)
          active =
            request.request_status === "received"
              ? 2
              : request.request_status === "reviewing"
                ? 3
                : 4;
        stage.textContent = `Étape ${active} sur 4`;
        steps.replaceChildren();
        phases.forEach((label, i) => {
          const el = document.createElement("div");
          el.className =
            "madic-journey-step" + (i < active ? " is-complete" : "");
          const bar = document.createElement("span");
          bar.className = "madic-journey-bar";
          const text = document.createElement("small");
          text.textContent = label;
          el.append(bar, text);
          steps.append(el);
        });
        notice.textContent = request
          ? `${services[request.service_type] || "Demande de service"} - ${labels[request.request_status] || "Reçue"}.`
          : intake?.status === "submitted"
            ? "Votre formulaire est soumis. Vous pouvez choisir votre prochaine étape."
            : "Complétez votre formulaire pour commencer votre parcours.";
        link.hidden = !!request || intake?.status !== "submitted";
        const workflow = $("madicJourneyWorkflow");
        if (workflow) {
          workflow.replaceChildren();
          if (
            ["consultation", "proposition"].includes(request?.service_type) &&
            ["reviewing", "responded", "closed"].includes(
              request.request_status,
            )
          ) {
            const contract = document.createElement("p");
            if (request.service_type === "proposition") {
              contract.textContent =
                "Contrat professionnel : en attente de transmission par votre consultant. La signature électronique n’est pas encore disponible.";
            } else {
              const { data: contracts, error: contractError } = await db
                .from("madic_initial_contracts")
                .select("id,status")
                .eq("client_id", user.id)
                .in("status", ["publie", "signe"])
                .order("created_at", { ascending: false })
                .limit(1);
              if (contractError) {
                contract.textContent =
                  "Contrat : état momentanément indisponible.";
              } else if (contracts?.length) {
                const c = contracts[0];
                contract.textContent =
                  c.status === "signe"
                    ? "Contrat initial signé. "
                    : "Votre contrat initial est disponible pour signature. ";
                const a = document.createElement("a");
                a.href =
                  "contrat-initial-client.html?id=" + encodeURIComponent(c.id);
                a.textContent = "Consulter mon contrat →";
                contract.append(a);
              } else {
                contract.textContent =
                  "Contrat initial : en attente de transmission par votre consultant.";
              }
            }
            workflow.append(contract);
            const ap = document.createElement("p");
            ap.textContent =
              "Vous pouvez consulter les créneaux publiés par votre consultant et demander un rendez-vous. ";
            const a = document.createElement("a");
            a.href = "mes-rendez-vous-cric.html";
            a.textContent = "Voir les disponibilités →";
            ap.append(a);
            workflow.append(ap);
          }
        }
      } catch (err) {
        notice.textContent =
          "Suivi momentanément indisponible : " + err.message;
      }
    }
    $("cabinet")?.addEventListener("change", () => void update());
    // Le script historique peuple la liste des cabinets apres authentification.
    const wait = setInterval(() => {
      if ($("cabinet")?.value) {
        clearInterval(wait);
        void update();
      }
    }, 300);
    setTimeout(() => clearInterval(wait), 12000);
    window.setInterval(() => {
      if (!document.hidden) void update();
    }, 30000);
    window.addEventListener("focus", () => void update());
  }
})();
