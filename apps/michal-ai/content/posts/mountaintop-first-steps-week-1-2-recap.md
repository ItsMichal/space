---
title: "First Steps - Week 1→2 Recap"
slug: mountaintop-first-steps-week-1-2-recap
kind: article
description: "Starting Project Mountaintop’s rhythm game from scratch in Unity: a modular rhythm system, ghosts, and a hilariously buggy first prototype."
date: 2023-01-19
updated: 2023-02-02
tags: ["Project Mountaintop", "Rhythm"]
parent: project-mountaintop
series: "Progress log"
order: 1
---

## How hard can (re)creating a rhythm game be?

For our first week of “real” progress, I started from scratch. Keeping in mind the MIDI game idea, I  started a new project on my MacBook. But not before a bit of brainstorming.

:::callout{type="note"}
Week 2 Goals

- Get basic rhythm game done (Start->Select Song->Play->Score->Repeat or End)
- Start reaching out to third-party developers
- Create an overall outline and rough design docs for the overarching final game (story, gameplay loop)
:::

### New Ideas

We started off with a brainstorming session to iterate on the rhythm concept, which is now the core focus of the final project (RPG systems and other goodies to come as a last prioirity). We ended up sketching out a new perspective, and a new approach to the rhythm aspect- trading the Guitar Hero esque “notes falling from heaven” approach to one similar to Muse Dash- a runner where timing and rhythm are critical.

![Hand-drawn sketch of a hiker running past ghosts toward a hit guide, with helmet light, water and night cycle ideas](/media/mountaintop-first-steps-week-1-2-recap/488238f2-2c68-45eb-bb49-d11639b9a1d7-795fcc.webp)

While its a pretty rough sketch, we came up with a lot of unique ideas. The main premise is to fight “ghosts” which are really just rhythm beats. You run into them and then have to hit an input (first on keyboard, later on our custom controllers) with precise timing. We came up with a few spins too, like a day/night cycle affected by rhythm (you’d have to turn on your headlamp to see ghosts), or a water/stamina/health meter that can be refilled by drinking from a “water bottle” during breaks in the song. To start though, we agreed on implementing the “ghost” system first.

### Initial Development

I ended up deciding to use my MacBook for this project so I can be more flexible with where I work. While I’m undoubtedly more efficient on my desktop, especially in 3D development, I’m rarely at my apartment and find it harder to stay focused. So, despite the limitations of working in 3D with a trackpad, I created a project. Luckily, Unity has run smooth so far, and development has been a bit of a breeze, even if this week was quite busy

![Early Unity prototype with a capsule character and placeholder objects on a green plane](/media/mountaintop-first-steps-week-1-2-recap/screenshot-2023-01-25-at-5-26-10-pm-eb143c.webp)

I will be using placeholders for the forseeable future. I plan on making a huggge graphics/animations/etc push at the end, but using capsules and basic elements allows me to focus on the parts I can do best on my laptop- the code.

Oh and there’s code.

#### The Hand

Instead of following a tutorial like last semester, I began to leverage my computer science knowledge (trademark pending) in order to develop a system that I thought made sense. I first animated the little hand there and attached it to controls. Nothing too special, just a few Transforms to tell it where to go, and a nice little Slerp combined with some deltaTimes here and there to give it a simple animation.

:::callout{type="tip"}
Slerp - a Spherical Linear Interpolation, I used it to make the hand movement more natural for cheap.

[Vector3.Slerp](https://docs.unity3d.com/ScriptReference/Vector3.Slerp.html)
:::

Here’s how that turned out- you might notice I even added a neat little “auto-align” feature that holds the character perpendicular to the ground. Probably only useful until I have to animate an actual character though (and use IK… but that’s getting way ahead here).

::youtube{id="EngAOffWsa4"}

#### The… Rhythm and the Ghosts?

:::callout{type="tip"}
Note- anything highlighted blue is a .cs file or class or code snippet- see blue? Thats a code thing! This being a notable exception 😉
:::

Okay.

Here’s where things get complex.

My basic approach here was to have a script, RhythmSystem, that utilized a bunch of subscripts/classes and cool Object-Oriented principles in order to create a relatively modular, highly configurable system. It would rely on RhythmMap for example, to actually hold the events and timing data (this would eventually be generated using MIDI files as before).

So, Rhythm System would take these RhythmMaps and read them. Then, it would sent out events based on when an event/action comes up in said RhythmMap. Where would these events go? Well, to a RhythmBeatHandler! This is a template class basically that my first handler, GhostSpawner inherits and overrides.

GhostSpawner would take these events, and  spawn Ghosts that fly at the player and must be dealt with a precise swing of the fist! These Ghosts’ movement would be controlled by, you guessed it, GhostController since GhostSpawner is more of a delegate.

:::callout{type="note"}
RhythmEvents include when to Spawn, when to Hit, if it was successfully hit, and if it should delete itself bc its past its time.
:::

Whew!

So with the power of Github’s Copilot at my back, saving me a ton of time from looking up Unity’s documentation every 5 seconds, albeit at the cost of sometimes dubious logic… I whipped up a quick 5-600 lines of code and had my basic components filled out. It was time to test.

:::callout{type="note"}
Github’s Copilot is a nifty AI tool that I try to leverage whenever I can. While its not a drop-in replacement for writing code yourself, it saves time trying to finangle syntaxes. If you know what you’re doing but want to save time. Check it out.

[GitHub Copilot · Your AI pair programmer](https://github.com/features/copilot)
:::

And here’s what happened

::youtube{id="2DPVz25OXSM"}

Well… It’s doing something. The largest problem here is that the timing is off in the GhostController . It seems to be receiving all the right values but the lerp ing this time (no more Slerp, sorry). is just off. I chose the video above bc it was a hilarious example of when bugs can be somewhat entertaining, and interesting, but the reality of the debugging was much more boring- going though the whole RhythmMap → RhythmSystem → GhostSpawner → GhostController was certainly a pain, as was cleaning up some of Copilot’s mistakes.

In the end I didn’t have time to really figure everything out. It seems to kinda sorta work system-wise, but the visual aspect is off and its hard to tell using the console. I can already feel I’ll have to make changes to sync up the timing more, as we have variances of 5-10ms already, potentially more. 5-10ms is not a lot, but if it adds up, well a rhythm game is going to feel terrible.

### Summary and Looking Forward

:::callout{type="note"}
Week 2 Goals

- Get basic rhythm game done (Start->Select Song->Play->Score->Repeat or End)
  - Thought I would have more time but at least we have… something!
- Start reaching out to third-party developers
  - Oof. Did not do this.
- Create an overall outline and rough design docs for the overarching final game (story, gameplay loop)
  - Okay! We have basically this, but more could be done too
:::

Well obviously figuring out the bugs is step one, and step two will be to build in the supporting systems like scoring, menus, etc. Getting to the point where we can demo asap is a must. I also want to keep fleshing out design docs, especially for UI and such. If the debugging doesn’t take too long- having a basic song select and 2-3 maps done for testing would be a huge help.

Speaking of testing, reaching out to developers is another thing! I want to have more I can show off first though, so future developer and potential mentor, hello! If you’re not one… well that’s awkward. But something that’s also a priority.

Ultimately tho its pretty satisfying to see to player’s “hits”. Just giving the player something to hit is now the next big step in validating the idea.

See you next week!

[halmic.co](https://halmic.co)
