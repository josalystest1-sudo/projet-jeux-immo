// Prépare la fonction serveur « jeu » : recopie les règles du jeu (src/regles) et ses données (data/) en modules ES
// dans supabase/functions/jeu/_genere/, pour que le serveur applique EXACTEMENT les mêmes règles que le jeu.
// Lancé par la publication du serveur (.github/workflows/serveur.yml) et par les tests ; les fichiers produits ne sont
// pas gardés dans le dépôt (.gitignore).
//   node tools/serveur_prepare.js [dossier de sortie]
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.resolve(process.argv[2] || path.join(RACINE, 'supabase/functions/jeu/_genere'));
const REGLES = ['lieu.js', 'pack.js', 'encheres.js', 'celebres.js'];   // chacune pose son objet sur globalThis
const ENTETE = '// Généré par tools/serveur_prepare.js depuis le dépôt : ne pas modifier ici.\n';

function preparer(sortie) {
  fs.mkdirSync(sortie, { recursive: true });
  // les règles : scripts « universels » (navigateur / Node) ; dans un module ES, `module` n'existe pas, donc chacun
  // s'accroche à globalThis (Regles, Pack, Encheres, Celebres), que l'on exporte ensuite
  let regles = ENTETE;
  for (const f of REGLES) regles += `\n// ---- src/regles/${f}\n` + fs.readFileSync(path.join(RACINE, 'src/regles', f), 'utf8') + '\n';
  regles += '\nexport const { Regles, Pack, Encheres, Celebres } = globalThis;\n';
  fs.writeFileSync(path.join(sortie, 'regles.mjs'), regles);
  const json = (f) => JSON.stringify(JSON.parse(fs.readFileSync(path.join(RACINE, 'data', f), 'utf8')));
  fs.writeFileSync(path.join(sortie, 'donnees.mjs'), ENTETE
    + `export const ECO = ${json('economie.json')};\n`
    + `export const STANDING = ${json('standing.json')};\n`
    + `export const MONUMENTS = ${json('monuments.json')};\n`);
  return sortie;
}

if (require.main === module) console.log('fonction « jeu » préparée :', path.relative(RACINE, preparer(SORTIE)));
module.exports = { preparer };
