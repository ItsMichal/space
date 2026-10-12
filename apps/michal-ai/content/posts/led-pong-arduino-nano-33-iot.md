---
title: "LED Pong and more adventures with the Arduino Nano 33 IoT"
slug: led-pong-arduino-nano-33-iot
kind: article
id: led-pong-and-more-adventures-with-the-arduino-nano-33-iot
description: "This version comes pre-soldered so prototyping with breadboards was a breeze. And well, that’s exactly what we did."
date: 2021-09-25
tags: ["Arduino", "Electronics", "Design"]
cover: /media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/cover.webp
coverAlt: "Two NeoPixel strips glowing blue and green, wired to an Arduino on a breadboard with a red pushbutton on long leads"
series: "Object"
order: 3
originalUrl: "https://halmic.medium.com/led-pong-and-more-adventures-with-the-arduino-nano-33-iot-b674611fd0d0"
---

![Two NeoPixel strips glowing blue and green, wired to an Arduino on a breadboard with a red pushbutton on long leads](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/01-a62780.webp "LED pong with built-in cheat codes!")

After finishing up constellations and logic probes, our next stop on the Object journey was to work with our microcontroller of choice for this class- the Arduino Nano 33 IoT. This version comes pre-soldered so prototyping with breadboards was a breeze. And well, that’s exactly what we did.

Our first task at hand was to implement two LEDs with appropriate resistors, as well as two buttons with pull-down resistors. For this task I chose white and blue LEDs. As these have voltage drops higher than 3.3V (our supply voltage), a resistor was technically not necessary. However, I added a 100Ω resistor somewhat by mistake (as I had been LED to believe I would need one), but in the end it turned out to work. It turns out I had dimmed the brightness and got much less power through the LED by adding it. Attached is my calculation-

![LED forward voltage against forward current chart, with arrows marking the blue and white LEDs and the 100 ohm resistor calculations](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/02-1dc5c0.webp "LED chart courtesy of LEDnique.com. Blue LED power calculated @ ≈0.02W. White LED @ 0.0226W")

As you can see by where the arrows landed in the chart, I could have not used a resistor and gotten much more brightness out of my LEDs. Honestly, though the LEDs turned on bright enough anyways. Which leads us to the building of the circuit.

![A red button, a white button, blue and white LEDs and a resistor laid out on a wooden bench](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/03-7b8f4d.webp)

![Arduino Nano 33 IoT plugged into a breadboard and a USB cable](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/04-f5cc2c.webp)

![Breadboard with a blue LED lit and a fingertip pressing a button](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/05-fed2a0.webp "Gathering of the parts and first test with one button")

We had a choice of switches to use, either momentary or SPDT, but I decided to use two momentary pushbuttons as honestly they looked quite cool. I got both sets of resistors, and plugged in my microcontroller. I assembled a single button and activated a LED without the microcontroller as a ground test for my circuit. Not really much else to say here — it worked. You can see the circuit and the very bright LED working in the third picture.

![Breadboard circuit with a white and a red pushbutton and a blue LED, with a finger reaching for the buttons](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/06-a5762c.webp)

![A finger pressing the red pushbutton while a white LED lights on the breadboard](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/07-2f9f20.webp)

![A hand pressing both buttons at once, with the blue and white LEDs both lit](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/08-af546b.webp)

![Breadboard with the Arduino, two pushbuttons and two LEDs wired with orange, blue, black and white jumpers](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/09-57ca4f.webp "Welcome to the jungle… of jumper wires. But hey! It works")

Afterwards I got to work on attaching the second button, LED, and set of resistors. It was pretty tough to fit it all on a half-sized breadboard. The jumper wires also got pretty messy- that’s my bad. Sometimes you can get carried away! My inspiration for the interaction portion came from police lights. I had basic interactions for pressing either button (either turning one or both LEDs on), but if you pressed both… well I guess I’ll just show you —

::youtube{id="rvVoF5p_hXM" title="Police LED Interaction"}

Coding this was rather trivial as well. I simply used the Arduino IDE (although I later switched to VS Code’s Arduino dev environment) and came up with a simple if/else chain to check for the different button states. For the Police effect, I simply switched one LED on, the other off, and then put a small delay before alternating the on/off states. Once I completed the code and breadboard circuit, I created a schematic in EasyEDA Designer- just before the class and I switched to using Fritzing for the rest of the project. You can check out the full code and schematic in my linked gist below —

[Police LEDs Arduino Nano 33 IoT](https://gist.github.com/ItsMichal/83bbf5e1ecba49d85802d44381818a4b)

---

After we completed our first breadboard circuit, we moved on to using protoboards. The task at hand was to simply create two protoboards with solid core wires that could plug back into our breadboard and Arduino. The first protoboard involved isolating the button circuit (power, ground, digital input, and pull-down resistor) on the protoboard. This would allow us to easily reuse the button as a reusable component in our future projects.

![Protoboard with a red pushbutton soldered on and red, yellow and black wires attached](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/10-666d7a.webp)

![Underside of the button protoboard held between fingers, showing small solder traces and red, yellow and black wires](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/11-cdd200.webp "My protoboard button circuit")

For this I challenged myself to package the button on the protoboard as tightly as possible- using as little of the board as I could. Making this board was a bit of a challenge as the soldering iron was not cooperating and creating the solder traces, especially the longer ones, proved more difficult than anticipated. But after more time than I would have liked to have spent, the button was done and tested perfectly swapped into the previous circuit.

![Underside of the LED protoboard with thick blobs of solder joining pads and black and yellow wires](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/12-7257a1.webp)

![Top of the LED protoboard with a blue LED, a white LED and a resistor soldered in, and yellow and black wires](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/13-eaee61.webp "The LEDs were much smoother sailing. But still a bit too much solder was used")

The LED board had one less wire required, which helped a bit. I ran into some issues with solder accidentally creating connections where I didn’t want any, particularly creating a short to ground via bypassing a resistor. I had to use the solder extractor to remove this unwanted solder trace, but afterwards it was smooth sailing. I then attached both protoboards to the breadboard, and using the code from the previous section, I recorded a demo and updated my schematic- now in Fritzing, which was a bit less streamlined than EasyEDA (really wish “R” could rotate pieces!), but still very nice to work in.

::youtube{id="kQ4YILcm0zQ" title="Protoboard LED Demo"}

![Fritzing schematic of an Arduino Nano 33 IoT with two LEDs and 100 ohm resistors on pin D9 and a pushbutton with a pull-down resistor on D11](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/14-c1cf89.png)

---

And finally the final section, and probably what you all have been waiting for- LED Pong! The last requirement we had was to create an interaction using a WS2812 (aka NeoPixel) LED strip and two modes of input. For the input choice, I used the protoboard button module. As a secondary input, I added an SPDT slide switch. I like games, so I thought of a game that I could make on a single LED strip. Turns out- a single strip really limits your options- especially when it only has 5 LEDs itself. So I decided to give myself some leeway and added a second strip to the design. My plan was to create a watered down version of Pong where you’d play against a computer and use the button to switch LED strips. A ball (represented by a blue LED) would bounce back and forth on the length of the strips, randomly switching strips after every bounce. You would win if you held out long enough against the computer, or lose if the ball got past you. To make the game easier, and add an interaction for the SPDT switch, I made it so it runs a cheat code that beats the game for you every time.

![Two black WS2812 NeoPixel LED strips with soldered red, yellow and black wires on an orange background](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/15-efbf3c.webp)

![Two NeoPixel strips wired to an Arduino Nano 33 IoT on a breadboard with a red button, on an orange background](/media/led-pong-and-more-adventures-with-the-arduino-nano-33-iot/16-8f7f55.webp "Soldering LED strips and the final circuit")

There were some hiccups with my initial code which made the interaction a little less smooth than I would have liked. Here is a video of the first stage of the coding —

::youtube{id="yHjq8IRvXc4" title="First Stage LED Pong"}

As you can see it’s a bit unresponsive and not quite as polished as I would have liked- I frequently click the button and the game doesn’t respond. I tracked this down to a coding issue- the timer that runs the the Pong ball moving back and forth is also the one that detects user input. If the user interacts in the gaps between the pong ball, that input is completely dropped. I rewrote the code to add better input detection and a bit more visual flare. Here is the code and final video attached, along with the schematic for building this circuit yourself!

[LED Pong](https://gist.github.com/ItsMichal/73bbc6190475ab6cd8c3e219c2e4cb9f)

::youtube{id="HWMPAJ3ZoaI" title="Final stage LED Pong"}

Hope you enjoy!
