# culprit (github.com/Piyush-Piyush/warden-sample-checkout@bb83296): reduced
# the upstream timeout budget, causing real timeouts under normal upstream
# latency variance
TIMEOUT_BUDGET_MS = 150


def handle_checkout_request(simulated_upstream_latency_ms):
    for attempt in range(3):
        if simulated_upstream_latency_ms <= TIMEOUT_BUDGET_MS:
            return {"timed_out": False, "attempt": attempt}
    return {"timed_out": True}
