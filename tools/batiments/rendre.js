// Les bâtiments dessinés du jeu (18 nov. 2026) : batiments.html les monte avec Three.js (verre, arêtes de néon, fenêtres
// allumées), ce script en fait des images. Prérequis : ceux de tools/visite_ecrans.js (playwright, three dans /tmp/ml).
//   une icône transparente : node tools/batiments/rendre.js "?n=2&alpha=1|/tmp/immeuble.png|512|512"   (n : 0 Terrain … 6 Prestige)
//   la rangée, avec le halo :  node tools/batiments/rendre.js "|/tmp/rangee.png|2240|900"
// Les images du jeu (icones/batiments/<id>.png) sont ces icônes, rognées à leur contour et réduites à 420 px.
const { chromium } = require('playwright'); const path=require('path'), fs=require('fs'); const ML='/tmp/ml/node_modules';
(async()=>{ const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}); const sorties=process.argv.slice(2);
  for(const s of sorties){ const [q,f,w,h]=s.split('|'); const p=await b.newPage({viewport:{width:+w,height:+h},deviceScaleFactor:1});
    await p.route('https://unpkg.com/**',(route)=>{ const u=new URL(route.request().url()); const m=u.pathname.match(/^\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/); route.fulfill({body:fs.readFileSync(path.join(ML,m[1],m[2])),contentType:'application/javascript'}); });
    p.on('pageerror',e=>console.log('erreur',e.message)); await p.goto('file://' + __dirname + '/batiments.html' + q); await p.waitForFunction('window.PRET',null,{timeout:60000}); await p.waitForTimeout(400); if(q.includes('alpha')){ const d=await p.evaluate(()=>document.querySelector('canvas').toDataURL('image/png')); fs.writeFileSync(f, Buffer.from(d.split(',')[1],'base64')); } else await p.screenshot({path:f}); await p.close(); console.log('fait',f); }
  await b.close(); })();
