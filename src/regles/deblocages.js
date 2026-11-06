// Les fonctions qui se débloquent en jouant (6 nov. 2026, interview de Gautier : « à débloquer en jouant », « selon les
// actions »). Au premier lancement, il n'y a que l'accueil et le pack du jour ; chaque fonction s'ouvre quand le joueur a
// fait ce qu'il faut (ouvrir son premier pack, construire, économiser…) et reste ouverte ensuite. Les conditions sont dans
// ECO.deblocages (proposés par Claude, gardés par Gautier le 6 nov.) : `si` (toutes doivent tenir) et `ou` (une seule suffit).
// Les faits du joueur : packs ouverts, lieux, constructions (lieux bâtis), pièces. Module pur : l'appelant les donne.
(function (racine) {
  function creer(eco) {
    const D = eco.deblocages || {}, LISTE = Object.keys(D);
    const val = (faits, f) => Math.max(0, Number(faits && faits[f]) || 0);
    function tient(k, faits) {
      const c = D[k]; if (!c) return true;
      const si = Object.entries(c.si || {}), ou = Object.entries(c.ou || {});
      return si.every(([f, n]) => val(faits, f) >= n) && (!ou.length || ou.some(([f, n]) => val(faits, f) >= n));
    }
    // ce qui s'ouvre maintenant : tient, et pas encore dans `deja` (clé → instant)
    const nouveaux = (deja, faits) => LISTE.filter((k) => !(deja && deja[k]) && tient(k, faits));
    // une fonction inconnue des réglages est toujours ouverte
    const ouvert = (deja, k) => !D[k] || !!(deja && deja[k]);
    // ce qu'il faut encore faire, pour l'écran du cadenas : [{ fait, faut, a, ou }] (ou = une des alternatives)
    function reste(k, faits) {
      const c = D[k]; if (!c) return [];
      const l = Object.entries(c.si || {}).map(([f, n]) => ({ fait: f, faut: n, a: Math.min(n, val(faits, f)), ou: false }));
      const alt = Object.entries(c.ou || {}); if (alt.length && !alt.some(([f, n]) => val(faits, f) >= n)) for (const [f, n] of alt) l.push({ fait: f, faut: n, a: Math.min(n, val(faits, f)), ou: true });
      return l.filter((x) => x.a < x.faut);
    }
    // le nombre de packs déjà ouverts, quand le téléphone ne l'a pas compté (un autre appareil, avant les déblocages) :
    // un pack donne 5 lieux
    const packsAuMoins = (compte, lieux) => Math.max(Number(compte) || 0, Math.ceil((Number(lieux) || 0) / 5));
    return { LISTE, tient, nouveaux, ouvert, reste, packsAuMoins, silencieux: (k) => !!(D[k] && D[k].silencieux), D };
  }
  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Deblocages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
