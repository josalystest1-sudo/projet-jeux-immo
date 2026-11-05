-- Cadastra : le suivi de Gautier (5 nov. 2026, liste « avant la pub » : un tableau de bord des inscrits et des retours).
-- Chaque jour (heure de Paris) où un vrai joueur passe, une ligne dans « visites », notée par jeu_vu (appelée par la
-- fonction « jeu » à chaque passage d'un joueur). Les robots ne sont jamais comptés.
-- Deux vues, lisibles seulement dans le tableau de bord de Supabase (Table Editor), jamais par le jeu :
--   suivi_total : une ligne, le résumé (inscrits, venus, retours du lendemain et du 7e jour, achats) ;
--   suivi_jours : un jour par ligne, du plus récent au plus ancien.
-- Les jours sont de vrais jours (minuit à Paris), quelle que soit la vitesse du serveur d'essai.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

create table if not exists public.visites (
  joueur uuid not null references public.joueurs (id) on delete cascade,
  jour   date not null,                       -- le jour, à Paris
  primary key (joueur, jour)
);
create index if not exists visites_jour on public.visites (jour);
alter table public.visites enable row level security;
revoke all on public.visites from anon, authenticated;
grant all on public.visites to service_role;

-- aujourd'hui, à Paris
create or replace function public.jour_paris(t timestamptz default now()) returns date
language sql stable set search_path = '' as $$ select (t at time zone 'Europe/Paris')::date $$;

-- ma visite (redéfinie : elle note aussi le jour de la visite d'un vrai joueur ; la mise à jour de vu_le et
-- l'avertissement d'absence restent ceux de 110_monuments.sql)
create or replace function public.jeu_vu(j uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.joueurs set vu_le = now(), averti_absence = false where id = j and (vu_le < now() - interval '30 seconds' or averti_absence);
  insert into public.visites (joueur, jour)
    select j, public.jour_paris() where exists (select 1 from public.joueurs where id = j) and not exists (select 1 from public.robots where id = j)
  on conflict do nothing;
end $$;
revoke all on function public.jeu_vu(uuid) from public, anon, authenticated;
grant execute on function public.jeu_vu(uuid) to service_role;

-- ce qu'on sait déjà des joueurs venus avant le suivi : le jour de leur inscription et celui de leur dernière visite
insert into public.visites (joueur, jour)
  select j.id, public.jour_paris(j.cree_le) from public.joueurs j where not exists (select 1 from public.robots r where r.id = j.id)
  union select j.id, public.jour_paris(j.vu_le) from public.joueurs j where not exists (select 1 from public.robots r where r.id = j.id)
on conflict do nothing;

-- ---------------------------------------------------------------- les vues (tableau de bord seulement)
-- les vrais joueurs (un pseudo choisi, pas un robot) et leur jour d'inscription
create or replace view public.suivi_inscrits with (security_invoker = true) as
  select p.id, public.jour_paris(p.cree_le) as inscrit
  from public.profils p
  where not exists (select 1 from public.robots r where r.id = p.id);

-- un jour par ligne : inscrits ce jour-là, joueurs venus, et parmi les inscrits du jour, ceux revenus le lendemain
-- (« retour J1 ») et le 7e jour (« retour J7 ») ; vide tant que ce jour n'est pas arrivé
create or replace view public.suivi_jours with (security_invoker = true) as
with jours as (
  select generate_series(coalesce((select min(inscrit) from public.suivi_inscrits), public.jour_paris()), public.jour_paris(), interval '1 day')::date as jour
)
select d.jour,
  (select count(*) from public.suivi_inscrits i where i.inscrit = d.jour) as inscrits,
  (select count(*) from public.visites v where v.jour = d.jour) as venus,
  case when d.jour + 1 <= public.jour_paris() then
    (select count(*) from public.suivi_inscrits i where i.inscrit = d.jour and exists (select 1 from public.visites v where v.joueur = i.id and v.jour = d.jour + 1)) end as revenus_j1,
  case when d.jour + 7 <= public.jour_paris() then
    (select count(*) from public.suivi_inscrits i where i.inscrit = d.jour and exists (select 1 from public.visites v where v.joueur = i.id and v.jour = d.jour + 7)) end as revenus_j7,
  (select count(*) from public.paiements p where p.statut = 'paye' and not p.test and public.jour_paris(p.paye_le) = d.jour) as achats,
  (select coalesce(sum(p.centimes), 0) / 100.0 from public.paiements p where p.statut = 'paye' and not p.test and public.jour_paris(p.paye_le) = d.jour) as euros,
  (select count(*) from public.paiements p where p.statut = 'paye' and p.test and public.jour_paris(p.paye_le) = d.jour) as achats_test
from jours d
order by d.jour desc;

-- le résumé, en une ligne : les taux de retour sont calculés sur les inscrits dont le lendemain (ou le 7e jour) est passé
create or replace view public.suivi_total with (security_invoker = true) as
with t as (
  select
    (select count(*) from public.suivi_inscrits) as inscrits,
    (select count(*) from public.suivi_inscrits where inscrit > public.jour_paris() - 7) as inscrits_7_jours,
    (select count(*) from public.visites where jour = public.jour_paris()) as venus_aujourdhui,
    (select count(distinct joueur) from public.visites where jour > public.jour_paris() - 7) as venus_7_jours,
    (select count(*) from public.suivi_inscrits where inscrit + 1 <= public.jour_paris()) as base_j1,
    (select count(*) from public.suivi_inscrits i where i.inscrit + 1 <= public.jour_paris()
       and exists (select 1 from public.visites v where v.joueur = i.id and v.jour = i.inscrit + 1)) as revenus_j1,
    (select count(*) from public.suivi_inscrits where inscrit + 7 <= public.jour_paris()) as base_j7,
    (select count(*) from public.suivi_inscrits i where i.inscrit + 7 <= public.jour_paris()
       and exists (select 1 from public.visites v where v.joueur = i.id and v.jour = i.inscrit + 7)) as revenus_j7,
    (select count(distinct joueur) from public.paiements where statut = 'paye' and not test) as payants,
    (select coalesce(sum(centimes), 0) / 100.0 from public.paiements where statut = 'paye' and not test) as euros,
    (select count(*) from public.robots where retire_le is null) as robots_en_jeu
)
select inscrits, inscrits_7_jours, venus_aujourdhui, venus_7_jours,
  case when base_j1 > 0 then round(100.0 * revenus_j1 / base_j1) end as pct_retour_j1,
  case when base_j7 > 0 then round(100.0 * revenus_j7 / base_j7) end as pct_retour_j7,
  payants, euros,
  case when inscrits > 0 then round(100.0 * payants / inscrits, 1) end as pct_payants,
  robots_en_jeu
from t;

revoke all on public.suivi_inscrits, public.suivi_jours, public.suivi_total from anon, authenticated;
grant select on public.suivi_inscrits, public.suivi_jours, public.suivi_total to service_role;
