# baseline (github.com/Piyush-Piyush/warden-sample-checkout@7e484d6) —
# the timeout budget before the incident-causing deploy
TIMEOUT_BUDGET_MS = 500


def handle_checkout_request(simulated_upstream_latency_ms):
    for attempt in range(3):
        if simulated_upstream_latency_ms <= TIMEOUT_BUDGET_MS:
            return {"timed_out": False, "attempt": attempt}
    return {"timed_out": True}
