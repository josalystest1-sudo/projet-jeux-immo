// Le serveur applique les mêmes règles que le jeu, et ses fonctions SQL ne sont jamais appelables depuis le jeu.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path'); const { pathToFileURL } = require('url');
const { preparer } = require('../tools/serveur_prepare.js');
const eco = require('../data/economie.json'); const table = require('../data/standing.json');
const R = require('../src/regles/lieu.js').creer(eco, table);

test('la fonction « jeu » reçoit les règles et les données du jeu (modules ES)', async () => {
  const dossier = preparer(fs.mkdtempSync(path.join(os.tmpdir(), 'jeu-')));
  const { Regles, Pack, Encheres, Celebres, Mairie, Classements, Monuments } = await import(pathToFileURL(path.join(dossier, 'regles.mjs')).href);
  const { ECO, STANDING, MONUMENTS } = await import(pathToFileURL(path.join(dossier, 'donnees.mjs')).href);
  assert.ok(Pack && Encheres && Celebres && Mairie && Classements && Monuments); assert.equal(Monuments.creer(ECO).prochain([]), 300); assert.equal(Classements.creer(ECO).pointsLieu(6, 6), 35); assert.deepEqual(Mairie.creer(ECO).elire({ a: 300, b: 120 }).maires, ['a']); assert.equal(MONUMENTS.length, require('../data/monuments.json').length);
  const S = Regles.creer(ECO, STANDING);
  const lieux = [{ type: 'adresse', citycode: '28105' }, { type: 'adresse', citycode: '21231' }, { type: 'lieu', citycode: '28105' },
    { type: 'adresse', citycode: '75109', niveau: 2 }, { type: 'lieu', notoriete: 'celebre', citycode: '28105' }, { type: 'monument', citycode: '75107', niveau: 5 }];
  for (const l of lieux) {
    assert.equal(S.rarete(l), R.rarete(l)); assert.equal(S.plafond(l), R.plafond(l)); assert.equal(S.valeur(l), R.valeur(l));
    for (let n = 1; n < R.NIVEAUX.length; n++) assert.equal(S.coutNiveau(l, n), R.coutNiveau(l, n));
  }
  assert.equal(S.aEncaisser(lieux, 0, 86400000, 86400000), R.aEncaisser(lieux, 0, 86400000, 86400000));
});

test('les fonctions SQL du jeu sont réservées au serveur ; le jeu ne peut écrire dans aucune table', () => {
  const sql = fs.readdirSync(path.join(__dirname, '../supabase/sql')).filter((f) => f.endsWith('.sql')).map((f) => fs.readFileSync(path.join(__dirname, '../supabase/sql', f), 'utf8')).join('\n');
  const fonctions = [...sql.matchAll(/create or replace function public\.(jeu_\w+)\(([^)]*)\)/g)];
  assert.ok(fonctions.length >= 3);
  for (const [, nom] of fonctions) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${nom}\\([^)]*\\) from public, anon, authenticated`), `${nom} : retirée au jeu`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${nom}\\([^)]*\\) to service_role`), `${nom} : donnée au serveur`);
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${nom}\\([^)]*\\) to [^;]*(anon|authenticated)`), `${nom} : jamais au jeu`);
  }
  for (const table of ['joueurs', 'lieux', 'offres', 'echanges', 'encheres', 'mises', 'caisses', 'parts_maire', 'mandats_tenus', 'mairies', 'saisons', 'saisons_joueurs', 'alertes']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(sql, new RegExp(`grant [^;]*(insert|update|delete)[^;]* on public\\.${table} to`), `${table} : aucune écriture donnée au jeu`);
  }
});
