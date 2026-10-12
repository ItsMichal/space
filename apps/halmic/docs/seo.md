# halmic.com: SEO plan (handle first)

Goal: when someone types "halmic", "halmictv", "halmic twitch", "halmic games", "halmic youtube", or the name of one of his games or videos, halmic.com and the handle's own profiles fill the first page. There is almost nothing on the web for "halmic" today (search returned only unrelated hits), so this is an ownership job, not a fight.

## Keyword map

| Query | Landing page | What carries it |
| --- | --- | --- |
| halmic | `/` | title "halmic: streams, videos, games and design", H1 is the wordmark (SVG with `<title>halmic</title>`), Person JSON-LD named halmic, `sameAs` to every halmic profile |
| halmictv, halmic tv | `/` | `alternateName: halmicTV`, the Twitch link text, llms.txt, "Watch on Twitch" |
| halmic twitch | `/` (Clips group, `#stream`) | top Twitch clips as cards (real titles, games and durations as text), the "no set schedule" card; link to twitch.tv/halmictv with `rel="me"` |
| halmic youtube | `/videos/` | "Videos" H1, subscribe link, VideoObject per video, RSS |
| halmic games, halmic itch | `/games/` | "Little games" H1, VideoGame per game, link to itch.io profile |
| taco neko, soupman, glass gunslinger, flippy-style names | `/games/<slug>/` | one static page per game: H1 = title, description, cover with real alt text, "Play on itch.io", VideoGame JSON-LD, own OG image |
| each video title | `/videos/<slug>-<id>/` | one page per video: H1 = title, thumbnail, description excerpt, VideoObject, click-to-load player, own OG image |
| halmic logo design, southeast denver dental logo | `/design/southeast-denver-dental/` | CreativeWork, screenshots with descriptive alt, link to the client's site |

## Decisions (owner, final)
- **No Medium anywhere in shipped output.** The Medium profile shows the real name, so the home "Writing" block, the footer/profile link, the `sameAs` entry, `rel="me"` links, `llms.txt` and every inner-page mention are gone, and there is no `/writing/` plan. Do not re-add it unless the profile is renamed.
- `sameAs` is exactly Twitch, YouTube, itch.io, X. Identity is handle-only (`Person` "halmic", no name fields, no legal suffix); `npm run check:identity` guards it.
- Favicon: `favicon.svg` is the simplified small-size variant of mark 3 (thicker strokes, opened joint, bigger glyph; `brand/build-favicon.mjs`), with `favicon-16.png`, `favicon-32.png` and `apple-touch-icon.png` (180, the full mark) rendered by `brand/render-favicons.mjs`.

## What the prototype already does (static HTML level)
- Semantic static HTML for all content; the only JavaScript is the meter, the live flag and click-to-load players. No content depends on JS.
- Unique `<title>` (under 60 chars where possible) and meta description (under 160) per page; `<link rel="canonical">` on `https://halmic.com/...`.
- Open Graph and Twitter `summary_large_image` on every page; generated 1200x630 share images with the logotype (`site/public/og/`, `node scripts/build-og.mjs`): home, one per game, one per video, one for the design entry.
- JSON-LD: `Person` "halmic" (alternateName halmicTV, Halmic; no real-name fields) with `sameAs` for Twitch, YouTube, itch.io, X only (Medium was removed on purpose, see Decisions); `WebSite`; `VideoGame` per game; `VideoObject` per video; `CreativeWork` for the logo entry. (BroadcastEvent while live is a Worker step; see technical-plan.md.)
- `sitemap.xml` (17 URLs), `robots.txt`, `rss.xml` (videos), `llms.txt`.
- Performance: text is the LCP element (the wordmark is inline SVG, the font is one 28 KB variable woff2 with a size-adjusted fallback, preloaded); thumbnails and covers have width/height set (no layout shift) and `loading="lazy"`; no third-party request happens before a click: YouTube loads from youtube-nocookie.com only after press.
- Internal links: nav to every section, game and video pages link back to their section and to each other, home links to every inner page.
- Descriptive alt text on covers, thumbnails and screenshots; decorative bars are `aria-hidden`.

## Not done yet (needs the real site or the owner)
- Real HTTP caching headers, compression, HSTS (Cloudflare handles these at deploy).
- `BroadcastEvent` while live (Worker/HTMLRewriter), live thumbnail.
- Search Console and Bing Webmaster verification files.
- The Soupman page's jam line (itch does not expose it in a machine-readable place; only the description names it).

## Owner actions
1. **Remove the halmic.com redirect** (it currently 302s to the portfolio) before any of this is indexed.
2. Verify halmic.com in Google Search Console (DNS TXT) and Bing Webmaster Tools; submit `sitemap.xml`.
3. Put `https://halmic.com` in the website/link field of every halmic profile: Twitch (About panel and a panel), YouTube (About links), itch.io (profile website), X, Discord server description. The profiles point to the site, the site points back (`rel="me"`): this is what ties the handle together for search engines.
4. Use the same avatar and banner everywhere: the h! mark tile (`brand/svg/hmark-2-blue.svg` or `-ink`/`-paper`) for avatars, the wordmark lockup for banners. Same display name "halmic" (Twitch may keep "halmicTV" as the login).
5. Use consistent one-line bio everywhere (draft: "halmic streams games, codes stupid things and designs stuff. halmic.com").
6. Write a real description for each itch game and a real description under each YouTube video (the feed excerpt becomes the page's text and meta description; empty descriptions make thin pages).
7. Add the Twitch schedule and set categories on VODs so the site has real text to publish.

## Ongoing
Link to the game and video pages when sharing them (the OG images are made for it). Keep titles human: the page title is the thing people search for.

- Home is one grid of cards (Clips, Videos, Games, Work, Elsewhere). Added `/work/pokemon-phoenix-rising/` (QA entry, three official videos from the project's channel, click-to-load). The "On the stream" typographic list and the "This logotype" entry are gone; the line "The logo only; ..." is removed everywhere.
