-- Les retours des joueurs (28 nov. 2026, la bêta) : « Signaler un bug » dans les Réglages. Un message libre (1 000 caractères
-- au plus), la version du jeu et l'écran où il a été écrit. Envoyés par un joueur connecté ; lus seulement par Gautier dans le
-- tableau de bord (Table Editor → retours). Effacés avec le compte.
create table if not exists public.retours (
  id        bigint generated always as identity primary key,
  auteur    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texte     text not null check (char_length(texte) between 5 and 1000),
  version   text not null default '' check (char_length(version) <= 10),
  ecran     text not null default '' check (char_length(ecran) <= 30),
  envoye_le timestamptz not null default now(),
  traite    boolean not null default false
);
alter table public.retours enable row level security;
drop policy if exists "envoyer un retour" on public.retours;
create policy "envoyer un retour" on public.retours for insert to authenticated
  with check (auteur = (select auth.uid()));
revoke all on public.retours from anon, authenticated;
grant insert (texte, version, ecran) on public.retours to authenticated;
create index if not exists retours_auteur on public.retours (auteur);
