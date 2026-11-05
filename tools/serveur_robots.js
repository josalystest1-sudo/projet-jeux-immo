// Les joueurs robots du serveur d'essai (demande de Gautier, 3 nov. 2026) : de vrais comptes, créés s'ils manquent,
// que la fonction « jeu » fait jouer (robotsTour). Lancé par la publication du serveur ; n'affiche jamais une clé.
//   node tools/serveur_robots.js <référence du projet>
// Ils restent au lancement et se retirent d'eux-mêmes quand les vrais joueurs arrivent (GDD § 5 quater, 5 nov.).
const crypto = require('crypto');
const REF = process.argv[2] || 'hxtyecwofajiozmnfyxt';
const JETON = process.env.SUPABASE_ACCESS_TOKEN;
const URL = `https://${REF}.supabase.co`;
const ECO = require('../data/economie.json');
const DEPART_ROBOT = ECO.robots.depart_pieces;   // comme un vrai joueur (GDD § 5 quater : des joueurs ordinaires)
// des prénoms inventés, avec l'icône 🤖 ; autant que de robots au plus (ECO.robots.max) : le jeu en fait jouer moins quand les vrais joueurs arrivent
const ROBOTS = ['Léa', 'Marco', 'Inès', 'Yanis', 'Chloé', 'Sacha', 'Nathan', 'Camille', 'Hugo', 'Manon'].slice(0, ECO.robots.max);

async function requete(url, options) { const r = await fetch(url, options); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) { j = t; } return { statut: r.status, corps: j }; }
async function cles() {
  const r = await requete(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${JETON}` } });
  if (r.statut !== 200 || !Array.isArray(r.corps)) throw new Error('clés du projet illisibles (HTTP ' + r.statut + ')');
  const secrete = (r.corps.find((k) => k.type === 'secret') || r.corps.find((k) => k.name === 'service_role') || {}).api_key;
  if (!secrete) throw new Error('clé secrète introuvable');
  return secrete;
}

(async () => {
  if (!JETON) { console.log('SUPABASE_ACCESS_TOKEN absent : robots sautés.'); return; }
  const secrete = await cles();
  const H = secrete.startsWith('sb_') ? { apikey: secrete } : { apikey: secrete, Authorization: `Bearer ${secrete}` };
  const json = { ...H, 'Content-Type': 'application/json' };
  const robots = await requete(`${URL}/rest/v1/robots?select=id,nom`, { headers: H });
  if (robots.statut !== 200) throw new Error('table robots illisible (HTTP ' + robots.statut + ')');
  for (const nom of ROBOTS) {
    if (robots.corps.some((r) => r.nom === nom)) { console.log(`🤖 ${nom} : déjà là`); continue; }
    const pris = await requete(`${URL}/rest/v1/profils?select=id&pseudo=eq.${encodeURIComponent(nom)}`, { headers: H });
    if (Array.isArray(pris.corps) && pris.corps.length) { console.log(`🤖 ${nom} : pseudo pris par un vrai joueur, sauté`); continue; }
    const mail = `robot-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const cree = await requete(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: json, body: JSON.stringify({ email: mail, password: crypto.randomBytes(24).toString('base64url'), email_confirm: true, user_metadata: { robot: true } }) });
    const id = cree.corps && cree.corps.id; if (!id) throw new Error(`${nom} : compte non créé (HTTP ${cree.statut})`);
    const profil = await requete(`${URL}/rest/v1/profils`, { method: 'POST', headers: json, body: JSON.stringify({ id, pseudo: nom, avatar: '🤖' }) });
    if (profil.statut >= 300) { await requete(`${URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: H }); throw new Error(`${nom} : profil refusé (HTTP ${profil.statut}) ; compte retiré`); }
    const joueur = await requete(`${URL}/rest/v1/rpc/jeu_nouveau_joueur`, { method: 'POST', headers: json, body: JSON.stringify({ j: id, depart: DEPART_ROBOT }) });
    if (joueur.statut >= 300) throw new Error(`${nom} : partie refusée (HTTP ${joueur.statut})`);
    const robot = await requete(`${URL}/rest/v1/robots`, { method: 'POST', headers: json, body: JSON.stringify({ id, nom }) });
    if (robot.statut >= 300) throw new Error(`${nom} : marque de robot refusée (HTTP ${robot.statut})`);
    console.log(`🤖 ${nom} : créé`);
  }
})().catch((e) => { console.log('✗ robots :', e.message); process.exit(1); });
