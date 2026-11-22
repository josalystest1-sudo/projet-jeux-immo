// L'agence, côté jeu (16 nov. 2026, GDD § 5 sexies ; règles : src/regles/agence.js). Depuis le 16 nov. au soir, l'agence
// est un écran de la barre du bas, à la place de l'accueil (Gautier : « on a l'impression d'être devant un panneau de
// contrôle, on ne voit pas les employés travailler, le renom monter en direct »). Une scène de nuit en néon :
//   - l'immeuble de l'agence vu en coupe, un étage meublé par poste : on voit les employés travailler (quelques-uns par
//     étage, le nombre exact sur la plaque) ; chaque embauche fait entrer un personnage. Depuis le 22 nov. (Gautier : « de
//     vrais employés façon dessin animé, les bureaux et tout ça, pas des bonshommes bâtons »), les personnages et les
//     décors ont été redessinés, puis refaits en pixel art le jour même (« trop simplistes, je veux du pixel art ») :
//     src/agence_pixel.js peint tout, la scène est un seul canevas de 176 pixels de large (peindre) ;
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
  const VISIBLES = { agent: 5, negociateur: 4, directeur: 2 }, CLE_VUE = 'cadastra-agence-vue';
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
  // l'agence reçue est gardée dans le téléphone (18 nov., Gautier : « l'agence met quelques dizaines de secondes à s'ouvrir ») :
  // à l'ouverture, on montre tout de suite la dernière connue, avancée jusqu'à maintenant ; le serveur la corrige en arrivant
  const cleMemoire = () => 'cadastra-agence-' + (monUid() || '');
  function recevoir(a) { if (a) { recue = a; recueLe = Date.now(); try { localStorage.setItem(cleMemoire(), JSON.stringify({ a, t: recueLe })); } catch (e) { /* stockage fermé */ } } }
  function rappeler() { if (recue || !MODE_SERVEUR || !monUid()) return; try { const m = JSON.parse(localStorage.getItem(cleMemoire()) || 'null'); if (m && m.a && m.a.e && m.t <= Date.now()) { recue = m.a; recueLe = m.t; } } catch (e) { /* tant pis */ } }
  // les pièces qu'on peut dépenser ici : moins celles des embauches déjà montrées à l'écran mais pas encore confirmées par le serveur
  let engage = 0; const fonds = () => Math.max(0, Math.floor(dispo()) - engage);
  const debitTexte = (x) => (x >= 100 ? nb(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ','));
  // le renom à l'écran : assez de décimales pour qu'on le voie bouger (au vrai rythme, une heure du jeu dure une heure)
  function decimales(debit) { if (!(debit > 0)) return 0; const parSeconde = debit / (JOUR / 24 / 1000); return parSeconde >= 2 ? 0 : parSeconde >= 0.2 ? 1 : parSeconde >= 0.02 ? 2 : 3; }
  function renomTexte(x, dec) { const e = Math.floor(x); if (!dec) return nb(e); return nb(e) + '<small>,' + String(Math.floor((x - e) * Math.pow(10, dec))).padStart(dec, '0') + '</small>'; }

  // ---------------------------------------------------------------- la scène en pixel art (src/agence_pixel.js)
  // Un seul canevas de 176 × 181 pixels, repeint 7 fois par seconde et agrandi sans lissage : le toit, les trois étages
  // (décor gardé, employés par-dessus), le chantier. Chaque employé a sa tête, tirée de son rang dans le poste (et du
  // joueur) : toujours la même d'une visite à l'autre.
  const PX = { W: 176, H: 181, y: { directeur: 14, negociateur: 59, agent: 104 }, chantier: 149 };
  const graine = (p, i) => (state.pseudo || '') + '/' + p + '/' + i;
  const PLACE = { agent: (k) => 4 + k * 33, negociateur: (k) => 16 + k * 40, directeur: (k) => 22 + k * 84 };
  // quand un étage est plein, le dernier embauché prend la place d'un ancien : la case k montre le plus récent de rang ≡ k
  const rangCase = (n, vus, k) => (n <= vus ? k : k + vus * Math.floor((n - 1 - k) / vus));
  let image = 0, briquesVues = 0, chute = -99, acteurs = []; const modele = { agent: [], negociateur: [], directeur: [] }, eclats = {};
  function peindre() {
    const c = document.getElementById('ag-pix'), a = courante(); if (!c || !a) return;
    const g = c.getContext('2d'), R = (coul, x, y, l, h) => { g.fillStyle = coul; g.fillRect(x, y, l, h); };
    g.clearRect(0, 0, PX.W, PX.H); acteurs = [];
    // le toit : le climatiseur, l'antenne et son feu rouge
    R('#141a33', 9, 2, 16, 8); R('#8c96b3', 10, 3, 14, 7); for (let x = 11; x < 24; x += 3) R('#6e789a', x, 4, 1, 5);
    R('#8c96b3', 152, 1, 1, 9); R(image % 10 < 5 ? '#ff6b5e' : '#7a2e2a', 151, 0, 3, 2);
    R('#141a33', 0, 9, PX.W, PX.H - 9); R('#1b2550', 1, 10, PX.W - 2, PX.H - 10); R('#2f3f86', 1, 10, PX.W - 2, 1); R('#26336e', 1, 11, 2, PX.H - 11); R('#26336e', PX.W - 3, 11, 2, PX.H - 11);
    for (const p of ['directeur', 'negociateur', 'agent']) {
      const y0 = PX.y[p]; g.drawImage(AgencePixel.decor(p, (a.e[p] || 0) > 0), 3, y0);
      if (pose) continue;
      modele[p].forEach((m, k) => {
        const ph = (m.rang * 7 + k * 3) % 11; let x = PLACE[p](k), f = 0, miroir = false, dy = 0;
        if (p === 'agent') f = (image + ph) % 2;
        else if (p === 'directeur') f = Math.floor((image + ph) / 2) % 4;
        else { const T = 64 + ph * 4, t = (image + ph * 9) % T, u = t < T / 2 ? t / (T / 2) : 2 - t / (T / 2); x += Math.round((u * 2 - 1) * (7 + ph % 4 * 2)); miroir = t >= T / 2; f = Math.floor(image / 2) % 4; }
        const age = image - m.ne, saut = image - m.saut; if (age >= 0 && age < 5) dy -= [12, 7, 3, 1, 0][age]; if (saut >= 0 && saut < 4) dy -= [3, 5, 3, 1][saut];
        const im = AgencePixel.employe(p, graine(p, m.rang), f), yy = y0 + 41 - im.height + dy;
        if (miroir) { g.save(); g.translate(3 + x + im.width, yy); g.scale(-1, 1); g.drawImage(im, 0, 0); g.restore(); } else g.drawImage(im, 3 + x, yy);
        // la bulle du négociateur, de temps en temps
        if (p === 'negociateur' && (image + ph * 13) % 72 < 16) { const bx = 3 + x + (miroir ? -6 : 13), by = yy - 3; R('#141a33', bx, by, 9, 7); R('#fff', bx + 1, by + 1, 7, 5); R('#fff', bx + (miroir ? 6 : 2), by + 6, 1, 1); [2, 4, 6].forEach((d, i) => R(i === Math.floor(image / 2) % 3 ? '#2453b3' : '#9fb6dc', bx + d, by + 3, 1, 1)); }
        acteurs.push({ m, p, x: 3 + x, y: yy, l: im.width, h: im.height });
      });
      const e = image - (eclats[p] || -99); if (e < 4) { g.fillStyle = `rgba(255,255,255,${0.4 - e * 0.1})`; g.fillRect(3, y0, 170, 41); }
    }
    // le chantier : la grue, le mur de briques de la saison, l'ouvrier
    const y0 = PX.chantier, sol = y0 + 28; R('#0d1436', 3, y0, 170, 28); R('#2a3364', 3, sol, 170, 4); R('#3a4a8c', 3, sol, 170, 1);
    for (let x = 6; x < 170; x += 23) R('#16204f', x, y0 + 6 + (x % 3) * 5, 1, 1);
    g.drawImage(AgencePixel.grue(Math.floor(image / 3)), 5, sol - 30);
    const n = Math.min(briquesVues, 40);
    if (!n) { for (let x = 44; x < 122; x += 4) { R('#6b5a2a', x, sol - 6, 2, 1); R('#6b5a2a', x, sol - 1, 2, 1); } }
    for (let i = 0; i < n; i++) { let y = sol - 4 - Math.floor(i / 10) * 5; const t = image - chute; if (i === n - 1 && t >= 0 && t < 5) y -= [20, 12, 6, 2, 0][t]; AgencePixel.brique(g, 44 + (i % 10) * 8, y); }
    g.drawImage(AgencePixel.ouvrier(Math.floor(image / 3)), 126, sol - 24);
  }

  // ---------------------------------------------------------------- l'écran
  function rendre() {
    const el = ecran(); if (!el) return; const a = courante();
    if (!a) { el.innerHTML = `${haut()}<div class="ag-scene"><div class="ag-attente">Ouverture de l’agence…</div></div>`; return; }
    el.innerHTML = `${haut()}
      <button class="ag-booster" id="ag-booster" data-a="booster"${packDispo() ? '' : ' hidden'}><span class="bp-sachet"></span><span class="bp-texte"><b>Booster disponible</b><small>Touche pour l’ouvrir</small></span></button>
      <div class="ag-scene" id="ag-scene"><canvas class="ag-ville" id="ag-ville"></canvas>
        <div class="ag-compteur"><span>Renom</span><b id="ag-renom" data-pas-traduire></b><em id="ag-debit"></em></div>
        <div class="ag-absence" id="ag-absence"></div>
        <div class="ag-cadre" id="ag-cadre"><canvas class="ag-pix" id="ag-pix" width="${PX.W}" height="${PX.H}"></canvas>
          <div class="ag-enseigne" data-pas-traduire>${echapper(state.pseudo || 'Agence')}</div>
          ${['directeur', 'negociateur', 'agent'].map((p) => `<span class="ag-nom" data-etage="${p}" style="top:${((PX.y[p] + 2) / PX.H * 100).toFixed(2)}%">${ETAGES[p]} <b class="ag-combien" data-pas-traduire></b></span>`).join('')}
          <div class="ag-panneau"><span>Chantier</span><b class="ag-total" id="ag-total"></b></div>
        </div>
      </div>
      <div class="ag-brique" id="ag-brique"><i id="ag-barre"></i><u></u><span id="ag-jauge"></span></div>
      <div id="ag-pose"></div>
      <div class="ag-embauches" id="ag-embauches"></div>
      <div class="ag-liens"><button class="ag-lien" data-a="regles">Comment ça marche ?</button>${MODE_SERVEUR ? '<button class="ag-lien" data-a="classement">🏆 Classement des briques</button>' : ''}</div>
      <div class="ag-note ag-prochain"${packDispo() ? ' hidden' : ''}>Prochain pack dans <b id="ag-pack" data-pas-traduire>${dureeCourte(secondesAvantPack())}</b></div>`;
    el.onclick = clic; AgencePixel.poser(document.getElementById('ag-ville'), AgencePixel.ville());
    majScene(a, true); majCommandes(a); battre();
  }
  function haut() {
    const p = Math.floor(pendingRent());
    return `<div class="acc-haut ag-haut"><h1>Mon agence</h1><span class="acc-esp"></span><button class="acc-pill" data-a="pieces"><i class="pc"></i><b id="ag-pieces">${nb(fonds())}</b>${p >= 1 ? `<small class="ag-loyer" id="ag-loyer">+${nb(p)}</small>` : '<small class="ag-loyer" id="ag-loyer"></small>'}</button></div>`;
  }
  // les étages et le chantier : on n'ajoute et n'enlève que ce qui change (les animations des autres continuent)
  function majScene(a, sansEntree) {
    const sc = document.getElementById('ag-scene'); if (!sc) return;
    for (const p of AG.POSTES) {
      const n = a.e[p] || 0, vus = Math.min(n, VISIBLES[p]), liste = modele[p]; liste.length = Math.min(liste.length, vus);
      for (let k = 0; k < vus; k++) { const rang = rangCase(n, VISIBLES[p], k); if (!liste[k] || liste[k].rang !== rang) liste[k] = { rang, ne: sansEntree ? -99 : image, saut: -99 }; }
      const pl = sc.querySelector(`.ag-nom[data-etage="${p}"]`); if (pl) { pl.classList.toggle('vide', !n); pl.querySelector('.ag-combien').textContent = n ? '×' + nb(n) : ''; }
    }
    if (a.briques > briquesVues && !sansEntree) chute = image; briquesVues = a.briques;
    document.getElementById('ag-total').innerHTML = `<b>${nb(a.briques)}</b> ${a.briques > 1 ? 'briques' : 'brique'}`;
    peindre();
  }
  // les boutons : poser une brique, embaucher
  function majCommandes(a) {
    const zone = document.getElementById('ag-embauches'), poseEl = document.getElementById('ag-pose'); if (!zone) return;
    const b = a.briques, pret = AG.briquesPossibles(a.renom, b), argent = fonds();
    let mieux = null; for (const p of AG.POSTES) { const g = AG.gain(a, p) / AG.cout(p, a.e[p]); if (g > 0 && (!mieux || g > mieux.g)) mieux = { p, g }; }
    poseEl.innerHTML = pret ? `<button class="ag-poser" data-a="poser"><span class="ag-poser-b"><canvas></canvas></span><span class="ag-poser-t">${pret > 1 ? `Poser <b>${nb(pret)}</b> briques` : 'Poser la brique'}</span><i class="ag-poser-r"></i></button><div class="ag-note">Tes employés et ton renom repartent de zéro, avec <b>+${Math.round(ECO.agence.brique.bonus * 100)} %</b> de renom en plus.</div>` : '';
    poseEl.dataset.pret = pret ? '1' : ''; if (pret) AgencePixel.poser(poseEl.querySelector('canvas'), AgencePixel.grandeBrique());
    document.getElementById('ag-brique').classList.toggle('pleine', !!pret);
    if (zone.children.length !== AG.POSTES.length) zone.innerHTML = AG.POSTES.map((p) => `<div class="ag-case" data-case="${p}"><button class="ag-poste" data-poste="${p}"><span class="ag-mieux" hidden>Meilleur choix</span>
        <span class="ag-tete ag-t-${p}"></span><b class="ag-qui">${UN[p]}</b><span class="ag-effet">${EFFET[p]}</span>
        <span class="ag-prix" data-pas-traduire></span><span class="ag-gain"></span></button><button class="ag-max" data-max="${p}" hidden></button></div>`).join('');
    for (const p of AG.POSTES) { const c = AG.cout(p, a.e[p]), g = AG.gain(a, p), premier = p === 'agent' && !a.e.agent, bt = zone.querySelector(`[data-poste="${p}"]`);
      bt.classList.toggle('cher', c > argent); bt.classList.toggle('pulse', premier); bt.querySelector('.ag-mieux').hidden = !(mieux && mieux.p === p && a.e.agent > 0);
      const tt = bt.querySelector('.ag-tete'); if (tt.dataset.n !== String(a.e[p])) { tt.dataset.n = a.e[p]; tt.innerHTML = '<canvas></canvas>'; AgencePixel.poser(tt.firstChild, AgencePixel.portrait(p, graine(p, a.e[p]))); }
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
      const l = serie.poste === p && serie.n >= 2 && Date.now() - serie.t < 6000 && !pose ? lot(a, p, MAX_LOT, fonds()) : null, montre = !!(l && l.faits >= 2);
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
    const pi = document.getElementById('ag-pieces'), f = fonds(); if (pi && pi.dataset.n !== String(f)) { pi.dataset.n = f; pi.textContent = nb(f); if (!pose) majCommandes(a); }
    const lo = document.getElementById('ag-loyer'), p = Math.floor(pendingRent()); if (lo) lo.textContent = p >= 1 ? '+' + nb(p) : '';
    const pr = ecran().querySelector('.ag-prochain'), pk = document.getElementById('ag-pack'), bo = document.getElementById('ag-booster'); if (pr) { const d = packDispo(); if (pr.hidden !== !!d) pr.hidden = !!d; if (bo && bo.hidden !== !d) bo.hidden = !d; if (!d && pk) pk.textContent = dureeCourte(secondesAvantPack()); }
    majMax(a);
    if (++tour % 5 === 0) noterVue(a);
  }
  function etincelle() {
    if (!visible() || document.hidden) return; const sc = document.getElementById('ag-scene'); if (!sc || pose) return;
    const cv = document.getElementById('ag-pix'); if (!cv || !acteurs.length || sc.querySelectorAll('.ag-plus').length > 14) return;
    const g = acteurs[Math.floor(Math.random() * acteurs.length)], r = cv.getBoundingClientRect(), s = sc.getBoundingClientRect(), k = r.width / PX.W;
    const gx = r.left - s.left + (g.x + g.l / 2) * k, gy = r.top - s.top + g.y * k;
    const i = document.createElement('i'); i.className = 'ag-plus' + (g.p === 'directeur' ? ' or' : '');
    i.style.left = gx.toFixed(0) + 'px'; i.style.top = gy.toFixed(0) + 'px';
    i.style.setProperty('--dx', ((s.width / 2 - gx) * 0.8).toFixed(0) + 'px'); i.style.setProperty('--dy', (-gy + 38).toFixed(0) + 'px');
    i.addEventListener('animationend', () => i.remove()); sc.appendChild(i);
  }
  function demarrer() {
    arreter(); const calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    minuteur = [setInterval(battre, calme ? 1000 : 100), setInterval(seconde, 1000), setInterval(() => { if (!visible()) return; image++; peindre(); }, calme ? 1000 : 140)];
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
    rappeler(); rendre(); demarrer(); let a = courante(); if (a && !MODE_SERVEUR) direAbsence(a);
    if (MODE_SERVEUR) { const v = version, r = await agir('agence'); if (r && r.agence) { if (enVol || attente.length || v !== version) return;   // (des embauches sont en route : leur réponse fera foi)
      const neuve = !recue; recevoir(r.agence); if (!visible()) return; if (neuve) rendre(); else { a = courante(); majScene(a, true); majCommandes(a); } demarrer(); direAbsence(courante()); } }
  }
  function ouvrir() { showScreen('agence'); }
  function clic(e) {
    if (e.target.id === 'ag-pix') { const r = e.target.getBoundingClientRect(), k = PX.W / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
      const g = acteurs.find((t) => x >= t.x - 1 && x <= t.x + t.l + 1 && y >= t.y - 1 && y <= t.y + t.h + 1); if (g) { vibrer(8); g.m.saut = image; } return; }
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
    const moi = monUid(), lignes = classement.top.map((x, i) => `<div class="ag-rang${x.joueur === moi ? ' moi' : ''}"><b>${i + 1}</b><span class="ag-nomj">${avatarHTML(x.avatar, ' ')} ${echapper(x.pseudo || '?')}</span><b>${nb(x.n)}</b></div>`).join('');
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
  // embaucher (18 nov., Gautier : « l'action n'est pas instantanée ») : l'embauche se voit tout de suite à l'écran (employé,
  // prix suivant, pièces), puis part au serveur. Les demandes partent l'une après l'autre ; celles du même poste qui
  // attendent se regroupent (25 au plus). Tant qu'il en reste en route, l'écran garde sa version ; à la dernière réponse,
  // celle du serveur fait foi. Un refus du serveur : on reprend son agence telle qu'il la donne.
  let attente = [], enVol = false, version = 0;   // (version : une réponse partie avant une embauche ne doit pas l'effacer)
  function embaucher(poste, n) {
    if (pose) return; const a = courante(); if (!a) return;
    const l = lot(a, poste, Math.min(MAX_LOT, n || 1), fonds());
    if (!l.faits) { vibrer(30); const r = l.refus || {}; return toast(r.raison === 'fonds' ? `Il te manque ${fmt(r.cout - fonds())} pour cette embauche` : 'Ton agence est pleine : pose une brique pour repartir'); }
    const gain = AG.debit(l.agence.e, a.briques) - AG.debit(a.e, a.briques);
    if (MODE_SERVEUR) { version++; recue = l.agence; recueLe = Date.now(); engage += l.total;
      const d = attente[attente.length - 1]; if (d && d.poste === poste && d.n + l.faits <= MAX_LOT) { d.n += l.faits; d.total += l.total; } else attente.push({ poste, n: l.faits, total: l.total });
      envoyer(); }
    else { encaisser(true); state.wallet -= l.total; state.agence = l.agence; save(); refreshTop(); }
    vibrer(10); if (!visible()) return;
    const apres = courante(), pi = document.getElementById('ag-pieces'); if (pi) { pi.dataset.n = fonds(); pi.textContent = nb(fonds()); }
    majScene(apres); majCommandes(apres); demarrer();
    eclats[poste] = image;
    if (gain > 0) flotter(document.getElementById('ag-debit'), `+${debitTexte(gain)}`);
  }
  async function envoyer() {
    if (enVol || !attente.length) return; const d = attente.shift(); enVol = true; let r = null;
    try { r = await agir('agence_embaucher', { poste: d.poste, n: d.n }); } finally { enVol = false; engage = Math.max(0, engage - d.total); }
    if (!r) { attente = []; engage = 0; const x = await agir('agence'); if (x && x.agence) recevoir(x.agence); }   // (refusé : l'agence du serveur)
    else if (!attente.length) recevoir(r.agence);
    refreshTop();
    if (attente.length) return envoyer();
    if (visible()) { const a = courante(); majScene(a, true); majCommandes(a); }
  }
  async function poser() {
    if (occupe || pose) return; if (enVol || attente.length) return toast('Un instant : tes embauches arrivent');
    const a = courante(); if (!a) return; const r = AG.poser(a);
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
