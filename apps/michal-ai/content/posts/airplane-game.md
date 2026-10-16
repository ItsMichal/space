---
title: "Airplane Game"
slug: airplane-game
kind: project
id: airplane-game
description: "A browser remake, in a single HTML file, of a computer game from around 1985. Playable on this site."
date: 2021-04-05
tags: ["JavaScript", "Canvas", "Game Dev"]
minor: true
links:
  - label: "Play it"
    href: "/play/airplane-game/airplane.html"
  - label: "Repo"
    href: "https://github.com/ItsMichal/airplane-game"
---

Airplane Game is a computer game from around 1985. My dad programmed it on an old Polish computer, it was originally called Attack on New York, and I thought I'd have a go at recreating it for the browser.

The whole thing is one HTML file: plain HTML5, canvas and JavaScript, no libraries. You fly a plane back and forth over a skyline of buildings and drop bombs on them, one at a time, with the space bar or a tap. The plane comes down a row every time it reaches an edge, so the idea is to flatten the skyline before it flattens you. Clear every building and the next level starts, faster. Your high score is kept in a cookie.

The README is upfront about the code: it's a mess, as with any hacky project done in a few hours.

[Play it here](/play/airplane-game/airplane.html). It fills the whole window, so on a phone it's tap to start and tap to bomb.
