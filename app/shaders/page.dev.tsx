import { getTopLevel } from '@/lib/content'
import { Picture } from '@/components/media/Picture'
import { ShaderLab } from './ShaderLab'

export const metadata = { title: 'Shader lab', robots: { index: false, follow: false } }

/** Dev-only comparison route: every treatment variant on real project images, with live dials. */
export default function ShadersPage() {
  const covers = getTopLevel('project')
    .filter((p) => p.cover)
    .slice(0, 3)
  const items = covers.map((p) => ({
    key: p.slug,
    title: p.title,
    wide: (
      <Picture src={p.cover!} alt="" sizes="(min-width: 1120px) 1120px, 100vw" aspect="16 / 9" focus={p.coverFocus} className="shader-lab__img" />
    ),
    thumb: <Picture src={p.cover!} alt="" sizes="176px" aspect="4 / 3" focus={p.coverFocus} className="shader-lab__thumb" />,
    seedSrc: p.cover!,
  }))
  return <ShaderLab items={items} />
}
