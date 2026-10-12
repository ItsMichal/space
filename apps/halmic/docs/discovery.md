# halmic.com: discovery

Status: draft for the owner. Everything under "What I saw" was read from public pages on 2026-10-11 (no login). Anything uncertain is marked **(unverified)**.

> INTERNAL: the owner has decided halmic is a persona and handle, not tied to his legal name. This document records the research trail and may mention the link in the "Internal notes" section only. Nothing in `halmic/site` or `halmic/brand` may contain the real name. Before moving this folder to its own repository, delete the "Internal notes" section.

## Round 2 (supersedes the IA in section 3 and the questions in section 4)

Owner direction: casual, "a testament to my creative work". halmic.com is one relaxed creative home, not an agency pitch. The studio/services/process framing is dropped; design appears as "things I've designed" next to streams, videos, games and writing. The real name must not ship on the site (pages, metadata, structured data, alt text, feeds, OG images). Ties between halmic and the portfolio are otherwise fine and need no engineering around; still no link from halmic.com to the portfolio unless he asks.

**IA:** hero (wordmark, a modest status pill, one draft line in his words) / on the stream (what he plays, clips, week) / videos (curated feature + reel, click-to-load) / little games / things I've designed / say hi (Discord and X). The Medium "writing" block was removed (owner decision, see below). Inner pages exist for every game, every video and the design entry (for search; see `seo.md`).

### itch.io: https://halmic.itch.io/ (public profile and game pages, nothing played)
Five games, all browser builds, all tiny. I judged them from their pages and cover art, not by playing them, so the "rough" calls are about presentation, not gameplay. Dates are mostly not shown by itch (Soupman: 4 Feb 2022); ratings are 1 vote each; no play counts are shown.

| Game | Made with | What it is | Charming | Rough | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Taco Neko | GB Studio (tag) | "Join Suavez on his taco adventure to Islas de Gatacos and their Robo-Cats!" A top-down stealth taco-making game, status prototype, 5.0 from 1 rating | The most developed and the most charming: hand-drawn title card, a full written premise ("the Gordon Ramsey of Tacos"), a distinct voice and look | Page is mostly story text, no screenshots beyond the cover; "prototype" | **Feature (lead).** |
| Soupman | Bitsy | "Defeat the Saladking. Claim your legacy." Mystery Soup Bitsy Jam entry, in development, 5.0 from 1 rating | The pitch is a joke that commits; the Bitsy two-colour look suits the site; jam entries are exactly the "scrappy but honest" thing | Description says "more details to come", i.e. unfinished | **Feature (second).** Say "still in development" out loud. |
| Glass Gunslinger - Drop of Doom | PICO-8 | Fragile Shmup Jam entry; "Is this really a shmup...?" | Honest author note ("really wish I coulda themed it a bit better"), original music credit (Roby Dugay) | His own words call it under-themed; the cover is a dark frame with a tiny sprite | **More experiments.** Credit the musician on the page (done). |
| L'évasion du Criminel de sa Prison | PuzzleScript | Top-down stealth puzzle, "in terrible French... sorry", puzzle jam entry, released, 4.0 from 1 rating | The joke that the French is terrible; a clear mechanic (calling cards, buttons) | Niche to browse; needs the player to read a long note to understand it | **More experiments.** |
| Flippy | PICO-8 | "Yet another Flappy Bird remake" | Nothing the other four do not do better | It is a remake with no twist and the page says so | **Leave off** the site (it stays on itch). |

Overlap with the portfolio's Unity projects (Project Mountaintop, Office Wizards): none in the itch list; the portfolio's games are bigger Unity work. If he wants a single "games" story, the Unity projects would live on the portfolio and these jam games on halmic.com. Cross-linking is optional and not done.

### Southeast Denver Dental (the logo entry)
- Practice name as written on its site: **Southeast Denver Dental**, 7995 E. Hampden Ave, Suite 206, Denver, CO. The domain is sedenverdental.com ("SE"), but the site, title and logo alt text all say "Southeast Denver Dental", so the entry uses that.
- The site credits no designer or agency anywhere (footer: "All Rights Reserved 2022"), so nothing beyond the owner's own statement supports "I designed the logo". The entry says exactly that and nothing more: logo only, not website, not brand strategy.
- My own screenshots of the public site (header, footer, phone header) are cropped to the logo and stored in `site/public/work/`. No logo file was downloaded. The page's photos of staff and patients are not used. The favicon is described by the site's own alt text as orange; I did not capture it.
- Logo as seen: an orange four-lobed "tooth flower" mark with leaf-blue accents, set beside "SOUTHEAST" in blue and "DENVER DENTAL" in orange condensed capitals; a white version in the blue footer.

### YouTube (round 2 detail)
- DECIDED (owner): the TV-show edit is removed from halmic.com for good (its id is in `content/videos.exclude.json`, which `sync-youtube.mjs` and the build honour; its page, thumbnail, OG image, feed and structured data are gone). The videos section leads with his own "FIFA With the Boys" series (latest episode large, episodes 1 to 3 as a numbered row), then "Other edits" (two short films, the robotics highlight reel, an onboard lap), then a "Smash" block of SmashDEN sets (CyberSmash was dropped by owner decision). The Special Force descriptions credit him by real name, so those two pages show only my own one-line descriptions, never the YouTube text (`videos.held.json` lists them for him to review).
- The public Videos page lists 21 videos; the RSS feed returns about 15. `content/videos.manual.json` is the hand-kept full list (ids and titles read from the public page), merged with the feed by `scripts/sync-youtube.mjs`. Playlists: FIFA series PLUtLZU4pik-PsRl0gqi_UaKvB_25Xh0gt, Special Force PLUtLZU4pik-OClTpNNyMUl1s4aB2DWvuY. (A second Smash playlist exists on the channel; it was removed from the site by owner decision and its video ids are in `content/videos.exclude.json`. The site now has a "Smash" block of SmashDEN sets instead: see `docs/smash-research.md`.)
- Three feed entries are still held back by the name deny-list: check `content/videos.held.json` (ids and titles only). Per the owner's latest rule, only entries whose own text would print HIS real name stay held, and my pattern is broader than that (it also catches other people named Micha...). I have not read the held descriptions; he should look and release any that are fine.
- Friends' first names in titles are fine now.

### Questions for the owner (short, prioritised)
1. **Domain:** remove the halmic.com redirect to the portfolio when you want the site live. (Blocker for launch and SEO.)
2. **Tone:** is "I stream games, code stupid things, and design stuff." right? Rewrite the draft lines marked in amber (hero, games intro, design, writing, say hi).
3. **Logo entry:** year; any sketches or explorations; the original files; is the practice fine being shown; is "I designed the logo" all you want claimed?
4. **Games:** OK with feature Taco Neko + Soupman, quiet row for Glass Gunslinger and L'évasion, Flippy off? Any game or engine details to correct (Taco Neko's engine is only a tag)?
5. **Videos:** keep the Ted Lasso edit as the lead? Release or confirm the three held videos.
6. **h! mark:** which of the five "crosshair" readings did you mean (`brand/hmark.png`)? Is h! right for the avatar/favicon?
7. **Blue:** cobalt `#3d7bff` (recommended) or one of the other two (`brand/specimen.png`).
8. **Schedule and stream:** days/times, what the "code" streams are, which avatar/banner.
9. **Writing:** move the Medium posts to halmic.com or just link? Contact: which email or form?
10. **Accounts:** create the Twitch developer app (technical-plan.md) and make the profile links point to halmic.com (seo.md).

## 1. What I saw

### Twitch: https://www.twitch.tv/halmictv
- Display name **halmicTV**, 42 followers, **offline** at time of looking, "last streamed last year".
- Channel blurb (verbatim, the only "about" text): "Streams games and code stupid things". Panels: none visible (the About tab renders empty to a logged-out visitor).
- Links on the channel: X/Twitter https://x.com/halmicc, Discord invite https://discord.gg/4xvveJ8jS5.
- Schedule tab: **empty** (no recurring or one-off segments).
- Categories seen on VODs: Minecraft (a four-part "hardcore challenge" run with friends, about 2 years ago), Among Us (a "discord friends do amogus" highlight, 3 years ago), F1 23 (league season 3, qualifying and race uploads, 3 years ago), VALORANT (college-league "CSL" matches with a university team, about 6 years ago).
- Clips (top by views, 62 at most): "Hbox would be proud" (0:19), "5 kills no win :<" (0:59), "CREEPER, AW MAN" (0:40), "4k clutch on Bind", "Barbarian Chop Off the Top (ft. Cozy)", "Run #1 ends", "welcome Justin to the harcore challenge!" and others. Mostly VALORANT and Minecraft. Clip view counts are small (tens).
- Branding on the channel: a dark offline banner with white bold lettering, and a small cartoon-style profile photo. No emotes seen without logging in **(unverified)**. No brand colours to inherit.
- Honest read: a small, mostly dormant friends-and-code channel. The site must not pretend to a big audience. It should make the channel look intentional, and be ready to look alive the day he goes live.

### YouTube: https://www.youtube.com/@halmic ("Halmic Productions")
- Channel id `UC8_ZatxbG4ZZyG0S4Uz1G3g`, created 2019-01-30, 33 subscribers, 22 videos.
- Mix: "FIFA With the Boys" comedy highlight episodes (4 episodes, 2022 to 2025), a robotics competition highlight reel (2019, 1.5K views), an edited TV-clip piece "Ted Lasso - S1E5 - 4,438 Miles Worth Of Space" (161K views, by far the most watched), a short "Albon partying with Christian" (3.1K), a motorsport onboard lap, a school Smash tournament VOD set (2019; since removed from the site), a short-film-style series ("SPECIAL FORCE", 2019), and one live-stream placeholder.
- It is edited videos and tournament VODs, not Twitch highlights. Relationship to Twitch: a separate, older, cinematic and friends-comedy strand. It is a "videos" reel, not a mirror of the stream.
- Public feed works without an API key: `https://www.youtube.com/feeds/videos.xml?channel_id=UC8_ZatxbG4ZZyG0S4Uz1G3g` (latest 15). `halmic/scripts/sync-youtube.mjs` consumes it; 3 of 15 entries were held back automatically (see question 9).

### Other presences
- X: https://x.com/halmicc, linked from Twitch. Content not read (login wall) **(unverified)**.
- Discord: invite above, a community server **(unverified; not joined)**.
- Medium: https://halmic.medium.com/ is being imported by another agent (draft posts on branch `medium-import`). The Medium page shows a real name in its title and about page; do not republish that byline (question 8).
- halmic.co: does not resolve (no DNS), so the "old studio site" is gone.
- **halmic.com currently answers with a 302 redirect to the portfolio.** This must be removed at launch, otherwise the persona resolves straight to the real name.
- Web search for "halmic" returns nothing about him (the name is effectively unindexed), which means halmic.com can own the term quickly, and also that nothing links the persona to a real name from search.
- The old Ltd is dissolved (owner, 2026-10-11). No legal entity is claimed anywhere: no Ltd/LLC, no company number, copyright is "© year halmic".

## 2. Benchmark (my notes)

Caveat: written from knowledge of how these sites present themselves, not re-loaded today. Check any one live before leaning on it.

**Creator hubs and personal sites with taste**
1. lofigirl.com: one idea (a character and a live room), live state is the page. Lesson: status as the hero.
2. brittanychiang.com: personal hub, quiet, left-anchored identity, scroll-spy nav. Lesson: restraint even when personal.
3. rauno.me: tiny, interaction-led, every element a toy with a reason. Lesson: signature interaction in the chrome.
4. lynnandtonic.com: playful, illustrated, a person's whole range in one place. Lesson: personality in copy and illustration.
5. A typical "link in bio" page (Linktree style): shows what not to do. Flat list of equal buttons, no hierarchy, no live state.

**Small studios and creative-dev practices**
6. locomotive.ca: type-first hero, slow reveals, projects as full-bleed rows.
7. activetheory.net: WebGL as the identity, work as the index. Lesson: the effect is the pitch; also what to avoid (heavy, slow on phones).
8. resn.co.nz: humour and weirdness as positioning, a studio with a voice.
9. studiofreight.com / 14islands.com: clear service statements, small number of case studies, one obvious contact action.
10. monopo.jp / cuberto.com: bold colour and large type with kinetic details, case studies as stories.

What they share, and what to take:
- Above the fold: an identity statement or the live thing, never a menu of equals. One primary action.
- Live status: the best creator pages make "live" a state of the whole page (colour, motion), not a badge.
- Schedule: a week, drawn plainly, with timezone. If none exists, say so honestly rather than an empty calendar.
- Clips: titles as text with a duration beat a wall of thumbnails; a player loads only on click.
- Services (studios): three or four words each, not paragraphs. Case studies: 3 to 6, each a story with one image. Contact: one email or one form, visible twice.

## 3. Purpose, audience, information architecture

**Purpose.** halmic.com is the home of halmic: a streamer who also designs and builds for other people. It converts a visitor to a follower (Twitch, YouTube, Discord) or to a client enquiry, and it is where the handle lives when someone searches for it.

**Audience.** (1) friends and viewers: want to know if he is live, what he plays, when, and to watch something; (2) potential clients: want to see taste and a clear way to reach him; (3) people who clicked a handle somewhere.

**Recommended structure: creator-first single page, with the studio as a visibly different "other side" of the same page** (a full-width paper-coloured panel after the dark creator sections, with its own routes `/studio` and `/work/[slug]` when real work exists).

Why this and not the alternatives:
- Split entry (two doors): at 42 followers and little client work, two empty doors both look thin; one confident page with two moods looks like one person with range, which is the truth.
- Two modes with a toggle: hides half the content from search and from a visitor who never finds the toggle.
- Creator-first with studio as a section: the handle is "halmic" and the channel is the live, changing part, so the page has a pulse that gives the studio credibility rather than competing with it. The colour flip (dark to paper) makes the studio read as a deliberate second mode and keeps client-facing content calmer.
- The studio side can graduate to its own pages without redesigning the home.

Home page order: (1) hero: wordmark, live/offline state, one-line statement, Twitch + studio buttons; (2) stream: what he plays, clips, week; (3) videos: featured + reel; (4) studio: statement, services, work, contact. Later: `/writing` (Medium imports, pending his decision), `/work/[slug]`, `/live` (full-bleed player on interaction).

Two creative directions are in the prototype: **bold** (huge wordmark, a field of leaning bars behind it that is a live level meter, paper studio panel with a 13 degree edge) and **calm** (one column, hairlines, small wordmark, bars only in the status chip and play marks). **Recommendation: bold, with calm's reading discipline for the long sections** (the hairline lists and typographic scale). Bold gives the persona something no template has; calm is the fallback if the field reads as noise on low-end phones.

## 4. Content needed from the owner

1. Is "halmic" the exact display name for the studio side as well ("Halmic" capitalised in running text)? I used lowercase everywhere.
2. Tagline and first-person copy: my draft is "I stream games and code stupid things. I also design and build for other people." Rewrite in your voice.
3. Stream: what you stream now and plan to; what the "code stupid things" streams are; a real schedule (days, times, timezone) set on Twitch so the site can read it.
4. Twitch profile picture and banner you want; whether to keep the current avatar.
5. Studio services (I only know "design" and "creative development"); pricing posture (none, "from", enquire).
6. Client work: which pieces can be shown under the halmic name without revealing anything you do not want revealed; for each: client or "client under NDA", one image, three lines.
7. Contact: which email address or form (I will not use any address tied to your real name).
8. Writing: the Medium byline shows your real name; decide whether the posts move under "halmic" with the byline removed.
9. YouTube: three feed entries were held back because the title or description matched the real-name deny-list (see `halmic/content/videos.held.json`; reviewed only by id/title). Decide to publish, edit or drop. Video thumbnails show real faces (including likely yours) and other people's first names appear in titles ("Marcin", "Chris", "Justin"); confirm you are fine with that.
10. The monogram mark reads as an "M" in the logotype and may be recognised by people who know the portfolio. Keep it as halmic's mark, or use the wordmark alone and the "!" as the only shared glyph? (My recommendation is to keep it; it is the point of the sibling system.)
11. Which links count as halmic-branded for `sameAs`: Twitch, YouTube, X (@halmicc). GitHub and LinkedIn are excluded because they carry the real name; is there a halmic GitHub or other?
12. Discord: do you want the server linked publicly (the invite code is public on Twitch already)?
13. Domain: halmic.com is registered to you and redirects to the portfolio. Remove that redirect when we go live. Is halmic.co or halmic.tv also yours?
14. Whether to allow chat or "who is here" features: I recommend none.

## 5. Technical proposal (summary; detail in `technical-plan.md`)

Static-first Next.js on Cloudflare Workers (OpenNext), same as the portfolio, sharing `tokens.json` structure and the spring/motion toolkit; a tiny Worker route for Twitch state with caching and a graceful fallback; click-to-load players; Person + VideoObject structured data, BroadcastEvent only while live. No links to or from the portfolio.

---

## Internal notes (delete before the repo split)
- The mark is the portfolio's logo, an "M" plus "!" monogram. Reusing it ties the two visually, which is the owner's intent ("use my logotype"), but it is the one place the persona and the real name share a glyph.
- halmic.com 302 to the portfolio is a live tie between persona and name.
- The Medium profile and some YouTube descriptions carry the real name (held back, not read in full).

## Owner decisions at launch
- **Medium removed entirely** from the shipped site (home block, footer link, JSON-LD `sameAs`, `rel="me"`, llms.txt): the Medium profile shows the real name. No `/writing/` page. This closes question 8 and the Medium part of question 9.
- Contact stays as the Discord and X buttons (no email). Bold is the only visual mode (calm is gone).
- Games: Taco Neko and Soupman featured; Glass Gunslinger and L'évasion under "More experiments"; Flippy off. Special Force 1/2 keep their neutral one-liners; the Smash block keeps its thumbnails; the dental logo entry stays.
