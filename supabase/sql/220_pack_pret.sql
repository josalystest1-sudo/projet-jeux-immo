-- Le pack préparé d'avance (18 nov. 2026, Gautier : « quand je veux ouvrir un pack, ça met "le pack arrive" et je dois
-- attendre une dizaine de secondes »). Le tirage d'un pack interroge la base des adresses pour chaque carte : c'est long.
-- Le serveur tire donc les cartes du prochain pack à l'avance (juste après le pack précédent, ou quand le jeu l'annonce
-- prêt) et les garde ici ; à l'ouverture, elles sont déjà là. Un lieu pris entre-temps est remplacé à l'ouverture.
-- Le jeu ne lit jamais cette table : un joueur ne voit pas ses cartes avant d'ouvrir son pack.
create table if not exists public.packs_prets (
  joueur  uuid primary key references auth.users (id) on delete cascade,
  cartes  jsonb not null default '[]'::jsonb,
  cree_le timestamptz not null default now()
);
alter table public.packs_prets enable row level security;
revoke all on public.packs_prets from anon, authenticated;
grant all on public.packs_prets to service_role;
