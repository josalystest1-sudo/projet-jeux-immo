const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
test('data/economie.js est à jour par rapport à data/economie.json', () => {
  const js = fs.readFileSync(path.join(__dirname, '../data/economie.js'), 'utf8'); const m = js.match(/const ECO = ([\s\S]*);\s*$/);
  assert.deepEqual(JSON.parse(m[1]), JSON.parse(fs.readFileSync(path.join(__dirname, '../data/economie.json'), 'utf8')));
});
