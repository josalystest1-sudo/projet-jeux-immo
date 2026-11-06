# StreetKeep — Système d'événements de commune (V2)

Écrit par Claude le 4 nov. 2026 à la demande de Gautier, après la séance de game design de l'après-midi (GDD § 14). Pas en V1.

- Chaque commune a une **Attractivité** (0–100, départ 50). Elle multiplie les loyers de toutes les adresses de la commune : `loyer = base × (0,5 + attractivité / 100)` (donc ×0,5 à ×1,5).
- Un générateur tire des événements. Rythme : **1 commune active sur 10 par semaine**, et **15 jours de repos** minimum par commune après un événement.
- Un événement = un texte ancré dans le lieu réel, **3 options**, un **délai de 24 h** de vote.
- Votent les joueurs qui possèdent au moins une adresse dans la commune, **pondérés par leur nombre d'adresses** (monument = 5 adresses).
- L'option gagnante s'applique à **toute la commune**. Le coût individuel n'est payé que par ceux qui ont voté pour l'option gagnante (sauf mention `cout_tous`).
- Si personne ne vote : l'option marquée `defaut: true` s'applique.
- Les effets durent **7 jours** sauf mention contraire, puis l'Attractivité revient de 2 points par jour vers 50.

## 2. Format JSON d'un événement

```json
{
  "id": "manif-degenere",
  "categorie": "social",            // social | securite | culture | economie | catastrophe | opportunite
  "rarete": "commun",               // commun | rare | epique (fréquence de tirage)
  "titre": "La manifestation dégénère",
  "texte": "Une manifestation contre la hausse des loyers tourne mal à {commune}. Des groupes cassent des vitrines rue {rue_aleatoire}.",
  "conditions": {                   // filtres optionnels pour tirer l'événement
    "population_min": 5000,
    "attractivite_max": 70
  },
  "options": [
    {
      "id": "police",
      "libelle": "Payer un renfort de police",
      "cout": { "type": "pourcentage_pieces", "valeur": 30 },
      "effets": { "attractivite": +5 },
      "texte_resultat": "Le calme revient vite. Les commerces rouvrent dès le lendemain."
    },
    {
      "id": "milice",
      "libelle": "Fonder une milice de quartier",
      "cout": { "type": "pieces_fixe", "valeur": 500 },
      "effets": { "attractivite": -5, "batiments_endommages": 1, "bonus": { "type": "garde_commune", "duree_jours": 30, "valeur": 10 } },
      "texte_resultat": "Les casseurs sont repoussés, mais la milice fait peur aux habitants. Elle restera un mois."
    },
    {
      "id": "rien",
      "libelle": "Laisser passer l'orage",
      "defaut": true,
      "cout": null,
      "effets": { "attractivite": -15, "batiments_endommages": 3 },
      "texte_resultat": "Le quartier est marqué pour un moment : vitrines brisées, tags, loyers en baisse."
    }
  ]
}
```

### Types de coût
| type | signification |
|---|---|
| `pourcentage_pieces` | % des pièces du votant |
| `pieces_fixe` | montant fixe par votant |
| `ressource` | ex. `{ "type": "ressource", "nom": "pierre", "valeur": 200 }` |
| `cout_tous: true` | tous les propriétaires de la commune paient, quel que soit leur vote |

### Types d'effet
| clé | signification |
|---|---|
| `attractivite` | delta sur la commune, 7 jours |
| `attractivite_permanente` | delta qui ne revient pas vers 50 (rare) |
| `batiments_endommages` | nombre de bâtiments tirés au hasard dans la commune qui perdent 1 niveau (réparation = coût réduit) |
| `adresse_temporaire` | crée une adresse éphémère (festival, marché…) attribuée par tirage parmi les votants gagnants |
| `pack_bonus` | pack gratuit pour les votants gagnants |
| `bonus` | buff à durée (garde, production, loyer) |

## 3. Cinq événements écrits

### 3.1 La manifestation dégénère (social, commun)
Voir le JSON ci-dessus.

### 3.2 Le festival d'été (culture, commun)
> La mairie de {commune} cherche des mécènes pour son festival d'été. Sans financement, il se tiendra dans la commune voisine.

| Option | Coût | Effet |
|---|---|---|
| **Financer le festival** | 400 pièces | Attractivité +15 pendant 14 jours ; une adresse temporaire « Scène du festival » (loyer ×3, 14 jours) attribuée à un votant gagnant tiré au sort |
| **Sponsoriser à moitié** | 150 pièces | Attractivité +5 ; pas de scène |
| **Ne rien financer** *(défaut)* | — | Attractivité −5 ; la commune voisine gagne +10 (impact sur un autre quartier !) |

### 3.3 Vague de cambriolages (sécurité, commun)
> Une série de cambriolages touche {commune}. Les habitants réclament des mesures.

| Option | Coût | Effet |
|---|---|---|
| **Installer la vidéosurveillance** | 20 % des pièces, `cout_tous` | Attractivité +10 pendant 30 jours ; immunité aux événements « sécurité » 30 jours |
| **Rondes de voisins** | 100 pièces | Attractivité 0 ; 1 bâtiment endommagé |
| **Ignorer** *(défaut)* | — | Attractivité −10 ; 2 bâtiments endommagés ; 10 % des loyers non récoltés de la commune disparaissent |

### 3.4 Le grand chantier (économie, rare)
> Un promoteur propose de construire un centre commercial à {commune}. Les commerçants du centre sont inquiets.

| Option | Coût | Effet |
|---|---|---|
| **Accepter le projet** | — | Attractivité +20 pendant 30 jours, puis −5 permanent (le centre-ville se vide) ; 3 adresses « Commune » de la commune passent « Peu commune » |
| **Négocier des compensations** | 300 pièces | Attractivité +10, 30 jours ; pack bonus pour les votants gagnants |
| **Refuser** *(défaut)* | — | Attractivité −5 ; l'événement se déplace vers une commune voisine |

### 3.5 La tempête (catastrophe, rare, toute la région)
> Une tempête traverse {region}. {commune} compte des toitures arrachées et des rues coupées.

Particularité : l'événement est tiré **pour 5 à 10 communes d'une même région en même temps**. Chaque commune vote séparément.

| Option | Coût | Effet |
|---|---|---|
| **Réparer en urgence** | 200 pierre + 100 bois | Aucun dommage ; attractivité +5 (« la commune a bien réagi ») |
| **Réparer à l'économie** | 100 pierre | 1 bâtiment endommagé ; attractivité 0 |
| **Attendre les assurances** *(défaut)* | — | 3 bâtiments endommagés ; attractivité −10 ; loyers ×0,5 pendant 7 jours |

## 4. Règles d'ergonomie (à respecter dès la V1)

1. **Une seule notification par jour** : « 3 votes en cours, le plus proche se termine dans 6 h ». Jamais une notification par événement.
2. **Écran « Mes votes »** : liste de tous les événements où le joueur peut voter, triés par délai restant, vote en un tap depuis la liste.
3. **Chaque option doit être un vrai dilemme en solo** (pièces maintenant contre attractivité plus tard). Pas d'option « évidemment bonne ».
4. **Le résultat est public** : sur la fiche de la commune, l'historique des 5 derniers événements et de qui a voté quoi (pseudo + poids). C'est la source des rivalités de quartier.
5. **Jamais de perte d'adresse** par un événement. Les dégâts se réparent, l'attractivité remonte. On perd du temps et des pièces, pas son deck.

## 5. Génération du contenu

- Claude génère les événements en lot à partir de ce format : objectif V1 = **60 événements** (30 communs, 20 rares, 10 épiques), 6 catégories.
- Les variables `{commune}`, `{rue_aleatoire}`, `{region}`, `{monument_proche}` sont remplacées à la volée avec les vraies données BAN/IGN.
- Les textes doivent rester neutres (pas de partis, pas de sujets d'actualité réels sensibles) : « une manifestation contre la hausse des loyers », pas « une manifestation contre la réforme X ».
