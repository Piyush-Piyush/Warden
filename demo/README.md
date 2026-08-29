# demo/

Self-contained test bed used to develop and demonstrate Warden. Everything in this folder is fake: a small sample "checkout" service, seeded logs/metrics/deploys, and the code candidates the sandbox bisects during a demo run.

This folder is **not part of the Warden product**. It is deletable at any time: Warden itself (`agents/`, `shared/`, `mcp/ops-server`, `server/`, `dashboard/`) does not import or depend on anything here. It only exists so the ops-mcp server and the orchestrator agent have something realistic to point at.

A real deployment would replace this with its own project manifest pointed at its own logs/metrics/deploys tools, placed anywhere, including outside this repo entirely.

Layout:

```
demo/
└── sample-checkout/
    ├── incident.yaml      # the fake project's manifest
    └── seed/
        ├── logs.json
        ├── metrics.json
        ├── deploys.json   # also ops-server's fallback deploy source if GitHub MCP errors
        └── bisect/
            ├── harness.py
            ├── upstream_latency.json
            └── candidates/            # directory names are real commit shas on
                                        # github.com/Piyush-Piyush/warden-sample-checkout
                ├── 7e484d6/service.py  # baseline
                ├── 3839bc0/service.py  # distractor
                └── bb83296/service.py  # culprit
```
