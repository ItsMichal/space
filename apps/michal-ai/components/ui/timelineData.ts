export type TimelineIconName = 'satellite' | 'globe' | 'file' | 'users' | 'rocket'

export type TimelineItem = {
  id: string
  /** ISO date (yyyy-mm-dd or yyyy-mm) or a bare year. Used for year marks and the dateTime attribute. Omit when unknown. */
  date?: string
  /** What to show instead of the formatted date, e.g. "2020 to now". */
  dateLabel?: string
  title: string
  /** Short form of the title for the scrub strip, where space is tight. The detail below always shows the full title. */
  label?: string
  /** One line. */
  summary?: string
  /** A picture from the image pipeline (path under /media/...). Shown as the thumbnail on the strip and large in the detail. */
  image?: { src: string; alt: string; focus?: string }
  /** Named icon, used on the strip and in the detail when there is no image. */
  icon?: TimelineIconName
  link?: { href: string; label: string }
  /** Where the fact comes from; shown under the detail. */
  source?: { href: string; label: string }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const yearOf = (date: string) => date.slice(0, 4)

/** "Apr 2024", "15 Apr 2024", or "2024" depending on how precise the date is. */
export function formatDate(date: string, withDay = false): string {
  const [y, m, d] = date.split('-')
  if (!m) return y
  const mon = MONTHS[Number(m) - 1] ?? ''
  return withDay && d ? `${Number(d)} ${mon} ${y}` : `${mon} ${y}`
}

/** Index of the first item of every year, for serif year labels above the rail. */
export function yearMarks(items: readonly TimelineItem[]): { index: number; year: string }[] {
  const out: { index: number; year: string }[] = []
  let prev = ''
  items.forEach((it, index) => {
    if (!it.date) return
    const year = yearOf(it.date)
    if (year !== prev) out.push({ index, year })
    prev = year
  })
  return out
}
