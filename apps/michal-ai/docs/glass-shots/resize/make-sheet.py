"""Builds width-change-frames.json and the SVG contact sheet from frame data recorded in the browser (see README line in the JSON)."""
import json, os

here = os.path.dirname(os.path.abspath(__file__))
# (frame, dom_px, glass_px); frame -1 is the settled state before the change
before = [(-1, 281.7, 281.7), (0, 500, 305.1), (1, 500, 313.6), (3, 500, 332), (8, 500, 377.8), (13, 500, 415.7), (18, 500, 443.8), (23, 500, 463.3), (28, 500, 476.4), (33, 500, 485), (38, 500, 490.5), (43, 500, 494.1)]
after = [(-1, 281.7, 281.7), (0, 500, 500), (1, 500, 500), (2, 500, 500), (3, 500, 500)]

json.dump(
    {
        "scenario": "nav content widens 281.7 -> 500px (late font, status chip, breakpoint); dark reading page, frost engine; frames stepped at 60fps with Field.update; dom = nav box (content and ::before sheen), glass = frost box width (same spring state as the canvas rim, tint and shadow)",
        "before_fix": [{"frame": k, "dom_px": d, "glass_px": s} for k, d, s in before],
        "after_fix": [{"frame": k, "dom_px": d, "glass_px": s} for k, d, s in after],
    },
    open(os.path.join(here, "width-change-frames.json"), "w"),
    indent=1,
)


def block(title, rows, y):
    out = ['<text x="10" y="%d" fill="#ebe7da" font-size="14">%s</text>' % (y, title)]
    y += 14
    for k, d, s in rows:
        cx = 700
        out.append('<text x="10" y="%d" fill="#a4ab99">frame %s</text>' % (y + 20, k if k >= 0 else "base"))
        out.append('<rect x="%.1f" y="%d" width="%.1f" height="28" rx="14" fill="none" stroke="#e5484d" stroke-width="2"/>' % (cx - s / 2, y, s))
        out.append('<rect x="%.1f" y="%d" width="%.1f" height="28" rx="14" fill="#ffffff" fill-opacity="0.12" stroke="#9cc68a" stroke-dasharray="4 3"/>' % (cx - d / 2, y, d))
        out.append('<text x="1010" y="%d" fill="#a4ab99">dom %.0f  glass %.0f  gap %.0f</text>' % (y + 19, d, s, abs(d - s)))
        y += 34
    return out, y


body = []
o, y = block("BEFORE: red = glass (frost box + canvas rim/shadow), green dashed = DOM box (content + sheen). Glass springs about 600ms behind.", before, 24)
body += o
o, y = block("AFTER: both layers land on the DOM box in the same frame.", after, y + 20)
body += o
svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="%d" font-family="monospace" font-size="12"><rect width="100%%" height="100%%" fill="#121612"/>%s</svg>' % (y + 20, "\n".join(body))
open(os.path.join(here, "width-change-contact-sheet.svg"), "w").write(svg)
