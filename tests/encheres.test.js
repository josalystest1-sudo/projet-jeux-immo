const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const MONUMENTS = require('../data/monuments.json');
const E = require('../src/regles/encheres.js').creer(ECO);

const NAT = MONUMENTS.filter((m) => m.palier === 'national');
const REG = MONUMENTS.filter((m) => m.palier === 'regional');
const mise = (qui, montant, ts) => ({ qui, montant, ts });

test('chaque semaine : 1 monument national puis 2 régionaux, tous différents', () => {
  const l = E.lots(0, NAT, REG);
  assert.deepStrictEqual(l.map((x) => x.palier), ['national', 'regional', 'regional']);
  assert.deepStrictEqual(l.map((x) => x.cle), ['0:0', '0:1', '0:2']);
  const vus = new Set();
  for (let s = 0; s < 60; s++) for (const x of E.lots(s, NAT, REG)) { assert.ok(!vus.has(x.m.id), `${x.m.nom} revient la semaine ${s}`); vus.add(x.m.id); }
  assert.strictEqual(vus.size, 180);
  assert.strictEqual(E.lots(1, NAT, REG)[1].m, REG[2]);
});

test('la mise de départ : plus basse pour un monument régional', () => {
  const nat = { palier: 'national', articles: 100 }, reg = { palier: 'regional', articles: 100 };
  assert.strictEqual(E.miseDepart(nat), 70000);
  assert.strictEqual(E.miseDepart(reg), 23000);
  for (const l of E.lots(3, NAT, REG)) assert.ok(E.miseDepart(l.m) > 0);
  assert.ok(E.miseDepart(E.lots(0, NAT, REG)[0].m) > E.miseDepart(E.lots(0, NAT, REG)[1].m));
});

test('mise minimale : la mise de départ, puis +5 % sur la meilleure', () => {
  const m = { palier: 'regional', articles: 10 };
  assert.strictEqual(E.miseMin(m, []), 5000);
  assert.strictEqual(E.miseMin(m, [mise('A', 6000, 1)]), 6300);
  assert.strictEqual(E.meilleure([mise('A', 6000, 2), mise('B', 6000, 1)]).qui, 'B');
});

test('une mise doit être couverte par le solde moins les fonds bloqués ailleurs', () => {
  const m = { palier: 'regional', articles: 10 };
  const lots = { 'a': [mise('moi', 8000, 1)], 'b': [mise('moi', 5000, 1), mise('X', 6000, 2)], 'c': [] };
  assert.strictEqual(E.bloque(lots, 'moi'), 8000);          // je ne mène que sur « a »
  assert.strictEqual(E.bloque(lots, 'moi', 'a'), 0);        // sur « a », ma nouvelle mise remplace l'ancienne
  assert.deepStrictEqual(E.peutMiser(m, lots.c, 5000, 12000, E.bloque(lots, 'moi', 'c')), { ok: false, raison: 'fonds', dispo: 4000 });
  assert.ok(E.peutMiser(m, lots.c, 5000, 13000, E.bloque(lots, 'moi', 'c')).ok);
  assert.ok(E.peutMiser(m, lots.a, 9000, 9000, E.bloque(lots, 'moi', 'a')).ok);
  assert.strictEqual(E.peutMiser(m, lots.b, 6000, 99999, 0).raison, 'min');
});

test("à la clôture, si le meneur n'a plus les fonds, l'enchère passe à la mise suivante", () => {
  const mises = [mise('A', 5000, 1), mise('B', 6000, 2), mise('A', 7000, 3), mise('C', 6500, 4)];
  const fonds = { A: 100000, B: 100000, C: 100000 };
  assert.deepStrictEqual(E.cloture(mises, (q) => fonds[q]), mise('A', 7000, 3));
  fonds.A = 6999;                                            // A a dépensé entre-temps
  assert.deepStrictEqual(E.cloture(mises, (q) => fonds[q]), mise('C', 6500, 4));
  fonds.C = 0;
  assert.deepStrictEqual(E.cloture(mises, (q) => fonds[q]), mise('B', 6000, 2));
  fonds.B = 0;
  assert.strictEqual(E.cloture(mises, (q) => fonds[q]), null);  // personne : le monument reste libre
  assert.strictEqual(E.cloture([], () => 1e9), null);
});

test('la semaine en cours', () => {
  assert.strictEqual(E.semaine(0, 1000), 0);
  assert.strictEqual(E.semaine(2500, 1000), 2);
});
