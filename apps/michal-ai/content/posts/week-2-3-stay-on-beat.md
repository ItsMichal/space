---
title: "Stay on Beat - Week 2→3 Recap"
slug: week-2-3-stay-on-beat
kind: article
id: mountaintop-stay-on-beat-week-2-3-recap
description: "Fixing a shallow-versus-deep copy bug that broke ghost movement, then adding scoring, lighting and theming on the way to a playable demo."
date: 2023-01-30
updated: 2023-02-02
tags: ["Project Mountaintop"]
parent: project-mountaintop
series: "Progress log"
order: 2
---

![Project Mountaintop in play: glowing hit targets with Z and X key prompts, a 1x multiplier and a Perfect rating](/media/mountaintop-stay-on-beat-week-2-3-recap/screenshot-2023-02-02-at-1-22-03-am-529950.webp "A snapshot of where we ended up this week!")

## Where we left off…

Last week we left off completing the following goals- and creating a pretty buggy demo. This week is all about fixing those last bugs and creating a demo.

:::callout{type="note"}
Week 2 Goals

- Get basic rhythm game done (Start->Select Song->Play->Score->Repeat or End)
  - Thought I would have more time but at least we have… something!
- Start reaching out to third-party developers
  - Oof. Did not do this.
- Create an overall outline and rough design docs for the overarching final game (story, gameplay loop)
  - Okay! We have basically this, but more could be done too
:::

So let’s look at the goals for this week in more detail

:::callout{type="note"}
Week 3 Goals

- Get a playable demo out and start testing!
- Actually start reaching out
- Create a community for testers to give feedback and receive updated builds
:::

Cool! With that in mind let’s see what actually happened

## Finding the Beat

Last week we had a build with a pretty crazy bug that made the ghosts freak out and come at the player unexpectedly fast. Luckily after a not insignificant amount of time, my Deep CS Knowledge™ came in handy.

```csharp
private Transform initialPosition; //Holds where we started
public GameObject hitPoint; //Holds where we want to go
//...
void Start() {
	initialPosition = transform; //Set the initialPosition at the start
	//...
}
void Update(){
	//... yada yada logic that runs this
	//... when it needs to

		//Move between where we started and where we're going
		transform.position = Vector3.Lerp(initialPosition.postion,
																			hitPoint.transform.position,
																			time/timeUntilHitpointMs //<- this works
																			);
}
```

_GhostController.cs Buggy Version_

Can you find out what’s wrong? All the info you need is in that code block. Once you’re done, read on for what’s wrong and the “fixed” code.

### Solution to the 👻 Problem

```csharp
private Vector3 initialPosition; //Holds where we started, now as Vec3
public GameObject hitPoint; //Holds where we want to go
//...
void Start() {
	//This time we do a 100% no doubt deep copy!
	initialPosition = new Vector3(transform.position.x,
																transform.position.y,
																transform.position.z);

	//...
}
//This is mostly the same now- but uses Vec3 directly V
void Update(){
	//... yada yada logic that runs this
	//... when it needs to

		//Move between where we started and where we're going
		transform.position = Vector3.Lerp(initialPosition,
																			hitPoint.transform.position,
																			time/timeUntilHitpointMs //<- this works
																			);
}
```

So!

Remember shallow vs deep copies? Or in other words, reference copy vs value copy? Well turns out that’s what was happening, and instead of a nice linear interpolation, it became exponential. This is because initialPosition was just a direct reference to the ghost’s position! And so instead of the intended behaviour (going smoothly from A to B), we got the exponential (or logarhythmic) behavior of going really fast to really close to the point, and then very slowly (imperceptibly slow) to the end.

### More work…

Next once it was fixed I started adding and improving the systems. Here’s what we started with from last week, and a comparison of some of the initial progress this week

::youtube{id="2DPVz25OXSM"}

::youtube{id="LEA6cLfjWCw"}

← Last Week ☝️ This Week

So as you can see the biggest features are better visual indicators and a scoring system! However… the text popups aren’t the best indicator of progress, so that would be my next steps. Something else to note aside from the bug fixes is that I went through some iterating on the architecture- rather than changing color we now can change Prefabs for example. Just some improvements as I add support for important detailing/feel development which should be done in just a few weeks. A good system now means hours saved later!

::youtube{id="XJyu9yzEtCU"}

Well, another dev session goes by and we are so close to a playable demo. We’ve added new lighting, a skybox, more theming, clearer texts, and a prototype score display! This should be enough for a “feel” prototype and in fact, I’ve gotten some feedback from Danny Rankin on an earlier version of the above video (pre-graphics stuff). Most of the feedback was just on improving the feel and connecting more with the physical interaction- we’ve had a bit of brainstorming and you’ll see that I’ve tweaked the camera angles and a few other things- starting to work on “feel” more than just “can I hit ghost”

The biggest things missing from a released demo to my friends and other interested parties… is just really the music, ironically. I built the music system in another project last semester, so its finally time to bring that in. I was planning to have that done this week but ran into some roadblocks, mostly as I had some time dedicated to this capstone sapped away by a day spent applying for Apple. So its a bit of catchup here to get the demo in more hands but at least I’ve had some feedback to work off of anyways.

### Recap-

:::callout{type="note"}
Week 3 Goals

- Get a playable demo out and start testing!
  - So close to achieving this… aghhhh.
- Actually start reaching out
  - It’s pretty hard to find someone that has the time to give good feedback and mentorship- that would be valuable in terms of having the technical skill and also not being from CU. Regardless, I didn’t spend as much time as I should have this week on this goal, in favor of just forging ahead myself.
- Create a community for testers to give feedback and receive updated builds
  - Reached out to a few friends and got confirmations of interests, but have yet to setup a server and send out invites, mostly because I want to have a demo and feedback form in place before I do.
:::

Honestly I made some good progress from last week, even if on the surface its not too apparent from the videos (again a lot of the systems were expanded behind the scenes, to make stuff like animations or FX much easier to implement- before it was just hacked together to quickly tell me if something worked or not).

However I did miss a bit of the coursework assignments, and am definitely behind on finding a mentor at this point that isn’t named Danny Rankin. By next week I’ll be looking to have a playable music demo with tracks and begin replacing default assets. I’ll also look forward to changing the animation (from the up/down “punching”) to one that more closely resembles Abby’s progress and control (and maybe we can start integrating that too?)

-m

[halmic.co](https://halmic.co)
