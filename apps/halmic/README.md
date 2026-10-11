# halmic

Concept work for halmic.com (self-contained; meant to move to its own repository).

- `docs/discovery.md`: what exists, benchmark, IA, owner questions. Contains an INTERNAL section to delete before the split.
- `docs/design-system.md`: sibling design system, shared vs diverging.
- `docs/technical-plan.md`: Twitch/YouTube plumbing, SEO, owner setup.
- `brand/`: logotype generator (`node brand/build-logotype.mjs`), SVGs, `specimen.html` and `specimen.png`.
- `scripts/sync-youtube.mjs`: public-feed sync with an identity deny-list. `scripts/shot.mjs`: headless Chrome screenshots (needs the `ws` package).
- `content/`: `videos.json`, held-back entries, deny-list.
- `site/`: prototype. `cd site && npm start` then open http://localhost:4310/ (bold) or /calm.html; add `?live=1` for the live state. Zero dependencies.

Rule: no real name anywhere in `site/` or `brand/`. Check with the deny-list patterns in `content/identity-denylist.txt`.
