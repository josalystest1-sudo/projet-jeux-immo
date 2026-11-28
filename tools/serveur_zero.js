// La remise à zéro du serveur (décision de Gautier, 28 nov. 2026, avant la bêta ; à refaire le jour de la sortie) : tous les
// comptes sont supprimés (les joueurs se réinscrivent), tous les lieux, pièces, gemmes, enchères, caisses et classements
// sont effacés, et le jeu passe au rythme donné (86400 : un jour du jeu = un vrai jour, pack à minuit à Paris).
// Les joueurs de la maison sont recréés ensuite par tools/serveur_robots.js. IRRÉVERSIBLE : lancé seulement à la main, par
// le workflow « Remise à zéro » (.github/workflows/remise_a_zero.yml), avec le mot de confirmation.
//   node tools/serveur_zero.js <référence du projet> <jour_secondes> "REMISE A ZERO"
const REF = process.argv[2], JOUR = Number(process.argv[3]), MOT = process.argv[4];
const JETON = process.env.SUPABASE_ACCESS_TOKEN;
const TABLES = ['lieux', 'offres', 'ventes', 'echanges', 'encheres', 'mises', 'caisses', 'parts_maire', 'mandats_tenus', 'mairies', 'saisons', 'saisons_joueurs',
  'alertes', 'gemmes_journal', 'paiements', 'visites', 'cadence', 'empreintes', 'travaux', 'chasses', 'chasseurs', 'agences', 'packs_prets', 'notifications',
  'robots', 'signalements', 'retours', 'joueurs', 'profils'];
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const t = await r.text(); if (r.status >= 300) throw new Error(`refusé par le serveur (HTTP ${r.status}) : ${t.slice(0, 400)}`);
  try { return JSON.parse(t); } catch (_) { return t; }
}
(async () => {
  if (!JETON) throw new Error('SUPABASE_ACCESS_TOKEN absent');
  if (MOT !== 'REMISE A ZERO') throw new Error('mot de confirmation absent : rien n’est fait');
  if (!REF || !(JOUR >= 60 && JOUR <= 86400)) throw new Error('usage : serveur_zero.js <projet> <jour_secondes> "REMISE A ZERO"');
  const avant = await sql('select (select count(*) from auth.users) as comptes, (select count(*) from public.lieux) as lieux');
  console.log('avant :', JSON.stringify(avant));
  await sql(`begin;
    delete from auth.users;
    truncate ${TABLES.map((t) => 'public.' + t).join(', ')} restart identity cascade;
    delete from public.reglages where cle in ('saison_origine', 'robots_tour');
    insert into public.reglages (cle, valeur) values ('jour_secondes', '${JOUR}') on conflict (cle) do update set valeur = excluded.valeur;
    commit;`);
  const apres = await sql("select (select count(*) from auth.users) as comptes, (select count(*) from public.lieux) as lieux, (select valeur from public.reglages where cle = 'jour_secondes') as jour_secondes");
  console.log('après :', JSON.stringify(apres));
})().catch((e) => { console.error(e.message || e); process.exit(1); });
