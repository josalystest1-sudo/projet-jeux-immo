// La chasse au trésor dans le jeu (idée de Gautier du 6 nov. 2026, GDD § 5 quinquies ; règles : src/regles/chasse.js).
// Une chasse est annoncée quelques minutes avant (un bandeau sur la carte) : on s'y inscrit ; pendant ce temps, le téléphone
// charge d'avance les tuiles du quartier du départ (Gautier : « la commune peut être un contenu instancié, pour la modéliser
// en avance et réduire les lags »). Au départ, les inscrits sont téléportés devant la mairie ; « 3, 2, 1, partez ! » ; on
// marche à la manette (la balade, caméra derrière le pion). Un indice de plus toutes les 2 minutes : un cercle doré sur la
// carte, le nom de la rue, le côté, le numéro. Le premier arrivé gagne (le serveur décide). Pendant la chasse, la ville
// prend une lumière dorée (« pourquoi pas même rendre la commune encore plus jolie »).
// Mode serveur : actions chasse, chasse_rejoindre, chasse_position (fonction « jeu ») ; démo : une chasse simulée ici
// (Réglages → « Lancer une chasse d'essai »), avec les mêmes règles.
(function () {
  const CHR = Chasse.creer(ECO), C = CHR.C;
  const CH = window.CHASSE = { vue: null, inscrits: 0, moi: null, autres: [], prochaine: null, inscrit: false, dans: false, ecart: 0, finVue: null, envoi: null, enVol: false,
    marqueurs: {}, depart: null, coffre: null, minut: null, tic: null, charge: { fait: 0, total: 0, pour: '' }, dernierCercle: 0, annonceFin: '' };
  const maintenant = () => Date.now() + CH.ecart;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---------------------------------------------------------------- le serveur (ou la démo)
  async function appel(action, corps) {
    if (MODE_SERVEUR) { const r = await appelServeur(action, corps); if (r && r.ok && r.etat) appliquerEtat(r.etat); return r; }
    try { return Object.assign({ ok: true }, await DEMO[action](corps || {})); } catch (e) { return { ok: false, message: e.message || 'Chasse impossible' }; }
  }
  function recevoir(r) {
    if (!r || !r.ok) return;
    if (r.maintenant) CH.ecart = r.maintenant - Date.now();
    CH.vue = r.chasse || null; CH.inscrits = r.inscrits || 0; CH.moi = r.moi || null; CH.autres = r.autres || []; CH.prochaine = r.prochaine || null;
    if (CH.vue && CH.moi) CH.inscrit = true;
    if (!CH.vue || CH.vue.id !== CH.pour) { CH.pour = CH.vue ? CH.vue.id : null; CH.inscrit = !!(CH.vue && CH.moi); CH.finVue = null; }
    if (CH.inscrit && CH.vue && CH.charge.pour !== CH.vue.id) preparerQuartier(CH.vue.depart, CH.vue.id);
    majBandeau(); if (CH.dans) majDans(); planifier();
  }
  async function suivre() { if (document.visibilityState === 'hidden') return; recevoir(await appel('chasse')); }
  // les prochains instants utiles : l'annonce, la téléportation, le départ, le prochain indice, la fin
  function planifier() {
    clearTimeout(CH.minut); const v = CH.vue, t = maintenant(); let at = t + 60000;
    if (v) for (const x of [v.annonce, v.debut - 12000, v.debut, v.prochainIndice, v.fin]) if (x && x > t + 500 && x < at) at = x;
    else if (CH.prochaine) { if (CH.prochaine.annonce > t && CH.prochaine.annonce < at) at = CH.prochaine.annonce; }
    CH.minut = setTimeout(async () => { await suivre(); if (CH.inscrit && !CH.dans && CH.vue && (CH.vue.etat === 'en_cours' || (CH.vue.etat === 'annonce' && maintenant() >= CH.vue.debut - 13000))) entrer(); }, Math.max(800, at - t + 300));
  }

  // ---------------------------------------------------------------- le bandeau de la carte : l'annonce, l'inscription
  function bandeau() { let b = document.getElementById('chasse-bandeau');
    if (!b) { b = document.createElement('div'); b.id = 'chasse-bandeau'; document.getElementById('top').appendChild(b); b.addEventListener('click', (e) => { const x = e.target.closest('[data-chasse]'); if (x) actionBandeau(x.dataset.chasse); }); }
    return b; }
  function majBandeau() {
    const b = bandeau(), v = CH.vue, t = maintenant(); clearInterval(CH.tic);
    const voir = v && !CH.dans && (v.etat === 'annonce' || v.etat === 'en_cours' || ((v.etat === 'trouvee' || v.etat === 'finie') && CH.inscrit));
    b.hidden = !voir; document.body.classList.toggle('avec-chasse', !!voir); if (!voir) return;
    const nom = echapper(v.commune), ins = CH.inscrits ? ` · ${nb(CH.inscrits)} inscrit${CH.inscrits > 1 ? 's' : ''}` : '';
    let h = '';
    if (v.etat === 'annonce') h = `<div class="t">🗺️ Chasse au trésor à <b data-pas-traduire>${nom}</b></div><div class="s">Départ dans <b class="chrono">${mmss(v.debut - t)}</b>${ins}</div>`
      + (CH.inscrit ? `<span class="ok">✓ Inscrit</span>${CH.charge.total ? `<div class="charge"><i style="width:${Math.round(100 * CH.charge.fait / CH.charge.total)}%"></i></div>` : ''}` : '<button class="btn" data-chasse="inscrire">S’inscrire</button>');
    else if (v.etat === 'en_cours') h = `<div class="t">🗺️ Chasse en cours à <b data-pas-traduire>${nom}</b></div><div class="s">Indice ${v.niveau}/${C.indices.length} · fin dans <b class="chrono">${mmss(v.fin - t)}</b>${ins}</div>`
      + `<button class="btn" data-chasse="${CH.inscrit ? 'entrer' : 'inscrire'}">${CH.inscrit ? 'Reprendre' : 'Rejoindre'}</button>`;
    else h = `<div class="t">${v.gagnant ? `🏆 <b>${echapper(v.gagnant.pseudo)}</b> a trouvé le trésor` : '🗺️ Personne n’a trouvé le trésor'}</div><div class="s">C’était au <b data-pas-traduire>${echapper(v.tresor || '?')}</b></div><button class="btn clair" data-chasse="fermer">OK</button>`;
    b.innerHTML = h;
    CH.tic = setInterval(() => { const c = b.querySelector('.chrono'); if (!c || !CH.vue) return; c.textContent = mmss((CH.vue.etat === 'annonce' ? CH.vue.debut : CH.vue.fin) - maintenant());
      const k = b.querySelector('.charge i'); if (k && CH.charge.total) k.style.width = Math.round(100 * CH.charge.fait / CH.charge.total) + '%'; }, 1000);
  }
  async function actionBandeau(quoi) {
    vibrer(8);
    if (quoi === 'fermer') { CH.inscrit = false; majBandeau(); return; }
    if (quoi === 'entrer') return entrer();
    const r = await appel('chasse_rejoindre'); if (!r || !r.ok) { toast((r && r.message) || 'Inscription impossible'); return; }
    CH.inscrit = true; recevoir(r); toast('🗺️ Inscrit ! Au départ, tu seras emmené devant la mairie');
    if (CH.vue && CH.vue.etat === 'en_cours') entrer();
  }

  // ---------------------------------------------------------------- le quartier chargé d'avance (les tuiles de l'IGN)
  // Les tuiles se gardent 21 jours dans le téléphone (cache-control de data.geopf.fr) : chargées pendant l'inscription, la
  // carte les retrouve sans attendre. Le quartier du départ d'abord, puis l'intérieur de chaque cercle d'indice.
  const TUILES = ['https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf', 'https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf'];
  const tuile = (lon, lat, z) => { const n = 2 ** z, r = lat * Math.PI / 180; return [Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
  function tuilesAutour(pt, rayon, z) { const d = Chasse.decale, a = tuile(d(d(pt, 0, rayon), 270, rayon).lon, d(pt, 0, rayon).lat, z), b = tuile(d(pt, 90, rayon).lon, d(pt, 180, rayon).lat, z), out = [];
    for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (const m of TUILES) out.push(m.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    return out; }
  const dejaCharge = new Set(); let fileTuiles = [], actives = 0;
  function charger(urls) { for (const u of urls) if (!dejaCharge.has(u)) { dejaCharge.add(u); fileTuiles.push(u); CH.charge.total++; } pomper(); }
  function pomper() { while (actives < 3 && fileTuiles.length) { const u = fileTuiles.shift(); actives++;
      fetch(u, { priority: 'low' }).catch(() => {}).finally(() => { actives--; CH.charge.fait++; pomper(); }); } }
  function preparerQuartier(pt, id) { if (!pt) return; CH.charge = { fait: 0, total: 0, pour: id }; charger([...tuilesAutour(pt, 350, 18), ...tuilesAutour(pt, 700, 17)]); }

  // ---------------------------------------------------------------- dans la chasse : téléporté au départ, puis à la manette
  function entrer() {
    const v = CH.vue; if (!v || CH.dans || !CH.inscrit || (v.etat !== 'annonce' && v.etat !== 'en_cours')) return;
    if (PROM.on) finPromenade(); try { closeModal(); } catch (e) {} if (document.getElementById('sheet').classList.contains('open')) closeSheet();
    CH.dans = true; majBandeau(); showScreen('carte');
    const ici = CH.moi || v.depart;
    allerA(ici.lon, ici.lat, 18, () => {
      if (!CH.dans) return;
      promenade({ lon: ici.lon, lat: ici.lat, cap: 0, chasse: true });
      if (!PROM.on) { CH.dans = false; majBandeau(); return; }
      document.body.classList.add('en-chasse'); ambiance(true); hud(); majDans();
      if (maintenant() < v.debut) compteARebours(); else toast('🗺️ Trouve le trésor : les indices arrivent toutes les 2 minutes');
      clearInterval(CH.envoi); CH.envoi = setInterval(envoyer, 2000);
    }, v.commune, 'Chasse au trésor');
  }
  // l'ambiance de la chasse : une lumière dorée de fin d'après-midi
  function ambiance(on) {
    if (on) { try { map.setLight({ anchor: 'viewport', color: '#FFF6E6', intensity: 0.72, position: [1.2, 250, 38] });
      map.setSky({ 'sky-color': '#FF9E5E', 'horizon-color': '#FFE0A3', 'fog-color': '#FBE7C2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.5 }); } catch (e) {} }
    else { CARTE_NUIT_POSEE = null; couleursCarte(); }
  }
  function hud() { let h = document.getElementById('prom-chasse');
    if (!h) { h = document.createElement('div'); h.id = 'prom-chasse'; document.querySelector('#prom .prom-haut').after(h); }
    return h; }
  function compteARebours() {
    const o = document.createElement('div'); o.className = 'chasse-decompte'; document.body.appendChild(o);
    const pas = () => { if (!CH.dans) return o.remove(); const r = CH.vue.debut - maintenant();
      if (r > 3000) { o.innerHTML = `<small>La chasse commence dans</small><b>${mmss(r)}</b>`; return setTimeout(pas, 250); }
      if (r > 0) { o.innerHTML = `<b class="gros">${Math.ceil(r / 1000)}</b>`; vibrer(10); return setTimeout(pas, r - Math.floor((r - 1) / 1000) * 1000); }
      o.innerHTML = '<b class="gros partez">Partez !</b>'; vibrer(40); setTimeout(() => o.remove(), 900); };
    pas();
  }
  function majDans() {
    const v = CH.vue; if (!v || !PROM.on) return; const t = maintenant(), h = hud();
    const ind = v.indices || [], cercle = [...ind].reverse().find((i) => i.type === 'cercle');
    const tete = v.etat === 'annonce' ? 'Prêt ? La chasse va commencer' : (v.niveau ? `Indice ${v.niveau}/${C.indices.length}` : 'Le trésor est caché dans la commune');
    h.innerHTML = `<div class="l1">🗺️ <b data-pas-traduire>${echapper(v.commune)}</b>${CH.inscrits > 1 ? `<span class="foule">👤 ${nb(CH.inscrits)}</span>` : ''}<span class="temps">⏳ <b class="chrono">${mmss((v.etat === 'annonce' ? v.debut : v.fin) - t)}</b></span></div>`
      + `<div class="l2">${tete}${v.prochainIndice ? ` · prochain dans <b class="chrono2">${mmss(v.prochainIndice - t)}</b>` : ''}</div>`
      + (cercle ? `<div class="l3"><i class="fleche-cercle">➤</i><span class="vers-cercle"></span></div>` : '')
      + (ind.some((i) => i.type !== 'cercle') ? `<div class="indices">${ind.filter((i) => i.type !== 'cercle').map((i) => `<span class="indice">${i.type === 'rue' ? '🏷️ <b data-pas-traduire>' + echapper(i.texte) + '</b>' : i.type === 'numero' ? '🏠 <b data-pas-traduire>' + echapper(i.texte) + '</b>' : (i.texte === 'pair' ? 'Côté pair' : 'Côté impair')}</span>`).join('')}</div>` : '');
    // le cercle doré : posé une fois par indice (la carte doit pouvoir se reposer)
    CH.cercle = cercle || null; versCercle();
    if (cercle && CH.dernierCercle !== cercle.niveau) { CH.dernierCercle = cercle.niveau; dessinerCercle(cercle); survolerCercle(cercle); if (cercle.rayon <= 300) charger(tuilesAutour(cercle, cercle.rayon, 18)); else charger(tuilesAutour(cercle, cercle.rayon, 17)); vibrer(20); toast('🧭 Nouvel indice : le cercle se resserre'); }
    if (!cercle) effacerCercle();
    marqueurDepart(v.depart); autresChasseurs();
    if ((v.etat === 'trouvee' || v.etat === 'finie') && CH.finVue !== v.id) finDeChasse();
    clearInterval(CH.ticDans); CH.ticDans = setInterval(() => { if (!CH.dans || !CH.vue) return clearInterval(CH.ticDans); const c = h.querySelector('.chrono'), c2 = h.querySelector('.chrono2'), tt = maintenant();
      if (c) c.textContent = mmss((CH.vue.etat === 'annonce' ? CH.vue.debut : CH.vue.fin) - tt); if (c2 && CH.vue.prochainIndice) c2.textContent = mmss(CH.vue.prochainIndice - tt); versCercle(); }, 1000);
  }
  // vers le cercle : une flèche (tournée selon la caméra) et la distance ; « tu es dans le cercle » une fois dedans
  function versCercle() { const h = document.getElementById('prom-chasse'), c = CH.cercle; if (!h || !c || !PROM.on) return;
    const f = h.querySelector('.fleche-cercle'), t = h.querySelector('.vers-cercle'); if (!f || !t) return;
    const d = Chasse.distance(PROM, c), dedans = d < c.rayon;
    f.style.transform = `rotate(${norm360(capVers(PROM, c) - PROM.camCap) - 90}deg)`; f.style.visibility = dedans ? 'hidden' : 'visible';
    t.textContent = dedans ? `Tu es dans le cercle doré (${c.rayon} m)` : `Le cercle doré (${c.rayon} m) est à ${nb(Math.round((d - c.rayon) / 10) * 10)} m`; }
  // un nouveau cercle : la caméra prend de la hauteur 3 secondes pour le montrer, puis revient derrière le pion
  function survolerCercle(c) { if (!PROM.on) return; PROM.vueLibre = true;
    map.easeTo({ center: [c.lon, c.lat], zoom: c.rayon >= 500 ? 14.6 : (c.rayon >= 250 ? 15.6 : 16.8), pitch: 35, bearing: PROM.camCap, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 1200 });
    setTimeout(() => { if (!PROM.on) return; PROM.vueLibre = false; PROM.etat = ''; }, 3200); }
  function cerclePoly(c) { const pts = []; for (let k = 0; k <= 64; k++) { const p = Chasse.decale(c, k * 360 / 64, c.rayon); pts.push([p.lon, p.lat]); } return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }] }; }
  function dessinerCercle(c) {
    const d = cerclePoly(c);
    if (map.getSource('chasse-zone')) map.getSource('chasse-zone').setData(d);
    else { map.addSource('chasse-zone', { type: 'geojson', data: d });
      map.addLayer({ id: 'chasse-zone-fond', type: 'fill', source: 'chasse-zone', paint: { 'fill-color': '#FFC233', 'fill-opacity': 0.22 } }, 'bati-ombre');
      // le trait par-dessus les bâtiments (au sol, il disparaissait sous les toits des quartiers denses)
      map.addLayer({ id: 'chasse-zone-trait', type: 'line', source: 'chasse-zone', paint: { 'line-color': '#FFB300', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 3, 18, 7], 'line-dasharray': [2, 1.2], 'line-opacity': 0.95 } }, 'road-label'); }
  }
  function effacerCercle() { for (const id of ['chasse-zone-trait', 'chasse-zone-fond']) if (map.getLayer(id)) map.removeLayer(id); if (map.getSource('chasse-zone')) map.removeSource('chasse-zone'); CH.dernierCercle = 0; }
  function marqueurDepart(pt) { if (CH.depart || !pt) return; const el = document.createElement('div'); el.className = 'chasse-depart'; el.innerHTML = '<i>🏁</i><small>Départ</small>';
    CH.depart = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pt.lon, pt.lat]).addTo(map); }
  // Les autres chasseurs, lisibles même à cent (Gautier, 6 nov.) : le serveur ne donne que les plus proches (400 m, 12 au
  // plus) ; ceux qui se touchent (moins de 15 m) font une seule bulle « ×N » (au départ, toute la foule est devant la mairie) ;
  // les 3 plus proches ont leur icône et leur nom, les autres sont de petits points ; mon pion reste au-dessus.
  function autresChasseurs() {
    const liste = (CH.autres || []).map((a) => Object.assign({}, a, { d: Chasse.distance(PROM, a) })).sort((x, y) => x.d - y.d), groupes = [];
    for (const a of liste) { const g = groupes.find((x) => Chasse.distance(x, a) < 15); if (g) g.n++; else groupes.push({ lon: a.lon, lat: a.lat, n: 1, a, rang: groupes.length }); }
    const vus = new Set();
    for (const g of groupes) {
      const k = g.n > 1 ? 'groupe:' + g.a.pseudo : g.a.pseudo, sorte = g.n > 1 ? 'groupe' : (g.rang < 3 ? 'proche' : 'loin'); vus.add(k);
      let mq = CH.marqueurs[k];
      if (mq && mq.sorte !== sorte) { mq.remove(); mq = null; }
      if (!mq) { const el = document.createElement('div'); el.className = 'pion autre ' + sorte;
        el.innerHTML = sorte === 'groupe' ? '<i class="ombre"></i><i class="corps"><b></b></i>' : (sorte === 'proche' ? `<i class="ombre"></i><i class="corps">${echapper(g.a.avatar || '🙂')}</i><small data-pas-traduire>${echapper(g.a.pseudo)}</small>` : '<i class="point"></i>');
        mq = CH.marqueurs[k] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([g.lon, g.lat]).addTo(map); mq.sorte = sorte; }
      if (sorte === 'groupe') mq.getElement().querySelector('b').textContent = '×' + g.n;
      mq.setLngLat([g.lon, g.lat]).setOffset(Chasse.distance(PROM, g) < 12 ? [38, -6] : [0, 0]);   // (collés à moi : juste à côté de mon pion)
    }
    for (const k of Object.keys(CH.marqueurs)) if (!vus.has(k)) { CH.marqueurs[k].remove(); delete CH.marqueurs[k]; } }
  // ma position, toutes les 2 secondes (si j'ai bougé, ou toutes les 6 s) : le serveur refuse un saut et dit qui gagne
  async function envoyer() {
    if (!CH.dans || !PROM.on || CH.enVol || !CH.vue || CH.vue.etat !== 'en_cours' || maintenant() < CH.vue.debut) return;
    const pos = { lon: PROM.lon, lat: PROM.lat }, n = Date.now();
    if (CH.dernierEnvoi && Chasse.distance(pos, CH.dernierEnvoi.pos) < 1 && n - CH.dernierEnvoi.t < 6000) return;
    CH.enVol = true; let r;
    try { r = await appel('chasse_position', { chasse: CH.vue.id, lon: pos.lon, lat: pos.lat }); } finally { CH.enVol = false; }
    if (!r || !r.ok) return;
    CH.dernierEnvoi = { pos, t: n };
    if (r.refuse && r.position) { PROM.lon = r.position.lon; PROM.lat = r.position.lat; PROM.etat = ''; toast('🚧 Trop loin d’un coup : retour à ta dernière position'); }
    recevoir(r);
    if (r.gagne) victoire(r.gagne);
  }
  function victoire(g) {
    CH.finVue = CH.vue && CH.vue.id; clearInterval(CH.envoi);
    const el = document.createElement('div'); el.className = 'chasse-coffre'; el.innerHTML = '<i>🧰</i>';
    if (CH.coffre) CH.coffre.remove(); CH.coffre = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([PROM.lon, PROM.lat]).addTo(map);
    fete(40); vibrer([30, 40, 30, 40, 80]);
    for (const c of g.cartes || []) { if (!MODE_SERVEUR) state.owned[c.id] = Object.assign({}, c, { niveau: 0, depuis: now() }); state.seen[c.id] = 'libre'; }
    save(); refreshTop(); apresAction();
    const box = document.getElementById('modalbox'); box.innerHTML = `<div class="chasse-fin gagne"><div class="gros">🏆</div><h2>Tu as trouvé le trésor !</h2><p>C’était au <b data-pas-traduire>${echapper(g.tresor || '')}</b>.</p>
      <div class="gain">+${pcs(g.pieces)} <span>et une carte :</span></div><div class="cartes-gagnees"></div><button class="btn large" onclick="CHASSE.quitter()">Super !</button></div>`;
    const z = box.querySelector('.cartes-gagnees'); for (const c of g.cartes || []) { const d = document.createElement('div'); d.className = 'ccarte r' + rarete(c); d.innerHTML = carteArt(c, `<b>${echapper(RARETES[rarete(c)] || '')}</b>`); d.onclick = () => ouvrirFicheLieu(c.id); z.appendChild(d); }
    document.getElementById('modal').classList.add('on');
  }
  function finDeChasse() {
    const v = CH.vue; CH.finVue = v.id; clearInterval(CH.envoi);
    if (v.gagnant && v.gagnant.moi) return;   // (la victoire a sa propre fenêtre)
    vibrer(30);
    const box = document.getElementById('modalbox'); box.innerHTML = `<div class="chasse-fin"><div class="gros">🗺️</div><h2>${v.gagnant ? `<span data-pas-traduire>${echapper(v.gagnant.pseudo)}</span> a trouvé le trésor` : 'Personne n’a trouvé le trésor'}</h2>
      <p>C’était au <b data-pas-traduire>${echapper(v.tresor || '?')}</b>.</p><p class="gris">Une chasse au trésor chaque heure, de 9 h à 23 h.</p><button class="btn large" onclick="CHASSE.quitter()">OK</button></div>`;
    document.getElementById('modal').classList.add('on');
  }
  // quitter la chasse : la fenêtre de fin, ou ✕ (on peut reprendre tant qu'elle dure)
  CH.quitter = () => { closeModal(); if (PROM.on) finPromenade(); else sortie(); };
  window.promQuitter = () => {
    if (!CH.dans || !CH.vue || CH.vue.etat === 'trouvee' || CH.vue.etat === 'finie') return finPromenade();
    const box = document.getElementById('modalbox'); box.innerHTML = `<div class="chasse-fin"><h2>Quitter la chasse ?</h2><p>Tu pourras la reprendre depuis la carte tant qu’elle dure, là où tu t’es arrêté.</p>
      <button class="btn large" onclick="closeModal()">Continuer à chercher</button><button class="btn clair" onclick="CHASSE.quitter()">Quitter</button></div>`;
    document.getElementById('modal').classList.add('on');
  };
  // appelée par finPromenade : tout ce que la chasse a posé sur la carte s'en va
  function sortie() {
    if (!CH.dans) return; CH.dans = false; clearInterval(CH.envoi); clearInterval(CH.ticDans);
    document.body.classList.remove('en-chasse'); const h = document.getElementById('prom-chasse'); if (h) h.remove();
    document.querySelectorAll('.chasse-decompte').forEach((x) => x.remove());
    effacerCercle(); if (CH.depart) { CH.depart.remove(); CH.depart = null; } if (CH.coffre) { CH.coffre.remove(); CH.coffre = null; }
    for (const k of Object.keys(CH.marqueurs)) CH.marqueurs[k].remove(); CH.marqueurs = {};
    ambiance(false); majBandeau(); }
  window.chasseSortie = sortie;
  // la balade, en chasse : on ne bouge pas avant le départ
  window.chasseBloque = () => CH.dans && CH.vue && maintenant() < CH.vue.debut;

  // ---------------------------------------------------------------- une chasse d'essai (Réglages ; serveur d'essai ou démo)
  window.chasseEssai = async () => {
    closeModal(); const c = map.getCenter();
    const r = await appel('chasse_essai', { lon: c.lng, lat: c.lat }); if (!r || !r.ok) { toast((r && r.message) || 'Chasse d’essai impossible'); return; }
    recevoir(r); const j = await appel('chasse_rejoindre'); if (j && j.ok) { CH.inscrit = true; recevoir(j); }
    toast('🗺️ Chasse d’essai : départ dans 20 secondes'); entrer();
  };

  // ---------------------------------------------------------------- la démo : une chasse simulée, avec les mêmes règles
  const D = { c: null, moi: null, rivaux: [] };
  const DEMO = {
    async chasse() { return etatDemo(); },
    async chasse_essai(corps) {
      const depart = { lon: corps.lon, lat: corps.lat }; let cible = null;
      for (let k = 0; k < 8 && !cible; k++) { const p = Chasse.decale(depart, Math.random() * 360, 150 + Math.random() * 200);
        const j = await geoJSON(`reverse?lon=${p.lon.toFixed(6)}&lat=${p.lat.toFixed(6)}&index=address&limit=1`).catch(() => null), f = j && j.features && j.features[0];
        if (f && f.properties.housenumber) cible = { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], numero: String(f.properties.housenumber), rue: f.properties.street, label: f.properties.name, commune: f.properties.city }; }
      if (!cible) throw new Error('Pas d’adresse par ici : approche-toi d’une rue');
      const t = Date.now(); D.c = { id: 'demo-' + t, numero: -1, commune: cible.commune, depart, cible, annonce: t, debut: t + 20000, fin: t + 20000 + C.duree_max_minutes * 60000, gagnant: null, trouve_le: null };
      D.moi = null; const noms = ['Léa', 'Yanis', 'Inès', 'Marco', 'Chloé', 'Sacha', 'Nathan', 'Camille', 'Hugo', 'Manon'], icones = ['🦊', '🐼', '🦉', '🐯', '🐸', '🐨', '🦁', '🐰', '🐻', '🐙'];
      D.rivaux = Array.from({ length: 24 }, (_, i) => ({ pseudo: noms[i % 10] + (i >= 10 ? ' ' + Math.floor(i / 10 + 1) : ''), avatar: icones[i % 10], lon: depart.lon, lat: depart.lat, cap: Math.random() * 360, trouve: i < 3 ? 240000 + Math.random() * 360000 : 1e9 }));   // (une foule, pour voir qu'elle reste lisible)
      return etatDemo();
    },
    async chasse_rejoindre() { if (!D.c) throw new Error('Pas de chasse au trésor en ce moment.'); if (!D.moi) D.moi = { lon: D.c.depart.lon, lat: D.c.depart.lat, le: Date.now() }; return etatDemo(); },
    async chasse_position(corps) {
      if (!D.c || !D.moi) throw new Error('Inscris-toi d’abord à la chasse.');
      const t = Date.now(), e = CHR.etat(D.c, t); let refuse = false, gagne = null;
      if (e === 'en_cours') { const ap = { lon: corps.lon, lat: corps.lat, le: t }, av = Object.assign({}, D.moi, { le: Math.max(D.moi.le, D.c.debut) }), auDepart = D.moi.lon === D.c.depart.lon && D.moi.lat === D.c.depart.lat;
        if (CHR.pasValide(av, ap) || (auDepart && Chasse.distance(av, ap) <= 150)) D.moi = ap; else refuse = true;
        if (!refuse && CHR.arrive(D.moi, D.c.cible)) { D.c.gagnant = 'moi'; D.c.trouve_le = t; encaisser(true); state.wallet += CHR.recompense.pieces;
          const cartes = await TIRAGE.tirerPack((state.pseudo || '?') + ':chasse:' + t, ECO.pack.chances, CHR.recompense.cartes).catch(() => []);
          gagne = { pieces: CHR.recompense.pieces, cartes: cartes.map((c) => Object.assign({}, c, { niveau: 0, depuis: t })), tresor: D.c.cible.label }; } }
      return Object.assign(etatDemo(), { position: { lon: D.moi.lon, lat: D.moi.lat }, refuse, gagne });
    },
  };
  function etatDemo() {
    const t = Date.now(); if (!D.c) return { chasse: null, prochaine: null, maintenant: t };
    // les rivaux se promènent ; l'un d'eux trouve au bout de 4 à 10 minutes
    if (CHR.etat(D.c, t) === 'en_cours') for (const r of D.rivaux) { const p = Chasse.decale(r, r.cap, 9 + Math.random() * 9); r.lon = p.lon; r.lat = p.lat; r.cap += (Math.random() - 0.5) * 60;
      if (!D.c.gagnant && t - D.c.debut > r.trouve) { D.c.gagnant = r.pseudo; D.c.trouve_le = t; } }
    const vue = CHR.vue(D.c, t); if (D.c.gagnant) vue.gagnant = D.c.gagnant === 'moi' ? { moi: true, pseudo: state.pseudo || 'Moi', avatar: state.avatar } : { moi: false, pseudo: D.c.gagnant, avatar: '' };
    return { chasse: vue, inscrits: (D.moi ? 1 : 0) + D.rivaux.length, moi: D.moi ? { lon: D.moi.lon, lat: D.moi.lat } : null, autres: D.rivaux.map((r) => ({ pseudo: r.pseudo, avatar: r.avatar, lon: r.lon, lat: r.lat, d: Chasse.distance(D.moi || D.c.depart, r) })).filter((r) => r.d <= 400).sort((x, y) => x.d - y.d).slice(0, 12), prochaine: null, maintenant: t };
  }

  // ---------------------------------------------------------------- au démarrage, puis chaque minute
  function demarrer() { suivre(); setInterval(suivre, 60000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') suivre(); }); }
  if (MODE_SERVEUR) setTimeout(demarrer, 4000); else setTimeout(() => { majBandeau(); }, 1000);
  CH.suivre = suivre; CH.entrer = entrer;
  CH._demo = D;   // (les outils d’essai : tools/visite_ecrans.js)
})();
