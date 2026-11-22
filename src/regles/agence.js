// L'agence : le jeu « idle » de StreetKeep (16 nov. 2026, idée de Gautier ; GDD § 5 sexies). À quoi servent les pièces quand
// on a tout construit ? À faire tourner une agence.
//   - Les pièces embauchent des employés (trois postes au départ, sept depuis le 22 nov.). Chaque embauche d'un poste coûte plus cher que la précédente.
//   - Les employés produisent du renom, heure après heure, même en l'absence du joueur (48 h du jeu au plus sans visite).
//   - Quand le renom atteint un seuil, on peut tout remettre à zéro (employés et renom) contre une brique. Chaque brique de
//     la saison accélère un peu le renom ; la suivante demande plus de renom.
//   - À la fin de la saison, les briques sont comptées (classement), puis tout repart de zéro.
// Quatre postes de plus depuis le 22 nov. 2026 (Gautier : « encore plus d'étages, encore plus de personnages à acheter »,
// mais « il ne faut pas qu'on cumule des bonus très forts » ni des compteurs de briques aberrants) ; aucun ne produit de
// renom à lui seul, chacun a un petit effet, un nombre limité, et un prix qui grimpe vite :
//   - le réceptionniste : l'agence travaille plus longtemps sans visite (+6 h chacun, 8 au plus) ;
//   - le formateur : les autres embauches coûtent un peu moins cher (−2 % chacun, 15 au plus) ;
//   - le photographe : chaque brique de la saison donne un peu plus de renom (12 au plus) ;
//   - l'associé : ouvert après 5 briques, très cher (chaque suivant sept fois plus), il reste jusqu'à la fin de la
//     saison et fait garder une part des agents et des négociateurs quand on pose une brique (10 % chacun, 5 au plus).
// Le seuil des briques, lui, grimpe toujours de 40 % à chaque brique : dix fois plus de renom = sept briques de plus.
// Les trois premiers postes ne s'additionnent pas, ils se multiplient : des agents (le renom de base), des négociateurs (un bonus sur
// les agents), des directeurs (tout multiplié). Le meilleur achat change sans cesse : pas de ligne droite.
// Équilibre voulu (tests/agence.test.js le vérifie par simulation) : dépenser dix fois plus de pièces ne rapporte pas dix
// fois plus de briques, mais quelques-unes de plus ; c'est la régularité qui paie. Un débutant pose sa première brique en
// quelques jours ; personne n'est bloqué (le premier agent coûte moins qu'un salaire quotidien).
// Module pur : pas de réseau, pas de date lue ici (on lui donne l'instant, la durée d'un jour du jeu, la saison).
(function (racine) {
  function creer(eco) {
    const A = eco.agence, POSTES = Object.keys(A.postes);
    const vide = () => { const e = {}; POSTES.forEach((p) => { e[p] = 0; }); return e; };
    const tous = (e) => { const r = {}; POSTES.forEach((p) => { r[p] = nombre(e, p); }); return r; };
    // une agence toute neuve pour une saison
    const neuve = (saison, maintenant) => ({ saison, e: vide(), renom: 0, le: maintenant, briques: 0, total: 0 });
    const nombre = (e, p) => Math.max(0, Math.floor(Number(e && e[p]) || 0));
    // le prix de la prochaine embauche d'un poste (n : combien on en a déjà)
    const cout = (poste, n) => Math.ceil(A.postes[poste].base * Math.pow(A.postes[poste].croissance, n));
    // le prix pour cette agence : les formateurs font une remise sur les autres postes (jamais sur eux-mêmes ni sur l'associé)
    function prix(a, poste) {
      const c = cout(poste, nombre(a.e, poste)), f = A.postes.formateur;
      if (!f || poste === 'formateur' || poste === 'associe') return c;
      return Math.ceil(c * Math.pow(1 - f.remise, Math.min(f.max, nombre(a.e, 'formateur'))));
    }
    // les heures que l'agence travaille sans visite
    const heuresSansVisite = (e) => A.stock_heures + (A.postes.receptionniste ? A.postes.receptionniste.heures * Math.min(A.postes.receptionniste.max, nombre(e, 'receptionniste')) : 0);
    // le renom produit par heure du jeu : agents × (1 + bonus des négociateurs) × directeurs × briques de la saison
    function debit(e, briques) {
      const P = A.postes;
      return nombre(e, 'agent') * P.agent.renom * (1 + P.negociateur.bonus * nombre(e, 'negociateur')) * Math.pow(P.directeur.facteur, nombre(e, 'directeur')) * (1 + (A.brique.bonus + (P.photographe ? P.photographe.brique * Math.min(P.photographe.max, nombre(e, 'photographe')) : 0)) * Math.max(0, briques || 0));
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
      const heures = Math.max(0, Math.min(heuresSansVisite(a.e), (maintenant - a.le) / (jourMs / 24)));
      return { saison: a.saison, e: tous(a.e), renom: Math.max(0, a.renom || 0) + debit(a.e, a.briques) * heures, le: maintenant, briques: Math.max(0, a.briques || 0), total: Math.max(0, a.total || 0) };
    }
    // embaucher : { ok, raison, cout, agence } ; l'agence doit être à jour (avancer) ; dispo : les pièces qu'on peut dépenser
    function embaucher(a, poste, dispo) {
      if (!A.postes[poste]) return { ok: false, raison: 'poste' };
      const n = nombre(a.e, poste), total = POSTES.reduce((s, p) => s + nombre(a.e, p), 0);
      if (total >= A.employes_max) return { ok: false, raison: 'complet' };
      const P = A.postes[poste];
      if (P.debloque && (a.briques || 0) < P.debloque) return { ok: false, raison: 'verrou', briques: P.debloque };
      if (P.max && n >= P.max) return { ok: false, raison: 'max' };
      const c = prix(a, poste);
      if (c > dispo) return { ok: false, raison: 'fonds', cout: c };
      return { ok: true, cout: c, agence: Object.assign({}, a, { e: Object.assign({}, a.e, { [poste]: n + 1 }) }) };
    }
    // poser des briques : tout repart de zéro (employés, renom), les briques s'ajoutent
    function poser(a) {
      const n = briquesPossibles(a.renom, a.briques);
      if (!n) return { ok: false, raison: 'renom', manque: Math.ceil(seuil(a.briques) - a.renom) };
      // ce qui reste : les associés eux-mêmes, et la part des agents et des négociateurs qu'ils font garder
      const e = vide(), as = A.postes.associe, k = as ? Math.min(as.max, nombre(a.e, 'associe')) : 0;
      POSTES.forEach((p) => { if (A.postes[p].reste) e[p] = nombre(a.e, p); });
      if (k) ['agent', 'negociateur'].forEach((p) => { e[p] = Math.floor(nombre(a.e, p) * as.garde * k); });
      return { ok: true, briques: n, agence: Object.assign({}, a, { e, renom: 0, briques: a.briques + n, total: (a.total || 0) + n }) };
    }
    // ce que rapporterait une embauche de plus (pour montrer le meilleur achat) : le renom par heure gagné
    const gain = (a, poste) => debit(Object.assign({}, a.e, { [poste]: nombre(a.e, poste) + 1 }), a.briques) - debit(a.e, a.briques);
    return { A, POSTES, neuve, cout, prix, heuresSansVisite, debit, seuil, briquesPossibles, avancer, embaucher, poser, gain };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Agence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
