-- Cadastra : le marché entre joueurs (phase 8.1e) : vente à prix libre, achat direct, offres, notifications.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Le jeu lit, la fonction « jeu » écrit.

-- ---------------------------------------------------------------- les offres (sans expiration, modifiables, annulables)
create table if not exists public.offres (
  id        bigint generated always as identity primary key,
  lieu      text not null references public.lieux (id) on delete cascade,
  acheteur  uuid not null references public.joueurs (id) on delete cascade,
  vendeur   uuid not null references public.joueurs (id) on delete cascade,   -- le propriétaire quand l'offre est faite
  prix      bigint not null check (prix > 0),
  statut    text not null default 'attente' check (statut in ('attente', 'acceptee', 'refusee', 'annulee', 'caduque')),
  cree_le   timestamptz not null default now(),
  maj       timestamptz not null default now()
);
-- une seule offre en attente par acheteur et par lieu (la refaire la modifie)
create unique index if not exists offres_une_en_attente on public.offres (lieu, acheteur) where statut = 'attente';
create index if not exists offres_vendeur on public.offres (vendeur, statut);
create index if not exists offres_acheteur on public.offres (acheteur, statut);
alter table public.offres enable row level security;
drop policy if exists "mes offres" on public.offres;
create policy "mes offres" on public.offres for select to authenticated
  using (acheteur = (select auth.uid()) or vendeur = (select auth.uid()));
revoke all on public.offres from anon, authenticated;
grant select on public.offres to authenticated;
grant all on public.offres to service_role;

-- ---------------------------------------------------------------- les notifications (offres, ventes…)
create table if not exists public.notifications (
  id        bigint generated always as identity primary key,
  joueur    uuid not null references public.joueurs (id) on delete cascade,
  type      text not null,                       -- offre, vente, echange, enchere
  texte     text not null,
  donnees   jsonb not null default '{}'::jsonb,  -- { offre, lieu } : pour les boutons
  lu        boolean not null default false,
  cree_le   timestamptz not null default now()
);
create index if not exists notifications_joueur on public.notifications (joueur, cree_le desc);
alter table public.notifications enable row level security;
drop policy if exists "mes notifications" on public.notifications;
create policy "mes notifications" on public.notifications for select to authenticated using (joueur = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- mettre en vente à un prix (ou retirer de la vente : prix vide)
create or replace function public.jeu_vendre(j uuid, l text, prix bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.lieux set prix_vente = prix, maj = now() where id = l and proprietaire = j;
  if not found then raise exception 'pas_a_toi'; end if;
end $$;

-- changer de propriétaire : voir jeu_transferer dans 060_valeur.sql (qui note aussi la vente)

-- faire une offre (ou changer le prix de son offre en attente) sur le lieu d'un autre joueur
create or replace function public.jeu_offrir(j uuid, l text, prix bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v uuid; o bigint;
begin
  select proprietaire into v from public.lieux where id = l;
  if not found then raise exception 'libre'; end if;
  if v = j then raise exception 'soi_meme'; end if;
  insert into public.offres (lieu, acheteur, vendeur, prix) values (l, j, v, prix)
  on conflict (lieu, acheteur) where statut = 'attente' do update set prix = excluded.prix, vendeur = excluded.vendeur, maj = now()
  returning id into o;
  return o;
end $$;

-- refuser (le vendeur), annuler (l'acheteur), ou rendre caduque une offre en attente
create or replace function public.jeu_offre_statut(o bigint, qui uuid, statut text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if statut not in ('refusee', 'annulee', 'caduque') then raise exception 'statut'; end if;
  update public.offres f set statut = jeu_offre_statut.statut, maj = now()
   where f.id = o and f.statut = 'attente'
     and ((jeu_offre_statut.statut = 'annulee' and f.acheteur = qui) or (jeu_offre_statut.statut <> 'annulee' and f.vendeur = qui));
  if not found then raise exception 'offre'; end if;
end $$;

-- une notification pour un joueur
create or replace function public.jeu_notifier(j uuid, type text, texte text, donnees jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (joueur, type, texte, donnees) values (j, type, texte, coalesce(donnees, '{}'::jsonb));
$$;

-- mes notifications lues
create or replace function public.jeu_notifs_lues(j uuid) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set lu = true where joueur = j and not lu;
$$;

revoke all on function public.jeu_vendre(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.jeu_offrir(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.jeu_offre_statut(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.jeu_notifier(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_notifs_lues(uuid) from public, anon, authenticated;
grant execute on function public.jeu_vendre(uuid, text, bigint) to service_role;
grant execute on function public.jeu_offrir(uuid, text, bigint) to service_role;
grant execute on function public.jeu_offre_statut(bigint, uuid, text) to service_role;
grant execute on function public.jeu_notifier(uuid, text, text, jsonb) to service_role;
grant execute on function public.jeu_notifs_lues(uuid) to service_role;
