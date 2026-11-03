// Essai du vrai serveur, lancé par la publication (.github/workflows/serveur.yml) juste après la mise en ligne :
// un joueur d'essai jetable est créé, joue quelques actions par la fonction « jeu », puis est supprimé.
// Il vérifie aussi que le jeu ne peut pas écrire directement dans les tables (tout passe par la fonction).
// Besoin : SUPABASE_ACCESS_TOKEN (secret GitHub) et le projet ; n'affiche jamais une clé.
//   node tools/serveur_essai.js <référence du projet>
const crypto = require('crypto');
const REF = process.argv[2] || 'hxtyecwofajiozmnfyxt';
const JETON = process.env.SUPABASE_ACCESS_TOKEN;
const URL = `https://${REF}.supabase.co`;
const ECO = require('../data/economie.json');

let echecs = 0;
function verifier(ok, texte, detail) { console.log(`${ok ? '✓' : '✗'} ${texte}${!ok && detail !== undefined ? ' : ' + JSON.stringify(detail).slice(0, 300) : ''}`); if (!ok) echecs++; }
async function requete(url, options) { const r = await fetch(url, options); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) { j = t; } return { statut: r.status, corps: j }; }

async function cles() {
  const r = await requete(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${JETON}` } });
  if (r.statut !== 200 || !Array.isArray(r.corps)) throw new Error('clés du projet illisibles (HTTP ' + r.statut + ')');
  const de = (pred) => (r.corps.find(pred) || {}).api_key;
  const publique = de((k) => k.type === 'publishable') || de((k) => k.name === 'anon');
  const secrete = de((k) => k.type === 'secret') || de((k) => k.name === 'service_role');
  if (!publique || !secrete) throw new Error('clés publique ou secrète introuvables');
  return { publique, secrete };
}
const entetesSecrets = (k) => (k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: `Bearer ${k}` });

(async () => {
  if (!JETON) { console.log('SUPABASE_ACCESS_TOKEN absent : essai sauté.'); return; }
  const { publique, secrete } = await cles();
  const mail = `essai-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`, mdp = crypto.randomBytes(18).toString('base64url');
  const cree = await requete(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: { ...entetesSecrets(secrete), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: mdp, email_confirm: true }) });
  if (!cree.corps || !cree.corps.id) throw new Error('joueur d’essai non créé (HTTP ' + cree.statut + ')');
  const id = cree.corps.id;
  try {
    const cnx = await requete(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: mdp }) });
    const acces = cnx.corps && cnx.corps.access_token; verifier(!!acces, 'le joueur d’essai se connecte', cnx.statut);
    const jeu = (corps, jeton = acces) => requete(`${URL}/functions/v1/jeu`, { method: 'POST', headers: { apikey: publique, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), 'Content-Type': 'application/json', Origin: 'https://josalystest1-sudo.github.io' }, body: JSON.stringify(corps) });

    const anonyme = await jeu({ action: 'etat' }, publique.startsWith('sb_') ? null : publique);
    verifier(anonyme.corps && anonyme.corps.ok === false && anonyme.corps.code === 'non_connecte', 'sans compte : refusé', anonyme);
    const etat = await jeu({ action: 'etat' });
    verifier(etat.corps && etat.corps.ok && etat.corps.pieces === ECO.solde_depart && Array.isArray(etat.corps.lieux) && etat.corps.lieux.length === 0, `nouveau joueur : ${ECO.solde_depart} pièces, aucun lieu`, etat);
    const rec = await jeu({ action: 'recolter' });
    verifier(rec.corps && rec.corps.ok && rec.corps.pieces >= ECO.solde_depart, 'récolter répond', rec);
    const cons = await jeu({ action: 'construire', id: 'pas-a-moi', niveau: 1 });
    verifier(cons.corps && cons.corps.ok === false && cons.corps.code === 'pas_a_toi', 'construire sur un lieu qui n’est pas à moi : refusé', cons);
    const inconnu = await jeu({ action: 'tricher' });
    verifier(inconnu.corps && inconnu.corps.ok === false && inconnu.corps.code === 'action', 'action inconnue : refusée', inconnu);

    // les tables : lecture oui (mes pièces, les lieux de tous), écriture directe jamais
    const lire = await requete(`${URL}/rest/v1/joueurs?select=pieces`, { headers: { apikey: publique, Authorization: `Bearer ${acces}` } });
    verifier(lire.statut === 200 && Array.isArray(lire.corps) && lire.corps.length === 1, 'je lis mes pièces (et seulement les miennes)', lire);
    const tricher = await requete(`${URL}/rest/v1/joueurs?id=eq.${id}`, { method: 'PATCH', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ pieces: 999999999 }) });
    verifier(tricher.statut >= 400 || (Array.isArray(tricher.corps) && tricher.corps.length === 0), 'me donner des pièces directement : refusé', tricher.statut);
    const voler = await requete(`${URL}/rest/v1/lieux`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'essai', proprietaire: id, type: 'adresse', label: 'x', lon: 0, lat: 0 }) });
    verifier(voler.statut >= 400, 'me donner un lieu directement : refusé', voler.statut);
    const rpc = await requete(`${URL}/rest/v1/rpc/jeu_recolter`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ j: id, montant: 1000000, avant: new Date().toISOString(), maintenant: new Date().toISOString() }) });
    verifier(rpc.statut >= 400, 'appeler une fonction du serveur directement : refusé', rpc.statut);
    const tous = await requete(`${URL}/rest/v1/lieux?select=id&limit=1`, { headers: { apikey: publique } });
    verifier(tous.statut === 200, 'les lieux de tous sont lisibles (la carte)', tous.statut);
  } finally {
    const sup = await requete(`${URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: entetesSecrets(secrete) });
    verifier(sup.statut < 300, 'joueur d’essai supprimé', sup.statut);
  }
  if (echecs) { console.log(`${echecs} vérification(s) en échec`); process.exit(1); }
  console.log('Le serveur répond comme prévu.');
})().catch((e) => { console.log('✗ essai impossible :', e.message); process.exit(1); });
