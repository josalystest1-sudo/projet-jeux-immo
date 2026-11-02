const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/regles/pseudo.js').creer(require('../data/moderation.json'));

const ok = (p, pris) => P.valider(p, pris).ok;
const raison = (p, pris) => P.valider(p, pris).raison;

test('des pseudos ordinaires passent', () => {
  for (const p of ['Léa', 'Jean-Pierre', 'Marco_75', 'Zoé.B', 'Le Baron', 'Sacha2026', 'Ünal', 'Chloé']) assert.ok(ok(p), p);
});

test('des pseudos innocents qui contiennent un mot court interdit passent', () => {
  for (const p of ['Calcul42', 'Dispute', 'Unique', 'Violette', 'Montenegro', 'Conrad', 'Habiter', 'Technique', 'Particulier', 'Habitat', 'Mémé']) assert.ok(ok(p), p);
});

test('les mots interdits sont bloqués, même déguisés', () => {
  for (const p of ['Connard', 'GrosCon', 'p.u.t.e', 'Pu7ain', 'SALOPE', 'puuute', 'le_con', 'F.D.P', 'xXnaziXx', 'Hitl3r']) assert.strictEqual(raison(p), 'interdit', p);
});

test('les noms réservés sont bloqués', () => {
  for (const p of ['Admin', 'Cadastra_FR', 'Le Modo', 'SupportFR', 'Modérateur']) assert.strictEqual(raison(p), 'reserve', p);
});

test('longueur et caractères', () => {
  assert.strictEqual(raison('Lé'), 'court');
  assert.strictEqual(raison('Un pseudo beaucoup trop long'), 'long');
  assert.strictEqual(raison('<script>'), 'caracteres');
  assert.strictEqual(raison('-Léa'), 'caracteres');
  assert.strictEqual(raison('1234'), 'lettres');
  assert.ok(ok('  Léa   Martin  '));
  assert.strictEqual(P.valider('  Léa   Martin  ').pseudo, 'Léa Martin');
});

test('un pseudo déjà pris (sans tenir compte des majuscules ni des accents)', () => {
  assert.strictEqual(raison('lea', ['Léa', 'Marco']), 'pris');
  assert.ok(ok('Léa2', ['Léa']));
});
