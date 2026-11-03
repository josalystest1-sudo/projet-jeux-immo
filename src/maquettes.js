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
    return { THREE, groupe, matiere, V, piece, poutre, dalle, tronc, arche, boite, toit, dome, cylindre, pyramide, boule, abside, demiCone, extrusion, formeArche };
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
  // flecheCroisee ({ h } : la flèche au-dessus du transept), arcs (des arcs-boutants)
  function cathedrale(THREE, o) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(o.pierre || 0xF0E3C4), pierreFoncee = A.matiere(o.pierreFoncee || 0xD2BC8E), toit = A.matiere(o.toit || 0x5E70A3), toitFonce = A.matiere(o.toitFonce || 0x46567F),
      or = A.matiere(0xFFC233, 0x7A4A00), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    const debut = o.F + o.cote / 2 + 3, long = o.E - debut, cx = (debut + o.E) / 2, demi = o.larg / 2;
    // la nef et le chœur, les bas-côtés, le transept, l'abside
    A.boite(long, o.mur, o.larg, cx, 0, 0, pierre); A.toit(o.larg + 1, o.toitH, long, cx, o.mur, 0, toit);
    const bas = Math.round(o.mur * 0.53), bc = Math.max(7, o.larg * 0.28);
    for (const s of [1, -1]) A.boite(long - 8, bas, bc, cx, 0, s * (demi + bc / 2 - 1), pierreFoncee);
    A.boite(14, o.mur, o.transept, o.xT, 0, 0, pierre); A.toit(14, o.toitH, o.transept, o.xT, o.mur, 0, toit, Math.PI / 2);
    A.abside(demi, o.mur, o.E, 0, 0, pierre); A.demiCone(demi + 0.5, o.toitH - 1, o.E, o.mur, 0, toit);
    // des arcs-boutants de chaque côté (pas devant le transept)
    if (o.arcs !== false) for (let x = debut + 10; x < o.E - 4; x += 15.5) { if (Math.abs(x - o.xT) < 10) continue;
      for (const s of [1, -1]) { const zp = demi + bc + 2; A.boite(3, o.mur * 0.6, 3, x, 0, s * zp, pierreFoncee); A.poutre(V(x, o.mur * 0.57, s * zp), V(x, o.mur * 0.93, s * (demi + 0.5)), 2, 1.6, pierreFoncee); } }
    // les tours de la façade (plates, ou coiffées d'une flèche), la façade entre elles, la rosace, les portails
    const avant = o.F - o.cote / 2;
    for (const t of o.tours) {
      A.boite(o.cote, t.h, o.cote, o.F, 0, t.z, pierre); A.boite(o.cote + 1.5, 2.2, o.cote + 1.5, o.F, t.h - 6, t.z, pierreFoncee);
      if (t.fleche) { A.pyramide(t.r || o.cote * 0.42, t.fleche, 8, o.F, t.h, t.z, toitFonce); A.boule(1.4, o.F, t.h + t.fleche + 1, t.z, or); }
      else for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) A.pyramide(1.6, 6, 4, o.F + dx * (o.cote / 2 - 1.6), t.h, t.z + dz * (o.cote / 2 - 1.6), pierreFoncee);
      A.extrusion(A.formeArche(o.cote * 0.33, o.cote * 0.62), 0.8, avant - 0.2, 0, t.z, porte, Math.PI / 2);
    }
    const ecart = o.tours.length > 1 ? Math.abs(o.tours[0].z - o.tours[1].z) - o.cote : o.larg;
    const zc = o.tours.length > 1 ? (o.tours[0].z + o.tours[1].z) / 2 : 0;
    if (o.tours.length > 1) { A.boite(14, o.facadeH, ecart + 0.2, o.F + 2, 0, zc, pierre); A.boite(15, 2, ecart + 0.2, o.F + 2, o.facadeH, zc, pierreFoncee); }
    else A.boite(10, o.facadeH, o.larg, o.F + 3, 0, 0, pierre);
    const xFace = (o.tours.length > 1 ? o.F + 2 - 7 : o.F + 3 - 5) - 0.4, t0 = o.tours[0];
    const zRose = o.tours.length > 1 ? zc : (t0.z < 0 ? (t0.z + o.cote / 2 + demi) / 2 : (t0.z - o.cote / 2 - demi) / 2);
    A.piece((e) => new THREE.CylinderGeometry(o.rose + e, o.rose + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, V(xFace, o.facadeH * 0.68, zRose));
    A.extrusion(A.formeArche(o.cote * 0.42, o.cote * 0.78), 0.8, xFace - 0.2, 0, zRose, porte, Math.PI / 2);
    // la flèche à la croisée du transept, et son coq doré
    if (o.flecheCroisee) { A.pyramide(4.5, o.flecheCroisee.h, 4, o.xT, o.mur + o.toitH - 1, 0, toitFonce); A.boule(1.8, o.xT, o.mur + o.toitH - 1 + o.flecheCroisee.h + 1, 0, or); }
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
          poses.push({ id, objet, place });
        }
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
        this.renderer.resetState();
        for (const p of poses) {
          for (const q of poses) q.objet.visible = q === p;
          this.camera.projectionMatrix.multiplyMatrices(carte, p.place); this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
          this.renderer.render(this.scene, this.camera);
        }
      },
      onRemove() { if (this.renderer) this.renderer.dispose(); },
    };
  }

  const api = { MODELES, MASQUES, couche, tourEiffel, cathedrale, notreDame, chartres, reims, saintDenis, arcDeTriomphe, sacreCoeur, pantheon, garnier, concorde, pontDuGard, versailles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Maquettes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
