-- Cadastra : le monde vu par tous (phase 8.1d) : la carte, les classements des communes et leurs Maires.
-- Lecture seule : ces fonctions ne font que lire la table des lieux et les profils (pseudo, icône).

create index if not exists lieux_position on public.lieux (lat, lon);

-- le classement d'une commune : qui y possède combien de lieux (à égalité, le premier arrivé d'abord)
create or replace function public.classement_commune(c text)
returns table (joueur uuid, pseudo text, avatar text, n bigint)
language sql stable security definer set search_path = '' as $$
  select l.proprietaire, p.pseudo, p.avatar, count(*)::bigint
    from public.lieux l left join public.profils p on p.id = l.proprietaire
   where l.commune = c
   group by l.proprietaire, p.pseudo, p.avatar
   order by count(*) desc, min(l.depuis) asc
   limit 50;
$$;

-- les Maires de plusieurs communes d'un coup : le ou les joueurs qui y possèdent le plus de lieux (égalité = plusieurs)
create or replace function public.maires(communes text[])
returns table (commune text, joueur uuid, pseudo text, n bigint)
language sql stable security definer set search_path = '' as $$
  with c as (select l.commune, l.proprietaire, count(*)::bigint as n from public.lieux l where l.commune = any(communes) group by 1, 2),
       m as (select c.commune, max(c.n) as mx from c group by 1)
  select c.commune, c.proprietaire, p.pseudo, c.n
    from c join m on m.commune = c.commune and c.n = m.mx
    left join public.profils p on p.id = c.proprietaire;
$$;

revoke all on function public.classement_commune(text) from public;
revoke all on function public.maires(text[]) from public;
grant execute on function public.classement_commune(text) to anon, authenticated, service_role;
grant execute on function public.maires(text[]) to anon, authenticated, service_role;
