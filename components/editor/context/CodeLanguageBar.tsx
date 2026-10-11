'use client'
import type { Editor } from '@tiptap/core'

const LANGUAGES = [
  ['', 'Plain text'],
  ['ts', 'TypeScript'],
  ['tsx', 'TSX'],
  ['js', 'JavaScript'],
  ['jsx', 'JSX'],
  ['json', 'JSON'],
  ['bash', 'Shell'],
  ['css', 'CSS'],
  ['html', 'HTML'],
  ['python', 'Python'],
  ['rust', 'Rust'],
  ['go', 'Go'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['glsl', 'GLSL'],
  ['sql', 'SQL'],
  ['yaml', 'YAML'],
  ['markdown', 'Markdown'],
  ['diff', 'Diff'],
]

export function CodeLanguageBar({ editor }: { editor: Editor }) {
  const current = (editor.getAttributes('codeBlock').language as string | null) ?? ''
  const options = LANGUAGES.some(([v]) => v === current) ? LANGUAGES : [...LANGUAGES, [current, current]]
  return (
    <>
      <label className="ed-ctx-label" htmlFor="ed-code-lang">
        Language
      </label>
      <select
        id="ed-code-lang"
        className="ed-select"
        value={current}
        onChange={(e) => editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value || null }).run()}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </>
  )
}
