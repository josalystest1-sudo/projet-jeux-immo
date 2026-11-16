# La nouvelle carte : nuit et néon (interview de Gautier, 16 nov. 2026)

Gautier juge les cartes actuelles « trop basiques » (sauf le cadre où la maison tourne) et le booster « pas joli ». Interview en 20 questions ; ses réponses :

- **Niveau visé** : Pokémon TCG Pocket.
- **Ambiance** : nuit, plan cadastral du quartier en traits néon, la parcelle surlignée.
- **Le bâtiment** : le vrai bâtiment en 3D (« le plan 3D de la structure dans la vraie vie »), en maquette stylisée, qui tourne tout seul.
- **Mise en page** : pleine carte ; le texte est posé par-dessus.
- **Sur la face** : seulement l'adresse (sur une plaque de rue en néon), la commune et la rareté.
- **Les chiffres** (valeur, loyer, potentiel, standing) : sous la carte ouverte en grand, plus sur la carte.
- **Pas de « 1/1 »** ni de numéro de série (« la carte est forcément unique »).
- **Brillance** : holo arc-en-ciel et lumière vivante (halo, particules, rayons), qui réagissent à l'inclinaison du téléphone ; une légère profondeur.
- **Raretés** : toutes les cartes très belles ; la rareté change la couleur des néons et ajoute des effets.
- **Collection** : en petit, image fixe et simple reflet ; tous les effets quand on ouvre la carte.
- **Booster** : néon assorti (sachet sombre, plan de ville lumineux, holo sur toute la surface), après les cartes.
- **Restés ouverts** : le cadre (orné, filet néon, sans cadre) et la matière du bâtiment (verre aux arêtes néon, hologramme).

## Les prototypes

`proto/cartes.html` (en ligne : https://citydeck.fr/proto/cartes.html), une page d'essai à part du jeu : trois prototypes (verre et filet néon ; hologramme sans cadre ; verre et cadre orné), les six raretés, et n'importe quelle adresse (géocodage et données de l'IGN, par `CarteLieu.donnees`). On peut ouvrir un réglage précis par l'adresse : `?r=5&c=orne&m=holo&q=…`.

Rien n'est changé dans le jeu tant que Gautier n'a pas choisi. À faire ensuite : porter la carte choisie dans `src/carte_lieu.js` (attention à la fluidité : la page d'essai utilise `mix-blend-mode` et un halo par carte, à remplacer dans le jeu), puis le booster assorti.

## Choix du 16 nov. (après les prototypes)

- **Le n° 3 est retenu** (« très bien ») : bâtiment en verre aux arêtes néon, cadre orné.
- **Le dos de la carte** (demandé le même jour) : le même pour toutes les cartes (il ne dit rien de la rareté), nuit, plan de ville en traits fins, cadre orné en bleu de la plaque, emblème du jeu (la maison de la pièce) et « STREETKEEP » en néon. Visible sur la page d'essai : toucher la carte la retourne (`?dos` l'ouvre de dos).
- **Le déroulé de l'ouverture** rappelé par Gautier (c'est celui du jeu, à garder) : on coupe le booster vers le haut, les cartes en sortent de dos, elles se posent en pile de dos, toucher la carte du dessus la révèle, jusqu'à la dernière.
- **Taille des packs, proposée par Gautier, pas encore appliquée** : 2 cartes pour le pack gratuit du jour, 4 avec le Pass, 4 cartes + 1 Rare ou mieux pour un booster payé (aujourd'hui 5, 8 et 5). But : que les adresses ne se remplissent pas trop vite. À valider ; touche `ECO.pack`, `ECO.boutique`, le tirage (une carte garantie) et les pages légales.
- **Le dos, deuxième version** (interview de 8 questions le même jour : « les couleurs et le thème sont bien, mais le logo est basique ») : un emblème travaillé, riche au centre et calme autour : la **plaque de rue française** (avec son chapeau arrondi) en néon, une **ville en silhouette** dedans, **STREETKEEP en grand** comme une enseigne ; autour, des **anneaux d'ornements qui tournent** en sens opposés, un **éclat qui parcourt les traits** de la plaque et du cadre, des **particules** qui montent. Couleur : trois essais sur la page (bleu et or, bleu et magenta, tout bleu ; `?d=or|magenta|bleu`), à choisir.
- **La plaque du dos, retravaillée** (« pas assez travaillée, le reste est ok ») : émail bleu en dégradé avec un reflet, second contour, ligne de rivets, fleurons aux coins, couronne de remparts et lauriers au chapeau, volutes de fer forgé sur les côtés, pendentif, deux plans de ville (un lointain derrière la silhouette).
- **L'intérieur de la plaque, refait** (« c'est surtout la partie intérieure que je trouve pas assez travaillée ») : une scène de ville la nuit : ciel (lune, étoiles, rayons qui montent de l'horizon), ville lointaine, quatorze bâtiments dessinés un par un (mansardes et cheminées, pignons, clocher à rosace, dôme, tour) aux fenêtres allumées, réverbères, arbres, viaduc, et le nom sur une banderole.
- **La ville de la plaque, corrigée** (Gautier : « on dirait une mosquée ») : le dôme, la tour à antenne et le croissant de lune sont retirés ; à la place, une mairie à fronton avec son campanile, son horloge et son drapeau, un immeuble mansardé, une pleine lune. La ville doit se lire comme une ville française.

## Le booster néon (interview de 8 questions, 16 nov.)

- **Au centre** : le nom du jeu, en **enseigne néon** (réponse libre de Gautier : « le nom du jeu »).
- **Autour** : un plan de ville en traits fins sur toute la surface.
- **Matière** : **tout holographique** (un arc-en-ciel qui change avec l'angle de vue).
- **À l'accueil** : il flotte, brille et suit l'inclinaison du téléphone.
- **Gratuit / payé** : deux visuels différents ; le payé, plus riche, montre **un monument en néon doré** (la tour Eiffel dans le prototype).
- **À l'ouverture** : on coupe le haut, **un éclair de lumière** jaillit, puis les cartes montent, de dos.

Prototype : `proto/booster.html` (https://citydeck.fr/proto/booster.html ; `?s=paye` pour le booster payé). Un vrai volume 3D ; l'holographique est un calcul par point (angle de vue), ajouté à la matière. Dans le jeu, ce dessin ira sur le sachet existant (`dessinPochette`, `geoSachet`).
- **Retours du 16 nov. sur le prototype du booster** : « la couleur et l'effet de texte le rendent illisible » → le nom est en lettres pleines et claires sur un cartouche sombre bordé de néon, où l'holographique se tait ; « que la coupe suive une courbe au rythme du doigt, comme Pokémon Pocket, plutôt qu'un trait droit et sec » → la languette se décolle derrière le doigt et se relève en courbe (plus haut si le doigt monte), la lumière sort par l'ouverture, la coupe ne recule jamais et se reprend là où on l'a laissée (`enrouler` dans `proto/booster.html`).
- **Booster, suite** (« ça dénote complètement avec le reste du décor, et la tour Eiffel est peu visible ») : plus de cartouche ; des ombres douces derrière le nom et le monument (dans le dessin et dans un masque qui calme l'holographique), l'arc-en-ciel en fond léger partout avec de larges bandes vives qui glissent, la tour plus grande et aux traits plus épais.
- **Booster, moins brillant** (« le booster brille trop, ça rend le texte pas assez lisible ») : holographique, reflets et halo réduits de moitié environ, lettres cernées d'un liseré de nuit, ombre douce plus large ; trois niveaux de brillance à comparer sur la page (douce, moyenne, forte ; `?b=douce|moyenne|forte`), à choisir.
- **Booster du jour : une ligne de toits** (Gautier a demandé pourquoi il y avait une maison ; c'était un ajout de Claude ; choix : « va pour la ligne ») : la maison du logo est remplacée par une ville française au trait de néon (les bâtiments du dos des cartes). Le gratuit montre la ville de tous les jours, le payé un monument.
- **Booster validé le 16 nov.** (« on garde comme ça ») : brillance moyenne, ligne de toits sur le booster du jour, tour Eiffel dorée sur le payé, languette qui se décolle derrière le doigt. Reste à choisir avant l'intégration au jeu : la couleur du dos des cartes et la taille des packs.

## Dans le jeu

- **Décisions du 16 nov. (13 h)** : dos **bleu et or** ; packs à **2 cartes gratuites, 4 avec le Pass, 4 + 1 Rare ou mieux pour le payé, le tout premier pack d'un nouveau joueur à 5 cartes** ; Claude (session dans le cloud) prend la main, le Claude Code du PC est en veille.
- **Étape 1, faite** : la face néon (prototype n° 3) dans `src/carte_lieu.js` : pack, collection (miniatures légères) et carte ouverte en grand, avec les chiffres dessous.
- **Étape 2, faite** : le dos bleu et or (`src/dos_carte.js`), et la bordure qui allait et venait sur les cartes corrigée (retour de Gautier).
- **Révélation** (retour de Gautier, 16 nov.) : la roulette dans les teintes des cartes (bleu néon, or pour ce qui est choisi), une roulette des villes après le département, puis le zoom sur l'adresse ; l'éclair de la carte du dessous sur la carte en main est corrigé.
- **Roulette des villes, suite** (Gautier : « tu dois voir le département fragmenté avec les villes ») : le département entier, découpé en ses communes ; une commune s'allume à chaque cran, son nom en haut.
- **Étape 3, faite** : le booster et sa languette qui se décolle derrière le doigt (`src/booster.js`).
- **Booster, dans le jeu** (Gautier, 16 nov.) : « trop arc-en-ciel », « il fait tache avec la DA du jeu » → la brillance du foil est bleue et dorée.
- **À faire** : la taille des packs.
