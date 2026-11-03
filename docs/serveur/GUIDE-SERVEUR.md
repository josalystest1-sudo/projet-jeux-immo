# Guide — brancher la mise à jour automatique du serveur (une fois)

But : à chaque étape fusionnée, GitHub met le serveur à jour tout seul (tables, fonction « jeu ») puis le teste avec un joueur jetable. Pour cela, GitHub a besoin d'un **jeton d'accès Supabase**. C'est une clé secrète : elle va directement de Supabase à GitHub, **jamais dans le chat**, et Claude ne la voit jamais.

## Les étapes (3 minutes, téléphone ou ordinateur)

1. Sur **supabase.com**, connecte-toi, puis ouvre **supabase.com/dashboard/account/tokens**.
2. **Generate new token** → nom : `github-cadastra` → durée : la plus longue proposée → **Generate token** → **copie** le jeton (il ne s'affiche qu'une fois).
3. Sur **github.com**, ouvre le dépôt **projet-jeux-immo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
4. **Name** : `SUPABASE_ACCESS_TOKEN` · **Secret** : colle le jeton → **Add secret**.

Puis dis « c'est fait » à Claude : il relance la mise à jour du serveur et vérifie que l'essai passe.

## Si un jour le jeton expire ou fuit

- Sur la page des jetons Supabase, **Revoke** le jeton concerné, puis refais les étapes 2 à 4 (même nom de secret : GitHub remplace l'ancien).
- Tant que le secret manque, le jeu continue de marcher ; seules les mises à jour du serveur attendent (un avertissement apparaît dans GitHub, onglet Actions).
