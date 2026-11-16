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
