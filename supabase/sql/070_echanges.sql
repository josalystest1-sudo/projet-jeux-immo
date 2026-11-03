-- Cadastra : les échanges entre joueurs (phase 8.1f). Un joueur propose un ou plusieurs de ses lieux (et des pièces
-- s'il veut) contre le lieu d'un autre ; l'autre accepte ou refuse ; l'auteur peut annuler tant que rien n'est réglé.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Le jeu lit, la fonction « jeu » écrit.

create table if not exists public.echanges (
  id           bigint generated always as identity primary key,
  lieu         text not null references public.lieux (id) on delete cascade,   -- le lieu demandé
  demandeur    uuid not null references public.joueurs (id) on delete cascade,
  proprietaire uuid not null references public.joueurs (id) on delete cascade, -- le propriétaire quand l'échange est proposé
  donne        text[] not null,                                                 -- les lieux du demandeur
  ajout        bigint not null default 0 check (ajout >= 0),                    -- les pièces en plus
  statut       text not null default 'attente' check (statut in ('attente', 'acceptee', 'refusee', 'annulee', 'caduque')),
  cree_le      timestamptz not null default now(),
  maj          timestamptz not null default now()
);
-- une seule proposition en attente par demandeur et par lieu demandé
create unique index if not exists echanges_un_en_attente on public.echanges (lieu, demandeur) where statut = 'attente';
create index if not exists echanges_proprietaire on public.echanges (proprietaire, statut);
create index if not exists echanges_demandeur on public.echanges (demandeur, statut);
alter table public.echanges enable row level security;
drop policy if exists "mes echanges" on public.echanges;
create policy "mes echanges" on public.echanges for select to authenticated
  using (demandeur = (select auth.uid()) or proprietaire = (select auth.uid()));
revoke all on public.echanges from anon, authenticated;
grant select on public.echanges to authenticated;
grant all on public.echanges to service_role;

-- proposer : d lieux à moi (1 à 10, sans doublon) + plus pièces, contre le lieu l d'un autre joueur
create or replace function public.jeu_proposer_echange(j uuid, l text, d text[], plus bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v uuid; n int; p bigint; e bigint;
begin
  if d is null or cardinality(d) = 0 or cardinality(d) > 10 then raise exception 'echange_lieux'; end if;
  if (select count(distinct x) from unnest(d) as x) <> cardinality(d) then raise exception 'echange_lieux'; end if;
  if plus is null or plus < 0 then raise exception 'prix'; end if;
  select proprietaire into v from public.lieux where id = l;
  if not found then raise exception 'libre'; end if;
  if v = j then raise exception 'soi_meme'; end if;
  select count(*) into n from public.lieux where id = any(d) and proprietaire = j;
  if n <> cardinality(d) then raise exception 'echange_lieux'; end if;
  select pieces into p from public.joueurs where id = j;
  if p is null or p < plus then raise exception 'fonds'; end if;
  -- pas deux propositions pour le même lieu, ni un même lieu promis dans deux échanges
  if exists (select 1 from public.echanges x where x.demandeur = j and x.statut = 'attente' and (x.lieu = l or x.donne && d)) then
    raise exception 'echange_deja';
  end if;
  insert into public.echanges (lieu, demandeur, proprietaire, donne, ajout) values (l, j, v, d, plus) returning id into e;
  return e;
end $$;

-- refuser (le propriétaire), annuler (le demandeur), ou rendre caduque (le propriétaire) une proposition en attente
create or replace function public.jeu_echange_statut(e bigint, qui uuid, etat text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if etat not in ('refusee', 'annulee', 'caduque') then raise exception 'statut'; end if;
  update public.echanges x set statut = etat, maj = now()
   where x.id = e and x.statut = 'attente'
     and ((etat = 'annulee' and x.demandeur = qui) or (etat <> 'annulee' and x.proprietaire = qui));
  if not found then raise exception 'echange'; end if;
end $$;

-- accepter (le propriétaire) : d'un bloc, les lieux changent de main (avec leurs constructions, retirés de la vente),
-- les pièces passent, et ce qui touchait ces lieux tombe (autres échanges, offres) ; on rend ce qui est tombé
create or replace function public.jeu_echanger(e bigint, qui uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.echanges%rowtype; n int; p bigint; tous text[]; c jsonb; o jsonb;
begin
  select * into x from public.echanges where id = e for update;
  if not found or x.statut <> 'attente' or x.proprietaire <> qui then raise exception 'echange'; end if;
  tous := x.donne || x.lieu;
  perform 1 from public.lieux where id = any(tous) for update;
  if not exists (select 1 from public.lieux where id = x.lieu and proprietaire = qui) then raise exception 'plus_a_lui'; end if;
  select count(*) into n from public.lieux where id = any(x.donne) and proprietaire = x.demandeur;
  if n <> cardinality(x.donne) then raise exception 'echange_lieux'; end if;
  if x.ajout > 0 then
    update public.joueurs set pieces = pieces - x.ajout where id = x.demandeur and pieces >= x.ajout returning pieces into p;
    if p is null then raise exception 'fonds'; end if;
    update public.joueurs set pieces = pieces + x.ajout where id = qui;
  end if;
  update public.lieux set proprietaire = qui, prix_vente = null, depuis = now(), maj = now() where id = any(x.donne);
  update public.lieux set proprietaire = x.demandeur, prix_vente = null, depuis = now(), maj = now() where id = x.lieu;
  update public.echanges set statut = 'acceptee', maj = now() where id = e;
  with t as (
    update public.echanges y set statut = 'caduque', maj = now()
     where y.statut = 'attente' and y.id <> e and (y.lieu = any(tous) or y.donne && tous)
    returning y.id, y.demandeur, y.proprietaire, y.lieu)
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into c from t;
  with t as (
    update public.offres f set statut = 'caduque', maj = now()
     where f.statut = 'attente' and f.lieu = any(tous)
    returning f.id, f.acheteur, f.lieu)
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into o from t;
  return jsonb_build_object('echanges', c, 'offres', o);
end $$;

revoke all on function public.jeu_proposer_echange(uuid, text, text[], bigint) from public, anon, authenticated;
revoke all on function public.jeu_echange_statut(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.jeu_echanger(bigint, uuid) from public, anon, authenticated;
grant execute on function public.jeu_proposer_echange(uuid, text, text[], bigint) to service_role;
grant execute on function public.jeu_echange_statut(bigint, uuid, text) to service_role;
grant execute on function public.jeu_echanger(bigint, uuid) to service_role;
