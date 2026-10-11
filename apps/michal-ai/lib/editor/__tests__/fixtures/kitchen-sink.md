## Every block, once

A paragraph with **bold**, _italic_, ~~strike~~, `inline code`, a [link](https://michal.us "A title") and **_bold italic_ together**, plus [`code in a link`](https://example.com).

Line one with a hard break\
line two.

### A third-level heading

#### A fourth-level heading

- bullet one
- bullet two
  - nested a
  - nested b
    1. deep ordered
    2. deep ordered two
- bullet three

3. starts at three
4. four

- plain item in a mixed list
- [ ] todo open
- [x] todo done
  - [ ] nested todo

> A quote with **bold**.
>
> - and a list inside

```ts title="example.ts"
const answer: number = 42
```

```
no language
```

---

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |
| `d`  | **e**  |  [f](https://f.dev) |

![A plain figure](/media/example/one.webp)

![Figure with caption](/media/example/two.webp "The caption lives in the title")

::youtube{id="dQw4w9WgXcQ"}

::youtube{id="dQw4w9WgXcQ" title="Never gonna"}

::embed{url="https://example.com" ratio="4 / 3"}

:::callout{type="warning"}
Careful, this is a **callout** with a list:

- one
- two

:::

:::callout{type="tip"}
Outer.

::::callout{type="note"}
Inner callout.
::::
:::

Urls like https://michal.us/path stay literal, as does a_b_c and 2 * 3 * 4.

<div class="raw">raw html is kept verbatim</div>

[ref]: https://example.com "Reference definition"
