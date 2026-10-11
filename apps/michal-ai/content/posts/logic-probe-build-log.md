---
title: "Logic Probe Build Log"
slug: logic-probe-build-log
kind: article
description: "This year I’m taking some cool courses as part of my Creative Technology & Design major at CU Boulder."
date: 2021-08-28
updated: 2021-09-10
tags: ["Electronics", "DIY"]
cover: /media/logic-probe-build-log/34-da30bd.webp
coverAlt: "Finished black logic probe with white L and red H LEDs fitted, blue and red cords on the right and a mint cord at the bottom"
series: "Object"
order: 1
originalUrl: "https://halmic.medium.com/logic-probe-build-log-part-1-2277172dad0e"
---

![Finished black logic probe box engraved Michal’s Logic Probe, with white L and red H LEDs and blue, red and mint cords, while a needle probe touches a Circuit Playground board](/media/logic-probe-build-log/01-66835b.webp)

This year I’m taking some cool courses as part of my Creative Technology & Design major at CU Boulder. One of these classes is ATLS 3300 — Object. Object is a class where we learn and use microcontrollers and basic electronics, to build really cool things. Our first matter of business this semester is to build a logic probe device, that will help us debug HIGH/LOW signals from our microcontrollers.

We followed the following instructions from a TA in the course.

[E-Textile Logic Probe - Debugging Tool](https://www.instructables.com/E-Textile-Logic-Probe-Debugging-Tool/)

![Hand holding the white logic probe circuit board with a blue LED, a red LED, transistors and resistors fitted](/media/logic-probe-build-log/02-11c3f4.webp)

![Lab workbench cluttered with a tray of supplies, a ruler, scissors, tape and paracord](/media/logic-probe-build-log/03-ae164c.webp)

![Bags of resistors, LEDs and other components laid out on a wooden table](/media/logic-probe-build-log/04-9f37e6.webp "Our materials. (Left) Custom PCB with components inserted. (Middle) Paracord and heat shrink. (Right) The electronic components")

After receiving instructions from our TA [Chris Hill](https://chrisnhill.com), we set off with the provided PCBs and fitted the components (also provided). This was relatively simple to do, and there’s not much of note here, except that the LEDs where removed as they are installed after the enclosure is built.

![Two lengths of mint paracord and a tangle of white thread on a table beside a laptop](/media/logic-probe-build-log/05-f8ae66.webp)

![A strand of thread held between fingers next to a large sewing needle on a dark wooden table](/media/logic-probe-build-log/06-c148de.webp)

![A thin wire soldered to the eye of a sewing needle on a piece of white fabric](/media/logic-probe-build-log/07-82ceab.webp "Threading and soldering the needle for the probe wires")

![Two lengths of mint paracord with sewing needles attached at their frayed ends](/media/logic-probe-build-log/08-015681.webp)

![Two long mint paracord strands laid out on a table, with needles at one end and thin wire trailing from the other](/media/logic-probe-build-log/09-fa80e1.webp)

![Two finished probe tips: sewing needles sticking out of paracord covered with blue heat shrink](/media/logic-probe-build-log/10-3cf808.jpg "Process of assembling the two probe wires. Finished probes on the right")

Next up on my plate was to create the probe wires. These are what will be used to test for HIGH/LOW states on the microcontroller. If I haven’t mentioned it already, I’ve been working on this project with my lab partner [Ethan](https://wangtime310438371.wordpress.com/category/object/). While Ethan got to work soldering the connections on the PCB, I went out to cut and build the probe wires. We chose a nice shade of mint for our paracord, and I soldered two thin wires to sewing needles (our probe). The fairly challenging part was then threading the wire and needle through about a foot’s length of paracord. Once that was done however, two pieces of heat shrink finished the build.

![A soldering iron touching the logic probe circuit board, with wire cutters nearby](/media/logic-probe-build-log/11-35507f.jpg)

![Hand holding the circuit board with resistors, transistors and a diode soldered in and the LED positions empty](/media/logic-probe-build-log/12-718441.jpg)

![Back of the circuit board showing soldered joints and traces, held in a hand](/media/logic-probe-build-log/13-ec6d33.jpg "Ethan in progress soldering of the first PCB")

![Two assembled probe circuit boards side by side on a table, printed Craft Tech Lab 2021](/media/logic-probe-build-log/14-01c84c.jpg)

![Two circuit boards at an angle on a table, showing their solder joints](/media/logic-probe-build-log/15-0b7c31.jpg "Finished PCBs- mine left and Ethan’s right")

As I mentioned, while I worked on the probes, Ethan was soldering our first PCB. I say first, because it was at this point I decided to make my own as well. Mainly to improve on my soldering skills, but also I felt that this would be a useful tool in future projects. The soldering went well, and I tried to take my time to create a nice looking circuit board.

![Blue, red and white wires cut to length beside wire strippers and masking tape](/media/logic-probe-build-log/16-2a0342.webp)

![A blue paracord end with stripped white wire, next to an alligator clip](/media/logic-probe-build-log/17-ac1053.jpg)

![Blue and red cords with alligator clips attached and covered in matching heat shrink](/media/logic-probe-build-log/18-93feb4.jpg "Assembling the red")

To finish the day, I fabricated the power and ground wires. Twice the Logic Probes means 4 total wires to create. The technique here was similar to the probe wire, except that alligator clips and crimping were used instead of needles and soldering. I wrapped the exposed wire around the alligator clip, crimped it tight with some pliers, and used some heat shrink once again to finish it off. I messed up a little bit on the first red wire by using too much heat shrink and letting the paracord get away, and you can see this in the third photo. Fortunately, there’s no drawback other than looking a little wonky.

![Bundle of blue and red cords and two mint probe cords lying beside two assembled circuit boards with LEDs standing up](/media/logic-probe-build-log/19-bc831e.jpg)

![Close-up of the cable ends: alligator clips on the blue and red cords and needle probes on the mint cords, finished with blue heat shrink](/media/logic-probe-build-log/20-589094.jpg "Finished progress for the day.")

And with that done, part 1 is complete! Next steps include 3D printing the enclosure, soldering the LEDs, and final assembly and testing. We’re almost there!

---

![3D render of the black housing lid, engraved Michal’s Logic Probe, with holes for the L and H LEDs](/media/logic-probe-build-log/21-8d700f.png)

![Fusion 360 view of the housing top with the engraved name on a triangulated mesh surface](/media/logic-probe-build-log/22-aea956.webp "The customised housing top")

Alright- It’s now time to finish this! First off, I 3D printed the enclosure for the probe. Now I could have just used a provided .stl file — but that’s boring. I customised it with my name instead in Fusion 360. This was relatively painless- but Fusion 360 probably isn’t the best for editing .stls. The final geometry is a good example of why. It would have been nice to have access to the original Fusion 360 files, but it turned out fine enough in any case.

![Hand holding the first print of the housing top, with the engraved lettering distorted and rough](/media/logic-probe-build-log/23-f07888.jpg)

![Hand holding another printed housing part with visible layer lines, in front of a Prusa i3 MK3 printer bed](/media/logic-probe-build-log/24-13353d.jpg)

![Printer nozzle over a print in progress on the bed, with the lettering visibly distorted](/media/logic-probe-build-log/25-7022a9.jpg)

![Hand holding the reprinted housing top, with a clearer engraved name and the L and H holes](/media/logic-probe-build-log/26-e0db25.jpg)

![Printed housing top, a small cone-shaped part and the shallow lid lying on the Prusa print bed](/media/logic-probe-build-log/27-70492b.jpg "Print, print, print")

After slicing the .stl in Cura, printing itself proved a challenge, as the first print totally butchered the custom top. Turns out I made the bed too hot and the nozzle temp too low for this amazing shiny black filament. Luckily the other two parts printed well enough, and so with some adjusted settings I was able to reprint the top (mostly) successfully. Unfortunately, the Prusa i3 was set up to be a bit too hasty and still butchered the “H”, but in the name of conserving filament I called it okay enough.

![Black printed housing top and lid beside the assembled circuit board on a wooden table](/media/logic-probe-build-log/28-75bc8e.webp)

![Ends of mint, red and blue paracord with melted, fraying fibres and grey wire coming out](/media/logic-probe-build-log/29-b2ef1e.webp "Assembled parts. Also, off camera I used a soldering iron to melt the paracord to prevent fraying. Should have done this earlier.")

![Circuit board with grey and pink wires soldered through the board and blue and red cords attached](/media/logic-probe-build-log/30-b3cd6f.webp)

![Circuit board with a large lump of hot glue holding the wires, and a loose red LED beside it](/media/logic-probe-build-log/31-b9914f.webp)

![Circuit board with a smaller amount of hot glue strengthening the wire joints](/media/logic-probe-build-log/32-c55310.webp "Soldering the power cords and probe to the PCB, then strengthening with hot glue. Too much glue in the middle picture, so right picture shows the “better” version.")

Finally, it was time to assemble and do final soldering. I started by soldering the wires made earlier to the board. I cut off the excess wire, stripped about an inch, and looped it through the PCB before soldering it in place. As recommended by our class guide, I then used a generous amount of hot glue to strengthen the hold and to prevent the wire from snapping off. Unfortunately I was a bit too liberal and had to reglue it with a bit less.

![Underside of the circuit board seated in the black housing, showing solder joints, with red and blue cords exiting](/media/logic-probe-build-log/33-c57ae3.webp)

![Finished black logic probe with white L and red H LEDs fitted, blue and red cords on the right and a mint cord at the bottom](/media/logic-probe-build-log/34-da30bd.webp "After soldering in the LEDs")

For the final step, I fit in the PCB with LEDs. After making sure the alignment was good, I folded the LEDs pins in place and soldered them to the board. As you might notice, I chose to use a white LED instead of a blue one. They both have similar voltage drops/current draw, so it shouldn’t be a problem overall. I think it adds a bit of uniqueness in addition to the custom housing. Plus it looks cool! After soldering the LEDs in place, I used a wire cutter to cut off the excess pins and finish off the Logic Probe.

![Logic probe on the workbench with alligator clips on its blue and red cords, beside a Circuit Playground board and a spool of solder](/media/logic-probe-build-log/35-d5040a.webp)

![Hand holding the finished logic probe, showing the engraved name and fitted LEDs](/media/logic-probe-build-log/36-bfaf6f.webp)

![Close-up of the logic probe with the white L LED lit](/media/logic-probe-build-log/37-f4b14e.webp)

![Needle probe touching the Circuit Playground board while the probe’s white L LED glows](/media/logic-probe-build-log/38-f64748.webp)

![The same test with the red H LED lit](/media/logic-probe-build-log/39-227e55.webp)

![Needle probe touching the Circuit Playground board with the white L LED lit](/media/logic-probe-build-log/40-8053e8.webp "Final product!")

And that’s that! As you can see, the probe works flawlessly in testing, showing Low when touched to ground and High when touched to a 3.3v source. The build quality turned out pretty good despite the print and some problems trying to finesse the excess wiring for flush enclosure fit. The mint paracord also feels a bit…loose? I’m not sure why but it definitely doesn’t feel as good as the blue and red paracord. Still, I like the look.

In the end I had a lot of fun refreshing my soldering skills, as well as 3D printing and CAD’ing for the first time! This is a great project that not only is simple enough for beginners, but is also a very useful tool! I highly recommend trying it out for yourself.
