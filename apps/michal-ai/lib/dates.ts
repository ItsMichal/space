// Dates as the site prints them. Always in UTC, so a yyyy-mm-dd date never moves a day in a western time zone. A date may be
// a month only (yyyy-mm), as on hackathons and some press.

const format = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })

/** "Oct 2013", from 2013-10 or 2013-10-08. */
export const monthYear = (iso: string) => format(iso, { month: 'short', year: 'numeric' })

/** "Oct 8, 2013"; "Oct 2013" when only the month is known. */
export const fullDate = (iso: string) => (iso.length === 7 ? monthYear(iso) : format(iso, { month: 'short', day: 'numeric', year: 'numeric' }))

/** "Thursday, July 3, 2014". */
export const longDate = (iso: string) => format(iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
