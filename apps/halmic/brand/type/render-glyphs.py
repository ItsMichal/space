#!/usr/bin/env python3
"""Glyph-coverage specimen of two builds of Halmic Display (headless Chrome, no network).

Usage: python3 render-glyphs.py --before old.ttf --after new.ttf --out shots.png [--chrome PATH] [--extra]
Left column: before; right column: after. Each test string at 72px, dark on paper, then paper on ink. A glyph the font
lacks falls back to the system font (the "before" column shows what the site did). --extra adds an accent-by-accent grid.
"""
import argparse
import os
import subprocess
import tempfile

STRINGS = ["L'évasion du Criminel de sa Prison", "L’évasion", "Pokémon Phoenix Rising", "Café déjà vu — naïve façade",
           "Señor Suavez’s tacos →", "“quotes” & ‘quotes’", "Æther Øre Straße"]
GRID = ["àáâäãåāăą ÀÁÂÄÃÅ", "ìíîïĩīĭį ÌÍÎÏ", "çćĉċč ÇĆČ", "ĥħ ĺļľŀł Ĥ Ĺ Ľ", "ḿ ń ñ ň m ÿ ý ž ź ż", "ıİ ← ↑ → ↓ ·×…–—"]
PAPER, INK = "#f1ece1", "#0f0e13"


def panel(fam, bg, fg, rows, size):
    body = "".join(f'<div style="font:900 {size}px/1.14 {fam};white-space:nowrap">{t}</div>' for t in rows)
    return f'<div style="background:{bg};color:{fg};padding:14px 24px">{body}</div>'


def build(before, after, extra, width=2400):
    css = "".join(f'@font-face{{font-family:{n};src:url("file://{os.path.abspath(p)}");font-weight:900}}' for n, p in (("Before", before), ("After", after)))
    cols = []
    for fam, label in (("Before", "before"), ("After", "after")):
        parts = [panel(fam + ",Arial", PAPER, INK, STRINGS, 72), panel(fam + ",Arial", INK, PAPER, STRINGS, 72)]
        if extra:
            parts.append(panel(fam + ",Arial", PAPER, INK, GRID, 72))
        cols.append(f'<div class="col"><div class="lab">{label}</div>' + "".join(parts) + "</div>")
    return (f'<!doctype html><meta charset="utf-8"><style>{css}body{{margin:0;background:#777;width:{width}px;font:600 18px system-ui;color:#fff}}'
            f'.cols{{display:flex;gap:16px;padding:16px}}.col{{flex:1}}.lab{{padding:0 0 8px}}</style><div class="cols">{"".join(cols)}</div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--extra", action="store_true")
    ap.add_argument("--width", type=int, default=2400)
    ap.add_argument("--height", type=int, default=1500)
    ap.add_argument("--chrome", default="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    a = ap.parse_args()
    page = os.path.join(tempfile.mkdtemp(prefix="halmic-glyphs-"), "glyphs.html")
    open(page, "w").write(build(a.before, a.after, a.extra, a.width))
    cmd = [a.chrome, "--headless=new", "--user-data-dir=" + tempfile.mkdtemp(prefix="halmic-chrome-"), "--disable-gpu", "--hide-scrollbars",
           "--force-device-scale-factor=1", f"--window-size={a.width},{a.height}", f"--screenshot={a.out}", "file://" + page]
    try:   # headless Chrome sometimes lingers after writing the screenshot
        subprocess.run(cmd, check=True, timeout=60)
    except subprocess.TimeoutExpired:
        if not os.path.exists(a.out):
            raise
    print("wrote", a.out)


if __name__ == "__main__":
    main()
