// Starlink markets that opened after 15 April 2024 (the day I joined), with a sourced date and high or medium confidence.
// Derived from the research timeline (content/research/starlink/timeline.json on the research branch); low-confidence and
// undated launches are left out on purpose, so this is a sample of the roughly 70, not the full list. Each row links
// the best non-aggregator source. Never add a launch here without a source.

import type { TimelineItem } from '@/components/ui/timelineData'

export const STARLINK_JOINED_LABEL = '15 Apr 2024'

/** "About 70 more markets since April 2024": about 100 in June 2024 (Sierra Leone reported as the 100th) to 172 countries and territories in Sept 2026. Medium confidence; say roughly. */
export const STARLINK_MARKETS_SINCE = { value: 70, approx: true } as const

type Row = TimelineItem & { date: string; confidence: 'high' | 'medium' }

const rows: Row[] = [
  { id: "id", date: "2024-05-19", title: "Indonesia", summary: "Launch ceremony in Bali with Elon Musk; commercial availability announced by the communications minister.", source: { href: "https://aa.com.tr/en/science-technology/elon-musk-launches-starlink-internet-service-in-indonesia/3223851", label: "aa.com.tr" }, confidence: "high" },
  { id: "fj", date: "2024-05-20", title: "Fiji", summary: "Licensed Nov 2023; open for business May 2024.", source: { href: "https://advanced-television.com/2024/05/20/starlink-open-for-business-in-indonesia-fiji/", label: "advanced-television.com" }, confidence: "high" },
  { id: "sl", date: "2024-06-24", title: "Sierra Leone", summary: "Reported as the 100th Starlink market.", source: { href: "https://techpoint.africa/news/starlink-available-sierra-leone/", label: "techpoint.africa" }, confidence: "high" },
  { id: "mg", date: "2024-06-27", title: "Madagascar", summary: "Month agrees across sources (Jun 2024); day from one aggregator.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "gh", date: "2024-08", title: "Ghana", summary: "Reported live to customers.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "bw", date: "2024-08-28", title: "Botswana", summary: "Reported live to customers.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "high" },
  { id: "bi", date: "2024-09", title: "Burundi", summary: "Operating licence by presidential decree in May 2024.", source: { href: "https://spaceinafrica.com/2024/09/24/starlink-expands-its-satellite-internet-operations-to-burundi/", label: "spaceinafrica.com" }, confidence: "high" },
  { id: "zw", date: "2024-09-07", title: "Zimbabwe", summary: "Regulator licensing status was disputed in 2024; sold out within weeks of launch.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "cv", date: "2024-12-10", title: "Cabo Verde", summary: "Reported as the 117th market.", source: { href: "https://spaceinafrica.com/2024/12/10/starlink-now-operational-in-cape-verde/", label: "spaceinafrica.com" }, confidence: "high" },
  { id: "lr", date: "2025-01", title: "Liberia", summary: "Reported live to customers.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "bt", date: "2025-02-11", title: "Bhutan", summary: "Announced by Elon Musk on X.", source: { href: "https://www.tbsnews.net/tech/elon-musk-confirms-starlink-satellite-internet-launched-bhutan-1066921", label: "tbsnews.net" }, confidence: "high" },
  { id: "ne", date: "2025-03", title: "Niger", summary: "Reported live to customers.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "am", date: "2025-03-27", title: "Armenia", summary: "Reported as the 130th country/territory/market.", source: { href: "https://www.arkatelecom.am/en/news/telecom/elon-musk-announces-starlink-launch-in-armenia/", label: "arkatelecom.am" }, confidence: "high" },
  { id: "om", date: "2025-03-27", title: "Oman", summary: "Date is the date of The National's article reporting Musk's X post.", source: { href: "https://thenational-the-national-prod.cdn.arcpublishing.com/future/technology/2025/03/27/starlink-internet-service-now-available-in-oman", label: "thenational-the-national-prod.cdn.arcpublishing.com" }, confidence: "medium" },
  { id: "jo", date: "2025-04-09", title: "Jordan", summary: "Date is the date of The National's article.", source: { href: "https://thenational-the-national-prod.cdn.arcpublishing.com/future/technology/2025/04/09/starlink-internet-now-available-in-jordan", label: "thenational-the-national-prod.cdn.arcpublishing.com" }, confidence: "medium" },
  { id: "bd", date: "2025-05-20", title: "Bangladesh", summary: "Licence approved Apr 28 2025.", source: { href: "https://www.deccanherald.com/amp/story/world%2Fstarlink-launches-in-bangladesh-to-boost-reliable-internet-access-3548587", label: "deccanherald.com" }, confidence: "high" },
  { id: "gw", date: "2025-06", title: "Guinea-Bissau", summary: "Reported live to customers.", source: { href: "https://allafrica.com/stories/202506230372.html", label: "allafrica.com" }, confidence: "high" },
  { id: "cd", date: "2025-06", title: "Democratic Republic of the Congo", summary: "Reported live to customers.", source: { href: "https://allafrica.com/stories/202506050012.html", label: "allafrica.com" }, confidence: "high" },
  { id: "ls", date: "2025-06", title: "Lesotho", summary: "Licence granted Apr 14 2025.", source: { href: "https://allafrica.com/stories/202506230372.html", label: "allafrica.com" }, confidence: "high" },
  { id: "lk", date: "2025-07-02", title: "Sri Lanka", summary: "Delayed from Mar 2025 over lawful-interception concerns.", source: { href: "https://www.southasiatime.com/2025/07/03/starlink-launches-in-sri-lanka-expands-south-asian-footprint/", label: "southasiatime.com" }, confidence: "high" },
  { id: "kz", date: "2025-08-13", title: "Kazakhstan", summary: "Following a June 2025 agreement with the government.", source: { href: "https://qazinform.com/news/starlink-internet-officially-launches-in-kazakhstan-5d71e8", label: "qazinform.com" }, confidence: "high" },
  { id: "bo", date: "2026-02-02", title: "Bolivia", summary: "Blocked in Aug 2024; restrictions lifted by decree Dec 2025; operating under an experimental licence.", source: { href: "https://dplnews.com/?p=304248", label: "dplnews.com" }, confidence: "medium" },
  { id: "sn", date: "2026-02-04", title: "Senegal", summary: "Described as the 26th African market.", source: { href: "https://www.ecofinagency.com/news-digital/0402-52566-starlink-s-satellite-internet-services-are-now-operational-in-senegal", label: "ecofinagency.com" }, confidence: "high" },
  { id: "tj", date: "2026-02-05", title: "Tajikistan", summary: "Via state-owned Tajiktelecom; initial focus on government and remote institutions.", source: { href: "https://thediplomat.com/2026/02/starlink-launches-in-tajikistan/", label: "thediplomat.com" }, confidence: "high" },
  { id: "ae", date: "2026-03-18", title: "United Arab Emirates", summary: "The National (Mar 2026) says available per Starlink's website; a Sept 2026 report claims an official launch after TDRA approval.", source: { href: "https://www.thenationalnews.com/news/uae/2026/03/18/elon-musks-starlink-now-available-in-uae-says-companys-website/", label: "thenationalnews.com" }, confidence: "medium" },
  { id: "vn", date: "2026-08-13", title: "Vietnam", summary: "Licensed Feb 2026; orders opened Aug 13 2026.", source: { href: "https://dtinews.dantri.com.vn/vietnam-today/starlink-officially-launches-commercial-internet-service-in-vietnam-20260813135004563.htm", label: "dtinews.dantri.com.vn" }, confidence: "high" },
  { id: "ug", date: "2026-09-01", title: "Uganda", summary: "MoU and operational licence signed May 15 2026.", source: { href: "https://spaceinafrica.com/2026/09/01/starlink-is-now-live-in-uganda/", label: "spaceinafrica.com" }, confidence: "high" },
]

export const starlinkLaunches: TimelineItem[] = rows.map(({ confidence: _c, ...it }) => it)
export const starlinkDatedCount = rows.length
