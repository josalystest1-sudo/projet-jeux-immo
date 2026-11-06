// Les fonctions qui se débloquent en jouant (src/regles/deblocages.js, ECO.deblocages, GDD § 7).
const test = require('node:test'); const assert = require('node:assert');
const Deblocages = require('../src/regles/deblocages.js'); const eco = require('../data/economie.json');
const DEB = Deblocages.creer(eco);

test('un nouveau joueur : tout est fermé, sauf ce que les réglages ne connaissent pas', () => {
  const faits = { packs: 0, lieux: 0, constructions: 0, pieces: 1500 };
  assert.deepEqual(DEB.nouveaux({}, faits), []);
  for (const k of ['carte', 'patrimoine', 'communes', 'encheres', 'chasse']) assert.equal(DEB.ouvert({}, k), false, k);
  assert.equal(DEB.ouvert({}, 'accueil'), true); assert.equal(DEB.ouvert({}, 'profil'), true);
});

test('le premier pack ouvre la carte et la collection, sans fête (le premier pack est guidé)', () => {
  const n = DEB.nouveaux({}, { packs: 1, lieux: 5, constructions: 0, pieces: 1500 });
  assert.deepEqual(n.sort(), ['carte', 'patrimoine']);
  assert.ok(DEB.silencieux('carte') && DEB.silencieux('patrimoine')); assert.ok(!DEB.silencieux('communes'));
});

test('selon les actions : construire ouvre les communes ; le 2e pack la chasse ; 5 000 pièces ou le 4e pack les enchères', () => {
  const deja = { carte: 1, patrimoine: 1 };
  assert.deepEqual(DEB.nouveaux(deja, { packs: 1, constructions: 1, pieces: 200 }), ['communes']);
  assert.deepEqual(DEB.nouveaux(deja, { packs: 2, constructions: 0, pieces: 200 }), ['chasse']);
  assert.deepEqual(DEB.nouveaux(deja, { packs: 1, pieces: 5000 }), ['encheres']);
  assert.ok(DEB.nouveaux(deja, { packs: 4, pieces: 0 }).includes('encheres'));
  assert.ok(!DEB.nouveaux(deja, { packs: 3, pieces: 4999 }).includes('encheres'));
});

test('une fonction ouverte le reste, même si la condition ne tient plus (pièces dépensées)', () => {
  const deja = { carte: 1, patrimoine: 1, encheres: Date.now() };
  assert.equal(DEB.ouvert(deja, 'encheres'), true);
  assert.ok(!DEB.nouveaux(deja, { packs: 1, pieces: 0 }).includes('encheres'));
});

test('ce qu’il reste à faire, pour l’écran du cadenas', () => {
  assert.deepEqual(DEB.reste('communes', { constructions: 0 }), [{ fait: 'constructions', faut: 1, a: 0, ou: false }]);
  const r = DEB.reste('encheres', { pieces: 1200, packs: 2 });
  assert.deepEqual(r.map((x) => [x.fait, x.a, x.faut, x.ou]), [['pieces', 1200, 5000, true], ['packs', 2, 4, true]]);
  assert.deepEqual(DEB.reste('encheres', { pieces: 9000 }), [], 'rien à faire quand une alternative tient');
  assert.deepEqual(DEB.reste('accueil', {}), []);
});

test('les packs d’un joueur installé sur un autre téléphone : au moins un pack pour 5 lieux', () => {
  assert.equal(DEB.packsAuMoins(0, 0), 0); assert.equal(DEB.packsAuMoins(0, 1), 1); assert.equal(DEB.packsAuMoins(0, 23), 5);
  assert.equal(DEB.packsAuMoins(7, 5), 7);
  // un joueur de la première heure (30 lieux, des constructions) retrouve tout
  const faits = { packs: DEB.packsAuMoins(0, 30), lieux: 30, constructions: 4, pieces: 800 };
  assert.deepEqual(DEB.nouveaux({}, faits).sort(), ['carte', 'chasse', 'communes', 'encheres', 'patrimoine']);
});
