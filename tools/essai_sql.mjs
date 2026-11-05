// Essai des fonctions SQL du serveur (supabase/sql) dans un vrai Postgres, sur le PC, sans toucher au serveur :
// PGlite (Postgres compilé pour Node) rejoue tous les fichiers SQL, puis essaie les échanges (070_echanges.sql) :
// proposer, refuser, annuler, accepter, ce qui tombe ; les enchères (080_encheres.sql) : mise minimale, pièces
// bloquées, surenchère, clôture (avec passage à la mise suivante) ; la caisse de travaux du Maire (090_mairie.sql) :
// verser, part du Maire plafonnée, absence, fin de mandat annoncée une fois ; les classements et les saisons
// (100_classements.sql) : patrimoine, Maires, saison figée une fois ; les monuments (110_monuments.sql) : entretien,
// reprise (lot de reprise, alerte, échanges qui tombent) ; la boutique (120_boutique.sql) : gemmes d'essai, pack acheté,
// Pass, bon ; les ventes et offres en gemmes ; le paiement par carte (130_paiements.sql) ; le classement des pièces (140_classement_pieces.sql) ; le suivi de Gautier (150_suivi.sql) ; l’anti-triche (160_anti_triche.sql) ; le niveau des communes (170_travaux.sql) ; les robots qui se retirent (050_robots.sql) ; les refus attendus et les droits du jeu.
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
const offreC = Number((await q("select public.jeu_offrir($1, 'a1', 300, 'pieces') as o", [C]))[0].o);
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
await q("select public.jeu_vendre($1, 'b1', 5000, 'pieces')", [B]);
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

// les enchères (080_encheres.sql)
try { await db.exec(fs.readFileSync(path.join(DOSSIER, '080_encheres.sql'), 'utf8')); ok(true, '080_encheres.sql relancé sans danger'); } catch (e) { ok(false, '080 relancé', e.message); }
await q('update public.joueurs set pieces = 100000 where id = any($1)', [[A, B, C]]);
const lotDe = (cle, monument, depart) => ({ cle, semaine: 9, rang: Number(cle.split(':')[1]), palier: 'regional', monument, depart, fin: new Date(Date.now() + 600000).toISOString(),
  lieu: { id: 'mon:' + monument, label: 'Monument ' + monument, lon: 2.3, lat: 48.8, citycode: '75107', city: 'Paris 7e', commune: 'Paris 7e', qid: monument } });
const ouvrir = async (lots) => Number((await q('select public.jeu_encheres_ouvrir($1) as n', [JSON.stringify(lots)]))[0].n);
ok((await ouvrir([lotDe('9:0', 'Q1', 5000), lotDe('9:1', 'Q2', 3000), lotDe('9:2', 'Q1', 3000)])) === 2, 'ouvrir les lots : un monument n’est que dans un lot ouvert à la fois');
ok((await ouvrir([lotDe('9:0', 'Q9', 5000)])) === 0, 'rouvrir un lot déjà là : ignoré');
const miser = async (j, c, m) => (await q('select public.jeu_miser($1, $2, $3, 0.05) as r', [j, c, m]))[0].r;
const miserRefus = (j, c, m) => refus('select public.jeu_miser($1, $2, $3, 0.05)', [j, c, m]);
const menees = async (j) => (await q('select public.jeu_menees($1) as r', [j]))[0].r;
ok((await miserRefus(A, '9:0', 4999)) === 'min', 'sous la mise de départ : refusé');
ok((await miser(A, '9:0', 5000)).joueur === null, 'A mise le départ (personne ne menait)');
ok((await miserRefus(B, '9:0', 5249)) === 'min', 'moins de 5 % au-dessus : refusé');
ok((await miser(B, '9:0', 5250)).joueur === A, 'B surenchérit de 5 % : rend A, le meneur d’avant (pour le prévenir)');
await q('update public.joueurs set pieces = 8000 where id = $1', [B]);
ok((await miserRefus(B, '9:1', 3000)) === 'fonds', 'B a 8 000 pièces dont 5 250 bloquées : miser 3 000 ailleurs, refusé');
ok(!!(await miser(B, '9:0', 5600)), 'B relève sa propre mise : sur ce lot, la nouvelle remplace l’ancienne (pas bloquée deux fois)');
ok((await miserRefus(C, 'zz', 5000)) === 'lot', 'un lot qui n’existe pas : refusé');
await miser(C, '9:1', 3000);
const mB = await menees(B), mA = await menees(A);
ok(Number(mB.menees['9:0']) === 5600 && !mB.depasse.length, 'B mène sur 9:0 (5 600 bloquées)', mB);
ok(!Object.keys(mA.menees).length && mA.depasse.join() === '9:0', 'A est dépassé sur 9:0', mA);
ok(Number((await q('select public.jeu_bloque($1, null) as b', [B]))[0].b) === 5600, 'les pièces bloquées de B : 5 600');
ok((await q("select public.jeu_enchere_cloturer('9:0') as r"))[0].r === null, 'un lot pas encore fini ne se clôt pas');
await q("update public.encheres set fin = now() - interval '1 second' where cle in ('9:0', '9:1')");
ok((await miserRefus(A, '9:0', 9000)) === 'close', 'miser après la fin : refusé');
await q('update public.joueurs set pieces = 100 where id = $1', [B]);
const pA0 = await pieces(A), clos = (await q("select public.jeu_enchere_cloturer('9:0') as r"))[0].r;
ok(clos.gagnant === A && Number(clos.prix) === 5000, 'B n’a plus les pièces : le monument passe à A, pour sa mise de 5 000', clos);
const mon = (await q("select proprietaire, type, label, commune, niveau from public.lieux where id = 'mon:Q1'"))[0];
ok(mon && mon.proprietaire === A && mon.type === 'monument' && mon.commune === 'Paris 7e' && mon.niveau === 0, 'A possède le monument', mon);
ok((await pieces(A)) === pA0 - 5000 && (await pieces(B)) === 100, 'A a payé 5 000 ; B n’a rien payé');
ok((await q("select public.jeu_enchere_cloturer('9:0') as r"))[0].r === null, 'clore deux fois : rien ne se passe');
ok((await q("select public.jeu_enchere_cloturer('9:1') as r"))[0].r.gagnant === C, 'le lot 9:1 va à C');
const lot0 = (await q("select statut, gagnant, prix from public.encheres where cle = '9:0'"))[0];
ok(lot0.statut === 'close' && lot0.gagnant === A && Number(lot0.prix) === 5000, 'le lot clos garde son gagnant et son prix', lot0);
ok(!Object.keys((await menees(B)).menees).length, 'après la clôture, plus rien n’est bloqué');
ok((await ouvrir([lotDe('10:0', 'Q1', 1000)])) === 1, 'un monument déjà pris peut revenir dans un lot (la fonction « jeu » l’évite)');
await q('update public.joueurs set pieces = 5000 where id = $1', [B]); await miser(B, '10:0', 1000); await q("update public.encheres set fin = now() - interval '1 second' where cle = '10:0'");
const pB0 = await pieces(B), pris = (await q("select public.jeu_enchere_cloturer('10:0') as r"))[0].r;
ok(pris.gagnant === null && (await pieces(B)) === pB0 && (await q("select proprietaire from public.lieux where id = 'mon:Q1'"))[0].proprietaire === A, 'un monument déjà à quelqu’un : le lot se clôt sans gagnant, personne ne paie', pris);

// ---------------------------------------------------------------- la caisse de travaux (090_mairie.sql)
for (const [id, qui] of [['mai1', A], ['mai2', B]]) await q("insert into public.lieux (id, proprietaire, type, label, lon, lat, commune) values ($1, $2, 'adresse', 'x', 0, 0, 'Bourg')", [id, qui]);
await q('update public.joueurs set pieces = 2000 where id = $1', [A]);
const verser = (j, m, c, montant, pts) => q('select public.jeu_verser($1, $2, $3, $4, $5) as p', [j, m, c, montant, pts]);
ok(Number((await verser(A, 5, 'Bourg', 300, 300))[0].p) === 1700, 'A verse 300 pièces à la caisse de Bourg');
await verser(A, 5, 'Bourg', 100, 50);
const ligneA = (await q("select points, verse from public.caisses where mandat = 5 and commune = 'Bourg' and joueur = $1", [A]))[0];
ok(Number(ligneA.points) === 350 && Number(ligneA.verse) === 400, 'deux versements s’ajoutent (le second, de la dernière heure, à moitié)', ligneA);
ok((await refus('select public.jeu_verser($1, 5, $2, 100, 100)', [C, 'Bourg'])) === 'sans_lieu', 'sans lieu dans la commune, on ne verse pas');
await q('update public.joueurs set pieces = 10 where id = $1', [B]);
ok((await refus('select public.jeu_verser($1, 5, $2, 100, 100)', [B, 'Bourg'])) === 'fonds', 'sans les pièces, on ne verse pas');
ok((await refus('select public.jeu_verser($1, 5, $2, 0, 0)', [A, 'Bourg'])) === 'prix', 'un versement nul est refusé');
let lignes = await q("select * from public.caisse_communes(array['Bourg'], 6, now() - interval '7 days')");
ok(lignes.length === 1 && Number(lignes[0].mandat) === 5 && lignes[0].absent === false, 'la caisse du mandat précédent se lit (A présent)', lignes);
await q("update public.joueurs set vu_le = now() - interval '8 days' where id = $1", [A]);
lignes = await q("select * from public.caisse_communes(array['Bourg'], 6, now() - interval '7 days')");
ok(lignes[0].absent === true, 'A absent depuis 8 jours : marqué absent');
await q('select public.jeu_vu($1)', [A]);
ok((await q("select vu_le > now() - interval '1 minute' as ok from public.joueurs where id = $1", [A]))[0].ok, 'jeu_vu : A est de retour');
const pMaire = await pieces(A), part = async (montant) => Number((await q('select public.jeu_part_maire(6, $1, $2, $3, 1000) as v', ['Bourg', A, montant]))[0].v);
ok((await part(700)) === 700 && (await part(700)) === 300 && (await part(50)) === 0, 'la part du Maire s’arrête au plafond du mandat');
ok((await pieces(A)) === pMaire + 1000, 'le Maire a reçu ses 1 000 pièces');
ok((await q('select public.jeu_mandat_tenir(6) as r'))[0].r === true && (await q('select public.jeu_mandat_tenir(6) as r'))[0].r === false, 'une fin de mandat ne s’annonce qu’une fois');

// ---------------------------------------------------------------- les classements et les saisons (100_classements.sql)
const POIDS = [1, 2, 4, 8, 12, 20], BONUS = [0, 1, 3, 6, 10, 12, 15];
for (const [id, qui, niveau] of [['cl1', A, 1], ['cl2', A, 0], ['cl3', B, 0]]) await q("insert into public.lieux (id, proprietaire, type, label, lon, lat, commune, niveau) values ($1, $2, 'adresse', 'x', 0, 0, 'Classeville', $3)", [id, qui, niveau]);
ok(Number((await q("select public.jeu_raretes(array['cl1','cl2','cl3'], array[4,1,6]::smallint[]) as n"))[0].n) === 3, 'poser la rareté de trois lieux');
const patr = await q("select joueur, n from public.classement_patrimoine($1, $2, 'Classeville', 10)", [POIDS, BONUS]);
ok(patr.length === 2 && patr[0].joueur === B && Number(patr[0].n) === 20 && patr[1].joueur === A && Number(patr[1].n) === (8 + 1) + 1, 'le patrimoine d’une commune : rareté plus bâtiment', patr);
const rangA = (await q("select * from public.rang_patrimoine($1, $2, 'Classeville', $3)", [POIDS, BONUS, A]))[0];
ok(Number(rangA.rang) === 2 && Number(rangA.n) === 10, 'la place de A dans la commune : 2e, 10 points', rangA);
ok((await q('select count(*)::int as n from public.classement_patrimoine($1, $2, null, 100)', [POIDS, BONUS]))[0].n >= 2, 'le classement national se lit');
// le classement des pièces (140_classement_pieces.sql) : seulement les joueurs qui ont un pseudo, à égalité le même rang
for (const [u, ps] of [[A, 'alice'], [B, 'bruno']]) await q('insert into public.profils (id, pseudo) values ($1, $2) on conflict (id) do update set pseudo = excluded.pseudo', [u, ps]);
await q("update public.profils set pseudo = null where id = $1", [C]);
const [piA, piB] = [await pieces(A), await pieces(B)];
const cpi = await q('select joueur, pseudo, n from public.classement_pieces(10)');
ok(cpi.length === 2 && Number(cpi[0].n) === Math.max(piA, piB) && Number(cpi[1].n) === Math.min(piA, piB) && !cpi.some((r) => r.joueur === C), 'le classement des pièces : les plus riches d’abord, sans les joueurs sans pseudo', cpi);
const rpi = (await q('select * from public.rang_pieces($1)', [piA >= piB ? B : A]))[0];
ok(Number(rpi.rang) === (piA === piB ? 1 : 2) && Number(rpi.n) === Math.min(piA, piB), 'la place d’un joueur au classement des pièces', rpi);
// les joueurs de la maison (050_robots.sql, 5 nov.) : combien de vrais joueurs, se retirer, rendre ses lieux libres
const D = '00000000-0000-0000-0000-00000000000d';
await q('insert into auth.users (id) values ($1)', [D]); await q('select public.jeu_nouveau_joueur($1, 1500)', [D]);
await q("insert into public.profils (id, pseudo) values ($1, 'robot-d')", [D]); await q("insert into public.robots (id, nom) values ($1, 'D')", [D]);
await q('select public.jeu_pack($1, 1, $2)', [D, JSON.stringify(['d1', 'd2'].map(carte))]);
const offreD = Number((await q("select public.jeu_offrir($1, 'b2', 100, 'pieces') as o", [D]))[0].o);
ok(Number((await q("select public.jeu_humains_actifs(now() - interval '1 day') as n"))[0].n) === 2, 'les vrais joueurs venus : A et B (pas C sans pseudo, pas le robot D)');
ok(!!(await q('select public.jeu_robot_retraite($1, false) as t', [D]))[0].t, 'le robot D se retire');
ok((await q('select statut from public.offres where id = $1', [offreD]))[0].statut === 'annulee', 'en se retirant, son offre en attente tombe');
ok(Number((await q('select public.jeu_robot_liberer($1) as n', [A]))[0].n) === 0 && !!(await proprio('a2')), 'un vrai joueur ne perd jamais ses lieux ainsi');
ok(Number((await q('select public.jeu_robot_liberer($1) as n', [D]))[0].n) === 2 && !(await proprio('d1')) && !(await proprio('d2')), 'le robot retiré rend ses lieux libres');
ok(!(await q('select public.jeu_robot_retraite($1, true) as t', [D]))[0].t, 'un robot qui revient joue de nouveau');
await q("insert into public.caisses (mandat, commune, joueur, points, verse) values (30, 'Robotville', $1, 500, 500), (30, 'Robotville', $2, 150, 150)", [D, A]);
let cr = await q("select joueur from public.caisse_communes(array['Robotville'], 31, now() - interval '7 days', 100)");
ok(cr.length === 1 && cr[0].joueur === A, 'un vrai joueur a versé le seuil : le robot s’efface de la caisse (il ne prend pas la mairie)', cr);
await q("update public.caisses set points = 50 where commune = 'Robotville' and joueur = $1", [A]);
cr = await q("select joueur from public.caisse_communes(array['Robotville'], 31, now() - interval '7 days', 100)");
ok(cr.length === 2, 'sous le seuil, la caisse montre tout le monde', cr);
ok(Number((await q("select public.jeu_mairies(12, $1::jsonb) as n", [JSON.stringify([{ commune: 'Bourg', maire: A, rivaux: 3 }, { commune: 'Classeville', maire: B, rivaux: 0 }])]))[0].n) === 2, 'garder les Maires d’un mandat');
await q("select public.jeu_mairies(13, $1::jsonb)", [JSON.stringify([{ commune: 'Bourg', maire: B, rivaux: 2 }, { commune: 'Ailleurs', maire: A, rivaux: 1 }])]);
const cm = await q('select joueur, n, mairies from public.classement_maires(12, 17, 10)');
ok(cm.length === 2 && cm[0].joueur === A && Number(cm[0].n) === 4 && Number(cm[0].mairies) === 2 && cm[1].joueur === B && Number(cm[1].n) === 2, 'le classement des Maires : la somme des rivaux (une mairie sans rival ne compte pas)', cm);
ok(Number((await q('select * from public.rang_maires(12, 17, $1)', [B]))[0].rang) === 2, 'la place de B chez les Maires : 2e');
ok(Number((await q('select public.jeu_origine_saisons(40) as s'))[0].s) === 40 && Number((await q('select public.jeu_origine_saisons(41) as s'))[0].s) === 40, 'la première saison est posée une fois');
ok((await q('select public.jeu_saison_tenir(40, 1) as r'))[0].r === true && (await q('select public.jeu_saison_tenir(40, 1) as r'))[0].r === false, 'une saison ne se fige qu’une fois');
await q("select public.jeu_saison_figer(40, $1::jsonb, '[]'::jsonb, $2::jsonb, $3::jsonb)", [JSON.stringify([{ joueur: A, pseudo: 'a', n: 4, rang: 1 }]), JSON.stringify({ Bourg: { joueur: A, pseudo: 'a' } }), JSON.stringify([{ joueur: A, rm: 1, pm: 4, rp: 2, pp: 10 }, { joueur: B, rp: 1, pp: 20 }])]);
const sa = (await q('select numero, maires, plaques from public.saisons where saison = 40'))[0], sj = await q('select joueur, rang_maires, rang_patrimoine from public.saisons_joueurs where saison = 40 order by rang_patrimoine');
ok(sa.numero === 1 && sa.maires[0].joueur === A && sa.plaques.Bourg.joueur === A && sj.length === 2 && sj[0].joueur === B && sj[1].rang_maires === 1, 'la saison figée : podium, plaque, place de chacun', { sa, sj });

// ---------------------------------------------------------------- les monuments (110_monuments.sql)
await q('update public.joueurs set pieces = 1000 where id = $1', [A]);
const le0 = (await q('select entretien_le from public.joueurs where id = $1', [A]))[0].entretien_le;
ok((await q("select public.jeu_entretien($1, $2, now(), 300, 0, null) as r", [A, le0]))[0].r === true && (await pieces(A)) === 700, 'payer l’entretien : 300 pièces');
ok((await q("select public.jeu_entretien($1, $2, now(), 10, 0, null) as r", [A, le0]))[0].r === false, 'payer deux fois le même entretien : refusé');
const le1 = (await q('select entretien_le from public.joueurs where id = $1', [A]))[0].entretien_le;
ok((await q("select public.jeu_entretien($1, $2, now(), 99999, 0, null) as r", [A, le1]))[0].r === false, 'payer plus que ses pièces : refusé');
await q("select public.jeu_entretien($1, $2, now(), 700, 450, now() - interval '2 days')", [A, le1]);
const ja = (await q('select pieces, dette, impaye_depuis from public.joueurs where id = $1', [A]))[0];
ok(Number(ja.pieces) === 0 && Number(ja.dette) === 450 && ja.impaye_depuis !== null, 'ce qui manque devient une dette, l’impayé court', ja);
await q("select public.jeu_averti($1, 'impaye')", [A]); await q("select public.jeu_averti($1, 'absence')", [A]);
await q("update public.joueurs set vu_le = now() - interval '1 hour' where id = $1", [A]); await q('select public.jeu_vu($1)', [A]);
const av = (await q('select averti_impaye, averti_absence from public.joueurs where id = $1', [A]))[0];
ok(av.averti_impaye === true && av.averti_absence === false, 'un avertissement n’est donné qu’une fois ; revenir efface celui de l’absence', av);
await q("insert into public.lieux (id, proprietaire, type, label, lon, lat, commune) values ('mon:QX', $1, 'monument', 'Le Monument', 0, 0, 'Bourg')", [A]);
const [{ id: echX }] = await q("insert into public.echanges (lieu, proposeur, destinataire, donnes) values ('cl3', $1, $2, '{mon:QX}') returning id", [A, B]);
const lotX = { cle: '77:R:QX:1', semaine: 77, rang: 10, palier: 'regional', monument: 'QX', lieu: { id: 'mon:QX', label: 'Le Monument' }, depart: 1000, fin: new Date(Date.now() + 86400000).toISOString() };
const alerteX = { type: 'impaye', monument: 'QX', nom: 'Le Monument', commune: 'Bourg', fin_enchere: lotX.fin, texte: 'à poster' };
const ancien = (await q('select public.jeu_monument_reprendre($1, $2, $3::jsonb, $4::jsonb) as p', ['mon:QX', 'impaye', JSON.stringify(lotX), JSON.stringify(alerteX)]))[0].p;
ok(ancien === A && (await q("select count(*)::int as n from public.lieux where id = 'mon:QX'"))[0].n === 0, 'reprendre un monument : il n’est plus à A');
ok((await q('select statut from public.echanges where id = $1', [echX]))[0].statut === 'caduque', 'l’échange qui le donnait tombe');
ok((await q("select rang, statut from public.encheres where cle = '77:R:QX:1'"))[0].rang === 10, 'il attend aux enchères, dans un lot de reprise');
ok((await q("select count(*)::int as n from public.alertes where monument = 'QX' and texte = 'à poster'"))[0].n === 1, 'Gautier a son alerte');
ok(Number((await q('select dette from public.joueurs where id = $1', [A]))[0].dette) === 0, 'après un impayé, la dette repart à zéro');
ok((await q("select public.jeu_monument_reprendre('cl1', 'absence', null, null) as p"))[0].p === null && (await q("select count(*)::int as n from public.lieux where id = 'cl1'"))[0].n === 1, 'une adresse n’est jamais reprise');

// ---------------------------------------------------------------- la boutique (120_boutique.sql)
const gemmes = async (u) => Number((await q('select gemmes from public.joueurs where id = $1', [u]))[0].gemmes);
ok(Number((await q('select public.jeu_gemmes_essai($1, 1000) as g', [C]))[0].g) === 1000, 'des gemmes d’essai sur le serveur accéléré');
const carteBq = (id) => ({ id, type: 'adresse', label: 'x ' + id, lon: 1, lat: 47, citycode: '37261', city: 'Tours', commune: 'Tours', rarete: 1 });
ok((await refus('select public.jeu_pack_achete($1, $2, 5000, $3::jsonb)', [C, 'pack_national', JSON.stringify([carteBq('bq1')])])) === 'gemmes' && (await q("select count(*)::int as n from public.lieux where id = 'bq1'"))[0].n === 0, 'pas assez de gemmes : ni lieu, ni paiement');
const pa = (await q('select public.jeu_pack_achete($1, $2, 200, $3::jsonb) as g', [C, 'pack_national', JSON.stringify([carteBq('bq1'), carteBq('bq2'), carteBq('cl1')])]))[0].g;
ok(pa.length === 2 && (await gemmes(C)) === 800, 'un pack acheté : les lieux libres sont à lui, 200 gemmes payées (un lieu déjà pris est ignoré)', pa);
ok((await refus('select public.jeu_pack_achete($1, $2, 200, $3::jsonb)', [C, 'pack_national', JSON.stringify([carteBq('bq1')])])) === 'vide' && (await gemmes(C)) === 800, 'aucun lieu donné : rien n’est payé');
ok((await refus("select public.jeu_bon($1, $2::jsonb)", [C, JSON.stringify(carteBq('bq3'))])) === 'bon', 'sans Pass, pas de bon');
await q("select public.jeu_pass($1, 300, null, now() + interval '15 days', 1::smallint)", [C]);
ok((await gemmes(C)) === 500 && (await q('select bons from public.joueurs where id = $1', [C]))[0].bons === 1, 'le Pass : 300 gemmes, un bon');
ok(!!(await refus("select public.jeu_pass($1, 300, null, now() + interval '30 days', 2::smallint)", [C])), 'acheter deux fois le même Pass en même temps : refusé');
ok((await refus("select public.jeu_bon($1, $2::jsonb)", [C, JSON.stringify(carteBq('bq1'))])) === 'pris' && (await q('select bons from public.joueurs where id = $1', [C]))[0].bons === 1, 'une adresse déjà prise : le bon reste');
await q("select public.jeu_bon($1, $2::jsonb)", [C, JSON.stringify(carteBq('bq3'))]);
ok((await q("select proprietaire from public.lieux where id = 'bq3'"))[0].proprietaire === C && (await q('select bons from public.joueurs where id = $1', [C]))[0].bons === 0, 'le bon prend l’adresse');
ok((await q('select count(*)::int as n from public.gemmes_journal where joueur = $1', [C]))[0].n === 3, 'chaque mouvement de gemmes est écrit dans le journal');
await q("update public.reglages set valeur = '86400' where cle = 'jour_secondes'");
ok((await refus('select public.jeu_gemmes_essai($1, 1000)', [C])) === 'essai', 'pas de gemmes d’essai sur le vrai jeu (24 h)');
await q("update public.reglages set valeur = '60' where cle = 'jour_secondes'");

// ---------------------------------------------------------------- vendre et offrir en gemmes (GDD § 9)
await q("select public.jeu_vendre($1, 'bq2', 120, 'gemmes')", [C]);
ok((await q("select devise_vente from public.lieux where id = 'bq2'"))[0].devise_vente === 'gemmes', 'mettre en vente en gemmes');
ok(!!(await refus("select public.jeu_vendre($1, 'bq2', 120, 'dollars')", [C])), 'une monnaie inconnue : refusé');
const transf = (acheteur, attendu, devise) => q("select public.jeu_transferer('bq2', $1, $2, 120, $3, null, 1000, $4) as p", [C, acheteur, attendu, devise]);
await q('update public.joueurs set gemmes = 10 where id = $1', [A]);
ok((await refus("select public.jeu_transferer('bq2', $1, $2, 120, 120, null, 1000, 'gemmes')", [C, A])) === 'gemmes', 'acheter en gemmes sans assez de gemmes : refusé');
ok((await refus("select public.jeu_transferer('bq2', $1, $2, 120, 120, null, 1000, 'pieces')", [C, A])) === 'prix_change', 'payer en pièces une vente en gemmes : refusé');
await q('update public.joueurs set gemmes = 200 where id = $1', [A]);
const gC0 = await gemmes(C), piecesA0 = await pieces(A); await transf(A, 120, 'gemmes');
ok((await gemmes(A)) === 80 && (await gemmes(C)) === gC0 + 120 && (await pieces(A)) === piecesA0 && (await q("select proprietaire from public.lieux where id = 'bq2'"))[0].proprietaire === A, 'acheter en gemmes : les gemmes passent, pas les pièces, le lieu change de main');
ok((await q("select devise from public.ventes where lieu = 'bq2' order by le desc limit 1"))[0].devise === 'gemmes' && (await q("select count(*)::int as n from public.marche_communes(array['Tours'], now() - interval '1 day')"))[0].n === 0, 'une vente en gemmes ne compte pas dans le marché de la commune');
ok((await q("select count(*)::int as n from public.gemmes_journal where motif in ('achat_lieu', 'vente_lieu')"))[0].n === 2, 'les gemmes d’une vente sont journalisées');
const offreG = Number((await q("select public.jeu_offrir($1, 'bq1', 30, 'gemmes') as o", [A]))[0].o);
ok((await q('select devise, prix from public.offres where id = $1', [offreG]))[0].devise === 'gemmes', 'une offre en gemmes');

// ---------------------------------------------------------------- le paiement par carte (130_paiements.sql)
await q("select public.jeu_paiement_noter('cs_1', $1, 'g500', 500, 499, true, true)", [B]);
await q("select public.jeu_paiement_noter('cs_1', $1, 'g500', 500, 499, true, true)", [B]);
ok((await q("select count(*)::int as n from public.paiements where session = 'cs_1'"))[0].n === 1, 'une session notée une fois');
const gB0 = await gemmes(B);
ok(Number((await q("select public.jeu_paiement_crediter('cs_1', 'FR') as g"))[0].g) === 500 && (await gemmes(B)) === gB0 + 500, 'une session payée : 500 gemmes');
ok(Number((await q("select public.jeu_paiement_crediter('cs_1', 'FR') as g"))[0].g) === 0 && (await gemmes(B)) === gB0 + 500, 'vérifiée deux fois : créditée une seule fois');
ok((await q("select motif from public.gemmes_journal where joueur = $1 and delta = 500 order by id desc limit 1", [B]))[0].motif === 'stripe_test', 'le journal dit « stripe_test » (clé de test)');
await q("select public.jeu_paiement_noter('cs_2', $1, 'g1200', 1200, 999, true, false)", [B]); await q("select public.jeu_paiement_expirer('cs_2')");
ok(Number((await q("select public.jeu_paiement_crediter('cs_2', 'FR') as g"))[0].g) === 0 && (await q("select statut from public.paiements where session = 'cs_2'"))[0].statut === 'expire', 'une session expirée ne crédite rien');

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
ok((await q('select count(*)::int as n from public.mises'))[0].n > 0 && (await q('select count(*)::int as n from public.encheres'))[0].n > 0, 'le jeu lit les lots et les mises de tous');
ok(!!(await refus("insert into public.mises (lot, joueur, montant) values ('9:1', $1, 999999)", [A])), 'le jeu ne peut pas écrire une mise');
ok(!!(await refus("update public.encheres set gagnant = $1", [A])), 'le jeu ne peut pas se donner un lot');
ok(!!(await refus('select public.jeu_miser($1, $2, $3, 0.05)', [A, '9:1', 1])), 'le jeu ne peut pas appeler jeu_miser');
ok(!!(await refus("select public.jeu_enchere_cloturer('9:1')")), 'le jeu ne peut pas appeler jeu_enchere_cloturer');
ok((await q('select count(*)::int as n from public.caisses'))[0].n > 0 && (await q('select count(*)::int as n from public.parts_maire'))[0].n > 0, 'le jeu lit les caisses et les parts des Maires');
ok(!!(await refus("insert into public.caisses (mandat, commune, joueur, points) values (6, 'Bourg', $1, 99999)", [A])), 'le jeu ne peut pas écrire dans une caisse');
ok(!!(await refus("update public.parts_maire set touche = 0")), 'le jeu ne peut pas changer une part de Maire');
ok(!!(await refus('select public.jeu_verser($1, 6, $2, 10, 99999)', [A, 'Bourg'])), 'le jeu ne peut pas appeler jeu_verser');
ok(!!(await refus('select public.jeu_part_maire(6, $1, $2, 1000, 1000)', ['Bourg', A])), 'le jeu ne peut pas appeler jeu_part_maire');
ok(!!(await refus('select * from public.mandats_tenus')), 'le jeu ne lit pas les mandats annoncés');
ok((await q('select count(*)::int as n from public.mairies'))[0].n > 0 && (await q('select count(*)::int as n from public.saisons'))[0].n > 0, 'le jeu lit les Maires de chaque mandat et les saisons');
ok(!!(await refus("insert into public.mairies (mandat, commune, maire, rivaux) values (99, 'x', $1, 999)", [A])), 'le jeu ne peut pas se donner une mairie');
ok(!!(await refus("update public.saisons_joueurs set rang_maires = 1")), 'le jeu ne peut pas changer son classement');
ok(!!(await refus("update public.lieux set rarete = 6 where id = 'cl2'")), 'le jeu ne peut pas changer la rareté d’un lieu');
ok(!!(await refus("select public.jeu_raretes(array['cl2'], array[6]::smallint[])")), 'le jeu ne peut pas appeler jeu_raretes');
ok(!!(await refus("select public.jeu_saison_figer(41, '[]', '[]', '{}', '[]')")), 'le jeu ne peut pas appeler jeu_saison_figer');
ok(!!(await refus('select count(*) from public.alertes')), 'le jeu ne lit pas les alertes de Gautier');
ok(!!(await refus("select public.jeu_monument_reprendre('cl3', 'absence', null, null)")), 'le jeu ne peut pas appeler jeu_monument_reprendre');
ok(!!(await refus('select public.jeu_entretien($1, now(), now(), 0, 0, null)', [A])), 'le jeu ne peut pas appeler jeu_entretien');
ok(!!(await refus("update public.joueurs set dette = 0")), 'le jeu ne peut pas effacer sa dette');
ok(!!(await refus("update public.joueurs set gemmes = 999999")), 'le jeu ne peut pas se donner des gemmes');
ok(!!(await refus('select public.jeu_gemmes_essai($1, 1000)', [A])), 'le jeu ne peut pas appeler jeu_gemmes_essai');
ok(!!(await refus('select public.jeu_robot_liberer($1)', [A])) && !!(await refus("select public.jeu_humains_actifs(now())")) && !!(await refus('select public.jeu_robot_retraite($1, false)', [A])), 'le jeu ne peut pas appeler les fonctions des robots');
ok(!!(await refus("insert into public.gemmes_journal (joueur, delta, motif) values ($1, 1000, 'x')", [A])), 'le jeu ne peut pas écrire dans le journal des gemmes');
ok(!!(await refus("select public.jeu_paiement_crediter('cs_1', 'FR')")), 'le jeu ne peut pas se créditer un paiement');
ok(!!(await refus("insert into public.paiements (session, joueur, offre, gemmes, centimes) values ('cs_x', $1, 'g500', 999999, 1)", [A])), 'le jeu ne peut pas écrire un paiement');
// supprimer son compte (RGPD, 5 nov. ; la fonction « jeu » efface le compte de auth.users) : tout part avec lui, ses lieux redeviennent libres
await db.exec('reset role;');
const E = '00000000-0000-0000-0000-00000000000e';
await q('insert into auth.users (id) values ($1)', [E]); await q('select public.jeu_nouveau_joueur($1, 1500)', [E]);
await q("insert into public.profils (id, pseudo) values ($1, 'eve')", [E]);
await q('select public.jeu_pack($1, 1, $2)', [E, JSON.stringify(['e1', 'e2'].map(carte))]);
await q("select public.jeu_offrir($1, 'b1', 100, 'pieces')", [E]);
await q('delete from auth.users where id = $1', [E]);
ok(!(await proprio('e1')) && !(await proprio('e2')) && (await q('select count(*)::int as n from public.joueurs where id = $1', [E]))[0].n === 0
   && (await q('select count(*)::int as n from public.profils where id = $1', [E]))[0].n === 0 && (await q('select count(*)::int as n from public.offres where acheteur = $1', [E]))[0].n === 0,
   'un compte supprimé emporte sa partie, son pseudo et ses offres ; ses lieux redeviennent libres');
// le suivi de Gautier (150_suivi.sql) : un jour de visite par vrai joueur (jamais un robot), les retours du lendemain et du 7e jour
const S1 = '00000000-0000-0000-0000-000000000051', S2 = '00000000-0000-0000-0000-000000000052';
for (const [u, ps] of [[S1, 'sacha'], [S2, 'samy']]) { await q('insert into auth.users (id) values ($1)', [u]); await q('select public.jeu_nouveau_joueur($1, 1500)', [u]);
  await q("insert into public.profils (id, pseudo, cree_le) values ($1, $2, now() - interval '8 days')", [u, ps]); }
// sacha : inscrit il y a 8 jours, revenu le lendemain et le 7e jour ; samy : jamais revenu
await q('insert into public.visites (joueur, jour) values ($1, public.jour_paris() - 8), ($1, public.jour_paris() - 7), ($1, public.jour_paris() - 1), ($2, public.jour_paris() - 8)', [S1, S2]);
await q('select public.jeu_vu($1)', [S1]); await q('select public.jeu_vu($1)', [S1]); await q('select public.jeu_vu($1)', [D]);
ok((await q('select count(*)::int as n from public.visites where joueur = $1 and jour = public.jour_paris()', [S1]))[0].n === 1, 'une visite notée une seule fois par jour');
ok((await q('select count(*)::int as n from public.visites where joueur = $1', [D]))[0].n === 0, 'un robot n’est jamais compté dans les visites');
const j8 = (await q('select * from public.suivi_jours where jour = public.jour_paris() - 8'))[0];
ok(Number(j8.inscrits) === 2 && Number(j8.venus) === 2 && Number(j8.revenus_j1) === 1 && Number(j8.revenus_j7) === 1, 'suivi_jours : 2 inscrits il y a 8 jours, 1 revenu le lendemain, 1 le 7e jour', j8);
const auj = (await q('select * from public.suivi_jours where jour = public.jour_paris()'))[0];
ok(auj && auj.revenus_j1 === null && auj.revenus_j7 === null, 'suivi_jours : les retours d’aujourd’hui restent vides (le lendemain n’est pas arrivé)', auj);
ok((await q('select count(*)::int as n from public.suivi_inscrits where id = $1', [D]))[0].n === 0, 'un robot n’est pas compté parmi les inscrits');
const tot = (await q('select * from public.suivi_total'))[0];
ok(Number(tot.pct_retour_j1) === 50 && Number(tot.pct_retour_j7) === 50 && Number(tot.venus_aujourdhui) >= 1, 'suivi_total : 50 % de retour le lendemain et le 7e jour', tot);
await q('delete from auth.users where id = $1', [S2]);
ok((await q('select count(*)::int as n from public.visites where joueur = $1', [S2]))[0].n === 0, 'un compte supprimé emporte ses visites');
// l'anti-triche (160_anti_triche.sql) : la cadence des actions, les empreintes de connexion, les comptes liés
const cad = async (u, lim) => (await q('select public.jeu_cadence($1, $2) as c', [u, lim]))[0].c;
const cads = [await cad(A, 3), await cad(A, 3), await cad(A, 3), await cad(A, 3)];
ok(cads.join() === 'true,true,true,false', 'la cadence : 3 actions par minute passent, la 4e est refusée', cads);
await q("update public.cadence set minute = minute - interval '1 minute' where joueur = $1", [A]);
ok((await cad(A, 3)) === true && Number((await q('select n from public.cadence where joueur = $1', [A]))[0].n) === 1, 'la minute suivante, le compteur repart de zéro');
const emp = async (u, e) => Number((await q('select public.jeu_empreinte($1, $2, 3, 30) as k', [u, e]))[0].k);
const alertesAvant = (await q("select count(*)::int as n from public.alertes where type = 'comptes'"))[0].n;
await q("insert into public.empreintes (joueur, jour, empreinte) values ($1, public.jour_paris() - 40, 'vieille')", [B]);
const ks = [await emp(A, 'e1'), await emp(D, 'e1'), await emp(B, 'e1'), await emp(A, 'e1')];
ok(ks.join() === '1,1,2,0', 'les empreintes : un compte de plus à chaque joueur, jamais un robot ; déjà notée : 0', ks);
ok((await q("select count(*)::int as n from public.alertes where type = 'comptes'"))[0].n === alertesAvant, 'deux comptes sur une connexion : pas d’alerte');
ok((await emp(S1, 'e1')) === 3, 'un troisième compte sur la même connexion');
const al = await q("select texte from public.alertes where type = 'comptes' order by id desc");
ok(al.length === alertesAvant + 1 && /3 comptes depuis la même connexion/.test(al[0].texte) && /alice, bruno, sacha/.test(al[0].texte), 'au troisième, une alerte pour Gautier (avec les pseudos)', al[0]);
ok((await q("select count(*)::int as n from public.empreintes where empreinte = 'vieille'"))[0].n === 0, 'les empreintes de plus de 30 jours sont effacées');
// le niveau des communes (170_travaux.sql) : tout ce qui a été versé depuis toujours, même après le départ d'un joueur
const travaux = async (c) => Number(((await q('select total from public.travaux where commune = $1', [c]))[0] || { total: -1 }).total);
const verseBourg = Number((await q("select sum(verse) as s from public.caisses where commune = 'Bourg'"))[0].s);
ok((await travaux('Bourg')) === verseBourg && verseBourg > 0, 'les travaux de Bourg : tout ce qui a été versé à sa caisse', [await travaux('Bourg'), verseBourg]);
const T0 = '00000000-0000-0000-0000-000000000070';
await q('insert into auth.users (id) values ($1)', [T0]); await q('select public.jeu_nouveau_joueur($1, 1500)', [T0]);
await q("insert into public.lieux (id, proprietaire, type, label, lon, lat, commune) values ('trav1', $1, 'adresse', 'x', 0, 0, 'Bourg'), ('trav2', $1, 'adresse', 'x', 0, 0, 'Village')", [T0]);
await verser(T0, 7, 'Bourg', 120, 120); await verser(T0, 7, 'Bourg', 30, 30); await verser(T0, 8, 'Village', 50, 50);
ok((await travaux('Bourg')) === verseBourg + 150 && (await travaux('Village')) === 50, 'chaque versement s’ajoute aux travaux de sa commune (nouvelle ligne de caisse ou ligne qui monte)');
await q('delete from auth.users where id = $1', [T0]);
ok((await travaux('Bourg')) === verseBourg + 150 && (await travaux('Village')) === 50, 'les travaux faits restent faits : le départ d’un joueur ne les retire pas');
await db.exec('reset role;');
await db.exec(fs.readFileSync(path.join(DOSSIER, '170_travaux.sql'), 'utf8'));
ok((await travaux('Bourg')) === verseBourg + 150, '170_travaux.sql relancé : rien n’est compté deux fois');
const lies = await q("select * from public.comptes_lies");
ok(lies.length === 1 && Number(lies[0].comptes) === 3 && lies[0].pseudos === 'alice, bruno, sacha', 'comptes_lies : les trois comptes de la même connexion, sans le robot', lies);
await db.exec(`set role authenticated; set essai.uid = '${A}';`);
ok(!!(await refus('select * from public.suivi_total')) && !!(await refus('select * from public.suivi_jours')) && !!(await refus('select * from public.visites')), 'le jeu ne lit pas le suivi de Gautier');
ok(!!(await refus('select public.jeu_vu($1)', [A])), 'le jeu ne peut pas appeler jeu_vu');
ok(!!(await refus('select * from public.empreintes')) && !!(await refus('select * from public.comptes_lies')) && !!(await refus('select * from public.cadence')), 'le jeu ne lit ni les empreintes, ni les comptes liés, ni la cadence');
ok(!!(await refus('select public.jeu_cadence($1, 999)', [A])) && !!(await refus("select public.jeu_empreinte($1, 'x', 3, 30)", [A])), 'le jeu ne peut pas appeler jeu_cadence ni jeu_empreinte');
ok(Number((await q("select total from public.travaux where commune = 'Bourg'"))[0].total) > 0 && !!(await refus("update public.travaux set total = 999999")) && !!(await refus("insert into public.travaux (commune, total) values ('Triche', 999999)")), 'le jeu lit les travaux des communes, sans pouvoir les écrire');
await db.exec('reset role; set role anon;');
ok(!!(await refus('select * from public.suivi_total')), 'sans compte non plus');
ok((await q("select count(*)::int as n from public.caisse_communes(array['Bourg'], 6, now() - interval '7 days')"))[0].n > 0, 'sans compte aussi, on lit les caisses');
ok((await q('select count(*)::int as n from public.encheres'))[0].n > 0, 'sans compte aussi, on lit les lots');
ok(!!(await refus('select * from public.robots')), 'personne ne peut lire la liste des robots (ils sont cachés parmi les joueurs)');
ok((await q('select count(*)::int as n from public.classement_pieces(5)'))[0].n > 0 && !!(await refus('select pieces from public.joueurs')), 'sans compte aussi, on lit le classement des pièces, mais pas les pièces de chacun');
await db.exec('reset role;');
console.log(echecs ? `${echecs} échec(s)` : 'Tout passe.');
process.exit(echecs ? 1 : 0);
