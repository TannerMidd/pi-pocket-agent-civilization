# Press Start 2P has the Reserved Font Name "Press Start 2P". Converting it to WOFF2 makes a Modified Version
# (OFL 1.1, "Definitions": "by changing formats"), which must not use that name. So the converted font gets a
# name of its own, "Civ Pixel Start", in every name record; the glyphs stay as they are.
import sys
from fontTools.ttLib import TTFont
src, dst = sys.argv[1], sys.argv[2]
font = TTFont(src)
# Only the font's names (family, subfamily ids, full name, PostScript, unique id, typographic names): the
# copyright notice (0), license (13, 14), and the rest stay word for word, as the OFL asks.
NAMES = {1, 3, 4, 6, 16, 17, 18, 21, 22}
for record in font["name"].names:
    if record.nameID not in NAMES:
        continue
    text = record.toUnicode()
    new = text.replace("Press Start 2P", "Civ Pixel Start").replace("PressStart2P", "CivPixelStart")
    if new != text:
        record.string = new
font.flavor = "woff2"
font.save(dst)
for record in TTFont(dst)["name"].names:
    if record.nameID in (0, 1, 3, 4, 6):
        print(record.nameID, record.toUnicode())
