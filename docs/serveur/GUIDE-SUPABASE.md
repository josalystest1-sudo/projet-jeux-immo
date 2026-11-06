# Créer le serveur de Cadastra (Supabase, gratuit) — pas à pas pour Gautier

Tant que `data/serveur.json` n'a pas d'adresse, le jeu tourne avec un **serveur simulé** sur l'appareil. Le vrai serveur est un projet Supabase : gratuit (palier « Free », sans carte bancaire), dix minutes, créé par toi depuis ton compte. À la fin, tu me donnes deux textes et je branche le jeu.

**Fait le 2 nov. 2026** (par Claude dans ton Chrome, à ta demande) : projet `cadastra` dans l'organisation Josalys, région Paris, gratuit ; tables exposées seulement sur autorisation, sécurité par ligne activée d'office ; tables créées (`supabase.sql`, « Success ») ; Site URL = l'adresse du jeu ; adresse et clé publique dans `data/serveur.json`. Le mot de passe de la base a été généré par Supabase et n'a été copié nulle part : si un jour il en faut un, **Project Settings → Database → Reset database password**.

Ton organisation gratuite a droit à **deux projets actifs** : « Agent de synthèse d'actualités » et « cadastra ». Pour le serveur d'Arena, il faudra mettre l'un des deux en pause ou passer à la formule Pro.

## Étape 1 — le compte et le projet

1. Ouvre **https://supabase.com** et touche **Start your project**.
2. Choisis **Continue with GitHub** (ton compte josalystest1-sudo) et accepte.
3. Touche **New project** :
   - **Name** : `cadastra`
   - **Database password** : touche **Generate a password**, puis garde-le dans tes notes (le jeu n'en a pas besoin, ne me l'envoie pas).
   - **Region** : **West EU (Paris)**
   - **Plan** : **Free**
   - Touche **Create new project**, puis attends une à deux minutes.
4. Menu de gauche : **Authentication** → **URL Configuration**. Dans **Site URL**, mets `https://josalystest1-sudo.github.io/projet-jeux-immo/` puis **Save**. (C'est là que renverront les liens des e-mails de confirmation.)
5. Menu de gauche, en bas : **Project Settings** (la roue dentée) → **API Keys** (ou **Data API**). Envoie-moi :
   - **Project URL** : `https://xxxxxxxx.supabase.co`
   - la clé **publishable** (ou **anon public**) : un long texte qui commence par `sb_publishable_…` ou `eyJ…`

   Cette clé est faite pour être dans le jeu. **Ne m'envoie jamais** la clé **secret** / **service_role**, ni le mot de passe de la base.

## Étape 2 — les tables

Fait une première fois à la main (SQL Editor). Depuis le 3 nov. 2026, les tables sont dans `supabase/sql/` et la publication les envoie toute seule au serveur (voir `GUIDE-SERVEUR.md`).

## Lire le suivi, les signalements et les alertes (depuis le téléphone aussi)

Sur https://supabase.com/dashboard, ouvre le projet **cadastra**, puis **Table Editor** (l'icône en forme de tableau, à gauche ; sur téléphone, dans le menu ☰). Dans la liste :

- **suivi_total** : une ligne qui résume tout. On y trouve le nombre d'inscrits (en tout, et sur les 7 derniers jours) et les joueurs venus (aujourd'hui, et sur les 7 derniers jours). On y trouve aussi le pourcentage d'inscrits revenus le lendemain (`pct_retour_j1`) et le 7e jour (`pct_retour_j7`), ainsi que les payants, les euros encaissés et le nombre de robots en jeu ;
- **suivi_jours** : un jour par ligne, du plus récent au plus ancien. Pour chaque jour : les inscrits du jour, les joueurs venus, les inscrits revenus le lendemain et le 7e jour (vide tant que ce jour n'est pas arrivé), les achats, les euros, et les achats en carte de test ;
- **comptes_lies** : les comptes qui ont partagé une même connexion ces 7 derniers jours (une famille, un réseau partagé… ou quelqu'un qui crée des comptes pour en nourrir un), avec les ventes et les échanges entre eux ;
- **signalements** : les joueurs signalés par les autres (bouton « Signaler » d'un profil) ; coche `traite` une fois réglé ;
- **alertes** : un monument redevenu libre (une phrase prête à poster), ou 3 comptes et plus sur une même connexion (type `comptes`).

Les robots ne sont jamais comptés dans le suivi. Les jours sont de vrais jours (minuit à Paris), même sur le serveur d'essai accéléré.

## Avant le lancement public (plus tard)

- **Les e-mails d'inscription** (confirmation, mot de passe oublié) : le service d'e-mail fourni par Supabase n'écrit qu'aux membres de ton équipe Supabase, deux fois par heure au plus. Depuis le 6 nov., ils passent par **Brevo** : le domaine citydeck.fr y est authentifié (un code et deux clés DKIM dans la zone DNS d'Infomaniak ; la règle DMARC existante, « p=reject », est gardée) et l'expéditeur est **CityDeck <noreply@citydeck.fr>**. La publication du serveur pose le réglage (`tools/serveur_emails.js` : serveur d'envoi de Brevo, modèles d'e-mails en français avec l'anglais dessous) dès que le secret GitHub **BREVO_SMTP_KEY** existe. Pour le poser : Brevo → Paramètres → **SMTP et API** → **Générer une clé SMTP** (nom : CityDeck) → copier la clé ; GitHub → le dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, nom `BREVO_SMTP_KEY`, coller la clé. La clé ne s'affiche qu'une fois chez Brevo ; elle ne doit jamais être écrite ailleurs. Vérifier les envois : Brevo → **Transactionnel** → **Logs**.
- **Google** : créer un identifiant de connexion dans Google Cloud (gratuit), je te guiderai.
- **Apple** : la connexion Apple demande un compte développeur Apple payant ; à décider.
- **Les pauses** : un projet gratuit sans aucune activité pendant une semaine se met en pause (depuis le 5 nov., l'horloge du jeu l'appelle toutes les 10 minutes : cela ne devrait plus arriver) ; **Restore project** le relance, sans perte de données. La formule Pro (25 $/mois) supprime les pauses, à prendre au lancement.
