-- La bêta (décision de Gautier, 28 nov. 2026) : chaque pack gratuit du jour donne des gemmes (ECO.beta.gemmes_pack), pour
-- que les joueurs essaient la boutique sans payer : « au bout de 3 ou 4 packs gratuits, ils auront assez de gemmes pour
-- s'acheter un pack ». Pendant la bêta, on n'achète pas de gemmes en euros. À la sortie, ces gemmes ne sont plus données.
create or replace function public.jeu_gemmes_beta(j uuid, n bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare g bigint;
begin
  update public.joueurs set gemmes = gemmes + greatest(n, 0) where id = j returning gemmes into g;
  insert into public.gemmes_journal (joueur, delta, motif) values (j, greatest(n, 0), 'beta');
  return g;
end $$;
revoke all on function public.jeu_gemmes_beta(uuid, bigint) from public, anon, authenticated;
grant execute on function public.jeu_gemmes_beta(uuid, bigint) to service_role;
