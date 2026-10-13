# Hero reel

A silent, slow-motion highlights loop that plays behind the home-page hero (`public/hero.js` draws it through a shader).
Everything in it is the owner's own published work: his YouTube channel and his Twitch clips. No source footage is kept in the repo, only the rendered loop.

Twelve moments (robot arena, onboard racing, FIFA, a Valorant clutch, Smash, and action shots from the Special Force short films), 0.5x slow motion, 24 fps, one seamless loop of about 28.5 s. No audio track in any file. Title and credit cards (real names) are never used; crops also cut HUD text, captions and facecams.

Outputs (in `public/hero/`):

| file | what | use |
| --- | --- | --- |
| `reel-1080.webm` | VP9, 1920x1080 | canvas 1400+ device px wide, not 2g/3g/save-data |
| `reel-720.webm` | VP9, 1280x720 | other landscape screens |
| `reel-m.webm` | VP9, 540x960 portrait, framed per moment | phones and tall boxes |
| `reel-720.mp4`, `reel-m.mp4` | H.264, `+faststart` | Safari / iOS and anything that cannot play VP9 |
| `reel-poster.jpg`, `reel-poster-m.jpg` | one calm, recognisable frame | reduced-motion / save-data / no-WebGL / refused-autoplay fallback (CSS gives it the duotone) |

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

## What the script does

`edl.json` holds `fps`, `speed` (0.5), `srcSeconds` (1.4 s of source per moment, so 67 frames), `crossfadeFrames` (10), `poster` (`[moment, frames in]`) and the moments. Each moment has two crops in a 1280x720 reference frame, scaled to the real source size: `crop` (16:9) and `pcrop` (9:16, framed so the subject stays inside the centre of a phone). Crops never include HUD text, scoreboards or name bars.

Per moment and per variant (landscape 1920x1080, portrait 540x960):

```
ffmpeg -ss <in> -t 1.6 -i <src>.mp4 -an \
  -vf "crop=<scaled crop>,scale=<size>:flags=lanczos,lutyuv=<exposure stretch>,setpts=PTS/0.5,\
       minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,\
       eq=saturation=0.9:contrast=1.06,curves=all='0/0.045 0.3/0.25 0.7/0.68 1/0.93',unsharp=5:5:0.7:3:3:0,hqdn3d=1.2:1.2:5:5,format=yuv420p" \
  -frames:v 67 -c:v libx264 -preset fast -crf 6 seg<L|P><i>.mp4
```

The exposure stretch maps each moment's 10th and 90th luminance percentiles (ffmpeg `signalstats`) to black and white, so a dark arena and a bright game screen sit at the same level. There is no pre-blur: the shader (not the video) makes the footage dark, so the files keep their edges and chroma. The grade only lifts black to the ink colour, adds a gentle S, a light unsharp and a little denoise (which also saves bytes).

Crossfades: twelve 10-frame `xfade` dissolves in one chain with the first moment repeated at the end. One full cycle is then cut out starting 10 frames in, so the last frame leads straight into the first. The landscape and portrait loops are built the same way and have the same length.

Encodes (all `-an`): `libvpx-vp9 -b:v 0 -crf 40/38/38 -row-mt 1 -deadline good -cpu-used 1 -g 96` for 1080 / 720 / mobile, `libx264 -preset slow -profile:v high -crf 29/30 -movflags +faststart` for the mp4s, one `select` frame each for the posters.

## How hero.js picks a file

Portrait cut when the hero box is taller than wide (or the viewport is 700 px or narrower); otherwise landscape. Landscape uses `reel-1080.webm` only when the canvas is at least 1400 device px wide (capped at 1920) and the connection is not 2g/3g/save-data. WebKit (iOS, Safari) and anything where `canPlayType('video/webm; codecs="vp9"')` is empty gets the mp4. If `play()` is refused, or no frame is decoded in 6 s, the poster still stays.

## Crop rules

Crops exclude HUD text, scoreboards, captions, credits and facecams. Do not add moments with readable names, other people's faces in the foreground, or logos filling the frame. Look at contact sheets of the final renders at full resolution before committing: higher definition makes text legible that was not before.
