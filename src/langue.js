// CityDeck : la langue du jeu (5 nov. 2026, demande de Gautier : « une traduction complète du jeu en anglais, avec le choix
// de la langue dans les paramètres, français par défaut ; on garde les noms propres et les rues en français »).
//
// Le code du jeu écrit en français. En anglais, ce fichier traduit à l'affichage, comme src/icones.js pour les icônes :
// chaque texte de la page (et les attributs placeholder, aria-label, title, alt) est cherché dans le dictionnaire
// (data/langue_en.js) :
//   1. le texte exact ;
//   2. le texte dont les nombres sont remplacés par {n} (« il y a 5 min » → « il y a {n} min » → « {n} min ago ») ;
//   3. les motifs (expressions régulières), pour les phrases qui contiennent un nom (un joueur, un lieu).
// Ce qui n'est pas trouvé reste en français ; avec ?collecte dans l'adresse, il est noté dans window.__MANQUANTS (pour
// compléter le dictionnaire). Les noms propres (lieux, rues, communes, régions, pseudos) ne sont jamais dans le
// dictionnaire : ils restent en français. Les plaques (.plaque, .numero) ne sont pas traduites (le nom d'un lieu), sauf
// leur petite ligne du haut. Les nombres gardent l'écriture française (48 248), comprise partout.
// Les textes dessinés (pochette du pack, dos des cartes) passent par Langue.t('…') ; les bandeaux et les notifications
// (avecPieces de index.html) aussi, avant que la pièce soit dessinée. Les messages du serveur (refus, notifications)
// arrivent en français et sont traduits comme le reste. Les liens vers les pages légales mènent à leur version anglaise
// (PAGES) ; Street View reçoit &language=en (SV_LANGUE de index.html). Par défaut : la langue du téléphone (français
// s'il est en français, anglais sinon) ; le choix fait dans les réglages ou l'écran de compte est gardé dans le téléphone
// (localStorage 'citydeck-langue') et passe avant : Langue.choisir('fr' | 'en') recharge la page.
(function () {
  const CLE = 'citydeck-langue';
  // la langue du téléphone au premier lancement (Gautier, 5 nov. : « idéalement la langue se met en fonction de la langue
  // du périphérique par défaut, avec modification possible ») : français si le téléphone est en français, anglais pour
  // toute autre langue ; le choix fait dans les réglages (ou l'écran de compte) est gardé et passe avant
  function langueAppareil() {
    try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return !l || /^fr\b/i.test(l) ? 'fr' : 'en'; }
    catch (e) { return 'fr'; }
  }
  let L = 'fr';
  try {
    const q = new URLSearchParams(location.search).get('langue');
    if (q === 'en' || q === 'fr') localStorage.setItem(CLE, q);
    const choix = localStorage.getItem(CLE);
    L = choix === 'en' || choix === 'fr' ? choix : langueAppareil();
  } catch (e) { L = langueAppareil(); }
  const collecte = (() => { try { return new URLSearchParams(location.search).has('collecte'); } catch (e) { return false; } })();
  const manquants = new Set();
  const dico = () => (typeof window !== 'undefined' && window.LANGUE_EN) || { textes: {}, motifs: [] };
  // un nombre écrit à la française : 48 248 (espaces insécables), 1,5 ; aussi 48,248
  const NOMBRE = /\d+(?:[   ]\d{3})*(?:,\d+)?/g;
  const cache = new Map(), produits = new Set();
  const a = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // un nombre ordinal anglais (1st, 2nd, 3rd, 4th…)
  function ordinal(n) { n = Number(n); const d = n % 100; if (d >= 11 && d <= 13) return n + 'th'; return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); }
  // chercher un texte : exact, puis avec les nombres en {n} ({n} dans l'anglais : les nombres dans l'ordre ; {n2} : le 2e),
  // puis les motifs (le remplacement peut être une fonction, qui reçoit aussi T pour traduire un morceau)
  function chercher(texte) {
    const D = dico();
    if (a(D.textes, texte)) return D.textes[texte];
    const nums = []; const cle = texte.replace(NOMBRE, (m) => { nums.push(m); return '{n}'; });
    if (nums.length && a(D.textes, cle)) { let k = 0; return D.textes[cle].replace(/\{n(\d?)\}/g, (m, i) => (i ? nums[i - 1] : nums[k++])); }
    for (const [re, en] of D.motifs) {
      re.lastIndex = 0;
      if (re.test(texte)) { re.lastIndex = 0; return typeof en === 'function' ? texte.replace(re, (...g) => en(T, ...g)) : texte.replace(re, en); }
    }
    return null;
  }
  // ce qui entoure un texte sans en faire partie : un émoji ou un symbole devant (🏆, ⚙️, ↕︎), une flèche derrière (›, ↗)
  const AVANT = /^[^\p{L}\p{N}«(“"'+\-−]+/u, APRES = /[\s·›↗:,;–—-]+$/u;
  function traduire(texte) {
    if (L === 'fr' || !texte) return texte;
    if (cache.has(texte)) { const c = cache.get(texte); return c == null ? texte : c; }
    let r = chercher(texte);
    if (r == null) {
      const av = (texte.match(AVANT) || [''])[0], ap = (texte.slice(av.length).match(APRES) || [''])[0];
      const coeur = texte.slice(av.length, texte.length - ap.length);
      // (en anglais, pas d'espace avant les deux-points)
      if ((av || ap) && coeur && coeur !== texte) { const c = chercher(coeur); if (c != null) r = av + c + ap.replace(/^[\s  ]+(?=[:;])/, ''); }
    }
    if (r == null && collecte && /[a-zà-ÿ]{2}/i.test(texte)) manquants.add(texte);
    if (r != null) produits.add(r);
    cache.set(texte, r); return r == null ? texte : r;
  }
  // traduire un morceau (pour les motifs) : rendu tel quel s'il n'est pas dans le dictionnaire
  function T(x) { if (x == null) return x; const s = String(x), c = s.trim(); if (!c) return s; const r = traduire(c); return s.replace(c, r); }
  // traduire un texte, en gardant les espaces autour
  function t(v) {
    if (L === 'fr' || v == null) return v;
    const s = String(v), c = s.trim(); if (!c || produits.has(c)) return s;
    const r = traduire(c); if (r === c) return s;
    const i = s.indexOf(c); return s.slice(0, i) + r + s.slice(i + c.length);
  }
  // ce qui ne se traduit pas : le code, la carte de la ville, la saisie, et le nom d'un lieu sur sa plaque
  const HORS = '#map,script,style,textarea,.cel-nom,.mlabel,.maplibregl-ctrl-attrib,[data-pas-traduire]';
  function noeud(tx) {
    const v = tx.nodeValue; if (!v || !/[A-Za-zÀ-ÿ%]/.test(v)) return;
    const p = tx.parentNode; if (!p || p.nodeType !== 1) return;
    if (p.matches('.plaque,.numero') || p.closest(HORS)) return;
    const r = t(v); if (r !== v) tx.nodeValue = r;
  }
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  // les pages légales ont leur version anglaise (terms.html, privacy.html, legal-notice.html)
  const PAGES = { 'conditions.html': 'terms.html', 'confidentialite.html': 'privacy.html', 'mentions-legales.html': 'legal-notice.html' };
  function element(el) {
    if (el.tagName === 'A') { const h = el.getAttribute('href') || '', m = /^([a-z-]+\.html)(#.*)?$/.exec(h); if (m && PAGES[m[1]]) el.setAttribute('href', PAGES[m[1]] + (m[2] || '')); }
    if (el.closest(HORS)) return;
    for (const at of ATTRS) { const v = el.getAttribute && el.getAttribute(at); if (v) { const r = t(v); if (r !== v) el.setAttribute(at, r); } }
  }
  function parcourir(racine) {
    if (!racine) return;
    if (racine.nodeType === 3) { noeud(racine); return; }
    if (racine.nodeType !== 1 || racine.closest(HORS)) return;
    element(racine); racine.querySelectorAll('[placeholder],[aria-label],[title],[alt],a[href]').forEach(element);
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT); const l = []; let x;
    while ((x = w.nextNode())) l.push(x);
    l.forEach(noeud);
  }
  let obs = null;
  function demarrer() {
    if (L === 'fr' || obs || !document.body) return;
    document.documentElement.lang = 'en';
    try { document.title = t(document.title); } catch (e) {}
    parcourir(document.body);
    obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') noeud(m.target); else m.addedNodes.forEach(parcourir); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (typeof document !== 'undefined' && L === 'en') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  }
  // changer de langue (les réglages) : on retient le choix et on recharge la page
  function choisir(l) { try { localStorage.setItem(CLE, l === 'en' ? 'en' : 'fr'); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('langue'); location.replace(u.toString()); }
  const Langue = { get code() { return L; }, t, T, traduire, ordinal, choisir, manquants, parcourir, NOMBRE };
  if (typeof window !== 'undefined') { window.Langue = Langue; window.__MANQUANTS = manquants; }
  if (typeof module !== 'undefined') module.exports = Langue;
})();
