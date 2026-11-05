# Identity separation

`halmic` is a handle; its site must not carry the owner's real name in anything it ships. `scripts/check-identity.mjs`
(run by CI and `npm run check`) fails when `apps/halmic` source, content, public files or build output matches a pattern in
`scripts/identity-denylist.txt` (docs and READMEs excluded). It also prints a soft warning when the portfolio's shipped copy
mentions the handle outside `scripts/identity-allowlist.txt`. The link between the two at the repository level is accepted.

**The one door (owner's decision, 2026-10-12).** The sites now link to each other, through exactly these things and no other:
the logo switcher (hover or focus the logo, one row with the other site's mark and domain; the same row in the phone menu on
michal.ai and in Halmic's footer for touch screens), and one link on each page that is genuinely the same piece on both sites.
The pairs live in `packages/crosslinks/src/pairs.mjs` (michal.ai post id to Halmic path). The check reads that map and allows,
in built Halmic HTML only, the exact strings the build emits for the switcher (twice per page: header and footer) and for the
page's own pair (once, on that page); a second mention, a URL that is not in the map, or the same link on another page fails.
The owner also approved outbound links to his own X posts, in one exact status-URL form that `scripts/identity-lib.mjs` exempts.
Real name, initials and everything else in `identity-denylist.txt` still fail everywhere. Adding the sibling site to either
site's metadata, JSON-LD `sameAs`, sitemap, feeds or footer credits is deliberately not done. To pair another piece, add a row
to `pairs.mjs`; `npm test -w @space/crosslinks` proves both targets exist and that the michal.ai one is live and not a redirect.

