-- Cadastra : le classement des pièces (5 nov. 2026, demande de Gautier : « ajoute un classement par pièces possédées »).
-- Les pièces que chaque joueur a en main, en ce moment (sans les gemmes ni ce qui reste à récolter) ; seulement les joueurs
-- qui ont choisi leur pseudo. Ce classement n'est pas figé à la fin d'une saison [Proposé]. Les pièces des autres sont
-- cachées par les règles de « joueurs » (chacun ne lit que sa ligne) : ces deux fonctions n'en montrent que le total.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Tout le monde lit ; personne n'écrit ici.

create or replace function public.classement_pieces(lim integer)
returns table (joueur uuid, pseudo text, avatar text, n bigint)
language sql stable security definer set search_path = '' as $$
  select j.id, p.pseudo, p.avatar, j.pieces
    from public.joueurs j join public.profils p on p.id = j.id
   where p.pseudo is not null
   order by j.pieces desc, j.id
   limit least(greatest(lim, 1), 100);
$$;

-- la place d'un joueur au classement des pièces (à égalité, le même rang)
create or replace function public.rang_pieces(j uuid)
returns table (rang bigint, n bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.joueurs x join public.profils p on p.id = x.id where p.pseudo is not null and x.pieces > me.pieces) + 1, me.pieces
    from public.joueurs me where me.id = j;
$$;

revoke all on function public.classement_pieces(integer) from public;
revoke all on function public.rang_pieces(uuid) from public;
grant execute on function public.classement_pieces(integer) to anon, authenticated, service_role;
grant execute on function public.rang_pieces(uuid) to anon, authenticated, service_role;
