# ACME WORKSPACE

> Example workspace doc grouping everything related to the fictional Acme project — a small team building an internal semantic search service. Acts as the top-level index for the sample docs in this vault.

This sample exists to show how an index/taxonomy doc looks. In a real vault, this is where you'd keep a one-screen overview of a company, a workspace, a research area, or any other broad container that has multiple things "inside" it. The `Parent of` section below is what makes it an index: every doc listed there inherits this one as its taxonomic parent.

## Overview

Acme is a 40-person company building internal tooling. The Atlas Search project is their current bet — replace the existing keyword-only intranet search with something that understands natural-language questions and routes them to the right team, doc, or service. Maya Chen leads ranking, and the team is in the "prove the prototype works" phase.

## Child of

* [[SAMPLE]]

## Parent of

* [[ATLAS SEARCH]]

## Notes

* Use index docs sparingly — they earn their keep when you have at least 3–4 children worth grouping. One-child indexes are usually noise; just link directly.
* The whole sample set is seeded by `mane init` purely to demonstrate conventions. Once you understand the structure, delete them with `rm -rf docs/sample/` and start writing your real vault.
