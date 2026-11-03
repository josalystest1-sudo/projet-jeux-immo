-- Cadastra : les joueurs robots du serveur d'essai (demande de Gautier, 3 nov. 2026 : « crée des comptes et fais-les jouer »).
-- De vrais comptes (créés par tools/serveur_robots.js), marqués ici ; la fonction « jeu » les fait jouer (robotsTour).
-- À supprimer au lancement : delete from auth.users where id in (select id from public.robots);
create table if not exists public.robots (
  id      uuid primary key references public.joueurs (id) on delete cascade,
  nom     text not null,
  cree_le timestamptz not null default now()
);
alter table public.robots enable row level security;
drop policy if exists "robots connus de tous" on public.robots;
create policy "robots connus de tous" on public.robots for select to anon, authenticated using (true);
revoke all on public.robots from anon, authenticated;
grant select on public.robots to anon, authenticated;
grant all on public.robots to service_role;

-- des robots assez riches pour acheter les lieux des vrais joueurs (serveur d'essai seulement)
update public.joueurs set pieces = greatest(pieces, 100000) where id in (select id from public.robots);

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
