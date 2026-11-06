-- StreetKeep : les alertes de monument partent aussi par e-mail (GDD § 5 ter : « Gautier est prévenu, e-mail + tableau de
-- bord, dès qu'un monument redevient libre »). L'horloge de la fonction « jeu » (toutes les 10 minutes) envoie les nouvelles
-- alertes à contact@citydeck.fr par Brevo, une fois par heure au plus, puis les note envoyées ici.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

alter table public.alertes add column if not exists envoyee_le timestamptz;   -- vide : pas encore partie par e-mail

-- les alertes d'avant l'e-mail (6 nov. 2026) restent dans le tableau de bord, sans e-mail
update public.alertes set envoyee_le = '-infinity' where envoyee_le is null and cree_le < '2026-11-06 06:00:00+01';

-- des alertes parties par e-mail
create or replace function public.jeu_alertes_envoyees(ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.alertes set envoyee_le = now() where id = any(ids) and envoyee_le is null;
$$;
revoke all on function public.jeu_alertes_envoyees(bigint[]) from public, anon, authenticated;
grant execute on function public.jeu_alertes_envoyees(bigint[]) to service_role;
