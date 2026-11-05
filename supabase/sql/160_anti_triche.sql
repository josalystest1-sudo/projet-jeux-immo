-- Cadastra : un minimum contre la triche (étape 8.3, 5 nov. 2026, liste « avant la pub » ; réglages ECO.anti_triche de
-- data/economie.json, chiffres [Proposé]).
-- 1. La cadence : un compte ne passe pas plus de N actions par minute par la fonction « jeu » (un programme qui joue à la
--    place du joueur, un bouton martelé) ; au-delà, l'action est refusée, rien n'est perdu.
-- 2. Les comptes en série : la fonction « jeu » note, une fois par jour, une empreinte de la connexion de chaque joueur
--    (un condensé chiffré de l'adresse IP, avec la clé secrète du projet : on ne peut pas retrouver l'adresse ; gardé
--    30 jours). Quand une même empreinte réunit assez de comptes dans la journée, une alerte attend Gautier (table
--    « alertes ») ; la vue « comptes_lies » montre les comptes qui partagent une connexion, avec les ventes et les
--    échanges entre eux. Rien n'est bloqué : une connexion partagée (famille, école, réseau mobile) est courante, et
--    plusieurs comptes sont tolérés en V1 (CLAUDE.md § 4, décision 11) ; ce qui compte, c'est d'en nourrir un avec les autres.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

-- ---------------------------------------------------------------- la cadence
create table if not exists public.cadence (
  joueur uuid primary key references auth.users (id) on delete cascade,
  minute timestamptz not null,           -- la minute en cours
  n      integer not null default 0      -- les actions passées dans cette minute
);
alter table public.cadence enable row level security;
revoke all on public.cadence from anon, authenticated;
grant all on public.cadence to service_role;

-- compter une action ; faux si le compte dépasse « limite » actions dans la minute
create or replace function public.jeu_cadence(j uuid, limite integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare m timestamptz := date_trunc('minute', now()); k integer;
begin
  insert into public.cadence as c (joueur, minute, n) values (j, m, 1)
  on conflict (joueur) do update set n = case when c.minute = m then c.n + 1 else 1 end, minute = m
  returning c.n into k;
  return k <= limite;
end $$;
revoke all on function public.jeu_cadence(uuid, integer) from public, anon, authenticated;
grant execute on function public.jeu_cadence(uuid, integer) to service_role;

-- ---------------------------------------------------------------- les empreintes de connexion
create table if not exists public.empreintes (
  joueur    uuid not null references auth.users (id) on delete cascade,
  jour      date not null,                -- le jour, à Paris
  empreinte text not null,                -- le condensé chiffré de l'adresse IP (jamais l'adresse)
  primary key (joueur, jour, empreinte)
);
create index if not exists empreintes_empreinte on public.empreintes (empreinte, jour);
create index if not exists empreintes_jour on public.empreintes (jour);
alter table public.empreintes enable row level security;
revoke all on public.empreintes from anon, authenticated;
grant all on public.empreintes to service_role;

-- noter l'empreinte du jour d'un joueur ; rend le nombre de comptes (sans les robots) qui partagent cette empreinte
-- aujourd'hui (0 : déjà notée). Au seuil, puis tous les « seuil » comptes de plus, une alerte pour Gautier. Les
-- empreintes de plus de « garder » jours sont effacées à chaque nouvelle empreinte.
create or replace function public.jeu_empreinte(j uuid, e text, seuil integer, garder integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare d date := public.jour_paris(); k integer; noms text;
begin
  insert into public.empreintes (joueur, jour, empreinte) values (j, d, e) on conflict do nothing;
  if not found then return 0; end if;
  select count(distinct x.joueur) into k from public.empreintes x
   where x.empreinte = e and x.jour = d and not exists (select 1 from public.robots r where r.id = x.joueur);
  if seuil > 0 and k >= seuil and (k - seuil) % seuil = 0 then
    select string_agg(coalesce(p.pseudo, '(sans pseudo)'), ', ' order by p.pseudo) into noms
      from public.empreintes x left join public.profils p on p.id = x.joueur
     where x.empreinte = e and x.jour = d and not exists (select 1 from public.robots r where r.id = x.joueur);
    insert into public.alertes (type, texte) values ('comptes',
      k || ' comptes depuis la même connexion aujourd''hui : ' || coalesce(noms, '') || '. Peut-être une famille ou un réseau partagé ; voir la vue comptes_lies (ventes et échanges entre eux).');
  end if;
  delete from public.empreintes where jour < d - garder;
  return k;
end $$;
revoke all on function public.jeu_empreinte(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.jeu_empreinte(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------- pour Gautier (tableau de bord seulement)
-- les comptes qui ont partagé une connexion un même jour (7 derniers jours), et ce qui est passé entre eux : un compte
-- nourri par d'autres se voit à des ventes entre eux loin de la valeur, ou à des échanges acceptés
create or replace view public.comptes_lies with (security_invoker = true) as
with groupes as (
  select x.empreinte, x.jour, array_agg(distinct x.joueur) as joueurs, count(distinct x.joueur) as comptes
  from public.empreintes x
  where x.jour > public.jour_paris() - 7 and not exists (select 1 from public.robots r where r.id = x.joueur)
  group by x.empreinte, x.jour
  having count(distinct x.joueur) >= 2
)
select g.jour, g.comptes,
  (select string_agg(coalesce(p.pseudo, '(sans pseudo)'), ', ' order by p.pseudo) from public.profils p where p.id = any (g.joueurs)) as pseudos,
  (select count(*) from public.ventes v where v.vendeur = any (g.joueurs) and v.acheteur = any (g.joueurs)) as ventes_entre_eux,
  (select coalesce(sum(abs(v.prix - v.valeur_ref)), 0) from public.ventes v where v.vendeur = any (g.joueurs) and v.acheteur = any (g.joueurs) and v.devise = 'pieces') as ecart_a_la_valeur,
  (select count(*) from public.echanges x where x.statut = 'acceptee' and x.proposeur = any (g.joueurs) and x.destinataire = any (g.joueurs)) as echanges_entre_eux,
  left(g.empreinte, 6) as connexion
from groupes g
order by g.jour desc, g.comptes desc;
revoke all on public.comptes_lies from anon, authenticated;
grant select on public.comptes_lies to service_role;
