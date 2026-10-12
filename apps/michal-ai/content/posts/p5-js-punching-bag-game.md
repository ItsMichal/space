---
title: "Making a punching bag game in P5.js"
slug: p5-js-punching-bag-game
kind: article
description: "I’m a pretty decent programmer…kinda. What I am not good at is hardware, which I’ve been focusing on improving the past couple months."
date: 2021-11-20
tags: ["Game Dev", "Arduino", "Electronics"]
priority: 2
featured: true
cover: /media/making-a-punching-bag-game-in-p5-js/cover.webp
coverAlt: "Screenshot of the Lane Defense game: three vertical lanes with magenta enemy circles, a red pellet and green health bars"
coverFocus: "50% 40%"
series: "Object"
order: 7
originalUrl: "https://halmic.medium.com/making-a-punching-bag-game-in-p5-js-1f8fe83cb6af"
---

I’m a pretty decent programmer…kinda. What I am not good at is hardware, which I’ve been focusing on improving the past couple months while making these projects and writeups. However, for our final lab project, we delved much more into the software side, which means… it’s my time to shine!

Anyways, first let’s talk serial communication. AKA how pretty much every device interacts with each other these days. Basically, my tiny little Arduino Nano 33 IoT can send messages to my computer! How? Well, I’m not *too* sure of the details yet, but by using the [Serial.write](https://www.arduino.cc/reference/en/language/functions/communication/serial/write/) command and having synced up baud rates, my laptop can receive data (and also send it, but… this project didn’t really need to go into that).

So our task was to use this method of communication to create a game using the Arduino as a controller. We had a choice of how we would make the game on the computer, but I conveniently forgot this. Otherwise I would have used Unity, as I’ve been working with it a bit lately. Instead, I used what we were taught in class, [although I did have previous experience with it](https://github.com/ItsMichal/sea-of-thoughts) — P5.js.

Now, I’m a little bit late to this lab, and my Arduino at this point is actually tied up in use for my final project, so I had to come up with a game that could use this punching bag destresser. Also, as for the control, I’d already decided to make use of the Arduino’s Inertial Measurement Unit — aka its accelerometer/gyroscope.

![Annotated concept sketch of a red punching bag on a spring mounted to a round base, with notes on the Arduino position, LED strip, force sensors and calm, sport and anger modes](/media/making-a-punching-bag-game-in-p5-js/01-639369.jpg)

![Red punching bag on a spring mount with an Arduino and wires hanging below it, on a workshop table with tools](/media/making-a-punching-bag-game-in-p5-js/02-ff4584.jpg "Sneak peek at the initial stages of the final project!")

I didn’t spend too much time on ideation for the game, since I’ve been scrambling to make up work ever since being sick almost the past 4 weeks. Instead, I went with the first idea that came to mind — a lane defense game that would use forward punches to attack, and side punches to switch lanes.

Well of course, this is much easier said than done. But thanks to some new techniques I learned from my Object-Oriented Design and Analysis class, I was able to take an object oriented approach that worked well. It traded some additional “setup” time for ease of development and debugging. There’s not much else to say here other than inheritance and classes in JavaScript are a bit weird. Without further ado, here is the finalized code in Gist format.

[Lane Defense - Serial Arduino Nano Game](https://gist.github.com/ItsMichal/a186eaf2f3f17f2ada46b8f19fec2e16)

So as you can see, despite the lack of comments and a slight need to refactor, the code is largely readable and maintainable due to the (mostly) organized structure. I added in the serialization code after completing the game (first controlled with keyboard), so that part might be a bit messy. Otherwise I made an abstract “Drawable” class that every object inherited from. Every object needed to have a “drawSelf” function and “valid” function. “drawSelf” is pretty explanatory- every object was responsible for drawing itself with p5.js methods. “valid” would be used in the object tracking code to make sure that any invalid objects get deleted to free up system resources — in other words to stop lag. Otherwise, I structured the code so that each “Lane” was basically its own game. It would have its “Gun” that shot “Pellets” and “Spawner” which spawned “Enemies”. It also had basic collision code to handle “Pellets” and “Enemies” colliding with each other, and an hp bar. I never got around to doing anything other than just displaying HP though, so there is no proper “end game”.

![Screenshot of the Lane Defense game: three vertical lanes with magenta enemy circles, a red pellet and green health bars](/media/making-a-punching-bag-game-in-p5-js/03-440051.png "Screenshot of an example game. Enemies (purple circles) slowly make their way down, and the user must shoot pellets (red circles) to destroy the enemies, which have various health levels, speeds, and sizes. If an enemy makes it all the way, the lane’s hp decreases as seen in the middle lane.")

To play the game, the user punches forward to shoot on the active lane. Or, the user can switch lanes by punching in the direction they want to switch to. For keyboard controls, shooting is done by pressing the spacebar, and switching lanes with the respective arrow keys. Serial data from the punching bag comes in from the [p5.serialcontrol library](https://github.com/p5-serial/p5.serialcontrol). And here’s the current, very messy code for getting those 3 serial outputs “FORWARD”, “LEFT”, and “RIGHT”.

[Prototype Boxing Bag Code](https://gist.github.com/ItsMichal/b28838b117930354e6e7a5ffd1b3e8fc)

Note that this includes the code for our final project, so for this project the relevant code section is between lines 80–130. Sorry for (somewhat) spoiling the next post, but we are only in our first stages of the project, so this code will change quite a bit.

Otherwise, there’s nothing too special going on here. The code was referenced from [this Air Drum project](https://create.arduino.cc/projecthub/arichetta/air-drum-with-arduino-nano-33-iot-8e9d45) but heavily modified. Basically it checks the accelerometer values and if they exceed a threshold a hit is detected. Then, after some quick testing with punching different directions and seeing the corresponding values, a check is made to see which direction was hit. Needless to say this is quite finicky in practice, and this code will almost certainly be rewritten and revised for the final project. But it worked about 60–75% of the time, and the main failure was just detecting “FORWARD” instead of “LEFT” or “RIGHT”, so the game was still playable if not a little inconsistent.

Without further ado, here’s a video of me playing the game with the punching bag controls!

::youtube{id="hdnndI1rcKc" title="Lane Defense - Punching Bag Demo"}

And finally, play this simple game for yourself here —

[LaneDefense by ItsMichal, play in the p5.js Web Editor](https://editor.p5js.org/ItsMichal/full/aJsYdlkIw)

And finally finally, remix the game here!

[LaneDefense by ItsMichal, edit and remix in the p5.js Web Editor](https://editor.p5js.org/ItsMichal/sketches/aJsYdlkIw)

I hope you enjoyed this read!
