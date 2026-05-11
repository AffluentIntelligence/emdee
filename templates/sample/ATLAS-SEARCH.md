# ATLAS SEARCH

> Internal semantic search service Acme is building to replace its keyword-only intranet search. Indexes internal docs, people, and services, then routes natural-language queries to the right destination. Prototype stage, ~3 months in.

Atlas Search is the flagship project under [[ACME WORKSPACE]]. The team is small (three engineers) and the current focus is getting query classification and ranking right on the existing eval set before scaling the index out to all of Acme's internal content.

## Child of

* [[ACME WORKSPACE]]

## Parent of

* [[QUERY ROUTER]]

## Associated with

* [[MAYA CHEN]] — engineer on the team since March, owns the ranking layer that orders results once the [[QUERY ROUTER]] has picked an index

## CONTEXT

The product lets employees type questions like "what's our holiday policy" or "who owns the billing pipeline" and routes them to the most relevant team, doc, or service. Architecturally it's a thin layer:

1. The [[QUERY ROUTER]] takes the raw query and decides which downstream index to search (docs, people, services).
2. The chosen index runs vector search plus a small re-ranker.
3. The result is rendered with citations so the user can verify the source.

The whole system is deliberately boring — no novel ML, just glue between an embedding model, a vector store, and the routing classifier.

## BUILD

* Decide how to handle classifier uncertainty: surface it when the top label is below threshold, or silently fall back to docs.
* Integrate with the team directory so people-routing actually works end-to-end (next milestone).
* Design a story for incremental re-indexing — the team has been bitten twice by stale vector indexes after schema changes, and this needs to land before launch.

## LEARNINGS

* [2026-04] Boring stack beats novel stack for prototypes — keep ML novel only in the parts that need it.

## LOGS

* [2026-02] Project kickoff with 3 engineers, scoped to internal-only.
* [2026-03] Maya Chen joined, took over ranking.

## Links

* Internal design doc: `acme.internal/atlas/design`
* Eval dashboard: `acme.internal/atlas/eval`
