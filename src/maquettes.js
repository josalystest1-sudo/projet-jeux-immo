// Les maquettes 3D des monuments sur la carte (phase 10.4 des graphismes ; docs/BIBLE-GRAPHIQUE.md § 8).
// Style « jeu mobile coloré » (choix de Gautier) : formes simples et épaisses, ombres franches façon dessin animé
// (MeshToonMaterial), un contour encre (une coque inversée, un peu plus grande), l'or pour les lumières.
// Tout est construit en code avec Three.js, à la vraie taille (en mètres) : aucun fichier de modèle.
// La couche est une « custom layer » MapLibre, sans animation : elle ne redessine que quand la carte bouge
// (la carte doit pouvoir se reposer, CLAUDE.md).
(function (racine) {
  const ENCRE = 0x17233F;
  const CONTOUR = 1.6;   // épaisseur du contour, en mètres (1 à 2 pixels aux zooms 15-16)
  const ZOOM_SANS_CONTOUR = 16.8;   // de plus près, un contour de taille fixe devient trop épais et laisse des traits aux jointures

  // ---------------------------------------------------------------- les briques de construction
  function atelier(THREE) {
    // trois tons francs (le dessin animé) : ombre, milieu, lumière
    const tons = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    const degrade = new THREE.DataTexture(tons, 3, 1, THREE.RGBAFormat);
    degrade.minFilter = degrade.magFilter = THREE.NearestFilter; degrade.generateMipmaps = false; degrade.needsUpdate = true;
    // Attention : dans la couche de la carte, la projection retourne le sens des faces (mercator : y vers le sud). Les
    // faces visibles d'un objet sont donc dessinées avec BackSide, et celles du contour (l'intérieur de la coque) avec
    // FrontSide. Vérifié à l'écran (3 nov. 2026) : dans l'autre sens, la coque d'encre recouvre tout.
    const matiere = (couleur, lumiere) => new THREE.MeshToonMaterial({ color: couleur, gradientMap: degrade, emissive: lumiere || 0x000000, side: THREE.BackSide });
    const encre = new THREE.MeshBasicMaterial({ color: ENCRE, side: THREE.FrontSide });
    const groupe = new THREE.Group();
    // un objet et son contour (la même forme, un peu plus grande, vue de l'intérieur, en encre)
    const poser = (geo, contour, mat, position, rotation) => {
      const m = new THREE.Mesh(geo, mat), c = new THREE.Mesh(contour, encre); c.userData.contour = true;
      for (const o of [m, c]) { if (position) o.position.copy(position); if (rotation) o.quaternion.copy(rotation); groupe.add(o); }
      return m;
    };
    // une poutre à section carrée, d'un point à un autre, plus fine en haut
    const poutre = (a, b, la, lb, mat) => {
      const d = new THREE.Vector3().subVectors(b, a), h = d.length();
      const geo = new THREE.CylinderGeometry(lb / Math.SQRT2, la / Math.SQRT2, h, 4, 1);
      const con = new THREE.CylinderGeometry(lb / Math.SQRT2 + CONTOUR, la / Math.SQRT2 + CONTOUR, h + CONTOUR * 2, 4, 1);
      for (const g of [geo, con]) g.rotateY(Math.PI / 4);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      return poser(geo, con, mat, new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q);
    };
    // une dalle (boîte) centrée sur l'axe, à une hauteur
    const dalle = (cote, epaisseur, y, mat) => poser(new THREE.BoxGeometry(cote, epaisseur, cote), new THREE.BoxGeometry(cote + CONTOUR * 2, epaisseur + CONTOUR * 2, cote + CONTOUR * 2), mat, new THREE.Vector3(0, y + epaisseur / 2, 0));
    // un tronc carré qui s'amincit (la flèche)
    const tronc = (cb, ch, y0, y1, mat) => { const h = y1 - y0;
      const geo = new THREE.CylinderGeometry(ch / Math.SQRT2, cb / Math.SQRT2, h, 4, 1), con = new THREE.CylinderGeometry(ch / Math.SQRT2 + CONTOUR, cb / Math.SQRT2 + CONTOUR, h + CONTOUR * 2, 4, 1);
      for (const g of [geo, con]) g.rotateY(Math.PI / 4);
      return poser(geo, con, mat, new THREE.Vector3(0, y0 + h / 2, 0)); };
    // une arche (un demi-anneau aplati) sur une face
    const arche = (rayon, epaisseur, y, decalage, angle, mat) => {
      const geo = new THREE.TorusGeometry(rayon, epaisseur, 6, 20, Math.PI), con = new THREE.TorusGeometry(rayon, epaisseur + CONTOUR, 6, 20, Math.PI);
      for (const g of [geo, con]) { g.scale(1, 0.62, 1); g.translate(0, 0, decalage); g.rotateY(angle); }
      return poser(geo, con, mat, new THREE.Vector3(0, y, 0)); };
    return { THREE, groupe, matiere, poser, poutre, dalle, tronc, arche };
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
    A.poser(new THREE.CylinderGeometry(0.9, 1.4, 40, 6), new THREE.CylinderGeometry(0.9 + CONTOUR, 1.4 + CONTOUR, 40 + CONTOUR * 2, 6), bronzeFonce, V(0, 310, 0));
    A.poser(new THREE.SphereGeometry(2.6, 10, 8), new THREE.SphereGeometry(2.6 + CONTOUR, 10, 8), lumiere, V(0, 331, 0));
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
        const ciel = new THREE.HemisphereLight(0xffffff, 0x8FA3D6, 0.85); ciel.position.set(0, 0, 1); this.scene.add(ciel);
        const soleil = new THREE.DirectionalLight(0xffffff, 0.9); soleil.position.set(-0.8, -0.6, 1.6); this.scene.add(soleil);
        for (const [id, m] of Object.entries(MODELES)) {
          const g = m.construire(THREE); g.rotation.y = m.orientation * Math.PI / 180;
          const racineScene = new THREE.Group(); racineScene.add(g); racineScene.matrixAutoUpdate = false; this.scene.add(racineScene);
          const mc = maplibregl.MercatorCoordinate.fromLngLat(m.centre, 0), s = mc.meterInMercatorCoordinateUnits();
          // mètres (x est, y haut, z sud) → mercator (x est, y sud, z haut)
          racineScene.matrix = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          poses.push({ id, objet: racineScene });
        }
        this.contours = []; this.scene.traverse((o) => { if (o.userData.contour) this.contours.push(o); }); this.avecContour = true;
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
      },
      render(gl, matrix) {
        const z = this.map.getZoom(); if (z < 12) return;   // de trop loin, la tour n'est qu'un point
        const avec = z < ZOOM_SANS_CONTOUR; if (avec !== this.avecContour) { this.avecContour = avec; this.contours.forEach((o) => { o.visible = avec; }); }
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        this.renderer.resetState(); this.renderer.render(this.scene, this.camera);
      },
      onRemove() { if (this.renderer) this.renderer.dispose(); },
    };
  }

  const api = { MODELES, MASQUES, couche, tourEiffel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Maquettes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
