// La page du jeu se lit sans erreur de syntaxe (18 nov. 2026) : index.html tient sur de longues lignes, et un commentaire
// « // » posé au milieu d'une ligne en efface la fin sans bruit (c'est arrivé deux fois : le jeu ne démarrait plus).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('les scripts écrits dans index.html sont lisibles', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, 'index.html a ses scripts');
  for (const s of scripts) assert.doesNotThrow(() => new Function(s), 'un script de index.html ne se lit pas : ' + s.slice(0, 80));
});

test('les scripts de src/ sont lisibles', () => {
  const dossier = path.join(__dirname, '..', 'src');
  for (const f of fs.readdirSync(dossier).filter((n) => n.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(dossier, f), 'utf8');
    assert.doesNotThrow(() => new Function(s), f + ' ne se lit pas');
  }
});
