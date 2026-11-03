// Essai de la promenade en Street View dans un téléphone simulé (390 × 844), Google simulé : la recherche de photo
// répond une photo de Google au point demandé (une photo tous les 8 m environ), l'intégration affiche son cap.
//   node tools/essai_promenade.js <racine du jeu> <dossier des captures>
//   FICHE=1 : partir de la fiche d'une parcelle (« Se promener ») au lieu du bouton 🚶 de la carte
//   SANSCLE=1 : sans clé Google (on marche sur le tracé IGN des rues)
// Prérequis : ceux de tools/visite_ecrans.js (playwright ; maplibre-gl, three, supabase-js dans /tmp/ml ; tuiles IGN réelles).
// Le journal donne l'état après le départ, après trois pas et après un glisser (position, cap, lieux longés).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = process.argv[2], SORTIE = process.argv[3];
const ML = '/tmp/ml/node_modules';
fs.mkdirSync(SORTIE, { recursive: true });
const ETAT = () => { const t = Date.now(), j = Math.floor(t / 60000); return {
  pseudo: 'Marius', avatar: '🦁', wallet: 48250, niveaux6: true, niveaux7: true, lastPack: j, prefs: { offres: true, seuil: true, encheres: true, guideVu: true }, seen: {}, encaisse: t - 30000,
  encheres: { mises: {}, clos: {}, depasse: {} },
  owned: { 'a-martyrs': { id: 'a-martyrs', label: '67 Rue des Martyrs', lon: 2.33963, lat: 48.88136, citycode: '75109', city: 'Paris', type: 'adresse', niveau: 2, depuis: t } },
  offersIn: [], offersOut: [], notifs: [] }; };
let appelsPhoto = 0;
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const navigateur = await chromium.launch({ proxy, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, hasTouch: true });
  const page = await contexte.newPage();
  await page.route('https://unpkg.com/**', (route) => { const u = new URL(route.request().url()); const m = u.pathname.match(/^\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/); const f = path.join(ML, m[1], m[2]); route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' }); });
  await page.route('https://maps.googleapis.com/**', (route) => { appelsPhoto++; const u = new URL(route.request().url()); const [la, lo] = u.searchParams.get('location').split(',').map(Number);
    const gl = Math.round(la / 0.00008), go = Math.round(lo / 0.00011);   // une photo tous les 8 m environ, au point demandé (dans la rue)
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'OK', pano_id: 'p' + gl + '_' + go, location: { lat: la, lng: lo }, copyright: '© 2026 Google' }) }); });
  await page.route('https://www.google.com/maps/embed/**', (route) => { const u = new URL(route.request().url()); const h = +(u.searchParams.get('heading') || 0);
    route.fulfill({ contentType: 'text/html', body: `<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;font:700 20px sans-serif;color:#fff;background:linear-gradient(hsl(${h},60%,55%),hsl(${h},50%,25%))"><div>Street View simulé</div><div>cap ${h}°</div><div style="font-size:12px">${(u.searchParams.get('pano') || u.searchParams.get('location') || '').slice(0, 30)}</div></body>` }); });
  await page.route('http://jeu.local/**', (route) => { const u = new URL(route.request().url());
    if (u.pathname === '/data/google.json' && process.env.SANSCLE) return route.fulfill({ body: '{}', contentType: 'application/json' });
    if (u.pathname === '/data/serveur.json') return route.fulfill({ body: '{"url":"","cle_publique":""}', contentType: 'application/json' });
    const f = path.join(RACINE, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    const ext = path.extname(f); const types = { '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }; route.fulfill({ body: fs.readFileSync(f), contentType: types[ext] || 'application/javascript' }); });
  page.on('pageerror', (e) => console.log('erreur page :', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) console.log('console :', m.text().slice(0, 200)); });
  await page.addInitScript((etat) => { try { if (!sessionStorage.getItem('fait')) { localStorage.setItem('proto-cadastre-v3', JSON.stringify(etat)); sessionStorage.setItem('fait', '1'); } } catch (e) {} }, ETAT());
  await page.goto('http://jeu.local/');
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { closeModal(); } catch (e) {} map.jumpTo({ center: [2.33963, 48.8812], zoom: 17.8, pitch: 58, bearing: 0 }); });
  await page.waitForTimeout(6000);
  const shot = async (nom) => { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SORTIE, nom + '.png') }); console.log('capture', nom); };
  await shot('p0-carte');
  if (process.env.FICHE) { await page.evaluate(() => { const pt = map.project([2.33963, 48.88136]); const f = map.queryRenderedFeatures(pt, { layers: ['parcel-fill'] })[0]; if (f) selectParcel(f); }); await page.waitForTimeout(5000); await shot('f0-fiche'); await page.click('.prom-entree'); }
  else await page.click('#bprom');
  await page.waitForTimeout(3000);
  console.log('état', JSON.stringify(await page.evaluate(() => ({ on: PROM.on, lat: PROM.lat, lon: PROM.lon, cap: PROM.cap, pano: PROM.pano, liste: PROM.liste.map(e => e.cote + ':' + e.f.id), rue: nomDeRue(PROM) }))));
  await shot('p1-depart');
  for (let i = 0; i < 3; i++) { await page.click('#prom-av'); await page.waitForTimeout(1600); }
  console.log('état', JSON.stringify(await page.evaluate(() => ({ lat: PROM.lat, lon: PROM.lon, cap: PROM.cap, liste: PROM.liste.map(e => e.cote + ':' + e.f.id), carte: document.getElementById('prom-lieux').innerText }))));
  await shot('p2-trois-pas');
  // glisser sur la photo vers la gauche : la vue tourne vers la droite
  const b = await page.locator('#prom-touche').boundingBox();
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(1800);
  console.log('après glisser', JSON.stringify(await page.evaluate(() => ({ cap: PROM.cap, liste: PROM.liste.map(e => e.cote + ':' + e.f.id), carte: document.getElementById('prom-lieux').innerText }))));
  await shot('p3-tourne');
  const n = await page.locator('.prom-lieu').count();
  if (n) { await page.locator('.prom-lieu').first().click(); await page.waitForTimeout(3500); await shot('p4-fiche'); await page.evaluate(() => closeSheet()); await page.waitForTimeout(600); }
  await page.click('.prom-quitter');
  await page.waitForTimeout(1200);
  console.log('fin', JSON.stringify(await page.evaluate(() => ({ on: PROM.on, vus: PROM.vus.size, classe: document.body.className, iframes: [...document.querySelectorAll('.prom-sv')].map(f => f.src) }))));
  await shot('p5-fin');
  console.log('appels à la recherche de photo :', appelsPhoto);
  await navigateur.close();
})();
