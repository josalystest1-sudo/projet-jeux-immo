// CityDeck : les icônes de l'interface, au trait, d'une seule couleur (5 nov. 2026, choix de Gautier : « au trait, une
// couleur », menus façon Pokémon TCG Pocket ; docs/DESIGN.md). Le code du jeu écrit encore des émojis dans ses textes
// (titres, boutons, notifications) : iconiser() remplace à l'affichage ceux de la table EMOJI_ICONE par l'icône dessinée,
// partout sauf dans ce qui est un contenu et garde ses couleurs (les cartes, l'icône d'un lieu, les avatars, la carte de
// la ville, l'ouverture du pack). Un observateur le fait tout seul pour tout ce qui s'affiche ensuite.
// Ajouter une icône : son dessin dans ICONES (grille de 24, traits de 1,6), puis l'émoji qu'elle remplace dans EMOJI_ICONE.
(function () {
  const ICONES = {
    carte: '<path d="M9 3.5 3.5 5.5v15l5.5-2 6 2 5.5-2v-15l-5.5 2-6-2Z"/><path d="M9 3.5v15M15 5.5v15"/>',
    collection: '<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6.5v12A2.5 2.5 0 0 0 7.5 21H15"/><path d="m14 7.6 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z"/>',
    marteau: '<path d="m14.5 12.5-8 8a2.1 2.1 0 0 1-3-3l8-8"/><path d="m16 16 5-5"/><path d="m8 8 5-5"/><path d="m9.5 6.5 8 8"/><path d="m20.5 11.5-8-8"/>',
    edifice: '<path d="M3 21h18"/><path d="M5 18v-7M9.5 18v-7M14.5 18v-7M19 18v-7M4 18h16"/><path d="M2.5 8.5 12 3.5l9.5 5Z"/>',
    pack: '<rect x="6" y="2.5" width="12" height="19" rx="2.2"/><path d="M6 6.8h12"/><path d="m12 10 1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4Z"/>',
    cloche: '<path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 15 6 9.5Z"/><path d="M10 20.3a2.2 2.2 0 0 0 4 0"/>',
    loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    marche: '<circle cx="13.5" cy="4.2" r="1.7"/><path d="M8.5 21 11 14.5l2.5 2.5v4"/><path d="M7.5 11.5 10.5 8l3.5 1 1.5 3.5 2.5 1"/><path d="m11 14.5 1-5.3"/>',
    maison: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    immeuble: '<rect x="6" y="3.5" width="12" height="17" rx="1"/><path d="M9.5 7h1M13.5 7h1M9.5 10.5h1M13.5 10.5h1M9.5 14h1M13.5 14h1M11 20.5v-3h2v3"/>',
    tour: '<path d="M4 20.5h16"/><rect x="5" y="9" width="5" height="11.5"/><rect x="11" y="3.5" width="7" height="17"/><path d="M13.5 7h2M13.5 10.5h2M13.5 14h2M7 12h1M7 15.5h1"/>',
    gratte: '<path d="M4 20.5h16"/><path d="M9 20.5V8l3-4.5 3 4.5v12.5"/><path d="M5 20.5v-7h4M15 13.5h4v7"/><path d="M11 11h2M11 14h2M11 17h2"/>',
    palace: '<path d="M3.5 20.5h17"/><path d="M5 20.5V9h14v11.5"/><path d="M4 9l8-5 8 5"/><path d="M8 12.5v2M12 12.5v2M16 12.5v2M10.5 20.5v-3.5h3v3.5"/>',
    pousse: '<path d="M6 20.5h12"/><path d="M12 20.5v-8"/><path d="M12 12.5C12 9 9.5 6.5 5.5 6.5c0 3.5 2.5 6 6.5 6Z"/><path d="M12 14.5c0-3 2-5.5 6-5.5 0 3-2 5.5-6 5.5Z"/>',
    grue: '<path d="M5 20.5V4.5h10l4 3"/><path d="M5 8.5h14M9 4.5 5 8.5M11 8.5v3.5"/><rect x="9" y="12" width="4" height="3"/><path d="M3.5 20.5h6"/>',
    diamant: '<path d="M6 3.5h12l3 5-9 12-9-12Z"/><path d="M3 8.5h18M9.5 3.5 8 8.5l4 12 4-12-1.5-5"/>',
    hausse: '<path d="M3.5 20.5h17"/><path d="m4.5 15.5 5-5 4 3.5 6-7"/><path d="M15 6.5h4.5V11"/>',
    baisse: '<path d="M3.5 20.5h17"/><path d="m4.5 7.5 5 5 4-3.5 6 7"/><path d="M15 16.5h4.5V12"/>',
    trophee: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4"/><path d="M12 13v4M9.5 17h5v3.5h-5z"/>',
    medaille: '<circle cx="12" cy="15" r="5"/><path d="M9 10.5 6.5 3.5h4L12 7l1.5-3.5h4L15 10.5"/>',
    sablier: '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9"/>',
    couronne: '<path d="m3.5 8 4 4L12 5l4.5 7 4-4-1.5 10.5h-14Z"/><path d="M5 21h14"/>',
    sac: '<path d="M9 4h6l-1.5 3.3h-3Z"/><path d="M10.5 7.3C6 9.5 4.5 13.5 4.5 16.5c0 2.5 2 4 4 4h7c2 0 4-1.5 4-4 0-3-1.5-7-6-9.2"/><path d="M13.6 11.6c-.4-.6-1-.8-1.7-.8-.9 0-1.6.5-1.6 1.2 0 1.7 3.5.9 3.5 2.6 0 .7-.8 1.2-1.8 1.2-.8 0-1.4-.3-1.8-.8M12 9.8v1M12 15.8v1"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    lettre: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    alerte: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    epi: '<path d="M12 21V9"/><path d="M12 13c-3 0-4.5-2-4.5-4.5C10.5 8.5 12 10.5 12 13ZM12 13c3 0 4.5-2 4.5-4.5-3 0-4.5 2-4.5 4.5ZM12 9c-2.2 0-3.3-1.6-3.3-3.6C11 5.4 12 7 12 9Zm0 0c2.2 0 3.3-1.6 3.3-3.6C13 5.4 12 7 12 9Z"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.3-1.6-1.3-2.8 0-1 .8-1.6 1.8-1.6h2.2A3.9 3.9 0 0 0 20.5 10C20.5 6.4 16.7 3.5 12 3.5Z"/><circle cx="8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.8" r="1"/>',
    plan: '<path d="M4 20 20 4"/><path d="M4 20V8M4 20h12"/><path d="M7 17v-2M10 17v-3M13 17v-2"/>',
    epingle: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    ticket: '<path d="M3.5 10a2 2 0 0 0 0 4v4.5h17V14a2 2 0 0 1 0-4V5.5h-17Z"/><path d="M9 7.5v1.5M9 12v1.5M9 16.5v1.5"/>',
    etoile: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
    etincelle: '<path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z"/>',
    cadenas: '<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    personne: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
    etiquette: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9Z"/><circle cx="8" cy="8" r="1.4"/>',
    echange: '<path d="M4 9h13l-3-3.5M20 15H7l3 3.5"/>',
    crayon: '<path d="m4 20 1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z"/><path d="M13.5 7l3 3"/>',
    photo: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4Z"/><circle cx="12" cy="13.5" r="3.5"/>',
    coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    croix: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    livre: '<path d="M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z"/><path d="M12 6.5v13"/>',
    fete: '<path d="M4 20 8.5 8l7.5 7.5Z"/><path d="M14 4.5v2M19.5 10h-2M17.5 6.5 16 8M12.5 9.5c.5-1.5 2-2.5 3.5-2"/>',
    drapeau: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    doigt: '<path d="M9.5 11V5a1.5 1.5 0 0 1 3 0v5.5"/><path d="M12.5 10V9a1.5 1.5 0 0 1 3 0v2M15.5 11a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.5-2L9.5 15"/>',
    de: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/>',
    cb: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 9.5h18M6.5 15h4"/>',
    meteo: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M3.5 9H2M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 19.5h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.3 1.5A2.8 2.8 0 0 0 8 19.5Z"/>',
    parchemin: '<path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8"/><path d="M7 4.5a2 2 0 0 0-2 2V8h4V6.5a2 2 0 0 0-2-2ZM8 19.5a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2Z"/><path d="M10.5 9h5M10.5 12.5h5"/>',
    boussole: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    travaux: '<path d="M3.5 18.5h17"/><rect x="4.5" y="8.5" width="15" height="5" rx="1"/><path d="m8.5 8.5-3 5M13.5 8.5l-3 5M18.5 8.5l-3 5M6.5 13.5v5M17.5 13.5v5"/>'
  };
  // l'émoji (avec ou sans le sélecteur de variante) → l'icône qui le remplace dans l'interface
  const EMOJI_ICONE = {
    '🗺': 'carte', '🏘': 'collection', '🎴': 'collection', '🔨': 'marteau', '🏛': 'edifice', '🎁': 'pack', '🔔': 'cloche', '🔍': 'loupe', '🚶': 'marche',
    '🏠': 'maison', '🏡': 'maison', '🏢': 'immeuble', '🏙': 'tour', '🌆': 'gratte', '🏨': 'palace', '🌱': 'pousse', '🏗': 'grue', '💎': 'diamant',
    '📈': 'hausse', '📉': 'baisse', '🏆': 'trophee', '🏅': 'medaille', '⏳': 'sablier', '⌛': 'sablier', '👑': 'couronne', '💰': 'sac', '🛍': 'sac',
    '⚙': 'reglages', '📨': 'lettre', '✉': 'lettre', '⚠': 'alerte', '🌾': 'epi', '🎨': 'palette', '📐': 'plan', '📍': 'epingle', '📌': 'epingle',
    '🎟': 'ticket', '⭐': 'etoile', '✨': 'etincelle', '🔒': 'cadenas', '👤': 'personne', '🏷': 'etiquette', '🔁': 'echange', '🔄': 'echange',
    '🤝': 'echange', '✏': 'crayon', '📷': 'photo', '✅': 'coche', '❌': 'croix', '📖': 'livre', '🎉': 'fete', '🚩': 'drapeau', '👆': 'doigt',
    '🎲': 'de', '💳': 'cb', '🌤': 'meteo', '📜': 'parchemin', '🧭': 'boussole', '🚧': 'travaux'
  };
  // ce qui garde ses émojis en couleur : un contenu, pas l'interface
  const EXCLUS = '#map,#packscene,#reveal,.c3d,.cl,.ccarte,.rcard,.art,.ico-lieu,.av,.avgrid,.voyage-pin,svg,select,option,textarea,input,script,style,.pas-icone-garder';
  const cles = Object.keys(EMOJI_ICONE).sort((a, b) => b.length - a.length);
  const RE = new RegExp('(?:' + cles.join('|') + ')️?', 'gu');
  const echapper = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function ico(nom, classe) {
    const d = ICONES[nom]; if (!d) return '';
    return '<svg class="ico-svg' + (classe ? ' ' + classe : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  function remplacer(t) {
    const v = t.nodeValue; RE.lastIndex = 0; if (!v || !RE.test(v)) return;
    const p = t.parentNode; if (!p || p.nodeType !== 1 || p.closest(EXCLUS)) return;
    RE.lastIndex = 0;
    const s = document.createElement('ico-t');   // une balise à part : aucune règle « span » du jeu ne la touche (la légende repliée cache ses span)
    s.innerHTML = echapper(v).replace(RE, (m) => ico(EMOJI_ICONE[m.replace('️', '')]));
    p.replaceChild(s, t);
  }
  function iconiser(racine) {
    if (!racine) return;
    if (racine.nodeType === 3) { remplacer(racine); return; }
    if (racine.nodeType !== 1 || racine.closest(EXCLUS)) return;
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT); const l = []; let t;
    while ((t = w.nextNode())) { RE.lastIndex = 0; if (RE.test(t.nodeValue)) l.push(t); }
    l.forEach(remplacer);
  }
  let obs = null;
  function demarrer() {
    if (obs || !document.body) return;
    iconiser(document.body);
    obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') remplacer(m.target); else m.addedNodes.forEach(iconiser); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  }
  const Icones = { ICONES, EMOJI_ICONE, ico, iconiser };
  if (typeof window !== 'undefined') { window.Icones = Icones; window.ico = ico; }
  if (typeof module !== 'undefined') module.exports = Icones;
})();
