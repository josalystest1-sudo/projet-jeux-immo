-- L'icône de profil importée (18 nov. 2026, Gautier : « on doit pouvoir mettre l'icône que l'on veut en profil (importer
-- des images) »). L'icône reste dans profils.avatar : soit un émoji, comme avant, soit une petite image (réduite à 96 px
-- par le jeu, refaite en JPEG : ni position ni données de l'appareil photo), écrite en « data: ». La base refuse tout le
-- reste : une image trop lourde, un autre format (jamais de SVG), autre chose qu'une image.
alter table public.profils drop constraint if exists profils_avatar_check;
alter table public.profils add constraint profils_avatar_check check (
  char_length(avatar) <= 8
  or (char_length(avatar) <= 16000 and avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')
);
