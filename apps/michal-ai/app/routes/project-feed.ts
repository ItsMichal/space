import type { LoaderFunctionArgs } from 'react-router'
import { GET } from '../projects/[slug]/feed.xml/route'

export const loader = ({ request, params }: LoaderFunctionArgs) => GET(request, { params: Promise.resolve({ slug: params.slug! }) })
