// Les monuments : prestige, pas revenu (GDD § 5 ter, décisions de Gautier du 4 nov. 2026 ; chiffres proposés).
// - L'entretien : le n-ième monument d'un joueur (dans l'ordre d'arrivée) coûte base × 2^(n−1) pièces par mois du jeu
//   (300, 600, 1 200…), prélevées sur ses pièces au fil des jours, sans plafond de temps (il court même si l'on ne
//   récolte pas). Ce qui ne peut pas être payé devient une dette ; après un mois d'impayé, le monument le plus cher (le
//   dernier arrivé) est remis aux enchères (prévenu 7 jours avant).
// - L'absence : un joueur qui ne vient pas pendant 14 jours perd ses monuments (ils reviennent aux enchères) ; les
//   adresses et autres lieux ne sont jamais repris.
// Module pur : pas de réseau, pas de date lue ici (on lui donne les instants et la durée d'un jour du jeu).
(function (racine) {
  function creer(eco) {
    const M = eco.monuments;
    // les monuments d'un joueur, du premier arrivé au dernier, avec leur entretien par mois
    function entretiens(lieux) {
      return (lieux || []).filter((l) => l.type === 'monument')
        .sort((a, b) => (a.depuis || 0) - (b.depuis || 0) || (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)))
        .map((l, i) => ({ id: l.id, label: l.label, parMois: M.entretien_base * Math.pow(2, i) }));
    }
    const parMois = (lieux) => entretiens(lieux).reduce((s, e) => s + e.parMois, 0);
    const parJour = (lieux) => parMois(lieux) / M.entretien_jours;
    // ce que coûterait un monument de plus (par mois)
    const prochain = (lieux) => M.entretien_base * Math.pow(2, entretiens(lieux).length);
    // l'entretien dû depuis le dernier paiement, en pièces entières, et le temps qu'elles couvrent (pour ne rien perdre
    // des fractions : le compteur n'avance que de ce qui a été compté)
    function du(lieux, depuisMs, maintenantMs, jourMs) {
      const pj = parJour(lieux); if (!(pj > 0)) return { montant: 0, couvreMs: Math.max(0, maintenantMs - depuisMs) };
      const montant = Math.floor(pj * Math.max(0, maintenantMs - depuisMs) / jourMs);
      return { montant, couvreMs: montant * jourMs / pj };
    }
    // payer avec ses pièces ce qui est dû plus la dette ; ce qui manque reste en dette, et l'impayé court depuis le premier
    // manque (il s'arrête dès que tout est payé)
    function payer(pieces, dette, montant, impayeDepuis, maintenant) {
      const total = Math.max(0, dette || 0) + Math.max(0, montant || 0), paye = Math.min(total, Math.max(0, Math.floor(pieces || 0))), reste = total - paye;
      return { paye, dette: reste, impayeDepuis: reste > 0 ? (impayeDepuis == null ? maintenant : impayeDepuis) : null };
    }
    // où en est un impayé : 'ok', 'avertir' (7 jours avant), 'reprendre'
    function impaye(impayeDepuis, maintenant, jourMs) {
      if (impayeDepuis == null) return 'ok';
      const j = (maintenant - impayeDepuis) / jourMs;
      return j >= M.impaye_jours ? 'reprendre' : (j >= M.impaye_avertir_jours ? 'avertir' : 'ok');
    }
    // où en est une absence : 'ok', 'avertir' (3 jours avant), 'reprendre'
    function absence(vuLe, maintenant, jourMs) {
      const j = (maintenant - vuLe) / jourMs;
      return j >= M.absence_jours ? 'reprendre' : (j >= M.absence_avertir_jours ? 'avertir' : 'ok');
    }
    // le monument remis aux enchères en cas d'impayé : le plus cher, donc le dernier arrivé
    const plusCher = (lieux) => { const e = entretiens(lieux); return e.length ? e[e.length - 1].id : null; };
    // les jours qui restent avant la reprise pour impayé
    const joursAvantReprise = (impayeDepuis, maintenant, jourMs) => (impayeDepuis == null ? null : Math.max(0, Math.ceil(M.impaye_jours - (maintenant - impayeDepuis) / jourMs)));
    return { entretiens, parMois, parJour, prochain, du, payer, impaye, absence, plusCher, joursAvantReprise, M };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Monuments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
