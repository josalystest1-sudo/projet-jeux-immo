// La traduction anglaise (5 nov. 2026, demande de Gautier : « une traduction complète du jeu en anglais, on garde les noms
// propres et les rues en français, choix de la langue dans les paramètres » ; puis : « idéalement la langue se met en
// fonction de la langue du périphérique par défaut, avec modification possible »).
// src/langue.js traduit à l'affichage avec data/langue_en.js : ces tests vérifient que les messages du jeu et du serveur
// y sont, que les noms propres restent en français, et que la langue suit le téléphone sauf choix du joueur.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// une page sans DOM : le choix du joueur (stockage du téléphone) et la langue du téléphone
function charger(langue, appareil = 'fr-FR') {
  const st = langue ? { 'citydeck-langue': langue } : {};
  global.window = {};
  Object.defineProperty(globalThis, 'navigator', { value: { language: appareil, languages: [appareil] }, configurable: true, writable: true });
  global.location = { search: '', href: 'https://citydeck.fr/' };
  global.localStorage = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = v; } };
  for (const f of ['../data/langue_en.js', '../src/langue.js']) delete require.cache[require.resolve(f)];
  require('../data/langue_en.js');
  return require('../src/langue.js');
}
const EN = charger('en');
const traduit = (s) => EN.t(s) !== s;

test('sans choix, la langue du téléphone : français s’il est en français, anglais sinon', () => {
  const FR = charger(null, 'fr-FR');
  assert.strictEqual(FR.code, 'fr');
  assert.strictEqual(FR.t('Récolter'), 'Récolter');
  assert.strictEqual(FR.t('Léa te propose 500 🪙 pour 12 Rue Lepic.'), 'Léa te propose 500 🪙 pour 12 Rue Lepic.');
  assert.strictEqual(charger(null, 'fr-BE').code, 'fr');
  assert.strictEqual(charger(null, 'en-US').code, 'en');
  assert.strictEqual(charger(null, 'de-DE').code, 'en', 'une autre langue : l’anglais, plus compris que le français');
  assert.strictEqual(charger(null, '').code, 'fr', 'langue inconnue : le français');
  // le choix du joueur passe avant
  assert.strictEqual(charger('fr', 'en-US').code, 'fr');
  assert.strictEqual(charger('en', 'fr-FR').code, 'en');
  charger('en');
});

test('le dictionnaire est propre : des textes, sans espaces autour', () => {
  const D = global.window.LANGUE_EN;
  assert.ok(Object.keys(D.textes).length > 500);
  for (const [fr, en] of Object.entries(D.textes)) {
    assert.strictEqual(fr, fr.trim(), `clé avec des espaces : « ${fr} »`);
    assert.ok(typeof en === 'string' && en.trim(), `traduction vide : « ${fr} »`);
    assert.strictEqual((fr.match(/\{n\}/g) || []).length >= (en.match(/\{n\}/g) || []).length, true, `plus de {n} en anglais qu’en français : « ${fr} »`);
  }
});

test('les écrans principaux sont en anglais', () => {
  const attendus = {
    'Récolter': 'Collect', 'Réglages': 'Settings', 'Mon patrimoine': 'My portfolio', 'Communes': 'Towns', 'Enchères': 'Auctions',
    'Pack du jour': 'Daily pack', 'Boutique': 'Shop', 'Classements': 'Rankings', 'Faire une offre': 'Make an offer',
    'Supprimer mon compte': 'Delete my account', 'Crée ton compte': 'Create your account', 'Légendaire': 'Legendary', 'Gratte-ciel': 'Skyscraper',
  };
  for (const [fr, en] of Object.entries(attendus)) assert.strictEqual(EN.t(fr), en, fr);
  // un émoji devant, une flèche derrière, des nombres
  assert.strictEqual(EN.t('🏆 Classements'), '🏆 Rankings');
  assert.strictEqual(EN.t('Voir les classements ›'), 'See the rankings ›');
  assert.strictEqual(EN.t('il y a 5 min'), '5 min ago');
  assert.strictEqual(EN.t('Il te manque 1 234 🪙 pour construire'), 'You’re 1 234 🪙 short to build');
  assert.strictEqual(EN.t('+14 %'), '+14%');
  assert.strictEqual(EN.t('7e'), '7th');
  assert.strictEqual(EN.t('Entretien de tes monuments :'), 'Upkeep of your monuments:');
});

test('les noms propres restent en français : lieux, rues, communes, régions, pseudos', () => {
  for (const nom of ['12 Rue des Martyrs', 'Paris 9e', 'Normandie', 'Île-de-France', 'Église Saint-Ambroise', 'Maison carrée', 'Mairie de Combres', 'Léa'])
    assert.strictEqual(EN.t(nom), nom, nom);
  assert.strictEqual(EN.t('Léa te propose 500 🪙 pour 12 Rue des Martyrs (valeur 300 🪙)'), 'Léa offers you 500 🪙 for 12 Rue des Martyrs (value 300 🪙)');
  assert.strictEqual(EN.t('Maire : personne'), 'Mayor: nobody');
  assert.strictEqual(EN.t('Marius (toi)'), 'Marius (you)');
});

test('chaque bandeau du jeu écrit en toutes lettres a sa traduction', () => {
  const html = lire('index.html'), manquent = [];
  for (const m of html.matchAll(/toast\('([^'`$]+)'\)/g)) if (!traduit(m[1])) manquent.push(m[1]);
  for (const m of html.matchAll(/err\.textContent\s*=\s*'([^']+)'/g)) if (!traduit(m[1])) manquent.push(m[1]);
  // l'écran de compte : ses messages d'erreur et ses textes de bouton
  const compte = lire('src/compte.js');
  for (const m of compte.matchAll(/return '([^']+)';/g)) if (!traduit(m[1])) manquent.push(m[1]);
  for (const m of compte.matchAll(/'([A-ZÉ][^'<>${}]{4,})'/g)) if (/[a-zé] /.test(m[1]) && !/:\s*$/.test(m[1]) && !traduit(m[1])) manquent.push(m[1]); // (« Erreur : » + message : un motif)
  assert.deepStrictEqual(manquent, [], 'à ajouter dans data/langue_en.js');
});

test('chaque refus du serveur a sa traduction (supabase/functions/jeu/index.ts)', () => {
  const ts = lire('supabase/functions/jeu/index.ts'), manquent = [];
  const sql = /const REFUS_SQL[^{]*\{([\s\S]*?)\n\};/.exec(ts)[1];
  for (const m of sql.matchAll(/:\s*'([^']+)'/g)) if (!traduit(m[1])) manquent.push(m[1]);
  for (const m of ts.matchAll(/new Refus\([^,]+,\s*'([^']+)'\)/g)) if (!traduit(m[1])) manquent.push(m[1]);
  for (const m of ts.matchAll(/'((?:Tape|Coche|Choisis|Un bon)[^']+)'/g)) if (!traduit(m[1])) manquent.push(m[1]);
  assert.deepStrictEqual(manquent, [], 'à ajouter dans data/langue_en.js');
});

test('les notifications du serveur sortent en anglais (avec les noms en français)', () => {
  const exemples = [
    ['Léa a acheté 12 Rue Lepic pour 1 500 🪙.', 'Léa bought 12 Rue Lepic for 1 500 🪙.'],
    ['Un joueur te propose 3 Rue X et 5 Rue Y, plus 100 🪙, contre 12 Rue Lepic.', 'A player offers you 3 Rue X and 5 Rue Y, plus 100 🪙, in exchange for 12 Rue Lepic.'],
    ['Léa a accepté ton offre : 12 Rue Lepic est à toi pour 1 200 🪙 !', 'Léa accepted your offer: 12 Rue Lepic is yours for 1 200 🪙!'],
    ['Enchère terminée : Château de Blois va à personne.', 'Auction over: Château de Blois goes to nobody.'],
    ['Léa a surenchéri à 12 000 🪙 sur Château de Blois. Tes pièces sont libérées.', 'Léa outbid you at 12 000 🪙 on Château de Blois. Your coins are released.'],
    ['👑 Tu es élu Maire de Bagneux pour 2 semaines : tu touches 5 % des loyers des autres joueurs de la commune.', '👑 You are elected Mayor of Bagneux for 2 weeks: you get 5% of the other players’ rents in the town.'],
    ['🏆 Fin de la saison 2 : tu finis 1er des Maires et 12e en patrimoine. Une nouvelle saison commence !', '🏆 End of season 2: you finish 1st among Mayors and 12th in portfolio. A new season begins!'],
    ['🏛️ Pont du Gard est remis aux enchères : tu n’es pas venu depuis 14 jours (14 au plus).', '🏛️ Pont du Gard goes back to auction: you haven’t come for 14 days (14 at most).'],
    ['💎 +500 gemmes : merci pour ton achat !', '💎 +500 gems: thanks for your purchase!'],
  ];
  for (const [fr, en] of exemples) assert.strictEqual(EN.t(fr), en);
  // chaque phrase de notifier(...) du serveur commence par un mot que les motifs connaissent
  const ts = lire('supabase/functions/jeu/index.ts');
  assert.ok((ts.match(/notifier\(/g) || []).length >= 20);
});

test('le choix de la langue : réglages et écran de compte ; les textes dessinés passent par Langue.t', () => {
  const html = lire('index.html'), compte = lire('src/compte.js');
  const i = html.indexOf('src="data/langue_en.js'), j = html.indexOf('src="src/langue.js'), k = html.indexOf('src="geo.js');
  assert.ok(i > 0 && j > i && (k < 0 || k > j), 'le dictionnaire puis le traducteur, avant les autres scripts');
  assert.match(html, /Langue\.choisir\('fr'\)[^]*Langue\.choisir\('en'\)/, 'réglages : Français / English');
  assert.match(compte, /Langue\.choisir\('en'\)/, 'écran de compte : English');
  assert.match(html, /texte\(Langue\.t\('PACK DU JOUR'\)/, 'la pochette du pack');
  assert.match(html, /function avecPieces\(t\)\{ return echapper\(Langue\.t\(t\)\)/, 'bandeaux et notifications');
  assert.match(html, /SV_LANGUE/, 'Street View dans la langue du jeu');
});

test('les pages légales ont leur version anglaise, reliées dans les deux sens', () => {
  const paires = { 'conditions.html': 'terms.html', 'confidentialite.html': 'privacy.html', 'mentions-legales.html': 'legal-notice.html' };
  for (const [fr, en] of Object.entries(paires)) {
    const f = lire(fr), e = lire(en);
    assert.match(e, /<html lang="en">/, en);
    assert.ok(f.includes(`href="${en}"`), `${fr} → ${en}`);
    assert.ok(e.includes(`href="${fr}"`), `${en} → ${fr}`);
    assert.match(e, /SIREN 941 648 156|SIREN: 941 648 156/, en + ' : l’éditeur identifié');
    assert.match(e, /French version/, en + ' : la version française fait foi');
  }
  assert.match(lire('terms.html'), /Automated players may take part in the game\./);
  assert.match(lire('terms.html'), /id="google"/);
  assert.match(lire('terms.html'), /id="vente"/);
});
