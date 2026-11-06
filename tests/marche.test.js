// La marche dans les rues (src/marche.js) : un carrefour d'essai, la manette, la caméra derrière le marcheur.
const test = require('node:test'); const assert = require('node:assert');
const Marche = require('../src/marche.js');
const M = Marche.creer({ vitesse: 10 });
// la rue A va du sud au nord (lon 2), la rue B la croise d'ouest en est à mi-chemin (lat 48.001) ; A s'arrête au nord
const RUES = [[2, 48, 2, 48.001, 'Rue A'], [2, 48.001, 2, 48.002, 'Rue A'], [1.998, 48.001, 2, 48.001, 'Rue B'], [2, 48.001, 2.002, 48.001, 'Rue B']];
const marcher = (m, joy, secondes) => { let d = 0; for (let i = 0; i < Math.round(secondes / 0.05); i++) d += M.pas(m, RUES, joy, 0.05); return d; };
const metresNord = (m) => (m.lat - 48) * 110540, metresEst = (m) => (m.lon - 2) * 111320 * Math.cos(48 * Math.PI / 180);

test('tout droit : on suit la rue, à la vitesse prévue, et l’on s’arrête au bout', () => {
  const m = M.depart(RUES, { lon: 2.00002, lat: 48.0002 }, 10);
  assert.equal(m.rue, 'Rue A'); assert.ok(Math.abs(m.cap - 0) < 1);
  const d = marcher(m, { x: 0, y: -1 }, 3);
  assert.ok(Math.abs(d - 30) < 0.5, `30 m en 3 s (${d})`); assert.ok(Math.abs(metresEst(m)) < 1, 'sur l’axe de la rue');
  marcher(m, { x: 0, y: -1 }, 30);
  assert.equal(m.bouge, false, 'arrêté au bout de la rue'); assert.ok(metresNord(m) > 215 && metresNord(m) < 225, String(metresNord(m)));
});

test('à droite, pris à l’avance : on continue tout droit, puis on tourne au carrefour, sans tourner en rond', () => {
  const m = M.depart(RUES, { lon: 2, lat: 48.0002 }, 0);
  marcher(m, { x: 1, y: 0 }, 12);
  assert.ok(Math.abs(m.cap - 90) < 1, `vers l’est (${m.cap})`);
  assert.ok(metresEst(m) > 25 && Math.abs(metresNord(m) - 110.5) < 1.5, `dans la rue B (${metresEst(m)}, ${metresNord(m)})`);
});

test('à gauche au carrefour, puis tout droit dans la nouvelle rue', () => {
  const m = M.depart(RUES, { lon: 2, lat: 48.00095 }, 0);
  marcher(m, { x: -1, y: -0.2 }, 0.5); marcher(m, { x: 0, y: -1 }, 2);
  assert.ok(Math.abs(m.cap - 270) < 1, `vers l’ouest (${m.cap})`); assert.ok(metresEst(m) < -15);
});

test('vers le bas : un seul demi-tour, puis on marche dans l’autre sens', () => {
  const m = M.depart(RUES, { lon: 2, lat: 48.0005 }, 0);
  marcher(m, { x: 0, y: 1 }, 2);
  assert.ok(Math.abs(m.cap - 180) < 1, String(m.cap)); assert.ok(metresNord(m) < 55 - 15, 'parti vers le sud');
});

test('la caméra rejoint peu à peu le sens de la marche', () => {
  const m = M.depart(RUES, { lon: 2, lat: 48.00095 }, 0);
  M.pas(m, RUES, { x: 1, y: 0 }, 0.05);
  assert.ok(Math.abs(m.cap - 90) < 1 && m.camCap > 0 && m.camCap < 20, `elle tourne sans sauter (${m.camCap})`);
  marcher(m, { x: 0, y: -1 }, 1.5);
  assert.ok(Math.abs(m.camCap - 90) < 1, String(m.camCap));
});

test('manette au repos : on ne bouge pas', () => {
  const m = M.depart(RUES, { lon: 2, lat: 48.0005 }, 0), avant = m.lat;
  assert.equal(marcher(m, { x: 0.05, y: -0.1 }, 1), 0); assert.equal(m.lat, avant); assert.equal(m.bouge, false);
});
