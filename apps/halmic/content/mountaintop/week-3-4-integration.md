---
title: Week 3→4 - Integration
slug: week-3-4-integration
date: 2023-02-02
updated: 2023-02-09
description: A short week with one big milestone: hiking-pole controls finally talk to Unity from custom Arduino hardware over a serial connection.
order: 3
---
![Laptop running the Unity game next to an Arduino prototype wired to a breadboard](arduino.webp)

## Goals Heading into the Week

:::callout{type="note"}
Week 4 Goals

- GET THAT DEMO OUT BY FRIDAY
- Find a mentor finally
- Add music also by Friday
- Integrate hiking pole controls both in-game animations and functionally
- Menus, UI, core game systems
- Make the Tutorial song in Ableton (potentially)
:::

## An off-week…

Well, this week I didn’t get much done on the video game/logistics side. I had another project take up a lot more time than expected, so this week’s progress update will be a lot shorter and definitely sub-standard. That being said, let’s go into what happened- which actually is a pretty huge milestone regardless

## I N T E G R A T I O N

This is a group project, in case that wasn’t obvious yet. I’m working with Abby, who is in charge of the physical aspects of the project, to create an arcade-like installation with custom controls for the game.

Before we get into INTEGRATION, I wanted to note an important change- no more “punching” movements! Instead, they’ve been replaced by our new control scheme- hiking poles! Buttons on the bottom of the hiking poles will detect when you hit them, and you’ll have to time your “strides” to the beat. It’s also a satisfying “stabbing” motion that lets you really punish those pesky ghosts. Thank you to Danny- whose feedback lead to this change.

::youtube{id="uMgTF9HTlwI"}

Here’s our video of physical controls being finally implemented and in use! It’s a prototype at the moment, but the important progress here is the validation of our proposed interface between Unity and Arduino. Initially we tried to approach it from a keyboard emulation perspective, but this proved to be impossible with our hardware. Some development later, we were able to pivot to a custom Serial I/O solution, and thats what you see here! Current limitations include forcing wired communication via USB-C port, and it also currently requires manually inputting the Serial port id into Unity. Traditional controls still work with this scheme thanks to all that modular work from earlier weeks!

::youtube{id="kcZ4TMbLG3M"}

Here’s a closeup of the hardware side for your enjoyment.

### Recap

:::callout{type="note"}
Week 4/5 Goals

- GET THAT DEMO OUT BY FRIDAY
- Find a mentor finally
- Add music also by Friday
- Integrate hiking pole controls both in-game animations and functionally ✅
- Menus, UI, core game systems
- Make the Tutorial song in Ableton (potentially)
:::

Yeah, most of this did not happen. Will just ctrl+c, ctrl+v these other goals for Week 4→5.

Thanks for reading! It was a short update this week, but here’s to a more productive Week 5 😊
