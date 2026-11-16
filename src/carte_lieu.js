// La carte d'un lieu. Depuis le 16 nov. 2026 (interview de Gautier, docs/CARTES-NEON.md) : « nuit et néon ». La nuit, le
// plan cadastral du quartier en traits de néon (la parcelle surlignée, les bâtiments voisins, les rues) et, sur toute la
// carte, le vrai bâtiment en verre aux arêtes lumineuses, qui tourne lentement ; un cadre orné ; l'adresse sur des plaques
// de néon ; un reflet arc-en-ciel qui suit l'inclinaison. La rareté change la couleur des néons et ajoute des effets
// (particules, halo, rayons, arc-en-ciel pour l'Extraordinaire). Les chiffres (valeur, loyer, potentiel, standing) ne sont
// plus sur la carte : ils s'affichent dessous quand on l'ouvre en grand (chiffres).
// (Avant : la refonte du 4 nov., bleu nuit et or, maquette de porcelaine dans une fenêtre, chiffres sur la carte.)
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
    // (la carte en main en dernier : elle se dessine dans le canevas du moteur, posé sur elle ; dessinée avant une autre, elle montrait
    // un instant l'image de la carte du dessous : « la carte du dessous passe dessus sous forme de flash », Gautier, 16 nov.)
    if (focus) { vues.forEach((s, i) => { if (s !== focus && ((cadence % 60) === (i * 7) % 60 || !s.vu)) s.dessiner(t / 1000, false); }); focus.dessiner(t / 1000, true); }
    else { const tour = vues[cadence % vues.length]; vues.forEach((s) => { if (s === tour || !s.vu) s.dessiner(t / 1000, false); }); }
    boucle = requestAnimationFrame(dessinerTout);
  }
  function visible(el) { const b = el.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; }
  function moteurPartage(THREE) { if (!moteur) { const cv = document.createElement('canvas'); cv.className = 'cl-moteur'; moteur = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); moteur.setClearColor(0x000000, 0); } return moteur; }

  // ---------------------------------------------------------------- la carte « nuit et néon » (16 nov. 2026)
  // Choix de Gautier (interview en 20 questions, docs/CARTES-NEON.md) : la nuit, le plan cadastral du quartier en traits de
  // néon, la parcelle surlignée, le vrai bâtiment en verre aux arêtes lumineuses, qui tourne tout seul, sur toute la carte ;
  // la rareté change la couleur des néons et ajoute des effets (particules, halo, rayons, arc-en-ciel).
  // En grand (la carte en main), un halo de lumière autour des néons (UnrealBloomPass, chargé avec Three.js) ; en petit
  // (collection, pile), un dessin plus léger sans halo. Un petit téléphone garde le dessin sans halo.
  const NUIT = 0x050818;
  let compo = null;
  function composerPartage(THREE, ren) {
    if (compo !== null) return compo;
    if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass || (racine.navigator && racine.navigator.deviceMemory && racine.navigator.deviceMemory <= 2)) return (compo = false);
    const c = new THREE.EffectComposer(ren); c.setPixelRatio(1);
    const passe = new THREE.RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()), halo = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.3);
    c.addPass(passe); c.addPass(halo); return (compo = { c, passe, halo, w: 0, h: 0 });
  }
  let TEX = null;
  function textures(THREE) {
    if (TEX) return TEX;
    const c1 = document.createElement('canvas'); c1.width = c1.height = 64; let g = c1.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.35, 'rgba(255,255,255,.45)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64);
    const c2 = document.createElement('canvas'); c2.width = 16; c2.height = 128; g = c2.getContext('2d'); d = g.createLinearGradient(0, 128, 0, 0);
    d.addColorStop(0, 'rgba(255,255,255,.9)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 16, 128);
    const e = g.createLinearGradient(0, 0, 16, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.5, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = e; g.fillRect(0, 0, 16, 128);
    return (TEX = { doux: new THREE.CanvasTexture(c1), faisceau: new THREE.CanvasTexture(c2) });
  }
  const aireSignee = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return s / 2; };
  // les fenêtres allumées : de petits rectangles posés sur les murs, étage par étage (un hasard fixe par lieu)
  function fenetres(THREE, cibles, graine) {
    let s = graine >>> 0 || 1; const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), pos = []; let n = 0;
    for (const b of cibles) { const sens = aireSignee(b.r) > 0 ? 1 : -1, etages = Math.max(1, Math.floor(b.h / 3));
      for (let i = 0; i < b.r.length && n < 420; i++) { const a = b.r[i], c = b.r[(i + 1) % b.r.length], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy); if (l < 2.4) continue;
        const ux = dx / l, uy = dy / l, ox = uy * sens * 0.08, oy = -ux * sens * 0.08, nb = Math.floor(l / 2.6), pas = l / nb;
        for (let e = 0; e < etages; e++) for (let k = 0; k < nb && n < 420; k++) { if (alea() > 0.34) continue;
          const t0 = k * pas + pas * 0.28, t1 = k * pas + pas * 0.72, y0 = e * 3 + 1.0, y1 = e * 3 + 2.3; if (y1 > b.h - 0.3) continue;
          const A = [a[0] + ux * t0 + ox, a[1] + uy * t0 + oy], B = [a[0] + ux * t1 + ox, a[1] + uy * t1 + oy];
          pos.push(A[0], y0, -A[1], B[0], y0, -B[1], B[0], y1, -B[1], A[0], y0, -A[1], B[0], y1, -B[1], A[0], y1, -A[1]); n++; } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
  }
  function scene(cv, d, r, opts) {
    opts = opts || {};
    const THREE = racine.THREE; const [clair, vif] = COULEURS[r] || COULEURS[1], cClair = new THREE.Color(clair), cVif = new THREE.Color(vif), leger = !!opts.leger;
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, 1, 6000); sc.background = new THREE.Color(NUIT);
    const RAYON = opts.rayon || 85, T3 = textures(THREE);
    // un monument qui a sa maquette (src/maquettes.js) : elle remplace les bâtiments de l'IGN qu'elle recouvre
    const mq = opts.objet || null, masque = opts.masquer || new Set();
    const estVoisin = (b) => (mq ? !masque.has(b.id) : !b.cible), estCible = (b) => !mq && b.cible;
    const teintes = [], rgba = (c, a) => `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`;
    const mat = (o) => new THREE.MeshBasicMaterial(o), trait = (o) => new THREE.LineBasicMaterial(o);
    // le plan du quartier, peint une fois dans une image posée au sol : un quadrillage, les rues, les bâtiments voisins, et la
    // parcelle en néon (son halo est peint ici : il ne coûte rien ensuite) ; l'image s'efface doucement vers les bords
    { const T = leger ? 512 : 1024, c2 = document.createElement('canvas'); c2.width = c2.height = T; const g = c2.getContext('2d'), m = T / (2 * RAYON), q = ([x, y]) => [T / 2 + x * m, T / 2 - y * m], e1 = T / 1024;
      g.lineJoin = g.lineCap = 'round';
      const chemin = (pts, ferme) => { g.beginPath(); pts.forEach((pt, i) => { const [a, b] = q(pt); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (ferme) g.closePath(); };
      g.strokeStyle = 'rgba(38,58,150,.55)'; g.lineWidth = 1.2 * e1; g.beginPath(); for (let k = -RAYON; k <= RAYON; k += 12) { const [a] = q([k, 0]), [, b] = q([0, k]); g.moveTo(a, 0); g.lineTo(a, T); g.moveTo(0, b); g.lineTo(T, b); } g.stroke();
      g.strokeStyle = 'rgba(12,22,66,.96)'; for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = (rt.larg + 2) * m; g.stroke(); }
      g.strokeStyle = rgba(cVif, 0.5); for (const rt of d.routes) { chemin(rt.p, false); g.lineWidth = 1.8 * e1; g.stroke(); }
      for (const b of d.batiments) { if (!estVoisin(b)) continue; chemin(b.r, true); g.fillStyle = 'rgba(10,17,58,.92)'; g.fill(); g.strokeStyle = rgba(cVif, 0.6); g.lineWidth = 2.6 * e1; g.stroke(); }
      if (d.parcelle && (!mq || d.dansParcelle)) { chemin(d.parcelle, true); g.fillStyle = rgba(cVif, 0.14); g.fill();
        g.save(); g.shadowColor = rgba(cVif, 1); g.shadowBlur = 22 * e1; g.strokeStyle = rgba(cVif, 1); g.lineWidth = 6.5 * e1; g.stroke(); g.stroke(); g.restore(); g.strokeStyle = rgba(cClair, 1); g.lineWidth = 2.4 * e1; g.stroke(); }
      g.globalCompositeOperation = 'destination-in'; const fondu = g.createRadialGradient(T / 2, T / 2, T * 0.2, T / 2, T / 2, T / 2); fondu.addColorStop(0, '#000'); fondu.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fondu; g.fillRect(0, 0, T, T);
      const tex = new THREE.CanvasTexture(c2); tex.anisotropy = 4;
      const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * RAYON, 2 * RAYON).rotateX(-Math.PI / 2), mat({ map: tex, transparent: true, depthWrite: false }));
      sol.position.y = 0.05; sc.add(sol); }
    const volume = (b, k) => new THREE.ExtrudeGeometry(new THREE.Shape(b.r.map(([x, y]) => new THREE.Vector2(x, y))), { depth: b.h * (k || 1), bevelEnabled: false }).rotateX(-Math.PI / 2);
    const boucle3 = (rr, y) => { const pos = []; for (const p of rr) pos.push(p[0], y, -p[1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g; };
    // en grand : les bâtiments voisins en bas-relief de nuit (au quart de leur hauteur), leur toit tracé : en ville, des
    // voisins à leur vraie hauteur cacheraient le bâtiment du lieu, serré entre eux (en petit, le plan suffit)
    const BAS = 0.24;
    if (!leger) { const mV = mat({ color: 0x0A1138 }), mT = trait({ color: 0x2A3F9C, transparent: true, opacity: 0.9 });
      // (un voisin qui recouvre le bâtiment du lieu, ou qui est dedans, n'est pas monté : l'IGN découpe parfois un même
      // immeuble en plusieurs emprises, et un volume de nuit cacherait le bâtiment de verre)
      const centre = (rr) => [rr.reduce((t, p) => t + p[0], 0) / rr.length, rr.reduce((t, p) => t + p[1], 0) / rr.length], lieux = d.batiments.filter(estCible);
      const gene = (b) => lieux.some((c) => dedans(centre(c.r), b.r) || dedans(centre(b.r), c.r));
      d.batiments.filter((b) => estVoisin(b) && !gene(b)).map((b) => ({ b, dd: Math.min(...b.r.map((p) => Math.hypot(p[0], p[1]))) })).filter((x) => x.dd < RAYON * 0.9).sort((a, b) => a.dd - b.dd).slice(0, 90).forEach(({ b }) => {
        try { const m = new THREE.Mesh(volume(b, BAS), mV); m.position.y = 0.06; sc.add(m); sc.add(new THREE.LineLoop(boucle3(b.r, b.h * BAS + 0.12), mT)); } catch (e) { /* emprise dégénérée */ } }); }
    // le bâtiment : du verre de nuit, des arêtes de néon, un trait par étage, des fenêtres allumées
    const verre = mat({ color: new THREE.Color(0x0E1C58).lerp(cVif, 0.3), transparent: true, opacity: 0.86 });
    const aretes = trait({ color: cClair.clone() }), etages = trait({ color: cVif.clone(), transparent: true, opacity: 0.34 }); teintes.push([aretes, -1], [etages, 1]);
    const maquette = new THREE.Group(); let hmax = 6, bx = [1e9, -1e9, 1e9, -1e9]; const cibles = [];
    for (const b of d.batiments) { if (!estCible(b)) continue; hmax = Math.max(hmax, b.h); cibles.push(b); let g; try { g = volume(b); } catch (e) { continue; }
      maquette.add(new THREE.Mesh(g, verre)); maquette.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), aretes));
      if (!leger) for (let y = 3; y < b.h - 0.5; y += 3) maquette.add(new THREE.LineLoop(boucle3(b.r, y), etages));
      for (const [x, y] of b.r) { bx[0] = Math.min(bx[0], x); bx[1] = Math.max(bx[1], x); bx[2] = Math.min(bx[2], y); bx[3] = Math.max(bx[3], y); } }
    if (cibles.length && !leger) maquette.add(new THREE.Mesh(fenetres(THREE, cibles, Math.round(Math.abs(cibles[0].r[0][0] * 7919 + cibles[0].r[0][1] * 104729))), mat({ color: 0xFFD98A, side: THREE.DoubleSide })));
    // un monument : sa maquette, éclairée par la nuit (elle garde ses matières à elle) ; la caméra se règle sur la sphère qui l'entoure
    let cadrage = null;
    if (mq) { sc.add(new THREE.HemisphereLight(0xCFE0FF, 0x1A2460, 1.05)); const lune = new THREE.DirectionalLight(0xE6EEFF, 1.1); lune.position.set(-60, 120, 40); sc.add(lune); const reflet = new THREE.PointLight(vif, 1.6, 0, 0); reflet.position.set(70, 30, -60); sc.add(reflet);
      maquette.add(mq); const bb = new THREE.Box3().setFromObject(mq); hmax = Math.max(6, bb.max.y); bx = [bb.min.x, bb.max.x, -bb.max.z, -bb.min.z];
      const rayon = bb.getSize(new THREE.Vector3()).length() / 2; cadrage = { dist: rayon / Math.sin(13 * Math.PI / 180) * 1.22, y: (Math.max(0, bb.min.y) + bb.max.y) / 2 }; }
    // un lieu sans bâtiment (un terrain, une place) : on cadre sa parcelle
    if (bx[0] > bx[1] && d.parcelle && d.parcelle.length) for (const [x, y] of d.parcelle) { bx[0] = Math.min(bx[0], x); bx[1] = Math.max(bx[1], x); bx[2] = Math.min(bx[2], y); bx[3] = Math.max(bx[3], y); }
    if (bx[0] > bx[1]) bx = [-8, 8, -8, 8];
    maquette.position.y = 0.6; sc.add(maquette);
    const cx = (bx[0] + bx[1]) / 2, cz = -(bx[2] + bx[3]) / 2, tcam = Math.max(18, bx[1] - bx[0], bx[3] - bx[2], hmax * 1.2), taille = Math.min(RAYON * 0.8, tcam);   // (tcam : pour la caméra ; taille : pour les effets, bornés au plan)
    // la lumière vivante : un halo au sol qui respire, des particules qui montent, des faisceaux pour les plus rares
    const mHalo = mat({ map: T3.doux, color: cVif.clone(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }); teintes.push([mHalo, 1]);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mHalo); halo.position.set(cx, 0.2, cz); halo.scale.setScalar(taille * 2.2); sc.add(halo);
    const N = leger ? 8 + r * 4 : 26 + r * 16, dep = [], pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, rr = taille * (0.25 + Math.random() * 0.95); dep.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, Math.random(), 0.05 + Math.random() * 0.06]); }
    const gG = new THREE.BufferGeometry(); gG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mG = new THREE.PointsMaterial({ map: T3.doux, color: cClair.clone(), size: Math.max(0.8, taille / 16), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }); teintes.push([mG, -1]);
    const grains = new THREE.Points(gG, mG); grains.frustumCulled = false; sc.add(grains);
    let rayons = null;
    if (r >= 4 && !leger) { rayons = new THREE.Group(); rayons.position.set(cx, 0, cz); const n = r >= 6 ? 9 : (r >= 5 ? 7 : 5), mR = mat({ map: T3.faisceau, color: cVif.clone(), transparent: true, opacity: 0.36, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); teintes.push([mR, 1]);
      for (let i = 0; i < n; i++) { const a = i / n * 6.283, h = hmax * 2.2 + 30, p = new THREE.Mesh(new THREE.PlaneGeometry(taille * 0.16, h), mR); p.position.set(Math.cos(a) * taille * 0.85, h / 2, Math.sin(a) * taille * 0.85); p.rotation.y = -a; rayons.add(p); }
      sc.add(rayons); }
    const s = {
      cv, focus: false, vu: false, rose: null, cadre: { cx, cz, tcam, hmax, bx }, dessiner(t, direct) {
        const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; const ren = moteurPartage(THREE); const k = Math.min(direct ? 1.75 : 1.25, devicePixelRatio || 1); s.vu = true;
        if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
        if (ren.domElement.width !== cv.width || ren.domElement.height !== cv.height) ren.setSize(cv.width, cv.height, false);
        cam.aspect = W / H; cam.updateProjectionMatrix();
        // la carte en main suit l'inclinaison (--mx et --my, posés par le jeu sur la carte) : une légère profondeur
        let px = 0, py = 0;
        if (direct && cv.parentElement) { const st = getComputedStyle(cv.parentElement), mx = parseFloat(st.getPropertyValue('--mx')), my = parseFloat(st.getPropertyValue('--my')); if (mx === mx) px = Math.max(-1, Math.min(1, (mx - 50) / 45)); if (my === my) py = Math.max(-1, Math.min(1, (my - 45) / 45)); }
        const large = W / H > 0.9 ? 0.72 : 1;   // (une vue large, s'il en reste : on se rapproche)
        const a = t * 0.22 + px * 0.16, dist = (cadrage ? cadrage.dist : Math.max(tcam * 3.5, hmax * 4.6) + hmax * 1.1) * large, el = 0.6 - py * 0.05, vy = (cadrage ? cadrage.y : hmax * 0.5) - dist * 0.03;   // (on vise le milieu du bâtiment, pas son pied)
        cam.position.set(cx + Math.cos(a) * dist * Math.cos(el), vy + hmax * 0.05 + dist * Math.sin(el), cz + Math.sin(a) * dist * Math.cos(el)); cam.lookAt(cx, vy, cz);
        // la maquette monte du plan quand la carte se dessine
        if (s.depart != null) { if (s.depart < 0) s.depart = t; const m = Math.min(1, (t - s.depart) / 1.3), e = 1 - Math.pow(1 - m, 3); maquette.scale.y = Math.max(0.001, e); maquette.position.y = 0.6 * e; if (m >= 1) s.depart = null; }
        { const p = grains.geometry.attributes.position, haut = hmax * 1.7 + 14; for (let i = 0; i < N; i++) { const [x, z, o, v] = dep[i]; p.setXYZ(i, x, ((t * v + o) % 1) * haut, z); } p.needsUpdate = true; }
        mHalo.opacity = 0.15 + 0.03 * r + 0.07 * Math.sin(t * 1.6); halo.scale.setScalar(taille * (2.1 + 0.2 * Math.sin(t * 1.6)));
        if (rayons) { rayons.rotation.y = -t * 0.35; rayons.children[0].material.opacity = 0.28 + 0.1 * Math.sin(t * 2.1); }
        // l'Extraordinaire : ses néons parcourent l'arc-en-ciel
        if (r === 6) for (const [m, kk] of teintes) m.color.setHSL((t * 0.08 + (kk < 0 ? 0.08 : 0)) % 1, 1, kk < 0 ? 0.85 : 0.6);
        const cp = direct ? composerPartage(THREE, ren) : null;
        if (cp) { if (cp.w !== cv.width || cp.h !== cv.height) { cp.c.setSize(cv.width, cv.height); cp.w = cv.width; cp.h = cv.height; } cp.passe.scene = sc; cp.passe.camera = cam; cp.halo.strength = 0.5 + r * 0.07; cp.c.render(); }
        else { ren.setRenderTarget(null); ren.clear(); ren.render(sc, cam); }
        // au premier plan, le canevas du moteur est posé sur la carte (aucune recopie) ; sinon, on recopie l'image dans celui de la carte
        if (direct) { const m = ren.domElement; if (m.parentElement !== cv.parentElement) { cv.parentElement.insertBefore(m, cv.nextSibling); } m.style.cssText = `position:absolute;z-index:1;left:${cv.offsetLeft}px;top:${cv.offsetTop}px;width:${W}px;height:${H}px`; if (!s.direct) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); s.direct = true; } }
        else { s.direct = false; if (ren.domElement.parentElement === cv.parentElement) { ren.domElement.remove(); } const c2 = cv.getContext('2d'); c2.clearRect(0, 0, cv.width, cv.height); c2.drawImage(ren.domElement, 0, 0); }
      },
      depart: null, monter() { s.depart = -1; lancer(); },
      jeter() { SCENES.delete(s); if (cv._scene === s) cv._scene = null; if (moteur && moteur.domElement.parentElement === cv.parentElement) moteur.domElement.remove();
        if (mq) rendreMaquette(mq);   // la maquette d'un monument est gardée (ses formes servent aux autres cartes)
        sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && o.material.map !== T3.doux && o.material.map !== T3.faisceau) o.material.map.dispose(); o.material.dispose(); } }); },
    };
    SCENES.add(s); lancer(); return s;
  }

  // ---------------------------------------------------------------- le badge
  // le cadre orné du prototype n° 3 (choisi par Gautier le 16 nov.) : un double filet de néon aux coins arrondis, des
  // équerres et des losanges aux angles, des losanges au milieu des côtés, une couronne pour les Légendaires et au-delà ;
  // tout est à la couleur de la rareté (--c1 clair, --c2 vif)
  function cadre(r) {
    const W = 240, H = 350, rr = (i, a) => `M${i + a},${i} H${W - i - a} A${a},${a} 0 0 1 ${W - i},${i + a} V${H - i - a} A${a},${a} 0 0 1 ${W - i - a},${H - i} H${i + a} A${a},${a} 0 0 1 ${i},${H - i - a} V${i + a} A${a},${a} 0 0 1 ${i + a},${i} Z`;
    let s = `<path class="cn2 aura" d="${rr(2.5, 12)}"/><path class="cn1 bord" d="${rr(2.5, 12)}"/><path class="cn2 fin" d="${rr(8.5, 8)}"/>`;
    for (const [x, y, sx, sy] of [[9, 9, 1, 1], [231, 9, -1, 1], [9, 341, 1, -1], [231, 341, -1, -1]]) s += `<path class="cn1" d="M${x + sx * 26},${y} H${x + sx * 9} Q${x},${y} ${x},${y + sy * 9} V${y + sy * 26}"/>`
      + `<path class="cn2 fin" d="M${x + sx * 30},${y + sy * 5} H${x + sx * 12} Q${x + sx * 5},${y + sy * 5} ${x + sx * 5},${y + sy * 12} V${y + sy * 30}"/>`
      + `<path class="cp1" d="M${x + sx * 11},${y + sy * 11} l${sx * 5},${sy * -5} l${sx * 5},${sy * 5} l${sx * -5},${sy * 5} Z"/><circle class="cp1" cx="${x + sx * 30}" cy="${y}" r="1.7"/><circle class="cp1" cx="${x}" cy="${y + sy * 30}" r="1.7"/>`;
    for (const y of [2.5, 347.5]) s += `<path class="cp1" d="M120,${y - 6} L127,${y} L120,${y + 6} L113,${y} Z"/><path class="cn2 gros" d="M96,${y} H109 M131,${y} H144"/>`;
    for (const x of [2.5, 237.5]) s += `<path class="cp1" d="M${x},168 l4.5,7 l-4.5,7 l-4.5,-7 Z"/>`;
    if (r >= 5) s += `<path class="cp1 couronne" d="M98,2.5 L142,2.5 L136,10 L129,5.5 L120,15 L111,5.5 L104,10 Z"/>`;
    return s;
  }
  // la face : la vue 3D sur toute la carte, le reflet arc-en-ciel, le cadre, la rareté, et l'adresse sur des plaques de néon
  // (le numéro à part, quand il y en a un) ; les chiffres ne sont plus sur la carte (voir chiffres)
  function html(s) {
    // s : { r, rarete, nom, commune } (et valeur, loyer, potentiel, standing pour chiffres)
    const m = /^(\d+(?:\s?(?:bis|ter|quater))?)\s+(.+)$/i.exec(s.nom), num = m ? m[1] : '', voie = m ? m[2] : s.nom;
    return `<div class="cl neon r${s.r}"><canvas class="cl-vue"></canvas><i class="cl-rayons"></i><i class="cl-holo"></i><i class="cl-grain"></i>` +
      `<svg class="cl-cadre" viewBox="0 0 240 350" preserveAspectRatio="none">${cadre(s.r)}</svg>` +
      `<div class="cl-rar"><span>${s.rarete}</span></div>` +
      `<div class="cl-nom">${num ? `<div class="plaque-neon num">${num}</div>` : ''}<div class="plaque-neon voie${voie.length > 34 ? ' tres-long' : (voie.length > 20 ? ' long' : '')}">${s.commune ? `<small>${s.commune}</small>` : ''}<span>${voie}</span></div></div></div>`;
  }
  // les chiffres du lieu, sous la carte ouverte en grand (Gautier, 16 nov. : plus sur la carte)
  function chiffres(s) {
    return `<div class="cl-chiffres"><div><b>${s.valeur}</b><i>Valeur</i></div><div><b>+${s.loyer}</b><i>Loyer / jour</i></div><div><b>${s.potentiel}</b><i>Potentiel</i></div><div><b class="etoiles">${'★'.repeat(s.standing)}<span>${'★'.repeat(Math.max(0, 3 - s.standing))}</span></b><i>Standing</i></div></div>`;
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
    const porcelaine = new THREE.MeshStandardMaterial({ color: 0x1B2A78, emissive: 0x0A1244, roughness: 0.42, metalness: 0.25, side: THREE.DoubleSide });   // (du verre de nuit, depuis le 16 nov.)
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
    if (!e) { const maitre = maquetteMonument(THREE, m, lieu); e = { maitre, pieces: pieces(maitre), copies: new Set(), fait: 0, geos: [], aretes: new THREE.LineBasicMaterial({ color: 0xFFDDF4, transparent: true, opacity: 0.9 }) }; }
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
  const api = { donnees, scene, html, chiffres, animer, prechauffer, COULEURS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.CarteLieu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
