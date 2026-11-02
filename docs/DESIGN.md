# Le style de Cadastra — « la plaque et la pièce »

Référence pour tout écran nouveau ou refait (3 nov. 2026, demande de Gautier : « le jeu doit être super beau », ergonomie des meilleurs jeux mobiles). Fichier de style : `style.css`.

## L'idée

Deux objets que tout le monde connaît en France donnent son identité au jeu :

- **la plaque de rue émaillée** (bleu de Paris, liseré blanc, cadre vert) : le nom de chaque lieu s'affiche sur une plaque, comme si on possédait vraiment la rue. C'est **le seul élément audacieux** ; tout le reste reste calme.
- **la pièce d'or** : la monnaie, et la couleur des boutons d'action principaux.

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

- **Baloo 2** (600, 700, 800) : titres, plaques, chiffres, boutons.
- **Nunito** (500 à 900) : textes.

Embarquées dans `fonts/` (licence OFL), pas de service extérieur.

## Composants

- **Bouton** `.btn` : pièce d'or, relief de 4 px en bas, s'enfonce au toucher ; variantes `.bleu`, `.vert`, `.clair`, `.danger`, taille `.sm`. Un seul bouton principal (or) par carte ; les autres en `.clair`.
- **Plaque** `.plaque` : nom d'un lieu, d'une rue, d'un monument.
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
