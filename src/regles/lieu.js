// Règles d'un lieu : standing, notoriété, plafond, rareté, valeur, loyer.
// Module pur : aucun réseau, aucun DOM, aucun hasard. Utilisable dans le navigateur (global `Regles`) et dans Node (tests).
(function (racine) {
  function creer(eco) {
    const NIVEAUX = eco.niveaux;
    const idx = (id) => NIVEAUX.findIndex((n) => n.id === id);

    // Standing provisoire par code INSEE (le vrai vient de DVF, phase 1.5).
    function standing(lieu) {
      if (lieu.standing) return lieu.standing;
      const c = String(lieu.citycode || '');
      if (c.startsWith('751')) { const a = parseInt(c.slice(3), 10); return (a <= 8 || a === 16 || a === 17) ? 3 : 2; }
      if (/^(92|69|13|33|31|44|59|67|06|35|34|38|54|21|76|45|49|63|30|83|84|87|37|72|29|56|64|66|68|25|51|57|80|86|14|17|19|24|26|27|28|36|39|40|41|42|43|46|47|48|50|52|53|55|58|60|61|62|65|70|71|73|74|77|78|79|81|82|85|88|89|90|91|93|94|95)/.test(c)) {
        return /^(92|69|13|33|31|44|59|67|06|35|34|38|77|78|91|93|94|95)/.test(c) ? 2 : 1;
      }
      return 1;
    }
    function notoriete(lieu) { return lieu.notoriete || (lieu.type === 'monument' ? 'monument' : (lieu.type === 'lieu' ? 'connue' : 'commune')); }
    function plafond(lieu) {
      if (notoriete(lieu) === 'monument') return idx('prestige');
      return Math.min(idx('tour'), standing(lieu) + eco.notoriete[notoriete(lieu)]);
    }
    function rarete(lieu) {
      const n = notoriete(lieu); if (n === 'monument') return 5;
      const p = plafond(lieu); if (p >= idx('tour')) return 4;
      if (n === 'connue' || n === 'celebre') return 3;
      return standing(lieu) >= 2 ? 2 : 1;
    }
    function valeurBase(lieu) { return eco.standing[String(standing(lieu))].base * eco.multiplicateur_valeur[notoriete(lieu)]; }
    function coutNiveau(lieu, niveau) { return Math.round(valeurBase(lieu) * NIVEAUX[niveau].cout); }
    function peutConstruire(lieu, niveau) { return niveau === (lieu.niveau || 0) + 1 && niveau <= plafond(lieu); }
    function valeur(lieu) { let v = valeurBase(lieu); for (let n = 1; n <= (lieu.niveau || 0); n++) v += coutNiveau(lieu, n); return v; }
    function loyerParJour(lieu) { return eco.loyer_terrain + NIVEAUX[lieu.niveau || 0].loyer; }
    function loyerTotal(lieux) { return lieux.reduce((s, l) => s + loyerParJour(l), 0); }
    // Ce qu'un joueur encaisse à la connexion : salaire + loyers, au plus `stock_loyer_heures` heures.
    function aEncaisser(lieux, depuisMs, maintenantMs, msParJour) {
      const plafondMs = eco.stock_loyer_heures * (msParJour / 24);
      const dt = Math.max(0, Math.min(maintenantMs - depuisMs, plafondMs));
      return Math.floor((eco.salaire_par_jour + loyerTotal(lieux)) * dt / msParJour);
    }
    function nomRarete(r) { return eco.raretes[String(r)]; }
    function texteNiveau(n) { return NIVEAUX[n].nom; }
    return { standing, notoriete, plafond, rarete, valeurBase, coutNiveau, peutConstruire, valeur, loyerParJour, loyerTotal, aEncaisser, nomRarete, texteNiveau, NIVEAUX, eco };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Regles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
