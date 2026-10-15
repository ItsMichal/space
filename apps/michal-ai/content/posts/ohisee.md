---
title: "OhISee"
slug: ohisee
kind: project
id: ohisee
description: "A Twitch chatbot that took notes from viewers and quizzed them on those notes, run during Games Done Quick events."
date: 2018-06-30
tags: ["Node.js", "Express", "Twitch API", "Web"]
minor: true
years: "2018 to 2020"
---

OhISee is a Twitch chatbot that ran during Games Done Quick. Viewers start a chat message with a notepad emoji and an emote, and the bot saves it as a note, tagged with live game data from the stream. Then it can quiz people on the notes: `!Quiz` starts a multiple-choice question in chat, with questions generated using natural language processing.

There's a small command set around that. `!RandomNote` and `!Note` read notes back, `!NoteRoll` lists the top note takers, `!HonorRoll` the top quiz scorers, and `!Grade` gives you your own grade. A website shows the notes and leaderboards, including those from past events, and a simple queue keeps the bot from drowning in a busy chat.

The first commit is from June 2018, and the README says it last ran for AGDQ 2020, in a community-run chat because the official channel was subscriber-only. It's Node.js and Express on Heroku, talking to the Twitch API. Heroku is also where it stopped: the site is no longer up.

The README has its own disclaimer for employers, in my own words from back then: the code is years old and messy, and it was never meant to be read by another developer. I'll let that stand.
