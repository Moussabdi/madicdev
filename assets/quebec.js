"use strict";
const $ = (id) => document.getElementById(id),
  v = (id) => $(id).value,
  n = (id) => (v(id) === "" ? null : Number(v(id)));
const fmt = (x) => (x === null ? "non renseigné" : String(x));
const line = (s) => `<li>${s}</li>`;
function card(title, status, items) {
  return `<article class="result-card"><h3>${title}</h3><div class="status ${status === "Conditions principales satisfaites" ? "good" : status === "Critère bloquant identifié" ? "bad" : "warn"}">${status}</div><ul>${items.map(line).join("")}</ul></article>`;
}
function verdict(items) {
  return items.some((x) => x.startsWith("NON :"))
    ? "Critère bloquant identifié"
    : items.some((x) => x.startsWith("À vérifier :"))
      ? "Vérification nécessaire"
      : "Conditions principales satisfaites";
}
const yes = (cond, label) => `${cond ? "OK" : "NON"} : ${label}`;
const check = (cond, label, known = true) =>
  known ? yes(cond, label) : `À vérifier : ${label}`;
function common() {
  const a = [];
  a.push(check(n("age") >= 18, "Âge minimal de 18 ans", n("age") !== null));
  a.push(
    check(
      v("intent") === "yes",
      "Intention de s’établir au Québec",
      v("intent") !== "",
    ),
  );
  a.push(
    check(
      v("excluded") === "no",
      "Emploi non exclu et sans contrôle de l’entreprise",
      v("excluded") !== "" && v("excluded") !== "unknown",
    ),
  );
  a.push(
    check(
      v("finance") === "yes",
      "Autonomie financière pour trois mois",
      v("finance") !== "" && v("finance") !== "unknown",
    ),
  );
  a.push(
    check(
      v("scholarship") !== "unmet",
      "Conditions de retour liées à une bourse respectées",
      v("scholarship") !== "",
    ),
  );
  if (v("spouse") === "yes")
    a.push(
      check(
        (n("spouseListen") ?? n("spouseFrench")) >= 4 &&
          (n("spouseSpeak") ?? n("spouseFrench")) >= 4,
        "Français oral du conjoint accompagnant : niveau 4 minimum",
        (n("spouseListen") !== null && n("spouseSpeak") !== null) ||
          n("spouseFrench") !== null,
      ),
    );
  a.push(
    "À vérifier : Attestation des valeurs québécoises et critères d’invitation, selon le programme.",
  );
  return a;
}
function lang(oral, written) {
  const a = [];
  a.push(
    check(
      n("oralListen") >= oral && n("oralSpeak") >= oral,
      `Français oral : niveau ${oral} minimum dans les deux compétences`,
      n("oralListen") !== null && n("oralSpeak") !== null,
    ),
  );
  if (written !== null)
    a.push(
      check(
        n("writtenRead") >= written && n("writtenWrite") >= written,
        `Français écrit : niveau ${written} minimum dans les deux compétences`,
        n("writtenRead") !== null && n("writtenWrite") !== null,
      ),
    );
  a.push("À vérifier : preuves linguistiques acceptées par le MIFI.");
  return a;
}
function degree1() {
  const d = v("degree"),
    place = v("degreeplace");
  const higher = ["bachelor", "master", "doctorate"].includes(d),
    other = ["vocational", "college"].includes(d);
  if (place === "qc")
    return higher
      ? n("credits") !== null && n("credits") >= 30
      : other
        ? n("hours") !== null && n("hours") >= 900
        : false;
  return (
    ["vocational", "college", "bachelor", "master", "doctorate"].includes(d) &&
    v("fulltime") === "yes"
  );
}
function degree2() {
  const d = v("degree"),
    place = v("degreeplace");
  if (place === "qc")
    return ["bachelor", "master", "doctorate"].includes(d)
      ? n("credits") >= 30
      : d === "college"
        ? n("hours") >= 900
        : d === "vocational"
          ? n("hours") >= 600
          : d === "secondary";
  return (
    d === "secondary" ||
    (["vocational", "college", "bachelor", "master", "doctorate"].includes(d) &&
      v("fulltime") === "yes")
  );
}
function render(scroll = true) {
  let out = "";
  const c = common(),
    noc = v("noc"),
    teer = /^\d[0-5]\d{3}$/.test(noc) ? Number(noc[1]) : null,
    reg = v("regulated");
  out += card("Exigences générales", verdict(c), c);
  if (teer === null)
    out += card("Profession principale", "Vérification nécessaire", [
      "À vérifier : saisissez un code CNP à cinq chiffres pour déterminer la catégorie FEER et orienter le PSTQ.",
    ]);
  else {
    const route = reg === "yes" ? 3 : reg === "no" ? (teer <= 2 ? 1 : 2) : null;
    let a = [];
    if (route === 1) {
      a = [
        check(
          n("work") >= 12,
          "Au moins 12 mois d’expérience dans la profession principale sur cinq ans",
          n("work") !== null,
        ),
        check(
          degree1(),
          "Diplôme professionnel/postsecondaire admissible et durée minimale",
          v("degree") !== "" && v("degreeplace") !== "",
        ),
        ...lang(7, 5),
      ];
      out += card(
        "PSTQ - Volet 1 : Haute qualification et compétences spécialisées",
        verdict(a),
        a,
      );
    } else if (route === 2) {
      a = [
        check(
          n("work") >= 24 && n("qcwork") >= 12,
          "24 mois d’expérience, dont au moins 12 mois au Québec",
          n("work") !== null && n("qcwork") !== null,
        ),
        check(
          degree2(),
          "Diplôme minimal et durée requise",
          v("degree") !== "" && v("degreeplace") !== "",
        ),
        ...lang(5, null),
      ];
      out += card(
        "PSTQ - Volet 2 : Compétences intermédiaires et manuelles",
        verdict(a),
        a,
      );
    } else if (route === 3) {
      a = [
        check(
          ["authorized", "equivalence"].includes(v("recognition")),
          "Autorisation d’exercice ou reconnaissance d’équivalence recevable",
          v("recognition") !== "",
        ),
        ...lang(teer <= 2 ? 7 : 5, teer <= 2 ? 5 : null),
        "À vérifier : inscription de l’emploi précis dans la liste MIFI des professions réglementées.",
      ];
      out += card("PSTQ - Volet 3 : Professions réglementées", verdict(a), a);
    } else
      out += card("PSTQ - Volet à confirmer", "Vérification nécessaire", [
        "À vérifier : statut réglementé de l’emploi précis; les professions partiellement réglementées nécessitent une vérification particulière.",
      ]);
    out += card(
      "PSTQ - Volet 4 : Talents d’exception",
      verdict([
        check(
          n("work") >= 36,
          "Au moins trois ans d’exercice de la profession principale sur cinq ans",
          n("work") !== null,
        ),
        check(
          v("exception") === "yes",
          "Accomplissement reconnu ou avis d’un partenaire du Ministère",
          v("exception") !== "" && v("exception") !== "unknown",
        ),
        "À vérifier : expertise exceptionnelle et documents reconnus par le MIFI.",
      ]),
      [
        check(
          n("work") >= 36,
          "Au moins trois ans d’exercice de la profession principale sur cinq ans",
          n("work") !== null,
        ),
        check(
          v("exception") === "yes",
          "Accomplissement reconnu ou avis d’un partenaire du Ministère",
          v("exception") !== "" && v("exception") !== "unknown",
        ),
        "À vérifier : expertise exceptionnelle et documents reconnus par le MIFI.",
      ],
    );
  }
  const cutoff = "2025-11-19";
  const windowMsg =
    "À vérifier : Le MIFI indique que la période de réception du PEQ est fermée depuis le 31 octobre 2026. Vérifier l’état du programme avant toute démarche.";
  if (["graduate", "both"].includes(v("peqtype"))) {
    const eligibleDegree =
      ["bachelor", "master", "doctorate"].includes(v("degree")) ||
      v("degree") === "college" ||
      (v("degree") === "vocational" && n("hours") >= 1800);
    const g = v("graduation");
    const monthsAgo = g
      ? ((Date.now() - new Date(g).getTime()) / (365.25 * 24 * 3600 * 1000)) *
        12
      : null;
    const a = [
      windowMsg,
      check(
        v("gradCutoff") === "yes" && g !== "" && g <= cutoff,
        "Diplôme admissible obtenu au plus tard le 19 novembre 2025",
        v("gradCutoff") !== "" && g !== "",
      ),
      check(
        eligibleDegree && v("degreeplace") === "qc",
        "Type de diplôme québécois admissible (DEP/ASP : au moins 1 800 h)",
        v("degree") !== "" && v("degreeplace") !== "",
      ),
      check(
        monthsAgo !== null && monthsAgo >= 0 && monthsAgo <= 36,
        "Diplôme obtenu dans les 36 derniers mois",
        g !== "",
      ),
      check(
        v("fulltime") === "yes" && v("half") === "yes",
        "Études à temps plein et au moins la moitié du programme au Québec",
        v("fulltime") !== "" && v("half") !== "",
      ),
      check(
        v("residence") === "qc" && v("status") === "valid",
        "Présence légale au Québec au dépôt",
        v("residence") !== "" && v("status") !== "",
      ),
      ...lang(7, 5),
    ];
    out += card("PEQ - Diplômés du Québec", verdict(a), a);
  }
  if (["worker", "both"].includes(v("peqtype"))) {
    const a = [
      windowMsg,
      check(
        teer !== null && teer <= 3,
        "Profession FEER 0, 1, 2 ou 3",
        teer !== null,
      ),
      check(
        n("peqwork") >= 24,
        "Au moins deux ans de travail admissible au Québec acquis au 19 novembre 2025",
        n("peqwork") !== null,
      ),
      "À vérifier : conditions spécifiques complètes du volet Travailleurs étrangers temporaires, statut, emploi et français à la date du dépôt.",
    ];
    out += card("PEQ - Travailleurs étrangers temporaires", verdict(a), a);
  }
  const pilots = [
    "Transformation alimentaire",
    "Préposés aux bénéficiaires",
    "IA / TI / effets visuels",
  ];
  out += card(
    "Programmes pilotes - fermés aux nouvelles demandes",
    "Vérification nécessaire",
    [
      `Les trois programmes pilotes (${pilots.join(", ")}) ont pris fin le 1er janvier 2026.`,
      v("pilot") === "none"
        ? "Aucun dossier antérieur déclaré."
        : v("pilot") === ""
          ? "À vérifier : avez-vous déposé une demande avant la fermeture ?"
          : "Vous indiquez un dépôt antérieur : la demande peut continuer à être examinée si elle a été présentée avant le 1er janvier 2026.",
      "Un dossier antérieur n’équivaut pas à une sélection ou à un CSQ.",
    ],
  );
  out += card("Prochaine étape", "Vérification nécessaire", [
    "Déterminer officiellement le volet PSTQ associé à la profession principale dans la liste CNP du MIFI.",
    "Comparer les critères d’invitation publiés et, s’il y a lieu, soumettre ou actualiser une déclaration d’intérêt dans Arrima.",
    "Conserver les preuves de diplôme, d’expérience, de langue, de statut et de liens familiaux.",
    "La grille de points de l’ancien PRTQ ne doit pas être utilisée comme calculateur du PSTQ.",
  ]);
  $("resultContent").innerHTML = out;
  $("results").hidden = false;
  if (scroll)
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("assessment").addEventListener("submit", (e) => {
  e.preventDefault();
  render();
});
$("assessment").addEventListener("reset", () => {
  assessmentClientName = "";
  assessmentProfileProject = "";
  $("results").hidden = true;
});
function spouseToggle() {
  const show = v("spouse") === "yes";
  $("spouseRow").style.display = show ? "flex" : "none";
  $("spouse-details").hidden = !show;
}
$("spouse").addEventListener("change", spouseToggle);
spouseToggle();

// Complément d'évaluation intégré : aucune page distincte par programme.
function escapeQc(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function pstqSummary() {
  const fields = [
    ["workTotal", "Expérience professionnelle totale (5 ans)", " mois"],
    ["workQcTotal", "Expérience professionnelle au Québec (5 ans)", " mois"],
    ["labourDiagnosis", "Diagnostic de main-d’œuvre", ""],
    ["qcStudyStatus", "Études au Québec sans diplôme", ""],
    ["qcStudyMonths", "Durée des études sans diplôme", " mois"],
    ["outsideCmm", "Résidence hors CMM", ""],
    ["outsideResidenceMonths", "Durée de résidence hors CMM", " mois"],
    ["outsideWorkMonths", "Expérience hors CMM", " mois"],
    ["outsideStudyMonths", "Études hors CMM", " mois"],
    ["regionalFamily", "Famille dans la région envisagée", ""],
    ["validatedOffer", "Offre d’emploi validée", ""],
  ];
  const translations = {
    yes: "Oui",
    no: "Non",
    na: "Sans objet",
    none: "Aucun",
    ongoing: "En cours",
    completed: "Terminées sans diplôme",
    shortage: "Déficit",
    balance: "Équilibre",
    surplus: "Surplus",
    slightShortage: "Léger déficit de main-d’œuvre",
    noDiagnosis: "Aucun diagnostic officiel",
    unknown: "À vérifier",
    cmm: "Dans la CMM",
    outside: "Hors CMM",
  };
  const rows = fields
    .filter(([id]) => v(id) !== "")
    .map(
      ([id, label, unit]) =>
        `<li><strong>${escapeQc(label)} :</strong> ${escapeQc(translations[v(id)] || v(id))}${unit}</li>`,
    );
  if (v("spouse") === "yes") {
    const sp = [
      ["spouseAge", "Âge du conjoint"],
      ["spouseDegree", "Scolarité du conjoint"],
      ["spouseQcDegree", "Diplôme québécois du conjoint"],
      ["spouseQcWork", "Expérience québécoise du conjoint (mois)"],
      ["spouseListen", "Compréhension orale du conjoint"],
      ["spouseSpeak", "Expression orale du conjoint"],
      ["spouseRead", "Compréhension écrite du conjoint"],
      ["spouseWrite", "Expression écrite du conjoint"],
    ];
    sp.filter(([id]) => v(id) !== "").forEach(([id, label]) =>
      rows.push(
        `<li><strong>${escapeQc(label)} :</strong> ${escapeQc(translations[v(id)] || v(id))}</li>`,
      ),
    );
  }
  const checks = [];
  if (
    n("workTotal") !== null &&
    n("workQcTotal") !== null &&
    n("workQcTotal") > n("workTotal")
  )
    checks.push(
      "L’expérience totale au Québec ne peut dépasser l’expérience totale déclarée.",
    );
  if (
    n("workTotal") !== null &&
    n("work") !== null &&
    n("work") > n("workTotal")
  )
    checks.push(
      "L’expérience dans la profession principale ne peut dépasser l’expérience totale déclarée.",
    );
  if (n("work") !== null && n("qcwork") !== null && n("qcwork") > n("work"))
    checks.push(
      "L’expérience dans la profession principale au Québec ne peut dépasser celle dans la profession principale.",
    );
  const spouseFields = [
    "spouseAge",
    "spouseDegree",
    "spouseQcDegree",
    "spouseQcWork",
    "spouseListen",
    "spouseSpeak",
    "spouseRead",
    "spouseWrite",
  ];
  if (v("spouse") === "yes" && spouseFields.some((id) => v(id) === ""))
    checks.push(
      "Le profil du conjoint est incomplet : le pointage avec conjoint ne peut être estimé précisément.",
    );
  const message =
    "Le pointage Arrima complet doit être établi séparément. Consultez le barème du MIFI pour les facteurs qui ne sont pas chiffrés dans ce rapport.";
  return `<article class="result-card"><h3>PSTQ - Analyse complémentaire du profil</h3><p>${message}</p>${rows.length ? `<ul>${rows.join("")}</ul>` : "<p>Complétez les critères complémentaires pour affiner votre profil.</p>"}${checks.length ? `<p class="bad"><strong>Incohérences ou renseignements manquants :</strong></p><ul>${checks.map((x) => `<li>${escapeQc(x)}</li>`).join("")}</ul>` : ""}<p class="hint">Le diagnostic de main-d’œuvre, la profession réglementée, les liens régionaux et l’OEV nécessitent une validation documentaire.</p></article>`;
}
// Barème MIFI, sections Capital humain et Réponse aux besoins du Québec.
const arrimaPointGrid =
  "https://cdn-contenu.quebec.ca/cdn-contenu/immigration/publications/fr/Pointage_criteres.pdf";
const arrimaInvitations =
  "https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-selection-travailleurs-qualifies/invitation/2026";
const quebecSelection =
  "https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-selection-travailleurs-qualifies/presenter-demande";
const federalResidence =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/travailleurs-qualifies-quebec.html";

function statedNumber(id, min, max) {
  const value = n(id);
  return value !== null && value >= min && value <= max ? value : null;
}

function arrimaFactors() {
  const spouse = v("spouse");
  const accompanied = spouse === "yes";
  const knownFamily = accompanied || spouse === "no";
  const column = accompanied ? 1 : 0;
  const age = statedNumber("age", 18, 110);
  const experience = statedNumber("workTotal", 0, 60);
  const primaryExperience = statedNumber("work", 0, 60);
  const quebecExperience = statedNumber("workQcTotal", 0, 60);
  const coherentExperience =
    experience === null ||
    ((primaryExperience === null || primaryExperience <= experience) &&
      (quebecExperience === null || quebecExperience <= experience));
  const levels = ["oralListen", "oralSpeak", "writtenRead", "writtenWrite"].map(
    (field) => statedNumber(field, 0, 12),
  );
  const frenchPoints = (level) => {
    if (level >= 9) return [50, 40][column];
    if (level >= 7) return [44, 35][column];
    if (level >= 5) return [38, 30][column];
    return 0;
  };
  const ageTable = [
    [110, 95],
    [100, 90],
    [90, 81],
    [80, 72],
    [75, 68],
    [70, 63],
    [65, 59],
    [60, 54],
    [55, 50],
    [50, 45],
    [40, 36],
    [30, 27],
    [20, 18],
    [10, 9],
  ];
  const agePoints =
    !knownFamily || age === null || !Number.isInteger(age)
      ? null
      : (age < 20
          ? [110, 90]
          : age <= 30
            ? [120, 100]
            : age <= 44
              ? ageTable[age - 31]
              : [0, 0])[column];
  const experienceBand = (months) => Math.min(4, Math.floor(months / 12));
  const diagnosisBands = {
    balance: [0, 5, 10, 15, 25],
    noDiagnosis: [0, 5, 10, 15, 25],
    slightShortage: [0, 70, 80, 90, 100],
    shortage: [0, 90, 100, 110, 120],
  };
  const diagnosis = diagnosisBands[v("labourDiagnosis")];
  const offerPoints = { none: 0, cmm: 30, outside: 50 };
  const qualifiedFrench =
    knownFamily &&
    levels.every((level) => level !== null && Number.isInteger(level));
  const frenchTotal = qualifiedFrench
    ? levels.reduce((sum, level) => sum + frenchPoints(level), 0)
    : null;
  const educationPoints = {
    none: [0, 0],
    secondary: [13, 11],
    vocational: [26, 22],
    general2: [39, 33],
    technical: [52, 44],
    technical3: [78, 66],
    undergrad1: [78, 66],
    undergrad2: [91, 77],
    undergrad34: [104, 88],
    undergrad5: [110, 93],
    grad1: [110, 93],
    grad2: [117, 99],
    medical: [130, 110],
    doctorate: [130, 110],
  };
  const rows = [
    [
      "Niveau de scolarité",
      knownFamily
        ? (educationPoints[v("arrimaEducation")]?.[column] ?? null)
        : null,
      knownFamily ? [130, 110][column] : null,
    ],
    ["Âge", agePoints, knownFamily ? [120, 100][column] : null],
    [
      "Français - quatre compétences",
      frenchTotal,
      knownFamily ? [200, 160][column] : null,
    ],
    [
      "Expérience de travail totale",
      knownFamily && coherentExperience && experience !== null
        ? [
            [0, 20, 40, 50, 70],
            [0, 15, 30, 35, 50],
          ][column][experienceBand(experience)]
        : null,
      knownFamily ? [70, 50][column] : null,
    ],
    [
      "Diagnostic de main-d’œuvre et expérience principale",
      coherentExperience && diagnosis && primaryExperience !== null
        ? diagnosis[experienceBand(primaryExperience)]
        : null,
      120,
    ],
    [
      "Expérience de travail au Québec",
      coherentExperience && quebecExperience !== null
        ? experienceBand(quebecExperience) * 40
        : null,
      160,
    ],
    ["Offre d’emploi validée", offerPoints[v("validatedOffer")] ?? null, 50],
  ];
  return {
    rows,
    frenchGain: frenchTotal === null ? null : [200, 160][column] - frenchTotal,
  };
}

function optionLabel(id) {
  const field = $(id);
  const option = field.selectedOptions?.[0];
  if (!option?.value) return "Non renseigné";
  return (textSources.get(option.firstChild) ?? option.textContent)
    .trim()
    .replace(/\s+/g, " ");
}

let assessmentClientName = "";
let assessmentProfileProject = "";
function assessmentReport() {
  const noc = v("noc");
  const validNoc = /^\d[0-5]\d{3}$/.test(noc);
  const teer = validNoc ? Number(noc[1]) : null;
  const regulated = v("regulated");
  const stream =
    regulated === "yes" && validNoc
      ? 3
      : regulated === "no" && validNoc
        ? teer <= 2
          ? 1
          : 2
        : null;
  const exceptional = v("exception") === "yes";
  const { rows, frenchGain } = arrimaFactors();
  const countedRows = rows.filter(([, points]) => points !== null);
  const subtotal = countedRows.length
    ? countedRows.reduce((sum, [, points]) => sum + points, 0)
    : null;
  const arrimaScore = statedNumber("arrimaScore", 0, 1400);
  const knownScore = arrimaScore !== null && Number.isInteger(arrimaScore);
  const display = (number) => number ?? "-";
  const lineItems = (items) => items.map((item) => `<li>${item}</li>`).join("");
  const risk = [];
  const actions = [];
  if (stream === null) {
    risk.push(
      "Le volet principal reste à confirmer à partir du code CNP et du caractère réglementé de l’emploi.",
    );
    actions.push(
      "Confirmer le code CNP d’après les tâches exercées, puis vérifier le volet dans la liste du MIFI.",
    );
  }
  if (v("intent") !== "yes")
    risk.push(
      "L’intention de s’établir au Québec reste à confirmer ou n’est pas déclarée.",
    );
  if (
    v("regulated") === "yes" &&
    !["authorized", "equivalence"].includes(v("recognition"))
  ) {
    risk.push(
      "Aucune autorisation d’exercice ou reconnaissance d’équivalence admissible n’est confirmée.",
    );
    actions.push(
      "Vérifier auprès de l’autorité québécoise compétente les documents et les démarches de reconnaissance.",
    );
  }
  const oralMin = stream === 1 || (stream === 3 && teer <= 2) ? 7 : 5;
  const writtenRequired = oralMin === 7;
  const oralFields = ["oralListen", "oralSpeak"];
  const writtenFields = ["writtenRead", "writtenWrite"];
  if (
    stream &&
    (oralFields.some((field) => (statedNumber(field, 0, 12) ?? -1) < oralMin) ||
      (writtenRequired &&
        writtenFields.some((field) => (statedNumber(field, 0, 12) ?? -1) < 5)))
  ) {
    risk.push(
      "Une ou plusieurs compétences en français sont sous le niveau exigé pour le volet envisagé, ou restent sans preuve suffisante.",
    );
    actions.push(
      "Prioriser les compétences en français sous le seuil et obtenir une preuve reconnue par le MIFI.",
    );
  }
  if (!v("degree") || v("degreeplace") === "elsewhere") {
    actions.push(
      "Documenter le diplôme et sa durée, puis confirmer le niveau comparable dans le système québécois.",
    );
  }
  if (!["cmm", "outside"].includes(v("validatedOffer"))) {
    actions.push(
      "Examiner la possibilité d’une offre validée dans la profession principale et vérifier la localisation de l’emploi.",
    );
  }
  if (
    !v("labourDiagnosis") ||
    ["unknown", "surplus"].includes(v("labourDiagnosis"))
  ) {
    actions.push(
      "Vérifier le diagnostic de main-d’œuvre officiel applicable au code CNP et documenter les périodes travaillées.",
    );
  }
  if (v("spouse") === "yes") {
    actions.push(
      "Confirmer les compétences de la personne conjointe et documenter ses études et son expérience au Québec.",
    );
  }
  if (!knownScore)
    risk.push(
      "Le pointage Arrima complet reste à confirmer avant de mesurer l’écart avec un exercice d’invitation.",
    );
  risk.push(
    "Le MIFI peut cibler une profession, un lieu de séjour ou d’autres critères propres à chaque exercice.",
  );
  actions.push(
    "Vérifier le détail des exercices d’invitation et préparer ou actualiser la déclaration d’intérêt dans Arrima.",
  );
  const invitationNote =
    stream === 1
      ? "<p>Les trois exercices ci-dessous visaient des CNP ciblés et des personnes qui séjournaient au Québec. Le tableau compare les points seulement. Il faut vérifier chaque critère de l’exercice.</p>"
      : "<p>Comparer exclusivement les exercices du volet applicable et leurs critères. La page du MIFI donne le détail des exercices par volet.</p>";
  const examples = [
    ["19 et 20 mars 2026 - exercice 2", 588],
    ["30 avril 2026 - exercice 2", 571],
    ["4 juin 2026 - exercice 3", 666],
  ];
  const invitationTable =
    stream === 1
      ? `<div class="report-table"><table>
    <thead><tr><th scope="col">Exercice historique - volet 1</th><th scope="col">Seuil publié</th><th scope="col">Écart au seuil</th></tr></thead>
    <tbody>${examples
      .map(([date, threshold]) => {
        const difference = arrimaScore - threshold;
        const delta = difference > 0 ? `+${difference}` : String(difference);
        return `<tr><th scope="row">${date}</th><td>${threshold}</td><td>${knownScore ? delta : "-"}</td></tr>`;
      })
      .join("")}</tbody>
    </table></div>`
      : "";
  return `
    <article class="result-card">
      <h3>Analyse du projet d’immigration au Québec</h3>
      <p>Brouillon d’analyse généré à partir des renseignements déclarés, à valider par le CRIC.</p>
      <dl class="report-profile">
        ${assessmentClientName ? `<div><dt data-fr="Client" data-en="Client">Client</dt><dd>${escapeQc(assessmentClientName)}</dd></div>` : ""}
        <div><dt>Lieu de résidence</dt><dd>${escapeQc(optionLabel("residence"))}</dd></div>
        <div><dt>Intention de s’établir au Québec</dt><dd>${escapeQc(optionLabel("intent"))}</dd></div>
        <div><dt>Code CNP</dt><dd>${validNoc ? noc : "Non renseigné ou invalide"}</dd></div>
        <div><dt>Catégorie FEER</dt><dd>${display(teer)}</dd></div>
        <div><dt>Diplôme déclaré</dt><dd>${escapeQc(optionLabel("degree"))}</dd></div>
        <div><dt>Volet PSTQ à examiner en priorité</dt><dd>${stream ? `<span>Volet</span> ${stream}` : "À confirmer"}</dd></div>
        ${assessmentProfileProject === "Travailleurs qualifiés sélectionnés par le Québec" ? `<div><dt>Projet indiqué dans le profil à la soumission</dt><dd>Travailleurs qualifiés sélectionnés par le Québec</dd></div>` : ""}
      </dl>
      ${exceptional ? "<p>Examiner aussi le volet 4 si les preuves d’accomplissement exceptionnel ou l’avis d’un partenaire sont recevables.</p>" : ""}
      <p>Le PSTQ comprend quatre volets. Le ministère détermine le volet applicable selon la profession principale et les renseignements déclarés.</p>
    </article>
    <article class="result-card">
      <h3>Pointage Arrima et facteurs évalués</h3>
      <p>Calcul indicatif à partir des données déclarées. Un tiret indique un facteur non chiffré. Le sous-total couvre seulement les facteurs calculés ci-dessous.</p>
      <div class="report-table"><table>
        <thead><tr><th scope="col">Facteur</th><th scope="col">Points indicatifs</th><th scope="col">Maximum du facteur</th></tr></thead>
        <tbody>${rows.map(([label, points, max]) => `<tr><th scope="row">${label}</th><td>${display(points)}</td><td>${display(max)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th scope="row">Sous-total partiel</th><td>${display(subtotal)}</td><td>-</td></tr>
        <tr><th scope="row">Pointage Arrima complet déclaré</th><td>${knownScore ? arrimaScore : "-"}</td><td>1 400</td></tr></tfoot>
      </table></div>
      <p>Le pointage officiel dépend notamment de la date d’extraction, des preuves linguistiques et des facteurs non chiffrés ici, dont le diplôme du Québec et les facteurs de la personne conjointe.</p>
      ${frenchGain > 0 ? `<p><span>Gain indicatif si les quatre compétences en français atteignent au moins le niveau 9</span> <strong>+${frenchGain}</strong> <span>points, sous réserve de preuves reconnues.</span></p>` : ""}
      <a href="${arrimaPointGrid}" target="_blank" rel="noopener">Consulter le barème officiel du MIFI</a>
    </article>
    <article class="result-card">
      <h3>Exercices d’invitation et risques</h3>
      ${invitationNote}${invitationTable}
      <p><a href="${arrimaInvitations}" target="_blank" rel="noopener">Consulter les invitations Arrima de 2026</a></p>
      <ul>${lineItems(risk)}</ul>
    </article>
    <article class="result-card">
      <h3>Recommandations et suite du dossier</h3>
      <ol>${lineItems(actions)}</ol>
      <p>Après une invitation dans Arrima, présenter la demande de sélection permanente au Québec. Une fois le CSQ obtenu, présenter la demande de résidence permanente à IRCC.</p>
      <p><a href="${quebecSelection}" target="_blank" rel="noopener">Sélection permanente au Québec, frais et procédure</a> ·
        <a href="${federalResidence}" target="_blank" rel="noopener">Résidence permanente, frais et procédure fédérale</a></p>
      <p><strong>Avis professionnel du CRIC</strong> · À compléter après vérification des renseignements, des pièces justificatives et des critères en vigueur.</p>
    </article>`;
}

const renderBase = render;
render = function (scroll = true) {
  renderBase(scroll);
  $("resultContent").insertAdjacentHTML("afterbegin", assessmentReport());
  $("resultContent").insertAdjacentHTML("beforeend", pstqSummary());
  localizeTree($("resultContent"));
};
function conditionalFields() {
  document.querySelectorAll("[data-show]").forEach((label) => {
    const [id, choices] = label.dataset.show.split(":");
    label.hidden = !choices.split(",").includes(v(id));
  });
}
["qcStudyStatus", "outsideCmm"].forEach((id) =>
  $(id).addEventListener("change", conditionalFields),
);
conditionalFields();
$("assessment").addEventListener("reset", () =>
  setTimeout(() => {
    spouseToggle();
    conditionalFields();
  }, 0),
);

/* Traductions françaises et anglaises de la page Québec. */
const englishLabels = new Map(
  Object.entries({
    "Situation et projet": "Situation and plans",
    "Profession et expérience": "Occupation and experience",
    "Formation et diplôme": "Education and qualifications",
    "Français et famille": "French language and family",
    "Critères complémentaires PSTQ - Québec":
      "Additional PSTQ criteria - Quebec",
    "Vérification du PEQ": "PEQ eligibility check",
    "Références gouvernementales": "Government references",
    Âge: "Age",
    "Où résidez-vous actuellement ?": "Where do you currently live?",
    "Statut légal au Québec, si vous y résidez":
      "Legal status in Quebec, if you live there",
    "Votre situation": "Your situation",
    "Déjà déposé une demande dans un ancien programme pilote avant le 1er janvier 2026 ?":
      "Have you applied under a former pilot program before January 1, 2026?",
    "Intention de vivre et travailler au Québec":
      "Intention to live and work in Quebec",
    "Emploi projeté dans un secteur inadmissible ou entreprise sous votre contrôle ?":
      "Planned employment in an ineligible sector or a business you control?",
    "Code CNP de la profession principale (5 chiffres)":
      "Primary occupation NOC code (5 digits)",
    "La profession est-elle réglementée au Québec ?":
      "Is the occupation regulated in Quebec?",
    "Reconnaissance par l’autorité de réglementation":
      "Recognition by the regulatory authority",
    "Expérience rémunérée dans la profession principale, 5 dernières années (mois équivalents temps plein)":
      "Paid experience in the primary occupation, past 5 years (full-time equivalent months)",
    "Dont expérience au Québec dans la profession principale (mois)":
      "Of which experience in Quebec in the primary occupation (months)",
    "Expérience de travail au Québec FEER 0–3 acquise au 19 novembre 2025 (mois)":
      "Quebec TEER 0–3 work experience acquired by November 19, 2025 (months)",
    "Accomplissements exceptionnels reconnus ou avis d’un partenaire du MIFI":
      "Recognized exceptional achievements or opinion from a MIFI partner",
    "Plus haut diplôme obtenu": "Highest qualification obtained",
    "Lieu du diplôme": "Location of qualification",
    "Durée du programme (heures, si applicable)":
      "Program duration (hours, if applicable)",
    "Durée du programme (crédits universitaires, si applicable)":
      "Program duration (university credits, if applicable)",
    "Programme à temps plein d’au moins un an":
      "Full-time program of at least one year",
    "Date d’obtention du diplôme": "Date qualification was awarded",
    "Au moins la moitié des études effectuée en séjournant au Québec pour étudier":
      "At least half of the studies completed while residing in Quebec to study",
    "Condition de retour au pays liée à une bourse":
      "Scholarship-related requirement to return home",
    "Compréhension orale (français)": "Listening comprehension (French)",
    "Expression orale (français)": "Speaking (French)",
    "Compréhension écrite (français)": "Reading comprehension (French)",
    "Expression écrite (français)": "Writing (French)",
    "Conjoint(e) accompagnant(e) ?": "Accompanying spouse or partner?",
    "Capacité financière pour les 3 premiers mois":
      "Financial capacity for the first 3 months",
    "Attestation des valeurs québécoises obtenue ou prévue":
      "Quebec values certificate obtained or planned",
    "Expérience professionnelle totale (mois)":
      "Total work experience (months)",
    "Expérience professionnelle totale au Québec (mois)":
      "Total work experience in Quebec (months)",
    "Diagnostic de main-d’œuvre de votre profession":
      "Labour market assessment for your occupation",
    "Études au Québec sans diplôme obtenu - situation":
      "Studies in Quebec without a qualification - status",
    "Résidez-vous actuellement hors de la CMM, au Québec ?":
      "Do you currently live outside Greater Montreal, in Quebec?",
    "Expérience professionnelle hors CMM (mois)":
      "Work experience outside Greater Montreal (months)",
    "Études les plus récentes hors CMM (mois)":
      "Most recent studies outside Greater Montreal (months)",
    "Famille admissible dans la région d’établissement envisagée hors CMM":
      "Eligible family in the intended settlement region outside Greater Montreal",
    "Offre d’emploi validée (OEV) dans la profession principale":
      "Validated job offer (VJO) in the primary occupation",
    "Volet à examiner": "Stream to assess",
    "Le diplôme admissible était-il obtenu au 19 novembre 2025 ?":
      "Was the eligible qualification obtained by November 19, 2025?",
    "Emploi visé conforme aux conditions générales du PEQ":
      "Target occupation meets the general PEQ conditions",
    "Sélectionner…": "Select…",
    "Sélectionner...": "Select…",
    "À déterminer…": "To be determined…",
    Messagerie: "Messaging",
    Documents: "Documents",
    Échéances: "Deadlines",
    Facturation: "Billing",
    "Outils CRIC": "RCIC tools",
    "PSTQ-Exigences générales et spécifiques":
      "PSTQ - General and specific requirements",
    "PSTQ-Déclaration d'intérêt Arrima": "PSTQ - Arrima expression of interest",
    "PSTQ-Critères d'invitation": "PSTQ - Invitation criteria",
    "PEQ-Diplômés du Québec": "PEQ - Quebec graduates",
    "PEQ-Travailleurs étrangers temporaires": "PEQ - Temporary foreign workers",
    "Pilote Transformation alimentaire": "Food processing pilot",
    "Pilote IA / TI / effets visuels": "AI / IT / visual effects pilot",
    "ÉVALUATION PRÉLIMINAIRE • QUÉBEC • 2026":
      "PRELIMINARY ASSESSMENT • QUEBEC • 2026",
    "Quels parcours d'immigration permanente au Québec correspondent à votre profil ?":
      "Which Quebec permanent immigration pathways match your profile?",
    "Évaluer mon profil": "Assess my profile",
    Réinitialiser: "Reset",
    Déconnexion: "Sign out",
    "Mon espace": "My space",
    "Vue d’ensemble": "Overview",
    Clients: "Clients",
    Dossiers: "Cases",
    "Rendez-vous": "Appointments",
    Finances: "Finance",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    NAVIGATION: "NAVIGATION",
    "Espace professionnel": "Professional workspace",
    "Tous droits réservés.": "All rights reserved.",
    "Une plateforme numérique pour les professionnels de l’immigration canadienne et leurs clients.":
      "A digital platform for Canadian immigration professionals and their clients.",
    "Une plateforme numérique pour les professionnels de l'immigration canadienne et leurs clients.":
      "A digital platform for Canadian immigration professionals and their clients.",
    Accueil: "Home",
    Confidentialité: "Privacy policy",
    "Conditions d'utilisation": "Terms of use",
    "MADIC PORTAIL": "MADIC PORTAL",
    PORTAIL: "PORTAL",
    "Un outil d'orientation indépendant, fondé sur les renseignements gouvernementaux fournis. Il ne remplace ni Arrima, ni une décision du MIFI, ni une consultation professionnelle.":
      "An independent guidance tool based on the government information provided. It is no substitute for Arrima, an MIFI decision or professional advice.",
    "État des programmes en 2026.": "Program status in 2026.",
    "Les programmes pilotes Transformation alimentaire, Préposés aux bénéficiaires et IA/TI–effets visuels sont fermés aux nouvelles demandes depuis le 1er janvier 2026. Le PEQ fait l'objet d'une réouverture temporaire et d'une fenêtre de réception du 2 juillet au 31 octobre 2026, selon l'avis fourni.":
      "The Food Processing, Orderlies and AI/IT–Visual Effects pilots have been closed to new applications since January 1, 2026. According to the notice provided, the PEQ reopened temporarily with an application intake period from July 2 to October 31, 2026.",
    "Remplissez votre profil une seule fois : les parcours sont analysés ensemble.":
      "Fill in your profile once to assess all pathways together.",
    "Au Québec": "In Quebec",
    "Ailleurs au Canada": "Elsewhere in Canada",
    "À l'étranger": "Outside Canada",
    "Statut légal valide": "Valid legal status",
    "Aucun statut légal": "No legal status",
    "Sans objet": "Not applicable",
    "Travailleur / travailleuse": "Worker",
    "Diplômé(e) du Québec": "Quebec graduate",
    "Étudiant(e)": "Student",
    Autre: "Other",
    Non: "No",
    "Transformation alimentaire": "Food processing",
    "Préposés aux bénéficiaires": "Orderlies",
    "IA / TI / effets visuels": "AI / IT / visual effects",
    Oui: "Yes",
    "À vérifier": "To be verified",
    "Oui, mon emploi exige une autorisation":
      "Yes, my occupation requires authorization",
    "Je ne sais pas": "I don't know",
    "Reconnaissance par l'autorité de réglementation":
      "Recognition by the regulatory authority",
    "Autorisation d'exercice": "Authorization to practise",
    "Reconnaissance partielle ou complète datant d'au plus 5 ans":
      "Partial or full recognition issued within the past 5 years",
    "Demande en cours / aucun document":
      "Application in progress / no documentation",
    "Accomplissements exceptionnels reconnus ou avis d'un partenaire du MIFI":
      "Recognized exceptional achievements or an opinion from an MIFI partner",
    "La catégorie FEER est déduite du deuxième chiffre du code CNP. Le volet applicable dépend aussi de la profession et des règles du MIFI.":
      "The TEER category is determined by the second digit of the NOC code. The applicable stream also depends on the occupation and MIFI rules.",
    "Aucun diplôme": "No qualification",
    "Secondaire (DES ou équivalent)": "Secondary school diploma or equivalent",
    "DEP / ASP": "DVS / AVS (DEP / ASP)",
    "AEC / DEC": "ACS / DCS (AEC / DEC)",
    Baccalauréat: "Bachelor's degree",
    "Maîtrise / MBA": "Master's degree / MBA",
    Doctorat: "Doctorate",
    Québec: "Quebec",
    "Hors Québec": "Outside Quebec",
    "Programme à temps plein d'au moins un an":
      "Full-time program of at least one year",
    "Date d'obtention du diplôme": "Date qualification was awarded",
    "Aucune / déjà respectée": "None / already met",
    "Oui, non respectée": "Yes, requirement not met",
    "Saisissez les niveaux selon l'Échelle québécoise (0 à 12), et non directement les notes brutes d'un examen. Les preuves linguistiques doivent être vérifiées.":
      "Enter levels on the Quebec scale (0 to 12). Convert raw test scores first. Language evidence must be verified.",
    "Niveau oral minimal du conjoint (plus faible des deux compétences)":
      "Minimum oral French level of the accompanying spouse or partner (lower of the two skills)",
    "Oui, selon le barème applicable":
      "Yes, according to the applicable financial scale",
    "À confirmer": "To be confirmed",
    "Oui / démarche prévue": "Yes / planned",
    "Ces renseignements complètent l’évaluation unique et reprennent les rubriques des formulaires MIFI ME-0104-2608 et ME-0120-2608. Les mois d’expérience portent sur les cinq dernières années.":
      "This information supplements the assessment and follows the sections of MIFI forms ME-0104-2608 and ME-0120-2608. Work experience is measured over the past five years.",
    "Déficit de main-d’œuvre": "Labour shortage",
    Équilibre: "Balance",
    "Inconnu / à confirmer": "Unknown / to be confirmed",
    Aucune: "None",
    "Études en cours": "Studies in progress",
    "Séjour d’études terminé sans diplôme":
      "Period of study completed without a qualification",
    "Durée des études au Québec sans diplôme (mois)":
      "Duration of studies in Quebec without a qualification (months)",
    "Je ne réside pas au Québec": "I do not live in Quebec",
    "Résidence hors CMM (mois)":
      "Residence outside the Montréal Metropolitan Community (months)",
    "Dans la CMM": "Within the Montréal Metropolitan Community",
    "Hors CMM": "Outside the Montréal Metropolitan Community",
    "Conjoint accompagnant - détails PSTQ":
      "Accompanying spouse or partner - PSTQ details",
    "Les quatre compétences de français sont évaluées séparément selon l’Échelle québécoise (0 à 12).":
      "The four French language skills are assessed separately on the Quebec scale (0 to 12).",
    "Âge du conjoint": "Age of spouse or partner",
    "Plus haut diplôme du conjoint":
      "Highest qualification of spouse or partner",
    Aucun: "None",
    Secondaire: "Secondary school",
    Professionnel: "Vocational",
    Collégial: "College",
    Maîtrise: "Master's degree",
    "Diplôme québécois du conjoint":
      "Quebec qualification of spouse or partner",
    "Expérience professionnelle du conjoint au Québec, cinq dernières années (mois)":
      "Work experience in Quebec of spouse or partner over the past five years (months)",
    "Compréhension orale du conjoint":
      "Listening comprehension of spouse or partner",
    "Expression orale du conjoint": "Speaking of spouse or partner",
    "Compréhension écrite du conjoint":
      "Reading comprehension of spouse or partner",
    "Expression écrite du conjoint": "Writing of spouse or partner",
    "Diplômés du Québec": "Quebec graduates",
    "Travailleurs étrangers temporaires": "Temporary foreign workers",
    "Examiner les deux": "Assess both",
    "Résultats de l'évaluation": "Assessment results",
    "Imprimer les résultats": "Print results",
    "Conditions principales satisfaites": "Key requirements met",
    "Critère bloquant identifié": "A requirement is not met",
    "Vérification nécessaire": "Verification required",
    "non renseigné": "not provided",
    "Âge minimal de 18 ans": "At least 18 years old",
    "Intention de s’établir au Québec": "Intention to settle in Quebec",
    "Emploi non exclu et sans contrôle de l’entreprise":
      "Eligible employment in a business you do not control",
    "Autonomie financière pour trois mois":
      "Financial self-sufficiency for three months",
    "Conditions de retour liées à une bourse respectées":
      "Scholarship-related return requirements met",
    "Français oral du conjoint accompagnant : niveau 4 minimum":
      "Accompanying spouse or partner's oral French: minimum level 4",
    "Attestation des valeurs québécoises et critères d’invitation, selon le programme.":
      "Quebec values attestation and invitation criteria, depending on the program.",
    "Français oral : niveau {level} minimum dans les deux compétences":
      "Oral French: minimum level {level} in both skills",
    "Français écrit : niveau {level} minimum dans les deux compétences":
      "Written French: minimum level {level} in both skills",
    "preuves linguistiques acceptées par le MIFI.":
      "Language evidence accepted by MIFI.",
    "Exigences générales": "General requirements",
    "Profession principale": "Primary occupation",
    "saisissez un code CNP à cinq chiffres pour déterminer la catégorie FEER et orienter le PSTQ.":
      "Enter a five-digit NOC code to determine the TEER category and identify the relevant PSTQ stream.",
    "Au moins 12 mois d’expérience dans la profession principale sur cinq ans":
      "At least 12 months of experience in the primary occupation over five years",
    "Diplôme professionnel/postsecondaire admissible et durée minimale":
      "Eligible vocational or postsecondary qualification and minimum program duration",
    "PSTQ - Volet 1 : Haute qualification et compétences spécialisées":
      "PSTQ - Stream 1: Highly qualified and specialized skills",
    "24 mois d’expérience, dont au moins 12 mois au Québec":
      "24 months of experience, including at least 12 months in Quebec",
    "Diplôme minimal et durée requise":
      "Minimum qualification and required program duration",
    "PSTQ - Volet 2 : Compétences intermédiaires et manuelles":
      "PSTQ - Stream 2: Intermediate and manual skills",
    "Autorisation d’exercice ou reconnaissance d’équivalence recevable":
      "Acceptable authorization to practise or recognition of equivalence",
    "inscription de l’emploi précis dans la liste MIFI des professions réglementées.":
      "Confirm that the specific job is on MIFI’s list of regulated occupations.",
    "PSTQ - Volet 3 : Professions réglementées":
      "PSTQ - Stream 3: Regulated professions",
    "PSTQ - Volet à confirmer": "PSTQ - Stream to be confirmed",
    "statut réglementé de l’emploi précis; les professions partiellement réglementées nécessitent une vérification particulière.":
      "Check whether the specific job is regulated. Partially regulated occupations require an individual review.",
    "PSTQ - Volet 4 : Talents d’exception":
      "PSTQ - Stream 4: Exceptional talent",
    "Au moins trois ans d’exercice de la profession principale sur cinq ans":
      "At least three years of practice in the primary occupation over five years",
    "Accomplissement reconnu ou avis d’un partenaire du Ministère":
      "Recognized achievement or an opinion from a ministry partner",
    "expertise exceptionnelle et documents reconnus par le MIFI.":
      "Exceptional expertise and documentation recognized by MIFI.",
    "confirmer auprès du MIFI si ce programme accepte actuellement de nouvelles demandes; une ancienne fenêtre annoncée ne garantit pas sa réouverture.":
      "Confirm with MIFI whether the program is currently accepting new applications. A previously announced intake period does not guarantee reopening.",
    "Diplôme admissible obtenu au plus tard le 19 novembre 2025":
      "Eligible qualification awarded by November 19, 2025",
    "Type de diplôme québécois admissible (DEP/ASP : au moins 1 800 h)":
      "Eligible type of Quebec qualification (DVS/AVS: at least 1,800 hours)",
    "Diplôme obtenu dans les 36 derniers mois":
      "Qualification awarded within the past 36 months",
    "Études à temps plein et au moins la moitié du programme au Québec":
      "Full-time studies and at least half of the program completed in Quebec",
    "Présence légale au Québec au dépôt":
      "Lawfully present in Quebec at the time of application",
    "PEQ - Diplômés du Québec": "PEQ - Quebec graduates",
    "Profession FEER 0, 1, 2 ou 3": "TEER 0, 1, 2 or 3 occupation",
    "Au moins deux ans de travail admissible au Québec acquis au 19 novembre 2025":
      "At least two years of eligible work in Quebec by November 19, 2025",
    "conditions spécifiques complètes du volet Travailleurs étrangers temporaires, statut, emploi et français à la date du dépôt.":
      "Confirm the full requirements of the Temporary Foreign Workers stream, including status, employment and French proficiency at the time of application.",
    "PEQ - Travailleurs étrangers temporaires":
      "PEQ - Temporary foreign workers",
    "Programmes pilotes - fermés aux nouvelles demandes":
      "Pilot programs - Closed to new applications",
    "Les trois programmes pilotes (Transformation alimentaire, Préposés aux bénéficiaires, IA / TI / effets visuels) ont pris fin le 1er janvier 2026.":
      "The three pilot programs (Food Processing, Orderlies, and AI / IT / Visual Effects) ended on January 1, 2026.",
    "Aucun dossier antérieur déclaré.": "No previous application declared.",
    "avez-vous déposé une demande avant la fermeture ?":
      "Did you apply before the program closed?",
    "Vous indiquez un dépôt antérieur : la demande peut continuer à être examinée si elle a été présentée avant le 1er janvier 2026.":
      "You reported a previous application. It may continue to be processed if it was submitted before January 1, 2026.",
    "Un dossier antérieur n’équivaut pas à une sélection ou à un CSQ.":
      "A previous application does not constitute selection or the issuance of a Quebec Selection Certificate (CSQ).",
    "Prochaine étape": "Next steps",
    "Déterminer officiellement le volet PSTQ associé à la profession principale dans la liste CNP du MIFI.":
      "Confirm the PSTQ stream for your primary occupation using MIFI’s NOC list.",
    "Comparer les critères d’invitation publiés et, s’il y a lieu, soumettre ou actualiser une déclaration d’intérêt dans Arrima.":
      "Review the published invitation criteria and, if applicable, submit or update an expression of interest in Arrima.",
    "Conserver les preuves de diplôme, d’expérience, de langue, de statut et de liens familiaux.":
      "Keep evidence of qualifications, work experience, language proficiency, status and family ties.",
    "La grille de points de l’ancien PRTQ ne doit pas être utilisée comme calculateur du PSTQ.":
      "The former PRTQ points grid cannot be used to calculate a PSTQ score.",
    "Expérience professionnelle totale (5 ans)":
      "Total work experience (5 years)",
    "Expérience professionnelle au Québec (5 ans)":
      "Work experience in Quebec (5 years)",
    "Diagnostic de main-d’œuvre": "Labour market assessment",
    "Études au Québec sans diplôme":
      "Studies in Quebec without a qualification",
    "Durée des études sans diplôme":
      "Duration of studies without a qualification",
    "Résidence hors CMM":
      "Residence outside the Montréal Metropolitan Community",
    "Durée de résidence hors CMM":
      "Length of residence outside the Montréal Metropolitan Community",
    "Expérience hors CMM":
      "Work experience outside the Montréal Metropolitan Community",
    "Études hors CMM": "Studies outside the Montréal Metropolitan Community",
    "Famille dans la région envisagée":
      "Family in the intended settlement region",
    "Offre d’emploi validée": "Validated job offer",
    "Scolarité du conjoint": "Education of spouse or partner",
    "Expérience québécoise du conjoint (mois)":
      "Quebec work experience of spouse or partner (months)",
    "En cours": "In progress",
    "Terminées sans diplôme": "Completed without a qualification",
    Déficit: "Shortage",
    "L’expérience totale au Québec ne peut dépasser l’expérience totale déclarée.":
      "Total work experience in Quebec cannot exceed the overall work experience reported.",
    "L’expérience dans la profession principale ne peut dépasser l’expérience totale déclarée.":
      "Work experience in the primary occupation cannot exceed the overall work experience reported.",
    "L’expérience dans la profession principale au Québec ne peut dépasser celle dans la profession principale.":
      "Work experience in the primary occupation in Quebec cannot exceed total experience in that occupation.",
    "Le profil du conjoint est incomplet : le pointage avec conjoint ne peut être estimé précisément.":
      "The spouse or partner profile is incomplete, so a score for an accompanying spouse or partner cannot be estimated accurately.",
    "Le pointage Arrima complet doit être établi séparément. Consultez le barème du MIFI pour les facteurs qui ne sont pas chiffrés dans ce rapport.":
      "This tool does not use or verify the complete official scoring grid and conversion tables, so it does not assign a PSTQ score. An expression of interest and a score do not guarantee an invitation.",
    "PSTQ - Analyse complémentaire du profil":
      "PSTQ - Additional profile assessment",
    "Complétez les critères complémentaires pour affiner votre profil.":
      "Complete the additional criteria to refine your profile.",
    "Incohérences ou renseignements manquants :":
      "Inconsistencies or missing information:",
    "Le diagnostic de main-d’œuvre, la profession réglementée, les liens régionaux et l’OEV nécessitent une validation documentaire.":
      "Labour market assessment, regulated occupations, regional ties and validated job offers require supporting documentation.",
    "Aller au contenu principal": "Skip to main content",
    "Navigation du portail": "Portal navigation",
    "Navigation du compte": "Account navigation",
    "Liens du pied de page": "Footer links",
    "Langue / Language": "Language",
    "Pied de page MADIC / MADIC footer": "MADIC footer",
    "Logo MADIC": "MADIC logo",
    "Page à venir / Page coming soon": "Page coming soon",
    "0 à 12": "0 to 12",
    "Une page d’évaluation préliminaire des parcours d’immigration permanente au Québec.":
      "A preliminary assessment of permanent immigration pathways in Quebec.",
    "Impossible de vous déconnecter. Veuillez réessayer.":
      "Unable to sign out. Please try again.",
    "Ex. 21211": "E.g. 21211",
    "Ex. 24": "E.g. 24",
    "Ex. 29": "E.g. 29",
    "Ex. 12": "E.g. 12",
    "Ex. 48": "E.g. 48",
    "Ex. 1800": "E.g. 1800",
    "Ex. 90": "E.g. 90",
    "Projet indiqué dans le profil à la soumission":
      "Plans recorded in the profile at submission",
    "Travailleurs qualifiés sélectionnés par le Québec":
      "Quebec-selected skilled workers",
    "Pointage Arrima complet, si connu": "Full Arrima score, if known",
    "Léger déficit de main-d’œuvre": "Slight labour shortage",
    "Aucun diagnostic officiel": "No official labour market assessment",
    "Le volet principal reste à confirmer à partir du code CNP et du caractère réglementé de l’emploi.":
      "Confirm the primary stream based on the NOC code and whether the occupation is regulated.",
    "Confirmer le code CNP d’après les tâches exercées, puis vérifier le volet dans la liste du MIFI.":
      "Confirm the NOC code based on the duties performed, then check the stream on the MIFI list.",
    "L’intention de s’établir au Québec reste à confirmer ou n’est pas déclarée.":
      "Intention to settle in Quebec remains unconfirmed or has not been declared.",
    "Aucune autorisation d’exercice ou reconnaissance d’équivalence admissible n’est confirmée.":
      "No eligible authorization to practise or recognition of equivalence has been confirmed.",
    "Vérifier auprès de l’autorité québécoise compétente les documents et les démarches de reconnaissance.":
      "Check documentation and professional recognition procedures with the appropriate Quebec authority.",
    "Une ou plusieurs compétences en français sont sous le niveau exigé pour le volet envisagé, ou restent sans preuve suffisante.":
      "One or more French skills are below the level required for the stream under consideration or still lack sufficient evidence.",
    "Prioriser les compétences en français sous le seuil et obtenir une preuve reconnue par le MIFI.":
      "Prioritize French skills below the required level and obtain evidence recognized by MIFI.",
    "Documenter le diplôme et sa durée, puis confirmer le niveau comparable dans le système québécois.":
      "Document the qualification and its duration, then confirm the comparable level in the Quebec education system.",
    "Examiner la possibilité d’une offre validée dans la profession principale et vérifier la localisation de l’emploi.":
      "Explore a validated job offer in the primary occupation and verify the job location.",
    "Vérifier le diagnostic de main-d’œuvre officiel applicable au code CNP et documenter les périodes travaillées.":
      "Check the official labour market assessment for the NOC code and document periods of employment.",
    "Confirmer les compétences de la personne conjointe et documenter ses études et son expérience au Québec.":
      "Confirm the spouse or partner’s skills and document their education and Quebec work experience.",
    "Le pointage Arrima complet reste à confirmer avant de mesurer l’écart avec un exercice d’invitation.":
      "Confirm the full Arrima score before comparing it with an invitation exercise.",
    "Le MIFI peut cibler une profession, un lieu de séjour ou d’autres critères propres à chaque exercice.":
      "MIFI may target occupations, locations of stay or other criteria specific to each invitation exercise.",
    "Vérifier le détail des exercices d’invitation et préparer ou actualiser la déclaration d’intérêt dans Arrima.":
      "Review invitation exercise details and prepare or update the expression of interest in Arrima.",
    "Les trois exercices ci-dessous visaient des CNP ciblés et des personnes qui séjournaient au Québec. Le tableau compare les points seulement. Il faut vérifier chaque critère de l’exercice.":
      "The three exercises below targeted specific NOC codes and people staying in Quebec. The table compares points only. Each exercise criterion must be checked.",
    "Comparer exclusivement les exercices du volet applicable et leurs critères. La page du MIFI donne le détail des exercices par volet.":
      "Compare only the exercises and criteria for the applicable stream. The MIFI page provides details by stream.",
    "Exercice historique - volet 1": "Past invitation exercise - Stream 1",
    "Seuil publié": "Published threshold",
    "Écart au seuil": "Difference from threshold",
    "19 et 20 mars 2026 - exercice 2": "March 19 and 20, 2026 - exercise 2",
    "30 avril 2026 - exercice 2": "April 30, 2026 - exercise 2",
    "4 juin 2026 - exercice 3": "June 4, 2026 - exercise 3",
    "Analyse du projet d’immigration au Québec":
      "Quebec immigration assessment",
    "Brouillon d’analyse généré à partir des renseignements déclarés, à valider par le CRIC.":
      "Draft assessment based on the information provided, for review by the RCIC.",
    "Lieu de résidence": "Place of residence",
    "Code CNP": "NOC code",
    "Non renseigné": "Not provided",
    "Non renseigné ou invalide": "Missing or invalid",
    "Catégorie FEER": "TEER category",
    "Diplôme déclaré": "Declared qualification",
    "Volet PSTQ à examiner en priorité": "PSTQ stream to review first",
    Volet: "Stream",
    "Examiner aussi le volet 4 si les preuves d’accomplissement exceptionnel ou l’avis d’un partenaire sont recevables.":
      "Also consider Stream 4 if evidence of exceptional achievement or a partner’s opinion is acceptable.",
    "Le PSTQ comprend quatre volets. Le ministère détermine le volet applicable selon la profession principale et les renseignements déclarés.":
      "The PSTQ has four streams. The ministry determines the applicable stream based on the primary occupation and the information provided.",
    "Français - quatre compétences": "French - four skills",
    "Expérience de travail totale": "Total work experience",
    "Diagnostic de main-d’œuvre et expérience principale":
      "Labour market assessment and experience in the primary occupation",
    "Expérience de travail au Québec": "Work experience in Quebec",
    "Pointage Arrima et facteurs évalués": "Arrima score and assessed factors",
    "Calcul indicatif à partir des données déclarées. Un tiret indique un facteur non chiffré. Le sous-total couvre seulement les facteurs calculés ci-dessous.":
      "Estimate based on the information provided. A dash means a factor was not scored. The subtotal covers only the factors calculated below.",
    Facteur: "Factor",
    "Points indicatifs": "Estimated points",
    "Maximum du facteur": "Maximum for the factor",
    "Sous-total partiel": "Partial subtotal",
    "Pointage Arrima complet déclaré": "Declared full Arrima score",
    "Le pointage officiel dépend notamment de la date d’extraction, des preuves linguistiques et des facteurs non chiffrés ici, dont la scolarité et les facteurs de la personne conjointe.":
      "The official score depends in part on the extraction date, language evidence and factors not scored here, including education and spouse or partner factors.",
    "Gain indicatif si les quatre compétences en français atteignent au moins le niveau 9":
      "Estimated gain if all four French skills reach at least level 9",
    "points, sous réserve de preuves reconnues.":
      "points, subject to recognized evidence.",
    "Consulter le barème officiel du MIFI":
      "View the official MIFI scoring grid",
    "Exercices d’invitation et risques": "Invitation exercises and risks",
    "Consulter les invitations Arrima de 2026": "View 2026 Arrima invitations",
    "Recommandations et suite du dossier": "Recommendations and next steps",
    "Après une invitation dans Arrima, présenter la demande de sélection permanente au Québec. Une fois le CSQ obtenu, présenter la demande de résidence permanente à IRCC.":
      "After receiving an invitation in Arrima, apply to Quebec for permanent selection. Once the CSQ is issued, apply to IRCC for permanent residence.",
    "Sélection permanente au Québec, frais et procédure":
      "Quebec permanent selection, fees and procedure",
    "Résidence permanente, frais et procédure fédérale":
      "Permanent residence, federal fees and procedure",
    "Avis professionnel du CRIC": "RCIC professional opinion",
    "· À compléter après vérification des renseignements, des pièces justificatives et des critères en vigueur.":
      "· To be completed after reviewing the information, supporting documents and current criteria.",
    "Le MIFI indique que la période de réception du PEQ est fermée depuis le 31 octobre 2026. Vérifier l’état du programme avant toute démarche.":
      "MIFI indicates that PEQ intake has been closed since October 31, 2026. Check the program status before taking any steps.",
    "Les programmes pilotes Transformation alimentaire, Préposés aux bénéficiaires et IA/TI–effets visuels sont fermés aux nouvelles demandes depuis le 1er janvier 2026. La période de réception du PEQ s’est terminée le 31 octobre 2026.":
      "The Food Processing, Orderlies and AI/IT–Visual Effects pilots have been closed to new applications since January 1, 2026. The PEQ intake period ended October 31, 2026.",
    "Le pointage Arrima complet doit être établi séparément. Consultez le barème du MIFI pour les facteurs qui ne sont pas chiffrés dans ce rapport.":
      "The full Arrima score must be established separately. Consult the MIFI grid for factors not scored in this report.",
    "Aucun diplôme": "No qualification",
    "Secondaire général ou professionnel québécois de 600 à 899 h":
      "General secondary or Quebec vocational education of 600 to 899 hours",
    "Secondaire professionnel de 900 h au Québec ou d’au moins un an à temps plein hors Québec":
      "Vocational secondary education of at least 900 hours in Quebec or one year of full-time study outside Quebec",
    "Postsecondaire général de 2 ans à temps plein":
      "General postsecondary education, two years full-time",
    "Postsecondaire technique de 900 h au Québec ou de 1 à 2 ans à temps plein hors Québec":
      "Technical postsecondary education of at least 900 hours in Quebec or one to two years full-time outside Quebec",
    "Postsecondaire technique de 3 ans à temps plein":
      "Technical postsecondary education, three years full-time",
    "Universitaire de 1er cycle - 1 an à temps plein":
      "Undergraduate degree - one year full-time",
    "Universitaire de 1er cycle - 2 ans à temps plein":
      "Undergraduate degree - two years full-time",
    "Universitaire de 1er cycle - 3 ou 4 ans à temps plein":
      "Undergraduate degree - three or four years full-time",
    "Universitaire de 1er cycle - 5 ans ou plus à temps plein":
      "Undergraduate degree - five years or more full-time",
    "Universitaire de 2e cycle - 1 an à temps plein":
      "Graduate degree - one year full-time",
    "Universitaire de 2e cycle - 2 ans ou plus à temps plein":
      "Graduate degree - two years or more full-time",
    "Spécialisation médicale universitaire - 2 ans ou plus à temps plein":
      "University medical specialty - two years or more full-time",
    "Universitaire de 3e cycle": "Doctoral degree",
    "Niveau de scolarité selon la catégorie du barème Arrima, si confirmé":
      "Education category under the Arrima grid, if confirmed",
    "Niveau de scolarité": "Education level",
    "Durée de l’expérience professionnelle totale (équivalent temps plein)":
      "Total work experience (full-time equivalent)",
    "Expérience professionnelle totale en équivalent temps plein (mois)":
      "Total work experience in full-time equivalent (months)",
    "Expérience professionnelle totale au Québec en équivalent temps plein (mois)":
      "Total Quebec work experience in full-time equivalent (months)",
    "Le pointage officiel dépend notamment de la date d’extraction, des preuves linguistiques et des facteurs non chiffrés ici, dont le diplôme du Québec et les facteurs de la personne conjointe.":
      "The official score depends in part on the extraction date, language evidence and factors not scored here, including Quebec diplomas and spouse or partner factors.",
  }),
);

const languageKey = "madic_ui_language";
const languageButtons = document.querySelectorAll(
  ".madic-lang-controls button[data-lang]",
);
const textSources = new WeakMap();
const attributeSources = new WeakMap();
let pageLanguage = "fr";

function translateLabel(label) {
  if (pageLanguage !== "en") return label;
  if (englishLabels.has(label)) return englishLabels.get(label);

  // Preserve the evaluation's verdict markers and numeric thresholds internally.
  const match = /^(OK|NON|À vérifier) : (.+)$/.exec(label);
  if (match) {
    const prefix = { OK: "Met", NON: "Not met", "À vérifier": "To verify" };
    return `${prefix[match[1]]}: ${translateLabel(match[2])}`;
  }
  if (label.endsWith(" mois")) {
    return `${translateLabel(label.slice(0, -5))} months`;
  }
  const level =
    /^(Français (?:oral|écrit) : niveau )(\d+)( minimum dans les deux compétences)$/.exec(
      label,
    );
  if (level) {
    const template = englishLabels.get(`${level[1]}{level}${level[3]}`);
    return template.replace("{level}", level[2]);
  }
  if (label.endsWith(" :")) return `${translateLabel(label.slice(0, -2))}:`;
  return label;
}

function localizeTree(root) {
  root.querySelectorAll("[data-fr][data-en]").forEach((element) => {
    element.textContent = element.dataset[pageLanguage];
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script, style, [data-fr][data-en]"))
      continue;
    if (!textSources.has(node)) textSources.set(node, node.nodeValue);
    const source = textSources.get(node);
    const phrase = source.trim();
    if (!phrase) continue;
    const label = phrase.replace(/\s+/g, " ");
    const translated = translateLabel(label);
    node.nodeValue =
      translated === label ? source : source.replace(phrase, translated);
  }
}

function applyLanguage(language) {
  pageLanguage = language === "en" ? "en" : "fr";
  document.documentElement.lang = pageLanguage === "en" ? "en-CA" : "fr-CA";
  document.title = document.querySelector("title").dataset[pageLanguage];
  localizeTree(document.body);

  document
    .querySelectorAll(
      "[aria-label], [title], [placeholder], img[alt], meta[name=description]",
    )
    .forEach((element) => {
      if (!attributeSources.has(element)) {
        const originals = new Map();
        for (const name of [
          "aria-label",
          "title",
          "placeholder",
          "alt",
          "content",
        ]) {
          if (element.hasAttribute(name))
            originals.set(name, element.getAttribute(name));
        }
        attributeSources.set(element, originals);
      }
      for (const [name, original] of attributeSources.get(element)) {
        element.setAttribute(name, translateLabel(original));
      }
    });
  languageButtons.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.lang === pageLanguage),
    ),
  );
}

function readLanguage() {
  const requested = new URLSearchParams(location.search).get("lang");
  if (requested === "fr" || requested === "en") return requested;
  try {
    return (
      localStorage.getItem(languageKey) ||
      localStorage.getItem("madic-lang") ||
      localStorage.getItem("madic-language") ||
      "fr"
    );
  } catch {
    return "fr";
  }
}

languageButtons.forEach((button) =>
  button.addEventListener("click", () => {
    applyLanguage(button.dataset.lang);
    // Honour the dashboard's preference key and the keys used by older pages.
    try {
      for (const key of [languageKey, "madic-lang", "madic-language"]) {
        localStorage.setItem(key, pageLanguage);
      }
    } catch {
      // The page still works when storage is disabled.
    }
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.has("lang")) {
      currentUrl.searchParams.delete("lang");
      history.replaceState(history.state, "", currentUrl);
    }
    document.dispatchEvent(
      new CustomEvent("madic:languagechange", {
        detail: { lang: pageLanguage },
      }),
    );
  }),
);
window.addEventListener("storage", (event) => {
  if (event.key === languageKey) applyLanguage(readLanguage());
});
applyLanguage(readLanguage());

$("madic-print-button").addEventListener("click", () => window.print());

let supabaseLoad;
async function getQuebecSupabase() {
  if (!window.supabase) {
    supabaseLoad ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        supabaseLoad = undefined;
        reject(new Error("Impossible de charger Supabase."));
      };
      document.head.append(script);
    });
    await supabaseLoad;
  }
  return window.getMadicSupabase();
}

$("cricLogout").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const message = $("madicSignoutError");
  message.hidden = true;
  button.disabled = true;
  try {
    if (typeof window.getMadicSupabase !== "function") {
      throw new Error("Configuration Supabase manquante.");
    }
    const db = await getQuebecSupabase();
    const { error } = await db.auth.signOut();
    if (error) throw error;
    location.assign("connexion.html");
  } catch (error) {
    console.error("MADIC sign out failed", error);
    message.hidden = false;
    button.disabled = false;
  }
});

/* Préremplissage depuis le formulaire client soumis. Supabase applique les droits existants. */
function intakeAge(dateOfBirth) {
  if (
    typeof dateOfBirth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
  )
    return "";
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  const now = new Date();
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    birth > now
  )
    return "";
  const beforeBirthday =
    now.getMonth() < month - 1 ||
    (now.getMonth() === month - 1 && now.getDate() < day);
  return now.getFullYear() - year - Number(beforeBirthday);
}

function setAssessmentValue(id, value) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim() === ""
  )
    return false;
  const field = $(id);
  if (!field) return false;
  const text = String(value).trim();
  if (
    field.tagName === "SELECT" &&
    !Array.from(field.options).some((option) => option.value === text)
  )
    return false;
  field.value = text;
  if (!field.value || !field.checkValidity()) {
    field.value = "";
    return false;
  }
  return true;
}

function intakeAnswersToAssessment(answers) {
  const fields = [
    "residence",
    "status",
    "intent",
    "noc",
    "regulated",
    "recognition",
    "exception",
    "work",
    "qcwork",
    "workTotal",
    "workQcTotal",
    "validatedOffer",
    "degree",
    "degreeplace",
    "fulltime",
    "hours",
    "credits",
    "graduation",
    "oralListen",
    "oralSpeak",
    "writtenRead",
    "writtenWrite",
    "spouse",
    "spouseListen",
    "spouseSpeak",
    "spouseRead",
    "spouseWrite",
    "spouseAge",
    "spouseQcWork",
    "finance",
    "scholarship",
    "excluded",
    "outsideCmm",
    "outsideResidenceMonths",
    "regionalFamily",
    "arrimaScore",
  ];
  const values = { age: intakeAge(answers.date_naissance) };
  const normalize = (value) =>
    typeof value === "string"
      ? value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase()
      : "";
  const levels = {
    aucun: "none",
    baccalaureat: "bachelor",
    maitrise: "master",
    doctorat: "doctorate",
  };
  values.degree = levels[normalize(answers.niveau_scolarite)] ?? "";
  if (
    normalize(answers.pays_residence) &&
    normalize(answers.pays_residence) !== "canada"
  ) {
    values.residence = "abroad";
  }
  if (answers.etat_matrimonial === "celibataire") values.spouse = "no";
  if (answers.offre_emploi === "aucun") values.validatedOffer = "none";

  // Les anciennes réponses qualitatives en français ou les plages d’expérience
  // ne constituent pas des niveaux ni des durées utilisables pour le PSTQ.
  if (answers.province_destination === "quebec") {
    for (const field of fields) {
      const value = answers["qc_" + field];
      if (value !== undefined && value !== null && value !== "")
        values[field] = value;
    }
  }
  if (values.residence !== "qc") {
    delete values.status;
    delete values.outsideCmm;
    delete values.outsideResidenceMonths;
  } else if (values.outsideCmm !== "yes") {
    delete values.outsideResidenceMonths;
  }
  if (values.regulated !== "yes") delete values.recognition;
  if (values.spouse !== "yes") {
    for (const field of [
      "spouseListen",
      "spouseSpeak",
      "spouseRead",
      "spouseWrite",
      "spouseAge",
      "spouseQcWork",
    ])
      delete values[field];
  } else {
    values.spouseDegree =
      levels[normalize(answers.niveau_scolarite_epoux)] ?? "";
  }
  return values;
}

function showIntakeStatus(fr, en) {
  const status = $("quebec-intake-status");
  status.dataset.fr = fr;
  status.dataset.en = en;
  status.textContent = status.dataset[pageLanguage];
}

async function connectQuebecIntake() {
  const picker = $("quebec-intake-client");
  const retry = $("quebec-intake-retry");
  const form = $("assessment");
  const candidates = new Map();
  let loadGeneration = 0;
  let db;
  let initialized = false;
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  const requestedClient = new URLSearchParams(location.search).get("client");

  async function loadAssessment() {
    const client = picker.value;
    const generation = ++loadGeneration;
    form.reset();
    $("resultContent").replaceChildren();
    retry.hidden = true;
    $("quebec-intake-report-link").hidden = true;
    if (!candidates.has(client)) {
      showIntakeStatus(
        "Choisissez un client pour charger son formulaire soumis.",
        "Choose a client to load their submitted form.",
      );
      return;
    }
    showIntakeStatus(
      "Chargement du formulaire soumis…",
      "Loading the submitted form…",
    );
    try {
      const { data, error } = await db
        .from("madic_client_intake")
        .select("answers")
        .eq("user_id", client)
        .eq("status", "submitted")
        .maybeSingle();
      if (generation !== loadGeneration) return;
      if (error) throw error;
      if (
        !data?.answers ||
        typeof data.answers !== "object" ||
        Array.isArray(data.answers)
      ) {
        showIntakeStatus(
          "Formulaire soumis indisponible pour ce client avec vos droits actuels.",
          "The submitted form is unavailable for this client with your current permissions.",
        );
        retry.hidden = false;
        return;
      }
      // Lire uniquement l’identité utile à l’analyse, après validation du
      // client et de la présence d’un formulaire soumis. La RLS reste maîtresse.
      let latestProfile;
      try {
        const { data: identity, error: profileError } = await db
          .from("profiles")
          .select("first_name,last_name,date_of_birth")
          .eq("id", client)
          .maybeSingle();
        if (!profileError) latestProfile = identity;
      } catch {
        // Le formulaire soumis suffit si la lecture du profil est indisponible.
      }
      if (generation !== loadGeneration) return;
      const values = intakeAnswersToAssessment(data.answers);
      const currentAge = intakeAge(latestProfile?.date_of_birth);
      if (currentAge !== "") values.age = currentAge;
      let filled = 0;
      for (const [id, value] of Object.entries(values)) {
        if (setAssessmentValue(id, value)) filled++;
      }
      spouseToggle();
      conditionalFields();
      if (!filled) {
        showIntakeStatus(
          "Le formulaire ne contient pas de données utilisables pour cette analyse.",
          "The form does not contain data that can be used for this assessment.",
        );
        return;
      }
      const profileName = [latestProfile?.first_name, latestProfile?.last_name]
        .filter((part) => typeof part === "string" && part.trim())
        .map((part) => part.trim())
        .join(" ");
      const submittedName = [data.answers.prenom, data.answers.nom]
        .filter((part) => typeof part === "string" && part.trim())
        .map((part) => part.trim())
        .join(" ");
      assessmentClientName =
        profileName || submittedName || candidates.get(client) || "";
      assessmentProfileProject = data.answers._madic_profile_ircc?.type || "";
      render(false);
      $("quebec-intake-report-link").hidden = false;
      showIntakeStatus(
        "Formulaire chargé et analyse générée. Vérifiez les renseignements manquants dans le rapport.",
        "Form loaded and assessment generated. Review the missing information in the report.",
      );
    } catch {
      if (generation !== loadGeneration) return;
      showIntakeStatus(
        "Lecture du formulaire impossible avec la session actuelle.",
        "The current session could not read the form.",
      );
      retry.hidden = false;
    }
  }

  async function loadClients() {
    retry.hidden = true;
    showIntakeStatus(
      "Chargement des clients de votre espace CRIC…",
      "Loading clients from your RCIC workspace…",
    );
    try {
      if (typeof window.getMadicSupabase !== "function")
        throw new Error("Configuration");
      db = await getQuebecSupabase();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth?.user) {
        showIntakeStatus(
          "Connectez-vous à votre espace CRIC pour charger un dossier client.",
          "Sign in to your RCIC workspace to load a client file.",
        );
        return;
      }
      const { data: spaces, error: spaceError } = await db
        .from("madic_cric_spaces")
        .select("id")
        .eq("owner_user_id", auth.user.id)
        .eq("access_status", "active");
      if (spaceError) throw spaceError;
      const responses = await Promise.all(
        (spaces ?? []).map(async (space) => {
          const { data: allowed, error } = await db.rpc(
            "madic_can_manage_cric_space",
            { p_space_id: space.id },
          );
          if (error) throw error;
          if (allowed !== true) return [];
          const { data, error: clientsError } = await db.rpc(
            "madic_service_eligible_clients",
            { p_space_id: space.id },
          );
          if (clientsError) throw clientsError;
          return data ?? [];
        }),
      );
      for (const row of responses.flat()) {
        if (
          row.intake_status === "submitted" &&
          typeof row.client_id === "string" &&
          uuid.test(row.client_id)
        ) {
          candidates.set(row.client_id.toLowerCase(), row.client_name);
        }
      }
      initialized = true;
      if (!candidates.size) {
        showIntakeStatus(
          "Aucun formulaire soumis accessible dans votre espace CRIC.",
          "No submitted forms are available in your RCIC workspace.",
        );
        return;
      }
      for (const [id, name] of candidates) {
        const option = document.createElement("option");
        option.value = id;
        if (name) option.textContent = name;
        else {
          option.dataset.fr = "Client sans nom affiché";
          option.dataset.en = "Client with no display name";
          option.textContent = option.dataset[pageLanguage];
        }
        picker.append(option);
      }
      picker.disabled = false;
      if (requestedClient && candidates.has(requestedClient.toLowerCase())) {
        picker.value = requestedClient.toLowerCase();
        await loadAssessment();
      } else if (requestedClient) {
        showIntakeStatus(
          "Le dossier demandé ne figure pas parmi vos formulaires soumis accessibles.",
          "The requested file is not in your accessible submitted forms.",
        );
      } else {
        showIntakeStatus(
          "Choisissez un client pour charger son formulaire soumis.",
          "Choose a client to load their submitted form.",
        );
      }
    } catch {
      showIntakeStatus(
        "Chargement des clients impossible avec la session actuelle.",
        "The current session could not load the client list.",
      );
      retry.hidden = false;
    }
  }

  form.addEventListener("reset", () => {
    $("quebec-intake-report-link").hidden = true;
  });
  picker.addEventListener("change", loadAssessment);
  retry.addEventListener("click", () =>
    initialized ? loadAssessment() : loadClients(),
  );
  await loadClients();
}

if ($("quebec-intake-client")) void connectQuebecIntake();

/* MADIC: interface provinciale, sans modification des calculs. */
/* Phone navigation only; existing authentication and business logic unchanged. */
(() => {
  const init = () => {
    const drawer = document.getElementById("madicPhoneDrawer");
    const trigger = document.querySelector(".madic-phone-trigger");
    const close = drawer?.querySelector(".madic-phone-close");
    const shade = document.querySelector(".madic-phone-shade");
    if (!drawer || !trigger || !close || !shade) return;
    const mobile = matchMedia("(max-width:900px)");
    const set = (open, restore = false) => {
      open = open && mobile.matches;
      document.body.classList.toggle("madic-phone-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      shade.hidden = !open;
      drawer.inert = mobile.matches && !open;
      if (open) close.focus();
      else if (restore && mobile.matches) trigger.focus();
    };
    trigger.addEventListener("click", () => set(true));
    close.addEventListener("click", () => set(false, true));
    shade.addEventListener("click", () => set(false, true));
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) set(false);
    });
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        document.body.classList.contains("madic-phone-open")
      )
        set(false, true);
    });
    mobile.addEventListener("change", () => set(false));
    const lang = () => {
      const en = document.documentElement.lang.startsWith("en");
      trigger.setAttribute("aria-label", en ? "Open menu" : "Ouvrir le menu");
      close.setAttribute("aria-label", en ? "Close menu" : "Fermer le menu");
    };
    new MutationObserver(lang).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    lang();
    set(false);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* MADIC display preferences - UI only */
(() => {
  const init = () => {
    const root = document.documentElement,
      body = document.body,
      tools = document.querySelector(".madic-display-tools");
    if (!tools) return;
    const collapse = tools.querySelector(".madic-collapse"),
      trigger = tools.querySelector(".madic-theme-trigger"),
      menu = tools.querySelector("#madicThemeOptions"),
      choices = [...menu.querySelectorAll("button")],
      media = matchMedia("(prefers-color-scheme: dark)");
    const read = (k, d) => {
      try {
        return localStorage.getItem(k) || d;
      } catch {
        return d;
      }
    };
    const save = (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    };
    let compact = read("madic-cric-sidebar", "expanded") === "collapsed",
      theme = read("madic-admin-theme", "light");
    if (!["system", "light", "dark"].includes(theme)) theme = "light";
    let renderedLanguage;
    let renderedTheme;
    const render = () => {
      renderedLanguage = root.lang;
      const en = root.lang.startsWith("en");
      body.classList.toggle("madic-sidebar-compact", compact);
      root.dataset.madicAppearance =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.madicTheme = root.dataset.madicAppearance;
      const label = compact
        ? en
          ? "Expand"
          : "Développer"
        : en
          ? "Collapse"
          : "Réduire";
      collapse.querySelector("span").textContent = label;
      collapse.title = label;
      collapse.setAttribute("aria-label", label);
      collapse.setAttribute("aria-expanded", String(!compact));
      trigger.title = en ? "Appearance" : "Apparence";
      trigger.setAttribute("aria-label", trigger.title);
      choices.forEach((b, i) => {
        b.querySelector("span").textContent = (
          en ? ["System", "Light", "Dark"] : ["Système", "Clair", "Sombre"]
        )[i];
        b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme));
      });
      if (renderedTheme !== theme)
        trigger.querySelector("svg").replaceWith(
          choices
            .find((b) => b.dataset.themeChoice === theme)
            .querySelector("svg")
            .cloneNode(true),
        );
      renderedTheme = theme;
      document
        .querySelectorAll(
          "#madicPhoneDrawer nav a, #madicPhoneDrawer nav summary",
        )
        .forEach((a) => {
          a.title = a.textContent.trim();
          a.setAttribute("aria-label", a.title);
        });
    };
    const open = (v) => {
      menu.hidden = !v;
      trigger.setAttribute("aria-expanded", String(v));
    };
    collapse.addEventListener("click", () => {
      compact = !compact;
      save("madic-cric-sidebar", compact ? "collapsed" : "expanded");
      render();
    });
    trigger.addEventListener("click", () => open(menu.hidden));
    choices.forEach((b) =>
      b.addEventListener("click", () => {
        theme = b.dataset.themeChoice;
        save("madic-admin-theme", theme);
        render();
        open(false);
        trigger.focus();
      }),
    );
    document.addEventListener("click", (e) => {
      if (!e.composedPath().includes(tools)) open(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        open(false);
        trigger.focus();
      }
    });
    media.addEventListener("change", render);
    new MutationObserver(() => {
      if (root.lang !== renderedLanguage) render();
    }).observe(root, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    window.addEventListener("storage", (e) => {
      if (["madic-cric-sidebar", "madic-admin-theme"].includes(e.key)) {
        compact = read("madic-cric-sidebar", "expanded") === "collapsed";
        theme = read("madic-admin-theme", "light");
        if (!["system", "light", "dark"].includes(theme)) theme = "light";
        render();
      }
    });
    render();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

(() => {
 const root=document.documentElement, field=document.getElementById('madicHeaderSearch');
 const sync=()=>{const en=root.lang.startsWith('en'); field.placeholder=en?'Search this page...':'Rechercher dans cette page...'; field.setAttribute('aria-label',field.placeholder);};
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['lang']}); sync();
 document.getElementById('madicHeaderSearchForm').addEventListener('submit',e=>{e.preventDefault();const q=field.value.trim().toLocaleLowerCase(); if(!q)return; const target=[...document.querySelectorAll('main h1,main h2,main h3,main label,main p')].find(el=>el.textContent.toLocaleLowerCase().includes(q)); if(target){target.scrollIntoView({block:'center'});}else{field.setCustomValidity(root.lang.startsWith('en')?'No result on this page.':'Aucun résultat dans cette page.');field.reportValidity();setTimeout(()=>field.setCustomValidity(''),1500);}});
})();

/* Header identity: read-only, using the existing authenticated Supabase client. */
(async () => {
  const name = document.getElementById('madicHeaderProfileName');
  const license = document.getElementById('madicHeaderProfileLicense');
  if (!name || !license) return;
  try {
    const db = await getQuebecSupabase();
    const {data: auth, error} = await db.auth.getUser();
    if (error || !auth?.user) return;
    const uid = auth.user.id;
    const {data: application, error: appError} = await db.from('madic_cric_applications').select('full_name,license_number,status').eq('user_id',uid).maybeSingle();
    if (appError) throw appError;
    const {data: profile} = await db.from('profiles').select('first_name,last_name').eq('id',uid).maybeSingle();
    const fullName = (application?.full_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(' ') || auth.user.email || '').trim();
    if (!fullName) return;
    const render = () => {
      name.textContent = fullName;
      license.textContent = (document.documentElement.lang.startsWith('en') ? 'RCIC' : 'CRIC') + (application?.license_number ? ' ' + application.license_number : '');
    };
    for (const el of [name,license]) { el.removeAttribute('data-fr'); el.removeAttribute('data-en'); }
    new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    render();
  } catch (error) { console.warn('MADIC header identity:',error); }
})();
