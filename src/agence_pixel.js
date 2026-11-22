// Les dessins de l'agence, en pixel art fin (22 nov. 2026, Gautier : « je veux du pixel art », puis devant une première
// version à gros pixels : « changer complètement le design, du pixel art beaucoup plus précis, beaucoup plus fin »).
// La scène fait 352 pixels de large (deux fois plus fine que la première). Tout est peint ici, dans de petits canevas :
//   - un petit atelier (feuille) : on y pose des formes pleines (rectangles, ellipses, polygones, traits), chacune dans
//     une matière ; au rendu, chaque matière reçoit toute seule son contour sombre, sa lumière (en haut à gauche) et son
//     ombre (en bas à droite, et sous ce qui passe devant elle) ;
//   - les employés, vus de face : peau, coiffure, cheveux, lunettes et tenue tirés d'une graine (tous différents, toujours
//     les mêmes) ; l'agent tape derrière son portable, le négociateur marche au téléphone, le directeur signe ;
//   - les trois pièces (346 × 96), le toit et son enseigne, le chantier, la ville, les portraits, une police en pixels.
// src/agence_jeu.js assemble et anime la scène ; l'écran l'agrandit sans la lisser.
(function () {
  'use strict';
  const K = '#161a36';
  const PEAUX = ['#fbd9bb', '#f3c49c', '#e2a678', '#c98856', '#a0653b', '#73452b'];
  const CHEVEUX = ['#2a1b14', '#4b2e1c', '#7a4a24', '#b8772e', '#e3b556', '#b6402a', '#1d1f2b', '#a3acbd'];
  const HAUTS = { agent: ['#4f8df7', '#35b58a', '#f26b5e', '#f2b33d', '#9b6be8', '#2fb5c9', '#ec6fa8', '#6c7bd9'], negociateur: ['#33457a', '#5b3b8c', '#1f6f6b', '#8c3b4a', '#3b5b8c', '#55556a'], directeur: ['#1f2a52', '#33333d', '#40223a', '#12383f'], receptionniste: ['#e25d8a', '#2fb5c9', '#9b6be8', '#35b58a', '#f26b5e'], formateur: ['#c9743a', '#3b82d6', '#7a8c3a', '#8c3b6a', '#2f8f8a'], photographe: ['#4a5075', '#7a4a24', '#2f6b5a', '#8c3b4a', '#5b3b8c'], associe: ['#e9dfc8', '#d9c7a0', '#cdbbe3', '#b7d9cf', '#f0c9c0'] };
  const COIFFURES = ['court', 'meche', 'long', 'chignon', 'afro', 'barbe', 'queue', 'carre'];
  function hasard(graine) { let h = 2166136261; const s = String(graine); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const teinte = (c, k) => { const n = parseInt(c.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
  function allure(poste, graine) {
    const r = hasard(poste + ':' + graine), pris = (l) => l[Math.floor(r() * l.length)];
    return { peau: pris(PEAUX), cheveux: pris(CHEVEUX), coiffure: pris(COIFFURES), haut: pris(HAUTS[poste] || HAUTS.agent), lunettes: r() < 0.24, sourire: r() < 0.6, femme: r() < 0.5 };
  }
  function toile(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const rvb = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

  // ---------------------------------------------------------------- l'atelier
  function feuille(w, h) {
    const m = new Uint8Array(w * h), z = new Uint16Array(w * h), mats = [null]; let rang = 0;
    const F = { w, h,
      // une matière : sa couleur ; plat = un détail, sans contour ni relief
      mat(base, o) { mats.push(Object.assign({ b: base, l: teinte(base, 1.17), d: teinte(base, 0.8), o: teinte(base, 0.48) }, o || {})); return mats.length - 1; },
      p(x, y, i) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < w && y < h) { m[y * w + x] = i; z[y * w + x] = rang; } },
      r(x, y, l, k, i) { rang++; for (let b = 0; b < k; b++) for (let a = 0; a < l; a++) F.p(x + a, y + b, i); },
      e(cx, cy, rx, ry, i) { rang++; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) F.p(x, y, i); } },
      // un rectangle aux coins arrondis
      rr(x, y, l, k, ray, i) { rang++; for (let b = 0; b < k; b++) for (let a = 0; a < l; a++) { const dx = a < ray ? ray - a - 0.5 : a >= l - ray ? a - (l - ray) + 0.5 : 0, dy = b < ray ? ray - b - 0.5 : b >= k - ray ? b - (k - ray) + 0.5 : 0; if (dx * dx + dy * dy <= ray * ray) F.p(x + a, y + b, i); } },
      poly(pts, i) { rang++; let y0 = Infinity, y1 = -Infinity; pts.forEach((q) => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const yy = y + 0.5, xs = []; for (let a = 0; a < pts.length; a++) { const A = pts[a], B = pts[(a + 1) % pts.length]; if ((A[1] <= yy && B[1] > yy) || (B[1] <= yy && A[1] > yy)) xs.push(A[0] + (yy - A[1]) / (B[1] - A[1]) * (B[0] - A[0])); }
          xs.sort((a, b) => a - b); for (let a = 0; a + 1 < xs.length; a += 2) for (let x = Math.round(xs[a]); x < Math.round(xs[a + 1]); x++) F.p(x, y, i); } },
      // un trait épais
      l(x0, y0, x1, y1, ep, i) { rang++; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2, d = (ep - 1) / 2; for (let t = 0; t <= n; t++) { const x = x0 + (x1 - x0) * t / n, y = y0 + (y1 - y0) * t / n; for (let b = 0; b < ep; b++) for (let a = 0; a < ep; a++) F.p(Math.round(x - d) + a, Math.round(y - d) + b, i); } },
      fin() {
        const c = toile(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, coul = new Map(), C = (s) => { let v = coul.get(s); if (!v) coul.set(s, (v = rvb(s))); return v; };
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = y * w + x, i = m[q]; if (!i) continue; const M = mats[i]; let c2 = M.b;
          if (!M.plat) { const H = y > 0 ? q - w : -1, B = y < h - 1 ? q + w : -1, G = x > 0 ? q - 1 : -1, D = x < w - 1 ? q + 1 : -1, v = (k) => (k < 0 ? 0 : m[k]);
            const autre = (k) => k >= 0 && m[k] && m[k] !== i && !mats[m[k]].plat;
            if (!v(H) || !v(B) || !v(G) || !v(D)) c2 = M.o;
            else if ((autre(H) && z[H] > z[q]) || (autre(G) && z[G] > z[q])) c2 = M.d;
            else if (autre(H) || autre(G)) c2 = M.l;
            else if ((autre(B) && z[B] < z[q]) || (autre(D) && z[D] < z[q])) c2 = M.d; }
          const [r, v2, b] = C(c2); d[q * 4] = r; d[q * 4 + 1] = v2; d[q * 4 + 2] = b; d[q * 4 + 3] = 255; }
        g.putImageData(im, 0, 0); return c; } };
    return F;
  }

  // ---------------------------------------------------------------- la tête (22 pixels de large), autour de (cx, cy)
  // o : { regard: -1, 0 ou 1 ; clin : les yeux fermés ; parle : la bouche ouverte ; bas : le regard baissé ; casque }
  function tete(F, cx, cy, a, o) {
    o = o || {}; const peau = F.mat(a.peau), ch = F.mat(a.cheveux, { l: teinte(a.cheveux, 1.45) }), c = a.coiffure;
    const sombre = F.mat(teinte(a.peau, 0.74), { plat: true }), rose = F.mat('#f08c7e', { plat: true }), oeil = F.mat(K, { plat: true }), blanc = F.mat('#ffffff', { plat: true }), bouche = F.mat('#8f2f33', { plat: true }), sourcil = F.mat(teinte(a.cheveux, 0.7), { plat: true });
    if (c === 'long') F.rr(cx - 13, cy - 10, 26, 30, 9, ch);
    if (c === 'carre') F.rr(cx - 13, cy - 11, 26, 23, 8, ch);
    if (c === 'afro') F.e(cx, cy - 5, 16, 14, ch);
    if (c === 'queue') { F.e(cx - 13, cy + 3, 4, 8, ch); F.e(cx - 14, cy + 11, 3, 4, ch); }
    if (c === 'chignon') F.e(cx, cy - 14, 5.5, 5, ch);
    F.r(cx - 3, cy + 8, 6, 7, peau);
    F.e(cx - 10.5, cy + 2, 2.2, 3.2, peau); F.e(cx + 10.5, cy + 2, 2.2, 3.2, peau);
    F.e(cx, cy, 10.6, 11.2, peau);
    if (c === 'barbe') { F.e(cx, cy - 5, 10.2, 6, F.mat(teinte(a.cheveux, 0.9))); F.e(cx, cy + 1.5, 9.6, 8, peau); F.e(cx, cy + 6.5, 9.8, 6.6, ch); F.e(cx, cy + 1, 8.6, 5.6, peau); F.rr(cx - 4, cy + 5, 8, 3, 1, ch); }
    else { F.e(cx, cy - 4, 11, 8.6, ch); F.e(cx, cy + 3, 9.4, 9.2, peau); F.r(cx - 11, cy - 2, 2, 5, ch); F.r(cx + 9, cy - 2, 2, 5, ch);
      if (c === 'meche') F.poly([[cx - 10, cy - 6], [cx + 11, cy - 8], [cx + 11, cy], [cx + 4, cy - 3], [cx - 4, cy - 2]], ch);
      if (c === 'carre') F.r(cx - 8, cy - 7, 16, 3, ch);
      if (c === 'afro') F.e(cx, cy - 7, 10, 4, ch);
      F.r(cx - 5, cy - 11, 5, 1, F.mat(teinte(a.cheveux, 1.5), { plat: true })); }
    const dx = o.regard || 0, dy = o.bas ? 1 : 0;
    F.r(cx - 7, cy - 2 + dy, 4, 1, sourcil); F.r(cx + 3, cy - 2 + dy, 4, 1, sourcil);
    if (o.clin) { F.r(cx - 6, cy + 2, 3, 1, oeil); F.r(cx + 3, cy + 2, 3, 1, oeil); }
    else { F.r(cx - 6 + dx, cy + dy, 2, 3, oeil); F.r(cx + 4 + dx, cy + dy, 2, 3, oeil); F.p(cx - 6 + dx, cy + dy, blanc); F.p(cx + 4 + dx, cy + dy, blanc); }
    F.r(cx - 8, cy + 4, 2, 2, rose); F.r(cx + 6, cy + 4, 2, 2, rose);
    F.r(cx - 1, cy + 4, 2, 1, sombre);
    if (c !== 'barbe') { if (o.parle) { F.rr(cx - 2, cy + 6, 4, 3, 1, bouche); F.r(cx - 1, cy + 6, 2, 1, blanc); } else if (a.sourire) { F.r(cx - 2, cy + 7, 4, 1, bouche); F.p(cx - 3, cy + 6, bouche); F.p(cx + 2, cy + 6, bouche); } else F.r(cx - 2, cy + 7, 4, 1, bouche); }
    else if (o.parle) F.r(cx - 2, cy + 6, 4, 2, bouche); else F.r(cx - 2, cy + 6, 4, 1, F.mat(teinte(a.peau, 0.8), { plat: true }));
    if (a.lunettes) { const v = F.mat(K, { plat: true }), verre = F.mat('#cfeeff', { plat: true }); [[cx - 8, cy - 1], [cx + 2, cy - 1]].forEach(([x, y]) => { F.r(x, y, 6, 1, v); F.r(x, y + 4, 6, 1, v); F.r(x, y, 1, 5, v); F.r(x + 5, y, 1, 5, v); F.p(x + 1, y + 1, verre); }); F.r(cx - 2, cy, 4, 1, v); }
    if (o.casque) { const n = F.mat('#262c4d'); for (let t = 0; t <= 20; t++) { const an = Math.PI * (1 + t / 20); F.r(Math.round(cx + Math.cos(an) * 12) - 1, Math.round(cy - 1 + Math.sin(an) * 12.5) - 1, 2, 2, n); }
      F.rr(cx - 14, cy - 2, 4, 8, 2, n); F.rr(cx + 10, cy - 2, 4, 8, 2, n); F.l(cx - 12, cy + 6, cx - 7, cy + 9, 1, n); F.r(cx - 7, cy + 8, 3, 2, n); }
  }

  // ---------------------------------------------------------------- les employés
  // l'agent (66 × 72) : de face derrière son portable, il tape ; i : 0 à 3, 4 = un clin d'œil, 5 = il s'étire, 6 = il boit son café
  function agent(a, i) {
    const F = feuille(66, 72), f = i > 4 ? 0 : i % 4, etire = i === 5, boit = i === 6, s = F.mat(a.haut), fauteuil = F.mat('#3d4f8f'), bois = F.mat('#e0a569'), bois2 = F.mat('#b97b43'), bois3 = F.mat('#9a6233'), gris = F.mat('#4a5378'), noir = F.mat('#262c4d'), blanc = F.mat('#f4f7fd'), peau = F.mat(a.peau);
    const ht = f === 1 ? 1 : 0;
    F.rr(16, 22, 34, 34, 8, fauteuil); F.r(22, 26, 22, 1, F.mat('#5266ad', { plat: true }));
    F.poly([[17, 60], [17, 46], [22, 39], [44, 39], [49, 46], [49, 60]], s);
    F.poly([[28, 39], [33, 44], [38, 39]], F.mat(teinte(a.haut, 1.3))); F.r(32, 44, 2, 6, F.mat(teinte(a.haut, 0.72), { plat: true }));
    tete(F, 33, 23 + ht - (etire ? 1 : 0), a, { casque: true, regard: f === 2 ? 1 : 0, clin: i === 4 || etire, bas: f === 3 && !boit, parle: etire });
    if (etire) { F.l(19, 45, 12, 33, 5, s); F.l(47, 45, 54, 33, 5, s); F.e(11.5, 30, 2.6, 2.6, peau); F.e(54.5, 30, 2.6, 2.6, peau); }
    else { F.l(19, 46, 21, 53, 5, s); if (boit) F.l(47, 46, 44, 37, 5, s); else F.l(47, 46, 45, 53, 5, s); }
    F.poly([[3, 52], [63, 52], [66, 58], [0, 58]], bois); F.r(0, 58, 66, 2, bois2); F.r(2, 60, 62, 10, bois2); F.rr(5, 62, 56, 6, 1, bois3); F.r(30, 64, 6, 1, F.mat('#e0a569', { plat: true })); F.r(3, 70, 5, 2, bois3); F.r(58, 70, 5, 2, bois3);
    F.poly([[23, 37], [43, 37], [44, 53], [22, 53]], gris); F.r(21, 53, 24, 2, noir); F.r(32, 43, 2, 2, F.mat(f % 2 ? '#8fdbff' : '#c9f0ff', { plat: true })); F.r(25, 39, 16, 1, F.mat('#5d6790', { plat: true }));
    if (!etire) { F.e(19.5, 53 - (f % 2), 2.6, 2.2, peau); if (!boit) F.e(46.5, 53 - ((f + 1) % 2), 2.6, 2.2, peau); }
    if (boit) { F.rr(36, 28, 7, 7, 1, blanc); F.e(44, 33, 2.6, 2.6, peau); }
    else { F.rr(53, 46, 6, 7, 1, blanc); F.r(59, 48, 2, 3, blanc); F.r(54, 46, 4, 1, F.mat('#6b4423', { plat: true }));
      const vapeur = F.mat('#dce9ff', { plat: true }); F.p(55 + (f % 2), 43, vapeur); F.p(56 - (f % 2), 41, vapeur); F.p(55 + (f >> 1), 39, vapeur); }
    F.poly([[5, 54], [15, 54], [16, 57], [4, 57]], blanc); F.r(7, 55, 6, 1, F.mat('#9fb6dc', { plat: true })); F.r(6, 51, 9, 2, F.mat('#f2b33d')); F.r(7, 49, 7, 2, F.mat('#f26b5e'));
    return F.fin();
  }
  // le négociateur (34 × 68) : debout, costume, téléphone à l'oreille ; i : 0 à 3 (il marche), 4 = clin d'œil
  function negociateur(a, i) {
    const F = feuille(34, 68), f = i % 4, s = F.mat(a.haut), pant = F.mat(a.femme ? teinte(a.haut, 0.8) : '#2a3256'), noir = F.mat('#191d38'), peau = F.mat(a.peau), blanc = F.mat('#f4f7fd'), or = F.mat('#f2b33d');
    const gx = [0, -2, 0, 2][f], gl = f === 1 ? 2 : 0, dl = f === 3 ? 2 : 0;
    F.r(10 + gx, 46, 6, 18 - gl, pant); F.r(18 - gx, 46, 6, 18 - dl, pant); F.rr(8 + gx, 63 - gl, 9, 5, 2, noir); F.rr(17 - gx, 63 - dl, 9, 5, 2, noir);
    const bras = F.mat(teinte(a.haut, 0.9));
    if (f < 2) { F.l(8, 35, 6, 44, 5, bras); F.e(6, 47, 2.6, 2.6, peau); F.rr(1, 44, 6, 9, 1, F.mat('#e9c46a')); F.r(2, 46, 4, 1, F.mat('#b5811f', { plat: true })); }
    else { F.l(8, 35, 3, 28, 5, bras); F.e(3, 25, 2.6, 2.6, peau); }
    F.poly([[7, 48], [7, 35], [11, 29], [23, 29], [27, 35], [27, 48]], s);
    F.poly([[13, 29], [21, 29], [17, 39]], blanc); F.poly([[16, 31], [18, 31], [19, 38], [17, 41], [15, 38]], or);
    F.l(13, 29, 16, 40, 1, F.mat(teinte(a.haut, 0.62), { plat: true })); F.l(21, 29, 18, 40, 1, F.mat(teinte(a.haut, 0.62), { plat: true })); F.r(16, 43, 2, 1, F.mat(teinte(a.haut, 0.62), { plat: true }));
    F.l(26, 35, 29, 40, 5, bras); F.l(29, 40, 28, 28, 4, bras);
    tete(F, 17, 17, a, { parle: f % 2 === 1, clin: i === 4, regard: f === 2 ? -1 : 0 });
    F.rr(26, 12, 5, 12, 1, noir); F.r(27, 14, 2, 4, F.mat('#8fdbff', { plat: true })); F.e(28.5, 25, 2.6, 2.6, peau);
    return F.fin();
  }
  // le directeur (100 × 76) : costume, fauteuil de cuir, grand bureau d'acajou ; il signe ; i : 0 à 3, 4 = clin d'œil
  function directeur(a, i) {
    const F = feuille(100, 76), f = i % 4, s = F.mat(a.haut), cuir = F.mat('#7d3526'), cuir2 = F.mat('#96432f'), peau = F.mat(a.peau), blanc = F.mat('#f4f7fd'), or = F.mat('#f2b33d'), acajou = F.mat('#7a3a22'), acajou2 = F.mat('#5e2a18'), acajou3 = F.mat('#93492b'), laiton = F.mat('#d9a441'), vert = F.mat('#2fa36b');
    F.rr(29, 3, 42, 58, 13, cuir); F.rr(33, 7, 34, 46, 10, cuir2); const clou = F.mat('#5a2218', { plat: true }); [[40, 14], [50, 12], [60, 14], [38, 26], [62, 26]].forEach(([x, y]) => F.r(x, y, 2, 2, clou));
    F.poly([[31, 62], [31, 46], [38, 38], [62, 38], [69, 46], [69, 62]], s);
    F.poly([[44, 38], [56, 38], [50, 50]], blanc); F.poly([[49, 40], [51, 40], [52, 49], [50, 53], [48, 49]], or);
    const revers = F.mat(teinte(a.haut, 1.6), { plat: true }); F.l(44, 38, 49, 52, 1, revers); F.l(56, 38, 51, 52, 1, revers); F.r(60, 46, 4, 2, blanc);
    tete(F, 50, 22, a, { clin: i === 4, bas: f === 1 || f === 2 });
    F.poly([[5, 56], [95, 56], [100, 64], [0, 64]], acajou3); F.r(0, 64, 100, 2, acajou2);
    F.poly([[44, 58], [62, 58], [64, 63], [42, 63]], blanc); const ligne = F.mat('#9fb6dc', { plat: true }); F.r(46, 59, 12, 1, ligne); F.r(45, 61, 15, 1, ligne);
    F.l(34, 46, 37, 56, 6, s); F.e(40, 58, 3, 2.6, peau);
    const px = [0, 2, 4, 2][f]; F.l(66, 46, 62, 55, 6, s); F.e(56 + px, 58, 3, 2.6, peau); F.l(56 + px, 58, 60 + px, 50, 1, F.mat('#ffd065', { plat: true })); F.p(55 + px, 60, F.mat(K, { plat: true }));
    F.r(2, 66, 96, 8, acajou); [[5, 67, 28], [36, 67, 28], [67, 67, 28]].forEach(([x, y, l]) => F.rr(x, y, l, 6, 1, acajou2)); F.rr(41, 68, 18, 4, 1, F.mat('#ffd065')); F.r(44, 70, 12, 1, F.mat('#b5811f', { plat: true })); F.r(3, 74, 6, 2, acajou2); F.r(91, 74, 6, 2, acajou2);
    F.rr(11, 54, 10, 3, 1, laiton); F.r(15, 45, 2, 9, laiton); F.rr(8, 40, 16, 6, 3, vert); F.r(10, 46, 12, 1, F.mat('#fff3c4', { plat: true }));
    F.r(82, 54, 8, 2, laiton); F.r(85, 51, 2, 3, laiton); F.e(86, 45, 6, 6, F.mat('#3b82d6')); const terre = F.mat('#35b58a', { plat: true }); F.r(83, 42, 3, 3, terre); F.r(87, 45, 3, 4, terre); F.r(84, 47, 2, 2, terre);
    return F.fin();
  }
  // l'ouvrier du chantier (34 × 62) : casque, gilet, marteau ; i : 0 ou 1
  function ouvrierDessin(i) {
    const F = feuille(34, 62), a = { peau: '#e2a678', cheveux: '#2a1b14', coiffure: 'court', lunettes: false, sourire: true }, gilet = F.mat('#f27d2e'), jean = F.mat('#3d4f8f'), noir = F.mat('#191d38'), peau = F.mat(a.peau), jaune = F.mat('#ffd065'), bande = F.mat('#fff3a8', { plat: true });
    F.r(10, 42, 6, 16, jean); F.r(18, 42, 6, 16, jean); F.rr(8, 57, 9, 5, 2, noir); F.rr(17, 57, 9, 5, 2, noir);
    F.l(8, 31, 6, 40, 5, gilet); F.e(6, 43, 2.6, 2.6, peau);
    F.poly([[7, 44], [7, 31], [11, 25], [23, 25], [27, 31], [27, 44]], gilet); F.r(8, 36, 18, 2, bande); F.r(11, 26, 2, 18, bande); F.r(21, 26, 2, 18, bande);
    tete(F, 17, 15, a, {});
    F.poly([[5, 11], [7, 4], [13, 1], [21, 1], [27, 4], [29, 11]], jaune); F.r(4, 10, 26, 2, F.mat('#f2b33d')); F.r(16, 1, 2, 9, F.mat('#f2b33d', { plat: true }));
    const manche = F.mat('#8a5a2b'), fer = F.mat('#9aa3b5');
    if (i % 2) { F.l(26, 31, 31, 36, 5, gilet); F.e(31, 38, 2.6, 2.6, peau); F.l(31, 38, 32, 45, 2, manche); F.rr(28, 45, 6, 4, 1, fer); }
    else { F.l(26, 31, 29, 24, 5, gilet); F.e(29, 21, 2.6, 2.6, peau); F.l(29, 21, 30, 12, 2, manche); F.rr(26, 8, 8, 4, 1, fer); }
    return F.fin();
  }
  // le stagiaire (36 × 68) : il traverse l'open space avec un plateau de cafés ; i : 0 à 3 (il marche)
  function stagiaire(a, i) {
    const F = feuille(36, 68), f = i % 4, s = F.mat(a.haut), pant = F.mat('#3d4f8f'), noir = F.mat('#f4f7fd'), peau = F.mat(a.peau), plateau = F.mat('#8c96b3'), tasse = F.mat('#f4f7fd');
    const gx = [0, -2, 0, 2][f], gl = f === 1 ? 2 : 0, dl = f === 3 ? 2 : 0;
    F.r(11 + gx, 46, 6, 18 - gl, pant); F.r(19 - gx, 46, 6, 18 - dl, pant); F.rr(9 + gx, 63 - gl, 9, 5, 2, noir); F.rr(18 - gx, 63 - dl, 9, 5, 2, noir);
    F.poly([[8, 48], [8, 35], [12, 29], [24, 29], [28, 35], [28, 48]], s); F.poly([[14, 29], [18, 33], [22, 29]], F.mat(teinte(a.haut, 0.75))); F.r(15, 40, 6, 5, F.mat(teinte(a.haut, 0.82)));
    tete(F, 18, 17, a, { regard: 1, clin: i === 4 });
    const b = f % 2; F.l(9, 35, 10, 41, 5, s); F.l(27, 35, 28, 41, 5, s); F.r(6, 41 - b, 26, 2, plateau); F.e(10, 42 - b, 2.6, 2.4, peau); F.e(28, 42 - b, 2.6, 2.4, peau);
    [[9, 0], [16, 0], [23, 0]].forEach(([x]) => { F.rr(x, 35 - b, 5, 6, 1, tasse); F.r(x + 1, 35 - b, 3, 1, F.mat('#6b4423', { plat: true })); });
    return F.fin();
  }
  // le chat du bureau (28 × 18) ; i : 0 ou 1 (il marche)
  const CHATS = [];
  function chat(i) {
    i %= 2; if (CHATS[i]) return CHATS[i];
    const F = feuille(28, 18), roux = F.mat('#e08a3c'), clair = F.mat('#f6d7a8'), raie = F.mat('#b8621f', { plat: true }), noir = F.mat(K, { plat: true }), rose = F.mat('#f08c7e', { plat: true });
    F.l(3, 9, 1, 3 + i, 2, roux); F.rr(3, 7, 17, 8, 3, roux); [7, 11, 15].forEach((x) => F.r(x, 7, 2, 4, raie));
    F.r(5 + i, 14, 2, 4 - i, roux); F.r(9 - i, 14, 2, 3 + i, roux); F.r(14 + i, 14, 2, 4 - i, roux); F.r(17 - i, 14, 2, 3 + i, roux);
    F.poly([[17, 4], [19, 0], [21, 4]], roux); F.poly([[22, 4], [24, 0], [26, 4]], roux); F.rr(16, 3, 11, 9, 3, roux); F.rr(19, 8, 6, 4, 2, clair);
    F.r(19, 6, 1, 2, noir); F.r(24, 6, 1, 2, noir); F.p(22, 9, rose);
    return (CHATS[i] = F.fin());
  }
  // une bulle au-dessus d'une tête (17 × 15), avec son petit dessin
  const DESSINS = { idee: ['#f2b33d', [28, 62, 62, 62, 28, 28, 8]], note: ['#4f8df7', [14, 10, 8, 8, 56, 56, 0]], coeur: ['#f26b5e', [54, 127, 127, 62, 28, 8, 0]], etoile: ['#f2b33d', [8, 8, 127, 62, 28, 54, 34]], ok: ['#27a86b', [0, 1, 2, 68, 40, 16, 0]], zzz: ['#6c7bd9', [112, 32, 119, 2, 7, 0, 0]], cafe: ['#8a5a2b', [36, 18, 0, 124, 126, 124, 56]], pourcent: ['#f26b5e', [98, 100, 8, 16, 38, 70, 0]] };
  function bulle(g, x, y, sorte, gauche) {
    const R = (c, a, b, l, h) => { g.fillStyle = c; g.fillRect(a, b, l, h); }, d = DESSINS[sorte]; if (!d) return;
    R(K, x + 1, y, 15, 13); R(K, x, y + 1, 17, 11); R('#ffffff', x + 1, y + 1, 15, 11); R('#dce9ff', x + 1, y + 10, 15, 2); R(K, x + (gauche ? 10 : 3), y + 13, 4, 2); R('#dce9ff', x + (gauche ? 11 : 4), y + 12, 2, 2);
    g.fillStyle = d[0]; for (let b = 0; b < 7; b++) for (let a = 0; a < 7; a++) if (d[1][b] & (64 >> a)) g.fillRect(x + 5 + a, y + 3 + b, 1, 1);
  }
  // ---- les postes du 22 nov. : i : 0 à 3, 4 = clin d'œil
  // le réceptionniste (66 × 72) : derrière son comptoir, il salue
  function receptionniste(a, i) {
    const F = feuille(66, 72), f = i > 3 ? 0 : i, s = F.mat(a.haut), peau = F.mat(a.peau), blanc = F.mat('#f4f7fd'), marbre = F.mat('#eef2fa'), bleu = F.mat('#26336e'), bleu2 = F.mat('#1b2550'), or = F.mat('#ffd065'), noir = F.mat('#262c4d');
    F.poly([[17, 60], [17, 46], [22, 39], [44, 39], [49, 46], [49, 60]], s); F.poly([[28, 39], [33, 47], [38, 39]], blanc); F.poly([[31, 40], [35, 40], [36, 44], [33, 47], [30, 44]], F.mat('#f2b33d'));
    tete(F, 33, 23, a, { casque: true, clin: i === 4, parle: f % 2 === 1, regard: f === 2 ? -1 : 0 });
    F.l(19, 46, 21, 51, 5, s);
    if (f % 2) { F.l(47, 46, 53, 37, 5, s); F.e(54.5, 33 - (f === 3 ? 1 : 0), 2.8, 2.8, peau); } else { F.l(47, 46, 46, 51, 5, s); }
    F.poly([[2, 50], [64, 50], [66, 55], [0, 55]], marbre); F.r(0, 55, 66, 2, F.mat('#c9d3e8')); F.r(1, 57, 64, 13, bleu); F.r(1, 60, 64, 2, or); F.rr(5, 63, 56, 6, 1, bleu2); F.r(3, 70, 5, 2, bleu2); F.r(58, 70, 5, 2, bleu2);
    F.rr(27, 63, 12, 6, 1, or); F.r(30, 65, 6, 2, F.mat('#b5811f', { plat: true }));
    F.rr(5, 38, 15, 11, 1, noir); F.r(7, 40, 11, 7, F.mat(f % 2 ? '#8fdbff' : '#a9e4ff', { plat: true })); F.r(8, 42, 6, 1, F.mat('#ffffff', { plat: true })); F.r(11, 49, 3, 2, noir);
    F.e(56, 48, 3.4, 2.6, or); F.r(55, 44, 2, 2, or); F.r(52, 50, 8, 1, F.mat('#b5811f', { plat: true }));
    return F.fin();
  }
  // le formateur (48 × 68) : debout, une tablette à la main, il montre le tableau de sa baguette
  function formateur(a, i) {
    const F = feuille(48, 68), f = i > 3 ? 0 : i, s = F.mat(a.haut), pant = F.mat('#3a3f55'), noir = F.mat('#191d38'), peau = F.mat(a.peau), blanc = F.mat('#f4f7fd'), bras = F.mat(teinte(a.haut, 0.9));
    F.r(10, 46, 6, 18, pant); F.r(18, 46, 6, 18, pant); F.rr(8, 63, 9, 5, 2, noir); F.rr(17, 63, 9, 5, 2, noir);
    F.l(8, 35, 7, 43, 5, bras); F.rr(1, 40, 9, 11, 1, blanc); F.r(3, 42, 5, 1, F.mat('#4f8df7', { plat: true })); F.r(3, 45, 4, 1, F.mat('#9fb6dc', { plat: true })); F.e(8, 46, 2.6, 2.6, peau);
    F.poly([[7, 48], [7, 35], [11, 29], [23, 29], [27, 35], [27, 48]], s); F.poly([[13, 29], [17, 37], [21, 29]], blanc); F.r(16, 40, 2, 2, F.mat(teinte(a.haut, 0.6), { plat: true })); F.r(16, 44, 2, 2, F.mat(teinte(a.haut, 0.6), { plat: true }));
    tete(F, 17, 17, a, { parle: f % 2 === 1, clin: i === 4, regard: 1 });
    const h = [0, 3, 6, 3][f]; F.l(26, 35, 32, 31, 5, bras); F.e(34, 29, 2.6, 2.6, peau); F.l(34, 29, 45, 12 + h, 1, F.mat('#8a5a2b', { plat: true })); F.r(44, 10 + h, 3, 3, F.mat('#f26b5e', { plat: true }));
    return F.fin();
  }
  // le photographe (40 × 68) : l'œil dans le viseur ; il vise, déclenche (l'éclair), puis regarde sa photo
  function photographe(a, i) {
    const F = feuille(40, 68), f = i > 3 ? 0 : i, s = F.mat(a.haut), pant = F.mat('#2a3256'), noir = F.mat('#191d38'), peau = F.mat(a.peau), bras = F.mat(teinte(a.haut, 0.9)), appareil = F.mat('#262c4d'), baisse = f === 2;
    F.r(13, 46, 6, 18, pant); F.r(21, 46, 6, 18, pant); F.rr(11, 63, 9, 5, 2, noir); F.rr(20, 63, 9, 5, 2, noir);
    F.poly([[10, 48], [10, 35], [14, 29], [26, 29], [30, 35], [30, 48]], s); F.poly([[16, 29], [20, 34], [24, 29]], F.mat('#f4f7fd')); F.r(12, 38, 5, 4, F.mat(teinte(a.haut, 0.75))); F.r(23, 38, 5, 4, F.mat(teinte(a.haut, 0.75)));
    tete(F, 20, 17, a, { clin: i === 4, bas: baisse });
    const y = baisse ? 32 : 13;
    if (baisse) { F.l(11, 35, 12, 40, 5, bras); F.l(29, 35, 28, 40, 5, bras); } else { F.l(11, 35, 9, 25, 5, bras); F.l(29, 35, 31, 25, 5, bras); }
    F.rr(11, y, 18, 11, 2, appareil); F.r(14, y - 2, 6, 2, appareil); F.e(20, y + 5.5, 4.4, 4.4, F.mat('#8c96b3')); F.e(20, y + 5.5, 2.6, 2.6, F.mat('#1b2550')); F.p(19, y + 4, F.mat('#c9f0ff', { plat: true })); F.r(25, y + 1, 3, 2, F.mat(f === 3 ? '#ffffff' : '#f26b5e', { plat: true }));
    F.e(10, y + 7, 2.6, 2.6, peau); F.e(30, y + 7, 2.6, 2.6, peau);
    if (f === 3) { const ecl = F.mat('#fff9d6', { plat: true }); F.r(31, y - 6, 2, 12, ecl); F.r(26, y - 1, 12, 2, ecl); F.r(28, y - 4, 2, 2, ecl); F.r(34, y - 4, 2, 2, ecl); F.r(28, y + 2, 2, 2, ecl); F.r(34, y + 2, 2, 2, ecl); }
    return F.fin();
  }
  // l'associé (42 × 68) : costume clair, gilet d'or, mallette, une coupe à la main
  function associe(a, i) {
    const F = feuille(42, 68), f = i > 3 ? 0 : i, s = F.mat(a.haut), pant = F.mat(teinte(a.haut, 0.86)), cuir = F.mat('#7a4a24'), peau = F.mat(a.peau), blanc = F.mat('#f4f7fd'), or = F.mat('#f2b33d'), bras = F.mat(teinte(a.haut, 0.92));
    F.r(12, 46, 6, 18, pant); F.r(20, 46, 6, 18, pant); F.rr(10, 63, 9, 5, 2, cuir); F.rr(19, 63, 9, 5, 2, cuir);
    F.l(10, 35, 8, 44, 5, bras); F.e(8, 47, 2.6, 2.6, peau); F.rr(2, 49, 12, 9, 1, cuir); F.r(6, 47, 4, 2, cuir); F.r(7, 52, 2, 2, F.mat('#ffd065', { plat: true }));
    F.poly([[9, 48], [9, 35], [13, 29], [25, 29], [29, 35], [29, 48]], s); F.poly([[14, 29], [24, 29], [19, 44]], or); F.poly([[16, 29], [22, 29], [19, 36]], blanc); F.poly([[18, 31], [20, 31], [21, 36], [19, 39], [17, 36]], F.mat('#b6402a'));
    F.r(18, 40, 2, 1, F.mat('#b5811f', { plat: true })); F.r(18, 43, 2, 1, F.mat('#b5811f', { plat: true })); F.r(24, 34, 3, 2, F.mat('#ffd065', { plat: true }));
    tete(F, 19, 17, a, { clin: i === 4, parle: f === 1 });
    const h = f % 2 ? 3 : 0; F.l(28, 35, 33, 39 - h, 5, bras); F.l(33, 39 - h, 34, 30 - h, 4, bras); F.e(34.5, 28 - h, 2.6, 2.6, peau);
    F.r(34, 24 - h, 1, 4, F.mat('#dce9ff', { plat: true })); F.poly([[31, 16 - h], [38, 16 - h], [36, 24 - h], [33, 24 - h]], F.mat('#fff3c4')); F.r(33, 18 - h, 3, 1, F.mat('#ffffff', { plat: true })); F.p(35, 14 - h - (f % 2), F.mat('#ffffff', { plat: true })); F.p(33, 12 - h + (f >> 1), F.mat('#ffffff', { plat: true }));
    return F.fin();
  }
  const FAIRE = { agent, negociateur, directeur, stagiaire, receptionniste, formateur, photographe, associe }, CACHE = new Map(), OUVRIERS = [];
  // l'image d'un employé (gardée : on ne la repeint jamais) ; i : 0 à 3, ou 4 pour le clin d'œil
  function employe(poste, graine, i) {
    const k = poste + '|' + graine + '|' + i; let c = CACHE.get(k);
    if (!c) { if (CACHE.size > 500) CACHE.clear(); c = FAIRE[poste](allure(poste, graine), i); CACHE.set(k, c); } return c;
  }
  const ouvrier = (i) => OUVRIERS[i % 2] || (OUVRIERS[i % 2] = ouvrierDessin(i % 2));
  // le portrait (34 × 34) du prochain embauché, pour sa carte
  function portrait(poste, graine) {
    const a = allure(poste, graine), F = feuille(34, 34), s = F.mat(a.haut);
    const FONDS = { agent: ['#bcd0ee', '#cfe0f5'], negociateur: ['#f0d2a4', '#f8e6c9'], directeur: ['#2f6b5a', '#377a67'], receptionniste: ['#c9d6ee', '#e8eef8'], formateur: ['#cfe3c4', '#e6f0e0'], photographe: ['#3a3f55', '#4a5075'], associe: ['#4a2433', '#5c2f41'] }[poste] || ['#bcd0ee', '#cfe0f5'];
    const fond = F.mat(FONDS[0], { plat: true }), fond2 = F.mat(FONDS[1], { plat: true }), cravate = poste === 'negociateur' || poste === 'directeur' || poste === 'associe' || poste === 'receptionniste';
    F.r(0, 0, 34, 34, fond); for (let x = 0; x < 34; x += 6) F.r(x, 0, 3, 34, fond2);
    F.poly([[2, 36], [2, 31], [8, 26], [26, 26], [32, 31], [32, 36]], s);
    if (cravate) { F.poly([[12, 26], [22, 26], [17, 35]], F.mat('#f4f7fd')); F.poly([[16, 27], [18, 27], [19, 34], [15, 34]], F.mat(poste === 'associe' ? '#b6402a' : '#f2b33d')); } else F.poly([[12, 26], [17, 31], [22, 26]], F.mat(poste === 'agent' ? teinte(a.haut, 1.3) : '#f4f7fd'));
    tete(F, 17, 14, a, { casque: poste === 'agent' || poste === 'receptionniste' });
    if (poste === 'photographe') { F.rr(11, 27, 12, 7, 1, F.mat('#262c4d')); F.e(17, 30.5, 2.6, 2.6, F.mat('#8c96b3')); }
    if (poste === 'formateur') { F.l(27, 33, 32, 20, 1, F.mat('#8a5a2b', { plat: true })); F.r(31, 18, 3, 3, F.mat('#f26b5e', { plat: true })); }
    if (poste === 'negociateur') { F.rr(27, 9, 5, 12, 1, F.mat('#191d38')); F.r(28, 11, 2, 4, F.mat('#8fdbff', { plat: true })); }
    return F.fin();
  }

  // ---------------------------------------------------------------- la police en pixels (5 × 7)
  const LETTRES = { A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    '-': [0, 0, 0, 31, 0, 0, 0], _: [0, 0, 0, 0, 0, 0, 31], '.': [0, 0, 0, 0, 0, 12, 12], '×': [0, 0, 17, 10, 4, 10, 17], "'": [4, 4, 8, 0, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '+': [0, 4, 4, 31, 4, 4, 0], '%': [24, 25, 2, 4, 8, 19, 3], '…': [0, 0, 0, 0, 0, 21, 21] };
  const propre = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ | /g, ' ').replace(/x(?=\d)/g, '×').toUpperCase();
  const largeurTexte = (t) => { t = propre(t); let l = 0; for (const ch of t) l += ch === ' ' ? 3 : LETTRES[ch] ? 6 : 0; return Math.max(0, l - 1); };
  function texte(g, t, x, y, coul) { g.fillStyle = coul; for (const ch of propre(t)) { if (ch === ' ') { x += 3; continue; } const L = LETTRES[ch]; if (!L) continue; for (let b = 0; b < 7; b++) for (let a = 0; a < 5; a++) if (L[b] & (16 >> a)) g.fillRect(x + a, y + b, 1, 1); x += 6; } }
  // une plaque sombre avec son texte, calée à droite (xd) ou centrée (xc)
  function plaque(g, t, y, o) {
    const l = largeurTexte(t), L = l + 8, x = o.xc != null ? Math.round(o.xc - L / 2) : o.xd - L;
    g.fillStyle = o.bord || K; g.fillRect(x, y, L, 13); g.fillStyle = o.fond || '#1f2857'; g.fillRect(x + 1, y + 1, L - 2, 11); g.fillStyle = o.haut || '#2c3878'; g.fillRect(x + 1, y + 1, L - 2, 1);
    texte(g, t, x + 4, y + 3, o.coul || '#dce9ff'); return { x, l: L };
  }

  // ---------------------------------------------------------------- les décors (346 × 96 : le mur jusqu'à 80, le sol, la dalle)
  function outils(g) { const R = (c, x, y, l, h) => { g.fillStyle = c; g.fillRect(x, y, l, h); };
    return { R,
      cadre(x, y, l, h, c, bord) { R(bord || K, x - 1, y - 1, l + 2, h + 2); R(c, x, y, l, h); },
      fenetre(x, y, l, h, gr, stores) { const r = hasard('f' + gr);
        R(K, x - 3, y - 3, l + 6, h + 6); R('#eef2fa', x - 2, y - 2, l + 4, h + 4); R('#c9d3e8', x - 2, y + h + 1, l + 4, 1); R(K, x - 1, y - 1, l + 2, h + 2);
        ['#0a1038', '#0e1648', '#131e5c', '#1a2874'].forEach((c, i) => R(c, x, y + Math.floor(h * i / 4), l, Math.ceil(h / 4)));
        for (let i = 0; i < l / 3; i++) R(r() < 0.3 ? '#fff' : '#9fb6dc', x + Math.floor(r() * l), y + Math.floor(r() * h * 0.55), 1, 1);
        R('#fff3c4', x + l - 13, y + 4, 6, 6); R('#fff3c4', x + l - 14, y + 5, 8, 4); R('#fff3c4', x + l - 12, y + 3, 4, 8); R('#e6d59a', x + l - 11, y + 6, 2, 2);
        for (let px = x; px < x + l;) { const w = 5 + Math.floor(r() * 8), ht = Math.floor(h * (0.2 + r() * 0.3)); R('#22327f', px, y + h - ht, Math.min(w, x + l - px), ht); px += w; }
        for (let px = x; px < x + l;) { const w = 4 + Math.floor(r() * 9), ht = Math.floor(h * (0.1 + r() * 0.28)); const ww = Math.min(w, x + l - px); R('#2d44a3', px, y + h - ht, ww, ht); R('#3a55c2', px, y + h - ht, ww, 1); for (let k = 0; k < 3; k++) if (r() < 0.55 && ww > 2 && ht > 3) R('#ffd979', px + 1 + Math.floor(r() * (ww - 2)), y + h - ht + 2 + Math.floor(r() * (ht - 3)), 1, 2); px += w; }
        for (let k = 1; k < Math.round(l / 22); k++) R('#eef2fa', x + Math.round(l * k / Math.round(l / 22)) - 1, y, 2, h);
        if (stores) for (let yy = y; yy < y + Math.floor(h * 0.3); yy += 3) { R('#dfe6f5', x, yy, l, 2); R('#b9c5de', x, yy + 2, l, 1); }
        R('#ffffff', x - 2, y - 2, l + 4, 1); R('#dce3f2', x - 4, y + h + 3, l + 8, 2); R('#aab6d2', x - 4, y + h + 5, l + 8, 1); },
      plante(x, y, grand) { const h = grand ? 30 : 20; R(K, x - 1, y - 11, 14, 12); R('#e07a4f', x, y - 10, 12, 10); R('#f29a6f', x, y - 10, 12, 2); R('#b85a35', x, y - 2, 12, 2); R(K, x - 2, y - 13, 16, 3); R('#e07a4f', x - 1, y - 12, 14, 1);
        [[6, -h, 5, 9], [0, -h + 5, 6, 10], [9, -h + 4, 6, 10], [-3, -h + 12, 6, 8], [11, -h + 13, 6, 7], [4, -h + 9, 5, 9]].forEach(([a, b, l, k], i) => { R(K, x + a - 1, y + b - 1, l + 2, k + 2); R(i % 2 ? '#2fa36b' : '#27905d', x + a, y + b, l, k); R('#5fd69a', x + a, y + b, l - 1, 2); R('#1d7449', x + a + l - 1, y + b + 2, 1, k - 2); });
        R('#1d7449', x + 5, y - h + 14, 2, h - 26 > 0 ? h - 26 : 2); },
      lampe(x, allume, coul) { R(K, x, 0, 1, 7); R(K, x - 7, 7, 15, 6); R(coul || '#46508a', x - 6, 7, 13, 4); R('#6672b5', x - 6, 7, 13, 1); if (allume) { R('#fff3c4', x - 4, 11, 9, 2); g.fillStyle = 'rgba(255,243,196,.07)'; for (let i = 0; i < 66; i++) g.fillRect(x - 5 - Math.floor(i / 3), 13 + i, 11 + 2 * Math.floor(i / 3), 1); } else R('#5d6790', x - 4, 11, 9, 2); },
      sol(c1, c2, c3, pas) { R(c3, 0, 80, 346, 1); R(c1, 0, 81, 346, 11); R(c2, 0, 81, 346, 2); for (let x = 0; x < 346; x += pas) { R(c3, x, 83, 1, 9); R(c3, x + (pas >> 1), 86 + ((x / pas) % 2) * 3, pas >> 1, 1); } R('#10163a', 0, 92, 346, 4); R('#3a4a8c', 0, 92, 346, 1); R('#232d66', 0, 93, 346, 1); } };
  }
  const DECORS = new Map();
  function decor(poste, allume) {
    const cle = poste + (allume ? '1' : '0'); if (DECORS.has(cle)) return DECORS.get(cle);
    const c = toile(346, 96), g = c.getContext('2d'), O = outils(g), R = O.R;
    if (poste === 'agent') {
      R('#d4e3f7', 0, 0, 346, 80); R('#b5c9e8', 0, 0, 346, 4); R('#c4d5ef', 0, 4, 346, 2); for (let x = 12; x < 346; x += 36) R('#c9daf2', x, 6, 1, 56); R('#a9bddf', 0, 62, 346, 1); R('#c0d2ee', 0, 63, 346, 14); R('#8fa5cc', 0, 77, 346, 3); R('#a9bddf', 0, 77, 346, 1);
      O.fenetre(14, 14, 62, 34, 11, true); O.fenetre(268, 14, 62, 34, 12, true);
      O.cadre(96, 12, 64, 38, '#fbfcff', '#59658c'); R('#59658c', 96, 12, 64, 2); [[101, 40], [107, 36], [113, 38], [119, 31], [125, 33], [131, 26], [137, 28], [143, 21], [149, 23]].forEach(([x, y]) => { R('#35b58a', x, y, 6, 2); R('#35b58a', x + 5, y - 1, 1, 2); }); R('#f26b5e', 101, 18, 18, 2); R('#c6d8f2', 101, 22, 12, 1); R('#c6d8f2', 101, 25, 15, 1); R('#8c96b3', 110, 51, 36, 2);
      R(K, 181, 12, 18, 20); R(K, 179, 14, 22, 16); R('#fbfcff', 181, 14, 18, 16); R('#fbfcff', 183, 13, 14, 18); R(K, 189, 16, 2, 7); R(K, 189, 21, 6, 2); R('#f26b5e', 189, 21, 2, 2); [[189, 14], [197, 21], [189, 28], [182, 21]].forEach(([x, y]) => R('#8c96b3', x, y, 2, 2));
      O.cadre(212, 14, 40, 30, '#fbfcff', '#59658c'); [['#4f8df7', 10], ['#f2b33d', 16], ['#f26b5e', 8], ['#35b58a', 20], ['#9b6be8', 13]].forEach(([coul, h], i) => { R(coul, 217 + i * 7, 40 - h, 5, h); R('rgba(255,255,255,.35)', 217 + i * 7, 40 - h, 1, h); }); R('#59658c', 215, 40, 34, 1);
      R(K, 167, 50, 48, 4); R('#8a5a2b', 168, 51, 46, 2); [['#f26b5e', 12], ['#4f8df7', 15], ['#f2b33d', 10], ['#9b6be8', 14], ['#35b58a', 12], ['#f26b5e', 9], ['#4f8df7', 13]].forEach(([coul, h], i) => { R(K, 169 + i * 6, 50 - h - 1, 6, h + 1); R(coul, 170 + i * 6, 50 - h, 4, h); R('#fff', 171 + i * 6, 50 - h + 2, 2, 1); });
      [50, 130, 216, 296].forEach((x) => O.lampe(x, allume));
      O.sol('#7f93c4', '#93a6d3', '#6d81b3', 22);
    } else if (poste === 'negociateur') {
      R('#f9e8cd', 0, 0, 346, 80); R('#e9cf9f', 0, 0, 346, 4); R('#f2dcb6', 0, 4, 346, 2); R('#e3c08a', 0, 50, 346, 2); R('#f1d6a8', 0, 52, 346, 25); for (let x = 8; x < 346; x += 26) { R('#e6c592', x, 55, 18, 19); R('#f5deb6', x + 1, 56, 16, 17); } R('#b98f58', 0, 77, 346, 3); R('#d4ab73', 0, 77, 346, 1);
      O.fenetre(12, 12, 52, 32, 21); O.fenetre(282, 12, 52, 32, 22);
      R(K, 104, 9, 92, 42); R('#2a3256', 105, 10, 90, 40); R('#0e1640', 108, 13, 84, 32); [[112, 38], [120, 36], [128, 37], [136, 31], [144, 33], [152, 27], [160, 28], [168, 21], [176, 19]].forEach(([x, y]) => { R('#35e0a0', x, y, 8, 2); R('#35e0a0', x + 7, y - 2, 1, 3); R('rgba(53,224,160,.18)', x, y + 2, 8, 44 - y); }); R('#ffd979', 112, 16, 22, 2); R('#5a6cb5', 112, 20, 14, 1); R('#f26b5e', 184, 17, 4, 4); R('#59658c', 140, 51, 20, 2); R('#59658c', 146, 50, 8, 1);
      [[74, 16, '#ffd065'], [74, 34, '#c0c7d6']].forEach(([x, y, coul]) => { R(K, x - 1, y - 1, 16, 14); R('#7a4326', x, y, 14, 12); R('#fff7e0', x + 2, y + 2, 10, 8); R(coul, x + 5, y + 3, 4, 4); R(coul, x + 6, y + 7, 2, 2); });
      R(K, 207, 16, 26, 20); R('#fbfcff', 208, 17, 24, 18); R('#f26b5e', 211, 20, 12, 2); R('#c6d8f2', 211, 24, 18, 1); R('#c6d8f2', 211, 27, 15, 1); R('#c6d8f2', 211, 30, 17, 1); R('#f2b33d', 218, 15, 4, 4);
      R(K, 23, 50, 62, 30); R('#d95b4e', 24, 51, 60, 16); R('#ee7a6c', 24, 51, 60, 3); R(K, 19, 60, 70, 20); R('#ee7a6c', 20, 61, 68, 14); R('#f79486', 20, 61, 68, 2); R('#c9574a', 20, 73, 68, 3); R('#d95b4e', 54, 61, 1, 12); R('#c9574a', 20, 61, 6, 14); R('#c9574a', 82, 61, 6, 14); R(K, 34, 55, 16, 10); R('#ffd065', 35, 56, 14, 8); R('#ffe9a6', 35, 56, 14, 2); R(K, 23, 78, 4, 3); R(K, 81, 78, 4, 3);
      R(K, 243, 46, 34, 34); R('#8a5a2b', 244, 47, 32, 4); R('#a9713b', 244, 47, 32, 1); R('#6f4520', 244, 51, 32, 29); R('#8a5a2b', 246, 54, 13, 24); R('#8a5a2b', 261, 54, 13, 24); R('#ffd065', 257, 64, 2, 3); R('#ffd065', 261, 64, 2, 3);
      R(K, 247, 27, 14, 20); R('#3a4466', 248, 28, 12, 18); R('#5d6790', 248, 28, 12, 2); R('#f26b5e', 250, 32, 3, 3); R('#35e0a0', 255, 32, 3, 3); R('#141a33', 251, 39, 6, 6); R(K, 264, 38, 9, 9); R('#fbfcff', 265, 39, 7, 8); R('#6b4423', 266, 39, 5, 2);
      O.plante(318, 80, true); [86, 240].forEach((x) => O.lampe(x, allume, '#8a5a2b'));
      O.sol('#c79a62', '#d9b07a', '#a87d48', 28);
    } else {
      R('#2f6b5a', 0, 0, 346, 50); R('#234f43', 0, 0, 346, 4); R('#295c4e', 0, 4, 346, 2); for (let x = 9; x < 346; x += 18) { R('#377a67', x, 8, 1, 40); R('#2a6152', x + 9, 8, 1, 40); } R('#ffd065', 0, 50, 346, 2); R('#b5811f', 0, 52, 346, 1);
      R('#6e3520', 0, 53, 346, 24); for (let x = 4; x < 346; x += 38) { R('#572715', x, 56, 32, 18); R('#7f4028', x + 1, 57, 30, 16); R('#93492b', x + 1, 57, 30, 1); } R('#4a2010', 0, 77, 346, 3); R('#7f4028', 0, 77, 346, 1);
      O.fenetre(128, 8, 90, 36, 31);
      R(K, 3, 5, 36, 75); R('#5a2e1c', 4, 6, 34, 73); R('#6f3a23', 4, 6, 34, 2); [0, 1, 2, 3].forEach((k) => { const y = 8 + k * 18; R('#3d1e12', 6, y, 30, 15); R('#2c150c', 6, y + 15, 30, 2); const r = hasard('livres' + k); for (let x = 7; x < 34;) { const l = 3 + Math.floor(r() * 3), h = 9 + Math.floor(r() * 5), coul = ['#f26b5e', '#4f8df7', '#f2b33d', '#35b58a', '#9b6be8', '#e9dfc8'][Math.floor(r() * 6)]; R(coul, x, y + 15 - h, l, h); R('rgba(255,255,255,.3)', x, y + 15 - h, 1, h); R('rgba(0,0,0,.25)', x, y + 15 - h + 2, l, 1); x += l + 1; } });
      R(K, 53, 9, 38, 30); R('#ffd065', 54, 10, 36, 28); R('#b5811f', 56, 12, 32, 24); R('#16235c', 57, 13, 30, 22); R('#f2905e', 57, 22, 30, 5); R('#f2b33d', 57, 19, 30, 3); R('#35b58a', 57, 27, 30, 8); R('#27905d', 62, 24, 10, 4); R('#27905d', 74, 25, 9, 3); R('#fff3c4', 69, 15, 5, 5);
      R(K, 255, 9, 38, 30); R('#ffd065', 256, 10, 36, 28); R('#b5811f', 258, 12, 32, 24); R('#e9dfc8', 259, 13, 30, 22); R('#2a3256', 269, 16, 10, 9); R('#e2a678', 271, 18, 6, 6); R('#2a3256', 266, 26, 16, 9); R('#f4f7fd', 273, 26, 2, 5);
      [100, 246].forEach((x) => { R('#ffd065', x, 0, 1, 6); R(K, x - 9, 6, 19, 5); R('#ffd065', x - 8, 6, 17, 3); R('#ffe9a6', x - 8, 6, 17, 1); [-6, 0, 6].forEach((d) => { R(K, x + d - 2, 10, 5, 6); R(allume ? '#fff3c4' : '#8a7b4a', x + d - 1, 11, 3, 4); }); if (allume) { g.fillStyle = 'rgba(255,243,196,.06)'; for (let i = 0; i < 64; i++) g.fillRect(x - 8 - Math.floor(i / 3), 16 + i, 17 + 2 * Math.floor(i / 3), 1); } });
      O.plante(322, 80, true);
      R('#7d1f33', 0, 80, 346, 1); R('#9c2c43', 0, 81, 346, 11); R('#b53a54', 0, 81, 346, 2); for (let x = 6; x < 346; x += 16) { R('#ffd065', x, 86, 4, 1); R('#ffd065', x + 1, 85, 2, 3); R('#7d1f33', x + 8, 88, 3, 1); } R('#ffd065', 0, 83, 346, 1); R('#ffd065', 0, 90, 346, 1); R('#10163a', 0, 92, 346, 4); R('#3a4a8c', 0, 92, 346, 1);
    }
    if (poste === 'receptionniste') {
      g.clearRect(0, 0, 346, 96); R('#e8eef8', 0, 0, 346, 80); R('#c9d6ee', 0, 0, 346, 4); R('#d7e1f3', 0, 4, 346, 2); for (let x = 0; x < 346; x += 28) R('#dde6f5', x, 6, 1, 54); R('#26336e', 0, 60, 346, 17); R('#ffd065', 0, 60, 346, 2); R('#1b2550', 0, 77, 346, 3);
      // la porte vitrée sur la rue, l'emblème, le canapé d'attente, l'ascenseur
      R(K, 8, 10, 58, 70); R('#8c96b3', 9, 11, 56, 69); R('#0e1648', 12, 14, 24, 66); R('#0e1648', 38, 14, 24, 66); R('#1a2874', 12, 50, 24, 30); R('#1a2874', 38, 50, 24, 30); [[16, 22], [28, 30], [44, 18], [54, 34]].forEach(([x, y]) => R('#fff', x, y, 1, 1)); R('#2d44a3', 12, 62, 24, 18); R('#2d44a3', 38, 66, 24, 14); R('#ffd979', 18, 68, 2, 3); R('#ffd979', 48, 70, 2, 3); R('rgba(255,255,255,.18)', 14, 14, 3, 66); R('rgba(255,255,255,.18)', 40, 14, 3, 66); R('#ffd065', 33, 44, 2, 8); R('#ffd065', 39, 44, 2, 8);
      R(K, 153, 12, 40, 34); R('#ffd065', 154, 13, 38, 32); R('#26336e', 157, 16, 32, 26); R('#ffd065', 163, 28, 20, 12); for (let k = 0; k < 10; k++) R('#ffd065', 172 - k, 19 + k, 2 + 2 * k, 1); R('#26336e', 170, 32, 6, 8); R('#26336e', 166, 30, 3, 3); R('#26336e', 177, 30, 3, 3);
      R(K, 207, 50, 66, 30); R('#3b5bbd', 208, 51, 64, 16); R('#5273d6', 208, 51, 64, 3); R(K, 203, 60, 74, 20); R('#5273d6', 204, 61, 72, 14); R('#6f8de6', 204, 61, 72, 2); R('#3b5bbd', 204, 73, 72, 3); R('#3b5bbd', 240, 61, 1, 12); R('#3b5bbd', 204, 61, 6, 14); R('#3b5bbd', 270, 61, 6, 14); R(K, 207, 78, 4, 3); R(K, 269, 78, 4, 3);
      R(K, 289, 16, 50, 64); R('#59658c', 290, 17, 48, 63); R('#aab3cc', 293, 24, 20, 56); R('#aab3cc', 315, 24, 20, 56); R('#c9d3e8', 293, 24, 3, 56); R('#c9d3e8', 315, 24, 3, 56); R('#8c96b3', 311, 24, 2, 56); R('#8c96b3', 333, 24, 2, 56); R(K, 313, 24, 2, 56); R(K, 300, 9, 28, 8); R('#0e1640', 301, 10, 26, 6);
      O.plante(98, 80, true); O.plante(128, 80, false); [86, 240].forEach((x) => O.lampe(x, allume));
      R('#aab6d2', 0, 80, 346, 1); for (let x = 0; x < 346; x += 16) { R((x / 16) % 2 ? '#f4f7fd' : '#c9d3e8', x, 81, 16, 6); R((x / 16) % 2 ? '#c9d3e8' : '#f4f7fd', x, 87, 16, 5); } R('#10163a', 0, 92, 346, 4); R('#3a4a8c', 0, 92, 346, 1);
    } else if (poste === 'formateur') {
      g.clearRect(0, 0, 346, 96); R('#e6f0e0', 0, 0, 346, 80); R('#c4d9b8', 0, 0, 346, 4); R('#d5e5cb', 0, 4, 346, 2); R('#b9cfab', 0, 58, 346, 1); R('#d3e3c8', 0, 59, 346, 18); R('#93ad84', 0, 77, 346, 3);
      // le grand tableau : un plan, des flèches, un pourcentage ; le projecteur ; les coupes ; la bibliothèque
      R(K, 107, 7, 132, 52); R('#8c96b3', 108, 8, 130, 50); R('#fbfcff', 110, 10, 126, 46); R('#f26b5e', 116, 15, 30, 2); R('#c6d8f2', 116, 20, 22, 1); R('#c6d8f2', 116, 23, 26, 1);
      R('#4f8df7', 118, 38, 22, 12); for (let k = 0; k < 9; k++) R('#4f8df7', 128 - k, 29 + k, 2 + 2 * k, 1); R('#fbfcff', 126, 43, 6, 7); R('#35b58a', 150, 42, 14, 2); R('#35b58a', 162, 39, 2, 8); R('#35b58a', 164, 41, 2, 4); R('#f2b33d', 172, 34, 20, 16); R('#fbfcff', 175, 37, 6, 5); R('#fbfcff', 183, 37, 6, 5); R('#fbfcff', 175, 44, 6, 6); R('#35b58a', 198, 42, 12, 2); R('#35b58a', 208, 39, 2, 8); R('#35b58a', 210, 41, 2, 4);
      R('#9b6be8', 218, 30, 4, 4); R('#9b6be8', 226, 44, 4, 4); for (let k = 0; k < 14; k++) R('#9b6be8', 229 - k, 31 + k, 2, 1); R('#f26b5e', 190, 14, 40, 2); R('#f26b5e', 190, 14, 2, 10); R('#f26b5e', 200, 18, 2, 6); R('#f26b5e', 210, 16, 2, 8); R('#f26b5e', 220, 20, 2, 4); R('#8c96b3', 150, 59, 46, 2);
      R(K, 160, 0, 26, 6); R('#59658c', 161, 0, 24, 5); R('#c9f0ff', 170, 5, 6, 2);
      R(K, 10, 12, 44, 68); R('#8a5a2b', 11, 13, 42, 67); [0, 1, 2].forEach((k) => { const y = 16 + k * 21; R('#6f4520', 13, y, 38, 17); R('#573617', 13, y + 17, 38, 2); const r = hasard('manuels' + k); for (let x = 14; x < 48;) { const l = 3 + Math.floor(r() * 4), h = 10 + Math.floor(r() * 6); R(['#f26b5e', '#4f8df7', '#f2b33d', '#35b58a', '#9b6be8', '#e9dfc8'][Math.floor(r() * 6)], x, y + 17 - h, l, h); R('rgba(255,255,255,.3)', x, y + 17 - h, 1, h); x += l + 1; } });
      R(K, 262, 34, 70, 4); R('#8a5a2b', 263, 35, 68, 2); [[268, '#ffd065'], [288, '#c0c7d6'], [308, '#d98e52']].forEach(([x, coul]) => { R(K, x - 1, 19, 14, 15); R(coul, x, 20, 12, 8); R(coul, x + 4, 28, 4, 3); R(coul, x + 2, 31, 8, 3); R('rgba(255,255,255,.45)', x + 1, 21, 2, 6); R(K, x - 3, 21, 2, 5); R(K, x + 13, 21, 2, 5); });
      R(K, 270, 44, 28, 20); R('#fff7e0', 271, 45, 26, 18); R('#f26b5e', 274, 48, 12, 2); R('#c6d8f2', 274, 52, 20, 1); R('#c6d8f2', 274, 55, 16, 1); R('#ffd065', 288, 56, 6, 6);
      O.plante(318, 80, true); [80, 262].forEach((x) => O.lampe(x, allume, '#7a8c3a'));
      O.sol('#5f9a6a', '#74b07f', '#4d8558', 24);
    } else if (poste === 'photographe') {
      g.clearRect(0, 0, 346, 96); R('#3a3f55', 0, 0, 346, 80); R('#2c3044', 0, 0, 346, 4); R('#33384d', 0, 4, 346, 2); for (let x = 14; x < 346; x += 30) R('#40465e', x, 6, 1, 70); R('#262a3b', 0, 77, 346, 3);
      // le fond de studio qui descend jusqu'au sol, les deux boîtes à lumière, les photos au mur, le poste de retouche
      R(K, 121, 4, 106, 6); R('#8c96b3', 122, 5, 104, 4); R('#c9d3e8', 122, 5, 104, 1); R('#dff3fb', 126, 9, 96, 71); R('#c9ecf7', 126, 9, 6, 71); R('#eefaff', 150, 9, 30, 71); R('#bfe3f0', 216, 9, 6, 71); R('#cfeaf5', 126, 70, 96, 10);
      [[92, 0], [254, 1]].forEach(([x, k]) => { R(K, x + 9, 44, 2, 36); R(K, x + 2, 78, 16, 2); R(K, x + 5, 74, 2, 6); R(K, x + 13, 74, 2, 6); R(K, x - 2, 14, 24, 32); R('#262c4d', x - 1, 15, 22, 30); R(allume ? '#fff9d6' : '#8a8f9e', x + 1, 17, 18, 26); R(allume ? '#ffffff' : '#9aa0b0', x + 3, 19, 14, 10); R('#262c4d', x + 9, 17, 1, 26); R('#262c4d', x + 1, 29, 18, 1); if (allume) { g.fillStyle = 'rgba(255,249,214,.08)'; for (let i = 0; i < 34; i++) g.fillRect(k ? x - 40 - i : x + 20, 30 + i, 40 + i, 1); } });
      [[10, 12, '#2d44a3', '#ffd979'], [44, 18, '#7d1f33', '#f2b33d'], [10, 44, '#2f6b5a', '#fff3c4']].forEach(([x, y, c1, c2]) => { R(K, x - 1, y - 1, 28, 24); R('#f4f7fd', x, y, 26, 22); R('#0e1648', x + 2, y + 2, 22, 18); R(c1, x + 4, y + 9, 6, 11); R(c1, x + 11, y + 5, 7, 15); R(c1, x + 19, y + 11, 4, 9); R(c2, x + 13, y + 8, 2, 2); R(c2, x + 5, y + 12, 2, 2); R(c2, x + 13, y + 13, 2, 2); });
      R(K, 285, 52, 54, 28); R('#59658c', 286, 53, 52, 4); R('#7b87ad', 286, 53, 52, 1); R('#3d4770', 286, 57, 52, 23); R(K, 296, 24, 34, 24); R('#262c4d', 297, 25, 32, 22); R('#0e1648', 299, 27, 28, 16); R('#2d44a3', 301, 33, 8, 10); R('#2d44a3', 311, 30, 8, 13); R('#ffd979', 314, 33, 2, 2); R('#f26b5e', 322, 29, 3, 3); R(K, 310, 48, 6, 4); R('#8c96b3', 304, 51, 18, 2);
      R('#4a4f66', 0, 80, 346, 1); R('#6b7088', 0, 81, 346, 11); R('#7b8099', 0, 81, 346, 2); for (let x = 10; x < 346; x += 34) R('#5c6178', x, 85 + (x % 3), 12, 1); R('#10163a', 0, 92, 346, 4); R('#3a4a8c', 0, 92, 346, 1);
    } else if (poste === 'associe') {
      g.clearRect(0, 0, 346, 96); R('#4a2433', 0, 0, 346, 54); R('#371a26', 0, 0, 346, 4); R('#40202d', 0, 4, 346, 2); for (let x = 6; x < 346; x += 14) for (let y = 10; y < 52; y += 12) { R('#5c2f41', x + ((y / 12) % 2 ? 7 : 0), y, 2, 2); R('#6b3a4d', x + ((y / 12) % 2 ? 7 : 0), y - 1, 2, 1); } R('#ffd065', 0, 54, 346, 2); R('#b5811f', 0, 56, 346, 1); R('#2c1810', 0, 57, 346, 20); for (let x = 4; x < 346; x += 30) { R('#3d2317', x, 60, 24, 14); R('#4a2c1d', x + 1, 61, 22, 1); } R('#1c0f0a', 0, 77, 346, 3);
      O.fenetre(116, 8, 114, 40, 41);
      // la cheminée (le feu est peint par la scène), le bar et ses bouteilles, le lustre
      R(K, 11, 28, 62, 52); R('#c9c0b0', 12, 29, 60, 51); R('#e3dccf', 12, 29, 60, 3); R('#a89e8c', 12, 32, 60, 2); for (let y = 36; y < 80; y += 8) for (let x = 13 + ((y / 8) % 2 ? 6 : 0); x < 70; x += 12) R('#b5ab99', x, y, 1, 7); R(K, 22, 44, 40, 36); R('#1c0f0a', 23, 45, 38, 35); R(K, 8, 24, 68, 5); R('#e3dccf', 9, 25, 66, 3); R(K, 30, 14, 6, 10); R('#ffd065', 31, 15, 4, 9); R(K, 48, 12, 8, 12); R('#35b58a', 49, 13, 6, 11); R('#f26b5e', 50, 9, 4, 4);
      R(K, 263, 8, 78, 40); R('#2c1810', 264, 9, 76, 38); [0, 1].forEach((k) => { const y = 11 + k * 18; R('#4a2c1d', 266, y + 14, 72, 2); const r = hasard('bar' + k); for (let x = 268; x < 334; x += 7) { const h = 8 + Math.floor(r() * 5), coul = ['#35b58a', '#f2b33d', '#b6402a', '#8fdbff', '#9b6be8', '#e9dfc8'][Math.floor(r() * 6)]; R(coul, x, y + 14 - h, 4, h); R(coul, x + 1, y + 12 - h, 2, 2); R('rgba(255,255,255,.4)', x, y + 14 - h, 1, h); } });
      R(K, 259, 54, 84, 26); R('#7a3a22', 260, 55, 82, 4); R('#93492b', 260, 55, 82, 1); R('#5e2a18', 260, 59, 82, 21); for (let x = 264; x < 338; x += 20) R('#7a3a22', x, 62, 14, 15); R('#ffd065', 260, 60, 82, 1);
      [173].forEach((x) => { R('#ffd065', x, 0, 1, 5); R(K, x - 16, 5, 33, 5); R('#ffd065', x - 15, 5, 31, 3); R('#ffe9a6', x - 15, 5, 31, 1); [-13, -6, 0, 6, 12].forEach((d) => { R(K, x + d - 1, 9, 4, 7); R(allume ? '#fff3c4' : '#8a7b4a', x + d, 10, 2, 5); }); });
      R('#3a2014', 0, 80, 346, 1); R('#6b3d26', 0, 81, 346, 11); R('#7d4a30', 0, 81, 346, 2); for (let x = 0; x < 346; x += 20) { R('#57301d', x, 83, 1, 9); R('#57301d', x + 10, 87, 10, 1); } R('#10163a', 0, 92, 346, 4); R('#3a4a8c', 0, 92, 346, 1);
    }
    if (!allume) { g.fillStyle = 'rgba(6,9,30,.7)'; g.fillRect(0, 0, 346, 92); }
    DECORS.set(cle, c); return c;
  }

  // ---------------------------------------------------------------- le toit, le chantier, la ville
  // la grue (72 × 64) ; i : le balancement du crochet
  const GRUES = [];
  function grue(i) {
    i %= 4; if (GRUES[i]) return GRUES[i];
    const c = toile(72, 64), g = c.getContext('2d'), R = (coul, x, y, l, h) => { g.fillStyle = coul; g.fillRect(x, y, l, h); }, J = '#f2b33d', J2 = '#b5811f', J3 = '#ffd979';
    R(K, 11, 8, 12, 56); R(J, 12, 9, 2, 55); R(J, 20, 9, 2, 55); R('#0d1436', 14, 9, 6, 55); for (let y = 12; y < 64; y += 8) { R(J2, 14, y, 6, 1); for (let k = 0; k < 6; k++) R(J, 14 + k, y + 1 + k, 1, 1); for (let k = 0; k < 6; k++) R(J2, 19 - k, y + 1 + k, 1, 1); } R(J3, 12, 9, 1, 55);
    R(K, 0, 7, 72, 6); R(J, 1, 8, 70, 1); R(J, 1, 11, 70, 1); R('#0d1436', 1, 9, 70, 2); for (let x = 2; x < 70; x += 4) { R(J2, x, 9, 1, 2); R(J, x + 1, 9, 1, 1); R(J, x + 2, 10, 1, 1); }
    R(K, 15, 0, 4, 8); R(J, 16, 1, 2, 7); for (let k = 0; k < 14; k++) { R(J2, 18 + k * 3, 2 + Math.floor(k / 2.4), 3, 1); } for (let k = 0; k < 5; k++) R(J2, 13 - k * 3, 3 + k, 3, 1);
    R(K, 0, 12, 12, 9); R('#8c96b3', 1, 13, 10, 7); R('#aab3cc', 1, 13, 10, 2); R(K, 10, 13, 13, 13); R('#ffd979', 11, 14, 11, 11); R('#8fdbff', 12, 15, 9, 5); R('#c9f0ff', 12, 15, 9, 1); R(J2, 11, 22, 11, 3);
    const dx = [0, 1, 0, -1][i]; R(K, 51, 12, 6, 4); R('#8c96b3', 52, 13, 4, 2); R('#dce3f2', 54, 15, 1, 16); R('#dce3f2', 54 + dx, 31, 1, 6); R(K, 51 + dx, 36, 7, 4); R('#8c96b3', 52 + dx, 37, 5, 2);
    R(K, 46 + dx, 40, 17, 10); R('#f2a93b', 47 + dx, 41, 15, 8); R('#ffe08a', 47 + dx, 41, 15, 2); R('#b5811f', 47 + dx, 47, 15, 2); R('#d98e22', 50 + dx, 44, 4, 2); R('#d98e22', 56 + dx, 44, 4, 2);
    return (GRUES[i] = c);
  }
  // une brique d'or du mur (15 × 8)
  function brique(g, x, y) { const R = (c, a, b, l, h) => { g.fillStyle = c; g.fillRect(a, b, l, h); }; R('#8a5e10', x, y, 15, 8); R('#f2a93b', x + 1, y + 1, 13, 6); R('#ffe08a', x + 1, y + 1, 13, 2); R('#fff3c4', x + 2, y + 1, 4, 1); R('#c98a1e', x + 1, y + 5, 13, 2); R('#d98e22', x + 4, y + 3, 3, 1); R('#d98e22', x + 9, y + 3, 3, 1); }
  // la grande brique du bouton (30 × 18)
  function grandeBrique() {
    const c = toile(30, 18), g = c.getContext('2d'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); };
    R(K, 1, 0, 28, 18); R(K, 0, 1, 30, 16); R('#f2a93b', 1, 1, 28, 16); R('#ffe08a', 1, 1, 28, 4); R('#fff3c4', 3, 2, 9, 1); R('#fff3c4', 3, 3, 3, 1); R('#c98a1e', 1, 12, 28, 3); R('#a36c12', 1, 15, 28, 2); R('#d98e22', 5, 7, 8, 3); R('#d98e22', 17, 7, 8, 3); R('#ffe08a', 5, 7, 8, 1); R('#ffe08a', 17, 7, 8, 1); return c;
  }
  // la ville derrière l'immeuble (240 × 120)
  let VILLE = null;
  function ville() {
    if (VILLE) return VILLE; const c = toile(240, 120), g = c.getContext('2d'), r = hasard('ville'), R = (coul, a, b, l, k) => { g.fillStyle = coul; g.fillRect(a, b, l, k); };
    for (let i = 0; i < 46; i++) R(r() < 0.25 ? '#fff' : '#8fa5e0', Math.floor(r() * 240), Math.floor(r() * 70), 1, 1);
    R('#fff3c4', 198, 10, 10, 14); R('#fff3c4', 196, 12, 14, 10); R('#fff3c4', 195, 14, 16, 6); R('#e6d59a', 200, 15, 3, 3); R('#e6d59a', 205, 19, 2, 2);
    for (let x = 0; x < 240;) { const l = 9 + Math.floor(r() * 14), h = 24 + Math.floor(r() * 50); R('#141d55', x, 120 - h, l, h); x += l; }
    for (let x = 0; x < 240;) { const l = 8 + Math.floor(r() * 16), h = 14 + Math.floor(r() * 64); R('#1c2a6b', x, 120 - h, l, h); R('#27388a', x, 120 - h, l, 1); R('#27388a', x, 120 - h, 1, h); if (r() < 0.35) { R('#1c2a6b', x + 2, 120 - h - 5, 1, 5); R('#f26b5e', x + 2, 120 - h - 6, 1, 1); }
      for (let yy = 120 - h + 3; yy < 118; yy += 4) for (let xx = x + 2; xx < x + l - 2; xx += 3) if (r() < 0.28) R(r() < 0.8 ? '#ffd979' : '#8fdbff', xx, yy, 1, 2); x += l; }
    return (VILLE = c);
  }
  // recopier un dessin dans un canevas de la page (les portraits, la brique du bouton, la ville)
  function poser(cible, source) { if (!cible || !source) return; cible.width = source.width; cible.height = source.height; cible.getContext('2d').drawImage(source, 0, 0); }
  window.AgencePixel = { employe, portrait, decor, grue, ouvrier, brique, grandeBrique, poser, ville, texte, largeurTexte, plaque, chat, bulle, K };
})();
