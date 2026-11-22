// Les dessins de l'agence (22 nov. 2026, Gautier : « de vrais employés façon dessin animé qui travaillent, les bureaux et
// tout ça ; du vrai design travaillé, pas des bonshommes bâtons »). Tout est dessiné ici, en SVG rempli :
//   - les employés : une tête (peau, coiffure, couleur de cheveux, lunettes) et une tenue tirées d'une graine, donc tous
//     différents et toujours les mêmes d'une visite à l'autre ; l'agent tape à son bureau, le négociateur marche au
//     téléphone, le directeur tamponne ses dossiers derrière son grand bureau ;
//   - le décor de chaque étage (340 × 90) : open space, salon de négociation, bureau de direction ;
//   - le portrait d'un employé (cartes d'embauche), l'ouvrier, la grue, la brique.
// Les animations sont dans style.css (classes ae-…) : transformations et opacité seulement.
(function () {
  'use strict';
  const PEAUX = ['#F8D5B5', '#F1C39B', '#E0A577', '#C68655', '#9C6239', '#70432A'];
  const CHEVEUX = ['#2A1B14', '#4B2E1C', '#7A4A24', '#B8772E', '#E0B152', '#B6402A', '#1D1F2B', '#8C93A6'];
  const HAUTS = { agent: ['#4F8DF7', '#35B58A', '#F26B5E', '#F2B33D', '#9B6BE8', '#2FB5C9', '#EC6FA8', '#6C7BD9'], negociateur: ['#31406E', '#5B3B8C', '#1F6F6B', '#8C3B4A', '#3B5B8C', '#4A4A58'], directeur: ['#1B2444', '#2B2B33', '#3A1F33', '#10323A'] };
  const COIFFURES = ['court', 'meche', 'long', 'chignon', 'afro', 'barbe', 'queue', 'carre'];
  function hasard(graine) { let h = 2166136261; const s = String(graine); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const fonce = (c, k) => { const n = parseInt(c.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
  // l'allure d'un employé : toujours la même pour la même graine
  function allure(poste, graine) {
    const r = hasard(poste + ':' + graine), pris = (l) => l[Math.floor(r() * l.length)];
    return { peau: pris(PEAUX), cheveux: pris(CHEVEUX), coiffure: pris(COIFFURES), haut: pris(HAUTS[poste] || HAUTS.agent), lunettes: r() < 0.22, sourire: r() < 0.5, retard: (r() * 3).toFixed(2) };
  }
  // la tête, autour de (0,0), rayon 9 ; dx : le regard (0 de face, 1.6 vers la droite)
  function tete(a, dx) {
    const c = a.cheveux, d = dx || 0; let derriere = '', devant = '';
    const calotte = `<path d="M-9.4 -0.8A9.4 9.4 0 0 1 9.4 -0.8Q5.5 -5.2 0 -4.6Q-5.5 -4 -9.4 -0.8Z" fill="${c}"/>`;
    if (a.coiffure === 'court') devant = calotte;
    else if (a.coiffure === 'meche') devant = `<path d="M-9.5 0.6A9.5 9.5 0 0 1 9.5 -1.2Q7.5 -7.4 -1 -5.6Q-6.5 -4.6 -9.500 0.6Z" fill="${c}"/><path d="M3 -8.6Q9 -10.5 10.5 -4.5Q7 -7 3 -8.6Z" fill="${c}"/>`;
    else if (a.coiffure === 'long') { derriere = `<path d="M-10.2 -2A10.2 10.2 0 0 1 10.2 -2L10.8 10Q8.5 12.5 6.4 10L6.4 0H-6.4L-6.4 10Q-8.5 12.5 -10.8 10Z" fill="${c}"/>`; devant = calotte; }
    else if (a.coiffure === 'chignon') { derriere = `<circle cx="0" cy="-11" r="4.2" fill="${c}"/>`; devant = calotte; }
    else if (a.coiffure === 'afro') { derriere = `<circle cx="0" cy="-3.4" r="12.2" fill="${c}"/>`; devant = `<path d="M-8.6 -3A9 9 0 0 1 8.6 -3Q4 -5.6 0 -5.4Q-4 -5.6 -8.6 -3Z" fill="${c}"/>`; }
    else if (a.coiffure === 'barbe') devant = `<path d="M-8.4 1.5Q-7.6 10.4 0 10.6Q7.6 10.4 8.4 1.5Q5 5.4 ${d} 5.2Q-5 5.4 -8.4 1.5Z" fill="${c}"/><path d="M-9.300 -1.5A9.3 9.3 0 0 1 9.3 -1.5Q4 -4.4 0 -4.2Q-4 -4.4 -9.3 -1.5Z" fill="${c}" opacity=".55"/>`;
    else if (a.coiffure === 'queue') { derriere = `<path d="M-7.500 -4Q-16 -2 -13.5 9.5Q-10.5 6 -7.2 2.5Z" fill="${c}"/>`; devant = calotte; }
    else { derriere = `<path d="M-10.4 -1.5A10.4 10.4 0 0 1 10.4 -1.5L10.4 5.5Q8 7.5 6.6 5.5L6.6 0H-6.6L-6.6 5.5Q-8 7.5 -10.4 5.5Z" fill="${c}"/>`; devant = `<path d="M-9.4 -0.4A9.4 9.4 0 0 1 9.4 -0.4Q6 -3.4 0 -3.6Q-6 -3.4 -9.4 -0.4Z" fill="${c}"/>`; }
    const barbe = a.coiffure === 'barbe';
    return `${derriere}<circle r="9" fill="${a.peau}"/><circle cx="${d > 0 ? -8.4 : -8.8}" cy="1.2" r="1.7" fill="${a.peau}"/>${d > 0 ? '' : `<circle cx="8.8" cy="1.2" r="1.7" fill="${a.peau}"/>`}
      <circle cx="${-4.8 + d}" cy="3.6" r="1.9" fill="#F2796B" opacity=".28"/><circle cx="${4.8 + d}" cy="3.6" r="1.9" fill="#F2796B" opacity=".28"/>
      <g class="ae-yeux"><ellipse cx="${-3.2 + d}" cy="0.8" rx="1.25" ry="1.55" fill="#1C2440"/><ellipse cx="${3.2 + d}" cy="0.8" rx="1.25" ry="1.55" fill="#1C2440"/><circle cx="${-2.8 + d}" cy="0.3" r=".45" fill="#fff"/><circle cx="${3.6 + d}" cy="0.3" r=".45" fill="#fff"/></g>
      ${a.lunettes ? `<g fill="none" stroke="#1C2440" stroke-width=".9"><circle cx="${-3.2 + d}" cy="0.8" r="2.7"/><circle cx="${3.2 + d}" cy="0.8" r="2.7"/><path d="M${-0.5 + d} 0.8h1"/></g>` : ''}
      ${barbe ? '' : (a.sourire ? `<path d="M${-2.4 + d} 4.4Q${d} 7 ${2.4 + d} 4.4Z" fill="#7A2E2A"/>` : `<path d="M${-2.2 + d} 4.6Q${d} 6.4 ${2.2 + d} 4.6" fill="none" stroke="#7A2E2A" stroke-width="1" stroke-linecap="round"/>`)}${devant}`;
  }
  // l'agent : assis de profil, il tape ; son écran défile
  function agent(a) {
    const h = a.haut, o = fonce(h, 0.78);
    return `<svg class="ae ae-agent" viewBox="0 0 58 58" aria-hidden="true">
      <rect x="5.500" y="23" width="4.5" height="20" rx="2.2" fill="#2B3761"/><rect x="5.5" y="40" width="19" height="4.5" rx="2.2" fill="#3A4980"/><rect x="13.8" y="44" width="2.4" height="9" fill="#8C96B3"/><path d="M7 54.200h16" stroke="#8C96B3" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="56" r="1.7" fill="#1C2440"/><circle cx="22" cy="56" r="1.7" fill="#1C2440"/>
      <rect x="12" y="34.5" width="19" height="6.6" rx="3.3" fill="#27304F"/><rect x="25" y="37" width="6.4" height="16" rx="3.200" fill="#27304F"/><rect x="24.6" y="52" width="10.5" height="4.2" rx="2.1" fill="#12172B"/>
      <rect x="9.6" y="19.5" width="14" height="21" rx="6.5" fill="${h}"/><path d="M9.6 33h14v1.500a6.500 6.500 0 0 1-6.5 6.5h-1a6.5 6.5 0 0 1-6.5-6.5Z" fill="${o}"/>
      <rect x="28" y="35" width="30" height="3.4" rx="1.6" fill="#D99A5B"/><rect x="28" y="37.6" width="30" height="1.2" fill="#B5773E"/><rect x="44" y="38.8" width="12.5" height="10" rx="1" fill="#C98B4E"/><rect x="48" y="43" width="4.5" height="1.4" rx=".7" fill="#8A5A2B"/><rect x="53" y="38.8" width="3" height="19.2" fill="#B5773E"/>
      <rect x="47.200" y="29" width="2.400" height="6" fill="#59658C"/><rect x="43.5" y="33.6" width="10" height="1.6" rx=".8" fill="#59658C"/><rect x="40.4" y="12.5" width="15.6" height="17.5" rx="2.4" fill="#1C2440"/><rect x="42" y="14" width="12.4" height="14.4" rx="1.2" fill="#8FDBFF"/>
      <g class="ae-ecran" stroke="#fff" stroke-width="1.2" stroke-linecap="round"><path d="M43.6 17h6"/><path d="M43.6 20h9"/><path d="M43.6 23h4.5"/><path d="M43.6 26h7.5"/></g>
      <rect x="30.5" y="33" width="10" height="2.2" rx="1.1" fill="#3A4466"/>
      <g transform="translate(17 10.5)"><g class="ae-tete">${tete(a, 1.6)}</g></g>
      <g class="ae-bras"><path d="M17.5 25L22.5 32.5L33 32" fill="none" stroke="${o}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34" cy="31.8" r="2.4" fill="${a.peau}"/></g>
    </svg>`;
  }
  // le négociateur : debout, au téléphone, il marche et fait de grands gestes
  const BULLES = ['%', '!', '…', '+', '€', '?'];
  function negociateur(a, graine) {
    const h = a.haut, o = fonce(h, 0.75), mot = BULLES[Math.floor(hasard('b' + graine)() * BULLES.length)];
    return `<svg class="ae ae-nego" viewBox="0 0 34 58" aria-hidden="true">
      <g class="ae-jambe g"><rect x="10.800" y="37" width="5.8" height="18" rx="2.9" fill="#27304F"/><rect x="9.6" y="53.6" width="8" height="4" rx="2" fill="#12172B"/></g>
      <g class="ae-jambe d"><rect x="17.400" y="37" width="5.8" height="18" rx="2.9" fill="#27304F"/><rect x="17" y="53.6" width="8" height="4" rx="2" fill="#12172B"/></g>
      <g class="ae-geste"><path d="M10.5 24.500L5 31L3.5 25" fill="none" stroke="${o}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3.4" cy="23.6" r="2.3" fill="${a.peau}"/></g>
      <rect x="9" y="19.5" width="16" height="22" rx="6.5" fill="${h}"/><path d="M13.6 19.6L17 28L20.4 19.6Z" fill="#fff"/><path d="M16.200 21.500h1.600l.8 6.500-1.600 2-1.600-2Z" fill="#F2B33D"/><path d="M13.600 19.600L17 28L12 23.500ZM20.400 19.600L17 28L22 23.500Z" fill="${o}"/>
      <g transform="translate(17 10.500)"><g class="ae-tete">${tete(a, 0)}</g></g>
      <path d="M23.500 24.500L28.500 30L26.800 16.500" fill="none" stroke="${o}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="25.200" y="6.500" width="3.800" height="10" rx="1.400" fill="#1C2440"/><rect x="26" y="8" width="2.200" height="5" rx=".6" fill="#8FDBFF"/><circle cx="27.200" cy="15.600" r="2.300" fill="${a.peau}"/>
      <g class="ae-bulle"><path d="M22 -9.500h13a3.500 3.500 0 0 1 3.500 3.500v4a3.500 3.500 0 0 1-3.500 3.500h-6.500l-3 3.200.4-3.200H22a3.500 3.500 0 0 1-3.500-3.500v-4A3.500 3.500 0 0 1 22-9.500Z" fill="#fff"/><text x="28.500" y="-1.200" text-anchor="middle" font-size="7.500" font-weight="900" fill="#2453B3" font-family="inherit">${mot}</text></g>
    </svg>`;
  }
  // le directeur : costume, fauteuil de cuir, grand bureau, il tamponne ses dossiers
  function directeur(a) {
    const h = a.haut, o = fonce(h, 1.5);
    return `<svg class="ae ae-dir" viewBox="0 0 76 60" aria-hidden="true">
      <rect x="23" y="7" width="30" height="42" rx="11" fill="#6B2F22"/><rect x="26" y="10" width="24" height="36" rx="9" fill="#8A4030"/><circle cx="32" cy="18" r="1.200" fill="#6B2F22"/><circle cx="44" cy="18" r="1.200" fill="#6B2F22"/>
      <rect x="26.500" y="24" width="23" height="24" rx="8.500" fill="${h}"/><path d="M33.500 24.200L38 34L42.500 24.200Z" fill="#fff"/><path d="M37 26.500h2l1 8.500-2 2.600-2-2.600Z" fill="#F2B33D"/><path d="M33.500 24.200L38 34L31.500 29ZM42.500 24.200L38 34L44.500 29Z" fill="${o}" opacity=".7"/>
      <g transform="translate(38 14)"><g class="ae-tete">${tete(a, 0)}</g></g>
      <path d="M28 30L20.500 38.500L28 40" fill="none" stroke="${h}" stroke-width="5.200" stroke-linecap="round" stroke-linejoin="round"/><circle cx="29.500" cy="39.800" r="2.500" fill="${a.peau}"/>
      <rect x="44.500" y="39" width="15" height="2" rx=".6" fill="#fff"/><rect x="45.500" y="37.600" width="15" height="2" rx=".6" fill="#EEF2FA"/>
      <g class="ae-tampon"><path d="M48 30L56.500 34.500L53 36" fill="none" stroke="${h}" stroke-width="5.200" stroke-linecap="round" stroke-linejoin="round"/><rect x="50.600" y="30.500" width="3" height="5" rx="1" fill="#7A2E2A"/><rect x="49" y="35" width="6.200" height="2.600" rx="1" fill="#B6402A"/><circle cx="52.200" cy="33" r="2.500" fill="${a.peau}"/></g>
      <rect x="3" y="40.500" width="70" height="5" rx="2" fill="#7A4326"/><rect x="6" y="45.500" width="64" height="14.500" fill="#A45F36"/><rect x="10" y="48" width="56" height="9.500" rx="1.500" fill="#8E4F2C"/><rect x="29" y="49.800" width="18" height="5.600" rx="1.200" fill="#FFD065"/><rect x="31.500" y="52" width="13" height="1.300" rx=".6" fill="#B5811F"/>
      <path d="M12 40.500v-6" stroke="#B5811F" stroke-width="1.600"/><path d="M6.500 34.500q5.500-6 11 0Z" fill="#2FA36B"/><ellipse class="ae-lampe" cx="12" cy="37.500" rx="6.500" ry="2.600" fill="#FFE9A6" opacity=".55"/>
      <circle cx="66" cy="36" r="3.600" fill="#F2B33D"/><path d="M62.400 36h7.200M66 32.400v7.200" stroke="#B5811F" stroke-width=".8"/><rect x="65.200" y="39.200" width="1.600" height="1.500" fill="#B5811F"/>
    </svg>`;
  }
  function employe(poste, graine) { const a = allure(poste, graine); return poste === 'agent' ? agent(a) : poste === 'negociateur' ? negociateur(a, graine) : directeur(a); }
  // le portrait (cartes d'embauche) : le buste du prochain à embaucher
  function portrait(poste, graine) {
    const a = allure(poste, graine), h = a.haut, o = fonce(h, poste === 'directeur' ? 1.5 : 0.75);
    const col = poste === 'agent' ? '' : `<path d="M-4 9L0 17.500L4 9Z" fill="#fff"/><path d="M-.9 11h1.800l.9 6-1.800 2.400-1.800-2.400Z" fill="#F2B33D"/><path d="M-4 9L0 17.500L-6.500 13ZM4 9L0 17.500L6.500 13Z" fill="${o}"/>`;
    const plus = poste === 'negociateur' ? '<rect x="9.200" y="-4" width="3.600" height="9.500" rx="1.300" fill="#1C2440"/><rect x="10" y="-2.600" width="2" height="4.600" rx=".5" fill="#8FDBFF"/>' : poste === 'agent' ? '<path d="M-9.800 -2A9.800 9.800 0 0 1 9.800 -2" fill="none" stroke="#1C2440" stroke-width="1.500"/><rect x="-11.600" y="-2.500" width="3.200" height="5.500" rx="1.500" fill="#1C2440"/><path d="M-10 3q0 4.500 5.500 4.800" fill="none" stroke="#1C2440" stroke-width="1"/><circle cx="-4.200" cy="7.800" r="1.100" fill="#1C2440"/>' : '';
    return `<svg class="ae ae-portrait" viewBox="-15 -15 30 31" aria-hidden="true"><path d="M-14 17Q-14 9.500 -6 8.600H6Q14 9.500 14 17Z" fill="${h}"/>${col}${tete(a, 0)}${plus}</svg>`;
  }
  // ---------------------------------------------------------------- les décors (340 × 78 ; le plancher est à y = 70)
  const dalle = '<rect y="70" width="340" height="8" fill="#141B3D"/><rect y="70" width="340" height="1.600" fill="#3A4A8C"/>';
  const lampe = (x) => `<path d="M${x} -12v18" stroke="#1C2440" stroke-width="1.200"/><path d="M${x - 6} 11q6-9 12 0Z" fill="#1C2440"/><circle cx="${x}" cy="11.500" r="2" fill="#FFE9A6"/><path class="ae-lum" d="M${x - 6} 12L${x - 26} 70h52L${x + 6} 12Z" fill="#FFF3C4" opacity=".13"/>`;
  function fenetre(x, y, w, h, g) {
    const r = hasard('f' + g + x); let toits = `M${x} ${y + h}`; for (let i = 0; i < 6; i++) { const py = y + h * (0.42 + r() * 0.38); toits += `V${py.toFixed(1)}H${(x + w * (i + 1) / 6).toFixed(1)}`; }
    let lueurs = ''; for (let i = 0; i < 7; i++) lueurs += `<rect x="${(x + 3 + r() * (w - 6)).toFixed(1)}" y="${(y + h * 0.7 + r() * h * 0.22).toFixed(1)}" width="1.400" height="1.400" fill="#FFD979"/>`;
    return `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="2" fill="#F4F7FD"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#16235C"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.5}" fill="#0C1440"/><circle cx="${x + w * 0.78}" cy="${y + h * 0.26}" r="${Math.min(4, h * 0.14)}" fill="#FFF3C4"/>
      <circle cx="${x + w * 0.2}" cy="${y + h * 0.2}" r=".7" fill="#fff"/><circle cx="${x + w * 0.45}" cy="${y + h * 0.33}" r=".6" fill="#fff"/><path d="${toits}V${y + h}Z" fill="#2A3F96"/>${lueurs}<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h * 0.5}h${w}" stroke="#F4F7FD" stroke-width="1.500"/><rect x="${x - 3}" y="${y + h + 2}" width="${w + 6}" height="2.200" rx="1" fill="#DCE3F2"/>`;
  }
  const plante = (x) => `<path d="M${x} 62q-9-8-6-20 5 6 6 14 1-12 8-17 2 12-5 23Z" fill="#2FA36B"/><path d="M${x} 62q-2-10-9-13 0 9 9 13Z" fill="#23875A"/><path d="M${x - 6} 61h12l-1.500 9h-9Z" fill="#D9744A"/>`;
  function decor(poste) {
    let d = '';
    if (poste === 'agent') {
      d = `<rect width="340" height="70" fill="#D5E4F8"/><rect width="340" height="22" fill="#C6D8F2"/><rect y="64" width="340" height="6" fill="#9FB6DC"/>
        <rect x="18" y="8" width="34" height="22" rx="2" fill="#fff"/><path d="M22 26l6-7 5 4 7-10 8 6" fill="none" stroke="#35B58A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="170" cy="17" r="9" fill="#fff" stroke="#1C2440" stroke-width="1.600"/><path d="M170 11v6l4 3" fill="none" stroke="#1C2440" stroke-width="1.400" stroke-linecap="round"/>
        <rect x="236" y="6" width="46" height="26" rx="2" fill="#fff"/><rect x="241" y="18" width="5" height="10" fill="#4F8DF7"/><rect x="250" y="13" width="5" height="15" fill="#F2B33D"/><rect x="259" y="20" width="5" height="8" fill="#F26B5E"/><rect x="268" y="10" width="5" height="18" fill="#35B58A"/>
        <rect x="96" y="22" width="40" height="3" rx="1" fill="#8A5A2B"/><rect x="100" y="10" width="5" height="12" fill="#F26B5E"/><rect x="106" y="8" width="5" height="14" fill="#4F8DF7"/><rect x="112" y="11" width="5" height="11" fill="#F2B33D"/><rect x="118" y="9" width="5" height="13" fill="#9B6BE8"/><rect x="125" y="12" width="6" height="10" fill="#35B58A"/>
        ${lampe(60)}${lampe(170)}${lampe(280)}`;
    } else if (poste === 'negociateur') {
      d = `<rect width="340" height="70" fill="#F8E6C9"/><path d="M0 0h340v46H0Z" fill="#F3DAB4"/><rect y="64" width="340" height="6" fill="#C9A26B"/>
        ${fenetre(18, 9, 46, 30, 1)}${fenetre(262, 9, 46, 30, 2)}
        <rect x="126" y="7" width="84" height="36" rx="2.500" fill="#fff" stroke="#8C96B3" stroke-width="1.600"/><path d="M134 36l14-8 12 4 16-14 14-4 12-4" fill="none" stroke="#F26B5E" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><path d="M196 9l8 1-3 7" fill="none" stroke="#F26B5E" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><rect x="134" y="12" width="20" height="2" rx="1" fill="#4F8DF7"/><rect x="134" y="16.500" width="13" height="2" rx="1" fill="#C6D8F2"/><rect x="150" y="43" width="36" height="2.400" rx="1" fill="#8C96B3"/>
        <rect x="74" y="46" width="44" height="18" rx="6" fill="#E0685A"/><rect x="70" y="52" width="52" height="14" rx="5" fill="#F27D6E"/><rect x="74" y="66" width="4" height="4" fill="#7A2E2A"/><rect x="114" y="66" width="4" height="4" fill="#7A2E2A"/><rect x="88" y="50" width="16" height="9" rx="3" fill="#FFD065"/>
        <rect x="226" y="40" width="13" height="30" rx="2" fill="#EEF2FA"/><rect x="227.500" y="24" width="10" height="17" rx="4" fill="#8FDBFF" opacity=".9"/><rect x="230" y="50" width="5" height="3" rx="1" fill="#4F8DF7"/>
        ${plante(326)}${lampe(96)}${lampe(244)}`;
    } else {
      d = `<rect width="340" height="70" fill="#2F6B5A"/><rect width="340" height="40" fill="#2A5F50"/><g stroke="#3B7E6B" stroke-width="1">${[20, 60, 100, 140, 180, 220, 260, 300].map((x) => `<path d="M${x} -12v52"/>`).join('')}</g><rect y="40" width="340" height="2.400" fill="#FFD065"/><rect y="42.400" width="340" height="27.600" fill="#7A4326"/><g fill="#8E4F2C">${[6, 62, 118, 174, 230, 286].map((x) => `<rect x="${x}" y="46" width="48" height="20" rx="1.500"/>`).join('')}</g>
        ${fenetre(138, 6, 64, 30, 3)}
        <rect x="6" y="6" width="34" height="62" rx="1.500" fill="#5A2E1C"/><g>${[10, 26, 42].map((y, k) => `<rect x="8" y="${y + 12}" width="30" height="1.800" fill="#3D1E12"/>` + [0, 1, 2, 3, 4].map((i) => `<rect x="${9.500 + i * 5.600}" y="${y + (i + k) % 2 * 2}" width="4.400" height="${12 - (i + k) % 2 * 2}" fill="${['#F26B5E', '#4F8DF7', '#F2B33D', '#35B58A', '#9B6BE8'][(i + k * 2) % 5]}"/>`).join('')).join('')}</g>
        <rect x="296" y="8" width="34" height="26" rx="1.500" fill="#FFD065"/><rect x="299" y="11" width="28" height="20" fill="#16235C"/><path d="M299 31l8-11 6 6 5-8 9 13Z" fill="#35B58A"/><circle cx="321" cy="16" r="2.600" fill="#FFF3C4"/>
        <path d="M100 -12v17M240 -12v17" stroke="#FFD065" stroke-width="1.200"/><path d="M92 12q8-12 16 0ZM232 12q8-12 16 0Z" fill="#FFD065"/><path class="ae-lum" d="M92 12L70 70h60L108 12ZM232 12L210 70h60L248 12Z" fill="#FFF3C4" opacity=".11"/>
        ${plante(326)}`;
    }
    const mur = poste === 'agent' ? '#C6D8F2' : poste === 'negociateur' ? '#F3DAB4' : '#2A5F50';
    return `<svg class="ae-decor" viewBox="0 -12 340 90" preserveAspectRatio="none" aria-hidden="true"><rect y="-12" width="340" height="13" fill="${mur}"/>${d}${dalle}</svg>`;
  }
  // ---------------------------------------------------------------- le chantier
  const GRUE = `<svg class="ae-grue" viewBox="0 0 70 70" aria-hidden="true"><g fill="none" stroke="#F2B33D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 70V10M22 70V10M12 10h10M12 22l10-8M12 34l10-8M12 46l10-8M12 58l10-8M12 70l10-8"/><path d="M2 10h64M2 10l15-8 49 8M17 2v8M30 10l-6-5M42 10l-8-6M54 10l-8-5"/></g><rect x="2" y="10" width="9" height="7" rx="1" fill="#8C96B3"/><rect x="13" y="12" width="9" height="9" rx="1.500" fill="#FFD979"/><rect x="14.500" y="13.500" width="6" height="4" fill="#8FDBFF"/><g class="ae-crochet"><path d="M54 10v20" stroke="#DCE3F2" stroke-width="1.200"/><path d="M50 30h8l-1 3h-6Z" fill="#DCE3F2"/><rect x="46" y="33" width="16" height="8" rx="1.400" fill="#F2A93B"/><rect x="46" y="33" width="16" height="2.400" rx="1.200" fill="#FFE08A"/></g></svg>`;
  function ouvrier() {
    const a = { peau: '#E0A577', cheveux: '#2A1B14', coiffure: 'court', haut: '#F26B5E', lunettes: false, sourire: true };
    return `<svg class="ae ae-ouvrier" viewBox="0 0 34 46" aria-hidden="true"><rect x="10.800" y="29" width="5.600" height="14" rx="2.800" fill="#3A4980"/><rect x="17.400" y="29" width="5.600" height="14" rx="2.800" fill="#3A4980"/><rect x="9.600" y="41.500" width="8" height="4" rx="2" fill="#12172B"/><rect x="17" y="41.500" width="8" height="4" rx="2" fill="#12172B"/>
      <rect x="9" y="17" width="16" height="16" rx="6" fill="#F27D2E"/><path d="M12 17.500v15M22 17.500v15" stroke="#FFE08A" stroke-width="2"/><rect x="9" y="26" width="16" height="2" fill="#FFE08A"/>
      <g transform="translate(17 9.500) scale(.86)">${tete(a, 0)}<path d="M-10 -2.500A10 10 0 0 1 10 -2.500Z" fill="#FFD065"/><rect x="-11.500" y="-3.400" width="23" height="2.400" rx="1.200" fill="#F2B33D"/><rect x="-1.200" y="-12.500" width="2.400" height="9" rx="1.200" fill="#F2B33D"/></g>
      <g class="ae-marteau"><path d="M24 20.500L29 25.500" stroke="#F27D2E" stroke-width="4.400" stroke-linecap="round"/><path d="M29 25.500L32 14" stroke="#8A5A2B" stroke-width="1.800" stroke-linecap="round"/><rect x="28.500" y="10.500" width="7.500" height="4.200" rx="1" fill="#8C96B3"/><circle cx="29.200" cy="25.300" r="2.200" fill="#E0A577"/></g>
      <path d="M10 20.500L5.500 27" stroke="#F27D2E" stroke-width="4.400" stroke-linecap="round"/><circle cx="5.300" cy="27.600" r="2.200" fill="#E0A577"/></svg>`;
  }
  const BRIQUE = '<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="1" y="3" width="28" height="14" rx="2.500" fill="#B5811F"/><rect x="1" y="1" width="28" height="14" rx="2.500" fill="#F2A93B"/><rect x="1" y="1" width="28" height="5" rx="2.500" fill="#FFE08A"/><rect x="5" y="8.500" width="8" height="3.600" rx="1.800" fill="#D98E22"/><rect x="17" y="8.500" width="8" height="3.600" rx="1.800" fill="#D98E22"/></svg>';
  // la ville derrière l'immeuble : une ligne de toits et quelques fenêtres allumées
  function ville() {
    const r = hasard('ville'); let x = 0, toits = 'M0 120', lueurs = '';
    while (x < 360) { const w = 14 + Math.floor(r() * 22), h = 22 + Math.floor(r() * 78); toits += `V${120 - h}H${x + w}`;
      for (let k = 0; k < 4; k++) if (r() < 0.55) lueurs += `<rect x="${(x + 3 + r() * (w - 7)).toFixed(1)}" y="${(124 - h + r() * (h - 14)).toFixed(1)}" width="2.2" height="3" fill="#FFD979" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
      x += w; }
    return `<svg class="ag-ville" viewBox="0 0 360 120" preserveAspectRatio="none" aria-hidden="true"><circle cx="318" cy="24" r="10" fill="#FFF3C4" opacity=".9"/><g fill="#fff"><circle cx="40" cy="18" r="1"/><circle cx="96" cy="40" r=".8"/><circle cx="150" cy="12" r="1"/><circle cx="214" cy="34" r=".8"/><circle cx="340" cy="60" r=".9"/><circle cx="20" cy="62" r=".8"/></g><path d="${toits}V120Z" fill="#1C2A6B"/>${lueurs}</svg>`;
  }
  window.AgenceArt = { employe, portrait, decor, allure, GRUE, ouvrier, BRIQUE, ville };
})();
