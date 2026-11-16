// Le booster « nuit et néon » (16 nov. 2026, interview de Gautier, docs/CARTES-NEON.md ; prototype validé : proto/booster.html) :
// un sachet holographique, le nom du jeu en enseigne de néon, un plan de ville en filigrane ; le booster du jour porte une
// ligne de toits (bleu), le booster payé une tour Eiffel d'or. Ce fichier donne au jeu (initGL, index.html) :
//   Booster.habiller(THREE, sorte, coupe, bas)  les deux matières du sachet (recto, verso) et la couleur de son éclair ;
//   Booster.enrouler(geos, p, sens, leve, L, YC) la languette qui se décolle derrière le doigt, le long d'une courbe.
// Les dessins sont faits une fois dans des canevas (aucun fichier d'image). L'holographique est calculé par point, d'après
// l'angle de vue : il glisse quand on penche le téléphone. Brillance « moyenne », choisie par Gautier.
(function (racine) {
  'use strict';
  const dire = (t) => (racine.Langue && racine.Langue.t ? racine.Langue.t(t) : t);
  const SORTES = { jour: { clair: '#DFF6FF', vif: '#38C8FF', fond: ['#0A1040', '#060A26'], eclair: '#7FE3FF' }, paye: { clair: '#FFF3D0', vif: '#FFB52E', fond: ['#1A1030', '#0A0616'], eclair: '#FFD27A' } };
  let sorte = 'jour', COUPE = 0.115, BAS = 0.09;   // (posés par dessiner : la part du haut où l'on coupe, celle de la soudure du bas)

  // ---------------------------------------------------------------- les dessins (canevas) posés sur le sachet
  const TW = 1024, TH = 1587;   // (le sachet : 2 de large pour 3,1 de haut)
  function toile() { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; }
  function planDeVille(g, couleur) {
    let s = 11; const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.save(); g.strokeStyle = couleur; g.lineWidth = 2.2;
    for (let y = -80; y < TH + 120; y += 150) for (let x = -120; x < TW + 120; x += 172) { const w = 118 + alea() * 34, h = 96 + alea() * 28, n = 1 + Math.floor(alea() * 3);
      g.save(); g.translate(x + (Math.round(y / 150) % 2) * 60, y); g.rotate(-0.21); g.strokeRect(0, 0, w, h); for (let k = 1; k <= n; k++) { g.beginPath(); g.moveTo(w * k / (n + 1), 0); g.lineTo(w * k / (n + 1), h); g.stroke(); } if (alea() > 0.5) { g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w * (1 / (n + 1)), h / 2); g.stroke(); } g.restore(); }
    g.restore();
  }
  // un tube de néon : un halo large, un tube coloré, un cœur blanc
  function neon(g, tracer, C, ep) {
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.shadowColor = C.vif; g.shadowBlur = ep * 5; g.strokeStyle = C.vif; g.lineWidth = ep * 1.9; g.globalAlpha = 0.55; tracer(); g.globalAlpha = 1;
    g.shadowBlur = ep * 2.2; g.lineWidth = ep; tracer();
    g.shadowBlur = 0; g.strokeStyle = C.clair; g.lineWidth = ep * 0.42; tracer(); g.restore();
  }
  // la ligne de toits du booster du jour : une ville française au trait de néon (mansardes, pignons, clocher, mairie), les
  // mêmes bâtiments que sur le dos des cartes ; le gratuit montre la ville de tous les jours, le payé un monument
  function ligneDeToits(g, C, sol) {
    const BATIS = [[10, 14, 'pignon'], [12, 22, 'mansarde'], [9, 17, 'plat'], [8, 28, 'fleche'], [13, 20, 'mansarde'], [11, 26, 'plat'], [16, 19, 'mairie'], [10, 31, 'mansarde'], [12, 18, 'mansarde'], [9, 24, 'plat'], [11, 15, 'pignon'], [12, 21, 'mansarde'], [9, 28, 'plat'], [10, 16, 'pignon']];
    let s = 23; const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), fen = [];
    neon(g, () => { g.beginPath(); let x = (TW - 152 * 5) / 2;
      for (const [w, h, type] of BATIS) { const W = w * 5, t = sol - h * 8.6, cx = x + W / 2;
        g.moveTo(x, sol); g.lineTo(x, t); g.lineTo(x + W, t); g.lineTo(x + W, sol);
        if (type === 'plat') { g.moveTo(x + 9, t); g.lineTo(x + 9, t - 11); g.lineTo(x + 24, t - 11); g.lineTo(x + 24, t); }
        if (type === 'mansarde') { g.moveTo(x, t); g.lineTo(x + 8, t - 21); g.lineTo(x + W - 8, t - 21); g.lineTo(x + W, t); g.moveTo(x + W - 23, t - 21); g.lineTo(x + W - 23, t - 36); g.lineTo(x + W - 12, t - 36); g.lineTo(x + W - 12, t - 21); }
        if (type === 'pignon') { g.moveTo(x - 3, t); g.lineTo(cx, t - 27); g.lineTo(x + W + 3, t); }
        if (type === 'fleche') { g.moveTo(x + 4, t); g.lineTo(cx, t - 62); g.lineTo(x + W - 4, t); g.moveTo(cx, t - 62); g.lineTo(cx, t - 82); g.moveTo(cx - 7, t - 73); g.lineTo(cx + 7, t - 73); g.moveTo(cx + 8.5, t + 28); g.arc(cx, t + 28, 8.5, 0, 6.283); g.moveTo(cx - 7, sol); g.lineTo(cx - 7, sol - 26); g.arc(cx, sol - 26, 7, Math.PI, 0); g.lineTo(cx + 7, sol); }
        if (type === 'mairie') { g.moveTo(x - 3, t); g.lineTo(x + W + 3, t); g.moveTo(x + 15, t); g.lineTo(cx, t - 22); g.lineTo(x + W - 15, t); g.moveTo(cx - 9, t - 14); g.lineTo(cx - 9, t - 46); g.lineTo(cx + 9, t - 46); g.lineTo(cx + 9, t - 14); g.moveTo(cx - 12, t - 46); g.lineTo(cx, t - 60); g.lineTo(cx + 12, t - 46);
          g.moveTo(cx, t - 60); g.lineTo(cx, t - 86); g.lineTo(cx + 18, t - 86); g.lineTo(cx + 18, t - 74); g.lineTo(cx, t - 74); g.moveTo(cx + 4.5, t - 31); g.arc(cx, t - 31, 4.5, 0, 6.283); g.moveTo(cx - 8, sol); g.lineTo(cx - 8, sol - 24); g.arc(cx, sol - 24, 8, Math.PI, 0); g.lineTo(cx + 8, sol); }
        if (type !== 'fleche') { const cols = Math.floor((W - 12) / 14.5), rangs = Math.floor((h * 8.6 - 16) / 21), marge = (W - cols * 14.5 + 6.5) / 2;
          for (let r = 0; r < rangs; r++) for (let c = 0; c < cols; c++) if (alea() < 0.6 && !(type === 'mairie' && r === rangs - 1 && Math.abs(x + marge + c * 14.5 + 4 - cx) < 14)) fen.push([x + marge + c * 14.5, t + 13 + r * 21]); }
        x += W; }
      g.moveTo(112, sol); g.lineTo(TW - 112, sol); g.stroke(); }, C, 4.6);
    g.save(); g.fillStyle = C.clair; g.shadowColor = C.vif; g.shadowBlur = 9; for (const [x, y] of fen) g.fillRect(x, y, 8, 11.5); g.restore();
  }
  function enseigne(g, C, y, sansTrait) {
    g.save(); g.font = '700 182px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let esp = 0; try { g.letterSpacing = '10px'; esp = 5; } catch (e) { /* vieux navigateur */ }
    // des lettres pleines, très claires, avec un halo de la couleur du néon : lisibles d'abord (Gautier, 16 nov. : « la
    // couleur et l'effet de texte le rendent illisible »)
    g.lineJoin = 'round'; g.strokeStyle = '#03051A'; g.lineWidth = 22; g.strokeText('STREETKEEP', TW / 2 + esp, y);   // (un liseré de nuit : le contraste d'abord)
    g.shadowColor = C.vif; g.shadowBlur = 26; g.strokeStyle = C.vif; g.lineWidth = 6; g.strokeText('STREETKEEP', TW / 2 + esp, y);
    g.shadowBlur = 12; g.fillStyle = '#FFFFFF'; g.fillText('STREETKEEP', TW / 2 + esp, y);
    g.restore();
    neon(g, () => { g.beginPath(); g.moveTo(150, y + 52); g.lineTo(TW / 2 - 46, y + 52); g.moveTo(TW / 2 + 46, y + 52); g.lineTo(TW - 150, y + 52); g.moveTo(TW / 2, y + 30); g.lineTo(TW / 2 + 22, y + 52); g.lineTo(TW / 2, y + 74); g.lineTo(TW / 2 - 22, y + 52); g.closePath(); g.stroke(); }, C, 5);
    if (!sansTrait) neon(g, () => { g.beginPath(); g.moveTo(150, y - 172); g.lineTo(TW - 150, y - 172); g.stroke(); }, C, 5);
  }
  // la tour Eiffel au trait, pour le booster payé (le monument « qui dit qu'il y a du rare dedans »)
  const TOUR = { bas: 1040, haut: 300 };   // (sous la soudure du haut du sachet du jeu)
  const demiTour = (t) => 285 * Math.pow(1 - t, 2.35) + 10 * (1 - t) + 4;
  function silhouetteTour(g, marge) { const cx = TW / 2, H = TOUR.bas - TOUR.haut; g.beginPath(); g.moveTo(cx - demiTour(0) - marge, TOUR.bas + marge);
    for (let t = 0; t <= 1.0001; t += 0.04) g.lineTo(cx - demiTour(t) - marge, TOUR.bas - t * H); g.lineTo(cx, TOUR.haut - 90 - marge); for (let t = 1; t >= -0.0001; t -= 0.04) g.lineTo(cx + demiTour(t) + marge, TOUR.bas - t * H); g.lineTo(cx + demiTour(0) + marge, TOUR.bas + marge); g.closePath(); }
  function tour(g, C) {
    const cx = TW / 2, bas = TOUR.bas, haut = TOUR.haut, H = bas - haut, Y = (t) => bas - t * H;
    const demi = demiTour;          // (demi-largeur extérieure à la hauteur t)
    const dedans = (t) => Math.max(0, demi(t) - (46 * (1 - t) + 10));              // (bord intérieur des piliers)
    neon(g, () => {
      g.beginPath();
      for (const s of [-1, 1]) { for (let t = 0; t <= 1.0001; t += 0.02) { const x = cx + s * demi(t); t ? g.lineTo(x, Y(t)) : g.moveTo(x, Y(t)); }
        for (let t = 0; t <= 0.3301; t += 0.02) { const x = cx + s * dedans(t); t ? g.lineTo(x, Y(t)) : g.moveTo(x, Y(t)); } }
      // la grande arche du pied, les trois plates-formes, le campanile et l'antenne
      g.moveTo(cx - dedans(0), Y(0)); g.quadraticCurveTo(cx, Y(0.2), cx + dedans(0), Y(0));
      for (const [t, d] of [[0.17, 14], [0.33, 10], [0.74, 6]]) { g.moveTo(cx - demi(t) - d, Y(t)); g.lineTo(cx + demi(t) + d, Y(t)); g.moveTo(cx - demi(t) - d, Y(t) - 14); g.lineTo(cx + demi(t) + d, Y(t) - 14); }
      g.moveTo(cx - 10, Y(0.955)); g.lineTo(cx + 10, Y(0.955)); g.moveTo(cx, Y(1)); g.lineTo(cx, Y(1.07));
      g.stroke();
    }, C, 9);
    neon(g, () => {   // le treillis, en traits fins
      g.beginPath();
      for (let k = 0; k < 13; k++) { const t0 = 0.34 + k * 0.047, t1 = t0 + 0.047; if (t1 > 0.95) break; g.moveTo(cx - demi(t0), Y(t0)); g.lineTo(cx + demi(t1), Y(t1)); g.moveTo(cx + demi(t0), Y(t0)); g.lineTo(cx - demi(t1), Y(t1)); }
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const t0 = k * 0.055, t1 = t0 + 0.055; g.moveTo(cx + s * demi(t0), Y(t0)); g.lineTo(cx + s * dedans(t1), Y(t1)); g.moveTo(cx + s * dedans(t0), Y(t0)); g.lineTo(cx + s * demi(t1), Y(t1)); }
      g.stroke();
    }, C, 4.2);
    // des étoiles autour du sommet
    g.save(); g.fillStyle = C.clair; g.shadowColor = C.vif; g.shadowBlur = 16; let s = 5; const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 34; k++) { const x = 90 + alea() * (TW - 180), y = 262 + alea() * 560, r = 2 + alea() * 4; if (Math.abs(x - cx) < demi(1 - (y - haut) / H) + 40) continue; g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.5, y - r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x + r * 0.5, y + r * 0.5); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.5, y + r * 0.5); g.lineTo(x - r * 2, y); g.lineTo(x - r * 0.5, y - r * 0.5); g.closePath(); g.fill(); }
    g.restore();
  }
  function soudures(g) {   // les bandes gaufrées du haut et du bas, et le trait de coupe
    for (const [y0, y1] of [[0, TH * COUPE], [TH * (1 - BAS), TH]]) { g.save(); g.fillStyle = 'rgba(8,12,40,.55)'; g.fillRect(0, y0, TW, y1 - y0);
      for (let x = 0; x < TW; x += 14) { g.fillStyle = x / 14 % 2 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.3)'; g.fillRect(x, y0, 7, y1 - y0); } g.restore(); }
    g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.setLineDash([16, 12]); g.beginPath(); g.moveTo(0, TH * COUPE); g.lineTo(TW, TH * COUPE); g.stroke(); g.restore();
  }
  // le cartouche sombre derrière le nom (haut, bas, en points du dessin) : l'holographique s'y tait
  const CARTOUCHE = { jour: [628, 1064], paye: [1072, 1436] };
  function dessiner(sorteVoulue, recto, coupe, bas) {
    sorte = SORTES[sorteVoulue] ? sorteVoulue : 'jour'; COUPE = coupe || 0.115; BAS = bas || COUPE * 0.8;
    const C = SORTES[sorte], base = toile(), lum = toile(), g = base.getContext('2d'), l = lum.getContext('2d');
    // le foil : un fond de nuit, l'arc-en-ciel de l'holographique en travers, de fines rayures
    const f = g.createLinearGradient(0, 0, 0, TH); f.addColorStop(0, C.fond[0]); f.addColorStop(1, C.fond[1]); g.fillStyle = f; g.fillRect(0, 0, TW, TH);
    const arc = g.createLinearGradient(0, 0, TW, TH); ['#ff2d8a', '#ffd400', '#22ffb0', '#22b8ff', '#a02dff', '#ff2d8a', '#ffd400', '#22ffb0', '#22b8ff'].forEach((c, i, a) => arc.addColorStop(i / (a.length - 1), c));
    g.globalAlpha = 0.16; g.fillStyle = arc; g.fillRect(0, 0, TW, TH); g.globalAlpha = 1;
    g.save(); g.globalAlpha = 0.1; g.strokeStyle = '#fff'; g.lineWidth = 2; for (let x = -TH; x < TW; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + TH * 0.55, TH); g.stroke(); } g.restore();
    const v = g.createRadialGradient(TW / 2, TH * 0.5, 60, TW / 2, TH * 0.5, TH * 0.62); v.addColorStop(0, 'rgba(4,6,24,.62)'); v.addColorStop(1, 'rgba(4,6,24,.1)'); g.fillStyle = v; g.fillRect(0, 0, TW, TH);
    planDeVille(g, sorte === 'paye' ? 'rgba(255,214,140,.34)' : 'rgba(150,200,255,.36)');
    // des ombres douces (pas de boîte) : la nuit se fait derrière le nom et le monument, pour que les néons se lisent, et
    // l'holographique s'y calme sans s'arrêter net (Gautier, 16 nov. : le cartouche « dénote avec le reste du décor »)
    const masque = toile(), k = masque.getContext('2d'); k.fillStyle = '#fff'; k.fillRect(0, 0, TW, TH);
    if (recto) { const [y0, y1] = CARTOUCHE[sorte];
      for (const [c, couleur, flou] of [[g, 'rgba(3,5,22,.74)', 130], [k, '#000', 130]]) { c.save(); c.fillStyle = couleur; c.shadowColor = couleur; c.shadowBlur = flou;
        c.beginPath(); c.ellipse(TW / 2, (y0 + y1) / 2, TW * 0.44, (y1 - y0) * 0.44, 0, 0, 6.283); c.fill();
        if (sorte === 'paye') { silhouetteTour(c, 26); c.fill(); c.fill(); } else { c.beginPath(); c.ellipse(TW / 2, 520, TW * 0.42, 190, 0, 0, 6.283); c.fill(); }
        c.restore(); } }
    l.fillStyle = '#000'; l.fillRect(0, 0, TW, TH);
    if (recto) { if (sorte === 'paye') tour(l, C); else ligneDeToits(l, C, 684); enseigne(l, C, sorte === 'paye' ? 1282 : 862, sorte !== 'paye');
      l.save(); l.font = '800 50px Nunito, sans-serif'; l.textAlign = 'center'; l.fillStyle = '#FFFFFF'; l.shadowColor = C.vif; l.shadowBlur = 10; try { l.letterSpacing = '14px'; } catch (e) { /* rien */ }
      l.fillText(dire(sorte === 'paye' ? 'BOOSTER OR' : 'BOOSTER DU JOUR'), TW / 2 + 7, sorte === 'paye' ? 1408 : 1018); l.restore(); }
    else { l.save(); l.font = '700 96px "Barlow Condensed", sans-serif'; l.textAlign = 'center'; neon(l, () => l.strokeText('STREETKEEP', TW / 2, TH / 2), C, 5); l.restore(); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(lum, 0, 0); g.restore();
    soudures(g);
    return [base, lum, masque];
  }

  // ---------------------------------------------------------------- les matières
  const FORCE = { value: 1 };   // (la force de l'holographique : 1 = « moyenne »)
  function matiere(THREE, base, lum, masque) { const t = new THREE.CanvasTexture(base), e = new THREE.CanvasTexture(lum), k = new THREE.CanvasTexture(masque); t.encoding = THREE.sRGBEncoding; e.encoding = THREE.sRGBEncoding; t.anisotropy = e.anisotropy = 4;
    const m = new THREE.MeshPhysicalMaterial({ map: t, emissiveMap: e, emissive: 0xffffff, emissiveIntensity: 1.35, metalness: 0.4, roughness: 0.5, envMapIntensity: 0.35, clearcoat: 0.1, clearcoatRoughness: 0.4 });
    // l'holographique : un arc-en-ciel qui dépend de l'angle sous lequel on regarde chaque point du sachet (donc de
    // l'inclinaison du téléphone et du bombé), en larges bandes qui glissent ; plus calme derrière le nom et le monument
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec3 holoN = normalize( vNormal ); vec3 holoV = normalize( vViewPosition );
      float holoT = dot( holoN, holoV ) * 2.6 + vUv.x * 1.25 + vUv.y * 0.85;
      vec3 holoC = 0.5 + 0.5 * cos( 6.2831 * ( holoT + vec3( 0.0, 0.33, 0.67 ) ) );
      float holoB = pow( 0.5 + 0.5 * sin( 6.2831 * holoT * 0.85 ), 3.0 );
      float holoS = mix( 0.1, 1.0, texture2D( uMasque, vUv ).r );
      totalEmissiveRadiance += holoC * ( 0.04 + 0.11 * holoB ) * holoS * uForce;`).replace('void main() {', 'uniform sampler2D uMasque;\nuniform float uForce;\nvoid main() {'); sh.uniforms.uMasque = { value: k }; sh.uniforms.uForce = FORCE; };
    m.userData.textures = [t, e, k]; return m; }
  // les deux matières d'un sachet ; coupe : la part de la hauteur au-dessus de la ligne d'ouverture ; bas : celle de la soudure du bas
  function habiller(THREE, sorteVoulue, coupe, bas) { const [b1, l1, m1] = dessiner(sorteVoulue, true, coupe, bas), [b2, l2, m2] = dessiner(sorteVoulue, false, coupe, bas);
    return { recto: matiere(THREE, b1, l1, m1), verso: matiere(THREE, b2, l2, m2), eclair: SORTES[sorte].eclair, vif: SORTES[sorte].vif }; }
  function liberer(m) { if (!m) return; for (const t of (m.userData.textures || [])) t.dispose(); m.dispose(); }

  // ---------------------------------------------------------------- la languette qui s'enroule
  // geos : les formes de la languette, chacune avec userData.repos (ses points au repos) ; p : où en est le doigt (0 à 1) ;
  // sens : 1 de gauche à droite, -1 de droite à gauche ; leve : plus le doigt monte, plus elle se relève ; L : la largeur
  // du sachet, YC : la hauteur de la ligne d'ouverture. Tout ce qui est derrière le doigt quitte le sachet en suivant un arc
  // de cercle (rayon R), puis tout droit ; chaque tranche tourne avec la courbe, sans se déformer. Devant le doigt, rien ne bouge.
  function enrouler(geos, p, sens, leve, L, YC) {
    const R = 0.275 * L, MAX = 0.4 + 0.42 * leve, front = sens > 0 ? -L / 2 + p * L : L / 2 - p * L;
    for (const geo of geos) { const a = geo.attributes.position, r = geo.userData.repos;
      for (let i = 0; i < a.count; i++) { const x = r[i * 3], y = r[i * 3 + 1], z = r[i * 3 + 2], d = (x - front) * -sens;
        if (d <= 0 || p <= 0) { a.setXYZ(i, x, y, z); continue; }
        const ang = Math.min(d / R, MAX), reste = Math.max(0, d - R * MAX), h = y - YC, si = Math.sin(ang), co = Math.cos(ang);
        a.setXYZ(i, front - sens * (R * si + reste * co) + sens * h * si, YC + R * (1 - co) + reste * si + h * co, z + 0.22 * (1 - co) + reste * 0.12); }
      a.needsUpdate = true; geo.computeVertexNormals(); }
  }
  racine.Booster = { habiller, liberer, enrouler, dessiner, SORTES, FORCE };
})(typeof window !== 'undefined' ? window : globalThis);
