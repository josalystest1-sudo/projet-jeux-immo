-- Cadastra : les réglages du serveur (phase 8) : d'abord la vitesse du temps.
-- jour_secondes : la durée d'un jour du jeu. 60 = serveur d'essai accéléré (un jour = une minute, comme la démo) ;
-- 86400 = le vrai jeu (le pack à minuit, heure de Paris). Valeur posée une seule fois ici (pas écrasée ensuite) ;
-- au lancement : update public.reglages set valeur = '86400' where cle = 'jour_secondes';  (puis repartir de zéro)
create table if not exists public.reglages (
  cle    text primary key,
  valeur jsonb not null
);
insert into public.reglages (cle, valeur) values ('jour_secondes', '60') on conflict (cle) do nothing;
alter table public.reglages enable row level security;
drop policy if exists "réglages lisibles par tous" on public.reglages;
create policy "réglages lisibles par tous" on public.reglages for select to anon, authenticated using (true);
revoke all on public.reglages from anon, authenticated;
grant select on public.reglages to anon, authenticated;
grant all on public.reglages to service_role;
