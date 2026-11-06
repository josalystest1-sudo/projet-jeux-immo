// L'e-mail d'alerte à Gautier (supabase/functions/jeu/smtp.mjs) : le dialogue SMTP avec un serveur simulé.
const test = require('node:test'); const assert = require('node:assert');
const path = require('path'); const { pathToFileURL } = require('url');
const charger = () => import(pathToFileURL(path.join(__dirname, '../supabase/functions/jeu/smtp.mjs')).href);

// un serveur SMTP simulé : il répond à chaque ligne reçue (DATA : jusqu'à la ligne « . »), par petits morceaux
function serveur(refuser) {
  const recu = [], enc = new TextEncoder(), dec = new TextDecoder(); let sortie = enc.encode('220 smtp-relay.brevo.com ESMTP\r\n'), entree = '', data = false, ferme = false;
  const repondre = (s) => { const o = enc.encode(s); const t = new Uint8Array(sortie.length + o.length); t.set(sortie); t.set(o, sortie.length); sortie = t; };
  const ligne = (l) => {
    recu.push(l);
    if (data) { if (l === '.') { data = false; repondre('250 2.0.0 OK: queued\r\n'); } return; }
    if (refuser && l.startsWith(refuser)) return repondre('535 5.7.8 Authentication failed\r\n');
    if (l.startsWith('EHLO')) repondre('250-smtp-relay.brevo.com\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n');
    else if (l === 'AUTH LOGIN') repondre('334 VXNlcm5hbWU6\r\n');
    else if (recu.length === 3) repondre('334 UGFzc3dvcmQ6\r\n');
    else if (recu.length === 4) repondre('235 2.0.0 Authentication succeeded\r\n');
    else if (l.startsWith('MAIL FROM') || l.startsWith('RCPT TO')) repondre('250 OK\r\n');
    else if (l === 'DATA') { data = true; repondre('354 End data with <CR><LF>.<CR><LF>\r\n'); }
    else if (l === 'QUIT') { repondre('221 Bye\r\n'); ferme = true; }
  };
  return {
    recu,
    async read(buf) { if (!sortie.length) return ferme ? null : 0; const n = Math.min(buf.length, sortie.length, 7); buf.set(sortie.subarray(0, n)); sortie = sortie.subarray(n); return n; },
    async write(o) { const n = Math.min(o.length, 50); entree += dec.decode(o.subarray(0, n)); let i; while ((i = entree.indexOf('\r\n')) >= 0) { ligne(entree.slice(0, i)); entree = entree.slice(i + 2); } return n; },
    close() {},
  };
}

test('un e-mail par SMTP : connexion, authentification, message en UTF-8 lisible', async () => {
  const { envoyer } = await charger();
  const s = serveur(), texte = 'Château de Blois (Blois) est de nouveau libre.\nÀ poster : « 🏛️ … #StreetKeep »\n.ligne qui commence par un point';
  await envoyer(s, { login: 'moi@smtp-brevo.com', cle: 'cle-secrete', de: 'noreply@citydeck.fr', nomDe: 'StreetKeep', a: 'contact@citydeck.fr', sujet: 'StreetKeep : un monument à annoncer', texte, date: new Date(0), id: 'essai' });
  const r = s.recu;
  assert.equal(r[0], 'EHLO citydeck.fr'); assert.equal(r[1], 'AUTH LOGIN');
  assert.equal(Buffer.from(r[2], 'base64').toString(), 'moi@smtp-brevo.com'); assert.equal(Buffer.from(r[3], 'base64').toString(), 'cle-secrete');
  assert.equal(r[4], 'MAIL FROM:<noreply@citydeck.fr>'); assert.equal(r[5], 'RCPT TO:<contact@citydeck.fr>'); assert.equal(r[6], 'DATA');
  const fin = r.indexOf('.'), entetes = r.slice(7, r.indexOf('', 7)), corps = r.slice(r.indexOf('', 7) + 1, fin);
  assert.ok(entetes.includes('From: StreetKeep <noreply@citydeck.fr>') && entetes.includes('To: <contact@citydeck.fr>') && entetes.includes('Content-Transfer-Encoding: base64'));
  const sujet = entetes.find((l) => l.startsWith('Subject:')).match(/=\?UTF-8\?B\?(.*)\?=/)[1];
  assert.equal(Buffer.from(sujet, 'base64').toString(), 'StreetKeep : un monument à annoncer');
  assert.ok(corps.every((l) => l.length <= 76 && !l.startsWith('.')));
  assert.equal(Buffer.from(corps.join(''), 'base64').toString(), texte);
  assert.equal(r[fin + 1], 'QUIT');
});

test('un refus du serveur SMTP arrête l’envoi avec son message', async () => {
  const { envoyer } = await charger();
  const s = serveur('Y2xl');   // la clé (base64 de « cle »)
  await assert.rejects(envoyer(s, { login: 'moi', cle: 'cle', de: 'noreply@citydeck.fr', nomDe: 'StreetKeep', a: 'contact@citydeck.fr', sujet: 's', texte: 't' }), /535/);
  assert.ok(!s.recu.some((l) => l.startsWith('MAIL FROM')));
});
