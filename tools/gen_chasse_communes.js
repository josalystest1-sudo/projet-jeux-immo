// Les communes où peut avoir lieu une chasse au trésor (GDD § 5 quinquies) : au moins 2 000 habitants, avec le point de
// leur mairie (le départ de tous les joueurs). Source : l'API Découpage administratif (geo.api.gouv.fr, données ouvertes).
//   node tools/gen_chasse_communes.js      → data/chasse_communes.json : [[code, nom, lon, lat, population, département], …]
const fs = require('fs'); const path = require('path');
const MIN = 2000, SORTIE = path.join(__dirname, '..', 'data', 'chasse_communes.json');
(async () => {
  const r = await fetch('https://geo.api.gouv.fr/communes?fields=nom,code,population,mairie,centre,codeDepartement&format=json', { headers: { 'User-Agent': 'CityDeck (github.com/josalystest1-sudo/projet-jeux-immo)' } });
  if (!r.ok) throw new Error('geo.api.gouv.fr : HTTP ' + r.status);
  const liste = (await r.json()).filter((c) => (c.population || 0) >= MIN && (c.mairie || c.centre) && !String(c.codeDepartement).startsWith('97'))   // la métropole et la Corse (comme les packs)
    .map((c) => { const p = (c.mairie || c.centre).coordinates; return [c.code, c.nom, +p[0].toFixed(5), +p[1].toFixed(5), c.population, c.codeDepartement]; })
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  fs.writeFileSync(SORTIE, '[\n' + liste.map((x) => JSON.stringify(x)).join(',\n') + '\n]\n');
  console.log(liste.length, 'communes →', path.relative(process.cwd(), SORTIE));
})().catch((e) => { console.error(e.message); process.exit(1); });
