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

## Avant le lancement public (plus tard)

- **Les e-mails d'inscription** : le service d'e-mail fourni par Supabase n'écrit qu'aux membres de ton équipe Supabase, deux fois par heure au plus. Pour les vrais joueurs, il faudra brancher un service d'envoi (Brevo a une formule gratuite) avec une adresse d'expédition à toi.
- **Google** : créer un identifiant de connexion dans Google Cloud (gratuit), je te guiderai.
- **Apple** : la connexion Apple demande un compte développeur Apple payant ; à décider.
- **Les pauses** : un projet gratuit sans aucune activité pendant une semaine se met en pause ; **Restore project** le relance, sans perte de données. La formule Pro (25 $/mois) supprime les pauses, à prendre au lancement.
