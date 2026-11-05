// CityDeck : les joueurs de la maison (les robots), règles pures (GDD § 5 quater ; décision de Gautier du 5 nov. 2026 :
// « laisser les robots au début du jeu, mais leur donner des consignes pour jouer comme des humains et ne pas abuser ;
// on les retirera progressivement avec la montée des joueurs »). Aucun accès réseau, aucun hasard sans graine.
//   const ROB = Robots.creer(ECO)   (réglages : ECO.robots)
(function (racine) {
  // un nombre pseudo-aléatoire stable entre 0 et 1, tiré d'un texte (la même graine donne toujours le même nombre)
  function alea(graine) { let h = 2166136261; const s = String(graine); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

  function creer(ECO) {
    const C = ECO.robots;
    // combien de robots jouent, selon le nombre de vrais joueurs venus dans les 7 derniers jours : ils se retirent peu à peu
    function nombreActifs(humains) { return Math.max(0, Math.min(C.max, Math.ceil((C.retrait_humains - humains) / C.humains_par_robot))); }
    // les heures de jeu d'un robot pour un jour : 2 à 4 séances, entre l'heure du lever et celle du coucher, différentes chaque jour
    function seances(robot, jour) {
      const n = C.seances_min + Math.floor(alea(robot + ':n:' + jour) * (C.seances_max - C.seances_min + 1)), r = [];
      for (let k = 0; k < n; k++) {
        const debut = C.heure_debut + alea(robot + ':s' + k + ':' + jour) * (C.heure_fin - C.heure_debut - C.seance_heures);
        r.push([debut, debut + C.seance_heures * (0.6 + 0.4 * alea(robot + ':d' + k + ':' + jour))]);
      }
      return r.sort((a, b) => a[0] - b[0]);
    }
    // le robot est-il en train de jouer ? heure = l'heure du jeu (0 à 24) ; accéléré = le serveur d'essai (jours de 60 s) :
    // les séances n'ont alors pas de sens, le robot joue à chaque tour
    function enSeance(robot, jour, heure, accelere) { if (accelere) return true; return seances(robot, jour).some(([a, b]) => heure >= a && heure < b); }
    // le temps que met un robot à répondre à une offre ou à un échange, en heures du jeu (comme quelqu'un qui passe plus tard)
    function delaiReponse(id) { return C.reponse_heures_min + alea(id + ':rep') * (C.reponse_heures_max - C.reponse_heures_min); }
    // accepter une offre ou un échange : seulement au-dessus de la valeur (comme un vendeur raisonnable)
    function accepte(montant, valeur) { return montant >= valeur * C.accepte_au_dessus; }
    // le prix d'une offre sur le lieu d'un vrai joueur : correct, jamais une offre au rabais
    function prixOffre(valeur, graine) { return valeur * (C.offre_min + alea(graine) * (C.offre_max - C.offre_min)); }
    // acheter un lieu mis en vente : jamais une affaire due à une erreur de prix (elle reste aux vrais joueurs), jamais trop cher
    function peutAcheter(prix, valeur) { return prix >= valeur * C.achat_min && prix <= valeur * C.achat_max; }
    // le prix d'une mise en vente par un robot
    function prixVente(valeur, graine) { return valeur * (C.vente_min + alea(graine) * (C.vente_max - C.vente_min)); }
    // les enchères : jamais dans la dernière heure du lot (pas de mise au dernier moment), deux mises au plus par lot et
    // par robot, et pas au-delà d'un plafond raisonnable ; rend la mise, ou null
    function mise(depart, meilleure, restantHeures, misesDuRobot, pas) {
      if (restantHeures < C.encheres_pas_derniere_heure || misesDuRobot >= C.encheres_mises_max) return null;
      const m = Math.ceil(Math.ceil(meilleure * (1 + pas)) / 100) * 100;
      return m <= depart * C.encheres_plafond ? m : null;
    }
    // verser à la caisse d'une commune : seulement là où aucun vrai joueur n'a versé ce mandat (un robot ne prend jamais
    // une mairie à un vrai joueur ; il anime les communes vides)
    function peutVerser(versementsHumains) { return !(versementsHumains > 0); }
    // garder un lieu de plus ? pas plus d'un certain nombre en tout ni par commune (ne pas envahir le quartier d'un joueur)
    function peutPrendre(nLieux, nDansCommune) { return nLieux < C.lieux_max && nDansCommune < C.par_commune_max; }
    // jamais de gemmes avec un robot, ni pour vendre ni pour acheter (Gautier, 5 nov.) : seulement des pièces
    function devisePermise(devise) { return (devise || 'pieces') === 'pieces'; }
    // l'élection d'un Maire : dès qu'un vrai joueur a versé au moins le seuil, les robots ne comptent pas (un robot ne prend
    // jamais une mairie à un vrai joueur) ; lignes = [{ joueur, points }]
    function electeurs(lignes, estRobot, seuil) { const h = lignes.filter((r) => !estRobot(r.joueur)); return h.some((r) => Number(r.points) >= seuil) ? h : lignes; }
    return { C, alea, nombreActifs, seances, enSeance, delaiReponse, accepte, prixOffre, peutAcheter, prixVente, mise, peutVerser, peutPrendre, electeurs, devisePermise };
  }
  const Robots = { creer, alea };
  if (typeof module !== 'undefined' && module.exports) module.exports = Robots; else racine.Robots = Robots;
})(typeof window !== 'undefined' ? window : globalThis);
