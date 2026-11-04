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
  async function wfs(typ, lon, lat, d, n) {
    const kx = 111320 * Math.cos(lat * Math.PI / 180);
    const bb = [lat - d / 110574, lon - d / kx, lat + d / 110574, lon + d / kx].map((v) => v.toFixed(6)).join(',') + ',urn:ogc:def:crs:EPSG::4326';
    const url = 'https://data.geopf.fr/wfs/ows?' + new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: typ, OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', BBOX: bb, COUNT: String(n || 400) });
    for (let k = 0; k < 3; k++) { try { const r = await fetch(url); if (r.ok) return (await r.json()).features || []; } catch (e) { /* on réessaie */ } await new Promise((r) => setTimeout(r, 400 * (k + 1))); }
    return [];
  }
  // [lon, lat] ou [lat, lon] selon les services : en France, la longitude est la plus petite des deux
  const norm = (c) => (Math.abs(c[0]) > Math.abs(c[1]) ? [c[1], c[0]] : [c[0], c[1]]);
  const anneaux = (g) => { if (!g) return []; const P = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []); return P.map((p) => p[0].map(norm)); };
  function dedans(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }

  // le plan d'un lieu, en mètres autour de lui (x vers l'est, y vers le nord) : sa parcelle, les bâtiments (ceux de la
  // parcelle sont la « cible »), les rues et leur largeur
  function donnees(lieu, ray) {
    ray = Math.max(1, ray || 1); const n = ray > 1.3 ? 1000 : 400;
    const cle = (lieu.id || (lieu.lon + ',' + lieu.lat)) + (ray > 1 ? '@' + ray.toFixed(2) : '');
    if (cache.has(cle)) return cache.get(cle);
    const pr = (async () => {
      const { lon, lat } = lieu;
      const [parc, bat, rou] = await Promise.all([wfs('CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle', lon, lat, 30), wfs('BDTOPO_V3:batiment', lon, lat, 95 * ray, n), wfs('BDTOPO_V3:troncon_de_route', lon, lat, 140 * ray, n)]);
      const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574, loc = ([lo, la]) => [(lo - lon) * kx, (la - lat) * ky];
      let parcelle = null, dmin = 1e9;
      for (const f of parc) for (const r of anneaux(f.geometry)) { const R = r.map(loc); if (dedans([0, 0], R)) { parcelle = R; dmin = 0; } else if (dmin > 0) { const d = Math.min(...R.map((p) => Math.hypot(p[0], p[1]))); if (d < dmin) { dmin = d; parcelle = R; } } }
      const batiments = [];
      for (const f of bat) { const p = f.properties || {}; const h = p.hauteur || (p.nombre_d_etages ? p.nombre_d_etages * 3 : 6);
        for (const r of anneaux(f.geometry)) { const R = r.map(loc); const cx = R.reduce((s, q) => s + q[0], 0) / R.length, cy = R.reduce((s, q) => s + q[1], 0) / R.length;
          batiments.push({ id: p.cleabs, r: R, h: Math.max(3, h), cible: !!(parcelle && dedans([cx, cy], parcelle)) || dedans([0, 0], R) }); } }
      // aucun bâtiment sur la parcelle : le plus proche du lieu
      if (!batiments.some((b) => b.cible) && batiments.length) { let best = null, bd = 1e9; for (const b of batiments) { const d = Math.min(...b.r.map((q) => Math.hypot(q[0], q[1]))); if (d < bd) { bd = d; best = b; } } if (best && bd < 35) best.cible = true; }
      const routes = [];
      for (const f of rou) { const g = f.geometry, p = f.properties || {}; if (!g) continue; const L = g.type === 'LineString' ? [g.coordinates] : (g.type === 'MultiLineString' ? g.coordinates : []);
        const larg = Math.min(16, Math.max(3, p.largeur_de_chaussee || (p.importance && p.importance <= '3' ? 9 : 5))); for (const l of L) routes.push({ p: l.map(norm).map(loc), larg }); }
      return { parcelle, dansParcelle: dmin === 0, batiments, routes };
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
    const focus = vues.find((s) => s.focus);
    if (focus) vues.forEach((s, i) => { if (s === focus || (cadence % 60) === (i * 7) % 60 || !s.vu) s.dessiner(t / 1000, s === focus); });
    else { const tour = vues[cadence % vues.length]; vues.forEach((s) => { if (s === tour || !s.vu) s.dessiner(t / 1000, false); }); }
    boucle = requestAnimationFrame(dessinerTout);
  }
  function visible(el) { const b = el.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; }
  function moteurPartage(THREE) { if (!moteur) { const cv = document.createElement('canvas'); cv.className = 'cl-moteur'; moteur = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); moteur.setClearColor(0x000000, 0); } return moteur; }

  function scene(cv, d, r, opts) {
    opts = opts || {};
    const THREE = racine.THREE; const [clair, vif] = COULEURS[r] || COULEURS[1];
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 1, 6000);
    const RAYON = opts.rayon || 85;
    // un monument qui a sa maquette (src/maquettes.js) : elle remplace les bâtiments de l'IGN qu'elle recouvre ; les autres
    // restent en traits d'or sur le plan
    const mq = opts.objet || null, masque = opts.masquer || new Set();
    const estVoisin = (b) => (mq ? !masque.has(b.id) : !b.cible), estCible = (b) => !mq && b.cible;
    // le plan d'or (rues, bâtiments voisins, parcelle), peint une fois dans une image posée au sol : des traits épais et
    // nets (remarque de Gautier : « traits trop fins »), qui s'effacent doucement vers les bords
    { const T = opts.leger ? 512 : 1024, c2 = document.createElement('canvas'); c2.width = c2.height = T; const g = c2.getContext('2d'), m = T / (2 * RAYON), q = ([x, y]) => [T / 2 + x * m, T / 2 - y * m];
      g.lineJoin = g.lineCap = 'round';
      const chemin = (pts, ferme) => { g.beginPath(); pts.forEach((pt, i) => { const [a, b] = q(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (ferme) g.closePath(); };
      g.strokeStyle = 'rgba(233,199,123,.30)'; for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = rt.larg * m; g.stroke(); }
      const e1 = T / 1024; g.strokeStyle = 'rgba(233,199,123,.55)'; for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = 1.5 * e1; g.stroke(); }
      for (const b of d.batiments) { if (!estVoisin(b)) continue; chemin(b.r, true); g.fillStyle = 'rgba(233,199,123,.10)'; g.fill(); g.strokeStyle = 'rgba(240,210,140,.95)'; g.lineWidth = 4 * e1; g.stroke(); }
      if (d.parcelle && (!mq || d.dansParcelle)) { chemin(d.parcelle, true); g.fillStyle = 'rgba(233,199,123,.26)'; g.fill(); g.setLineDash([14 * e1, 8 * e1]); g.strokeStyle = '#FFF1C9'; g.lineWidth = 5 * e1; g.stroke(); g.setLineDash([]); }
      for (const b of d.batiments) { if (!estCible(b)) continue; chemin(b.r, true); g.fillStyle = 'rgba(255,248,230,.35)'; g.fill(); }
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
    for (const b of d.batiments) { if (!estCible(b)) continue; hmax = Math.max(hmax, b.h);
      const f = new THREE.Shape(b.r.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(f, { depth: b.h, bevelEnabled: false }).rotateX(-Math.PI / 2);
      maquette.add(new THREE.Mesh(g, verre)); maquette.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), aretes));
      for (const [x, y] of b.r) { bx[0] = Math.min(bx[0], x); bx[1] = Math.max(bx[1], x); bx[2] = Math.min(bx[2], y); bx[3] = Math.max(bx[3], y); } }
    // un monument : la caméra se règle sur la sphère qui l'entoure (une tour haute et fine, une abbaye large et basse)
    let cadrage = null;
    if (mq) { maquette.add(mq); const bb = new THREE.Box3().setFromObject(mq); hmax = Math.max(6, bb.max.y); bx = [bb.min.x, bb.max.x, -bb.max.z, -bb.min.z];
      const rayon = bb.getSize(new THREE.Vector3()).length() / 2; cadrage = { dist: rayon / Math.sin(15 * Math.PI / 180) * 0.98, y: (Math.max(0, bb.min.y) + bb.max.y) / 2 }; }
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
        const a = t * 0.22, dist = cadrage ? cadrage.dist : taille * 2.7 + hmax * 0.8, el = 0.62, vy = cadrage ? cadrage.y : hmax * 0.4; if (s.rose) s.rose.style.transform = `rotate(${(a * 180 / Math.PI + 90).toFixed(1)}deg)`; cam.position.set(cx + Math.cos(a) * dist * Math.cos(el), vy + hmax * 0.05 + dist * Math.sin(el), cz + Math.sin(a) * dist * Math.cos(el)); cam.lookAt(cx, vy, cz);
        // la maquette monte du plan quand la carte se dessine
        if (s.depart != null) { if (s.depart < 0) s.depart = t; const m = Math.min(1, (t - s.depart) / 1.3), e = 1 - Math.pow(1 - m, 3); maquette.scale.y = Math.max(0.001, e); maquette.position.y = 0.6 * e; if (m >= 1) s.depart = null; }
        if (grains) { const p = grains.pts.geometry.attributes.position; for (let i = 0; i < grains.N; i++) { const [x, z, o] = grains.dep[i]; const y = ((t * 0.07 + o) % 1); p.setXYZ(i, x, y * hmax * 1.6, z); } p.needsUpdate = true; }
        ren.clear(); ren.render(sc, cam);
        // au premier plan, le canevas du moteur est posé sur la carte (aucune recopie) ; sinon, on recopie l'image dans celui de la carte
        if (direct) { const m = ren.domElement; if (m.parentElement !== cv.parentElement) { cv.parentElement.insertBefore(m, cv.nextSibling); } m.style.cssText = `position:absolute;z-index:1;left:${cv.offsetLeft}px;top:${cv.offsetTop}px;width:${W}px;height:${H}px`; if (!s.direct) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); s.direct = true; } }
        else { s.direct = false; if (ren.domElement.parentElement === cv.parentElement) { ren.domElement.remove(); } const c2 = cv.getContext('2d'); c2.clearRect(0, 0, cv.width, cv.height); c2.drawImage(ren.domElement, 0, 0); }
      },
      depart: null, monter() { s.depart = -1; lancer(); },
      jeter() { SCENES.delete(s); if (cv._scene === s) cv._scene = null; if (moteur && moteur.domElement.parentElement === cv.parentElement) moteur.domElement.remove();
        if (mq) rendreMaquette(mq);   // la maquette d'un monument est gardée (ses formes servent aux autres cartes)
        sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); },
    };
    SCENES.add(s); lancer(); return s;
  }

  // ---------------------------------------------------------------- le badge
  // le cadre : un double filet aux coins coupés, plus travaillé avec la rareté (équerres aux coins, losanges, fleuron)
  // le cadre : un double filet aux coins arrondis (Gautier : les coins coupés faisaient « rognés »), des éventails d'or
  // aux angles (pour toutes les raretés), plus orné avec la rareté (arcs de couleur, losanges, couronne)
  function cadre(r) {
    const W = 240, H = 350, rr = (i, a) => `M${i + a},${i} H${W - i - a} A${a},${a} 0 0 1 ${W - i},${i + a} V${H - i - a} A${a},${a} 0 0 1 ${W - i - a},${H - i} H${i + a} A${a},${a} 0 0 1 ${i},${H - i - a} V${i + a} A${a},${a} 0 0 1 ${i + a},${i} Z`;
    // un seul filet, au bord de la carte, à la couleur de la rareté (Gautier, 4 nov. : le filet intérieur « rentrait et sortait
    // de la carte » sur son téléphone ; il est retiré)
    let s = `<path class="cl-trait bord" d="${rr(1.5, 13)}"/>`;
    const coins = [[12, 12, 1, 1], [228, 12, -1, 1], [12, 338, 1, -1], [228, 338, -1, -1]];
    const arc = (cx, cy, sx, sy, a) => `M${cx + sx * a},${cy} A${a},${a} 0 0 ${sx * sy > 0 ? 1 : 0} ${cx},${cy + sy * a}`;
    for (const [x, y, sx, sy] of coins) s += `<path class="cl-trait or fin" d="${arc(x, y, sx, sy, 8)}"/><path class="cl-trait or fin" d="${arc(x, y, sx, sy, 12)}"/><circle class="cl-plein or" cx="${x + sx * 3}" cy="${y + sy * 3}" r="1.8"/>`;
    // de petits losanges d'or au milieu des côtés, à la hauteur des chiffres
    for (const x of [1.5, 238.5]) s += `<path class="cl-plein or" d="M${x},262 L${x + 3.5},268 L${x},274 L${x - 3.5},268 Z"/>`;
    if (r >= 3) for (const [x, y, sx, sy] of coins) s += `<path class="cl-trait vif epais" d="${arc(x - sx, y - sy, sx, sy, 17)}"/>`;
    if (r >= 4) for (const y of [4.5, 345.5]) s += `<path class="cl-plein vif" d="M120,${y - 4} L124,${y} L120,${y + 4} L116,${y} Z"/>`;
    // la couronne (Légendaire et au-delà), qui pend du haut du cadre
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
  // ---------------------------------------------------------------- la maquette d'un monument
  // Un monument qui a sa maquette sur la carte du jeu (src/maquettes.js) la montre aussi sur sa carte (Gautier, 4 nov. :
  // « oui »), en porcelaine aux arêtes d'or comme les autres cartes : on reprend ses pièces, sans la coque d'encre ni les
  // couleurs du plan. Elle est construite à chaque fois que la carte s'anime, et libérée avec elle.
  function modeleDe(lieu) { const M = racine.Maquettes; if (!M || !M.MODELES || !lieu || lieu.type !== 'monument') return null; return M.MODELES[String(lieu.id || '').replace(/^mon:/, '')] || null; }
  function jeterObjet(o) { o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map) x.material.map.dispose(); x.material.dispose(); } }); }
  function maquetteMonument(THREE, m, lieu) {
    const g = m.construire(THREE); g.rotation.y = (m.orientation || 0) * Math.PI / 180;
    const o = new THREE.Group(); o.add(g);
    // la maquette est centrée sur son monument (m.centre), la carte sur le lieu (x vers l'est, z vers le sud)
    o.position.set((m.centre[0] - lieu.lon) * 111320 * Math.cos(lieu.lat * Math.PI / 180), 0, -(m.centre[1] - lieu.lat) * 110574);
    const porcelaine = new THREE.MeshStandardMaterial({ color: 0xF6F0E4, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
    const vieux = new Set(), coques = [];
    o.traverse((x) => { if (!x.isMesh) return; vieux.add(x.material); if (x.userData.contour) coques.push(x); else x.material = porcelaine; });
    for (const x of coques) { x.parent.remove(x); x.geometry.dispose(); }
    for (const mat of vieux) { if (mat.gradientMap) mat.gradientMap.dispose(); mat.dispose(); }
    o.updateMatrixWorld(true);
    return o;
  }
  // Les maquettes construites restent gardées : chaque carte en reçoit une copie (mêmes formes, même matière), et l'on ne
  // reconstruit pas Carcassonne à chaque passage dans la collection (mesuré au téléphone simulé : 0,3 s pour la construire).
  // Les arêtes d'or (plus coûteuses encore : 0,5 s pour Carcassonne) se calculent ensuite, une pièce à la fois, quand le
  // téléphone a le temps ; les grosses pièces répétées (créneaux, fenêtres, colonnes réunies) n'en ont pas.
  const MAQ = new Map(), GARDEES = 6;
  const pieces = (o) => { const p = []; o.traverse((x) => { if (x.isMesh) p.push(x); }); return p; };
  const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const plusTard = (f) => (racine.requestIdleCallback ? racine.requestIdleCallback(f, { timeout: 250 }) : setTimeout(f, 30));
  function prendreMaquette(THREE, id, m, lieu) {
    let e = MAQ.get(id);
    if (!e) { const maitre = maquetteMonument(THREE, m, lieu); e = { maitre, pieces: pieces(maitre), copies: new Set(), fait: 0, geos: [], aretes: new THREE.LineBasicMaterial({ color: 0xE2B860, transparent: true, opacity: 0.8 }) }; }
    MAQ.delete(id); MAQ.set(id, e);   // la plus récente en dernier
    const c = e.maitre.clone(); c.userData.maq = id; c.userData.pieces = pieces(c); e.copies.add(c);
    if (e.fait < e.pieces.length && !e.enCours) { e.enCours = true; plusTard(function pas() { aretes(THREE, e); if (e.fait < e.pieces.length && !e.jete) plusTard(pas); else e.enCours = false; }); }
    return c;
  }
  function aretes(THREE, e) {
    const fin = performance.now() + 6;
    while (e.fait < e.pieces.length && performance.now() < fin) {
      const i = e.fait++, p = e.pieces[i]; if (triangles(p.geometry) > 1500) continue;
      const g = new THREE.EdgesGeometry(p.geometry, 35); e.geos.push(g);
      p.add(new THREE.LineSegments(g, e.aretes)); for (const c of e.copies) c.userData.pieces[i].add(new THREE.LineSegments(g, e.aretes));
    }
  }
  function rendreMaquette(c) {
    const e = MAQ.get(c.userData.maq); if (c.parent) c.parent.remove(c); if (!e) return; e.copies.delete(c);
    const libres = [...MAQ].filter(([, x]) => !x.copies.size);
    for (const [id, x] of libres.slice(0, Math.max(0, libres.length - GARDEES))) { MAQ.delete(id); x.jete = true; jeterObjet(x.maitre); x.geos.forEach((g) => g.dispose()); x.aretes.dispose(); }
  }

  // brancher la scène 3D d'une carte posée dans la page
  async function animer(el, lieu, r, opts) { const cv = el && el.querySelector('.cl-vue'); if (!cv || !racine.THREE) return null; if (cv._scene) return cv._scene;
    opts = Object.assign({}, opts); let ray = 1; const m = modeleDe(lieu);
    if (m) { try { const THREE = racine.THREE; opts.objet = prendreMaquette(THREE, String(lieu.id), m, lieu); opts.masquer = new Set(m.masquer || []);
      // un grand monument (Versailles, le Louvre, Carcassonne) : un plan plus large autour de lui
      const bb = new THREE.Box3().setFromObject(opts.objet), loin = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
      opts.rayon = Math.min(260, Math.max(85, loin + 30)); ray = opts.rayon / 85; } catch (e) { if (opts.objet) rendreMaquette(opts.objet); opts.objet = null; } }
    const d = await donnees(lieu, ray);
    if (!cv.isConnected || cv._scene) { if (opts.objet) rendreMaquette(opts.objet); return cv._scene || null; }
    cv._scene = scene(cv, d, r, opts); moteurPartage(racine.THREE); return cv._scene; }

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
