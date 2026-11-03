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
    const dome = (r, etire, x, y, z, mat) => piece((e) => new THREE.SphereGeometry(r + e, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, etire, 1), mat, V(x, y, z));
    const cylindre = (rh, rb, h, seg, x, y, z, mat) => piece((e) => new THREE.CylinderGeometry(rh + e, rb + e, h + 2 * e, seg).translate(0, h / 2, 0), mat, V(x, y, z));
    const pyramide = (r, h, seg, x, y, z, mat) => piece((e) => new THREE.ConeGeometry(r + e, h + 2 * e, seg).rotateY(Math.PI / seg).translate(0, h / 2, 0), mat, V(x, y, z));
    const boule = (r, x, y, z, mat) => piece((e) => new THREE.SphereGeometry(r + e, 12, 8), mat, V(x, y, z));
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

  // ---------------------------------------------------------------- Notre-Dame de Paris (x : l'axe de la nef, la façade à l'ouest en -x)
  // nef et chœur (murs de 30 m, toit de plomb jusqu'à 44 m), bas-côtés, transept, abside, arcs-boutants, deux tours de
  // 66 m, la rosace, la flèche (96 m) et son coq doré
  function notreDame(THREE) {
    const A = atelier(THREE), V = A.V;
    const pierre = A.matiere(0xF0E3C4), pierreFoncee = A.matiere(0xD2BC8E), plomb = A.matiere(0x5E70A3), plombFonce = A.matiere(0x46567F),
      or = A.matiere(0xFFC233, 0x7A4A00), vitrail = A.matiere(0x3F6FE0, 0x1C3C9E), porte = A.matiere(0x6E5A44);
    A.boite(104, 30, 32, 1, 0, 0, pierre); A.toit(33, 14, 104, 1, 30, 0, plomb);
    for (const s of [1, -1]) A.boite(96, 16, 9, 1, 0, s * 20.5, pierreFoncee);
    A.boite(14, 30, 54, 12, 0, 0, pierre); A.toit(14, 14, 54, 12, 30, 0, plomb, Math.PI / 2);
    A.abside(16, 30, 53, 0, 0, pierre); A.demiCone(16.5, 13, 53, 30, 0, plomb);
    for (let i = 0; i < 6; i++) { const x = -40 + i * 15.5; if (Math.abs(x - 12) < 9) continue;
      for (const s of [1, -1]) { A.boite(3, 18, 3, x, 0, s * 27, pierreFoncee); A.poutre(V(x, 17, s * 27), V(x, 28, s * 16.5), 2, 1.6, pierreFoncee); } }
    for (const s of [1, -1]) { A.boite(20, 66, 20, -64, 0, s * 15, pierre); A.boite(21.5, 2.2, 21.5, -64, 60, s * 15, pierreFoncee); }
    A.boite(14, 44, 10.2, -62, 0, 0, pierre); A.boite(15, 2, 10.2, -62, 44, 0, pierreFoncee);   // entre les deux tours (sinon son contour ressort à travers elles)
    A.piece((e) => new THREE.CylinderGeometry(6 + e, 6 + e, 1 + 2 * e, 28).rotateZ(Math.PI / 2), vitrail, V(-69.4, 30, 0));
    for (const [z, l] of [[0, 8], [-15, 6.5], [15, 6.5]]) A.extrusion(A.formeArche(l, l * 1.9), 0.8, -74.2 + (z ? 0 : 5), 0, z, porte, Math.PI / 2);
    A.pyramide(4.5, 50, 4, 12, 43, 0, plombFonce); A.boule(1.8, 12, 95, 0, or);
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
        // la lumière vient d'en haut à gauche (bible § 2) ; un ciel clair et un sol bleuté pour les faces à l'ombre.
        // La scène est en coordonnées de la carte (mercator : x vers l'est, y vers le sud, z vers le haut).
        const ciel = new THREE.HemisphereLight(0xffffff, 0x8FA3D6, LUMIERE.ciel); ciel.position.set(0, 0, 1); this.scene.add(ciel);
        const soleil = new THREE.DirectionalLight(0xffffff, LUMIERE.soleil); soleil.position.set(-0.8, -0.6, 1.6); this.scene.add(soleil);
        for (const [id, m] of Object.entries(MODELES)) {
          const g = m.construire(THREE); g.rotation.y = m.orientation * Math.PI / 180;
          const racineScene = new THREE.Group(); racineScene.add(g); racineScene.matrixAutoUpdate = false; this.scene.add(racineScene);
          const mc = maplibregl.MercatorCoordinate.fromLngLat(m.centre, 0), s = mc.meterInMercatorCoordinateUnits();
          // mètres (x est, y haut, z sud) → mercator (x est, y sud, z haut)
          racineScene.matrix = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          poses.push({ id, objet: racineScene });
        }
        this.loin = []; this.pres = []; this.scene.traverse((o) => { if (o.userData.contour === 'loin') this.loin.push(o); else if (o.userData.contour === 'pres') this.pres.push(o); }); this.deLoin = true;
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
      },
      render(gl, matrix) {
        const z = this.map.getZoom(); if (z < 12) return;   // de trop loin, la tour n'est qu'un point
        const deLoin = z < ZOOM_PRES; if (deLoin !== this.deLoin) { this.deLoin = deLoin; this.loin.forEach((o) => { o.visible = deLoin; }); this.pres.forEach((o) => { o.visible = !deLoin; }); }
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        this.renderer.resetState(); this.renderer.render(this.scene, this.camera);
      },
      onRemove() { if (this.renderer) this.renderer.dispose(); },
    };
  }

  const api = { MODELES, MASQUES, couche, tourEiffel, notreDame, arcDeTriomphe, sacreCoeur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Maquettes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
