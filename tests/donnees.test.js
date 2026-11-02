const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const lire = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'));
const deJs = (f, c) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8').match(new RegExp('const ' + c + ' = ([\\s\\S]*);\\s*$'))[1]);
test('standing : copie .js identique au .json, seulement des 2 et des 3, plus de 600 communes au 3', () => {
  const s = lire('standing.json'); assert.deepEqual(deJs('standing.js', 'STANDING'), s);
  assert.ok(Object.values(s).every((v) => v === 2 || v === 3)); assert.ok(Object.values(s).filter((v) => v === 3).length > 600); });
test('monuments : copie .js identique, 60 nationaux, tous avec code INSEE et coordonnées en France, identifiants uniques', () => {
  const m = lire('monuments.json'); assert.deepEqual(deJs('monuments.js', 'MONUMENTS'), m);
  assert.equal(m.filter((x) => x.palier === 'national').length, 60);
  assert.ok(m.every((x) => /^(\d{5}|2[AB]\d{3})$/.test(x.insee)), 'code INSEE');
  assert.ok(m.every((x) => x.lon > -5.5 && x.lon < 9.8 && x.lat > 41.2 && x.lat < 51.2), 'en France métropolitaine');
  assert.equal(new Set(m.map((x) => x.id)).size, m.length);
  assert.ok(m.some((x) => x.nom === 'Tour Eiffel' && x.palier === 'national')); });
