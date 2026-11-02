# Cadastra — référence pour Claude Code

Ce fichier dit **ce qu'est le jeu, comment on travaille, ce qui est décidé et les pièges**. `docs/GDD.md` donne les règles en détail (avec les étiquettes [Décidé] / [Proposé]), `docs/PLAN.md` l'ordre des étapes, `PROGRESS.md` où on en est.

## 1. Le propriétaire et la façon de travailler

- **Gautier** est le propriétaire. Il ne lit pas de code et n'utilise jamais de terminal. Il travaille depuis l'app Claude, souvent sur son téléphone. On lui parle **en français**, sans jargon.
- **Fin de chaque session** : expliquer ce qui a été fait en langage courant et lui donner quelque chose à tester sur son téléphone (l'adresse du jeu publié). Ne jamais lui demander de taper une commande ; si une action manuelle est indispensable, la décrire bouton par bouton.
- **Une PR par étape**, petite, titre et description en français, fusionnée en squash sur `main` quand les tests passent. Claude fusionne lui-même.
- **Méthode** (décision de Gautier, reprise du Projet Arena) : **tout le game design d'abord, puis les graphismes, l'équilibrage à la fin.** Pas de réglage fin en route ; seuls garde-fous : les tests passent, rien ne bloque un joueur, l'économie ne s'emballe pas visiblement.
- **Quand le GDD ne dit rien** : avancer avec une proposition argumentée, la marquer [Proposé] dans le GDD et le dire à Gautier ; demander (AskUserQuestion) seulement si ça bloque ou si c'est irréversible.
- Commits : terminer par `Co-Authored-By: Claude <noreply@anthropic.com>`. Identité git : `GIT_AUTHOR_NAME=Claude GIT_AUTHOR_EMAIL=noreply@anthropic.com` (idem committer).
- Ne jamais écrire de nom de personne réelle dans les données ; jamais de lien adresse ↔ identité.

## 2. Le jeu en dix lignes

1. Un jeu web mobile (PWA, portrait) où l'on **collectionne des lieux réels** de France : adresses, lieux nommés (églises, mairies, châteaux, gares…), monuments.
2. Chaque lieu est **unique** : un seul propriétaire.
3. On obtient des lieux par le **pack gratuit du jour** (5 lieux au hasard dans toute la France), des packs payants, le **marché** entre joueurs (vente à prix libre, offres sur n'importe quel lieu) et les **enchères** de monuments (3 par semaine, nationales).
4. Les lieux rapportent un **loyer** selon ce qu'on y **construit** (Maison, Immeuble, Tour ; Prestige pour les monuments), récolté à la connexion, 24 h de stock au plus. Un salaire quotidien pour tous.
5. Le **standing** du quartier (prix immobiliers réels) fixe jusqu'où on peut construire ; la **notoriété** (Wikipédia, catégorie) ajoute des niveaux et fait la **rareté** de la carte (Commun → Légendaire).
6. Le loyer ne dépend jamais de la chance : une belle adresse permet de construire plus haut, elle ne rapporte pas plus toute seule.
7. Le **Maire** d'une commune est celui qui y possède le plus de lieux (égalité = deux Maires), tant que ça dure.
8. Pas de taxe, pas de délai, pas de vente à la banque, pas de blockchain, jamais de monnaie du jeu contre des euros.
9. Monétisation V1 : packs et Pass mensuel. Jamais de vente de lieu précis, de loyer ou de construction.
10. Tout est construit avec des données ouvertes (BAN, IGN, cadastre, DVF, Wikidata) et Street View intégré pour la devanture.

## 3. Stack

- **Front** : une page web / PWA, HTML + CSS + JavaScript sans framework (le prototype l'a prouvé), découpée en modules ES ; MapLibre GL pour la carte (tuiles vectorielles IGN BD TOPO + PCI, polices IGN), Three.js pour l'ouverture de pack. Hébergée sur GitHub Pages.
- **Serveur** : Supabase (Postgres, auth anonyme puis e-mail, fonctions serveur pour tout ce qui touche à l'argent et aux tirages). Tant que `data/serveur.json` n'a pas d'URL, un **serveur simulé** (`src/serveur_simule.js`) fait tourner le jeu avec des joueurs générés.
- **Données** : `data/` (JSON) : réglages d'économie, monuments, raretés, textes. Scripts Python dans `tools/` pour fabriquer les jeux de données (standing DVF, notoriété Wikidata, contours simplifiés).
- **Tests** : `npm test` (Node, tests unitaires du moteur de règles : valeur, loyer, plafond, rareté, enchères, offres). Le moteur de règles (`src/regles/`) est **pur** : pas d'accès réseau, pas de DOM, pas de hasard sans graine fournie.
- **Publication** : GitHub Actions → GitHub Pages à chaque fusion sur `main`.
- **Vérifier le jeu publié** : navigateur intégré, format mobile.

## 4. Les décisions de Gautier (2 nov. 2026)

1. Collection, compétition (Maire), fortune : les trois moteurs, dans cet ordre. Sessions de 10 min. Tout public.
2. 1 pack gratuit/jour, 5 lieux, toute la France. Packs payants 1,99 € · 7,99 € (5) · 16,99 € (12) · Pass mensuel 4,99 €.
3. Loyer récolté à la connexion, 24 h max. Construction instantanée. Niveau « Prestige » unique aux monuments, au-dessus de la Tour.
4. Marché : prix libre, offres sans expiration, modifiables/annulables, pas de vente à la banque.
5. Enchères : nationales, 3 monuments par semaine (1 légendaire + 2 régionaux, répartition proposée par Claude).
6. Maire = le plus de lieux dans la commune ; égalité = deux Maires ; titre valable tant que la condition tient.
7. Pas de taxe, pas de délai de blocage, skins en V2. Gautier est réservé sur toute limite de propriété (capacité de gestion) : proposée, à valider après simulation.
8. Standing (prix du m²) = plafond de construction ; lieux marquants (mairie, église…) = potentiel supérieur.
9. **Nom du jeu : Cadastra.** Monnaie : les pièces.
10. Packs : toutes les raretés sauf monuments, chances décroissantes ; jamais de doublon (sinon le lieu libre de même rareté le plus proche). Pas de domicile. Pas de bonus de collection en V1. France seulement.
12. Style cartoon, tout en IA guidée par Claude ; lancement public direct sans date ; toutes les soirées, devant Arena ; budget 20 €/semaine max ; monnaie = « pièces ».
11. Inscription obligatoire (e-mail ou Google/Apple). PWA + Stripe en V1, stores en V2. Multi-comptes : risque accepté en V1. Push : V2. Modération : filtre de pseudos + bouton Signaler, Gautier traite à la main.

## 5. Pièges connus

- **Les tuiles et polices IGN** sont gratuites mais pas illimitées : prévoir d'héberger nos tuiles si le jeu décolle.
- **WFS IGN** : les départements entiers sont lourds (20 Mo) → contours simplifiés embarqués (`data/geo.js`) ; les communes se chargent à la demande (petites) et se simplifient côté client.
- **Axes des coordonnées** : le WFS en EPSG:4326 renvoie lat,lon ; les tuiles et la BAN renvoient lon,lat. Toujours normaliser.
- **Le point BAN d'une adresse** tombe parfois sur le trottoir : chercher la parcelle la plus proche à quelques mètres, pas seulement celle qui contient le point.
- **Les lieux nommés n'ont souvent pas d'adresse** (l'église de Clévilliers) : l'objet du jeu est le lieu, pas l'adresse.
- **Street View** : jamais stocker d'image (interdit) ; intégration dynamique seulement.
- **La fenêtre interne de l'app Claude** ne fait pas tourner WebGL : tester dans Safari/Chrome.
- **Performance de la révélation** : pas de filtres SVG animés, contours simplifiés, arrêter la boucle Three.js dès qu'elle n'est plus visible.
- **Données ouvertes hors IGN** : Gautier a autorisé `www.data.gouv.fr`, `static.data.gouv.fr` et `query.wikidata.org` (2 nov. 2026) ; `www.wikidata.org` reste fermé. www.data.gouv.fr coupe souvent la connexion (réessayer). Le service SPARQL de Wikidata limite parfois à **une requête par minute** (429) : `tools/wikidata_celebres.py` attend et garde chaque réponse dans `data/sources/.celebres_brouillon/` (hors dépôt) pour reprendre ; `--fusion` assemble ce qui est déjà reçu. Les sources brutes restent versionnées dans `data/sources/`.
- **Coordonnées Wikidata** : certaines positions sont « inconnues » (nœud anonyme au lieu de `Point(lon lat)`) : les écarter.
- **Ne jamais mettre l'adresse e-mail de Gautier** dans un en-tête (User-Agent) ou une requête : l'User-Agent des outils cite l'adresse du dépôt.
- **Faille packs → revente → ₳** : ne jamais ajouter de rachat par la banque ni de récompense en ₳ à la revente.
- **Publication** : le workflow lance `npm test` directement ; pas de `npm ci` tant qu'il n'y a pas de `package-lock.json` (sinon la mise en ligne échoue en silence et le lien donne une erreur 404). Après une mise en ligne, le téléphone peut garder l'ancienne page 404 en cache quelques minutes : recharger.
- **Repères sur la carte en 3D** : un point dessiné au sol (couche `circle`) au milieu d'un bâtiment est caché par le bâtiment en relief. Pour un lieu à voir et à toucher (lieux célèbres, badges), utiliser un repère HTML (`maplibregl.Marker`), toujours au-dessus.
