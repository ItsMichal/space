# Hero reel

A silent, slow-motion highlights loop that plays behind the home-page hero (`public/hero.js` draws it through a shader).
Everything in it is the owner's own published work: his YouTube channel and his Twitch clips. No source footage is kept in the repo, only the rendered loop.

Twelve moments picked to read through a halftone as a background: the whole Robomaster arena from above (twice), two onboard racing bends (bright sky and track against a black hoop), wall-runs and a scuffle from the Special Force short films (dark silhouettes on lit walls), a FIFA broadcast shot and an overhead scramble, two Smash Ultimate moments on a lit stage, and the Project Mountaintop rhythm-game screen. 0.5x slow motion, 24 fps, one seamless loop of about 28.5 s. No audio track in any file. Title and credit cards (real names) are never used; crops also cut HUD text, captions, name tags and facecams. Dropped for legibility: the VALORANT clip (spectator overlay with names on every frame, 720p), the dark hallway Special Force shots, the FIFA centre-circle shot, tight crops of the arena.

Framing: the landscape crop is the widest clean region of each source (usually the whole frame minus HUD strips), and the shader adds only a 3% cover overscan (it was 6%, plus more drift). The portrait cut is NOT a 9:16 slice any more: the `pcrop` (any aspect, mostly the same wide region) is laid across the phone frame at full width with its centre at `pc` (default 0.295 of the 960 px height, which is the open window above the wordmark on a phone: see `WIN_UP` in `hero.js`), feathered into a dark blurred copy of itself that fills the rest. Whole scene on a phone, subject above the wordmark.

Outputs (in `public/hero/`):

| file | what | use |
| --- | --- | --- |
| `reel-1080.webm` | VP9, 1920x1080 | canvas 1400+ device px wide, not 2g/3g/save-data |
| `reel-720.webm` | VP9, 1280x720 | other landscape screens |
| `reel-m.webm` | VP9, 540x960 portrait, framed per moment | phones and tall boxes |
| `reel-720.mp4`, `reel-m.mp4` | H.264, `+faststart` | Safari / iOS and anything that cannot play VP9 |
| `reel-poster.jpg`, `reel-poster-m.jpg` | the REAL hero render (the shader's glyph screen, quiet zones and all) of one representative frame, baked by `bake-poster.mjs` | reduced-motion / save-data / no-WebGL, and the temporary fallback (video error, refused autoplay, stalled source, lost context). No CSS filter: it already looks like the effect |

## Rebuild

1. Get the sources (video only, up to 1080p, into a fresh directory outside the repo). `edl.json` lists each one: `src` is the file name to use, `id` the YouTube video id or Twitch clip slug.
   ```
   python3 -m venv $TMPDIR/ytvenv && $TMPDIR/ytvenv/bin/pip install yt-dlp
   yt-dlp -P $REEL_SRC -f "bv*[height<=1080][ext=mp4]/bv*[height<=1080]" -o "yt-%(id)s.%(ext)s" https://www.youtube.com/watch?v=<id>
   yt-dlp -P $REEL_SRC -f "bv*[height<=1080]/best[height<=1080]" -o "tw-%(id)s.%(ext)s" https://www.twitch.tv/halmictv/clip/<slug>   # Twitch names files by numeric id
   ```
   Source ids used: YouTube `Et47QCJ3-3g pl6lJAYPLgc 2jM2QSTSte4 N7HKj1dYZjU qVEDjNc5Gmg IIJVKHEtawU`; Twitch `GlamorousFrozenStorkBloodTrail` (saved as `tw-3935634116`) and `MistySleepyNuggetsWOOP` (`tw-3298804610`).
2. `REEL_SRC=<dir> node apps/halmic/brand/reel/build-reel.mjs`
   Optional env: `REEL_TMP` (scratch, default a temp dir; needs a few GB), `REEL_ONLY=3,5` (re-cut only those moments, reuse the rest from `REEL_TMP`), `REEL_SKIP_ENC=1`, `CRF1080 CRF720 CRFM CRFMP4 CRFMMP4`, `POSTER_Q`.

Then bake the posters from the real render (needs Chrome, `ws` and `sharp` from the root `node_modules`, and a server on the built site):
```
PORT=4563 node apps/halmic/serve.mjs &
node apps/halmic/brand/reel/bake-poster.mjs http://localhost:4563     # POSTER_Q (default 62), POSTER_W (default 1280), BAKE_FRAMES (default 90)
```
It loads the hero at 1440x900 and 390x844, freezes the video on the `poster` frame, lets the eased passes settle, hides everything but the reel box and screenshots it.

## What the script does

`edl.json` holds `fps`, `speed` (0.5), `srcSeconds` (1.4 s of source per moment, so 67 frames), `crossfadeFrames` (10), `poster` (`[moment, frames in]`) and the moments. Each moment has two crops in a 1280x720 reference frame, scaled to the real source size: `crop` (16:9, landscape) and `pcrop` (any aspect, portrait; optional `pc` = vertical centre as a fraction of the 960 px height). Crops never include HUD text, scoreboards, name tags or name bars. `REEL_VARIANT=L|P` cuts only one variant.

Per moment, landscape (1920x1080):

```
ffmpeg -ss <in> -t 1.6 -i <src>.mp4 -an \
  -vf "crop=<scaled crop>,scale=1920:1080:flags=lanczos,lutyuv=<exposure stretch>,setpts=PTS/0.5,\
       minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,\
       eq=saturation=0.9:contrast=1.06,curves=all='0/0.045 0.3/0.25 0.7/0.68 1/0.93',unsharp=5:5:0.7:3:3:0,hqdn3d=1.2:1.2:5:5,format=yuv420p" \
  -frames:v 67 -c:v libx264 -preset fast -crf 6 segL<i>.mp4
```

Portrait (540x960) uses a filter graph instead of the plain crop: the exposure-stretched `pcrop` is split; one copy is scaled to cover 540x960, boxblurred and darkened (`eq=brightness=-0.32`), the other is scaled to width 540, given a 44 px alpha feather top and bottom (`geq`), and overlaid with its centre at `pc`; the same slow-motion and grade chain follows. Each cut takes several minutes (`minterpolate` at 1080p): the whole pipeline is about half an hour.

The exposure stretch maps each moment's 10th and 90th luminance percentiles (ffmpeg `signalstats`) to black and white, so a dark arena and a bright game screen sit at the same level. There is no pre-blur: the shader (not the video) makes the footage dark, so the files keep their edges and chroma. The grade only lifts black to the ink colour, adds a gentle S, a light unsharp and a little denoise (which also saves bytes).

Crossfades: twelve 10-frame `xfade` dissolves in one chain with the first moment repeated at the end. One full cycle is then cut out starting 10 frames in, so the last frame leads straight into the first. The landscape and portrait loops are built the same way and have the same length.

Encodes (all `-an`): `libvpx-vp9 -b:v 0 -crf 40/38/38 -row-mt 1 -deadline good -cpu-used 1 -g 96` for 1080 / 720 / mobile, `libx264 -preset slow -profile:v high -crf 29/30 -movflags +faststart` for the mp4s, one `select` frame each for the posters.

Size budgets for the five video files are enforced by `scripts/check-links.mjs` (`npm test -w @space/halmic`).

## How hero.js picks a file

Portrait cut when the hero box is taller than wide (or the viewport is 700 px or narrower); otherwise landscape. Landscape uses `reel-1080.webm` only when the canvas is at least 1400 device px wide (capped at 1920) and the connection is not 2g/3g/save-data. WebKit (iOS, Safari) and anything where `canPlayType('video/webm; codecs="vp9"')` is empty gets the mp4. Resizing never tears the pipeline down: a different file (portrait/landscape, 1080/720, both with hysteresis) is swapped in place while the last good frame stays on screen (see the resize contract in `apps/halmic/AGENTS.md`). If `play()` is refused or the source decodes nothing for 8 s, the poster shows temporarily and the reel retries.

## Crop rules

Crops exclude HUD text, scoreboards, captions, credits, username tags and facecams. Do not add moments with readable names, other people's faces in the foreground, or logos filling the frame. Choose for legibility as a background: a clear silhouette against a brighter field, strong colour or motion, readable at a glance as 6 px capsules; skip dark, muddy or one-toned footage. Look at contact sheets of the final renders at full resolution before committing: higher definition makes text legible that was not before.
