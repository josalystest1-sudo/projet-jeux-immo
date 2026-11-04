-- Cadastra : les classements et les saisons (GDD § 5 bis, 4 nov. 2026). Le patrimoine d'un joueur : ses lieux pondérés
-- par rareté, plus le bâtiment construit sur chacun (les poids viennent de data/economie.json → classements, donnés par
-- l'appelant). Le classement des Maires d'une saison : chaque mairie gagnée vaut le nombre de ses rivaux (les élections
-- de chaque mandat sont gardées dans « mairies » par la fonction « jeu », avec les règles du jeu). Une saison dure
-- 6 mandats ; à sa fin, la fonction « jeu » fige les classements (« saisons », « saisons_joueurs »).
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Tout le monde lit ; seule la fonction « jeu » écrit.

-- la rareté d'un lieu (1 à 6, src/regles/lieu.js), posée par la fonction « jeu » (vide : pas encore calculée)
alter table public.lieux add column if not exists rarete smallint check (rarete between 1 and 6);

-- ---------------------------------------------------------------- les Maires de chaque mandat (et ce que vaut leur mairie)
create table if not exists public.mairies (
  mandat   bigint not null,
  commune  text not null,
  maire    uuid not null references public.joueurs (id) on delete cascade,
  rivaux   integer not null default 0 check (rivaux >= 0),   -- les autres joueurs qui ont versé au moins le seuil
  primary key (mandat, commune, maire)
);
create index if not exists mairies_maire on public.mairies (maire, mandat);
alter table public.mairies enable row level security;
drop policy if exists "mairies lisibles par tous" on public.mairies;
create policy "mairies lisibles par tous" on public.mairies for select to anon, authenticated using (true);
revoke all on public.mairies from anon, authenticated;
grant select on public.mairies to anon, authenticated;
grant all on public.mairies to service_role;

-- ---------------------------------------------------------------- les saisons finies : podiums et plaques
create table if not exists public.saisons (
  saison      bigint primary key,                    -- numéro interne (mandat / 6)
  numero      integer not null,                      -- « Saison 1 », à partir de la première jouée
  fin         timestamptz not null default now(),
  maires      jsonb not null default '[]'::jsonb,    -- les 10 premiers : [{ joueur, pseudo, n, rang }]
  patrimoine  jsonb not null default '[]'::jsonb,
  plaques     jsonb not null default '{}'::jsonb     -- commune → { joueur, pseudo } : le Maire de la saison
);
alter table public.saisons enable row level security;
drop policy if exists "saisons lisibles par tous" on public.saisons;
create policy "saisons lisibles par tous" on public.saisons for select to anon, authenticated using (true);
revoke all on public.saisons from anon, authenticated;
grant select on public.saisons to anon, authenticated;
grant all on public.saisons to service_role;

create table if not exists public.saisons_joueurs (
  saison             bigint not null,
  joueur             uuid not null references public.joueurs (id) on delete cascade,
  rang_maires        integer, points_maires integer,
  rang_patrimoine    integer, points_patrimoine integer,
  primary key (saison, joueur)
);
alter table public.saisons_joueurs enable row level security;
drop policy if exists "résultats lisibles par tous" on public.saisons_joueurs;
create policy "résultats lisibles par tous" on public.saisons_joueurs for select to anon, authenticated using (true);
revoke all on public.saisons_joueurs from anon, authenticated;
grant select on public.saisons_joueurs to anon, authenticated;
grant all on public.saisons_joueurs to service_role;

-- ---------------------------------------------------------------- lire (le jeu et la fonction « jeu »)
-- le classement de patrimoine (national si c est vide, sinon d'une commune) ; poids[rareté] (1 à 6) et bonus[niveau + 1]
create or replace function public.classement_patrimoine(poids integer[], bonus integer[], c text, lim integer)
returns table (joueur uuid, pseudo text, avatar text, n bigint)
language sql stable security definer set search_path = '' as $$
  select l.proprietaire, p.pseudo, p.avatar, sum(coalesce(poids[l.rarete], 1) + coalesce(bonus[l.niveau + 1], 0))::bigint as n
    from public.lieux l left join public.profils p on p.id = l.proprietaire
   where c is null or l.commune = c
   group by l.proprietaire, p.pseudo, p.avatar
   order by n desc, l.proprietaire
   limit lim;
$$;
-- la place d'un joueur au classement de patrimoine (à égalité, le même rang)
create or replace function public.rang_patrimoine(poids integer[], bonus integer[], c text, j uuid)
returns table (rang bigint, n bigint)
language sql stable security definer set search_path = '' as $$
  with t as (select l.proprietaire, sum(coalesce(poids[l.rarete], 1) + coalesce(bonus[l.niveau + 1], 0))::bigint as n
               from public.lieux l where c is null or l.commune = c group by l.proprietaire)
  select (select count(*) from t t2 where t2.n > t.n) + 1, t.n from t where t.proprietaire = j;
$$;
-- le classement des Maires des mandats m0 à m1 (une saison) : la somme des rivaux de leurs mairies, et leur nombre
create or replace function public.classement_maires(m0 bigint, m1 bigint, lim integer)
returns table (joueur uuid, pseudo text, avatar text, n bigint, mairies bigint)
language sql stable security definer set search_path = '' as $$
  select x.maire, p.pseudo, p.avatar, sum(x.rivaux)::bigint as n, count(*)::bigint
    from public.mairies x left join public.profils p on p.id = x.maire
   where x.mandat between m0 and m1
   group by x.maire, p.pseudo, p.avatar
  having sum(x.rivaux) > 0
   order by n desc, x.maire
   limit lim;
$$;
create or replace function public.rang_maires(m0 bigint, m1 bigint, j uuid)
returns table (rang bigint, n bigint)
language sql stable security definer set search_path = '' as $$
  with t as (select x.maire, sum(x.rivaux)::bigint as n from public.mairies x where x.mandat between m0 and m1 group by x.maire having sum(x.rivaux) > 0)
  select (select count(*) from t t2 where t2.n > t.n) + 1, t.n from t where t.maire = j;
$$;
revoke all on function public.classement_patrimoine(integer[], integer[], text, integer) from public;
revoke all on function public.rang_patrimoine(integer[], integer[], text, uuid) from public;
revoke all on function public.classement_maires(bigint, bigint, integer) from public;
revoke all on function public.rang_maires(bigint, bigint, uuid) from public;
grant execute on function public.classement_patrimoine(integer[], integer[], text, integer) to anon, authenticated, service_role;
grant execute on function public.rang_patrimoine(integer[], integer[], text, uuid) to anon, authenticated, service_role;
grant execute on function public.classement_maires(bigint, bigint, integer) to anon, authenticated, service_role;
grant execute on function public.rang_maires(bigint, bigint, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- poser la rareté de lieux (calculée par les règles du jeu)
create or replace function public.jeu_raretes(ids text[], rs smallint[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.lieux l set rarete = x.r from unnest(ids, rs) as x(id, r) where l.id = x.id and l.rarete is distinct from x.r;
  get diagnostics n = row_count;
  return n;
end $$;

-- garder les Maires d'un mandat : [{ commune, maire, rivaux }]
create or replace function public.jeu_mairies(m bigint, lignes jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.mairies (mandat, commune, maire, rivaux)
  select m, x.commune, x.maire, greatest(coalesce(x.rivaux, 0), 0) from jsonb_to_recordset(lignes) as x(commune text, maire uuid, rivaux integer)
   where x.commune is not null and x.maire is not null
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- la première saison jouée (« Saison 1 ») : posée une fois, rendue ensuite
create or replace function public.jeu_origine_saisons(s bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reglages (cle, valeur) values ('saison_origine', to_jsonb(s)) on conflict (cle) do nothing;
  return (select (valeur #>> '{}')::bigint from public.reglages where cle = 'saison_origine');
end $$;

-- la fin d'une saison n'est tenue qu'une fois : vrai la première fois
create or replace function public.jeu_saison_tenir(s bigint, num integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.saisons (saison, numero) values (s, num) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- figer une saison : ses podiums, ses plaques, la place de chaque joueur [{ joueur, rm, pm, rp, pp }]
create or replace function public.jeu_saison_figer(s bigint, maires jsonb, patrimoine jsonb, plaques jsonb, joueurs jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.saisons set maires = coalesce(jeu_saison_figer.maires, '[]'::jsonb), patrimoine = coalesce(jeu_saison_figer.patrimoine, '[]'::jsonb),
         plaques = coalesce(jeu_saison_figer.plaques, '{}'::jsonb), fin = now() where saison = s;
  insert into public.saisons_joueurs (saison, joueur, rang_maires, points_maires, rang_patrimoine, points_patrimoine)
  select s, x.joueur, x.rm, x.pm, x.rp, x.pp from jsonb_to_recordset(joueurs) as x(joueur uuid, rm integer, pm integer, rp integer, pp integer)
   where x.joueur is not null
  on conflict do nothing;
end $$;

revoke all on function public.jeu_raretes(text[], smallint[]) from public, anon, authenticated;
revoke all on function public.jeu_mairies(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_origine_saisons(bigint) from public, anon, authenticated;
revoke all on function public.jeu_saison_tenir(bigint, integer) from public, anon, authenticated;
revoke all on function public.jeu_saison_figer(bigint, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_raretes(text[], smallint[]) to service_role;
grant execute on function public.jeu_mairies(bigint, jsonb) to service_role;
grant execute on function public.jeu_origine_saisons(bigint) to service_role;
grant execute on function public.jeu_saison_tenir(bigint, integer) to service_role;
grant execute on function public.jeu_saison_figer(bigint, jsonb, jsonb, jsonb, jsonb) to service_role;
