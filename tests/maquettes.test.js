// Les maquettes 3D des monuments (src/maquettes.js) : chacune correspond à un monument de la liste, posée près de lui,
// et ne masque que des bâtiments de la BD TOPO (identifiants « BATIMENT » + 16 chiffres).
const test = require('node:test'); const assert = require('node:assert');
const { MODELES, MASQUES } = require('../src/maquettes.js');
const MONUMENTS = require('../data/monuments.json');

test('chaque maquette 3D correspond à un monument de la liste, posée à moins de 300 m de lui', () => {
  assert.ok(Object.keys(MODELES).length >= 1);
  for (const [id, m] of Object.entries(MODELES)) {
    const mon = MONUMENTS.find((x) => x.id === id); assert.ok(mon, `${id} : monument inconnu`);
    const d = Math.hypot((m.centre[0] - mon.lon) * 111320 * Math.cos(mon.lat * Math.PI / 180), (m.centre[1] - mon.lat) * 110574);
    assert.ok(d < 300, `${id} : posée à ${Math.round(d)} m du monument`);
    assert.equal(typeof m.construire, 'function'); assert.ok(Number.isFinite(m.orientation));
    assert.ok(m.masquer.every((c) => /^BATIMENT\d{16}$/.test(c)), `${id} : identifiants de bâtiments`);
  }
  assert.equal(new Set(MASQUES).size, MASQUES.length, 'un bâtiment masqué deux fois');
});
