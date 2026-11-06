// L'accueil (6 nov. 2026, interview de Gautier). Le jeu s'ouvrait sur la carte 3D : « un nouveau joueur qui ouvre le jeu et
// tombe sur ça… ça va le dégoûter » ; puis, devant un premier accueil en tableau de bord : « ça reste un jeu vidéo ; là, on
// dirait un écran de contrôle ». Ses choix : au centre, le pack, comme Pokémon TCG Pocket ; un seul gros bouton ; le reste
// se débloque en jouant ; le premier pack guidé. Et : « le sachet, une fois utilisé, ne doit plus apparaître ».
//   - pack prêt : la scène du pack (le vrai sachet en 3D) sert de vitrine derrière l'accueil ; « Ouvrir mon pack » lance
//     l'ouverture habituelle (on glisse le doigt pour déchirer) ;
//   - pack ouvert : les cartes du jour en éventail (state.cartesDuJour), le compte à rebours du prochain pack ;
//   - le gros bouton, selon le moment : ouvrir le pack, la chasse au trésor, récolter, explorer la carte.
(function () {
  const A = window.ACCUEIL = {};
  const ecran = () => document.getElementById('s-accueil');
  const visible = () => ecran() && ecran().classList.contains('on');
  // la vitrine : la scène du pack ouverte derrière l'accueil, sans rien tirer
  function ouvrirVitrine() {
    const sc = document.getElementById('packscene');
    if (document.body.classList.contains('vitrine')) return;
    if (sc.classList.contains('on')) return;   // (une vraie ouverture est en cours)
    document.body.classList.add('vitrine'); openScene();
    document.getElementById('pkload').textContent = ''; document.getElementById('pkhint').textContent = '';
  }
  A.fermerVitrine = () => { if (!document.body.classList.contains('vitrine')) return; document.body.classList.remove('vitrine');
    const sc = document.getElementById('packscene'); sc.classList.remove('show', 'fini');
    setTimeout(() => { if (!document.body.classList.contains('vitrine') && !sc.classList.contains('show')) { sc.classList.remove('on'); disposeGL(); } }, 500); };
  // le gros bouton : l'action du moment
  function action() {
    if (packDispo()) return { cle: 'pack', texte: 'Ouvrir mon pack', sous: `${nb(BOU.cartesDuJour(state.pass, now()))} lieux de France t’attendent`, or: true, f: () => ouvrirPack() };
    const C = window.CHASSE, v = C && C.vue;
    if (v && (v.etat === 'annonce' || v.etat === 'en_cours') && !(window.debloque && !debloque('chasse'))) {
      if (!C.inscrit) return { cle: 'chasse', texte: 'Chasse au trésor', sous: `${v.commune} · ${v.etat === 'annonce' ? 'départ' : 'fin'} dans ${dureeCourte(Math.max(0, Math.ceil(((v.etat === 'annonce' ? v.debut : v.fin) - Date.now()) / 1000)))}`, f: () => C.inscrire() };
      if (v.etat === 'en_cours') return { cle: 'chasse', texte: 'Reprendre la chasse', sous: v.commune, f: () => C.entrer() };
    }
    const p = Math.floor(pendingRent());
    if (p >= 1 && !(window.debloque && !debloque('recolte'))) return { cle: 'recolte', texte: `Récolter +${nb(p)}`, piece: true, sous: 'Le salaire et les loyers de tes lieux', f: () => { recolter(); setTimeout(A.render, 1200); } };
    return { cle: 'carte', texte: 'Explorer la carte', sous: 'Promène-toi dans les rues, retrouve tes lieux', f: () => showScreen('carte') };
  }
  // les cartes du jour (le dernier pack ouvert), sinon les dernières arrivées
  function cartesDuJour() {
    const d = state.cartesDuJour, ids = d && d.ids ? d.ids.filter((id) => state.owned[id]) : [];
    const l = ids.length ? ids.map((id) => state.owned[id]) : Object.values(state.owned).sort((a, b) => (b.depuis || 0) - (a.depuis || 0)).slice(0, 5);
    return l.slice(0, 8);
  }
  A.render = () => {
    const el = ecran(); if (!el || !visible()) return;
    const pret = packDispo(), act = action();
    if (pret) ouvrirVitrine(); else A.fermerVitrine();
    el.classList.toggle('vitrine', pret);
    const haut = `<div class="acc-haut"><button class="acc-pill moi" data-a="profil"><span class="av">${echapper(state.avatar || '🙂')}</span><b data-pas-traduire>${echapper(state.pseudo || '')}</b></button><span class="acc-esp"></span>
      <button class="acc-pill" data-a="gemmes">💎 <b>${nb(state.gemmes || 0)}</b></button><button class="acc-pill" data-a="pieces"><i class="pc"></i><b>${nb(dispo())}</b></button></div>`;
    const titre = pret ? '<div class="acc-titre"><small>Pack du jour</small><b>Ton pack est prêt !</b></div>'
      : `<div class="acc-titre"><small>Prochain pack dans</small><b class="acc-compte">${dureeCourte(secondesAvantPack())}</b></div>`;
    const cartes = pret ? [] : cartesDuJour();
    const centre = pret ? '<div class="acc-centre"></div>'
      : `<div class="acc-centre"><div class="acc-eventail" style="--n:${cartes.length}">${cartes.map((a, i) => `<button class="acc-carte ccarte r${rarete(a)}" data-id="${echapper(a.id)}" style="--i:${i - (cartes.length - 1) / 2}">${carteArt(a, '')}</button>`).join('')}</div>${cartes.length ? `<div class="acc-legende">${state.cartesDuJour ? 'Tes cartes du jour' : 'Tes dernières cartes'}</div>` : ''}</div>`;
    const bas = `<div class="acc-bas"><button class="acc-gros ${act.or ? 'or' : ''}" data-a="gros">${echapper(act.texte)}${act.piece ? ' <i class="pc"></i>' : ''}</button><span class="acc-sous">${echapper(act.sous || '')}</span></div>`;
    el.innerHTML = haut + titre + centre + bas;
    el.onclick = (e) => { const b = e.target.closest('[data-a],[data-id]'); if (!b) return; vibrer(8);
      if (b.dataset.id) return ouvrirFicheLieu(b.dataset.id);
      const a = b.dataset.a; if (a === 'gros') return act.f(); if (a === 'profil') return showPlayer(ME); if (a === 'gemmes') return ouvrirBoutique(); if (a === 'pieces') return recolter(); };
  };
  // après un pack : retour à l'accueil, avec les cartes du jour
  A.apresPack = () => { if (window.PROGRESSION) PROGRESSION.verifier(); if (visible()) A.render(); };
  // le compte à rebours et le bouton suivent le temps (toutes les secondes, seulement à l'écran)
  let derniereCle = '';
  setInterval(() => { if (!visible()) return; const c = ecran().querySelector('.acc-compte');
    if (c) c.textContent = dureeCourte(secondesAvantPack());
    const act = action(), k = packDispo() + ':' + act.cle; if (k !== derniereCle) { derniereCle = k; return A.render(); }
    const g = ecran().querySelector('.acc-gros'), s = ecran().querySelector('.acc-sous'); if (g && act.cle === 'recolte') g.firstChild.textContent = act.texte + ' '; if (s && act.cle === 'chasse') s.textContent = act.sous; }, 1000);
})();
