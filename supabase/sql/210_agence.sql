-- L'agence : le jeu « idle » (16 nov. 2026, GDD § 5 sexies ; règles : src/regles/agence.js). Les pièces embauchent des
-- employés, qui produisent du renom ; à un certain renom, tout repart de zéro contre une brique. Le serveur calcule
-- (fonction « jeu »), cette table garde l'état ; le jeu ne lit que le classement des briques d'une saison.

create table if not exists public.agences (
  joueur       uuid primary key references auth.users (id) on delete cascade,
  saison       integer not null default 0,
  agents       integer not null default 0,
  negociateurs integer not null default 0,
  directeurs   integer not null default 0,
  renom        double precision not null default 0,
  le           timestamptz not null default now(),   -- jusqu'où le renom est compté
  briques      integer not null default 0,           -- de la saison
  total        integer not null default 0,           -- de toutes les saisons
  brique_le    timestamptz                           -- la dernière brique posée (à égalité, le premier arrivé passe devant)
);
alter table public.agences enable row level security;
revoke all on public.agences from anon, authenticated;
grant all on public.agences to service_role;

-- écrire l'agence d'un joueur et lui prendre le prix de ses embauches, d'un bloc. « avant » : l'instant de l'agence
-- quand la fonction l'a lue (vide si elle n'existait pas) ; si elle a changé depuis (deux touchers à la fois), refus.
-- Rend les pièces du joueur.
create or replace function public.jeu_agence(j uuid, cout bigint, avant timestamptz, s integer, ag integer, ng integer, dr integer, rn double precision, quand timestamptz, b integer, t integer) returns bigint
language plpgsql security definer set search_path = '' as $$
declare p bigint; vu timestamptz; vb integer; vs integer; existe boolean;
begin
  select a.le, a.briques, a.saison, true into vu, vb, vs, existe from public.agences a where a.joueur = j for update;
  if coalesce(existe, false) and vu is distinct from avant then raise exception 'agence_change'; end if;
  if not coalesce(existe, false) and avant is not null then raise exception 'agence_change'; end if;
  if cout < 0 or ag < 0 or ng < 0 or dr < 0 or b < 0 or t < 0 or rn < 0 then raise exception 'agence_change'; end if;
  if cout > 0 then
    update public.joueurs set pieces = pieces - cout where id = j and pieces - public.jeu_bloque(j, '') >= cout returning pieces into p;
    if p is null then raise exception 'fonds'; end if;
  else
    select pieces into p from public.joueurs where id = j;
  end if;
  insert into public.agences (joueur, saison, agents, negociateurs, directeurs, renom, le, briques, total, brique_le)
  values (j, s, ag, ng, dr, rn, quand, b, t, case when b > 0 then quand end)
  on conflict (joueur) do update set saison = s, agents = ag, negociateurs = ng, directeurs = dr, renom = rn, le = quand, briques = b, total = t,
    brique_le = case when s is distinct from vs then (case when b > 0 then quand end) when b > coalesce(vb, 0) then quand else public.agences.brique_le end;
  return p;
end $$;

-- le classement des briques d'une saison (à égalité, celui qui a posé sa dernière brique le plus tôt), et la place d'un joueur
create or replace function public.classement_agences(s integer, lim integer)
returns table (joueur uuid, pseudo text, avatar text, n integer)
language sql stable security definer set search_path = '' as $$
  select a.joueur, p.pseudo, p.avatar, a.briques
    from public.agences a left join public.profils p on p.id = a.joueur
   where a.saison = s and a.briques > 0
   order by a.briques desc, a.brique_le asc nulls last, a.joueur
   limit lim;
$$;
create or replace function public.rang_agence(s integer, j uuid)
returns table (rang bigint, n integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.agences x where x.saison = s and (x.briques > a.briques or (x.briques = a.briques and x.brique_le < a.brique_le))) + 1, a.briques
    from public.agences a where a.joueur = j and a.saison = s and a.briques > 0;
$$;

revoke all on function public.jeu_agence(uuid, bigint, timestamptz, integer, integer, integer, integer, double precision, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.jeu_agence(uuid, bigint, timestamptz, integer, integer, integer, integer, double precision, timestamptz, integer, integer) to service_role;
revoke all on function public.classement_agences(integer, integer) from public;
revoke all on function public.rang_agence(integer, uuid) from public;
grant execute on function public.classement_agences(integer, integer) to anon, authenticated, service_role;
grant execute on function public.rang_agence(integer, uuid) to anon, authenticated, service_role;
