// Posts from https://x.com/ItsMichal to quote on /about ("Elsewhere"). Static quote cards: text, date and a link, no embed script.
//
// EMPTY ON PURPOSE. X cannot be read without logging in (the profile page is a JavaScript shell, the syndication timeline returns no
// entries, search engines index none of his posts, nothing is archived), and the posts were not invented. To add one, paste its exact
// text, ISO date and URL below; the card renders automatically and the "Elsewhere" card appears. Two to four is the intended count.
// Only add posts that are public statements you are happy to re-publish: no non-public employer information, nothing personal.

export type XHighlight = {
  /** Status URL, e.g. https://x.com/ItsMichal/status/123. */
  url: string
  /** ISO date (YYYY-MM-DD) shown on the card. */
  date: string
  /** Exact text of the post. Do not edit it. */
  text: string
  /** Optional one-line note on why it is shown, for the card's meta line. Keep neutral. */
  note?: string
}

export const xHighlights: readonly XHighlight[] = []
