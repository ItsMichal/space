---
title: "Sea of Thoughts"
slug: sea-of-thoughts
kind: project
id: sea-of-thoughts
description: "A web app for sending messages in a bottle to whoever else is online, built in about 12 hours at HackMIT 2020."
date: 2020-09-19
tags: ["Node.js", "Socket.IO", "p5.js", "Web"]
cover: /media/sea-of-thoughts/cover.webp
coverAlt: "The Sea of Thoughts logo: a corked glass bottle holding a scroll, floating on two blue waves"
minor: true
links:
  - label: "Repo"
    href: "https://github.com/ItsMichal/sea-of-thoughts"
---

Sea of Thoughts is a place to throw your thoughts out to sea and let someone else read them. You write a short message, put it in a bottle, and whoever else is online at that moment can pick it up. The README calls it a novel way of mixing meditation, writing and connection.

We built it at HackMIT 2020 over about 12 hours straight, on September 19 and 20, as a team of four. The server is small: Node.js and Express with Socket.IO, which relays each bottle to everyone else who's connected and keeps a count of who's in the sea. Nothing is stored (a comment in the code says the message array was "to be replaced by Database"). The page uses p5.js, with ocean music, piano, and sound effects for typing, sending and receiving a bottle, plus a day and night mode that switches on its own.

The README is upfront about the gaps: it's responsive but not fully mobile-friendly, and the back end is what we'd have expanded with more time.

The hosted version is gone, so the repo is all that's left. When I later made [a punching bag game in p5.js](/writing/p5-js-punching-bag-game), that post pointed back here as my earlier p5.js experience.
