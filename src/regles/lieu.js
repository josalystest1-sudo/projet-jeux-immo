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
    // Rareté (décision de Gautier, 3 nov. 2026) : 1 Commun (adresse, standing 1), 2 Peu commun (adresse, standing 2),
    // 3 Rare (lieu nommé au standing 1), 4 Épique (adresse au standing 3, ou lieu nommé au standing 2 ou 3),
    // 5 Légendaire (lieu célèbre, Wikipédia), 6 Extraordinaire (monument, enchères seulement).
    function rarete(lieu) {
      const n = notoriete(lieu), s = standing(lieu);
      if (n === 'monument') return 6;
      if (n === 'celebre') return 5;
      if (n === 'connue') return s >= 2 ? 4 : 3;
      return s >= 3 ? 4 : (s >= 2 ? 2 : 1);
    }
    // Plafond de construction : un bâtiment par rareté (« il ne faut pas deux Immeubles », Gautier, 3 nov.) :
    // Maison, Immeuble, Tour, Gratte-ciel, Palace, Prestige (data/economie.json → plafond_par_rarete).
    function plafond(lieu) { return idx(eco.plafond_par_rarete[String(rarete(lieu))]); }
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
  // Échanger un de ses lieux (plus, si on veut, des pièces) contre le lieu d'un autre joueur.
  // Ce que chacun met dans la balance : écart = (ce que je donne − ce que je reçois) ÷ ce que je reçois.
  function bilanEchange(valeurDonnee, ajout, valeurRecue) {
    const donne = Math.max(0, valeurDonnee) + Math.max(0, ajout || 0), recoit = Math.max(0, valeurRecue);
    return { donne, recoit, ecart: recoit ? (donne - recoit) / recoit : 0 };
  }
  // « 67 Rue des Martyrs » → { numero:'67', voie:'Rue des Martyrs' } ; « 12 bis Rue X » → '12 bis' ; sans numéro → numero ''.
  function numeroEtVoie(label) {
    const t = String(label || '').trim();
    const m = t.match(/^(\d+)\s*(bis|ter|quater|[A-Za-z](?![A-Za-z]))?\s+(\S.*)$/i);
    if (!m) return { numero: '', voie: t };
    return { numero: m[1] + (m[2] ? (m[2].length > 1 ? ' ' + m[2].toLowerCase() : m[2].toUpperCase()) : ''), voie: m[3] };
  }
  // la commune d'un lieu dans le jeu (classements des Maires) : Paris par arrondissement, les autres par leur nom
  function nomCommune(citycode, city) {
    if (!citycode) return city || '?';
    if (String(citycode).startsWith('751')) { const n = parseInt(String(citycode).slice(3), 10); return 'Paris ' + n + (n === 1 ? 'er' : 'e'); }
    return city || citycode;
  }
  // Le jour du jeu (pack du jour, récolte) : en vrais jours (24 h), le jour de calendrier à Paris (le pack se
  // renouvelle à minuit) ; en jours accélérés (serveur d'essai, démo), des tranches de jourMs depuis 1970.
  const PARIS_JOUR = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
  const PARIS_HEURE = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : null;
  function jourDuJeu(ms, jourMs) {
    if (jourMs >= 86400000 && PARIS_JOUR) { const [y, m, j] = PARIS_JOUR.format(new Date(ms)).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, j) / 86400000); }
    return Math.floor(ms / jourMs);
  }
  function secondesAvantJourSuivant(ms, jourMs) {
    if (jourMs >= 86400000 && PARIS_HEURE) { const [h, mi, s] = PARIS_HEURE.format(new Date(ms)).split(':').map(Number); return Math.max(1, 86400 - (h * 3600 + mi * 60 + s)); }
    return Math.max(1, Math.ceil(((Math.floor(ms / jourMs) + 1) * jourMs - ms) / 1000));
  }
  const api = { creer, numeroEtVoie, bilanEchange, nomCommune, jourDuJeu, secondesAvantJourSuivant, PRIX_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Regles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
