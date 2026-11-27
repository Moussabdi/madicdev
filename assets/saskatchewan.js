"use strict";

const $ = (id) => document.getElementById(id);

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
          "Volet des talents en agriculture",
          agriculture.has(noc) &&
            s.l1 >= 4 &&
            educated &&
            (recent >= 1 || hours >= 780),
          "CNP admissible, secteur de l’employeur (SCIAN pour certains CNP), secondaire, CLB 4 et expérience : 1 an dans les 3 dernières années ou 780 h chez l’employeur. Le champ « expérience récente » doit aussi être vérifié sur 3 ans.",
          "agri",
        );
      if (sector === "health" || health.has(noc))
        add(
          "Volet des talents en santé",
          health.has(noc) &&
            educated &&
            s.l1 >= 5 &&
            (recent >= 1 || hours >= 780),
          "Volet hors Entrée express : CLB 5, formation liée et expérience. Volet Entrée express : CLB 7, profil valide et exigences spécifiques; certaines professions ont des exceptions.",
          "health",
        );
      if (sector === "tech" || tech.has(noc))
        add(
          "Volet des talents en innovation et en technologie",
          tech.has(noc) &&
            educated &&
            (recent >= 1 || hours >= 780) &&
            (hours >= 780 || s.l1 >= 5),
          "Profession parmi les CNP admissibles, diplôme lié, expérience et conditions linguistiques selon la situation chez l’employeur.",
          "tech",
        );
      if (yes("skgrad") && ["pgwp", "study", "cuaet"].includes(permit))
        add(
          "Catégorie des étudiants",
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
          "Travailleurs qualifiés avec un permis de travail valide",
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
          "Travailleurs qualifiés internationaux- Offre d’emploi",
          true,
          "Grille ≥ 60/110, 1 an d’expérience liée dans les 10 dernières années, CLB 4, offre FEER 0–3 et EPA. Vérifier les exclusions professionnelles.",
          "offer",
        );
      else if (teer <= 3 && sector !== "health")
        add(
          "Travailleurs qualifiés internationaux- Offre d’emploi",
          false,
          "Nécessite notamment 60 points, un an d’expérience liée, CLB 4, offre FEER 0–3 et EPA.",
          "offer",
        );
    } else {
      if (yes("ee"))
        add(
          "Travailleurs qualifiés internationaux- Entrée express Saskatchewan",
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
          "Travailleurs qualifiés internationaux- Professions en demande",
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
    out.innerHTML = `<h2>Résultat de votre évaluation</h2><div class="score"><div><strong>${total}<small> / 110</small></strong><div>Score indicatif - ${offer ? "avec offre" : "sans offre"}</div></div><div><b class="${total >= 60 ? "good" : "warn"}">${total >= 60 ? "Seuil de 60 points atteint" : "Seuil de 60 points non atteint"}</b><p><span>Facteur I :</span> ${s.f1}/80 · <span>Facteur II :</span> ${offer ? s.offerFactor : s.noOfferFactor}/30</p></div></div><div class="result-grid">${pieces.map(([n, p]) => `<div class="metric">${escape(n)} <strong>${p} pts</strong></div>`).join("")}</div>${reasons.length ? `<h3>Vérifications importantes</h3><ul>${reasons.map((t) => `<li>${escape(t)}</li>`).join("")}</ul>` : ""}<h3>Volets à examiner</h3>${candidates.map((c) => `<article class="program"><h3>${escape(c.title)}</h3><p class="${c.status === "blocked" ? "bad" : c.status === "possible" ? "good" : "warn"}"><strong>${c.status === "blocked" ? "Obstacle d’admissibilité identifié" : c.status === "possible" ? "Critères principaux apparemment satisfaits" : "Vérifications complémentaires nécessaires"}</strong></p><p>${escape(c.detail)}</p>${pages[c.key] ? `<a target="_blank" rel="noopener" href="${base + pages[c.key]}">Consulter les critères officiels →</a>` : ""}</article>`).join("")}<p class="hint">Le score de 110 points concerne uniquement les volets SINP qui utilisent cette grille. Il ne garantit ni l’ouverture du volet, ni une invitation, ni une désignation. Les points de parenté, d’études et de travail en Saskatchewan ne s’ajoutent pas aux 30 points d’une offre d’emploi. Vérifier les documents, le statut, la CNP et les critères de chaque sous-catégorie.</p>`;
    localizeTree(out);
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

/* Libellés de la navigation, du questionnaire et des résultats. */
const englishLabels = new Map(
  Object.entries({
    Messagerie: "Messaging",
    Échéances: "Deadlines",
    Facturation: "Billing",
    "Outils CRIC": "RCIC tools",
    "Mon espace": "My space",
    "Vue d’ensemble": "Overview",
    "Rendez-vous": "Appointments",
    Finances: "Finance",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Espace professionnel": "Professional workspace",
    "MADIC PORTAIL": "MADIC PORTAL",
    PORTAIL: "PORTAL",
    "Aller au contenu principal": "Skip to main content",
    "Navigation du portail": "Portal navigation",
    "Navigation du compte": "Account navigation",
    "Liens du pied de page": "Footer links",
    "Langue / Language": "Language",
    "Pied de page MADIC / MADIC footer": "MADIC footer",
    "Logo MADIC": "MADIC logo",
    "Page à venir / Page coming soon": "Page coming soon",
    "Impossible de vous déconnecter. Veuillez réessayer.":
      "Unable to sign out. Please try again.",
    "Évaluation préliminaire SINP": "Preliminary SINP assessment",
    "Découvrez les volets à examiner et estimez vos points sur la grille des travailleurs qualifiés internationaux.":
      "Explore the pathways to consider and estimate your points on the International Skilled Worker assessment grid.",
    "Important :": "Important:",
    "Cet outil indépendant n'est ni un service gouvernemental ni une décision d'admissibilité. Le sélecteur officiel de programmes a été archivé le 2 janvier 2026. Les critères, quotas et périodes de réception peuvent changer. Les réponses et pièces justificatives doivent être vérifiées avant toute demande.":
      "This independent tool is neither a government service nor an eligibility decision. The official program selector was archived on January 2, 2026. Criteria, quotas and intake periods may change. Check your answers and supporting documents before applying.",
    "Votre situation": "Your situation",
    Âge: "Age",
    "Lieu de résidence": "Place of residence",
    "Sélectionner...": "Select…",
    "En Saskatchewan": "In Saskatchewan",
    "Ailleurs au Canada": "Elsewhere in Canada",
    "À l'extérieur du Canada": "Outside Canada",
    "Statut actuel au Canada": "Current status in Canada",
    "Permis de travail postdiplôme (PTPD)":
      "Post-graduation work permit (PGWP)",
    "Permis d'études": "Study permit",
    "Permis lié à une EIMT": "LMIA-based work permit",
    "Permis Mobilité francophone": "Francophone Mobility work permit",
    "Permis CUAET": "CUAET work permit",
    "Autre permis de travail": "Other work permit",
    "Permis de travail ouvert pour conjoint": "Spousal open work permit",
    "Autre statut légal": "Other valid status",
    "Sans statut légal / à vérifier": "No valid status / to be verified",
    "Situation relative à une demande d'asile": "Refugee claim status",
    "Aucune demande d'asile en cours": "No pending refugee claim",
    "Demande d'asile en cours au Canada": "Pending refugee claim in Canada",
    "Demande refusée et dossier entièrement réglé":
      "Claim refused and file fully resolved",
    "Situation à vérifier": "Status to be verified",
    "Intention réelle de vivre et travailler en Saskatchewan":
      "Genuine intention to live and work in Saskatchewan",
    Oui: "Yes",
    Non: "No",
    "À déterminer": "Undecided",
    "Si ma demande d'asile a été refusée : tous les membres accompagnants et moi avons quitté le Canada et je possède les documents requis (IMM 0056B ou ARC, selon le cas).":
      "If my refugee claim was refused, all accompanying family members and I have left Canada, and I have the required documents (IMM 0056B or ARC, as applicable).",
    "Offre d'emploi et profession": "Job offer and occupation",
    "Offre d'emploi permanente à temps plein d'un employeur en Saskatchewan":
      "Full-time permanent job offer from an employer in Saskatchewan",
    "Employer Position Assessment (EPA) valide / approuvée":
      "Valid or approved Employer Position Assessment (EPA)",
    "À confirmer": "To be confirmed",
    "Secteur de l'employeur": "Employer’s sector",
    Santé: "Health care",
    "Agriculture / agroalimentaire": "Agriculture / agri-food",
    "Technologie / innovation": "Technology / innovation",
    "Métiers spécialisés": "Skilled trades",
    Énergie: "Energy",
    "Mines et minéraux": "Mining and minerals",
    Fabrication: "Manufacturing",
    "Hébergement / restauration": "Accommodation / food services",
    "Transport routier": "Truck transportation",
    "Commerce de détail": "Retail trade",
    Autre: "Other",
    "Code CNP 2021 (5 chiffres)": "2021 NOC code (5 digits)",
    "Catégorie FEER / TEER": "TEER category",
    "Profession réglementée / permis professionnel requis":
      "Regulated occupation / professional licence required",
    "À vérifier": "To be verified",
    "Formation et expérience": "Education and experience",
    "Plus haut diplôme reconnu / équivalence canadienne":
      "Highest recognized qualification / Canadian equivalency",
    "Maîtrise ou doctorat - 23 points":
      "Master’s degree or doctorate - 23 points",
    "Baccalauréat ou programme ≥ 3 ans - 20 points":
      "Bachelor’s degree or program of 3 years or more - 20 points",
    "Certificat de métier équivalent compagnon - 20 points":
      "Journeyperson-equivalent trade certificate - 20 points",
    "Diplôme postsecondaire de 2 ans - 15 points":
      "Two-year postsecondary diploma - 15 points",
    "Certificat postsecondaire ≥ 2 semestres et < 2 ans - 12 points":
      "Postsecondary certificate of at least 2 semesters and less than 2 years - 12 points",
    "Secondaire ou sans diplôme reconnu - 0 point":
      "Secondary school or no recognized qualification - 0 points",
    "Diplôme d'un établissement de la Saskatchewan":
      "Qualification from a Saskatchewan institution",
    "Études liées à l'emploi envisagé":
      "Studies related to the intended occupation",
    "Années de travail qualifié lié à la profession au cours des 5 dernières années":
      "Years of skilled work related to the occupation in the past 5 years",
    "Moins d'un an": "Less than 1 year",
    "1 an": "1 year",
    "2 ans": "2 years",
    "3 ans": "3 years",
    "4 ans": "4 years",
    "5 ans": "5 years",
    "Années de travail qualifié lié à la profession durant les années 6 à 10 précédentes":
      "Years of skilled work related to the occupation in years 6 to 10",
    "Travail chez l'employeur offrant le poste en Saskatchewan (heures admissibles)":
      "Eligible hours worked for the employer offering the job in Saskatchewan",
    "Expérience récente (années) dans la profession offerte":
      "Recent experience in the offered occupation (years)",
    "Expérience de travail admissible en Saskatchewan (12 mois dans les 5 dernières années)":
      "Eligible work experience in Saskatchewan (12 months in the past 5 years)",
    "Études antérieures en Saskatchewan (une année à temps plein)":
      "Previous studies in Saskatchewan (one year of full-time study)",
    "Langues officielles": "Official languages",
    "Indiquez le niveau le plus faible parmi les quatre compétences d'un test reconnu. Le niveau doit provenir d'un test valide, et non d'une autoévaluation.":
      "Enter the lowest level across all four skills on an approved language test. Use a valid test result rather than a self-assessment.",
    "Tableaux officiels de conversion IRCC":
      "IRCC’s official language equivalency charts",
    "Première langue - test": "First language - test",
    "Aucun test valide": "No valid test",
    "Plus faible CLB/NCLC des 4 compétences - première langue":
      "Lowest CLB/NCLC level across four skills - first language",
    "Aucun / moins de 4": "None / below 4",
    "10 ou plus": "10 or higher",
    "Deuxième langue - test": "Second language - test",
    "Sans objet": "Not applicable",
    "Plus faible CLB/NCLC - deuxième langue":
      "Lowest CLB/NCLC level - second language",
    "Sans objet / moins de 4": "Not applicable / below 4",
    "Liens avec la Saskatchewan et autres critères":
      "Ties to Saskatchewan and other criteria",
    "Parent proche admissible résidant en Saskatchewan":
      "Eligible close relative living in Saskatchewan",
    "Oui, et les conditions de soutien sont satisfaites":
      "Yes, and the support requirements are met",
    "Profil Entrée express et code de validation de recherche d'emploi valides":
      "Valid Express Entry profile and Job Seeker Validation Code",
    "Profession sur la liste des professions exclues (sans offre)":
      "Occupation on the excluded occupations list (without a job offer)",
    "Fonds d'établissement et plan d'établissement (volets sans offre)":
      "Settlement funds and settlement plan (streams without a job offer)",
    "Évaluer mon profil SINP": "Assess my SINP profile",
    Réinitialiser: "Reset",
    "Sources officielles :": "Official sources:",
    "Grille et évaluation SINP": "SINP points grid and assessment",
    "Quotas et périodes de réception 2026": "2026 quotas and intake periods",
    "CNP 2021": "2021 NOC",
    "© MAD Immigration Canadienne - outil d'orientation indépendant. Aucune information n'est envoyée à un serveur par ce formulaire.":
      "© MAD Immigration Canadienne - independent guidance tool. This form does not send any information to a server.",
    "Demande d’asile en cours au Canada : exclusion indiquée par le SINP.":
      "Pending refugee claim in Canada: exclusion identified by the SINP.",
    "Demande d’asile refusée : sortie du Canada et justificatifs requis pour tous les membres accompagnants.":
      "Refused refugee claim: departure from Canada and supporting documents are required for all accompanying family members.",
    "L’intention de s’établir en Saskatchewan est une condition essentielle.":
      "Intention to settle in Saskatchewan is an essential requirement.",
    "L’intention de s’établir en Saskatchewan doit être établie.":
      "Intention to settle in Saskatchewan must be demonstrated.",
    "L’EPA de l’employeur doit être approuvée et validée avant la demande.":
      "The employer’s EPA must be approved and validated before applying.",
    "Vérifier l’autorisation d’exercice et les exigences de l’ordre professionnel, s’il y a lieu.":
      "Verify authorization to practise and the regulator’s requirements, if applicable.",
    "Secteur plafonné en 2026 : vérifier la fenêtre EPA, les quotas et les conditions du permis.":
      "Sector subject to a cap in 2026: check the EPA intake period, quotas and permit conditions.",
    "Vérifier le lien entre les études, la profession et l’offre.":
      "Verify how the studies, occupation and job offer are related.",
    "Statut légal au Canada non établi.":
      "Legal status in Canada has not been established.",
    "CNP admissible, secteur de l’employeur (SCIAN pour certains CNP), secondaire, CLB 4 et expérience : 1 an dans les 3 dernières années ou 780 h chez l’employeur. Le champ « expérience récente » doit aussi être vérifié sur 3 ans.":
      "Eligible NOC, employer’s sector (NAICS for some NOC codes), secondary education, CLB 4 and experience: one year in the past three years or 780 hours with the employer. Verify recent experience against the three-year period.",
    "Volet hors Entrée express : CLB 5, formation liée et expérience. Volet Entrée express : CLB 7, profil valide et exigences spécifiques; certaines professions ont des exceptions.":
      "Non-Express Entry stream: CLB 5, related education and experience. Express Entry stream: CLB 7, a valid profile and specific requirements. Exceptions apply to certain occupations.",
    "Profession parmi les CNP admissibles, diplôme lié, expérience et conditions linguistiques selon la situation chez l’employeur.":
      "Eligible NOC, related qualification, work experience and language requirements based on the applicant’s situation with the employer.",
    "Diplôme obtenu en Saskatchewan, 780 heures liées aux études, offre admissible liée au domaine et EPA. Les titulaires d’un permis d’études doivent avoir une offre dans un secteur prioritaire.":
      "Saskatchewan qualification, 780 hours of work related to the field of study, an eligible job offer related to that field and an EPA. Study permit holders need an offer in a priority sector.",
    "780 heures consécutives avec l’employeur et permis admissible; règles FEER particulières selon le type de permis. CLB 4 si FEER 4 ou 5.":
      "780 consecutive hours with the employer and an eligible permit. Specific TEER rules depend on the permit type. CLB 4 is required for TEER 4 or 5.",
    "Grille ≥ 60/110, 1 an d’expérience liée dans les 10 dernières années, CLB 4, offre FEER 0–3 et EPA. Vérifier les exclusions professionnelles.":
      "At least 60/110 points, one year of related experience in the past 10 years, CLB 4, a TEER 0–3 job offer and an EPA. Check occupation exclusions.",
    "Nécessite notamment 60 points, un an d’expérience liée, CLB 4, offre FEER 0–3 et EPA.":
      "Requirements include 60 points, one year of related experience, CLB 4, a TEER 0–3 job offer and an EPA.",
    "Profil Entrée express valide, 60 points, diplôme lié, expérience qualifiée admissible, profession non exclue, fonds et plan. Conditions propres aux métiers et à la catégorie fédérale.":
      "Valid Express Entry profile, 60 points, a related qualification, eligible skilled experience, an occupation that is not excluded, settlement funds and a settlement plan. Additional requirements vary by trade and federal category.",
    "Sans offre et sans profil Entrée express : grille ≥ 60 points, profession admissible, études et expérience liées, fonds et plan. Vérifier les règles et la disponibilité actuelles.":
      "Without a job offer or Express Entry profile: at least 60 points, an eligible occupation, related education and experience, settlement funds and a settlement plan. Check current rules and availability.",
    Formation: "Education",
    "Expérience 5 dernières années": "Experience in the past 5 years",
    "Expérience années 6 à 10": "Experience in years 6 to 10",
    "Première langue": "First language",
    "Deuxième langue": "Second language",
    "Facteur I :": "Factor I:",
    "Facteur II :": "Factor II:",
    "Facteur II": "Factor II",
    "Résultat de votre évaluation": "Your assessment results",
    "Score indicatif - avec offre": "Estimated score - with a job offer",
    "Score indicatif - sans offre": "Estimated score - without a job offer",
    "Seuil de 60 points atteint": "60-point threshold met",
    "Seuil de 60 points non atteint": "60-point threshold not met",
    "Vérifications importantes": "Important checks",
    "Volets à examiner": "Pathways to consider",
    "Obstacle d’admissibilité identifié": "Eligibility barrier identified",
    "Critères principaux apparemment satisfaits":
      "Key criteria appear to be met",
    "Vérifications complémentaires nécessaires": "Further checks needed",
    "Consulter les critères officiels →": "View official criteria →",
    "Le score de 110 points concerne uniquement les volets SINP qui utilisent cette grille. Il ne garantit ni l’ouverture du volet, ni une invitation, ni une désignation. Les points de parenté, d’études et de travail en Saskatchewan ne s’ajoutent pas aux 30 points d’une offre d’emploi. Vérifier les documents, le statut, la CNP et les critères de chaque sous-catégorie.":
      "The 110-point scale applies only to SINP streams that use this grid. A score does not guarantee that a stream is open or that you will receive an invitation or nomination. Points for relatives, study and work in Saskatchewan are not added to the 30 points for a job offer. Verify documents, status, NOC and the requirements for each subcategory.",
    "PROGRAMME DES CANDIDATS DE LA SASKATCHEWAN · 2026":
      "SASKATCHEWAN IMMIGRANT NOMINEE PROGRAM · 2026",
    "Ex. 32": "E.g. 32",
    "Ex. 21232": "E.g. 21232",
    "Une évaluation préliminaire des volets d’immigration de la Saskatchewan.":
      "A preliminary assessment of Saskatchewan immigration pathways.",
    "Volet des talents en agriculture": "Agriculture Talent Pathway",
    "Volet des talents en santé": "Health Talent Pathway",
    "Volet des talents en innovation et en technologie":
      "Innovation and Tech Talent Pathway",
    "Catégorie des étudiants": "Student Category",
    "Travailleurs qualifiés avec un permis de travail valide":
      "Skilled Worker with Existing Work Permit",
    "Travailleurs qualifiés internationaux- Offre d’emploi":
      "International Skilled Worker: Employment Offer",
    "Travailleurs qualifiés internationaux- Entrée express Saskatchewan":
      "International Skilled Worker: Saskatchewan Express Entry",
    "Travailleurs qualifiés internationaux- Professions en demande":
      "International Skilled Worker: Occupations In-Demand",
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
  return pageLanguage === "en" ? (englishLabels.get(label) ?? label) : label;
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

async function signOutClient() {
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error("Impossible de charger Supabase."));
      };
      document.head.append(script);
    });
  }
  return window.getMadicSupabase();
}

$("logout").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const message = $("madicSignoutError");
  message.hidden = true;
  button.disabled = true;
  try {
    if (typeof window.getMadicSupabase !== "function") {
      throw new Error("Configuration Supabase manquante.");
    }
    const db = await signOutClient();
    const { error } = await db.auth.signOut();
    if (error) throw error;
    location.assign("connexion.html");
  } catch (error) {
    console.error("MADIC sign out failed", error);
    message.hidden = false;
    button.disabled = false;
  }
});

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
    const db = await signOutClient();
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
