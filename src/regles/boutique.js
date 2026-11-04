// La boutique et les gemmes (GDD § 3 et § 9, décisions de Gautier du 4 nov. 2026). Les gemmes : la monnaie premium,
// à sens unique (euros → gemmes ; jamais gemmes → euros, jamais gemmes → pièces). Elles achètent des packs (national :
// toute la France ; régional : la région choisie, un peu plus cher) et le Pass 15 jours (le pack du jour a 8 cartes au lieu
// de 5, et un bon pour prendre l'adresse libre de son choix, jusqu'à Épique, hors monument). Les pièces ne s'achètent
// jamais. Le pack gratuit du jour reste gratuit. Module pur : pas de réseau, pas de date lue ici.
(function (racine) {
  function creer(eco) {
    const B = eco.boutique;
    const prix = (article) => B.prix[article];
    const peutPayer = (article, gemmes) => Number.isFinite(prix(article)) && (gemmes || 0) >= prix(article);
    const passActif = (fin, maintenant) => fin != null && fin > maintenant;
    // acheter un Pass : 15 jours de plus (à partir de sa fin s'il court encore), un bon de plus (3 au plus ; les bons d'un
    // Pass fini sont perdus)
    function acheterPass(pass, maintenant, jourMs) {
      const actif = passActif(pass && pass.fin, maintenant);
      return { fin: Math.max(actif ? pass.fin : 0, maintenant) + B.pass_jours * jourMs, bons: Math.min(B.bons_max, (actif ? (pass.bons || 0) : 0) + 1) };
    }
    const bonsUtilisables = (pass, maintenant) => (pass && passActif(pass.fin, maintenant) ? (pass.bons || 0) : 0);
    // le pack du jour : 8 cartes avec un Pass actif, sinon 5
    const cartesDuJour = (pass, maintenant) => (pass && passActif(pass.fin, maintenant) ? B.pass_cartes : eco.pack.cartes);
    // un lieu qu'un bon peut prendre : libre, pas un monument, jusqu'à Épique
    function bonPermis(lieu, rarete, libre) {
      if (!libre) return { ok: false, raison: 'pris' };
      if (!lieu || lieu.type === 'monument' || rarete > B.bon_rarete_max) return { ok: false, raison: 'rarete' };
      return { ok: true };
    }
    // les chances de chaque rareté, par carte (affichées dans la boutique : obligation des « loot boxes »)
    const probabilites = () => Object.entries(eco.pack.chances).map(([r, p]) => ({ r: Number(r), pct: p }));
    return { prix, peutPayer, passActif, acheterPass, bonsUtilisables, cartesDuJour, bonPermis, probabilites, B };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Boutique = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
