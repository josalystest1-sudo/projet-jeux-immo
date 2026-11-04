// Les classements et les saisons (GDD § 5 bis, 4 nov. 2026). Module pur : pas de réseau, pas de date lue ici.
// - Le patrimoine d'un joueur : ses lieux pondérés par rareté (Commun 1 … monument 20), plus le bâtiment construit sur
//   chacun (Maison +1 … Prestige +15). Classement national et par commune.
// - Le classement des Maires d'une saison : chaque mairie gagnée vaut le nombre de ses rivaux (les autres joueurs qui ont
//   versé au moins le seuil à la caisse) : une mairie gagnée contre 10 joueurs vaut 10, contre personne 0.
// - Une saison dure 6 mandats de Maire (12 semaines du jeu, à peu près 3 mois) ; à sa fin, les classements sont figés
//   (podium, « Maire de la saison » sur la fiche de chaque commune), puis le classement des Maires repart à zéro. Le
//   patrimoine et les lieux restent.
(function (racine) {
  function creer(eco) {
    const C = eco.classements;
    const pointsLieu = (rarete, niveau) => (C.poids_rarete[String(rarete)] || 0) + (C.bonus_niveau[niveau || 0] || 0);
    // le patrimoine de lieux (rareteDe : la rareté d'un lieu, les règles de src/regles/lieu.js)
    function patrimoine(lieux, rareteDe) { return (lieux || []).reduce((s, l) => s + pointsLieu(rareteDe(l), l.niveau || 0), 0); }
    // la saison d'un mandat, son premier mandat, ses mandats
    const saison = (mandat) => Math.floor(mandat / C.mandats_par_saison);
    const premierMandat = (s) => s * C.mandats_par_saison;
    const mandatsDe = (s) => Array.from({ length: C.mandats_par_saison }, (_, i) => s * C.mandats_par_saison + i);
    // le numéro affiché (« Saison 1 ») : à partir de la saison où le jeu a commencé
    const numero = (s, origine) => s - origine + 1;
    // un classement : { qui: points } → [{ qui, n, rang }] du meilleur au moins bon (à égalité, le même rang ; puis par
    // nom, pour un ordre stable) ; ceux qui n'ont aucun point n'y sont pas
    function classer(scores) {
      const rangs = Object.entries(scores || {}).map(([qui, n]) => ({ qui, n: Math.floor(n) })).filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n || (a.qui < b.qui ? -1 : (a.qui > b.qui ? 1 : 0)));
      let rang = 0, prec = null;
      rangs.forEach((r, i) => { if (r.n !== prec) { rang = i + 1; prec = r.n; } r.rang = rang; });
      return rangs;
    }
    // les points des Maires d'une saison, et le nombre de mairies gagnées (élections : [{ maires, rivaux }])
    function pointsMaires(elections) { const o = {}; for (const e of elections || []) for (const q of e.maires) o[q] = (o[q] || 0) + e.rivaux; return o; }
    function mairiesGagnees(elections) { const o = {}; for (const e of elections || []) for (const q of e.maires) o[q] = (o[q] || 0) + 1; return o; }
    // le Maire de la saison d'une commune : celui qui a tenu la mairie le plus de mandats ; à égalité, le plus récent
    // (mairesParMandat : les Maires de chaque mandat de la saison, dans l'ordre)
    function maireDeSaison(mairesParMandat) {
      const n = {}, der = {};
      (mairesParMandat || []).forEach((ms, i) => { for (const q of ms || []) { n[q] = (n[q] || 0) + 1; der[q] = i; } });
      const l = Object.keys(n); if (!l.length) return null;
      l.sort((a, b) => n[b] - n[a] || der[b] - der[a] || (a < b ? -1 : 1));
      return l[0];
    }
    return { pointsLieu, patrimoine, saison, premierMandat, mandatsDe, numero, classer, pointsMaires, mairiesGagnees, maireDeSaison, C };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Classements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
