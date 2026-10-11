---
title: "Creating my first PCB — Object"
slug: creating-my-first-pcb-object
kind: article
description: "But before we get to that… let’s talk processing. I’ve been using the Arduino as the brains for my projects for a while now."
date: 2021-10-15
tags: ["Arduino", "ATtiny85", "Electronics", "Design"]
cover: /media/creating-my-first-pcb-object/03-377c87.webp
coverAlt: "Sketch of the MedPuck: a pill bottle on a round base, labelled pressure switch, LED ring, coin cell and timer circuit"
series: "Object"
order: 4
originalUrl: "https://halmic.medium.com/creating-my-first-pcb-object-4d7112e943af"
---

But before we get to that… let’s talk processing. I’ve been using the Arduino as the brains for my projects for a while now. It’s gotten a bit…boring (not really, but it is time to move on!) What’s the next natural step after spending over a month tinkering with an Arduino? More microcontrollers!

![ATtiny85 microcontroller chip, shown enlarged above a small board plugged into a laptop USB port, with the Arduino logo](/media/creating-my-first-pcb-object/01-15c616.jpg "Image from CircuitDigest")

Introducing the **ATTiny85**! A beast of a tiny chip that features an 8-bit programming platform, with 8kb of flash memory, 512 **bytes** of EEPROM, 512 **bytes (again)** of SRAM, and complete with 6 GPIO lanes, ADC’s, and a smorgasbord of other misc. features like an internal clock- which will be important. Fortunately, the spec limitations were not as important.

So here comes the task- design a printed circuit board (PCB) using this tiny microcontroller as the brains. The goal? To create something “interactive”.

With such a vague prompt, the first step was to brainstorm. I partnered up with Torshawna Chew and Ethan Wang on this project. Here are some of our ideas-

![Handwritten brainstorming notes and rough sketches for the PCB project ideas](/media/creating-my-first-pcb-object/02-e8f1f1.webp)

![Sketch of the MedPuck: a pill bottle on a round base, labelled pressure switch, LED ring, coin cell and timer circuit](/media/creating-my-first-pcb-object/03-377c87.webp)

![Sketch of a handheld Pocket Games device with an LED matrix, A and B buttons and a USB-C port](/media/creating-my-first-pcb-object/04-456a22.webp)

We ended up going with the MedPuck as it seemed both the simplest and most impactful idea. Plus, it worked well with the technical requirements to implement a NeoPixel LED strip into our project.

![Four sketches of the MedPuck showing a hand turning the ring, a bottle placed on the base, and the LED strip after 6 and 24 hours](/media/creating-my-first-pcb-object/05-774b63.jpg "Thanks Torsh for the amazing final concept sketch!")

To put it simply, the MedPuck is a weight activated medicine timer that uses an LED strip to provide feedback on when a medicine should be taken. It is designed to be dead simple and frustration free. The only controls are a spinning ring used to set the timer between common intervals of 4/6/8/12/24hrs (in the demo case, we switch this to seconds), and a platform that activates a button when a pill bottle is placed. The button starts the timer, and LEDs light up when its time to take pills. This is aimed to be accessible and useful in keeping a consistent medication schedule.

![NeoPixel LED strip held in a hand, glowing blue, wired to a breadboard and an Arduino Nano 33 IoT](/media/creating-my-first-pcb-object/06-40f8f3.webp)

![Breadboard, 8-pin chip socket, two resistors, a capacitor and a pushbutton laid out on a table](/media/creating-my-first-pcb-object/07-c1a7b4.webp)

![NeoPixel strip lit in several colours, wired to a breadboard and an Arduino Nano 33 IoT on a wooden floor](/media/creating-my-first-pcb-object/08-bba3ec.webp)

We started off by building a test circuit trying to control the NeoPixel strip with the ATTiny85. You’ll see in the photos that the (pesky) Arduino Nano 33 IoT is still around. That’s because its actually a pretty convenient 3.3v power supply, which the ATTiny85 also runs on. In the final product, power will be supplied by a coin cell battery.

![Close-up of a pushbutton and a blue trim pot on a breadboard with jumper wires](/media/creating-my-first-pcb-object/09-7bcc60.webp)

![Breadboard prototype with a trim pot, capacitor and a tangle of jumper wires, next to the white ring of the enclosure](/media/creating-my-first-pcb-object/10-6367a4.webp "The rotational potentiometer was added after the initial idea was generated.")

We added a trim pot to the prototype- this would be integrated with a gear-based enclosure and a belt (made from a rubber band) to allow the turning of the side to control the timing of the circuit. Watch the video below of us progressing through our electrical prototypes.

::youtube{id="yNP8Ox28alI" title="MedPuck Prototype"}

In this video you see three different stages of the prototype and code. The first stage is just a simple test that lights the LEDs on the button input. The second stage uses a timer to light up the LEDs in sequence after the bottle is placed down. We use a bottle of ModPodge as the button requires a relatively high activation force. This will be reduced by adding weights to the platform in the final enclosure, thereby increasing the sensitivity of the button and allowing for lightweight pill bottles to be used. Finally, the third stage shows the settings option by spinning the trim pot. The lights change to a blueish white color and reflect the time (1 LED- 4 hours/seconds, 2 LED 6 hours/seconds, etc.). After no more input is detected, the lights flash to allow the user a grace period to make any final changes. Once the confirmation period is over, the timer starts with the new values.

One note is that this new timer value should be stored in the EEPROM — however, I was unable to get this implementation to work. For some reason either the EEPROM was not being written too or it wasn’t being read from properly. I didn’t have time to diagnose and debug this (for now) — which would have been a massive PITA on a chip without a serial output.

I did mention an enclosure right? The video shows some sneak peeks at my enclosure design. This is actually for a separate project for my Form class- as it wasn’t a requirement for this Object lab. I created the enclosure in Fusion 360 and you can see the initial version and a (near) final version animated in this video.

::youtube{id="cVro2o0g-ls" title="Enclosure Animation v1 and v2"}

The design was made to be as simple and sleek as possible. It was also split up with ease of assembly in mind — specifically, these parts are to be 3D printed and assembled by fitting them together. Theoretically, no glue or screws are required, and gravity and friction will hold everything together. This allows for easy replacement of the coin cell battery, which brings us to the design of the printed circuit board.

![Two PCB layout screenshots side by side: an initial routing on both layers and a cleaner single-layer routing inside a circular board outline](/media/creating-my-first-pcb-object/11-bdf1ac.webp "The initial (left) and near final (right) versions of the PCB")

The PCB design was relatively straightforward. After updating the electronic schematic (below), we initially used both layers to route the traces. However, this ended up being a little too complex and unreadable for our liking, so we played around with positioning the various components and got the result on the right, which required only a single layer and looked much better both in terms of readability and in terms of aesthetics.

Attached below are the final versions of the code, schematic, and PCB design.

[MEDPuck - Medicine Timer - .ino, Gerber, and Schematic](https://gist.github.com/ItsMichal/d6447a63577c7a86f83c25ce52554f1f)

Thanks again for reading! Thanks for your time, and as always see you next time!
