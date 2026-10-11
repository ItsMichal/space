#!/usr/bin/env python3
"""Body face for the site: Nunito Sans (SIL OFL 1.1) pinned to width 100, optical size 12 and the default YTLC, kept
variable on weight 400-800, subset to Latin and Latin Extended (same split as the previous Geist files).
Writes nunito-sans-latin.woff2 and nunito-sans-latin-ext.woff2.   Usage: python3 build-body.py [out_dir]
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
SRC = os.path.join(HERE, "src", "nunito-sans", "NunitoSans[YTLC,opsz,wdth,wght].ttf")

LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"


def parse(ranges):
    out = []
    for r in ranges.split(","):
        r = r.replace("U+", "")
        a, _, b = r.partition("-")
        out += range(int(a, 16), int(b or a, 16) + 1)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    base = TTFont(SRC)
    axes = {a.axisTag: a for a in base["fvar"].axes}
    pinned = instancer.instantiateVariableFont(
        base, {"wdth": 100, "opsz": 12, "YTLC": axes["YTLC"].defaultValue, "wght": (400, 800)}
    )
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        font = TTFont()
        # subset a copy: round-trip through a temp save so the pinned font stays intact for the second subset
        tmp = os.path.join(OUT, "_pinned.ttf")
        pinned.save(tmp)
        font = TTFont(tmp)
        opts = subset.Options()
        opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk", "tnum", "case"]
        opts.name_IDs = ["*"]
        opts.hinting = False
        opts.flavor = "woff2"
        opts.drop_tables += ["STAT"]
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=parse(ranges))
        sub.subset(font)
        font.flavor = "woff2"
        path = os.path.join(OUT, f"nunito-sans-{name}.woff2")
        font.save(path)
        print("wrote", path, os.path.getsize(path), "bytes")
    os.remove(tmp)


if __name__ == "__main__":
    main()
