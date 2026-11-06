// Les lieux célèbres (article Wikipédia, liste data/celebres/<département>.json) : reconnaître qu'un lieu nommé
// trouvé par l'IGN (une église, une mairie…) est le même que celui de Wikidata. Module pur, sans réseau.
// Une entrée de la liste : [identifiant Wikidata, nom, catégorie, longitude, latitude, code INSEE].
(function (racine) {
  // familles de catégories : deux lieux de la même famille peuvent être le même bâtiment
  const FAMILLES = {
    culte: ['eglise', 'chapelle', 'cathedrale', 'abbaye', 'monastere', 'prieure', 'synagogue', 'basilique', 'temple',
      'mosquee', 'eglise_orthodoxe', 'temple_bouddhiste', 'temple_hindou', 'gurdwara'],
    chateau: ['chateau', 'chateau_fort', 'manoir', 'fort'],
    mairie: ['mairie'], gare: ['gare'], musee: ['musee'], phare: ['phare'], pont: ['pont'], tour: ['tour'],
    moulin: ['moulin_vent', 'moulin_eau'], theatre: ['theatre'], fontaine: ['fontaine'], stade: ['stade'], porte: ['porte'],
  };
  const FAMILLE_DE = {};
  for (const [f, cats] of Object.entries(FAMILLES)) for (const c of cats) FAMILLE_DE[c] = f;

  // mots qui disent la catégorie, pas le lieu : ignorés pour comparer deux noms
  const MOTS_CATEGORIE = {
    eglise: 'eglise', chapelle: 'chapelle', cathedrale: 'cathedrale', abbaye: 'abbaye', abbatiale: 'abbaye',
    monastere: 'monastere', prieure: 'prieure', basilique: 'basilique', temple: 'temple', synagogue: 'synagogue',
    mosquee: 'mosquee', pagode: 'temple_bouddhiste', gurdwara: 'gurdwara',
    chateau: 'chateau', manoir: 'manoir', fort: 'fort', forteresse: 'fort', citadelle: 'fort', mairie: 'mairie',
    gare: 'gare', musee: 'musee', phare: 'phare', pont: 'pont', viaduc: 'pont', tour: 'tour', moulin: 'moulin_vent',
    theatre: 'theatre', opera: 'theatre', fontaine: 'fontaine', stade: 'stade', porte: 'porte',
  };
  const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux', 'en', 'sur', 'sous',
    'saint', 'sainte', 'saints', 'st', 'ste', 'hotel', 'ville', 'sncf', 'ancien', 'ancienne', 'paroissiale', 'collegiale',
    'notre', 'municipal', 'municipale', 'communal', 'communale', 'vieux', 'vieille', 'grand', 'grande', 'petit', 'petite',
    'protestant', 'protestante', 'reforme', 'reformee', 'evangelique', 'lutherien', 'lutherienne', 'orthodoxe']);

  const DISTANCE_MAX = 400;      // au-delà, jamais le même lieu (mètres)
  const DISTANCE_FAMILLE = 150;  // en deçà, même famille et noms compatibles : le même lieu

  function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function mots(nom) {
    return sansAccents(nom).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  }

  // les mots qui distinguent ce lieu d'un autre de la même catégorie (« Saint-Martin » → martin)
  function significatifs(nom) {
    return mots(nom).filter((m) => !VIDES.has(m) && !MOTS_CATEGORIE[m] && m.length > 1);
  }

  // la catégorie qu'un nom laisse deviner (« Hôtel de ville de Bagneux » → mairie)
  function categorieDuNom(nom) {
    const m = mots(nom);
    if (m.includes('hotel') && m.includes('ville')) return 'mairie';
    for (const x of m) if (MOTS_CATEGORIE[x]) return MOTS_CATEGORIE[x];
    return '';
  }

  function famille(cat) { return FAMILLE_DE[cat] || ''; }

  function distance(a, b) {
    const dx = (a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180) * 111320;
    const dy = (a[1] - b[1]) * 110540;
    return Math.hypot(dx, dy);
  }

  // lieu : {label, lon, lat, cat?} ; entree : une ligne de la liste
  function memeLieu(lieu, entree) {
    const d = distance([lieu.lon, lieu.lat], [entree[3], entree[4]]);
    if (d > DISTANCE_MAX) return false;
    const a = significatifs(lieu.label), b = significatifs(entree[1]);
    const communs = a.filter((m) => b.includes(m)).length;
    if (a.length && b.length && !communs) return false;           // « Saint-Martin » n'est pas « Sainte-Anne »
    if (communs && (communs >= Math.min(a.length, b.length) || d <= DISTANCE_FAMILLE)) return true;
    const fa = famille(lieu.cat || categorieDuNom(lieu.label)), fb = famille(entree[2]);
    return !!fa && fa === fb && d <= DISTANCE_FAMILLE;            // « Mairie » à 80 m de l'hôtel de ville
  }

  // l'entrée de la liste qui est ce lieu (la plus proche), ou null
  function trouver(lieu, liste) {
    let meilleur = null, dMin = Infinity;
    for (const e of liste || []) {
      if (Math.abs(e[4] - lieu.lat) > 0.005 || Math.abs(e[3] - lieu.lon) > 0.008) continue;  // ~500 m : tri rapide
      if (!memeLieu(lieu, e)) continue;
      const d = distance([lieu.lon, lieu.lat], [e[3], e[4]]);
      if (d < dMin) { dMin = d; meilleur = e; }
    }
    return meilleur;
  }

  // un lieu du jeu fait d'une entrée de la liste
  function lieuDe(entree) {
    return { id: 'wd:' + entree[0], qid: entree[0], label: entree[1], cat: entree[2], lon: entree[3], lat: entree[4],
      citycode: entree[5], type: 'lieu', notoriete: 'celebre' };
  }

  // Pas de marque sur un lieu (décision de Gautier du 3 nov. 2026) : vrai si le nom d'un lieu nommé de l'IGN est celui
  // d'une marque, et le lieu n'entre pas dans les packs. Trois signes :
  // - un château qui ne porte pas le nom d'un lieu (« Château Lynch-Bages », « Château la Bécasse » : dans les vignobles,
  //   presque toujours un domaine viticole ; un château historique se nomme « Château de … », « du … », « des … », « d'… ») ;
  // - un commerce en tête du nom (« Distillerie … »), ou un produit suivi d'un nom propre (« Musée du chocolat Puyodebat ») ;
  // - une marque connue (maisons de champagne et de cognac, chocolatiers, constructeurs, luxe…).
  const PRODUITS = new Set(['chocolat', 'chocolats', 'bonbon', 'bonbons', 'biscuit', 'biscuits', 'confiserie', 'nougat',
    'moutarde', 'liqueur', 'liqueurs', 'parfum', 'parfums', 'savon', 'savons', 'biere', 'bieres', 'cognac', 'armagnac',
    'whisky', 'cidre', 'champagne', 'champagnes', 'vin', 'vins', 'fromage', 'fromages', 'pastis', 'absinthe', 'automobile',
    'automobiles', 'couteau', 'couteaux']);
  const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'd', 'l', 'a', 'sur']);
  const COMMERCE = /^(distillerie|brasserie|chocolaterie|biscuiterie|confiserie|parfumerie|savonnerie|fromagerie|caves?|cellier|chais?|maison de (champagne|cognac))\b/;
  const CHATEAU_DE_LIEU = /^chateaux?( (fort|vieux|neuf|royal|ducal|comtal|seigneurial|episcopal))? (de |du |des |d')/;
  // (pas les noms qui sont aussi ceux d'un saint, d'une ville ou d'une personne : Chanel, Hermès, Baccarat, Renault,
  // Cartier, Mercier, Fragonard, « abbaye bénédictine »…)
  const MARQUES = new RegExp('\\b(' + ['hennessy', 'martell', 'remy martin', 'courvoisier', 'cointreau', 'palais benedictine',
    'byrrh', 'noilly', 'ricard', 'pernod', 'suchard', 'menier', 'banania', 'haribo', 'valrhona', 'michelin', 'peugeot',
    'citroen', 'bugatti', 'christian dior', 'louis vuitton', 'yves saint laurent', 'parfumerie fragonard', 'molinard',
    'galimard', 'opinel', 'christofle', 'bernardaud', 'haviland', 'lalique', 'musee baccarat', 'cristallerie', 'kronenbourg', 'moet',
    'chandon', 'clicquot', 'ruinart', 'pommery', 'taittinger', 'mumm', 'krug', 'bollinger', 'roederer', 'lanson',
    'heidsieck', 'jacquesson', 'bouvet ladubay', 'vache qui rit', 'grevin', 'safran', 'airbus', 'dassault', 'matmut',
    'allianz', 'groupama', 'disney', 'asterix', 'futuroscope', 'center parcs'].join('|') + ')\\b');
  function marque(nom) {
    const n = sansAccents(nom).replace(/[’`]/g, "'").trim(), b = n.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
    if (/^chateaux? /i.test(n) && !CHATEAU_DE_LIEU.test(b)) return true;   // (« Château-Thierry » est une ville)
    if (COMMERCE.test(b) || MARQUES.test(b)) return true;
    const m = n.split(/[\s']+/);   // (« Champagne-Vigny » est une commune : le trait d'union lie les mots)
    for (let i = 0; i + 1 < m.length; i++) {
      if (PRODUITS.has(m[i].toLowerCase()) && /^[A-Z]/.test(m[i + 1]) && !PETITS_MOTS.has(m[i + 1].toLowerCase())) return true;
    }
    return false;
  }

  // le département d'un code INSEE (fichier data/celebres/<département>.json)
  function departement(insee) {
    const c = String(insee || '');
    if (c.startsWith('97')) return c.slice(0, 3);
    return c.slice(0, 2);
  }

  const api = { mots, significatifs, categorieDuNom, famille, distance, memeLieu, trouver, lieuDe, departement, marque, DISTANCE_MAX, DISTANCE_FAMILLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Celebres = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
