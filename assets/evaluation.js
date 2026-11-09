"use strict";
/* MADIC CRS estimator - point tables: IRCC CRS criteria, consulted 2026-10-08.
   No network requests or personal-data storage. */
(() => {
  const $ = (s, root = document) => root.querySelector(s),
    $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let lang = "fr";
  const t = (fr, en) => (lang === "fr" ? fr : en);
  const ED = [
    ["none", "Moins que secondaire", "Less than secondary"],
    ["secondary", "Diplôme secondaire", "Secondary diploma"],
    [
      "one",
      "Diplôme postsecondaire de 1 an",
      "One-year postsecondary credential",
    ],
    [
      "two",
      "Diplôme postsecondaire de 2 ans",
      "Two-year postsecondary credential",
    ],
    [
      "bachelor",
      "Baccalauréat / programme de 3 ans ou plus",
      "Bachelor’s / 3+ year program",
    ],
    [
      "twoDegrees",
      "Deux diplômes, dont un de 3 ans ou plus",
      "Two credentials, one 3+ years",
    ],
    [
      "master",
      "Maîtrise / diplôme professionnel admissible",
      "Master’s / qualifying professional degree",
    ],
    ["phd", "Doctorat", "Doctorate"],
  ];
  const ageWith = {
    18: 90,
    19: 95,
    30: 95,
    31: 90,
    32: 85,
    33: 80,
    34: 75,
    35: 70,
    36: 65,
    37: 60,
    38: 55,
    39: 50,
    40: 45,
    41: 35,
    42: 25,
    43: 15,
    44: 5,
  };
  const ageWithout = {
    18: 99,
    19: 105,
    30: 105,
    31: 99,
    32: 94,
    33: 88,
    34: 83,
    35: 77,
    36: 72,
    37: 66,
    38: 61,
    39: 55,
    40: 50,
    41: 39,
    42: 28,
    43: 17,
    44: 6,
  };
  const educationWith = {
    none: 0,
    secondary: 28,
    one: 84,
    two: 91,
    bachelor: 112,
    twoDegrees: 119,
    master: 126,
    phd: 140,
  };
  const educationWithout = {
    none: 0,
    secondary: 30,
    one: 90,
    two: 98,
    bachelor: 120,
    twoDegrees: 128,
    master: 135,
    phd: 150,
  };
  const spouseEd = {
    none: 0,
    secondary: 2,
    one: 6,
    two: 7,
    bachelor: 8,
    twoDegrees: 9,
    master: 10,
    phd: 10,
  };
  const canadaWith = [0, 35, 46, 56, 63, 70],
    canadaWithout = [0, 40, 53, 64, 72, 80],
    spouseCanada = [0, 5, 7, 8, 9, 10];
  const skills = [
    ["speaking", "Expression orale", "Speaking"],
    ["listening", "Compréhension orale", "Listening"],
    ["reading", "Compréhension écrite", "Reading"],
    ["writing", "Expression écrite", "Writing"],
  ];
  const option = (value, fr, en) =>
    `<option value="${value}" data-fr="${fr}" data-en="${en}">${fr}</option>`;
  $$(".education-options").forEach(
    (sel) => (sel.innerHTML = ED.map((x) => option(...x)).join("")),
  );
  $$(".years-canada").forEach(
    (sel) =>
      (sel.innerHTML = Array.from({ length: 6 }, (_, i) =>
        option(
          i,
          i === 5 ? "5 ans ou plus" : i + " an(s)",
          i === 5 ? "5 years or more" : i + " year(s)",
        ),
      ).join("")),
  );
  $$(".years-foreign").forEach(
    (sel) =>
      (sel.innerHTML = [
        option(0, "Aucune / moins d’un an", "None / less than a year"),
        option(1, "1 an", "1 year"),
        option(2, "2 ans", "2 years"),
        option(3, "3 ans ou plus", "3 years or more"),
      ].join("")),
  );
  $$(".ev-language").forEach((grid) => {
    const prefix = grid.dataset.prefix;
    grid.innerHTML = skills
      .map(
        ([key, fr, en]) =>
          `<label><span data-fr="${fr} (CLB/NCLC)" data-en="${en} (CLB/NCLC)">${fr} (CLB/NCLC)</span><select name="${prefix}_${key}" class="ev-clb">${[0, 4, 5, 6, 7, 8, 9, 10].map((n) => option(n, n === 0 ? "Aucun résultat" : n === 10 ? "10 ou plus" : String(n), n === 0 ? "No result" : n === 10 ? "10 or more" : String(n))).join("")}</select></label>`,
      )
      .join("");
  });
  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    $$("[data-fr][data-en]").forEach((el) => {
      el.textContent = el.dataset[l];
    });
    $$(".ev-lang").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === l);
      b.setAttribute("aria-pressed", String(b.dataset.lang === l));
    });
    $("#pre-result").hidden = true;
    $("#crs-result").hidden = true;
  }
  document
    .querySelectorAll(".language-switcher .lang-btn")
    .forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  function tab(which) {
    $$(".ev-tab").forEach((b) => {
      let on = b.dataset.tab === which;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#panel-pre").hidden = which !== "pre";
    $("#panel-crs").hidden = which !== "crs";
  }
  $$(".ev-tab").forEach((b) =>
    b.addEventListener("click", () => tab(b.dataset.tab)),
  );
  function val(form, name) {
    return form.elements.namedItem(name)?.value || "";
  }
  function num(form, name) {
    return Number(val(form, name)) || 0;
  }
  function languageLevels(form, prefix, valid) {
    return skills.map(([key]) => (valid ? num(form, prefix + "_" + key) : 0));
  }
  function allAt(a, n) {
    return a.every((x) => x >= n);
  }
  function firstPoints(n, spouse) {
    if (n < 4) return 0;
    if (n === 4) return 6;
    if (n === 5) return spouse ? 6 : 6;
    if (n === 6) return spouse ? 8 : 9;
    if (n === 7) return spouse ? 16 : 17;
    if (n === 8) return spouse ? 22 : 23;
    if (n === 9) return spouse ? 29 : 31;
    return spouse ? 32 : 34;
  }
  function secondPoints(n) {
    return n <= 4 ? 0 : n <= 6 ? 1 : n <= 8 ? 3 : 6;
  }
  function spouseLanguagePoints(n) {
    return n <= 4 ? 0 : n <= 6 ? 1 : n <= 8 ? 3 : 5;
  }
  function agePoints(n, spouse) {
    if (n >= 20 && n <= 29) return spouse ? 100 : 110;
    return (spouse ? ageWith : ageWithout)[n] || 0;
  }
  function educationBand(education) {
    if (["none", "secondary"].includes(education)) return 0;
    if (["twoDegrees", "master", "phd"].includes(education)) return 2;
    return 1;
  }
  function transferability(education, first, canada, foreign, trade) {
    const band = educationBand(education),
      seven = allAt(first, 7),
      nine = allAt(first, 9),
      five = allAt(first, 5);
    let eduLang = 0,
      eduCanada = 0,
      foreignLang = 0,
      foreignCanada = 0,
      tradeLang = 0;
    if (band && seven) eduLang = band === 2 ? (nine ? 50 : 25) : nine ? 25 : 13;
    if (band && canada >= 1)
      eduCanada = band === 2 ? (canada >= 2 ? 50 : 25) : canada >= 2 ? 25 : 13;
    if (foreign >= 1 && seven)
      foreignLang = foreign >= 3 ? (nine ? 50 : 25) : nine ? 25 : 13;
    if (foreign >= 1 && canada >= 1)
      foreignCanada =
        foreign >= 3 ? (canada >= 2 ? 50 : 25) : canada >= 2 ? 25 : 13;
    if (trade && five) tradeLang = seven ? 50 : 25;
    return Math.min(
      100,
      Math.min(50, eduLang + eduCanada) +
        Math.min(50, foreignLang + foreignCanada) +
        tradeLang,
    );
  }
  function compute(f) {
    const age = num(f, "age"),
      spouse =
        ["married", "commonlaw"].includes(val(f, "marital")) &&
        val(f, "spouseStatus") === "no" &&
        val(f, "accompany") === "yes";
    const education = val(f, "education");
    const canada = Math.min(5, num(f, "canada")),
      foreign = num(f, "foreign");
    const first = languageLevels(f, "first", val(f, "firstValid") === "yes");
    const second = languageLevels(f, "second", val(f, "secondValid") === "yes");
    const spLevels = languageLevels(
      f,
      "spouse",
      val(f, "spouseValid") === "yes",
    );
    const human =
      agePoints(age, spouse) +
      (spouse ? educationWith : educationWithout)[education] +
      first.reduce((s, n) => s + firstPoints(n, spouse), 0) +
      Math.min(
        spouse ? 22 : 24,
        second.reduce((s, n) => s + secondPoints(n), 0),
      ) +
      (spouse ? canadaWith : canadaWithout)[canada];
    const spouseScore = spouse
      ? spouseEd[val(f, "spouseEducation")] +
        spouseCanada[Math.min(5, num(f, "spouseCanada"))] +
        spLevels.reduce((s, n) => s + spouseLanguagePoints(n), 0)
      : 0;
    const transferable = transferability(
      education,
      first,
      canada,
      foreign,
      val(f, "trade") === "yes",
    );
    const fr = val(f, "firstLanguage") === "fr" ? first : second,
      en = val(f, "firstLanguage") === "en" ? first : second;
    const frenchBonus = allAt(fr, 7)
      ? allAt(en, 5)
        ? 50
        : en.every((n) => n <= 4)
          ? 25
          : 0
      : 0;
    const additional = Math.min(
      600,
      (val(f, "canadianCredential") === "yes"
        ? num(f, "canadianCredentialLevel")
        : 0) +
        (val(f, "sibling") === "yes" ? 15 : 0) +
        (val(f, "pnp") === "yes" ? 600 : 0) +
        frenchBonus,
    );
    return {
      human,
      spouseScore,
      transferable,
      additional,
      total: human + spouseScore + transferable + additional,
      first,
      second,
      spouse,
      age,
      frenchBonus,
    };
  }
  function escapeHTML(s) {
    return String(s).replace(
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
  }
  function showPre(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const warnings = [];
    const age = num(f, "age");
    if (age < 18)
      warnings.push(
        t(
          "Âge inférieur à 18 ans : examiner les conditions propres à chaque programme.",
          "Under 18: review program-specific requirements.",
        ),
      );
    if (val(f, "destination") === "quebec")
      warnings.push(
        t(
          "Entrée express fédérale vise généralement une installation hors Québec. Explorez aussi les programmes québécois.",
          "Federal Express Entry generally requires an intention to settle outside Quebec. Explore Quebec programs as well.",
        ),
      );
    if (val(f, "test") !== "yes")
      warnings.push(
        t(
          "Obtenir un test linguistique officiel valide pour pouvoir établir un profil Entrée express.",
          "Obtain a valid approved language test before creating an Express Entry profile.",
        ),
      );
    if (val(f, "test") === "yes" && val(f, "clb") === "unknown")
      warnings.push(
        t(
          "Vérifier les résultats CLB/NCLC dans les quatre compétences.",
          "Verify CLB/NCLC results across all four skills.",
        ),
      );
    if (val(f, "education") === "post")
      warnings.push(
        t(
          "Pour un diplôme étranger, vérifier l’évaluation des diplômes d’études (EDE).",
          "For foreign credentials, verify the educational credential assessment (ECA).",
        ),
      );
    if (val(f, "canada") === "0" && val(f, "foreign") === "0")
      warnings.push(
        t(
          "Aucune année de travail qualifié indiquée : vérifier les exigences d’expérience de chaque programme.",
          "No full year of skilled work reported: review each program’s work experience requirements.",
        ),
      );
    if (val(f, "test") === "yes" && Number(val(f, "clb")) < 7)
      warnings.push(
        t(
          "Le niveau linguistique déclaré peut limiter l’accès à certains programmes.",
          "The declared language level may limit access to some programs.",
        ),
      );
    if (!warnings.length)
      warnings.push(
        t(
          "Plusieurs éléments de votre profil méritent une analyse détaillée; cela ne confirme pas votre admissibilité.",
          "Several aspects of your profile warrant detailed review; this does not confirm eligibility.",
        ),
      );
    const out = $("#pre-result");
    out.innerHTML = `<h3>${t("Points à examiner", "Items to review")}</h3><ul>${warnings.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul><p>${t("Vous pouvez maintenant estimer votre score SCG, si vous êtes admissible à au moins un programme Entrée express.", "You can now estimate your CRS score, if you qualify for at least one Express Entry program.")}</p><button type="button" class="ev-primary" id="go-crs">${t("Continuer vers le calculateur SCG", "Continue to CRS calculator")}</button>`;
    out.hidden = false;
    $("#go-crs").addEventListener("click", () => {
      tab("crs");
      $("#panel-crs").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  $("#pre-form").addEventListener("submit", showPre);
  function renderScore(e) {
    e.preventDefault();
    const f = e.currentTarget;
    if (
      val(f, "canadianCredential") === "yes" &&
      !val(f, "canadianCredentialLevel")
    ) {
      alert(
        t(
          "Veuillez préciser le niveau de votre diplôme canadien.",
          "Please specify your Canadian credential level.",
        ),
      );
      return;
    }
    const result = compute(f);
    const warnings = [];
    if (val(f, "firstValid") !== "yes")
      warnings.push(
        t(
          "Aucun test valide pour la première langue : les points linguistiques correspondants sont fixés à zéro.",
          "No valid first-language test: corresponding language points are set to zero.",
        ),
      );
    if (val(f, "firstValid") === "yes" && !allAt(result.first, 7))
      warnings.push(
        t(
          "Un niveau inférieur à CLB/NCLC 7 peut empêcher l’accès à certains programmes Entrée express.",
          "A level below CLB/NCLC 7 may prevent eligibility for some Express Entry programs.",
        ),
      );
    if (["married", "commonlaw"].includes(val(f, "marital")) && !result.spouse)
      warnings.push(
        t(
          "Le conjoint non accompagnant ou citoyen/résident permanent est traité selon la grille sans conjoint.",
          "A non-accompanying spouse or citizen/permanent-resident spouse is scored using the without-spouse grid.",
        ),
      );
    const out = $("#crs-result");
    out.innerHTML = `<p class="ev-kicker">${t("SCORE INDICATIF", "ESTIMATED SCORE")}</p><div class="ev-score"><strong>${result.total}</strong><span>/ 1 200 ${t("points", "points")}</span></div><div class="ev-meter" role="progressbar" aria-label="CRS" aria-valuenow="${result.total}" aria-valuemin="0" aria-valuemax="1200"><div style="width:${result.total / 12}%"></div></div><div class="ev-breakdown"><div><span>${t("Capital humain", "Core / human capital")}</span><b>${result.human}</b></div><div><span>${t("Facteurs du conjoint", "Spouse factors")}</span><b>${result.spouseScore}</b></div><div><span>${t("Transférabilité des compétences", "Skill transferability")}</span><b>${result.transferable}</b></div><div><span>${t("Points supplémentaires", "Additional points")}</span><b>${result.additional}</b></div></div>${warnings.length ? `<ul class="ev-warnings">${warnings.map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul>` : ""}<p>${t("Ce résultat ne garantit ni l’admissibilité, ni une invitation, ni la résidence permanente. Comparez-le au calculateur officiel IRCC.", "This result guarantees neither eligibility, an invitation, nor permanent residence. Compare it with the official IRCC calculator.")}</p><a class="ev-primary ev-linkbtn" href="rendezvous.html">${t("Discuter de mon profil avec MADIC", "Discuss my profile with MADIC")}</a>`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  $("#crs-form").addEventListener("submit", renderScore);
  function updateSpouse() {
    const f = $("#crs-form");
    const married = ["married", "commonlaw"].includes(val(f, "marital"));
    $$(".spouse-condition").forEach((el) => (el.hidden = !married));
    const accompanied =
      married &&
      val(f, "spouseStatus") === "no" &&
      val(f, "accompany") === "yes";
    $(".ev-spouse").hidden = !accompanied;
  }
  ["marital", "spouseStatus", "accompany"].forEach((name) =>
    $("#crs-form")
      .elements.namedItem(name)
      .addEventListener("change", updateSpouse),
  );
  $("#crs-form").addEventListener("reset", () => {
    setTimeout(() => {
      updateSpouse();
      $("#crs-result").hidden = true;
    }, 0);
  });
  function updateExtras() {
    const f = $("#crs-form");
    const level = $(".ev-canadian-level");
    const teer = $(".ev-job-teer");
    level.classList.toggle(
      "ev-visible",
      val(f, "canadianCredential") === "yes",
    );
    teer.classList.toggle("ev-visible", val(f, "jobOffer") === "yes");
    level.querySelector("select").required =
      val(f, "canadianCredential") === "yes";
    teer.querySelector("select").required = val(f, "jobOffer") === "yes";
  }
  ["canadianCredential", "jobOffer"].forEach((name) =>
    $("#crs-form")
      .elements.namedItem(name)
      .addEventListener("change", updateExtras),
  );
  $("#crs-form").addEventListener("reset", () => setTimeout(updateExtras, 0));
  updateExtras();

  // Test-specific choices based on the supplied IRCC-style questionnaire.
  // Scores map to CLB/NCLC 4–10; lower bands map to zero CRS language points.
  const TEST_BANDS = {
    ielts: {
      speaking: [
        ["7.5 – 9.0", 10],
        ["7.0", 9],
        ["6.5", 8],
        ["6.0", 7],
        ["5.5", 6],
        ["5.0", 5],
        ["4.0 – 4.5", 4],
        ["0 – 3.5", 0],
      ],
      listening: [
        ["8.5 – 9.0", 10],
        ["8.0", 9],
        ["7.5", 8],
        ["6.0 – 7.0", 7],
        ["5.5", 6],
        ["5.0", 5],
        ["4.5", 4],
        ["0 – 4.0", 0],
      ],
      reading: [
        ["8.0 – 9.0", 10],
        ["7.0 – 7.5", 9],
        ["6.5", 8],
        ["6.0", 7],
        ["5.0 – 5.5", 6],
        ["4.0 – 4.5", 5],
        ["3.5", 4],
        ["0 – 3.0", 0],
      ],
      writing: [
        ["7.5 – 9.0", 10],
        ["7.0", 9],
        ["6.5", 8],
        ["6.0", 7],
        ["5.5", 6],
        ["5.0", 5],
        ["4.0 – 4.5", 4],
        ["0 – 3.5", 0],
      ],
    },
    tef: {
      speaking: [
        ["393–450", 10],
        ["371–392", 9],
        ["349–370", 8],
        ["310–348", 7],
        ["271–309", 6],
        ["226–270", 5],
        ["181–225", 4],
        ["0–180", 0],
      ],
      listening: [
        ["316–360", 10],
        ["298–315", 9],
        ["280–297", 8],
        ["249–279", 7],
        ["217–248", 6],
        ["181–216", 5],
        ["145–180", 4],
        ["0–144", 0],
      ],
      reading: [
        ["263–300", 10],
        ["248–262", 9],
        ["233–247", 8],
        ["207–232", 7],
        ["181–206", 6],
        ["151–180", 5],
        ["121–150", 4],
        ["0–120", 0],
      ],
      writing: [
        ["393–450", 10],
        ["371–392", 9],
        ["349–370", 8],
        ["310–348", 7],
        ["271–309", 6],
        ["226–270", 5],
        ["181–225", 4],
        ["0–180", 0],
      ],
    },
    celpip: Object.fromEntries(
      skills.map(([key]) => [
        key,
        Array.from({ length: 9 }, (_, i) => {
          const n = 12 - i;
          return [String(n), Math.min(10, n)];
        }).concat([["0–3", 0]]),
      ]),
    ),
  };
  function updateTestChoices(prefix) {
    const f = $("#crs-form"),
      test = val(f, prefix + "Test");
    const grid = $(`.ev-raw-grid[data-prefix="${prefix}"]`);
    const manual = $(`.ev-language[data-prefix="${prefix}"]`);
    const available = Boolean(TEST_BANDS[test]);
    const manualMode = test === "pte" || test === "tcf";
    grid.hidden = !available;
    manual.hidden = !manualMode;
    $$(".ev-test-score", grid).forEach((sel) => {
      const skill = sel.name.replace(prefix + "_raw_", "");
      const old = sel.value;
      sel.innerHTML =
        option(
          "",
          t("Sélectionner...", "Select..."),
          t("Sélectionner...", "Select..."),
        ) +
        (TEST_BANDS[test]?.[skill] || [])
          .map(([label, clb]) => option(clb, label, label))
          .join("");
      if ([...sel.options].some((o) => o.value === old)) sel.value = old;
      sel.disabled = !available;
      sel.required = available && val(f, prefix + "Valid") === "yes";
    });
    $$(".ev-clb", manual).forEach((el) => {
      el.disabled = !manualMode;
      el.required = manualMode && val(f, prefix + "Valid") === "yes";
    });
    const help = grid.previous_elementSibling;
  }
  function syncTestLevels(f, prefix) {
    if (!TEST_BANDS[val(f, prefix + "Test")]) return;
    skills.forEach(([skill]) => {
      const raw = f.elements.namedItem(prefix + "_raw_" + skill);
      const clb = f.elements.namedItem(prefix + "_" + skill);
      clb.disabled = false;
      clb.value = raw.value;
    });
  }
  ["first", "second"].forEach((prefix) => {
    ["Test", "Valid"].forEach((suffix) =>
      $("#crs-form")
        .elements.namedItem(prefix + suffix)
        .addEventListener("change", () => updateTestChoices(prefix)),
    );
    updateTestChoices(prefix);
  });
  $("#crs-form").addEventListener(
    "submit",
    () => {
      ["first", "second"].forEach((prefix) =>
        syncTestLevels($("#crs-form"), prefix),
      );
    },
    true,
  );
  $("#crs-form").addEventListener("reset", () =>
    setTimeout(() => ["first", "second"].forEach(updateTestChoices), 0),
  );

  updateSpouse();
  tab("crs");
  setLang(document.documentElement.lang === "en" ? "en" : "fr");
  document.addEventListener("madic:languagechange", (e) =>
    setLang(e.detail?.lang === "en" ? "en" : "fr"),
  );
})();
