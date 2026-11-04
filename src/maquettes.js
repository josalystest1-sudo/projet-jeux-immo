// Les maquettes 3D des monuments sur la carte (phase 10.4 des graphismes ; docs/BIBLE-GRAPHIQUE.md § 8).
// Style « jeu mobile coloré » (choix de Gautier) : formes simples et épaisses, ombres franches façon dessin animé
// (MeshToonMaterial), un contour encre (une coque inversée, un peu plus grande), l'or pour les lumières.
// Tout est construit en code avec Three.js, à la vraie taille (en mètres) : aucun fichier de modèle.
// La couche est une « custom layer » MapLibre, sans animation : elle ne redessine que quand la carte bouge
// (la carte doit pouvoir se reposer, CLAUDE.md).
(function (racine) {
  const ENCRE = 0x17233F;
  // Le contour : une coque d'encre un peu plus grande que la pièce. Deux coques par pièce : épaisse de loin (1,6 m, soit
  // 1 à 2 pixels aux zooms 15-16) et fine de près (0,5 m) ; une seule est visible selon le zoom (une coque de taille fixe
  // deviendrait trop épaisse de près et laisserait des traits aux jointures).
  const CONTOUR_LOIN = 1.6, CONTOUR_PRES = 0.5, ZOOM_PRES = 16.8;
  // la lumière, douce : sur une face éclairée, ciel + soleil ≈ 1,2 (au-delà, la pierre claire devenait toute blanche)
  const LUMIERE = { ciel: 0.5, soleil: 0.72 };

  // ---------------------------------------------------------------- les briques de construction
  function atelier(THREE) {
    // trois tons francs (le dessin animé) : ombre, milieu, lumière
    const tons = new Uint8Array([95, 95, 95, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
    const degrade = new THREE.DataTexture(tons, 3, 1, THREE.RGBAFormat);
    degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.generateMipmaps = false; degrade.needsUpdate = true;
    // Dans la couche de la carte, le sens des faces n'est pas fiable (la projection de la carte le retourne, et pas toujours
    // de la même façon selon l'angle : des faces disparaissaient, d'autres devenaient sombres ; 3 nov. 2026). Rien ne doit
    // donc en dépendre :
    // - chaque pièce se dessine des deux côtés, et sa lumière se calcule toujours avec la normale vers l'extérieur
    //   (Three.js retourne la normale d'une face vue « de dos » : on annule ce retournement) ;
    // - le contour (la coque d'encre, un peu plus grande) se dessine d'abord, des deux côtés, sans écrire la profondeur ;
    //   les pièces se posent ensuite par-dessus : l'encre ne reste visible que sur leur pourtour.
    const matiere = (couleur, lumiere) => { const m = new THREE.MeshToonMaterial({ color: couleur, gradientMap: degrade, emissive: lumiere || 0x000000, side: THREE.DoubleSide });
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', ['#include <normal_fragment_begin>', '#ifdef DOUBLE_SIDED', '  normal = normal * faceDirection;', '#endif'].join('\n')); };
      return m; };
    const encre = new THREE.MeshBasicMaterial({ color: ENCRE, side: THREE.DoubleSide, depthWrite: false });
    const groupe = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const qY = (a) => (a ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a) : null);
    // une pièce et ses deux contours : fab(e) fabrique la forme grossie de e mètres (e = 0 : la pièce elle-même).
    // sansContour : pour une forme creuse (une voûte), dont la coque passerait trop près de la pierre (scintillements)
    const piece = (fab, mat, position, rotation, sansContour) => {
      const objets = [new THREE.Mesh(fab(0), mat)];
      if (!sansContour) { const loin = new THREE.Mesh(fab(CONTOUR_LOIN), encre), pres = new THREE.Mesh(fab(CONTOUR_PRES), encre);
        loin.userData.contour = 'loin'; pres.userData.contour = 'pres'; pres.visible = false; loin.renderOrder = pres.renderOrder = -1; objets.push(loin, pres); }
      for (const o of objets) { if (position) o.position.copy(position); if (rotation) o.quaternion.copy(rotation); groupe.add(o); }
      return objets[0];
    };
    // une poutre à section carrée, d'un point à un autre, plus fine en haut
    const poutre = (a, b, la, lb, mat) => {
      const d = new THREE.Vector3().subVectors(b, a), h = d.length(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
      return piece((e) => new THREE.CylinderGeometry(lb / Math.SQRT2 + e, la / Math.SQRT2 + e, h + 2 * e, 4, 1).rotateY(Math.PI / 4), mat, new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q);
    };
    // une dalle (boîte carrée) centrée sur l'axe, à une hauteur
    const dalle = (cote, ep, y, mat) => piece((e) => new THREE.BoxGeometry(cote + 2 * e, ep + 2 * e, cote + 2 * e), mat, V(0, y + ep / 2, 0));
    // un tronc carré qui s'amincit (la flèche de la tour)
    const tronc = (cb, ch, y0, y1, mat) => { const h = y1 - y0; return piece((e) => new THREE.CylinderGeometry(ch / Math.SQRT2 + e, cb / Math.SQRT2 + e, h + 2 * e, 4, 1).rotateY(Math.PI / 4), mat, V(0, y0 + h / 2, 0)); };
    // une arche (un demi-anneau aplati) sur une face
    const arche = (rayon, ep, y, decalage, angle, mat) => piece((e) => new THREE.TorusGeometry(rayon, ep + e, 6, 20, Math.PI).scale(1, 0.62, 1).translate(0, 0, decalage).rotateY(angle), mat, V(0, y, 0));
    // une boîte posée au sol (y = sa base)
    const boite = (lx, ly, lz, x, y, z, mat, rotY) => piece((e) => new THREE.BoxGeometry(lx + 2 * e, ly + 2 * e, lz + 2 * e).translate(0, ly / 2, 0), mat, V(x, y, z), qY(rotY));
    // un toit à deux pans : largeur, hauteur, longueur ; le faîte suit l'axe x (rotY = π/2 : l'axe z)
    const toit = (larg, haut, long, x, y, z, mat, rotY) => piece((e) => { const f = new THREE.Shape(); f.moveTo(-larg / 2 - e, -e); f.lineTo(larg / 2 + e, -e); f.lineTo(0, haut + e); f.closePath();
      const g = new THREE.ExtrudeGeometry(f, { depth: long + 2 * e, bevelEnabled: false }); g.translate(0, 0, -(long / 2 + e)); g.rotateY(Math.PI / 2); return g; }, mat, V(x, y, z), qY(rotY));
    // un dôme : une demi-sphère, étirée en hauteur (etire = hauteur / rayon)
    const dome = (r, etire, x, y, z, mat) => piece((e) => new THREE.SphereGeometry(r + e, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, etire, 1), mat, V(x, y, z));
    const cylindre = (rh, rb, h, seg, x, y, z, mat) => piece((e) => new THREE.CylinderGeometry(rh + e, rb + e, h + 2 * e, seg).translate(0, h / 2, 0), mat, V(x, y, z));
    const pyramide = (r, h, seg, x, y, z, mat) => piece((e) => new THREE.ConeGeometry(r + e, h + 2 * e, seg).rotateY(Math.PI / seg).translate(0, h / 2, 0), mat, V(x, y, z));
    const boule = (r, x, y, z, mat) => piece((e) => new THREE.SphereGeometry(r + e, 16, 10), mat, V(x, y, z));
    // une abside (demi-tour ronde) et son toit en demi-cône, tournées vers +x
    const abside = (r, h, x, y, z, mat) => piece((e) => new THREE.CylinderGeometry(r + e, r + e, h + 2 * e, 18, 1, false, 0, Math.PI).translate(0, h / 2, 0), mat, V(x, y, z));
    const demiCone = (r, h, x, y, z, mat) => piece((e) => new THREE.ConeGeometry(r + e, h + 2 * e, 18, 1, false, 0, Math.PI).translate(0, h / 2, 0), mat, V(x, y, z));
    // une forme dessinée de face (Shape, plan xy), épaissie le long de z ; le contour est la même forme un peu agrandie
    const extrusion = (forme, prof, x, y, z, mat, rotY, sansContour) => piece((e) => {
      const g = new THREE.ExtrudeGeometry(forme, { depth: prof, bevelEnabled: false, curveSegments: 14 }); g.translate(0, 0, -prof / 2); if (!e) return g;
      g.computeBoundingBox(); const bb = g.boundingBox, t = new THREE.Vector3(); bb.getSize(t); const my = (bb.min.y + bb.max.y) / 2, mx = (bb.min.x + bb.max.x) / 2;
      return g.translate(-mx, -my, 0).scale(1 + 2 * e / t.x, 1 + 2 * e / t.y, 1 + 2 * e / t.z).translate(mx, my, 0); }, mat, V(x, y, z), qY(rotY), sansContour);
    // une arche dessinée : largeur, hauteur du sommet (plein cintre)
    const formeArche = (larg, haut) => { const r = larg / 2, f = new THREE.Shape(); f.moveTo(-r, 0); f.lineTo(r, 0); f.lineTo(r, haut - r); f.absarc(0, haut - r, r, 0, Math.PI, false); f.lineTo(-r, 0); return f; };
    // un comble à quatre pans : une pyramide sur un rectangle lx × lz, de hauteur h (les pavillons)
    const combles = (lx, h, lz, x, y, z, mat) => piece((e) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(lx + 2 * e, h + 2 * e, lz + 2 * e).translate(0, -e, 0), mat, V(x, y, z));
    // une plaque sans contour (vitraux, drapeau, marquise) : trop fine pour un trait d'encre
    const plaque = (lx, ly, lz, x, y, z, mat, rotY) => piece(() => new THREE.BoxGeometry(lx, ly, lz).translate(0, ly / 2, 0), mat, V(x, y, z), qY(rotY), true);
    // -- ajouts du 4 nov. 2026 (nuit) : des pièces répétées réunies en une seule forme (une colonnade, des tours, des
    // créneaux) : la carte graphique les dessine d'un coup ; et quelques formes de plus
    const fusion = (geos) => { const gs = geos.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; for (const g of gs) n += g.attributes.position.array.length;
      const pos = new Float32Array(n), nor = new Float32Array(n); let o = 0;
      for (const g of gs) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g; };
    const angleDe = (ax, az, bx, bz) => Math.atan2(-(bz - az), bx - ax);
    const fusionnee = (m) => { m.userData.fusion = true; return m; };   // (repérée par les essais : sa boîte englobe toutes ses pièces)
    // des cylindres : [x, z, r, h, y (base), rb (rayon du bas)] ; seg côtés
    const cylindres = (liste, mat, seg) => fusionnee(piece((e) => fusion(liste.map(([x, z, r, h, y, rb]) => new THREE.CylinderGeometry(r + e, (rb || r) + e, h + 2 * e, seg || 12).translate(x, (y || 0) + h / 2, z))), mat));
    // des cônes (toits de tours) : [x, z, r, y (base), h]
    const cones = (liste, mat, seg) => fusionnee(piece((e) => fusion(liste.map(([x, z, r, y, h]) => new THREE.ConeGeometry(r + e, h + 2 * e, seg || 16).translate(x, y + h / 2, z))), mat));
    // des boîtes : [lx, ly, lz, x, y, z, rotY]
    const boites = (liste, mat) => fusionnee(piece((e) => fusion(liste.map(([lx, ly, lz, x, y, z, r]) => new THREE.BoxGeometry(lx + 2 * e, ly + 2 * e, lz + 2 * e).translate(0, ly / 2, 0).rotateY(r || 0).translate(x, y, z))), mat));
    // des plaques sans contour (fenêtres) : [lx, ly, lz, x, y, z, rotY]
    const plaques = (liste, mat) => fusionnee(piece(() => fusion(liste.map(([lx, ly, lz, x, y, z, r]) => new THREE.BoxGeometry(lx, ly, lz).translate(0, ly / 2, 0).rotateY(r || 0).translate(x, y, z))), mat, null, null, true));
    // des combles à quatre pans : [lx, h, lz, x, y, z, rotY]
    const comblesN = (liste, mat) => fusionnee(piece((e) => fusion(liste.map(([lx, h, lz, x, y, z, r]) => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(lx + 2 * e, h + 2 * e, lz + 2 * e).translate(0, -e, 0).rotateY(r || 0).translate(x, y, z))), mat));
    // des toits à deux pans : [larg, haut, long, x, y, z, rotY] (le faîte suit x, comme toit)
    const formeToit = (larg, haut, long, e) => { const f = new THREE.Shape(); f.moveTo(-larg / 2 - e, -e); f.lineTo(larg / 2 + e, -e); f.lineTo(0, haut + e); f.closePath();
      const g = new THREE.ExtrudeGeometry(f, { depth: long + 2 * e, bevelEnabled: false }); g.translate(0, 0, -(long / 2 + e)); g.rotateY(Math.PI / 2); return g; };
    const toits = (liste, mat) => fusionnee(piece((e) => fusion(liste.map(([larg, haut, long, x, y, z, r]) => formeToit(larg, haut, long, e).rotateY(r || 0).translate(x, y, z))), mat));
    // un dôme carré (les pavillons du Louvre) : base lx × lz, hauteur h
    const domeCarre = (lx, h, lz, x, y, z, mat) => piece((e) => new THREE.SphereGeometry(Math.SQRT1_2, 4, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateY(Math.PI / 4).scale(lx + 2 * e, (h + 2 * e) / Math.SQRT1_2, lz + 2 * e).translate(0, -e, 0), mat, V(x, y, z));
    // des murs le long de lignes (listes de points [x, z]), hauts de h, épais de ep
    const remparts = (lignes, h, ep, mat, y0) => fusionnee(piece((e) => { const gs = [];
      for (const pts of lignes) for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
        gs.push(new THREE.BoxGeometry(L + ep + 2 * e, h + 2 * e, ep + 2 * e).translate(0, h / 2 + (y0 || 0), 0).rotateY(angleDe(ax, az, bx, bz)).translate((ax + bx) / 2, 0, (az + bz) / 2)); }
      return fusion(gs); }, mat));
    // des créneaux le long de lignes, posés à la hauteur y (sans contour : trop découpés pour un trait d'encre)
    const peigne = (L, h) => { const n = Math.max(2, Math.round(L / 2.4)), w = L / (2 * n - 1), f = new THREE.Shape(); f.moveTo(-L / 2, 0);
      for (let i = 0; i < n; i++) { const a = -L / 2 + 2 * i * w; f.lineTo(a, h); f.lineTo(a + w, h); if (i < n - 1) { f.lineTo(a + w, h * 0.45); f.lineTo(a + 2 * w, h * 0.45); } }
      f.lineTo(L / 2, 0); f.closePath(); return f; };
    const creneaux = (lignes, y, ep, mat) => fusionnee(piece(() => { const gs = [];
      for (const pts of lignes) for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
        gs.push(new THREE.ExtrudeGeometry(peigne(L, 1.8), { depth: ep, bevelEnabled: false }).translate(0, 0, -ep / 2).rotateY(angleDe(ax, az, bx, bz)).translate((ax + bx) / 2, y, (az + bz) / 2)); }
      return fusion(gs); }, mat, null, null, true));
    // le tour d'un rectangle, pour ses créneaux
    const tourDe = (lx, lz, x, z) => [[x - lx / 2, z - lz / 2], [x + lx / 2, z - lz / 2], [x + lx / 2, z + lz / 2], [x - lx / 2, z + lz / 2], [x - lx / 2, z - lz / 2]];
    // une ogive dessinée (arc brisé) : largeur, hauteur du sommet
    const formeOgive = (larg, haut) => { const r = larg / 2, y0 = haut - larg * 0.85, f = new THREE.Shape(); f.moveTo(-r, 0); f.lineTo(r, 0); f.lineTo(r, y0);
      f.quadraticCurveTo(r, y0 + larg * 0.55, 0, haut); f.quadraticCurveTo(-r, y0 + larg * 0.55, -r, y0); f.closePath(); return f; };
    return { THREE, groupe, matiere, V, piece, poutre, dalle, tronc, arche, boite, toit, dome, cylindre, pyramide, boule, abside, demiCone, extrusion, formeArche, combles, plaque,
      fusion, cylindres, cones, boites, plaques, comblesN, toits, domeCarre, remparts, creneaux, tourDe, formeOgive };
  }

  // ---------------------------------------------------------------- la tour Eiffel (330 m), d'après ses vraies proportions
  // base 125 m, premier étage à 57 m, deuxième à 115 m, sommet à 276 m, antenne jusqu'à 330 m
  function tourEiffel(THREE) {
    const A = atelier(THREE), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const bronze = A.matiere(0xC98552), bronzeFonce = A.matiere(0x9A5B33), or = A.matiere(0xFFC233, 0x7A4A00), lumiere = A.matiere(0xFFE27A, 0xFFB800);
    // les quatre pieds, courbes (trois tronçons chacun), du sol au premier étage
    const pied = (t) => { const k = 1 - t; return { r: 52 * k * k + 2 * 27 * t * k + 24 * t * t, y: 57 * t }; };   // courbe de Bézier : 52 m → 24 m
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let i = 0; i < 3; i++) {
        const a = pied(i / 3), b = pied((i + 1) / 3), la = 17 - i * 3.2, lb = 17 - (i + 1) * 3.2;
        A.poutre(V(sx * a.r, a.y, sz * a.r), V(sx * b.r, b.y, sz * b.r), la, lb, bronze);
      }
    }
    // les quatre arches entre les pieds
    for (let k = 0; k < 4; k++) A.arche(37, 2.6, 12, 44, k * Math.PI / 2, bronzeFonce);
    // le premier étage, bordé d'or
    A.dalle(74, 6, 55, bronzeFonce); A.dalle(77, 1.8, 61, or);
    // du premier au deuxième étage : quatre pieds plus fins qui se rejoignent
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.poutre(V(sx * 26, 62, sz * 26), V(sx * 15, 115, sz * 15), 10, 6.5, bronze);
    A.dalle(40, 4, 113, bronzeFonce); A.dalle(43, 1.6, 117, or);
    // la flèche, avec des ceintures qui dessinent le treillis
    A.tronc(26, 7, 118.6, 272, bronze);
    for (const [y, c] of [[150, 22.5], [185, 18], [220, 13.5], [250, 10]]) A.dalle(c, 2.2, y, bronzeFonce);
    // le sommet : la loge dorée, le campanile, l'antenne, un feu au bout
    A.dalle(14, 7, 270, or); A.tronc(9, 3, 277, 290, bronzeFonce);
    A.piece((e) => new THREE.CylinderGeometry(0.9 + e, 1.4 + e, 40 + 2 * e, 6), bronzeFonce, V(0, 310, 0));
    A.boule(2.6, 0, 331, 0, lumiere);
    return A.groupe;
  }

  // ---------------------------------------------------------------- les cathédrales gothiques (un modèle réglable)
  // x : l'axe de la nef, la façade à l'ouest en -x. Réglages : F (x du centre des tours), E (x du centre de l'abside),
  // larg (largeur de la nef), mur (hauteur des murs), toitH (hauteur du toit), toit (sa couleur), xT (le transept),
  // transept (sa longueur), tours [{ z, h, fleche (hauteur de la flèche au-dessus de la tour, 0 : tour plate), r (rayon
  // de la flèche) }], cote (largeur d'une tour), facadeH (hauteur de la façade entre les tours), rose (rayon de la rosace),
  // flecheCroisee ({ h } : la flèche au-dessus du transept), arcs (des arcs-boutants).
  // Ajoutés le 4 nov. 2026 : transeptL (largeur du transept, 14 m), roseY (hauteur de la rosace) ; pour une tour : x et
  // cote (si elle diffère des autres), octogone ({ h, r } : un étage octogonal et ses quatre tourelles ; sans flèche, une
  // couronne de pinacles), seg (côtés de la flèche), couleur (de la flèche) ; flecheCroisee : r, seg, couleur, tour
  // (hauteur d'une tour-lanterne au-dessus du faîte) et cote (sa largeur) ; plus(A, matières) : des pièces en plus
  function cathedrale(THREE, o) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(o.pierre || 0xF0E3C4), pierreFoncee = A.matiere(o.pierreFoncee || 0xD2BC8E), toit = A.matiere(o.toit || 0x5E70A3), toitFonce = A.matiere(o.toitFonce || 0x46567F),
      or = A.matiere(0xFFC233, 0x7A4A00), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    const debut = o.F + o.cote / 2 + 3, long = o.E - debut, cx = (debut + o.E) / 2, demi = o.larg / 2;
    // la nef et le chœur, les bas-côtés, le transept, l'abside
    A.boite(long, o.mur, o.larg, cx, 0, 0, pierre); A.toit(o.larg + 1, o.toitH, long, cx, o.mur, 0, toit);
    const bas = Math.round(o.mur * 0.53), bc = Math.max(7, o.larg * 0.28);
    for (const s of [1, -1]) A.boite(long - 8, bas, bc, cx, 0, s * (demi + bc / 2 - 1), pierreFoncee);
    const tL = o.transeptL || 14;
    A.boite(tL, o.mur, o.transept, o.xT, 0, 0, pierre); A.toit(tL, o.toitH, o.transept, o.xT, o.mur, 0, toit, Math.PI / 2);
    A.abside(demi, o.mur, o.E, 0, 0, pierre); A.demiCone(demi + 0.5, o.toitH - 1, o.E, o.mur, 0, toit);
    // des arcs-boutants de chaque côté (pas devant le transept)
    if (o.arcs !== false) for (let x = debut + 10; x < o.E - 4; x += 15.5) { if (Math.abs(x - o.xT) < tL / 2 + 3) continue;
      for (const s of [1, -1]) { const zp = demi + bc + 2; A.boite(3, o.mur * 0.6, 3, x, 0, s * zp, pierreFoncee); A.poutre(V(x, o.mur * 0.57, s * zp), V(x, o.mur * 0.93, s * (demi + 0.5)), 2, 1.6, pierreFoncee); } }
    // les tours de la façade (plates, ou coiffées d'une flèche), la façade entre elles, la rosace, les portails
    for (const t of o.tours) {
      const tx = t.x !== undefined ? t.x : o.F, c = t.cote || o.cote; let haut = t.h;
      A.boite(c, t.h, c, tx, 0, t.z, pierre); A.boite(c + 1.5, 2.2, c + 1.5, tx, t.h - 6, t.z, pierreFoncee);
      if (t.octogone) {
        const r = t.octogone.r; A.cylindre(r, r, t.octogone.h, 8, tx, t.h, t.z, pierre); A.cylindre(r + 0.8, r + 0.8, 1.6, 8, tx, t.h + t.octogone.h - 1.6, t.z, pierreFoncee);
        for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.cylindre(1.4, 1.4, t.octogone.h - 2, 8, tx + dx * r * 0.75, t.h, t.z + dz * r * 0.75, pierreFoncee);
        haut += t.octogone.h;
        if (!t.fleche) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; A.pyramide(0.9, 4, 4, tx + Math.cos(a) * r * 0.85, haut, t.z + Math.sin(a) * r * 0.85, pierreFoncee); }
      }
      if (t.fleche) { A.pyramide(t.r || c * 0.42, t.fleche, t.seg || 8, tx, haut, t.z, t.couleur ? A.matiere(t.couleur) : toitFonce); A.boule(1.4, tx, haut + t.fleche + 1, t.z, or); }
      else if (!t.octogone) for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.pyramide(1.6, 6, 4, tx + dx * (c / 2 - 1.6), t.h, t.z + dz * (c / 2 - 1.6), pierreFoncee);
      A.extrusion(A.formeArche(c * 0.33, c * 0.62), 0.8, tx - c / 2 - 0.2, 0, t.z, porte, Math.PI / 2);
    }
    const ecart = o.tours.length > 1 ? Math.abs(o.tours[0].z - o.tours[1].z) - o.cote : o.larg;
    const zc = o.tours.length > 1 ? (o.tours[0].z + o.tours[1].z) / 2 : 0;
    if (o.tours.length > 1) { A.boite(14, o.facadeH, ecart + 0.2, o.F + 2, 0, zc, pierre); A.boite(15, 2, ecart + 0.2, o.F + 2, o.facadeH, zc, pierreFoncee); }
    else A.boite(10, o.facadeH, o.larg, o.F + 3, 0, 0, pierre);
    const xFace = (o.tours.length > 1 ? o.F + 2 - 7 : o.F + 3 - 5) - 0.4, t0 = o.tours[0];
    const zRose = o.tours.length > 1 ? zc : (t0.z < 0 ? (t0.z + o.cote / 2 + demi) / 2 : (t0.z - o.cote / 2 - demi) / 2);
    A.piece((e) => new THREE.CylinderGeometry(o.rose + e, o.rose + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, V(xFace, o.roseY || o.facadeH * 0.68, zRose));
    A.extrusion(A.formeArche(o.cote * 0.42, o.cote * 0.78), 0.8, xFace - 0.2, 0, zRose, porte, Math.PI / 2);
    // la flèche à la croisée du transept, et son coq doré
    if (o.flecheCroisee) {
      const fc = o.flecheCroisee, seg = fc.seg || 4; let y = o.mur + o.toitH - 1;
      if (fc.tour) {   // une tour-lanterne à la croisée, la flèche dessus
        const c = fc.cote || 12; y += fc.tour;
        if (seg === 8) { A.cylindre(c / 2, c / 2, y - o.mur, 8, o.xT, o.mur, 0, pierre); A.cylindre(c / 2 + 0.8, c / 2 + 0.8, 1.6, 8, o.xT, y - 1.6, 0, pierreFoncee); }
        else { A.boite(c, y - o.mur, c, o.xT, o.mur, 0, pierre); A.boite(c + 1.5, 1.6, c + 1.5, o.xT, y - 1.6, 0, pierreFoncee); }
      }
      A.pyramide(fc.r || 4.5, fc.h, seg, o.xT, y, 0, fc.couleur ? A.matiere(fc.couleur) : toitFonce); A.boule(1.8, o.xT, y + fc.h + 1, 0, or);
    }
    if (o.plus) o.plus(A, { pierre, pierreFoncee, toit, toitFonce, or, vitrail, porte });
    return A.groupe;
  }
  // Notre-Dame de Paris : toit de plomb, deux tours de 66 m, la flèche (96 m) et son coq
  const notreDame = (THREE) => cathedrale(THREE, { F: -64, E: 53, larg: 32, mur: 30, toitH: 14, xT: 12, transept: 54, cote: 20, facadeH: 44, rose: 6,
    tours: [{ z: 15, h: 66 }, { z: -15, h: 66 }], flecheCroisee: { h: 50 } });
  // Chartres : le toit de cuivre vert, deux flèches différentes (le clocher vieux, 105 m ; le clocher neuf, plus fin, 113 m)
  const chartres = (THREE) => cathedrale(THREE, { F: -62, E: 55, larg: 32, mur: 32, toitH: 16, toit: 0x5FA58A, toitFonce: 0x4B8A72, xT: 8, transept: 64, cote: 16, facadeH: 40, rose: 6.5,
    tours: [{ z: -12, h: 45, fleche: 60, r: 7.5 }, { z: 12, h: 50, fleche: 63, r: 5.6 }] });
  // Reims : deux tours de 81 m, plates et hérissées de pinacles, la grande façade et sa rosace
  const reims = (THREE) => cathedrale(THREE, { F: -58, E: 52, larg: 34, mur: 38, toitH: 15, xT: 18, transept: 60, cote: 20, facadeH: 54, rose: 7.5, pierre: 0xEFE5CF,
    tours: [{ z: 14, h: 81 }, { z: -14, h: 81 }] });
  // la basilique Saint-Denis : une seule tour (au sud ; celle du nord a été démontée en 1846)
  const saintDenis = (THREE) => cathedrale(THREE, { F: -49, E: 43, larg: 28, mur: 28, toitH: 12, xT: 10, transept: 46, cote: 14, facadeH: 34, rose: 5,
    tours: [{ z: -9, h: 58 }] });

  // ---------------------------------------------------------------- le Panthéon (x : l'axe, le portique à l'ouest en -x)
  // le corps en croix grecque aux murs pleins, le portique à colonnes et son fronton, le grand dôme sur son tambour à
  // colonnes, la lanterne et la croix
  function pantheon(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xEFE7D6), pierreFoncee = A.matiere(0xD6CBB0), plomb = A.matiere(0x98A4C2), or = A.matiere(0xFFC233, 0x7A4A00);
    const X = 12;   // la croisée, sous le dôme
    A.boite(84, 28, 38, X, 0, 0, pierre); A.boite(38, 28, 84, X, 0, 0, pierre); A.boite(85, 2, 39, X, 28, 0, pierreFoncee); A.boite(39, 2, 85, X, 28, 0, pierreFoncee);
    A.boite(22, 2.5, 46, -41, 0, 0, pierreFoncee);
    for (let k = 0; k < 6; k++) A.cylindre(1.1, 1.3, 18, 12, -50, 2.5, -17.5 + k * 7, pierre);
    for (const s of [1, -1]) A.cylindre(1.1, 1.3, 18, 12, -40, 2.5, s * 17.5, pierre);
    A.boite(22, 4, 42, -41, 20.5, 0, pierreFoncee); A.toit(42, 9, 22, -41, 24.5, 0, pierre);
    A.boite(36, 6, 36, X, 30, 0, pierre); A.cylindre(15, 15, 20, 28, X, 36, 0, pierre);
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; A.cylindre(0.8, 0.8, 18, 8, X + Math.cos(a) * 16.5, 36, Math.sin(a) * 16.5, pierre); }
    A.cylindre(17.5, 17.5, 2, 28, X, 54, 0, pierreFoncee); A.cylindre(13, 13, 6, 28, X, 56, 0, pierre); A.dome(13, 1.35, X, 62, 0, plomb);
    A.cylindre(2.6, 2.6, 6, 12, X, 79, 0, pierre); A.dome(2.6, 1.4, X, 85, 0, plomb); A.boite(0.9, 5, 0.9, X, 88.6, 0, or); A.boite(3.2, 0.9, 0.9, X, 91.4, 0, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- l'Opéra Garnier (x : l'axe, la façade au sud en -x)
  // le corps de pierre dorée, la façade et ses pavillons coiffés de groupes dorés, la coupole de cuivre vert de la salle,
  // la cage de scène et son fronton, l'Apollon doré, les petites coupoles des côtés
  function garnier(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEBD3A2), pierreFoncee = A.matiere(0xD2B47C), cuivre = A.matiere(0x5DAF8C), cuivreFonce = A.matiere(0x478E70), or = A.matiere(0xFFC233, 0x7A4A00), ombre = A.matiere(0x6E5A44);
    A.boite(126, 25, 92, 2, 0, 0, pierre); A.boite(127, 1.8, 93, 2, 25, 0, pierreFoncee);
    A.boite(15, 30, 96, -64, 0, 0, pierre); A.boite(16, 2, 97, -64, 30, 0, pierreFoncee);
    for (let k = 0; k < 7; k++) A.extrusion(A.formeArche(7, 11), 0.8, -71.8, 0, -36 + k * 12, ombre, Math.PI / 2);
    for (const s of [1, -1]) { A.boite(15, 34, 14, -64, 0, s * 44, pierre); A.dome(5.5, 0.9, -64, 34, s * 44, cuivre); A.cylindre(0.9, 2.6, 7, 8, -64, 38.5, s * 44, or); }
    A.cylindre(27, 27, 8, 32, -12, 25, 0, pierre); A.dome(27, 0.45, -12, 33, 0, cuivre); A.cylindre(3, 3, 3, 12, -12, 45, 0, or);
    A.boite(42, 22, 60, 26, 25, 0, pierre); A.toit(60, 14, 42, 26, 47, 0, cuivreFonce);   // le fronton face à la façade
    A.cylindre(1.2, 2.2, 6, 8, 5, 60, 0, or); A.boule(1.8, 5, 66.5, 0, or);
    for (const s of [1, -1]) { A.boite(26, 22, 14, -12, 0, s * 52, pierre); A.dome(7, 0.8, -12, 22, s * 52, cuivre); }
    return A.groupe;
  }

  // ---------------------------------------------------------------- la place de la Concorde (x : vers le nord)
  // l'obélisque de Louxor sur son socle, son pyramidion doré ; les deux fontaines, au nord et au sud
  function concorde(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xD9A88A), socle = A.matiere(0x9A97A6), pierre = A.matiere(0xE9DFC9), eau = A.matiere(0x6DC4F0, 0x0E3A55), or = A.matiere(0xFFC233, 0x7A4A00), bronze = A.matiere(0x5E8F6E);
    A.boite(5.5, 2, 5.5, 0, 0, 0, socle); A.boite(4.2, 7, 4.2, 0, 2, 0, socle);
    A.piece((e) => new THREE.CylinderGeometry(1.15 + e, 1.75 + e, 21 + 2 * e, 4).rotateY(Math.PI / 4).translate(0, 10.5, 0), granit, A.V(0, 9, 0));
    A.pyramide(1.2, 2.6, 4, 0, 30, 0, or);
    for (const s of [1, -1]) {
      A.cylindre(10, 10, 1.2, 32, s * 48, 0, 0, pierre); A.cylindre(9.2, 9.2, 0.4, 32, s * 48, 0.9, 0, eau);
      A.cylindre(1.2, 1.6, 7, 12, s * 48, 1, 0, bronze); A.cylindre(4.2, 1.4, 1.2, 20, s * 48, 3.6, 0, bronze); A.cylindre(2.4, 0.9, 1, 16, s * 48, 6.4, 0, bronze); A.boule(0.9, s * 48, 8.4, 0, or);
    }
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Pont du Gard (x : l'axe du pont)
  // trois rangs d'arches de pierre dorée (6, 11 et 35), 49 m de haut ; la carte est plate : là où le rang du dessous
  // s'arrête, les piles descendent jusqu'au sol
  function pontDuGard(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE8C98A), pierreFoncee = A.matiere(0xCFAE6E);
    const rangs = [{ n: 6, L: 142, h: 21.9, ep: 6, p: 4, dessus: 2.5 }, { n: 11, L: 242, h: 19.5, ep: 4.6, p: 3, dessus: 2 }, { n: 35, L: 275, h: 7.4, ep: 3, p: 1.2, dessus: 1.6 }];
    let base = 0, Lbas = 0;
    for (const r of rangs) {
      const s = (r.L - (r.n + 1) * r.p) / r.n, rayon = s / 2, naissance = base + r.h - r.dessus - rayon;
      for (let i = 0; i <= r.n; i++) { const x = -r.L / 2 + r.p / 2 + i * (s + r.p), pied = Math.abs(x) > Lbas / 2 ? 0 : base;
        A.boite(r.p, naissance - pied + rayon, r.ep, x, pied, 0, pierre); }
      for (let i = 0; i < r.n; i++) { const xc = -r.L / 2 + r.p + rayon + i * (s + r.p), f = new THREE.Shape();
        f.moveTo(xc - rayon, naissance); f.absarc(xc, naissance, rayon, Math.PI, 0, true); f.lineTo(xc + rayon, naissance + rayon + 0.05); f.lineTo(xc - rayon, naissance + rayon + 0.05); f.closePath();
        A.extrusion(f, r.ep - 0.04, 0, 0, 0, pierre, 0, true); }
      A.boite(r.L, r.dessus, r.ep, 0, base + r.h - r.dessus, 0, pierreFoncee);
      base += r.h; Lbas = r.L;
    }
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Versailles (x : le long de la façade
  // sur les jardins, vers le nord ; z : vers la ville et les cours)
  // la façade des jardins (le corps central et les ailes du Midi et du Nord, toits plats), les ailes des cours aux toits
  // d'ardoise, le vieux château de brique autour de la cour de Marbre, les ailes des Ministres, la chapelle royale, la
  // grille dorée
  function versailles(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF1E3C2), pierreFoncee = A.matiere(0xD8C49C), brique = A.matiere(0xC2583F), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    for (const s of [1, -1]) { A.boite(165, 20, 40, s * 127.5, 0, -25, pierre); A.boite(166, 1.6, 41, s * 127.5, 20, -25, pierreFoncee); }
    A.boite(90, 24, 70, 0, 0, -40, pierre); A.boite(91, 1.6, 71, 0, 24, -40, pierreFoncee);
    for (const s of [1, -1]) { A.boite(20, 20, 66, s * 35, 0, 27, pierre); A.toit(20, 8, 66, s * 35, 20, 27, ardoise, Math.PI / 2); A.boite(0.8, 0.8, 66, s * 35, 28, 27, or); }
    A.boite(50, 21, 20, 0, 0, 5, brique); A.toit(20, 9, 50, 0, 21, 5, ardoise); A.boite(50, 0.8, 0.8, 0, 30, 5, or);
    for (const s of [1, -1]) { A.boite(10, 19, 20, s * 20, 0, 25, brique); A.toit(10, 6, 20, s * 20, 19, 25, ardoise, Math.PI / 2); }
    for (const s of [1, -1]) { A.boite(20, 16, 62, s * 65, 0, 43, pierre); A.toit(20, 7, 62, s * 65, 16, 43, ardoise, Math.PI / 2); }
    A.boite(29, 30, 43, 77.5, 0, 48.5, pierre); A.toit(29, 18, 43, 77.5, 30, 48.5, ardoise, Math.PI / 2); A.boite(0.8, 0.8, 43, 77.5, 48, 48.5, or);
    A.boite(0.8, 6, 0.8, 77.5, 48, 28, or); A.boite(3.2, 0.8, 0.8, 77.5, 52, 28, or);
    A.boite(70, 4, 1, 0, 0, 74, or); for (let k = -1; k <= 1; k += 2) A.boite(4, 7, 4, k * 15, 0, 74, pierreFoncee);
    return A.groupe;
  }

  // ---------------------------------------------------------------- l'Arc de triomphe de l'Étoile (x : la largeur, 45 m ; l'avenue suit z)
  // le corps percé de la grande arche (29 m), la frise, la corniche, l'attique (50 m), les arches des côtés, les groupes sculptés
  function arcDeTriomphe(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF4E2BA), pierreFoncee = A.matiere(0xD7BC8A), ombre = A.matiere(0x7E6E5A);
    // deux piliers et le haut (des boîtes : leur contour reste bien dehors), puis la voûte en plein cintre, sans contour
    for (const s of [1, -1]) A.boite(15.2, 29.2, 22, s * 14.9, 0, 0, pierre);
    A.boite(45, 12.8, 22, 0, 29.2, 0, pierre);
    const voute = new THREE.Shape(); voute.moveTo(-7.3, 21.9); voute.absarc(0, 21.9, 7.3, Math.PI, 0, true); voute.lineTo(7.3, 29.3); voute.lineTo(-7.3, 29.3); voute.closePath();
    A.extrusion(voute, 21.98, 0, 0, 0, pierre, 0, true);
    A.boite(45.8, 2.2, 22.8, 0, 32, 0, pierreFoncee); A.boite(47.5, 2.2, 24.5, 0, 42, 0, pierreFoncee);
    A.boite(45, 6.4, 22, 0, 44.2, 0, pierre); A.boite(46.4, 1.4, 23.4, 0, 50.6, 0, pierreFoncee);
    for (const s of [1, -1]) A.extrusion(A.formeArche(8.4, 18.7), 0.9, s * 22.9, 0, 0, ombre, Math.PI / 2);
    for (const sx of [1, -1]) for (const sz of [1, -1]) A.boite(9, 11, 0.9, sx * 14.9, 4.5, sz * 11.3, pierreFoncee);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Sacré-Cœur de Montmartre (x : l'axe, la façade au sud en -x)
  // tout en pierre blanche : la nef en croix, le porche et ses deux petits dômes, le grand dôme ovoïde et sa lanterne,
  // quatre dômes autour, le campanile au nord, des croix dorées
  function sacreCoeur(THREE) {
    const A = atelier(THREE);
    const blanc = A.matiere(0xF8F3E7), blancOmbre = A.matiere(0xE3D8BF), or = A.matiere(0xFFC233, 0x7A4A00), porte = A.matiere(0x8E9BBE);
    const croix = (x, y) => { A.boite(0.9, 5, 0.9, x, y, 0, or); A.boite(3.2, 0.9, 0.9, x, y + 3, 0, or); };
    A.boite(70, 24, 30, 0, 0, 0, blanc); A.boite(30, 24, 46, 2, 0, 0, blanc); A.boite(71, 1.6, 31, 0, 24, 0, blancOmbre);
    A.boite(12, 20, 34, -40, 0, 0, blanc); A.boite(13, 1.6, 35, -40, 20, 0, blancOmbre);
    for (const z of [-10, 0, 10]) A.extrusion(A.formeArche(6, 12), 0.8, -46.4, 0, z, porte, Math.PI / 2);
    for (const s of [1, -1]) { A.cylindre(4, 4, 6, 16, -40, 21.6, s * 12.5, blanc); A.dome(4, 1.5, -40, 27.6, s * 12.5, blanc); }
    A.cylindre(13, 13, 16, 28, 2, 24, 0, blanc); A.cylindre(13.8, 13.8, 1.6, 28, 2, 38.5, 0, blancOmbre); A.dome(13, 1.55, 2, 40, 0, blanc);
    A.cylindre(3, 3, 7, 14, 2, 59.5, 0, blanc); A.dome(3, 1.4, 2, 66.5, 0, blanc); croix(2, 70.5);
    for (const [dx, dz] of [[13, 15], [13, -15], [-9, 15], [-9, -15]]) { A.cylindre(4.5, 4.5, 7, 16, 2 + dx, 24, dz, blanc); A.dome(4.5, 1.5, 2 + dx, 31, dz, blanc); }
    A.boite(12, 52, 12, 34, 0, 0, blanc); A.boite(13.4, 1.6, 13.4, 34, 52, 0, blancOmbre); A.cylindre(5, 5, 6, 16, 34, 53.6, 0, blanc); A.dome(5, 1.6, 34, 59.6, 0, blanc); croix(34, 67.6);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le palais de l'Élysée (x : de la façade sur le jardin vers
  // la rue du Faubourg-Saint-Honoré ; la cour d'honneur entre les deux ailes)
  // le corps de logis et ses combles d'ardoise, l'avant-corps et son fronton, le perron et sa marquise, les deux ailes,
  // le portail sur la rue, le drapeau tricolore sur le toit
  function elysee(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2E9D4), pierreFoncee = A.matiere(0xD9CCB0), ardoise = A.matiere(0x4F5D8C), porte = A.matiere(0x6E5A44), verre = A.matiere(0xA8CCF0, 0x1E3A5A),
      bleu = A.matiere(0x2D55C8, 0x0A1E5A), blanc = A.matiere(0xF7F7F2, 0x303030), rouge = A.matiere(0xE23B3B, 0x5A0A0A), hampe = A.matiere(0x3A3F55);
    A.boite(18, 15, 86, -21, 0, 0, pierre); A.boite(18.6, 1.2, 86.6, -21, 14.2, 0, pierreFoncee); A.toit(18.6, 7, 86, -21, 15, 0, ardoise, Math.PI / 2);
    A.boite(6, 17, 22, -9, 0, 0, pierre); A.toit(22, 4, 6, -9, 17, 0, pierreFoncee);
    A.boite(5, 1.4, 16, -3.5, 0, 0, pierreFoncee); A.plaque(4, 0.4, 12, -4, 7, 0, verre);
    for (const s of [1, -1]) { A.boite(58, 12, 12, 17, 0, s * 32, pierre); A.toit(12.6, 5, 58, 17, 12, s * 32, ardoise); }
    A.boite(2, 6, 52, 47, 0, 0, pierre); A.boite(6, 13, 12, 47, 0, 0, pierre); A.boite(7, 1.4, 13, 47, 13, 0, pierreFoncee);
    A.extrusion(A.formeArche(5, 9), 0.6, 50.2, 0, 0, porte, Math.PI / 2);
    A.cylindre(0.3, 0.3, 10, 8, -21, 21.5, 0, hampe);
    A.plaque(3, 4.5, 0.25, -19.2, 26.6, 0, bleu); A.plaque(3, 4.5, 0.25, -16.2, 26.6, 0, blanc); A.plaque(3, 4.5, 0.25, -13.2, 26.6, 0, rouge);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la chapelle de la Sorbonne (x : l'axe, la façade à l'ouest
  // en -x, sur la place de la Sorbonne)
  // la nef, le transept et son portique sur la cour d'honneur (au nord, -z), la façade à colonnes et son fronton, le dôme
  // de plomb sur son tambour, sa lanterne, les quatre lanternons autour
  function sorbonne(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD8CBAE), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x7B88B0), or = A.matiere(0xFFC233, 0x7A4A00), porte = A.matiere(0x6E5A44);
    A.boite(49, 19, 19, -2.5, 0, 0, pierre); A.toit(19.6, 7, 49, -2.5, 19, 0, ardoise);   // le chevet est pris dans les bâtiments de la Sorbonne
    A.boite(13, 19, 30, 0, 0, -1, pierre); A.toit(13.6, 7, 30, 0, 19, -1, ardoise, Math.PI / 2);
    A.boite(3, 25, 22, -27.5, 0, 0, pierre); A.toit(22, 5, 3, -27.5, 25, 0, pierreFoncee); A.boite(3.8, 1.2, 22.6, -28, 10, 0, pierreFoncee);
    for (const z of [-7.5, -2.5, 2.5, 7.5]) { A.cylindre(0.6, 0.7, 10, 10, -29.8, 0, z, pierre); A.cylindre(0.5, 0.6, 10, 10, -29.8, 11.2, z, pierre); }
    A.extrusion(A.formeArche(4, 7.5), 0.6, -29.3, 0, 0, porte, Math.PI / 2);
    A.boite(15, 1.2, 5, 0, 0, -18.5, pierreFoncee);
    for (let k = 0; k < 6; k++) A.cylindre(0.65, 0.75, 13, 10, -6 + k * 2.4, 1.2, -19.6, pierre);
    A.boite(15, 1.6, 5, 0, 14.2, -18.5, pierreFoncee); A.toit(15, 4.5, 5, 0, 15.8, -18.5, pierre, Math.PI / 2);
    A.boite(16, 3, 16, 0, 19, 0, pierreFoncee); A.cylindre(7, 7, 9, 28, 0, 22, 0, pierre); A.cylindre(7.6, 7.6, 1, 28, 0, 30.5, 0, pierreFoncee);
    A.dome(7, 1.3, 0, 31.5, 0, plomb); A.cylindre(1.6, 1.6, 3.5, 12, 0, 40, 0, pierre); A.dome(1.6, 1.4, 0, 43.5, 0, plomb);
    A.boite(0.6, 3, 0.6, 0, 45.6, 0, or); A.boite(2, 0.6, 0.6, 0, 47.2, 0, or);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { A.cylindre(1.3, 1.3, 4, 8, dx * 6.6, 22, dz * 6.6, pierre); A.dome(1.3, 1.5, dx * 6.6, 26, dz * 6.6, plomb); }
    return A.groupe;
  }

  // ---------------------------------------------------------------- la Sainte-Chapelle (x : l'axe, la façade à l'ouest en -x)
  // le vaisseau tout en verrières bleues entre ses contreforts, l'abside, le toit d'ardoise très raide et sa crête dorée,
  // la façade, sa rose et son porche, les deux tourelles, la flèche (75 m)
  function sainteChapelle(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE3C6), pierreFoncee = A.matiere(0xD6C29A), ardoise = A.matiere(0x5468A0), ardoiseFoncee = A.matiere(0x3F4F80),
      or = A.matiere(0xFFC233, 0x7A4A00), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    A.boite(25.5, 21, 15, -0.25, 0, 0, pierre); A.abside(7.5, 21, 12.5, 0, 0, pierre);
    A.toit(16, 15, 25.5, -0.25, 21, 0, ardoise); A.demiCone(8, 14, 12.5, 21, 0, ardoise); A.boite(25.5, 0.7, 0.7, -0.25, 35.6, 0, or);
    for (const x of [-12.5, -6, 0.5, 7, 12.5]) for (const s of [1, -1]) { A.boite(1.8, 19, 2.4, x, 0, s * 8.4, pierreFoncee); A.pyramide(1.2, 4, 4, x, 19, s * 8.4, pierreFoncee); }
    for (const x of [-9.25, -2.75, 3.75, 9.75]) for (const s of [1, -1]) A.plaque(4.2, 14, 0.4, x, 4, s * 7.6, vitrail);
    for (const a of [-54, -18, 18, 54]) { const t = a * Math.PI / 180; A.plaque(0.4, 14, 3.4, 12.5 + 7.7 * Math.cos(t), 4, 7.7 * Math.sin(t), vitrail, -t); }
    A.boite(3.5, 24, 15, -14.75, 0, 0, pierre); A.toit(15, 11, 3.5, -14.75, 24, 0, pierre);
    A.piece((e) => new THREE.CylinderGeometry(4 + e, 4 + e, 0.8 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-16.7, 16.5, 0));
    A.boite(4, 8, 15, -18.5, 0, 0, pierreFoncee); A.extrusion(A.formeArche(4, 6.5), 0.6, -20.8, 0, 0, porte, Math.PI / 2);
    for (const s of [1, -1]) { A.cylindre(1.8, 1.8, 30, 8, -14.75, 0, s * 8.3, pierre); A.pyramide(2.1, 7, 8, -14.75, 30, s * 8.3, ardoiseFoncee); A.boule(0.8, -14.75, 37.6, s * 8.3, or); }
    A.cylindre(2.2, 2.2, 6, 8, -1, 34, 0, ardoiseFoncee); A.cylindre(2.6, 2.6, 0.7, 8, -1, 39.6, 0, or);
    A.pyramide(2.3, 33, 8, -1, 40.3, 0, ardoiseFoncee); A.boule(0.9, -1, 74, 0, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- les Invalides (x : vers l'est ; le Dôme au sud, son portail
  // en +z ; l'église Saint-Louis vers le nord, en -z)
  // l'église du Dôme (une croix grecque dans un carré), le portail à deux ordres de colonnes et son fronton, le tambour à
  // colonnes, le dôme doré et ses côtes, la lanterne, la flèche et la croix (107 m) ; les petits dômes des chapelles ; la nef
  // de Saint-Louis et son toit d'ardoise
  function invalides(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xEFE4CA), pierreFoncee = A.matiere(0xD5C29A), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), orFonce = A.matiere(0xD99A1E, 0x5A3200), porte = A.matiere(0x6E5A44);
    A.boite(50, 26, 50, 0, 0, 0, pierre); A.boite(51, 1.6, 51, 0, 26, 0, pierreFoncee);
    A.boite(24, 30, 6, 0, 0, 28, pierre);
    for (let k = 0; k < 8; k++) { A.cylindre(0.8, 0.9, 13, 10, -9.8 + k * 2.8, 0, 31.6, pierre); A.cylindre(0.7, 0.8, 11, 10, -9.8 + k * 2.8, 14.4, 31.6, pierre); }
    A.boite(25, 1.4, 7, 0, 13, 28.5, pierreFoncee); A.boite(25, 1.4, 7, 0, 25.4, 28.5, pierreFoncee); A.toit(25, 6, 7, 0, 30, 28.5, pierre, Math.PI / 2);
    A.extrusion(A.formeArche(4.5, 9), 0.6, 0, 0, 31.4, porte);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.dome(5.5, 0.9, dx * 19.5, 27.6, dz * 19.5, ardoise);
    A.boite(34, 4, 34, 0, 27.6, 0, pierre); A.cylindre(15, 15, 17, 32, 0, 31.6, 0, pierre);
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; A.cylindre(0.7, 0.7, 15, 8, Math.cos(a) * 15.8, 32.6, Math.sin(a) * 15.8, pierre); }
    A.cylindre(16.8, 16.8, 1.6, 32, 0, 48.6, 0, pierreFoncee); A.cylindre(14.2, 14.2, 4, 32, 0, 50.2, 0, pierre);
    A.dome(14.2, 1.45, 0, 54.2, 0, or);
    for (let k = 0; k < 12; k++) A.piece((e) => new THREE.TorusGeometry(14.25, 0.4 + e, 6, 24, Math.PI / 2).scale(1, 1.45, 1).rotateY(k * Math.PI / 6), orFonce, V(0, 54.2, 0), null, true);
    A.cylindre(2.4, 2.6, 7, 12, 0, 73.5, 0, or); A.pyramide(1.6, 22, 8, 0, 80.5, 0, or); A.boule(1, 0, 103.4, 0, or);
    A.boite(0.5, 3.6, 0.5, 0, 104, 0, or); A.boite(2.2, 0.5, 0.5, 0, 106, 0, or);
    A.boite(22, 21, 69, 0, 0, -60.5, pierre); A.toit(22.6, 8, 69, 0, 21, -60.5, ardoise, Math.PI / 2);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le palais du Luxembourg (x : vers l'est ; l'entrée au nord
  // sur la rue de Vaugirard, en -z ; le jardin au sud, en +z)
  // le corps de logis côté jardin (deux corps sous de hauts toits d'ardoise), ses pavillons, les deux ailes de la cour,
  // les pavillons d'angle, la galerie basse sur la rue et le pavillon d'entrée à dôme
  function luxembourg(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE2C4), pierreFoncee = A.matiere(0xD6C59E), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), porte = A.matiere(0x6E5A44);
    for (const z of [20.5, 52.5]) { A.boite(90, 20, 19, 0, 0, z, pierre); A.toit(19.6, 8, 90, 0, 20, z, ardoise); }
    A.boite(90, 18, 13, 0, 0, 36.5, pierre); A.boite(91, 1.2, 64, 0, 18.8, 36.5, pierreFoncee);
    for (const s of [1, -1]) { A.boite(19, 23, 14, s * 35.5, 0, 67, pierre); A.combles(19.4, 9, 14.4, s * 35.5, 23, 67, ardoise); }
    A.boite(24, 24, 18, 0, 0, 56, pierre); A.cylindre(8, 8, 2, 24, 0, 24, 56, pierreFoncee); A.dome(8, 0.9, 0, 26, 56, ardoise); A.boule(1, 0, 34.2, 56, or);
    for (const s of [1, -1]) {
      A.boite(16, 18, 86, s * 37, 0, -32, pierre); A.toit(16.6, 8, 86, s * 37, 18, -32, ardoise, Math.PI / 2);
      A.boite(20, 22, 16, s * 37, 0, -69, pierre); A.combles(20.4, 10, 16.4, s * 37, 22, -69, ardoise);
    }
    A.boite(54, 9, 8, 0, 0, -62.5, pierre); A.boite(54.6, 1.2, 8.6, 0, 9, -62.5, pierreFoncee);
    A.boite(14, 20, 12, 0, 0, -63, pierre); A.extrusion(A.formeArche(4.5, 8), 0.6, 0, 0, -69.2, porte);
    A.cylindre(6, 6, 4, 24, 0, 20, -63, pierre); A.dome(6, 1.2, 0, 24, -63, ardoise);
    A.cylindre(1.4, 1.4, 3, 10, 0, 30.5, -63, pierre); A.dome(1.4, 1.3, 0, 33.5, -63, ardoise); A.boule(0.7, 0, 35.8, -63, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Fontainebleau : la cour du Cheval-Blanc
  // (x : vers l'est ; la cour s'ouvre à l'ouest, en -x, derrière sa grille)
  // l'aile des Ministres au nord, l'aile Louis XV au sud, le fond de la cour et ses pavillons aux hauts toits, l'escalier
  // en fer à cheval devant le pavillon de l'Horloge, les cheminées, la grille ; le reste du château (cour Ovale…) reste
  // dessiné par l'IGN
  function fontainebleau(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0E4C8), pierreFoncee = A.matiere(0xD8C6A0), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), fer = A.matiere(0x2E3550);
    A.boite(128, 10, 13, -26, 0, -59.5, pierre); A.toit(13.6, 6, 128, -26, 10, -59.5, ardoise);
    A.boite(185, 14, 17, 1.5, 0, 62.5, pierre); A.toit(17.6, 8, 185, 1.5, 14, 62.5, ardoise);
    A.boite(12, 15, 133, 84, 0, 13, pierre); A.toit(12.6, 7, 133, 84, 15, 13, ardoise, Math.PI / 2);
    A.boite(22, 15, 36, 80, 0, -35.5, pierre); A.combles(22.4, 9, 36.4, 80, 15, -35.5, ardoise);
    A.boite(15, 15, 36, 62.3, 0, -69.5, pierre); A.toit(15.6, 7, 36, 62.3, 15, -69.5, ardoise, Math.PI / 2);
    A.boite(53, 13, 15, 115.5, 0, -2, pierre); A.toit(15.6, 7, 53, 115.5, 13, -2, ardoise);
    A.boite(16, 19, 18, 82, 0, 0, pierre); A.combles(16.4, 11, 18.4, 82, 19, 0, ardoise);
    A.cylindre(1.4, 1.4, 3.5, 10, 82, 28, 0, pierre); A.pyramide(1.8, 3, 10, 82, 31.5, 0, ardoise); A.boule(0.7, 82, 35, 0, or);
    A.boite(16, 18, 16, 83, 0, 45, pierre); A.combles(16.4, 10, 16.4, 83, 18, 45, ardoise);
    A.boite(16, 17, 20, -85, 0, 62.5, pierre); A.combles(16.4, 10, 20.4, -85, 17, 62.5, ardoise);
    A.boite(14, 13, 16, -84, 0, -59.5, pierre); A.combles(14.4, 8, 16.4, -84, 13, -59.5, ardoise);
    // l'escalier en fer à cheval : un demi-anneau, sa courbe contre le pavillon, ses deux pieds vers la cour
    A.piece((e) => { const f = new THREE.Shape(); f.absarc(0, 0, 10 + e, -Math.PI / 2, Math.PI / 2, false); f.absarc(0, 0, Math.max(0.5, 6 - e), Math.PI / 2, -Math.PI / 2, true); f.closePath();
      return new THREE.ExtrudeGeometry(f, { depth: 6 + 2 * e, bevelEnabled: false, curveSegments: 18 }).rotateX(-Math.PI / 2).scale(1, 1, 1.6).translate(0, -e, 0); }, pierreFoncee, A.V(68, 0, 0));
    A.boite(3, 6, 12, 76.5, 0, 0, pierreFoncee);
    for (const x of [-70, -35, 0, 35, 70]) A.boite(1.6, 10, 3, x, 14, 62.5, pierreFoncee);
    for (const x of [-70, -40, -10, 20]) A.boite(1.6, 8, 3, x, 10, -59.5, pierreFoncee);
    A.boite(0.8, 3, 107, -91, 0, 0.5, fer); A.boite(1, 0.4, 107, -91, 3, 0.5, or);
    for (const s of [1, -1]) A.boite(2.4, 5, 2.4, -91, 0, s * 8, pierre);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Chambord (x : le long de la façade sur le
  // Cosson, au nord-ouest en -z ; l'enceinte et sa cour en +z)
  // le donjon et ses quatre tours rondes, la forêt de toits, de cheminées et de lanternons, la grande lanterne de
  // l'escalier (56 m) et sa fleur de lys, les galeries et les grosses tours d'angle, l'enceinte basse et ses tours
  function chambord(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF6F0E0), tuffeauOmbre = A.matiere(0xE2D7BD), ardoise = A.matiere(0x4F5D8C), ardoiseFoncee = A.matiere(0x3F4B78), or = A.matiere(0xFFC233, 0x7A4A00);
    const tourRonde = (r, h, x, z, toitH, lanterne) => {
      A.cylindre(r, r, h, 28, x, 0, z, tuffeau); A.cylindre(r + 0.6, r + 0.6, 1.4, 28, x, h - 1.4, z, tuffeauOmbre); A.pyramide(r + 0.4, toitH, 28, x, h, z, ardoise);
      if (lanterne) { A.cylindre(1.6, 1.6, 5, 10, x, h + toitH - 4, z, tuffeau); A.pyramide(2, 3.5, 10, x, h + toitH + 1, z, ardoiseFoncee); }
    };
    A.boite(44, 20, 45, 2, 0, -0.5, tuffeau); A.boite(45, 1.4, 46, 2, 18.6, -0.5, tuffeauOmbre);
    for (const [x, z] of [[-19.5, -23], [24, -23], [-19.5, 22], [24, 22]]) tourRonde(10.2, 20, x, z, 13, true);
    for (const [dx, dz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) A.combles(15, 10, 15, 2 + dx, 20, -0.5 + dz, ardoise);
    A.cylindre(5, 5, 14, 8, 2, 20, -0.5, tuffeau); A.cylindre(5.6, 5.6, 1, 8, 2, 34, -0.5, tuffeauOmbre); A.cylindre(3.6, 3.6, 8, 8, 2, 35, -0.5, tuffeau);
    A.dome(3.6, 1.3, 2, 43, -0.5, ardoise); A.cylindre(1.2, 1.2, 4, 8, 2, 47.5, -0.5, tuffeau); A.boule(1.1, 2, 52.6, -0.5, or); A.boite(0.6, 3, 0.6, 2, 53.6, -0.5, or); A.boite(2.2, 0.6, 0.6, 2, 55.4, -0.5, or);
    for (const [x, z] of [[-15, -6], [-15, 5], [19, -6], [19, 5], [-4, -18], [8, -18], [-4, 17], [8, 17]]) { A.boite(1.8, 11, 1.8, x, 20, z, tuffeau); A.boite(2.6, 0.8, 2.6, x, 31, z, tuffeauOmbre); }
    A.boite(34, 13, 7, -43, 0, -20, tuffeau); A.toit(7.6, 5, 34, -43, 13, -20, ardoise);
    A.boite(30, 13, 7, 45.5, 0, -20, tuffeau); A.toit(7.6, 5, 30, 45.5, 13, -20, ardoise);
    tourRonde(10.8, 20, -68, -23, 14, true); tourRonde(10.8, 20, 68, -22, 14, true);
    for (const s of [1, -1]) {
      const x = s * 59.5;
      A.boite(12, 19, 34, x, 0, 0, tuffeau); A.toit(12.6, 6, 34, x, 19, 0, ardoise, Math.PI / 2);
      A.boite(12, 8, 36, x, 0, 35, tuffeau); A.toit(12.6, 4, 36, x, 8, 35, ardoise, Math.PI / 2);
    }
    A.boite(107, 8, 13, 0.5, 0, 59.5, tuffeau); A.toit(13.6, 4, 107, 0.5, 8, 59.5, ardoise);
    tourRonde(10.5, 8, -67, 67, 7, false); tourRonde(10.5, 8, 67, 69, 7, false);
    return A.groupe;
  }

  // ---------------------------------------------------------------- trois cathédrales de plus (le modèle réglable)
  // Amiens : la plus haute nef de France (42 m), deux tours plates (66 et 62 m), la fine flèche de la croisée (112 m)
  const amiens = (THREE) => cathedrale(THREE, { F: -67, E: 59, larg: 30, mur: 42, toitH: 14, xT: -5, transept: 70, transeptL: 22, cote: 14, facadeH: 46, rose: 5.5,
    tours: [{ z: -14, h: 66 }, { z: 14, h: 62 }], flecheCroisee: { h: 54, r: 3.2, seg: 8 } });
  // Rouen : la flèche de fonte (151 m, la plus haute de France) sur la tour-lanterne, la tour Saint-Romain (82 m) et la tour
  // de Beurre (75 m, sa couronne), les tours des portails du transept, la chapelle de la Vierge au chevet
  const rouen = (THREE) => cathedrale(THREE, { F: -64, E: 45, larg: 28, mur: 28, toitH: 13, xT: 2, transept: 56, transeptL: 16, cote: 14, facadeH: 38, rose: 5.5,
    tours: [{ x: -63.5, z: -26, cote: 12, h: 60, fleche: 22, seg: 4, r: 7.5 }, { x: -60, z: 18, cote: 16, h: 67, octogone: { h: 8, r: 6.5 } }],
    flecheCroisee: { tour: 10, cote: 16, h: 100, r: 6, seg: 4, couleur: 0x3F4B5E },
    plus: (A, m) => {
      for (const x of [-8.5, 12.5]) for (const s of [1, -1]) { A.boite(10, 36, 10, x, 0, s * 23.4, m.pierre); A.pyramide(4.5, 9, 4, x, 36, s * 23.4, m.toitFonce); }
      A.boite(10, 18, 11, 64, 0, 0, m.pierre); A.toit(11.6, 6, 10, 64, 18, 0, m.toit); A.abside(5.5, 18, 69, 0, 0, m.pierre); A.demiCone(6, 6, 69, 18, 0, m.toit);
    } });
  // Strasbourg : le grès rose des Vosges, la façade d'un bloc jusqu'à la plate-forme (66 m), la seule tour nord, son
  // octogone et ses quatre tourelles d'escalier, la flèche (142 m) ; le toit de cuivre, la tour de croisée
  const strasbourg = (THREE) => cathedrale(THREE, { F: -50.5, E: 45.5, larg: 26, mur: 32, toitH: 12, xT: 31, transept: 52, transeptL: 26, cote: 17, facadeH: 66, rose: 6.8, roseY: 38,
    pierre: 0xD9A08C, pierreFoncee: 0xB97A66, toit: 0x5E9C86, toitFonce: 0x4A7F6C,
    tours: [{ z: -17.5, h: 66, octogone: { h: 34, r: 7.5 }, fleche: 40, r: 6.5, couleur: 0xC98F7B }, { z: 17.5, h: 66 }],
    flecheCroisee: { tour: 6, cote: 15, seg: 8, h: 10, r: 8 } });

  // ---------------------------------------------------------------- l'église de la Madeleine (x : l'axe, le portique au
  // sud-ouest en -x, face à la rue Royale)
  // un temple grec : le soubassement et ses marches, la cella, 48 colonnes corinthiennes, l'entablement, les frontons,
  // le toit de zinc, la porte de bronze
  function madeleine(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D2), pierreFoncee = A.matiere(0xD6C8A8), zinc = A.matiere(0x8E9AB4), bronze = A.matiere(0x7A5A3A);
    A.boite(104, 7, 45, 0, 0, 0, pierreFoncee); A.boite(10, 2.3, 34, -56, 0, 0, pierreFoncee); A.boite(7, 4.6, 34, -54.5, 0, 0, pierreFoncee);
    A.boite(84, 20, 26, 2, 7, 0, pierre);
    const col = []; for (let i = 0; i < 8; i++) for (const x of [-49, 49]) col.push([x, -19.6 + i * 5.6, 1.05, 19.5, 7]);
    for (let i = 1; i < 17; i++) for (const z of [-19.6, 19.6]) col.push([-49 + i * 98 / 17, z, 1.05, 19.5, 7]);
    A.cylindres(col, pierre, 12);
    A.boite(102, 3, 43, 0, 26.5, 0, pierreFoncee);
    for (const s of [1, -1]) A.toit(43, 7, 2, s * 50, 29.5, 0, pierre);
    A.toit(43.6, 7.2, 97, 0, 29.5, 0, zinc);
    A.plaque(0.4, 11, 7, -40.2, 7, 0, bronze);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le palais des Papes d'Avignon (x : vers l'est-sud-est ;
  // la grande façade à l'ouest, en -x, sur la place du Palais)
  // une forteresse : des ailes crénelées autour de la cour d'honneur (au sud) et du cloître (au nord), leurs toits de
  // tuiles, les hautes tours, les grandes arcades en ogive de la façade, la porte des Champeaux et ses deux tourelles
  function palaisDesPapes(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9D3A6), pierreFoncee = A.matiere(0xCDB07C), tuile = A.matiere(0xC8704A), ombre = A.matiere(0xA88E64);
    const ailes = [[-53, -31, -8, 72, 32], [-31, 25, 55, 72, 38], [9, 25, -8, 55, 30], [-31, 9, -8, 2, 28],
      [-30, 40, -70, -55, 28], [-30, -10, -55, -8, 30], [26, 44, -55, -8, 28], [-10, 26, -20, -8, 26]];
    const tours = [[-24, -51, 17, 15, 52], [45, -72, 18, 18, 42], [-1, 75, 20, 16, 42], [30, 2, 18, 18, 46], [-50, 22, 14, 14, 40], [-44, 68, 16, 14, 40]];
    const toits = [], bords = [];
    for (const [x0, x1, z0, z1, h] of ailes) {
      const lx = x1 - x0, lz = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      A.boite(lx, h, lz, x, 0, z, pierre); bords.push([lx, h, lz, x, z]);
      toits.push(lx > lz ? [lz - 2, 3.5, lx - 2, x, h, z, 0] : [lx - 2, 3.5, lz - 2, x, h, z, Math.PI / 2]);
    }
    A.toits(toits, tuile);
    for (const [x, z, lx, lz, h] of tours) { A.boite(lx, h, lz, x, 0, z, pierre); A.boite(lx + 1.4, 2.2, lz + 1.4, x, h - 3.5, z, pierreFoncee); bords.push([lx + 1.4, h - 1.3, lz + 1.4, x, z]); }
    for (const [lx, h, lz, x, z] of bords) A.creneaux([A.tourDe(lx, lz, x, z)], h, 0.9, pierreFoncee);
    for (const z of [0, 12, 24, 48, 60]) A.extrusion(A.formeOgive(6, 24), 0.6, -53.2, 0, z, ombre, Math.PI / 2);
    A.extrusion(A.formeOgive(5, 9), 0.6, -53.3, 0, 36, ombre, Math.PI / 2);
    for (const s of [1, -1]) { A.cylindre(1.8, 1.8, 9, 10, -54.5, 26, 36 + s * 5, pierre); A.pyramide(2.2, 6, 10, -54.5, 35, 36 + s * 5, pierreFoncee); }
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Chenonceau (x : le long du Cher ; la
  // galerie traverse la rivière vers le sud, en +z)
  // le logis carré sur ses piles, ses tourelles d'angle, son haut toit d'ardoise et ses cheminées, la chapelle ; la galerie
  // à deux étages sur ses arches, ses fenêtres et ses lucarnes ; la tour des Marques sur la terrasse
  function chenonceau(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF4EEDF), pierreFoncee = A.matiere(0xDCD0B4), ardoise = A.matiere(0x4F5D8C), fenetre = A.matiere(0x4A5A7A, 0x101828);
    A.boite(30, 3, 26, -18.5, 0, -8, pierreFoncee); A.boite(30, 13, 26, -18.5, 3, -8, pierre); A.combles(30.6, 12, 26.6, -18.5, 16, -8, ardoise);
    const tourelles = []; for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) tourelles.push([-18.5 + dx * 15, -8 + dz * 13, 2.2, 10, 7]);
    A.cylindres(tourelles, pierre, 14); A.cones(tourelles.map(([x, z]) => [x, z, 2.5, 17, 6]), ardoise, 14);
    A.boite(6, 12, 8, -0.5, 0, 1, pierre); A.toit(8.4, 4, 6, -0.5, 12, 1, ardoise, Math.PI / 2);
    A.boites([[-27, -14], [-27, -2], [-10, -14], [-10, -2]].map(([x, z]) => [1.8, 9, 3.2, x, 20, z]), pierreFoncee);
    A.plaques([-12, -4].flatMap((z) => [7.5, 11.5].flatMap((y) => [[-33.6, y, z], [-3.4, y, z]])).map(([x, y, z]) => [0.3, 2.4, 2, x, y, z]), fenetre);
    const piles = [13.4, 25, 37, 50.6, 62.5];
    A.boites(piles.map((z) => [9, 7, 3, -25.5, 0, z]).concat([[9, 7, 3, -25.5, 0, 65.5]]), pierreFoncee);
    A.cylindres(piles.flatMap((z) => [[-31, z, 2.1, 7, 0], [-20, z, 2.1, 7, 0]]), pierreFoncee, 4);
    const bords = [5.5]; for (const z of piles) bords.push(z - 1.5, z + 1.5); bords.push(64);
    for (let i = 0; i + 1 < bords.length; i += 2) { const z0 = bords[i], z1 = bords[i + 1], r = (z1 - z0) / 2, f = new THREE.Shape();
      f.moveTo(-r, 1.5); f.absarc(0, 1.5, r, Math.PI, 0, true); f.lineTo(r, 7.05); f.lineTo(-r, 7.05); f.closePath(); A.extrusion(f, 8.96, -25.5, 0, (z0 + z1) / 2, pierre, Math.PI / 2, true); }
    A.boite(9, 10, 61.5, -25.5, 7, 36.25, pierre); A.toit(9.6, 6, 61.5, -25.5, 17, 36.25, ardoise, Math.PI / 2);
    const fen = []; for (let k = 0; k < 9; k++) for (const y of [8.5, 12.8]) for (const s of [1, -1]) fen.push([0.3, 2.6, 2, -25.5 + s * 4.6, y, 9 + k * 6.6]);
    A.plaques(fen, fenetre);
    const luc = []; for (let k = 0; k < 6; k++) for (const s of [1, -1]) luc.push([1.8, 2.6, 2, -25.5 + s * 3.4, 17, 11 + k * 10.5]);
    A.boites(luc, pierre); A.toits(luc.map(([, , , x, , z]) => [2.6, 1.3, 2.2, x, 19.6, z, Math.PI / 2]), ardoise);
    A.cylindre(6, 6, 18, 20, -34, 0, -50, pierre); A.pyramide(6.5, 9, 20, -34, 18, -50, ardoise); A.cylindre(1, 1, 3, 8, -34, 25.5, -50, pierre); A.pyramide(1.3, 2.5, 8, -34, 28.5, -50, ardoise);
    return A.groupe;
  }

  // ---------------------------------------------------------------- l'abbaye du Mont-Saint-Michel (x : l'axe de l'église,
  // le chœur à l'est-nord-est ; la Merveille au nord, en -z)
  // le rocher de granit (la carte est plate : il porte l'abbaye), la Merveille, le logis abbatial, la plate-forme,
  // l'église (nef, transept, chœur gothique), le clocher, la flèche et l'archange doré
  function montSaintMichel(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0x9A9284), granitFonce = A.matiere(0x7F786C), pierre = A.matiere(0xE2DACB), pierreFoncee = A.matiere(0xC6BBA6), ardoise = A.matiere(0x4F5D8C), ardoiseFoncee = A.matiere(0x3F4B78), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(40, 46, 18, 9, 5, 0, 0, granit); A.cylindre(32, 40, 18, 9, 3, 18, -2, granitFonce); A.cylindre(26, 32, 14, 9, 6, 36, -3, granit);
    A.boite(56, 30, 14, 10, 20, -28, pierre); A.creneaux([A.tourDe(56, 14, 10, -28)], 50, 0.8, pierreFoncee);
    A.boite(30, 26, 12, 15, 24, 20, pierre); A.toit(12.6, 6, 30, 15, 50, 20, ardoise);
    A.boite(70, 4, 48, 6, 46, -3, pierreFoncee);
    A.boite(40, 16, 14, -8, 50, -3, pierre); A.toit(14.6, 7, 40, -8, 66, -3, ardoise);
    A.boite(12, 16, 32, 15, 50, -3, pierre); A.toit(12.6, 7, 32, 15, 66, -3, ardoise, Math.PI / 2);
    A.boite(20, 20, 18, 31, 50, -3, pierre); A.abside(9, 20, 41, 50, -3, pierre); A.toit(18.6, 7, 20, 31, 70, -3, ardoise); A.demiCone(9.5, 7, 41, 70, -3, ardoise);
    A.boite(11, 26, 11, 15, 50, -3, pierre); A.cylindre(5, 5, 10, 8, 15, 76, -3, pierre); A.pyramide(5.5, 40, 8, 15, 86, -3, ardoiseFoncee);
    A.boite(1, 4, 1, 15, 126, -3, or); A.boule(1.2, 15, 131, -3, or); A.boite(4, 1.2, 0.4, 15, 129, -3, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Louvre (x : l'axe historique, vers l'est ; la
  // pyramide au centre ; l'aile Richelieu au nord, en -z ; l'aile Denon et la Seine au sud, en +z)
  // la pyramide de verre et les trois petites, les ailes Richelieu et Denon autour de la cour Napoléon, leurs pavillons
  // à dôme carré, les cours couvertes de verre, la cour Carrée (le pavillon de l'Horloge, la Colonnade), la Grande
  // Galerie jusqu'au pavillon de Flore, l'aile de Rivoli jusqu'au pavillon de Marsan
  function louvre(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE3C8), pierreFoncee = A.matiere(0xD8C6A0), ardoise = A.matiere(0x56659A), zinc = A.matiere(0x9AA3B5),
      verre = A.matiere(0x9FD8F5, 0x1A4A66), or = A.matiere(0xFFC233, 0x7A4A00);
    const aile = (x0, x1, z0, z1, h, plat) => { const lx = x1 - x0, lz = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2; A.boite(lx, h, lz, x, 0, z, pierre);
      if (plat) A.boite(lx + 0.6, 1.4, lz + 0.6, x, h, z, zinc); else if (lx > lz) A.toit(lz + 0.6, Math.min(10, lz * 0.38), lx, x, h, z, ardoise); else A.toit(lx + 0.6, Math.min(10, lx * 0.38), lz, x, h, z, ardoise, Math.PI / 2); };
    const pavillon = (x, z, lx, lz, h, hd) => { A.boite(lx, h, lz, x, 0, z, pierre); A.boite(lx + 1, 1.4, lz + 1, x, h - 1.4, z, pierreFoncee); A.domeCarre(lx - 1, hd, lz - 1, x, h, z, ardoise); A.boule(0.9, x, h + hd + 0.6, z, or); };
    // la pyramide (35 m de côté, 21,6 m) et les trois petites
    A.pyramide(25, 21.6, 4, 0, 0, 0, verre); for (const [x, z] of [[0, -38], [0, 38], [38, 0]]) A.pyramide(3.7, 5, 4, x, 0, z, verre);
    // l'aile Richelieu et ses trois cours couvertes
    aile(-108, 123, -151, -124, 25); aile(-108, 123, -85, -63, 25); aile(-108, 123, -63, -57, 12, true);
    aile(-108, -66, -124, -85, 25); aile(-9, 12, -124, -85, 25); aile(68, 82, -124, -85, 25); aile(101, 123, -124, -85, 25);
    A.plaques([[57, 1, 39, -37.5, 21, -104.5], [56, 1, 39, 40, 21, -104.5], [19, 1, 39, 91.5, 21, -104.5]], verre);
    for (const x of [-76.5, 0.5, 76.5]) pavillon(x, -72, 26, 26, 28, 13);
    pavillon(2, -137, 26, 28, 28, 12);
    // l'aile Denon
    aile(-138, 127, 70, 92, 25); aile(-138, 127, 63, 70, 12, true); aile(-138, 127, 121, 143, 25);
    aile(-138, -110, 92, 121, 25); aile(-10, 10, 92, 121, 25); aile(60, 80, 92, 121, 25); aile(105, 127, 92, 121, 25);
    for (const x of [-79, -1.5, 77.5]) pavillon(x, 76, 26, 26, 28, 13);
    // la cour Carrée : les toits plats, l'aile Lescot à l'ouest et le pavillon de l'Horloge, la Colonnade à l'est
    aile(123, 148, -89, 88, 27); aile(148, 270, -89, -64, 27, true); aile(148, 270, 63, 88, 27, true); aile(270, 295, -89, 88, 27, true);
    for (const [x, z] of [[135.5, -76.5], [135.5, 75.5], [282.5, -76.5], [282.5, 75.5]]) { A.boite(27, 29, 27, x, 0, z, pierre); A.combles(27.6, 8, 27.6, x, 29, z, ardoise); }
    A.boite(28, 32, 30, 135.5, 0, 0, pierre); A.domeCarre(26, 17, 28, 135.5, 32, 0, ardoise); A.boule(1.2, 135.5, 49.8, 0, or);
    A.boite(4, 9, 130, 297, 0, 0, pierreFoncee); A.cylindres(Array.from({ length: 22 }, (_, k) => [297.5, -60 + k * 120 / 21, 0.8, 14, 9]), pierre, 10); A.boite(4.4, 3, 130, 297, 23, 0, pierreFoncee);
    // la Grande Galerie et le pavillon de Flore ; l'aile de Rivoli et le pavillon de Marsan
    aile(-339, -138, 120, 143, 23); pavillon(-245, 131.5, 26, 30, 26, 10); pavillon(-359, 127, 40, 44, 30, 14);
    aile(-330, -108, -151, -127, 24); pavillon(-329.5, -151.5, 39, 49, 30, 14);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la Cité de Carcassonne (x : vers l'est)
  // les deux enceintes (la haute, intérieure, et les lices), leurs créneaux, une cinquantaine de tours à leur place et à
  // leur hauteur (relevées sur la BD TOPO : murs et tours), les toits pointus d'ardoise (tours hautes) ou de tuiles
  // (tours basses), le château comtal, la basilique Saint-Nazaire
  const CARCA = {
    T: [[-164, 190.5, 12.5, 13, 0, 23], [103.5, 124, 14, 13.5, 88, 25], [-114, 196, 9, 8, 50, 18], [-115.5, 220.5, 7.5, 6.5, 13, 10], [-63, 179.5, 13, 13, 13, 23], [-35.5, 174.5, 9.5, 11, 11, 17], [10, 165.5, 9.5, 9.5, 0, 19], [19.5, 190, 8, 6, 20, 10], [34.5, 154.5, 8, 7, 28, 15], [57, 140.5, 7.5, 7, 41, 15], [62.5, 167, 8, 5, 32, 9], [-177, 145, 8, 6.5, 54, 10], [-165, 147.5, 9, 10, 10, 20], [-180, 220.5, 11, 10.5, 58, 16], [-146.5, 89, 11.5, 12, 63, 26], [-38, -184, 9, 7, 35, 8], [-63, -128.5, 9.5, 8, 71, 17], [-67, -108.5, 6, 6, 21, 17], [-39.5, -131.5, 4.5, 8, 76, 17], [3, -212, 7.5, 5, 23, 7], [47.5, -224.5, 8.5, 5.5, 2, 8], [39.5, -207, 8.5, 8, 88, 15], [65, -199, 8, 8.5, 61, 14], [-22, -172, 8, 8.5, 39, 17], [-16, -125, 8.5, 10.5, 78, 17], [-23.5, -98.5, 9, 9, 78, 17], [-67.5, -74, 21.5, 14, 78, 17], [-80.5, -50.5, 4.5, 7.5, 88, 31], [-31, -70, 17, 8, 77, 17], [-37, -45, 8, 8.5, 25, 17], [-77, -19, 9, 10, 20, 18], [-124.5, 44, 6.5, 7, 0, 0], [-121.5, 54, 10.5, 10, 15, 0], [-108, 37.5, 7, 7, 48, 0], [92, -191.5, 10, 8.5, 65, 15], [107, -173, 8.5, 7.5, 19, 14], [116, -151, 7, 5, 19, 20], [145, -161, 7.5, 9.5, 31, 9], [153, -101.5, 19, 15, 15, 32], [173.5, -109, 10, 11.5, 8, 10], [138, -51, 31, 17, 65, 28], [126.5, -18.5, 3.5, 5, 0, 16], [117, 5, 8, 8, 71, 16], [104.5, 35, 6.5, 7, 71, 14], [97.5, 57.5, 10, 9, 78, 13], [133.5, 40, 12.5, 10.5, 80, 8], [87.5, 101.5, 12.5, 9.5, 62, 24]],
    Ch: [[-61.5, -103.5, 39.5, 13, 79, 17], [-22, -113.5, 22, 5, 75, 17], [-28.5, -86.5, 17, 5.5, 75, 17], [-75, -60.5, 7.5, 7.5, 2, 17], [-58.5, -50, 9, 38, 81, 17], [-49.5, -65, 11.5, 27, 76, 17]],
    M: [[0, -158.5, 123.5, -156, 118], [0, -158.5, 218.5, -119.5, 218.5], [1, 60.5, 139, 76.5, 118], [1, -108.5, 194, -74.5, 182.5, -67.5, 183], [1, -158, 192, -119.5, 196.5], [1, -58, 177, -41, 176], [0, -112.5, 216.5, -66.5, 206.5, -62.5, 214, -52.5, 214.5, -49.5, 212, -48, 202.5, 15, 189], [1, -30, 174, 5, 166.5], [1, 15.5, 163, 30.5, 156], [1, 37.5, 151.5, 55, 144], [0, 22.5, 185.5, 58, 167.5], [1, 64.5, 163, 91.5, 144, 85.5, 136, 96.5, 125], [0, -162.5, 118, -175, 141.5], [1, -166.5, 142.5, -156, 118], [0, -176, 149.5, -178, 215], [1, -164, 183.5, -166.5, 152], [0, -174, 218.5, -123.5, 218.5], [1, -158, 192, -123.5, 196], [1, -150, 92, -158.5, 110.5], [1, -158.5, 123.5, -146.5, 93.5], [0, -128, -123.5, -119, -137.5, -75, -127.5], [1, -124.5, -118, -115, -125, -85, -120.5, -90, -73.5, -81.5, -74, -78, -84], [1, -25, -168, -56.5, -146, -60, -134], [1, -60, -134, -73, -135], [0, -41, -179.5, -72, -153.5, -70, -151.5, -78, -118, -77.5, -99, -80.5, -84], [0, 43.5, -222, 7.5, -211.5], [1, 44, -208, 61.5, -201.5], [0, 0.5, -208, -33, -185], [1, -18.5, -174, 35.5, -208], [1, 70, -198, 88, -194], [0, 78, -165, 81.5, -156], [1, -83.5, -48, -83, -24, -86.5, -23.5, -91, -2.5, -109.5, 18], [0, -105, 35, -80.5, 2, -77, -13], [1, -85, -73.5, -84, -52], [1, -76.5, -27, -77, -47.5], [0, -105, 23, -122.5, 40.5], [0, -118, 49.5, -110, 40.5], [0, -127.5, 48, -146, 83], [0, -140, 85, -124.5, 59], [0, -2, -94.5, -8.5, -41.5, -12.5, -43, -17.5, -34], [1, 60.5, 139, 84.5, 106], [0, 140, -162.5, 105, -207.5, 110.5, -212, 108, -222.5, 100, -223, 96, -215, 52, -222], [1, 106.5, -176.5, 95, -189], [1, 114.5, -153.5, 110, -169.5], [1, 152, -108.5, 117.5, -148.5], [0, 168, -113.5, 144, -156.5], [1, 118.5, 1.5, 125, -16], [1, 127.5, -21, 133.5, -36.5], [1, 106, 32, 115.5, 9], [1, 144, -66, 155.5, -94], [1, 169.5, -104, 159, -59, 165.5, -53, 165.5, -46.5, 158, -38.5, 151.5, -39.5, 149, -34, 152, -33.5, 130.5, 34.5], [1, 158, -38.5, 168.5, -29, 164, -23, 149.5, -35.5], [0, 100, 54, 104, 38], [1, 89, 95.5, 99, 62.5], [0, 128, 42, 110, 101.5, 101.5, 116.5], [0, 164, 18, 140.5, 79, 129.5, 117], [0, 212, -43.5, 202.5, -89.5], [1, 79.5, 152.5, 91.5, 144, 85.5, 136, 96.5, 125], [1, -150, 92, -175, 141.5], [1, -166.5, 142.5, -146.5, 93.5], [0, -128, -123.5, -123.5, -130.5]],
    ids: ['0080120119', '0080119911', '0080119841', '0080119952', '0080119777', '0080119842', '0080119845', '0080119868', '0080119823', '0080119955', '0080119943', '0080120020', '0080120107', '0080120021', '0080120096', '0080119794', '0351172416', '0351172418', '0351172415', '0080119798', '0080119803', '0080119813', '0080119796', '0080119804', '0351172414', '0351172412', '0351172409', '0080119971', '0351172410', '0351172407', '0080119912', '0351172402', '0351172398', '0351172399', '0080119886', '0080119814', '0080119788', '0080119875', '0080119844', '0080119882', '0080119872', '0223351845', '0080119859', '0080119843', '0080119962', '0080119908', '0080119867', '0351172417', '0351172413', '0351172411', '0351172405', '0351172406', '0351172408', '0351172401', '0351170606', '0351170604'],
  };
  function carcassonne(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE3CFA6), pierreFoncee = A.matiere(0xC7AE80), ardoise = A.matiere(0x4F5D8C), tuile = A.matiere(0xC8704A);
    const lignes = (haut) => CARCA.M.filter((m) => m[0] === haut).map((m) => { const p = []; for (let i = 1; i < m.length; i += 2) p.push([m[i], m[i + 1]]); return p; });
    for (const [haut, h] of [[1, 13], [0, 8]]) { const ls = lignes(haut); A.remparts(ls, h, 3, pierre); A.creneaux(ls, h, 1, pierreFoncee); }
    const rondes = [], cones = [], conesTuile = [], carrees = [], combles = [], bandes = [];
    for (const [x, z, la, lb, ang, h0] of CARCA.T) {
      const h = Math.max(h0, 12) + 2, haute = h0 >= 13 || h0 === 0;
      if (Math.min(la, lb) / Math.max(la, lb) > 0.72 && Math.max(la, lb) < 16) { const r = Math.max(3, (la + lb) / 4);
        rondes.push([x, z, r, h]); bandes.push([x, z, r + 0.5, 1.6, h - 1.6]); (haute ? cones : conesTuile).push([x, z, r + 0.7, h, haute ? r * 2.3 : r * 0.9]); }
      else { carrees.push([la, h, lb, x, 0, z, ang * Math.PI / 180]); combles.push([la + 0.8, haute ? 9 : 4, lb + 0.8, x, h, z, ang * Math.PI / 180]); }
    }
    A.cylindres(rondes, pierre, 16); A.cylindres(bandes, pierreFoncee, 16); A.cones(cones, ardoise, 16); A.cones(conesTuile, tuile, 16);
    A.boites(carrees, pierre); A.comblesN(combles, ardoise);
    // le château comtal : ses corps de logis, leurs toits
    A.boites(CARCA.Ch.map(([x, z, la, lb, ang, h]) => [la, h, lb, x, 0, z, ang * Math.PI / 180]), pierre);
    A.toits(CARCA.Ch.map(([x, z, la, lb, ang, h]) => (la >= lb ? [lb + 0.6, Math.min(7, lb * 0.5), la, x, h, z, ang * Math.PI / 180] : [la + 0.6, Math.min(7, la * 0.5), lb, x, h, z, (ang + 90) * Math.PI / 180])), ardoise);
    // la basilique Saint-Nazaire : la nef romane, le transept et le chœur gothiques
    A.boite(44, 17, 16, -86, 0, 124.5, pierre); A.toit(16.6, 6, 44, -86, 17, 124.5, ardoise);
    A.boite(14, 20, 38, -59, 0, 124.5, pierre); A.toit(14.6, 6, 38, -59, 20, 124.5, ardoise, Math.PI / 2);
    A.boite(6, 20, 16, -49, 0, 124.5, pierre); A.abside(8, 20, -46, 0, 124.5, pierre); A.demiCone(8.5, 6, -46, 20, 124.5, ardoise);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Grand Palais (x : vers l'est ; la nef nord-sud le long
  // de l'avenue Winston-Churchill, à l'est ; le palais de la Découverte à l'ouest)
  // la grande verrière en berceau et ses arcs de fer, le dôme de verre, la colonnade et les quadriges de bronze aux
  // angles, le palais de la Découverte et sa rotonde
  function grandPalais(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xF0E6D0), pierreFoncee = A.matiere(0xD8C9A8), verre = A.matiere(0xA6DCEB, 0x1C4652), fer = A.matiere(0x4F7F70), zinc = A.matiere(0x9AA3B5), bronze = A.matiere(0x5E8F6E), ombre = A.matiere(0x7E6E5A);
    A.boite(95, 18, 235, 53.5, 0, 0.5, pierre); A.boite(96, 1.4, 236, 53.5, 18, 0.5, pierreFoncee);
    A.piece((e) => new THREE.CylinderGeometry(24 + e, 24 + e, 200 + 2 * e, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1, 0.62, 1), verre, V(48, 19.4, 0));
    A.piece((e) => new THREE.CylinderGeometry(19 + e, 19 + e, 52 + 2 * e, 28, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.62, 1), verre, V(14, 19.4, 1));
    A.piece(() => A.fusion(Array.from({ length: 19 }, (_, k) => new THREE.TorusGeometry(24.2, 0.35, 4, 24, Math.PI).scale(1, 0.62, 1).translate(0, 0, -90 + k * 10))), fer, V(48, 19.4, 0), null, true);
    A.cylindre(17, 17, 4, 32, 46.5, 18, 1, pierreFoncee); A.dome(17, 1, 46.5, 22, 1, verre);
    for (let k = 0; k < 12; k++) A.piece((e) => new THREE.TorusGeometry(17.1, 0.35 + e, 4, 20, Math.PI / 2).rotateY(k * Math.PI / 6), fer, V(46.5, 22, 1), null, true);
    A.cylindre(2, 2, 3, 12, 46.5, 38.5, 1, fer); A.dome(2, 1, 46.5, 41.5, 1, fer);
    A.boite(6, 4, 200, 104, 0, 0, pierreFoncee); A.cylindres(Array.from({ length: 40 }, (_, k) => [104, -97.5 + k * 5, 0.9, 14, 4]), pierre, 12); A.boite(6.4, 2.2, 200, 104, 18, 0, pierreFoncee);
    A.boite(14, 26, 30, 100, 0, 0, pierre); A.extrusion(A.formeArche(9, 16), 0.6, 107.2, 0, 0, ombre, Math.PI / 2);
    for (const s of [1, -1]) { A.boite(16, 22, 18, 95, 0, s * 108, pierre);
      A.boites([[1.2, 3, 5, 92.5, 22.4, s * 108, 0.4], [1.2, 3, 5, 94.2, 22.4, s * 108, 0.2], [1.2, 3, 5, 95.9, 22.4, s * 108, -0.2], [1.2, 3, 5, 97.6, 22.4, s * 108, -0.4], [6, 1.4, 3, 95, 22, s * 106, 0]], bronze);
      A.boule(1.4, 95, 27, s * 105.5, bronze); A.boite(0.5, 3.4, 3.6, 95, 25.6, s * 105.5, bronze); }
    A.boite(109, 20, 145, -48.5, 0, -0.5, pierre); A.boite(110, 1.2, 146, -48.5, 20, -0.5, pierreFoncee);
    A.plaques([[86, 0.6, 52, -44, 21, -40], [86, 0.6, 52, -44, 21, 40], [40, 0.6, 26, -30, 21, 0]], verre);
    A.cylindre(12, 12, 6, 28, -76, 20, -1, pierre); A.dome(12, 0.85, -76, 26, -1, zinc); A.cylindre(1.6, 1.6, 2.5, 10, -76, 35.6, -1, pierre);
    A.cylindres(Array.from({ length: 8 }, (_, k) => [-104.2, -14 + k * 4, 0.8, 13, 0]), pierre, 12); A.toit(32, 5, 4, -104.2, 13, 0, pierre);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le pont Alexandre-III (x : l'axe du pont, de la rive
  // gauche vers la rive droite, dans l'axe des Invalides)
  // une seule arche d'acier très plate (107 m), ses guirlandes dorées, le tablier, les culées, les quatre pylônes et
  // leurs Pégase dorés, les lampadaires
  function pontAlexandre(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE3CC), acier = A.matiere(0xB4B3A6), or = A.matiere(0xFFC233, 0x7A4A00), bronze = A.matiere(0x5C6E62), lampe = A.matiere(0xFFF2B0, 0x806A20), route = A.matiere(0x9C9FA6);
    const R = 234.6, cy = 7.8 - R, a = Math.asin(54 / R);
    const arche = new THREE.Shape(); arche.moveTo(-54, 1.5); arche.absarc(0, cy, R, Math.PI / 2 + a, Math.PI / 2 - a, true); arche.lineTo(54, 9.5); arche.lineTo(-54, 9.5); arche.closePath();
    A.extrusion(arche, 40, 0, 0, 0, acier);
    const bande = new THREE.Shape(); bande.absarc(0, cy, R + 1.2, Math.PI / 2 + a, Math.PI / 2 - a, true); bande.absarc(0, cy, R, Math.PI / 2 - a, Math.PI / 2 + a, false); bande.closePath();
    for (const s of [1, -1]) A.extrusion(bande, 0.3, 0, 0, s * 20.15, or, 0, true);
    A.boite(160, 1.2, 40, 0, 9.5, 0, pierre); A.plaques([[160, 0.2, 26, 0, 10.7, 0]], route); for (const s of [1, -1]) A.boite(160, 1.1, 0.8, 0, 10.7, s * 19.6, pierre);
    for (const s of [1, -1]) A.boite(26, 9.5, 40, s * 67, 0, 0, pierre);
    for (const sx of [1, -1]) for (const sz of [1, -1]) { const x = sx * 72, z = sz * 23.5;
      A.boite(7, 17, 7, x, 0, z, pierre); A.boite(8, 1.4, 8, x, 17, z, pierre); A.boite(3.4, 1.6, 3.4, x, 18.4, z, or); A.boule(1.6, x, 21.4, z, or); A.boite(1.2, 2.4, 5, x, 20.2, z, or); }
    const lamp = []; for (let k = 0; k < 9; k++) for (const s of [1, -1]) lamp.push([-56 + k * 14, s * 19.6, 0.25, 4.5, 11.8]);
    A.cylindres(lamp, bronze, 6); A.boites(lamp.map(([x, z]) => [0.9, 0.9, 0.9, x, 16.3, z]), lampe);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Pont-Neuf (x : l'axe du pont, du nord au sud ; le
  // grand bras de la Seine en -x, la pointe de l'île de la Cité au milieu, le petit bras en +x)
  // sept arches puis cinq, les avant-becs et les demi-lunes au-dessus des piles, les parapets, la statue d'Henri IV
  function pontNeuf(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9DFC6), pierreFoncee = A.matiere(0xCFC2A2), bronze = A.matiere(0x3F5B4E);
    const larg = 20.5;
    const bras = (x0, x1, n) => { const p = 4.5, s = (x1 - x0 - (n - 1) * p) / n, piles = [];
      for (let i = 0; i < n; i++) { const xa = x0 + i * (s + p), xc = xa + s / 2, r = s / 2, f = new THREE.Shape();
        f.moveTo(xc - r, 2); f.absarc(xc, 2, r, Math.PI, 0, true); f.lineTo(xc + r, 10.05); f.lineTo(xc - r, 10.05); f.closePath(); A.extrusion(f, larg - 0.04, 0, 0, 0, pierre, 0, true);
        if (i < n - 1) piles.push(xa + s + p / 2); }
      A.boites(piles.map((x) => [p, 10, larg, x, 0, 0]), pierre);
      A.cylindres(piles.flatMap((x) => [[x, larg / 2, p / 2 + 0.4, 10, 0], [x, -larg / 2, p / 2 + 0.4, 10, 0]]), pierreFoncee, 16);
      A.cylindres(piles.flatMap((x) => [[x, larg / 2 + 1.2, p / 2 + 1.6, 1.4, 10], [x, -larg / 2 - 1.2, p / 2 + 1.6, 1.4, 10]]), pierre, 16);
      A.boite(x1 - x0, 1.2, larg + 1, (x0 + x1) / 2, 10, 0, pierreFoncee); for (const s2 of [1, -1]) A.boite(x1 - x0, 1.2, 0.8, (x0 + x1) / 2, 11.2, s2 * larg / 2, pierre);
    };
    bras(-156, -35, 7); bras(35, 89, 5);
    A.boite(9, 10, larg, -160.5, 0, 0, pierre); A.boite(9, 10, larg, 93.5, 0, 0, pierre); A.boite(70, 10, larg, 0, 0, 0, pierreFoncee);
    A.cylindre(10, 10, 10, 24, 0, 0, 14, pierreFoncee);
    A.boite(4, 5, 7, 0, 10, 14, pierre); A.boite(2, 2.6, 5, 0, 15, 14, bronze); A.boite(1.1, 2.4, 1.1, 0, 17.6, 13.6, bronze); A.boule(0.6, 0, 20.4, 13.6, bronze); A.boite(0.9, 1.8, 1.4, 0, 16.6, 16.6, bronze);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la Conciergerie (x : le long du quai de l'Horloge ; la
  // Seine au nord, en -z)
  // le long bâtiment gothique et son haut toit d'ardoise, ses lucarnes, la tour Bonbec (crénelée), les tours d'Argent et
  // César (toits pointus), la tour de l'Horloge à l'angle et son horloge bleue et or
  function conciergerie(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xE4DCC6), pierreFoncee = A.matiere(0xC9BC9C), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), bleu = A.matiere(0x2D55C8, 0x0A1E5A);
    A.boite(170, 22, 20, -6, 0, 11.6, pierre); A.toit(20.6, 12, 170, -6, 22, 11.6, ardoise);
    const luc = []; for (let x = -80; x <= 70; x += 12) if (Math.abs(x + 25) > 8 && Math.abs(x - 15) > 13) luc.push([2.4, 3, 2.2, x, 22, 4.4]);
    A.boites(luc, pierre); A.toits(luc.map(([, , , x, , z]) => [3.2, 2, 2.6, x, 25, z, Math.PI / 2]), ardoise);
    A.cylindres([[-25.3, 1.1, 5.6, 28], [9.3, -1.9, 5, 30], [21.3, -1.6, 5, 30]], pierre, 20);
    A.cones([[9.3, -1.9, 5.6, 30, 12], [21.3, -1.6, 5.6, 30, 12]], ardoise, 20);
    A.creneaux([Array.from({ length: 13 }, (_, k) => [-25.3 + 5.4 * Math.cos(k * Math.PI / 6), 1.1 + 5.4 * Math.sin(k * Math.PI / 6)])], 28, 0.8, pierreFoncee);
    A.boite(12, 38, 12, 83, 0, 6, pierre); A.pyramide(8.6, 10, 4, 83, 38, 6, ardoise); A.cylindre(1, 1, 3, 8, 83, 47.5, 6, pierre); A.pyramide(1.3, 3, 8, 83, 50.5, 6, ardoise);
    A.plaque(5.4, 5.4, 0.3, 83, 13.5, -0.1, bleu); A.piece(() => new THREE.CylinderGeometry(2, 2, 0.4, 24).rotateX(Math.PI / 2), or, V(83, 16.2, -0.35), null, true);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le Palais-Royal (x : vers l'est-sud-est ; le palais au
  // sud sur la place, en +z ; le jardin au nord, en -z)
  // le palais et ses ailes, la cour d'honneur et les colonnes de Buren, la galerie d'Orléans, les galeries autour du jardin
  // et leurs arcades, les deux massifs de tilleuls, le bassin
  function palaisRoyal(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD7C7A2), ardoise = A.matiere(0x56659A), noir = A.matiere(0x2C2F3A), blanc = A.matiere(0xF7F7F2),
      arbre = A.matiere(0x5DAE58), eau = A.matiere(0x6DC4F0, 0x0E3A55), arcade = A.matiere(0x8C7A5E);
    const aile = (x0, x1, z0, z1, h, hr) => { const lx = x1 - x0, lz = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2; A.boite(lx, h, lz, x, 0, z, pierre);
      if (lx > lz) A.toit(lz + 0.6, hr, lx, x, h, z, ardoise); else A.toit(lx + 0.6, hr, lz, x, h, z, ardoise, Math.PI / 2); };
    aile(-58, 59, 12, 42, 18, 8); aile(-58, -36, -35, 12, 18, 7); aile(37, 59, -35, 12, 18, 7); aile(-59, 58, -82, -35, 18, 9);
    aile(-63, -47, -312, -94, 17, 6); aile(44, 58, -312, -94, 17, 6); aile(-63, 58, -331, -312, 17, 6);
    A.boite(24, 22, 6, 0.5, 0, 40, pierre); A.toit(24, 5, 6, 0.5, 22, 40, pierre, Math.PI / 2);
    A.cylindres([-91, -85].flatMap((z) => Array.from({ length: 26 }, (_, k) => [-45 + k * 3.6, z, 0.5, 7, 0])), pierre, 10);
    A.boites([[95, 1, 2, 0, 7, -91], [95, 1, 2, 0, 7, -85]], pierreFoncee);
    const col = [[], []]; for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) col[(i + j) % 2].push([-28 + i * 7, -28 + j * 8, 0.45, 0.6 + ((i * 7 + j * 3) % 6) * 0.55, 0]);
    A.cylindres(col[0], noir, 10); A.cylindres(col[1], blanc, 10);
    const arc = []; for (let z = -308; z <= -98; z += 4) { arc.push([0.3, 3.6, 2.6, -46.85, 0.2, z]); arc.push([0.3, 3.6, 2.6, 43.85, 0.2, z]); }
    for (let x = -44; x <= 42; x += 4) arc.push([2.6, 3.6, 0.3, x, 0.2, -311.85]);
    A.plaques(arc, arcade);
    A.boites([[10, 7, 150, -30, 0, -200], [10, 7, 150, 27, 0, -200]], arbre);
    A.cylindre(8, 8, 0.7, 28, -1.5, 0, -150, pierreFoncee); A.cylindre(7.3, 7.3, 0.4, 28, -1.5, 0.5, -150, eau);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la place des Vosges (x et z : les côtés de la place ; le
  // pavillon du Roi au sud, en +z, et celui de la Reine au nord)
  // les 36 pavillons de brique et de pierre et leurs hauts toits d'ardoise, les arcades, les fenêtres, le jardin et ses
  // tilleuls, les quatre fontaines, la statue de Louis XIII
  function placeDesVosges(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xC4603F), pierre = A.matiere(0xF1E7D2), ardoise = A.matiere(0x4F5D8C), arcade = A.matiere(0x7A5E4A), arbre = A.matiere(0x5DAE58), eau = A.matiere(0x6DC4F0, 0x0E3A55), blanc = A.matiere(0xF4F1EA);
    const s = 70.5, d = 20, pav = [];
    for (let i = 0; i < 9; i++) { const w = 2 * (s + d) / 9, x = -s - d + w * (i + 0.5); for (const sz of [-1, 1]) pav.push([w, d, x, sz * (s + d / 2), i === 4, 'z', sz]); }
    for (let i = 0; i < 7; i++) { const w = 2 * s / 7, z = -s + w * (i + 0.5); for (const sx of [-1, 1]) pav.push([d, w, sx * (s + d / 2), z, false, 'x', sx]); }
    const rdc = [], corps = [], corniches = [], toits = [], arcs = [], fen = [];
    for (const [lx, lz, x, z, haut, face, sg] of pav) {
      const h = haut ? 17 : 13; rdc.push([lx - 0.2, 4.2, lz - 0.2, x, 0, z]); corps.push([lx - 0.2, h - 4.2, lz - 0.2, x, 4.2, z]); corniches.push([lx, 0.8, lz, x, h - 0.8, z]); toits.push([lx + 0.4, haut ? 13 : 9.5, lz + 0.4, x, h, z]);
      const w = face === 'z' ? lx : lz;
      for (let k = 0; k < 3; k++) { const t = -w / 2 + w * (k + 0.5) / 3;
        if (face === 'z') { const zf = z - sg * (d / 2 + 0.05); arcs.push([w / 3 - 1.6, 3.4, 0.3, x + t, 0.2, zf]); for (const y of [5.5, 9]) fen.push([1.6, 2.4, 0.3, x + t, y, zf]); }
        else { const xf = x - sg * (d / 2 + 0.05); arcs.push([0.3, 3.4, w / 3 - 1.6, xf, 0.2, z + t]); for (const y of [5.5, 9]) fen.push([0.3, 2.4, 1.6, xf, y, z + t]); } }
    }
    A.boites(rdc, pierre); A.boites(corps, brique); A.boites(corniches, pierre); A.comblesN(toits, ardoise); A.plaques(arcs, arcade); A.plaques(fen, pierre);
    A.boites([[7, 9, 118, -57, 0, 0], [7, 9, 118, 57, 0, 0], [104, 9, 7, 0, 0, -57], [104, 9, 7, 0, 0, 57]], arbre);
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) { A.cylindre(5, 5, 0.6, 20, x, 0, z, pierre); A.cylindre(4.4, 4.4, 0.4, 20, x, 0.4, z, eau); A.cylindre(0.6, 1, 2.5, 10, x, 0.6, z, pierre); }
    A.boite(4, 3.5, 6, 0, 0, 0, pierre); A.boite(1.8, 2.4, 4.5, 0, 3.5, 0, blanc); A.boite(1, 2.2, 1, 0, 5.9, -0.4, blanc); A.boule(0.5, 0, 8.6, -0.4, blanc); A.boite(0.8, 1.6, 1.2, 0, 5.4, 2.4, blanc);
    return A.groupe;
  }

  // ---------------------------------------------------------------- l'église Saint-Sulpice (x : l'axe, la façade à l'ouest
  // en -x, sur la place Saint-Sulpice ; la tour nord, la plus haute, en -z)
  // les bas-côtés et les chapelles, la nef et le transept sous leurs toits d'ardoise, l'abside, la chapelle de la Vierge
  // et sa coupole, la façade à deux étages de colonnes, les deux tours (73 et 68 m) et leur étage rond
  function saintSulpice(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE4CF), pierreFoncee = A.matiere(0xD3C5A5), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x7B88B0);
    A.boite(105, 21, 56, 10.5, 0, 0, pierre); A.boite(106, 1.2, 57, 10.5, 21, 0, pierreFoncee);
    A.boite(84, 33, 18, 0, 0, 0, pierre); A.toit(18.6, 9, 84, 0, 33, 0, ardoise);
    A.boite(17, 33, 57, 6.5, 0, 0, pierre); A.toit(17.6, 9, 57, 6.5, 33, 0, ardoise, Math.PI / 2);
    A.abside(9, 33, 42, 0, 0, pierre); A.demiCone(9.5, 9, 42, 33, 0, ardoise);
    A.cylindre(6, 6, 4, 20, 57, 21, 0, pierre); A.dome(6, 1.1, 57, 25, 0, plomb); A.boule(0.8, 57, 32.4, 0, pierreFoncee);
    A.boite(12.5, 30, 56, -47.75, 0, 0, pierre);
    A.cylindres(Array.from({ length: 13 }, (_, k) => [-55.8, -18 + k * 3, 0.85, 13, 1.5]), pierre, 12);
    A.boite(4, 1.5, 42, -55.8, 0, 0, pierreFoncee); A.boite(3.6, 2.2, 42, -55.8, 14.5, 0, pierreFoncee);
    A.cylindres(Array.from({ length: 13 }, (_, k) => [-55.8, -18 + k * 3, 0.7, 11, 16.7]), pierre, 12);
    A.boite(3.6, 2, 42, -55.8, 27.7, 0, pierreFoncee);
    for (const [z, hh] of [[-21, 73], [21, 68]]) { A.boite(14, 50, 14, -49, 0, z, pierre); A.boite(15, 1.6, 15, -49, 48.4, z, pierreFoncee);
      A.cylindre(6.5, 6.5, 13, 20, -49, 50, z, pierre); A.cylindre(7.2, 7.2, 1.4, 20, -49, 63, z, pierreFoncee);
      if (hh > 70) { A.cylindre(5, 5, 7, 20, -49, 64.4, z, pierre); A.cylindre(5.6, 5.6, 1.2, 20, -49, 71.4, z, pierreFoncee); } }
    return A.groupe;
  }

  // les maquettes connues : le monument (identifiant de data/monuments.json), où et comment la poser, et les
  // bâtiments de l'IGN qu'elle remplace (sinon les blocs gris de la BD TOPO resteraient dedans)
  const MODELES = {
    'manuel-tour-eiffel': {
      construire: tourEiffel,
      centre: [2.294508, 48.858255],   // le centre des blocs de la BD TOPO
      orientation: -43.2,              // les côtés de la tour, en degrés depuis l'est (mesurés sur la BD TOPO)
      masquer: ['BATIMENT0000000000162158', 'BATIMENT0000000000162159', 'BATIMENT0000000000162160', 'BATIMENT0000000000162699'],
    },
    // mesures du 3 nov. 2026 sur la BD TOPO (centre et axe du plus grand bâtiment ; le sens : la façade du bon côté)
    Q2981: {   // Notre-Dame : la nef vers l'est-sud-est, les tours à l'ouest
      construire: notreDame, centre: [2.350032, 48.852964], orientation: -27.2,
      // (l'église en plusieurs blocs, les deux tours, et la sacristie au sud du chœur, qui chevauchait le volume)
      masquer: ['BATIMENT0000000305564422', 'BATIMENT0000000305564421', 'BATIMENT0000000245184819', 'BATIMENT0000000245184816', 'BATIMENT0000000245184818', 'BATIMENT0000000245184817', 'BATIMENT0000000245184146'],
    },
    Q64436: {   // l'Arc de triomphe : sa largeur en travers des Champs-Élysées
      construire: arcDeTriomphe, centre: [2.295051, 48.873768], orientation: 53.7,
      masquer: ['BATIMENT0000000000157326'],
    },
    Q28785: {   // le Sacré-Cœur : la façade au sud (vers Paris), le campanile au nord
      construire: sacreCoeur, centre: [2.343013, 48.88668], orientation: 94.5,
      masquer: ['BATIMENT0000000253248831', 'BATIMENT0000000253248827'],
    },
    Q2946: {   // Versailles : la façade des jardins suit 67,7° (ses longs murs) ; les cours vers la ville (est-sud-est)
      construire: versailles, centre: [2.121171, 48.804588], orientation: 67.7,
      masquer: ['BATIMENT0000002488448466', 'BATIMENT0000002488448467', 'BATIMENT0000002496243867', 'BATIMENT0000000322536264', 'BATIMENT0000000322536738'],
    },
    Q180274: {   // Chartres : le chœur au nord-est, les deux flèches au sud-ouest
      construire: chartres, centre: [1.487819, 48.44783], orientation: 43.2,
      masquer: ['BATIMENT0000000335553481', 'BATIMENT0000000335553480', 'BATIMENT0000000335553479'],
    },
    Q187840: {   // l'Opéra Garnier : la façade au sud (vers l'avenue de l'Opéra), la scène au nord
      construire: garnier, centre: [2.331731, 48.871967], orientation: 94.6,
      masquer: ['BATIMENT0000000253245873', 'BATIMENT0000000253245869', 'BATIMENT0000000253247655', 'BATIMENT0000000245200051'],
    },
    Q189503: {   // la Concorde : l'obélisque au centre de la place, les fontaines au nord et au sud (pas de bâtiment à masquer)
      construire: concorde, centre: [2.321111, 48.865556], orientation: 90, masquer: ['BATIMENT0000000245198908'],   // l'obélisque tel que le dessine l'IGN
    },
    Q188856: {   // le Panthéon : le portique à l'ouest (vers la rue Soufflot)
      construire: pantheon, centre: [2.346069, 48.846204], orientation: -19.3,
      masquer: ['BATIMENT0000000253232436', 'BATIMENT0000000241930812'],
    },
    Q184407: {   // Saint-Denis : la façade et sa tour à l'ouest
      construire: saintDenis, centre: [2.359751, 48.935466], orientation: -18.6,
      masquer: ['BATIMENT0000000243405765', 'BATIMENT0000000243405764', 'BATIMENT0000000243405763', 'BATIMENT0000000243405766'],
    },
    Q206823: {   // Reims : la façade au sud-ouest (vers la rue Libergier), le chœur au nord-est
      construire: reims, centre: [4.034011, 49.253812], orientation: 32,
      masquer: ['BATIMENT0000002223520860', 'BATIMENT0000002223520948', 'BATIMENT0000002223520863', 'BATIMENT0000002223520947', 'BATIMENT0000002223520861', 'BATIMENT0000002223520858', 'BATIMENT0000002223520859', 'BATIMENT0000002223520862'],
    },
    Q189764: {   // le Pont du Gard : le long du pont routier qui lui est accolé (du nord-ouest au sud-est), au-dessus du Gardon
      construire: pontDuGard, centre: [4.535363, 43.9473], orientation: -41.8, masquer: [],
    },
    // mesures du 4 nov. 2026 (plans des bâtiments de la BD TOPO dans le repère de chaque maquette)
    Q188190: {   // l'Élysée : la cour d'honneur vers la rue du Faubourg-Saint-Honoré, le jardin au sud (l'IGN n'en donne qu'un contour simplifié)
      construire: elysee, centre: [2.316669, 48.870268], orientation: 63, masquer: ['BATIMENT0000000245171830'],
    },
    Q214654: {   // la chapelle de la Sorbonne : la façade à l'ouest, sur la place ; le portique au nord, sur la cour
      construire: sorbonne, centre: [2.343234, 48.848457], orientation: -17, masquer: ['BATIMENT0000000241937888'],
    },
    Q193193: {   // la Sainte-Chapelle, dans la cour du Palais de justice : la façade à l'ouest, l'abside à l'est
      construire: sainteChapelle, centre: [2.34504, 48.855384], orientation: -31, masquer: ['BATIMENT0000000245190033'],
    },
    Q188977: {   // les Invalides : le Dôme (son portail au sud), la nef de Saint-Louis au nord ; l'hôtel reste dessiné par l'IGN
      construire: invalides, centre: [2.312532, 48.855024], orientation: -4, masquer: ['BATIMENT0000000253244903', 'BATIMENT0000000253244904', 'BATIMENT0000000253244905'],
    },
    Q329852: {   // le Luxembourg : l'entrée au nord (rue de Vaugirard), le jardin au sud
      construire: luxembourg, centre: [2.337302, 48.848552], orientation: -2,
      // (le palais, la galerie et le pavillon d'entrée sur la rue, et une construction récente au milieu de la cour d'honneur)
      masquer: ['BATIMENT0000000241937839', 'BATIMENT0000000241937838', 'BATIMENT0000000241937840', 'BATIMENT0000000241937837', 'BATIMENT0000002496153218'],
    },
    Q201428: {   // Fontainebleau : la cour du Cheval-Blanc, ouverte à l'ouest ; l'escalier en fer à cheval au fond, à l'est
      construire: fontainebleau, centre: [2.698363, 48.40207], orientation: 2,
      masquer: ['BATIMENT0000002202182611', 'BATIMENT0000002202180582', 'BATIMENT0000002202182610', 'BATIMENT0000002202182612', 'BATIMENT0000002202182609', 'BATIMENT0000002202180842'],
    },
    Q205367: {   // Chambord : la façade au nord-ouest (vers le Cosson), l'enceinte au sud-est
      construire: chambord, centre: [1.516973, 47.616233], orientation: 42, masquer: ['BATIMENT0000000321896007', 'BATIMENT0000000321896006'],
    },
    Q106934: {   // Amiens : la façade à l'ouest-nord-ouest, le chœur à l'est-sud-est
      construire: amiens, centre: [2.30209, 49.894578], orientation: -25,
      masquer: ['BATIMENT0000000224085617', 'BATIMENT0000000244893996', 'BATIMENT0000000224085618', 'BATIMENT0000000224085628', 'BATIMENT0000000224084339', 'BATIMENT0000000224084340', 'BATIMENT0000000224084341'],
    },
    Q476516: {   // Rouen : la façade à l'ouest-nord-ouest (la tour Saint-Romain au nord, la tour de Beurre au sud)
      construire: rouen, centre: [1.0951, 49.44017], orientation: -28,
      // (l'église, ses tours, la tour-lanterne, et une petite annexe au nord du chœur, qui perçait les bas-côtés)
      masquer: ['BATIMENT0000000240186452', 'BATIMENT0000000240186424', 'BATIMENT0000000240186425', 'BATIMENT0000000240186426', 'BATIMENT0000000240186427', 'BATIMENT0000000240186428', 'BATIMENT0000000240186429', 'BATIMENT0000000240186430', 'BATIMENT0000002202532424'],
    },
    Q745460: {   // Strasbourg : la façade à l'ouest-sud-ouest, la tour et sa flèche au nord
      construire: strasbourg, centre: [7.751021, 48.581869], orientation: 30, masquer: ['BATIMENT0000002223298147', 'BATIMENT0000002223298145'],
    },
    // lot du 4 nov. 2026 (nuit)
    Q330564: {   // la Madeleine : le portique vers la rue Royale (sud-ouest)
      construire: madeleine, centre: [2.324458, 48.870038], orientation: 63, masquer: ['BATIMENT0000000000158567'],
    },
    Q143463: {   // le palais des Papes : la grande façade à l'ouest, sur la place du Palais
      construire: palaisDesPapes, centre: [4.807538, 43.950766], orientation: -13, masquer: ['BATIMENT0000002206956146', 'BATIMENT0000000297746541', 'BATIMENT0000000297746540', 'BATIMENT0000000297746539', 'BATIMENT0000002206956145'],
    },
    Q193215: {   // Chenonceau : le logis au nord, la galerie traverse le Cher vers le sud
      construire: chenonceau, centre: [1.0706, 47.3249], orientation: 28, masquer: ['BATIMENT0000000323194311', 'BATIMENT0000000323194308', 'BATIMENT0000000323194310', 'BATIMENT0000000323194312', 'BATIMENT0000000323194313', 'BATIMENT0000000323194314', 'BATIMENT0000000323194315', 'BATIMENT0000000323194316', 'BATIMENT0000000323194317', 'BATIMENT0000000323194318'],
    },
    Q651388: {   // le Mont-Saint-Michel : l'église au sommet, le chœur à l'est-nord-est, la Merveille au nord
      construire: montSaintMichel, centre: [-1.5114, 48.6361], orientation: 12, masquer: ['BATIMENT0000000301499771', 'BATIMENT0000000301499768', 'BATIMENT0000000301499767', 'BATIMENT0000000301499754', 'BATIMENT0000000301499752', 'BATIMENT0000000301499769', 'BATIMENT0000000301499749', 'BATIMENT0000000301499748', 'BATIMENT0000000301499750'],   // (et les bâtiments pris dans le rocher)
    },
    Q1075988: {   // le Louvre : l'axe historique ; la pyramide au centre de la cour Napoléon
      construire: louvre, centre: [2.335857, 48.86101], orientation: -20, masquer: ['BATIMENT0000000245184875', 'BATIMENT0000000245185612', 'BATIMENT0000002007491720', 'BATIMENT0000000245160141', 'BATIMENT0000000245160142', 'BATIMENT0000000245184969', 'BATIMENT0000000245185616', 'BATIMENT0000000245185619', 'BATIMENT0000000245185618', 'BATIMENT0000000245185621', 'BATIMENT0000000245185611', 'BATIMENT0000000245185609', 'BATIMENT0000000245185608', 'BATIMENT0000000245185617', 'BATIMENT0000000245185620', 'BATIMENT0000000245185610', 'BATIMENT0000000245185607', 'BATIMENT0000002011662621', 'BATIMENT0000002007491717', 'BATIMENT0000002007491718', 'BATIMENT0000000253246143', 'BATIMENT0000000253248249', 'BATIMENT0000000253248246'],
    },
    Q389269: {   // Carcassonne : les murs et les tours relevés sur la BD TOPO (CARCA)
      construire: carcassonne, centre: [2.3638, 43.2064], orientation: 0, masquer: CARCA.ids.map((s) => 'BATIMENT000000' + s),
    },
    Q457318: {   // le Grand Palais : la nef nord-sud à l'est, le palais de la Découverte à l'ouest
      construire: grandPalais, centre: [2.311912, 48.866167], orientation: -2, masquer: ['BATIMENT0000000245172546', 'BATIMENT0000000245172471', 'BATIMENT0000000245172547'],
    },
    Q390418: {   // le pont Alexandre-III : dans l'axe des Invalides, l'arche au-dessus de la Seine (berges relevées sur la carte)
      construire: pontAlexandre, centre: [2.313545, 48.863672], orientation: 86, masquer: ['BATIMENT0000000241926834', 'BATIMENT0000000241926789'],
    },
    Q335277: {   // le Pont-Neuf : du nord au sud, par la pointe de l'île de la Cité (berges relevées sur la carte)
      construire: pontNeuf, centre: [2.341236, 48.857048], orientation: -119.5, masquer: [],
    },
    Q138101: {   // la Conciergerie : la façade sur le quai de l'Horloge (le reste du Palais de justice reste celui de l'IGN)
      construire: conciergerie, centre: [2.3452, 48.8565], orientation: -21.4, masquer: ['BATIMENT0000000245185645', 'BATIMENT0000000245185646', 'BATIMENT0000000245185647'],
    },
    Q329948: {   // le Palais-Royal : le palais au sud, le jardin au nord
      construire: palaisRoyal, centre: [2.3369, 48.8633], orientation: -20, masquer: ['BATIMENT0000000245185223', 'BATIMENT0000002007520021', 'BATIMENT0000000245185414', 'BATIMENT0000000245185422', 'BATIMENT0000000245185421', 'BATIMENT0000000245185413', 'BATIMENT0000000245185412', 'BATIMENT0000000253248247', 'BATIMENT0000000245185410', 'BATIMENT0000000245185418', 'BATIMENT0000000245185416', 'BATIMENT0000000245185420', 'BATIMENT0000000245185415', 'BATIMENT0000000245182221', 'BATIMENT0000000245182210', 'BATIMENT0000000245182220', 'BATIMENT0000000245182209', 'BATIMENT0000000245185419', 'BATIMENT0000000245185417', 'BATIMENT0000000245182421', 'BATIMENT0000000245182422', 'BATIMENT0000000245182420', 'BATIMENT0000000245182419', 'BATIMENT0000000245182418', 'BATIMENT0000000245182423', 'BATIMENT0000000245182424', 'BATIMENT0000000245182425', 'BATIMENT0000000245182426', 'BATIMENT0000000253245823', 'BATIMENT0000000245185423', 'BATIMENT0000000245182427', 'BATIMENT0000000245182428', 'BATIMENT0000000245182429', 'BATIMENT0000000245182222', 'BATIMENT0000000245182430', 'BATIMENT0000000245182223'],
    },
    Q898629: {   // la place des Vosges : le centre du jardin ; le pavillon du Roi au sud
      construire: placeDesVosges, centre: [2.365538, 48.855621], orientation: -16,
      masquer: ['BATIMENT0000000245197734', 'BATIMENT0000000245185831', 'BATIMENT0000000245185829', 'BATIMENT0000000245197738', 'BATIMENT0000000245197732', 'BATIMENT0000000245197717', 'BATIMENT0000000245197715', 'BATIMENT0000000245197731', 'BATIMENT0000000245197694', 'BATIMENT0000000245197714', 'BATIMENT0000000245197703', 'BATIMENT0000000245197705', 'BATIMENT0000000245197707', 'BATIMENT0000000245197706', 'BATIMENT0000000245197695', 'BATIMENT0000000245197687', 'BATIMENT0000000245197685', 'BATIMENT0000000245197686', 'BATIMENT0000000245185835', 'BATIMENT0000000245185710', 'BATIMENT0000000245185711', 'BATIMENT0000000245185712', 'BATIMENT0000000245185713', 'BATIMENT0000000245185714', 'BATIMENT0000000245185715', 'BATIMENT0000000245185716', 'BATIMENT0000000245197745', 'BATIMENT0000000245197741', 'BATIMENT0000000245197823', 'BATIMENT0000000245197749', 'BATIMENT0000000245197824', 'BATIMENT0000000245197697', 'BATIMENT0000002496152971', 'BATIMENT0000000245197698', 'BATIMENT0000000245197709', 'BATIMENT0000000245197711', 'BATIMENT0000000245197721', 'BATIMENT0000000245197712', 'BATIMENT0000000245197710', 'BATIMENT0000000245197723', 'BATIMENT0000000245197439', 'BATIMENT0000000245197722', 'BATIMENT0000000245197740', 'BATIMENT0000000245197737', 'BATIMENT0000000245197736', 'BATIMENT0000000245197727', 'BATIMENT0000000245197726', 'BATIMENT0000000245197730', 'BATIMENT0000000245197725', 'BATIMENT0000000245197440'],
    },
    Q295844: {   // Saint-Sulpice : la façade à l'ouest, sur la place
      construire: saintSulpice, centre: [2.334821, 48.851001], orientation: 6, masquer: ['BATIMENT0000000241937855', 'BATIMENT0000000241937858', 'BATIMENT0000000241937859', 'BATIMENT0000000241937856', 'BATIMENT0000000253245361'],
    },
  };
  const MASQUES = Object.values(MODELES).flatMap((m) => m.masquer);

  // la couche MapLibre : une scène Three.js dessinée dans le contexte de la carte (profondeur partagée avec les
  // bâtiments en relief) ; chaque maquette est placée par une matrice (mercator, mètres, y vers le haut)
  function couche(maplibregl, THREE) {
    const poses = [];
    return {
      id: 'maquettes', type: 'custom', renderingMode: '3d',
      onAdd(map, gl) {
        this.map = map; this.camera = new THREE.Camera(); this.scene = new THREE.Scene();
        // La scène reste en mètres autour de chaque monument (x vers l'est, y vers le haut, z vers le sud) ; la place du
        // monument sur la carte entre dans la matrice de la caméra, calculée en double précision (render). Avant (3 nov.
        // 2026), les objets portaient leurs coordonnées mercator (≈ 0,5, un mètre ≈ 2,5e-8) : en simple précision, dans la
        // carte graphique, positions et profondeurs se perdaient à 2 m près ; de près, le devant et le derrière se
        // mélangeaient par plaques et les arêtes tremblaient.
        // La lumière vient d'en haut à gauche (bible § 2) ; un ciel clair et un sol bleuté pour les faces à l'ombre.
        const ciel = new THREE.HemisphereLight(0xffffff, 0x8FA3D6, LUMIERE.ciel); this.scene.add(ciel);
        const soleil = new THREE.DirectionalLight(0xffffff, LUMIERE.soleil); soleil.position.set(-0.8, 1.6, -0.6); this.scene.add(soleil);
        for (const [id, m] of Object.entries(MODELES)) {
          const g = m.construire(THREE); g.rotation.y = m.orientation * Math.PI / 180;
          const objet = new THREE.Group(); objet.add(g); this.scene.add(objet);
          const mc = maplibregl.MercatorCoordinate.fromLngLat(m.centre, 0), s = mc.meterInMercatorCoordinateUnits();
          // mètres (x est, y haut, z sud) → mercator (x est, y sud, z haut)
          const place = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          poses.push({ id, objet, place, centre: m.centre });
        }
        // rien ne bouge : les positions des pièces se calculent une fois pour toutes (sinon Three.js les recalcule à chaque
        // dessin, pour toutes les pièces de tous les monuments, 22 fois par image : 10 ms de plus par image, 4 nov. 2026)
        this.scene.updateMatrixWorld(true); if ('matrixWorldAutoUpdate' in this.scene) this.scene.matrixWorldAutoUpdate = false; else this.scene.autoUpdate = false;
        this.loin = []; this.pres = []; this.scene.traverse((o) => { if (o.userData.contour === 'loin') this.loin.push(o); else if (o.userData.contour === 'pres') this.pres.push(o); }); this.deLoin = true;
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
      },
      render(gl, matrix) {
        const z = this.map.getZoom(); if (z < 12) return;   // de trop loin, la tour n'est qu'un point
        const deLoin = z < ZOOM_PRES; if (deLoin !== this.deLoin) { this.deLoin = deLoin; this.loin.forEach((o) => { o.visible = deLoin; }); this.pres.forEach((o) => { o.visible = !deLoin; }); }
        // un monument à la fois, avec sa propre matrice (carte × place du monument, en double précision) ; Three.js écarte
        // de lui-même les monuments hors de l'écran
        const carte = new THREE.Matrix4().fromArray(matrix);
        const b = this.map.getBounds(), marge = 0.02;   // les monuments loin de l'écran ne sont pas dessinés du tout
        this.renderer.resetState();
        for (const p of poses) {
          const [lon, lat] = p.centre;
          if (lon < b.getWest() - marge || lon > b.getEast() + marge || lat < b.getSouth() - marge || lat > b.getNorth() + marge) continue;
          for (const q of poses) q.objet.visible = q === p;
          this.camera.projectionMatrix.multiplyMatrices(carte, p.place); this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
          this.renderer.render(this.scene, this.camera);
        }
      },
      onRemove() { if (this.renderer) this.renderer.dispose(); },
    };
  }

  const api = { MODELES, MASQUES, couche, tourEiffel, cathedrale, notreDame, chartres, reims, saintDenis, arcDeTriomphe, sacreCoeur, pantheon, garnier, concorde, pontDuGard, versailles,
    elysee, sorbonne, sainteChapelle, invalides, luxembourg, fontainebleau, chambord, amiens, rouen, strasbourg,
    madeleine, palaisDesPapes, chenonceau, montSaintMichel, louvre, carcassonne, CARCA,
    grandPalais, pontAlexandre, pontNeuf, conciergerie, palaisRoyal, placeDesVosges, saintSulpice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Maquettes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
