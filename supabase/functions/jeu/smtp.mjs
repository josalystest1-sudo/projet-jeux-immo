// Un e-mail par SMTP (Brevo), sans bibliothèque : seulement le dialogue. La connexion chiffrée est donnée par
// l'appelant (Deno.connectTls dans la fonction « jeu », port 465 : Supabase bloque 25 et 587 ; une connexion simulée
// dans tests/smtp.test.js). conn : { read(Uint8Array) → Promise<nombre | null>, write(Uint8Array) → Promise<nombre>, close() }.
// Le texte part en base64 (UTF-8) : aucune ligne ne peut commencer par un point, rien à échapper.

const enc = new TextEncoder();

export function base64(s) {
  const o = enc.encode(s); let t = '';
  for (let i = 0; i < o.length; i += 0x8000) t += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(t);
}

// le message (en-têtes + corps), terminé par la ligne « . » qui clôt DATA
export function message({ de, nomDe, a, sujet, texte, date, id }) {
  return [
    `From: ${nomDe} <${de}>`, `To: <${a}>`, `Subject: =?UTF-8?B?${base64(sujet)}?=`, `Date: ${date.toUTCString()}`,
    `Message-ID: <${id}@${de.split('@')[1]}>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', base64(texte).replace(/.{1,76}/g, '$&\r\n') + '.',
  ].join('\r\n');
}

// envoyer : le dialogue complet (accueil, EHLO, AUTH LOGIN, MAIL, RCPT, DATA, QUIT) ; une réponse inattendue lève une erreur
export async function envoyer(conn, { login, cle, de, nomDe, a, sujet, texte, date = new Date(), id = crypto.randomUUID() }) {
  const dec = new TextDecoder(); let tampon = '';
  const reponse = async () => {   // la dernière ligne d'une réponse : « 250 … » (les lignes « 250-… » la précèdent)
    const buf = new Uint8Array(4096);
    for (;;) {
      const l = tampon.split('\r\n');
      for (let i = 0; i < l.length - 1; i++) if (/^\d{3} /.test(l[i])) { tampon = l.slice(i + 1).join('\r\n'); return l[i]; }
      const n = await conn.read(buf);
      if (n === null) throw new Error('SMTP : connexion fermée');
      tampon += dec.decode(buf.subarray(0, n), { stream: true });
    }
  };
  const ecrire = async (s) => { const o = enc.encode(s); let k = 0; while (k < o.length) k += await conn.write(o.subarray(k)); };
  const dire = async (s, code) => {
    if (s !== null) await ecrire(s + '\r\n');
    const r = await reponse();
    if (!r.startsWith(code)) throw new Error('SMTP : ' + r.slice(0, 120));
  };
  await dire(null, '220');
  await dire('EHLO ' + de.split('@')[1], '250');
  await dire('AUTH LOGIN', '334'); await dire(base64(login), '334'); await dire(base64(cle), '235');
  await dire(`MAIL FROM:<${de}>`, '250'); await dire(`RCPT TO:<${a}>`, '250');
  await dire('DATA', '354'); await dire(message({ de, nomDe, a, sujet, texte, date, id }), '250');
  await dire('QUIT', '221').catch(() => {});
}
