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
// ce qu'un joueur peut encaisser entre deux appels (serveur d'essai : un jour du jeu = une minute) : un jour de revenus
const MARGE = 600;
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
    // (serveur d'essai accéléré : un jour = une minute ; si le jour vient de changer, le deuxième pack est permis)
    const encore = await jeu({ action: 'pack' });
    const nouveauJour = encore.corps && encore.corps.ok && encore.corps.dernierJour > pack.corps.dernierJour;
    verifier(encore.corps && ((encore.corps.ok === false && encore.corps.code === 'deja') || nouveauJour), nouveauJour ? 'deuxième pack : un nouveau jour du jeu a commencé, permis' : 'un deuxième pack le même jour : refusé', encore);
    const cartes2 = nouveauJour ? encore.corps.cartes : [];
    const apres = await jeu({ action: 'etat' });
    verifier(apres.corps && apres.corps.ok && apres.corps.lieux.length === cartes.length + cartes2.length && apres.corps.jourMs >= 1000, `les lieux du pack sont à moi (un jour du jeu = ${apres.corps && apres.corps.jourMs / 1000} s)`, apres);
    if (cartes.length) {
      const c = cartes.slice().sort((a, b) => R.coutNiveau(a, 1) - R.coutNiveau(b, 1))[0], cout = R.coutNiveau(c, 1), avant = apres.corps.pieces;
      const cons1 = await jeu({ action: 'construire', id: c.id, niveau: 1 });
      if (cout <= avant) verifier(cons1.corps && cons1.corps.ok && cons1.corps.cout === cout && cons1.corps.pieces <= avant - cout + MARGE, `construire une Maison sur ${c.label} (${cout} pièces)`, cons1);
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
        verifier(achat.corps && achat.corps.ok && achat.corps.etat.lieux.some((x) => x.id === L.id) && achat.corps.pieces <= ECO.solde_depart - 100 + MARGE, 'un autre joueur l’achète : il est à lui, il a payé', achat);
        const apresVente = await jeu({ action: 'etat' });
        verifier(apresVente.corps.ok && !apresVente.corps.lieux.some((x) => x.id === L.id) && apresVente.corps.notifs.some((n) => n.type === 'vente'), 'le vendeur ne l’a plus et en est prévenu', apresVente.corps.notifs);
        // la vente est notée : le marché de la commune la voit (la valeur qui bouge)
        const comL = require('../src/regles/lieu.js').nomCommune(L.citycode, L.city);
        const marche = await requete(`${URL}/rest/v1/rpc/marche_communes`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ communes: [comL], depuis: new Date(Date.now() - 3600e3).toISOString() }) });
        verifier(marche.statut === 200 && Array.isArray(marche.corps) && marche.corps.some((m) => m.commune === comL && m.n >= 1 && m.ratio > 0), `la vente compte dans le marché de ${comL}`, marche);
        const quart = await requete(`${URL}/rest/v1/rpc/quartiers`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ pts: [{ id: 'x', lon: L.lon, lat: L.lat }], dlat: 0.003, dlon: 0.004 }) });
        verifier(quart.statut === 200 && Array.isArray(quart.corps) && quart.corps[0] && quart.corps[0].points >= 1, 'l’activité du quartier compte les lieux autour', quart);
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
        // les échanges (8.1f) : mon lieu N (+ 10 pièces) contre L, qui est maintenant à B
        const ech1 = await jeu({ action: 'echanger', id: L.id, donnes: [N.id], ajout: 10 });
        verifier(ech1.corps && ech1.corps.ok && ech1.corps.echange && ech1.corps.etat.echangesEnvoyes.some((x) => x.id === ech1.corps.echange && x.status === 'attente'), 'proposer un échange : mon lieu et 10 pièces contre le sien', ech1);
        const ech2 = await jeu({ action: 'echanger', id: M.id, donnes: [N.id] });
        verifier(ech2.corps && ech2.corps.ok === false && ech2.corps.code === 'deja_propose', 'proposer le même lieu dans un deuxième échange : refusé', ech2);
        const ech3 = await jeu({ action: 'echanger', id: M.id, donnes: [L.id] });
        verifier(ech3.corps && ech3.corps.ok === false && ech3.corps.code === 'pas_a_toi', 'donner un lieu qui n’est pas à moi : refusé', ech3);
        const recuB = await B.jeu({ action: 'etat' }), xB = recuB.corps && recuB.corps.echangesRecus && recuB.corps.echangesRecus.find((x) => x.id === ech1.corps.echange);
        verifier(xB && xB.status === 'attente' && xB.ajout === 10 && xB.lieux.some((l) => l.id === N.id) && recuB.corps.notifs.some((n) => n.echangeId === ech1.corps.echange), 'l’autre joueur reçoit l’échange (mon lieu, les pièces, une notification)', recuB.corps);
        const refusE = await B.jeu({ action: 'repondre_echange', echange: ech1.corps.echange, accepter: false });
        verifier(refusE.corps && refusE.corps.ok && refusE.corps.accepte === false, 'il refuse l’échange', refusE);
        const ech4 = await jeu({ action: 'echanger', id: L.id, donnes: [N.id], ajout: 10 });
        const annE = await jeu({ action: 'annuler_echange', echange: ech4.corps && ech4.corps.echange });
        verifier(annE.corps && annE.corps.ok && annE.corps.etat.echangesEnvoyes.some((x) => x.id === ech4.corps.echange && x.status === 'annulee'), 'annuler sa proposition d’échange', annE);
        const ech5 = await jeu({ action: 'echanger', id: L.id, donnes: [N.id], ajout: 10 });
        const avantE = ech5.corps && ech5.corps.etat ? ech5.corps.etat.pieces : 0;
        const accE = await B.jeu({ action: 'repondre_echange', echange: ech5.corps && ech5.corps.echange, accepter: true });
        verifier(accE.corps && accE.corps.ok && accE.corps.accepte && accE.corps.etat.lieux.some((l) => l.id === N.id) && !accE.corps.etat.lieux.some((l) => l.id === L.id), 'il accepte : mon lieu est à lui, le sien part', accE);
        const etatE = await jeu({ action: 'etat' });
        verifier(etatE.corps.ok && etatE.corps.lieux.some((l) => l.id === L.id) && !etatE.corps.lieux.some((l) => l.id === N.id) && etatE.corps.notifs.some((n) => n.type === 'echange' && /accepté/.test(n.text)), 'son lieu est à moi, et j’en suis prévenu', etatE.corps.notifs);
        verifier(etatE.corps.pieces <= avantE - 10 + MARGE, 'les 10 pièces sont passées', { avant: avantE, apres: etatE.corps.pieces });
        const deuxFois = await B.jeu({ action: 'repondre_echange', echange: ech5.corps && ech5.corps.echange, accepter: true });
        verifier(deuxFois.corps && deuxFois.corps.ok === false && deuxFois.corps.code === 'echange', 'accepter deux fois : refusé', deuxFois);
        // les enchères (8.1g) : la semaine en cours, puis un lot d'essai de 25 s (posé avec la clé du serveur, semaine -1 :
        // invisible des joueurs) pour miser, surenchérir et clore, avec passage à la mise suivante
        const sem = await jeu({ action: 'encheres' });
        verifier(sem.corps && sem.corps.ok && Array.isArray(sem.corps.lots) && sem.corps.fin > Date.now() && Array.isArray(sem.corps.suivantes), `les enchères de la semaine : ${sem.corps && sem.corps.lots ? sem.corps.lots.length : '?'} lot(s)`, sem);
        const cleEssai = 'essai-' + crypto.randomBytes(4).toString('hex'), monEssai = 'mon:' + cleEssai;
        const parCle = (chemin, methode, corps) => requete(`${URL}/rest/v1/${chemin}`, { method: methode, headers: { ...entetesSecrets(secrete), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: corps ? JSON.stringify(corps) : undefined });
        try {
          await parCle(`joueurs?id=in.(${id},${B.id})`, 'PATCH', { pieces: 20000 });
          const finEssai = Date.now() + 25000;
          const creeLot = await parCle('encheres', 'POST', { cle: cleEssai, semaine: -1, rang: 0, palier: 'regional', monument: cleEssai, depart: 1000, fin: new Date(finEssai).toISOString(),
            lieu: { id: monEssai, label: 'Monument d’essai', lon: 2.3522, lat: 48.8566, citycode: '75104', city: 'Paris 4e', commune: 'Paris 4e', qid: null } });
          verifier(creeLot.statut < 300, 'un lot d’essai de 25 secondes', creeLot);
          const bas = await jeu({ action: 'miser', cle: cleEssai, montant: 999 });
          verifier(bas.corps && bas.corps.ok === false && bas.corps.code === 'min', 'miser sous la mise de départ : refusé', bas);
          const m1 = await jeu({ action: 'miser', cle: cleEssai, montant: 1000 });
          verifier(m1.corps && m1.corps.ok && m1.corps.etat.encheresMenees[cleEssai] === 1000, 'miser le départ : je mène, 1 000 pièces bloquées', m1);
          const m2 = await B.jeu({ action: 'miser', cle: cleEssai, montant: 1049 });
          verifier(m2.corps && m2.corps.ok === false && m2.corps.code === 'min', 'surenchérir de moins de 5 % : refusé', m2);
          const m3 = await B.jeu({ action: 'miser', cle: cleEssai, montant: 1050 });
          verifier(m3.corps && m3.corps.ok && m3.corps.etat.encheresMenees[cleEssai] === 1050, 'un autre joueur surenchérit de 5 %', m3);
          const dep = await jeu({ action: 'etat' });
          verifier(dep.corps.ok && dep.corps.encheresDepasse.includes(cleEssai) && !dep.corps.encheresMenees[cleEssai] && dep.corps.notifs.some((n) => n.type === 'enchere' && /surenchéri/.test(n.text)), 'je suis dépassé, mes pièces sont libérées, j’en suis prévenu', dep.corps);
          const m4 = await jeu({ action: 'miser', cle: cleEssai, montant: 2000 });
          verifier(m4.corps && m4.corps.ok, 'je remise 2 000 : je mène', m4);
          // je n'ai plus les pièces : à la clôture, le monument doit passer à la mise suivante (celle de l'autre joueur)
          await parCle(`joueurs?id=eq.${id}`, 'PATCH', { pieces: 100 });
          await new Promise((ok) => setTimeout(ok, Math.max(0, finEssai - Date.now()) + 2000));
          const tard = await B.jeu({ action: 'miser', cle: cleEssai, montant: 5000 });
          verifier(tard.corps && tard.corps.ok === false && tard.corps.code === 'close', 'miser après la fin : refusé', tard);
          await B.jeu({ action: 'encheres' });
          const finB = await B.jeu({ action: 'etat' });
          verifier(finB.corps.ok && finB.corps.lieux.some((l) => l.id === monEssai && l.type === 'monument') && finB.corps.notifs.some((n) => /remporté/.test(n.text)) && finB.corps.pieces <= 20000 - 1050 + 2 * MARGE, 'clôture : je n’ai plus les pièces, le monument passe à l’autre joueur pour 1 050 ; il est prévenu', finB.corps);
          const finA = await jeu({ action: 'etat' });
          verifier(finA.corps.ok && !finA.corps.lieux.some((l) => l.id === monEssai) && finA.corps.pieces <= 100 + MARGE && finA.corps.notifs.some((n) => /Tu menais/.test(n.text)), 'je ne paie rien, et je suis prévenu que l’enchère est passée à la suivante', finA.corps.notifs);
        } finally { await parCle(`encheres?cle=eq.${cleEssai}`, 'DELETE'); }
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
    const echVol = await requete(`${URL}/rest/v1/echanges`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lieu: 'essai', proposeur: id, destinataire: id, donnes: ['essai'] }) });
    verifier(echVol.statut >= 400, 'écrire un échange directement : refusé', echVol.statut);
    const miseVol = await requete(`${URL}/rest/v1/mises`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lot: 'essai', joueur: id, montant: 1 }) });
    verifier(miseVol.statut >= 400, 'écrire une mise directement : refusé', miseVol.statut);
    const rpc = await requete(`${URL}/rest/v1/rpc/jeu_recolter`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ j: id, montant: 1000000, avant: new Date().toISOString(), maintenant: new Date().toISOString() }) });
    verifier(rpc.statut >= 400, 'appeler une fonction du serveur directement : refusé', rpc.statut);
    const tous = await requete(`${URL}/rest/v1/lieux?select=id&limit=1`, { headers: { apikey: publique } });
    verifier(tous.statut === 200, 'les lieux de tous sont lisibles (la carte)', tous.statut);
    // les communes : la caisse de travaux du Maire (GDD § 5) : verser, refus, lecture par tous, jamais d'écriture directe
    const mesLieux = ((await jeu({ action: 'etat' })).corps.lieux || []);
    const communes = [...new Set(mesLieux.map((c) => require('../src/regles/lieu.js').nomCommune(c.citycode, c.city)))];
    if (communes.length) {
      const v1 = await jeu({ action: 'verser', commune: communes[0], montant: 10 });
      verifier(v1.corps && v1.corps.ok && v1.corps.montant === 10 && Number.isInteger(v1.corps.mandat), `verser 10 pièces à la caisse de ${communes[0]}`, v1);
      const lu = await requete(`${URL}/rest/v1/rpc/caisse_communes`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ communes: [communes[0]], m: v1.corps.mandat, absent_avant: new Date(Date.now() - 86400000).toISOString() }) });
      verifier(lu.statut === 200 && Array.isArray(lu.corps) && lu.corps.some((r) => r.joueur === id && Number(r.mandat) === v1.corps.mandat && Number(r.points) >= 5), 'la caisse se lit par tous, avec mon versement', lu);
      const bas = await jeu({ action: 'verser', commune: communes[0], montant: 5 });
      verifier(bas.corps && bas.corps.ok === false && bas.corps.code === 'minimum', 'verser moins de 10 pièces : refusé', bas);
      const ailleurs = await jeu({ action: 'verser', commune: 'Commune sans mes lieux', montant: 10 });
      verifier(ailleurs.corps && ailleurs.corps.ok === false && ailleurs.corps.code === 'sans_lieu', 'verser dans une commune sans lieu à moi : refusé', ailleurs);
      const caisseVol = await requete(`${URL}/rest/v1/caisses`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mandat: v1.corps.mandat, commune: communes[0], joueur: id, points: 999999 }) });
      verifier(caisseVol.statut >= 400, 'écrire dans une caisse directement : refusé', caisseVol.statut);
    }
    // les classements et les saisons (GDD § 5 bis) : la rareté de mes lieux posée, les classements lisibles par tous
    const ECO_ = require('../data/economie.json'), poids = [1, 2, 3, 4, 5, 6].map((r) => ECO_.classements.poids_rarete[r]), bonus = ECO_.classements.bonus_niveau;
    const rares = await requete(`${URL}/rest/v1/lieux?select=id,rarete&proprietaire=eq.${id}`, { headers: { apikey: publique } });
    verifier(rares.statut === 200 && rares.corps.length > 0 && rares.corps.every((l) => l.rarete >= 1 && l.rarete <= 6), 'la rareté de mes lieux est posée par le serveur', rares);
    const cp = await requete(`${URL}/rest/v1/rpc/rang_patrimoine`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ poids, bonus, c: null, j: id }) });
    verifier(cp.statut === 200 && Array.isArray(cp.corps) && cp.corps.length === 1 && Number(cp.corps[0].n) > 0 && Number(cp.corps[0].rang) >= 1, 'ma place au classement de patrimoine se lit', cp);
    const cm = await requete(`${URL}/rest/v1/rpc/classement_maires`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ m0: 0, m1: 1e12, lim: 5 }) });
    verifier(cm.statut === 200 && Array.isArray(cm.corps), 'le classement des Maires se lit', cm);
    const sa = await requete(`${URL}/rest/v1/saisons?select=saison,numero&limit=1`, { headers: { apikey: publique } });
    verifier(sa.statut === 200 && Array.isArray(sa.corps), 'les saisons passées se lisent', sa);
    const mairieVol = await requete(`${URL}/rest/v1/mairies`, { method: 'POST', headers: { apikey: publique, Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mandat: 1, commune: 'x', maire: id, rivaux: 999 }) });
    verifier(mairieVol.statut >= 400, 'me donner une mairie directement : refusé', mairieVol.statut);
    const robots = await requete(`${URL}/rest/v1/robots?select=id,nom`, { headers: { apikey: publique } });
    verifier(robots.statut === 200 && Array.isArray(robots.corps) && robots.corps.length >= 1, `les joueurs robots sont là (${Array.isArray(robots.corps) ? robots.corps.map((r) => r.nom).join(', ') : '?'})`, robots.statut);
    if (Array.isArray(robots.corps) && robots.corps.length) {   // pour information : ce que les robots ont fait
      await new Promise((ok) => setTimeout(ok, 21000)); await jeu({ action: 'etat' }); await new Promise((ok) => setTimeout(ok, 8000));
      const leurs = await requete(`${URL}/rest/v1/lieux?select=id,niveau,prix_vente&proprietaire=in.(${robots.corps.map((r) => r.id).join(',')})`, { headers: { apikey: publique } });
      const l = Array.isArray(leurs.corps) ? leurs.corps : [];
      console.log(`ℹ les robots possèdent ${l.length} lieu(x), ${l.filter((x) => x.niveau > 0).length} construit(s), ${l.filter((x) => x.prix_vente != null).length} en vente`);
    }
    const classement = await requete(`${URL}/rest/v1/rpc/classement_commune`, { method: 'POST', headers: { apikey: publique, 'Content-Type': 'application/json' }, body: JSON.stringify({ c: communes[0] || 'x' }) });
    verifier(classement.statut === 200 && Array.isArray(classement.corps), 'le classement d’une commune est lisible', classement.statut);
  } finally {
    const sup = await requete(`${URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: entetesSecrets(secrete) });
    verifier(sup.statut < 300, 'joueur d’essai supprimé', sup.statut);
  }
  if (echecs) { console.log(`${echecs} vérification(s) en échec`); process.exit(1); }
  console.log('Le serveur répond comme prévu.');
})().catch((e) => { console.log('✗ essai impossible :', e.message); process.exit(1); });
