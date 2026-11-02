"""Fabrique data/economie.js (copie de data/economie.json chargeable par une balise <script>)."""
import json, pathlib
racine = pathlib.Path(__file__).resolve().parent.parent
eco = json.loads((racine / 'data/economie.json').read_text(encoding='utf-8'))
(racine / 'data/economie.js').write_text('// Généré par tools/gen_economie.py depuis data/economie.json : ne pas modifier à la main.\nconst ECO = ' + json.dumps(eco, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
print('data/economie.js écrit')
