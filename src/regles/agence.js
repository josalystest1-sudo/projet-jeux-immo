// L'agence : le jeu « idle » de StreetKeep (16 nov. 2026, idée de Gautier ; GDD § 5 sexies). À quoi servent les pièces quand
// on a tout construit ? À faire tourner une agence.
//   - Les pièces embauchent des employés (trois postes). Chaque embauche d'un poste coûte plus cher que la précédente.
//   - Les employés produisent du renom, heure après heure, même en l'absence du joueur (48 h du jeu au plus sans visite).
//   - Quand le renom atteint un seuil, on peut tout remettre à zéro (employés et renom) contre une brique. Chaque brique de
//     la saison accélère un peu le renom ; la suivante demande plus de renom.
//   - À la fin de la saison, les briques sont comptées (classement), puis tout repart de zéro.
// Les trois postes ne s'additionnent pas, ils se multiplient : des agents (le renom de base), des négociateurs (un bonus sur
// les agents), des directeurs (tout multiplié). Le meilleur achat change sans cesse : pas de ligne droite.
// Équilibre voulu (tests/agence.test.js le vérifie par simulation) : dépenser dix fois plus de pièces ne rapporte pas dix
// fois plus de briques, mais quelques-unes de plus ; c'est la régularité qui paie. Un débutant pose sa première brique en
// quelques jours ; personne n'est bloqué (le premier agent coûte moins qu'un salaire quotidien).
// Module pur : pas de réseau, pas de date lue ici (on lui donne l'instant, la durée d'un jour du jeu, la saison).
(function (racine) {
  function creer(eco) {
    const A = eco.agence, POSTES = Object.keys(A.postes);
    const vide = () => ({ agent: 0, negociateur: 0, directeur: 0 });
    // une agence toute neuve pour une saison
    const neuve = (saison, maintenant) => ({ saison, e: vide(), renom: 0, le: maintenant, briques: 0, total: 0 });
    const nombre = (e, p) => Math.max(0, Math.floor(Number(e && e[p]) || 0));
    // le prix de la prochaine embauche d'un poste (n : combien on en a déjà)
    const cout = (poste, n) => Math.ceil(A.postes[poste].base * Math.pow(A.postes[poste].croissance, n));
    // le renom produit par heure du jeu : agents × (1 + bonus des négociateurs) × directeurs × briques de la saison
    function debit(e, briques) {
      const P = A.postes;
      return nombre(e, 'agent') * P.agent.renom * (1 + P.negociateur.bonus * nombre(e, 'negociateur')) * Math.pow(P.directeur.facteur, nombre(e, 'directeur')) * (1 + A.brique.bonus * Math.max(0, briques || 0));
    }
    // le renom qu'il faut pour la brique suivante (b : les briques déjà posées cette saison)
    const seuil = (b) => Math.round(A.brique.seuil * Math.pow(A.brique.croissance, Math.max(0, b || 0)));
    // les briques que ce renom permet de poser d'un coup (on peut attendre pour en poser plusieurs)
    function briquesPossibles(renom, b) { let n = 0, reste = Math.max(0, renom || 0); while (n < 50 && reste >= seuil(b + n)) { reste -= seuil(b + n); n++; } return n; }
    // l'agence à un instant : nouvelle saison = tout repart de zéro (les briques passées restent dans « total ») ; sinon
    // le renom produit depuis la dernière visite, 48 h du jeu au plus
    function avancer(a, maintenant, jourMs, saison) {
      if (!a) return neuve(saison, maintenant);
      if (a.saison !== saison) return Object.assign(neuve(saison, maintenant), { total: Math.max(0, a.total || 0) });
      const heures = Math.max(0, Math.min(A.stock_heures, (maintenant - a.le) / (jourMs / 24)));
      return { saison: a.saison, e: { agent: nombre(a.e, 'agent'), negociateur: nombre(a.e, 'negociateur'), directeur: nombre(a.e, 'directeur') }, renom: Math.max(0, a.renom || 0) + debit(a.e, a.briques) * heures, le: maintenant, briques: Math.max(0, a.briques || 0), total: Math.max(0, a.total || 0) };
    }
    // embaucher : { ok, raison, cout, agence } ; l'agence doit être à jour (avancer) ; dispo : les pièces qu'on peut dépenser
    function embaucher(a, poste, dispo) {
      if (!A.postes[poste]) return { ok: false, raison: 'poste' };
      const n = nombre(a.e, poste), total = POSTES.reduce((s, p) => s + nombre(a.e, p), 0);
      if (total >= A.employes_max) return { ok: false, raison: 'complet' };
      const c = cout(poste, n);
      if (c > dispo) return { ok: false, raison: 'fonds', cout: c };
      return { ok: true, cout: c, agence: Object.assign({}, a, { e: Object.assign({}, a.e, { [poste]: n + 1 }) }) };
    }
    // poser des briques : tout repart de zéro (employés, renom), les briques s'ajoutent
    function poser(a) {
      const n = briquesPossibles(a.renom, a.briques);
      if (!n) return { ok: false, raison: 'renom', manque: Math.ceil(seuil(a.briques) - a.renom) };
      return { ok: true, briques: n, agence: Object.assign({}, a, { e: vide(), renom: 0, briques: a.briques + n, total: (a.total || 0) + n }) };
    }
    // ce que rapporterait une embauche de plus (pour montrer le meilleur achat) : le renom par heure gagné
    const gain = (a, poste) => debit(Object.assign({}, a.e, { [poste]: nombre(a.e, poste) + 1 }), a.briques) - debit(a.e, a.briques);
    return { A, POSTES, neuve, cout, debit, seuil, briquesPossibles, avancer, embaucher, poser, gain };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Agence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
