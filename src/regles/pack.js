// Le pack (GDD « Les packs ») : la rareté de chaque carte, tirée avec les chances de data/economie.json → pack.chances
// (60 % Commun, 26 % Peu commun, 11 % Rare, 3 % Épique ; jamais de monument). Module pur : le hasard vient d'une graine.
(function (racine) {
  // une graine (entier 32 bits) depuis un texte : « joueur:jour:numéro du pack »
  function graine(texte) {
    let h = 2166136261;
    for (const c of String(texte)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // un générateur pseudo-aléatoire reproductible (mulberry32) : rng() dans [0, 1)
  function alea(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // une rareté (1 à 4) selon les chances { "1": 60, "2": 26, ... }
  function rarete(chances, rng) {
    const cles = Object.keys(chances).map(Number).sort((a, b) => a - b);
    const total = cles.reduce((s, k) => s + chances[k], 0);
    let x = rng() * total;
    for (const k of cles) { x -= chances[k]; if (x < 0) return k; }
    return cles[cles.length - 1];
  }

  // les raretés des n cartes d'un pack
  function raretes(n, chances, rng) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(rarete(chances, rng));
    return out;
  }

  // une carte tirée convient-elle ? La bonne rareté, libre, pas déjà dans le pack.
  function convient(lieu, rareteVoulue, rareteDe, estLibre, dejaTires) {
    return !!lieu && rareteDe(lieu) === rareteVoulue && estLibre(lieu) && !dejaTires.some((c) => c.id === lieu.id);
  }

  const api = { graine, alea, rarete, raretes, convient };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Pack = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
