#!/usr/bin/env python3
"""Halmic Display: a heading face derived from the halmic logotype.

Pipeline (all scripted, nothing hand-drawn for the alphabet):
  1. Take Nunito (SIL OFL 1.1, no Reserved Font Name) as the skeleton and instance it at a weight whose stem
     matches the logotype's bar (bar 53 / x-height 148.21 = 0.358; Nunito at wght 900 is 0.355).
  2. Subset to Basic Latin plus typographic punctuation and digits (headings only; everything else falls back in CSS).
  3. Lift the ascenders of b d f j k to the logotype's ascender (the logotype's x-height / ascender ratio is 0.631,
     Nunito's is 0.70, so with the x-heights matched the logotype ascender is about 81 units taller).
  4. Replace h a l m i c with the logotype's own outlines (brand/svg/wordmark-parts.json, direction C), un-slanted,
     scaled so the x-heights match, unioned, converted to quadratic curves, set on the skeleton's sidebearings.
  5. Slant every glyph 13 degrees with the same shear the logotype uses (shear keeps the white between letters).
  6. Add exact pair kerning for h-a a-l l-m m-i i-c so "halmic" set in the font reproduces the optical spacing of the
     wordmark; all other pairs keep the skeleton's own kerning.
  7. Rename (no Reserved Font Name is used), keep the copyright and the OFL notice, write TTF + WOFF2.

Usage: python3 build-display.py [out_dir]    (needs fonttools, brotli, skia-pathops, uharfbuzz; see README.md)
"""
import json
import math
import os
import sys

import pathops
import uharfbuzz as hb
from fontTools import subset
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.ttLib.tables import otTables
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
BASE = os.path.join(HERE, "src", "nunito", "Nunito[wght].ttf")

WGHT = 900
LEAN = math.radians(13)
SK = math.tan(LEAN)
B_LOGO = 235.02          # logotype ascender / baseline-to-top, in logotype units (y down)
XH_LOGO = 148.21         # logotype x-height
LETTERS = "halmic"
WORDMARK_DIRECTION = "c"
VERSION = "0.100"

UNICODES = (
    list(range(0x20, 0x7F))
    + [0xA0, 0xB7, 0xD7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2192]
)


def bounds(font, name):
    gs = font.getGlyphSet()
    bp = BoundsPen(gs)
    gs[name].draw(bp)
    return bp.bounds


def decomposed(font, name):
    gs = font.getGlyphSet()
    rp = DecomposingRecordingPen(gs)
    gs[name].draw(rp)
    return rp.value


def contours(rec):
    out, cur = [], []
    for op, args in rec:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def contour_bounds(c):
    ys = [p[1] for op, args in c for p in args if p is not None]
    return min(ys), max(ys)


def map_points(rec, fn):
    out = []
    for op, args in rec:
        out.append((op, tuple(None if p is None else fn(p) for p in args)))
    return out


def replay(rec, pen):
    for op, args in rec:
        getattr(pen, op)(*args)


def to_ttglyph(rec):
    pen = TTGlyphPen(None)
    replay(rec, pen)
    return pen.glyph()


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1. skeleton ----------------------------------------------------------------------------
    font = TTFont(BASE)
    font = instancer.instantiateVariableFont(font, {"wght": WGHT})
    # 2. subset ------------------------------------------------------------------------------
    opts = subset.Options()
    opts.layout_features = ["kern", "liga"]
    opts.notdef_outline = True
    opts.glyph_names = True
    opts.name_IDs = ["*"]
    opts.hinting = False
    opts.drop_tables += ["STAT", "gasp", "prep"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)

    upm = font["head"].unitsPerEm
    xh_base = bounds(font, "x")[3]
    asc_base = bounds(font, "l")[3]
    s = xh_base / XH_LOGO                      # font units per logotype unit
    asc_logo = B_LOGO * s
    delta = asc_logo - asc_base
    print(f"base x-height {xh_base:.1f}, ascender {asc_base:.1f}; scale {s:.4f}; logotype ascender {asc_logo:.1f}; lift {delta:.1f}")

    cmap = font.getBestCmap()
    gname = lambda ch: cmap[ord(ch)]
    hmtx = font["hmtx"]
    glyf = font["glyf"]

    # decomposed, upright records of every glyph
    rec = {g: decomposed(font, g) for g in font.getGlyphOrder()}

    # 3. lift ascenders of b d f j k ----------------------------------------------------------
    y_ramp0, y_ramp1 = xh_base + 55, xh_base + 135

    def lift_contour(c):
        lo, hi = contour_bounds(c)
        if lo > xh_base + 40:                      # wholly above the x-height zone (j dot): rigid
            return map_points(c, lambda p: (p[0], p[1] + delta))
        def f(p):
            t = min(1, max(0, (p[1] - y_ramp0) / (y_ramp1 - y_ramp0)))
            return (p[0], p[1] + delta * t)
        return map_points(c, f)

    for ch in "bdfjk":
        g = gname(ch)
        rec[g] = [item for c in contours(rec[g]) for item in lift_contour(c)]

    # 4. logotype letters ---------------------------------------------------------------------
    parts = json.load(open(os.path.join(BRAND, "wordmark-parts.json")))[WORDMARK_DIRECTION]["groups"]
    # un-slant (the wordmark shapes are sheared by x += tan(13deg) * (B - y)), flip y, scale to font units
    unshear = (s, 0, s * SK, -s, -s * SK * B_LOGO, s * B_LOGO)

    def letter_path(ds):
        p = pathops.Path()
        for d in ds:
            q = pathops.Path()
            parse_path(d, TransformPen(q.getPen(), unshear))
            ap = AreaPen()
            q.draw(ap)
            if ap.value > 0:                       # normalise every contour to the same winding before the union
                r = pathops.Path()
                q.draw(ReverseContourPen(r.getPen()))
                q = r
            p = pathops.op(p, q, pathops.PathOp.UNION) if list(p.segments) else q
        p.simplify(fix_winding=True)
        return p

    logo = {}          # char -> (upright path)
    for g in parts:
        if g["ch"] in LETTERS:
            logo[g["ch"]] = letter_path(g["ds"])
    logo_x = {}
    for ch, p in logo.items():
        bp = BoundsPen(None)
        p.draw(bp)
        logo_x[ch] = bp.bounds                     # upright bbox in wordmark layout coordinates

    base_side = {}
    for ch in LETTERS:
        g = gname(ch)
        b0 = bounds(font, g)
        adv = hmtx[g][0]
        base_side[ch] = (b0[0], adv - b0[2])       # lsb, rsb of the skeleton's own letter

    new_adv = {}
    for ch in LETTERS:
        g = gname(ch)
        xmin, ymin, xmax, ymax = logo_x[ch]
        lsb0, rsb0 = base_side[ch]
        dx = lsb0 - xmin
        pen = RecordingPen()
        logo[ch].draw(TransformPen(pen, (1, 0, 0, 1, dx, 0)))
        rec[g] = pen.value
        new_adv[ch] = lsb0 + (xmax - xmin) + rsb0
        hmtx[g] = (round(new_adv[ch]), round(lsb0))

    print("logotype letter boxes (font units):", {c: [round(v) for v in b] for c, b in logo_x.items()})
    print("skeleton sidebearings (lsb, rsb) and new advances:", {c: (round(base_side[c][0]), round(base_side[c][1]), round(new_adv[c])) for c in LETTERS})
    # 5. slant everything ---------------------------------------------------------------------
    logo_glyphs = {gname(ch) for ch in LETTERS}
    for g in font.getGlyphOrder():
        if g in logo_glyphs:
            continue
        pen = TTGlyphPen(None)
        replay(rec[g], TransformPen(pen, (1, 0, SK, 1, 0, 0)))
        glyf[g] = pen.glyph()
        glyf[g].recalcBounds(glyf)
    # logotype letters were drawn as overlapping strokes (and the unions above leave cubic curves): flatten to quadratic
    for ch in LETTERS:
        g = gname(ch)
        p = pathops.Path()
        replay(rec[g], TransformPen(p.getPen(), (1, 0, SK, 1, 0, 0)))
        tp = TTGlyphPen(None)
        p.draw(Cu2QuPen(tp, max_err=0.5, reverse_direction=True))
        glyf[g] = tp.glyph()
        glyf[g].recalcBounds(glyf)
    removeOverlaps(font)
    for g in font.getGlyphOrder():
        glyf[g].recalcBounds(glyf)
        adv, _ = hmtx[g]
        hmtx[g] = (adv, getattr(glyf[g], "xMin", 0) if glyf[g].numberOfContours else 0)

    # 6. exact pair kerning for the wordmark pairs --------------------------------------------
    pairs = []
    for a, b in zip(LETTERS, LETTERS[1:]):
        offset = (logo_x[b][0] - logo_x[a][0])          # wordmark ink-left to ink-left, upright
        lsb_a, lsb_b = base_side[a][0], base_side[b][0]
        kern = offset - new_adv[a] - lsb_b + lsb_a
        pairs.append((gname(a), gname(b), round(kern)))
    expected = {a + b: (logo_x[b][0] - logo_x[a][0]) - base_side[b][0] + base_side[a][0] for a, b in zip(LETTERS, LETTERS[1:])}
    add_pair_kerns(font, pairs)
    print("pair kerns:", [(a, b, k) for a, b, k in pairs])

    # 7. metadata -----------------------------------------------------------------------------
    set_names(font)
    font["post"].italicAngle = -13.0
    font["OS/2"].usWeightClass = WGHT
    font["head"].macStyle = 0
    font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0b1100001) | 0x40   # regular
    font["head"].fontRevision = float(VERSION)

    ttf = os.path.join(OUT, "halmic-display.ttf")
    woff2 = os.path.join(OUT, "halmic-display.woff2")
    font.save(ttf)
    f2 = TTFont(ttf)
    f2.flavor = "woff2"
    f2.save(woff2)
    print("wrote", ttf, os.path.getsize(ttf), "bytes;", woff2, os.path.getsize(woff2), "bytes")
    verify(ttf, expected)


def add_pair_kerns(font, pairs):
    gpos = font["GPOS"].table
    kern_lookups = []
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == "kern":
            kern_lookups += fr.Feature.LookupListIndex
    lookup = gpos.LookupList.Lookup[sorted(set(kern_lookups))[0]]
    sts = lookup.SubTable
    if lookup.LookupType == 9:
        raise SystemExit("extension lookup not handled")
    st = otTables.PairPos()
    st.Format = 1
    st.ValueFormat1 = 4          # XAdvance
    st.ValueFormat2 = 0
    first = {}
    for a, b, k in pairs:
        first.setdefault(a, []).append((b, k))
    order = font.getGlyphOrder()
    st.Coverage = otTables.Coverage()
    st.Coverage.glyphs = sorted(first, key=order.index)
    st.PairSet = []
    for a in st.Coverage.glyphs:
        ps = otTables.PairSet()
        ps.PairValueRecord = []
        for b, k in sorted(first[a], key=lambda t: order.index(t[0])):
            r = otTables.PairValueRecord()
            r.SecondGlyph = b
            r.Value1 = otTables.ValueRecord()
            r.Value1.XAdvance = k
            ps.PairValueRecord.append(r)
        ps.PairValueCount = len(ps.PairValueRecord)
        st.PairSet.append(ps)
    st.PairSetCount = len(st.PairSet)
    sts.insert(0, st)
    lookup.SubTableCount = len(sts)


COPYRIGHT = (
    "Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito). "
    "Modified 2026: weight, slant and the letters h a l m i c replaced with halmic logotype outlines. "
    "Halmic Display is released under the same licence."
)
LICENSE = (
    "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
    "This license is available with a FAQ at: https://scripts.sil.org/OFL"
)


def set_names(font):
    name = font["name"]
    name.names = []
    values = {
        0: COPYRIGHT,
        1: "Halmic Display",
        2: "Regular",
        3: f"{VERSION};halmic-display",
        4: "Halmic Display",
        5: f"Version {VERSION}",
        6: "HalmicDisplay-Regular",
        13: LICENSE,
        14: "https://scripts.sil.org/OFL",
    }
    for nid, text in values.items():
        name.setName(text, nid, 3, 1, 0x409)
        name.setName(text, nid, 1, 0, 0)


def verify(ttf, expected):
    """Shape 'halmic' with HarfBuzz and compare origin-to-origin distances with the wordmark's own."""
    face = hb.Face(open(ttf, "rb").read())
    f = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(LETTERS)
    buf.guess_segment_properties()
    hb.shape(f, buf, {"kern": True})
    adv = [p.x_advance for p in buf.glyph_positions]
    got = {a + b: adv[i] for i, (a, b) in enumerate(zip(LETTERS, LETTERS[1:]))}
    print("origin-to-origin, shaped vs wordmark:", {k: (got[k], round(expected[k])) for k in got})


if __name__ == "__main__":
    main()
