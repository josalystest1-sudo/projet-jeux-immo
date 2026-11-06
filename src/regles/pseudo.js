// Le filtre automatique des pseudos (GDD § 8 bis « Modération ») : longueur, caractères permis, mots interdits
// (y compris déguisés : P.u.7.a.i.n, GrosCon), noms réservés (admin, StreetKeep, CityDeck, Cadastra…), pseudo déjà pris.
// Module pur. Les listes viennent de data/moderation.json.
(function (racine) {
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', '$': 's', '!': 'i', '€': 'e' };

  function creer(mod) {
    const RAC = mod.racines.concat(mod.reserves_racines), MOTS = new Set(mod.mots), RES_MOTS = new Set(mod.reserves_mots);
    const RES_RAC = new Set(mod.reserves_racines);

    function sansAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function dessouder(s) { return s.replace(/(.)\1+/g, '$1'); } // « puuute » → « pute »

    // les mots du pseudo : coupés aux séparateurs et aux majuscules (« GrosCon » → gros, con), chiffres-lettres traduits
    function mots(pseudo) {
      const coupe = String(pseudo).replace(/([a-zà-ÿ])([A-ZÀ-Þ])/g, '$1 $2');
      return sansAccents(coupe).toLowerCase().split('').map((c) => LEET[c] || c).join('')
        .split(/[^a-z]+/).filter(Boolean);
    }
    // tout collé, sans séparateurs (« p.u.t.e » → « pute »)
    function colle(pseudo) { return mots(pseudo).join(''); }

    function interdit(pseudo) {
      const m = mots(pseudo), c = colle(pseudo);
      const formes = [c, dessouder(c)];
      for (const r of RAC) if (formes.some((f) => f.includes(r))) return RES_RAC.has(r) ? 'reserve' : 'mot';
      const candidats = new Set([...m, ...m.map(dessouder), c, dessouder(c)]);
      for (const x of candidats) {
        if (MOTS.has(x)) return 'mot';
        if (RES_MOTS.has(x)) return 'reserve';
      }
      return '';
    }

    // { ok } ou { ok: false, raison, texte }
    function valider(pseudo, dejaPris) {
      const p = String(pseudo || '').trim().replace(/\s+/g, ' ');
      const non = (raison, texte) => ({ ok: false, raison, texte });
      if (p.length < mod.pseudo.min) return non('court', `${mod.pseudo.min} caractères au moins`);
      if (p.length > mod.pseudo.max) return non('long', `${mod.pseudo.max} caractères au plus`);
      if (!/^[\p{L}\p{N}][\p{L}\p{N} _.\-]*[\p{L}\p{N}]$/u.test(p)) return non('caracteres', 'lettres, chiffres, espace, tiret, point ou tiret bas seulement');
      if ((p.match(/\p{L}/gu) || []).length < 2) return non('lettres', 'deux lettres au moins');
      const i = interdit(p);
      if (i === 'mot') return non('interdit', 'ce pseudo contient un mot interdit');
      if (i === 'reserve') return non('reserve', 'ce pseudo est réservé');
      const cle = sansAccents(p).toLowerCase();
      if ((dejaPris || []).some((x) => sansAccents(x).toLowerCase() === cle)) return non('pris', 'ce pseudo est déjà pris');
      return { ok: true, pseudo: p };
    }

    return { valider, mots, colle, interdit };
  }

  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Pseudo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
