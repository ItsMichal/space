# Hero reel

A silent, slow-motion highlights loop that plays behind the home-page hero (`public/hero.js` draws it through a shader).
Everything in it is the owner's own published work: his YouTube channel and his Twitch clips. No source footage is kept in the repo, only the rendered loop.

Output (in `public/hero/`): `reel-720.webm` (VP9, 1280x720), `reel-720.mp4` (H.264, Safari fallback), `reel-540.webm` (960x540, phones), `reel-poster.jpg` (calm frame, used by the reduced-motion / no-WebGL fallback). No audio track in any of them.

## Rebuild

1. Get the sources (video only, at most 720p, into a fresh directory). `edl.json` lists each one: `src` is the file name to use, `id` the YouTube video id or Twitch clip slug.
   ```
   python3 -m venv $TMPDIR/ytvenv && $TMPDIR/ytvenv/bin/pip install yt-dlp
   yt-dlp -P $REEL_SRC -f "bv*[height<=720][ext=mp4]/bv*[height<=720]" -o "yt-%(id)s.%(ext)s" https://www.youtube.com/watch?v=<id>
   yt-dlp -P $REEL_SRC -f "bv*[height<=720]/best[height<=720]" -o "tw-%(id)s.%(ext)s" https://www.twitch.tv/halmictv/clip/<slug>   # Twitch names files by numeric id
   ```
   (Twitch: Glamorous... is `tw-3935634116`, Misty... is `tw-3298804610`.)
2. `REEL_SRC=<dir> node apps/halmic/brand/reel/build-reel.mjs`
   (optional env: `CRF720`, `CRF540`, `CRFMP4`, `POSTER_FRAME`, `POSTER_Q`, `REEL_TMP`).

## What the script does (the ffmpeg commands)

Per moment, 1.5 s of source:

```
ffmpeg -ss <in> -t 1.7 -i <src>.mp4 -an \
  -vf "crop=<w:h:x:y>,scale=1280:720:flags=lanczos,setpts=PTS/0.45,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,\
       eq=saturation=0.25,curves=all='0/0.055 0.3/0.2 0.6/0.42 1/0.64',colorchannelmixer=rr=0.92:gg=0.95:bb=1.08,gblur=sigma=2.2,format=yuv444p" \
  -frames:v 80 -c:v ffv1 seg<i>.mkv
```

Speed is 45 % (so 80 frames at 24 fps per moment). The grade lifts black to the ink colour (#0f0e13 is about 0.059), caps highlights near 0.64, drops saturation to a quarter, tints slightly toward blue and softens, so the shader has little left to do and the poster already looks on-brand.

Crossfades: ten 10-frame `xfade` dissolves in one chain, with the first moment repeated at the end. One full cycle is then cut out starting 10 frames in (`trim=start_frame=10:end_frame=710`), which makes the last frame lead straight into the first (seamless loop, 700 frames, 29.17 s).

Encodes (all `-an`):

```
ffmpeg -i loop.mkv -an -vf scale=1280:-2,format=yuv420p -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 -deadline good -cpu-used 1 -g 120 reel-720.webm
ffmpeg -i loop.mkv -an -vf scale=960:-2,format=yuv420p  -c:v libvpx-vp9 -b:v 0 -crf 44 ...                                          reel-540.webm
ffmpeg -i loop.mkv -an -vf format=yuv420p -c:v libx264 -preset slow -profile:v high -crf 30 -movflags +faststart                      reel-720.mp4
ffmpeg -i loop.mkv -vf "select=eq(n\,110)" -frames:v 1 -q:v 6                                                                        reel-poster.jpg
```

## Crop rules

Crops exclude HUD text, scoreboards, captions, credits, facecams and overlay handles. Do not add moments with faces of other people, readable names or logos filling the frame.
