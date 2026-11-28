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

test('le logo au repère à serrure (src/logo.js, 28 nov.) et la pièce ronde à la maison (5 nov.)', () => {
  const Logo = require('../src/logo.js');
  for (const l of [Logo.svg(), Logo.svg(null, { empile: true })]) { assert.match(l, />STREET</); assert.match(l, />KEEP</); assert.match(l, /aria-label="StreetKeep"/); }
  const ic = Logo.icone({ plein: true, zone: true });
  assert.ok(!/CITY|DECK|<text/.test(ic), 'l’icône ne porte plus de nom, seulement le repère'); assert.ok(!/mix-blend-mode/.test(Logo.svg() + ic)); assert.match(ic, /scale\(0\.8\)/);
  // une seule pièce partout : le fichier, l'image de fond des montants (.pc) et le logo dessinent la même maison
  const piece = fs.readFileSync(path.join(__dirname, '..', 'icones', 'piece.svg'), 'utf8');
  assert.ok(piece.includes(Logo.MAISON));
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.ok(css.includes(encodeURIComponent(Logo.MAISON).replace(/%20/g, ' ').slice(0, 30)), 'la pièce des montants (.pc) doit être icones/piece.svg');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('M16 2.3 29.7 13.5'), 'plus de pièce-maison');
});

test('les médailles et les embellissements des communes ont leur dessin en couleur', () => {
  for (const [e, nom] of Object.entries(I.EMOJI_DESSIN)) {
    assert.ok(I.DESSINS[nom], `${e} → ${nom} : pas de dessin`);
    assert.ok(!(e in I.EMOJI_ICONE), `${e} : en couleur ou au trait, pas les deux`);
    assert.ok(!/url\(#|<linearGradient|<radialGradient/.test(I.DESSINS[nom]), `${nom} : pas de dégradé (identifiants répétés dans la page)`);
  }
  assert.match(I.ico('or'), /^<svg class="ico-svg dessin"/);
});
