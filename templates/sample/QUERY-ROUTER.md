# QUERY ROUTER

> Component of [[ATLAS SEARCH]]. Classifies incoming queries and dispatches them to the right downstream index (docs, people, services). Small classifier plus a hand-tuned rule layer for high-confidence patterns.

The Query Router is the first thing a query hits inside [[ATLAS SEARCH]]. Its job is narrow: look at the user's question, decide which of the three downstream indexes is most likely to contain the answer, and forward the query there. It does not produce final answers — it only routes.

## Overview

The router has two layers:

* **Rules layer**: a small set of hand-tuned patterns that catch high-confidence cases ("who owns X" → people index, "where do I file Y" → docs index). Fast, deterministic, easy to debug. Covers maybe 30% of real traffic.
* **Classifier**: a small fine-tuned model that handles everything the rules miss. Outputs a label plus a confidence score. The downstream ranker uses the confidence as one of its features.

Most engineering effort goes into the classifier and its eval set. The rules exist mainly to short-circuit common patterns and keep p50 latency under 80ms.

## Child of

* [[ATLAS SEARCH]]

## Notes

* Current accuracy on the held-out eval set is ~84%. Most errors are genuinely ambiguous queries that could legitimately go to two indexes ("who knows about the billing pipeline" — people or docs?).
* Considering a "multi-route" mode where below-threshold queries get sent to two indexes and the ranker picks. Risk: doubles downstream load.
* Eval set needs refresh — last update was two months ago and query distribution has drifted.
