-- Cadastra : la valeur qui bouge (décision de Gautier, 3 nov. 2026) : l'historique des ventes, l'indice du marché
-- d'une commune et l'activité d'un quartier. Lecture seule pour le jeu ; les ventes sont écrites par jeu_transferer.

-- ---------------------------------------------------------------- les ventes (achats directs et offres acceptées)
create table if not exists public.ventes (
  id         bigint generated always as identity primary key,
  lieu       text not null,
  commune    text not null default '',
  prix       bigint not null,
  valeur_ref bigint not null,           -- la valeur du lieu (terrain + bâtiments) au moment de la vente
  vendeur    uuid,
  acheteur   uuid,
  le         timestamptz not null default now()
);
alter table public.ventes add column if not exists devise text not null default 'pieces';   -- une vente en gemmes ne compte pas dans le marché
create index if not exists ventes_commune on public.ventes (commune, le desc);
create index if not exists ventes_lieu on public.ventes (lieu, le desc);
alter table public.ventes enable row level security;
drop policy if exists "ventes lisibles par tous" on public.ventes;
create policy "ventes lisibles par tous" on public.ventes for select to anon, authenticated using (true);
revoke all on public.ventes from anon, authenticated;
grant select (id, lieu, commune, prix, valeur_ref, le) on public.ventes to anon, authenticated;
grant all on public.ventes to service_role;

-- le changement de propriétaire (voir 030_marche.sql), qui note maintenant la vente
drop function if exists public.jeu_transferer(text, uuid, uuid, bigint, bigint, bigint);
drop function if exists public.jeu_transferer(text, uuid, uuid, bigint, bigint, bigint, bigint);
-- devise : pièces ou gemmes (GDD § 9) ; les gemmes passent de l'acheteur au vendeur sans commission, et sont journalisées
create or replace function public.jeu_transferer(l text, vendeur uuid, acheteur uuid, prix bigint, prix_attendu bigint, offre bigint, valeur_ref bigint, devise text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v uuid; pv bigint; dv text; p bigint; com text;
begin
  if vendeur = acheteur then raise exception 'soi_meme'; end if;
  if prix is null or prix <= 0 or devise not in ('pieces', 'gemmes') then raise exception 'prix'; end if;
  select proprietaire, prix_vente, devise_vente, commune into v, pv, dv, com from public.lieux where id = l for update;
  if not found or v <> vendeur then raise exception 'plus_a_lui'; end if;
  if prix_attendu is not null and (pv is null or pv <> prix_attendu or dv <> devise) then raise exception 'prix_change'; end if;
  if devise = 'gemmes' then
    update public.joueurs set gemmes = gemmes - prix where id = acheteur and gemmes >= prix returning gemmes into p;
    if p is null then raise exception 'gemmes'; end if;
    update public.joueurs set gemmes = gemmes + prix where id = vendeur;
    insert into public.gemmes_journal (joueur, delta, motif) values (acheteur, -prix, 'achat_lieu'), (vendeur, prix, 'vente_lieu');
  else
    update public.joueurs set pieces = pieces - prix where id = acheteur and pieces >= prix returning pieces into p;
    if p is null then raise exception 'fonds'; end if;
    update public.joueurs set pieces = pieces + prix where id = vendeur;
  end if;
  update public.lieux set proprietaire = acheteur, prix_vente = null, depuis = now(), maj = now() where id = l;
  update public.offres set statut = case when id = offre then 'acceptee' else 'caduque' end, maj = now()
   where lieu = l and statut = 'attente';
  insert into public.ventes (lieu, commune, prix, valeur_ref, vendeur, acheteur, devise) values (l, coalesce(com, ''), prix, greatest(coalesce(valeur_ref, prix), 1), vendeur, acheteur, devise);
  return p;
end $$;
revoke all on function public.jeu_transferer(text, uuid, uuid, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.jeu_transferer(text, uuid, uuid, bigint, bigint, bigint, bigint, text) to service_role;

-- le marché de plusieurs communes depuis un instant : le prix moyen rapporté à la valeur, et le nombre de ventes
create or replace function public.marche_communes(communes text[], depuis timestamptz)
returns table (commune text, ratio double precision, n bigint)
language sql stable security definer set search_path = '' as $$
  select v.commune, avg(v.prix::double precision / v.valeur_ref), count(*)::bigint
    from public.ventes v where v.commune = any(communes) and v.le >= depuis and v.devise = 'pieces' group by v.commune;
$$;

-- l'activité autour de points : la somme de (1 + niveau) des lieux possédés dans un rectangle (sans le lieu lui-même)
-- pts : [{ id, lon, lat }] ; dlat, dlon : la demi-taille du rectangle en degrés
create or replace function public.quartiers(pts jsonb, dlat double precision, dlon double precision)
returns table (id text, points bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce((select sum(1 + l.niveau) from public.lieux l
                          where l.id <> p.id and l.lat between p.lat - dlat and p.lat + dlat and l.lon between p.lon - dlon and p.lon + dlon), 0)::bigint
    from jsonb_to_recordset(pts) as p(id text, lon double precision, lat double precision)
   limit 500;
$$;
revoke all on function public.marche_communes(text[], timestamptz) from public;
revoke all on function public.quartiers(jsonb, double precision, double precision) from public;
grant execute on function public.marche_communes(text[], timestamptz) to anon, authenticated, service_role;
grant execute on function public.quartiers(jsonb, double precision, double precision) to anon, authenticated, service_role;
