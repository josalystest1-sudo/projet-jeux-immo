# StreetKeep — Brief « effet wow » de la pochette (06/11/2026)

À donner à Claude Code dans le dépôt `projet-jeux-immo`. Tout se passe dans `index.html` (section pochette, ~l. 1355–1560 : `SACHET`, `dessinPochette`, `makeNormalSachet`, `initGL`, `animGL`). **Rien n'est à refaire** : le sachet bombé, les soudures, la bande qui s'arrache sur charnière, les étincelles, la révélation et la carte (`src/carte_lieu.js`) restent tels quels. On change trois choses : l'illustration, la matière, la mise en scène.

Diagnostic de Gautier : illustration trop sobre, animation pas spectaculaire, lumière plate. Direction choisie : **une maquette de porcelaine et d'or comme sur les cartes** en visuel héroïque, et **un holo arc-en-ciel franc partout** qui bouge avec l'inclinaison (façon Pokémon Pocket), sur le bleu nuit pour rester « classe ».

## 1. Illustration héroïque (générée hors jeu, intégrée en texture)

- `dessinPochette(false)` dessine aujourd'hui la France en filets d'or. Nouveau : le recto charge `assets/pochette-jour.png` (gratuit) ou `assets/pochette-premium.png` (payant), 1024×1522 comme le canvas actuel, et **dessine par-dessus** ce qui existe déjà : titre STREETKEEP, soudures dorées, ligne de déchirure, guilloché léger. Le canvas actuel reste le **secours** si l'image n'est pas chargée (hors-ligne, premier lancement).
- Le canvas « métal » (vert = rugosité, bleu = métal) est reconstruit à partir de l'image : luminance claire → métal 1 / rugosité 0.15 (la porcelaine et l'or brillent), fond sombre → métal 0.9 / rugosité 0.35 (satin). Les zones de texte et de soudure gardent leurs valeurs actuelles.
- Génération (Ideogram 3 ou GPT Image, 4 à 6 essais, ratio 2:3 puis recadré 1024×1522). Prompt :

> Vertical trading-card booster pack artwork, flat front view, no perspective, no text. A luminous white porcelain architect's model of a French neighbourhood (Haussmann buildings, a church spire, a small town hall) with thin gold edges, sitting on a dark navy blue ground drawn with fine gold cadastral lines (parcels, streets). Dramatic warm spotlight from the upper left, deep navy night background (#0B1738 → #050B1E), soft golden glow under the model, tiny rising gold light particles. Empty darker band in the top 22 % and bottom 8 % for the pack seal. Premium, elegant, museum-like, high contrast, crisp, no watermark.

> Premium pack variant: add a famous French monument in the model (Mont-Saint-Michel or the Eiffel Tower), richer gold ornaments, warmer light.

## 2. Matière : holo arc-en-ciel franc

Dans `initGL`, fonction `matiere(t)` — valeurs actuelles : `iridescence:0.3, clearcoat:0.45, envMapIntensity:1.4, normalScale 0.55`.

- Passer à `iridescence:1, iridescenceIOR:1.35, iridescenceThicknessRange:[140,720], clearcoat:0.7, clearcoatRoughness:0.2, envMapIntensity:1.6` ; `normalScale` à 0.35 (le froissé lisse mieux l'arc-en-ciel).
- Ajouter une **carte d'épaisseur** (`iridescenceThicknessMap`) : un canvas 512×512 de bruit doux à grandes taches (valeur 0.3–1) + fines rayures diagonales (période 6 px). C'est ce qui donne les bandes de couleur qui *glissent* sur le pack quand on l'incline, au lieu d'une teinte uniforme.
- Ajouter une couche **paillettes** : un second mesh identique au recto, 0,002 devant, `MeshBasicMaterial` avec une texture de points blancs clairsemés (bruit seuillé), `blending:AdditiveBlending`, `opacity` animée entre 0.15 et 0.45 selon l'angle du pack (max quand le reflet du spot passe sur lui).
- Garder le verso plus sobre (`iridescence:0.5`).

## 3. Mise en scène et animation (`initGL` / `animGL`)

Le fond actuel est un bleu plat (`sc.background=0x060b1c`). Nouveau :

- **Pièce sombre** : fond en dégradé radial (canvas → `CanvasTexture` en `sc.background`, ou un grand plan derrière) bleu nuit au centre → noir aux bords ; un **cône de lumière** visible (spot `key` avec `angle` réduit à π/7, `penumbra` 0.8) ; un sol réfléchissant sous le pack : `MeshStandardMaterial` sombre, `roughness 0.25, metalness 0.9`, qui renvoie le reflet flou du pack (dans Three r1xx : `Reflector` est trop coûteux ; un simple plan avec `envMap` suffit).
- **Entrée** : le pack arrive de loin (z = −6) en tournant d'un demi-tour sur lui-même, s'arrête face caméra avec un rebond court (0,9 s, cubic-out), puis **respire** (déjà le cas : flotte/incline — amplifier l'inclinaison au gyroscope à ±22°).
- **Lumières qui tournent** : les deux points `rim` (bleu) et `warm` (doré) orbitent lentement autour du pack (rayon 5, 0,25 tr/s, phases opposées) : c'est ce qui fait courir l'arc-en-ciel même sans toucher l'écran.
- **Déchirure** : à chaque centimètre arraché, le pack se **gonfle** très légèrement (`bombe` ×1.06 pendant 120 ms) et vibre (`navigator.vibrate(8)`) ; les étincelles existantes deviennent plus nombreuses (×2) et prennent la couleur de la meilleure rareté du pack (déjà connue côté client à ce moment-là).
- **Ouverture** : quand la bande part, un **rayon de lumière** sort de l'ouverture (un plan vertical additif avec une texture dégradée, qui s'étire vers le haut en 0,5 s, couleur de la meilleure rareté) et le fond s'assombrit de 40 % pour que les cartes qui montent soient la seule chose éclairée.
- **Rare dans le pack** (Épique+, déjà détectable) : avant la déchirure, le pack **pulse** (le spot `key` monte de 380 à 600 sur 1,2 s en boucle) et des particules dorées tombent lentement derrière lui.

## 4. Ordre de travail proposé pour Claude Code

1. Matière (§2) — 1 soirée, effet immédiat, aucun asset.
2. Mise en scène et animation (§3) — 1 à 2 soirées.
3. Illustration (§1) — dès que Gautier a généré les deux images.

Vérifier sur téléphone réel après chaque étape (le canvas `#pkgl` est en `pixelRatio` 1.5 : garder cette limite, l'iridescence coûte peu mais le sol réfléchissant et la couche paillettes doivent rester désactivables via un drapeau `GL.leger`).
