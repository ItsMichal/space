# PresenceChip

A small glass pill showing how many people are on the site right now, as overlapping dots in their presence colors.

**Consumer provides** the list of current visitors' `presence-*` tokens (max 5 dots shown, then "+N") and the count. Label in `label` style: "1 here" when alone, "3 here now" otherwise. Your own dot comes first and carries a 2px `ink` ring. Lives inside NavBar on desktop; alone bottom-left on phones.
