// Les monuments : entretien exponentiel, impayés, absence (src/regles/monuments.js, GDD § 5 ter).
const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const M = require('../src/regles/monuments.js').creer(ECO);
const J = 86400000;
const mon = (id, depuis) => ({ id, label: id, type: 'monument', depuis });

test('l\'entretien : 300, 600, 1 200… par mois, dans l\'ordre d\'arrivée ; les autres lieux ne coûtent rien', () => {
  const l = [mon('b', 2), { id: 'x', type: 'adresse', depuis: 0 }, mon('a', 1), mon('c', 3)];
  assert.deepStrictEqual(M.entretiens(l).map((e) => [e.id, e.parMois]), [['a', 300], ['b', 600], ['c', 1200]]);
  assert.strictEqual(M.parMois(l), 2100); assert.strictEqual(M.parJour(l), 70);
  assert.strictEqual(M.prochain(l), 2400); assert.strictEqual(M.prochain([]), 300);
  assert.strictEqual(M.plusCher(l), 'c'); assert.strictEqual(M.plusCher([]), null);
  // le 6e monument coûte 9 600 par mois à lui seul
  assert.strictEqual(M.entretiens([1, 2, 3, 4, 5, 6].map((i) => mon('m' + i, i)))[5].parMois, 9600);
});

test('ce qui est dû court sans plafond de temps, chaque monument depuis son arrivée, sans perdre les fractions', () => {
  const l = [mon('a', 0)];   // 10 pièces par jour
  assert.deepStrictEqual(M.du(l, 0, 3 * J, J), { montant: 30, nouveauLe: 3 * J });
  assert.strictEqual(M.du(l, 0, 40 * J, J).montant, 400);       // 40 jours : tout est dû (pas de stock de 24 h)
  const d = M.du(l, 0, 0.15 * J, J);                            // 1,5 pièce : 1 comptée, la demie reste à compter
  assert.strictEqual(d.montant, 1); assert.ok(Math.abs(d.nouveauLe - 0.1 * J) < 1);
  // un monument arrivé après le dernier paiement ne coûte que depuis son arrivée
  assert.strictEqual(M.du([mon('a', 0), mon('b', 10 * J)], 0, 12 * J, J).montant, 120 + 40);
  assert.strictEqual(M.du([], 0, 10 * J, J).montant, 0);
});

test('payer : ce qui manque devient une dette, l\'impayé court depuis le premier manque', () => {
  assert.deepStrictEqual(M.payer(500, 0, 300, null, 7), { paye: 300, dette: 0, impayeDepuis: null });
  assert.deepStrictEqual(M.payer(100, 0, 300, null, 7), { paye: 100, dette: 200, impayeDepuis: 7 });
  assert.deepStrictEqual(M.payer(50, 200, 300, 7, 9), { paye: 50, dette: 450, impayeDepuis: 7 });
  assert.deepStrictEqual(M.payer(1000, 450, 10, 7, 12), { paye: 460, dette: 0, impayeDepuis: null });
});

test('impayé : prévenu 7 jours avant, monument repris après un mois', () => {
  assert.strictEqual(M.impaye(null, 99 * J, J), 'ok');
  assert.strictEqual(M.impaye(0, 22 * J, J), 'ok'); assert.strictEqual(M.impaye(0, 23 * J, J), 'avertir'); assert.strictEqual(M.impaye(0, 30 * J, J), 'reprendre');
  assert.strictEqual(M.joursAvantReprise(0, 23 * J, J), 7);
});

test('absence : prévenu 3 jours avant, monuments repris après 14 jours', () => {
  assert.strictEqual(M.absence(0, 10 * J, J), 'ok'); assert.strictEqual(M.absence(0, 11 * J, J), 'avertir'); assert.strictEqual(M.absence(0, 14 * J, J), 'reprendre');
  // serveur accéléré : un jour = une minute
  assert.strictEqual(M.absence(0, 14 * 60000, 60000), 'reprendre');
});
