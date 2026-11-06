// La chasse au trésor (idée de Gautier du 6 nov. 2026, GDD § 5 quinquies) : une commune est annoncée, une adresse y est
// cachée ; tous les joueurs partent du même endroit (la mairie) et marchent dans les rues (la balade au joystick, même
// vitesse pour tous) ; le premier arrivé gagne. Tant que personne n'a trouvé, un indice de plus toutes les 2 minutes :
// un cercle de 600 m, de 300 m, le nom de la rue, un cercle de 100 m et le côté de la rue, enfin le numéro.
// Le trésor peut être n'importe quelle adresse (Gautier : pas seulement les libres, sinon on chercherait là où personne
// n'a rien) ; la récompense est une adresse tirée au hasard, comme une carte de pack, et des pièces.
// Module pur : les instants, la position et le hasard sont donnés par l'appelant (jeu ou serveur).
(function (racine) {
  const PARIS_HEURE = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }) : null;
  const heureParis = (ms) => (PARIS_HEURE ? Number(PARIS_HEURE.format(new Date(ms))) : new Date(ms).getUTCHours() + 1);
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const KY = 110540, kx = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  function distance(a, b) { return Math.hypot((a.lon - b.lon) * kx((a.lat + b.lat) / 2), (a.lat - b.lat) * KY); }
  function decale(pt, capDeg, m) { const r = capDeg * Math.PI / 180; return { lon: pt.lon + Math.sin(r) * m / kx(pt.lat), lat: pt.lat + Math.cos(r) * m / KY }; }

  function creer(eco) {
    const C = eco.chasse, MIN = 60000;
    const intervalle = C.intervalle_minutes * MIN, annonce = C.annonce_minutes * MIN, indice = C.indice_minutes * MIN, duree = C.duree_max_minutes * MIN;
    // le calendrier : la chasse n commence à n × intervalle (à l'heure pile, pour 60 minutes), si l'heure de Paris est dans
    // la plage de jeu ; elle est annoncée quelques minutes avant ; elle finit quand le trésor est trouvé, ou au bout de la durée
    const jouable = (n) => { const h = heureParis(n * intervalle); return h >= C.heure_debut && h < C.heure_fin; };
    const creneau = (n) => ({ numero: n, annonce: n * intervalle - annonce, debut: n * intervalle, fin: n * intervalle + duree });
    function prochaine(t) { // la chasse en cours, sinon la prochaine
      for (let n = Math.floor((t - duree) / intervalle) + 1, k = 0; k < 24 * 60 / C.intervalle_minutes + 2; n++, k++) if (jouable(n) && n * intervalle + duree > t) return creneau(n);
      return null; }
    function etat(c, t) { if (c.trouve_le) return 'trouvee'; if (t < c.annonce) return 'attente'; if (t < c.debut) return 'annonce'; if (t < c.fin) return 'en_cours'; return 'finie'; }
    // le niveau d'indice atteint (0 : la commune seule ; un de plus toutes les « indice » minutes)
    const niveau = (debut, t) => Math.max(0, Math.min(C.indices.length, Math.floor((t - debut) / indice)));
    // les indices donnés au niveau n : les cercles ne sont pas centrés sur le trésor (il est dedans, quelque part)
    function indices(c, n) { const out = [];
      C.indices.slice(0, n).forEach((pas, i) => { for (const morceau of pas.split(',')) {
        const [type, valeur] = morceau.split(':');
        if (type === 'cercle') { const R = Number(valeur), h = hash(c.id + ':' + R), a = (h % 3600) / 10, d = ((h >>> 12) % 1000) / 1000 * 0.6 * R;
          const centre = decale(c.cible, a, d); out.push({ niveau: i + 1, type, rayon: R, lon: centre.lon, lat: centre.lat }); }
        else if (type === 'rue') out.push({ niveau: i + 1, type, texte: c.cible.rue });
        else if (type === 'cote') { const p = parseInt(c.cible.numero, 10); if (p) out.push({ niveau: i + 1, type, texte: p % 2 ? 'impair' : 'pair' }); }
        else if (type === 'numero') out.push({ niveau: i + 1, type, texte: c.cible.label }); } });
      return out; }
    // ce que les joueurs voient d'une chasse (jamais le trésor avant la fin)
    function vue(c, t) { const e = etat(c, t), n = e === 'en_cours' ? niveau(c.debut, t) : (e === 'trouvee' || e === 'finie' ? C.indices.length : 0);
      return { id: c.id, numero: c.numero, commune: c.commune, depart: c.depart, annonce: c.annonce, debut: c.debut, fin: c.fin, etat: e,
        niveau: n, indices: e === 'attente' || e === 'annonce' ? [] : indices(c, n), prochainIndice: e === 'en_cours' && n < C.indices.length ? c.debut + (n + 1) * indice : null,
        gagnant: c.gagnant || null, trouve_le: c.trouve_le || null, tresor: e === 'trouvee' || e === 'finie' ? c.cible.label : null }; }
    // un pas envoyé par un joueur est-il possible à la vitesse de la balade ? (un saut est refusé)
    function pasValide(avant, apres) { const dt = Math.max(0, (apres.le - avant.le) / 1000);
      return distance(avant, apres) <= C.vitesse_ms * dt * C.marge_vitesse + C.tolerance_m; }
    const arrive = (pos, cible) => distance(pos, cible) <= C.rayon_arrivee_m;
    // où chercher le trésor : un point entre distance_min et distance_max du départ (l'appelant prend l'adresse la plus proche)
    function pointCible(depart, alea) { const u = alea(), v = alea(), d = Math.sqrt(C.distance_min_m ** 2 + u * (C.distance_max_m ** 2 - C.distance_min_m ** 2));
      return decale(depart, v * 360, d); }
    const cibleValable = (depart, cible) => { const d = distance(depart, cible); return d >= C.distance_min_m * 0.8 && d <= C.distance_max_m * 1.2; };
    // la commune d'une chasse : tirée parmi la liste (data/chasse_communes.json : [code, nom, lon, lat, population, département])
    function commune(liste, numero) { const ok = liste.filter((x) => x[4] >= C.population_min); return ok.length ? ok[hash('chasse:' + numero) % ok.length] : null; }
    return { prochaine, creneau, jouable, etat, niveau, indices, vue, pasValide, arrive, pointCible, cibleValable, commune, distance, recompense: { pieces: C.recompense_pieces, cartes: C.recompense_cartes }, C };
  }
  const api = { creer, distance, decale, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Chasse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
