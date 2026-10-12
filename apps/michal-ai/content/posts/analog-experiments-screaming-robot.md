---
title: "Experiments in Analog- and a failed attempt at a screaming robot."
slug: analog-experiments-screaming-robot
kind: article
id: experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot
description: "Analog! We technically already delved into using analog with the MedPuck — but it turns out we’re actually going to dive deeper into it."
date: 2021-11-06
tags: ["Arduino", "Electronics", "Robotics", "DIY"]
priority: 1
featured: true
cover: /media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/cover.webp
coverAlt: "The finished RobotScreamer robot on a white background, with an ultrasonic sensor on the front and a 9V battery and loose wires on top"
series: "Object"
order: 6
originalUrl: "https://halmic.medium.com/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot-e5d67d9e8d29"
---

Analog! We technically already delved into using analog with the MedPuck — but it turns out we’re actually going to dive deeper into it. Also the first “failure” of the semester!

![Breadboard with an Arduino Nano 33 IoT, a blue trim pot and blue and green LEDs, wired with jumper wires](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/01-bef13d.webp)

![A hand holding a red capacitive touch sensor board next to the breadboard circuit with its blue and green LEDs](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/02-a06f99.webp)

![The same breadboard with a photoresistor in place of the touch sensor and the blue and green LEDs lit](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/03-9742be.webp "(Left/Middle) the first circuit built with a capacitive touch sensor…which turns out wasn’t analog! (Right) the modified circuit with a photoresistor instead")

The first demonstration of my analog skills was by simply hooking up two analog inputs, in this case a trim pot and capacitive touch sensor, and having two LEDs light up in different brightness levels according to the values read. This turned out to be pretty trivial for the trim pot, as this was done in the MedPuck lab, but the capacitive touch sensor was a bit harder to get working. After an embarrassing amount of time spent double checking my inputs and wiring, I decided to look up the data sheet for the touch sensor. Apparently…its not really a sensor but a switch. That’s right — it was digital, not analog. After swapping it out for a photoresistor, I recorded the following video of the circuit in action.

::youtube{id="1_BN7k59j90"}

Afterwards, I was supposed to make a circuit with double photoresistors. Unfortunately, I fell sick (and still am, even more unfortunately) and wasn’t able to do so. Instead, I decided to do the final part…and perhaps went a bit too overboard.

---

The final project was to create an “Interactive Sensor Box”. The idea was to create an interactive project that would be enclosed with no wires showing. After some brainstorming with my partner, I took on the challenge to make something that challenged my skills perhaps a little too far. I decided to create a robot!

The first challenge was finding a proper way to drive 2 DC motors. Foolishly, I thought that 2 *ungeared* DC motors should be more than enough power to drive a tiny robot. But we’ll get to that later. Now, I could have done the simple route and just attached the motors to an analog output on the Arduino Nano 33 IoT. However- while this would give me adequate speed control, it would not allow me to drive the motor in reverse- which would be necessary for tight turns and such. So the only option was to find a motor controller IC or create a dual H-bridge inverter circuit — shown below (replace Coil with DC motor)

![Circuit diagram of a dual H-bridge inverter with two coils and a DC link voltage](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/04-dfb44b.png "Dual H-bridge Inverter by Sachin Angadi https://www.researchgate.net/figure/Schematic-of-Dual-H-bridge-inverter_fig3_261235657")

Yeah, no thanks to doing that on a breadboard. So finding an IC with the above integrated was the next challenge. I first came across the Sparkfun Qwiic Motor Driver. Long story short — I was not using a Qwiic board, so I had to manually hook up I2C serial communication. It did not work apart from the onboard LED flashing a few times. Running diagnostics over serial showed that everything was perfectly. I tried different voltages and outputs from my power supply. I tried a battery supply. Different DC motors (this was crucial as I did accidentally fry 2 DC motors by overvolting them). Nothing worked. Finally, after using a Sparkfun REDboard with a Qwiic connector, and not even having that work, I put it away and put my head in my hands as I realized I had just wasted about 5 hours trying to work this thing.

![SparkFun Qwiic Motor Driver, a red board with two screw terminals and a Qwiic connector](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/05-429d67.jpg "Evil. https://www.sparkfun.com/products/15451")

So at this point, I did what I should have done much earlier, and, well — gave up. But not quite. I knew from doing some research into controlling DC motors that there was a fairly popular IC that would help me — if I could find it.

![L293D pinout diagram listing all 16 pins, next to a photo of the chip](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/06-3a1cec.jpg "L293D picture and pinout courtesy of TheEngineeringProjects.com")

Introducing the faithful [L293D](https://www.ti.com/lit/ds/symlink/l293.pdf). I managed to find this (thankfully) by going through a generic Arduino Uno starter kit. This IC is essentially the dual H-bridge circuit, but it also allows a separate control voltage (5v) from the actual voltage supplied to the DC motors (up to 36v). This IC worked perfectly when hooked up. Even with a 3.3v logic signal, it worked as expected. I could run the motors in both directions with variable speed. However, as I type this now…perhaps the 3.3v logic signal would be the cause of eventual demise for this project.

![Two small silver DC motors beside a white 3D-printed wheel with a blue mark](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/07-7476dc.jpg)

![Close-up of an L293D chip on a breadboard, surrounded by jumper wires, beside an Arduino Nano 33 IoT](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/08-1a21fa.jpg)

![Overhead view of the breadboard with the L293D chip, the Arduino and a tangle of red, black, yellow and white wires](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/09-1b28fc.jpg "The motors being controlled by the L293D. Unfortunately, the spaghetti only gets worse from here")

::youtube{id="YxhLm9ipMy8"}

I left the lab for the day after this test. My partner Ethan in the meanwhile had CAD’d the model for the enclosure, and I used my 3D printer at home to print it out.

::youtube{id="unZIL3J9M_4"}

![White 3D-printed robot body with two wheels, an ultrasonic distance sensor on the front and a yellow battery and wires inside](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/10-5c3d13.jpg "The Robot Screamer!")

As you can see- the idea was to have an Ultrasonic sensor (which again…turned out to technically not be an analog input) that gave distance data to an obstacle. As the robot got closer, it would scream louder and higher pitched from a speaker, until it turned around. But as simple as this seemed, a big problem occurred- the DC motors could not move the robot on its own. I tried so many different things, from supply more voltage, using larger capacity batteries, but nothing could get the robot moving. While typing this write up, I realized that the 3.3v logic signal which I thought was “fine” might not have been fine at all. If the IC expects 5v, then it could potentially interpret 3.3v as 66% speed (3.3/5). This would mean that this entire time, I was limiting the power of my motors by 33%. Ouch.

Alternatively, these DC motors just might not have had the torque necessary. Most toy robot DC motors come with a gearbox for exactly this reason. Unfortunately, our lab did not have any such DC motors that I could potentially swap out.

The Ultrasonic did work however. I managed to get it to control the speeds of the motor. But I realized that we would need two analog inputs (I was just going to consider the ultrasonic analog enough as its output was not just 0 and 1, even if it did use 2 digital pins). So I decided to add remote control with an IR receiver. Again- this worked. But as soon as I tried using both the IR receiver Arduino library and Ultrasonic library in unison… everything broke down. The Arduino Nano 33 IoT would become unresponsive randomly and a manual reset was required. Even my debugging skills couldn’t tackle this — but it didn’t stop me from trying.

In the end, my best guess was the two libraries fighting. Additionally, I had to juggle 3 different voltages throughout the circuit. A high voltage for the DC motors (\~9v), a supply voltage for the 5v components (IR, Ultrasonic, L293D), and the Arduino’s own 3.3v circuitry. I managed to fix and break this so many times while trying different things to get every component working. But in the end it was just a tangled, spaghetti mess, that refused to work together. At about 1 am in the BTU lab, I officially threw in the towel. RobotScreamer (patent pending- just kidding) was not going to work.

![The finished RobotScreamer robot on a white background, with an ultrasonic sensor on the front and a 9V battery and loose wires on top](/media/experiments-in-analog-and-a-failed-attempt-at-a-screaming-robot/11-e3ebe9.jpg "The failed corpse. You can see the mess of wires, wall-wart jack, two different batteries with different voltages. It was a mess, in all senses of the word.")

And thus the story ended. I would love to provide you with the code — but my MacBook is currently under repair. Maybe someone more experienced can help out here, but ultimately I think the failure comes down to a few things.

First, not having a proper voltage regulation circuit and/or components. These would have helped a ton by allowing me to step up and down voltages rather than having to deal with 2–3 different batteries. Simplifying this makes debugging and working with every other component easier.

Second, the weird interactions between the Ultrasound and IR receiver libraries for Arduino. I would have loved to get more information from the Arduino like a stack trace to really get to the root of this- but I was unable to get that crucial information.

Finally, the 3.3v logic output not being stepped up to 5v for the L293D. Doubling up on this, not having DC motors with a gearbox. Ultimately, even if the motors spun correctly, the robot would not be able to get moving. The DC motors reached needlessly high speeds under no load. A gearbox would have been perfect to translate this speed into torque. There also is the chance that if the L293D got the 5v PWM input that it wanted, then the additional power would be enough to get the robot to roll.

I’d love to come back to this project eventually. But this is a perfect example of a seemingly simple concept in theory becoming an absolute mess in reality. As the French would say however, *C’est la vie.*
