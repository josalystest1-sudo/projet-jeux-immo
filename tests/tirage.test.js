// Le tirage d'un pack (src/tirage.js), partagé par le jeu et le serveur : géocodeur simulé.
const test = require('node:test'); const assert = require('node:assert');
const Tirage = require('../src/tirage.js'); const Pack = require('../src/regles/pack.js'); const Celebres = require('../src/regles/celebres.js');
const eco = require('../data/economie.json'); const table = require('../data/standing.json'); const R = require('../src/regles/lieu.js').creer(eco, table);
const FRANCE = [[[-5, 41], [10, 41], [10, 51.5], [-5, 51.5], [-5, 41]]];
// un géocodeur qui rend toujours une adresse différente d'un village au standing 1 (Clévilliers, 28105)
function geocodeur() { let n = 0; return async (chemin) => { n++; return { features: [{ geometry: { coordinates: [1.3, 48.5] }, properties: { id: '28105_x_' + n, name: n + ' Rue Essai', citycode: '28105', city: 'Clévilliers', postcode: '28300' } }] }; }; }
const creer = (estLibre) => Tirage.creer({ geoJSON: geocodeur(), celebres: async () => [], france: FRANCE, deps: ['28'], standing: table, Celebres, Pack, rarete: R.rarete, estLibre });

test('un pack de cinq Communs, tous différents, tous libres', async () => {
  const cartes = await creer(() => true).tirerPack('essai', { 1: 100 }, 5);
  assert.equal(cartes.length, 5); assert.equal(new Set(cartes.map((c) => c.id)).size, 5);
  for (const c of cartes) { assert.equal(R.rarete(c), 1); assert.equal(c.type, 'adresse'); }
});
test('un lieu déjà possédé n’est jamais tiré (le serveur répond « pas libre »)', async () => {
  const cartes = await creer(async () => false).tirerPack('essai', { 1: 100 }, 5);
  assert.equal(cartes.length, 0);
});
test('une rareté introuvable devient une Commune (le pack garde ses cartes)', async () => {
  const cartes = await creer(() => true).tirerPack('essai', { 2: 100 }, 3);   // aucune adresse au standing 2 dans ce faux monde
  assert.equal(cartes.length, 3); for (const c of cartes) assert.equal(R.rarete(c), 1);
});
test('le pack régional : toutes les cartes dans la région, jamais ailleurs', async () => {
  const zone = (deps) => Tirage.creer({ geoJSON: geocodeur(), celebres: async () => [], france: FRANCE, deps: ['28', '37'], contours: { 28: FRANCE, 37: FRANCE }, standing: table, Celebres, Pack, rarete: R.rarete, estLibre: () => true });
  const dans = await zone().tirerPack('essai', { 1: 100 }, 5, { deps: ['28'] });
  assert.equal(dans.length, 5); for (const c of dans) assert.ok(c.citycode.startsWith('28'));
  const ailleurs = await zone().tirerPack('essai', { 1: 100 }, 5, { deps: ['37'] });   // le faux géocodeur ne rend que l'Eure-et-Loir
  assert.equal(ailleurs.length, 0);
});
test('même graine, mêmes raretés tirées', () => {
  const a = Pack.raretes(5, eco.pack.chances, Pack.alea(Pack.graine('x:1'))), b = Pack.raretes(5, eco.pack.chances, Pack.alea(Pack.graine('x:1')));
  assert.deepEqual(a, b);
});
