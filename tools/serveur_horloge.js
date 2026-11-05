// L'horloge du serveur, lancée toutes les 10 minutes par .github/workflows/horloge.yml (5 nov. 2026) : elle appelle la
// fonction « jeu » avec { action: 'horloge' }, pour que les enchères se closent, que les mandats de Maire et les saisons
// tournent, que les monuments soient tenus et que les robots jouent, même quand aucun joueur n'appelle le serveur.
// Le jeton est « horloge:<heure> » signé (HMAC) avec la clé secrète du projet : la clé elle-même ne voyage pas et n'est
// jamais affichée. Besoin : SUPABASE_ACCESS_TOKEN (secret GitHub), pour lire les clés du projet.
//   node tools/serveur_horloge.js [référence du projet]
const crypto = require('crypto');
const REF = process.argv[2] || 'hxtyecwofajiozmnfyxt';
const JETON = process.env.SUPABASE_ACCESS_TOKEN;
const URL = `https://${REF}.supabase.co`;

async function requete(url, options) { const r = await fetch(url, options); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) { j = t; } return { statut: r.status, corps: j }; }

(async () => {
  if (!JETON) { console.log('SUPABASE_ACCESS_TOKEN absent : horloge sautée.'); return; }
  const r = await requete(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${JETON}` } });
  if (r.statut !== 200 || !Array.isArray(r.corps)) throw new Error('clés du projet illisibles (HTTP ' + r.statut + ')');
  const publique = (r.corps.find((k) => k.type === 'publishable') || r.corps.find((k) => k.name === 'anon') || {}).api_key;
  // les clés secrètes connues de la fonction : la nouvelle (« secret »), puis l'ancienne (« service_role »)
  const secretes = [...r.corps.filter((k) => k.type === 'secret'), ...r.corps.filter((k) => k.name === 'service_role')].map((k) => k.api_key).filter(Boolean);
  if (!publique || !secretes.length) throw new Error('clés publique ou secrète introuvables');
  const heure = Math.floor(Date.now() / 3_600_000);
  for (const cle of secretes) {
    const signe = crypto.createHmac('sha256', cle).update('horloge:' + heure).digest('hex');
    const rep = await requete(`${URL}/functions/v1/jeu`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${signe}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'horloge' }) });
    if (rep.corps && rep.corps.ok) { console.log(`horloge : ${rep.corps.fait.join(', ')} (${rep.corps.ms} ms)`); return; }
    if (!(rep.corps && rep.corps.code === 'non_connecte')) throw new Error('horloge refusée : ' + JSON.stringify(rep.corps).slice(0, 300));
  }
  throw new Error('horloge refusée : aucune clé secrète reconnue par la fonction');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
