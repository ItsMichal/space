---
title: "Making a (literal) ThreadBoard constellation!"
slug: making-a-literal-threadboard-constellation
kind: article
id: making-a-literal-threadboard-constellation
description: "First off- obligatory explanation of what the heck a threadboard is."
date: 2021-09-08
tags: ["Electronics", "DIY"]
cover: /media/making-a-literal-threadboard-constellation/cover.webp
coverAlt: "Constellation of steel balls and magnetic bars shaped like the Big Dipper on blue foam with hand-drawn stars and handwriting, with a yellow glow underneath"
series: "Object"
order: 2
originalUrl: "https://halmic.medium.com/making-a-literal-threadboard-constellation-cda34539ecac"
---

First off- obligatory explanation of what the heck a threadboard is. If you haven’t seen my other post, our TA [Chris Hill for this course co-created this concept!](https://dl.acm.org/doi/pdf/10.1145/3430524.3440642)

[ThreadBoard](https://www.colorado.edu/atlas/threadboard)

In essence, its a debugging tool for e-textiles. Its a specific layout of magnets inset in acrylic that allows for rapid prototyping using other magnets, or magnetic components. Specifically, magnetic thread is primarily used to create traces, and hence the name ThreadBoard.

![ThreadBoard, a white acrylic disc studded with magnets and stitched with magnetic thread, with a coin cell battery and a red LED lit and blue and white LEDs unlit](/media/making-a-literal-threadboard-constellation/01-5744d7.webp)

![ThreadBoard with the blue and white LEDs lit and a fingertip touching a thread end](/media/making-a-literal-threadboard-constellation/02-b1c751.webp)

![ThreadBoard with the red LED lit while a hand touches the thread](/media/making-a-literal-threadboard-constellation/03-57d731.webp "Experimenting with the ThreadBoard")

Our first assignment to get familiar with the ThreadBoard was to light up some LEDs. With a coin cell battery, not much current and voltage was provided, so we could only light 1 LED in series and 2 in parallel. This was done in class, and in lab we were given an [Adafruit Playground Classic](https://www.adafruit.com/product/3000). This allowed us to draw some more current, and we recreated the circuit in the third picture, this time all 3 LEDs had enough current to light. Unfortunately, I forgot to snap a photo of this- but here’s the schematic!

![Circuit diagram of a 3.3 V Adafruit supply driving red, white and blue LEDs in parallel](/media/making-a-literal-threadboard-constellation/04-a1761f.png "The LED circuit with the Adafruit providing power to 3 LEDs in parallel")

Now that we familiarized ourselves with the ThreadBoard, our next and final task was to tell a story using interactive elements, and nothing more than the ThreadBoard, some crafting materials, magnetic thread, magnets, and LEDs. No programming allowed!

I first decided on a steering wheel project but that didn’t pan out unfortunately (again- it seems like I forgot to take photos or something happened to this). I had a nice mechanism for a paddle shifter (using repelling and attracting magnets in tandem), but I realized I wasn’t telling a story.

![Chain of small steel balls and magnets bent into a constellation shape on red paper, beside a pile of balls and a box of LEDs](/media/making-a-literal-threadboard-constellation/05-99ce5f.webp)

![Sheet of blue foam laid over the ThreadBoard on a table, with a ball chain on red paper nearby](/media/making-a-literal-threadboard-constellation/06-4f2029.webp "Playing around with magnets…an idea emerges.")

It took me some brainstorming to come up with a new idea. I liked using magnets in an interactive way from the steering wheel idea, but I also wanted more of a “story”. I found my idea when I came upon some metal balls in the BTU Lab I was working in. Combining these with the tiny disc shaped magnets (also used in the ThreadBoard, which helped later) could make constellation-like shapes, as seen in the photos above. I had my “eureka” moment- I’d make a DIY constellation that lights up as you complete it! I found some blue foam as a backdrop and set to work.

![Back of the foam sheet showing a star-shaped cut-out, a copper pad and two punched holes](/media/making-a-literal-threadboard-constellation/07-5cbe8c.webp)

![Blue foam sheet with a star cut-out, a punched hole on the right and holes at the top and bottom](/media/making-a-literal-threadboard-constellation/08-32bb79.webp)

![Close-up of the star cut-out in the blue foam with copper showing through](/media/making-a-literal-threadboard-constellation/09-0a5236.webp)

![Foam sheet held up, with two copper pads hot-glued to its white back](/media/making-a-literal-threadboard-constellation/10-645e3f.webp "Creating the copper contact pads, and magnetizing them for a non-destructive connection")

I decided on a 4 LED/contact pad design, where the user starts on the star and connects to none, one, two, or three other contact pads. I used a hole punch to easily cut out two, and an exacto knife to cut out the star and right cut-outs. I then hot glued a copper pad folded in half to the foam, and then a magnet on top of that. The hot glue didn’t work that well, and one time forced me to start over as I misplaced hot glue between the copper and magnet- ruining the connection.

![ThreadBoard with an Adafruit Circuit Playground and purple paper in the centre and a white LED lit, the prototype circuit for the first contact pads](/media/making-a-literal-threadboard-constellation/11-e09789.webp)

![Back of the blue foam with the white backing ripped away and two copper pads taped on, each with a magnet](/media/making-a-literal-threadboard-constellation/12-62434f.webp)

![Underside of the ThreadBoard disc with one blue-white LED lit at the left edge](/media/making-a-literal-threadboard-constellation/13-14716d.webp)

![ThreadBoard with yellow and blue LEDs taped to the edge of the disc, one of them lit](/media/making-a-literal-threadboard-constellation/14-0eda67.webp "Putting together the threadboard circuit. Also- ripping the back off the foam. A mistake- but the idea was to allow more light to bleed through the foam")

At this point, I set up a prototype circuit for the first two contact pads, to see if my idea would work (top-left). I also ripped out the white backing for the foam to allow more light from the LED to pass through (top-right). This, along with using foam instead of paper (which would have let even more light through for better effect) were two big mistakes which led to the scrapping of this ThreadBoard as the foam got stuck to the acrylic. However, in better news, after recreating one of the pads for better contact, adding some more magnets as risers, and some more debugging…mostly just bad contact…the prototype worked! I added the rest of the contact pads and solidified the wiring.

The wiring itself is rather simple. The idea is to string a single power line to the left contact pad. This pad will start every constellation. The user then creates a connection to another contact pad. This will bring the power over by closing the “switch” between the two contact pads, with magnets and metal balls. The power will flow from the second contact pad, back to a ground wire which is strung across the entire ThreadBoard. This closes the connection, and puts the two LEDs in parallel to each other. The power can be brought to any of the other contact pads, also creating parallel connections. I’ll attach the completed circuit schematic down below- which should hopefully make this make more sense.

![Blue foam sheet over the lit board with steel balls and bars joined into a constellation shape, with yellow and white light bleeding through](/media/making-a-literal-threadboard-constellation/15-a6af8e.webp)

![Constellation of steel balls and magnetic bars shaped like the Big Dipper on blue foam with hand-drawn stars and handwriting, with a yellow glow underneath](/media/making-a-literal-threadboard-constellation/16-2262dc.webp)

![The same constellation with blue light around the star pad and a yellow glow at the bottom](/media/making-a-literal-threadboard-constellation/17-fb5889.webp)

![Blue foam with the constellation removed, showing three copper contact pads, the star cut-out and hand-drawn stars](/media/making-a-literal-threadboard-constellation/18-5156f0.webp)

![Close-up of the copper star contact pad in the blue foam, with handwritten start beside it and a faint blue glow](/media/making-a-literal-threadboard-constellation/19-f0f827.webp)

![Finished ThreadBoard from above, with the Circuit Playground board in the middle, a bright white LED at the left edge and blue foam beneath](/media/making-a-literal-threadboard-constellation/20-81a72d.webp "The finished product")

It took a lot of finessing with the LEDs to get the right contact, and the sticky foam did not help at all. But in the end, I got it to work! And it worked flawlessly. I added some creative decoration and direction to the foam, and recorded two videos showing it off. Sorry for the video quality in advance- it’s hard to film and create a constellation!

::youtube{id="WEVobrq2EGM"}

::youtube{id="dbslHXH2qrw"}

Finally, I’ll leave off with the schematic for my ThreadBoard “Constellation” project. The switches are labelled in respect to the various connections you can make. You will realize that any and all connections will result in a parallel configuration with one to four LEDs. The start LED is always on, no matter what other connections are made. This is to help the user intuitively realize to start on that side, even in the dark. You will also realize that at least one connection (but not all) must be made from the left side- other connections will not be connected to the 3.3v line.

![Schematic with a 3.3 V Adafruit supply, six labelled switches (Left to Top, Left to Bot, Left to Right, Top to Bot, Top to Right, Bot to Right) and white and yellow LEDs](/media/making-a-literal-threadboard-constellation/21-59eb70.png "Fixed schematic, previously included a redundant connection. 6 custom switches- but infinite configurations- I mean constellations are possible!")

Thanks again for following this week’s project. I hope this constellation lit up your night sky! Ahahahaha…ha…
