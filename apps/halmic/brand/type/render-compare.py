#!/usr/bin/env python3
"""Before/after specimen of two builds of Halmic Display (headless Chrome, no network).

Usage: python3 render-compare.py --before old.ttf --after new.ttf [--out shots.png] [--chrome PATH]
Left column: before; right column: after. Rows: running-text strings at 96px and 40px, dark on paper, then paper on ink.
Build a font to compare with: python3 build-display.py /some/dir   (writes halmic-display.ttf and .woff2 there).
"""
import argparse
import os
import subprocess
import tempfile

STRINGS = ["Want something made? Say hi.", "halmic productions", "Among Us", "Minecraft", "Taco Neko",
           "FIFA With the Boys", "Smash", "games", "amalgam mammal"]
SIZES = (96, 40)
PAPER, INK = "#f1ece1", "#0f0e13"


def panel(fam, bg, fg, sizes_strings):
    rows = "".join(f'<div style="font:900 {sz}px/1.12 {fam};white-space:nowrap">{t}</div>' for sz, ts in sizes_strings for t in ts)
    return f'<div style="background:{bg};color:{fg};padding:18px 28px">{rows}</div>'


def build(before, after):
    css = "".join(f'@font-face{{font-family:{n};src:url("file://{os.path.abspath(p)}");font-weight:900}}' for n, p in (("Before", before), ("After", after)))
    # 96px: the heading line, the two words that carry a and m, and the two 'm' stress words; 40px: the full list
    big = [STRINGS[0], STRINGS[1], STRINGS[8], STRINGS[2]]
    cols = []
    for fam, label in (("Before", "before"), ("After", "after")):
        cols.append(f'<div class="col"><div class="lab">{label}</div>'
                    + panel(fam, PAPER, INK, [(96, big), (40, STRINGS)])
                    + panel(fam, INK, PAPER, [(96, big[:2]), (40, STRINGS)]) + "</div>")
    return (f'<!doctype html><meta charset="utf-8"><style>{css}body{{margin:0;background:#777;width:3200px;font:600 18px system-ui;color:#fff}}'
            f'.cols{{display:flex;gap:16px;padding:16px}}.col{{flex:1}}.lab{{padding:0 0 8px}}</style><div class="cols">{"".join(cols)}</div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=3200)
    ap.add_argument("--height", type=int, default=1680)
    ap.add_argument("--chrome", default="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    a = ap.parse_args()
    page = os.path.join(tempfile.mkdtemp(prefix="halmic-compare-"), "compare.html")
    open(page, "w").write(build(a.before, a.after))
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
