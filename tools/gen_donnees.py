"""Fabrique les jeux de données du jeu à partir de data/sources/ :

- data/standing.json et data/standing.js : le standing (1, 2 ou 3) de chaque commune qui n'est pas au standing 1.
- data/monuments.json et data/monuments.js : les monuments (nationaux et régionaux), avec leur code INSEE.
- data/celebres/<département>.json : les lieux célèbres (article Wikipédia), un fichier par département,
  chargé par le jeu à la demande. Source : data/sources/celebres_wikidata.txt (tools/wikidata_celebres.py).

Les codes INSEE manquants des monuments sont retrouvés par géocodage inverse (géoplateforme IGN).
Relancer après toute modification de data/sources/ :  python3 tools/gen_donnees.py [standing] [monuments] [celebres]
(sans argument : tout ; « monuments » interroge l'IGN pour chaque monument et prend une minute.)
"""
import json, math, pathlib, sys, time, urllib.request, urllib.parse

RACINE = pathlib.Path(__file__).resolve().parent.parent
SOURCES = RACINE / 'data' / 'sources'

# ---------------------------------------------------------------- standing
# Alsace-Moselle : pas de DVF (livre foncier). [Proposé] : les deux villes chères connues au standing 2, le reste au 1.
STANDING_SANS_DVF = {'67482': 2, '68066': 2}


def standing():
    table = {}
    for ligne in (SOURCES / 'standing_dvf.txt').read_text(encoding='utf-8').splitlines():
        if not ligne.strip() or ligne.startswith('#'):
            continue
        dep, t3, t2 = ligne.split('|')
        for suffixes, niveau in ((t3, 3), (t2, 2)):
            for i in range(0, len(suffixes), 3):
                table[dep + suffixes[i:i + 3]] = niveau
    table.update(STANDING_SANS_DVF)
    return dict(sorted(table.items()))


# ---------------------------------------------------------------- monuments
# Ensembles, itinéraires, paysages ou lignes : pas un lieu ponctuel qu'on peut posséder.
EXCLUS = {
    'Q4580', 'Q750675', 'Q16064866', 'Q55619850', 'Q833781', 'Q392215', 'Q2962473', 'Q10444176',
    'Q20650698', 'Q2233532', 'Q1279597', 'Q463159', 'Q747541', 'Q8399', 'Q202494',
}
# Noms à corriger (libellé Wikidata peu parlant).
RENOMMES = {'Q2698691': "musée d'Orsay", 'Q1423005': 'cathédrale Saint-Pierre-et-Saint-Paul de Nantes',
            'Q998451': 'cathédrale Saint-Étienne de Châlons', 'Q2205594': 'cathédrale Saint-Nicolas de Nice',
            'Q1736213': 'cathédrale Saint-Front de Périgueux', 'Q217452': 'basilique de Vézelay',
            'Q1419757': 'cathédrale de la Major de Marseille'}
# Monuments célèbres absents de la requête (pas inscrits comme monument historique dans Wikidata).
AJOUTS = [
    ('manuel-tour-eiffel', 'tour Eiffel', 2.2945, 48.8584, '75107', 200),
    ('manuel-notre-dame-de-la-garde', 'basilique Notre-Dame-de-la-Garde', 5.3713, 43.2840, '13206', 40),
    ('manuel-viaduc-de-millau', 'viaduc de Millau', 3.0225, 44.0775, '12145', 40),
    # demande de Gautier (4 nov. 2026) ; nombre d'articles lu dans Wikidata (celebres_wikidata.txt) : classée comme les autres
    ('Q392564', 'Grande Mosquée de Paris', 2.3550, 48.8419, '75105', 47),
]
NATIONAUX = 60  # les 60 plus connus : légendaires nationaux ; les suivants : régionaux
# Corrections du classement automatique (le nombre d'articles Wikipédia a des biais) : [Proposé], Gautier tranchera.
FORCES_NATIONAUX = {'Q651388'}            # abbaye du Mont-Saint-Michel
FORCES_REGIONAUX = {'Q1143049'}           # château de Montsoreau (beaucoup d'articles, peu connu du grand public)
INSEE_FORCES = {'Q622500': '13207'}       # château d'If (île, pas d'adresse à proximité)


def commune_par_coordonnees(lon, lat):
    """(code INSEE, nom de la commune) de l'adresse la plus proche, par la géoplateforme IGN."""
    url = 'https://data.geopf.fr/geocodage/reverse?' + urllib.parse.urlencode({'lon': lon, 'lat': lat, 'limit': 1, 'index': 'address'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                f = json.load(r)['features']
                if not f:
                    return '', ''
                p = f[0]['properties']
                return p.get('citycode', ''), p.get('city', '')
        except Exception:
            time.sleep(1)
    return '', ''


def noms_communes(codes):
    """Noms officiels des communes (ADMIN EXPRESS, sans géométrie), par paquets."""
    noms, codes = {}, sorted(set(codes))
    for i in range(0, len(codes), 40):
        liste = ','.join(f"'{c}'" for c in codes[i:i + 40])
        url = ('https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ADMINEXPRESS-COG-CARTO.LATEST:commune'
               '&OUTPUTFORMAT=application/json&PROPERTYNAME=code_insee,nom_officiel&CQL_FILTER=' + urllib.parse.quote(f'code_insee IN ({liste})'))
        with urllib.request.urlopen(url, timeout=60) as r:
            for f in json.load(r)['features']:
                noms[f['properties']['code_insee']] = f['properties']['nom_officiel']
    return noms


def nom_arrondissement(code):
    n = None
    if code.startswith('751'): ville, n = 'Paris', int(code[3:])
    elif code.startswith('6938'): ville, n = 'Lyon', int(code[3:]) - 380
    elif code.startswith('132'): ville, n = 'Marseille', int(code[3:]) - 200
    return f"{ville} {n}{'er' if n == 1 else 'e'}" if n else None


def monuments():
    lignes = []
    for ligne in (SOURCES / 'monuments_wikidata.txt').read_text(encoding='utf-8').splitlines():
        if not ligne.strip() or ligne.startswith('#'):
            continue
        qid, nom, lon, lat, insee, articles = ligne.split('|')
        if qid in EXCLUS:
            continue
        lignes.append((qid, RENOMMES.get(qid, nom), float(lon), float(lat), insee, int(articles)))
    lignes += AJOUTS
    lignes.sort(key=lambda m: -m[5])
    nationaux = [m for m in lignes if m[0] not in FORCES_REGIONAUX][:NATIONAUX - len(FORCES_NATIONAUX)]
    ids_nationaux = {m[0] for m in nationaux} | FORCES_NATIONAUX
    sortie = []
    for qid, nom, lon, lat, insee, articles in lignes:
        insee = INSEE_FORCES.get(qid, insee)
        code_proche, ville = commune_par_coordonnees(lon, lat)
        time.sleep(0.12)
        if not insee or insee == '75056':
            insee = code_proche
        ville = nom_arrondissement(insee) or ville
        sortie.append({
            'id': qid, 'nom': nom[0].upper() + nom[1:], 'lon': lon, 'lat': lat, 'insee': insee, 'ville': ville,
            'palier': 'national' if qid in ids_nationaux else 'regional', 'articles': articles,
        })
    manquants = noms_communes([m['insee'] for m in sortie if not m['ville']])
    for m in sortie:
        if not m['ville']:
            m['ville'] = manquants.get(m['insee'], '')
    return sortie


# ---------------------------------------------------------------- lieux célèbres
CELEBRES_PRES_MONUMENT = 60  # mètres : une entrée aussi proche d'un monument est ce monument (ou une de ses parties)


def celebres(monuments_liste):
    ids = {m['id'] for m in monuments_liste}
    grille = {}
    for m in monuments_liste:
        grille.setdefault((round(m['lon'], 2), round(m['lat'], 2)), []).append(m)

    def pres_d_un_monument(lon, lat):
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                for m in grille.get((round(lon + dx, 2), round(lat + dy, 2)), []):
                    d = math.hypot((lon - m['lon']) * math.cos(math.radians(lat)) * 111320, (lat - m['lat']) * 110540)
                    if d < CELEBRES_PRES_MONUMENT:
                        return True
        return False

    par_dep, ecartes = {}, 0
    for ligne in (SOURCES / 'celebres_wikidata.txt').read_text(encoding='utf-8').splitlines():
        if not ligne.strip() or ligne.startswith('#'):
            continue
        qid, nom, cat, lon, lat, insee, _liens = ligne.split('|')
        lon, lat = float(lon), float(lat)
        if qid in ids or qid in EXCLUS or not insee or pres_d_un_monument(lon, lat):
            ecartes += 1
            continue
        dep = insee[:3] if insee.startswith('97') else insee[:2]
        par_dep.setdefault(dep, []).append([qid, nom[0].upper() + nom[1:], cat, round(lon, 5), round(lat, 5), insee])

    dossier = RACINE / 'data' / 'celebres'
    dossier.mkdir(exist_ok=True)
    for vieux in dossier.glob('*.json'):
        vieux.unlink()
    for dep, lieux in sorted(par_dep.items()):
        (dossier / f'{dep}.json').write_text(
            json.dumps({'dep': dep, 'lieux': lieux}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return par_dep, ecartes


def ecrire(nom, constante, valeur, commentaire):
    (RACINE / 'data' / f'{nom}.json').write_text(json.dumps(valeur, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (RACINE / 'data' / f'{nom}.js').write_text(
        f'// Généré par tools/gen_donnees.py ({commentaire}) : ne pas modifier à la main.\n'
        f'const {constante} = ' + json.dumps(valeur, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')


if __name__ == '__main__':
    quoi = set(sys.argv[1:]) or {'standing', 'monuments', 'celebres'}
    if 'standing' in quoi:
        s = standing()
        ecrire('standing', 'STANDING', s, 'standing des communes, sources DVF')
        print('standing :', sum(1 for v in s.values() if v == 3), 'communes au 3,', sum(1 for v in s.values() if v == 2), 'au 2')
    if 'monuments' in quoi:
        m = monuments()
        ecrire('monuments', 'MONUMENTS', m, 'monuments, source Wikidata')
        print('monuments :', len(m), '(', sum(1 for x in m if x['palier'] == 'national'), 'nationaux ), sans code INSEE :', [x['nom'] for x in m if not x['insee']], 'sans ville :', [x['nom'] for x in m if not x['ville']])
    else:
        m = json.loads((RACINE / 'data' / 'monuments.json').read_text(encoding='utf-8'))
    if 'celebres' in quoi:
        c, ecartes = celebres(m)
        print('lieux célèbres :', sum(len(v) for v in c.values()), 'dans', len(c), 'départements ;', ecartes, 'écartés (monuments, sans commune)')
