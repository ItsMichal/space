# Public repo audit (GitHub `ItsMichal`)

Research date 2026-10-12. Source: GitHub API (repo list, contributors, trees, READMEs, commit counts) plus HTTP checks.
28 public repos, no organisations visible on the profile (`orgs: []`), 17 public gists (not audited; four are linked
from existing posts). 6 are forks (calblueprint.org, unity-housekeeping, portfolYOU, salien-bot,
webgl-spotify-connect-now-playing-screen-example, Overmon) with at most 1 commit of his and are skipped.
Identity-rule note: the casual handle appears in GitHub profile fields and in some READMEs; where it does, the repo is
flagged below. No handle string is used in this document.

Not read: private repos, repo history for secrets (see Hygiene), repo issues/PRs.

## Ranked candidates

A = deserves a project page or write-up. B = short entry/card or a mention in an existing post or the hackathon list. C = skip.

| Rank | Repo | One factual line (from README/code) | Evidence of substance | Assets | Owner must supply | Section | Risks |
|---|---|---|---|---|---|---|---|
| A | [TrustTeaming](https://github.com/ItsMichal/TrustTeaming) | "A testbed that pits two users against a controlled agent in a map-based task": Python/JavaScript/React app storing data in Redis (README: "Beta v2023.05") | 76 commits, 2021-09-10 to 2024-01-18, he is the only contributor; Dockerfile, Leaflet map, sample configs; cites a TIES paper (Bobko et al. 2023, doi 10.1080/1463922X.2022.2086644) and ships a project paper PDF; README also mentions a CSCI5448 final-project video | Repo only: no screenshots or demo in README; a YouTube video is linked | Motivation, his role vs the lab's, outcome/usage in studies, screenshots | project (research) | Lab-owned research software and data: get the PI's OK before showcasing. CC BY-NC-SA 4.0 (README asks for attribution to him and citation of the paper). README mentions his personal domain; the repo page links the lab site. No tests/CI per README. |
| A | [pilsudski](https://github.com/ItsMichal/pilsudski) | "Custom made API-AI webhook" built in his sophomore year of high school, named after a WWI-era Polish leader | 144 commits, 2017-01-12 to 2020-10-14, sole contributor; README links a Denver Post article (2017-02-21) and a 3-minute media pitch and a tutorial on YouTube; tied to the data item `denver-post-2017-kaiser` | Denver Post article, two YouTube videos (links in README, not checked) | Story/motivation, the school project context, outcome | project or writing (high school) | 3,863 files of committed `node_modules`; README hot-links a Pinterest image (third-party image: do not reuse); README says "MIT License" but the repo has no LICENSE file; the 2017 Denver Post photo is a third party's. Safe on the identity rule (its homepage is his personal domain, which redirects to this site). |
| B | [sea-of-thoughts](https://github.com/ItsMichal/sea-of-thoughts) | "A web application used to connect with people through small messages in a bottle" built at HackMIT 2020 in ~12 hours (README) | 34 commits (33 his, 1 teammate), topics hackmit/p5js/socket.io; data item `hackmit-2020-sea-of-thoughts` | `content/static/img/logo.png` in the repo; no screenshots; live app is gone (Heroku 404) | Outcome, role, screenshot or recorded demo | hackathon list | Teammates named in README (do not display without asking). Default branch `master`. |
| B | [Creatle](https://github.com/ItsMichal/Creatle) | Wordle-style game engine/platform from HackCU 8 (Next.js, Prisma, PostgreSQL, Tailwind) | 5 commits, first 2022-03-06; second-place and a category prize (data item); live demo returns 200 | `creatle.vercel.app` live; Devpost thumbnail | Screenshots, what the engine does today | hackathon list; mention in a Creatle card | README is one line ("# Creatle"), no licence. |
| B | [askawAI](https://github.com/ItsMichal/askawAI) | Worksheet generator for teachers using OpenAI (Next.js/React/Tailwind) from T9Hacks 2022 | 9 commits in the event window (2022-02-19/20) | Live demos `askawai.vercel.app` and `www.askawai.com` both return 200; DOCX export template in repo | Screenshots; whether the demo still calls a paid API | hackathon list | README says "Under construction"; check that no API key is exposed or billed by the live demo. |
| B | [ohisee](https://github.com/ItsMichal/ohisee) | "A Twitch.tv Chatbot run during Games Done Quick": takes notes from users and quizzes them | 107 commits, 2018-06-30 to 2020-10-14; ran for AGDQ 2020 per README | Logo (imgur hot-link); live app is gone (Heroku 404) | Outcome, audience size, a recording | project (small) / writing | 3,396 files of committed `node_modules`; third-party event name and Twitch channel in README; saved event JSON files. |
| B | [Arcade](https://github.com/ItsMichal/Arcade) | "Monorepo for Arcade work, mostly for ATLS Alt Arcade Interfaces": BarcodeGame, ProMoArduino, SliderPong | 6 commits 2023-02-09 to 2023-05-04; BarcodeGame is the code behind the existing post `office-wizards-barcode-game`, which already links the course | Notion write-ups (linked from README) | Which parts are his vs teammates' | link from the existing Office Wizards post only | README links Notion pages on his casual-handle domain: do NOT link the README from the portfolio; 902 committed `node_modules` files; coursework with teammates. |
| B | [airplane-game](https://github.com/ItsMichal/airplane-game) | Browser remake of a ~1985 computer game his father wrote, single HTML file | 4 commits, 2021-04-06 | The single-file game itself (could be hosted here) | The story is the post: the README gives only the origin line | small project card | README demo link (`michal.us/airplane-game/airplane.html`) now returns 404 because `michal.us` redirects here. |
| B | [Grocerybot](https://github.com/ItsMichal/Grocerybot) | "Proof-of-concept robot": inverse kinematics, object recognition, path planning, web server; CSCI 3302 final project | 3 commits (2021-08-27 upload), YouTube demo 200 OK | YouTube demo | His part vs team; course permission | mention in an education/coursework list | University coursework: check the course's policy on public code. Webots world files bundled (third-party platform assets). |
| B | [IntroToWebDev](https://github.com/ItsMichal/IntroToWebDev) | Materials for a Blueprint Boulder workshop he ran on 2021-02-24 | 3 commits | `index.html`, examples | Attendance, slides | talks/teaching line | README says "coming soon". |
| C | itsmichal.github.io | Previous portfolio (three.js; 33 commits 2020-2023; preview URL is up) | Could be a one-line "earlier versions of this site" mention | Live preview | n/a | optional mention | Its homepage field and README name his personal domain, not the casual handle. |
| C | sudoku-solver, 3308, CSCI-BShip, advent-of-code | Coursework and exercises (TypeScript search solver; CSCI 3308 solutions; C++ Battleship; Advent of Code 2023, 18 commits) | Small | none | | skip | Coursework; CSCI-BShip commits `release.zip`, `cmake-build-debug`, `.idea`; CSCI-BShip/3308 have `.DS_Store`. |
| C | Mapia, PatriotLive, MichalsTerribleMod, CELS-Java, CELS-Unity, ItsMichal (profile repo) | 2016-2020 hobby/competition code (API.AI trivia webhook, CyberPatriot scraper, Minecraft plugin, cell simulators, empty profile README) | 2-17 commits each | none | | skip | Mapia and PatriotLive commit 1,112 and 2,739 `node_modules` files; CELS-Unity is mostly another contributor's commits (10 vs his 2). |
| skip | `space` | The portfolio itself (271 commits) | | | | n/a | Homepage field points at the casual-handle domain (see hygiene). |

## Repo hygiene worth fixing regardless

- **Identity rule:** the `space` repo's homepage field and the GitHub profile `blog` field both point at the casual-handle
  domain, the profile `company` still says "SHINE Lab" and the bio says "Applied AI Researcher". The Arcade README links
  Notion pages on the casual-handle domain. Not changed here; owner decision.
- **No licence:** 22 of 28 repos have none, including `pilsudski`, whose README claims MIT.
- **Empty or placeholder READMEs:** `Creatle` (one line), `askawAI` ("Under construction"), `ItsMichal` profile repo (empty
  file, description "woooo"), `3308`, `IntroToWebDev` ("coming soon").
- **Missing topics:** all but 4 repos have none (TrustTeaming, sea-of-thoughts, pilsudski, CSCI-BShip have some).
- **Dead demos:** `sea-of-thoughts.herokuapp.com` (404), `ohisee.herokuapp.com` (404),
  `michal.us/airplane-game/airplane.html` (404, domain now redirects here), the casual-handle domain on the `space`
  repo did not connect from here, `spectacle.hackmit.org/project/513` (502).
- **Committed dependencies/artifacts (paths only):** `node_modules/` in Arcade, Mapia, ohisee, PatriotLive, pilsudski;
  `release.zip`, `cmake-build-debug/` and `.idea/` in CSCI-BShip; `.DS_Store` in 3308 and CSCI-BShip; `~$test.xlsx` in Mapia;
  `backup - Copy.json` in PatriotLive.
- **Secrets:** a filename scan of every non-fork repo (excluding `node_modules`) for `.env*`, key/pem, credential and token
  files found none. `pilsudski/config.json` was opened: its top-level keys are `setup` and `responses` (no
  credential-looking keys). This is NOT a history scan: run a scanner such as gitleaks over full history of
  `ohisee`, `pilsudski`, `Mapia`, `PatriotLive` (Twitch/Heroku/API.AI projects) before linking any of them.
- **Old default branch name:** 8 non-fork repos still default to `master` (3308, CELS-Java, CELS-Unity, CSCI-BShip,
  Mapia, PatriotLive, pilsudski, sea-of-thoughts); harmless, a rename is optional.
- **Broken licence/README claims:** TrustTeaming's GitHub licence field shows NOASSERTION although a LICENSE file is present.

## Suggested factual outline for the two A candidates (headings only)

TrustTeaming: What it is / Stack (Python, React, Redis, Leaflet) / Study task / Data and configuration / Licence and citation / Status (last release v2023.05).
pilsudski: What it is / Context (school project, 2017) / How it worked (API.AI webhook) / Press (Denver Post) / Videos / Status (retired).
