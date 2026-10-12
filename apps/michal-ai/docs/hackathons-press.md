# Hackathon history and CU Boulder mentions: verification notes

Data lives in `content/hackathons.ts` and `content/press.ts` (not wired into any page). Research date: 2026-10-12.
Everything below was read from a page that was fetched during research; politeness: roughly one request per 3 s, only
public pages, robots.txt on devpost.com allows `*`.

## Devpost profile

- Profile used: `https://devpost.com/ItsMichal` (display name "Michal Bodzianowski", GitHub link on the profile points
  to `github.com/ItsMichal`). Safe under the identity rule: the Devpost username and every linked URL use the `ItsMichal`
  GitHub name, and the handle string the identity check looks for does not appear anywhere on the profile or in the data.
  Note that `ItsMichal` is already the GitHub URL in `site.config.ts`.
- Profile shows 4 projects, 5 hackathons, 8 achievements (earliest: joined Devpost 2021-03-07).
- WebFetch gets HTTP 403 from devpost.com; plain `curl` with a normal user agent works. No login was needed.

## Hackathons (5 in the array, 1 registration-only)

| Id | Event, date | Project | Awards (as printed) | Verified from |
|---|---|---|---|---|
| `t9hacks-2023-project-mountaintop` | T9Hacks 2023: To Infinity, Feb 17-18 2023 | Space - Project Mountaintop | none printed | Devpost project and event pages |
| `hackcu-8-creatle` | HackCU 8, Mar 5-6 2022 | Creatle | "General - 2nd Place"; "Best Games, Music, and Entertainment Hack" | Devpost project page; ATLAS article confirms both ("second prize overall", "Best Game and Entertainment Prize") |
| `t9hacks-2022-askawai` | T9Hacks 2022: Go Beyond, Feb 18-19 2022 | AskawAI | none printed | Devpost project page (role label "OpenAI integration, back-end") |
| `hackcu-007-playsafe` | HackCU 007, Mar 6-7 2021 (online) | PlaySafe! | none printed | Devpost project page (role label "Lead Designer"; Figma files) |
| `hackmit-2020-sea-of-thoughts` | HackMIT 2020, Sep 19-20 2020 | Sea of Thoughts | none stated | GitHub README only (not on Devpost) |

Registration only: `lol-global-power-rankings-2023` (Global Power Rankings Hackathon, Aug 31 - Oct 23 2023, online).
It is on the profile's hackathon list but no project is attached. Whether he took part is not stated.

How the fields were checked:
- Dates, locations, host names: each hackathon's own Devpost page. Organiser strings are what the page or the ATLAS
  article says (T9Hacks is at the ATLAS Institute; HackCU is described as on the CU Boulder campus). Devpost prints no
  separate "organiser" field for these.
- HackCU 8 oddity: the Devpost page lists a campus building as venue while its text says "held virtually". The ATLAS
  article says it was held on the CU Boulder campus. Data uses "Boulder, CO, USA" (the profile list's wording).
- Creatle was a solo project (the ATLAS article says so). Devpost lists Michal only.
- Teammates are taken from the project page "Created by" blocks as printed (`Jamie JAJO7747` is a Devpost display
  name). HackMIT teammates come from the README. Do not display them without asking.
- Project Mountaintop's Devpost page has only a title, tags (c#, unity) and "Created by Michal Bodzianowski"; the
  portfolio post `project-mountaintop` credits a collaborator who is not on Devpost. No award is printed there.
- Thumbnails are remote Devpost CDN URLs (not downloaded). AskawAI has only the generic Devpost icon, so none is set.
- Repo links: Creatle and askawAI repos were matched by name and by commit dates inside the event windows (Creatle
  first commit 2022-03-06, last commit message "final commit for HackCU 2022"; askawAI first commit 2022-02-19). They
  are not linked from Devpost itself.
- Portfolio coverage: only Mountaintop has posts (`project-mountaintop` plus the weekly series, which mention
  T9Hacks). `relatedPostSlug` uses the slug on main today; slugs are being renamed, so re-map by title.
- Not hackathons, deliberately left out: Global Game Jam / game-jam entries (none found on Devpost or in the posts),
  ATLAS Expo 2023 (a showcase, not a hackathon; Office Wizards and Mountaintop posts already cover it). The iSAT
  dashboard post says it won Best Interactive Event at AIED 2022; the iSAT Summer 2022 newsletter I read prints
  "Awarded Interactive Even..." (truncated in the PDF text), consistent with that, but it is a conference award, not a hackathon.

## Press and mentions (8 items: 6 on colorado.edu, 1 lab site, 1 non-CU press)

| Id | Outlet, date | Headline | Presence | Notes |
|---|---|---|---|---|
| `atlas-hackcu-2022` | ATLAS Institute (colorado.edu), 2022-04-04 | ATLAS students take home HackCU's top awards | quoted, pictured | No byline printed. Strongest item. |
| `isat-edm-aied-2022` | iSAT (colorado.edu), 2022-07-14 (from URL) | July 23 - 31, 2022: iSAT Presents at ... (EDM) and ... (AIED) | listed | Author list of the AIED interactive event |
| `shine-lab-staff-profile` | SHINE Laboratory (colorado.edu), undated | Michal Bodzianowski | listed | States both degrees (B.S. Computer Science, B.S. Creative Technology and Design) and the SpaceX job |
| `isat-snapshot-summer-2022` | iSAT newsletter PDF | SAT Snapshot ... Summer 2022 | listed | Bibliography entry |
| `isat-snapshot-winter-2023` | iSAT newsletter PDF | SAT Snapshot ... Winter 2023 | listed | Bibliography entry |
| `isat-snapshot-summer-2025` | iSAT newsletter PDF | SAT Snapshot ... Summer 2025 | listed | CHI 2025 paper and a submitted JIA paper |
| `shine-lab-site-credit` | shinelaboratory.com (lab's own domain, not colorado.edu) | Posts - SHINE Lab | listed | Footer credit as site developer; `isCuBoulder: false` |
| `denver-post-2017-kaiser` | The Denver Post, 2017-02-21, Monte Whaley | Highlands Ranch students use virtual dialogue with WWI kaiser to spark interest in history | pictured, listed (not quoted) | Non-CU |

Only `atlas-hackcu-2022` is a news-style article. The rest are lab or institute pages and newsletters where he is
listed; the owner asked for articles, so treat the others as supporting citations.

Identity checks:
- ATLAS article: names Creatle (matches his Devpost project and repo), "computer science and CTD, with a business minor",
  quotes him about Creatle, and the photo alt text names him.
- SHINE staff profile: first-party page under his name; lists SpaceX as current employer.
- iSAT items: author spelling "Bodzianowski, M." beside the same iSAT team as the CHI 2025 paper already in
  `content/profile.ts`.
- Denver Post: his own repo README (`github.com/ItsMichal/pilsudski`) links this exact article and says the project was
  built in his sophomore year of high school; the article names him as a sophomore at STEM School Academy, age 15.
- Searched without finding any mention: ATLAS Expo 2023 page, ATLAS news archive pages 7-8, "Remembering 2022" (ATLAS),
  the 2021 "HackCU win for CTD undergrads" article, CU Boulder Today / CU Independent / Daily Camera / Colorado Sun,
  Longmont Leader, iSAT newsletters Winter 2024 and two others (media/60, 692, 772). Searches for the spellings
  "Michal Bodzianowski", "Michał Bodzianowski" and the surname alone were run. Spelling variants beyond that were not found.

## Unverified / needs the owner

1. **2013 "beer in space" coverage** (HuffPost 2013-10-09 "Michal Bodzianowski, Sixth Grader, Makes A Great Case For
   Brewing Beer In Space (VIDEO)"; Clarke Institute 2014-03-11 post; SSEP Mission 4 lists a Grade 6 student at STEM School and
   Academy, Douglas County; Daily Mail, ABC, NBC, Space.com, Time/CNN, NYT, UPI etc. listed on the Clarke page). Not
   in the data. Circumstantial match: same unusual name, Highlands Ranch, same school as the Denver Post item, and
   an age of 11 in 2013 vs 15 in 2017. No source of his own links it. Ask the owner; if confirmed, it is the
   best early-press item. HuffPost URL: `https://www.huffpost.com/entry/michal-bodzianowski-brewing-beer-in-space_n_4071843`
   (200 OK). UPI URL returned HTTP 403 to a script.
2. **Global Power Rankings Hackathon** (registered, no project): confirm participation before showing.
3. **Mountaintop at T9Hacks 2023**: Devpost shows no prize. If it won something, the owner must supply it.
4. **HackMIT 2020 award/outcome and location**: README states none; HackMIT project page returned HTTP 502.
5. **Teammate display**: names are in the data but should not be shown unless the owner agrees.
6. **iSAT AI institute staff page** `https://www.colorado.edu/research/ai-institute/michal-bodzianowski` appears in
   search results (software engineer, degrees) but now returns HTTP 404. Its content was never read, so it is not in the data.
7. **Hackathon organisers**: `HackCU (CU Boulder)` and `T9Hacks (ATLAS Institute, CU Boulder)` combine the event page
   with the ATLAS article; no page prints "organised by".
8. Devpost's "Hackathon Winner" achievement (achieved 2022-03-14) matches the HackCU 8 prizes; no other prize is on the profile.

## Link health (checked 2026-10-12)

OK (HTTP 200): all colorado.edu items except the staff page below, all Devpost pages, `creatle.vercel.app`,
`www.askawai.com`, `askawai.vercel.app`, the Figma files, the Denver Post article, the HuffPost article, the YouTube
Grocerybot video.

Dead or failing:
- `https://www.colorado.edu/research/ai-institute/michal-bodzianowski`: 404 (not in data).
- `https://spectacle.hackmit.org/project/513`: 502 (kept in `links.other` with a comment).
- `https://sea-of-thoughts.herokuapp.com`: 404 (Heroku app gone; not in data).
- `https://ohisee.herokuapp.com`, `http://michal.us/airplane-game/airplane.html`: 404 (repo README demos; see repo audit).
- `http://michal.us` redirects to `https://michal.ai/`.
- The casual-handle domain on his GitHub profile did not connect from the sandbox (000); not used in the data.

Archive.org: the availability API answered HTTP 429, so snapshots were found by requesting
`web.archive.org/web/2/<url>` (a 302 to an existing snapshot; nothing was created). `archiveUrl` is set on 7 of 8 items.
Missing: the SHINE staff profile page (archive returned 404, no snapshot). The (unused) iSAT staff page and the
Devpost pages were not archive-checked. HuffPost 2013 has a snapshot
`https://web.archive.org/web/20221208144553/https://www.huffpost.com/entry/michal-bodzianowski-brewing-beer-in-space_n_4071843`.

## Where each item is most relevant (data only, no layout)

- `hackcu-8-creatle`, `atlas-hackcu-2022`: Home "Awards"/press strip and the About section; the ATLAS article is the
  one linkable third-party award citation.
- `t9hacks-2023-project-mountaintop`: next to the Project Mountaintop post and the Experience entry for CU Boulder.
- `t9hacks-2022-askawai`, `hackcu-007-playsafe`, `hackmit-2020-sea-of-thoughts`: a compact Hackathons list or timeline
  page; no individual posts exist yet. AskawAI and Creatle have live demos.
- `isat-*` and `shine-*` items: Publications / Research section next to the CHI 2025 and ApJ entries and the iSAT
  posts (`isat-dashboard`, `jia-webapp`).
- `denver-post-2017-kaiser`: an "In the press" list; also a hook for a high-school-projects write-up (see repo audit).
- Newsletter items have no exact date: sort them by the issue they name, or leave them out of any dated feed.
