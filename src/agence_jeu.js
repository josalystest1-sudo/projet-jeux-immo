// L'agence, côté jeu (16 nov. 2026, GDD § 5 sexies ; règles : src/regles/agence.js). Depuis le 16 nov. au soir, l'agence
// est un écran de la barre du bas, à la place de l'accueil (Gautier : « on a l'impression d'être devant un panneau de
// contrôle, on ne voit pas les employés travailler, le renom monter en direct »). Une scène de nuit en néon :
//   - l'immeuble de l'agence, un étage par poste : on voit les employés travailler (jusqu'à quelques-uns par étage, le
//     nombre exact à côté) ; chaque embauche fait entrer un personnage ;
//   - le renom monte en direct (un compteur à décimales, des étincelles qui partent des employés) ;
//   - le chantier : les briques posées cette saison s'empilent ; la brique en cours se remplit, et on la pose.
// Tout est en HTML et en CSS (transformations seulement : pas de filtre animé, pas de mélange de couches).
//   - Démo : l'agence est dans state.agence, les règles s'appliquent ici.
//   - Mode serveur : le serveur calcule et garde (actions agence, agence_embaucher, agence_brique) ; ici on affiche ce
//     qu'il rend, et le renom continue de monter à l'écran d'après l'instant où on l'a reçu.
(function () {
  'use strict';
  const AG = Agence.creer(ECO), P = ECO.agence.postes;
  const NOMS = { agent: 'Agents', negociateur: 'Négociateurs', directeur: 'Directeurs' }, UN = { agent: 'Agent', negociateur: 'Négociateur', directeur: 'Directeur' };
  const ETAGES = { agent: 'Agents', negociateur: 'Négociation', directeur: 'Direction' };
  const EFFET = { agent: `+${P.agent.renom} par heure`, negociateur: `+${Math.round(P.negociateur.bonus * 100)} % de renom`, directeur: `Renom × ${String(P.directeur.facteur).replace('.', ',')}` };
  const VISIBLES = { agent: 8, negociateur: 6, directeur: 3 }, CLE_VUE = 'cadastra-agence-vue';
  let recue = null, recueLe = 0, occupe = false, classement = null, minuteur = 0, etincelles = 0, pose = false, absenceDite = false;
  const saison = () => CLA.saison(mandatCourant());
  const ecran = () => document.getElementById('s-agence');
  const visible = () => { const e = ecran(); return !!(e && e.classList.contains('on')); };
  // l'agence à l'instant : la mienne (démo), ou celle que le serveur a rendue, avancée jusqu'à maintenant
  function courante() {
    if (!MODE_SERVEUR) return AG.avancer(state.agence || null, now(), JOUR, saison());
    if (!recue) return null;
    return AG.avancer(Object.assign({}, recue, { le: recueLe }), Date.now(), JOUR, recue.saison);
  }
  function recevoir(a) { if (a) { recue = a; recueLe = Date.now(); } }
  const debitTexte = (x) => (x >= 100 ? nb(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ','));
  // le renom à l'écran : assez de décimales pour qu'on le voie bouger (au vrai rythme, une heure du jeu dure une heure)
  function decimales(debit) { if (!(debit > 0)) return 0; const parSeconde = debit / (JOUR / 24 / 1000); return parSeconde >= 2 ? 0 : parSeconde >= 0.2 ? 1 : parSeconde >= 0.02 ? 2 : 3; }
  function renomTexte(x, dec) { const e = Math.floor(x); if (!dec) return nb(e); return nb(e) + '<small>,' + String(Math.floor((x - e) * Math.pow(10, dec))).padStart(dec, '0') + '</small>'; }

  // ---------------------------------------------------------------- les personnages (au trait, en néon)
  const TRAITS = {
    agent: '<circle cx="13" cy="13" r="5"/><path d="M13 18v12M13 22l11 4M5 33h32M9 33v8M33 33v8M13 30h-5v11"/><rect class="ag-ecr" x="25" y="15" width="11" height="9" rx="1.5"/><path d="M30 24v4"/>',
    negociateur: '<circle cx="20" cy="10" r="5"/><path d="M20 15v16M20 31l-5 10M20 31l5 10M20 20l-7 7M20 20l8-5"/><rect x="27" y="9" width="3" height="7" rx="1"/><path class="ag-onde" d="M33 9q3 3.5 0 7M36 7q5 5.500 0 11"/>',
    directeur: '<path class="ag-or" d="M13 6l3 4 4-5 4 5 3-4v8H13z"/><circle cx="20" cy="19" r="5"/><path d="M20 24v8M20 26l-8 5M20 26l8 5M3 35h34M6 35v7M34 35v7"/><path class="ag-or" d="M20 25v6M14 38h12"/>',
  };
  const perso = (p, extra) => `<svg class="ag-perso ag-${p}${extra || ''}" viewBox="0 0 40 44" aria-hidden="true"><g class="ag-lueur">${TRAITS[p]}</g><g>${TRAITS[p]}</g></svg>`;
  const BRIQUE = '<i class="ag-b"></i>';
  const GRUE = '<svg class="ag-grue" viewBox="0 0 60 64" aria-hidden="true"><path d="M14 64V8M20 64V8M14 8h6M14 20l6-6M14 32l6-6M14 44l6-6M14 56l6-6M4 8h52M17 2v6M17 2l30 6M17 2L6 8"/><g class="ag-crochet"><path d="M46 8v18"/><rect x="40" y="26" width="12" height="6" rx="1"/></g></svg>';

  // ---------------------------------------------------------------- l'écran
  function rendre() {
    const el = ecran(); if (!el) return; const a = courante();
    if (!a) { el.innerHTML = `${haut()}<div class="ag-scene"><div class="ag-attente">Ouverture de l’agence…</div></div>`; return; }
    el.innerHTML = `${haut()}
      <button class="ag-booster" id="ag-booster" data-a="booster"${packDispo() ? '' : ' hidden'}><span class="bp-sachet"></span><span class="bp-texte"><b>Booster disponible</b><small>Touche pour l’ouvrir</small></span></button>
      <div class="ag-scene" id="ag-scene">
        <div class="ag-compteur"><span>Renom</span><b id="ag-renom" data-pas-traduire></b><em id="ag-debit"></em></div>
        <div class="ag-absence" id="ag-absence"></div>
        <div class="ag-bas">
          <div class="ag-immeuble">${['directeur', 'negociateur', 'agent'].map((p) => `<div class="ag-etage" data-etage="${p}"><span class="ag-nom">${ETAGES[p]}</span><div class="ag-gens"></div><b class="ag-combien" data-pas-traduire></b></div>`).join('')}<div class="ag-enseigne" data-pas-traduire>${echapper(state.pseudo || 'Agence')}</div></div>
          <div class="ag-chantier">${GRUE}<div class="ag-mur" id="ag-mur"></div><span class="ag-total" id="ag-total"></span></div>
        </div>
      </div>
      <div class="ag-brique" id="ag-brique"><i id="ag-barre"></i><span id="ag-jauge"></span></div>
      <div id="ag-pose"></div>
      <div class="ag-embauches" id="ag-embauches"></div>
      <div class="ag-liens"><button class="ag-lien" data-a="regles">Comment ça marche ?</button>${MODE_SERVEUR ? '<button class="ag-lien" data-a="classement">🏆 Classement des briques</button>' : ''}</div>
      <div class="ag-note ag-prochain"${packDispo() ? ' hidden' : ''}>Prochain pack dans <b id="ag-pack" data-pas-traduire>${dureeCourte(secondesAvantPack())}</b></div>`;
    el.onclick = clic;
    majScene(a, true); majCommandes(a); battre();
  }
  function haut() {
    const p = Math.floor(pendingRent());
    return `<div class="acc-haut ag-haut"><h1>Mon agence</h1><span class="acc-esp"></span><button class="acc-pill" data-a="pieces"><i class="pc"></i><b id="ag-pieces">${nb(Math.floor(dispo()))}</b>${p >= 1 ? `<small class="ag-loyer" id="ag-loyer">+${nb(p)}</small>` : '<small class="ag-loyer" id="ag-loyer"></small>'}</button></div>`;
  }
  // les étages et le chantier : on n'ajoute et n'enlève que ce qui change (les animations des autres continuent)
  function majScene(a, sansEntree) {
    const sc = document.getElementById('ag-scene'); if (!sc) return;
    for (const p of AG.POSTES) {
      const et = sc.querySelector(`[data-etage="${p}"]`), gens = et.querySelector('.ag-gens'), n = a.e[p] || 0, vus = Math.min(n, VISIBLES[p]);
      while (gens.children.length > vus) gens.lastChild.remove();
      while (gens.children.length < vus) { const i = gens.children.length; gens.insertAdjacentHTML('beforeend', perso(p, sansEntree ? '' : ' arrive')); if (sansEntree) gens.lastChild.style.animationDelay = (-((i * 0.37) % 2)).toFixed(2) + 's'; else gens.lastChild.addEventListener('animationend', (ev) => ev.currentTarget.classList.remove('arrive'), { once: true }); }
      et.classList.toggle('vide', !n); et.querySelector('.ag-combien').textContent = n ? '×' + nb(n) : '';
    }
    sc.classList.toggle('vide', !(a.e.agent > 0));
    const mur = document.getElementById('ag-mur'), b = Math.min(a.briques, 27);
    while (mur.children.length > b) mur.lastChild.remove();
    while (mur.children.length < b) { mur.insertAdjacentHTML('beforeend', BRIQUE); if (!sansEntree) mur.lastChild.classList.add('neuve'); }
    document.getElementById('ag-total').innerHTML = `<b>${nb(a.briques)}</b> ${a.briques > 1 ? 'briques' : 'brique'}`;
  }
  // les boutons : poser une brique, embaucher
  function majCommandes(a) {
    const zone = document.getElementById('ag-embauches'), poseEl = document.getElementById('ag-pose'); if (!zone) return;
    const b = a.briques, pret = AG.briquesPossibles(a.renom, b), fonds = Math.floor(dispo());
    let mieux = null; for (const p of AG.POSTES) { const g = AG.gain(a, p) / AG.cout(p, a.e[p]); if (g > 0 && (!mieux || g > mieux.g)) mieux = { p, g }; }
    poseEl.innerHTML = pret ? `<button class="btn large ag-poser" data-a="poser">${pret > 1 ? `Poser <b>${nb(pret)}</b> briques` : 'Poser la brique'}</button><div class="ag-note">Tes employés et ton renom repartent de zéro, avec <b>+${Math.round(ECO.agence.brique.bonus * 100)} %</b> de renom en plus.</div>` : '';
    poseEl.dataset.pret = pret ? '1' : '';
    document.getElementById('ag-brique').classList.toggle('pleine', !!pret);
    if (zone.children.length !== AG.POSTES.length) zone.innerHTML = AG.POSTES.map((p) => `<div class="ag-case" data-case="${p}"><button class="ag-poste" data-poste="${p}"><span class="ag-mieux" hidden>Meilleur choix</span>
        <span class="ag-tete">${perso(p, ' fixe')}</span><b class="ag-qui">${UN[p]}</b><span class="ag-effet">${EFFET[p]}</span>
        <span class="ag-prix" data-pas-traduire></span><span class="ag-gain"></span></button><button class="ag-max" data-max="${p}" hidden></button></div>`).join('');
    for (const p of AG.POSTES) { const c = AG.cout(p, a.e[p]), g = AG.gain(a, p), premier = p === 'agent' && !a.e.agent, bt = zone.querySelector(`[data-poste="${p}"]`);
      bt.classList.toggle('cher', c > fonds); bt.classList.toggle('pulse', premier); bt.querySelector('.ag-mieux').hidden = !(mieux && mieux.p === p && a.e.agent > 0);
      const prix = bt.querySelector('.ag-prix'); if (prix.dataset.n !== String(c)) { prix.dataset.n = c; prix.innerHTML = pcs(c); }
      const gt = g > 0 ? `+${debitTexte(g)} par heure` : 'Il faut un agent', ge = bt.querySelector('.ag-gain'); if (ge.dataset.t !== gt) { ge.dataset.t = gt; ge.textContent = gt; } }
    majMax(a);
    if (window.ajusterChiffres) try { ajusterChiffres(zone); } catch (e) { /* tant pis */ }
  }
  // le bouton « Max » (18 nov., Gautier) : après deux touchers de suite sur le même poste, un petit bouton propose d'embaucher
  // d'un coup tout ce que les pièces permettent (25 au plus par demande : la limite du serveur)
  const MAX_LOT = 25; let serie = { poste: '', n: 0, t: 0 };
  function lot(a, poste, n, fonds) { let b = a, total = 0, faits = 0, refus = null; for (let k = 0; k < n; k++) { const r = AG.embaucher(b, poste, fonds - total); if (!r.ok) { refus = r; break; } b = r.agence; total += r.cout; faits++; } return { agence: b, total, faits, refus }; }
  function majMax(a) {
    const zone = document.getElementById('ag-embauches'); if (!zone) return; a = a || courante(); if (!a) return;
    for (const p of AG.POSTES) { const m = zone.querySelector(`[data-max="${p}"]`); if (!m) continue;
      const l = serie.poste === p && serie.n >= 2 && Date.now() - serie.t < 6000 && !pose ? lot(a, p, MAX_LOT, Math.floor(dispo())) : null, montre = !!(l && l.faits >= 2);
      if (m.hidden === montre) m.hidden = !montre;
      if (montre) { const t = l.faits + ':' + l.total; if (m.dataset.t !== t) { m.dataset.t = t; m.dataset.n = l.faits; m.innerHTML = `Max <b data-pas-traduire>×${nb(l.faits)}</b><small data-pas-traduire>${pcs(l.total)}</small>`; } } }
  }
  // ---------------------------------------------------------------- le direct : le renom, la brique, les étincelles
  function battre() {
    if (!visible()) return arreter();
    const a = courante(), el = document.getElementById('ag-renom'); if (!a || !el) return;
    const b = a.briques, s = AG.seuil(b), d = AG.debit(a.e, b), part = Math.min(1, a.renom / s);
    el.innerHTML = renomTexte(a.renom, decimales(d));
    const de = document.getElementById('ag-debit'), dt = d > 0 ? `+${debitTexte(d)} par heure` : 'Embauche ton premier agent'; if (de.dataset.t !== dt) { de.dataset.t = dt; de.textContent = dt; }
    document.getElementById('ag-barre').style.transform = `scaleX(${part.toFixed(4)})`;
    const j = document.getElementById('ag-jauge'), jt = `${nb(Math.floor(Math.min(a.renom, s)))} / ${nb(s)}`; if (j.dataset.t !== jt) { j.dataset.t = jt; j.innerHTML = `<b>${jt}</b> pour la prochaine brique`; }
    const pret = AG.briquesPossibles(a.renom, b) ? '1' : ''; if (!pose && document.getElementById('ag-pose').dataset.pret !== pret) { majCommandes(a); if (pret) vibrer(20); }
  }
  // chaque seconde : la bourse, les prix devenus abordables, le prochain pack, ce qu'on a vu (pour « pendant ton absence »)
  let tour = 0;
  function seconde() {
    if (!visible()) return arreter(); const a = courante(); if (!a) return;
    const pi = document.getElementById('ag-pieces'), f = Math.floor(dispo()); if (pi && pi.dataset.n !== String(f)) { pi.dataset.n = f; pi.textContent = nb(f); if (!pose) majCommandes(a); }
    const lo = document.getElementById('ag-loyer'), p = Math.floor(pendingRent()); if (lo) lo.textContent = p >= 1 ? '+' + nb(p) : '';
    const pr = ecran().querySelector('.ag-prochain'), pk = document.getElementById('ag-pack'), bo = document.getElementById('ag-booster'); if (pr) { const d = packDispo(); if (pr.hidden !== !!d) pr.hidden = !!d; if (bo && bo.hidden !== !d) bo.hidden = !d; if (!d && pk) pk.textContent = dureeCourte(secondesAvantPack()); }
    majMax(a);
    if (++tour % 5 === 0) noterVue(a);
  }
  function etincelle() {
    if (!visible() || document.hidden) return; const sc = document.getElementById('ag-scene'); if (!sc || pose) return;
    const gens = sc.querySelectorAll('.ag-gens .ag-perso'); if (!gens.length || sc.querySelectorAll('.ag-plus').length > 14) return;
    const g = gens[Math.floor(Math.random() * gens.length)], r = g.getBoundingClientRect(), s = sc.getBoundingClientRect();
    const i = document.createElement('i'); i.className = 'ag-plus' + (g.classList.contains('ag-directeur') ? ' or' : '');
    i.style.left = (r.left - s.left + r.width / 2).toFixed(0) + 'px'; i.style.top = (r.top - s.top).toFixed(0) + 'px';
    i.style.setProperty('--dx', ((s.width / 2 - (r.left - s.left + r.width / 2)) * 0.8).toFixed(0) + 'px'); i.style.setProperty('--dy', (-(r.top - s.top) + 38).toFixed(0) + 'px');
    i.addEventListener('animationend', () => i.remove()); sc.appendChild(i);
  }
  function demarrer() {
    arreter(); const calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    minuteur = [setInterval(battre, calme ? 1000 : 100), setInterval(seconde, 1000)];
    const a = courante(), d = a ? AG.debit(a.e, a.briques) : 0;
    if (!calme) etincelles = setInterval(etincelle, Math.max(280, 1400 - 380 * Math.log10(1 + d)));
  }
  function arreter() { if (minuteur) minuteur.forEach(clearInterval); minuteur = 0; clearInterval(etincelles); etincelles = 0; }
  // « pendant ton absence » : ce que l'agence a produit depuis la dernière fois qu'on l'a regardée
  function noterVue(a) { try { localStorage.setItem(CLE_VUE, JSON.stringify({ r: a.renom, b: a.briques, s: a.saison, t: Date.now() })); } catch (e) { /* stockage fermé */ } }
  function direAbsence(a) {
    if (absenceDite) return; absenceDite = true; let v = null; try { v = JSON.parse(localStorage.getItem(CLE_VUE) || 'null'); } catch (e) { v = null; }
    const el = document.getElementById('ag-absence'); noterVue(a);
    if (!v || !el || v.s !== a.saison || v.b !== a.briques || Date.now() - v.t < 60000) return; const g = Math.floor(a.renom - v.r); if (g < 1) return;
    el.innerHTML = `Pendant ton absence : <b>+${nb(g)}</b> de renom`; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 5000);
  }
  // ---------------------------------------------------------------- ouvrir l'écran
  async function montrer() {
    rendre(); demarrer(); let a = courante(); if (a && !MODE_SERVEUR) direAbsence(a);
    if (MODE_SERVEUR) { const r = await agir('agence'); if (r && r.agence) { const neuve = !recue; recevoir(r.agence); if (!visible()) return; if (neuve) rendre(); else { a = courante(); majScene(a, true); majCommandes(a); } demarrer(); direAbsence(courante()); } }
  }
  function ouvrir() { showScreen('agence'); }
  function clic(e) {
    const b = e.target.closest('[data-a],[data-poste],[data-max]'); if (!b) return; vibrer(8);
    if (b.dataset.max) { serie.t = Date.now(); return embaucher(b.dataset.max, Number(b.dataset.n) || 1); }
    if (b.dataset.poste) { const p = b.dataset.poste, t = Date.now(); serie = serie.poste === p && t - serie.t < 4000 ? { poste: p, n: serie.n + 1, t } : { poste: p, n: 1, t }; embaucher(p, 1); return majMax(); }
    const a = b.dataset.a; if (a === 'poser') return poser(); if (a === 'booster') return ouvrirPack(); if (a === 'pieces') return recolter(); if (a === 'regles') return regles(); if (a === 'classement') return ouvrirClassement();
  }
  function regles() {
    const box = document.getElementById('modalbox');
    box.innerHTML = `<h2>🏢 Mon agence</h2><div class="sub">Tes pièces embauchent des employés. Ils produisent du renom, même quand tu n’es pas là.</div>
      <div class="article"><div class="t">Les trois postes</div><div class="m">Les <b>agents</b> produisent le renom. Les <b>négociateurs</b> ajoutent ${Math.round(P.negociateur.bonus * 100)} % chacun à ce que produisent les agents. Les <b>directeurs</b> multiplient le tout par ${String(P.directeur.facteur).replace('.', ',')} chacun. Chaque embauche coûte plus cher que la précédente.</div></div>
      <div class="article"><div class="t">🧱 Les briques</div><div class="m">Avec assez de renom, tu poses une brique : tes employés et ton renom repartent de zéro, et chaque brique donne <b>+${Math.round(ECO.agence.brique.bonus * 100)} %</b> de renom jusqu’à la fin de la saison. La brique suivante demande plus de renom.</div></div>
      <div class="article"><div class="t">⏳ Passe la voir</div><div class="m">L’agence travaille <b>${ECO.agence.stock_heures} h</b> sans toi. À la fin de la saison, les briques sont comptées et tout repart de zéro.</div></div>
      <button class="btn clair large" onclick="closeModal()">Fermer</button>`;
    document.getElementById('modal').classList.add('on');
  }
  function rendreClassement() {
    if (!classement) return '<div class="m">Chargement…</div>';
    const moi = monUid(), lignes = classement.top.map((x, i) => `<div class="ag-rang${x.joueur === moi ? ' moi' : ''}"><b>${i + 1}</b><span class="ag-nomj">${echapper((x.avatar || '') + ' ' + (x.pseudo || '?'))}</span><b>${nb(x.n)}</b></div>`).join('');
    return `${lignes || '<div class="m">Personne n’a encore posé de brique cette saison.</div>'}${classement.rang && classement.rang > classement.top.length ? `<div class="m ag-note">Ta place : <b>${nb(classement.rang)}</b></div>` : ''}`;
  }
  function ouvrirClassement() {
    const box = document.getElementById('modalbox');
    box.innerHTML = `<h2>🏆 Les briques de la saison</h2><div id="ag-classement">${rendreClassement()}</div><button class="btn clair large" onclick="closeModal()">Fermer</button>`;
    document.getElementById('modal').classList.add('on'); chargerClassement();
  }
  async function chargerClassement() {
    if (!MODE_SERVEUR || !(window.Compte && Compte.client)) return; const s = recue ? recue.saison : saison(), j = monUid();
    try { const [c, r] = await Promise.all([Compte.client.rpc('classement_agences', { s, lim: 10 }), j ? Compte.client.rpc('rang_agence', { s, j }) : Promise.resolve({ data: [] })]);
      classement = { top: c.data || [], rang: r.data && r.data[0] ? Number(r.data[0].rang) : 0 }; const el = document.getElementById('ag-classement'); if (el) el.innerHTML = rendreClassement(); } catch (e) { /* le classement attendra */ }
  }
  // ---------------------------------------------------------------- les actions
  function flotter(depuis, texte) {
    const sc = ecran(); if (!sc || !depuis) return; const r = depuis.getBoundingClientRect(), s = sc.getBoundingClientRect();
    const i = document.createElement('i'); i.className = 'ag-flotte'; i.textContent = texte; i.setAttribute('data-pas-traduire', '');
    i.style.left = (r.left - s.left + r.width / 2).toFixed(0) + 'px'; i.style.top = (r.top - s.top + sc.scrollTop).toFixed(0) + 'px';
    i.addEventListener('animationend', () => i.remove()); sc.appendChild(i);
  }
  // embaucher : les touchers ne se perdent plus pendant que le serveur répond (18 nov., Gautier : « on ne peut pas spammer
  // le bouton ») : ils s'ajoutent à une file par poste, envoyée en une seule demande dès que la précédente est revenue
  const file = {};
  function embaucher(poste, n) { if (pose) return; file[poste] = Math.min(MAX_LOT, (file[poste] || 0) + (n || 1)); if (!occupe) vider(); }
  async function vider() {
    for (;;) {
      const poste = AG.POSTES.find((p) => file[p] > 0); if (!poste || occupe || pose) return;
      const voulu = file[poste]; file[poste] = 0;
      const a = courante(); if (!a) return;
      const l = lot(a, poste, voulu, Math.floor(dispo())), gain = l.faits ? AG.debit(l.agence.e, a.briques) - AG.debit(a.e, a.briques) : 0;
      if (!l.faits) { vibrer(30); const r = l.refus || {}; toast(r.raison === 'fonds' ? `Il te manque ${fmt(r.cout - Math.floor(dispo()))} pour cette embauche` : 'Ton agence est pleine : pose une brique pour repartir'); continue; }
      occupe = true;
      try {
        if (MODE_SERVEUR) { const r = await agir('agence_embaucher', { poste, n: l.faits }); if (r) recevoir(r.agence); }
        else { encaisser(true); state.wallet -= l.total; state.agence = l.agence; save(); }
      } finally { occupe = false; }
      vibrer(10); refreshTop(); if (!visible()) return;
      const apres = courante(); majScene(apres); majCommandes(apres); demarrer();
      const et = document.querySelector(`#ag-scene [data-etage="${poste}"]`); if (et) { et.classList.remove('eclat'); void et.offsetWidth; et.classList.add('eclat'); }
      if (gain > 0) flotter(document.getElementById('ag-debit'), `+${debitTexte(gain)}`);
    }
  }
  async function poser() {
    if (occupe || pose) return; const a = courante(); if (!a) return; const r = AG.poser(a);
    if (!r.ok) { vibrer(30); return toast(`Encore ${nb(r.manque)} de renom avant la prochaine brique`); }
    occupe = true; let n = r.briques;
    try {
      if (MODE_SERVEUR) { const x = await agir('agence_brique'); if (!x) return; recevoir(x.agence); n = x.briques; }
      else { state.agence = r.agence; save(); }
    } finally { occupe = false; }
    vibrer([20, 30, 60]); toast(n > 1 ? `${n} briques posées ! Ton agence repart, plus forte.` : 'Une brique posée ! Ton agence repart, plus forte.');
    if (!visible()) return;
    // la scène : les employés s'en vont, la brique tombe sur le chantier, puis l'agence repart
    const sc = document.getElementById('ag-scene'); pose = true; if (sc) sc.classList.add('pose');
    document.getElementById('ag-pose').innerHTML = '';
    setTimeout(() => { pose = false; fete(n > 1 ? 24 : 16); if (!visible()) return; const b = courante(); if (sc) sc.classList.remove('pose'); majScene(b); majCommandes(b); demarrer(); noterVue(b); }, 650);
  }
  window.AGENCE = { ouvrir, montrer, courante, recevoir, carte: () => '' };
})();
