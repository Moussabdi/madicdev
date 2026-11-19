# MADIC PORTAIL — Double authentification et révocation client

## Installation

1. Dans un environnement de test, intégrer le contenu du ZIP à la racine de MadicDev en conservant les chemins. Déployer les fichiers du portail avant d’activer la migration, afin que les formulaires de vérification soient disponibles.
2. Dans Supabase, vérifier que l’inscription et la vérification TOTP sont activées. Exécuter `sql/30_mfa_et_revocation_client.sql` dans le SQL Editor du projet, après les migrations existantes d’invitation et d’accès invité. Le script protège les appels authentifiés de l’API de données et les opérations de stockage soumises à la RLS.
3. Valider les parcours ci-dessous dans l’environnement de test avant de reprendre les mêmes étapes en production. Si un hook PostgREST est déjà configuré, la migration se termine sans appliquer les changements. Dans ce cas, adapter la section du script qui configure `pgrst.db_pre_request` pour conserver le hook existant, et ajouter l’appel à `public.madic_require_session_mfa()` dans ce hook au sein de la même migration.

## Double authentification

À la première connexion, sélectionner **Configurer l’application**, scanner le code QR avec une application d’authentification et saisir le code à six chiffres. Le portail demande ensuite le code lors d’une nouvelle connexion. Le même parcours s’applique aux clients, aux CRIC, aux administrateurs et aux invités. Les comptes existants doivent configurer leur second facteur lors de leur prochaine connexion.

Tester l’inscription du facteur, la saisie d’un code incorrect, une nouvelle connexion avec un facteur déjà inscrit et l’ouverture d’un lien d’invitation.

## Révocation par le CRIC

Dans **Gestion des clients → fiche du client → Accès au portail client**, sélectionner **Révoquer l’accès du client**, puis confirmer. Le CRIC propriétaire d’un cabinet actif peut révoquer le rattachement à son cabinet. La révocation invalide les invitations en attente du client à ce cabinet et les accès de ses personnes de confiance à ce dossier. Les dossiers, contrats et documents sont conservés. Une invitation émise après la révocation permet de rattacher à nouveau le client. Les personnes de confiance nécessitent une nouvelle invitation.

Tester avec un client rattaché à deux cabinets. Après révocation par le cabinet A, le client doit conserver l’accès au cabinet B. Vérifier aussi le refus via une ancienne adresse de dossier, les accès invités, les pièces jointes et la réactivation par une nouvelle invitation. Une URL de téléchargement signée générée avant la révocation reste utilisable jusqu’à l’échéance qui lui a déjà été attribuée.
