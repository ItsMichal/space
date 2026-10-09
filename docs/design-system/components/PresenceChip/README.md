# PresenceChip

Overlapping dots in the nav showing who is reading right now — color only, no count text.

**Consumer provides** the current visitors' `presence-*` tokens (max 5 dots, then a sixth neutral `dot` for more). Your own dot comes first with a moss (`accent`) ring. On hover or focus a small glass popover says, in serif `meta`, *You and two others are reading this — Reykjavík, Berlin.* An accessible label carries the same sentence; count changes are announced politely, never pointer moves. Lives inside NavBar, merging with the nav pill as liquid glass.
