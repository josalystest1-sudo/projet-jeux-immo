// La fonction « jeu » : le seul endroit qui modifie la partie d'un joueur (phase 8 : le vrai serveur).
// Le jeu (navigateur) l'appelle avec { action, ... } et le jeton du joueur connecté ; elle applique les MÊMES règles
// que le jeu (src/regles, recopiées dans _genere/ par tools/serveur_prepare.js), puis écrit par les fonctions SQL
// jeu_* (supabase/sql/010_jeu.sql), chacune atomique. Réponse : { ok: true, ... } ou { ok: false, code, message }.
import { createClient } from '@supabase/supabase-js';
import { Regles, Pack, Celebres, Tirage } from './_genere/regles.mjs';
import { ECO, STANDING, FRANCE, DEPARTEMENTS, CELEBRES } from './_genere/donnees.mjs';

const R = Regles.creer(ECO, STANDING);

// la clé secrète du projet est donnée par Supabase à la fonction (jamais écrite dans le dépôt)
function cleSecrete(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; if (k) return k; } catch (_) { /* ancienne clé */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const admin = createClient(Deno.env.get('SUPABASE_URL') || '', cleSecrete(), { auth: { persistSession: false, autoRefreshToken: false } });

// le jeu publié, et l'outil de captures ; un autre site ne peut pas appeler la fonction depuis un navigateur
const ORIGINES = ['https://josalystest1-sudo.github.io', 'http://jeu.local', 'http://localhost:8000'];
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
  if (l.prix_vente != null) { a.enVente = true; a.prixVente = Number(l.prix_vente); }
  return a;
}
async function joueur(j: string) {
  await rpc('jeu_nouveau_joueur', { j, depart: ECO.solde_depart });
  const { data, error } = await admin.from('joueurs').select('pieces, encaisse, dernier_jour').eq('id', j).single();
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
};
async function rpc(nom: string, args: Ligne) {
  const { data, error } = await admin.rpc(nom, args);
  if (error) { const m = String(error.message || '').trim(); if (REFUS_SQL[m]) throw new Refus(m, REFUS_SQL[m]); throw error; }
  return data;
}

// ---------------------------------------------------------------- les actions
// récolter : salaire + loyers depuis la dernière récolte, 24 h de stock au plus (mêmes règles que le jeu)
async function recolter(j: string) {
  for (let essai = 0; essai < 3; essai++) {
    const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now();
    const montant = R.aEncaisser(lieux, ms(jr.encaisse), maintenant, await jourMs());
    if (montant < 1) return { recolte: 0, pieces: Number(jr.pieces) };
    const p = await rpc('jeu_recolter', { j, montant, avant: jr.encaisse, maintenant: new Date(maintenant).toISOString() });
    if (p != null) return { recolte: montant, pieces: Number(p) };
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
  Celebres, Pack, rarete: (l: Ligne) => R.rarete(l), estLibre,
});

// ma partie : pièces, lieux, ce qui attend d'être récolté (rendue aussi après chaque action : le jeu se recale dessus)
async function etatDe(j: string) {
  const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now(), jm = await jourMs();
  const [offres, echanges, notifs] = await Promise.all([mesOffres(j), mesEchanges(j), mesNotifs(j)]);
  return {
    pieces: Number(jr.pieces), encaisse: ms(jr.encaisse), dernierJour: jr.dernier_jour == null ? null : Number(jr.dernier_jour), jour: Regles.jourDuJeu(maintenant, jm),
    lieux, maintenant, aRecolter: R.aEncaisser(lieux, ms(jr.encaisse), maintenant, jm), jourMs: jm, ...offres, ...echanges, notifs,
  };
}
// mes offres reçues et envoyées (en attente, et les dernières réglées), avec le lieu et l'autre joueur
async function mesOffres(j: string) {
  const { data, error } = await admin.from('offres').select('id, lieu, acheteur, vendeur, prix, statut, cree_le, maj, lieux(label, lon, lat, citycode, city, type, notoriete, cat, qid, niveau)')
    .or(`acheteur.eq.${j},vendeur.eq.${j}`).order('maj', { ascending: false }).limit(60);
  if (error) throw error;
  const noms = await pseudos((data || []).flatMap((o: Ligne) => [o.acheteur, o.vendeur]));
  const recues: Ligne[] = [], envoyees: Ligne[] = [];
  for (const o of data || []) {
    const base = { id: String(o.id), addrId: o.lieu, price: Number(o.prix), status: o.statut, ts: ms(o.cree_le) };
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
const notifier = (j: string, type: string, texte: string, donnees: Ligne = {}) => rpc('jeu_notifier', { j, type, texte, donnees });
async function lieuEnBase(id: string) { const { data, error } = await admin.from('lieux').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; }
function prixLu(p: unknown) { const r = R.lirePrix(String(p ?? '')); if (!r.ok) throw new Refus('prix', 'Tape un prix en pièces (un nombre entier).'); return r.prix as number; }
// les autres offres en attente sur un lieu qui vient de changer de main : prévenir leurs auteurs
async function offresEnAttente(l: string) { const { data } = await admin.from('offres').select('id, acheteur').eq('lieu', l).eq('statut', 'attente'); return data || []; }
async function prevenirCaduques(avant: Ligne[], garder: string | null, label: string) {
  for (const o of avant) if (String(o.id) !== garder) await notifier(o.acheteur, 'offre', `${label} a été vendu à quelqu’un d’autre : ton offre est annulée.`, { lieu: null });
}
// le changement de propriétaire : les loyers de chacun sont encaissés avant (personne ne perd ce qui a poussé)
async function transferer(l: Ligne, acheteur: string, prix: number, prixAttendu: number | null, offre: string | null) {
  await recolter(acheteur); await recolter(l.proprietaire);
  const autres = await offresEnAttente(l.id);
  const pieces = await rpc('jeu_transferer', { l: l.id, vendeur: l.proprietaire, acheteur, prix, prix_attendu: prixAttendu, offre: offre ? Number(offre) : null, valeur_ref: R.valeur(lieuDe(l)) });
  await prevenirCaduques(autres, offre, l.label);
  return Number(pieces);
}

ACTIONS.vendre = async (j, corps) => { await rpc('jeu_vendre', { j, l: String(corps.id || ''), prix: prixLu(corps.prix) }); return {}; };
ACTIONS.retirer = async (j, corps) => { await rpc('jeu_vendre', { j, l: String(corps.id || ''), prix: null }); return {}; };
// acheter un lieu en vente, au prix affiché (si le vendeur l'a changé entre-temps : refus, on montre le nouveau)
ACTIONS.acheter = async (j, corps) => {
  const l = await lieuEnBase(String(corps.id || ''));
  if (!l) throw new Refus('libre', 'Ce lieu n’est à personne : il ne sort que des packs.');
  if (l.proprietaire === j) throw new Refus('soi_meme', 'Ce lieu est déjà à toi.');
  if (l.prix_vente == null) throw new Refus('pas_en_vente', 'Ce lieu n’est plus en vente : fais une offre à son propriétaire.');
  const prix = Number(l.prix_vente), noms = await pseudos([j, l.proprietaire]);
  const pieces = await transferer(l, j, prix, corps.prix != null ? prixLu(corps.prix) : prix, null);
  await notifier(l.proprietaire, 'vente', `${noms[j] || 'Un joueur'} a acheté ${l.label} pour ${fmt(prix)}.`, { lieu: l.id });
  return { pieces, prix, label: l.label, vendeur: noms[l.proprietaire] || 'Un joueur' };
};
// faire une offre sur le lieu d'un autre (une seule en attente par lieu : la refaire change son prix)
ACTIONS.offrir = async (j, corps) => {
  const prix = prixLu(corps.prix), l = await lieuEnBase(String(corps.id || ''));
  if (!l) throw new Refus('libre', 'Ce lieu n’est à personne : il ne sort que des packs.');
  if (l.proprietaire === j) throw new Refus('soi_meme', 'Ce lieu est déjà à toi.');
  const jr = await joueur(j); if (Number(jr.pieces) < prix) throw new Refus('fonds', 'Tu n’as pas assez de pièces pour cette offre.');
  const offre = await rpc('jeu_offrir', { j, l: l.id, prix }), noms = await pseudos([j, l.proprietaire]);
  await notifier(l.proprietaire, 'offre', `${noms[j] || 'Un joueur'} te propose ${fmt(prix)} pour ${l.label}.`, { offre, lieu: l.id });
  return { offre: String(offre), vendeur: noms[l.proprietaire] || 'Un joueur', prix };
};
ACTIONS.annuler_offre = async (j, corps) => { await rpc('jeu_offre_statut', { o: Number(corps.offre), qui: j, statut: 'annulee' }); return {}; };
// accepter (le lieu change de main, si l'acheteur a toujours les pièces) ou refuser une offre reçue
ACTIONS.repondre_offre = async (j, corps) => {
  const { data: o } = await admin.from('offres').select('*').eq('id', Number(corps.offre)).maybeSingle();
  if (!o || o.vendeur !== j || o.statut !== 'attente') throw new Refus('offre', 'Cette offre n’est plus valable.');
  const l = await lieuEnBase(o.lieu), noms = await pseudos([j, o.acheteur]), prix = Number(o.prix);
  if (!l || l.proprietaire !== j) { await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'caduque' }); throw new Refus('plus_a_lui', 'Ce lieu n’est plus à toi : l’offre est annulée.'); }
  if (!corps.accepter) {
    await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'refusee' });
    await notifier(o.acheteur, 'offre', `${noms[j] || 'Un joueur'} a refusé ton offre de ${fmt(prix)} pour ${l.label}.`, { lieu: l.id });
    return { accepte: false };
  }
  try { await transferer(l, o.acheteur, prix, null, String(o.id)); }
  catch (e) {
    if (!(e instanceof Refus) || e.code !== 'fonds') throw e;
    await rpc('jeu_offre_statut', { o: o.id, qui: j, statut: 'caduque' });
    await notifier(o.acheteur, 'offre', `Ton offre de ${fmt(prix)} pour ${l.label} n’a pas abouti : tu n’avais plus assez de pièces.`, { lieu: l.id });
    throw new Refus('fonds', `${noms[o.acheteur] || 'L’acheteur'} n’a plus assez de pièces : l’offre est annulée.`);
  }
  await notifier(o.acheteur, 'offre', `${noms[j] || 'Un joueur'} a accepté ton offre : ${l.label} est à toi pour ${fmt(prix)} !`, { lieu: l.id });
  return { accepte: true, prix, label: l.label, acheteur: noms[o.acheteur] || 'Un joueur' };
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

// ouvrir le pack du jour : le serveur tire au hasard (graine secrète), une fois par jour
ACTIONS.pack = async (j) => {
  const jm = await jourMs(), jour = Regles.jourDuJeu(Date.now(), jm), jr = await joueur(j);
  if (jr.dernier_jour != null && Number(jr.dernier_jour) >= jour) throw new Refus('deja', REFUS_SQL.deja);
  const cartes = await TIRAGE.tirerPack(crypto.randomUUID() + ':' + jour, ECO.pack.chances, ECO.pack.cartes);
  if (!cartes.length) throw new Refus('reseau', 'Pack impossible à tirer pour l’instant : réessaie dans un instant.');
  await recolter(j);   // les loyers d'avant sont encaissés : les nouveaux lieux comptent à partir de maintenant
  const lignes = cartes.map((c: Ligne) => ({ ...c, commune: Regles.nomCommune(c.citycode, c.city) }));
  const gagnes: string[] = await rpc('jeu_pack', { j, jour, cartes: lignes });
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
async function robotsTour() {
  if (!(await rpc('jeu_robots_tour', { intervalle: 20 }))) return;
  const { data: robots } = await admin.from('robots').select('id, nom'); if (!robots || !robots.length) return;
  const ids = robots.map((r: Ligne) => r.id), exclus = `(${ids.join(',')})`;
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
  const jm = await jourMs(), jour = Regles.jourDuJeu(Date.now(), jm);
  const { data: lieuxRobots } = await admin.from('lieux').select('*').in('proprietaire', ids);
  const indices = await indicesMarche([...reels, ...aVendre, ...(lieuxRobots || [])].filter((l, i, t) => t.findIndex((x) => x.id === l.id) === i));
  const valeurM = (l: Ligne) => Math.round(R.valeur(lieuDe(l)) * (indices[l.id] || 1));
  for (const robot of robots.sort(() => Math.random() - 0.5).slice(0, 3)) {
    const j = robot.id;
    try {
      await recolter(j);
      const mes = (await admin.from('lieux').select('*').eq('proprietaire', j)).data || [];
      const jr = await joueur(j); let pieces = Number(jr.pieces);
      // 1. un lieu de plus, près d'un lieu d'un vrai joueur (une fois par jour du jeu, quinze au plus)
      if (mes.length < 15) {
        const r = hasard(reels), lon = r.lon + (Math.random() - 0.5) * 0.006, lat = r.lat + (Math.random() - 0.5) * 0.004;
        const c = await TIRAGE.adresseProche(lon, lat);
        if (c && await estLibre(c)) { try { await rpc('jeu_pack', { j, jour, cartes: [{ ...c, commune: Regles.nomCommune(c.citycode, c.city) }] }); } catch (_) { /* déjà pris aujourd'hui */ } }
      }
      // 2. répondre aux offres reçues depuis 20 s : oui à partir de 110 % de la valeur, sinon non
      const { data: recues } = await admin.from('offres').select('*').eq('vendeur', j).eq('statut', 'attente').lt('cree_le', new Date(Date.now() - 20_000).toISOString());
      for (const o of recues || []) await ACTIONS.repondre_offre(j, { offre: o.id, accepter: (() => { const l = mes.find((x: Ligne) => x.id === o.lieu); return !!l && Number(o.prix) >= valeurM(l) * 1.1; })() }).catch(() => {});
      // 2 bis. répondre aux échanges reçus depuis 20 s : oui si on leur donne au moins 110 % de ce qu'ils cèdent
      const { data: echRecus } = await admin.from('echanges').select('*').eq('destinataire', j).eq('statut', 'attente').lt('cree_le', new Date(Date.now() - 20_000).toISOString());
      for (const x of echRecus || []) {
        const sien = mes.find((l: Ligne) => l.id === x.lieu), { data: dons } = await admin.from('lieux').select('*').in('id', x.donnes);
        const donne = (dons || []).reduce((t: number, l: Ligne) => t + valeurM(l), 0) + Number(x.ajout);
        await ACTIONS.repondre_echange(j, { echange: x.id, accepter: !!sien && donne >= valeurM(sien) * 1.1 }).catch(() => {});
      }
      // 3. une offre sur un lieu d'un vrai joueur (entre 85 et 140 % de sa valeur), une seule en attente à la fois
      const { count: enAttente } = await admin.from('offres').select('id', { count: 'exact', head: true }).eq('acheteur', j).eq('statut', 'attente');
      if (!enAttente && Math.random() < 0.15) {
        const l = hasard(reels), prix = arrondi(valeurM(l) * (0.85 + Math.random() * 0.55));
        if (prix <= pieces) { await ACTIONS.offrir(j, { id: l.id, prix }).catch(() => {}); }
      }
      // 3 bis. parfois, proposer un échange à un vrai joueur : un ou deux de ses lieux, plus des pièces pour arriver
      // à 100-130 % de la valeur du lieu voulu ; une seule proposition en attente à la fois
      const { count: echEnAttente } = await admin.from('echanges').select('id', { count: 'exact', head: true }).eq('proposeur', j).eq('statut', 'attente');
      if (!echEnAttente && mes.length && Math.random() < 0.1) {
        const l = hasard(reels), dons = mes.slice().sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
        const v = dons.reduce((t: number, d: Ligne) => t + valeurM(d), 0), cible = valeurM(l) * (1 + Math.random() * 0.3), ajout = v < cible ? arrondi(cible - v) : 0;
        if (ajout <= pieces) await ACTIONS.echanger(j, { id: l.id, donnes: dons.map((d: Ligne) => d.id), ajout }).catch(() => {});
      }
      // 4. acheter un lieu mis en vente par un vrai joueur, s'il n'est pas trop cher (jusqu'à 150 % de sa valeur) :
      // une fois sur deux par robot et par tour (« personne ne m'achète », Gautier, 3 nov.)
      const enVente = aVendre.filter((l: Ligne) => Number(l.prix_vente) <= valeurM(l) * 1.5 && Number(l.prix_vente) <= pieces);
      if (enVente.length && Math.random() < 0.5) { const l = hasard(enVente); await ACTIONS.acheter(j, { id: l.id, prix: Number(l.prix_vente) }).then(() => { pieces -= Number(l.prix_vente); }).catch(() => {}); aVendre.splice(aVendre.indexOf(l), 1); }
      // 5. mettre un de ses lieux en vente (110 à 150 % de sa valeur), deux au plus à la fois
      if (mes.length && mes.filter((l: Ligne) => l.prix_vente != null).length < 2 && Math.random() < 0.3) {
        const l = hasard(mes); await rpc('jeu_vendre', { j, l: l.id, prix: arrondi(valeurM(l) * (1.1 + Math.random() * 0.4)) }).catch(() => {});
      }
      // 6. construire le niveau suivant quand c'est possible
      if (mes.length && Math.random() < 0.4) {
        const l = lieuDe(hasard(mes)), n = (l.niveau || 0) + 1;
        if (R.peutConstruire(l, n) && R.coutNiveau(l, n) <= pieces) await ACTIONS.construire(j, { id: l.id, niveau: n }).catch(() => {});
      }
    } catch (e) { console.error('robot', robot.nom, e); }
  }
}

Deno.serve(async (req: Request) => {
  const h = enTetes(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const repondre = (corps: Ligne, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: h });
  try {
    const jeton = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data, error } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null }, error: null };
    if (error || !data.user) throw new Refus('non_connecte', 'Connecte-toi pour jouer.');
    const corps = await req.json().catch(() => ({}));
    const action = ACTIONS[String(corps.action || '')];
    if (!action) throw new Refus('action', 'Action inconnue.');
    const res = await action(data.user.id, corps);
    // les robots jouent un tour après la réponse (sans faire attendre le vrai joueur)
    const runtime = (globalThis as Ligne).EdgeRuntime; if (runtime && runtime.waitUntil) runtime.waitUntil(robotsTour().catch((e) => console.error('robots', e)));
    // après une action qui change la partie, sa partie à jour (pièces, lieux, récolte) pour que le jeu se recale
    if (corps.action !== 'etat') res.etat = await etatDe(data.user.id);
    return repondre({ ok: true, ...res });
  } catch (e) {
    if (e instanceof Refus) return repondre({ ok: false, code: e.code, message: e.message });
    console.error(e);
    // le détail (technique, jamais une clé) aide à comprendre une panne ; le joueur ne voit que le message
    const detail = String((e && ((e as Ligne).message || (e as Ligne).details || (e as Ligne).code)) || e).slice(0, 200);
    return repondre({ ok: false, code: 'erreur', message: 'Le serveur a eu un souci : réessaie dans un instant.', detail }, 500);
  }
});
