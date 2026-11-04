-- Cadastra : le paiement par carte des gemmes (Stripe Checkout, GDD § 9). La fonction « jeu » ouvre une page de paiement
-- chez Stripe (une « session ») et la note ici ; au retour du joueur (et à chacun de ses passages tant qu'elle est ouverte),
-- elle demande à Stripe si la session est payée, et seulement alors les gemmes sont créditées, une seule fois.
-- Le pays de la carte est gardé : les packs ne sont pas vendus en Belgique ni aux Pays-Bas (loot boxes).
-- Envoyé au serveur par la publication ; peut être relancé sans danger. Seule la fonction « jeu » écrit.

create table if not exists public.paiements (
  session     text primary key,                       -- l'identifiant de la session Stripe (cs_…)
  joueur      uuid not null references public.joueurs (id) on delete cascade,
  offre       text not null,                          -- g500, g1200, g2600 (data/economie.json → boutique.gemmes)
  gemmes      bigint not null check (gemmes > 0),
  centimes    bigint not null check (centimes > 0),
  statut      text not null default 'ouvert' check (statut in ('ouvert', 'paye', 'expire')),
  renonce     boolean not null default false,          -- le joueur a demandé l'accès immédiat (renonce à la rétractation)
  pays        text,                                    -- le pays de la carte (code à deux lettres)
  test        boolean not null default true,           -- payé avec une clé de test (de l'argent fictif)
  cree_le     timestamptz not null default now(),
  paye_le     timestamptz
);
create index if not exists paiements_joueur on public.paiements (joueur, statut);
alter table public.paiements enable row level security;
drop policy if exists "mes paiements" on public.paiements;
create policy "mes paiements" on public.paiements for select to authenticated using (joueur = (select auth.uid()));
revoke all on public.paiements from anon, authenticated;
grant select on public.paiements to authenticated;
grant all on public.paiements to service_role;

-- ---------------------------------------------------------------- les écritures (serveur seulement)
-- noter une session ouverte
create or replace function public.jeu_paiement_noter(s text, j uuid, offre text, gemmes bigint, centimes bigint, renonce boolean, test boolean) returns void
language sql security definer set search_path = '' as $$
  insert into public.paiements (session, joueur, offre, gemmes, centimes, renonce, test) values (s, j, offre, gemmes, centimes, renonce, test)
  on conflict (session) do nothing;
$$;

-- une session payée (vérifiée auprès de Stripe) : les gemmes, une seule fois ; rend les gemmes données (0 : déjà fait)
create or replace function public.jeu_paiement_crediter(s text, pays text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare p public.paiements%rowtype;
begin
  update public.paiements set statut = 'paye', paye_le = now(), pays = jeu_paiement_crediter.pays where session = s and statut = 'ouvert' returning * into p;
  if not found then return 0; end if;
  update public.joueurs set gemmes = gemmes + p.gemmes where id = p.joueur;
  insert into public.gemmes_journal (joueur, delta, motif) values (p.joueur, p.gemmes, case when p.test then 'stripe_test' else 'stripe' end);
  return p.gemmes;
end $$;

-- une session expirée (jamais payée)
create or replace function public.jeu_paiement_expirer(s text) returns void
language sql security definer set search_path = '' as $$
  update public.paiements set statut = 'expire' where session = s and statut = 'ouvert';
$$;

revoke all on function public.jeu_paiement_noter(text, uuid, text, bigint, bigint, boolean, boolean) from public, anon, authenticated;
revoke all on function public.jeu_paiement_crediter(text, text) from public, anon, authenticated;
revoke all on function public.jeu_paiement_expirer(text) from public, anon, authenticated;
grant execute on function public.jeu_paiement_noter(text, uuid, text, bigint, bigint, boolean, boolean) to service_role;
grant execute on function public.jeu_paiement_crediter(text, text) to service_role;
grant execute on function public.jeu_paiement_expirer(text) to service_role;
