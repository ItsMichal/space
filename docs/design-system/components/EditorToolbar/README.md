# EditorToolbar

The floating formatting bar of the writing tool: a liquid glass panel with grouped icon buttons and the publish action.

**Consumer provides** the editor commands (bold, italic, link, h2, h3, quote, code, image, embed) with their active state, the save status ("Saved two seconds ago" in serif `meta`) and Publish. Groups are separated by a `hairline` divider. Active buttons get a `paper-raised` fill. Appears as a selection bubble on text selection, and fixed bottom-center while writing. Publish uses `lg-btn--solid`.
