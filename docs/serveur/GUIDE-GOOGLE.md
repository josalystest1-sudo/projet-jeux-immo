# Clé Google pour Street View

Pourquoi : sans clé, Street View prend la photo la plus proche d'un point, parfois celle d'un particulier à l'intérieur d'une boutique (on ne peut pas avancer), et le jeu ne sait pas où est la photo pour viser le lieu. Avec la clé :
- le jeu demande à Google la photo d'extérieur la plus proche (`streetview/metadata`, gratuit et sans limite) ;
- il préfère les photos de Google, reliées aux rues, à celles des particuliers ;
- il tourne la vue exactement vers le lieu ;
- il affiche la vue avec l'intégration officielle (Maps Embed API, gratuite et sans limite).

**Décision de Gautier (4 nov. 2026) : on reste gratuit.** Le Street View interactif (Maps JavaScript API, `StreetViewPanorama`) dirait au jeu, en direct, où l'on est et où l'on regarde. La promenade tournerait de façon fluide et la carte suivrait. Mais il est payant : une ouverture facturée par création du panorama, les 5 000 premières par mois gratuites, puis 14 $ les 1 000. On ne l'utilise pas sans son accord.

La clé va dans `data/google.json` (`cle`). Elle est visible dans le jeu, c'est normal ; elle est restreinte au site.

## Créer la clé (Gautier, 3 nov. 2026)
1. https://console.cloud.google.com/google/maps-apis/start, projet « Cadastra ».
2. Compte de facturation (France, carte bancaire) : pas de prélèvement pour cet usage.
3. Copier « Votre clé API » (commence par AIza…).
4. ☰ → API et services → Bibliothèque : activer **Maps Embed API** et **Street View Static API**.
5. ☰ → API et services → Identifiants → la clé :
   - Restrictions relatives aux applications : Sites Web, `https://josalystest1-sudo.github.io/*` ;
   - Restrictions relatives aux API : Maps Embed API et Street View Static API ;
   - Enregistrer.

## Fait (3 nov. 2026)
Clé « Cadastra » créée dans le projet Google Cloud « Le Laboratoire » de Gautier, restreinte au site et aux deux API ; elle est dans `data/google.json`. Sécurité facultative : quotas de Street View Static API à 0 pour les images (« Unsigned » et « with a signature », pas « Metadata ») ; budget de 1 € avec alerte.

## Comment le jeu choisit la vue (`choisirPhoto`)
- **Une adresse** : la photo de Google la plus proche de la rue devant elle, sinon la plus proche de l'adresse.
- **Un monument** : on demande les photos autour de lui. Les points de recherche sont le monument lui-même, la rue, et deux couronnes de 8 points à 35 et 60 m. On écarte celles prises dans un bâtiment ou collées à un mur (moins de 3 m), qui sont des photos d'intérieur. On garde la meilleure selon cette note :
  - celles de Google d'abord ;
  - une distance proche de 45 m (jamais à moins de 12 m) ;
  - une ligne de vue qui ne traverse pas d'autre bâtiment ;
  - un bonus si elle passe au-dessus de l'eau (bassin, rivière) ;
  - dans un parc, pas depuis la rue.
- La vue est tournée vers le monument et lève un peu les yeux.
- Si Google refuse la clé, le jeu revient tout seul à l'ancien Street View, sans clé.

Essais (3 nov.) : Fontaine Médicis (au bout de son bassin), Panthéon, Palais du Luxembourg, Château de Versailles, cathédrale de Chartres : vues d'extérieur, de face ou presque.
