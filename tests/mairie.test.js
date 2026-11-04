// Le Maire par caisse de travaux (src/regles/mairie.js, GDD § 5) : mandat de 2 semaines, seuil, dernière heure à moitié,
// co-Maires, absence, part des loyers plafonnée.
const test = require('node:test');
const assert = require('node:assert');
const ECO = require('../data/economie.json');
const M = require('../src/regles/mairie.js').creer(ECO);

test('un mandat dure 2 semaines du jeu, calé sur les semaines des enchères', () => {
  assert.strictEqual(ECO.mairie.jours_mandat, 14);
  assert.strictEqual(M.mandat(0), 0); assert.strictEqual(M.mandat(13), 0); assert.strictEqual(M.mandat(14), 1);
  assert.strictEqual(M.premierJour(3), 42);
  // un mandat commence toujours au début d'une semaine d'enchères (jour / 7 entier)
  for (let n = 0; n < 50; n++) assert.strictEqual(M.premierJour(n) % 7, 0);
});

test('un versement compte à moitié dans la dernière heure du mandat', () => {
  const jourMs = 86400000;
  assert.strictEqual(M.points(300, 2 * 3600000, jourMs), 300);
  assert.strictEqual(M.points(300, 3599000, jourMs), 150);
  assert.strictEqual(M.points(301, 60000, jourMs), 150);
  assert.strictEqual(M.points(0, 5, jourMs), 0);
  // serveur accéléré (un jour = une minute) : la « dernière heure » dure 2,5 s
  assert.strictEqual(M.points(100, 3000, 60000), 100); assert.strictEqual(M.points(100, 2000, 60000), 50);
});

test('pour verser : un lieu dans la commune, au moins le minimum, dans ses moyens', () => {
  assert.deepStrictEqual(M.peutVerser(100, 1000, 0), { ok: false, raison: 'sans_lieu' });
  assert.deepStrictEqual(M.peutVerser(5, 1000, 2), { ok: false, raison: 'minimum' });
  assert.deepStrictEqual(M.peutVerser(10.5, 1000, 2), { ok: false, raison: 'minimum' });
  assert.deepStrictEqual(M.peutVerser(1001, 1000, 2), { ok: false, raison: 'fonds' });
  assert.deepStrictEqual(M.peutVerser(1000, 1000, 1), { ok: true });
});

test('l\'élection : le plus gros contributeur, au moins le seuil ; égalité = co-Maires', () => {
  let e = M.elire({ lea: 640, marco: 300, ines: 90 });
  assert.deepStrictEqual(e.maires, ['lea']); assert.strictEqual(e.max, 640); assert.strictEqual(e.rivaux, 1);
  assert.deepStrictEqual(e.rangs.map((r) => r.qui), ['lea', 'marco', 'ines']);
  e = M.elire({ lea: 400, marco: 400, ines: 120 });
  assert.deepStrictEqual(e.maires, ['lea', 'marco']); assert.strictEqual(e.rivaux, 1);
  // personne n'atteint le seuil : pas de Maire ce mandat
  e = M.elire({ lea: 99, marco: 50 }); assert.deepStrictEqual(e.maires, []); assert.strictEqual(e.rivaux, 0);
  assert.deepStrictEqual(M.elire({}).maires, []);
  // une mairie gagnée sans rival ne vaut rien au classement des Maires
  assert.strictEqual(M.elire({ lea: 5000 }).rivaux, 0);
});

test('un Maire absent perd le titre au profit du suivant', () => {
  const absents = new Set(['lea']);
  let e = M.elire({ lea: 640, marco: 300, ines: 90 }, (q) => absents.has(q));
  assert.deepStrictEqual(e.maires, ['marco']);
  e = M.elire({ lea: 400, marco: 400 }, (q) => absents.has(q)); assert.deepStrictEqual(e.maires, ['marco']);
  e = M.elire({ lea: 640, ines: 90 }, (q) => absents.has(q)); assert.deepStrictEqual(e.maires, []);
  assert.strictEqual(M.tropAbsent(6), false); assert.strictEqual(M.tropAbsent(7), true);
});

test('ce qu\'il manque pour passer en tête de la caisse', () => {
  assert.strictEqual(M.manque({ lea: 640, moi: 300 }, 'moi'), 341);
  assert.strictEqual(M.manque({ lea: 640, moi: 700 }, 'moi'), 0);
  assert.strictEqual(M.manque({ moi: 20 }, 'moi'), 80);     // seul : il faut atteindre le seuil
  assert.strictEqual(M.manque({}, 'moi'), 100);
});

test('la part du Maire : 5 % des loyers des autres, partagée entre co-Maires, plafonnée par mandat', () => {
  assert.strictEqual(M.part(1000, 1, 0), 50);
  assert.strictEqual(M.part(1000, 2, 0), 25);
  assert.strictEqual(M.part(100000, 1, 0), 1000);
  assert.strictEqual(M.part(100000, 1, 980), 20);
  assert.strictEqual(M.part(100000, 1, 1000), 0);
  assert.strictEqual(M.part(100000, 2, 0), 500);
  assert.strictEqual(M.plafondPart(1), 1000); assert.strictEqual(M.plafondPart(2), 500);
});
