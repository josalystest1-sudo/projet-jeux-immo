"""Récupère dans Wikidata les lieux « célèbres » de France métropolitaine : les églises, châteaux, mairies, gares…
qui ont un article sur Wikipédia en français. Écrit data/sources/celebres_wikidata.txt.

Une requête par catégorie (le service limite parfois à une requête par minute : le script attend et réessaie).
Les codes INSEE manquants sont retrouvés par géocodage inverse (géoplateforme IGN).
Ensuite : python3 tools/gen_donnees.py (fabrique data/celebres/<département>.json).

    python3 tools/wikidata_celebres.py [--pause 65] [--categories eglise,gare] [--fusion]
    (--fusion : sans interroger Wikidata, assemble seulement les catégories déjà reçues)
"""
import argparse, datetime, json, pathlib, re, sys, time, urllib.parse, urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / 'data' / 'sources' / 'celebres_wikidata.txt'
BROUILLON = RACINE / 'data' / 'sources' / '.celebres_brouillon'  # une réponse par catégorie, pour reprendre après une coupure
UA = 'Cadastra/0.1 (https://github.com/josalystest1-sudo/projet-jeux-immo)'

# catégorie du jeu -> classe Wikidata (« nature de l'élément », P31)
CATEGORIES = {
    'eglise': 'Q16970', 'chapelle': 'Q108325', 'cathedrale': 'Q2977', 'abbaye': 'Q160742',
    'monastere': 'Q44613', 'prieure': 'Q2750108', 'chateau': 'Q751876', 'chateau_fort': 'Q23413',
    'manoir': 'Q879050', 'gare': 'Q55488', 'phare': 'Q39715',
    # (5 nov. 2026) les mairies françaises sont des « hôtels de ville » dans Wikidata ; les musées, souvent une sorte de
    # musée (d'art, militaire, archéologique, national…) ; jamais une galerie d'art (un commerce)
    'mairie': ('Q543654', 'Q25550691'),
    'musee': ('Q33506', 'Q207694', 'Q2772772', 'Q3329412', 'Q17431399', 'Q16735822', 'Q2087181', 'Q588140', 'Q1595639'),
    'pont': 'Q12280', 'fort': 'Q57821', 'tour': 'Q12518', 'moulin_vent': 'Q38720', 'moulin_eau': 'Q185187',
    'theatre': 'Q24354', 'fontaine': 'Q483453',
    'stade': 'Q483110', 'synagogue': ('Q34627', 'Q109300353'), 'porte': 'Q82117',
    # les autres lieux de culte (décision de Gautier, 4 nov. 2026 : tous présents, sans quota ; les églises restent les
    # plus nombreuses parce qu'il y en a le plus) : une catégorie peut regrouper plusieurs classes de Wikidata
    'mosquee': ('Q32815', 'Q1454820'),                    # mosquée, grande mosquée
    'temple': ('Q56242063', 'Q56242275', 'Q6807904'),     # temple protestant, église luthérienne, temple réformé
    'eglise_orthodoxe': ('Q2031836', 'Q56242225'),        # église et cathédrale orthodoxes
    'temple_bouddhiste': ('Q5393308', 'Q199451', 'Q180987'),  # temple bouddhiste, pagode, stupa
    'temple_hindou': 'Q842402', 'gurdwara': 'Q337986',
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


# Jamais d'enseigne ni de marque sur un lieu (décision de Gautier, 3 nov. 2026) : un lieu qui est aussi un domaine
# viticole (château Margaux), un vignoble, un hôtel (Negresco), un restaurant, un cinéma, une salle d'événements, un
# commerce, une entreprise ou une marque est écarté ; de même un bâtiment détruit (rien à posséder). Classes directes (P31).
EXCLUS_CLASSES = ['Q156362', 'Q22715', 'Q27686', 'Q1631129', 'Q11707', 'Q41253', 'Q18674739', 'Q875157', 'Q213441',
                  'Q216107', 'Q133215', 'Q4830453', 'Q783794', 'Q431289', 'Q19860854']


def lieux_de(classes, pause):
    classes = ' '.join('wd:' + c for c in ((classes,) if isinstance(classes, str) else classes))
    exclus = ' '.join('wd:' + c for c in EXCLUS_CLASSES)
    return sparql(f'''SELECT DISTINCT ?i ?nom ?coord ?insee ?liens WHERE {{
      VALUES ?classe {{ {classes} }}
      ?i wdt:P31 ?classe ; wdt:P17 wd:Q142 ; wdt:P625 ?coord ; wikibase:sitelinks ?liens .
      FILTER NOT EXISTS {{ VALUES ?exclu {{ {exclus} }} ?i wdt:P31 ?exclu . }}
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


# Les marques que Wikidata ne classe pas comme telles (5 nov. 2026) : les grands vins (château Palmer, Cos d'Estournel…)
# sont des « châteaux » dans Wikidata, mais leur article de Wikipédia est rangé dans une catégorie de vignoble ou de
# domaine viticole ; une entreprise (maison de champagne, musée d'une marque), dans une catégorie d'entreprise. Pour
# ces catégories de lieux, on lit les catégories de l'article (gardées dans le brouillon) et on écarte ces lieux.
A_VERIFIER = {'chateau', 'chateau_fort', 'manoir', 'musee', 'theatre', 'moulin_vent', 'moulin_eau'}
VIN = re.compile(r'viticole|^vignoble|\bvins?\b(?!-)|\bcrus?\b|appellation', re.I)   # (châteaux, manoirs, moulins)
MARQUE = re.compile(r'entreprise|\bmarques?\b|maison de champagne|maison de cognac|négociant|cabaret|music-hall', re.I)
# des catégories qui ne disent rien d'une marque : un site lié au vin (le château de Suze-la-Rousse), un musée du vin, une
# intercommunalité « … du Vignoble », le nom officiel d'une rue de Paris
IGNOREES = re.compile(r'^(Site ou monument lié à la vigne|Musée du vin|Communauté de communes|Appellation officielle)', re.I)


def est_marque(cat, categories):
    """Vrai si les catégories de l'article disent un grand vin, une entreprise ou un cabaret (un musée de France : jamais)."""
    if any('Label musée de France' in c for c in categories):
        return False
    for c in categories:
        if IGNOREES.search(c):
            continue
        if MARQUE.search(c) or (cat not in ('musee', 'theatre') and VIN.search(c)):
            return True
    return False
CATEGORIES_WP = BROUILLON / 'categories_wikipedia.json'


def api(url):
    for _ in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print(f'    {e} ; nouvel essai', file=sys.stderr, flush=True)
            time.sleep(5)
    return {}


def categories_wikipedia(qids):
    """qid → les catégories (visibles) de son article de Wikipédia en français ; gardées dans le brouillon."""
    deja = json.loads(CATEGORIES_WP.read_text(encoding='utf-8')) if CATEGORIES_WP.exists() else {}
    manque = [q for q in qids if q not in deja]
    for k in range(0, len(manque), 50):
        lot = manque[k:k + 50]
        ents = api('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(lot), 'props': 'sitelinks', 'sitefilter': 'frwiki', 'format': 'json'})).get('entities', {})
        titres = {e['sitelinks']['frwiki']['title']: q for q, e in ents.items() if e.get('sitelinks', {}).get('frwiki')}
        cats = {q: [] for q in lot}
        if titres:
            j = api('https://fr.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'titles': '|'.join(titres), 'prop': 'categories', 'clshow': '!hidden', 'cllimit': 'max', 'redirects': 1, 'format': 'json'}))
            renvois = {r['from']: r['to'] for r in j.get('query', {}).get('redirects', [])}
            normal = {n['from']: n['to'] for n in j.get('query', {}).get('normalized', [])}
            vers = {renvois.get(normal.get(t, t), normal.get(t, t)): q for t, q in titres.items()}
            for p in j.get('query', {}).get('pages', {}).values():
                q = vers.get(p.get('title'))
                if q:
                    cats[q] = [c['title'].split(':', 1)[1] for c in p.get('categories', [])]
        deja.update(cats)
        if k % 1000 == 0:
            print(f'  catégories Wikipédia : {k + len(lot)}/{len(manque)}', flush=True)
            CATEGORIES_WP.write_text(json.dumps(deja, ensure_ascii=False), encoding='utf-8')
    CATEGORIES_WP.write_text(json.dumps(deja, ensure_ascii=False), encoding='utf-8')
    return deja


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

    # fusion : un lieu par identifiant (la première catégorie trouvée, dans l'ordre de CATEGORIES). Les catégories sans
    # brouillon (reçues lors d'un passage précédent) sont reprises du fichier déjà écrit, et passent en premier.
    lieux, anciennes = {}, set()
    if SORTIE.exists():
        for ligne in SORTIE.read_text(encoding='utf-8').splitlines():
            if not ligne.strip() or ligne.startswith('#'):
                continue
            qid, nom, cat, lon, lat, insee, liens = ligne.split('|')
            if (BROUILLON / f'{cat}.json').exists():
                continue
            anciennes.add(cat)
            lieux[qid] = {'nom': nom, 'cat': cat, 'lon': float(lon), 'lat': float(lat), 'insee': insee, 'liens': int(liens)}
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

    # les marques (grands vins, entreprises, cabarets) : écartées d'après les catégories de leur article
    a_voir = sorted(q for q, l in lieux.items() if l['cat'] in A_VERIFIER)
    cats = categories_wikipedia(a_voir)
    marques = [q for q in a_voir if est_marque(lieux[q]['cat'], cats.get(q, []))]
    for q in marques:
        del lieux[q]
    print(f'{len(marques)} marques écartées (vins, entreprises, cabarets)', flush=True)

    sans = [q for q, l in lieux.items() if not l['insee']]
    print(f'{len(lieux)} lieux, {len(sans)} sans code INSEE : géocodage inverse', flush=True)
    for k, q in enumerate(sans):
        l = lieux[q]
        l['insee'] = commune_par_coordonnees(l['lon'], l['lat'])
        if k % 200 == 0:
            print(f'  {k}/{len(sans)}', flush=True)

    jour = datetime.date.today().isoformat()
    recues = [c for c in CATEGORIES if c in anciennes or (BROUILLON / f'{c}.json').exists()]
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
