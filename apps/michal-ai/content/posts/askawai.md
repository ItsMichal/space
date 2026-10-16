---
title: "AskawAI"
slug: askawai
kind: project
id: askawai
description: "A worksheet generator for teachers: enter a topic, get AI-written questions and answers, export to DOCX. Built at T9Hacks 2022."
date: 2022-02-19
tags: ["Next.js", "React", "Tailwind", "OpenAI", "AI/ML", "Web"]
minor: true
role: "OpenAI integration, back-end"
links:
  - label: "Repo"
    href: "https://github.com/ItsMichal/askawAI"
  - label: "Devpost"
    href: "https://devpost.com/software/askawai"
---

AskawAI is a worksheet generator for teachers. You type in a topic, it asks OpenAI for questions and answers, and you can export the result as a DOCX to edit and print.

We built it at T9Hacks 2022, a team of two (that's how many people Devpost lists). I took the OpenAI integration and the back end. Under the hood it's two steps: one request asks a GPT-3 model (text-curie-001) for eight questions on the topic, then it loops through them asking for an answer to each. There's a comment in the code admitting that could probably be one call. The front end is Next.js, React and Tailwind.

The hard parts, per our Devpost page, were getting the AI to respond in a way that felt responsive, and turning the results into a printable DOCX file. Neither of us had worked with AI before, so we were pretty proud that a question generator worked at all.

The README still says "Under construction", which is fair. The wish list on Devpost was ratings for questions, and letting teachers edit the generated questions and answers directly.
