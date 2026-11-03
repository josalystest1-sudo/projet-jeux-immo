# Historique de Cadastra

Ce fichier raconte ce qui a été fait, dans l'ordre, avec les demandes et les décisions de Gautier. Il sert à reprendre le projet sans rien perdre, quel que soit l'outil (conversation Claude, Claude Code sur le PC, Claude Code dans le cloud).

**À compléter à chaque PR** : une ligne dans « Toutes les PR », et une phrase dans le récit quand Gautier a demandé ou décidé quelque chose. Le détail technique de chaque étape est dans `PROGRESS.md`, les règles du jeu dans `docs/GDD.md`, l'ordre des étapes dans `docs/PLAN.md`, les consignes de travail dans `CLAUDE.md`. Pour changer d'outil : `docs/REPRENDRE-DANS-CLAUDE-CODE.md`.

## Où vit quoi

Rien d'important ne vit dans une conversation : tout est dans le dépôt ou sur les services ci-dessous.

| Quoi | Où |
|---|---|
| Le code, les données, les documents | GitHub `josalystest1-sudo/projet-jeux-immo` (public), branche `main` |
| Le jeu publié | https://josalystest1-sudo.github.io/projet-jeux-immo/ (mis à jour 1 à 2 minutes après chaque fusion sur `main`) |
| Le serveur : comptes, joueurs, lieux, offres, ventes, notifications, robots | Supabase, projet `cadastra`, organisation Josalys (offre gratuite). Ses tables et fonctions sont décrites dans `supabase/` et envoyées par `.github/workflows/serveur.yml` à chaque fusion (`docs/serveur/ARCHITECTURE.md`) |
| La clé qui permet de publier le serveur | secret GitHub `SUPABASE_ACCESS_TOKEN`, posé par Gautier (Claude ne la voit jamais) |
| La clé Google (Street View) | `data/google.json` (publique, limitée au site du jeu ; services payants mis à 0 dans la console Google, projet « Le Laboratoire ») ; `docs/serveur/GUIDE-GOOGLE.md` |
| Le rythme du serveur d'essai | table `reglages` : `jour_secondes` = 60 (un jour du jeu = une minute) |
| Le tout premier prototype | branche `proto-cadastre` du dépôt `projet-arena` (adresse `/proto-cadastre/`) : provisoire, à retirer de l'Arena |

## Le récit

### Avant le dépôt (octobre – 2 novembre 2026)
- Le projet part d'une idée de loterie gratuite (écartée : les bots, et les règles des loteries), puis d'un jeu de collection façon WikiMasters. Gautier veut des objets uniques que tout le monde connaît : les adresses. Il retient « un jeu comme Upland, sans blockchain » : collectionner les vrais lieux de France.
- 2 nov. : premier prototype, hébergé provisoirement dans le dépôt de l'Arena. D'abord une carte du cadastre cliquable avec photo aérienne (« pas beau »), puis une ville 3D stylisée (bâtiments IGN), la vue 2D/3D, la recherche, les constructions façon Monopoly.
- 2 nov. : l'économie est discutée puis posée par Gautier. Packs gratuits et payants, loyers, pas de taxe, pas de délai de revente, pas de vente à la banque. Marché entre joueurs, enchères de monuments, Maire = le plus de lieux dans la commune. Le standing (prix DVF) et la notoriété fixent jusqu'où l'on construit.
- 2 nov. : interview en cinq volets, puis GDD V1, plan en 11 phases et `CLAUDE.md`. Nom de travail : Cadastra ; monnaie : les pièces.

### 2 novembre 2026, soir et nuit : le dépôt et les fondations
- Gautier crée le dépôt `projet-jeux-immo`, le passe en public et active la publication (GitHub Pages).
- **Phase 0** : moteur de règles et tests. Le nom Cadastra, avec la vérification des domaines et des marques.
- **Données** : le standing réel des communes (DVF) et 458 monuments (Wikidata).
- **Lieux célèbres** : les églises, chapelles, cathédrales et abbayes ayant un article Wikipédia.
- **Jeu** : trois enchères par semaine, le pack tiré par rareté, le filtre des pseudos, le bouton Signaler, la récolte à la connexion.
- **Supabase** : Gautier choisit Supabase, et Claude crée le projet `cadastra` dans son Chrome. L'inscription par e-mail suit. Décision de Gautier : **le pseudo est définitif**.

### 3 novembre 2026, nuit : la refonte « la plaque et la pièce »
- Demande de Gautier : « le jeu doit être super beau ». Nouvelle identité : plaques de rue émaillées et pièces d'or (`docs/DESIGN.md`).
- Tous les écrans sont refaits, ainsi que le guide des premiers pas et l'icône. Nouvel outil de captures de tous les écrans.

### 3 novembre 2026, matin : les retours de Gautier (PR #1 à #20)
- **Lenteurs** : la recherche d'une adresse lointaine laissait l'écran vide. Le voyage passe maintenant par un saut direct, et la carte se repose.
- **Pack et monnaie** : les cartes du pack ne cachent plus le bouton, et la monnaie a un nouveau signe (une pièce en forme de maison).
- **Cartes** : plaques de rue réalistes, l'adresse sur un mur de briques, cartes « full art ».
- **Mise à jour** : le jeu se met à jour tout seul sur le téléphone.
- **Échanges** : on peut échanger un lieu, puis plusieurs d'un coup. Décision de Gautier : **un lieu libre ne s'achète pas**, il sort des packs.
- **Street View** : la vue se fait depuis la rue, plus jamais depuis l'intérieur d'une boutique. Avec la clé Google, le monument est vu de dehors, de face, à hauteur d'yeux. « Voir sur la carte » ouvre toujours la fiche.
- **Lisibilité** : une interface plus lisible sur téléphone (« brouillon, des infos qui se chevauchent »).
- **Raretés** : décision de Gautier, **six raretés**, dont Légendaire orange (lieux célèbres) et Extraordinaire arc-en-ciel (monuments, enchères seulement). Le Gratte-ciel est ajouté. Après « tu as 2 immeubles » : **un bâtiment par rareté**, avec le Palace.
- **Publication** : les règles se mettent à jour avec la page (le téléphone gardait les anciennes).
- **Communes** : on peut chercher une commune pour voir son Maire.

### 3 novembre 2026, après-midi : le vrai serveur (PR #21 à #33)
- Choix de Gautier : **le serveur d'abord, la boutique ensuite**.
- **Fondations (8.1a)** : tables, fonction `jeu`, mise à jour automatique du serveur et essai automatique avec un joueur jetable. Gautier pose le secret GitHub depuis son téléphone.
- **Pack (8.1c)** : le pack du jour est tiré par le serveur, avec le même code que la démo.
- **Le jeu sur le serveur (8.1b)** : un interrupteur « Jouer sur le vrai serveur (essai) ».
- **Le monde réel (8.1d)** : les vrais propriétaires, les Maires et les profils. Corrigé : le guide annulait l'ouverture du pack.
- **Le marché (8.1e)** : vente, achat, offres et notifications.
- **Serveur accéléré** : demande de Gautier, un jour du jeu = une minute sur le serveur d'essai.
- **Robots** : idée de Gautier, six comptes robots jouent seuls sur le serveur d'essai.
- **Offres lisibles** : une offre montre la valeur du lieu et l'écart, et les robots achètent vraiment (« personne ne m'achète »).
- **La valeur bouge** : choix de Gautier, selon les ventes de la commune, l'activité du quartier et la tendance de la semaine.

### 3 novembre 2026, fin d'après-midi
- **La promenade en Street View** (PR #34) : demande de Gautier. On se balade dans les rues, on voit sur la carte les bâtiments qu'on longe, leur propriétaire et leur prix, et on peut les acheter ou faire une offre.
- **Idée écartée : les enseignes des commerces à la place des adresses** (« Subway porte d'Orléans »). Claude a dressé la liste des pour et des contre : marques utilisées sans accord dans un jeu payant, petits commerces au nom de leur patron, commerces qui ferment, données brouillonnes. Gautier abandonne l'idée.
- **Correctif de la promenade** (PR #36) : retour de Gautier, après avoir touché la carte on ne pouvait plus tourner dans Street View. Le geste partait dans la page Google intégrée : elle ne reçoit plus aucun toucher, et un lien « Google Maps ↗ » ouvre la même vue chez Google.
- **Passage à Claude Code** (PR #35) : demande de Gautier. Cet historique, la procédure `docs/REPRENDRE-DANS-CLAUDE-CODE.md`, les documents de suivi mis à jour, et l'outil d'essai de la promenade versé dans le dépôt.

### 3 novembre 2026, soir : la reprise dans Claude Code
- Gautier clone le dépôt sur son PC (dossier `Documents/jeu immo`) et lance la reprise. Les outils sont là ; un test échouait seulement sous Windows (PR #38). Choix de Gautier : ce correctif, puis les échanges sur le serveur (8.1f).
- **Les échanges sur le serveur (8.1f)** (PR #39) : proposer ses lieux (plus des pièces) à un vrai joueur ou à un robot, recevoir un échange dans ses notifications avec la valeur de chaque côté, accepter ou refuser. Les robots répondent et proposent parfois des échanges, pour pouvoir essayer seul.

## Toutes les PR

Heures de Paris. Avant la PR #1, le travail était poussé directement sur `main` :

| Date | Étape |
|---|---|
| 02/11 19:21 | Phase 0 : référence du projet (CLAUDE.md, GDD, plan), prototype, publication GitHub Pages |
| 02/11 19:26 | Phase 0 : moteur de règles des lieux, réglages d'économie et tests |
| 02/11 19:32 | Le jeu s'appelle Cadastra (puis la vérification des domaines et des marques) |
| 02/11 20:30 | Phase 1.5 : standing réel des communes (DVF) et 458 monuments (Wikidata) |
| 02/11 20:46 | Publication : lancer les tests sans `npm ci` |
| 02/11 21:04 | Carte : le badge « en vente » ne s'étale plus en grande ellipse sombre |
| 02/11 21:14 | Lieux célèbres : églises et chapelles ; repère ⭐ toujours visible (21:42) ; cathédrales et abbayes (21:56) |
| 02/11 21:49 | Enchères : 3 monuments par semaine (1 national + 2 régionaux) |
| 02/11 21:56 | Pack tiré par rareté et révélation accélérée d'un toucher |
| 02/11 22:22 | Compte et patrimoine : filtre des pseudos, Signaler, récolte à la connexion, filtres |
| 02/11 23:27 | Guide Supabase ; projet `cadastra` créé et premières tables (23:34) |
| 02/11 23:45 | Inscription obligatoire (e-mail + mot de passe), puis pseudo + avatar |
| 02/11 23:52 | Le pseudo est définitif |
| 03/11 00:11 | Nouveau style « la plaque et la pièce » ; tous les écrans (00:19) ; finitions (00:24) ; pack, icône, installation (00:28) ; outil de visite des écrans (00:32) |

Puis une PR par étape, fusionnée en squash :

| PR | Fusionnée | Titre |
|---|---|---|
| #1 | 03/11 08:14 | Recherche rapide, cartes du pack à leur place, nouvelle pièce |
| #2 | 03/11 08:21 | Écran de voyage : attendre une image dessinée avant de juger le quartier chargé |
| #3 | 03/11 08:35 | Plaque de rue plus réaliste, adresses en plaques sur les cartes, prix de vente au choix |
| #4 | 03/11 08:44 | Cartes : la plaque de rue sur un mur de briques rouges |
| #5 | 03/11 08:51 | Cartes « full art » : l'illustration sur toute la carte |
| #6 | 03/11 08:56 | Le jeu se met à jour tout seul sur le téléphone |
| #7 | 03/11 08:59 | Proposer d'échanger un de ses lieux contre celui d'un autre joueur |
| #8 | 03/11 09:05 | Un lieu libre ne s'achète pas : il sort des packs |
| #9 | 03/11 09:17 | Street View : regarder le lieu depuis la rue, plus l'intérieur d'une boutique |
| #10 | 03/11 09:42 | Street View prêt pour la clé Google : photo d'extérieur, visée exacte |
| #11 | 03/11 10:55 | Street View avec la clé Google : le monument vu de dehors, de face |
| #12 | 03/11 10:57 | Street View : regarder le monument à hauteur d'yeux |
| #13 | 03/11 11:06 | « Voir sur la carte » ouvre la fiche même pour un monument sur la rue |
| #14 | 03/11 11:16 | Bâtiment rouge = lieu d'un joueur ; échanger plusieurs lieux d'un coup |
| #15 | 03/11 11:25 | Enchères : « Voir sur la carte » ouvre la fiche du monument |
| #16 | 03/11 11:32 | Interface plus lisible sur téléphone |
| #17 | 03/11 11:44 | Six raretés (Légendaire orange, Extraordinaire arc-en-ciel) et le Gratte-ciel |
| #18 | 03/11 11:50 | Un bâtiment par rareté (le Palace) |
| #19 | 03/11 11:52 | Publication : les règles se mettent à jour avec la page |
| #20 | 03/11 12:00 | Communes : chercher une commune et voir son Maire |
| #21 | 03/11 13:40 | Serveur 8.1a : fondations (tables, fonction « jeu », mise à jour automatique) |
| #22 | 03/11 13:55 | Serveur : déployer la fonction sans confirmation |
| #23 | 03/11 13:58 | Serveur : droits de la fonction sur ses tables, détail des pannes |
| #24 | 03/11 14:06 | Serveur 8.1c : le pack du jour tiré par le serveur (tirage partagé) |
| #25 | 03/11 14:12 | Serveur 8.1b : le jeu joue sur le vrai serveur (interrupteur d'essai) |
| #26 | 03/11 14:56 | Serveur 8.1d : le monde réel ; un pack ne s'ouvre qu'une fois à la fois |
| #27 | 03/11 15:05 | Serveur 8.1e : le marché (vente, achat, offres, notifications) |
| #28 | 03/11 15:13 | Serveur d'essai accéléré : un jour du jeu = une minute |
| #29 | 03/11 15:22 | Serveur d'essai : des joueurs robots qui jouent seuls |
| #30 | 03/11 15:26 | Robots : le serveur a le droit d'écrire les profils |
| #31 | 03/11 15:30 | Essai du serveur : ce que les robots ont fait |
| #32 | 03/11 16:25 | Offres : la valeur de ton lieu et l'écart ; des robots acheteurs |
| #33 | 03/11 16:34 | La valeur d'un lieu bouge : ventes de la commune, activité du quartier, tendance de la semaine |
| #34 | 03/11 17:22 | La promenade en Street View |
| #35 | 03/11 17:30 | Historique, suivi du projet et procédure pour continuer dans Claude Code |
| #36 | 03/11 18:19 | Promenade : on peut toujours tourner dans Street View (le geste ne part plus dans la page Google) |
| #37 | 03/11 20:51 | Notes : une phrase de CLAUDE.md corrigée, heures des PR |
| #38 | 03/11 21:30 | Reprise dans Claude Code : le test du serveur passe aussi sous Windows |
| #39 | 03/11 21:39 | Serveur 8.1f : les échanges entre joueurs |

## Les décisions de Gautier

Les décisions du 2 novembre (interview) sont dans `CLAUDE.md` § 4 et dans le GDD (étiquette [Décidé]). Depuis :

| Date | Décision |
|---|---|
| 2 nov. | Supabase pour le serveur (plutôt que le VPS du site de quiz) |
| 2 nov. | Le pseudo est définitif : choisi une fois, jamais modifiable par le joueur |
| 3 nov. | « Le jeu doit être super beau » : la refonte « la plaque et la pièce » ; un signe de monnaie plus original |
| 3 nov. | Un lieu libre ne s'achète pas : il sort des packs ; on achète seulement à un joueur (vente, offre, échange) |
| 3 nov. | Échanger des lieux, y compris plusieurs d'un coup |
| 3 nov. | Six raretés : Commun, Peu commun (vert), Rare (bleu), Épique (violet), Légendaire (orange, lieux célèbres, dans les packs), Extraordinaire (arc-en-ciel, monuments, enchères seulement) |
| 3 nov. | Un bâtiment par rareté : Maison, Immeuble, Tour, Gratte-ciel, Palace, Prestige |
| 3 nov. | Pouvoir chercher une commune pour voir son Maire |
| 3 nov. | Le serveur d'abord, la boutique ensuite |
| 3 nov. | Un serveur d'essai accéléré (un jour = une minute), et des robots qui jouent dessus |
| 3 nov. | Une offre reçue montre la valeur du lieu et l'écart |
| 3 nov. | La valeur d'un lieu bouge : ventes de la commune, activité du quartier, tendance de la semaine (le loyer et le coût des constructions ne bougent pas) |
| 3 nov. | La promenade en Street View, pour voir et acheter les bâtiments qu'on longe |
| 3 nov. | Pas d'enseignes ni de marques sur les lieux (idée examinée, puis écartée) |
| 3 nov. | Continuer le projet dans Claude Code |

## Ce qui reste à faire (au 3 novembre au soir)

- **Le serveur, suite** (phase 8) :
  - 8.1g : les enchères sur le serveur ;
  - 8.2 : le mode serveur par défaut, la fin des joueurs simulés, l'inscription des amis. Question posée à Gautier, sans réponse : couper la confirmation par e-mail pendant les essais ?
  - 8.3 : l'anti-triche.
- **La boutique** (phase 9) : Stripe, packs et Pass mensuel, probabilités affichées, blocage Belgique et Pays-Bas, CGU, confidentialité, mentions légales.
- **Ensuite** : les graphismes (phase 10), l'équilibrage et le lancement (phase 11).
- **Au lancement** :
  - remettre `jour_secondes` à 86400 et repartir de zéro ;
  - supprimer les robots ;
  - brancher un service d'envoi d'e-mails (celui de Supabase n'écrit qu'à l'équipe Supabase) ;
  - confirmer le nom (Cadastra reste le nom de travail).
- **Petites choses** :
  - les autres catégories de lieux célèbres (châteaux, mairies, gares… quand Wikidata répond) ;
  - retirer le prototype du dépôt de l'Arena ;
  - relire les 60 monuments nationaux ;
  - valider les seuils du standing et la capacité de gestion.
