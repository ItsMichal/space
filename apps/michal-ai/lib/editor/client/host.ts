// Which backend the editor talks to. Local dev (`react-router dev`) writes the working tree; the hosted editor (write/, served at
// write.michal.ai) commits to a `write/<slug>` branch and ships through a pull request. The hosted entry calls setEditorHost() once
// before rendering.
export type EditorHost = {
  hosted: boolean
  /** Origin of the public site, for "open the live page" links. Empty means this origin (local dev serves the site too). */
  siteOrigin: string
}

let current: EditorHost = { hosted: false, siteOrigin: '' }

export function setEditorHost(host: EditorHost) {
  current = host
}

export function editorHost(): EditorHost {
  return current
}
