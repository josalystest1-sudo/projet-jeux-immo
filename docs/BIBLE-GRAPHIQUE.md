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
- **Le style** : des formes simples et épaisses (quatre pieds courbes, les arches, deux plateformes bordées d'or, la flèche et ses ceintures, la loge dorée, l'antenne et un feu au sommet), des ombres franches à trois tons comme un dessin animé, la lumière d'en haut à gauche, et **un contour encre** de 1,6 m (1 à 2 pixels) tant qu'on regarde de loin ; de près (zoom 16,8 et plus), le contour disparaît, car il deviendrait trop épais.
- **Tout est construit en code** (Three.js, `src/maquettes.js`), sans fichier de modèle ; la maquette est une couche de la carte, sans animation : la carte se repose toujours.
- **Pour ajouter un monument** : une fonction qui construit sa maquette en mètres (y vers le haut), son centre et son orientation mesurés sur la BD TOPO, et les identifiants (`cleabs`) des bâtiments de l'IGN qu'elle remplace (`MODELES` dans `src/maquettes.js`). Un test vérifie qu'elle correspond à un monument de la liste.

