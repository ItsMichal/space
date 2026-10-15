import Link from '@/lib/nav'

export type ProjectRowProps = {
  title: string
  description: string
  year: string
  tags?: string[]
  href: string
}

export function ProjectRow({ title, description, year, tags = [], href }: ProjectRowProps) {
  const meta = [year, ...tags.slice(0, 4)].filter(Boolean).join(' · ')
  return (
    <Link href={href} className="prow card__row">
      <div>
        <h3 className="prow__title">{title}</h3>
        <p className="prow__desc">{description}</p>
      </div>
      <p className="prow__meta">{meta}</p>
    </Link>
  )
}
