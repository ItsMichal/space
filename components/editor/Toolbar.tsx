'use client'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/react/menus'
import { Redo2, Undo2 } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { contextBars, toolbarItems } from '@/lib/editor/extensions'
import { Divider, IconButton, useEditorTick } from './ui'

const GROUPS = ['inline', 'block', 'insert'] as const

/** Fixed, glass, bottom-centre (docs/design-system/components/EditorToolbar). `end` holds status + Publish. */
export function Toolbar({ editor, end }: { editor: Editor; end: ReactNode }) {
  useEditorTick(editor)
  const active = contextBars.filter((c) => c.when(editor))
  return (
    <div className="ed-dock">
      {active.map(({ id, Component }) => (
        <div key={id} className="ed-glass ed-context" role="toolbar" aria-label={`${id} options`}>
          <Component editor={editor} />
        </div>
      ))}
      <div className="ed-glass ed-toolbar" role="toolbar" aria-label="Formatting">
        {GROUPS.map((group) => (
          <Fragment key={group}>
            {toolbarItems
              .filter((t) => t.group === group)
              .map((t) => (
                <IconButton
                  key={t.id}
                  icon={t.icon}
                  label={t.label}
                  title={t.title}
                  shortcut={t.shortcut}
                  active={t.isActive?.(editor) ?? false}
                  disabled={t.isDisabled?.(editor)}
                  onClick={() => t.run(editor)}
                />
              ))}
            <Divider />
          </Fragment>
        ))}
        <IconButton icon={Undo2} title="Undo" shortcut="Mod-Z" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <IconButton icon={Redo2} title="Redo" shortcut="Mod-Shift-Z" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
        <Divider />
        {end}
      </div>
    </div>
  )
}

/** Floating selection bubble: items flagged `bubble: true` in the registry. */
export function Bubble({ editor }: { editor: Editor }) {
  useEditorTick(editor)
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 10 }}
      shouldShow={({ editor: e, state }) =>
        e.isEditable && !state.selection.empty && !e.isActive('codeBlock') && !e.isActive('image') && state.selection instanceof TextSelection
      }
    >
      <div className="ed-glass ed-bubble" role="toolbar" aria-label="Selection formatting">
        {toolbarItems
          .filter((t) => t.bubble)
          .map((t) => (
            <IconButton
              key={t.id}
              icon={t.icon}
              label={t.label}
              title={t.title}
              shortcut={t.shortcut}
              active={t.isActive?.(editor) ?? false}
              onClick={() => t.run(editor)}
            />
          ))}
      </div>
    </BubbleMenu>
  )
}
