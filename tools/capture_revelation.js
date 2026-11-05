// Captures de la révélation d'une carte au format téléphone (375 × 812, ×2), pour montrer une preuve à Gautier quand il
// est sur son téléphone : Chrome sans fenêtre, piloté par le protocole DevTools (aucune bibliothèque à installer).
//   node tools/capture_revelation.js http://localhost:8000/ prefixe [dossier]
// La page est servie en local en mode démo (sans adresse de serveur Supabase). Par défaut, l'abbaye de Beaulieu-lès-Loches
// (Légendaire : explosion, puis la France, le département, la commune, le lieu). Variables facultatives : CARTE (le code
// qui pose window.__carte) et IMAGES (une liste JSON de [millisecondes, nom]). La capture prend elle-même du temps : les
// instants sont approximatifs ; pour figer une animation, mettre en pause document.getAnimations().
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const URL_PAGE = process.argv[2], PREFIXE = process.argv[3], DOSSIER = path.resolve(process.argv[4] || '.'), PORT = 9333 + Math.floor(Math.random() * 300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(require('os').tmpdir(), 'cadastra-chrome-essai')}`, '--no-first-run', '--window-size=375,812', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let cible = null;
  for (let k = 0; k < 50 && !cible; k++) { await dormir(300); try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); cible = l.find((t) => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(cible.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let n = 0; const attente = {}; ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && attente[d.id]) { attente[d.id](d); delete attente[d.id]; } });
  const cmd = (method, params) => new Promise((r) => { const id = ++n; attente[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await cmd('Page.enable');
  // le jeu prend la langue du navigateur : en français pour les captures, sauf LANGUE=en
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!localStorage.getItem('citydeck-langue')) localStorage.setItem('citydeck-langue', '${process.env.LANGUE || 'fr'}'); sessionStorage.setItem('cadastra-demo', '1'); }catch(e){}` });
  await cmd('Page.navigate', { url: URL_PAGE }); await dormir(7000);
  const lancer = `(async()=>{ try{closeModal()}catch(e){}; ${process.env.CARTE || "const l = await chargerCelebres('37'); window.__carte = Object.assign(Celebres.lieuDe(l.find(e=>/Beaulieu-lès-Loches/.test(e[1]))), {city:'Beaulieu-lès-Loches'});"} await fetchCommune(window.__carte);
    const sc=document.getElementById('packscene'); sc.classList.add('on','show'); document.getElementById('pkgl').style.display='none'; document.getElementById('pkhint').textContent=''; revealSequence(window.__carte); return 'ok'; })()`;
  const r = await cmd('Runtime.evaluate', { expression: lancer, awaitPromise: true }); console.log('lancé', JSON.stringify(r.result && r.result.result));
  const t0 = Date.now();
  for (const [t, nom] of JSON.parse(process.env.IMAGES || '[[3000,"1-france"],[4800,"2-departement"],[6500,"3-commune"],[8900,"4-lieu"]]')) {
    await dormir(Math.max(0, t - (Date.now() - t0)));
    const s = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(DOSSIER, `${PREFIXE}-${nom}.png`), Buffer.from(s.result.data, 'base64'));
  }
  ws.close(); chrome.kill(); console.log('fini');
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
