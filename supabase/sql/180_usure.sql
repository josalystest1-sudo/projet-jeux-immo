-- Cadastra : les travaux s'usent (décision de Gautier, 5 nov. 2026 : « les travaux s'usent », pour qu'une commune au
-- niveau 5 reste un objectif). La table « travaux » (170_travaux.sql) garde le total versé depuis toujours, pour mémoire,
-- et désormais l'état des travaux : à chaque versement, l'état est d'abord usé de 10 % par mandat passé depuis le
-- précédent (ECO.mairie.travaux_usure ; les mêmes calculs que src/regles/mairie.js, etatTravaux), puis le versement s'y
-- ajoute. Le jeu et la fonction « jeu » lisent l'état et son mandat, et l'usent eux-mêmes jusqu'au mandat en cours.
-- Envoyé au serveur par la publication (après 170_travaux.sql) ; peut être relancé sans danger.

alter table public.travaux add column if not exists etat bigint not null default 0 check (etat >= 0);   -- l'état des travaux au mandat « mandat »
alter table public.travaux add column if not exists mandat bigint;                                     -- le mandat du dernier versement
-- la première fois (et pour une commune ajoutée par 170 sans état) : l'état part du total, au dernier mandat versé
update public.travaux t set etat = t.total, mandat = coalesce((select max(c.mandat) from public.caisses c where c.commune = t.commune), 0)
 where t.mandat is null;

-- chaque versement : l'état est usé jusqu'au mandat du versement (0,9 par mandat passé), puis le versement s'y ajoute
create or replace function public.caisses_travaux() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d bigint := new.verse - (case when tg_op = 'UPDATE' then old.verse else 0 end);
begin
  if d > 0 then
    insert into public.travaux as t (commune, total, etat, mandat) values (new.commune, d, d, new.mandat)
    on conflict (commune) do update set
      total = t.total + d,
      etat = floor(t.etat * power(0.9::float8, greatest(0, new.mandat - coalesce(t.mandat, new.mandat))))::bigint + d,
      mandat = greatest(coalesce(t.mandat, new.mandat), new.mandat),
      maj = now();
  end if;
  return new;
end $$;
revoke all on function public.caisses_travaux() from public, anon, authenticated;
