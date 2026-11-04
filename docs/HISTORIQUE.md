# Historique de Cadastra

Ce fichier raconte ce qui a été fait, dans l'ordre, avec les demandes et les décisions de Gautier. Il sert à reprendre le projet sans rien perdre, quel que soit l'outil (conversation Claude, Claude Code sur le PC, Claude Code dans le cloud).

**À compléter à chaque PR** : une ligne dans « Toutes les PR », et une phrase dans le récit quand Gautier a demandé ou décidé quelque chose. Le détail technique de chaque étape est dans `PROGRESS.md`, les règles du jeu dans `docs/GDD.md`, l'ordre des étapes dans `docs/PLAN.md`, les consignes de travail dans `CLAUDE.md`. Pour changer d'outil : `docs/REPRENDRE-DANS-CLAUDE-CODE.md`.

## Où vit quoi

Rien d'important ne vit dans une conversation : tout est dans le dépôt ou sur les services ci-dessous.

| Quoi | Où |
|---|---|
| Le code, les données, les documents | GitHub `josalystest1-sudo/projet-jeux-immo` (public), branche `main` |
| Le jeu publié | https://josalystest1-sudo.github.io/projet-jeux-immo/ (mis à jour 1 à 2 minutes après chaque fusion sur `main`) |
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
- Quatrième lot de la nuit (PR #52) : les onze derniers monuments nationaux. Tous ont leur maquette, sauf les grottes, les cimetières et les jardins (halo doré) et le Ritz (une marque, question pour Gautier).
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
| 4 nov. | **Le jeu s'appellera CityDeck** (au lieu de Cadastra) |

## Ce qui reste à faire (au 3 novembre au soir)

- **Le serveur, suite** (phase 8) :
  - 8.2 : le mode serveur par défaut, la fin des joueurs simulés, l'inscription des amis. Question posée à Gautier, sans réponse : couper la confirmation par e-mail pendant les essais ?
  - 8.3 : l'anti-triche.
- **Les graphismes** (phase 10, avant 8.2 : décision de Gautier) : la preuve, l'ouverture, les monuments nationaux et 358 monuments régionaux en 3D, plus la Grande Mosquée de Paris et quatre églises ajoutées le 4 nov. (416 maquettes ; les autres n'ont pas de bâtiment à dessiner ou portent une marque) ; ensuite l'habillage de la révélation, l'icône et le logo (`docs/BIBLE-GRAPHIQUE.md`).
- **La boutique** (phase 9) : Stripe, packs et Pass mensuel (pack de 8 cartes, bon mensuel : GDD § 3), probabilités affichées, blocage Belgique et Pays-Bas, CGU, confidentialité, mentions légales.
- **Ensuite** : les graphismes (phase 10), l'équilibrage et le lancement (phase 11).
- **Au lancement** :
  - remettre `jour_secondes` à 86400 et repartir de zéro ;
  - supprimer les robots ;
  - retirer le pack d'essai (Réglages, `?essai-pack`) ;
  - brancher un service d'envoi d'e-mails (celui de Supabase n'écrit qu'à l'équipe Supabase) ;
  - confirmer le nom (Cadastra reste le nom de travail).
- **Petites choses** :
  - les autres catégories de lieux célèbres (châteaux, mairies, gares…). Wikidata se joint depuis le PC. Les lieux de culte de toutes les religions y sont depuis la PR #104 ;
  - la collection (Patrimoine) dans le style des nouvelles cartes (grille de badges, décision de l'interview), après validation des cartes par Gautier ;
  - retirer le prototype du dépôt de l'Arena ;
  - relire les 60 monuments nationaux ;
  - valider les seuils du standing et la capacité de gestion.
