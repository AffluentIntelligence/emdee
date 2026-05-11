# TITLE

> 1–3 sentence summary. This is the highest-leverage line in the doc; `get_summary` returns ONLY this. Be specific enough to decide whether to drill in.

## Child of

* [[SAMPLE]]

## Parent of

* [[Child Doc Title]]

## Associated with

* [[Related Doc]] — prose explaining the relationship; embed [[other links]] inside the prose for navigation, but remember only the leading link creates an edge
* [[Another Doc]]

## CONTEXT

Optional. 1–3 paragraphs of stable background that the summary couldn't fit. Delete this section if the summary alone is enough.

## BUILD

* What's being worked on now and why.

## LEARNINGS

* [YYYY-MM] <lesson> — supersedes nothing, or supersedes [date] <prior lesson>

## LOGS

* [YYYY-MM-DD] <event>

<!--
How to use this template:

Universal sections (every doc):
  - H1 title
  - Blockquote summary directly below the H1
  - Relationship sections: Child of, Parent of, Associated with (clustered together as a metadata block — do not split with body content)

Optional universal section:
  - CONTEXT — stable background prose. Delete if the summary alone is enough.

Active-doc sections (project docs with ongoing work only — delete these on non-project docs):
  - BUILD — current sprint / active work, 3–7 items max. When an item ships or goes stale, move it to LOGS.
  - LEARNINGS — distilled wisdom, dated entries, append rarely, supersede explicitly.
  - LOGS — append-only chronological record. Excluded from get_doc by default.

Order: H1 → summary → optional intro paragraph → Child of → Parent of → Associated with → CONTEXT → BUILD → LEARNINGS → LOGS → any other optional sections (NOTES, LINKS, etc.) only if they have actual content.

The first wiki-link on each bullet under a relationship section is the declared edge. Inline wiki-links in prose are navigation hints, not edges.
-->
