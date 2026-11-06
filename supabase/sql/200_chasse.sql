-- StreetKeep : la chasse au trésor (idée de Gautier du 6 nov. 2026, GDD § 5 quinquies). Une chasse par heure : une commune,
-- une adresse cachée (« cible », jamais lue par le jeu), un départ commun (la mairie). Les chasseurs marchent dans les rues ;
-- la fonction « jeu » reçoit leur position toutes les 2 secondes, refuse les sauts (règles : src/regles/chasse.js) et
-- donne la victoire au premier arrivé, une seule fois (jeu_chasse_gagner).
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit et lit.

create table if not exists public.chasses (
  id          text primary key,                 -- « c<numéro> » ; une chasse d'essai : « essai-… », visible de son seul joueur
  numero      bigint not null,
  commune     text not null,
  code_insee  text not null,
  depart_lon  double precision not null,
  depart_lat  double precision not null,
  cible       jsonb not null,                   -- { id, lon, lat, numero, rue, label } : le trésor, secret jusqu'à la fin
  annonce     timestamptz not null,
  debut       timestamptz not null,
  fin         timestamptz not null,
  pour        uuid references auth.users (id) on delete cascade,   -- une chasse d'essai : son seul joueur
  gagnant     uuid references auth.users (id) on delete set null,
  trouve_le   timestamptz,
  cree_le     timestamptz not null default now()
);
create index if not exists chasses_debut on public.chasses (debut desc);
alter table public.chasses enable row level security;
revoke all on public.chasses from anon, authenticated;
grant all on public.chasses to service_role;

-- les chasseurs : leur dernière position acceptée
create table if not exists public.chasseurs (
  chasse     text not null references public.chasses (id) on delete cascade,
  joueur     uuid not null references auth.users (id) on delete cascade,
  lon        double precision not null,
  lat        double precision not null,
  le         timestamptz not null default now(),
  rejoint_le timestamptz not null default now(),
  primary key (chasse, joueur)
);
alter table public.chasseurs enable row level security;
revoke all on public.chasseurs from anon, authenticated;
grant all on public.chasseurs to service_role;

-- une chasse (préparée par la fonction : commune, départ, trésor) ; rien si elle existe déjà
create or replace function public.jeu_chasse_creer(c jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chasses (id, numero, commune, code_insee, depart_lon, depart_lat, cible, annonce, debut, fin, pour)
  select x.id, x.numero, x.commune, x.code_insee, x.depart_lon, x.depart_lat, x.cible, x.annonce, x.debut, x.fin, x.pour
    from jsonb_to_record(c) as x(id text, numero bigint, commune text, code_insee text, depart_lon double precision, depart_lat double precision,
                                 cible jsonb, annonce timestamptz, debut timestamptz, fin timestamptz, pour uuid)
  on conflict (id) do nothing;
  return found;
end $$;

-- rejoindre : on part du départ (rejoindre à nouveau ne ramène pas au départ)
create or replace function public.jeu_chasse_rejoindre(c text, j uuid, lon double precision, lat double precision) returns void
language sql security definer set search_path = '' as $$
  insert into public.chasseurs (chasse, joueur, lon, lat) values (c, j, lon, lat) on conflict (chasse, joueur) do nothing;
$$;

-- une position acceptée (« avant » : la précédente, contre deux envois simultanés) ; vrai si c'est fait
create or replace function public.jeu_chasse_position(c text, j uuid, lon double precision, lat double precision, avant timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.chasseurs set lon = jeu_chasse_position.lon, lat = jeu_chasse_position.lat, le = now()
   where chasse = c and joueur = j and le = avant;
  return found;
end $$;

-- la victoire : la première arrivée pendant la chasse, une seule fois ; les pièces et la carte gagnées (le lieu peut déjà
-- être à quelqu'un d'autre : alors seulement les pièces) ; rend les lieux gagnés, ou null si quelqu'un a été plus rapide
create or replace function public.jeu_chasse_gagner(c text, j uuid, gain bigint, cartes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare gagnes jsonb;
begin
  update public.chasses set gagnant = j, trouve_le = now()
   where id = c and gagnant is null and now() >= debut and now() < fin
     and exists (select 1 from public.chasseurs x where x.chasse = c and x.joueur = j);
  if not found then return null; end if;
  update public.joueurs set pieces = pieces + greatest(gain, 0) where id = j;
  with ins as (
    insert into public.lieux (id, proprietaire, type, label, lon, lat, citycode, city, commune, idu, notoriete, cat, qid, rarete)
    select x.id, j, x.type, x.label, x.lon, x.lat, coalesce(x.citycode, ''), coalesce(x.city, ''), coalesce(x.commune, ''), x.idu, x.notoriete, x.cat, x.qid, x.rarete
      from jsonb_to_recordset(cartes) as x(id text, type text, label text, lon double precision, lat double precision,
                                          citycode text, city text, commune text, idu text, notoriete text, cat text, qid text, rarete smallint)
     where x.id is not null and x.type in ('adresse', 'lieu')
    on conflict (id) do nothing
    returning id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb) into gagnes from ins;
  return gagnes;
end $$;

-- les chasses finies depuis 7 jours s'effacent, avec les positions de leurs chasseurs (page de confidentialité)
create or replace function public.jeu_chasses_purger() returns integer
language sql security definer set search_path = '' as $$
  with x as (delete from public.chasses where fin < now() - interval '7 days' returning 1) select count(*)::int from x;
$$;

revoke all on function public.jeu_chasses_purger() from public, anon, authenticated;
grant execute on function public.jeu_chasses_purger() to service_role;
revoke all on function public.jeu_chasse_creer(jsonb) from public, anon, authenticated;
revoke all on function public.jeu_chasse_rejoindre(text, uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function public.jeu_chasse_position(text, uuid, double precision, double precision, timestamptz) from public, anon, authenticated;
revoke all on function public.jeu_chasse_gagner(text, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_chasse_creer(jsonb) to service_role;
grant execute on function public.jeu_chasse_rejoindre(text, uuid, double precision, double precision) to service_role;
grant execute on function public.jeu_chasse_position(text, uuid, double precision, double precision, timestamptz) to service_role;
grant execute on function public.jeu_chasse_gagner(text, uuid, bigint, jsonb) to service_role;
