# Le style de Cadastra — « la plaque et la pièce »

> **Depuis le 5 nov. 2026, les menus sont façon Pokémon TCG Pocket** (choix de Gautier, après cinq preuves : `docs/BIBLE-GRAPHIQUE.md` § 12). Le fond est gris perle et les panneaux sont blancs, avec un bord fin et une ombre douce. Une seule couleur d'accent, le bleu de la plaque (`#2453B3`), sert pour les boutons importants. Le texte est bleu nuit et gris, en Nunito seulement (la police ronde Baloo 2 ne reste que sur les cartes et l'ouverture du pack). La barre du bas est blanche. Les icônes sont au trait, d'une seule couleur (`src/icones.js` : un émoji de l'interface est remplacé à l'affichage par son icône). Les couleurs vives restent sur les cartes, la carte de la ville, la plaque de rue et la pièce. La carte de la ville passe en nuit le soir. **Le logo et la pièce (5 nov., modèle de Gautier, bible § 13)** : la plaque « CITYDECK » devant deux cartes dorées, avec une pièce d'or ronde frappée d'une maison (`src/logo.js`). Cette pièce est aussi la monnaie (`icones/piece.svg`, `.pc`) : la pièce-maison, en forme de maison et frappée d'un C, n'existe plus. Les règles qui suivent restent vraies pour la plaque, la pièce, les cartes et l'organisation des écrans. Les couleurs des boutons, des panneaux et des titres sont remplacées par celles-là.

Référence pour tout écran nouveau ou refait (3 nov. 2026, demande de Gautier : « le jeu doit être super beau », ergonomie des meilleurs jeux mobiles). Fichier de style : `style.css`. Pour les illustrations (pack, cartes, monuments, icône) et le style « jeu mobile coloré » choisi par Gautier le 3 nov. au soir : `docs/BIBLE-GRAPHIQUE.md`.

## L'idée

Deux objets que tout le monde connaît en France donnent son identité au jeu :

- **la plaque de rue émaillée** (bleu de Paris, liseré blanc, cadre vert) : le nom de chaque lieu s'affiche sur une plaque, comme si on possédait vraiment la rue. C'est **le seul élément audacieux** ; tout le reste reste calme.
- **la pièce d'or** : la monnaie, et la couleur des boutons d'action principaux. **Le signe de la monnaie est une pièce d'or en forme de maison, frappée d'un C** (`icones/piece.svg`, classe `.pc`) : unique au jeu, lisible même à 14 px par sa silhouette, et qui dit d'un coup d'œil « de l'argent pour des lieux ». Dans un texte (bandeau, notification), on écrit 🪙 et `avecPieces()` le remplace par la pièce dessinée ; l'icône du jeu porte la même pièce, sans le C.

Autour : des panneaux blancs et arrondis posés sur la carte, une police ronde et généreuse (style dessin animé, décidé par Gautier), des boutons en relief qui s'enfoncent sous le doigt.

## Couleurs

| Nom | Valeur | Rôle |
|---|---|---|
| encre | `#17233F` | texte, contours |
| plaque | `#1E4598` | plaques de rue, éléments actifs, barre du bas |
| cadre | `#2E8B57` | cadre des plaques, gains, réussite |
| pièce | `#FFC233` (relief `#D99114`) | monnaie, bouton principal |
| brique | `#E4573D` | autres joueurs, alertes, pastilles de notification |
| ciel | `#EAF2FF` | fond des écrans |
| blanc | `#FFFFFF` | panneaux |

Raretés (décision de Gautier, 3 nov.) : Commun `#8E9AAF` (ardoise), Peu commun `#2FB36D` (vert), Rare `#2F80ED` (bleu), Épique `#9B51E0` (violet), Légendaire `#FF7A00` (orange), Extraordinaire = arc-en-ciel (`--arc`, dégradé qui glisse lentement sur le contour de la carte, sa pastille et l'icône ; ciel arc-en-ciel derrière le monument).

## Polices

- **Baloo 2** (600, 700, 800) : titres, chiffres, boutons.
- **Barlow Condensed** (600, 700) : le texte des plaques de rue et des numéros, en capitales, comme les vraies plaques émaillées.
- **Nunito** (500 à 900) : textes.

Embarquées dans `fonts/` (licence OFL), pas de service extérieur.

## Composants

- **Bouton** `.btn` : pièce d'or, relief de 4 px en bas, s'enfonce au toucher ; variantes `.bleu`, `.vert`, `.clair`, `.danger`, taille `.sm`. Un seul bouton principal (or) par carte ; les autres en `.clair`.
- **Plaque** `.plaque` : nom d'un lieu, d'une rue, d'un monument. Dessinée « réaliste » (demande de Gautier, 3 nov. : l'ancienne faisait trop enfantine) : émail bleu nuancé avec un reflet et un grain léger, filet blanc à l'intérieur, cadre vert à tranche plus sombre, deux vis, ombre portée ; la ligne du haut (`<small>` : arrondissement, commune) en minuscules soulignée d'un filet, le nom en capitales.
- **Numéro** `.numero` : la petite plaque bleue du numéro de la maison.
- **Cartes « full art »** `carteArt(a, bandeau)` (pack et collection ; demande de Gautier, 3 nov. : « trop de blanc, l'illustration trop petite ») : l'illustration occupe toute la carte, seul le contour garde la couleur de la rareté. Une adresse : un mur de briques rouges (teintes de vraies briques, joints de mortier clair) avec la plaque de la voie en grand et la plaque bleue du numéro dessous. Un lieu nommé ou un monument : un ciel aux couleurs de la rareté avec des rayons, la grande icône et son nom sur une plaque. La lisibilité tient à trois choses : la rareté dans une pastille pleine bordée de blanc en haut à gauche, la plaque (fort contraste), et un bandeau sombre dégradé en bas pour la valeur (or), le plafond ou le loyer (vert clair).
- **Pastille** `.chip` : un chiffre avec son icône (valeur, loyer, niveau) ; jamais de longue ligne « A · B · C ».
- **Chiffres d'un lieu** `.stats` / `.stat` : deux ou trois cases côte à côte (Valeur sur fond or, Loyer sur fond vert, Quartier en étoiles), l'étiquette en petites capitales au-dessus, le chiffre en dessous ; jamais de pastilles qui passent à la ligne.
- **Montants rapides** `.vite` / `.raccourci` : grille de trois colonnes, l'étiquette (« +10 % ») au-dessus du montant ; la dernière case s'étire si la ligne est incomplète.
- **Pied de fenêtre** `.pied-modal` : collé en bas d'une fenêtre longue (échange) : le bilan et les boutons (Annuler à gauche, l'action à droite) restent visibles.
- **Échelle de construction** `.echelle` : Terrain → Maison → Immeuble → Tour (→ Prestige), étapes faites, suivante, hors plafond (cadenas).
- **Carte de collection** `.ccarte` : cadre de la couleur de la rareté, icône, nom, commune.
- **Feuille** `#sheet` : glisse du bas, poignée, se ferme vers le bas.
- **Fenêtre** `#modal` : apparaît avec un léger rebond, fond flouté.
- **Bandeau** `#toast` : descend du haut, se range seul.

## Règles

- La carte reste l'écran d'accueil ; le pack du jour est le bouton central de la barre du bas.
- Les notifications sont sous la cloche, en haut ; les réglages dans le profil.
- Des cibles de 44 px au moins ; texte de 13 px au moins.
- Sur téléphone, une fiche ouverte cache la recherche, les boutons de la carte et la légende (`body.fiche-ouverte`) ; la légende est repliée par défaut ; pas de boutons de zoom sur un écran tactile.
- Tout écran se vérifie aussi en 360 px de large (`LARGEUR=360 HAUTEUR=780 node tools/visite_ecrans.js …`) : rien ne doit déborder ni se chevaucher.
- Mouvement : seulement en réponse à un geste (ouvrir, confirmer, gagner), et l'ouverture du pack ; respecter « réduire les animations ».
