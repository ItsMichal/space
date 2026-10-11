---
title: "Taco Neko Development"
slug: taco-neko-development
kind: article
description: "Hello! Welcome to my post about a short game I made for a Design class. This game was ideated and created in the span of 2–3 days. Here was my process."
date: 2020-05-27
updated: 2020-11-10
tags: ["Game Dev", "Design", "Process", "itch.io", "GB Studio"]
draft: true
canonical: "https://halmic.medium.com/taco-neko-development-5c1fb9e6372c"
---

Hello! Welcome to my post about a short game I made for a Design class. This game was ideated and created in the span of 2–3 days. Here was my process.

---

**Ideation**

For ideation, we were required to use [a website](http://mouseandthebillionaire.com/gameIdeaRoulette/) to generate our ideas. Technically, we were only supposed to choose our first idea, which was Desert Island Tacos for me, but I decided to cheat a little bit when my girlfriend took a look at the site and mentioned Robotic Cats as a cool topic. So instead, I combined both, into one idea. Below is a video of roughly my ideation process, which was a mind map technique. Basically, I started off with the main two ideas, then put down some interesting genres, and then devised scenarios based on the genre and idea. I’ve also included the final image below. (Also, ignore the space dog in the top left corner, that was just a doodle I made while coming up with ideas!)

::youtube{id="WQFVbquhTQo"}

![](/media/taco-neko-development/01-7f3767.webp "My mind map ideation")

In the end, I had the following ideas from the mind map:

- The mystery of the Robotic Cat — Puzzle Game
- Build Robotic Cats (Builder/LifeSim Game)
- Collect Tacos (the Currency), vibe with Cats (LifeSim Game)
- Take Care of Cute Robotic Cats on a Desert Island (Pet Game)
- Horrorish, make Tacos while Robotic Cats try and Kill You (Platformer)
- Robotic Cats run a Taco Stand on a Deserted Island (Taco Stand(?) Game)
- Taqueria Tycoon on a Desert Island (Taco Stand Game)
- The mystery of the Robotic Cat (Puzzle Game)
- Mystery of the Robotic Cats (I swear there’s a difference!)
- Eat and Collect Tacos to Survive on a Desert Island (Survival Game)
- Make Tacos with the Help of Robotic Cats (Cooking Game)

And came up with a few more independently a bit later:

- Raise robotic cats and feed them tacos
- Try to escape the desert island by finding tacos to power yourself up
- Fight a robotic cat over the coveted desert island taco!
- Start a colony of robotic cats and take over the desert island with your army! (Strategy Game)
- Scour the island in search of taco pieces to create the greatest taco! (Puzzle Game)

In the end, I combined a few ideas to get one general idea- which I could still further refine during the design process if needed:

> An action-puzzle game where you scramble to make tacos on a desert island inhabited by robotic cats, which get in your way of getting ingredients, cooking, assembling, and serving tacos! If you don’t feed the cats said tacos, they might turn on you- and eat you instead!

I took some inspiration here from games like *Overcooked!* on the taco-making process, but added the (hopefully) unique twist of having helpers that could turn their back on you. Hopefully, I can impart the transition of these cats from being cute companions to petrifying predators!

As far as names go, we’ll get to that problem later- after all, it’s best to name something when the idea is more solidified, and in order to do that we have to move on to the prototyping stage.

---

**Paper Prototyping**

Now, truth to be told, none of my prototypes were done on actual paper. I’ve been fond of using my iPad, Apple Pencil, and an app called *Procreate* to create my prototypes. This allows me to prototype even faster and with less waste than actual paper, and allows me to share these prototypes with you here much easier! Plus, it allows support for animation, and the drag/drop features can easily simulate interaction (almost) as well as real paper.

**Rocket Cats**

![](/media/taco-neko-development/02-dacefc.png)

![](/media/taco-neko-development/03-5fef42.png)

The first prototype sketches. The first one has a more bulkier, tin can man look. Less cute, less futuristic, but I was going for a weird middle ground between being horrifying and cute, and thought this was a good start. I thought however, it would be hard to replicate the finer details in GB studio, so I made a far more simple and cute design. This one is more futuristic, and the design is partly inspired by the *EVE* robot from Disney/Pixar’s *Wall-E*. It’s got a nice blue color scheme (although, of course, this will likely be changed later due to the color limitations in *GB Studio*), and overall can be more flexible.

![](/media/taco-neko-development/04-4e7736.png)

![](/media/taco-neko-development/05-3031b2.png)

![](/media/taco-neko-development/06-043139.png "Three simple role prototypes for how the cats will go through 4 -5 different stages throughout the game")

I made two prototypes for how the cats will get “hungrier” throughout the games. The first one heavily relied on the original design and color we solidified earlier, and I realized pretty early on that color actually couldn’t be used as a visual indicator since GB Studio limits you to four colors. However, it solidified the idea for the role (i.e., what the cats would do), and so I went back to the drawing board for the second prototype. This time, I limited myself to two colors, and finally incorporated that taco cat logo from earlier. I also designed with a low final resolution in mind, which lead to designs I was happy with. I also added a stage for the depleting of the logo to make sense. A small tweak was to perhaps, swap the way the logo depletes (from white to black to black to white- since white is often associated with being empty in this case), so I created a third prototype to show to my girlfriend again — here’s her view:

> \[Third\] one bc it seems more like a health bar and warns the players with each paw nub disappearing rather than filling up which can be taken as a good sign rather than bad

Unfortunately, none of these ideas made it into the game- GB Studio was far more limiting than I thought! But regardless- should the game move from GB studio this is something I want to pursue.

![](/media/taco-neko-development/07-6ef2dc.png "The final sprite sheet for the cats. Notice the indicators? The carrier tail?")

**Designing Suavez**

The main protagonist of the game is Suavez, a master taquero. But did you know there was another? Of course, I let my girlfriend decide which design was better, which is why you have Suavez.

> Suavez looks like the true taco man

![](/media/taco-neko-development/08-f1e2d4.png)

![](/media/taco-neko-development/09-4b4aa7.png "Paco and Suavez. Perhaps Paco will appear in a later game?")

However, in order to bring Suavez into GB studio, there had to be some…drastic changes. A big theme you’ll see is me overestimating its capabilities, so without further ado, here is the iteration on Suavez.

![](/media/taco-neko-development/10-60e6b4.png)

![](/media/taco-neko-development/11-7e000b.png "First two iterations. I really liked the upward facing sprites, but the side sprites needed more outlining")

![](/media/taco-neko-development/12-0b078c.png)

![](/media/taco-neko-development/13-7ca92f.png "I then lowered the arm so it makes sense (although, admittedly from the side Suarez looks like a duck), and also changed the hair animation slightly on the side")

![](/media/taco-neko-development/14-91bbcd.png)

![](/media/taco-neko-development/15-19e85f.png "The two final Suarez sprites. No red poncho. Barely an iconic ‘stache. But he’s there. One sprite is used for carrying and the other is empty handed. We’ll get to gameplay later.")

**Prototyping Gameplay**

![](/media/taco-neko-development/16-d0ae08.png "Prototypes for the Title Screen")

I started off with prototypes for the title screen. Again, in the consideration of time, I found A/B testing a very good strategy in my development, so once again I sent these off to my girlfriend, and she clearly preferred the bottom one, so I ran with that.

![](/media/taco-neko-development/17-4cc430.png "the intro cinematic, shamelessly out of order")

Then I came up with a story for Suavez. Now, I could have prototyped more stories, done more A/B testing, but I was running out of time, so I ran with this after receiving some good feedback as well. In the future, I would have liked to do just a bit more prototyping at this stage.

![](/media/taco-neko-development/18-b2654b.png "finally, true gameplay?!?")

Woo! A gameplay prototype- this one is mainly for role. I wanted to lay out how I want everything to work. A big thing here missing from the final game is the cats helping you gather- unfortunately GB studio simply didn’t support my vision (or at least I couldn’t find a way to make it to), so this prototype is an example of one that was iterated on throughout development as I reached different roadblocks. Speaking of which…

---

**Real Prototypes, Development, and Testing**

Whew! At this point in development, I really just didn’t realize how limited GB Studio really was. I had such grand ideas for my game, and didn’t even realize I was limited to 9 actors or just a few sprites. So this is the process of scaling back, and tweaking until we get our final game.

**Early Development**

Before we can test, we need a game right? I took the prototype from early and decided on the following flow —

- Title Screen
- Intro

and then, the Main Game Loop

- Grab Ingredients from Trees or Helpful Cats
- Place on Pedestals
- Assemble Taco
- Drop off Taco
- Feed hungry, angry cats that block key areas (pedestals, drop-offs)
- Do it a few times within a time limit and,
- Next level!

![](/media/taco-neko-development/19-eeadd4.png "An early build of the game")

Alright! So this is what I managed to get after a bit of time with GB studio. Photoshop allowed me to take my *beautifully* hand-drawn photos and put them inside GB Studio! So far so good. I programmed the story, and despite a lack of appropriate music, it actually seems really good! The font makes it a *bit* hard to read, but that’s just one of the limitations of GB Studio.

![](/media/taco-neko-development/20-782569.png)

![](/media/taco-neko-development/21-ff7a7a.png "The first debug level! Medium makes sprites look weird! Thing work! Great!")

You’ll also notice I made some more sprites! These were prototyped before, but I had to do some work and finicky pixel art to hopefully make them recognizable. We have bins for the cats to put ingredients into, for you to place the ingredients, for you to assemble the taco, and for you to deposit the taco. The bins were made 3D from the 2D prototypes, and actually came with a little bit of a struggle to decide what icons would be on the bins (letters? icons? names? — the end came with a mix of all three…perhaps due to my sprite art inability).

**Problems**

So the biggest technical problem I had with this first prototype was getting the cat to chase you. There were two big roadblocks. One was getting player position. GB Studio, while it won’t tell you outright, only supports one single Timer event — any other Timer events will override the previous ones. Because of this, it was hard to get multiple cats to follow the player. However, I was able to solve this by making everything run on a global Timer. But the second problem, was that moving an Actor in GB Studio *pauses the entire game while the Actor is moving*. There’s no way it would be fun to play a game which freezes every so often.

![](/media/taco-neko-development/22-df4c4d.png "9 actors…is exceedingly sparse for this map.")

Another problem was the map. Initially, I wanted it to be a wild landscape, with many, many trees. Well unfortunately, GB Studio doesn’t support more than 9 actors per scene. Considering the cat, pedestals, and 3 necessary trees — well that’s already 9 if you use 3 ingredients in a taco. Looking back now, I could have split the map up into different scenes to bypass this limit, but at the time I decided instead to radically pivot the game flow instead.

**Pivot to another Prototype**

You may have noticed another small change from the last two screenshots. If you didn’t, let’s highlight it here.

![](/media/taco-neko-development/20-782569.png)

![](/media/taco-neko-development/22-df4c4d.png "Notice the orange little area? Also, not the point, but I added more trees that are visually distinct so you know your meat trees from your taco shell trees. Removed a cat too to stay underneath the limit :<")

That orange area is a trigger in GB Studio. While pondering how I could make the cats an enemy without them running around, I remembered a fun little interaction I have in games like *Pokemon.* In *Pokemon*, when a trainer “sees” you — it means battle! And sometimes, trainers would spin around, trying to spot you. I remember trying to time myself just right so I could sneak past while they weren’t looking to escape a battle!

I decided this would be a prime mechanic for my game. The cats would spin around, and if they spotted you, you would drop everything and run all the way back to the start! It would change the strategy of the game a bit, but would work technically and still hopefully be fun. So I decided to prototype it out.

Naturally, I also needed to design a new map. No way would the large, open area work anymore — I needed a designed map, one that would challenge the player. Rather than sketch some designs by hand, I chose to use *Tiled*, a map editor. It was basically just sketching — just with the actual tiles. Also, I made a tileset!

![](/media/taco-neko-development/23-7eacca.png)

![](/media/taco-neko-development/24-c0653e.png "The first idea for a starting map. I then cropped it to the final version on the right. If I had time, I’d go back and iterate just a little more on this.")

![](/media/taco-neko-development/25-2be5f8.png "And the cute little tileset!")

And once I got done in *Tiled*, I moved the map fairly easily into GB Studio, and ported over the actors and triggers from the original map. Great! Houston, we have iteration!

![](/media/taco-neko-development/26-fcf8e1.png "The new starting map.")

But we’re not done yet. During playtesting, I realized that it was a little hard to tell which zones were safe and which ones weren’t, and that the cat had too much vision. I needed to make the cat more fair, or the game wouldn’t be fun. Also, I had to move the two pedestals on the left because apparently GB studio does not support more than 5 actors on one line, so when the player would be in-line with the bins, the fill bin would disappear! So, I simply moved the bins a bit.

![](/media/taco-neko-development/27-674b5b.png "The final intro level. Sorry for the scene change arrows getting in the way!")

So, another iteration! I changed the tiles so that dark tiles designate danger zones, so the player has a nice visual cue as to where they’re safe or not! I found out through testing that it’s fun hopping from safe zone to safe zone, so I kept this in mind while designing future levels. I remember testing this level, and despite a few graphical glitches, it was actually, genuinely… fun! Perhaps not the *most* enthralling game, but for the scope of this project, it was definitely great.

**An Interlude about Trees, Suavez, and Pedestals**

Before we get on to the last two levels of the game, I wanted to document a little bit about some of the smaller iterations.

![](/media/taco-neko-development/28-6b280a.png)

![](/media/taco-neko-development/29-cf1633.png)

![](/media/taco-neko-development/30-c6855f.png "Lettuce, Meat, and Shell Trees (Animated!)…I uh, forgot to animate the other two trees due to a time crunch. Oops! (Also, the bright green is transparency- it doesn’t actually show in game. Another GB Studio quirk!)")

Trees went through a bit of iteration. Every tree used to look the same, until I realized that wouldn’t really work. It was hard to keep track of which tree went to what. So I tried with different colors at first, but found GB studio to limit me again just a bit with that, as the Meat Trees appeared darker in game. So I animated the Taco Shell Tree, and changed the shape to a more recognizable taco shape.

![](/media/taco-neko-development/15-19e85f.png "Why does Suavez always carry his plate? Who knows.")

I also initially did not have separate sprites for carrying and not carrying for Suavez. I thought that just holding a plate would be enough to get the point across. During testing, I found it was a little weird to be “carrying” something without *carrying* something. So I quickly added a little taco (that really could be anything) and implemented a sprite sheet change. Now it looks great, and feels great.

![](/media/taco-neko-development/31-4af69f.png)

![](/media/taco-neko-development/32-920872.png)

![](/media/taco-neko-development/33-c99b17.png)

![](/media/taco-neko-development/34-dfb2a9.png "The unfilled and filled states for each of the boxes, sorry did I say boxes? I mean pedestals.")

Similarly, adding a visual feedback to the pedestals seemed to enhance the interactivity of the game. It just felt more real. The way I did it was a small trick- by changing the way an actor is facing, you can change the sprite that GB studio draws. So I was able to save quite a bit on the actor limit by just doing that.

![](/media/taco-neko-development/35-0cd775.png "R.I.P. CatBox. 2020–2020")

Finally, I had to remove something from the game. The cats, while they retained their ability to move, could have been companions that retrieved ingredients for you. Until they can move again, the purpose of the Cat Box no longer exists, so, well, it no longer exists.

---

**The Final Game**

We have our mechanics and technical parts complete! Now, it’s time to build the final two levels for a bit of added game time, and complete the final game! Thanks for sticking this long through my article!

**Level 2**

![](/media/taco-neko-development/36-1ba867.png "A beautiful annotation of the earliest iteration of Isle 2")

For Level 2, I always had the idea of adding a second cat and making the process of depositing a taco riskier. Before in level 1, if you dropped something, it would only be an ingredient. However, in Level 2, you have the potential to lose an entire taco on the way to your drop off! Unfortunately, to add another cat, I had to lose an ingredient. Sayonara for now, lettuce. Meat tacos all the way.

Immediately while testing the above design I noticed that it was very easy to get unluckily caught by the cats. You can avoid this by waiting them out, but there weren’t many places to do so, so I added a few more.

![](/media/taco-neko-development/37-555b5d.png "The second iteration. I added the correct tiles here, so you can see the danger zones.")

I added a few extra safe zones, but found that the middle safe zone was a little awkward to get into. So I opened it up, and got the final iteration.

![](/media/taco-neko-development/38-1333e8.png "The final level 2. The sea of red, by the way, is collision tiles that make up the boundary of the map.")

For the final level, I moved the pedestals a bit closer together, as it seemed to make more sense. I extended the safe zone because I decided it would be a good idea to try to challenge the player in another way- with time and quantity.

If you remember, there’s a time limit on every level which you have to drop off a certain amount of tacos by, or else you game over. Level 2’s purpose in the game is to check how familiar the player is with the game. Level 1 challenges you to make 3 tacos in 3 minutes, giving you time to figure out the controls and gameplay. But Level 2 ups that ante with 5 tacos in 2 minutes. During playtesting, this was still easily achievable, but it’s still a good roadblock before Level 3, which will be the most challenging one. You’ll actually notice, that Level 2 is a bit easier than Level 1, despite the added challenge of another cat, due to the sightlines being more restricted per cat (i.e., top cat is only active 1/4 of the time, when it looks right, and left cat is only active 1/2 the time).

**Level 3**

![](/media/taco-neko-development/39-8ecd8b.png "An initial prototype for the final level")

Going off the two cats idea, I tried to come up with an island which would make them more active and provide larger sightlines for them- effectively making more of the island a danger zone, and hopefully increasing the difficulty. I liked the idea of a donut shaped island for this, where the two cats sightlines could overlap as well, making you focus on two cats instead of one at a time.

![](/media/taco-neko-development/40-fc911a.png "Woo! A LOT more complexity")

I made the island a bit more complex so I could fit in safe zones at the sides, with the cats holding the middle.

![](/media/taco-neko-development/41-e6c320.png "Wait. I take it back. More simple, please!")

And broke down some walls immediately to aid player movement.

![](/media/taco-neko-development/42-f02b3e.png "How it looks like in game.")

Although the top image doesn’t show it, if you look at the danger zones, the rightmost cat was initially at the top! I moved it down because you couldn’t actually see it from the bottom safe zone, making the game a bit unfair and too much of a dice roll.

![](/media/taco-neko-development/43-9401d3.png "Asymmetrical?")

So I moved it down and tried a slightly asymmetrical design, but noticed the right side was hard to navigate, especially around the tree and the cat. So, that leaves us with…

![](/media/taco-neko-development/44-d501a9.png "The final Level 3. All symmetrical and nice…")

And we have our final level! As for timing, I found 3 Tacos in 3 minutes seemed to work, although I ran out of time for more playtesting. The game ends with you looping back to the main menu, ready to start another run.

I’m hoping to add a few more levels perhaps in the future, but for now, this is the final build of Taco Neko!

![](/media/taco-neko-development/45-de786d.png)

![](/media/taco-neko-development/46-f34f45.png)

![](/media/taco-neko-development/47-947c97.png "Final Gameplay")

Thanks for reading! I’ll try and keep this updated!

## Play TacoNeko on Itch.io

## [https://halmic.itch.io/taco-neko](https://halmic.itch.io/taco-neko)

---

Hearing my instructors playtest, I have to go back and rewrite some of the dialogue for the bins to account better for players already having made tacos, etc.

-Michal Bodzianowski
