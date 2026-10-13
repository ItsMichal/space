---
title: Week 4→5 - Deluxe Combos
slug: week-4-5-deluxe-combos
date: 2023-02-16
updated: 2023-02-23
description: MIDI-driven beatmaps, music, combos, SFX and the first standalone build of Project Mountaintop, plus playtester and mentor feedback.
order: 4
---
![Project Mountaintop gameplay with combo and score UI](combos.webp "Is the vision coming through? 👀")

## Goals Heading into the Week

:::callout{type="note"}
Week 5 Goals

- GET THAT DEMO OUT BY FRIDAY
- Find a mentor finally
- Add music also by Friday
- Menus, UI, core game systems
- Make the Tutorial song in Ableton (potentially)
:::

These are mostly the Week 4 goals that were left behind. So let’s get caught up!

## Adding MIDI Beatmapping

I could have just added the music to the existing beatmaps that I’ve been using, but in the long run its much faster to have a MIDI file reader that generates a beatmap for us from it. MIDI files are commonly used in music production, and so theoretically down the line I could have composers create prototype beatmaps within the work environment their comfortable with. Additionally, it saves me some time from creating a custom beatmap editing environment, which would take a lot longer to do.

That being said it’s something that definitely should be done, but most likely only if this becomes an actual game. MIDI files are limited to basic, well, note information. So I can get tempo, pitch, velocity- but those are the only controls. Any action that might require more specific parameters (say, a custom color perhaps?) can’t be well-represented by MIDI.

[What are MIDI files and how to use them? - Jacob's Piano](https://jacobspiano.com/2020/10/12/what-are-midi-files/)

So to get this done, I copied the technique from the very very first prototype. I used the DryWetMIDI library , which is quite easy to use to read through all the notes in a MIDI file. I then assigned two pitches to two actions- if it reads a C note, it spawns a blue ghost, if it reads a C# note, orange ghost. It also helps me with converting from MIDI time into ms time, as well as getting BPM which will be useful later.

[drywetmidi](https://github.com/melanchall/drywetmidi)

We ended up with the following, which might look familiar to our old demo on the left…

::youtube{id="p2UTKh5S_t8"}

::youtube{id="hGpmhvgz9vY"}

## Facing the Music

Well that’s good and all… but where’s the music?

That’s the easy part. An AudioClip, some parameters here, make sure to start at the right time to sync everything, and boom. The basic game? It’s done. Time to get some feedback!

First off, I had Danny play the game. I got really positive feedback from Danny, who suggested that the game as shown should be the game. As in, the rest of development should be in service of just improving what he had played.

Then I showed Nino, who’s played a few rhythm games the game, and he had some great specific feedback on it.

::youtube{id="Bo3wJLjhHhk"}

:::callout{type="note"}
Nino’s Feedback Summary

- Add SFX feedback
- Really ensure better communication on whether users miss or hit notes, sound, or visually
- Add UI/UX elements to the center of the screen
:::

## Iteration, Combos, and The Meaning of Life

So immediately afterwards, I started implementing Nino’s feedback. In the interest of skipping out on a lot of technical writing…

### Really Boring… and poorly written explanation of boring boring code work

I simply extended the debug script that had already been tracking the perfect counts for combos. I added a SFXManager script that was called by RhythmSystem to add the tempos. The timer was another extension of the overall system- similar to the Debug script actually. Finally, I added a hacky little BPM script to the RhythmSystem for the clicks on the beat. (This actually helped a ton to ensure that there wasn’t any desync between this new beat-based timing system vs. the existing millisecond based one).

So a bit of magic later, some compile time, and we got our first standalone build! New features include combos, scoring, SFX, basic instructions, and new prototype UI elements!

::youtube{id="8oJoEXIenfU"}

Anyways woo! We got our first build done. Let’s talk about distribution… the real issue.

First off, I can only make a successful build on macOS, which limits userbase dramatically. Until I can get a Windows build, most people won’t even be able to play. I tried a Web based build, but I got an error with the MIDI file reading I’m not sure I want to take the timesink to resolve.

Plus, it lagged pretty bad.

I’ve set up a chat server, but I feel it’ll take some “pushing” to get people past the download/install barrier.

## Net Working

We also do a bit of networking! In getting Nino’s feedback, I reached out to Jon’s session. I might be able to come back to his capstone session for feedback from other members at later times.

I also reached out to David, who runs the Sound course. I had him play through my demo and also got really positive feedback. David offered to connect me with the Music Production club in search of original music. I also might have a lead on a potential external mentor through this as well.

However, I’m still in a bit of a rut with finding a true, technical external mentor. Most of my time this week was spent on making up the game dev progress with the game, so I’ll have to rely on David’s lead for now, and next week I’ll follow up and find alternatives.

## Recap

:::callout{type="note"}
Week 5 Goals

- GET THAT DEMO OUT BY FRIDAY
- Find (an external) mentor finally
  - We have progress! 🤞
- Add music also by Friday
- Menus, UI, core game systems
  - No menus, yet, but yes UI and core
- Make the Tutorial song in Ableton (potentially)
  - Just not that high priority as making menus. Using existing music saves a lot of time for game dev— and can always come later
:::

Overall a much better week, and the game is really starting to take shape. Next week will most likely be continued polish, and looking to establish a strong feedback development cycle with testers. As we push into Week 6 and the halfway point, its going to be important to time the pivot from feature development to polish and experience-enhancing development with precision. The current target is Week 8, so that means planning out getting every single feature done in 2.5 weeks.

Luckily, I’ll be competing/mentoring/hosting at T9Hacks this week. Of course, I’ll be doing the games track. And of course, I’ll be working on Project Mountaintop. Maybe I’ll be able to come up with a name for the game finally…

Thanks again for reading!
