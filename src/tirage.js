// Le tirage d'un pack (GDD « Le pack du jour ») : la rareté de chaque carte, puis un lieu libre de cette rareté
// n'importe où en France. Le MÊME code sert au jeu (mode démo, sans compte) et au serveur (fonction « jeu ») :
// tout ce qui touche au réseau et à l'état est fourni par l'appelant (géocodeur IGN, listes de lieux célèbres,
// « ce lieu est-il libre ? »), et le hasard vient d'une graine (Pack.alea).
//   Commun : l'adresse la plus proche d'un point au hasard du territoire ; Peu commun : une adresse d'une commune au
//   standing 2 ; Rare : un lieu nommé (lieu de culte, mairie, château, gare, musée) près d'un point au hasard ;
//   Épique : une adresse d'une commune au standing 3 ; Légendaire : un lieu célèbre (Wikipédia).
//   Jamais de monument (Extraordinaire : seulement aux enchères).
(function (racine) {
  const BOITE_FR = [-5.2, 41.3, 9.6, 51.1];
  const PARIS = [2.3522, 48.8566];
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function dansAnneau(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
  // une adresse de la BAN (réponse du géocodeur) → un lieu du jeu
  function mkAddr(x, idu) { const p = x.properties; return { id: p.id, label: p.name, lon: x.geometry.coordinates[0], lat: x.geometry.coordinates[1], citycode: p.citycode, city: p.city, postcode: p.postcode, idu, type: 'adresse' }; }
  // Paris, Lyon et Marseille sont regroupées dans la table du standing : on tire un arrondissement
  function communeReelle(code, rng) { const n = Math.floor(rng() * 20); if (code === '75056') return '751' + String(1 + n).padStart(2, '0'); if (code === '69123') return '6938' + (1 + n % 9); if (code === '13055') return '132' + String(1 + n % 16).padStart(2, '0'); return code; }

  // o : { geoJSON(chemin) → Promise<json> (le géocodeur IGN), celebres(dep) → Promise<liste>, france (contours),
  //       deps (codes des départements), standing (table), Celebres, Pack, rarete(lieu), estLibre(lieu) → bool ou Promise<bool> }
  function creer(o) {
    const CODES_STANDING = { 2: Object.keys(o.standing).filter((c) => o.standing[c] === 2), 3: Object.keys(o.standing).filter((c) => o.standing[c] === 3) };
    function pointAuHasard(rng) { for (let k = 0; k < 300; k++) { const p = [BOITE_FR[0] + rng() * (BOITE_FR[2] - BOITE_FR[0]), BOITE_FR[1] + rng() * (BOITE_FR[3] - BOITE_FR[1])]; if (o.france.some((r) => dansAnneau(p, r))) return p; } return PARIS; }
    async function adresseProche(lon, lat) { const j = await o.geoJSON(`reverse?lon=${lon}&lat=${lat}&limit=1&index=address&type=housenumber`); const x = (j.features || [])[0]; return x ? Object.assign(mkAddr(x, null), { type: 'adresse' }) : null; }
    async function adresseDansCommune(code, rng) {
      for (const mot of ['rue', 'route', 'chemin', 'place']) {
        const j = await o.geoJSON(`search?q=${mot}&citycode=${code}&index=address&limit=20`); const f = (j.features || []).filter((x) => x.properties.citycode === code);
        if (f.length) { const [lon, lat] = f[Math.floor(rng() * f.length)].geometry.coordinates; return adresseProche(lon, lat); }
      }
      return null;
    }
    // Les lieux de culte de toutes les religions (décision de Gautier, 4 nov. 2026 : toutes présentes, sans quota) : on
    // demande chacune près du point tiré, puis on garde les plus proches, quelle que soit la religion. Les églises, partout,
    // sortent le plus souvent ; une mosquée, une synagogue, un temple sortent là où ils sont. Pour chaque catégorie de l'IGN,
    // le mot « culte » ramène les lieux les plus proches (le géocodeur classe alors surtout par distance) ; « eglise » en plus
    // pour les chrétiens, les plus nombreux. Cinq demandes à la fois au plus : le géocodeur en accepte 50 par seconde.
    const CULTES = [['eglise', 'culte chrétien'], ['culte', 'culte chrétien'], ['culte', 'culte musulman'], ['culte', 'culte israélite'], ['culte', 'culte divers']];
    function catCulte(x) {
      const cats = (x.properties.category || []).map((t) => t.toLowerCase()), n = o.Celebres.mots(x.properties.toponym).join(' ');
      if (cats.includes('culte musulman')) return 'mosquee';
      if (cats.includes('culte israélite')) return 'synagogue';
      if (/hindou|ganesh|tamoul|murugan/.test(n)) return 'temple_hindou';
      if (/gurdwara|sikh/.test(n)) return 'gurdwara';
      if (/bouddh|boudh|pagode|stupa|zen|tibet/.test(n)) return 'temple_bouddhiste';
      const c = o.Celebres.categorieDuNom(x.properties.toponym); return o.Celebres.famille(c) === 'culte' ? c : (cats.includes('culte divers') ? 'temple' : 'eglise');
    }
    async function lieuNommeProche(lon, lat, rng) {
      const kinds = ['culte', 'mairie', 'chateau', 'gare', 'musee']; const k = kinds[Math.floor(rng() * kinds.length)];
      const demandes = k === 'culte' ? CULTES.map(([q, c]) => `search?index=poi&q=${q}&category=${encodeURIComponent(c)}&lat=${lat}&lon=${lon}&limit=10`)
        : [`search?index=poi&q=${k}&lat=${lat}&lon=${lon}&limit=10`];
      const reponses = await Promise.all(demandes.map((d) => o.geoJSON(d).catch(() => ({}))));
      // seulement les lieux qui ont un vrai nom (pas « Zone d'activité ou d'intérêt » ni « Mairie » tout court)
      let f = reponses.flatMap((j) => j.features || []).filter((x) => { const n = (x.properties.toponym || '').trim(), cats = (x.properties.category || []).map((t) => t.toLowerCase());
        return n.length > 3 && !cats.includes(n.toLowerCase()) && !/^zone d.activit/i.test(n) && o.Celebres.significatifs(n).filter((m) => !/^(gares|eglises|mairies|musees|chateaux|chapelles|mosquees|synagogues|temples)$/.test(m)).length > 0; });
      // lieux de culte : les dix plus proches du point, toutes religions confondues (un même lieu n'est compté qu'une fois)
      if (k === 'culte') { const vus = new Set(), d = (x) => o.Celebres.distance([lon, lat], x.geometry.coordinates);
        f = f.filter((x) => { const c = x.properties.toponym + x.geometry.coordinates; if (vus.has(c)) return false; vus.add(c); return true; }).sort((a, b) => d(a) - d(b)).slice(0, 10); }
      if (!f.length) return null;
      const x = f[Math.floor(rng() * f.length)], p = x.properties;
      let carte = { id: 'poi' + hash(p.toponym + x.geometry.coordinates), label: p.toponym, lon: x.geometry.coordinates[0], lat: x.geometry.coordinates[1], citycode: (p.citycode || [])[0] || '', city: (p.city || [])[0] || '', type: 'lieu', cat: k === 'culte' ? catCulte(x) : k };
      const e = o.Celebres.trouver(carte, await o.celebres(o.Celebres.departement(carte.citycode))); if (e) carte = Object.assign(o.Celebres.lieuDe(e), { city: carte.city });
      return carte;
    }
    async function celebreAuHasard(rng) {
      const dep = o.deps[Math.floor(rng() * o.deps.length)]; const l = await o.celebres(dep); if (!l.length) return null;
      const e = l[Math.floor(rng() * l.length)]; const a = await adresseProche(e[3], e[4]);
      return Object.assign(o.Celebres.lieuDe(e), { city: a ? a.city : '' });
    }
    async function lieuDeRarete(r, rng) {
      if (r === 1) { const [lon, lat] = pointAuHasard(rng); return adresseProche(lon, lat); }
      if (r === 3) { const [lon, lat] = pointAuHasard(rng); return lieuNommeProche(lon, lat, rng); }
      if (r === 5) return celebreAuHasard(rng);
      const codes = CODES_STANDING[r === 2 ? 2 : 3]; return adresseDansCommune(communeReelle(codes[Math.floor(rng() * codes.length)], rng), rng);
    }
    // une carte de la rareté voulue (6 essais) ; si le réseau ou le hasard s'obstinent, une carte Commune
    async function tirerCarte(r, base, dejaTires) {
      for (const rv of (r === 1 ? [1] : [r, 1])) for (let essai = 0; essai < 6; essai++) {
        const rng = o.Pack.alea(o.Pack.graine(base + ':' + rv + ':' + essai));
        try {
          const c = await lieuDeRarete(rv, rng);
          if (c && o.rarete(c) === rv && !dejaTires.some((d) => d.id === c.id) && await o.estLibre(c)) return c;
        } catch (e) { /* réseau capricieux : on réessaie */ }
      }
      return null;
    }
    // un pack entier : n cartes tirées en parallèle, doublons retirés, cartes manquantes complétées par des Communes
    async function tirerPack(base, chances, n) {
      const raretes = o.Pack.raretes(n, chances, o.Pack.alea(o.Pack.graine(base)));
      const tirees = await Promise.all(raretes.map((r, i) => tirerCarte(r, base + ':' + i, [])));
      const cartes = [];
      for (const c of tirees) if (c && !cartes.some((x) => x.id === c.id)) cartes.push(c);
      for (let k = 0; cartes.length < n && k < 4; k++) { const c = await tirerCarte(1, base + ':plus:' + k, cartes); if (c) cartes.push(c); }
      return cartes;
    }
    return { tirerPack, tirerCarte, lieuDeRarete, lieuNommeProche, pointAuHasard, adresseProche };
  }

  const api = { creer, hash, mkAddr, dansAnneau };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Tirage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
