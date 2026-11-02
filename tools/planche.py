# Assemble des captures en planches (4 par ligne) pour les relire d'un coup d'œil.
import sys, glob, os
from PIL import Image, ImageDraw
dossier, sortie = sys.argv[1], sys.argv[2]
fichiers = sorted(glob.glob(os.path.join(dossier, '*.png')))
if len(sys.argv) > 3: fichiers = [f for f in fichiers if any(os.path.basename(f).startswith(p) for p in sys.argv[3].split(','))]
L, H = 390, 844
par_ligne = 4
for k in range(0, len(fichiers), 8):
    lot = fichiers[k:k + 8]
    lignes = (len(lot) + par_ligne - 1) // par_ligne
    planche = Image.new('RGB', (par_ligne * (L + 10), lignes * (H + 30)), 'white')
    d = ImageDraw.Draw(planche)
    for i, f in enumerate(lot):
        im = Image.open(f).convert('RGB').resize((L, H))
        x, y = (i % par_ligne) * (L + 10), (i // par_ligne) * (H + 30)
        planche.paste(im, (x, y + 25)); d.text((x + 4, y + 6), os.path.basename(f), fill='black')
    planche.save(f'{sortie}-{k // 8 + 1}.png')
    print(f'{sortie}-{k // 8 + 1}.png')
