---
title: "Week 5→6 - SPAAAAACE!"
slug: week-5-6-space
kind: article
id: mountaintop-week-5-6-spaaaaace
description: "T9Hacks week: a space theme, a new UI, a Hans Zimmer beatmap made in 15 minutes, and a humbling attempt at 3D character modelling."
date: 2023-02-16
updated: 2023-02-23
tags: ["Project Mountaintop"]
parent: project-mountaintop
series: "Progress log"
order: 5
---

![Project Mountaintop gameplay on a space theme: an astronaut running over Earth with score, hit tallies and a combo counter](/media/mountaintop-week-5-6-spaaaaace/screenshot-2023-02-23-at-1-20-16-am-376f5f.webp)

## Week 6 Goals

:::callout{type="note"}
Week 6 Goals

- Get in contact with external mentor and ask for feedback (early next week)
- Add menus (this weekend @ T9)
- Add new interactions other than just ghosts (jumps, etc) (this weekend @ T9)
- Start work on environments (this weekend, maybe post T9)
- Finalize art style for final game (post T9)
- (Potentially) Make one original/tutorial song, but not a priority at all (post T9)
:::

### T9Hacks in Space

A lot of this weeks development took place over T9Hacks. Most of the work was done on theming the game. I was quite burned out after learning and grueling over the process of 3D modelling a custom character, as well as researching techniques to make our game look unique through a combination of 3D/pixel/lo-fi graphics. This is the main reason why a lot of the goals for this week weren’t really done- rather I targeted perhaps what would have been next weeks goals.

I’ll write up more in detail but I think the new look of the game can speak for itself for now.

::youtube{id="GrNBZuSuJQ0"}

If you go back and compare this to last week’s build, you’ll see a whole new layer of polish- as well as a new theme! One of the goals that I hit was establishing more of the art style. I want to go for a low-poly pixel look for the main character, using techniques similar to a short hike

![Reference for the low-poly pixel art style used in A Short Hike](/media/mountaintop-week-5-6-spaaaaace/gif1-59e16a.webp "A short hike’s solo developer- Adam Robinson-Yu, made a great case for this artstyle in his GDC postmortem which I watched in its entirety.")

This is due to the relative low cost of creating lo-fi 3D models, and a resulting unique look that utilize shader programming and 3D graphics techniques— well known and “tutorialized” ones I cna follow. With one of the biggest upcoming time costs being asset creation, minimizing this cost while still delivering a stellar look has been a huge goal.

So going back to the demo… clearly this isn’t the artstyle. I got really burnt out by spending most of my time practicing 3D modelling and character rigging for animation, and the last thing I wanted to do was spend more time scratching my head over shaders and 3D graphics. So instead I focused on my bread-and-butter- UI/UX

Most of the overhaul here is a complete rehaul of pretty much every element. Some got direct UI improvements- I made my first custom UI textures in photoshop for the Perfect→Good→Poor→Miss system. This was also simplified— you’ll notice the Abysmal hits have been removed based on some great feedback and playtesting by Gray Assi.

You’ll also see on the technical side that a new song has been mapped and this proves that my modular system works great. I ran into very few errors (and those were mostly self-inflicted in my rush to submit by the T9Hacks deadline), and it was a really smooth process creating a new song. You’ll also see a new UI element that tracks your progress through the song on the bottom left- completely custom made as well, without spending too much time.

![The online MIDI program used to make a beatmap for the Hans Zimmer song](/media/mountaintop-week-5-6-spaaaaace/screenshot-2023-02-23-at-1-10-57-am-fdc89d.webp "How the beatmap for Hans Zimmer’s song was made… 15 minutes in an online program. The entry barrier is quite low, and its quite easy to make and test edits. Can you guess which part of the video this correlates to?")

Of course, the largest change is the environment. No more beta textures, we finally have an environment! The theme for T9Hacks this year was space, so I made a quick space environment and used a very space-y song (props if you know which 2011 movie it comes from). I’ll say first off— the song is a terrible choice for a rhythm game, and I know the chart is unappealing to play since I made it in 15min. But I like the environment a lot, and it gave me ideas for the final “theming” of the game.

So, for the final game, we are going to aim for three re-usable environments/themes that we can pair with songs. The first will be the original hiking/mountain theme. The challenge here will be orchestrating player movement to the beat. Similarly, based on feedback a skiing/snow/alpine theme. And finally, a more abstract, perhaps space-like theme for songs that don’t really match the vibes of the first two.

### (BONUS) Model Practice

![Low-poly character model rigged in Blender, holding two hiking poles in a T-pose](/media/mountaintop-week-5-6-spaaaaace/screenshot-2023-02-23-at-12-32-47-am-6e307b.webp)

I mentioned 3D modeling. It was not great. I spent quite a few hours stumbling around to get a model that isn’t quite what I want. I’ll probably revisit modelling the main character and try one more time before switching to a pre-made asset and just giving it some hiking poles. I’ll also need to animate/rig which is a whole job position as well. Being a one-man team on the game development side is tough! I think I’ll make it a goal to try and outsource a bit more to other students or premade assets if its possible, so I can focus on my strengths- mainly programming and UI/UX.

That being said the above model could totally work in game, its fully rigged and the only reason its not is because it looks bad, its untextured, and unanimated. I also had some issues exporting the rig and model from Blender in Unity, and by that point I was just so tired of this I gave up and moved on to the changes you just read about.

### Week 6 Recap

:::callout{type="note"}
Week 6 Goals

- Get in contact with external mentor and ask for feedback (early next week)
  - I had some hope thru David Schaal, but haven’t gotten replies yet. I’ll go back to reaching out and taking more intiative.
- Add menus (this weekend @ T9)
  - Eh, I was debating to mark this as orange but I really just focused on polishing the main game. I didn’t do the menus like I wanted, even if I made similar progress elsewhere this week.
- Add new interactions other than just ghosts (jumps, etc) (this weekend @ T9)
  - Not mentioned in the post, but after meeting with Abby, we finalized a control scheme revolving around six inputs (Left/Right SideStab, Left/Right Stab, Left/Right Foot). I’ll be implementing these next week (so likely- no jumps, and this would’ve needed a redo. So we avoided a timewaste by not doing this)
    - This shows how important comms with Abby are, so I’ll want to make sure I’m not writing goals before I’m synced up in case this might happen again and I actually do timewaste.
- Start work on environments (this weekend, maybe post T9)
  - Yeah this is what I actually ended up working on the most. I will say I wish I did more work post-T9 but I had some real-life/external factors get in the way.
- Finalize art style for final game (post T9)
  - This is more or less finished, but I’ll mark it as yellow only bc personally I want to sketch out a few ideas/create a guideline doc for the artstyle before I call it “done”
- (Potentially) Make one original/tutorial song, but not a priority at all (post T9)
  - I’ll make this eventually, and even if I don’t its not a critical component of the project. I’ll probably remove this as a goal, bc its more of a “nice” thing. Defo not a priority for a complete and polished game.
:::
