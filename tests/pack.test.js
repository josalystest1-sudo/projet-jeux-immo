const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const P = require('../src/regles/pack.js');

test('le même joueur, le même jour : le même tirage', () => {
  const a = P.raretes(5, ECO.pack.chances, P.alea(P.graine('Léa:20394:0')));
  const b = P.raretes(5, ECO.pack.chances, P.alea(P.graine('Léa:20394:0')));
  const c = P.raretes(5, ECO.pack.chances, P.alea(P.graine('Léa:20395:0')));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 5);
  assert.notDeepStrictEqual(P.graine('Léa:20394:0'), P.graine('Léa:20395:0'));
  assert.ok(Array.isArray(c));
});

test('les chances par carte : 60 / 25 / 10 / 4 / 1 %, jamais de monument (Extraordinaire)', () => {
  const rng = P.alea(42), n = 200000, compte = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let i = 0; i < n; i++) compte[P.rarete(ECO.pack.chances, rng)]++;
  assert.strictEqual(compte[6], 0); assert.ok(compte[5] > 0, 'des Légendaires sortent des packs');
  assert.strictEqual(Object.values(ECO.pack.chances).reduce((s, x) => s + x, 0), 100);
  for (const [r, pct] of Object.entries(ECO.pack.chances)) {
    assert.ok(Math.abs(100 * compte[r] / n - pct) < 0.5, `rareté ${r} : ${(100 * compte[r] / n).toFixed(2)} % au lieu de ${pct} %`);
  }
});

test('le générateur reste dans [0, 1)', () => {
  const rng = P.alea(P.graine('x'));
  for (let i = 0; i < 10000; i++) { const x = rng(); assert.ok(x >= 0 && x < 1); }
});

test('une carte convient : bonne rareté, libre, pas déjà tirée', () => {
  const rareteDe = (l) => l.r, libre = (l) => !l.pris;
  assert.ok(P.convient({ id: 'a', r: 2 }, 2, rareteDe, libre, []));
  assert.ok(!P.convient({ id: 'a', r: 2 }, 3, rareteDe, libre, []));
  assert.ok(!P.convient({ id: 'a', r: 2, pris: true }, 2, rareteDe, libre, []));
  assert.ok(!P.convient({ id: 'a', r: 2 }, 2, rareteDe, libre, [{ id: 'a' }]));
  assert.ok(!P.convient(null, 2, rareteDe, libre, []));
});
