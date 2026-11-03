# Clé Google pour Street View

Pourquoi : sans clé, Street View prend la photo la plus proche d'un point, parfois celle d'un particulier à l'intérieur d'une boutique (on ne peut pas avancer), et le jeu ne sait pas où est la photo pour viser le lieu. Avec la clé :
- le jeu demande à Google la photo d'extérieur la plus proche (`streetview/metadata`, gratuit et sans limite) ;
- il préfère les photos de Google, reliées aux rues, à celles des particuliers ;
- il tourne la vue exactement vers le lieu ;
- il affiche la vue avec l'intégration officielle (Maps Embed API, gratuite et sans limite).

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
