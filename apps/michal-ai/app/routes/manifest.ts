import manifest from '../manifest'

export function loader() {
  return new Response(JSON.stringify(manifest()), { headers: { 'Content-Type': 'application/manifest+json' } })
}
