// Le Maire par caisse de travaux (GDD § 5, décision de Gautier du 4 nov. 2026 ; le Maire change toutes les 2 semaines).
// Chaque commune a une caisse de travaux ; pendant un mandat (2 semaines du jeu), ses propriétaires y versent des pièces.
// À la fin du mandat, le plus gros contributeur devient Maire pour le mandat suivant (égalité : co-Maires ; il faut avoir
// versé au moins le seuil). Le Maire touche une part des loyers des lieux des autres joueurs de la commune, jusqu'à un
// plafond par mandat. Module pur : pas de réseau, pas de date lue ici (on lui donne le jour du jeu, les durées).
(function (racine) {
  function creer(eco) {
    const M = eco.mairie;

    // le numéro du mandat d'un jour du jeu, et le jour où il commence : deux semaines du jeu (celles des enchères)
    function mandat(jour) { return Math.floor(jour / M.jours_mandat); }
    function premierJour(n) { return n * M.jours_mandat; }

    // ce que compte un versement : à moitié dans la dernière heure du mandat (le versement de 23 h 59, GDD § 5) ;
    // resteMs : le temps qui reste avant la fin du mandat, jourMs : la durée d'un jour du jeu
    function points(montant, resteMs, jourMs) {
      const m = Math.floor(montant); if (!(m > 0)) return 0;
      return resteMs <= jourMs / 24 ? Math.floor(m * M.derniere_heure) : m;
    }
    // un versement possible ? (un lieu dans la commune, un montant entier, au moins le minimum, dans mes moyens)
    function peutVerser(montant, dispo, lieuxDansLaCommune) {
      if (!(lieuxDansLaCommune > 0)) return { ok: false, raison: 'sans_lieu' };
      if (!Number.isInteger(montant) || montant < M.versement_min) return { ok: false, raison: 'minimum' };
      if (montant > dispo) return { ok: false, raison: 'fonds' };
      return { ok: true };
    }

    // l'élection : contributions { joueur: points } → le classement, les Maires, le nombre de rivaux
    // absent(qui) : un Maire qui ne s'est pas connecté depuis absence_jours perd le titre au profit du suivant
    function elire(contributions, absent) {
      const rangs = Object.entries(contributions || {}).map(([qui, n]) => ({ qui, n: Math.floor(n) })).filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n || (a.qui < b.qui ? -1 : (a.qui > b.qui ? 1 : 0)));
      const eligibles = rangs.filter((r) => r.n >= M.seuil && !(absent && absent(r.qui)));
      const max = eligibles.length ? eligibles[0].n : 0;
      const maires = eligibles.filter((r) => r.n === max).map((r) => r.qui);
      // une mairie vaut le nombre de rivaux qui ont versé au moins le seuil (classement des Maires, GDD § 5)
      const rivaux = rangs.filter((r) => r.n >= M.seuil && !maires.includes(r.qui)).length;
      return { rangs, maires, max, rivaux };
    }
    // ce qu'il manque à un joueur pour passer en tête de la caisse (0 s'il mène seul)
    function manque(contributions, qui) {
      const moi = Math.floor((contributions || {})[qui] || 0);
      const autres = Object.entries(contributions || {}).filter(([q]) => q !== qui).map(([, n]) => Math.floor(n));
      const tete = Math.max(M.seuil - 1, ...autres, 0);
      return Math.max(0, tete + 1 - moi);
    }
    // la part d'un Maire : part_loyers des loyers des lieux des autres joueurs de la commune, partagée entre co-Maires,
    // sans dépasser le plafond du mandat (partagé lui aussi) ; dejaTouche : ce qu'il a déjà touché ce mandat
    // (niveau : celui de la commune ; le plafond monte avec lui, décision de Gautier du 5 nov. 2026 : « la mairie rapporte
    // plus » ; 1 000 au niveau 0, 2 000 au niveau 5)
    function part(loyersDesAutres, nbMaires, dejaTouche, niveau) {
      const n = Math.max(1, nbMaires || 1), plafond = plafondPart(n, niveau);
      return Math.max(0, Math.min(Math.floor(loyersDesAutres * M.part_loyers / n), plafond - Math.floor(dejaTouche || 0)));
    }
    function plafondPart(nbMaires, niveau) { return Math.floor(M.plafond_mandat * (1 + (M.travaux_bonus_plafond || 0) * (niveau || 0)) / Math.max(1, nbMaires || 1)); }
    // un Maire absent depuis trop longtemps : jours sans connexion
    function tropAbsent(joursSansConnexion) { return joursSansConnexion >= M.absence_jours; }

    // le niveau de la commune (GDD § 5 ; construit le 5 nov. 2026) : l'état de ses travaux, fait de tout ce qui a été versé
    // à sa caisse, par tous ; 0 à 5 selon les paliers de M.travaux_paliers. Les travaux s'usent (décision de Gautier du
    // 5 nov. : « les travaux s'usent ») : à chaque nouveau mandat, l'état perd M.travaux_usure (10 %) ; une commune au
    // niveau 5 doit être entretenue.
    // l'état des travaux au mandat « mandat », s'il valait « etat » au mandat « depuis » (usé une fois par mandat passé)
    function etatTravaux(etat, depuis, mandat) {
      const n = Math.max(0, Math.floor(mandat) - Math.floor(depuis)), e = Math.max(0, Math.floor(etat || 0));
      return n ? Math.floor(e * Math.pow(1 - (M.travaux_usure || 0), n)) : e;
    }
    // ce que le niveau rapporte : la part de loyer en plus pour tous les lieux de la commune (0,02 par niveau)
    function bonusLoyer(niveau) { return (M.travaux_bonus_loyer || 0) * Math.max(0, niveau || 0); }
    function niveauTravaux(total) { const p = M.travaux_paliers || []; let n = 0; while (n < p.length && total >= p[n]) n++; return n; }
    // le palier suivant : { niveau, palier, manque } (null au dernier niveau)
    function prochainTravaux(total) {
      const p = M.travaux_paliers || [], n = niveauTravaux(total);
      return n < p.length ? { niveau: n + 1, palier: p[n], manque: p[n] - Math.floor(Math.max(0, total || 0)) } : null;
    }

    return { mandat, premierJour, points, peutVerser, elire, manque, part, plafondPart, tropAbsent, niveauTravaux, prochainTravaux, etatTravaux, bonusLoyer, M };
  }

  const api = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Mairie = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
