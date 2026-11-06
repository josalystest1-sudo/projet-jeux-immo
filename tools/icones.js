// Dessine les icônes de StreetKeep d'après le logo de Gautier (5 nov. 2026 ; src/logo.js : la plaque « CITY DECK », les
// cartes en éventail, la pièce à la maison) et les enregistre dans icones/ : 512 et 192 (coins arrondis, fond transparent), 180 pour l'iPhone (carré
// plein : l'iPhone arrondit lui-même), 512 « masquable » pour Android (fond plein, dessin réduit dans la zone sûre).
//   node tools/icones.js            (Chrome installé ; sans bibliothèque : le protocole DevTools de Chrome sans fenêtre)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const Logo = require(path.join(RACINE, 'src', 'logo.js'));
const POLICE = 'data:font/woff2;base64,' + fs.readFileSync(path.join(RACINE, 'fonts', 'barlow-condensed-latin-700-normal.woff2')).toString('base64');
const VARIANTES = [
  ['icone-512.png', 512, {}],
  ['icone-192.png', 192, {}],
  ['apple-touch-icon.png', 180, { plein: true }],
  ['icone-masquable-512.png', 512, { plein: true, zone: true }]
];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const PORT = 9300 + Math.floor(Math.random() * 500);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'citydeck-icones-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  try {
    let cible = null;
    for (let k = 0; k < 50 && !cible; k++) { await dormir(300); try { cible = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) {} }
    const ws = new WebSocket(cible.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
    let n = 0; const att = {}; ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && att[d.id]) { att[d.id](d); delete att[d.id]; } });
    const cmd = (method, params) => new Promise((r) => { const id = ++n; att[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    for (const [nom, taille, opts] of VARIANTES) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: taille, height: taille, deviceScaleFactor: 1, mobile: false });
      const html = `<html><head><style>@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(${POLICE})}</style></head><body style="margin:0;background:transparent">${Logo.icone({ ...opts, attrs: `width="${taille}" height="${taille}" style="display:block"` })}</body></html>`;
      await cmd('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }); await dormir(700);
      const s = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: taille, height: taille, scale: 1 } });
      fs.writeFileSync(path.join(RACINE, 'icones', nom), Buffer.from(s.result.data, 'base64')); console.log('icône', nom);
    }
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
