// Le dos des cartes (16 nov. 2026, choisi par Gautier sur la page d'essai proto/cartes.html, docs/CARTES-NEON.md) : la nuit, un
// plan de ville en traits fins, le cadre orné, et au centre la plaque de rue française en néon (couronne de remparts, lauriers,
// volutes de fer forgé), une ville française la nuit à l'intérieur, STREETKEEP sur une banderole ; bleu et or. Le même pour
// toutes les cartes : il ne dit rien de la rareté.
// Dans le jeu, le dos est fait d'images préparées une fois (le dessin en SVG, peint dans un canevas avec le halo des néons) :
//   --dos-carte    le fond (la nuit et le plan de ville) ;
//   --dos-anneau-a et --dos-anneau-b   les deux anneaux d'ornements, qui tournent en sens opposés (style.css) ;
//   --dos-devant   la plaque, son décor et le cadre, par-dessus les anneaux.
// Le nom est écrit par le canevas (une image SVG n'a pas les polices de la page).
(function (racine) {
  'use strict';
  const BLEU = ['#CFE6FF', '#3D8BFF'], OR = '#F2CE7A';
  function pieces() {
    const W = 240, H = 350, rr = (i, a) => `M${i + a},${i} H${W - i - a} A${a},${a} 0 0 1 ${W - i},${i + a} V${H - i - a} A${a},${a} 0 0 1 ${W - i - a},${H - i} H${i + a} A${a},${a} 0 0 1 ${i},${H - i - a} V${i + a} A${a},${a} 0 0 1 ${i + a},${i} Z`;
    let g = 7; const alea = () => ((g = (g * 1664525 + 1013904223) >>> 0) / 4294967296);
    // le fond : un plan de ville inventé, des îlots découpés en parcelles (calme, pour laisser le centre parler)
    let plan = '';
    for (let y = -20; y < 380; y += 46) for (let x = -30; x < 270; x += 52) { const dx = (y / 46 % 2) * 18, w = 36 + alea() * 10, h = 30 + alea() * 8, n = 1 + Math.floor(alea() * 3);
      plan += `<g transform="translate(${(x + dx).toFixed(1)} ${y}) rotate(-12)"><rect width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`;
      for (let k = 1; k <= n; k++) plan += `<path d="M${(w * k / (n + 1)).toFixed(1)},0 V${h.toFixed(1)}"/>`; plan += '</g>'; }
    // le cadre orné du n° 3
    let cadre = `<path class="t2" d="${rr(2.5, 12)}" fill="none" stroke-width="9" opacity=".28"/><path class="t1" d="${rr(2.5, 12)}" fill="none" stroke-width="2.6"/><path class="t2" d="${rr(8.5, 8)}" fill="none" stroke-width="1.1"/>`;
    for (const [x, y, sx, sy] of [[9, 9, 1, 1], [231, 9, -1, 1], [9, 341, 1, -1], [231, 341, -1, -1]]) cadre += `<path class="t1" d="M${x + sx * 26},${y} H${x + sx * 9} Q${x},${y} ${x},${y + sy * 9} V${y + sy * 26}" fill="none" stroke-width="2.2"/>`
      + `<path class="t3" d="M${x + sx * 30},${y + sy * 5} H${x + sx * 12} Q${x + sx * 5},${y + sy * 5} ${x + sx * 5},${y + sy * 12} V${y + sy * 30}" fill="none" stroke-width="1.2"/>`
      + `<path class="p3" d="M${x + sx * 11},${y + sy * 11} l${sx * 5},${sy * -5} l${sx * 5},${sy * 5} l${sx * -5},${sy * 5} Z"/>`;
    for (const y of [2.5, 347.5]) cadre += `<path class="p1" d="M120,${y - 6} L127,${y} L120,${y + 6} L113,${y} Z"/><path class="t3" d="M96,${y} H109 M131,${y} H144" stroke-width="3.4"/>`;
    for (const x of [2.5, 237.5]) cadre += `<path class="p1" d="M${x},168 l4.5,7 l-4.5,7 l-4.5,-7 Z"/>`;
    // les anneaux d'ornements, qui tournent en sens opposés autour de l'emblème (centre 120,168)
    let a1 = '', a2 = '', a3 = '';
    for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283, r0 = 97, r1 = k % 4 ? 101 : 106; a1 += `M${(120 + Math.cos(a) * r0).toFixed(1)},${(168 + Math.sin(a) * r0).toFixed(1)} L${(120 + Math.cos(a) * r1).toFixed(1)},${(168 + Math.sin(a) * r1).toFixed(1)} `; }
    for (let k = 0; k < 12; k++) { const a = k / 12 * 360; a2 += `<path class="p3" transform="rotate(${a} 120 168)" d="M120,${168 - 88} l3.6,5 l-3.6,5 l-3.6,-5 Z"/>`; }
    for (let k = 0; k < 8; k++) { const a = k / 8 * 360; a3 += `<path class="t1" transform="rotate(${a} 120 168)" fill="none" stroke-width="1.3" d="M${120 - 13},${168 - 71} Q120,${168 - 80} ${120 + 13},${168 - 71}"/><circle class="p1" transform="rotate(${a + 22.5} 120 168)" cx="120" cy="${168 - 74}" r="1.5"/>`; }
    // l'emblème : la plaque de rue française (avec son chapeau arrondi), une ville en silhouette, le nom en enseigne
    const PLAQUE = 'M30,138 q0,-8 8,-8 H97 A23,23 0 0 1 143,130 H202 q8,0 8,8 V206 q0,8 -8,8 H38 q-8,0 -8,-8 Z';
    const VILLE = 'M40,181 V168 h9 v-7 h8 v7 h5 v-13 l5,-5 l5,5 v13 h6 v-22 h3 v-6 l3,-10 l3,10 v6 h3 v22 h6 v-10 h10 v-8 q8,-12 16,0 v8 h8 v10 h5 v-17 h11 v17 h5 v-9 l6,-6 l6,6 v9 h7 v-14 h9 v14 h4 v13';
    const MAISON = 'M16 9.4 8.3 16.3h2.7v6.2h10v-6.2h2.7l-2.8-2.5v-3.3h-2.1v1.4ZM14.8 22.5v-3.7h2.4v3.7Z';
    // la plaque travaillée (2e version, « pas assez travaillée ») : un second contour, des rivets, des fleurons aux coins, une
    // couronne de remparts et des lauriers au chapeau, des volutes de fer forgé sur les côtés, un pendentif, deux plans de ville
    const PLAQUE2 = 'M26,138 q0,-12 12,-12 H94 A26,26 0 0 1 146,126 H202 q12,0 12,12 V206 q0,12 -12,12 H38 q-12,0 -12,-12 Z';
    let fleurons = ''; for (const [x, y, sx, sy] of [[36.5, 136.5, 1, 1], [203.5, 136.5, -1, 1], [36.5, 207.5, 1, -1], [203.5, 207.5, -1, -1]])
      fleurons += `<path class="t1" fill="none" stroke-width=".8" d="M${x},${y + sy * 9} Q${x + sx * 9},${y + sy * 9} ${x + sx * 9},${y} M${x},${y + sy * 13} Q${x + sx * 13},${y + sy * 13} ${x + sx * 13},${y}"/><circle class="p3" cx="${x + sx * 5}" cy="${y + sy * 5}" r="1.3"/>`;
    let lauriers = ''; for (const sx of [1, -1]) { lauriers += `<g transform="translate(120 0) scale(${sx} 1) translate(-120 0)"><path class="t3" fill="none" stroke-width=".9" d="M92,124 Q70,118 48,124"/>`;
      for (let k = 0; k < 6; k++) { const x = 88 - k * 7.4, y = 122.6 - Math.sin(k / 5 * 3.14) * 3.4; lauriers += `<ellipse class="p3" cx="${x.toFixed(1)}" cy="${(y - 3).toFixed(1)}" rx="4" ry="1.5" transform="rotate(${28 - k * 3} ${x.toFixed(1)} ${(y - 3).toFixed(1)})"/><ellipse class="p3" cx="${x.toFixed(1)}" cy="${(y + 2.6).toFixed(1)}" rx="3.6" ry="1.3" opacity=".75" transform="rotate(${-24 + k * 3} ${x.toFixed(1)} ${(y + 2.6).toFixed(1)})"/>`; }
      lauriers += '</g>'; }
    const COURONNE = 'M105,101 v-7 h3 v2.2 h2.4 v-2.2 h3 v7 Z M114,100 v-10.5 h3 v2.4 h2 v-2.4 h2 v2.4 h2 v-2.4 h3 v10.5 Z M126.6,101 v-7 h3 v2.2 h2.4 v-2.2 h3 v7 Z';
    const VOLUTE = 'M26,172 C13,172 9,159 17,155 C22.5,152.5 26,158 22,161.5 M26,172 C13,172 9,185 17,189 C22.5,191.5 26,186 22,182.5 M26,160 C22,150 14,146 12,138 M26,184 C22,194 14,198 12,206';
    let rosace = ''; for (let k = 0; k < 16; k++) { const a = Math.PI + k / 15 * Math.PI; rosace += `M${(120 + Math.cos(a) * 15).toFixed(1)},${(126 + Math.sin(a) * 15).toFixed(1)} L${(120 + Math.cos(a) * 19.5).toFixed(1)},${(126 + Math.sin(a) * 19.5).toFixed(1)} `; }
    // l'intérieur de la plaque (3e version, « c'est surtout l'intérieur qui n'est pas assez travaillé ») : une vraie scène de
    // ville la nuit. Un ciel (lune, étoiles, rayons qui montent de l'horizon), une ville lointaine, puis quatorze bâtiments
    // dessinés un par un (toits mansardés et leurs cheminées, pignons, clocher, mairie à fronton ; une ville française : ni
    // dôme ni croissant de lune, Gautier y voyait « une mosquée »), leurs fenêtres allumées, des
    // réverbères, des arbres, un viaduc, et le nom sur une banderole.
    const SOL = 184, BATIS = [[10, 14, 'pignon'], [12, 22, 'mansarde'], [9, 17, 'plat'], [8, 28, 'fleche'], [13, 20, 'mansarde'], [11, 26, 'plat'], [16, 19, 'mairie'], [10, 31, 'mansarde'], [12, 18, 'mansarde'], [9, 24, 'plat'], [11, 15, 'pignon'], [12, 21, 'mansarde'], [9, 28, 'plat'], [10, 16, 'pignon']];
    let murs = '', toits = '', lumieres = '', sombres = '', bx = 44; const f1 = (v) => v.toFixed(1);
    for (const [w, h, type] of BATIS) { const x = bx, t = SOL - h, cx = x + w / 2; bx += w;
      murs += `M${f1(x)},${SOL} V${f1(t)} H${f1(x + w)} V${SOL} `;
      if (type === 'plat') toits += `M${f1(x - 0.6)},${f1(t)} H${f1(x + w + 0.6)} M${f1(x + 2)},${f1(t)} v-2.2 h3 v2.2 `;
      if (type === 'mansarde') toits += `M${f1(x)},${f1(t)} L${f1(x + 1.6)},${f1(t - 4.2)} H${f1(x + w - 1.6)} L${f1(x + w)},${f1(t)} M${f1(x + w - 4.6)},${f1(t - 4.2)} v-3 h2.2 v3 M${f1(x + 3)},${f1(t - 0.6)} v-2.4 h2 v2.4 `;
      if (type === 'pignon') toits += `M${f1(x - 0.6)},${f1(t)} L${f1(cx)},${f1(t - 5.4)} L${f1(x + w + 0.6)},${f1(t)} M${f1(cx + 2.2)},${f1(t - 3)} v-3.4 h1.8 v4.8 `;
      if (type === 'fleche') toits += `M${f1(x + 0.8)},${f1(t)} L${f1(cx)},${f1(t - 12)} L${f1(x + w - 0.8)},${f1(t)} M${f1(cx)},${f1(t - 12)} v-3.6 M${f1(cx - 1.3)},${f1(t - 14)} h2.6 M${f1(cx - 1.7)},${f1(t + 5.2)} a1.7,1.7 0 1 0 3.4,0 a1.7,1.7 0 1 0 -3.4,0 M${f1(cx - 1.4)},${SOL} v-5 a1.4,1.6 0 0 1 2.8,0 v5 `;
      // la mairie : un fronton, un campanile avec son horloge, un drapeau, une porte en arche
      if (type === 'mairie') toits += `M${f1(x - 0.6)},${f1(t)} H${f1(x + w + 0.6)} M${f1(x + 3)},${f1(t)} L${f1(cx)},${f1(t - 4.4)} L${f1(x + w - 3)},${f1(t)} M${f1(cx - 1.8)},${f1(t - 3.2)} v-6 h3.6 v6 M${f1(cx - 2.4)},${f1(t - 9.2)} L${f1(cx)},${f1(t - 12)} L${f1(cx + 2.4)},${f1(t - 9.2)} Z M${f1(cx - 0.9)},${f1(t - 6.4)} a.9,.9 0 1 0 1.8,0 a.9,.9 0 1 0 -1.8,0 M${f1(cx)},${f1(t - 12)} v-5 h3.6 v2.4 h-3.6 M${f1(cx - 1.6)},${SOL} v-4.6 a1.6,1.6 0 0 1 3.2,0 v4.6 `;
      if (type === 'fleche') continue;
      const cols = Math.floor((w - 2.6) / 2.9), rangs = Math.floor((h - 3.5) / 4), marge = (w - cols * 2.9 + 1.3) / 2;
      for (let r = 0; r < rangs; r++) for (let c = 0; c < cols; c++) { const d = `M${f1(x + marge + c * 2.9)},${f1(t + 2.6 + r * 4)} h1.6 v2.3 h-1.6 Z `; if (alea() < 0.62) lumieres += d; else sombres += d; } }
    let ciel = ''; for (let k = 0; k < 17; k++) { const a = Math.PI + (k + 0.5) / 17 * Math.PI; ciel += `M${f1(120 + Math.cos(a) * 26)},${f1(SOL + Math.sin(a) * 26)} L${f1(120 + Math.cos(a) * 96)},${f1(SOL + Math.sin(a) * 96)} `; }
    let etoiles = ''; for (let k = 0; k < 16; k++) etoiles += `<circle cx="${f1(42 + alea() * 156)}" cy="${f1(139.5 + alea() * 15)}" r="${f1(0.35 + alea() * 0.5)}"/>`;
    let rue = ''; for (const x of [50, 86, 122, 158, 192]) rue += `<path class="t1" fill="none" stroke-width=".6" d="M${x},${SOL} v-6 q0,-1.6 1.8,-1.6"/><circle class="p3" cx="${x + 2.2}" cy="${SOL - 7.2}" r="1.05"/>`;
    for (const x of [68, 104, 140, 176]) rue += `<path class="t2" stroke-width=".6" d="M${x},${SOL} v-3"/><circle cx="${x}" cy="${SOL - 4.6}" r="2.3" fill="#0B1660" class="t2" stroke-width=".7"/>`;
    let viaduc = ''; for (let x = 44; x < 196; x += 9.5) viaduc += `M${f1(x)},189.4 v-2 a4.75,3.4 0 0 1 9.5,0 v2 `;
    const interieur = `<clipPath id="dos-cadre-int"><rect x="37.5" y="137.5" width="165" height="69" rx="3.8"/></clipPath>
      <g clip-path="url(#dos-cadre-int)"><circle class="p3 nuit" cx="120" cy="${SOL}" r="46" opacity=".16"/><circle class="p3 nuit" cx="120" cy="${SOL}" r="27" opacity=".14"/>
        <path class="t3" d="${ciel}" fill="none" stroke-width=".7" opacity=".34"/><g class="p1" opacity=".9">${etoiles}</g>
        <circle class="p1 nuit" cx="187" cy="146.5" r="7.4" opacity=".14"/><circle class="p1" cx="187" cy="146.5" r="4.3"/><circle class="nuit" cx="185.6" cy="145.2" r="1" fill="#16298F" opacity=".35"/><circle class="nuit" cx="188.4" cy="148" r=".7" fill="#16298F" opacity=".35"/>
        <path class="t2" d="${VILLE}" transform="translate(120 -9) scale(-.9 1) translate(-120 0)" fill="#081250" stroke-width=".9" stroke-linejoin="round" opacity=".75"/>
        <g><path class="t1" d="${murs}" fill="#0B1660" stroke-width="1" stroke-linejoin="round"/><path class="t1" d="${toits}" fill="#0B1660" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"/></g>
        <path class="p3" d="${lumieres}"/><path class="nuit" d="${sombres}" fill="#1C2F8E"/>
        ${rue}
        <path class="t1" d="M40,${SOL} H200" stroke-width="1.1"/><path class="nuit" d="M40,${SOL + 0.6} H200 V208 H40 Z" fill="#060B3A"/><path class="t3" d="${viaduc}" fill="none" stroke-width=".8"/></g>
      <g><path class="t3" d="M53,192.4 H43.5 l3.6,6.8 l-3.6,6.8 H53 Z M187,192.4 H196.5 l-3.6,6.8 l3.6,6.8 H187 Z" fill="#050B3A" stroke-width="1" stroke-linejoin="round"/>
        <path class="t3" d="M50,189.6 H190 V206.4 H50 Z" fill="#081045" stroke-width="1.3" stroke-linejoin="round"/></g>
      <path class="t1" d="M52.2,191.6 H187.8 M52.2,204.4 H187.8" stroke-width=".5" stroke-dasharray="1.6 2.2" opacity=".8"/>
      <path class="p3" d="M56.5,198 l2.2,-3 l2.2,3 l-2.2,3 Z M179.1,198 l2.2,-3 l2.2,3 l-2.2,3 Z"/>`;
    return { plan, cadre, a1, a2, a3, PLAQUE, PLAQUE2, MAISON, COURONNE, VOLUTE, fleurons, lauriers, rosace, interieur };
  }
  const STYLE = `.t1{stroke:${BLEU[0]}}.t2{stroke:${BLEU[1]}}.t3{stroke:${OR}}.p1{fill:${BLEU[0]}}.p3{fill:${OR}}`;
  // (pour le halo : seulement les traits et les pleins d'une couleur, sans les aplats de nuit)
  const HALO_BLEU = STYLE + '.t1,.t2,.t3{fill:none !important}.t3,.p3,.nuit{display:none}', HALO_OR = STYLE + '.t1,.t2,.t3{fill:none !important}.t1,.t2,.p1,.nuit{display:none}';
  const svg = (vb, style, corps) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><style>${style}</style>${corps}</svg>`;
  function dessins() {
    const p = pieces();
    const fond = `<defs><radialGradient id="dos-fond" cx="50%" cy="48%" r="62%"><stop offset="0" stop-color="#16276E"/><stop offset=".55" stop-color="#0A1238"/><stop offset="1" stop-color="#050818"/></radialGradient>
      <radialGradient id="dos-voile" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="#050818" stop-opacity=".78"/><stop offset=".8" stop-color="#050818" stop-opacity=".5"/><stop offset="1" stop-color="#050818" stop-opacity="0"/></radialGradient></defs>
      <rect width="240" height="350" fill="url(#dos-fond)"/><g fill="none" stroke="#2A3F9C" stroke-width=".8" opacity=".7">${p.plan}</g><circle cx="120" cy="168" r="122" fill="url(#dos-voile)"/>`;
    const devant = `<defs><linearGradient id="dos-email" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16298F"/><stop offset=".5" stop-color="#0B1660"/><stop offset="1" stop-color="#060B3A"/></linearGradient><clipPath id="dos-forme"><path d="${p.PLAQUE}"/></clipPath></defs>
      <path class="t3" d="${p.VOLUTE}" fill="none" stroke-width="1.5" stroke-linecap="round"/><path class="t3" d="${p.VOLUTE}" transform="translate(240 0) scale(-1 1)" fill="none" stroke-width="1.5" stroke-linecap="round"/>
      <g class="p1"><circle cx="12" cy="137" r="1.8"/><circle cx="12" cy="207" r="1.8"/><circle cx="228" cy="137" r="1.8"/><circle cx="228" cy="207" r="1.8"/></g>
      <path class="t3" fill="none" stroke-width="1.3" stroke-linecap="round" d="M112,226 C104,226 99,219 90,222 M128,226 C136,226 141,219 150,222"/><path class="p1" d="M120,219 l5,7.5 l-5,7.5 l-5,-7.5 Z"/><circle class="p3" cx="87" cy="222.5" r="1.6"/><circle class="p3" cx="153" cy="222.5" r="1.6"/>
      <path class="t1" d="${p.COURONNE}" fill="#081045" stroke-width="1.1" stroke-linejoin="round"/>
      ${p.lauriers}
      <path class="t3" d="${p.PLAQUE2}" fill="#050818" fill-opacity=".6" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="${p.PLAQUE}" fill="url(#dos-email)" class="t1" stroke-width="2.8" stroke-linejoin="round"/>
      <g class="nuit" clip-path="url(#dos-forme)"><ellipse cx="120" cy="116" rx="118" ry="30" fill="#fff" opacity=".075"/><path d="M30,200 H210 V214 H30 Z" fill="#000" opacity=".22"/></g>
      <rect class="t3" x="36.5" y="136.5" width="167" height="71" rx="4.5" fill="none" stroke-width="1.1"/>
      <rect class="t1" x="40" y="140" width="160" height="64" rx="2.5" fill="none" stroke-width="1.2" stroke-linecap="round" stroke-dasharray=".1 4.9" opacity=".85"/>
      ${p.fleurons}
      <path class="t3" d="${p.rosace}" fill="none" stroke-width=".9" stroke-linecap="round"/><path class="t1" d="M103.5,128 A16.5,16.5 0 0 1 136.5,128" fill="none" stroke-width=".9"/>
      <path class="p1" d="${p.MAISON}" transform="translate(120 119.5) scale(1.05) translate(-16 -16)" fill-rule="evenodd"/>
      ${p.interieur}
      ${p.cadre}`;
    const anneauA = `<path class="t3" d="${p.a1}" fill="none" stroke-width="1.3" stroke-linecap="round"/><circle class="t1" cx="120" cy="168" r="93" fill="none" stroke-width="1.6"/>${p.a3}`;
    const anneauB = `${p.a2}<circle class="t3" cx="120" cy="168" r="80" fill="none" stroke-width=".9" stroke-dasharray="1.5 4.5"/>`;
    return { fond, devant, anneauA, anneauB };
  }
  const charger = (texte) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texte); });
  // peindre une image, puis son halo seul (l'image est dessinée hors du canevas, son ombre décalée retombe dedans)
  function halo(g, img, couleur, flou, W, H) { g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = couleur; g.shadowBlur = flou; g.shadowOffsetX = W * 2; g.drawImage(img, -W * 2, 0, W, H); g.restore(); }
  let pret = null;
  function preparer() {
    if (pret) return pret;
    pret = (async () => {
      const d = dessins(), K = 2, W = 240 * K, H = 350 * K, toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      try { if (document.fonts && document.fonts.load) await document.fonts.load('700 40px "Barlow Condensed"'); } catch (e) { /* tant pis : une autre police */ }
      const [iFond, iNet, iBleu, iOr, iA, iB] = await Promise.all([charger(svg('0 0 240 350', STYLE, d.fond)), charger(svg('0 0 240 350', STYLE, d.devant)), charger(svg('0 0 240 350', HALO_BLEU, d.devant)), charger(svg('0 0 240 350', HALO_OR, d.devant)),
        charger(svg('12 60 216 216', STYLE, d.anneauA)), charger(svg('12 60 216 216', STYLE, d.anneauB))]);
      const cf = toile(W, H); cf.getContext('2d').drawImage(iFond, 0, 0, W, H);
      const cd = toile(W, H), g = cd.getContext('2d'); g.drawImage(iNet, 0, 0, W, H); halo(g, iBleu, BLEU[1], 14, W, H); halo(g, iOr, OR, 14, W, H); g.drawImage(iNet, 0, 0, W, H);
      // le nom, sur la banderole
      g.save(); g.font = '700 ' + (17 * K) + 'px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; const large = g.measureText('STREETKEEP').width, k = (112 * K) / large;
      g.translate(120 * K, 203.6 * K); g.scale(k, 1); g.shadowColor = OR; g.shadowBlur = 12; g.fillStyle = '#FFF1CC'; g.fillText('STREETKEEP', 0, 0); g.shadowBlur = 0; g.fillText('STREETKEEP', 0, 0); g.restore();
      const anneau = (img) => { const c = toile(216 * K, 216 * K), x = c.getContext('2d'); x.shadowColor = OR; x.shadowBlur = 6; x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
      return { fond: cf.toDataURL('image/jpeg', 0.9), devant: cd.toDataURL('image/png'), anneauA: anneau(iA), anneauB: anneau(iB) };
    })();
    pret.catch(() => { pret = null; });
    return pret;
  }
  // poser le dos sur la page (les variables que lit style.css) ; rend vrai quand c'est fait
  async function poser() {
    try { const u = await preparer(), s = document.documentElement.style; s.setProperty('--dos-carte', `url(${u.fond})`); s.setProperty('--dos-devant', `url(${u.devant})`); s.setProperty('--dos-anneau-a', `url(${u.anneauA})`); s.setProperty('--dos-anneau-b', `url(${u.anneauB})`); document.documentElement.classList.add('dos-neon'); return true; }
    catch (e) { return false; }
  }
  // ce qu'on met dans la face « dos » d'une carte
  const HTML = '<i class="dos-anneau a"></i><i class="dos-anneau b"></i><i class="dos-devant"></i>';
  const api = { preparer, poser, dessins, HTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.DosCarte = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
