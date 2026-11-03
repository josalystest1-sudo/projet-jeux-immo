# Cadastra — Document de conception V1

Nom du jeu : **Cadastra** (choisi par Gautier le 2 nov. 2026). Version du 2 novembre 2026, issue de l'interview de Gautier et du prototype `proto/`.

Étiquettes : **[Décidé]** = tranché par Gautier · **[Proposé]** = choix de Claude, à valider · **[V2]** = pas en version 1.

---

## 1. La promesse

« Un jeu où tu collectionnes des rues de la vraie vie, le but est d'en avoir le plus possible, tu peux en racheter à d'autres joueurs : WikiMasters, mais dans la vraie vie. » **[Décidé]**

- Tout public, partout, **sessions de 10 minutes**. **[Décidé]**
- Ce qui fait revenir demain : **le pack gratuit du jour et la récolte des loyers**. **[Décidé]**
- Ce qui fait rester : **la collection** (« j'ai ma rue »), **la compétition** (« je suis Maire »), **la fortune** (« j'ai un empire »). Dans cet ordre. **[Décidé]**
- Ton : sérieux / neutre. **[Décidé]**
- Lignes rouges : un jeu qui ne rapporte rien, un jeu sans joueurs. **[Décidé]**
- Pas de blockchain, pas de NFT, jamais de conversion monnaie du jeu → euros. **[Décidé]**

## 2. L'objet du jeu : le lieu

Un **lieu** = une adresse (Base Adresse Nationale, 26 millions) **ou** un point d'intérêt nommé (église, mairie, château, gare, musée… : base des POI de l'IGN + Wikidata), **ou** un monument (liste fermée). Chaque lieu est **unique** : un seul propriétaire à la fois. **[Décidé]**

Chaque lieu porte :
- sa **commune** (code INSEE ; à Paris, Lyon, Marseille : l'arrondissement) ;
- son **standing** : le niveau de prix de la commune, calculé avec les ventes immobilières réelles (DVF, open data), mis à jour chaque année. Trois paliers : 1 (modeste), 2 (moyen), 3 (cher). **[Décidé]** (Depuis le 3 nov., le palier fait la rareté d'une adresse, et la rareté le plafond : 1 Commun → Maison, 2 Peu commun → Immeuble, 3 Épique → Gratte-ciel.) Calcul (2 nov. 2026, `data/sources/standing_dvf.txt`) : prix moyen au m² 2022-2024 pondéré par les ventes ; **3 si ≥ 4 500 €/m²** (615 communes : Paris, Lyon, Bordeaux, Nice, petite couronne chère, Côte d'Azur, stations), **2 si ≥ 2 500 €/m²** (5 146 communes), 1 sinon (≈ 29 000). Paris, Lyon, Marseille : le prix de la ville vaut pour tous ses arrondissements. Alsace-Moselle (pas de DVF) : Strasbourg et Colmar au 2, le reste au 1. **[Proposé]**
- sa **notoriété** : Commune / Connue / Célèbre / Monument, calculée automatiquement (article Wikipédia du lieu ou de la rue, catégorie IGN/OSM, photos Commons), monuments vérifiés à la main. **[Décidé]**
  - Mise en œuvre (2 nov. 2026) : une adresse = Commune ; un lieu nommé de l'IGN (église, mairie, château, gare, musée…) = Connue ; un lieu qui a un **article Wikipédia en français** (liste Wikidata `data/celebres/<département>.json`) = **Célèbre** ; les 458 monuments = Monument. Un lieu nommé de l'IGN est reconnu comme le lieu de Wikidata s'il est à moins de 400 m avec un nom compatible (« Église Saint-Martin » ↔ « église Saint-Martin de Clévilliers »), ou à moins de 150 m dans la même famille quand l'un des deux n'a pas de nom propre (« Mairie » ↔ « hôtel de ville de Bagneux »). Un lieu Célèbre est **Légendaire** et monte jusqu'au **Palace**, même au standing 1. **[Proposé]**
- son **plafond de construction** : **un bâtiment par rareté** (tableau ci-dessous) : la rareté N monte de N étages. **[Décidé par Gautier, 3 nov. : « il faut pouvoir avoir un bâtiment en plus », « tu as 2 immeubles » ; les noms Gratte-ciel et Palace sont proposés par Claude]** (Avant : standing + bonus de notoriété, au plus la Tour.)
- sa **rareté** (visuelle, celle des cartes), six raretés **[Décidé par Gautier, 3 nov. 2026]** :
  | Rareté | Couleur | Règle | Plafond |
  |---|---|---|---|
  | Commun | gris | adresse au standing 1 | Maison |
  | Peu commun | vert | adresse au standing 2 | Immeuble |
  | Rare | bleu | lieu Connu (église, mairie…) au standing 1 | Tour |
  | Épique | violet | adresse au standing 3, ou lieu Connu au standing 2 ou 3 | Gratte-ciel |
  | Légendaire | orange | lieu Célèbre (article Wikipédia) | Palace |
  | Extraordinaire | arc-en-ciel | monument : jamais dans un pack, seulement aux enchères | Prestige |

## 3. Obtenir des lieux

**Un lieu libre ne s'achète pas** : il n'appartient à personne et ne s'obtient que dans un pack (les monuments, aux enchères). On n'achète un lieu qu'à un joueur qui l'a mis en vente, ou en lui faisant une offre ou un échange. **[Décidé par Gautier, 3 nov.]**

### Le pack du jour **[Décidé]**
- 1 pack gratuit par jour et par compte, **5 lieux tirés au hasard dans toute la France** (pas de région privilégiée : pour avoir sa région, on achète des packs et on prie, ou on revend et on rachète).
- **Pas de doublon** : un lieu déjà possédé n'est jamais tiré ; si malgré tout ça arrive, on tire le lieu libre **de même rareté le plus proche**. **[Décidé]**
- Un pack peut contenir **toutes les raretés** sauf les monuments (réservés aux enchères), avec des chances décroissantes : Commun > Peu commun > Rare > Épique > Légendaire. **[Décidé]** Chiffres de départ : 60 % / 25 % / 10 % / 4 % / 1 % par carte. **[Proposé]**
  - Mise en œuvre (2 nov. 2026, `src/regles/pack.js`, tirage simulé dans la page en attendant le serveur) **[Proposé]** : la rareté de chaque carte est tirée avec une graine (joueur + jour) ; puis un lieu libre de cette rareté n'importe où en France. Commun : l'adresse la plus proche d'un point au hasard du territoire. Peu commun : une adresse d'une commune au standing 2. Rare : un lieu nommé (église, mairie, château, gare, musée) qui a un vrai nom, près d'un point au hasard. Épique : une adresse d'une commune au standing 3. Légendaire : un lieu célèbre (Wikipédia) au hasard en France. Un lieu déjà possédé est remplacé par un autre tirage de même rareté ; si la rareté voulue échoue (réseau), la carte devient Commune, et le pack a toujours ses 5 cartes.
  - La révélation d'une carte s'accélère d'un toucher (×4, puis ×12). **[Décidé par Gautier, 2 nov.]**
- Packs payants : 1 pack 1,99 € · 5 packs 7,99 € · 12 packs 16,99 € · **Pass mensuel 4,99 €** = +1 pack par jour pendant 30 jours. Prix de lancement à ajuster avec les premiers chiffres. **[Décidé]** Probabilités affichées dans la boutique (obligation loot boxes) ; pas de vente en Belgique et aux Pays-Bas.
- L'ouverture est un moment : fondu au noir, pack 3D métallisé, déchirure au doigt, révélation façon FIFA (France → département → commune → rue) puis la carte se retourne (cf. prototype). **[Décidé]**

### Le marché entre joueurs **[Décidé]**
- Pas de vente à la banque : un lieu ne se vend qu'à un joueur, et ne s'achète qu'à un joueur (pas d'achat d'un lieu libre).
- Un propriétaire peut **mettre en vente** à un prix libre : le lieu porte un badge 💰 sur la carte, n'importe qui l'achète au prix affiché. Mise en œuvre (3 nov. 2026, demande de Gautier : « on doit pouvoir mettre le montant qu'on veut ») : le vendeur tape son prix (un entier de 1 à un milliard de pièces, raccourcis « la valeur », +10 %, +25 %, +50 %, × 2, l'écart à la valeur affiché), peut le changer ou retirer le lieu de la vente. Les achats par les autres joueurs viendront avec le serveur. **[Décidé par Gautier]**
- N'importe qui peut **faire une offre** sur n'importe quel lieu, même pas en vente. Une offre n'expire jamais ; elle peut être modifiée ou annulée à tout moment ; le propriétaire accepte ou refuse. Les fonds sont vérifiés à l'acceptation.
- **Échanger** (demande de Gautier, 3 nov. 2026) : sur le lieu d'un autre joueur, « Proposer un échange » : on choisit un ou plusieurs de ses lieux (par exemple trois de ses adresses contre sa rue ; demande de Gautier, 3 nov.) et on peut ajouter des pièces ; la fenêtre montre ce qu'on donne et ce qu'on reçoit. L'autre joueur accepte ou refuse ; tant qu'il n'a pas répondu, on peut annuler. À l'acceptation, les deux lieux changent de main (chacun garde ses constructions) et les pièces passent ; si l'un des lieux a changé de main entre-temps, l'échange tombe. Un même lieu ne peut être proposé que dans un échange à la fois ; si un seul des lieux proposés a changé de main, l'échange tombe. En attendant le serveur, les joueurs simulés répondent en 45 s et acceptent si on leur donne au moins 10 % de plus que ce qu'ils cèdent. **[Décidé par Gautier ; le détail est Proposé]**
- Aucune taxe, aucun délai de blocage. **[Décidé]**

### Les enchères de monuments **[Décidé]**

La liste (`data/monuments.json`, 2 nov. 2026) : 458 monuments tirés de Wikidata (monuments historiques et sites UNESCO de métropole, classés par nombre d'articles Wikipédia) ; les **60 premiers sont nationaux**, les **398 suivants régionaux**. Retirés : les ensembles qui ne sont pas un lieu (canal du Midi, chemins de Saint-Jacques, fortifications de Vauban…). Ajoutés à la main : tour Eiffel, Notre-Dame-de-la-Garde, viaduc de Millau. Mont-Saint-Michel forcé en national, château de Montsoreau en régional. **[Proposé, à relire par Gautier]**

- **3 enchères par semaine pour toute la France** : 1 monument **national** (liste d'environ 60 : tour Eiffel, Mont-Saint-Michel, Chambord…) + 2 monuments **régionaux** (liste d'environ 400, mise de départ plus basse). **[Proposé pour la répartition]**
- Mises pendant 7 jours. Une mise doit être couverte par le solde ; elle bloque les fonds tant qu'on mène ; si le meneur n'a plus les fonds à la clôture, l'enchère passe à la mise suivante, et ainsi de suite.
- Une fois attribués, les monuments circulent par offres entre joueurs.
- Ordre des monuments : fixé par Gautier (calendrier éditorial), les joueurs voient les 3 suivants. **[Proposé]**
- Mise en œuvre (2 nov. 2026, `src/regles/encheres.js`, réglages `data/economie.json` → `encheres`) **[Proposé]** :
  - en attendant le calendrier de Gautier, les monuments passent dans l'ordre de la liste (les plus connus d'abord) : 60 semaines sans qu'un monument revienne ;
  - mise de départ : national 10 000 + 600 par article Wikipédia (arrondie au millier), régional 3 000 + 200 par article (arrondie à 500) ;
  - surenchère minimale : +5 % sur la meilleure mise ;
  - avec trois enchères en même temps, une mise doit être couverte par le solde **moins les mises qui mènent sur les autres enchères** ; sur la même enchère, la nouvelle mise remplace l'ancienne ;
  - à la clôture, chaque joueur compte pour sa plus haute mise ; à montant égal, la plus ancienne gagne ; personne n'a les fonds : le monument reste libre (il repassera).

### Le domicile
**Pas de notion de domicile** dans le jeu : le joueur ne déclare aucune adresse personnelle. **[Décidé]**

## 4. L'argent du jeu : le ₳ (nom à choisir)

- **Salaire quotidien** identique pour tous. **[Décidé]**
- **Loyer** par lieu, selon ce qui est construit : Terrain, Maison, Immeuble, Tour, Gratte-ciel, Palace, Prestige (monuments seulement), chacun jusqu'au bâtiment de sa rareté. Le loyer **ne dépend pas de la chance** : une belle adresse permet de construire plus haut, elle ne rapporte pas plus toute seule. **[Décidé]**
- **Récolte à la connexion** : le loyer s'accumule hors ligne, au plus **24 h**, puis s'arrête. Se connecter chaque jour est donc le geste de base. **[Décidé]** À l'ouverture du jeu, une fenêtre « La récolte » montre le montant gagné pendant l'absence (et prévient quand le stock était plein), un bouton « Récolter », puis le pack du jour s'ouvre. **[Proposé]**
- **Construction instantanée**, payée en ₳ : Maison → Immeuble → Tour → Gratte-ciel → Palace → Prestige. **[Décidé]**
- Le ₳ sert à : construire, acheter des lieux à des joueurs, faire des offres, enchérir. **[Décidé]** (V2 possible : projets de quartier, cosmétiques.)
- Chiffres de départ (à régler avec la simulation, § 10) **[Proposé]** :
  | | Coût (× valeur de base du lieu) | Loyer / jour |
  |---|---|---|
  | Terrain | — | 10 |
  | Maison | ×1 | 40 |
  | Immeuble | ×2,5 | 110 |
  | Tour | ×6 | 310 |
  | Gratte-ciel | ×10 | 600 |
  | Palace | ×12 | 800 |
  | Prestige (monument) | ×15 | 1 000 |
  Salaire : 200 ₳/jour. Valeur de base : standing 1 = 500, 2 = 1 500, 3 = 4 000 ; lieu Connu ×2, Célèbre ×4, monument ×10.
- Garde-fous contre « packs → revente → ₳ » : pas de vente à la banque (un stock invendu ne vaut rien), et la **capacité de gestion** : un compte gère au plus N lieux, N monte avec le niveau de joueur (gagné en jouant : connexion quotidienne, constructions, collections). Quand on est plein, un pack propose de remplacer un lieu par le nouveau. **[Proposé]** — Gautier préfère éviter les limites ; à valider après la simulation.

## 5. Le Maire **[Décidé]**

- Dans chaque commune (arrondissement à Paris/Lyon/Marseille), le Maire est le joueur qui possède le **plus de lieux**. En cas d'égalité, les deux sont Maires. Le titre vaut tant que la condition tient (pas de saison).
- Le titre est du prestige : visible sur le profil, sur la fiche de la commune, sur la carte (écusson). Aucun bonus en V1. **[Proposé]**

## 6. Les collections **[V2]**

Pas de bonus de collection en V1. **[Décidé]** En V2 : « toute ma rue », « les 20 arrondissements », « une adresse par département »… avec badge sur le profil (jamais de ₳).

## 7. Les écrans **[Décidé]**

Style et ergonomie (3 nov. 2026, demande de Gautier) : voir `docs/DESIGN.md` (« la plaque et la pièce »). La carte est l'accueil ; la barre du bas : Carte, Patrimoine, **le pack du jour au centre** (bouton rond doré, compte à rebours quand il n'est pas prêt), Enchères, Communes ; les notifications sous la cloche, en haut ; les réglages dans le profil (et la roue des notifications) ; un guide des premiers pas (6 bulles) après le premier pack, à revoir dans les réglages ; installable sur l'écran d'accueil (`manifest.webmanifest`). **[Proposé]**

1. **Carte** (accueil) : ville 3D stylisée (bâtiments IGN extrudés, rues, parcs, eau), vue 3D ou 2D, recherche d'adresse ; parcelles colorées (moi / autres / partagée / libre), badges construction 🏠🏢🏙, badge 💰 en vente, monuments dorés avec halo et étiquette. Fiche d'une parcelle : Street View intégré (gratuit, rien n'est stocké), surface, plafond, la liste de ses lieux avec propriétaire (cliquable → profil), construction, mettre en vente, acheter, faire une offre.
2. **Patrimoine** : lieux en cartes à bordure brillante selon la rareté, filtres, valeur totale, revenu/jour, récolte, mes ventes en cours.
3. **Enchères** : les 3 enchères de la semaine, mises, historique, les prochains monuments.
4. **Communes** : par commune, le Maire et le classement ; recherche d'une commune.
5. **Profil d'un joueur** : pseudo, avatar, patrimoine, titres de Maire, collections.
6. **Notifications** : offres reçues (accepter / refuser), surenchère, vente conclue, pack prêt ; réglages (recevoir les offres, ignorer les offres sous la valeur, alertes d'enchères).
7. **Création de compte** : **inscription obligatoire** (e-mail + mot de passe, ou Google/Apple), puis pseudo + avatar. **[Décidé]**
   Mise en œuvre (2 nov. 2026, `src/compte.js`, Supabase) : e-mail + mot de passe (8 caractères au moins), confirmation par un lien reçu par e-mail qui ramène dans le jeu connecté (le lien marche même ouvert dans une autre application), « Renvoyer l'e-mail », « Mot de passe oublié » ; l'écran de compte ne se ferme pas tant qu'on n'est pas connecté ; puis le pseudo (filtre + unicité vérifiée par le serveur) et l'avatar, obligatoires ; **le pseudo est définitif : il se choisit une seule fois, à la création, confirmé d'un second appui, et ne se modifie plus ensuite (seule l'icône change). Le serveur l'interdit aussi ; seul Gautier peut corriger un pseudo, depuis le tableau de bord, s'il est signalé. [Décidé par Gautier, 2 nov.]** ; la session reste ouverte d'une visite à l'autre ; « Se déconnecter » dans son profil. Les lieux et les pièces restent sur l'appareil jusqu'à la phase serveur ; un autre compte sur le même appareil repart d'un état neuf. Google et Apple : plus tard. **[Proposé]**
8. **Boutique** : packs, Pass mensuel. **[V1 fin]**

## 8. Les données et leur source (toutes ouvertes et gratuites)

| Besoin | Source | Usage |
|---|---|---|
| Adresses | BAN (data.gouv / géoplateforme IGN) | tirage des packs, fiche, recherche, reverse |
| Points d'intérêt | géocodage IGN index `poi`, OSM, Wikidata | lieux Connus / Célèbres |
| Parcelles | PCI vecteur (tuiles `PCI` géoplateforme) | la carte cliquable |
| Bâtiments avec hauteur, rues, parcs, eau | BD TOPO (tuiles vectorielles géoplateforme) | la ville 3D |
| Communes, départements, France | ADMIN EXPRESS (WFS + fichiers simplifiés embarqués) | révélation FIFA, écran Communes |
| Prix immobiliers | DVF (data.gouv) | le standing |
| Notoriété | Wikidata / Wikipédia (pages vues), Commons | la notoriété |
| Devanture | Google Street View intégré (Maps Embed, gratuit, non stocké) | fiche d'un lieu |
| Polices de carte | géoplateforme (`annexes/ressources/vectorTiles/fonts`) | noms de rues |

Règles : jamais de nom de personne, jamais de lien adresse ↔ identité, le domicile n'est jamais révélé. Les tuiles IGN sont gratuites avec attribution ; si le trafic devient important, on héberge nos propres tuiles (gratuit, un script).

## 8 bis. Plateforme, sécurité, modération **[Décidé]**

- **V1 = site web installable (PWA)**, paiements Stripe ; **stores en V2** (avec les vibrations iPhone et les achats intégrés).
- **Multi-comptes** : on accepte le risque en V1 (limites simples par appareil et par IP côté serveur, sans numéro de téléphone).
- **Notifications push** : V2. En V1, le centre de notifications dans le jeu suffit.
- **Modération** : filtre automatique des pseudos ; un bouton **Signaler** sur chaque profil ; Gautier traite les signalements lui-même (bannissement manuel).
  - Mise en œuvre (2 nov. 2026) **[Proposé]** : pseudo de 3 à 16 caractères (lettres, chiffres, espace, tiret, point, tiret bas ; deux lettres au moins), unique sans tenir compte des majuscules ni des accents. Le filtre (`src/regles/pseudo.js`, listes `data/moderation.json`) bloque les racines interdites partout dans le pseudo (« putain », « salope »…) et les mots courts seulement quand ils forment un mot entier (« con » dans « GrosCon », pas dans « Conrad » ni « Calcul »), y compris déguisés (chiffres pour des lettres, points entre les lettres, lettres répétées) ; il réserve « admin », « modo », « Cadastra », « officiel », « support »… Signaler : une raison (pseudo inapproprié, triche ou plusieurs comptes, comportement, autre) et un détail facultatif ; un même joueur au plus une fois par jour ; le joueur signalé ne sait pas qui l'a signalé.

## 9. Monétisation **[Décidé]**

- V1 : **packs** et **Pass mensuel**. Rien d'autre.
- V2 : cosmétiques (styles de bâtiments, plaques), commerces réels partenaires sur la carte, cadeaux (« offre la rue de ton enfance »), partenariats immobilier.
- Jamais : vente d'un lieu précis, de loyer, de construction, de ₳.

## 10. Équilibrage

Une **simulation à agents** (joueurs gratuits, payants, chanceux, inactifs, sur 6 mois) vérifie avant le lancement : que le gratuit assidu progresse, que le gros acheteur de packs ne « roule » pas sur une ville, que les prix du marché restent sains, et que la masse de ₳ ne s'emballe pas. Les chiffres du § 4 sont réglés par cette simulation, puis par les vrais joueurs.

## 11. Ordre de construction (voir `PLAN.md`)

Tout le game design d'abord (fonctions complètes, serveur simulé → vrai serveur), puis les graphismes (pochette, cartes, monuments 3D, sons), l'équilibrage en dernier. Même méthode que le Projet Arena.

## 12. Nom, monnaie, style, lancement **[Décidé le 2 nov.]**

- **Monnaie : les « pièces »**. Son signe : une pièce d'or en forme de maison, frappée d'un C (demande de Gautier le 3 nov. : « un signe plus original » ; dessin proposé par Claude). **[Proposé]**
- **Nom : Cadastra.** **[Décidé le 2 nov., à confirmer]** Vérifications du 2 nov. :
  - Domaines : cadastra.fr pris (février 2026, site inactif), cadastra.com pris (agence brésilienne Cadastra), cadastra.app pris (avril 2026, site en erreur). Libre : cadastra-jeu.fr.
  - Marques (base INPI, qui couvre aussi les marques européennes et internationales visant la France) : « CadastrA » **enregistrée en France** (2021, société DEPGA) en classes 6, 19, 35, 36 (immobilier), 37, 42 (logiciels / informatique), 45 ; « Cadastra » internationale (2024, Cadastra Marketing Digital) en classe 35. Aucune en classes 9 / 41 (jeux), mais la proximité immobilier + logiciel crée un risque d'opposition. Avis d'un professionnel conseillé avant dépôt.
- **Style visuel : cartoon** (ville 3D stylisée aux couleurs franches, pochette et cartes illustrées façon jeu mobile), **tout produit avec des outils d'IA**, Claude guide la chaîne d'outils (comme pour Arena : image → modèle 3D, textures, animations).
- **Lancement public direct**, sans date fixée ; pas de bêta amis.
- **Rythme** : toutes les soirées de Gautier, ce projet passe devant Arena.
- **Budget** : 20 € par semaine au plus (domaine, Supabase si trafic, outils d'image/3D).

## 13. Ce qui reste ouvert (interview à finir)

- Hors France : **France seulement en V1**. **[Décidé]** Modèle de données prêt pour d'autres pays. **[Proposé]**
- Visuel de la carte d'un lieu : V1 = photo aérienne IGN du bâtiment avec sa parcelle + cadre de rareté ; V2 = rendu 3D stylisé. **[Proposé]**
- Calendrier des monuments.
- Capacité de gestion (§ 4) : à valider ou remplacer après simulation.
