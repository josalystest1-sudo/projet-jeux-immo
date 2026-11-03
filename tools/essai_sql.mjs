// Essai des fonctions SQL du serveur (supabase/sql) dans un vrai Postgres, sur le PC, sans toucher au serveur :
// PGlite (Postgres compilé pour Node) rejoue tous les fichiers SQL, puis essaie les échanges (070_echanges.sql) :
// proposer, refuser, annuler, accepter, ce qui tombe, les refus attendus et les droits du jeu (lecture seule).
// Prérequis (une fois, rien n'est ajouté au dépôt) : npm i --no-save --no-package-lock @electric-sql/pglite
//   node tools/essai_sql.mjs            (000_comptes.sql, qui demande l'extension unaccent, est remplacé par un profil minimal)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const DOSSIER = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'sql');
const db = new PGlite();
let echecs = 0;
const ok = (c, t, d) => { console.log(`${c ? '✓' : '✗'} ${t}${!c && d !== undefined ? ' : ' + JSON.stringify(d) : ''}`); if (!c) echecs++; };
const q = async (s, p) => (await db.query(s, p)).rows;
const refus = async (s, p) => { try { await db.query(s, p); return null; } catch (e) { return e.message; } };
// ce que Supabase fournit : le schéma auth, les rôles, les profils (000_comptes demande unaccent : remplacé)
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('essai.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  create table public.profils (id uuid primary key references auth.users (id) on delete cascade, pseudo text, avatar text default 'x', cree_le timestamptz default now());
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
`);
const fichiers = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.sql') && f !== '000_comptes.sql').sort();
for (const f of fichiers) { try { await db.exec(fs.readFileSync(path.join(DOSSIER, f), 'utf8')); ok(true, `${f} passe`); } catch (e) { ok(false, `${f} passe`, e.message); } }
try { await db.exec(fs.readFileSync(path.join(DOSSIER, '070_echanges.sql'), 'utf8')); ok(true, '070_echanges.sql relancé sans danger'); } catch (e) { ok(false, '070 relancé', e.message); }

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
for (const u of [A, B, C]) { await q('insert into auth.users (id) values ($1)', [u]); await q('select public.jeu_nouveau_joueur($1, 1500)', [u]); }
const carte = (id) => ({ id, type: 'adresse', label: 'Lieu ' + id, lon: 2.35, lat: 48.85, citycode: '75109', city: 'Paris', commune: 'Paris 9e' });
await q('select public.jeu_pack($1, 1, $2)', [A, JSON.stringify(['a1', 'a2', 'a3'].map(carte))]);
await q('select public.jeu_pack($1, 1, $2)', [B, JSON.stringify(['b1', 'b2'].map(carte))]);
await q('select public.jeu_pack($1, 1, $2)', [C, JSON.stringify(['c1', 'c2'].map(carte))]);
await q("update public.lieux set niveau = 2 where id = 'a1'");
const pieces = async (u) => Number((await q('select pieces from public.joueurs where id = $1', [u]))[0].pieces);
const proprio = async (l) => (await q('select proprietaire, niveau, prix_vente from public.lieux where id = $1', [l]))[0];
const echanger = (j, l, dons, sup = 0) => q('select public.jeu_echanger($1, $2, $3, $4, $5) as e', [j, l, dons, sup, JSON.stringify(Object.fromEntries(dons.map((d) => [d, 'Lieu ' + d])))]).then((r) => Number(r[0].e));
const echangerRefus = (j, l, dons, sup = 0) => refus('select public.jeu_echanger($1, $2, $3, $4, $5)', [j, l, dons, sup, '{}']);

// proposer
const offreC = Number((await q("select public.jeu_offrir($1, 'a1', 300) as o", [C]))[0].o);
const e1 = await echanger(A, 'b1', ['a1', 'a2', 'a1'], 100);
ok(e1 > 0, 'A propose a1 + a2 + 100 pièces contre b1');
const ligne = (await q('select * from public.echanges where id = $1', [e1]))[0];
ok(ligne.destinataire === B && ligne.donnes.join() === 'a1,a2' && Number(ligne.ajout) === 100 && ligne.statut === 'attente', 'l’échange est noté (doublons retirés, destinataire = B)', ligne);
ok((await echangerRefus(A, 'b1', ['a3'])) === 'deja_echange', 'un deuxième échange pour le même lieu : refusé');
ok((await echangerRefus(A, 'b2', ['a2'])) === 'deja_propose', 'un lieu déjà proposé ailleurs : refusé');
ok((await echangerRefus(A, 'b2', ['b1'])) === 'pas_a_toi', 'donner un lieu qui n’est pas à soi : refusé');
ok((await echangerRefus(A, 'a3', ['a3'])) === 'soi_meme', 'demander son propre lieu : refusé');
ok((await echangerRefus(A, 'zz', ['a3'])) === 'libre', 'demander un lieu libre : refusé');
ok((await echangerRefus(A, 'b2', [])) === 'rien', 'ne rien donner : refusé');
ok((await echangerRefus(A, 'b2', ['a3'], 999999)) === 'fonds', 'plus de pièces qu’on n’en a : refusé');
ok((await echangerRefus(A, 'b2', ['a3'], -5)) === 'prix', 'des pièces négatives : refusé');
const e2 = await echanger(C, 'a1', ['c1']);
ok(e2 > 0, 'C propose c1 contre a1 (déjà proposé par A ailleurs : permis, c’est le lieu de A)');
await q("select public.jeu_vendre($1, 'b1', 5000)", [B]);
const eAutre = await echanger(B, 'c2', ['b1']);
ok(eAutre > 0, 'B propose de son côté b1 contre c2');

// statuts
ok((await refus('select public.jeu_echange_statut($1, $2, $3)', [e1, B, 'annulee'])) === 'echange', 'le destinataire ne peut pas « annuler »');
ok((await refus('select public.jeu_echange_statut($1, $2, $3)', [e1, A, 'refusee'])) === 'echange', 'le proposeur ne peut pas « refuser »');
ok((await refus('select public.jeu_echange_statut($1, $2, $3)', [e1, C, 'caduque'])) === 'echange', 'un autre joueur ne touche pas à l’échange');
ok((await refus('select public.jeu_echange_accepter($1, $2)', [e1, A])) === 'echange', 'le proposeur ne peut pas accepter à la place de l’autre');

// accepter
const [pA, pB] = [await pieces(A), await pieces(B)];
const tombes = (await q('select public.jeu_echange_accepter($1, $2) as t', [e1, B]))[0].t;
const [b1, a1, a2] = [await proprio('b1'), await proprio('a1'), await proprio('a2')];
ok(b1.proprietaire === A && a1.proprietaire === B && a2.proprietaire === B, 'accepté : b1 est à A, a1 et a2 sont à B');
ok(a1.niveau === 2 && b1.prix_vente === null, 'chacun garde les constructions ; plus rien n’est en vente', { a1, b1 });
ok((await pieces(A)) === pA - 100 && (await pieces(B)) === pB + 100, 'les 100 pièces passent de A à B');
const st = async (id) => (await q('select statut from public.echanges where id = $1', [id]))[0].statut;
ok((await st(e1)) === 'acceptee' && (await st(e2)) === 'caduque' && (await st(eAutre)) === 'caduque', 'l’échange est accepté ; ceux de C (a1) et de B (b1) tombent');
ok((await q('select statut from public.offres where id = $1', [offreC]))[0].statut === 'caduque', 'l’offre de C sur a1 tombe');
const t = tombes.map((x) => `${x.type}:${x.joueur.slice(-1)}:${x.lieu}`).sort();
ok(t.join() === ['echange:b:c2', 'echange:c:a1', 'offre:c:a1'].sort().join(), 'ce qui est tombé est rendu (pour prévenir)', t);
ok((await refus('select public.jeu_echange_accepter($1, $2)', [e1, B])) === 'echange', 'accepter deux fois : refusé');
ok((await q('select count(*)::int as n from public.ventes'))[0].n === 0, 'un échange n’est pas une vente (le marché des communes ne bouge pas)');

// refus, annulation, pièces manquantes, lieu parti entre-temps
const e3 = await echanger(A, 'c1', ['b1']);
await q('select public.jeu_echange_statut($1, $2, $3)', [e3, C, 'refusee']); ok((await st(e3)) === 'refusee', 'C refuse');
const e4 = await echanger(A, 'c1', ['b1']);
await q('select public.jeu_echange_statut($1, $2, $3)', [e4, A, 'annulee']); ok((await st(e4)) === 'annulee', 'A annule sa proposition');
const e5 = await echanger(A, 'c1', ['a3'], 1000);
await q('update public.joueurs set pieces = 10 where id = $1', [A]);
ok((await refus('select public.jeu_echange_accepter($1, $2)', [e5, C])) === 'fonds', 'A n’a plus les pièces : refusé');
ok((await proprio('a3')).proprietaire === A && (await proprio('c1')).proprietaire === C && (await st(e5)) === 'attente', '… et rien n’a bougé');
await q('update public.joueurs set pieces = 5000 where id = $1', [A]);
await q("update public.lieux set proprietaire = $1 where id = 'a3'", [B]);
ok((await refus('select public.jeu_echange_accepter($1, $2)', [e5, C])) === 'echange_change', 'un lieu proposé a changé de main : refusé');
await q('select public.jeu_echange_statut($1, $2, $3)', [e5, C, 'caduque']); ok((await st(e5)) === 'caduque', 'l’échange devient caduc');
const e6 = await echanger(A, 'c1', ['b1']);
await q("update public.lieux set proprietaire = $1 where id = 'c1'", [B]);
ok((await refus('select public.jeu_echange_accepter($1, $2)', [e6, C])) === 'plus_a_lui', 'le lieu demandé n’est plus au destinataire : refusé');

// les droits : le jeu lit ses échanges, n'écrit jamais, n'appelle aucune fonction jeu_*
await db.exec(`set role authenticated; set essai.uid = '${A}';`);
const vus = await q('select id from public.echanges');
ok(vus.length > 0 && (await q('select count(*)::int as n from public.echanges where proposeur <> $1 and destinataire <> $1', [A]))[0].n === 0, 'A ne lit que ses échanges', vus.length);
ok(!!(await refus("insert into public.echanges (lieu, proposeur, destinataire, donnes) values ('c2', $1, $2, '{b1}')", [A, C])), 'le jeu ne peut pas écrire un échange');
const avantMaj = (await q('select count(*)::int as n from public.echanges where statut = $1', ['acceptee']))[0].n;
const maj = await refus('update public.echanges set statut = $1', ['acceptee']);
ok(!!maj, 'le jeu ne peut pas changer un échange', maj);
ok(!!(await refus('select public.jeu_echange_accepter($1, $2)', [e6, A])), 'le jeu ne peut pas appeler jeu_echange_accepter');
ok(!!(await refus('select public.jeu_echanger($1, $2, $3, $4, $5)', [A, 'c2', ['b1'], 0, '{}'])), 'le jeu ne peut pas appeler jeu_echanger');
await db.exec('reset role;');
console.log(echecs ? `${echecs} échec(s)` : 'Tout passe.');
process.exit(echecs ? 1 : 0);
