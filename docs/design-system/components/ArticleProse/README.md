# ArticleProse

The reading layout for articles and progress logs: sans title, Newsreader body at 20/32, serif `meta` for dates and reading time, figures with serif captions.

**Consumer provides** the rendered article inside `.prose`, plus title (`display`), lede (`.lede`, `prose-lede`), date and reading time (`meta`). Headings inside are sans; body, quotes, lists and captions serif. Images sit in `<figure>` with a `figcaption`, `radius-md`, full measure or wider. Code blocks in `code` on `paper-raised` with a `hairline` border. Progress-log entries add previous/next links and a link back to their project. Measure 66ch.
