// Les 13 régions de métropole et leurs départements (codes de data/standing.json et de geo.js) : l'étape « région » de la
// révélation d'une carte, le pack régional de la boutique (GDD § 3), côté jeu et côté serveur.
(function (racine) {
  const REGIONS = {
    "Auvergne-Rhône-Alpes": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
    "Bourgogne-Franche-Comté": ["21", "25", "39", "58", "70", "71", "89", "90"],
    "Bretagne": ["22", "29", "35", "56"],
    "Centre-Val de Loire": ["18", "28", "36", "37", "41", "45"],
    "Corse": ["2A", "2B"],
    "Grand Est": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
    "Hauts-de-France": ["02", "59", "60", "62", "80"],
    "Île-de-France": ["75", "77", "78", "91", "92", "93", "94", "95"],
    "Normandie": ["14", "27", "50", "61", "76"],
    "Nouvelle-Aquitaine": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
    "Occitanie": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
    "Pays de la Loire": ["44", "49", "53", "72", "85"],
    "Provence-Alpes-Côte d'Azur": ["04", "05", "06", "13", "83", "84"],
  };
  // la région d'un département (null : hors métropole)
  const regionDuDepartement = (dep) => Object.keys(REGIONS).find((k) => REGIONS[k].includes(dep)) || null;
  const api = { REGIONS, regionDuDepartement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Regions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
