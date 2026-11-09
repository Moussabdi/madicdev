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
function render() {
  let out = "";
  const c = common(),
    noc = v("noc"),
    teer = /^\d{5}$/.test(noc) ? Number(noc[1]) : null,
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
  let windowMsg =
    "À vérifier : confirmer auprès du MIFI si ce programme accepte actuellement de nouvelles demandes; une ancienne fenêtre annoncée ne garantit pas sa réouverture.";
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
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("assessment").addEventListener("submit", (e) => {
  e.preventDefault();
  render();
});
$("assessment").addEventListener("reset", () => {
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
    "Le barème officiel complet et les tables de conversion n’étant pas intégrés ni vérifiés ici, aucun total de points PSTQ n’est attribué. Une déclaration d’intérêt et un pointage ne garantissent pas une invitation.";
  return `<article class="result-card"><h3>PSTQ - Analyse complémentaire du profil</h3><p>${message}</p>${rows.length ? `<ul>${rows.join("")}</ul>` : "<p>Complétez les critères complémentaires pour affiner votre profil.</p>"}${checks.length ? `<p class="bad"><strong>Incohérences ou renseignements manquants :</strong></p><ul>${checks.map((x) => `<li>${escapeQc(x)}</li>`).join("")}</ul>` : ""}<p class="hint">Le diagnostic de main-d’œuvre, la profession réglementée, les liens régionaux et l’OEV nécessitent une validation documentaire.</p></article>`;
}
const renderBase = render;
render = function () {
  renderBase();
  $("resultContent").insertAdjacentHTML("beforeend", pstqSummary());
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
