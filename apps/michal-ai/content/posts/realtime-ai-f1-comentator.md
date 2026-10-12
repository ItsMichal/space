---
title: "AI Crofty"
slug: realtime-ai-f1-comentator
kind: project
id: realtime-ai-f1-comentator
description: "A realtime F1 23 commentator and race engineer that turns game telemetry into speech with OpenAI and TikTok TTS, with a Discord bot interface."
date: 2023-12-11
tags: ["TypeScript", "AI/ML", "Game Dev"]
cover: /media/realtime-ai-f1-comentator/cover.png
coverAlt: "Discord messages from the A.I. Croft bot commentating the Abu Dhabi Grand Prix, with a lap table of drivers and gaps"
priority: 9
role: "Solo build"
hook: "an AI race commentator for F1 23"
---

## AI Croft- F1 Game Commentator that provides commentary in realtime

I built a pipeline that takes UDP packet data meant for steering wheels, converts it into TypeScript objects, then translates it into natural language with a tuned prompt that gets sent to gpt-3.5-turbo (finetuning in the future?). Finally, gets sent to Tiktok’s open TTS api, which is then ffmpeg'd and piped into a discord bot which controls settings and reports race results.

First demo was done in one night, then tested and tuned over a race league with my friends.

Full in-depth overview and open sourcing are my next steps.

### Demo (Funny Moment)

::youtube{id="Qt-6oOMb4NQ"}
