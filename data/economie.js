// Généré par tools/gen_economie.py depuis data/economie.json : ne pas modifier à la main.
const ECO = {
 "monnaie": "pièces",
 "salaire_par_jour": 200,
 "stock_loyer_heures": 24,
 "loyer_terrain": 10,
 "niveaux": [
  {
   "id": "terrain",
   "nom": "Terrain",
   "icone": "",
   "cout": 0,
   "loyer": 0,
   "hauteur": 0
  },
  {
   "id": "maison",
   "nom": "Maison",
   "icone": "🏠",
   "cout": 1,
   "loyer": 40,
   "hauteur": 6
  },
  {
   "id": "immeuble",
   "nom": "Immeuble",
   "icone": "🏢",
   "cout": 2.5,
   "loyer": 110,
   "hauteur": 18
  },
  {
   "id": "tour",
   "nom": "Tour",
   "icone": "🏙",
   "cout": 6,
   "loyer": 310,
   "hauteur": 45
  },
  {
   "id": "gratte_ciel",
   "nom": "Gratte-ciel",
   "icone": "🌆",
   "cout": 10,
   "loyer": 600,
   "hauteur": 75
  },
  {
   "id": "palace",
   "nom": "Palace",
   "icone": "🏨",
   "cout": 12,
   "loyer": 800,
   "hauteur": 90
  },
  {
   "id": "prestige",
   "nom": "Prestige",
   "icone": "🏛️",
   "cout": 15,
   "loyer": 1000,
   "hauteur": 60
  }
 ],
 "standing": {
  "1": {
   "nom": "Maison",
   "base": 500
  },
  "2": {
   "nom": "Immeuble",
   "base": 1500
  },
  "3": {
   "nom": "Tour",
   "base": 4000
  }
 },
 "plafond_par_rarete": {
  "1": "maison",
  "2": "immeuble",
  "3": "tour",
  "4": "gratte_ciel",
  "5": "palace",
  "6": "prestige"
 },
 "multiplicateur_valeur": {
  "commune": 1,
  "connue": 2,
  "celebre": 4,
  "monument": 10
 },
 "pack": {
  "cartes": 5,
  "par_jour": 1,
  "chances": {
   "1": 60,
   "2": 25,
   "3": 10,
   "4": 4,
   "5": 1
  }
 },
 "raretes": {
  "1": "Commun",
  "2": "Peu commun",
  "3": "Rare",
  "4": "Épique",
  "5": "Légendaire",
  "6": "Extraordinaire"
 },
 "encheres": {
  "nationaux_par_semaine": 1,
  "regionaux_par_semaine": 2,
  "pas_min": 0.05,
  "depart": {
   "national": {
    "base": 10000,
    "par_article": 600,
    "arrondi": 1000
   },
   "regional": {
    "base": 3000,
    "par_article": 200,
    "arrondi": 500
   }
  }
 },
 "fluctuation": {
  "fenetre_jours": 7,
  "commune_max": 0.3,
  "quartier": {
   "rayon_m": 300,
   "par_point": 0.01,
   "isole": -0.05,
   "max": 0.2
  },
  "tendance": {
   "part": 0.12,
   "min": 0.05,
   "max": 0.15
  }
 },
 "boutique": {
  "pack_1": 1.99,
  "pack_5": 7.99,
  "pack_12": 16.99,
  "pass_mensuel": 4.99
 },
 "solde_depart": 1500,
 "mairie": {
  "jours_mandat": 14,
  "seuil": 100,
  "part_loyers": 0.05,
  "plafond_mandat": 1000,
  "derniere_heure": 0.5,
  "absence_jours": 7,
  "versement_min": 10
 }
};
