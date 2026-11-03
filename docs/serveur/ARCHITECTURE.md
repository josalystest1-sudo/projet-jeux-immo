# Le vrai serveur de Cadastra (phase 8)

## Le principe

- **Le jeu lit, le serveur écrit.** Le navigateur lit les tables Supabase (ses pièces, les lieux de tous pour la carte et les classements) ; il n'a le droit d'écrire **nulle part**. Chaque action (récolter, construire, ouvrir le pack, vendre, acheter, faire une offre, échanger, miser) est une demande à la fonction Edge **`jeu`**.
- **Les mêmes règles partout.** La fonction `jeu` applique les règles du jeu (`src/regles/*.js` et `data/*.json`), recopiées telles quelles par `tools/serveur_prepare.js` : un lieu a la même rareté, le même plafond, la même valeur et le même loyer dans le navigateur et sur le serveur (`tests/serveur.test.js`).
- **Des écritures atomiques.** La fonction calcule (coût, loyer, prix), puis appelle une fonction SQL `jeu_*` (`supabase/sql/`) qui vérifie et écrit d'un bloc (pièces suffisantes, lieu à soi, niveau suivant…). Ces fonctions SQL ne sont appelables que par le serveur (`service_role`).
- **Le vrai temps.** Le serveur compte en jours de 24 h (le mode démo, sans compte, garde son jour d'une minute).

## Les tables (à ce jour)

| Table | Contenu | Le jeu peut |
|---|---|---|
| `profils` | pseudo (définitif), icône | lire tous ; créer le sien ; changer son icône |
| `signalements` | les signalements (traités par Gautier) | en envoyer |
| `joueurs` | pièces, dernière récolte, dernier pack | lire **le sien** |
| `lieux` | chaque lieu possédé : propriétaire, niveau, prix de vente, commune, parcelle | lire tous |

## La mise à jour

`.github/workflows/serveur.yml`, à chaque fusion qui touche le serveur ou les règles : tests → SQL envoyé par l'API de gestion Supabase → fonction `jeu` déployée → essai complet (`tools/serveur_essai.js` : un joueur jetable se connecte, joue, essaie de tricher, puis est supprimé). Besoin : le secret GitHub `SUPABASE_ACCESS_TOKEN` (`GUIDE-SERVEUR.md`).

## Les étapes

| Étape | Contenu | État |
|---|---|---|
| 8.1a | Fondations : `joueurs`, `lieux`, fonction `jeu` (état, récolte, construction), mise à jour et essai automatiques | fait |
| 8.1b | Le jeu connecté joue sur le serveur : pièces, patrimoine, récolte, construction | à faire |
| 8.1c | Le pack du jour tiré par le serveur (raretés, lieux libres, un par jour) | à faire |
| 8.1d | Le marché : vente, achat, offres | à faire |
| 8.1e | Les échanges | à faire |
| 8.1f | Les enchères (clôture, fonds bloqués) | à faire |
| 8.1g | Notifications ; carte et Maires avec les vrais joueurs | à faire |
| 8.2 | Fin des joueurs simulés en mode connecté ; premiers amis | à faire |
| 9 | Boutique (Stripe) : packs payants et Pass, crédités par le serveur | à faire |
