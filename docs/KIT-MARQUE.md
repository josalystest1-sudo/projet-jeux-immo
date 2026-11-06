# StreetKeep — Logo et kit social media : prompts pour un générateur d'images

> **Le 6 nov. (PR #175)**, le jeu s'appelle **StreetKeep** (CityDeck abandonné : city-deck.com est un jeu du même genre). Le logo généré le 5 nov. porte « CITYDECK » : à regénérer avec les mêmes prompts, le mot « STREETKEEP » à la place (il est plus long : prévoir des capitales un peu plus étroites). Le SVG du jeu (`src/logo.js`) a déjà été mis à jour.

> **Le 5 nov. (PR #135)**, Gautier a généré son logo avec la piste A : la plaque STREETKEEP, deux cartes dorées, une pièce d'or ronde frappée d'une maison. Claude l'a redessiné en SVG (`src/logo.js`, bible graphique § 13). La pièce de la monnaie est désormais cette pièce ronde à la maison ; la pièce en forme de maison n'existe plus. Pour les visuels qui suivent, joindre ce logo en image de référence.

Écrit par Claude le 5 nov. 2026 à la demande de Gautier (« rédige un prompt que j'enverrai dans un autre moteur IA »). À coller dans Ideogram, Midjourney, GPT Image, Flux ou Leonardo. Les prompts sont **en anglais** (les moteurs y sont bien meilleurs) ; la version française de chaque idée est là pour que Gautier sache ce qu'il demande.

**Outil conseillé pour le logo : Ideogram ou GPT Image** (ils écrivent le texte correctement). Midjourney et Flux font de belles images mais massacrent souvent les lettres : chez eux, générer l'emblème seul et ajouter le mot « StreetKeep » après, dans Canva ou Figma.

---

## 1. Ce que le logo doit dire (le brief, à garder en tête)

- **Le concept** : *on collectionne des lieux réels de France comme des cartes*. Le logo doit croiser **la carte à jouer** (le deck) et **la ville / la rue** (city), en un seul objet.
- **L'identité déjà posée** (`docs/DESIGN.md`) : **la plaque de rue émaillée** (bleu `#1E4598`, filet blanc, cadre vert `#2E8B57`) et **la pièce d'or en forme de maison** (`#FFC233`, relief `#D99114`). Encre `#17233F`. Fond gris perle / blanc pour les menus. Polices : Baloo 2 (titres, ronde), Barlow Condensed (capitales de plaque), Nunito (texte).
- **Le ton** (décision du 4 nov.) : « moins dessin animé, plus classe, stylé, impressionnant ». Donc : net, premium, un peu de lumière et d'or, **pas** de mascotte, **pas** de style enfantin, **pas** de dégradés criards.
- **Lisibilité** : le logo doit tenir en 48 px (icône d'app, favicon) : silhouette simple, 2-3 couleurs, pas de détails fins.
- **Interdits** : aucun monument reconnaissable protégé par une marque, aucun logo existant, aucune personne, aucune marque réelle (règle du jeu : jamais d'enseigne).

## 2. Le logo : trois pistes originales

Lancer les trois, garder celle qui plaît, puis la décliner (§ 3).

### Piste A — « La plaque-carte » (recommandée)
Une carte à jouer vue de face, légèrement inclinée, dont la face **est** une plaque de rue émaillée bleue à cadre vert ; sur la plaque, en capitales étroites blanches, le mot **STREETKEEP** comme un nom de rue (avec la petite ligne du haut « RUE DE » stylisée ou simplement un filet). Derrière la carte, deux autres cartes en éventail, dont on ne voit que la tranche, en or. En bas de la carte, une petite pièce d'or en forme de maison.

```
Logo design for a mobile game called "STREETKEEP". A single playing card seen from the front, slightly tilted, whose face is a classic French enamel street sign: deep cobalt blue enamel plate (#1E4598) with a thin white inner border and a green frame (#2E8B57), two small screws in the corners. On the plate, the word "STREETKEEP" in tall condensed white capital letters, exactly like a street name on a Paris street sign, with a thin white rule above it. Behind the main card, two more cards fanned out, only their golden edges visible. A small gold coin shaped like a house (#FFC233) rests at the bottom corner of the card. Flat vector logo, clean geometric shapes, premium and elegant, subtle gold light reflection on the enamel, no cartoon style, no mascot, no gradients except a soft enamel sheen. Centered on a plain white background, lots of empty space around. Vector, sharp edges, 2-3 colors, readable at small size.
```

### Piste B — « L'éventail de ville »
Trois cartes en éventail dont les hauts dessinent une **silhouette de ville** : la carte de gauche porte une maison, celle du milieu un immeuble, celle de droite une tour (silhouettes simples, découpées dans le haut de chaque carte). Les cartes sont bleu plaque avec un filet blanc. Le mot **StreetKeep** en dessous, en Baloo (rond, gras), encre `#17233F`, avec « City » en bleu et « Deck » en or.

```
Minimal logo for a mobile collecting game called "StreetKeep". Three playing cards fanned out like a hand of cards; the top edge of each card is cut into a simple building silhouette: a small house on the left card, a mid-rise building in the middle, a tall tower on the right card, so that together the three cards form a tiny city skyline. Cards are cobalt blue (#1E4598) with a thin white inner border, like French enamel street signs. Below, the wordmark "StreetKeep" in a round, bold, friendly sans-serif, dark navy (#17233F), with "City" in cobalt blue and "Deck" in warm gold (#FFC233). Flat vector, clean, premium, no cartoon, no mascot, no texture. White background, centered, generous margins. Must stay readable at 48 pixels.
```

### Piste C — « Le monogramme pièce »
Juste l'emblème, pour l'icône d'app : la **pièce d'or en forme de maison** (déjà le signe de la monnaie du jeu) vue de face, frappée non pas d'un C mais d'une **petite carte à jouer** en creux au centre ; relief de pièce, lumière dorée, fond bleu nuit. Le nom en dessous seulement sur la version complète.

```
App icon for a mobile game called "StreetKeep". A thick gold coin (#FFC233 with darker gold relief #D99114) whose outline is the silhouette of a simple house (square body with a pointed roof). Stamped in the center of the coin, in bas-relief, a tiny playing card with a thin border. Metallic gold with soft specular highlights, slight bevel, premium and elegant, like a collector's token. Deep night-blue background (#17233F) with a faint radial glow behind the coin. No text. Centered, square format, rounded-square app icon composition, clean vector-like rendering, no cartoon style.
```

### Réglages utiles
- **Ideogram** : style *Design*, ratio 1:1 pour l'icône, 16:9 ou 3:1 pour le logo horizontal ; cocher « Magic prompt » off pour garder le texte exact.
- **Midjourney** : ajouter `--style raw --v 7 --no cartoon, mascot, people, photo, realistic city, watermark` ; mettre le texte entre guillemets ; prévoir d'ajouter le mot après coup.
- **GPT Image** : demander explicitement « transparent background » pour obtenir un PNG détouré.
- **Négatifs communs** : `cartoon, kawaii, mascot, 3D render of a real city, photograph, people, faces, real brands, Eiffel Tower, blurry, watermark, extra letters, misspelled text`.

## 3. Le kit social media

Une fois le logo choisi, on décline **toujours avec le même emblème et les mêmes couleurs**. Pour chaque image, un prompt ; remplacer `[EMBLEM]` par une description en une phrase du logo retenu (ex. : *« the StreetKeep emblem: a tilted playing card that is a blue enamel French street sign with a green frame, with a small gold house-shaped coin »*). Dans Ideogram et GPT Image, on peut **joindre le logo en image de référence** : c'est encore mieux.

### 3.1 Formats et dimensions

| Usage | Taille | Fichier |
|---|---|---|
| Icône d'app / favicon | 1024 × 1024 (puis 512, 192, 64, 32) | PNG |
| Avatar réseaux (X, Instagram, TikTok, Facebook, Discord) | 1024 × 1024, emblème seul, centré, marge 15 % | PNG |
| Bannière X | 1500 × 500 | JPG |
| Couverture Facebook | 820 × 312 (zone sûre 640 × 312 au centre) | JPG |
| Bannière LinkedIn (page) | 1128 × 191 | JPG |
| Bannière YouTube | 2560 × 1440 (zone sûre 1546 × 423) | JPG |
| Image de partage de lien (Open Graph, pour `index.html`) | 1200 × 630 | JPG |
| Post carré (Instagram, Facebook, LinkedIn) | 1080 × 1080 | PNG |
| Post portrait (Instagram) | 1080 × 1350 | PNG |
| Story / Reel / TikTok | 1080 × 1920 | PNG |
| Capture d'écran de store (plus tard) | 1290 × 2796 (iPhone), 1080 × 1920 (Android) | PNG |

### 3.2 La bannière (X, Facebook, LinkedIn, YouTube : même image, recadrée)

```
Wide banner for the mobile game "StreetKeep". Night scene: a stylized, simplified French city skyline in deep navy blue (#17233F) silhouettes (houses, mid-rise buildings, a church bell tower, a tower), no recognizable landmark. Floating above the rooftops, a hand of 5 playing cards fanned out, each card a cobalt blue French enamel street sign (#1E4598, white inner border, green frame #2E8B57) with a different blank plate, their edges glowing softly in gold. Thin golden light rays rising from behind the skyline. [EMBLEM] placed at the left third, large, with the wordmark "StreetKeep" next to it in a round bold sans-serif, white. Right side kept clean and empty for cropping. Elegant, premium, slightly luminous, flat vector illustration with soft lighting, no cartoon style, no people, no text other than "StreetKeep". Aspect ratio 3:1.
```

### 3.3 L'image de partage de lien (1200 × 630)

```
Social share image for the mobile game "StreetKeep", 1200x630. Left half: [EMBLEM] large, with the wordmark "StreetKeep" below it in a round bold sans-serif, dark navy (#17233F). Right half: three playing cards fanned out, each card is a cobalt blue French enamel street sign with a green frame, the middle one slightly raised with a soft gold glow. Background: pearl grey (#F2F4F8) with a faint radial light. Short tagline under the wordmark in a clean sans-serif, dark grey: "Collectionne les rues de France". Flat vector, clean, premium, lots of breathing space, no cartoon, no people.
```

### 3.4 Les gabarits de posts (fond + place pour le texte, le texte s'ajoute ensuite dans Canva)

Pour que les posts soient cohérents, générer **quatre fonds** réutilisables, sans texte, puis poser le texte du jour dessus (Canva, Figma, ou l'app Photos). Un fond par type d'annonce :

**a. « Nouveau monument aux enchères »** (l'alerte que le jeu envoie à Gautier)
```
Square social media background for the game "StreetKeep", 1080x1080, no text. Deep night-blue background (#17233F) with slow golden light rays. In the center, a single playing card standing upright, its face a cobalt blue enamel street sign with a green frame, the plate left blank, surrounded by a rainbow-tinted holographic rim light (the "Extraordinary" rarity of the game) and small floating gold sparks. Bottom third kept dark and empty for text. Small [EMBLEM] in the top-left corner. Premium, elegant, luminous, flat vector with soft lighting, no cartoon, no people, no recognizable monument.
```

**b. « Le Maire du mois »**
```
Square social media background for the game "StreetKeep", 1080x1080, no text. Pearl grey background (#F2F4F8). In the center, a large blue enamel French street sign (#1E4598, white border, green frame #2E8B57) seen slightly from below, the plate blank, with a small gold laurel-wreath badge and a gold house-shaped coin (#FFC233) pinned on its corner. Clean, bright, premium, flat vector. Bottom third empty for text. Small [EMBLEM] top-left. No cartoon, no people.
```

**c. « Le pack du jour / nouveauté »**
```
Square social media background for the game "StreetKeep", 1080x1080, no text. A sealed metallic foil booster pack in cobalt blue (#1E4598) with a gold (#FFC233) band, standing upright, slightly tilted, with a strong gold light burst behind it and tiny light particles. Deep navy background (#17233F). Bottom third dark and empty for text. Small [EMBLEM] top-left. Premium, cinematic but flat vector style, no cartoon, no people, no text on the pack.
```

**d. « Nouvelle saison / classement »**
```
Square social media background for the game "StreetKeep", 1080x1080, no text. A clean podium with three steps in navy (#17233F), each step topped by a small playing card that is a blue enamel street sign with a green frame; the center card is slightly larger with a soft gold glow. Pearl grey background (#F2F4F8), thin gold confetti lines. Bottom third empty for text. Small [EMBLEM] top-left. Premium, minimal, flat vector, no cartoon, no people.
```

**Story 1080 × 1920** : reprendre les mêmes prompts en remplaçant `1080x1080` par `1080x1920, vertical, main subject in the middle third, top and bottom thirds empty for text`.

### 3.5 Les règles de texte sur les posts (pour Canva)

- **Police** : Baloo 2 Bold pour le titre (le même rond que le jeu), Nunito pour le reste. Les deux sont gratuites (Google Fonts) et déjà dans le jeu (`fonts/`).
- **Couleurs** : titre blanc sur fond nuit, encre `#17233F` sur fond perle ; un seul accent or `#FFC233` par image (un chiffre, un mot).
- **Un message par post**, 6 mots de titre au plus, un emplacement de bouton implicite (« Jouer gratuitement ») en bas.
- **Toujours** le petit emblème en haut à gauche et `citydeck.fr` en bas à droite, en petit.
- **Jamais** de nom de personne réelle, de photo de vrai propriétaire, d'enseigne ; les monuments sont nommés mais montrés par la maquette du jeu (capture d'écran), pas par une photo.

## 4. Ordre de fabrication conseillé

1. Logo : les 3 pistes du § 2, 4 variantes chacune, choisir une direction. Garder la version **vectorielle** si l'outil le permet (Ideogram et Recraft exportent en SVG), sinon vectoriser (`vectorizer.ai`, ou le vectoriseur de Wonder).
2. Icône d'app 1024 (piste C ou l'emblème seul de la piste retenue), puis les déclinaisons 512/192/64/32 (`tools/icones.js` sait fabriquer les tailles à partir d'un SVG).
3. Bannière 3:1 (§ 3.2), recadrée pour chaque réseau.
4. Image Open Graph (§ 3.3) → `index.html` (`og:image`).
5. Les 4 fonds de posts (§ 3.4) + leurs versions story.
6. Un dossier `marque/` dans le dépôt avec tout ça (logo SVG + PNG, icônes, bannières, fonds), et la ligne « où vit quoi » dans `docs/HISTORIQUE.md`.

Budget : tout se fait avec les crédits gratuits d'Ideogram (10 images/jour) ou un mois de Midjourney (~10 €), dans les 20 €/semaine.
