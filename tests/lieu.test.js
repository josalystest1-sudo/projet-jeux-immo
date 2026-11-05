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
test('un bâtiment par rareté : Maison, Immeuble, Tour, Gratte-ciel, Palace, Prestige', () => {
  assert.deepEqual(R.NIVEAUX.map((n) => n.nom), ['Terrain', 'Maison', 'Immeuble', 'Tour', 'Gratte-ciel', 'Palace', 'Prestige']);
  const celebreVillage = { type: 'lieu', notoriete: 'celebre', citycode: '28105' }, nomeParis = { id: 'poi2', type: 'lieu', citycode: '75109' };
  const exemples = [clevilliers, { citycode: '21231' }, egliseClev, martyrs, celebreVillage, eiffel];
  assert.deepEqual(exemples.map(R.rarete), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(exemples.map((l) => R.texteNiveau(R.plafond(l))), ['Maison', 'Immeuble', 'Tour', 'Gratte-ciel', 'Palace', 'Prestige']);
  for (let r = 1; r <= 6; r++) assert.equal(R.plafond(exemples[r - 1]), r, 'rareté ' + r + ' = ' + r + ' bâtiments');
  assert.equal(R.texteNiveau(R.plafond(nomeParis)), 'Gratte-ciel', 'lieu nommé à Paris : Épique');
  assert.ok(R.peutConstruire({ ...eiffel, niveau: 5 }, 6), 'un monument construit le Prestige après le Palace');
  assert.ok(!R.peutConstruire({ ...celebreVillage, niveau: 5 }, 6), 'pas de Prestige hors monument'); });
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
test('commune du jeu : Paris par arrondissement, les autres par leur nom', () => {
  const { nomCommune } = require('../src/regles/lieu.js');
  assert.equal(nomCommune('75109', 'Paris'), 'Paris 9e'); assert.equal(nomCommune('75101', 'Paris'), 'Paris 1er');
  assert.equal(nomCommune('92007', 'Bagneux'), 'Bagneux'); assert.equal(nomCommune('', 'Nîmes'), 'Nîmes'); assert.equal(nomCommune('28105', ''), '28105'); });
test('le jour du jeu : minuit à Paris en vrais jours, tranches de jourMs en accéléré', () => {
  const { jourDuJeu, secondesAvantJourSuivant } = require('../src/regles/lieu.js');
  const avantMinuit = Date.UTC(2026, 10, 3, 22, 59, 0), apresMinuit = Date.UTC(2026, 10, 3, 23, 1, 0);   // 23 h 59 et 0 h 01 à Paris (UTC+1)
  assert.equal(jourDuJeu(apresMinuit, 86400000) - jourDuJeu(avantMinuit, 86400000), 1, 'le jour change à minuit, heure de Paris');
  assert.equal(secondesAvantJourSuivant(avantMinuit, 86400000), 60);
  assert.equal(jourDuJeu(125000, 60000), 2); assert.equal(secondesAvantJourSuivant(125000, 60000), 55);
  const ete = Date.UTC(2026, 6, 1, 21, 30, 0);   // 23 h 30 à Paris l'été (UTC+2)
  assert.equal(secondesAvantJourSuivant(ete, 86400000), 1800); });
test('le début d’un jour du jeu (la fin d’une semaine d’enchères) : minuit à Paris, ou n × jourMs en accéléré', () => {
  const { jourDuJeu, debutJour } = require('../src/regles/lieu.js');
  assert.equal(debutJour(3, 60000), 180000);
  for (const t of [Date.UTC(2026, 10, 3, 15, 0, 0), Date.UTC(2026, 6, 1, 12, 0, 0), Date.UTC(2027, 2, 28, 12, 0, 0)]) {   // hiver, été, jour du changement d'heure
    const n = jourDuJeu(t, 86400000), d = debutJour(n, 86400000);
    assert.equal(jourDuJeu(d, 86400000), n, 'le début est bien dans le jour'); assert.equal(jourDuJeu(d - 1, 86400000), n - 1, 'une milliseconde avant, c’est la veille');
  }
  assert.equal(debutJour(jourDuJeu(Date.UTC(2026, 10, 3, 15, 0, 0), 86400000), 86400000), Date.UTC(2026, 10, 2, 23, 0, 0), 'le 3 novembre commence à 23 h UTC la veille (minuit à Paris)'); });
test('la valeur qui bouge : ventes de la commune, activité du quartier, tendance de la semaine', () => {
  assert.equal(R.indiceCommune([]), 0, 'pas de vente : pas d’effet');
  assert.ok(Math.abs(R.indiceCommune([{ prix: 12000, valeurRef: 10000 }, { prix: 11000, valeurRef: 10000 }]) - 0.15) < 1e-9, 'vendu 15 % au-dessus en moyenne');
  assert.equal(R.indiceCommune([{ prix: 100000, valeurRef: 10000 }]), 0.3, 'borné à +30 %'); assert.equal(R.indiceCommune([{ prix: 1, valeurRef: 10000 }]), -0.3, 'borné à −30 %');
  assert.equal(R.indiceQuartier(0), -0.05, 'isolé : −5 %'); assert.ok(Math.abs(R.indiceQuartier(10) - 0.05) < 1e-9); assert.equal(R.indiceQuartier(500), 0.2, 'borné à +20 %');
  const t = Array.from({ length: 96 }, (_, i) => R.tendance(String(i + 1).padStart(2, '0'), 3));
  assert.ok(t.some((x) => x > 0) && t.some((x) => x < 0) && t.filter((x) => x === 0).length > 48, 'quelques départements en vogue, d’autres en baisse, la plupart stables');
  assert.ok(t.every((x) => x === 0 || (Math.abs(x) >= 0.05 && Math.abs(x) <= 0.15)));
  assert.equal(R.tendance('33', 3), R.tendance('33', 3), 'la même pour tous'); assert.notDeepEqual(t, Array.from({ length: 96 }, (_, i) => R.tendance(String(i + 1).padStart(2, '0'), 4)), 'elle change chaque semaine');
  const l = { ...martyrs, niveau: 2 }; assert.equal(R.valeurMarche(l, R.indice({ commune: 0.1, quartier: 0, tendance: 0 })), Math.round(R.valeur(l) * 1.1));
  assert.equal(R.coutNiveau(l, 3), R.coutNiveau({ ...martyrs, niveau: 2 }, 3), 'construire coûte pareil, quelle que soit la valeur de marché'); });
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

test('le niveau de la commune ajoute au loyer (bonus), jamais au salaire', () => {
  const R2 = require('../src/regles/lieu.js').creer(require('../data/economie.json'), require('../data/standing.json'));
  const l = { citycode: '28105', city: 'Clévilliers', niveau: 1 }, base = R2.loyerParJour(l);
  assert.strictEqual(R2.loyerParJour(l, 0), base);
  assert.strictEqual(R2.loyerParJour(l, 0.1), Math.round(base * 1.1));
  const J = 86400000, sans = R2.aEncaisser([l], 0, J, J), avec = R2.aEncaisser([l], 0, J, J, () => 0.1);
  assert.strictEqual(avec - sans, Math.round(base * 1.1) - base, 'seul le loyer monte, pas le salaire');
});
