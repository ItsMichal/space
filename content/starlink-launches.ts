// Starlink markets that opened after 15 April 2024 (the day I joined), with a sourced date and high or medium confidence.
// Derived from the research timeline (content/research/starlink/timeline.json on the research branch); low-confidence and
// undated launches are left out on purpose, so this is a sample, not the full list. Entries whose date or source was disputed are dropped; medium-confidence ones show month precision only. Each row links
// the best non-aggregator source. Never add a launch here without a source.

import type { TimelineItem } from '@/components/ui/timelineData'

export const STARLINK_JOINED_LABEL = '15 Apr 2024'

type Row = TimelineItem & { date: string; confidence: 'high' | 'medium' }

const rows: Row[] = [
  { id: "id", date: "2024-05-19", title: "Indonesia", summary: "Service became available in Indonesia.", source: { href: "https://aa.com.tr/en/science-technology/elon-musk-launches-starlink-internet-service-in-indonesia/3223851", label: "aa.com.tr" }, confidence: "high" },
  { id: "fj", date: "2024-05-20", title: "Fiji", summary: "Service became available in Fiji.", source: { href: "https://advanced-television.com/2024/05/20/starlink-open-for-business-in-indonesia-fiji/", label: "advanced-television.com" }, confidence: "high" },
  { id: "sl", date: "2024-06-24", title: "Sierra Leone", summary: "Service became available in Sierra Leone.", source: { href: "https://techpoint.africa/news/starlink-available-sierra-leone/", label: "techpoint.africa" }, confidence: "high" },
  { id: "mg", date: "2024-06", title: "Madagascar", summary: "Service became available in Madagascar.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "gh", date: "2024-08", title: "Ghana", summary: "Service became available in Ghana.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "bw", date: "2024-08-28", title: "Botswana", summary: "Service became available in Botswana.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "high" },
  { id: "bi", date: "2024-09", title: "Burundi", summary: "Service became available in Burundi.", source: { href: "https://spaceinafrica.com/2024/09/24/starlink-expands-its-satellite-internet-operations-to-burundi/", label: "spaceinafrica.com" }, confidence: "high" },
  { id: "cv", date: "2024-12-10", title: "Cabo Verde", summary: "Service became available in Cabo Verde.", source: { href: "https://spaceinafrica.com/2024/12/10/starlink-now-operational-in-cape-verde/", label: "spaceinafrica.com" }, confidence: "high" },
  { id: "lr", date: "2025-01", title: "Liberia", summary: "Service became available in Liberia.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "bt", date: "2025-02-11", title: "Bhutan", summary: "Service became available in Bhutan.", source: { href: "https://www.tbsnews.net/tech/elon-musk-confirms-starlink-satellite-internet-launched-bhutan-1066921", label: "tbsnews.net" }, confidence: "high" },
  { id: "ne", date: "2025-03", title: "Niger", summary: "Service became available in Niger.", source: { href: "https://resources.telegeography.com/starlink-expanding-in-africa", label: "resources.telegeography.com" }, confidence: "medium" },
  { id: "am", date: "2025-03-27", title: "Armenia", summary: "Service became available in Armenia.", source: { href: "https://www.arkatelecom.am/en/news/telecom/elon-musk-announces-starlink-launch-in-armenia/", label: "arkatelecom.am" }, confidence: "high" },
  { id: "om", date: "2025-03", title: "Oman", summary: "Service became available in Oman.", source: { href: "https://thenational-the-national-prod.cdn.arcpublishing.com/future/technology/2025/03/27/starlink-internet-service-now-available-in-oman", label: "thenationalnews.com" }, confidence: "medium" },
  { id: "jo", date: "2025-04", title: "Jordan", summary: "Service became available in Jordan.", source: { href: "https://thenational-the-national-prod.cdn.arcpublishing.com/future/technology/2025/04/09/starlink-internet-now-available-in-jordan", label: "thenationalnews.com" }, confidence: "medium" },
  { id: "bd", date: "2025-05-20", title: "Bangladesh", summary: "Service became available in Bangladesh.", source: { href: "https://www.deccanherald.com/amp/story/world%2Fstarlink-launches-in-bangladesh-to-boost-reliable-internet-access-3548587", label: "deccanherald.com" }, confidence: "high" },
  { id: "gw", date: "2025-06", title: "Guinea-Bissau", summary: "Service became available in Guinea-Bissau.", source: { href: "https://allafrica.com/stories/202506230372.html", label: "allafrica.com" }, confidence: "high" },
  { id: "cd", date: "2025-06", title: "Democratic Republic of the Congo", summary: "Service became available in the Democratic Republic of the Congo.", source: { href: "https://allafrica.com/stories/202506050012.html", label: "allafrica.com" }, confidence: "high" },
  { id: "ls", date: "2025-06", title: "Lesotho", summary: "Service became available in Lesotho.", source: { href: "https://allafrica.com/stories/202506230372.html", label: "allafrica.com" }, confidence: "high" },
  { id: "lk", date: "2025-07-02", title: "Sri Lanka", summary: "Service became available in Sri Lanka.", source: { href: "https://www.southasiatime.com/2025/07/03/starlink-launches-in-sri-lanka-expands-south-asian-footprint/", label: "southasiatime.com" }, confidence: "high" },
  { id: "kz", date: "2025-08-13", title: "Kazakhstan", summary: "Service became available in Kazakhstan.", source: { href: "https://qazinform.com/news/starlink-internet-officially-launches-in-kazakhstan-5d71e8", label: "qazinform.com" }, confidence: "high" },
  { id: "sn", date: "2026-02-04", title: "Senegal", summary: "Service became available in Senegal.", source: { href: "https://www.ecofinagency.com/news-digital/0402-52566-starlink-s-satellite-internet-services-are-now-operational-in-senegal", label: "ecofinagency.com" }, confidence: "high" },
  { id: "tj", date: "2026-02-05", title: "Tajikistan", summary: "Service became available in Tajikistan.", source: { href: "https://thediplomat.com/2026/02/starlink-launches-in-tajikistan/", label: "thediplomat.com" }, confidence: "high" },
  { id: "ae", date: "2026-03", title: "United Arab Emirates", summary: "Service became available in the United Arab Emirates.", source: { href: "https://www.thenationalnews.com/news/uae/2026/03/18/elon-musks-starlink-now-available-in-uae-says-companys-website/", label: "thenationalnews.com" }, confidence: "medium" },
  { id: "vn", date: "2026-08-13", title: "Vietnam", summary: "Service became available in Vietnam.", source: { href: "https://dtinews.dantri.com.vn/vietnam-today/starlink-officially-launches-commercial-internet-service-in-vietnam-20260813135004563.htm", label: "dtinews.dantri.com.vn" }, confidence: "high" },
  { id: "ug", date: "2026-09-01", title: "Uganda", summary: "Service became available in Uganda.", source: { href: "https://spaceinafrica.com/2026/09/01/starlink-is-now-live-in-uganda/", label: "spaceinafrica.com" }, confidence: "high" },
]

export const starlinkLaunches: TimelineItem[] = [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(({ confidence: _c, ...it }) => it)
export const starlinkDatedCount = rows.length
