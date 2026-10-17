const ESC: Record<string, string> = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' }

/** JSON for a <script type="application/ld+json"> body: nothing in it can end the element or break the script. */
export function jsonLdText(item: object): string {
  return JSON.stringify(item).replace(/[<>&\u2028\u2029]/g, (c) => ESC[c])
}

/** Renders one or more schema.org JSON-LD objects as <script type="application/ld+json">. */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Post text ends up here and is untrusted: `<`, `>` and `&` are escaped so it can never close the script tag or open a
          // comment, and U+2028/U+2029 so the JSON stays valid JavaScript for any consumer that evaluates it.
          dangerouslySetInnerHTML={{ __html: jsonLdText(item) }}
        />
      ))}
    </>
  )
}
