// Les dessins de l'agence, en pixel art (22 nov. 2026, Gautier : « les dessins sont trop simplistes, je veux du pixel
// art »). Tout est peint ici, pixel par pixel, dans de petits canevas (jamais d'image de fond : un canevas garde ses
// couleurs sur tous les téléphones) :
//   - les employés : peau, coiffure, cheveux, lunettes et tenue tirés d'une graine (tous différents, toujours les mêmes) ;
//     l'agent tape à son bureau (2 images), le négociateur marche au téléphone (4 images), le directeur tamponne (4) ;
//   - le décor de chaque étage (170 × 45 pixels), le toit, la grue, l'ouvrier, la brique, les portraits.
// La scène entière fait 176 pixels de large ; src/agence_jeu.js l'assemble et l'anime, et l'écran l'agrandit sans lissage.
(function () {
  'use strict';
  const K = '#141a33';
  const PEAUX = ['#f8d5b5', '#f1c39b', '#e0a577', '#c68655', '#9c6239', '#70432a'];
  const CHEVEUX = ['#2a1b14', '#4b2e1c', '#7a4a24', '#b8772e', '#e0b152', '#b6402a', '#1d1f2b', '#9aa3b5'];
  const HAUTS = { agent: ['#4f8df7', '#35b58a', '#f26b5e', '#f2b33d', '#9b6be8', '#2fb5c9', '#ec6fa8', '#6c7bd9'], negociateur: ['#31406e', '#5b3b8c', '#1f6f6b', '#8c3b4a', '#3b5b8c', '#4a4a58'], directeur: ['#1b2444', '#2b2b33', '#3a1f33', '#10323a'] };
  const COIFFURES = ['court', 'meche', 'long', 'chignon', 'afro', 'barbe', 'queue', 'carre'];
  const OR = '#f2b33d', PANTALON = '#27304f', BOIS = '#d99a5b', BOIS2 = '#b5773e';
  function hasard(graine) { let h = 2166136261; const s = String(graine); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const teinte = (c, k) => { const n = parseInt(c.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
  function allure(poste, graine) {
    const r = hasard(poste + ':' + graine), pris = (l) => l[Math.floor(r() * l.length)];
    return { peau: pris(PEAUX), cheveux: pris(CHEVEUX), coiffure: pris(COIFFURES), haut: pris(HAUTS[poste] || HAUTS.agent), lunettes: r() < 0.22, sourire: r() < 0.6 };
  }
  function toile(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // un dessin = une liste de rectangles ; ceux marqués « contour » reçoivent un liseré sombre d'un pixel, peint d'abord
  function dessin(c) {
    const g = c.getContext('2d'), liste = [];
    return { r(x, y, w, h, coul, contour) { liste.push([x, y, w, h, coul, contour !== false]); },
      fin() { g.fillStyle = K; for (const [x, y, w, h, , o] of liste) if (o) g.fillRect(x - 1, y - 1, w + 2, h + 2); for (const [x, y, w, h, coul] of liste) { g.fillStyle = coul; g.fillRect(x, y, w, h); } return c; } };
  }
  // la tête : 9 × 9 pixels, (x, y) son coin ; d = 1 quand elle regarde à droite
  function tete(D, x, y, a, d) {
    const h = a.cheveux, h2 = teinte(h, 0.75), p = a.peau, p2 = teinte(p, 0.86), c = a.coiffure; d = d || 0;
    if (c === 'long') { D.r(x - 1, y + 2, 2, 10, h); D.r(x + 8, y + 2, 2, 10, h); }
    if (c === 'afro') { D.r(x, y - 3, 9, 3, h); D.r(x - 2, y - 1, 13, 6, h); }
    if (c === 'queue') D.r(x - 2, y + 2, 2, 7, h);
    if (c === 'carre') { D.r(x - 1, y + 2, 1, 6, h); D.r(x + 9, y + 2, 1, 6, h); }
    if (c === 'chignon') D.r(x + 3, y - 3, 3, 3, h);
    D.r(x + 1, y, 7, 9, p); D.r(x, y + 1, 9, 7, p);
    D.r(x + 1, y + 8, 7, 1, p2, false); D.r(x, y + 7, 1, 1, p2, false); D.r(x + 8, y + 7, 1, 1, p2, false);
    if (c === 'barbe') { D.r(x + 1, y, 7, 1, h2, false); D.r(x, y + 5, 9, 3, h, false); D.r(x + 1, y + 8, 7, 1, h, false); D.r(x + 3 + d, y + 6, 3, 1, p, false); }
    else { D.r(x + 1, y, 7, 2, h, false); D.r(x, y + 1, 9, 2, h, false); D.r(x, y + 3, 1, 2, h, false); if (!d) D.r(x + 8, y + 3, 1, 2, h, false); D.r(x + 2, y, 3, 1, teinte(h, 1.35), false);
      if (c === 'meche') D.r(x + 4, y + 3, 4, 1, h, false);
      if (a.sourire) D.r(x + 3 + d, y + 7, 3, 1, '#a8453a', false); else D.r(x + 4 + d, y + 7, 2, 1, '#a8453a', false);
      D.r(x + 1 + d, y + 6, 1, 1, '#f2907f', false); D.r(x + 7, y + 6, 1, 1, '#f2907f', false); }
    D.r(x + 2 + d, y + 4, 1, 2, K, false); D.r(x + 5 + d, y + 4, 1, 2, K, false);
    if (a.lunettes) { D.r(x + 1 + d, y + 3, 7, 1, K, false); D.r(x + 1 + d, y + 4, 1, 2, '#bfe6ff', false); D.r(x + 4 + d, y + 4, 1, 2, '#bfe6ff', false); D.r(x + 3 + d, y + 6, 1, 1, K, false); D.r(x + 6 + d, y + 6, 1, 1, K, false); }
  }
  // l'agent (32 × 34) : assis de profil devant son écran, il tape
  function agent(a, f) {
    const c = toile(32, 34), D = dessin(c), b = 34, s = a.haut, s2 = teinte(s, 0.76), up = f % 2;
    D.r(1, b - 18, 2, 11, '#3a4980'); D.r(1, b - 8, 10, 2, '#3a4980'); D.r(5, b - 5, 1, 3, '#8c96b3', false); D.r(2, b - 2, 8, 1, '#8c96b3', false); D.r(2, b - 1, 1, 1, K, false); D.r(9, b - 1, 1, 1, K, false);
    D.r(5, b - 11, 9, 3, PANTALON); D.r(12, b - 9, 3, 7, PANTALON); D.r(12, b - 2, 5, 2, '#0d1122');
    D.r(4, b - 19, 6, 9, s); D.r(4, b - 12, 6, 2, s2, false); D.r(4, b - 19, 1, 9, s2, false);
    D.r(13, b - 13, 18, 2, BOIS); D.r(13, b - 11, 18, 1, BOIS2, false); D.r(23, b - 10, 6, 5, '#c98b4e'); D.r(25, b - 8, 2, 1, '#8a5a2b', false); D.r(29, b - 11, 2, 11, BOIS2);
    D.r(24, b - 17, 2, 4, '#59658c'); D.r(20, b - 27, 10, 10, '#26305a'); D.r(21, b - 26, 8, 8, '#8fdbff', false); D.r(21, b - 26, 8, 1, '#c9f0ff', false);
    for (let i = 0; i < 3; i++) D.r(22, b - 25 + ((i * 3 + f) % 7), 2 + (i * 2 + f) % 4, 1, '#fff', false);
    D.r(14, b - 14, 6, 1, '#3a4466', false);
    tete(D, 2, b - 29, a, 1);
    D.r(8, b - 17, 2, 3, s2, false); D.r(8, b - 15, 6, 2, s2, false); D.r(14, b - 15 - up, 2, 2, a.peau);
    return D.fin();
  }
  // le négociateur (16 × 36) : debout, au téléphone, il marche et fait de grands gestes
  function negociateur(a, f) {
    const c = toile(16, 36), D = dessin(c), b = 36, s = a.haut, s2 = teinte(s, 0.72), pas = f % 4;
    if (pas % 2 === 0) { D.r(5, b - 12, 2, 10, PANTALON); D.r(8, b - 12, 2, 10, PANTALON); D.r(4, b - 2, 3, 2, '#0d1122'); D.r(8, b - 2, 3, 2, '#0d1122'); }
    else { D.r(4, b - 12, 2, 10 - (pas === 1 ? 1 : 0), PANTALON); D.r(9, b - 12, 2, 10 - (pas === 3 ? 1 : 0), PANTALON); D.r(2, b - 2 - (pas === 1 ? 1 : 0), 3, 2, '#0d1122'); D.r(10, b - 2 - (pas === 3 ? 1 : 0), 3, 2, '#0d1122'); }
    if (pas < 2) { D.r(2, b - 20, 2, 5, s2); D.r(2, b - 15, 2, 2, a.peau); } else { D.r(1, b - 23, 2, 5, s2); D.r(1, b - 25, 2, 2, a.peau); }
    D.r(4, b - 21, 7, 10, s); D.r(4, b - 13, 7, 2, s2, false); D.r(6, b - 21, 3, 4, '#fff', false); D.r(7, b - 20, 1, 4, OR, false);
    D.r(11, b - 20, 2, 4, s2); D.r(12, b - 25, 2, 6, s2);
    tete(D, 3, b - 31, a, 0);
    D.r(12, b - 30, 2, 5, K); D.r(12, b - 29, 1, 2, '#8fdbff', false); D.r(12, b - 25, 2, 2, a.peau, false);
    return D.fin();
  }
  // le directeur (40 × 36) : costume, fauteuil de cuir, grand bureau, il tamponne ses dossiers
  function directeur(a, f) {
    const c = toile(40, 36), D = dessin(c), b = 36, s = a.haut, s2 = teinte(s, 1.5), bas = f % 4 === 0 ? 0 : 2;
    D.r(11, b - 34, 18, 26, '#6b2f22'); D.r(13, b - 32, 14, 22, '#8a4030', false); D.r(15, b - 30, 1, 1, '#6b2f22', false); D.r(24, b - 30, 1, 1, '#6b2f22', false);
    D.r(13, b - 22, 14, 10, s); D.r(18, b - 22, 4, 5, '#fff', false); D.r(19, b - 21, 2, 5, OR, false); D.r(13, b - 22, 2, 10, s2, false);
    tete(D, 15, b - 32, a, 0);
    D.r(10, b - 19, 3, 6, s); D.r(11, b - 14, 3, 2, a.peau, false);
    D.r(24, b - 13, 9, 1, '#fff', false);
    D.r(27, b - 20, 3, 5 - bas, s); D.r(27, b - 16 - bas, 3, 2, a.peau, false); D.r(27, b - 14 - bas, 3, 2, '#b6402a', false);
    D.r(1, b - 12, 38, 2, '#7a4326'); D.r(3, b - 10, 34, 10, '#a45f36'); D.r(5, b - 8, 30, 6, '#8e4f2c', false); D.r(15, b - 7, 10, 3, '#ffd065', false); D.r(17, b - 6, 6, 1, '#b5811f', false);
    D.r(5, b - 16, 1, 4, '#b5811f', false); D.r(3, b - 18, 5, 2, '#2fa36b'); D.r(3, b - 16, 5, 1, '#ffe9a6', false);
    D.r(33, b - 16, 3, 3, OR); D.r(34, b - 13, 1, 1, '#b5811f', false);
    return D.fin();
  }
  const FAIRE = { agent, negociateur, directeur }, IMAGES = { agent: 2, negociateur: 4, directeur: 4 }, CACHE = new Map();
  // l'image d'un employé (gardée : on ne la repeint jamais)
  function employe(poste, graine, f) {
    const n = IMAGES[poste], k = poste + '|' + graine + '|' + (f % n); let c = CACHE.get(k);
    if (!c) { if (CACHE.size > 400) CACHE.clear(); c = FAIRE[poste](allure(poste, graine), f % n); CACHE.set(k, c); } return c;
  }
  // le portrait (16 × 16) du prochain embauché, pour sa carte
  function portrait(poste, graine) {
    const a = allure(poste, graine), c = toile(16, 16), g = c.getContext('2d'), D = dessin(c), s = a.haut;
    g.fillStyle = poste === 'agent' ? '#c6d8f2' : poste === 'negociateur' ? '#f3dab4' : '#2f6b5a'; g.fillRect(0, 0, 16, 16);
    D.r(2, 13, 12, 4, s); if (poste !== 'agent') { D.r(7, 13, 3, 3, '#fff', false); D.r(8, 13, 1, 3, OR, false); }
    tete(D, 4, 3, a, 0);
    if (poste === 'negociateur') { D.r(13, 5, 2, 5, K); D.r(13, 6, 1, 2, '#8fdbff', false); }
    if (poste === 'agent') { D.r(3, 5, 1, 4, K, false); D.r(4, 1, 8, 1, K, false); D.r(3, 2, 1, 3, K, false); D.r(12, 2, 1, 3, K, false); D.r(3, 9, 3, 1, K, false); }
    return D.fin();
  }
  // ---------------------------------------------------------------- les décors (170 × 45 ; la pièce fait 41 de haut)
  function fenetre(g, x, y, w, h, gr) {
    const r = hasard('f' + gr), R = (c, a, b, l, k) => { g.fillStyle = c; g.fillRect(a, b, l, k); };
    R(K, x - 2, y - 2, w + 4, h + 4); R('#f4f7fd', x - 1, y - 1, w + 2, h + 2); R('#0c1440', x, y, w, h); R('#16235c', x, y + (h >> 1), w, h - (h >> 1));
    for (let i = 0; i < 5; i++) R('#fff', x + 1 + Math.floor(r() * (w - 2)), y + 1 + Math.floor(r() * (h / 2 - 1)), 1, 1);
    R('#fff3c4', x + w - 6, y + 2, 3, 3);
    for (let i = 0, px = x; px < x + w; i++) { const l = 3 + Math.floor(r() * 4), ht = 3 + Math.floor(r() * (h / 2)); R('#2a3f96', px, y + h - ht, Math.min(l, x + w - px), ht); if (r() < 0.7) R('#ffd979', px + 1, y + h - ht + 1 + Math.floor(r() * Math.max(1, ht - 2)), 1, 1); px += l; }
    R('#f4f7fd', x + (w >> 1), y, 1, h); R('#f4f7fd', x, y + (h >> 1), w, 1); R('#dce3f2', x - 2, y + h + 2, w + 4, 1);
  }
  function plante(g, x, y) { const R = (c, a, b, l, k) => { g.fillStyle = c; g.fillRect(a, b, l, k); };
    R(K, x - 1, y - 6, 8, 7); R('#d9744a', x, y - 5, 6, 5); R('#b85a35', x, y - 1, 6, 1); R(K, x + 2, y - 15, 3, 10); R('#2fa36b', x + 3, y - 14, 1, 9);
    [[-2, -12, 4, 3], [4, -13, 4, 3], [-1, -17, 3, 4], [4, -18, 3, 4], [1, -20, 3, 4]].forEach(([a, b, l, k]) => { R(K, x + a - 1, y + b - 1, l + 2, k + 2); R('#2fa36b', x + a, y + b, l, k); R('#49c98a', x + a, y + b, l, 1); }); }
  function lampe(g, x, allume) { const R = (c, a, b, l, k) => { g.fillStyle = c; g.fillRect(a, b, l, k); };
    R(K, x, 0, 1, 4); R(K, x - 3, 4, 7, 3); R('#3a4466', x - 2, 4, 5, 2); if (allume) { R('#ffe9a6', x - 1, 6, 3, 1); g.fillStyle = 'rgba(255,243,196,.10)'; for (let i = 0; i < 34; i++) g.fillRect(x - 2 - Math.floor(i / 3), 7 + i, 5 + 2 * Math.floor(i / 3), 1); } }
  const DECORS = new Map();
  function decor(poste, allume) {
    const cle = poste + (allume ? '1' : '0'); if (DECORS.has(cle)) return DECORS.get(cle);
    const c = toile(170, 45), g = c.getContext('2d'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); };
    if (poste === 'agent') {
      R('#cfe0f5', 0, 0, 170, 41); R('#bcd0ee', 0, 0, 170, 3); R('#dbe8fa', 0, 3, 170, 1); for (let x = 0; x < 170; x += 17) R('#c4d6f0', x, 4, 1, 30); R('#9fb6dc', 0, 34, 170, 1); R('#aebfdf', 0, 35, 170, 6); for (let x = 3; x < 170; x += 8) R('#a3b5d8', x, 37 + (x % 16 ? 0 : 2), 4, 1);
      R(K, 7, 6, 18, 13); R('#fff', 8, 7, 16, 11); [[9, 15], [11, 13], [13, 14], [15, 11], [17, 12], [19, 9], [21, 10]].forEach(([a, b]) => R('#35b58a', a, b, 2, 1)); R('#f26b5e', 9, 8, 6, 1);
      R(K, 46, 16, 22, 3); R('#8a5a2b', 47, 17, 20, 1); [['#f26b5e', 6], ['#4f8df7', 8], ['#f2b33d', 5], ['#9b6be8', 7], ['#35b58a', 6], ['#f26b5e', 4]].forEach(([coul, ht], i) => { R(K, 47 + i * 3, 17 - ht - 1, 4, ht + 1); R(coul, 48 + i * 3, 17 - ht, 2, ht); });
      R(K, 81, 5, 9, 11); R(K, 80, 6, 11, 9); R('#fff', 81, 6, 9, 9); R('#fff', 82, 5, 7, 11); R(K, 85, 7, 1, 4); R(K, 85, 10, 3, 1); R('#f26b5e', 85, 10, 1, 1);
      R(K, 116, 5, 24, 15); R('#fff', 117, 6, 22, 13); [['#4f8df7', 5], ['#f2b33d', 8], ['#f26b5e', 4], ['#35b58a', 10], ['#9b6be8', 6]].forEach(([coul, ht], i) => R(coul, 119 + i * 4, 17 - ht, 3, ht)); R('#8c96b3', 118, 17, 20, 1);
      R(K, 154, 8, 10, 12); R('#fff7d6', 155, 9, 8, 10); R('#f2b33d', 156, 11, 6, 1); R('#8c96b3', 156, 13, 5, 1); R('#8c96b3', 156, 15, 6, 1); R('#f26b5e', 158, 8, 2, 2);
      [28, 85, 142].forEach((x) => lampe(g, x, allume));
    } else if (poste === 'negociateur') {
      R('#f8e6c9', 0, 0, 170, 41); R('#efd7ac', 0, 0, 170, 3); R('#f0d2a4', 0, 24, 170, 10); R('#e2bf8a', 0, 24, 170, 1); for (let x = 5; x < 170; x += 11) R('#e8c896', x, 26, 1, 7); R('#b98f58', 0, 34, 170, 1); R('#c9a26b', 0, 35, 170, 6); for (let x = 0; x < 170; x += 14) R('#bd955d', x, 35, 1, 6);
      fenetre(g, 8, 5, 22, 15, 1); fenetre(g, 133, 5, 22, 15, 2);
      R(K, 59, 3, 46, 20); R('#8c96b3', 60, 4, 44, 18); R('#fff', 61, 5, 42, 16); [[63, 18], [67, 17], [71, 15], [75, 16], [79, 13], [83, 11], [87, 12], [91, 9], [95, 7]].forEach(([a, b]) => R('#f26b5e', a, b, 4, 2)); R('#f26b5e', 97, 6, 3, 1); R('#f26b5e', 99, 6, 1, 4); R('#4f8df7', 63, 7, 10, 1); R('#c6d8f2', 63, 9, 7, 1); R('#8c96b3', 70, 23, 24, 1);
      R(K, 35, 23, 24, 16); R('#e0685a', 36, 24, 22, 9); R('#f27d6e', 36, 24, 22, 2); R(K, 33, 29, 28, 10); R('#f27d6e', 34, 30, 26, 8); R('#c9574a', 34, 36, 26, 2); R('#ffd065', 43, 27, 8, 5); R(K, 35, 39, 2, 2); R(K, 57, 39, 2, 2);
      R(K, 111, 20, 8, 21); R('#eef2fa', 112, 21, 6, 20); R(K, 112, 11, 6, 10); R('#8fdbff', 113, 12, 4, 8); R('#c9f0ff', 113, 12, 1, 6); R('#4f8df7', 114, 26, 2, 2); R('#c6d8f2', 112, 31, 6, 1);
      plante(g, 160, 41); [47, 122].forEach((x) => lampe(g, x, allume));
    } else {
      R('#2f6b5a', 0, 0, 170, 22); R('#275c4d', 0, 0, 170, 3); for (let x = 4; x < 170; x += 10) R('#377a67', x, 3, 1, 19); R('#ffd065', 0, 22, 170, 1); R('#b5811f', 0, 23, 170, 1); R('#7a4326', 0, 24, 170, 11); for (let x = 2; x < 170; x += 24) { R('#6a3820', x, 26, 20, 7); R('#8e4f2c', x + 1, 27, 18, 5); } R('#5a2e1c', 0, 35, 170, 1); R('#8a2f3a', 0, 36, 170, 5); for (let x = 2; x < 170; x += 6) R('#a03a47', x, 38, 2, 1);
      fenetre(g, 67, 4, 36, 15, 3);
      R(K, 2, 2, 19, 37); R('#5a2e1c', 3, 3, 17, 35); [0, 1, 2].forEach((k) => { R('#3d1e12', 4, 13 + k * 11, 15, 1); ['#f26b5e', '#4f8df7', '#f2b33d', '#35b58a', '#9b6be8'].forEach((coul, i) => { const ht = 7 - (i + k) % 3; R(['#f26b5e', '#4f8df7', '#f2b33d', '#35b58a', '#9b6be8'][(i + k * 2) % 5], 4 + i * 3, 13 + k * 11 - ht, 2, ht); }); });
      R(K, 146, 4, 20, 14); R('#ffd065', 147, 5, 18, 12); R('#16235c', 149, 7, 14, 8); R('#35b58a', 149, 12, 14, 3); R('#35b58a', 152, 10, 4, 2); R('#35b58a', 158, 11, 3, 1); R('#fff3c4', 159, 8, 2, 2);
      [31, 113].forEach((x) => { R('#ffd065', x, 0, 1, 3); R(K, x - 4, 3, 9, 4); R('#ffd065', x - 3, 3, 7, 3); if (allume) { R('#fff3c4', x - 1, 6, 3, 1); g.fillStyle = 'rgba(255,243,196,.09)'; for (let i = 0; i < 34; i++) g.fillRect(x - 3 - Math.floor(i / 3), 7 + i, 7 + 2 * Math.floor(i / 3), 1); } });
      plante(g, 160, 41);
    }
    R('#141b3d', 0, 41, 170, 4); R('#3a4a8c', 0, 41, 170, 1);
    if (!allume) { g.fillStyle = 'rgba(7,11,34,.66)'; g.fillRect(0, 0, 170, 41); }
    DECORS.set(cle, c); return c;
  }
  // ---------------------------------------------------------------- le chantier
  function grue(f) {
    const c = toile(34, 30), g = c.getContext('2d'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); }, J = '#f2b33d', J2 = '#b5811f';
    R(J, 5, 4, 1, 26); R(J, 9, 4, 1, 26); for (let y = 6; y < 30; y += 4) { R(J2, 6, y, 3, 1); R(J, 6 + (y % 8 ? 0 : 2), y + 2, 1, 1); }
    R(J, 0, 4, 34, 1); R(J, 0, 6, 34, 1); for (let x = 1; x < 34; x += 3) R(J2, x, 5, 1, 1); R(J, 7, 0, 1, 4); R(J2, 3, 2, 4, 1); R(J2, 8, 1, 8, 1); R(J2, 16, 2, 8, 1); R(J2, 24, 3, 6, 1);
    R('#8c96b3', 0, 7, 4, 3); R(K, 5, 7, 5, 5); R('#ffd979', 6, 8, 3, 3); R('#8fdbff', 6, 8, 3, 1);
    const dx = [0, 1, 0, -1][f % 4]; R('#dce3f2', 26, 7, 1, 8); R('#dce3f2', 26 + dx, 15, 1, 3); R(K, 22 + dx, 18, 9, 6); R('#f2a93b', 23 + dx, 19, 7, 4); R('#ffe08a', 23 + dx, 19, 7, 1); R('#b5811f', 23 + dx, 22, 7, 1);
    return c;
  }
  const OUVRIERS = [];
  function ouvrier(f) {
    f %= 2; if (OUVRIERS[f]) return OUVRIERS[f];
    const c = toile(18, 24), D = dessin(c), b = 24, a = { peau: '#e0a577', cheveux: '#2a1b14', coiffure: 'court', lunettes: false, sourire: true };
    D.r(5, b - 8, 2, 6, '#3a4980'); D.r(8, b - 8, 2, 6, '#3a4980'); D.r(4, b - 2, 3, 2, '#0d1122'); D.r(8, b - 2, 3, 2, '#0d1122');
    D.r(4, b - 15, 7, 8, '#f27d2e'); D.r(4, b - 11, 7, 1, '#ffe08a', false); D.r(5, b - 15, 1, 8, '#ffe08a', false); D.r(9, b - 15, 1, 8, '#ffe08a', false);
    D.r(2, b - 14, 2, 5, '#f27d2e'); D.r(2, b - 9, 2, 2, a.peau, false);
    tete(D, 3, b - 24, a, 0);
    D.r(3, b - 25, 9, 3, '#ffd065'); D.r(2, b - 22, 11, 1, '#f2b33d'); D.r(7, b - 25, 1, 3, '#f2b33d', false);
    if (f) { D.r(11, b - 14, 4, 2, '#f27d2e'); D.r(15, b - 14, 2, 2, a.peau, false); D.r(15, b - 12, 1, 2, '#8a5a2b', false); D.r(14, b - 10, 3, 2, '#8c96b3'); }
    else { D.r(11, b - 17, 2, 4, '#f27d2e'); D.r(11, b - 19, 2, 2, a.peau, false); D.r(12, b - 23, 1, 4, '#8a5a2b', false); D.r(11, b - 25, 4, 2, '#8c96b3'); }
    return (OUVRIERS[f] = D.fin());
  }
  // une brique d'or : 7 × 4 dans le mur, ou en grand (le bouton)
  function brique(g, x, y) { g.fillStyle = '#f2a93b'; g.fillRect(x, y, 7, 4); g.fillStyle = '#ffe08a'; g.fillRect(x, y, 7, 1); g.fillStyle = '#b5811f'; g.fillRect(x, y + 3, 7, 1); g.fillStyle = '#d98e22'; g.fillRect(x + 3, y + 1, 1, 2); }
  function grandeBrique() {
    const c = toile(16, 9), g = c.getContext('2d'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); };
    R(K, 0, 0, 16, 9); R('#f2a93b', 1, 1, 14, 7); R('#ffe08a', 1, 1, 14, 2); R('#fff3c4', 2, 1, 4, 1); R('#b5811f', 1, 6, 14, 2); R('#d98e22', 3, 4, 4, 1); R('#d98e22', 9, 4, 4, 1); return c;
  }
  // la ville derrière l'immeuble (120 × 60) : des toits, des fenêtres allumées, la lune
  let VILLE = null;
  function ville() {
    if (VILLE) return VILLE; const c = toile(120, 60), g = c.getContext('2d'), r = hasard('ville'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); };
    for (let i = 0; i < 16; i++) R('#fff', Math.floor(r() * 120), Math.floor(r() * 30), 1, 1);
    R('#fff3c4', 100, 6, 6, 6); R('#fff3c4', 99, 7, 8, 4); R('#fff3c4', 101, 5, 4, 8); R('#e6d59a', 102, 8, 2, 2);
    for (let x = 0; x < 120;) { const l = 5 + Math.floor(r() * 9), h = 10 + Math.floor(r() * 34); R('#1c2a6b', x, 60 - h, l, h); R('#24357f', x, 60 - h, l, 1); if (r() < 0.4) R('#1c2a6b', x + 1, 60 - h - 3, 1, 3);
      for (let k = 0; k < 5; k++) if (r() < 0.5) R('#ffd979', x + 1 + Math.floor(r() * (l - 2)), 60 - h + 2 + Math.floor(r() * (h - 4)), 1, 1); x += l; }
    return (VILLE = c);
  }
  // recopier un dessin dans un canevas de la page (les portraits, la brique du bouton)
  function poser(cible, source) { if (!cible || !source) return; cible.width = source.width; cible.height = source.height; cible.getContext('2d').drawImage(source, 0, 0); }
  window.AgencePixel = { employe, portrait, decor, grue, ouvrier, brique, grandeBrique, poser, ville, IMAGES, K };
})();
