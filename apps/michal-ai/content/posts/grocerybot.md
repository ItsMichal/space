---
title: "Grocerybot"
slug: grocerybot
kind: project
id: grocerybot
description: "A proof-of-concept shopping robot in the Webots simulator, built with inverse kinematics, object recognition and path planning for a robotics course."
date: 2021-08-26
tags: ["Python", "Webots", "Flask", "Robotics"]
minor: true
role: "Programming lead"
years: "2021"
links:
  - label: "Repo"
    href: "https://github.com/ItsMichal/Grocerybot"
---

Grocerybot (formerly RoboShopper 3000) was our final project for CSCI 3302, Intro to Robotics at CU Boulder, in Spring 2021. It's a proof-of-concept robot that takes a shopping list from a web app, drives around a simulated grocery store collecting the items on it, and heads back to checkout when it's done. There were three of us on the team, and I was the programming lead: inverse kinematics, vision, control flow, the robot's design and the web server.

The robot is a Tiago Steel running in Webots, controlled from Python. The shopping list comes from a small Flask server, so you pick your items on a web page and click shop soon after the simulation starts. If the server isn't running, the robot defaults to oranges and beers. The arm reaches using inverse kinematics with the IKPY library, and the repo includes my notes on getting IKPY to work with the Tiago, which took a few days of struggling.

The README keeps a short list of known problems: it's slow in real time, the arm's IK fails on certain objects, the path planning is prone to failure and overly complex, and the state machine could use a clean-up. It's a proof of concept, and the README asks you to treat it as one.

::youtube{id="YaHhRhEKA_I" title="Grocerybot demo"}
