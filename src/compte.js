// Le compte du joueur (GDD § 7 « Création de compte » : inscription obligatoire, puis pseudo + avatar).
// Serveur : data/serveur.json (projet Supabase). Sans adresse de serveur, le jeu reste en mode simulé (profil local).
// Chargé après le script principal de la page : utilise ses fonctions (state, save, toast, refreshTop, creationProfil…).
(function () {
  const Compte = { client: null, session: null, profil: null, actif: () => !!Compte.client };
  window.Compte = Compte;

  const box = () => document.getElementById('modalbox');
  const ouvrir = (html) => { box().innerHTML = html; document.getElementById('modal').classList.add('on'); };
  const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let bloquant = false; // l'écran de compte ne se ferme pas d'un toucher à côté
  Compte.bloque = () => bloquant; // ni d'un changement d'écran

  // les messages d'erreur de Supabase, en français
  function texteErreur(e) {
    const m = String((e && (e.message || e.msg || e.error_description)) || e || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/email not confirmed/i.test(m)) return 'Ton e-mail n’est pas encore confirmé : ouvre le lien reçu par e-mail.';
    if (/already registered|already been registered|user already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connecte-toi.';
    if (/password should be at least|weak password|password is too/i.test(m)) return 'Mot de passe trop court ou trop simple (8 caractères au moins).';
    if (/not authorized/i.test(m)) return 'Cette adresse ne peut pas recevoir d’e-mail pour l’instant (jeu en test).';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Trop de tentatives : réessaie dans quelques minutes.';
    if (/invalid email|unable to validate email/i.test(m)) return 'Adresse e-mail invalide.';
    if (/failed to fetch|network/i.test(m)) return 'Serveur injoignable : vérifie ta connexion et réessaie.';
    return 'Erreur : ' + m;
  }
  // le choix de la langue, dès l'écran de compte (un nouveau joueur ne voit pas encore les réglages ; français par défaut)
  function choixLangue() {
    if (!window.Langue) return '';
    const L = window.Langue.code;
    return `<div class="cpt-langue" data-pas-traduire><button class="${L === 'fr' ? 'on' : ''}" onclick="Langue.choisir('fr')">Français</button><button class="${L === 'en' ? 'on' : ''}" onclick="Langue.choisir('en')">English</button></div>`;
  }
  function emailValide(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

  // ---------------------------------------------------------------- les écrans
  function ecranCompte(mode, message) {
    bloquant = true;
    const inscription = mode !== 'connexion';
    ouvrir(`<div class="logo-jeu petit">${window.Logo ? Logo.svg() : '<div class="plaque" style="font-size:26px">StreetKeep</div>'}</div><h2>${inscription ? 'Crée ton compte' : 'Connexion'}</h2>
      <div class="sub">${inscription ? 'Un compte par joueur : il garde ton pseudo. Bientôt, tes lieux et tes pièces te suivront aussi d’un appareil à l’autre.' : 'Content de te revoir !'}</div>
      <input class="txt" id="cpt-mail" type="email" autocomplete="email" placeholder="Ton e-mail" style="margin-bottom:8px">
      <input class="txt" id="cpt-mdp" type="password" autocomplete="${inscription ? 'new-password' : 'current-password'}" placeholder="Mot de passe${inscription ? ' (8 caractères au moins)' : ''}">
      <div class="err" id="cpt-err">${message ? echapper(message) : ''}</div>
      <button class="btn large" style="margin-bottom:10px" id="cpt-ok">${inscription ? 'Créer mon compte' : 'Me connecter'}</button>
      ${inscription ? '<div class="m petit" style="text-align:center;margin:-2px 0 10px">En créant ton compte, tu acceptes les <a href="conditions.html" target="_blank" rel="noopener">conditions d’utilisation</a> et la <a href="confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</div>' : ''}
      <div class="m" style="text-align:center">${inscription
        ? 'Déjà un compte ? <a href="#" id="cpt-bascule" style="color:var(--gold)">Me connecter</a>'
        : 'Pas encore de compte ? <a href="#" id="cpt-bascule" style="color:var(--gold)">Créer un compte</a> · <a href="#" id="cpt-oubli" style="color:var(--gold)">Mot de passe oublié</a>'}</div>${choixLangue()}`);
    const err = box().querySelector('#cpt-err'), ok = box().querySelector('#cpt-ok');
    box().querySelector('#cpt-bascule').onclick = (e) => { e.preventDefault(); ecranCompte(inscription ? 'connexion' : 'inscription'); };
    const oubli = box().querySelector('#cpt-oubli'); if (oubli) oubli.onclick = (e) => { e.preventDefault(); ecranOubli(box().querySelector('#cpt-mail').value.trim()); };
    ok.onclick = async () => {
      const mail = box().querySelector('#cpt-mail').value.trim(), mdp = box().querySelector('#cpt-mdp').value;
      if (!emailValide(mail)) { err.textContent = 'Adresse e-mail invalide.'; return; }
      if (mdp.length < (inscription ? 8 : 1)) { err.textContent = inscription ? 'Mot de passe : 8 caractères au moins.' : 'Ton mot de passe ?'; return; }
      ok.disabled = true; ok.textContent = '…'; err.textContent = '';
      try {
        if (inscription) {
          const { data, error } = await Compte.client.auth.signUp({ email: mail, password: mdp, options: { emailRedirectTo: retour() } });
          if (error) throw error;
          if (data.session) return connecte(data.session);
          // un compte qui existe déjà : Supabase ne le dit pas (pas d'identité), on oriente vers la connexion
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return ecranCompte('connexion', 'Un compte existe déjà avec cet e-mail : connecte-toi.');
          return ecranAttente(mail);
        }
        const { data, error } = await Compte.client.auth.signInWithPassword({ email: mail, password: mdp });
        if (error) throw error;
        return connecte(data.session);
      } catch (e) { err.textContent = texteErreur(e); ok.disabled = false; ok.textContent = inscription ? 'Créer mon compte' : 'Me connecter'; }
    };
    avecEntree();
  }

  function ecranAttente(mail) {
    bloquant = true;
    ouvrir(`<h2>📬 Vérifie tes e-mails</h2>
      <div class="sub">Un lien de confirmation a été envoyé à <b>${echapper(mail)}</b>. Ouvre-le : il te ramènera dans le jeu, connecté.</div>
      <div class="m" style="margin-bottom:12px">Rien reçu ? Regarde dans les indésirables, ou renvoie l’e-mail.</div><div class="err" id="cpt-err"></div>
      <button class="btn" style="width:100%;margin-bottom:8px" id="cpt-renvoi">Renvoyer l’e-mail</button>
      <button class="btn sm" style="width:100%" id="cpt-deja">J’ai confirmé : me connecter</button>`);
    box().querySelector('#cpt-deja').onclick = () => ecranCompte('connexion');
    box().querySelector('#cpt-renvoi').onclick = async () => {
      const err = box().querySelector('#cpt-err');
      const { error } = await Compte.client.auth.resend({ type: 'signup', email: mail, options: { emailRedirectTo: retour() } });
      err.style.color = error ? '' : 'var(--ok)'; err.textContent = error ? texteErreur(error) : 'E-mail renvoyé.';
    };
  }

  function ecranOubli(mail) {
    bloquant = true;
    ouvrir(`<h2>Mot de passe oublié</h2><div class="sub">On t’envoie un lien pour en choisir un nouveau.</div>
      <input class="txt" id="cpt-mail" type="email" autocomplete="email" placeholder="Ton e-mail" value="${echapper(mail || '')}">
      <div class="err" id="cpt-err"></div>
      <button class="btn" style="width:100%;margin-bottom:8px" id="cpt-ok">Envoyer le lien</button>
      <button class="btn sm" style="width:100%" id="cpt-retour">Retour</button>`);
    box().querySelector('#cpt-retour').onclick = () => ecranCompte('connexion');
    box().querySelector('#cpt-ok').onclick = async () => {
      const m = box().querySelector('#cpt-mail').value.trim(), err = box().querySelector('#cpt-err');
      if (!emailValide(m)) { err.textContent = 'Adresse e-mail invalide.'; return; }
      const { error } = await Compte.client.auth.resetPasswordForEmail(m, { redirectTo: retour() });
      err.style.color = error ? '' : 'var(--ok)'; err.textContent = error ? texteErreur(error) : 'Si un compte existe avec cet e-mail, le lien est parti.';
    };
    avecEntree();
  }

  function ecranNouveauMotDePasse() {
    bloquant = true;
    ouvrir(`<h2>Nouveau mot de passe</h2><div class="sub">Choisis ton nouveau mot de passe (8 caractères au moins).</div>
      <input class="txt" id="cpt-mdp" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe">
      <div class="err" id="cpt-err"></div><button class="btn" style="width:100%" id="cpt-ok">Enregistrer</button>`);
    box().querySelector('#cpt-ok').onclick = async () => {
      const mdp = box().querySelector('#cpt-mdp').value, err = box().querySelector('#cpt-err');
      if (mdp.length < 8) { err.textContent = 'Mot de passe : 8 caractères au moins.'; return; }
      const { data, error } = await Compte.client.auth.updateUser({ password: mdp });
      if (error) { err.textContent = texteErreur(error); return; }
      toast('Mot de passe changé'); const s = (await Compte.client.auth.getSession()).data.session; if (s) connecte(s); else ecranCompte('connexion');
    };
    avecEntree();
  }

  function ecranIndisponible(raison) {
    bloquant = true;
    ouvrir(`<h2>Serveur indisponible</h2><div class="sub">${echapper(raison)}</div><button class="btn" style="width:100%" id="cpt-ok">Réessayer</button>`);
    box().querySelector('#cpt-ok').onclick = () => location.reload();
  }

  // Entrée valide l'écran (joueurs sur ordinateur, demande de Gautier du 5 nov.) : dans l'e-mail, elle passe au mot de passe
  // s'il est encore vide ; sinon elle appuie sur le bouton principal. Sur ordinateur, le premier champ est déjà sélectionné.
  function avecEntree() {
    const b = box(), ok = b.querySelector('#cpt-ok'), mdp = b.querySelector('#cpt-mdp'), champs = [...b.querySelectorAll('input')];
    champs.forEach((c) => {
      c.enterKeyHint = (c.id === 'cpt-mail' && mdp) ? 'next' : 'go';
      c.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        if (c.id === 'cpt-mail' && mdp && !mdp.value) { mdp.focus(); return; }
        if (ok && !ok.disabled) ok.click();
      });
    });
    if (champs[0] && window.matchMedia && matchMedia('(pointer:fine)').matches) champs[0].focus();
  }

  // l'adresse où reviennent les liens des e-mails : la page du jeu, sans ce qui suit # ou ?
  function retour() { return location.origin + location.pathname; }

  // ---------------------------------------------------------------- le profil sur le serveur
  async function lireProfil(id) {
    const { data, error } = await Compte.client.from('profils').select('id,pseudo,avatar,cree_le').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  // la création du profil (une seule fois : le pseudo est définitif) : { ok } ou { ok:false, texte }
  Compte.enregistrerProfil = async function (pseudo, avatar) {
    if (Compte.profil) return { ok: false, texte: 'ton pseudo est déjà choisi' };
    const { data: libre, error } = await Compte.client.rpc('pseudo_libre', { p: pseudo });
    if (error) return { ok: false, texte: texteErreur(error) };
    if (!libre) return { ok: false, texte: 'ce pseudo est déjà pris' };
    const r = await Compte.client.from('profils').insert({ id: Compte.session.user.id, pseudo, avatar }).select('id,pseudo,avatar,cree_le').single();
    if (r.error) return { ok: false, texte: /duplicate|unique/i.test(r.error.message) ? 'ce pseudo est déjà pris' : texteErreur(r.error) };
    Compte.profil = r.data; return { ok: true };
  };
  // changer d'icône (le seul changement permis après la création)
  Compte.enregistrerAvatar = async function (avatar) {
    const r = await Compte.client.from('profils').update({ avatar }).eq('id', Compte.session.user.id).select('id,pseudo,avatar,cree_le').single();
    if (r.error) return { ok: false, texte: texteErreur(r.error) };
    Compte.profil = r.data; return { ok: true };
  };

  Compte.deconnecter = async function () {
    await Compte.client.auth.signOut(); Compte.session = null; Compte.profil = null;
    state.pseudo = ''; save(); location.reload();
  };

  // ---------------------------------------------------------------- l'enchaînement au démarrage
  let suiteFaite = false;
  async function connecte(session) {
    Compte.session = session; bloquant = false;
    // le jeu garde un état local par appareil : un autre compte sur cet appareil repart d'un état neuf
    if (state.compte && state.compte !== session.user.id) {
      const neuf = { wallet: ECO.solde_depart, owned: {}, pseudo: '', avatar: '🦊', prefs: { offres: true, seuil: true, encheres: true }, lastPack: -1, offersIn: [], offersOut: [], notifs: [], encaisse: Date.now(), encheres: { mises: {}, clos: {}, depasse: {} }, seen: {} };
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, neuf);
    }
    state.compte = session.user.id; save();
    try { Compte.profil = await lireProfil(session.user.id); }
    catch (e) { return ecranIndisponible(texteErreur(e)); }
    closeModal();
    if (!Compte.profil) { state.pseudo = ''; save(); refreshTop(); creationProfil(); bloquant = true; return; }   // pseudo + avatar obligatoires, puis la suite
    state.pseudo = Compte.profil.pseudo; state.avatar = Compte.profil.avatar; save(); refreshTop();
    suite();
  }
  function suite() { bloquant = false; if (suiteFaite) return; suiteFaite = true; setTimeout(() => recolteConnexion(packAuDemarrage), 400); }
  Compte.apresProfil = suite;

  async function demarrer() {
    let conf = null;
    try { conf = await (await fetch('data/serveur.json', { cache: 'no-store' })).json(); } catch (e) {}
    const sansServeur = conf && (!conf.url || !conf.cle_publique);   // aucun serveur prévu (outils, essais) : la démo
    if (typeof MODE_SERVEUR !== 'undefined' && MODE_SERVEUR) {
      // tout le monde joue sur le vrai serveur (5 nov.) : sans adresse de serveur, la démo ; s'il ne répond pas, on réessaie
      if (sansServeur) { let ok = false; try { sessionStorage.setItem('cadastra-demo', '1'); ok = sessionStorage.getItem('cadastra-demo') === '1'; } catch (e) {} if (ok) { location.reload(); return; } }
      if (!conf || !window.supabase) return ecranIndisponible('Serveur injoignable : vérifie ta connexion et réessaie.');
    }
    if (!conf || sansServeur || !window.supabase) return demarrageLocal();
    Compte.client = window.supabase.createClient(conf.url, conf.cle_publique, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: 'cadastra-session' },
    });
    let recuperation = /type=recovery/.test(location.hash);
    Compte.client.auth.onAuthStateChange((evenement) => { if (evenement === 'PASSWORD_RECOVERY') { recuperation = true; ecranNouveauMotDePasse(); } });
    let session = null;
    try { session = (await Compte.client.auth.getSession()).data.session; }
    catch (e) { return ecranIndisponible(texteErreur(e)); }
    if (location.hash.includes('access_token') || location.hash.includes('error')) {
      const erreur = new URLSearchParams(location.hash.slice(1)).get('error_description');
      history.replaceState(null, '', retour());
      if (erreur && !session) return ecranCompte('connexion', 'Le lien a expiré ou a déjà servi : connecte-toi, ou demande un nouvel e-mail.');
    }
    if (recuperation) return ecranNouveauMotDePasse();
    if (session) return connecte(session);
    ecranCompte(state.compte ? 'connexion' : 'inscription');
  }

  // l'écran de compte ne se ferme pas en touchant à côté
  document.getElementById('modal').addEventListener('click', (e) => { if (bloquant && e.target.id === 'modal') e.stopImmediatePropagation(); }, true);

  demarrer();
})();
