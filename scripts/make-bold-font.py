"""
make-bold-font.py — derive a static Bold TTF from the Google Sans Flex VARIABLE font.

The bundled GoogleSansFlex-Regular.ttf is a variable font (wght axis 1..1000). React
Native renders only the default instance (Regular/400) and can't reach the weight axis for a
custom family, so `fontWeight: '700'` had no effect on Android. We instance a standalone
static Bold here and give it its own family name so RN can reference it by fontFamily.

    python scripts/make-bold-font.py
    → assets/fonts/GoogleSansFlex-Bold.ttf
"""
from fontTools import ttLib
from fontTools.varLib.instancer import instantiateVariableFont
import os

SRC = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "GoogleSansFlex-Regular.ttf")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "GoogleSansFlex-Bold.ttf")

NEW_NAME = "GoogleSansFlex-Bold"          # PostScript + family name we'll use in fontFamily

font = ttLib.TTFont(SRC)

# Pin every axis. wght=700 (Bold); opsz=18 matches the Regular default (good for body text);
# neutral width/grade/round/slant so it visually matches the Regular face exactly.
instantiateVariableFont(font, {
    "wght": 700, "opsz": 18, "wdth": 100, "GRAD": 0, "ROND": 0, "slnt": 0,
}, inplace=True)

# Rewrite the name table so RN sees a distinct, single-weight family "GoogleSansFlex-Bold".
# Setting family (1/16), subfamily (2/17=Regular), full (4) and PostScript (6) keeps Android
# (matches by family/PostScript) and iOS (matches by PostScript) both able to resolve it.
name = font["name"]
def setname(nid, val):
    name.setName(val, nid, 3, 1, 0x409)   # Windows / Unicode BMP / en-US
    name.setName(val, nid, 1, 0, 0)        # Mac / Roman / en (for iOS)

setname(1, NEW_NAME)      # Family
setname(2, "Regular")     # Subfamily — single weight in this family
setname(4, NEW_NAME)      # Full name
setname(6, NEW_NAME)      # PostScript name
setname(16, NEW_NAME)     # Typographic family
setname(17, "Regular")    # Typographic subfamily

# A single-weight family: mark it Regular/400 so nothing tries to synthesize on top of it.
if "OS/2" in font:
    font["OS/2"].usWeightClass = 400
if "head" in font:
    font["head"].macStyle &= ~0b01   # clear the Bold bit

font.save(OUT)
print("wrote", os.path.relpath(OUT))
