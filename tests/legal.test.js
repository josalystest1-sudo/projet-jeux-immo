// Les pages légales (5 nov. 2026, avant la pub) : elles existent, le jeu y renvoie, et elles disent ce qui a été décidé.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('les trois pages légales existent et se renvoient les unes aux autres', () => {
  for (const f of ['conditions.html', 'confidentialite.html', 'mentions-legales.html']) {
    const s = lire(f);
    assert.match(s, /<html lang="fr">/);
    assert.match(s, /SIREN 941 648 156|SIREN : 941 648 156/, f + ' : l’éditeur identifié');
    assert.match(s, /contact@citydeck\.fr/, f + ' : un contact');
  }
});

test('les conditions disent ce que Gautier a décidé', () => {
  const c = lire('conditions.html');
  assert.match(c, /Des joueurs automatiques peuvent animer le jeu\./, 'la phrase générale sur les joueurs automatiques (GDD § 5 quater)');
  assert.match(c, /L221-28/, 'la renonciation au droit de rétractation pour un contenu numérique');
  assert.match(c, /Belgique ou aux Pays-Bas/, 'pas de packs en Belgique ni aux Pays-Bas');
  assert.match(c, /aucune valeur monétaire/, 'les monnaies du jeu sans valeur');
  assert.match(c, /aucun droit sur le lieu réel/, 'les lieux du jeu ne donnent aucun droit réel');
});

test('le jeu renvoie aux pages légales : réglages, inscription, paiement', () => {
  const html = lire('index.html'), compte = lire('src/compte.js');
  for (const f of ['conditions.html', 'confidentialite.html', 'mentions-legales.html']) assert.ok(html.includes(`href="${f}"`), 'réglages : ' + f);
  assert.ok(html.includes('href="conditions.html#vente"'), 'la fenêtre de paiement renvoie aux conditions de vente');
  assert.ok(compte.includes('conditions.html') && compte.includes('confidentialite.html'), 'l’écran d’inscription renvoie aux conditions et à la confidentialité');
  assert.match(html, /og:image" content="https:\/\/citydeck\.fr\/icones\/partage\.jpg"/);
  assert.ok(fs.statSync(path.join(__dirname, '..', 'icones', 'partage.jpg')).size < 300 * 1024, 'l’image de partage reste sous 300 Ko (WhatsApp)');
});
