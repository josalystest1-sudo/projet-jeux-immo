# Plan de développement — Cadastra

Méthode (la même que le Projet Arena) : **tout le game design d'abord, puis les graphismes, l'équilibrage à la fin.** Une PR par étape, petite, en français, fusionnée en squash sur `main` quand les tests passent. Le jeu publié se met à jour après chaque fusion ; Gautier teste sur son téléphone.

État de départ (2 nov. 2026) : un prototype jouable `proto/index.html` (carte 3D, packs, patrimoine, enchères, communes, offres, notifications, profil, ouverture de pack 3D, révélation FIFA) avec des joueurs simulés et un état local. Il sert de référence d'expérience ; le vrai jeu le reconstruit proprement.

## Phase 0 — Mise en place (1 soirée)
- 0.1 Dépôt GitHub `jeu-adresses` (privé), ce dossier à la racine, publication GitHub Pages, `CLAUDE.md` et ce plan.
- 0.2 Projet Supabase (gratuit) créé par Gautier : URL + clé publique dans `data/serveur.json` (jamais la clé `service_role`).
- 0.3 Squelette de l'application : une page web (PWA), MapLibre, modules séparés (carte, patrimoine, enchères, communes, notifications, pack, révélation), **serveur simulé** tant que Supabase n'est pas branché.

## Phase 1 — Les lieux et la carte (2 soirées)
- 1.1 La carte 3D telle que le prototype (BD TOPO, PCI, parcelles, badges), vue 2D/3D, recherche.
- 1.2 La fiche d'une parcelle : ses lieux (BAN + POI), Street View, propriétaire.
- 1.3 Le modèle « lieu » : identifiant stable, commune, standing (provisoire par code INSEE, DVF en 1.5), notoriété (provisoire par catégorie POI, Wikidata en 1.5), plafond, rareté.
- 1.4 Tests : classification de 50 lieux connus (tour Eiffel = monument, église de Clévilliers = rare, 67 rue des Martyrs = peu commun…).
- 1.5 Script de données : standing par commune depuis DVF ; notoriété depuis Wikidata ; liste des monuments (60 nationaux + ~400 régionaux) dans `data/monuments.json`.

## Phase 2 — Le compte et le patrimoine (2 soirées)
- 2.1 Inscription obligatoire (e-mail + mot de passe, Google/Apple), puis pseudo (filtre de mots) et avatar.
- 2.2 Patrimoine : cartes par rareté, valeur, revenu, récolte à la connexion (24 h max), construction instantanée (Maison / Immeuble / Tour / Prestige).
- 2.3 Profil public d'un joueur, bouton Signaler (file de signalements pour Gautier).

## Phase 3 — Le pack du jour (2 soirées)
- 3.1 Tirage serveur : 5 lieux uniques dans toute la France, garanties de rareté, exclusion des lieux possédés.
- 3.2 L'ouverture : fondu, pack 3D, déchirure, révélation FIFA, cartes ; reprise de `proto/`.
- 3.3 Compteur « prochain pack » (push : V2).

## Phase 4 — Le marché (2 soirées)
- 4.1 Mettre en vente à prix libre, badge 💰, achat direct.
- 4.2 Offres sur n'importe quel lieu, sans expiration, modifiables ; acceptation avec vérification des fonds ; notifications.
- 4.3 Historique des transactions sur la fiche d'un lieu.

## Phase 5 — Les enchères (1 à 2 soirées)
- 5.1 Calendrier des monuments (3 par semaine), mises, fonds bloqués, clôture avec repli sur la mise suivante, attribution.
- 5.2 Écran Enchères, notifications de surenchère.

## Phase 6 — Communes et Maires (1 soirée)
- 6.1 Classement par commune, Maire (égalité = deux Maires), écusson sur la carte et le profil.
- 6.2 Recherche d'une commune, fiche de commune.

## Phase 7 — Niveau de joueur (1 soirée)
- 7.1 Niveau de joueur (connexion, constructions) et, si retenue, la capacité de gestion. (Collections : V2.)

## Phase 8 — Le vrai serveur (2 à 3 soirées)
- 8.1 Supabase : tables lieux-possédés, joueurs, offres, enchères, notifications ; règles de sécurité (un joueur ne modifie que ce qui est à lui ; les tirages, ventes et enchères passent par des fonctions serveur, jamais par le client).
- 8.2 Les joueurs simulés disparaissent ; les 24 premiers vrais comptes (amis) testent.
- 8.3 Anti-triche : limites par compte et par appareil, un pack par jour vérifié côté serveur, détection des multi-comptes (appareil, IP, rythme).

## Phase 9 — Boutique (1 à 2 soirées)
- 9.1 Packs payants et Pass mensuel : Stripe sur le web (PWA) ; les stores plus tard.
- 9.2 Probabilités affichées, blocage Belgique / Pays-Bas, CGU et politique de confidentialité, mentions légales (micro-entreprise Josalys).

## Phase 10 — Graphismes (plusieurs semaines, par preuve avant la série)
- 10.1 Pochette : modèle 3D souple (Meshy / Blender), reliefs, illustration du recto.
- 10.2 Cartes : dos illustré, cadres par rareté, foil sur les rares.
- 10.3 Déchirure qui suit le doigt, cartes qui glissent du pack, vrais sons (CC0), musique de la révélation.
- 10.4 Monuments en 3D stylisée (par preuve : la tour Eiffel d'abord).
- 10.5 Habillage de la révélation FIFA (fond de carte, typographie animée).
- 10.6 Icône, logo Cadastra, écran d'accueil.

## Phase 11 — Équilibrage et lancement
- 11.1 Simulation à agents (6 mois, 5 profils de joueurs) → réglage des coûts, loyers, salaire, garanties de packs, mises de départ.
- 11.2 Bêta fermée (amis), puis ouverte ; mesure : rétention à J1/J7/J30, taux de payants, prix moyen.
- 11.3 Lancement : site, réseaux, premier calendrier de monuments.

## V2 (après lancement)
Cosmétiques (styles de bâtiments, plaques), commerces partenaires sur la carte, cadeaux, projets de quartier, autres pays, applications natives (vibrations iPhone, achats intégrés).
