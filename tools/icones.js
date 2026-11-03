// Dessine l'icône de Cadastra (plaque de rue + pièce-maison) et l'enregistre à plusieurs tailles dans icones/.
//   node tools/icones.js <racine du jeu>      (prérequis : npm i -g playwright)
const { chromium } = require('playwright');
const path = require('path');
const RACINE = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const [taille, nom, marge] of [[512, 'icone-512.png', 0], [192, 'icone-192.png', 0], [180, 'apple-touch-icon.png', 0], [512, 'icone-masquable-512.png', 1]]) {
    const p = await b.newPage({ viewport: { width: taille, height: taille } });
    const f = (n) => 'data:font/woff2;base64,' + require('fs').readFileSync(path.join(RACINE, 'fonts', n)).toString('base64');
    const k = taille / 512, pad = marge ? 64 * k : 0;
    // la pièce sans son C (le grand C de l'icône suffit)
    const svg = require('fs').readFileSync(path.join(RACINE, 'icones', 'piece.svg'), 'utf8').replace(/<path d='M19\.8[^>]*\/>/g, '');
    const piece = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    await p.setContent(`<html><head><style>
      @font-face{font-family:B;font-weight:800;src:url(${f('baloo-2-latin-800-normal.woff2')})}
      html,body{margin:0;width:${taille}px;height:${taille}px;overflow:hidden;background:${marge ? '#1E4598' : 'transparent'}}
      .fond{position:absolute;inset:${pad}px;border-radius:${marge ? 0 : 112 * k}px;background:radial-gradient(circle at 40% 30%,#3566CC,#1E4598 55%,#0E2457);}
      .cadre{position:absolute;inset:${pad + 26 * k}px;border-radius:${78 * k}px;border:${16 * k}px solid #fff;box-shadow:0 0 0 ${14 * k}px #2E8B57}
      .c{position:absolute;inset:${pad}px;display:flex;align-items:center;justify-content:center;font-family:B;font-weight:800;font-size:${(marge ? 300 : 360) * k}px;color:#fff;line-height:1;padding-bottom:${30 * k}px;text-shadow:0 ${10 * k}px 0 #132F6B}
      .pc{position:absolute;right:${pad + (marge ? 112 : 84) * k}px;bottom:${pad + (marge ? 112 : 84) * k}px;width:${(marge ? 112 : 140) * k}px;height:${(marge ? 112 : 140) * k}px;background:url(${piece}) center/contain no-repeat;filter:drop-shadow(0 ${6 * k}px 0 #8a5a00)}
    </style></head><body><div class="fond"></div><div class="cadre"></div><div class="c">C</div><div class="pc"></div></body></html>`);
    await p.evaluate(async () => { await document.fonts.load('800 100px B'); await document.fonts.ready; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(RACINE, 'icones', nom), omitBackground: !marge });
    await p.close();
  }
  await b.close();
})();
