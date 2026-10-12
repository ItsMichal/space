#!/usr/bin/env python3
"""Halmic Text: the calm companion of Halmic Display, for body copy, UI labels, captions and nav.

Same skeleton as the display face (Nunito, SIL OFL 1.1, no Reserved Font Name), kept as ONE variable file on weight
400-800, upright, with the skeleton's spacing and kerning untouched. What it keeps from the logotype family: the fully
round terminals and round dots (they are Nunito's own). What it deliberately does NOT take from the display face, after
testing at 14-18px (see specimen.png):
  - the logotype's single-storey a (a/o/d/q blur at 14px; 'dad', 'goad', 'quad' get harder to read),
  - the logotype's M-shaped m (reads as a capital in a paragraph),
  - the plain-stem l (the skeleton's tailed l is what keeps l, I and 1 apart),
  - any slant (13 degrees in a paragraph is tiring; 3 and 5 degrees were no better than upright and cannot be done
    cleanly in a variable font without re-instancing every delta).
So the pipeline is: pin the axes, subset (Latin and Latin Extended, the same split the site always used), rename, record the
OFL notice. Output: halmic-text-latin.woff2 and halmic-text-latin-ext.woff2.

Usage: python3 build-text.py [out_dir]     (needs fonttools, brotli)
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
SRC = os.path.join(HERE, "src", "nunito", "Nunito[wght].ttf")
VERSION = "0.100"

LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

COPYRIGHT = (
    "Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito). "
    "Modified 2026: renamed, weight range 400-800, subset. Halmic Text is released under the same licence."
)
LICENSE = (
    "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
    "This license is available with a FAQ at: https://scripts.sil.org/OFL"
)


def parse(ranges):
    out = []
    for r in ranges.split(","):
        r = r.replace("U+", "")
        a, _, b = r.partition("-")
        out += range(int(a, 16), int(b or a, 16) + 1)
    return out


def set_names(font):
    name = font["name"]
    name.names = []
    values = {
        0: COPYRIGHT,
        1: "Halmic Text",
        2: "Regular",
        3: f"{VERSION};halmic-text",
        4: "Halmic Text",
        5: f"Version {VERSION}",
        6: "HalmicText-Regular",
        13: LICENSE,
        14: "https://scripts.sil.org/OFL",
    }
    for nid, text in values.items():
        name.setName(text, nid, 3, 1, 0x409)
        name.setName(text, nid, 1, 0, 0)


def main():
    os.makedirs(OUT, exist_ok=True)
    pinned = instancer.instantiateVariableFont(TTFont(SRC), {"wght": (400, 800)}, updateFontNames=False)
    if "STAT" in pinned:
        del pinned["STAT"]
    pinned["fvar"].instances = []
    tmp = os.path.join(OUT, "_pinned.ttf")
    pinned.save(tmp)
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        font = TTFont(tmp)
        opts = subset.Options()
        opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk", "case"]
        opts.name_IDs = ["*"]
        opts.hinting = False
        opts.drop_tables += ["STAT", "gasp", "prep"]
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=parse(ranges))
        sub.subset(font)
        set_names(font)
        font["OS/2"].usWeightClass = 400
        font["head"].fontRevision = float(VERSION)
        font.flavor = "woff2"
        path = os.path.join(OUT, f"halmic-text-{name}.woff2")
        font.save(path)
        print("wrote", path, os.path.getsize(path), "bytes")
    os.remove(tmp)


if __name__ == "__main__":
    main()
