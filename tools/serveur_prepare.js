// Prépare la fonction serveur « jeu » : recopie les règles du jeu (src/regles) et ses données (data/) en modules ES
// dans supabase/functions/jeu/_genere/, pour que le serveur applique EXACTEMENT les mêmes règles que le jeu.
// Lancé par la publication du serveur (.github/workflows/serveur.yml) et par les tests ; les fichiers produits ne sont
// pas gardés dans le dépôt (.gitignore).
//   node tools/serveur_prepare.js [dossier de sortie]
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.resolve(process.argv[2] || path.join(RACINE, 'supabase/functions/jeu/_genere'));
const REGLES = ['regles/lieu.js', 'regles/pack.js', 'regles/encheres.js', 'regles/celebres.js', 'regles/mairie.js', 'regles/classements.js', 'regles/monuments.js', 'tirage.js'];   // chacun pose son objet sur globalThis
const ENTETE = '// Généré par tools/serveur_prepare.js depuis le dépôt : ne pas modifier ici.\n';

// geo.js (contours de la France et des départements) est un script « const GEO = {…}; »
let GEO = null;
function geo() { if (!GEO) { const t = fs.readFileSync(path.join(RACINE, 'geo.js'), 'utf8'); GEO = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } return GEO; }
// les lieux célèbres par département (data/celebres/<dép>.json → { dep, lieux }) : département → lieux
function celebres() { const d = path.join(RACINE, 'data/celebres'), out = {}; for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); out[j.dep || f.replace('.json', '')] = j.lieux || []; } return out; }

function preparer(sortie) {
  fs.mkdirSync(sortie, { recursive: true });
  // les règles : scripts « universels » (navigateur / Node) ; dans un module ES, `module` n'existe pas, donc chacun
  // s'accroche à globalThis (Regles, Pack, Encheres, Celebres), que l'on exporte ensuite
  let regles = ENTETE;
  for (const f of REGLES) regles += `\n// ---- src/${f}\n` + fs.readFileSync(path.join(RACINE, 'src', f), 'utf8') + '\n';
  regles += '\nexport const { Regles, Pack, Encheres, Celebres, Mairie, Classements, Monuments, Tirage } = globalThis;\n';
  fs.writeFileSync(path.join(sortie, 'regles.mjs'), regles);
  const json = (f) => JSON.stringify(JSON.parse(fs.readFileSync(path.join(RACINE, 'data', f), 'utf8')));
  fs.writeFileSync(path.join(sortie, 'donnees.mjs'), ENTETE
    + `export const ECO = ${json('economie.json')};\n`
    + `export const STANDING = ${json('standing.json')};\n`
    + `export const MONUMENTS = ${json('monuments.json')};\n`
    + `export const FRANCE = ${JSON.stringify(geo().france)};\n`
    + `export const DEPARTEMENTS = ${JSON.stringify(Object.keys(geo().deps))};\n`
    + `export const CELEBRES = ${JSON.stringify(celebres())};\n`);
  return sortie;
}

if (require.main === module) console.log('fonction « jeu » préparée :', path.relative(RACINE, preparer(SORTIE)));
module.exports = { preparer };
