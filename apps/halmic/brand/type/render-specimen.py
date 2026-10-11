#!/usr/bin/env python3
"""Render specimen.png: the current heading face against five open-source candidates (route A) and the derived
Halmic Display (route B). Fetches the candidate fonts into .cache/ (not committed), writes out/specimen.html and
shoots it with headless Chrome.

Usage: python3 render-specimen.py [--chrome "/path/to/chrome"] [--width 1560] [--height 6000]
Needs the built font: python3 build-display.py  (writes out/halmic-display.ttf)
"""
import argparse
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "out")
RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

FETCH = {
    "fredoka": ["Fredoka[wdth,wght].ttf"],
    "nunito": ["Nunito[wght].ttf"],
    "rubik": ["Rubik[wght].ttf"],
    "baloo2": ["Baloo2[wght].ttf"],
    "quicksand": ["Quicksand[wght].ttf"],
    "nunitosans": ["NunitoSans[YTLC,opsz,wdth,wght].ttf"],
    "geist": ["Geist[wght].ttf"],      # the previous site font, kept here only for the comparison
}


def fetch():
    for d, files in FETCH.items():
        os.makedirs(os.path.join(CACHE, d), exist_ok=True)
        for f in files:
            dest = os.path.join(CACHE, d, f)
            if os.path.exists(dest):
                continue
            for _ in range(8):
                try:
                    data = urllib.request.urlopen(RAW + d + "/" + urllib.parse.quote(f)).read()
                    open(dest, "wb").write(data)
                    break
                except Exception:
                    time.sleep(1)
            else:
                sys.exit(f"could not fetch {d}/{f}")


# family, css name, file, weight, tracking, note
OPTIONS = [
    dict(key="cur", name="Current: Geist 750", css="Geist", w=750, track="-.03em", skew=False,
         note="Geist, SIL OFL 1.1. Neutral grotesque with squared terminals and a tight negative tracking. Verdict: neutral next to the logotype. Squared terminals, upright, tight negative tracking: the wordmark is the only soft, slanted thing on the page."),
    dict(key="nun", name="A1 Nunito 900", css="NunitoA", w=900, track="0", skew=True,
         note="Nunito, OFL 1.1. Fully rounded terminals, closest in spirit and weight. Slanted 13 degrees by CSS. Verdict: closest sibling (round terminals, same weight, readable at any size). Only the slant is borrowed; its letters still differ from the wordmark (two-storey a, ordinary m)."),
    dict(key="fre", name="A2 Fredoka 700", css="FredokaA", w=700, track="0", skew=True,
         note="Fredoka, OFL 1.1. Chunky and playful, wide, bubbly; tops out at 700. Slanted by CSS. Verdict: too chunky and wide, reads as a kids' brand; a, g and the wide caps disagree with the logotype."),
    dict(key="bal", name="A3 Baloo 2 800", css="BalooA", w=800, track="0", skew=True,
         note="Baloo 2, OFL 1.1. Soft geometric with a tall x-height, tops out at 800. Slanted by CSS. Verdict: friendly with a tall x-height but visibly lighter than the wordmark at 800; the synthetic slant looks bolted on. A fine fallback, not a match."),
    dict(key="rub", name="A4 Rubik 800", css="RubikA", w=800, track="0", skew=True,
         note="Rubik, OFL 1.1. Softened corners rather than round terminals; the most 'UI' of the set. Slanted by CSS. Verdict: the most readable at small sizes, but its corners (not terminals) are softened, so the heavy weights go squarish. Closest to Geist's neutrality, so it fixes the least."),
    dict(key="qui", name="A5 Quicksand 700", css="QuicksandA", w=700, track="0", skew=True,
         note="Quicksand, OFL 1.1 (with a Reserved Font Name, so it cannot be a skeleton). Light, thin heaviest weight. Slanted by CSS. Verdict: fails the weight test. At 700 it is a light face beside a heavy wordmark; and it has a Reserved Font Name."),
    dict(key="hal", name="B Halmic Display", css="HalmicDisplay", w=900, track="0", skew=False,
         note="Derived from Nunito 900: logotype letters h a l m i c, 13 degree slant, matched stem and x-height, pair kerning from the wordmark. Verdict: same bar, lean and terminals as the wordmark; typing halmic reproduces the logo. Cost: the logo's M-shaped m and single-storey a are quirky in running words, so headings only."),
]

BODY = [
    ("Geist 400 (current)", "Geist", 400),
    ("Nunito Sans 400", "NunitoSansA", 400),
    ("Nunito 400", "NunitoA", 400),
    ("Rubik 400", "RubikA", 400),
]

LEDE = "I stream games, code stupid things, and design stuff."
PARA = ("My friends, a FIFA lobby and a lot of bad shots, cut down to the funny parts. "
        "New episodes land when they are ready, and the full catalogue sits one click below.")
NUMS = "0123456789 &middot; 1,284 plays &middot; 10:19 &middot; Sep 2025 &middot; Episode 4 of 12"
HEADS = ["Videos", "FIFA With the Boys", "Episode 4, the latest", "Little games", "Design, mostly logos"]


def css():
    c = []
    def ff(name, d, f, weights):
        c.append("@font-face{font-family:%s;src:url('%s');font-weight:%s}" % (name, "file://" + os.path.join(CACHE, d, f), weights))
    ff("Geist", "geist", "Geist[wght].ttf", "100 900")
    ff("NunitoA", "nunito", "Nunito[wght].ttf", "200 1000")
    ff("FredokaA", "fredoka", "Fredoka[wdth,wght].ttf", "300 700")
    ff("BalooA", "baloo2", "Baloo2[wght].ttf", "400 800")
    ff("RubikA", "rubik", "Rubik[wght].ttf", "300 900")
    ff("QuicksandA", "quicksand", "Quicksand[wght].ttf", "300 700")
    ff("NunitoSansA", "nunitosans", "NunitoSans[YTLC,opsz,wdth,wght].ttf", "200 1000")
    c.append("@font-face{font-family:HalmicDisplay;src:url('%s');font-weight:900}" % ("file://" + os.path.join(OUT, "halmic-display.ttf")))
    return "\n".join(c)


def wordmark(h):
    svg = open(os.path.join(BRAND, "svg", "wordmark-c-paper.svg")).read()
    return svg.replace("<svg ", '<svg style="height:%dpx;width:auto;display:block" ' % h, 1)


def card(o):
    skew = "transform:skewX(-13deg);transform-origin:0 100%;display:inline-block;" if o["skew"] else ""
    fam = "font-family:%s;font-weight:%d;letter-spacing:%s;" % (o["css"], o["w"], o["track"])
    body = "font-family:NunitoSansA;" if o["key"] != "cur" else "font-family:Geist;"
    heads = "".join('<div style="%s%s font-size:30px;line-height:1.15;margin:4px 0"><span style="%s%s">%s</span></div>' % (fam, "", skew, "", h) for h in HEADS[:3])
    return f"""
<section class="card">
  <div class="main">
    <h2>{o['name']}</h2><p class="note">{o['note']}</p>
    <div class="row" style="display:flex;align-items:flex-end;gap:28px">{wordmark(64)}
      <div style="{fam}font-size:34px;line-height:1.12;max-width:560px"><span style="{skew}">{LEDE}</span></div></div>
    <div class="row">{heads}</div>
    <div class="row nav" style="{body}">stream &nbsp; videos &nbsp; games &nbsp; design &nbsp; say hi &nbsp;
      <span class="btn" style="{body}">Watch on Twitch</span></div>
    <div class="row" style="{body}font-size:16px;line-height:1.55;max-width:560px">{PARA}<br><span style="font-variant-numeric:tabular-nums">{NUMS}</span></div>
    <div class="row" style="{fam}font-size:44px;font-variant-numeric:tabular-nums"><span style="{skew}">2022 &middot; 1,284 &middot; 10:19 &middot; halmic</span></div>
  </div>
  <div class="phone">
    <div class="wm">{wordmark(52)}</div>
    <div style="{fam}font-size:22px;line-height:1.15;margin-top:14px"><span style="{skew}">{LEDE}</span></div>
    <div class="btn" style="{body}margin-top:16px">Watch on Twitch</div>
    <div style="{fam}font-size:26px;line-height:1.1;margin-top:22px"><span style="{skew}">Videos</span></div>
    <div style="{body}font-size:15px;color:#a29eae;margin-top:6px">My friends, a FIFA lobby and a lot of bad shots.</div>
  </div>
</section>"""


def bodies():
    rows = "".join(
        f'<div class="bcol"><h3>{n}</h3><p style="font-family:{f};font-weight:{w};font-size:16px;line-height:1.55;margin:0">{PARA}<br>'
        f'<span style="font-variant-numeric:tabular-nums">{NUMS}</span><br>Hamburgefonstiv 1lI0O rnm cl vv</p>'
        f'<p style="font-family:{f};font-weight:{w};font-size:13px;color:#a29eae;margin:8px 0 0">13px caption: last stream, Sep 2025 &middot; 4 episodes &middot; 6 games</p></div>'
        for n, f, w in BODY)
    return f'<section class="card"><div class="main" style="width:100%"><h2>Body faces at 16px</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">{rows}</div></div></section>'


def text_css():
    c = [css()]
    c.append("@font-face{font-family:HalmicText;src:url('%s');font-weight:400 800}" % ("file://" + os.path.join(OUT, "halmic-text-latin.woff2")))
    return "\n".join(c)


FACES = [("Halmic Text 400", "HalmicText", 400), ("Nunito Sans 400", "NunitoSansA", 400), ("Geist 400 (previous)", "Geist", 400)]
CONF = "Il1| O0 rn m cl d a o g q 9 &#8216;&#8217; &#8220;&#8221; &hellip; &ndash; &mdash; ( ) [ ] / &amp; @ #"
LATEXT = "&#321;&oacute;d&#378;, &Aring;ngstr&ouml;m, &#268;e&scaron;tina, fa&ccedil;ade, &ntilde;and&uacute;, &#350;&#304;&#286;, &#258;&#7871;&#7881;"
NAV = "stream &nbsp;&nbsp; videos &nbsp;&nbsp; games &nbsp;&nbsp; design &nbsp;&nbsp; say hi"


def para_col(label, fam, w, dark):
    fg, mute = ("#f1ece1", "#a29eae") if dark else ("#0f0e13", "#5d5848")
    paras = "".join(f'<p style="font-size:{s}px;line-height:1.55;margin:0 0 10px">{PARA}</p>' for s in (14, 16, 18))
    return f"""<div class="tcol" style="font-family:{fam};font-weight:{w};color:{fg}">
  <h3 style="font-family:NunitoSansA;color:{'#7fa6ff' if dark else '#1d4fe0'}">{label}</h3>{paras}
  <p style="font-size:16px;margin:0 0 8px;letter-spacing:.02em">{CONF}</p>
  <p style="font-size:15px;margin:0 0 8px;color:{mute}">{NAV}</p>
  <p style="font-size:13px;margin:0 0 8px;color:{mute}">Caption: last stream Sep 2025 &middot; 4 episodes &middot; 6 games &middot; <em>emphasised</em> and <b>bold</b></p>
  <p style="font-size:16px;margin:0 0 8px;font-variant-numeric:tabular-nums">1111 8888 0123456789<br>1,284 plays &middot; 10:19 &middot; 3.14 &middot; 2022&ndash;2026</p>
  <p style="font-size:15px;margin:0">{LATEXT}</p></div>"""


def text_section():
    dark = "".join(para_col(l, f, w, True) for l, f, w in FACES)
    light = "".join(para_col(l, f, w, False) for l, f, w in FACES)
    return f"""<section class="card" style="display:block"><h2>Halmic Text against Nunito Sans and Geist, 14 / 16 / 18px</h2>
<p class="note">Halmic Text is Nunito (upright, weight 400 to 800, spacing and kerning untouched). em and b show the 700 weight; no synthetic italic.</p>
<div class="tgrid" style="background:#0f0e13">{dark}</div><div class="tgrid" style="background:#f1ece1;margin-top:0">{light}</div></section>"""


def slant_section():
    rows = "".join(
        f'<div style="margin:10px 0;font:400 16px/1.55 HalmicText;max-width:640px"><span style="font:700 12px NunitoSans A;color:#7fa6ff">{d}&deg; </span>'
        f'<span style="display:inline-block;transform:skewX(-{d}deg);transform-origin:0 100%">{PARA}</span></div>'
        for d in (0, 3, 5, 13)).replace("NunitoSans A", "NunitoSansA")
    return f'<section class="card" style="display:block"><h2>Slant test on the text face (CSS skew): 0, 3, 5, 13 degrees</h2><div style="width:700px">{rows}</div></section>'


def together_section():
    wm = wordmark(70)
    hero = f"""<div class="mock"><div class="wm" style="margin-bottom:16px">{wm}</div>
  <div style="font:750 32px/1.05 HalmicDisplay">halmic productions</div>
  <div style="font:500 20px/1.35 HalmicText;margin-top:8px;max-width:30ch">An assortment of various somewhat creative work I&rsquo;ve done.</div>
  <div style="margin-top:16px;font:700 16px HalmicText"><span class="btn" style="font:700 16px HalmicText;margin:0">Watch on Twitch</span> <span class="btn" style="font:600 16px HalmicText;background:none;color:#f1ece1;border:1px solid #2c2938">See what I&rsquo;ve made</span></div></div>"""
    card_ = """<div class="mock"><div style="aspect-ratio:16/9;background:#23202e;border-radius:18px;position:relative"><span style="position:absolute;left:14px;top:12px;background:#0f0e13c7;border-radius:99px;padding:2px 12px;font:700 18px HalmicDisplay">4</span></div>
  <div style="font:750 24px/1.1 HalmicDisplay;margin-top:14px">Episode 4, the latest</div>
  <div style="font:400 14px HalmicText;color:#a29eae;margin-top:6px">10:19 &middot; Sep 2025</div>
  <div style="font:400 16px/1.5 HalmicText;margin-top:10px">My friends, a FIFA lobby and a lot of bad shots, cut down to the funny parts.</div></div>"""
    rows = [("Episode 4, the latest", "10:19 &middot; Sep 2025"), ("Episode 3", "10:42 &middot; Oct 2022"), ("Episode 2", "9:18 &middot; Aug 2022"), ("Special Force 1: Origins", "6:02 &middot; 2021")]
    lst = '<div class="mock"><div style="font:750 28px/1.1 HalmicDisplay;margin-bottom:10px">Videos</div>' + "".join(
        f'<div style="display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid #2c2938"><span style="font:750 18px HalmicDisplay">{a}</span><span style="font:400 14px HalmicText;color:#a29eae;white-space:nowrap">{b}</span></div>' for a, b in rows) + "</div>"
    return f'<section class="card" style="display:block"><h2>Display + Text together: hero, video card, list</h2><div style="display:flex;gap:28px;align-items:flex-start;margin-top:10px">{hero}{card_}{lst}</div></section>'


def html_text():
    return f"""<!doctype html><meta charset="utf-8"><title>halmic text specimen</title>
<style>{text_css()}
body{{margin:0;background:#0f0e13;color:#f1ece1;font:15px/1.4 NunitoSansA,sans-serif;padding:28px 32px;width:1496px}}
h1{{font:700 20px NunitoSansA;margin:0 0 4px}} h2{{font:700 17px NunitoSansA;margin:0;color:#7fa6ff}} h3{{font:700 13px NunitoSansA;margin:0 0 8px}}
em{{font-style:normal;font-weight:700}} .note{{margin:2px 0 14px;color:#a29eae;font-size:13px}}
.card{{border-top:1px solid #2c2938;padding:20px 0}}
.tgrid{{display:grid;grid-template-columns:repeat(3,1fr);gap:0}} .tcol{{padding:20px 24px}}
.mock{{width:440px;border:1px solid #2c2938;border-radius:18px;padding:20px;background:#0f0e13}} .mock .wm svg{{max-width:100%}}
.btn{{display:inline-block;background:#3d7bff;color:#0f0e13;padding:9px 18px;border-radius:999px}}
</style>
<h1>halmic text specimen: Halmic Text with Halmic Display</h1>
{text_section()}{slant_section()}{together_section()}
"""


def html():
    return f"""<!doctype html><meta charset="utf-8"><title>halmic type specimen</title>
<style>{css()}
body{{margin:0;background:#0f0e13;color:#f1ece1;font:15px/1.4 NunitoSansA,sans-serif;padding:28px 32px;width:1496px}}
h1{{font:700 20px NunitoSansA;margin:0 0 4px}} h2{{font:700 17px NunitoSansA;margin:0;color:#7fa6ff}} h3{{font:700 13px NunitoSansA;margin:0 0 6px;color:#7fa6ff}}
.note{{margin:2px 0 14px;color:#a29eae;font-size:13px}}
.card{{display:flex;gap:40px;border-top:1px solid #2c2938;padding:20px 0}}
.main{{width:900px}} .row{{margin:12px 0}}
.nav{{font-size:15px;color:#a29eae}} .btn{{display:inline-block;background:#3d7bff;color:#0f0e13;font-weight:700;padding:9px 18px;border-radius:999px;margin-left:8px}}
.phone{{width:343px;height:auto;border:1px solid #2c2938;border-radius:18px;padding:16px;background:#0f0e13;align-self:flex-start;overflow:hidden}}
.wm svg{{max-width:100%}}
</style>
<h1>halmic type specimen: current vs candidates vs derived display face</h1>
<p class="note">Right column: a 375px-wide hero. Body text in the A and B cards is Nunito Sans 400; the current card keeps Geist. Wordmark shown for scale.</p>
{''.join(card(o) for o in OPTIONS)}
{bodies()}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ap.add_argument("--width", type=int, default=1560)
    ap.add_argument("--height", type=int, default=4420)
    ap.add_argument("--part", choices=["faces", "text"], default="faces",
                    help="faces: current vs candidates vs Halmic Display (specimen.png); text: Halmic Text block (specimen-text.png)")
    ap.add_argument("--out")
    a = ap.parse_args()
    a.out = a.out or os.path.join(HERE, "specimen.png" if a.part == "faces" else "specimen-text.png")
    fetch()
    # the page holds absolute file:// font paths, so it lives in a temp dir, never inside the repo
    page = os.path.join(tempfile.mkdtemp(prefix="halmic-specimen-"), "specimen.html")
    open(page, "w").write(html() if a.part == "faces" else html_text())
    subprocess.run([a.chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={a.width},{a.height}", f"--screenshot={a.out}", "file://" + page], check=True)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
