// Règles d'un lieu : standing, notoriété, plafond, rareté, valeur, loyer.
// Module pur : aucun réseau, aucun DOM, aucun hasard. Utilisable dans le navigateur (global `Regles`) et dans Node (tests).
(function (racine) {
  function creer(eco, table) {
    const NIVEAUX = eco.niveaux;
    const idx = (id) => NIVEAUX.findIndex((n) => n.id === id);

    // Standing d'une commune (1 Maison, 2 Immeuble, 3 Tour), d'après les prix immobiliers réels (data/standing.json).
    // Les arrondissements de Paris, Lyon et Marseille prennent le standing de leur ville (DVF est agrégé par ville).
    function communeDvf(code) {
      const c = String(code || '');
      if (/^751\d\d$/.test(c)) return '75056';
      if (/^6938\d$/.test(c)) return '69123';
      if (/^132\d\d$/.test(c)) return '13055';
      return c;
    }
    function standing(lieu) {
      if (lieu.standing) return lieu.standing;
      return (table && table[communeDvf(lieu.citycode || lieu.insee)]) || 1;
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
    // Vendre : le vendeur fixe son prix (prix libre, GDD § marché). Un nombre entier de pièces, de 1 à PRIX_MAX.
    // Le texte tapé peut contenir des espaces (« 12 500 ») ; renvoie { ok, prix } ou { ok:false, raison:'vide'|'zero'|'trop' }.
    function lirePrix(texte) {
      const t = String(texte == null ? '' : texte).replace(/[\s\u00a0\u202f.]/g, '');
      if (!/^\d+$/.test(t)) return { ok: false, raison: 'vide' };
      const prix = parseInt(t, 10);
      if (prix < 1) return { ok: false, raison: 'zero' };
      if (prix > PRIX_MAX) return { ok: false, raison: 'trop' };
      return { ok: true, prix };
    }
    function nomRarete(r) { return eco.raretes[String(r)]; }
    function texteNiveau(n) { return NIVEAUX[n].nom; }
    return { lirePrix, PRIX_MAX, numeroEtVoie, communeDvf, standing, notoriete, plafond, rarete, valeurBase, coutNiveau, peutConstruire, valeur, loyerParJour, loyerTotal, aEncaisser, nomRarete, texteNiveau, NIVEAUX, eco };
  }
  const PRIX_MAX = 1000000000;
  // « 67 Rue des Martyrs » → { numero:'67', voie:'Rue des Martyrs' } ; « 12 bis Rue X » → '12 bis' ; sans numéro → numero ''.
  function numeroEtVoie(label) {
    const t = String(label || '').trim();
    const m = t.match(/^(\d+)\s*(bis|ter|quater|[A-Za-z](?![A-Za-z]))?\s+(\S.*)$/i);
    if (!m) return { numero: '', voie: t };
    return { numero: m[1] + (m[2] ? (m[2].length > 1 ? ' ' + m[2].toLowerCase() : m[2].toUpperCase()) : ''), voie: m[3] };
  }
  const api = { creer, numeroEtVoie, PRIX_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Regles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
