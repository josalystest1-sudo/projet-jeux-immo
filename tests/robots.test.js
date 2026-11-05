// Les joueurs de la maison (src/regles/robots.js, GDD § 5 quater) : jouer comme des humains, ne pas abuser, se retirer.
const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const ROB = require('../src/regles/robots.js').creer(ECO);

test('les robots se retirent peu à peu quand les vrais joueurs arrivent', () => {
  assert.strictEqual(ROB.nombreActifs(0), 10);
  assert.strictEqual(ROB.nombreActifs(20), 5);
  assert.strictEqual(ROB.nombreActifs(39), 1);
  assert.strictEqual(ROB.nombreActifs(40), 0);
  assert.strictEqual(ROB.nombreActifs(500), 0);
  for (let h = 0; h < 60; h++) assert.ok(ROB.nombreActifs(h + 1) <= ROB.nombreActifs(h), 'jamais plus de robots quand il y a plus de joueurs');
});

test('un rythme humain : 2 à 4 séances par jour, entre 8 h et 23 h, jamais la nuit, différentes d’un jour à l’autre', () => {
  for (let jour = 100; jour < 130; jour++) {
    const s = ROB.seances('robot-a', jour);
    assert.ok(s.length >= 2 && s.length <= 4);
    for (const [a, b] of s) assert.ok(a >= 8 && b <= 23 && b > a);
    assert.ok(!ROB.enSeance('robot-a', jour, 3, false), 'pas à 3 h du matin');
  }
  assert.notDeepStrictEqual(ROB.seances('robot-a', 100), ROB.seances('robot-a', 101));
  assert.notDeepStrictEqual(ROB.seances('robot-a', 100), ROB.seances('robot-b', 100));
  assert.ok(ROB.enSeance('robot-a', 100, 3, true), 'sur le serveur d’essai accéléré, il joue à chaque tour');
  const [a, b] = ROB.seances('robot-a', 100)[0];
  assert.ok(ROB.enSeance('robot-a', 100, (a + b) / 2, false));
});

test('il répond plus tard, comme quelqu’un qui repasse, et seulement à une offre au-dessus de la valeur', () => {
  for (const id of ['o1', 'o2', 'o3', 'o4']) { const d = ROB.delaiReponse(id); assert.ok(d >= 0.25 && d <= 6); }
  assert.ok(ROB.accepte(1100, 1000) && !ROB.accepte(1099, 1000));
});

test('ne pas abuser : pas d’offre au rabais, pas d’achat d’une erreur de prix, pas d’enchère au dernier moment', () => {
  for (const g of ['a', 'b', 'c', 'd']) { const p = ROB.prixOffre(1000, g); assert.ok(p >= 900 && p <= 1250); }
  assert.ok(!ROB.peutAcheter(500, 1000), 'un lieu vendu à moitié prix reste aux vrais joueurs');
  assert.ok(ROB.peutAcheter(1000, 1000) && !ROB.peutAcheter(1500, 1000));
  for (const g of ['a', 'b']) { const p = ROB.prixVente(1000, g); assert.ok(p >= 1050 && p <= 1400); }
  assert.strictEqual(ROB.mise(10000, 10000, 0.5, 0, 0.05), null, 'jamais dans la dernière heure');
  assert.strictEqual(ROB.mise(10000, 10000, 30, 2, 0.05), null, 'deux mises au plus par lot');
  assert.strictEqual(ROB.mise(10000, 10000, 30, 0, 0.05), 10500);
  assert.strictEqual(ROB.mise(10000, 11800, 30, 1, 0.05), null, 'pas au-delà de 120 % de la mise de départ');
  assert.ok(ROB.peutVerser(0) && !ROB.peutVerser(100), 'jamais de mairie disputée à un vrai joueur');
  assert.ok(ROB.peutPrendre(29, 2) && !ROB.peutPrendre(30, 0) && !ROB.peutPrendre(5, 3), '30 lieux au plus, 3 par commune');
});

test('un robot ne prend jamais une mairie à un vrai joueur', () => {
  const estRobot = (j) => j.startsWith('robot');
  const avec = [{ joueur: 'robot-a', points: 900 }, { joueur: 'alice', points: 150 }];
  assert.deepStrictEqual(ROB.electeurs(avec, estRobot, 100).map((r) => r.joueur), ['alice'], 'Alice a versé le seuil : le robot ne compte pas');
  const sous = [{ joueur: 'robot-a', points: 900 }, { joueur: 'alice', points: 50 }];
  assert.strictEqual(ROB.electeurs(sous, estRobot, 100).length, 2, 'sous le seuil, la caisse est élue comme d’habitude');
});

