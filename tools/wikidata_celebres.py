"""Récupère dans Wikidata les lieux « célèbres » de France métropolitaine : les églises, châteaux, mairies, gares…
qui ont un article sur Wikipédia en français. Écrit data/sources/celebres_wikidata.txt.

Une requête par catégorie (le service limite parfois à une requête par minute : le script attend et réessaie).
Les codes INSEE manquants sont retrouvés par géocodage inverse (géoplateforme IGN).
Ensuite : python3 tools/gen_donnees.py (fabrique data/celebres/<département>.json).

    python3 tools/wikidata_celebres.py [--pause 65] [--categories eglise,gare] [--fusion]
    (--fusion : sans interroger Wikidata, assemble seulement les catégories déjà reçues)
"""
import argparse, datetime, json, pathlib, sys, time, urllib.parse, urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / 'data' / 'sources' / 'celebres_wikidata.txt'
BROUILLON = RACINE / 'data' / 'sources' / '.celebres_brouillon'  # une réponse par catégorie, pour reprendre après une coupure
UA = 'Cadastra/0.1 (https://github.com/josalystest1-sudo/projet-jeux-immo)'

# catégorie du jeu -> classe Wikidata (« nature de l'élément », P31)
CATEGORIES = {
    'eglise': 'Q16970', 'chapelle': 'Q108325', 'cathedrale': 'Q2977', 'abbaye': 'Q160742',
    'monastere': 'Q44613', 'prieure': 'Q2750108', 'chateau': 'Q751876', 'chateau_fort': 'Q23413',
    'manoir': 'Q879050', 'mairie': 'Q543654', 'gare': 'Q55488', 'musee': 'Q33506', 'phare': 'Q39715',
    'pont': 'Q12280', 'fort': 'Q57821', 'tour': 'Q12518', 'moulin_vent': 'Q38720', 'moulin_eau': 'Q185187',
    'theatre': 'Q24354', 'fontaine': 'Q483453',
    'stade': 'Q483110', 'synagogue': 'Q34627', 'porte': 'Q82117',
}
# France métropolitaine et Corse
LON, LAT = (-5.3, 9.7), (41.2, 51.2)


def sparql(requete, pause):
    url = 'https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': requete, 'format': 'json'})
    for essai in range(8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)['results']['bindings']
        except Exception as e:  # limite de débit, délai dépassé, coupure : on attend et on recommence
            print(f'    {e} ; nouvel essai dans {pause} s', file=sys.stderr, flush=True)
            time.sleep(pause)
    raise RuntimeError('Wikidata ne répond pas')


def lieux_de(classe, pause):
    return sparql(f'''SELECT ?i ?nom ?coord ?insee ?liens WHERE {{
      ?i wdt:P31 wd:{classe} ; wdt:P17 wd:Q142 ; wdt:P625 ?coord ; wikibase:sitelinks ?liens .
      ?article schema:about ?i ; schema:isPartOf <https://fr.wikipedia.org/> .
      OPTIONAL {{ ?i wdt:P131 ?commune . ?commune wdt:P374 ?insee . }}
      OPTIONAL {{ ?i rdfs:label ?nom FILTER(lang(?nom) = "fr") }}
    }}''', pause)


def point(wkt):
    lon, lat = wkt.replace('Point(', '').replace(')', '').split()
    return float(lon), float(lat)


def commune_par_coordonnees(lon, lat):
    url = 'https://data.geopf.fr/geocodage/reverse?' + urllib.parse.urlencode({'lon': lon, 'lat': lat, 'limit': 1, 'index': 'address'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r:
                f = json.load(r)['features']
                return f[0]['properties']['citycode'] if f else ''
        except Exception:
            time.sleep(2)
    return ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pause', type=int, default=65)
    ap.add_argument('--categories', default=','.join(CATEGORIES))
    ap.add_argument('--fusion', action='store_true')
    args = ap.parse_args()
    BROUILLON.mkdir(exist_ok=True)

    for cat in ([] if args.fusion else args.categories.split(',')):
        f = BROUILLON / f'{cat}.json'
        if f.exists():
            continue
        time.sleep(args.pause)
        r = lieux_de(CATEGORIES[cat], args.pause)
        f.write_text(json.dumps(r), encoding='utf-8')
        print(f'{cat:18} {len(r)} lignes', flush=True)

    # fusion : un lieu par identifiant (la première catégorie trouvée, dans l'ordre de CATEGORIES)
    lieux = {}
    for cat in CATEGORIES:
        f = BROUILLON / f'{cat}.json'
        if not f.exists():
            continue
        for x in json.loads(f.read_text(encoding='utf-8')):
            qid = x['i']['value'].rsplit('/', 1)[1]
            nom = x.get('nom', {}).get('value', '')
            if not nom or nom == qid:
                continue
            if not x['coord']['value'].startswith('Point('):  # position « inconnue » ou sur un autre astre
                continue
            lon, lat = point(x['coord']['value'])
            if not (LON[0] <= lon <= LON[1] and LAT[0] <= lat <= LAT[1]):
                continue
            insee = x.get('insee', {}).get('value', '')
            l = lieux.setdefault(qid, {'nom': nom, 'cat': cat, 'lon': lon, 'lat': lat, 'insee': insee, 'liens': int(x['liens']['value'])})
            if not l['insee'] and insee:
                l['insee'] = insee

    sans = [q for q, l in lieux.items() if not l['insee']]
    print(f'{len(lieux)} lieux, {len(sans)} sans code INSEE : géocodage inverse', flush=True)
    for k, q in enumerate(sans):
        l = lieux[q]
        l['insee'] = commune_par_coordonnees(l['lon'], l['lat'])
        if k % 200 == 0:
            print(f'  {k}/{len(sans)}', flush=True)

    jour = datetime.date.today().isoformat()
    recues = [c for c in CATEGORIES if (BROUILLON / f'{c}.json').exists()]
    lignes = [
        f'# Lieux de France métropolitaine (églises, châteaux, mairies, gares…) qui ont un article Wikipédia en français,',
        f'# extraits de Wikidata le {jour} par tools/wikidata_celebres.py. Notoriété « Célèbre » dans le jeu.',
        f'# Catégories : {", ".join(recues)}.',
        '# Format : identifiant Wikidata | nom | catégorie | longitude | latitude | code INSEE | nombre d\'articles (toutes langues)',
    ]
    for q, l in sorted(lieux.items(), key=lambda kv: (kv[1]['insee'], kv[0])):
        nom = l['nom'].replace('|', '/')
        lignes.append(f"{q}|{nom}|{l['cat']}|{l['lon']:.5f}|{l['lat']:.5f}|{l['insee']}|{l['liens']}")
    SORTIE.write_text('\n'.join(lignes) + '\n', encoding='utf-8')
    print(f'écrit {SORTIE.relative_to(RACINE)} : {len(lieux)} lieux', flush=True)


if __name__ == '__main__':
    main()
