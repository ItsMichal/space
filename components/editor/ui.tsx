'use client'
import type { Editor } from '@tiptap/core'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Re-render the caller on every editor transaction (Tiptap v3 does not by default). */
export function useEditorTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    let raf = 0
    const bump = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTick((t) => t + 1))
    }
    editor.on('transaction', bump)
    editor.on('focus', bump)
    editor.on('blur', bump)
    return () => {
      cancelAnimationFrame(raf)
      editor.off('transaction', bump)
      editor.off('focus', bump)
      editor.off('blur', bump)
    }
  }, [editor])
  return tick
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  icon?: LucideIcon
  label?: string
  title: string
  shortcut?: string
  active?: boolean
  children?: ReactNode
}

const prettyShortcut = (s: string) => s.replace('Mod-', typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+').replace('Alt-', '⌥').replace('Shift-', '⇧').replace(/-/g, '')

/** Toolbar button. mousedown is cancelled so the editor keeps its selection. */
export function IconButton({ icon: Icon, label, title, shortcut, active, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`ed-btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active ?? undefined}
      aria-label={title}
      title={shortcut ? `${title} (${prettyShortcut(shortcut)})` : title}
      onMouseDown={(e) => e.preventDefault()}
      {...rest}
    >
      {Icon ? <Icon size={18} strokeWidth={1.5} aria-hidden /> : null}
      {label ? <span>{label}</span> : null}
      {children}
    </button>
  )
}

export function Divider() {
  return <span className="ed-divider" role="separator" />
}
