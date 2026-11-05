// Le logo de CityDeck, d'après le modèle envoyé par Gautier le 5 nov. 2026 : la plaque de rue émaillée « CITYDECK »
// (cadre vert, filet blanc aux coins rentrants, liseré d'or, deux vis), deux cartes au bord d'or en éventail derrière, et la
// pièce d'or ronde frappée d'une maison (la monnaie du jeu, icones/piece.svg). Dessiné en SVG (net à toutes les tailles) :
//   Logo.svg()        le logo en long (l'écran d'accueil, la connexion)
//   Logo.icone(opts)  l'icône carrée (tools/icones.js) : opts.fond (tuile perle arrondie), opts.plein (sans arrondi),
//                     opts.zone (réduit dans la zone sûre d'Android)
//   Logo.piece(x, y, r) la pièce, à poser dans un autre SVG
// Le texte est en Barlow Condensed (fonts/) : un SVG en ligne dans la page la trouve ; en image (<img>), non.
(function () {
  // la maison frappée sur la pièce (grille de 32, centre 16 16), la porte en creux
  const MAISON = 'M16 9.4 8.3 16.3h2.7v6.2h10v-6.2h2.7l-2.8-2.5v-3.3h-2.1v1.4ZM14.8 22.5v-3.7h2.4v3.7Z';
  let n = 0;
  function piece(x, y, r) {
    const k = r / 16, id = 'lp' + (++n);
    return `<g transform="translate(${x - r} ${y - r}) scale(${k})"><defs><linearGradient id="${id}a" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".45" stop-color="#FFC93D"/><stop offset="1" stop-color="#D9890A"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#E8A417"/><stop offset="1" stop-color="#FFE38A"/></linearGradient></defs>`
      + `<circle cx="16" cy="16" r="14.6" fill="url(#${id}a)" stroke="#8A5300" stroke-width="1.4"/><circle cx="16" cy="16" r="11.2" fill="url(#${id}b)" stroke="#B87407" stroke-opacity=".6" stroke-width=".8"/>`
      + `<path d="${MAISON}" transform="translate(.45 .5)" fill="#FFF4C4" fill-opacity=".85" fill-rule="evenodd"/><path d="${MAISON}" fill="#A86A08" fill-rule="evenodd"/>`
      + `<path d="M6.2 10.4A11 11 0 0 1 12.5 5.2" stroke="#fff" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round" fill="none"/></g>`;
  }
  // l'éclat : une étoile fine à quatre branches
  const eclat = (x, y, r) => `<path d="M${x} ${y - r}Q${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y}Q${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r}Q${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y}Q${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z" fill="#fff"/>`;
  // une carte au bord d'or, l'intérieur sombre
  function carte(cx, cy, l, h, rot, id) {
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="${-l / 2}" y="${-h / 2}" width="${l}" height="${h}" rx="${h * 0.08}" fill="url(#${id}or)" stroke="#3B2A0A" stroke-width="5"/>`
      + `<rect x="${-l / 2 + h * 0.06}" y="${-h / 2 + h * 0.06}" width="${l - h * 0.12}" height="${h * 0.88}" rx="${h * 0.04}" fill="url(#${id}nuit)" stroke="#3B2A0A" stroke-opacity=".6" stroke-width="2.5"/></g>`;
  }
  // le cadre aux coins rentrants (le filet blanc et l'émail des plaques de Paris)
  const coinsRentrants = (x0, y0, x1, y1, r) => `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 0 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 0 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 0 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 0 ${x0 + r} ${y0}Z`;
  // la plaque : l × h, centrée en (0, 0) ; lignes de texte (une ou deux)
  function plaque(l, h, lignes, taille, id) {
    const x0 = -l / 2, y0 = -h / 2, x1 = l / 2, y1 = h / 2, b = h * 0.045, v = h * 0.11;
    const vis = (x, y) => `<g transform="translate(${x} ${y})"><circle r="${h * 0.04}" fill="url(#${id}or)" stroke="#5A3A00" stroke-width="2.5"/><path d="M${-h * 0.025} ${h * 0.012}L${h * 0.025} ${-h * 0.012}" stroke="#5A3A00" stroke-width="3" stroke-linecap="round"/></g>`;
    const ty = lignes.length === 1 ? [h * 0.08] : [-h * 0.094, h * 0.19];
    return `<rect x="${x0}" y="${y0}" width="${l}" height="${h}" rx="${h * 0.075}" fill="url(#${id}or)" stroke="#3B2A0A" stroke-width="5"/>`
      + `<rect x="${x0 + b}" y="${y0 + b}" width="${l - 2 * b}" height="${h - 2 * b}" rx="${h * 0.05}" fill="url(#${id}vert)"/>`
      + `<path d="${coinsRentrants(x0 + b + v * 0.7, y0 + b + v * 0.7, x1 - b - v * 0.7, y1 - b - v * 0.7, h * 0.09)}" fill="#F7F4EA"/>`
      + `<path d="${coinsRentrants(x0 + b + v, y0 + b + v, x1 - b - v, y1 - b - v, h * 0.075)}" fill="url(#${id}bleu)"/>`
      + `<path d="M${x0 + b + v} ${y0 + b + v}L${x1 - b - v - h * 0.3} ${y0 + b + v}L${x0 + b + v + h * 0.5} ${y1 - b - v}L${x0 + b + v} ${y1 - b - v}Z" fill="#fff" opacity=".07"/>`
      + `<rect x="${x0 + b + v + h * 0.06}" y="${y0 + b + v + h * 0.1}" width="${l - 2 * (b + v) - h * 0.12}" height="${h * 0.022}" rx="${h * 0.011}" fill="#F7F4EA"/>`
      + vis(x0 + b + v * 0.42, y0 + b + v * 0.42) + vis(x1 - b - v * 0.42, y0 + b + v * 0.42)
      + lignes.map((t, i) => { const lg = (l - 2 * (b + v)) * (lignes.length === 1 ? 0.86 : 0.78), att = `x="0" y="${ty[i]}" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="700" font-size="${taille}" textLength="${lg}" lengthAdjust="spacingAndGlyphs"`;
        return `<text ${att} fill="#173B85" opacity=".5" transform="translate(0 ${taille * 0.03})">${t}</text><text ${att} fill="#FFF8EA">${t}</text>`; }).join('');
  }
  function degrades(id) {
    return `<defs><linearGradient id="${id}or" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#FFE68A"/><stop offset=".5" stop-color="#F2B92E"/><stop offset="1" stop-color="#C98A12"/></linearGradient>`
      + `<linearGradient id="${id}nuit" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#5C5340"/><stop offset=".35" stop-color="#2B2820"/><stop offset="1" stop-color="#1B1A16"/></linearGradient>`
      + `<linearGradient id="${id}vert" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DB26A"/><stop offset="1" stop-color="#22813F"/></linearGradient>`
      + `<linearGradient id="${id}bleu" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#2C5EC0"/><stop offset="1" stop-color="#173F94"/></linearGradient>`
      + `<linearGradient id="${id}perle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E6EBF3"/></linearGradient></defs>`;
  }
  // le logo en long : 1000 × 620
  function svg(attrs) {
    const id = 'lg' + (++n);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 620" role="img" aria-label="CityDeck" ${attrs || ''}>${degrades(id)}`
      + carte(470, 250, 620, 330, -12, id) + carte(520, 270, 620, 330, -7, id)
      + `<g transform="translate(500 360) rotate(-3)">${plaque(800, 400, ['CITYDECK'], 200, id)}</g>`
      + piece(868, 498, 92) + eclat(820, 430, 22) + `</svg>`;
  }
  // l'icône carrée : 512 × 512
  function icone(opts) {
    const o = opts || {}, id = 'li' + (++n), k = o.zone ? 0.8 : 1;
    const dessin = carte(236, 200, 330, 210, -12, id) + carte(262, 214, 330, 210, -6, id)
      + `<g transform="translate(250 290) rotate(-3)">${plaque(390, 320, ['CITY', 'DECK'], 96, id)}</g>` + piece(392, 392, 64) + eclat(358, 340, 15);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" ${o.attrs || ''}>${degrades(id)}`
      + (o.fond === false ? '' : `<rect width="512" height="512" rx="${o.plein ? 0 : 112}" fill="url(#${id}perle)"/>`)
      + `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${dessin}</g></svg>`;
  }
  const Logo = { svg, icone, piece, MAISON };
  if (typeof window !== 'undefined') window.Logo = Logo;
  if (typeof module !== 'undefined') module.exports = Logo;
})();
