// Visite de tous les écrans du jeu (téléphone 390 × 844 ; autre taille : LARGEUR=360 HAUTEUR=780), avec un joueur fictif bien rempli. Mode local (serveur coupé).
//   node tools/visite_ecrans.js <racine du jeu> <dossier des captures> [écrans séparés par des virgules]
//   puis : python3 tools/planche.py <dossier des captures> <préfixe des planches>   (8 captures par planche)
// Prérequis (une fois) : npm i -g playwright ; npm i --prefix /tmp/ml maplibre-gl@4.7.1 three@0.147.0 @supabase/supabase-js@2.118.0
// (les bibliothèques d'unpkg sont servies depuis /tmp/ml ; les tuiles IGN passent par le proxy : NODE_EXTRA_CA_CERTS=~/.ccr/ca-bundle.crt)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = process.argv[2], SORTIE = process.argv[3], SEULS = (process.argv[4] || '').split(',').filter(Boolean);
const ML = '/tmp/ml/node_modules';
fs.mkdirSync(SORTIE, { recursive: true });

const ETAT = () => { const t = Date.now(), j = Math.floor(t / 60000); return {
  pseudo: 'Marius', avatar: '🦁', wallet: 48250, niveaux6: true, niveaux7: true, lastPack: j, prefs: { offres: true, seuil: true, encheres: true, guideVu: true }, seen: {}, encaisse: t - 30000,
  encheres: { mises: {}, clos: {}, depasse: {} },
  owned: {
    'a-martyrs': { id: 'a-martyrs', label: '67 Rue des Martyrs', lon: 2.33963, lat: 48.88136, citycode: '75109', city: 'Paris', type: 'adresse', niveau: 2, depuis: t },
    'a-trudaine': { id: 'a-trudaine', label: '12 Avenue Trudaine', lon: 2.34385, lat: 48.88213, citycode: '75109', city: 'Paris', type: 'adresse', niveau: 0, depuis: t, enVente: true },
    'wd:Q123149': { id: 'wd:Q123149', qid: 'Q123149', label: 'Église Notre-Dame-du-Travail', lon: 2.31708, lat: 48.83597, citycode: '75114', city: 'Paris', type: 'lieu', notoriete: 'celebre', cat: 'eglise', niveau: 1, depuis: t },
    'a-bordeaux': { id: 'a-bordeaux', label: '8 Rue Sainte-Catherine', lon: -0.5733, lat: 44.8405, citycode: '33063', city: 'Bordeaux', type: 'adresse', niveau: 1, depuis: t },
    'a-dijon': { id: 'a-dijon', label: '3 Rue de la Liberté', lon: 5.0372, lat: 47.3220, citycode: '21231', city: 'Dijon', type: 'adresse', niveau: 0, depuis: t },
    'poi-mairie': { id: 'poi-mairie', label: 'Mairie de Combres', lon: 1.0635, lat: 48.3254, citycode: '28105', city: 'Combres', type: 'lieu', cat: 'mairie', niveau: 0, depuis: t },
    'mon:Q677659': { id: 'mon:Q677659', label: 'Maison carrée', lon: 4.3561, lat: 43.8382, citycode: '30189', city: 'Nîmes', type: 'monument', niveau: 5, depuis: t },
    'a-landes': { id: 'a-landes', label: '1930 Chemin de Rangouse', lon: 0.9, lat: 43.9, citycode: '32427', city: 'Sérignac', type: 'adresse', niveau: 0, depuis: t },
  },
  offersIn: [{ id: 'o1', addrId: 'a-martyrs', from: 'Léa', price: 21000, status: 'attente', ts: t - 120000 }],
  offersOut: [],
  notifs: [
    { ts: t - 60000, type: 'offre', text: 'Léa te propose 21 000 ₳ pour 67 Rue des Martyrs.', read: false, offerId: 'o1', addrId: 'a-martyrs' },
    { ts: t - 300000, type: 'enchere', text: 'Yanis a surenchéri à 43 400 ₳ sur Château de Blois. Tes fonds sont libérés.', read: false },
    { ts: t - 900000, type: 'vente', text: 'Tu as vendu 4 Place du Marché à Inès pour 3 200 ₳.', read: true },
  ],
}; };

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const navigateur = await chromium.launch({ proxy, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const contexte = await navigateur.newContext({ locale: process.env.LANGUE || 'fr-FR', viewport: { width: +(process.env.LARGEUR || 390), height: +(process.env.HAUTEUR || 844) }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, hasTouch: true });
  const page = await contexte.newPage();
  await page.route('https://unpkg.com/**', (route) => { const u = new URL(route.request().url()); const m = u.pathname.match(/^\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/); const f = path.join(ML, m[1], m[2]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
  await page.route('http://jeu.local/**', (route) => { const u = new URL(route.request().url());
    if (u.pathname === '/data/serveur.json') return route.fulfill({ body: '{"url":"","cle_publique":""}', contentType: 'application/json' });
    const f = path.join(RACINE, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    const ext = path.extname(f); const types = { '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }; route.fulfill({ body: fs.readFileSync(f), contentType: types[ext] || 'application/javascript' }); });
  page.on('pageerror', (e) => { if (!/localStorage/.test(e.message)) console.log('erreur page :', e.message); });
  await page.addInitScript((etat) => { try { if (!sessionStorage.getItem('fait')) { localStorage.setItem('proto-cadastre-v3', JSON.stringify(etat)); sessionStorage.setItem('fait', '1'); } } catch (e) {} }, ETAT());
  await page.goto('http://jeu.local/?demo'); // la démo (joueurs simulés) : tout le monde joue sinon sur le vrai serveur
  await page.waitForTimeout(150);
  if (!SEULS.length || SEULS.includes('00-accueil')) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SORTIE, '00-accueil.png') }); console.log('capture 00-accueil'); }
  await page.waitForTimeout(3800);
  const fermer = () => page.evaluate(() => { try { closeModal(); } catch (e) {} try { closeSheet(); } catch (e) {} });
  const shot = async (nom) => { if (SEULS.length && !SEULS.includes(nom)) return; await page.waitForTimeout(700); await page.screenshot({ path: path.join(SORTIE, nom + '.png') }); console.log('capture', nom); };
  const ecran = async (nom, fn) => { if (SEULS.length && !SEULS.includes(nom)) return; try { await fn(); await shot(nom); } catch (e) { console.log('échec', nom, e.message.split('\n')[0]); } };

  await ecran('01-recolte', async () => { await page.evaluate(() => { state.encaisse = Date.now() - 30000; recolteConnexion(() => {}); }); });
  await fermer();
  await ecran('02-carte', async () => { await page.evaluate(() => { showScreen('carte'); map.jumpTo({ center: [2.3405, 48.8817], zoom: 17.3, pitch: 58, bearing: -17 }); }); await page.waitForTimeout(5000); });
  await ecran('03-fiche', async () => { await page.evaluate(() => { const pt = map.project([2.33963, 48.88136]); const f = map.queryRenderedFeatures(pt, { layers: ['parcel-fill'] })[0]; if (f) selectParcel(f); }); await page.waitForTimeout(4000); });
  await ecran('03b-fiche-bas', async () => { await page.evaluate(() => { const s = document.getElementById('sheet'); s.scrollTop = s.scrollHeight; const d = document.querySelector('#sheet .defile'); if (d) d.scrollTop = d.scrollHeight; }); });
  await fermer();
  await ecran('04-patrimoine', async () => { await page.evaluate(() => showScreen('patrimoine')); });
  await ecran('04b-patrimoine-bas', async () => { await page.evaluate(() => { const s = document.getElementById('s-patrimoine'); s.scrollTop = 700; }); });
  await ecran('05-encheres', async () => { await page.evaluate(() => { showScreen('encheres'); }); });
  await ecran('06-communes', async () => { await page.evaluate(() => showScreen('communes')); });
  await ecran('06b-communes-recherche', async () => { await page.evaluate(() => showScreen('communes')); await page.fill('#com-q', 'bagn'); await page.waitForSelector('.sugg-commune', { timeout: 15000 }); });
  await ecran('06c-commune-ouverte', async () => { await page.evaluate(() => showScreen('communes')); await page.fill('#com-q', 'paris 9'); await page.waitForSelector('.sugg-commune', { timeout: 15000 }); await page.click('.sugg-commune'); });
  await ecran('07-notifs', async () => { await page.evaluate(() => showScreen('notifs')); });
  await ecran('08-profil', async () => { await page.evaluate(() => { showScreen('carte'); showPlayer(ME); }); });
  await fermer();
  await ecran('09-joueur', async () => { await page.evaluate(() => showPlayer('Léa')); });
  await fermer();
  await ecran('10-creation', async () => { await page.evaluate(() => { const p = state.pseudo; state.pseudo = ''; creationProfil(); state.pseudo = p; }); });
  await fermer();
  await ecran('13-guide', async () => { await page.evaluate(() => guide(0)); await page.waitForTimeout(600); });
  await ecran('13b-guide', async () => { await page.evaluate(() => guide(2)); await page.waitForTimeout(600); });
  await page.evaluate(() => { const g = document.getElementById('guide'); if (g) g.remove(); });
  await ecran('14-reglages', async () => { await page.evaluate(() => ouvrirReglages()); });
  await fermer();
  await ecran('15-detail', async () => { await page.evaluate(() => { showScreen('patrimoine'); ouvrirFicheLieu('a-martyrs'); }); });
  await fermer();
  await ecran('23-legendaire', async () => { await page.evaluate(() => { showScreen('patrimoine'); ouvrirFicheLieu('wd:Q123149'); }); });
  await fermer();
  await ecran('24-extraordinaire', async () => { await page.evaluate(() => { showScreen('patrimoine'); ouvrirFicheLieu('mon:Q677659'); }); });
  await fermer();
  await ecran('25-collection', async () => { await page.evaluate(() => { showScreen('patrimoine'); const s = document.getElementById('s-patrimoine'); s.scrollTop = 560; }); });
  await ecran('21-vente', async () => { await page.evaluate(() => { showScreen('patrimoine'); ouvrirFicheLieu('a-martyrs'); mettreEnVente('a-martyrs'); const i = document.getElementById('prix-vente'); i.value = '24 500'; i.dispatchEvent(new Event('input')); }); });
  await fermer();
  await page.evaluate(() => showScreen('carte'));
  await ecran('16-autre', async () => { await page.evaluate(() => { let id = ''; for (let k = 0; k < 500; k++) { if (fakeOwner('essai-' + k) && !(hash('essai-' + k + 'v') % 100 < 25)) { id = 'essai-' + k; break; } }
      const a = { id, label: '14 Rue Lepic', lon: 2.3336, lat: 48.8853, citycode: '75118', city: 'Paris', type: 'adresse' };
      const box = document.getElementById('modalbox'); box.innerHTML = ''; box.appendChild(addrRow(a, true)); document.getElementById('modal').classList.add('on'); window.__autre = a; }); });
  await ecran('22-echange', async () => { await page.evaluate(() => { proposerEchange(window.__autre); const b = document.querySelectorAll('.ech-lieu')[1]; if (b) b.click(); }); });
  await fermer();
  await ecran('17-recherche', async () => { await page.evaluate(() => showScreen('carte')); await page.fill('#q', 'rue lepic'); await page.waitForTimeout(2500); });
  await page.evaluate(() => { document.getElementById('sugg').style.display = 'none'; document.getElementById('q').value = ''; document.getElementById('q').blur(); });
  await ecran('18-tri', async () => { await page.evaluate(() => { showScreen('patrimoine'); changerTri(); }); await page.evaluate(() => { document.getElementById('s-patrimoine').scrollTop = 480; }); });
  await page.evaluate(() => showScreen('carte'));
  await ecran('20-fete', async () => { await page.evaluate(() => { showScreen('patrimoine'); ouvrirFicheLieu('wd:Q123149'); state.wallet = 999999; const a = state.owned['wd:Q123149']; construire(a.id, 2, coutNiveau(a, 2)); }); await page.waitForTimeout(250); });
  await fermer();
  await page.evaluate(() => showScreen('carte'));
  await ecran('11-pack', async () => { await page.evaluate(() => { state.lastPack = -1; ouvrirPack(); }); await page.waitForFunction(() => packCards && packCards.length, null, { timeout: 60000 }); await page.waitForTimeout(1500); });
  await ecran('12-cartes', async () => { await page.evaluate(() => { try { dechirer && dechirer(); } catch (e) {} }); await page.waitForTimeout(2500); });
  await ecran('12b-carte-retournee', async () => { await page.evaluate(() => { const c = [...document.querySelectorAll('#pkcards .c3d')]; const el = c[0]; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); setTimeout(() => document.getElementById('reveal').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), 300); setTimeout(() => document.getElementById('reveal').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), 600); }); await page.waitForFunction(() => !document.getElementById('reveal').classList.contains('on'), null, { timeout: 30000 }); await page.waitForTimeout(900); });
  await navigateur.close();
})();
