// La progression (6 nov. 2026, interview de Gautier : « à débloquer en jouant », « selon les actions »). Au premier
// lancement, il n'y a que l'accueil et le pack du jour ; les autres écrans portent un cadenas dans la barre du bas et
// s'ouvrent quand le joueur a fait ce qu'il faut ; une fenêtre « Nouveau ! » le fête. Règles et seuils :
// src/regles/deblocages.js et ECO.deblocages [Proposé].
//   - state.deblocages : clé → instant où elle s'est ouverte (une fonction ouverte le reste) ;
//   - state.nouveautes : les fêtes pas encore montrées (montrées quand rien d'autre n'est à l'écran) ;
//   - state.packsOuverts : compté par ouvrirPack (un autre téléphone le déduit des lieux).
// Pas de fête au démarrage : ce qui s'ouvre avant la première réponse du serveur, ou à la première vérification, s'ouvre
// en silence (un joueur déjà installé, un nouveau téléphone). Les joueurs d'avant les déblocages retrouvent donc tout.
(function () {
  const P = window.PROGRESSION = {};
  const DEB = Deblocages.creer(ECO);
  const INFO = {
    carte: { ic: '🗺️', titre: 'La carte', texte: 'Tes lieux sur la vraie carte de France, en 3D. Promène-toi dans les rues et découvre ceux des autres joueurs.', ecran: 'carte' },
    patrimoine: { ic: '🏘️', titre: 'Ta collection', texte: 'Tous tes lieux en cartes. Construis dessus : plus tu bâtis haut, plus le loyer monte.', ecran: 'patrimoine' },
    communes: { ic: '🏛️', titre: 'Les communes', texte: 'Verse des pièces à la caisse de travaux d’une commune : le plus généreux en devient le Maire pour 2 semaines et touche une part des loyers.', ecran: 'communes' },
    encheres: { ic: '🔨', titre: 'Les enchères', texte: 'Chaque semaine, 3 monuments sont mis aux enchères pour toute la France. Le plus offrant l’emporte.', ecran: 'encheres' },
    chasse: { ic: '🧭', titre: 'La chasse au trésor', texte: 'Une commune, une adresse cachée : le premier qui l’atteint gagne. Inscris-toi quand une chasse est annoncée ; un indice arrive toutes les 2 minutes.' },
  };
  P.INFO = INFO;
  P.faits = () => { const l = Object.values(state.owned || {});
    return { packs: DEB.packsAuMoins(state.packsOuverts, l.length), lieux: l.length, constructions: l.filter((a) => (a.niveau || 0) > 0).length, pieces: Math.floor(dispo()) }; };
  P.ouvert = (k) => DEB.ouvert(state.deblocages, k);
  window.debloque = P.ouvert;   // (src/accueil.js, src/chasse_jeu.js)

  let pret = false;
  P.verifier = () => {
    if (!state.deblocages) state.deblocages = {};
    const n = DEB.nouveaux(state.deblocages, P.faits());
    if (n.length) { for (const k of n) { state.deblocages[k] = Date.now(); if (pret && !DEB.silencieux(k)) (state.nouveautes = state.nouveautes || []).push(k); } save(); }
    if (!MODE_SERVEUR || window.ETAT_RECU) pret = true;   // (en mode serveur : après sa première réponse)
    P.cadenas(); if (n.length) setTimeout(P.montrer, 400);
  };

  // la barre du bas : un cadenas à la place de l'icône d'un écran fermé ; la chasse sans bandeau
  P.cadenas = () => {
    document.querySelectorAll('#nav button[data-s]').forEach((b) => { const ferme = !P.ouvert(b.dataset.s), i = b.querySelector('i'); if (!i) return;
      if (b.dataset.ic == null) b.dataset.ic = i.innerHTML;
      if (ferme !== b.classList.contains('verrou')) { b.classList.toggle('verrou', ferme); i.innerHTML = ferme ? '🔒' : b.dataset.ic; } });
    for (const k of DEB.LISTE) document.body.classList.toggle('verrou-' + k, !P.ouvert(k));
    if (window.CHASSE && CHASSE.majBandeau) CHASSE.majBandeau();
  };

  // ce qu'il reste à faire, en mots
  function etape(x) {
    const n = x.faut;
    if (x.fait === 'packs') return n === 1 ? 'Ouvre ton premier pack' : `Ouvre ${nb(n)} packs`;
    if (x.fait === 'constructions') return n === 1 ? 'Construis ton premier bâtiment' : `Construis ${nb(n)} bâtiments`;
    if (x.fait === 'pieces') return `Réunis ${nb(n)} pièces`;
    if (x.fait === 'lieux') return `Réunis ${nb(n)} lieux`;
    return x.fait;
  }
  const AIDE = { constructions: 'Touche une de tes cartes, puis un bâtiment à construire.' };
  // un écran fermé : ce qu'il montrera, et ce qu'il faut faire pour l'ouvrir
  P.ferme = (k) => { const i = INFO[k] || { ic: '🔒', titre: 'Bientôt', texte: '' }, faits = P.faits(), reste = DEB.reste(k, faits);
    const lignes = reste.map((x, j) => `${x.ou && j > 0 ? '<div class="prog-ou">ou</div>' : ''}<div class="prog-etape"><b>${etape(x)}</b><span class="prog-barre"><i style="width:${Math.round(100 * x.a / x.faut)}%"></i></span><small>${x.fait === 'pieces' ? pcs(x.a) + ' / ' + pcs(x.faut) : nb(x.a) + ' / ' + nb(x.faut)}</small>${AIDE[x.fait] ? `<small class="prog-aide">${AIDE[x.fait]}</small>` : ''}</div>`).join('');
    const box = document.getElementById('modalbox');
    box.innerHTML = `<div class="prog-fen"><div class="prog-ic verrou">${i.ic}<span>🔒</span></div><h2>${i.titre}</h2><div class="sub">${i.texte}</div>
      <div class="prog-titre">Pour l’ouvrir</div>${lignes}<div class="liste-btn"><button class="btn large" onclick="closeModal()">D’accord</button></div></div>`;
    document.getElementById('modal').classList.add('on'); };

  // la fête d'une fonction qui s'ouvre, quand rien d'autre n'est à l'écran
  const occupe = () => !!((document.querySelector('#packscene.on') && !document.body.classList.contains('vitrine')) || document.querySelector('#modal.on') || document.getElementById('guide')
    || (typeof PROM !== 'undefined' && PROM.on) || (window.CHASSE && CHASSE.dans) || document.querySelector('.rev-scene') || (window.Compte && Compte.bloque && Compte.bloque()));
  P.montrer = () => { const q = state.nouveautes; if (!q || !q.length || occupe()) return;
    const k = q.shift(); save(); const i = INFO[k]; if (!i) return P.montrer();
    const box = document.getElementById('modalbox');
    box.innerHTML = `<div class="prog-fen"><div class="prog-ic">${i.ic}</div><div class="prog-nouveau">Nouveau</div><h2>${i.titre}</h2><div class="sub">${i.texte}</div>
      <div class="liste-btn">${i.ecran ? `<button class="btn large" id="prog-voir">Découvrir</button><button class="btn clair large" onclick="closeModal()">Plus tard</button>` : '<button class="btn large" onclick="closeModal()">D’accord</button>'}</div></div>`;
    document.getElementById('modal').classList.add('on'); vibrer(30); fete(16);
    const v = box.querySelector('#prog-voir'); if (v) v.onclick = () => { closeModal(); showScreen(i.ecran); };
  };
  setInterval(() => { if (state.nouveautes && state.nouveautes.length) P.montrer(); }, 2000);
})();
