-- Cadastra : les tables du serveur Supabase (étape 2.1 : comptes, profils, signalements).
-- À coller dans SQL Editor → New query → Run. Peut être relancé sans danger (if not exists / or replace).
-- Les tables ne sont pas exposées automatiquement : chaque droit est donné ici, et la sécurité par ligne (RLS)
-- garantit qu'un joueur ne modifie que ce qui est à lui.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- les profils publics
create table if not exists public.profils (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 3 and 16),
  pseudo_cle  text not null,                     -- le pseudo sans majuscules ni accents (unicité)
  avatar      text not null default '🦊' check (char_length(avatar) <= 8),
  cree_le     timestamptz not null default now(),
  banni       boolean not null default false     -- Gautier le passe à vrai à la main
);
create unique index if not exists profils_pseudo_cle on public.profils (pseudo_cle);

-- la clé du pseudo est calculée par le serveur, jamais fournie par le jeu ; un joueur ne se débannit pas
create or replace function public.profils_avant_ecriture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- le pseudo est définitif : un joueur ne peut pas le changer (Gautier le peut, depuis le tableau de bord)
  if tg_op = 'UPDATE' and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.pseudo := old.pseudo;
  end if;
  new.pseudo := btrim(regexp_replace(new.pseudo, '\s+', ' ', 'g'));
  new.pseudo_cle := lower(extensions.unaccent('extensions.unaccent'::regdictionary, new.pseudo));
  if tg_op = 'INSERT' then
    new.banni := false;
    new.cree_le := now();
  else
    new.banni := old.banni;
    new.cree_le := old.cree_le;
    new.id := old.id;
  end if;
  return new;
end $$;
drop trigger if exists profils_avant_ecriture on public.profils;
create trigger profils_avant_ecriture before insert or update on public.profils
  for each row execute function public.profils_avant_ecriture();

alter table public.profils enable row level security;
drop policy if exists "profils lisibles par tous" on public.profils;
create policy "profils lisibles par tous" on public.profils for select to anon, authenticated using (true);
drop policy if exists "mon profil : création" on public.profils;
create policy "mon profil : création" on public.profils for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "mon profil : modification" on public.profils;
create policy "mon profil : modification" on public.profils for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select (id, pseudo, avatar, cree_le) on public.profils to anon, authenticated;
-- le pseudo se choisit à la création seulement ; ensuite, seule l'icône change
revoke update on public.profils from authenticated;
grant insert (id, pseudo, avatar), update (avatar) on public.profils to authenticated;

-- un pseudo est-il libre ? (sans tenir compte des majuscules ni des accents)
create or replace function public.pseudo_libre(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profils where pseudo_cle = lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(p))));
$$;
grant execute on function public.pseudo_libre(text) to anon, authenticated;

-- ---------------------------------------------------------------- les signalements
-- Envoyés par un joueur connecté ; lus seulement par Gautier dans le tableau de bord (Table Editor → signalements).
create table if not exists public.signalements (
  id        bigint generated always as identity primary key,
  auteur    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cible     uuid not null references public.profils (id) on delete cascade,
  raison    text not null check (raison in ('pseudo', 'triche', 'comportement', 'autre')),
  texte     text not null default '' check (char_length(texte) <= 200),
  envoye_le timestamptz not null default now(),
  traite    boolean not null default false
);
alter table public.signalements enable row level security;
drop policy if exists "signaler un joueur" on public.signalements;
create policy "signaler un joueur" on public.signalements for insert to authenticated
  with check (auteur = (select auth.uid()) and cible <> (select auth.uid()));
grant insert (cible, raison, texte) on public.signalements to authenticated;

-- un même joueur signalé au plus une fois par jour par le même auteur
create unique index if not exists signalements_un_par_jour
  on public.signalements (auteur, cible, ((envoye_le at time zone 'UTC')::date));
