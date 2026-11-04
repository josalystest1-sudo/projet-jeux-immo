// La boutique et les gemmes (src/regles/boutique.js, GDD § 3 et § 9).
const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const B = require('../src/regles/boutique.js').creer(ECO);
const J = 86400000;

test('les prix en gemmes : pack national 200, régional 300, Pass 300 ; les offres de gemmes', () => {
  assert.strictEqual(B.prix('pack_national'), 200); assert.strictEqual(B.prix('pack_regional'), 300); assert.strictEqual(B.prix('pass'), 300);
  assert.ok(B.peutPayer('pack_national', 200)); assert.ok(!B.peutPayer('pack_regional', 299)); assert.ok(!B.peutPayer('inconnu', 1e9));
  assert.deepStrictEqual(ECO.boutique.gemmes.map((g) => g.gemmes), [500, 1200, 2600]);
  // jamais de pièces contre des gemmes : la boutique ne vend aucun article en pièces
  assert.ok(!Object.keys(ECO.boutique.prix).some((k) => /piece/.test(k)));
});

test('le Pass 15 jours : 8 cartes au pack du jour, un bon par Pass (3 au plus), perdus quand il finit', () => {
  let p = B.acheterPass(null, 0, J);
  assert.deepStrictEqual(p, { fin: 15 * J, bons: 1 });
  assert.strictEqual(B.cartesDuJour(p, 3 * J), 8); assert.strictEqual(B.cartesDuJour(p, 15 * J), 5); assert.strictEqual(B.cartesDuJour(null, 0), 5);
  p = B.acheterPass(p, 10 * J, J); assert.deepStrictEqual(p, { fin: 30 * J, bons: 2 });   // prolongé à partir de sa fin
  p = B.acheterPass(p, 11 * J, J); p = B.acheterPass(p, 12 * J, J); assert.strictEqual(p.bons, 3);   // 3 au plus
  assert.strictEqual(B.bonsUtilisables(p, 20 * J), 3); assert.strictEqual(B.bonsUtilisables(p, 61 * J), 0);
  p = B.acheterPass(p, 70 * J, J); assert.deepStrictEqual(p, { fin: 85 * J, bons: 1 });   // les bons d'un Pass fini sont perdus
});

test('un bon prend une adresse libre jusqu\'à Épique, jamais un monument', () => {
  assert.deepStrictEqual(B.bonPermis({ type: 'adresse' }, 4, true), { ok: true });
  assert.deepStrictEqual(B.bonPermis({ type: 'adresse' }, 5, true), { ok: false, raison: 'rarete' });
  assert.deepStrictEqual(B.bonPermis({ type: 'lieu' }, 3, true), { ok: false, raison: 'rarete' });   // une adresse, pas un lieu nommé
  assert.deepStrictEqual(B.bonPermis({ type: 'monument' }, 6, true), { ok: false, raison: 'rarete' });
  assert.deepStrictEqual(B.bonPermis({ type: 'adresse' }, 1, false), { ok: false, raison: 'pris' });
});

test('les probabilités affichées : celles du tirage, qui font 100 %', () => {
  const p = B.probabilites(); assert.deepStrictEqual(p.map((x) => x.r), [1, 2, 3, 4, 5]);
  assert.strictEqual(p.reduce((s, x) => s + x.pct, 0), 100);
});
