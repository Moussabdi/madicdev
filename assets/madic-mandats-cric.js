(() => {
  "use strict";
  const models = {
      etudes: [
        [
          "Phase 1 :",
          "Ouverture du dossier.",
          "Évaluation préliminaire de la situation personnelle et de l'admissibilité de la cliente.",
          "Collecte et examen des documents requis.",
          "Vérification des antécédents d'immigration, le cas échéant.",
          "Préparation de la liste de contrôle des documents.",
        ],
        [
          "Phase 2 :",
          "Vérification de l'admissibilité du programme d'études choisi.",
          "Vérification de la lettre d'acceptation de l'établissement d'enseignement désigné (EED).",
          "Vérification des exigences provinciales applicables.",
          "Vérification des preuves financières.",
          "Préparation du plan d'études.",
          "Préparation des observations écrites et lettres explicatives.",
        ],
        [
          "Phase 3 :",
          "Préparation des formulaires de la demande du permis d’étude.",
          "Soumission de la demande en ligne du permis d’étude en ligne.",
          "Valider et téléverser l’ensemble des documents.",
          "Suivi du dossier du permis d’étude auprès de l’IRCC, les autres services concernés et le client jusqu’à une décision soit prise.",
          "Expliquer la décision au client.",
        ],
      ],
      humanitaire: [
        [
          "Responsabilités et prestations du CRIC :",
          "Ouverture du dossier.",
          "Évaluation du dossier.",
          "Préparation des formulaires de la demande de considérations d’ordre humanitaire.",
          "Préparation du dossier et documents requis (document d’identités, preuves financières).",
          "Rédaction du rapport pour appuyer la demande du client.",
          "Soumission du dossier en ligne.",
          "Valider et téléverser l’ensemble des documents.",
          "Expliquer la décision du gouvernement du Québec.",
        ],
      ],
      famille: [
        [
          "Phase 1 :",
          "Ouverture officielle du dossier du client.",
          "Évaluation complète du dossier de parrainage du client (admissibilité du répondant et de la personne parrainée).",
          "Analyse de la relation conjugale et de la conformité déclarative.",
          "Préparation du dossier et des documents requis :",
          "Documents d’identité ;",
          "Preuves de la relation ;",
          "Preuves financières, le cas échéant.",
          "Remplissage, vérification et validation des formulaires fédéraux requis par IRCC.",
          "Rédaction, s’il y a lieu, d’une lettre explicative ou de soutien afin d’appuyer la demande.",
          "Soumission simultanée de la demande de parrainage et de la demande de résidence permanente au niveau fédéral, via le portail en ligne de l’IRCC.",
          "Réception et vérification de l’accusé de réception de l’IRCC.",
          "Suivi du dossier auprès de l’IRCC, des services concernés et du client jusqu’à ce qu’une décision soit rendue.",
          "Explication claire et détaillée des communications et décisions de l’IRCC au client.",
        ],
        [
          "Phase 2 :",
          "Information et accompagnement concernant les examens médicaux requis.",
          "Information et suivi relatifs à la collecte des données biométriques, le cas échéant.",
          "Préparation du client et de la personne parrainée à une entrevue, si exigée par l’IRCC.",
          "Validation et téléversement de tout document additionnel demandé par l’IRCC.",
          "Suivi continu du traitement du dossier auprès de l’IRCC jusqu’à la décision finale.",
          "Explication de la décision rendue par l’IRCC au client.",
        ],
        [
          "Phase 3 :",
          "Suivi du dépôt du visa de résidence permanente, lorsque la demande est approuvée.",
          "Accompagnement relatif à la confirmation de résidence permanente (CRP).",
          "Validation et transmission de toute instruction finale émise par l’IRCC.",
          "Suivi du dossier auprès de l’IRCC, des services concernés et du client jusqu’à la clôture administrative du dossier.",
          "Explication des prochaines étapes au client, incluant les démarches liées à l’établissement au Canada.",
          "Le CRIC devra fournir au client une copie finale et signée du présent contrat de service professionnel.",
        ],
      ],
      travail: [
        [
          "Phase :",
          "Ouverture du dossier.",
          "Conseil et évaluation du dossier.",
          "Préparation du dossier et documents requis (document d’identités, les autres preuves, etc.).",
          "Rédaction des lettres explicatives en soumettant avec les preuves de la situation complexe pour appuyer la demande de la cliente.",
          "Préparation des formulaires de la demande du permis de travail.",
          "Soumission de la demande en ligne du permis de travail en ligne ou format papier.",
          "Valider et téléverser l’ensemble des documents.",
          "Suivi du dossier du permis de travail auprès de l’IRCC, les autres services concernés et la cliente jusqu’à une décision soit prise.",
          "Expliquer la décision à la cliente.",
        ],
      ],
      retablissement: [
        [
          "Phase :",
          "Ouvrir et administrer le dossier du client ;",
          "Fournir des conseils professionnels et procéder à l’évaluation juridique du dossier ;",
          "Identifier, vérifier et préparer les documents requis (documents d’identité, preuves de statut, pièces justificatives, etc.) ;",
          "Rédiger les lettres explicatives détaillées afin d’appuyer la demande de rétablissement de statut ;",
          "Préparer et compléter les formulaires requis pour la demande de rétablissement de statut ;",
          "Soumettre la demande de rétablissement de statut en ligne ou en format papier, selon le cas ;",
          "Valider et téléverser l’ensemble des documents exigés par IRCC ;",
          "Assurer le suivi du dossier auprès d’IRCC jusqu’à la prise d’une décision ;",
          "Informer la cliente de toute communication ou décision et expliquer le résultat de la demande.",
        ],
      ],
    },
    names = {
      etudes: "Permis d’étude",
      humanitaire: "Considérations d’ordre humanitaire",
      famille: "Regroupement familial",
      travail: "Permis de travail",
      retablissement: "Rétablissement de statut temporaire",
      erar: "Examen des risques avant renvoi (ERAR)",
      supervisa: "Super visa",
      visiteur: "Visiteur",
      asile: "Demandeur d’asile",
      qualifie: "Travailleur qualifié",
      sejour: "Permis de séjour temporaire",
      ave: "Autorisation de voyage électronique (AVE)",
      eic: "Expérience internationale Canada",
      affaires: "Programme d’immigration des gens d’affaires",
    };
  Object.assign(models, {
    humanitaire: [
      [
        "Phase 1 : Ouverture et évaluation du dossier",
        "Ouverture officielle et administration du dossier du client.",
        "Évaluation de la situation personnelle, familiale et migratoire du client.",
        "Analyse des circonstances humanitaires justifiant la demande de résidence permanente.",
        "Vérification des antécédents d’immigration et des décisions antérieures, le cas échéant.",
        "Identification des facteurs humanitaires pertinents, notamment l’établissement au Canada, les liens familiaux, l’intérêt supérieur des enfants concernés et les difficultés en cas de retour.",
        "Préparation de la liste des documents et des éléments de preuve requis.",
      ],
      [
        "Phase 2 : Préparation et soumission de la demande",
        "Collecte, vérification et organisation des documents justificatifs.",
        "Préparation et validation des formulaires requis par IRCC.",
        "Analyse des preuves personnelles, familiales, médicales, sociales et financières pertinentes.",
        "Rédaction des observations écrites et des arguments humanitaires à l’appui de la demande.",
        "Préparation des lettres explicatives et des déclarations nécessaires.",
        "Vérification finale de la conformité et de l’intégralité du dossier.",
        "Soumission de la demande auprès d’IRCC par le canal applicable.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Vérification de la réception de la demande et des communications d’IRCC.",
        "Suivi administratif du dossier auprès d’IRCC.",
        "Préparation et transmission des documents supplémentaires demandés, le cas échéant.",
        "Accompagnement relatif aux examens médicaux et aux données biométriques, si requis.",
        "Information du client concernant les étapes et les communications officielles.",
        "Explication de la décision rendue par IRCC et des prochaines démarches possibles.",
        "Clôture administrative du dossier et remise des documents pertinents au client.",
      ],
    ],
    erar: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle et administration du dossier du client.",
        "Analyse de l’avis d’admissibilité à l’ERAR remis par l’Agence des services frontaliers du Canada (ASFC).",
        "Vérification des délais applicables à la présentation de la demande.",
        "Évaluation des risques personnels auxquels le client pourrait être exposé en cas de renvoi dans son pays de nationalité ou de résidence habituelle.",
        "Examen des demandes d’asile, décisions et procédures d’immigration antérieures, le cas échéant.",
        "Identification des nouveaux éléments de preuve admissibles, lorsque des restrictions s’appliquent.",
        "Préparation de la liste des documents et des preuves nécessaires.",
      ],
      [
        "Phase 2 : Préparation et soumission de la demande",
        "Préparation, vérification et validation du formulaire de demande d’ERAR (IMM 5508).",
        "Collecte et examen des documents d’identité, des documents personnels et des pièces justificatives.",
        "Analyse des rapports sur les droits de la personne et de la situation dans le pays d’origine.",
        "Préparation des témoignages écrits, déclarations et documents démontrant les risques personnels.",
        "Rédaction des observations écrites détaillées exposant les risques de persécution, de torture, de menace à la vie ou de traitements cruels et inusités, selon les critères applicables.",
        "Vérification des traductions et des documents justificatifs.",
        "Soumission de la demande dans les délais prescrits, par le canal autorisé.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Suivi du dossier auprès d’IRCC et des autorités concernées.",
        "Réception et analyse des communications officielles.",
        "Préparation et transmission de renseignements ou de preuves supplémentaires, lorsque permis ou demandés.",
        "Préparation du client à une éventuelle audience, si celle-ci est prévue au mandat et relève des activités autorisées du CRIC.",
        "Information du client sur l’évolution de sa demande.",
        "Communication et explication de la décision rendue.",
        "Information concernant les prochaines étapes et les recours éventuels, sans inclure une nouvelle procédure de représentation non prévue au contrat.",
        "Clôture administrative du dossier.",
      ],
    ],
    supervisa: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle du dossier.",
        "Évaluation de l’admissibilité du demandeur au programme de super visa.",
        "Vérification du statut de citoyen canadien ou de résident permanent de l’enfant ou du petit-enfant invitant.",
        "Vérification des exigences financières applicables à la personne invitante.",
        "Analyse des documents démontrant le lien de parenté.",
        "Vérification des exigences relatives à l’assurance médicale privée.",
        "Préparation de la liste des documents nécessaires, notamment la lettre d’invitation, les preuves financières et les documents d’identité.",
        "Examen des antécédents d’immigration du demandeur, le cas échéant.",
      ],
      [
        "Phase 2 : Préparation, soumission et suivi",
        "Collecte et validation de l’ensemble des documents requis.",
        "Préparation des formulaires et de la demande de super visa.",
        "Vérification de la lettre d’invitation et des preuves de soutien financier.",
        "Vérification des documents d’assurance médicale et des autres exigences applicables.",
        "Rédaction des lettres explicatives, au besoin.",
        "Soumission de la demande dans le portail approprié d’IRCC.",
        "Accompagnement concernant les données biométriques et l’examen médical, le cas échéant.",
        "Suivi du dossier auprès d’IRCC jusqu’à la décision.",
        "Explication de la décision et des formalités nécessaires avant le voyage.",
      ],
    ],
    visiteur: [
      [
        "Phase 1 : Évaluation et préparation de la demande",
        "Ouverture officielle du dossier du client.",
        "Évaluation de l’admissibilité à une demande de visa de visiteur.",
        "Analyse du motif du séjour au Canada : tourisme, visite familiale, affaires ou autre motif admissible.",
        "Vérification des antécédents de voyage et d’immigration du client.",
        "Évaluation des preuves financières et des moyens de subsistance pendant le séjour.",
        "Analyse des attaches personnelles, familiales, professionnelles et économiques dans le pays de résidence.",
        "Préparation de la liste des documents requis.",
      ],
      [
        "Phase 2 : Soumission et suivi de la demande",
        "Préparation et validation des formulaires requis par IRCC.",
        "Collecte et vérification des documents d’identité et des justificatifs de voyage.",
        "Préparation des lettres explicatives et de soutien, si nécessaire.",
        "Vérification des lettres d’invitation et des preuves d’hébergement, le cas échéant.",
        "Validation et téléversement des documents.",
        "Soumission de la demande de visa de visiteur auprès d’IRCC.",
        "Accompagnement concernant la collecte des données biométriques, si applicable.",
        "Suivi du dossier jusqu’à la décision.",
        "Explication de la décision et des prochaines démarches au client.",
      ],
    ],
    asile: [
      [
        "Phase 1 : Évaluation et ouverture du dossier",
        "Ouverture officielle et administration du dossier du demandeur d’asile.",
        "Évaluation préliminaire de la situation personnelle et migratoire du client.",
        "Analyse des motifs invoqués à l’appui de la demande de protection.",
        "Vérification des conditions d’admissibilité et des restrictions applicables à la présentation d’une demande d’asile.",
        "Examen des antécédents d’immigration, des demandes antérieures et des documents disponibles.",
        "Identification des risques de persécution ou d’autres risques pertinents en cas de retour au pays d’origine.",
        "Préparation de la liste des documents et des éléments de preuve nécessaires.",
      ],
      [
        "Phase 2 : Préparation et présentation de la demande",
        "Collecte, examen et organisation des documents justificatifs.",
        "Assistance à la préparation du formulaire Fondement de la demande d’asile (FDA).",
        "Préparation et vérification des renseignements personnels et des antécédents du demandeur.",
        "Assistance à la rédaction du récit personnel exposant les événements et les risques invoqués, conformément aux déclarations du client.",
        "Examen des documents de preuve, des témoignages et des renseignements pertinents sur le pays d’origine.",
        "Préparation et validation des formulaires nécessaires.",
        "Assistance à la présentation de la demande d’asile auprès d’IRCC ou de l’ASFC, selon la procédure applicable.",
        "Vérification des accusés de réception et des communications officielles.",
      ],
      [
        "Phase 3 : Préparation à l’audience et suivi",
        "Suivi administratif du dossier auprès des autorités compétentes.",
        "Vérification des communications et des échéances de la Section de la protection des réfugiés (SPR).",
        "Préparation des documents et éléments de preuve complémentaires.",
        "Accompagnement du client dans la préparation de son témoignage.",
        "Explication du déroulement de l’audience et des obligations procédurales.",
        "Représentation du client devant la SPR, uniquement si le CRIC possède l'autorisation professionnelle requise et si cette prestation est expressément prévue au mandat.",
        "Communication et explication de la décision rendue.",
        "Information du client sur les prochaines étapes et les recours éventuels.",
        "Clôture administrative du dossier.",
      ],
    ],
    qualifie: [
      [
        "Phase 1 : Évaluation de l’admissibilité et sélection du programme",
        "Ouverture officielle du dossier du client.",
        "Évaluation du profil personnel, professionnel et migratoire du client.",
        "Analyse de l’expérience professionnelle selon la Classification nationale des professions (CNP).",
        "Vérification des compétences linguistiques et des résultats des tests reconnus.",
        "Analyse des diplômes et des évaluations des diplômes d’études (EDE), le cas échéant.",
        "Vérification des exigences financières applicables.",
        "Évaluation de l’admissibilité au programme des travailleurs qualifiés fédéral ou à un autre programme approprié.",
        "Analyse des critères de sélection et du système de classement applicable.",
        "Préparation d’une stratégie d’immigration et de la liste des documents requis.",
      ],
      [
        "Phase 2 : Préparation du profil et démarches de sélection",
        "Collecte et vérification des documents personnels, professionnels et scolaires.",
        "Vérification des attestations d’emploi et des preuves d’expérience professionnelle.",
        "Validation des résultats linguistiques et des évaluations des diplômes.",
        "Calcul et vérification des points de sélection applicables.",
        "Préparation et soumission du profil Entrée express, lorsque ce programme est retenu.",
        "Suivi du profil et des rondes d’invitations.",
        "Mise à jour du profil en cas de modification de la situation du client.",
        "Analyse de l’invitation à présenter une demande de résidence permanente, si reçue.",
      ],
      [
        "Phase 3 : Demande de résidence permanente et suivi",
        "Préparation des formulaires de résidence permanente après réception d’une invitation, lorsque applicable.",
        "Collecte et validation des documents justificatifs définitifs.",
        "Vérification des preuves financières, des certificats de police et des autres documents requis.",
        "Préparation des lettres explicatives et des observations écrites, au besoin.",
        "Soumission de la demande de résidence permanente auprès d’IRCC.",
        "Accompagnement concernant les données biométriques et les examens médicaux, le cas échéant.",
        "Suivi du dossier auprès d’IRCC jusqu’à la décision finale.",
        "Explication de la décision et des formalités relatives à la confirmation de résidence permanente.",
        "Clôture administrative du dossier.",
      ],
    ],
    sejour: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle du dossier.",
        "Évaluation de la situation personnelle et migratoire du client.",
        "Analyse des motifs d’interdiction de territoire ou de non-conformité aux exigences d’immigration, selon le cas.",
        "Évaluation des circonstances justifiant une demande de permis de séjour temporaire.",
        "Examen des antécédents d’immigration et des décisions antérieures.",
        "Identification des éléments démontrant les motifs impérieux ou les circonstances particulières justifiant la demande.",
        "Préparation de la liste des documents et des preuves nécessaires.",
      ],
      [
        "Phase 2 : Préparation, soumission et suivi",
        "Collecte et validation des documents d’identité et des pièces justificatives.",
        "Préparation des formulaires applicables à la demande de permis de séjour temporaire.",
        "Rédaction d’une lettre explicative détaillée présentant les circonstances particulières du client.",
        "Préparation des observations écrites et des preuves à l’appui de la demande.",
        "Vérification de la conformité et de l’intégralité du dossier.",
        "Soumission de la demande auprès de l’autorité compétente, selon le lieu de présentation et la procédure applicable.",
        "Suivi du dossier auprès d’IRCC ou de l’ASFC, selon le cas.",
        "Réponse aux demandes de renseignements supplémentaires.",
        "Communication et explication de la décision rendue.",
        "Information du client sur les conditions et la durée du permis, en cas d’approbation.",
      ],
    ],
    ave: [
      [
        "Phase 1 : Évaluation, préparation et soumission",
        "Ouverture et administration du dossier du client.",
        "Vérification de l’admissibilité à une autorisation de voyage électronique (AVE).",
        "Vérification de la nationalité et de la validité du passeport du demandeur.",
        "Analyse des antécédents d’immigration et de voyage, le cas échéant.",
        "Vérification des renseignements personnels nécessaires à la demande.",
        "Préparation et remplissage du formulaire électronique d’AVE.",
        "Validation des renseignements saisis avant la soumission.",
        "Soumission de la demande d’AVE sur le site officiel du gouvernement du Canada.",
        "Vérification de la réception de la confirmation de soumission.",
        "Suivi de la demande et communication de la décision au client.",
        "Vérification des renseignements de l’AVE approuvée et explication des conditions applicables au voyage.",
      ],
    ],
    eic: [
      [
        "Phase 1 : Évaluation et création du profil",
        "Ouverture officielle du dossier du client.",
        "Évaluation de l’admissibilité au programme Expérience internationale Canada.",
        "Vérification des conditions liées à la nationalité, à l’âge et aux ententes applicables.",
        "Analyse de la catégorie appropriée : Vacances-travail, Jeunes professionnels ou Stage coop international.",
        "Vérification des exigences relatives à l’offre d’emploi ou au stage, lorsque applicable.",
        "Collecte et vérification des documents personnels requis.",
        "Préparation et soumission du profil EIC dans le bassin approprié.",
        "Vérification de la confirmation de soumission du profil.",
      ],
      [
        "Phase 2 : Invitation et demande de permis de travail",
        "Suivi du profil EIC et des communications d’IRCC.",
        "Vérification de l’invitation à présenter une demande de permis de travail, si reçue.",
        "Information du client sur les délais applicables à l’acceptation de l’invitation et à la soumission de la demande.",
        "Préparation et validation des formulaires de demande de permis de travail.",
        "Collecte et vérification des documents justificatifs.",
        "Vérification de l’offre d’emploi et des renseignements de l’employeur, lorsque requis.",
        "Préparation des lettres explicatives, si nécessaire.",
        "Soumission de la demande de permis de travail auprès d’IRCC.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Vérification de la réception de la demande.",
        "Accompagnement concernant les données biométriques, le cas échéant.",
        "Suivi du dossier auprès d’IRCC.",
        "Préparation et transmission des documents supplémentaires demandés.",
        "Communication des mises à jour au client.",
        "Explication de la décision rendue par IRCC.",
        "Vérification de la lettre d'introduction au point d'entrée, en cas d'approbation.",
        "Information du client concernant les documents nécessaires à son arrivée au Canada.",
        "Clôture administrative du dossier.",
      ],
    ],
    affaires: [
      [
        "Phase 1 : Évaluation du profil et admissibilité",
        "Ouverture officielle et administration du dossier du client.",
        "Évaluation de la situation personnelle, professionnelle, financière et migratoire.",
        "Analyse de l’expérience entrepreneuriale, de gestion ou de travail autonome du client.",
        "Vérification de l’admissibilité au programme d’immigration des gens d’affaires applicable.",
        "Évaluation des exigences relatives aux actifs, aux investissements et à la provenance des fonds, selon le programme.",
        "Analyse des critères linguistiques, professionnels et financiers applicables.",
        "Vérification des exigences particulières du programme québécois ou fédéral retenu.",
        "Préparation de la stratégie d’immigration et de la liste des documents requis.",
      ],
      [
        "Phase 2 : Préparation et soumission du dossier de sélection",
        "Collecte et vérification des documents personnels, professionnels et financiers.",
        "Analyse des preuves d’expérience en gestion ou en entrepreneuriat.",
        "Vérification des documents relatifs aux entreprises, aux actifs et aux investissements.",
        "Préparation et validation des formulaires exigés par le programme sélectionné.",
        "Préparation des lettres explicatives et des observations écrites.",
        "Assistance à la préparation des documents relatifs au projet d’affaires, lorsque requis.",
        "Préparation et soumission du dossier auprès de l’autorité provinciale ou fédérale compétente.",
        "Suivi du dossier de sélection et des demandes de documents complémentaires.",
        "Explication de la décision de sélection, le cas échéant.",
      ],
      [
        "Phase 3 : Demande de résidence permanente et suivi",
        "Vérification de l’obtention du Certificat de sélection du Québec (CSQ), lorsque requis.",
        "Préparation des formulaires fédéraux de résidence permanente.",
        "Collecte et validation des documents d’identité, des certificats de police et des documents familiaux.",
        "Vérification des documents financiers et des preuves supplémentaires exigées.",
        "Préparation et soumission de la demande de résidence permanente auprès d’IRCC.",
        "Accompagnement concernant les données biométriques et les examens médicaux, le cas échéant.",
        "Suivi du traitement du dossier auprès d’IRCC.",
        "Préparation et transmission des documents additionnels demandés.",
        "Communication et explication de la décision finale.",
        "Accompagnement relatif à la confirmation de résidence permanente.",
        "Clôture administrative du dossier.",
      ],
    ],
  });
  const form = document.getElementById("contractForm"),
    select = document.getElementById("madicTypeService"),
    textarea = document.getElementById("madicPrestations"),
    target = document.getElementById("madicPrestationsDocument"),
    service = document.getElementById("madicServiceDocument");
  if (!form || !select || !textarea || !target) return;
  const objet = form.elements.namedItem("objet");
  const formatted = (k) =>
    (
      models[k] || [
        ["Responsabilités et prestations du CRIC :", "À compléter."],
      ]
    )
      .map(
        (group) =>
          group[0] +
          "\n" +
          group
            .slice(1)
            .map((x) => "• " + x)
            .join("\n"),
      )
      .join("\n\n");
  const saved = new Map();
  let previous = select.value;
  function update() {
    service.textContent =
      "Type de service d’immigration : " + names[select.value];
    target.replaceChildren();
    const lines = textarea.value.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const p = document.createElement("p");
      if (
        /^Phase(?:\s+\d+)?\s*:/i.test(line) ||
        line === "Responsabilités et prestations du CRIC :"
      ) {
        p.className = "contract-phase";
        p.textContent = line;
      } else if (line.startsWith("•")) {
        p.className = "contract-bullet";
        p.textContent = line;
      } else {
        p.textContent = line;
      }
      target.append(p);
    }
    document.querySelectorAll("[data-madic-study-only]").forEach((el) => {
      el.hidden = select.value !== "etudes";
    });
    document.querySelectorAll(".contract-fee-table").forEach((table) => {
      table.dataset.madicFeeReview = String(select.value !== "etudes");
    });
  }
  select.addEventListener("change", () => {
    saved.set(previous, { text: textarea.value, objet: objet.value });
    previous = select.value;
    const draft = saved.get(previous);
    textarea.value = draft ? draft.text : formatted(previous);
    objet.value = draft
      ? draft.objet
      : {
          etudes: "Demande de permis d’études",
          humanitaire:
            "Demande de résidence permanente pour considérations d’ordre humanitaire",
          famille: "Demande de regroupement familial",
          travail: "Demande de permis de travail",
          retablissement:
            "Demande de rétablissement du statut de résident temporaire",
          erar: "Demande d’examen des risques avant renvoi (ERAR)",
          supervisa: "Demande de super visa",
          visiteur: "Demande de visa de visiteur",
          asile: "Demande d’asile",
          qualifie: "Demande d’immigration à titre de travailleur qualifié",
          sejour: "Demande de permis de séjour temporaire",
          ave: "Demande d’autorisation de voyage électronique (AVE)",
          eic: "Demande dans le cadre d’Expérience internationale Canada",
          affaires:
            "Demande dans le cadre du Programme d’immigration des gens d’affaires",
        }[previous];
    update();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
  textarea.addEventListener("input", update);
  form.addEventListener("input", () => queueMicrotask(update));
  document.getElementById("contractPreview")?.addEventListener("click", update);
  window.addEventListener("beforeprint", update);
  textarea.value = formatted(select.value);
  objet.value = objet.value || "Demande de permis d’études";
  update();
})();

/* MADIC : synchronisation des prestations et de la facturation, 1 à 3 phases. */
(() => {
  "use strict";
  const form = document.getElementById("contractForm"),
    count = document.getElementById("madicPhaseCount"),
    service = document.getElementById("madicTypeService"),
    prestations = document.getElementById("madicPrestations"),
    rows = document.getElementById("madicPhaseFeeRows"),
    balance = document.getElementById("madicPhaseBalance");
  if (!form || !count || !service || !prestations || !rows || !balance) return;
  const field = (k) => form.elements.namedItem(k);
  const defaults = {
    etudes: 3,
    humanitaire: 3,
    famille: 3,
    travail: 1,
    retablissement: 1,
    erar: 3,
    supervisa: 2,
    visiteur: 2,
    asile: 3,
    qualifie: 3,
    sejour: 2,
    ave: 1,
    eic: 3,
    affaires: 3,
  };
  const phaseTitlesByService = {
    "etudes": [
        "Ouverture et préparation du dossier",
        "Vérification des exigences et préparation des documents",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "humanitaire": [
        "Ouverture et évaluation du dossier",
        "Préparation et soumission de la demande",
        "Suivi du dossier et décision"
    ],
    "famille": [
        "Évaluation, préparation et soumission du dossier de parrainage",
        "Traitement de la demande et suivi auprès d’IRCC",
        "Confirmation de résidence permanente et finalisation du dossier"
    ],
    "travail": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "retablissement": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "erar": [
        "Évaluation des risques et préparation du dossier",
        "Préparation des observations et soumission de la demande",
        "Suivi de la procédure et décision"
    ],
    "supervisa": [
        "Évaluation de l’admissibilité et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "visiteur": [
        "Évaluation et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "asile": [
        "Ouverture et évaluation du dossier de protection",
        "Préparation et présentation de la demande d’asile",
        "Préparation à l’audience, représentation autorisée et suivi"
    ],
    "qualifie": [
        "Évaluation de l’admissibilité et sélection du programme",
        "Préparation du profil et démarches de sélection",
        "Demande de résidence permanente et suivi"
    ],
    "sejour": [
        "Évaluation de l’admissibilité et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "ave": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "eic": [
        "Évaluation de l’admissibilité et création du profil",
        "Invitation et préparation de la demande de permis de travail",
        "Suivi de la demande et décision"
    ],
    "affaires": [
        "Évaluation du profil et de l’admissibilité",
        "Préparation et soumission du dossier de sélection",
        "Demande de résidence permanente et suivi"
    ]
};
  const drafts = new Map();
  let currentService = service.value;
  let countManuallyChanged = false;
  const money = (v) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n) && n >= 0
      ? n.toLocaleString("fr-CA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + " $ CA"
      : "À convenir";
  };
  function headings() {
    return phaseTitlesByService[service.value] || [];
  }
  function modelCount() {
    return defaults[service.value] || 1;
  }
  function save() {
    drafts.set(currentService, {
      count: count.value,
      manual: countManuallyChanged,
      phases: [1, 2, 3].map((i) => ({
        trigger: field("phaseDeclencheur" + i).value,
        amount: field("phase" + i).value,
      })),
    });
  }
  function setService() {
    const saved = drafts.get(service.value),
      names = headings();
    countManuallyChanged = saved?.manual || false;
    count.value = saved?.count || String(modelCount());
    for (let i = 1; i <= 3; i++) {
      const old = saved?.phases[i - 1],
        title = field("phaseTitre" + i);
      // Intitulé fixe pour cette phase et ce service, sans liste déroulante.
      title.value = names[i - 1] || "Phase " + i;
      field("phaseDeclencheur" + i).value =
        old?.trigger ?? "À l’exécution des prestations de la phase " + i;
      field("phase" + i).value = old?.amount ?? "";
    }
    render();
  }
  function render() {
    const n = Math.max(1, Math.min(3, Number(count.value) || 1));
    for (let i = 1; i <= 3; i++) {
      const group = form.querySelector('[data-madic-phase="' + i + '"]');
      if (group) {
        group.hidden = i > n;
        for (const input of group.querySelectorAll("input, select"))
          input.disabled = i > n;
      }
    }
    rows.replaceChildren();
    let total = 0,
      complete = true;
    for (let i = 1; i <= n; i++) {
      const tr = document.createElement("tr"),
        title = field("phaseTitre" + i).value.trim() || "Phase " + i,
        trigger = field("phaseDeclencheur" + i).value.trim(),
        amount = field("phase" + i).value,
        parsed = Number(amount);
      if (amount === "" || !Number.isFinite(parsed) || parsed < 0)
        complete = false;
      else total += parsed;
      const cells = [
        title + (trigger ? " - " + trigger : ""),
        money(amount),
        i === 1 ? money(field("avance")?.value || "") : "-",
        i === n
          ? "Biométrie : " +
            money(field("fraisBio")?.value || "") +
            " ; autres frais gouvernementaux : " +
            money(field("fraisPermis")?.value || "")
          : "-",
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      rows.append(tr);
    }
    const agreed = field("tarif")?.value || "";
    const amount = Number(agreed);
    if (agreed !== "" && Number.isFinite(amount)) {
      balance.textContent =
        "Total des phases : " +
        money(String(total)) +
        " ; total convenu incluant les frais gouvernementaux : " +
        money(agreed) +
        ".";
    } else {
      balance.textContent =
        "Total des phases : " +
        (complete
          ? money(String(total))
          : "renseignez les montants des phases actives") +
        ".";
    }
    // Signaler les écarts au lieu de présenter un total trompeur.
    const feeBio = field("fraisBio")?.value || "";
    const feePermit = field("fraisPermis")?.value || "";
    const extras = [feeBio, feePermit].reduce((sum, v) => sum + (v !== "" && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : 0), 0);
    const agreedCents = Math.round(Number(agreed) * 100);
    const calculatedCents = Math.round(total * 100) + extras;
    const mismatch = complete && agreed !== "" && Number.isFinite(agreedCents) && agreedCents !== calculatedCents;
    balance.dataset.mismatch = String(mismatch);
    if (mismatch) balance.textContent += " Attention : le total convenu ne correspond pas à la somme des phases et des frais.";
  }
  service.addEventListener("change", () => {
    save();
    currentService = service.value;
    queueMicrotask(setService);
  });
  count.addEventListener("change", () => {
    countManuallyChanged = true;
    render();
    save();
  });
  prestations.addEventListener("input", () => {
    // Phase titles are chosen from the service-specific list, independently
    // from editable professional prestations.
    if (!countManuallyChanged) count.value = String(modelCount());
    render();
  });
  form.addEventListener("input", (e) => {
    if (e.target !== prestations) render();
  });
  form.addEventListener("change", (e) => {
    render();
  });
  document.getElementById("contractPreview")?.addEventListener("click", render);
  window.addEventListener("beforeprint", render);
  setService();
})();

/* MADIC : total convenu = phases actives + frais de permis + biométrie. */
(() => {
  "use strict";
  const form = document.getElementById("contractForm"),
    count = document.getElementById("madicPhaseCount");
  if (!form || !count) return;
  const field = (k) => form.elements.namedItem(k),
    tarif = field("tarif");
  if (!tarif) return;
  tarif.readOnly = true;
  tarif.title =
    "Calcul automatique : phases actives + frais de permis d’études + frais biométriques";
  const number = (k) => {
    const el = field(k);
    if (!el || String(el.value).trim() === "") return null;
    const v = Number(el.value);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  let scheduled = false;
  function calculate() {
    scheduled = false;
    const n = Math.max(1, Math.min(3, Number(count.value) || 1));
    let cents = 0,
      hasValue = false;
    for (let i = 1; i <= n; i++) {
      const v = number("phase" + i);
      if (v !== null) {
        cents += Math.round(v * 100);
        hasValue = true;
      }
    }
    for (const key of ["fraisPermis", "fraisBio"]) {
      const v = number(key);
      if (v !== null) {
        cents += Math.round(v * 100);
        hasValue = true;
      }
    }
    const next = hasValue ? (cents / 100).toFixed(2) : "";
    if (tarif.value !== next) {
      tarif.value = next;
      tarif.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(calculate);
  }
  form.addEventListener("input", (e) => {
    if (
      ["phase1", "phase2", "phase3", "fraisPermis", "fraisBio"].includes(
        e.target?.name,
      )
    )
      schedule();
  });
  form.addEventListener("change", (e) => {
    if (
      e.target === count ||
      e.target?.id === "madicTypeService" ||
      ["phase1", "phase2", "phase3", "fraisPermis", "fraisBio"].includes(
        e.target?.name,
      )
    )
      setTimeout(schedule, 0);
  });
  document
    .getElementById("contractPreview")
    ?.addEventListener("click", schedule);
  window.addEventListener("beforeprint", calculate);
  schedule();
})();
