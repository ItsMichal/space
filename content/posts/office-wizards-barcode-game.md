---
title: "Office Wizards"
slug: office-wizards-barcode-game
kind: project
description: "Turning Barcode Scanners and Printers to a Competitive Wizardry Game"
date: 2023-03-08
updated: 2023-12-09
tags: ["Unity", "Arduino", "Game Dev"]
cover: /media/office-wizards-barcode-game/cover.webp
coverAlt: "Playtesting Office Wizards: a laptop running the game, a barcode scanner in hand and printed barcode sheets on the table"
priority: 5
role: "Game developer"
gallery:
  - src: /media/office-wizards-barcode-game/img-7888-2435be.webp
    alt: "A printer wrapped in moss and flowers, opened up as the game enclosure"
    caption: "The printer enclosure"
  - src: /media/office-wizards-barcode-game/img-7894-3fdde7.webp
    alt: "Students playtesting around the mossy printer enclosure in a classroom"
    caption: "Playtesting in class"
  - src: /media/office-wizards-barcode-game/img-7822-3caafb.webp
    alt: "Whiteboard sketch of the game UI: two players, health and stamina bars, attack cards and a central pole"
    caption: "Early UI sketch"
  - src: /media/office-wizards-barcode-game/img-7828-1c667e.webp
    alt: "Arduino Nano on a breadboard with colorful jumper wires"
    caption: "Controller hardware, work in progress"
---

:::callout{type="warning"}
This write-up is not up-to-date! We demo’d the final version of the game at ATLS Expo 2023, and a video is coming soon with our final result. Stay tuned!
:::

## Office Wizards

![Play-testing the Office Wizards barcode game](/media/office-wizards-barcode-game/img-7894-3fdde7.webp)

Play-testing the game

![The printer enclosure for the Office Wizards game](/media/office-wizards-barcode-game/img-7888-2435be.webp)

Printer enclosure!

![A closeup of an early run of the game](/media/office-wizards-barcode-game/img-7905-a41ffc.webp)

A closeup of an early run of the game

## Beginnings of the Barcode Game

### Ideation

For a class project on alt arcade interfaces, we were tasked with creating a game that utilized a barcode scanner and a foot pedal. We brainstormed a few ideas, including a gunslinger game where the scanners are used as pistols to scan as many targets as possible, and a cooperative grocery scanning game since it had to be multiplayer.

![Whiteboard with scattered ideas for potential games](/media/office-wizards-barcode-game/img-0501-5c231c.webp "Ideas on a whiteboard for potential games. Just scattered thoughts.")

Ultimately, we decided on a battling game where players print out attacks (similar to a card battler) and use them to fight each other. We wanted to steer clear of the obvious game ideas involving grocery scanning, and while we enjoyed gunslinger, we were more excited about the idea of creating our own barcodes. This addition added a memory component since players would need to remember what barcode corresponds to a specific attack, and it also worked well with the multiplayer requirement. Max and I worked on this project together, with me handling the technical aspects and writing the Unity game while Max worked on the hardware and physical components.

## Development

The first steps in developing the project were to figure out the most technical aspects first. This was absolutely going to be the integration between Unity, the Barcode Scanner, and the Printer. The foot pedal integration would have been on this list if for my capstone I hadn’t already developed a neat and easy system for Unity to detect and read Arduino serial monitor output, and translate it to function calls within Unity.

### Creating the Barcode Generator/Printer

So I got started on a few ideas of how Barcode generation could work. I initially thought I could do everything within unity and leverage some C# features like [PrintDocuments](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.printing.printdocument.print?view=dotnet-plat-ext-7.0). Unfortunately, this ended up being a dead end. On macOS, which I was developing on, this API didn’t work. Noramally, [Mono](https://www.mono-project.com/) implements these .NET libraries and frameworks, and it actually did have a System.Drawing.Print implementation— however, a bug in Unity’s distribution of Mono prevented the right library from being loaded. A workaround that didn’t work for me is described below. I was already tired of wrangling with Unity and realized that my project wouldn’t work on other machines with this workaround. So I pivoted.

[Working with libgdiplus.dylib error on Mac and Unity](https://medium.com/xrpractices/working-with-libgdiplus-dylib-error-on-mac-and-unity-cd46181608b3)

I tried to externalize the printing and PDF generation away from Unity. First, I tried to see if Unity could call Python scripts, which it technically can but only inside the Editor- not inside the game. The purpose of this was to allow for custom devtools to be created, and would not work for calling a script inside of a game.

So I went to my next option which was to create a local web server that could receive a web request from Unity with data, and then do the PDF generation and printing. I went with a nodejs solution here since its what I’m familiar with and I found a few promising libraries.

During all this, we discovered a stupidly easy way of generating barcodes. I initially wanted to create a barcode generator on my own, but my initial searches found little technical details on just how to recreate barcodes. What they did find however, was the existance of barcode fonts. Barcode fonts were a huge timesave since now I could just load the font like any other and simply type out the code, using the [Code 39 standard](https://en.wikipedia.org/wiki/Code_39)  which was supported by our scanners.

::youtube{id="DbWkn4sR2Uo"}

So afterwards, I worked on wrangling with the PDF gen library to get barcodes to print neatly and one after another on a half sheet piece of paper, which was used to save paper, since we only estimated like 5-15 barcodes printed per game. I think its important to mention here that the original plan was to use a receipt printer, but we couldn’t get ahold of one. Using a receipt printer would have been much faster for the players and the game, and you wouldn’t have to fumble around to reprint- you could just tear off individual barcodes as they printed. But we didn’t have one, so the clunky experience of printing is just an additional challenge in the game ;)

::youtube{id="NbMLJ_yHi1Y"}

### Developing the Unity Game

So once the PDF generator/Printer web server was done, it was time to work on the actual game. We had a brainstorming session where we came up with a lot of great ideas, including a Rock-Paper-Scissors strategy system and cooldowns, timers, picking of attacks with the footpedal, etc.

![Sketch of the game UI: two players, health and stamina bars, attack cards and a central pole](/media/office-wizards-barcode-game/img-7822-3caafb.webp "UI/UX idea for the game- players on both sides, fighting game style health/stamina bar. Cards to represent attacks visually. Middle “pole” with arrows which would be controlled by foot pedal, selecting one of three random attacks depending on whose turn it was to print. A timer on top for the overall game time, and timer on the pole to represent when attacks refreshed.")

![Notes on attack types and the Fire, Water, Ice rock-paper-scissors strategy](/media/office-wizards-barcode-game/img-7825-39de75.webp "Ideas for attacks and Rock<Paper<Scissors< (RPS) strategy idea. We had Fire<Water<Ice< as our theme, and attacks/shields for all three types. Also had specials, like heals and attacks that would reduce enemy attack amounts by 1 or refresh your attack limit.")

![Notes on early design principles, such as attacks that scale up over time](/media/office-wizards-barcode-game/img-7823-2dc65a.webp "Some early principles we wanted to incorporate. In lieu of a tutorial, we wanted players to start off with weak attacks that barely moved health bars while they figured out the game. As time went on, attack strength would increase, so that the game would be more volatile and likely to end.")

Unfortunately, due to time constraint, a lot of these ideas were left unimplemented. We managed however, to get the basic game of attacking/healing done. The reason for this was just getting busy in life, but the real reason was that integrating the web server into Unity took a bit more time than expected. I ran into a few bugs and inconsistencies that didn’t have easily found answers- I had to find them myself rather than looking to Google or others. However, once I got everything hooked up, I had a few hours left to build the game. If I even had a couple hours more, I most likely could have implemented everything in a primitive state. Time is always an issue with games however, and I think you can never really put out a 100% complete game. I will say that I still hoped we could have implemented the attack selection, damage scaling, and RPS specifically.

## Class Demo Day

As with all things in life, the due date came and we had a nice project to present (almost) in time. It took a bit of setup and final finangling in class, but here’s a video of a full playthru.

::youtube{id="hSZSht_D7hM"}

Overall, even with a very very basic game, we got good feedback, it worked relatively well, and seemed to be somewhat fun. The biggest takeaways were to make the game more intuitive, or where it wasn’t, provide better player feedback and instruction. For example, I had to guide the basic game intro myself, but once it was done that players naturally understood what to do. Unfortunately, that was just frantically scanning and printing, so adding those previously designed features would have added some more strategy. Additionally, it might be a good idea to add a timing element- the barcode scanners were more responsive than expected, so perhaps by scanning at the right time, you could do bonus damage/effect.

Still, it was very promising to see that on the technical side everything ran as smoothly as you’d expect. Even messing up the print at the beginning was gracefully solved by the printer using its reserve of full-sized pages.

In the end, now that the technical side is more or less robustly solved, if this game had a future beyond this project, all it would require for a more polished/fun experience is just a bit more dev time on the game itself to add more engaging layers of player strategy. On the physical side, it would be nice to center the printer between the players- this was not done out of time and fear that the laptop might fall off- so an external monitor would be nice too!

## Max’s Work

This blog post was mostly about my contribution, but Max Epperson and I worked as a team on this! You’ll notice through the videos and images a lot that I didn’t mention (for example, why is the printer a cute green monster?!?) This is explained in Max’s post

:::callout{type="note"}
Max Epperson’s Writeup

Scroll down to the “Wait That’s A Controller?” section of the following link

[Alt Arcade — Max Epperson](https://www.maxepperson.com/alt-arcade)
:::

Here’s a few WIP images from Max’s side of the project in case you’re interested. Max was mostly responsible for the physical “real” aspects of the project and converting a musical Korg pedal into an Arduino-based controller for the game.

![Work-in-progress controller hardware by Max Epperson](/media/office-wizards-barcode-game/img-7828-1c667e.webp)

![Work-in-progress foot pedal controller hardware](/media/office-wizards-barcode-game/img-7878-2ddcf9.webp)
