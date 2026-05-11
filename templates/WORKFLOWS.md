# WORKFLOWS

> Concrete procedures the vault executes — triggered actions with defined inputs, steps, hooks, and outputs. Distinct from [[INSTRUCTIONS]] (operating protocol: "how to work in this scope") and [[INFO]] (conventions: "how the docs work"). Workflows are the things that actually run.

## Child of

* [[VAULT]]

## Convention

Each workflow lives at `docs/workflows/<name>.md`, declares `Child of [[WORKFLOWS]]`, and contains five sections:

* **Trigger** — schedule, event, or manual.
* **Inputs** — what docs / external sources it reads.
* **Steps** — ordered procedure.
* **Outputs** — what artifacts / writes it produces.
* **Hooks** — `on-error`, `on-success`, or other side effects.

The schema is intentionally loose. We'll formalize after running 3+ workflows manually and seeing what shape generalizes. Premature schema is the trap to avoid.

## Per-project workflows

Each project can also have its own `docs/projects/<P>/workflows/` folder for project-scoped procedures. The recursive pattern — same five sections, scoped to that project's docs. Cross-project orchestration lives at this vault level; per-project sprint loops live inside the project.
