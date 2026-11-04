-- Cadastra : le Maire par caisse de travaux (GDD § 5, décisions de Gautier du 4 nov. 2026 ; le Maire change toutes les
-- 2 semaines). Chaque commune a une caisse par mandat (2 semaines du jeu : jour du jeu / 14, src/regles/mairie.js) ;
-- ses propriétaires y versent des pièces. Le plus gros contributeur d'un mandat est Maire au mandat suivant (au moins le
-- seuil ; égalité : co-Maires ; un Maire absent depuis trop longtemps cède la place au suivant) : l'élection est faite
-- par les règles du jeu (src/regles/mairie.js), dans le jeu et dans la fonction « jeu », à partir des lignes lues ici.
-- Le Maire touche une part des loyers des autres joueurs de la commune, plafonnée par mandat.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Tout le monde lit ; seule la fonction « jeu » écrit.

-- la dernière visite d'un joueur (un Maire absent depuis trop longtemps perd le titre)
alter table public.joueurs add column if not exists vu_le timestamptz not null default now();

-- ---------------------------------------------------------------- les versements, par mandat, commune et joueur
create table if not exists public.caisses (
  mandat   bigint not null,                                   -- numéro du mandat (jour du jeu / 14)
  commune  text not null,                                     -- la commune du jeu (« Paris 9e », « Bagneux »)
  joueur   uuid not null references public.joueurs (id) on delete cascade,
  points   bigint not null default 0 check (points >= 0),     -- ce qui compte pour l'élection (la dernière heure à moitié)
  verse    bigint not null default 0 check (verse >= 0),      -- les pièces versées
  maj      timestamptz not null default now(),
  primary key (mandat, commune, joueur)
);
create index if not exists caisses_commune on public.caisses (commune, mandat);
create index if not exists caisses_joueur on public.caisses (joueur, mandat);
alter table public.caisses enable row level security;
drop policy if exists "caisses lisibles par tous" on public.caisses;
create policy "caisses lisibles par tous" on public.caisses for select to anon, authenticated using (true);
revoke all on public.caisses from anon, authenticated;
grant select on public.caisses to anon, authenticated;
grant all on public.caisses to service_role;

-- ---------------------------------------------------------------- ce que chaque Maire a touché pendant son mandat
create table if not exists public.parts_maire (
  mandat   bigint not null,
  commune  text not null,
  maire    uuid not null references public.joueurs (id) on delete cascade,
  touche   bigint not null default 0 check (touche >= 0),
  primary key (mandat, commune, maire)
);
alter table public.parts_maire enable row level security;
drop policy if exists "parts lisibles par tous" on public.parts_maire;
create policy "parts lisibles par tous" on public.parts_maire for select to anon, authenticated using (true);
revoke all on public.parts_maire from anon, authenticated;
grant select on public.parts_maire to anon, authenticated;
grant all on public.parts_maire to service_role;

-- ---------------------------------------------------------------- les fins de mandat déjà annoncées (une seule fois chacune)
create table if not exists public.mandats_tenus (
  mandat   bigint primary key,
  le       timestamptz not null default now()
);
alter table public.mandats_tenus enable row level security;
revoke all on public.mandats_tenus from anon, authenticated;
grant all on public.mandats_tenus to service_role;

-- ---------------------------------------------------------------- lire (le jeu et la fonction « jeu »)
-- les caisses de plusieurs communes, pour le mandat m (en cours) et le précédent (qui élit les Maires de m) ;
-- absent : le joueur n'est pas venu depuis absent_avant (il ne peut pas être Maire)
create or replace function public.caisse_communes(communes text[], m bigint, absent_avant timestamptz)
returns table (commune text, mandat bigint, joueur uuid, pseudo text, avatar text, points bigint, absent boolean)
language sql stable security definer set search_path = '' as $$
  select c.commune, c.mandat, c.joueur, p.pseudo, p.avatar, c.points, j.vu_le < absent_avant
    from public.caisses c
    join public.joueurs j on j.id = c.joueur
    left join public.profils p on p.id = c.joueur
   where c.commune = any(communes) and c.mandat in (m - 1, m)
   order by c.points desc, c.maj asc;
$$;
revoke all on function public.caisse_communes(text[], bigint, timestamptz) from public;
grant execute on function public.caisse_communes(text[], bigint, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- je suis passé : la dernière visite (au plus une écriture toutes les 30 s)
create or replace function public.jeu_vu(j uuid) returns void
language sql security definer set search_path = '' as $$
  update public.joueurs set vu_le = now() where id = j and vu_le < now() - interval '30 seconds';
$$;

-- verser à la caisse d'une commune : il faut y posséder un lieu ; pts (calculés par les règles) comptent pour l'élection
create or replace function public.jeu_verser(j uuid, m bigint, c text, montant bigint, pts bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare p bigint;
begin
  if montant <= 0 or pts < 0 then raise exception 'prix'; end if;
  if not exists (select 1 from public.lieux where proprietaire = j and commune = c) then raise exception 'sans_lieu'; end if;
  update public.joueurs set pieces = pieces - montant where id = j and pieces >= montant returning pieces into p;
  if p is null then raise exception 'fonds'; end if;
  insert into public.caisses (mandat, commune, joueur, points, verse) values (m, c, j, pts, montant)
  on conflict (mandat, commune, joueur) do update
    set points = public.caisses.points + excluded.points, verse = public.caisses.verse + excluded.verse, maj = now();
  return p;
end $$;

-- la part d'un Maire : ajoutée à ses pièces, sans dépasser le plafond du mandat ; rend ce qui a été versé
create or replace function public.jeu_part_maire(m bigint, c text, mr uuid, montant bigint, plafond bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare deja bigint; v bigint;
begin
  insert into public.parts_maire (mandat, commune, maire) values (m, c, mr) on conflict do nothing;
  select touche into deja from public.parts_maire where mandat = m and commune = c and maire = mr for update;
  v := least(greatest(montant, 0), greatest(plafond - deja, 0));
  if v > 0 then
    update public.parts_maire set touche = touche + v where mandat = m and commune = c and maire = mr;
    update public.joueurs set pieces = pieces + v where id = mr;
  end if;
  return v;
end $$;

-- la fin d'un mandat n'est annoncée qu'une fois : vrai la première fois que l'on tient le mandat m
create or replace function public.jeu_mandat_tenir(m bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.mandats_tenus (mandat) values (m) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.jeu_vu(uuid) from public, anon, authenticated;
revoke all on function public.jeu_verser(uuid, bigint, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.jeu_part_maire(bigint, text, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.jeu_mandat_tenir(bigint) from public, anon, authenticated;
grant execute on function public.jeu_vu(uuid) to service_role;
grant execute on function public.jeu_verser(uuid, bigint, text, bigint, bigint) to service_role;
grant execute on function public.jeu_part_maire(bigint, text, uuid, bigint, bigint) to service_role;
grant execute on function public.jeu_mandat_tenir(bigint) to service_role;
