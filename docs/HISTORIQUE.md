# Historique de Cadastra

Ce fichier raconte ce qui a été fait, dans l'ordre, avec les demandes et les décisions de Gautier. Il sert à reprendre le projet sans rien perdre, quel que soit l'outil (conversation Claude, Claude Code sur le PC, Claude Code dans le cloud).

**À compléter à chaque PR** : une ligne dans « Toutes les PR », et une phrase dans le récit quand Gautier a demandé ou décidé quelque chose. Le détail technique de chaque étape est dans `PROGRESS.md`, les règles du jeu dans `docs/GDD.md`, l'ordre des étapes dans `docs/PLAN.md`, les consignes de travail dans `CLAUDE.md`. Pour changer d'outil : `docs/REPRENDRE-DANS-CLAUDE-CODE.md`.

## Où vit quoi

Rien d'important ne vit dans une conversation : tout est dans le dépôt ou sur les services ci-dessous.

| Quoi | Où |
|---|---|
| Le code, les données, les documents | GitHub `josalystest1-sudo/projet-jeux-immo` (public), branche `main` |
| Le jeu publié | **https://citydeck.fr/** depuis le 5 nov. (l'ancienne adresse https://josalystest1-sudo.github.io/projet-jeux-immo/ y renvoie) (mis à jour 1 à 2 minutes après chaque fusion sur `main`) |
| Le serveur : comptes, joueurs, lieux, offres, ventes, notifications, robots | Supabase, projet `cadastra`, organisation Josalys (offre gratuite). Ses tables et fonctions sont décrites dans `supabase/` et envoyées par `.github/workflows/serveur.yml` à chaque fusion (`docs/serveur/ARCHITECTURE.md`) |
| La clé qui permet de publier le serveur | secret GitHub `SUPABASE_ACCESS_TOKEN`, posé par Gautier (Claude ne la voit jamais) |
| La clé Google (Street View) | `data/google.json` (publique, limitée au site du jeu ; services payants mis à 0 dans la console Google, projet « Le Laboratoire ») ; `docs/serveur/GUIDE-GOOGLE.md` |
| Le rythme du serveur d'essai | table `reglages` : `jour_secondes` = 60 (un jour du jeu = une minute) |
| Le tout premier prototype | branche `proto-cadastre` du dépôt `projet-arena` (adresse `/proto-cadastre/`) : provisoire, à retirer de l'Arena |

## Le récit

### Avant le dépôt (octobre – 2 novembre 2026)
- Le projet part d'une idée de loterie gratuite (écartée : les bots, et les règles des loteries), puis d'un jeu de collection façon WikiMasters. Gautier veut des objets uniques que tout le monde connaît : les adresses. Il retient « un jeu comme Upland, sans blockchain » : collectionner les vrais lieux de France.
- 2 nov. : premier prototype, hébergé provisoirement dans le dépôt de l'Arena. D'abord une carte du cadastre cliquable avec photo aérienne (« pas beau »), puis une ville 3D stylisée (bâtiments IGN), la vue 2D/3D, la recherche, les constructions façon Monopoly.
- 2 nov. : l'économie est discutée puis posée par Gautier. Packs gratuits et payants, loyers, pas de taxe, pas de délai de revente, pas de vente à la banque. Marché entre joueurs, enchères de monuments, Maire = le plus de lieux dans la commune. Le standing (prix DVF) et la notoriété fixent jusqu'où l'on construit.
- 2 nov. : interview en cinq volets, puis GDD V1, plan en 11 phases et `CLAUDE.md`. Nom de travail : Cadastra ; monnaie : les pièces.

### 2 novembre 2026, soir et nuit : le dépôt et les fondations
- Gautier crée le dépôt `projet-jeux-immo`, le passe en public et active la publication (GitHub Pages).
- **Phase 0** : moteur de règles et tests. Le nom Cadastra, avec la vérification des domaines et des marques.
- **Données** : le standing réel des communes (DVF) et 458 monuments (Wikidata).
- **Lieux célèbres** : les églises, chapelles, cathédrales et abbayes ayant un article Wikipédia.
- **Jeu** : trois enchères par semaine, le pack tiré par rareté, le filtre des pseudos, le bouton Signaler, la récolte à la connexion.
- **Supabase** : Gautier choisit Supabase, et Claude crée le projet `cadastra` dans son Chrome. L'inscription par e-mail suit. Décision de Gautier : **le pseudo est définitif**.

### 3 novembre 2026, nuit : la refonte « la plaque et la pièce »
- Demande de Gautier : « le jeu doit être super beau ». Nouvelle identité : plaques de rue émaillées et pièces d'or (`docs/DESIGN.md`).
- Tous les écrans sont refaits, ainsi que le guide des premiers pas et l'icône. Nouvel outil de captures de tous les écrans.

### 3 novembre 2026, matin : les retours de Gautier (PR #1 à #20)
- **Lenteurs** : la recherche d'une adresse lointaine laissait l'écran vide. Le voyage passe maintenant par un saut direct, et la carte se repose.
- **Pack et monnaie** : les cartes du pack ne cachent plus le bouton, et la monnaie a un nouveau signe (une pièce en forme de maison).
- **Cartes** : plaques de rue réalistes, l'adresse sur un mur de briques, cartes « full art ».
- **Mise à jour** : le jeu se met à jour tout seul sur le téléphone.
- **Échanges** : on peut échanger un lieu, puis plusieurs d'un coup. Décision de Gautier : **un lieu libre ne s'achète pas**, il sort des packs.
- **Street View** : la vue se fait depuis la rue, plus jamais depuis l'intérieur d'une boutique. Avec la clé Google, le monument est vu de dehors, de face, à hauteur d'yeux. « Voir sur la carte » ouvre toujours la fiche.
- **Lisibilité** : une interface plus lisible sur téléphone (« brouillon, des infos qui se chevauchent »).
- **Raretés** : décision de Gautier, **six raretés**, dont Légendaire orange (lieux célèbres) et Extraordinaire arc-en-ciel (monuments, enchères seulement). Le Gratte-ciel est ajouté. Après « tu as 2 immeubles » : **un bâtiment par rareté**, avec le Palace.
- **Publication** : les règles se mettent à jour avec la page (le téléphone gardait les anciennes).
- **Communes** : on peut chercher une commune pour voir son Maire.

### 3 novembre 2026, après-midi : le vrai serveur (PR #21 à #33)
- Choix de Gautier : **le serveur d'abord, la boutique ensuite**.
- **Fondations (8.1a)** : tables, fonction `jeu`, mise à jour automatique du serveur et essai automatique avec un joueur jetable. Gautier pose le secret GitHub depuis son téléphone.
- **Pack (8.1c)** : le pack du jour est tiré par le serveur, avec le même code que la démo.
- **Le jeu sur le serveur (8.1b)** : un interrupteur « Jouer sur le vrai serveur (essai) ».
- **Le monde réel (8.1d)** : les vrais propriétaires, les Maires et les profils. Corrigé : le guide annulait l'ouverture du pack.
- **Le marché (8.1e)** : vente, achat, offres et notifications.
- **Serveur accéléré** : demande de Gautier, un jour du jeu = une minute sur le serveur d'essai.
- **Robots** : idée de Gautier, six comptes robots jouent seuls sur le serveur d'essai.
- **Offres lisibles** : une offre montre la valeur du lieu et l'écart, et les robots achètent vraiment (« personne ne m'achète »).
- **La valeur bouge** : choix de Gautier, selon les ventes de la commune, l'activité du quartier et la tendance de la semaine.

### 3 novembre 2026, fin d'après-midi
- **La promenade en Street View** (PR #34) : demande de Gautier. On se balade dans les rues, on voit sur la carte les bâtiments qu'on longe, leur propriétaire et leur prix, et on peut les acheter ou faire une offre.
- **Idée écartée : les enseignes des commerces à la place des adresses** (« Subway porte d'Orléans »). Claude a dressé la liste des pour et des contre : marques utilisées sans accord dans un jeu payant, petits commerces au nom de leur patron, commerces qui ferment, données brouillonnes. Gautier abandonne l'idée.
- **Correctif de la promenade** (PR #36) : retour de Gautier, après avoir touché la carte on ne pouvait plus tourner dans Street View. Le geste partait dans la page Google intégrée : elle ne reçoit plus aucun toucher, et un lien « Google Maps ↗ » ouvre la même vue chez Google.
- **Passage à Claude Code** (PR #35) : demande de Gautier. Cet historique, la procédure `docs/REPRENDRE-DANS-CLAUDE-CODE.md`, les documents de suivi mis à jour, et l'outil d'essai de la promenade versé dans le dépôt.

### 3 novembre 2026, soir : la reprise dans Claude Code
- Gautier clone le dépôt sur son PC (dossier `Documents/jeu immo`) et lance la reprise. Les outils sont là ; un test échouait seulement sous Windows (PR #38). Choix de Gautier : ce correctif, puis les échanges sur le serveur (8.1f).
- **Les échanges sur le serveur (8.1f)** (PR #39) : proposer ses lieux (plus des pièces) à un vrai joueur ou à un robot, recevoir un échange dans ses notifications avec la valeur de chaque côté, accepter ou refuser. Les robots répondent et proposent parfois des échanges, pour pouvoir essayer seul.
- **La mise à jour du téléphone** (PR #40) : retour de Gautier, « les échanges ne sont pas en ligne ». Le site et le serveur les avaient : c'est son téléphone qui gardait l'ancienne version, parce qu'une fenêtre ouverte au retour dans le jeu faisait abandonner la mise à jour. Corrigé ; la version s'affiche dans les Réglages. Choix de Gautier ensuite : les enchères sur le serveur (8.1g).
- **Les enchères sur le serveur (8.1g)** (PR #41) : les trois monuments de la semaine sont tenus par le serveur (une semaine = 7 minutes sur le serveur d'essai) ; on mise, on est prévenu quand on est dépassé, le monument va au gagnant à la fin. Les robots surenchérissent quand un vrai joueur mène. Tout le jeu passe maintenant par le serveur.
- **Les graphismes avant 8.2** (décision de Gautier) : rendu « jeu mobile coloré », on commence par le pack et les cartes, avec des outils gratuits. La bible graphique et la preuve (PR #42) : nouvelles cartes par rareté, nouveau dos, nouvelle pochette.
- **La preuve validée** par Gautier (« Oui, on continue »). Puis **l'ouverture du pack** (PR #43) : la déchirure qui suit le doigt, les cartes qui glissent hors du pack, de nouveaux sons ; la pochette ne devient plus toute blanche quand elle penche.
- **L'ouverture validée** par Gautier. Puis **la tour Eiffel en 3D** sur la carte (PR #44), la preuve des monuments : une maquette de dessin animé à sa vraie place et à sa vraie taille.
- **La tour validée** par Gautier, puis **Notre-Dame, l'Arc de triomphe et le Sacré-Cœur** en 3D (PR #45). Retour de Gautier pendant le travail : « de près, le bâtiment devient moche et perd ses couleurs » ; corrigé pour tous les monuments (dessin des faces, contour, lumière, bâtiments de l'IGN qui perçaient Notre-Dame).

### 4 novembre 2026
- **Les monuments validés** par Gautier. Puis **huit monuments de plus** (PR #46) : Versailles, Chartres, Reims, Saint-Denis, le Panthéon, l'Opéra Garnier, la Concorde, le Pont du Gard. Et la vraie cause des défauts de près, trouvée et corrigée pour tous : une question de précision des calculs de la carte graphique.
- **Décision de Gautier pour la boutique** (PR #47) : le Pass mensuel donnera un pack du jour de 8 cartes au lieu de 5 et un bon par mois pour prendre l'adresse libre de son choix, jusqu'à Épique (3 bons gardés au plus) ; jamais de revente de lieux contre de l'argent réel (risque de jeu d'argent). À construire avec la boutique.
- **Dix monuments de plus** (PR #48) : les Invalides, l'Élysée, la Sorbonne, la Sainte-Chapelle, le Luxembourg, Fontainebleau, Chambord, et les cathédrales d'Amiens, de Rouen et de Strasbourg (22 maquettes en tout). Et les maquettes ne ralentissent plus la carte.
- **La nuit des monuments** : Gautier va se coucher et demande d'en faire le maximum sans attendre sa validation. Premier lot (PR #49) : le Louvre, le Mont-Saint-Michel, Carcassonne, Chenonceau, le palais des Papes, la Madeleine.
- Deuxième lot de la nuit (PR #50) : le Grand Palais, les ponts Alexandre-III et Neuf, la Conciergerie, le Palais-Royal, la place des Vosges, Saint-Sulpice.
- Troisième lot de la nuit (PR #51) : Vaux-le-Vicomte, Vincennes, Blois, Amboise, le château d'If, Notre-Dame-de-la-Garde, le viaduc de Millau.
- Quatrième lot de la nuit (PR #52) : les onze derniers monuments nationaux. Tous ont leur maquette, sauf les grottes, les cimetières et les jardins (halo doré) ; le Ritz, une marque, a la sienne depuis le 6 nov. (PR #159).
- Premier lot de monuments régionaux (PR #53) : Montsoreau, Saint-Germain-en-Laye, Saint-Savin, la Saline royale, Saint-Eustache, Chaillot, la place Stanislas, Laon.
- Deuxième lot régional (PR #54) : Fontevraud, le palais du Tau, Azay-le-Rideau, Cordouan, Villandry, l'observatoire de Nice, Albi, l'École militaire, le théâtre des Champs-Élysées, le Clos Lucé.
- Troisième lot régional (PR #55) : l'Odéon, Chantilly, Angers, Bayeux, l'arc d'Orange, la villa Savoye ; et les maquettes construites à la demande (le démarrage du jeu ne ralentit pas avec leur nombre).
- Quatrième lot régional (PR #56) : Saint-Remi, Saint-Germain-l'Auxerrois, la tour Saint-Jacques, les arènes de Lutèce, Saumur, la place des Victoires, le Haut-Kœnigsbourg, Saint-Étienne-du-Mont, les arènes de Nîmes, la colonne de Juillet.
- Cinquième lot régional (PR #57) : Pierrefonds, Saint-Jean de Lyon, la Major, la porte Saint-Denis, la colonne Vendôme, le trophée des Alpes, le Lion de Belfort, Ussé, le pont Mirabeau, Fourvière.
- Sixième lot régional (PR #58) : Loches, Château-Gaillard, Langeais, Saint-Sernin, Sainte-Clotilde, Bordeaux, Metz, Clermont-Ferrand, Cheverny, le viaduc de Garabit.
- Septième lot régional (PR #59) : l'Institut de France, Saint-Gervais, Chaumont, Valençay, Orléans, Sens, Tours, Notre-Dame-des-Doms, Saint-Front, Sully-sur-Loire.
- Huitième lot régional (PR #60) : Limoges, Sarlat, Noyon, Saint-Benoît-sur-Loire, Foix, Saint-Augustin, le Capitole, Sénanque, Saint-Alexandre-Nevsky, Le Mans.
- Neuvième lot régional (PR #61) : Saint-Pierre de Montmartre, Brissac, le pont Royal, la Trinité, Autun, les ducs de Bretagne, Castelnaud, Dijon, Angoulême, Saint-Trophime, Narbonne, les arènes d'Arles.
- Dixième lot régional (PR #62) : Saint-Merri, Saint-Séverin, Quimper, Troyes, Saint-Étienne de Toulouse, Saint-Roch, Saint-Vincent-de-Paul, la porte Saint-Martin, la Salpêtrière, la synagogue de Besançon, Chinon, Coucy.
- Onzième lot régional (PR #63) : Saint-Julien-le-Pauvre, le baptistère de Poitiers, Beynac, Pau, Saint-Nicolas-du-Chardonnet, l'abbaye aux Hommes, Aiguilhe, Auch, Rennes, Angers, le pont Marie, le palais des ducs de Bourgogne.
- Douzième lot régional (PR #64) : les cathédrales de Blois, Vannes, Poitiers, Montpellier, Soissons, Versailles et Rodez, le Val-de-Grâce, Saint-Michel de Bordeaux, Notre-Dame-des-Victoires, la grande synagogue, la fontaine des Innocents.
- Treizième lot régional (PR #65) : Saint-Paul-Saint-Louis, Notre-Dame-de-Lorette, Saint-Jean de Montmartre, Senlis, Meaux, Conques, l'abbaye aux Dames, Châteaudun, les hôtels de Sens et de Sully, Saint-Urbain de Troyes, la chapelle expiatoire.
- Quatorzième lot régional (PR #66) : les cathédrales de Coutances, Auxerre, Bayonne, Béziers, Nevers et Toul, Saint-Ouen de Rouen, les Hospices de Beaune, Gien, Falaise, l'ossuaire de Douaumont, Saint-Thomas de Strasbourg.
- Quinzième lot régional (PR #67) : le pont Valentré, Saint-Joseph du Havre, Vimy, Notre-Dame-la-Grande, Le Puy, Cahors, Saint-Maclou, les Jacobins, Ar-Men, Vitré, Lisieux.
- Seizième lot régional (PR #68) : la Légion d'honneur, le Grand-Théâtre de Bordeaux, la cathédrale russe de Nice, le palais Rohan, l'hôtel de ville de Lyon, Saint-Nicolas-des-Champs, La Tourette, Arras, Évreux, Perpignan, Moulins, Langres.
- Dix-septième lot régional (PR #69) : Saint-Quentin, les cathédrales de Nancy, Lisieux, Montauban, Agen, Cambrai, Saint-Brieuc, Sées, Saint-Malo et Agde, Tournus, Saint-Pierre de Caen.
- Dix-huitième lot régional (PR #70) : le musée d'Orsay, Thiepval, le Gros-Horloge, la porte des Allemands, Tarascon, Salses, Josselin, Hautefort, Annecy, le fort la Latte, La Rochelle, Vienne.
- Dix-neuvième lot régional (PR #71) : Saint-Paul de Strasbourg, Colmar, Notre-Dame de Dijon, Vendôme, Verdun, Saint-Nicolas-de-Port, Bonaguil, Montreuil-Bellay, Maintenon, Sceaux, le temple du Marais, le théâtre antique de Lyon.
- Vingtième lot régional (PR #72) : les châteaux de Caen, Dinan, Anet et Écouen, Moissac, les cathédrales d'Ajaccio, Saintes, Bazas et Nice, l'arc de Germanicus, Saint-Michel de Carcassonne.
- Vingt et unième lot régional (PR #73) : Aix, Maisons, le Plessis-Bourré, Talcy, Roquetaillade, Abbadia, Saint-Victor, la Daurade, la synagogue et Saint-Seurin de Bordeaux, Valence.
- Vingt-deuxième lot régional (PR #74) : Quéribus, Montségur, Jumièges, Murbach, Pontigny, Corbie, Oloron, Brégançon, la tour Clovis, Ferrières, le Thoronet.
- Vingt-troisième lot régional (PR #75) : Serrant, Ancy-le-Franc, Fénelon, Saché, Lescar, Notre-Dame-de-Bonne-Nouvelle, la fontaine Médicis, Menars, le Rivau, Beauregard. 301 maquettes.
- Vingt-quatrième lot régional (PR #76) : Besançon, Meudon, Saint-Médard, Saint-Eugène, Sainte-Élisabeth, le théâtre antique d'Arles, le Jeu de paume.
- Vingt-cinquième lot régional (PR #77) : la porte de Mars, Châlons, Notre-Dame-en-Vaux, Vienne, Suscinio, Fougères, le palais Longchamp, le pont transbordeur, Saint-Pol-de-Léon.
- Vingt-sixième lot régional (PR #78) : le musée de Picardie, Najac, Sainte-Croix de Bordeaux, Ainay-le-Vieil, Saint-Pierre-le-Jeune, Azay-le-Ferron, Saint-Leu-Saint-Gilles.
- Vingt-septième lot régional (PR #79) : Murol, Villesavin, Montpoupon, Puymartin, La Brède, Antibes, Viviers, Chaalis.
- Vingt-huitième lot régional (PR #80) : Fontfroide, Valmagne, Maguelone, Lavaur, l'Épau, Montmajour, Saint-Paul-de-Mausole, le Pont-Vieux d'Albi.
- Vingt-neuvième lot régional (PR #81) : Châlus-Chabrol, Puivert, Canigou, Cadouin, Remiremont et cinq ruines tracées d'après les murs de l'IGN (Puilaurens, Aguilar, Termes, Beauport, Commarque).
- Trentième lot régional (PR #82) : Lastours, Peyrepertuse, Clisson, Luxeuil, Saint-Michel-de-Cuxa.
- Trente et unième lot régional (PR #83) : la Grande Chartreuse, Compiègne, l'abbaye Saint-Remi, le fort Saint-Jean (des monuments laissés de côté plus tôt, repris avec des plans plus fins).
- Trente-deuxième lot régional (PR #84) : Gellone, le Bec-Hellouin, la villa Ephrussi et trois mégalithes (la Roche-aux-Fées, Barnenez, Er Grah).
- Trente-troisième lot régional (PR #85) : la chapelle de la Médaille miraculeuse, l'hôtel de Matignon, la maison La Roche.
- Trente-quatrième lot régional (PR #86) : Sedan, Brest, Lunéville, montés sur l'emprise exacte de l'IGN (un nouvel outil pour les plans trop compliqués).
- Trente-cinquième lot régional (PR #87) : Rambouillet, la cathédrale de Dax.
- Trente-sixième lot régional (PR #88) : Aire, Apt, Hautecombe, Cîteaux, l'hôtel Lambert, l'Arsenal, Solesmes, plus simples (le volume juste de l'IGN, sans le détail).
- Trente-septième lot régional (PR #89) : Silvacane, Lérins, l'hôtel de Beauvais, le musée Chéret, La Trappe, Port-Royal-des-Champs, l'auberge Ravoux.
- Trente-huitième lot régional (PR #90) : la manufacture de Sèvres, la citadelle de Besançon.
- Trente-neuvième lot régional (PR #91) : les Alyscamps, le temple du Donon, le temple de Diane.
- Quarantième lot régional (PR #92) : Royaumont, Maubuisson, Saint-Wandrille, la maison de Balzac.
- Quarante et unième lot régional (PR #93) : le Jardin des plantes, la Rotonde du parc Monceau.
- Quarante-deuxième lot régional (PR #94) : les Tuileries (l'Orangerie et le Jeu de Paume ; la PR #93 les croyait à tort déjà dessinés avec la Concorde).
- Quarante-troisième lot régional (PR #95) : le palais de justice de Paris, cours ouvertes ; la 400e maquette.
- Quarante-quatrième lot régional (PR #96) : l'hôpital Saint-Louis, sur le bon bâtiment cette fois (le quadrilatère autour du jardin).
- Quarante-cinquième lot régional (PR #97) : Lariboisière, Saint-Louis-en-l'Île, Clairvaux.
- Quarante-sixième lot régional (PR #98) : Bicêtre, Champmol.
- Quarante-septième lot régional (PR #99) : la place d'Alliance ; `CLAUDE.md` note les outils de la nuit et ce qui reste sans maquette.
- Quarante-huitième lot régional (PR #100) : l'amphithéâtre des Trois Gaules.
- Quarante-neuvième lot régional (PR #101) : les forts de Douaumont et de Vaux, la chapelle du Père-Lachaise.
- **Les retours de Gautier au réveil** (PR #102). La colonne Vendôme ne s'ouvrait pas quand on la touchait : elle est sur la place, hors de toute parcelle. Les monuments s'ouvrent maintenant d'un toucher sur leur maquette. Gautier a aussi demandé que toucher Street View dans la fiche fasse passer à la balade, la carte suivant dessous pour qu'on puisse toucher les bâtiments vus en chemin : c'est fait. Il a remarqué que les lieux marquants sont presque tous des églises et demandé si tous les lieux de culte (mosquées, synagogues…) en sont, pour éviter les polémiques. La réponse est non : seules les églises ont été téléchargées le 2 novembre. La proposition de Claude : tous les lieux de culte à égalité, plus un bouton pour signaler un lieu. Elle attend sa réponse.
- **Street View reste gratuit** (PR #103). Gautier a essayé : la photo de la fiche semblait figée, il fallait la toucher une fois avant de pouvoir tourner. Et la rotation de la promenade se faisait par à-coups, comme un diaporama. Ces à-coups viennent de la version gratuite de Street View, qui ne dit jamais au jeu où l'on regarde. Claude a proposé le Street View interactif de Google : fluide, avec la carte qui suit en direct, mais payant au-delà de 5 000 ouvertures par mois. Gautier a choisi de rester gratuit, sans balade automatique : la photo de la fiche se tourne de nouveau au doigt, et la promenade part de son bouton.
- **Tous les lieux de culte** (PR #104). Gautier ne demande pas l'égalité des nombres : « si il y a plus d'églises c'est comme ça, mais les autres lieux de culte doivent aussi être présents ». Les lieux célèbres comptent maintenant 149 synagogues, 67 mosquées, 193 temples protestants, 25 temples bouddhistes et pagodes, 8 églises orthodoxes et un temple hindou (Bussy-Saint-Georges) ; aucune gurdwara n'a d'article. Dans les packs, la carte bleue « église » devient « lieu de culte », de toute religion : le plus proche du point tiré.
- **La Grande Mosquée de Paris devient un monument** (PR #105), à la demande de Gautier, avec sa maquette 3D. Elle est nationale selon la règle commune (47 articles Wikipédia), et la cathédrale de Nantes passe en régional. Gautier a demandé de vérifier les autres lieux de culte. Quatre églises sont au-dessus du seuil, dans le même cas. Une vingtaine de lieux sont pile au seuil, dont deux synagogues (Marseille, Versailles) et la cathédrale grecque orthodoxe de Paris. Question posée à Gautier.
- **Quatre églises de plus aux monuments** (PR #106). Gautier : « oui les 4 ». Saint-François-Xavier, Saint-Ambroise, la basilique Saint-Martin de Tours et Saint-Pierre-le-Vieux de Strasbourg ont chacune leur maquette 3D.
- **Les graphismes reprennent : la révélation d'une carte** (PR #107). Gautier, sur son téléphone par Remote Control, demande qu'une ouverture de pack soit « un vrai événement ». Chaque carte Rare, Épique ou Légendaire explose dans la lumière de sa couleur, puis les informations arrivent une à une, façon FIFA. Il demande aussi un design « moins dessin animé, plus classe, stylé, impressionnant ». La révélation passe en style premium : nuit, or, lumière. Il se dit prêt à payer Meshy (3D par IA). Claude répond que ce n'est pas utile pour la révélation (tout est en code), et que la question se posera pour d'éventuels objets 3D. La question d'étendre ce style au reste du jeu lui est posée.
- **La pochette et les cartes refaites** (PR #108). Gautier trouve le pack et les cartes « moches » : le pack n'est qu'un pavé, et une carte révélée semble remplacée par une autre. Il veut une ouverture « la plus proche de Pokémon Pocket » et propose de payer Meshy pour le pack. Claude fait le sachet en code, sans Meshy, pour pouvoir le déchirer et y mettre le décor : un sachet métallisé bombé, avec soudures d'or et décor « classe ». Chaque carte devient un seul objet qu'on retourne, qu'on incline et qu'on fait glisser, et ses reflets bougent avec elle.
- **L'interview des cartes, puis les nouvelles cartes et la nouvelle révélation** (PR #109). Gautier trouve les cartes « trop basiques » et la révélation trop simple : elle « ne fait pas monter la pression ». Il veut qu'un toucher passe à l'étape suivante, avec une étape « région ». Comme il n'arrive pas à exprimer ses idées, il demande une interview « ultra poussée » : cinq séries de questions, une synthèse qu'il valide, une preuve. En route, il demande de ne pas tomber dans la science-fiction (« ce n'est pas au jeu de s'adapter au pack ») et signale la plaque qui touchait le cadre. Pour voir des cartes rares sans compter sur la chance, il obtient un pack d'essai.
- **La révélation sur la carte** (PR #110). Gautier teste avec le pack d'essai. La comète est « super moche », la pression ne monte pas, la carte est « trop fine », rien n'est fluide (écran noir avant le plan) et la pile ne fait pas un paquet. Quelques questions à choix précisent ses envies : la carte doit avoir de l'épaisseur, des traits plus marqués et plus de richesse ; la révélation doit se jouer sur la carte qui se retourne, annoncée par la carte de dos qui s'illumine et tremble, avec des noms qui claquent.
- **La fluidité** (PR #111). Gautier : l'ouverture « lag trop » pour qu'il puisse juger, et les noms sont peu visibles. Claude mesure au téléphone simulé et trouve les causes : couches 3D trop nombreuses, effets coûteux, calculs au mauvais moment. La révélation passe d'environ 2,5 à 40 images par seconde. Pendant ce travail, Gautier annonce le nouveau nom du jeu : **CityDeck**.
- **Le nom : CityDeck** (PR #112). Le nom se voit dans le titre, sur la pochette, au dos des cartes, sur l'écran d'accueil et de connexion, et à l'installation sur le téléphone. Cadastra reste dans le code et les clés internes, pour ne perdre aucune partie.
- **Les coins, le dos, la tension** (PR #113). Gautier trouve l'ensemble « pas mal » et demande des réglages : les coins coupés font « rognés », le dos est « pas premium », et on voit le lieu avant le zoom. Réponses : coins arrondis et angles ouvragés, un dos premium (médaillon, rosace, filigrane), plus de point avant la fin, et une roulette des régions puis des départements.
- **La collection aux nouvelles cartes** (PR #114). Gautier trouve l'ouverture « top ». La collection prend les mêmes cartes, en grille, et une carte touchée s'ouvre en grand, inclinable, maquette qui tourne.
- **Le cadre des cartes** (PR #115). Gautier : « très bien pour le patrimoine », mais des cadres de couleur « rentrent et sortent de la carte, c'est moche ». Sur son téléphone, le filet intérieur était dessiné plus petit et décalé. Il est retiré : un seul filet au bord, à la couleur de la rareté.
- **La maquette sur la carte des monuments** (PR #116). Gautier dit oui : la carte d'un monument montre sa maquette, celle de la carte du jeu (416 monuments), en porcelaine aux arêtes d'or comme les autres cartes, à la place du bloc blanc de l'IGN.
- **La séance de game design du 4 nov. après-midi** (conversation de l'app Claude, PR #117, documents seulement). Gautier cherche « une règle simple qui maintient les joueurs » : la collection seule donne une sensation de jeu fini, un Maire fondé sur le stock de lieux « le restera jusqu'à la mort ». Examinés puis écartés : le combat (village-deck, troupes, raids), les élections, la friche des adresses. Retenus : le **Maire par caisse de travaux mensuelle**, des **saisons de 3 mois**, les **monuments « prestige, pas revenu »** (enchères en pièces, reprise après 14 jours d'absence, entretien exponentiel), la **monnaie premium (gemmes)** à sens unique pour les packs, les packs régionaux, le Pass 15 jours et les offres entre joueurs. Les **événements de commune** (Attractivité, votes) sont écrits pour la V2 (`docs/EVENEMENTS-V2.md`). Le nom **CityDeck** est vérifié (aucune marque, citydeck.fr libre) ; une simulation de l'économie des gemmes (`tools/sim_gemmes.py`) montre ~0,95 € par joueur actif et par mois.
- **Le pack au toucher rapide, deux décisions** (PR #118). Gautier : « quand on spamme le clic pour aller plus vite, une carte sur deux ne se dévoile pas ». Le toucher arrivait pendant que la carte précédente s'envolait : la carte suivante partait sans être retournée. C'est corrigé. Gautier tranche aussi : la monnaie premium, ce sont **les gemmes**, et **le Maire change toutes les 2 semaines**, pas tous les mois.
- **Le Maire par caisse de travaux, dans le jeu** (PR #119). Gautier : « allez, on commence » le game design du 4 nov. Première étape : dans la démo, chaque commune a sa caisse de travaux ; on y verse, le plus gros contributeur devient Maire pour 2 semaines et touche 5 % des loyers des autres. Le serveur suit à l'étape d'après.
- **La caisse de travaux sur le serveur** (PR #120). Le vrai serveur a maintenant la caisse : on y verse pour de vrai, les Maires sont élus toutes les 2 semaines avec les mêmes règles que la démo, et les robots du serveur d'essai versent aussi, pour que Gautier ait des rivaux.
- **La promenade au toucher** (PR #121). Gautier : en promenade, toucher un bâtiment sur la carte 3D doit emmener Street View devant lui. C'est fait (face à la façade, le bâtiment apparaît « en face » sous la carte) ; toucher une rue y emmène aussi.
- **La maquette qui se montrait trop tôt** (PR #122). Gautier : en dévoilant une carte, on apercevait le modèle 3D de l'adresse avant la carte de France. Le voile de la révélation arrivait en fondu pendant que la carte se retournait ; il est désormais opaque dès le départ.
- **Les saisons et les classements, dans le jeu** (PR #123). Gautier : « enchaîne ». Deuxième étape du game design du 4 nov. : une carte « Saison » en tête de l'écran Communes (mes places), les classements des Maires et de patrimoine, et à chaque fin de saison un podium et une plaque « Maire de la saison » sur la fiche des communes. Le serveur suit à l'étape d'après.
- **Les saisons sur le serveur** (PR #124). Les classements portent maintenant sur les vrais joueurs du serveur ; à chaque fin de saison, le serveur fige les podiums, grave les plaques et prévient chacun de sa place.
- **Les monuments, dans le jeu** (PR #125). Gautier : « enchaîne, je teste en même temps ». Troisième étape du game design du 4 nov. : l'entretien des monuments (300, 600, 1 200… par mois), la dette et la reprise du plus cher après un mois d'impayé, la reprise de tous ses monuments après 14 jours d'absence. Le serveur et l'alerte à Gautier suivent.
- **Les monuments sur le serveur** (PR #126). Le vrai serveur prélève l'entretien, reprend les monuments des absents et des mauvais payeurs, les remet aux enchères dans un lot de reprise, et laisse une alerte à Gautier dans le tableau de bord Supabase (avec une phrase prête à poster). L'e-mail viendra avec un service d'envoi.
- **La boutique, dans le jeu** (PR #127). Gautier choisit de continuer par la boutique et les gemmes (phase 9). Dans la démo : les gemmes en haut de l'écran, la boutique (pack national, pack régional, Pass 15 jours et son bon d'adresse, chances affichées), et des gemmes d'essai en attendant le paiement par carte. Le serveur suit.
- **La boutique sur le serveur** (PR #128). Le vrai serveur vend maintenant packs et Pass en gemmes (des gemmes d'essai en attendant le paiement par carte) ; le bon du Pass ne prend qu'une adresse, comme le dit le game design, et le serveur la vérifie auprès de la Base Adresse Nationale.
- **Les ventes en gemmes** (PR #129). Gautier : « oui, vas-y ». Un joueur met en vente en pièces ou en gemmes ; les offres suivent la monnaie du vendeur (sinon celle de l'acheteur) ; les gemmes passent d'un joueur à l'autre sans commission. Dans la démo et sur le serveur.
- **Le paiement par carte** (PR #130). Gautier : « on continue, guide-moi ». Il crée son compte Stripe en mode test et pose lui-même la clé secrète dans les secrets de GitHub (jamais dans la conversation). Le jeu ouvre la page de paiement de Stripe ; le serveur vérifie auprès de Stripe avant de créditer les gemmes.
- **La sortie des cartes** (PR #132). Gautier, après avoir essayé avec le son : les cartes « n'ont pas l'air de sortir du pack », « ça lag », on voit mal que les cartes de dos sont empilées, et « les battements de cœur, ça fait nul ». Les cartes montent désormais hors du sachet, qui tombe ensuite ; la préparation de la révélation attend que la pile soit posée (l'image se figeait une demi-seconde) ; la pile a des liserés d'or ; le cœur est retiré.
- **Les menus** (PR #133). Gautier choisit « le style classe partout ». La première preuve, nuit et or, est « trop basique, on dirait une appli de réservation d'hôtel ». Une interview l'oriente vers « Clash Royale en plus riche », puis il demande « un peu moins cartoon », puis « encore moins cartoon », puis « moins de couleurs, on dirait un jeu Roblox ». Une seconde interview tranche : les menus de Pokémon TCG Pocket, un seul accent (le bleu de la plaque), une barre du bas blanche, des icônes au trait. « Oui, applique partout. » Pour la carte de la ville, il choisit « selon l'heure » : la carte passe en nuit le soir.
- **Le logo et la pièce** (PR #135). Gautier : « passons à la suite ». Il trouve la pièce-maison « moche » et veut « un logo avec le nom complet et un logo ». Après deux séries de pistes (il choisit les cartes et la ville, puis la pièce à la ville), il envoie son propre logo, fait avec un générateur d'images d'après les prompts de `docs/KIT-MARQUE.md` (PR #134, piste A) : la plaque CITYDECK, deux cartes dorées, une pièce ronde à la maison, « la pièce intégrée au logo ». Claude le redessine en SVG et en fait aussi la pièce de la monnaie.
- **Petits retours** (PR #136). Gautier, sur son téléphone et sur ordinateur : « sur le bouton récolter il y a une épingle bizarre », « il faut pouvoir appuyer sur Entrée pour valider (pour les joueurs web) », « je ne trouve pas le classement par richesse », « le menu déroulant des packs régionaux est trop basique ».
- **Le classement des pièces** (PR #137). Gautier : « le classement est trop caché, et ajoute un classement par pièces possédées ». Un trophée rejoint la cloche, en haut de la carte ; un onglet « Pièces » rejoint Patrimoine, Maires et Passées.
- **Les boutons rognés** (PR #138). Gautier envoie une capture de son téléphone : la cloche et le montant de pièces sortent de l'écran, « il ne faut pas que ça se produise sur aucun téléphone ». Sur sa capture, le téléphone assombrissait aussi la page tout seul.
- **Les robots** (PR #139). Gautier demande à quoi sert la valeur, puisque ce sont les joueurs qui fixent les prix. Claude : elle guide le joueur et règle le comportement des robots, qu'on devait retirer au lancement. Gautier décide alors : « laisser les robots au début du jeu, leur donner des consignes pour jouer comme des humains et ne pas abuser ; on les retirera progressivement avec la montée des joueurs », et « un robot supprimé = son patrimoine remis en jeu ». Les événements réels (crues, fermetures) restent pour la V2.
- **Les robots cachés** (PR #140). Gautier : « il faut cacher les robots, le but est de faire croire que le jeu est actif ; par contre, les robots ne font jamais de transaction avec des gemmes (vente ou achat). » Claude signale le risque d'une pratique commerciale trompeuse envers des joueurs qui paient, et propose une phrase générale dans les CGU (à décider avant le lancement).
- **Le domaine** (PR #141). Gautier accepte la phrase générale des CGU (« ok »), et achète **citydeck.fr** chez Infomaniak. Le serveur et la connexion sont prêts ; Gautier règle la zone DNS et la clé Google (guide bouton par bouton), puis Claude branche le domaine.
- **citydeck.fr branché** (PR #142). Gautier règle la zone DNS chez Infomaniak et la clé Google (« c'est bon ») ; Claude vérifie la zone et branche le domaine. Le jeu est désormais à https://citydeck.fr/.
- **Avant la pub** (PR #143). Gautier demande ce qui manque avant de faire de la pub ; Claude dresse la liste (le serveur pour tous, les e-mails, le vrai rythme, les pages légales, les vrais paiements, puis la bêta, les sauvegardes, l'anti-triche, l'image de partage, le suivi, la marque). Gautier : « faisons les points facilement réalisables sur téléphone ». Claude fait « Supprimer mon compte » et l'image de partage, et guide Gautier pour le service d'e-mails.
- **Les pages légales** (PR #144). Gautier remet Brevo à son retour devant le PC (Claude ne peut ni créer le compte ni se connecter à sa place) et donne la fiche de son entreprise individuelle pour les mentions légales. Claude rédige les conditions d'utilisation et de vente, la confidentialité et les mentions légales, et les relie au jeu.
- **Les cookies de Google** (PR #145). Gautier : « on met dans les CGU que si un joueur joue au jeu, il accepte d'office les cookies Google, et on explique pourquoi ». Claude l'écrit et signale le risque (pour la CNIL, l'acceptation des conditions ne vaut pas accord pour ces cookies). Gautier demande aussi la traduction complète du jeu en anglais, avec le choix de la langue dans les réglages (français par défaut, noms propres et rues gardés en français).
- **L'anglais** (PR #146). Gautier, dans le même message : « il faut une traduction complète du jeu en anglais (on garde les noms propres et les rues en français), avec le choix des langues dans les paramètres, et par défaut le français ». Claude ajoute une couche qui traduit tout à l'affichage (écrans, bandeaux, notifications, messages du serveur, pochette du pack), sans réécrire le jeu : le code reste en français, et un test vérifie que chaque nouveau message a sa traduction. Le choix est dans les Réglages et sur l'écran de compte ; les pages légales sont traduites (la version française fait foi).
- **La langue du téléphone** (PR #147). Pendant la mise en ligne, Gautier précise : « idéalement la langue se met en fonction de la langue du périphérique par défaut, avec modification possible ». Le jeu suit désormais le téléphone (français s'il est en français, anglais pour toute autre langue, proposition de Claude), et le choix des Réglages passe avant.
- **Le vrai serveur pour tous** (PR #148). Gautier : « on passe à quoi ? ». Claude propose de mettre tout le monde sur le vrai serveur (la grosse étape avant la bêta entre amis), ou d'ajouter des lieux célèbres ; Gautier : « super, c'est quoi la suite ? ». Plus de démo par défaut ni d'interrupteur : tout visiteur crée son compte et joue sur le serveur ; les signalements partent au serveur ; le cadre rose « Erreur de style » du 3 nov. est corrigé. Il manque, pour inviter des amis, le service d'e-mails (Brevo : le compte est à créer par Gautier, devant le PC).
- **Le suivi** (PR #149). Claude propose ensuite un tableau de suivi et un minimum d'anti-triche (ou les lieux célèbres) ; Gautier : « vas-y ». Les jours de visite des vrais joueurs sont notés ; deux vues du tableau de bord de Supabase donnent les inscrits, les venus, les retours du lendemain et du 7e jour, et les achats.
- **Les lieux célèbres** (PR #152). Claude propose d'ajouter les châteaux, mairies, gares, musées, phares, moulins… aux lieux célèbres ; Gautier demande ce que ça change aux packs, puis : « oui vas-y, mais il faut que les légendaires restent rares ». La chance d'une Légendaire ne change pas (1 carte sur 100) ; les Rares écartent les lieux célèbres ; les marques (grands vins, cabarets, musées de marque) sont écartées.
- **Le niveau des communes** (PR #153). Gautier remet Brevo à plus tard : « on fait tout ce qui ne nécessite pas un PC ». Claude enchaîne avec ce que le game design du 4 nov. prévoyait encore : ce qui a été versé à la caisse d'une commune, depuis toujours, la fait monter de niveau (arbres, lampadaires, fleurs, fontaine, kiosque), visible dans la commune et sur la carte.
- **Les travaux s'usent** (PR #156). Gautier : « c'est bien de monter le niveau d'une commune, mais si elle est au niveau max, il reste quoi à faire ? Comment devenir Maire ? Pour quoi faire ? ». Claude rappelle les règles du Maire (le plus gros versement de la quinzaine, 5 % des loyers des autres plafonnés, surtout du prestige) et propose ; Gautier choisit : les travaux s'usent (10 % toutes les 2 semaines), le niveau donne +2 % de loyer par niveau à tous les propriétaires de la commune, et le plafond du Maire monte avec le niveau (jusqu'à 2 000). Il accepte aussi l'horloge (« oui, active-la »).
- **Les monuments qui sont des marques** (PR #157). Claude repose la question ouverte depuis le 3 nov. (le Ritz, Maxim's, le Crillon, le Negresco, Château Margaux, le Train bleu sont des marques) ; Gautier : « garde-les ». Ils restent aux enchères.
- **Les marques qui restaient** (PR #158). Gautier : « reste-t-il des trucs que tu peux faire seul ? ». Claude enchaîne ce qui ne demande pas Gautier. D'abord les marques encore présentes : un pack pouvait donner un domaine viticole en Rare (près de Pauillac, l'IGN ne propose que des « Château Lynch-Bages », « Château Pédesclaux »…) ; ces noms sont désormais écartés des packs, ainsi que huit lieux célèbres (Vache qui rit, Matmut Stadium, champagne Jacquesson…).
- **Les maquettes des marques** (PR #159). Dans la même série, les six monuments gardés aux enchères reçoivent leur maquette 3D : la façade du Ritz sur la place Vendôme, la colonnade du Crillon, la devanture rouge de Maxim's, la coupole rose du Negresco, le portique de Château Margaux, la tour de l'Horloge de la gare de Lyon pour le Train bleu.
- **L'horloge du serveur** (PR #155). Dans la même série : toutes les 10 minutes, GitHub appelle le serveur pour clore les enchères, faire tourner les mandats et les saisons, tenir les monuments et faire jouer les robots, même sans joueur.
- **L'anti-triche** (PR #150). Dans la foulée : pas plus de 60 actions par minute pour un compte, et une empreinte chiffrée de la connexion (jamais l'adresse IP) ; dès 3 comptes sur une même connexion dans la journée, une alerte pour Gautier, sans rien bloquer (familles, réseaux partagés, multi-comptes tolérés en V1).

## Toutes les PR

Heures de Paris. Avant la PR #1, le travail était poussé directement sur `main` :

| Date | Étape |
|---|---|
| 02/11 19:21 | Phase 0 : référence du projet (CLAUDE.md, GDD, plan), prototype, publication GitHub Pages |
| 02/11 19:26 | Phase 0 : moteur de règles des lieux, réglages d'économie et tests |
| 02/11 19:32 | Le jeu s'appelle Cadastra (puis la vérification des domaines et des marques) |
| 02/11 20:30 | Phase 1.5 : standing réel des communes (DVF) et 458 monuments (Wikidata) |
| 02/11 20:46 | Publication : lancer les tests sans `npm ci` |
| 02/11 21:04 | Carte : le badge « en vente » ne s'étale plus en grande ellipse sombre |
| 02/11 21:14 | Lieux célèbres : églises et chapelles ; repère ⭐ toujours visible (21:42) ; cathédrales et abbayes (21:56) |
| 02/11 21:49 | Enchères : 3 monuments par semaine (1 national + 2 régionaux) |
| 02/11 21:56 | Pack tiré par rareté et révélation accélérée d'un toucher |
| 02/11 22:22 | Compte et patrimoine : filtre des pseudos, Signaler, récolte à la connexion, filtres |
| 02/11 23:27 | Guide Supabase ; projet `cadastra` créé et premières tables (23:34) |
| 02/11 23:45 | Inscription obligatoire (e-mail + mot de passe), puis pseudo + avatar |
| 02/11 23:52 | Le pseudo est définitif |
| 03/11 00:11 | Nouveau style « la plaque et la pièce » ; tous les écrans (00:19) ; finitions (00:24) ; pack, icône, installation (00:28) ; outil de visite des écrans (00:32) |

Puis une PR par étape, fusionnée en squash :

| PR | Fusionnée | Titre |
|---|---|---|
| #1 | 03/11 08:14 | Recherche rapide, cartes du pack à leur place, nouvelle pièce |
| #2 | 03/11 08:21 | Écran de voyage : attendre une image dessinée avant de juger le quartier chargé |
| #3 | 03/11 08:35 | Plaque de rue plus réaliste, adresses en plaques sur les cartes, prix de vente au choix |
| #4 | 03/11 08:44 | Cartes : la plaque de rue sur un mur de briques rouges |
| #5 | 03/11 08:51 | Cartes « full art » : l'illustration sur toute la carte |
| #6 | 03/11 08:56 | Le jeu se met à jour tout seul sur le téléphone |
| #7 | 03/11 08:59 | Proposer d'échanger un de ses lieux contre celui d'un autre joueur |
| #8 | 03/11 09:05 | Un lieu libre ne s'achète pas : il sort des packs |
| #9 | 03/11 09:17 | Street View : regarder le lieu depuis la rue, plus l'intérieur d'une boutique |
| #10 | 03/11 09:42 | Street View prêt pour la clé Google : photo d'extérieur, visée exacte |
| #11 | 03/11 10:55 | Street View avec la clé Google : le monument vu de dehors, de face |
| #12 | 03/11 10:57 | Street View : regarder le monument à hauteur d'yeux |
| #13 | 03/11 11:06 | « Voir sur la carte » ouvre la fiche même pour un monument sur la rue |
| #14 | 03/11 11:16 | Bâtiment rouge = lieu d'un joueur ; échanger plusieurs lieux d'un coup |
| #15 | 03/11 11:25 | Enchères : « Voir sur la carte » ouvre la fiche du monument |
| #16 | 03/11 11:32 | Interface plus lisible sur téléphone |
| #17 | 03/11 11:44 | Six raretés (Légendaire orange, Extraordinaire arc-en-ciel) et le Gratte-ciel |
| #18 | 03/11 11:50 | Un bâtiment par rareté (le Palace) |
| #19 | 03/11 11:52 | Publication : les règles se mettent à jour avec la page |
| #20 | 03/11 12:00 | Communes : chercher une commune et voir son Maire |
| #21 | 03/11 13:40 | Serveur 8.1a : fondations (tables, fonction « jeu », mise à jour automatique) |
| #22 | 03/11 13:55 | Serveur : déployer la fonction sans confirmation |
| #23 | 03/11 13:58 | Serveur : droits de la fonction sur ses tables, détail des pannes |
| #24 | 03/11 14:06 | Serveur 8.1c : le pack du jour tiré par le serveur (tirage partagé) |
| #25 | 03/11 14:12 | Serveur 8.1b : le jeu joue sur le vrai serveur (interrupteur d'essai) |
| #26 | 03/11 14:56 | Serveur 8.1d : le monde réel ; un pack ne s'ouvre qu'une fois à la fois |
| #27 | 03/11 15:05 | Serveur 8.1e : le marché (vente, achat, offres, notifications) |
| #28 | 03/11 15:13 | Serveur d'essai accéléré : un jour du jeu = une minute |
| #29 | 03/11 15:22 | Serveur d'essai : des joueurs robots qui jouent seuls |
| #30 | 03/11 15:26 | Robots : le serveur a le droit d'écrire les profils |
| #31 | 03/11 15:30 | Essai du serveur : ce que les robots ont fait |
| #32 | 03/11 16:25 | Offres : la valeur de ton lieu et l'écart ; des robots acheteurs |
| #33 | 03/11 16:34 | La valeur d'un lieu bouge : ventes de la commune, activité du quartier, tendance de la semaine |
| #34 | 03/11 17:22 | La promenade en Street View |
| #35 | 03/11 17:30 | Historique, suivi du projet et procédure pour continuer dans Claude Code |
| #36 | 03/11 18:19 | Promenade : on peut toujours tourner dans Street View (le geste ne part plus dans la page Google) |
| #37 | 03/11 20:51 | Notes : une phrase de CLAUDE.md corrigée, heures des PR |
| #38 | 03/11 21:30 | Reprise dans Claude Code : le test du serveur passe aussi sous Windows |
| #39 | 03/11 21:39 | Serveur 8.1f : les échanges entre joueurs |
| #40 | 03/11 21:50 | La mise à jour du téléphone n'abandonne plus ; la version dans les Réglages |
| #41 | 03/11 22:01 | Serveur 8.1g : les enchères de monuments |
| #42 | 03/11 22:57 | Graphismes, la preuve : bible graphique, cartes par rareté, dos des cartes, pochette du pack |
| #43 | 03/11 23:11 | Graphismes : l’ouverture du pack (déchirure au doigt, cartes qui sortent, sons) |
| #44 | 03/11 23:29 | Graphismes : la tour Eiffel en 3D sur la carte |
| #45 | 03/11 23:48 | Graphismes : Notre-Dame, l’Arc de triomphe et le Sacré-Cœur en 3D ; les monuments restent beaux de près |
| #46 | 04/11 00:03 | Graphismes : huit monuments de plus en 3D ; les maquettes nettes de près (précision) |
| #47 | 04/11 00:15 | GDD : le Pass mensuel décidé par Gautier (pack de 8 cartes, bon mensuel pour une adresse au choix) |
| #48 | 04/11 00:38 | Graphismes : dix monuments de plus en 3D ; les maquettes ne ralentissent plus la carte |
| #49 | 04/11 00:56 | Graphismes : le Louvre, le Mont-Saint-Michel, Carcassonne, Chenonceau, le palais des Papes et la Madeleine en 3D |
| #50 | 04/11 01:07 | Graphismes : le Grand Palais, les ponts Alexandre-III et Neuf, la Conciergerie, le Palais-Royal, la place des Vosges et Saint-Sulpice en 3D |
| #51 | 04/11 01:14 | Graphismes : Vaux-le-Vicomte, Vincennes, Blois, Amboise, le château d'If, Notre-Dame-de-la-Garde et le viaduc de Millau en 3D |
| #52 | 04/11 01:23 | Graphismes : les onze derniers monuments nationaux en 3D (Bourges, Beauvais, Nantes, Vézelay, Cluny, Fontenay, Ronchamp, la Maison carrée, Orange, le pont d'Avignon, Carnac) |
| #53 | 04/11 01:29 | Graphismes : huit monuments régionaux en 3D (Montsoreau, Saint-Germain-en-Laye, Saint-Savin, la Saline royale, Saint-Eustache, Chaillot, la place Stanislas, Laon) |
| #54 | 04/11 01:34 | Graphismes : dix monuments régionaux en 3D (Fontevraud, le palais du Tau, Azay-le-Rideau, Cordouan, Villandry, l'observatoire de Nice, Albi, l'École militaire, le théâtre des Champs-Élysées, le Clos Lucé) |
| #55 | 04/11 01:39 | Graphismes : six monuments régionaux de plus (l'Odéon, Chantilly, Angers, Bayeux, l'arc d'Orange, la villa Savoye) ; les maquettes construites à la demande |
| #56 | 04/11 01:43 | Graphismes : dix monuments régionaux de plus (Saint-Remi, Saint-Germain-l'Auxerrois, la tour Saint-Jacques, les arènes de Lutèce, Saumur, la place des Victoires, le Haut-Kœnigsbourg, Saint-Étienne-du-Mont, les arènes de Nîmes, la colonne de Juillet) |
| #57 | 04/11 01:48 | Graphismes : dix monuments régionaux de plus (Pierrefonds, Saint-Jean de Lyon, la Major, la porte Saint-Denis, la colonne Vendôme, le trophée des Alpes, le Lion de Belfort, Ussé, le pont Mirabeau, Fourvière) |
| #58 | 04/11 01:54 | Graphismes : dix monuments régionaux de plus (Loches, Château-Gaillard, Langeais, Saint-Sernin, Sainte-Clotilde, Bordeaux, Metz, Clermont-Ferrand, Cheverny, le viaduc de Garabit) |
| #59 | 04/11 01:58 | Graphismes : dix monuments régionaux de plus (l'Institut de France, Saint-Gervais, Chaumont, Valençay, Orléans, Sens, Tours, Notre-Dame-des-Doms, Saint-Front, Sully-sur-Loire) |
| #60 | 04/11 02:02 | Graphismes : dix monuments régionaux de plus (Limoges, Sarlat, Noyon, Saint-Benoît-sur-Loire, Foix, Saint-Augustin, le Capitole, Sénanque, Saint-Alexandre-Nevsky, Le Mans) |
| #61 | 04/11 02:20 | Graphismes : douze monuments régionaux de plus (Saint-Pierre de Montmartre, Brissac, le pont Royal, la Trinité, Autun, le château des ducs de Bretagne, Castelnaud, Dijon, Angoulême, Saint-Trophime, Narbonne, les arènes d'Arles) |
| #62 | 04/11 02:27 | Graphismes : douze monuments régionaux de plus (Saint-Merri, Saint-Séverin, Quimper, Troyes, Saint-Étienne de Toulouse, Saint-Roch, Saint-Vincent-de-Paul, la porte Saint-Martin, la Salpêtrière, la synagogue de Besançon, Chinon, Coucy) |
| #63 | 04/11 02:36 | Graphismes : douze monuments régionaux de plus (Saint-Julien-le-Pauvre, le baptistère de Poitiers, Beynac, Pau, Saint-Nicolas-du-Chardonnet, l'abbaye aux Hommes, Aiguilhe, Auch, Rennes, Angers, le pont Marie, le palais des ducs de Bourgogne) |
| #64 | 04/11 02:45 | Graphismes : douze monuments régionaux de plus (les cathédrales de Blois, Vannes, Poitiers, Montpellier, Soissons, Versailles et Rodez, le Val-de-Grâce, Saint-Michel de Bordeaux, Notre-Dame-des-Victoires, la grande synagogue, la fontaine des Innocents) |
| #65 | 04/11 02:50 | Graphismes : douze monuments régionaux de plus (Saint-Paul-Saint-Louis, Notre-Dame-de-Lorette, Saint-Jean de Montmartre, Senlis, Meaux, Conques, l'abbaye aux Dames, Châteaudun, les hôtels de Sens et de Sully, Saint-Urbain de Troyes, la chapelle expiatoire) |
| #66 | 04/11 02:57 | Graphismes : douze monuments régionaux de plus (les cathédrales de Coutances, Auxerre, Bayonne, Béziers, Nevers et Toul, Saint-Ouen de Rouen, les Hospices de Beaune, Gien, Falaise, l'ossuaire de Douaumont, Saint-Thomas de Strasbourg) |
| #67 | 04/11 03:05 | Graphismes : onze monuments régionaux de plus (le pont Valentré, Saint-Joseph du Havre, le mémorial de Vimy, Notre-Dame-la-Grande, les cathédrales du Puy et de Cahors, Saint-Maclou, les Jacobins de Toulouse, le phare d'Ar-Men, Vitré, la basilique de Lisieux) |
| #68 | 04/11 03:11 | Graphismes : douze monuments régionaux de plus (le palais de la Légion d'honneur, le Grand-Théâtre de Bordeaux, la cathédrale russe de Nice, le palais Rohan, l'hôtel de ville de Lyon, Saint-Nicolas-des-Champs, La Tourette, les cathédrales d'Arras, Évreux, Perpignan, Moulins et Langres) |
| #69 | 04/11 03:17 | Graphismes : douze monuments régionaux de plus (la basilique de Saint-Quentin, les cathédrales de Nancy, Lisieux, Montauban, Agen, Cambrai, Saint-Brieuc, Sées, Saint-Malo et Agde, Tournus, Saint-Pierre de Caen) |
| #70 | 04/11 03:23 | Graphismes : douze monuments régionaux de plus (le musée d'Orsay, le mémorial de Thiepval, le Gros-Horloge, la porte des Allemands, Tarascon, Salses, Josselin, Hautefort, le château d'Annecy, le fort la Latte, les cathédrales de La Rochelle et de Vienne) |
| #71 | 04/11 03:29 | Graphismes : douze monuments régionaux de plus (Saint-Paul de Strasbourg, la collégiale de Colmar, Notre-Dame de Dijon, la Trinité de Vendôme, Verdun, Saint-Nicolas-de-Port, Bonaguil, Montreuil-Bellay, Maintenon, Sceaux, le temple du Marais, le théâtre antique de Lyon) |
| #72 | 04/11 03:35 | Graphismes : onze monuments régionaux de plus (les châteaux de Caen, Dinan, Anet et Écouen, l'abbaye de Moissac, les cathédrales d'Ajaccio, Saintes, Bazas et Nice, l'arc de Germanicus, Saint-Michel de Carcassonne) |
| #73 | 04/11 03:41 | Graphismes : onze monuments régionaux de plus (la cathédrale d'Aix, les châteaux de Maisons, du Plessis-Bourré, de Talcy, de Roquetaillade et d'Abbadia, Saint-Victor de Marseille, la Daurade, la grande synagogue et Saint-Seurin de Bordeaux, la cathédrale de Valence) |
| #74 | 04/11 03:46 | Graphismes : onze monuments régionaux de plus (Quéribus, Montségur, Jumièges, Murbach, Pontigny, Corbie, Oloron, Brégançon, la tour Clovis, Ferrières, le Thoronet) |
| #75 | 04/11 03:52 | Graphismes : dix monuments régionaux de plus (les châteaux de Serrant, Ancy-le-Franc, Fénelon, Saché, Menars, du Rivau et de Beauregard, la cathédrale de Lescar, Notre-Dame-de-Bonne-Nouvelle, la fontaine Médicis) |
| #76 | 04/11 03:57 | Graphismes : sept monuments régionaux de plus (la cathédrale de Besançon, l'observatoire de Meudon, Saint-Médard, Saint-Eugène, Sainte-Élisabeth, le théâtre antique d'Arles, la salle du Jeu de paume) |
| #77 | 04/11 04:12 | Graphismes : neuf monuments régionaux de plus (la porte de Mars, Châlons, Notre-Dame-en-Vaux, le temple de Vienne, Suscinio, Fougères, le palais Longchamp, le pont transbordeur, Saint-Pol-de-Léon) |
| #78 | 04/11 04:20 | Graphismes : sept monuments régionaux de plus (le musée de Picardie, Najac, Sainte-Croix de Bordeaux, Ainay-le-Vieil, Saint-Pierre-le-Jeune, Azay-le-Ferron, Saint-Leu-Saint-Gilles) |
| #79 | 04/11 04:27 | Graphismes : huit monuments régionaux de plus (Murol, Villesavin, Montpoupon, Puymartin, La Brède, Antibes, Viviers, Chaalis) |
| #80 | 04/11 04:34 | Graphismes : huit monuments régionaux de plus (Fontfroide, Valmagne, Maguelone, Lavaur, l'Épau, Montmajour, Saint-Paul-de-Mausole, le Pont-Vieux d'Albi) |
| #81 | 04/11 04:43 | Graphismes : dix monuments régionaux de plus (Châlus-Chabrol, Puivert, Saint-Martin-du-Canigou, Cadouin, Remiremont, Puilaurens, Aguilar, Termes, Beauport, Commarque) |
| #82 | 04/11 04:49 | Graphismes : cinq monuments régionaux de plus (les châteaux de Lastours, Peyrepertuse, Clisson, la basilique de Luxeuil, Saint-Michel-de-Cuxa) |
| #83 | 04/11 04:56 | Graphismes : quatre monuments régionaux de plus (la Grande Chartreuse, le palais de Compiègne, l'abbaye Saint-Remi, le fort Saint-Jean) |
| #84 | 04/11 05:01 | Graphismes : six monuments régionaux de plus (Gellone, le Bec-Hellouin, la villa Ephrussi, la Roche-aux-Fées, le cairn de Barnenez, le menhir d'Er Grah) |
| #85 | 04/11 05:06 | Graphismes : trois monuments régionaux de plus (la chapelle de la Médaille miraculeuse, l'hôtel de Matignon, la maison La Roche) |
| #86 | 04/11 05:11 | Graphismes : trois grands châteaux de plus d'après leur emprise exacte (Sedan, Brest, Lunéville) |
| #87 | 04/11 05:15 | Graphismes : deux monuments régionaux de plus (le château de Rambouillet, la cathédrale de Dax) |
| #88 | 04/11 05:20 | Graphismes : sept monuments régionaux de plus sur leur emprise (Aire, Apt, Hautecombe, Cîteaux, l'hôtel Lambert, l'Arsenal, Solesmes) |
| #89 | 04/11 05:24 | Graphismes : sept monuments régionaux de plus (Silvacane, Lérins, l'hôtel de Beauvais, le musée Chéret, La Trappe, Port-Royal-des-Champs, l'auberge Ravoux) |
| #90 | 04/11 05:27 | Graphismes : deux monuments régionaux de plus (la manufacture de Sèvres, la citadelle de Besançon) |
| #91 | 04/11 05:31 | Graphismes : trois monuments régionaux de plus (les Alyscamps, le temple du Donon, le temple de Diane) |
| #92 | 04/11 05:35 | Graphismes : quatre monuments régionaux de plus (Royaumont, Maubuisson, Saint-Wandrille, la maison de Balzac) |
| #93 | 04/11 05:39 | Graphismes : deux monuments régionaux de plus (le Jardin des plantes, la Rotonde du parc Monceau) |
| #94 | 04/11 05:42 | Graphismes : le jardin des Tuileries (l'Orangerie et le Jeu de Paume) |
| #95 | 04/11 05:46 | Graphismes : le palais de justice de Paris (cours ouvertes), 400 maquettes |
| #96 | 04/11 05:48 | Graphismes : l'hôpital Saint-Louis (le quadrilatère d'Henri IV) |
| #97 | 04/11 05:52 | Graphismes : trois monuments régionaux de plus (l'hôpital Lariboisière, Saint-Louis-en-l'Île, l'abbaye de Clairvaux) |
| #98 | 04/11 05:54 | Graphismes : deux monuments régionaux de plus (l'hôpital de Bicêtre, la chartreuse de Champmol) |
| #99 | 04/11 05:57 | Graphismes : la place d'Alliance (sa fontaine), et les notes de la nuit dans CLAUDE.md |
| #100 | 04/11 06:01 | Graphismes : l'amphithéâtre des Trois Gaules |
| #101 | 04/11 06:05 | Graphismes : les forts de Douaumont et de Vaux, la chapelle du Père-Lachaise |
| #102 | 04/11 08:15 | Toucher un monument ouvre sa fiche (même sur la voie publique) ; toucher la photo Street View lance la promenade |
| #103 | 04/11 08:34 | La photo Street View de la fiche se tourne de nouveau au doigt (Street View reste gratuit) |
| #104 | 04/11 09:00 | Tous les lieux de culte : mosquées, synagogues, temples… dans les lieux célèbres et dans les packs |
| #105 | 04/11 09:20 | La Grande Mosquée de Paris devient un monument (nationale), avec sa maquette 3D |
| #106 | 04/11 09:32 | Quatre églises de plus aux monuments (Saint-François-Xavier, Saint-Ambroise, Saint-Martin de Tours, Saint-Pierre-le-Vieux), avec leurs maquettes 3D |
| #107 | 04/11 09:53 | La révélation d'une carte devient un événement : explosion de lumière par rareté, style premium (nuit, or, lumière) |
| #108 | 04/11 10:18 | La pochette devient un sachet métallisé ; chaque carte est un seul objet qu'on retourne, incline et fait glisser |
| #109 | 04/11 11:00 | Les cartes et la révélation refaites d'après l'interview (plan d'or, maquette en porcelaine, comète, région, un toucher = étape suivante) ; le pack d'essai |
| #110 | 04/11 11:20 | La révélation se joue sur la carte (annonce lumineuse, noms qui claquent), cartes épaisses en paquet, zooms fluides, carte plus riche |
| #111 | 04/11 11:38 | Fluidité de l'ouverture (mesurée : révélation de 2,5 à environ 40 images/s) ; noms lisibles |
| #112 | 04/11 11:45 | Le jeu s'appelle CityDeck (titre, pochette, dos des cartes, écran d'accueil, installation) |
| #113 | 04/11 12:00 | Coins arrondis, dos de carte premium, roulette des régions et départements (le lieu n'apparaît qu'à la fin) |
| #114 | 04/11 12:11 | La collection (Patrimoine) aux nouvelles cartes ; une carte touchée s'ouvre en grand, inclinable |
| #115 | 04/11 12:30 | Un seul filet au bord des cartes, à la couleur de la rareté (le filet intérieur débordait sur le téléphone de Gautier) |
| #116 | 04/11 13:10 | Les cartes des monuments montrent leur maquette 3D (en porcelaine et or), comme sur la carte du jeu |
| #117 | 04/11 14:30 | Game design du 4 nov. après-midi : Maire par caisse de travaux, saisons, monuments (entretien exponentiel, reprise), gemmes et Pass 15 jours, événements V2, nom vérifié, simulation des gemmes (documents seulement) |
| #118 | 04/11 15:00 | Pack : en touchant vite, une carte sur deux partait sans être révélée (corrigé) ; le Maire change toutes les 2 semaines, la monnaie premium s'appelle les gemmes |
| #119 | 04/11 16:00 | Le Maire par caisse de travaux dans le jeu (démo) : verser, mandat de 2 semaines, élection, part des loyers, notifications |
| #120 | 04/11 17:30 | Le Maire par caisse de travaux sur le serveur : verser, élection, absence, part des Maires à la récolte, fin de mandat annoncée, robots qui versent |
| #121 | 04/11 18:00 | En promenade, toucher un bâtiment sur la carte emmène Street View devant lui ; toucher une rue y emmène |
| #122 | 04/11 18:20 | Révélation : la maquette du lieu n'apparaît plus avant la carte de France |
| #123 | 04/11 19:00 | Les saisons et les classements dans le jeu (démo) : classement des Maires et de patrimoine, fin de saison figée, Maire de la saison |
| #124 | 04/11 19:40 | Les saisons et les classements sur le serveur : rareté des lieux, Maires de chaque mandat, classements lisibles, saison figée et annoncée |
| #125 | 04/11 20:30 | Les monuments dans le jeu (démo) : entretien qui double à chaque monument, impayé, reprise après 14 jours d'absence |
| #126 | 04/11 21:30 | Les monuments sur le serveur : entretien prélevé, reprise après absence ou impayé, lot de reprise aux enchères, alerte pour Gautier |
| #127 | 04/11 22:30 | La boutique dans le jeu (démo) : gemmes, pack national et régional, Pass 15 jours et son bon, chances affichées, gemmes d'essai |
| #128 | 04/11 23:00 | La boutique sur le serveur : gemmes, packs national et régional, Pass et bon d'adresse, gemmes d'essai ; le bon ne prend qu'une adresse |
| #129 | 05/11 00:00 | Vendre et offrir en gemmes : le vendeur choisit pièces ou gemmes, l'offre suit sa monnaie (sinon celle de l'acheteur), démo et serveur |
| #130 | 05/11 | Le paiement des gemmes par carte (Stripe Checkout, mode test) : accès immédiat demandé, gemmes créditées après vérification auprès de Stripe, pas de packs pour les cartes belges et néerlandaises |
| #131 | 05/11 | Publication du serveur : la clé Stripe s'envoie sans demande de confirmation (le nouvel outil Supabase bloquait) |
| #132 | 05/11 | L'ouverture du pack : les cartes sortent vraiment du sachet (puis il tombe), plus de blocage pendant la sortie, une pile qui se lit comme un paquet, plus de battement de cœur |
| #133 | 05/11 | Les menus façon Pokémon TCG Pocket : blanc et gris perle, un seul accent (le bleu de la plaque), barre du bas blanche, icônes au trait ; la carte de nuit le soir |
| #134 | 05/11 07:50 | Prompts de logo (3 pistes) et kit social media pour un générateur d'images (`docs/KIT-MARQUE.md`) |
| #135 | 05/11 | Le logo de Gautier (plaque CITYDECK, cartes dorées, pièce à la maison) redessiné en SVG : accueil, connexion, icônes ; la nouvelle pièce ronde de la monnaie partout |
| #136 | 05/11 | Retours de Gautier : plus d'épi sur le bouton Récolter, Entrée valide la connexion, les classements en un toucher (patrimoine, profil), une carte de France pour choisir la région du pack régional |
| #137 | 05/11 | Le classement des pièces (démo et serveur) ; un trophée en haut de la carte pour ouvrir les classements |
| #138 | 05/11 | Plus rien de rogné en haut de la carte, sur aucun téléphone (la barre se serre d'elle-même) ; la page refuse le mode sombre forcé du téléphone |
| #139 | 05/11 | Les joueurs de la maison : les robots restent au lancement, jouent comme des humains sans abuser, et se retirent quand les vrais joueurs arrivent (patrimoine remis en jeu) |
| #140 | 05/11 | Les robots cachés parmi les joueurs (icônes ordinaires, liste illisible) et jamais de gemmes avec un robot |
| #141 | 05/11 | citydeck.fr (acheté par Gautier chez Infomaniak) : le serveur et les liens de connexion l'acceptent ; le guide pour le brancher (`docs/serveur/GUIDE-DOMAINE.md`) ; la phrase des CGU sur les joueurs automatiques est décidée |
| #142 | 05/11 | Le jeu est à https://citydeck.fr/ : domaine branché sur GitHub Pages (HTTPS), adresse principale de la connexion et des paiements |
| #143 | 05/11 | Avant la pub : « Supprimer mon compte » (RGPD) et l'image de partage des liens vers citydeck.fr |
| #144 | 05/11 | Les pages légales (conditions d'utilisation et de vente, confidentialité, mentions légales), reliées au jeu ; l'image de partage allégée (JPEG) |
| #145 | 05/11 | Les cookies de Google Street View : acceptés en jouant, expliqués dans les conditions et la confidentialité |
| #146 | 05/11 | Le jeu en anglais : choix de la langue (Réglages et écran de compte), français par défaut, noms propres en français ; pages légales traduites |
| #147 | 05/11 | La langue du téléphone par défaut (français s'il est en français, anglais sinon), modifiable dans les Réglages |
| #148 | 05/11 | Le vrai serveur pour tout le monde (plus de démo par défaut ni d'interrupteur), les signalements envoyés au serveur, le cadre « Erreur de style » corrigé |
| #149 | 05/11 | Le tableau de suivi de Gautier (inscrits, venus, retours du lendemain et du 7e jour, achats), dans le tableau de bord de Supabase |
| #150 | 05/11 | Un minimum d'anti-triche : 60 actions par minute au plus, empreinte chiffrée de la connexion, alerte dès 3 comptes sur une même connexion, vue des comptes liés |
| #151 | 05/11 | L'essai automatique du serveur : le lot d'enchère d'essai passe de 25 à 45 s (trop court quand le serveur répond lentement) |
| #152 | 05/11 | 30 908 lieux célèbres (châteaux, gares, musées, phares, ponts, moulins…), Légendaires toujours à 1 carte sur 100, Rares sans lieu célèbre, marques écartées |
| #153 | 05/11 | Le niveau des communes : les travaux versés depuis toujours (0 à 5 : arbres, lampadaires, fleurs, fontaine, kiosque), dans la commune et sur la carte |
| #154 | 05/11 | Relecture des écrans en 320 px (français et anglais) : « Area » au lieu de « Neighbourhood », le bouton de la démo dans les Réglages |
| #155 | 05/11 | L'horloge du serveur : toutes les 10 minutes, enchères, mandats, saisons, monuments et robots tournent sans joueur |
| #156 | 05/11 | Les travaux des communes s'usent (−10 % par mandat) ; le niveau donne +2 % de loyer par niveau et monte le plafond du Maire (jusqu'à 2 000) |
| #157 | 05/11 | Documents : les six monuments qui sont des marques (Ritz, Maxim's, Crillon, Negresco, Château Margaux, Train bleu) restent aux enchères (Gautier : « garde-les ») |
| #159 | 06/11 | Les six monuments qui sont des marques ont leur maquette 3D (Ritz, Crillon, Maxim's, Negresco, Château Margaux, Train bleu) |
| #158 | 06/11 | Pas de marque dans les packs : les domaines viticoles (« Château Lynch-Bages »), chocolatiers et maisons connues écartés des Rares ; 8 lieux célèbres de marque écartés |

## Les décisions de Gautier

Les décisions du 2 novembre (interview) sont dans `CLAUDE.md` § 4 et dans le GDD (étiquette [Décidé]). Depuis :

| Date | Décision |
|---|---|
| 2 nov. | Supabase pour le serveur (plutôt que le VPS du site de quiz) |
| 2 nov. | Le pseudo est définitif : choisi une fois, jamais modifiable par le joueur |
| 3 nov. | « Le jeu doit être super beau » : la refonte « la plaque et la pièce » ; un signe de monnaie plus original |
| 3 nov. | Un lieu libre ne s'achète pas : il sort des packs ; on achète seulement à un joueur (vente, offre, échange) |
| 3 nov. | Échanger des lieux, y compris plusieurs d'un coup |
| 3 nov. | Six raretés : Commun, Peu commun (vert), Rare (bleu), Épique (violet), Légendaire (orange, lieux célèbres, dans les packs), Extraordinaire (arc-en-ciel, monuments, enchères seulement) |
| 3 nov. | Un bâtiment par rareté : Maison, Immeuble, Tour, Gratte-ciel, Palace, Prestige |
| 3 nov. | Pouvoir chercher une commune pour voir son Maire |
| 3 nov. | Le serveur d'abord, la boutique ensuite |
| 3 nov. | Un serveur d'essai accéléré (un jour = une minute), et des robots qui jouent dessus |
| 3 nov. | Une offre reçue montre la valeur du lieu et l'écart |
| 3 nov. | La valeur d'un lieu bouge : ventes de la commune, activité du quartier, tendance de la semaine (le loyer et le coût des constructions ne bougent pas) |
| 3 nov. | La promenade en Street View, pour voir et acheter les bâtiments qu'on longe |
| 3 nov. | Pas d'enseignes ni de marques sur les lieux (idée examinée, puis écartée) |
| 3 nov. | Continuer le projet dans Claude Code |
| 3 nov. | Les graphismes avant l'étape 8.2 ; style « jeu mobile coloré » ; d'abord le pack et les cartes ; outils gratuits d'abord |
| 4 nov. | Le Pass mensuel : pack du jour de 8 cartes, un bon par mois pour une adresse libre au choix jusqu'à Épique (3 au plus) ; pas de revente de lieux contre de l'argent réel |
| 4 nov. | Street View reste gratuit (pas de Street View interactif payant) ; la photo de la fiche se tourne au doigt, la promenade part de son bouton |
| 4 nov. | Tous les lieux de culte présents (mosquées, synagogues, temples…), sans quota : « si il y a plus d'églises c'est comme ça » |
| 4 nov. | La Grande Mosquée de Paris et quatre églises au-dessus du seuil deviennent des monuments |
| 4 nov. | Une ouverture de pack est « un vrai événement » : explosion de lumière de la couleur de la rareté (Rare et au-delà), puis la révélation façon FIFA |
| 4 nov. | Design « moins dessin animé, plus classe, stylé, impressionnant » (d'abord la révélation ; le reste à décider) ; prêt à payer Meshy si c'est la solution |
| 4 nov. | Une ouverture de pack « la plus proche de Pokémon Pocket » : un vrai sachet, des cartes qu'on tient, retourne et incline (l'expérience, pas l'apparence) |
| 4 nov. | Les cartes et la révélation d'après son interview (bible § 11) ; un toucher passe à l'étape suivante ; une étape « région » ; pas de science-fiction : « ce n'est pas au jeu de s'adapter au pack » |
| 4 nov. | **Le jeu s'appellera CityDeck** (au lieu de Cadastra) ; vérifié l'après-midi : aucune marque, citydeck.fr libre (à réserver) |
| 4 nov. | **Périmètre V1 : la collection, le classement des Maires, le classement de patrimoine.** Combat et événements écartés ou remis à la V2 (« les combats sont trop complexes à mettre en place ») |
| 4 nov. | **Le Maire = le plus gros contributeur du mois à la caisse de travaux de la commune** (remplace « le plus de lieux », qui se figeait) |
| 4 nov. (soir) | **Le Maire change toutes les 2 semaines**, pas tous les mois |
| 4 nov. (soir) | **La monnaie premium s'appelle les gemmes** |
| 4 nov. | **Monuments** : aux enchères seulement, repris et remis aux enchères si le propriétaire ne se connecte pas pendant 14 jours (jamais les adresses, qui ont pu être payées) ; **entretien exponentiel** plutôt qu'une limite de 3 monuments ; prévenir Gautier dès qu'un monument redevient libre, pour l'annoncer sur les réseaux |
| 4 nov. | **Monnaie premium (gemmes)** : euros → gemmes à sens unique, sans commission ; elle achète les packs, les packs régionaux (un peu plus chers), le Pass 15 jours (8 cartes au lieu de 5 + une adresse cible hors Légendaire et monument) et des offres sur les lieux d'autres joueurs. Revente de lieux contre des euros : écartée |
| 4 nov. | Lots réels (clés Steam, bons de commerçants) : idée gardée pour faire venir des joueurs, mais jamais attribués selon un score que l'argent ou le nombre de lieux influence (risque de loterie) |
| 5 nov. | **Le jeu existe aussi en anglais** : choix dans les réglages ; par défaut la langue du téléphone (d'abord « français par défaut », précisé le même jour) ; les noms propres et les rues restent en français |
| 5 nov. | Les communes (après la question « au niveau max, il reste quoi à faire ? ») : les travaux s'usent (10 % toutes les 2 semaines) ; le niveau donne +2 % de loyer par niveau aux propriétaires de la commune ; le plafond du Maire monte avec le niveau (jusqu'à 2 000 par mandat). L'horloge du serveur, toutes les 10 minutes. |
| 5 nov. | Les monuments qui sont des marques (Ritz, Maxim's, Crillon, Negresco, Château Margaux, Train bleu) restent aux enchères : « garde-les » (exception à « pas de marque sur un lieu »). |

## Ce qui reste à faire (au 4 novembre après-midi)

- **Le serveur, suite** (phase 8) :
  - 8.2 : le mode serveur par défaut et la fin des joueurs simulés sont faits (PR #148 ; la démo reste par `?demo`). Reste l'inscription des amis : il faut le service d'e-mails (Brevo), sinon un nouveau joueur ne reçoit pas l'e-mail de confirmation. Question posée à Gautier, sans réponse : couper la confirmation par e-mail pendant les essais ?
  - 8.3 : l'anti-triche. Un minimum est fait (PR #150 : cadence, empreintes de connexion, alerte et vue des comptes liés) ; plus tard, si besoin : un plafond de ventes entre comptes liés, l'appareil.
- **Les graphismes** (phase 10, avant 8.2 : décision de Gautier) : les menus façon Pokémon TCG Pocket (PR #133), puis le logo, l'icône et la pièce d'après le modèle de Gautier (PR #135), faits le 5 nov. ; restent à revoir sur téléphone la promenade et les fenêtres rares ; la preuve, l'ouverture, les monuments nationaux et 358 monuments régionaux en 3D, plus la Grande Mosquée de Paris et quatre églises ajoutées le 4 nov. (422 maquettes, dont les six marques gardées aux enchères, PR #159 ; les autres n'ont pas de bâtiment à dessiner) ; ensuite l'habillage de la révélation, l'icône et le logo (`docs/BIBLE-GRAPHIQUE.md`).
- **Le game design du 4 nov. porté dans le jeu** (le Maire par caisse de travaux, PR #119 et #120 ; les saisons et classements, PR #123 et #124 ; les monuments, PR #125 et #126). Reste : l'e-mail d'alerte à Gautier (il faut un service d'envoi), le niveau visuel des communes (fait, PR #153), l'équilibrage (loyer modeste des monuments, § 5 ter) : les saisons et le classement de patrimoine (§ 5 bis), l'entretien et la reprise des monuments, l'alerte à Gautier (§ 5 ter).
- **La boutique** (phase 9 ; faite en mode test, PR #127 à #130 : gemmes, packs, Pass et bon, chances affichées, ventes et offres en gemmes, paiement par carte Stripe ; restent, avant les vrais paiements : activer le compte Stripe (Gautier : identité, banque, statut), une clé restreinte de production, les pages légales) : Stripe → gemmes, packs nationaux et régionaux, Pass 15 jours (GDD § 3 et § 9), offres en gemmes au choix du vendeur, probabilités affichées, blocage Belgique et Pays-Bas, CGU (gemmes sans valeur, lieux = licences), confidentialité, mentions légales.
- **Le domaine citydeck.fr** : branché le 5 nov. (`docs/serveur/GUIDE-DOMAINE.md`). citydeck.app reste à réserver si Gautier le veut.
- **Ensuite** : les graphismes (phase 10), l'équilibrage et le lancement (phase 11).
- **Avant la pub** (liste du 5 nov.) :
  - Bloquant :
    - le vrai serveur pour tous (fait, PR #148), sans les outils d'essai (au lancement) ;
    - un service d'envoi d'e-mails (Brevo, en cours avec Gautier) ;
    - le vrai rythme et la remise à zéro (au lancement) ;
    - les pages légales (CGU/CGV, confidentialité, mentions légales ; SIRET de Gautier) ;
    - les vrais paiements (activer Stripe, clé réelle ; la TVA, à voir avec un comptable).
  - Conseillé :
    - une bêta entre amis ;
    - les sauvegardes (offre Pro de Supabase) ;
    - un minimum d'anti-triche : fait (PR #150) ;
    - un tableau de bord (inscrits, retours à J1 et J7) : fait (PR #149, vues `suivi_total` et `suivi_jours` de Supabase) ;
    - la marque à l'INPI.
  - Fait le 5 nov. : « Supprimer mon compte » et l'image de partage (PR #143), les pages légales (PR #144).
  - Restent pour les pages légales :
    - créer `contact@citydeck.fr` ;
    - désigner un médiateur de la consommation ;
    - la TVA et l'activité déclarée (comptable) ;
    - l'accord avant Google Street View ;
    - une relecture par un professionnel.
  - Brevo : avec Gautier, devant le PC.
- **Au lancement** :
  - remettre `jour_secondes` à 86400 et repartir de zéro ;
  - les robots restent, cachés parmi les joueurs (décisions du 5 nov., GDD § 5 quater) : repartir de zéro avec eux ; décider de la phrase des CGU sur les joueurs automatiques ;
  - retirer le pack d'essai (Réglages, `?essai-pack`) ;
  - brancher un service d'envoi d'e-mails (celui de Supabase n'écrit qu'à l'équipe Supabase) ;
  - le nom est décidé : **CityDeck** (4 nov.) ; vérifier qu'il est libre (marque, nom de domaine, magasins d'applications) avant le lancement.
- **L'anglais** (PR #146) : faire relire les textes par un anglophone ; les e-mails de connexion (Supabase, puis Brevo) n'existent qu'en une langue ; tout nouveau texte du jeu doit entrer dans `data/langue_en.js` (le test le rappelle pour les bandeaux et les refus du serveur).
- **Petites choses** :
  - les autres catégories de lieux célèbres : faites (PR #152) ; les marques qui restaient (châteaux au nom de vin, lieux nommés de l'IGN au nom de marque) : faites (PR #158) ;
  - retirer le prototype du dépôt de l'Arena ;
  - relire les 60 monuments nationaux ;
  - valider les seuils du standing et la capacité de gestion.
