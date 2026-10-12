#!/usr/bin/env python3
"""Halmic Display: a heading face derived from the halmic logotype.

Pipeline (all scripted, nothing hand-drawn for the alphabet):
  1. Take Nunito (SIL OFL 1.1, no Reserved Font Name) as the skeleton and instance it at a weight whose stem
     matches the logotype's bar (bar 53 / x-height 148.21 = 0.358; Nunito at wght 900 is 0.355).
  2. Subset to everything a heading can plausibly contain: Basic Latin, Latin-1 Supplement, Latin Extended-A, typographic
     punctuation, a few symbols and the four arrows (Nunito has no arrows: they are drawn here from the same round-capped
     bars as the logotype). --ship regenerates the `unicode-range` of "Halmic Display" in public/base.css from the built cmap.
  3. Lift the ascenders of b d f j k to the logotype's ascender (the logotype's x-height / ascender ratio is 0.631,
     Nunito's is 0.70, so with the x-heights matched the logotype ascender is about 81 units taller).
  4. Replace h a l m i c with the logotype's own outlines (brand/svg/wordmark-parts.json, direction C), un-slanted,
     scaled so the x-heights match, unioned, converted to quadratic curves, set on the skeleton's sidebearings.
  5. Slant every glyph 13 degrees with the same shear the logotype uses (shear keeps the white between letters).
  6. Add exact pair kerning for h-a a-l l-m m-i i-c so "halmic" set in the font reproduces the optical spacing of the
     wordmark; all other pairs keep the skeleton's own kerning.
  6b. Accents: a composite whose base is a logotype letter (h a l m i c, and the dotless i drawn from the logotype i's stem)
     keeps that letter as its component, so an accented form reuses the logotype letter, never Nunito's. The mark moves by
     the horizontal centre difference between the logotype letter and Nunito's, and rises with the ascender lift.
     aogonek, iogonek and hbar are simple glyphs in Nunito (drawn on Nunito's letters) and are rebuilt as composites.
  7. Rename (no Reserved Font Name is used), keep the copyright and the OFL notice, write TTF + WOFF2.

Usage: python3 build-display.py [out_dir] [--ship]    (needs fonttools, brotli, skia-pathops, uharfbuzz; see README.md)
  --ship  copy the woff2 to public/fonts/halmic-display.<sha1[:8]>.woff2 (the old copy is deleted) and point the one
          url() in public/base.css and the preload in build.mjs at it. /fonts/* is cached for a long time, so a changed
          font needs a changed URL.
"""
import copy
import hashlib
import io
import json
import math
import os
import re
import shutil
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
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SHIP = "--ship" in sys.argv
OUT = ARGS[0] if ARGS else os.path.join(HERE, "out")
BASE = os.path.join(HERE, "src", "nunito", "Nunito[wght].ttf")

WGHT = 900
LEAN = math.radians(13)
SK = math.tan(LEAN)
B_LOGO = 235.02          # logotype ascender / baseline-to-top, in logotype units (y down)
XH_LOGO = 148.21         # logotype x-height
LETTERS = "halmic"
WORDMARK_DIRECTION = "c"
VERSION = "0.101"

# Tuning of the two logotype letters that read too heavy / too wide in running text (owner feedback on the heading
# "Want something made? Say hi."). Both are rebuilt here from the logotype's own primitives (round-capped bars and a
# ring, brand/lib.mjs) with different parameters, instead of using the wordmark outlines; the wordmark itself is
# untouched (it is an SVG built from wordmark-parts.json).  Units: logotype units (bar T = 53, x-height 148.21).
T_LOGO = 53.0
A_STROKE = 47.0         # a: ring + stem stroke (logotype 53). Same outer size, bigger counter, less joint weight.
M_PITCH = 80.0           # m: distance between stem centres (logotype 90)
M_VDEPTH = 24.0          # m: how far the V apex is lifted off the baseline bar end (logotype 20); keeps the diagonal angle
M_SIDE = 0.92            # m: sidebearings as a fraction of the skeleton m's

def _wanted():
    cmap = TTFont(BASE).getBestCmap()
    want = (list(range(0x20, 0x7F)) + [u for u in range(0xA0, 0x100) if u != 0xAD] + list(range(0x100, 0x180))
            + [0x2BC, 0x2C6, 0x2DC, 0x2010, 0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
               0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2212])
    return [u for u in want if u in cmap]       # Nunito lacks a few (U+0133, U+017F, ...)


ARROWS = {0x2190: ("arrowleft", (-1, 0)), 0x2191: ("arrowup", (0, 1)), 0x2192: ("arrowright", (1, 0)), 0x2193: ("arrowdown", (0, -1))}
UNICODES = _wanted() + list(ARROWS)
ARROW_STROKE = 0.82      # arrows: stroke as a fraction of the logotype bar (the heads need the air)
ARROW_LEN = 760          # shaft length, font units
ARROW_HEAD = 255         # head arm run (45 degrees), font units
SPECIAL = {"aogonek", "iogonek", "hbar"}     # simple glyphs in Nunito, rebuilt as composites on the logotype letters
HBAR_AT = 0.55           # hbar: bar height between x-height (0) and ascender (1)
OGONEK_AT = 0.30         # ogonek mark centre, right of the stem centre, in mark widths


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


def _pol(cx, cy, r, a):
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def _arc(pen, cx, cy, r, a0, a1):
    """cubic approximation of a circular arc, same construction as brand/lib.mjs"""
    n = max(1, math.ceil(abs(a1 - a0) / (math.pi / 2) - 1e-9))
    da = (a1 - a0) / n
    k = (4 / 3) * math.tan(da / 4)
    for i in range(n):
        s0 = a0 + i * da
        e = s0 + da
        p1 = (cx + r * (math.cos(s0) - k * math.sin(s0)), cy + r * (math.sin(s0) + k * math.cos(s0)))
        p2 = (cx + r * (math.cos(e) + k * math.sin(e)), cy + r * (math.sin(e) - k * math.cos(e)))
        pen.curveTo(p1, p2, _pol(cx, cy, r, e))


def _capsule(pen, p0, p1, r):
    ph = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    pen.moveTo(_pol(*p0, r, ph + math.pi / 2))
    pen.lineTo(_pol(*p1, r, ph + math.pi / 2))
    _arc(pen, p1[0], p1[1], r, ph + math.pi / 2, ph - math.pi / 2)
    pen.lineTo(_pol(*p0, r, ph - math.pi / 2))
    _arc(pen, p0[0], p0[1], r, ph - math.pi / 2, ph - 3 * math.pi / 2)
    pen.closePath()


def _disc(pen, cx, cy, r):
    pen.moveTo((cx + r, cy))
    _arc(pen, cx, cy, r, 0, 2 * math.pi)
    pen.closePath()


def tuned_shapes(ch):
    """Upright logotype-space (y down) shapes for the rebuilt letters, or None: [(add|sub, drawer)]."""
    B, XH = B_LOGO, XH_LOGO
    XT = B - XH
    if ch == "a":
        t = A_STROKE
        cx, cy = XH / 2, B - XH / 2
        rc = XH / 2 - t / 2
        return [("add", lambda p: _disc(p, cx, cy, rc + t / 2)),
                ("sub", lambda p: _disc(p, cx, cy, rc - t / 2)),
                ("add", lambda p: _capsule(p, (cx + rc, XT + t / 2), (cx + rc, B - t / 2), t / 2))]
    if ch == "m":
        r = T_LOGO / 2
        x0, x2 = r, r + 2 * M_PITCH
        mid = (x0 + x2) / 2
        vy = B - r - M_VDEPTH
        return [("add", lambda p: _capsule(p, (x0, XT + r), (x0, B - r), r)),
                ("add", lambda p: _capsule(p, (x0, XT + r), (mid, vy), r)),
                ("add", lambda p: _capsule(p, (mid, vy), (x2, XT + r), r)),
                ("add", lambda p: _capsule(p, (x2, XT + r), (x2, B - r), r))]
    return None


def add_glyph(font, name, glyph, unicode_):
    order = font.getGlyphOrder() + [name]
    font.setGlyphOrder(order)
    font["glyf"][name] = glyph
    glyph.recalcBounds(font["glyf"])
    adv = getattr(glyph, "_halmic_adv", 0)
    font["hmtx"][name] = (adv, getattr(glyph, "xMin", 0) if glyph.numberOfContours else 0)
    if unicode_ is not None:
        for t in font["cmap"].tables:
            if t.isUnicode() and (unicode_ <= 0xFFFF or t.format in (12, 13)):
                t.cmap[unicode_] = name


def arrow_glyph(ux, uy, t, xh):
    """An arrow drawn from round-capped bars (shaft + two 45 degree head arms), the logotype's construction, centred on
    the x-height's middle. Returns a TrueType glyph."""
    r = t / 2
    horiz = uy == 0
    L, a = ARROW_LEN, ARROW_HEAD
    side = 70
    adv = (L + t + 2 * side) if horiz else (2 * a + t + 2 * side)
    cx, cy = adv / 2, xh * 0.5
    tip = (cx + ux * L / 2, cy + uy * L / 2)
    tail = (cx - ux * L / 2, cy - uy * L / 2)
    n = (-uy, ux)
    back = (tip[0] - ux * a, tip[1] - uy * a)
    arms = [(back[0] + n[0] * a, back[1] + n[1] * a), (back[0] - n[0] * a, back[1] - n[1] * a)]
    acc = None
    for p0, p1 in ((tail, tip), (tip, arms[0]), (tip, arms[1])):
        q = pathops.Path()
        _capsule(q.getPen(), p0, p1, r)
        q.simplify(fix_winding=True)
        acc = q if acc is None else pathops.op(acc, q, pathops.PathOp.UNION)
    acc.simplify(fix_winding=True)
    tp = TTGlyphPen(None)
    acc.draw(Cu2QuPen(tp, max_err=0.5, reverse_direction=True))
    g = tp.glyph()
    g._halmic_adv = round(adv)
    return g


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
    sub.populate(unicodes=[u for u in UNICODES if u not in ARROWS], glyphs=["uni0328"])   # uni0328: ogonek mark for aogonek / iogonek
    sub.subset(font)

    upm = font["head"].unitsPerEm
    xh_base = bounds(font, "x")[3]
    asc_base = bounds(font, "l")[3]
    s = xh_base / XH_LOGO                      # font units per logotype unit
    asc_logo = B_LOGO * s
    delta = asc_logo - asc_base
    print(f"base x-height {xh_base:.1f}, ascender {asc_base:.1f}; scale {s:.4f}; logotype ascender {asc_logo:.1f}; lift {delta:.1f}")

    # The ASCII apostrophe in a title ("L'evasion") is typed far more often than U+2019 and Nunito draws it as a thin
    # tapered tick that looks like a different face next to the heavy letters: it takes the shape of the curly one.
    for t in font["cmap"].tables:
        if t.isUnicode() and 0x2019 in t.cmap:
            t.cmap[0x27] = t.cmap[0x2019]
    cmap = font.getBestCmap()
    gname = lambda ch: cmap[ord(ch)]
    hmtx = font["hmtx"]
    glyf = font["glyf"]

    # new glyphs: the arrows (Nunito has none) and the bar of hbar; aogonek / iogonek / hbar become composites
    t_arrow = T_LOGO * s * ARROW_STROKE
    for u, (name, (ux, uy)) in ARROWS.items():
        add_glyph(font, name, arrow_glyph(ux, uy, t_arrow, xh_base), u)
    add_glyph(font, "halmic.hbar", TTGlyphPen(None).glyph(), None)
    for g, base, mark in (("aogonek", "a", "uni0328"), ("iogonek", "i", "uni0328"), ("hbar", "h", "halmic.hbar")):
        cg = copy.deepcopy(glyf["aacute"])
        cg.components[0].glyphName = gname(base)
        cg.components[1].glyphName = mark
        glyf[g] = cg
    comps = {}                                 # composite glyph -> [(component, x, y)] as Nunito has them
    for g in font.getGlyphOrder():
        if glyf[g].isComposite():
            assert not any(hasattr(c, "transform") for c in glyf[g].components), g
            comps[g] = [(c.glyphName, c.x, c.y) for c in glyf[g].components]

    # decomposed, upright records of every glyph
    rec = {g: decomposed(font, g) for g in font.getGlyphOrder()}
    adv0 = {g: hmtx[g][0] for g in font.getGlyphOrder()}      # Nunito's advances (ldot, lcaron ... are wider than l)
    rec0 = dict(rec)                              # the skeleton as it is, for the optical pair matching in step 6
    skeleton_buf = io.BytesIO()
    font.save(skeleton_buf)
    skeleton = hb.Font(hb.Face(skeleton_buf.getvalue()))

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
    wm_x = dict(logo_x)                            # the wordmark's own boxes: pair offsets below are measured on these

    # a and m are rebuilt (see A_STROKE ... M_SIDE); their boxes are now in the letter's own coordinates
    flip = (s, 0, 0, -s, 0, s * B_LOGO)
    for ch in "am":
        acc = None
        for op, draw in tuned_shapes(ch):
            q = pathops.Path()
            draw(TransformPen(q.getPen(), flip))
            q.simplify(fix_winding=True)
            acc = q if acc is None else pathops.op(acc, q, pathops.PathOp.UNION if op == "add" else pathops.PathOp.DIFFERENCE)
        acc.simplify(fix_winding=True)
        logo[ch] = acc
        bp = BoundsPen(None)
        acc.draw(bp)
        logo_x[ch] = bp.bounds

    base_side = {}
    for ch in LETTERS:
        # sidebearings come from the skeleton's own letter, except l: Nunito's l has a curved tail, the logotype's does not,
        # so l borrows the plain-stem sidebearings of i (otherwise l crowds its right-hand neighbour)
        g = gname("i" if ch == "l" else ch)
        b0 = bounds(font, g)
        adv = hmtx[g][0]
        base_side[ch] = (b0[0], adv - b0[2])       # lsb, rsb of the skeleton's own letter
    base_side["m"] = (base_side["m"][0] * M_SIDE, base_side["m"][1] * M_SIDE)

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

    levels = [xh_base * (i + 0.5) / 8 for i in range(8)]

    def profile(r):
        """per level: (left ink edge, right ink edge) or None"""
        p = pathops.Path()
        replay(r, p.getPen())
        out = []
        for y in levels:
            band = pathops.Path()
            bp = band.getPen()
            bp.moveTo((-4000, y - 2)); bp.lineTo((6000, y - 2)); bp.lineTo((6000, y + 2)); bp.lineTo((-4000, y + 2)); bp.closePath()
            hit = pathops.op(p, band, pathops.PathOp.INTERSECTION)
            xs = [pt[0] for c in hit.contours for seg in c.segments for pt in seg[1]]
            out.append((min(xs), max(xs)) if xs else None)
        return out

    # 4b. dotless i (the logotype i without its dot) and the accented forms ---------------------
    i_stem = letter_path(next(g for g in parts if g["ch"] == "i")["ds"][:1])
    dx_i = base_side["i"][0] - logo_x["i"][0]
    pen = RecordingPen()
    i_stem.draw(TransformPen(pen, (1, 0, 0, 1, dx_i, 0)))
    rec["dotlessi"] = pen.value
    hmtx["dotlessi"] = hmtx[gname("i")]

    def rec_bounds(r):
        bp = BoundsPen(None)
        replay(r, bp)
        return bp.bounds

    def mid_center(r):
        """horizontal centre of the ink over the middle of the x-height (where the stems and bowls are)"""
        cs = [(p[0] + p[1]) / 2 for k, p in enumerate(profile(r)) if p and 2 <= k <= 5]
        return sum(cs) / len(cs)

    custom_bases = {gname(c) for c in LETTERS} | {"dotlessi"}
    lifted = {gname(c) for c in "bdfk"}
    comps2 = {}                                # glyph -> [(component, x, y)] re-seated on the new base (upright coordinates)
    for g, cl in comps.items():
        base = cl[0][0]
        if g in SPECIAL or (base not in custom_bases and base not in lifted):
            continue
        dxc = mid_center(rec[base]) - mid_center(rec0[base])
        dyc = max(0, rec_bounds(rec[base])[3] - rec_bounds(rec0[base])[3])    # only ever rise (the logotype i's stem stops a little under the x-height; the marks keep their gap)
        new = [(base, 0, 0)]
        for n, x, y in cl[1:]:
            above = bounds(font, n)[1] + y >= xh_base - 10      # marks above the x-height ride with the letter's top; the l-dot, slash and cedillas stay
            new.append((n, round(x + dxc), round(y + (dyc if above else 0))))
        comps2[g] = new
        if base in custom_bases:
            hmtx[g] = (hmtx[base][0] + adv0[g] - adv0[base], 0)
    # simple glyphs of Nunito rebuilt on the logotype letters
    ogonek = bounds(font, "uni0328")
    ow = ogonek[2] - ogonek[0]
    for g, base in (("aogonek", "a"), ("iogonek", "i")):
        r = rec_bounds(rec[gname(base)])
        stem_x = (r[2] - A_STROKE * s / 2) if base == "a" else mid_center(rec["dotlessi"])
        comps2[g] = [(gname(base), 0, 0), ("uni0328", round(stem_x + OGONEK_AT * ow - (ogonek[0] + ogonek[2]) / 2), 0)]
        hmtx[g] = hmtx[gname(base)]
    hb_ = rec_bounds(rec[gname("h")])
    bar_t = T_LOGO * s * 0.42
    bar_y = xh_base + HBAR_AT * (asc_logo - xh_base)
    stem_c = hb_[0] + T_LOGO * s / 2
    bp_ = RecordingPen()
    _capsule(bp_, (stem_c - T_LOGO * s, bar_y), (stem_c + T_LOGO * s, bar_y), bar_t / 2)
    rec["halmic.hbar"] = bp_.value
    comps2["hbar"] = [(gname("h"), 0, 0), ("halmic.hbar", 0, 0)]
    hmtx["hbar"] = hmtx[gname("h")]
    custom_glyphs = {gname(c) for c in LETTERS} | {"dotlessi", "halmic.hbar"}

    print("logotype letter boxes (font units):", {c: [round(v) for v in b] for c, b in logo_x.items()})
    print("skeleton sidebearings (lsb, rsb) and new advances:", {c: (round(base_side[c][0]), round(base_side[c][1]), round(new_adv[c])) for c in LETTERS})
    # 5. slant everything ---------------------------------------------------------------------
    # Composites stay composites: the shear is linear, so each component glyph is sheared on its own and a component at
    # offset (x, y) moves to (x + tan(13deg) * y, y). The mark therefore follows the slant of the letter it sits on.
    for g in font.getGlyphOrder():
        if g in custom_glyphs or glyf[g].isComposite():
            continue
        pen = TTGlyphPen(None)
        replay(rec[g], TransformPen(pen, (1, 0, SK, 1, 0, 0)))
        glyf[g] = pen.glyph()
        glyf[g].recalcBounds(glyf)
    # logotype letters were drawn as overlapping strokes (and the unions above leave cubic curves): flatten to quadratic
    for g in sorted(custom_glyphs):
        p = pathops.Path()
        replay(rec[g], TransformPen(p.getPen(), (1, 0, SK, 1, 0, 0)))
        p.simplify(fix_winding=True)
        tp = TTGlyphPen(None)
        p.draw(Cu2QuPen(tp, max_err=0.5, reverse_direction=True))
        glyf[g] = tp.glyph()
        glyf[g].recalcBounds(glyf)
    for g, cl in comps2.items():
        cg = glyf[g]
        assert cg.isComposite() and len(cg.components) == len(cl), g
        for c, (n, x, y) in zip(cg.components, cl):
            assert c.glyphName == n, (g, c.glyphName, n)
            c.x, c.y = round(x + SK * y), y
    # fontTools draws a glyph at (lsb - xMin), so the left side bearings must match the slanted outlines before overlaps are removed
    for g in font.getGlyphOrder():
        glyf[g].recalcBounds(glyf)
        hmtx[g] = (hmtx[g][0], getattr(glyf[g], "xMin", 0) if glyf[g].numberOfContours else 0)
    removeOverlaps(font)
    for g in font.getGlyphOrder():
        glyf[g].recalcBounds(glyf)
        adv, _ = hmtx[g]
        hmtx[g] = (adv, getattr(glyf[g], "xMin", 0) if glyf[g].numberOfContours else 0)

    # 6. exact pair kerning for the wordmark pairs --------------------------------------------
    pairs = []
    for a, b in zip(LETTERS, LETTERS[1:]):
        offset = (wm_x[b][0] - wm_x[a][0])              # wordmark ink-left to ink-left, upright
        offset -= (wm_x[a][2] - wm_x[a][0]) - (logo_x[a][2] - logo_x[a][0])   # a narrower a / m: the next letter moves up by as much
        lsb_a, lsb_b = base_side[a][0], base_side[b][0]
        kern = offset - new_adv[a] - lsb_b + lsb_a
        pairs.append((gname(a), gname(b), round(kern)))
    expected = {a + b: (wm_x[b][0] - wm_x[a][0]) - ((wm_x[a][2] - wm_x[a][0]) - (logo_x[a][2] - logo_x[a][0])) - base_side[b][0] + base_side[a][0] for a, b in zip(LETTERS, LETTERS[1:])}
    wordmark_pairs = {(a, b) for a, b, _ in pairs}
    # every other pair that involves a logotype letter: place it so the mean white in the x-height band equals what the
    # skeleton had for the same pair (the same measure the wordmark's own spacing uses), so h a l m i c sit evenly in text
    prof_old = {g: profile(rec0[g]) for g in font.getGlyphOrder() if g not in ("space", "nbspace", ".notdef")}
    prof_new = {g: profile(rec[g]) for g in prof_old}

    def mean_white(left, right, ln, rn):
        """mean over levels of (right glyph left edge - left glyph right edge), skipping levels where either is empty"""
        vals = [pr[0] - pl[1] for pl, pr in zip(left, right) if pl and pr]
        return sum(vals) / len(vals) if len(vals) >= 3 else None

    def skeleton_advance(a, b):
        buf = hb.Buffer()
        buf.add_str(chr(a) + chr(b))
        buf.guess_segment_properties()
        hb.shape(skeleton, buf, {"kern": True})
        return buf.glyph_positions[0].x_advance

    partners = [c for c in map(chr, UNICODES) if c.isalnum() or c in ".,:;!?-'’‘“”—–"]
    optical = []
    for L in LETTERS:
        for X in partners:
            for first, second in ((X, L), (L, X)):
                ga, gb = gname(first), gname(second)
                if ga not in prof_old or gb not in prof_old:
                    continue
                if first in LETTERS and second in LETTERS and (first, second) in {(a, b) for a, b in zip(LETTERS, LETTERS[1:])}:
                    continue
                m_old = mean_white(prof_old[ga], prof_old[gb], None, None)
                m_new = mean_white(prof_new[ga], prof_new[gb], None, None)
                if m_old is None or m_new is None:
                    continue
                d_old = skeleton_advance(ord(first), ord(second))
                kern = d_old + (m_old - m_new) - hmtx[ga][0]
                # clamp: never loosen a pair. The skeleton opens V-i, W-i etc. by about 44 units (room for its centred i dot
                # under a slanted arm); the logotype i's dot is not under the arm, and the slant already makes diagonals look loose
                kern = max(-150, min(0, kern))
                optical.append((ga, gb, round(kern)))
    merged = {(a, b): k for a, b, k in optical}
    merged.update({(a, b): k for a, b, k in pairs})      # the wordmark's own pairs win
    # accented forms of the logotype letters kern like their base (the pair measure is taken in the x-height band, where the marks are not)
    accented = {}
    for g, cl in comps2.items():
        if cl[0][0] in custom_bases:
            accented.setdefault(cl[0][0], []).append(g)
    accented[gname("i")] = accented.get(gname("i"), []) + ["dotlessi"] + accented.pop("dotlessi", [])   # ı and its marks kern like i
    extra = {}
    for (a, b), k in merged.items():             # accented glyph first in the pair, then second (so both accented works too)
        for ag in accented.get(a, []):
            extra[(ag, b)] = k
    merged.update(extra)
    extra = {}
    for (a, b), k in merged.items():
        for bg in accented.get(b, []):
            extra[(a, bg)] = k
    merged.update(extra)
    pairs = [(a, b, k) for (a, b), k in merged.items()]
    add_pair_kerns(font, pairs)
    print("wordmark pair kerns:", [(a, b, k) for a, b, k in pairs if (a, b) in wordmark_pairs], "; optical pair kerns:", len(optical))

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
    if SHIP:
        ship(woff2)


def ship(woff2):
    app = os.path.dirname(BRAND)
    fonts = os.path.join(app, "public", "fonts")
    h = hashlib.sha1(open(woff2, "rb").read()).hexdigest()[:8]
    name = f"halmic-display.{h}.woff2"
    for old in os.listdir(fonts):
        if re.fullmatch(r"halmic-display(\.[0-9a-f]{8})?\.woff2", old) and old != name:
            os.remove(os.path.join(fonts, old))
    shutil.copyfile(woff2, os.path.join(fonts, name))
    for rel in ("public/base.css", "build.mjs"):
        p = os.path.join(app, rel)
        src = open(p).read()
        new = re.sub(r"halmic-display(\.[0-9a-f]{8})?\.woff2", name, src)
        if rel == "public/base.css":
            new = re.sub(r'(font-family: "Halmic Display";[^}]*?unicode-range: )[^;]*;', lambda m: m.group(1) + unicode_range(woff2) + ";", new, count=1)
        if new != src:
            open(p, "w").write(new)
    print("shipped", name)
    print("unicode-range:", unicode_range(woff2))


def unicode_range(path):
    """CSS unicode-range for exactly the codepoints in the font's cmap"""
    cps = sorted(u for u in TTFont(path).getBestCmap() if u > 0x1F)
    runs = []
    for u in cps:
        if runs and u == runs[-1][1] + 1:
            runs[-1][1] = u
        else:
            runs.append([u, u])
    return ", ".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in runs)


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
