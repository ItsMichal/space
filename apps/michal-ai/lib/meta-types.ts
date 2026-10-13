// The slice of Next's `Metadata`, `Viewport` and `MetadataRoute` types this site uses. lib/seo.ts builds these objects and
// lib/rr/head.ts turns them into the head tags React Router renders, so the shapes are kept compatible with what Next accepted.

type TitleObject = { default?: string; template?: string; absolute?: string }
type Icon = { url: string; sizes?: string; type?: string }

export type Metadata = {
  metadataBase?: URL | null
  title?: string | TitleObject
  description?: string
  authors?: { name?: string; url?: string }[]
  keywords?: string | string[]
  robots?: string | { index?: boolean; follow?: boolean }
  manifest?: string
  alternates?: { canonical?: string; types?: Record<string, { url: string; title?: string }[]> }
  icons?: { icon?: Icon[] }
  openGraph?: { type?: string; url?: string; title?: string; description?: string; siteName?: string; locale?: string } & Record<string, unknown>
  twitter?: { card?: string; site?: string; creator?: string; title?: string; description?: string } & Record<string, unknown>
}

export type Viewport = {
  width?: string
  initialScale?: number
  viewportFit?: string
  colorScheme?: string
  themeColor?: string | { media?: string; color: string }[]
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MetadataRoute {
  export type Sitemap = {
    url: string
    lastModified?: string | Date
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
    priority?: number
  }[]
  export type Robots = {
    rules: { userAgent?: string; allow?: string | string[]; disallow?: string | string[] } | { userAgent?: string; allow?: string | string[]; disallow?: string | string[] }[]
    sitemap?: string | string[]
  }
  export type Manifest = {
    name?: string
    short_name?: string
    start_url?: string
    display?: string
    background_color?: string
    theme_color?: string
    icons?: { src: string; sizes?: string; type?: string; purpose?: string }[]
  }
}
