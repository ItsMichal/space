# Writing articles

How posts on michal.ai (and the Mountaintop dev logs on halmic.com) should read. The reference is Sam Rose's
[Bloom Filters](https://samwho.dev/bloom-filters/): a teaching post that holds attention without decoration. What makes
it work, and what to borrow:

1. **Open with the problem, in one paragraph.** Say what the thing is for before how it works. The reader should know
   by the end of the first screen why they would keep going.
2. **Say what the reader needs to know first.** If the post leans on something, name it up front with a
   `before` callout and link to where it is explained. Do not make a reader find out halfway down.
3. **Ask the reader's question for them.** When a sentence will make a careful reader frown ("that can't be right",
   "why not just...?"), put that question in an `ask` callout and answer it in the next paragraph. Use it two or three
   times a post at most; it is a turn in a conversation, not a format.
4. **Use real numbers.** "A 10,000 bit filter with 3 hashes fills about a quarter of its bits after 1,000 items" beats
   "it fills up quickly". Measure, then write the number.
5. **Show the thing.** A photo of the board, a screenshot, a short loop or an embed does the work of a paragraph. Each
   figure gets a caption that says what to look at.
6. **One idea per section.** Headings are signposts a reader can skim back to; name them after what the section
   answers, not "Part 2".
7. **Code is commented and short.** Show the ten lines that matter, with a comment on the one that is surprising.
8. **Plain words.** No hype, no filler intros ("In today's world"), no closing summary that repeats the post. End on
   what you would do next or what is still open.

## The callouts

Both sites render the same fenced callout syntax:

```md
:::callout{type="before"}
This post assumes you know what a **pull-up resistor** is. [This page](https://example.com) explains it.
:::

:::callout{type="ask"}
Why not just read the pin directly and skip the resistor?
:::
```

| type      | renders as                                                              |
| --------- | ----------------------------------------------------------------------- |
| `note`    | boxed aside (the default; unknown types fall back to it)               |
| `tip`     | boxed aside, green edge                                                 |
| `warning` | boxed aside, orange edge                                                |
| `before`  | boxed aside led by "Before you continue", accent edge                   |
| `ask`     | the reader's question as a chat bubble, led by "You might be wondering" |

The lead-in text is fixed by the renderer (`components/mdx/Callout.tsx` here, `md.mjs` in halmic), so posts stay
consistent. The type allowlist is `CALLOUT_TYPES` in `lib/content/rules.mjs`. Examples of each: `/kitchen-sink`
under `react-router dev`.
