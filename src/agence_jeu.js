// L'agence, côté jeu (16 nov. 2026, GDD § 5 sexies ; règles : src/regles/agence.js). Un seul écran, quelle que soit la taille
// du patrimoine : le renom qui monte, la jauge de la prochaine brique, les trois postes à embaucher, le classement des
// briques de la saison. On l'ouvre depuis l'écran Patrimoine (AGENCE.carte() y pose son entrée).
//   - Démo : l'agence est dans state.agence, les règles s'appliquent ici.
//   - Mode serveur : le serveur calcule et garde (actions agence, agence_embaucher, agence_brique) ; ici on affiche ce
//     qu'il rend, et le renom continue de monter à l'écran d'après l'instant où on l'a reçu.
(function () {
  'use strict';
  const AG = Agence.creer(ECO), NOMS = { agent: ['👤', 'Agents'], negociateur: ['🤝', 'Négociateurs'], directeur: ['👑', 'Directeurs'] };
  const EFFETS = { agent: `+${ECO.agence.postes.agent.renom} renom par heure chacun.`, negociateur: `+${Math.round(ECO.agence.postes.negociateur.bonus * 100)} % de renom chacun.`, directeur: `Tout le renom multiplié par ${String(ECO.agence.postes.directeur.facteur).replace('.', ',')}, pour chacun.` };
  let recue = null, recueLe = 0, minuteur = 0, occupe = false, classement = null;
  const saison = () => CLA.saison(mandatCourant());
  // l'agence à l'instant : la mienne (démo), ou celle que le serveur a rendue, avancée jusqu'à maintenant
  function courante() {
    if (!MODE_SERVEUR) return AG.avancer(state.agence || null, now(), JOUR, saison());
    if (!recue) return null;
    return AG.avancer(Object.assign({}, recue, { le: recueLe }), Date.now(), JOUR, recue.saison);
  }
  function recevoir(a) { if (a) { recue = a; recueLe = Date.now(); } }
  const rond = (x) => nb(Math.floor(x));
  const debitTexte = (x) => (x >= 100 ? nb(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ','));

  // ---------------------------------------------------------------- l'écran
  function rendre() {
    const box = document.getElementById('modalbox'), a = courante();
    if (!a) { box.innerHTML = '<h2>🏢 Mon agence</h2><div class="sub">Ouverture de l’agence…</div>'; return; }
    const b = a.briques, s = AG.seuil(b), pret = AG.briquesPossibles(a.renom, b), d = AG.debit(a.e, b), fonds = Math.floor(dispo());
    // le meilleur achat : ce qui rapporte le plus de renom par pièce
    let mieux = null; for (const p of AG.POSTES) { const g = AG.gain(a, p) / AG.cout(p, a.e[p]); if (g > 0 && (!mieux || g > mieux.g)) mieux = { p, g }; }
    const postes = AG.POSTES.map((p) => { const c = AG.cout(p, a.e[p]), g = AG.gain(a, p);
      return `<div class="article ag-poste"><div class="t">${NOMS[p][0]} ${NOMS[p][1]} <b class="ag-nombre">${nb(a.e[p])}</b>${mieux && mieux.p === p && a.e.agent > 0 ? '<span class="ag-mieux">Meilleur choix</span>' : ''}</div><div class="m">${EFFETS[p]}</div>
        <div class="ag-ligne"><button class="btn${c <= fonds ? '' : ' clair'}" data-poste="${p}">Embaucher · ${pcs(c)}</button><span class="ag-gain">${g > 0 ? `<b>+${debitTexte(g)}</b> <span>renom par heure</span>` : '<span>Embauche d’abord un agent</span>'}</span></div></div>`; }).join('');
    box.innerHTML = `<h2>🏢 Mon agence</h2><div class="sub">Tes employés produisent du renom, même quand tu n’es pas là. Avec assez de renom, tu poses une brique.</div>
      <div class="kpis ag-kpis"><div class="kpi"><i>🧱</i><b>${nb(b)}</b><small>brique${b > 1 ? 's' : ''} cette saison</small></div><div class="kpi"><i>📈</i><b>${debitTexte(d)}</b><small>renom par heure</small></div></div>
      <div class="ag-jauge"><i id="ag-barre" style="width:${Math.min(100, a.renom / s * 100).toFixed(1)}%"></i></div>
      <div class="ag-renom"><b id="ag-renom">${rond(a.renom)}</b> <span>sur</span> <b>${nb(s)}</b> <span>de renom pour la prochaine brique</span></div>
      <button class="btn large${pret ? '' : ' clair'}" id="ag-poser">${pret > 1 ? `Poser <b>${pret}</b> briques` : 'Poser une brique'}</button>
      <div class="m ag-note">Poser une brique remet tes employés et ton renom à zéro. Chaque brique donne <b>+${Math.round(ECO.agence.brique.bonus * 100)} %</b> de renom jusqu’à la fin de la saison.</div>
      ${postes}
      <div class="m ag-note">L’agence travaille <b>${ECO.agence.stock_heures} h</b> sans toi : passe la voir. À la fin de la saison, les briques sont comptées et tout repart de zéro.</div>
      <div id="ag-classement">${rendreClassement()}</div>
      <button class="btn clair" onclick="closeModal()">Fermer</button>`;
    box.querySelectorAll('[data-poste]').forEach((bt) => bt.addEventListener('click', () => embaucher(bt.dataset.poste)));
    box.querySelector('#ag-poser').addEventListener('click', poser);
  }
  function rendreClassement() {
    if (!MODE_SERVEUR || !classement) return '';
    const moi = monUid(), lignes = classement.top.map((x, i) => `<div class="ag-rang${x.joueur === moi ? ' moi' : ''}"><b>${i + 1}</b><span class="ag-qui">${echapper((x.avatar || '') + ' ' + (x.pseudo || '?'))}</span><b>${nb(x.n)}</b></div>`).join('');
    return `<div class="t ag-titre">🏆 Les briques de la saison</div>${lignes || '<div class="m">Personne n’a encore posé de brique cette saison.</div>'}${classement.rang && classement.rang > classement.top.length ? `<div class="m ag-note">Ta place : <b>${nb(classement.rang)}</b></div>` : ''}`;
  }
  // le renom monte à l'écran, sans tout redessiner ; quand une brique devient possible, on redessine une fois
  function battre() {
    const el = document.getElementById('ag-renom'); if (!el || !document.getElementById('modal').classList.contains('on')) { clearInterval(minuteur); minuteur = 0; return; }
    const a = courante(); if (!a) return; const s = AG.seuil(a.briques);
    el.textContent = rond(a.renom); const barre = document.getElementById('ag-barre'); if (barre) barre.style.width = Math.min(100, a.renom / s * 100).toFixed(1) + '%';
    const bt = document.getElementById('ag-poser'); if (bt && bt.classList.contains('clair') && a.renom >= s) rendre();
  }
  async function ouvrir() {
    document.getElementById('modal').classList.add('on'); rendre();
    clearInterval(minuteur); minuteur = setInterval(battre, 1000);
    if (MODE_SERVEUR) { const r = await agir('agence'); if (r) { recevoir(r.agence); if (document.getElementById('ag-renom') || document.getElementById('modalbox').textContent.includes('Ouverture')) rendre(); } chargerClassement(); }
  }
  async function chargerClassement() {
    if (!MODE_SERVEUR || !(window.Compte && Compte.client)) return; const s = recue ? recue.saison : saison(), j = monUid();
    try { const [c, r] = await Promise.all([Compte.client.rpc('classement_agences', { s, lim: 10 }), j ? Compte.client.rpc('rang_agence', { s, j }) : Promise.resolve({ data: [] })]);
      classement = { top: c.data || [], rang: r.data && r.data[0] ? Number(r.data[0].rang) : 0 }; const el = document.getElementById('ag-classement'); if (el) el.innerHTML = rendreClassement(); } catch (e) { /* le classement attendra */ }
  }
  // ---------------------------------------------------------------- les actions
  async function embaucher(poste) {
    if (occupe) return; const a = courante(); if (!a) return;
    const essai = AG.embaucher(a, poste, Math.floor(dispo()));
    if (!essai.ok) { vibrer(30); return toast(essai.raison === 'fonds' ? `Il te manque ${fmt(essai.cout - Math.floor(dispo()))} pour cette embauche` : 'Ton agence est pleine : pose une brique pour repartir'); }
    occupe = true;
    try {
      if (MODE_SERVEUR) { const r = await agir('agence_embaucher', { poste }); if (r) recevoir(r.agence); }
      else { encaisser(true); state.wallet -= essai.cout; state.agence = essai.agence; save(); }
    } finally { occupe = false; }
    vibrer(10); refreshTop(); rendre(); majCarte();
  }
  async function poser() {
    if (occupe) return; const a = courante(); if (!a) return; const r = AG.poser(a);
    if (!r.ok) { vibrer(30); return toast(`Encore ${nb(r.manque)} de renom avant la prochaine brique`); }
    occupe = true; let n = r.briques;
    try {
      if (MODE_SERVEUR) { const x = await agir('agence_brique'); if (!x) return; recevoir(x.agence); n = x.briques; }
      else { state.agence = r.agence; save(); }
    } finally { occupe = false; }
    fete(n); vibrer([20, 30, 60]); toast(n > 1 ? `${n} briques posées ! Ton agence repart, plus forte.` : 'Une brique posée ! Ton agence repart, plus forte.');
    rendre(); majCarte(); chargerClassement();
  }
  // ---------------------------------------------------------------- l'entrée, sur l'écran Patrimoine
  function carte() {
    const a = courante(), b = a ? a.briques : 0, d = a ? AG.debit(a.e, b) : 0, pret = a ? AG.briquesPossibles(a.renom, b) : 0;
    const sous = !a || (!b && !d) ? 'Embauche, gagne du renom, pose des briques : le bâtiment de la saison ira au meilleur bâtisseur.' : (pret ? 'Une brique est prête à être posée !' : `<b>${nb(b)}</b> <span>brique${b > 1 ? 's' : ''} cette saison ·</span> <b>${debitTexte(d)}</b> <span>renom par heure</span>`);
    return `<div class="card flex ag-carte${pret ? ' pret' : ''}" id="ag-carte"><div><div class="t">🏢 Mon agence</div><div class="m">${sous}</div></div><button class="btn${pret ? '' : ' clair'}" onclick="AGENCE.ouvrir()">Ouvrir</button></div>`;
  }
  function majCarte() { const el = document.getElementById('ag-carte'); if (el) el.outerHTML = carte(); }
  window.AGENCE = { ouvrir, carte, courante, recevoir };
})();
