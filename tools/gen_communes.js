// Les contours simplifiés des communes, un fichier par département (data/communes/<département>.json), pour la roulette des
// villes de la révélation d'une carte (Gautier, 16 nov. 2026 : « voir le département fragmenté avec les villes »).
//   node tools/gen_communes.js            (tous les départements ; DEPS=37,75 pour quelques-uns)
// Source : ADMIN EXPRESS de l'IGN (WFS de la Géoplateforme). Paris, Lyon et Marseille sont découpés en arrondissements
// (le lieu d'une carte y porte le code de son arrondissement). Chaque fichier : [[code, nom, [anneaux de [lon, lat]]], …],
// simplifié à 200 m au plus (plus fin pour une petite commune : un arrondissement de Paris) et arrondi au millième de degré : c'est un dessin de 240 px de large, pas une carte.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const DOSSIER = path.join(__dirname, '..', 'data', 'communes');
const TOUS = [...Array(95).keys()].map((i) => String(i + 1).padStart(2, '0')).filter((d) => d !== '20').concat(['2A', '2B', '971', '972', '973', '974', '976']);
const DEPS = process.env.DEPS ? process.env.DEPS.split(',') : TOUS;
const VILLES = { 75: ['75056', '751'], 69: ['69123', '6938'], 13: ['13055', '132'] };   // la commune retirée, le début du code de ses arrondissements
function lire(type, filtre) { const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ADMINEXPRESS-COG-CARTO.LATEST:${type}&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=2000&CQL_FILTER=${encodeURIComponent(filtre)}`;
  for (let k = 0; k < 4; k++) { try { return JSON.parse(execFileSync('curl', ['-sS', '-m', '120', '-A', 'StreetKeep (github.com/josalystest1-sudo/projet-jeux-immo)', url], { maxBuffer: 1 << 28 })).features; } catch (e) { if (k === 3) throw e; } } }
function simplifier(pts, eps) { if (pts.length < 4) return pts; const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const d2 = (p, a, b) => { const l = sq(a, b); if (!l) return sq(p, a); let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l; t = Math.max(0, Math.min(1, t)); return sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); };
  const garde = new Uint8Array(pts.length); garde[0] = garde[pts.length - 1] = 1; const pile = [[0, pts.length - 1]];
  while (pile.length) { const [i, j] = pile.pop(); let m = 0, k = -1; for (let x = i + 1; x < j; x++) { const d = d2(pts[x], pts[i], pts[j]); if (d > m) { m = d; k = x; } } if (k >= 0 && m > eps * eps) { garde[k] = 1; pile.push([i, k], [k, j]); } }
  return pts.filter((_, i) => garde[i]); }
const aire = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(s) / 2; };
function communes(feats) { const out = [];
  for (const f of feats) { const g = f.geometry; if (!g) continue; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let anneaux = polys.map((pg) => pg[0].map(([a, b]) => (Math.abs(a) > 40 && Math.abs(b) < 40 && Math.abs(a) > Math.abs(b) && a > 0 && a < 52 && b < 10 ? [b, a] : [a, b])));   // (métropole : lat, lon → lon, lat si besoin)
    const grand = Math.max(...anneaux.map(aire)); anneaux = anneaux.filter((r) => aire(r) >= grand * 0.15).map((r) => { let s = simplifier(r, Math.min(0.002, Math.max(0.0007, Math.sqrt(aire(r)) * 0.06))); if (s.length < 4) s = simplifier(r, 0.0003); return s.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]); }).filter((r) => r.length >= 4);
    if (anneaux.length) out.push([f.properties.code_insee, f.properties.nom_officiel || f.properties.nom || '', anneaux]); }
  return out.sort((a, b) => a[0].localeCompare(b[0])); }
fs.mkdirSync(DOSSIER, { recursive: true }); let total = 0;
for (const d of DEPS) { let feats = lire('commune', `code_insee_du_departement='${d}'`);
  if (VILLES[d]) { feats = feats.filter((f) => f.properties.code_insee !== VILLES[d][0]).concat(lire('arrondissement_municipal', `code_insee LIKE '${VILLES[d][1]}%'`)); }
  const c = communes(feats); const texte = JSON.stringify(c); fs.writeFileSync(path.join(DOSSIER, d + '.json'), texte); total += texte.length; console.log(d, c.length, Math.round(texte.length / 1024) + ' Ko'); }
console.log('total', Math.round(total / 1024) + ' Ko');
