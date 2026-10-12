# Hover previews

Silent ~4 s loops that cross-fade over a video or clip tile's thumbnail on hover / keyboard focus (`public/app.js`, "hover previews").
Everything in them is the owner's own published work (YouTube channel, Twitch clips). No source footage is kept in the repo, only the rendered loops in `public/previews/`.

Output per id: `<videoId>.webm` (VP9, CRF about 40, 480x270, 24 fps; the two Special Force films are 640x360) and `<videoId>.mp4` (H.264, +faststart); Twitch clips are `clip-<clipId>.webm|.mp4`. No audio.
`public/previews/index.json` (written by `build.mjs` from the directory listing; ids with both files) tells the browser which tiles have a preview; a tile without one has no hover effect.

## Rebuild

1. Sources: video only, at most 480p, into a fresh directory. `edl.json` has the ids; files are named `yt-<id>.mp4` and `clip-<slug>.mp4`.
   ```
   python3 -m venv $TMPDIR/ytvenv && $TMPDIR/ytvenv/bin/pip install yt-dlp
   yt-dlp -P $SRC -f "bv*[height<=480][ext=mp4]/bv*[height<=480]" -o "yt-%(id)s.%(ext)s" "https://www.youtube.com/watch?v=<id>"
   yt-dlp -P $SRC -f "bv*[height<=480]/best[height<=480]/worst" -o "clip-<slug>.%(ext)s" "https://www.twitch.tv/halmictv/clip/<slug>"
   ```
   (no cookies, no browser session; hosts: youtube.com, googlevideo.com, twitch.tv and its CDNs.)
2. `PREVIEW_SRC=$SRC node apps/halmic/brand/previews/build-previews.mjs [id ...]`, then `npm run build:halmic` (writes `previews/index.json`).
   Env: `CRF`, `CRFMP4` override the quality. Budget: webm at most 220 KB (lead films 450), mp4 at most 300 KB, all previews under 6 MB; `scripts/check-links.mjs` enforces it.

## What the script does

Videos: three moments of 1.3 s (`ranges` in `edl.json`, seconds into the source), optionally cropped (`crop` is ffmpeg `w:h:x:y`), scaled to cover 480x270 (640x360 for `big`), 24 fps, hard-cut together with `concat` (the loop is last cut -> first cut). Clips: one 3 s segment (`start`), cropped to the game area.

```
ffmpeg -ss <t1> -t 1.3 -i src -ss <t2> -t 1.3 -i src -ss <t3> -t 1.3 -i src -filter_complex \
  "[0:v]crop=..,scale=480:270:force_original_aspect_ratio=increase,crop=480:270,fps=24[v0]; ... [v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[o]" \
  -map "[o]" -an -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 -deadline good -cpu-used 1 -g 48 <id>.webm
  (same filter) -c:v libx264 -preset slow -profile:v high -crf 33 -movflags +faststart <id>.mp4
```

## Identity rules

The Special Force 2 opening credit cards (about 0:55 to 1:45) show real names: no range touches them. FIFA episodes 1 to 3 have a top-bar HUD card with a surname and a bottom strip: both are cropped off, and menu screens and legible jersey names are avoided. Twitch clips with a facecam or a handle overlay are cropped to the game area; clips where that cannot be done cleanly are skipped (`excluded` in `edl.json`). Every loop was checked frame by frame on a contact sheet before it was committed.
