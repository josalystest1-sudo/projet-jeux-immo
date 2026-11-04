# La bible graphique de Cadastra

Ce document fixe **comment le jeu doit avoir l'air**, pour que chaque image, chaque écran et chaque effet produits ensuite restent cohérents. Il complète `docs/DESIGN.md` (les écrans, les couleurs, les polices : « la plaque et la pièce ») et sert de référence pour la phase des graphismes (`docs/PLAN.md`, phase 10).

Écrit le 3 novembre 2026, d'après les choix de Gautier. **Validé par Gautier le 3 novembre au soir** (la preuve « pack et cartes » : « Oui, on continue »).

## 1. Les choix de Gautier (3 nov. 2026)

| Question | Réponse |
|---|---|
| Par quoi commencer | **Le pack et les cartes** : la pochette du pack du jour, son ouverture, les cartes par rareté. C'est la preuve, avant de produire le reste. |
| Le rendu | **Jeu mobile coloré** : formes rondes, couleurs vives, gros reliefs, dans l'esprit de Clash Royale ou Brawl Stars. |
| Les outils | **Gratuits d'abord** : Claude dessine en code (SVG, CSS, Canvas, Three.js) ; on ne paie un outil d'image ou de 3D que si une preuve le demande, dans le budget de 20 € par semaine. |

Méthode (la même que pour l'Arena) : **une preuve complète, validée par Gautier, avant la série**. Personne ne dessine à la main.

## 2. Le style en dix règles

1. **Un contour sombre partout.** Tout objet dessiné (carte, pochette, bouton, icône illustrée, texte de titre) a un contour encre `#17233F`, épais : 3 px sur une carte de collection, 4 à 6 px sur une grande illustration. C'est ce qui donne l'allure « jeu mobile ».
2. **Des couleurs franches et saturées**, jamais grises ni pastel. Les couleurs du jeu restent celles de `DESIGN.md` (encre, plaque, cadre, pièce, brique, ciel), poussées vers le vif.
3. **La lumière vient d'en haut à gauche.** Chaque relief a un dessus clair et un dessous foncé : dégradé du clair (en haut à gauche) au foncé (en bas à droite), un reflet blanc en haut, une ombre pleine dessous (le « relief » des boutons : 3 à 5 px d'ombre sombre, sans flou).
4. **Des formes rondes et épaisses.** Coins arrondis (20 px sur une carte), traits épais, pas de détail fin qui disparaît sur un petit écran.
5. **Les titres en relief.** Les grands textes (PACK DU JOUR, les chiffres d'une carte) sont en Baloo 2 très gras, remplis d'un dégradé (or pour la monnaie et les titres), entourés d'un contour encre épais, avec une ombre pleine en dessous.
6. **Les rayons de soleil** derrière ce qui compte (le logo, l'icône d'un lieu célèbre, le monument) : des rayons clairs qui partent du centre, comme dans les jeux mobiles. Ils tournent lentement seulement pour les raretés les plus hautes.
7. **La pièce d'or en forme de maison** (`icones/piece.svg`) est l'emblème du jeu : sur le dos des cartes, sur la pochette, dans la monnaie.
8. **La plaque de rue émaillée** reste l'élément propre à Cadastra : le nom d'un lieu est toujours sur une plaque (DESIGN.md).
9. **Le mouvement récompense** : les effets bougent sur les cartes rares (reflet, étincelles, irisé), jamais sur les écrans de tous les jours ; tout s'arrête si le téléphone demande de réduire les animations.
10. **Lisible à 160 px de large** : une carte de collection doit se lire d'un coup d'œil sur un petit téléphone (le nom sur la plaque, la valeur en gros).

## 3. Les raretés : une échelle d'effets

Plus une carte est rare, plus elle brille. Chaque rareté garde sa couleur (`DESIGN.md`) ; les effets s'ajoutent de l'une à l'autre.

| Rareté | Cadre | Effets |
|---|---|---|
| Commun (ardoise) | anneau ardoise en relief | aucun |
| Peu commun (vert) | anneau vert en relief | aucun |
| Rare (bleu) | anneau bleu en relief | un reflet de lumière passe sur la carte de temps en temps |
| Épique (violet) | anneau violet en relief | reflet, et des étincelles qui scintillent aux coins |
| Légendaire (orange) | anneau orange en relief, halo doré | reflet, étincelles, et les rayons derrière l'illustration tournent lentement |
| Extraordinaire (arc-en-ciel) | anneau arc-en-ciel qui défile | tout ce qui précède, et une couche irisée (« holographique ») qui glisse sur la carte |

## 4. Les pièces de la preuve (pack et cartes)

### La carte (face)
- **Contour encre**, puis **l'anneau de la rareté** (6 px, dégradé du clair au foncé, lumière en haut à gauche), puis un **filet blanc** fin à l'intérieur.
- **L'étiquette de rareté** pend du haut de la carte, au milieu, comme un onglet : fond de la couleur de la rareté en relief, contour encre, texte blanc cerné d'encre.
- **L'illustration plein cadre** (« full art », décision de Gautier) : le mur de briques et la plaque de la voie pour une adresse ; le ciel de la rareté, ses rayons et l'icône pour un lieu nommé ou un monument.
- **Le bandeau du bas** : un dégradé encre, la valeur en gros chiffres or cernés d'encre, avec la pièce.

### La carte (dos)
- Bleu plaque vif, des rayons clairs depuis le centre, un double cadre (or puis encre) à l'intérieur du contour blanc.
- Au centre, **la pièce-maison en grand**, qui « respire » doucement ; en dessous, une petite plaque « Cadastra ».

### La pochette du pack du jour
- Un fond bleu vif avec de grands rayons depuis le logo, des pièces-maisons et des étincelles qui flottent.
- En haut, la **plaque « Cadastra »** ; au milieu, **PACK DU JOUR** en lettres d'or épaisses, cernées d'encre, en relief.
- Un **ruban rouge** (brique) : « 5 lieux · toute la France ».
- En bas, **une ville de dessin animé** : des immeubles crème aux toits bleu ardoise façon Paris, contours encre, fenêtres allumées, la tour Eiffel au milieu.
- Le reflet métallisé et irisé de la pochette (Three.js) reste par-dessus.

### La preuve en images (3 nov. 2026)

| La pochette (texture, avant le reflet 3D) | Le dos d'une carte | La collection (les six raretés) |
|---|---|---|
| ![La pochette du pack du jour](bible/pochette.jpg) | ![Le dos d'une carte](bible/dos-carte.jpg) | ![La collection](bible/collection.jpg) |

Où c'est dans le code : la pochette est dessinée par `makeArt()` (`index.html`, Canvas, posée sur la pochette 3D) ; la face d'une carte par `carteArt()` (le fond, le sujet, le bandeau, puis l'anneau `.cadre` et les effets `.reflet`, `.eclats`, `.holo`) ; le dos dans `sortirCartes()` (`.dos-piece`, `.dos-nom`) ; les styles à la fin de `style.css` (section « graphismes, la preuve »).

## 5. Ce qui viendra après la preuve (à valider dans l'ordre)

1. ~~L'ouverture : la déchirure qui suit le doigt, les cartes qui glissent du pack, les sons (phase 10.3).~~ Fait le 3 nov. (§ 7).
2. ~~Les monuments en 3D stylisée, la tour Eiffel d'abord (phase 10.4).~~ La preuve (la tour Eiffel) faite le 3 nov. (§ 8) ; les autres monuments ensuite, un par un, après validation.
3. L'habillage de la révélation façon FIFA (phase 10.5).
4. L'icône, le logo, l'écran d'accueil (phase 10.6).
5. Les illustrations par lieu (églises, mairies, châteaux…) si les icônes ne suffisent plus : ce serait le premier besoin d'un outil d'image par IA.

## 6. Comment on produit

- **En code d'abord** : SVG et CSS pour les cartes, Canvas pour la pochette (texture de la 3D), Three.js pour la 3D. Tout est versionné dans le dépôt, sans fichier lourd.
- **Un outil d'IA seulement si une preuve le demande** (une illustration qu'on ne sait pas dessiner en code) : Claude propose l'outil et son coût, Gautier crée le compte.
- **Chaque étape se vérifie au format téléphone** (375 × 812 et 360 × 780) avant d'être publiée, et se compare avec la version d'avant.

## 7. L'ouverture du pack (phase 10.3, 3 nov. 2026)

- **La déchirure suit le doigt** : on glisse le doigt sur le haut de la pochette, dans un sens ou dans l'autre ; le haut se soulève vers le joueur depuis le côté où le doigt a commencé (il tourne autour d'une charnière à l'autre bout), une étincelle et de petits éclats d'or suivent le point de déchirure, le téléphone vibre un peu à chaque cinquième du chemin. Arrivé aux 85 %, le haut s'arrache et s'envole. Si l'on lâche avant, il retombe. Un simple toucher sur le haut ouvre toujours le pack (pour qui ne veut pas glisser).
- **Les cartes glissent hors du pack** : elles montent une par une depuis l'ouverture (on ne voit que ce qui en est sorti), puis le pack tombe et disparaît.
- **Les sons**, synthétisés (aucun fichier) : un crépitement de papier métallisé pendant la déchirure, plus fort et plus aigu quand le doigt va vite ; l'arrachage ; un carillon à l'ouverture ; un souffle pour chaque carte qui sort. Ils suivent le réglage « Sons ».
- **La lumière** : la pochette ne bascule plus en arrière (face au « plafond » lumineux de la scène, elle devenait toute blanche) ; le projecteur est un peu adouci et le halo ne prend que les vraies lumières. Le pire cas mesuré n'est plus qu'un éclat dans un coin.
- Plus tard, si Gautier le veut : de vrais sons enregistrés (banques libres de droits, à télécharger avec son accord).

## 8. Les monuments en 3D (phase 10.4, 3 nov. 2026)

![La tour Eiffel sur la carte](bible/tour-eiffel.jpg)

- **La preuve : la tour Eiffel**, posée sur la carte à sa vraie place, à sa vraie hauteur (330 m) et dans son vrai sens (orientation mesurée sur les blocs de la BD TOPO, que la maquette remplace).
- **Le style** : des formes simples et épaisses (quatre pieds courbes, les arches, deux plateformes bordées d'or, la flèche et ses ceintures, la loge dorée, l'antenne et un feu au sommet), des ombres franches à trois tons comme un dessin animé, une lumière douce d'en haut à gauche (sinon la pierre claire devient blanche), et **un contour encre** : 1,6 m de loin (1 à 2 pixels), 0,5 m de près (zoom 16,8 et plus).
- **Tout est construit en code** (Three.js, `src/maquettes.js`), sans fichier de modèle ; la maquette est une couche de la carte, sans animation : la carte se repose toujours.
- **Pour ajouter un monument** : une fonction qui construit sa maquette en mètres (y vers le haut), son centre et son orientation mesurés sur la BD TOPO, et les identifiants (`cleabs`) des bâtiments de l'IGN qu'elle remplace (`MODELES` dans `src/maquettes.js`). Un test vérifie qu'elle correspond à un monument de la liste.
- **Trois monuments de plus** (3 nov. 2026, les plus connus après la tour Eiffel) :
  - **Notre-Dame de Paris** : nef et chœur, toit de plomb bleu, bas-côtés, transept, abside, arcs-boutants, deux tours de 66 m, la rosace, les portails, la flèche (96 m) et son coq doré ;
  - **l'Arc de triomphe** : deux piliers, la grande arche en plein cintre, la frise, la corniche, l'attique, les arches des côtés, les groupes sculptés ;
  - **le Sacré-Cœur** : tout en pierre blanche, la nef en croix, le porche à trois arches et ses deux petits dômes, le grand dôme ovoïde et sa lanterne, quatre dômes autour, le campanile, des croix dorées.

![La tour Eiffel, Notre-Dame, le Sacré-Cœur et l'Arc de triomphe sur la carte](bible/monuments.jpg)

- **Ce qu'on a appris** (retour de Gautier : « de près, le bâtiment devient moche et perd ses couleurs ») : dans la couche de la carte, le sens des faces n'est pas fiable selon l'angle ; rien n'en dépend plus (chaque pièce se dessine des deux côtés, avec sa lumière vers l'extérieur ; le contour se dessine en premier et les pièces se posent par-dessus). Et **tout bâtiment de l'IGN qui tombe dans le volume d'une maquette doit être masqué** (la sacristie et les chapelles de Notre-Dame la perçaient) : vérifier en listant les bâtiments dont un point tombe dans le rectangle de la maquette.
- **Huit monuments de plus** (4 nov. 2026, la suite de la liste, les plus connus d'abord) : **Versailles** (la façade des jardins, la cour de Marbre en brique, les toits d'ardoise, la chapelle, la grille dorée), **Chartres** (toit de cuivre vert, ses deux flèches différentes), **Reims** (deux tours plates de 81 m), **Saint-Denis** (sa tour unique), **le Panthéon** (portique, colonnade, dôme), **l'Opéra Garnier** (coupole de cuivre vert, groupes et Apollon dorés), **la Concorde** (l'obélisque et son pyramidion doré, les deux fontaines), **le Pont du Gard** (trois rangs d'arches ; sur la carte plate, les piles descendent jusqu'au sol là où le rang du dessous s'arrête). Les cathédrales viennent d'un **modèle réglable** (`cathedrale()` : longueur, tours, flèches, couleurs) ; Notre-Dame en est un réglage. Pas de maquette pour les grottes (Lascaux, Chauvet) ni pour le Père-Lachaise : ils gardent leur halo doré.

![Chartres, le Panthéon, l'Opéra Garnier, le Pont du Gard, Versailles et la Concorde](bible/monuments-2.jpg)

- **La vraie cause des défauts de près** (trouvée le 4 nov.) : la précision. Les objets portaient leurs coordonnées « mondiales » de la carte (un mètre y vaut 2,5 milliardièmes) ; la carte graphique calcule en simple précision et perdait positions et profondeurs à 2 m près : de près, le devant et le derrière se mélangeaient par plaques, des faces disparaissaient, les arêtes tremblaient. Maintenant chaque monument est dessiné en mètres autour de son centre, et sa place sur la carte entre dans la matrice de la caméra, calculée en double précision. Les autres précautions restent (dessin des deux côtés, contour d'abord, lumière douce, masquage).
- **Dix monuments de plus** (4 nov. 2026, la suite de la liste) : **les Invalides** (le Dôme doré et ses côtes, le tambour à colonnes, le portail à deux rangs de colonnes, la nef de Saint-Louis), **l'Élysée** (la cour d'honneur entre ses deux ailes, le perron et sa marquise, le portail sur la rue, le drapeau tricolore sur le toit), **la Sorbonne** (la chapelle, sa façade à colonnes, son dôme et ses quatre lanternons), **la Sainte-Chapelle** (les verrières bleues entre les contreforts, le toit très raide et sa crête dorée, la flèche de 75 m), **le Luxembourg** (les hauts toits d'ardoise, les pavillons, le pavillon d'entrée à dôme), **Fontainebleau** (la cour du Cheval-Blanc, l'escalier en fer à cheval, la grille ; le reste du château reste celui de l'IGN), **Chambord** (le donjon et ses tours rondes, la forêt de toits, de cheminées et de lanternons, la grande lanterne de 56 m), et trois cathédrales du modèle réglable, qui gagne des réglages (étage octogonal, tour-lanterne, couleur d'une flèche, pièces en plus) : **Amiens** (la plus haute nef de France, la fine flèche de 112 m), **Rouen** (la flèche de fonte de 151 m, la tour Saint-Romain, la tour de Beurre et sa couronne, les tours du transept), **Strasbourg** (le grès rose, la tour unique, son octogone et sa flèche de 142 m, le toit de cuivre).

![Les Invalides, Chambord, Strasbourg, Rouen, l'Élysée et la Sainte-Chapelle](bible/monuments-3.jpg)

- **Les maquettes ne ralentissent plus la carte** (4 nov.) : Three.js recalculait la position de chaque pièce de chaque monument à chaque dessin, 22 fois par image ; les positions se calculent maintenant une seule fois, et un monument loin de l'écran n'est pas dessiné du tout. Mesuré sur le PC : 12 ms par image avant, 2,4 ms après, autant que sans maquettes.
- **Pour poser une maquette** : dessiner le plan des bâtiments de la BD TOPO dans le repère de la maquette (quadrillage de 10 m, hauteurs écrites) ; on y lit où vont les tours, le transept, les ailes. L'IGN ne donne pour l'Élysée qu'un contour simplifié (site sensible) : la maquette suit la rue et les rues voisines.
- **Six monuments de plus** (nuit du 4 nov. 2026, Gautier couché : « fais-en le maximum ») : **le Louvre** (la pyramide de verre et les trois petites, les ailes Richelieu et Denon et leurs pavillons à dôme carré, les cours couvertes de verre, la cour Carrée et sa Colonnade, la Grande Galerie jusqu'au pavillon de Flore), **le Mont-Saint-Michel** (le rocher de granit porte l'abbaye : la carte est plate ; la Merveille, l'église, la flèche et l'archange doré), **Carcassonne** (les deux enceintes et une cinquantaine de tours, à leur place et à leur hauteur : les murs et les tours viennent de la BD TOPO ; toits pointus d'ardoise pour les tours hautes, de tuiles pour les basses ; le château comtal, la basilique), **Chenonceau** (le logis sur ses piles, la galerie sur ses arches au-dessus du Cher, la tour des Marques), **le palais des Papes** (ailes crénelées, toits de tuiles, hautes tours, grandes arcades en ogive), **la Madeleine** (un temple grec de 48 colonnes).
- **Des pièces réunies** : une colonnade, des tours, des murs, des créneaux deviennent une seule forme (`fusion` dans l'atelier : `cylindres`, `cones`, `boites`, `toits`, `comblesN`, `remparts`, `creneaux`…), dessinée d'un coup par la carte graphique ; Carcassonne tient en une soixantaine de formes. De nouvelles formes : le dôme carré (pavillons du Louvre), l'ogive, les créneaux.

![Le Louvre, Carcassonne, Chenonceau, le palais des Papes, la Madeleine et le Mont-Saint-Michel](bible/monuments-4.jpg)
- **Sept monuments de Paris de plus** (nuit du 4 nov.) : **le Grand Palais** (la verrière en berceau et ses arcs de fer, le dôme de verre, la colonnade, les quadriges de bronze, le palais de la Découverte et sa rotonde), **le pont Alexandre-III** (l'arche d'acier très plate, ses guirlandes dorées, les quatre pylônes et leurs Pégase dorés, les lampadaires), **le Pont-Neuf** (sept arches puis cinq, les demi-lunes au-dessus des piles, la statue d'Henri IV), **la Conciergerie** (la tour Bonbec crénelée, les tours d'Argent et César et leurs toits pointus, la tour de l'Horloge et son horloge bleue et or), **le Palais-Royal** (la cour d'honneur et les colonnes noires et blanches de Buren, la galerie d'Orléans, les galeries du jardin et leurs arcades, les tilleuls, le bassin), **la place des Vosges** (36 pavillons de brique et de pierre, leurs hauts toits d'ardoise, le jardin, les fontaines, Louis XIII), **Saint-Sulpice** (la façade à deux étages de colonnes, les deux tours rondes). Les ponts n'ont pas de bâtiment dans la BD TOPO : leurs berges sont relevées sur la carte (là où l'eau commence le long de l'axe du pont).
- **Vérifier le volume sous les pièces réunies** : une forme réunie (les pavillons de la place des Vosges) a une seule grande boîte ; la vérification lance un rayon vertical sous chaque point des bâtiments de l'IGN pour savoir s'il passe sous la maquette.

![La place des Vosges, le Palais-Royal, le Pont-Neuf, Saint-Sulpice, le Grand Palais et la Conciergerie](bible/monuments-5.jpg)
