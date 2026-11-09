/* MADIC - Renseignements issus du formulaire preliminaire, sans stockage local. */
window.MADIC_CONTRAT_PREFILL = (() => {
  const pick = (obj, keys) => {
    for (const key of keys) {
      const v = obj?.[key];
      if (v !== undefined && v !== null && String(v).trim())
        return String(v).trim();
    }
    return "";
  };
  const from = (answers = {}, profile = {}) => {
    const a = answers && typeof answers === "object" ? answers : {},
      p = profile || {};
    const field = (ak, pk) => pick(a, ak) || pick(p, pk);
    const directAddress = field(
      ["adresse", "adresse_complete", "address", "full_address"],
      ["address", "full_address"],
    );
    const street = [
      field(["no_rue", "numero_rue"], ["address_number"]),
      field(["rue", "nom_rue", "address_street"], ["address_street", "street"]),
    ]
      .filter(Boolean)
      .join(" ");
    const apartment = field(
      ["no_appart", "appartement"],
      ["address_apartment"],
    );
    const address = [
      apartment ? `App./unité ${apartment}` : "",
      street,
      field(["ville"], ["address_city"]),
      field(["province"], ["address_region"]),
      field(["code_postale"], ["address_postal_code"]),
      field(["pays"], ["country"]),
    ]
      .filter(Boolean)
      .join(", ");
    const temporary = field(["residence_temporaire"], []),
      permanent = field(["residence_permanente"], []);
    const project = [
      temporary !== "aucun" ? temporary : "",
      permanent !== "aucun" ? permanent : "",
    ]
      .filter(Boolean)
      .join(" / ")
      .replaceAll("_", " ");
    return {
      nom: field(["nom"], ["last_name", "nom", "family_name", "surname"]),
      prenom: field(["prenom"], ["first_name", "prenom", "given_name"]),
      courriel: field(["courriel", "email"], ["email", "courriel"]),
      telephone: field(
        ["telephone", "phone", "numero_telephone"],
        ["phone", "telephone"],
      ),
      naissance: field(
        ["date_naissance", "naissance", "birth_date"],
        ["date_of_birth", "birth_date", "dob"],
      ).slice(0, 10),
      adresse: directAddress || address,
      lieu:
        field(["lieu_signature", "ville_signature"], []) ||
        field(["ville"], ["address_city"]),
      objet: project,
    };
  };
  async function load(db, userId, profile = {}) {
    if (!userId)
      return {
        values: from({}, profile),
        intake: false,
        error: "Client non identifié",
      };
    const { data, error } = await db
      .from("madic_client_intake")
      .select("answers,status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      return { values: from({}, profile), intake: false, error: error.message };
    let answers = data?.answers || {};
    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch (_) {
        answers = {};
      }
    }
    if (Array.isArray(answers))
      answers = Object.fromEntries(
        answers.filter((x) => x && x.name).map((x) => [x.name, x.value]),
      );
    if (
      answers &&
      typeof answers === "object" &&
      answers.answers &&
      typeof answers.answers === "object"
    )
      answers = answers.answers;
    return {
      values: from(answers, profile),
      intake: !!data?.answers,
      submitted: data?.status === "submitted",
    };
  }
  async function loadTariff(db, userId) {
    const { data, error } = await db
      .from("madic_initial_service_requests")
      .select("service_type,tariff_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.service_type !== "consultation") return null;
    const options = {
      hourly: {
        amount: 159,
        label: "À taux horaire - 159 $ US/heure",
        type: "horaire",
      },
      single: {
        amount: 599,
        label: "À taux forfaitaire - Personne célibataire : 599 $ US",
        type: "forfaitaire",
      },
      couple: {
        amount: 749,
        label: "À taux forfaitaire - Couple : 749 $ US",
        type: "forfaitaire",
      },
    };
    return options[data.tariff_code]
      ? {
          code: data.tariff_code,
          ...options[data.tariff_code],
          currency: "USD",
        }
      : null;
  }
  return { load, from, loadTariff };
})();
