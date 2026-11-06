// La marche dans les rues (la balade au joystick, demandée par Gautier le 6 nov. 2026 : « le déplacement entre les rues
// comme dans un jeu vidéo, plutôt que comme si c'était Street View » ; puis « la caméra suit son personnage, comme une
// vue FPS, mais en dézoomé »). Pure : les rues (tronçons de la BD TOPO, fournis par l'appelant), la manette et le temps
// écoulé donnent la nouvelle position. Servira aussi à la chasse au trésor (même vitesse pour tous).
//   Rues : [[lon1, lat1, lon2, lat2, nom], …] (un segment par ligne).
//   Manette : { x, y } entre -1 et 1, y négatif vers le haut de l'écran. La caméra est derrière le marcheur : le haut,
//   c'est tout droit (on suit la rue et ses virages) ; à droite ou à gauche, on prend la prochaine rue de ce côté
//   (au carrefour où l'on est, sinon au suivant : on peut s'y prendre à l'avance) ; vers le bas, demi-tour.
//   Marcheur : { lon, lat, cap (sens de la marche, en degrés), camCap (le regard de la caméra), verrou, demi, bouge }.
(function (racine) {
  const KY = 110540;
  const norm360 = (c) => ((c % 360) + 360) % 360;
  const ecart = (a, b) => { const d = norm360(a - b); return d > 180 ? 360 - d : d; };
  const tournerVers = (a, b, max) => { const d = ((b - a + 540) % 360) - 180; return norm360(a + Math.max(-max, Math.min(max, d))); };
  const kx = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  const decale = (pt, cap, m) => { const r = cap * Math.PI / 180; return { lat: pt.lat + Math.cos(r) * m / KY, lon: pt.lon + Math.sin(r) * m / kx(pt.lat) }; };

  function creer(opts) {
    const o = Object.assign({ vitesse: 11, rayon: 9, verrou: 15, camVitesse: 140 }, opts || {});
    // les rues à moins de r mètres : distance, cap (dans un sens), point le plus proche, nom
    function proches(rues, pt, r) { const mx = kx(pt.lat), out = [];
      for (const s of rues) { const ax = (s[0] - pt.lon) * mx, ay = (s[1] - pt.lat) * KY, bx = (s[2] - pt.lon) * mx, by = (s[3] - pt.lat) * KY;
        if ((ax < -r && bx < -r) || (ax > r && bx > r) || (ay < -r && by < -r) || (ay > r && by > r)) continue;
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; if (!L) continue; const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L));
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py); if (d > r) continue;
        out.push({ d, cap: norm360(Math.atan2(dx, dy) * 180 / Math.PI), lat: pt.lat + py / KY, lon: pt.lon + px / mx, nom: s[4] || '' }); }
      return out.sort((a, b) => a.d - b.d); }
    // la direction de rue (dans un sens ou dans l'autre) la plus proche de « voulu », à « max » degrés au plus
    function choisir(rues, pt, voulu, max) { let best = null;
      for (const r of proches(rues, pt, o.rayon)) for (const c of [r.cap, norm360(r.cap + 180)]) {
        const e = ecart(c, voulu); if (e > max) continue; const note = e + r.d * 3; if (!best || note < best.note) best = { c, r, note }; }
      return best; }
    // ce que veut le joueur : tout droit, à droite, à gauche, demi-tour (rien si la manette est au repos)
    function intention(joy) { const f = Math.min(1, Math.hypot(joy.x, joy.y)); if (f < 0.2) return null;
      const a = Math.atan2(joy.x, -joy.y) * 180 / Math.PI; return Math.abs(a) <= 40 ? 'avant' : Math.abs(a) >= 140 ? 'demi' : (a > 0 ? 'droite' : 'gauche'); }
    // un pas : rend le marcheur à jour (et les mètres parcourus)
    function pas(m, rues, joy, dt) {
      const f = Math.min(1, Math.hypot(joy.x, joy.y)), quoi = intention(joy);
      if (!quoi) { m.demi = false; m.bouge = false; return 0; }
      let dir = null;
      if (quoi === 'demi' && !m.demi) { m.demi = true; const b = choisir(rues, m, norm360(m.cap + 180), 60); if (b) { m.cap = b.c; m.camCap = m.cap; m.verrou = o.verrou; } }
      if ((quoi === 'droite' || quoi === 'gauche') && !(m.verrou > 0)) {
        const b = choisir(rues, m, norm360(m.cap + (quoi === 'droite' ? 90 : -90)), 55);
        if (b) { dir = b.c; m.verrou = o.verrou; } }
      if (dir == null) { const b = choisir(rues, m, m.cap, 50); if (b) dir = b.c; }   // tout droit, en suivant les virages
      if (dir == null) { m.bouge = false; return 0; }                                  // au bout de la rue : on s'arrête
      m.cap = dir;
      // la rue continue-t-elle devant ? (3 m plus loin, une rue dans le même axe) ; sinon, c'est le bout : on s'arrête
      const axe = (x) => ecart(x.cap, dir) < 30 || ecart(x.cap, dir) > 150;
      const ici = proches(rues, m, o.rayon).find(axe), devant = proches(rues, decale(m, dir, 3), o.rayon).find(axe);
      if (!devant || devant.d > 1.5 + (ici ? ici.d : 0)) { m.bouge = false; return 0; }
      const d = o.vitesse * f * dt, p = decale(m, dir, d);
      // rester sur la rue : vers le point le plus proche d'une rue dans le même axe
      const r = proches(rues, p, o.rayon).find((x) => ecart(x.cap, dir) < 30 || ecart(x.cap, dir) > 150);
      const k = Math.min(1, dt * 6); m.lat = r ? p.lat + (r.lat - p.lat) * k : p.lat; m.lon = r ? p.lon + (r.lon - p.lon) * k : p.lon;
      m.verrou = Math.max(0, (m.verrou || 0) - d);
      m.camCap = tournerVers(m.camCap == null ? dir : m.camCap, dir, o.camVitesse * dt);
      m.bouge = true; return d; }
    // partir d'un point : sur la rue la plus proche, dans le sens le plus proche du cap donné
    function depart(rues, pt, cap, rayon) { const r = proches(rues, pt, rayon || 150)[0]; if (!r) return null;
      const c = ecart(r.cap, cap || 0) <= 90 ? r.cap : norm360(r.cap + 180);
      return { lon: r.lon, lat: r.lat, cap: c, camCap: c, verrou: 0, demi: false, bouge: false, rue: r.nom }; }
    function nomDeRue(rues, pt) { const r = proches(rues, pt, 25).find((x) => x.nom); return r ? r.nom : ''; }
    return { pas, depart, proches, choisir, intention, nomDeRue, options: o };
  }

  const api = { creer, norm360, ecart, decale };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Marche = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
