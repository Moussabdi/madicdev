///////////////////////////////////////////////////////////
/* Mobile*/
const menu = document.querySelector("#mobile-menu");
const menuLinks = document.querySelector(".navbar__menu");
const navLogo = document.querySelector("#navbar__logo");
const consultationDate = document.getElementById("consultation_date");

if (consultationDate) {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  consultationDate.min = `${year}-${month}-${day}`;
}

const translations = {
  fr: {
    pageTitle: "MAD Immigration Canada",
    pageDescription:
      "MAD Immigration Canadienne inc. est une entreprise canadienne spécialisée dans l’immigration et la citoyenneté canadiennes.",

    "nav.home": "Accueil",
    "nav.about": "À propos",
    "nav.services": "Nos services",
    "nav.packages": "Nos forfaits",
    "nav.contact": "Nous joindre",
    "nav.career": "Carrière",
    "nav.evaluation": "Évaluation préliminaire",

    "hero.title": "Le Canada, un choix de vie gagnant!",
    "hero.subtitle":
      "MADIC est une entreprise spécialisée dans l’immigration et la citoyenneté canadiennes, qui se démarque par la qualité de ses services et ses tarifs concurrentiels.",
    "hero.button": "Voir nos services",

    "about.title": "Qui sommes-nous?",
    "about.description":
      "Nous sommes une entreprise dynamique œuvrant dans le domaine de l’immigration canadienne. Notre équipe offre des services de consultation, de coaching spécialisé et d’accompagnement personnalisé en immigration économique, regroupement familial, résidence temporaire et dossiers humanitaires. Notre approche vise à simplifier les démarches en immigration et en citoyenneté grâce à l’utilisation d’outils technologiques modernes. Nous accordons également une grande importance à la confidentialité des dossiers et à l’accessibilité de nos conseillers tout au long du processus.",

    "footer.contact": "Contactez-nous",
    "footer.account": "Compte",
    "footer.createAccount": "Créer un compte",
    "footer.register": "S’inscrire",
    "footer.company": "Entreprise",
    "footer.about": "À propos de MADIC",
    "footer.business": "Affaires",
    "footer.partners": "Partenaires",
    "footer.career": "Carrière",
    "footer.resources": "Ressources",
    "footer.directory": "Répertoire de l’immigration",
    "footer.help": "Centre d’aide",
    "footer.privacy": "Confidentialité et conditions",
    "footer.copyright": "Tous les droits réservés.",
    "footer.account": "Compte",
    "footer.createAccount": "Créer un compte",
    "footer.register": "S'inscrire",
    "footer.android": "Android",

    "footer.company": "Compagnie",
    "footer.about": "À propos de MADIC",
    "footer.business": "Affaires",
    "footer.partners": "Partenaires",
    "footer.career": "Carrière",

    "footer.resources": "Ressources",
    "footer.directory": "Répertoire Immigration",
    "footer.help": "Centre d'aide",
    "footer.privacy": "Confidentialité et conditions",

    /*blogue.html*/

    "blog.title": "Blogue",
    "blog.published": "Publié le",

    "blog.article1.title": "Regroupement familial",
    "blog.article1.date": "07 juillet 2020",
    "blog.article1.imageAlt": "Regroupement familial au Canada",

    "blog.article1.paragraph1":
      "Regroupement familial: attendre longtemps ou agir vite! Le Conseil constitutionnel a posé comme principe que le droit pour les étrangers de mener une vie familiale normale « comporte en particulier la faculté pour ces étrangers de faire venir auprès d’eux leurs conjoints et leurs enfants mineurs sous réserve de restrictions tenant à la sauvegarde de l’ordre public et à la protection de la santé publique, lesquelles revêtent le caractère d’objectifs de valeur constitutionnelle » [1]. En pratique, pour se faire rejoindre par sa famille quand on est étranger, il faut savoir être patient. Mais pas trop tout de même... A juste titre, la Halde (Haute Autorité de lutte contre les discriminations et pour l’égalité) contestait le caractère particulièrement restrictif des conditions de regroupement familial telles qu’elles résultent de la législation française, et tout particulièrement de celle tenant aux ressources stables et suffisantes [2].",

    "blog.article1.paragraph2":
      "Depuis 2004, le regroupement familial est devenu le motif le moins courant d’immigration familiale. Ceci s’explique par le fait que, depuis 2003, le nombre d’étrangers non communautaires admis au séjour dans le cadre du regroupement familial a considérablement chuté. Un des facteurs dissuasifs de la procédure de regroupement familial est la durée d’instruction des demandes, qui atteint généralement une ou plusieurs années. Pourtant, la procédure de regroupement familial est encadrée par la loi et le délai imparti à l’administration pour instruire les demandes faites à l’OFII (Office Français de l’Immigration et de l’Intégration) est de 6 mois.",

    "blog.article2.title": "Résidence temporaire",
    "blog.article2.date": "12 septembre 2020",
    "blog.article2.imageAlt": "Résidence temporaire au Canada",

    "blog.article2.paragraph1":
      "Qu'est-ce qu'un visa de résident temporaire? Un visa de résident temporaire est un document délivré par un bureau canadien des visas situé à l’extérieur du Canada. Ce document démontre que le détenteur a satisfait aux exigences d’admission au Canada à titre de visiteur. Un visa de résident temporaire vous permet de vous rendre au Canada, mais pas nécessairement d’y entrer. C’est l’agent des services frontaliers du point d’entrée (aéroport, frontière) qui détermine, à votre arrivée au Canada, si vous remplissez toujours toutes les exigences pour entrer au Canada. Une fois que l’on vous permet d’entrer au Canada, vous recevez le statut de résident temporaire.",

    "blog.article2.paragraph2":
      "Qu'est-ce que le statut de résident temporaire? Si vous entrez au Canada en tant que visiteur, étudiant ou travailleur temporaire, vous recevez le statut de résident temporaire pour une période de temps limitée. Le statut de résident temporaire n’est pas la même chose qu’un visa de résident temporaire. Seules les personnes qui proviennent d’un des pays et territoires dont les citoyens ont besoin d’un visa de résident temporaire pour entrer au Canada comme visiteurs doivent obtenir un visa de résident temporaire avant de se rendre au Canada. Une fois que l’on vous permet d’entrer au Canada, que ce soit avec un visa de résident temporaire ou non, vous recevez le statut de résident temporaire.",

    /*carriere.html*/

    "career.title": "Carrière",

    "career.jobTitle":
      "Description du Poste : Développeur Full Stack Stagiaire",

    "career.summaryTitle": "Résumé du Poste",

    "career.summary":
      "Nous recherchons un(e) Développeur(se) Full Stack Stagiaire motivé(e) pour un stage de 6 mois afin de rejoindre notre équipe dynamique chez MAD Immigration Canadienne. Le/la candidat(e) idéal(e) acquerra une expérience pratique en développement front-end et back-end, en contribuant à la création d'applications web performantes et offrant une expérience utilisateur fluide. Ce stage offre une excellente opportunité d'apprentissage et de développement dans un environnement collaboratif et stimulant.",

    "career.responsibilitiesTitle": "Responsabilités",

    "career.responsibility1":
      "Concevoir, développer et maintenir des applications web évolutives en utilisant des frameworks et des technologies modernes.",

    "career.responsibility2":
      "Collaborer avec des équipes multidisciplinaires pour définir, concevoir et mettre en œuvre de nouvelles fonctionnalités.",

    "career.responsibility3":
      "Écrire un code propre et maintenable, tout en respectant les meilleures pratiques et les normes de codage.",

    "career.responsibility4":
      "Identifier et résoudre les problèmes des applications pour optimiser les performances et améliorer l’expérience utilisateur.",

    "career.responsibility5":
      "Participer aux revues de code pour garantir la qualité et partager les connaissances avec les membres de l’équipe.",

    "career.responsibility6":
      "Rester à jour sur les technologies émergentes et les tendances du secteur pour améliorer continuellement ses compétences et les performances des applications.",

    "career.qualificationsTitle": "Compétences et Qualifications Requises",

    "career.qualification1":
      "Maîtrise de C# avec le framework .NET pour le développement back-end.",

    "career.qualification2":
      "Expérience solide avec des bases de données telles que MySQL et SQL.",

    "career.qualification3":
      "Bonne maîtrise des technologies front-end, notamment HTML, CSS et JavaScript.",

    "career.qualification4":
      "Familiarité avec des plateformes cloud comme Azure ou AWS (un atout).",

    "career.qualification5":
      "Expérience dans un environnement Windows souhaitée.",

    "career.qualification6":
      "Connaissance d’autres langages de programmation tels que Java, Python ou C++ (un avantage).",

    "career.qualification7":
      "Capacité à travailler de manière autonome et en collaboration dans un environnement de développement agile.",

    "career.internshipDetailsTitle": "Détails du Stage",

    "career.positionLabel": "Poste :",
    "career.positionValue": "Développeur Full Stack Stagiaire",

    "career.durationLabel": "Durée :",
    "career.durationValue": "6 mois",

    "career.locationLabel": "Lieu de travail :",
    "career.locationValue": "Télétravail",

    "career.languageRequirementsLabel": "Exigences linguistiques :",

    "career.languageRequirementsValue":
      "Maîtrise du français (obligatoire) et anglais fonctionnel",

    "career.scheduleLabel": "Horaires :",
    "career.scheduleValue": "Lundi au vendredi",

    "career.whyJoinTitle": "Pourquoi nous rejoindre ?",

    "career.whyJoin":
      "Rejoignez une équipe qui façonne l’avenir des services d’immigration grâce à des applications innovantes. Chez MAD Immigration Canadienne, vous participerez à des projets impactants, aidant nos clients à réaliser leurs rêves tout en développant vos compétences et en avançant dans votre carrière.",

    "career.additionalDetailsTitle": "Détails supplémentaires",

    "career.employmentTypeLabel": "Type d'emploi :",
    "career.employmentTypeValue": "Temps plein, Stage / Coopératif",

    "career.contractDurationLabel": "Durée du contrat :",
    "career.contractDurationValue": "6 mois",

    "career.educationLabel": "Formation :",
    "career.educationValue": "DEP/AEC ou Certificat (souhaité)",

    "career.languageLabel": "Langue :",
    "career.languageValue": "Français (souhaité)",

    "career.deadlineLabel": "Date limite de candidature :",
    "career.deadlineValue": "1er février 2025",

    "career.startDateLabel": "Date de début prévue :",
    "career.startDateValue": "3 février 2025",

    /*forfait.html*/

    "packages.title": "Nos forfaits",

    "packages.hourly": "Consultation à taux horaire",
    "packages.preliminary": "Évaluation préliminaire",
    "packages.skilledWorker": "Travailleur qualifié",
    "packages.sponsorship": "Parrainage",
    "packages.visitorStudent": "Visiteur et étudiant",
    "packages.temporaryWorker": "Travailleur temporaire",
    "packages.humanitarian": "Humanitaire",
    "packages.refugee": "Réfugié",

    "packages.price": "Prix",

    "packages.priceHourly": "À partir de 149$ US/dossier",
    "packages.pricePreliminary": "À partir de 599$ US/dossier",
    "packages.priceSkilledWorker": "À partir de 2999$ US/dossier",
    "packages.priceSponsorship": "À partir de 2599$ US/dossier",
    "packages.priceVisitorStudent": "À partir de 1999$ US/dossier",
    "packages.priceTemporaryWorker": "À partir de 2999$ US/dossier",
    "packages.priceHumanitarian": "À partir de 1599$ US/dossier",
    "packages.priceRefugee": "À partir de 2599$ US/dossier",

    "packages.included": "Inclus",
    "packages.notIncluded": "Pas inclus",

    "packages.fileOpening": "Ouverture du dossier",
    "packages.fileAnalysis": "Analyse du dossier",
    "packages.fileSubmission": "Soumission du dossier",
    "packages.representation": "Représentation",
    "packages.followUp": "Suivi du dossier",
    "packages.decisionInformation": "Information sur la décision",

    "packages.interviewPreparation": "Préparation à l'entrevue s'il y a lieu",

    "packages.irbInterviewSupport": "Accompagnement à l'entrevue à la CISR",

    "packages.administrativeReview": "Révision administrative s'il y a lieu",

    "packages.employmentContract": "Contrat de travail",

    "packages.appeal": "Appel",

    "packages.addFamilyMember": "Ajout d'un nouveau membre de la famille",

    "packages.book": "Réserver ce forfait",

    /*formulaire.html*/

    // =========================
    // FORMULAIRE
    // =========================

    "form.declaration":
      "Je reconnais que toute fausse déclaration de ma part ou dissimulation d’un fait important dans le présent formulaire peut entraîner une erreur dans l’analyse de mon dossier. Si mon dossier est soumis au gouvernement du Canada avec des renseignements faux ou incomplets, cela peut avoir des conséquences sur ma demande et mon admissibilité au Canada.",

    "form.clientInformation": "Renseignements du client",

    "form.firstName": "Prénom :",
    "form.firstNamePlaceholder": "Veuillez remplir votre prénom",
    "form.lastName": "Nom :",
    "form.lastNamePlaceholder": "Veuillez remplir votre nom",
    "form.birthDate": "Date de naissance :",

    "form.gender": "Sexe :",
    "form.selectGender": "Choisissez votre sexe",
    "form.male": "Masculin",
    "form.female": "Féminin",

    "form.birthCountry": "Lieu de naissance :",
    "form.selectBirthCountry": "Choisissez votre lieu de naissance",
    "form.nationalityCountry": "Pays de nationalité :",
    "form.selectNationalityCountry": "Choisissez votre pays de nationalité",
    "form.residenceCountry": "Pays de résidence :",
    "form.selectResidenceCountry": "Choisissez votre pays de résidence",

    "form.maritalStatus": "État matrimonial actuel :",
    "form.selectMaritalStatus": "Choisissez votre état matrimonial",
    "form.single": "Célibataire",
    "form.married": "Marié(e)",
    "form.commonLaw": "Conjoint(e) de fait",

    "form.childrenUnder22": "Combien d'enfants de moins de 22 ans avez-vous ?",
    "form.child1Age": "Âge de l'enfant 1 :",
    "form.child2Age": "Âge de l'enfant 2 :",
    "form.child3Age": "Âge de l'enfant 3 :",
    "form.child4Age": "Âge de l'enfant 4 :",
    "form.selectAge": "Choisissez l'âge",

    "form.phone": "Votre numéro de téléphone",
    "form.email": "Votre courriel",

    // ADRESSE
    "form.residentialAddress": "Adresse de résidence",
    "form.apartmentNumber": "Numéro d'appartement / unité :",
    "form.apartmentPlaceholder": "Veuillez remplir votre numéro d'appartement",
    "form.streetNumber": "Numéro de rue :",
    "form.streetPlaceholder": "Veuillez remplir votre numéro de rue",
    "form.city": "Ville :",
    "form.cityPlaceholder": "Veuillez remplir votre ville",
    "form.postalCode": "Code postal :",
    "form.postalCodePlaceholder": "Veuillez remplir votre code postal",
    "form.provinceState": "Province / État :",
    "form.provincePlaceholder": "Veuillez remplir votre province ou État",
    "form.country": "Pays :",
    "form.selectCountry": "Choisissez votre pays",

    // LANGUES
    "form.languages": "Connaissance des langues",
    "form.frenchLevel": "Niveau de français :",
    "form.englishLevel": "Niveau d'anglais :",
    "form.selectLevel": "Choisissez votre niveau",
    "form.none": "Aucun",
    "form.excellent": "Excellent",
    "form.advanced": "Avancé",
    "form.intermediate": "Intermédiaire",
    "form.basic": "Basique",
    "form.medium": "Moyen",
    "form.weak": "Faible",

    "form.frenchTestQuestion":
      "Avez-vous fait évaluer votre compétence en français par un organisme approuvé ?",
    "form.englishTestQuestion":
      "Avez-vous fait évaluer votre compétence en anglais par un organisme approuvé ?",
    "form.selectLanguageTest": "Choisissez votre test de compétence",
    "form.noLanguageTest": "Non, je n'ai pas encore fait de test de langue",
    "form.tefCanada": "Oui, j'ai déjà fait le test TEF Canada",
    "form.tcfCanada": "Oui, j'ai déjà fait le test TCF Canada",
    "form.tefaq": "Oui, j'ai déjà fait le test TEFaQ",
    "form.tcfq": "Oui, j'ai déjà fait le test TCFQ",
    "form.delf": "Oui, j'ai déjà fait le test DELF",
    "form.dalf": "Oui, j'ai déjà fait le test DALF",
    "form.ielts": "Oui, j'ai déjà fait le test IELTS",
    "form.celpip": "Oui, j'ai déjà fait le test CELPIP",

    "form.frenchScores":
      "Si oui, quel est votre niveau de compétence en français ?",
    "form.englishScores":
      "Si oui, quel est votre niveau de compétence en anglais ?",
    "form.speaking": "Expression orale :",
    "form.listening": "Compréhension orale :",
    "form.reading": "Compréhension écrite :",
    "form.writing": "Expression écrite :",

    // ÉTUDES
    "form.education": "Études",
    "form.highestEducation": "Votre niveau de scolarité le plus élevé :",
    "form.bachelor": "Baccalauréat",
    "form.certificate": "Certificat",
    "form.licence": "Licence",
    "form.master": "Maîtrise",
    "form.phd": "Doctorat - PhD",
    "form.doctor": "Médecin",
    "form.pharmacist": "Pharmacien(ne)",
    "form.yearsEducation": "Nombre d'années d'études :",
    "form.fieldOfStudy": "Votre domaine d'études ou spécialité :",

    "form.spouseEducationLevel":
      "Niveau de scolarité le plus élevé de votre époux(se) :",
    "form.spouseYearsEducation":
      "Nombre d'années d'études de votre époux(se) :",
    "form.spouseFieldOfStudy":
      "Domaine d'études ou spécialité de votre époux(se) :",

    // EMPLOI
    "form.employment": "Expérience / Emploi",
    "form.currentEmployment": "Votre emploi actuel :",
    "form.yearsExperience": "Nombre d'années d'expérience :",
    "form.jobTitle": "Le titre de votre emploi :",
    "form.jobDuties": "Les tâches de votre emploi actuel :",

    "form.spouseCurrentEmployment": "L'emploi actuel de votre époux(se) :",
    "form.spouseExperience":
      "Nombre d'années d'expérience de votre époux(se) :",
    "form.spouseJobTitle": "Le titre de l'emploi de votre époux(se) :",
    "form.spouseJobDuties":
      "Les tâches de l'emploi actuel de votre époux(se) :",

    // PROJET IMMIGRATION
    "form.immigrationProject": "Projet d'immigration",

    "form.familyCanada": "Avez-vous de la famille au Canada ?",
    "form.selectFamilyCanada": "Choisissez votre situation familiale au Canada",
    "form.noFamilyCanada": "Non, je n'ai pas de famille au Canada",
    "form.siblingCanada":
      "Oui, j'ai un frère ou une sœur de plus de 18 ans au Canada",
    "form.parentCanada": "Oui, j'ai mon père ou ma mère au Canada",
    "form.childCanada": "Oui, j'ai mon fils ou ma fille au Canada",
    "form.grandchildCanada":
      "Oui, j'ai mon petit-fils ou ma petite-fille au Canada",

    "form.destinationProvinceQuestion":
      "Dans quelle province désirez-vous vous installer ?",
    "form.selectProvince": "Choisissez une province au Canada",
    "form.alberta": "Alberta",
    "form.britishColumbia": "Colombie-Britannique",
    "form.manitoba": "Manitoba",
    "form.newBrunswick": "Nouveau-Brunswick",
    "form.newfoundland": "Terre-Neuve-et-Labrador",
    "form.novaScotia": "Nouvelle-Écosse",
    "form.ontario": "Ontario",
    "form.pei": "Île-du-Prince-Édouard",
    "form.quebec": "Québec",
    "form.saskatchewan": "Saskatchewan",

    "form.jobOffer": "Avez-vous une offre d'emploi au Canada ?",
    "form.selectJobOffer": "Choisissez une réponse",
    "form.noJobOffer": "Non, je n'ai pas d'offre d'emploi au Canada",
    "form.yesJobOffer": "Oui, j'ai une offre d'emploi au Canada",

    "form.temporaryResidenceQuestion":
      "Je désire m'installer au Canada à titre de résident temporaire :",
    "form.selectTemporaryResidence":
      "Choisissez votre catégorie de résidence temporaire",
    "form.visitor": "Visiteur",
    "form.businessVisitor": "Visiteur commercial",
    "form.superVisa": "Visiteur - Super Visa",
    "form.student": "Étudiant(e)",
    "form.temporaryWorker": "Travailleur temporaire",

    "form.permanentResidenceQuestion":
      "Je désire m'installer au Canada à titre de résident permanent :",
    "form.selectPermanentResidence":
      "Choisissez votre catégorie de résidence permanente",
    "form.economicImmigration": "Immigration économique",
    "form.spouseSponsorship": "Parrainage - Époux(se)",
    "form.spouseChildrenSponsorship":
      "Parrainage - Époux(se) avec enfant(s) à charge",
    "form.parentsSponsorship": "Parrainage - Parent(s) / Grand-parent(s)",
    "form.orphanSiblingSponsorship":
      "Parrainage - Frère ou sœur orphelin(e) de moins de 18 ans",
    "form.adoptedChildSponsorship": "Parrainage - Enfant adopté",
    "form.groupFive": "Parrainage - Groupe de 5",
    "form.humanitarian": "Humanitaire",
    "form.refugee": "Réfugié ou demandeur d'asile",

    // VOYAGES
    "form.travelHistory": "Voyages antérieurs",

    "form.previousApplication":
      "Avez-vous déjà déposé une demande de visa, de permis d'étude, de permis de travail ou d'autorisation de voyage électronique (AVE) au Canada ?",

    "form.travelEuropeUsa":
      "Avez-vous déjà voyagé en Europe ou aux États-Unis ?",

    "form.previousRefusal":
      "Vous a-t-on déjà refusé un visa ou une autorisation de voyage électronique (AVE) au Canada ?",

    "form.yes": "Oui",
    "form.no": "Non",

    // INADMISSIBILITÉ
    "form.inadmissibility":
      "Inadmissibilité (Veuillez donner des explications si vous répondez « oui »)",

    "form.criminalOffence":
      "Avez-vous déjà été reconnu(e) coupable d'une infraction pénale ou criminelle ?",

    "form.healthQuestion":
      "Avez-vous un problème de santé susceptible d'avoir une incidence sur votre admissibilité au Canada ?",

    "form.explanation":
      "Explication si vous répondez « oui » aux questions ci-dessus",
    "form.explanationPlaceholder": "Veuillez nous laisser vos explications !",

    // INFORMATIONS IMPORTANTES
    "form.importantInformation": "Informations importantes",

    "form.consent":
      "Je comprends que MAD Immigration Canadienne (MADIC) inc. recueille mes renseignements personnels en vue d'évaluer mon projet d'immigration, et qu'il utilisera ces renseignements pour vérifier mon admissibilité, ainsi que ma conformité aux conditions et aux exigences prévues par la Loi sur l'immigration et la protection des réfugiés. Je déclare avoir donné des réponses exactes et complètes à toutes les questions du présent formulaire.",

    "form.submit": "Soumettre",

    /*joindre.html*/
    // =========================
    // NOUS JOINDRE
    // =========================

    "contact.title": "Nous joindre",
    "contact.phone": "Par téléphone :",
    "contact.email": "Par courriel :",
    /*propos.html*/

    // =========================
    // À PROPOS
    // =========================

    "about.title": "À propos de nous",

    "about.intro1":
      "Nous sommes une jeune entreprise dynamique œuvrant dans le domaine de l'immigration canadienne. Notre équipe est certifiée par le collège de l'immigration et de la citoyenneté. Nous offrons des services de consultation, coaching spécialisé et un accompagnement personnalisé dans l'immigration économique, le regroupement familial, la résidence temporaire et dans l'humanitaire.",

    "about.intro2":
      "Notre approche simplifie l’ensemble des démarches en immigration et en citoyenneté en utilisant des outils technologiques 4.0. Nous garantissons la confidentialité des dossiers et une accessibilité constante à vos conseillers durant toute la procédure.",

    "about.moussa1":
      "Fondateur et gestionnaire principal de MAD Immigration Canadienne, Moussa est un expert en immigration et en génie. Fort d'années d'expérience en consultation et en gestion de projets, il met à profit son expertise pour aider les clients à réaliser leurs rêves d'immigration.",

    "about.moussa2":
      "Son engagement envers la transparence, la confidentialité et le succès des dossiers de ses clients est au cœur des valeurs de notre entreprise.",

    // HISTOIRE
    "about.history.title":
      "Découvrez notre histoire, nos valeurs et nos engagements",

    "about.history.dream.title": "Un rêve qui prend naissance",

    "about.history.dream.text":
      "En 1998, en République de Djibouti, je n'étais qu'un jeune élève avec un rêve : m'établir au Québec. Tout semblait incertain, mais ce rêve allait devenir le point de départ d’un voyage extraordinaire.",

    "about.history.firstStep.title": "Un premier pas décisif",

    "about.history.firstStep.text":
      "Ce simple geste de correspondance par courrier postal a ouvert la voie à des opportunités qui ont profondément transformé ma vie, éveillant en moi un désir constant de me surpasser.",

    "about.history.world.title": "Découvrir le monde",

    "about.history.world.text":
      "Avant d’arriver au Canada, j’ai eu la chance de vivre au Maroc pendant 4 ans, en France pendant 5 ans, et de voyager dans huit pays européens, deux pays asiatiques et les États-Unis. Chaque expérience a enrichi ma compréhension de la diversité.",

    "about.history.canada.title": "Un nouveau départ au Canada",

    "about.history.canada.text":
      "En 2012, j’ai posé mes valises au Canada. Ce pays, avec ses opportunités et ses défis, est devenu le théâtre d’une mission qui allait redéfinir ma vie.",

    "about.history.challenges.title": "Les défis de l'immigration",

    "about.history.challenges.text":
      "Le processus d'immigration n’est pas seulement administratif, c’est une aventure humaine. J’ai vu les obstacles, ressenti les doutes, mais aussi découvert une passion pour aider et transformer des vies.",

    "about.history.entrepreneurship.title":
      "Entrepreneuriat au service de la communauté",

    "about.history.entrepreneurship.text":
      "Inspiré par mon propre parcours, j’ai utilisé l'entrepreneuriat comme levier pour accompagner les immigrants, leur offrir des solutions concrètes et contribuer à leur intégration dans la société canadienne.",

    "about.history.mission.title": "Une mission de transformation",

    "about.history.mission.text":
      "Mon engagement repose sur deux axes : aider les immigrants à obtenir leur résidence et citoyenneté, et leur ouvrir les portes du marché du travail canadien.",

    "about.history.change.title": "Un catalyseur de changement",

    "about.history.change.text":
      "Je crois fermement que l’intégration passe par le sport, la culture et les échanges. Mon objectif est de construire des communautés solides et dynamiques où chacun peut s’épanouir.",

    "about.history.journey.title": "Un voyage commun",

    "about.history.journey.text":
      "Mon histoire est celle de tous ceux qui croient qu’il est possible de réécrire leur avenir. Ensemble, nous faisons de l'immigration une aventure partagée, remplie d’audace, de passion et de détermination.",

    // IMPACT
    "about.impact.title":
      "Découvrez notre impact au sein de la société canadienne, notamment au Québec",

    "about.impact.sport.title": "Impact dans le sport",

    "about.impact.sport.text":
      "Nous avons soutenu des initiatives sportives pour intégrer les communautés immigrantes dans la société canadienne.",

    "about.impact.culture.title": "Impact culturel",

    "about.impact.culture.text":
      "Nous avons participé activement à la promotion de la culture immigrante à travers des événements communautaires.",

    "about.impact.professional.title": "Intégration professionnelle",

    "about.impact.professional.text":
      "Aider les immigrants à trouver leur place dans le monde professionnel au Canada est au cœur de notre mission.",
    /*services.html*/
    // =========================
    // SERVICES
    // =========================

    "services.title": "Nos services",

    "services.economic.title": "Immigration économique",
    "services.economic.text":
      "Les programmes d’immigration économique sont environ une centaine répartis aux niveaux fédéral et provincial. Ils permettent notamment aux travailleurs qualifiés de présenter une demande afin de devenir résidents permanents.",

    "services.sponsorship.title": "Parrainage",
    "services.sponsorship.text":
      "Le programme d’immigration au titre de la catégorie du regroupement familial vise à réunir les citoyens et les résidents permanents du Canada avec les membres de leur famille proche.",

    "services.temporary.title": "Résidence temporaire",
    "services.temporary.text":
      "Chaque année, plus de 35 millions de personnes visitent le Canada afin de profiter de ses nombreuses possibilités, notamment pour rendre visite à leur famille ou à des amis.",

    "services.humanitarian.title": "Humanitaire",
    "services.humanitarian.text":
      "Une demande de résidence permanente depuis le Canada pour considérations d’ordre humanitaire (CH) peut être présentée dans certaines circonstances :",
    "services.humanitarian.item1": "vous êtes au Canada;",

    "services.refugee.title": "Réfugié",
    "services.refugee.text":
      "Le Canada offre l’asile à certaines personnes se trouvant sur son territoire qui craignent la persécution ou qui seraient en danger si elles devaient partir.",
    "services.refugee.item1": "la torture;",
    "services.refugee.item2": "une menace à leur vie;",
    "services.refugee.item3":
      "le risque de traitements ou de peines cruels et inusités.",

    "services.business.title": "Gens d'affaires",
    "services.business.text":
      "Le Canada accueille les gens d’affaires qui réussissent et cherchent des débouchés et des défis nouveaux. Le programme d’immigration des gens d’affaires est conçu pour favoriser l’admission de ces personnes.",

    "services.learnMore": "En savoir plus",

    /*servicesDetailsEco.html*/
    // =========================
    // SERVICE - IMMIGRATION ÉCONOMIQUE
    // =========================

    "serviceEco.title": "Immigration économique",

    "serviceEco.description":
      "Cette section porte sur le traitement des demandes de résidence permanente présentées par des demandeurs de la catégorie des travailleurs qualifiés (fédéral). Être travailleur qualifié; être en mesure de devenir un résident permanent en raison de sa capacité de réussir son établissement économique au Canada; avoir l’intention de s’établir dans une province autre que le Québec. La CEC est une catégorie de résidence permanente qui s’applique aux personnes ayant acquis une expérience de travail qualifié au Canada. Elle a été conçue à l’intention des travailleurs étrangers temporaires et des diplômés étrangers ayant acquis une expérience de travail admissible au Canada. La CTMSF vise les personnes qui répondent à tous les critères suivants : être travailleur d’un métier spécialisé; être en mesure de devenir un résident permanent en raison de sa capacité de réussir son établissement économique au Canada; avoir l’intention de s’établir dans une province autre que le Québec. Un travailleur autonome est un étranger qui a l’expérience pertinente pour travailler à son compte au Canada, qui a également l’intention et la capacité de le faire, et qui peut contribuer de manière importante à des activités culturelles, des activités sportives, ou à l’achat et la gestion d’une ferme au Canada pour les demandes reçues avant le 10 mars 2018. Le Programme des candidats des provinces (PCP) vise à permettre aux provinces et aux territoires de soutenir l’immigration de personnes qui ont exprimé le désir de s’établir dans leur province ou sur leur territoire et qui pourront contribuer à leur développement et à leur prospérité économiques, ainsi qu’à ceux du Canada.",

    "serviceEco.otherServices": "Nos autres services",
    "serviceEco.sponsorship": "Parrainage",
    "serviceEco.temporaryResidence": "Résidence temporaire",
    "serviceEco.learnMore": "En savoir plus",

    /*servicesDetailsPar.html*/
    // =========================
    // SERVICE - REGROUPEMENT FAMILIAL
    // =========================

    "servicePar.title": "Regroupement familial",

    "servicePar.description":
      "Le programme d’immigration au titre de la catégorie du regroupement familial vise à réunir des citoyens et des résidents permanents du Canada et les membres de leur famille proche. En s’engageant à parrainer des membres de la catégorie du regroupement familial, le répondant promet que, pendant une période précise, il subviendra à leurs besoins fondamentaux afin qu’ils n’aient pas à recevoir d’assistance sociale. La priorité est accordée aux demandes de parrainage visant des époux, des conjoints de fait ou des partenaires conjugaux et les enfants à charge. La priorité est également accordée aux demandes de parrainage visant des enfants adoptés, des enfants à adopter et des orphelins, dans la mesure où elles mettent souvent en cause des mineurs dépourvus de soins parentaux. De plus amples renseignements se trouvent dans le document Adoptions (PDF, 5,72 Ko). Aucune priorité de traitement n’est accordée pour d’autres membres de la catégorie du regroupement familial. La demande de résidence permanente présentée au titre de la catégorie du regroupement familial est envoyée en même temps que la demande de parrainage à un centre de traitement des demandes (CTD) du Canada. Les CTD sont les principaux bureaux chargés de traiter les demandes de parrainage présentées au titre de la catégorie du regroupement familial. D’autres bureaux d’Immigration, Réfugiés et Citoyenneté Canada (IRCC) peuvent prendre certaines décisions concernant l’admissibilité dans la catégorie du regroupement familial, s’il y a lieu. Vérifier les délais de traitement des demandes pour les membres de la catégorie du regroupement familial.",

    "servicePar.otherServices": "Nos autres services",
    "servicePar.economic": "Immigration économique",
    "servicePar.temporaryResidence": "Résidence temporaire",
    "servicePar.learnMore": "En savoir plus",
    /*servicesDetailsRT.html*/
    // =========================
    // SERVICE - RÉSIDENCE TEMPORAIRE
    // =========================

    "serviceRT.title": "Résidence temporaire",

    "serviceRT.description":
      "Qu’est-ce qu’un résident temporaire? Un résident temporaire est un étranger qui est légalement autorisé à entrer au Canada à des fins temporaires. Un étranger a le statut de résident temporaire lorsqu’on estime qu’il remplit les exigences de la loi pour entrer et/ou demeurer au Canada à titre de visiteur, d’étudiant, de travailleur ou de titulaire d'un permis de séjour temporaire. Seuls les étrangers se trouvant effectivement au Canada détiennent le statut de résident temporaire. Immigration, Réfugiés et Citoyenneté Canada traite les demandes au titre de plusieurs catégories : visa de résident temporaire, autorisation de voyage électronique, étudiants étrangers, travailleurs temporaires et permis de résident temporaire. Les résidents temporaires sont assujettis à diverses conditions, telles que la durée de leur séjour au Canada [R183]. Le visa de résident temporaire (VRT) est un autocollant officiel délivré par un bureau des visas et placé dans le passeport d’une personne afin de prouver qu’elle satisfait aux exigences d’admission au Canada à titre de résident temporaire. Le VRT ne garantit pas le droit d’entrée au Canada. L’admission au Canada à titre de résident temporaire est un privilège et non un droit. L’initiative d’autorisation de voyage électronique (AVE) est un engagement clé qui vise à renforcer la sécurité mutuelle entre le Canada et les États-Unis en s’attaquant aux menaces potentielles le plus rapidement possible à l’extérieur du périmètre nord-américain. Cette initiative harmonise les approches du Canada et des États-Unis à l’égard du contrôle des étrangers dispensés de l’obligation de visa avant leur départ. Dans le cadre de l’initiative, les étrangers dispensés de l’obligation de visa, sauf les citoyens des États-Unis, sont tenus d’obtenir une AVE avant de se rendre au Canada par voie aérienne, à moins d’être dispensés de cette obligation. Certains étrangers à faible risque visés par l’obligation de visa peuvent également être autorisés à obtenir une AVE pour se rendre au Canada par voie aérienne au titre du programme d’expansion de l’AVE.",

    "serviceRT.otherServices": "Nos autres services",
    "serviceRT.economic": "Immigration économique",
    "serviceRT.sponsorship": "Parrainage",
    "serviceRT.learnMore": "En savoir plus",

    /*rendezvous.html*/
    // =========================
    // PRISE DE RENDEZ-VOUS
    // =========================

    "booking.title": "Prendre rendez-vous",

    "booking.subtitle":
      "Réservez une consultation avec MAD Immigration Canadienne afin d'obtenir une analyse personnalisée de votre situation.",

    "booking.serviceTitle": "Choisissez votre consultation",

    "booking.consultation60": "Consultation – 60 minutes",

    "booking.consultation60Description":
      "Consultation personnalisée pour analyser votre situation et répondre à vos questions en immigration canadienne.",

    "booking.consultation60Price": "225 $CAD ou 159$ us",

    "booking.preliminary": "Évaluation préliminaire",

    "booking.preliminaryDescription":
      "Analyse plus approfondie de votre profil et de vos possibilités d'immigration au Canada.",

    "booking.preliminaryPrice": "599 749 $CAD ou 599$ us",

    "booking.dateTitle": "Choisissez une date",

    "booking.dateLabel": "Date de la consultation",

    "booking.timeTitle": "Choisissez une heure",

    "booking.timezone":
      "Les heures sont affichées selon l'heure de Montréal, Québec.",

    "booking.informationTitle": "Vos renseignements",

    "booking.firstName": "Prénom",

    "booking.lastName": "Nom",

    "booking.email": "Courriel",

    "booking.phone": "Téléphone",

    "booking.country": "Pays de résidence",

    "booking.subject": "Sujet de votre consultation",

    "booking.selectSubject": "Choisissez un sujet",

    "booking.economic": "Immigration économique",

    "booking.sponsorship": "Parrainage",

    "booking.temporary": "Résidence temporaire",

    "booking.refugee": "Réfugié / Demande d'asile",

    "booking.humanitarian": "Humanitaire",

    "booking.other": "Autre",

    "booking.message": "Décrivez brièvement votre situation",

    "booking.messagePlaceholder":
      "Veuillez décrire brièvement votre situation...",

    "booking.confirmationTitle": "Confirmation",

    "booking.consent":
      "Je confirme que les renseignements fournis sont exacts et j'accepte d'être contacté par MAD Immigration Canadienne concernant cette consultation.",

    "booking.submit": "Réserver ma consultation",

    "booking.note":
      "Votre rendez-vous sera confirmé après validation de la disponibilité.",

    "nav.appointment": "Prendre rendez-vous",

    /*confirmation.html*/
    "confirmation.title": "Merci, votre formulaire a été envoyé",

    "confirmation.message":
      "Nous avons bien reçu vos renseignements. Un membre de MAD Immigration Canadienne communiquera avec vous après l’analyse de votre demande.",

    "confirmation.notice":
      "Veuillez vérifier votre courriel et vous assurer que nos messages ne sont pas dirigés vers votre dossier de courrier indésirable.",

    "confirmation.home": "Retour à l’accueil",
  },

  en: {
    pageTitle: "MAD Immigration Canada",
    pageDescription:
      "MAD Immigration Canada Inc. is a Canadian company specializing in Canadian immigration and citizenship services.",

    "nav.home": "Home",
    "nav.about": "About Us",
    "nav.services": "Our Services",
    "nav.packages": "Our Packages",
    "nav.contact": "Contact Us",
    "nav.career": "Careers",
    "nav.evaluation": "Preliminary Assessment",

    "hero.title": "Canada, a winning choice for your future!",
    "hero.subtitle":
      "MADIC specializes in Canadian immigration and citizenship services and stands out through high-quality service and competitive pricing.",
    "hero.button": "View our services",

    "about.title": "Who are we?",
    "about.description":
      "We are a dynamic company specializing in Canadian immigration. Our team provides consultation services, specialized coaching and personalized support for economic immigration, family sponsorship, temporary residence and humanitarian matters. Our approach is designed to simplify immigration and citizenship procedures through modern technological tools. We also place great importance on client confidentiality and on ensuring access to our advisors throughout the entire process.",

    "footer.contact": "Contact Us",
    "footer.account": "Account",
    "footer.createAccount": "Create an account",
    "footer.register": "Sign up",
    "footer.company": "Company",
    "footer.about": "About MADIC",
    "footer.business": "Business",
    "footer.partners": "Partners",
    "footer.career": "Careers",
    "footer.resources": "Resources",
    "footer.directory": "Immigration Directory",
    "footer.help": "Help Centre",
    "footer.privacy": "Privacy and Terms",
    "footer.copyright": "All rights reserved.",

    /*blogue.html*/

    "blog.title": "Blog",
    "blog.published": "Published on",

    "blog.article1.title": "Family Reunification",
    "blog.article1.date": "July 7, 2020",
    "blog.article1.imageAlt": "Family reunification in Canada",

    "blog.article1.paragraph1":
      "Family reunification: wait a long time or act quickly! The Constitutional Council established the principle that the right of foreign nationals to lead a normal family life includes, in particular, the ability to have their spouses and minor children join them, subject to restrictions related to the preservation of public order and the protection of public health. In practice, foreign nationals seeking to reunite with their families must often be patient. However, procedures and eligibility requirements must be carefully considered.",

    "blog.article1.paragraph2":
      "Since 2004, family reunification has become a less common category of family immigration. Processing times and eligibility requirements can significantly affect applicants and their families. Immigration procedures are governed by applicable legislation and administrative requirements, making it important to understand the applicable rules before submitting an application.",

    "blog.article2.title": "Temporary Residence",
    "blog.article2.date": "September 12, 2020",
    "blog.article2.imageAlt": "Temporary residence in Canada",

    "blog.article2.paragraph1":
      "What is a temporary resident visa? A temporary resident visa is a document issued by a Canadian visa office outside Canada. It demonstrates that the holder has met the requirements for admission to Canada as a visitor. A temporary resident visa allows you to travel to Canada, but it does not necessarily guarantee entry. A border services officer at the port of entry determines whether you continue to meet all the requirements to enter Canada. Once you are authorized to enter Canada, you are granted temporary resident status.",

    "blog.article2.paragraph2":
      "What is temporary resident status? If you enter Canada as a visitor, student or temporary worker, you receive temporary resident status for a limited period of time. Temporary resident status is not the same as a temporary resident visa. Only citizens of countries and territories whose nationals require a temporary resident visa must obtain one before travelling to Canada as visitors. Once you are authorized to enter Canada, whether or not you require a temporary resident visa, you receive temporary resident status.",

    /*carriere.html*/

    "career.title": "Careers",

    "career.jobTitle": "Job Description: Full Stack Developer Intern",

    "career.summaryTitle": "Job Summary",

    "career.summary":
      "We are looking for a motivated Full Stack Developer Intern for a 6-month internship to join our dynamic team at MAD Immigration Canada. The ideal candidate will gain hands-on experience in front-end and back-end development while contributing to the creation of high-performance web applications that provide a seamless user experience. This internship offers an excellent opportunity to learn and grow in a collaborative and stimulating environment.",

    "career.responsibilitiesTitle": "Responsibilities",

    "career.responsibility1":
      "Design, develop and maintain scalable web applications using modern frameworks and technologies.",

    "career.responsibility2":
      "Collaborate with multidisciplinary teams to define, design and implement new features.",

    "career.responsibility3":
      "Write clean and maintainable code while following best practices and coding standards.",

    "career.responsibility4":
      "Identify and resolve application issues to optimize performance and improve the user experience.",

    "career.responsibility5":
      "Participate in code reviews to ensure quality and share knowledge with team members.",

    "career.responsibility6":
      "Stay up to date with emerging technologies and industry trends to continuously improve skills and application performance.",

    "career.qualificationsTitle": "Required Skills and Qualifications",

    "career.qualification1":
      "Proficiency in C# and the .NET framework for back-end development.",

    "career.qualification2":
      "Strong experience with databases such as MySQL and SQL.",

    "career.qualification3":
      "Good command of front-end technologies, including HTML, CSS and JavaScript.",

    "career.qualification4":
      "Familiarity with cloud platforms such as Azure or AWS is an asset.",

    "career.qualification5":
      "Experience working in a Windows environment is preferred.",

    "career.qualification6":
      "Knowledge of other programming languages such as Java, Python or C++ is an asset.",

    "career.qualification7":
      "Ability to work independently and collaboratively in an agile development environment.",

    "career.internshipDetailsTitle": "Internship Details",

    "career.positionLabel": "Position:",
    "career.positionValue": "Full Stack Developer Intern",

    "career.durationLabel": "Duration:",
    "career.durationValue": "6 months",

    "career.locationLabel": "Work Location:",
    "career.locationValue": "Remote",

    "career.languageRequirementsLabel": "Language Requirements:",

    "career.languageRequirementsValue":
      "Fluency in French is required, with functional English",

    "career.scheduleLabel": "Schedule:",
    "career.scheduleValue": "Monday to Friday",

    "career.whyJoinTitle": "Why Join Us?",

    "career.whyJoin":
      "Join a team that is helping shape the future of immigration services through innovative applications. At MAD Immigration Canada, you will contribute to meaningful projects that help our clients achieve their goals while developing your skills and advancing your career.",

    "career.additionalDetailsTitle": "Additional Details",

    "career.employmentTypeLabel": "Employment Type:",
    "career.employmentTypeValue": "Full-time, Internship / Co-op",

    "career.contractDurationLabel": "Contract Duration:",
    "career.contractDurationValue": "6 months",

    "career.educationLabel": "Education:",
    "career.educationValue":
      "Vocational Diploma, College Certificate or Certificate preferred",

    "career.languageLabel": "Language:",
    "career.languageValue": "French preferred",

    "career.deadlineLabel": "Application Deadline:",
    "career.deadlineValue": "February 1, 2025",

    "career.startDateLabel": "Expected Start Date:",
    "career.startDateValue": "February 3, 2025",

    /*forfait.html*/

    "packages.title": "Our Packages",

    "packages.hourly": "Hourly Consultation",
    "packages.preliminary": "Preliminary Assessment",
    "packages.skilledWorker": "Skilled Worker",
    "packages.sponsorship": "Sponsorship",
    "packages.visitorStudent": "Visitor and Student",
    "packages.temporaryWorker": "Temporary Worker",
    "packages.humanitarian": "Humanitarian",
    "packages.refugee": "Refugee",

    "packages.price": "Price",

    "packages.priceHourly": "Starting at US$149/file",
    "packages.pricePreliminary": "Starting at US$599/file",
    "packages.priceSkilledWorker": "Starting at US$2,999/file",
    "packages.priceSponsorship": "Starting at US$2,599/file",
    "packages.priceVisitorStudent": "Starting at US$1,999/file",
    "packages.priceTemporaryWorker": "Starting at US$2,999/file",
    "packages.priceHumanitarian": "Starting at US$1,599/file",
    "packages.priceRefugee": "Starting at US$2,599/file",

    "packages.included": "Included",
    "packages.notIncluded": "Not Included",

    "packages.fileOpening": "File Opening",
    "packages.fileAnalysis": "File Analysis",
    "packages.fileSubmission": "Application Submission",
    "packages.representation": "Representation",
    "packages.followUp": "Application Follow-up",
    "packages.decisionInformation": "Information on the Decision",

    "packages.interviewPreparation": "Interview Preparation, if applicable",

    "packages.irbInterviewSupport": "Assistance at the IRB Hearing",

    "packages.administrativeReview": "Administrative Review, if applicable",

    "packages.employmentContract": "Employment Contract",

    "packages.appeal": "Appeal",

    "packages.addFamilyMember": "Addition of a New Family Member",

    "packages.book": "Book This Package",

    /*formulaire.html*/

    // =========================
    // FORM
    // =========================

    "form.declaration":
      "I acknowledge that any false statement or concealment of a material fact in this form may result in an incorrect assessment of my file. If my application is submitted to the Government of Canada with false or incomplete information, this may have consequences for my application and my admissibility to Canada.",

    "form.clientInformation": "Client Information",

    "form.firstName": "First Name:",
    "form.firstNamePlaceholder": "Please enter your first name",
    "form.lastName": "Last Name:",
    "form.lastNamePlaceholder": "Please enter your last name",
    "form.birthDate": "Date of Birth:",

    "form.gender": "Gender:",
    "form.selectGender": "Select your gender",
    "form.male": "Male",
    "form.female": "Female",

    "form.birthCountry": "Place of Birth:",
    "form.selectBirthCountry": "Select your place of birth",
    "form.nationalityCountry": "Country of Nationality:",
    "form.selectNationalityCountry": "Select your country of nationality",
    "form.residenceCountry": "Country of Residence:",
    "form.selectResidenceCountry": "Select your country of residence",

    "form.maritalStatus": "Current Marital Status:",
    "form.selectMaritalStatus": "Select your marital status",
    "form.single": "Single",
    "form.married": "Married",
    "form.commonLaw": "Common-law Partner",

    "form.childrenUnder22":
      "How many children under the age of 22 do you have?",
    "form.child1Age": "Age of Child 1:",
    "form.child2Age": "Age of Child 2:",
    "form.child3Age": "Age of Child 3:",
    "form.child4Age": "Age of Child 4:",
    "form.selectAge": "Select age",

    "form.phone": "Your Phone Number",
    "form.email": "Your Email Address",

    // ADDRESS
    "form.residentialAddress": "Residential Address",
    "form.apartmentNumber": "Apartment / Unit Number:",
    "form.apartmentPlaceholder": "Please enter your apartment or unit number",
    "form.streetNumber": "Street Number:",
    "form.streetPlaceholder": "Please enter your street number",
    "form.city": "City:",
    "form.cityPlaceholder": "Please enter your city",
    "form.postalCode": "Postal Code:",
    "form.postalCodePlaceholder": "Please enter your postal code",
    "form.provinceState": "Province / State:",
    "form.provincePlaceholder": "Please enter your province or state",
    "form.country": "Country:",
    "form.selectCountry": "Select your country",

    // LANGUAGES
    "form.languages": "Language Proficiency",
    "form.frenchLevel": "French Level:",
    "form.englishLevel": "English Level:",
    "form.selectLevel": "Select your level",
    "form.none": "None",
    "form.excellent": "Excellent",
    "form.advanced": "Advanced",
    "form.intermediate": "Intermediate",
    "form.basic": "Basic",
    "form.medium": "Intermediate",
    "form.weak": "Basic",

    "form.frenchTestQuestion":
      "Have you had your French language proficiency assessed by an approved organization?",
    "form.englishTestQuestion":
      "Have you had your English language proficiency assessed by an approved organization?",
    "form.selectLanguageTest": "Select your language test",
    "form.noLanguageTest": "No, I have not yet taken a language test",
    "form.tefCanada": "Yes, I have taken the TEF Canada test",
    "form.tcfCanada": "Yes, I have taken the TCF Canada test",
    "form.tefaq": "Yes, I have taken the TEFaQ test",
    "form.tcfq": "Yes, I have taken the TCFQ test",
    "form.delf": "Yes, I have taken the DELF test",
    "form.dalf": "Yes, I have taken the DALF test",
    "form.ielts": "Yes, I have taken the IELTS test",
    "form.celpip": "Yes, I have taken the CELPIP test",

    "form.frenchScores": "If yes, what is your level of proficiency in French?",
    "form.englishScores":
      "If yes, what is your level of proficiency in English?",
    "form.speaking": "Speaking:",
    "form.listening": "Listening:",
    "form.reading": "Reading:",
    "form.writing": "Writing:",

    // EDUCATION
    "form.education": "Education",
    "form.highestEducation": "Your Highest Level of Education:",
    "form.bachelor": "Bachelor's Degree",
    "form.certificate": "Certificate",
    "form.licence": "Undergraduate Degree",
    "form.master": "Master's Degree",
    "form.phd": "Doctorate / PhD",
    "form.doctor": "Medical Doctor",
    "form.pharmacist": "Pharmacist",
    "form.yearsEducation": "Number of Years of Education:",
    "form.fieldOfStudy": "Field of Study or Specialization:",

    "form.spouseEducationLevel": "Your Spouse's Highest Level of Education:",
    "form.spouseYearsEducation": "Your Spouse's Number of Years of Education:",
    "form.spouseFieldOfStudy":
      "Your Spouse's Field of Study or Specialization:",

    // EMPLOYMENT
    "form.employment": "Experience / Employment",
    "form.currentEmployment": "Your Current Employment:",
    "form.yearsExperience": "Years of Work Experience:",
    "form.jobTitle": "Your Job Title:",
    "form.jobDuties": "Your Current Job Duties:",

    "form.spouseCurrentEmployment": "Your Spouse's Current Employment:",
    "form.spouseExperience": "Your Spouse's Years of Work Experience:",
    "form.spouseJobTitle": "Your Spouse's Job Title:",
    "form.spouseJobDuties": "Your Spouse's Current Job Duties:",

    // IMMIGRATION PROJECT
    "form.immigrationProject": "Immigration Project",

    "form.familyCanada": "Do you have family members in Canada?",
    "form.selectFamilyCanada": "Select your family situation in Canada",
    "form.noFamilyCanada": "No, I do not have family in Canada",
    "form.siblingCanada": "Yes, I have a brother or sister over 18 in Canada",
    "form.parentCanada": "Yes, I have a father or mother in Canada",
    "form.childCanada": "Yes, I have a son or daughter in Canada",
    "form.grandchildCanada":
      "Yes, I have a grandson or granddaughter in Canada",

    "form.destinationProvinceQuestion":
      "In which province would you like to settle?",
    "form.selectProvince": "Select a province in Canada",
    "form.alberta": "Alberta",
    "form.britishColumbia": "British Columbia",
    "form.manitoba": "Manitoba",
    "form.newBrunswick": "New Brunswick",
    "form.newfoundland": "Newfoundland and Labrador",
    "form.novaScotia": "Nova Scotia",
    "form.ontario": "Ontario",
    "form.pei": "Prince Edward Island",
    "form.quebec": "Quebec",
    "form.saskatchewan": "Saskatchewan",

    "form.jobOffer": "Do you have a job offer in Canada?",
    "form.selectJobOffer": "Select an answer",
    "form.noJobOffer": "No, I do not have a job offer in Canada",
    "form.yesJobOffer": "Yes, I have a job offer in Canada",

    "form.temporaryResidenceQuestion":
      "I wish to come to Canada as a temporary resident:",
    "form.selectTemporaryResidence": "Select your temporary residence category",
    "form.visitor": "Visitor",
    "form.businessVisitor": "Business Visitor",
    "form.superVisa": "Visitor - Super Visa",
    "form.student": "Student",
    "form.temporaryWorker": "Temporary Worker",

    "form.permanentResidenceQuestion":
      "I wish to settle in Canada as a permanent resident:",
    "form.selectPermanentResidence": "Select your permanent residence category",
    "form.economicImmigration": "Economic Immigration",
    "form.spouseSponsorship": "Sponsorship - Spouse",
    "form.spouseChildrenSponsorship":
      "Sponsorship - Spouse with Dependent Child(ren)",
    "form.parentsSponsorship": "Sponsorship - Parent(s) / Grandparent(s)",
    "form.orphanSiblingSponsorship":
      "Sponsorship - Orphaned Brother or Sister Under 18",
    "form.adoptedChildSponsorship": "Sponsorship - Adopted Child",
    "form.groupFive": "Sponsorship - Group of Five",
    "form.humanitarian": "Humanitarian",
    "form.refugee": "Refugee or Asylum Claimant",

    // PREVIOUS TRAVEL
    "form.travelHistory": "Previous Travel",

    "form.previousApplication":
      "Have you previously applied for a visa, study permit, work permit or Electronic Travel Authorization (eTA) for Canada?",

    "form.travelEuropeUsa":
      "Have you ever travelled to Europe or the United States?",

    "form.previousRefusal":
      "Have you ever been refused a visa or Electronic Travel Authorization (eTA) for Canada?",

    "form.yes": "Yes",
    "form.no": "No",

    // INADMISSIBILITY
    "form.inadmissibility":
      "Inadmissibility (Please provide an explanation if you answer “yes”)",

    "form.criminalOffence":
      "Have you ever been convicted of a criminal offence?",

    "form.healthQuestion":
      "Do you have a health condition that may affect your admissibility to Canada?",

    "form.explanation":
      "Please provide an explanation if you answered “yes” to the questions above",
    "form.explanationPlaceholder": "Please provide your explanation here.",

    // IMPORTANT INFORMATION
    "form.importantInformation": "Important Information",

    "form.consent":
      "I understand that MAD Immigration Canada (MADIC) Inc. collects my personal information for the purpose of assessing my immigration project and will use this information to verify my eligibility and compliance with the conditions and requirements of the Immigration and Refugee Protection Act. I declare that I have provided accurate and complete answers to all questions in this form.",

    "form.submit": "Submit",

    /*joindre.html*/
    // =========================
    // CONTACT US
    // =========================

    "contact.title": "Contact Us",
    "contact.phone": "By phone:",
    "contact.email": "By email:",
    /*propos.html*/

    // =========================
    // ABOUT US
    // =========================

    "about.title": "About Us",

    "about.intro1":
      "We are a young and dynamic company specializing in Canadian immigration. Our team is certified by the College of Immigration and Citizenship Consultants. We provide consultation services, specialized coaching and personalized support in economic immigration, family reunification, temporary residence and humanitarian matters.",

    "about.intro2":
      "Our approach simplifies immigration and citizenship procedures through the use of modern technological tools. We are committed to protecting the confidentiality of our clients' files and ensuring continuous access to our advisors throughout the entire process.",

    "about.moussa1":
      "Founder and Principal Manager of MAD Immigration Canada, Moussa is an expert in immigration and engineering. With years of experience in consulting and project management, he uses his expertise to help clients achieve their immigration goals.",

    "about.moussa2":
      "His commitment to transparency, confidentiality and the success of his clients' files is at the heart of our company's values.",

    // HISTORY
    "about.history.title": "Discover Our Story, Values and Commitments",

    "about.history.dream.title": "Where a Dream Began",

    "about.history.dream.text":
      "In 1998, in the Republic of Djibouti, I was just a young student with a dream: to settle in Quebec. Everything seemed uncertain, but that dream would become the starting point of an extraordinary journey.",

    "about.history.firstStep.title": "A Decisive First Step",

    "about.history.firstStep.text":
      "This simple act of corresponding by postal mail opened the door to opportunities that profoundly transformed my life and awakened in me a constant desire to grow and surpass myself.",

    "about.history.world.title": "Discovering the World",

    "about.history.world.text":
      "Before arriving in Canada, I had the opportunity to live in Morocco for four years and in France for five years, and to travel to eight European countries, two Asian countries and the United States. Each experience enriched my understanding of diversity.",

    "about.history.canada.title": "A New Beginning in Canada",

    "about.history.canada.text":
      "In 2012, I arrived in Canada. With its opportunities and challenges, this country became the setting for a mission that would redefine my life.",

    "about.history.challenges.title": "The Challenges of Immigration",

    "about.history.challenges.text":
      "The immigration process is not only administrative; it is a human journey. I have seen the obstacles, experienced the doubts, and also discovered a passion for helping others and transforming lives.",

    "about.history.entrepreneurship.title":
      "Entrepreneurship Serving the Community",

    "about.history.entrepreneurship.text":
      "Inspired by my own journey, I have used entrepreneurship as a way to support immigrants, provide them with practical solutions and contribute to their integration into Canadian society.",

    "about.history.mission.title": "A Mission of Transformation",

    "about.history.mission.text":
      "My commitment is based on two main goals: helping immigrants obtain residence and citizenship, and opening doors to the Canadian labour market.",

    "about.history.change.title": "A Catalyst for Change",

    "about.history.change.text":
      "I firmly believe that integration is strengthened through sports, culture and交流. My goal is to help build strong and dynamic communities where everyone has the opportunity to thrive.",

    "about.history.journey.title": "A Shared Journey",

    "about.history.journey.text":
      "My story is the story of everyone who believes it is possible to rewrite their future. Together, we make immigration a shared journey filled with courage, passion and determination.",

    // IMPACT
    "about.impact.title":
      "Discover Our Impact on Canadian Society, Particularly in Quebec",

    "about.impact.sport.title": "Impact Through Sports",

    "about.impact.sport.text":
      "We have supported sports initiatives designed to help immigrant communities integrate into Canadian society.",

    "about.impact.culture.title": "Cultural Impact",

    "about.impact.culture.text":
      "We have actively contributed to the promotion of immigrant cultures through community events.",

    "about.impact.professional.title": "Professional Integration",

    "about.impact.professional.text":
      "Helping immigrants find their place in the Canadian professional environment is at the heart of our mission.",
    /*services.html*/
    // =========================
    // SERVICES
    // =========================

    "services.title": "Our Services",

    "services.economic.title": "Economic Immigration",
    "services.economic.text":
      "There are approximately one hundred economic immigration programs available at the federal and provincial levels. These programs may allow skilled workers to apply for permanent residence.",

    "services.sponsorship.title": "Family Sponsorship",
    "services.sponsorship.text":
      "The family sponsorship immigration program is designed to reunite Canadian citizens and permanent residents with their close family members.",

    "services.temporary.title": "Temporary Residence",
    "services.temporary.text":
      "Each year, more than 35 million people visit Canada to take advantage of its many opportunities, including visiting family members or friends.",

    "services.humanitarian.title": "Humanitarian",
    "services.humanitarian.text":
      "An application for permanent residence from within Canada based on humanitarian and compassionate considerations may be submitted in certain circumstances:",
    "services.humanitarian.item1": "you are currently in Canada;",

    "services.refugee.title": "Refugee Protection",
    "services.refugee.text":
      "Canada offers refugee protection to certain people in Canada who fear persecution or who would face serious danger if they were required to leave.",
    "services.refugee.item1": "torture;",
    "services.refugee.item2": "a risk to their life;",
    "services.refugee.item3":
      "a risk of cruel and unusual treatment or punishment.",

    "services.business.title": "Business Immigration",
    "services.business.text":
      "Canada welcomes successful business people who are seeking new opportunities and challenges. Business immigration programs are designed to facilitate the admission of qualified applicants.",

    "services.learnMore": "Learn More",

    /*servicesDetailsEco.html*/
    // =========================
    // SERVICE - ECONOMIC IMMIGRATION
    // =========================

    "serviceEco.title": "Economic Immigration",

    "serviceEco.description":
      "This section addresses the processing of permanent residence applications submitted under the Federal Skilled Worker category. Applicants must qualify as skilled workers, demonstrate their ability to become economically established in Canada, and intend to settle in a province other than Quebec. The Canadian Experience Class (CEC) is a permanent residence category for individuals who have acquired skilled work experience in Canada. It was designed for temporary foreign workers and international graduates who have obtained eligible Canadian work experience. The Federal Skilled Trades Class applies to individuals who meet the applicable criteria for skilled trades, demonstrate their ability to become economically established in Canada, and intend to settle in a province other than Quebec. A self-employed person is a foreign national with relevant experience who has the intention and ability to be self-employed in Canada and who may make a significant contribution through cultural activities, athletic activities, or, for applications received before March 10, 2018, the purchase and management of a farm in Canada. The Provincial Nominee Program (PNP) allows provinces and territories to support the immigration of individuals who wish to settle in their province or territory and who may contribute to its economic development and prosperity, as well as that of Canada.",

    "serviceEco.otherServices": "Our Other Services",
    "serviceEco.sponsorship": "Family Sponsorship",
    "serviceEco.temporaryResidence": "Temporary Residence",
    "serviceEco.learnMore": "Learn More",

    /*servicesDetailsPar.html*/
    // =========================
    // SERVICE - FAMILY SPONSORSHIP
    // =========================

    "servicePar.title": "Family Reunification",

    "servicePar.description":
      "The family class immigration program is designed to reunite Canadian citizens and permanent residents with their close family members. By undertaking to sponsor members of the family class, the sponsor agrees to provide for their basic needs for a specified period so that they do not need to rely on social assistance. Priority is given to sponsorship applications involving spouses, common-law partners, conjugal partners and dependent children. Priority is also given to applications involving adopted children, children to be adopted and orphans, as these cases often involve minors without parental care. Additional information is available in the Adoptions document (PDF, 5.72 KB). No processing priority is given to other members of the family class. A permanent residence application under the family class is submitted together with the sponsorship application to a Canadian Case Processing Centre (CPC). CPCs are the primary offices responsible for processing family class sponsorship applications. Other Immigration, Refugees and Citizenship Canada (IRCC) offices may make certain decisions regarding eligibility under the family class, where applicable. Applicants should verify current processing times for family class applications.",

    "servicePar.otherServices": "Our Other Services",
    "servicePar.economic": "Economic Immigration",
    "servicePar.temporaryResidence": "Temporary Residence",
    "servicePar.learnMore": "Learn More",
    /*servicesDetailsRT.html*/
    // =========================
    // SERVICE - TEMPORARY RESIDENCE
    // =========================

    "serviceRT.title": "Temporary Residence",

    "serviceRT.description":
      "What is a temporary resident? A temporary resident is a foreign national who is legally authorized to enter Canada for a temporary purpose. A foreign national has temporary resident status when they are considered to meet the legal requirements to enter and/or remain in Canada as a visitor, student, worker or temporary resident permit holder. Only foreign nationals who are physically present in Canada hold temporary resident status. Immigration, Refugees and Citizenship Canada processes applications under several categories, including temporary resident visas, Electronic Travel Authorizations, international students, temporary workers and temporary resident permits. Temporary residents are subject to various conditions, including the authorized length of their stay in Canada [R183]. A Temporary Resident Visa (TRV) is an official counterfoil issued by a visa office and placed in a person’s passport to show that they have met the requirements for admission to Canada as a temporary resident. A TRV does not guarantee entry into Canada. Admission to Canada as a temporary resident is a privilege and not a right. The Electronic Travel Authorization (eTA) initiative is intended to strengthen mutual security between Canada and the United States by addressing potential threats as early as possible outside the North American perimeter. The initiative aligns Canadian and U.S. approaches to screening visa-exempt foreign nationals before departure. Under the initiative, visa-exempt foreign nationals, except U.S. citizens, are generally required to obtain an eTA before travelling to Canada by air unless they are exempt from this requirement. Certain low-risk foreign nationals who would otherwise require a visa may also be eligible to obtain an eTA to travel to Canada by air under the eTA expansion program.",

    "serviceRT.otherServices": "Our Other Services",
    "serviceRT.economic": "Economic Immigration",
    "serviceRT.sponsorship": "Family Sponsorship",
    "serviceRT.learnMore": "Learn More",

    /*rendezvous.html*/
    // =========================
    // APPOINTMENT BOOKING
    // =========================

    "booking.title": "Book an Appointment",

    "booking.subtitle":
      "Book a consultation with MAD Immigration Canada to receive a personalized assessment of your situation.",

    "booking.serviceTitle": "Choose Your Consultation",

    "booking.consultation60": "Consultation – 60 Minutes",

    "booking.consultation60Description":
      "A personalized consultation to review your situation and answer your Canadian immigration questions.",

    "booking.consultation60Price": "225 $CAD or 159$ us",

    "booking.preliminary": "Preliminary Assessment",

    "booking.preliminaryDescription":
      "A more comprehensive assessment of your profile and your potential Canadian immigration options.",

    "booking.preliminaryPrice": "749 $CAD or 599$ us",

    "booking.dateTitle": "Choose a Date",

    "booking.dateLabel": "Consultation Date",

    "booking.timeTitle": "Choose a Time",

    "booking.timezone": "Times are displayed in Montreal, Quebec time.",

    "booking.informationTitle": "Your Information",

    "booking.firstName": "First Name",

    "booking.lastName": "Last Name",

    "booking.email": "Email",

    "booking.phone": "Phone",

    "booking.country": "Country of Residence",

    "booking.subject": "Consultation Topic",

    "booking.selectSubject": "Select a Topic",

    "booking.economic": "Economic Immigration",

    "booking.sponsorship": "Family Sponsorship",

    "booking.temporary": "Temporary Residence",

    "booking.refugee": "Refugee / Asylum Claim",

    "booking.humanitarian": "Humanitarian",

    "booking.other": "Other",

    "booking.message": "Briefly Describe Your Situation",

    "booking.messagePlaceholder": "Please briefly describe your situation...",

    "booking.confirmationTitle": "Confirmation",

    "booking.consent":
      "I confirm that the information provided is accurate and I agree to be contacted by MAD Immigration Canada regarding this consultation.",

    "booking.submit": "Book My Consultation",

    "booking.note":
      "Your appointment will be confirmed after availability has been verified.",
    "nav.appointment": "Book an Appointment",

    /*confirmation.html*/
    "confirmation.title": "Thank You, Your Form Has Been Submitted",

    "confirmation.message":
      "We have successfully received your information. A member of MAD Immigration Canada will contact you after reviewing your request.",

    "confirmation.notice":
      "Please check your email and make sure our messages are not being sent to your spam or junk folder.",

    "confirmation.home": "Back to Home",
  },
};

function setLanguage(language) {
  const selectedLanguage = translations[language] ? language : "fr";

  document.documentElement.lang = selectedLanguage;

  document.title = translations[selectedLanguage].pageTitle;

  const metaDescription = document.querySelector('meta[name="description"]');

  if (metaDescription) {
    metaDescription.setAttribute(
      "content",
      translations[selectedLanguage].pageDescription,
    );
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (translations[selectedLanguage][key]) {
      element.textContent = translations[selectedLanguage][key];
    }
  });

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === selectedLanguage);
  });

  localStorage.setItem("madic-language", selectedLanguage);
}

document.querySelectorAll(".lang-btn").forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
  });
});

const savedLanguage =
  localStorage.getItem("madic-language") ||
  (navigator.language.startsWith("en") ? "en" : "fr");

setLanguage(savedLanguage);

//Display Mobile Menu
const mobileMenu = () => {
  menu.classList.toggle("is-active");
  menuLinks.classList.toggle("active");
};

menu.addEventListener("click", mobileMenu);

///////////////////////////////////////////////////////////
/* Set current year*/
const yearEL = document.querySelector(".year");
const currentYear = new Date().getFullYear();

if (yearEL) {
  yearEL.textContent = currentYear;
}
////
document.addEventListener("DOMContentLoaded", () => {
  const pageCarriere = document.getElementById("page-carriere");

  if (pageCarriere) {
    const profilePicture = document.querySelector(".profile-picture");

    // Adding dynamic hover effect to the profile picture
    profilePicture.addEventListener("mouseover", () => {
      profilePicture.style.transform = "scale(1.1)";
      profilePicture.style.transition =
        "transform 0.3s ease, box-shadow 0.3s ease";
    });

    profilePicture.addEventListener("mouseout", () => {
      profilePicture.style.transform = "scale(1)";
    });
  }
});

const consultationForm = document.getElementById("consultation-form");

if (consultationForm) {
  consultationForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(consultationForm);

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(formData).toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Erreur Netlify : ${response.status} ${response.statusText}`,
        );
      }

      window.location.href = "/confirmation.html";
    } catch (error) {
      console.error("Erreur lors de l'envoi du formulaire :", error);

      const language =
        localStorage.getItem("madic-language") ||
        document.documentElement.lang ||
        "fr";

      if (language === "en") {
        alert(
          "Your appointment request could not be submitted. Please try again.",
        );
      } else {
        alert(
          "Votre demande de rendez-vous n'a pas pu être envoyée. Veuillez réessayer.",
        );
      }
    }
  });
}

/* =========================================================
   RENDEZ-VOUS MADIC
   7 JOURS / 7
   08:00 À 23:00
   RÉSERVATION MAXIMUM 14 JOURS
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const dateInput = document.getElementById("consultation_date");

  const timeSlotsContainer = document.getElementById("booking-time-slots");

  const consultationForm = document.getElementById("consultation-form");

  if (!dateInput || !timeSlotsContainer || !consultationForm) {
    return;
  }

  /* =======================================================
     DATE / HEURE MONTRÉAL
     ======================================================= */

  function getMontrealNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

    const values = {};

    parts.forEach((part) => {
      values[part.type] = part.value;
    });

    return {
      date: `${values.year}-${values.month}-${values.day}`,

      hour: Number(values.hour),

      minute: Number(values.minute),
    };
  }

  /* =======================================================
     AJOUTER DES JOURS
     ======================================================= */

  function addDays(dateString, numberOfDays) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    date.setUTCDate(date.getUTCDate() + numberOfDays);

    return date.toISOString().slice(0, 10);
  }

  /* =======================================================
     LIMITES DU CALENDRIER
     ======================================================= */

  const now = getMontrealNow();

  const minDate = now.date;

  const maxDate = addDays(minDate, 14);

  dateInput.min = minDate;

  dateInput.max = maxDate;

  /* =======================================================
     CRÉER LES HEURES
     ======================================================= */

  function generateTimeSlots(selectedDate, bookedSlots = []) {
    timeSlotsContainer.innerHTML = "";

    const current = getMontrealNow();

    const isToday = selectedDate === current.date;

    let displayedCount = 0;
    let availableCount = 0;

    for (let hour = 8; hour <= 23; hour++) {
      const time = `${String(hour).padStart(2, "0")}:00`;

      /* ===============================================
         AUJOURD'HUI :
         HEURES PASSÉES = CACHÉES
         =============================================== */

      if (isToday && hour <= current.hour) {
        continue;
      }

      displayedCount++;

      const isBooked = bookedSlots.includes(time);

      const label = document.createElement("label");

      label.className = "time-slot";

      const input = document.createElement("input");

      input.type = "radio";

      input.name = "consultation_time";

      input.value = time;

      const span = document.createElement("span");

      /* ===============================================
         HEURE RÉSERVÉE
         =============================================== */

      if (isBooked) {
        input.disabled = true;

        label.classList.add("time-slot--booked");

        span.innerHTML = `
          <s>${time}</s>
          <small>Réservé</small>
        `;
      } else {
        span.textContent = time;

        availableCount++;
      }

      label.appendChild(input);

      label.appendChild(span);

      timeSlotsContainer.appendChild(label);
    }

    /* ===============================================
       PLUS AUCUNE HEURE AUJOURD'HUI
       =============================================== */

    if (displayedCount === 0) {
      timeSlotsContainer.innerHTML = `
        <div class="booking-day-full">
          <i class="fa-solid fa-calendar-xmark"></i>

          <strong>
            Plus de disponibilité aujourd'hui
          </strong>

          <span>
            Veuillez choisir une autre date.
          </span>
        </div>
      `;

      return;
    }

    /* ===============================================
       JOURNÉE COMPLÈTE
       =============================================== */

    if (availableCount === 0) {
      const message = document.createElement("div");

      message.className = "booking-day-full";

      message.innerHTML = `
        <i class="fa-solid fa-calendar-xmark"></i>

        <strong>
          Journée complète
        </strong>

        <span>
          Tous les créneaux sont déjà réservés.
        </span>
      `;

      timeSlotsContainer.appendChild(message);
    }
  }

  /* =======================================================
     CHARGER LES DISPONIBILITÉS
     ======================================================= */

  async function loadAvailability(selectedDate) {
    if (!selectedDate) {
      timeSlotsContainer.innerHTML = "";

      return;
    }

    if (selectedDate < minDate || selectedDate > maxDate) {
      dateInput.value = "";

      timeSlotsContainer.innerHTML = "";

      alert("Veuillez choisir une date comprise dans les 14 prochains jours.");

      return;
    }

    timeSlotsContainer.innerHTML = `
      <p class="booking-loading">
        Vérification des disponibilités...
      </p>
    `;

    try {
      const response = await fetch(
        `/.netlify/functions/booking?date=${encodeURIComponent(selectedDate)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      generateTimeSlots(
        selectedDate,
        Array.isArray(data.booked) ? data.booked : [],
      );
    } catch (error) {
      console.error("Erreur disponibilité :", error);

      /*
        Temporairement :
        afficher les heures même si
        la Function Netlify échoue.
      */

      generateTimeSlots(selectedDate, []);
    }
  }

  /* =======================================================
     CHANGEMENT DE DATE
     ======================================================= */

  dateInput.addEventListener("change", function () {
    loadAvailability(this.value);
  });

  /* =======================================================
     SOUMISSION
     ======================================================= */

  consultationForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const selectedDate = dateInput.value;

    const selectedTime = consultationForm.querySelector(
      'input[name="consultation_time"]:checked',
    );

    if (!selectedDate) {
      alert("Veuillez choisir une date.");

      return;
    }

    if (!selectedTime) {
      alert("Veuillez choisir une heure.");

      return;
    }

    const reservationData = {
      date: selectedDate,

      time: selectedTime.value,

      prenom: document.getElementById("booking_firstname")?.value || "",

      nom: document.getElementById("booking_lastname")?.value || "",

      courriel: document.getElementById("booking_email")?.value || "",
    };

    try {
      /* =============================================
           1. BLOQUER LE CRÉNEAU
           ============================================= */

      const reservationResponse = await fetch("/.netlify/functions/booking", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(reservationData),
      });

      /* =============================================
           DÉJÀ RÉSERVÉ
           ============================================= */

      if (reservationResponse.status === 409) {
        alert(
          "Ce créneau vient d'être réservé. Veuillez choisir une autre heure.",
        );

        await loadAvailability(selectedDate);

        return;
      }

      if (!reservationResponse.ok) {
        const data = await reservationResponse.json().catch(() => ({}));

        throw new Error(data.error || "Erreur lors de la réservation.");
      }

      /* =============================================
           2. NETLIFY FORMS
           ============================================= */

      const formData = new FormData(consultationForm);

      const netlifyResponse = await fetch("/", {
        method: "POST",

        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams(formData).toString(),
      });

      if (!netlifyResponse.ok) {
        throw new Error("Erreur lors de l'enregistrement du formulaire.");
      }

      /* =============================================
           3. CONFIRMATION
           ============================================= */

      window.location.href = "/confirmation.html";
    } catch (error) {
      console.error(error);

      alert(error.message || "Une erreur est survenue. Veuillez réessayer.");
    }
  });
});

localStorage.setItem("madic-theme", "dark");

document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");

  if (!themeToggle) {
    console.error("Bouton #theme-toggle introuvable.");
    return;
  }

  const icon = themeToggle.querySelector("i");

  function applyTheme(theme) {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");

      if (icon) {
        icon.className = "fa-solid fa-sun";
      }

      themeToggle.setAttribute("aria-label", "Activer le mode clair");

      themeToggle.title = "Mode clair";
    } else {
      document.body.classList.remove("dark-mode");

      if (icon) {
        icon.className = "fa-solid fa-moon";
      }

      themeToggle.setAttribute("aria-label", "Activer le mode nuit");

      themeToggle.title = "Mode nuit";
    }
  }

  const savedTheme = localStorage.getItem("madic-theme") || "light";

  applyTheme(savedTheme);

  themeToggle.addEventListener("click", function () {
    const isDark = document.body.classList.contains("dark-mode");

    const newTheme = isDark ? "light" : "dark";

    localStorage.setItem("madic-theme", newTheme);

    applyTheme(newTheme);
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const mobileMenu = document.getElementById("mobile-menu");

  const navbarContent = document.getElementById("navbar-content");

  if (!mobileMenu || !navbarContent) {
    return;
  }

  mobileMenu.addEventListener("click", function () {
    const isOpen = navbarContent.classList.toggle("active");

    mobileMenu.classList.toggle("active", isOpen);

    mobileMenu.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  /* Fermer après clic sur un lien */

  navbarContent.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", function () {
      navbarContent.classList.remove("active");

      mobileMenu.classList.remove("active");

      mobileMenu.setAttribute("aria-expanded", "false");
    });
  });

  /* Fermer avec ESC */

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      navbarContent.classList.remove("active");

      mobileMenu.classList.remove("active");

      mobileMenu.setAttribute("aria-expanded", "false");
    }
  });
});
