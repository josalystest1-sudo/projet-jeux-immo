-- Cadastra : les échanges entre joueurs (phase 8.1f ; demande de Gautier, 3 nov. 2026) : on propose un ou plusieurs
-- de ses lieux, plus des pièces si l'on veut, contre le lieu d'un autre joueur ; il accepte ou refuse ; tant qu'il n'a
-- pas répondu, on peut annuler. Envoyé au serveur par la publication ; peut être relancé sans danger.
-- Le jeu lit ses échanges, la fonction « jeu » écrit (fonctions jeu_* ci-dessous, réservées au serveur).

-- ---------------------------------------------------------------- les échanges (sans expiration)
create table if not exists public.echanges (
  id           bigint generated always as identity primary key,
  lieu         text not null references public.lieux (id) on delete cascade,     -- le lieu demandé
  proposeur    uuid not null references public.joueurs (id) on delete cascade,
  destinataire uuid not null references public.joueurs (id) on delete cascade,   -- le propriétaire du lieu demandé, quand l'échange est proposé
  donnes       text[] not null check (cardinality(donnes) between 1 and 30),      -- les lieux que le proposeur donne
  noms         jsonb not null default '{}'::jsonb,                                 -- leurs noms (id → nom) : l'affichage, même après
  ajout        bigint not null default 0 check (ajout >= 0),                      -- les pièces en plus, payées à l'acceptation
  statut       text not null default 'attente' check (statut in ('attente', 'acceptee', 'refusee', 'annulee', 'caduque')),
  cree_le      timestamptz not null default now(),
  maj          timestamptz not null default now()
);
-- un seul échange en attente par joueur et par lieu demandé (pour en proposer un autre : annuler d'abord)
create unique index if not exists echanges_un_en_attente on public.echanges (lieu, proposeur) where statut = 'attente';
create index if not exists echanges_proposeur on public.echanges (proposeur, statut);
create index if not exists echanges_destinataire on public.echanges (destinataire, statut);
create index if not exists echanges_donnes on public.echanges using gin (donnes) where statut = 'attente';
alter table public.echanges enable row level security;
drop policy if exists "mes échanges" on public.echanges;
create policy "mes échanges" on public.echanges for select to authenticated
  using (proposeur = (select auth.uid()) or destinataire = (select auth.uid()));
revoke all on public.echanges from anon, authenticated;
grant select on public.echanges to authenticated;
grant all on public.echanges to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- proposer : les lieux donnés sont à lui, aucun n'est déjà proposé dans un autre échange en attente, il a les pièces
-- (vérifiées encore à l'acceptation) ; rend le numéro de l'échange
create or replace function public.jeu_echanger(j uuid, l text, dons text[], supplement bigint, noms_dons jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare p bigint; d uuid; n integer; e bigint;
begin
  -- un joueur à la fois : deux propositions simultanées ne peuvent pas donner le même lieu
  select pieces into p from public.joueurs where id = j for update;
  if not found then raise exception 'pas_a_toi'; end if;
  select proprietaire into d from public.lieux where id = l;
  if not found then raise exception 'libre'; end if;
  if d = j then raise exception 'soi_meme'; end if;
  dons := array(select distinct x from unnest(dons) as x where x is not null and x <> '' order by x);
  n := coalesce(cardinality(dons), 0);
  if n < 1 then raise exception 'rien'; end if;
  if n > 30 then raise exception 'trop'; end if;
  if (select count(*) from public.lieux where id = any(dons) and proprietaire = j) <> n then raise exception 'pas_a_toi'; end if;
  if exists (select 1 from public.echanges x where x.proposeur = j and x.statut = 'attente' and x.lieu = l) then raise exception 'deja_echange'; end if;
  if exists (select 1 from public.echanges x where x.proposeur = j and x.statut = 'attente' and x.donnes && dons) then raise exception 'deja_propose'; end if;
  supplement := coalesce(supplement, 0);
  if supplement < 0 then raise exception 'prix'; end if;
  if p < supplement then raise exception 'fonds'; end if;
  insert into public.echanges (lieu, proposeur, destinataire, donnes, noms, ajout)
  values (l, j, d, dons, coalesce(noms_dons, '{}'::jsonb), supplement)
  returning id into e;
  return e;
end $$;

-- refuser (le destinataire), annuler (le proposeur), ou rendre caduc (l'un ou l'autre) un échange en attente
create or replace function public.jeu_echange_statut(e bigint, qui uuid, statut text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if statut not in ('refusee', 'annulee', 'caduque') then raise exception 'statut'; end if;
  update public.echanges x set statut = jeu_echange_statut.statut, maj = now()
   where x.id = e and x.statut = 'attente'
     and ((jeu_echange_statut.statut = 'annulee' and x.proposeur = qui)
       or (jeu_echange_statut.statut = 'refusee' and x.destinataire = qui)
       or (jeu_echange_statut.statut = 'caduque' and qui in (x.proposeur, x.destinataire)));
  if not found then raise exception 'echange'; end if;
end $$;

-- accepter (le destinataire) : d'un bloc, les lieux changent de main (chacun garde ses constructions, plus aucun
-- n'est en vente), les pièces passent ; les offres et les autres échanges sur ces lieux tombent.
-- Rend ce qui est tombé ([{ type: offre | echange, joueur, lieu }]) pour prévenir leurs auteurs.
-- Un échange n'est pas une vente : il ne compte pas dans le marché des communes (table ventes).
create or replace function public.jeu_echange_accepter(e bigint, qui uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.echanges%rowtype; tous text[]; p bigint; tombes jsonb;
begin
  select * into x from public.echanges where id = e for update;
  if not found or x.statut <> 'attente' or x.destinataire <> qui then raise exception 'echange'; end if;
  tous := x.donnes || x.lieu;
  -- les lieux verrouillés dans un ordre fixe (deux échanges simultanés ne s'attendent pas l'un l'autre)
  perform 1 from public.lieux where id = any(tous) order by id for update;
  if not exists (select 1 from public.lieux where id = x.lieu and proprietaire = qui) then raise exception 'plus_a_lui'; end if;
  if (select count(*) from public.lieux where id = any(x.donnes) and proprietaire = x.proposeur) <> cardinality(x.donnes) then raise exception 'echange_change'; end if;
  if x.ajout > 0 then
    update public.joueurs set pieces = pieces - x.ajout where id = x.proposeur and pieces >= x.ajout returning pieces into p;
    if p is null then raise exception 'fonds'; end if;
    update public.joueurs set pieces = pieces + x.ajout where id = qui;
  end if;
  update public.lieux set proprietaire = x.proposeur, prix_vente = null, depuis = now(), maj = now() where id = x.lieu;
  update public.lieux set proprietaire = qui, prix_vente = null, depuis = now(), maj = now() where id = any(x.donnes);
  update public.echanges set statut = 'acceptee', maj = now() where id = e;
  with o as (
    update public.offres f set statut = 'caduque', maj = now() where f.lieu = any(tous) and f.statut = 'attente'
    returning 'offre'::text as type, f.acheteur as joueur, f.lieu
  ), c as (
    update public.echanges y set statut = 'caduque', maj = now()
     where y.id <> e and y.statut = 'attente' and (y.lieu = any(tous) or y.donnes && tous)
    returning 'echange'::text as type, y.proposeur as joueur, y.lieu
  )
  select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'joueur', t.joueur, 'lieu', t.lieu)), '[]'::jsonb) into tombes
    from (select * from o union all select * from c) as t;
  return tombes;
end $$;

revoke all on function public.jeu_echanger(uuid, text, text[], bigint, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_echange_statut(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.jeu_echange_accepter(bigint, uuid) from public, anon, authenticated;
grant execute on function public.jeu_echanger(uuid, text, text[], bigint, jsonb) to service_role;
grant execute on function public.jeu_echange_statut(bigint, uuid, text) to service_role;
grant execute on function public.jeu_echange_accepter(bigint, uuid) to service_role;
