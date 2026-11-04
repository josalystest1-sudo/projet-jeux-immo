-- Cadastra : la boutique et les gemmes (GDD § 3 et § 9, 4 nov. 2026). Les gemmes : la monnaie premium, à sens unique
-- (euros → gemmes, jamais l'inverse, jamais contre des pièces). Elles achètent les packs (national, régional) et le Pass
-- 15 jours (8 cartes au pack du jour, un bon d'adresse). Le paiement par carte (Stripe) viendra plus tard ; en attendant,
-- des gemmes d'essai, seulement sur le serveur d'essai accéléré. Chaque mouvement de gemmes est écrit dans un journal.
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

alter table public.joueurs add column if not exists gemmes bigint not null default 0 check (gemmes >= 0);
alter table public.joueurs add column if not exists pass_fin timestamptz;            -- la fin du Pass 15 jours (vide : jamais pris)
alter table public.joueurs add column if not exists bons smallint not null default 0 check (bons >= 0);   -- bons d'adresse du Pass

-- ---------------------------------------------------------------- le journal des gemmes (achats, dépenses, essais)
create table if not exists public.gemmes_journal (
  id       bigint generated always as identity primary key,
  joueur   uuid not null references public.joueurs (id) on delete cascade,
  delta    bigint not null,                -- + reçues, − dépensées
  motif    text not null,                  -- essai, pack_national, pack_regional, pass, stripe…
  quand    timestamptz not null default now()
);
create index if not exists gemmes_journal_joueur on public.gemmes_journal (joueur, quand desc);
alter table public.gemmes_journal enable row level security;
drop policy if exists "mon journal de gemmes" on public.gemmes_journal;
create policy "mon journal de gemmes" on public.gemmes_journal for select to authenticated using (joueur = (select auth.uid()));
revoke all on public.gemmes_journal from anon, authenticated;
grant select on public.gemmes_journal to authenticated;
grant all on public.gemmes_journal to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- des gemmes d'essai : seulement sur le serveur d'essai accéléré (jour_secondes < 86400)
create or replace function public.jeu_gemmes_essai(j uuid, n bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare g bigint;
begin
  if coalesce((select (valeur #>> '{}')::bigint from public.reglages where cle = 'jour_secondes'), 86400) >= 86400 then raise exception 'essai'; end if;
  update public.joueurs set gemmes = gemmes + greatest(n, 0) where id = j returning gemmes into g;
  insert into public.gemmes_journal (joueur, delta, motif) values (j, greatest(n, 0), 'essai');
  return g;
end $$;

-- un pack acheté : les lieux tirés deviennent à lui (sauf un lieu pris entre-temps) et les gemmes sont payées ; si aucun
-- lieu n'a pu être donné, rien n'est payé. Rend les lieux gagnés.
create or replace function public.jeu_pack_achete(j uuid, article text, prix bigint, cartes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare gagnes jsonb; g bigint;
begin
  if prix <= 0 then raise exception 'prix'; end if;
  with ins as (
    insert into public.lieux (id, proprietaire, type, label, lon, lat, citycode, city, commune, idu, notoriete, cat, qid, rarete)
    select c.id, j, c.type, c.label, c.lon, c.lat, coalesce(c.citycode, ''), coalesce(c.city, ''), coalesce(c.commune, ''), c.idu, c.notoriete, c.cat, c.qid, c.rarete
      from jsonb_to_recordset(cartes) as c(id text, type text, label text, lon double precision, lat double precision,
                                          citycode text, city text, commune text, idu text, notoriete text, cat text, qid text, rarete smallint)
     where c.id is not null and c.type in ('adresse', 'lieu')
    on conflict (id) do nothing
    returning id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb) into gagnes from ins;
  if jsonb_array_length(gagnes) = 0 then raise exception 'vide'; end if;
  update public.joueurs set gemmes = gemmes - prix where id = j and gemmes >= prix returning gemmes into g;
  if g is null then raise exception 'gemmes'; end if;
  insert into public.gemmes_journal (joueur, delta, motif) values (j, -prix, article);
  return gagnes;
end $$;

-- le Pass 15 jours : sa nouvelle fin et ses bons (calculés par les règles) ; « avant » protège d'un double achat
create or replace function public.jeu_pass(j uuid, prix bigint, avant timestamptz, fin timestamptz, nbons smallint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare g bigint;
begin
  update public.joueurs set gemmes = gemmes - prix, pass_fin = fin, bons = nbons
   where id = j and gemmes >= prix and pass_fin is not distinct from avant
  returning gemmes into g;
  if g is null then raise exception 'gemmes'; end if;
  insert into public.gemmes_journal (joueur, delta, motif) values (j, -prix, 'pass');
  return g;
end $$;

-- le bon du Pass : une adresse libre (vérifiée par la fonction « jeu ») devient à lui ; il faut un Pass actif et un bon
create or replace function public.jeu_bon(j uuid, lieu jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.joueurs set bons = bons - 1 where id = j and bons > 0 and pass_fin > now();
  if not found then raise exception 'bon'; end if;
  insert into public.lieux (id, proprietaire, type, label, lon, lat, citycode, city, commune, rarete)
  select c.id, j, 'adresse', c.label, c.lon, c.lat, coalesce(c.citycode, ''), coalesce(c.city, ''), coalesce(c.commune, ''), c.rarete
    from jsonb_to_record(lieu) as c(id text, label text, lon double precision, lat double precision, citycode text, city text, commune text, rarete smallint)
  on conflict (id) do nothing;
  if not found then raise exception 'pris'; end if;
end $$;

revoke all on function public.jeu_gemmes_essai(uuid, bigint) from public, anon, authenticated;
revoke all on function public.jeu_pack_achete(uuid, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.jeu_pass(uuid, bigint, timestamptz, timestamptz, smallint) from public, anon, authenticated;
revoke all on function public.jeu_bon(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.jeu_gemmes_essai(uuid, bigint) to service_role;
grant execute on function public.jeu_pack_achete(uuid, text, bigint, jsonb) to service_role;
grant execute on function public.jeu_pass(uuid, bigint, timestamptz, timestamptz, smallint) to service_role;
grant execute on function public.jeu_bon(uuid, jsonb) to service_role;
