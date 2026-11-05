// L'image de partage de citydeck.fr (1200 × 630, balises Open Graph de index.html) : ce qui s'affiche quand on partage un
// lien vers le jeu (messages, réseaux, publicités). Le logo de Gautier (src/logo.js) sur le fond perle des menus.
//   node tools/image_partage.js      (Chrome installé ; sans bibliothèque : le protocole DevTools) → icones/partage.jpg (JPEG léger : WhatsApp boude les aperçus de plus de 300 Ko)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const Logo = require(path.join(RACINE, 'src', 'logo.js'));
const police = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(RACINE, 'fonts', f)).toString('base64');
// un quadrillage de rues, très pâle, comme un plan de ville
let rues = ''; for (let k = 0; k < 26; k++) { const x = -200 + k * 70 + (k % 3) * 9; rues += `<path d="M${x} -40 L${x + 260} 680" /><path d="M-40 ${k * 34 - 60} L1240 ${k * 34 + 60}" />`; }
const HTML = `<html><head><style>
  @font-face{font-family:'Barlow Condensed';font-weight:700;src:url(${police('barlow-condensed-latin-700-normal.woff2')})}
  @font-face{font-family:'Nunito';font-weight:900;src:url(${police('nunito-latin-900-normal.woff2')})}
  @font-face{font-family:'Nunito';font-weight:800;src:url(${police('nunito-latin-800-normal.woff2')})}
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(70% 90% at 50% 38%,#FFFFFF 0%,#F3F5F9 55%,#DCE5F3 100%);font-family:'Nunito',sans-serif;color:#1F2633;position:relative}
  .rues{position:absolute;inset:0;width:1200px;height:630px}
  .rues path{stroke:#2453B3;stroke-opacity:.05;stroke-width:3;fill:none}
  .logo{position:absolute;left:50%;top:38px;width:640px;margin-left:-320px;filter:drop-shadow(0 18px 30px rgba(20,30,60,.22))}
  .logo svg{width:100%;height:auto;display:block}
  .t{position:absolute;left:0;right:0;top:452px;text-align:center;font-weight:900;font-size:52px;letter-spacing:-.01em}
  .t b{color:#2453B3}
  .s{position:absolute;left:0;right:0;top:530px;text-align:center;font-weight:800;font-size:27px;color:#5A6378}
</style></head><body><svg class="rues" viewBox="0 0 1200 630">${rues}</svg>
  <div class="logo">${Logo.svg()}</div>
  <div class="t">Collectionne les lieux <b>réels</b> de France</div>
  <div class="s">Ta rue · l’église du village · les monuments · deviens Maire de ta commune</div>
</body></html>`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const PORT = 9300 + Math.floor(Math.random() * 500);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'citydeck-partage-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  try {
    let cible = null;
    for (let k = 0; k < 50 && !cible; k++) { await dormir(300); try { cible = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) {} }
    const ws = new WebSocket(cible.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
    let n = 0; const att = {}; ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && att[d.id]) { att[d.id](d); delete att[d.id]; } });
    const cmd = (method, params) => new Promise((r) => { const id = ++n; att[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
    const f = path.join(profil, 'partage.html'); fs.writeFileSync(f, HTML);
    await cmd('Page.navigate', { url: 'file:///' + f.split(path.sep).join('/') }); await dormir(1200);
    const s = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
    fs.writeFileSync(path.join(RACINE, 'icones', 'partage.jpg'), Buffer.from(s.result.data, 'base64')); console.log('image de partage : icones/partage.jpg');
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
