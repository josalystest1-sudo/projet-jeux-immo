# Progression — Cadastra

## Fait
- 2 nov. 2026 : interview de Gautier (volets 1 et 2), GDD V1, plan, CLAUDE.md.
- Prototype jouable `proto/index.html` (état local, joueurs simulés) : carte 3D IGN, parcelles cliquables, fiche avec Street View, packs (France entière, révélation FIFA, pack 3D métallisé), patrimoine en cartes par rareté, construction, mise en vente, offres, enchères, communes et Maires, notifications et réglages, profil (pseudo + avatar), monuments dorés.

- 2 nov. 2026 (phase 0) : dépôt `projet-jeux-immo`, publication GitHub Pages, page du jeu = prototype ; **moteur de règles** `src/regles/lieu.js` (standing, notoriété, plafond, rareté, valeur, loyer, encaissement 24 h) avec ses réglages dans `data/economie.json` (copie `data/economie.js` générée par `tools/gen_economie.py`) et 7 tests (`npm test`) ; la page du jeu utilise ce moteur.

- 2 nov. 2026 (phase 1.5, données) : **standing réel de chaque commune** à partir des prix DVF (`data/standing.json`, 615 communes au 3, 5 146 au 2) et **458 monuments** de Wikidata (`data/monuments.json`, 60 nationaux + 398 régionaux, avec code INSEE et ville), fabriqués par `tools/gen_donnees.py` depuis `data/sources/` ; le moteur de règles prend la table de standing (arrondissements ramenés à leur ville) ; la carte affiche les 458 monuments (halo doré, nom dès le zoom 15) ; l'enchère de la semaine tourne sur les 60 nationaux. 10 tests.

- 2 nov. 2026 (soir) : **lieux célèbres** : les lieux qui ont un article Wikipédia (Wikidata) sont Célèbres, donc Épiques ; d'abord les **églises et chapelles** (12 913 lieux, un fichier par département dans `data/celebres/`, chargés à la demande) ; un repère bleu sur la carte (nom dès le zoom 16), le lieu dans la fiche de sa parcelle avec le lien Wikipédia, et le pack reconnaît une église de l'IGN qui est célèbre. Outils : `tools/wikidata_celebres.py` (reprise après coupure, `--fusion`), `tools/gen_donnees.py celebres`. Moteur : `src/regles/celebres.js` (même lieu ou non : distance et nom). 18 tests. Corrigé : le badge « en vente » s'étalait en grande ellipse sombre sur la carte ; la publication échouait (`npm ci` sans `package-lock.json`).

## En cours
- Lieux célèbres : les autres catégories (châteaux, mairies, gares, musées, ponts, phares, moulins…) dès que Wikidata répond (`python3 tools/wikidata_celebres.py`, puis `--fusion` et `gen_donnees.py celebres`).
- Phase 1.1 à 1.4 : la carte et le modèle des lieux reconstruits en modules (`src/`) à partir du prototype ; puis les 3 enchères par semaine (phase 5).

## À faire
- Voir `docs/PLAN.md` (phases 1 à 11).

## Questions ouvertes
- Relire la liste des 60 monuments nationaux (`data/monuments.json`, `palier: national`).
- Seuils du standing (4 500 et 2 500 €/m²) : à valider.
- Nom : « Cadastra » a des domaines pris (.fr, .com, .app) et une marque française « CadastrA » en immobilier/logiciel (voir GDD § 12) : garder ou changer, à décider par Gautier.
- Capacité de gestion (limite de lieux par niveau) : à valider après simulation.
- Fin de l'interview : volets 3 à 6 (lieux et packs, technique, graphismes, lancement).

## Bugs connus
- Les badges 💰 des joueurs simulés n'apparaissent qu'après ouverture de leur parcelle (limite du prototype local).
