// Les adresses du jeu côté connexion (Supabase Auth) : les liens des e-mails (confirmation, mot de passe oublié) ne
// ramènent qu'aux adresses autorisées. Ajoute celles du jeu à la liste du projet, sans retirer celles qui y sont déjà, et
// pose l'adresse principale (« Site URL ») si on la donne. Lancé par la publication du serveur ; n'affiche aucun secret.
//   node tools/serveur_adresses.js <référence du projet> [adresse principale]
// (5 nov. 2026 : Gautier a acheté citydeck.fr ; le jeu reste aussi joignable à son ancienne adresse GitHub Pages.)
const REF = process.argv[2] || 'hxtyecwofajiozmnfyxt';
const PRINCIPALE = process.argv[3] || '';
const JETON = process.env.SUPABASE_ACCESS_TOKEN;
const ADRESSES = ['https://citydeck.fr/**', 'https://www.citydeck.fr/**', 'https://josalystest1-sudo.github.io/projet-jeux-immo/**'];

(async () => {
  if (!JETON) { console.log('SUPABASE_ACCESS_TOKEN absent : adresses sautées.'); return; }
  const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`, H = { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' };
  const lu = await fetch(url, { headers: H });
  if (!lu.ok) { console.log(`::warning::réglages de connexion illisibles (HTTP ${lu.status}) : adresses non vérifiées`); return; }
  const conf = await lu.json();
  const avant = String(conf.uri_allow_list || '').split(',').map((x) => x.trim()).filter(Boolean);
  const liste = [...new Set([...avant, ...ADRESSES])];
  const changer = {};
  if (liste.length !== avant.length) changer.uri_allow_list = liste.join(',');
  if (PRINCIPALE && conf.site_url !== PRINCIPALE) changer.site_url = PRINCIPALE;
  if (!Object.keys(changer).length) { console.log('adresses de connexion déjà à jour :', liste.join(' ; '), '| principale :', conf.site_url); return; }
  const ecrit = await fetch(url, { method: 'PATCH', headers: H, body: JSON.stringify(changer) });
  if (!ecrit.ok) { console.log(`::warning::réglages de connexion non modifiés (HTTP ${ecrit.status})`); return; }
  console.log('adresses de connexion :', liste.join(' ; '), '| principale :', changer.site_url || conf.site_url);
})().catch((e) => { console.log('::warning::adresses de connexion :', e.message); });
