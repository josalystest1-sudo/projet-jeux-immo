# Le vrai serveur de Cadastra (phase 8)

## Le principe

- **Le jeu lit, le serveur écrit.** Le navigateur lit les tables Supabase (ses pièces, les lieux de tous pour la carte et les classements) ; il n'a le droit d'écrire **nulle part**. Chaque action (récolter, construire, ouvrir le pack, vendre, acheter, faire une offre, échanger, miser) est une demande à la fonction Edge **`jeu`**.
- **Les mêmes règles partout.** La fonction `jeu` applique les règles du jeu (`src/regles/*.js` et `data/*.json`), recopiées telles quelles par `tools/serveur_prepare.js` : un lieu a la même rareté, le même plafond, la même valeur et le même loyer dans le navigateur et sur le serveur (`tests/serveur.test.js`).
- **Des écritures atomiques.** La fonction calcule (coût, loyer, prix), puis appelle une fonction SQL `jeu_*` (`supabase/sql/`) qui vérifie et écrit d'un bloc (pièces suffisantes, lieu à soi, niveau suivant…). Ces fonctions SQL ne sont appelables que par le serveur (`service_role`).
- **Le même tirage.** Le pack du jour est tiré par `src/tirage.js`, le même code dans le jeu (mode démo) et sur le serveur ; le réseau (géocodeur IGN) et « ce lieu est-il libre ? » sont fournis par l'appelant. Sur le serveur, la graine est secrète (le joueur ne peut pas choisir ses lieux) et les lieux célèbres et contours de la France sont embarqués dans la fonction.
- **Le temps du serveur.** La durée d'un jour du jeu est un réglage du serveur (`reglages.jour_secondes`, `supabase/sql/040_vitesse.sql`) : **60 tant qu'on teste** (serveur d'essai accéléré : un jour = une minute, comme la démo ; demande de Gautier, 3 nov.), **86400 au lancement** (le pack à minuit, heure de Paris ; on repart alors de zéro). Le jour du jeu est un numéro (`Regles.jourDuJeu`), le même côté jeu et serveur ; le jeu prend la durée dans la partie renvoyée (`jourMs`).

## Les tables (à ce jour)

| Table | Contenu | Le jeu peut |
|---|---|---|
| `profils` | pseudo (définitif), icône | lire tous ; créer le sien ; changer son icône |
| `signalements` | les signalements (traités par Gautier) | en envoyer |
| `joueurs` | pièces, dernière récolte, dernier pack | lire **le sien** |
| `lieux` | chaque lieu possédé : propriétaire, niveau, prix de vente, commune, parcelle | lire tous |
| `ventes` | chaque vente (lieu, commune, prix, valeur au moment de la vente) : le marché des communes, l'historique d'un lieu | lire (sans les joueurs) |
| (fonctions) `marche_communes(communes, depuis)`, `quartiers(pts, dlat, dlon)` | le prix moyen des ventes rapporté à la valeur ; l'activité autour de points | appeler (lecture seule) |
| `reglages` | la vitesse du temps (`jour_secondes`) | lire |
| `offres` | offres en attente et réglées (une seule en attente par acheteur et par lieu) | lire les siennes (acheteur ou vendeur) |
| `notifications` | offres reçues, ventes, réponses | lire les siennes |
| (fonctions) `classement_commune(c)`, `maires(communes)` | qui possède combien dans une commune ; ses Maires | appeler (lecture seule) |

## Côté jeu : le mode serveur

- `MODE_SERVEUR` (Réglages → « Jouer sur le vrai serveur (essai) », gardé dans `localStorage['cadastra-mode']`) : la partie vit sur le serveur (`CLE_ETAT` = `cadastra-serveur-v1` pour ce qui reste sur l'appareil : réglages, notifications vues…), en vrais jours (`JOUR` = 24 h ; le pack se renouvelle à minuit, heure de Paris). Sans lui, la démo locale d'avant (un jour = une minute, joueurs simulés).
- `agir(action, corps)` appelle la fonction `jeu` et, si tout va bien, se recale sur la partie qu'elle renvoie (`appliquerEtat`) ; un refus s'affiche tel quel. `synchroniser()` au démarrage, avant la récolte.
- Le monde réel (`PROPRIOS`, `JOUEURS`, `MAIRES`, `CLASSEMENTS`, `REEL`) : `chargerZone()` lit les lieux du quartier à l'écran (après chaque déplacement), `chargerProprios()` ceux d'une parcelle ouverte, `calculerReel()` place chaque lieu sur sa parcelle (dedans, sinon la plus proche à 12 m : les points d'adresse tombent sur le trottoir) pour la couleur ; `ownerOf`, `levelOf`, `enVente`, `prixDemande` lisent ces données au lieu des joueurs simulés.
- `surveiller()` toutes les minutes (page visible, pas pendant un pack) : la partie, les offres et notifications à jour, un bandeau pour une nouvelle notification.
- Ce qui n'est pas encore sur le serveur (échanges, enchères) répond `bientot()` ; les minuteries de la démo (offres et enchères simulées) sont arrêtées.

## Les joueurs robots (serveur d'essai)

Demande de Gautier (3 nov.) : de vrais comptes qui jouent seuls, pour tester le marché et les mairies sans attendre d'autres joueurs. Six robots (`tools/serveur_robots.js`, créés par la publication s'ils manquent ; pseudo à prénom inventé, icône 🤖, table `robots`). Après chaque appel d'un vrai joueur, la fonction `jeu` leur fait jouer un tour (au plus toutes les 20 s, `jeu_robots_tour`, trois robots par tour) : récolter ; prendre un lieu **près d'un lieu d'un vrai joueur** (un par jour du jeu, quinze au plus) ; répondre aux offres reçues depuis 20 s (oui à partir de 110 % de la valeur) ; parfois faire une offre (85 à 140 % de la valeur, une seule en attente), acheter un lieu en vente pas trop cher (jusqu'à 150 % de sa valeur, une fois sur deux par tour, parmi tout ce que vendent les vrais joueurs ; les robots ont au moins 100 000 pièces), mettre un lieu en vente (110 à 150 %), construire. Ils ignorent les joueurs jetables de l'essai (sans pseudo). **Au lancement : les supprimer** (`supabase/sql/050_robots.sql`).

## La mise à jour

`.github/workflows/serveur.yml`, à chaque fusion qui touche le serveur ou les règles : tests → SQL envoyé par l'API de gestion Supabase → fonction `jeu` déployée → essai complet (`tools/serveur_essai.js` : un joueur jetable se connecte, joue, essaie de tricher, puis est supprimé). Besoin : le secret GitHub `SUPABASE_ACCESS_TOKEN` (`GUIDE-SERVEUR.md`).

## Les étapes

| Étape | Contenu | État |
|---|---|---|
| 8.1a | Fondations : `joueurs`, `lieux`, fonction `jeu` (état, récolte, construction), mise à jour et essai automatiques | fait |
| 8.1b | Le jeu connecté joue sur le serveur : pièces, patrimoine, récolte, construction, pack (interrupteur « Jouer sur le vrai serveur (essai) » dans les Réglages) | fait |
| 8.1c | Le pack du jour tiré par le serveur (raretés, lieux libres, un par jour, heure de Paris) : action `pack`, tirage partagé `src/tirage.js` | fait |
| 8.1d | Le monde réel : sur la carte, les parcelles des vrais joueurs (rouge, violet) et leurs lieux en vente ; dans une fiche, le vrai propriétaire ; le profil d'un vrai joueur ; les Maires et classements des communes (fonctions `classement_commune`, `maires`) | fait |
| 8.1e | Le marché : vente à prix libre, achat direct (au prix affiché), offres sans expiration (changer, annuler ; acceptées si l'acheteur a encore les pièces), notifications ; le jeu regarde le serveur chaque minute | fait |
| 8.1f | Les échanges | à faire |
| 8.1g | Les enchères (clôture, fonds bloqués) | à faire |
| 8.2 | Mode serveur par défaut ; fin des joueurs simulés ; premiers amis | à faire |
| 9 | Boutique (Stripe) : packs payants et Pass, crédités par le serveur | à faire |
