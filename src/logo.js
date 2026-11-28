// Le logo de StreetKeep (choix de Gautier du 28 nov. 2026, après une interview : « un symbole fort », en nuit néon comme le
// jeu, sans carte de France : « ça fixe l'idée que ce sera utilisé que sur la France ») : LE REPÈRE À SERRURE. Un repère de
// carte en or massif, une serrure découpée dedans et éclairée de vert (ce lieu est gardé : « keep »), posé sur un plan de
// ville en néon bleu ; le nom penché sur deux lignes, STREET en tube de néon fin, KEEP plein, en or et en relief.
// Il remplace la plaque émaillée aux deux cartes du 5 nov. Dessiné en SVG (net à toutes les tailles) :
//   Logo.svg(attrs, opts)  le logo : en long (la connexion, l'image de partage) ; opts.empile : le symbole au-dessus du nom
//                          (l'écran d'ouverture, sur un téléphone tenu debout)
//   Logo.icone(opts)       l'icône carrée (tools/icones.js) : opts.fond (tuile de nuit arrondie), opts.plein (sans arrondi),
//                          opts.zone (réduit dans la zone sûre d'Android)
//   Logo.symbole(id, cx, cy, t)  le repère seul, à poser dans un autre SVG (avec Logo.defs(id))
//   Logo.piece(x, y, r)    la pièce de la monnaie (ronde, frappée d'une maison : icones/piece.svg), à poser dans un autre SVG
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
  const POLICE = `font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="700"`;
  const a1 = (v) => Math.round(v * 10) / 10;
  // les flous des halos (e : l'échelle du dessin, pour que le halo suive sa taille) et l'or
  function defs(id, e) {
    const k = e || 1;
    return `<defs><filter id="${id}g" x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="${a1(7 * k)}"/></filter>`
      + `<filter id="${id}p" x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="${a1(2.2 * k)}"/></filter>`
      + `<linearGradient id="${id}or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".5" stop-color="#FFC93D"/><stop offset="1" stop-color="#E0900C"/></linearGradient>`
      + `<radialGradient id="${id}nuit" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#1B2C6E"/><stop offset=".6" stop-color="#0B1437"/><stop offset="1" stop-color="#060B20"/></radialGradient></defs>`;
  }
  // un tube de néon : un halo large, un halo serré, le trait de couleur, le cœur blanc
  const neon = (id, d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${a1(w * 2.4)}" stroke-linecap="round" stroke-linejoin="round" opacity=".55" filter="url(#${id}g)"/>`
    + `<path d="${d}" fill="none" stroke="${c}" stroke-width="${a1(w * 1.3)}" stroke-linecap="round" stroke-linejoin="round" opacity=".8" filter="url(#${id}p)"/>`
    + `<path d="${d}" fill="none" stroke="${c}" stroke-width="${a1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" stroke="#fff" stroke-width="${a1(w * 0.32)}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  // le repère de carte (la goutte), pointe en (x, y), hauteur h
  function goutte(x, y, h) {
    const r = h * 0.36, cy = y - h + r;
    return `M${a1(x)} ${a1(y)}C${a1(x - r * 0.5)} ${a1(y - h * 0.3)} ${a1(x - r)} ${a1(cy + r * 0.75)} ${a1(x - r)} ${a1(cy)}A${a1(r)} ${a1(r)} 0 1 1 ${a1(x + r)} ${a1(cy)}C${a1(x + r)} ${a1(cy + r * 0.75)} ${a1(x + r * 0.5)} ${a1(y - h * 0.3)} ${a1(x)} ${a1(y)}Z`;
  }
  // le trou de la serrure, la tête ronde en (cx, ky), de rayon k
  const serrure = (cx, ky, k) => `M${a1(cx - k * 0.55)} ${a1(ky + k * 0.75)}A${a1(k)} ${a1(k)} 0 1 1 ${a1(cx + k * 0.55)} ${a1(ky + k * 0.75)}L${a1(cx + k * 0.95)} ${a1(ky + k * 2.7)}H${a1(cx - k * 0.95)}Z`;
  // le symbole, dans un carré de côté t centré en (cx, cy) : le plan de ville (un disque de rues vu de biais), le repère d'or
  // massif en relief planté dessus, la serrure découpée et son néon vert
  function symbole(id, cx, cy, t) {
    const py = cy + t * 0.36, rx = t * 0.47, ry = t * 0.14, h = t * 0.86, r = h * 0.36, G = goutte(cx, py, h), S = serrure(cx, py - h + r - t * 0.04, t * 0.095);
    const rues = [-0.6, -0.2, 0.25, 0.65].map((u) => `M${a1(cx + u * rx - rx * 0.25)} ${a1(py + ry * 0.9)}L${a1(cx + u * rx + rx * 0.25)} ${a1(py - ry * 0.9)}`).join('')
      + [-0.45, 0.1, 0.55].map((v) => `M${a1(cx - rx)} ${a1(py + v * ry)}H${a1(cx + rx)}`).join('');
    const disque = `cx="${a1(cx)}" cy="${a1(py)}" rx="${a1(rx)}" ry="${a1(ry)}"`;
    return `<clipPath id="${id}c"><ellipse ${disque}/></clipPath><ellipse ${disque} fill="#16277A" opacity=".75"/>`
      + `<g clip-path="url(#${id}c)"><path d="${rues}" stroke="#5AA8FF" stroke-width="${a1(t * 0.012)}" fill="none" opacity=".9"/></g>`
      + `<ellipse ${disque} fill="none" stroke="#3F9BFF" stroke-width="${a1(t * 0.05)}" opacity=".5" filter="url(#${id}p)"/><ellipse ${disque} fill="none" stroke="#3F9BFF" stroke-width="${a1(t * 0.018)}"/>`
      + `<ellipse cx="${a1(cx)}" cy="${a1(py)}" rx="${a1(t * 0.13)}" ry="${a1(t * 0.035)}" fill="#FFC233" opacity=".75" filter="url(#${id}p)"/>`
      + `<path d="${G}" fill="#FFC233" opacity=".5" filter="url(#${id}g)"/>`
      + [5, 4, 3, 2, 1].map((k) => `<path d="${G}" fill="#5A3200" transform="translate(${a1(k * t * 0.006)} ${a1(k * t * 0.008)})"/>`).join('')
      + `<path d="${G}" fill="url(#${id}or)" stroke="#FFF1B8" stroke-width="${a1(t * 0.01)}"/>`
      + `<path d="M${a1(cx - r * 0.62)} ${a1(py - h + r * 0.7)}A${a1(r * 0.75)} ${a1(r * 0.75)} 0 0 1 ${a1(cx - r * 0.1)} ${a1(py - h + r * 0.22)}" stroke="#fff" stroke-opacity=".8" stroke-width="${a1(t * 0.018)}" stroke-linecap="round" fill="none"/>`
      + `<path d="${S}" fill="#081033"/>` + neon(id, S, '#3DFFB0', t * 0.018);
  }
  // le nom : penché, sur deux lignes ; (x, y) = le pied gauche de STREET, e = l'échelle (large de 245 × e, haut de 150 × e)
  function nom(id, x, y, e) {
    const T = (t, dy, taille, extra) => `<text x="0" y="${dy}" ${POLICE} font-size="${taille}" ${extra}>${t}</text>`;
    return `<g transform="translate(${a1(x)} ${a1(y)}) scale(${e}) skewX(-9)">`
      + T('STREET', 0, 58, `letter-spacing="9" fill="none" stroke="#5AA8FF" stroke-width="6" opacity=".6" filter="url(#${id}p)"`) + T('STREET', 0, 58, 'letter-spacing="9" fill="none" stroke="#DCEBFF" stroke-width="2.2" stroke-linejoin="round"')
      + T('KEEP', 86, 112, `letter-spacing="3" fill="#FFC233" opacity=".6" filter="url(#${id}g)"`)
      + [6, 5, 4, 3, 2, 1].map((k) => `<text x="${a1(k * 0.7)}" y="${86 + k}" ${POLICE} font-size="112" letter-spacing="3" fill="#5A3200">KEEP</text>`).join('')
      + T('KEEP', 86, 112, `letter-spacing="3" fill="url(#${id}or)" stroke="#FFF1B8" stroke-width="1"`)
      + neon(id, 'M4 104H236', '#3DFFB0', 2.6) + `</g>`;
  }
  // le logo : en long 600 × 260 (le symbole à gauche, le nom à droite), ou empilé 420 × 470 (le symbole au-dessus du nom)
  function svg(attrs, opts) {
    const id = 'lg' + (++n), o = opts || {};
    if (o.empile) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 500" role="img" aria-label="StreetKeep" ${attrs || ''}>${defs(id, 1.2)}${symbole(id, 210, 138, 250)}${nom(id, 64, 338, 1.3)}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" role="img" aria-label="StreetKeep" ${attrs || ''}>${defs(id)}${symbole(id, 130, 124, 200)}${nom(id, 268, 112, 1.12)}</svg>`;
  }
  // l'icône carrée : 512 × 512, le repère seul sur la nuit
  function icone(opts) {
    const o = opts || {}, id = 'li' + (++n), k = o.zone ? 0.8 : 1;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" ${o.attrs || ''}>${defs(id, 2.4)}`
      + (o.fond === false ? '' : `<rect width="512" height="512" rx="${o.plein ? 0 : 112}" fill="url(#${id}nuit)"/>`)
      + `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${symbole(id, 256, 246, 400)}</g></svg>`;
  }
  const Logo = { svg, icone, symbole, defs, piece, MAISON };
  if (typeof window !== 'undefined') window.Logo = Logo;
  if (typeof module !== 'undefined') module.exports = Logo;
})();
