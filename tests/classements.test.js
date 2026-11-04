// Les classements et les saisons (src/regles/classements.js, GDD § 5 bis).
const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const C = require('../src/regles/classements.js').creer(ECO);
const M = require('../src/regles/mairie.js').creer(ECO);

test('les points d\'un lieu : sa rareté, plus le bâtiment construit dessus', () => {
  assert.strictEqual(C.pointsLieu(1, 0), 1); assert.strictEqual(C.pointsLieu(2, 0), 2); assert.strictEqual(C.pointsLieu(3, 0), 4);
  assert.strictEqual(C.pointsLieu(4, 0), 8); assert.strictEqual(C.pointsLieu(5, 0), 12); assert.strictEqual(C.pointsLieu(6, 0), 20);
  assert.strictEqual(C.pointsLieu(1, 1), 2);    // Maison +1
  assert.strictEqual(C.pointsLieu(6, 6), 35);   // monument au Prestige (+15)
  assert.strictEqual(ECO.classements.bonus_niveau.length, ECO.niveaux.length, 'un bonus par niveau');
  const lieux = [{ r: 1, niveau: 0 }, { r: 4, niveau: 2 }, { r: 6 }];
  assert.strictEqual(C.patrimoine(lieux, (l) => l.r), 1 + 8 + 3 + 20);
});

test('une saison : 6 mandats de Maire, calée sur eux', () => {
  assert.strictEqual(C.saison(0), 0); assert.strictEqual(C.saison(5), 0); assert.strictEqual(C.saison(6), 1);
  assert.strictEqual(C.premierMandat(3), 18); assert.deepStrictEqual(C.mandatsDe(1), [6, 7, 8, 9, 10, 11]);
  assert.strictEqual(C.numero(355912, 355912), 1); assert.strictEqual(C.numero(355914, 355912), 3);
  // 6 mandats de 14 jours : 84 jours, à peu près 3 mois ; une saison commence toujours en début de mandat
  assert.strictEqual(ECO.classements.mandats_par_saison * ECO.mairie.jours_mandat, 84);
});

test('classer : du meilleur au moins bon, même rang à égalité, sans ceux qui n\'ont rien', () => {
  const c = C.classer({ lea: 30, marco: 50, ines: 30, yanis: 0, moi: 12 });
  assert.deepStrictEqual(c.map((r) => [r.qui, r.n, r.rang]), [['marco', 50, 1], ['ines', 30, 2], ['lea', 30, 2], ['moi', 12, 4]]);
  assert.deepStrictEqual(C.classer({}), []);
});

test('le classement des Maires : une mairie vaut le nombre de ses rivaux', () => {
  const elections = [M.elire({ lea: 500, a: 200, b: 150, c: 120 }), M.elire({ lea: 900 }), M.elire({ marco: 300, lea: 250 })];
  assert.deepStrictEqual(C.pointsMaires(elections), { lea: 3 + 0, marco: 1 });
  assert.deepStrictEqual(C.mairiesGagnees(elections), { lea: 2, marco: 1 });
  // co-Maires : chacun compte les rivaux
  assert.deepStrictEqual(C.pointsMaires([M.elire({ lea: 400, marco: 400, ines: 100 })]), { lea: 1, marco: 1 });
});

test('le Maire de la saison d\'une commune : le plus de mandats, puis le plus récent', () => {
  assert.strictEqual(C.maireDeSaison([['lea'], ['lea'], ['marco'], [], ['marco'], ['ines']]), 'marco');
  assert.strictEqual(C.maireDeSaison([['lea'], ['lea', 'marco'], ['marco'], ['lea']]), 'lea');
  assert.strictEqual(C.maireDeSaison([[], []]), null);
});
