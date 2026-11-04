// La carte d'un lieu (refonte du 4 nov. 2026, d'après l'interview de Gautier) : un badge aux coins coupés, bleu nuit et
// or comme la pochette ; le plan cadastral du lieu en lignes d'or (la parcelle, les bâtiments voisins, les rues) et,
// au-dessus, le vrai bâtiment en maquette de verre éclairée qui tourne lentement ; le nom sur la plaque émaillée (la
// signature du jeu) ; la valeur, le loyer, le potentiel et le standing. La lumière prend la couleur de la rareté (blanc et
// or pour une Commune) ; plus la carte est rare, plus il y a d'effets : particules qui montent, lueur qui frémit, cadre qui
// pulse. Pas de science-fiction (Gautier : « ce n'est pas au jeu de s'adapter au pack ») : une lumière élégante, dans les
// couleurs du jeu.
// Les données viennent de l'IGN (WFS de la Géoplateforme) : la parcelle (cadastre), les bâtiments et leur hauteur, les
// rues (BD TOPO), dans un rayon de 90 à 140 m ; elles sont gardées en mémoire, une fois par lieu.
(function (racine) {
  // [clair, vif] : la lumière de chaque rareté
  const COULEURS = { 1: [0xFFF1C9, 0xE9C77B], 2: [0xC8F7DA, 0x2FB36D], 3: [0xCFE6FF, 0x3D8BFF], 4: [0xEBD6FF, 0xA35BFF], 5: [0xFFE6B8, 0xFF8A1E], 6: [0xFFDDF4, 0xFF4DC4] };
  const cache = new Map();
  async function wfs(typ, lon, lat, d) {
    const kx = 111320 * Math.cos(lat * Math.PI / 180);
    const bb = [lat - d / 110574, lon - d / kx, lat + d / 110574, lon + d / kx].map((v) => v.toFixed(6)).join(',') + ',urn:ogc:def:crs:EPSG::4326';
    const url = 'https://data.geopf.fr/wfs/ows?' + new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: typ, OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', BBOX: bb, COUNT: '400' });
    for (let k = 0; k < 3; k++) { try { const r = await fetch(url); if (r.ok) return (await r.json()).features || []; } catch (e) { /* on réessaie */ } await new Promise((r) => setTimeout(r, 400 * (k + 1))); }
    return [];
  }
  // [lon, lat] ou [lat, lon] selon les services : en France, la longitude est la plus petite des deux
  const norm = (c) => (Math.abs(c[0]) > Math.abs(c[1]) ? [c[1], c[0]] : [c[0], c[1]]);
  const anneaux = (g) => { if (!g) return []; const P = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []); return P.map((p) => p[0].map(norm)); };
  function dedans(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }

  // le plan d'un lieu, en mètres autour de lui (x vers l'est, y vers le nord) : sa parcelle, les bâtiments (ceux de la
  // parcelle sont la « cible »), les rues et leur largeur
  function donnees(lieu) {
    const cle = lieu.id || (lieu.lon + ',' + lieu.lat);
    if (cache.has(cle)) return cache.get(cle);
    const pr = (async () => {
      const { lon, lat } = lieu;
      const [parc, bat, rou] = await Promise.all([wfs('CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle', lon, lat, 30), wfs('BDTOPO_V3:batiment', lon, lat, 95), wfs('BDTOPO_V3:troncon_de_route', lon, lat, 140)]);
      const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574, loc = ([lo, la]) => [(lo - lon) * kx, (la - lat) * ky];
      let parcelle = null, dmin = 1e9;
      for (const f of parc) for (const r of anneaux(f.geometry)) { const R = r.map(loc); if (dedans([0, 0], R)) { parcelle = R; dmin = 0; } else if (dmin > 0) { const d = Math.min(...R.map((p) => Math.hypot(p[0], p[1]))); if (d < dmin) { dmin = d; parcelle = R; } } }
      const batiments = [];
      for (const f of bat) { const p = f.properties || {}; const h = p.hauteur || (p.nombre_d_etages ? p.nombre_d_etages * 3 : 6);
        for (const r of anneaux(f.geometry)) { const R = r.map(loc); const cx = R.reduce((s, q) => s + q[0], 0) / R.length, cy = R.reduce((s, q) => s + q[1], 0) / R.length;
          batiments.push({ r: R, h: Math.max(3, h), cible: !!(parcelle && dedans([cx, cy], parcelle)) || dedans([0, 0], R) }); } }
      // aucun bâtiment sur la parcelle : le plus proche du lieu
      if (!batiments.some((b) => b.cible) && batiments.length) { let best = null, bd = 1e9; for (const b of batiments) { const d = Math.min(...b.r.map((q) => Math.hypot(q[0], q[1]))); if (d < bd) { bd = d; best = b; } } if (best && bd < 35) best.cible = true; }
      const routes = [];
      for (const f of rou) { const g = f.geometry, p = f.properties || {}; if (!g) continue; const L = g.type === 'LineString' ? [g.coordinates] : (g.type === 'MultiLineString' ? g.coordinates : []);
        const larg = Math.min(16, Math.max(3, p.largeur_de_chaussee || (p.importance && p.importance <= '3' ? 9 : 5))); for (const l of L) routes.push({ p: l.map(norm).map(loc), larg }); }
      return { parcelle, batiments, routes };
    })();
    cache.set(cle, pr); return pr;
  }

  // ---------------------------------------------------------------- la petite scène 3D d'une carte
  // Un seul moteur de dessin pour toutes les cartes visibles (un téléphone n'accepte qu'une dizaine de contextes WebGL) :
  // chaque carte a sa scène ; on les dessine l'une après l'autre dans un canevas commun, puis on recopie l'image dans le
  // canevas de la carte. La boucle s'arrête quand plus aucune carte n'est à l'écran.
  const SCENES = new Set(); let moteur = null, boucle = 0;
  function lancer() { if (!boucle) boucle = requestAnimationFrame(dessinerTout); }
  let cadence = 0;
  function dessinerTout(t) {
    boucle = 0; const vues = [...SCENES].filter((s) => s.cv.isConnected && visible(s.cv)); if (!vues.length) return; cadence++;
    // la carte au premier plan (en main, agrandie) à chaque image ; les autres une image sur six, à tour de rôle
    // la carte au premier plan à chaque image (dans le canevas du moteur, posé sur elle) ; les autres une fois par seconde
    const focus = vues.find((s) => s.focus) || (vues.length === 1 ? vues[0] : null);
    vues.forEach((s, i) => { if (s === focus || (cadence % 60) === (i * 7) % 60 || !s.vu) s.dessiner(t / 1000, s === focus); });
    boucle = requestAnimationFrame(dessinerTout);
  }
  function visible(el) { const b = el.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; }
  function moteurPartage(THREE) { if (!moteur) { const cv = document.createElement('canvas'); cv.className = 'cl-moteur'; moteur = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); moteur.setClearColor(0x000000, 0); } return moteur; }

  function scene(cv, d, r) {
    const THREE = racine.THREE; const [clair, vif] = COULEURS[r] || COULEURS[1];
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const RAYON = 85;
    // le plan d'or (rues, bâtiments voisins, parcelle), peint une fois dans une image posée au sol : des traits épais et
    // nets (remarque de Gautier : « traits trop fins »), qui s'effacent doucement vers les bords
    { const T = 1024, c2 = document.createElement('canvas'); c2.width = c2.height = T; const g = c2.getContext('2d'), m = T / (2 * RAYON), q = ([x, y]) => [T / 2 + x * m, T / 2 - y * m];
      g.lineJoin = g.lineCap = 'round';
      const chemin = (pts, ferme) => { g.beginPath(); pts.forEach((pt, i) => { const [a, b] = q(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (ferme) g.closePath(); };
      g.strokeStyle = 'rgba(233,199,123,.30)'; for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = rt.larg * m; g.stroke(); }
      g.strokeStyle = 'rgba(233,199,123,.55)'; for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = 1.5; g.stroke(); }
      for (const b of d.batiments) { if (b.cible) continue; chemin(b.r, true); g.fillStyle = 'rgba(233,199,123,.10)'; g.fill(); g.strokeStyle = 'rgba(240,210,140,.95)'; g.lineWidth = 4; g.stroke(); }
      if (d.parcelle) { chemin(d.parcelle, true); g.fillStyle = 'rgba(233,199,123,.26)'; g.fill(); g.setLineDash([14, 8]); g.strokeStyle = '#FFF1C9'; g.lineWidth = 5; g.stroke(); g.setLineDash([]); }
      for (const b of d.batiments) { if (!b.cible) continue; chemin(b.r, true); g.fillStyle = 'rgba(255,248,230,.35)'; g.fill(); }
      // le fondu vers les bords
      g.globalCompositeOperation = 'destination-in'; const fondu = g.createRadialGradient(T / 2, T / 2, T * 0.18, T / 2, T / 2, T / 2); fondu.addColorStop(0, '#000'); fondu.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fondu; g.fillRect(0, 0, T, T);
      const tex = new THREE.CanvasTexture(c2); tex.anisotropy = 4;
      const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * RAYON, 2 * RAYON).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      sol.position.y = 0.05; sc.add(sol); }
    // le bâtiment : une maquette d'architecte en porcelaine blanche, éclairée par le soleil (en haut à gauche), arêtes d'or ;
    // la couleur de la rareté n'est que dans la lumière autour (Gautier, 4 nov. : l'« hologramme » faisait encore science-fiction)
    const verre = new THREE.MeshStandardMaterial({ color: 0xF6F0E4, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.97 });
    sc.add(new THREE.HemisphereLight(0xFFF6E6, 0x2A3A6A, 0.9));
    const soleil = new THREE.DirectionalLight(0xFFF1DA, 1.5); soleil.position.set(-60, 120, 40); sc.add(soleil);
    const reflet = new THREE.PointLight(vif, 1.2, 0, 0); reflet.position.set(70, 30, -60); sc.add(reflet);
    const aretes = new THREE.LineBasicMaterial({ color: 0xE2B860, transparent: true, opacity: 0.9 });
    const maquette = new THREE.Group(); let hmax = 6, bx = [1e9, -1e9, 1e9, -1e9];
    for (const b of d.batiments) { if (!b.cible) continue; hmax = Math.max(hmax, b.h);
      const f = new THREE.Shape(b.r.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(f, { depth: b.h, bevelEnabled: false }).rotateX(-Math.PI / 2);
      maquette.add(new THREE.Mesh(g, verre)); maquette.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), aretes));
      for (const [x, y] of b.r) { bx[0] = Math.min(bx[0], x); bx[1] = Math.max(bx[1], x); bx[2] = Math.min(bx[2], y); bx[3] = Math.max(bx[3], y); } }
    if (bx[0] > bx[1]) bx = [-8, 8, -8, 8];
    maquette.position.y = 0.6; sc.add(maquette);
    const cx = (bx[0] + bx[1]) / 2, cz = -(bx[2] + bx[3]) / 2, taille = Math.max(18, bx[1] - bx[0], bx[3] - bx[2], hmax * 1.2);
    // une lueur douce sous la maquette
    { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); const v = new THREE.Color(vif);
      rg.addColorStop(0, `rgba(${v.r * 255 | 0},${v.g * 255 | 0},${v.b * 255 | 0},.55)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(taille * 1.9, taille * 1.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(cx, 0.12, cz); sc.add(m); }
    // des particules de lumière qui montent (Épique et au-delà)
    let grains = null;
    if (r >= 4) { const N = r >= 6 ? 40 : (r >= 5 ? 30 : 18), pos = new Float32Array(N * 3), dep = [];
      for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, rr = taille * (0.3 + Math.random() * 0.6); dep.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, Math.random()]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      grains = { pts: new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFFE7B0, size: Math.max(0.45, taille / 70), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })), dep, N };
      sc.add(grains.pts); }
    const s = {
      cv, focus: false, vu: false, rose: cv.parentElement && cv.parentElement.querySelector('.cl-rose'), dessiner(t, direct) {
        const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; const ren = moteurPartage(THREE); const k = Math.min(direct ? 1.75 : 1.25, devicePixelRatio || 1); s.vu = true;
        if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
        if (ren.domElement.width !== cv.width || ren.domElement.height !== cv.height) ren.setSize(cv.width, cv.height, false);
        cam.aspect = W / H; cam.updateProjectionMatrix();
        const a = t * 0.22, dist = taille * 2.7 + hmax * 0.8, el = 0.62; if (s.rose) s.rose.style.transform = `rotate(${(a * 180 / Math.PI + 90).toFixed(1)}deg)`; cam.position.set(cx + Math.cos(a) * dist * Math.cos(el), hmax * 0.45 + dist * Math.sin(el), cz + Math.sin(a) * dist * Math.cos(el)); cam.lookAt(cx, hmax * 0.4, cz);
        // la maquette monte du plan quand la carte se dessine
        if (s.depart != null) { if (s.depart < 0) s.depart = t; const m = Math.min(1, (t - s.depart) / 1.3), e = 1 - Math.pow(1 - m, 3); maquette.scale.y = Math.max(0.001, e); maquette.position.y = 0.6 * e; if (m >= 1) s.depart = null; }
        if (grains) { const p = grains.pts.geometry.attributes.position; for (let i = 0; i < grains.N; i++) { const [x, z, o] = grains.dep[i]; const y = ((t * 0.07 + o) % 1); p.setXYZ(i, x, y * hmax * 1.6, z); } p.needsUpdate = true; }
        ren.clear(); ren.render(sc, cam);
        // au premier plan, le canevas du moteur est posé sur la carte (aucune recopie) ; sinon, on recopie l'image dans celui de la carte
        if (direct) { const m = ren.domElement; if (m.parentElement !== cv.parentElement) { cv.parentElement.insertBefore(m, cv.nextSibling); } m.style.cssText = `position:absolute;z-index:1;left:${cv.offsetLeft}px;top:${cv.offsetTop}px;width:${W}px;height:${H}px`; if (!s.direct) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); s.direct = true; } }
        else { s.direct = false; if (ren.domElement.parentElement === cv.parentElement) { ren.domElement.remove(); } const c2 = cv.getContext('2d'); c2.clearRect(0, 0, cv.width, cv.height); c2.drawImage(ren.domElement, 0, 0); }
      },
      depart: null, monter() { s.depart = -1; lancer(); },
      jeter() { SCENES.delete(s); sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
    };
    SCENES.add(s); lancer(); return s;
  }

  // ---------------------------------------------------------------- le badge
  // le cadre : un double filet aux coins coupés, plus travaillé avec la rareté (équerres aux coins, losanges, fleuron)
  function cadre(r) {
    const C = 16, W = 240, H = 350, poly = (i, c) => `M${c + i},${i} L${W - c - i},${i} L${W - i},${c + i} L${W - i},${H - c - i} L${W - c - i},${H - i} L${c + i},${H - i} L${i},${H - c - i} L${i},${c + i} Z`;
    let s = `<path class="cl-trait halo" d="${poly(6.5, C - 3)}"/><path class="cl-trait or" d="${poly(1.5, C)}"/><path class="cl-trait vif" d="${poly(6.5, C - 3)}"/>`;
    // de petites équerres d'or aux coins, pour toutes les raretés
    for (const [x, y, sx, sy] of [[14, 14, 1, 1], [226, 14, -1, 1], [14, 336, 1, -1], [226, 336, -1, -1]]) s += `<path class="cl-trait or fin" d="M${x},${y + sy * 9} L${x},${y} L${x + sx * 9},${y}"/>`;
    // les encoches de chaque côté, à la hauteur des chiffres
    s += `<path class="cl-trait or" d="M1.5,262 L8,268 L1.5,274"/><path class="cl-trait or" d="M238.5,262 L232,268 L238.5,274"/>`;
    if (r >= 3) for (const [x, y, sx, sy] of [[11, 11, 1, 1], [229, 11, -1, 1], [11, 339, 1, -1], [229, 339, -1, -1]]) s += `<path class="cl-trait vif epais" d="M${x},${y + sy * 22} L${x},${y + sy * 8} L${x + sx * 8},${y} L${x + sx * 22},${y}"/>`;
    if (r >= 4) for (const y of [6.5, 343.5]) s += `<path class="cl-plein vif" d="M120,${y - 4} L124,${y} L120,${y + 4} L116,${y} Z"/>`;
    // le fleuron (Légendaire et au-delà) : une petite couronne qui pend du haut du cadre, et le cadre qui pulse
    if (r >= 5) s += `<path class="cl-plein or" d="M102,1.5 L138,1.5 L133,7 L128,4 L120,11 L112,4 L107,7 Z"/>`;
    return s;
  }
  function html(s) {
    // s : { r, rarete, nom, commune, valeur (HTML), loyer, potentiel, standing }
    return `<div class="cl r${s.r}"><svg class="cl-cadre" viewBox="0 0 240 350" preserveAspectRatio="none">${cadre(s.r)}</svg>` +
      `<div class="cl-rar"><span>${s.rarete}</span></div><div class="cl-fenetre"></div><canvas class="cl-vue"></canvas>` +
      `<svg class="cl-rose" viewBox="-12 -12 24 24"><path d="M0,-11 L2.4,-2.4 L11,0 L2.4,2.4 L0,11 L-2.4,2.4 L-11,0 L-2.4,-2.4 Z"/><path class="n" d="M0,-11 L2.4,-2.4 L0,0 L-2.4,-2.4 Z"/><circle r="1.6"/></svg>` +
      `<div class="cl-nom"><div class="plaque petite${s.nom.length > 34 ? ' tres-long' : (s.nom.length > 22 ? ' long' : '')}">${s.commune ? `<small>${s.commune}</small>` : ''}${s.nom}</div></div>` +
      `<div class="cl-stats"><div><b>${s.valeur}</b><i>Valeur</i></div><div><b>+${s.loyer}</b><i>Loyer / jour</i></div><div><b>${s.potentiel}</b><i>Potentiel</i></div><div><b class="etoiles">${'★'.repeat(s.standing)}<span>${'★'.repeat(Math.max(0, 3 - s.standing))}</span></b><i>Standing</i></div></div></div>`;
  }
  // brancher la scène 3D d'une carte posée dans la page
  async function animer(el, lieu, r) { const cv = el.querySelector('.cl-vue'); if (!cv || !racine.THREE) return null; if (cv._scene) return cv._scene; const d = await donnees(lieu); if (!cv.isConnected) return null; cv._scene = scene(cv, d, r); moteurPartage(racine.THREE); return cv._scene; }

  // préparer le moteur 3D (et ses programmes de dessin) avant le moment fort : la première scène se compile ici
  let chaud = false;
  function prechauffer() { if (chaud || !racine.THREE) return; chaud = true; const THREE = racine.THREE; const ren = moteurPartage(THREE); ren.setSize(64, 64, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x223355, 0.9)); const sol = new THREE.DirectionalLight(0xffffff, 1.4); sol.position.set(-1, 2, 1); sc.add(sol);
    sc.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xF6F0E4, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.97 })));
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })));
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(2, 2, 2); cam.lookAt(0, 0, 0); ren.render(sc, cam); }
  const api = { donnees, scene, html, animer, prechauffer, COULEURS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.CarteLieu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
