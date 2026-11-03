// La fonction « jeu » : le seul endroit qui modifie la partie d'un joueur (phase 8 : le vrai serveur).
// Le jeu (navigateur) l'appelle avec { action, ... } et le jeton du joueur connecté ; elle applique les MÊMES règles
// que le jeu (src/regles, recopiées dans _genere/ par tools/serveur_prepare.js), puis écrit par les fonctions SQL
// jeu_* (supabase/sql/010_jeu.sql), chacune atomique. Réponse : { ok: true, ... } ou { ok: false, code, message }.
import { createClient } from '@supabase/supabase-js';
import { Regles } from './_genere/regles.mjs';
import { ECO, STANDING } from './_genere/donnees.mjs';

const JOUR_MS = 86_400_000;                           // le vrai jeu : un jour = 24 heures
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
  const { data, error } = await admin.from('joueurs').select('pieces, encaisse, dernier_pack').eq('id', j).single();
  if (error || !data) throw error || new Error('joueur introuvable');
  return data;
}
async function mesLieux(j: string) {
  const { data, error } = await admin.from('lieux').select('*').eq('proprietaire', j);
  if (error) throw error;
  return (data || []).map(lieuDe);
}
async function rpc(nom: string, args: Ligne) {
  const { data, error } = await admin.rpc(nom, args);
  if (error) {
    const m = String(error.message || '');
    if (/fonds/.test(m)) throw new Refus('fonds', 'Pas assez de pièces.');
    if (/pas_a_toi/.test(m)) throw new Refus('pas_a_toi', 'Ce lieu n’est pas à toi.');
    if (/niveau/.test(m)) throw new Refus('niveau', 'On construit un niveau à la fois.');
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------- les actions
// récolter : salaire + loyers depuis la dernière récolte, 24 h de stock au plus (mêmes règles que le jeu)
async function recolter(j: string) {
  for (let essai = 0; essai < 3; essai++) {
    const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now();
    const montant = R.aEncaisser(lieux, ms(jr.encaisse), maintenant, JOUR_MS);
    if (montant < 1) return { recolte: 0, pieces: Number(jr.pieces) };
    const p = await rpc('jeu_recolter', { j, montant, avant: jr.encaisse, maintenant: new Date(maintenant).toISOString() });
    if (p != null) return { recolte: montant, pieces: Number(p) };
  }
  throw new Refus('occupe', 'Une autre récolte est en cours : réessaie.');
}

const ACTIONS: Record<string, (j: string, corps: Ligne) => Promise<Ligne>> = {
  // ma partie : pièces, lieux, ce qui attend d'être récolté
  async etat(j) {
    const jr = await joueur(j), lieux = await mesLieux(j), maintenant = Date.now();
    return {
      pieces: Number(jr.pieces), encaisse: ms(jr.encaisse), dernierPack: jr.dernier_pack, lieux, maintenant,
      aRecolter: R.aEncaisser(lieux, ms(jr.encaisse), maintenant, JOUR_MS), jourMs: JOUR_MS,
    };
  },
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
    return repondre({ ok: true, ...(await action(data.user.id, corps)) });
  } catch (e) {
    if (e instanceof Refus) return repondre({ ok: false, code: e.code, message: e.message });
    console.error(e);
    // le détail (technique, jamais une clé) aide à comprendre une panne ; le joueur ne voit que le message
    const detail = String((e && ((e as Ligne).message || (e as Ligne).details || (e as Ligne).code)) || e).slice(0, 200);
    return repondre({ ok: false, code: 'erreur', message: 'Le serveur a eu un souci : réessaie dans un instant.', detail }, 500);
  }
});
