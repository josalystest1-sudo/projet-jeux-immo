-- Cadastra : les enchères de monuments sur le serveur (phase 8.1g). Chaque semaine du jeu, trois monuments
-- (1 national + 2 régionaux, src/regles/encheres.js) ; une mise doit être couverte par les pièces moins ce qui est
-- bloqué par ses mises qui mènent ailleurs ; à la clôture, le monument va à la meilleure mise dont le joueur a
-- encore les pièces, sinon à la suivante. Envoyé au serveur par la publication ; peut être relancé sans danger.
-- Tout le monde lit les lots et les mises ; seule la fonction « jeu » écrit (fonctions jeu_* ci-dessous).

-- ---------------------------------------------------------------- les lots (un monument mis aux enchères pour une semaine)
create table if not exists public.encheres (
  cle       text primary key,                      -- « semaine:rang » (comme src/regles/encheres.js)
  semaine   bigint not null,                       -- numéro de la semaine du jeu (jour du jeu / 7)
  rang      smallint not null default 0,
  palier    text not null check (palier in ('national', 'regional')),
  monument  text not null,                         -- l'identifiant de data/monuments.json
  lieu      jsonb not null,                        -- le lieu donné au gagnant : { id, label, lon, lat, citycode, city, commune, qid }
  depart    bigint not null check (depart > 0),    -- la mise de départ
  fin       timestamptz not null,                  -- la fin de la semaine du jeu
  statut    text not null default 'ouverte' check (statut in ('ouverte', 'close')),
  gagnant   uuid references public.joueurs (id) on delete set null,
  prix      bigint,
  cree_le   timestamptz not null default now()
);
create index if not exists encheres_semaine on public.encheres (semaine);
create index if not exists encheres_ouvertes on public.encheres (fin) where statut = 'ouverte';
-- un monument n'est que dans un lot ouvert à la fois
create unique index if not exists encheres_monument_ouvert on public.encheres (monument) where statut = 'ouverte';
alter table public.encheres enable row level security;
drop policy if exists "enchères lisibles par tous" on public.encheres;
create policy "enchères lisibles par tous" on public.encheres for select to anon, authenticated using (true);
revoke all on public.encheres from anon, authenticated;
grant select on public.encheres to anon, authenticated;
grant all on public.encheres to service_role;

-- ---------------------------------------------------------------- les mises
create table if not exists public.mises (
  id       bigint generated always as identity primary key,   -- à montant égal, la plus ancienne (le plus petit numéro) l'emporte
  lot      text not null references public.encheres (cle) on delete cascade,
  joueur   uuid not null references public.joueurs (id) on delete cascade,
  montant  bigint not null check (montant > 0),
  cree_le  timestamptz not null default now()
);
create index if not exists mises_lot on public.mises (lot, montant desc, id);
create index if not exists mises_joueur on public.mises (joueur);
alter table public.mises enable row level security;
drop policy if exists "mises lisibles par tous" on public.mises;
create policy "mises lisibles par tous" on public.mises for select to anon, authenticated using (true);
revoke all on public.mises from anon, authenticated;
grant select on public.mises to anon, authenticated;
grant all on public.mises to service_role;

-- ---------------------------------------------------------------- les écritures et les comptes (serveur seulement)
-- ouvrir les lots d'une semaine (calculés par la fonction « jeu ») ; un lot déjà là ou un monument déjà en jeu est ignoré
create or replace function public.jeu_encheres_ouvrir(lots jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.encheres (cle, semaine, rang, palier, monument, lieu, depart, fin)
  select x.cle, x.semaine, x.rang, x.palier, x.monument, x.lieu, x.depart, x.fin
    from jsonb_to_recordset(lots) as x(cle text, semaine bigint, rang smallint, palier text, monument text, lieu jsonb, depart bigint, fin timestamptz)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- mes mises qui mènent sur les lots ouverts ({ cle: montant }) et les lots ouverts où l'on m'a dépassé
create or replace function public.jeu_menees(j uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with t as (
    select e.cle, (select m.joueur from public.mises m where m.lot = e.cle order by m.montant desc, m.id asc limit 1) as meneur,
           (select max(m.montant) from public.mises m where m.lot = e.cle) as haut,
           exists (select 1 from public.mises m where m.lot = e.cle and m.joueur = j) as a_mise
      from public.encheres e where e.statut = 'ouverte'
  )
  select jsonb_build_object(
    'menees', coalesce((select jsonb_object_agg(t.cle, t.haut) from t where t.meneur = j), '{}'::jsonb),
    'depasse', coalesce((select jsonb_agg(t.cle) from t where t.a_mise and t.meneur <> j), '[]'::jsonb));
$$;

-- les pièces bloquées de j : ses mises qui mènent sur les lots ouverts, sauf le lot « sauf »
create or replace function public.jeu_bloque(j uuid, sauf text) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(t.montant), 0)::bigint
    from public.encheres e
    cross join lateral (select m.joueur, m.montant from public.mises m where m.lot = e.cle order by m.montant desc, m.id asc limit 1) as t
   where e.statut = 'ouverte' and e.cle is distinct from sauf and t.joueur = j;
$$;

-- miser : le lot est ouvert, la mise atteint la mise minimale (le départ, puis +pas sur la meilleure), et elle est
-- couverte par les pièces moins ce qui est bloqué ailleurs. Rend le meneur d'avant ({ joueur, montant }), pour le prévenir.
create or replace function public.jeu_miser(j uuid, c text, montant bigint, pas double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p bigint; l public.encheres%rowtype; tj uuid; tm bigint; mini bigint;
begin
  select pieces into p from public.joueurs where id = j for update;      -- un joueur à la fois
  if not found then raise exception 'fonds'; end if;
  select * into l from public.encheres where cle = c for update;          -- un lot à la fois
  if not found then raise exception 'lot'; end if;
  if l.statut <> 'ouverte' or l.fin <= now() then raise exception 'close'; end if;
  select m.joueur, m.montant into tj, tm from public.mises m where m.lot = c order by m.montant desc, m.id asc limit 1;
  mini := case when tm is null then l.depart else ceil(tm * (1 + pas))::bigint end;
  if montant is null or montant < mini then raise exception 'min'; end if;
  if montant > p - public.jeu_bloque(j, c) then raise exception 'fonds'; end if;
  insert into public.mises (lot, joueur, montant) values (c, j, montant);
  return jsonb_build_object('joueur', tj, 'montant', tm);
end $$;

-- clore un lot dont la semaine est finie : chaque joueur compte pour sa meilleure mise ; dans l'ordre, le premier
-- qui a encore les pièces paie et reçoit le monument. Rend { gagnant, prix } (gagnant vide : personne), ou rien si le
-- lot n'est pas à clore (pas fini, ou déjà clos par un autre appel).
create or replace function public.jeu_enchere_cloturer(c text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.encheres%rowtype; b record; p bigint; mid text;
begin
  select * into l from public.encheres where cle = c for update;
  if not found or l.statut <> 'ouverte' or l.fin > now() then return null; end if;
  mid := l.lieu ->> 'id';
  if mid is null or exists (select 1 from public.lieux where id = mid) then
    update public.encheres set statut = 'close' where cle = c;
    return jsonb_build_object('gagnant', null, 'prix', null);
  end if;
  for b in
    select x.joueur, x.montant from (
      select distinct on (m.joueur) m.joueur, m.montant, m.id from public.mises m where m.lot = c order by m.joueur, m.montant desc, m.id asc
    ) as x order by x.montant desc, x.id asc
  loop
    update public.joueurs set pieces = pieces - b.montant where id = b.joueur and pieces >= b.montant returning pieces into p;
    if p is not null then
      insert into public.lieux (id, proprietaire, type, label, lon, lat, citycode, city, commune, qid)
      values (mid, b.joueur, 'monument', coalesce(l.lieu ->> 'label', l.monument), (l.lieu ->> 'lon')::double precision, (l.lieu ->> 'lat')::double precision,
              coalesce(l.lieu ->> 'citycode', ''), coalesce(l.lieu ->> 'city', ''), coalesce(l.lieu ->> 'commune', ''), l.lieu ->> 'qid');
      update public.encheres set statut = 'close', gagnant = b.joueur, prix = b.montant where cle = c;
      return jsonb_build_object('gagnant', b.joueur, 'prix', b.montant);
    end if;
  end loop;
  update public.encheres set statut = 'close' where cle = c;
  return jsonb_build_object('gagnant', null, 'prix', null);
end $$;

revoke all on function public.jeu_encheres_ouvrir(jsonb) from public, anon, authenticated;
revoke all on function public.jeu_menees(uuid) from public, anon, authenticated;
revoke all on function public.jeu_bloque(uuid, text) from public, anon, authenticated;
revoke all on function public.jeu_miser(uuid, text, bigint, double precision) from public, anon, authenticated;
revoke all on function public.jeu_enchere_cloturer(text) from public, anon, authenticated;
grant execute on function public.jeu_encheres_ouvrir(jsonb) to service_role;
grant execute on function public.jeu_menees(uuid) to service_role;
grant execute on function public.jeu_bloque(uuid, text) to service_role;
grant execute on function public.jeu_miser(uuid, text, bigint, double precision) to service_role;
grant execute on function public.jeu_enchere_cloturer(text) to service_role;
