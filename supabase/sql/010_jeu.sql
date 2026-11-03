-- Cadastra : la partie de chaque joueur (phase 8 : le vrai serveur).
-- Envoyé au serveur par la publication (.github/workflows/serveur.yml) ; peut être relancé sans danger.
--
-- Principe : le jeu (navigateur) LIT ces tables, il n'y ÉCRIT jamais. Toute écriture passe par la fonction
-- « jeu » (supabase/functions/jeu), qui applique les règles du jeu (src/regles) puis appelle les fonctions
-- jeu_* ci-dessous, chacune atomique et réservée au serveur (service_role).

-- ---------------------------------------------------------------- les joueurs : pièces, récolte, pack du jour
create table if not exists public.joueurs (
  id           uuid primary key references auth.users (id) on delete cascade,
  pieces       bigint not null default 1500 check (pieces >= 0),
  encaisse     timestamptz not null default now(),   -- dernière récolte (salaire + loyers, 24 h de stock au plus)
  dernier_pack date,                                  -- jour (heure de Paris) du dernier pack gratuit ouvert
  cree_le      timestamptz not null default now()
);
alter table public.joueurs enable row level security;
drop policy if exists "mes pièces" on public.joueurs;
create policy "mes pièces" on public.joueurs for select to authenticated using (id = (select auth.uid()));
revoke all on public.joueurs from anon, authenticated;
grant select on public.joueurs to authenticated;
grant all on public.joueurs to service_role;   -- la fonction « jeu » (les tables créées par l'API de gestion n'ont pas ce droit d'office)

-- ---------------------------------------------------------------- les lieux possédés (un lieu = un seul propriétaire)
create table if not exists public.lieux (
  id           text primary key,                      -- identifiant stable : BAN, « poi… », « wd:Q… », « mon:Q… »
  proprietaire uuid not null references public.joueurs (id) on delete cascade,
  type         text not null check (type in ('adresse', 'lieu', 'monument')),
  label        text not null,
  lon          double precision not null,
  lat          double precision not null,
  citycode     text not null default '',
  city         text not null default '',
  commune      text not null default '',             -- la commune du jeu (« Paris 9e », « Bagneux ») : classements des Maires
  idu          text,                                  -- la parcelle cadastrale, pour colorer la carte
  notoriete    text,                                  -- vide : déduite du type (règles)
  cat          text,
  qid          text,                                  -- Wikidata
  niveau       smallint not null default 0 check (niveau >= 0),
  prix_vente   bigint check (prix_vente is null or prix_vente > 0),   -- vide : pas en vente
  depuis       timestamptz not null default now(),
  maj          timestamptz not null default now()
);
create index if not exists lieux_proprietaire on public.lieux (proprietaire);
create index if not exists lieux_commune on public.lieux (commune);
create index if not exists lieux_idu on public.lieux (idu);
alter table public.lieux enable row level security;
drop policy if exists "lieux lisibles par tous" on public.lieux;
create policy "lieux lisibles par tous" on public.lieux for select to anon, authenticated using (true);
revoke all on public.lieux from anon, authenticated;
grant select on public.lieux to anon, authenticated;
grant all on public.lieux to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- un nouveau joueur : ses pièces de départ (data/economie.json → solde_depart, donné par la fonction « jeu »)
create or replace function public.jeu_nouveau_joueur(j uuid, depart bigint) returns void
language sql security definer set search_path = '' as $$
  insert into public.joueurs (id, pieces) values (j, depart) on conflict (id) do nothing;
$$;

-- la récolte : le montant est calculé par les règles ; « avant » protège d'une double récolte simultanée
create or replace function public.jeu_recolter(j uuid, montant bigint, avant timestamptz, maintenant timestamptz) returns bigint
language plpgsql security definer set search_path = '' as $$
declare p bigint;
begin
  update public.joueurs set pieces = pieces + greatest(montant, 0), encaisse = maintenant
   where id = j and encaisse = avant
  returning pieces into p;
  return p;   -- vide : une autre récolte est passée entre-temps
end $$;

-- construire le niveau n sur un de ses lieux : le coût est calculé par les règles ; on ne saute pas de niveau
create or replace function public.jeu_construire(j uuid, l text, n smallint, cout bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare nv smallint; p bigint;
begin
  select niveau into nv from public.lieux where id = l and proprietaire = j for update;
  if not found then raise exception 'pas_a_toi'; end if;
  if nv <> n - 1 then raise exception 'niveau'; end if;
  update public.joueurs set pieces = pieces - cout where id = j and pieces >= cout returning pieces into p;
  if p is null then raise exception 'fonds'; end if;
  update public.lieux set niveau = n, maj = now() where id = l;
  return p;
end $$;

-- ces fonctions ne sont jamais appelables depuis le jeu : seulement par la fonction « jeu » (service_role)
revoke all on function public.jeu_nouveau_joueur(uuid, bigint) from public, anon, authenticated;
revoke all on function public.jeu_recolter(uuid, bigint, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.jeu_construire(uuid, text, smallint, bigint) from public, anon, authenticated;
grant execute on function public.jeu_nouveau_joueur(uuid, bigint) to service_role;
grant execute on function public.jeu_recolter(uuid, bigint, timestamptz, timestamptz) to service_role;
grant execute on function public.jeu_construire(uuid, text, smallint, bigint) to service_role;
