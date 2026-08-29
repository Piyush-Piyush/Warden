# demo/

Self-contained test bed used to develop and demonstrate Warden. Everything in this folder is fake: a small sample "checkout" service, seeded logs/metrics/deploys, and the code candidates the sandbox bisects during a demo run.

This folder is **not part of the Warden product**. It is deletable at any time — Warden itself (`agents/`, `shared/`, `mcp/ops-server`, `server/`, `dashboard/`) does not import or depend on anything here. It only exists so the ops-mcp server and the orchestrator agent have something realistic to point at.

A real deployment would replace this with its own project manifest pointed at its own logs/metrics/deploys tools (see `docs/incident-responder.md` for how that works) — placed anywhere, including outside this repo entirely.

Layout (filled in as development reaches each milestone — see `docs/development-workflow.md`):

```
demo/
└── sample-checkout/
    ├── incident.yaml      # the fake project's manifest
    └── seed/
        ├── logs.json
        ├── metrics.json
        ├── deploys.json
        ├── commits.json
        └── bisect/
            ├── harness.js
            ├── upstream_latency.json
            └── candidates/
                ├── 9f01/service.js   # baseline
                ├── a1b2/service.js   # distractor
                └── 4c21/service.js   # culprit
```
