# Le vrai serveur de Cadastra (phase 8)

## Le principe

- **Le jeu lit, le serveur écrit.** Le navigateur lit les tables Supabase (ses pièces, les lieux de tous pour la carte et les classements) ; il n'a le droit d'écrire **nulle part**. Chaque action (récolter, construire, ouvrir le pack, vendre, acheter, faire une offre, échanger, miser) est une demande à la fonction Edge **`jeu`**.
- **Les mêmes règles partout.** La fonction `jeu` applique les règles du jeu (`src/regles/*.js` et `data/*.json`), recopiées telles quelles par `tools/serveur_prepare.js` : un lieu a la même rareté, le même plafond, la même valeur et le même loyer dans le navigateur et sur le serveur (`tests/serveur.test.js`).
- **Des écritures atomiques.** La fonction calcule (coût, loyer, prix), puis appelle une fonction SQL `jeu_*` (`supabase/sql/`) qui vérifie et écrit d'un bloc (pièces suffisantes, lieu à soi, niveau suivant…). Ces fonctions SQL ne sont appelables que par le serveur (`service_role`).
- **Le même tirage.** Le pack du jour est tiré par `src/tirage.js`, le même code dans le jeu (mode démo) et sur le serveur ; le réseau (géocodeur IGN) et « ce lieu est-il libre ? » sont fournis par l'appelant. Sur le serveur, la graine est secrète (le joueur ne peut pas choisir ses lieux) et les lieux célèbres et contours de la France sont embarqués dans la fonction.
- **Le vrai temps.** Le serveur compte en jours de 24 h (le mode démo, sans compte, garde son jour d'une minute).

## Les tables (à ce jour)

| Table | Contenu | Le jeu peut |
|---|---|---|
| `profils` | pseudo (définitif), icône | lire tous ; créer le sien ; changer son icône |
| `signalements` | les signalements (traités par Gautier) | en envoyer |
| `joueurs` | pièces, dernière récolte, dernier pack | lire **le sien** |
| `lieux` | chaque lieu possédé : propriétaire, niveau, prix de vente, commune, parcelle | lire tous |

## Côté jeu : le mode serveur

- `MODE_SERVEUR` (Réglages → « Jouer sur le vrai serveur (essai) », gardé dans `localStorage['cadastra-mode']`) : la partie vit sur le serveur (`CLE_ETAT` = `cadastra-serveur-v1` pour ce qui reste sur l'appareil : réglages, notifications vues…), en vrais jours (`JOUR` = 24 h ; le pack se renouvelle à minuit, heure de Paris). Sans lui, la démo locale d'avant (un jour = une minute, joueurs simulés).
- `agir(action, corps)` appelle la fonction `jeu` et, si tout va bien, se recale sur la partie qu'elle renvoie (`appliquerEtat`) ; un refus s'affiche tel quel. `synchroniser()` au démarrage, avant la récolte.
- Ce qui n'est pas encore sur le serveur (vente, achat, offres, échanges, enchères) répond `bientot()` ; les minuteries de la démo (offres et enchères simulées) sont arrêtées.

## La mise à jour

`.github/workflows/serveur.yml`, à chaque fusion qui touche le serveur ou les règles : tests → SQL envoyé par l'API de gestion Supabase → fonction `jeu` déployée → essai complet (`tools/serveur_essai.js` : un joueur jetable se connecte, joue, essaie de tricher, puis est supprimé). Besoin : le secret GitHub `SUPABASE_ACCESS_TOKEN` (`GUIDE-SERVEUR.md`).

## Les étapes

| Étape | Contenu | État |
|---|---|---|
| 8.1a | Fondations : `joueurs`, `lieux`, fonction `jeu` (état, récolte, construction), mise à jour et essai automatiques | fait |
| 8.1b | Le jeu connecté joue sur le serveur : pièces, patrimoine, récolte, construction, pack (interrupteur « Jouer sur le vrai serveur (essai) » dans les Réglages) | fait |
| 8.1c | Le pack du jour tiré par le serveur (raretés, lieux libres, un par jour, heure de Paris) : action `pack`, tirage partagé `src/tirage.js` | fait |
| 8.1d | Le marché : vente, achat, offres | à faire |
| 8.1e | Les échanges | à faire |
| 8.1f | Les enchères (clôture, fonds bloqués) | à faire |
| 8.1g | Notifications ; carte et Maires avec les vrais joueurs | à faire |
| 8.2 | Fin des joueurs simulés en mode connecté ; premiers amis | à faire |
| 9 | Boutique (Stripe) : packs payants et Pass, crédités par le serveur | à faire |
