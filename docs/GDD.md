# Cadastra — Document de conception V1

Nom du jeu : **CityDeck** (décidé par Gautier le 4 nov. 2026 ; avant : Cadastra, le nom de travail du 2 nov.). Version du 2 novembre 2026, issue de l'interview de Gautier et du prototype `proto/`.

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
  - Mise en œuvre (2 nov. 2026) : une adresse = Commune ; un lieu nommé de l'IGN (église, mairie, château, gare, musée…) = Connue ; un lieu qui a un **article Wikipédia en français** (liste Wikidata `data/celebres/<département>.json`) = **Célèbre** ; les 463 monuments = Monument. Un lieu nommé de l'IGN est reconnu comme le lieu de Wikidata s'il est à moins de 400 m avec un nom compatible (« Église Saint-Martin » ↔ « église Saint-Martin de Clévilliers »), ou à moins de 150 m dans la même famille quand l'un des deux n'a pas de nom propre (« Mairie » ↔ « hôtel de ville de Bagneux »). Un lieu Célèbre est **Légendaire** et monte jusqu'au **Palace**, même au standing 1. **[Proposé]**
  - **Les lieux de culte** : toutes les religions sont présentes, sans quota (églises, temples, mosquées, synagogues, églises orthodoxes, temples bouddhistes et hindous, gurdwaras), avec les mêmes règles pour toutes. Les églises restent les plus nombreuses parce qu'il y en a le plus. Dans les lieux célèbres, c'est toute catégorie de lieu de culte de Wikidata qui a un article. Dans les packs (Rare), le « lieu de culte » est le plus proche du point tiré, quelle que soit sa religion. **[Décidé par Gautier, 4 nov. : « si il y a plus d'églises c'est comme ça, mais les autres lieux de culte doivent aussi être présents »]**
- son **plafond de construction** : **un bâtiment par rareté** (tableau ci-dessous) : la rareté N monte de N étages. **[Décidé par Gautier, 3 nov. : « il faut pouvoir avoir un bâtiment en plus », « tu as 2 immeubles » ; les noms Gratte-ciel et Palace sont proposés par Claude]** (Avant : standing + bonus de notoriété, au plus la Tour.)
- sa **rareté** (visuelle, celle des cartes), six raretés **[Décidé par Gautier, 3 nov. 2026]** :
  | Rareté | Couleur | Règle | Plafond |
  |---|---|---|---|
  | Commun | gris | adresse au standing 1 | Maison |
  | Peu commun | vert | adresse au standing 2 | Immeuble |
  | Rare | bleu | lieu Connu (lieu de culte, mairie…) au standing 1 | Tour |
  | Épique | violet | adresse au standing 3, ou lieu Connu au standing 2 ou 3 | Gratte-ciel |
  | Légendaire | orange | lieu Célèbre (article Wikipédia) | Palace |
  | Extraordinaire | arc-en-ciel | monument : jamais dans un pack, seulement aux enchères | Prestige |

- sa **valeur de marché**, qui **bouge** **[Décidé par Gautier, 3 nov. 2026 : « la valeur ne doit pas rester fixe, il faut qu'elle fluctue »]** : valeur (terrain + tout ce qui a été dépensé en bâtiments) × un indice = (1 + ventes de la commune) × (1 + activité du quartier) × (1 + tendance de la semaine). Le **loyer** et le **coût des constructions** n'en dépendent pas. Chiffres de départ **[Proposé]** (`data/economie.json` → `fluctuation`) :
  - **ventes de la commune** : le prix moyen des ventes des 7 derniers jours du jeu rapporté à la valeur (un achat au-dessus de la valeur fait monter toute la commune), au plus ±30 % ;
  - **activité du quartier** : 1 % par point (1 + niveau de chaque autre lieu possédé à moins de 300 m), −5 % pour un lieu isolé, au plus +20 % ;
  - **tendance de la semaine** : chaque semaine du jeu, environ 12 % des départements « en vogue » (+5 à +15 %) et 12 % « en baisse », les mêmes pour tous, annoncés dans le patrimoine.

## 3. Obtenir des lieux

**Un lieu libre ne s'achète pas** : il n'appartient à personne et ne s'obtient que dans un pack (les monuments, aux enchères). On n'achète un lieu qu'à un joueur qui l'a mis en vente, ou en lui faisant une offre ou un échange. **[Décidé par Gautier, 3 nov.]**

### Le pack du jour **[Décidé]**
- 1 pack gratuit par jour et par compte, **5 lieux tirés au hasard dans toute la France** (pas de région privilégiée : pour avoir sa région, on achète des packs et on prie, ou on revend et on rachète).
- **Pas de doublon** : un lieu déjà possédé n'est jamais tiré ; si malgré tout ça arrive, on tire le lieu libre **de même rareté le plus proche**. **[Décidé]**
- Un pack peut contenir **toutes les raretés** sauf les monuments (réservés aux enchères), avec des chances décroissantes : Commun > Peu commun > Rare > Épique > Légendaire. **[Décidé]** Chiffres de départ : 60 % / 25 % / 10 % / 4 % / 1 % par carte. **[Proposé]**
  - Mise en œuvre (2 nov. 2026, `src/regles/pack.js`, tirage simulé dans la page en attendant le serveur) **[Proposé]** : la rareté de chaque carte est tirée avec une graine (joueur + jour) ; puis un lieu libre de cette rareté n'importe où en France. Commun : l'adresse la plus proche d'un point au hasard du territoire. Peu commun : une adresse d'une commune au standing 2. Rare : un lieu nommé (lieu de culte de toute religion, mairie, château, gare, musée) qui a un vrai nom, près d'un point au hasard. Épique : une adresse d'une commune au standing 3. Légendaire : un lieu célèbre (Wikipédia) au hasard en France. Un lieu déjà possédé est remplacé par un autre tirage de même rareté ; si la rareté voulue échoue (réseau), la carte devient Commune, et le pack a toujours ses 5 cartes.
  - La révélation d'une carte : un toucher passe à l'étape suivante (la France, la région, le département, la commune, la rue). **[Décidé par Gautier, 4 nov. ; avant : un toucher l'accélérait]**
- **Tout ce qui est payant s'achète en gemmes** (la monnaie premium, § 9), jamais directement en euros : **pack national** (5 lieux, toute la France) et **pack régional** (5 lieux dans la région choisie, un peu plus cher : on réduit le hasard). Probabilités affichées dans la boutique (obligation loot boxes) ; pas de vente en Belgique et aux Pays-Bas. **[Décidé par Gautier, 4 nov. après-midi ; remplace les prix en euros du matin]**
- **Le Pass 15 jours** (décision de Gautier du 4 nov. après-midi ; avant : Pass mensuel) **[Décidé]** :
  1. **le pack du jour a 8 cartes au lieu de 5**, tant que le Pass est actif ;
  2. **une adresse cible** : un bon pour prendre **l'adresse libre de son choix**, **hors Légendaire et monument** (donc jusqu'à Épique). Si l'adresse choisie est déjà à quelqu'un, le bon ne sert pas : on fait une offre à son propriétaire. C'est la seule exception à « un lieu libre ne s'achète pas, il sort des packs » (3 nov.) ;
  3. **pas de revente de lieux contre de l'argent réel** (packs payants + hasard + revente en euros = risque de jeu d'argent).
  À construire avec la boutique (phase 9). Détail **[Proposé]** : un bon par Pass, donné le jour de l'achat, se garde tant qu'un Pass est actif (3 au plus) ; le bon se choisit depuis la fiche d'une adresse libre (« Prendre avec mon bon ») ; un lieu pris avec un bon est un lieu comme un autre (il se construit, se vend, s'échange).
- L'ouverture est un moment : fondu au noir, pack 3D métallisé, déchirure au doigt, révélation façon FIFA (la rareté d'abord : une comète de sa couleur, une alerte pour les rares ; puis France → région → département → commune → rue) puis la carte se retourne (cf. prototype). **[Décidé]**

### Le marché entre joueurs **[Décidé]**
- Pas de vente à la banque : un lieu ne se vend qu'à un joueur, et ne s'achète qu'à un joueur (pas d'achat d'un lieu libre).
- Un propriétaire peut **mettre en vente** à un prix libre : le lieu porte un badge 💰 sur la carte, n'importe qui l'achète au prix affiché. Mise en œuvre (3 nov. 2026, demande de Gautier : « on doit pouvoir mettre le montant qu'on veut ») : le vendeur tape son prix (un entier de 1 à un milliard de pièces, raccourcis « la valeur », +10 %, +25 %, +50 %, × 2, l'écart à la valeur affiché), peut le changer ou retirer le lieu de la vente. Les achats par les autres joueurs viendront avec le serveur. **[Décidé par Gautier]**
- N'importe qui peut **faire une offre** sur n'importe quel lieu, même pas en vente. Une offre n'expire jamais ; elle peut être modifiée ou annulée à tout moment ; le propriétaire accepte ou refuse. Les fonds sont vérifiés à l'acceptation.
- **Échanger** (demande de Gautier, 3 nov. 2026) : sur le lieu d'un autre joueur, « Proposer un échange » : on choisit un ou plusieurs de ses lieux (par exemple trois de ses adresses contre sa rue ; demande de Gautier, 3 nov.) et on peut ajouter des pièces ; la fenêtre montre ce qu'on donne et ce qu'on reçoit. L'autre joueur accepte ou refuse ; tant qu'il n'a pas répondu, on peut annuler. À l'acceptation, les deux lieux changent de main (chacun garde ses constructions) et les pièces passent ; si l'un des lieux a changé de main entre-temps, l'échange tombe. Un même lieu ne peut être proposé que dans un échange à la fois ; si un seul des lieux proposés a changé de main, l'échange tombe. En attendant le serveur, les joueurs simulés répondent en 45 s et acceptent si on leur donne au moins 10 % de plus que ce qu'ils cèdent. **[Décidé par Gautier ; le détail est Proposé]**
  - Sur le serveur (8.1f, 3 nov. 2026) **[Proposé]** : un vrai joueur reçoit l'échange dans ses notifications (les lieux offerts avec leur valeur, les pièces en plus, l'écart avec son lieu) et l'accepte ou le refuse ; pas d'expiration. Les pièces en plus sont vérifiées à la proposition et à l'acceptation (pas bloquées entre-temps, comme pour une offre). Une seule proposition en attente par lieu demandé (pour en faire une autre, annuler d'abord) ; trente lieux au plus dans un échange. À l'acceptation, les lieux échangés quittent la vente et les offres et autres échanges qui les visaient tombent (leurs auteurs sont prévenus). **Un échange n'est pas une vente** : il ne compte pas dans le marché des communes (la valeur qui bouge).
- Aucune taxe, aucun délai de blocage. **[Décidé]**

### Les enchères de monuments **[Décidé]**

La liste (`data/monuments.json`, 2 nov. 2026) : 458 monuments tirés de Wikidata (monuments historiques et sites UNESCO de métropole, classés par nombre d'articles Wikipédia) ; les **60 premiers sont nationaux**, les **398 suivants régionaux**. Retirés : les ensembles qui ne sont pas un lieu (canal du Midi, chemins de Saint-Jacques, fortifications de Vauban…). Ajoutés à la main : tour Eiffel, Notre-Dame-de-la-Garde, viaduc de Millau. Mont-Saint-Michel forcé en national, château de Montsoreau en régional. **[Proposé, à relire par Gautier]**
  - 4 nov. 2026 : **la Grande Mosquée de Paris** ajoutée à la demande de Gautier (459 monuments). Elle est monument historique, mais Wikidata ne la comptait pas parmi eux le 2 nov. Classée comme les autres (47 articles, 33e) : **nationale**. La cathédrale de Nantes (36 articles), la dernière des nationaux, passe en régional. **[Décidé par Gautier pour l'ajout ; national selon la règle commune, proposé]**
  - Vérification des autres lieux de culte (même règle : monument historique, au moins 11 articles, le seuil de la liste du 2 nov.). Quatre églises sont **au-dessus du seuil**, dans le même cas que la mosquée : Saint-François-Xavier et Saint-Ambroise à Paris (14 articles), la basilique Saint-Martin de Tours (13), Saint-Pierre-le-Vieux de Strasbourg (12). Une vingtaine de lieux de culte sont **pile au seuil (11)**, là où la liste a été coupée : la grande synagogue de Marseille, la synagogue de Versailles, la cathédrale grecque orthodoxe Saint-Étienne de Paris et une vingtaine d'églises. Il y a aussi sans doute bien d'autres monuments, non religieux, à 11. Pas monuments historiques : la mosquée d'Évry (13, label « Architecture contemporaine remarquable ») et la cathédrale orthodoxe de la Sainte-Trinité de Paris (12). **Gautier (4 nov.) : « oui les 4 »** : les quatre églises au-dessus du seuil sont ajoutées, régionales (463 monuments). Ceux qui sont pile au seuil restent dehors : il faudrait refaire toute la liste.

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
- Sur le serveur (8.1g, 3 nov. 2026) **[Proposé]** :
  - la semaine des enchères est la semaine du jeu (jours du jeu 7 par 7) : en vrais jours, elle se termine à minuit, heure de Paris, toutes les sept nuits ; sur le serveur d'essai accéléré (un jour = une minute), elle dure 7 minutes ;
  - les trois lots sont tirés parmi les monuments **encore libres** (un monument gagné ne revient plus), dans l'ordre de la liste en attendant le calendrier de Gautier ; s'il n'en reste plus, la semaine n'a pas d'enchère ;
  - les pièces sont bloquées pour **miser** (on ne peut pas miser ce qui mène déjà ailleurs) ; ailleurs (acheter, construire, offrir), le jeu montre ce qui reste disponible, mais le serveur ne bloque pas : si le meneur a dépensé entre-temps, la clôture passe à la mise suivante ;
  - un lot se clôt au premier passage d'un joueur sur le serveur après la fin (les mises arrivées après la fin sont refusées) ; chaque joueur qui a misé est prévenu (gagné, ou à qui le monument est allé), et le meneur d'avant est prévenu à chaque surenchère ;
  - les robots du serveur d'essai surenchérissent seulement contre un vrai joueur, jusqu'à 150 % de la mise de départ.

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

## 5. Le Maire **[Décidé par Gautier le 4 nov. 2026 ; remplace « le plus de lieux »]**

Pourquoi le changement : un titre fondé sur un **stock** (le plus de lieux, ou la plus grande valeur) se fige dès que la commune est pleine : le Maire le reste « jusqu'à la mort » s'il ne vend rien. Le titre doit donc dépendre d'un **flux**, remis à zéro chaque mois.

- Chaque commune (arrondissement à Paris/Lyon/Marseille) a une **caisse de travaux**. Tout propriétaire d'au moins un lieu dans la commune peut y verser des pièces quand il veut (« financer la rénovation de la place »). La caisse et les contributions sont **publiques en temps réel** (qui mène, de combien).
- **Le 1er du mois à minuit (heure de Paris)** : le plus gros contributeur du mois civil devient **Maire**, la caisse est vidée, les compteurs repartent à zéro. Égalité = co-Maires.
- **Ce que le Maire gagne** : **5 % des loyers générés dans la commune** pendant son mandat par les lieux **des autres joueurs** (jamais sur ses propres lieux), **plafonnés à 2 000 pièces par mois et par mairie** ; une plaque sur la fiche de la commune, un écusson sur ses lieux et son profil.
- La caisse fait monter le **niveau visuel de la commune** (lampadaires, fontaine… jusqu'au niveau 5), visible de tous sur la carte : même ceux qui ne visent pas le titre ont une raison de verser. **[Proposé]**
- **Perte du titre** : à la fin du mois, ou après **14 jours sans connexion** (le titre passe au 2e contributeur du mois précédent). Les lieux ne sont jamais retirés.
- **Classement des Maires** : nombre de mairies détenues, **pondéré par le nombre de rivaux** ayant versé au moins 100 pièces dans la commune ce mois-là (une mairie gagnée contre 10 joueurs vaut 10, contre personne vaut 0). Figé à chaque fin de saison (§ 5 bis).

Garde-fous (Claude, 4 nov.) **[Proposé]** :
- **seuil de 100 pièces** pour être élu, sinon « pas de Maire ce mois-ci » (commune fantôme) ;
- un versement dans la **dernière heure du mois compte à 50 %** (snipe de 23 h 59) ;
- les pièces **ne s'achètent jamais** en gemmes (§ 9) : c'est le verrou qui empêche le titre de devenir une enchère en euros ; l'avantage du payeur reste indirect (plus de lieux → plus de loyers) ;
- l'alternance arrangée entre deux joueurs est tolérée (ils dépensent quand même, un troisième peut la casser) ;
- si la simulation montre que la campagne concurrence trop la construction : +10 % de poids en caisse par Tour possédée dans la commune.

## 5 bis. Les classements et les saisons **[Proposé, 4 nov.]**

Périmètre V1 (décision de Gautier, 4 nov.) : **la collection, le classement des Maires et le classement de patrimoine.** Pas de combat, pas d'événements (V2, § 14).

- **Patrimoine** d'un joueur = somme de ses lieux pondérés par rareté (Commun 1, Peu commun 2, Rare 4, Épique 8, Légendaire 12, monument 20) plus les constructions (Maison +1, Immeuble +3, Tour +6, Gratte-ciel +10, Palace +12, Prestige +15). Classement national et par commune.
- **Saisons de 3 mois** : à la fin de chaque saison, les deux classements sont figés (podium, plaques gravées sur les fiches de commune : « Maire de la saison 1 »), puis le classement des Maires repart à zéro ; le patrimoine et les lieux restent. C'est la ligne d'arrivée qui revient, pour qu'un nouveau joueur ait sa chance à chaque saison et que personne ne « finisse » le jeu.

## 5 ter. Les monuments : prestige, pas revenu **[Décidé par Gautier le 4 nov. ; chiffres Proposés]**

Ligne de conduite : un monument donne **du prestige et de la valeur**, pas de puissance. S'il était une machine à pièces, son propriétaire gagnerait toutes les campagnes de mairie.

- **Enchères en pièces seulement**, jamais en gemmes. Personne n'a payé en euros pour un monument : les règles de reprise ci-dessous sont donc de simples règles du jeu, écrites dans les CGU et rappelées sur la fiche d'enchère.
- **Reprise** : si le propriétaire ne s'est pas connecté depuis **14 jours**, le monument lui est retiré et **revient aux enchères**. Notification à J-3 (« ton monument sera remis aux enchères dans 3 jours »). **Les adresses et autres lieux ne sont jamais repris** : un joueur a pu payer un pack pour les avoir.
- **Loyer modeste** : le niveau Prestige rapporte environ le double d'une Tour, pas dix fois (le tableau du § 4 est à ramener à cette ligne lors de l'équilibrage).
- **Entretien exponentiel** (demande de Gautier, remplace la limite de 3 monuments par joueur) : le n-ième monument d'un joueur coûte **300 × 2^(n−1) pièces par mois** (300, 600, 1 200, 2 400, 4 800…), prélevés automatiquement sur les loyers. Pas de plafond : accumuler reste possible, mais le 6e monument coûte 9 600 pièces par mois à lui seul. Si le solde ne couvre pas l'entretien, le monument le plus cher est remis aux enchères après un mois d'impayé (notification à J-7).
- **Où il est fort** : classement de patrimoine (poids 20), fiche de commune, carte (maquette 3D), vitrine du profil. En V2 : un pouvoir unique par monument.
- **Alerte administrateur** (demande de Gautier) : quand un monument redevient libre (reprise, impayé, enchère sans preneur), le jeu envoie à Gautier un e-mail et une notification de tableau de bord avec le nom du monument, la commune, la date de fin de l'enchère à venir et une phrase prête à poster sur les réseaux.

## 6. Les collections **[V2]**

Pas de bonus de collection en V1. **[Décidé]** En V2 : « toute ma rue », « les 20 arrondissements », « une adresse par département »… avec badge sur le profil (jamais de ₳).

## 7. Les écrans **[Décidé]**

Style et ergonomie (3 nov. 2026, demande de Gautier) : voir `docs/DESIGN.md` (« la plaque et la pièce »). La carte est l'accueil ; la barre du bas : Carte, Patrimoine, **le pack du jour au centre** (bouton rond doré, compte à rebours quand il n'est pas prêt), Enchères, Communes ; les notifications sous la cloche, en haut ; les réglages dans le profil (et la roue des notifications) ; un guide des premiers pas (6 bulles) après le premier pack, à revoir dans les réglages ; installable sur l'écran d'accueil (`manifest.webmanifest`). **[Proposé]**

1. **Carte** (accueil) : ville 3D stylisée (bâtiments IGN extrudés, rues, parcs, eau), vue 3D ou 2D, recherche d'adresse ; parcelles colorées (moi / autres / partagée / libre), badges construction 🏠🏢🏙, badge 💰 en vente, monuments dorés avec halo et étiquette. Fiche d'une parcelle : Street View intégré (gratuit, rien n'est stocké), surface, plafond, la liste de ses lieux avec propriétaire (cliquable → profil), construction, mettre en vente, acheter, faire une offre.
1 bis. **La promenade** (demande de Gautier, 3 nov.) : se balader dans les rues en Street View et voir en direct sur la carte devant quels bâtiments on passe, pour les acheter s'ils sont à quelqu'un. **[Décidé]** Mise en œuvre **[Proposé]** : Street View en haut, la carte au milieu (elle suit le marcheur), en bas la rue et les lieux longés (gauche, droite, ou en face quand on regarde une façade), propriétaire, prix s'ils sont en vente, et « Acheter » / « Offre » / « Voir » qui ouvre la fiche. Commandes propres au jeu (avancer, reculer, tourner, glisser pour tourner, toucher pour avancer) : l'intégration gratuite de Street View ne dit pas où l'on va, la photo ne bouge donc pas d'elle-même. Services Google gratuits seulement (recherche de photo et intégration), jamais d'image fixe.
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

Règles : jamais de nom de personne, jamais de lien adresse ↔ identité, le domicile n'est jamais révélé. **Pas d'enseignes ni de noms de marques** sur les lieux (idée examinée et écartée par Gautier le 3 nov. : marques sans accord dans un jeu payant, petits commerces au nom de leur patron, commerces qui changent, données Sirene brouillonnes). **[Décidé]** Les tuiles IGN sont gratuites avec attribution ; si le trafic devient important, on héberge nos propres tuiles (gratuit, un script).

## 8 bis. Plateforme, sécurité, modération **[Décidé]**

- **V1 = site web installable (PWA)**, paiements Stripe ; **stores en V2** (avec les vibrations iPhone et les achats intégrés).
- **Multi-comptes** : on accepte le risque en V1 (limites simples par appareil et par IP côté serveur, sans numéro de téléphone).
- **Notifications push** : V2. En V1, le centre de notifications dans le jeu suffit.
- **Modération** : filtre automatique des pseudos ; un bouton **Signaler** sur chaque profil ; Gautier traite les signalements lui-même (bannissement manuel).
  - Mise en œuvre (2 nov. 2026) **[Proposé]** : pseudo de 3 à 16 caractères (lettres, chiffres, espace, tiret, point, tiret bas ; deux lettres au moins), unique sans tenir compte des majuscules ni des accents. Le filtre (`src/regles/pseudo.js`, listes `data/moderation.json`) bloque les racines interdites partout dans le pseudo (« putain », « salope »…) et les mots courts seulement quand ils forment un mot entier (« con » dans « GrosCon », pas dans « Conrad » ni « Calcul »), y compris déguisés (chiffres pour des lettres, points entre les lettres, lettres répétées) ; il réserve « admin », « modo », « Cadastra », « officiel », « support »… Signaler : une raison (pseudo inapproprié, triche ou plusieurs comptes, comportement, autre) et un détail facultatif ; un même joueur au plus une fois par jour ; le joueur signalé ne sait pas qui l'a signalé.

## 9. Monétisation : les gemmes **[Décidé par Gautier le 4 nov. 2026 après-midi]**

Deux monnaies, deux rôles :
- **Les pièces** (gratuites : salaire, loyers) : construire, acheter des lieux aux joueurs, offres, échanges, enchères de monuments, caisse de travaux. **Elles ne s'achètent jamais.**
- **Les gemmes** (nom provisoire, à choisir ; monnaie premium) : **euros → gemmes, à sens unique**. Jamais gemmes → euros, jamais gemmes → pièces (sinon on crée un cours de change et un marché noir). Les gemmes achètent :
  1. des **packs** nationaux et des **packs régionaux** ;
  2. le **Pass 15 jours** (§ 3) ;
  3. des **offres sur les lieux d'autres joueurs** : le vendeur choisit s'il vend en pièces ou en gemmes, l'acheteur paie dans la monnaie demandée. Les gemmes passent d'un joueur à l'autre **sans commission en V1** (chaque gemme a déjà été payée une fois ; une commission de 10 % pourra venir plus tard si trop de gemmes dorment).
- Revenu de Gautier = **uniquement l'achat de gemmes en euros** (Stripe en V1). Pas d'autre flux.
- Prix de départ **[Proposé]**, 100 gemmes = 1 € pour rester lisible : gemmes **500 pour 4,99 €**, **1 200 pour 9,99 €**, **2 600 pour 19,99 €** ; pack national **200**, pack régional **300**, Pass 15 jours **300**. Un joueur qui enchaîne les Pass dépense ~6 €/mois. À ajuster avec les premiers chiffres.
- Le **pack gratuit du jour** reste toujours gratuit (jamais en gemmes) : la voie 100 % gratuite doit rester réelle.
- **CGU** : les gemmes n'ont aucune valeur monétaire, ne sont ni remboursables ni cessibles hors du jeu ; les lieux sont des licences d'usage ; échanges hors jeu (compte, lieu contre PayPal) interdits.
- V2 : cosmétiques (styles de bâtiments, plaques), commerces réels partenaires sur la carte, cadeaux (« offre la rue de ton enfance »).
- Jamais : vente d'un lieu libre précis (le bon du Pass excepté ; § 3), de loyer, de construction, de pièces ; jamais de revente de lieux, de pièces ni de gemmes contre de l'argent réel (risque de jeu d'argent, décision du 4 nov. ; la boutique « en euros » entre joueurs a été examinée et écartée : loot box monétisable, statut d'intermédiaire de paiement, bots).

### Simulation de l'économie des gemmes (Claude, 4 nov. ; `tools/sim_gemmes.py`)
365 jours, 15 inscrits/jour, 2 % de départs/jour (~740 actifs stables), 15 % de payeurs dont 3 % à 50 €/mois, pack 200, Pass 500 (ancien tarif), adresse revendue ~150 gemmes. Résultats : **~650-750 €/mois en régime stable, soit ~0,95 € par actif et par mois** ; seuls 3 à 11 joueurs gratuits sur 740 peuvent se payer un pack sans jamais avoir dépensé (le marché ne fabrique pas de rentiers de gemmes) ; 13-15 % des gemmes dépensées viennent de la revente (47 % si le marché est très actif) **sans faire baisser les euros** ; la commission de 10 % ne change rien au revenu ; un marché en pièces seulement est le scénario le **moins** rentable (−15 %). Le revenu dépend presque uniquement des inscriptions et de la rétention : passer de 2 % à 1 % de départs par jour double le revenu.

### Lots réels (clés Steam, bons chez des commerçants) **[Proposé ; V1 à petite dose, V2 pour les partenariats]**
Idée de Gautier (4 nov.) : des lots réels offerts aux joueurs d'une commune (« Carrefour Gennevilliers offre 10 % aux habitants »), ou une clé Steam au meilleur joueur d'un village. Utile pour **faire venir** des joueurs commune par commune, et à terme comme revenu B2B (le commerçant paie pour sponsoriser un événement). Règle absolue, pour ne pas être qualifié de loterie (hasard + sacrifice financier + lot ayant une valeur) : **aucun lot réel n'est jamais attribué selon un score que les pièces, les gemmes ou le nombre de lieux peuvent influencer.** Pas de « une chance par adresse », pas de « le plus gros contributeur », pas de « le plus de Prestige ». Formes acceptables : tirage **un ticket par joueur** ; tickets gagnés par l'assiduité (jours de connexion, votes) ; lot distribué à **tous** ; éligibilité par une **commune de cœur** déclarée librement (une par joueur, changeable chaque mois), pas par les lieux possédés. Règlement de jeu-concours publié pour chaque lot ; avis d'un avocat avant de monter en volume. Avertissement : Claude n'est pas juriste.

## 10. Équilibrage

Une **simulation à agents** (joueurs gratuits, payants, chanceux, inactifs, sur 6 mois) vérifie avant le lancement : que le gratuit assidu progresse, que le gros acheteur de packs ne « roule » pas sur une ville, que les prix du marché restent sains, et que la masse de ₳ ne s'emballe pas. Les chiffres du § 4 sont réglés par cette simulation, puis par les vrais joueurs.

## 11. Ordre de construction (voir `PLAN.md`)

Tout le game design d'abord (fonctions complètes, serveur simulé → vrai serveur), puis les graphismes (pochette, cartes, monuments 3D, sons), l'équilibrage en dernier. Même méthode que le Projet Arena.

## 12. Nom, monnaie, style, lancement **[Décidé le 2 nov.]**

- **Monnaie : les « pièces »**. Son signe : une pièce d'or en forme de maison, frappée d'un C (demande de Gautier le 3 nov. : « un signe plus original » ; dessin proposé par Claude). **[Proposé]**
- **Nom : CityDeck.** **[Décidé par Gautier le 4 nov. 2026 : « ok validons citydeck »]** Vérifications du 4 nov. (Claude, dans le Chrome de Gautier) :
  - Marques (base INPI, françaises + européennes + internationales) : **aucune marque « CityDeck »**, aucune société. 
  - Domaines : **citydeck.fr libre** (Afnic), citydeck.io et citydeck.app libres ; citydeck.com a priori pris. À réserver par Gautier (OVH ou Gandi). Dépôt INPI (classes 9 + 41, ~230 €) quand le jeu aura des joueurs.
  - Écartés le 4 nov. : City Hunter (manga), ImmoQuest (marque « IMMO Quest » déposée en 2024 en classe 41, divertissement), DropCity (marque européenne « DROP CITY », classes 41-42), CityPack / PackCity (marque « CITY PACK » de Réside Études, classes 36 et 41), CityDrop (marque libre mais citydrop.fr, .com et .app pris), Immo Hunter, ImmoChasse, RueQuest, CityLord (libres, non retenus).
  - Dans le code, « Cadastra » reste (clés de stockage, noms internes) : ne pas renommer, les parties seraient perdues.
  - Vocabulaire ouvert par le nom : le patrimoine = « mon deck », un lieu = « une carte », le pack du jour = « le booster ». **[Proposé]**
  - Ancien nom de travail Cadastra (2 nov.) : cadastra.fr/.com/.app pris, marque « CadastrA » enregistrée en immobilier + logiciel : risque d'opposition, abandonné.
- **Style visuel : cartoon** (ville 3D stylisée aux couleurs franches, pochette et cartes illustrées façon jeu mobile), **tout produit avec des outils d'IA**, Claude guide la chaîne d'outils (comme pour Arena : image → modèle 3D, textures, animations).
  - Précisé le 3 nov. au soir (choix de Gautier) : **« jeu mobile coloré »** (formes rondes, couleurs vives, gros reliefs, façon Clash Royale ou Brawl Stars) ; **les graphismes passent avant l'étape 8.2** ; on commence par **le pack et les cartes** ; **outils gratuits d'abord** (dessin en code). Les règles : `docs/BIBLE-GRAPHIQUE.md`. **[Décidé]**
- **Lancement public direct**, sans date fixée ; pas de bêta amis.
- **Rythme** : toutes les soirées de Gautier, ce projet passe devant Arena.
- **Budget** : 20 € par semaine au plus (domaine, Supabase si trafic, outils d'image/3D).

## 13. Ce qui reste ouvert (interview à finir)

- Hors France : **France seulement en V1**. **[Décidé]** Modèle de données prêt pour d'autres pays. **[Proposé]**
- Visuel de la carte d'un lieu : V1 = photo aérienne IGN du bâtiment avec sa parcelle + cadre de rareté ; V2 = rendu 3D stylisé. **[Proposé]**
- Calendrier des monuments.
- Capacité de gestion (§ 4) : à valider ou remplacer après simulation.
- Nom de la monnaie premium (« gemmes » provisoire).
- **Le joueur « village »** (souci de Gautier, 4 nov.) : un joueur qui se concentre sur son village réel (adresses Communes et Peu communes) doit pouvoir rivaliser avec les villes. La mairie par caisse de travaux y répond en partie (un village se gagne pour quelques centaines de pièces). Pistes proposées par Claude, non tranchées : pas de plafond de construction par rareté (la rareté = un point de départ, pas un plafond) ; **bonus de rue** (toutes les adresses d'une rue : +25 % de loyer) et **Seigneur du village** (plus de 50 % des adresses d'une commune) ; standing qui monte avec les constructions de la commune. **[Proposé, à trancher avant l'équilibrage]**

## 14. Pistes examinées le 4 nov. 2026 (après-midi) — V2 ou écartées

Toute l'après-midi a cherché « une règle simple qui garde les joueurs » : la collection seule donne une sensation de jeu fini (un monument obtenu = « j'ai fini »), et un titre fondé sur le stock se fige. Ce qui en reste :

- **[V1]** Le Maire par caisse de travaux (§ 5), les saisons (§ 5 bis), les monuments « prestige, pas revenu » avec entretien exponentiel et reprise (§ 5 ter), les gemmes (§ 9).
- **[V2 — retenu dans l'idée]** **Les événements de commune** : chaque commune a une **Attractivité** (0-100) qui multiplie ses loyers ; des événements tirés au sort (manifestation, festival, cambriolages, grand chantier, tempête…) donnent 24 h aux propriétaires pour **voter** entre 3 options (coût individuel, effet collectif) ; le passager clandestin et l'événement qui se déplace vers la commune voisine font l'impact entre joueurs. Format JSON, 5 événements écrits, règles d'ergonomie : `docs/EVENEMENTS-V2.md`. Avec lui, le **Prestige** (points gagnés par les votes gagnés, les constructions, les titres) pourrait devenir le score des saisons (Maire / Préfet / Président).
- **[Écarté]** Le combat (village-deck en grille, troupes, sim de combat, raids par formule) : trop complexe à mettre en place, et les joueurs individualistes quittent à la première perte. Les élections à voix : trop compliquées, demandent une cohésion que les joueurs n'ont pas. Les titres Maire → Préfet → Gouverneur par stock de lieux : se figent. La friche (adresse reprise après 7 jours d'absence) : refusée pour les adresses (payées), gardée pour les monuments seulement.
- **[Écarté]** La revente de lieux contre des euros (§ 9).
