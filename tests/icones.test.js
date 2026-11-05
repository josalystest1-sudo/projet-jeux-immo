// Les icônes de l'interface (src/icones.js) : le style façon Pokémon TCG Pocket (5 nov. 2026, docs/DESIGN.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../src/icones.js');

test('chaque émoji remplacé a son icône dessinée, au trait', () => {
  for (const [e, nom] of Object.entries(I.EMOJI_ICONE)) {
    assert.ok(I.ICONES[nom], `${e} → ${nom} : pas de dessin`);
    assert.ok(!e.includes('️'), `${e} : écrire l'émoji sans le sélecteur de variante (il est accepté tout seul)`);
  }
  const s = I.ico('pack');
  assert.match(s, /^<svg class="ico-svg"[^>]*fill="none" stroke="currentColor"/);   // une seule couleur : celle du texte
  assert.strictEqual(I.ico('inconnue'), '');
});

test('les icônes des lieux et la pièce gardent leurs couleurs (jamais remplacées)', () => {
  // la pièce passe par avecPieces() ; les lieux de culte (toutes les religions), les monuments, les avatars sont des contenus
  for (const e of ['🪙', '⛪', '🕌', '🕍', '🛕', '☸', '🗼', '🏰', '🦁', '🥇']) assert.ok(!(e in I.EMOJI_ICONE), e);
});

test('la page charge les icônes et pose le style', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<html lang="fr" class="pocket">/);
  assert.match(html, /<script src="src\/icones\.js"><\/script>/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(css, /ico-t\{display:contents\}/);
});
