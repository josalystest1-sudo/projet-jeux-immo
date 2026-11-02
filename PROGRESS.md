# Progression — Cadastra

## Fait
- 2 nov. 2026 : interview de Gautier (volets 1 et 2), GDD V1, plan, CLAUDE.md.
- Prototype jouable `proto/index.html` (état local, joueurs simulés) : carte 3D IGN, parcelles cliquables, fiche avec Street View, packs (France entière, révélation FIFA, pack 3D métallisé), patrimoine en cartes par rareté, construction, mise en vente, offres, enchères, communes et Maires, notifications et réglages, profil (pseudo + avatar), monuments dorés.

- 2 nov. 2026 (phase 0) : dépôt `projet-jeux-immo`, publication GitHub Pages, page du jeu = prototype ; **moteur de règles** `src/regles/lieu.js` (standing, notoriété, plafond, rareté, valeur, loyer, encaissement 24 h) avec ses réglages dans `data/economie.json` (copie `data/economie.js` générée par `tools/gen_economie.py`) et 7 tests (`npm test`) ; la page du jeu utilise ce moteur.

## En cours
- Phase 1 : la carte et le modèle des lieux reconstruits en modules (`src/`), à partir du prototype.

## À faire
- Voir `docs/PLAN.md` (phases 1 à 11).

## Questions ouvertes
- Nom : « Cadastra » a des domaines pris (.fr, .com, .app) et une marque française « CadastrA » en immobilier/logiciel (voir GDD § 12) : garder ou changer, à décider par Gautier.
- Capacité de gestion (limite de lieux par niveau) : à valider après simulation.
- Fin de l'interview : volets 3 à 6 (lieux et packs, technique, graphismes, lancement).

## Bugs connus
- Les badges 💰 des joueurs simulés n'apparaissent qu'après ouverture de leur parcelle (limite du prototype local).
