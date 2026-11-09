(() => {
  "use strict";
  const form = document.querySelector("#form"),
    out = document.querySelector("#results");
  const get = (n) => form.elements.namedItem(n).value,
    yes = (n) => get(n) === "yes",
    num = (n) => Number(get(n)) || 0;
  const tech = new Set(
    "20012 21100 21101 21102 21109 21110 21112 21211 21220 21221 21222 21223 21230 21231 21232 21233 21234 21310 21311 21320 21322 21330 21331 21332 22100 22101 22110 22214 22220 22221 22222 22301".split(
      " ",
    ),
  );
  const agriculture = new Set(
    "14401 75101 84120 85100 85101 85103 94140 94141 94143 94204 95106".split(
      " ",
    ),
  );
  const health = new Set(
    "21100 30010 31100 31101 31102 31103 31110 31111 31112 31120 31121 31200 31201 31202 31203 31204 31209 31300 31301 31302 31303 32100 32101 32102 32103 32104 32109 32110 32111 32112 32120 32121 32122 32123 32124 32129 32200 32201 32209 33100 33101 33102 33103 33109 41300 41301 42201 44101".split(
      " ",
    ),
  );
  const pages = {
    offer:
      "applicants-international-skilled-workers/international-skilled-worker-with-employment-offer",
    agri: "applicants-international-skilled-workers/agriculture-talent-pathway",
    health: "applicants-international-skilled-workers/health-talent-pathway",
    tech: "applicants-international-skilled-workers/sinp-innovation-tech-talent-pathway",
    student: "applicants-with-saskatchewan-experience/students",
    permit:
      "applicants-with-saskatchewan-experience/applicants-with-existing-work-permit",
    ee: "applicants-international-skilled-workers/international-skilled-worker-saskatchewan-express-entry",
    oid: "applicants-international-skilled-workers/occupations-in-demand",
  };
  const base =
    "https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program/browse-sinp-programs/";
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const row = (title, status, detail, key) => ({ title, status, detail, key });
  function calc() {
    const a = num("age"),
      e = num("education"),
      x5 = num("exp5"),
      x10 = num("exp10"),
      l1 = get("test1") === "none" ? 0 : num("clb1"),
      l2 = get("test2") === "none" ? 0 : num("clb2");
    const education = e,
      exp5 = x5 * 2,
      exp10 = x10,
      language1 = l1 >= 8 ? 20 : l1 >= 4 ? (l1 - 4) * 2 + 12 : 0,
      language2 = l2 >= 8 ? 10 : l2 >= 4 ? (l2 - 3) * 2 : 0,
      age =
        a < 18 || a > 50 ? 0 : a <= 21 ? 8 : a <= 34 ? 12 : a <= 45 ? 10 : 8;
    const f1 = Math.min(
      80,
      education + exp5 + exp10 + language1 + language2 + age,
    );
    const offer = yes("offer"),
      factor2Offer = offer && num("teer") <= 3 ? 30 : 0;
    const factor2NoOffer =
      (yes("relative") ? 20 : 0) +
      (yes("skwork") ? 5 : 0) +
      (yes("skstudy") ? 5 : 0);
    return {
      education,
      exp5,
      exp10,
      language1,
      language2,
      age,
      f1,
      offerTotal: f1 + factor2Offer,
      noOfferTotal: f1 + factor2NoOffer,
      offerFactor: factor2Offer,
      noOfferFactor: factor2NoOffer,
      l1,
      l2,
    };
  }
  function assess() {
    const s = calc(),
      offer = yes("offer"),
      sk = get("location") === "sk",
      permit = get("permit"),
      noc = get("noc"),
      sector = get("sector"),
      teer = num("teer"),
      hours = num("employerhours"),
      recent = num("recentyears"),
      exp = num("exp5") + num("exp10"),
      educated = num("education") >= 12,
      ref = get("refugee"),
      blocked =
        ref === "pending" ||
        (ref === "refused" && !form.elements.namedItem("departure").checked) ||
        get("intent") === "no",
      status = blocked ? "bad" : "warn",
      reasons = [];
    if (ref === "pending")
      reasons.push(
        "Demande d’asile en cours au Canada : exclusion indiquée par le SINP.",
      );
    if (ref === "refused" && !form.elements.namedItem("departure").checked)
      reasons.push(
        "Demande d’asile refusée : sortie du Canada et justificatifs requis pour tous les membres accompagnants.",
      );
    if (get("intent") === "no")
      reasons.push(
        "L’intention de s’établir en Saskatchewan est une condition essentielle.",
      );
    if (get("intent") === "unsure")
      reasons.push(
        "L’intention de s’établir en Saskatchewan doit être établie.",
      );
    if (get("epa") !== "yes" && offer)
      reasons.push(
        "L’EPA de l’employeur doit être approuvée et validée avant la demande.",
      );
    if (get("regulated") !== "no")
      reasons.push(
        "Vérifier l’autorisation d’exercice et les exigences de l’ordre professionnel, s’il y a lieu.",
      );
    if (["food", "trucking", "retail"].includes(sector))
      reasons.push(
        "Secteur plafonné en 2026 : vérifier la fenêtre EPA, les quotas et les conditions du permis.",
      );
    if (get("relatededu") !== "yes")
      reasons.push(
        "Vérifier le lien entre les études, la profession et l’offre.",
      );
    if (get("location") === "canada" && permit === "none")
      reasons.push("Statut légal au Canada non établi.");
    const candidates = [];
    const add = (title, ok, detail, key) =>
      candidates.push(
        row(
          title,
          blocked ? "blocked" : ok ? "possible" : "check",
          detail,
          key,
        ),
      );
    if (offer) {
      if (sector === "agri" || agriculture.has(noc))
        add(
          "Agriculture Talent Pathway",
          agriculture.has(noc) &&
            s.l1 >= 4 &&
            educated &&
            (recent >= 1 || hours >= 780),
          "CNP admissible, secteur de l’employeur (SCIAN pour certains CNP), secondaire, CLB 4 et expérience : 1 an dans les 3 dernières années ou 780 h chez l’employeur. Le champ « expérience récente » doit aussi être vérifié sur 3 ans.",
          "agri",
        );
      if (sector === "health" || health.has(noc))
        add(
          "Health Talent Pathway",
          health.has(noc) &&
            educated &&
            s.l1 >= 5 &&
            (recent >= 1 || hours >= 780),
          "Volet hors Entrée express : CLB 5, formation liée et expérience. Volet Entrée express : CLB 7, profil valide et exigences spécifiques; certaines professions ont des exceptions.",
          "health",
        );
      if (sector === "tech" || tech.has(noc))
        add(
          "Innovation and Tech Talent Pathway",
          tech.has(noc) &&
            educated &&
            (recent >= 1 || hours >= 780) &&
            (hours >= 780 || s.l1 >= 5),
          "Profession parmi les CNP admissibles, diplôme lié, expérience et conditions linguistiques selon la situation chez l’employeur.",
          "tech",
        );
      if (yes("skgrad") && ["pgwp", "study", "cuaet"].includes(permit))
        add(
          "Student Category",
          hours >= 780 &&
            (permit !== "study" ||
              [
                "health",
                "agri",
                "tech",
                "trades",
                "energy",
                "mining",
                "manufacturing",
              ].includes(sector)),
          "Diplôme obtenu en Saskatchewan, 780 heures liées aux études, offre admissible liée au domaine et EPA. Les titulaires d’un permis d’études doivent avoir une offre dans un secteur prioritaire.",
          "student",
        );
      if (sk && !["pgwp", "study", "spousal"].includes(permit))
        add(
          "Skilled Worker with Existing Work Permit",
          hours >= 780 &&
            (teer <= 3 || ["lmia", "franco", "cuaet"].includes(permit)),
          "780 heures consécutives avec l’employeur et permis admissible; règles FEER particulières selon le type de permis. CLB 4 si FEER 4 ou 5.",
          "permit",
        );
      if (
        teer <= 3 &&
        sector !== "health" &&
        noc !== "73300" &&
        s.offerTotal >= 60 &&
        exp >= 1 &&
        s.l1 >= 4
      )
        add(
          "International Skilled Worker: Employment Offer",
          true,
          "Grille ≥ 60/110, 1 an d’expérience liée dans les 10 dernières années, CLB 4, offre FEER 0–3 et EPA. Vérifier les exclusions professionnelles.",
          "offer",
        );
      else if (teer <= 3 && sector !== "health")
        add(
          "International Skilled Worker: Employment Offer",
          false,
          "Nécessite notamment 60 points, un an d’expérience liée, CLB 4, offre FEER 0–3 et EPA.",
          "offer",
        );
    } else {
      if (yes("ee"))
        add(
          "International Skilled Worker: Saskatchewan Express Entry",
          s.noOfferTotal >= 60 &&
            educated &&
            exp >= 1 &&
            get("excluded") === "no" &&
            get("funds") === "yes",
          "Profil Entrée express valide, 60 points, diplôme lié, expérience qualifiée admissible, profession non exclue, fonds et plan. Conditions propres aux métiers et à la catégorie fédérale.",
          "ee",
        );
      else
        add(
          "International Skilled Worker: Occupations In-Demand",
          s.noOfferTotal >= 60 &&
            educated &&
            exp >= 1 &&
            get("excluded") === "no" &&
            get("funds") === "yes",
          "Sans offre et sans profil Entrée express : grille ≥ 60 points, profession admissible, études et expérience liées, fonds et plan. Vérifier les règles et la disponibilité actuelles.",
          "oid",
        );
    }
    const total = offer ? s.offerTotal : s.noOfferTotal;
    const pieces = [
      ["Formation", s.education],
      ["Expérience 5 dernières années", s.exp5],
      ["Expérience années 6 à 10", s.exp10],
      ["Première langue", s.language1],
      ["Deuxième langue", s.language2],
      ["Âge", s.age],
      ["Facteur II", offer ? s.offerFactor : s.noOfferFactor],
    ];
    out.hidden = false;
    out.innerHTML = `<h2>Résultat de votre évaluation</h2><div class="score"><div><strong>${total}<small> / 110</small></strong><div>Score indicatif - ${offer ? "avec offre" : "sans offre"}</div></div><div><b class="${total >= 60 ? "good" : "warn"}">${total >= 60 ? "Seuil de 60 points atteint" : "Seuil de 60 points non atteint"}</b><p>Facteur I : ${s.f1}/80 · Facteur II : ${offer ? s.offerFactor : s.noOfferFactor}/30</p></div></div><div class="result-grid">${pieces.map(([n, p]) => `<div class="metric">${escape(n)} <strong>${p} pts</strong></div>`).join("")}</div>${reasons.length ? `<h3>Vérifications importantes</h3><ul>${reasons.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>` : ""}<h3>Volets à examiner</h3>${candidates.map((c) => `<article class="program"><h3>${escape(c.title)}</h3><p class="${c.status === "blocked" ? "bad" : c.status === "possible" ? "good" : "warn"}"><strong>${c.status === "blocked" ? "Obstacle d’admissibilité identifié" : c.status === "possible" ? "Critères principaux apparemment satisfaits" : "Vérifications complémentaires nécessaires"}</strong></p><p>${escape(c.detail)}</p>${pages[c.key] ? `<a target="_blank" rel="noopener" href="${base + pages[c.key]}">Consulter les critères officiels →</a>` : ""}</article>`).join("")}<p class="hint">Le score de 110 points concerne uniquement les volets SINP qui utilisent cette grille. Il ne garantit ni l’ouverture du volet, ni une invitation, ni une désignation. Les points de parenté, d’études et de travail en Saskatchewan ne s’ajoutent pas aux 30 points d’une offre d’emploi. Vérifier les documents, le statut, la CNP et les critères de chaque sous-catégorie.</p>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.reportValidity()) assess();
  });
  form.addEventListener("reset", () => {
    out.hidden = true;
  });
})();
