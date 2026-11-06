// Les e-mails de connexion du jeu (confirmation d'inscription, mot de passe oublié) passent par Brevo : le service
// d'e-mail de Supabase n'écrit qu'aux membres de l'équipe du projet, deux fois par heure. Pose dans Supabase Auth le
// serveur d'envoi de Brevo, l'expéditeur noreply@citydeck.fr et des e-mails en français (avec l'anglais dessous).
// Lancé par la publication du serveur ; n'affiche aucun secret.
//   node tools/serveur_emails.js <référence du projet>
// Besoin : SUPABASE_ACCESS_TOKEN, et la clé SMTP de Brevo, posée par Gautier dans le secret GitHub BREVO_SMTP_KEY_CITY_DECK
// (Brevo → SMTP et API → Générer une clé SMTP ; la publication la passe ici sous le nom BREVO_SMTP_KEY). Sans lui, rien ne change. L'identifiant de connexion n'est pas un secret (BREVO_SMTP_LOGIN peut le remplacer).
// citydeck.fr est authentifié chez Brevo depuis le 6 nov. 2026 (code, deux clés DKIM dans la zone d'Infomaniak) : sans
// cela, la règle DMARC du domaine (p=reject) ferait refuser tout e-mail de citydeck.fr envoyé par Brevo.
const REF = process.argv[2] || 'hxtyecwofajiozmnfyxt';
const JETON = process.env.SUPABASE_ACCESS_TOKEN, LOGIN = process.env.BREVO_SMTP_LOGIN || 'bbfc16001@smtp-brevo.com', CLE = process.env.BREVO_SMTP_KEY;

// un e-mail : un titre, un bouton, une phrase ; puis la même chose en anglais (le jeu est en deux langues)
function email(titre, texte, bouton, fin, title, text, button) {
  const bleu = '#2453B3';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1C2440">
<h2 style="margin:0 0 12px">${titre}</h2>
<p style="font-size:16px;line-height:1.5">${texte}</p>
<p style="margin:24px 0"><a href="{{ .ConfirmationURL }}" style="background:${bleu};color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px;display:inline-block">${bouton}</a></p>
<p style="font-size:13px;color:#5A6378">${fin}</p>
<hr style="border:0;border-top:1px solid #D9DFEA;margin:24px 0">
<p style="font-size:13px;color:#5A6378"><b>${title}</b> ${text} <a href="{{ .ConfirmationURL }}" style="color:${bleu}">${button}</a></p>
<p style="font-size:12px;color:#8A93A8">StreetKeep · citydeck.fr</p>
</div>`;
}

const REGLAGES = {
  smtp_host: 'smtp-relay.brevo.com', smtp_port: '587', smtp_admin_email: 'noreply@citydeck.fr', smtp_sender_name: 'StreetKeep',
  rate_limit_email_sent: 100,   // e-mails par heure pour tout le jeu (30 par défaut)
  mailer_subjects_confirmation: 'Confirme ton inscription à StreetKeep',
  mailer_templates_confirmation_content: email('Bienvenue dans StreetKeep !', 'Il ne reste qu’à confirmer ton adresse e-mail pour commencer ta collection.',
    'Confirmer mon adresse', 'Si tu n’as pas créé de compte, ignore simplement cet e-mail.',
    'Welcome to StreetKeep!', 'Confirm your e-mail address to start your collection:', 'confirm my address'),
  mailer_subjects_recovery: 'Ton nouveau mot de passe StreetKeep',
  mailer_templates_recovery_content: email('Mot de passe oublié', 'Touche le bouton pour choisir un nouveau mot de passe.',
    'Choisir un nouveau mot de passe', 'Si tu n’as rien demandé, ignore cet e-mail : ton mot de passe ne change pas.',
    'Forgot your password?', 'Choose a new one here:', 'new password'),
};

(async () => {
  if (!JETON) { console.log('SUPABASE_ACCESS_TOKEN absent : e-mails sautés.'); return; }
  if (!CLE) { console.log('Clé SMTP de Brevo absente (secret BREVO_SMTP_KEY_CITY_DECK) : les e-mails restent ceux de Supabase.'); return; }
  const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`, H = { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' };
  const r = await fetch(url, { method: 'PATCH', headers: H, body: JSON.stringify({ ...REGLAGES, smtp_user: LOGIN, smtp_pass: CLE }) });
  if (!r.ok) { console.log(`::warning::e-mails de connexion non branchés sur Brevo (HTTP ${r.status})`); return; }
  console.log('e-mails de connexion : Brevo,', REGLAGES.smtp_admin_email, '| modèles en français et en anglais');
})().catch((e) => { console.log('::warning::e-mails de connexion :', e.message); });
