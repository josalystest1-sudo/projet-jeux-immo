-- Cadastra : les joueurs robots du serveur d'essai (demande de Gautier, 3 nov. 2026 : « crée des comptes et fais-les jouer »).
-- De vrais comptes (créés par tools/serveur_robots.js), marqués ici ; la fonction « jeu » les fait jouer (robotsTour).
-- Au lancement, ils restent (décision du 5 nov.) et se retirent d'eux-mêmes quand les vrais joueurs arrivent. Pour les
-- supprimer d'un coup : delete from auth.users where id in (select id from public.robots);
create table if not exists public.robots (
  id      uuid primary key references public.joueurs (id) on delete cascade,
  nom     text not null,
  cree_le timestamptz not null default now()
);
alter table public.robots enable row level security;
-- cachés parmi les joueurs (décision de Gautier, 5 nov.) : le jeu ne lit plus cette table ; seul le serveur sait qui est un robot
drop policy if exists "robots connus de tous" on public.robots;
revoke all on public.robots from anon, authenticated;
grant all on public.robots to service_role;

-- Les joueurs de la maison (5 nov. 2026, GDD § 5 quater, décision de Gautier : « les laisser au début du jeu, jouer comme
-- des humains et ne pas abuser ; on les retirera progressivement avec la montée des joueurs »). Ils restent au lancement.
-- Ce sont des joueurs ordinaires : plus de réserve de 100 000 pièces (leurs pièces sont ramenées à 20 000 au plus,
-- ECO.robots.pieces_max_essai) ; la fonction « jeu » les fait jouer avec les règles de src/regles/robots.js.
alter table public.robots add column if not exists retire_le timestamptz;   -- retiré depuis (vide : il joue)
update public.joueurs set pieces = least(pieces, 20000) where id in (select id from public.robots);
-- des icônes de joueurs ordinaires (plus de 🤖), toujours la même pour un robot donné
update public.profils p set avatar = (array['🦊','🐻','🐼','🦁','🐯','🐸','🐙','🦄','🐲','🎩'])[1 + abs(hashtext(p.id::text)) % 10]
 where p.id in (select id from public.robots) and p.avatar = '🤖';

alter table public.joueurs add column if not exists vu_le timestamptz not null default now();   -- (aussi dans 090_mairie.sql)
-- les vrais joueurs venus depuis « depuis » (avec un pseudo, sans les robots) : le nombre de robots en dépend
create or replace function public.jeu_humains_actifs(depuis timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.joueurs j join public.profils p on p.id = j.id
   where p.pseudo is not null and j.vu_le >= depuis and not exists (select 1 from public.robots r where r.id = j.id);
$$;
-- un robot qui se retire (actif = faux) ou qui revient (actif = vrai) ; en se retirant, ses offres et ses propositions
-- d'échange en attente tombent ; rend la date de son retrait (vide s'il joue)
create or replace function public.jeu_robot_retraite(j uuid, actif boolean) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare t timestamptz;
begin
  update public.robots set retire_le = case when actif then null else coalesce(retire_le, now()) end where id = j returning retire_le into t;
  if not actif then
    update public.offres set statut = 'annulee' where acheteur = j and statut = 'attente';
    update public.echanges set statut = 'annulee' where proposeur = j and statut = 'attente';
  end if;
  return t;
end $$;
-- un robot retiré depuis longtemps rend ses lieux libres (ils peuvent de nouveau sortir des packs) ; rend leur nombre
create or replace function public.jeu_robot_liberer(j uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.robots where id = j and retire_le is not null) then return 0; end if;
  update public.echanges set statut = 'caduque' where statut = 'attente'
     and exists (select 1 from public.lieux l where l.proprietaire = j and l.id = any(donnes));
  delete from public.lieux where proprietaire = j;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.jeu_humains_actifs(timestamptz) from public, anon, authenticated;
revoke all on function public.jeu_robot_retraite(uuid, boolean) from public, anon, authenticated;
revoke all on function public.jeu_robot_liberer(uuid) from public, anon, authenticated;
grant execute on function public.jeu_humains_actifs(timestamptz) to service_role;
grant execute on function public.jeu_robot_retraite(uuid, boolean) to service_role;
grant execute on function public.jeu_robot_liberer(uuid) to service_role;

-- un tour des robots au plus toutes les « intervalle » secondes, quel que soit le nombre de joueurs connectés
create or replace function public.jeu_robots_tour(intervalle integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reglages (cle, valeur) values ('robots_tour', to_jsonb(0)) on conflict (cle) do nothing;
  update public.reglages set valeur = to_jsonb(extract(epoch from now()))
   where cle = 'robots_tour' and (valeur #>> '{}')::double precision < extract(epoch from now()) - intervalle;
  return found;
end $$;
revoke all on function public.jeu_robots_tour(integer) from public, anon, authenticated;
grant execute on function public.jeu_robots_tour(integer) to service_role;
