# Continuer Cadastra dans Claude Code

Procédure écrite le 3 novembre 2026, à la demande de Gautier : passer de la conversation dans l'app Claude à Claude Code, sans rien perdre.

## Pourquoi rien ne se perd

- **Le code, les données et les documents** sont sur GitHub (`josalystest1-sudo/projet-jeux-immo`, branche `main`). Tout ce qui a été fait est fusionné ; les vieilles branches ne servent plus.
- **La partie en cours sur le serveur** (comptes, lieux, offres, ventes, robots) vit chez Supabase, pas chez Claude. Elle ne bouge pas.
- **Les clés restent où elles sont** : le secret GitHub `SUPABASE_ACCESS_TOKEN` (posé par Gautier) et la clé Google dans `data/google.json`.
- **La mémoire du projet est écrite**. Le nouveau Claude ne voit pas l'ancienne conversation, mais il lit tout seul `CLAUDE.md` au démarrage. On lui demande aussi de lire `PROGRESS.md` (où on en est), `docs/HISTORIQUE.md` (le récit, toutes les PR, les décisions) et ce fichier.
- **Seuls des brouillons jetables sont perdus** dans l'ancien espace de travail : les réponses Wikidata déjà fusionnées (elles se retéléchargent) et des captures d'écran. L'outil d'essai de la promenade a été versé dans le dépôt (`tools/essai_promenade.js`).

**Règle : un seul Claude à la fois sur le jeu.** Une fois passé dans Claude Code, ne plus demander de travail sur Cadastra dans l'ancienne conversation : deux Claude qui modifient le même dépôt se marchent dessus. On peut encore la relire.

## Option A (conseillée) : Claude Code sur ton PC, piloté depuis ton téléphone

C'est le montage que tu utilises déjà pour l'Arena.

Il a deux autres avantages : ton PC a accès à tout Internet (le serveur Supabase, Google, l'IGN), alors que l'espace cloud bloque une partie de ces sites. Et Claude peut y essayer le jeu dans un vrai navigateur.

Une seule fois, sur le PC :

1. Ouvre l'application **Claude**, onglet **Code**.
2. Clique **+ New** (nouvelle session).
3. Sous la zone de message, règle deux choses :
   - le choix de l'environnement : prends **Local** ;
   - le choix du dossier : prends **Documents**, le dossier qui contient déjà `projet-arena`.
4. Envoie ce message :
   > Clone le dépôt GitHub josalystest1-sudo/projet-jeux-immo dans ce dossier (il doit devenir Documents/projet-jeux-immo). Utilise le même compte GitHub que pour l'Arena. Ne change rien d'autre.

   Accepte si Claude demande la permission de lancer une commande.
5. Quand il a fini, ouvre une nouvelle session (**+ New**), toujours en **Local**, avec le dossier du jeu (sur le PC de Gautier, le clone s'appelle **Documents/jeu immo**).
6. Allume **Remote Control** : l'interrupteur de la session, ou une fois pour toutes dans **Réglages > Claude Code** (« Connect new sessions to Remote Control »). La session apparaît alors sur ton téléphone, dans l'app Claude (partie Code) et sur claude.ai/code.

   Le PC doit rester allumé, l'app Claude ouverte.
7. Colle le premier message (plus bas).

Les fois suivantes : depuis ton téléphone, rouvre la session du jeu dans la partie Code de l'app Claude. Ou, sur le PC, **+ New** avec le dossier `Documents/jeu immo`, puis le premier message.

## Option B : sans le PC (en déplacement), une session dans le cloud

Pour l'Arena, tu avais choisi de ne pas utiliser le cloud : à toi de voir pour Cadastra.

1. Dans l'app Claude (téléphone) ou sur claude.ai/code, ouvre une nouvelle session de code dans le cloud, sur le dépôt `josalystest1-sudo/projet-jeux-immo`.
2. Colle le premier message.

Limites du cloud : il ne joint pas le serveur Supabase, et une partie des sites de données est bloquée (liste dans `CLAUDE.md` § 3 bis). Les essais du serveur passent alors seulement par la publication automatique, comme jusqu'ici.

## Le premier message à coller (options A et B)

```
Bonjour. Tu reprends Cadastra, mon jeu des adresses. Lis d'abord CLAUDE.md, PROGRESS.md, docs/HISTORIQUE.md et docs/REPRENDRE-DANS-CLAUDE-CODE.md.
Puis :
1. vérifie que tu as les outils (git, node, npm, python, l'outil GitHub gh) et lance les tests (npm test) ;
2. dis-moi en quelques lignes, en français simple, où en est le jeu et ce que tu proposes de faire ensuite ;
3. ne change rien avant ma réponse.
```

## Pour le nouveau Claude : la reprise, pas à pas

1. **Lire** `CLAUDE.md`, `PROGRESS.md`, `docs/HISTORIQUE.md`, `docs/GDD.md`, `docs/PLAN.md`, et `docs/serveur/ARCHITECTURE.md` pour le serveur.
2. **Outils sur le PC de Gautier** (Windows 11, le même que pour l'Arena ; voir le `CLAUDE.md` de l'Arena, § 3) :
   - Git (Git Bash pour l'outil Bash) ;
   - la GitHub CLI portable `C:/Users/Gautier/gh/gh.exe`, connectée au compte `josalystest1-sudo` (droits `repo` et `workflow`), qui sert aussi pour ce dépôt ;
   - Node et npm pour `npm test` (aucune dépendance à installer) ;
   - Python 3 pour `tools/*.py`.

   Installer ce qui manque, sans rien demander à Gautier en ligne de commande. Pour pousser sur GitHub depuis le PC : `gh auth setup-git` si Git demande une identification.
3. **Les captures** (`tools/visite_ecrans.js`, `tools/essai_promenade.js`) ont été écrites pour l'espace cloud : chemins `/tmp/ml`, proxy. Sur le PC, installer Playwright et adapter les chemins. La carte 3D demande WebGL.
4. **Le travail** ne change pas : une PR par étape, en français, fusionnée en squash quand `npm test` passe (pas de vérification automatique sur les PR : lancer les tests soi-même). Puis :
   - mettre à jour `PROGRESS.md` et `docs/HISTORIQUE.md` (une ligne par PR) ;
   - finir par un récapitulatif en français simple, avec l'adresse du jeu à tester sur le téléphone.
5. **Le serveur** : on ne touche jamais aux tables à la main. Tout passe par `supabase/sql/*.sql` et la fonction `jeu`, publiés par `.github/workflows/serveur.yml` à chaque fusion. L'essai automatique (`tools/serveur_essai.js`) dit si tout va bien : lire le journal de la publication dans GitHub Actions.

   Depuis le PC, on peut aussi joindre le serveur directement pour regarder, jamais pour écrire. La clé secrète `service_role` ne va jamais dans le dépôt ni dans la conversation.
6. **La suite du travail** est dans `docs/HISTORIQUE.md` (« Ce qui reste à faire ») et `docs/PLAN.md` : d'abord 8.1f (les échanges sur le serveur), 8.1g (les enchères), puis 8.2.
