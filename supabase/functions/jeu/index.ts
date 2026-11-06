// La fonction « jeu » : le seul endroit qui modifie la partie d'un joueur (phase 8 : le vrai serveur).
// Le jeu (navigateur) l'appelle avec { action, ... } et le jeton du joueur connecté ; elle applique les MÊMES règles
// que le jeu (src/regles, recopiées dans _genere/ par tools/serveur_prepare.js), puis écrit par les fonctions SQL
// jeu_* (supabase/sql/010_jeu.sql), chacune atomique. Réponse : { ok: true, ... } ou { ok: false, code, message }.
import { createClient } from '@supabase/supabase-js';
import { Regles, Pack, Celebres, Tirage, Encheres, Mairie, Classements, Monuments, Regions, Boutique, Robots, Chasse } from './_genere/regles.mjs';
import { ECO, STANDING, FRANCE, DEPARTEMENTS, CONTOURS, CELEBRES, MONUMENTS, CHASSE_COMMUNES } from './_genere/donnees.mjs';
import { envoyer as envoyerSmtp } from './smtp.mjs';

const R = Regles.creer(ECO, STANDING);
const MAI = Mairie.creer(ECO);   // le Maire par caisse de travaux (src/regles/mairie.js, GDD § 5)
const CLA = Classements.creer(ECO);   // les classements et les saisons (src/regles/classements.js, GDD § 5 bis)
const MON = Monuments.creer(ECO);     // les monuments : entretien, impayés, absence (src/regles/monuments.js, GDD § 5 ter)
const BOU = Boutique.creer(ECO);      // la boutique et les gemmes (src/regles/boutique.js, GDD § 3 et § 9)
const ROB = Robots.creer(ECO);        // les joueurs de la maison (src/regles/robots.js, GDD § 5 quater)
// les robots (relus au plus toutes les 60 s) : ils ne prennent jamais une mairie ni une place de podium à un vrai joueur
let robotsLus = { ids: new Set<string>(), lu: 0 };
async function idsRobots() { if (Date.now() - robotsLus.lu > 60000) { const { data } = await admin.from('robots').select('id'); robotsLus = { ids: new Set((data || []).map((r: Ligne) => r.id)), lu: Date.now() }; } return robotsLus.ids; }

// la clé secrète du projet est donnée par Supabase à la fonction (jamais écrite dans le dépôt)
function cleSecrete(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; if (k) return k; } catch (_) { /* ancienne clé */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const admin = createClient(Deno.env.get('SUPABASE_URL') || '', cleSecrete(), { auth: { persistSession: false, autoRefreshToken: false } });

// le jeu publié, et l'outil de captures ; un autre site ne peut pas appeler la fonction depuis un navigateur
// les pages qui peuvent appeler la fonction (et où un paiement peut revenir) : citydeck.fr (acheté par Gautier le 5 nov.),
// l'ancienne adresse GitHub Pages, et les outils d'essai
const ORIGINES = ['https://josalystest1-sudo.github.io', 'https://citydeck.fr', 'https://www.citydeck.fr', 'http://jeu.local', 'http://localhost:8000'];
function enTetes(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINES.includes(o) ? o : ORIGINES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

// un refus attendu (pas assez de pièces…) : le message est montré tel quel au joueur
class Refus extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

// ---------------------------------------------------------------- l'horloge du serveur (.github/workflows/horloge.yml)
// Toutes les 10 minutes, la publication appelle la fonction avec { action: 'horloge' } et un jeton signé avec la clé
// secrète du projet (la clé elle-même ne voyage pas ; tools/serveur_horloge.js) : les enchères se closent et s'ouvrent,
// les mandats de Maire et les saisons tournent, les monuments sont tenus et les robots jouent, même quand aucun joueur
// n'appelle le serveur (avant, tout attendait le prochain appel d'un joueur).
function clesServeur(): string[] {
  const l: string[] = [];
  try { for (const v of Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'))) if (typeof v === 'string' && v) l.push(v); } catch (_) { /* pas de nouvelles clés */ }
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (s) l.push(s);
  return l;
}
async function signer(cle: string, texte: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(cle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texte))), (b) => b.toString(16).padStart(2, '0')).join('');
}
// le jeton de l'horloge : « horloge:<heure> » signé avec une clé secrète du projet (l'heure en cours ou la précédente)
async function estHorloge(jeton: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(jeton)) return false;
  const h = Math.floor(Date.now() / 3_600_000);
  for (const cle of clesServeur()) for (const x of [h, h - 1]) if ((await signer(cle, 'horloge:' + x)) === jeton) return true;
  return false;
}
async function tic(): Promise<Ligne> {
  const t0 = Date.now(), fait: string[] = [];
  const pas = async (nom: string, f: () => Promise<unknown>) => { try { await f(); fait.push(nom); } catch (e) { console.error('horloge', nom, e); } };
  await pas('enchères', () => tenirEncheres(true));
  await pas('mairies', () => tenirMairies());
  await pas('raretés', () => tenirRaretes());
  await pas('monuments', () => tenirMonuments());
  await pas('robots', () => robotsTour());
  await pas('alertes', () => envoyerAlertes());
  await pas('chasses', () => tenirChasses());
  return { horloge: new Date().toISOString(), fait, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- l'anti-triche (supabase/sql/160_anti_triche.sql)
// l'empreinte de la connexion : un condensé de l'adresse IP, chiffré avec la clé secrète du projet (on ne peut pas
// retrouver l'adresse), noté une fois par jour et par joueur ; des comptes en série depuis une même connexion font
// une alerte pour Gautier (rien n'est bloqué)
let cleEmpreinte: Promise<CryptoKey> | null = null;
const empreintesNotees = new Map<string, string>();   // joueur → « jour:empreinte » déjà notée par cette instance
async function noterEmpreinte(j: string, req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || (req.headers.get('x-real-ip') || '').trim();
  if (!ip) return;
  cleEmpreinte = cleEmpreinte || crypto.subtle.importKey('raw', new TextEncoder().encode('empreinte:' + cleSecrete()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await cleEmpreinte, new TextEncoder().encode(ip)));
  const e = Array.from(sig.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  const deja = new Date().toISOString().slice(0, 10) + ':' + e;
  if (empreintesNotees.get(j) === deja) return;
  const A = ECO.anti_triche;
  await rpc('jeu_empreinte', { j, e, seuil: A.comptes_par_connexion, garder: A.empreintes_jours });
  if (empreintesNotees.size > 5000) empreintesNotees.clear();
  empreintesNotees.set(j, deja);
}

// ---------------------------------------------------------------- la vitesse du temps (table reglages)
// jour_secondes : 60 sur le serveur d'essai (un jour = une minute), 86400 pour le vrai jeu (pack à minuit à Paris)
let vitesse = { jourMs: 60_000, lu: 0 };
async function jourMs(): Promise<number> {
  if (Date.now() - vitesse.lu < 30_000) return vitesse.jourMs;
  const { data } = await admin.from('reglages').select('valeur').eq('cle', 'jour_secondes').maybeSingle();
  const s = Number(data && data.valeur); vitesse = { jourMs: s >= 1 ? s * 1000 : 86_400_000, lu: Date.now() };
  return vitesse.jourMs;
}

// ---------------------------------------------------------------- lire la partie
type Ligne = Record<string, any>;
const ms = (t: string | null) => (t ? Date.parse(t) : 0);
// un lieu de la base → un lieu tel que le jeu (et les règles) le connaissent
function lieuDe(l: Ligne) {
  const a: Ligne = { id: l.id, label: l.label, lon: l.lon, lat: l.lat, citycode: l.citycode, city: l.city, type: l.type, niveau: l.niveau, depuis: ms(l.depuis) };
  if (l.notoriete) a.notoriete = l.notoriete;
  if (l.cat) a.cat = l.cat;
  if (l.qid) a.qid = l.qid;
  if (l.idu) a.idu = l.idu;
  if (l.prix_vente != null) { a.enVente = true; a.prixVente = Number(l.prix_vente); a.deviseVente = l.devise_vente || 'pieces'; }
  return a;
}
async function joueur(j: string) {
  await rpc('jeu_nouveau_joueur', { j, depart: ECO.solde_depart });
  const { data, error } = await admin.from('joueurs').select('pieces, encaisse, dernier_jour, dette, impaye_depuis, gemmes, pass_fin, bons').eq('id', j).single();
  if (error || !data) throw error || new Error('joueur introuvable');
  return data;
}
async function mesLieux(j: string) {
  const { data, error } = await admin.from('lieux').select('*').eq('proprietaire', j);
  if (error) throw error;
  return (data || []).map(lieuDe);
}
// les refus des fonctions SQL (raise exception '<code>') → un message pour le joueur ; toute autre erreur est une panne
const REFUS_SQL: Record<string, string> = {
  fonds: 'Pas assez de pièces.', pas_a_toi: 'Ce lieu n’est pas à toi.', niveau: 'On construit un niveau à la fois.',
  deja: 'Ton pack du jour est déjà ouvert : reviens au prochain jour du jeu.', plus_a_lui: 'Ce lieu a changé de propriétaire entre-temps.',
  prix_change: 'Le vendeur vient de changer son prix : regarde le nouveau.', soi_meme: 'Ce lieu est déjà à toi.',
  libre: 'Ce lieu n’est à personne : il ne sort que des packs.', offre: 'Cette offre n’est plus valable.', prix: 'Prix invalide.',
  echange: 'Cet échange n’est plus valable.', echange_change: 'Un des lieux proposés a changé de main : l’échange est annulé.',
  deja_echange: 'Tu as déjà proposé un échange pour ce lieu : annule-le d’abord.', deja_propose: 'Un de ces lieux est déjà proposé dans un autre échange.',
  rien: 'Choisis au moins un de tes lieux.', trop: 'Trente lieux au plus dans un échange.',
  lot: 'Cette enchère n’existe pas.', close: 'Cette enchère est close.', min: 'Ta mise est trop basse.',
  sans_lieu: 'Il te faut un lieu dans la commune pour verser à sa caisse.',
  gemmes: 'Pas assez de gemmes : la boutique en vend.', vide: 'Pack impossible à tirer pour l’instant : réessaie dans un instant.',
  essai: 'Les gemmes d’essai ne sont données que sur le serveur d’essai.', bon: 'Il te faut un bon : le Pass 15 jours en donne un.',
  pris: 'Cette adresse est déjà à quelqu’un : fais-lui une offre.',
  paiement: 'Le paiement par carte n’est pas encore ouvert.',
};
async function rpc(nom: string, args: Ligne) {
  const { data, error } = await admin.rpc(nom, args);
  if (error) { const m = String(error.message || '').trim(); if (REFUS_SQL[m]) throw new Refus(m, REFUS_SQL[m]); throw error; }
  return data;
}

// ---------------------------------------------------------------- les actions
// récolter : salaire + loyers depuis la dernière récolte, 24 h de stock au plus (mêmes règles que le jeu)
// le niveau des communes (supabase/sql/170_travaux.sql, 180_usure.sql ; GDD § 5) : l'état des travaux, usé jusqu'au mandat
// en cours, donne le niveau ; le niveau ajoute au loyer des lieux de la commune (MAI.bonusLoyer) et au plafond du Maire
const communeDe = (l: Ligne) => Regles.nomCommune(l.citycode || '', l.city || '');
async function niveauxCommunes(ks: string[], m: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {}; if (!ks.length) return out;
  const { data } = await admin.from('travaux').select('commune,etat,mandat').in('commune', ks);
  for (const r of data || []) out[r.commune] = MAI.niveauTravaux(MAI.etatTravaux(Number(r.etat), r.mandat == null ? m : Number(r.mandat), m));
  return out;
}
// les niveaux des communes de ces lieux, et le bonus de loyer de chacun
async function bonusDe(lieux: Ligne[], jm: number, maintenant: number) {
  const niv = await niveauxCommunes([...new Set(lieux.map(communeDe))], MAI.mandat(Regles.jourDuJeu(maintenant, jm)));
  return { niv, f: (l: Ligne) => MAI.bonusLoyer(niv[communeDe(l)] || 0) };
}

async function recolter(j: string) {
  for (let essai = 0; essai < 3; essai++) {
    const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now(), jm = await jourMs(), b = await bonusDe(lieux, jm, maintenant);
    const montant = R.aEncaisser(lieux, ms(jr.encaisse), maintenant, jm, b.f);
    if (montant < 1) return { recolte: 0, pieces: Number(jr.pieces) };
    const p = await rpc('jeu_recolter', { j, montant, avant: jr.encaisse, maintenant: new Date(maintenant).toISOString() });
    if (p != null) { await partsDesMaires(j, lieux, ms(jr.encaisse), maintenant, b).catch((e) => console.error('part des Maires', e)); return { recolte: montant, pieces: Number(p) }; }
  }
  throw new Refus('occupe', 'Une autre récolte est en cours : réessaie.');
}

// ---------------------------------------------------------------- le pack du jour (src/tirage.js, le même tirage que le jeu)
async function geoJSON(chemin: string) {
  const r = await fetch('https://data.geopf.fr/geocodage/' + chemin, { headers: { 'User-Agent': 'Cadastra (github.com/josalystest1-sudo/projet-jeux-immo)' } });
  if (!r.ok) throw new Error('géocodage ' + r.status);
  return r.json();
}
// libre = personne ne le possède (la table des lieux fait foi)
async function estLibre(c: Ligne) {
  const { data, error } = await admin.from('lieux').select('id').eq('id', c.id).maybeSingle();
  if (error) throw error;
  return !data;
}
const TIRAGE = Tirage.creer({
  geoJSON, celebres: async (dep: string) => (CELEBRES as Ligne)[dep] || [], france: FRANCE, deps: DEPARTEMENTS, standing: STANDING,
  Celebres, Pack, rarete: (l: Ligne) => R.rarete(l), estLibre, contours: CONTOURS,
});

// ma partie : pièces, lieux, ce qui attend d'être récolté (rendue aussi après chaque action : le jeu se recale dessus)
async function etatDe(j: string) {
  const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now(), jm = await jourMs();
  const [offres, echanges, notifs, encheres, b] = await Promise.all([mesOffres(j), mesEchanges(j), mesNotifs(j), mesEncheres(j), bonusDe(lieux, jm, maintenant)]);
  return {
    pieces: Number(jr.pieces), encaisse: ms(jr.encaisse), dernierJour: jr.dernier_jour == null ? null : Number(jr.dernier_jour), jour: Regles.jourDuJeu(maintenant, jm),
    lieux, maintenant, aRecolter: R.aEncaisser(lieux, ms(jr.encaisse), maintenant, jm, b.f), jourMs: jm, niveauxCommunes: b.niv, ...offres, ...echanges, notifs, ...encheres,
    entretien: { dette: Number(jr.dette || 0), impayeDepuis: jr.impaye_depuis ? ms(jr.impaye_depuis) : null },
    gemmes: Number(jr.gemmes || 0), pass: { fin: jr.pass_fin ? ms(jr.pass_fin) : null, bons: Number(jr.bons || 0) },
  };
}
// mes offres reçues et envoyées (en attente, et les dernières réglées), avec le lieu et l'autre joueur
async function mesOffres(j: string) {
  const { data, error } = await admin.from('offres').select('id, lieu, acheteur, vendeur, prix, devise, statut, cree_le, maj, lieux(label, lon, lat, citycode, city, type, notoriete, cat, qid, niveau)')
    .or(`acheteur.eq.${j},vendeur.eq.${j}`).order('maj', { ascending: false }).limit(60);
  if (error) throw error;
  const noms = await pseudos((data || []).flatMap((o: Ligne) => [o.acheteur, o.vendeur]));
  const recues: Ligne[] = [], envoyees: Ligne[] = [];
  for (const o of data || []) {
    const base = { id: String(o.id), addrId: o.lieu, price: Number(o.prix), devise: o.devise || 'pieces', status: o.statut, ts: ms(o.cree_le) };
    if (o.vendeur === j) recues.push({ ...base, from: noms[o.acheteur] || 'Un joueur' });
    else envoyees.push({ ...base, to: noms[o.vendeur] || 'Un joueur', addr: o.lieux ? { id: o.lieu, ...o.lieux } : { id: o.lieu, label: 'un lieu' } });
  }
  return { offresRecues: recues, offresEnvoyees: envoyees };
}
async function mesNotifs(j: string) {
  const { data, error } = await admin.from('notifications').select('id, type, texte, donnees, lu, cree_le').eq('joueur', j).order('cree_le', { ascending: false }).limit(60);
  if (error) throw error;
  return (data || []).map((n: Ligne) => ({ id: n.id, ts: ms(n.cree_le), type: n.type, text: n.texte, read: n.lu,
    ...(n.donnees && n.donnees.offre ? { offerId: String(n.donnees.offre) } : {}), ...(n.donnees && n.donnees.echange ? { echangeId: String(n.donnees.echange) } : {}),
    ...(n.donnees && n.donnees.lieu ? { addrId: n.donnees.lieu } : {}) }));
}
// mes échanges proposés et reçus (en attente, et les derniers réglés) ; pour un échange reçu en attente, les lieux
// offerts tels qu'ils sont (constructions comprises), pour juger ce qu'on reçoit
async function mesEchanges(j: string) {
  const { data, error } = await admin.from('echanges').select('id, lieu, proposeur, destinataire, donnes, noms, ajout, statut, cree_le, lieux(label, lon, lat, citycode, city, type, notoriete, cat, qid, niveau, idu)')
    .or(`proposeur.eq.${j},destinataire.eq.${j}`).order('maj', { ascending: false }).limit(40);
  if (error) throw error;
  const lignes = (data || []) as Ligne[], noms = await pseudos(lignes.flatMap((x) => [x.proposeur, x.destinataire]));
  const ids = [...new Set(lignes.filter((x) => x.destinataire === j && x.statut === 'attente').flatMap((x) => x.donnes as string[]))];
  const offerts: Record<string, Ligne> = {};
  if (ids.length) { const { data: ls, error: e2 } = await admin.from('lieux').select('*').in('id', ids); if (e2) throw e2; for (const l of ls || []) offerts[l.id] = l; }
  const recus: Ligne[] = [], envoyes: Ligne[] = [];
  for (const x of lignes) {
    const base = { id: String(x.id), addrId: x.lieu, donne: x.donnes, noms: x.noms || {}, ajout: Number(x.ajout), status: x.statut, ts: ms(x.cree_le) };
    if (x.destinataire === j) recus.push({ ...base, from: noms[x.proposeur] || 'Un joueur', lieux: (x.donnes as string[]).filter((id) => offerts[id] && offerts[id].proprietaire === x.proposeur).map((id) => lieuDe(offerts[id])) });
    else envoyes.push({ ...base, to: noms[x.destinataire] || 'Un joueur', addr: x.lieux ? { id: x.lieu, ...x.lieux } : { id: x.lieu, label: 'un lieu' } });
  }
  return { echangesRecus: recus, echangesEnvoyes: envoyes };
}
async function pseudos(uids: string[]) {
  const ids = [...new Set(uids.filter(Boolean))]; if (!ids.length) return {} as Record<string, string>;
  const { data } = await admin.from('profils').select('id, pseudo').in('id', ids);
  return Object.fromEntries((data || []).map((p: Ligne) => [p.id, p.pseudo])) as Record<string, string>;
}

const ACTIONS: Record<string, (j: string, corps: Ligne) => Promise<Ligne>> = {
  etat: async (j) => etatDe(j),
  recolter: async (j) => recolter(j),
  // construire le niveau suivant : on récolte d'abord (comme le jeu), puis on paie le coût des règles
  async construire(j, corps) {
    const id = String(corps.id || ''), niveau = Number(corps.niveau);
    if (!id || !Number.isInteger(niveau) || niveau < 1 || niveau >= R.NIVEAUX.length) throw new Refus('niveau', 'Construction impossible.');
    await recolter(j);
    const { data: l } = await admin.from('lieux').select('*').eq('id', id).eq('proprietaire', j).maybeSingle();
    if (!l) throw new Refus('pas_a_toi', 'Ce lieu n’est pas à toi.');
    const a = lieuDe(l);
    if (!R.peutConstruire(a, niveau)) throw new Refus('plafond', `Ce lieu ne monte pas plus haut que : ${R.texteNiveau(R.plafond(a))}.`);
    const cout = R.coutNiveau(a, niveau);
    const pieces = await rpc('jeu_construire', { j, l: id, n: niveau, cout });
    return { pieces: Number(pieces), lieu: { ...a, niveau }, cout };
  },
};

// ---------------------------------------------------------------- le marché : vente à prix libre, achat, offres
const nb = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0');
const fmt = (n: number) => `${nb(n)} 🪙`;
const fmtD = (n: number, d: string) => (d === 'gemmes' ? `${nb(n)} 💎` : fmt(n));   // un montant en pièces ou en gemmes
const notifier = (j: string, type: string, texte: string, donnees: Ligne = {}) => rpc('jeu_notifier', { j, type, texte, donnees });
async function lieuEnBase(id: string) { const { data, error } = await admin.from('lieux').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; }
function prixLu(p: unknown) { const r = R.lirePrix(String(p ?? '')); if (!r.ok) throw new Refus('prix', 'Tape un prix en pièces (un nombre entier).'); return r.prix as number; }
// les autres offres en attente sur un lieu qui vient de changer de main : prévenir leurs auteurs
async function offresEnAttente(l: string) { const { data } = await admin.from('offres').select('id, acheteur').eq('lieu', l).eq('statut', 'attente'); return data || []; }
async function prevenirCaduques(avant: Ligne[], garder: string | null, label: string) {
  for (const o of avant) if (String(o.id) !== garder) await notifier(o.acheteur, 'offre', `${label} a été vendu à quelqu’un d’autre : ton offre est annulée.`, { lieu: null });
}
// le changement de propriétaire : les loyers de chacun sont encaissés avant (personne ne perd ce qui a poussé)
async function transferer(l: Ligne, acheteur: string, prix: number, prixAttendu: number | null, offre: string | null, devise = 'pieces') {
  await recolter(acheteur); await recolter(l.proprietaire);
  const autres = await offresEnAttente(l.id);
  const pieces = await rpc('jeu_transferer', { l: l.id, vendeur: l.proprietaire, acheteur, prix, prix_attendu: prixAttendu, offre: offre ? Number(offre) : null, valeur_ref: R.valeur(lieuDe(l)), devise: BOU.devise(devise) });
  await prevenirCaduques(autres, offre, l.label);
  return Number(pieces);
}

ACTIONS.vendre = async (j, corps) => { await rpc('jeu_vendre', { j, l: String(corps.id || ''), prix: prixLu(corps.prix), devise: BOU.devise(corps.devise) }); return {}; };
ACTIONS.retirer = async (j, corps) => { await rpc('jeu_vendre', { j, l: String(corps.id || ''), prix: null, devise: 'pieces' }); return {}; };
// acheter un lieu en vente, au prix affiché (si le vendeur l'a changé entre-temps : refus, on montre le nouveau)
ACTIONS.acheter = async (j, corps) => {
  const l = await lieuEnBase(String(corps.id || ''));
  if (!l) throw new Refus('libre', 'Ce lieu n’est à personne : il ne sort que des packs.');
  if (l.proprietaire === j) throw new Refus('soi_meme', 'Ce lieu est déjà à toi.');
  if (l.prix_vente == null) throw new Refus('pas_en_vente', 'Ce lieu n’est plus en vente : fais une offre à son propriétaire.');
  const prix = Number(l.prix_vente), devise = BOU.devise(l.devise_vente), noms = await pseudos([j, l.proprietaire]);
  const pieces = await transferer(l, j, prix, corps.prix != null ? prixLu(corps.prix) : prix, null, devise);
  await notifier(l.proprietaire, 'vente', `${noms[j] || 'Un joueur'} a acheté ${l.label} pour ${fmtD(prix, devise)}.`, { lieu: l.id });
  return { pieces, prix, devise, label: l.label, vendeur: noms[l.proprietaire] || 'Un joueur' };
};
// faire une offre sur le lieu d'un autre (une seule en attente par lieu : la refaire change son prix)
ACTIONS.offrir = async (j, corps) => {
  const prix = prixLu(corps.prix), l = await lieuEnBase(String(corps.id || ''));
  if (!l) throw new Refus('libre', 'Ce lieu n’est à personne : il ne sort que des packs.');
  if (l.proprietaire === j) throw new Refus('soi_meme', 'Ce lieu est déjà à toi.');
  // en vente : dans la monnaie demandée par le vendeur ; sinon, dans celle choisie par l'acheteur (GDD § 9)
  const devise = BOU.deviseOffre(l.prix_vente != null ? l.devise_vente : null, corps.devise), jr = await joueur(j);
  if (!BOU.assez(prix, devise, Number(jr.pieces), Number(jr.gemmes || 0))) throw new Refus(devise === 'gemmes' ? 'gemmes' : 'fonds', devise === 'gemmes' ? 'Tu n’as pas assez de gemmes pour cette offre.' : 'Tu n’as pas assez de pièces pour cette offre.');
  const offre = await rpc('jeu_offrir', { j, l: l.id, prix, devise }), noms = await pseudos([j, l.proprietaire]);
  await notifier(l.proprietaire, 'offre', `${noms[j] || 'Un joueur'} te propose ${fmtD(prix, devise)} pour ${l.label}.`, { offre, lieu: l.id });
  return { offre: String(offre), vendeur: noms[l.proprietaire] || 'Un joueur', prix, devise };
};
ACTIONS.annuler_offre = async (j, corps) => { await rpc('jeu_offre_statut', { o: Number(corps.offre), qui: j, statut: 'annulee' }); return {}; };
// accepter (le lieu change de main, si l'acheteur a toujours les pièces) ou refuser une offre reçue
ACTIONS.repondre_offre = async (j, corps) => {
  const { data: o } = await admin.from('offres').select('*').eq('id', Number(corps.offre)).maybeSingle();
  if (!o || o.vendeur !== j || o.statut !== 'attente') throw new Refus('offre', 'Cette offre n’est plus valable.');
  const l = await lieuEnBase(o.lieu), noms = await pseudos([j, o.acheteur]), prix = Number(o.prix), devise = BOU.devise(o.devise);
  if (!l || l.proprietaire !== j) { await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'caduque' }); throw new Refus('plus_a_lui', 'Ce lieu n’est plus à toi : l’offre est annulée.'); }
  if (!corps.accepter) {
    await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'refusee' });
    await notifier(o.acheteur, 'offre', `${noms[j] || 'Un joueur'} a refusé ton offre de ${fmtD(prix, devise)} pour ${l.label}.`, { lieu: l.id });
    return { accepte: false };
  }
  try { await transferer(l, o.acheteur, prix, null, String(o.id), devise); }
  catch (e) {
    if (!(e instanceof Refus) || (e.code !== 'fonds' && e.code !== 'gemmes')) throw e;
    const quoi = devise === 'gemmes' ? 'de gemmes' : 'de pièces';
    await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'caduque' });
    await notifier(o.acheteur, 'offre', `Ton offre de ${fmtD(prix, devise)} pour ${l.label} n’a pas abouti : tu n’avais plus assez ${quoi}.`, { lieu: l.id });
    throw new Refus('fonds', `${noms[o.acheteur] || 'L’acheteur'} n’a plus assez ${quoi} : l’offre est annulée.`);
  }
  await notifier(o.acheteur, 'offre', `${noms[j] || 'Un joueur'} a accepté ton offre : ${l.label} est à toi pour ${fmtD(prix, devise)} !`, { lieu: l.id });
  return { accepte: true, prix, devise, label: l.label, acheteur: noms[o.acheteur] || 'Un joueur' };
};
ACTIONS.notifs_lues = async (j) => { await rpc('jeu_notifs_lues', { j }); return {}; };

// ---------------------------------------------------------------- les échanges (8.1f ; demande de Gautier, 3 nov.)
// « A, B et C » (trois noms au plus, sinon « A, B et N autres »)
function liste(noms: string[]) {
  const n = noms.map((x) => x || 'un lieu'); if (n.length <= 1) return n[0] || 'un lieu';
  if (n.length > 3) return `${n.slice(0, 2).join(', ')} et ${n.length - 2} autres`;
  return `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]}`;
}
// proposer un ou plusieurs de ses lieux (plus des pièces, facultatif) contre le lieu d'un autre joueur
ACTIONS.echanger = async (j, corps) => {
  const l = await lieuEnBase(String(corps.id || ''));
  if (!l) throw new Refus('libre', REFUS_SQL.libre);
  if (l.proprietaire === j) throw new Refus('soi_meme', REFUS_SQL.soi_meme);
  const dons = [...new Set((Array.isArray(corps.donnes) ? corps.donnes : []).map((x: unknown) => String(x || '')).filter(Boolean))] as string[];
  if (!dons.length) throw new Refus('rien', REFUS_SQL.rien);
  if (dons.length > 30) throw new Refus('trop', REFUS_SQL.trop);
  const ajout = corps.ajout == null || /^[0\s]*$/.test(String(corps.ajout)) ? 0 : prixLu(corps.ajout);
  const { data: miens, error } = await admin.from('lieux').select('id, label').in('id', dons).eq('proprietaire', j);
  if (error) throw error;
  if ((miens || []).length !== dons.length) throw new Refus('pas_a_toi', 'Un des lieux proposés n’est pas à toi.');
  const noms: Record<string, string> = Object.fromEntries((miens || []).map((m: Ligne) => [m.id, m.label]));
  const echange = await rpc('jeu_echanger', { j, l: l.id, dons, supplement: ajout, noms_dons: noms }), ps = await pseudos([j, l.proprietaire]);
  await notifier(l.proprietaire, 'echange', `${ps[j] || 'Un joueur'} te propose ${liste(dons.map((id) => noms[id]))}${ajout ? `, plus ${fmt(ajout)},` : ''} contre ${l.label}.`, { echange, lieu: l.id });
  return { echange: String(echange), destinataire: ps[l.proprietaire] || 'Un joueur' };
};
ACTIONS.annuler_echange = async (j, corps) => { await rpc('jeu_echange_statut', { e: Number(corps.echange), qui: j, statut: 'annulee' }); return {}; };
// accepter (les lieux changent de main, si chacun a encore ce qu'il a promis) ou refuser un échange reçu
ACTIONS.repondre_echange = async (j, corps) => {
  const { data: x } = await admin.from('echanges').select('*').eq('id', Number(corps.echange)).maybeSingle();
  if (!x || x.destinataire !== j || x.statut !== 'attente') throw new Refus('echange', REFUS_SQL.echange);
  const l = await lieuEnBase(x.lieu), ps = await pseudos([j, x.proposeur]), nomsX: Ligne = x.noms || {};
  const dons = liste((x.donnes as string[]).map((id) => nomsX[id])), ajout = Number(x.ajout), label = l ? l.label : 'ton lieu';
  const avecAjout = ajout ? `, plus ${fmt(ajout)}` : '', lui = ps[x.proposeur] || 'Le joueur', moi = ps[j] || 'Un joueur';
  // l'échange tombe : le proposeur est prévenu, le destinataire voit pourquoi
  const tomber = async (pourLui: string, pourMoi: string, code: string): Promise<never> => {
    await rpc('jeu_echange_statut', { e: x.id, qui: j, statut: 'caduque' }).catch(() => {});
    await notifier(x.proposeur, 'echange', pourLui, { lieu: x.lieu });
    throw new Refus(code, pourMoi);
  };
  const lieuParti = () => tomber(`Ton échange pour ${label} est annulé : ce lieu a changé de main.`, 'Ce lieu n’est plus à toi : l’échange est annulé.', 'plus_a_lui');
  if (!corps.accepter) {
    await rpc('jeu_echange_statut', { e: x.id, qui: j, statut: 'refusee' });
    await notifier(x.proposeur, 'echange', `${moi} a refusé ton échange : ${dons}${avecAjout}${ajout ? ',' : ''} contre ${label}.`, { lieu: x.lieu });
    return { accepte: false };
  }
  if (!l || l.proprietaire !== j) await lieuParti();
  // les loyers de chacun sont encaissés avant (personne ne perd ce qui a poussé)
  await recolter(j); await recolter(x.proposeur);
  let tombes: Ligne[] = [];
  try { tombes = (await rpc('jeu_echange_accepter', { e: x.id, qui: j })) || []; }
  catch (e) {
    if (!(e instanceof Refus)) throw e;
    if (e.code === 'fonds') await tomber(`Ton échange pour ${label} n’a pas abouti : tu n’avais plus assez de pièces.`, `${lui} n’a plus assez de pièces : l’échange est annulé.`, 'fonds');
    if (e.code === 'echange_change') await tomber(`Ton échange pour ${label} est annulé : un des lieux proposés n’est plus à toi.`, `${lui} n’a plus tous les lieux proposés : l’échange est annulé.`, 'echange_change');
    if (e.code === 'plus_a_lui') await lieuParti();
    throw e;
  }
  await notifier(x.proposeur, 'echange', `${moi} a accepté ton échange : ${label} est à toi, contre ${dons}${avecAjout} !`, { lieu: x.lieu });
  // les offres et les autres échanges qui portaient sur ces lieux sont tombés : prévenir leurs auteurs
  const nomDe = (id: string) => (id === x.lieu ? label : (nomsX[id] || 'un lieu'));
  for (const t of tombes) {
    if (t.joueur === j || t.joueur === x.proposeur) continue;
    await notifier(t.joueur, t.type, t.type === 'offre' ? `${nomDe(t.lieu)} a changé de main : ton offre est annulée.` : `${nomDe(t.lieu)} a changé de main : ta proposition d’échange est annulée.`, { lieu: null });
  }
  return { accepte: true, label, dons, ajout, proposeur: lui, recus: x.donnes };
};

// ---------------------------------------------------------------- les enchères de monuments (8.1g)
// Chaque semaine du jeu (jour du jeu / 7 ; sur le serveur d'essai, une semaine = 7 jours d'une minute), 3 lots tirés
// par src/regles/encheres.js parmi les monuments encore libres. Pas de minuterie : le calendrier est tenu à chaque
// appel (tenirEncheres) : les lots finis sont clos, ceux de la semaine sont ouverts s'ils manquent.
const ENC = Encheres.creer(ECO);
const LISTE_MON = MONUMENTS as Ligne[];
async function semaineServeur() {
  const jm = await jourMs(), s = Math.floor(Regles.jourDuJeu(Date.now(), jm) / 7);
  return { s, debut: Regles.debutJour(s * 7, jm), fin: Regles.debutJour((s + 1) * 7, jm) };
}
// les monuments qui ne sont à personne et pas déjà dans un lot ouvert, par palier
async function monumentsLibres(enJeu: string[]) {
  const { data, error } = await admin.from('lieux').select('id').eq('type', 'monument');
  if (error) throw error;
  const pris = new Set([...(data || []).map((l: Ligne) => l.id), ...enJeu.map((id) => 'mon:' + id)]);
  const libres = LISTE_MON.filter((m) => !pris.has('mon:' + m.id));
  return { nat: libres.filter((m) => m.palier === 'national'), reg: libres.filter((m) => m.palier !== 'national') };
}
// le lieu que reçoit le gagnant (comme dans la démo : « mon: » + l'identifiant du monument)
const lieuMonument = (m: Ligne) => ({ id: 'mon:' + m.id, label: m.nom, lon: m.lon, lat: m.lat, citycode: m.insee || '', city: m.ville || '', commune: Regles.nomCommune(m.insee || '', m.ville || ''), qid: /^Q\d+$/.test(m.id) ? m.id : null });
let encheresTenues = 0;
async function tenirEncheres(force = false) {
  if (!force && Date.now() - encheresTenues < 5000) return;
  encheresTenues = Date.now();
  const { data: finis, error } = await admin.from('encheres').select('*').eq('statut', 'ouverte').lte('fin', new Date().toISOString()).limit(10);
  if (error) throw error;
  for (const l of finis || []) await cloturer(l);
  const { s, fin } = await semaineServeur();
  const { count } = await admin.from('encheres').select('cle', { count: 'exact', head: true }).eq('semaine', s).lt('rang', 10);
  if (count) return;
  const { data: ouverts } = await admin.from('encheres').select('monument').eq('statut', 'ouverte');
  const { nat, reg } = await monumentsLibres((ouverts || []).map((o: Ligne) => o.monument));
  const lots = ENC.lots(s, nat, reg).map((x: Ligne, k: number) => ({ cle: x.cle, semaine: s, rang: k, palier: x.palier, monument: x.m.id, lieu: lieuMonument(x.m), depart: ENC.miseDepart(x.m), fin: new Date(fin).toISOString() }));
  if (lots.length) await rpc('jeu_encheres_ouvrir', { lots });
}
// clore un lot fini : le monument va à la meilleure mise couverte par les pièces (sinon à la suivante) ; chacun est prévenu
async function cloturer(l: Ligne) {
  const { data: mises } = await admin.from('mises').select('joueur, montant, id').eq('lot', l.cle);
  const joueurs = [...new Set((mises || []).map((b: Ligne) => b.joueur as string))];
  for (const u of joueurs) await recolter(u).catch(() => {});   // les loyers de chacun comptent pour payer
  const top = ENC.meilleure((mises || []).map((b: Ligne) => ({ qui: b.joueur, montant: Number(b.montant), ts: Number(b.id) })));
  const r = await rpc('jeu_enchere_cloturer', { c: l.cle });
  if (!r) return;   // déjà clos par un autre appel
  if (!r.gagnant && Number(l.rang) >= 10) await rpc('jeu_alerte', { alerte: { type: 'sans_preneur', monument: l.monument, nom: (l.lieu && l.lieu.label) || l.monument, commune: (l.lieu && l.lieu.commune) || '', fin_enchere: null, texte: `🏛️ ${(l.lieu && l.lieu.label) || 'Un monument'} attend toujours son propriétaire dans CityDeck : il reviendra bientôt aux enchères. #CityDeck` } }).catch((e) => console.error('alerte', e));
  const nom = (l.lieu && l.lieu.label) || 'le monument', g = r.gagnant as string | null, prix = Number(r.prix || 0), ps = await pseudos(joueurs);
  for (const u of joueurs) {
    if (u === g) { await notifier(u, 'enchere', `🏆 Tu as remporté ${nom} pour ${fmt(prix)} !`, { lieu: l.lieu.id }); continue; }
    const passe = top && top.qui === u ? ' Tu menais, mais tes pièces ne couvraient plus ta mise : il passe à la mise suivante.' : '';
    await notifier(u, 'enchere', `Enchère terminée : ${nom} va à ${g ? `${ps[g] || 'un joueur'} pour ${fmt(prix)}` : 'personne'}.${passe}`, {});
  }
}
// mes mises qui mènent (bloquées) et les lots où l'on m'a dépassé : dans ma partie
async function mesEncheres(j: string) {
  const r: Ligne = (await rpc('jeu_menees', { j })) || {};
  const menees: Record<string, number> = {}; for (const [c, v] of Object.entries(r.menees || {})) menees[c] = Number(v);
  return { encheresMenees: menees, encheresDepasse: r.depasse || [] };
}
// la semaine aux enchères : les lots, leurs mises (avec les pseudos), la fin, et un aperçu des deux semaines suivantes
ACTIONS.encheres = async (j) => {
  await tenirEncheres(true);
  const { s, debut, fin } = await semaineServeur();
  const { data: lots, error } = await admin.from('encheres').select('*').eq('semaine', s).order('rang');
  if (error) throw error;
  const cles = (lots || []).map((l: Ligne) => l.cle);
  const { data: mises } = cles.length ? await admin.from('mises').select('lot, joueur, montant, id, cree_le').in('lot', cles).order('id', { ascending: false }).limit(300) : { data: [] as Ligne[] };
  const ps = await pseudos((mises || []).map((b: Ligne) => b.joueur));
  const { nat, reg } = await monumentsLibres((lots || []).map((l: Ligne) => l.monument));
  const apercu = (x: Ligne) => ({ cle: x.cle, semaine: x.semaine, palier: x.palier, monument: x.m.id, depart: ENC.miseDepart(x.m), mises: [] });
  return {
    semaine: s, debut, fin, maintenant: Date.now(),
    lots: (lots || []).map((l: Ligne) => ({ cle: l.cle, semaine: s, palier: l.palier, monument: l.monument, depart: Number(l.depart), fin: ms(l.fin), statut: l.statut,
      mises: (mises || []).filter((b: Ligne) => b.lot === l.cle).map((b: Ligne) => ({ uid: b.joueur, qui: ps[b.joueur] || 'Un joueur', montant: Number(b.montant), ts: ms(b.cree_le) })) })),
    suivantes: [1, 2].map((k) => ENC.lots(s + k, nat, reg).map(apercu)),
    ...(await mesEncheres(j)),
  };
};
// miser : au moins la mise minimale, couverte par les pièces moins les mises qui mènent ailleurs ; le meneur d'avant est prévenu
ACTIONS.miser = async (j, corps) => {
  await tenirEncheres();
  const cle = String(corps.cle || ''), montant = Number(corps.montant);
  if (!Number.isInteger(montant) || montant <= 0 || montant > Regles.PRIX_MAX) throw new Refus('prix', 'Tape une mise en pièces (un nombre entier).');
  const { data: l } = await admin.from('encheres').select('*').eq('cle', cle).maybeSingle();
  if (!l) throw new Refus('lot', REFUS_SQL.lot);
  if (l.statut !== 'ouverte' || Date.parse(l.fin) <= Date.now()) throw new Refus('close', REFUS_SQL.close);
  if (Number(l.semaine) > (await semaineServeur()).s) throw new Refus('lot', 'Cette enchère ouvrira la semaine prochaine.');
  await recolter(j);
  let avant: Ligne;
  try { avant = (await rpc('jeu_miser', { j, c: cle, montant, pas: ECO.encheres.pas_min })) || {}; }
  catch (e) {
    if (!(e instanceof Refus)) throw e;
    if (e.code === 'min') {
      const { data: top } = await admin.from('mises').select('montant').eq('lot', cle).order('montant', { ascending: false }).limit(1);
      const min = top && top.length ? Math.ceil(Number(top[0].montant) * (1 + ECO.encheres.pas_min)) : Number(l.depart);
      throw new Refus('min', `La mise minimale est de ${fmt(min)}.`);
    }
    if (e.code === 'fonds') {
      const jr = await joueur(j), bloque = Number(await rpc('jeu_bloque', { j, sauf: cle }));
      throw new Refus('fonds', `Pas assez de pièces : ${fmt(Math.max(0, Number(jr.pieces) - bloque))} disponibles (tes mises qui mènent ailleurs sont bloquées).`);
    }
    throw e;
  }
  const nom = (l.lieu && l.lieu.label) || 'le monument';
  if (avant.joueur && avant.joueur !== j) {
    const ps = await pseudos([j]);
    await notifier(avant.joueur, 'enchere', `${ps[j] || 'Un joueur'} a surenchéri à ${fmt(montant)} sur ${nom}. Tes pièces sont libérées.`, {});
  }
  return { cle, montant, nom };
};

// ---------------------------------------------------------------- le Maire par caisse de travaux (GDD § 5)
// Le mandat en cours (2 semaines du jeu) ; les Maires d'un mandat sont élus par la caisse du mandat précédent, avec les
// règles du jeu (MAI.elire : seuil, égalité, absence). Le Maire touche une part des loyers des autres joueurs de la commune
// à chaque récolte de ceux-ci (elle s'ajoute : leurs loyers ne baissent pas), jusqu'au plafond du mandat.
async function mandatServeur() {
  const jm = await jourMs(), m = MAI.mandat(Regles.jourDuJeu(Date.now(), jm));
  return { jm, m, fin: Regles.debutJour(MAI.premierJour(m + 1), jm) };
}
// les caisses de communes (mandats m - 1 et m), et pour chaque commune : ses Maires du mandat m, les versements
async function caissesDe(communes: string[], m: number, jm: number) {
  const out: Record<string, { avant: Ligne[]; cours: Ligne[]; maires: string[]; rivaux: number }> = {};
  for (const k of communes) out[k] = { avant: [], cours: [], maires: [], rivaux: 0 };
  if (!communes.length) return out;
  const data = await rpc('caisse_communes', { communes, m, absent_avant: new Date(Date.now() - MAI.M.absence_jours * jm).toISOString(), seuil: MAI.M.seuil });
  for (const r of (data || []) as Ligne[]) { const o = out[r.commune]; if (o) (Number(r.mandat) === m ? o.cours : o.avant).push(r); }
  const robots = await idsRobots();
  for (const o of Object.values(out)) {
    const absents = new Set(o.avant.filter((r) => r.absent).map((r) => r.joueur));
    const electeurs = ROB.electeurs(o.avant, (u: string) => robots.has(u), MAI.M.seuil);
    const e = MAI.elire(Object.fromEntries(electeurs.map((r: Ligne) => [r.joueur, Number(r.points)])), (u: string) => absents.has(u));
    o.maires = e.maires; o.rivaux = e.rivaux;
  }
  return out;
}
// à chaque récolte : la part des Maires des communes où le joueur touche des loyers (pas sur ses propres lieux)
async function partsDesMaires(j: string, lieux: Ligne[], depuis: number, maintenant: number, b: { niv: Record<string, number>, f: (l: Ligne) => number }) {
  const jm = await jourMs(), jours = Math.min(maintenant - depuis, ECO.stock_loyer_heures * jm / 24) / jm;
  if (!(jours > 0) || !lieux.length) return;
  const loyers: Record<string, number> = {};
  for (const l of lieux) { const k = communeDe(l); loyers[k] = (loyers[k] || 0) + R.loyerParJour(l, b.f(l)) * jours; }
  const m = MAI.mandat(Regles.jourDuJeu(maintenant, jm)), caisses = await caissesDe(Object.keys(loyers), m, jm);
  for (const [k, c] of Object.entries(caisses)) {
    const n = c.maires.length; if (!n) continue;
    for (const u of c.maires) if (u !== j) await rpc('jeu_part_maire', { m, c: k, mr: u, montant: Math.floor(loyers[k] * MAI.M.part_loyers / n), plafond: MAI.plafondPart(n, b.niv[k] || 0) });
  }
}
// verser à la caisse d'une commune : un lieu dans la commune, au moins le minimum, couvert par les pièces moins les mises
// qui mènent aux enchères ; un versement de la dernière heure du mandat compte à moitié
ACTIONS.verser = async (j, corps) => {
  const k = String(corps.commune || '').slice(0, 120), montant = Number(corps.montant);
  const { m, fin, jm } = await mandatServeur();
  await recolter(j);
  const jr = await joueur(j), bloque = Number(await rpc('jeu_bloque', { j, sauf: '' }));
  const { count } = await admin.from('lieux').select('id', { count: 'exact', head: true }).eq('proprietaire', j).eq('commune', k);
  const v = MAI.peutVerser(montant, Math.max(0, Number(jr.pieces) - bloque), count || 0);
  if (!v.ok) throw new Refus(v.raison, v.raison === 'sans_lieu' ? REFUS_SQL.sans_lieu : (v.raison === 'minimum' ? `Au moins ${fmt(MAI.M.versement_min)}.` : `Pas assez de pièces : ${fmt(Math.max(0, Number(jr.pieces) - bloque))} disponibles (tes mises qui mènent aux enchères sont bloquées).`));
  const pts = MAI.points(montant, fin - Date.now(), jm);
  await rpc('jeu_verser', { j, m, c: k, montant, pts });
  return { commune: k, montant, points: pts, mandat: m };
};
// la fin d'un mandat (au premier appel du mandat suivant, une seule fois) : chacun apprend ce qui le concerne
let mairiesTenues = 0;
async function tenirMairies() {
  if (Date.now() - mairiesTenues < 5000) return;
  mairiesTenues = Date.now();
  const { m, jm } = await mandatServeur();
  if (!(await rpc('jeu_mandat_tenir', { m }))) return;
  const origine = Number(await rpc('jeu_origine_saisons', { s: CLA.saison(m) }));
  const { data } = await admin.from('caisses').select('commune').in('mandat', [m - 1, m - 2]).limit(5000);
  const ks = [...new Set((data || []).map((r: Ligne) => r.commune as string))];
  for (let i = 0; i < ks.length; i += 200) {
    const lot = ks.slice(i, i + 200), elus = await caissesDe(lot, m, jm), avant = await caissesDe(lot, m - 1, jm);
    const lignes = lot.flatMap((k) => elus[k].maires.map((u) => ({ commune: k, maire: u, rivaux: elus[k].rivaux })));
    if (lignes.length) await rpc('jeu_mairies', { m, lignes });
    for (const k of lot) {
      const e = elus[k], a = avant[k], verses = e.avant;   // e.avant : la caisse du mandat qui vient de finir
      const ps = await pseudos([...e.maires, ...verses.map((r) => r.joueur)]), noms = e.maires.map((u) => ps[u] || 'un joueur').join(' et ');
      const max = verses.length ? Math.max(...verses.map((r) => Number(r.points))) : 0;
      for (const u of e.maires) await notifier(u, 'maire', `👑 Tu es ${a.maires.includes(u) ? 'réélu' : 'élu'} Maire de ${k} pour 2 semaines : tu touches 5 % des loyers des autres joueurs de la commune.`, { commune: k });
      for (const r of verses) if (!e.maires.includes(r.joueur)) await notifier(r.joueur, 'maire', e.maires.length ? `${noms} ${e.maires.length > 1 ? 'deviennent' : 'devient'} Maire${e.maires.length > 1 ? 's' : ''} de ${k} (${fmt(max)} versées ; toi : ${fmt(Number(r.points))}).` : `Pas de Maire à ${k} ce mandat : personne n’a versé ${fmt(MAI.M.seuil)}.`, { commune: k });
      for (const u of a.maires) if (!e.maires.includes(u)) await notifier(u, 'maire', `Ton mandat de Maire de ${k} est terminé.`, { commune: k });
    }
  }
  // le premier mandat d'une saison : la saison d'avant se fige
  if (CLA.saison(m) !== CLA.saison(m - 1)) await tenirSaison(CLA.saison(m) - 1, origine).catch((e) => console.error('saison', e));
}
// ---------------------------------------------------------------- les classements et les saisons (GDD § 5 bis)
const POIDS = [1, 2, 3, 4, 5, 6].map((r) => (ECO as Ligne).classements.poids_rarete[String(r)]), BONUS = (ECO as Ligne).classements.bonus_niveau;
const ordinal = (n: number) => (n === 1 ? '1er' : n + 'e');
// figer une saison finie (une seule fois) : les deux classements, la place de chacun, le Maire de la saison de chaque
// commune ; chaque joueur classé est prévenu
async function tenirSaison(s: number, origine: number) {
  const numero = CLA.numero(s, Math.min(origine, s));
  if (!(await rpc('jeu_saison_tenir', { s, num: numero }))) return;
  const m0 = CLA.premierMandat(s), m1 = CLA.premierMandat(s + 1) - 1;
  const maires: Ligne[] = (await rpc('classement_maires', { m0, m1, lim: 5000 })) || [];
  const patr: Ligne[] = (await rpc('classement_patrimoine', { poids: POIDS, bonus: BONUS, c: null, lim: 5000 })) || [];
  // les robots animent la saison mais ne prennent ni podium ni plaque aux vrais joueurs (GDD § 5 quater)
  const robots = await idsRobots();
  const rM = CLA.classer(Object.fromEntries(maires.filter((r) => !robots.has(r.joueur)).map((r) => [r.joueur, Number(r.n)])));
  const rP = CLA.classer(Object.fromEntries(patr.filter((r) => !robots.has(r.joueur)).map((r) => [r.joueur, Number(r.n)])));
  const ps = await pseudos([...rM.slice(0, 10), ...rP.slice(0, 10)].map((r: Ligne) => r.qui));
  const top = (rows: Ligne[]) => rows.slice(0, 10).map((r) => ({ joueur: r.qui, pseudo: ps[r.qui] || null, n: r.n, rang: r.rang }));
  // le Maire de la saison : le plus de mandats, puis le plus récent (règles du jeu)
  const { data: lignes } = await admin.from('mairies').select('mandat, commune, maire').gte('mandat', m0).lte('mandat', m1).limit(20000);
  const parCommune: Record<string, Record<number, string[]>> = {};
  for (const l of (lignes || []) as Ligne[]) { const c = (parCommune[l.commune] = parCommune[l.commune] || {}); (c[Number(l.mandat)] = c[Number(l.mandat)] || []).push(l.maire); }
  const elus = Object.entries(parCommune).map(([k, pm]) => [k, CLA.maireDeSaison(CLA.mandatsDe(s).map((m: number) => (pm[m] || []).filter((q) => !robots.has(q))))] as [string, string | null]).filter(([, q]) => q);
  const psP = await pseudos(elus.map(([, q]) => q as string));
  const plaques = Object.fromEntries(elus.map(([k, q]) => [k, { joueur: q, pseudo: psP[q as string] || null }]));
  const places: Record<string, Ligne> = {};
  for (const r of rM) places[r.qui] = { joueur: r.qui, rm: r.rang, pm: r.n };
  for (const r of rP) places[r.qui] = Object.assign(places[r.qui] || { joueur: r.qui }, { rp: r.rang, pp: r.n });
  await rpc('jeu_saison_figer', { s, maires: top(rM), patrimoine: top(rP), plaques, joueurs: Object.values(places) });
  for (const x of Object.values(places)) await notifier(x.joueur, 'saison', `🏆 Fin de la saison ${numero} : tu finis ${x.rm ? ordinal(x.rm) : 'hors classement'} des Maires et ${x.rp ? ordinal(x.rp) : '—'} en patrimoine. Une nouvelle saison commence !`, { saison: s });
}
// la rareté des lieux (pour le classement de patrimoine) : posée par les règles du jeu, au plus 300 lieux à la fois
let raretesTenues = 0;
async function tenirRaretes(force = false) {
  if (!force && Date.now() - raretesTenues < 10000) return;
  raretesTenues = Date.now();
  const { data, error } = await admin.from('lieux').select('*').is('rarete', null).limit(300);
  if (error) throw error;
  if (!data || !data.length) return;
  await rpc('jeu_raretes', { ids: data.map((l: Ligne) => l.id), rs: data.map((l: Ligne) => R.rarete(lieuDe(l))) });
}

// ---------------------------------------------------------------- les monuments : prestige, pas revenu (GDD § 5 ter)
// L'entretien (le n-ième monument : 300 × 2^(n−1) par mois du jeu) est prélevé à chaque appel du joueur (s'il manque des
// pièces, ses loyers sont récoltés d'abord) ; ce qui manque devient une dette. Un monument est repris après un mois
// d'impayé (le plus cher) ou 14 jours sans venir (tous) : il retourne aux enchères dans un lot de reprise, et une alerte
// attend Gautier (table « alertes ») avec une phrase prête à poster.
const mesMonuments = async (j: string): Promise<Ligne[]> => ((await admin.from('lieux').select('id, label, type, depuis, citycode, city, proprietaire').eq('proprietaire', j).eq('type', 'monument')).data || []).map((l: Ligne): Ligne => ({ ...l, depuis: ms(l.depuis) }));
async function payerEntretien(j: string) {
  const jm = await jourMs(); let recolte = false;
  for (let essai = 0; essai < 3; essai++) {
    const { data: jr } = await admin.from('joueurs').select('pieces, dette, impaye_depuis, entretien_le').eq('id', j).maybeSingle();
    if (!jr) return;
    const t = Date.now(), le = ms(jr.entretien_le), mons = await mesMonuments(j), dette = Number(jr.dette || 0), impaye = jr.impaye_depuis ? ms(jr.impaye_depuis) : null;
    if (!mons.length) {
      if (dette > 0 || impaye != null || t - le > 60000) await rpc('jeu_entretien', { j, avant: jr.entretien_le, apres: new Date(t).toISOString(), paye: 0, reste: 0, impaye: null });
      return;
    }
    const d = MON.du(mons, le, t, jm);
    if (d.montant < 1 && dette <= 0) return;
    if (!recolte && Number(jr.pieces) < dette + d.montant) { recolte = true; await recolter(j).catch(() => {}); continue; }   // « prélevé sur les loyers »
    const r = MON.payer(Number(jr.pieces), dette, d.montant, impaye, t);
    const fait = await rpc('jeu_entretien', { j, avant: jr.entretien_le, apres: new Date(d.nouveauLe).toISOString(), paye: r.paye, reste: r.dette, impaye: r.impayeDepuis == null ? null : new Date(r.impayeDepuis).toISOString() });
    if (!fait) continue;
    if (impaye == null && r.impayeDepuis != null) {
      const x = mons.find((m: Ligne) => m.id === MON.plusCher(mons));
      await notifier(j, 'monument', `⚠️ Pas assez de pièces pour l’entretien de tes monuments (${fmt(MON.parMois(mons))} par mois). Après ${MON.M.impaye_jours} jours d’impayé, ${x ? x.label : 'le plus cher'} sera remis aux enchères.`, {});
    }
    return;
  }
}
// la date de fin d'une enchère, pour la phrase à poster
function dateEnchere(finMs: number, jm: number) {
  const f = new Date(finMs).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return jm >= 86_400_000 ? f : `${f} (serveur d’essai)`;
}
// reprendre un monument : il retourne aux enchères (cette semaine s'il reste au moins 3 jours, sinon la suivante)
async function reprendre(l: Ligne, raison: string, pourquoi: string) {
  const id = String(l.id).replace(/^mon:/, ''), m = LISTE_MON.find((x: Ligne) => x.id === id), jm = await jourMs(), { s, fin } = await semaineServeur();
  const assez = fin - Date.now() >= 3 * jm, sem = assez ? s : s + 1, finLot = assez ? fin : Regles.debutJour((s + 2) * 7, jm);
  const nom = l.label || (m && m.nom) || 'Un monument', commune = Regles.nomCommune(l.citycode || '', l.city || '');
  const lot = m ? { cle: `${sem}:R:${m.id}:${Date.now()}`, semaine: sem, rang: 10, palier: m.palier, monument: m.id, lieu: lieuMonument(m), depart: ENC.miseDepart(m), fin: new Date(finLot).toISOString() } : null;
  const alerte = { type: raison, monument: id, nom, commune, fin_enchere: lot ? lot.fin : null,
    texte: `🏛️ ${nom} (${commune}) est de nouveau libre dans CityDeck ! Enchères jusqu’au ${dateEnchere(finLot, jm)} : à vos pièces ! #CityDeck` };
  const p = await rpc('jeu_monument_reprendre', { l: l.id, raison, lot, alerte });
  if (p) await notifier(p, 'monument', `🏛️ ${nom} est remis aux enchères : ${pourquoi}.`, {});
}
// les absences et les impayés (au plus toutes les 30 s)
let monumentsTenus = 0;
async function tenirMonuments() {
  if (Date.now() - monumentsTenus < 30000) return;
  monumentsTenus = Date.now();
  const jm = await jourMs(), t = Date.now();
  // les absents qui ont des monuments : prévenus à 11 jours, repris à 14
  const { data: absents } = await admin.from('lieux').select('id, label, citycode, city, proprietaire, joueurs!inner(vu_le, averti_absence)').eq('type', 'monument')
    .lt('joueurs.vu_le', new Date(t - MON.M.absence_avertir_jours * jm).toISOString()).limit(200);
  const avertis = new Set<string>();
  for (const l of (absents || []) as Ligne[]) {
    const vu = ms(l.joueurs.vu_le), etat = MON.absence(vu, t, jm), jours = Math.floor((t - vu) / jm);
    if (etat === 'reprendre') await reprendre(l, 'absence', `tu n’es pas venu depuis ${jours} jours (${MON.M.absence_jours} au plus)`);
    else if (etat === 'avertir' && !l.joueurs.averti_absence && !avertis.has(l.proprietaire)) {
      avertis.add(l.proprietaire);
      await notifier(l.proprietaire, 'monument', `⏳ Tu n’es pas venu depuis ${jours} jours : à ${MON.M.absence_jours} jours d’absence, tes monuments sont remis aux enchères.`, {});
      await rpc('jeu_averti', { j: l.proprietaire, quoi: 'absence' });
    }
  }
  // les impayés : prévenus 7 jours avant, le plus cher repris après un mois
  const { data: impayes } = await admin.from('joueurs').select('id, impaye_depuis, averti_impaye').not('impaye_depuis', 'is', null)
    .lt('impaye_depuis', new Date(t - MON.M.impaye_avertir_jours * jm).toISOString()).limit(200);
  for (const jr of (impayes || []) as Ligne[]) {
    const mons = await mesMonuments(jr.id); if (!mons.length) continue;
    const x = mons.find((m: Ligne) => m.id === MON.plusCher(mons)), etat = MON.impaye(ms(jr.impaye_depuis), t, jm);
    if (!x) continue;
    if (etat === 'reprendre') await reprendre(x, 'impaye', `son entretien n’a pas été payé pendant ${MON.M.impaye_jours} jours`);
    else if (etat === 'avertir' && !jr.averti_impaye) {
      await notifier(jr.id, 'monument', `⏳ Entretien impayé : dans ${MON.joursAvantReprise(ms(jr.impaye_depuis), t, jm)} jours, ${x.label} sera remis aux enchères si tu n’as pas les pièces.`, {});
      await rpc('jeu_averti', { j: jr.id, quoi: 'impaye' });
    }
  }
}

// ---------------------------------------------------------------- les alertes par e-mail (GDD § 5 ter, supabase/sql/190_alertes_email.sql)
// « Gautier est prévenu (e-mail + tableau de bord) dès qu'un monument redevient libre » : l'horloge (toutes les 10 minutes)
// envoie les nouvelles alertes de monument à contact@citydeck.fr (redirigé vers sa boîte), toutes ensemble, une fois par
// heure au plus. Par Brevo : la clé SMTP (secret GitHub posé par Gautier) est donnée à la fonction par la publication ;
// sans elle, rien ne part. Les alertes « comptes » (anti-triche) restent dans le tableau de bord.
const ALERTES_EMAIL: Record<string, string> = {
  absence: `Monument repris : son propriétaire n’est pas venu depuis ${MON.M.absence_jours} jours`,
  impaye: `Monument repris : son entretien n’a pas été payé pendant ${MON.M.impaye_jours} jours`,
  sans_preneur: 'Lot de reprise sans preneur : il reviendra aux enchères',
};
let alertesTenues = 0;
async function envoyerAlertes() {
  const cle = Deno.env.get('BREVO_SMTP_KEY') || '';
  if (!cle || Date.now() - alertesTenues < 5 * 60000) return;
  alertesTenues = Date.now();
  const { data: recente } = await admin.from('alertes').select('id').gt('envoyee_le', new Date(Date.now() - 3_600_000).toISOString()).limit(1);
  if (recente && recente.length) return;   // un e-mail par heure au plus
  const { data, error } = await admin.from('alertes').select('id, type, monument, nom, commune, fin_enchere, texte').is('envoyee_le', null)
    .in('type', Object.keys(ALERTES_EMAIL)).order('cree_le').limit(30);
  if (error) throw error;
  if (!data || !data.length) return;
  const jm = await jourMs(), essai = jm < 86_400_000;
  const blocs = (data as Ligne[]).map((a) => [`${ALERTES_EMAIL[a.type]} :`, `${a.nom || a.monument || 'un monument'}${a.commune ? ` (${a.commune})` : ''}`,
    ...(a.fin_enchere ? [`Enchères jusqu’au ${dateEnchere(ms(a.fin_enchere), jm)}.`] : []), ...(a.texte ? ['À poster :', a.texte] : [])].join('\n'));
  const un = data.length === 1 ? (data[0] as Ligne) : null;
  const sujet = un ? (un.type === 'sans_preneur' ? `CityDeck : ${un.nom} attend un preneur` : `CityDeck : ${un.nom} est de nouveau libre`) : `CityDeck : ${data.length} alertes de monuments`;
  const texte = ['Bonjour,', '', un ? 'Une nouvelle alerte du jeu :' : `${data.length} nouvelles alertes du jeu :`, '', blocs.join('\n\n---\n\n'), '',
    ...(essai ? ['(Serveur d’essai : un jour du jeu dure une minute.)', ''] : []),
    'Toutes les alertes sont aussi dans le tableau de bord de Supabase (table « alertes »).', '— CityDeck'].join('\n');
  const conn = await Deno.connectTls({ hostname: 'smtp-relay.brevo.com', port: 465 });
  try {
    await envoyerSmtp(conn, { login: Deno.env.get('BREVO_SMTP_LOGIN') || 'bbfc16001@smtp-brevo.com', cle, de: 'noreply@citydeck.fr', nomDe: 'CityDeck',
      a: Deno.env.get('ALERTES_EMAIL') || 'contact@citydeck.fr', sujet, texte });
  } finally { try { conn.close(); } catch (_) { /* déjà fermée */ } }
  await rpc('jeu_alertes_envoyees', { ids: data.map((a: Ligne) => a.id) });
  console.log('alertes envoyées par e-mail :', data.length);
}

// ---------------------------------------------------------------- la chasse au trésor (GDD § 5 quinquies, supabase/sql/200_chasse.sql)
// Une chasse par heure (règles pures : src/regles/chasse.js) : la commune est tirée parmi data/chasse_communes.json, le départ
// est sa mairie, le trésor l'adresse (BAN) la plus proche d'un point tiré entre 500 m et 2 km du départ, dans la commune.
// On s'inscrit pendant l'annonce (et encore pendant la chasse) ; au départ, tous partent de la mairie. La position de chaque
// chasseur arrive toutes les 2 secondes : un saut plus rapide que la balade est refusé ; le premier à moins de 30 m du
// trésor gagne (jeu_chasse_gagner, une seule fois) : des pièces et une adresse tirée au hasard, comme une carte de pack.
const CH = Chasse.creer(ECO);
const isoT = (t: number) => new Date(t).toISOString();
const vueChasse = (c: Ligne): Ligne => ({ id: c.id, numero: Number(c.numero), commune: c.commune, depart: { lon: c.depart_lon, lat: c.depart_lat }, cible: c.cible,
  annonce: ms(c.annonce), debut: ms(c.debut), fin: ms(c.fin), gagnant: c.gagnant, trouve_le: c.trouve_le ? ms(c.trouve_le) : null });
// Paris, Lyon et Marseille : les adresses portent le code de l'arrondissement
function memeCommune(code: string, citycode: string) {
  if (code === '75056') return citycode.startsWith('751'); if (code === '69123') return citycode.startsWith('6938'); if (code === '13055') return citycode.startsWith('132');
  return citycode === code; }
async function preparerChasse(cr: Ligne, id: string, pour: string | null, essai = false): Promise<Ligne | null> {
  const k = CH.commune(CHASSE_COMMUNES as unknown as Ligne[], essai ? Math.floor(Math.random() * 1e9) : cr.numero); if (!k) return null;
  const depart = { lon: k[2], lat: k[3] }; let graine = (Chasse.hash(id + Math.random()) % 2147483646) + 1;
  const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  for (let essaiN = 0; essaiN < 8; essaiN++) {
    // une chasse d'essai (serveur d'essai) cache son trésor tout près : l'essai de la publication le rejoint en marchant
    const p = essai ? Chasse.decale(depart, alea() * 360, 120 + alea() * 80) : CH.pointCible(depart, alea);
    const j = await geoJSON(`reverse?lon=${p.lon.toFixed(6)}&lat=${p.lat.toFixed(6)}&index=address&limit=1`).catch(() => null) as Ligne | null;
    const f = j && j.features && j.features[0]; if (!f) continue; const pr = f.properties || {};
    if (!pr.housenumber || !pr.street || !memeCommune(k[0], String(pr.citycode || ''))) continue;
    const cible = { id: pr.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], numero: String(pr.housenumber), rue: pr.street, label: pr.name || `${pr.housenumber} ${pr.street}` };
    if (!essai && !CH.cibleValable(depart, cible)) continue;
    return { id, numero: cr.numero, commune: k[1], code_insee: k[0], depart_lon: depart.lon, depart_lat: depart.lat, cible, annonce: isoT(cr.annonce), debut: isoT(cr.debut), fin: isoT(cr.fin), pour };
  }
  return null; }
// la chasse de l'heure, préparée un quart d'heure avant son annonce (par l'horloge, ou au premier joueur qui regarde)
let chassesTenues = 0;
async function tenirChasses() {
  if (Date.now() - chassesTenues < 20000) return; chassesTenues = Date.now();
  const cr = CH.prochaine(Date.now()); if (!cr || Date.now() < cr.annonce - 15 * 60000) return;
  const id = 'c' + cr.numero, { data } = await admin.from('chasses').select('id').eq('id', id).maybeSingle(); if (data) return;
  const c = await preparerChasse(cr, id, null); if (!c) { console.error('chasse : pas de trésor trouvé pour', id); return; }
  await rpc('jeu_chasse_creer', { c });
  await rpc('jeu_chasses_purger', {}).catch((e) => console.error('chasses, purge', e));   // (une fois par heure)
}
// la chasse qui me concerne : ma chasse d'essai en cours, sinon la chasse publique annoncée, en cours ou juste finie
async function chasseDe(j: string): Promise<Ligne | null> {
  const t = Date.now(), { data } = await admin.from('chasses').select('*').or(`pour.is.null,pour.eq.${j}`).gt('fin', isoT(t - 3 * 60000)).lte('annonce', isoT(t)).order('debut', { ascending: false }).limit(4);
  const l = (data || []) as Ligne[]; return l.find((c) => c.pour === j) || l.find((c) => !c.pour) || null; }
async function profilsDe(ids: string[]) { if (!ids.length) return {} as Record<string, Ligne>; const { data } = await admin.from('profils').select('id, pseudo, avatar').in('id', ids); return Object.fromEntries((data || []).map((p: Ligne) => [p.id, p])); }
async function etatChasse(j: string, c: Ligne | null) {
  const t = Date.now(), cr = CH.prochaine(t);
  if (!c) return { chasse: null, prochaine: cr ? { annonce: cr.annonce, debut: cr.debut } : null, maintenant: t };
  const vue: Ligne = CH.vue(vueChasse(c), t);
  // lisible même à cent chasseurs : le nombre d'inscrits, et seulement les rivaux proches (400 m, 12 au plus, actifs depuis
  // une minute), du plus proche au plus loin ; le jeu les regroupe quand ils se touchent
  const [{ data: moiL }, { count }] = await Promise.all([
    admin.from('chasseurs').select('lon, lat').eq('chasse', c.id).eq('joueur', j).maybeSingle(),
    admin.from('chasseurs').select('joueur', { count: 'exact', head: true }).eq('chasse', c.id),
  ]);
  const moi = moiL as Ligne | null, ici = moi || { lon: c.depart_lon, lat: c.depart_lat }, dlat = 400 / 110540, dlon = 400 / (111320 * Math.cos(ici.lat * Math.PI / 180));
  const { data: pres } = await admin.from('chasseurs').select('joueur, lon, lat, le').eq('chasse', c.id).neq('joueur', j).gt('le', isoT(t - 60000))
    .gte('lon', ici.lon - dlon).lte('lon', ici.lon + dlon).gte('lat', ici.lat - dlat).lte('lat', ici.lat + dlat).limit(80);
  const proches: Ligne[] = ((pres || []) as Ligne[]).map((x): Ligne => ({ ...x, d: Chasse.distance(ici, x) })).filter((x) => x.d <= 400).sort((a, b) => a.d - b.d).slice(0, 12);
  const p = await profilsDe([...new Set([...proches.map((x) => x.joueur), c.gagnant].filter(Boolean))]);
  if (c.gagnant) vue.gagnant = { moi: c.gagnant === j, pseudo: (p[c.gagnant] || {}).pseudo || '?', avatar: (p[c.gagnant] || {}).avatar || '' };
  const autres = proches.map((x) => ({ pseudo: (p[x.joueur] || {}).pseudo || '?', avatar: (p[x.joueur] || {}).avatar || '', lon: x.lon, lat: x.lat }));
  return { chasse: vue, inscrits: count || 0, moi: moi ? { lon: moi.lon, lat: moi.lat } : null, autres, prochaine: cr ? { annonce: cr.annonce, debut: cr.debut } : null, maintenant: t };
}
ACTIONS.chasse = async (j) => { await tenirChasses().catch((e) => console.error('chasses', e)); return etatChasse(j, await chasseDe(j)); };
// s'inscrire : pendant l'annonce (ou la chasse) ; au départ, on est à la mairie
ACTIONS.chasse_rejoindre = async (j) => {
  const c = await chasseDe(j); if (!c) throw new Refus('chasse', 'Pas de chasse au trésor en ce moment.');
  const e = CH.etat(vueChasse(c), Date.now()); if (e !== 'annonce' && e !== 'en_cours') throw new Refus('chasse_finie', 'Cette chasse est finie : la prochaine arrive bientôt.');
  await joueur(j); await rpc('jeu_chasse_rejoindre', { c: c.id, j, lon: c.depart_lon, lat: c.depart_lat });
  return etatChasse(j, c);
};
// ma position (toutes les 2 secondes) : refusée si c'est un saut ; arrivé au trésor le premier, je gagne
ACTIONS.chasse_position = async (j, corps) => {
  const lon = Number(corps.lon), lat = Number(corps.lat); if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Refus('position', 'Position illisible.');
  const { data: c } = await admin.from('chasses').select('*').eq('id', String(corps.chasse || '')).maybeSingle();
  if (!c || (c.pour && c.pour !== j)) throw new Refus('chasse', 'Pas de chasse au trésor en ce moment.');
  const v = vueChasse(c), t = Date.now(), e = CH.etat(v, t);
  const { data: moi } = await admin.from('chasseurs').select('lon, lat, le').eq('chasse', c.id).eq('joueur', j).maybeSingle();
  if (!moi) throw new Refus('chasse_inscrire', 'Inscris-toi d’abord à la chasse.');
  let pos = { lon: moi.lon, lat: moi.lat }, refuse = false, gagne: Ligne | null = null;
  if (e === 'en_cours') {
    // le temps de marche compte depuis le départ de la chasse (pas depuis l'inscription)
    const avant = { lon: moi.lon, lat: moi.lat, le: Math.max(ms(moi.le), v.debut) };
    // au départ, le pion se pose sur la rue la plus proche de la mairie : ce premier pas n'est pas un saut
    const auDepart = moi.lon === c.depart_lon && moi.lat === c.depart_lat;
    if (CH.pasValide(avant, { lon, lat, le: t }) || (auDepart && Chasse.distance(avant, { lon, lat }) <= 150)) { if (await rpc('jeu_chasse_position', { c: c.id, j, lon, lat, avant: moi.le })) pos = { lon, lat }; }
    else refuse = true;
    if (!refuse && CH.arrive(pos, c.cible)) {
      const cartes = await TIRAGE.tirerPack(crypto.randomUUID() + ':chasse', ECO.pack.chances, CH.recompense.cartes).catch((err: unknown) => { console.error('chasse, carte', err); return []; });
      const lignes = cartes.map((x: Ligne) => ({ ...x, commune: Regles.nomCommune(x.citycode, x.city) }));
      const g: string[] | null = await rpc('jeu_chasse_gagner', { c: c.id, j, gain: CH.recompense.pieces, cartes: lignes });
      if (g) {
        if (g.length) await rpc('jeu_raretes', { ids: g, rs: g.map((id) => R.rarete(cartes.find((x: Ligne) => x.id === id))) }).catch((err) => console.error('raretés', err));
        const maintenant = Date.now();
        gagne = { pieces: CH.recompense.pieces, cartes: cartes.filter((x: Ligne) => g.includes(x.id)).map((x: Ligne) => ({ ...x, niveau: 0, depuis: maintenant })), tresor: c.cible.label };
        const nom = ((await profilsDe([j]))[j] || {}).pseudo || 'Un joueur';
        await notifier(j, 'chasse', `🏆 Tu as trouvé le trésor de ${c.commune} (${c.cible.label}) : +${fmt(CH.recompense.pieces)} et une carte !`, {});
        const { data: autres } = await admin.from('chasseurs').select('joueur').eq('chasse', c.id).neq('joueur', j).limit(200);
        for (const x of (autres || []) as Ligne[]) await notifier(x.joueur, 'chasse', `🗺️ ${nom} a trouvé le trésor de ${c.commune} : ${c.cible.label}.`, {}).catch(() => {});
      }
    }
  }
  const r: Ligne = await etatChasse(j, { ...c, ...(gagne ? { gagnant: j, trouve_le: isoT(Date.now()) } : {}) });
  return { ...r, position: pos, refuse, gagne, ...(gagne ? { etat: await etatDe(j) } : {}) };
};
// une chasse d'essai, rien que pour moi (serveur d'essai seulement) : elle part dans 20 secondes, son trésor est tout près
ACTIONS.chasse_essai = async (j) => {
  if ((await jourMs()) >= 86_400_000) throw new Refus('essai', 'Les chasses d’essai n’existent que sur le serveur d’essai.');
  const t = Date.now(), cr = { numero: -1, annonce: t, debut: t + 20000, fin: t + 20000 + CH.C.duree_max_minutes * 60000 }, id = 'essai-' + crypto.randomUUID();
  const c = await preparerChasse(cr, id, j, true); if (!c) throw new Refus('reseau', 'Pas de trésor trouvé : réessaie dans un instant.');
  await rpc('jeu_chasse_creer', { c });
  return { ...(await etatChasse(j, { ...c, gagnant: null, trouve_le: null })), cible: c.cible };   // (le trésor d'un essai n'est pas un secret : il sert à l'essai de la publication)
};

// ---------------------------------------------------------------- la boutique (GDD § 3 et § 9)
// Les gemmes achètent les packs (national, régional : les cartes tirées dans la région) et le Pass 15 jours (8 cartes au
// pack du jour, un bon d'adresse). Le paiement par carte viendra ; en attendant, des gemmes d'essai sur le serveur d'essai.
ACTIONS.acheter_pack = async (j, corps) => {
  const article = corps.article === 'pack_regional' ? 'pack_regional' : 'pack_national', jr = await joueur(j);
  if (!BOU.peutPayer(article, Number(jr.gemmes || 0))) throw new Refus('gemmes', REFUS_SQL.gemmes);
  if (await paysSansPacks(j)) throw new Refus('pays', 'Les packs ne sont pas vendus en Belgique ni aux Pays-Bas : le Pass et les offres restent possibles.');
  let zone = null;
  if (article === 'pack_regional') { const deps = (Regions.REGIONS as Record<string, string[]>)[String(corps.region || '')]; if (!deps) throw new Refus('region', 'Choisis une région.'); zone = { deps }; }
  const cartes = await TIRAGE.tirerPack(crypto.randomUUID(), ECO.pack.chances, BOU.B.pack_cartes, zone);
  if (!cartes.length) throw new Refus('vide', REFUS_SQL.vide);
  const lignes = cartes.map((c: Ligne) => ({ ...c, commune: Regles.nomCommune(c.citycode, c.city), rarete: R.rarete(c) }));
  const gagnes: string[] = await rpc('jeu_pack_achete', { j, article, prix: BOU.prix(article), cartes: lignes });
  const maintenant = Date.now();
  return { cartes: cartes.filter((c: Ligne) => gagnes.includes(c.id)).map((c: Ligne) => ({ ...c, niveau: 0, depuis: maintenant })), article };
};
ACTIONS.acheter_pass = async (j) => {
  const jm = await jourMs(), jr = await joueur(j);
  if (!BOU.peutPayer('pass', Number(jr.gemmes || 0))) throw new Refus('gemmes', REFUS_SQL.gemmes);
  const p = BOU.acheterPass({ fin: jr.pass_fin ? ms(jr.pass_fin) : null, bons: Number(jr.bons || 0) }, Date.now(), jm);
  await rpc('jeu_pass', { j, prix: BOU.prix('pass'), avant: jr.pass_fin, fin: new Date(p.fin).toISOString(), nbons: p.bons });
  return { pass: p };
};
// le bon : l'adresse est vérifiée auprès de la Base Adresse Nationale (son point redonne la même adresse) ; le serveur
// garde sa version, pas celle envoyée par le jeu
ACTIONS.prendre_bon = async (j, corps) => {
  const id = String(corps.id || ''), lon = Number(corps.lon), lat = Number(corps.lat);
  if (!id || !Number.isFinite(lon) || !Number.isFinite(lat)) throw new Refus('lieu', 'Adresse inconnue.');
  const a = await TIRAGE.adresseProche(lon, lat);
  if (!a || a.id !== id) throw new Refus('lieu', 'Cette adresse n’a pas été retrouvée : touche-la sur la carte.');
  const r = R.rarete(a), v = BOU.bonPermis(a, r, await estLibre(a));
  if (!v.ok) throw new Refus(v.raison, v.raison === 'pris' ? REFUS_SQL.pris : 'Un bon prend une adresse, jusqu’à Épique.');
  await rpc('jeu_bon', { j, lieu: { ...a, commune: Regles.nomCommune(a.citycode, a.city), rarete: r } });
  return { lieu: { ...a, niveau: 0, depuis: Date.now() } };
};
// ---------------------------------------------------------------- le paiement des gemmes par carte (Stripe Checkout, GDD § 9)
// Le jeu demande une page de paiement (paiement_creer) ; Stripe y renvoie le joueur ensuite. Le serveur ne croit jamais le
// jeu : il demande à Stripe si la session est payée (paiement_verifier, et à chaque passage du joueur tant qu'elle est
// ouverte) et seulement alors crédite les gemmes, une seule fois. La clé secrète est un secret de la fonction
// (STRIPE_SECRET_KEY, posé par la publication depuis le secret GitHub du même nom). Une clé de test (sk_test_) : de l'argent
// fictif (carte 4242 4242 4242 4242).
const cleStripe = () => Deno.env.get('STRIPE_SECRET_KEY') || '';
async function stripe(chemin: string, params?: Record<string, string>) {
  const cle = cleStripe(); if (!cle) throw new Refus('paiement', REFUS_SQL.paiement);
  const r = await fetch('https://api.stripe.com/v1/' + chemin, { method: params ? 'POST' : 'GET', headers: { Authorization: `Bearer ${cle}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: params ? new URLSearchParams(params).toString() : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('stripe', r.status, j && j.error && j.error.message); throw new Refus('paiement', 'Le paiement par carte ne répond pas : réessaie dans un instant.'); }
  return j;
}
// l'adresse où Stripe renvoie le joueur : le jeu publié (ou l'outil d'essai), jamais un autre site
function adresseRetour(retour: unknown) {
  const u = String(retour || '').split('?')[0].split('#')[0];
  return ORIGINES.some((o) => u === o || u.startsWith(o + '/')) ? u : 'https://citydeck.fr/';
}
ACTIONS.paiement_creer = async (j, corps) => {
  const o = (BOU.B.gemmes as Ligne[]).find((x) => x.id === String(corps.offre || ''));
  if (!o) throw new Refus('offre', 'Cette offre de gemmes n’existe pas.');
  if (corps.renonce !== true) throw new Refus('renonce', 'Coche la case : tu demandes à recevoir tes gemmes tout de suite.');
  const centimes = Math.round(Number(o.euros) * 100), retour = adresseRetour(corps.retour), test = /^(sk|rk)_test_/.test(cleStripe());
  const s = await stripe('checkout/sessions', {
    mode: 'payment', locale: 'fr', client_reference_id: j,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'eur', 'line_items[0][price_data][unit_amount]': String(centimes),
    'line_items[0][price_data][product_data][name]': `${nb(o.gemmes)} gemmes CityDeck`,
    'line_items[0][price_data][product_data][description]': 'Monnaie du jeu CityDeck, sans valeur monétaire : elle ne se revend pas et ne s’échange ni contre de l’argent ni contre des pièces.',
    'metadata[joueur]': j, 'metadata[offre]': o.id, 'payment_intent_data[metadata][joueur]': j,
    success_url: `${retour}?paiement={CHECKOUT_SESSION_ID}`, cancel_url: `${retour}?paiement=annule`,
  });
  await rpc('jeu_paiement_noter', { s: s.id, j, offre: o.id, gemmes: o.gemmes, centimes, renonce: true, test });
  return { url: s.url, session: s.id, test };
};
// vérifier auprès de Stripe les sessions ouvertes d'un joueur (des deux derniers jours) ; rend les gemmes créditées
async function verifierPaiements(j: string, seule?: string) {
  if (!cleStripe()) return [];
  let q = admin.from('paiements').select('session').eq('joueur', j).eq('statut', 'ouvert').gte('cree_le', new Date(Date.now() - 2 * 86400000).toISOString());
  if (seule) q = q.eq('session', seule);
  const { data } = await q.limit(5); const credites: Ligne[] = [];
  for (const p of (data || []) as Ligne[]) {
    const s = await stripe('checkout/sessions/' + encodeURIComponent(p.session));
    if ((s.metadata || {}).joueur !== j) continue;
    if (s.payment_status === 'paid') {
      const pays = (s.customer_details && s.customer_details.address && s.customer_details.address.country) || null;
      const g = Number(await rpc('jeu_paiement_crediter', { s: p.session, pays }));
      if (g > 0) { credites.push({ session: p.session, gemmes: g }); await notifier(j, 'boutique', `💎 +${nb(g)} gemmes : merci pour ton achat !`, {}); }
    } else if (s.status === 'expired') await rpc('jeu_paiement_expirer', { s: p.session });
  }
  return credites;
}
// à chaque passage, au plus toutes les 2 minutes par joueur, s'il a une session ouverte
const paiementsVus = new Map<string, number>();
async function verifierPaiementsSiBesoin(j: string) {
  if (!cleStripe() || Date.now() - (paiementsVus.get(j) || 0) < 120000) return;
  paiementsVus.set(j, Date.now());
  const { count } = await admin.from('paiements').select('session', { count: 'exact', head: true }).eq('joueur', j).eq('statut', 'ouvert');
  if (count) await verifierPaiements(j);
}
ACTIONS.paiement_verifier = async (j, corps) => ({ credites: await verifierPaiements(j, corps.session ? String(corps.session) : undefined) });
// les packs ne sont pas vendus en Belgique ni aux Pays-Bas (loot boxes) : d'après le pays de la carte des achats de gemmes
async function paysSansPacks(j: string) {
  const { count } = await admin.from('paiements').select('session', { count: 'exact', head: true }).eq('joueur', j).eq('statut', 'paye').in('pays', ['BE', 'NL']);
  return !!count;
}
// supprimer son compte (RGPD, 5 nov. 2026) : le compte et tout ce qui s'y rattache partent (partie, offres, mises,
// versements, journaux) ; ses lieux redeviennent libres (« patrimoine remis en jeu »). Il faut écrire SUPPRIMER pour confirmer.
// Les paiements restent connus de Stripe (factures).
ACTIONS.supprimer_compte = async (j, corps) => {
  if (String(corps.confirmer || '').trim().toUpperCase() !== 'SUPPRIMER') throw new Refus('confirmer', 'Écris SUPPRIMER pour confirmer.');
  if ((await idsRobots()).has(j)) throw new Refus('robot', 'Ce compte ne peut pas être supprimé ainsi.');
  const { error } = await admin.auth.admin.deleteUser(j);
  if (error) throw error;
  return { supprime: true };
};
ACTIONS.gemmes_essai = async (j) => ({ gemmes: Number(await rpc('jeu_gemmes_essai', { j, n: BOU.B.gemmes_essai })) });

// ouvrir le pack du jour : le serveur tire au hasard (graine secrète), une fois par jour
ACTIONS.pack = async (j) => {
  const jm = await jourMs(), jour = Regles.jourDuJeu(Date.now(), jm), jr = await joueur(j);
  if (jr.dernier_jour != null && Number(jr.dernier_jour) >= jour) throw new Refus('deja', REFUS_SQL.deja);
  const cartes = await TIRAGE.tirerPack(crypto.randomUUID() + ':' + jour, ECO.pack.chances, BOU.cartesDuJour({ fin: jr.pass_fin ? ms(jr.pass_fin) : null }, Date.now()));
  if (!cartes.length) throw new Refus('reseau', 'Pack impossible à tirer pour l’instant : réessaie dans un instant.');
  await recolter(j);   // les loyers d'avant sont encaissés : les nouveaux lieux comptent à partir de maintenant
  const lignes = cartes.map((c: Ligne) => ({ ...c, commune: Regles.nomCommune(c.citycode, c.city) }));
  const gagnes: string[] = await rpc('jeu_pack', { j, jour, cartes: lignes });
  // la rareté des lieux gagnés, tout de suite (classement de patrimoine)
  if (gagnes.length) await rpc('jeu_raretes', { ids: gagnes, rs: gagnes.map((id) => R.rarete(cartes.find((c: Ligne) => c.id === id))) }).catch((e) => console.error('raretés', e));
  const maintenant = Date.now();
  return {
    cartes: cartes.filter((c: Ligne) => gagnes.includes(c.id)).map((c: Ligne) => ({ ...c, niveau: 0, depuis: maintenant })),
    dernierJour: jour,
  };
};

// ---------------------------------------------------------------- la valeur de marché (décision de Gautier, 3 nov.)
// indice d'un lieu = (1 + ventes de sa commune) × (1 + activité de son quartier) × (1 + tendance de la semaine)
const FLUCT = (ECO as Ligne).fluctuation;
async function indicesMarche(lieux: Ligne[]): Promise<Record<string, number>> {
  if (!lieux.length) return {};
  const jm = await jourMs(), maintenant = Date.now(), semaine = Math.floor(Regles.jourDuJeu(maintenant, jm) / 7);
  const communes = [...new Set(lieux.map((l) => l.commune).filter(Boolean))], depuis = new Date(maintenant - FLUCT.fenetre_jours * jm).toISOString();
  const [m, q] = await Promise.all([
    admin.rpc('marche_communes', { communes, depuis }),
    admin.rpc('quartiers', { pts: lieux.slice(0, 500).map((l) => ({ id: l.id, lon: l.lon, lat: l.lat })), dlat: FLUCT.quartier.rayon_m / 111000, dlon: FLUCT.quartier.rayon_m / 76000 }),
  ]);
  const parCommune: Record<string, number> = {}; for (const r of (m.data || []) as Ligne[]) parCommune[r.commune] = R.indiceCommune([{ prix: Number(r.ratio), valeurRef: 1 }]);
  const parLieu: Record<string, number> = {}; for (const r of (q.data || []) as Ligne[]) parLieu[r.id] = R.indiceQuartier(Number(r.points));
  return Object.fromEntries(lieux.map((l) => [l.id, R.indice({ commune: parCommune[l.commune] || 0, quartier: parLieu[l.id] ?? 0, tendance: R.tendance(Regles.departement(l.citycode), semaine) })]));
}

// ---------------------------------------------------------------- les joueurs robots (serveur d'essai)
// les vendeurs qui ont un pseudo (vrais joueurs) ; les joueurs jetables de l'essai n'en ont pas
async function connaitreVrais(lieux: Ligne[], vrais: Set<string>) {
  const manque = [...new Set(lieux.map((l) => l.proprietaire))].filter((u) => !vrais.has(u)); if (!manque.length) return;
  const { data } = await admin.from('profils').select('id').in('id', manque); for (const p of data || []) vrais.add(p.id);
  for (let i = lieux.length - 1; i >= 0; i--) if (!vrais.has(lieux[i].proprietaire)) lieux.splice(i, 1);
}
// Demande de Gautier (3 nov. 2026) : de vrais comptes qui jouent seuls, pour tester le marché et les mairies.
// Un tour au plus toutes les 20 s (quel que soit le nombre de joueurs), lancé après la réponse à un vrai joueur.
const hasard = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const arrondi = (n: number) => Math.max(50, Math.round(n / 50) * 50);
// Les joueurs de la maison (GDD § 5 quater ; Gautier, 5 nov. : « les laisser au début du jeu, leur donner des consignes
// pour jouer comme des humains et ne pas abuser ; on les retirera progressivement avec la montée des joueurs »). Les règles
// sont dans src/regles/robots.js (ROB) :
// - combien jouent : selon les vrais joueurs venus dans les 7 derniers jours ; les autres se retirent (leurs lieux en vente
//   à leur valeur, puis rendus libres au bout de 14 jours) ;
// - quand : à leurs heures (2 à 4 séances par jour, entre 8 h et 23 h ; sur le serveur d'essai accéléré, à chaque tour) ;
// - quoi : une ou deux choses par séance, des réponses qui prennent du temps, jamais d'abus (pas d'achat d'une erreur de
//   prix, pas de mise au dernier moment, pas de mairie disputée à un vrai joueur, 30 lieux au plus, 3 par commune).
async function robotsTour() {
  if (!(await rpc('jeu_robots_tour', { intervalle: 30 }))) return;
  const { data: robots } = await admin.from('robots').select('id, nom, cree_le, retire_le').order('cree_le'); if (!robots || !robots.length) return;
  const ids = robots.map((r: Ligne) => r.id), exclus = `(${ids.join(',')})`;
  const jm = await jourMs(), accelere = jm < 3_600_000, jour = Regles.jourDuJeu(Date.now(), jm), heure = 24 * (Date.now() - Regles.debutJour(jour, jm)) / jm;
  const heuresMs = (h: number) => h * jm / 24;
  const humains = Number(await rpc('jeu_humains_actifs', { depuis: new Date(Date.now() - 7 * jm).toISOString() })) || 0;
  const nActifs = ROB.nombreActifs(humains), actifs = robots.slice(0, nActifs), retires = robots.slice(nActifs);
  // ceux qui se retirent : leurs lieux en vente à leur valeur, puis libres au bout de 14 jours ; ceux qui reviennent
  for (const r of actifs) if (r.retire_le) await rpc('jeu_robot_retraite', { j: r.id, actif: true }).catch(() => {});
  for (const r of retires) {
    try {
      const depuis = r.retire_le ? new Date(r.retire_le).getTime() : (await rpc('jeu_robot_retraite', { j: r.id, actif: false }), Date.now());
      if (Date.now() - depuis >= ROB.C.liberation_jours * jm) { await rpc('jeu_robot_liberer', { j: r.id }); continue; }
      const { data: siens } = await admin.from('lieux').select('*').eq('proprietaire', r.id).is('prix_vente', null).limit(30);
      for (const l of siens || []) await rpc('jeu_vendre', { j: r.id, l: l.id, prix: arrondi(R.valeur(lieuDe(l))), devise: 'pieces' }).catch(() => {});
    } catch (e) { console.error('robot retiré', r.nom, e); }
  }
  const enJeu = actifs.filter((r: Ligne) => ROB.enSeance(r.id, jour, heure, accelere));
  if (!enJeu.length) return;
  const { data: tous } = await admin.from('lieux').select('*').not('proprietaire', 'in', exclus).order('maj', { ascending: false }).limit(300);
  // seulement les vrais joueurs (avec un pseudo) : pas les joueurs jetables de l'essai automatique
  const proprios = [...new Set((tous || []).map((l: Ligne) => l.proprietaire))];
  const { data: avecPseudo } = proprios.length ? await admin.from('profils').select('id').in('id', proprios) : { data: [] };
  const vrais = new Set((avecPseudo || []).map((p: Ligne) => p.id)), reels = (tous || []).filter((l: Ligne) => vrais.has(l.proprietaire));
  if (!reels.length) return;   // personne à côtoyer : les robots attendent un vrai joueur
  // tout ce que les vrais joueurs vendent (pas seulement leurs derniers lieux)
  const { data: ventes } = await admin.from('lieux').select('*').not('proprietaire', 'in', exclus).not('prix_vente', 'is', null).limit(200);
  const aVendre = (ventes || []).slice();
  await connaitreVrais(aVendre, vrais);
  const { data: lieuxRobots } = await admin.from('lieux').select('*').in('proprietaire', ids);
  const indices = await indicesMarche([...reels, ...aVendre, ...(lieuxRobots || [])].filter((l, i, t) => t.findIndex((x) => x.id === l.id) === i));
  const valeurM = (l: Ligne) => Math.round(R.valeur(lieuDe(l)) * (indices[l.id] || 1));
  const vieux = (h: number) => new Date(Date.now() - heuresMs(h)).toISOString();
  for (const robot of enJeu.sort(() => Math.random() - 0.5).slice(0, 3)) {
    const j = robot.id;
    try {
      // il passe, comme un joueur : il récolte, paie l'entretien, est vu
      await recolter(j); await payerEntretien(j).catch(() => {}); await rpc('jeu_vu', { j }).catch(() => {});
      const mes = (await admin.from('lieux').select('*').eq('proprietaire', j)).data || [];
      const jr = await joueur(j); let pieces = Number(jr.pieces);
      // il répond aux offres et aux échanges qu'il a eu le temps de lire (de 15 min à 6 h), au-dessus de la valeur seulement
      const { data: recues } = await admin.from('offres').select('*').eq('vendeur', j).eq('statut', 'attente').lt('cree_le', vieux(ROB.C.reponse_heures_min));
      for (const o of recues || []) {
        if (Date.now() - new Date(o.cree_le).getTime() < heuresMs(ROB.delaiReponse(o.id))) continue;
        // jamais de gemmes avec un robot : une offre en gemmes est refusée (Gautier, 5 nov.)
        const l = mes.find((x: Ligne) => x.id === o.lieu);
        await ACTIONS.repondre_offre(j, { offre: o.id, accepter: !!l && ROB.devisePermise(o.devise) && ROB.accepte(Number(o.prix), valeurM(l)) }).catch(() => {});
      }
      const { data: echRecus } = await admin.from('echanges').select('*').eq('destinataire', j).eq('statut', 'attente').lt('cree_le', vieux(ROB.C.reponse_heures_min));
      for (const x of echRecus || []) {
        if (Date.now() - new Date(x.cree_le).getTime() < heuresMs(ROB.delaiReponse(x.id))) continue;
        const sien = mes.find((l: Ligne) => l.id === x.lieu), { data: dons } = await admin.from('lieux').select('*').in('id', x.donnes);
        const donne = (dons || []).reduce((t: number, l: Ligne) => t + valeurM(l), 0) + Number(x.ajout);
        await ACTIONS.repondre_echange(j, { echange: x.id, accepter: !!sien && ROB.accepte(donne, valeurM(sien)) }).catch(() => {});
      }
      // puis une ou deux choses, comme un joueur pendant une séance
      const choses: (() => Promise<void>)[] = [
        // un lieu de plus, près d'un lieu d'un vrai joueur (une fois par jour du jeu ; 30 au plus, 3 par commune)
        async () => {
          const r = hasard(reels), lon = r.lon + (Math.random() - 0.5) * 0.006, lat = r.lat + (Math.random() - 0.5) * 0.004;
          const c = await TIRAGE.adresseProche(lon, lat); if (!c || !(await estLibre(c))) return;
          const commune = Regles.nomCommune(c.citycode, c.city);
          if (!ROB.peutPrendre(mes.length, mes.filter((l: Ligne) => l.commune === commune).length)) return;
          try { await rpc('jeu_pack', { j, jour, cartes: [{ ...c, commune }] }); } catch (_) { /* déjà pris aujourd'hui */ }
        },
        // une offre correcte (90 à 125 % de la valeur) sur un lieu d'un vrai joueur, une seule en attente à la fois
        async () => {
          const { count } = await admin.from('offres').select('id', { count: 'exact', head: true }).eq('acheteur', j).eq('statut', 'attente'); if (count) return;
          const l = hasard(reels), prix = arrondi(ROB.prixOffre(valeurM(l), j + l.id + jour));
          if (prix <= pieces) await ACTIONS.offrir(j, { id: l.id, prix }).catch(() => {});
        },
        // une proposition d'échange : un ou deux de ses lieux, plus des pièces, pour 100 à 125 % de la valeur voulue
        async () => {
          const { count } = await admin.from('echanges').select('id', { count: 'exact', head: true }).eq('proposeur', j).eq('statut', 'attente'); if (count || !mes.length) return;
          const l = hasard(reels), dons = mes.slice().sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
          const v = dons.reduce((t: number, d: Ligne) => t + valeurM(d), 0), cible = valeurM(l) * (1 + Math.random() * 0.25), ajout = v < cible ? arrondi(cible - v) : 0;
          if (ajout <= pieces) await ACTIONS.echanger(j, { id: l.id, donnes: dons.map((d: Ligne) => d.id), ajout }).catch(() => {});
        },
        // acheter un lieu mis en vente par un vrai joueur, à un prix normal (jamais une erreur de prix : elle reste aux joueurs)
        async () => {
          const enVente = aVendre.filter((l: Ligne) => ROB.devisePermise(l.devise_vente) && ROB.peutAcheter(Number(l.prix_vente), valeurM(l)) && Number(l.prix_vente) <= pieces);
          if (!enVente.length || !ROB.peutPrendre(mes.length, 0)) return;
          const l = hasard(enVente); aVendre.splice(aVendre.indexOf(l), 1);
          await ACTIONS.acheter(j, { id: l.id, prix: Number(l.prix_vente) }).then(() => { pieces -= Number(l.prix_vente); }).catch(() => {});
        },
        // mettre un de ses lieux en vente (105 à 140 % de sa valeur), deux au plus à la fois
        async () => {
          if (!mes.length || mes.filter((l: Ligne) => l.prix_vente != null).length >= 2) return;
          const l = hasard(mes); await rpc('jeu_vendre', { j, l: l.id, prix: arrondi(ROB.prixVente(valeurM(l), j + l.id + jour)), devise: 'pieces' }).catch(() => {});
        },
        // les enchères : seulement contre un vrai joueur qui mène, deux mises au plus par lot, jamais dans la dernière heure,
        // jusqu'à 120 % de la mise de départ (les monuments restent aux vrais joueurs s'ils y tiennent)
        async () => {
          const { data: lots } = await admin.from('encheres').select('cle, depart, fin').eq('statut', 'ouverte').gt('fin', new Date().toISOString());
          for (const l of (lots || []).sort(() => Math.random() - 0.5)) {
            const { data: top } = await admin.from('mises').select('joueur, montant').eq('lot', l.cle).order('montant', { ascending: false }).order('id', { ascending: true }).limit(1);
            const t = top && top[0]; if (!t || ids.includes(t.joueur)) continue;
            const { data: humain } = await admin.from('profils').select('id').eq('id', t.joueur).maybeSingle(); if (!humain) continue;
            const { count: miennes } = await admin.from('mises').select('id', { count: 'exact', head: true }).eq('lot', l.cle).eq('joueur', j);
            const m = ROB.mise(Number(l.depart), Number(t.montant), (new Date(l.fin).getTime() - Date.now()) / heuresMs(1), Number(miennes) || 0, ECO.encheres.pas_min);
            if (m != null && m <= pieces) { await ACTIONS.miser(j, { cle: l.cle, montant: m }).catch(() => {}); break; }
          }
        },
        // verser à la caisse d'une de ses communes, seulement si aucun vrai joueur n'y a versé ce mandat
        async () => {
          if (!mes.length) return;
          const k = hasard(mes).commune, montant = Math.min(Math.floor(pieces * 0.15 / 10) * 10, 50 + Math.floor(Math.random() * 30) * 10);
          if (!k || montant < MAI.M.versement_min) return;
          const { m } = await mandatServeur(); const { data: cours } = await admin.from('caisses').select('joueur, verse').eq('mandat', m).eq('commune', k);
          const humainsVerses = (cours || []).filter((r: Ligne) => !ids.includes(r.joueur)).reduce((t: number, r: Ligne) => t + Number(r.verse), 0);
          if (ROB.peutVerser(humainsVerses)) await ACTIONS.verser(j, { commune: k, montant }).then(() => { pieces -= montant; }).catch(() => {});
        },
        // construire le niveau suivant quand c'est possible
        async () => {
          if (!mes.length) return;
          const l = lieuDe(hasard(mes)), n = (l.niveau || 0) + 1;
          if (R.peutConstruire(l, n) && R.coutNiveau(l, n) <= pieces) await ACTIONS.construire(j, { id: l.id, niveau: n }).catch(() => {});
        },
      ];
      const nb = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (const f of choses.sort(() => Math.random() - 0.5).slice(0, nb)) await f();
    } catch (e) { console.error('robot', robot.nom, e); }
  }
}

Deno.serve(async (req: Request) => {
  const h = enTetes(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const repondre = (corps: Ligne, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: h });
  try {
    const jeton = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    // l'horloge (toutes les 10 minutes) : le monde tourne sans joueur
    if (await estHorloge(jeton)) {
      const c = await req.json().catch(() => ({}));
      if (c.action !== 'horloge') throw new Refus('action', 'Action inconnue.');
      return repondre({ ok: true, ...(await tic()) });
    }
    const { data, error } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null }, error: null };
    if (error || !data.user) throw new Refus('non_connecte', 'Connecte-toi pour jouer.');
    const corps = await req.json().catch(() => ({}));
    const action = ACTIONS[String(corps.action || '')];
    if (!action) throw new Refus('action', 'Action inconnue.');
    // la cadence : pas plus de N actions par minute pour un compte (un programme qui joue à sa place, un bouton martelé) ;
    // au-delà, refusé, rien n'est perdu (une panne du compteur ne bloque pas le jeu)
    const cadence = await rpc('jeu_cadence', { j: data.user.id, limite: ECO.anti_triche.actions_par_minute }).catch((e) => { console.error('cadence', e); return true; });
    if (cadence === false) throw new Refus('cadence', 'Doucement : trop d’actions d’un coup. Réessaie dans une minute.');
    await noterEmpreinte(data.user.id, req).catch((e) => console.error('empreinte', e));
    // la chasse au trésor (une position toutes les 2 secondes) passe vite : ni tour du monde ni partie recalculée
    if (corps.action === 'chasse_position' || corps.action === 'chasse') return repondre({ ok: true, ...(await action(data.user.id, corps)) });
    // le calendrier des enchères (lots finis clos, lots de la semaine ouverts) : une panne ici ne bloque pas le jeu
    await tenirEncheres().catch((e) => console.error('enchères', e));
    // ma visite (un Maire absent depuis trop longtemps perd le titre) ; les fins de mandat de Maire à annoncer
    if (corps.action !== 'supprimer_compte') await rpc('jeu_vu', { j: data.user.id }).catch((e) => console.error('visite', e));
    await tenirMairies().catch((e) => console.error('mairies', e));
    await tenirRaretes().catch((e) => console.error('raretés', e));
    await payerEntretien(data.user.id).catch((e) => console.error('entretien', e));
    await verifierPaiementsSiBesoin(data.user.id).catch((e) => console.error('paiements', e));
    await tenirMonuments().catch((e) => console.error('monuments', e));
    const res = await action(data.user.id, corps);
    // les robots jouent un tour après la réponse (sans faire attendre le vrai joueur)
    const runtime = (globalThis as Ligne).EdgeRuntime; if (runtime && runtime.waitUntil) runtime.waitUntil(robotsTour().catch((e) => console.error('robots', e)));
    // après une action qui change la partie, sa partie à jour (pièces, lieux, récolte) pour que le jeu se recale
    if (corps.action !== 'etat' && corps.action !== 'encheres' && corps.action !== 'supprimer_compte') res.etat = await etatDe(data.user.id);
    return repondre({ ok: true, ...res });
  } catch (e) {
    if (e instanceof Refus) return repondre({ ok: false, code: e.code, message: e.message });
    console.error(e);
    // le détail (technique, jamais une clé) aide à comprendre une panne ; le joueur ne voit que le message
    const detail = String((e && ((e as Ligne).message || (e as Ligne).details || (e as Ligne).code)) || e).slice(0, 200);
    return repondre({ ok: false, code: 'erreur', message: 'Le serveur a eu un souci : réessaie dans un instant.', detail }, 500);
  }
});
