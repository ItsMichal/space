# Medium import review

Source: https://halmic.medium.com/ (13 public articles, May 2020 – Nov 2021). Imported by `scripts/import-medium.mjs`
into `content/posts/<slug>.md` with `draft: true` and `canonical:` set to the Medium URL. Machine-readable log:
`docs/content-review/medium-import.json`.

## Byline: real name, not the handle

- The handle `halmic` appears only in the URL (`halmic.medium.com`).
- Profile page title and header: **"Michal Bodzianowski"**. The About tab has no bio.
- Every article's byline, RSS `dc:creator`, and Medium's `author` metadata: **"Michal Bodzianowski"**.
- Article text that carries his name: Taco Neko ends with "-Michal Bodzianowski"; other posts sign "-Michal" / "— Michal"
  with a link to the old personal site `http://michal.us`. The logic probe post says the 3D print was customised "with my name".
- Employer: **no article mentions SpaceX or any employer.** Education is named: CU Boulder, Creative Technology & Design major,
  ATLS 3300 Object (logic probe post); "Form class", "Motion class", "BTU Lab".
- Other identifying or third-party details: GitHub/p5 handle `ItsMichal` (gist and p5 editor links), girlfriend mentioned as a
  design tester (Taco Neko), classmates named (Torshawna Chew, Ethan Wang) and a TA (Chris Hill, linked to chrisnhill.com).
  Review before publishing.

## Articles (all public and complete; none are member-only)

All 13 are `kind: article`, `draft: true`. Dates are the UTC day of Medium's first-publish timestamp. "Alt" = images that
have no alt text (Medium supplied none for any image).

| # | Title | Original URL | Date | Words | Images (no alt) | Tags | Status |
|---|---|---|---|---|---|---|---|
| 1 | Taco Neko Development | https://halmic.medium.com/taco-neko-development-5c1fb9e6372c | 2020-05-27 (updated 2020-11-10) | 3218 | 47 (47) | Game Dev, Design, Process, itch.io, GB Studio | complete |
| 2 | Logic Probe Build Log | https://halmic.medium.com/logic-probe-build-log-part-1-2277172dad0e | 2021-08-28 (updated 2021-09-10) | 973 | 40 (40) | DIY, Electronics, Education | complete; instructables link card reduced to a link |
| 3 | Creating my own animated logo | https://halmic.medium.com/creating-my-own-animated-stinger-b4035abc7622 | 2021-09-01 | 392 | 3 (3) | Motion Design, After Effects, Design, Motion | complete |
| 4 | Making a (literal) ThreadBoard constellation! | https://halmic.medium.com/making-a-literal-threadboard-constellation-cda34539ecac | 2021-09-08 | 910 | 21 (21) | Electronics, DIY | complete; link card reduced to a link; internal link now `/writing/logic-probe-build-log` |
| 5 | Making a Kinetic Typography | https://halmic.medium.com/making-a-kinetic-typography-58e52217cab0 | 2021-09-20 | 195 | 0 | Motion Graphics, Typography, Animation | complete |
| 6 | LED Pong and more adventures with the Arduino Nano 33 IoT | https://halmic.medium.com/led-pong-and-more-adventures-with-the-arduino-nano-33-iot-b674611fd0d0 | 2021-09-25 | 1106 | 16 (16) | Arduino, Electronics, Design | complete; 2 gists became links |
| 7 | Small Projects in Motion | https://halmic.medium.com/small-projects-in-motion-f476a43631bb | 2021-09-29 | 79 | 0 | Motion Design, Animation, Portfolio | complete (stub: "More to come!") |
| 8 | Creating my first PCB — Object | https://halmic.medium.com/creating-my-first-pcb-object-4d7112e943af | 2021-10-15 | 951 | 11 (11) | ATtiny85, Arduino, Hacking, Programming, Design | complete; 1 gist became a link |
| 9 | Quantum Computing explained in 1 minute. | https://halmic.medium.com/quantum-computing-explained-in-1-minute-a604e5c4117d | 2021-10-18 | 165 | 0 | Quantum Computing, Infographics, Design, Motion Design, Videos | complete |
| 10 | MedPuck PCB Prototype | https://halmic.medium.com/medpuck-pcb-prototype-e7bbe87de941 | 2021-11-02 | 785 | 9 (9) | Electronics, Design, Entrepreneurship, Product Development, DIY | complete; 1 gist became a link |
| 11 | Experiments in Analog- and a failed attempt at a screaming robot. | https://halmic.medium.com/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot-e5d67d9e8d29 | 2021-11-06 | 1401 | 11 (11) | Fail, Arduino, Electronics, DIY, Robotics | complete |
| 12 | Poznan — Low Roar MV | https://halmic.medium.com/poznan-low-roar-mv-f937d06c6ba9 | 2021-11-17 | 6 | 0 | (none on Medium) | complete (one-line post plus video) |
| 13 | Making a punching bag game in P5.js | https://halmic.medium.com/making-a-punching-bag-game-in-p5-js-1f8fe83cb6af | 2021-11-20 | 941 | 3 (3) | Game Dev, Hardware, Arduino, Fun, Projects | complete; 2 gists became links, 2 p5 editor cards became links |

Word counts are from the converted Markdown (Medium's own counts differ by under 3%, as expected from links and captions).
Descriptions are the post's first sentence or paragraph; Medium had no real subtitles.

## What did not convert cleanly or needs the owner

1. **Alt text (done in the cleanup pass below).** Medium stored none, so all 164 image references (161 distinct files plus 3 reuses
   in Taco Neko) were empty. Each image was viewed and given a one-sentence description; captions stay as image titles.
2. **Covers (done in the cleanup pass below)** for the 9 posts that have images. The 4 posts without images have no cover.
3. **Gists are links, not embeds** (gist.github.com cannot be framed). Five gists, all `ItsMichal`: Lane Defense, Prototype Boxing
   Bag Code, MEDPuck, Police LEDs, LED Pong. Their Medium embed pages are behind Cloudflare, so the URLs are hard-coded in the
   script (`MEDIA_EMBEDS`). Optional: paste the code into fenced blocks.
4. **Medium link cards** (Instructables, ThreadBoard, p5.js editor) were reduced to their title as a plain link.
5. **Bold lines used as headings** were converted in the cleanup pass (Taco Neko, Quantum "Transcript").
6. **Time-bound or Medium-specific wording** and signature lines were removed in the cleanup pass (see below).
7. YouTube embeds are `::youtube{id=…}` (titles added where Medium had them). 19 videos across the set.
8. **Drafts' images are still public static files.** `public/media/<slug>/` and the generated `public/media/_v` variants ship
   with any deploy even though the pages are drafts. They are unlinked images from his public Medium articles.
9. Medium's article pages block curl (Cloudflare 403). Three articles (Taco Neko, Logic Probe, animated logo) are not in the RSS
   feed, so they were extracted from the page's own article model in a browser and snapshotted under `scripts/medium-src/`
   (each verified byte-for-byte by SHA-256 against the browser copy). The other ten come from the committed RSS snapshot.
   Markups (bold, italic, links) of all ten were cross-checked against the live pages' data.
10. Only articles at halmic.medium.com were found (home page scrolled to the end; sitemap and RSS agree). Reposts and responses
    were not imported.

## Topics and where each fits

All thirteen are 2020–21 student coursework at CU Boulder (Object, Motion, Design courses), written in a casual build-log voice.

Professional portfolio blog (engineering and process, with code or hardware detail):
- Making a punching bag game in P5.js (software, serial protocol, code)
- Taco Neko Development (game design process, strong narrative)
- Experiments in Analog … screaming robot (honest engineering post-mortem)
- Creating my first PCB — Object and MedPuck PCB Prototype (a two-part hardware product story; publish together)
- LED Pong and more adventures with the Arduino Nano 33 IoT

Better as archive or creator/streamer-persona material (motion design, hobby, personal):
- Poznan — Low Roar MV, Quantum Computing explained in 1 minute, Making a Kinetic Typography, Creating my own animated logo,
  Small Projects in Motion (stub; probably skip)
- Making a (literal) ThreadBoard constellation! and Logic Probe Build Log (course exercises; lower value for a professional audience;
  Logic Probe is a build log with 40 uncaptioned photos)

The seven "Object" course posts (ThreadBoard, Logic Probe, LED Pong, First PCB, MedPuck, Analog, Punching bag) now carry
`series: "Object"` and `order` 1 to 7 by date. The site only uses `series` as the list heading under a `parent` project, and no
"Object" parent project exists, so for now the fields are inert metadata (posts stay in /writing); create a parent project and set
`parent:` on the seven to get the grouped list with prev/next navigation.

## Cleanup pass (owner-requested edits, after the import)

Only the changes listed here touch the converted text. Everything is still `draft: true` with `canonical:` set.

Applied to all posts with images: one-sentence alt text for every image (no empty alts), `cover` + `coverAlt` (reusing an
existing body image; no new files). Signature lines ("-Michal", "— Michal", "Signing out,", "Thanks," plus the michal.us link,
"-Michal Bodzianowski") removed. Link cards and gists were already labelled links; the gist links kept their titles.

| Post | Cover (image no.) | Other changes |
|---|---|---|
| Taco Neko Development | 46, title screen | 13 bold-only section titles became `##`/`###` headings; closing "Play TacoNeko on Itch.io" heading + bare-URL heading became a heading plus a "TacoNeko on itch.io" link; removed "I’ll try and keep this updated!" and "Medium makes sprites look weird!" (caption of image 21); signature removed; typo "Suarez" to "Suavez" in two captions |
| Logic Probe Build Log | 34, finished probe | signature removed; `series: "Object"`, `order: 1` |
| Creating my own animated logo | 3, traced vs. original logo | none besides alt and cover |
| Making a (literal) ThreadBoard constellation! | 16, finished constellation | removed "Next up, I will be finishing the Logic Probe that I started last week." (and its link to the Logic Probe post); typo "acryllic" to "acrylic" (twice); `order: 2` |
| Making a Kinetic Typography | none (no images) | none |
| LED Pong and more adventures… | 1, first image | removed "Stay tuned for the next project in 2 weeks time." and the "Signing out," sign-off; `order: 3` |
| Small Projects in Motion | none | removed the opening RSS-feed paragraph and the closing "More to come!"; the frontmatter description is now the post's own first sentence ("Please enjoy my walking animation!"), no new prose |
| Creating my first PCB — Object | 3, MedPuck sketch | removed the caption "Click on the images to see the detail!", the sentences "If you want to build the MedPuck yourself, I’ll be making another post…" and "Next, we’ll be using more analog inputs…", and the clause "as well as a confirmation of our order, which by this time is almost here! Exciting!"; typo "smorgasboard" to "smorgasbord"; `order: 4` |
| Quantum Computing explained in 1 minute. | none | bold "Transcript —" became `## Transcript` |
| MedPuck PCB Prototype | 7, glowing LED ring | "read that article here" now links "here" to the first PCB post; `order: 5` |
| Experiments in Analog… | 11, finished robot | "— Michal" removed; `order: 6` |
| Poznan — Low Roar MV | none | none |
| Making a punching bag game in P5.js | 3, game screenshot (`coverFocus: "50% 40%"`) | the two "p5.js Web Editor" link cards now carry the sketch title ("LaneDefense by ItsMichal, play in / edit and remix in the p5.js Web Editor"); removed "Look forward to whatever could happen with our speed bag contraption as we work on it!" and the "Thanks," sign-off; typos "inheritence" to "inheritance", "Sneak peak" to "Sneak peek"; `order: 7` |

Left as written for the owner to decide: classmate, TA and tester mentions (file and line numbers in the review report), "Part 1 is
complete! Next steps include…" in the Logic Probe post, "Sorry for (somewhat) spoiling the next post" in the punching bag post, the
dated "Hearing my instructors playtest…" update note at the end of Taco Neko, and bare credit URLs inside two captions in the
Analog post.

## Re-running

`node scripts/import-medium.mjs [--only <slug|id>] [--force] [--no-images]`. Existing posts are **skipped** unless `--force`, so
the hand edits above are not overwritten (a plain run with the 13 posts present changes nothing). `--force` regenerates the posts from
the committed snapshots and discards hand edits; it also prunes unreferenced images in each post's media folder. The JSON log
(`medium-import.json`) is the record of the original import and is only rewritten by a run that skips nothing.
