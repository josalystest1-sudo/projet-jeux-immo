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
    if (o.transept) { A.boite(tL, o.mur, o.transept, o.xT, 0, 0, pierre); A.toit(tL, o.toitH, o.transept, o.xT, o.mur, 0, toit, Math.PI / 2); }   // (Bourges n'en a pas)
    if (!o.chevetPlat) { A.abside(demi, o.mur, o.E, 0, 0, pierre); A.demiCone(demi + 0.5, o.toitH - 1, o.E, o.mur, 0, toit); }   // (Laon : un chevet plat)
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

  // ---------------------------------------------------------------- le château de Vaux-le-Vicomte (x : vers l'est ; la cour
  // d'honneur au nord, en -z ; les jardins au sud, en +z) ; la BD TOPO ne le dessine pas : posé au point de Wikidata
  // le corps de logis et ses hauts toits d'ardoise, les quatre pavillons, le grand salon ovale et son dôme côté jardin, la
  // terrasse, les douves
  function vaux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EAD6), pierreFoncee = A.matiere(0xD8C9A8), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    A.plaques([[128, 0.3, 12, 0, 0.1, -43], [128, 0.3, 12, 0, 0.1, 43], [12, 0.3, 74, -58, 0.1, 0], [12, 0.3, 74, 58, 0.1, 0]], eau);
    A.boite(104, 2, 74, 0, 0, 0, pierreFoncee);
    A.boite(64, 16, 26, 0, 2, 0, pierre); A.toit(26.6, 12, 64, 0, 18, 0, ardoise);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { A.boite(16, 18, 18, sx * 32, 2, sz * 13, pierre); A.combles(16.6, 13, 18.6, sx * 32, 20, sz * 13, ardoise); }
    A.boite(18, 20, 6, 0, 2, -14, pierre); A.toit(18, 5, 6, 0, 22, -14, pierre, Math.PI / 2);
    A.piece((e) => new THREE.CylinderGeometry(11 + e, 11 + e, 18 + 2 * e, 32).translate(0, 9, 0).scale(1.3, 1, 1), pierre, A.V(0, 2, 13));
    A.piece((e) => new THREE.SphereGeometry(11 + e, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 1.3, 1), ardoise, A.V(0, 20, 13));
    A.cylindre(2.2, 2.2, 5, 12, 0, 33.5, 13, pierre); A.dome(2.2, 1.2, 0, 38.5, 13, ardoise); A.boule(0.8, 0, 41.6, 13, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Vincennes (x : vers l'est ; la tour du
  // Village au nord, en -z)
  // l'enceinte crénelée et ses tours, la tour du Village, le donjon (50 m) et ses tourelles, son châtelet et ses douves,
  // la Sainte-Chapelle, les pavillons du Roi et de la Reine
  function vincennes(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DDC8), pierreFoncee = A.matiere(0xCABD9E), ardoise = A.matiere(0x4F5D8C), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    const tour = [[-105, -167], [112, -167], [112, 178], [-105, 178]], murs = [[[-105, -167], [112, -167], [112, 178], [-105, 178], [-105, -167]]];
    A.remparts(murs, 15, 4, pierre); A.creneaux(murs, 15, 1, pierreFoncee);
    const tours = tour.concat([[112, -50], [112, 65], [-105, -50], [-105, 65], [15, 178]]);
    A.boites(tours.map(([x, z]) => [16, 18, 16, x, 0, z]), pierre); A.creneaux(tours.map(([x, z]) => A.tourDe(17, 17, x, z)), 18, 1, pierreFoncee);
    A.boite(25, 42, 13, 15, 0, -163, pierre); A.creneaux([A.tourDe(26, 14, 15, -163)], 42, 1, pierreFoncee); A.cylindres([[3, -169, 2.2, 14, 32], [27, -169, 2.2, 14, 32], [3, -157, 2.2, 14, 32], [27, -157, 2.2, 14, 32]], pierre, 12);
    A.cones([[3, -169, 2.6, 46, 5], [27, -169, 2.6, 46, 5], [3, -157, 2.6, 46, 5], [27, -157, 2.6, 46, 5]], ardoise, 12);
    // le donjon et son châtelet
    A.plaques([[71, 0.3, 8, -77.5, 0.1, -10], [71, 0.3, 8, -77.5, 0.1, 57], [8, 0.3, 75, -46, 0.1, 23.5]], eau);
    const ch = [A.tourDe(55, 57, -77.5, 23.5)];
    A.remparts(ch, 14, 3, pierre); A.creneaux(ch, 14, 0.9, pierreFoncee);
    A.cylindres([[-105, -5, 4.5, 17], [-50, -5, 4.5, 17], [-105, 52, 4.5, 17], [-50, 52, 4.5, 17]], pierre, 16); A.cones([[-105, -5, 5, 17, 7], [-50, -5, 5, 17, 7], [-105, 52, 5, 17, 7], [-50, 52, 5, 17, 7]], ardoise, 16);
    A.boite(12, 24, 14, -50, 0, 23.5, pierre); A.creneaux([A.tourDe(13, 15, -50, 23.5)], 24, 0.9, pierreFoncee);
    A.boite(17, 50, 17, -75, 0, 23, pierre); A.boite(18.4, 2, 18.4, -75, 46, 23, pierreFoncee); A.creneaux([A.tourDe(18.4, 18.4, -75, 23)], 48, 1, pierreFoncee);
    A.cylindres([[-84, 14, 2.6, 34, 20], [-66, 14, 2.6, 34, 20], [-84, 32, 2.6, 34, 20], [-66, 32, 2.6, 34, 20]], pierre, 14);
    A.cones([[-84, 14, 2.9, 54, 6], [-66, 14, 2.9, 54, 6], [-84, 32, 2.9, 54, 6], [-66, 32, 2.9, 54, 6]], ardoise, 14);
    // la Sainte-Chapelle
    A.boite(36, 22, 15, 54, 0, 42, pierre); A.abside(7.5, 22, 72, 0, 42, pierre); A.toit(15.6, 13, 36, 54, 22, 42, ardoise); A.demiCone(8, 12, 72, 22, 42, ardoise);
    A.boite(3, 30, 16, 34.5, 0, 42, pierre); A.toit(16, 8, 3, 34.5, 30, 42, pierre); A.piece((e) => new THREE.CylinderGeometry(4 + e, 4 + e, 0.8 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(32.8, 20, 42));
    A.plaques([-6, 2, 10, 18].flatMap((dx) => [[4, 13, 0.4, 54 + dx, 5, 49.6], [4, 13, 0.4, 54 + dx, 5, 34.4]]), vitrail);
    // les pavillons du Roi et de la Reine
    for (const x of [-53.5, 103.5]) { A.boite(17, 20, 103, x, 0, 126.5, pierre); A.toit(17.6, 9, 103, x, 20, 126.5, ardoise, Math.PI / 2); }
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château de Blois (x : vers le nord-est ; la cour au
  // milieu ; l'aile François Ier au nord-ouest, en -z)
  // l'aile Gaston d'Orléans (pierre, dôme), l'aile François Ier (la façade des Loges, l'escalier à vis dans la cour),
  // l'aile Louis XII (brique et pierre), la chapelle Saint-Calais
  function blois(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF1E8D2), pierreFoncee = A.matiere(0xD8C8A6), brique = A.matiere(0xC4603F), ardoise = A.matiere(0x4F5D8C), loge = A.matiere(0x6E5E50), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(24, 20, 91, -38, 0, -12.5, pierre); A.toit(24.6, 9, 91, -38, 20, -12.5, ardoise, Math.PI / 2); A.domeCarre(16, 9, 18, -38, 26, -12.5, ardoise); A.boule(0.8, -38, 35.6, -12.5, or);
    A.boite(84, 22, 18, 16, 0, -51, pierre); A.toit(18.6, 11, 84, 16, 22, -51, ardoise);
    A.plaques([5, 11, 17].flatMap((y) => Array.from({ length: 12 }, (_, k) => [4.2, 4, 0.3, -21 + k * 6.6, y, -60.1])), loge);
    A.boites([-20, 0, 25, 48].map((x) => [1.8, 9, 3, x, 26, -51]), pierreFoncee);
    A.cylindre(5, 5, 22, 8, 10, 0, -40.5, pierre); A.pyramide(5.6, 6, 8, 10, 22, -40.5, ardoise);
    A.plaques(Array.from({ length: 4 }, (_, k) => [3, 3.4, 0.3, 10, 3 + k * 4.5, -35.4]), loge);
    A.boite(20, 18, 82, 49, 0, -20, brique, -0.22); A.toit(20.6, 9, 82, 49, 18, -20, ardoise, Math.PI / 2 - 0.22);
    A.boite(28, 16, 18, 34, 0, 5.5, brique); A.toit(18.6, 8, 28, 34, 16, 5.5, ardoise);
    A.boite(18, 12, 10, 9, 0, 9, pierre); A.toit(10.6, 7, 18, 9, 12, 9, ardoise); A.pyramide(1.6, 8, 8, 3, 18, 9, ardoise);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château d'Amboise (x : le long de la Loire ; le logis
  // du Roi au nord, la tour des Minimes à l'est, la chapelle Saint-Hubert au sud-ouest)
  function amboise(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EBDA), pierreFoncee = A.matiere(0xD9CCB0), ardoise = A.matiere(0x4F5D8C);
    A.boite(60, 23, 14, 2, 0, 5, pierre); A.toit(14.6, 12, 60, 2, 23, 5, ardoise);
    const luc = Array.from({ length: 7 }, (_, k) => [2.4, 4.2, 2.2, -22 + k * 7.6, 22, -1.6]);
    A.boites(luc, pierre); A.toits(luc.map(([, , , x, , z]) => [3.2, 2.6, 2.6, x, 26.2, z, Math.PI / 2]), ardoise);
    A.boites([-20, 4, 26].map((x) => [1.8, 8, 3, x, 30, 5]), pierreFoncee);
    A.cylindre(10.5, 10.5, 26, 32, 20, 0, -2, pierre); A.cylindre(11, 11, 1.4, 32, 20, 24.6, -2, pierreFoncee); A.pyramide(11, 5, 32, 20, 26, -2, ardoise);
    A.boite(10, 20, 30, 11, 0, 27, pierre); A.toit(10.6, 7, 30, 11, 20, 27, ardoise, Math.PI / 2);
    A.boite(12, 10, 6, -68.5, 0, 58.5, pierre); A.boite(6, 10, 12, -68.5, 0, 58.5, pierre); A.toit(6.6, 6, 12, -68.5, 10, 58.5, ardoise); A.toit(6.6, 6, 12, -68.5, 10, 58.5, ardoise, Math.PI / 2);
    A.pyramide(1.6, 10, 8, -68.5, 14, 58.5, ardoise);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le château d'If (x : vers l'est ; sur son île)
  // le donjon carré autour de sa cour, ses trois tours rondes (la plus grosse : Saint-Christophe), les créneaux
  function chateauIf(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6CF), pierreFoncee = A.matiere(0xD3C5A2);
    A.boites([[32, 17, 8, 5, 0, -1], [32, 17, 8, 5, 0, 19], [8, 17, 12, -7, 0, 9], [8, 17, 12, 17, 0, 9]], pierre);
    A.creneaux([A.tourDe(32, 28, 5, 9)], 17, 1, pierreFoncee);
    const tours = [[-13, -1, 8, 22], [22, -6, 5.5, 19], [22, 22, 5.5, 19]];
    A.cylindres(tours, pierre, 24);
    A.creneaux(tours.map(([x, z, r, h]) => Array.from({ length: 13 }, (_, k) => [x + (r - 0.4) * Math.cos(k * Math.PI / 6), z + (r - 0.4) * Math.sin(k * Math.PI / 6)])), 19, 0.8, pierreFoncee);
    A.creneaux([Array.from({ length: 13 }, (_, k) => [-13 + 7.6 * Math.cos(k * Math.PI / 6), -1 + 7.6 * Math.sin(k * Math.PI / 6)])], 22, 0.8, pierreFoncee);
    return A.groupe;
  }

  // ---------------------------------------------------------------- Notre-Dame-de-la-Garde (x : l'axe, le clocher à
  // l'ouest-nord-ouest en -x) : sur son fort (la carte est plate), la basilique aux pierres blanches et vertes, ses
  // coupoles, le clocher et la Vierge dorée
  function notreDameDeLaGarde(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE2), vert = A.matiere(0x5E8C6A), fort = A.matiere(0xCFC4AA), fortFonce = A.matiere(0xB5A988), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(62, 12, 52, -2.5, 0, 0, fort); A.creneaux([A.tourDe(62, 52, -2.5, 0)], 12, 1, fortFonce);
    A.boite(36, 14, 14, -1, 12, 8, pierre); A.toit(14.6, 5, 36, -1, 26, 8, vert);
    A.plaques([16, 19.5, 23].map((y) => [36.4, 1.2, 14.4, -1, y, 8]), vert);
    A.abside(7, 14, 17, 12, 8, pierre); A.dome(7.2, 0.8, 17, 26, 8, vert);
    A.boite(14, 14, 22, 6, 12, 8, pierre); A.cylindre(6, 6, 4, 20, 6, 26, 8, pierre); A.dome(6, 1, 6, 30, 8, vert); A.cylindre(1, 1, 2.5, 8, 6, 35.8, 8, pierre);
    A.boite(10, 32, 10, -24, 12, 8, pierre); A.plaques([18, 24, 30, 36].map((y) => [10.4, 1.2, 10.4, -24, y, 8]), vert);
    A.boite(11, 1.6, 11, -24, 44, 8, vert); A.cylindre(3.6, 4.2, 10, 12, -24, 45.6, 8, pierre);
    A.cylindre(0.9, 1.7, 8, 12, -24, 55.6, 8, or); A.boule(1, -24, 64.4, 8, or); A.boite(0.8, 1.2, 0.8, -24, 63, 9.4, or);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le viaduc de Millau (x : vers l'est ; le long de l'A75,
  // du nord au sud, 2 460 m) : la carte est plate, le tablier est posé à 100 m (au lieu des 270 m au-dessus du Tarn)
  // le tablier blanc, ses sept piles fendues en deux en haut, les sept pylônes en Y renversé et leurs haubans
  function viaducDeMillau(THREE) {
    const A = atelier(THREE), V = A.V;
    const beton = A.matiere(0xEDEDE8), tablier = A.matiere(0xF7F7F2), hauban = A.matiere(0xF2C94C, 0x4A3A00), route = A.matiere(0x9C9FA6);
    const P0 = [-90, -1221], C = [21.5, 0], P1 = [183, 1221], H = 100;
    const pt = (t) => [(1 - t) * (1 - t) * P0[0] + 2 * t * (1 - t) * C[0] + t * t * P1[0], (1 - t) * (1 - t) * P0[1] + 2 * t * (1 - t) * C[1] + t * t * P1[1]];
    const tan = (t) => { const a = pt(Math.max(0, t - 0.001)), b = pt(Math.min(1, t + 0.001)), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const ligne = Array.from({ length: 41 }, (_, k) => pt(k / 40));
    A.remparts([ligne], 4.2, 32, tablier, H);
    A.piece(() => A.fusion(ligne.slice(1).map((b, i) => { const a = ligne[i]; return new THREE.BoxGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.6, 0.2, 22).rotateY(Math.atan2(-(b[1] - a[1]), b[0] - a[0])).translate((a[0] + b[0]) / 2, H + 4.3, (a[1] + b[1]) / 2); })), route, null, null, true);
    const piles = [], pyl = [], cables = [];
    for (let k = 0; k < 7; k++) {
      const t = (204 + k * 342) / 2460, [x, z] = pt(t), [tx, tz] = tan(t), r = Math.atan2(-tz, tx);
      piles.push([22, H - 40, 16, x, 0, z, r]);
      for (const s of [1, -1]) piles.push([8, 40, 14, x + s * 6 * tx, H - 40, z + s * 6 * tz, r]);
      for (const s of [1, -1]) A.poutre(V(x + s * 9 * tx, H + 4.2, z + s * 9 * tz), V(x, H + 34, z), 3, 2.2, beton);
      pyl.push([x, z, 1.4, 53, H + 34, 1.8]);
      for (let c = 1; c <= 11; c++) for (const s of [1, -1]) { const ya = H + 34 + c * 4.6, d = 12 + c * 13, b = [x + s * d * tx, H + 4.4, z + s * d * tz], a = [x, ya, z];
        const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = v.length(); const g = new THREE.BoxGeometry(0.35, L, 0.35);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); cables.push(g); }
    }
    A.boites(piles, beton); A.cylindres(pyl, beton, 8);
    A.piece(() => A.fusion(cables), hauban, null, null, true);
    return A.groupe;
  }

  // ---------------------------------------------------------------- les dernières cathédrales et abbayes nationales
  // Bourges : pas de transept, deux étages de bas-côtés, les doubles arcs-boutants, les deux tours (65 et 55 m), cinq
  // portails
  const bourges = (THREE) => cathedrale(THREE, { F: -52, E: 36, larg: 31, mur: 36, toitH: 14, xT: 0, transept: 0, cote: 16, facadeH: 46, rose: 6.5, roseY: 34, arcs: false,
    tours: [{ z: -19, h: 65 }, { z: 18, h: 55 }],
    plus: (A, m) => {
      for (const s of [1, -1]) A.boite(84, 11, 9, -6, 0, s * 28, m.pierreFoncee);
      A.abside(25, 11, 36, 0, 0, m.pierreFoncee);
      for (let x = -36; x <= 32; x += 12) for (const s of [1, -1]) {
        A.boite(2.6, 24, 3, x, 0, s * 33, m.pierreFoncee);
        A.poutre(A.V(x, 22, s * 33), A.V(x, 27, s * 25), 1.8, 1.4, m.pierreFoncee); A.poutre(A.V(x, 27, s * 25), A.V(x, 33, s * 16.5), 1.6, 1.2, m.pierreFoncee); }
      A.boite(10, 30, 12, -52, 0, 30, m.pierre);
    } });
  // Nantes : la nef très haute (37,5 m), le transept, les deux tours plates de la façade (63 m)
  const nantes = (THREE) => cathedrale(THREE, { F: -47, E: 43, larg: 26, mur: 37.5, toitH: 12, xT: 18, transept: 52, transeptL: 14, cote: 12, facadeH: 44, rose: 5, pierre: 0xF2EEE4,
    tours: [{ z: -10, h: 63 }, { z: 10, h: 63 }] });
  // Vézelay : la nef romane basse, le narthex, la tour Saint-Michel au sud de la façade, le clocher de la croisée, le
  // chœur gothique plus haut et ses chapelles ; des toits de tuiles
  const vezelay = (THREE) => cathedrale(THREE, { F: -56, E: 43, larg: 22, mur: 18, toitH: 8, xT: 18, transept: 36, transeptL: 12, cote: 10, facadeH: 24, rose: 3, pierre: 0xEFE2C6, pierreFoncee: 0xD6C29C,
    toit: 0xB0644A, toitFonce: 0x8E4E3A, arcs: false,
    tours: [{ z: 10, h: 37, fleche: 6, r: 6.5, seg: 4 }], flecheCroisee: { tour: 7, cote: 9, h: 6, r: 6.4, seg: 4 },
    plus: (A, m) => { A.boite(26, 24, 22, 31, 0, 0, m.pierre); A.toit(22.6, 9, 26, 31, 24, 0, m.toit); A.abside(11, 24, 44, 0, 0, m.pierre); A.demiCone(11.5, 9, 44, 24, 0, m.toit); A.abside(16, 10, 44, 0, 0, m.pierreFoncee); } });

  // Beauvais : le chœur gothique le plus haut du monde (48,5 m sous la voûte) et le transept, sans nef ; ses arcs-boutants
  // ; ses rosaces au nord et au sud (x : l'axe, le chœur à l'est ; le chœur sur l'axe z = -9)
  function beauvais(THREE) {
    const A = atelier(THREE), V = A.V, Z = -9;
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD3C4A2), ardoise = A.matiere(0x56659A), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(41, 46, 30, 15.5, 0, Z, pierre); A.abside(15, 46, 36, 0, Z, pierre); A.toit(30.6, 18, 41, 15.5, 46, Z, ardoise); A.demiCone(15.5, 17, 36, 46, Z, ardoise);
    for (const s of [1, -1]) A.boite(41, 20, 10, 15.5, 0, Z + s * 20, pierreFoncee);
    A.abside(25, 20, 36, 0, Z, pierreFoncee);
    for (const x of [-2, 8, 18, 28]) for (const s of [1, -1]) { A.boite(2.6, 34, 3.2, x, 0, Z + s * 29, pierreFoncee); A.poutre(V(x, 32, Z + s * 29), V(x, 42, Z + s * 15.5), 1.8, 1.4, pierreFoncee); }
    A.boite(14, 46, 66, -21, 0, Z, pierre); A.toit(14.6, 16, 66, -21, 46, Z, ardoise, Math.PI / 2);
    for (const s of [1, -1]) { A.boite(16, 50, 4, -21, 0, Z + s * 33, pierre); A.toit(16, 9, 4, -21, 50, Z + s * 33, pierre, Math.PI / 2);
      A.piece((e) => new THREE.CylinderGeometry(5 + e, 5 + e, 0.8 + 2 * e, 28).rotateX(Math.PI / 2), vitrail, V(-21, 34, Z + s * 35.2)); }
    return A.groupe;
  }

  // ---------------------------------------------------------------- ce qui reste de l'abbaye de Cluny (x : vers l'est-sud-est)
  // le bras sud du grand transept, le clocher de l'Eau-Bénite (octogonal, 62 m) et le clocher de l'Horloge ; les bâtiments
  // du XVIIIe siècle autour du cloître restent ceux de l'IGN
  function cluny(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), tuile = A.matiere(0xB0644A), tuileFoncee = A.matiere(0x8E4E3A);
    A.boite(14, 30, 11, -5, 0, -54.5, pierre); A.toit(14.6, 9, 11, -5, 30, -54.5, tuile, Math.PI / 2);
    A.boite(12, 34, 10, -5, 0, -55, pierre); A.cylindre(6, 6, 16, 8, -5, 34, -55, pierre); A.cylindre(6.6, 6.6, 1.2, 8, -5, 49.4, -55, pierreFoncee); A.pyramide(6.6, 12, 8, -5, 50.6, -55, tuileFoncee);
    A.boite(6, 36, 6, -5, 0, -52, pierre); A.pyramide(4.4, 6, 4, -5, 36, -52, tuileFoncee);
    return A.groupe;
  }

  // ---------------------------------------------------------------- l'abbaye de Fontenay (x : vers l'est-nord-est ; l'église
  // au nord, en -z, la façade à l'ouest ; le cloître au milieu ; la forge au sud)
  // l'église cistercienne sans clocher, son transept et son chevet plat, le cloître et ses galeries, le bâtiment des moines
  // (dortoir), la forge ; des toits de tuiles plates
  function fontenay(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), tuile = A.matiere(0xA65E44), arcade = A.matiere(0x7E6A54);
    A.boite(48, 8, 26, 1, 0, -76, pierreFoncee); A.boite(48, 15, 16, 1, 0, -76, pierre); A.toit(16.6, 7, 48, 1, 15, -76, tuile);
    A.boite(12, 15, 32, 31, 0, -72, pierre); A.toit(12.6, 6, 32, 31, 15, -72, tuile, Math.PI / 2);
    A.boite(10, 13, 10, 42, 0, -76, pierre); A.toit(10.6, 5, 10, 42, 13, -76, tuile);
    A.boite(2, 4, 4, -23, 15, -76, pierre); A.toit(4.4, 2, 2, -23, 19, -76, pierre, Math.PI / 2);
    const gal = [[31, 5, 5, 7.5, 0, -57.5], [31, 5, 5, 7.5, 0, -27.5], [5, 5, 25, -8.5, 0, -42.5], [5, 5, 25, 23.5, 0, -42.5]];
    A.boites(gal, pierre); A.toits(gal.map(([lx, , lz, x, , z]) => (lx > lz ? [lz + 0.6, 2.4, lx, x, 5, z, 0] : [lx + 0.6, 2.4, lz, x, 5, z, Math.PI / 2])), tuile);
    const arcs = []; for (let x = -4; x <= 19; x += 3.2) { arcs.push([2, 3, 0.3, x, 0.6, -54.85]); arcs.push([2, 3, 0.3, x, 0.6, -30.15]); } for (let z = -51; z <= -34; z += 3.2) { arcs.push([0.3, 3, 2, -5.85, 0.6, z]); arcs.push([0.3, 3, 2, 20.85, 0.6, z]); }
    A.plaques(arcs, arcade);
    A.boite(14, 12, 60, 40, 0, -28, pierre); A.toit(14.6, 7, 60, 40, 12, -28, tuile, Math.PI / 2);
    A.boite(56, 9, 14, 26, 0, 41, pierre); A.toit(14.6, 5, 56, 26, 9, 41, tuile);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la chapelle Notre-Dame-du-Haut de Ronchamp (Le Corbusier)
  // (x : vers l'est) : les murs blancs (le mur sud épais et ses petites fenêtres de couleur), le grand toit brun en coque, la
  // haute tour du sud-ouest et les deux tours du nord, leurs capuchons arrondis
  function ronchamp(THREE) {
    const A = atelier(THREE);
    const blanc = A.matiere(0xF7F5EE), beton = A.matiere(0x8C7A66), bleu = A.matiere(0x3F6FE0, 0x1C3C9E), rouge = A.matiere(0xE23B3B, 0x5A0A0A), jaune = A.matiere(0xFFD23F, 0x5A4A00);
    A.boite(34, 11, 3, -4, 0, 14.5, blanc); A.boite(2.4, 10, 26, 12, 0, 2, blanc); A.boite(32, 9, 2.4, -5, 0, -10, blanc); A.boite(2.4, 9, 22, -20, 0, 2, blanc);
    A.boite(28, 8, 22, -4, 0, 2, blanc);
    const coque = new THREE.Shape(); coque.moveTo(-13, 10.5); coque.quadraticCurveTo(0, 8.2, 14.5, 14.5); coque.lineTo(14.5, 17); coque.quadraticCurveTo(0, 10.6, -13, 12.4); coque.closePath();
    A.extrusion(coque, 36, -3, 0, 2.5, beton, -Math.PI / 2);
    A.cylindre(4.2, 4.2, 22, 24, -18, 0, 13, blanc); A.dome(4.2, 0.8, -18, 22, 13, blanc);
    for (const x of [-16, -6]) { A.cylindre(2.8, 2.8, 15, 20, x, 0, -10, blanc); A.dome(2.8, 0.8, x, 15, -10, blanc); }
    const fen = (mat, liste) => A.plaques(liste.map(([x, y, l, h]) => [l, h, 0.4, x, y, 16.1]), mat);
    fen(bleu, [[-14, 4, 1.2, 2.2], [-4, 6, 0.8, 1.4], [6, 3, 1.6, 2.6]]); fen(rouge, [[-9, 7, 1, 1.6], [2, 5, 1.2, 2], [10, 7.5, 0.8, 1.2]]); fen(jaune, [[-18, 6, 0.8, 1.4], [-1, 2.5, 1, 1.8], [8, 5, 0.9, 1.4]]);
    return A.groupe;
  }

  // ---------------------------------------------------------------- la Maison carrée de Nîmes (x : l'axe, le portique au nord
  // en -x) : le podium et ses marches, la cella, les colonnes corinthiennes, l'entablement, les frontons, le toit de tuiles
  function maisonCarree(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE2C2), pierreFoncee = A.matiere(0xD6C29A), tuile = A.matiere(0xC8704A);
    A.boite(26, 3, 15, 0, 0, 0, pierreFoncee); A.boite(4, 1.5, 12, -15, 0, 0, pierreFoncee); A.boite(2, 2.6, 12, -14, 0, 0, pierreFoncee);
    A.boite(17, 9.4, 12.4, 3.3, 3, 0, pierre);
    const col = []; for (let k = 0; k < 6; k++) col.push([-12.2, -6.1 + k * 2.44, 0.45, 9, 3]);
    for (const x of [-9.3, -6.4]) for (const z of [-6.1, 6.1]) col.push([x, z, 0.45, 9, 3]);
    for (let x = -3.5; x <= 11.5; x += 2.9) for (const z of [-6.15, 6.15]) col.push([x, z, 0.45, 9, 3]);
    for (const z of [-6.1, -3.66, -1.22, 1.22, 3.66, 6.1]) col.push([12.2, z, 0.45, 9, 3]);
    A.cylindres(col, pierre, 12);
    A.boite(25.4, 2, 14.4, 0, 12, 0, pierreFoncee);
    for (const s of [1, -1]) A.toit(14.4, 3.6, 1.6, s * 11.9, 14, 0, pierre);
    A.toit(15, 3.7, 22.2, 0, 14, 0, tuile);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le théâtre antique d'Orange (x : le long du mur de
  // scène ; le mur au nord, en -z ; les gradins au sud, en +z)
  // le mur de scène (103 m, 37 m de haut) et sa façade d'arcades, le front de scène et ses colonnes, la statue d'Auguste,
  // la scène, les gradins en demi-cercle
  function theatreOrange(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6CDA0), pierreFoncee = A.matiere(0xC9AC78), ombre = A.matiere(0x8E7552), blanc = A.matiere(0xF4F1EA), bois = A.matiere(0x9A6A42);
    A.boite(104, 37, 20, -2.5, 0, -20, pierre); A.boite(105, 1.6, 21, -2.5, 35.4, -20, pierreFoncee);
    const arcs = []; for (let k = 0; k < 17; k++) { const x = -50 + k * 6; arcs.push([3.4, 7, 0.3, x, 1, -30.15]); arcs.push([2.6, 5, 0.3, x, 14, -30.15]); }
    A.plaques(arcs, ombre);
    A.extrusion(A.formeArche(7, 12), 0.6, -2.5, 0, -9.7, ombre); for (const s of [1, -1]) A.extrusion(A.formeArche(4.5, 9), 0.6, -2.5 + s * 22, 0, -9.7, ombre);
    A.cylindres([-3, 1].flatMap((t) => Array.from({ length: 12 }, (_, k) => [-36 + k * 6.6, -8.6 - t * 0.2, 0.55, 9, t < 0 ? 2 : 13])), pierreFoncee, 10);
    A.plaques([[5, 8, 0.4, -2.5, 15, -9.8]], ombre); A.boite(1.6, 3.6, 1.2, -2.5, 16, -9.2, blanc); A.boule(0.6, -2.5, 20.2, -9.2, blanc);
    A.boite(62, 1.4, 12, -2.5, 0, -4, bois);
    A.piece(() => A.fusion(Array.from({ length: 8 }, (_, i) => { const r = 27 + i * 3.1, h = 2 + i * 4.4, f = new THREE.Shape(); f.absarc(0, 0, 52, Math.PI, 2 * Math.PI, false); f.absarc(0, 0, r, 2 * Math.PI, Math.PI, true); f.closePath();
      return new THREE.ExtrudeGeometry(f, { depth: h, bevelEnabled: false, curveSegments: 28 }).rotateX(-Math.PI / 2).translate(-2.5, 0, -10); })), pierre);
    return A.groupe;
  }

  // ---------------------------------------------------------------- le pont d'Avignon (pont Saint-Bénézet) (x : l'axe du pont,
  // de la rive d'Avignon, en -x, vers le Rhône) : les quatre arches qui restent, les piles et leurs avant-becs, la chapelle
  // Saint-Nicolas sur la deuxième pile, le châtelet à l'entrée
  function pontAvignon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D5AE), pierreFoncee = A.matiere(0xC9B48A), tuile = A.matiere(0xC8704A);
    const piles = [-42, -6, 30, 66], R = 16.25;
    A.boites(piles.map((x) => [8, 12, 4.9, x, 0, 0]), pierre);
    A.cylindres(piles.flatMap((x) => [[x, 3.6, 3, 9, 0], [x, -3.6, 3, 9, 0]]), pierreFoncee, 4);
    for (const [x0, x1] of [[-76, -46], [-38, -10], [-2, 26], [34, 62]]) { const xc = (x0 + x1) / 2, demi = (x1 - x0) / 2, cy = 10 - R, a = Math.asin(Math.min(1, demi / R)), f = new THREE.Shape();
      f.moveTo(x0, cy + R * Math.cos(a)); f.absarc(xc, cy, R, Math.PI / 2 + a, Math.PI / 2 - a, true); f.lineTo(x1, 12.05); f.lineTo(x0, 12.05); f.closePath(); A.extrusion(f, 4.86, 0, 0, 0, pierre, 0, true); }
    A.boite(146, 1, 5.2, -7, 12, 0, pierreFoncee); for (const s of [1, -1]) A.boite(146, 1, 0.5, -7, 13, s * 2.35, pierre);
    A.boite(9, 7, 6, -6, 13, 4.5, pierre); A.toit(6.6, 3, 9, -6, 20, 4.5, tuile); A.boite(1.2, 3, 3, -10, 20, 4.5, pierre); A.toit(3, 1.2, 1.2, -10, 23, 4.5, pierre, Math.PI / 2);
    A.boite(14, 20, 12, -82, 0, 0, pierre); A.creneaux([A.tourDe(14, 12, -82, 0)], 20, 0.9, pierreFoncee); A.extrusion(A.formeArche(4, 7), 0.6, -74.8, 0, 0, pierreFoncee, Math.PI / 2);
    return A.groupe;
  }

  // ---------------------------------------------------------------- les alignements de Carnac (x : le long des files, vers
  // l'est-nord-est) : dix files de menhirs, plus grands à l'ouest ; une représentation (les pierres ne sont pas relevées
  // une à une : la BD TOPO ne les donne pas)
  function carnac(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xB8B4AA);
    let g = 12345; const hasard = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
    const pierres = [];
    for (let rang = 0; rang < 10; rang++) for (let x = -200; x <= 200; x += 7 + hasard() * 4) {
      const h = 0.9 + 2.8 * (200 - x) / 400 + hasard() * 0.8, z = -45 + rang * 10 + (hasard() - 0.5) * 2.4 + x * 0.02 * (rang - 4.5) / 4.5;
      pierres.push([0.9 + hasard() * 0.8, h, 0.8 + hasard() * 0.5, x + (hasard() - 0.5) * 2, 0, z, (hasard() - 0.5) * 0.6]); }
    A.piece(() => A.fusion(pierres.map(([lx, ly, lz, x, y, z, r]) => new THREE.BoxGeometry(lx, ly, lz).translate(0, ly / 2, 0).rotateY(r).translate(x, y, z))), granit, null, null, true);   // sans contour : trop petites pour un trait d'encre
    return A.groupe;
  }

  // ---------------------------------------------------------------- monuments régionaux (nuit du 4 nov. 2026), les plus connus
  // d'abord
  // le château de Montsoreau (x : le long de la Loire, au nord en -z) : le logis de tuffeau, son haut toit, ses lucarnes,
  // ses cheminées, les deux tours d'escalier côté cour
  function montsoreau(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF6F0E0), tuffeauOmbre = A.matiere(0xE2D7BD), ardoise = A.matiere(0x4F5D8C);
    A.boite(51, 22, 14, 4.5, 0, -21, tuffeau); A.toit(14.6, 11, 51, 4.5, 22, -21, ardoise);
    const luc = Array.from({ length: 6 }, (_, k) => [2.2, 4, 2, -15 + k * 7.8, 21, -27.4]);
    A.boites(luc, tuffeau); A.toits(luc.map(([, , , x, , z]) => [3, 2.4, 2.4, x, 25, z, Math.PI / 2]), ardoise);
    A.boites([-16, 6, 26].map((x) => [1.8, 9, 3, x, 28, -21]), tuffeauOmbre);
    for (const [x, h] of [[-10, 26], [25, 24]]) { A.boite(10, h, 7, x, 0, -10.5, tuffeau); A.pyramide(7.4, 7, 4, x, h, -10.5, ardoise); }
    return A.groupe;
  }

  // le château de Saint-Germain-en-Laye : le pentagone de brique et de pierre autour de sa cour, ses terrasses, ses hautes
  // cheminées, le donjon et son campanile
  function saintGermainEnLaye(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xC9775A), pierre = A.matiere(0xF0E6CF), zinc = A.matiere(0xB8BFCC), ardoise = A.matiere(0x4F5D8C);
    const anneau = [[[-53, 22], [16, -15], [22, 20], [-17, 52], [-53, 69], [-53, 22]]];
    A.remparts(anneau, 24, 18, brique); A.remparts(anneau, 1.2, 18.6, pierre, 24); A.remparts(anneau, 1.4, 18.8, zinc, 25.2);
    A.boites([[-50, 30], [-10, 6], [15, 0], [10, 30], [-30, 50], [-50, 55]].map(([x, z]) => [2.4, 6, 2.4, x, 25, z]), brique);
    A.boite(14, 34, 14, -53, 0, 22, brique); A.boite(15, 1.4, 15, -53, 32.6, 22, pierre); A.cylindre(2.4, 2.4, 6, 8, -53, 34, 22, pierre); A.pyramide(2.8, 5, 8, -53, 40, 22, ardoise);
    return A.groupe;
  }

  // l'abbatiale de Saint-Savin-sur-Gartempe (x : l'axe, le clocher-porche à l'ouest en -x) : la nef romane, le transept,
  // l'abside et ses chapelles rayonnantes, la flèche gothique (77 m)
  function saintSavin(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), ardoise = A.matiere(0x56659A), ardoiseFoncee = A.matiere(0x3F4B78);
    A.boite(40, 16, 24, -19, 0, 0, pierre); A.toit(24.6, 8, 40, -19, 16, 0, ardoise);
    A.boite(10, 18, 30, 6, 0, 0, pierre); A.toit(10.6, 8, 30, 6, 18, 0, ardoise, Math.PI / 2);
    A.boite(12, 18, 14, 17, 0, 0, pierre); A.abside(7, 18, 23, 0, 0, pierre); A.demiCone(7.5, 6, 23, 18, 0, ardoise); A.abside(14, 9, 23, 0, 0, pierreFoncee);
    A.boite(10, 24, 10, -42, 0, 0, pierre); A.cylindre(4.4, 4.4, 8, 8, -42, 24, 0, pierre); A.pyramide(4.6, 45, 8, -42, 32, 0, pierreFoncee); A.boule(0.8, -42, 77.6, 0, ardoiseFoncee);
    A.boite(10, 9, 3, 6, 18, 0, pierre); A.pyramide(5, 5, 4, 6, 27, 0, ardoise);
    return A.groupe;
  }

  // la Saline royale d'Arc-et-Senans (Ledoux) : la maison du directeur et son portique de colonnes, les deux bâtiments
  // des sels, le demi-cercle des bâtiments et la porte d'entrée ; des toits de tuiles
  function salineRoyale(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), tuile = A.matiere(0xB0644A);
    A.boite(16, 15, 38, 3, 0, -69, pierre); A.toit(16.6, 7, 38, 3, 15, -69, tuile, Math.PI / 2);
    A.cylindres(Array.from({ length: 6 }, (_, k) => [12, -78 + k * 3.6, 1.3, 11, 0]), pierreFoncee, 12); A.boite(4, 2, 22, 12, 11, -69, pierreFoncee); A.toit(22, 4, 4, 12, 13, -69, pierre);
    for (const [x, l] of [[-62, 84], [65, 86]]) { A.boite(l, 10, 28, x, 0, -69, pierre); A.toit(28.6, 8, l, x, 10, -69, tuile); }
    const segs = [18, 55, 90, 127, 162].map((a) => { const t = a * Math.PI / 180; return [Math.cos(t) * 128, -62 + Math.sin(t) * 128, -t + Math.PI / 2]; });
    A.boites(segs.map(([x, z, r]) => [44, 8, 12, x, 0, z, r]), pierre); A.toits(segs.map(([x, z, r]) => [12.6, 5, 44, x, 8, z, r]), tuile);
    A.boite(14, 11, 16, 0, 0, 72, pierreFoncee);
    return A.groupe;
  }

  // l'église Saint-Eustache (x : l'axe, la façade à l'ouest en -x) : la haute nef gothique, le transept, la tour nord de la
  // façade classique, le chevet et ses chapelles, le petit clocher de la croisée
  const saintEustache = (THREE) => cathedrale(THREE, { F: -45.5, E: 43.5, larg: 14, mur: 33, toitH: 12, xT: -2.75, transept: 44, transeptL: 14, cote: 10, facadeH: 34, rose: 2.5,
    tours: [{ z: -12, h: 45 }], flecheCroisee: { tour: 4, cote: 6, h: 6, r: 3.4, seg: 8 },
    plus: (A, m) => { for (const s of [1, -1]) A.boite(80, 18, 9, 0, 0, s * 18.5, m.pierreFoncee); A.abside(23, 18, 36, 0, 0, m.pierreFoncee); A.boite(14, 34, 40, -45, 0, 0, m.pierre); } });

  // le palais de Chaillot (x : vers la tour Eiffel, au sud-est) : les deux pavillons, le parvis et ses statues dorées, les
  // deux ailes en arc de cercle
  function chaillot(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEEE6D2), pierreFoncee = A.matiere(0xD4C8AC), or = A.matiere(0xFFC233, 0x7A4A00);
    for (const z of [-53.5, 46.5]) { A.boite(60, 26, 47, -5, 0, z, pierre); A.boite(61, 1.4, 48, -5, 26, z, pierreFoncee); A.plaques(Array.from({ length: 8 }, (_, k) => [0.3, 14, 3, 25.2, 4, z - 19 + k * 5.4]), pierreFoncee); }
    A.remparts([[[3, -77], [12, -110], [26, -140], [46, -172]]], 22, 18, pierre); A.remparts([[[3, 70], [12, 103], [26, 133], [46, 165]]], 22, 18, pierre);
    A.boites([-1, 1].flatMap((s) => [4, 12, 20, 28].map((x) => [1.6, 1.2, 1.6, x, 0, s * 26])), pierreFoncee);
    A.boites([-1, 1].flatMap((s) => [4, 12, 20, 28].map((x) => [0.9, 3.4, 0.9, x, 1.2, s * 26])), or);
    return A.groupe;
  }

  // la place Stanislas de Nancy (x : le côté de l'hôtel de ville, au sud en +z) : l'hôtel de ville et les pavillons, les
  // pavillons bas au nord, les grilles dorées de Jean Lamour aux quatre coins, la statue de Stanislas
  function placeStanislas(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2E6C8), pierreFoncee = A.matiere(0xD9C8A0), or = A.matiere(0xFFC233, 0x7A4A00), bronze = A.matiere(0x3F5B4E), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    const corps = [[94, 21, 50, -5, 77], [67, 21, 31, 86.5, -16.5], [67, 18, 29, 86.5, 27.5], [57, 16, 30, -91.5, -15], [55, 18, 24, -92.5, 30], [31, 9, 45, -32.5, -67.5], [37, 9, 45, 21.5, -67.5]];
    for (const [lx, h, lz, x, z] of corps) { A.boite(lx, h, lz, x, 0, z, pierre); A.boite(lx + 0.6, 1.4, lz + 0.6, x, h, z, pierreFoncee); }
    const grilles = []; for (const [x, z, sx, sz] of [[-63, -44, 1, 1], [53, -44, -1, 1], [-63, 51, 1, -1], [53, 51, -1, -1]]) { grilles.push([12, 7, 0.4, x + sx * 6, 0, z, 0]); grilles.push([0.4, 7, 12, x, 0, z + sz * 6, 0]); }
    A.boites(grilles, or);
    for (const [x, z] of [[-60, -40], [50, -40]]) { A.cylindre(5, 5, 0.8, 20, x, 0, z, pierre); A.cylindre(4.4, 4.4, 0.5, 20, x, 0.5, z, eau); A.boule(1.2, x, 2.6, z, or); }
    A.boite(3, 4, 4, -5, 0, 3, pierre); A.boite(1, 3, 1, -5, 4, 3, bronze); A.boule(0.5, -5, 7.5, 3, bronze);
    return A.groupe;
  }

  // la cathédrale de Laon (x : l'axe, la façade à l'ouest) : le chevet plat, les tours à étage octogonal (cinq tours), la
  // tour-lanterne de la croisée
  const laon = (THREE) => cathedrale(THREE, { F: -52, E: 60, larg: 24, mur: 24, toitH: 11, xT: 10.5, transept: 64, transeptL: 18, cote: 16, facadeH: 34, rose: 5.5, chevetPlat: true,
    tours: [{ z: -12, h: 40, octogone: { h: 16, r: 6 } }, { z: 10, h: 40, octogone: { h: 16, r: 6 } }], flecheCroisee: { tour: 10, cote: 14, h: 4, r: 9.5, seg: 4 },
    plus: (A, m) => { for (const x of [3, 18]) { A.boite(9, 40, 9, x, 0, -30, m.pierre); A.cylindre(4, 4, 12, 8, x, 40, -30, m.pierre); A.pyramide(4.4, 3, 8, x, 52, -30, m.pierreFoncee); } } });

  // l'abbaye de Fontevraud (x : l'axe de l'abbatiale, le chœur à l'est) : l'abbatiale et ses coupoles, le transept, le chevet,
  // le grand cloître, les cuisines romanes et leurs cheminées coniques
  function fontevraud(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), tuffeauOmbre = A.matiere(0xDDD2B6), ardoise = A.matiere(0x4F5D8C), pierre = A.matiere(0xD9CDB0);
    A.boite(56, 16, 16, 12, 0, -14, tuffeau); A.toit(16.6, 6, 56, 12, 16, -14, ardoise);
    for (const x of [-10, 4, 18, 32]) A.dome(5, 0.7, x, 18, -14, ardoise);
    A.boite(14, 18, 34, 48, 0, -14, tuffeau); A.toit(14.6, 6, 34, 48, 18, -14, ardoise, Math.PI / 2);
    A.boite(10, 18, 14, 60, 0, -14, tuffeau); A.abside(7, 18, 65, 0, -14, tuffeau); A.demiCone(7.5, 5, 65, 18, -14, ardoise); A.abside(12, 9, 65, 0, -14, tuffeauOmbre);
    A.boite(9, 26, 9, 48, 0, -14, tuffeau); A.pyramide(6.6, 8, 4, 48, 26, -14, ardoise);
    const cl = [[46, 12, 10, 13, 5], [46, 12, 10, 13, 40], [10, 12, 25, -5, 22.5], [10, 12, 25, 31, 22.5]];
    A.boites(cl.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), tuffeau);
    A.toits(cl.map(([lx, h, lz, x, z]) => (lx > lz ? [lz + 0.6, 5, lx, x, h, z, 0] : [lx + 0.6, 5, lz, x, h, z, Math.PI / 2])), ardoise);
    A.cylindre(8, 8, 10, 8, -30, 0, 60, pierre); A.cylindres(Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3 + 0.3; return [-30 + Math.cos(a) * 8.5, 60 + Math.sin(a) * 8.5, 3, 7, 0]; }), pierre, 12);
    A.cones(Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3 + 0.3; return [-30 + Math.cos(a) * 8.5, 60 + Math.sin(a) * 8.5, 3.3, 7, 4]; }), pierre, 12);
    A.pyramide(8.4, 12, 8, -30, 10, 60, pierre); A.cones([[-30, 60, 1.6, 22, 5], [-34, 57, 1, 17, 4], [-26, 57, 1, 17, 4], [-30, 64, 1, 17, 4]], pierre, 10);
    return A.groupe;
  }

  // le palais du Tau à Reims (x : vers le nord-est) : l'aile classique, la grande salle du Tau et son haut toit, la chapelle
  function palaisTau(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE5CF), ardoise = A.matiere(0x56659A);
    A.boite(95, 13, 13, -15.5, 0, -6, pierre); A.toit(13.6, 7, 95, -15.5, 13, -6, ardoise);
    A.boite(24, 16, 57, 44, 0, -19.5, pierre); A.toit(24.6, 13, 57, 44, 16, -19.5, ardoise, Math.PI / 2);
    A.boite(18, 20, 9, 58, 0, -38.5, pierre); A.abside(4.5, 20, 67, 0, -38.5, pierre); A.toit(9.6, 7, 18, 58, 20, -38.5, ardoise); A.demiCone(5, 6, 67, 20, -38.5, ardoise);
    return A.groupe;
  }

  // le château d'Azay-le-Rideau (sur l'Indre) : le corps de logis et l'aile en équerre, leurs hauts toits et leurs lucarnes,
  // les tourelles d'angle, le grand escalier et son pignon
  function azayLeRideau(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF6F0E0), ardoise = A.matiere(0x4F5D8C);
    A.boite(44, 15, 13, 8, 0, 0.5, tuffeau); A.toit(13.6, 10, 44, 8, 15, 0.5, ardoise);
    A.boite(11, 15, 37, -8.5, 0, -11.5, tuffeau); A.toit(11.6, 9, 37, -8.5, 15, -11.5, ardoise, Math.PI / 2);
    const luc = [0, 14, 22].map((x) => [2, 4, 2, x, 14, -6.6]).concat([-20, -8].map((z) => [2, 4, 2, -3.4, 14, z]));
    A.boites(luc, tuffeau); A.toits(luc.map(([, , , x, , z]) => [2.8, 2.6, 2.4, x, 18, z, Math.PI / 2]), ardoise);
    const tours = [[-13, 5], [-13, -28], [0, -29], [29, -6], [29, 7]];
    A.cylindres(tours.map(([x, z]) => [x, z, 2.5, 13, 4]), tuffeau, 14); A.cones(tours.map(([x, z]) => [x, z, 2.8, 17, 7]), ardoise, 14);
    A.boite(7, 21, 4, 8, 0, -6.5, tuffeau); A.toit(7, 4, 4, 8, 21, -6.5, tuffeau, Math.PI / 2);
    return A.groupe;
  }

  // le phare de Cordouan (en mer, sur son plateau) : le socle rond, les étages de la Renaissance, la chapelle et sa coupole,
  // la haute tour du XVIIIe siècle, la lanterne
  function cordouan(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2ECDC), pierreFoncee = A.matiere(0xD8CDB2), plomb = A.matiere(0x7B88B0), lanterne = A.matiere(0xFFE27A, 0x806000), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(21, 22, 5, 32, 0, 0, 0, pierreFoncee); A.cylindre(20, 20, 2, 32, 0, 5, 0, pierre);
    A.cylindre(10, 11, 13, 24, 0, 5, 0, pierre); A.cylindre(11.4, 11.4, 1.2, 24, 0, 18, 0, pierreFoncee);
    A.cylindre(8, 8.6, 10, 20, 0, 19.2, 0, pierre); A.cylindre(9, 9, 1, 20, 0, 29, 0, pierreFoncee);
    A.cylindre(4.4, 6.4, 26, 16, 0, 30, 0, pierre); A.cylindre(5.2, 5.2, 1, 16, 0, 56, 0, pierreFoncee);
    A.cylindre(3, 3, 5, 12, 0, 57, 0, lanterne); A.dome(3.3, 1, 0, 62, 0, plomb); A.boule(0.7, 0, 66, 0, or);
    return A.groupe;
  }

  // le château de Villandry : les trois ailes autour de la cour ouverte au nord, leurs hauts toits et leurs lucarnes, le
  // donjon carré médiéval
  function villandry(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C), pierre = A.matiere(0xE2D7BD);
    const ailes = [[40, 11, 16, -2, 0], [11, 11, 33, -16.5, -16.5], [9, 11, 33, 12.5, -16.5]];
    A.boites(ailes.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), tuffeau);
    A.toits(ailes.map(([lx, h, lz, x, z]) => (lx > lz ? [lz + 0.6, 8, lx, x, h, z, 0] : [lx + 0.6, 7, lz, x, h, z, Math.PI / 2])), ardoise);
    const luc = [-14, -4, 6].map((x) => [2, 3.4, 2, x, 10, -8.6]);
    A.boites(luc, tuffeau); A.toits(luc.map(([, , , x, , z]) => [2.8, 2.2, 2.4, x, 13.4, z, Math.PI / 2]), ardoise);
    A.boite(11, 22, 11, -17, 0, 7, pierre); A.creneaux([A.tourDe(11, 11, -17, 7)], 22, 0.8, pierre);
    return A.groupe;
  }

  // la grande coupole de l'observatoire de Nice (Garnier et Eiffel) : le tambour de pierre, la coupole de métal et sa fente
  function observatoireNice(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2ECDC), pierreFoncee = A.matiere(0xD8CDB2), metal = A.matiere(0xA9BDB6), fente = A.matiere(0x2E3550);
    A.boite(30, 4, 30, 0, 0, 0, pierreFoncee); A.cylindre(13.5, 13.5, 10, 32, 0, 4, 0, pierre); A.cylindre(14.2, 14.2, 1, 32, 0, 13.6, 0, pierreFoncee);
    A.dome(13.2, 1, 0, 14.6, 0, metal);
    A.piece(() => new THREE.TorusGeometry(13.3, 0.9, 4, 20, Math.PI * 0.55).rotateY(Math.PI / 2), fente, A.V(0, 14.6, 0), null, true);
    return A.groupe;
  }

  // la cathédrale Sainte-Cécile d'Albi (x : l'axe, le clocher-donjon à l'ouest) : la forteresse de brique, ses contreforts
  // ronds, le chevet, le clocher de 78 m et ses tourelles, le baldaquin de pierre blanche au sud
  function albi(THREE) {
    const A = atelier(THREE), Z = 2.7;
    const brique = A.matiere(0xC66A3E), briqueFoncee = A.matiere(0xA9532F), tuile = A.matiere(0xC8704A), blanc = A.matiere(0xF2EEE4);
    A.boite(95, 34, 32, 0, 0, Z, brique); A.toit(33, 5, 95, 0, 34, Z, tuile);
    const contreforts = []; for (let x = -44; x <= 44; x += 8) for (const s of [1, -1]) contreforts.push([x, Z + s * 16.4, 2.6, 34, 0]);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k + 0.5) * Math.PI / 5; contreforts.push([47 + Math.cos(a) * 16.4, Z + Math.sin(a) * 16.4, 2.6, 34, 0]); }
    A.cylindres(contreforts, brique, 14);
    A.abside(16, 34, 47, 0, Z, brique); A.demiCone(16.5, 5, 47, 34, Z, tuile);
    A.boite(16, 40, 22, -50, 0, Z, brique); A.cylindres([[-57, Z - 10, 3, 62, 0], [-57, Z + 10, 3, 62, 0], [-43, Z - 10, 3, 62, 0], [-43, Z + 10, 3, 62, 0]], briqueFoncee, 14);
    A.boite(12, 18, 16, -50, 40, Z, brique); A.boite(10, 14, 13, -50, 58, Z, brique); A.creneaux([A.tourDe(10, 13, -50, Z)], 72, 0.8, briqueFoncee);
    A.cones([[-57, Z - 10, 3.2, 62, 4], [-57, Z + 10, 3.2, 62, 4], [-43, Z - 10, 3.2, 62, 4], [-43, Z + 10, 3.2, 62, 4]], briqueFoncee, 14);
    A.boite(12, 14, 6, -10, 0, Z + 19, blanc); A.toit(6.6, 4, 12, -10, 14, Z + 19, blanc); A.cones([[-15, Z + 21.5, 0.7, 14, 5], [-5, Z + 21.5, 0.7, 14, 5]], blanc, 8);
    return A.groupe;
  }

  // l'École militaire (x : vers le sud-est ; la façade sur le Champ-de-Mars en -x) : la longue façade, le pavillon central,
  // son portique, son fronton et son dôme carré, les ailes de la cour d'honneur
  function ecoleMilitaire(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(18, 16, 160, -20, 0, 5, pierre); A.toit(18.6, 7, 160, -20, 16, 5, ardoise, Math.PI / 2);
    A.boite(26, 22, 22, -19, 0, 7.5, pierre); A.cylindres(Array.from({ length: 8 }, (_, k) => [-32.8, -3 + k * 3, 0.8, 16, 2]), pierre, 12);
    A.boite(3, 2, 24, -32.8, 18, 7.5, pierreFoncee); A.toit(24, 5, 3, -32.8, 20, 7.5, pierre);
    A.domeCarre(20, 12, 20, -19, 22, 7.5, ardoise); A.boule(0.9, -19, 34.6, 7.5, or);
    for (const z of [-40, 50]) { A.boite(80, 14, 16, 30, 0, z, pierre); A.toit(16.6, 6, 80, 30, 14, z, ardoise); }
    return A.groupe;
  }

  // le théâtre des Champs-Élysées (Perret) : le bloc de marbre blanc, le dernier étage en retrait, les bas-reliefs de
  // Bourdelle sur les façades
  function theatreChampsElysees(THREE) {
    const A = atelier(THREE);
    const marbre = A.matiere(0xF4F2EC), marbreOmbre = A.matiere(0xDCD8CE), relief = A.matiere(0xD9C7A0);
    A.boite(38, 22, 88, 0, 0, 0, marbre); A.boite(32, 5, 82, 0, 22, 0, marbreOmbre); A.boite(39, 1.2, 89, 0, 21, 0, marbreOmbre);
    for (const s of [1, -1]) A.plaques([-12, -4, 4, 12].map((x) => [5, 6, 0.3, x, 13, s * 44.2]), relief);
    return A.groupe;
  }

  // le Clos Lucé (la maison de Léonard de Vinci) : le manoir de brique rose et de pierre, son haut toit, ses lucarnes, la
  // tourelle d'escalier octogonale
  function closLuce(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD08A72), pierre = A.matiere(0xF2EAD6), ardoise = A.matiere(0x4F5D8C);
    A.boite(13, 11, 46, 0, 0, 0, brique); A.toit(13.6, 9, 46, 0, 11, 0, ardoise, Math.PI / 2);
    A.boites([-20, -8, 4, 16].map((z) => [0.8, 11, 1, -6.6, 0, z]).concat([-20, -8, 4, 16].map((z) => [0.8, 11, 1, 6.6, 0, z])), pierre);
    const luc = [-14, -2, 10].map((z) => [2, 3.2, 2, -6, 10, z]);
    A.boites(luc, pierre); A.toits(luc.map(([, , , x, , z]) => [2.8, 2.2, 2.4, x, 13.2, z]), ardoise);
    A.cylindre(3, 3, 16, 8, -7, 0, 2, pierre); A.pyramide(3.4, 6, 8, -7, 16, 2, ardoise);
    return A.groupe;
  }

  // le théâtre de l'Odéon (la façade et son portique au nord, en -z, sur la place de l'Odéon)
  function odeon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D2), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(35, 18, 58, -4.7, 0, 0, pierre); A.boite(36, 1.4, 59, -4.7, 18, 0, pierreFoncee); A.combles(35.6, 6, 58.6, -4.7, 19.4, 0, ardoise);
    A.cylindres(Array.from({ length: 8 }, (_, k) => [-19 + k * 4.1, -30.6, 0.9, 13, 1]), pierre, 12); A.boite(31, 2.4, 3.6, -4.7, 14, -30.6, pierreFoncee); A.boite(31, 1, 3.6, -4.7, 0, -30.6, pierreFoncee);
    return A.groupe;
  }

  // le château de Chantilly : le Grand Château en triangle et ses tours rondes, la chapelle et sa flèche, le Petit Château
  function chantilly(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF3EDDD), ardoise = A.matiere(0x4F5D8C), ardoiseFoncee = A.matiere(0x3F4B78);
    const anneau = [[[-31, -60], [25, -17], [-13, 26], [-31, 20], [-31, -60]]];
    A.remparts(anneau, 15, 12, pierre); A.remparts(anneau, 5, 12.4, ardoise, 15);
    const tours = [[-28, -70, 6], [32, -18, 6], [8.6, 5, 4.5], [-2.4, 17, 4.5], [-29, 43, 5]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 17, 0]), pierre, 16); A.cones(tours.map(([x, z, r]) => [x, z, r + 0.4, 17, r * 1.6]), ardoise, 16);
    A.boite(10, 16, 24, -28, 0, 30, pierre); A.toit(10.6, 7, 24, -28, 16, 30, ardoise, Math.PI / 2); A.pyramide(2, 16, 8, -28, 22, 22, ardoiseFoncee);
    const pc = [[11, 12, 53, -67.5, 8.5], [27, 12, 9, -49.5, 30.5], [38, 12, 12, -54, -12]];
    A.boites(pc.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), pierre); A.toits(pc.map(([lx, h, lz, x, z]) => (lx > lz ? [lz + 0.6, 7, lx, x, h, z, 0] : [lx + 0.6, 7, lz, x, h, z, Math.PI / 2])), ardoise);
    return A.groupe;
  }

  // le château d'Angers : l'enceinte et ses tours rondes rayées de schiste et de tuffeau, la chapelle
  function angers(THREE) {
    const A = atelier(THREE);
    const schiste = A.matiere(0x6E6A72), tuffeau = A.matiere(0xEFE6D0), ardoise = A.matiere(0x4F5D8C);
    const mur = [[[-40, -83], [-10, -80], [30, -72], [80, -62], [105, -57], [112, -30], [108, 0], [98, 12], [60, 36], [30, 54], [0, 60], [-10, 62], [-60, 63], [-100, 65], [-100, -10], [-40, -83]]];
    A.remparts(mur, 22, 6, schiste); A.creneaux(mur, 22, 1, schiste);
    const tours = [[-40, -84, 6.5], [22, -79, 9], [51, -75, 9], [75, -68, 9], [104, -62, 9], [108, -33, 9], [105, 3, 10], [65, 28, 9], [45, 42, 9], [22, 59, 9], [-31, 64, 9], [-53, 65, 9], [-75, 61, 9], [-91, 59, 9]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 30, 0]), schiste, 20);
    A.piece(() => A.fusion(tours.flatMap(([x, z, r]) => [3, 9, 15, 21, 27].map((y) => new THREE.CylinderGeometry(r + 0.06, r + 0.06, 2.2, 20).translate(x, y, z)))), tuffeau, null, null, true);
    A.boite(23, 20, 12, -18, 0, -25, tuffeau, 0.2); A.toit(12.6, 12, 23, -18, 20, -25, ardoise, 0.2);
    return A.groupe;
  }

  // la cathédrale de Bayeux : les deux flèches de la façade, la tour-lanterne de la croisée et son dôme vert
  const bayeux = (THREE) => cathedrale(THREE, { F: -45, E: 41, larg: 22, mur: 26, toitH: 10, xT: 4, transept: 40, transeptL: 14, cote: 14, facadeH: 30, rose: 4.5,
    tours: [{ z: -17.75, h: 38, fleche: 36, r: 5.5, seg: 8 }, { z: 17.75, h: 38, fleche: 36, r: 5.5, seg: 8 }], flecheCroisee: { tour: 18, cote: 13, seg: 8, h: 10, r: 7.5, couleur: 0x5FA58A } });

  // l'arc antique d'Orange : trois arches, les colonnes, l'attique et ses reliefs
  function arcOrange(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6CDA0), pierreFoncee = A.matiere(0xC9AC78), ombre = A.matiere(0x8E7552);
    for (const [x, l] of [[-8.5, 2.6], [-3.3, 1.8], [3.3, 1.8], [8.5, 2.6]]) A.boite(l, 11.5, 8.5, x, 0, 0, pierre);
    A.boite(19.6, 3.4, 8.5, 0, 11.5, 0, pierre); A.boite(20.4, 1, 9.3, 0, 14.9, 0, pierreFoncee); A.boite(19.6, 3.3, 8.5, 0, 15.9, 0, pierre); A.boite(20, 1, 8.9, 0, 19.2, 0, pierreFoncee);
    A.boite(4.8, 2.6, 8.5, 0, 8.9, 0, pierre); for (const s of [1, -1]) A.boite(3, 5, 8.5, s * 5.7, 6.5, 0, pierre);
    A.cylindres([-9.6, -5.8, 5.8, 9.6].flatMap((x) => [[x, 4.45, 0.45, 11, 0.5], [x, -4.45, 0.45, 11, 0.5]]), pierreFoncee, 10);
    A.plaques([[16, 2.4, 0.3, 0, 16.3, 4.35], [16, 2.4, 0.3, 0, 16.3, -4.35]], ombre);
    return A.groupe;
  }

  // la villa Savoye (Le Corbusier) : la boîte blanche sur ses pilotis, la fenêtre en bandeau, le rez-de-chaussée vitré et
  // courbe, le solarium et ses écrans courbes sur le toit
  function villaSavoye(THREE) {
    const A = atelier(THREE);
    const blanc = A.matiere(0xF7F7F2), vitre = A.matiere(0x3E5C58), vert = A.matiere(0x6C8E7A);
    const pil = []; for (const x of [-8.5, -3, 3, 8.5]) for (const z of [-9, -3, 3, 9]) pil.push([x, z, 0.22, 3.5, 0]);
    A.cylindres(pil, blanc, 8);
    const rdc = new THREE.Shape(); rdc.moveTo(-7, -8); rdc.lineTo(7, -8); rdc.lineTo(7, 4); rdc.absarc(0, 4, 7, 0, Math.PI, false); rdc.lineTo(-7, -8);
    A.piece(() => new THREE.ExtrudeGeometry(rdc, { depth: 3.2, bevelEnabled: false, curveSegments: 16 }).rotateX(-Math.PI / 2), vert, null, null, true);
    A.boite(19.5, 3.6, 21.5, 0, 3.5, 0, blanc);
    A.plaques([[19.6, 1, 0.3, 0, 4.8, 10.8], [19.6, 1, 0.3, 0, 4.8, -10.8], [0.3, 1, 21.6, 9.8, 4.8, 0], [0.3, 1, 21.6, -9.8, 4.8, 0]], vitre);
    const ecran = new THREE.Shape(); ecran.moveTo(-6, 0); ecran.quadraticCurveTo(-8, 4, -3, 5); ecran.quadraticCurveTo(0, 2, 3, 5.5); ecran.lineTo(3.3, 5.2); ecran.quadraticCurveTo(0, 1.5, -3, 4.5); ecran.quadraticCurveTo(-7.4, 3.6, -5.6, 0); ecran.closePath();
    A.piece(() => new THREE.ExtrudeGeometry(ecran, { depth: 3, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2), blanc, A.V(2, 7.1, 2), null, true);
    return A.groupe;
  }

  // la basilique Saint-Remi de Reims : les deux tours romanes de la façade, la nef, le transept, le chœur gothique et ses
  // chapelles
  const saintRemi = (THREE) => cathedrale(THREE, { F: -54.5, E: 48.5, larg: 24, mur: 25, toitH: 10, xT: 18, transept: 46, transeptL: 14, cote: 14, facadeH: 30, rose: 4,
    tours: [{ z: -14, h: 50, fleche: 7, r: 7.5, seg: 4 }, { z: 14, h: 50, fleche: 7, r: 7.5, seg: 4 }],
    plus: (A, m) => { A.abside(18, 12, 48.5, 0, 0, m.pierreFoncee); } });

  // l'église Saint-Germain-l'Auxerrois (face à la colonnade du Louvre) : le porche flamboyant à cinq arcades, la nef, le
  // transept, le chœur et ses chapelles, le clocher roman et sa flèche
  function saintGermainAuxerrois(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), ombre = A.matiere(0x8C7A5E);
    A.boite(8, 12, 30, -33, 0, 0, pierreFoncee); A.plaques([-12, -6, 0, 6, 12].map((z) => [0.3, 8, 4, -37.1, 0.5, z]), ombre); A.cones([-15, -9, -3, 3, 9, 15].map((z) => [-36.5, z, 0.6, 12, 4]), pierre, 8);
    A.boite(36, 11, 32, -11, 0, 0, pierreFoncee); A.boite(36, 20, 16, -11, 0, 0, pierre); A.toit(16.6, 8, 36, -11, 20, 0, ardoise);
    A.boite(10, 20, 36, 9, 0, 0, pierre); A.toit(10.6, 8, 36, 9, 20, 0, ardoise, Math.PI / 2);
    A.boite(16, 20, 16, 22, 0, 0, pierre); A.toit(16.6, 8, 16, 22, 20, 0, ardoise); A.abside(8, 20, 30, 0, 0, pierre); A.demiCone(8.5, 7, 30, 20, 0, ardoise); A.abside(16, 11, 30, 0, 0, pierreFoncee);
    A.boite(8, 30, 8, 9, 0, 22, pierre); A.pyramide(5.6, 12, 8, 9, 30, 22, ardoise);
    return A.groupe;
  }

  // la tour Saint-Jacques : la tour gothique flamboyante (52 m), ses contreforts et ses pinacles, la statue de saint Jacques
  function tourSaintJacques(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE8D8), pierreFoncee = A.matiere(0xD6CCB2), blanc = A.matiere(0xF7F5EE);
    A.boite(10, 48, 10, 0, 0, 0, pierre); A.boite(11, 1, 11, 0, 47, 0, pierreFoncee);
    A.boites([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => [2.2, 46, 2.2, sx * 5, 0, sz * 5]), pierreFoncee);
    A.cones([[1, 1], [1, -1], [-1, 1]].map(([sx, sz]) => [sx * 5, sz * 5, 1.2, 46, 6]), pierre, 8);
    A.cylindre(1.6, 1.6, 4, 8, -5, 48, -5, pierre); A.boite(1, 3.2, 1, -5, 52, -5, blanc); A.boule(0.5, -5, 55.6, -5, blanc);
    A.plaques([[0.3, 14, 3, 5.05, 20, 0], [0.3, 14, 3, -5.05, 20, 0], [3, 14, 0.3, 0, 20, 5.05], [3, 14, 0.3, 0, 20, -5.05]], pierreFoncee);
    return A.groupe;
  }

  // les arènes de Lutèce : l'arène elliptique et ce qui reste des gradins
  function arenesLutece(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D9BC), sable = A.matiere(0xE8D3A0);
    A.piece(() => { const f = new THREE.Shape(); f.absellipse(0, 0, 26, 23, 0, Math.PI * 2, false); return new THREE.ExtrudeGeometry(f, { depth: 0.3, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2); }, sable, null, null, true);
    A.piece(() => A.fusion(Array.from({ length: 5 }, (_, i) => { const r = 27 + i * 1.6, f = new THREE.Shape(); f.absellipse(0, 0, 35, 32, -0.4, Math.PI + 0.4, false); f.absellipse(0, 0, r, r - 3, Math.PI + 0.4, -0.4, true); f.closePath();
      return new THREE.ExtrudeGeometry(f, { depth: 1 + i * 1.1, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2); })), pierre);
    A.boite(10, 4, 3, 0, 0, -24.5, pierre);
    return A.groupe;
  }

  // le château de Saumur : les trois ailes autour de la cour, les quatre tours d'angle et leurs hauts toits, les girouettes
  // dorées (la BD TOPO ne le dessine pas : posé au point de Wikidata)
  function saumur(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    const ailes = [[44, 22, 10, 0, -17], [10, 22, 44, -17, 0], [10, 22, 44, 17, 0]];
    A.boites(ailes.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), pierre);
    A.toits(ailes.map(([lx, h, lz, x, z]) => (lx > lz ? [lz + 0.6, 8, lx, x, h, z, 0] : [lx + 0.6, 8, lz, x, h, z, Math.PI / 2])), ardoise);
    const tours = [[-22, -22], [22, -22], [-22, 22], [22, 22]];
    A.cylindres(tours.map(([x, z]) => [x, z, 6.5, 28, 0]), pierre, 8); A.cones(tours.map(([x, z]) => [x, z, 7, 28, 12]), ardoise, 8);
    A.cylindres(tours.map(([x, z]) => [x, z, 0.25, 4, 40]), or, 6); A.boites(tours.map(([x, z]) => [0.4, 1.2, 2, x, 42, z]), or);
    return A.groupe;
  }

  // la place des Victoires : le cercle des façades et leurs toits d'ardoise, la statue équestre de Louis XIV
  function placeVictoires(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), ardoise = A.matiere(0x56659A), bronze = A.matiere(0x3F5B4E), or = A.matiere(0xFFC233, 0x7A4A00);
    const rues = [20, 80, 140, 205, 265, 320];
    const segs = []; for (let a = 0; a < 360; a += 10) { if (rues.some((r) => Math.abs(((a + 5 - r + 540) % 360) - 180) < 8)) continue; const t = (a + 5) * Math.PI / 180; segs.push([Math.cos(t) * 47, Math.sin(t) * 47, -t + Math.PI / 2]); }
    A.boites(segs.map(([x, z, r]) => [8.6, 18, 16, x, 0, z, r]), pierre); A.toits(segs.map(([x, z, r]) => [16.6, 6, 8.6, x, 18, z, r]), ardoise);
    A.boite(4, 4, 6, 0, 0, 0, pierre); A.boite(1.8, 2.6, 4.6, 0, 4, 0, or); A.boite(1, 2.4, 1, 0, 6.6, -0.6, or); A.boule(0.5, 0, 9.4, -0.6, or); A.boite(0.9, 1.6, 1.4, 0, 6, 2.6, or);
    return A.groupe;
  }

  // le château du Haut-Kœnigsbourg : le rocher, le grand bastion à l'ouest, le donjon, le logis et ses toits de tuiles
  // vernissées, les tours, le grès rose
  function hautKoenigsbourg(THREE) {
    const A = atelier(THREE);
    const gres = A.matiere(0xC98C78), gresFonce = A.matiere(0xA9705E), rocher = A.matiere(0x9C8F82), tuile = A.matiere(0xB0644A), tuileVerte = A.matiere(0x5E8C6A);
    A.boite(92, 14, 50, 0, 0, 0, rocher); A.boite(84, 4, 44, 2, 14, 0, gresFonce);
    A.cylindre(16, 17, 16, 24, -36, 14, 0, gres); A.creneaux([Array.from({ length: 13 }, (_, k) => [-36 + 15.6 * Math.cos(k * Math.PI / 6), 15.6 * Math.sin(k * Math.PI / 6)])], 30, 1, gresFonce);
    A.boite(14, 48, 14, -12, 14, 0, gres); A.creneaux([A.tourDe(14.4, 14.4, -12, 0)], 62, 1, gresFonce);
    A.boite(40, 22, 16, 18, 14, -6, gres); A.toit(16.6, 14, 40, 18, 36, -6, tuile); A.boite(30, 18, 12, 22, 14, 14, gres); A.toit(12.6, 10, 30, 22, 32, 14, tuileVerte);
    A.cylindres([[40, -14, 4.5, 30, 14], [42, 16, 4, 26, 14]], gres, 16); A.cones([[40, -14, 5, 44, 9], [42, 16, 4.5, 40, 8]], tuile, 16);
    return A.groupe;
  }

  // l'église Saint-Étienne-du-Mont : la façade Renaissance et ses trois pignons superposés, le clocher et sa tourelle, la nef
  // et le chœur
  function saintEtienneDuMont(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(66, 12, 34, 4, 0, 0, pierreFoncee); A.boite(66, 22, 16, 4, 0, 0, pierre); A.toit(16.6, 9, 66, 4, 22, 0, ardoise);
    A.abside(8, 22, 37, 0, 0, pierre); A.demiCone(8.5, 7, 37, 22, 0, ardoise);
    A.boite(4, 26, 18, -31, 0, 0, pierre); A.toit(18, 5, 4, -31, 26, 0, pierre); A.toit(12, 4, 4.4, -31, 31, 0, pierreFoncee); A.toit(6, 3, 4.8, -31, 35, 0, pierre);
    A.piece((e) => new THREE.CylinderGeometry(2.6 + e, 2.6 + e, 0.6 + 2 * e, 24).rotateZ(Math.PI / 2), vitrail, A.V(-33.2, 22, 0));
    A.boite(8, 34, 8, -28, 0, -14, pierre); A.cylindre(3, 3, 7, 12, -28, 34, -14, pierre); A.dome(3, 1.2, -28, 41, -14, ardoise);
    return A.groupe;
  }

  // les arènes de Nîmes : l'amphithéâtre romain elliptique, ses deux étages d'arcades, l'attique, les gradins et l'arène
  function arenesNimes(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6CDA0), pierreFoncee = A.matiere(0xC9AC78), ombre = A.matiere(0x8E7552), sable = A.matiere(0xE8D3A0);
    const a = 62, b = 55;
    A.piece((e) => { const f = new THREE.Shape(); f.absellipse(0, 0, a + e, b + e, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absellipse(0, 0, a - 12 - e, b - 12 - e, 0, Math.PI * 2, true); f.holes.push(h);
      return new THREE.ExtrudeGeometry(f, { depth: 21 + 2 * e, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2).translate(0, -e, 0); }, pierre);
    A.piece(() => A.fusion(Array.from({ length: 6 }, (_, i) => { const f = new THREE.Shape(), ra = 26 + i * 4, rb = 18 + i * 4; f.absellipse(0, 0, a - 11, b - 11, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absellipse(0, 0, ra, rb, 0, Math.PI * 2, true); f.holes.push(h);
      return new THREE.ExtrudeGeometry(f, { depth: 2 + i * 3.4, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2); })), pierreFoncee, null, null, true);
    A.piece(() => { const f = new THREE.Shape(); f.absellipse(0, 0, 38, 30, 0, Math.PI * 2, false); return new THREE.ExtrudeGeometry(f, { depth: 0.3, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2); }, sable, null, null, true);
    const arcs = []; for (let k = 0; k < 60; k++) { const t = k * Math.PI / 30, x = Math.cos(t) * (a + 0.1), z = Math.sin(t) * (b + 0.1), n = Math.atan2(Math.sin(t) / (b * b), Math.cos(t) / (a * a));
      for (const y of [1.5, 10.5]) arcs.push([0.3, 6.5, 3.6, x, y, z, -n]); }
    A.plaques(arcs, ombre);
    return A.groupe;
  }

  // la colonne de Juillet (place de la Bastille) : le socle de marbre, la colonne de bronze, le Génie de la Liberté doré
  function colonneJuillet(THREE) {
    const A = atelier(THREE);
    const marbre = A.matiere(0xF2EEE4), bronze = A.matiere(0x4E6B5C), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(12, 13, 2, 24, 0, 0, 0, marbre); A.boite(10, 9, 10, 0, 2, 0, marbre); A.boite(11, 1.4, 11, 0, 11, 0, bronze);
    A.cylindre(1.9, 2.2, 32, 20, 0, 12.4, 0, bronze); A.cylindres([18, 26, 34].map((y) => [0, 0, 2.3, 0.8, y]), or, 20);
    A.boite(5, 2, 5, 0, 44.4, 0, bronze); A.cylindre(1.4, 1.6, 2.4, 12, 0, 46.4, 0, bronze);
    A.boule(0.9, 0, 49.6, 0, or); A.boite(0.8, 2.2, 0.6, 0, 48.6, 0, or); A.boite(3.6, 0.5, 0.3, 0, 49.4, -0.3, or); A.boite(0.3, 2.4, 0.3, 0.9, 50, 0, or);
    return A.groupe;
  }

  // le château de Pierrefonds : l'enceinte crénelée autour de la cour, ses huit grosses tours et leurs toits pointus, le
  // donjon (logis) au sud
  function pierrefonds(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9E1CC), pierreFoncee = A.matiere(0xCFC3A6), ardoise = A.matiere(0x4F5D8C);
    const anneau = [[[-45, -38], [12, -40], [25, -2], [16, 40], [-42, 40], [-45, -38]]];
    A.remparts(anneau, 26, 13, pierre); A.creneaux(anneau.map((l) => l.map(([x, z]) => [x, z])), 26, 1, pierreFoncee); A.remparts(anneau, 4, 9, ardoise, 26);
    const tours = [[-50, -45], [-16, -52], [15, -48], [32, -6], [-53, 2], [-46, 46], [-8, 50], [19, 45]];
    A.cylindres(tours.map(([x, z]) => [x, z, 8, 34, 0]), pierre, 20); A.cylindres(tours.map(([x, z]) => [x, z, 8.8, 2, 32]), pierreFoncee, 20);
    A.cones(tours.map(([x, z]) => [x, z, 8.6, 34, 14]), ardoise, 20);
    A.boite(30, 38, 26, 4, 0, 32, pierre); A.combles(30.6, 14, 26.6, 4, 38, 32, ardoise);
    return A.groupe;
  }

  // la primatiale Saint-Jean de Lyon : la façade et ses deux tours carrées, la nef au toit bas de tuiles, le transept et ses
  // tours, l'abside
  const saintJeanLyon = (THREE) => cathedrale(THREE, { F: -38, E: 33, larg: 20, mur: 32, toitH: 6, xT: 18, transept: 40, transeptL: 12, cote: 10, facadeH: 42, rose: 5, toit: 0xB0644A, toitFonce: 0x8E4E3A,
    tours: [{ z: -12, h: 44 }, { z: 12, h: 44 }],
    plus: (A, m) => { for (const x of [12, 24]) { A.boite(9, 40, 9, x, 0, -20, m.pierre); A.boite(10, 1.4, 10, x, 38.6, -20, m.pierreFoncee); } } });

  // la cathédrale de la Major à Marseille (x : l'axe, la façade au sud-ouest en -x) : les pierres blanches et vertes, les
  // coupoles, le grand dôme de la croisée, les deux tours de la façade et leurs dômes
  function laMajor(THREE) {
    const A = atelier(THREE);
    const blanc = A.matiere(0xF2EEE2), vert = A.matiere(0x5E8C6A), vertClair = A.matiere(0x86AE90);
    const bandes = (lx, lz, x, z, h) => A.plaques([0.25, 0.45, 0.65, 0.85].map((f) => [lx + 0.4, 1, lz + 0.4, x, h * f, z]), vert);
    A.boite(60, 26, 27, -36, 0, -1.5, blanc); bandes(60, 27, -36, -1.5, 26); A.toit(27.6, 5, 60, -36, 26, -1.5, vert);
    A.boite(20, 26, 58, 6, 0, -3, blanc); bandes(20, 58, 6, -3, 26);
    A.boite(22, 22, 24, 27, 0, -1.5, blanc); bandes(22, 24, 27, -1.5, 22); A.abside(12, 22, 38, 0, -1.5, blanc); A.dome(12, 0.9, 38, 22, -1.5, vertClair);
    A.cylindre(11, 11, 8, 24, 6, 26, -2, blanc); A.cylindre(11.6, 11.6, 1, 24, 6, 30, -2, vert); A.dome(11, 1.15, 6, 34, -2, vertClair); A.cylindre(2, 2, 4, 12, 6, 46.5, -2, blanc); A.dome(2, 1.2, 6, 50.5, -2, vert);
    for (const [x, z] of [[6, -26], [6, 20], [-20, -1.5], [-44, -1.5], [27, -1.5]]) A.dome(5, 0.9, x, 26, z, vertClair);
    for (const z of [-16, 10]) { A.boite(9, 34, 9, -57, 0, z, blanc); A.plaques([0.2, 0.4, 0.6, 0.8].map((f) => [9.4, 1, 9.4, -57, 34 * f, z]), vert); A.cylindre(4, 4, 4, 16, -57, 34, z, blanc); A.dome(4, 1.1, -57, 38, z, vertClair); }
    return A.groupe;
  }

  // la porte Saint-Denis : l'arc de triomphe, ses piles et leurs obélisques sculptés, l'attique
  function porteSaintDenis(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), relief = A.matiere(0xC9B48A);
    for (const s of [1, -1]) A.boite(8.5, 24.6, 7, s * 8.75, 0, 0, pierre);
    A.boite(9.2, 9, 7, 0, 15.6, 0, pierre); const v = new THREE.Shape(); v.moveTo(-4.5, 11); v.absarc(0, 11, 4.5, Math.PI, 0, true); v.lineTo(4.5, 15.7); v.lineTo(-4.5, 15.7); v.closePath(); A.extrusion(v, 6.98, 0, 0, 0, pierre, 0, true);
    A.boite(27, 1.4, 8, 0, 23.2, 0, pierreFoncee);
    for (const s of [1, -1]) for (const z of [3.55, -3.55]) { const f = new THREE.Shape(); f.moveTo(-2, 0); f.lineTo(2, 0); f.lineTo(0.6, 20); f.lineTo(-0.6, 20); f.closePath(); A.extrusion(f, 0.3, s * 8.75, 1, z, relief, 0, true); }
    return A.groupe;
  }

  // la colonne Vendôme : le piédestal, la colonne de bronze et sa spirale, Napoléon au sommet
  function colonneVendome(THREE) {
    const A = atelier(THREE);
    const bronze = A.matiere(0x6B5A44), bronzeClair = A.matiere(0x8C7658), pierre = A.matiere(0xEFE6D0);
    A.boite(8, 1.5, 8, 0, 0, 0, pierre); A.boite(6, 6, 6, 0, 1.5, 0, bronze); A.boite(6.6, 1, 6.6, 0, 7.5, 0, bronzeClair);
    A.cylindre(1.8, 2, 30, 20, 0, 8.5, 0, bronze); A.cylindres([12, 17, 22, 27, 32, 37].map((y) => [0, 0, 2.05, 0.8, y]), bronzeClair, 20);
    A.boite(3.6, 1.6, 3.6, 0, 38.5, 0, bronzeClair); A.cylindre(1.2, 1.2, 2, 12, 0, 40.1, 0, bronze);
    A.cylindre(0.5, 0.7, 3, 10, 0, 42.1, 0, bronze); A.boule(0.5, 0, 45.6, 0, bronze);
    return A.groupe;
  }

  // le trophée des Alpes à La Turbie : le socle carré, le tambour et sa colonnade, l'attique ruiné
  function tropheeAlpes(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE2), pierreFoncee = A.matiere(0xD8D0BC);
    A.boite(32, 12, 32, 0, 0, 0, pierre); A.boite(33, 1.2, 33, 0, 12, 0, pierreFoncee);
    A.cylindre(12, 12, 14, 28, 0, 13.2, 0, pierre); A.cylindres(Array.from({ length: 16 }, (_, k) => { const a = k * Math.PI / 8; return [Math.cos(a) * 13, Math.sin(a) * 13, 0.8, 12, 13.2]; }).filter((_, k) => k < 11), pierre, 10);
    A.boite(14, 6, 10, -3, 27.2, -2, pierreFoncee); A.boite(8, 4, 6, 4, 27.2, 4, pierreFoncee);
    return A.groupe;
  }

  // le Lion de Belfort (Bartholdi) : le lion de grès rouge couché au pied de la citadelle, la paroi de rocher
  function lionBelfort(THREE) {
    const A = atelier(THREE), V = A.V;
    const gres = A.matiere(0xB5654A), gresFonce = A.matiere(0x96503A), rocher = A.matiere(0xA08A80);
    A.boite(4, 20, 40, -4, 0, 9, rocher);
    A.piece((e) => new THREE.SphereGeometry(1 + e / 5, 24, 14).scale(4.6, 3.6, 10.5), gres, V(-10, 3.6, 13));
    A.piece((e) => new THREE.SphereGeometry(4.4 + e, 20, 14), gresFonce, V(-11, 8, 1.5));
    A.piece((e) => new THREE.SphereGeometry(2.8 + e, 18, 12).scale(1.2, 1, 1), gres, V(-13.8, 8.2, 0.5));
    A.boites([[6, 1.6, 2, -14, 0, -2, 0], [6, 1.6, 2, -14, 0, 3, 0]], gres);
    A.piece((e) => new THREE.CylinderGeometry(0.6 + e, 0.9 + e, 9 + 2 * e, 8).rotateX(Math.PI / 2.3), gres, V(-9, 2, 25));
    return A.groupe;
  }

  // le château d'Ussé (le château de la Belle au bois dormant) : les ailes autour de la cour ouverte au nord, les tours et
  // tourelles et leurs toits pointus, les lucarnes
  function usse(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF6F0E0), ardoise = A.matiere(0x4F5D8C);
    const ailes = [[37, 15, 18, -5.5, -6], [58, 15, 9, 29, 11], [17, 15, 39, 46.5, -5.5]];
    A.boites(ailes.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), tuffeau);
    A.toits(ailes.map(([lx, h, lz, x, z]) => (lx > lz ? [lz + 0.6, 9, lx, x, h, z, 0] : [lx + 0.6, 9, lz, x, h, z, Math.PI / 2])), ardoise);
    const tours = [[-12, 13, 4.5, 20], [-2, 14, 3.5, 18], [45, -24, 3.5, 18], [57, 15, 4, 20], [-22, -14, 3, 18], [-22, 4, 3, 18]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), tuffeau, 16); A.cones(tours.map(([x, z, r, h]) => [x, z, r + 0.4, h, r * 2.4]), ardoise, 16);
    const tourelles = [[-14, -15], [4, -15], [20, 8], [36, 8], [40, -20], [52, -10]];
    A.cylindres(tourelles.map(([x, z]) => [x, z, 1.4, 6, 14]), tuffeau, 10); A.cones(tourelles.map(([x, z]) => [x, z, 1.7, 20, 5]), ardoise, 10);
    const luc = [[-12, -15.4], [0, -15.4], [12, 6.2], [26, 6.2], [40, 6.2]];
    A.boites(luc.map(([x, z]) => [2, 3.4, 2, x, 14, z]), tuffeau); A.toits(luc.map(([x, z]) => [2.8, 2.2, 2.4, x, 17.4, z, Math.PI / 2]), ardoise);
    return A.groupe;
  }

  // le pont Mirabeau (x : l'axe du pont) : les trois arches d'acier, les deux piles en forme de bateau et leurs quatre statues
  // de bronze, le tablier
  function pontMirabeau(THREE) {
    const A = atelier(THREE);
    const acier = A.matiere(0x6E8C84), pierre = A.matiere(0xE9DFC6), bronze = A.matiere(0x3F5B4E), route = A.matiere(0x9C9FA6);
    const arche = (x0, x1, y0, y1) => { const c = (x0 + x1) / 2, demi = (x1 - x0) / 2, f = y1 - y0, R = (demi * demi + f * f) / (2 * f), cy = y1 - R, a = Math.asin(demi / R), s = new THREE.Shape();
      s.moveTo(x0, y0); s.absarc(c, cy, R, Math.PI / 2 + a, Math.PI / 2 - a, true); s.lineTo(x1, 11.05); s.lineTo(x0, 11.05); s.closePath(); A.extrusion(s, 19.6, 0, 0, 0, acier, 0, true); };
    arche(-79, -49.5, 3, 8); arche(-43.5, 43.5, 2, 9.5); arche(49.5, 79, 3, 8);
    for (const s of [1, -1]) { A.boite(6, 11, 14, s * 46.5, 0, 0, pierre); A.cylindres([[s * 46.5, 7.5, 3, 11, 0], [s * 46.5, -7.5, 3, 11, 0]], pierre, 4);
      for (const z of [11, -11]) { A.boite(2, 2, 2, s * 46.5, 11, z, pierre); A.cylindre(0.7, 0.9, 3.6, 10, s * 46.5, 13, z, bronze); A.boule(0.5, s * 46.5, 17, z, bronze); A.boite(3.6, 0.3, 0.8, s * 46.5, 15.6, z, bronze); } }
    for (const s of [1, -1]) A.boite(8, 11, 20, s * 83, 0, 0, pierre);
    A.boite(174, 1, 20, 0, 11, 0, acier); A.plaques([[174, 0.2, 14, 0, 12, 0]], route); for (const s of [1, -1]) A.boite(174, 1.1, 0.6, 0, 12, s * 9.7, acier);
    return A.groupe;
  }

  // la basilique Notre-Dame de Fourvière : la nef blanche, ses quatre tours octogonales crénelées, le portique de la façade,
  // l'abside, la chapelle et sa Vierge dorée
  function fourviere(THREE) {
    const A = atelier(THREE), Z = 1.5;
    const blanc = A.matiere(0xF4F1EA), blancOmbre = A.matiere(0xDCD6C8), toit = A.matiere(0x8E9AB4), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(59, 30, 26, -8.5, 0, Z, blanc); A.toit(26.6, 6, 59, -8.5, 30, Z, toit);
    const tours = [[-40, -12], [-40, 16], [17, -13], [17, 16]];
    A.cylindres(tours.map(([x, z]) => [x, z, 4.6, 50, 0]), blanc, 8); A.cylindres(tours.map(([x, z]) => [x, z, 5.2, 1.4, 48]), blancOmbre, 8);
    A.creneaux(tours.map(([x, z]) => Array.from({ length: 9 }, (_, k) => [x + 4.9 * Math.cos(k * Math.PI / 4), z + 4.9 * Math.sin(k * Math.PI / 4)])), 49.4, 0.7, blanc);
    A.cylindres(Array.from({ length: 4 }, (_, k) => [-43.5, Z - 6 + k * 4, 0.7, 14, 0]), blanc, 10); A.toit(16, 4, 3, -43.5, 14, Z, blanc);
    A.abside(10, 21, 21, 0, Z, blanc); A.dome(10.2, 0.6, 21, 21, Z, toit);
    A.boite(7, 26, 7, -20, 0, -20, blancOmbre); A.cylindre(2, 2, 4, 10, -20, 26, -20, blancOmbre); A.cylindre(0.6, 1, 3.4, 10, -20, 30, -20, or); A.boule(0.5, -20, 33.8, -20, or);
    return A.groupe;
  }

  // le donjon de Loches : la grande tour carrée (38 m) et ses créneaux, le petit donjon
  function loches(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9E1CC), pierreFoncee = A.matiere(0xCFC3A6);
    A.boite(26, 38, 15, 0, 0, 0, pierre); A.creneaux([A.tourDe(26, 15, 0, 0)], 38, 1, pierreFoncee);
    A.boites([-8, 0, 8].flatMap((x) => [[2, 36, 1.4, x, 0, 8], [2, 36, 1.4, x, 0, -8]]), pierreFoncee);
    A.boite(10, 30, 10, -17, 0, 2, pierre); A.creneaux([A.tourDe(10, 10, -17, 2)], 30, 0.9, pierreFoncee);
    return A.groupe;
  }

  // Château-Gaillard (Richard Cœur de Lion) : le donjon en ruine et ce qui reste de l'enceinte
  function chateauGaillard(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6E0D0), pierreFoncee = A.matiere(0xC9C1AC);
    A.cylindre(7, 8, 14, 16, 0, 0, 0, pierre); A.cylindres([[0, 0, 7, 4, 14]].concat([[-4, 3, 2, 3, 18]]), pierre, 16);
    const arcs = []; for (const [a0, a1] of [[0.3, 1.3], [1.7, 2.6], [3.0, 4.2], [4.6, 5.6]]) { const l = []; for (let k = 0; k <= 6; k++) { const a = a0 + (a1 - a0) * k / 6; l.push([Math.cos(a) * 26, Math.sin(a) * 19]); } arcs.push(l); }
    A.remparts(arcs, 8, 3, pierreFoncee); A.cylindres([[26, 4, 3.5, 11, 0], [-14, 16, 3.5, 10, 0], [-22, -10, 3.5, 11, 0]], pierre, 14);
    return A.groupe;
  }

  // le château de Langeais : le logis en équerre, ses tours rondes et leurs toits pointus, le chemin de ronde crénelé
  function langeais(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2ECDC), ardoise = A.matiere(0x4F5D8C), t = 57 * Math.PI / 180;
    A.boite(48, 18, 13, 9, 0, -2, pierre, t); A.toits([[13.6, 9, 48, 9, 18, -2, t]], ardoise);
    A.boite(30, 16, 14, -11, 0, 19.5, pierre); A.toits([[14.6, 8, 30, -11, 16, 19.5, 0]], ardoise);
    const tours = [[22, -22, 6, 24], [-1, 19, 4.5, 22], [-26, 19, 4, 20]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), pierre, 16); A.cones(tours.map(([x, z, r, h]) => [x, z, r + 0.4, h, r * 2.1]), ardoise, 16);
    return A.groupe;
  }

  // la basilique Saint-Sernin de Toulouse (x : l'axe, la façade à l'ouest) : la brique rose, la nef et ses doubles bas-côtés, le
  // grand transept, le chevet et ses chapelles étagées, le clocher octogonal à cinq étages et sa flèche
  function saintSernin(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD08060), briqueFoncee = A.matiere(0xB0644A), tuile = A.matiere(0xC8704A), pierre = A.matiere(0xF0E6D0);
    A.boite(80, 12, 34, -10, 0, 0, briqueFoncee); A.toit(34.6, 4, 80, -10, 12, 0, tuile); A.boite(80, 21, 17, -10, 0, 0, brique); A.toit(17.6, 6, 80, -10, 21, 0, tuile);
    A.boite(16, 21, 61, 22, 0, 0, brique); A.toit(16.6, 6, 61, 22, 21, 0, tuile, Math.PI / 2);
    A.boite(10, 21, 17, 35, 0, 0, brique); A.abside(8.5, 21, 40, 0, 0, brique); A.demiCone(9, 5, 40, 21, 0, tuile);
    A.abside(14, 14, 40, 0, 0, briqueFoncee); A.demiCone(14.5, 3, 40, 14, 0, tuile); A.abside(19, 8, 40, 0, 0, brique); A.demiCone(19.5, 2, 40, 8, 0, tuile);
    let y = 21; for (const [r, h] of [[7.5, 8], [6.6, 8], [5.8, 8], [5, 7], [4.3, 6]]) { A.cylindre(r, r, h, 8, 22, y, 0, brique); A.cylindre(r + 0.4, r + 0.4, 0.8, 8, 22, y + h - 0.8, 0, pierre); y += h; }
    A.pyramide(4.4, 12, 8, 22, y, 0, briqueFoncee); A.boule(0.7, 22, y + 12.6, 0, pierre);
    return A.groupe;
  }

  // la basilique Sainte-Clotilde : la façade et ses deux flèches (69 m), la nef néo-gothique
  const sainteClotilde = (THREE) => cathedrale(THREE, { F: -32, E: 29, larg: 18, mur: 24, toitH: 9, xT: 14, transept: 39, transeptL: 12, cote: 12, facadeH: 30, rose: 4,
    tours: [{ z: -10, h: 40, fleche: 29, r: 4.6, seg: 8 }, { z: 10, h: 40, fleche: 29, r: 4.6, seg: 8 }] });

  // la cathédrale Saint-André de Bordeaux : la nef unique, le transept et les deux flèches du portail nord, le chœur et ses
  // chapelles, la tour Pey-Berland à part et sa Vierge dorée
  function bordeaux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0E6CE), pierreFoncee = A.matiere(0xD6C6A2), ardoise = A.matiere(0x56659A), ardoiseFoncee = A.matiere(0x3F4B78), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(75, 26, 18, -29.5, 0, 0, pierre); A.toit(18.6, 9, 75, -29.5, 26, 0, ardoise);
    A.boite(27, 30, 53, 9, 0, 0, pierre); A.toit(27.6, 9, 53, 9, 30, 0, ardoise, Math.PI / 2);
    for (const x of [1, 17]) { A.boite(8, 50, 8, x, 0, -26, pierre); A.pyramide(4.4, 31, 8, x, 50, -26, ardoiseFoncee); A.boite(8, 40, 8, x, 0, 26, pierre); }
    A.boite(30, 30, 22, 35, 0, 0, pierre); A.toit(22.6, 9, 30, 35, 30, 0, ardoise); A.boite(30, 14, 40, 35, 0, 0, pierreFoncee);
    A.abside(11, 30, 50, 0, 0, pierre); A.demiCone(11.5, 8, 50, 30, 0, ardoise); A.abside(20, 14, 50, 0, 0, pierreFoncee);
    A.boite(10, 50, 10, 85, 0, 15, pierre); A.pyramide(5.6, 12, 8, 85, 50, 15, ardoiseFoncee); A.cylindre(0.8, 1.2, 4, 10, 85, 62, 15, or); A.boule(0.6, 85, 66.4, 15, or);
    return A.groupe;
  }

  // la cathédrale Saint-Étienne de Metz : la pierre de Jaumont dorée, la nef très haute (41 m), ses immenses verrières, la tour
  // de Mutte et sa flèche, la tour du Chapitre
  function metz(THREE) {
    const A = atelier(THREE);
    const jaumont = A.matiere(0xE8C97A), jaumontFonce = A.matiere(0xCDA85A), ardoise = A.matiere(0x56659A), ardoiseFoncee = A.matiere(0x3F4B78), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(120, 22, 40, -7.5, 0, 0, jaumontFonce); A.boite(120, 41, 18, -7.5, 0, 0, jaumont); A.toit(18.6, 14, 120, -7.5, 41, 0, ardoise);
    A.plaques([-50, -38, -26, -14, -2, 10, 22, 34].flatMap((x) => [[6, 16, 0.3, x, 23, 9.2], [6, 16, 0.3, x, 23, -9.2]]), vitrail);
    A.boite(16, 41, 46, 30, 0, 0, jaumont); A.toit(16.6, 14, 46, 30, 41, 0, ardoise, Math.PI / 2);
    A.abside(9, 41, 52.5, 0, 0, jaumont); A.demiCone(9.5, 12, 52.5, 41, 0, ardoise); A.abside(14, 22, 52.5, 0, 0, jaumontFonce);
    A.boite(3, 46, 20, -67.5, 0, 0, jaumont); A.toit(20, 9, 3, -67.5, 46, 0, jaumont); A.piece((e) => new THREE.CylinderGeometry(6 + e, 6 + e, 0.8 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-69.3, 30, 0));
    A.boite(11, 58, 11, -10, 0, 25, jaumont); A.cylindre(4.8, 4.8, 8, 8, -10, 58, 25, jaumont); A.pyramide(5.2, 22, 8, -10, 66, 25, ardoiseFoncee);
    A.boite(11, 50, 11, -10, 0, -25, jaumont); A.creneaux([A.tourDe(11.4, 11.4, -10, -25)], 50, 0.8, jaumontFonce);
    return A.groupe;
  }

  // la cathédrale de Clermont-Ferrand : la pierre noire de Volvic, les deux flèches de la façade (96 m), la tour de la Bayette
  const clermont = (THREE) => cathedrale(THREE, { F: -35, E: 43, larg: 18, mur: 29, toitH: 9, xT: 10, transept: 46, transeptL: 14, cote: 12, facadeH: 34, rose: 5,
    pierre: 0x5A5556, pierreFoncee: 0x46423F, toit: 0x7686AD, toitFonce: 0x3F4B78,
    tours: [{ z: -11, h: 45, fleche: 46, r: 5.2, seg: 8 }, { z: 11, h: 45, fleche: 46, r: 5.2, seg: 8 }],
    plus: (A, m) => { A.boite(10, 51, 9, 13.5, 0, -14.3, m.pierre); A.creneaux([A.tourDe(10.4, 9.4, 13.5, -14.3)], 51, 0.8, m.pierreFoncee); } });

  // le château de Cheverny : le pavillon central et son dôme carré, les ailes, les deux grands pavillons des extrémités et leurs
  // dômes carrés, les lanternons
  function cheverny(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF6F0E0), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    for (const s of [1, -1]) { A.boite(14, 20, 17, s * 27.5, 0, 0, tuffeau); A.domeCarre(14, 10, 17, s * 27.5, 20, 0, ardoise); A.cylindre(1.4, 1.4, 3, 8, s * 27.5, 29, 0, tuffeau); A.boule(0.6, s * 27.5, 32.6, 0, or);
      A.boite(13.5, 16, 14, s * 13.75, 0, 0, tuffeau); A.toit(14.6, 7, 13.5, s * 13.75, 16, 0, ardoise); }
    A.boite(14, 22, 17, 0, 0, 0, tuffeau); A.domeCarre(13, 9, 16, 0, 22, 0, ardoise); A.cylindre(1.6, 1.6, 4, 8, 0, 30, 0, tuffeau); A.pyramide(2, 3, 8, 0, 34, 0, ardoise); A.boule(0.6, 0, 37.6, 0, or);
    return A.groupe;
  }

  // le viaduc de Garabit (Eiffel) : le grand arc de fer rouge au-dessus de la Truyère, les piles en treillis, le tablier ; la
  // carte est plate : le tablier est posé à 70 m (au lieu de 122 m)
  function garabit(THREE) {
    const A = atelier(THREE);
    const fer = A.matiere(0xC8402E), ferFonce = A.matiere(0x9E2E20), pierre = A.matiere(0xD8CCB0);
    const H = 70;
    const arc = new THREE.Shape(); arc.moveTo(-82.5, 0);
    for (let k = 0; k <= 30; k++) { const x = -82.5 + 165 * k / 30; arc.lineTo(x, (H - 4) * (1 - (x / 82.5) ** 2)); }
    for (let k = 30; k >= 0; k--) { const x = -76 + 152 * k / 30; arc.lineTo(x, (H - 14) * (1 - (x / 76) ** 2)); }
    arc.closePath(); A.extrusion(arc, 8, 0, 0, 0, fer);
    A.boite(565, 5, 7, 0, H - 5, 0, fer); A.boite(566, 0.6, 7.6, 0, H, 0, ferFonce);
    const piles = [-250, -200, -150, -110, 110, 150, 200, 250];
    A.cylindres(piles.map((x) => [x, 0, 3, H - 5, 0, 7]), fer, 4);
    for (const s of [1, -1]) A.boite(20, 12, 10, s * 290, 0, 0, pierre);
    return A.groupe;
  }

  // l'Institut de France (le collège des Quatre-Nations, la bibliothèque Mazarine) : la chapelle à coupole et son portique
  // face à la Seine (au nord, en -z), les deux ailes en arc de cercle, les pavillons d'angle
  function institut(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x6E7AA0), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(20, 18, 24, 0, 0, 2, pierre); A.cylindres(Array.from({ length: 4 }, (_, k) => [-6 + k * 4, -10.8, 0.8, 14, 0]), pierre, 12); A.boite(16, 2, 3, 0, 14, -10.8, pierreFoncee); A.toit(16, 4, 3, 0, 16, -10.8, pierre, Math.PI / 2);
    A.cylindre(8, 8, 6, 24, 0, 18, 2, pierre); A.dome(8, 1.4, 0, 24, 2, plomb);
    for (let k = 0; k < 8; k++) A.piece((e) => new THREE.TorusGeometry(8.05, 0.25 + e, 4, 16, Math.PI / 2).scale(1, 1.4, 1).rotateY(k * Math.PI / 4), or, A.V(0, 24, 2), null, true);
    A.cylindre(1.6, 1.6, 4, 10, 0, 35, 2, or); A.boule(0.7, 0, 39.6, 2, or);
    for (const s of [1, -1]) { const aile = [[s * 10, 0], [s * 28, -6], [s * 42, -16]]; A.remparts([aile], 15, 10, pierre); A.remparts([aile], 4, 10.4, ardoise, 15);
      A.boite(14, 18, 14, s * 50, 0, -20, pierre); A.combles(14.6, 7, 14.6, s * 50, 18, -20, ardoise); }
    return A.groupe;
  }

  // l'église Saint-Gervais-Saint-Protais : la façade classique aux trois ordres de colonnes, la nef gothique, le clocher
  function saintGervais(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(55, 12, 30, 2, 0, 0, pierreFoncee); A.boite(55, 20, 14, 2, 0, 0, pierre); A.toit(14.6, 8, 55, 2, 20, 0, ardoise); A.abside(7, 20, 29.5, 0, 0, pierre); A.demiCone(7.5, 6, 29.5, 20, 0, ardoise);
    A.boite(5, 34, 22, -28, 0, 0, pierre);
    A.cylindres([[-31, 0.6, 12, 0], [-31, 12.6, 10, 12], [-31, 0.5, 9, 22.6]].flatMap(([x, r, h, y]) => [-7, -2.5, 2.5, 7].map((z) => [x, z, r, h, y])), pierre, 10);
    A.boites([[6, 1.2, 22, -29, 12, 0], [6, 1.2, 22, -29, 22.6, 0]], pierreFoncee); A.dome(5, 0.7, -28.5, 34, 0, pierreFoncee);
    A.boite(8, 30, 8, 10, 0, -12, pierre); A.pyramide(5.6, 6, 4, 10, 30, -12, ardoise);
    return A.groupe;
  }

  // le château de Chaumont-sur-Loire : les ailes autour de la cour ouverte sur la Loire, les tours rondes et leurs toits
  // pointus, le chemin de ronde, le châtelet d'entrée et ses deux tours
  function chaumont(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), tuffeauOmbre = A.matiere(0xDCD2B8), ardoise = A.matiere(0x4F5D8C);
    const ailes = [[56, 15, 11, 0, 22], [11, 15, 44, -28, 0], [11, 15, 44, 28, 0]];
    A.boites(ailes.map(([lx, h, lz, x, z]) => [lx, h, lz, x, 0, z]), tuffeau); A.creneaux(ailes.map(([lx, , lz, x, z]) => A.tourDe(lx + 1, lz + 1, x, z)), 15, 0.8, tuffeauOmbre);
    A.toits(ailes.map(([lx, h, lz, x, z]) => (lx > lz ? [lz - 1, 8, lx - 2, x, 16.6, z, 0] : [lx - 1, 8, lz - 2, x, 16.6, z, Math.PI / 2])), ardoise);
    const tours = [[-30, 25, 6], [30, 25, 6], [-30, -23, 6], [30, -23, 6], [-6, 28, 4.5], [6, 28, 4.5]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 20, 0]), tuffeau, 16); A.cones(tours.map(([x, z, r]) => [x, z, r + 0.4, 20, r * 2]), ardoise, 16);
    return A.groupe;
  }

  // le château de Valençay : le grand pavillon et son dôme carré, l'aile classique et ses combles, la tour ronde et son dôme
  function valencay(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EAD6), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(80, 16, 14, 0, 0, -30, pierre); A.toit(14.6, 8, 80, 0, 16, -30, ardoise);
    A.boite(22, 26, 22, -40, 0, -30, pierre); A.domeCarre(22, 12, 22, -40, 26, -30, ardoise); A.cylindre(2, 2, 4, 10, -40, 37, -30, pierre); A.boule(0.8, -40, 41.6, -30, or);
    A.cylindre(8, 8, 24, 24, 40, 0, -30, pierre); A.dome(8.2, 1, 40, 24, -30, ardoise); A.cylindre(1.4, 1.4, 3, 10, 40, 32, -30, pierre);
    A.boite(14, 14, 60, 40, 0, 6, pierre); A.toit(14.6, 7, 60, 40, 14, 6, ardoise, Math.PI / 2);
    return A.groupe;
  }

  // la cathédrale Sainte-Croix d'Orléans : les deux tours de la façade et leurs couronnes ajourées, la flèche de la croisée
  const orleans = (THREE) => cathedrale(THREE, { F: -64.5, E: 58.5, larg: 28, mur: 32, toitH: 11, xT: 0, transept: 65, transeptL: 14, cote: 16, facadeH: 50, rose: 6,
    tours: [{ z: -17, h: 66, octogone: { h: 16, r: 6.5 } }, { z: 17, h: 66, octogone: { h: 16, r: 6.5 } }], flecheCroisee: { h: 64, r: 4, seg: 8 } });
  // la cathédrale Saint-Étienne de Sens : la tour de pierre (au sud) et la tour de plomb (au nord)
  const sens = (THREE) => cathedrale(THREE, { F: -53, E: 48, larg: 22, mur: 24, toitH: 10, xT: 16, transept: 50, transeptL: 14, cote: 12, facadeH: 34, rose: 5,
    tours: [{ z: -14, h: 50, fleche: 10, r: 6, seg: 4 }, { z: 14, h: 72, octogone: { h: 6, r: 3 } }] });
  // la cathédrale Saint-Gatien de Tours : la façade flamboyante et ses deux tours aux lanternes Renaissance
  const cathedraleTours = (THREE) => cathedrale(THREE, { F: -37, E: 32, larg: 22, mur: 29, toitH: 10, xT: 12, transept: 46, transeptL: 12, cote: 12, facadeH: 40, rose: 5.5,
    tours: [{ z: -12, h: 52, octogone: { h: 10, r: 5 }, fleche: 6, r: 5.2, seg: 8 }, { z: 12, h: 52, octogone: { h: 10, r: 5 }, fleche: 6, r: 5.2, seg: 8 }] });

  // la cathédrale Notre-Dame-des-Doms d'Avignon : la nef romane et ses chapelles, le porche, le clocher et la Vierge dorée
  function notreDameDesDoms(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9D3A6), pierreFoncee = A.matiere(0xCDB07C), tuile = A.matiere(0xC8704A), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(48, 11, 30, 2, 0, 0, pierreFoncee); A.toit(30.6, 3, 48, 2, 11, 0, tuile); A.boite(48, 18, 14, 2, 0, 0, pierre); A.toit(14.6, 4, 48, 2, 18, 0, tuile);
    A.abside(7, 18, 26, 0, 0, pierre); A.demiCone(7.5, 3, 26, 18, 0, tuile);
    A.boite(10, 30, 10, -27, 0, 0, pierre); A.boite(10.8, 1.2, 10.8, -27, 30, 0, pierreFoncee); A.cylindre(2.4, 2.4, 3, 12, -27, 31.2, 0, pierre);
    A.cylindre(0.7, 1.3, 6, 12, -27, 34.2, 0, or); A.boule(0.7, -27, 40.6, 0, or);
    A.cylindre(4, 4, 4, 12, 8, 18, 0, pierre); A.dome(4, 0.8, 8, 22, 0, pierreFoncee);
    return A.groupe;
  }

  // la cathédrale Saint-Front de Périgueux : la croix grecque et ses cinq coupoles, leurs lanternons, le haut clocher
  function saintFront(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE2), pierreOmbre = A.matiere(0xDCD6C8);
    const baies = [[10, 0], [-14, 0], [34, 0], [10, -24], [10, 24]];
    A.boites(baies.map(([x, z]) => [24, 18, 24, x, 0, z]), pierre);
    for (const [x, z] of baies) { A.dome(9, 1, x, 18, z, pierre); A.cylindre(1.4, 1.4, 3, 8, x, 26.6, z, pierreOmbre); A.pyramide(1.8, 3, 8, x, 29.6, z, pierreOmbre); }
    A.cones(baies.flatMap(([x, z]) => [[x - 10, z - 10], [x + 10, z - 10], [x - 10, z + 10], [x + 10, z + 10]].map(([a, b]) => [a, b, 1, 18, 4])), pierreOmbre, 8);
    A.boite(20, 14, 20, -36, 0, 0, pierreOmbre); A.boite(12, 30, 12, -42, 0, 0, pierre); A.cylindres(Array.from({ length: 12 }, (_, k) => [-42 + Math.cos(k * Math.PI / 6) * 5.4, Math.sin(k * Math.PI / 6) * 5.4, 0.5, 12, 30]), pierre, 8);
    A.cylindre(5, 5, 12, 16, -42, 30, 0, pierreOmbre); A.pyramide(5.6, 16, 16, -42, 42, 0, pierre);
    return A.groupe;
  }

  // le château de Sully-sur-Loire : le donjon et ses quatre tours rondes, son immense toit, le petit château, les douves
  function sullySurLoire(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE8D8), ardoise = A.matiere(0x4F5D8C), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    A.plaques([[64, 0.3, 8, 0, 0.1, -38], [64, 0.3, 8, 0, 0.1, 42], [8, 0.3, 80, -32, 0.1, 2], [8, 0.3, 80, 32, 0.1, 2]], eau);
    A.boite(40, 22, 20, 0, 0, -22, pierre); A.toit(20.6, 15, 40, 0, 22, -22, ardoise);
    const tours = [[-20, -32], [20, -32], [-20, -12], [20, -12]];
    A.cylindres(tours.map(([x, z]) => [x, z, 6, 26, 0]), pierre, 18); A.cones(tours.map(([x, z]) => [x, z, 6.4, 26, 12]), ardoise, 18);
    A.boite(16, 14, 44, 12, 0, 12, pierre); A.toit(16.6, 8, 44, 12, 14, 12, ardoise, Math.PI / 2); A.cylindres([[20, 34, 5, 18, 0]], pierre, 16); A.cones([[20, 34, 5.4, 18, 10]], ardoise, 16);
    return A.groupe;
  }

  // la cathédrale Saint-Étienne de Limoges : le clocher-porche roman et ses étages octogonaux, la nef gothique
  const limoges = (THREE) => cathedrale(THREE, { F: -46, E: 40, larg: 24, mur: 28, toitH: 10, xT: 10, transept: 41, transeptL: 12, cote: 12, facadeH: 24, rose: 2,
    tours: [{ z: 0, h: 30, octogone: { h: 20, r: 5 }, fleche: 10, r: 5.2, seg: 8 }] });

  // la cathédrale Saint-Sacerdos de Sarlat : la nef, le clocher roman et son bulbe
  function sarlat(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEBD9B0), pierreFoncee = A.matiere(0xCFB98A), lauze = A.matiere(0x7D7B80);
    A.boite(56, 9, 32, 5, 0, 0, pierreFoncee); A.toit(32.6, 4, 56, 5, 9, 0, lauze); A.boite(56, 14, 18, 5, 0, 0, pierre); A.toit(18.6, 6, 56, 5, 14, 0, lauze);
    A.abside(9, 14, 33, 0, 0, pierre); A.demiCone(9.5, 5, 33, 14, 0, lauze);
    A.boite(8, 22, 8, -31, 0, 0, pierre); A.cylindre(3.4, 3.4, 3, 12, -31, 22, 0, pierre); A.dome(3.8, 1.6, -31, 25, 0, lauze); A.cylindre(0.8, 0.8, 2, 8, -31, 31, 0, pierre);
    return A.groupe;
  }

  // la cathédrale de Noyon : les deux tours plates de la façade, le transept aux bras arrondis
  const noyon = (THREE) => cathedrale(THREE, { F: -42, E: 37, larg: 22, mur: 22, toitH: 10, xT: 8, transept: 44, transeptL: 14, cote: 12, facadeH: 30, rose: 4,
    tours: [{ z: -10, h: 62 }, { z: 10, h: 62 }],
    plus: (A, m) => { for (const s of [1, -1]) { A.cylindre(7, 7, 22, 16, 8, 0, s * 22, m.pierre); A.cylindre(7.4, 7.4, 1, 16, 8, 21.5, s * 22, m.pierreFoncee); A.pyramide(7.4, 6, 16, 8, 22, s * 22, m.toit); } } });

  // l'abbatiale de Saint-Benoît-sur-Loire : la tour-porche massive, la nef, le clocher de la croisée, le chœur roman
  function saintBenoit(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), ardoise = A.matiere(0x56659A);
    A.boite(20, 20, 20, -37, 0, 0, pierre); A.boite(20, 6, 20, -37, 20, 0, pierreFoncee); A.combles(20.6, 7, 20.6, -37, 26, 0, ardoise);
    A.boite(50, 10, 26, -2, 0, 0, pierreFoncee); A.toit(26.6, 4, 50, -2, 10, 0, ardoise); A.boite(50, 18, 14, -2, 0, 0, pierre); A.toit(14.6, 6, 50, -2, 18, 0, ardoise);
    A.boite(12, 20, 40, 18, 0, 0, pierre); A.toit(12.6, 6, 40, 18, 20, 0, ardoise, Math.PI / 2);
    A.boite(10, 30, 10, 18, 0, 0, pierre); A.pyramide(7, 8, 4, 18, 30, 0, ardoise);
    A.boite(18, 20, 14, 33, 0, 0, pierre); A.toit(14.6, 6, 18, 33, 20, 0, ardoise); A.abside(7, 20, 42, 0, 0, pierre); A.demiCone(7.5, 5, 42, 20, 0, ardoise); A.abside(13, 10, 42, 0, 0, pierreFoncee);
    return A.groupe;
  }

  // le château de Foix : le rocher, les deux tours carrées et la tour ronde
  function foix(THREE) {
    const A = atelier(THREE);
    const rocher = A.matiere(0x9A948A), pierre = A.matiere(0xE2DACB), pierreFoncee = A.matiere(0xC6BCA6), ardoise = A.matiere(0x4F5D8C);
    A.boite(26, 16, 74, -18, 0, 0, rocher);
    A.cylindre(6.5, 6.5, 22, 20, -18, 16, 25, pierre); A.creneaux([Array.from({ length: 13 }, (_, k) => [-18 + 6.1 * Math.cos(k * Math.PI / 6), 25 + 6.1 * Math.sin(k * Math.PI / 6)])], 38, 0.8, pierreFoncee);
    for (const [z, h] of [[-4, 20], [-30, 18]]) { A.boite(11, h, 11, -18, 16, z, pierre); A.creneaux([A.tourDe(11.4, 11.4, -18, z)], 16 + h, 0.8, pierreFoncee); A.pyramide(5.8, 6, 4, -18, 16 + h + 1.8, z, ardoise); }
    A.remparts([[[-18, -30], [-18, 25]]], 6, 4, pierreFoncee, 16);
    return A.groupe;
  }

  // l'église Saint-Augustin (Baltard) : la façade et sa rose, la nef, le grand dôme et sa lanterne
  function saintAugustin(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(6, 30, 20, -42, 0, 0, pierre); A.toit(20, 6, 6, -42, 30, 0, pierre); A.piece((e) => new THREE.CylinderGeometry(4 + e, 4 + e, 0.6 + 2 * e, 24).rotateZ(Math.PI / 2), vitrail, A.V(-45.2, 20, 0));
    for (const s of [1, -1]) { A.cylindre(2, 2, 30, 8, -42, 0, s * 10, pierre); A.pyramide(2.4, 6, 8, -42, 30, s * 10, ardoise); }
    A.boite(55, 22, 22, -12, 0, 0, pierre); A.toit(22.6, 8, 55, -12, 22, 0, ardoise);
    A.boite(30, 24, 36, 25, 0, 0, pierre); A.cylindre(11, 11, 10, 24, 25, 24, 0, pierre); A.cylindre(11.6, 11.6, 1, 24, 25, 33.5, 0, pierreFoncee); A.dome(11, 1.3, 25, 34.5, 0, ardoise);
    A.cylindre(2, 2, 4, 10, 25, 48.6, 0, pierre); A.dome(2, 1.2, 25, 52.6, 0, ardoise);
    return A.groupe;
  }

  // le Capitole de Toulouse : la longue façade de brique rose et de pierre blanche, ses colonnes de marbre rose, le fronton,
  // les ailes autour de la cour
  function capitole(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD08A72), pierre = A.matiere(0xF2E8D6), marbre = A.matiere(0xC86A6A), tuile = A.matiere(0xC8704A);
    A.boites([[16, 19, 108, 20, 0, 0], [14, 17, 108, -21, 0, 0], [28, 17, 14, 0, 0, -47], [28, 17, 14, 0, 0, 47]], brique);
    A.boite(16.6, 1.4, 108.6, 20, 19, 0, pierre);
    A.plaques(Array.from({ length: 26 }, (_, k) => [0.3, 17, 1.2, 28.2, 1, -50 + k * 4]), pierre);
    A.boite(6, 22, 34, 30, 0, 0, pierre); A.cylindres(Array.from({ length: 8 }, (_, k) => [33.4, -12.25 + k * 3.5, 0.8, 16, 2]), marbre, 12); A.toit(34, 4, 6, 30, 22, 0, pierre, Math.PI / 2);
    return A.groupe;
  }

  // l'abbaye de Sénanque : l'église cistercienne et son petit clocher, les bâtiments des moines, leurs toits de lauzes, et le
  // champ de lavande devant
  function senanque(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCC6), lauze = A.matiere(0x9A958C), lavande = A.matiere(0x8E6BC4, 0x2A1A4A);
    A.boite(42, 14, 12, -4.5, 0, 25, pierre); A.toit(12.6, 5, 42, -4.5, 14, 25, lauze); A.abside(6, 14, 16.5, 0, 25, pierre); A.demiCone(6.4, 4, 16.5, 14, 25, lauze);
    A.boite(7, 20, 7, 5, 0, 25, pierre); A.pyramide(5, 4, 4, 5, 20, 25, lauze);
    A.boite(40, 11, 14, -4.5, 0, 5, pierre); A.toit(14.6, 5, 40, -4.5, 11, 5, lauze); A.boite(14, 10, 30, 22, 0, 0, pierre); A.toit(14.6, 5, 30, 22, 10, 0, lauze, Math.PI / 2);
    A.plaques(Array.from({ length: 14 }, (_, k) => [70, 0.9, 1.4, 0, 0, -20 - k * 3.2]), lavande);
    return A.groupe;
  }

  // la cathédrale Saint-Alexandre-Nevsky (rue Daru) : l'église blanche en croix, ses cinq bulbes dorés et leurs croix
  function alexandreNevsky(THREE) {
    const A = atelier(THREE), V = A.V;
    const blanc = A.matiere(0xF6F3EC), or = A.matiere(0xFFC233, 0x7A4A00);
    const bulbe = (r, x, y, z) => A.piece((e) => new THREE.LatheGeometry([[0.9, 0], [1.15, 0.35], [1.2, 0.6], [1, 1], [0.6, 1.35], [0.2, 1.65], [0, 1.9]].map(([a, b]) => new THREE.Vector2(a * r + e, b * r)), 20), or, V(x, y, z));
    A.boite(14, 18, 14, 0, 0, 0, blanc); A.boites([[8, 14, 26, 0, 0, 0], [26, 14, 8, 0, 0, 0]], blanc); A.abside(4, 14, 13, 0, 0, blanc);
    A.cylindre(3.6, 3.6, 12, 8, 0, 18, 0, blanc); A.pyramide(3.8, 8, 8, 0, 30, 0, blanc); bulbe(2.4, 0, 37, 0);
    for (const [x, z] of [[5, 5], [5, -5], [-5, 5], [-5, -5]]) { A.cylindre(2, 2, 6, 8, x, 18, z, blanc); bulbe(1.6, x, 24, z); }
    A.boites([[0.3, 3.4, 0.3, 0, 41.5, 0], [1.6, 0.3, 0.3, 0, 43.6, 0]].concat([[5, 5], [5, -5], [-5, 5], [-5, -5]].flatMap(([x, z]) => [[0.25, 2.4, 0.25, x, 27, z], [1.2, 0.25, 0.25, x, 28.6, z]])), or);
    return A.groupe;
  }

  // la cathédrale Saint-Julien du Mans : le chœur gothique géant et ses chapelles, la forêt d'arcs-boutants, la nef romane, le
  // transept et sa tour
  function leMans(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xEFE4CB), pierreFoncee = A.matiere(0xD3C3A0), ardoise = A.matiere(0x56659A);
    A.boite(40, 34, 18, 2, 0, 0, pierre); A.toit(18.6, 12, 40, 2, 34, 0, ardoise); A.abside(9, 34, 22, 0, 0, pierre); A.demiCone(9.5, 11, 22, 34, 0, ardoise);
    A.boite(40, 16, 44, 2, 0, 0, pierreFoncee); A.abside(22, 16, 22, 0, 0, pierreFoncee);
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k + 0.5) * Math.PI / 7; A.cylindre(3.4, 3.4, 14, 12, 22 + Math.cos(a) * 24, 0, Math.sin(a) * 24, pierre); }
    for (const x of [-12, -2, 8, 18]) for (const s of [1, -1]) { A.boite(2.4, 26, 2.8, x, 0, s * 28, pierreFoncee); A.poutre(V(x, 24, s * 28), V(x, 31, s * 9), 1.6, 1.2, pierreFoncee); }
    A.boite(14, 28, 50, -24, 0, 0, pierre); A.toit(14.6, 9, 50, -24, 28, 0, ardoise, Math.PI / 2);
    A.boite(58, 24, 14, -60, 0, 0, pierre); A.boite(58, 14, 26, -60, 0, 0, pierreFoncee); A.toit(14.6, 8, 58, -60, 24, 0, ardoise);
    A.boite(10, 52, 10, -24, 0, 22, pierre); A.cylindre(3.4, 3.4, 5, 10, -24, 52, 22, pierre); A.dome(3.4, 1.4, -24, 57, 22, ardoise);
    return A.groupe;
  }

  // l'église Saint-Pierre de Montmartre : la petite église romane et gothique, son clocher
  function saintPierreMontmartre(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(44, 9, 22, 0, 0, 0, pierreFoncee); A.boite(44, 13, 11, 0, 0, 0, pierre); A.toit(11.6, 5, 44, 0, 13, 0, ardoise); A.abside(5.5, 13, 22, 0, 0, pierre); A.demiCone(6, 4, 22, 13, 0, ardoise);
    A.boite(6, 20, 6, 10, 0, -8, pierre); A.pyramide(4.2, 6, 4, 10, 20, -8, ardoise);
    return A.groupe;
  }

  // le château de Brissac : le plus haut château de France (sept étages), sa façade et son pavillon, les deux grosses tours
  // rondes médiévales
  function brissac(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C);
    A.boite(44, 26, 16, 0, 0, 0, tuffeau); A.toit(16.6, 12, 44, 0, 26, 0, ardoise); A.boite(14, 31, 18, 0, 0, -1, tuffeau); A.combles(14.6, 10, 18.6, 0, 31, -1, ardoise);
    for (const s of [1, -1]) { A.cylindre(9, 9, 30, 24, s * 24, 0, 4, tuffeau); A.dome(9.2, 0.5, s * 24, 30, 4, ardoise); }
    const luc = [-14, -7, 7, 14].map((x) => [2, 3.6, 2, x, 26, -8.6]); A.boites(luc, tuffeau); A.toits(luc.map(([, , , x, , z]) => [2.8, 2.4, 2.4, x, 29.6, z, Math.PI / 2]), ardoise);
    return A.groupe;
  }

  // le Pont-Royal (x : l'axe du pont, du nord au sud) : cinq arches de pierre en anse de panier, les piles et leurs avant-becs
  function pontRoyal(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9DFC6), pierreFoncee = A.matiere(0xCFC2A2);
    const larg = 17, p = 4.4, n = 5, x0 = -63, x1 = 63, s = (x1 - x0 - (n - 1) * p) / n, piles = [];
    for (let i = 0; i < n; i++) { const xa = x0 + i * (s + p), xc = xa + s / 2, f = new THREE.Shape(); f.moveTo(xa, 1); f.absellipse(xc, 1, s / 2, 7.5, Math.PI, 0, true); f.lineTo(xa + s, 10.05); f.lineTo(xa, 10.05); f.closePath(); A.extrusion(f, larg - 0.04, 0, 0, 0, pierre, 0, true); if (i < n - 1) piles.push(xa + s + p / 2); }
    A.boites(piles.map((x) => [p, 10, larg, x, 0, 0]), pierre); A.cylindres(piles.flatMap((x) => [[x, larg / 2, 2.6, 8, 0], [x, -larg / 2, 2.6, 8, 0]]), pierreFoncee, 4);
    for (const sg of [1, -1]) A.boite(10, 10, larg, sg * 68, 0, 0, pierre);
    A.boite(146, 1.2, larg + 1, 0, 10, 0, pierreFoncee); for (const sg of [1, -1]) A.boite(146, 1.2, 0.8, 0, 11.2, sg * larg / 2, pierre);
    return A.groupe;
  }

  // l'église de la Sainte-Trinité (x : l'axe, la façade au sud en -x) : la façade et son haut clocher (65 m), la nef, l'abside
  function sainteTrinite(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(70, 22, 24, -3, 0, 0, pierre); A.toit(24.6, 9, 70, -3, 22, 0, ardoise); A.abside(11, 22, 32, 0, 0, pierre); A.demiCone(11.5, 8, 32, 22, 0, ardoise);
    A.boite(10, 30, 34, -37, 0, 0, pierre); A.toit(34, 6, 10, -37, 30, 0, pierre);
    A.boite(7, 13, 26, -45.5, 0, 0, pierreFoncee); A.boite(7.6, 1.2, 26.6, -45.5, 13, 0, pierre);
    A.boite(10, 50, 10, -37, 0, 0, pierre); A.boite(11, 1.4, 11, -37, 50, 0, pierreFoncee); A.cylindre(3.8, 3.8, 7, 12, -37, 51.4, 0, pierre); A.dome(3.8, 1.2, -37, 58.4, 0, ardoise); A.boule(0.6, -37, 63.6, 0, pierreFoncee);
    return A.groupe;
  }

  // la cathédrale Saint-Lazare d'Autun : la nef romane, la flèche gothique de la croisée (80 m), les tours de la façade
  const autun = (THREE) => cathedrale(THREE, { F: -36, E: 31, larg: 20, mur: 22, toitH: 9, xT: 6, transept: 40, transeptL: 12, cote: 9, facadeH: 26, rose: 3,
    tours: [{ z: -9, h: 32, fleche: 12, r: 4.4, seg: 8 }, { z: 9, h: 32, fleche: 12, r: 4.4, seg: 8 }], flecheCroisee: { tour: 14, cote: 10, h: 36, r: 5, seg: 8 } });

  // le château des ducs de Bretagne (Nantes) : l'enceinte et ses tours, le Grand Gouvernement et le Grand Logis aux hauts
  // toits d'ardoise
  function chateauDucsBretagne(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE6D4), pierreFoncee = A.matiere(0xCFC5AC), tuffeau = A.matiere(0xF6F0E0), ardoise = A.matiere(0x4F5D8C);
    const mur = [[[-19, -75], [70, -60], [77, -50], [55, -20], [46, 12], [20, 25], [-45, 64], [-60, 40], [-76, 19], [-71, -12], [-55, -35], [-19, -75]]];
    A.remparts(mur, 17, 6, pierre); A.creneaux(mur, 17, 1, pierreFoncee);
    const tours = [[-19, -75, 7], [77, -50, 11], [46, 12, 6.5], [20, 25, 6], [-45, 64, 7.5], [-76, 19, 9.5], [-71, -12, 8], [-58, -32, 5]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 21, 0]), pierre, 20); A.creneaux(tours.map(([x, z, r]) => Array.from({ length: 13 }, (_, k) => [x + (r - 0.4) * Math.cos(k * Math.PI / 6), z + (r - 0.4) * Math.sin(k * Math.PI / 6)])), 21, 0.8, pierreFoncee);
    A.boite(14, 20, 46, -55, 0, -2, tuffeau, 0.35); A.toits([[14.6, 12, 46, -55, 20, -2, Math.PI / 2 + 0.35]], ardoise);
    A.boite(18, 20, 46, 30, 0, -22, tuffeau, 0.2); A.toits([[18.6, 12, 46, 30, 20, -22, Math.PI / 2 + 0.2]], ardoise);
    return A.groupe;
  }

  // le château de Castelnaud : le donjon, la grosse tour d'artillerie ronde, les courtines, le rocher
  function castelnaud(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D3A6), pierreFoncee = A.matiere(0xCBB487), lauze = A.matiere(0x7D7B80), rocher = A.matiere(0xA89C88);
    A.boite(30, 10, 64, 0, 0, 0, rocher);
    A.boite(12, 22, 12, -6, 10, -18, pierre); A.creneaux([A.tourDe(12.4, 12.4, -6, -18)], 32, 0.8, pierreFoncee);
    A.cylindre(7, 7, 18, 20, 4, 10, 22, pierre); A.creneaux([Array.from({ length: 13 }, (_, k) => [4 + 6.6 * Math.cos(k * Math.PI / 6), 22 + 6.6 * Math.sin(k * Math.PI / 6)])], 28, 0.8, pierreFoncee);
    A.boite(10, 14, 30, -5, 10, 4, pierre); A.toit(10.6, 6, 30, -5, 24, 4, lauze, Math.PI / 2);
    A.remparts([[[10, -28], [12, 0], [8, 16]]], 8, 3, pierreFoncee, 10);
    return A.groupe;
  }

  // la cathédrale Saint-Bénigne de Dijon : les deux tours de la façade et leurs toits coniques, la haute flèche de la croisée,
  // les toits de tuiles vernissées de Bourgogne
  const dijon = (THREE) => cathedrale(THREE, { F: -33, E: 29, larg: 20, mur: 24, toitH: 12, xT: 10, transept: 40, transeptL: 12, cote: 11, facadeH: 28, rose: 4,
    toit: 0xD4A63A, toitFonce: 0x3F4B78,
    tours: [{ z: -11, h: 36, fleche: 10, r: 6.2, seg: 16 }, { z: 11, h: 36, fleche: 10, r: 6.2, seg: 16 }], flecheCroisee: { h: 55, r: 4, seg: 8 } });

  // la cathédrale Saint-Pierre d'Angoulême : la nef à coupoles, la coupole de la croisée et sa lanterne, la façade sculptée et
  // ses deux lanternons, le haut clocher du transept nord
  function angouleme(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2ECDC), pierreOmbre = A.matiere(0xDCD4C2), tuile = A.matiere(0xC8704A);
    A.boite(52, 18, 18, -10, 0, 0, pierre); for (const x of [-28, -16, -4]) A.dome(7, 0.7, x, 18, 0, pierreOmbre);
    A.boite(16, 20, 40, 22, 0, 0, pierre); A.toit(16.6, 4, 40, 22, 20, 0, tuile, Math.PI / 2); A.cylindre(6, 6, 6, 16, 22, 20, 0, pierre); A.dome(6, 1, 22, 26, 0, pierreOmbre); A.cylindre(1.4, 1.4, 3, 10, 22, 31.6, 0, pierre);
    A.abside(8, 18, 30, 0, 0, pierre); A.dome(8, 0.6, 30, 18, 0, pierreOmbre);
    A.boite(3, 24, 20, -37, 0, 0, pierre); for (const s of [1, -1]) { A.cylindre(2, 2, 6, 10, -37, 24, s * 8, pierre); A.pyramide(2.2, 4, 10, -37, 30, s * 8, pierreOmbre); }
    A.boite(11, 36, 11, 22, 0, -24, pierre); A.boite(9, 12, 9, 22, 36, -24, pierreOmbre); A.pyramide(6, 8, 4, 22, 48, -24, tuile);
    return A.groupe;
  }

  // Saint-Trophime d'Arles : la nef romane, le portail sculpté, le clocher carré
  function saintTrophime(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9D3A6), pierreFoncee = A.matiere(0xCDB07C), tuile = A.matiere(0xC8704A);
    A.boite(46, 20, 12, 0, 0, 0, pierre); A.toit(12.6, 4, 46, 0, 20, 0, tuile); A.boite(46, 11, 17, 0, 0, 0, pierreFoncee); A.abside(6, 20, 23, 0, 0, pierre); A.demiCone(6.5, 3, 23, 20, 0, tuile);
    A.boite(2, 12, 10, -24, 0, 0, pierreFoncee); A.toit(10, 3, 2, -24, 12, 0, pierreFoncee);
    A.boite(8, 32, 8, 8, 0, -4, pierre); A.pyramide(5.6, 5, 4, 8, 32, -4, tuile);
    return A.groupe;
  }

  // la cathédrale de Narbonne : le chœur inachevé, immense et crénelé (41 m sous la voûte), ses chapelles, ses arcs-boutants,
  // ses deux tours
  function narbonne(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xE6DCC6), pierreFoncee = A.matiere(0xCABD9E);
    A.boite(36, 41, 18, -6, 0, 0, pierre); A.abside(9, 41, 12, 0, 0, pierre); A.creneaux([[[-24, -9], [12, -9]], [[-24, 9], [12, 9]]], 41, 0.8, pierreFoncee);
    A.boite(36, 22, 47, -6, 0, 0, pierreFoncee); A.abside(23.5, 22, 12, 0, 0, pierreFoncee);
    for (const x of [-18, -8, 2]) for (const s of [1, -1]) A.poutre(V(x, 22, s * 23), V(x, 36, s * 9), 2, 1.5, pierreFoncee);
    A.boite(14.6, 53, 47, -19.7, 0, 0, pierre); A.creneaux([A.tourDe(15, 47.4, -19.7, 0)], 53, 0.8, pierreFoncee);
    for (const z of [-16.5, 13.5]) { A.boite(12, 60, 12, -46, 0, z, pierre); A.creneaux([A.tourDe(12.4, 12.4, -46, z)], 60, 0.8, pierreFoncee); }
    return A.groupe;
  }

  // les arènes d'Arles : l'amphithéâtre romain, ses deux étages d'arcades, les gradins, et les trois tours médiévales
  function arenesArles(THREE) {
    const g = arenesNimes(THREE);
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6CDA0), pierreFoncee = A.matiere(0xC9AC78);
    for (const [x, z] of [[0, -52], [55, 18], [-55, 18]]) { A.boite(10, 30, 10, x, 0, z, pierre); A.creneaux([A.tourDe(10.4, 10.4, x, z)], 30, 0.8, pierreFoncee); }
    g.add(A.groupe); return g;
  }

  // l'église Saint-Merri : la nef flamboyante, ses bas-côtés, le clocher carré au nord de la façade
  const saintMerri = (THREE) => cathedrale(THREE, { F: -35, E: 30, larg: 10, mur: 20, toitH: 7, xT: 8, cote: 8, facadeH: 24, rose: 3.5, tours: [{ z: -10, h: 32 }] });
  // l'église Saint-Séverin : la nef gothique, ses doubles bas-côtés et leurs chapelles, le double déambulatoire, le clocher
  // et sa flèche au nord-ouest
  function saintSeverin(THREE) {
    const g = cathedrale(THREE, { F: -23, E: 22, larg: 16, mur: 20, toitH: 7, xT: 0, cote: 8, facadeH: 22, rose: 3, arcs: false,
      tours: [{ z: -12, h: 34, fleche: 14, r: 3.4, seg: 8 }] });
    const A = atelier(THREE), pierre = A.matiere(0xD2BC8E), toit = A.matiere(0x46567F);
    A.boites([[30, 9, 5.6, -4.75, 0, 16.7], [30, 9, 5.6, -4.75, 0, -16.7]], pierre); A.abside(19.5, 9, 10.5, 0, 0, pierre); A.demiCone(20, 3, 10.5, 9, 0, toit);
    g.add(A.groupe); return g;
  }
  // la cathédrale Saint-Corentin de Quimper : la façade et ses deux flèches de pierre (76 m), le transept
  const quimper = (THREE) => cathedrale(THREE, { pierre: 0xE6DFD0, pierreFoncee: 0xC9C0AE, F: -46, E: 46, larg: 14, mur: 20, toitH: 8, xT: -1.5, transept: 44, transeptL: 15,
    cote: 9, facadeH: 30, rose: 4, tours: [{ z: -8.5, h: 44, fleche: 32, r: 4.2, seg: 8, couleur: 0xBDB5A2 }, { z: 8.5, h: 44, fleche: 32, r: 4.2, seg: 8, couleur: 0xBDB5A2 }] });
  // la cathédrale Saint-Pierre-et-Saint-Paul de Troyes : la grande rose, la tour Saint-Pierre (au nord), le chevet et ses chapelles
  function troyes(THREE) {
    const g = cathedrale(THREE, { F: -48, E: 46, larg: 24, mur: 28, toitH: 11, xT: 17, transept: 58, transeptL: 18, cote: 10, facadeH: 36, rose: 6.5,
      tours: [{ z: -15.5, x: -37.5, h: 62, cote: 21 }] });
    const A = atelier(THREE);
    A.abside(22, 15, 46, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(22.5, 5, 46, 15, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Étienne de Toulouse : la nef « raymondine » de brique (au sud-ouest), le clocher-porche massif,
  // le grand chœur gothique sur un autre axe, son abside et ses chapelles
  function saintEtienneToulouse(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD9845E), pierre = A.matiere(0xEADFC8), pierreFoncee = A.matiere(0xD0C2A2), tuile = A.matiere(0xC8704A), ardoise = A.matiere(0x56659A),
      vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    A.boite(41, 20, 27, -32.5, 0, 14, brique); A.toit(27.6, 6, 41, -32.5, 20, 14, tuile);
    A.piece((e) => new THREE.CylinderGeometry(4.5 + e, 4.5 + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-53.2, 14, 14));
    A.extrusion(A.formeArche(4, 7), 0.8, -53.3, 0, 14, porte, Math.PI / 2);
    A.boite(51, 13, 44, 13.5, 0, -0.5, pierreFoncee); A.abside(22, 13, 39, 0, -0.5, pierreFoncee); A.demiCone(22.5, 4, 39, 13, -0.5, tuile);
    A.boite(51, 28, 22, 13.5, 0, -0.5, pierre); A.toit(22.6, 8, 51, 13.5, 28, -0.5, ardoise); A.abside(11, 28, 39, 0, -0.5, pierre); A.demiCone(11.5, 7, 39, 28, -0.5, ardoise);
    for (let x = -6; x < 38; x += 11) for (const s of [1, -1]) A.poutre(A.V(x, 12, -0.5 + s * 21), A.V(x, 26, -0.5 + s * 11.2), 2, 1.4, pierreFoncee);
    A.boite(21, 30, 10, -43.5, 0, -1, pierre); A.boite(19, 14, 9, -43.5, 30, -1, brique); A.combles(19.6, 4, 9.6, -43.5, 44, -1, tuile);
    return A.groupe;
  }

  // l'église Saint-Roch : la façade classique aux deux ordres de colonnes et son fronton, la longue nef, la chapelle de la
  // Vierge et sa coupole, la chapelle du Calvaire au bout
  function saintRoch(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(68, 13, 34, -14, 0, 0, pierreFoncee); A.boite(64, 23, 16, -16, 0, 0, pierre); A.toit(16.6, 7, 64, -16, 23, 0, ardoise);
    A.boite(10, 18, 18, 20, 0, 0, pierre); A.cylindre(10, 10, 20, 24, 27, 0, 0, pierre); A.dome(10.2, 0.9, 27, 20, 0, ardoise); A.cylindre(1.6, 1.6, 3, 10, 27, 29.2, 0, pierre); A.boule(0.8, 27, 33, 0, or);
    A.boite(14, 12, 16, 45, 0, 0, pierre); A.abside(6, 12, 52, 0, 0, pierre); A.toit(16.6, 5, 14, 45, 12, 0, ardoise); A.demiCone(6.5, 5, 52, 12, 0, ardoise);
    A.boite(5, 1.2, 30, -53.5, 0, 0, pierreFoncee);
    A.boite(4, 16, 28, -50, 0, 0, pierre); A.cylindres([-11, -7, -3, 3, 7, 11].map((z) => [-52.8, z, 0.75, 14.8, 1.2]), pierre, 10);
    A.boite(6.4, 1.2, 28.8, -50.6, 16, 0, pierreFoncee);
    A.boite(4, 11, 16, -50, 17.2, 0, pierre); A.cylindres([-6, -2, 2, 6].map((z) => [-52.4, z, 0.6, 10.4, 17.2]), pierre, 10);
    A.boite(5.6, 1.2, 16.8, -50.6, 27.6, 0, pierreFoncee); A.toit(16.8, 4.5, 5.6, -50.6, 28.8, 0, pierre);
    A.boite(6, 30, 6, 18, 0, -12, pierre); A.pyramide(4.4, 5, 4, 18, 30, -12, ardoise);
    return A.groupe;
  }

  // l'église Saint-Vincent-de-Paul : les deux tours carrées, le portique à colonnes et son fronton sur la grande terrasse,
  // la nef en basilique
  function saintVincentDePaul(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(64, 14, 44, 6, 0, 0, pierreFoncee); A.boite(64, 24, 18, 6, 0, 0, pierre); A.toit(18.6, 6, 64, 6, 24, 0, ardoise);
    A.abside(9, 24, 38, 0, 0, pierre); A.demiCone(9.5, 6, 38, 24, 0, ardoise);
    for (const s of [1, -1]) { A.boite(8, 46, 8, -29, 0, s * 14.5, pierre); A.boite(9, 1.2, 9, -29, 40, s * 14.5, pierreFoncee); A.pyramide(4.6, 4, 4, -29, 46, s * 14.5, pierreFoncee); }
    A.boite(6, 26, 21, -29, 0, 0, pierre);
    A.boite(14, 4, 34, -40, 0, 0, pierreFoncee);
    A.cylindres(Array.from({ length: 6 }, (_, k) => [-35.5, -8.75 + k * 3.5, 0.8, 13, 4]), pierre, 12);
    A.boite(6, 1.6, 22, -34, 17, 0, pierreFoncee); A.toit(22, 4.5, 6, -34, 18.6, 0, pierre);
    return A.groupe;
  }

  // la porte Saint-Martin : l'arc de triomphe à trois arches, ses bas-reliefs et l'attique
  function porteSaintMartin(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE3CB), pierreFoncee = A.matiere(0xD3C3A0), relief = A.matiere(0xC9B48A);
    for (const s of [1, -1]) { A.boite(2.4, 13.5, 6, s * 8.8, 0, 0, pierre); A.boite(2.3, 13.5, 6, s * 3.85, 0, 0, pierre); }
    const voute = (r, ys, ytop) => { const v = new THREE.Shape(); v.moveTo(-r, ys); v.absarc(0, ys, r, Math.PI, 0, true); v.lineTo(r, ytop); v.lineTo(-r, ytop); v.closePath(); return v; };
    A.extrusion(voute(2.7, 6.5, 13.5), 5.98, 0, 0, 0, pierre, 0, true);
    for (const s of [1, -1]) A.extrusion(voute(1.3, 3.6, 13.5), 5.98, s * 6.3, 0, 0, pierre, 0, true);
    for (const s of [1, -1]) A.boite(3.4, 3.2, 6.3, s * 6.3, 9.4, 0, relief);
    A.boite(21, 1, 7, 0, 13.5, 0, pierreFoncee); A.boite(20, 3.6, 6, 0, 14.5, 0, pierre); A.boite(9, 2.4, 6.3, 0, 15, 0, relief); A.boite(20.6, 0.6, 6.6, 0, 18.1, 0, pierreFoncee);
    return A.groupe;
  }

  // la chapelle Saint-Louis de la Salpêtrière : la croix grecque, l'octogone central, son tambour, son dôme et sa lanterne
  function salpetriere(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00), porte = A.matiere(0x6E5A44);
    const oct = (r, h) => (e) => new THREE.CylinderGeometry(r + e, r + e, h + 2 * e, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0);
    A.piece(oct(26, 16), pierre, A.V(0, 0, 0)); A.piece((e) => new THREE.ConeGeometry(26.6 + e, 6 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 3, 0), ardoise, A.V(0, 16, 0));
    for (const [x, z, r] of [[30.5, 0, 0], [-30.5, 0, 0], [0, 30.5, 1], [0, -30.5, 1]]) { A.boite(13, 15, 13, x, 0, z, pierre); A.toit(13.6, 5, 13, x, 15, z, ardoise, r * Math.PI / 2); }
    A.extrusion(A.formeArche(5, 9), 0.8, 0, 0, -37.2, porte);
    A.piece(oct(10.8, 9), pierre, A.V(0, 18, 0)); A.piece(oct(11.4, 1.2), pierreFoncee, A.V(0, 26.4, 0));
    A.dome(10.6, 1.05, 0, 27, 0, ardoise); A.cylindre(1.8, 1.8, 4, 8, 0, 37.6, 0, pierre); A.pyramide(2.2, 3, 8, 0, 41.6, 0, ardoise); A.boule(0.7, 0, 45, 0, or);
    return A.groupe;
  }

  // la synagogue de Besançon : la salle de style mauresque, la façade et son arc, les tourelles et leurs petits dômes
  function synagogueBesancon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0DDB4), pierreFoncee = A.matiere(0xC99E66), dome = A.matiere(0x4E8C8C), porte = A.matiere(0x6E5A44), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(29, 13, 16, 0, 0, 0, pierre); A.boite(29.6, 1, 16.6, 0, 13, 0, pierreFoncee); A.combles(27, 2.5, 14, 0, 14, 0, pierreFoncee);
    A.boite(4, 17, 10, -13.5, 0, 0, pierre); A.boite(4.4, 1, 10.4, -13.5, 17, 0, pierreFoncee);
    A.piece((e) => new THREE.CylinderGeometry(2.6 + e, 2.6 + e, 1 + 2 * e, 24).rotateZ(Math.PI / 2), vitrail, A.V(-15.6, 11.5, 0));
    A.extrusion(A.formeArche(3.4, 6.5), 0.8, -15.7, 0, 0, porte, Math.PI / 2);
    for (const [x, z] of [[-14.5, -7.5], [-14.5, 7.5], [14.5, -7.5], [14.5, 7.5]]) { A.cylindre(1.4, 1.4, 17, 12, x, 0, z, pierre); A.boule(1.7, x, 18, z, dome); A.pyramide(0.5, 2, 8, x, 19.3, z, dome); }
    return A.groupe;
  }

  // la forteresse royale de Chinon : la longue enceinte sur l'éperon, le logis royal et son toit, la tour de l'Horloge,
  // les tours du fort du Coudray et le fossé qui le sépare du château du Milieu
  function chinon(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xEFE6CF), tuffeauOmbre = A.matiere(0xD5C9AA), ardoise = A.matiere(0x4F5D8C);
    const enceinte = [[107, 10], [84, 30], [40, 37], [-12, 37], [-64, 37], [-87, 32], [-112, 30], [-130, 22], [-140, 4], [-124, -24], [-92, -44], [-64, -51], [-24, -46], [8, -41], [52, -28], [92, -8], [107, 10]];
    const fosse = [[-72, -49], [-81, -5], [-76, 36]];
    A.remparts([enceinte, fosse], 11, 3, tuffeauOmbre); A.creneaux([enceinte, fosse], 11, 0.8, tuffeau);
    A.boite(52, 14, 16, -38, 0, 26, tuffeau); A.toit(16.6, 8, 52, -38, 14, 26, ardoise);
    A.boite(6, 27, 15, 107, 0, 12.5, tuffeau); A.toit(6.6, 6, 15.6, 107, 27, 12.5, ardoise, Math.PI / 2); A.boite(2.2, 3, 2.2, 107, 32, 12.5, tuffeau); A.pyramide(1.8, 3, 8, 107, 35, 12.5, ardoise);
    A.cylindres([[-81, -5, 6, 17, 0], [-87, 27, 7.5, 20, 0], [-130.5, 14.5, 4, 15, 0]], tuffeau, 16);
    A.creneaux([A.tourDe(8.4, 15.4, 11, -34.5), A.tourDe(11.4, 20.4, -63.5, -47)], 19, 0.8, tuffeauOmbre); A.boites([[8, 19, 15, 11, 0, -34.5], [11, 19, 20, -63.5, 0, -47]], tuffeau);
    return A.groupe;
  }

  // le château de Coucy : l'enceinte et ses quatre grosses tours rondes, en ruine (le donjon a été détruit en 1917)
  function coucy(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE2D8C2), ombre = A.matiere(0xC4B898);
    const T = [[-50, -31, 8, 26], [-13, -68, 8, 12], [65, 9, 9.5, 12], [-38, 37, 7.5, 18]];
    const mur = [...T.map(([x, z]) => [x, z]), [T[0][0], T[0][1]]];
    A.remparts([mur], 12, 3.5, ombre); A.creneaux([mur], 12, 0.9, pierre);
    A.cylindres(T.map(([x, z, r, h]) => [x, z, r, h, 0]), pierre, 18);
    return A.groupe;
  }

  // l'église Saint-Julien-le-Pauvre : la petite église romane et gothique, sa nef, ses bas-côtés, ses trois absides
  function saintJulienLePauvre(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9DFC8), pierreFoncee = A.matiere(0xCFC0A0), ardoise = A.matiere(0x56659A), porte = A.matiere(0x6E5A44);
    A.boite(26, 8, 18, -2, 0, 0, pierreFoncee); A.toit(18.6, 3, 26, -2, 8, 0, ardoise);
    A.boite(26, 13, 8, -2, 0, 0, pierre); A.toit(8.6, 5, 26, -2, 13, 0, ardoise);
    A.abside(4, 13, 11, 0, 0, pierre); A.demiCone(4.5, 4, 11, 13, 0, ardoise);
    for (const s of [1, -1]) { A.abside(3, 8, 11, 0, s * 6, pierreFoncee); A.demiCone(3.4, 3, 11, 8, s * 6, ardoise); }
    A.boite(1.4, 14, 9, -15, 0, 0, pierre); A.toit(9, 4, 1.4, -15, 14, 0, pierre); A.boite(0.8, 3, 1.6, -15, 18, 0, pierre);
    A.extrusion(A.formeArche(2.6, 4.2), 0.6, -15.8, 0, 0, porte, Math.PI / 2);
    return A.groupe;
  }

  // le baptistère Saint-Jean de Poitiers : la salle carrée et son toit de tuiles, le narthex polygonal, l'abside et ses absidioles
  function baptistere(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9DCC0), pierreFoncee = A.matiere(0xCDBB98), tuile = A.matiere(0xC8704A);
    A.boite(9, 9, 10, 0.5, 0, 0, pierre); A.toit(10.6, 3.5, 9.6, 0.5, 9, 0, tuile);
    A.piece((e) => new THREE.CylinderGeometry(5.5 + e, 5.5 + e, 6 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 3, 0), pierreFoncee, A.V(-7.5, 0, 0));
    A.piece((e) => new THREE.ConeGeometry(6 + e, 2.5 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 1.25, 0), tuile, A.V(-7.5, 6, 0));
    A.abside(3.5, 7, 5, 0, 0, pierre); A.demiCone(3.9, 2, 5, 7, 0, tuile);
    A.cylindres([[1, -5, 2.5, 6, 0], [1, 5, 2.5, 6, 0]], pierreFoncee, 12); A.cones([[1, -5, 2.8, 6, 2], [1, 5, 2.8, 6, 2]], tuile, 12);
    return A.groupe;
  }

  // le château de Beynac : le donjon carré et ses créneaux, le logis seigneurial et son toit de lauzes, au bord de la falaise
  function beynac(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6CFA0), pierreOmbre = A.matiere(0xC9B07E), lauze = A.matiere(0x857A70);
    A.boite(30, 14, 12, 14, 0, 21, pierreOmbre);
    A.boite(18, 30, 14, 8, 0, 4, pierre); A.creneaux([A.tourDe(18.4, 14.4, 8, 4)], 30, 0.9, pierreOmbre);
    A.boite(13, 20, 26, 22.5, 0, 12, pierre); A.toit(13.6, 9, 26.6, 22.5, 20, 12, lauze, Math.PI / 2);
    A.cylindre(3.5, 3.5, 18, 14, -4, 0, 30, pierre); A.pyramide(4, 6, 14, -4, 18, 30, lauze);
    return A.groupe;
  }

  // le château de Pau : les ailes autour de la cour, leurs toits d'ardoise, le donjon de brique de Gaston Fébus,
  // la tour carrée du nord, les tours rondes de l'ouest
  function pau(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE4CF), brique = A.matiere(0xC8714E), ardoise = A.matiere(0x4F5D8C);
    A.boite(66, 22, 12, -46, 0, -18.5, pierre, 0.26); A.toit(12.6, 8, 66, -46, 22, -18.5, ardoise, 0.26);
    A.boite(12, 22, 36, -74, 0, 6, pierre); A.toit(12.6, 8, 36, -74, 22, 6, ardoise, Math.PI / 2);
    A.boite(50, 22, 14, -55, 0, 17, pierre); A.toit(14.6, 8, 50, -55, 22, 17, ardoise);
    A.boite(20, 22, 39, -20, 0, -7.5, pierre); A.combles(20.6, 9, 39.6, -20, 22, -7.5, ardoise);
    A.boite(14, 41, 16, -16, 0, 8, brique); A.creneaux([A.tourDe(14.4, 16.4, -16, 8)], 41, 0.8, brique);
    A.boite(8.5, 33, 8, -15.75, 0, -28, pierre); A.combles(9, 6, 8.5, -15.75, 33, -28, ardoise);
    A.cylindres([[-80, -12, 5, 26, 0], [-80, 24, 5, 26, 0]], pierre, 16); A.cones([[-80, -12, 5.4, 26, 10], [-80, 24, 5.4, 26, 10]], ardoise, 16);
    return A.groupe;
  }

  // l'église Saint-Nicolas-du-Chardonnet : la nef classique, le transept, le chevet arrondi, le clocher
  const saintNicolasChardonnet = (THREE) => cathedrale(THREE, { F: -34, E: 28.5, larg: 11, mur: 21, toitH: 7, xT: -1.75, transept: 30, transeptL: 14.5, cote: 8, facadeH: 24, rose: 3,
    arcs: false, tours: [{ z: -9.5, h: 32 }] });

  // l'abbaye aux Hommes de Caen : l'abbatiale Saint-Étienne, ses deux flèches (80 m), la tour-lanterne, le chevet gothique
  function abbayeAuxHommes(THREE) {
    const g = cathedrale(THREE, { pierre: 0xEFE6CF, F: -47.5, E: 46, larg: 12, mur: 24, toitH: 9, xT: 16, transept: 44, transeptL: 14, cote: 9, facadeH: 30, rose: 2.5,
      tours: [{ z: -10.5, h: 48, fleche: 34, r: 4.4, seg: 8 }, { z: 10.5, h: 48, fleche: 34, r: 4.4, seg: 8 }], flecheCroisee: { tour: 12, cote: 13, h: 14, r: 7, seg: 4 } });
    const A = atelier(THREE); A.abside(16, 12, 42, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(16.5, 4, 42, 12, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // Saint-Michel d'Aiguilhe : la chapelle romane et son clocher, perchée sur une aiguille de lave de 80 m
  function aiguilhe(THREE) {
    const A = atelier(THREE);
    const roche = A.matiere(0x7B6A5C), rocheClaire = A.matiere(0x96836F), pierre = A.matiere(0xE2D2B4), tuile = A.matiere(0xA9614A), lave = A.matiere(0x5C4E46);
    A.piece((e) => new THREE.CylinderGeometry(10 + e, 21 + e, 72 + 2 * e, 9).translate(0, 36, 0), roche, A.V(0, 0, 0));
    A.piece((e) => new THREE.CylinderGeometry(6 + e, 14 + e, 40 + 2 * e, 7).translate(0, 20, 0), rocheClaire, A.V(9, 0, 6));
    A.boite(13, 6, 7, -1, 72, 0, pierre); A.toit(7.6, 2.5, 13, -1, 78, 0, tuile); A.abside(3.5, 6, 5.5, 72, 0, pierre); A.demiCone(3.8, 2, 5.5, 78, 0, tuile);
    A.boite(1, 7.5, 7.6, -7.8, 72, 0, lave);
    A.boite(4, 13, 4, 2, 72, -3, pierre); A.pyramide(3, 4, 4, 2, 85, -3, tuile);
    return A.groupe;
  }

  // la cathédrale Sainte-Marie d'Auch : la façade Renaissance et ses deux tours, la nef, le chevet et ses chapelles
  function auch(THREE) {
    const g = cathedrale(THREE, { pierre: 0xEBDDBE, F: -36, E: 56, larg: 20, mur: 26, toitH: 9, xT: 20, cote: 8.5, facadeH: 34, rose: 3, tours: [{ z: -8.7, h: 45 }, { z: 8.7, h: 45 }] });
    const A = atelier(THREE); A.abside(16, 13, 50, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(16.5, 4, 50, 13, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Pierre de Rennes : la façade classique de granit et ses deux tours, la nef en basilique, le transept
  function rennes(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xE3DCCB), granitFonce = A.matiere(0xC4BBA6), ardoise = A.matiere(0x56659A), porte = A.matiere(0x6E5A44);
    A.boite(18, 30, 31, -39, 0, 0, granit); A.boite(19, 1.4, 32, -39, 30, 0, granitFonce);
    for (const s of [1, -1]) { A.boite(10, 17, 10, -39, 31.4, s * 10.5, granit); A.boite(11, 1.2, 11, -39, 48.4, s * 10.5, granitFonce); A.pyramide(4, 3, 4, -39, 49.6, s * 10.5, granitFonce); }
    A.cylindres([-9, -3, 3, 9].map((z) => [-48.8, z, 0.9, 14, 0]), granit, 12); A.boite(2, 1.2, 22, -48.8, 14, 0, granitFonce);
    A.extrusion(A.formeArche(4, 8), 0.8, -48.3, 0, 0, porte, Math.PI / 2);
    A.boite(54, 20, 30, -3, 0, 0, granit); A.toit(30.6, 7, 54, -3, 20, 0, ardoise);
    A.boite(15.4, 20, 52, 3, 0, -2, granit); A.toit(15.4, 7, 52.6, 3, 20, -2, ardoise, Math.PI / 2);
    A.abside(15, 20, 24, 0, 0, granit); A.demiCone(15.5, 7, 24, 20, 0, ardoise);
    return A.groupe;
  }

  // la cathédrale Saint-Maurice d'Angers : la nef unique à voûtes angevines, le transept, l'abside, la façade et ses
  // deux flèches (77 m), la tour Renaissance entre elles
  function cathedraleAngers(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xEFE8D6), tuffeauOmbre = A.matiere(0xD6CCB4), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00), porte = A.matiere(0x6E5A44);
    const zc = -3;
    A.boite(76, 26, 22, 9, 0, zc, tuffeau); A.toit(22.6, 9, 76, 9, 26, zc, ardoise);
    A.abside(11, 26, 46, 0, zc, tuffeau); A.demiCone(11.5, 8, 46, 26, zc, ardoise);
    A.boite(25, 26, 50, 21.5, 0, -1, tuffeau); A.toit(25.6, 9, 50, 21.5, 26, -1, ardoise, Math.PI / 2);
    A.boite(8, 34, 25, -35, 0, zc, tuffeau);
    for (const z of [zc - 9, zc + 9]) { A.boite(8, 42, 8, -35, 0, z, tuffeau); A.boite(9, 1.4, 9, -35, 38, z, tuffeauOmbre); A.pyramide(4.4, 33, 8, -35, 42, z, ardoise); A.boule(0.9, -35, 75.6, z, or); }
    A.boite(9, 50, 9, -35, 0, zc, tuffeau); A.cylindre(3.6, 3.6, 6, 8, -35, 50, zc, tuffeau); A.dome(3.8, 1.3, -35, 56, zc, ardoise); A.boule(0.7, -35, 61.4, zc, or);
    A.extrusion(A.formeArche(4, 8), 0.8, -39.3, 0, zc, porte, Math.PI / 2);
    return A.groupe;
  }

  // le pont Marie (x : l'axe du pont) : cinq arches de pierre en plein cintre, les piles et leurs avant-becs
  function pontMarie(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE9DFC6), pierreFoncee = A.matiere(0xCFC2A2);
    const larg = 22, p = 5, n = 5, x0 = -44, x1 = 44, s = (x1 - x0 - (n - 1) * p) / n, piles = [];
    for (let i = 0; i < n; i++) { const xa = x0 + i * (s + p), xc = xa + s / 2, f = new THREE.Shape(); f.moveTo(xa, 0.5); f.absarc(xc, 0.5, s / 2, Math.PI, 0, true); f.lineTo(xa + s, 9.05); f.lineTo(xa, 9.05); f.closePath(); A.extrusion(f, larg - 0.04, 0, 0, 0, pierre, 0, true); if (i < n - 1) piles.push(xa + s + p / 2); }
    A.boites(piles.map((x) => [p, 9, larg, x, 0, 0]), pierre); A.cylindres(piles.flatMap((x) => [[x, larg / 2, 2.9, 7, 0], [x, -larg / 2, 2.9, 7, 0]]), pierreFoncee, 4);
    for (const sg of [1, -1]) A.boite(8, 9, larg, sg * 48, 0, 0, pierre);
    A.boite(104, 1.2, larg + 1, 0, 9, 0, pierreFoncee); for (const sg of [1, -1]) A.boite(104, 1.2, 0.8, 0, 10.2, sg * larg / 2, pierre);
    return A.groupe;
  }

  // le palais des ducs de Bourgogne (Dijon) : les ailes classiques autour de la cour d'honneur, le vieux palais ducal et
  // la tour Philippe le Bon (46 m)
  function palaisDucsBourgogne(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CC), pierreOmbre = A.matiere(0xD8C9A8), ardoise = A.matiere(0x56659A), ardoiseFoncee = A.matiere(0x46567F);
    A.boites([[76, 15, 52, -50, 0, 20], [102, 15, 22, 39, 0, -4], [47, 15, 39, 66.5, 0, 26.5], [50, 16, 25, -2, 0, -27.5]], pierre);
    A.combles(76.6, 6, 52.6, -50, 15, 20, ardoise); A.toit(22.6, 7, 102, 39, 15, -4, ardoise); A.combles(47.6, 7, 39.6, 66.5, 15, 26.5, ardoise); A.toit(25.6, 10, 50, -2, 16, -27.5, ardoiseFoncee);
    A.boite(10, 46, 13.6, 9.4, 0, -6.8, pierre); A.creneaux([A.tourDe(10.4, 14, 9.4, -6.8)], 46, 0.8, pierreOmbre);
    A.cylindre(2, 2, 6, 10, 13, 46, -12, pierre); A.pyramide(2.4, 4, 10, 13, 52, -12, ardoiseFoncee);
    return A.groupe;
  }

  // la cathédrale Saint-Louis de Blois : la nef, le chevet, la tour de la façade et sa lanterne Renaissance
  function cathedraleBlois(THREE) {
    const g = cathedrale(THREE, { F: -41, E: 30, larg: 12, mur: 20, toitH: 7, xT: 8, cote: 8, facadeH: 24, rose: 3,
      tours: [{ z: -10, x: -32.5, h: 36, cote: 13, octogone: { h: 12, r: 4.6 } }] });
    const A = atelier(THREE), ardoise = A.matiere(0x46567F), or = A.matiere(0xFFC233, 0x7A4A00);
    A.dome(4.6, 1.2, -32.5, 48, -10, ardoise); A.cylindre(1.2, 1.2, 3, 8, -32.5, 53.3, -10, A.matiere(0xF0E3C4)); A.boule(0.8, -32.5, 57, -10, or);
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Pierre de Vannes : la nef, le transept, le clocher et sa flèche, la rotonde du Saint-Sacrement
  function cathedraleVannes(THREE) {
    const g = cathedrale(THREE, { pierre: 0xE3DCCB, pierreFoncee: 0xC4BBA6, F: -34, E: 64, larg: 12, mur: 18, toitH: 7, xT: 16, transept: 34, transeptL: 12, cote: 9, facadeH: 26, rose: 4,
      tours: [{ z: -12, h: 30, fleche: 20, r: 4, seg: 8 }] });
    const A = atelier(THREE), granit = A.matiere(0xE3DCCB), ardoise = A.matiere(0x46567F);
    A.cylindre(6, 6, 14, 18, -2.7, 0, -18.5, granit); A.dome(6.2, 0.9, -2.7, 14, -18.5, ardoise); A.cylindre(1.2, 1.2, 2.4, 8, -2.7, 19.2, -18.5, granit);
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Pierre de Poitiers : l'église-halle au chevet plat, ses deux tours inachevées, la grande façade
  const cathedralePoitiers = (THREE) => cathedrale(THREE, { F: -38, E: 63, chevetPlat: true, larg: 24, mur: 25, toitH: 12, xT: 20, transept: 66, transeptL: 19.5, cote: 10,
    facadeH: 32, rose: 5, arcs: false, tours: [{ z: -19.25, h: 41 }, { z: 19.25, h: 41 }] });

  // la cathédrale Saint-Pierre de Montpellier : la nef unique, ses tours, et le porche aux deux énormes piliers coniques
  function cathedraleMontpellier(THREE) {
    const g = cathedrale(THREE, { F: -46, E: 38, larg: 16, mur: 26, toitH: 8, xT: 0, cote: 10, facadeH: 26, rose: 2, arcs: false,
      tours: [{ z: -14.2, h: 33, fleche: 10, r: 5, seg: 4 }, { z: 14.2, h: 33, fleche: 10, r: 5, seg: 4 }] });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E), ardoise = A.matiere(0x46567F);
    A.cylindres([[-62, -7, 2.4, 13, 0], [-62, 7, 2.4, 13, 0]], pierre, 16); A.cones([[-62, -7, 2.6, 13, 10], [-62, 7, 2.6, 13, 10]], pierreFoncee, 16);
    A.boite(12, 3, 17, -57, 11, 0, pierre); A.toit(17.6, 5, 12, -57, 14, 0, ardoise);
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Gervais-et-Saint-Protais de Soissons : la tour sud de la façade, la nef, le transept, le chœur
  const cathedraleSoissons = (THREE) => cathedrale(THREE, { F: -37, E: 66, larg: 16, mur: 30, toitH: 10, xT: 24, transept: 56, transeptL: 26, cote: 10, facadeH: 36, rose: 5.5,
    tours: [{ z: 12, x: -30.5, h: 52, cote: 14 }] });

  // la cathédrale Saint-Louis de Versailles : la façade et ses deux tours aux lanternes, le dôme de la croisée, le chevet
  function cathedraleVersailles(THREE) {
    const g = cathedrale(THREE, { F: -41, E: 33, larg: 22, mur: 24, toitH: 8, xT: 4, transept: 50, transeptL: 14, cote: 9, facadeH: 28, rose: 3,
      tours: [{ z: -14, h: 34, octogone: { h: 8, r: 3.6 } }, { z: 14, h: 34, octogone: { h: 8, r: 3.6 } }] });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E), ardoise = A.matiere(0x46567F), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(7, 7, 8, 16, 4, 28, 0, pierre); A.dome(7.4, 1.1, 4, 36, 0, ardoise); A.cylindre(1.4, 1.4, 3, 8, 4, 43.6, 0, pierre); A.boule(0.7, 4, 47.2, 0, or);
    for (const s of [1, -1]) A.dome(3.8, 1.2, -41, 42, s * 14, ardoise);
    A.abside(20, 14, 24, 0, 0, pierreFoncee); A.demiCone(20.5, 4, 24, 14, 0, ardoise);
    g.add(A.groupe); return g;
  }

  // l'église du Val-de-Grâce : le dôme (41 m) et ses côtes dorées, la façade à deux ordres de colonnes, la nef, le transept
  function valDeGrace(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x6E7AA0), or = A.matiere(0xFFC233, 0x7A4A00),
      porte = A.matiere(0x6E5A44);
    const cx = 9.7, cz = -0.7;
    A.boite(64, 16, 20, 4, 0, -3.5, pierre); A.toit(20.6, 6, 64, 4, 16, -3.5, ardoise);
    A.boite(28, 18, 28, cx, 0, cz, pierre); A.boite(12, 16, 12, cx, 0, -18, pierre);
    A.boite(16, 18, 34, 8, 0, 31, pierre); A.toit(16.6, 6, 34, 8, 18, 31, ardoise, Math.PI / 2);
    A.boite(22, 20, 3, 8, 0, 48.5, pierre); A.cylindres([-8, -4, 4, 8].map((d) => [8 + d, 50.6, 0.8, 11, 0]), pierre, 12); A.boite(23, 1.4, 4, 8, 11, 49, pierreFoncee);
    A.boite(13, 9, 3, 8, 20, 48.5, pierre); A.toit(14.4, 4, 3.6, 8, 29, 48.5, pierre, Math.PI / 2); A.extrusion(A.formeArche(4, 7), 0.8, 8, 0, 50.2, porte);
    A.cylindre(10, 10, 10, 24, cx, 18, cz, pierre); A.cylindres(Array.from({ length: 16 }, (_, k) => [cx + Math.cos(k * Math.PI / 8) * 10.6, cz + Math.sin(k * Math.PI / 8) * 10.6, 0.5, 9, 18.5]), pierre, 8);
    A.cylindre(10.8, 10.8, 1.2, 24, cx, 27.6, cz, pierreFoncee); A.dome(10.4, 1.08, cx, 28.8, cz, plomb);
    for (let k = 0; k < 8; k++) A.piece((e) => new THREE.TorusGeometry(10.45, 0.22 + e, 4, 16, Math.PI / 2).scale(1, 1.08, 1).rotateY(k * Math.PI / 4), or, A.V(cx, 28.8, cz), null, true);
    A.cylindre(1.8, 1.8, 3.5, 12, cx, 39.6, cz, pierre); A.dome(2.1, 1.3, cx, 43.1, cz, plomb); A.boule(0.7, cx, 46.2, cz, or);
    return A.groupe;
  }

  // la basilique Saint-Michel de Bordeaux : l'église gothique, sa façade et sa rose, et la flèche Saint-Michel (114 m), isolée
  // sur la place, devant elle
  function saintMichelBordeaux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE2C6), pierreFoncee = A.matiere(0xD2C29E), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00),
      vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    A.boite(79, 16, 45, -10.85, 0, 3.15, pierreFoncee); A.toit(45.6, 5, 79, -10.85, 16, 3.15, ardoise);
    A.boite(74, 26, 16, -9, 0, 3.15, pierre); A.toit(16.6, 8, 74, -9, 26, 3.15, ardoise);
    A.boite(3, 30, 18, -50, 0, 3.15, pierre); A.toit(18, 6, 3, -50, 30, 3.15, pierre);
    A.piece((e) => new THREE.CylinderGeometry(4.5 + e, 4.5 + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-51.6, 20, 3.15));
    A.extrusion(A.formeArche(5, 9), 0.8, -51.7, 0, 3.15, porte, Math.PI / 2);
    const fx = -82, fz = 3.5;
    A.boite(12, 24, 12, fx, 0, fz, pierre); A.cones([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [fx + a * 5.5, fz + b * 5.5, 0.9, 24, 6]), pierreFoncee, 6);
    A.cylindre(6, 6, 30, 6, fx, 24, fz, pierre); A.cylindre(6.6, 6.6, 1.4, 6, fx, 54, fz, pierreFoncee);
    A.pyramide(5.6, 56, 6, fx, 55.4, fz, pierre); A.boule(1.2, fx, 112, fz, or);
    return A.groupe;
  }

  // la cathédrale Notre-Dame de Rodez : le grès rose, la façade fortifiée et ses tours, la nef, le chœur et ses chapelles,
  // le clocher (87 m) au nord du chœur
  function cathedraleRodez(THREE) {
    const A = atelier(THREE);
    const gres = A.matiere(0xD9967A), gresFonce = A.matiere(0xB97A62), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(62, 16, 44, -16, 0, 3, gresFonce); A.toit(44.6, 4, 62, -16, 16, 3, ardoise); A.boite(62, 30, 16, -16, 0, 3, gres); A.toit(16.6, 7, 62, -16, 30, 3, ardoise);
    A.boite(35, 30, 16, 32.5, 0, 3, gres); A.toit(16.6, 7, 35, 32.5, 30, 3, ardoise); A.abside(8, 30, 50, 0, 3, gres); A.demiCone(8.5, 7, 50, 30, 3, ardoise);
    A.abside(26, 16, 36, 0, 0, gresFonce); A.demiCone(26.5, 4, 36, 16, 0, ardoise);
    A.boite(6, 36, 44, -45, 0, 3, gres); A.piece((e) => new THREE.CylinderGeometry(5 + e, 5 + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-48.2, 24, 3));
    A.boites([[15, 44, 12, -40, 0, 18.2], [15, 44, 12, -40, 0, -12.2]], gres); A.creneaux([A.tourDe(15.4, 12.4, -40, 18.2), A.tourDe(15.4, 12.4, -40, -12.2)], 44, 0.8, gresFonce);
    const tx = 43, tz = -24.4;
    A.boite(14, 34, 11, tx, 0, tz, gres); A.cylindre(5.6, 5.6, 22, 8, tx, 34, tz, gres);
    A.cones(Array.from({ length: 8 }, (_, k) => [tx + Math.cos(k * Math.PI / 4) * 5.6, tz + Math.sin(k * Math.PI / 4) * 5.6, 0.7, 56, 5]), gresFonce, 6);
    A.cylindre(4.2, 4.2, 16, 8, tx, 56, tz, gres); A.dome(4.4, 1.3, tx, 72, tz, gres); A.cylindre(1.2, 1.2, 6, 8, tx, 77.6, tz, gres); A.boule(1.4, tx, 85, tz, or);
    return A.groupe;
  }

  // la basilique Notre-Dame-des-Victoires : la façade classique et son fronton, la nef, l'abside, le petit clocher
  function notreDameDesVictoires(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), porte = A.matiere(0x6E5A44);
    A.boite(54, 11, 24, -1, 0, 0, pierreFoncee); A.toit(24.6, 3, 54, -1, 11, 0, ardoise); A.boite(54, 19, 13, -1, 0, 0, pierre); A.toit(13.6, 6, 54, -1, 19, 0, ardoise);
    A.abside(6.5, 19, 26, 0, 0, pierre); A.demiCone(7, 5, 26, 19, 0, ardoise);
    A.boite(3, 15, 24, -28.5, 0, 0, pierre); A.cylindres([-9, -4, 4, 9].map((z) => [-30.4, z, 0.6, 13, 0]), pierre, 10); A.boite(4, 1, 24.6, -29, 14, 0, pierreFoncee);
    A.boite(3, 9, 13, -28.5, 15, 0, pierre); A.toit(13.6, 3.5, 3.6, -28.5, 24, 0, pierre);
    A.extrusion(A.formeArche(3.4, 6.5), 0.6, -30.2, 0, 0, porte, Math.PI / 2);
    A.boite(5, 26, 5, 16, 0, -9.5, pierre); A.pyramide(3.6, 4, 4, 16, 26, -9.5, ardoise);
    return A.groupe;
  }

  // la grande synagogue de la Victoire : la salle et ses bas-côtés, le grand pignon de la façade, sa rose, son portail
  // en plein cintre et ses deux tourelles
  function grandeSynagogue(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEADFC6), pierreFoncee = A.matiere(0xCDBB98), ardoise = A.matiere(0x56659A), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    A.boite(30, 18, 54, 0, 0, 1, pierreFoncee); A.toit(30.6, 4, 54, 0, 18, 1, ardoise, Math.PI / 2);
    A.boite(18, 26, 54, 0, 0, 1, pierre); A.toit(18.6, 7, 54, 0, 26, 1, ardoise, Math.PI / 2);
    A.boite(32, 30, 3, 0, 0, -27.5, pierre); A.toit(32, 8, 3, 0, 30, -27.5, pierre, Math.PI / 2);
    A.piece((e) => new THREE.CylinderGeometry(5.5 + e, 5.5 + e, 1 + 2 * e, 28).rotateX(Math.PI / 2), vitrail, A.V(0, 20, -29.2));
    A.extrusion(A.formeArche(7, 11), 0.8, 0, 0, -29.2, porte);
    for (const s of [1, -1]) { A.boite(4, 32, 4, s * 15, 0, -27.5, pierre); A.pyramide(2.9, 4, 4, s * 15, 32, -27.5, pierreFoncee); }
    return A.groupe;
  }

  // la fontaine des Innocents : les gradins et le bassin, le pavillon Renaissance à arcades et sa coupole d'écailles
  function fontaineInnocents(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), plomb = A.matiere(0x6E7AA0), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    A.boite(24, 0.8, 24, 0, 0, 0, pierreFoncee); A.boite(20, 0.8, 20, 0, 0.8, 0, pierreFoncee);
    A.plaques([[19.4, 0.2, 19.4, 0, 1.6, 0]], eau); A.boite(13, 0.9, 13, 0, 1.6, 0, pierreFoncee);
    A.boites([[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, z]) => [2.6, 7.6, 2.6, x, 2.5, z]), pierre);
    A.boites([[12.6, 2.6, 2.6, 0, 10.1, -5], [12.6, 2.6, 2.6, 0, 10.1, 5], [2.6, 2.6, 12.6, -5, 10.1, 0], [2.6, 2.6, 12.6, 5, 10.1, 0]], pierre);
    A.boite(13.4, 1, 13.4, 0, 12.7, 0, pierreFoncee); A.domeCarre(12, 4.5, 12, 0, 13.7, 0, plomb);
    return A.groupe;
  }

  // l'église Saint-Paul-Saint-Louis : la façade jésuite à trois ordres de colonnes, la nef, le dôme de la croisée
  function saintPaulSaintLouis(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x6E7AA0), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(42, 14, 26, -6, 0, 0, pierreFoncee); A.toit(26.6, 4, 42, -6, 14, 0, ardoise);
    A.boite(42, 24, 14, -6, 0, 0, pierre); A.toit(14.6, 6, 42, -6, 24, 0, ardoise);
    A.boite(12, 24, 26, 9, 0, 0, pierre); A.toit(12.6, 6, 26, 9, 24, 0, ardoise, Math.PI / 2);
    A.boite(10, 22, 14, 19, 0, 0, pierre); A.abside(7, 22, 24, 0, 0, pierre); A.demiCone(7.5, 5, 24, 22, 0, ardoise);
    A.cylindre(6.5, 6.5, 10, 16, 9, 26, 0, pierre); A.dome(6.8, 1.3, 9, 36, 0, plomb); A.cylindre(1.4, 1.4, 4, 8, 9, 44.6, 0, pierre); A.dome(1.6, 1.2, 9, 48.6, 0, plomb); A.boule(0.6, 9, 51, 0, or);
    A.boite(4, 16, 25, -28, 0, 0, pierre); A.cylindres([-11, -7.5, -4, 4, 7.5, 11].map((z) => [-30.5, z, 0.75, 15, 0]), pierre, 10); A.boite(5, 1.4, 25.6, -28.5, 15, 0, pierreFoncee);
    A.boite(4, 11, 18, -28, 16.4, 0, pierre); A.cylindres([-7, -3, 3, 7].map((z) => [-30.3, z, 0.6, 10, 16.4]), pierre, 10); A.boite(5, 1.2, 18.6, -28.5, 26.4, 0, pierreFoncee);
    A.boite(4, 9, 11, -28, 27.6, 0, pierre); A.toit(11.6, 3.5, 4.6, -28, 36.6, 0, pierre);
    return A.groupe;
  }

  // l'église Notre-Dame-de-Lorette : le portique à colonnes et son fronton, la nef en basilique, l'abside
  function notreDameDeLorette(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(62, 12, 33, -1, 0, 0, pierreFoncee); A.toit(33.6, 3, 62, -1, 12, 0, ardoise);
    A.boite(62, 18, 15, -1, 0, 0, pierre); A.toit(15.6, 5, 62, -1, 18, 0, ardoise); A.abside(7.5, 18, 27, 0, 0, pierre); A.demiCone(8, 5, 27, 18, 0, ardoise);
    A.boite(3, 18, 26, -32.5, 0, 0, pierre); A.boite(6, 1.2, 26, -36, 0, 0, pierreFoncee);
    A.cylindres([-10, -3.3, 3.3, 10].map((z) => [-36.5, z, 1, 13, 1.2]), pierre, 12);
    A.boite(5.4, 2, 25, -35.5, 14.2, 0, pierreFoncee); A.toit(25, 4.5, 5.4, -35.5, 16.2, 0, pierre);
    return A.groupe;
  }

  // l'église Saint-Jean de Montmartre : la première église en béton armé, habillée de brique, ses arcades et son clocher
  function saintJeanMontmartre(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xC8704E), briqueClaire = A.matiere(0xE09A74), ceramique = A.matiere(0x2F7F8F), ardoise = A.matiere(0x56659A);
    A.boite(44, 18, 26, 2, 0, 2, brique); A.toit(26.6, 5, 44, 2, 18, 2, ardoise);
    A.boite(4, 22, 26, -22, 0, 2, briqueClaire); A.toit(26, 4, 4, -22, 22, 2, brique);
    for (const z of [-6, 2, 10]) A.extrusion(A.formeArche(5, 9), 0.8, -24.3, 0, z, ceramique, Math.PI / 2);
    A.boite(7, 32, 7, -19, 0, -13, brique); A.boite(7.6, 1, 7.6, -19, 32, -13, briqueClaire); A.pyramide(5, 5, 4, -19, 33, -13, ardoise);
    return A.groupe;
  }

  // la cathédrale Notre-Dame de Senlis : la flèche de la tour sud (78 m), la tour nord, la nef, le transept flamboyant
  const cathedraleSenlis = (THREE) => cathedrale(THREE, { F: -34, E: 32, larg: 12, mur: 24, toitH: 8, xT: 0, transept: 41, transeptL: 18, cote: 9, facadeH: 26, rose: 3,
    tours: [{ z: -9.5, h: 30 }, { z: 9.5, h: 38, fleche: 40, r: 4.2, seg: 8, couleur: 0xC9BC9C }] });

  // la cathédrale Saint-Étienne de Meaux : la tour nord (achevée), la tour sud coiffée d'ardoise, la nef, le chœur et ses chapelles
  function cathedraleMeaux(THREE) {
    const g = cathedrale(THREE, { F: -40, E: 35, larg: 22, mur: 33, toitH: 10, xT: 5, transept: 48, transeptL: 12, cote: 10, facadeH: 36, rose: 5,
      tours: [{ z: -12, x: -37, h: 61, cote: 12.5 }, { z: 12, x: -37, h: 36, cote: 12.5, fleche: 8, r: 6.5, seg: 4, couleur: 0x46567F }] });
    const A = atelier(THREE); A.abside(18, 16, 28, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(18.5, 4, 28, 16, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // l'abbatiale Sainte-Foy de Conques : l'église romane, ses deux tours et leurs flèches de pierre, la tour-lanterne de la
  // croisée, les toits de lauzes
  const conques = (THREE) => cathedrale(THREE, { pierre: 0xE3C79A, pierreFoncee: 0xC9A774, toit: 0x857A70, toitFonce: 0x6E645C, F: -11, E: 39, larg: 10, mur: 18, toitH: 7, xT: 16,
    transept: 39, transeptL: 14, cote: 7.5, facadeH: 22, rose: 2, arcs: false,
    tours: [{ z: -7, h: 26, fleche: 12, r: 3.8, seg: 4 }, { z: 7, h: 26, fleche: 12, r: 3.8, seg: 4 }], flecheCroisee: { tour: 12, cote: 10, h: 10, r: 5, seg: 8 } });

  // l'abbaye aux Dames de Caen : l'église de la Trinité, ses deux tours carrées, la tour de la croisée, l'abside
  const abbayeAuxDames = (THREE) => cathedrale(THREE, { pierre: 0xEFE6CF, F: -36, E: 37, larg: 10, mur: 20, toitH: 7, xT: 18, transept: 36, transeptL: 12, cote: 9, facadeH: 22, rose: 2.5,
    arcs: false, tours: [{ z: -7.5, h: 34 }, { z: 7.5, h: 34 }], flecheCroisee: { tour: 8, cote: 10, h: 4, r: 6, seg: 4 } });

  // le château de Châteaudun : le grand donjon rond et son toit conique, l'aile gothique de Dunois, l'aile Renaissance de
  // Longueville, la Sainte-Chapelle
  function chateaudun(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE4CF), pierreOmbre = A.matiere(0xD4C6A6), ardoise = A.matiere(0x4F5D8C);
    A.boite(89, 22, 19, 1.25, 0, -42.5, pierre); A.toit(19.6, 10, 89, 1.25, 22, -42.5, ardoise);
    A.boite(15, 22, 45, -21.5, 0, -10.7, pierre); A.toit(15.6, 9, 45, -21.5, 22, -10.7, ardoise, Math.PI / 2);
    A.boite(30, 16, 22, -2, 0, 0, pierreOmbre); A.toit(22.6, 8, 30, -2, 16, 0, ardoise);
    A.cylindre(9, 9.6, 31, 24, -1.4, 0, 9, pierre); A.cylindre(9.8, 9.8, 1.4, 24, -1.4, 29.6, 9, pierreOmbre); A.pyramide(10, 13, 24, -1.4, 31, 9, ardoise);
    return A.groupe;
  }

  // l'hôtel de Sens : le logis gothique et ses ailes autour de la cour, les hauts toits d'ardoise, la tour carrée, les
  // tourelles en encorbellement
  function hotelDeSens(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE4CF), pierreOmbre = A.matiere(0xD4C6A6), ardoise = A.matiere(0x4F5D8C);
    A.boite(37, 14, 11, -24, 0, -36, pierre, 0.67); A.toit(11.6, 9, 37, -24, 14, -36, ardoise, 0.67);
    A.boite(10, 14, 31, 3, 0, -32.5, pierre); A.toit(10.6, 8, 31, 3, 14, -32.5, ardoise, Math.PI / 2);
    A.boite(37, 12, 9, -17, 0, -12.5, pierre, -0.415); A.toit(9.6, 7, 37, -17, 12, -12.5, ardoise, -0.415);
    A.boite(8, 26, 8, -8, 0, -45, pierre); A.pyramide(6, 8, 4, -8, 26, -45, ardoise);
    const tourelles = [[-40, -26], [5, -48], [1, -6], [-34, -20]];
    A.cylindres(tourelles.map(([x, z]) => [x, z, 2.2, 8, 7]), pierreOmbre, 12); A.cones(tourelles.map(([x, z]) => [x, z, 2.5, 15, 6]), ardoise, 12);
    return A.groupe;
  }

  // l'hôtel de Sully : le corps de logis entre cour et jardin, ses deux ailes sur la cour, les pavillons sur la rue
  // Saint-Antoine, les hauts toits d'ardoise
  function hotelDeSully(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(34, 14, 14, 3.5, 0, -12, pierre); A.toit(14.6, 9, 34, 3.5, 14, -12, ardoise);
    for (const x of [-19, 22]) { A.boite(10, 13, 31, x, 0, -35, pierre); A.toit(10.6, 7, 31, x, 13, -35, ardoise, Math.PI / 2); }
    for (const x of [-19, 22]) { A.boite(11, 15, 9, x, 0, -55, pierre); A.combles(11.6, 7, 9.6, x, 15, -55, ardoise); }
    A.boite(30, 9, 4, 1.5, 0, -55, pierreFoncee);
    return A.groupe;
  }

  // la basilique Saint-Urbain de Troyes : le chef-d'œuvre gothique rayonnant, son chœur haut et vitré, son transept et sa
  // fine flèche
  function saintUrbain(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E), ardoise = A.matiere(0x46567F), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(20, 11, 20, -22, 0, 0, pierreFoncee); A.toit(20.6, 3, 20, -22, 11, 0, ardoise);
    A.boite(20, 22, 10, -22, 0, 0, pierre); A.toit(10.6, 7, 20, -22, 22, 0, ardoise);
    A.boite(14, 24, 27, -5, 0, 0, pierre); A.toit(14.6, 8, 27.6, -5, 24, 0, ardoise, Math.PI / 2);
    A.boite(22, 24, 12, 7, 0, 0, pierre); A.toit(12.6, 8, 22, 7, 24, 0, ardoise); A.abside(6, 24, 18, 0, 0, pierre); A.demiCone(6.5, 7, 18, 24, 0, ardoise);
    A.boites([[5, 9, 3, -5, 0, 15], [5, 9, 3, -5, 0, -15]], pierreFoncee);
    A.pyramide(2.4, 16, 8, -5, 31, 0, ardoise); A.boule(0.7, -5, 47.6, 0, or);
    A.boite(2, 26, 12, -32.5, 0, 0, pierre); A.toit(12, 5, 2, -32.5, 26, 0, pierre);
    A.piece((e) => new THREE.CylinderGeometry(3 + e, 3 + e, 1 + 2 * e, 24).rotateZ(Math.PI / 2), vitrail, A.V(-33.8, 17, 0));
    return A.groupe;
  }

  // la chapelle expiatoire : la chapelle et sa coupole, ses trois absides, son portique, les galeries du « campo santo »
  // autour du jardin
  function chapelleExpiatoire(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(12, 14, 12, -5, 0, -0.5, pierre); A.cylindre(5.5, 5.5, 4, 16, -5, 14, -0.5, pierre); A.dome(5.8, 0.8, -5, 18, -0.5, pierreFoncee); A.cylindre(1, 1, 2, 8, -5, 22.4, -0.5, pierre);
    A.cylindres([[-5, -8.5, 4.5, 11, 0], [-5, 7.5, 4.5, 11, 0], [-12.5, -0.5, 4.5, 11, 0]], pierre, 16);
    A.piece((e) => new THREE.SphereGeometry(4.7 + e, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), pierreFoncee, A.V(-5, 11, -8.5));
    A.piece((e) => new THREE.SphereGeometry(4.7 + e, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), pierreFoncee, A.V(-5, 11, 7.5));
    A.piece((e) => new THREE.SphereGeometry(4.7 + e, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), pierreFoncee, A.V(-12.5, 11, -0.5));
    A.cylindres([-3.5, -1.2, 1.2, 3.5].map((z) => [3.5, z - 0.5, 0.55, 9, 0]), pierre, 10); A.boite(3, 1, 10, 3, 9, -0.5, pierreFoncee); A.toit(10, 2.5, 3, 3, 10, -0.5, pierre);
    A.boites([[54, 6, 6, 15, 0, -14], [54, 6, 6, 15, 0, 12.2], [9, 8, 32, 37.5, 0, -1]], pierre);
    A.toits([[6.6, 2.5, 54, 15, 6, -14], [6.6, 2.5, 54, 15, 6, 12.2], [9.6, 3, 32, 37.5, 8, -1, Math.PI / 2]], ardoise);
    return A.groupe;
  }

  // la cathédrale Notre-Dame de Coutances : les deux flèches de la façade, la grande tour-lanterne octogonale (« le plomb »),
  // le chœur et son déambulatoire
  function cathedraleCoutances(THREE) {
    const g = cathedrale(THREE, { F: -43, E: 41, larg: 18, mur: 24, toitH: 9, xT: 3, transept: 48, transeptL: 15, cote: 9, facadeH: 30, rose: 3,
      tours: [{ z: -9, h: 44, fleche: 34, r: 4.2, seg: 8 }, { z: 9, h: 44, fleche: 34, r: 4.2, seg: 8 }], flecheCroisee: { tour: 22, cote: 14, h: 8, r: 7.5, seg: 8 } });
    const A = atelier(THREE); A.abside(17.5, 14, 33, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(18, 4, 33, 14, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Étienne d'Auxerre : la tour nord de la façade (68 m), la nef, le transept, le chœur
  const cathedraleAuxerre = (THREE) => cathedrale(THREE, { F: -49, E: 38, larg: 18, mur: 30, toitH: 10, xT: 20, transept: 46, transeptL: 14, cote: 10, facadeH: 34, rose: 5,
    tours: [{ z: -12.5, x: -40.5, h: 62, cote: 19 }] });

  // l'abbatiale Saint-Ouen de Rouen : la façade et ses deux flèches, la tour-lanterne de la croisée (82 m), la longue nef
  const saintOuen = (THREE) => cathedrale(THREE, { F: -64, E: 69, larg: 14, mur: 33, toitH: 11, xT: 12, transept: 57, transeptL: 20, cote: 10, facadeH: 36, rose: 6,
    tours: [{ z: -11, h: 50, fleche: 32, r: 4.5, seg: 8 }, { z: 11, h: 50, fleche: 32, r: 4.5, seg: 8 }], flecheCroisee: { tour: 26, cote: 14, h: 10, r: 6, seg: 8 } });

  // la cathédrale Sainte-Marie de Bayonne : les deux flèches de la façade, la nef, le chœur et ses chapelles
  function cathedraleBayonne(THREE) {
    const g = cathedrale(THREE, { F: -38, E: 34, larg: 16, mur: 30, toitH: 9, xT: 10, transept: 38, transeptL: 12, cote: 10, facadeH: 34, rose: 5,
      tours: [{ z: -9, h: 50, fleche: 35, r: 4.4, seg: 8 }, { z: 9, h: 50, fleche: 35, r: 4.4, seg: 8 }] });
    const A = atelier(THREE); A.abside(18, 15, 24, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(18.5, 4, 24, 15, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Nazaire de Béziers : l'église fortifiée, sa grande rose, sa tour carrée
  const cathedraleBeziers = (THREE) => cathedrale(THREE, { pierre: 0xEAD9B4, pierreFoncee: 0xCDB58A, toit: 0xC8704A, toitFonce: 0xA9583A, F: -22, E: 22, larg: 18, mur: 24, toitH: 6, xT: 0,
    cote: 9, facadeH: 30, rose: 6, arcs: false, tours: [{ z: -8, x: -21, h: 46, cote: 10 }] });

  // la cathédrale Saint-Cyr-et-Sainte-Julitte de Nevers : ses deux absides (romane à l'ouest, gothique à l'est), la nef,
  // le transept, la tour Bohier au sud
  function cathedraleNevers(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE2C6), pierreFoncee = A.matiere(0xD2C29E), ardoise = A.matiere(0x56659A);
    A.boite(84, 14, 34, -4, 0, 0, pierreFoncee); A.toit(34.6, 4, 84, -4, 14, 0, ardoise);
    A.boite(84, 26, 14, -4, 0, 0, pierre); A.toit(14.6, 7, 84, -4, 26, 0, ardoise);
    A.boite(14, 26, 46, 6, 0, 0, pierre); A.toit(14.6, 7, 46, 6, 26, 0, ardoise, Math.PI / 2);
    A.cylindre(7, 7, 22, 18, -46, 0, 0, pierre); A.cones([[-46, 0, 7.4, 22, 6]], ardoise, 18);
    A.abside(7, 26, 38, 0, 0, pierre); A.demiCone(7.5, 7, 38, 26, 0, ardoise); A.abside(15, 14, 38, 0, 0, pierreFoncee); A.demiCone(15.5, 4, 38, 14, 0, ardoise);
    A.boite(11, 46, 11, -14, 0, 21, pierre); A.creneaux([A.tourDe(11.4, 11.4, -14, 21)], 46, 0.8, pierreFoncee);
    A.cones([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [-14 + a * 4.6, 21 + b * 4.6, 0.8, 46, 6]), pierreFoncee, 6);
    return A.groupe;
  }

  // la cathédrale Saint-Étienne de Toul : la façade flamboyante et ses deux tours à lanternes octogonales, la nef, le transept
  const cathedraleToul = (THREE) => cathedrale(THREE, { F: -34, E: 39, larg: 14, mur: 30, toitH: 10, xT: 25, transept: 50, transeptL: 14, cote: 11, facadeH: 40, rose: 5,
    tours: [{ z: -9, h: 46, octogone: { h: 14, r: 5 } }, { z: 9, h: 46, octogone: { h: 14, r: 5 } }] });

  // les Hospices de Beaune (l'Hôtel-Dieu) : la grande salle des Pôvres, son toit d'ardoise et sa fine flèche, les ailes
  // autour de la cour et leurs toits de tuiles vernissées
  function hospicesBeaune(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE4CC), ardoise = A.matiere(0x56659A), vernis = A.matiere(0xE0A62E), rouge = A.matiere(0xB8452E), vert = A.matiere(0x3E8A55), noir = A.matiere(0x3A3A44),
      or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(21, 10, 56, -16.5, 0, -22, pierre); A.toit(21.6, 14, 56.6, -16.5, 10, -22, ardoise, Math.PI / 2);
    A.boite(2.4, 4, 2.4, -16.5, 23, -20, pierre); A.pyramide(1.8, 16, 8, -16.5, 27, -20, ardoise); A.boule(0.5, -16.5, 43.3, -20, or);
    A.boite(18, 9, 70, 21, 0, -15, pierre); A.toit(18.6, 12, 70.6, 21, 9, -15, vernis, Math.PI / 2);
    A.boite(19, 9, 16, 3, 0, 10, pierre); A.toit(16.6, 10, 19, 3, 9, 10, vernis);
    const bandes = [rouge, vert, noir, rouge, vert, noir, rouge];
    bandes.forEach((m, k) => A.toit(18.9, 12.15, 2.4, 21, 8.95, -44 + k * 9.6, m, Math.PI / 2));
    A.boites(Array.from({ length: 6 }, (_, k) => [2.4, 3.6, 3, 13, 11, -42 + k * 10]), pierre); A.cones(Array.from({ length: 6 }, (_, k) => [13, -42 + k * 10, 2, 14.6, 4]), vernis, 4);
    return A.groupe;
  }

  // le château de Gien : le logis de brique aux motifs de losanges, ses deux ailes en équerre, la tourelle d'escalier
  function gien(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xB5523B), pierre = A.matiere(0xEDE4CF), ardoise = A.matiere(0x4F5D8C);
    A.boite(75, 18, 11.5, -22.5, 0, 4.4, brique); A.toit(12.1, 9, 75, -22.5, 18, 4.4, ardoise);
    A.boite(17.4, 18, 18, 6, 0, -10, brique); A.toit(18, 9, 18.6, 6, 18, -10, ardoise, Math.PI / 2);
    A.boites([[1.2, 18, 1.2, -60, 0, -1.4], [1.2, 18, 1.2, -60, 0, 10.2], [1.2, 18, 1.2, 14.7, 0, 10.2], [1.2, 18, 1.2, 14.7, 0, -19]], pierre);
    A.cylindre(3.5, 3.5, 22, 16, -4, 0, -2, pierre); A.cones([[-4, -2, 3.9, 22, 7]], ardoise, 16);
    return A.groupe;
  }

  // le château de Falaise : le grand donjon normand et le petit donjon, la haute tour ronde Talbot
  function falaise(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCC4), ombre = A.matiere(0xC9BB98);
    A.boite(22, 24, 20, -58, 0, -64, pierre); A.creneaux([A.tourDe(22.4, 20.4, -58, -64)], 24, 0.9, ombre);
    A.boite(12, 17, 14, -44, 0, -55, pierre); A.creneaux([A.tourDe(12.4, 14.4, -44, -55)], 17, 0.9, ombre);
    A.cylindre(6.5, 6.8, 32, 20, -74, 0, -40, pierre); A.cylindre(7.1, 7.1, 1.4, 20, -74, 30.6, -40, ombre);
    return A.groupe;
  }

  // l'ossuaire de Douaumont : la longue galerie voûtée et ses extrémités arrondies, la tour-lanterne (46 m) au milieu
  function ossuaireDouaumont(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6E2D6), pierreOmbre = A.matiere(0xCFC9B8);
    A.boite(117, 8, 14.7, -4.5, 0, 4.7, pierre);
    A.piece((e) => new THREE.CylinderGeometry(7.35 + e, 7.35 + e, 117 + 2 * e, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.6, 1), pierreOmbre, A.V(-4.5, 8, 4.7));
    for (const x of [-63, 54]) { A.cylindre(7.35, 7.35, 8, 18, x, 0, 4.7, pierre); A.dome(7.35, 0.6, x, 8, 4.7, pierreOmbre); }
    A.boite(10, 12, 27, -4, 0, -16.5, pierre);
    A.piece((e) => new THREE.CylinderGeometry(3.6 + e, 5.2 + e, 34 + 2 * e, 4).rotateY(Math.PI / 4).translate(0, 17, 0), pierre, A.V(-4, 12, -10));
    A.dome(2.6, 1.6, -4, 46, -10, pierreOmbre);
    return A.groupe;
  }

  // l'église Saint-Thomas de Strasbourg : l'église-halle de grès rose, son massif occidental et sa tour, ses toits de tuiles
  function saintThomasStrasbourg(THREE) {
    const A = atelier(THREE);
    const gres = A.matiere(0xC98F7B), gresFonce = A.matiere(0xA96F5C), tuile = A.matiere(0x9E4F3A);
    A.boite(40, 18, 36, 28, 0, 2.5, gres); A.toit(36.6, 14, 40, 28, 18, 2.5, tuile);
    A.boite(8, 18, 18, 52, 0, 2.5, gres); A.toit(18.6, 7, 8, 52, 18, 2.5, tuile);
    A.boite(17, 22, 32, -0.5, 0, 2.5, gres); A.toit(32.6, 6, 17, -0.5, 22, 2.5, tuile, Math.PI / 2);
    A.boite(12, 40, 12, -0.5, 0, 2.5, gres); A.boite(12.8, 1.2, 12.8, -0.5, 40, 2.5, gresFonce); A.pyramide(8.5, 10, 4, -0.5, 41.2, 2.5, tuile);
    return A.groupe;
  }

  // le pont Valentré (x : l'axe du pont) : les six arches, les piles et leurs avant-becs, les trois tours fortifiées et leurs
  // toits pointus
  function pontValentre(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D5B0), pierreFoncee = A.matiere(0xCBB68C), tuile = A.matiere(0x9E5A44);
    const larg = 6, p = 6, n = 6, x0 = -63.5, x1 = 63.5, s = (x1 - x0 - (n - 1) * p) / n, piles = [];
    for (let i = 0; i < n; i++) { const xa = x0 + i * (s + p), xc = xa + s / 2, f = new THREE.Shape(); f.moveTo(xa, 0.5); f.absellipse(xc, 0.5, s / 2, 7, Math.PI, 0, true); f.lineTo(xa + s, 9.05); f.lineTo(xa, 9.05); f.closePath(); A.extrusion(f, larg - 0.04, 0, 0, 0, pierre, 0, true); if (i < n - 1) piles.push(xa + s + p / 2); }
    A.boites(piles.map((x) => [p, 9, larg, x, 0, 0]), pierre); A.cylindres(piles.flatMap((x) => [[x, larg / 2, 3.6, 9, 0], [x, -larg / 2, 3.6, 9, 0]]), pierreFoncee, 4);
    for (const sg of [1, -1]) A.boite(22, 9, larg, sg * 74.5, 0, 0, pierre);
    A.boite(171, 1, larg + 1, 0, 9, 0, pierreFoncee); A.creneaux([[[-85.5, larg / 2], [85.5, larg / 2]], [[-85.5, -larg / 2], [85.5, -larg / 2]]], 10, 0.6, pierre);
    for (const x of [-67.5, 0, 67.5]) { A.boite(9, 32, 9, x, 0, 0, pierre); A.boite(10.4, 2, 10.4, x, 30, 0, pierreFoncee); A.pyramide(7.6, 9, 4, x, 32, 0, tuile); }
    return A.groupe;
  }

  // l'église Saint-Joseph du Havre (Auguste Perret) : le plan carré de béton, la grande tour-lanterne octogonale (107 m)
  function saintJosephHavre(THREE) {
    const A = atelier(THREE);
    const beton = A.matiere(0xCBC4B6), betonFonce = A.matiere(0xA9A194), verre = A.matiere(0xE8B84A, 0x5A3A00);
    A.boite(46, 17, 41, 0, 0, 0, beton); A.boite(36, 3, 31, 0, 17, 0, betonFonce);
    const oct = (rh, rb, h, y, m) => A.piece((e) => new THREE.CylinderGeometry(rh + e, rb + e, h + 2 * e, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0), m, A.V(0, y, 0));
    oct(9, 9.5, 33, 20, beton); oct(9.3, 9.3, 1.2, 53, betonFonce);
    oct(6.5, 9, 28, 54.2, beton); oct(3, 6.5, 18, 82.2, beton); oct(0.4, 3, 7, 100.2, betonFonce);
    for (let k = 0; k < 8; k++) A.piece((e) => new THREE.BoxGeometry(1.2 + 2 * e, 26 + 2 * e, 0.3 + 2 * e).translate(0, 13, 9.2), verre, A.V(0, 24, 0), new THREE.Quaternion().setFromAxisAngle(A.V(0, 1, 0), k * Math.PI / 4), true);
    return A.groupe;
  }

  // le mémorial national du Canada à Vimy : le grand mur de pierre blanche et ses deux pylônes (30 m)
  function memorialVimy(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2F0E8), pierreOmbre = A.matiere(0xD9D5C8);
    A.boite(24, 2, 62, 31, 0, -26, pierreOmbre); A.boite(5, 7, 58, 31, 2, -26, pierre);
    for (const z of [-32, -20]) A.piece((e) => new THREE.CylinderGeometry(1.9 + e, 3 + e, 30 + 2 * e, 4).rotateY(Math.PI / 4).translate(0, 15, 0), pierre, A.V(31, 9, z));
    return A.groupe;
  }

  // l'église Notre-Dame-la-Grande de Poitiers : la façade romane sculptée et ses deux tourelles en pommes de pin, le clocher
  // de la croisée et son toit en écailles, l'abside
  function notreDameLaGrande(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEADCBE), pierreFoncee = A.matiere(0xCDB98F), tuile = A.matiere(0xB7684A), porte = A.matiere(0x6E5A44);
    A.boite(52, 13, 24, -2, 0, 0, pierre); A.toit(24.6, 5, 52, -2, 13, 0, tuile);
    A.abside(7, 12, 24, 0, 0, pierre); A.demiCone(7.5, 4, 24, 12, 0, tuile);
    A.boite(3, 17, 24, -29, 0, 0, pierreFoncee); A.toit(20, 5, 3, -29, 17, 0, pierreFoncee);
    for (const z of [-11, 11]) { A.cylindre(2.4, 2.4, 17, 12, -29, 0, z, pierre); A.cylindre(1.8, 1.8, 3, 10, -29, 17, z, pierre); A.pyramide(2.1, 6, 12, -29, 20, z, pierreFoncee); }
    A.extrusion(A.formeArche(4.5, 7), 0.6, -30.6, 0, 0, porte, Math.PI / 2);
    A.boite(8, 20, 8, 6, 0, 0, pierre); A.cylindre(3.6, 3.6, 6, 12, 6, 20, 0, pierre); A.pyramide(4, 8, 12, 6, 26, 0, pierreFoncee);
    return A.groupe;
  }

  // la cathédrale Notre-Dame du Puy-en-Velay : la nef et ses coupoles, la façade polychrome en haut du grand escalier,
  // le clocher à étages
  function cathedralePuy(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xD9C7A2), lave = A.matiere(0x6B5A50), tuile = A.matiere(0xA9614A);
    A.boite(66, 22, 24, -7.4, 0, 0, pierre); A.toit(24.6, 4, 66, -7.4, 22, 0, tuile);
    for (const x of [-32, -20, -8, 4]) { A.piece((e) => new THREE.CylinderGeometry(5 + e, 5 + e, 3 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 1.5, 0), pierre, A.V(x, 24, 0)); A.dome(5.2, 0.8, x, 27, 0, tuile); }
    A.boite(3, 26, 24, -41.5, 0, 0, pierre); A.boites([[0.6, 24, 1.6, -43.2, 0, -8], [0.6, 24, 1.6, -43.2, 0, 8]], lave);
    for (const z of [-4, 4]) A.extrusion(A.formeArche(5, 16), 0.6, -43.2, 0, z, lave, Math.PI / 2);
    A.boites([[11, 20, 11, 31, 0, -6.2], [8.5, 12, 8.5, 31, 20, -6.2], [6.5, 10, 6.5, 31, 32, -6.2], [4.5, 8, 4.5, 31, 42, -6.2]], pierre); A.pyramide(3.2, 6, 4, 31, 50, -6.2, tuile);
    return A.groupe;
  }

  // l'église Saint-Maclou de Rouen : le chef-d'œuvre flamboyant, le porche aux cinq pignons, la tour-lanterne et sa flèche
  function saintMaclou(THREE) {
    const g = cathedrale(THREE, { F: -17, E: 34, larg: 9, mur: 24, toitH: 8, xT: 23.6, transept: 29, transeptL: 8.4, cote: 9, facadeH: 26, rose: 3,
      tours: [{ z: 0, h: 22, cote: 9 }], flecheCroisee: { tour: 14, cote: 9, h: 30, r: 4, seg: 8 } });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4);
    A.boite(5, 13, 20, -21.5, 0, 0, pierre); for (const z of [-7, 0, 7]) A.toit(6.4, 6, 3, -23, 13, z, pierre);
    g.add(A.groupe); return g;
  }

  // le couvent des Jacobins de Toulouse : l'église de brique et ses contreforts, son chevet, le clocher octogonal à étages
  function jacobins(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD27A55), briqueClaire = A.matiere(0xE59A72), tuile = A.matiere(0xB0563A);
    A.boite(70, 29, 25.6, -11.6, 0, 45.5, brique); A.toit(26.2, 8, 70, -11.6, 29, 45.5, tuile); A.abside(12.8, 29, 23.4, 0, 45.5, brique); A.demiCone(13.3, 8, 23.4, 29, 45.5, tuile);
    A.boites(Array.from({ length: 9 }, (_, k) => -44 + k * 8).flatMap((x) => [[2, 25, 2.4, x, 0, 32], [2, 25, 2.4, x, 0, 59]]), briqueClaire);
    const oct = (rh, rb, h, y) => A.piece((e) => new THREE.CylinderGeometry(rh + e, rb + e, h + 2 * e, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0), brique, A.V(12, y, 32.3));
    oct(4.4, 4.4, 30, 0); oct(4.1, 4.3, 4.5, 30); oct(3.8, 4, 4.5, 34.5); oct(3.5, 3.7, 4.5, 39); A.pyramide(3.4, 5, 8, 12, 43.5, 32.3, tuile);
    return A.groupe;
  }

  // la cathédrale Saint-Étienne de Cahors : le massif occidental fortifié, la nef et ses deux grandes coupoles, le chœur
  function cathedraleCahors(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D3A8), pierreFoncee = A.matiere(0xC9B07E), tuile = A.matiere(0xB0603F);
    A.boite(12.7, 34, 25, -35.7, 0, -11.3, pierre); A.creneaux([A.tourDe(13.1, 25.4, -35.7, -11.3)], 34, 0.8, pierreFoncee);
    A.boites([[3, 6, 3, -35.7, 34, -20], [3, 6, 3, -35.7, 34, -2.6]], pierre); A.pyramide(2.4, 4, 4, -35.7, 40, -20, tuile); A.pyramide(2.4, 4, 4, -35.7, 40, -2.6, tuile);
    A.boite(42, 17, 26, -8, 0, -11.3, pierre);
    for (const x of [-19, 2]) { A.cylindre(9.5, 9.5, 3, 24, x, 17, -11.3, pierreFoncee); A.dome(9.6, 0.55, x, 20, -11.3, tuile); }
    A.boite(9, 17, 24, 17.5, 0, -11.3, pierre); A.abside(8, 17, 22, 0, -11.3, pierre); A.demiCone(8.5, 5, 22, 17, -11.3, tuile);
    A.abside(10, 10, 21, 0, -11.3, pierreFoncee); A.demiCone(10.5, 3, 21, 10, -11.3, tuile);
    return A.groupe;
  }

  // le phare d'Ar-Men : la tour blanche sur son rocher en pleine mer, la lanterne
  function pharArMen(THREE) {
    const A = atelier(THREE);
    const roche = A.matiere(0x5E5650), blanc = A.matiere(0xF4F4F0), noir = A.matiere(0x2E2E36), lumiere = A.matiere(0xFFE27A, 0x8A6A00);
    A.piece((e) => new THREE.CylinderGeometry(6.5 + e, 8 + e, 3 + 2 * e, 9).translate(0, 1.5, 0), roche, A.V(0, 0, 0));
    A.cylindre(3.2, 4.3, 30, 16, 0, 3, 0, blanc); A.cylindre(4, 4, 0.8, 16, 0, 33, 0, noir);
    A.cylindre(2.3, 2.3, 3.4, 12, 0, 33.8, 0, lumiere); A.dome(2.5, 0.8, 0, 37.2, 0, noir);
    return A.groupe;
  }

  // le château de Vitré : l'enceinte triangulaire, ses tours rondes et leurs toits pointus, le logis
  function vitre(THREE) {
    const A = atelier(THREE);
    const schiste = A.matiere(0xBFB3A0), schisteOmbre = A.matiere(0xA0937E), ardoise = A.matiere(0x4F5D8C);
    const coins = [[-38, -34], [37, -44], [36, -5], [33, 6], [11, 36], [-11, 12], [-38, -34]];
    A.remparts([coins], 12, 4, schisteOmbre); A.creneaux([coins], 12, 0.9, schiste);
    A.boite(45, 18, 14, -16, 0, -32, schiste); A.toit(14.6, 9, 45, -16, 18, -32, ardoise);
    const tours = [[-38, -34, 5.5, 22], [37, -44, 6, 24], [36, -5, 4.5, 18], [33, 6, 4, 18], [11, 36, 7, 22], [-11, 12, 4.5, 18]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), schiste, 16); A.cones(tours.map(([x, z, r, h]) => [x, z, r + 0.4, h, r * 1.8]), ardoise, 16);
    return A.groupe;
  }

  // la basilique Sainte-Thérèse de Lisieux : la nef, le transept, le grand dôme de la croisée et sa lanterne, le portique
  function basiliqueLisieux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0EADA), pierreFoncee = A.matiere(0xD8CDB2), plomb = A.matiere(0x7E8AA8), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(80, 30, 30, 7, 0, 0, pierre); A.toit(30.6, 6, 80, 7, 30, 0, plomb); A.abside(15, 30, 47, 0, 0, pierre); A.demiCone(15.5, 6, 47, 30, 0, plomb);
    A.boite(29.5, 30, 63, 3.85, 0, 1.2, pierre); A.toit(30, 6, 63, 3.85, 30, 1.2, plomb, Math.PI / 2);
    A.cylindre(14, 14, 22, 24, 3.85, 30, 0, pierre); A.cylindre(14.8, 14.8, 1.4, 24, 3.85, 51, 0, pierreFoncee); A.dome(14.4, 1.3, 3.85, 52.4, 0, plomb);
    A.cylindre(2.4, 2.4, 6, 12, 3.85, 70.8, 0, pierre); A.dome(2.7, 1.4, 3.85, 76.8, 0, plomb); A.boule(0.8, 3.85, 81, 0, or);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { A.cylindre(3, 3, 6, 12, 3.85 + dx * 17, 30, dz * 17, pierre); A.dome(3.2, 1.2, 3.85 + dx * 17, 36, dz * 17, plomb); }
    A.boite(20, 38, 22, -43.5, 0, 0, pierre); A.toit(22.6, 6, 20, -43.5, 38, 0, plomb, Math.PI / 2); A.extrusion(A.formeArche(10, 22), 0.8, -53.7, 0, 0, pierreFoncee, Math.PI / 2);
    return A.groupe;
  }

  // le palais de la Légion d'honneur (l'hôtel de Salm) : le corps de logis et sa rotonde sur la Seine, la cour d'honneur et
  // ses colonnades, l'arc de triomphe de l'entrée sur la rue de Lille
  function palaisLegionHonneur(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), plomb = A.matiere(0x6E7AA0), porte = A.matiere(0x6E5A44);
    A.boite(40, 13, 22, 0, 0, -41, pierre); A.boite(41, 1.4, 23, 0, 13, -41, pierreFoncee);
    A.cylindre(6.5, 6.5, 13, 20, 0, 0, -52, pierre); A.dome(6.7, 0.6, 0, 13, -52, plomb);
    A.boites([[8, 8, 52, -35, 0, -4], [8, 8, 52, 27.5, 0, -4], [64, 9, 6, -4, 0, 24]], pierreFoncee);
    A.boite(12, 14, 7, 0, 0, 24, pierre); A.extrusion(A.formeArche(6, 10), 0.8, 0, 0, 27.7, porte);
    return A.groupe;
  }

  // le Grand-Théâtre de Bordeaux : le portique aux douze colonnes corinthiennes et ses douze statues, le grand bâtiment
  function grandTheatreBordeaux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), plomb = A.matiere(0x6E7AA0);
    A.boite(70, 20, 47, 2, 0, -9, pierre); A.boite(71, 1.4, 48, 2, 20, -9, pierreFoncee); A.combles(60, 5, 38, 2, 21.4, -9, plomb);
    A.boite(8, 1.2, 50, -38, 0, -9, pierreFoncee);
    const zs = Array.from({ length: 12 }, (_, k) => -30 + k * 3.8);
    A.cylindres(zs.map((z) => [-41, z, 1, 18, 1.2]), pierre, 12); A.boite(8, 2.4, 48, -39, 19.2, -9, pierreFoncee);
    A.cylindres(zs.map((z) => [-41.5, z, 0.55, 3, 21.6]), pierre, 8);
    return A.groupe;
  }

  // la cathédrale orthodoxe Saint-Nicolas de Nice : ses cinq bulbes verts et dorés, ses murs de brique et de pierre, le clocher
  function cathedraleRusseNice(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCCB), brique = A.matiere(0xCB7E62), vert = A.matiere(0x3FA87A), or = A.matiere(0xFFC233, 0x7A4A00);
    const cx = -4, cz = 5.5;
    A.boite(28, 12, 24, cx, 0, cz, pierre); A.boite(28.6, 1, 24.6, cx, 12, cz, brique);
    const bulbe = (x, z, r, y, m) => { A.piece((e) => new THREE.SphereGeometry(r + e, 16, 12).scale(1, 1.25, 1), m, A.V(x, y + r * 1.1, z)); A.pyramide(r * 0.35, r * 1.4, 8, x, y + r * 2.2, z, or); };
    A.cylindre(4.2, 4.2, 10, 16, cx, 13, cz, brique); bulbe(cx, cz, 4.6, 22, or);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { A.cylindre(2.2, 2.2, 6, 12, cx + dx * 8, 13, cz + dz * 7, brique); bulbe(cx + dx * 8, cz + dz * 7, 2.6, 18.5, vert); }
    A.boite(6, 18, 6, cx - 17, 0, cz, pierre); A.cylindre(2, 2, 4, 10, cx - 17, 18, cz, brique); bulbe(cx - 17, cz, 2.4, 21.5, vert);
    return A.groupe;
  }

  // le palais Rohan de Strasbourg : le corps de logis sur l'Ill, les ailes autour de la cour d'honneur, le portail sur la place
  function palaisRohan(THREE) {
    const A = atelier(THREE);
    const gres = A.matiere(0xE3B9A0), gresFonce = A.matiere(0xC99C82), ardoise = A.matiere(0x56659A), porte = A.matiere(0x6E5A44);
    A.boite(75, 16, 16, 19.5, 0, 36, gres); A.combles(75.6, 8, 16.6, 19.5, 16, 36, ardoise);
    A.boite(14, 13, 60, -13, 0, 4, gres); A.toit(14.6, 6, 60, -13, 13, 4, ardoise, Math.PI / 2);
    A.boite(14, 13, 60, 52, 0, 4, gres); A.toit(14.6, 6, 60, 52, 13, 4, ardoise, Math.PI / 2);
    A.boite(66, 7, 4, 19.5, 0, -29, gresFonce); A.boite(14, 14, 6, 19.5, 0, -29, gres); A.toit(14.6, 3.5, 6.4, 19.5, 14, -29, gres, Math.PI / 2);
    A.extrusion(A.formeArche(6, 10), 0.8, 19.5, 0, -32.2, porte);
    return A.groupe;
  }

  // l'hôtel de ville de Lyon : la façade sur la place des Terreaux et son beffroi à dôme, les ailes autour des deux cours
  function hotelDeVilleLyon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE3CB), pierreFoncee = A.matiere(0xD3C3A0), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(33, 22, 47, -39.5, 0, 20.5, pierre); A.combles(33.6, 7, 47.6, -39.5, 22, 20.5, ardoise);
    A.boite(82, 20, 11, 18, 0, 2.5, pierre); A.toit(11.6, 6, 82, 18, 20, 2.5, ardoise);
    A.boite(82, 20, 11, 18, 0, 35.5, pierre); A.toit(11.6, 6, 82, 18, 20, 35.5, ardoise);
    A.boite(6, 18, 22, 22.5, 0, 19, pierre); A.boite(8, 17, 24, 52, 0, 19, pierre); A.toit(8.6, 5, 24, 52, 17, 19, ardoise, Math.PI / 2);
    A.boite(12, 30, 12, -50, 0, 20.5, pierre); A.boite(12.8, 1.2, 12.8, -50, 30, 20.5, pierreFoncee);
    A.cylindre(4.5, 4.5, 7, 16, -50, 31.2, 20.5, pierre); A.dome(4.8, 1.3, -50, 38.2, 20.5, ardoise); A.cylindre(1.2, 1.2, 3, 8, -50, 44.2, 20.5, pierre); A.boule(0.7, -50, 48, 20.5, or);
    return A.groupe;
  }

  // l'église Saint-Nicolas-des-Champs : la façade flamboyante, le clocher au sud, la nef et ses doubles bas-côtés
  const saintNicolasDesChamps = (THREE) => cathedrale(THREE, { F: -34, E: 41, larg: 16, mur: 22, toitH: 8, xT: 4, cote: 8, facadeH: 24, rose: 3, arcs: false,
    tours: [{ z: 12, h: 32, fleche: 6, r: 4.4, seg: 4 }] });

  // le couvent de La Tourette (Le Corbusier) : l'église, grande boîte de béton, et le couvent en U posé sur ses pilotis
  function laTourette(THREE) {
    const A = atelier(THREE);
    const beton = A.matiere(0xB5AFA4), betonFonce = A.matiere(0x8E887E);
    A.boite(43, 18, 12, -5.5, 0, -29, beton); A.boite(4, 5, 1, 10, 18, -29, betonFonce);
    const ailes = [[9, 48, -21.5, 8], [9, 48, 15.5, 8]];
    for (const [lx, lz, x, z] of ailes) A.boite(lx, 10, lz, x, 6, z, beton);
    A.boite(46, 10, 10, -3, 6, 27, beton); A.boites([[46.4, 0.8, 10.4, -3, 16, 27], [9.4, 0.8, 48.4, -21.5, 16, 8], [9.4, 0.8, 48.4, 15.5, 8 + 8, 8]], betonFonce);
    A.boites([-20, -8, 4, 16, 28].flatMap((z) => [[0.7, 6, 0.7, -24, 0, z], [0.7, 6, 0.7, -19, 0, z], [0.7, 6, 0.7, 13, 0, z], [0.7, 6, 0.7, 18, 0, z]]), betonFonce);
    return A.groupe;
  }

  // la cathédrale Notre-Dame-et-Saint-Vaast d'Arras : l'église classique toute blanche, son portique, sa nef, son transept,
  // son chevet
  function cathedraleArras(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), pierreOmbre = A.matiere(0xDCD6C8), ardoise = A.matiere(0x56659A);
    A.boite(70, 14, 32, 5, 0, 3.8, pierreOmbre); A.toit(32.6, 4, 70, 5, 14, 3.8, ardoise);
    A.boite(70, 26, 16, 5, 0, 3.8, pierre); A.toit(16.6, 7, 70, 5, 26, 3.8, ardoise);
    A.boite(32.6, 26, 63, 14, 0, 5.5, pierre); A.toit(33, 8, 63, 14, 26, 5.5, ardoise, Math.PI / 2);
    A.abside(8, 26, 40, 0, 3.8, pierre); A.demiCone(8.5, 7, 40, 26, 3.8, ardoise); A.abside(16, 14, 46, 0, 3.8, pierreOmbre); A.demiCone(16.5, 4, 46, 14, 3.8, ardoise);
    A.boite(6, 1.4, 34, -33, 0, 3.8, pierreOmbre); A.cylindres([-8, -4.8, -1.6, 1.6, 4.8, 8].map((d) => [-35, 3.8 + d, 1.1, 16, 1.4]), pierre, 12);
    A.boite(6, 2, 20, -34, 17.4, 3.8, pierreOmbre); A.toit(20, 5, 6, -34, 19.4, 3.8, pierre);
    return A.groupe;
  }

  // la cathédrale Notre-Dame d'Évreux : la façade Renaissance et ses deux tours, la flèche ajourée de la croisée (la « flèche
  // d'argent »), la nef, le transept
  const cathedraleEvreux = (THREE) => cathedrale(THREE, { F: -36, E: 53, larg: 14, mur: 22, toitH: 8, xT: 4, transept: 44, transeptL: 13, cote: 8, facadeH: 25, rose: 4,
    tours: [{ z: -8, h: 30, octogone: { h: 8, r: 3.5 } }, { z: 8, h: 30 }], flecheCroisee: { tour: 10, cote: 10, h: 32, r: 4, seg: 8 } });

  // la cathédrale Saint-Jean-Baptiste de Perpignan : la grande nef unique de brique et de galets, le clocher et sa cage de
  // fer forgé pour la cloche
  function cathedralePerpignan(THREE) {
    const A = atelier(THREE);
    const mur = A.matiere(0xC9A27E), murClair = A.matiere(0xDCC09A), tuile = A.matiere(0xB0603F), fer = A.matiere(0x2E2E36);
    A.boite(80, 22, 32, 10, 0, 7, mur); A.toit(32.6, 6, 80, 10, 22, 7, tuile);
    A.boite(3, 24, 32, -31, 0, 7, murClair); A.boites([0, 4, 8].map((k) => [3.4, 0.6, 32.4, -31, 6 + k * 2, 7]), mur);
    A.boite(10, 33, 11, 13.3, 0, -16, mur);
    const t = [13.3, -16]; for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.poutre(A.V(t[0] + dx * 3.6, 33, t[1] + dz * 3.6), A.V(t[0], 41, t[1]), 0.5, 0.4, fer);
    A.boule(1.4, t[0], 36.5, t[1], fer);
    return A.groupe;
  }

  // la cathédrale Notre-Dame-de-l'Annonciation de Moulins : la façade et ses deux hautes flèches, la nef, le chevet plat
  const cathedraleMoulins = (THREE) => cathedrale(THREE, { F: -27, E: 45, chevetPlat: true, larg: 14, mur: 22, toitH: 9, xT: 8, cote: 9, facadeH: 28, rose: 4,
    tours: [{ z: -9, h: 45, fleche: 40, r: 4.2, seg: 8 }, { z: 9, h: 45, fleche: 40, r: 4.2, seg: 8 }] });

  // la cathédrale Saint-Mammès de Langres : la façade classique et ses deux tours carrées, la nef, le transept, le chevet
  const cathedraleLangres = (THREE) => cathedrale(THREE, { F: -52, E: 28, larg: 16, mur: 24, toitH: 8, xT: 4, transept: 52, transeptL: 18, cote: 9, facadeH: 30, rose: 2, arcs: false,
    tours: [{ z: -10, h: 40 }, { z: 10, h: 40 }] });

  // la basilique de Saint-Quentin : la tour-porche, la très haute nef, ses deux transepts, le chevet et ses chapelles
  function basiliqueSaintQuentin(THREE) {
    const g = cathedrale(THREE, { F: -48, E: 58, larg: 16, mur: 34, toitH: 12, xT: 6, transept: 50, transeptL: 14, cote: 12, facadeH: 40, rose: 5,
      tours: [{ z: 0, x: -46, h: 44, cote: 14 }], flecheCroisee: { tour: 4, cote: 9, h: 14, r: 4, seg: 8 } });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E), ardoise = A.matiere(0x5E70A3), ardoiseFoncee = A.matiere(0x46567F);
    A.boite(14, 34, 46, 32, 0, 0, pierre); A.toit(14.6, 12, 46, 32, 34, 0, ardoise, Math.PI / 2);
    A.abside(20, 18, 50, 0, 0, pierreFoncee); A.demiCone(20.5, 5, 50, 18, 0, ardoiseFoncee);
    g.add(A.groupe); return g;
  }

  // la cathédrale Notre-Dame-de-l'Annonciation de Nancy : la façade classique et ses deux tours à lanternes, la coupole de la
  // croisée, la nef
  function cathedraleNancy(THREE) {
    const g = cathedrale(THREE, { F: -33, E: 24.8, larg: 26, mur: 27, toitH: 9, xT: 8, transept: 48, transeptL: 14, cote: 10, facadeH: 36, rose: 2, arcs: false,
      tours: [{ z: -15, h: 50, octogone: { h: 12, r: 4.4 } }, { z: 15, h: 50, octogone: { h: 12, r: 4.4 } }] });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4), ardoise = A.matiere(0x46567F), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(8, 8, 6, 16, 8, 33, 0, pierre); A.dome(8.4, 1, 8, 39, 0, ardoise); A.cylindre(1.4, 1.4, 3, 8, 8, 47.2, 0, pierre); A.boule(0.7, 8, 51, 0, or);
    for (const s of [1, -1]) A.dome(4.4, 1.3, -33, 62, s * 15, ardoise);
    g.add(A.groupe); return g;
  }

  // la cathédrale Saint-Pierre de Lisieux : la façade et ses deux tours (la flèche au nord), la nef, le transept et sa
  // tour-lanterne, le chevet
  const cathedraleLisieux = (THREE) => cathedrale(THREE, { F: -44, E: 54, larg: 12, mur: 20, toitH: 8, xT: 9.35, transept: 43, transeptL: 18.7, cote: 9, facadeH: 26, rose: 3,
    tours: [{ z: -8.7, h: 34, fleche: 22, r: 4, seg: 8 }, { z: 8.7, h: 34 }], flecheCroisee: { tour: 8, cote: 11, h: 6, r: 5.5, seg: 4 } });

  // la cathédrale Notre-Dame-de-l'Assomption de Montauban : l'église classique blanche, ses deux tours carrées, son chevet plat
  const cathedraleMontauban = (THREE) => cathedrale(THREE, { pierre: 0xF2EEE4, pierreFoncee: 0xDCD6C8, F: -30, E: 46.7, chevetPlat: true, larg: 16, mur: 26, toitH: 8, xT: 7,
    transept: 40, transeptL: 15.4, cote: 9, facadeH: 30, rose: 2, arcs: false, tours: [{ z: -12, h: 36 }, { z: 12, h: 36 }] });

  // la cathédrale Saint-Caprais d'Agen : le chœur roman et ses absidioles, la nef, le clocher de la façade
  function cathedraleAgen(THREE) {
    const g = cathedrale(THREE, { pierre: 0xEAD9B4, pierreFoncee: 0xCDB58A, toit: 0xB0603F, toitFonce: 0x9A4F34, F: -20, E: 32, larg: 12, mur: 18, toitH: 6, xT: 14, transept: 34,
      transeptL: 14, cote: 8, facadeH: 22, rose: 3, arcs: false, tours: [{ z: 0, h: 30, fleche: 8, r: 4, seg: 4 }] });
    const A = atelier(THREE), pierre = A.matiere(0xEAD9B4), tuile = A.matiere(0xB0603F);
    for (const z of [-11, 11]) { A.abside(4, 12, 21, 0, z, pierre); A.demiCone(4.4, 3, 21, 12, z, tuile); }
    g.add(A.groupe); return g;
  }

  // la cathédrale Notre-Dame-de-Grâce de Cambrai : l'église classique, son transept, son chevet, sa haute tour au nord
  const cathedraleCambrai = (THREE) => cathedrale(THREE, { F: -36, E: 34.7, larg: 16, mur: 24, toitH: 8, xT: -5, transept: 44, transeptL: 14, cote: 9, facadeH: 26, rose: 2, arcs: false,
    tours: [{ z: -14, x: -7, h: 44, cote: 12, octogone: { h: 8, r: 4 } }] });

  // la cathédrale Saint-Étienne de Saint-Brieuc : la cathédrale-forteresse, ses deux tours massives de la façade
  const cathedraleSaintBrieuc = (THREE) => cathedrale(THREE, { pierre: 0xD9D2C2, pierreFoncee: 0xBDB4A2, F: -6, E: 55, larg: 14, mur: 16, toitH: 7, xT: 25, transept: 46,
    transeptL: 14, cote: 10, facadeH: 22, rose: 3, arcs: false, tours: [{ z: -9, h: 23 }, { z: 9, h: 23 }] });

  // la cathédrale Notre-Dame de Sées : la façade et ses deux flèches (70 m), la nef, le transept, le chœur lumineux
  const cathedraleSees = (THREE) => cathedrale(THREE, { F: -29, E: 52, larg: 14, mur: 24, toitH: 9, xT: 32, transept: 44, transeptL: 16, cote: 9, facadeH: 30, rose: 4,
    tours: [{ z: -9, h: 39, fleche: 31, r: 4.2, seg: 8 }, { z: 9, h: 39, fleche: 31, r: 4.2, seg: 8 }] });

  // la cathédrale Saint-Vincent de Saint-Malo : le granit, la nef, le transept, la haute flèche de la croisée
  const cathedraleSaintMalo = (THREE) => cathedrale(THREE, { pierre: 0xD9D2C2, pierreFoncee: 0xBDB4A2, F: -25, E: 32, larg: 12, mur: 17, toitH: 7, xT: 5, transept: 36,
    transeptL: 10, cote: 8, facadeH: 22, rose: 3, arcs: false, tours: [{ z: 0, h: 22, cote: 8 }], flecheCroisee: { tour: 18, cote: 9, h: 30, r: 3.4, seg: 8 } });

  // la cathédrale Saint-Étienne d'Agde : la forteresse de basalte noir, ses créneaux, son donjon-clocher
  function cathedraleAgde(THREE) {
    const A = atelier(THREE);
    const basalte = A.matiere(0x5A5552), basalteClair = A.matiere(0x77716C);
    A.boite(40, 18, 30, 8, 0, -16, basalte); A.creneaux([A.tourDe(40.4, 30.4, 8, -16)], 18, 1, basalteClair);
    A.boite(10, 35, 10, -10, 0, -28, basalte); A.creneaux([A.tourDe(10.4, 10.4, -10, -28)], 35, 1, basalteClair);
    return A.groupe;
  }

  // l'abbatiale Saint-Philibert de Tournus : le narthex et ses deux tours, la nef romane, le clocher de la croisée, le chevet
  // et ses chapelles
  function tournus(THREE) {
    const g = cathedrale(THREE, { pierre: 0xE6CFB0, pierreFoncee: 0xCDB28E, toit: 0xB0603F, toitFonce: 0x9A4F34, F: -31, E: 37, larg: 12, mur: 18, toitH: 6, xT: 4, transept: 32,
      transeptL: 14, cote: 9, facadeH: 20, rose: 2, arcs: false, tours: [{ z: -6, h: 30, fleche: 12, r: 4.4, seg: 4 }, { z: 6, h: 22 }], flecheCroisee: { tour: 14, cote: 9, h: 9, r: 5.5, seg: 4 } });
    const A = atelier(THREE); A.abside(13, 9, 30, 0, 0, A.matiere(0xCDB28E)); A.demiCone(13.5, 3, 30, 9, 0, A.matiere(0x9A4F34));
    g.add(A.groupe); return g;
  }

  // l'église Saint-Pierre de Caen : son clocher et sa flèche (75 m), la nef, le chevet Renaissance
  function saintPierreCaen(THREE) {
    const g = cathedrale(THREE, { pierre: 0xEFE6CF, F: -26, E: 23.5, larg: 12, mur: 18, toitH: 7, xT: 0, cote: 9, facadeH: 22, rose: 3,
      tours: [{ z: 10, h: 40, fleche: 35, r: 4, seg: 8 }] });
    const A = atelier(THREE); A.abside(13, 12, 16.5, 0, 0, A.matiere(0xD2BC8E)); A.demiCone(13.5, 4, 16.5, 12, 0, A.matiere(0x46567F));
    g.add(A.groupe); return g;
  }

  // un cercle de points (pour les créneaux des tours rondes)
  const anneau = (x, z, r, n = 14) => Array.from({ length: n + 1 }, (_, k) => [x + Math.cos(k * 2 * Math.PI / n) * r, z + Math.sin(k * 2 * Math.PI / n) * r]);

  // le musée d'Orsay (l'ancienne gare) : la grande verrière en berceau, les pavillons d'angle et leurs combles, les deux
  // horloges sur la Seine, les grandes baies
  function orsay(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), verre = A.matiere(0xA9C4D6, 0x2A4A60),
      or = A.matiere(0xFFC233, 0x7A4A00), baie = A.matiere(0x6E7A86);
    A.boite(173, 20, 79, 0, 0, 0, pierre); A.boite(174, 1.4, 80, 0, 20, 0, pierreFoncee);
    A.piece((e) => new THREE.CylinderGeometry(19 + e, 19 + e, 138 + 2 * e, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.75, 1), verre, A.V(0, 21.4, -8));
    for (const s of [1, -1]) { A.boite(17, 32, 79, s * 78, 0, 0, pierre); A.combles(17.6, 10, 79.6, s * 78, 32, 0, ardoise); A.piece((e) => new THREE.CylinderGeometry(3.6 + e, 3.6 + e, 0.8 + 2 * e, 28).rotateX(Math.PI / 2), or, A.V(s * 78, 25, -39.8)); }
    for (let k = 0; k < 7; k++) A.extrusion(A.formeArche(12, 16), 0.6, -54 + k * 18, 2, -39.8, baie, 0, true);
    return A.groupe;
  }

  // le mémorial de Thiepval : l'arc monumental de brique et de pierre, ses arches imbriquées en gradins
  function memorialThiepval(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xB5523B), pierre = A.matiere(0xEDE8DA);
    A.boite(44, 1.2, 44, 0, 0, 0, pierre);
    A.boites([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [12, 20, 12, a * 13, 1.2, b * 13]), brique); A.boites([[40, 6, 40, 0, 21.2, 0]], brique);
    A.boites([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [8, 8, 8, a * 9, 27.2, b * 9]), brique); A.boite(26, 5, 26, 0, 35.2, 0, brique);
    A.boite(14, 7, 14, 0, 40.2, 0, brique); A.boite(15, 1, 15, 0, 47.2, 0, pierre);
    A.boites([[42, 1, 42, 0, 21.2, 0], [27, 1, 27, 0, 35.2, 0]], pierre);
    return A.groupe;
  }

  // le Gros-Horloge de Rouen : le beffroi gothique et son couronnement, le pavillon Renaissance sur l'arche au-dessus de la
  // rue et son grand cadran doré
  function grosHorloge(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE3CB), pierreFoncee = A.matiere(0xD3C3A0), ardoise = A.matiere(0x4F5D8C), plomb = A.matiere(0x6E7AA0), or = A.matiere(0xFFC233, 0x7A4A00), bleu = A.matiere(0x2D4FA3);
    A.boite(9.4, 30, 8.2, 4.7, 0, 11.9, pierre); A.boite(10.2, 1.2, 9, 4.7, 30, 11.9, pierreFoncee);
    A.cylindre(3, 3, 3.5, 8, 4.7, 31.2, 11.9, pierre); A.dome(3.2, 1.2, 4.7, 34.7, 11.9, plomb);
    A.boites([[7, 5, 1.6, 4.7, 0, -0.8], [7, 5, 1.6, 4.7, 0, 7.4]], pierre); A.boite(7.4, 9, 9.8, 4.7, 5, 3.3, pierre); A.toit(7.8, 4, 10.2, 4.7, 14, 3.3, ardoise, Math.PI / 2);
    for (const s of [1, -1]) { A.piece((e) => new THREE.CylinderGeometry(2.6 + e, 2.6 + e, 0.5 + 2 * e, 28).rotateZ(Math.PI / 2), or, A.V(4.7 + s * 3.8, 10, 3.3)); A.piece((e) => new THREE.CylinderGeometry(1.8 + e, 1.8 + e, 0.6 + 2 * e, 24).rotateZ(Math.PI / 2), bleu, A.V(4.7 + s * 3.85, 10, 3.3), null, true); }
    return A.groupe;
  }

  // la porte des Allemands de Metz : le château-pont sur la Seille, ses deux galeries, ses tours rondes et leurs toits
  // pointus, le bastion et ses grosses tours crénelées
  function porteDesAllemands(THREE) {
    const A = atelier(THREE);
    const jaumont = A.matiere(0xE8C77E), jaumontOmbre = A.matiere(0xC9A766), ardoise = A.matiere(0x4F5D8C);
    A.boite(35, 9, 4, -2.5, 0, -7, jaumont, -0.114); A.toit(4.6, 3, 35, -2.5, 9, -7, ardoise, -0.114);
    A.boite(30, 9, 4, -2.5, 0, 4, jaumont, -0.204); A.toit(4.6, 3, 30, -2.5, 9, 4, ardoise, -0.204);
    A.cylindres([[-19, -12, 4, 14, 0], [-24, 2, 4, 14, 0]], jaumont, 16); A.cones([[-19, -12, 4.4, 14, 7], [-24, 2, 4.4, 14, 7]], ardoise, 16);
    A.cylindres([[14.4, -6, 6, 16, 0], [9.4, 8.3, 6.5, 18, 0], [18.3, 1.7, 4.5, 14, 0]], jaumont, 18);
    A.creneaux([anneau(14.4, -6, 6.2)], 16, 0.7, jaumontOmbre); A.creneaux([anneau(9.4, 8.3, 6.7)], 18, 0.7, jaumontOmbre); A.creneaux([anneau(18.3, 1.7, 4.7)], 14, 0.7, jaumontOmbre);
    return A.groupe;
  }

  // le château de Tarascon : la forteresse aux murs lisses de 48 m, ses tours rondes côté ville, ses créneaux, la basse-cour
  function tarascon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE8DCC0), pierreOmbre = A.matiere(0xCDBE9C);
    A.boite(42, 36, 38, 0, 0, 27, pierre); A.creneaux([A.tourDe(42.4, 38.4, 0, 27)], 36, 1, pierreOmbre);
    A.cylindres([[18, 8, 6.5, 38, 0], [20, 34, 6.5, 38, 0]], pierre, 18); A.creneaux([anneau(18, 8, 6.7), anneau(20, 34, 6.7)], 38, 0.8, pierreOmbre);
    A.boite(8, 38, 11, -20, 0, 10, pierre); A.creneaux([A.tourDe(8.4, 11.4, -20, 10)], 38, 0.8, pierreOmbre);
    const bc = [[-17, 4], [-17, -50], [0, -54], [8, -52], [16, -25], [18, -5]];
    A.remparts([bc], 12, 2.5, pierreOmbre); A.creneaux([bc], 12, 0.7, pierre);
    A.boite(12, 20, 40, -8, 0, -29, pierre);
    return A.groupe;
  }

  // la forteresse de Salses : la forteresse basse et massive, ses ailes autour de la cour, ses gros bastions ronds
  function salses(THREE) {
    const A = atelier(THREE);
    const mur = A.matiere(0xD9A57A), murOmbre = A.matiere(0xBF8B62);
    A.boites([[118, 18, 21, -11, 0, -31.5], [118, 18, 21, -11, 0, 38.5], [38, 18, 49, -51, 0, 3.5], [22, 22, 49, 37, 0, 3.5]], mur);
    const coins = [[-70, -41], [44, -41], [-70, 48], [47, 48]];
    A.cylindres(coins.map(([x, z]) => [x, z, 11, 18, 0]), mur, 20); A.creneaux(coins.map(([x, z]) => anneau(x, z, 11.2, 18)), 18, 0.9, murOmbre);
    A.creneaux([A.tourDe(118.4, 91.4, -11, 3.5)], 18, 0.9, murOmbre);
    return A.groupe;
  }

  // le château de Josselin : la façade sur l'Oust et ses trois grosses tours rondes coiffées d'ardoise, le logis Renaissance
  function josselin(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xCFC6B0), ardoise = A.matiere(0x4F5D8C);
    A.boite(88, 22, 13, 19, 0, 7, granit); A.toit(13.6, 10, 88, 19, 22, 7, ardoise);
    A.boites(Array.from({ length: 7 }, (_, k) => [3, 4, 2.4, -14 + k * 11, 21, 1.4]), granit); A.cones(Array.from({ length: 7 }, (_, k) => [-14 + k * 11, 1.4, 1.9, 25, 3]), ardoise, 4);
    const tours = [[-23, 9, 5], [14.6, 15, 5], [55, 13.5, 5.5], [11, -50, 5.5]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, x === 11 ? 24 : 26, 0]), granit, 18); A.cones(tours.map(([x, z, r]) => [x, z, r + 0.5, x === 11 ? 24 : 26, r * 2.2]), ardoise, 18);
    return A.groupe;
  }

  // le château de Hautefort : le grand logis en U, ses combles d'ardoise, ses tours rondes coiffées de dômes et de lanternons
  function hautefort(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEDE4CF), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(78, 18, 18, 2, 0, -26, pierre); A.combles(78.6, 9, 18.6, 2, 18, -26, ardoise);
    A.boite(9, 16, 30, -26.5, 0, -2, pierre); A.toit(9.6, 6, 30, -26.5, 16, -2, ardoise, Math.PI / 2);
    A.boite(11, 16, 30, 32.5, 0, -2, pierre); A.toit(11.6, 6, 30, 32.5, 16, -2, ardoise, Math.PI / 2);
    for (const [x, z] of [[-29, 16], [35, 15]]) { A.cylindre(6.5, 6.5, 18, 20, x, 0, z, pierre); A.dome(6.8, 1.3, x, 18, z, ardoise); A.cylindre(1.2, 1.2, 3, 8, x, 26.6, z, pierre); A.boule(0.6, x, 30, z, or); }
    for (const x of [-37, 41]) { A.boite(10, 20, 10, x, 0, -26, pierre); A.domeCarre(10.6, 7, 10.6, x, 20, -26, ardoise); }
    return A.groupe;
  }

  // le château d'Annecy : le logis aux hauts toits, la tour de la Reine (le donjon carré), le logis Nemours
  function chateauAnnecy(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xD6CDB8), ardoise = A.matiere(0x4F5D8C);
    A.boite(92, 22, 18, -5, 0, -26, pierre); A.toit(18.6, 10, 92, -5, 22, -26, ardoise);
    A.boite(8, 16, 18, -47.5, 0, -1, pierre);
    A.boite(17, 33, 18, -45.5, 0, 16, pierre); A.combles(17.6, 8, 18.6, -45.5, 33, 16, ardoise);
    A.boite(24, 26, 26, 48, 0, -1, pierre); A.combles(24.6, 10, 26.6, 48, 26, -1, ardoise);
    return A.groupe;
  }

  // le fort la Latte : le donjon rond et sa tourelle, l'enceinte sur l'éperon au-dessus de la mer, la tour d'entrée
  function fortLaLatte(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xB9A99A), granitOmbre = A.matiere(0x9C8C7E), ardoise = A.matiere(0x4F5D8C);
    A.cylindre(6.5, 7, 22, 20, -18.7, 0, -24, granit); A.creneaux([anneau(-18.7, -24, 6.7)], 22, 0.8, granitOmbre); A.cylindre(2, 2, 6, 12, -15, 22, -22, granit); A.cones([[-15, -22, 2.3, 28, 4]], ardoise, 12);
    const enc = [[-18.7, -24], [-30, 0], [-10, 20], [6.7, 18], [20, 0], [8, -20], [-18.7, -24]];
    A.remparts([enc], 9, 2.5, granitOmbre); A.creneaux([enc], 9, 0.7, granit);
    A.cylindres([[6.7, 18, 3.5, 14, 0], [-10, 20, 3.5, 12, 0]], granit, 14); A.cones([[6.7, 18, 3.9, 14, 6], [-10, 20, 3.9, 12, 6]], ardoise, 14);
    return A.groupe;
  }

  // la cathédrale Saint-Louis de La Rochelle : la façade classique à colonnes, la nef, la coupole de la croisée, l'abside
  function cathedraleLaRochelle(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), pierreOmbre = A.matiere(0xDCD6C8), ardoise = A.matiere(0x56659A), plomb = A.matiere(0x6E7AA0);
    A.boite(70, 13, 44, -5, 0, 0, pierreOmbre); A.toit(44.6, 4, 70, -5, 13, 0, ardoise);
    A.boite(70, 20, 22, -5, 0, 0, pierre); A.toit(22.6, 7, 70, -5, 20, 0, ardoise); A.abside(11, 20, 30, 0, 0, pierre); A.demiCone(11.5, 6, 30, 20, 0, ardoise);
    A.abside(15, 13, 30, 0, 0, pierreOmbre); A.demiCone(15.5, 4, 30, 13, 0, ardoise);
    A.cylindre(8, 8, 6, 16, 18, 24, 0, pierre); A.dome(8.3, 1, 18, 30, 0, plomb);
    A.boite(4, 26, 32, -42, 0, 0, pierre); A.cylindres([-12, -7, -2.5, 2.5, 7, 12].map((z) => [-44.6, z, 0.9, 14, 0]), pierre, 12); A.toit(32, 6, 4, -42, 26, 0, pierre);
    return A.groupe;
  }

  // la cathédrale Saint-Maurice de Vienne : la façade flamboyante et ses deux tours, la longue nef, le chœur
  const cathedraleVienne = (THREE) => cathedrale(THREE, { F: -27, E: 57, larg: 16, mur: 21, toitH: 7, xT: 20, cote: 10, facadeH: 30, rose: 4, arcs: false,
    tours: [{ z: -10, h: 38 }, { z: 10, h: 38 }] });

  // l'église Saint-Paul de Strasbourg : l'église néo-gothique de grès rose et ses deux flèches (76 m), sur la pointe de
  // l'île au bord de l'Ill
  const saintPaulStrasbourg = (THREE) => cathedrale(THREE, { pierre: 0xD9A592, pierreFoncee: 0xC08A78, F: -21, E: 19.7, larg: 12, mur: 20, toitH: 8, xT: 6.5, transept: 48,
    transeptL: 15, cote: 8, facadeH: 26, rose: 3.5, tours: [{ z: -8, h: 40, fleche: 36, r: 3.6, seg: 8, couleur: 0xC08A78 }, { z: 8, h: 40, fleche: 36, r: 3.6, seg: 8, couleur: 0xC08A78 }] });

  // la collégiale Saint-Martin de Colmar : la nef de grès, son toit de tuiles vernissées, la tour et son toit en « chapeau
  // chinois »
  const collegialeColmar = (THREE) => cathedrale(THREE, { pierre: 0xD9A592, pierreFoncee: 0xC08A78, toit: 0xC9902F, toitFonce: 0x3E8A55, F: -46, E: 21, larg: 14, mur: 22, toitH: 10,
    xT: -9, transept: 38, transeptL: 18, cote: 9, facadeH: 26, rose: 3.5, tours: [{ z: 6, h: 40, fleche: 12, r: 6, seg: 4 }] });

  // l'église Notre-Dame de Dijon : la façade plate et ses rangées de gargouilles, le Jacquemart, la tour de la croisée, les
  // toits vernissés
  const notreDameDijon = (THREE) => cathedrale(THREE, { toit: 0xD4A63A, toitFonce: 0x3E8A55, F: -21, E: 32, larg: 12, mur: 20, toitH: 8, xT: 6, transept: 34, transeptL: 12, cote: 6,
    facadeH: 26, rose: 2, tours: [{ z: 9, h: 32, cote: 4, fleche: 6, r: 2.4, seg: 4 }], flecheCroisee: { tour: 10, cote: 9, h: 16, r: 4, seg: 8 } });

  // l'abbaye de la Trinité de Vendôme : la façade flamboyante, la nef, le chœur, et le clocher roman isolé et sa flèche de
  // pierre (80 m)
  function triniteVendome(THREE) {
    const g = cathedrale(THREE, { F: -32, E: 41.7, larg: 14, mur: 22, toitH: 8, xT: 18, transept: 36, transeptL: 14, cote: 8, facadeH: 30, rose: 4, tours: [{ z: 0, h: 30, cote: 8 }] });
    const A = atelier(THREE), pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E);
    A.boite(12, 40, 12, -53.5, 0, 15.6, pierre); A.cylindre(5, 5, 10, 8, -53.5, 40, 15.6, pierre); A.pyramide(5.2, 30, 8, -53.5, 50, 15.6, pierreFoncee);
    g.add(A.groupe); return g;
  }

  // la cathédrale Notre-Dame de Verdun : la cathédrale romane et ses tours, la nef, le transept, le chevet
  const cathedraleVerdun = (THREE) => cathedrale(THREE, { F: -41, E: 43, larg: 16, mur: 22, toitH: 8, xT: 18, transept: 44, transeptL: 16, cote: 9, facadeH: 28, rose: 2, arcs: false,
    tours: [{ z: -11, h: 40, fleche: 10, r: 5, seg: 4 }, { z: 11, h: 40, fleche: 10, r: 5, seg: 4 }] });

  // la basilique de Saint-Nicolas-de-Port : la haute nef flamboyante, ses deux tours (85 m) et leurs dômes
  function saintNicolasDePort(THREE) {
    const g = cathedrale(THREE, { F: -26, E: 44, larg: 14, mur: 30, toitH: 10, xT: 15, transept: 34, transeptL: 14, cote: 12, facadeH: 34, rose: 4,
      tours: [{ z: -10, h: 64, octogone: { h: 8, r: 4.5 } }, { z: 10, h: 64, octogone: { h: 8, r: 4.5 } }] });
    const A = atelier(THREE), ardoise = A.matiere(0x46567F), or = A.matiere(0xFFC233, 0x7A4A00);
    for (const z of [-10, 10]) { A.dome(4.6, 1.3, -26, 72, z, ardoise); A.boule(0.7, -26, 78.6, z, or); }
    g.add(A.groupe); return g;
  }

  // le château de Bonaguil : l'enceinte et ses tours, le donjon en proue de navire, la grosse tour ronde
  function bonaguil(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE3D3B4), ombre = A.matiere(0xC6B38E);
    const enc = [[-29, 12], [-23, -20], [-12, -33], [5, -30], [20, -45], [32, -59], [43, -40], [40, -10], [47, 0], [28, 20], [5, 27], [-20, 22], [-29, 12]];
    A.remparts([enc], 16, 3, ombre); A.creneaux([enc], 16, 0.8, pierre);
    A.boite(18, 32, 12, 12, 0, -20, pierre, -0.5); A.creneaux([A.tourDe(18.4, 12.4, 0, 0).map(([x, z]) => [12 + x * Math.cos(0.5) - z * Math.sin(0.5), -20 + x * Math.sin(0.5) + z * Math.cos(0.5)])], 32, 0.8, ombre);
    const tours = [[-11, -27, 6, 24], [-25, 15, 5, 20], [38, -50, 5, 22], [44, -4, 4.5, 18], [6, 25, 4.5, 18]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), pierre, 16); for (const [x, z, r, h] of tours) A.creneaux([anneau(x, z, r + 0.2)], h, 0.7, ombre);
    return A.groupe;
  }

  // le château de Montreuil-Bellay : les logis et leurs tours rondes coiffées d'ardoise, au-dessus du Thouet
  function montreuilBellay(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C);
    const logis = [[30, 16, -11, -3.5, 0], [33, 14, -11.5, 29, 0], [30, 22, 37, 37, -0.35]];
    for (const [lx, lz, x, z, r] of logis) { A.boite(lx, 18, lz, x, 0, z, tuffeau, r); A.toit(lz + 0.6, 9, lx, x, 18, z, ardoise, r); }
    const tours = [[-24, -12, 4], [2, -12, 4], [-25, 2, 4], [3, 2, 4], [-31, 17, 4.5], [-25, 35, 4], [2, 36, 4], [22, 40, 4.5], [50, 28, 4]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 20, 0]), tuffeau, 16); A.cones(tours.map(([x, z, r]) => [x, z, r + 0.4, 20, r * 2.2]), ardoise, 16);
    return A.groupe;
  }

  // le château de Maintenon : les ailes de brique et de pierre autour de la cour, le donjon carré, les tours rondes et leurs
  // toits pointus
  function maintenon(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xB5523B), pierre = A.matiere(0xEDE4CF), ardoise = A.matiere(0x4F5D8C);
    A.boite(40, 14, 11, 3, 0, -29, brique); A.toit(11.6, 7, 40, 3, 14, -29, ardoise);
    A.boite(13, 14, 34, -14.5, 0, -16, brique); A.toit(13.6, 7, 34, -14.5, 14, -16, ardoise, Math.PI / 2);
    A.boite(9, 14, 40, 18.5, 0, -12, brique); A.toit(9.6, 6, 40, 18.5, 14, -12, ardoise, Math.PI / 2);
    A.boite(13, 24, 11, -14.5, 0, 6.5, pierre); A.combles(13.6, 7, 11.6, -14.5, 24, 6.5, ardoise);
    const tours = [[-14, -34, 4], [18.7, -35, 4.5], [19.4, 7, 4]];
    A.cylindres(tours.map(([x, z, r]) => [x, z, r, 18, 0]), pierre, 16); A.cones(tours.map(([x, z, r]) => [x, z, r + 0.4, 18, r * 2.4]), ardoise, 16);
    A.boite(9, 10, 44, 34, 0, -49, brique, -0.17); A.toit(9.6, 4, 44, 34, 10, -49, ardoise, Math.PI / 2 - 0.17);
    return A.groupe;
  }

  // le château de Sceaux : le château de brique et de pierre, ses deux pavillons, ses hauts toits d'ardoise
  function chateauSceaux(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xC0614A), pierre = A.matiere(0xEDE4CF), ardoise = A.matiere(0x4F5D8C);
    A.boite(12, 14, 31, 3.3, 0, 3.5, brique); A.toit(12.6, 8, 31, 3.3, 14, 3.5, ardoise, Math.PI / 2);
    for (const z of [-16, 21.5]) { A.boite(18.6, 16, 8, 6, 0, z, brique); A.combles(19.2, 8, 8.6, 6, 16, z, ardoise); A.boites([[1, 16, 1, -3.3, 0, z - 4], [1, 16, 1, -3.3, 0, z + 4], [1, 16, 1, 15.3, 0, z - 4], [1, 16, 1, 15.3, 0, z + 4]], pierre); }
    return A.groupe;
  }

  // le temple du Marais (la Visitation Sainte-Marie, de François Mansart) : la rotonde et son dôme, le portail sur la rue
  function templeMarais(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A), or = A.matiere(0xFFC233, 0x7A4A00);
    A.cylindre(8.7, 8.7, 13, 24, 1, 0, -6, pierre); A.cylindre(9.1, 9.1, 1, 24, 1, 13, -6, pierreFoncee); A.dome(8.8, 0.95, 1, 14, -6, ardoise);
    A.cylindre(1.5, 1.5, 3, 8, 1, 22, -6, pierre); A.dome(1.7, 1.2, 1, 25, -6, ardoise); A.boule(0.5, 1, 27.4, -6, or);
    A.boite(10, 12, 4, 1, 0, -16, pierre); A.toit(10, 3, 4.4, 1, 12, -16, pierre, Math.PI / 2);
    return A.groupe;
  }

  // le théâtre antique de Lyon : la cavea adossée à la colline de Fourvière, ses gradins, l'orchestre et la scène
  function theatreLyon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE3D2B0), pierreOmbre = A.matiere(0xC9B48E), herbe = A.matiere(0x9BCB7A);
    const demiAnneau = (ri, ro, h) => (e) => { const f = new THREE.Shape(); f.absarc(0, 0, ro + e, -Math.PI / 2, Math.PI / 2, false); f.absarc(0, 0, Math.max(0.1, ri - e), Math.PI / 2, -Math.PI / 2, true); f.closePath();
      return new THREE.ExtrudeGeometry(f, { depth: h + 2 * e, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2).translate(0, -e, 0); };
    for (let k = 0; k < 5; k++) A.piece(demiAnneau(14 + 8 * k, 22 + 8 * k, 2 + 2.5 * k), k % 2 ? pierreOmbre : pierre, A.V(0, 0, 0));
    A.plaques([[2, 0.4, 34, -1, 0, 0]], herbe);
    A.boite(7, 2.5, 60, -5, 0, 0, pierreOmbre); A.boites([[3, 5, 60, -10, 0, 0]], pierre);
    return A.groupe;
  }

  // le château de Caen : la grande enceinte de Guillaume le Conquérant, ses courtines crénelées, les fondations du donjon
  function chateauCaen(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCC4), ombre = A.matiere(0xC9BB98);
    const murs = [[[94, 115], [82, 122], [84, 129]], [[73, 136], [62, 122], [46, 119], [39, 118], [25, 115]], [[98, 148], [93, 142], [78, 152], [73, 156], [84, 165], [86, 171], [90, 164], [99, 156], [105, 155], [100, 151]],
      [[29, -107], [29, -137]], [[69, -64], [29, -107]], [[92, -90], [85, -86], [90, -81], [98, -73], [104, -72], [107, -79], [98, -92], [93, -96], [92, -90]], [[78, -51], [84, -45]],
      [[92, -35], [100, -30], [107, -27], [115, 1], [125, 21], [135, 37], [142, 42], [143, 56], [150, 56], [152, 62], [147, 68], [143, 81], [143, 90], [136, 85], [116, 100], [114, 108], [82, 122], [84, 129]],
      [[66, 130], [62, 122], [46, 119], [39, 118], [26, 115], [20, 113]], [[-58, -112], [-67, -114], [-71, -108], [-63, -104], [-58, -89]],
      [[-58, -89], [-48, -61], [-52, -56], [-47, -51], [-42, -57], [0, -73], [7, -70], [9, -76], [-7, -122], [-2, -127], [-8, -131], [-10, -125], [-58, -112]],
      [[-131, -17], [-142, 3]], [[-146, 9], [-152, 24]], [[-105, -50], [-128, -22]], [[-94, -63], [-101, -55]], [[-93, 76], [-109, 64], [-129, 49], [-148, 32]], [[-48, 100], [-58, 99], [-77, 86], [-87, 80]],
      [[-29, 106], [-39, 105]], [[13, 112], [-14, 110], [-22, 109]]];
    A.remparts(murs, 11, 3, ombre); A.creneaux(murs, 11, 0.8, pierre);
    return A.groupe;
  }

  // le château de Dinan : le donjon de la duchesse Anne (deux tours rondes accolées et leurs mâchicoulis), la porte du Guichet,
  // les remparts
  function chateauDinan(THREE) {
    const A = atelier(THREE);
    const granit = A.matiere(0xC9BBA6), granitOmbre = A.matiere(0xA99A84);
    A.cylindres([[-1.5, -6, 8, 27, 0], [-1.5, 6.5, 7.5, 27, 0]], granit, 20); A.cylindres([[-1.5, -6, 8.6, 2.2, 27], [-1.5, 6.5, 8.1, 2.2, 27]], granitOmbre, 20);
    A.creneaux([anneau(-1.5, -6, 8.6, 18), anneau(-1.5, 6.5, 8.1, 18)], 29.2, 0.8, granit);
    A.boite(22, 19, 20, 14, 0, -14, granit); A.creneaux([A.tourDe(22.4, 20.4, 14, -14)], 19, 0.8, granitOmbre);
    const murs = [[[-17, -37], [-6, -25], [-6, -15]], [[5, 0], [13, 10], [35, 13], [50, 17]]];
    A.remparts(murs, 12, 3, granitOmbre); A.creneaux(murs, 12, 0.8, granit);
    return A.groupe;
  }

  // le château d'Anet : l'aile de Diane de Poitiers, la chapelle et son dôme, le portail d'entrée et son horloge
  function anet(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), pierreOmbre = A.matiere(0xDCD6C8), ardoise = A.matiere(0x4F5D8C), noir = A.matiere(0x2E2E36), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(35, 14, 21, 2.7, 0, -12.4, pierre); A.toit(21.6, 10, 35, 2.7, 14, -12.4, ardoise);
    A.boite(18, 14, 46, -23, 0, -41, pierre); A.toit(18.6, 9, 46, -23, 14, -41, ardoise, Math.PI / 2);
    A.boite(18, 11, 18, 37, 0, -43, pierre); A.cylindre(6, 6, 5, 16, 37, 11, -43, pierre); A.dome(6.4, 1.1, 37, 16, -43, ardoise); A.cylindre(1.2, 1.2, 3, 8, 37, 23, -43, pierre); A.boule(0.6, 37, 26.5, -43, or);
    for (const x of [30, 44]) A.pyramide(2.2, 9, 4, x, 11, -34, ardoise);
    A.boite(14, 16, 8, -57, 0, -12, pierre); A.boite(7, 6, 8.4, -57, 16, -12, pierreOmbre); A.piece((e) => new THREE.CylinderGeometry(1.6 + e, 1.6 + e, 0.5 + 2 * e, 24).rotateX(Math.PI / 2), noir, A.V(-57, 19, -16.4));
    A.extrusion(A.formeArche(5, 9), 0.6, -57, 0, -16.3, pierreOmbre, 0, true);
    return A.groupe;
  }

  // le château d'Écouen : les quatre ailes autour de la cour, leurs pavillons d'angle, les hauts toits d'ardoise
  function ecouen(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), ardoise = A.matiere(0x4F5D8C);
    A.boites([[66, 17, 14, 8, 0, -14.8], [66, 17, 14, 8, 0, 39.4], [11, 17, 40.5, -19.5, 0, 12.5], [10, 17, 40.5, 36, 0, 12.5]], pierre);
    A.toit(14.6, 9, 66, 8, 17, -14.8, ardoise); A.toit(14.6, 9, 66, 8, 17, 39.4, ardoise);
    A.toit(11.6, 7, 40.5, -19.5, 17, 12.5, ardoise, Math.PI / 2); A.toit(10.6, 7, 40.5, 36, 17, 12.5, ardoise, Math.PI / 2);
    for (const [x, z] of [[-21, -18], [37, -18], [-21, 42], [37, 42]]) { A.boite(12, 21, 12, x, 0, z, pierre); A.combles(12.6, 9, 12.6, x, 21, z, ardoise); }
    return A.groupe;
  }

  // l'abbaye Saint-Pierre de Moissac : le clocher-porche fortifié, la nef de brique, le chevet, et le célèbre cloître
  function moissac(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D3A8), brique = A.matiere(0xD27A55), tuile = A.matiere(0xB0603F), herbe = A.matiere(0x9BCB7A);
    A.boite(50, 18, 20, 14, 0, 22, brique); A.toit(20.6, 6, 50, 14, 18, 22, tuile); A.abside(10, 18, 39, 0, 22, brique); A.demiCone(10.5, 5, 39, 18, 22, tuile);
    A.boite(22, 16, 22, -22, 0, 22, pierre); A.boite(22, 14, 22, -22, 16, 22, brique); A.creneaux([A.tourDe(22.4, 22.4, -22, 22)], 30, 0.8, brique);
    const g = [[39, 5, -1.5, -25.5], [39, 5, -1.5, 5.5], [5, 26, -18.5, -10], [5, 26, 15.5, -10]];
    A.boites(g.map(([lx, lz, x, z]) => [lx, 5, lz, x, 0, z]), pierre); A.toits(g.map(([lx, lz, x, z]) => (lx > lz ? [lz + 0.6, 2, lx, x, 5, z, 0] : [lx + 0.6, 2, lz, x, 5, z, Math.PI / 2])), tuile);
    A.plaques([[29, 0.3, 26, -1.5, 0, -10]], herbe);
    return A.groupe;
  }

  // la cathédrale Notre-Dame-de-l'Assomption d'Ajaccio : la façade ocre, la nef, le dôme de la croisée
  function cathedraleAjaccio(THREE) {
    const A = atelier(THREE);
    const ocre = A.matiere(0xE8C27A), ocreClair = A.matiere(0xF2D9A6), tuile = A.matiere(0xB0603F);
    A.boite(32, 10, 28, -16, 0, 1.5, ocre); A.toit(28.6, 3, 32, -16, 10, 1.5, tuile);
    A.boite(32, 14, 14, -16, 0, 1.5, ocre); A.toit(14.6, 4, 32, -16, 14, 1.5, tuile);
    A.boite(10, 14, 28, 3, 0, 1.5, ocre); A.toit(10.6, 4, 28, 3, 14, 1.5, tuile, Math.PI / 2);
    A.piece((e) => new THREE.CylinderGeometry(5 + e, 5 + e, 5 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 2.5, 0), ocreClair, A.V(0, 14, 1.5)); A.dome(5.2, 0.9, 0, 19, 1.5, tuile); A.cylindre(1, 1, 2, 8, 0, 23.6, 1.5, ocreClair);
    A.boite(2, 18, 16, -32, 0, 1.5, ocreClair); A.toit(16, 3.5, 2, -32, 18, 1.5, ocreClair);
    return A.groupe;
  }

  // la cathédrale Saint-Pierre de Saintes : le grand clocher-porche inachevé et son dôme, la nef, le transept, le chœur
  function cathedraleSaintes(THREE) {
    const g = cathedrale(THREE, { F: -60, E: 37, larg: 14, mur: 22, toitH: 9, xT: 10, transept: 40, transeptL: 14, cote: 9, facadeH: 30, rose: 3,
      tours: [{ z: 0, x: -58, h: 50, cote: 16, octogone: { h: 12, r: 6 } }] });
    const A = atelier(THREE); A.dome(6.2, 1.5, -58, 62, 0, A.matiere(0x6E7AA0));
    g.add(A.groupe); return g;
  }

  // l'arc de Germanicus de Saintes : l'arc romain à deux arches et son attique
  function arcGermanicus(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE8DCC0), pierreFoncee = A.matiere(0xCDBC98);
    A.boites([[4, 8.5, 2.2, 0.4, 0, -8.4], [4, 8.5, 2.6, 0.4, 0, -1.5], [4, 8.5, 2.2, 0.4, 0, 5.4]], pierre);
    const voute = (r, ys, ytop) => { const v = new THREE.Shape(); v.moveTo(-r, ys); v.absarc(0, ys, r, Math.PI, 0, true); v.lineTo(r, ytop); v.lineTo(-r, ytop); v.closePath(); return v; };
    for (const z of [-4.95, 1.95]) A.extrusion(voute(2.15, 5.5, 8.5), 3.98, 0.4, 0, z, pierre, Math.PI / 2, true);
    A.boite(4.6, 0.8, 16.4, 0.4, 8.5, -1.5, pierreFoncee); A.boite(4, 4, 15.6, 0.4, 9.3, -1.5, pierre); A.boite(4.4, 0.6, 16, 0.4, 13.3, -1.5, pierreFoncee);
    return A.groupe;
  }

  // la cathédrale Saint-Jean-Baptiste de Bazas : la façade aux trois portails, la nef, le chevet, le clocher
  const cathedraleBazas = (THREE) => cathedrale(THREE, { F: -46, E: 33, larg: 16, mur: 20, toitH: 8, xT: 0, cote: 8, facadeH: 26, rose: 4,
    tours: [{ z: -15, x: -36, h: 32, cote: 10, fleche: 14, r: 4.4, seg: 8 }] });

  // la cathédrale Sainte-Réparate de Nice : la façade baroque, la nef, le dôme de tuiles vernissées, le clocher
  function sainteReparate(THREE) {
    const A = atelier(THREE);
    const ocre = A.matiere(0xEFD2A8), ocreClair = A.matiere(0xF6E2C2), tuile = A.matiere(0xB0603F), vernis = A.matiere(0xC9902F), vert = A.matiere(0x3E8A55);
    A.boite(44, 10, 30, -8, 0, 6, ocre); A.toit(30.6, 3, 44, -8, 10, 6, tuile);
    A.boite(44, 14, 18, -8, 0, 6, ocre); A.toit(18.6, 4, 44, -8, 14, 6, tuile);
    A.boite(10, 14, 14, 19, 0, 6, ocre); A.abside(7, 14, 24, 0, 6, ocre); A.demiCone(7.5, 3, 24, 14, 6, tuile);
    A.piece((e) => new THREE.CylinderGeometry(5.5 + e, 5.5 + e, 6 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 3, 0), ocreClair, A.V(6, 14, 6)); A.dome(5.8, 1.1, 6, 20, 6, vernis); A.cylindre(1, 1, 2.5, 8, 6, 26.4, 6, ocreClair);
    A.boite(2, 20, 20, -31, 0, 6, ocreClair); A.toit(20, 4, 2, -31, 20, 6, ocreClair);
    A.boite(6, 26, 5, 19, 0, -6.7, ocre); A.dome(3, 1.5, 19, 26, -6.7, vert);
    return A.groupe;
  }

  // l'église Saint-Michel de Carcassonne (la cathédrale de la ville basse) : la grande nef unique, sa rose, son chevet
  function saintMichelCarcassonne(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D5B0), pierreFoncee = A.matiere(0xCBB68C), tuile = A.matiere(0xB0603F), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(50, 19, 26, -17.9, 0, 3, pierre); A.toit(26.6, 6, 50, -17.9, 19, 3, tuile); A.abside(13, 19, 7, 0, 3, pierre); A.demiCone(13.5, 5, 7, 19, 3, tuile);
    A.boites([-34, -24, -14, -4].flatMap((x) => [[2.4, 15, 2, x, 0, 17], [2.4, 15, 2, x, 0, -11]]), pierreFoncee);
    A.boite(2, 22, 26, -43.5, 0, 3, pierre); A.toit(26, 6, 2, -43.5, 22, 3, pierre);
    A.piece((e) => new THREE.CylinderGeometry(4 + e, 4 + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, A.V(-44.8, 15, 3));
    A.boite(1.4, 5, 4, -43.5, 28, 3, pierre);
    return A.groupe;
  }

  // la cathédrale Saint-Sauveur d'Aix-en-Provence : la façade gothique, la nef, le clocher octogonal au nord, le baptistère
  function cathedraleAix(THREE) {
    const g = cathedrale(THREE, { pierre: 0xEAD9B4, pierreFoncee: 0xCDB58A, toit: 0xB0603F, toitFonce: 0x9A4F34, F: -12, E: 32, larg: 16, mur: 25, toitH: 8, xT: 10, cote: 9, facadeH: 30, rose: 3,
      tours: [{ z: -13, x: 22, h: 40, octogone: { h: 10, r: 4 } }] });
    const A = atelier(THREE), pierre = A.matiere(0xEAD9B4), tuile = A.matiere(0xB0603F);
    A.piece((e) => new THREE.CylinderGeometry(6 + e, 6 + e, 12 + 2 * e, 8).rotateY(Math.PI / 8).translate(0, 6, 0), pierre, A.V(-21, 0, 0)); A.dome(6, 0.6, -21, 12, 0, tuile);
    g.add(A.groupe); return g;
  }

  // le château de Maisons (François Mansart) : le corps central et son avant-corps, les deux ailes, les hauts combles d'ardoise
  function chateauMaisons(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), ardoise = A.matiere(0x4F5D8C);
    A.boite(14, 17, 38, 5.5, 0, -2, pierre); A.combles(14.6, 9, 38.6, 5.5, 17, -2, ardoise);
    A.boite(12, 22, 12, 5.5, 0, -2, pierre); A.domeCarre(12.6, 9, 12.6, 5.5, 22, -2, ardoise);
    A.boite(33, 17, 16, -2.3, 0, -28.7, pierre); A.combles(33.6, 10, 16.6, -2.3, 17, -28.7, ardoise);
    A.boite(33, 17, 15, -2.2, 0, 25, pierre); A.combles(33.6, 10, 15.6, -2.2, 17, 25, ardoise);
    return A.groupe;
  }

  // le château du Plessis-Bourré : le château blanc dans ses larges douves, ses ailes, ses tours rondes et le grand donjon
  function plessisBourre(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C), eau = A.matiere(0x6DC4F0, 0x0E3A55);
    A.plaques([[88, 0.3, 14, 6, 0.1, -32], [88, 0.3, 14, 6, 0.1, 54], [14, 0.3, 72, -32, 0.1, 11], [14, 0.3, 72, 44, 0.1, 11]], eau);
    A.boite(50, 13, 11, 6, 0, -12.5, tuffeau); A.toit(11.6, 8, 50, 6, 13, -12.5, ardoise);
    A.boites([[9, 9, 50, -15.5, 0, 12], [9, 9, 50, 26.5, 0, 12], [42, 7, 8, 5, 0, 37]], tuffeau);
    A.toits([[9.6, 4, 50, -15.5, 9, 12, Math.PI / 2], [9.6, 4, 50, 26.5, 9, 12, Math.PI / 2]], ardoise);
    const tours = [[-22, -16, 6.5, 15], [-18.7, 42, 6.5, 13], [28, 42, 6.5, 13]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), tuffeau, 18); A.cones(tours.map(([x, z, r, h]) => [x, z, r + 0.4, h, r * 1.8]), ardoise, 18);
    A.cylindre(7.5, 7.5, 24, 20, 31, 0, -18, tuffeau); A.creneaux([anneau(31, -18, 7.7, 18)], 24, 0.8, tuffeau); A.cones([[31, -18, 5, 25, 7]], ardoise, 18);
    return A.groupe;
  }

  // le château de Talcy : le logis, le pavillon d'entrée et ses tourelles en encorbellement, le grand colombier rond
  function talcy(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), ardoise = A.matiere(0x4F5D8C), tuile = A.matiere(0xB0603F);
    A.boite(14, 9, 50, 37, 0, -11, pierre); A.toit(14.6, 7, 50, 37, 9, -11, ardoise, Math.PI / 2);
    A.boite(34, 9, 13, 12, 0, 32, pierre); A.toit(13.6, 7, 34, 12, 9, 32, ardoise);
    A.boite(10, 14, 10, 31, 0, 31, pierre); A.creneaux([A.tourDe(10.4, 10.4, 31, 31)], 14, 0.7, pierre); A.combles(9, 5, 9, 31, 14.7, 31, ardoise);
    A.cylindres([[26, 26, 1.6, 6, 8], [36, 26, 1.6, 6, 8]], pierre, 10); A.cones([[26, 26, 1.9, 14, 3.5], [36, 26, 1.9, 14, 3.5]], ardoise, 10);
    A.cylindre(5, 5, 8, 18, -9.4, 0, -27.8, pierre); A.cones([[-9.4, -27.8, 5.6, 8, 6]], tuile, 18);
    return A.groupe;
  }

  // le château de Roquetaillade : l'enceinte carrée, ses tours rondes coiffées de cônes, le grand donjon carré au milieu
  function roquetaillade(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D8BC), ombre = A.matiere(0xC9B894), ardoise = A.matiere(0x4F5D8C);
    const mur = [[-10.6, -17.8], [23.9, -20], [22.8, 13.9], [-10, 13.9], [-10.6, -17.8]];
    A.remparts([mur], 16, 7, pierre); A.creneaux([mur], 16, 0.8, ombre);
    A.boite(11, 35, 11, 6, 0, -2, pierre); A.creneaux([A.tourDe(11.4, 11.4, 6, -2)], 35, 0.8, ombre); A.combles(9, 6, 9, 6, 35.7, -2, ardoise);
    const tours = [[-10.6, -17.8], [23.9, -20], [-10, 13.9], [22.8, 13.9], [-10.6, -5.6]];
    A.cylindres(tours.map(([x, z]) => [x, z, 5, 22, 0]), pierre, 16); A.cones(tours.map(([x, z]) => [x, z, 5.5, 22, 10]), ardoise, 16);
    return A.groupe;
  }

  // le château d'Abbadia : le château néo-gothique d'Antoine d'Abbadie, ses tours, ses toits pointus, son observatoire
  function abbadia(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCC4), ardoise = A.matiere(0x4F5D8C);
    A.boites([[17, 14, 12, -24.5, 0, -6.5], [26, 14, 11, -7, 0, 4.5], [10, 14, 21, -11, 0, 20.5], [14, 14, 11, 12, 0, 4.5]], pierre);
    A.toits([[12.6, 7, 17, -24.5, 14, -6.5], [11.6, 6, 26, -7, 14, 4.5], [10.6, 6, 21, -11, 14, 20.5, Math.PI / 2], [11.6, 6, 14, 12, 14, 4.5]], ardoise);
    A.cylindre(4, 4, 20, 16, -12, 0, 28, pierre); A.cones([[-12, 28, 4.4, 20, 9]], ardoise, 16);
    A.boite(5, 22, 5, -16, 0, -10, pierre); A.pyramide(3.6, 7, 4, -16, 22, -10, ardoise);
    return A.groupe;
  }

  // l'abbaye Saint-Victor de Marseille : l'église fortifiée, ses deux tours crénelées
  function saintVictor(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE3D3B4), ombre = A.matiere(0xC6B38E);
    A.boite(40, 14, 26, 0, 0, -1, pierre); A.creneaux([A.tourDe(40.4, 26.4, 0, -1)], 14, 0.8, ombre);
    A.boite(14, 22, 14, -23, 0, -12, pierre); A.creneaux([A.tourDe(14.4, 14.4, -23, -12)], 22, 0.8, ombre);
    A.boite(12, 20, 16, 22, 0, -1, pierre); A.creneaux([A.tourDe(12.4, 16.4, 22, -1)], 20, 0.8, ombre);
    return A.groupe;
  }

  // la basilique de la Daurade (Toulouse) : la grande salle classique, son portique et son fronton, l'abside
  function daurade(THREE) {
    const A = atelier(THREE);
    const brique = A.matiere(0xD9845E), pierre = A.matiere(0xEFE4CC), tuile = A.matiere(0xB0603F);
    A.boite(70, 20, 17, -1.5, 0, -0.5, brique); A.toit(17.6, 5, 70, -1.5, 20, -0.5, tuile);
    A.cylindre(7.5, 7.5, 18, 18, 1.5, 0, 12, brique); A.dome(7.7, 0.5, 1.5, 18, 12, tuile);
    A.boite(3, 22, 17, -38, 0, -0.5, pierre); A.cylindres([-6, -2, 2, 6].map((dz) => [-41, -0.5 + dz, 0.9, 15, 0]), pierre, 12);
    A.boite(5, 2, 17, -40, 15, -0.5, pierre); A.toit(17, 4, 5, -40, 17, -0.5, pierre);
    return A.groupe;
  }

  // la grande synagogue de Bordeaux : la salle, la grande façade et sa rose, ses deux tours à petits dômes
  function synagogueBordeaux(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEADFC6), pierreFoncee = A.matiere(0xCDBB98), ardoise = A.matiere(0x56659A), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E);
    A.boite(26, 18, 39, 6.35, 0, 0, pierre); A.toit(26.6, 7, 39, 6.35, 18, 0, ardoise, Math.PI / 2);
    A.boite(28, 22, 3, 6.35, 0, -20.5, pierreFoncee); A.toit(28, 6, 3, 6.35, 22, -20.5, pierreFoncee, Math.PI / 2);
    A.piece((e) => new THREE.CylinderGeometry(4.5 + e, 4.5 + e, 1 + 2 * e, 28).rotateX(Math.PI / 2), vitrail, A.V(6.35, 15, -22.2));
    for (const s of [1, -1]) { A.boite(4.5, 28, 4.5, 6.35 + s * 12, 0, -20.5, pierre); A.dome(2.6, 1.4, 6.35 + s * 12, 28, -20.5, ardoise); }
    return A.groupe;
  }

  // la basilique Saint-Seurin de Bordeaux : le porche roman, la nef, le clocher au nord, le chevet
  const saintSeurin = (THREE) => cathedrale(THREE, { F: -33, E: 37, larg: 14, mur: 17, toitH: 7, xT: 10, cote: 8, facadeH: 22, rose: 3, arcs: false,
    tours: [{ z: -10, x: -24, h: 30, fleche: 10, r: 4, seg: 4 }] });

  // la cathédrale Saint-Apollinaire de Valence : la cathédrale romane, son clocher-porche, son transept, son abside
  const cathedraleValence = (THREE) => cathedrale(THREE, { pierre: 0xEAD9B4, pierreFoncee: 0xCDB58A, toit: 0xB0603F, toitFonce: 0x9A4F34, F: -24, E: 39.5, larg: 12, mur: 18, toitH: 6,
    xT: 20, transept: 36, transeptL: 12, cote: 10, facadeH: 20, rose: 2, arcs: false, tours: [{ z: 0, h: 36, fleche: 10, r: 4.6, seg: 4 }] });

  // le château de Quéribus : le donjon polygonal au sommet de son piton rocheux, les enceintes en contrebas
  function queribus(THREE) {
    const A = atelier(THREE);
    const roche = A.matiere(0x9C8E7E), rocheClaire = A.matiere(0xB5A895), pierre = A.matiere(0xE3D6BC), ombre = A.matiere(0xC6B794);
    A.piece((e) => new THREE.CylinderGeometry(15 + e, 26 + e, 20 + 2 * e, 9).translate(0, 10, 0), roche, A.V(9, 0, -14));
    A.piece((e) => new THREE.CylinderGeometry(9 + e, 15 + e, 10 + 2 * e, 8).translate(0, 5, 0), rocheClaire, A.V(9, 20, -14));
    A.remparts([anneau(9, -14, 16, 10)], 6, 1.8, ombre, 20); A.creneaux([anneau(9, -14, 16, 10)], 26, 0.6, pierre);
    A.boite(12, 14, 20, 9.6, 30, -14, pierre); A.creneaux([A.tourDe(12.4, 20.4, 9.6, -14)], 44, 0.7, ombre);
    return A.groupe;
  }

  // l'abbaye de Murbach : le chœur roman de grès rose et ses deux tours carrées au-dessus du transept
  function murbach(THREE) {
    const A = atelier(THREE);
    const gres = A.matiere(0xC98F7B), gresFonce = A.matiere(0xA96F5C), tuile = A.matiere(0x9E4F3A);
    A.boite(22, 17, 18, -13.6, 0, -4, gres); A.toit(18.6, 6, 22, -13.6, 17, -4, tuile, Math.PI / 2);
    A.boite(9, 16, 10, -13, 0, -18, gres); A.toit(9.6, 5, 10, -13, 16, -18, tuile, Math.PI / 2);
    A.boite(15, 14, 6, -13.6, 0, 7, gresFonce);
    for (const x of [-21, -6]) { A.boite(6.5, 36, 6.5, x, 0, -4, gres); A.pyramide(4.8, 7, 4, x, 36, -4, tuile); }
    return A.groupe;
  }

  // l'abbatiale de Pontigny : la très longue église cistercienne, son transept, son chevet et son déambulatoire, le porche
  function pontigny(THREE) {
    const g = cathedrale(THREE, { pierre: 0xF0EADA, pierreFoncee: 0xD8CDB2, toit: 0x8C5A44, toitFonce: 0x744A38, F: -65, E: 42, larg: 16, mur: 20, toitH: 9, xT: 8, transept: 52,
      transeptL: 20, cote: 8, facadeH: 22, rose: 2, arcs: false, tours: [{ z: 0, h: 14, cote: 8 }] });
    const A = atelier(THREE); A.abside(18, 11, 34, 0, 0, A.matiere(0xD8CDB2)); A.demiCone(18.5, 4, 34, 11, 0, A.matiere(0x744A38));
    g.add(A.groupe); return g;
  }

  // l'abbatiale Saint-Pierre de Corbie : la façade et ses deux tours, la nef (le chœur a disparu)
  const abbatialeCorbie = (THREE) => cathedrale(THREE, { F: -17, E: 28, chevetPlat: true, larg: 12, mur: 22, toitH: 8, xT: 10, cote: 10.7, facadeH: 28, rose: 3,
    tours: [{ z: -13, h: 40, fleche: 6, r: 5, seg: 4 }, { z: 13, h: 40, fleche: 6, r: 5, seg: 4 }] });

  // la cathédrale Sainte-Marie d'Oloron : la tour-porche et son portail roman, la nef, le chevet
  const cathedraleOloron = (THREE) => cathedrale(THREE, { pierre: 0xE6DCC4, pierreFoncee: 0xC9BB98, toit: 0x6E645C, toitFonce: 0x5A524C, F: -14, E: 33, larg: 16, mur: 14, toitH: 6, xT: 18,
    cote: 10, facadeH: 18, rose: 2, arcs: false, tours: [{ z: -4, h: 32, cote: 11, fleche: 8, r: 5.5, seg: 4 }] });

  // le fort de Brégançon : le fort provençal sur son rocher au bord de la mer
  function bregancon(THREE) {
    const A = atelier(THREE);
    const roche = A.matiere(0x9C8E7E), pierre = A.matiere(0xE6D8BC), ombre = A.matiere(0xC6B794), tuile = A.matiere(0xB0603F);
    A.piece((e) => new THREE.CylinderGeometry(26 + e, 36 + e, 22 + 2 * e, 10).translate(0, 11, 0), roche, A.V(10, 0, -8));
    const mur = [[-12, -26], [16, -30], [42, -6], [44, 12], [20, 10], [-12, 12], [-12, -26]];
    A.remparts([mur], 7, 2, ombre, 22); A.creneaux([mur], 29, 0.6, pierre);
    A.boites([[16, 8, 22, -2, 22, -8], [14, 7, 8, 32, 22, 6], [16, 9, 7, 10, 22, -24]], pierre);
    A.toits([[8.6, 3, 16, -2, 30, -8, Math.PI / 2], [8.6, 3, 14, 32, 29, 6], [7.6, 3, 16, 10, 31, -24]], tuile);
    return A.groupe;
  }

  // la tour Clovis : le clocher de l'ancienne abbaye Sainte-Geneviève (lycée Henri-IV), roman en bas, gothique en haut
  function tourClovis(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), plomb = A.matiere(0x6E7AA0);
    A.boite(10.6, 30, 8.7, 0, 0, 0, pierre); A.boite(11.2, 1, 9.3, 0, 30, 0, pierreFoncee);
    A.boite(9.6, 11, 8, 0, 31, 0, pierre); A.boite(10.2, 1, 8.6, 0, 42, 0, pierreFoncee);
    A.cones([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a * 4.3, b * 3.5, 0.6, 43, 4]), pierreFoncee, 6); A.pyramide(4.4, 4, 4, 0, 43, 0, plomb);
    return A.groupe;
  }

  // le château de Ferrières (les Rothschild) : le grand bloc carré, ses quatre tours d'angle et leurs lanternons, la verrière
  function ferrieres(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), ardoise = A.matiere(0x4F5D8C), verre = A.matiere(0xA9C4D6, 0x2A4A60), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(46, 19, 50, 13, 0, -4.6, pierre); A.combles(46.6, 5, 50.6, 13, 19, -4.6, ardoise); A.boite(16, 4, 16, 13, 21, -4.6, verre);
    for (const [x, z] of [[-10, -28], [36, -28], [-10, 19], [36, 19]]) { A.boite(9, 26, 9, x, 0, z, pierre); A.combles(9.6, 6, 9.6, x, 26, z, ardoise); A.cylindre(0.9, 0.9, 3, 8, x, 31.4, z, pierre); A.boule(0.5, x, 35, z, or); }
    return A.groupe;
  }

  // l'abbaye du Thoronet : l'église cistercienne de pierre nue, son abside, son petit clocher de pierre
  function thoronet(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE8D5B0), ombre = A.matiere(0xCDB58A), lauze = A.matiere(0xB8A68A);
    A.boite(44, 8, 34, 6, 0, -1, ombre); A.toit(34.6, 3, 44, 6, 8, -1, lauze);
    A.boite(44, 12, 13, 6, 0, -1, pierre); A.toit(13.6, 4, 44, 6, 12, -1, lauze);
    A.abside(6.5, 10, 28, 0, -1, pierre); A.demiCone(7, 3, 28, 10, -1, lauze);
    A.boite(4, 22, 4, 18, 0, -9, pierre); A.pyramide(3, 8, 4, 18, 22, -9, pierre);
    return A.groupe;
  }

  // l'abbaye de Jumièges : les ruines de l'abbatiale Notre-Dame, ses deux tours (46 m), la nef à ciel ouvert, le grand mur de
  // la tour-lanterne
  function jumieges(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFEAD8), ombre = A.matiere(0xD6CFB8), ardoise = A.matiere(0x4F5D8C);
    for (const z of [-8, 8]) { A.boite(7, 36, 7, -40, 0, z, pierre); A.cylindre(3, 3, 6, 8, -40, 36, z, pierre); A.pyramide(3.4, 4, 8, -40, 42, z, ardoise); }
    A.boite(6, 26, 9, -40, 0, 0, pierre);
    A.boites([[60, 20, 1.6, -6, 0, -10], [60, 20, 1.6, -6, 0, 10], [60, 9, 1.4, -6, 0, -16], [60, 9, 1.4, -6, 0, 16]], ombre);
    A.boite(2, 40, 18, 28, 0, 0, pierre); A.boites([[10, 30, 2, 33, 0, -9], [10, 30, 2, 33, 0, 9]], ombre);
    A.remparts([anneau(46, 0, 10, 10).filter(([x]) => x >= 45)], 4, 1.2, ombre);
    return A.groupe;
  }

  // le château de Montségur : la forteresse pentagonale au sommet du pog, son donjon
  function montsegur(THREE) {
    const A = atelier(THREE);
    const roche = A.matiere(0x9C8E7E), rocheClaire = A.matiere(0xB5A895), pierre = A.matiere(0xE3D6BC), ombre = A.matiere(0xC6B794);
    A.piece((e) => new THREE.CylinderGeometry(34 + e, 48 + e, 18 + 2 * e, 10).scale(1.2, 1, 0.75).translate(0, 9, 0), roche, A.V(0, 0, 0));
    A.piece((e) => new THREE.CylinderGeometry(30 + e, 34 + e, 2 + 2 * e, 10).scale(1.2, 1, 0.75).translate(0, 1, 0), rocheClaire, A.V(0, 18, 0));
    const mur = [[-28, -2], [-8, -12], [25, -6], [30, 6], [-10, 10], [-28, -2]];
    A.remparts([mur], 12, 2.4, ombre, 20); A.creneaux([mur], 32, 0.6, pierre);
    A.boite(10, 18, 12, -16, 20, 0, pierre); A.creneaux([A.tourDe(10.4, 12.4, -16, 0)], 38, 0.6, ombre);
    return A.groupe;
  }

  // le château de Serrant : le logis de schiste et de tuffeau, ses deux ailes, ses grosses tours rondes coiffées de dômes
  function serrant(THREE) {
    const A = atelier(THREE);
    const schiste = A.matiere(0xC8B496), tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C), or = A.matiere(0xFFC233, 0x7A4A00);
    A.boite(12, 19, 50, 16, 0, -17, schiste); A.combles(12.6, 8, 50.6, 16, 19, -17, ardoise);
    A.boite(37, 17, 11, 3.5, 0, -41.5, schiste); A.toit(11.6, 7, 37, 3.5, 17, -41.5, ardoise);
    A.boite(37, 17, 12, 3.5, 0, 9, schiste); A.toit(12.6, 7, 37, 3.5, 17, 9, ardoise);
    for (const z of [-46, 12.4]) { A.cylindre(7, 7, 22, 20, 22.5, 0, z, schiste); A.cylindre(7.4, 7.4, 1.2, 20, 22.5, 22, z, tuffeau); A.dome(7.2, 1.1, 22.5, 23.2, z, ardoise); A.cylindre(1.3, 1.3, 3, 8, 22.5, 30.7, z, tuffeau); A.boule(0.6, 22.5, 34.3, z, or); }
    return A.groupe;
  }

  // le château d'Ancy-le-Franc : le carré Renaissance autour de la cour, ses pavillons d'angle et leurs toits pyramidaux
  function ancyLeFranc(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), ardoise = A.matiere(0x4F5D8C);
    A.boites([[56, 15, 12, 1, 0, -28.7], [56, 15, 12, 1, 0, 15.6], [12, 15, 32, -21, 0, -6.5], [12, 15, 32, 23, 0, -6.5]], pierre);
    A.toits([[12.6, 6, 56, 1, 15, -28.7], [12.6, 6, 56, 1, 15, 15.6], [12.6, 6, 32, -21, 15, -6.5, Math.PI / 2], [12.6, 6, 32, 23, 15, -6.5, Math.PI / 2]], ardoise);
    for (const [x, z] of [[-21, -28.7], [23, -28.7], [-21, 15.6], [23, 15.6]]) { A.boite(14, 19, 14, x, 0, z, pierre); A.combles(14.6, 9, 14.6, x, 19, z, ardoise); }
    return A.groupe;
  }

  // le château de Fénelon : le logis autour de sa petite cour, ses tours rondes et leurs toits de lauzes
  function fenelon(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6D3A8), lauze = A.matiere(0x857A70);
    A.boites([[39, 14, 8, 0, 0, -7.3], [39, 12, 7, 0, 0, 11.2], [8, 13, 26, -16, 0, 1.7], [8, 13, 26, 15.3, 0, 1.7]], pierre);
    A.toits([[8.6, 7, 39, 0, 14, -7.3], [7.6, 6, 39, 0, 12, 11.2], [8.6, 6, 26, -16, 13, 1.7, Math.PI / 2], [8.6, 6, 26, 15.3, 13, 1.7, Math.PI / 2]], lauze);
    const tours = [[-16, 13.3, 4.5, 18], [8, 12, 4.5, 18], [-36, -22, 3, 12], [17, -30, 3.5, 14], [-20, -10, 4, 18]];
    A.cylindres(tours.map(([x, z, r, h]) => [x, z, r, h, 0]), pierre, 16); A.cones(tours.map(([x, z, r, h]) => [x, z, r + 0.5, h, r * 2.4]), lauze, 16);
    A.boite(40, 12, 11, 38, 0, 11, pierre, -0.22); A.toit(11.6, 6, 40, 38, 12, 11, lauze, -0.22);
    return A.groupe;
  }

  // le château de Saché : la demeure de tuffeau où Balzac écrivait, ses hauts toits d'ardoise
  function sache(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C);
    A.boite(32, 12, 10, 23.6, 0, -7, tuffeau); A.toit(10.6, 7, 32, 23.6, 12, -7, ardoise);
    A.boite(10, 11, 12, 20, 0, 4, tuffeau); A.toit(10.6, 6, 12, 20, 11, 4, ardoise, Math.PI / 2);
    return A.groupe;
  }

  // la cathédrale Notre-Dame de Lescar : la cathédrale romane du Béarn, son porche, sa nef, son abside
  const cathedraleLescar = (THREE) => cathedrale(THREE, { pierre: 0xE6DCC4, pierreFoncee: 0xC9BB98, toit: 0xB0603F, toitFonce: 0x9A4F34, F: -46, E: 15, larg: 14, mur: 14, toitH: 6, xT: 0,
    cote: 9, facadeH: 16, rose: 2, arcs: false, tours: [{ z: 0, h: 22, cote: 10, fleche: 6, r: 5, seg: 4 }] });

  // l'église Notre-Dame-de-Bonne-Nouvelle : la nef néo-classique, sa façade, son vieux clocher
  function notreDameBonneNouvelle(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xEFE6D0), pierreFoncee = A.matiere(0xD6C8A8), ardoise = A.matiere(0x56659A);
    A.boite(24, 16, 40, -4.7, 0, -2.5, pierre); A.toit(24.6, 6, 40, -4.7, 16, -2.5, ardoise, Math.PI / 2);
    A.boite(18, 20, 3, -4.7, 0, 18.5, pierre); A.toit(18, 4, 3, -4.7, 20, 18.5, pierre, Math.PI / 2); A.cylindres([-6, -2, 2, 6].map((d) => [-4.7 + d, 20.5, 0.7, 12, 0]), pierre, 10);
    A.boite(6, 26, 6, -14, 0, -20, pierre); A.domeCarre(6.6, 5, 6.6, -14, 26, -20, ardoise);
    return A.groupe;
  }

  // la fontaine Médicis : la grotte de la fontaine, ses colonnes à bossages, son fronton, le long bassin
  function fontaineMedicis(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xE6DCC4), pierreFoncee = A.matiere(0xC9BB98), sombre = A.matiere(0x5A5650);
    A.boite(4, 10, 11, 0, 0, 0, pierre); A.extrusion(A.formeArche(4, 7), 0.6, 2.1, 0.6, 0, sombre, Math.PI / 2, true);
    A.cylindres([[2.3, -4, 0.6, 9, 0], [2.3, 4, 0.6, 9, 0]], pierreFoncee, 10); A.toit(11.6, 2.5, 4.6, 0, 10, 0, pierre);
    A.boites([[2, 1.2, 12, 3.4, 0, 0]], pierreFoncee);
    return A.groupe;
  }

  // le château de Menars : la très longue façade sur la Loire, ses pavillons et ses toits d'ardoise
  function menars(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF2EEE4), ardoise = A.matiere(0x4F5D8C);
    A.boite(97, 14, 15, 6.5, 0, 13, pierre); A.combles(97.6, 6, 15.6, 6.5, 14, 13, ardoise);
    A.boite(16, 16, 18, 4, 0, 13, pierre); A.combles(16.6, 8, 18.6, 4, 16, 13, ardoise);
    for (const x of [-38, 51]) { A.boite(9, 15, 17, x, 0, 13, pierre); A.combles(9.6, 7, 17.6, x, 15, 13, ardoise); }
    return A.groupe;
  }

  // le château du Rivau : ses deux ailes, son donjon à mâchicoulis, ses tourelles en poivrière
  function rivau(THREE) {
    const A = atelier(THREE);
    const pierre = A.matiere(0xF0E8D4), ardoise = A.matiere(0x4F5D8C);
    A.boite(10, 14, 36, -0.6, 0, 2.2, pierre); A.toit(10.6, 7, 36, -0.6, 14, 2.2, ardoise, Math.PI / 2);
    A.boite(30, 12, 8, -15, 0, 20.4, pierre); A.toit(8.6, 6, 30, -15, 12, 20.4, ardoise);
    A.boite(8, 22, 8, 2, 0, 19, pierre); A.creneaux([A.tourDe(8.4, 8.4, 2, 19)], 22, 0.6, pierre); A.combles(7.6, 6, 7.6, 2, 22.6, 19, ardoise);
    A.cylindres([[3.3, -13, 4, 18, 0], [-30, 20, 3.5, 14, 0]], pierre, 16); A.cones([[3.3, -13, 4.4, 18, 9], [-30, 20, 3.9, 14, 8]], ardoise, 16);
    return A.groupe;
  }

  // le château de Beauregard : l'aile Renaissance et sa galerie des portraits, ses lucarnes, ses toits d'ardoise
  function beauregard(THREE) {
    const A = atelier(THREE);
    const tuffeau = A.matiere(0xF4EEDC), ardoise = A.matiere(0x4F5D8C);
    A.boite(13, 12, 46, 36, 0, 14, tuffeau); A.toit(13.6, 8, 46, 36, 12, 14, ardoise, Math.PI / 2);
    A.boites(Array.from({ length: 5 }, (_, k) => [2.4, 3.6, 2.4, 29.8, 11.5, -2 + k * 8]), tuffeau); A.cones(Array.from({ length: 5 }, (_, k) => [29.8, -2 + k * 8, 1.9, 15.1, 3]), ardoise, 4);
    A.boite(12, 10, 9, 50, 0, 36, tuffeau); A.toit(9.6, 5, 12, 50, 10, 36, ardoise);
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
    Q739976: {   // Vaux-le-Vicomte : la cour d'honneur au nord, les jardins au sud (la BD TOPO ne dessine pas le château)
      construire: vaux, centre: [2.7142, 48.5658], orientation: 4, masquer: ['BATIMENT0000000338309764'],
    },
    Q663673: {   // Vincennes : la tour du Village au nord, le donjon à l'ouest, la Sainte-Chapelle à l'est
      construire: vincennes, centre: [2.4358, 48.8428], orientation: -8, masquer: ['BATIMENT0000000241617748', 'BATIMENT0000000241617628', 'BATIMENT0000000241617629', 'BATIMENT0000000241617747', 'BATIMENT0000000241617746', 'BATIMENT0000000241616386', 'BATIMENT0000000241617583'],
    },
    Q4055: {   // Blois : la cour au milieu, l'aile François Ier au nord-ouest
      construire: blois, centre: [1.331, 47.5855], orientation: 40, masquer: ['BATIMENT0000000321414953', 'BATIMENT0000000321414954', 'BATIMENT0000000321414955', 'BATIMENT0000000321415124'],
    },
    Q389908: {   // Amboise : le logis du Roi le long de la Loire, la tour des Minimes, la chapelle Saint-Hubert
      construire: amboise, centre: [0.986, 47.4137], orientation: 36, masquer: ['BATIMENT0000000322879332', 'BATIMENT0000000322879331', 'BATIMENT0000000322879185'],
    },
    Q622500: {   // le château d'If : le donjon carré et ses trois tours
      construire: chateauIf, centre: [5.3251, 43.2799], orientation: 7, masquer: ['BATIMENT0000000257154754'],
    },
    'manuel-notre-dame-de-la-garde': {   // Notre-Dame-de-la-Garde : le clocher et la Vierge dorée à l'ouest-nord-ouest
      construire: notreDameDeLaGarde, centre: [5.3713, 43.284], orientation: -41, masquer: ['BATIMENT0000000273400964', 'BATIMENT0000000273400965', 'BATIMENT0000000273400985', 'BATIMENT0000000273400986', 'BATIMENT0000000273400987', 'BATIMENT0000000273400988', 'BATIMENT0000000273400280', 'BATIMENT0000000273400282', 'BATIMENT0000000273400288', 'BATIMENT0000000273400287', 'BATIMENT0000000273400286', 'BATIMENT0000000273400281', 'BATIMENT0000000273400278'],
    },
    'manuel-viaduc-de-millau': {   // le viaduc de Millau : le long de l'A75 (relevée sur la carte), du nord au sud
      construire: viaducDeMillau, centre: [3.0225, 44.0775], orientation: 0, masquer: [],
    },
    Q207985: {   // Bourges : la façade à l'ouest, sans transept
      construire: bourges, centre: [2.39926, 47.08219], orientation: -19, masquer: ['BATIMENT0000000319908015', 'BATIMENT0000000319908016', 'BATIMENT0000000319908013', 'BATIMENT0000000319908014', 'BATIMENT0000000319908017', 'BATIMENT0000000319908018'],
    },
    Q1423005: {   // Nantes : la façade et ses deux tours à l'ouest-sud-ouest
      construire: nantes, centre: [-1.55016, 47.218377], orientation: 15, masquer: ['BATIMENT0000000302931847', 'BATIMENT0000000302931846', 'BATIMENT0000000302931848', 'BATIMENT0000000302931849', 'BATIMENT0000000302931850'],
    },
    Q217452: {   // Vézelay : le narthex et la tour Saint-Michel à l'ouest
      construire: vezelay, centre: [3.748563, 47.466387], orientation: 10, masquer: ['BATIMENT0000002216032157', 'BATIMENT0000002216032156', 'BATIMENT0000002216032155'],
    },
    Q513300: {   // Beauvais : le chœur et le transept, sans nef (la Basse-Œuvre, à l'ouest, reste celle de l'IGN)
      construire: beauvais, centre: [2.0814, 49.4325], orientation: -17, masquer: ['BATIMENT0000000317903350', 'BATIMENT0000000317903344', 'BATIMENT0000000317903346', 'BATIMENT0000000317903357', 'BATIMENT0000002487948145'],
    },
    Q220301: {   // Cluny : le bras sud du grand transept et ses clochers
      construire: cluny, centre: [4.6592, 46.4341], orientation: -18, masquer: ['BATIMENT0000000348292514'],
    },
    Q464918: {   // Fontenay : l'église au nord, le cloître, la forge au sud
      construire: fontenay, centre: [4.3893, 47.6397], orientation: 22, masquer: ['BATIMENT0000000216978632', 'BATIMENT0000000216978639'],
    },
    Q638250: {   // Ronchamp : la haute tour au sud-ouest, le toit en coque
      construire: ronchamp, centre: [6.6206, 47.7045], orientation: -11, masquer: ['BATIMENT0000000353013370'],
    },
    Q677659: {   // la Maison carrée : le portique au nord
      construire: maisonCarree, centre: [4.356122, 43.838192], orientation: -78, masquer: ['BATIMENT0000000314416792'],
    },
    Q958961: {   // le théâtre d'Orange : le mur de scène au nord, les gradins au sud
      construire: theatreOrange, centre: [4.8089, 44.1358], orientation: 13, masquer: ['BATIMENT0000000272966591', 'BATIMENT0000000037941502', 'BATIMENT0000000295114381'],
    },
    Q284444: {   // le pont d'Avignon : de la rive d'Avignon vers le Rhône (relevé sur la BD TOPO)
      construire: pontAvignon, centre: [4.804944, 43.953773], orientation: 124.6, masquer: ['BATIMENT0000000297742774', 'BATIMENT0000000297743408', 'BATIMENT0000000297743407'],
    },
    Q833850: {   // Carnac : dix files de menhirs (une représentation)
      construire: carnac, centre: [-3.0797, 47.5933], orientation: 30, masquer: [],
    },
    Q1143049: {   // Montsoreau : la Loire au nord
      construire: montsoreau, centre: [0.0622, 47.2156], orientation: -28, masquer: ['BATIMENT0000000313837244', 'BATIMENT0000000313837243', 'BATIMENT0000000313837242'],
    },
    Q1520841: {   // Saint-Germain-en-Laye : le pentagone
      construire: saintGermainEnLaye, centre: [2.0964, 48.8981], orientation: -11, masquer: ['BATIMENT0000000322098465'],
    },
    Q1774129: {   // Saint-Savin : le clocher-porche à l'ouest
      construire: saintSavin, centre: [0.866, 46.5648], orientation: -14, masquer: ['BATIMENT0000000274310738', 'BATIMENT0000000274310737'],
    },
    Q649055: {   // la Saline royale : la maison du directeur au nord, le demi-cercle au sud
      construire: salineRoyale, centre: [5.7778, 47.0328], orientation: 24, masquer: ['BATIMENT0000000317411888', 'BATIMENT0000000317411890', 'BATIMENT0000000317411885', 'BATIMENT0000000317411887', 'BATIMENT0000000317411886', 'BATIMENT0000000317412013', 'BATIMENT0000000317411880', 'BATIMENT0000000317411881'],
    },
    Q1338207: {   // Saint-Eustache : la façade à l'ouest
      construire: saintEustache, centre: [2.345157, 48.863396], orientation: -10, masquer: ['BATIMENT0000000245185630', 'BATIMENT0000000245159798', 'BATIMENT0000000245185631', 'BATIMENT0000000245159797', 'BATIMENT0000000245159751', 'BATIMENT0000000245185336', 'BATIMENT0000000245185360'],
    },
    Q13360213: {   // Chaillot : face à la tour Eiffel
      construire: chaillot, centre: [2.2881, 48.8623], orientation: -44, masquer: ['BATIMENT0000000245168717', 'BATIMENT0000000253247092', 'BATIMENT0000000253247090', 'BATIMENT0000000245168716'],
    },
    Q426064: {   // la place Stanislas : l'hôtel de ville au sud
      construire: placeStanislas, centre: [6.1833, 48.6936], orientation: 24,
      masquer: ['BATIMENT0000000334794694', 'BATIMENT0000000334794693', 'BATIMENT0000000334794159', 'BATIMENT0000000334794059', 'BATIMENT0000000334794298', 'BATIMENT0000000334794056', 'BATIMENT0000000334794300', 'BATIMENT0000000334794299', 'BATIMENT0000000334794284', 'BATIMENT0000000334794054', 'BATIMENT0000000334794281', 'BATIMENT0000000334794280', 'BATIMENT0000000334794290', 'BATIMENT0000000334794283', 'BATIMENT0000000334794282', 'BATIMENT0000000334794285', 'BATIMENT0000000334794286', 'BATIMENT0000000334794291', 'BATIMENT0000000334794295', 'BATIMENT0000000334794289', 'BATIMENT0000000334794294', 'BATIMENT0000000334794287', 'BATIMENT0000000334794288', 'BATIMENT0000000334794292', 'BATIMENT0000000334794689', 'BATIMENT0000000334794683', 'BATIMENT0000000334794687', 'BATIMENT0000000334794688', 'BATIMENT0000000334794685', 'BATIMENT0000000334794684', 'BATIMENT0000000334794681', 'BATIMENT0000000334794682', 'BATIMENT0000000334794686', 'BATIMENT0000000334794679', 'BATIMENT0000000334793456', 'BATIMENT0000000334793457', 'BATIMENT0000000334793454', 'BATIMENT0000000334793450', 'BATIMENT0000000334794678', 'BATIMENT0000000334793449', 'BATIMENT0000000334794677', 'BATIMENT0000000334794680', 'BATIMENT0000000334793448', 'BATIMENT0000000053807353', 'BATIMENT0000000334794279', 'BATIMENT0000002206377757', 'BATIMENT0000000334793451', 'BATIMENT0000000334794297', 'BATIMENT0000000053807352', 'BATIMENT0000000334794296'],
    },
    Q585947: {   // Laon : la façade à l'ouest, le chevet plat
      construire: laon, centre: [3.625004, 49.564372], orientation: -2, masquer: ['BATIMENT0000000311606607', 'BATIMENT0000000311606601', 'BATIMENT0000000311606602', 'BATIMENT0000000311606605'],
    },
    Q283254: {   // Fontevraud : l'abbatiale au nord, le grand cloître, les cuisines
      construire: fontevraud, centre: [0.0517, 47.1814], orientation: -19, masquer: ['BATIMENT0000000313839615', 'BATIMENT0000000313839617', 'BATIMENT0000000313839616'],
    },
    Q578771: {   // le palais du Tau, à côté de la cathédrale
      construire: palaisTau, centre: [4.0344, 49.2531], orientation: 29, masquer: ['BATIMENT0000002223520857', 'BATIMENT0000002223520856'],
    },
    Q113389: {   // Azay-le-Rideau : le logis en équerre
      construire: azayLeRideau, centre: [0.4658, 47.259], orientation: -26, masquer: ['BATIMENT0000000322812646'],
    },
    Q199234: {   // le phare de Cordouan, en mer
      construire: cordouan, centre: [-1.1733, 45.5863], orientation: 0, masquer: ['BATIMENT0000002276245250'],
    },
    Q477613: {   // Villandry : la cour ouverte au nord
      construire: villandry, centre: [0.5145, 47.3405], orientation: 35, masquer: ['BATIMENT0000000322958085'],
    },
    Q508362: {   // la grande coupole de l'observatoire de Nice
      construire: observatoireNice, centre: [7.299059, 43.727429], orientation: 0, masquer: ['BATIMENT0000000328089519'],
    },
    Q94744: {   // Albi : le clocher à l'ouest
      construire: albi, centre: [2.1426, 43.9285], orientation: 0, masquer: ['BATIMENT0000000339387174', 'BATIMENT0000000339384977', 'BATIMENT0000000339384981', 'BATIMENT0000000339384980'],
    },
    Q273480: {   // l'École militaire : la façade sur le Champ-de-Mars
      construire: ecoleMilitaire, centre: [2.3036, 48.8525], orientation: -43, masquer: ['BATIMENT0000000241924833', 'BATIMENT0000000241924834', 'BATIMENT0000000241924835'],
    },
    Q726531: {   // le théâtre des Champs-Élysées
      construire: theatreChampsElysees, centre: [2.302785, 48.865922], orientation: 41, masquer: ['BATIMENT0000000245166341'],
    },
    Q1122731: {   // le Clos Lucé
      construire: closLuce, centre: [0.991958, 47.410324], orientation: 33, masquer: ['BATIMENT0000000322878440', 'BATIMENT0000000322878441'],
    },
    Q1133501: {   // l'Odéon : le portique au nord, sur la place
      construire: odeon, centre: [2.3388, 48.8495], orientation: 1, masquer: ['BATIMENT0000000241936602'],
    },
    Q766938: {   // Chantilly : le Grand Château en triangle, le Petit Château à l'ouest
      construire: chantilly, centre: [2.4858, 49.1939], orientation: 27, masquer: ['BATIMENT0000000318467886', 'BATIMENT0000000318467885'],
    },
    Q1048155: {   // Angers : l'enceinte et ses tours, la Maine à l'ouest
      construire: angers, centre: [-0.56, 47.47], orientation: -39, masquer: ['BATIMENT0000000313191949', 'BATIMENT0000000313191950', 'BATIMENT0000000313191951', 'BATIMENT0000000313191953', 'BATIMENT0000000313191952', 'BATIMENT0000000313191945', 'BATIMENT0000000313191934', 'BATIMENT0000000313191432', 'BATIMENT0000000313198134', 'BATIMENT0000000313191926', 'BATIMENT0000000313191922'],
    },
    Q1636244: {   // Bayeux : la façade et ses deux flèches à l'ouest
      construire: bayeux, centre: [-0.703439, 49.275547], orientation: -29, masquer: ['BATIMENT0000000201938877', 'BATIMENT0000000201938878', 'BATIMENT0000000201938879', 'BATIMENT0000000201938890', 'BATIMENT0000000201937333'],
    },
    Q1777218: {   // l'arc d'Orange
      construire: arcOrange, centre: [4.8048, 44.1422], orientation: 14, masquer: ['BATIMENT0000000272966361'],
    },
    Q940746: {   // la villa Savoye
      construire: villaSavoye, centre: [2.0283, 48.9244], orientation: 33, masquer: ['BATIMENT0000002012317386'],
    },
    Q334233: {   // Saint-Remi : la façade et ses deux tours à l'ouest
      construire: saintRemi, centre: [4.041888, 49.243066], orientation: 20, masquer: ['BATIMENT0000002223501955', 'BATIMENT0000002223501952', 'BATIMENT0000002223501953', 'BATIMENT0000002223501954'],
    },
    Q1429394: {   // Saint-Germain-l'Auxerrois : le porche à l'ouest, face au Louvre
      construire: saintGermainAuxerrois, centre: [2.341374, 48.85949], orientation: -10, masquer: ['BATIMENT0000000245184933', 'BATIMENT0000000227876612', 'BATIMENT0000000253248238'],
    },
    Q1431547: {   // la tour Saint-Jacques
      construire: tourSaintJacques, centre: [2.3488, 48.8578], orientation: 0, masquer: [],
    },
    Q641548: {   // les arènes de Lutèce
      construire: arenesLutece, centre: [2.3531, 48.845], orientation: 12, masquer: [],
    },
    Q1150222: {   // le château de Saumur (la BD TOPO ne le dessine pas)
      construire: saumur, centre: [-0.0725, 47.2561], orientation: 20, masquer: [],
    },
    Q1362670: {   // la place des Victoires
      construire: placeVictoires, centre: [2.3411, 48.8658], orientation: 0,
      masquer: ['BATIMENT0000000245182530', 'BATIMENT0000000245182546', 'BATIMENT0000000245182537', 'BATIMENT0000000245182543', 'BATIMENT0000000245182532', 'BATIMENT0000000245182541', 'BATIMENT0000000245182529', 'BATIMENT0000000245182540', 'BATIMENT0000000245182531', 'BATIMENT0000000245182252', 'BATIMENT0000000245182253', 'BATIMENT0000000245184055', 'BATIMENT0000000245182665', 'BATIMENT0000000245182279', 'BATIMENT0000000245182278'],
    },
    Q1552366: {   // le Haut-Kœnigsbourg : le grand bastion à l'ouest
      construire: hautKoenigsbourg, centre: [7.344352, 48.249451], orientation: 2, masquer: ['BATIMENT0000000333824737', 'BATIMENT0000002202467099', 'BATIMENT0000002202467180', 'BATIMENT0000002202467075'],
    },
    Q583251: {   // Saint-Étienne-du-Mont : la façade à l'ouest
      construire: saintEtienneDuMont, centre: [2.348086, 48.846534], orientation: -11, masquer: ['BATIMENT0000000241932736', 'BATIMENT0000000253243651', 'BATIMENT0000000309678698'],
    },
    Q179656: {   // les arènes de Nîmes
      construire: arenesNimes, centre: [4.359621, 43.834894], orientation: -2, masquer: ['BATIMENT0000000314424911'],
    },
    Q269641: {   // la colonne de Juillet, place de la Bastille
      construire: colonneJuillet, centre: [2.3691, 48.8532], orientation: 0, masquer: [],
    },
    Q376699: {   // Pierrefonds
      construire: pierrefonds, centre: [2.9803, 49.3469], orientation: -35, masquer: ['BATIMENT0000000318102438', 'BATIMENT0000000318102437', 'BATIMENT0000000318101791', 'BATIMENT0000000318101792', 'BATIMENT0000000318101793', 'BATIMENT0000000318101794'],
    },
    Q1521: {   // la primatiale Saint-Jean de Lyon : la façade à l'ouest
      construire: saintJeanLyon, centre: [4.827481, 45.760756], orientation: -23, masquer: ['BATIMENT0000000240873691', 'BATIMENT0000000240873668'],
    },
    Q1419757: {   // la Major : la façade au sud-ouest
      construire: laMajor, centre: [5.3649, 43.2998], orientation: 78, masquer: ['BATIMENT0000000258938065', 'BATIMENT0000000258930470', 'BATIMENT0000000258930469', 'BATIMENT0000000258938064', 'BATIMENT0000000258930468', 'BATIMENT0000000258927550'],
    },
    Q684594: {   // la porte Saint-Denis
      construire: porteSaintDenis, centre: [2.35269, 48.869794], orientation: -18, masquer: ['BATIMENT0000000000158427'],
    },
    Q1111051: {   // la colonne Vendôme
      construire: colonneVendome, centre: [2.3294, 48.8675], orientation: 0, masquer: [],
    },
    Q747588: {   // le trophée des Alpes
      construire: tropheeAlpes, centre: [7.4018, 43.7448], orientation: 0, masquer: [],
    },
    Q926536: {   // le Lion de Belfort, au pied de la citadelle
      construire: lionBelfort, centre: [6.8647, 47.6367], orientation: -31, masquer: [],
    },
    Q185479: {   // Ussé : la cour ouverte au nord
      construire: usse, centre: [0.2911, 47.2497], orientation: 13, masquer: ['BATIMENT0000000323142693'],
    },
    Q291093: {   // le pont Mirabeau (berges relevées sur la carte)
      construire: pontMirabeau, centre: [2.27558, 48.846726], orientation: -28, masquer: [],
    },
    Q1516: {   // Fourvière : la façade à l'ouest
      construire: fourviere, centre: [4.8226, 45.7623], orientation: -8, masquer: ['BATIMENT0000000240873667', 'BATIMENT0000000240873665', 'BATIMENT0000000240873666', 'BATIMENT0000000240873664', 'BATIMENT0000000240873547', 'BATIMENT0000000240873663'],
    },
    Q1061061: {   // le donjon de Loches
      construire: loches, centre: [0.996831, 47.124743], orientation: -10, masquer: ['BATIMENT0000000322826319', 'BATIMENT0000000322826320', 'BATIMENT0000000322825414'],
    },
    Q1090492: {   // Château-Gaillard
      construire: chateauGaillard, centre: [1.402651, 49.238116], orientation: 11, masquer: ['BATIMENT0000000000969304'],
    },
    Q1143558: {   // Langeais
      construire: langeais, centre: [0.406145, 47.324707], orientation: 43, masquer: ['BATIMENT0000000322726174'],
    },
    Q1010268: {   // Saint-Sernin : la façade à l'ouest
      construire: saintSernin, centre: [1.441927, 43.608371], orientation: 32, masquer: ['BATIMENT0000000347907443'],
    },
    Q1514062: {   // Sainte-Clotilde
      construire: sainteClotilde, centre: [2.319222, 48.858371], orientation: 64, masquer: ['BATIMENT0000000241935818', 'BATIMENT0000000253246132', 'BATIMENT0000000253246135'],
    },
    Q656738: {   // Saint-André de Bordeaux : la façade à l'ouest, la tour Pey-Berland à l'est
      construire: bordeaux, centre: [-0.577805, 44.837704], orientation: 10, masquer: ['BATIMENT0000000248453643', 'BATIMENT0000000248453645', 'BATIMENT0000000248453646', 'BATIMENT0000000248453644'],
    },
    Q671066: {   // Metz : la façade au sud-ouest
      construire: metz, centre: [6.175623, 49.120222], orientation: 49, masquer: ['BATIMENT0000000316150594', 'BATIMENT0000000316150590', 'BATIMENT0000000316150589', 'BATIMENT0000000316150598', 'BATIMENT0000000316150597', 'BATIMENT0000002334268873', 'BATIMENT0000000316150588', 'BATIMENT0000000316149345', 'BATIMENT0000000316150591', 'BATIMENT0000000316150592', 'BATIMENT0000000316150593', 'BATIMENT0000000316150595', 'BATIMENT0000000316150596', 'BATIMENT0000000316149336', 'BATIMENT0000000316149346'],
    },
    Q1032205: {   // Clermont-Ferrand : les flèches à l'ouest
      construire: clermont, centre: [3.085777, 45.77871], orientation: -2, masquer: ['BATIMENT0000000313124174', 'BATIMENT0000000313124173', 'BATIMENT0000000313124172'],
    },
    Q1141846: {   // Cheverny
      construire: cheverny, centre: [1.458019, 47.500234], orientation: -11, masquer: ['BATIMENT0000000321834886'],
    },
    Q1333442: {   // le viaduc de Garabit (le long de la voie ferrée relevée sur la carte)
      construire: garabit, centre: [3.177416, 44.97474], orientation: -73.9, masquer: [],
    },
    Q774570: {   // l'Institut de France : la coupole face à la Seine
      construire: institut, centre: [2.336963, 48.85726], orientation: 15, masquer: ['BATIMENT0000000253248237', 'BATIMENT0000000241937973'],
    },
    Q427340: {   // Saint-Gervais : la façade à l'ouest
      construire: saintGervais, centre: [2.354731, 48.855509], orientation: -34, masquer: ['BATIMENT0000000253243449'],
    },
    Q522779: {   // Chaumont-sur-Loire : la cour ouverte sur la Loire
      construire: chaumont, centre: [1.181796, 47.479168], orientation: 9, masquer: ['BATIMENT0000000321780020'],
    },
    Q1142363: {   // Valençay
      construire: valencay, centre: [1.563487, 47.157533], orientation: 25, masquer: ['BATIMENT0000000324307683'],
    },
    Q1366553: {   // Sainte-Croix d'Orléans : la façade à l'ouest
      construire: orleans, centre: [1.910435, 47.901916], orientation: 8, masquer: ['BATIMENT0000000209801950', 'BATIMENT0000000209801949'],
    },
    Q489014: {   // Saint-Étienne de Sens : la façade à l'ouest
      construire: sens, centre: [3.284073, 48.198028], orientation: 6, masquer: ['BATIMENT0000002215628637', 'BATIMENT0000002215628638', 'BATIMENT0000002215628655', 'BATIMENT0000002215628657', 'BATIMENT0000002215628652'],
    },
    Q547013: {   // Saint-Gatien de Tours : la façade à l'ouest
      construire: cathedraleTours, centre: [0.69458, 47.395603], orientation: 16, masquer: ['BATIMENT0000000322893740', 'BATIMENT0000000322899542', 'BATIMENT0000000322893742', 'BATIMENT0000000322899543', 'BATIMENT0000000322893739', 'BATIMENT0000000322897298'],
    },
    Q1200500: {   // Notre-Dame-des-Doms : le clocher à l'ouest
      construire: notreDameDesDoms, centre: [4.8076, 43.951575], orientation: 2, masquer: ['BATIMENT0000000297746552', 'BATIMENT0000000297746551'],
    },
    Q1736213: {   // Saint-Front de Périgueux : le clocher à l'ouest
      construire: saintFront, centre: [0.722734, 45.183684], orientation: 9, masquer: ['BATIMENT0000000295375605', 'BATIMENT0000000295375609'],
    },
    Q1470842: {   // Sully-sur-Loire
      construire: sullySurLoire, centre: [2.375255, 47.767617], orientation: 23, masquer: ['BATIMENT0000000208850539'],
    },
    Q2189282: {   // Saint-Étienne de Limoges : le clocher à l'ouest
      construire: limoges, centre: [1.266615, 45.828929], orientation: 35, masquer: ['BATIMENT0000000224611271', 'BATIMENT0000000224611272'],
    },
    Q2942447: {   // Saint-Sacerdos de Sarlat : le clocher à l'ouest
      construire: sarlat, centre: [1.217206, 44.888837], orientation: 10, masquer: ['BATIMENT0000000295968644', 'BATIMENT0000000295968637', 'BATIMENT0000000295968643'],
    },
    Q932828: {   // Notre-Dame de Noyon : les tours à l'ouest
      construire: noyon, centre: [3.000757, 49.582029], orientation: -29, masquer: ['BATIMENT0000000317663579', 'BATIMENT0000000317663576', 'BATIMENT0000000317662830', 'BATIMENT0000000317663578', 'BATIMENT0000000317663577', 'BATIMENT0000000317661666', 'BATIMENT0000000317662828'],
    },
    Q956741: {   // Saint-Benoît-sur-Loire : la tour-porche à l'ouest
      construire: saintBenoit, centre: [2.305771, 47.809562], orientation: -18, masquer: ['BATIMENT0000000211064358', 'BATIMENT0000000211064377', 'BATIMENT0000000211064378'],
    },
    Q1011806: {   // le château de Foix, sur son rocher
      construire: foix, centre: [1.605, 42.9656], orientation: 0, masquer: ['BATIMENT0000002202577883', 'BATIMENT0000002202577933', 'BATIMENT0000002202577934'],
    },
    Q550157: {   // Saint-Augustin : la façade au nord-ouest, le dôme au sud-est
      construire: saintAugustin, centre: [2.318887, 48.876229], orientation: -65, masquer: ['BATIMENT0000000245200209'],
    },
    Q2351013: {   // le Capitole de Toulouse : la façade à l'est, sur la place
      construire: capitole, centre: [1.444266, 43.604474], orientation: 9, masquer: ['BATIMENT0000000347892901'],
    },
    Q1245463: {   // l'abbaye de Sénanque et son champ de lavande
      construire: senanque, centre: [5.18696, 43.928429], orientation: 67, masquer: ['BATIMENT0000000296685533', 'BATIMENT0000000296685537'],
    },
    Q1493222: {   // la cathédrale Saint-Alexandre-Nevsky
      construire: alexandreNevsky, centre: [2.301975, 48.877623], orientation: 40, masquer: ['BATIMENT0000000245164852'],
    },
    Q1563071: {   // Saint-Julien du Mans : le chœur à l'est, la nef à l'ouest
      construire: leMans, centre: [0.198968, 48.008974], orientation: 36, masquer: ['BATIMENT0000000215219749', 'BATIMENT0000000215217818', 'BATIMENT0000000215405007', 'BATIMENT0000000215217575', 'BATIMENT0000000215217574', 'BATIMENT0000000215217653', 'BATIMENT0000000215217651', 'BATIMENT0000000215217652'],
    },
    Q2300245: {   // Saint-Pierre de Montmartre
      construire: saintPierreMontmartre, centre: [2.342073, 48.886688], orientation: -4, masquer: ['BATIMENT0000000245181606', 'BATIMENT0000000245181605'],
    },
    Q786075: {   // le château de Brissac
      construire: brissac, centre: [-0.449942, 47.352848], orientation: 1, masquer: ['BATIMENT0000000313236351'],
    },
    Q1758497: {   // le Pont-Royal (berges relevées sur la carte)
      construire: pontRoyal, centre: [2.329939, 48.86009], orientation: -99.9, masquer: [],
    },
    Q586142: {   // la Sainte-Trinité : la façade et son clocher au sud
      construire: sainteTrinite, centre: [2.331366, 48.877353], orientation: 105, masquer: ['BATIMENT0000000245200597', 'BATIMENT0000000245200596'],
    },
    Q611944: {   // Saint-Lazare d'Autun
      construire: autun, centre: [4.299006, 46.945022], orientation: -60, masquer: ['BATIMENT0000000348852451'],
    },
    Q1289258: {   // le château des ducs de Bretagne
      construire: chateauDucsBretagne, centre: [-1.5491, 47.2161], orientation: -2, masquer: ['BATIMENT0000000302931883', 'BATIMENT0000000302931880', 'BATIMENT0000000302931881', 'BATIMENT0000000302931882', 'BATIMENT0000000302931884', 'BATIMENT0000000302930355', 'BATIMENT0000000302931878', 'BATIMENT0000000302931877', 'BATIMENT0000000302931879', 'BATIMENT0000000302931844'],
    },
    Q1011357: {   // Castelnaud, sur son rocher
      construire: castelnaud, centre: [1.148476, 44.815743], orientation: 33, masquer: ['BATIMENT0000000296740506'],
    },
    Q1711691: {   // Saint-Bénigne de Dijon : les tours à l'ouest
      construire: dijon, centre: [5.034423, 47.321481], orientation: -16, masquer: ['BATIMENT0000000217351211', 'BATIMENT0000000217351214', 'BATIMENT0000000217351215', 'BATIMENT0000000244652921', 'BATIMENT0000000217351212', 'BATIMENT0000000244652922'],
    },
    Q1736169: {   // Saint-Pierre d'Angoulême : la façade sculptée à l'ouest
      construire: angouleme, centre: [0.151591, 45.648986], orientation: -20, masquer: ['BATIMENT0000000319188907', 'BATIMENT0000000319187045'],
    },
    Q1788518: {   // Saint-Trophime d'Arles
      construire: saintTrophime, centre: [4.628118, 43.676633], orientation: 0, masquer: ['BATIMENT0000000267005179'],
    },
    Q473121: {   // la cathédrale de Narbonne : le chœur seul
      construire: narbonne, centre: [3.00396, 43.184814], orientation: -21, masquer: ['BATIMENT0000000350866547', 'BATIMENT0000000350866559', 'BATIMENT0000000350866548', 'BATIMENT0000000350865172', 'BATIMENT0000000350866558', 'BATIMENT0000000350865165', 'BATIMENT0000000350865175'],
    },
    Q181189: {   // les arènes d'Arles et leurs tours médiévales
      construire: arenesArles, centre: [4.630927, 43.677743], orientation: 92, masquer: ['BATIMENT0000000267007150'],
    },
    Q525891: {   // Saint-Merri
      construire: saintMerri, centre: [2.350898, 48.859108], orientation: -27, masquer: ['BATIMENT0000000245159757', 'BATIMENT0000000245157957'],
    },
    Q1710376: {   // Saint-Séverin
      construire: saintSeverin, centre: [2.345695, 48.852092], orientation: -20, masquer: ['BATIMENT0000000253243446', 'BATIMENT0000000309678765'],
    },
    Q2419151: {   // Saint-Corentin de Quimper
      construire: quimper, centre: [-4.102196, 47.995622], orientation: -6, masquer: ['BATIMENT0000000316695871', 'BATIMENT0000000316716367'],
    },
    Q2443243: {   // Saint-Pierre-et-Saint-Paul de Troyes
      construire: troyes, centre: [4.081354, 48.300344], orientation: 35, masquer: ['BATIMENT0000000297545140', 'BATIMENT0000000297545138', 'BATIMENT0000000297545139'],
    },
    Q2737833: {   // Saint-Étienne de Toulouse
      construire: saintEtienneToulouse, centre: [1.4504, 43.5999], orientation: 7, masquer: ['BATIMENT0000000347894204', 'BATIMENT0000000347894201', 'BATIMENT0000000347894203', 'BATIMENT0000000347894202', 'BATIMENT0000000347894200', 'BATIMENT0000000347892720'],
    },
    Q1436962: {   // Saint-Roch (la façade au sud, sur la rue Saint-Honoré)
      construire: saintRoch, centre: [2.332583, 48.865308], orientation: 56, masquer: ['BATIMENT0000000253245851', 'BATIMENT0000000253245849', 'BATIMENT0000000253245824', 'BATIMENT0000000245160125', 'BATIMENT0000000245182307'],
    },
    Q1710383: {   // Saint-Vincent-de-Paul (la façade au sud, sur la terrasse)
      construire: saintVincentDePaul, centre: [2.351843, 48.878981], orientation: 90, masquer: ['BATIMENT0000000245196700', 'BATIMENT0000000245196699', 'BATIMENT0000000245196698'],
    },
    Q950217: {   // la porte Saint-Martin
      construire: porteSaintMartin, centre: [2.355655, 48.86915], orientation: -18, masquer: ['BATIMENT0000000245193419', 'BATIMENT0000000245193434', 'BATIMENT0000000356564156', 'BATIMENT0000000245193435', 'BATIMENT0000000245193427'],
    },
    Q939883: {   // la Salpêtrière : sa chapelle Saint-Louis (le lieu est au milieu de l'hôpital)
      construire: salpetriere, centre: [2.364141, 48.838944], orientation: 25, masquer: ['BATIMENT0000000241933019'],
    },
    Q1141086: {   // la synagogue de Besançon
      construire: synagogueBesancon, centre: [6.021443, 47.241321], orientation: -33, masquer: ['BATIMENT0000000317677720'],
    },
    Q912447: {   // la forteresse de Chinon (enceinte tracée d'après les tours de l'IGN)
      construire: chinon, centre: [0.2361, 47.1681], orientation: 0, masquer: ['BATIMENT0000000031307840', 'BATIMENT0000000031307838', 'BATIMENT0000000031307809', 'BATIMENT0000000322702495', 'BATIMENT0000000322702548', 'BATIMENT0000000322702318', 'BATIMENT0000000289906082'],
    },
    Q576534: {   // le château de Coucy
      construire: coucy, centre: [3.3186, 49.5217], orientation: 0, masquer: ['BATIMENT0000000063832064', 'BATIMENT0000000063832092', 'BATIMENT0000000063832049', 'BATIMENT0000000063832061'],
    },
    Q1243760: {   // Saint-Julien-le-Pauvre
      construire: saintJulienLePauvre, centre: [2.347122, 48.852044], orientation: -30, masquer: ['BATIMENT0000000241938896'],
    },
    Q993659: {   // le baptistère Saint-Jean de Poitiers
      construire: baptistere, centre: [0.348591, 46.579481], orientation: -22, masquer: ['BATIMENT0000000273318642'],
    },
    Q1011026: {   // le château de Beynac (l'enceinte de l'IGN reste)
      construire: beynac, centre: [1.1453, 44.8403], orientation: 13, masquer: ['BATIMENT0000000296741413'],
    },
    Q1480604: {   // le château de Pau
      construire: pau, centre: [-0.375, 43.2947], orientation: -23, masquer: ['BATIMENT0000000332391537', 'BATIMENT0000000332406674', 'BATIMENT0000000332406675', 'BATIMENT0000000332406100', 'BATIMENT0000000332406676', 'BATIMENT0000000332406677'],
    },
    Q1577630: {   // Saint-Nicolas-du-Chardonnet (le chevet au nord-est)
      construire: saintNicolasChardonnet, centre: [2.35036, 48.849179], orientation: 62, masquer: ['BATIMENT0000000241938931', 'BATIMENT0000000241938954', 'BATIMENT0000000241938932'],
    },
    Q376932: {   // l'abbaye aux Hommes : l'abbatiale Saint-Étienne (les bâtiments de l'abbaye restent ceux de l'IGN)
      construire: abbayeAuxHommes, centre: [-0.3728, 49.181836], orientation: 0, masquer: ['BATIMENT0000000201384616'],
    },
    Q3129160: {   // Saint-Michel d'Aiguilhe, sur son rocher
      construire: aiguilhe, centre: [3.882492, 45.050009], orientation: -31, masquer: ['BATIMENT0000000353221335'],
    },
    Q1049348: {   // Sainte-Marie d'Auch
      construire: auch, centre: [0.585795, 43.646297], orientation: -2, masquer: ['BATIMENT0000000309973335', 'BATIMENT0000000309978729', 'BATIMENT0000000309973334', 'BATIMENT0000000309973333'],
    },
    Q1049728: {   // Saint-Pierre de Rennes
      construire: rennes, centre: [-1.683318, 48.111583], orientation: -6, masquer: ['BATIMENT0000000297119600', 'BATIMENT0000000297119599'],
    },
    Q1191209: {   // Saint-Maurice d'Angers
      construire: cathedraleAngers, centre: [-0.555, 47.4706], orientation: -44, masquer: ['BATIMENT0000000313198113', 'BATIMENT0000000313198110', 'BATIMENT0000000313198130', 'BATIMENT0000002500581187', 'BATIMENT0000000313197531', 'BATIMENT0000000313198111', 'BATIMENT0000000313197530'],
    },
    Q963509: {   // le pont Marie
      construire: pontMarie, centre: [2.357432, 48.852872], orientation: 61.7, masquer: [],
    },
    Q2111621: {   // le palais des ducs de Bourgogne et la tour Philippe le Bon
      construire: palaisDucsBourgogne, centre: [5.0414, 47.3219], orientation: -16, masquer: ['BATIMENT0000000217356101', 'BATIMENT0000000217356102', 'BATIMENT0000000217354958', 'BATIMENT0000000217354959'],
    },
    Q1102200: {   // Saint-Louis de Blois
      construire: cathedraleBlois, centre: [1.336514, 47.588485], orientation: 32, masquer: ['BATIMENT0000000321418808', 'BATIMENT0000000321418807'],
    },
    Q919028: {   // Saint-Pierre de Vannes
      construire: cathedraleVannes, centre: [-2.756946, 47.657839], orientation: 39, masquer: ['BATIMENT0000000290122326', 'BATIMENT0000000290123021'],
    },
    Q1481233: {   // Saint-Pierre de Poitiers
      construire: cathedralePoitiers, centre: [0.349214, 46.580383], orientation: -27, masquer: ['BATIMENT0000000273325958', 'BATIMENT0000000273325957', 'BATIMENT0000000273321349', 'BATIMENT0000000273324013', 'BATIMENT0000000273324016'],
    },
    Q1736197: {   // Saint-Pierre de Montpellier (la façade et son porche au sud-est)
      construire: cathedraleMontpellier, centre: [3.874048, 43.613398], orientation: 103, masquer: ['BATIMENT0000000211124095', 'BATIMENT0000000211124093', 'BATIMENT0000000211124094'],
    },
    Q1736223: {   // Saint-Gervais-et-Saint-Protais de Soissons
      construire: cathedraleSoissons, centre: [3.325197, 49.380863], orientation: 2, masquer: ['BATIMENT0000000311950733', 'BATIMENT0000000311950732'],
    },
    Q2124804: {   // Saint-Louis de Versailles (la façade au nord-ouest)
      construire: cathedraleVersailles, centre: [2.124275, 48.798279], orientation: -113, masquer: ['BATIMENT0000000322532197', 'BATIMENT0000000322532196', 'BATIMENT0000000322532195', 'BATIMENT0000000322532198'],
    },
    Q2601262: {   // l'église du Val-de-Grâce
      construire: valDeGrace, centre: [2.3419, 48.8406], orientation: -23, masquer: ['BATIMENT0000000241930745', 'BATIMENT0000000253232423', 'BATIMENT0000000253232421'],
    },
    Q2887024: {   // Saint-Michel de Bordeaux et sa flèche
      construire: saintMichelBordeaux, centre: [-0.5649, 44.8344], orientation: -6, masquer: ['BATIMENT0000000257641373', 'BATIMENT0000000257641437'],
    },
    Q2942292: {   // Notre-Dame de Rodez
      construire: cathedraleRodez, centre: [2.5741, 44.3508], orientation: -20, masquer: ['BATIMENT0000000257245964', 'BATIMENT0000000257245963', 'BATIMENT0000000257245962', 'BATIMENT0000000257026515'],
    },
    Q782969: {   // Notre-Dame-des-Victoires (la façade au sud, sur la place des Petits-Pères)
      construire: notreDameDesVictoires, centre: [2.340959, 48.866784], orientation: 75, masquer: ['BATIMENT0000000253245846', 'BATIMENT0000000245182592'],
    },
    Q1358886: {   // la grande synagogue de la Victoire
      construire: grandeSynagogue, centre: [2.336394, 48.875487], orientation: -2, masquer: ['BATIMENT0000000245192027', 'BATIMENT0000000245192028'],
    },
    Q1435791: {   // la fontaine des Innocents (sur la place, pas de bâtiment de l'IGN)
      construire: fontaineInnocents, centre: [2.348, 48.8606], orientation: -17, masquer: [],
    },
    Q1247969: {   // Saint-Paul-Saint-Louis (la façade au nord, sur la rue Saint-Antoine)
      construire: saintPaulSaintLouis, centre: [2.361416, 48.854596], orientation: -114, masquer: ['BATIMENT0000000245197929', 'BATIMENT0000000245197928'],
    },
    Q1710369: {   // Notre-Dame-de-Lorette (la façade au sud)
      construire: notreDameDeLorette, centre: [2.338934, 48.876441], orientation: 76, masquer: ['BATIMENT0000000245190217'],
    },
    Q1581356: {   // Saint-Jean de Montmartre
      construire: saintJeanMontmartre, centre: [2.337897, 48.884212], orientation: 41, masquer: ['BATIMENT0000000245181401', 'BATIMENT0000002496154652', 'BATIMENT0000000245181595'],
    },
    Q1736217: {   // Notre-Dame de Senlis
      construire: cathedraleSenlis, centre: [2.586068, 49.206786], orientation: -24, masquer: ['BATIMENT0000000318167741'],
    },
    Q586471: {   // Saint-Étienne de Meaux
      construire: cathedraleMeaux, centre: [2.878905, 48.960172], orientation: -1, masquer: ['BATIMENT0000000336685102', 'BATIMENT0000000336685101', 'BATIMENT0000000336685106', 'BATIMENT0000000336685100', 'BATIMENT0000000336685104', 'BATIMENT0000000336685105', 'BATIMENT0000000336685107'],
    },
    Q670092: {   // Sainte-Foy de Conques
      construire: conques, centre: [2.397888, 44.599233], orientation: -7, masquer: ['BATIMENT0000000340007392', 'BATIMENT0000000340007391'],
    },
    Q1754399: {   // l'abbaye aux Dames : l'église de la Trinité (la façade au nord-ouest)
      construire: abbayeAuxDames, centre: [-0.352864, 49.186351], orientation: -45.6, masquer: ['BATIMENT0000000201387669', 'BATIMENT0000000201387668'],
    },
    Q1815544: {   // le château de Châteaudun
      construire: chateaudun, centre: [1.3236, 48.0706], orientation: 2, masquer: ['BATIMENT0000000015740605', 'BATIMENT0000000224743632'],
    },
    Q1374604: {   // l'hôtel de Sens
      construire: hotelDeSens, centre: [2.3592, 48.8533], orientation: 21, masquer: ['BATIMENT0000000245184591'],
    },
    Q1643144: {   // l'hôtel de Sully
      construire: hotelDeSully, centre: [2.3638, 48.8546], orientation: -24, masquer: ['BATIMENT0000000245197410', 'BATIMENT0000000245197411', 'BATIMENT0000000245197681', 'BATIMENT0000000245197701', 'BATIMENT0000000245197693', 'BATIMENT0000000245197692', 'BATIMENT0000000245197683'],
    },
    Q2887040: {   // Saint-Urbain de Troyes
      construire: saintUrbain, centre: [4.076597, 48.298195], orientation: 36, masquer: ['BATIMENT0000000297537902', 'BATIMENT0000000297537901', 'BATIMENT0000000297537900', 'BATIMENT0000000297535631', 'BATIMENT0000000297535630', 'BATIMENT0000000297535632', 'BATIMENT0000000297535633', 'BATIMENT0000000297535634'],
    },
    Q1062732: {   // la chapelle expiatoire
      construire: chapelleExpiatoire, centre: [2.3228, 48.8737], orientation: 4, masquer: ['BATIMENT0000000000157258', 'BATIMENT0000000000157259'],
    },
    Q1468594: {   // Notre-Dame de Coutances
      construire: cathedraleCoutances, centre: [-1.444153, 49.047609], orientation: -16, masquer: ['BATIMENT0000000301463677'],
    },
    Q1518999: {   // Saint-Étienne d'Auxerre
      construire: cathedraleAuxerre, centre: [3.572908, 47.797873], orientation: 12, masquer: ['BATIMENT0000002215566817', 'BATIMENT0000002215566813', 'BATIMENT0000002215566815', 'BATIMENT0000002215566814', 'BATIMENT0000002215566812', 'BATIMENT0000002215566816'],
    },
    Q1589963: {   // Saint-Ouen de Rouen
      construire: saintOuen, centre: [1.099712, 49.442549], orientation: -9, masquer: ['BATIMENT0000000240188949', 'BATIMENT0000000240186977', 'BATIMENT0000000240189000', 'BATIMENT0000000240188948'],
    },
    Q1736171: {   // Sainte-Marie de Bayonne
      construire: cathedraleBayonne, centre: [-1.477212, 43.490577], orientation: -21, masquer: ['BATIMENT0000000332688582', 'BATIMENT0000000332688584', 'BATIMENT0000000332688583'],
    },
    Q1736174: {   // Saint-Nazaire de Béziers
      construire: cathedraleBeziers, centre: [3.210021, 43.341526], orientation: -7, masquer: ['BATIMENT0000000208588216', 'BATIMENT0000000208588214', 'BATIMENT0000000208588215'],
    },
    Q571282: {   // Saint-Cyr-et-Sainte-Julitte de Nevers
      construire: cathedraleNevers, centre: [3.157298, 46.987191], orientation: 29, masquer: ['BATIMENT0000000320527848'],
    },
    Q1351690: {   // Saint-Étienne de Toul
      construire: cathedraleToul, centre: [5.894456, 48.675367], orientation: -29, masquer: ['BATIMENT0000000334757519', 'BATIMENT0000000334757499', 'BATIMENT0000000334757496', 'BATIMENT0000000334757492', 'BATIMENT0000000334757493', 'BATIMENT0000000334757494', 'BATIMENT0000000334757497', 'BATIMENT0000000334757509'],
    },
    Q1284848: {   // les Hospices de Beaune
      construire: hospicesBeaune, centre: [4.8367, 47.0219], orientation: 28, masquer: ['BATIMENT0000000217079260'],
    },
    Q761920: {   // le château de Gien
      construire: gien, centre: [2.6319, 47.6847], orientation: -31, masquer: ['BATIMENT0000000213598576'],
    },
    Q1011692: {   // le château de Falaise (le lieu est en contrebas, le château sur son rocher)
      construire: falaise, centre: [-0.2039, 48.8932], orientation: 21, masquer: ['BATIMENT0000000201289539', 'BATIMENT0000000201289540'],
    },
    Q705054: {   // l'ossuaire de Douaumont
      construire: ossuaireDouaumont, centre: [5.4237, 49.2083], orientation: 35, masquer: ['BATIMENT0000002271949028'],
    },
    Q1785858: {   // Saint-Thomas de Strasbourg
      construire: saintThomasStrasbourg, centre: [7.7453, 48.5797], orientation: 1, masquer: ['BATIMENT0000002223284743'],
    },
    Q1816823: {   // le pont Valentré
      construire: pontValentre, centre: [1.431684, 44.445057], orientation: 17.3, masquer: ['BATIMENT0000002004418725', 'BATIMENT0000002004418724', 'BATIMENT0000002004418726'],
    },
    Q588555: {   // l'église Saint-Joseph du Havre
      construire: saintJosephHavre, centre: [0.101167, 49.490979], orientation: -4, masquer: ['BATIMENT0000000239665188', 'BATIMENT0000000239665187', 'BATIMENT0000000239665189', 'BATIMENT0000000239665190'],
    },
    Q2561040: {   // le mémorial de Vimy
      construire: memorialVimy, centre: [2.7736, 50.3794], orientation: 0, masquer: ['BATIMENT0000000292662501'],
    },
    Q939114: {   // Notre-Dame-la-Grande de Poitiers
      construire: notreDameLaGrande, centre: [0.344048, 46.583225], orientation: -32, masquer: ['BATIMENT0000000273320192'],
    },
    Q1537302: {   // Notre-Dame du Puy-en-Velay
      construire: cathedralePuy, centre: [3.8848, 45.0456], orientation: 1, masquer: ['BATIMENT0000000353317496', 'BATIMENT0000000353317467'],
    },
    Q2640697: {   // Saint-Maclou de Rouen
      construire: saintMaclou, centre: [1.098298, 49.439791], orientation: -8, masquer: ['BATIMENT0000000240188953', 'BATIMENT0000000240188954'],
    },
    Q2759640: {   // le couvent des Jacobins de Toulouse
      construire: jacobins, centre: [1.4402, 43.6039], orientation: 9, masquer: ['BATIMENT0000000347888822', 'BATIMENT0000000347894234', 'BATIMENT0000000347894235', 'BATIMENT0000000347894309'],
    },
    Q847628: {   // Saint-Étienne de Cahors
      construire: cathedraleCahors, centre: [1.4431, 44.4472], orientation: 10, masquer: ['BATIMENT0000000291402937', 'BATIMENT0000000291402931', 'BATIMENT0000000291402936'],
    },
    Q623540: {   // le phare d'Ar-Men, en pleine mer
      construire: pharArMen, centre: [-4.9972, 48.0503], orientation: 0, masquer: [],
    },
    Q2418225: {   // le château de Vitré
      construire: vitre, centre: [-1.2153, 48.1244], orientation: 9, masquer: ['BATIMENT0000002101264821', 'BATIMENT0000002101264822'],
    },
    Q810098: {   // la basilique Sainte-Thérèse de Lisieux
      construire: basiliqueLisieux, centre: [0.2366, 49.1396], orientation: 15, masquer: ['BATIMENT0000000201310488', 'BATIMENT0000000246759938', 'BATIMENT0000000201310482'],
    },
    Q1229917: {   // le palais de la Légion d'honneur (la rotonde au nord, sur la Seine)
      construire: palaisLegionHonneur, centre: [2.3244, 48.8604], orientation: -26, masquer: ['BATIMENT0000000241935750', 'BATIMENT0000000241935039'],
    },
    Q1541186: {   // le Grand-Théâtre de Bordeaux
      construire: grandTheatreBordeaux, centre: [-0.5736, 44.8425], orientation: 6, masquer: ['BATIMENT0000000248396296'],
    },
    Q2205594: {   // la cathédrale orthodoxe Saint-Nicolas de Nice
      construire: cathedraleRusseNice, centre: [7.2539, 43.7039], orientation: 31, masquer: ['BATIMENT0000000327865950'],
    },
    Q1561438: {   // le palais Rohan de Strasbourg
      construire: palaisRohan, centre: [7.752, 48.581], orientation: 34, masquer: ['BATIMENT0000002223297389'],
    },
    Q516: {   // l'hôtel de ville de Lyon
      construire: hotelDeVilleLyon, centre: [4.835, 45.7678], orientation: 7, masquer: ['BATIMENT0000000240880562', 'BATIMENT0000000240880563', 'BATIMENT0000000240880561', 'BATIMENT0000000240879453', 'BATIMENT0000000240879699'],
    },
    Q1488512: {   // Saint-Nicolas-des-Champs
      construire: saintNicolasDesChamps, centre: [2.354179, 48.865462], orientation: -20, masquer: ['BATIMENT0000000245159521'],
    },
    Q1902867: {   // le couvent de La Tourette
      construire: laTourette, centre: [4.6225, 45.8194], orientation: -18, masquer: ['BATIMENT0000000239130105', 'BATIMENT0000000239130111', 'BATIMENT0000000239130092', 'BATIMENT0000000239130095'],
    },
    Q597090: {   // Notre-Dame-et-Saint-Vaast d'Arras
      construire: cathedraleArras, centre: [2.7747, 50.2931], orientation: -36, masquer: ['BATIMENT0000000292593357'],
    },
    Q2918846: {   // Notre-Dame d'Évreux
      construire: cathedraleEvreux, centre: [1.150809, 49.024178], orientation: 16, masquer: ['BATIMENT0000000338589429', 'BATIMENT0000000338589421', 'BATIMENT0000000338589422'],
    },
    Q2942355: {   // Saint-Jean-Baptiste de Perpignan
      construire: cathedralePerpignan, centre: [2.8969, 42.7006], orientation: 27, masquer: ['BATIMENT0000000340646240', 'BATIMENT0000000340646184', 'BATIMENT0000000340646185', 'BATIMENT0000000340646188', 'BATIMENT0000000340646183'],
    },
    Q63504: {   // Notre-Dame-de-l'Annonciation de Moulins
      construire: cathedraleMoulins, centre: [3.331672, 46.566741], orientation: 25, masquer: ['BATIMENT0000002201532422', 'BATIMENT0000002201532407', 'BATIMENT0000002201531211'],
    },
    Q1165266: {   // Saint-Mammès de Langres
      construire: cathedraleLangres, centre: [5.335293, 47.864245], orientation: 6, masquer: ['BATIMENT0000000225066986', 'BATIMENT0000000225066983', 'BATIMENT0000000225066985', 'BATIMENT0000000225066984'],
    },
    Q1339429: {   // la basilique de Saint-Quentin
      construire: basiliqueSaintQuentin, centre: [3.29, 49.8478], orientation: 17, masquer: ['BATIMENT0000000312102659', 'BATIMENT0000000312102658', 'BATIMENT0000000312099286'],
    },
    Q1136951: {   // Notre-Dame-de-l'Annonciation de Nancy (la façade au nord)
      construire: cathedraleNancy, centre: [6.186066, 48.691235], orientation: -65, masquer: ['BATIMENT0000000334795176', 'BATIMENT0000000334795175', 'BATIMENT0000000334795174'],
    },
    Q584590: {   // Saint-Pierre de Lisieux
      construire: cathedraleLisieux, centre: [0.226887, 49.146535], orientation: 14, masquer: ['BATIMENT0000000201313260', 'BATIMENT0000000201313259'],
    },
    Q2942243: {   // Notre-Dame-de-l'Assomption de Montauban
      construire: cathedraleMontauban, centre: [1.355351, 44.015414], orientation: -18, masquer: ['BATIMENT0000000294527422', 'BATIMENT0000000294527419', 'BATIMENT0000000294527420', 'BATIMENT0000000294527421'],
    },
    Q2942319: {   // Saint-Caprais d'Agen
      construire: cathedraleAgen, centre: [0.619204, 44.20679], orientation: -2, masquer: ['BATIMENT0000000329934676'],
    },
    Q1344947: {   // Notre-Dame-de-Grâce de Cambrai
      construire: cathedraleCambrai, centre: [3.233306, 50.172146], orientation: 4, masquer: ['BATIMENT0000000289166167', 'BATIMENT0000000289166162', 'BATIMENT0000000289165642'],
    },
    Q787927: {   // Saint-Étienne de Saint-Brieuc
      construire: cathedraleSaintBrieuc, centre: [-2.764192, 48.514236], orientation: -9, masquer: ['BATIMENT0000000289295262', 'BATIMENT0000000289295263'],
    },
    Q907505: {   // Notre-Dame de Sées
      construire: cathedraleSees, centre: [0.172606, 48.605318], orientation: -12, masquer: ['BATIMENT0000000349870205', 'BATIMENT0000000349870188'],
    },
    Q2385003: {   // Saint-Vincent de Saint-Malo
      construire: cathedraleSaintMalo, centre: [-2.025588, 48.649515], orientation: -4, masquer: ['BATIMENT0000000298031438', 'BATIMENT0000000298031768', 'BATIMENT0000000298031437', 'BATIMENT0000000298031769', 'BATIMENT0000000298031441', 'BATIMENT0000000298031440'],
    },
    Q2561189: {   // Saint-Étienne d'Agde
      construire: cathedraleAgde, centre: [3.4692, 43.3139], orientation: 40, masquer: ['BATIMENT0000000207683895', 'BATIMENT0000000207683897', 'BATIMENT0000000207683898', 'BATIMENT0000000207683896', 'BATIMENT0000000207683900'],
    },
    Q456181: {   // Saint-Philibert de Tournus
      construire: tournus, centre: [4.908968, 46.565826], orientation: 22, masquer: ['BATIMENT0000000348952521', 'BATIMENT0000000348952520'],
    },
    Q2080602: {   // Saint-Pierre de Caen (la façade au nord-ouest)
      construire: saintPierreCaen, centre: [-0.360768, 49.184015], orientation: -50, masquer: ['BATIMENT0000000204700689'],
    },
    Q2698691: {   // le musée d'Orsay (la façade et ses horloges au nord, sur la Seine)
      construire: orsay, centre: [2.326586, 48.859919], orientation: -25, masquer: ['BATIMENT0000000241935505', 'BATIMENT0000000241935507'],
    },
    Q1861419: {   // le mémorial de Thiepval
      construire: memorialThiepval, centre: [2.685674, 50.050565], orientation: 0, masquer: ['BATIMENT0000000088423747'],
    },
    Q3116957: {   // le Gros-Horloge de Rouen
      construire: grosHorloge, centre: [1.0912, 49.4416], orientation: -27, masquer: ['BATIMENT0000000240184163', 'BATIMENT0000000240184162', 'BATIMENT0000000240184184'],
    },
    Q753011: {   // la porte des Allemands de Metz
      construire: porteDesAllemands, centre: [6.1856, 49.1178], orientation: 13, masquer: ['BATIMENT0000002331775610', 'BATIMENT0000000316154059', 'BATIMENT0000002331775612', 'BATIMENT0000000316154060', 'BATIMENT0000000348279597', 'BATIMENT0000002331775613', 'BATIMENT0000000348279598', 'BATIMENT0000000348279596', 'BATIMENT0000000316153655', 'BATIMENT0000000316153656', 'BATIMENT0000000316153657', 'BATIMENT0000000316153658', 'BATIMENT0000000316153659', 'BATIMENT0000000316153660', 'BATIMENT0000002331775611'],
    },
    Q740250: {   // le château de Tarascon
      construire: tarascon, centre: [4.655, 43.8066], orientation: -19, masquer: ['BATIMENT0000000274302540', 'BATIMENT0000000274302542', 'BATIMENT0000000274302536', 'BATIMENT0000000274302531', 'BATIMENT0000000274302537', 'BATIMENT0000000274302543', 'BATIMENT0000000274302530', 'BATIMENT0000000274302538', 'BATIMENT0000000274302544', 'BATIMENT0000000274302541', 'BATIMENT0000000274302539'],
    },
    Q371069: {   // la forteresse de Salses
      construire: salses, centre: [2.9183, 42.8397], orientation: -14, masquer: ['BATIMENT0000000340343020', 'BATIMENT0000000340343088', 'BATIMENT0000000340343087', 'BATIMENT0000000340343026'],
    },
    Q1451798: {   // le château de Josselin
      construire: josselin, centre: [-2.5475, 47.9524], orientation: -43, masquer: ['BATIMENT0000000290139028', 'BATIMENT0000000290139026'],
    },
    Q1392601: {   // le château de Hautefort
      construire: hautefort, centre: [1.145, 45.2596], orientation: -31, masquer: ['BATIMENT0000000295961887'],
    },
    Q2259452: {   // le château d'Annecy
      construire: chateauAnnecy, centre: [6.1261, 45.8975], orientation: 13, masquer: ['BATIMENT0000000301121536', 'BATIMENT0000000301121537', 'BATIMENT0000000301121541', 'BATIMENT0000000301121535'],
    },
    Q747306: {   // le fort la Latte
      construire: fortLaLatte, centre: [-2.2844, 48.6683], orientation: 43, masquer: ['BATIMENT0000000289055591', 'BATIMENT0000002202883983'],
    },
    Q2942383: {   // Saint-Louis de La Rochelle (la façade au nord)
      construire: cathedraleLaRochelle, centre: [-1.153358, 46.161363], orientation: -104, masquer: ['BATIMENT0000000293005910', 'BATIMENT0000000293005909', 'BATIMENT0000000293005911'],
    },
    Q1410336: {   // Saint-Maurice de Vienne
      construire: cathedraleVienne, centre: [4.8731, 45.524193], orientation: 2, masquer: ['BATIMENT0000000302566420', 'BATIMENT0000000302566419'],
    },
    Q1504491: {   // Saint-Paul de Strasbourg (la façade au sud-ouest)
      construire: saintPaulStrasbourg, centre: [7.759841, 48.586323], orientation: 68, masquer: ['BATIMENT0000002223299576'],
    },
    Q1581390: {   // la collégiale Saint-Martin de Colmar
      construire: collegialeColmar, centre: [7.358359, 48.077281], orientation: -26, masquer: ['BATIMENT0000000229583047'],
    },
    Q1807058: {   // Notre-Dame de Dijon
      construire: notreDameDijon, centre: [5.041494, 47.322686], orientation: -16, masquer: ['BATIMENT0000000217356154'],
    },
    Q745084: {   // la Trinité de Vendôme et son clocher isolé
      construire: triniteVendome, centre: [1.069016, 47.791256], orientation: -11, masquer: ['BATIMENT0000000321811598', 'BATIMENT0000000321811080'],
    },
    Q2942293: {   // Notre-Dame de Verdun
      construire: cathedraleVerdun, centre: [5.382312, 49.159484], orientation: 26, masquer: ['BATIMENT0000002266668312'],
    },
    Q2887149: {   // la basilique de Saint-Nicolas-de-Port
      construire: saintNicolasDePort, centre: [6.303875, 48.631678], orientation: -37, masquer: ['BATIMENT0000000335283737', 'BATIMENT0000000335283733', 'BATIMENT0000000335283732', 'BATIMENT0000000335283738', 'BATIMENT0000000335283734', 'BATIMENT0000000335283730', 'BATIMENT0000000335283731', 'BATIMENT0000000335283729', 'BATIMENT0000000335283735', 'BATIMENT0000000335283736', 'BATIMENT0000000335283553', 'BATIMENT0000000335283554'],
    },
    Q2206135: {   // le château de Bonaguil
      construire: bonaguil, centre: [1.0143, 44.5381], orientation: 29, masquer: ['BATIMENT0000000092708435'],
    },
    Q654569: {   // le château de Montreuil-Bellay
      construire: montreuilBellay, centre: [-0.155, 47.1331], orientation: 41, masquer: ['BATIMENT0000000313888479', 'BATIMENT0000000313888474', 'BATIMENT0000000313888480', 'BATIMENT0000000313888478', 'BATIMENT0000000313888481', 'BATIMENT0000000313888477'],
    },
    Q1436883: {   // le château de Maintenon
      construire: maintenon, centre: [1.5783, 48.5854], orientation: 16, masquer: ['BATIMENT0000000335351067'],
    },
    Q1579344: {   // le château de Sceaux
      construire: chateauSceaux, centre: [2.3, 48.7744], orientation: 14, masquer: ['BATIMENT0000000240226633'],
    },
    Q1383413: {   // le temple du Marais
      construire: templeMarais, centre: [2.3662, 48.8533], orientation: -16, masquer: ['BATIMENT0000000245197918', 'BATIMENT0000000245197917'],
    },
    Q1510: {   // le théâtre antique de Lyon (la scène à l'est)
      construire: theatreLyon, centre: [4.819855, 45.75975], orientation: 180, masquer: ['BATIMENT0000000013381386'],
    },
    Q2968752: {   // le château de Caen (l'enceinte d'après les murs de l'IGN)
      construire: chateauCaen, centre: [-0.3628, 49.1864], orientation: 0, masquer: [],
    },
    Q312445: {   // le château de Dinan
      construire: chateauDinan, centre: [-2.0449, 48.4503], orientation: -19, masquer: ['BATIMENT0000002490285177', 'BATIMENT0000002490285178'],
    },
    Q2032524: {   // le château d'Anet
      construire: anet, centre: [1.4386, 48.8583], orientation: 6, masquer: ['BATIMENT0000000335649373', 'BATIMENT0000000335649372', 'BATIMENT0000000335648992', 'BATIMENT0000000335649102'],
    },
    Q1817122: {   // le château d'Écouen
      construire: ecouen, centre: [2.3783, 49.0175], orientation: -10, masquer: ['BATIMENT0000002100143268'],
    },
    Q334208: {   // l'abbaye Saint-Pierre de Moissac et son cloître
      construire: moissac, centre: [1.0847, 44.1056], orientation: 8, masquer: ['BATIMENT0000000294623143', 'BATIMENT0000000294623142'],
    },
    Q2437680: {   // Notre-Dame-de-l'Assomption d'Ajaccio
      construire: cathedraleAjaccio, centre: [8.738, 41.9175], orientation: 33, masquer: ['BATIMENT0000000331856597', 'BATIMENT0000000331856596', 'BATIMENT0000000331856598', 'BATIMENT0000000331856602'],
    },
    Q2942437: {   // Saint-Pierre de Saintes
      construire: cathedraleSaintes, centre: [-0.631875, 45.744476], orientation: -13, masquer: ['BATIMENT0000000294420010', 'BATIMENT0000000294420008'],
    },
    Q117210: {   // l'arc de Germanicus
      construire: arcGermanicus, centre: [-0.629, 45.7459], orientation: 1, masquer: ['BATIMENT0000000032709080'],
    },
    Q2942348: {   // Saint-Jean-Baptiste de Bazas
      construire: cathedraleBazas, centre: [-0.209701, 44.431431], orientation: 1, masquer: ['BATIMENT0000000257081246', 'BATIMENT0000000257081245'],
    },
    Q1084011: {   // Sainte-Réparate de Nice
      construire: sainteReparate, centre: [7.2758, 43.6972], orientation: -5, masquer: ['BATIMENT0000000328074137', 'BATIMENT0000000328075177'],
    },
    Q1736175: {   // Saint-Michel de Carcassonne
      construire: saintMichelCarcassonne, centre: [2.3512, 43.211], orientation: 2, masquer: ['BATIMENT0000000351170368', 'BATIMENT0000000351170367'],
    },
    Q1539168: {   // Saint-Sauveur d'Aix-en-Provence
      construire: cathedraleAix, centre: [5.4472, 43.5319], orientation: 24, masquer: ['BATIMENT0000000258073724', 'BATIMENT0000000258073708', 'BATIMENT0000000258073709', 'BATIMENT0000000258073711'],
    },
    Q2092716: {   // le château de Maisons
      construire: chateauMaisons, centre: [2.1538, 48.9472], orientation: -39, masquer: ['BATIMENT0000000322461733'],
    },
    Q1377160: {   // le château du Plessis-Bourré
      construire: plessisBourre, centre: [-0.5444, 47.601], orientation: -2, masquer: ['BATIMENT0000000313342706'],
    },
    Q1479356: {   // le château de Talcy
      construire: talcy, centre: [1.4444, 47.7697], orientation: 10, masquer: ['BATIMENT0000000321386691', 'BATIMENT0000000321386788', 'BATIMENT0000000321386626', 'BATIMENT0000000321386627', 'BATIMENT0000000321386789'],
    },
    Q2060046: {   // le château de Roquetaillade
      construire: roquetaillade, centre: [-0.2698, 44.4926], orientation: -27, masquer: ['BATIMENT0000000255227599'],
    },
    Q2093924: {   // le château d'Abbadia
      construire: abbadia, centre: [-1.7492, 43.3775], orientation: 1, masquer: ['BATIMENT0000002480408128', 'BATIMENT0000002480408129'],
    },
    Q1858504: {   // l'abbaye Saint-Victor de Marseille
      construire: saintVictor, centre: [5.3656, 43.2903], orientation: 9, masquer: ['BATIMENT0000000273403293'],
    },
    Q2887166: {   // la basilique de la Daurade
      construire: daurade, centre: [1.4399, 43.601], orientation: 38, masquer: ['BATIMENT0000000347888821'],
    },
    Q1316358: {   // la grande synagogue de Bordeaux
      construire: synagogueBordeaux, centre: [-0.5739, 44.8336], orientation: 1, masquer: ['BATIMENT0000000257671749'],
    },
    Q2887041: {   // la basilique Saint-Seurin de Bordeaux
      construire: saintSeurin, centre: [-0.585694, 44.843173], orientation: 9, masquer: ['BATIMENT0000000248426355'],
    },
    Q2942311: {   // Saint-Apollinaire de Valence
      construire: cathedraleValence, centre: [4.889386, 44.931675], orientation: -22, masquer: ['BATIMENT0000002008478781', 'BATIMENT0000002008478780'],
    },
    Q667763: {   // le château de Quéribus, sur son piton
      construire: queribus, centre: [2.6217, 42.8367], orientation: 37, masquer: ['BATIMENT0000000080188663'],
    },
    Q519572: {   // l'abbaye de Murbach
      construire: murbach, centre: [7.1581, 47.9233], orientation: 12, masquer: ['BATIMENT0000000229112856', 'BATIMENT0000000229112926'],
    },
    Q591296: {   // l'abbatiale de Pontigny
      construire: pontigny, centre: [3.714547, 47.909504], orientation: -17, masquer: ['BATIMENT0000002215643647', 'BATIMENT0000002215643646', 'BATIMENT0000002215643605'],
    },
    Q333888: {   // l'abbatiale Saint-Pierre de Corbie
      construire: abbatialeCorbie, centre: [2.510123, 49.908945], orientation: 15, masquer: ['BATIMENT0000002102019551', 'BATIMENT0000002102019550'],
    },
    Q2310816: {   // Sainte-Marie d'Oloron
      construire: cathedraleOloron, centre: [-0.61611, 43.187817], orientation: 24, masquer: ['BATIMENT0000000333320025'],
    },
    Q2714663: {   // le fort de Brégançon, sur son rocher
      construire: bregancon, centre: [6.3221, 43.0928], orientation: 0, masquer: ['BATIMENT0000000326912997', 'BATIMENT0000000326912999', 'BATIMENT0000000326912998', 'BATIMENT0000000075056626'],
    },
    Q1766069: {   // l'abbaye Sainte-Geneviève : la tour Clovis (le lycée Henri-IV reste celui de l'IGN)
      construire: tourClovis, centre: [2.347943, 48.846172], orientation: -12, masquer: ['BATIMENT0000000241932697'],
    },
    Q1461848: {   // le château de Ferrières
      construire: ferrieres, centre: [2.7119, 48.8197], orientation: -34, masquer: ['BATIMENT0000000336706041'],
    },
    Q306155: {   // l'abbaye du Thoronet (le cloître reste celui de l'IGN)
      construire: thoronet, centre: [6.2639, 43.4603], orientation: 5, masquer: ['BATIMENT0000000327409698', 'BATIMENT0000000327409696', 'BATIMENT0000000327409697'],
    },
    Q333980: {   // l'abbaye de Jumièges (les ruines ne sont pas dans l'IGN)
      construire: jumieges, centre: [0.8192, 49.4319], orientation: 0, masquer: [],
    },
    Q1013191: {   // le château de Montségur, sur son pog
      construire: montsegur, centre: [1.8325, 42.8756], orientation: -10, masquer: [],
    },
    Q2032139: {   // le château de Serrant
      construire: serrant, centre: [-0.7439, 47.415], orientation: -27, masquer: ['BATIMENT0000000313092042'],
    },
    Q579961: {   // le château d'Ancy-le-Franc
      construire: ancyLeFranc, centre: [4.1617, 47.7739], orientation: -25, masquer: ['BATIMENT0000002215923176', 'BATIMENT0000002215924981'],
    },
    Q2241121: {   // le château de Fénelon
      construire: fenelon, centre: [1.3503, 44.8423], orientation: -39, masquer: ['BATIMENT0000000296696668', 'BATIMENT0000000296696667', 'BATIMENT0000000296696660', 'BATIMENT0000000296696658', 'BATIMENT0000000296696669'],
    },
    Q2054341: {   // le château de Saché
      construire: sache, centre: [0.5444, 47.2458], orientation: 1, masquer: ['BATIMENT0000000322810051'],
    },
    Q2762952: {   // Notre-Dame de Lescar
      construire: cathedraleLescar, centre: [-0.43323, 43.332916], orientation: -24, masquer: ['BATIMENT0000000332697002', 'BATIMENT0000000332697897'],
    },
    Q279151: {   // Notre-Dame-de-Bonne-Nouvelle
      construire: notreDameBonneNouvelle, centre: [2.35, 48.8695], orientation: -4, masquer: ['BATIMENT0000000245194943'],
    },
    Q3076041: {   // la fontaine Médicis (tournée vers son bassin, à l'ouest)
      construire: fontaineMedicis, centre: [2.339316, 48.848059], orientation: 180, masquer: ['BATIMENT0000000241937786'],
    },
    Q1192381: {   // le château de Menars
      construire: menars, centre: [1.4104, 47.6388], orientation: 37, masquer: ['BATIMENT0000000322124010'],
    },
    Q769303: {   // le château du Rivau
      construire: rivau, centre: [0.3233, 47.1039], orientation: 19, masquer: ['BATIMENT0000000322952043'],
    },
    Q576569: {   // le château de Beauregard
      construire: beauregard, centre: [1.3836, 47.5369], orientation: 36, masquer: ['BATIMENT0000000321834668'],
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
        // Une maquette n'est construite que quand on approche de son monument (render) : les construire toutes au démarrage
        // prenait 0,3 s sur un PC à 71 maquettes (bien plus sur un téléphone), et la mémoire de toutes leurs formes.
        for (const [id, m] of Object.entries(MODELES)) {
          const mc = maplibregl.MercatorCoordinate.fromLngLat(m.centre, 0), s = mc.meterInMercatorCoordinateUnits();
          // mètres (x est, y haut, z sud) → mercator (x est, y sud, z haut)
          const place = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          poses.push({ id, m, objet: null, place, centre: m.centre });
        }
        // rien ne bouge : les positions des pièces se calculent une fois pour toutes, à la construction (sinon Three.js les
        // recalcule à chaque dessin, pour toutes les pièces de tous les monuments : 10 ms de plus par image, 4 nov. 2026)
        if ('matrixWorldAutoUpdate' in this.scene) this.scene.matrixWorldAutoUpdate = false; else this.scene.autoUpdate = false;
        this.loin = []; this.pres = []; this.deLoin = true;
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
          if (!p.objet) this.construire(p);
          for (const q of poses) if (q.objet) q.objet.visible = q === p;
          this.camera.projectionMatrix.multiplyMatrices(carte, p.place); this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
          this.renderer.render(this.scene, this.camera);
        }
      },
      // construire la maquette d'un monument, la première fois qu'il approche de l'écran
      construire(p) {
        const g = p.m.construire(THREE); g.rotation.y = p.m.orientation * Math.PI / 180;
        const objet = new THREE.Group(); objet.add(g); this.scene.add(objet); objet.updateMatrixWorld(true); p.objet = objet;
        objet.traverse((o) => { if (o.userData.contour === 'loin') { this.loin.push(o); o.visible = this.deLoin; } else if (o.userData.contour === 'pres') { this.pres.push(o); o.visible = !this.deLoin; } });
      },
      onRemove() { if (this.renderer) this.renderer.dispose(); },
    };
  }

  const api = { MODELES, MASQUES, couche, tourEiffel, cathedrale, notreDame, chartres, reims, saintDenis, arcDeTriomphe, sacreCoeur, pantheon, garnier, concorde, pontDuGard, versailles,
    elysee, sorbonne, sainteChapelle, invalides, luxembourg, fontainebleau, chambord, amiens, rouen, strasbourg,
    madeleine, palaisDesPapes, chenonceau, montSaintMichel, louvre, carcassonne, CARCA,
    grandPalais, pontAlexandre, pontNeuf, conciergerie, palaisRoyal, placeDesVosges, saintSulpice,
    vaux, vincennes, blois, amboise, chateauIf, notreDameDeLaGarde, viaducDeMillau,
    bourges, nantes, vezelay, beauvais, cluny, fontenay, ronchamp, maisonCarree, theatreOrange, pontAvignon, carnac,
    montsoreau, saintGermainEnLaye, saintSavin, salineRoyale, saintEustache, chaillot, placeStanislas, laon,
    fontevraud, palaisTau, azayLeRideau, cordouan, villandry, observatoireNice, albi, ecoleMilitaire, theatreChampsElysees, closLuce,
    odeon, chantilly, angers, bayeux, arcOrange, villaSavoye,
    saintRemi, saintGermainAuxerrois, tourSaintJacques, arenesLutece, saumur, placeVictoires, hautKoenigsbourg, saintEtienneDuMont, arenesNimes, colonneJuillet,
    pierrefonds, saintJeanLyon, laMajor, porteSaintDenis, colonneVendome, tropheeAlpes, lionBelfort, usse, pontMirabeau, fourviere,
    loches, chateauGaillard, langeais, saintSernin, sainteClotilde, bordeaux, metz, clermont, cheverny, garabit,
    institut, saintGervais, chaumont, valencay, orleans, sens, cathedraleTours, notreDameDesDoms, saintFront, sullySurLoire,
    limoges, sarlat, noyon, saintBenoit, foix, saintAugustin, capitole, senanque, alexandreNevsky, leMans,
    saintPierreMontmartre, brissac, pontRoyal, sainteTrinite, autun, chateauDucsBretagne, castelnaud, dijon, angouleme, saintTrophime, narbonne, arenesArles,
    saintMerri, saintSeverin, quimper, troyes, saintEtienneToulouse, saintRoch, saintVincentDePaul, porteSaintMartin, salpetriere, synagogueBesancon, chinon, coucy,
    saintJulienLePauvre, baptistere, beynac, pau, saintNicolasChardonnet, abbayeAuxHommes, aiguilhe, auch, rennes, cathedraleAngers, pontMarie, palaisDucsBourgogne,
    cathedraleBlois, cathedraleVannes, cathedralePoitiers, cathedraleMontpellier, cathedraleSoissons, cathedraleVersailles, valDeGrace, saintMichelBordeaux, cathedraleRodez, notreDameDesVictoires, grandeSynagogue, fontaineInnocents,
    saintPaulSaintLouis, notreDameDeLorette, saintJeanMontmartre, cathedraleSenlis, cathedraleMeaux, conques, abbayeAuxDames, chateaudun, hotelDeSens, hotelDeSully, saintUrbain, chapelleExpiatoire,
    cathedraleCoutances, cathedraleAuxerre, saintOuen, cathedraleBayonne, cathedraleBeziers, cathedraleNevers, cathedraleToul, hospicesBeaune, gien, falaise, ossuaireDouaumont, saintThomasStrasbourg,
    pontValentre, saintJosephHavre, memorialVimy, notreDameLaGrande, cathedralePuy, saintMaclou, jacobins, cathedraleCahors, pharArMen, vitre, basiliqueLisieux,
    palaisLegionHonneur, grandTheatreBordeaux, cathedraleRusseNice, palaisRohan, hotelDeVilleLyon, saintNicolasDesChamps, laTourette, cathedraleArras, cathedraleEvreux, cathedralePerpignan, cathedraleMoulins, cathedraleLangres,
    basiliqueSaintQuentin, cathedraleNancy, cathedraleLisieux, cathedraleMontauban, cathedraleAgen, cathedraleCambrai, cathedraleSaintBrieuc, cathedraleSees, cathedraleSaintMalo, cathedraleAgde, tournus, saintPierreCaen,
    orsay, memorialThiepval, grosHorloge, porteDesAllemands, tarascon, salses, josselin, hautefort, chateauAnnecy, fortLaLatte, cathedraleLaRochelle, cathedraleVienne,
    saintPaulStrasbourg, collegialeColmar, notreDameDijon, triniteVendome, cathedraleVerdun, saintNicolasDePort, bonaguil, montreuilBellay, maintenon, chateauSceaux, templeMarais, theatreLyon,
    chateauCaen, chateauDinan, anet, ecouen, moissac, cathedraleAjaccio, cathedraleSaintes, arcGermanicus, cathedraleBazas, sainteReparate, saintMichelCarcassonne,
    cathedraleAix, chateauMaisons, plessisBourre, talcy, roquetaillade, abbadia, saintVictor, daurade, synagogueBordeaux, saintSeurin, cathedraleValence,
    queribus, murbach, pontigny, abbatialeCorbie, cathedraleOloron, bregancon, tourClovis, ferrieres, thoronet, jumieges, montsegur,
    serrant, ancyLeFranc, fenelon, sache, cathedraleLescar, notreDameBonneNouvelle, fontaineMedicis, menars, rivau, beauregard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Maquettes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
