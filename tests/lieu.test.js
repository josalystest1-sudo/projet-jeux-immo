const test = require('node:test'); const assert = require('node:assert');
const eco = require('../data/economie.json'); const table = require('../data/standing.json'); const { creer } = require('../src/regles/lieu.js'); const R = creer(eco, table);
const JOUR = 86400000;
const martyrs = { id: '75109_6147_00067', type: 'adresse', citycode: '75109' };   // Paris 9e
const clevilliers = { id: '28105_x', type: 'adresse', citycode: '28105' };          // village d'Eure-et-Loir
const egliseClev = { id: 'poi1', type: 'lieu', citycode: '28105' };
const bordeaux = { id: '33063_x', type: 'adresse', citycode: '33063' };
const eiffel = { id: 'mon1', type: 'monument', citycode: '75107' };
const seizieme = { id: '75116_x', type: 'adresse', citycode: '75116' };
test('standing réel (DVF) : Paris et ses arrondissements = 3, Bordeaux = 3, Marseille 1er = 2, Dijon = 2, Clévilliers = 1', () => {
  assert.equal(R.standing(martyrs), 3); assert.equal(R.standing({ citycode: '75116' }), 3); assert.equal(R.standing(bordeaux), 3);
  assert.equal(R.standing({ citycode: '13201' }), 2); assert.equal(R.standing({ citycode: '21231' }), 2); assert.equal(R.standing(clevilliers), 1);
  assert.equal(R.standing({ citycode: '99999' }), 1, 'commune inconnue : standing 1'); });
test('arrondissements ramenés à leur ville', () => {
  assert.equal(R.communeDvf('75109'), '75056'); assert.equal(R.communeDvf('69385'), '69123'); assert.equal(R.communeDvf('13207'), '13055'); assert.equal(R.communeDvf('28105'), '28105'); });
test('plafond : un lieu célèbre monte au Gratte-ciel, même au village ; le Prestige reste aux monuments, après le Gratte-ciel', () => {
  assert.equal(R.texteNiveau(R.plafond({ type: 'lieu', notoriete: 'celebre', citycode: '28105' })), 'Gratte-ciel');
  assert.equal(R.texteNiveau(R.plafond({ type: 'lieu', notoriete: 'celebre', citycode: '75109' })), 'Gratte-ciel');
  assert.deepEqual(R.NIVEAUX.map((n) => n.nom), ['Terrain', 'Maison', 'Immeuble', 'Tour', 'Gratte-ciel', 'Prestige']);
  const m = { ...eiffel, niveau: 4 }; assert.ok(R.peutConstruire(m, 5), 'un monument construit le Prestige après le Gratte-ciel');
  assert.ok(!R.peutConstruire({ type: 'lieu', notoriete: 'celebre', citycode: '28105', niveau: 4 }, 5), 'pas de Prestige hors monument'); });
test('plafond : village = Maison, église du village = Immeuble, Dijon = Immeuble, Paris = Tour, monument = Prestige', () => {
  assert.equal(R.texteNiveau(R.plafond(clevilliers)), 'Maison'); assert.equal(R.texteNiveau(R.plafond(egliseClev)), 'Immeuble');
  assert.equal(R.texteNiveau(R.plafond({ citycode: '21231' })), 'Immeuble'); assert.equal(R.texteNiveau(R.plafond(seizieme)), 'Tour'); assert.equal(R.texteNiveau(R.plafond(eiffel)), 'Prestige'); });
test('rareté : village commun, Dijon peu commun, église rare, Paris épique, lieu célèbre légendaire, monument extraordinaire', () => {
  assert.equal(R.rarete(clevilliers), 1); assert.equal(R.rarete({ citycode: '21231' }), 2); assert.equal(R.rarete(egliseClev), 3); assert.equal(R.rarete(martyrs), 4);
  assert.equal(R.rarete({ id: 'wd:Q1', type: 'lieu', notoriete: 'celebre', citycode: '28105' }), 5, 'célèbre, même dans un village');
  assert.equal(R.rarete({ id: 'wd:Q2', type: 'lieu', notoriete: 'celebre', citycode: '75109' }), 5, 'célèbre à Paris');
  assert.equal(R.rarete({ id: 'poi2', type: 'lieu', citycode: '75109' }), 4, 'lieu nommé dans un quartier Tour : épique');
  assert.equal(R.rarete(eiffel), 6); assert.equal(R.nomRarete(5), 'Légendaire'); assert.equal(R.nomRarete(6), 'Extraordinaire'); });
test('valeur et construction : la valeur grandit avec les niveaux, on ne saute pas de niveau, pas au-delà du plafond', () => {
  const l = { ...clevilliers, niveau: 0 }; assert.equal(R.valeur(l), 500); assert.ok(R.peutConstruire(l, 1)); assert.ok(!R.peutConstruire(l, 2));
  l.niveau = 1; assert.equal(R.valeur(l), 1000); assert.ok(!R.peutConstruire(l, 2), 'plafond Maison au village'); });
test('loyer : plat par niveau, indépendant du lieu', () => {
  assert.equal(R.loyerParJour({ ...clevilliers, niveau: 1 }), R.loyerParJour({ ...martyrs, niveau: 1 })); assert.equal(R.loyerParJour({ niveau: 0 }), 10); });
test('encaissement : salaire + loyers, plafonné à 24 h', () => {
  const lieux = [{ ...martyrs, niveau: 2 }];
  assert.equal(R.aEncaisser(lieux, 0, JOUR / 2, JOUR), Math.floor((200 + 120) / 2));
  assert.equal(R.aEncaisser(lieux, 0, 3 * JOUR, JOUR), 320, 'trois jours absent = un seul jour encaissé'); });

test('vendre : le prix est libre, un entier de 1 à un milliard, espaces acceptés', () => {
  assert.deepEqual(R.lirePrix('12500'), { ok: true, prix: 12500 }); assert.deepEqual(R.lirePrix('12 500'), { ok: true, prix: 12500 });
  assert.deepEqual(R.lirePrix(' 3\u00a0200 '), { ok: true, prix: 3200 }); assert.equal(R.lirePrix('').raison, 'vide'); assert.equal(R.lirePrix('12,5').raison, 'vide');
  assert.equal(R.lirePrix('-5').raison, 'vide'); assert.equal(R.lirePrix('0').raison, 'zero'); assert.equal(R.lirePrix('1000000001').raison, 'trop'); assert.equal(R.lirePrix(1000000000).prix, 1000000000); });
test('adresse : numéro et voie (plaque de rue + plaque du numéro)', () => {
  const { numeroEtVoie } = require('../src/regles/lieu.js');
  assert.deepEqual(numeroEtVoie('67 Rue des Martyrs'), { numero: '67', voie: 'Rue des Martyrs' });
  assert.deepEqual(numeroEtVoie('12 bis Avenue Trudaine'), { numero: '12 bis', voie: 'Avenue Trudaine' });
  assert.deepEqual(numeroEtVoie('8B Rue Sainte-Catherine'), { numero: '8B', voie: 'Rue Sainte-Catherine' });
  assert.deepEqual(numeroEtVoie('2 Petit Keriolas'), { numero: '2', voie: 'Petit Keriolas' });
  assert.deepEqual(numeroEtVoie('Place du Marché'), { numero: '', voie: 'Place du Marché' });
  assert.deepEqual(numeroEtVoie('3 Avenue de la Liberté'), { numero: '3', voie: 'Avenue de la Liberté' }); });
test('échange : la balance compte le lieu donné et les pièces ajoutées', () => {
  const { bilanEchange } = require('../src/regles/lieu.js');
  assert.deepEqual(bilanEchange(8000, 0, 10000), { donne: 8000, recoit: 10000, ecart: -0.2 });
  assert.deepEqual(bilanEchange(8000, 3000, 10000), { donne: 11000, recoit: 10000, ecart: 0.1 });
  assert.equal(bilanEchange(5000, -100, 5000).ecart, 0, 'des pièces en moins ne comptent pas'); });
