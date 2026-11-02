// Les enchères de monuments (GDD « Les enchères de monuments ») : chaque semaine, 1 monument national (légendaire)
// et 2 régionaux pour toute la France. Module pur : pas de réseau, pas de date lue ici (on lui donne l'instant).
// Une mise : { qui, montant, ts }.
(function (racine) {
  function creer(eco) {
    const E = eco.encheres;

    function semaine(maintenantMs, msParSemaine) { return Math.floor(maintenantMs / msParSemaine); }

    // les lots de la semaine idx, dans l'ordre des listes (le calendrier éditorial de Gautier les remplacera)
    function lots(idx, nationaux, regionaux) {
      const out = [];
      const prendre = (liste, k) => liste[((k % liste.length) + liste.length) % liste.length];
      for (let k = 0; k < E.nationaux_par_semaine && nationaux.length; k++) {
        out.push({ cle: idx + ':' + out.length, semaine: idx, palier: 'national', m: prendre(nationaux, idx * E.nationaux_par_semaine + k) });
      }
      for (let k = 0; k < E.regionaux_par_semaine && regionaux.length; k++) {
        out.push({ cle: idx + ':' + out.length, semaine: idx, palier: 'regional', m: prendre(regionaux, idx * E.regionaux_par_semaine + k) });
      }
      return out;
    }

    function miseDepart(m) {
      const d = E.depart[m.palier === 'national' ? 'national' : 'regional'];
      return Math.round((d.base + d.par_article * (m.articles || 0)) / d.arrondi) * d.arrondi;
    }

    function plusHaute(a, b) { return a.montant > b.montant || (a.montant === b.montant && a.ts < b.ts); }

    // la meilleure mise (à montant égal, la plus ancienne)
    function meilleure(mises) {
      let top = null;
      for (const b of mises || []) if (!top || plusHaute(b, top)) top = b;
      return top;
    }

    function miseMin(m, mises) {
      const t = meilleure(mises);
      return t ? Math.ceil(t.montant * (1 + E.pas_min)) : miseDepart(m);
    }

    // les fonds bloqués de qui : ses mises qui mènent, sur tous les lots sauf `sauf` (cle → mises)
    function bloque(misesParLot, qui, sauf) {
      let s = 0;
      for (const [cle, mises] of Object.entries(misesParLot)) {
        if (cle === sauf) continue;
        const t = meilleure(mises);
        if (t && t.qui === qui) s += t.montant;
      }
      return s;
    }

    // une mise est-elle acceptée ? Elle doit atteindre la mise minimale et être couverte par le solde,
    // moins ce qui est déjà bloqué sur les autres lots (sur ce lot, la nouvelle mise remplace l'ancienne).
    function peutMiser(m, mises, montant, solde, dejaBloque) {
      const min = miseMin(m, mises);
      if (!(montant >= min)) return { ok: false, raison: 'min', min };
      if (montant > solde - dejaBloque) return { ok: false, raison: 'fonds', dispo: solde - dejaBloque };
      return { ok: true };
    }

    // la clôture : la meilleure mise dont le joueur a encore les fonds ; sinon la suivante, et ainsi de suite.
    // Chaque joueur ne compte qu'une fois, pour sa plus haute mise. fondsDe(qui) : son solde à la clôture.
    function cloture(mises, fondsDe) {
      const parJoueur = {};
      for (const b of mises || []) if (!parJoueur[b.qui] || plusHaute(b, parJoueur[b.qui])) parJoueur[b.qui] = b;
      const ordre = Object.values(parJoueur).sort((a, b) => (plusHaute(a, b) ? -1 : 1));
      for (const b of ordre) if (fondsDe(b.qui) >= b.montant) return b;
      return null;
    }

    return { semaine, lots, miseDepart, meilleure, miseMin, bloque, peutMiser, cloture };
  }

  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Encheres = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
