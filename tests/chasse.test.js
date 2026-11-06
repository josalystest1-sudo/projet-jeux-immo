// La chasse au trésor (src/regles/chasse.js, GDD § 5 quinquies) : calendrier, indices, pas, arrivée.
const test = require('node:test'); const assert = require('node:assert');
const Chasse = require('../src/regles/chasse.js'); const eco = require('../data/economie.json');
const CH = Chasse.creer(eco), H = 3600000, MIN = 60000;
const CIBLE = { lon: 2.34, lat: 48.88, numero: '12', rue: 'Rue des Martyrs', label: '12 Rue des Martyrs' };
const chasse = (debut) => ({ id: 'c1', numero: 1, commune: 'Paris', depart: { lon: 2.3522, lat: 48.8566 }, annonce: debut - 5 * MIN, debut, fin: debut + 15 * MIN, cible: CIBLE });

test('le calendrier : une chasse à chaque heure pile, de 9 h à 23 h (heure de Paris), annoncée 5 minutes avant', () => {
  const t = Date.UTC(2026, 10, 6, 10, 20);           // 11 h 20 à Paris (UTC+1 en novembre)
  const c = CH.prochaine(t); assert.equal(c.debut, Date.UTC(2026, 10, 6, 11, 0)); assert.equal(c.annonce, c.debut - 5 * MIN); assert.equal(c.fin, c.debut + 15 * MIN);
  assert.equal(CH.prochaine(Date.UTC(2026, 10, 6, 10, 5)).debut, Date.UTC(2026, 10, 6, 10, 0), 'celle de 11 h dure encore');
  const nuit = CH.prochaine(Date.UTC(2026, 10, 6, 22, 30));   // 23 h 30 à Paris : la prochaine est à 9 h le lendemain
  assert.equal(nuit.debut, Date.UTC(2026, 10, 7, 8, 0));
});

test('les états d’une chasse : attente, annonce, en cours, trouvée, finie', () => {
  const c = chasse(10 * H);
  assert.equal(CH.etat(c, 10 * H - 10 * MIN), 'attente'); assert.equal(CH.etat(c, 10 * H - MIN), 'annonce');
  assert.equal(CH.etat(c, 10 * H + MIN), 'en_cours'); assert.equal(CH.etat(c, 10 * H + 16 * MIN), 'finie');
  assert.equal(CH.etat(Object.assign({}, c, { trouve_le: 10 * H + 3 * MIN }), 10 * H + 4 * MIN), 'trouvee');
});

test('les indices : un de plus toutes les 2 minutes, le trésor toujours dans le cercle, caché jusqu’à la fin', () => {
  const c = chasse(10 * H);
  assert.deepEqual(CH.vue(c, 10 * H + MIN).indices, [], 'au départ : la commune seule');
  const v3 = CH.vue(c, 10 * H + 5 * MIN); assert.equal(v3.niveau, 2); assert.equal(v3.tresor, null); assert.equal(v3.prochainIndice, 10 * H + 6 * MIN);
  for (const i of CH.indices(c, 5).filter((x) => x.type === 'cercle')) {
    const d = Chasse.distance(i, CIBLE); assert.ok(d < i.rayon * 0.61, `dans le cercle de ${i.rayon} m (${d})`); assert.ok(d > 0, 'pas au centre');
  }
  const tous = CH.indices(c, 5).map((x) => x.type + ':' + (x.texte || x.rayon));
  assert.deepEqual(tous, ['cercle:600', 'cercle:300', 'rue:Rue des Martyrs', 'cercle:100', 'cote:pair', 'numero:12 Rue des Martyrs']);
  assert.equal(CH.vue(c, 10 * H + 16 * MIN).tresor, '12 Rue des Martyrs', 'révélé à la fin');
  assert.ok(!JSON.stringify(CH.vue(c, 10 * H + 9 * MIN)).includes('12 Rue des Martyrs'), 'jamais le numéro avant le dernier indice');
});

test('un pas trop rapide (un saut) est refusé ; l’arrivée se joue à 30 m', () => {
  const a = { lon: 2.34, lat: 48.88, le: 0 };
  assert.ok(CH.pasValide(a, Object.assign(Chasse.decale(a, 90, 22), { le: 2000 })), '22 m en 2 s');
  assert.ok(!CH.pasValide(a, Object.assign(Chasse.decale(a, 90, 80), { le: 2000 })), '80 m en 2 s');
  assert.ok(CH.arrive(Chasse.decale(CIBLE, 45, 25), CIBLE)); assert.ok(!CH.arrive(Chasse.decale(CIBLE, 45, 40), CIBLE));
});

test('le trésor est cherché entre 500 m et 2 km du départ ; la commune est tirée parmi les assez grandes', () => {
  let s = 1; const alea = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const dep = { lon: 2.35, lat: 48.85 };
  for (let k = 0; k < 50; k++) { const d = Chasse.distance(dep, CH.pointCible(dep, alea)); assert.ok(d >= 499 && d <= 2001, String(d)); }
  const liste = [['28105', 'Combres', 1.06, 48.33, 547, '28'], ['28085', 'Chartres', 1.48, 48.44, 38000, '28']];
  for (let n = 0; n < 10; n++) assert.equal(CH.commune(liste, n)[1], 'Chartres');
});
