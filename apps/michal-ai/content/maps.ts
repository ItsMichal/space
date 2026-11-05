// Data for the ::map directive (components/mdx/WorldMap.tsx): each map lights up a set of countries on a world map.
//
// starlink-markets: every country or territory where Starlink service went live between 15 April 2024 (when I joined)
// and 15 October 2026. Worked out from Starlink's own availability file, the one starlink.com/map draws, as archived by
// the Wayback Machine on those two days:
//   before  https://web.archive.org/web/20240415120500/https://api.starlink.com/public-files/availability.json
//   after   https://web.archive.org/web/20261015051932/https://starlink.com/public-files/availability.json
// (The map page moved the file from api.starlink.com to starlink.com in 2025; the archived map pages are
// https://web.archive.org/web/20240415005543/https://www.starlink.com/map and
// https://web.archive.org/web/20261024083941/https://starlink.com/map.)
// The file keys each country by its ISO 3166-1 alpha-2 code under "admin0", with a status. The map page shows "launched"
// and "available" as Available Now; anything else (coming_soon, faq, unknown, blacklisted, pending_regulatory, ...) is not
// live. A place is listed here when it is live in the after file and not live in the before file: 84 places. None that
// were live in April 2024 had stopped being live by October 2026, so nothing is lost by counting only the new ones.
// Left out: the file's "admin1" entries (states and provinces, keyed by opaque Mapbox boundary ids), since their names
// cannot be read from the archive. Some places listed are territories rather than countries (Antarctica, Bouvet Island,
// South Georgia, the U.S. Minor Outlying Islands, Pitcairn, Saint Helena and others); the file lists them like countries.
// Bouvet Island has no shape in Natural Earth, so it is in the list but not drawn.
//
// Each place: [ISO alpha-2, ISO numeric (the key into lib/maps/world.gen.ts; XK for Kosovo, which has none), English name].

export type MapPlace = readonly [code: string, iso: string, name: string]

export type WorldMapData = {
  title: string
  lede: string
  /** what a lit country means, for the legend */
  legend: string
  places: readonly MapPlace[]
  sources: readonly { label: string; url: string }[]
}

export const maps: Record<string, WorldMapData> = {
  'starlink-markets': {
    title: 'Where Starlink went live since I joined',
    lede: 'Countries and territories where Starlink service became available between 15 April 2024, when I joined, and 15 October 2026.',
    legend: 'Went live',
    places: [
    ['AE', '784', 'United Arab Emirates'],
    ['AG', '028', 'Antigua and Barbuda'],
    ['AM', '051', 'Armenia'],
    ['AQ', '010', 'Antarctica'],
    ['AX', '248', 'Åland Islands'],
    ['AZ', '031', 'Azerbaijan'],
    ['BD', '050', 'Bangladesh'],
    ['BH', '048', 'Bahrain'],
    ['BI', '108', 'Burundi'],
    ['BO', '068', 'Bolivia'],
    ['BT', '064', 'Bhutan'],
    ['BV', '074', 'Bouvet Island'],
    ['BW', '072', 'Botswana'],
    ['CD', '180', 'Democratic Republic of the Congo'],
    ['CF', '140', 'Central African Republic'],
    ['CI', '384', "Côte d'Ivoire"],
    ['CK', '184', 'Cook Islands'],
    ['CV', '132', 'Cape Verde'],
    ['CW', '531', 'Curaçao'],
    ['DM', '212', 'Dominica'],
    ['FJ', '242', 'Fiji'],
    ['FK', '238', 'Falkland Islands'],
    ['FM', '583', 'Micronesia'],
    ['FO', '234', 'Faroe Islands'],
    ['GH', '288', 'Ghana'],
    ['GI', '292', 'Gibraltar'],
    ['GQ', '226', 'Equatorial Guinea'],
    ['GS', '239', 'South Georgia and South Sandwich Islands'],
    ['GW', '624', 'Guinea-Bissau'],
    ['GY', '328', 'Guyana'],
    ['ID', '360', 'Indonesia'],
    ['IL', '376', 'Israel'],
    ['IQ', '368', 'Iraq'],
    ['JO', '400', 'Jordan'],
    ['KG', '417', 'Kyrgyzstan'],
    ['KI', '296', 'Kiribati'],
    ['KR', '410', 'South Korea'],
    ['KW', '414', 'Kuwait'],
    ['KY', '136', 'Cayman Islands'],
    ['KZ', '398', 'Kazakhstan'],
    ['LB', '422', 'Lebanon'],
    ['LI', '438', 'Liechtenstein'],
    ['LK', '144', 'Sri Lanka'],
    ['LR', '430', 'Liberia'],
    ['LS', '426', 'Lesotho'],
    ['MF', '663', 'Saint Martin'],
    ['MG', '450', 'Madagascar'],
    ['MH', '584', 'Marshall Islands'],
    ['MS', '500', 'Montserrat'],
    ['NE', '562', 'Niger'],
    ['NR', '520', 'Nauru'],
    ['NU', '570', 'Niue'],
    ['OM', '512', 'Oman'],
    ['PG', '598', 'Papua New Guinea'],
    ['PM', '666', 'Saint Pierre and Miquelon'],
    ['PN', '612', 'Pitcairn Islands'],
    ['QA', '634', 'Qatar'],
    ['SB', '090', 'Solomon Islands'],
    ['SC', '690', 'Seychelles'],
    ['SG', '702', 'Singapore'],
    ['SH', '654', 'Saint Helena'],
    ['SL', '694', 'Sierra Leone'],
    ['SN', '686', 'Senegal'],
    ['SO', '706', 'Somalia'],
    ['SS', '728', 'South Sudan'],
    ['ST', '678', 'São Tomé and Príncipe'],
    ['SX', '534', 'Sint Maarten'],
    ['TC', '796', 'Turks and Caicos Islands'],
    ['TD', '148', 'Chad'],
    ['TJ', '762', 'Tajikistan'],
    ['TL', '626', 'Timor-Leste'],
    ['TO', '776', 'Tonga'],
    ['TV', '798', 'Tuvalu'],
    ['UG', '800', 'Uganda'],
    ['UM', '581', 'U.S. Minor Outlying Islands'],
    ['UY', '858', 'Uruguay'],
    ['VC', '670', 'Saint Vincent and the Grenadines'],
    ['VE', '862', 'Venezuela'],
    ['VN', '704', 'Vietnam'],
    ['VU', '548', 'Vanuatu'],
    ['WS', '882', 'Samoa'],
    ['XK', 'XK', 'Kosovo'],
    ['YE', '887', 'Yemen'],
    ['ZW', '716', 'Zimbabwe'],
    ],
    sources: [
      { label: 'Starlink availability, 15 Apr 2024', url: 'https://web.archive.org/web/20240415120500/https://api.starlink.com/public-files/availability.json' },
      { label: '15 Oct 2026', url: 'https://web.archive.org/web/20261015051932/https://starlink.com/public-files/availability.json' },
    ],
  },
}

export const MAP_IDS = Object.keys(maps)

export const mapById = (id: string): WorldMapData | undefined => (Object.hasOwn(maps, id) ? maps[id] : undefined)
