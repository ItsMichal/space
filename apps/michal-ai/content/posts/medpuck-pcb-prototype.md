---
title: "MedPuck PCB Prototype"
slug: medpuck-pcb-prototype
kind: article
description: "This is a continuation of a previous article. For more context about the MedPuck device, read that article here."
date: 2021-11-02
tags: ["Electronics", "Design", "DIY"]
cover: /media/medpuck-pcb-prototype/cover.webp
coverAlt: "Fingertip pressing the blue pushbutton in the assembled MedPuck while the LED ring glows green"
series: "Object"
order: 5
originalUrl: "https://halmic.medium.com/medpuck-pcb-prototype-e7bbe87de941"
---

This is a continuation of a previous article. For more context about the MedPuck device, read that article [here](/writing/creating-my-first-pcb-object).

![Hand holding the bare round MedPuck PCB, with white silkscreen labels and a coin cell outline](/media/medpuck-pcb-prototype/01-7b2d0b.webp)

![The bare MedPuck PCB sitting inside the grey 3D-printed ring and white outer shell](/media/medpuck-pcb-prototype/02-32ea12.webp "It’s here! It’s finally here!")

3 weeks later, we received our PCB from JLCPCB. It came in excellent condition and the white silkscreen was as sleek as ever. Since all the traces are on the first layer, we could visually see that everything was routed correctly. I’m also really glad I made use of the text tool to create better labels for which side goes where. Unfortunately, I noticed immediately that I had spaced the alignment pegs on the closure a little too far apart. Without a caliper at my disposal, a fix for this would have to wait- but thankfully this fix should be simple to design and reprint, and does not require another 3 week wait for our PCBs!

![Components laid out beside the PCB: a capacitor, a trim pot, an 8-pin socket and chip, a pushbutton, a coin cell, two resistors and a NeoPixel strip with wires](/media/medpuck-pcb-prototype/03-de4e91.webp "Components- assemble!")

Using the schematic we designed in the last article, finding the right components was a breeze. We also reused the ATTiny85 microcontroller (meaning that it is already programmed with our code) and the same LED strip so that we didn’t have to modify any of our previous code to make it work. The rest of the components were generic, and specified in the schematic.

![Soldered MedPuck PCB with a coin cell, trim pot and pushbutton and yellow and red wires, beside the grey printed ring](/media/medpuck-pcb-prototype/04-1c6fa7.webp)

![Hand holding the NeoPixel strip next to the grey 3D-printed ring](/media/medpuck-pcb-prototype/05-44915c.webp)

![Soldered PCB with the coin cell fitted, seated in the grey printed ring with wires coming off the top](/media/medpuck-pcb-prototype/06-2e90ee.webp "Assembling the assembly")

Soldering the components proved pretty simple. The only “mistake” of note is keeping the capacitor upright, instead of laying it flat. Technically this is correct, however seeing it assembled like this made Ethan, our teammate realize that it blocks the trim pot. This prevents us from having a gear driven trim pot as it would collide with the capacitor as the PCB is currently laid out. This could either be fixed with a PCB revision that moves the capacitor elsewhere, or by laying it out. Alternatively, another mechanical solution to turning the trim pot could yet be devised.

However, while the PCB components were soldered on nicely- the LED strip posed its own mounting challenges. This included the soldered on wires becoming disconnected, the solid core wire now presenting a massive annoyance when trying to fit said wires in enclosure, and at one point the mounting hole for the logic pin becoming clogged with a piece of solid core wire. However, with some monumental effort, we were able to mount and fit everything inside the enclosure.

![Fingertip pressing the blue pushbutton in the assembled MedPuck while the LED ring glows green](/media/medpuck-pcb-prototype/07-04ec4f.webp)

![Top view of the assembled MedPuck with PCB, coin cell, blue trim pot and pushbutton inside the grey ring and white outer shell](/media/medpuck-pcb-prototype/08-773788.webp)

![Assembled MedPuck prototype surrounded by three bare MedPuck PCBs](/media/medpuck-pcb-prototype/09-ad31c5.webp "The final first- I guess technically second MedPuck prototype!")

To our surprise, once everything was assembled and in place, the system worked flawlessly! This was a great success, as it meant we didn’t screw up the wiring and PCB design. Unfortunately, some mechanical issues cropped up- mainly with turning the trim pot. The current design tried to use a gear and rubber band system. While the outer white shell did turn the inner gear, when we tried to add a rubber band, we found that there wasn’t enough friction to turn the trim pot. When we tried to increase the friction by folding the rubber band, we snapped the axle of the gear. It seems clear from this testing that a rubber band would not be able to reliable turn the trim pot, so we have to go back to the drawing board on this one. A temporary solution is to just remove the cap and turn the trim pot manually to make changes.

Additionally, the cap must be redesigned slightly as the capacitor once again is a bit too tall and the portion of the cap that snaps fit to the button is not tall enough. This is a very simple change that would only need a small design tweak and subsequent reprint of the cap. That is why the cap is also not shown in the photos above.

Finally, I took a video to demonstrate the MedPuck in action. As a reminder- when all green lights are lit- its time to take the meds. When you turn the trim pot, you select between 4, 6, 8, 12, and 24 hour intervals. After they blink, the selection is confirmed and the timer restarts. Note that this is a prototype firmware as well and future versions will make it more clear as to when to take meds, as well as tweak the configuration process. One final thing- the board is only powered when the switch is pressed, as an energy saving feature. This means that configuration can only happen while the medication is on the pedestal, or a user is pushing it down. This quirk is also open to change in potential future versions, especially after battery life testing is done.

::youtube{id="84n9oLqIYtQ" title="MedPuck Prototype Enclosure and PCB"}

And finally, for reference, here is the Gist- containing schematics, Gerber files, and code. Feel free to remix our project with accreditation! Specifically, this work is licensed under GPLv3 with the Commons Clause.

[MEDPuck - Medicine Timer - .ino, Gerber, and Schematic](https://gist.github.com/ItsMichal/d6447a63577c7a86f83c25ce52554f1f)
