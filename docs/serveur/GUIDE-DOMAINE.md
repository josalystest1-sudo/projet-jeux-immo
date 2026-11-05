# Brancher citydeck.fr sur le jeu

Gautier a acheté **citydeck.fr** chez **Infomaniak** le 5 nov. 2026. Le jeu est publié par GitHub Pages ; il reste joignable à son ancienne adresse (`https://josalystest1-sudo.github.io/projet-jeux-immo/`), qui renverra vers citydeck.fr une fois le domaine branché.

## 1. Chez Infomaniak : dire où est le jeu (à faire par Gautier)

1. Va sur **manager.infomaniak.com** et connecte-toi.
2. Ouvre **Domaines**, puis touche **citydeck.fr**.
3. Dans le menu, touche **Zone DNS**.
4. S'il y a déjà des lignes de type **A** ou **AAAA** pour `citydeck.fr` (sans rien devant) ou pour `www`, supprime-les : ce sont celles de la page d'attente d'Infomaniak.
5. Touche **Ajouter une entrée**, choisis **A**. Laisse le nom (la « source ») vide, et mets dans « Cible » (ou « Adresse IPv4 ») : `185.199.108.153`. Valide.
6. Recommence trois fois, avec : `185.199.109.153`, puis `185.199.110.153`, puis `185.199.111.153`.
7. Touche **Ajouter une entrée**, choisis **CNAME**. Nom (source) : `www`. Cible : `josalystest1-sudo.github.io`. Valide.

Le changement met de quelques minutes à quelques heures à se propager.

## 2. Chez Google : autoriser la nouvelle adresse pour Street View (à faire par Gautier)

La clé Google du jeu (`data/google.json`) n'accepte que l'ancienne adresse. Sans cela, la photo de la rue ne s'afficherait pas sur citydeck.fr.

1. Va sur **console.cloud.google.com**, projet **« Le Laboratoire »**.
2. Menu ☰ → **API et services** → **Identifiants**.
3. Touche la clé **« Cadastra »**.
4. Dans **Restrictions relatives aux applications** → **Sites web**, touche **Ajouter** et mets `https://citydeck.fr/*`. Recommence avec `https://www.citydeck.fr/*`. Garde l'ancienne adresse.
5. Touche **Enregistrer**.

## 3. Ce que Claude fait

- **Fait (PR #141)** :
  - le serveur accepte citydeck.fr (`ORIGINES` dans la fonction « jeu », y compris pour le retour d'un paiement) ;
  - les liens des e-mails de connexion peuvent ramener sur citydeck.fr : `tools/serveur_adresses.js`, lancé à chaque publication du serveur.
- **Quand la zone DNS répond** : Claude vérifie que `citydeck.fr` mène bien à GitHub. Ensuite :
  - il déclare le domaine dans GitHub Pages (fichier `CNAME`) et force le HTTPS ;
  - il fait de citydeck.fr l'adresse principale (connexion, retour des paiements) ;
  - il vérifie le jeu à sa nouvelle adresse.
- Ne jamais déclarer le domaine dans GitHub Pages **avant** que la zone DNS soit prête : GitHub enverrait alors l'ancienne adresse vers une adresse qui ne répond pas encore, et le jeu serait injoignable.
