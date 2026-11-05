-- Cadastra : le niveau des communes (GDD § 5, [Proposé] ; construit le 5 nov. 2026). Tout ce qui a été versé à la caisse
-- de travaux d'une commune, depuis toujours et par tous, fait monter son niveau (0 à 5, paliers ECO.mairie.travaux_paliers,
-- calculé par les règles du jeu : src/regles/mairie.js, niveauTravaux). Les travaux faits restent faits : le total ne
-- baisse jamais, même quand un joueur supprime son compte (ses versements, eux, partent avec lui).
-- Le total est tenu par un déclencheur sur « caisses » (chaque versement de jeu_verser l'augmente). Lisible par tous.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit (par jeu_verser).

create table if not exists public.travaux (
  commune text primary key,                               -- la commune du jeu (« Paris 9e », « Bagneux »)
  total   bigint not null default 0 check (total >= 0),    -- les pièces versées à sa caisse, depuis toujours
  maj     timestamptz not null default now()
);
alter table public.travaux enable row level security;
drop policy if exists "travaux lisibles par tous" on public.travaux;
create policy "travaux lisibles par tous" on public.travaux for select to anon, authenticated using (true);
revoke all on public.travaux from anon, authenticated;
grant select on public.travaux to anon, authenticated;
grant all on public.travaux to service_role;

-- chaque versement (une ligne de caisse créée, ou son montant qui monte) s'ajoute aux travaux de la commune
create or replace function public.caisses_travaux() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d bigint := new.verse - (case when tg_op = 'UPDATE' then old.verse else 0 end);
begin
  if d > 0 then
    insert into public.travaux (commune, total) values (new.commune, d)
    on conflict (commune) do update set total = public.travaux.total + excluded.total, maj = now();
  end if;
  return new;
end $$;
revoke all on function public.caisses_travaux() from public, anon, authenticated;
drop trigger if exists caisses_travaux on public.caisses;
create trigger caisses_travaux after insert or update of verse on public.caisses for each row execute function public.caisses_travaux();

-- ce qui a été versé avant le déclencheur (une seule fois : une commune déjà comptée ne l'est pas deux fois)
insert into public.travaux (commune, total)
  select commune, sum(verse) from public.caisses group by commune having sum(verse) > 0
on conflict (commune) do nothing;
