-- Cadastra : les monuments, prestige et non revenu (GDD § 5 ter, 4 nov. 2026). L'entretien (calculé par les règles du jeu,
-- src/regles/monuments.js) est prélevé sur les pièces ; ce qui manque devient une dette ; après un mois d'impayé, ou après
-- 14 jours sans venir, la fonction « jeu » retire le monument à son propriétaire et le remet aux enchères (un lot de
-- reprise), et une alerte attend Gautier (table « alertes », lisible dans le tableau de bord Supabase).
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

alter table public.joueurs add column if not exists entretien_le timestamptz not null default now();   -- entretien payé jusque-là
alter table public.joueurs add column if not exists dette bigint not null default 0 check (dette >= 0);  -- entretien impayé
alter table public.joueurs add column if not exists impaye_depuis timestamptz;                         -- le premier manque (vide : rien n'est dû)
alter table public.joueurs add column if not exists averti_impaye boolean not null default false;      -- prévenu 7 jours avant la reprise
alter table public.joueurs add column if not exists averti_absence boolean not null default false;     -- prévenu 3 jours avant la reprise

-- ---------------------------------------------------------------- les alertes pour Gautier (tableau de bord, jamais le jeu)
create table if not exists public.alertes (
  id          bigint generated always as identity primary key,
  cree_le     timestamptz not null default now(),
  type        text not null,          -- absence, impaye, sans_preneur
  monument    text,                   -- l'identifiant de data/monuments.json
  nom         text,
  commune     text,
  fin_enchere timestamptz,            -- la fin de l'enchère à venir
  texte       text,                   -- une phrase prête à poster sur les réseaux
  lu          boolean not null default false
);
alter table public.alertes enable row level security;
revoke all on public.alertes from anon, authenticated;
grant all on public.alertes to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- ma visite (redéfinie : elle efface aussi l'avertissement d'absence)
create or replace function public.jeu_vu(j uuid) returns void
language sql security definer set search_path = '' as $$
  update public.joueurs set vu_le = now(), averti_absence = false where id = j and (vu_le < now() - interval '30 seconds' or averti_absence);
$$;

-- payer l'entretien (calculé par les règles) ; « avant » protège d'un double paiement simultané ; vrai si c'est fait
create or replace function public.jeu_entretien(j uuid, avant timestamptz, apres timestamptz, paye bigint, reste bigint, impaye timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.joueurs set pieces = pieces - greatest(paye, 0), dette = greatest(reste, 0), impaye_depuis = impaye, entretien_le = apres,
         averti_impaye = case when impaye is null then false else averti_impaye end
   where id = j and entretien_le = avant and pieces >= greatest(paye, 0);
  return found;
end $$;

-- un avertissement donné (absence ou impayé) : il ne sera pas répété
create or replace function public.jeu_averti(j uuid, quoi text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if quoi = 'absence' then update public.joueurs set averti_absence = true where id = j;
  elsif quoi = 'impaye' then update public.joueurs set averti_impaye = true where id = j; end if;
end $$;

-- une alerte pour Gautier
create or replace function public.jeu_alerte(alerte jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.alertes (type, monument, nom, commune, fin_enchere, texte)
  select x.type, x.monument, x.nom, x.commune, x.fin_enchere, x.texte from jsonb_to_record(alerte) as x(type text, monument text, nom text, commune text, fin_enchere timestamptz, texte text);
$$;

-- reprendre un monument : il quitte son propriétaire (ses offres partent avec lui, les échanges qui le donnaient tombent),
-- un lot de reprise l'attend aux enchères, Gautier est alerté ; après un impayé, la dette repart à zéro.
-- Rend l'ancien propriétaire (vide : ce n'était pas, ou plus, un monument possédé).
create or replace function public.jeu_monument_reprendre(l text, raison text, lot jsonb, alerte jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p uuid;
begin
  delete from public.lieux where id = l and type = 'monument' returning proprietaire into p;
  if p is null then return null; end if;
  update public.echanges set statut = 'caduque' where statut = 'attente' and l = any(donnes);
  if raison = 'impaye' then update public.joueurs set dette = 0, impaye_depuis = null, averti_impaye = false where id = p; end if;
  if lot is not null then
    insert into public.encheres (cle, semaine, rang, palier, monument, lieu, depart, fin)
    select x.cle, x.semaine, x.rang, x.palier, x.monument, x.lieu, x.depart, x.fin
      from jsonb_to_record(lot) as x(cle text, semaine bigint, rang smallint, palier text, monument text, lieu jsonb, depart bigint, fin timestamptz)
    on conflict do nothing;
  end if;
  if alerte is not null then perform public.jeu_alerte(alerte); end if;
  return p;
end $$;

revoke all on function public.jeu_vu(uuid) from public, anon, authenticated;
revoke all on function public.jeu_entretien(uuid, timestamptz, timestamptz, bigint, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.jeu_averti(uuid, text) from public, anon, authenticated;
revoke all on function public.jeu_alerte(jsonb) from public, anon, authenticated;
revoke all on function public.jeu_monument_reprendre(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_vu(uuid) to service_role;
grant execute on function public.jeu_entretien(uuid, timestamptz, timestamptz, bigint, bigint, timestamptz) to service_role;
grant execute on function public.jeu_averti(uuid, text) to service_role;
grant execute on function public.jeu_alerte(jsonb) to service_role;
grant execute on function public.jeu_monument_reprendre(text, text, jsonb, jsonb) to service_role;
