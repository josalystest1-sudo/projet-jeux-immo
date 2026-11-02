# Jeu des adresses — Document de conception V1

Nom provisoire : **« Cadastre »** (voir § 12 pour les autres pistes). Version du 2 novembre 2026, issue de l'interview de Gautier et du prototype `proto/`.

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
- son **standing** : le niveau de prix du quartier, calculé avec les ventes immobilières réelles (DVF, open data), mis à jour chaque semestre. Trois paliers : 1 (Maison), 2 (Immeuble), 3 (Tour). **[Décidé]**
- sa **notoriété** : Commune / Connue / Célèbre / Monument, calculée automatiquement (article Wikipédia du lieu ou de la rue, catégorie IGN/OSM, photos Commons), monuments vérifiés à la main. **[Décidé]**
- son **plafond de construction** = standing + bonus de notoriété (Connue +1, Célèbre +2), au plus la Tour ; les monuments ont en plus le niveau « Prestige ». **[Décidé]**
- sa **rareté** (visuelle, celle des cartes) :
  | Rareté | Règle |
  |---|---|
  | Commun | adresse, plafond Maison |
  | Peu commun | adresse, plafond Immeuble |
  | Rare | lieu Connu (église, mairie…) ou plafond Immeuble en lieu Connu |
  | Épique | plafond Tour (standing 3, ou lieu Célèbre) |
  | Légendaire | monument |

## 3. Obtenir des lieux

### Le pack du jour **[Décidé]**
- 1 pack gratuit par jour et par compte, **5 lieux tirés au hasard dans toute la France** (pas de région privilégiée : pour avoir sa région, on achète des packs et on prie, ou on revend et on rachète).
- **Pas de doublon** : un lieu déjà possédé n'est jamais tiré ; si malgré tout ça arrive, on tire le lieu libre **de même rareté le plus proche**. **[Décidé]**
- Un pack peut contenir **toutes les raretés** sauf les monuments (réservés aux enchères), avec des chances décroissantes : Commun > Peu commun > Rare > Épique. **[Décidé]** Chiffres de départ : 60 % / 26 % / 11 % / 3 % par carte. **[Proposé]**
- Packs payants : 1 pack 1,99 € · 5 packs 7,99 € · 12 packs 16,99 € · **Pass mensuel 4,99 €** = +1 pack par jour pendant 30 jours. Prix de lancement à ajuster avec les premiers chiffres. **[Décidé]** Probabilités affichées dans la boutique (obligation loot boxes) ; pas de vente en Belgique et aux Pays-Bas.
- L'ouverture est un moment : fondu au noir, pack 3D métallisé, déchirure au doigt, révélation façon FIFA (France → département → commune → rue) puis la carte se retourne (cf. prototype). **[Décidé]**

### Le marché entre joueurs **[Décidé]**
- Pas de vente à la banque : un lieu ne se vend qu'à un joueur.
- Un propriétaire peut **mettre en vente** à un prix libre : le lieu porte un badge 💰 sur la carte, n'importe qui l'achète au prix affiché.
- N'importe qui peut **faire une offre** sur n'importe quel lieu, même pas en vente. Une offre n'expire jamais ; elle peut être modifiée ou annulée à tout moment ; le propriétaire accepte ou refuse. Les fonds sont vérifiés à l'acceptation.
- Aucune taxe, aucun délai de blocage. **[Décidé]**

### Les enchères de monuments **[Décidé]**
- **3 enchères par semaine pour toute la France** : 1 monument **légendaire national** (liste d'environ 60 : tour Eiffel, Mont-Saint-Michel, Chambord…) + 2 monuments **régionaux** (liste d'environ 400, mise de départ plus basse). **[Proposé pour la répartition]**
- Mises pendant 7 jours. Une mise doit être couverte par le solde ; elle bloque les fonds tant qu'on mène ; si le meneur n'a plus les fonds à la clôture, l'enchère passe à la mise suivante, et ainsi de suite.
- Une fois attribués, les monuments circulent par offres entre joueurs.
- Ordre des monuments : fixé par Gautier (calendrier éditorial), les joueurs voient les 3 suivants. **[Proposé]**

### Le domicile
**Pas de notion de domicile** dans le jeu : le joueur ne déclare aucune adresse personnelle. **[Décidé]**

## 4. L'argent du jeu : le ₳ (nom à choisir)

- **Salaire quotidien** identique pour tous. **[Décidé]**
- **Loyer** par lieu, selon ce qui est construit : Terrain, Maison, Immeuble, Tour, Prestige (monuments seulement). Le loyer **ne dépend pas de la chance** : une belle adresse permet de construire plus haut, elle ne rapporte pas plus toute seule. **[Décidé]**
- **Récolte à la connexion** : le loyer s'accumule hors ligne, au plus **24 h**, puis s'arrête. Se connecter chaque jour est donc le geste de base. **[Décidé]**
- **Construction instantanée**, payée en ₳ : Maison → Immeuble → Tour → Prestige. **[Décidé]**
- Le ₳ sert à : construire, acheter des lieux à des joueurs, faire des offres, enchérir. **[Décidé]** (V2 possible : projets de quartier, cosmétiques.)
- Chiffres de départ (à régler avec la simulation, § 10) **[Proposé]** :
  | | Coût (× valeur de base du lieu) | Loyer / jour |
  |---|---|---|
  | Terrain | — | 10 |
  | Maison | ×1 | 40 |
  | Immeuble | ×2,5 | 110 |
  | Tour | ×6 | 310 |
  | Prestige (monument) | ×15 | 1 000 |
  Salaire : 200 ₳/jour. Valeur de base : standing 1 = 500, 2 = 1 500, 3 = 4 000 ; lieu Connu ×2, Célèbre ×4.
- Garde-fous contre « packs → revente → ₳ » : pas de vente à la banque (un stock invendu ne vaut rien), et la **capacité de gestion** : un compte gère au plus N lieux, N monte avec le niveau de joueur (gagné en jouant : connexion quotidienne, constructions, collections). Quand on est plein, un pack propose de remplacer un lieu par le nouveau. **[Proposé]** — Gautier préfère éviter les limites ; à valider après la simulation.

## 5. Le Maire **[Décidé]**

- Dans chaque commune (arrondissement à Paris/Lyon/Marseille), le Maire est le joueur qui possède le **plus de lieux**. En cas d'égalité, les deux sont Maires. Le titre vaut tant que la condition tient (pas de saison).
- Le titre est du prestige : visible sur le profil, sur la fiche de la commune, sur la carte (écusson). Aucun bonus en V1. **[Proposé]**

## 6. Les collections **[V2]**

Pas de bonus de collection en V1. **[Décidé]** En V2 : « toute ma rue », « les 20 arrondissements », « une adresse par département »… avec badge sur le profil (jamais de ₳).

## 7. Les écrans **[Décidé]**

1. **Carte** (accueil) : ville 3D stylisée (bâtiments IGN extrudés, rues, parcs, eau), vue 3D ou 2D, recherche d'adresse ; parcelles colorées (moi / autres / partagée / libre), badges construction 🏠🏢🏙, badge 💰 en vente, monuments dorés avec halo et étiquette. Fiche d'une parcelle : Street View intégré (gratuit, rien n'est stocké), surface, plafond, la liste de ses lieux avec propriétaire (cliquable → profil), construction, mettre en vente, acheter, faire une offre.
2. **Patrimoine** : lieux en cartes à bordure brillante selon la rareté, filtres, valeur totale, revenu/jour, récolte, mes ventes en cours.
3. **Enchères** : les 3 enchères de la semaine, mises, historique, les prochains monuments.
4. **Communes** : par commune, le Maire et le classement ; recherche d'une commune.
5. **Profil d'un joueur** : pseudo, avatar, patrimoine, titres de Maire, collections.
6. **Notifications** : offres reçues (accepter / refuser), surenchère, vente conclue, pack prêt ; réglages (recevoir les offres, ignorer les offres sous la valeur, alertes d'enchères).
7. **Création de compte** : **inscription obligatoire** (e-mail + mot de passe, ou Google/Apple), puis pseudo + avatar. **[Décidé]**
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

## 9. Monétisation **[Décidé]**

- V1 : **packs** et **Pass mensuel**. Rien d'autre.
- V2 : cosmétiques (styles de bâtiments, plaques), commerces réels partenaires sur la carte, cadeaux (« offre la rue de ton enfance »), partenariats immobilier.
- Jamais : vente d'un lieu précis, de loyer, de construction, de ₳.

## 10. Équilibrage

Une **simulation à agents** (joueurs gratuits, payants, chanceux, inactifs, sur 6 mois) vérifie avant le lancement : que le gratuit assidu progresse, que le gros acheteur de packs ne « roule » pas sur une ville, que les prix du marché restent sains, et que la masse de ₳ ne s'emballe pas. Les chiffres du § 4 sont réglés par cette simulation, puis par les vrais joueurs.

## 11. Ordre de construction (voir `PLAN.md`)

Tout le game design d'abord (fonctions complètes, serveur simulé → vrai serveur), puis les graphismes (pochette, cartes, monuments 3D, sons), l'équilibrage en dernier. Même méthode que le Projet Arena.

## 12. Nom, monnaie, style, lancement **[Décidé le 2 nov.]**

- **Monnaie : les « pièces »**.
- **Nom** : sérieux/neutre mais qui « sonne jeu ». Pistes : **Cadastra** · **Parcelia** · **Rentier** · **Quartiers** · **Bâtisseurs** · **Adressa** · **Capitale** · **Lotissement**. À vérifier avant choix : marque (INPI), domaine .fr, nom libre sur les stores. **[À décider par Gautier]**
- **Style visuel : cartoon** (ville 3D stylisée aux couleurs franches, pochette et cartes illustrées façon jeu mobile), **tout produit avec des outils d'IA**, Claude guide la chaîne d'outils (comme pour Arena : image → modèle 3D, textures, animations).
- **Lancement public direct**, sans date fixée ; pas de bêta amis.
- **Rythme** : toutes les soirées de Gautier, ce projet passe devant Arena.
- **Budget** : 20 € par semaine au plus (domaine, Supabase si trafic, outils d'image/3D).

## 13. Ce qui reste ouvert (interview à finir)

- Hors France : **France seulement en V1**. **[Décidé]** Modèle de données prêt pour d'autres pays. **[Proposé]**
- Visuel de la carte d'un lieu : V1 = photo aérienne IGN du bâtiment avec sa parcelle + cadre de rareté ; V2 = rendu 3D stylisé. **[Proposé]**
- Nom de la monnaie, nom du jeu, calendrier des monuments.
- Capacité de gestion (§ 4) : à valider ou remplacer après simulation.
