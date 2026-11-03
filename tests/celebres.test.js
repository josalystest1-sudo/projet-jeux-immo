const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/regles/celebres.js');
const Regles = require('../src/regles/lieu.js');
const ECO = require('../data/economie.json');

// [identifiant, nom, catégorie, lon, lat, insee]
const MARTIN = ['Q1', 'église Saint-Martin de Clévilliers', 'eglise', 1.3900, 48.5470, '28105'];
const HDV = ['Q2', 'hôtel de ville de Bagneux', 'mairie', 2.3060, 48.7960, '92007'];
const ND = ['Q3', 'église Notre-Dame-de-l\'Assomption', 'eglise', 2.5000, 48.6000, '77001'];

// un point à n mètres au nord
function aNord(e, metres) { return e[4] + metres / 110540; }

test('les mots qui distinguent un lieu', () => {
  assert.deepStrictEqual(C.significatifs('Église Saint-Martin'), ['martin']);
  assert.deepStrictEqual(C.significatifs("hôtel de ville de Bagneux"), ['bagneux']);
  assert.deepStrictEqual(C.significatifs('Église Notre-Dame'), ['dame']);
  assert.strictEqual(C.categorieDuNom('Hôtel de Ville'), 'mairie');
  assert.strictEqual(C.categorieDuNom('Chapelle Sainte-Anne'), 'chapelle');
});

test("l'église de l'IGN est celle de Wikidata (même nom, quelques mètres)", () => {
  const ign = { label: 'Église Saint-Martin', lon: MARTIN[3], lat: aNord(MARTIN, 40) };
  assert.ok(C.memeLieu(ign, MARTIN));
  assert.strictEqual(C.trouver(ign, [HDV, MARTIN, ND]), MARTIN);
});

test('deux églises différentes ne se confondent pas', () => {
  const anne = { label: 'Chapelle Sainte-Anne', lon: MARTIN[3], lat: aNord(MARTIN, 30) };
  assert.ok(!C.memeLieu(anne, MARTIN));
  const nd = { label: 'Église Notre-Dame', lon: MARTIN[3], lat: aNord(MARTIN, 30) };
  assert.ok(!C.memeLieu(nd, MARTIN));
  assert.ok(C.memeLieu({ label: 'Église Notre-Dame', lon: ND[3], lat: aNord(ND, 60) }, ND));
});

test('« Mairie » tout court : la même famille, tout près', () => {
  assert.ok(C.memeLieu({ label: 'Mairie', lon: HDV[3], lat: aNord(HDV, 80) }, HDV));
  assert.ok(!C.memeLieu({ label: 'Mairie', lon: HDV[3], lat: aNord(HDV, 300) }, HDV));
  assert.ok(!C.memeLieu({ label: 'Gare', lon: HDV[3], lat: aNord(HDV, 50) }, HDV));
});

test('trop loin : jamais le même lieu', () => {
  assert.ok(!C.memeLieu({ label: 'Église Saint-Martin', lon: MARTIN[3], lat: aNord(MARTIN, 600) }, MARTIN));
  assert.strictEqual(C.trouver({ label: 'Église Saint-Martin', lon: MARTIN[3], lat: aNord(MARTIN, 600) }, [MARTIN]), null);
});

test('un lieu célèbre devient Légendaire et monte au Gratte-ciel, même au standing 1', () => {
  const R = Regles.creer(ECO, {});
  const lieu = C.lieuDe(MARTIN);
  assert.strictEqual(lieu.id, 'wd:Q1');
  assert.strictEqual(R.standing(lieu), 1);
  assert.strictEqual(R.notoriete(lieu), 'celebre');
  assert.strictEqual(R.texteNiveau(R.plafond(lieu)), 'Gratte-ciel');
  assert.strictEqual(R.rarete(lieu), 5);
  // un lieu nommé sans article reste Rare
  assert.strictEqual(R.rarete({ type: 'lieu', citycode: '28105' }), 3);
});

test('le département d\'un code INSEE', () => {
  assert.strictEqual(C.departement('28105'), '28');
  assert.strictEqual(C.departement('2A004'), '2A');
  assert.strictEqual(C.departement('97411'), '974');
});
