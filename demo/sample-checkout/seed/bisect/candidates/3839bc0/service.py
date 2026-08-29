# distractor (github.com/Piyush-Piyush/warden-sample-checkout@3839bc0):
# the real commit adds a logging line here; omitted from this fixture so the
# harness's stdout stays one clean JSON line (see docs/development-workflow.md
# M7 for why commit metadata and bisect execution are decoupled on purpose).
# The timeout budget is unchanged from baseline either way.
TIMEOUT_BUDGET_MS = 500


def handle_checkout_request(simulated_upstream_latency_ms):
    for attempt in range(3):
        if simulated_upstream_latency_ms <= TIMEOUT_BUDGET_MS:
            return {"timed_out": False, "attempt": attempt}
    return {"timed_out": True}
