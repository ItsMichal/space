---
title: "Pilsudski"
slug: pilsudski
kind: project
id: pilsudski
description: "An API.AI webhook behind a high school class project: a virtual dialogue with Kaiser Wilhelm II. Featured in The Denver Post in 2017."
date: 2017-01-11
tags: ["Node.js", "API.AI", "Express", "AI/ML"]
minor: true
role: "Co-lead, webhook author"
years: "2017"
links:
  - label: "Denver Post article"
    href: "https://www.denverpost.com/2017/02/21/highlands-ranch-history-class-artificial-intelligence/"
---

Pilsudski is a small API.AI webhook I wrote in my sophomore year of high school for a World War I class project: a virtual dialogue with the Kaiser. The class was asked to bring a WWI figure to life with code, and I co-led ours with a classmate.

Our Kaiser wants a war, and your job is to talk him out of it. The webhook is the game logic. Every thing you say moves a "temperament" score up or down. It starts at 10, and at 0 he declares war. Get it to 20 and he decides a war may not be the best course of action after all. Say the same thing twice and he calls you out for repeating yourself. The responses live in a config file, so anyone setting up their own character could rewrite them without touching the code, and a text-to-speech step plays each reply out loud in a browser page.

It's named after the leader of the Polish troops in WWI. [The Denver Post](https://www.denverpost.com/2017/02/21/highlands-ranch-history-class-artificial-intelligence/) wrote about the project on February 21, 2017. The project is retired now (the README says so), but there were two videos made for it: the three-minute media pitch, and a tutorial for connecting Pilsudski to API.AI.

::youtube{id="a09E8_-fFIc" title="the kAIser | Express Media Pitch"}

::youtube{id="qcjxwh1tkck" title="Pilsudski Tutorial"}
