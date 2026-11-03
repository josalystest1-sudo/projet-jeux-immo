# Le style de Cadastra — « la plaque et la pièce »

Référence pour tout écran nouveau ou refait (3 nov. 2026, demande de Gautier : « le jeu doit être super beau », ergonomie des meilleurs jeux mobiles). Fichier de style : `style.css`.

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

Raretés : Commun `#8E9AAF` (ardoise), Peu commun `#2FB36D`, Rare `#2F80ED`, Épique `#9B51E0`, Légendaire `#F2A900`.

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
- **Échelle de construction** `.echelle` : Terrain → Maison → Immeuble → Tour (→ Prestige), étapes faites, suivante, hors plafond (cadenas).
- **Carte de collection** `.ccarte` : cadre de la couleur de la rareté, icône, nom, commune.
- **Feuille** `#sheet` : glisse du bas, poignée, se ferme vers le bas.
- **Fenêtre** `#modal` : apparaît avec un léger rebond, fond flouté.
- **Bandeau** `#toast` : descend du haut, se range seul.

## Règles

- La carte reste l'écran d'accueil ; le pack du jour est le bouton central de la barre du bas.
- Les notifications sont sous la cloche, en haut ; les réglages dans le profil.
- Des cibles de 44 px au moins ; texte de 13 px au moins.
- Mouvement : seulement en réponse à un geste (ouvrir, confirmer, gagner), et l'ouverture du pack ; respecter « réduire les animations ».
