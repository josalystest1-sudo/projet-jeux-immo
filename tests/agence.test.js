// L'agence (src/regles/agence.js, GDD § 5 sexies) : employés, renom, briques ; et l'équilibre, vérifié par simulation.
const test = require('node:test'); const assert = require('node:assert');
const ECO = require('../data/economie.json');
const AG = require('../src/regles/agence.js').creer(ECO);
const J = 86400000, H = J / 24;

test('les embauches coûtent de plus en plus cher ; le premier agent coûte moins qu’un salaire quotidien', () => {
  assert.ok(AG.cout('agent', 0) <= ECO.salaire_par_jour, 'personne n’est bloqué après une remise à zéro');
  for (const p of AG.POSTES) for (let n = 0; n < 30; n++) assert.ok(AG.cout(p, n + 1) > AG.cout(p, n));
  assert.ok(Number.isFinite(AG.cout('agent', ECO.agence.employes_max)) && Number.isFinite(AG.cout('directeur', 60)), 'pas de nombre infini');
});

test('le renom : rien sans agent ; les postes se multiplient ; chaque brique de la saison l’accélère', () => {
  assert.strictEqual(AG.debit({ agent: 0, negociateur: 9, directeur: 3 }, 5), 0);
  assert.strictEqual(AG.debit({ agent: 10 }, 0), 10);
  assert.ok(Math.abs(AG.debit({ agent: 10, negociateur: 5, directeur: 1 }, 0) - 10 * 1.6 * 1.6) < 1e-9);
  assert.ok(Math.abs(AG.debit({ agent: 10 }, 5) - 14) < 1e-9);
});

test('le temps : le renom monte heure après heure, 48 h du jeu au plus sans visite ; une nouvelle saison repart de zéro', () => {
  let a = AG.avancer(null, 0, J, 3); assert.deepStrictEqual([a.saison, a.renom, a.briques], [3, 0, 0]);
  a = AG.embaucher(a, 'agent', 1000).agence; a = AG.embaucher(a, 'agent', 1000).agence;
  assert.strictEqual(AG.avancer(a, 10 * H, J, 3).renom, 20);
  assert.strictEqual(AG.avancer(a, 30 * J, J, 3).renom, 2 * 48, 'pas plus de 48 h de production');
  assert.strictEqual(AG.avancer(AG.avancer(a, 5 * H, J, 3), 10 * H, J, 3).renom, 20, 'en deux fois ou en une, le même renom');
  // un serveur d'essai (un jour = une minute) compte de la même façon
  assert.strictEqual(AG.avancer(a, 60000 / 24 * 10, 60000, 3).renom, 20);
  const b = AG.avancer(Object.assign({}, a, { briques: 4, total: 9, renom: 500 }), 5 * H, J, 4);
  assert.deepStrictEqual([b.saison, b.renom, b.briques, b.total, b.e.agent], [4, 0, 0, 9, 0]);
});

test('embaucher : le prix, les fonds, le poste ; poser une brique : tout repart de zéro, la suivante demande plus', () => {
  const a = AG.neuve(0, 0);
  assert.deepStrictEqual(AG.embaucher(a, 'agent', 59), { ok: false, raison: 'fonds', cout: 60 });
  assert.strictEqual(AG.embaucher(a, 'stagiaire', 1e9).raison, 'poste');
  const r = AG.embaucher(a, 'agent', 60); assert.ok(r.ok); assert.strictEqual(r.cout, 60); assert.strictEqual(r.agence.e.agent, 1); assert.strictEqual(a.e.agent, 0, 'l’agence donnée n’est pas modifiée');
  assert.strictEqual(AG.seuil(0), 300); assert.ok(AG.seuil(1) > AG.seuil(0));
  assert.strictEqual(AG.poser(Object.assign({}, r.agence, { renom: 299 })).raison, 'renom');
  const p = AG.poser(Object.assign({}, r.agence, { renom: 300 }));
  assert.deepStrictEqual([p.ok, p.briques, p.agence.briques, p.agence.total, p.agence.renom, p.agence.e.agent], [true, 1, 1, 1, 0, 0]);
  // attendre permet d'en poser plusieurs d'un coup
  assert.strictEqual(AG.briquesPossibles(300 + 420, 0), 2); assert.strictEqual(AG.briquesPossibles(300 + 419, 0), 1);
  const plein = Object.assign(AG.neuve(0, 0), { e: Object.assign({}, AG.neuve(0, 0).e, { agent: ECO.agence.employes_max }) });
  assert.strictEqual(AG.embaucher(plein, 'negociateur', 1e12).raison, 'complet');
});

// ---------------------------------------------------------------- l'équilibre, par simulation
// Un joueur visite son agence une fois par jour pendant une saison (90 jours), y met la moitié de ses revenus, achète
// toujours ce qui rapporte le plus de renom par pièce, et pose ses briques dès qu'il peut.
function saison(revenu, part, attendre, malin) {
  let a = AG.neuve(0, 0), pieces = 0; const jours = [];
  for (let j = 1; j <= 90; j++) {
    a = AG.avancer(a, j * J, J, 0); pieces += revenu * part;
    if (AG.briquesPossibles(a.renom, a.briques) >= (attendre || 1)) { a = AG.poser(a).agence; jours.push(j); }
    for (;;) { let mieux = null; for (const p of AG.POSTES) { const c = AG.prix(a, p); if (c > pieces || !AG.embaucher(a, p, pieces).ok) continue; let g = AG.gain(a, p) / c; if (malin && p === 'associe') g = Infinity; if (malin && p === 'formateur' && c < pieces * 0.15) g = Math.max(g, 1e9); if (g > 0 && (!mieux || g > mieux.g)) mieux = { p, g }; }
      if (!mieux) break; const r = AG.embaucher(a, mieux.p, pieces); pieces -= r.cout; a = r.agence; }
  }
  return { briques: a.briques, jours, e: a.e };
}

test('équilibre : dix fois plus de pièces ne donne pas dix fois plus de briques, mais quelques-unes de plus', () => {
  const b = [400, 2000, 20000, 200000, 2000000].map((r) => saison(r, 0.5).briques);
  for (let i = 1; i < b.length; i++) { assert.ok(b[i] > b[i - 1], 'dépenser plus rapporte toujours un peu plus : ' + b); assert.ok(b[i] <= b[i - 1] * 1.6, 'mais jamais en proportion : ' + b); }
  assert.ok(b[4] <= b[0] * 3.5, 'cinq mille fois plus de revenus : pas plus de trois fois et demie les briques (' + b + ')');
});

test('équilibre : un débutant pose sa première brique dans la première semaine, et personne ne reste sans rien faire un mois', () => {
  for (const r of [400, 2000, 20000, 200000]) { const s = saison(r, 0.5);
    assert.ok(s.jours[0] <= 7, 'première brique au jour ' + s.jours[0] + ' pour ' + r + ' pièces par jour');
    assert.ok(s.briques >= 8, 'au moins huit briques dans la saison');
    let trou = 0; for (let i = 1; i < s.jours.length; i++) trou = Math.max(trou, s.jours[i] - s.jours[i - 1]);
    assert.ok(trou <= 21, 'jamais plus de trois semaines entre deux briques (' + s.jours + ')'); }
});

test('équilibre : pas de ligne droite, les trois postes servent ; attendre pour poser deux briques ne fait ni gagner ni perdre gros', () => {
  const gros = saison(200000, 0.5).e; assert.ok(gros.agent > 0 && gros.negociateur > 0 && gros.directeur > 0, 'un gros joueur embauche les trois postes : ' + JSON.stringify(gros));
  const petit = saison(400, 0.5).e; assert.ok(petit.agent > petit.negociateur, 'un débutant vit surtout de ses agents');
  for (const r of [2000, 200000]) { const vite = saison(r, 0.5, 1).briques, patient = saison(r, 0.5, 2).briques; assert.ok(Math.abs(vite - patient) <= 2, 'deux façons de jouer qui se valent : ' + vite + ' et ' + patient); }
  // la moitié ou tout le revenu : tout y mettre rapporte un peu plus, pas le double
  const moitie = saison(2000, 0.5).briques, tout = saison(2000, 1).briques; assert.ok(tout >= moitie && tout <= moitie + 3);
});

// ---------------------------------------------------------------- les postes ajoutés le 22 nov. 2026
test('les nouveaux postes : aucun ne produit de renom seul ; chacun a un petit effet, un nombre limité, un prix qui grimpe', () => {
  const P = ECO.agence.postes, v = AG.neuve(0, 0).e;
  for (const p of ['receptionniste', 'formateur', 'photographe', 'associe']) { assert.strictEqual(AG.debit(Object.assign({}, v, { [p]: 5 }), 9), 0, p + ' ne produit rien sans agent'); assert.ok(P[p].max > 0 && P[p].croissance >= 1.6, p + ' : limité et de plus en plus cher'); }
  assert.strictEqual(AG.heuresSansVisite(v), 48); assert.strictEqual(AG.heuresSansVisite(Object.assign({}, v, { receptionniste: 3 })), 66); assert.strictEqual(AG.heuresSansVisite(Object.assign({}, v, { receptionniste: 99 })), 48 + P.receptionniste.max * P.receptionniste.heures);
  const a = Object.assign(AG.neuve(0, 0), { e: Object.assign({}, v, { agent: 2, receptionniste: 2 }) }); assert.strictEqual(AG.avancer(a, 30 * J, J, 0).renom, 2 * 60, '60 h de production avec deux réceptionnistes');
  const f = Object.assign(AG.neuve(0, 0), { e: Object.assign({}, v, { formateur: 5 }) });
  assert.strictEqual(AG.prix(f, 'agent'), Math.ceil(60 * Math.pow(0.98, 5))); assert.strictEqual(AG.prix(f, 'formateur'), AG.cout('formateur', 5), 'pas de remise sur les formateurs eux-mêmes'); assert.strictEqual(AG.prix(f, 'associe'), AG.cout('associe', 0));
  assert.ok(Math.abs(AG.debit(Object.assign({}, v, { agent: 10, photographe: 5 }), 10) - 10 * (1 + (0.08 + 5 * P.photographe.brique) * 10)) < 1e-9); assert.strictEqual(AG.debit(Object.assign({}, v, { agent: 10, photographe: 5 }), 0), 10, 'sans brique, le photographe ne sert à rien');
  const plein = Object.assign(AG.neuve(0, 0), { e: Object.assign({}, v, { formateur: P.formateur.max }) }); assert.strictEqual(AG.embaucher(plein, 'formateur', 1e15).raison, 'max');
});

test('l’associé : ouvert après 5 briques, très cher, il reste et fait garder une part des agents et des négociateurs', () => {
  const P = ECO.agence.postes.associe, v = AG.neuve(0, 0).e;
  assert.deepStrictEqual(AG.embaucher(AG.neuve(0, 0), 'associe', 1e15), { ok: false, raison: 'verrou', briques: 5 });
  let a = Object.assign(AG.neuve(0, 0), { briques: 5, e: Object.assign({}, v, { agent: 40, negociateur: 20, directeur: 3, formateur: 4 }), renom: 1e9 });
  for (let k = 0; k < 2; k++) { const r = AG.embaucher(a, 'associe', 1e15); assert.ok(r.ok); assert.strictEqual(r.cout, Math.ceil(P.base * Math.pow(P.croissance, k))); a = r.agence; }
  assert.ok(AG.cout('associe', 1) >= 7 * AG.cout('associe', 0) && AG.cout('associe', 0) >= 50000, 'le suivant est beaucoup plus cher');
  const p = AG.poser(a).agence; assert.deepStrictEqual([p.e.associe, p.e.agent, p.e.negociateur, p.e.directeur, p.e.formateur], [2, 8, 4, 0, 0], 'les associés restent ; 20 % des agents et des négociateurs aussi');
  const tous = Object.assign({}, a, { e: Object.assign({}, a.e, { associe: P.max }) }); assert.strictEqual(AG.poser(tous).agence.e.agent, 20, 'jamais plus de la moitié'); assert.strictEqual(AG.embaucher(tous, 'associe', 1e15).raison, 'max');
  assert.strictEqual(AG.avancer(p, 1, J, 1).e.associe, 0, 'une nouvelle saison : tout repart de zéro, les associés aussi');
});

test('équilibre : même avec tous les postes et vingt millions de pièces par jour, les briques restent mesurées', () => {
  const b = [400, 2000, 20000, 200000, 2000000, 20000000].map((r) => saison(r, 0.5, 1, true).briques);
  for (let i = 1; i < b.length; i++) assert.ok(b[i] >= b[i - 1] && b[i] <= b[i - 1] + 8, 'dix fois plus de pièces : quelques briques de plus, pas davantage (' + b + ')');
  assert.ok(b[5] <= 40, 'jamais de compteur aberrant : ' + b); assert.ok(b[5] <= b[0] * 3.5);
  for (const r of [2000, 2000000]) { const sans = saison(r, 0.5).briques, avec = saison(r, 0.5, 1, true).briques; assert.ok(Math.abs(avec - sans) <= 3, 'les nouveaux postes aident sans tout changer : ' + sans + ' et ' + avec); }
});
