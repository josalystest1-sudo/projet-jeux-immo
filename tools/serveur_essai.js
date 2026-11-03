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
const R = require('../src/regles/lieu.js').creer(ECO, require('../data/standing.json'));

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
// un joueur jetable de plus : connecté, avec son appel à la fonction « jeu » et sa suppression
async function nouveauJoueur(publique, secrete) {
  const mail = `essai-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`, mdp = crypto.randomBytes(18).toString('base64url');
  const cree = await requete(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: { ...entetesSecrets(secrete), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: mdp, email_confirm: true }) });
  if (!cree.corps || !cree.corps.id) throw new Error('joueur d’essai non créé (HTTP ' + cree.statut + ')');
  const cnx = await requete(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: mdp }) });
  const acces = cnx.corps && cnx.corps.access_token;
  return { id: cree.corps.id, jeu: (corps) => requete(`${URL}/functions/v1/jeu`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
    supprimer: async () => { const sup = await requete(`${URL}/auth/v1/admin/users/${cree.corps.id}`, { method: 'DELETE', headers: entetesSecrets(secrete) }); verifier(sup.statut < 300, 'deuxième joueur d’essai supprimé', sup.statut); } };
}

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
    // le pack du jour : tiré par le serveur, une fois par jour ; puis construire sur la carte la moins chère
    const pack = await jeu({ action: 'pack' });
    const cartes = (pack.corps && pack.corps.cartes) || [];
    verifier(pack.corps && pack.corps.ok && cartes.length >= 1 && cartes.every((c) => R.rarete(c) <= 5), `pack du jour : ${cartes.length} carte(s) (raretés ${cartes.map((c) => R.rarete(c)).join(', ')})`, pack);
    const encore = await jeu({ action: 'pack' });
    verifier(encore.corps && encore.corps.ok === false && encore.corps.code === 'deja', 'un deuxième pack le même jour : refusé', encore);
    const apres = await jeu({ action: 'etat' });
    verifier(apres.corps && apres.corps.ok && apres.corps.lieux.length === cartes.length, 'les lieux du pack sont à moi', apres);
    if (cartes.length) {
      const c = cartes.slice().sort((a, b) => R.coutNiveau(a, 1) - R.coutNiveau(b, 1))[0], cout = R.coutNiveau(c, 1), avant = apres.corps.pieces;
      const cons1 = await jeu({ action: 'construire', id: c.id, niveau: 1 });
      if (cout <= avant) verifier(cons1.corps && cons1.corps.ok && cons1.corps.cout === cout && cons1.corps.pieces <= avant - cout + 5, `construire une Maison sur ${c.label} (${cout} pièces)`, cons1);
      else verifier(cons1.corps && cons1.corps.ok === false && cons1.corps.code === 'fonds', `construire sans assez de pièces (${cout} pour ${avant}) : refusé`, cons1);
      const saut = await jeu({ action: 'construire', id: c.id, niveau: 3 });
      verifier(saut.corps && saut.corps.ok === false, 'sauter un niveau : refusé', saut);
    }
    // le marché, avec un deuxième joueur jetable : vente, achat, offres refusée, acceptée, trop chère, annulée
    if (cartes.length >= 3) {
      const B = await nouveauJoueur(publique, secrete);
      try {
        const [L, M, N] = cartes;
        const vente = await jeu({ action: 'vendre', id: L.id, prix: '100' });
        verifier(vente.corps && vente.corps.ok && vente.corps.etat.lieux.find((x) => x.id === L.id).prixVente === 100, 'mettre en vente à 100', vente);
        const mauvais = await B.jeu({ action: 'acheter', id: L.id, prix: 90 });
        verifier(mauvais.corps && mauvais.corps.ok === false && mauvais.corps.code === 'prix_change', 'acheter à un autre prix que celui affiché : refusé', mauvais);
        const achat = await B.jeu({ action: 'acheter', id: L.id, prix: 100 });
        verifier(achat.corps && achat.corps.ok && achat.corps.etat.lieux.some((x) => x.id === L.id) && achat.corps.pieces <= ECO.solde_depart - 100 + 5, 'un autre joueur l’achète : il est à lui, il a payé', achat);
        const apresVente = await jeu({ action: 'etat' });
        verifier(apresVente.corps.ok && !apresVente.corps.lieux.some((x) => x.id === L.id) && apresVente.corps.notifs.some((n) => n.type === 'vente'), 'le vendeur ne l’a plus et en est prévenu', apresVente.corps.notifs);
        const pasAMoi = await jeu({ action: 'vendre', id: L.id, prix: 5 });
        verifier(pasAMoi.corps && pasAMoi.corps.ok === false && pasAMoi.corps.code === 'pas_a_toi', 'vendre un lieu qui n’est plus à moi : refusé', pasAMoi);
        const o1 = await B.jeu({ action: 'offrir', id: M.id, prix: 50 });
        verifier(o1.corps && o1.corps.ok && o1.corps.offre, 'faire une offre de 50', o1);
        const recue = await jeu({ action: 'etat' }); const enAttente = recue.corps.offresRecues.find((o) => o.id === o1.corps.offre);
        verifier(enAttente && enAttente.status === 'attente' && recue.corps.notifs.some((n) => n.offerId === o1.corps.offre), 'le propriétaire reçoit l’offre (et une notification)', recue.corps.offresRecues);
        const refus = await jeu({ action: 'repondre_offre', offre: o1.corps.offre, accepter: false });
        verifier(refus.corps && refus.corps.ok && refus.corps.accepte === false, 'refuser l’offre', refus);
        const o2 = await B.jeu({ action: 'offrir', id: M.id, prix: 60 });
        const accord = await jeu({ action: 'repondre_offre', offre: o2.corps.offre, accepter: true });
        verifier(accord.corps && accord.corps.ok && accord.corps.accepte && !accord.corps.etat.lieux.some((x) => x.id === M.id), 'accepter une nouvelle offre de 60 : le lieu part', accord);
        const etatB = await B.jeu({ action: 'etat' });
        verifier(etatB.corps.lieux.some((x) => x.id === M.id) && etatB.corps.offresEnvoyees.some((o) => o.id === o1.corps.offre && o.status === 'refusee'), 'l’acheteur a le lieu ; sa première offre est refusée', etatB.corps.offresEnvoyees);
        const tropCher = await B.jeu({ action: 'offrir', id: N.id, prix: 1000000000 });
        verifier(tropCher.corps && tropCher.corps.ok === false && tropCher.corps.code === 'fonds', 'une offre plus chère que ses pièces : refusée', tropCher);
        const o3 = await B.jeu({ action: 'offrir', id: N.id, prix: 20 }), annul = await B.jeu({ action: 'annuler_offre', offre: o3.corps.offre });
        verifier(annul.corps && annul.corps.ok && annul.corps.etat.offresEnvoyees.some((o) => o.id === o3.corps.offre && o.status === 'annulee'), 'annuler son offre', annul);
        const relire = await jeu({ action: 'notifs_lues' });
        verifier(relire.corps && relire.corps.ok && relire.corps.etat.notifs.every((n) => n.read), 'marquer les notifications lues', relire.corps.etat && relire.corps.etat.notifs);
      } finally { await B.supprimer(); }
    }
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
    // les communes : mon classement et mes mairies (lecture seule, par tous)
    const communes = [...new Set(cartes.map((c) => require('../src/regles/lieu.js').nomCommune(c.citycode, c.city)))];
    const maires = await requete(`${URL}/rest/v1/rpc/maires`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ communes }) });
    verifier(maires.statut === 200 && Array.isArray(maires.corps) && communes.every((c) => maires.corps.some((m) => m.commune === c)), 'chaque commune de mon pack a un Maire', maires);
    const classement = await requete(`${URL}/rest/v1/rpc/classement_commune`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ c: communes[0] || 'x' }) });
    verifier(classement.statut === 200 && Array.isArray(classement.corps), 'le classement d’une commune est lisible', classement.statut);
  } finally {
    const sup = await requete(`${URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: entetesSecrets(secrete) });
    verifier(sup.statut < 300, 'joueur d’essai supprimé', sup.statut);
  }
  if (echecs) { console.log(`${echecs} vérification(s) en échec`); process.exit(1); }
  console.log('Le serveur répond comme prévu.');
})().catch((e) => { console.log('✗ essai impossible :', e.message); process.exit(1); });
