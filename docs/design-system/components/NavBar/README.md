# NavBar

The site's only persistent chrome: a floating liquid glass pill, top-center, with the page links and the presence chip.

**Consumer provides** the links (Work, Writing, About — sentence case) with the current page marked `aria-current="page"`, and the live presence count. Sits 16px from the top, `position: fixed`, z above the page. The current link is `ink`; the rest `ink-muted`, `ink` on hover. On phones the pill spans the gutter-to-gutter width.
